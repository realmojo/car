import { XML_HEADERS, indexXml, sitemapNames } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/** 사이트맵 인덱스. 하위 사이트맵은 /sitemaps/<이름>.xml */
export async function GET() {
  return new Response(indexXml(await sitemapNames()), { headers: XML_HEADERS });
}
