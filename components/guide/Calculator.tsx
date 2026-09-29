"use client";

import { useState } from "react";
import { won } from "@/lib/format";

const FUELS = [
  { code: "B027", name: "휘발유", fallback: 1650 },
  { code: "D047", name: "경유", fallback: 1520 },
  { code: "K015", name: "LPG", fallback: 1030 },
  { code: "B034", name: "고급휘발유", fallback: 1920 },
];

/** 환경부 공공 급속충전기(100kW 이상) 요금 기준값. 사용자가 바꿀 수 있다 */
const DEFAULT_EV_RATE = 347.2;

function numberOr(v: string, fallback = 0) {
  const n = Number(v.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** 가격은 예시값이며 사용자가 직접 바꿔 넣는다 (외부 유가 데이터를 쓰지 않는다) */
export default function Calculator({ initialMode }: { initialMode: "fuel" | "ev" }) {
  const priceOf = (code: string) => FUELS.find((f) => f.code === code)!.fallback;

  const [mode, setMode] = useState(initialMode);
  const [distance, setDistance] = useState("1500");
  const [fuel, setFuel] = useState("B027");
  const [efficiency, setEfficiency] = useState("12");
  const [price, setPrice] = useState(String(priceOf("B027")));
  const [evEfficiency, setEvEfficiency] = useState("5.5");
  const [evRate, setEvRate] = useState(String(DEFAULT_EV_RATE));

  const km = numberOr(distance);
  const fuelMonthly = numberOr(efficiency) > 0 ? (km / numberOr(efficiency)) * numberOr(price) : 0;
  const evMonthly = numberOr(evEfficiency) > 0 ? (km / numberOr(evEfficiency)) * numberOr(evRate) : 0;
  // 전기차 모드에서 비교용으로 쓰는 휘발유차(연비 12km/L) 유류비
  const gasolineCompare = (km / 12) * priceOf("B027");

  const monthly = mode === "fuel" ? fuelMonthly : evMonthly;

  return (
    <div className="panel panel--pad">
      <div className="seg" role="tablist">
        <button type="button" role="tab" aria-selected={mode === "fuel"} className={mode === "fuel" ? "is-active" : ""} onClick={() => setMode("fuel")}>
          ⛽ 내연기관차
        </button>
        <button type="button" role="tab" aria-selected={mode === "ev"} className={mode === "ev" ? "is-active" : ""} onClick={() => setMode("ev")}>
          ⚡ 전기차
        </button>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="distance">월 주행거리 (km)</label>
          <input id="distance" inputMode="decimal" value={distance} onChange={(e) => setDistance(e.target.value)} />
          <p className="field__hint">국내 승용차 평균은 월 1,000~1,500km 정도입니다.</p>
        </div>

        {mode === "fuel" ? (
          <>
            <div className="field">
              <label htmlFor="fuel">유종</label>
              <select
                id="fuel"
                value={fuel}
                onChange={(e) => {
                  setFuel(e.target.value);
                  setPrice(String(priceOf(e.target.value)));
                }}
              >
                {FUELS.map((f) => (
                  <option key={f.code} value={f.code}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="efficiency">연비 (km/L)</label>
              <input id="efficiency" inputMode="decimal" value={efficiency} onChange={(e) => setEfficiency(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="price">가격 (원/L)</label>
              <input id="price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
              <p className="field__hint">예시 가격입니다. 최근 주유한 가격으로 바꿔 넣으세요.</p>
            </div>
          </>
        ) : (
          <>
            <div className="field">
              <label htmlFor="ev-eff">전비 (km/kWh)</label>
              <input id="ev-eff" inputMode="decimal" value={evEfficiency} onChange={(e) => setEvEfficiency(e.target.value)} />
              <p className="field__hint">중형 전기 SUV 기준 5km/kWh 안팎입니다.</p>
            </div>
            <div className="field">
              <label htmlFor="ev-rate">충전 단가 (원/kWh)</label>
              <input id="ev-rate" inputMode="decimal" value={evRate} onChange={(e) => setEvRate(e.target.value)} />
              <p className="field__hint">공공 급속 기준 예시값입니다. 완속·아파트 요금은 더 저렴할 수 있습니다.</p>
            </div>
          </>
        )}
      </div>

      <div className="calc-result" aria-live="polite">
        <div>
          <span>한 달</span>
          <strong className="num">{won(monthly)}원</strong>
        </div>
        <div>
          <span>1년</span>
          <strong className="num">{won(monthly * 12)}원</strong>
        </div>
        <div>
          <span>1km 당</span>
          <strong className="num">{km > 0 ? won(monthly / km, 1) : "0"}원</strong>
        </div>
      </div>

      {mode === "ev" && km > 0 && (
        <p className="source-note" style={{ color: "var(--c-text-sub)" }}>
          같은 거리를 휘발유차(연비 12km/L, 휘발유 예시가 {won(priceOf("B027"))}원/L)로 달리면 한 달{" "}
          <strong className="num">{won(gasolineCompare)}원</strong> 으로, 전기차가 한 달{" "}
          <strong className="num">{won(Math.max(0, gasolineCompare - evMonthly))}원</strong> 더 저렴합니다.
        </p>
      )}
    </div>
  );
}
