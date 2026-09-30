/**
 * 전기차·수소 충전소 지역 목록 (/charge/ev/<시도>/<시군구>, /charge/h2/<시도>).
 * 전기차는 충전기 상태를 실시간 API 로 시군구 단위로만 조회하므로 전국·시도 화면은 지역 링크만 보여준다.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SIDO, SIGUNGU } from "@/lib/codes";
import { filterRows, loadRows, paginate, rowId } from "@/lib/datasets";
import { attempt } from "@/lib/errors";
import { getStationsByRegion, summarize } from "@/lib/ev";
import { SECTION_HOME } from "@/lib/lists";
import { listPath, parseRegion, regionName, type Region } from "@/lib/regions";
import { buildMetadata } from "@/lib/seo";
import { one, type SearchParams } from "@/lib/url";
import { n } from "@/lib/content/common";
import { evRegionArticle, h2RegionArticle } from "@/lib/content/region";
import Crumbs from "@/components/common/Crumbs";
import Tabs from "@/components/common/Tabs";
import RegionForm from "@/components/common/RegionForm";
import RowList from "@/components/common/RowList";
import Pager from "@/components/common/Pager";
import StatTiles from "@/components/common/StatTiles";
import EvStationList from "@/components/ev/EvStationList";
import { ErrorNotice, PendingNotice, SOURCES, SourceNote } from "@/components/common/Notice";
import ArticleBody, { ArticleLead } from "@/components/article/ArticleBody";
import type { RegionParams } from "./PlaceListPage";

type Kind = "ev" | "h2";

function typeTabs(kind: Kind, region: Region) {
  return (
    <Tabs
      label="충전 종류"
      items={[
        { label: "전기차 충전소", href: listPath("charge", "ev", region.sido?.slug, region.gu?.code), active: kind === "ev" },
        // 수소충전소는 전국 수백 곳이라 시도 단위까지만 나눈다
        { label: "수소 충전소", href: listPath("charge", "h2", region.sido?.slug), active: kind === "h2" },
      ]}
    />
  );
}

function crumbs(kind: Kind, region: Region) {
  const s = region.sido?.slug;
  return [
    { name: SECTION_HOME.charge.name, path: SECTION_HOME.charge.path },
    ...(kind === "h2" ? [{ name: "수소 충전소", path: listPath("charge", "h2") }] : []),
    ...(region.sido ? [{ name: region.sido.short, path: listPath("charge", kind, s) }] : []),
    ...(region.gu ? [{ name: region.gu.name, path: listPath("charge", kind, s, region.gu.code) }] : []),
  ];
}

/* ------------------------------------------------------------ 전기차 */

async function evData(region: Region) {
  if (!region.gu) return { data: null, error: null };
  return attempt(getStationsByRegion(region.gu.zscodes));
}

export async function evListMetadata(params: RegionParams): Promise<Metadata> {
  const region = parseRegion((await params).region);
  if (!region) return {};
  const path = listPath("charge", "ev", region.sido?.slug, region.gu?.code);
  if (!region.sido) {
    return buildMetadata({
      path,
      title: "전기차 충전소 찾기 - 전국 시군구별 급속·완속 충전기 실시간 상태",
      description: "전국 시군구별 전기차 충전소 위치와 급속·완속 충전기 수, 지금 충전 가능한 충전기를 실시간으로 확인하세요.",
      keywords: ["전기차 충전소", "급속 충전소", "충전기 상태", "전기차 충전소 위치"],
    });
  }
  if (!region.gu) {
    return buildMetadata({
      path,
      title: `${region.sido.name} 전기차 충전소 - 시군구별 급속·완속 충전기 실시간 상태`,
      description: `${region.sido.name} 시군구별 전기차 충전소 위치와 급속·완속 충전기, 지금 비어 있는 충전기 수를 확인하세요.`,
      keywords: [`${region.sido.short} 전기차 충전소`, `${region.sido.short} 급속 충전소`],
    });
  }
  const { data } = await evData(region);
  const s = data ? summarize(data) : null;
  const r = regionName(region);
  return buildMetadata({
    path,
    title: s
      ? `${r} 전기차 충전소 ${n(s.stations)}곳 - 급속 ${n(s.fast)}대·완속 ${n(s.slow)}대 실시간 상태`
      : `${r} 전기차 충전소 - 급속·완속 충전기 실시간 상태`,
    description: `${r} 전기차 충전소${s ? ` ${n(s.stations)}곳, 충전기 ${n(s.chargers)}대` : ""}의 위치와 급속·완속 충전기, 지금 충전 가능한 충전기 수를 실시간으로 확인하세요.`,
    keywords: [`${r} 전기차 충전소`, `${region.gu.name} 전기차 충전소`, `${region.gu.name} 급속 충전소`],
    noindex: s?.stations === 0,
  });
}

export async function EvListPage({ params }: { params: RegionParams }) {
  const region = parseRegion((await params).region);
  if (!region) notFound();
  const { data, error } = await evData(region);
  const s = data ? summarize(data) : null;
  const article = evRegionArticle(region, s, data?.filter((x) => x.parkingFree).length ?? 0);
  const sido = region.sido?.slug ?? "";

  return (
    <>
      <Crumbs trail={crumbs("ev", region)} />
      <div className="page-head">
        <h1>⚡ {regionName(region)} 전기차 충전소</h1>
      </div>
      <ArticleLead article={article} />
      <RegionForm pathBase="/charge/ev" sido={sido} gu={region.gu?.code ?? ""} q="" showQuery={false} allowAllSido />
      {typeTabs("ev", region)}

      {!region.sido && (
        <div className="region-grid">
          {SIDO.map((x) => (
            <a target="_self" key={x.slug} href={listPath("charge", "ev", x.slug)} className="region-card">
              {x.short}
              <small>›</small>
            </a>
          ))}
        </div>
      )}
      {region.sido && !region.gu && (
        <div className="region-grid">
          {SIGUNGU[sido]?.map((g) => (
            <a target="_self" key={g.code} href={listPath("charge", "ev", sido, g.code)} className="region-card">
              {g.name}
              <small>›</small>
            </a>
          ))}
        </div>
      )}
      {region.gu && (
        <>
          {error && <ErrorNotice message={error} />}
          {s && data && (
            <>
              <StatTiles
                items={[
                  { label: "충전소", value: s.stations, unit: "곳" },
                  { label: "충전기", value: s.chargers, unit: "대", note: `급속 ${s.fast.toLocaleString()} · 완속 ${s.slow.toLocaleString()}` },
                  { label: "충전 가능", value: s.available, unit: "대", dot: "var(--st-available)" },
                  { label: "충전 중", value: s.charging, unit: "대", dot: "var(--st-charging)" },
                ]}
              />
              {data.length === 0 ? <div className="empty-box">등록된 충전소가 없습니다.</div> : <EvStationList stations={data} />}
            </>
          )}
        </>
      )}

      <ArticleBody article={article} />
      <SourceNote source={SOURCES.ev} extra="충전기 상태는 약 10분 간격으로 갱신되며 실제와 다를 수 있습니다." />
    </>
  );
}

/* ------------------------------------------------------------ 수소 */

async function h2Data(region: Region, q: string) {
  const rows = await loadRows("hydrogen");
  if (!rows) return null;
  const inSido = region.sido ? rows.filter((r) => r.sido === region.sido!.slug) : rows;
  return {
    rows: filterRows(inSido, { gu: region.gu?.code, q }),
    bySido: SIDO.map((x) => ({ name: x.short, slug: x.slug, count: rows.filter((r) => r.sido === x.slug).length })),
  };
}

export async function h2ListMetadata(params: RegionParams, searchParams: SearchParams): Promise<Metadata> {
  const region = parseRegion((await params).region);
  if (!region) return {};
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const d = await h2Data(region, "");
  const count = d?.rows.length;
  const where = region.sido ? regionName(region, !region.gu) : "전국";
  return buildMetadata({
    path: listPath("charge", "h2", region.sido?.slug, region.gu?.code, { page: page > 1 ? page : undefined }),
    title: `${where} 수소충전소${count ? ` ${n(count)}곳` : ""} - 위치·운영시간·충전 가능 차량${page > 1 ? ` (${page}페이지)` : ""}`,
    description: `${where} 수소충전소${count ? ` ${n(count)}곳` : ""}의 위치와 운영시간, 휴무일, 충전 압력과 충전 가능 차량을 확인하세요.`,
    keywords: [`${regionName(region)} 수소충전소`, "수소충전소 위치", "수소차 충전"],
    noindex: !!q || count === 0,
  });
}

export async function H2ListPage({ params, searchParams }: { params: RegionParams; searchParams: SearchParams }) {
  const region = parseRegion((await params).region);
  if (!region) notFound();
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const d = await h2Data(region, q);
  const p = d ? paginate(d.rows, Number(one(sp.page))) : null;
  const article = d && !q ? h2RegionArticle(region, d.rows.length, d.bySido) : null;
  const s = region.sido?.slug;
  const g = region.gu?.code;

  return (
    <>
      <Crumbs trail={crumbs("h2", region)} />
      <div className="page-head">
        <h1>💧 {regionName(region)} 수소충전소</h1>
      </div>
      {article && <ArticleLead article={article} />}
      <RegionForm pathBase="/charge/h2" sido={s ?? ""} gu={g ?? ""} q={q} allowAllSido placeholder="충전소 이름·주소 검색" />
      {typeTabs("h2", region)}
      {!p ? (
        <PendingNotice />
      ) : (
        <>
          <p className="result-count">수소충전소 {p.total.toLocaleString()}곳</p>
          <RowList rows={p.items} hrefFor={(r) => `/charge/h2-${rowId("hydrogen", r)}`} />
          <Pager page={p.page} pages={p.pages} hrefFor={(num) => listPath("charge", "h2", s, g, { q, page: num })} />
        </>
      )}
      {article && <ArticleBody article={article} />}
      <SourceNote source={SOURCES.hydrogen} />
    </>
  );
}
