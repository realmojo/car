import { SIDO } from "@/lib/codes";
import { NAV, SITE_LINKS } from "@/lib/menu";
import { SITE } from "@/lib/seo";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <div className="site-footer__logo">
              <span aria-hidden>🚗</span> {SITE.name}
            </div>
            <p className="site-footer__desc">
              한국석유공사 오피넷과 한국환경공단 공공데이터로 오늘의 기름값,
              최저가 주유소, 전기차 충전소 정보를 쉽게 정리해 전합니다.
            </p>
          </div>

          <div className="site-footer__col">
            <h3>서비스</h3>
            <ul>
              {NAV.map((item) => (
                <li key={item.href}>
                  <a target="_self" href={item.href}>{item.name}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__col">
            <h3>지역별 기름값</h3>
            <ul>
              {SIDO.slice(0, 8).map((s) => (
                <li key={s.slug}>
                  <a target="_self" href={`/fuel/${s.slug}`}>{s.short} 최저가 주유소</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__col">
            <h3>사이트</h3>
            <ul>
              {SITE_LINKS.map((item) => (
                <li key={item.href}>
                  <a target="_self" href={item.href}>{item.name}</a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="site-footer__bottom">
          <p>© {new Date().getFullYear()} {SITE.name}. All rights reserved.</p>
          <p className="site-footer__note">
            유가 정보 출처: 한국석유공사 오피넷 · 충전소 정보 출처: 한국환경공단
            (공공데이터포털). 실제 판매가격·충전기 상태와 차이가 있을 수 있으니
            방문 전 확인하시기 바랍니다.
          </p>
        </div>
      </div>
    </footer>
  );
}
