import { NAV } from "@/lib/menu";
import { countRows, latestRows } from "@/lib/datasets";
import { countPlaces } from "@/lib/places";
import { getRoadEvents, eventGroup } from "@/lib/its";
import { attempt } from "@/lib/errors";
import { faqJsonLd } from "@/lib/seo";
import RegionForm from "@/components/common/RegionForm";
import RowList from "@/components/common/RowList";
import StatTiles from "@/components/common/StatTiles";

export const dynamic = "force-dynamic";

const STEPS = [
  { n: "01", title: "카테고리를 고릅니다", desc: "충전, 주차, 정비, 이동 중 필요한 정보를 선택합니다." },
  { n: "02", title: "지역을 좁힙니다", desc: "시도와 시군구를 고르거나 동네 이름으로 검색합니다." },
  { n: "03", title: "상세 정보와 길찾기", desc: "요금·운영시간·연락처를 확인하고 카카오맵 길찾기로 바로 이동합니다." },
];

const FAQ = [
  {
    q: "정보는 어디에서 가져오나요?",
    a: "한국환경공단, 한국가스안전공사, 한국교통안전공단, 국토교통부, 한국도로공사, 한국에너지공단과 각 지방자치단체가 공공데이터포털 등에 공개한 데이터를 사용합니다. 각 페이지 하단에 출처를 밝혀 두었습니다.",
  },
  {
    q: "얼마나 자주 갱신되나요?",
    a: "전기차 충전기 상태와 도로 돌발상황은 수 분 간격으로 갱신합니다. 주차장·정비소·검사소처럼 자주 바뀌지 않는 정보는 원천 데이터의 갱신 주기(대개 월 단위)에 맞춰 반영합니다.",
  },
  {
    q: "표시된 정보가 실제와 달라요.",
    a: "원천 기관의 등록 정보가 늦게 바뀌었거나 현장 사정이 달라졌을 수 있습니다. 요금·운영시간은 방문 전 관리기관에 확인해 주세요.",
  },
  {
    q: "이용 요금이 있나요?",
    a: "없습니다. 회원가입 없이 모든 기능을 무료로 이용할 수 있습니다.",
  },
];

export default async function HomePage() {
  const [hydrogen, events, recalls, parking, repair, inspection] = await Promise.all([
    attempt(countRows("hydrogen")),
    attempt(getRoadEvents()),
    latestRows("recall", "date", 5),
    attempt(countPlaces("parking")),
    attempt(countPlaces("repair")),
    attempt(countPlaces("inspection")),
  ]);
  const c = {
    hydrogen: hydrogen.data ?? 0,
    parking: parking.data ?? 0,
    repair: repair.data ?? 0,
    inspection: inspection.data ?? 0,
  };
  const eventList = events.data ?? [];
  const latestRecalls = recalls ?? [];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQ)) }} />

      <section className="lp-hero">
        <span className="lp-eyebrow">공공데이터로 찾는 자동차 생활 정보</span>
        <h1>
          충전소부터 주차장, 정비소까지
          <br />
          운전에 필요한 정보를 한곳에서
        </h1>
        <p>전기차 충전기 실시간 상태, 공영·무료 주차장 요금, 동네 정비소와 검사소, 도로 돌발상황을 확인하세요.</p>
        <div className="hero-search">
          <RegionForm basePath="/search" sido="seoul" gu="" q="" showGu={false} placeholder="동네·시설 이름 검색 (예: 역삼동)" />
        </div>
        <div className="lp-hero__actions">
          <a target="_self" href="/charge?type=ev" className="lp-btn lp-btn--primary">
            ⚡ 충전소 찾기
          </a>
          <a target="_self" href="/parking?f=free" className="lp-btn lp-btn--ghost">
            무료 주차장 보기
          </a>
        </div>
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-title">카테고리</h2>
        </div>
        <div className="lp-features">
          {NAV.map((n) => (
            <a target="_self" key={n.href} href={n.href} className="lp-feature">
              <div className="lp-feature__icon" aria-hidden>
                {n.icon}
              </div>
              <h3>{n.name}</h3>
              <p>{n.desc}</p>
              <span className="lp-feature__link">바로가기 →</span>
            </a>
          ))}
        </div>
      </section>

      {(c.parking > 0 || c.repair > 0 || c.inspection > 0 || c.hydrogen > 0) && (
        <section className="sec">
          <div className="sec-head">
            <h2 className="sec-title">한눈에 보는 데이터</h2>
          </div>
          <StatTiles
            items={[
              { label: "주차장", value: c.parking ?? 0, unit: "곳" },
              { label: "정비업체", value: c.repair ?? 0, unit: "곳" },
              { label: "자동차 검사소", value: c.inspection ?? 0, unit: "곳" },
              { label: "수소충전소", value: c.hydrogen ?? 0, unit: "곳" },
            ]}
          />
        </section>
      )}

      {eventList.length > 0 && (
        <section className="sec">
          <div className="sec-head">
            <h2 className="sec-title">지금 도로 상황</h2>
            <a target="_self" href="/road?type=event" className="sec-more">
              돌발상황 {eventList.length.toLocaleString()}건 보기
            </a>
          </div>
          <ul className="item-list">
            {eventList.slice(0, 4).map((e) => (
              <li key={e.id} className="item-card">
                <div className="item-card__main">
                  <div className="item-card__name">
                    <span className={`badge ${eventGroup(e) === "accident" ? "badge--warn" : "badge--muted"}`}>
                      {e.detailType || e.eventType}
                    </span>
                    {e.roadName}
                    {e.direction && <span className="item-card__sub">{e.direction}</span>}
                  </div>
                  <div className="item-card__addr">{e.message}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {latestRecalls.length > 0 && (
        <section className="sec">
          <div className="sec-head">
            <h2 className="sec-title">최근 리콜</h2>
            <a target="_self" href="/repair?type=recall" className="sec-more">
              리콜 더보기
            </a>
          </div>
          <RowList
            rows={latestRecalls}
            hrefFor={(r) => `/repair/recall-${r.key}`}
            aside={(r) => <span className="num">{r.info.find(([k]) => k === "리콜 개시일")?.[1]}</span>}
          />
        </section>
      )}

      <section className="lp-section">
        <div className="lp-section__head">
          <h2>이렇게 사용합니다</h2>
          <p>가입 없이 바로 쓸 수 있습니다.</p>
        </div>
        <ol className="lp-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="lp-step">
              <span className="lp-step__num">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-section">
        <div className="lp-section__head">
          <h2>자주 묻는 질문</h2>
        </div>
        <div className="lp-faq">
          {FAQ.map((f) => (
            <details key={f.q} className="lp-faq__item">
              <summary>{f.q}</summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="lp-cta">
        <h2>지금 우리 동네 무료 주차장은?</h2>
        <p>시군구를 고르면 무료로 운영하는 공영 주차장만 모아 보여 드립니다.</p>
        <a target="_self" href="/parking?f=free" className="lp-btn lp-btn--primary">
          무료 주차장 찾기
        </a>
      </section>
    </>
  );
}
