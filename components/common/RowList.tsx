import type { Row } from "@/lib/datasets";

/** 동기화 데이터(주차장·정비소 등) 목록. 항목을 누르면 2depth 상세로 이동한다 */
export default function RowList({
  rows,
  hrefFor,
  aside,
}: {
  rows: Row[];
  hrefFor: (row: Row) => string;
  aside?: (row: Row) => React.ReactNode;
}) {
  if (rows.length === 0) return <div className="empty-box">조건에 맞는 결과가 없습니다.</div>;
  return (
    <ul className="item-list">
      {rows.map((r) => (
        <li key={r.key}>
          <a target="_self" href={hrefFor(r)} className="item-card">
            <div className="item-card__main">
              <div className="item-card__name">
                {r.name}
                {r.sub && <span className="item-card__sub">{r.sub}</span>}
              </div>
              {r.address && <div className="item-card__addr">{r.address}</div>}
              {r.tags.length > 0 && (
                <div className="item-card__tags">
                  {r.tags.slice(0, 4).map((t) => (
                    <span key={t} className="badge badge--muted">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {aside && <div className="item-card__aside">{aside(r)}</div>}
          </a>
        </li>
      ))}
    </ul>
  );
}
