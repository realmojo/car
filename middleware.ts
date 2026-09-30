import { NextResponse, type NextRequest } from "next/server";
import { legacyListUrl } from "@/lib/legacy";

/**
 * 옛 목록 주소(/parking?sido=… 등)를 새 경로로 301 리다이렉트한다.
 * 페이지의 permanentRedirect 는 308 이라, 검색엔진이 확실히 알아듣는 301 을 여기서 낸다.
 */
export function middleware(req: NextRequest) {
  const to = legacyListUrl(req.nextUrl.pathname, req.nextUrl.searchParams);
  if (!to) return NextResponse.next();
  return NextResponse.redirect(new URL(to, req.url), 301);
}

export const config = {
  matcher: ["/parking", "/repair", "/charge"],
};
