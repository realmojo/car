import type { Metadata } from "next";

/** 사이트 전역 SEO 설정 */
export const SITE = {
  name: "김군카",
  nameEn: "Car Kimgoon",
  url: process.env.NEXT_PUBLIC_BASE_URL || "https://car.kimgoon.kr",
  locale: "ko_KR",
  description:
    "전기차·수소 충전소와 실시간 충전기 상태, 공영·무료 주차장, 정비소와 자동차 검사소, 리콜, 도로 돌발상황을 공공데이터로 한곳에서 확인하세요.",
} as const;

export function absoluteUrl(path: string): string {
  if (!path || path === "/") return SITE.url;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface BuildMetadataInput {
  path: string;
  title: string;
  description: string;
  keywords?: string[];
}

/**
 * 모든 페이지가 공유하는 메타데이터를 생성한다.
 * 하위 세그먼트가 openGraph 를 정의하면 상위 값을 통째로 대체하므로
 * 항상 완전한 세트를 채운다. (키워드에그와 동일한 방식)
 */
export function buildMetadata({
  path,
  title,
  description,
  keywords,
}: BuildMetadataInput): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      type: "website",
    },
    twitter: { card: "summary", title, description },
    robots: { index: true, follow: true },
  };
}

/** 이동 경로 JSON-LD */
export function breadcrumbJsonLd(trail: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

/** 자주 묻는 질문 JSON-LD */
export function faqJsonLd(items: Array<{ q: string; a: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: "ko-KR",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
