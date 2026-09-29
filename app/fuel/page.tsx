import type { Metadata } from "next";
import { getAvgAllPrice, getLowestStations, getRecentPrices, getSidoAvg } from "@/lib/opinet";
import { attempt } from "@/lib/errors";
import { SIDO, findProduct } from "@/lib/codes";
import { buildMetadata } from "@/lib/seo";
import Crumbs from "@/components/common/Crumbs";
import PriceTiles from "@/components/fuel/PriceTiles";
import TrendChart from "@/components/fuel/TrendChart";
import AreaTable, { sidoHref } from "@/components/fuel/SidoTable";
import StationList from "@/components/fuel/StationList";
import ProductChips from "@/components/fuel/ProductChips";
import { ErrorNotice, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  path: "/fuel",
  title: "오늘 기름값 - 전국 평균 유가·시도별 휘발유 경유 가격 | 김군카",
  description:
    "오늘의 전국 평균 휘발유·경유·LPG 가격과 최근 7일 추이, 시도별 평균 가격, 전국 최저가 주유소를 오피넷 데이터로 확인하세요.",
  keywords: ["오늘 기름값", "전국 평균 유가", "휘발유 가격", "경유 가격", "LPG 가격", "최저가 주유소"],
});

export default async function FuelPage({ searchParams }: { searchParams: Promise<{ prodcd?: string }> }) {
  const product = findProduct((await searchParams).prodcd);
  const [avg, recent, gasoline, diesel, lowest] = await Promise.all([
    attempt(getAvgAllPrice()),
    attempt(getRecentPrices()),
    attempt(getSidoAvg("B027")),
    attempt(getSidoAvg("D047")),
    attempt(getLowestStations("", product.code, 10)),
  ]);

  return (
    <>
      <Crumbs trail={[{ name: "유가 정보", path: "/fuel" }]} />
      <div className="page-head">
        <h1>⛽ 오늘의 유가 정보</h1>
        <p>전국 주유소 평균 판매가격과 최근 흐름, 지역별 가격을 한눈에 비교하세요.</p>
      </div>

      <section className="sec">
        {avg.data ? <PriceTiles items={avg.data} /> : <ErrorNotice message={avg.error ?? ""} />}
      </section>

      {recent.data && recent.data.length > 0 && (
        <section className="sec">
          <div className="sec-head">
            <h2 className="sec-title">최근 7일 가격 추이</h2>
          </div>
          <div className="panel">
            <TrendChart data={recent.data} />
          </div>
        </section>
      )}

      <section className="sec" id="lowest">
        <div className="sec-head">
          <h2 className="sec-title">전국 {product.short} 최저가 TOP 10</h2>
        </div>
        <ProductChips basePath="/fuel" current={product.code} />
        {lowest.data ? <StationList items={lowest.data} /> : <ErrorNotice message={lowest.error ?? ""} />}
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-title">시도별 평균 가격</h2>
        </div>
        {gasoline.data && diesel.data ? (
          <AreaTable gasoline={gasoline.data} diesel={diesel.data} hrefFor={sidoHref} areaLabel="시도" />
        ) : (
          <ErrorNotice message={gasoline.error ?? diesel.error ?? ""} />
        )}
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-title">지역별 최저가 주유소</h2>
        </div>
        <div className="region-grid">
          {SIDO.map((s) => (
            <a target="_self" key={s.slug} href={`/fuel/${s.slug}`} className="region-card">
              {s.short}
              <small>›</small>
            </a>
          ))}
        </div>
        <SourceNote kind="fuel" />
      </section>
    </>
  );
}
