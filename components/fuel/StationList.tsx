import type { StationSummary } from "@/lib/opinet";
import { brandName } from "@/lib/codes";
import { won } from "@/lib/format";

function distanceText(m?: number) {
  if (m === undefined) return null;
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}

/** 최저가·주변 주유소 목록. 항목을 누르면 주유소 상세로 이동한다 */
export default function StationList({ items, unit = "원" }: { items: StationSummary[]; unit?: string }) {
  if (items.length === 0) {
    return <div className="empty-box">조건에 맞는 주유소가 없습니다.</div>;
  }
  return (
    <ol className="station-list">
      {items.map((s, i) => (
        <li key={s.id}>
          <a target="_self" href={`/fuel/station/${s.id}`} className="station">
            <span className={`station__rank num${i < 3 ? " is-top" : ""}`}>{i + 1}</span>
            <div>
              <div className="station__name">
                {s.name}
                {s.brand && <span className="badge badge--muted">{brandName(s.brand)}</span>}
              </div>
              <div className="station__addr">{s.address}</div>
            </div>
            <div>
              <div className="station__price num">
                {won(s.price)}
                <small>{unit}</small>
              </div>
              {s.distance !== undefined && <div className="station__meta num">{distanceText(s.distance)}</div>}
            </div>
          </a>
        </li>
      ))}
    </ol>
  );
}
