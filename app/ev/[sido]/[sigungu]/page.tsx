import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findSido, findSigungu } from "@/lib/codes";
import { getStationsByRegion, summarize } from "@/lib/ev";
import { attempt } from "@/lib/errors";
import { buildMetadata } from "@/lib/seo";
import Crumbs from "@/components/common/Crumbs";
import EvStationList from "@/components/ev/EvStationList";
import { ErrorNotice, SourceNote } from "@/components/common/Notice";

export const dynamic = "force-dynamic";

type Params = { sido: string; sigungu: string };

function resolve(p: Params) {
  const sido = findSido(p.sido);
  const gu = sido ? findSigungu(sido.slug, p.sigungu) : undefined;
  return sido && gu ? { sido, gu } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const r = resolve(await params);
  if (!r) return {};
  const area = `${r.sido.short} ${r.gu.name}`;
  return buildMetadata({
    path: `/ev/${r.sido.slug}/${r.gu.code}`,
    title: `${area} 전기차 충전소 - 급속·완속 충전기 위치와 실시간 상태 | 김군카`,
    description: `${area} 전기차 충전소 목록과 급속·완속 충전기 수, 지금 충전 가능한 충전기, 무료 주차 여부를 확인하세요.`,
    keywords: [`${area} 전기차 충전소`, `${r.gu.name} 충전소`, `${r.gu.name} 급속 충전소`],
  });
}

export default async function EvRegionPage({ params }: { params: Promise<Params> }) {
  const r = resolve(await params);
  if (!r) notFound();
  const { sido, gu } = r;
  const { data, error } = await attempt(getStationsByRegion(gu.zscodes));
  const s = data ? summarize(data) : null;

  return (
    <>
      <Crumbs
        trail={[
          { name: "전기차 충전소", path: "/ev" },
          { name: sido.short, path: `/ev/${sido.slug}` },
          { name: gu.name, path: `/ev/${sido.slug}/${gu.code}` },
        ]}
      />
      <div className="page-head">
        <h1>
          ⚡ {sido.short} {gu.name} 전기차 충전소
        </h1>
        <p>충전 가능한 충전기가 많은 충전소부터 보여 드립니다. 상태는 약 10분 간격으로 갱신됩니다.</p>
      </div>

      {error && <ErrorNotice message={error} />}

      {s && data && (
        <>
          <div className="ev-summary">
            <div className="price-tile">
              <div className="price-tile__name">충전소</div>
              <div className="price-tile__price num">{s.stations.toLocaleString()}<small>곳</small></div>
            </div>
            <div className="price-tile">
              <div className="price-tile__name">충전기</div>
              <div className="price-tile__price num">{s.chargers.toLocaleString()}<small>대</small></div>
              <div className="price-tile__diff flat">급속 {s.fast.toLocaleString()} · 완속 {s.slow.toLocaleString()}</div>
            </div>
            <div className="price-tile">
              <div className="price-tile__name">
                <span className="price-tile__dot" style={{ background: "var(--st-available)" }} />
                충전 가능
              </div>
              <div className="price-tile__price num">{s.available.toLocaleString()}<small>대</small></div>
            </div>
            <div className="price-tile">
              <div className="price-tile__name">
                <span className="price-tile__dot" style={{ background: "var(--st-charging)" }} />
                충전 중
              </div>
              <div className="price-tile__price num">{s.charging.toLocaleString()}<small>대</small></div>
            </div>
          </div>
          {data.length === 0 ? (
            <div className="empty-box">등록된 충전소가 없습니다.</div>
          ) : (
            <EvStationList stations={data} />
          )}
        </>
      )}
      <SourceNote kind="ev" />
    </>
  );
}
