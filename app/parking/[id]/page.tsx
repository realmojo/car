import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findSido, findSigungu } from "@/lib/codes";
import { findPlace } from "@/lib/places";
import { buildMetadata } from "@/lib/seo";
import { withQuery } from "@/lib/url";
import Crumbs from "@/components/common/Crumbs";
import DetailView from "@/components/common/DetailView";
import { SOURCES, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const found = await findPlace("parking", id);
  if (!found) return {};
  const { row } = found;
  const fee = row.info.find(([k]) => k === "기본 요금")?.[1] ?? row.tags[0] ?? "";
  return buildMetadata({
    path: `/parking/${id}`,
    title: `${row.name} - 주차 요금·운영시간·위치`,
    description: `${row.address} ${row.name}(${row.sub}). ${fee} ${row.tags.join(", ")}`.trim(),
  });
}

export default async function ParkingDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const found = await findPlace("parking", id);
  if (!found) notFound();
  const { row, sido } = found;
  const sidoInfo = findSido(sido ?? "");
  const guInfo = sidoInfo && row.gu ? findSigungu(sidoInfo.slug, row.gu) : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ParkingFacility",
    name: row.name,
    address: row.address,
    ...(row.lat && row.lng ? { geo: { "@type": "GeoCoordinates", latitude: row.lat, longitude: row.lng } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <Crumbs
        trail={[
          { name: "주차", path: "/parking" },
          ...(sidoInfo
            ? [{ name: `${sidoInfo.short}${guInfo ? ` ${guInfo.name}` : ""}`, path: withQuery("/parking", { sido: sidoInfo.slug, gu: guInfo?.code }) }]
            : []),
          { name: row.name, path: `/parking/${id}` },
        ]}
      />
      <div className="page-head">
        <h1>🅿️ {row.name}</h1>
        <p>
          {row.sub && <span className="badge" style={{ marginRight: 6 }}>{row.sub}</span>}
          {row.address}
        </p>
      </div>
      <DetailView info={row.info} name={row.name} address={row.address} lat={row.lat} lng={row.lng} tel={row.tel} />
      <SourceNote source={SOURCES.parking} extra="요금·운영시간은 관리기관 사정에 따라 바뀔 수 있으니 방문 전 확인하세요." />
    </>
  );
}
