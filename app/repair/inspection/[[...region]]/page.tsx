import { findPlaceKind } from "@/lib/lists";
import type { SearchParams } from "@/lib/url";
import { PlaceListPage, placeListMetadata, type RegionParams } from "@/components/lists/PlaceListPage";

export const dynamic = "force-dynamic";

const kind = findPlaceKind("repair", "inspection")!;

type Props = { params: RegionParams; searchParams: SearchParams };

export function generateMetadata({ params, searchParams }: Props) {
  return placeListMetadata(kind, params, searchParams);
}

export default function Page({ params, searchParams }: Props) {
  return <PlaceListPage k={kind} params={params} searchParams={searchParams} />;
}
