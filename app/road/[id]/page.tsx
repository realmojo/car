import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findRow } from "@/lib/datasets";
import { buildMetadata } from "@/lib/seo";
import { withQuery } from "@/lib/url";
import Crumbs from "@/components/common/Crumbs";
import DetailView from "@/components/common/DetailView";
import { SOURCES, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

type Params = { id: string };

async function resolve(id: string) {
  const m = id.match(/^rest-([a-z0-9]+)$/);
  return m ? findRow("rest", m[1]) : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const found = await resolve(id);
  if (!found) return {};
  const { row } = found;
  return buildMetadata({
    path: `/road/${id}`,
    title: `${row.name} (${row.sub}) - 휴게소 위치·주차·편의시설 | 김군카`,
    description: `${row.sub} ${row.name}. ${row.info.map(([k, v]) => `${k} ${v}`).join(", ")}`.slice(0, 150),
  });
}

export default async function RoadDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const found = await resolve(id);
  if (!found) notFound();
  const { row } = found;
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
