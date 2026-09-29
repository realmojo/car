import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SITE, buildMetadata } from "@/lib/seo";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";

const title = "김군카 - 전기차 충전소·주차장·정비소·도로 상황 찾기";

export const metadata: Metadata = {
  ...buildMetadata({
    path: "/",
    title,
    description: SITE.description,
    keywords: [
      "전기차 충전소",
      "충전기 상태",
      "수소충전소",
      "공영주차장",
      "무료 주차장",
      "자동차 정비소",
      "자동차 검사소",
      "자동차 리콜",
      "고속도로 돌발상황",
      "자동차 연비 순위",
    ],
  }),
  metadataBase: new URL(SITE.url),
  applicationName: SITE.name,
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#171d26",
};

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE.url}/#website`,
  name: SITE.name,
  alternateName: SITE.nameEn,
  url: SITE.url,
  inLanguage: "ko-KR",
  description: SITE.description,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
      </head>
      <body>
        <SiteHeader />
        <main className="site-main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
