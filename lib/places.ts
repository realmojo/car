/**
 * 주차장·정비업체·검사소 조회. Supabase(pflow-kr) 의 car_* 테이블을 PostgREST 로 읽는다.
 * MOCK_DATA=1 이면 public/data 의 가짜 데이터(scripts/sync-data.ts --mock)를 대신 쓴다.
 *
 * 테이블은 공개 읽기 전용(RLS)이라 공개용 publishable 키만 쓴다.
 */
import { cached } from "./cache";
import { filterRows, loadRows, paginate } from "./datasets";
import type { Row } from "./dataset-types";

export type PlaceDataset = "parking" | "repair" | "inspection";

const TABLES: Record<PlaceDataset, string> = {
  parking: "car_parking",
  repair: "car_repair",
  inspection: "car_inspection",
};

const SUPABASE_URL = process.env.SUPABASE_URL || "https://mbxdcxlxugsnmljzdlkp.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_LZDtNaj2bmIffIOsqA6x7g_HNPhAjFQ";
const COLUMNS = "key,sido,gu,name,sub,address,lat,lng,tel,tags,flags,info,num";
const TTL = 600;

const mock = () => process.env.MOCK_DATA === "1";

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

type DbRow = Omit<Row, "sub" | "address" | "lat" | "lng" | "tel" | "gu" | "sido" | "num"> & {
  sub: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  tel: string | null;
  sido: string | null;
  gu: string | null;
  num: Record<string, number> | null;
};

function toRow(r: DbRow): Row {
  return {
    key: r.key,
    name: r.name,
    sub: r.sub ?? undefined,
    address: r.address ?? undefined,
    lat: r.lat ?? undefined,
    lng: r.lng ?? undefined,
    tel: r.tel ?? undefined,
    sido: r.sido ?? undefined,
    gu: r.gu ?? undefined,
    tags: r.tags ?? [],
    flags: r.flags ?? [],
    info: r.info ?? [],
    num: r.num ?? undefined,
  };
}

async function rest(table: string, params: URLSearchParams, withCount: boolean) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  return cached(`sb:${url}`, TTL, async () => {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(10000),
      cache: "no-store",
      headers: {
        apikey: SUPABASE_KEY,
        accept: "application/json",
        ...(withCount ? { prefer: "count=exact" } : {}),
      },
    });
    if (!res.ok) throw new Error(`데이터베이스 오류 (${res.status})`);
    const rows = (await res.json()) as DbRow[];
    const range = res.headers.get("content-range") ?? "";
    const total = Number(range.split("/")[1]) || rows.length;
    return { rows: rows.map(toRow), total };
  });
}

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
