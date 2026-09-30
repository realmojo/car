/**
 * 지역별 목록 페이지의 주소와 건수.
 *
 * 목록 주소는 /<카테고리>/<종류>/<시도>/<시군구코드> 경로로 쓴다.
 *   /parking/free/seoul/11680  → 서울 강남구 무료 주차장
 * 예전에는 /parking?sido=seoul&gu=11680&f=free 처럼 쿼리스트링이었는데, 제목과 canonical 이
 * 모두 /parking 하나라 검색엔진에는 지역 페이지가 전부 같은 페이지로 보였다.
 * 옛 주소는 middleware.ts 가 lib/legacy.ts 로 새 주소를 찾아 301 로 넘긴다.
 */
import { cached } from "./cache";
import { SIDO, SIGUNGU, findSido, findSigungu, type Sido, type Sigungu } from "./codes";
import { loadRows } from "./datasets";
import { SUPABASE_KEY, SUPABASE_URL, TABLES, isMock } from "./supabase";
import { listPath, type Section } from "./url";
import type { PlaceDataset } from "./places";

export { listPath, type Section };

export interface Region {
  sido?: Sido;
  gu?: Sigungu;
}

/** [[...region]] 세그먼트 → 시도·시군구. 모르는 값이면 null (404) */
export function parseRegion(segments: string[] | undefined): Region | null {
  const [s, g, ...rest] = segments ?? [];
  if (rest.length) return null;
  if (!s) return {};
  const sido = findSido(s);
  if (!sido) return null;
  if (!g) return { sido };
  const gu = findSigungu(sido.slug, g);
  return gu ? { sido, gu } : null;
}

/** "서울 강남구" / "서울특별시" / "전국" */
export function regionName(r: Region, long = false) {
  if (r.gu) return `${r.sido!.short} ${r.gu.name}`;
  if (r.sido) return long ? r.sido.name : r.sido.short;
  return "전국";
}

/* ------------------------------------------------------------ 지역별 건수 */

export interface Tally {
  /** 시설 수 */
  n: number;
  /** 플래그별 시설 수 (free, public, general …). "public+free" 는 공영이면서 무료인 곳 */
  f: Record<string, number>;
  /** 주차면 합계 (주차장만) */
  cap: number;
}

/** 시도 → 시군구 코드("" 는 시군구 미상) → 건수 */
export type RegionIndex = Record<string, Record<string, Tally>>;

type IndexRow = { sido: string | null; gu: string | null; flags: string[] | null; cap?: number | null };

const empty = (): Tally => ({ n: 0, f: {}, cap: 0 });

function add(t: Tally, r: IndexRow) {
  t.n++;
  const flags = r.flags ?? [];
  for (const f of flags) t.f[f] = (t.f[f] ?? 0) + 1;
  if (flags.includes("public") && flags.includes("free")) t.f["public+free"] = (t.f["public+free"] ?? 0) + 1;
  t.cap += Number(r.cap) || 0;
}

async function fetchIndexRows(dataset: PlaceDataset): Promise<IndexRow[]> {
  if (isMock()) {
    const out: IndexRow[] = [];
    for (const s of ["seoul", "gyeonggi", "busan"]) {
      for (const r of (await loadRows(dataset, s)) ?? []) {
        out.push({ sido: s, gu: r.gu ?? null, flags: r.flags, cap: r.num?.capacity });
      }
    }
    return out;
  }
  const table = TABLES[dataset];
  const select = dataset === "parking" ? "sido,gu,flags,cap:num->capacity" : "sido,gu,flags";
  const get = async (offset: number, count = false) => {
    const p = new URLSearchParams({ select, sido: "not.is.null", order: "key.asc", offset: String(offset), limit: "1000" });
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${p}`, {
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
      headers: { apikey: SUPABASE_KEY, accept: "application/json", ...(count ? { prefer: "count=exact" } : {}) },
    });
    if (!res.ok) throw new Error(`데이터베이스 오류 (${res.status})`);
    const total = Number((res.headers.get("content-range") ?? "").split("/")[1]) || 0;
    return { rows: (await res.json()) as IndexRow[], total };
  };
  // 첫 페이지로 전체 건수를 알고 나머지는 한꺼번에 받는다 (정비업체 3만여 건 = 34번)
  const first = await get(0, true);
  const offsets: number[] = [];
  for (let o = 1000; o < first.total; o += 1000) offsets.push(o);
  const rest: IndexRow[][] = [];
  for (let i = 0; i < offsets.length; i += 6) {
    const chunk = await Promise.all(offsets.slice(i, i + 6).map((o) => get(o).then((r) => r.rows)));
    rest.push(...chunk);
  }
  return [first.rows, ...rest].flat();
}

/**
 * 데이터셋의 시도·시군구별 건수. 지역 목록의 요약 문단, 시군구 링크의 건수,
 * 사이트맵에서 빈 지역을 빼는 데 쓴다. 원천 데이터가 월 단위로 바뀌어 하루 캐시한다.
 */
export function regionIndex(dataset: PlaceDataset): Promise<RegionIndex> {
  return cached(`region-index:v1:${dataset}`, 86400, async () => {
    const index: RegionIndex = {};
    for (const r of await fetchIndexRows(dataset)) {
      if (!r.sido) continue;
      const bySido = (index[r.sido] ??= {});
      add((bySido[r.gu ?? ""] ??= empty()), r);
    }
    return index;
  });
}

/** 전국 / 시도 / 시군구 합계 */
export function tally(index: RegionIndex, sido?: string, gu?: string): Tally {
  const out = empty();
  const merge = (t: Tally) => {
    out.n += t.n;
    out.cap += t.cap;
    for (const [k, v] of Object.entries(t.f)) out.f[k] = (out.f[k] ?? 0) + v;
  };
  for (const [s, byGu] of Object.entries(index)) {
    if (sido && s !== sido) continue;
    for (const [g, t] of Object.entries(byGu)) {
      if (gu && g !== gu) continue;
      merge(t);
    }
  }
  return out;
}

/** 건수 하나를 고른다: flag 가 없으면 전체, 있으면 그 플래그 수 */
export const countOf = (t: Tally, flag?: string) => (flag ? (t.f[flag] ?? 0) : t.n);

/** 시도 목록 + 건수 (전국 페이지의 지역 링크) */
export function sidoCounts(index: RegionIndex, flag?: string) {
  return SIDO.map((s) => ({ sido: s, count: countOf(tally(index, s.slug), flag) }));
}

/** 시군구 목록 + 건수 (시도 페이지의 지역 링크) */
export function guCounts(index: RegionIndex, sido: string, flag?: string) {
  return (SIGUNGU[sido] ?? []).map((g) => ({ gu: g, count: countOf(tally(index, sido, g.code), flag) }));
}

/** 시도 안에서 건수 순위 (1부터). 0곳이면 undefined */
export function guRank(index: RegionIndex, sido: string, gu: string, flag?: string) {
  const list = guCounts(index, sido, flag).sort((a, b) => b.count - a.count);
  const i = list.findIndex((x) => x.gu.code === gu);
  return i >= 0 && list[i].count > 0 ? { rank: i + 1, of: list.length } : undefined;
}
