import type { Metadata } from "next";
import { SIGUNGU, findSido, findSigungu } from "@/lib/codes";
import { getStationsByRegion, summarize } from "@/lib/ev";
import { filterRows, loadRows, paginate, rowId } from "@/lib/datasets";
import { attempt } from "@/lib/errors";
import { buildMetadata } from "@/lib/seo";
import { one, withQuery, type SearchParams } from "@/lib/url";
import Crumbs from "@/components/common/Crumbs";
import Tabs from "@/components/common/Tabs";
import RegionForm from "@/components/common/RegionForm";
import RowList from "@/components/common/RowList";
import Pager from "@/components/common/Pager";
import StatTiles from "@/components/common/StatTiles";
import EvStationList from "@/components/ev/EvStationList";
import { ErrorNotice, PendingNotice, SOURCES, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  path: "/charge",
  title: "전기차·수소 충전소 찾기 - 실시간 충전기 상태 | 김군카",
  description:
    "시군구별 전기차 충전소 위치와 급속·완속 충전기, 지금 충전 가능한 충전기 수, 전국 수소충전소 위치와 운영 정보를 확인하세요.",
  keywords: ["전기차 충전소", "충전소 위치", "급속 충전소", "충전기 상태", "수소충전소"],
});

export default async function ChargePage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const type = one(sp.type) === "h2" ? "h2" : "ev";
  const sido = findSido(one(sp.sido)) ? one(sp.sido) : type === "ev" ? "seoul" : "";
  const gu = findSigungu(sido, one(sp.gu)) ? one(sp.gu) : "";
  const q = one(sp.q);

  return (
    <>
      <Crumbs trail={[{ name: "충전", path: "/charge" }]} />
      <div className="page-head">
        <h1>⚡ 충전소 찾기</h1>
        <p>
          {type === "ev"
            ? "시군구를 고르면 충전소 위치와 급속·완속 충전기, 지금 비어 있는 충전기 수를 볼 수 있습니다."
            : "전국 수소충전소의 위치, 충전기 수, 운영 시간과 휴무일을 확인하세요."}
        </p>
      </div>

      <Tabs
        label="충전 종류"
        items={[
          { label: "전기차 충전소", href: "/charge?type=ev", active: type === "ev" },
          { label: "수소 충전소", href: "/charge?type=h2", active: type === "h2" },
        ]}
      />

      {type === "ev" ? <EvSection sido={sido} gu={gu} q={q} /> : <H2Section sido={sido} gu={gu} q={q} page={Number(one(sp.page))} />}
    </>
  );
}

async function EvSection({ sido, gu, q }: { sido: string; gu: string; q: string }) {
  const sidoInfo = findSido(sido)!;
  const guInfo = gu ? findSigungu(sido, gu) : undefined;
  const form = <RegionForm basePath="/charge" sido={sido} gu={gu} q={q} keep={{ type: "ev" }} showQuery={false} />;

  if (!guInfo) {
    return (
      <>
        {form}
        <p className="sec-sub">충전기 상태는 시군구 단위로 조회합니다. {sidoInfo.short}의 시군구를 선택하세요.</p>
        <div className="region-grid">
          {SIGUNGU[sido]?.map((g) => (
            <a target="_self" key={g.code} href={withQuery("/charge", { type: "ev", sido, gu: g.code })} className="region-card">
              {g.name}
              <small>›</small>
            </a>
          ))}
        </div>
        <SourceNote source={SOURCES.ev} />
      </>
    );
  }

  const { data, error } = await attempt(getStationsByRegion(guInfo.zscodes));
  const s = data ? summarize(data) : null;
  return (
    <>
      {form}
      <h2 className="sec-title" style={{ marginBottom: 14 }}>
        {sidoInfo.short} {guInfo.name} 전기차 충전소
      </h2>
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
      <SourceNote source={SOURCES.ev} extra="충전기 상태는 약 10분 간격으로 갱신되며 실제와 다를 수 있습니다." />
    </>
  );
}

async function H2Section({ sido, gu, q, page }: { sido: string; gu: string; q: string; page: number }) {
  const rows = await loadRows("hydrogen");
  const form = (
    <RegionForm basePath="/charge" sido={sido} gu={gu} q={q} keep={{ type: "h2" }} allowAllSido placeholder="충전소 이름·주소 검색" />
  );
  if (!rows) {
    return (
      <>
        {form}
        <PendingNotice />
      </>
    );
  }
  const filtered = filterRows(sido ? rows.filter((r) => r.sido === sido) : rows, { gu, q });
  const p = paginate(filtered, page);
  return (
    <>
      {form}
      <p className="result-count">수소충전소 {p.total.toLocaleString()}곳</p>
      <RowList rows={p.items} hrefFor={(r) => `/charge/h2-${rowId("hydrogen", r)}`} />
      <Pager page={p.page} pages={p.pages} hrefFor={(n) => withQuery("/charge", { type: "h2", sido, gu, q, page: n })} />
      <SourceNote source={SOURCES.hydrogen} />
    </>
  );
}
