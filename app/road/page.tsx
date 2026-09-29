import type { Metadata } from "next";
import { EVENT_GROUPS, eventGroup, getRoadEvents } from "@/lib/its";
import { loadRows, paginate } from "@/lib/datasets";
import { attempt } from "@/lib/errors";
import { kakaoMapLink, ymdhm } from "@/lib/format";
import { buildMetadata } from "@/lib/seo";
import { one, withQuery, type SearchParams } from "@/lib/url";
import Crumbs from "@/components/common/Crumbs";
import Tabs from "@/components/common/Tabs";
import RowList from "@/components/common/RowList";
import Pager from "@/components/common/Pager";
import StatTiles from "@/components/common/StatTiles";
import { ErrorNotice, PendingNotice, SOURCES, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  path: "/road",
  title: "실시간 도로 돌발상황·고속도로 휴게소 정보 | 김군카",
  description: "고속도로·국도의 사고, 공사, 기상 돌발상황을 실시간으로 확인하고 노선별 휴게소와 졸음쉼터 정보를 찾아보세요.",
  keywords: ["돌발상황", "고속도로 사고", "도로 공사", "고속도로 휴게소", "졸음쉼터"],
});

export default async function RoadPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const type = one(sp.type) === "rest" ? "rest" : "event";
  return (
    <>
      <Crumbs trail={[{ name: "이동", path: "/road" }]} />
      <div className="page-head">
        <h1>🚗 도로 · 이동 정보</h1>
        <p>
          {type === "event"
            ? "고속도로와 국도의 사고, 공사, 기상 돌발상황입니다. 약 5분 간격으로 갱신됩니다."
            : "노선별 고속도로 휴게소와 졸음쉼터의 위치, 주차 규모, 연락처를 확인하세요."}
        </p>
      </div>
      <Tabs
        label="이동 정보"
        items={[
          { label: "실시간 돌발상황", href: "/road?type=event", active: type === "event" },
          { label: "휴게소·졸음쉼터", href: "/road?type=rest", active: type === "rest" },
        ]}
      />
      {type === "event" ? (
        <EventSection group={one(sp.group)} road={one(sp.road)} />
      ) : (
        <RestSection route={one(sp.route)} kind={one(sp.kind)} q={one(sp.q)} page={Number(one(sp.page))} />
      )}
    </>
  );
}

async function EventSection({ group, road }: { group: string; road: string }) {
  const { data, error } = await attempt(getRoadEvents());
  if (error || !data) return <ErrorNotice message={error ?? ""} />;

  const counts = Object.fromEntries(EVENT_GROUPS.map((g) => [g.key, data.filter((e) => eventGroup(e) === g.key).length]));
  const roadTypes = [...new Set(data.map((e) => e.roadType).filter(Boolean))];
  const list = data.filter((e) => (!group || eventGroup(e) === group) && (!road || e.roadType === road));

  return (
    <>
      <StatTiles
        items={EVENT_GROUPS.map((g) => ({ label: g.name, value: counts[g.key], unit: "건" }))}
      />
      <Tabs
        label="돌발 유형"
        items={[
          { label: "전체", href: withQuery("/road", { type: "event", road }), active: !group, count: data.length },
          ...EVENT_GROUPS.map((g) => ({
            label: g.name,
            href: withQuery("/road", { type: "event", road, group: g.key }),
            active: group === g.key,
            count: counts[g.key],
          })),
        ]}
      />
      {roadTypes.length > 1 && (
        <Tabs
          label="도로 종류"
          items={[
            { label: "모든 도로", href: withQuery("/road", { type: "event", group }), active: !road },
            ...roadTypes.map((r) => ({ label: r, href: withQuery("/road", { type: "event", group, road: r }), active: road === r })),
          ]}
        />
      )}
      {list.length === 0 ? (
        <div className="empty-box">해당하는 돌발상황이 없습니다.</div>
      ) : (
        <ul className="item-list">
          {list.slice(0, 100).map((e) => (
            <li key={e.id} className="item-card">
              <div className="item-card__main">
                <div className="item-card__name">
                  <span className={`badge ${eventGroup(e) === "accident" ? "badge--warn" : "badge--muted"}`}>
                    {e.detailType || e.eventType}
                  </span>
                  {e.roadName}
                  {e.direction && <span className="item-card__sub">{e.direction}</span>}
                </div>
                <div className="item-card__addr">{e.message || e.eventType}</div>
                <div className="item-card__tags">
                  <span className="badge badge--muted">{e.roadType}</span>
                  {e.lanesBlocked && <span className="badge badge--muted">통제: {e.lanesBlocked}</span>}
                  {e.lat && e.lng ? (
                    <a
                      className="badge"
                      href={kakaoMapLink(`${e.roadName} ${e.eventType}`, e.lat, e.lng)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      지도 보기
                    </a>
                  ) : null}
                </div>
              </div>
              <div className="item-card__aside num">
                {ymdhm(e.startDate)}
                <br />
                발생
              </div>
            </li>
          ))}
        </ul>
      )}
      <SourceNote source={SOURCES.event} extra="실시간 정보는 수 분 늦을 수 있으니 운전 중에는 내비게이션 안내를 따르세요." />
    </>
  );
}

async function RestSection({ route, kind, q, page }: { route: string; kind: string; q: string; page: number }) {
  const rows = await loadRows("rest");
  if (!rows) return <PendingNotice />;
  const routes = [...new Set(rows.map((r) => r.info.find(([k]) => k === "노선")?.[1]).filter((v): v is string => Boolean(v)))].sort();
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = rows.filter((r) => {
    if (route && r.info.find(([k]) => k === "노선")?.[1] !== route) return false;
    if (kind && !r.flags.includes(kind)) return false;
    if (words.length && !words.every((w) => `${r.name} ${r.sub} ${r.address ?? ""}`.toLowerCase().includes(w))) return false;
    return true;
  });
  const p = paginate(filtered, page);

  return (
    <>
      <form className="region-form" action="/road" method="get" role="search">
        <input type="hidden" name="type" value="rest" />
        <select name="route" defaultValue={route} aria-label="노선">
          <option value="">전체 노선</option>
          {routes.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <input type="search" name="q" defaultValue={q} placeholder="휴게소 이름 검색" aria-label="휴게소 검색" maxLength={30} />
        <button type="submit">검색</button>
      </form>
      <Tabs
        label="시설 구분"
        items={[
          { label: "전체", href: withQuery("/road", { type: "rest", route, q }), active: !kind },
          { label: "휴게소", href: withQuery("/road", { type: "rest", route, q, kind: "rest" }), active: kind === "rest" },
          { label: "졸음쉼터", href: withQuery("/road", { type: "rest", route, q, kind: "drowsy" }), active: kind === "drowsy" },
        ]}
      />
      <p className="result-count">{p.total.toLocaleString()}곳</p>
      <RowList rows={p.items} hrefFor={(r) => `/road/rest-${r.key}`} />
      <Pager page={p.page} pages={p.pages} hrefFor={(n) => withQuery("/road", { type: "rest", route, kind, q, page: n })} />
      <SourceNote source={SOURCES.rest} />
    </>
  );
}
