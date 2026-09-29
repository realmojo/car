/** API 오류·키 미설정 안내 */
export function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="notice notice--error" role="alert">
      <strong>데이터를 불러오지 못했습니다</strong>
      {message} 잠시 후 다시 시도해 주세요.
    </div>
  );
}

/** 동기화 데이터가 아직 없을 때 */
export function PendingNotice() {
  return (
    <div className="notice">
      <strong>데이터 준비 중입니다</strong>
      이 지역의 데이터가 아직 등록되지 않았습니다. 잠시 후 다시 확인해 주세요.
    </div>
  );
}

export interface Source {
  org: string;
  name: string;
  url: string;
}

export const SOURCES = {
  ev: { org: "한국환경공단", name: "전기자동차 충전소 정보", url: "https://www.data.go.kr/data/15076352/openapi.do" },
  hydrogen: { org: "한국가스안전공사", name: "수소충전소 현황", url: "https://www.data.go.kr/data/15066838/fileData.do" },
  parking: { org: "각 지방자치단체", name: "전국주차장정보표준데이터", url: "https://www.data.go.kr/data/15012896/standard.do" },
  repair: { org: "각 지방자치단체", name: "전국자동차정비업체표준데이터", url: "https://www.data.go.kr/data/15028204/standard.do" },
  inspection: { org: "한국교통안전공단·지방자치단체", name: "전국자동차검사소표준데이터", url: "https://www.data.go.kr/data/15021107/standard.do" },
  recall: { org: "한국교통안전공단", name: "자동차결함 리콜현황", url: "https://www.data.go.kr/data/3048950/fileData.do" },
  rest: { org: "한국도로공사", name: "휴게시설 현황", url: "https://data.ex.co.kr/" },
  event: { org: "국토교통부 국가교통정보센터", name: "돌발상황정보", url: "https://www.its.go.kr/opendata/opendataList?service=event" },
  efficiency: { org: "한국에너지공단", name: "자동차 표시연비 정보", url: "https://www.data.go.kr/data/15083023/fileData.do" },
} satisfies Record<string, Source>;

export function SourceNote({ source, extra }: { source: Source; extra?: string }) {
  return (
    <p className="source-note">
      출처: {source.org}{" "}
      <a href={source.url} target="_blank" rel="noopener noreferrer">
        {source.name}
      </a>
      . {extra ?? "공공데이터를 가공해 제공하며 실제 정보와 다를 수 있습니다."}
    </p>
  );
}
