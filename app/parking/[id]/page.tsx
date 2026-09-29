import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findSido, findSigungu } from "@/lib/codes";
import { findPlace, placeContext } from "@/lib/places";
import { buildMetadata } from "@/lib/seo";
import { withQuery } from "@/lib/url";
import { infoOf } from "@/lib/content/common";
import { parkingArticle } from "@/lib/content/parking";
import { openingHours, placeJsonLd, webPageJsonLd } from "@/lib/content/jsonld";
import { absoluteUrl } from "@/lib/seo";
import Crumbs from "@/components/common/Crumbs";
import DetailView from "@/components/common/DetailView";
import { SOURCES, SourceNote } from "@/components/common/Notice";
import ArticleBody, { ArticleLead, JsonLd } from "@/components/article/ArticleBody";
import AdSlot from "@/components/ads/AdSlot";

export const dynamic = "force-dynamic";

type Params = { id: string };

async function load(id: string) {
  const found = await findPlace("parking", id);
  if (!found) return null;
  const sido = findSido(found.sido ?? "");
  const gu = sido && found.row.gu ? findSigungu(sido.slug, found.row.gu) : undefined;
  return { ...found, sidoInfo: sido, guInfo: gu };
}

function describe(row: NonNullable<Awaited<ReturnType<typeof load>>>["row"], region: string) {
  const fee = infoOf(row, "기본 요금") || infoOf(row, "요금");
  const cap = row.num?.capacity;
  return `${region} ${row.name}(${row.sub}) 주차 요금${fee ? ` ${fee}` : ""}, ${infoOf(row, "평일") ? `평일 ${infoOf(row, "평일")}` : "운영시간"}${cap ? `, 주차면 ${cap}면` : ""}. 시간별 예상 요금과 주변 주차장, 위치를 정리했습니다.`.slice(0, 155);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const r = await load(id);
  if (!r) return {};
  const region = [r.sidoInfo?.short, r.guInfo?.name].filter(Boolean).join(" ");
  return buildMetadata({
    path: `/parking/${id}`,
    title: `${r.row.name} 주차 요금·운영시간·위치 (${region})`,
    description: describe(r.row, region),
    keywords: [`${r.row.name}`, `${r.row.name} 주차 요금`, `${region} 주차장`, `${region} 무료 주차장`],
  });
}

export default async function ParkingDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const r = await load(id);
  if (!r) notFound();
  const { row, sidoInfo, guInfo } = r;
  const ctx = await placeContext("parking", row).catch(() => ({ nearby: [], total: 0, flagCounts: {}, rows: [] }));
  const article = parkingArticle({ row, id, sido: sidoInfo, gu: guInfo, ctx });
  const region = [sidoInfo?.short, guInfo?.name].filter(Boolean).join(" ");
  const path = `/parking/${id}`;
  const description = describe(row, region);
  const free = row.flags.includes("free");

  const place = placeJsonLd({
    type: "ParkingFacility",
    path,
    name: row.name,
    description,
    row,
    address: row.address,
    region: sidoInfo?.name,
    locality: guInfo?.name,
    lat: row.lat,
    lng: row.lng,
    tel: row.tel,
    extra: {
      isAccessibleForFree: free,
      ...(row.num?.capacity ? { maximumAttendeeCapacity: row.num.capacity } : {}),
      openingHoursSpecification: openingHours(infoOf(row, "평일"), infoOf(row, "토요일"), infoOf(row, "공휴일")),
      ...(infoOf(row, "결제 방법") ? { paymentAccepted: infoOf(row, "결제 방법") } : {}),
      ...(row.flags.includes("disabled")
        ? { amenityFeature: [{ "@type": "LocationFeatureSpecification", name: "장애인 전용 주차구역", value: true }] }
        : {}),
    },
  });

  return (
    <>
      <JsonLd data={[webPageJsonLd(path, `${row.name} 주차 요금·운영시간·위치`, description, `${absoluteUrl(path)}#place`), place]} />
      <AdSlot slot="top" />
      <Crumbs
        trail={[
          { name: "주차", path: "/parking" },
          ...(sidoInfo
            ? [{ name: region, path: withQuery("/parking", { sido: sidoInfo.slug, gu: guInfo?.code }) }]
            : []),
          { name: row.name, path },
        ]}
      />
      <div className="page-head">
        <h1>🅿️ {row.name}</h1>
        <p>
          {row.sub && <span className="badge" style={{ marginRight: 6 }}>{row.sub}</span>}
          {row.address}
        </p>
      </div>
      <AdSlot slot="title" />
      <ArticleLead article={article} />
      <DetailView info={row.info} name={row.name} address={row.address} lat={row.lat} lng={row.lng} tel={row.tel} />
      <ArticleBody article={article} />
      <SourceNote source={SOURCES.parking} extra="요금·운영시간은 관리기관 사정에 따라 바뀔 수 있으니 방문 전 확인하세요." />
    </>
  );
}
