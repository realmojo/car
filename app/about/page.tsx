import type { Metadata } from "next";
import { SITE, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/about",
  title: `사이트 소개 | ${SITE.name}`,
  description: `${SITE.name}는 공공데이터로 유가·주유소·전기차 충전소 정보를 제공하는 무료 서비스입니다.`,
});

export default function AboutPage() {
  return (
    <>
      <div className="page-head">
        <h1>사이트 소개</h1>
      </div>
      <div className="prose-box">
        <h2>{SITE.name}는 어떤 곳인가요?</h2>
        <p>
          운전자가 매일 궁금해하는 오늘의 기름값, 가장 싼 주유소, 가까운 전기차 충전소 정보를
          공공데이터로 모아 보여 드리는 무료 서비스입니다. 회원가입 없이 이용할 수 있습니다.
        </p>
        <h2>데이터 출처</h2>
        <ul>
          <li>
            유가·주유소 정보: 한국석유공사{" "}
            <a href="https://www.opinet.co.kr" target="_blank" rel="noopener noreferrer">오피넷</a> 유가정보 API
          </li>
          <li>
            전기차 충전소 정보: 한국환경공단 전기자동차 충전소 정보 (
            <a href="https://www.data.go.kr/data/15076352/openapi.do" target="_blank" rel="noopener noreferrer">공공데이터포털</a>)
          </li>
        </ul>
        <h2>이용 시 유의사항</h2>
        <p>
          가격과 충전기 상태는 원천 기관이 제공한 시점의 정보이며, 실제 판매 가격·이용 가능 여부와 다를 수
          있습니다. 방문 전 현장에서 한 번 더 확인해 주세요.
        </p>
      </div>
    </>
  );
}
