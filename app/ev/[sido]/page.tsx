import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SIDO, SIGUNGU, findSido } from "@/lib/codes";
import { buildMetadata } from "@/lib/seo";
import Crumbs from "@/components/common/Crumbs";
import { SourceNote } from "@/components/common/Notice";

type Params = { sido: string };

export function generateStaticParams() {
  return SIDO.map((s) => ({ sido: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const sido = findSido((await params).sido);
  if (!sido) return {};
  return buildMetadata({
    path: `/ev/${sido.slug}`,
    title: `${sido.short} 전기차 충전소 - 시군구별 급속·완속 충전기 위치 | 김군카`,
    description: `${sido.name} 시군구별 전기차 충전소 위치와 급속·완속 충전기, 충전 가능 여부를 확인하세요.`,
    keywords: [`${sido.short} 전기차 충전소`, `${sido.short} 급속 충전소`, `${sido.short} 충전기`],
  });
}

export default async function EvSidoPage({ params }: { params: Promise<Params> }) {
  const sido = findSido((await params).sido);
  if (!sido) notFound();
  const list = SIGUNGU[sido.slug] ?? [];

  return (
    <>
      <Crumbs
        trail={[
          { name: "전기차 충전소", path: "/ev" },
          { name: sido.short, path: `/ev/${sido.slug}` },
        ]}
      />
      <div className="page-head">
        <h1>⚡ {sido.short} 전기차 충전소</h1>
        <p>{sido.name}의 시군구를 선택하세요.</p>
      </div>
      <div className="region-grid">
        {list.map((g) => (
          <a target="_self" key={g.code} href={`/ev/${sido.slug}/${g.code}`} className="region-card">
            {g.name}
            <small>›</small>
          </a>
        ))}
      </div>

      <section className="sec">
        <div className="bento-grid">
          <a target="_self" href={`/fuel/${sido.slug}`} className="bento-card">
            <div className="bento-card__icon" aria-hidden>⛽</div>
            <div className="bento-card__title">{sido.short} 최저가 주유소</div>
            <p className="bento-card__desc">휘발유·경유·LPG 가격이 가장 싼 주유소를 확인하세요.</p>
          </a>
          <a target="_self" href="/calculator?mode=ev" className="bento-card">
            <div className="bento-card__icon" aria-hidden>🧮</div>
            <div className="bento-card__title">충전비 계산기</div>
            <p className="bento-card__desc">내 전기차의 월 충전 요금을 계산해 보세요.</p>
          </a>
        </div>
        <SourceNote kind="ev" />
      </section>
    </>
  );
}
