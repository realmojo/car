import type { AreaAvg } from "@/lib/opinet";
import { findSidoByOpinet } from "@/lib/codes";
import { won } from "@/lib/format";
import { Diff } from "./PriceTiles";

/**
 * 지역별 휘발유·경유 평균가 표.
 * 막대는 휘발유 가격을 표 안에서의 최저~최고 구간으로 늘려 보여준다.
 */
export default function AreaTable({
  gasoline,
  diesel,
  hrefFor,
  areaLabel = "지역",
}: {
  gasoline: AreaAvg[];
  diesel: AreaAvg[];
  hrefFor?: (row: AreaAvg) => string | null;
  areaLabel?: string;
}) {
  const rows = [...gasoline].sort((a, b) => a.price - b.price);
  const dieselBy = new Map(diesel.map((d) => [d.code, d]));
  const prices = rows.map((r) => r.price).filter((p) => p > 0);
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return (
    <div className="panel">
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{areaLabel}</th>
              <th className="r">휘발유</th>
              <th className="r">전일 대비</th>
              <th className="r">경유</th>
              <th aria-hidden />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = dieselBy.get(r.code);
              const href = hrefFor?.(r);
              const ratio = max > min ? (r.price - min) / (max - min) : 0.5;
              return (
                <tr key={r.code}>
                  <td>
                    {href ? (
                      <a target="_self" className="link" href={href}>
                        {r.name}
                      </a>
                    ) : (
                      r.name
                    )}
                  </td>
                  <td className="r num">{won(r.price, 2)}</td>
                  <td className="r">
                    <Diff value={r.diff} />
                  </td>
                  <td className="r num">{d ? won(d.price, 2) : "-"}</td>
                  <td className="bar-cell" aria-hidden>
                    <span
                      className={`bar-cell__bar${r.price === max ? " is-max" : ""}${r.price === min ? " is-min" : ""}`}
                      style={{ width: `${20 + ratio * 80}%` }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="panel__foot">
        막대는 휘발유 기준 상대 비교입니다. <span className="down">파랑</span>은 가장 저렴한 곳,{" "}
        <span className="up">빨강</span>은 가장 비싼 곳.
      </div>
    </div>
  );
}

export function sidoHref(row: AreaAvg) {
  const sido = findSidoByOpinet(row.code);
  return sido ? `/fuel/${sido.slug}` : null;
}
