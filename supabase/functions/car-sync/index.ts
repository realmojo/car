/**
 * 차곳간 공공데이터 → Supabase(car_parking / car_repair / car_inspection) 적재.
 *
 * POST { action: "sync", dataset, page?, url? }   한 페이지(1,000건)를 받아 upsert
 * POST { action: "probe", dataset }               공공데이터포털 상세 페이지에서 요청 주소를 찾는다
 * 헤더 x-sync-token 이 Vault 의 car_sync_token 과 같아야 한다.
 *
 * 인증키는 Vault(car_data_go_kr_key)에 있고 service_role 전용 함수 car_sync_config() 로 읽는다.
 * DB 에서 pg_net 으로 페이지별로 호출한다 (README 참고).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { MAPPERS, findArray } from "../../../lib/mappers.ts";
import type { Row } from "../../../lib/dataset-types.ts";

type Dataset = "parking" | "repair" | "inspection";

const TABLES: Record<Dataset, string> = {
  parking: "car_parking",
  repair: "car_repair",
  inspection: "car_inspection",
};

/** 공공데이터포털 표준데이터 상세 페이지 (요청 주소를 찾을 때 쓴다) */
const PORTAL_PAGES: Record<Dataset, string> = {
  parking: "https://www.data.go.kr/data/15012896/standard.do",
  repair: "https://www.data.go.kr/data/15028204/standard.do",
  inspection: "https://www.data.go.kr/data/15021107/standard.do",
};

const DEFAULT_URLS: Record<Dataset, string> = {
  parking: "https://api.data.go.kr/openapi/tn_pubr_prkplce_info_api",
  repair: "https://api.data.go.kr/openapi/tn_pubr_public_auto_maintenance_company_api",
  inspection: "https://api.data.go.kr/openapi/tn_pubr_public_car_inspofc_api",
};

const PER_PAGE = 1000;

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

let config: { data_go_kr_key: string; sync_token: string } | null = null;
async function loadConfig() {
  if (config) return config;
  const { data, error } = await supabase.rpc("car_sync_config");
  if (error) throw new Error(`설정을 읽지 못했습니다: ${error.message}`);
  config = (Array.isArray(data) ? data[0] : data) as typeof config;
  return config!;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function fetchPage(url: string, key: string, page: number) {
  const u = `${url}?serviceKey=${key.includes("%") ? key : encodeURIComponent(key)}&pageNo=${page}&numOfRows=${PER_PAGE}&type=json`;
  const res = await fetch(u, { signal: AbortSignal.timeout(60000) });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`JSON 이 아닌 응답 (${res.status}): ${text.slice(0, 200)}`);
  }
  // 인증 실패(미등록 키, 활용신청 안 됨 등)는 OpenAPI_ServiceResponse 로 온다
  const auth = (body as { OpenAPI_ServiceResponse?: { cmmMsgHeader?: { errMsg?: string; returnAuthMsg?: string } } })
    .OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (auth || !res.ok) {
    throw new Error(`인증 오류 (${res.status}): ${auth?.returnAuthMsg ?? auth?.errMsg ?? text.slice(0, 200)}`);
  }
  const header = (body as { response?: { header?: { resultCode?: string; resultMsg?: string } } }).response?.header;
  if (header?.resultCode && header.resultCode !== "00") {
    // 03 = 데이터 없음 (마지막 페이지 다음)
    if (header.resultCode === "03") return { rows: [], total: 0 };
    throw new Error(`API 오류 ${header.resultCode}: ${header.resultMsg}`);
  }
  const total = Number((body as { response?: { body?: { totalCount?: string | number } } }).response?.body?.totalCount ?? 0);
  return { rows: findArray(body), total };
}

async function sync(dataset: Dataset, page: number, url: string, key: string) {
  const { rows, total } = await fetchPage(url, key, page);
  const mapped = new Map<string, Row>();
  for (const raw of rows) {
    const row = MAPPERS[dataset](raw);
    if (row && row.sido) mapped.set(row.key, row);
  }
  const records = [...mapped.values()].map((r) => ({
    key: r.key,
    sido: r.sido ?? null,
    gu: r.gu ?? null,
    name: r.name,
    sub: r.sub ?? null,
    address: r.address ?? null,
    lat: r.lat ?? null,
    lng: r.lng ?? null,
    tel: r.tel || null,
    tags: r.tags,
    flags: r.flags,
    info: r.info,
    num: r.num ?? null,
    synced_at: new Date().toISOString(),
  }));
  if (records.length) {
    const { error } = await supabase.from(TABLES[dataset]).upsert(records, { onConflict: "key" });
    if (error) throw new Error(`저장 실패: ${error.message}`);
  }
  const result = {
    dataset,
    page,
    fetched: rows.length,
    saved: records.length,
    total,
    pages: Math.ceil(total / PER_PAGE),
    sampleFields: rows[0] ? Object.keys(rows[0]) : [],
  };
  await supabase.from("car_sync_log").insert({ dataset, page, fetched: rows.length, saved: records.length, total });
  return result;
}

async function probe(dataset: Dataset) {
  const res = await fetch(PORTAL_PAGES[dataset], { signal: AbortSignal.timeout(30000) });
  const html = await res.text();
  const urls = [...new Set(html.match(/https?:\/\/api\.data\.go\.kr\/openapi\/[a-z0-9_]+/gi) ?? [])];
  return { dataset, status: res.status, urls };
}

Deno.serve(async (req) => {
  let dataset: string | undefined;
  let page: number | undefined;
  try {
    const cfg = await loadConfig();
    if (req.headers.get("x-sync-token") !== cfg.sync_token) return json({ error: "unauthorized" }, 401);
    const body = (await req.json().catch(() => ({}))) as { action?: string; dataset?: Dataset; page?: number; url?: string };
    dataset = body.dataset;
    page = Math.max(1, Number(body.page) || 1);
    if (!body.dataset || !(body.dataset in TABLES)) return json({ error: "dataset 은 parking | repair | inspection" }, 400);

    if (body.action === "probe") return json(await probe(body.dataset));

    const url = body.url || DEFAULT_URLS[body.dataset];
    return json(await sync(body.dataset, page, url, cfg.data_go_kr_key));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("car_sync_log").insert({ dataset: dataset ?? "unknown", page: page ?? null, error: message }).then(() => {}, () => {});
    return json({ error: message }, 500);
  }
});
