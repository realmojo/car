import type { Metadata } from "next";
import { findSido, findSigungu } from "@/lib/codes";
import { loadRows, paginate, rowId, type Row } from "@/lib/datasets";
import { queryPlaces } from "@/lib/places";
import { attempt } from "@/lib/errors";
import { buildMetadata } from "@/lib/seo";
import { one, withQuery, type SearchParams } from "@/lib/url";
import Crumbs from "@/components/common/Crumbs";
import Tabs from "@/components/common/Tabs";
import RegionForm from "@/components/common/RegionForm";
import RowList from "@/components/common/RowList";
import Pager from "@/components/common/Pager";
import { ErrorNotice, PendingNotice, SOURCES, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  path: "/repair",
  title: "정비소·자동차 검사소 찾기, 리콜 조회",
  description: "동네 자동차 정비소와 종합·소형·전문 정비업체, 가까운 자동차 검사소를 찾고 내 차의 리콜 정보를 조회하세요.",
  keywords: ["자동차 정비소", "정비업체", "자동차 검사소", "자동차 리콜 조회", "리콜 차량"],
});

type Type = "shop" | "inspection" | "recall";

const SHOP_FILTERS = [
  { key: "", label: "전체" },
  { key: "general", label: "종합정비" },
  { key: "small", label: "소형정비" },
  { key: "partial", label: "전문정비" },
];

const INSP_FILTERS = [
  { key: "", label: "전체" },
  { key: "ts", label: "공단 직영" },
  { key: "private", label: "민간 지정" },
];

export default async function RepairPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const t = one(sp.type);
  const type: Type = t === "inspection" || t === "recall" ? t : "shop";
  const q = one(sp.q);
  const page = Number(one(sp.page));

  return (
    <>
      <Crumbs trail={[{ name: "정비", path: "/repair" }]} />
      <div className="page-head">
        <h1>🔧 정비 · 검사 · 리콜</h1>
        <p>
          {type === "recall"
            ? "제작사·차명으로 리콜 대상 여부와 결함 내용, 시정 방법을 확인하세요."
            : "지역을 고르면 정비업체와 자동차 검사소의 위치, 연락처, 운영시간을 볼 수 있습니다."}
        </p>
      </div>
      <Tabs
        label="정비 분류"
        items={[
          { label: "정비소", href: "/repair?type=shop", active: type === "shop" },
          { label: "자동차 검사소", href: "/repair?type=inspection", active: type === "inspection" },
          { label: "리콜 조회", href: "/repair?type=recall", active: type === "recall" },
        ]}
      />
      {type === "recall" ? (
        <RecallSection q={q} maker={one(sp.maker)} page={page} />
      ) : (
        <PlaceSection type={type} sp={sp} q={q} page={page} />
      )}
    </>
  );
}

async function PlaceSection({
  type,
  sp,
  q,
  page,
}: {
  type: "shop" | "inspection";
  sp: Record<string, string | string[] | undefined>;
  q: string;
  page: number;
}) {
  const dataset = type === "shop" ? "repair" : "inspection";
  const filters = type === "shop" ? SHOP_FILTERS : INSP_FILTERS;
  const sido = findSido(one(sp.sido)) ? one(sp.sido) : "seoul";
  const gu = findSigungu(sido, one(sp.gu)) ? one(sp.gu) : "";
  const f = filters.some((x) => x.key === one(sp.f)) ? one(sp.f) : "";
  const { data: p, error } = await attempt(queryPlaces(dataset, { sido, gu, q, flags: f ? [f] : [], page }));
  const base = { type, sido, gu, q };
  const prefix = type === "shop" ? "shop" : "insp";

  return (
    <>
      <RegionForm
        basePath="/repair"
        sido={sido}
        gu={gu}
        q={q}
        keep={{ type, f }}
        placeholder={type === "shop" ? "정비소 이름·주소 검색" : "검사소 이름·주소 검색"}
      />
      <Tabs
        label="업체 종류"
        items={filters.map((x) => ({ label: x.label, href: withQuery("/repair", { ...base, f: x.key }), active: x.key === f }))}
      />
      {error ? (
        <ErrorNotice message={error} />
      ) : !p ? (
        <PendingNotice />
      ) : (
        <>
          <p className="result-count">
            {type === "shop" ? "정비업체" : "검사소"} {p.total.toLocaleString()}곳
          </p>
          <RowList rows={p.items} hrefFor={(r) => `/repair/${prefix}-${rowId(dataset, r, sido)}`} />
          <Pager page={p.page} pages={p.pages} hrefFor={(n) => withQuery("/repair", { ...base, f, page: n })} />
        </>
      )}
      <SourceNote source={type === "shop" ? SOURCES.repair : SOURCES.inspection} />
    </>
  );
}

async function RecallSection({ q, maker, page }: { q: string; maker: string; page: number }) {
  const rows = await loadRows("recall");
  const form = (
    <form className="region-form" action="/repair" method="get" role="search">
      <input type="hidden" name="type" value="recall" />
      {maker && <input type="hidden" name="maker" value={maker} />}
      <input type="search" name="q" defaultValue={q} placeholder="차명 또는 결함 내용 검색 (예: 쏘렌토, 브레이크)" aria-label="리콜 검색" maxLength={40} />
      <button type="submit">검색</button>
    </form>
  );
  if (!rows) {
    return (
      <>
        {form}
        <PendingNotice />
      </>
    );
  }

  // 리콜이 많은 제작사 상위 8곳을 칩으로 보여준다
  const counts = new Map<string, number>();
  for (const r of rows) if (r.sub) counts.set(r.sub, (counts.get(r.sub) ?? 0) + 1);
  const makers = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = rows
    .filter((r) => !maker || r.sub === maker)
    .filter((r) => {
      if (!words.length) return true;
      const hay = `${r.name} ${r.sub} ${r.info.map((i) => i[1]).join(" ")}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    })
    .sort((a, b) => (b.num?.date ?? 0) - (a.num?.date ?? 0));
  const p = paginate(filtered, page);

  return (
    <>
      {form}
      <Tabs
        label="제작사"
        items={[
          { label: "전체", href: withQuery("/repair", { type: "recall", q }), active: !maker },
          ...makers.map(([m, c]) => ({ label: m, count: c, href: withQuery("/repair", { type: "recall", q, maker: m }), active: m === maker })),
        ]}
      />
      <p className="result-count">리콜 {p.total.toLocaleString()}건 · 최근 개시 순</p>
      <RowList
        rows={p.items}
        hrefFor={(r: Row) => `/repair/recall-${r.key}`}
        aside={(r) => {
          const start = r.info.find(([k]) => k === "리콜 개시일")?.[1];
          return start ? <span className="num">{start}</span> : null;
        }}
      />
      <Pager page={p.page} pages={p.pages} hrefFor={(n) => withQuery("/repair", { type: "recall", q, maker, page: n })} />
      <p className="source-note">
        차량번호로 내 차의 리콜 대상 여부를 확인하려면{" "}
        <a href="https://www.car.go.kr" target="_blank" rel="noopener noreferrer">
          자동차리콜센터
        </a>
        를 이용하세요.
      </p>
      <SourceNote source={SOURCES.recall} />
    </>
  );
}
