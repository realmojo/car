import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findSido, findSigungu } from "@/lib/codes";
import { findRow, loadRows, type Row } from "@/lib/datasets";
import { findPlace, placeContext, type PlaceContext } from "@/lib/places";
import { absoluteUrl, buildMetadata } from "@/lib/seo";
import { listPath } from "@/lib/url";
import { SECTION_HOME } from "@/lib/lists";
import { infoOf, type Article } from "@/lib/content/common";
import { inspectionArticle, recallArticle, shopArticle } from "@/lib/content/repair";
import { articleJsonLd, placeJsonLd, webPageJsonLd } from "@/lib/content/jsonld";
import Crumbs from "@/components/common/Crumbs";
import DetailView from "@/components/common/DetailView";
import { SOURCES, SourceNote } from "@/components/common/Notice";
import ArticleBody, { ArticleLead, JsonLd } from "@/components/article/ArticleBody";
import AdSlot from "@/components/ads/AdSlot";

export const dynamic = "force-dynamic";

type Params = { id: string };

const KINDS = {
  shop: { dataset: "repair", label: "정비소", type: "shop", source: SOURCES.repair, icon: "🔧" },
  insp: { dataset: "inspection", label: "자동차 검사소", type: "inspection", source: SOURCES.inspection, icon: "🔍" },
  recall: { dataset: "recall", label: "리콜", type: "recall", source: SOURCES.recall, icon: "⚠️" },
} as const;

const EMPTY_CTX: PlaceContext = { nearby: [], total: 0, flagCounts: {}, rows: [] };

/** id: shop-<sido>-<key> / insp-<sido>-<key> / recall-<key> */
async function resolve(id: string) {
  const m = id.match(/^(shop|insp|recall)-(.+)$/);
  if (!m) return null;
  const kind = KINDS[m[1] as keyof typeof KINDS];
  // 정비소·검사소는 Supabase, 리콜은 DB 전체 목록
  const found = kind.dataset === "recall" ? await findRow("recall", m[2]) : await findPlace(kind.dataset, m[2]);
  return found ? { kind, ...found } : null;
}

function titleOf(kind: (typeof KINDS)[keyof typeof KINDS], row: Row, region: string) {
  if (kind.type === "recall") return `${row.sub} ${row.name} 리콜 - 결함 내용과 무상 수리 방법`;
  if (kind.type === "inspection") return `${row.name} - 자동차 검사소 운영시간·검사 종류 (${region})`;
  return `${row.name} - ${row.sub || "정비소"} 위치·운영시간·전화 (${region})`;
}

function describe(kind: (typeof KINDS)[keyof typeof KINDS], row: Row, region: string) {
  if (kind.type === "recall") {
    return `${row.sub} ${row.name} 리콜(개시일 ${infoOf(row, "리콜 개시일") || "미상"}). ${infoOf(row, "리콜 사유")}`.slice(0, 155);
  }
  const hours = infoOf(row, "운영 시간");
  return `${region} ${row.name}(${row.sub || kind.label}). ${row.address ?? ""}${hours ? `, 운영시간 ${hours}` : ""}. 주변 ${kind.label}와 이용 방법을 정리했습니다.`.slice(0, 155);
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const r = await resolve(id);
  if (!r) return {};
  const sido = r.sido ? findSido(r.sido) : undefined;
  const gu = sido && r.row.gu ? findSigungu(sido.slug, r.row.gu) : undefined;
  const region = [sido?.short, gu?.name].filter(Boolean).join(" ");
  return buildMetadata({
    path: `/repair/${id}`,
    title: titleOf(r.kind, r.row, region),
    description: describe(r.kind, r.row, region),
    keywords:
      r.kind.type === "recall"
        ? [`${r.row.name} 리콜`, `${r.row.sub} 리콜`, "자동차 리콜 조회"]
        : [r.row.name, `${region} ${r.kind.label}`, `${r.row.name} 전화번호`],
  });
}

export default async function RepairDetailPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const r = await resolve(id);
  if (!r) notFound();
  const { kind, row, sido } = r;
  const sidoInfo = sido ? findSido(sido) : undefined;
  const guInfo = sidoInfo && row.gu ? findSigungu(sidoInfo.slug, row.gu) : undefined;
  const region = [sidoInfo?.short, guInfo?.name].filter(Boolean).join(" ");
  const listHref = kind.type === "recall" ? "/repair?type=recall" : listPath("repair", kind.type, sidoInfo?.slug, guInfo?.code);
  const path = `/repair/${id}`;
  const title = titleOf(kind, row, region);
  const description = describe(kind, row, region);

  let article: Article;
  let ld: object;
  if (kind.type === "recall") {
    article = recallArticle(row, (await loadRows("recall")) ?? []);
    const date = infoOf(row, "리콜 개시일");
    ld = articleJsonLd({
      path,
      title,
      description,
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
      about: { "@type": "Car", name: row.name, manufacturer: { "@type": "Organization", name: row.sub } },
    });
  } else {
    const ctx = await placeContext(kind.dataset, row).catch(() => EMPTY_CTX);
    const args = { row, id, sido: sidoInfo, gu: guInfo, ctx };
    article = kind.type === "inspection" ? inspectionArticle(args) : shopArticle(args);
    ld = placeJsonLd({
      type: kind.type === "inspection" ? ["AutomotiveBusiness", "LocalBusiness"] : "AutoRepair",
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
    });
  }

  return (
    <>
      <JsonLd data={[webPageJsonLd(path, title, description, `${absoluteUrl(path)}#${kind.type === "recall" ? "article" : "place"}`), ld]} />
      <AdSlot slot="top" />
      <Crumbs
        trail={[
          { name: "정비", path: SECTION_HOME.repair.path },
          { name: `${kind.label}${region ? ` · ${region}` : ""}`, path: listHref },
          { name: row.name, path },
        ]}
      />
      <div className="page-head">
        <h1>
          {kind.icon} {kind.type === "recall" ? `${row.sub} ${row.name} 리콜` : row.name}
        </h1>
        <p>
          {row.sub && kind.type !== "recall" && <span className="badge" style={{ marginRight: 6 }}>{row.sub}</span>}
          {kind.type === "recall" ? "리콜 대상 차량과 결함 내용, 무상 수리 방법입니다." : row.address}
        </p>
      </div>
      <AdSlot slot="title" />
      <ArticleLead article={article} />
      <DetailView
        info={row.info}
        name={row.name}
        address={kind.type === "recall" ? undefined : row.address}
        lat={row.lat}
        lng={row.lng}
        tel={row.tel}
      />
      <ArticleBody article={article} />
      <SourceNote source={kind.source} />
    </>
  );
}
