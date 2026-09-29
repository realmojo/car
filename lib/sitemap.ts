/**
 * 사이트맵 구성.
 *
 * /sitemap.xml              사이트맵 인덱스
 * /sitemaps/pages.xml       홈·카테고리·지역별 목록·가이드
 * /sitemaps/<데이터>-<n>.xml  상세 페이지 (주차장·정비소·검사소는 5,000개씩 나눈다)
 */
import { SIDO } from "./codes";
import { GUIDES } from "./guides";
import { NAV, SITE_LINKS } from "./menu";
import { absoluteUrl } from "./seo";
import { withQuery } from "./url";
import { loadRows } from "./datasets";
import { countPlaces, listPlaceKeys, type PlaceDataset } from "./places";

export const CHUNK = 5000;

export interface UrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "hourly" | "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
}

const PLACE_PATHS: Record<PlaceDataset, (sido: string, key: string) => string> = {
  parking: (sido, key) => `/parking/${sido}-${key}`,
  repair: (sido, key) => `/repair/shop-${sido}-${key}`,
  inspection: (sido, key) => `/repair/insp-${sido}-${key}`,
};

/** 동기화 파일 기반 상세 페이지 */
const FILE_PATHS = {
  hydrogen: (key: string) => `/charge/h2-${key}`,
  rest: (key: string) => `/road/rest-${key}`,
  recall: (key: string) => `/repair/recall-${key}`,
} as const;

export async function sitemapNames(): Promise<string[]> {
  const names = ["pages"];
  const places: PlaceDataset[] = ["parking", "repair", "inspection"];
  const counts = await Promise.all(places.map((d) => countPlaces(d).catch(() => 0)));
  places.forEach((d, i) => {
    for (let n = 1; n <= Math.ceil(counts[i] / CHUNK); n++) names.push(`${d}-${n}`);
  });
  for (const d of Object.keys(FILE_PATHS) as Array<keyof typeof FILE_PATHS>) {
    if ((await loadRows(d))?.length) names.push(d);
  }
  return names;
}

function pages(): UrlEntry[] {
  const e = (path: string, priority: number, changefreq: UrlEntry["changefreq"] = "weekly"): UrlEntry => ({
    loc: absoluteUrl(path),
    priority,
    changefreq,
  });
  return [
    e("/", 1, "daily"),
    ...NAV.map((n) => e(n.href, 0.9, "daily")),
    ...NAV.flatMap((n) => n.children ?? []).map((c) => e(c.href, 0.8, "daily")),
    ...SIDO.flatMap((s) => [
      e(withQuery("/charge", { type: "ev", sido: s.slug }), 0.7, "daily"),
      e(withQuery("/parking", { sido: s.slug }), 0.7),
      e(withQuery("/parking", { sido: s.slug, f: "free" }), 0.6),
      e(withQuery("/repair", { type: "shop", sido: s.slug }), 0.6),
      e(withQuery("/repair", { type: "inspection", sido: s.slug }), 0.6),
    ]),
    ...GUIDES.map((g) => e(`/guide/${g.slug}`, 0.7, "monthly")),
    ...SITE_LINKS.map((l) => e(l.href, 0.3, "yearly")),
  ];
}

export async function sitemapEntries(name: string): Promise<UrlEntry[] | null> {
  if (name === "pages") return pages();

  const place = name.match(/^(parking|repair|inspection)-(\d+)$/);
  if (place) {
    const dataset = place[1] as PlaceDataset;
    const n = Number(place[2]);
    if (n < 1) return null;
    const rows = await listPlaceKeys(dataset, (n - 1) * CHUNK, CHUNK);
    if (!rows.length) return null;
    return rows.map((r) => ({
      loc: absoluteUrl(PLACE_PATHS[dataset](r.sido, r.key)),
      lastmod: r.syncedAt?.slice(0, 10),
      changefreq: "monthly",
      priority: 0.6,
    }));
  }

  if (name in FILE_PATHS) {
    const d = name as keyof typeof FILE_PATHS;
    const rows = await loadRows(d);
    if (!rows?.length) return null;
    return rows.map((r) => ({ loc: absoluteUrl(FILE_PATHS[d](r.key)), changefreq: "monthly", priority: 0.5 }));
  }
  return null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function urlsetXml(entries: UrlEntry[]) {
  const items = entries
    .map(
      (e) =>
        `<url><loc>${esc(e.loc)}</loc>${e.lastmod ? `<lastmod>${e.lastmod}</lastmod>` : ""}${
          e.changefreq ? `<changefreq>${e.changefreq}</changefreq>` : ""
        }${e.priority !== undefined ? `<priority>${e.priority.toFixed(1)}</priority>` : ""}</url>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

export function indexXml(names: string[]) {
  const today = new Date().toISOString().slice(0, 10);
  const items = names
    .map((n) => `<sitemap><loc>${esc(absoluteUrl(`/sitemaps/${n}.xml`))}</loc><lastmod>${today}</lastmod></sitemap>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

export const XML_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};
