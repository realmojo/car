import { kakaoMapLink, kakaoRouteLink, naverSearchLink } from "@/lib/format";

/** 2depth 상세 공통: 정보 표 + 길찾기 버튼 */
export default function DetailView({
  info,
  name,
  address,
  lat,
  lng,
  tel,
}: {
  info: Array<[string, React.ReactNode]>;
  name: string;
  address?: string;
  lat?: number;
  lng?: number;
  tel?: string;
}) {
  return (
    <>
      <div className="panel panel--pad">
        <dl className="info-list">
          {info.map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd>{k === "전화" && typeof v === "string" ? <a href={`tel:${v}`}>{v}</a> : v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="action-row">
        {lat && lng ? (
          <>
            <a className="lp-btn lp-btn--primary" href={kakaoRouteLink(name, lat, lng)} target="_blank" rel="noopener noreferrer">
              🧭 카카오맵 길찾기
            </a>
            <a className="lp-btn lp-btn--ghost" href={kakaoMapLink(name, lat, lng)} target="_blank" rel="noopener noreferrer">
              지도에서 보기
            </a>
          </>
        ) : null}
        {address && (
          <a className="lp-btn lp-btn--ghost" href={naverSearchLink(`${name} ${address}`)} target="_blank" rel="noopener noreferrer">
            네이버 지도
          </a>
        )}
        {tel && (
          <a className="lp-btn lp-btn--ghost" href={`tel:${tel}`}>
            📞 전화
          </a>
        )}
      </div>
    </>
  );
}
