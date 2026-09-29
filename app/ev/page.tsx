import type { Metadata } from "next";
import { SIDO, SIGUNGU } from "@/lib/codes";
import { buildMetadata, faqJsonLd } from "@/lib/seo";
import Crumbs from "@/components/common/Crumbs";
import ChargerGuide from "@/components/ev/ChargerGuide";
import { SourceNote } from "@/components/common/Notice";

export const metadata: Metadata = buildMetadata({
  path: "/ev",
  title: "전기차 충전소 찾기 - 지역별 급속·완속 충전기 위치와 상태 | 김군카",
  description:
    "전국 전기차 충전소 위치와 급속·완속 충전기 수, 지금 충전 가능한 충전기를 한국환경공단 공공데이터로 확인하세요.",
  keywords: ["전기차 충전소", "전기차 충전소 위치", "급속 충전소", "완속 충전기", "충전기 상태", "환경부 충전소"],
});

const FAQ = [
  {
    q: "충전 가능 여부는 얼마나 정확한가요?",
    a: "충전 사업자가 한국환경공단에 보고하는 상태값을 보여 줍니다. 수 분 정도 늦을 수 있고, 통신이상·상태미확인 충전기는 실제와 다를 수 있습니다.",
  },
  {
    q: "급속과 완속은 어떻게 다른가요?",
    a: "급속은 50kW 이상 직류(DC) 충전기로 30분~1시간이면 80% 가까이 충전합니다. 완속은 7kW 안팎의 교류(AC) 충전기로 완충에 6~10시간 걸려 주로 주거지·직장에서 씁니다.",
  },
  {
    q: "'이용 제한'은 무슨 뜻인가요?",
    a: "아파트 입주민 전용, 관공서 업무시간 한정처럼 외부인이 이용하기 어려운 충전소입니다. 상세 내용은 충전기 상태 보기에서 확인할 수 있습니다.",
  },
];

export default function EvPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd(FAQ)) }} />
      <Crumbs trail={[{ name: "전기차 충전소", path: "/ev" }]} />
      <div className="page-head">
        <h1>⚡ 전기차 충전소 찾기</h1>
        <p>지역을 선택하면 시군구별 충전소 위치와 급속·완속 충전기, 지금 비어 있는 충전기 수를 볼 수 있습니다.</p>
      </div>

      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-title">지역 선택</h2>
        </div>
        <div className="region-grid">
          {SIDO.map((s) => (
            <a target="_self" key={s.slug} href={`/ev/${s.slug}`} className="region-card">
              {s.short}
              <small>{SIGUNGU[s.slug]?.length ?? 0}개 시군구</small>
            </a>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-title">충전기 규격 안내</h2>
        </div>
        <p className="sec-sub">내 차의 충전구 규격과 맞는 충전기를 골라야 합니다.</p>
        <ChargerGuide />
      </section>

      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-title">충전 요금이 궁금하다면</h2>
        </div>
        <div className="bento-grid">
          <a target="_self" href="/calculator?mode=ev" className="bento-card">
            <div className="bento-card__icon" aria-hidden>🧮</div>
            <div className="bento-card__title">전기차 충전비 계산기</div>
            <p className="bento-card__desc">주행거리·전비·kWh 단가로 월 충전 요금을 계산하고 내연기관차와 비교합니다.</p>
          </a>
          <a
            href="https://ev.or.kr/nportal/evcarInfo/initEvcarChargePrice.do"
            target="_blank"
            rel="noopener noreferrer"
            className="bento-card"
          >
            <div className="bento-card__icon" aria-hidden>💳</div>
            <div className="bento-card__title">환경부 공공 충전요금</div>
            <p className="bento-card__desc">무공해차 통합누리집에서 공공 급속·완속 충전기의 최신 요금을 확인하세요.</p>
          </a>
        </div>
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
        <SourceNote kind="ev" />
      </section>
    </>
  );
}
