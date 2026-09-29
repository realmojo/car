/**
 * 주차장·정비업체·검사소 조회. Supabase(pflow-kr) 의 car_* 테이블을 PostgREST 로 읽는다.
 * MOCK_DATA=1 이면 public/data 의 가짜 데이터(scripts/sync-data.ts --mock)를 대신 쓴다.
 *
 * 테이블은 공개 읽기 전용(RLS)이라 공개용 publishable 키만 쓴다.
 */
import { cached } from "./cache";
import { filterRows, loadRows, paginate } from "./datasets";
import type { Row } from "./dataset-types";
import { COLUMNS, SUPABASE_KEY, SUPABASE_URL, TABLES, isMock as mock, sbSelect } from "./supabase";

export type PlaceDataset = "parking" | "repair" | "inspection";

const TTL = 600;

export interface PlaceQuery {
  sido?: string;
  gu?: string;
  q?: string;
  flags?: string[];
  sort?: "capacity";
  page?: number;
  size?: number;
}

export interface PlacePage {
  items: Row[];
  total: number;
  page: number;
  pages: number;
}

const rest = (table: string, params: URLSearchParams, withCount: boolean) => sbSelect(table, params, TTL, withCount);

/** 검색어를 PostgREST ilike 조건으로. 쉼표·괄호처럼 문법에 쓰이는 문자는 뺀다 */
function words(q?: string) {
  return (q ?? "")
    .toLowerCase()
    .replace(/[,()*%\\:."']/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5);
}

export async function queryPlaces(dataset: PlaceDataset, query: PlaceQuery): Promise<PlacePage | null> {
  const size = query.size ?? 20;
  if (mock()) {
    const rows = await loadRows(dataset, query.sido);
    if (!rows) return null;
    let filtered = filterRows(rows, { gu: query.gu, q: query.q, flags: query.flags });
    if (query.sort === "capacity") filtered = [...filtered].sort((a, b) => (b.num?.capacity ?? 0) - (a.num?.capacity ?? 0));
    return paginate(filtered, query.page ?? 1, size);
  }

  const page = Math.max(1, query.page || 1);
  const p = new URLSearchParams({ select: COLUMNS });
  if (query.sido) p.set("sido", `eq.${query.sido}`);
  if (query.gu) p.set("gu", `eq.${query.gu}`);
  if (query.flags?.length) p.set("flags", `cs.{${query.flags.join(",")}}`);
  const w = words(query.q);
  if (w.length) p.set("and", `(${w.map((x) => `search.ilike.*${x}*`).join(",")})`);
  p.set("order", query.sort === "capacity" ? "num->capacity.desc.nullslast,name.asc" : "name.asc");
  p.set("offset", String((page - 1) * size));
  p.set("limit", String(size));

  const { rows, total } = await rest(TABLES[dataset], p, true);
  return { items: rows, total, page, pages: Math.max(1, Math.ceil(total / size)) };
}

export async function getPlace(dataset: PlaceDataset, key: string): Promise<Row | null> {
  if (!/^[a-z0-9]+$/.test(key)) return null;
  if (mock()) {
    for (const s of ["seoul", "gyeonggi", "busan"]) {
      const hit = (await loadRows(dataset, s))?.find((r) => r.key === key);
      if (hit) return hit;
    }
    return null;
  }
  const p = new URLSearchParams({ select: COLUMNS, key: `eq.${key}`, limit: "1" });
  const { rows } = await rest(TABLES[dataset], p, false);
  return rows[0] ?? null;
}

/** 전국 건수 (홈 요약) */
export async function countPlaces(dataset: PlaceDataset): Promise<number> {
  if (mock()) {
    let n = 0;
    for (const s of ["seoul", "gyeonggi", "busan"]) n += (await loadRows(dataset, s))?.length ?? 0;
    return n;
  }
  const p = new URLSearchParams({ select: "key", limit: "1" });
  const { total } = await rest(TABLES[dataset], p, true);
  return total;
}


/** 상세 URL id("seoul-ab12cd") → 행. 시도는 브레드크럼용으로 함께 돌려준다 */
export async function findPlace(dataset: PlaceDataset, id: string): Promise<{ row: Row; sido?: string } | null> {
  const m = id.match(/^([a-z]+)-([a-z0-9]+)$/);
  if (!m) return null;
  const row = await getPlace(dataset, m[2]);
  return row ? { row, sido: row.sido ?? m[1] } : null;
}

/** 사이트맵용: 상세 URL 에 필요한 키만 순서대로 가져온다 (PostgREST 한 번에 최대 1,000건) */
export async function listPlaceKeys(
  dataset: PlaceDataset,
  offset: number,
  limit: number,
): Promise<Array<{ key: string; sido: string; syncedAt?: string }>> {
  if (mock()) {
    const out: Array<{ key: string; sido: string }> = [];
    for (const s of ["seoul", "gyeonggi", "busan"]) {
      for (const r of (await loadRows(dataset, s)) ?? []) out.push({ key: r.key, sido: s });
    }
    return out.slice(offset, offset + limit);
  }
  const out: Array<{ key: string; sido: string; syncedAt?: string }> = [];
  for (let start = offset; start < offset + limit; start += 1000) {
    const p = new URLSearchParams({
      select: "key,sido,synced_at",
      sido: "not.is.null",
      order: "key.asc",
      offset: String(start),
      limit: String(Math.min(1000, offset + limit - start)),
    });
    const url = `${SUPABASE_URL}/rest/v1/${TABLES[dataset]}?${p}`;
    const rows = await cached(`sb:${url}`, 3600, async () => {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
        headers: { apikey: SUPABASE_KEY, accept: "application/json" },
      });
      if (!res.ok) throw new Error(`데이터베이스 오류 (${res.status})`);
      return (await res.json()) as Array<{ key: string; sido: string; synced_at: string }>;
    });
    out.push(...rows.map((r) => ({ key: r.key, sido: r.sido, syncedAt: r.synced_at })));
    if (rows.length < 1000) break;
  }
  return out;
}

export interface PlaceContext {
  /** 같은 시군구의 다른 시설 (가까운 순) */
  nearby: Array<{ row: Row; km?: number }>;
  /** 같은 시군구 시설 수 (본인 포함, 최대 1,000건까지 센다) */
  total: number;
  /** 같은 시군구에서 플래그별 시설 수 */
  flagCounts: Record<string, number>;
  /** 같은 시군구 주차장 평균 주차면 (주차장만) */
  avgCapacity?: number;
  /** 같은 시군구 시설 목록 (통계용) */
  rows: Row[];
}

function distance(a: { lat?: number; lng?: number }, b: { lat?: number; lng?: number }) {
  if (!a.lat || !a.lng || !b.lat || !b.lng) return undefined;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** 상세 페이지 본문용: 같은 시군구 시설로 주변 목록과 지역 통계를 만든다 */
export async function placeContext(dataset: PlaceDataset, row: Row, limit = 6): Promise<PlaceContext> {
  let rows: Row[] = [];
  if (row.sido) {
    if (mock()) {
      rows = ((await loadRows(dataset, row.sido)) ?? []).filter((r) => !row.gu || r.gu === row.gu);
    } else {
      const p = new URLSearchParams({ select: COLUMNS, sido: `eq.${row.sido}`, order: "name.asc", limit: "1000" });
      if (row.gu) p.set("gu", `eq.${row.gu}`);
      rows = (await sbSelect(TABLES[dataset], p, 3600)).rows;
    }
  }
  const flagCounts: Record<string, number> = {};
  for (const r of rows) for (const f of r.flags) flagCounts[f] = (flagCounts[f] ?? 0) + 1;
  const caps = rows.map((r) => r.num?.capacity ?? 0).filter((c) => c > 0);
  const nearby = rows
    .filter((r) => r.key !== row.key)
    .map((r) => ({ row: r, km: distance(row, r) }))
    .sort((a, b) => (a.km ?? Infinity) - (b.km ?? Infinity) || a.row.name.localeCompare(b.row.name, "ko"))
    .slice(0, limit);
  return {
    nearby,
    total: rows.length,
    flagCounts,
    avgCapacity: caps.length ? Math.round(caps.reduce((a, b) => a + b, 0) / caps.length) : undefined,
    rows,
  };
}
