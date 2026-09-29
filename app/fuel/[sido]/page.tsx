import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLowestStations, getSigunAvg } from "@/lib/opinet";
import { attempt } from "@/lib/errors";
import { findProduct, findSido } from "@/lib/codes";
import { buildMetadata } from "@/lib/seo";
import Crumbs from "@/components/common/Crumbs";
import AreaTable from "@/components/fuel/SidoTable";
import StationList from "@/components/fuel/StationList";
import ProductChips from "@/components/fuel/ProductChips";
import { ErrorNotice, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

type Params = { sido: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const sido = findSido((await params).sido);
  if (!sido) return {};
  return buildMetadata({
    path: `/fuel/${sido.slug}`,
    title: `${sido.short} 최저가 주유소 - ${sido.name} 휘발유·경유 가격 | 김군카`,
    description: `${sido.name} 휘발유·경유·LPG 최저가 주유소 순위와 시군구별 평균 기름값을 오피넷 데이터로 확인하세요.`,
    keywords: [`${sido.short} 최저가 주유소`, `${sido.short} 기름값`, `${sido.short} 휘발유 가격`, `${sido.short} 경유 가격`],
  });
}

export default async function SidoFuelPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ prodcd?: string }>;
}) {
  const sido = findSido((await params).sido);
  if (!sido) notFound();
  const product = findProduct((await searchParams).prodcd);

  const [lowest, gasoline, diesel] = await Promise.all([
    attempt(getLowestStations(sido.opinet, product.code, 20)),
    attempt(getSigunAvg(sido.opinet, "B027")),
    attempt(getSigunAvg(sido.opinet, "D047")),
  ]);

  return (
    <>
      <Crumbs
        trail={[
          { name: "유가 정보", path: "/fuel" },
          { name: sido.short, path: `/fuel/${sido.slug}` },
        ]}
      />
      <div className="page-head">
        <h1>⛽ {sido.short} 최저가 주유소</h1>
        <p>
          {sido.name}에서 {product.short} 가격이 가장 싼 주유소 20곳과 시군구별 평균 가격입니다.
        </p>
      </div>

      <section className="sec">
        <ProductChips basePath={`/fuel/${sido.slug}`} current={product.code} />
        {lowest.data ? <StationList items={lowest.data} /> : <ErrorNotice message={lowest.error ?? ""} />}
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-title">시군구별 평균 가격</h2>
        </div>
        <p className="sec-sub">시군구를 누르면 해당 지역의 최저가 주유소를 볼 수 있습니다.</p>
        {gasoline.data && diesel.data ? (
          gasoline.data.length > 0 ? (
            <AreaTable
              gasoline={gasoline.data}
              diesel={diesel.data}
              areaLabel="시군구"
              hrefFor={(r) => `/fuel/${sido.slug}/${r.code}`}
            />
          ) : (
            <div className="empty-box">시군구 평균 가격 정보가 없습니다.</div>
          )
        ) : (
          <ErrorNotice message={gasoline.error ?? diesel.error ?? ""} />
        )}
        <SourceNote kind="fuel" />
      </section>

      <section className="sec">
        <div className="bento-grid">
          <a target="_self" href="/fuel/nearby" className="bento-card">
            <div className="bento-card__icon" aria-hidden>📍</div>
            <div className="bento-card__title">내 주변 주유소</div>
            <p className="bento-card__desc">현재 위치 반경 안의 주유소를 가격순·거리순으로 비교합니다.</p>
          </a>
          <a target="_self" href={`/ev/${sido.slug}`} className="bento-card">
            <div className="bento-card__icon" aria-hidden>⚡</div>
            <div className="bento-card__title">{sido.short} 전기차 충전소</div>
            <p className="bento-card__desc">시군구별 충전소 위치와 지금 비어 있는 충전기를 확인합니다.</p>
          </a>
        </div>
      </section>
    </>
  );
}
