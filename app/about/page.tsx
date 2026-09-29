import type { Metadata } from "next";
import { SITE, buildMetadata } from "@/lib/seo";
import { SOURCES } from "@/components/common/Notice";

export const metadata: Metadata = buildMetadata({
  path: "/about",
  title: `사이트 소개 | ${SITE.name}`,
  description: `${SITE.name}는 공공데이터로 충전소·주차장·정비소·도로 정보를 제공하는 무료 서비스입니다.`,
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
          운전자가 자주 찾는 충전소, 주차장, 정비소, 도로 상황 정보를 공공데이터로 모아 보여 드리는 무료
          서비스입니다. 회원가입 없이 이용할 수 있습니다.
        </p>
        <h2>데이터 출처</h2>
        <ul>
          {Object.values(SOURCES).map((s) => (
            <li key={s.name}>
              {s.org}{" "}
              <a href={s.url} target="_blank" rel="noopener noreferrer">
                {s.name}
              </a>
            </li>
          ))}
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
