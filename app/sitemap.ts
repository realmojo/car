import type { MetadataRoute } from "next";
import { SIDO, SIGUNGU } from "@/lib/codes";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPaths = ["/", "/fuel", "/fuel/nearby", "/ev", "/calculator", "/about"];
  return [
    ...staticPaths.map((p) => ({ url: absoluteUrl(p), lastModified: now, changeFrequency: "daily" as const, priority: p === "/" ? 1 : 0.8 })),
    ...SIDO.map((s) => ({ url: absoluteUrl(`/fuel/${s.slug}`), lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
    ...SIDO.map((s) => ({ url: absoluteUrl(`/ev/${s.slug}`), lastModified: now, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...SIDO.flatMap((s) =>
      (SIGUNGU[s.slug] ?? []).map((g) => ({
        url: absoluteUrl(`/ev/${s.slug}/${g.code}`),
        lastModified: now,
        changeFrequency: "daily" as const,
        priority: 0.5,
      })),
    ),
  ];
}
