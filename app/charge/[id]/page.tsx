import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findSigunguByZscode } from "@/lib/codes";
import { getStationsByRegion, type EvStation } from "@/lib/ev";
import { findRow, loadRows, type Row } from "@/lib/datasets";
import { attempt } from "@/lib/errors";
import { ymdhm } from "@/lib/format";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { evArticle, hydrogenArticle } from "@/lib/content/charge";
import { placeJsonLd, webPageJsonLd } from "@/lib/content/jsonld";
import ArticleBody, { ArticleLead, JsonLd } from "@/components/article/ArticleBody";
import AdSlot from "@/components/ads/AdSlot";
import { withQuery } from "@/lib/url";
import Crumbs from "@/components/common/Crumbs";
import DetailView from "@/components/common/DetailView";
import StatTiles from "@/components/common/StatTiles";
import { ErrorNotice, SOURCES, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

type Params = { id: string };

type Resolved =
  | {
      kind: "ev";
      station: EvStation | null;
      all: EvStation[];
      error: string | null;
      region: NonNullable<ReturnType<typeof findSigunguByZscode>>;
    }
  | { kind: "h2"; row: Row };

/** id: ev-<zscode>-<statId> 또는 h2-<key> */
async function resolve(id: string): Promise<Resolved | null> {
  const ev = id.match(/^ev-(\d{5})-([A-Za-z0-9]{2,20})$/);
  if (ev) {
    const region = findSigunguByZscode(ev[1]);
    if (!region) return null;
    // 상세도 시군구 목록(캐시 공유)에서 찾는다. 주변 충전소·지역 통계에 목록을 함께 쓴다
    const { data, error } = await attempt(getStationsByRegion(region.gu.zscodes));
    return { kind: "ev", station: data?.find((s) => s.id === ev[2]) ?? null, all: data ?? [], error, region };
  }
  const h2 = id.match(/^h2-([a-z0-9]+)$/);
  if (h2) {
    const found = await findRow("hydrogen", h2[1]);
    return found ? { kind: "h2", row: found.row } : null;
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const r = await resolve(id);
  if (!r) return {};
  if (r.kind === "ev") {
    if (!r.station) return {};
    const fast = r.station.chargers.filter((c) => c.fast).length;
    return buildMetadata({
      path: `/charge/${id}`,
      title: `${r.station.name} 전기차 충전소 - 급속 ${fast}대·완속 ${r.station.chargers.length - fast}대 실시간 상태 (${r.region.sido.short} ${r.region.gu.name})`,
      description: `${r.station.address} ${r.station.name}. 급속 ${fast}대, 완속 ${r.station.chargers.length - fast}대, 운영기관 ${r.station.operator}. 충전 시간·요금 예상과 주변 충전소를 정리했습니다.`.slice(0, 155),
      keywords: [`${r.station.name} 충전소`, `${r.region.gu.name} 전기차 충전소`, `${r.region.gu.name} 급속 충전`],
    });
  }
  return buildMetadata({
    path: `/charge/${id}`,
    title: `${r.row.name} - 수소충전소 운영시간·위치·충전 가능 차량`,
    description: `${r.row.address ?? ""} ${r.row.name}. ${r.row.tags.join(", ")}. 운영 시간, 공급 방식, 가까운 수소충전소를 정리했습니다.`.slice(0, 155),
    keywords: [`${r.row.name}`, "수소충전소", "수소차 충전"],
  });
}

export default async function ChargeDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const r = await resolve(id);
  if (!r) notFound();

  if (r.kind === "h2") {
    const row = r.row;
    const all = (await loadRows("hydrogen")) ?? [row];
    const article = hydrogenArticle(row, all);
    const path = `/charge/${id}`;
    const title = `${row.name} 수소충전소`;
    const description = `${row.address ?? ""} ${row.name} 수소충전소 운영 시간과 공급 방식.`;
    return (
      <>
        <JsonLd
          data={[
            webPageJsonLd(path, title, description, `${absoluteUrl(path)}#place`),
            placeJsonLd({
              type: ["AutomotiveBusiness", "LocalBusiness"],
              path,
              name: row.name,
              description,
              row,
              address: row.address,
              lat: row.lat,
              lng: row.lng,
              tel: row.tel,
              extra: { additionalType: "https://www.wikidata.org/wiki/Q1418461" },
            }),
          ]}
        />
        <AdSlot slot="top" />
        <Crumbs
          trail={[
            { name: "충전", path: "/charge" },
            { name: "수소 충전소", path: "/charge?type=h2" },
            { name: row.name, path },
          ]}
        />
        <div className="page-head">
          <h1>💧 {row.name}</h1>
          <p>{row.address}</p>
        </div>
        <AdSlot slot="title" />
        <ArticleLead article={article} />
        <DetailView info={row.info} name={row.name} address={row.address} lat={row.lat} lng={row.lng} tel={row.tel} />
        <ArticleBody article={article} />
        <SourceNote source={SOURCES.hydrogen} />
      </>
    );
  }

  const { station, error, region, all } = r;
  const listHref = withQuery("/charge", { type: "ev", sido: region.sido.slug, gu: region.gu.code });
  const trail = [
    { name: "충전", path: "/charge" },
    { name: `${region.sido.short} ${region.gu.name}`, path: listHref },
    { name: station?.name ?? "충전소", path: `/charge/${id}` },
  ];
  if (error) {
    return (
      <>
        <Crumbs trail={trail} />
        <ErrorNotice message={error} />
      </>
    );
  }
  if (!station) notFound();

  const fast = station.chargers.filter((c) => c.fast).length;
  const available = station.chargers.filter((c) => c.state === "available").length;
  const charging = station.chargers.filter((c) => c.state === "charging").length;
  const article = evArticle(station, region, all);
  const path = `/charge/${id}`;
  const description = `${station.address} ${station.name} 전기차 충전소. 급속 ${fast}대, 완속 ${station.chargers.length - fast}대.`;
  const jsonLd = [
    webPageJsonLd(path, `${station.name} 전기차 충전소`, description, `${absoluteUrl(path)}#place`),
    placeJsonLd({
      type: ["AutomotiveBusiness", "LocalBusiness"],
      path,
      name: station.name,
      description,
      address: station.address,
      region: region.sido.name,
      locality: region.gu.name,
      lat: station.lat,
      lng: station.lng,
      tel: station.operatorTel,
      extra: {
        additionalType: "https://www.wikidata.org/wiki/Q2140665",
        amenityFeature: [
          { "@type": "LocationFeatureSpecification", name: "급속 충전기", value: fast },
          { "@type": "LocationFeatureSpecification", name: "완속 충전기", value: station.chargers.length - fast },
          { "@type": "LocationFeatureSpecification", name: "무료 주차", value: station.parkingFree },
        ],
        ...(station.useTime ? { openingHours: station.useTime.includes("24") ? "Mo-Su 00:00-23:59" : undefined } : {}),
        ...(station.operator ? { brand: { "@type": "Organization", name: station.operator } } : {}),
      },
    }),
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <AdSlot slot="top" />
      <Crumbs trail={trail} />
      <div className="page-head">
        <h1>⚡ {station.name}</h1>
        <p>
          {station.address}
          {station.location && ` (${station.location})`}
        </p>
      </div>
      <AdSlot slot="title" />
      <ArticleLead article={article} />

      <StatTiles
        items={[
          { label: "충전기", value: station.chargers.length, unit: "대", note: `급속 ${fast} · 완속 ${station.chargers.length - fast}` },
          { label: "충전 가능", value: available, unit: "대", dot: "var(--st-available)" },
          { label: "충전 중", value: charging, unit: "대", dot: "var(--st-charging)" },
          { label: "최대 출력", value: Math.max(...station.chargers.map((c) => c.output), 0), unit: "kW" },
        ]}
      />

      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-title">충전기 상태</h2>
        </div>
        <div className="panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>번호</th>
                  <th>상태</th>
                  <th>구분</th>
                  <th>규격</th>
                  <th className="r">출력</th>
                  <th>상태 갱신</th>
                </tr>
              </thead>
              <tbody>
                {station.chargers.map((c) => (
                  <tr key={c.id}>
                    <td>#{c.id}</td>
                    <td>
                      <span className={`charger__state state--${c.state}`}>{c.statName}</span>
                    </td>
                    <td>
                      <span className={c.fast ? "badge badge--fast" : "badge badge--slow"}>{c.fast ? "급속" : "완속"}</span>
                    </td>
                    <td>{c.typeName}</td>
                    <td className="r num">{c.output ? `${c.output}kW` : "-"}</td>
                    <td className="muted">{ymdhm(c.statUpdDt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-title">충전소 정보</h2>
        </div>
        <DetailView
          name={station.name}
          address={station.address}
          lat={station.lat}
          lng={station.lng}
          tel={station.operatorTel}
          info={[
            ["주소", station.address],
            ...(station.location ? ([["상세 위치", station.location]] as Array<[string, string]>) : []),
            ["이용 시간", station.useTime || "-"],
            ["운영기관", station.operator],
            ["주차", station.parkingFree ? "무료" : "유료 또는 미확인"],
            ["이용 제한", station.limited ? station.limitDetail || "있음" : "없음"],
            ...(station.note ? ([["안내", station.note]] as Array<[string, string]>) : []),
            ["전화", station.operatorTel],
          ]}
        />
      </section>
      <ArticleBody article={article} />
      <SourceNote source={SOURCES.ev} extra="충전기 상태는 약 10분 간격으로 갱신되며 실제와 다를 수 있습니다." />
    </>
  );
}
