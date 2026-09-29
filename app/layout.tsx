import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { ADSENSE_CLIENT } from "@/lib/ads";
import "./globals.css";
import { GA_ID, NAVER_WA, SITE, buildMetadata } from "@/lib/seo";
import SiteHeader from "@/components/layout/SiteHeader";
import SiteFooter from "@/components/layout/SiteFooter";

const title = `${SITE.name} - 전기차 충전소·주차장·정비소·도로 상황 찾기`;

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
  verification: {
    other: {
      "naver-site-verification": "44255b69ada27c1c77482465df24c4e738cc2161",
    },
  },
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
        {/* 네이버 애널리틱스: 받은 코드 그대로 동기 로드 후 wcs_do() 실행 */}
        <script id="naver-analytics" src="//wcs.pstatic.net/wcslog.js" />
        <script
          id="naver-analytics-init"
          dangerouslySetInnerHTML={{
            __html: `if(!wcs_add) var wcs_add = {}; wcs_add["wa"] = "${NAVER_WA}"; if(window.wcs) { wcs_do(); }`,
          }}
        />
        {/* Google AdSense */}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <SiteHeader />
        <main className="site-main">{children}</main>
        <SiteFooter />

        {/* Google tag (gtag.js) - keywordegg 와 같은 방식: 하이드레이션 이후 로드 */}
        <Script id="gtag-src" strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', '${GA_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}
