/**
 * 한국환경공단 전기자동차 충전소 정보 API (공공데이터포털)
 * https://www.data.go.kr/data/15076352/openapi.do
 */
import { cached, fetchText } from "./cache";
import { CHARGER_STATUS, CHARGER_TYPES, SLOW_TYPES, type ChargerState } from "./codes";
import { ApiKeyMissingError } from "./errors";
import * as mock from "./mock";

const BASE = "https://apis.data.go.kr/B552584/EvCharger/getChargerInfo";
const PAGE_SIZE = 9999;
const MAX_PAGES = 5;

export interface EvCharger {
  id: string;
  type: string;
  typeName: string;
  fast: boolean;
  output: number;
  stat: string;
  statName: string;
  state: ChargerState;
  statUpdDt: string;
}

export interface EvStation {
  id: string;
  /** 환경공단 시군구 코드. 상세 페이지 URL 에 쓴다 */
  zscode: string;
  name: string;
  address: string;
  location: string;
  useTime: string;
  lat: number;
  lng: number;
  operator: string;
  operatorTel: string;
  parkingFree: boolean;
  limited: boolean;
  limitDetail: string;
  note: string;
  chargers: EvCharger[];
}

export interface EvSummary {
  stations: number;
  chargers: number;
  fast: number;
  slow: number;
  available: number;
  charging: number;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());

function serviceKey() {
  const key = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!key) throw new ApiKeyMissingError("공공데이터포털");
  // 인코딩된 키(%2B…)를 넣었으면 그대로, 디코딩 키면 인코딩해서 쓴다
  return key.includes("%") ? key : encodeURIComponent(key);
}

async function fetchPage(zcode: string, zscode: string, pageNo: number) {
  const qs = new URLSearchParams({
    pageNo: String(pageNo),
    numOfRows: String(PAGE_SIZE),
    zcode,
    zscode,
    dataType: "JSON",
  });
  const text = await fetchText(`${BASE}?serviceKey=${serviceKey()}&${qs}`, 20000);
  let json: { resultCode?: string; resultMsg?: string; totalCount?: number; items?: { item?: Row[] } };
  try {
    json = JSON.parse(text);
  } catch {
    // 인증 오류 등은 XML 로 온다
    const msg = text.match(/<returnAuthMsg>([^<]+)</)?.[1] ?? text.match(/<resultMsg>([^<]+)</)?.[1];
    throw new Error(`충전소 API 오류${msg ? `: ${msg}` : ""}`);
  }
  if (json.resultCode && json.resultCode !== "00") {
    throw new Error(`충전소 API 오류: ${json.resultMsg ?? json.resultCode}`);
  }
  return { total: Number(json.totalCount ?? 0), rows: json.items?.item ?? [] };
}

async function fetchZscode(zscode: string): Promise<Row[]> {
  const zcode = zscode.slice(0, 2);
  const first = await fetchPage(zcode, zscode, 1);
  const rows = [...first.rows];
  const pages = Math.min(MAX_PAGES, Math.ceil(first.total / PAGE_SIZE));
  for (let p = 2; p <= pages; p++) {
    rows.push(...(await fetchPage(zcode, zscode, p)).rows);
  }
  return rows;
}

function groupStations(rows: Row[]): EvStation[] {
  const map = new Map<string, EvStation>();
  for (const r of rows) {
    if (str(r.delYn) === "Y") continue;
    const id = str(r.statId);
    let st = map.get(id);
    if (!st) {
      st = {
        id,
        zscode: str(r.zscode),
        name: str(r.statNm),
        address: str(r.addr),
        location: [str(r.addrDetail), str(r.location)].filter((s) => s && s !== "null").join(" "),
        useTime: str(r.useTime),
        lat: Number(r.lat) || 0,
        lng: Number(r.lng) || 0,
        operator: str(r.busiNm) || str(r.bnm),
        operatorTel: str(r.busiCall),
        parkingFree: str(r.parkingFree) === "Y",
        limited: str(r.limitYn) === "Y",
        limitDetail: str(r.limitDetail),
        note: str(r.note),
        chargers: [],
      };
      map.set(id, st);
    }
    const chgerId = str(r.chgerId);
    if (st.chargers.some((c) => c.id === chgerId)) continue;
    const type = str(r.chgerType);
    const stat = str(r.stat) || "9";
    const status = CHARGER_STATUS[stat] ?? CHARGER_STATUS["9"];
    st.chargers.push({
      id: chgerId,
      type,
      typeName: CHARGER_TYPES[type] ?? type,
      fast: !SLOW_TYPES.has(type),
      output: Number(r.output) || 0,
      stat,
      statName: status.name,
      state: status.state,
      statUpdDt: str(r.statUpdDt),
    });
  }
  for (const st of map.values()) st.chargers.sort((a, b) => a.id.localeCompare(b.id));
  return [...map.values()];
}

/** 시군구의 충전소 목록. zscodes 여러 개를 모아 충전소 단위로 묶는다 */
export function getStationsByRegion(zscodes: string[]): Promise<EvStation[]> {
  if (process.env.MOCK_DATA === "1") return Promise.resolve(mock.evStations(zscodes[0]));
  return cached(`ev:region:${zscodes.join(",")}`, 600, async () => {
    const results = await Promise.all(zscodes.map((z) => fetchZscode(z)));
    return groupStations(results.flat());
  });
}

/** 상세 페이지: 충전소가 속한 시군구 전체를 불러와(목록과 캐시 공유) 찾는다 */
export async function getStation(zscodes: string[], statId: string): Promise<EvStation | null> {
  const list = await getStationsByRegion(zscodes);
  return list.find((s) => s.id === statId) ?? null;
}

export function summarize(stations: EvStation[]): EvSummary {
  const s: EvSummary = { stations: stations.length, chargers: 0, fast: 0, slow: 0, available: 0, charging: 0 };
  for (const st of stations) {
    for (const c of st.chargers) {
      s.chargers++;
      if (c.fast) s.fast++;
      else s.slow++;
      if (c.state === "available") s.available++;
      if (c.state === "charging") s.charging++;
    }
  }
  return s;
}
