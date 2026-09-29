/**
 * 상세 페이지 구조화 데이터(JSON-LD).
 * 이동 경로(BreadcrumbList)는 Crumbs 컴포넌트가, FAQPage 는 ArticleBody 가 따로 넣는다.
 */
import type { Row } from "../dataset-types";
import { SITE, absoluteUrl } from "../seo";
import { infoOf } from "./common";

type Json = Record<string, unknown>;

export function postalAddress(address?: string, region?: string, locality?: string): Json | undefined {
  if (!address) return undefined;
  return {
    "@type": "PostalAddress",
    streetAddress: address,
    ...(region ? { addressRegion: region } : {}),
    ...(locality ? { addressLocality: locality } : {}),
    addressCountry: "KR",
  };
}

export function geo(lat?: number, lng?: number): Json | undefined {
  return lat && lng ? { "@type": "GeoCoordinates", latitude: lat, longitude: lng } : undefined;
}

/** "09:00 ~ 18:00" / "24시간" → schema.org 운영시간 */
function hours(days: string[], range: string): Json | undefined {
  if (!range) return undefined;
  if (range === "24시간") return { "@type": "OpeningHoursSpecification", dayOfWeek: days, opens: "00:00", closes: "23:59" };
  const m = range.match(/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/);
  if (!m) return undefined;
  const t = (h: string, mm: string) => `${h.padStart(2, "0")}:${mm}`;
  return { "@type": "OpeningHoursSpecification", dayOfWeek: days, opens: t(m[1], m[2]), closes: t(m[3], m[4]) };
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

/** 평일·토요일·공휴일 운영시간 표 → OpeningHoursSpecification[] */
export function openingHours(weekday: string, saturday: string, holiday: string): Json[] {
  return [hours(WEEKDAYS, weekday), hours(["Saturday"], saturday), hours(["Sunday", "PublicHolidays"], holiday)].filter(
    (x): x is Json => Boolean(x),
  );
}

export interface PlaceLd {
  type: string | string[];
  path: string;
  name: string;
  description: string;
  row?: Row;
  address?: string;
  region?: string;
  locality?: string;
  lat?: number;
  lng?: number;
  tel?: string;
  extra?: Json;
}

/** 장소형 상세 페이지 (주차장·정비소·검사소·충전소·휴게소) */
export function placeJsonLd(p: PlaceLd): Json {
  const url = absoluteUrl(p.path);
  const g = geo(p.lat, p.lng);
  return {
    "@context": "https://schema.org",
    "@type": p.type,
    "@id": `${url}#place`,
    name: p.name,
    description: p.description,
    url,
    ...(postalAddress(p.address, p.region, p.locality) ? { address: postalAddress(p.address, p.region, p.locality) } : {}),
    ...(g ? { geo: g, hasMap: `https://map.kakao.com/link/map/${encodeURIComponent(p.name)},${p.lat},${p.lng}` } : {}),
    ...(p.tel ? { telephone: p.tel } : {}),
    ...(p.row ? { additionalProperty: p.row.info.slice(0, 12).map(([name, value]) => ({ "@type": "PropertyValue", name, value })) } : {}),
    ...p.extra,
  };
}

/** 글 형태 페이지 (리콜·가이드) */
export function articleJsonLd(a: { path: string; title: string; description: string; date?: string; about?: Json }): Json {
  const url = absoluteUrl(a.path);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${url}#article`,
    headline: a.title.slice(0, 110),
    description: a.description,
    inLanguage: "ko-KR",
    mainEntityOfPage: url,
    url,
    ...(a.date ? { datePublished: a.date, dateModified: a.date } : {}),
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: { "@type": "Organization", name: SITE.name, url: SITE.url, logo: { "@type": "ImageObject", url: absoluteUrl("/og.png") } },
    image: absoluteUrl("/og.png"),
    ...(a.about ? { about: a.about } : {}),
  };
}

/** 페이지 자체 (WebPage) — 장소 페이지의 주 엔티티 연결용 */
export function webPageJsonLd(path: string, title: string, description: string, mainEntityId?: string): Json {
  const url = absoluteUrl(path);
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": url,
    url,
    name: title,
    description,
    inLanguage: "ko-KR",
    isPartOf: { "@type": "WebSite", name: SITE.name, url: SITE.url },
    ...(mainEntityId ? { mainEntity: { "@id": mainEntityId } } : {}),
    dateModified: new Date().toISOString().slice(0, 10),
  };
}

/** 데이터 기준일 (info 의 "기준일") */
export function referenceDate(row: Row): string | undefined {
  const v = infoOf(row, "기준일");
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined;
}
