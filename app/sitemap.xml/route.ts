import { XML_HEADERS, sitemapEntries, urlsetXml } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/** 모든 주소를 담은 단일 사이트맵 */
export async function GET() {
  return new Response(urlsetXml(await sitemapEntries()), { headers: XML_HEADERS });
}
