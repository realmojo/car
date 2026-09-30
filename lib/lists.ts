/**
 * 지역 목록 페이지의 종류 정의. 주소의 두 번째 세그먼트(/parking/<종류>/…)가 키다.
 * 페이지(components/lists)·본문(lib/content/region.ts)·사이트맵이 같이 쓴다.
 */
import type { PlaceDataset } from "./places";

export interface PlaceKind {
  section: "parking" | "repair";
  kind: string;
  dataset: PlaceDataset;
  /** 이 종류를 정하는 플래그 (무료 = free). 없으면 데이터셋 전체 */
  flag?: string;
  /** "무료 주차장" — 제목·본문에 들어가는 이름 */
  label: string;
  icon: string;
  /** 목록 안에서 더 좁히는 필터 (?f=). 색인하지 않는다 */
  subFilters: Array<{ key: string; label: string }>;
  /** 제목 뒤에 붙는 설명 */
  titleTail: string;
  placeholder: string;
}

export const PARKING_KINDS: PlaceKind[] = [
  {
    section: "parking",
    kind: "all",
    dataset: "parking",
    label: "주차장",
    icon: "🅿️",
    subFilters: [{ key: "disabled", label: "장애인 전용구역" }],
    titleTail: "공영·무료 주차장 요금·운영시간",
    placeholder: "주차장 이름·주소 검색",
  },
  {
    section: "parking",
    kind: "free",
    dataset: "parking",
    flag: "free",
    label: "무료 주차장",
    icon: "🅿️",
    subFilters: [{ key: "disabled", label: "장애인 전용구역" }],
    titleTail: "위치·운영시간·주차면",
    placeholder: "무료 주차장 이름·주소 검색",
  },
  {
    section: "parking",
    kind: "public",
    dataset: "parking",
    flag: "public",
    label: "공영주차장",
    icon: "🅿️",
    subFilters: [
      { key: "free", label: "무료" },
      { key: "disabled", label: "장애인 전용구역" },
    ],
    titleTail: "주차 요금·운영시간·위치",
    placeholder: "공영주차장 이름·주소 검색",
  },
];

export const REPAIR_KINDS: PlaceKind[] = [
  {
    section: "repair",
    kind: "shop",
    dataset: "repair",
    label: "자동차 정비소",
    icon: "🔧",
    subFilters: [
      { key: "general", label: "종합정비" },
      { key: "small", label: "소형정비" },
      { key: "partial", label: "전문정비" },
    ],
    titleTail: "카센터·공업사 위치·전화번호",
    placeholder: "정비소 이름·주소 검색",
  },
  {
    section: "repair",
    kind: "inspection",
    dataset: "inspection",
    label: "자동차 검사소",
    icon: "🔍",
    subFilters: [
      { key: "ts", label: "공단 직영" },
      { key: "private", label: "민간 지정" },
    ],
    titleTail: "공단·민간 검사소 운영시간·위치",
    placeholder: "검사소 이름·주소 검색",
  },
];

export const PLACE_KINDS = [...PARKING_KINDS, ...REPAIR_KINDS];

export function findPlaceKind(section: string, kind: string) {
  return PLACE_KINDS.find((k) => k.section === section && k.kind === kind);
}

/** 상세 페이지 주소 */
export function detailPath(k: PlaceKind, key: string, sido: string) {
  if (k.dataset === "parking") return `/parking/${sido}-${key}`;
  return `/repair/${k.dataset === "repair" ? "shop" : "insp"}-${sido}-${key}`;
}

/** 카테고리 첫 화면 (메뉴·브레드크럼의 카테고리 링크) */
export const SECTION_HOME = {
  parking: { name: "주차", path: "/parking/all" },
  repair: { name: "정비", path: "/repair/shop" },
  charge: { name: "충전", path: "/charge/ev" },
} as const;
