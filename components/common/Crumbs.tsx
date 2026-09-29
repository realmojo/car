import { breadcrumbJsonLd } from "@/lib/seo";

/** 경로 표시 + BreadcrumbList JSON-LD */
export default function Crumbs({ trail }: { trail: Array<{ name: string; path: string }> }) {
  const full = [{ name: "홈", path: "/" }, ...trail];
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd(full)) }}
      />
      <nav className="crumbs" aria-label="현재 위치">
        {full.map((c, i) => (
          <span key={c.path} style={{ display: "contents" }}>
            {i > 0 && <span aria-hidden>›</span>}
            {i < full.length - 1 ? (
              <a target="_self" href={c.path}>{c.name}</a>
            ) : (
              <span aria-current="page">{c.name}</span>
            )}
          </span>
        ))}
      </nav>
    </>
  );
}
