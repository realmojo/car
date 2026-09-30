import { XML_HEADERS, sitemapIndexXml, sitemapNames } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/** 사이트맵 인덱스. 실제 주소는 /sitemap/<이름>.xml 에 나눠 담는다 */
export async function GET() {
  return new Response(sitemapIndexXml(await sitemapNames()), { headers: XML_HEADERS });
}
