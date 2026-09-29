/**
 * 한국석유공사 오피넷 유가정보 API
 * https://www.opinet.co.kr/user/custapi/openApiInfo.do
 *
 * 응답은 { RESULT: { OIL: [...] } } 형태이고 숫자도 문자열로 온다.
 */
import { cached, fetchText } from "./cache";
import { katecToWgs84, wgs84ToKatec } from "./geo";
import { PRODUCTS } from "./codes";
import { ApiKeyMissingError } from "./errors";
import * as mock from "./mock";

const BASE = "https://www.opinet.co.kr/api";

export interface OilAvg {
  prodcd: string;
  name: string;
  price: number;
  diff: number;
  date: string;
}

export interface RecentPrice {
  date: string;
  prodcd: string;
  price: number;
}

export interface AreaAvg {
  code: string;
  name: string;
  price: number;
  diff: number;
}

export interface StationSummary {
  id: string;
  name: string;
  brand: string;
  price: number;
  address: string;
  lat?: number;
  lng?: number;
  /** 주변 검색에서만 채워진다 (m) */
  distance?: number;
}

export interface StationDetail {
  id: string;
  name: string;
  brand: string;
  subBrand: string;
  address: string;
  oldAddress: string;
  tel: string;
  lpg: boolean;
  maint: boolean;
  carWash: boolean;
  cvs: boolean;
  kpetro: boolean;
  lat?: number;
  lng?: number;
  prices: Array<{ prodcd: string; price: number; tradedAt: string }>;
}

const mockEnabled = () => process.env.MOCK_DATA === "1";

function apiKey() {
  const key = process.env.OPINET_API_KEY;
  if (!key) throw new ApiKeyMissingError("오피넷");
  return key;
}

type Row = Record<string, unknown>;

async function call(endpoint: string, params: Record<string, string | number>): Promise<Row[]> {
  const qs = new URLSearchParams({ out: "json", code: apiKey() });
  for (const [k, v] of Object.entries(params)) {
    if (v !== "") qs.set(k, String(v));
  }
  const text = await fetchText(`${BASE}/${endpoint}?${qs}`);
  let json: { RESULT?: { OIL?: Row[] } };
  try {
    json = JSON.parse(text);
  } catch {
    // 키가 잘못되면 JSON 대신 안내 문구나 HTML 이 온다
    throw new Error("오피넷 응답을 해석하지 못했습니다. API 키를 확인하세요.");
  }
  return json.RESULT?.OIL ?? [];
}

const str = (v: unknown) => (v === undefined || v === null ? "" : String(v).trim());
const num = (v: unknown) => {
  const n = Number(str(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const yes = (v: unknown) => str(v) === "Y";

function coords(row: Row) {
  return katecToWgs84(num(row.GIS_X_COOR), num(row.GIS_Y_COOR)) ?? undefined;
}

function toStation(row: Row): StationSummary {
  const c = coords(row);
  return {
    id: str(row.UNI_ID),
    name: str(row.OS_NM),
    brand: str(row.POLL_DIV_CD ?? row.POLL_DIV_CO),
    price: num(row.PRICE),
    address: str(row.NEW_ADR) || str(row.VAN_ADR),
    lat: c?.lat,
    lng: c?.lng,
    ...(row.DISTANCE !== undefined ? { distance: num(row.DISTANCE) } : {}),
  };
}

/** 전국 주유소 평균가격 (유종 전체) */
export function getAvgAllPrice(): Promise<OilAvg[]> {
  if (mockEnabled()) return Promise.resolve(mock.avgAll());
  return cached("opinet:avgAll", 3600, async () => {
    const rows = await call("avgAllPrice.do", {});
    const order = PRODUCTS.map((p) => p.code);
    return rows
      .map((r) => ({
        prodcd: str(r.PRODCD),
        name: str(r.PRODNM),
        price: num(r.PRICE),
        diff: num(r.DIFF),
        date: str(r.TRADE_DT),
      }))
      .sort((a, b) => order.indexOf(a.prodcd) - order.indexOf(b.prodcd));
  });
}

/** 최근 7일간 전국 일일 평균가격 */
export function getRecentPrices(): Promise<RecentPrice[]> {
  if (mockEnabled()) return Promise.resolve(mock.recent());
  return cached("opinet:recent", 3600, async () => {
    const rows = await call("avgRecentPrice.do", {});
    return rows
      .map((r) => ({ date: str(r.DATE), prodcd: str(r.PRODCD), price: num(r.PRICE) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  });
}

/** 시도별 평균가격 */
export function getSidoAvg(prodcd: string): Promise<AreaAvg[]> {
  if (mockEnabled()) return Promise.resolve(mock.sidoAvg(prodcd));
  return cached(`opinet:sido:${prodcd}`, 3600, async () => {
    const rows = await call("avgSidoPrice.do", { prodcd });
    return rows
      .map((r) => ({
        code: str(r.SIDOCD),
        name: str(r.SIDONM),
        price: num(r.PRICE),
        diff: num(r.DIFF),
      }))
      .filter((r) => r.code !== "00");
  });
}

/** 시군구별 평균가격 */
export function getSigunAvg(sido: string, prodcd: string): Promise<AreaAvg[]> {
  if (mockEnabled()) return Promise.resolve(mock.sigunAvg(sido, prodcd));
  return cached(`opinet:sigun:${sido}:${prodcd}`, 3600, async () => {
    const rows = await call("avgSigunPrice.do", { sido, prodcd });
    return rows.map((r) => ({
      code: str(r.SIGUNCD),
      name: str(r.SIGUNNM),
      price: num(r.PRICE),
      diff: num(r.DIFF),
    }));
  });
}

/** 지역별 최저가 주유소 (area 는 시도 2자리 또는 시군구 4자리) */
export function getLowestStations(area: string, prodcd: string, cnt = 20): Promise<StationSummary[]> {
  if (mockEnabled()) return Promise.resolve(mock.lowest(area, prodcd, cnt));
  return cached(`opinet:low:${area}:${prodcd}:${cnt}`, 1800, async () => {
    const rows = await call("lowTop10.do", { prodcd, area, cnt });
    return rows.map(toStation);
  });
}

/** 주유소 상세 */
export function getStationDetail(id: string): Promise<StationDetail | null> {
  if (mockEnabled()) return Promise.resolve(mock.detail(id));
  return cached(`opinet:detail:${id}`, 1800, async () => {
    const rows = await call("detailById.do", { id });
    const r = rows[0];
    if (!r) return null;
    const c = coords(r);
    const prices = (Array.isArray(r.OIL_PRICE) ? (r.OIL_PRICE as Row[]) : []).map((p) => ({
      prodcd: str(p.PRODCD),
      price: num(p.PRICE),
      tradedAt: `${str(p.TRADE_DT)}${str(p.TRADE_TM)}`,
    }));
    return {
      id: str(r.UNI_ID),
      name: str(r.OS_NM),
      brand: str(r.POLL_DIV_CO),
      subBrand: str(r.GPOLL_DIV_CO),
      address: str(r.NEW_ADR) || str(r.VAN_ADR),
      oldAddress: str(r.VAN_ADR),
      tel: str(r.TEL),
      lpg: yes(r.LPG_YN),
      maint: yes(r.MAINT_YN),
      carWash: yes(r.CAR_WASH_YN),
      cvs: yes(r.CVS_YN),
      kpetro: yes(r.KPETRO_YN),
      lat: c?.lat,
      lng: c?.lng,
      prices,
    };
  });
}

/** 반경 내 주유소. sort 1: 가격순, 2: 거리순 */
export function getAroundStations(
  lat: number,
  lng: number,
  radius: number,
  prodcd: string,
  sort: 1 | 2,
): Promise<StationSummary[]> {
  if (mockEnabled()) return Promise.resolve(mock.around(lat, lng, prodcd, sort));
  const { x, y } = wgs84ToKatec(lat, lng);
  // 좌표를 100m 격자로 뭉쳐 가까운 요청끼리 캐시를 공유한다
  const gx = Math.round(x / 100) * 100;
  const gy = Math.round(y / 100) * 100;
  return cached(`opinet:around:${gx}:${gy}:${radius}:${prodcd}:${sort}`, 900, async () => {
    const rows = await call("aroundAll.do", { x: gx, y: gy, radius, prodcd, sort });
    return rows.map(toStation);
  });
}
