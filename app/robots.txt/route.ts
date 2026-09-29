import { SITE } from "@/lib/seo";

/**
 * robots.txt 를 직접 만든다 (keywordegg 와 같은 방식).
 * 다음 웹마스터도구처럼 robots.txt 주석으로 소유를 확인하는 곳이 있어 라우트 핸들러로 둔다.
 */

/** 다음 웹마스터도구 소유확인 값 (발급받으면 "#DaumWebMasterTool:…" 한 줄을 넣는다) */
const DAUM_VERIFICATION = "";

/** 색인 가치가 없는 경로 */
const DISALLOW = ["/api/", "/data/"];

/** 국내 검색엔진 로봇은 규칙을 명시해 두는 편이 안전하다 (네이버 Yeti, 다음 Daumoa) */
const USER_AGENTS = ["*", "Yeti", "Daumoa"];

export function GET() {
  const blocks = USER_AGENTS.map((agent) =>
    [`User-agent: ${agent}`, "Allow: /", ...DISALLOW.map((p) => `Disallow: ${p}`)].join("\n"),
  );
  const body = [
    ...(DAUM_VERIFICATION ? [DAUM_VERIFICATION, ""] : []),
    ...blocks.flatMap((b) => [b, ""]),
    `Host: ${SITE.url}`,
    `Sitemap: ${SITE.url}/sitemap.xml`,
    "",
  ].join("\n");
  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
