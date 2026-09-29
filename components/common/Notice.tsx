/** API 오류·키 미설정 안내 */
export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="notice notice--error" role="alert">
      <strong>데이터를 불러오지 못했습니다</strong>
      {message} 잠시 후 다시 시도해 주세요.
    </div>
  );
}

export function SourceNote({ kind }: { kind: "fuel" | "ev" }) {
  return kind === "fuel" ? (
    <p className="source-note">
      출처: 한국석유공사{" "}
      <a href="https://www.opinet.co.kr" target="_blank" rel="noopener noreferrer">
        오피넷
      </a>
      . 주유소가 보고한 판매가격 기준이며 실제 가격과 차이가 있을 수 있습니다.
    </p>
  ) : (
    <p className="source-note">
      출처: 한국환경공단 전기자동차 충전소 정보(
      <a href="https://www.data.go.kr/data/15076352/openapi.do" target="_blank" rel="noopener noreferrer">
        공공데이터포털
      </a>
      ). 충전기 상태는 수 분 간격으로 갱신되며 실제와 다를 수 있습니다.
    </p>
  );
}
