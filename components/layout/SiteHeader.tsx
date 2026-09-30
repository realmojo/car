"use client";

import { usePathname } from "next/navigation";
import { NAV } from "@/lib/menu";
import { SITE } from "@/lib/seo";

export default function SiteHeader() {
  const pathname = usePathname() ?? "/";

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a target="_self" href="/" className="site-logo">
          <span aria-hidden>🚗</span>
          <span>{SITE.name}</span>
        </a>

        <nav className="site-nav" aria-label="주요 메뉴">
          {NAV.map((item) => {
            const base = item.match ?? item.href;
            const active = pathname === base || pathname.startsWith(`${base}/`);
            return (
              <div key={item.href} className={`nav-item${item.children ? " has-sub" : ""}`}>
                <a target="_self" href={item.href} className={active ? "is-active" : undefined}>
                  {item.name}
                  {item.children && <span className="nav-caret" aria-hidden>▾</span>}
                </a>
                {item.children && (
                  <div className="nav-sub">
                    {item.children.map((c) => (
                      <a target="_self" key={c.href} href={c.href}>
                        {c.name}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
