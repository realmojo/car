/** 요약 숫자 타일 */
export default function StatTiles({
  items,
}: {
  items: Array<{ label: string; value: number | string; unit?: string; note?: string; dot?: string }>;
}) {
  return (
    <div className="stat-grid">
      {items.map((it) => (
        <div key={it.label} className="stat-tile">
          <div className="stat-tile__name">
            {it.dot && <span className="stat-tile__dot" style={{ background: it.dot }} />}
            {it.label}
          </div>
          <div className="stat-tile__value num">
            {typeof it.value === "number" ? it.value.toLocaleString() : it.value}
            {it.unit && <small>{it.unit}</small>}
          </div>
          {it.note && <div className="stat-tile__note">{it.note}</div>}
        </div>
      ))}
    </div>
  );
}
