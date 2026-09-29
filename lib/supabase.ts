/**
 * Supabase(pflow-kr) car_* 테이블을 PostgREST 로 읽는 공통 코드.
 * 테이블은 공개 읽기 전용(RLS)이라 공개용 publishable 키만 쓴다.
 */
import { cached } from "./cache";
import type { DatasetId, Row } from "./dataset-types";

export const SUPABASE_URL = process.env.SUPABASE_URL || "https://mbxdcxlxugsnmljzdlkp.supabase.co";
export const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_LZDtNaj2bmIffIOsqA6x7g_HNPhAjFQ";
export const COLUMNS = "key,sido,gu,name,sub,address,lat,lng,tel,tags,flags,info,num";

export const TABLES: Record<DatasetId, string> = {
  parking: "car_parking",
  repair: "car_repair",
  inspection: "car_inspection",
  rest: "car_rest",
  hydrogen: "car_hydrogen",
  recall: "car_recall",
  efficiency: "car_efficiency",
};

export const isMock = () => process.env.MOCK_DATA === "1";

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

export function toRow(r: DbRow): Row {
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

/** PostgREST 조회 (캐시). withCount 면 content-range 의 전체 건수도 돌려준다 */
export async function sbSelect(table: string, params: URLSearchParams, ttl: number, withCount = false) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`;
  return cached(`sb:${url}`, ttl, async () => {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
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

/** 테이블 전체 (수천 건 이하인 휴게소·수소·리콜·연비용). PostgREST 는 한 번에 1,000건까지 준다 */
export async function sbAll(dataset: DatasetId, ttl = 3600): Promise<Row[]> {
  const out: Row[] = [];
  for (let offset = 0; ; offset += 1000) {
    const p = new URLSearchParams({ select: COLUMNS, order: "key.asc", offset: String(offset), limit: "1000" });
    const { rows } = await sbSelect(TABLES[dataset], p, ttl);
    out.push(...rows);
    if (rows.length < 1000) return out;
  }
}
