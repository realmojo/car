"use client";

import { useMemo, useState } from "react";
import type { EvStation } from "@/lib/ev";
import { kakaoMapLink, kakaoRouteLink, ymdhm } from "@/lib/format";

type Kind = "all" | "fast" | "slow";
const PAGE = 20;

export default function EvStationList({ stations }: { stations: EvStation[] }) {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [freeParking, setFreeParking] = useState(false);
  const [openOnly, setOpenOnly] = useState(false);
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return stations
      .map((st) => {
        const chargers = st.chargers.filter((c) => kind === "all" || (kind === "fast" ? c.fast : !c.fast));
        const available = chargers.filter((c) => c.state === "available").length;
        return { st, chargers, available };
      })
      .filter(({ st, chargers, available }) => {
        if (chargers.length === 0) return false;
        if (availableOnly && available === 0) return false;
        if (freeParking && !st.parkingFree) return false;
        if (openOnly && st.limited) return false;
        if (words.length) {
          const hay = `${st.name} ${st.address} ${st.operator}`.toLowerCase();
          if (!words.every((w) => hay.includes(w))) return false;
        }
        return true;
      })
      .sort((a, b) => b.available - a.available || b.chargers.length - a.chargers.length);
  }, [stations, q, kind, availableOnly, freeParking, openOnly]);

  const reset = (fn: () => void) => {
    fn();
    setLimit(PAGE);
  };

  return (
    <>
      <div className="chips" aria-label="충전 속도">
        {(
          [
            ["all", "전체"],
            ["fast", "급속"],
            ["slow", "완속"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`chip${kind === k ? " is-active" : ""}`}
            onClick={() => reset(() => setKind(k))}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="filter-bar">
        <input
          className="search-input"
          type="search"
          value={q}
          onChange={(e) => reset(() => setQ(e.target.value))}
          placeholder="충전소 이름·주소·운영기관 검색"
          aria-label="충전소 검색"
        />
        <label className="toggle">
          <input type="checkbox" checked={availableOnly} onChange={(e) => reset(() => setAvailableOnly(e.target.checked))} />
          충전 가능만
        </label>
        <label className="toggle">
          <input type="checkbox" checked={freeParking} onChange={(e) => reset(() => setFreeParking(e.target.checked))} />
          무료 주차
        </label>
        <label className="toggle">
          <input type="checkbox" checked={openOnly} onChange={(e) => reset(() => setOpenOnly(e.target.checked))} />
          누구나 이용
        </label>
      </div>

      <p className="result-count">
        충전소 {filtered.length.toLocaleString()}곳 · 충전 가능한 충전기가 많은 순
      </p>

      {filtered.length === 0 ? (
        <div className="empty-box">조건에 맞는 충전소가 없습니다.</div>
      ) : (
        <div className="item-list">
          {filtered.slice(0, limit).map(({ st, chargers, available }) => {
            const fast = chargers.filter((c) => c.fast).length;
            const slow = chargers.length - fast;
            const maxKw = Math.max(...chargers.map((c) => c.output));
            const types = [...new Set(chargers.map((c) => c.typeName))];
            return (
              <article key={st.id} className="ev-station">
                <div className="ev-station__head">
                  <div>
                    <h3 className="ev-station__name">
                      <a target="_self" href={`/charge/ev-${st.zscode}-${st.id}`}>
                        {st.name}
                      </a>
                    </h3>
                    <p className="ev-station__addr">
                      {st.address}
                      {st.location && ` (${st.location})`}
                    </p>
                  </div>
                  <div className="ev-station__avail">
                    <strong className={`num${available ? "" : " is-none"}`}>
                      {available}/{chargers.length}
                    </strong>
                    충전 가능
                  </div>
                </div>

                <div className="ev-station__tags">
                  {fast > 0 && <span className="badge badge--fast">급속 {fast}</span>}
                  {slow > 0 && <span className="badge badge--slow">완속 {slow}</span>}
                  {maxKw > 0 && <span className="badge badge--muted">최대 {maxKw}kW</span>}
                  {types.map((t) => (
                    <span key={t} className="badge badge--muted">
                      {t}
                    </span>
                  ))}
                  <span className={st.parkingFree ? "badge" : "badge badge--muted"}>
                    {st.parkingFree ? "무료 주차" : "주차 유료/미확인"}
                  </span>
                  {st.limited && <span className="badge badge--warn">이용 제한</span>}
                </div>

                <div className="ev-station__foot">
                  <span style={{ color: "var(--c-text-sub)" }}>
                    {st.operator}
                    {st.useTime && ` · ${st.useTime}`}
                  </span>
                  {st.lat && st.lng ? (
                    <>
                      <a href={kakaoRouteLink(st.name, st.lat, st.lng)} target="_blank" rel="noopener noreferrer">
                        길찾기
                      </a>
                      <a href={kakaoMapLink(st.name, st.lat, st.lng)} target="_blank" rel="noopener noreferrer">
                        지도
                      </a>
                    </>
                  ) : null}
                  <a target="_self" href={`/charge/ev-${st.zscode}-${st.id}`}>
                    상세 정보
                  </a>
                </div>

                <details>
                  <summary>충전기 {chargers.length}대 상태 보기</summary>
                  {st.limited && st.limitDetail && (
                    <p style={{ marginTop: 8, fontSize: 13, color: "var(--c-text-sub)" }}>이용 제한: {st.limitDetail}</p>
                  )}
                  <ul className="charger-list">
                    {chargers.map((c) => (
                      <li key={c.id} className="charger">
                        <span className={`charger__state state--${c.state}`}>{c.statName}</span>
                        <span className="charger__info" title={`${c.typeName} ${c.output}kW · ${ymdhm(c.statUpdDt)} 갱신`}>
                          #{c.id} {c.fast ? "급속" : "완속"} {c.output ? `${c.output}kW` : ""} · {c.typeName}
                        </span>
                      </li>
                    ))}
                  </ul>
                </details>
              </article>
            );
          })}
        </div>
      )}

      {filtered.length > limit && (
        <button type="button" className="more-btn" onClick={() => setLimit((l) => l + PAGE)}>
          더 보기 ({(filtered.length - limit).toLocaleString()}곳 남음)
        </button>
      )}
    </>
  );
}
