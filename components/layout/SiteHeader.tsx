"use client";

import { usePathname } from "next/navigation";
import { NAV } from "@/lib/menu";
import { SITE } from "@/lib/seo";

export default function SiteHeader() {
  const pathname = usePathname() ?? "/";

  // /fuel/nearby 가 /fuel 메뉴까지 켜지지 않도록 가장 긴 일치 하나만 활성화한다
  const active = NAV.map((n) => n.href)
    .filter((href) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <a target="_self" href="/" className="site-logo">
          <span aria-hidden>🚗</span>
          <span>{SITE.name}</span>
        </a>

        <nav className="site-nav" aria-label="주요 메뉴">
          {NAV.map((item) => (
            <a
              target="_self"
              key={item.href}
              href={item.href}
              className={item.href === active ? "is-active" : undefined}
            >
              {item.name}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
