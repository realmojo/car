/**
 * 상세 페이지 본문(글) 공통 도구.
 * 각 데이터셋의 본문 생성기(lib/content/*.ts)가 데이터 값으로 문장을 조립할 때 쓴다.
 */
import type { Row } from "../dataset-types";

/** 본문 한 구역: 소제목 + 문단 / 목록 / 표 / 링크 */
export interface Block {
  h2: string;
  p?: string[];
  ul?: string[];
  table?: { head: string[]; rows: string[][] };
  links?: Array<{ label: string; href: string; note?: string }>;
  /** 표·목록 뒤에 붙는 문단 */
  after?: string[];
}

export interface Faq {
  q: string;
  a: string;
}

export interface Article {
  /** 첫 화면 요약 문단 */
  lead: string[];
  blocks: Block[];
  faq: Faq[];
}

/* ------------------------------------------------------------ 조사 */

const DIGIT_BATCHIM = new Set(["0", "1", "3", "6", "7", "8"]);

/** 마지막 글자에 받침이 있는지. 숫자·영문도 읽는 소리로 대강 판단한다 */
function batchim(word: string): { has: boolean; rieul: boolean } {
  const s = word.replace(/[\s)\]}"'’”.,·]+$/g, "");
  const ch = s.charAt(s.length - 1);
  if (!ch) return { has: false, rieul: false };
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28;
    return { has: jong !== 0, rieul: jong === 8 };
  }
  if (/\d/.test(ch)) return { has: DIGIT_BATCHIM.has(ch), rieul: ch === "1" || ch === "7" || ch === "8" };
  if (/[lmnr]/i.test(ch)) return { has: true, rieul: /[lr]/i.test(ch) };
  return { has: false, rieul: false };
}

type Josa = "은/는" | "이/가" | "을/를" | "과/와" | "으로/로" | "이다/다" | "이에요/예요";

/** 단어 + 알맞은 조사. josa("강남구", "은/는") → "강남구는" */
export function josa(word: string, pair: Josa): string {
  const { has, rieul } = batchim(word);
  const [withB, withoutB] = pair.split("/");
  if (pair === "으로/로") return word + (has && !rieul ? "으로" : "로");
  return word + (has ? withB : withoutB);
}

/* ------------------------------------------------------------ 값 도구 */

/** 상세 표(info)에서 항목 값 */
export function infoOf(row: Row, label: string): string {
  return row.info.find(([k]) => k === label)?.[1] ?? "";
}

export const n = (v: number) => v.toLocaleString("ko-KR");

/** "1,000원" / "30분" 같은 문자열의 첫 숫자 */
export function firstNumber(v: string): number | undefined {
  const m = v.replace(/,/g, "").match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

/** 여러 값 중 비어 있지 않은 것만 이어 붙인다 */
export function join(parts: Array<string | false | undefined | null>, sep = " "): string {
  return parts.filter(Boolean).join(sep);
}

/** 퍼센트 (소수 첫째 자리) */
export function pct(part: number, total: number): string {
  if (!total) return "0%";
  return `${Math.round((part / total) * 1000) / 10}%`;
}

export function km(v: number): string {
  return v < 1 ? `${Math.round(v * 1000)}m` : `${v.toFixed(1)}km`;
}

/** 같은 시군구에 비교할 시설이 없을 때 넣는 안내 */
export function noNearbyBlock(kind: string, region: string, sidoName: string, sidoHref: string): Block {
  return {
    h2: `${region} 주변 ${kind}`,
    p: [
      `공공데이터에는 ${region}에 이곳 말고 다른 ${josa(kind, "이/가")} 등록되어 있지 않습니다. 등록이 늦거나 관리기관이 데이터를 따로 내지 않는 경우도 있으므로, 실제로는 가까운 곳에 시설이 더 있을 수 있습니다.`,
      `비교할 곳을 찾는다면 ${sidoName} 전체 목록에서 이웃 시군구의 ${josa(kind, "을/를")} 함께 살펴보세요. 지도 서비스에서 주변을 검색하면 공공데이터에 없는 곳도 확인할 수 있습니다.`,
    ],
    links: [{ label: `${sidoName} ${kind} 전체 목록`, href: sidoHref }],
  };
}
