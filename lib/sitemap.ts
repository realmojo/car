/**
 * 사이트맵 구성. /sitemap.xml 은 인덱스이고, 실제 주소는 /sitemap/<이름>.xml 여러 파일에 나눠 담는다.
 *   pages.xml          홈·카테고리·지역별 목록·가이드
 *   details.xml        수소충전소·휴게소·리콜 상세
 *   parking-1.xml …    주차장·검사소·정비업체 상세 (파일당 최대 CHUNK 개)
 * 예전에는 한 파일에 담아 50,000개 한도에서 정비업체 일부가 잘렸다.
 */
import { SIDO, SIGUNGU } from "./codes";
import { GUIDES } from "./guides";
import { PLACE_KINDS } from "./lists";
import { NAV, SITE_LINKS } from "./menu";
import { absoluteUrl } from "./seo";
import { loadRows } from "./datasets";
import { countPlaces, listPlaceKeys, type PlaceDataset } from "./places";
import { countOf, listPath, regionIndex, tally } from "./regions";

/** 사이트맵 파일 하나에 담는 주소 수 (규격 한도 50,000 보다 넉넉히 작게) */
export const CHUNK = 40000;

export interface UrlEntry {
  loc: string;
  lastmod?: string;
  changefreq?: "hourly" | "daily" | "weekly" | "monthly" | "yearly";
  priority?: number;
}

const PLACE_PATHS: Record<PlaceDataset, (sido: string, key: string) => string> = {
  parking: (sido, key) => `/parking/${sido}-${key}`,
  inspection: (sido, key) => `/repair/insp-${sido}-${key}`,
  repair: (sido, key) => `/repair/shop-${sido}-${key}`,
};

/** 수소충전소·휴게소·리콜 상세 페이지 */
const FILE_PATHS = {
  hydrogen: (key: string) => `/charge/h2-${key}`,
  rest: (key: string) => `/road/rest-${key}`,
  recall: (key: string) => `/repair/recall-${key}`,
} as const;

const e = (path: string, priority: number, changefreq: UrlEntry["changefreq"] = "weekly"): UrlEntry => ({
  loc: absoluteUrl(path),
  priority,
  changefreq,
});

/** 지역별 목록. 등록된 시설이 없는 지역은 빈 페이지라 넣지 않는다 */
async function regionPages(): Promise<UrlEntry[]> {
  const out: UrlEntry[] = [];
  for (const k of PLACE_KINDS) {
    const index = await regionIndex(k.dataset).catch(() => null);
    out.push(e(listPath(k.section, k.kind), 0.8, "weekly"));
    for (const s of SIDO) {
      if (index && countOf(tally(index, s.slug), k.flag) === 0) continue;
      out.push(e(listPath(k.section, k.kind, s.slug), 0.7));
      for (const g of SIGUNGU[s.slug] ?? []) {
        if (!index || countOf(tally(index, s.slug, g.code), k.flag) === 0) continue;
        out.push(e(listPath(k.section, k.kind, s.slug, g.code), 0.7));
      }
    }
  }
  // 전기차는 충전기 상태가 실시간이라 daily. 건수는 API 를 불러야 알 수 있어 시군구를 모두 넣는다
  out.push(e(listPath("charge", "ev"), 0.8, "daily"));
  for (const s of SIDO) {
    out.push(e(listPath("charge", "ev", s.slug), 0.7, "daily"));
    for (const g of SIGUNGU[s.slug] ?? []) out.push(e(listPath("charge", "ev", s.slug, g.code), 0.7, "daily"));
  }
  const h2 = (await loadRows("hydrogen").catch(() => null)) ?? [];
  out.push(e(listPath("charge", "h2"), 0.7));
  for (const s of SIDO) if (h2.some((r) => r.sido === s.slug)) out.push(e(listPath("charge", "h2", s.slug), 0.6));
  return out;
}

async function pages(): Promise<UrlEntry[]> {
  const menu = [...NAV.map((x) => x.href), ...NAV.flatMap((x) => x.children ?? []).map((c) => c.href)];
  const seen = new Set<string>();
  return [
    e("/", 1, "daily"),
    ...menu.map((href) => e(href, 0.9, "daily")),
    ...(await regionPages()),
    ...GUIDES.map((g) => e(`/guide/${g.slug}`, 0.7, "monthly")),
    ...SITE_LINKS.map((l) => e(l.href, 0.3, "yearly")),
  ].filter((x) => (seen.has(x.loc) ? false : (seen.add(x.loc), true)));
}

async function details(): Promise<UrlEntry[]> {
  const out: UrlEntry[] = [];
  for (const d of Object.keys(FILE_PATHS) as Array<keyof typeof FILE_PATHS>) {
    const rows = await loadRows(d).catch(() => null);
    for (const r of rows ?? []) out.push({ loc: absoluteUrl(FILE_PATHS[d](r.key)), changefreq: "monthly", priority: 0.5 });
  }
  return out;
}

async function placeDetails(dataset: PlaceDataset, part: number): Promise<UrlEntry[]> {
  const rows = await listPlaceKeys(dataset, (part - 1) * CHUNK, CHUNK);
  return rows.map((r) => ({
    loc: absoluteUrl(PLACE_PATHS[dataset](r.sido, r.key)),
    lastmod: r.syncedAt?.slice(0, 10),
    changefreq: "monthly",
    priority: 0.6,
  }));
}

/** 인덱스에 실을 하위 사이트맵 이름들 */
export async function sitemapNames(): Promise<string[]> {
  const names = ["pages.xml", "details.xml"];
  for (const d of Object.keys(PLACE_PATHS) as PlaceDataset[]) {
    const total = await countPlaces(d).catch(() => CHUNK);
    for (let i = 1; i <= Math.max(1, Math.ceil(total / CHUNK)); i++) names.push(`${d}-${i}.xml`);
  }
  return names;
}

/** 하위 사이트맵 하나의 주소들. 모르는 이름이면 null */
export async function sitemapEntries(name: string): Promise<UrlEntry[] | null> {
  if (name === "pages.xml") return pages();
  if (name === "details.xml") return details();
  const m = name.match(/^(parking|inspection|repair)-(\d+)\.xml$/);
  if (!m) return null;
  const rows = await placeDetails(m[1] as PlaceDataset, Number(m[2]));
  return rows.length ? rows : null;
}

export function sitemapIndexXml(names: string[]) {
  const items = names.map((x) => `<sitemap><loc>${absoluteUrl(`/sitemap/${x}`)}</loc></sitemap>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
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
