import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import Crumbs from "@/components/common/Crumbs";
import { SourceNote } from "@/components/common/Notice";
import NearbySearch from "@/components/fuel/NearbySearch";

export const metadata: Metadata = buildMetadata({
  path: "/fuel/nearby",
  title: "내 주변 주유소 - 가까운 최저가 주유소 찾기 | 김군카",
  description:
    "현재 위치 반경 1km·3km·5km 안의 주유소를 휘발유·경유·LPG 가격순, 거리순으로 비교하고 카카오맵 길찾기로 바로 이동하세요.",
  keywords: ["내 주변 주유소", "가까운 주유소", "근처 최저가 주유소", "주유소 가격 비교"],
});

export default function NearbyPage() {
  return (
    <>
      <Crumbs
        trail={[
          { name: "유가 정보", path: "/fuel" },
          { name: "내 주변 주유소", path: "/fuel/nearby" },
        ]}
      />
      <div className="page-head">
        <h1>📍 내 주변 주유소</h1>
        <p>위치 권한을 허용하면 반경 안의 주유소를 가격순 또는 거리순으로 보여 드립니다. 위치 정보는 저장하지 않습니다.</p>
      </div>
      <NearbySearch />
      <SourceNote kind="fuel" />
    </>
  );
}
