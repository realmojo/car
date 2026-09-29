import type { Metadata } from "next";
import { getAvgAllPrice } from "@/lib/opinet";
import { attempt } from "@/lib/errors";
import { buildMetadata } from "@/lib/seo";
import Crumbs from "@/components/common/Crumbs";
import Calculator from "@/components/common/Calculator";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  path: "/calculator",
  title: "유류비 계산기 - 주행거리·연비로 기름값, 전기차 충전비 계산 | 김군카",
  description:
    "월 주행거리와 연비만 입력하면 오늘 평균 유가 기준 월·연간 기름값을 계산합니다. 전기차 충전 요금과 내연기관차 유류비도 비교해 보세요.",
  keywords: ["유류비 계산기", "기름값 계산기", "연비 계산", "전기차 충전비 계산", "주유비 계산"],
});

export default async function CalculatorPage({ searchParams }: { searchParams: Promise<{ mode?: string }> }) {
  const mode = (await searchParams).mode === "ev" ? "ev" : "fuel";
  const { data } = await attempt(getAvgAllPrice());
  const prices: Record<string, number> = {};
  for (const p of data ?? []) prices[p.prodcd] = Math.round(p.price);

  return (
    <>
      <Crumbs trail={[{ name: "유류비 계산기", path: "/calculator" }]} />
      <div className="page-head">
        <h1>🧮 유류비·충전비 계산기</h1>
        <p>
          주행거리와 연비(전비)로 한 달 연료비를 계산합니다.
          {data ? " 기름값은 오늘 전국 평균 가격이 자동으로 들어갑니다." : ""}
        </p>
      </div>
      <Calculator initialMode={mode} prices={prices} />
    </>
  );
}
