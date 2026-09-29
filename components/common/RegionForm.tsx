"use client";

import { useState } from "react";
import { SIDO, SIGUNGU } from "@/lib/codes";
import { withQuery } from "@/lib/url";

/**
 * 시도 · 시군구 · 검색어 선택 폼. 제출하면 같은 카테고리 페이지를 쿼리스트링으로 다시 연다.
 * keep 에 넣은 값(type, f 등)은 그대로 유지한다.
 */
export default function RegionForm({
  basePath,
  sido,
  gu,
  q,
  keep = {},
  allowAllSido = false,
  showGu = true,
  showQuery = true,
  placeholder = "이름·주소 검색",
}: {
  basePath: string;
  sido: string;
  gu: string;
  q: string;
  keep?: Record<string, string>;
  allowAllSido?: boolean;
  showGu?: boolean;
  showQuery?: boolean;
  placeholder?: string;
}) {
  const [s, setS] = useState(sido);
  const [g, setG] = useState(gu);
  const [text, setText] = useState(q);
  const gus = SIGUNGU[s] ?? [];

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    window.location.assign(withQuery(basePath, { ...keep, sido: s, gu: g, q: text.trim() }));
  };

  return (
    <form className="region-form" onSubmit={submit} role="search">
      <select
        value={s}
        onChange={(e) => {
          setS(e.target.value);
          setG("");
        }}
        aria-label="시도"
      >
        {allowAllSido && <option value="">전국</option>}
        {SIDO.map((x) => (
          <option key={x.slug} value={x.slug}>
            {x.name}
          </option>
        ))}
      </select>
      {showGu && (
        <select value={g} onChange={(e) => setG(e.target.value)} aria-label="시군구" disabled={!s}>
          <option value="">전체 시군구</option>
          {gus.map((x) => (
            <option key={x.code} value={x.code}>
              {x.name}
            </option>
          ))}
        </select>
      )}
      {showQuery && (
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label="검색어"
          maxLength={40}
        />
      )}
      <button type="submit">검색</button>
    </form>
  );
}
