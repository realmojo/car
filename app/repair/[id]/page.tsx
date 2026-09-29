import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findSido, findSigungu } from "@/lib/codes";
import { findRow, type DatasetId, type Row } from "@/lib/datasets";
import { buildMetadata } from "@/lib/seo";
import { withQuery } from "@/lib/url";
import Crumbs from "@/components/common/Crumbs";
import DetailView from "@/components/common/DetailView";
import { SOURCES, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

type Params = { id: string };

const KINDS = {
  shop: { dataset: "repair", label: "정비소", type: "shop", source: SOURCES.repair, icon: "🔧" },
  insp: { dataset: "inspection", label: "자동차 검사소", type: "inspection", source: SOURCES.inspection, icon: "🔍" },
  recall: { dataset: "recall", label: "리콜", type: "recall", source: SOURCES.recall, icon: "⚠️" },
} as const;

/** id: shop-<sido>-<key> / insp-<sido>-<key> / recall-<key> */
async function resolve(id: string) {
  const m = id.match(/^(shop|insp|recall)-(.+)$/);
  if (!m) return null;
  const kind = KINDS[m[1] as keyof typeof KINDS];
  const found = await findRow(kind.dataset as DatasetId, m[2]);
  return found ? { kind, ...found } : null;
}

function describe(row: Row) {
  return row.info
    .slice(0, 4)
    .map(([k, v]) => `${k} ${v}`)
    .join(", ");
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const r = await resolve(id);
  if (!r) return {};
  const title =
    r.kind.type === "recall"
      ? `${r.row.sub} ${r.row.name} 리콜 - 결함 내용과 시정 방법`
      : `${r.row.name} - ${r.kind.label} 위치·연락처·운영시간`;
  return buildMetadata({ path: `/repair/${id}`, title, description: describe(r.row).slice(0, 150) });
}

export default async function RepairDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const r = await resolve(id);
  if (!r) notFound();
  const { kind, row, sido } = r;
  const sidoInfo = sido ? findSido(sido) : undefined;
  const guInfo = sidoInfo && row.gu ? findSigungu(sidoInfo.slug, row.gu) : undefined;
  const listHref = withQuery("/repair", { type: kind.type, sido: sidoInfo?.slug, gu: guInfo?.code });

  return (
    <>
      <Crumbs
        trail={[
          { name: "정비", path: "/repair" },
          { name: `${kind.label}${sidoInfo ? ` · ${sidoInfo.short}${guInfo ? ` ${guInfo.name}` : ""}` : ""}`, path: listHref },
          { name: row.name, path: `/repair/${id}` },
        ]}
      />
      <div className="page-head">
        <h1>
          {kind.icon} {kind.type === "recall" ? `${row.sub} ${row.name}` : row.name}
        </h1>
        <p>
          {row.sub && kind.type !== "recall" && <span className="badge" style={{ marginRight: 6 }}>{row.sub}</span>}
          {kind.type === "recall" ? "리콜 대상 차량과 결함 내용, 시정 방법입니다." : row.address}
        </p>
      </div>
      <DetailView
        info={row.info}
        name={row.name}
        address={kind.type === "recall" ? undefined : row.address}
        lat={row.lat}
        lng={row.lng}
        tel={row.tel}
      />
      {kind.type === "recall" && (
        <p className="source-note">
          내 차가 대상인지는 차량번호로{" "}
          <a href="https://www.car.go.kr" target="_blank" rel="noopener noreferrer">
            자동차리콜센터
          </a>
          에서 확인할 수 있습니다. 리콜 수리는 무상입니다.
        </p>
      )}
      <SourceNote source={kind.source} />
    </>
  );
}
