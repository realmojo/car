"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, AD_SLOTS } from "@/lib/ads";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/** 반응형 디스플레이 광고 한 칸 */
export default function AdSlot({ slot }: { slot: keyof typeof AD_SLOTS }) {
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    // 같은 칸에 두 번 채우면 애드센스가 오류를 내므로 비어 있을 때만 요청한다
    if (!ref.current || ref.current.getAttribute("data-adsbygoogle-status")) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // 광고 차단기 등으로 실패해도 페이지는 그대로 둔다
    }
  }, []);
  return (
    <ins
      ref={ref}
      className="adsbygoogle ad-slot"
      style={{ display: "block" }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={AD_SLOTS[slot]}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}
