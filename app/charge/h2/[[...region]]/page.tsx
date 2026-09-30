import { H2ListPage, h2ListMetadata } from "@/components/lists/ChargeListPage";
import type { RegionParams } from "@/components/lists/PlaceListPage";
import type { SearchParams } from "@/lib/url";

export const dynamic = "force-dynamic";

type Props = { params: RegionParams; searchParams: SearchParams };

export function generateMetadata({ params, searchParams }: Props) {
  return h2ListMetadata(params, searchParams);
}

export default function Page({ params, searchParams }: Props) {
  return <H2ListPage params={params} searchParams={searchParams} />;
}
