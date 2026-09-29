/**
 * 국가교통정보센터(ITS) 돌발상황정보 API
 * https://www.its.go.kr/opendata/opendataList?service=event
 *
 * 고속도로·국도의 사고, 공사, 기상, 재난 등 실시간 돌발상황.
 * 인증키는 ITS 국가교통정보센터에서 따로 발급받는다 (ITS_API_KEY).
 */
import { cached, fetchText } from "./cache";
import { ApiKeyMissingError } from "./errors";
import * as mock from "./mock";

const DEFAULT_BASE = "https://openapi.its.go.kr:9443/eventInfo";
const CCTV_BASE = "https://openapi.its.go.kr:9443/cctvInfo";

/** 전국 범위 */
const KOREA_BOX = { minX: "124", maxX: "132", minY: "33", maxY: "39" };

export interface RoadEvent {
  id: string;
  roadType: string;
  eventType: string;
  detailType: string;
  roadName: string;
  roadNo: string;
  direction: string;
  lanesBlocked: string;
  message: string;
  startDate: string;
  endDate: string;
  lat: number;
  lng: number;
}

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());

export function getRoadEvents(): Promise<RoadEvent[]> {
  if (process.env.MOCK_DATA === "1") return Promise.resolve(mock.roadEvents());
  return Promise.all([getIncidentEvents(), getDisasterEvents().catch(() => [] as RoadEvent[])]).then(([a, b]) =>
    [...a, ...b].sort((x, y) => y.startDate.localeCompare(x.startDate)),
  );
}

function getIncidentEvents(): Promise<RoadEvent[]> {
  let key: string;
  try {
    key = itsKey();
  } catch (e) {
    return Promise.reject(e);
  }
  return cached("its:events", 300, async () => {
    const qs = new URLSearchParams({
      apiKey: key,
      type: "all",
      eventType: "all",
      ...KOREA_BOX,
      getType: "json",
    });
    const text = await fetchText(`${process.env.ITS_API_BASE || DEFAULT_BASE}?${qs}`);
    let json: { header?: { resultCode?: number | string; resultMsg?: string }; body?: { items?: Row[] | { item?: Row[] } } };
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error("돌발상황 API 응답을 해석하지 못했습니다. 인증키를 확인하세요.");
    }
    const code = str(json.header?.resultCode);
    if (code && code !== "0" && code !== "00") throw new Error(`돌발상황 API 오류: ${json.header?.resultMsg ?? code}`);
    const items = json.body?.items;
    const rows: Row[] = Array.isArray(items) ? items : (items?.item ?? []);
    return rows
      .map((r, i) => ({
        id: `${str(r.linkId)}-${str(r.startDate)}-${i}`,
        roadType: str(r.type),
        eventType: str(r.eventType),
        detailType: str(r.eventDetailType),
        roadName: str(r.roadName),
        roadNo: str(r.roadNo),
        direction: str(r.roadDrcType),
        lanesBlocked: str(r.lanesBlocked) || str(r.lanesBlockType),
        message: str(r.message),
        startDate: str(r.startDate),
        endDate: str(r.endDate),
        lat: Number(r.coordY) || 0,
        lng: Number(r.coordX) || 0,
      }))
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
  });
}

/** 돌발 유형 → 화면 분류 */
export function eventGroup(e: RoadEvent): "accident" | "construction" | "weather" | "etc" {
  const t = `${e.eventType} ${e.detailType}`;
  if (/사고|고장/.test(t)) return "accident";
  if (/공사|작업|통제/.test(t)) return "construction";
  if (/기상|강우|강설|결빙|안개|재난|침수/.test(t)) return "weather";
  return "etc";
}

export const EVENT_GROUPS = [
  { key: "accident", name: "사고·고장" },
  { key: "construction", name: "공사·통제" },
  { key: "weather", name: "기상·재난" },
  { key: "etc", name: "기타" },
] as const;

/* ------------------------------------------------------------------ 공통 */

function itsKey() {
  const key = process.env.ITS_API_KEY;
  if (!key) throw new ApiKeyMissingError("국가교통정보센터(ITS)");
  return key;
}

function pick(row: Row, keys: string[]) {
  for (const k of keys) {
    const v = str(row[k]);
    if (v && v !== "null") return v;
  }
  return "";
}

/** 응답 JSON 에서 객체 배열을 찾는다 (body.items / response.data / items.item …) */
function findArray(json: unknown): Row[] {
  if (Array.isArray(json)) return json as Row[];
  if (json && typeof json === "object") {
    for (const k of ["response", "body", "items", "item", "data", "list"]) {
      const v = (json as Row)[k];
      if (v !== undefined) {
        const found = findArray(v);
        if (found.length) return found;
      }
    }
  }
  return [];
}

async function fetchItsRows(base: string, params: Record<string, string>): Promise<Row[]> {
  const qs = new URLSearchParams({ apiKey: itsKey(), getType: "json", ...params });
  const text = await fetchText(`${base}${base.includes("?") ? "&" : "?"}${qs}`);
  try {
    return findArray(JSON.parse(text));
  } catch {
    throw new Error("국가교통정보센터 응답을 해석하지 못했습니다. 인증키와 서비스 신청 여부를 확인하세요.");
  }
}

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/* ------------------------------------------------------------------ 재난상황 */

/**
 * 재난상황정보. 요청 주소를 ITS_DISASTER_URL 에 넣으면 돌발상황 목록에 합쳐진다.
 * (ITS 오픈데이터 상세 페이지의 "요청 URL" 에서 apiKey 앞부분까지)
 */
function getDisasterEvents(): Promise<RoadEvent[]> {
  const url = process.env.ITS_DISASTER_URL;
  if (!url) return Promise.resolve([]);
  return cached("its:disaster", 600, async () => {
    const rows = await fetchItsRows(url, { type: "all", ...KOREA_BOX });
    return rows.map((r, i) => ({
      id: `dis-${hash(JSON.stringify(r))}-${i}`,
      roadType: pick(r, ["type", "roadType"]) || "재난",
      eventType: "재난",
      detailType: pick(r, ["eventDetailType", "disasterType", "disasterName", "eventType"]) || "재난",
      roadName: pick(r, ["roadName", "roadNm", "linkName"]),
      roadNo: pick(r, ["roadNo"]),
      direction: pick(r, ["roadDrcType", "direction"]),
      lanesBlocked: pick(r, ["lanesBlocked", "lanesBlockType"]),
      message: pick(r, ["message", "disasterContent", "content", "eventContent"]),
      startDate: pick(r, ["startDate", "occurDate", "regDate"]),
      endDate: pick(r, ["endDate"]),
      lat: Number(pick(r, ["coordY", "coordy", "y", "lat"])) || 0,
      lng: Number(pick(r, ["coordX", "coordx", "x", "lng"])) || 0,
    }));
  });
}

/* ------------------------------------------------------------------ 주의운전구간 */

export interface CautionZone {
  id: string;
  roadType: string;
  roadName: string;
  title: string;
  reason: string;
  lat: number;
  lng: number;
  /** 매핑하지 못한 나머지 항목 (상세 표시용) */
  extra: Array<[string, string]>;
}

export const cautionEnabled = () => Boolean(process.env.ITS_CAUTION_URL) || process.env.MOCK_DATA === "1";

/** 주의운전구간. 요청 주소를 ITS_CAUTION_URL 에 넣으면 이동 > 주의운전구간 탭이 켜진다 */
export function getCautionZones(): Promise<CautionZone[]> {
  if (process.env.MOCK_DATA === "1") return Promise.resolve(mock.cautionZones());
  const url = process.env.ITS_CAUTION_URL;
  if (!url) return Promise.resolve([]);
  return cached("its:caution", 21600, async () => {
    const rows = await fetchItsRows(url, { type: "all", ...KOREA_BOX });
    const used = new Set(["type", "roadType", "roadName", "roadNm", "coordX", "coordY", "coordx", "coordy"]);
    return rows.map((r) => {
      const title = pick(r, ["sectionName", "sectionNm", "cautionName", "name", "linkName", "roadName"]);
      const reason = pick(r, ["reason", "cautionType", "dangerType", "message", "content", "description"]);
      return {
        id: hash(JSON.stringify(r)),
        roadType: pick(r, ["type", "roadType"]),
        roadName: pick(r, ["roadName", "roadNm"]),
        title: title || "주의운전구간",
        reason,
        lat: Number(pick(r, ["coordY", "coordy", "y", "lat"])) || 0,
        lng: Number(pick(r, ["coordX", "coordx", "x", "lng"])) || 0,
        extra: Object.entries(r)
          .filter(([k, v]) => !used.has(k) && str(v) && typeof v !== "object")
          .map(([k, v]) => [k, str(v)] as [string, string]),
      };
    });
  });
}

/* ------------------------------------------------------------------ CCTV */

export interface Cctv {
  id: string;
  /** ex: 고속도로, its: 국도 */
  road: "ex" | "its";
  name: string;
  /** 이름에서 뽑은 노선명 (예: 경부선) */
  route: string;
  url: string;
  format: string;
  lat: number;
  lng: number;
}

/** "[경부선] 양재" → { route: "경부선", place: "양재" } */
export function splitCctvName(name: string) {
  const m = name.match(/^\s*\[([^\]]+)\]\s*(.*)$/);
  if (m) return { route: m[1].trim(), place: m[2].trim() || m[1].trim() };
  const road = name.match(/^(국도\s*\d+호선|[^\s]+(?:고속도로|선))\s*(.*)$/);
  if (road) return { route: road[1].replace(/\s+/g, ""), place: road[2].trim() || road[1] };
  return { route: "", place: name };
}

/**
 * 전국 CCTV 목록. cctvType 4 = 실시간 스트리밍(HTTPS).
 * HTTPS 주소가 없으면 1(HTTP 스트리밍)로 한 번 더 조회한다.
 * 영상 주소는 시간이 지나면 만료될 수 있어 캐시를 10분으로 짧게 둔다.
 */
export function getCctvs(road: "ex" | "its"): Promise<Cctv[]> {
  if (process.env.MOCK_DATA === "1") return Promise.resolve(mock.cctvs(road));
  return cached(`its:cctv:${road}`, 600, async () => {
    const preferred = process.env.ITS_CCTV_TYPE || "4";
    let rows = await fetchItsRows(CCTV_BASE, { type: road, cctvType: preferred, ...KOREA_BOX });
    if (!rows.length && preferred !== "1") rows = await fetchItsRows(CCTV_BASE, { type: road, cctvType: "1", ...KOREA_BOX });
    const seen = new Set<string>();
    const out: Cctv[] = [];
    for (const r of rows) {
      const name = pick(r, ["cctvname", "cctvName"]);
      const lat = Number(pick(r, ["coordy", "coordY"])) || 0;
      const lng = Number(pick(r, ["coordx", "coordX"])) || 0;
      if (!name) continue;
      const id = hash(`${road}|${name}|${lat.toFixed(4)}|${lng.toFixed(4)}`);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        road,
        name,
        route: splitCctvName(name).route,
        url: pick(r, ["cctvurl", "cctvUrl"]),
        format: pick(r, ["cctvformat", "cctvFormat"]),
        lat,
        lng,
      });
    }
    return out;
  });
}

/** 두 지점 사이 거리(km) */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
