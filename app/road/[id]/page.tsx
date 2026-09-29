import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findRow, type Row } from "@/lib/datasets";
import { distanceKm, getCctvs, splitCctvName, type Cctv } from "@/lib/its";
import { attempt } from "@/lib/errors";
import { buildMetadata } from "@/lib/seo";
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
      title: `${place} CCTV - ${roadName} 실시간 도로 영상`,
      description: `${roadName} ${place} 구간의 실시간 교통 CCTV 영상입니다. 지금 도로 상황과 주변 CCTV를 확인하세요.`,
      keywords: [`${place} CCTV`, `${roadName} CCTV`, `${place} 교통상황`],
    });
  }
  const { row } = r;
  return buildMetadata({
    path: `/road/${id}`,
    title: `${row.name} (${row.sub}) - 휴게소 위치·주차·편의시설`,
    description: `${row.sub} ${row.name}. ${row.info.map(([k, v]) => `${k} ${v}`).join(", ")}`.slice(0, 150),
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
    const { route, place } = splitCctvName(cctv.name);
    const roadName = route || (cctv.road === "ex" ? "고속도로" : "국도");
    // 같은 노선에서 가까운 CCTV (좌표가 없으면 같은 노선 순서대로)
    const nearby = all
      .filter((c) => c.id !== cctv.id && (!route || c.route === route))
      .map((c) => ({ c, d: cctv.lat && c.lat ? distanceKm(cctv, c) : Infinity }))
      .sort((a, b) => a.d - b.d)
      .slice(0, 8);

    return (
      <>
        <Crumbs
          trail={[
            { name: "이동", path: "/road" },
            { name: `${roadName} CCTV`, path: withQuery("/road", { type: "cctv", road: cctv.road, route }) },
            { name: place, path: `/road/${id}` },
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
        {nearby.length > 0 && (
          <section className="sec">
            <div className="sec-head">
              <h2 className="sec-title">주변 CCTV</h2>
            </div>
            <ul className="cctv-grid">
              {nearby.map(({ c, d }) => (
                <li key={c.id}>
                  <a target="_self" href={`/road/cctv-${c.road}-${c.id}`} className="cctv-card">
                    <span className="cctv-card__icon" aria-hidden>
                      📹
                    </span>
                    <span className="cctv-card__name">{splitCctvName(c.name).place}</span>
                    <span className="cctv-card__route">{Number.isFinite(d) ? `${d.toFixed(1)}km` : c.route}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        <SourceNote source={SOURCES.cctv} extra="영상은 국가교통정보센터가 제공하는 실시간 스트리밍이며 끊기거나 지연될 수 있습니다." />
      </>
    );
  }

  const { row } = r;
  const route = row.info.find(([k]) => k === "노선")?.[1];
  return (
    <>
      <Crumbs
        trail={[
          { name: "이동", path: "/road" },
          { name: route ? `${route} 휴게소` : "휴게소", path: withQuery("/road", { type: "rest", route }) },
          { name: row.name, path: `/road/${id}` },
        ]}
      />
      <div className="page-head">
        <h1>🛣️ {row.name}</h1>
        <p>{row.sub}</p>
      </div>
      <DetailView info={row.info} name={row.name} address={row.address} lat={row.lat} lng={row.lng} tel={row.tel} />
      <SourceNote source={SOURCES.rest} />
    </>
  );
}
