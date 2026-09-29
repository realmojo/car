/**
 * 공공데이터를 받아 public/data/<dataset>/<shard>.json 으로 저장한다.
 *
 *   node scripts/sync-data.ts                # 전체
 *   node scripts/sync-data.ts parking rest   # 일부만
 *   node scripts/sync-data.ts --mock         # 가짜 데이터 (API 키 없이 화면 확인용)
 *   node scripts/sync-data.ts --soft         # 빌드용: 실패해도 종료 코드 0 (빌드를 멈추지 않는다)
 *
 * 데이터마다 아래 순서로 원본을 찾는다.
 *   1) data/raw/<dataset>.csv  (공공데이터포털에서 내려받은 CSV. UTF-8/EUC-KR 자동 인식)
 *   2) 환경변수 SYNC_URL_<DATASET> 또는 기본 API 주소
 * 열 이름은 기관·버전마다 달라서 영문 API 필드명과 한글 CSV 열 이름을 모두 후보로 둔다.
 */
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { SIDO } from "../lib/codes.ts";
import type { DatasetId, Row, Shard, SyncMeta } from "../lib/dataset-types.ts";
import { MAPPERS, findArray, type Raw } from "../lib/mappers.ts";
import { decode, parseCsv } from "../lib/csv.ts";
import { SHARDED } from "../lib/dataset-types.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "data");
const RAW_DIR = path.join(ROOT, "data", "raw");

/* ------------------------------------------------------------ 환경변수 */

async function loadEnvFile(file: string) {
  if (!existsSync(file)) return;
  for (const line of (await readFile(file, "utf8")).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m && !process.env[m[1]] && m[2]) process.env[m[1]] = m[2];
  }
}

/* ------------------------------------------------------------ 원본 읽기 */

const DEFAULT_URLS: Partial<Record<DatasetId, string>> = {
  parking: "https://api.data.go.kr/openapi/tn_pubr_prkplce_info_api",
  repair: "https://api.data.go.kr/openapi/tn_pubr_public_auto_maintenance_company_api",
  inspection: "https://api.data.go.kr/openapi/tn_pubr_public_car_inspofc_api",
  rest: "https://data.ex.co.kr/openapi/restinfo/hiwaySvarInfoList",
};

async function fetchApi(dataset: DatasetId): Promise<{ rows: Raw[]; source: string } | null> {
  const url = process.env[`SYNC_URL_${dataset.toUpperCase()}`] || DEFAULT_URLS[dataset];
  if (!url) return null;
  const host = new URL(url).host;
  const rows: Raw[] = [];
  const perPage = 1000;
  for (let page = 1; page <= 300; page++) {
    const u = new URL(url);
    if (host === "data.ex.co.kr") {
      const key = process.env.EX_API_KEY;
      if (!key) throw new Error("EX_API_KEY 가 없습니다.");
      u.searchParams.set("key", key);
      u.searchParams.set("type", "json");
      u.searchParams.set("numOfRows", "99");
      u.searchParams.set("pageNo", String(page));
    } else {
      const key = process.env.DATA_GO_KR_SERVICE_KEY;
      if (!key) throw new Error("DATA_GO_KR_SERVICE_KEY 가 없습니다.");
      if (host === "api.odcloud.kr") {
        u.searchParams.set("page", String(page));
        u.searchParams.set("perPage", String(perPage));
        u.searchParams.set("returnType", "JSON");
      } else {
        u.searchParams.set("pageNo", String(page));
        u.searchParams.set("numOfRows", String(perPage));
        u.searchParams.set("type", "json");
      }
      // 인코딩 키(%포함)는 그대로 붙인다
      u.search += `&serviceKey=${key.includes("%") ? key : encodeURIComponent(key)}`;
    }
    const res = await fetch(u, { signal: AbortSignal.timeout(30000) });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error(`${dataset}: JSON 이 아닌 응답 (${res.status}) ${text.slice(0, 200)}`);
    }
    const items = findArray(json);
    rows.push(...items);
    process.stdout.write(`\r  ${dataset}: ${rows.length.toLocaleString()}건`);
    const size = host === "data.ex.co.kr" ? 99 : perPage;
    if (items.length < size) break;
  }
  process.stdout.write("\n");
  return { rows, source: url };
}

async function readRaw(dataset: DatasetId): Promise<{ rows: Raw[]; source: string } | null> {
  const csv = path.join(RAW_DIR, `${dataset}.csv`);
  if (existsSync(csv)) {
    return { rows: parseCsv(decode(await readFile(csv))), source: `data/raw/${dataset}.csv` };
  }
  return fetchApi(dataset);
}

/* ------------------------------------------------------------ 가짜 데이터 */

function mockRaw(dataset: DatasetId): Raw[] {
  const areas = [
    ["서울특별시 강남구 테헤란로", "서울특별시 강남구 역삼동", 37.5, 127.03],
    ["서울특별시 마포구 월드컵로", "서울특별시 마포구 망원동", 37.556, 126.91],
    ["서울특별시 송파구 올림픽로", "서울특별시 송파구 잠실동", 37.514, 127.1],
    ["경기도 수원시 팔달구 효원로", "경기도 수원시 팔달구 인계동", 37.263, 127.028],
    ["경기도 성남시 분당구 판교역로", "경기도 성남시 분당구 백현동", 37.394, 127.111],
    ["부산광역시 해운대구 해운대로", "부산광역시 해운대구 우동", 35.163, 129.163],
  ] as const;
  const out: Raw[] = [];
  const n = dataset === "rest" ? 12 : dataset === "recall" || dataset === "efficiency" ? 60 : 36;
  for (let i = 0; i < n; i++) {
    const [road, jibun, lat, lng] = areas[i % areas.length];
    const addr = `${road} ${100 + i * 3}`;
    const pos = { 위도: String(lat + (i % 7) * 0.003), 경도: String(lng + (i % 5) * 0.004) };
    const tel = `02-${1000 + i}-${2000 + i}`;
    switch (dataset) {
      case "parking":
        out.push({
          주차장관리번호: `111-2-${i}`,
          주차장명: `${["공영", "노상", "제일", "중앙", "시민"][i % 5]}주차장 ${i + 1}`,
          주차장구분: i % 3 ? "공영" : "민영",
          주차장유형: ["노외", "노상", "부설"][i % 3],
          소재지도로명주소: addr,
          소재지지번주소: `${jibun} ${i + 10}`,
          주차구획수: String(20 + i * 7),
          운영요일: "평일+토요일+공휴일",
          평일운영시작시각: i % 4 ? "09:00" : "00:00",
          평일운영종료시각: i % 4 ? "21:00" : "23:59",
          토요일운영시작시각: "09:00",
          토요일운영종료시각: "18:00",
          요금정보: i % 4 === 0 ? "무료" : "유료",
          주차기본시간: "30",
          주차기본요금: i % 4 === 0 ? "0" : String(500 + (i % 3) * 500),
          추가단위시간: "10",
          추가단위요금: "300",
          월정기권요금: "100000",
          결제방법: "카드, 현금",
          관리기관명: "구시설관리공단",
          전화번호: tel,
          장애인전용주차구역보유여부: i % 2 ? "Y" : "N",
          데이터기준일자: "2026-08-31",
          ...pos,
        });
        break;
      case "repair":
        out.push({
          자동차정비업체명: `${["현대", "기아", "스피드", "오토", "카닥"][i % 5]}정비 ${i + 1}`,
          자동차정비업체종류: ["종합정비업", "소형정비업", "전문정비업", "원동기전문정비업"][i % 4],
          소재지도로명주소: addr,
          소재지지번주소: `${jibun} ${i + 10}`,
          영업상태: i === 5 ? "폐업" : "영업",
          운영시작시각: "0900",
          운영종료시각: "1900",
          전화번호: tel,
          관리기관명: "구청 교통행정과",
          데이터기준일자: "2026-08-31",
          ...pos,
        });
        break;
      case "inspection":
        out.push({
          자동차검사소명: i % 3 === 0 ? `한국교통안전공단 ${["강남", "수원", "부산"][i % 3]}검사소 ${i}` : `민간검사소 ${i + 1}`,
          자동차검사소구분: i % 3 === 0 ? "교통안전공단" : "지정정비사업자",
          소재지도로명주소: addr,
          검사소전화번호: tel,
          평일운영시작시각: "0900",
          평일운영종료시각: "1800",
          검사종류: "정기검사, 종합검사",
          데이터기준일자: "2026-08-31",
          ...pos,
        });
        break;
      case "hydrogen":
        out.push({
          충전소명: `${["H강남", "하이넷", "현대", "SK"][i % 4]} 수소충전소 ${i + 1}`,
          공급방식: ["튜브트레일러", "온사이트", "파이프라인"][i % 3],
          주소: addr,
          충전기수: String(1 + (i % 3)),
          충전가능차량: i % 4 === 0 ? "승용, 버스" : "승용",
          운영시간: "08:00~20:00",
          휴식일정: "매주 월요일",
          전화번호: tel,
          ...pos,
        });
        break;
      case "rest":
        out.push({
          휴게소명: `${["서울만남의광장", "기흥", "안성", "망향", "천안삼거리", "화서"][i % 6]}휴게소${i >= 6 ? "(부산방향)" : ""}`,
          노선명: ["경부선", "경부선", "경부선", "경부선", "천안논산선", "중부내륙선"][i % 6],
          방향: i < 6 ? "서울방향" : "부산방향",
          주소: addr,
          소형주차대수: String(200 + i * 10),
          대형주차대수: String(40 + i),
          전화번호: tel,
          ...pos,
        });
        break;
      case "recall":
        out.push({
          제작자: ["현대자동차", "기아", "한국지엠", "르노코리아", "BMW코리아"][i % 5],
          차명: ["아반떼", "쏘렌토", "트레일블레이저", "QM6", "520i", "아이오닉5"][i % 6],
          "생산기간(부터)": "2024-01-10",
          "생산기간(까지)": "2024-09-30",
          리콜개시일: `2026-${String((i % 9) + 1).padStart(2, "0")}-${String((i % 27) + 1).padStart(2, "0")}`,
          대상대수: String(100 + i * 37),
          리콜사유: "전자식 브레이크 제어장치 소프트웨어 오류로 경고등이 점등되지 않아 안전운행에 지장을 줄 가능성",
          시정방법: "무상 수리 (소프트웨어 업데이트)",
        });
        break;
      case "efficiency": {
        const fuels = ["휘발유", "경유", "하이브리드", "전기", "LPG", "수소"];
        const fuel = fuels[i % fuels.length];
        const ev = fuel === "전기";
        out.push({
          모델명: `${["아반떼", "쏘나타", "그랜저", "아이오닉6", "K5", "넥쏘"][i % 6]} ${2000 + i}`,
          업체명: ["현대자동차", "기아", "현대자동차", "현대자동차", "기아", "현대자동차"][i % 6],
          연료: fuel,
          차종: ["준중형", "중형", "대형", "중형", "중형", "SUV"][i % 6],
          복합연비: ev ? String(4.5 + (i % 10) / 5) : String(9 + (i % 12)),
          도심연비: ev ? String(5 + (i % 10) / 5) : String(8 + (i % 10)),
          고속도로연비: ev ? String(4.2 + (i % 10) / 5) : String(11 + (i % 10)),
          "1회충전주행거리": ev ? String(350 + i * 3) : "",
          등급: String(1 + (i % 5)),
          CO2: ev ? "0" : String(90 + i),
          출시연도: String(2022 + (i % 4)),
        });
        break;
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------ 저장 */

async function writeDataset(dataset: DatasetId, rows: Row[], source: string, syncedAt: string) {
  const dir = path.join(OUT, dataset);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  const groups = new Map<string, Row[]>();
  if (SHARDED[dataset]) {
    for (const row of rows) {
      if (!row.sido) continue;
      const list = groups.get(row.sido) ?? [];
      list.push(row);
      groups.set(row.sido, list);
    }
  } else {
    groups.set("all", rows);
  }
  for (const [shard, items] of groups) {
    // 같은 키가 겹치면 뒤의 것은 번호를 붙여 구분한다
    const seen = new Map<string, number>();
    for (const it of items) {
      const n = seen.get(it.key) ?? 0;
      seen.set(it.key, n + 1);
      if (n) it.key = `${it.key}${n.toString(36)}`;
    }
    const data: Shard = { dataset, shard, syncedAt, source, items };
    await writeFile(path.join(dir, `${shard}.json`), JSON.stringify(data));
  }
  const kept = [...groups.values()].reduce((a, b) => a + b.length, 0);
  console.log(`  ${dataset}: ${kept.toLocaleString()}건 저장 (${groups.size}개 파일)`);
  return kept;
}

async function main() {
  await loadEnvFile(path.join(ROOT, ".dev.vars"));
  await loadEnvFile(path.join(ROOT, ".env"));
  const args = process.argv.slice(2);
  const mock = args.includes("--mock");
  const soft = args.includes("--soft");
  const all = Object.keys(MAPPERS) as DatasetId[];
  const wanted = args.filter((a) => !a.startsWith("--")) as DatasetId[];
  const targets = wanted.length ? wanted.filter((d) => all.includes(d)) : all;
  const syncedAt = new Date().toISOString();

  const metaPath = path.join(OUT, "meta.json");
  const prev: SyncMeta = existsSync(metaPath)
    ? JSON.parse(await readFile(metaPath, "utf8"))
    : { syncedAt, mock, counts: {} };
  const meta: SyncMeta = { syncedAt, mock, counts: prev.mock === mock ? { ...prev.counts } : {} };

  await mkdir(OUT, { recursive: true });
  for (const dataset of targets) {
    try {
      const raw = mock ? { rows: mockRaw(dataset), source: "mock" } : await readRaw(dataset);
      if (!raw) {
        console.log(`  ${dataset}: 원본 없음 → data/raw/${dataset}.csv 를 넣거나 SYNC_URL_${dataset.toUpperCase()} 를 설정하세요`);
        continue;
      }
      const rows = raw.rows.map(MAPPERS[dataset]).filter((r): r is Row => r !== null);
      if (!rows.length) {
        const cols = Object.keys(raw.rows[0] ?? {}).join(", ");
        console.log(`  ${dataset}: 변환된 행이 없습니다. 열 이름을 확인하세요 → ${cols}`);
        continue;
      }
      meta.counts[dataset] = await writeDataset(dataset, rows, raw.source, syncedAt);
    } catch (e) {
      console.error(`  ${dataset}: 실패 - ${e instanceof Error ? e.message : e}`);
      if (!soft) process.exitCode = 1;
    }
  }
  await writeFile(metaPath, JSON.stringify(meta, null, 2));
  const files = (await readdir(OUT)).filter((f) => f !== "meta.json");
  console.log(`완료: ${files.join(", ")} (${SIDO.length}개 시도 기준)`);
}

main();
