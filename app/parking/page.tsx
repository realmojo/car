import type { Metadata } from "next";
import { findSido, findSigungu } from "@/lib/codes";
import { filterRows, loadRows, paginate, rowId } from "@/lib/datasets";
import { buildMetadata } from "@/lib/seo";
import { one, withQuery, type SearchParams } from "@/lib/url";
import Crumbs from "@/components/common/Crumbs";
import Tabs from "@/components/common/Tabs";
import RegionForm from "@/components/common/RegionForm";
import RowList from "@/components/common/RowList";
import Pager from "@/components/common/Pager";
import { PendingNotice, SOURCES, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  path: "/parking",
  title: "주차장 찾기 - 공영·무료 주차장 위치, 요금, 운영시간",
  description: "전국 공영·민영 주차장의 위치와 주차 요금, 운영시간, 주차면 수를 시군구별로 확인하세요. 무료 주차장만 골라 볼 수도 있습니다.",
  keywords: ["주차장", "공영주차장", "무료 주차장", "주차 요금", "주차장 위치"],
});

const FILTERS = [
  { key: "", label: "전체" },
  { key: "public", label: "공영" },
  { key: "free", label: "무료" },
  { key: "disabled", label: "장애인 전용구역" },
];

export default async function ParkingPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const sido = findSido(one(sp.sido)) ? one(sp.sido) : "seoul";
  const gu = findSigungu(sido, one(sp.gu)) ? one(sp.gu) : "";
  const q = one(sp.q);
  const f = FILTERS.some((x) => x.key === one(sp.f)) ? one(sp.f) : "";
  const sort = one(sp.sort) === "capacity" ? "capacity" : "";

  const rows = await loadRows("parking", sido);
  const sidoInfo = findSido(sido)!;
  const guInfo = gu ? findSigungu(sido, gu) : undefined;
  const area = `${sidoInfo.short}${guInfo ? ` ${guInfo.name}` : ""}`;

  let filtered = rows ? filterRows(rows, { gu, q, flags: f ? [f] : [] }) : [];
  if (sort === "capacity") filtered = [...filtered].sort((a, b) => (b.num?.capacity ?? 0) - (a.num?.capacity ?? 0));
  const p = paginate(filtered, Number(one(sp.page)));
  const base = { sido, gu, q };

  return (
    <>
      <Crumbs trail={[{ name: "주차", path: "/parking" }]} />
      <div className="page-head">
        <h1>🅿️ {area} 주차장</h1>
        <p>공영·민영 주차장의 요금과 운영시간을 비교하세요. 주차장을 누르면 요금표와 길찾기를 볼 수 있습니다.</p>
      </div>

      <RegionForm basePath="/parking" sido={sido} gu={gu} q={q} keep={{ f }} placeholder="주차장 이름·주소 검색" />
      <Tabs
        label="주차장 종류"
        items={FILTERS.map((x) => ({
          label: x.label,
          href: withQuery("/parking", { ...base, f: x.key }),
          active: x.key === f,
        }))}
      />

      {!rows ? (
        <PendingNotice />
      ) : (
        <>
          <div className="list-head">
            <p className="result-count">주차장 {p.total.toLocaleString()}곳</p>
            <a target="_self" className="list-sort" href={withQuery("/parking", { ...base, f, sort: sort ? "" : "capacity" })}>
              {sort ? "기본 순서" : "주차면 많은 순"}
            </a>
          </div>
          <RowList
            rows={p.items}
            hrefFor={(r) => `/parking/${rowId("parking", r, sido)}`}
            aside={(r) =>
              r.num?.capacity ? (
                <>
                  <strong className="num">{r.num.capacity.toLocaleString()}</strong>면
                </>
              ) : null
            }
          />
          <Pager page={p.page} pages={p.pages} hrefFor={(n) => withQuery("/parking", { ...base, f, sort, page: n })} />
        </>
      )}
      <SourceNote source={SOURCES.parking} />
    </>
  );
}
