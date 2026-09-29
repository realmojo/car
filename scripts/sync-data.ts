/**
 * 공공데이터를 받아 public/data/<dataset>/<shard>.json 으로 저장한다.
 *
 *   node scripts/sync-data.ts                # 전체
 *   node scripts/sync-data.ts parking rest   # 일부만
 *   node scripts/sync-data.ts --mock         # 가짜 데이터 (API 키 없이 화면 확인용)
 *
 * 데이터마다 아래 순서로 원본을 찾는다.
 *   1) data/raw/<dataset>.csv  (공공데이터포털에서 내려받은 CSV. UTF-8/EUC-KR 자동 인식)
 *   2) 환경변수 SYNC_URL_<DATASET> 또는 기본 API 주소
 * 열 이름은 기관·버전마다 달라서 영문 API 필드명과 한글 CSV 열 이름을 모두 후보로 둔다.
 */
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { SIDO, findSidoByAddress, findSigunguByAddress } from "../lib/codes.ts";
import type { DatasetId, Row, Shard, SyncMeta } from "../lib/dataset-types.ts";
import { SHARDED } from "../lib/dataset-types.ts";

type Raw = Record<string, unknown>;

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

/* ------------------------------------------------------------ 공통 도구 */

function pick(row: Raw, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "null") {
      return String(v).trim();
    }
  }
  return "";
}

function num(v: string): number | undefined {
  const n = Number(v.replace(/[,\s]/g, ""));
  return v && Number.isFinite(n) ? n : undefined;
}

/** 위도·경도가 한반도 범위일 때만 쓴다 */
function coords(row: Raw, latKeys: string[], lngKeys: string[]) {
  const lat = num(pick(row, latKeys));
  const lng = num(pick(row, lngKeys));
  if (lat && lng && lat > 32 && lat < 39.5 && lng > 124 && lng < 132) return { lat, lng };
  return {};
}

/** "0900" / "09:00" → "09:00" */
function hhmm(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length === 3 || d.length === 4) return `${d.padStart(4, "0").slice(0, 2)}:${d.padStart(4, "0").slice(2)}`;
  return v;
}

function range(a: string, b: string) {
  if (!a && !b) return "";
  if (hhmm(a) === "00:00" && (hhmm(b) === "23:59" || hhmm(b) === "24:00")) return "24시간";
  return `${hhmm(a)} ~ ${hhmm(b)}`;
}

function won(v: string) {
  const n = num(v);
  return n === undefined ? v : `${n.toLocaleString("ko-KR")}원`;
}

function fnv(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function info(pairs: Array<[string, string | undefined]>): Array<[string, string]> {
  return pairs.filter((p): p is [string, string] => Boolean(p[1]));
}

function locate(address: string) {
  const sido = findSidoByAddress(address);
  const gu = sido ? findSigunguByAddress(sido, address) : undefined;
  return { sido: sido?.slug, gu: gu?.code };
}

/* ------------------------------------------------------------ 매퍼 */

const ADDR = ["rdnmadr", "소재지도로명주소", "도로명주소", "주소", "소재지", "svarAddr"];
const JIBUN = ["lnmadr", "소재지지번주소", "지번주소"];
const LAT = ["latitude", "위도", "lat", "yValue"];
const LNG = ["longitude", "경도", "lng", "lon", "xValue"];
const TEL = ["phoneNumber", "전화번호", "대표전화", "연락처", "rprsTelNo"];

type Mapper = (row: Raw) => Row | null;

const MAPPERS: Record<DatasetId, Mapper> = {
  parking(r) {
    const name = pick(r, ["prkplceNm", "주차장명"]);
    const address = pick(r, ADDR) || pick(r, JIBUN);
    if (!name || !address) return null;
    const se = pick(r, ["prkplceSe", "주차장구분"]);
    const type = pick(r, ["prkplceType", "주차장유형"]);
    const fee = pick(r, ["parkingchrgeInfo", "요금정보"]);
    const cap = pick(r, ["prkcmprt", "주차구획수"]);
    const basic = [pick(r, ["basicTime", "주차기본시간"]), pick(r, ["basicCharge", "주차기본요금"])];
    const add = [pick(r, ["addUnitTime", "추가단위시간"]), pick(r, ["addUnitCharge", "추가단위요금"])];
    const flags: string[] = [];
    if (se.includes("공영")) flags.push("public");
    if (fee.includes("무료")) flags.push("free");
    if (pick(r, ["pwdbsPpkZoneYn", "장애인전용주차구역보유여부"]) === "Y") flags.push("disabled");
    const weekday = range(
      pick(r, ["weekdayOperOpenHhmm", "평일운영시작시각"]),
      pick(r, ["weekdayOperColseHhmm", "weekdayOperCloseHhmm", "평일운영종료시각"]),
    );
    return {
      key: fnv(pick(r, ["prkplceNo", "주차장관리번호"]) || name + address),
      name,
      sub: [se, type].filter(Boolean).join(" · "),
      address,
      tel: pick(r, TEL),
      ...coords(r, LAT, LNG),
      ...locate(address),
      tags: [fee, cap && `${cap}면`, weekday === "24시간" ? "24시간" : ""].filter(Boolean),
      flags,
      num: cap ? { capacity: Number(cap) || 0 } : undefined,
      info: info([
        ["구분", [se, type].filter(Boolean).join(" · ")],
        ["도로명 주소", address],
        ["지번 주소", pick(r, JIBUN)],
        ["주차면", cap && `${cap}면`],
        ["요금", fee],
        ["기본 요금", basic[1] && num(basic[1]) === 0 ? "무료" : basic[0] && basic[1] ? `${basic[0]}분 ${won(basic[1])}` : ""],
        ["추가 요금", add[0] && add[1] ? `${add[0]}분마다 ${won(add[1])}` : ""],
        ["1일 주차권", pick(r, ["dayCmmtkt", "1일주차권요금"]) && won(pick(r, ["dayCmmtkt", "1일주차권요금"]))],
        ["월 정기권", pick(r, ["monthCmmtkt", "월정기권요금"]) && won(pick(r, ["monthCmmtkt", "월정기권요금"]))],
        ["운영 요일", pick(r, ["operDay", "운영요일"])],
        ["평일", weekday],
        ["토요일", range(pick(r, ["satOperOperOpenHhmm", "satOperOpenHhmm", "토요일운영시작시각"]), pick(r, ["satOperCloseHhmm", "토요일운영종료시각"]))],
        ["공휴일", range(pick(r, ["holidayOperOpenHhmm", "공휴일운영시작시각"]), pick(r, ["holidayCloseOpenHhmm", "holidayOperCloseHhmm", "공휴일운영종료시각"]))],
        ["결제 방법", pick(r, ["metpay", "결제방법"])],
        ["특기사항", pick(r, ["spcmnt", "특기사항"])],
        ["관리기관", pick(r, ["institutionNm", "관리기관명"])],
        ["전화", pick(r, TEL)],
        ["기준일", pick(r, ["referenceDate", "데이터기준일자"])],
      ]),
    };
  },

  repair(r) {
    const name = pick(r, ["자동차정비업체명", "정비업체명", "업체명", "사업장명", "mntnceEntrpsNm", "bplcNm", "entrpsNm"]);
    const address = pick(r, ADDR) || pick(r, JIBUN);
    if (!name || !address) return null;
    const status = pick(r, ["영업상태", "영업상태명", "bsnSttus"]);
    if (/폐업|취소|말소/.test(status)) return null;
    const kind = pick(r, ["자동차정비업체종류", "정비업체종류", "업종", "업태", "mntnceEntrpsSe"]);
    const flags: string[] = [];
    if (kind.includes("종합")) flags.push("general");
    if (kind.includes("소형")) flags.push("small");
    if (kind.includes("부분") || kind.includes("전문")) flags.push("partial");
    if (kind.includes("원동기")) flags.push("motor");
    const hours = range(pick(r, ["운영시작시각", "operOpenHm"]), pick(r, ["운영종료시각", "operCloseHm"]));
    return {
      key: fnv(name + address),
      name,
      sub: kind,
      address,
      tel: pick(r, TEL),
      ...coords(r, LAT, LNG),
      ...locate(address),
      tags: [kind, status && status !== "영업" && status !== "정상" ? status : ""].filter(Boolean),
      flags,
      info: info([
        ["업체 종류", kind],
        ["도로명 주소", address],
        ["지번 주소", pick(r, JIBUN)],
        ["영업 상태", status],
        ["운영 시간", hours],
        ["전화", pick(r, TEL)],
        ["사업 등록일", pick(r, ["사업등록일자", "등록일자"])],
        ["관리기관", pick(r, ["관리기관명", "institutionNm"])],
        ["기준일", pick(r, ["데이터기준일자", "referenceDate"])],
      ]),
    };
  },

  inspection(r) {
    const name = pick(r, ["자동차검사소명", "검사소명", "inspofcNm"]);
    const address = pick(r, ADDR) || pick(r, JIBUN);
    if (!name || !address) return null;
    const kind = pick(r, ["자동차검사소구분", "검사소구분", "검사소유형", "지정구분", "inspofcSe"]);
    const tel = pick(r, ["검사소전화번호", ...TEL]);
    const hours =
      pick(r, ["운영시간", "평일운영시간"]) ||
      range(pick(r, ["평일운영시작시각", "운영시작시각"]), pick(r, ["평일운영종료시각", "운영종료시각"]));
    const flags: string[] = [];
    if (kind.includes("공단") || name.includes("교통안전공단")) flags.push("ts");
    else flags.push("private");
    return {
      key: fnv(name + address),
      name,
      sub: kind,
      address,
      tel,
      ...coords(r, LAT, LNG),
      ...locate(address),
      tags: [kind, flags.includes("ts") ? "공단 직영" : "민간 지정"].filter((t, i, a) => t && a.indexOf(t) === i),
      flags,
      info: info([
        ["구분", kind],
        ["도로명 주소", address],
        ["지번 주소", pick(r, JIBUN)],
        ["운영 시간", hours],
        ["검사 종류", pick(r, ["검사종류", "검사가능종류", "검사업무"])],
        ["검사 차종", pick(r, ["검사가능차종", "검사차종"])],
        ["전화", tel],
        ["관리기관", pick(r, ["관리기관명", "institutionNm"])],
        ["기준일", pick(r, ["데이터기준일자", "referenceDate"])],
      ]),
    };
  },

  hydrogen(r) {
    const name = pick(r, ["충전소명", "충전소", "stationNm"]);
    const address = [pick(r, ["주소", "소재지", "도로명주소", "소재지도로명주소"]), pick(r, ["상세주소"])]
      .filter(Boolean)
      .join(" ");
    if (!name || !address) return null;
    const supply = pick(r, ["공급방식", "충전방식"]);
    const chargers = pick(r, ["충전기수", "충전기 수", "충전기대수"]);
    const vehicles = pick(r, ["충전가능차량", "충전가능차종", "충전가능차량코드"]);
    const flags: string[] = [];
    if (/버스|대형|상용/.test(vehicles)) flags.push("bus");
    return {
      key: fnv(name + address),
      name,
      sub: supply,
      address,
      tel: pick(r, TEL),
      ...coords(r, LAT, LNG),
      ...locate(address),
      tags: [supply, chargers && `충전기 ${chargers}기`, vehicles].filter(Boolean),
      flags,
      info: info([
        ["공급 방식", supply],
        ["주소", address],
        ["충전기", chargers && `${chargers}기`],
        ["충전 가능 차량", vehicles],
        ["운영 요일", pick(r, ["이용가능요일", "운영요일"])],
        ["운영 시간", pick(r, ["운영시간", "이용시간"])],
        ["휴무", pick(r, ["휴식일정", "휴무일", "휴무"])],
        ["전화", pick(r, TEL)],
        ["운영사", pick(r, ["운영사", "운영기관", "사업자"])],
        ["기준일", pick(r, ["데이터기준일자", "기준일자"])],
      ]),
    };
  },

  rest(r) {
    const name = pick(r, ["svarNm", "휴게소명", "시설명"]);
    if (!name) return null;
    const route = pick(r, ["routeNm", "노선명"]);
    const dir = pick(r, ["gudClssNm", "방향", "상하행구분", "방향구분"]);
    const address = pick(r, ADDR);
    const small = pick(r, ["cocrPrkgTrcn", "소형주차대수", "소형차주차면수"]);
    const large = pick(r, ["fscarPrkgTrcn", "대형주차대수", "대형차주차면수"]);
    const kind = pick(r, ["svarGbNm", "휴게시설구분", "시설구분"]) || (name.includes("졸음쉼터") ? "졸음쉼터" : "휴게소");
    return {
      key: fnv(pick(r, ["svarCd", "휴게소코드"]) || name + route + dir),
      name,
      sub: [route, dir].filter(Boolean).join(" · "),
      address,
      tel: pick(r, TEL),
      ...coords(r, LAT, LNG),
      ...(address ? locate(address) : {}),
      tags: [kind, route, dir].filter(Boolean),
      flags: kind.includes("졸음") ? ["drowsy"] : ["rest"],
      info: info([
        ["구분", kind],
        ["노선", route],
        ["방향", dir],
        ["주소", address],
        ["소형차 주차", small && `${small}면`],
        ["대형차 주차", large && `${large}면`],
        ["장애인 주차", pick(r, ["dspnPrkgTrcn", "장애인주차대수"]) && `${pick(r, ["dspnPrkgTrcn", "장애인주차대수"])}면`],
        ["편의시설", pick(r, ["편의시설", "convenience", "부대시설"])],
        ["전화", pick(r, TEL)],
      ]),
    };
  },

  recall(r) {
    const car = pick(r, ["차명", "차종", "모델명", "carNm"]);
    const maker = pick(r, ["제작자", "제조사", "제작사", "제작사명", "mkrNm"]);
    if (!car) return null;
    const from = pick(r, ["생산기간(부터)", "생산시작일", "생산기간시작"]);
    const to = pick(r, ["생산기간(까지)", "생산종료일", "생산기간종료"]);
    const period = pick(r, ["생산기간"]) || [from, to].filter(Boolean).join(" ~ ");
    const start = pick(r, ["리콜개시일", "시정개시일", "리콜시작일", "리콜개시일자"]);
    const reason = pick(r, ["리콜사유", "결함내용", "리콜내용", "리콜사유및내용"]);
    return {
      key: fnv(maker + car + period + start + reason.slice(0, 40)),
      name: car,
      sub: maker,
      tags: [maker, start && `${start} 개시`].filter(Boolean),
      flags: [],
      num: { date: Number(start.replace(/\D/g, "").slice(0, 8)) || 0 },
      info: info([
        ["제작사", maker],
        ["차명", car],
        ["생산 기간", period],
        ["리콜 개시일", start],
        ["대상 대수", pick(r, ["대상대수", "리콜대수", "대상차량대수"])],
        ["리콜 사유", reason],
        ["시정 방법", pick(r, ["시정방법", "조치방법"])],
      ]),
    };
  },

  efficiency(r) {
    const name = pick(r, ["모델명", "차명", "모델"]);
    if (!name) return null;
    const maker = pick(r, ["업체명", "제조사", "제작사", "제조업체"]);
    const fuel = pick(r, ["연료", "유종", "사용연료", "연료종류"]);
    const type = pick(r, ["차종", "차급", "차량구분"]);
    const combined = num(pick(r, ["복합연비", "복합", "복합에너지소비효율"]));
    const city = num(pick(r, ["도심연비", "도심"]));
    const highway = num(pick(r, ["고속도로연비", "고속도로", "고속"]));
    const rangeKm = num(pick(r, ["1회충전주행거리", "1회충전 주행거리", "주행거리"]));
    const grade = num(pick(r, ["등급", "연비등급", "에너지소비효율등급"]));
    const ev = /전기/.test(fuel) && !/하이브리드/.test(fuel);
    const unit = ev ? "km/kWh" : /수소/.test(fuel) ? "km/kg" : "km/L";
    const flags: string[] = [];
    if (ev) flags.push("ev");
    else if (/하이브리드/.test(fuel)) flags.push("hybrid");
    else if (/수소/.test(fuel)) flags.push("h2");
    else flags.push("ice");
    return {
      key: fnv(maker + name + fuel + pick(r, ["배기량", "출시연도", "연식"]) + (combined ?? "")),
      name,
      sub: maker,
      tags: [fuel, type, grade ? `${grade}등급` : ""].filter(Boolean),
      flags,
      num: {
        ...(combined ? { combined } : {}),
        ...(rangeKm ? { range: rangeKm } : {}),
        ...(grade ? { grade } : {}),
      },
      info: info([
        ["제조사", maker],
        ["연료", fuel],
        ["차종", type],
        ["복합 연비", combined ? `${combined} ${unit}` : ""],
        ["도심 연비", city ? `${city} ${unit}` : ""],
        ["고속도로 연비", highway ? `${highway} ${unit}` : ""],
        ["1회 충전 주행거리", rangeKm ? `${rangeKm} km` : ""],
        ["에너지소비효율 등급", grade ? `${grade}등급` : ""],
        ["CO2 배출량", pick(r, ["CO2", "CO2배출량", "이산화탄소배출량"]) && `${pick(r, ["CO2", "CO2배출량", "이산화탄소배출량"])} g/km`],
        ["배기량", pick(r, ["배기량"]) && `${pick(r, ["배기량"])} cc`],
        ["변속기", pick(r, ["변속기", "변속형식"])],
        ["출시 연도", pick(r, ["출시연도", "연식"])],
      ]),
    };
  },
};

/* ------------------------------------------------------------ 원본 읽기 */

function decode(buf: Buffer) {
  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return buf.subarray(3).toString("utf8");
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    // 공공데이터포털 CSV 는 EUC-KR(CP949) 인 경우가 많다
    return new TextDecoder("euc-kr").decode(buf);
  }
}

export function parseCsv(text: string): Raw[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim()));
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])));
}

/** 응답 JSON 에서 객체 배열을 찾는다 (body.items / items.item / data / list …) */
function findArray(json: unknown): Raw[] {
  if (Array.isArray(json)) return json as Raw[];
  if (json && typeof json === "object") {
    for (const key of ["items", "item", "data", "list", "body", "response", "row"]) {
      const v = (json as Raw)[key];
      if (v !== undefined) {
        const found = findArray(v);
        if (found.length) return found;
      }
    }
  }
  return [];
}

const DEFAULT_URLS: Partial<Record<DatasetId, string>> = {
  parking: "https://api.data.go.kr/openapi/tn_pubr_prkplce_info_api",
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
      process.exitCode = 1;
    }
  }
  await writeFile(metaPath, JSON.stringify(meta, null, 2));
  const files = (await readdir(OUT)).filter((f) => f !== "meta.json");
  console.log(`완료: ${files.join(", ")} (${SIDO.length}개 시도 기준)`);
}

main();
