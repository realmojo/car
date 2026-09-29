/** 가이드(2depth) 목록 */
export interface Guide {
  slug: string;
  icon: string;
  title: string;
  desc: string;
  /** 페이지 <title> */
  seoTitle: string;
}

export const GUIDES: Guide[] = [
  {
    slug: "fuel-economy",
    icon: "🏆",
    title: "차종별 연비 순위",
    desc: "한국에너지공단 표시연비로 본 복합연비 높은 차 순위. 휘발유·경유·하이브리드별로 비교합니다.",
    seoTitle: "자동차 연비 순위 - 복합연비 높은 차 TOP (에너지공단 표시연비)",
  },
  {
    slug: "ev-range",
    icon: "🔋",
    title: "전기차 주행거리 순위",
    desc: "1회 충전 주행거리가 긴 전기차 순위와 전비(km/kWh)를 비교합니다.",
    seoTitle: "전기차 1회 충전 주행거리 순위와 전비 비교",
  },
  {
    slug: "calculator",
    icon: "🧮",
    title: "유류비·충전비 계산기",
    desc: "주행거리와 연비(전비)로 한 달 연료비를 계산하고 전기차와 내연기관차를 비교합니다.",
    seoTitle: "유류비·전기차 충전비 계산기 - 월 연료비 계산",
  },
  {
    slug: "charger-types",
    icon: "🔌",
    title: "전기차 충전 규격 총정리",
    desc: "DC콤보, 차데모, AC3상, NACS, 완속 5핀까지 내 차에 맞는 충전기 고르는 법.",
    seoTitle: "전기차 충전 규격 총정리 - DC콤보·차데모·NACS·완속 차이",
  },
  {
    slug: "car-inspection",
    icon: "📋",
    title: "자동차 검사 주기와 준비물",
    desc: "정기검사·종합검사 주기, 검사 기간, 늦었을 때 과태료와 예약 방법을 정리했습니다.",
    seoTitle: "자동차 검사 주기 총정리 - 정기검사·종합검사 기간과 과태료",
  },
];

export function findGuide(slug: string) {
  return GUIDES.find((g) => g.slug === slug);
}
