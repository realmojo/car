/** 칩 모양의 탭. 모두 링크라 서버 컴포넌트에서 그대로 쓴다 */
export default function Tabs({
  items,
  label,
}: {
  items: Array<{ label: string; href: string; active: boolean; count?: number }>;
  label: string;
}) {
  return (
    <nav className="chips" aria-label={label}>
      {items.map((t) => (
        <a
          key={t.href}
          target="_self"
          href={t.href}
          aria-current={t.active ? "page" : undefined}
          className={`chip${t.active ? " is-active" : ""}`}
        >
          {t.label}
          {t.count !== undefined && <span className="chip__count">{t.count.toLocaleString()}</span>}
        </a>
      ))}
    </nav>
  );
}
