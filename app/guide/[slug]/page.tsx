import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findGuide } from "@/lib/guides";
import { loadRows, paginate, type Row } from "@/lib/datasets";
import { buildMetadata } from "@/lib/seo";
import { guideArticle } from "@/lib/content/guides";
import { articleJsonLd } from "@/lib/content/jsonld";
import ArticleBody, { JsonLd } from "@/components/article/ArticleBody";
import AdSlot from "@/components/ads/AdSlot";
import { one, withQuery, type SearchParams } from "@/lib/url";
import Crumbs from "@/components/common/Crumbs";
import Tabs from "@/components/common/Tabs";
import Pager from "@/components/common/Pager";
import Calculator from "@/components/guide/Calculator";
import ChargerGuide from "@/components/guide/ChargerGuide";
import { PendingNotice, SOURCES, SourceNote } from "@/components/common/Notice";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const g = findGuide((await params).slug);
  if (!g) return {};
  return buildMetadata({ path: `/guide/${g.slug}`, title: g.seoTitle, description: g.desc });
}

export default async function GuideDetailPage({ params, searchParams }: { params: Promise<Params>; searchParams: SearchParams }) {
  const g = findGuide((await params).slug);
  if (!g) notFound();
  const sp = await searchParams;
  const needsData = g.slug === "fuel-economy" || g.slug === "ev-range";
  const article = guideArticle(g.slug, needsData ? ((await loadRows("efficiency")) ?? []) : []);

  return (
    <>
      <JsonLd data={articleJsonLd({ path: `/guide/${g.slug}`, title: g.seoTitle, description: g.desc, date: new Date().toISOString().slice(0, 10) })} />
      <AdSlot slot="top" />
      <Crumbs
        trail={[
          { name: "가이드", path: "/guide" },
          { name: g.title, path: `/guide/${g.slug}` },
        ]}
      />
      <div className="page-head">
        <h1>
          {g.icon} {g.title}
        </h1>
        <p>{g.desc}</p>
      </div>
      <AdSlot slot="title" />

      {g.slug === "fuel-economy" && <EfficiencyRanking mode="ice" fuel={one(sp.fuel)} q={one(sp.q)} page={Number(one(sp.page))} />}
      {g.slug === "ev-range" && <EfficiencyRanking mode="ev" fuel="" q={one(sp.q)} page={Number(one(sp.page))} />}
      {g.slug === "calculator" && <Calculator initialMode={one(sp.mode) === "ev" ? "ev" : "fuel"} />}
      {g.slug === "charger-types" && <ChargerTypes />}
      {article && <ArticleBody article={article} />}

    </>
  );
}

const FUEL_TABS = [
  { key: "", label: "전체" },
  { key: "ice", label: "휘발유·경유·LPG" },
  { key: "hybrid", label: "하이브리드" },
];

async function EfficiencyRanking({ mode, fuel, q, page }: { mode: "ice" | "ev"; fuel: string; q: string; page: number }) {
  const rows = await loadRows("efficiency");
  if (!rows) return <PendingNotice />;
  const path = mode === "ev" ? "/guide/ev-range" : "/guide/fuel-economy";
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const metric = mode === "ev" ? "range" : "combined";

  const filtered = rows
    .filter((r) => (mode === "ev" ? r.flags.includes("ev") : !r.flags.includes("ev") && !r.flags.includes("h2")))
    .filter((r) => !fuel || r.flags.includes(fuel))
    .filter((r) => !words.length || words.every((w) => `${r.name} ${r.sub}`.toLowerCase().includes(w)))
    .filter((r) => r.num?.[metric])
    .sort((a, b) => (b.num?.[metric] ?? 0) - (a.num?.[metric] ?? 0));
  const p = paginate(filtered, page, 30);
  const val = (r: Row, label: string) => r.info.find(([k]) => k === label)?.[1] ?? "-";

  return (
    <>
      <form className="region-form" action={path} method="get" role="search">
        {fuel && <input type="hidden" name="fuel" value={fuel} />}
        <input type="search" name="q" defaultValue={q} placeholder="모델명·제조사 검색" aria-label="차량 검색" maxLength={30} />
        <button type="submit">검색</button>
      </form>
      {mode === "ice" && (
        <Tabs
          label="연료"
          items={FUEL_TABS.map((t) => ({ label: t.label, href: withQuery(path, { q, fuel: t.key }), active: t.key === fuel }))}
        />
      )}
      <p className="result-count">
        {p.total.toLocaleString()}개 모델 · {mode === "ev" ? "1회 충전 주행거리" : "복합연비"} 높은 순
      </p>
      <div className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="r">순위</th>
                <th>모델</th>
                <th>제조사</th>
                <th>연료</th>
                {mode === "ev" && <th className="r">주행거리</th>}
                <th className="r">복합</th>
                <th className="r">도심</th>
                <th className="r">고속</th>
                <th className="r">등급</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((r, i) => (
                <tr key={r.key}>
                  <td className="r num">{(p.page - 1) * 30 + i + 1}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 140 }}>
                    <strong>{r.name}</strong>
                  </td>
                  <td>{r.sub}</td>
                  <td>{val(r, "연료")}</td>
                  {mode === "ev" && <td className="r num">{val(r, "1회 충전 주행거리")}</td>}
                  <td className="r num">{val(r, "복합 연비")}</td>
                  <td className="r num">{val(r, "도심 연비")}</td>
                  <td className="r num">{val(r, "고속도로 연비")}</td>
                  <td className="r">{val(r, "에너지소비효율 등급")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pager page={p.page} pages={p.pages} hrefFor={(n) => withQuery(path, { q, fuel, page: n })} />
      <SourceNote
        source={SOURCES.efficiency}
        extra="표시연비는 표준 시험 조건 기준이며 실제 주행 연비는 운전 습관·기온·도로 상황에 따라 달라집니다."
      />
    </>
  );
}

function ChargerTypes() {
  return (
    <>
      <ChargerGuide />
      <p className="source-note">
        주변 충전소의 충전기 규격과 지금 비어 있는 충전기는 <a href="/charge?type=ev">충전소 찾기</a>에서 확인할 수 있습니다.
      </p>
      <SourceNote source={SOURCES.ev} />
    </>
  );
}
