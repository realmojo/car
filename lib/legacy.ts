/**
 * 옛 쿼리스트링 목록 주소 → 새 경로 주소.
 *   /parking?sido=seoul&gu=11680&f=free  → /parking/free/seoul/11680
 *   /repair?type=inspection&sido=busan   → /repair/inspection/busan
 *   /charge?type=ev&sido=seoul&gu=11680  → /charge/ev/seoul/11680
 * 리콜(/repair?type=recall)은 그대로 둔다 (null).
 *
 * middleware.ts 가 301 로 넘기고, middleware 가 못 돌았을 때를 위해 옛 페이지도 같은 함수로 넘긴다.
 */
import { findSido, findSigungu } from "./codes";
import { listPath } from "./url";

type Params = { get(name: string): string | null };

export function legacyListUrl(pathname: string, sp: Params): string | null {
  const v = (k: string) => sp.get(k) ?? "";
  const sido = findSido(v("sido")) ? v("sido") : "";
  const gu = sido && findSigungu(sido, v("gu")) ? v("gu") : "";

  if (pathname === "/parking") {
    const f = v("f");
    const kind = f === "free" || f === "public" ? f : "all";
    return listPath("parking", kind, sido, gu, {
      q: v("q"),
      sort: v("sort"),
      page: v("page"),
      f: f === "disabled" ? f : "",
    });
  }
  if (pathname === "/repair") {
    const type = v("type");
    if (type === "recall") return null;
    return listPath("repair", type === "inspection" ? "inspection" : "shop", sido, gu, {
      f: v("f"),
      q: v("q"),
      page: v("page"),
    });
  }
  if (pathname === "/charge") {
    if (v("type") === "h2") return listPath("charge", "h2", sido, gu, { q: v("q"), page: v("page") });
    return listPath("charge", "ev", sido, gu);
  }
  return null;
}
