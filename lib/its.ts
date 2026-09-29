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
  const key = process.env.ITS_API_KEY;
  if (!key) return Promise.reject(new ApiKeyMissingError("국가교통정보센터(ITS)"));
  return cached("its:events", 300, async () => {
    const qs = new URLSearchParams({
      apiKey: key,
      type: "all",
      eventType: "all",
      minX: "124",
      maxX: "132",
      minY: "33",
      maxY: "39",
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
