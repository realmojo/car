"use client";

import { useCallback, useEffect, useState } from "react";
import type { StationSummary } from "@/lib/opinet";
import { SEARCH_PRODUCTS, brandName } from "@/lib/codes";
import { kakaoRouteLink, won } from "@/lib/format";

type Status = "idle" | "locating" | "loading" | "done" | "error";

const RADII = [
  { value: 1000, label: "1km" },
  { value: 3000, label: "3km" },
  { value: 5000, label: "5km" },
];

function distanceText(m?: number) {
  if (m === undefined) return "";
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${Math.round(m)}m`;
}

export default function NearbySearch() {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [prodcd, setProdcd] = useState("B027");
  const [radius, setRadius] = useState(3000);
  const [sort, setSort] = useState<1 | 2>(1);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [items, setItems] = useState<StationSummary[]>([]);

  const locate = () => {
    if (!navigator.geolocation) {
      setStatus("error");
      setError("이 브라우저는 위치 정보를 지원하지 않습니다.");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (p) => setPos({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => {
        setStatus("error");
        setError(
          e.code === e.PERMISSION_DENIED
            ? "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 허용해 주세요."
            : "현재 위치를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  };

  const search = useCallback(async () => {
    if (!pos) return;
    setStatus("loading");
    try {
      const qs = new URLSearchParams({
        lat: String(pos.lat),
        lng: String(pos.lng),
        radius: String(radius),
        prodcd,
        sort: String(sort),
      });
      const res = await fetch(`/api/fuel/around?${qs}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "검색에 실패했습니다.");
      setItems(json.items);
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "검색에 실패했습니다.");
    }
  }, [pos, radius, prodcd, sort]);

  useEffect(() => {
    // 위치나 조건이 바뀌면 외부 API 를 다시 조회한다
    // eslint-disable-next-line react-hooks/set-state-in-effect
    search();
  }, [search]);

  return (
    <>
      <div className="chips" aria-label="유종">
        {SEARCH_PRODUCTS.map((p) => (
          <button
            key={p.code}
            type="button"
            className={`chip${p.code === prodcd ? " is-active" : ""}`}
            onClick={() => setProdcd(p.code)}
          >
            {p.short}
          </button>
        ))}
      </div>
      <div className="filter-bar">
        {RADII.map((r) => (
          <button
            key={r.value}
            type="button"
            className={`chip${r.value === radius ? " is-active" : ""}`}
            onClick={() => setRadius(r.value)}
          >
            반경 {r.label}
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button type="button" className={`chip${sort === 1 ? " is-active" : ""}`} onClick={() => setSort(1)}>
          가격순
        </button>
        <button type="button" className={`chip${sort === 2 ? " is-active" : ""}`} onClick={() => setSort(2)}>
          거리순
        </button>
      </div>

      {!pos && status !== "error" && (
        <div className="empty-box">
          <p>내 위치를 기준으로 주변 주유소를 찾습니다.</p>
          <button
            type="button"
            className="lp-btn lp-btn--primary"
            style={{ marginTop: 14 }}
            onClick={locate}
            disabled={status === "locating"}
          >
            {status === "locating" ? "위치 확인 중…" : "📍 내 위치로 찾기"}
          </button>
        </div>
      )}

      {status === "error" && (
        <div className="notice notice--error" role="alert">
          {error}{" "}
          <button type="button" className="lp-btn lp-btn--primary" style={{ marginTop: 10 }} onClick={pos ? search : locate}>
            다시 시도
          </button>
        </div>
      )}

      {status === "loading" && <div className="empty-box">주변 주유소를 찾는 중입니다…</div>}

      {status === "done" &&
        (items.length === 0 ? (
          <div className="empty-box">반경 안에 해당 유종을 파는 주유소가 없습니다. 반경을 넓혀 보세요.</div>
        ) : (
          <>
            <p className="result-count">
              {items.length}곳 · {sort === 1 ? "가격 낮은 순" : "가까운 순"}
            </p>
            <ol className="station-list">
              {items.map((s, i) => (
                <li key={s.id} className="station">
                  <span className={`station__rank num${i < 3 ? " is-top" : ""}`}>{i + 1}</span>
                  <div>
                    <div className="station__name">
                      <a target="_self" href={`/fuel/station/${s.id}`}>
                        {s.name}
                      </a>
                      {s.brand && <span className="badge badge--muted">{brandName(s.brand)}</span>}
                    </div>
                    <div className="station__addr">
                      {distanceText(s.distance)}
                      {s.lat && s.lng && (
                        <>
                          {" · "}
                          <a
                            href={kakaoRouteLink(s.name, s.lat, s.lng)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: "var(--c-primary)", fontWeight: 700 }}
                          >
                            길찾기
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="station__price num">
                    {won(s.price)}
                    <small>원</small>
                  </div>
                </li>
              ))}
            </ol>
          </>
        ))}
    </>
  );
}
