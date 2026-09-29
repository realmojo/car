/** 번호형 페이지 이동. hrefFor(page) 로 링크를 만든다 */
export default function Pager({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  const nums = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  return (
    <nav className="pager" aria-label="페이지">
      {page > 1 && (
        <a target="_self" href={hrefFor(page - 1)} aria-label="이전 페이지">
          ‹
        </a>
      )}
      {nums.map((n) => (
        <a key={n} target="_self" href={hrefFor(n)} aria-current={n === page ? "page" : undefined} className={n === page ? "is-active" : undefined}>
          {n}
        </a>
      ))}
      {page < pages && (
        <a target="_self" href={hrefFor(page + 1)} aria-label="다음 페이지">
          ›
        </a>
      )}
    </nav>
  );
}
