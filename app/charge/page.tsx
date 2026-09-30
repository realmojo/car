import { permanentRedirect } from "next/navigation";
import { legacyListUrl } from "@/lib/legacy";
import { toParams, type SearchParams } from "@/lib/url";

export const dynamic = "force-dynamic";

/** 옛 목록 주소. 보통은 middleware.ts 가 먼저 301 로 넘기고, 여기는 그게 안 됐을 때를 위한 대비다 */
export default async function LegacyChargePage({ searchParams }: { searchParams: SearchParams }) {
  permanentRedirect(legacyListUrl("/charge", toParams(await searchParams))!);
}
