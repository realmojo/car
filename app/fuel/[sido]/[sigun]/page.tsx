import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLowestStations, getSigunAvg } from "@/lib/opinet";
import { attempt } from "@/lib/errors";
import { findProduct, findSido } from "@/lib/codes";
import { won } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";
import Crumbs from "@/components/common/Crumbs";
import StationList from "@/components/fuel/StationList";
import ProductChips from "@/components/fuel/ProductChips";
import { Diff } from "@/components/fuel/PriceTiles";
import { ErrorNotice, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

type Params = { sido: string; sigun: string };

async function resolve(p: Params) {
  const sido = findSido(p.sido);
  if (!sido || !/^\d{4}$/.test(p.sigun) || !p.sigun.startsWith(sido.opinet)) return null;
  // 시군구 이름은 오피넷 시군구 평균가 목록에서 가져온다 (캐시 공유)
  const list = await attempt(getSigunAvg(sido.opinet, "B027"));
  const sigun = list.data?.find((s) => s.code === p.sigun);
  return { sido, sigunCode: p.sigun, sigunName: sigun?.name ?? "" };
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const r = await resolve(await params);
  if (!r || !r.sigunName) return {};
  const area = `${r.sido.short} ${r.sigunName}`;
  return buildMetadata({
    path: `/fuel/${r.sido.slug}/${r.sigunCode}`,
    title: `${area} 최저가 주유소 - 휘발유·경유 가격 순위 | 김군카`,
    description: `${area} 주유소 휘발유·경유·LPG 최저가 순위와 평균 가격을 오피넷 데이터로 확인하세요.`,
    keywords: [`${area} 주유소`, `${r.sigunName} 최저가 주유소`, `${r.sigunName} 기름값`],
  });
}

export default async function SigunFuelPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<{ prodcd?: string }>;
}) {
  const r = await resolve(await params);
  if (!r) notFound();
  const { sido, sigunCode, sigunName } = r;
  const product = findProduct((await searchParams).prodcd);

  const [lowest, avg] = await Promise.all([
    attempt(getLowestStations(sigunCode, product.code, 20)),
    attempt(getSigunAvg(sido.opinet, product.code)),
  ]);
  const mine = avg.data?.find((a) => a.code === sigunCode);
  const title = sigunName || "시군구";

  return (
    <>
      <Crumbs
        trail={[
          { name: "유가 정보", path: "/fuel" },
          { name: sido.short, path: `/fuel/${sido.slug}` },
          { name: title, path: `/fuel/${sido.slug}/${sigunCode}` },
        ]}
      />
      <div className="page-head">
        <h1>
          ⛽ {sido.short} {title} 최저가 주유소
        </h1>
        <p>
          {mine ? (
            <>
              {title} {product.short} 평균 <strong className="num" style={{ color: "#fff" }}>{won(mine.price, 2)}원</strong>{" "}
              (<Diff value={mine.diff} /> 전일 대비)
            </>
          ) : (
            `${title}에서 ${product.short} 가격이 가장 싼 주유소입니다.`
          )}
        </p>
      </div>

      <ProductChips basePath={`/fuel/${sido.slug}/${sigunCode}`} current={product.code} />
      {lowest.data ? <StationList items={lowest.data} /> : <ErrorNotice message={lowest.error ?? ""} />}
      <SourceNote kind="fuel" />
    </>
  );
}
