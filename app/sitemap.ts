import type { MetadataRoute } from "next";
import { SIDO } from "@/lib/codes";
import { GUIDES } from "@/lib/guides";
import { NAV } from "@/lib/menu";
import { absoluteUrl } from "@/lib/seo";
import { withQuery } from "@/lib/url";

/**
 * 1depth 카테고리, 시도별 목록, 가이드를 싣는다.
 * 개별 상세(2depth)는 수만 건이라 목록 페이지의 링크로 수집되게 둔다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entry = (path: string, priority: number, changeFrequency: "daily" | "weekly" | "monthly" = "weekly") => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency,
    priority,
  });
  return [
    entry("/", 1, "daily"),
    ...NAV.map((n) => entry(n.href, 0.9, "daily")),
    ...NAV.flatMap((n) => n.children ?? []).map((c) => entry(c.href, 0.8)),
    ...SIDO.flatMap((s) => [
      entry(withQuery("/charge", { type: "ev", sido: s.slug }), 0.7, "daily"),
      entry(withQuery("/parking", { sido: s.slug }), 0.7),
      entry(withQuery("/repair", { type: "shop", sido: s.slug }), 0.6),
      entry(withQuery("/repair", { type: "inspection", sido: s.slug }), 0.6),
    ]),
    ...GUIDES.map((g) => entry(`/guide/${g.slug}`, 0.7, "monthly")),
    entry("/about", 0.3, "monthly"),
  ];
}
