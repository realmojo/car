import { NextResponse } from "next/server";
import { getAroundStations } from "@/lib/opinet";
import { errorMessage } from "@/lib/errors";
import { inKorea } from "@/lib/geo";
import { SEARCH_PRODUCTS } from "@/lib/codes";

export const dynamic = "force-dynamic";

const RADII = [1000, 3000, 5000];

/** 내 주변 주유소: GET /api/fuel/around?lat=&lng=&radius=&prodcd=&sort= */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const lat = Number(q.get("lat"));
  const lng = Number(q.get("lng"));
  const radius = Number(q.get("radius") ?? 3000);
  const prodcd = q.get("prodcd") ?? "B027";
  const sort = q.get("sort") === "2" ? 2 : 1;

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inKorea(lat, lng)) {
    return NextResponse.json({ error: "국내 위치에서만 검색할 수 있습니다." }, { status: 400 });
  }
  if (!RADII.includes(radius) || !SEARCH_PRODUCTS.some((p) => p.code === prodcd)) {
    return NextResponse.json({ error: "잘못된 검색 조건입니다." }, { status: 400 });
  }

  try {
    const items = await getAroundStations(lat, lng, radius, prodcd, sort);
    return NextResponse.json({ items }, { headers: { "cache-control": "private, max-age=300" } });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: errorMessage(e) }, { status: 502 });
  }
}
