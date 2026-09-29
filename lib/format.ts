/** 20260929 → 2026.09.29 */
export function ymd(s: string | undefined): string {
  if (!s || s.length < 8) return s ?? "";
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`;
}

/** 20260929143000 → 2026.09.29 14:30 */
export function ymdhm(s: string | undefined): string {
  if (!s || s.length < 12) return ymd(s);
  return `${ymd(s)} ${s.slice(8, 10)}:${s.slice(10, 12)}`;
}

export function won(n: number | null | undefined, digits = 0): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "-";
  return n.toLocaleString("ko-KR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function kakaoMapLink(name: string, lat: number, lng: number) {
  return `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`;
}

export function kakaoRouteLink(name: string, lat: number, lng: number) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`;
}

export function naverSearchLink(q: string) {
  return `https://map.naver.com/p/search/${encodeURIComponent(q)}`;
}
