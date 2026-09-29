import type { Metadata } from "next";
import { EVENT_GROUPS, cautionEnabled, eventGroup, getCautionZones, getCctvs, splitCctvName } from "@/lib/its";
import { getRoadEvents } from "@/lib/its";
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
  title: "실시간 도로 CCTV·돌발상황·고속도로 휴게소 정보 | 김군카",
  description: "고속도로·국도 실시간 CCTV와 사고·공사·기상 돌발상황, 주의운전구간, 노선별 휴게소와 졸음쉼터 정보를 확인하세요.",
  keywords: ["고속도로 CCTV", "도로 CCTV", "돌발상황", "고속도로 사고", "고속도로 휴게소", "졸음쉼터"],
});

export default async function RoadPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const t = one(sp.type);
  const caution = cautionEnabled();
  const type = t === "rest" || t === "cctv" || (t === "caution" && caution) ? t : "event";
  return (
    <>
      <Crumbs trail={[{ name: "이동", path: "/road" }]} />
      <div className="page-head">
        <h1>🚗 도로 · 이동 정보</h1>
        <p>
          {
            {
              event: "고속도로와 국도의 사고, 공사, 기상·재난 돌발상황입니다. 약 5분 간격으로 갱신됩니다.",
              cctv: "고속도로와 국도에 설치된 CCTV로 지금 도로 상황을 영상으로 확인하세요.",
              caution: "사고가 잦거나 급커브·결빙 등으로 주의가 필요한 구간입니다.",
              rest: "노선별 고속도로 휴게소와 졸음쉼터의 위치, 주차 규모, 연락처를 확인하세요.",
            }[type]
          }
        </p>
      </div>
      <Tabs
        label="이동 정보"
        items={[
          { label: "실시간 돌발상황", href: "/road?type=event", active: type === "event" },
          { label: "실시간 CCTV", href: "/road?type=cctv", active: type === "cctv" },
          ...(caution ? [{ label: "주의운전구간", href: "/road?type=caution", active: type === "caution" }] : []),
          { label: "휴게소·졸음쉼터", href: "/road?type=rest", active: type === "rest" },
        ]}
      />
      {type === "event" && <EventSection group={one(sp.group)} road={one(sp.road)} />}
      {type === "cctv" && (
        <CctvSection road={one(sp.road) === "its" ? "its" : "ex"} route={one(sp.route)} q={one(sp.q)} page={Number(one(sp.page))} />
      )}
      {type === "caution" && <CautionSection />}
      {type === "rest" && <RestSection route={one(sp.route)} kind={one(sp.kind)} q={one(sp.q)} page={Number(one(sp.page))} />}
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

async function CctvSection({ road, route, q, page }: { road: "ex" | "its"; route: string; q: string; page: number }) {
  const { data, error } = await attempt(getCctvs(road));
  const roadTabs = (
    <Tabs
      label="도로 종류"
      items={[
        { label: "고속도로", href: "/road?type=cctv&road=ex", active: road === "ex" },
        { label: "국도", href: "/road?type=cctv&road=its", active: road === "its" },
      ]}
    />
  );
  if (error || !data) {
    return (
      <>
        {roadTabs}
        <ErrorNotice message={error ?? ""} />
      </>
    );
  }

  // 노선별 개수 (많은 순)
  const counts = new Map<string, number>();
  for (const c of data) if (c.route) counts.set(c.route, (counts.get(c.route) ?? 0) + 1);
  const routes = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = data.filter(
    (c) => (!route || c.route === route) && (!words.length || words.every((w) => c.name.toLowerCase().includes(w))),
  );
  const p = paginate(filtered, page, 30);

  return (
    <>
      {roadTabs}
      <form className="region-form" action="/road" method="get" role="search">
        <input type="hidden" name="type" value="cctv" />
        <input type="hidden" name="road" value={road} />
        <select name="route" defaultValue={route} aria-label="노선">
          <option value="">전체 노선</option>
          {routes.map(([r, n]) => (
            <option key={r} value={r}>
              {r} ({n})
            </option>
          ))}
        </select>
        <input type="search" name="q" defaultValue={q} placeholder="IC·지명 검색 (예: 양재, 기흥)" aria-label="CCTV 검색" maxLength={30} />
        <button type="submit">검색</button>
      </form>
      <p className="result-count">CCTV {p.total.toLocaleString()}대</p>
      {p.items.length === 0 ? (
        <div className="empty-box">조건에 맞는 CCTV가 없습니다.</div>
      ) : (
        <ul className="cctv-grid">
          {p.items.map((c) => {
            const { place } = splitCctvName(c.name);
            return (
              <li key={c.id}>
                <a target="_self" href={`/road/cctv-${c.road}-${c.id}`} className="cctv-card">
                  <span className="cctv-card__icon" aria-hidden>
                    📹
                  </span>
                  <span className="cctv-card__name">{place}</span>
                  <span className="cctv-card__route">{c.route || (road === "ex" ? "고속도로" : "국도")}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
      <Pager page={p.page} pages={p.pages} hrefFor={(n) => withQuery("/road", { type: "cctv", road, route, q, page: n })} />
      <SourceNote source={SOURCES.cctv} extra="영상은 국가교통정보센터가 제공하는 실시간 스트리밍이며 기관 사정에 따라 끊기거나 지연될 수 있습니다." />
    </>
  );
}

async function CautionSection() {
  const { data, error } = await attempt(getCautionZones());
  if (error || !data) return <ErrorNotice message={error ?? ""} />;
  if (data.length === 0) return <div className="empty-box">주의운전구간 정보가 없습니다.</div>;
  return (
    <>
      <p className="result-count">주의운전구간 {data.length.toLocaleString()}곳</p>
      <ul className="item-list">
        {data.slice(0, 200).map((z) => (
          <li key={z.id} className="item-card">
            <div className="item-card__main">
              <div className="item-card__name">
                {z.title}
                {z.roadName && <span className="item-card__sub">{z.roadName}</span>}
              </div>
              {z.reason && <div className="item-card__addr">{z.reason}</div>}
              <div className="item-card__tags">
                {z.roadType && <span className="badge badge--muted">{z.roadType}</span>}
                {z.extra.slice(0, 3).map(([k, v]) => (
                  <span key={k} className="badge badge--muted">
                    {v}
                  </span>
                ))}
                {z.lat && z.lng ? (
                  <a className="badge" href={kakaoMapLink(z.title, z.lat, z.lng)} target="_blank" rel="noopener noreferrer">
                    지도 보기
                  </a>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
      <SourceNote source={SOURCES.caution} />
    </>
  );
}
