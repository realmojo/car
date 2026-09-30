import type { Metadata } from "next";
import { permanentRedirect } from "next/navigation";
import { loadRows, paginate, type Row } from "@/lib/datasets";
import { legacyListUrl } from "@/lib/legacy";
import { REPAIR_KINDS, SECTION_HOME } from "@/lib/lists";
import { buildMetadata } from "@/lib/seo";
import { listPath, one, toParams, withQuery, type SearchParams } from "@/lib/url";
import Crumbs from "@/components/common/Crumbs";
import Tabs from "@/components/common/Tabs";
import RowList from "@/components/common/RowList";
import Pager from "@/components/common/Pager";
import { PendingNotice, SOURCES, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  path: "/repair?type=recall",
  title: "자동차 리콜 조회 - 제작사·차명별 결함 내용과 무상 수리",
  description: "제작사와 차명으로 자동차 리콜 대상 여부와 결함 내용, 리콜 개시일, 무상 수리 방법을 조회하세요.",
  keywords: ["자동차 리콜 조회", "리콜 차량", "리콜 대상", "무상 수리"],
});

export default async function RepairPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  // 정비소·검사소 목록은 /repair/shop, /repair/inspection 으로 옮겼다 (보통은 middleware.ts 가 먼저 301 로 넘긴다)
  const moved = legacyListUrl("/repair", toParams(sp));
  if (moved) permanentRedirect(moved);
  const q = one(sp.q);

  return (
    <>
      <Crumbs trail={[{ name: "정비", path: SECTION_HOME.repair.path }, { name: "리콜 조회", path: "/repair?type=recall" }]} />
      <div className="page-head">
        <h1>⚠️ 자동차 리콜 조회</h1>
        <p>제작사·차명으로 리콜 대상 여부와 결함 내용, 시정 방법을 확인하세요.</p>
      </div>
      <Tabs
        label="정비 분류"
        items={REPAIR_KINDS.map((k) => ({ label: k.label, href: listPath("repair", k.kind), active: false })).concat({
          label: "리콜 조회",
          href: "/repair?type=recall",
          active: true,
        })}
      />
      <RecallSection q={q} maker={one(sp.maker)} page={Number(one(sp.page))} />
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
