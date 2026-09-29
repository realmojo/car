/**
 * 차곳간 공공데이터 → Supabase car_* 테이블 적재.
 *
 * POST { action: "sync", dataset, page? }
 *   - parking / repair / inspection : 공공데이터포털 표준데이터 "전체 다운로드"와 같은 JSON 을 한 페이지(10,000건)씩 upsert.
 *                                     인증키·활용신청이 필요 없다.
 *   - rest                          : 한국도로공사 휴게시설 API 전체
 *   - hydrogen / recall / efficiency: 공공데이터포털 파일 다운로드(CSV) 전체, 사라진 행은 삭제
 * 헤더 x-sync-token 이 Vault 의 car_sync_token 과 같아야 한다.
 *
 * 도로공사 인증키는 Vault(car_ex_key)에 있고 service_role 전용 함수 car_sync_config() 로 읽는다.
 * DB 에서 pg_net 으로 페이지별로 호출한다 (README 참고).
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { MAPPERS, findArray, type Raw } from "../../../lib/mappers.ts";
import { decode, parseCsv } from "../../../lib/csv.ts";
import type { Row } from "../../../lib/dataset-types.ts";

type PagedDataset = "parking" | "repair" | "inspection";
type FileDataset = "hydrogen" | "recall" | "efficiency";
type Dataset = PagedDataset | FileDataset | "rest";

const TABLES: Record<Dataset, string> = {
  parking: "car_parking",
  repair: "car_repair",
  inspection: "car_inspection",
  rest: "car_rest",
  hydrogen: "car_hydrogen",
  recall: "car_recall",
  efficiency: "car_efficiency",
};

/** 파일데이터 상세 페이지. 파일이 갱신되면 첨부 id 가 바뀌므로 매번 페이지에서 찾는다 */
const FILE_PAGES: Record<FileDataset, string> = {
  hydrogen: "https://www.data.go.kr/data/15066838/fileData.do",
  recall: "https://www.data.go.kr/data/3048950/fileData.do",
  efficiency: "https://www.data.go.kr/data/15083023/fileData.do",
};

const REST_URL = "https://data.ex.co.kr/openapi/restinfo/hiwaySvarInfoList";

/** 공공데이터포털 표준데이터 번호. 상세 페이지의 다운로드 버튼이 쓰는 JSON 을 그대로 부른다 */
const STANDARD_PK: Record<PagedDataset, string> = {
  parking: "15012896",
  repair: "15028204",
  inspection: "15021107",
};

const PER_PAGE = 10000;

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

let config: { sync_token: string; ex_key: string } | null = null;
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

interface StandardHeader {
  totalCount: number;
  tableVO: { svcTableNm: string; colNmList: string[] };
  columList: Array<{ columNm: string; columCode: string }>;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000), headers: { accept: "application/json" } });
  const text = await res.text();
  if (!res.ok) throw new Error(`공공데이터포털 응답 오류 (${res.status}): ${text.replace(/\s+/g, " ").slice(0, 200)}`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`JSON 이 아닌 응답: ${text.replace(/\s+/g, " ").slice(0, 200)}`);
  }
}

/** 한 페이지를 받아 열 코드(RDNMADR 등)를 한글 열 이름(소재지도로명주소 등)으로 바꾼다. 매퍼는 한글 이름을 읽는다 */
async function fetchPage(dataset: PagedDataset, page: number) {
  const pk = STANDARD_PK[dataset];
  const header = await getJson<StandardHeader>(`https://www.data.go.kr/download/columList.json?pk=${pk}&ext=CSV`);
  const q = new URLSearchParams({
    publicDataPk: pk,
    svcTableNm: header.tableVO.svcTableNm,
    totalCount: String(header.totalCount),
    perPage: String(PER_PAGE),
    page: String(page),
  });
  for (const c of header.tableVO.colNmList) q.append("colNmList", c);
  const items = await getJson<Raw[]>(`https://www.data.go.kr/download/standard.json?${q}`);
  const names = new Map(header.columList.map((c) => [c.columCode, c.columNm]));
  const rows = items.map((item) => Object.fromEntries(Object.entries(item).map(([k, v]) => [names.get(k) ?? k, v])));
  return { rows, total: Number(header.totalCount) || 0 };
}

function toRecords(dataset: Dataset, rows: Raw[]) {
  const mapped = new Map<string, Row>();
  for (const raw of rows) {
    const row = MAPPERS[dataset](raw);
    if (!row) continue;
    // 위치형 데이터는 시도를 알아야 목록에 나온다 (리콜·연비·휴게소는 지역과 무관)
    if (["parking", "repair", "inspection", "hydrogen"].includes(dataset) && !row.sido) continue;
    mapped.set(row.key, row);
  }
  const now = new Date().toISOString();
  return [...mapped.values()].map((r) => ({
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
    synced_at: now,
  }));
}

async function upsert(dataset: Dataset, records: ReturnType<typeof toRecords>) {
  for (let i = 0; i < records.length; i += 500) {
    const { error } = await supabase.from(TABLES[dataset]).upsert(records.slice(i, i + 500), { onConflict: "key" });
    if (error) throw new Error(`저장 실패: ${error.message}`);
  }
}

async function log(dataset: Dataset, page: number | null, fetched: number, saved: number, total: number) {
  await supabase.from("car_sync_log").insert({ dataset, page, fetched, saved, total });
}

async function syncPaged(dataset: PagedDataset, page: number) {
  const { rows, total } = await fetchPage(dataset, page);
  const records = toRecords(dataset, rows);
  await upsert(dataset, records);
  await log(dataset, page, rows.length, records.length, total);
  return {
    dataset,
    page,
    fetched: rows.length,
    saved: records.length,
    total,
    pages: Math.ceil(total / PER_PAGE),
    sampleFields: rows[0] ? Object.keys(rows[0]) : [],
  };
}

/** 전체 교체: 이번에 받은 행을 upsert 하고, 받지 못한 옛 행은 지운다 */
async function replaceAll(dataset: Dataset, rows: Raw[], source: string) {
  const started = new Date(Date.now() - 1000).toISOString();
  const records = toRecords(dataset, rows);
  if (!records.length) throw new Error(`${dataset}: 변환된 행이 없습니다. 열 이름: ${Object.keys(rows[0] ?? {}).join(", ")}`);
  await upsert(dataset, records);
  const { error } = await supabase.from(TABLES[dataset]).delete().lt("synced_at", started);
  if (error) throw new Error(`정리 실패: ${error.message}`);
  await log(dataset, null, rows.length, records.length, records.length);
  return { dataset, source, fetched: rows.length, saved: records.length, sampleFields: rows[0] ? Object.keys(rows[0]) : [] };
}

async function syncRest(exKey: string) {
  if (!exKey) throw new Error("도로공사 인증키(car_ex_key)가 없습니다.");
  // 이 API 는 페이지 번호를 무시하고 전체를 한 번에 준다
  const res = await fetch(`${REST_URL}?key=${encodeURIComponent(exKey)}&type=json&numOfRows=9999&pageNo=1`, {
    signal: AbortSignal.timeout(60000),
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`휴게소 API 응답 오류 (${res.status}): ${text.slice(0, 200)}`);
  }
  return replaceAll("rest", findArray(body), REST_URL);
}

async function syncFile(dataset: FileDataset) {
  const page = await fetch(FILE_PAGES[dataset], { signal: AbortSignal.timeout(30000) });
  const html = await page.text();
  const link = html.match(/fileDownload\.do\?atchFileId=(FILE_\d+)&(?:amp;)?fileDetailSn=(\d+)/);
  if (!link) throw new Error(`${dataset}: 다운로드 링크를 찾지 못했습니다.`);
  const url = `https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=${link[1]}&fileDetailSn=${link[2]}&insertDataPrcus=N`;
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`${dataset}: 파일 다운로드 실패 (${res.status})`);
  const rows = parseCsv(decode(new Uint8Array(await res.arrayBuffer())));
  return replaceAll(dataset, rows, url);
}

Deno.serve(async (req) => {
  let dataset: string | undefined;
  let page: number | undefined;
  try {
    const cfg = await loadConfig();
    if (req.headers.get("x-sync-token") !== cfg.sync_token) return json({ error: "unauthorized" }, 401);
    const body = (await req.json().catch(() => ({}))) as { action?: string; dataset?: Dataset; page?: number };
    dataset = body.dataset;
    page = Math.max(1, Number(body.page) || 1);
    const ds = body.dataset;
    if (!ds || !(ds in TABLES)) return json({ error: `dataset 은 ${Object.keys(TABLES).join(" | ")}` }, 400);

    if (ds === "rest") return json(await syncRest(cfg.ex_key));
    if (ds === "hydrogen" || ds === "recall" || ds === "efficiency") return json(await syncFile(ds));

    return json(await syncPaged(ds, page));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await supabase.from("car_sync_log").insert({ dataset: dataset ?? "unknown", page: page ?? null, error: message }).then(() => {}, () => {});
    return json({ error: message }, 500);
  }
});
