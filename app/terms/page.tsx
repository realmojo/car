import type { Metadata } from "next";
import { SITE, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/terms",
  title: `이용약관 | ${SITE.name}`,
  description: `${SITE.name} 이용약관`,
});

export default function TermsPage() {
  return (
    <>
      <div className="page-head">
        <h1>이용약관</h1>
      </div>
      <div className="prose-box">
        <h2>1. 서비스 내용</h2>
        <p>
          {SITE.name}는 한국석유공사 오피넷, 한국환경공단이 제공하는 공공데이터를 가공해 유가·주유소·전기차
          충전소 정보를 무료로 제공합니다.
        </p>
        <h2>2. 정보의 정확성</h2>
        <p>
          제공되는 정보는 원천 데이터의 갱신 주기와 전송 지연 때문에 실제와 다를 수 있으며, 이를 근거로 한
          판단의 결과에 대해 운영자는 책임지지 않습니다.
        </p>
        <h2>3. 금지 행위</h2>
        <p>자동화된 수단으로 과도하게 요청을 보내 서비스 운영을 방해하는 행위를 금지합니다.</p>
      </div>
    </>
  );
}
