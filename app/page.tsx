import { getAvgAllPrice, getRecentPrices, getSidoAvg } from "@/lib/opinet";
import { attempt } from "@/lib/errors";
import { faqJsonLd } from "@/lib/seo";
import PriceTiles from "@/components/fuel/PriceTiles";
import TrendChart from "@/components/fuel/TrendChart";
import AreaTable, { sidoHref } from "@/components/fuel/SidoTable";
import RegionSearch from "@/components/common/RegionSearch";
import { ErrorNotice, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

const FEATURES = [
  {
    icon: "⛽",
    title: "지역별 최저가 주유소",
    desc: "시도·시군구를 고르면 휘발유·경유·LPG 가격이 가장 싼 주유소를 순서대로 보여 드립니다.",
    href: "/fuel",
    cta: "최저가 찾기",
  },
  {
    icon: "📍",
    title: "내 주변 주유소",
    desc: "현재 위치 반경 1~5km 안의 주유소를 가격순·거리순으로 비교하고 바로 길찾기로 연결합니다.",
    href: "/fuel/nearby",
    cta: "주변 검색",
  },
  {
    icon: "⚡",
    title: "전기차 충전소",
    desc: "전국 충전소 위치와 급속·완속 충전기, 지금 비어 있는 충전기 수를 한눈에 확인합니다.",
    href: "/ev",
    cta: "충전소 찾기",
  },
  {
    icon: "📈",
    title: "유가 추이",
    desc: "최근 7일 전국 평균 휘발유·경유 가격 흐름과 전일 대비 등락을 확인합니다.",
    href: "/fuel",
    cta: "추이 보기",
  },
  {
    icon: "🧮",
    title: "유류비·충전비 계산기",
    desc: "주행거리와 연비만 넣으면 내연기관차 기름값과 전기차 충전 요금을 바로 계산합니다.",
    href: "/calculator",
    cta: "계산하기",
  },
  {
    icon: "🗺️",
    title: "시군구 평균 가격",
    desc: "우리 동네가 시도 평균보다 비싼지 싼지, 시군구별 평균 판매가격으로 비교합니다.",
    href: "/fuel/seoul",
    cta: "서울 보기",
  },
];

const STEPS = [
  { n: "01", title: "지역을 고릅니다", desc: "시도를 선택하거나 내 위치를 허용하면 주변 정보를 바로 불러옵니다." },
  { n: "02", title: "가격·상태를 비교합니다", desc: "유종별 최저가 주유소, 충전 가능한 충전기 수를 한 화면에서 비교합니다." },
  { n: "03", title: "길찾기로 바로 이동", desc: "카카오맵 길찾기로 연결되어 가장 싼 곳, 비어 있는 충전소로 바로 갑니다." },
];

const FAQ = [
  {
    q: "가격 정보는 어디에서 가져오나요?",
    a: "한국석유공사 오피넷이 제공하는 유가정보 API 를 사용합니다. 전국 주유소가 신고한 판매가격을 바탕으로 하며, 평균 가격은 하루 여러 차례 갱신됩니다.",
  },
  {
    q: "전기차 충전기 상태는 실시간인가요?",
    a: "한국환경공단 전기자동차 충전소 정보 API 의 상태값을 사용합니다. 충전 사업자가 보고하는 주기에 따라 수 분 정도 늦을 수 있으며, 일부 충전기는 상태가 제공되지 않습니다.",
  },
  {
    q: "표시된 가격과 실제 주유소 가격이 달라요.",
    a: "주유소가 가격을 바꾼 뒤 오피넷에 반영되기까지 시간이 걸릴 수 있습니다. 주유 전에 현장 가격을 꼭 확인해 주세요.",
  },
  {
    q: "이용 요금이 있나요?",
    a: "없습니다. 회원가입 없이 모든 기능을 무료로 이용할 수 있습니다.",
  },
];

export default async function HomePage() {
  const [avg, recent, gasoline, diesel] = await Promise.all([
    attempt(getAvgAllPrice()),
    attempt(getRecentPrices()),
    attempt(getSidoAvg("B027")),
    attempt(getSidoAvg("D047")),
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQ)) }}
      />

      <section className="lp-hero">
        <span className="lp-eyebrow">오피넷 · 한국환경공단 공공데이터</span>
        <h1>
          오늘 기름값부터 전기차 충전소까지,
          <br />
          내 차에 필요한 정보를 한곳에서
        </h1>
        <p>
          전국·지역별 평균 유가와 최저가 주유소, 전기차 충전소 위치와 충전기
          상태를 공공데이터로 매일 확인하세요.
        </p>
        <RegionSearch />
        <div className="lp-hero__actions">
          <a target="_self" href="/fuel/nearby" className="lp-btn lp-btn--primary">
            📍 내 주변 최저가 주유소
          </a>
          <a target="_self" href="/calculator" className="lp-btn lp-btn--ghost">
            유류비 계산기
          </a>
        </div>
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-title">오늘의 전국 평균 유가</h2>
          <a target="_self" href="/fuel" className="sec-more">
            유가 정보 더보기
          </a>
        </div>
        {avg.data ? <PriceTiles items={avg.data} /> : <ErrorNotice message={avg.error ?? ""} />}
      </section>

      {recent.data && recent.data.length > 0 && (
        <section className="sec">
          <div className="sec-head">
            <h2 className="sec-title">최근 7일 가격 추이</h2>
          </div>
          <div className="panel">
            <TrendChart data={recent.data} />
          </div>
        </section>
      )}

      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-title">시도별 평균 가격</h2>
        </div>
        <p className="sec-sub">휘발유가 싼 지역부터 정렬했습니다. 지역을 누르면 최저가 주유소를 볼 수 있습니다.</p>
        {gasoline.data && diesel.data ? (
          <AreaTable gasoline={gasoline.data} diesel={diesel.data} hrefFor={sidoHref} areaLabel="시도" />
        ) : (
          <ErrorNotice message={gasoline.error ?? diesel.error ?? ""} />
        )}
        <SourceNote kind="fuel" />
      </section>

      <section id="features" className="lp-section">
        <div className="lp-section__head">
          <h2>이런 걸 할 수 있어요</h2>
          <p>주유부터 충전까지, 운전자에게 필요한 정보를 공공데이터로 정리했습니다.</p>
        </div>
        <div className="lp-features">
          {FEATURES.map((f) => (
            <a target="_self" key={f.title} href={f.href} className="lp-feature">
              <div className="lp-feature__icon" aria-hidden>
                {f.icon}
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <span className="lp-feature__link">{f.cta} →</span>
            </a>
          ))}
        </div>
      </section>

      <section className="lp-section">
        <div className="lp-section__head">
          <h2>이렇게 사용합니다</h2>
          <p>가입 없이 10초면 가장 싼 주유소를 찾을 수 있습니다.</p>
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
        <h2>지금 내 주변에서 가장 싼 주유소는?</h2>
        <p>위치만 허용하면 반경 안의 주유소를 가격순으로 보여 드립니다.</p>
        <a target="_self" href="/fuel/nearby" className="lp-btn lp-btn--primary">
          주변 주유소 찾기
        </a>
      </section>
    </>
  );
}
