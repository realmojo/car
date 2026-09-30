export interface MenuItem {
  name: string;
  href: string;
}

export interface NavItem extends MenuItem {
  /** 이 경로 아래면 메뉴를 켠다 (첫 화면 href 가 하위 경로일 때) */
  match?: string;
  icon: string;
  desc: string;
  children?: MenuItem[];
}

/**
 * 상단 GNB = 1depth 카테고리.
 * 하위 분류는 /<카테고리>/<종류>/<시도>/<시군구> 목록이고(lib/regions.ts), 상세는 /<카테고리>/<id>.
 */
export const NAV: NavItem[] = [
  {
    name: "충전",
    href: "/charge/ev",
    match: "/charge",
    icon: "⚡",
    desc: "전기차 충전소 위치와 실시간 충전기 상태, 수소충전소",
    children: [
      { name: "전기차 충전소", href: "/charge/ev" },
      { name: "수소 충전소", href: "/charge/h2" },
    ],
  },
  {
    name: "주차",
    href: "/parking/all",
    match: "/parking",
    icon: "🅿️",
    desc: "공영·민영 주차장 위치, 요금, 운영시간",
    children: [
      { name: "전체 주차장", href: "/parking/all" },
      { name: "공영 주차장", href: "/parking/public" },
      { name: "무료 주차장", href: "/parking/free" },
    ],
  },
  {
    name: "정비",
    href: "/repair/shop",
    match: "/repair",
    icon: "🔧",
    desc: "동네 정비소, 자동차 검사소, 리콜 정보",
    children: [
      { name: "정비소", href: "/repair/shop" },
      { name: "자동차 검사소", href: "/repair/inspection" },
      { name: "리콜 조회", href: "/repair?type=recall" },
    ],
  },
  {
    name: "이동",
    href: "/road",
    icon: "🚗",
    desc: "실시간 도로 CCTV, 돌발상황, 휴게소와 졸음쉼터",
    children: [
      { name: "실시간 돌발상황", href: "/road?type=event" },
      { name: "실시간 CCTV", href: "/road?type=cctv" },
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
