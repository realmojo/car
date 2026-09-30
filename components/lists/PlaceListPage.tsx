/**
 * 주차장·정비소·검사소 지역 목록 페이지.
 * /parking/free/seoul/11680 같은 주소마다 제목·canonical·요약 문단이 따로 생긴다.
 * 각 라우트(app/<카테고리>/<종류>/[[...region]]/page.tsx)는 종류만 정해 이 파일을 부른다.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { attempt } from "@/lib/errors";
import { detailPath, PARKING_KINDS, REPAIR_KINDS, SECTION_HOME, type PlaceKind } from "@/lib/lists";
import { queryPlaces } from "@/lib/places";
import { countOf, listPath, parseRegion, regionIndex, regionName, tally, type Region } from "@/lib/regions";
import { buildMetadata } from "@/lib/seo";
import { one, type SearchParams } from "@/lib/url";
import { josa, n } from "@/lib/content/common";
import { placeRegionArticle } from "@/lib/content/region";
import Crumbs from "@/components/common/Crumbs";
import Tabs from "@/components/common/Tabs";
import RegionForm from "@/components/common/RegionForm";
import RowList from "@/components/common/RowList";
import Pager from "@/components/common/Pager";
import { ErrorNotice, PendingNotice, SOURCES, SourceNote } from "@/components/common/Notice";
import ArticleBody, { ArticleLead } from "@/components/article/ArticleBody";

export type RegionParams = Promise<{ region?: string[] }>;

interface Opts {
  q: string;
  f: string;
  sort: "" | "capacity";
  page: number;
}

function readOpts(k: PlaceKind, sp: Record<string, string | string[] | undefined>): Opts {
  const f = one(sp.f);
  return {
    q: one(sp.q).trim(),
    f: k.subFilters.some((x) => x.key === f) ? f : "",
    sort: k.dataset === "parking" && one(sp.sort) === "capacity" ? "capacity" : "",
    page: Math.max(1, Number(one(sp.page)) || 1),
  };
}

const siblings = (k: PlaceKind) => (k.section === "parking" ? PARKING_KINDS : REPAIR_KINDS);

function crumbs(k: PlaceKind, region: Region) {
  const s = region.sido?.slug;
  return [
    { name: SECTION_HOME[k.section].name, path: SECTION_HOME[k.section].path },
    // 카테고리 첫 화면이 곧 첫 번째 종류(/parking/all)라 그때는 종류를 한 번만 적는다
    ...(k.kind !== siblings(k)[0].kind ? [{ name: k.label, path: listPath(k.section, k.kind) }] : []),
    ...(region.sido ? [{ name: region.sido.short, path: listPath(k.section, k.kind, s) }] : []),
    ...(region.gu ? [{ name: region.gu.name, path: listPath(k.section, k.kind, s, region.gu.code) }] : []),
  ];
}

/** 지역 건수. 인덱스를 못 읽으면 null (목록 조회 결과로 대신한다) */
async function countFor(k: PlaceKind, region: Region) {
  const { data: index } = await attempt(regionIndex(k.dataset));
  if (!index) return { index: null, count: null };
  return { index, count: countOf(tally(index, region.sido?.slug, region.gu?.code), k.flag) };
}

export async function placeListMetadata(k: PlaceKind, params: RegionParams, searchParams: SearchParams): Promise<Metadata> {
  const region = parseRegion((await params).region);
  if (!region) return {};
  const o = readOpts(k, await searchParams);
  const { count } = await countFor(k, region);
  const r = regionName(region);
  const where = region.sido ? r : "전국";
  const cnt = count ? ` ${n(count)}곳` : "";
  const title = region.gu
    ? `${where} ${k.label}${cnt} - ${k.titleTail}`
    : region.sido
      ? `${regionName(region, true)} ${k.label}${cnt} - 시군구별 ${k.titleTail}`
      : `전국 ${k.label}${cnt} - 시도·시군구별 찾기`;
  const description = `${where} ${k.label}${cnt ? `${cnt}의` : "의"} 위치와 ${
    k.dataset === "parking" ? "주차 요금, 운영시간, 주차면 수" : k.dataset === "repair" ? "연락처, 정비 종류, 운영시간" : "검사 종류, 연락처, 운영시간"
  }를 ${region.gu ? "한 번에" : "시군구별로"} 확인하세요. 공공데이터 기준으로 매월 갱신합니다.`;
  return buildMetadata({
    path: listPath(k.section, k.kind, region.sido?.slug, region.gu?.code, { page: o.page > 1 ? o.page : undefined }),
    title: o.page > 1 ? `${title} (${o.page}페이지)` : title,
    description,
    keywords: [`${r} ${k.label}`, `${r} ${k.label} 위치`, ...(region.gu ? [`${region.gu.name} ${k.label}`] : [])],
    noindex: !!(o.q || o.f || o.sort || count === 0),
  });
}

export async function PlaceListPage({
  k,
  params,
  searchParams,
}: {
  k: PlaceKind;
  params: RegionParams;
  searchParams: SearchParams;
}) {
  const region = parseRegion((await params).region);
  if (!region) notFound();
  const o = readOpts(k, await searchParams);
  const s = region.sido?.slug;
  const g = region.gu?.code;
  const r = regionName(region);

  // 전국 화면은 목록 대신 시도 링크를 보여준다 (검색어가 있을 때만 목록)
  const showList = !!region.sido || !!o.q;
  const [{ index }, listed] = await Promise.all([
    countFor(k, region),
    showList
      ? attempt(
          queryPlaces(k.dataset, {
            sido: s,
            gu: g,
            q: o.q,
            flags: [k.flag, o.f].filter((x): x is string => !!x),
            sort: o.sort || undefined,
            page: o.page,
          }),
        )
      : Promise.resolve({ data: null, error: null }),
  ]);
  const article = index ? placeRegionArticle(k, region, index) : null;
  const p = listed.data;
  const keep = { q: o.q, f: o.f, sort: o.sort };

  return (
    <>
      <Crumbs trail={crumbs(k, region)} />
      <div className="page-head">
        <h1>
          {k.icon} {r} {k.label}
        </h1>
      </div>
      {article && o.page === 1 && !o.q && <ArticleLead article={article} />}

      <RegionForm pathBase={`/${k.section}/${k.kind}`} sido={s ?? ""} gu={g ?? ""} q={o.q} keep={{ f: o.f }} allowAllSido placeholder={k.placeholder} />
      <Tabs
        label="종류"
        items={[
          ...siblings(k).map((x) => ({ label: x.label, href: listPath(x.section, x.kind, s, g), active: x.kind === k.kind })),
          ...(k.section === "repair" ? [{ label: "리콜 조회", href: "/repair?type=recall", active: false }] : []),
        ]}
      />
      {k.subFilters.length > 0 && showList && (
        <Tabs
          label="세부 조건"
          items={[
            { label: "전체", href: listPath(k.section, k.kind, s, g, { q: o.q, sort: o.sort }), active: !o.f },
            ...k.subFilters.map((x) => ({
              label: x.label,
              href: listPath(k.section, k.kind, s, g, { q: o.q, sort: o.sort, f: x.key }),
              active: x.key === o.f,
            })),
          ]}
        />
      )}

      {showList &&
        (listed.error ? (
          <ErrorNotice message={listed.error} />
        ) : !p ? (
          <PendingNotice />
        ) : (
          <>
            <div className="list-head">
              <p className="result-count">
                {k.label} {p.total.toLocaleString()}곳
              </p>
              {k.dataset === "parking" && (
                <a target="_self" className="list-sort" href={listPath(k.section, k.kind, s, g, { ...keep, sort: o.sort ? "" : "capacity" })}>
                  {o.sort ? "기본 순서" : "주차면 많은 순"}
                </a>
              )}
            </div>
            {p.total === 0 ? (
              <div className="empty-box">조건에 맞는 {josa(k.label, "이/가")} 없습니다.</div>
            ) : (
              <RowList
                rows={p.items}
                hrefFor={(row) => detailPath(k, row.key, row.sido ?? s ?? "")}
                aside={
                  k.dataset === "parking"
                    ? (row) =>
                        row.num?.capacity ? (
                          <>
                            <strong className="num">{row.num.capacity.toLocaleString()}</strong>면
                          </>
                        ) : null
                    : undefined
                }
              />
            )}
            <Pager page={p.page} pages={p.pages} hrefFor={(num) => listPath(k.section, k.kind, s, g, { ...keep, page: num })} />
          </>
        ))}

      {article && o.page === 1 && !o.q && <ArticleBody article={article} />}
      <SourceNote source={k.dataset === "parking" ? SOURCES.parking : k.dataset === "repair" ? SOURCES.repair : SOURCES.inspection} />
    </>
  );
}
