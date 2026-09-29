import { NAV, SITE_LINKS } from "@/lib/menu";
import { SITE } from "@/lib/seo";

export default function SiteFooter() {
  const withSub = NAV.filter((n) => n.children);
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__top">
          <div className="site-footer__brand">
            <div className="site-footer__logo">
              <span aria-hidden>🚗</span> {SITE.name}
            </div>
            <p className="site-footer__desc">
              충전소, 주차장, 정비소, 도로 상황까지. 운전자에게 필요한 정보를 공공데이터로 쉽게
              정리해 전합니다.
            </p>
          </div>

          <div className="site-footer__col">
            <h3>카테고리</h3>
            <ul>
              {NAV.map((item) => (
                <li key={item.href}>
                  <a target="_self" href={item.href}>{item.name}</a>
                </li>
              ))}
            </ul>
          </div>

          <div className="site-footer__col">
            <h3>바로가기</h3>
            <ul>
              {withSub.flatMap((n) => n.children ?? []).slice(0, 8).map((c) => (
                <li key={c.href}>
                  <a target="_self" href={c.href}>{c.name}</a>
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
            데이터 출처: 한국환경공단, 한국가스안전공사, 한국교통안전공단, 국토교통부, 한국도로공사,
            한국에너지공단, 각 지방자치단체 (공공데이터포털). 실제 정보와 차이가 있을 수 있으니
            방문 전 확인하시기 바랍니다.
          </p>
        </div>
      </div>
    </footer>
  );
}
