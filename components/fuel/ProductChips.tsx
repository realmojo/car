import { SEARCH_PRODUCTS } from "@/lib/codes";

/** 유종 선택 칩. 서버 컴포넌트에서 쿼리스트링 링크로 동작한다 */
export default function ProductChips({ basePath, current }: { basePath: string; current: string }) {
  return (
    <div className="chips" role="tablist" aria-label="유종 선택">
      {SEARCH_PRODUCTS.map((p) => (
        <a
          key={p.code}
          target="_self"
          role="tab"
          aria-selected={p.code === current}
          href={p.code === "B027" ? basePath : `${basePath}?prodcd=${p.code}`}
          className={`chip${p.code === current ? " is-active" : ""}`}
        >
          {p.short}
        </a>
      ))}
    </div>
  );
}
