import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findRow, loadRows, type Row } from "@/lib/datasets";
import { getCctvs, getRoadEvents, splitCctvName, type Cctv } from "@/lib/its";
import { attempt } from "@/lib/errors";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { cctvArticle, restArticle } from "@/lib/content/road";
import { placeJsonLd, webPageJsonLd } from "@/lib/content/jsonld";
import ArticleBody, { ArticleLead, JsonLd } from "@/components/article/ArticleBody";
import AdSlot from "@/components/ads/AdSlot";
import { withQuery } from "@/lib/url";
import Crumbs from "@/components/common/Crumbs";
import DetailView from "@/components/common/DetailView";
import CctvPlayer from "@/components/road/CctvPlayer";
import { ErrorNotice, SOURCES, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

type Params = { id: string };

type Resolved =
  | { kind: "rest"; row: Row }
  | { kind: "cctv"; cctv: Cctv; all: Cctv[] }
  | { kind: "cctv-error"; error: string };

/** id: rest-<key> 또는 cctv-<ex|its>-<id> */
async function resolve(id: string): Promise<Resolved | null> {
  const rest = id.match(/^rest-([a-z0-9]+)$/);
  if (rest) {
    const found = await findRow("rest", rest[1]);
    return found ? { kind: "rest", row: found.row } : null;
  }
  const cctv = id.match(/^cctv-(ex|its)-([a-z0-9]+)$/);
  if (cctv) {
    const { data, error } = await attempt(getCctvs(cctv[1] as "ex" | "its"));
    if (error || !data) return { kind: "cctv-error", error: error ?? "" };
    const found = data.find((c) => c.id === cctv[2]);
    return found ? { kind: "cctv", cctv: found, all: data } : null;
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const r = await resolve(id);
  if (!r || r.kind === "cctv-error") return {};
  if (r.kind === "cctv") {
    const { route, place } = splitCctvName(r.cctv.name);
    const roadName = route || (r.cctv.road === "ex" ? "고속도로" : "국도");
    return buildMetadata({
      path: `/road/${id}`,
      title: `${place} CCTV - ${roadName} 실시간 교통 영상·돌발상황`,
      description: `${roadName} ${place} 구간의 실시간 교통 CCTV 영상입니다. 지금 이 도로의 돌발상황, 주변 CCTV, 날씨별 운전 요령을 함께 확인하세요.`,
      keywords: [`${place} CCTV`, `${roadName} CCTV`, `${place} 교통상황`],
    });
  }
  const { row } = r;
  return buildMetadata({
    path: `/road/${id}`,
    title: `${row.name} (${row.sub}) - 위치·주차·편의시설·주변 휴게소`,
    description: `${row.sub} ${row.name}. ${row.info.map(([k, v]) => `${k} ${v}`).join(", ")}`.slice(0, 150),
    keywords: [row.name, `${row.name} 위치`, `${row.info.find(([k]) => k === "노선")?.[1] ?? "고속도로"} 휴게소`],
  });
}

export default async function RoadDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const r = await resolve(id);
  if (!r) notFound();

  if (r.kind === "cctv-error") {
    return (
      <>
        <Crumbs trail={[{ name: "이동", path: "/road" }, { name: "CCTV", path: "/road?type=cctv" }]} />
        <ErrorNotice message={r.error} />
      </>
    );
  }

  if (r.kind === "cctv") {
    const { cctv, all } = r;
    const events = (await attempt(getRoadEvents())).data ?? [];
    const article = cctvArticle(cctv, all, events);
    const { route, place } = splitCctvName(cctv.name);
    const roadName = route || (cctv.road === "ex" ? "고속도로" : "국도");
    const path = `/road/${id}`;
    const description = `${roadName} ${place} 구간의 실시간 교통 CCTV 영상.`;
    return (
      <>
        <JsonLd
          data={[
            webPageJsonLd(path, `${place} CCTV - ${roadName} 실시간 교통 영상`, description, `${absoluteUrl(path)}#place`),
            placeJsonLd({
              type: "Place",
              path,
              name: `${place} (${roadName})`,
              description,
              lat: cctv.lat,
              lng: cctv.lng,
              extra: { containedInPlace: { "@type": "Place", name: roadName } },
            }),
          ]}
        />
        <AdSlot slot="top" />
        <Crumbs
          trail={[
            { name: "이동", path: "/road" },
            { name: `${roadName} CCTV`, path: withQuery("/road", { type: "cctv", road: cctv.road, route }) },
            { name: place, path },
          ]}
        />
        <div className="page-head">
          <h1>📹 {place} CCTV</h1>
          <p>
            <span className="badge" style={{ marginRight: 6 }}>
              {cctv.road === "ex" ? "고속도로" : "국도"}
            </span>
            {roadName} · 실시간 영상
          </p>
        </div>
        <AdSlot slot="title" />
        <ArticleLead article={article} />
        <CctvPlayer url={cctv.url} title={cctv.name} />
        <DetailView
          name={cctv.name}
          lat={cctv.lat}
          lng={cctv.lng}
          info={[
            ["CCTV", cctv.name],
            ["도로", `${cctv.road === "ex" ? "고속도로" : "국도"}${route ? ` · ${route}` : ""}`],
            ...(cctv.format ? ([["영상 형식", cctv.format]] as Array<[string, string]>) : []),
          ]}
        />
        <ArticleBody article={article} />
        <SourceNote source={SOURCES.cctv} extra="영상은 국가교통정보센터가 제공하는 실시간 스트리밍이며 끊기거나 지연될 수 있습니다." />
      </>
    );
  }

  const { row } = r;
  const route = row.info.find(([k]) => k === "노선")?.[1];
  const article = restArticle(row, (await loadRows("rest")) ?? [row]);
  const path = `/road/${id}`;
  const description = `${row.sub} ${row.name} 위치와 주차, 주변 휴게시설.`;
  return (
    <>
      <JsonLd
        data={[
          webPageJsonLd(path, `${row.name} (${row.sub})`, description, `${absoluteUrl(path)}#place`),
          placeJsonLd({
            type: ["Place", "LocalBusiness"],
            path,
            name: row.name,
            description,
            row,
            address: row.address,
            lat: row.lat,
            lng: row.lng,
            tel: row.tel,
            extra: {
              isAccessibleForFree: true,
              openingHours: "Mo-Su 00:00-23:59",
              ...(route ? { containedInPlace: { "@type": "Place", name: route } } : {}),
            },
          }),
        ]}
      />
      <AdSlot slot="top" />
      <Crumbs
        trail={[
          { name: "이동", path: "/road" },
          { name: route ? `${route} 휴게소` : "휴게소", path: withQuery("/road", { type: "rest", route }) },
          { name: row.name, path },
        ]}
      />
      <div className="page-head">
        <h1>🛣️ {row.name}</h1>
        <p>{row.sub}</p>
      </div>
      <AdSlot slot="title" />
      <ArticleLead article={article} />
      <DetailView info={row.info} name={row.name} address={row.address} lat={row.lat} lng={row.lng} tel={row.tel} />
      <ArticleBody article={article} />
      <SourceNote source={SOURCES.rest} />
    </>
  );
}
