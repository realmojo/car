import { XML_HEADERS, sitemapEntries, urlsetXml } from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const m = name.match(/^([a-z]+(?:-\d+)?)\.xml$/);
  const entries = m ? await sitemapEntries(m[1]).catch(() => null) : null;
  if (!entries) return new Response("Not Found", { status: 404 });
  return new Response(urlsetXml(entries), { headers: XML_HEADERS });
}
