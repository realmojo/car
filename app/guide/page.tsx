import type { Metadata } from "next";
import { GUIDES } from "@/lib/guides";
import { buildMetadata } from "@/lib/seo";
import Crumbs from "@/components/common/Crumbs";

export const metadata: Metadata = buildMetadata({
  path: "/guide",
  title: "자동차 가이드 - 연비 순위, 전기차 주행거리, 충전 규격, 검사 주기 | 김군카",
  description: "공공데이터로 정리한 차종별 연비 순위와 전기차 주행거리, 충전 규격, 자동차 검사 주기, 유류비 계산기를 한곳에서 확인하세요.",
});

export default function GuidePage() {
  return (
    <>
      <Crumbs trail={[{ name: "가이드", path: "/guide" }]} />
      <div className="page-head">
        <h1>📖 자동차 가이드</h1>
        <p>차를 고르고, 굴리고, 관리할 때 알아두면 좋은 정보를 공공데이터로 정리했습니다.</p>
      </div>
      <div className="bento-grid">
        {GUIDES.map((g) => (
          <a target="_self" key={g.slug} href={`/guide/${g.slug}`} className="bento-card">
            <div className="bento-card__icon" aria-hidden>
              {g.icon}
            </div>
            <div className="bento-card__title">{g.title}</div>
            <p className="bento-card__desc">{g.desc}</p>
          </a>
        ))}
      </div>
    </>
  );
}
