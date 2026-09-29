import type { Metadata } from "next";
import { findSido } from "@/lib/codes";
import { filterRows, loadRows, rowId, type DatasetId, type Row } from "@/lib/datasets";
import { buildMetadata } from "@/lib/seo";
import { one, withQuery, type SearchParams } from "@/lib/url";
import Crumbs from "@/components/common/Crumbs";
import RegionForm from "@/components/common/RegionForm";
import RowList from "@/components/common/RowList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  path: "/search",
  title: "통합 검색 - 주차장·정비소·검사소·충전소·휴게소",
  description: "동네 이름이나 시설 이름으로 주차장, 정비소, 자동차 검사소, 수소충전소, 휴게소를 한 번에 검색하세요.",
});

interface Group {
  dataset: DatasetId;
  label: string;
  icon: string;
  href: (r: Row, sido: string) => string;
  more: (sido: string, q: string) => string;
  regional: boolean;
}

const GROUPS: Group[] = [
  {
    dataset: "parking",
    label: "주차장",
    icon: "🅿️",
    regional: true,
    href: (r, sido) => `/parking/${rowId("parking", r, sido)}`,
    more: (sido, q) => withQuery("/parking", { sido, q }),
  },
  {
    dataset: "repair",
    label: "정비소",
    icon: "🔧",
    regional: true,
    href: (r, sido) => `/repair/shop-${rowId("repair", r, sido)}`,
    more: (sido, q) => withQuery("/repair", { type: "shop", sido, q }),
  },
  {
    dataset: "inspection",
    label: "자동차 검사소",
    icon: "🔍",
    regional: true,
    href: (r, sido) => `/repair/insp-${rowId("inspection", r, sido)}`,
    more: (sido, q) => withQuery("/repair", { type: "inspection", sido, q }),
  },
  {
    dataset: "hydrogen",
    label: "수소충전소",
    icon: "💧",
    regional: false,
    href: (r) => `/charge/h2-${r.key}`,
    more: (sido, q) => withQuery("/charge", { type: "h2", sido, q }),
  },
  {
    dataset: "rest",
    label: "휴게소·졸음쉼터",
    icon: "🛣️",
    regional: false,
    href: (r) => `/road/rest-${r.key}`,
    more: (_sido, q) => withQuery("/road", { type: "rest", q }),
  },
];

const LIMIT = 5;

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const sido = findSido(one(sp.sido)) ? one(sp.sido) : "seoul";
  const q = one(sp.q).trim();
  const ready = q.length >= 2;

  const results = ready
    ? await Promise.all(
        GROUPS.map(async (g) => {
          const rows = await loadRows(g.dataset, g.regional ? sido : undefined);
          const scoped = rows ? (g.regional ? rows : rows.filter((r) => !r.sido || r.sido === sido || g.dataset === "rest")) : [];
          const hits = filterRows(scoped, { q });
          return { g, hits, missing: !rows };
        }),
      )
    : [];
  const total = results.reduce((a, r) => a + r.hits.length, 0);
  const sidoInfo = findSido(sido)!;

  return (
    <>
      <Crumbs trail={[{ name: "통합 검색", path: "/search" }]} />
      <div className="page-head">
        <h1>🔍 통합 검색</h1>
        <p>동네 이름(예: 역삼동, 해운대)이나 시설 이름으로 주차장·정비소·검사소·충전소·휴게소를 한 번에 찾습니다.</p>
      </div>
      <RegionForm basePath="/search" sido={sido} gu="" q={q} showGu={false} placeholder="예) 역삼동, 공영주차장, 기흥휴게소" />

      {!ready ? (
        <div className="empty-box">검색어를 두 글자 이상 입력하세요.</div>
      ) : (
        <>
          <p className="result-count">
            {sidoInfo.short}에서 ‘{q}’ 검색 결과 {total.toLocaleString()}건
          </p>
          {results.map(({ g, hits, missing }) =>
            missing || hits.length === 0 ? null : (
              <section key={g.dataset} className="sec" style={{ marginTop: 24 }}>
                <div className="sec-head">
                  <h2 className="sec-title">
                    {g.icon} {g.label} <span className="muted" style={{ fontSize: 14 }}>{hits.length.toLocaleString()}건</span>
                  </h2>
                  {hits.length > LIMIT && (
                    <a target="_self" href={g.more(sido, q)} className="sec-more">
                      전체 보기
                    </a>
                  )}
                </div>
                <RowList rows={hits.slice(0, LIMIT)} hrefFor={(r) => g.href(r, sido)} />
              </section>
            ),
          )}
          {total === 0 && <div className="empty-box">검색 결과가 없습니다. 다른 지역이나 검색어로 찾아보세요.</div>}
          <section className="sec">
            <div className="bento-grid">
              <a target="_self" href={withQuery("/charge", { type: "ev", sido })} className="bento-card">
                <div className="bento-card__icon" aria-hidden>⚡</div>
                <div className="bento-card__title">{sidoInfo.short} 전기차 충전소</div>
                <p className="bento-card__desc">전기차 충전소는 실시간 상태를 보여주기 위해 시군구별로 조회합니다.</p>
              </a>
              <a target="_self" href={withQuery("/repair", { type: "recall", q })} className="bento-card">
                <div className="bento-card__icon" aria-hidden>⚠️</div>
                <div className="bento-card__title">‘{q}’ 리콜 검색</div>
                <p className="bento-card__desc">차명으로 검색했다면 리콜 정보도 확인해 보세요.</p>
              </a>
            </div>
          </section>
        </>
      )}
    </>
  );
}
