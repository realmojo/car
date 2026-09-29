import proj4 from "proj4";

/**
 * 오피넷은 좌표를 KATEC(TM, Bessel 타원체)으로 주고받는다.
 * 지도 링크와 위치 검색을 위해 WGS84 경위도와 서로 변환한다.
 */
const KATEC =
  "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43";
const WGS84 = "+proj=longlat +datum=WGS84 +no_defs";

export function katecToWgs84(x: number, y: number): { lat: number; lng: number } | null {
  if (!x || !y) return null;
  const [lng, lat] = proj4(KATEC, WGS84, [x, y]);
  return { lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) };
}

export function wgs84ToKatec(lat: number, lng: number): { x: number; y: number } {
  const [x, y] = proj4(WGS84, KATEC, [lng, lat]);
  return { x: Math.round(x), y: Math.round(y) };
}

/** 대략 한반도 범위 안인지 */
export function inKorea(lat: number, lng: number) {
  return lat > 32 && lat < 39.5 && lng > 124 && lng < 132;
}
