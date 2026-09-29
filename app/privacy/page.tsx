import type { Metadata } from "next";
import { SITE, buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  path: "/privacy",
  title: `개인정보처리방침 | ${SITE.name}`,
  description: `${SITE.name} 개인정보처리방침`,
});

export default function PrivacyPage() {
  return (
    <>
      <div className="page-head">
        <h1>개인정보처리방침</h1>
      </div>
      <div className="prose-box">
        <h2>1. 수집하는 개인정보</h2>
        <p>{SITE.name}는 회원가입 기능이 없으며 이름·연락처 등 개인을 식별할 수 있는 정보를 수집하지 않습니다.</p>
        <h2>2. 위치 정보</h2>
        <p>
          &lsquo;내 주변 주유소&rsquo; 기능은 이용자가 브라우저에서 허용한 경우에만 현재 위치를 사용합니다.
          위치 좌표는 주변 주유소 검색 요청에만 쓰이며 서버에 저장하지 않습니다.
        </p>
        <h2>3. 접속 기록</h2>
        <p>서비스 안정성 확인을 위해 호스팅 사업자가 IP 주소·접속 시각 등 기본 접속 기록을 일정 기간 보관할 수 있습니다.</p>
        <h2>4. 문의</h2>
        <p>개인정보 관련 문의는 사이트 운영자에게 연락해 주시기 바랍니다.</p>
      </div>
    </>
  );
}
