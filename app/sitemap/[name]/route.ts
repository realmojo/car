import { XML_HEADERS, sitemapEntries, urlsetXml } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

/** 하위 사이트맵 (pages.xml, details.xml, parking-1.xml …) */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const entries = await sitemapEntries((await params).name);
  if (!entries) return new Response("Not Found", { status: 404 });
  return new Response(urlsetXml(entries), { headers: XML_HEADERS });
}
