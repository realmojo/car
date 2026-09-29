import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GUIDES, findGuide } from "@/lib/guides";
import { loadRows, paginate, type Row } from "@/lib/datasets";
import { buildMetadata } from "@/lib/seo";
import { one, withQuery, type SearchParams } from "@/lib/url";
import Crumbs from "@/components/common/Crumbs";
import Tabs from "@/components/common/Tabs";
import Pager from "@/components/common/Pager";
import Calculator from "@/components/guide/Calculator";
import ChargerGuide from "@/components/guide/ChargerGuide";
import { PendingNotice, SOURCES, SourceNote } from "@/components/common/Notice";

type Params = { slug: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const g = findGuide((await params).slug);
  if (!g) return {};
  return buildMetadata({ path: `/guide/${g.slug}`, title: g.seoTitle, description: g.desc });
}

export default async function GuideDetailPage({ params, searchParams }: { params: Promise<Params>; searchParams: SearchParams }) {
  const g = findGuide((await params).slug);
  if (!g) notFound();
  const sp = await searchParams;

  return (
    <>
      <Crumbs
        trail={[
          { name: "가이드", path: "/guide" },
          { name: g.title, path: `/guide/${g.slug}` },
        ]}
      />
      <div className="page-head">
        <h1>
          {g.icon} {g.title}
        </h1>
        <p>{g.desc}</p>
      </div>

      {g.slug === "fuel-economy" && <EfficiencyRanking mode="ice" fuel={one(sp.fuel)} q={one(sp.q)} page={Number(one(sp.page))} />}
      {g.slug === "ev-range" && <EfficiencyRanking mode="ev" fuel="" q={one(sp.q)} page={Number(one(sp.page))} />}
      {g.slug === "calculator" && <Calculator initialMode={one(sp.mode) === "ev" ? "ev" : "fuel"} />}
      {g.slug === "charger-types" && <ChargerTypes />}
      {g.slug === "car-inspection" && <CarInspection />}

      <section className="sec">
        <div className="sec-head">
          <h2 className="sec-title">다른 가이드</h2>
        </div>
        <div className="region-grid">
          {GUIDES.filter((x) => x.slug !== g.slug).map((x) => (
            <a target="_self" key={x.slug} href={`/guide/${x.slug}`} className="region-card">
              {x.icon} {x.title}
              <small>›</small>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}

const FUEL_TABS = [
  { key: "", label: "전체" },
  { key: "ice", label: "휘발유·경유·LPG" },
  { key: "hybrid", label: "하이브리드" },
];

async function EfficiencyRanking({ mode, fuel, q, page }: { mode: "ice" | "ev"; fuel: string; q: string; page: number }) {
  const rows = await loadRows("efficiency");
  if (!rows) return <PendingNotice />;
  const path = mode === "ev" ? "/guide/ev-range" : "/guide/fuel-economy";
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const metric = mode === "ev" ? "range" : "combined";

  const filtered = rows
    .filter((r) => (mode === "ev" ? r.flags.includes("ev") : !r.flags.includes("ev") && !r.flags.includes("h2")))
    .filter((r) => !fuel || r.flags.includes(fuel))
    .filter((r) => !words.length || words.every((w) => `${r.name} ${r.sub}`.toLowerCase().includes(w)))
    .filter((r) => r.num?.[metric])
    .sort((a, b) => (b.num?.[metric] ?? 0) - (a.num?.[metric] ?? 0));
  const p = paginate(filtered, page, 30);
  const val = (r: Row, label: string) => r.info.find(([k]) => k === label)?.[1] ?? "-";

  return (
    <>
      <form className="region-form" action={path} method="get" role="search">
        {fuel && <input type="hidden" name="fuel" value={fuel} />}
        <input type="search" name="q" defaultValue={q} placeholder="모델명·제조사 검색" aria-label="차량 검색" maxLength={30} />
        <button type="submit">검색</button>
      </form>
      {mode === "ice" && (
        <Tabs
          label="연료"
          items={FUEL_TABS.map((t) => ({ label: t.label, href: withQuery(path, { q, fuel: t.key }), active: t.key === fuel }))}
        />
      )}
      <p className="result-count">
        {p.total.toLocaleString()}개 모델 · {mode === "ev" ? "1회 충전 주행거리" : "복합연비"} 높은 순
      </p>
      <div className="panel">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th className="r">순위</th>
                <th>모델</th>
                <th>제조사</th>
                <th>연료</th>
                {mode === "ev" && <th className="r">주행거리</th>}
                <th className="r">복합</th>
                <th className="r">도심</th>
                <th className="r">고속</th>
                <th className="r">등급</th>
              </tr>
            </thead>
            <tbody>
              {p.items.map((r, i) => (
                <tr key={r.key}>
                  <td className="r num">{(p.page - 1) * 30 + i + 1}</td>
                  <td style={{ whiteSpace: "normal", minWidth: 140 }}>
                    <strong>{r.name}</strong>
                  </td>
                  <td>{r.sub}</td>
                  <td>{val(r, "연료")}</td>
                  {mode === "ev" && <td className="r num">{val(r, "1회 충전 주행거리")}</td>}
                  <td className="r num">{val(r, "복합 연비")}</td>
                  <td className="r num">{val(r, "도심 연비")}</td>
                  <td className="r num">{val(r, "고속도로 연비")}</td>
                  <td className="r">{val(r, "에너지소비효율 등급")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <Pager page={p.page} pages={p.pages} hrefFor={(n) => withQuery(path, { q, fuel, page: n })} />
      <SourceNote
        source={SOURCES.efficiency}
        extra="표시연비는 표준 시험 조건 기준이며 실제 주행 연비는 운전 습관·기온·도로 상황에 따라 달라집니다."
      />
    </>
  );
}

function ChargerTypes() {
  return (
    <>
      <ChargerGuide />
      <div className="prose-box" style={{ marginTop: 16 }}>
        <h2>급속과 완속, 언제 무엇을 쓸까</h2>
        <p>
          급속 충전기는 50kW 이상 직류(DC) 충전기로, 배터리를 80% 안팎까지 30분~1시간이면 채웁니다. 장거리 이동
          중이나 급할 때 쓰기 좋습니다. 완속 충전기는 7kW 안팎의 교류(AC) 충전기로 완충에 6~10시간이 걸려 집이나
          직장에 오래 세워둘 때 적합합니다.
        </p>
        <h2>배터리를 오래 쓰는 충전 습관</h2>
        <ul>
          <li>급속 충전은 80% 전후에서 멈추세요. 이후에는 속도가 크게 느려지고 배터리 부담이 커집니다.</li>
          <li>평소에는 완속 위주로 20~80% 구간에서 충전하는 것이 좋습니다.</li>
          <li>충전이 끝나면 차를 옮겨 다음 이용자를 배려해 주세요. 급속 충전 구역 장시간 주차는 과태료 대상입니다.</li>
        </ul>
        <p>
          주변 충전소의 충전기 규격과 지금 비어 있는 충전기는 <a href="/charge?type=ev">충전소 찾기</a>에서 확인할 수
          있습니다.
        </p>
      </div>
      <SourceNote source={SOURCES.ev} />
    </>
  );
}

function CarInspection() {
  return (
    <div className="prose-box">
      <h2>자동차 검사 주기</h2>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>구분</th>
              <th>첫 검사</th>
              <th>이후 주기</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>비사업용 승용차 (자가용)</td>
              <td>출고 후 4년</td>
              <td>2년마다</td>
            </tr>
            <tr>
              <td>사업용 승용차 (택시 등)</td>
              <td>출고 후 2년</td>
              <td>1년마다</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p>
        승합·화물·특수 자동차는 차종과 차령에 따라 주기가 다릅니다. 대기관리권역 등에 등록된 차량은 배출가스 검사가
        포함된 종합검사 대상일 수 있습니다. 정확한 검사 대상과 만료일은 자동차등록증이나 검사 안내 문자로 확인하세요.
      </p>
      <h2>검사 기간과 과태료</h2>
      <ul>
        <li>검사 유효기간 만료일 전후 각 31일 안에 받으면 됩니다.</li>
        <li>기간을 넘기면 과태료가 부과되고, 늦어질수록 금액이 늘어납니다.</li>
        <li>기준 금액은 법령 개정에 따라 바뀔 수 있으니 한국교통안전공단 안내를 확인하세요.</li>
      </ul>
      <h2>준비물과 예약</h2>
      <ul>
        <li>자동차등록증(차량에 비치), 운전자 신분증</li>
        <li>
          한국교통안전공단 검사소는{" "}
          <a href="https://www.ts2020.kr" target="_blank" rel="noopener noreferrer">
            TS 사이버검사소
          </a>
          에서 예약할 수 있습니다.
        </li>
        <li>
          가까운 공단 직영·민간 지정 검사소는 <a href="/repair?type=inspection">자동차 검사소 찾기</a>에서 확인하세요.
        </li>
      </ul>
    </div>
  );
}
