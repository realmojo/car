/**
 * 휴게소·수소충전소·리콜·연비처럼 행 수가 적은 데이터셋을 읽는다.
 *
 * - 운영: Supabase car_* 테이블 전체를 읽어 캐시한다 (lib/supabase.ts).
 * - MOCK_DATA=1: public/data/<dataset>/<shard>.json (scripts/sync-data.ts --mock 으로 만든 가짜 데이터).
 * 데이터가 없으면 null 을 돌려주고, 페이지는 "데이터 준비 중" 안내를 띄운다.
 */
import { SHARDED, type DatasetId, type Row, type Shard } from "./dataset-types";
import { findSido } from "./codes";
import { COLUMNS, TABLES, isMock, sbAll, sbSelect } from "./supabase";

export type { DatasetId, Row } from "./dataset-types";

async function readPublic(path: string): Promise<string | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const env = getCloudflareContext().env as { ASSETS?: { fetch: typeof fetch } };
    if (env.ASSETS) {
      const res = await env.ASSETS.fetch(new Request(`https://assets.local/${path}`));
      if (res.ok) return await res.text();
    }
  } catch {
    // Cloudflare 컨텍스트가 없으면(로컬 Node) 파일 시스템으로 넘어간다
  }
  try {
    const fs = await import("node:fs/promises");
    const nodePath = await import("node:path");
    return await fs.readFile(nodePath.join(process.cwd(), "public", path), "utf8");
  } catch {
    return null;
  }
}

// 정적 자산은 이미 엣지에 캐시되므로 Cache API 는 쓰지 않고 인스턴스 메모리에만 둔다
const memo = new Map<string, { expires: number; value: Promise<unknown> }>();
const MEMO_TTL = 3600_000;
const MEMO_LIMIT = 40;

const MISS_TTL = 60_000;

function readJson<T>(path: string): Promise<T | null> {
  const hit = memo.get(path);
  if (hit && hit.expires > Date.now()) return hit.value as Promise<T | null>;
  const value = readPublic(path).then((text) => (text ? (JSON.parse(text) as T) : null));
  if (memo.size >= MEMO_LIMIT) memo.delete(memo.keys().next().value as string);
  memo.set(path, { expires: Date.now() + MEMO_TTL, value });
  // 없는 파일은 곧 동기화될 수 있으니 1분만 기억한다
  value.then(
    (v) => {
      if (v === null) memo.set(path, { expires: Date.now() + MISS_TTL, value });
    },
    () => memo.delete(path),
  );
  return value;
}

export async function loadShard(dataset: DatasetId, shard: string): Promise<Shard | null> {
  if (!/^[a-z]+$/.test(shard)) return null;
  return readJson<Shard>(`data/${dataset}/${shard}.json`);
}

/**
 * 데이터셋 전체 행. 시도 단위 데이터셋(주차장·정비·검사소)은 가짜 데이터에서만 쓰고,
 * 운영에서는 lib/places.ts 가 Supabase 에 조건을 걸어 직접 조회한다.
 */
export async function loadRows(dataset: DatasetId, sido?: string): Promise<Row[] | null> {
  if (!isMock()) {
    if (SHARDED[dataset]) return null;
    try {
      const rows = await sbAll(dataset);
      return rows.length ? rows : null;
    } catch {
      return null;
    }
  }
  const shard = SHARDED[dataset] ? sido : "all";
  if (!shard || (SHARDED[dataset] && !findSido(shard))) return null;
  const data = await loadShard(dataset, shard);
  return data?.items ?? null;
}

/**
 * num.<field> 기준 최신 n건 (홈 요약). 전체를 받아 정렬하면 리콜만 780KB 라
 * 캐시가 빈 워커에서 첫 화면이 몇 초씩 걸린다. DB 에서 정렬해 n건만 받는다.
 */
export async function latestRows(dataset: DatasetId, field: string, n: number): Promise<Row[] | null> {
  if (isMock()) {
    const rows = await loadRows(dataset);
    return rows ? [...rows].sort((a, b) => (b.num?.[field] ?? 0) - (a.num?.[field] ?? 0)).slice(0, n) : null;
  }
  try {
    const p = new URLSearchParams({ select: COLUMNS, order: `num->${field}.desc.nullslast,key.asc`, limit: String(n) });
    const { rows } = await sbSelect(TABLES[dataset], p, 3600);
    return rows.length ? rows : null;
  } catch {
    return null;
  }
}

/** 데이터셋 전체 건수 (홈 요약) */
export async function countRows(dataset: DatasetId): Promise<number> {
  if (isMock()) return (await loadRows(dataset))?.length ?? 0;
  const { total } = await sbSelect(TABLES[dataset], new URLSearchParams({ select: "key", limit: "1" }), 600, true);
  return total;
}

/**
 * 상세 페이지 URL 의 id. 시도 단위 데이터셋은 "seoul-ab12cd", 단일 파일은 "ab12cd".
 */
export function rowId(dataset: DatasetId, row: Row, sido?: string) {
  return SHARDED[dataset] ? `${sido}-${row.key}` : row.key;
}

export async function findRow(dataset: DatasetId, id: string): Promise<{ row: Row; sido?: string } | null> {
  if (SHARDED[dataset]) {
    const m = id.match(/^([a-z]+)-([a-z0-9]+)$/);
    if (!m) return null;
    const rows = await loadRows(dataset, m[1]);
    const row = rows?.find((r) => r.key === m[2]);
    return row ? { row, sido: m[1] } : null;
  }
  if (!/^[a-z0-9]+$/.test(id)) return null;
  const rows = await loadRows(dataset);
  const row = rows?.find((r) => r.key === id);
  return row ? { row } : null;
}

export interface Query {
  gu?: string;
  q?: string;
  flags?: string[];
}

export function filterRows(rows: Row[], { gu, q, flags = [] }: Query): Row[] {
  const words = (q ?? "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  return rows.filter((r) => {
    if (gu && r.gu !== gu) return false;
    if (flags.some((f) => !r.flags.includes(f))) return false;
    if (words.length) {
      const hay = `${r.name} ${r.sub ?? ""} ${r.address ?? ""} ${r.tags.join(" ")}`.toLowerCase();
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
}

export function paginate<T>(items: T[], page: number, size = 20) {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(Math.max(1, page || 1), pages);
  return { items: items.slice((current - 1) * size, current * size), page: current, pages, total: items.length };
}
