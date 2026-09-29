"use client";

import { useMemo, useRef, useState } from "react";
import type { RecentPrice } from "@/lib/opinet";
import { md, won, ymd } from "@/lib/format";

interface Series {
  code: string;
  name: string;
  color: string;
}

const SERIES: Series[] = [
  { code: "B027", name: "휘발유", color: "var(--fuel-gasoline)" },
  { code: "D047", name: "경유", color: "var(--fuel-diesel)" },
];

const W = 800;
const H = 240;
const PAD = { top: 16, right: 64, bottom: 28, left: 52 };

/** 최근 7일 전국 평균 휘발유·경유 가격 추이 (단일 축, 같은 단위) */
export default function TrendChart({ data }: { data: RecentPrice[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<number | null>(null);

  const { dates, lines, yTicks, x, y } = useMemo(() => {
    const dates = [...new Set(data.map((d) => d.date))].sort();
    const lines = SERIES.map((s) => ({
      ...s,
      values: dates.map((date) => data.find((d) => d.date === date && d.prodcd === s.code)?.price ?? null),
    }));
    const all = lines.flatMap((l) => l.values).filter((v): v is number => v !== null);
    const min = Math.min(...all);
    const max = Math.max(...all);
    const step = niceStep((max - min) / 4 || 10);
    const lo = Math.floor(min / step) * step - step;
    const hi = Math.ceil(max / step) * step + step;
    const yTicks: number[] = [];
    for (let v = lo; v <= hi + 0.001; v += step) yTicks.push(v);
    const x = (i: number) =>
      PAD.left + (dates.length <= 1 ? 0 : (i * (W - PAD.left - PAD.right)) / (dates.length - 1));
    const y = (v: number) => PAD.top + ((hi - v) * (H - PAD.top - PAD.bottom)) / (hi - lo || 1);
    return { dates, lines, yTicks, x, y };
  }, [data]);

  if (dates.length === 0) return null;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < dates.length; i++) {
      if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i;
    }
    setHover(best);
  };

  const tipLeft = hover === null ? 0 : (x(hover) / W) * 100;
  const tipTop =
    hover === null
      ? 0
      : (Math.min(...lines.map((l) => y(l.values[hover] ?? Infinity))) / H) * 100;

  return (
    <div className="chart" ref={wrapRef}>
      <div className="chart__legend">
        {SERIES.map((s) => (
          <span key={s.code}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
        <span>단위: 원/L</span>
      </div>

      <div style={{ position: "relative" }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label="최근 7일 전국 평균 휘발유·경유 가격 추이"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="#e4e6e0" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill="#9aa1a8">
                {won(v)}
              </text>
            </g>
          ))}
          {dates.map((d, i) => (
            <text key={d} x={x(i)} y={H - 6} textAnchor="middle" fontSize={12} fill="#9aa1a8">
              {md(d)}
            </text>
          ))}

          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="#c8ced6" strokeWidth={1} />
          )}

          {lines.map((l) => {
            const pts = l.values
              .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
              .filter(Boolean)
              .join(" ");
            const lastIdx = l.values.length - 1;
            const last = l.values[lastIdx];
            return (
              <g key={l.code}>
                <polyline
                  points={pts}
                  fill="none"
                  stroke={l.color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {last !== null && (
                  <>
                    <circle cx={x(lastIdx)} cy={y(last)} r={4} fill={l.color} stroke="#f9f9f7" strokeWidth={2} />
                    <text x={x(lastIdx) + 10} y={y(last) + 4} fontSize={12} fontWeight={700} fill="#2a2a2a">
                      {l.name}
                    </text>
                  </>
                )}
                {hover !== null && l.values[hover] !== null && (
                  <circle
                    cx={x(hover)}
                    cy={y(l.values[hover] as number)}
                    r={5}
                    fill={l.color}
                    stroke="#f9f9f7"
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}
          {/* 포인터 이벤트를 받는 투명 영역 */}
          <rect x={0} y={0} width={W} height={H} fill="transparent" />
        </svg>

        {hover !== null && (
          <div className="chart__tip" style={{ left: `${tipLeft}%`, top: `calc(${tipTop}% - 12px)` }}>
            <b>{ymd(dates[hover])}</b>
            {lines.map((l) => (
              <span key={l.code}>
                <em style={{ fontStyle: "normal" }}>{l.name}</em>
                <strong className="num">{won(l.values[hover], 2)}원</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      <details>
        <summary>표로 보기</summary>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>날짜</th>
                {lines.map((l) => (
                  <th key={l.code} className="r">{l.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map((d, i) => (
                <tr key={d}>
                  <td>{ymd(d)}</td>
                  {lines.map((l) => (
                    <td key={l.code} className="r num">{won(l.values[i], 2)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function niceStep(raw: number) {
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}
