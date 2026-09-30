/**
 * 지역 목록 페이지 본문. 시도·시군구별 건수(lib/regions.ts 의 인덱스)로 문장을 만들어
 * "강남구 무료 주차장" 같은 페이지마다 내용이 다르게 한다.
 */
import { SIGUNGU } from "../codes";
import type { EvSummary } from "../ev";
import { PLACE_KINDS, type PlaceKind } from "../lists";
import { countOf, guCounts, guRank, listPath, regionName, sidoCounts, tally, type Region, type RegionIndex } from "../regions";
import { josa, n, pct, type Article, type Block, type Faq } from "./common";

type Link = NonNullable<Block["links"]>[number];

/** 한 단계 아래 지역 링크 (전국 → 시도, 시도 → 시군구, 시군구 → 같은 시도의 다른 시군구) */
function childLinks(k: PlaceKind, region: Region, index: RegionIndex): { title: string; links: Link[] } {
  const label = k.label;
  if (!region.sido) {
    return {
      title: `시도별 ${label}`,
      links: sidoCounts(index, k.flag)
        .filter((x) => x.count > 0)
        .map((x) => ({ label: `${x.sido.short} ${label}`, href: listPath(k.section, k.kind, x.sido.slug), note: `${n(x.count)}곳` })),
    };
  }
  const list = guCounts(index, region.sido.slug, k.flag).filter((x) => x.count > 0 && x.gu.code !== region.gu?.code);
  return {
    title: region.gu ? `${region.sido.short} 다른 시군구 ${label}` : `${region.sido.short} 시군구별 ${label}`,
    links: list.map((x) => ({
      label: `${x.gu.name} ${label}`,
      href: listPath(k.section, k.kind, region.sido!.slug, x.gu.code),
      note: `${n(x.count)}곳`,
    })),
  };
}

/** 같은 지역의 다른 목록 */
export function relatedLinks(region: Region, except: string): Link[] {
  const r = regionName(region);
  const s = region.sido?.slug;
  const g = region.gu?.code;
  const out: Link[] = PLACE_KINDS.filter((k) => `${k.section}/${k.kind}` !== except).map((k) => ({
    label: `${r} ${k.label}`,
    href: listPath(k.section, k.kind, s, g),
  }));
  if (except !== "charge/ev") out.push({ label: `${r} 전기차 충전소`, href: listPath("charge", "ev", s, g), note: "실시간 상태" });
  if (except !== "charge/h2" && !g) out.push({ label: `${r} 수소충전소`, href: listPath("charge", "h2", s) });
  return out;
}

/** 요약 표 */
function summaryTable(k: PlaceKind, t: ReturnType<typeof tally>): Block["table"] {
  const f = (key: string) => t.f[key] ?? 0;
  if (k.dataset === "parking") {
    const base = k.flag ? f(k.flag) : t.n;
    const rows = [
      ["전체 주차장", `${n(t.n)}곳`],
      ["공영주차장", `${n(f("public"))}곳 (${pct(f("public"), t.n)})`],
      ["민영주차장", `${n(t.n - f("public"))}곳`],
      ["무료 주차장", `${n(f("free"))}곳 (${pct(f("free"), t.n)})`],
      ["장애인 전용구역 보유", `${n(f("disabled"))}곳`],
    ];
    if (t.cap) rows.push(["등록 주차면 합계", `${n(t.cap)}면`]);
    if (k.flag) rows.unshift([k.label, `${n(base)}곳`]);
    return { head: ["구분", "수"], rows };
  }
  if (k.dataset === "repair") {
    return {
      head: ["구분", "업체 수"],
      rows: [
        ["전체 정비업체", `${n(t.n)}곳`],
        ["종합정비업", `${n(f("general"))}곳`],
        ["소형정비업", `${n(f("small"))}곳`],
        ["전문정비업(부분정비)", `${n(f("partial"))}곳`],
      ],
    };
  }
  return {
    head: ["구분", "검사소 수"],
    rows: [
      ["전체 검사소", `${n(t.n)}곳`],
      ["한국교통안전공단 직영", `${n(f("ts"))}곳`],
      ["민간 지정 검사소", `${n(f("private"))}곳`],
    ],
  };
}

function leadOf(k: PlaceKind, region: Region, index: RegionIndex): string[] {
  const t = tally(index, region.sido?.slug, region.gu?.code);
  const count = countOf(t, k.flag);
  const r = regionName(region, true);
  const f = (key: string) => t.f[key] ?? 0;
  const out: string[] = [];

  if (count === 0) {
    return [`${r}에는 공공데이터에 등록된 ${josa(k.label, "이/가")} 아직 없습니다. 아래에서 가까운 다른 지역을 찾아보세요.`];
  }

  if (k.dataset === "parking") {
    if (k.flag === "free") {
      out.push(`${r}의 무료 주차장은 ${n(count)}곳으로, 지역 전체 주차장 ${n(t.n)}곳의 ${pct(count, t.n)}입니다.`);
    } else if (k.flag === "public") {
      const free = f("public+free");
      out.push(
        `${r}에는 지자체·공공기관이 운영하는 공영주차장이 ${n(count)}곳 있습니다.${
          free ? ` 그중 무료로 운영하는 곳은 ${n(free)}곳(${pct(free, count)})입니다.` : " 등록된 공영주차장은 모두 유료입니다."
        }`,
      );
    } else {
      out.push(
        `${r}에는 공공데이터에 등록된 주차장이 ${n(t.n)}곳 있습니다. 공영 ${n(f("public"))}곳·민영 ${n(t.n - f("public"))}곳이고, 무료로 운영하는 곳은 ${n(f("free"))}곳(${pct(f("free"), t.n)})입니다.`,
      );
    }
    if (t.cap && !k.flag) out.push(`등록된 주차면은 모두 ${n(t.cap)}면이며, 장애인 전용 주차구역을 갖춘 주차장은 ${n(f("disabled"))}곳입니다.`);
  } else if (k.dataset === "repair") {
    out.push(
      `${r}에는 자동차 정비업체가 ${n(t.n)}곳 등록돼 있습니다. 종합정비업 ${n(f("general"))}곳, 소형정비업 ${n(f("small"))}곳, 부분 수리를 하는 전문정비업 ${n(f("partial"))}곳입니다.`,
    );
  } else {
    out.push(
      `${r}에는 자동차 검사소가 ${n(t.n)}곳 있습니다. 한국교통안전공단 직영 검사소 ${n(f("ts"))}곳과 민간 지정 검사소 ${n(f("private"))}곳입니다.`,
    );
  }

  if (region.gu) {
    const rank = guRank(index, region.sido!.slug, region.gu.code, k.flag);
    if (rank && rank.of > 1) out.push(`${region.sido!.short} ${rank.of}개 시군구 가운데 ${josa(k.label, "이/가")} ${rank.rank}번째로 많습니다.`);
  } else {
    const top = (region.sido ? guCounts(index, region.sido.slug, k.flag).map((x) => ({ name: x.gu.name, count: x.count })) : sidoCounts(index, k.flag).map((x) => ({ name: x.sido.short, count: x.count })))
      .sort((a, b) => b.count - a.count)
      .filter((x) => x.count > 0)
      .slice(0, 3);
    if (top.length) out.push(`${josa(k.label, "이/가")} 가장 많은 곳은 ${top.map((x) => `${x.name}(${n(x.count)}곳)`).join(", ")}입니다.`);
  }
  return out;
}

function faqOf(k: PlaceKind, region: Region, index: RegionIndex): Faq[] {
  const t = tally(index, region.sido?.slug, region.gu?.code);
  const count = countOf(t, k.flag);
  const r = regionName(region);
  const faq: Faq[] = [
    {
      q: `${r} ${josa(k.label, "은/는")} 몇 곳인가요?`,
      a: `공공데이터에 등록된 ${r} ${josa(k.label, "은/는")} ${n(count)}곳입니다. 원천 데이터는 지방자치단체·관리기관이 등록한 정보라 실제와 조금 다를 수 있습니다.`,
    },
  ];
  if (k.dataset === "parking") {
    faq.push(
      k.flag === "free"
        ? {
            q: "무료 주차장은 시간 제한 없이 무료인가요?",
            a: "대부분 무료지만 운영시간이 정해져 있거나 일정 시간 이후 유료로 바뀌는 곳도 있습니다. 주차장을 누르면 등록된 운영시간과 요금 정보를 볼 수 있습니다.",
          }
        : {
            q: "공영주차장과 민영주차장은 무엇이 다른가요?",
            a: "공영주차장은 지자체나 공공기관이 운영해 요금이 조례로 정해지고 대체로 저렴합니다. 민영주차장은 민간이 운영해 요금과 운영시간이 주차장마다 다릅니다.",
          },
      {
        q: `${r} 주차장 요금은 어디서 확인하나요?`,
        a: "목록에서 주차장을 누르면 기본 요금과 추가 요금, 1일 주차권, 월 정기권 요금과 시간별 예상 요금을 볼 수 있습니다.",
      },
    );
  } else if (k.dataset === "repair") {
    faq.push({
      q: "종합정비업·소형정비업·전문정비업은 무엇이 다른가요?",
      a: "종합정비업은 모든 차종의 점검·정비를, 소형정비업은 승용차 등 소형 차량의 정비를 할 수 있습니다. 전문정비업(부분정비)은 엔진오일·타이어·판금 같은 일부 작업만 합니다.",
    });
  } else {
    faq.push({
      q: "공단 직영 검사소와 민간 지정 검사소는 무엇이 다른가요?",
      a: "검사 기준과 효력은 같습니다. 공단 직영 검사소는 한국교통안전공단이, 민간 지정 검사소는 지정받은 정비업체가 운영하며 수수료와 운영시간이 조금씩 다릅니다.",
    });
  }
  return faq;
}

export function placeRegionArticle(k: PlaceKind, region: Region, index: RegionIndex): Article {
  const t = tally(index, region.sido?.slug, region.gu?.code);
  const r = regionName(region);
  const child = childLinks(k, region, index);
  const blocks: Block[] = [];
  if (t.n > 0) {
    blocks.push({
      h2: `${r} ${k.label} 한눈에 보기`,
      table: summaryTable(k, t),
      after: ["공공데이터포털에 등록된 표준데이터를 기준으로 집계했습니다."],
    });
  }
  if (child.links.length) blocks.push({ h2: child.title, links: child.links });
  blocks.push({ h2: `${r} 함께 찾는 정보`, links: relatedLinks(region, `${k.section}/${k.kind}`) });
  return { lead: leadOf(k, region, index), blocks, faq: faqOf(k, region, index) };
}

/* ------------------------------------------------------------ 전기차 */

export function evRegionArticle(region: Region, s: EvSummary | null, parkingFree = 0): Article {
  const r = regionName(region, true);
  const lead: string[] = [];
  if (s && region.gu) {
    lead.push(
      `${r}에는 전기차 충전소 ${n(s.stations)}곳, 충전기 ${n(s.chargers)}대(급속 ${n(s.fast)}대·완속 ${n(s.slow)}대)가 등록돼 있습니다.`,
      `조회 시점에 바로 충전할 수 있는 충전기는 ${n(s.available)}대, 충전 중인 충전기는 ${n(s.charging)}대입니다.${parkingFree ? ` 충전 중 주차가 무료인 충전소는 ${n(parkingFree)}곳입니다.` : ""}`,
    );
  } else if (region.gu) {
    lead.push(`${r} 전기차 충전소의 위치와 급속·완속 충전기, 지금 충전할 수 있는 충전기 수를 실시간으로 보여줍니다.`);
  } else {
    lead.push(`${r} 전기차 충전소는 충전기 상태를 실시간으로 보여주기 위해 시군구 단위로 조회합니다. 아래에서 시군구를 고르세요.`);
  }

  const blocks: Block[] = [];
  if (region.gu) {
    const others = (SIGUNGU[region.sido!.slug] ?? []).filter((g) => g.code !== region.gu!.code);
    if (others.length) {
      blocks.push({
        h2: `${region.sido!.short} 다른 시군구 전기차 충전소`,
        links: others.map((g) => ({ label: `${g.name} 전기차 충전소`, href: listPath("charge", "ev", region.sido!.slug, g.code) })),
      });
    }
  }
  if (region.sido) blocks.push({ h2: `${regionName(region)} 함께 찾는 정보`, links: relatedLinks(region, "charge/ev") });

  const faq: Faq[] = [
    {
      q: "급속 충전기와 완속 충전기는 무엇이 다른가요?",
      a: "급속 충전기(DC 콤보·차데모 등)는 50kW 이상 출력으로 30분~1시간이면 80% 가까이 충전합니다. 완속 충전기(AC)는 7kW 안팎이라 완충까지 6~9시간이 걸려 주로 주거지·직장에서 씁니다.",
    },
    {
      q: "충전기 상태는 얼마나 정확한가요?",
      a: "한국환경공단이 제공하는 충전기 상태를 약 10분 간격으로 갱신합니다. 통신이 끊긴 충전기는 실제와 다를 수 있으니 출발 전 한 번 더 확인하세요.",
    },
  ];
  if (s && region.gu) {
    faq.unshift({
      q: `${regionName(region)} 전기차 충전소는 몇 곳인가요?`,
      a: `${n(s.stations)}곳에 충전기 ${n(s.chargers)}대가 있습니다. 급속 ${n(s.fast)}대, 완속 ${n(s.slow)}대입니다.`,
    });
  }
  return { lead, blocks, faq };
}

/* ------------------------------------------------------------ 수소 */

export function h2RegionArticle(region: Region, count: number, bySido: Array<{ name: string; slug: string; count: number }>): Article {
  const r = regionName(region, true);
  const lead = count
    ? [`${r}에는 운영 중인 수소충전소가 ${n(count)}곳 있습니다. 충전소를 누르면 운영시간, 휴무일, 충전 압력과 충전 가능 차량을 볼 수 있습니다.`]
    : [`${r}에는 등록된 수소충전소가 아직 없습니다. 가까운 다른 시도의 수소충전소를 찾아보세요.`];
  const blocks: Block[] = [];
  const list = bySido.filter((x) => x.count > 0 && x.slug !== region.sido?.slug);
  if (list.length) {
    blocks.push({
      h2: region.sido ? "다른 시도 수소충전소" : "시도별 수소충전소",
      links: list.map((x) => ({ label: `${x.name} 수소충전소`, href: listPath("charge", "h2", x.slug), note: `${n(x.count)}곳` })),
    });
  }
  if (region.sido) blocks.push({ h2: `${regionName(region)} 함께 찾는 정보`, links: relatedLinks(region, "charge/h2") });
  const faq: Faq[] = [
    {
      q: `${regionName(region)} 수소충전소는 몇 곳인가요?`,
      a: `한국가스안전공사 자료 기준 ${n(count)}곳입니다. 점검·수소 수급 문제로 임시 휴업하는 곳이 있으니 방문 전 운영 여부를 확인하세요.`,
    },
  ];
  return { lead, blocks, faq };
}
