"use client";

import { useState } from "react";
import { SIDO } from "@/lib/codes";

/** 홈 히어로: 시도를 고르고 주유소 최저가 또는 충전소로 이동 */
export default function RegionSearch() {
  const [slug, setSlug] = useState("seoul");
  const go = (base: string) => {
    // 다른 페이지들과 같이 전체 새로고침으로 이동한다 (router.push 대신 의도적 선택)
    window.location.assign(new URL(`${base}/${slug}`, window.location.origin).href);
  };
  return (
    <form className="lp-search" onSubmit={(e) => e.preventDefault()} role="search">
      <select value={slug} onChange={(e) => setSlug(e.target.value)} aria-label="지역 선택">
        {SIDO.map((s) => (
          <option key={s.slug} value={s.slug}>
            {s.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => go("/fuel")}>
        ⛽ 최저가 주유소
      </button>
      <button type="button" onClick={() => go("/ev")}>
        ⚡ 충전소 찾기
      </button>
    </form>
  );
}
