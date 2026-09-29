import type { OilAvg } from "@/lib/opinet";
import { findProduct } from "@/lib/codes";
import { won, ymd } from "@/lib/format";

const DOT: Record<string, string> = {
  B027: "var(--fuel-gasoline)",
  D047: "var(--fuel-diesel)",
};

export function Diff({ value, digits = 2 }: { value: number; digits?: number }) {
  const cls = value > 0 ? "up" : value < 0 ? "down" : "flat";
  const mark = value > 0 ? "▲" : value < 0 ? "▼" : "–";
  return (
    <span className={`${cls} num`}>
      {mark} {Math.abs(value).toFixed(digits)}
    </span>
  );
}

/** 전국 평균 유가 5종 타일 */
export default function PriceTiles({ items }: { items: OilAvg[] }) {
  return (
    <>
      <div className="price-grid">
        {items.map((it) => (
          <div key={it.prodcd} className="price-tile">
            <div className="price-tile__name">
              <span className="price-tile__dot" style={DOT[it.prodcd] ? { background: DOT[it.prodcd] } : undefined} />
              {findProduct(it.prodcd).short}
            </div>
            <div className="price-tile__price num">
              {won(it.price, 2)}
              <small>원</small>
            </div>
            <div className="price-tile__diff">
              <Diff value={it.diff} /> <span className="flat">전일 대비</span>
            </div>
          </div>
        ))}
      </div>
      {items[0] && <p className="price-date">{ymd(items[0].date)} 기준 · 전국 주유소 평균 (원/L)</p>}
    </>
  );
}
