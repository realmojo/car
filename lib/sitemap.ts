/**
 * 사이트맵 구성. /sitemap.xml 한 파일에 모든 주소를 담는다.
 * 홈·카테고리·지역별 목록·가이드 다음에 DB 의 상세 페이지를 붙인다.
 * 사이트맵 한 파일의 한도(50,000개)를 넘는 주소는 잘라낸다.
 */
import { SIDO } from "./codes";
import { GUIDES } from "./guides";
import { NAV, SITE_LINKS } from "./menu";
import { absoluteUrl } from "./seo";
import { withQuery } from "./url";
import { loadRows } from "./datasets";
import { listPlaceKeys, type PlaceDataset } from "./places";

/** 사이트맵 한 파일에 넣을 수 있는 최대 주소 수 */
export const MAX_URLS = 50000;

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

/** 수소충전소·휴게소·리콜 상세 페이지 */
const FILE_PATHS = {
  hydrogen: (key: string) => `/charge/h2-${key}`,
  rest: (key: string) => `/road/rest-${key}`,
  recall: (key: string) => `/repair/recall-${key}`,
} as const;

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

export async function sitemapEntries(): Promise<UrlEntry[]> {
  const out = pages();

  for (const d of Object.keys(FILE_PATHS) as Array<keyof typeof FILE_PATHS>) {
    const rows = await loadRows(d).catch(() => null);
    for (const r of rows ?? []) out.push({ loc: absoluteUrl(FILE_PATHS[d](r.key)), changefreq: "monthly", priority: 0.5 });
  }

  for (const d of Object.keys(PLACE_PATHS) as PlaceDataset[]) {
    const room = MAX_URLS - out.length;
    if (room <= 0) break;
    const rows = await listPlaceKeys(d, 0, room).catch(() => []);
    for (const r of rows) {
      out.push({
        loc: absoluteUrl(PLACE_PATHS[d](r.sido, r.key)),
        lastmod: r.syncedAt?.slice(0, 10),
        changefreq: "monthly",
        priority: 0.6,
      });
    }
  }
  return out.slice(0, MAX_URLS);
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

export const XML_HEADERS = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=3600",
};
