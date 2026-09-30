import { EvListPage, evListMetadata } from "@/components/lists/ChargeListPage";
import type { RegionParams } from "@/components/lists/PlaceListPage";

export const dynamic = "force-dynamic";

type Props = { params: RegionParams };

export function generateMetadata({ params }: Props) {
  return evListMetadata(params);
}

export default function Page({ params }: Props) {
  return <EvListPage params={params} />;
}
