/**
 * MOCK_DATA=1 일 때만 쓰는 가짜 데이터.
 * API 키 없이 화면을 개발·확인하기 위한 용도이며 운영에서는 사용하지 않는다.
 */
import type { AreaAvg, OilAvg, RecentPrice, StationDetail, StationSummary } from "./opinet";
import type { EvStation } from "./ev";
import { CHARGER_STATUS, CHARGER_TYPES, PRODUCTS, SIDO, SLOW_TYPES } from "./codes";

function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const BASE: Record<string, number> = { B027: 1668.4, D047: 1542.7, B034: 1932.1, K015: 1041.3, C004: 1352.8 };

function today(offset = 0) {
  const d = new Date(Date.now() - offset * 86400000 + 9 * 3600000);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export function avgAll(): OilAvg[] {
  return PRODUCTS.map((p, i) => ({
    prodcd: p.code,
    name: p.name,
    price: BASE[p.code],
    diff: [0.42, -0.31, 0.12, 0, -0.08][i],
    date: today(),
  }));
}

export function recent(): RecentPrice[] {
  const out: RecentPrice[] = [];
  for (const p of PRODUCTS) {
    const r = rng(p.code);
    let price = BASE[p.code] - 6;
    for (let d = 6; d >= 0; d--) {
      out.push({ date: today(d), prodcd: p.code, price: Number(price.toFixed(2)) });
      price += (r() - 0.35) * 2.2;
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function sidoAvg(prodcd: string): AreaAvg[] {
  const r = rng(prodcd);
  return SIDO.map((s) => ({
    code: s.opinet,
    name: s.short,
    price: Number((BASE[prodcd] + (s.slug === "seoul" ? 70 : 0) + (r() - 0.5) * 40).toFixed(2)),
    diff: Number(((r() - 0.5) * 2).toFixed(2)),
  }));
}

const SIGUN_NAMES = ["종로구", "중구", "용산구", "성동구", "광진구", "마포구", "강서구", "강남구", "송파구", "강동구"];

export function sigunAvg(sido: string, prodcd: string): AreaAvg[] {
  const r = rng(sido + prodcd);
  return SIGUN_NAMES.map((name, i) => ({
    code: `${sido}${String(i + 1).padStart(2, "0")}`,
    name,
    price: Number((BASE[prodcd] + (r() - 0.4) * 80).toFixed(2)),
    diff: Number(((r() - 0.5) * 2).toFixed(2)),
  }));
}

const BRAND_CODES = ["SKE", "GSC", "HDO", "SOL", "RTE", "NHO"];

function fakeStation(seed: string, i: number, prodcd: string): StationSummary {
  const r = rng(seed + i);
  return {
    id: `A00${String(1000 + i * 37).slice(0, 4)}${seed.length}`,
    name: `${["행복", "제일", "중앙", "대한", "신촌", "한강", "만남의"][i % 7]}주유소`,
    brand: BRAND_CODES[Math.floor(r() * BRAND_CODES.length)],
    price: Math.round(BASE[prodcd] - 90 + i * 6 + r() * 4),
    address: `서울 강남구 테헤란로 ${100 + i * 12}`,
    lat: 37.5 + r() * 0.05,
    lng: 127.02 + r() * 0.06,
  };
}

export function lowest(area: string, prodcd: string, cnt: number): StationSummary[] {
  return Array.from({ length: Math.min(cnt, 12) }, (_, i) => fakeStation(area, i, prodcd));
}

export function around(lat: number, lng: number, prodcd: string, sort: 1 | 2): StationSummary[] {
  const list = Array.from({ length: 10 }, (_, i) => ({
    ...fakeStation("around", i, prodcd),
    distance: Math.round(250 + rng("d" + i)() * 4500),
  }));
  return list.sort((a, b) => (sort === 1 ? a.price - b.price : (a.distance ?? 0) - (b.distance ?? 0)));
}

export function detail(id: string): StationDetail {
  return {
    id,
    name: "행복주유소",
    brand: "SKE",
    subBrand: "",
    address: "서울 강남구 테헤란로 100",
    oldAddress: "서울 강남구 역삼동 123-4",
    tel: "02-000-0000",
    lpg: false,
    maint: true,
    carWash: true,
    cvs: true,
    kpetro: true,
    lat: 37.5009,
    lng: 127.0364,
    prices: ["B027", "D047", "B034"].map((p) => ({
      prodcd: p,
      price: Math.round(BASE[p] - 40),
      tradedAt: `${today()}093000`,
    })),
  };
}

export function evStations(seed: string): EvStation[] {
  const r = rng(seed);
  const types = Object.keys(CHARGER_TYPES);
  const stats = ["2", "2", "2", "3", "3", "1", "5", "9"];
  return Array.from({ length: 48 }, (_, i) => {
    const n = 1 + Math.floor(r() * 6);
    return {
      id: `ME${String(174000 + i)}`,
      name: `${["구청", "주민센터", "이마트", "홈플러스", "공영주차장", "아파트", "체육공원"][i % 7]} ${i + 1}`,
      address: `서울특별시 강남구 선릉로 ${10 + i * 7}`,
      location: i % 3 === 0 ? "지하 2층" : "",
      useTime: i % 4 === 0 ? "09:00~18:00" : "24시간 이용가능",
      lat: 37.49 + r() * 0.06,
      lng: 127.02 + r() * 0.08,
      operator: ["환경부", "에버온", "차지비", "SK일렉링크", "대영채비"][i % 5],
      operatorTel: "1661-9408",
      parkingFree: r() > 0.5,
      limited: i % 6 === 0,
      limitDetail: i % 6 === 0 ? "입주민 외 이용 제한" : "",
      note: "",
      chargers: Array.from({ length: n }, (_, j) => {
        const type = types[Math.floor(r() * types.length)];
        const stat = stats[Math.floor(r() * stats.length)];
        const fast = !SLOW_TYPES.has(type);
        return {
          id: String(j + 1).padStart(2, "0"),
          type,
          typeName: CHARGER_TYPES[type],
          fast,
          output: fast ? [50, 100, 200][Math.floor(r() * 3)] : 7,
          stat,
          statName: CHARGER_STATUS[stat].name,
          state: CHARGER_STATUS[stat].state,
          statUpdDt: `${today()}1${Math.floor(r() * 9)}2000`,
        };
      }),
    };
  });
}
