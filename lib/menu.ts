export interface MenuItem {
  name: string;
  href: string;
}

export interface NavItem extends MenuItem {
  icon: string;
  desc: string;
  children?: MenuItem[];
}

/**
 * 상단 GNB = 1depth 카테고리.
 * 하위 분류는 같은 카테고리 페이지의 ?type= / ?f= 로 나뉘고, 상세는 /<카테고리>/<id> (2depth).
 */
export const NAV: NavItem[] = [
  {
    name: "충전",
    href: "/charge",
    icon: "⚡",
    desc: "전기차 충전소 위치와 실시간 충전기 상태, 수소충전소",
    children: [
      { name: "전기차 충전소", href: "/charge?type=ev" },
      { name: "수소 충전소", href: "/charge?type=h2" },
    ],
  },
  {
    name: "주차",
    href: "/parking",
    icon: "🅿️",
    desc: "공영·민영 주차장 위치, 요금, 운영시간",
    children: [
      { name: "전체 주차장", href: "/parking" },
      { name: "공영 주차장", href: "/parking?f=public" },
      { name: "무료 주차장", href: "/parking?f=free" },
    ],
  },
  {
    name: "정비",
    href: "/repair",
    icon: "🔧",
    desc: "동네 정비소, 자동차 검사소, 리콜 정보",
    children: [
      { name: "정비소", href: "/repair?type=shop" },
      { name: "자동차 검사소", href: "/repair?type=inspection" },
      { name: "리콜 조회", href: "/repair?type=recall" },
    ],
  },
  {
    name: "이동",
    href: "/road",
    icon: "🚗",
    desc: "고속도로·국도 돌발상황, 휴게소와 졸음쉼터",
    children: [
      { name: "실시간 돌발상황", href: "/road?type=event" },
      { name: "휴게소·졸음쉼터", href: "/road?type=rest" },
    ],
  },
  { name: "가이드", href: "/guide", icon: "📖", desc: "연비 순위, 충전 규격, 검사 주기, 비용 계산기" },
  { name: "통합 검색", href: "/search", icon: "🔍", desc: "주차장·정비소·검사소·충전소를 한 번에" },
];

/** 푸터 안내 페이지 */
export const SITE_LINKS: MenuItem[] = [
  { name: "사이트 소개", href: "/about" },
  { name: "개인정보처리방침", href: "/privacy" },
  { name: "이용약관", href: "/terms" },
];
