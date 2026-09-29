export interface MenuItem {
  name: string;
  href: string;
}

/** 상단 GNB */
export const NAV: MenuItem[] = [
  { name: "유가 정보", href: "/fuel" },
  { name: "내 주변 주유소", href: "/fuel/nearby" },
  { name: "전기차 충전소", href: "/ev" },
  { name: "유류비 계산기", href: "/calculator" },
];

/** 푸터 안내 페이지 */
export const SITE_LINKS: MenuItem[] = [
  { name: "사이트 소개", href: "/about" },
  { name: "개인정보처리방침", href: "/privacy" },
  { name: "이용약관", href: "/terms" },
];
