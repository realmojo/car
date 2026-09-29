/**
 * 주차장 상세 본문. 요금 계산 예시, 운영시간 해설, 같은 시군구 주차장 통계와 주변 주차장을 데이터로 만든다.
 */
import type { Row } from "../dataset-types";
import type { Sido, Sigungu } from "../codes";
import type { PlaceContext } from "../places";
import { withQuery } from "../url";
import { type Article, type Block, type Faq, firstNumber, infoOf, josa, join, km, n, noNearbyBlock, pct } from "./common";

export interface PlaceArgs {
  row: Row;
  id: string;
  sido?: Sido;
  gu?: Sigungu;
  ctx: PlaceContext;
}

interface Fee {
  free: boolean;
  basicMin?: number;
  basicWon?: number;
  addMin?: number;
  addWon?: number;
  dayWon?: number;
  monthWon?: number;
}

function parseFee(row: Row): Fee {
  const basic = infoOf(row, "기본 요금");
  const add = infoOf(row, "추가 요금");
  const feeText = infoOf(row, "요금");
  const free = basic === "무료" || (/무료/.test(feeText) && !/유료|혼합/.test(feeText));
  const bm = basic.match(/([\d,]+)\s*분\s*([\d,]+)\s*원/);
  const am = add.match(/([\d,]+)\s*분마다\s*([\d,]+)\s*원/);
  return {
    free,
    basicMin: bm ? Number(bm[1].replace(/,/g, "")) : undefined,
    basicWon: bm ? Number(bm[2].replace(/,/g, "")) : undefined,
    addMin: am ? Number(am[1].replace(/,/g, "")) : undefined,
    addWon: am ? Number(am[2].replace(/,/g, "")) : undefined,
    dayWon: firstNumber(infoOf(row, "1일 주차권")),
    monthWon: firstNumber(infoOf(row, "월 정기권")),
  };
}

/** 주차 시간(분)별 예상 요금. 기본·추가 요금을 모르면 undefined */
function costFor(fee: Fee, minutes: number): number | undefined {
  if (fee.free) return 0;
  if (fee.basicMin === undefined || fee.basicWon === undefined) return undefined;
  let won = fee.basicWon;
  const extra = minutes - fee.basicMin;
  if (extra > 0) {
    if (!fee.addMin || fee.addWon === undefined) return undefined;
    won += Math.ceil(extra / fee.addMin) * fee.addWon;
  }
  if (fee.dayWon && won > fee.dayWon) won = fee.dayWon;
  return won;
}

const DURATIONS: Array<[number, string]> = [
  [30, "30분"],
  [60, "1시간"],
  [120, "2시간"],
  [180, "3시간"],
  [300, "5시간"],
  [600, "10시간"],
];

function sizeLabel(cap?: number) {
  if (!cap) return "";
  if (cap < 30) return "소규모";
  if (cap < 100) return "중간 규모";
  if (cap < 300) return "대형";
  return "초대형";
}

export function parkingArticle({ row, sido, gu, ctx }: PlaceArgs): Article {
  const region = join([sido?.short, gu?.name]) || "이 지역";
  const regionGu = gu?.name ?? sido?.short ?? "이 지역";
  const se = row.sub?.split(" · ")[0] ?? "";
  const type = row.sub?.split(" · ")[1] ?? "";
  const cap = row.num?.capacity;
  const fee = parseFee(row);
  const feeText = infoOf(row, "요금");
  const weekday = infoOf(row, "평일");
  const sat = infoOf(row, "토요일");
  const hol = infoOf(row, "공휴일");
  const days = infoOf(row, "운영 요일");
  const pay = infoOf(row, "결제 방법");
  const note = infoOf(row, "특기사항");
  const org = infoOf(row, "관리기관");
  const refDate = infoOf(row, "기준일");
  const jibun = infoOf(row, "지번 주소");
  const disabled = row.flags.includes("disabled");
  const is24 = weekday === "24시간";
  const name = row.name;

  const freeCount = ctx.flagCounts.free ?? 0;
  const publicCount = ctx.flagCounts.public ?? 0;
  const bigger = cap ? ctx.rows.filter((r) => (r.num?.capacity ?? 0) > cap).length : 0;
  const rank = cap && ctx.total ? bigger + 1 : undefined;

  /* ---- 요약 ---- */
  const lead = [
    join([
      `${josa(name, "은/는")} ${sido?.name ?? ""} ${gu?.name ?? ""}에 있는`,
      join([se, type ? `${type} 주차장` : "주차장"]) + "입니다.",
      row.address ? `주소는 ${row.address}이며,` : "",
      cap ? `주차면은 모두 ${n(cap)}면으로 ${sizeLabel(cap)} 주차장에 속합니다.` : "주차면 수는 등록되어 있지 않습니다.",
    ]),
    join([
      fee.free
        ? "요금 정보상 무료로 운영되는 주차장입니다."
        : feeText
          ? `요금은 ‘${feeText}’로 등록되어 있고,`
          : "요금 구분은 등록되어 있지 않고,",
      !fee.free && fee.basicMin && fee.basicWon !== undefined ? `기본 ${n(fee.basicMin)}분에 ${n(fee.basicWon)}원입니다.` : "",
      is24 ? "평일에는 24시간 이용할 수 있습니다." : weekday ? `평일 운영시간은 ${weekday}입니다.` : "",
      org ? `관리기관은 ${org}입니다.` : "",
    ]),
  ];

  const blocks: Block[] = [];

  /* ---- 기본 정보 해설 ---- */
  blocks.push({
    h2: `${name} 한눈에 보기`,
    p: [
      join([
        `${josa(name, "은/는")} 지방자치단체가 공공데이터포털에 등록한 전국주차장정보표준데이터에 실린 주차장입니다.`,
        se === "공영"
          ? "공영주차장은 지방자치단체나 공단이 설치·운영하는 주차장으로, 요금이 민간 주차장보다 낮게 책정되는 경우가 많고 요금 체계가 조례로 정해져 있어 비교적 예측하기 쉽습니다."
          : se === "민영"
            ? "민영주차장은 개인이나 법인이 운영하는 주차장으로, 요금과 운영시간을 운영자가 정하기 때문에 방문 시점에 따라 조건이 달라질 수 있습니다."
            : "주차장 구분에 따라 요금 체계와 운영 방식이 다르므로 아래 상세 항목을 함께 확인하는 것이 좋습니다.",
      ]),
      join([
        type === "노외"
          ? "노외주차장은 도로가 아닌 별도 부지에 만든 주차장으로, 출입구와 정산 시설이 따로 있고 장시간 주차에 적합합니다."
          : type === "노상"
            ? "노상주차장은 도로 가장자리에 구획을 그어 만든 주차장입니다. 짧게 세우기 좋지만 구획 수가 적고, 시간제 요금이 촘촘하게 붙는 경우가 많습니다."
            : type === "부설"
              ? "부설주차장은 건물에 딸린 주차장으로, 건물 이용객이 아니면 이용이 제한되거나 운영시간이 건물 영업시간을 따를 수 있습니다."
              : "",
        cap
          ? `${regionGu}에 등록된 주차장 ${n(ctx.total)}곳 가운데 주차면 기준 ${n(rank ?? 0)}번째로 큰 곳입니다.${ctx.avgCapacity ? ` 같은 지역 평균 주차면(${n(ctx.avgCapacity)}면)과 비교하면 ${cap >= ctx.avgCapacity ? "넉넉한" : "작은"} 편입니다.` : ""}`
          : "",
      ]),
    ].filter(Boolean),
    table: {
      head: ["항목", "내용"],
      rows: [
        ["주차장 이름", name],
        ["구분", row.sub || "-"],
        ["도로명 주소", row.address || "-"],
        ["지번 주소", jibun || "-"],
        ["주차면", cap ? `${n(cap)}면` : "-"],
        ["요금 구분", feeText || "-"],
        ["관리기관", org || "-"],
        ["전화", row.tel || "-"],
      ],
    },
  });

  /* ---- 요금 ---- */
  const costRows = DURATIONS.map(([m, label]) => {
    const c = costFor(fee, m);
    return [label, c === undefined ? "정보 없음" : c === 0 ? "무료" : `${n(c)}원`];
  });
  const knowCost = costRows.some(([, v]) => v !== "정보 없음");
  blocks.push({
    h2: `${name} 주차 요금과 시간별 예상 금액`,
    p: [
      fee.free
        ? `${josa(name, "은/는")} 무료 주차장으로 등록되어 있습니다. 다만 무료 주차장도 장기 방치 차량을 막기 위해 최대 주차 시간을 두거나, 특정 시간대에만 무료로 운영하는 경우가 있으니 현장 안내판을 확인하세요.`
        : join([
            `${name}의 요금 구분은 ‘${feeText || "미등록"}’입니다.`,
            fee.basicMin && fee.basicWon !== undefined ? `처음 ${n(fee.basicMin)}분은 ${n(fee.basicWon)}원이고,` : "",
            fee.addMin && fee.addWon !== undefined ? `이후 ${n(fee.addMin)}분마다 ${n(fee.addWon)}원이 추가됩니다.` : "",
            fee.dayWon ? `하루 종일 세울 때는 1일 주차권(${n(fee.dayWon)}원)이 상한처럼 적용되어 아래 계산에도 반영했습니다.` : "",
          ]),
      knowCost
        ? "아래 표는 등록된 기본 요금과 추가 요금으로 계산한 예상 금액입니다. 경차·저공해차·장애인 차량 감면, 야간 할인, 시간대별 요금 차등은 반영하지 않았으므로 실제 정산 금액과 다를 수 있습니다."
        : "기본 요금이나 추가 요금 단위가 등록되어 있지 않아 시간별 금액을 계산할 수 없습니다. 방문 전에 관리기관에 요금을 확인하거나 현장 요금표를 참고하세요.",
    ],
    table: knowCost ? { head: ["주차 시간", "예상 요금"], rows: costRows } : undefined,
    ul: [
      fee.dayWon ? `1일 주차권: ${n(fee.dayWon)}원` : "1일 주차권: 등록된 정보 없음",
      fee.monthWon ? `월 정기권: ${n(fee.monthWon)}원 (한 달 20일 출근 기준 하루 약 ${n(Math.round(fee.monthWon / 20))}원)` : "월 정기권: 등록된 정보 없음",
      se === "공영"
        ? "공영주차장은 경차, 저공해 자동차, 장애인·국가유공자 차량, 다자녀 가정 차량 등에 감면 혜택을 주는 경우가 많습니다. 감면 대상과 비율은 지자체 조례마다 다릅니다."
        : "민영주차장은 인근 상가 이용 시 할인(주차 확인)을 해 주는 경우가 있으니 영수증을 챙기세요.",
    ],
  });

  /* ---- 운영시간 ---- */
  blocks.push({
    h2: `${name} 운영시간과 운영 요일`,
    p: [
      join([
        days ? `운영 요일은 ‘${days}’로 등록되어 있습니다.` : "운영 요일은 등록되어 있지 않습니다.",
        is24
          ? "평일 기준 24시간 운영되어 늦은 밤이나 이른 새벽에도 이용할 수 있습니다. 다만 무인 정산기가 고장 나거나 출차 차단기가 내려가 있을 때를 대비해 관리기관 연락처를 알아 두면 좋습니다."
          : weekday
            ? `평일은 ${weekday}에 운영합니다. 운영시간이 끝난 뒤 입·출차가 제한되거나, 운영시간 외에는 무료로 개방되는 주차장도 있으니 현장 안내를 확인하세요.`
            : "평일 운영시간이 등록되어 있지 않습니다.",
      ]),
      join([
        sat ? `토요일은 ${sat}에 운영합니다.` : "토요일 운영시간은 등록되어 있지 않습니다.",
        hol ? `공휴일은 ${hol}에 운영합니다.` : "공휴일 운영시간은 따로 등록되어 있지 않습니다.",
        "명절이나 지역 행사 기간에는 공영주차장을 임시로 무료 개방하는 지자체가 많으니 해당 시기에는 지자체 공지를 함께 보세요.",
      ]),
    ],
    table: {
      head: ["요일", "운영시간"],
      rows: [
        ["평일", weekday || "정보 없음"],
        ["토요일", sat || "정보 없음"],
        ["공휴일", hol || "정보 없음"],
      ],
    },
  });

  /* ---- 결제·편의 ---- */
  blocks.push({
    h2: "결제 방법과 이용 편의",
    p: [
      join([
        pay ? `등록된 결제 방법은 ‘${pay}’입니다.` : "결제 방법은 등록되어 있지 않습니다.",
        "최근에는 무인 정산기와 번호판 인식 출차가 보편화되어 카드나 간편결제로 사전 정산하는 곳이 늘고 있습니다. 현금만 받는 노상주차장도 남아 있으니 소액 현금을 준비해 두면 안전합니다.",
      ]),
      disabled
        ? `${josa(name, "은/는")} 장애인 전용 주차구역을 갖추고 있습니다. 장애인 전용 주차구역은 ‘장애인사용자동차 표지’를 붙이고 보행이 어려운 장애인이 탄 경우에만 이용할 수 있으며, 위반하면 과태료 10만 원이 부과됩니다.`
        : "장애인 전용 주차구역 보유 여부는 ‘미보유’ 또는 미등록 상태입니다. 휠체어를 이용하거나 보행이 불편한 분과 동행한다면 방문 전에 관리기관에 확인하세요.",
      note ? `특기사항으로 ‘${note}’라는 안내가 등록되어 있습니다.` : "",
    ].filter(Boolean),
  });

  /* ---- 위치 ---- */
  blocks.push({
    h2: `${name} 위치와 찾아가는 길`,
    p: [
      join([
        row.address ? `도로명 주소는 ${row.address}` : "",
        jibun ? `(지번 ${jibun})입니다.` : row.address ? "입니다." : "",
        row.lat && row.lng
          ? `좌표는 위도 ${row.lat.toFixed(5)}, 경도 ${row.lng.toFixed(5)}로, 위의 ‘카카오맵 길찾기’ 버튼을 누르면 현재 위치에서 바로 경로를 볼 수 있습니다.`
          : "좌표가 등록되어 있지 않아 지도에서는 주소로 검색해야 합니다. 주소 검색 결과가 입구와 다를 수 있으니 주변 건물 이름을 함께 확인하세요.",
      ]),
      "내비게이션에 주차장 이름으로 검색하면 같은 이름의 다른 주차장이 먼저 나오는 경우가 있습니다. 가능하면 도로명 주소나 좌표로 목적지를 지정하고, 출입구가 대로변이 아닌 이면도로 쪽에 있는지 지도에서 미리 확인하면 헤매지 않습니다.",
    ],
  });

  /* ---- 지역 통계 ---- */
  if (ctx.total > 1) {
    blocks.push({
      h2: `${region} 주차장 현황`,
      p: [
        `${regionGu}에는 공공데이터에 등록된 주차장이 ${n(ctx.total)}곳 있습니다. 이 가운데 공영주차장은 ${n(publicCount)}곳(${pct(publicCount, ctx.total)}), 요금 정보상 무료인 곳은 ${n(freeCount)}곳(${pct(freeCount, ctx.total)})입니다.${ctx.avgCapacity ? ` 주차면 수를 알 수 있는 주차장의 평균 규모는 ${n(ctx.avgCapacity)}면입니다.` : ""}`,
        freeCount
          ? `무료 주차장만 모아 보려면 ${region} 무료 주차장 목록을, 요금이 있더라도 넓은 곳을 찾는다면 주차면 순 정렬을 이용하세요.`
          : `${region}에는 무료로 등록된 주차장이 없어, 공영주차장의 기본 요금과 1일 주차권 금액을 비교해 고르는 것이 좋습니다.`,
      ],
      links: [
        { label: `${region} 주차장 전체`, href: withQuery("/parking", { sido: sido?.slug, gu: gu?.code }) },
        { label: `${region} 무료 주차장`, href: withQuery("/parking", { sido: sido?.slug, gu: gu?.code, f: "free" }), note: `${n(freeCount)}곳` },
        { label: `${region} 공영 주차장`, href: withQuery("/parking", { sido: sido?.slug, gu: gu?.code, f: "public" }), note: `${n(publicCount)}곳` },
      ],
    });
  }

  /* ---- 주변 주차장 ---- */
  if (!ctx.nearby.length) blocks.push(noNearbyBlock("주차장", region, sido?.name ?? "전국", withQuery("/parking", { sido: sido?.slug })));
  if (ctx.nearby.length) {
    blocks.push({
      h2: `${name} 주변 다른 주차장`,
      p: [
        `${josa(name, "이/가")} 만차이거나 요금이 맞지 않을 때 대안으로 삼을 만한 같은 지역의 주차장입니다. 거리는 두 주차장 좌표 사이의 직선거리이며 실제 이동 거리는 더 길 수 있습니다.`,
      ],
      links: ctx.nearby.map(({ row: r, km: d }) => ({
        label: r.name,
        href: `/parking/${r.sido ?? sido?.slug}-${r.key}`,
        note: join([d !== undefined ? km(d) : "", r.sub, r.tags.slice(0, 2).join(", ")], " · "),
      })),
    });
  }

  /* ---- 주변 주차장 비교 ---- */
  if (ctx.nearby.length >= 2) {
    blocks.push({
      h2: "주변 주차장과 조건 비교",
      p: [
        `같은 ${regionGu} 안에서 가까운 주차장의 규모와 요금 구분을 ${josa(name, "과/와")} 나란히 놓았습니다. 주차면이 많을수록 자리를 찾기 쉽고, 무료 주차장은 회전율이 낮아 오전 일찍이 아니면 만차일 때가 많습니다.`,
      ],
      table: {
        head: ["주차장", "거리", "구분", "주차면", "요금"],
        rows: [
          [`${name} (이곳)`, "-", row.sub || "-", cap ? `${n(cap)}면` : "-", feeText || "-"],
          ...ctx.nearby.map(({ row: r, km: d }) => [
            r.name,
            d !== undefined ? km(d) : "-",
            r.sub || "-",
            r.num?.capacity ? `${n(r.num.capacity)}면` : "-",
            infoOf(r, "요금") || "-",
          ]),
        ],
      },
    });
  }

  /* ---- 주차장 종류 ---- */
  blocks.push({
    h2: "주차장 종류별 특징",
    p: [
      `${josa(name, "은/는")} ${join([se, type]) || "구분 미등록"} 주차장입니다. 공공데이터의 주차장 구분과 유형은 요금 체계와 이용 조건을 짐작하는 데 도움이 됩니다.`,
    ],
    table: {
      head: ["구분", "뜻", "이용할 때 참고"],
      rows: [
        ["공영", "지자체·공단이 설치·운영", "조례로 요금 결정, 감면 제도가 많음"],
        ["민영", "개인·법인이 운영", "요금·운영시간이 운영자 재량, 상가 할인 확인"],
        ["노상", "도로 가장자리 구획", "단시간 주차용, 구획이 적고 회전이 빠름"],
        ["노외", "별도 부지·주차 건물", "장시간 주차에 적합, 정산 시설 완비"],
        ["부설", "건물에 딸린 주차장", "건물 이용객 우선, 운영시간이 건물과 같음"],
      ],
    },
    after: [
      "같은 공영이라도 노상과 노외의 요금이 다르게 책정되는 경우가 많습니다. 보통 도심 노상주차장이 회전율을 높이려고 더 비싸게 받고, 노외주차장은 1일 주차권이나 정기권으로 장시간 이용을 유도합니다.",
    ],
  });

  /* ---- 이용 순서 ---- */
  blocks.push({
    h2: `${name} 이용 순서`,
    ul:
      type === "노상"
        ? [
            "도착 전: 노상주차장은 구획 수가 적어 빈자리가 금방 사라집니다. 주변을 한 바퀴 돌 시간을 고려해 여유 있게 출발하세요.",
            "주차: 흰색 실선 구획 안에만 세워야 하며, 구획선을 넘거나 두 칸을 차지하면 단속 대상이 될 수 있습니다.",
            "요금: 주차 요원에게 직접 내거나, 무인 단말기·모바일 앱으로 결제하는 방식이 섞여 있습니다. 현장 안내판의 결제 방법을 먼저 확인하세요.",
            "출차: 선불 시간제라면 정한 시간 안에 차를 빼야 추가 요금이나 과태료가 붙지 않습니다.",
          ]
        : type === "부설"
          ? [
              "도착 전: 부설주차장은 건물 이용객 우선인 곳이 많습니다. 외부 차량도 받는지, 몇 시까지 여는지 확인하세요.",
              "입차: 입구에서 주차권을 받거나 번호판이 자동으로 인식됩니다. 층별 안내를 보고 빈자리가 많은 층으로 이동하세요.",
              "할인: 건물 안 상점이나 병원을 이용했다면 주차 확인(할인 도장·등록)을 받으세요.",
              "출차: 정산기에서 차량 번호로 요금을 확인하고 결제한 뒤 출차합니다.",
            ]
          : [
              "도착 전: 운영시간과 요금을 확인하고, 만차에 대비해 근처 주차장을 하나 더 정해 두세요.",
              "입차: 입구 차단기에서 주차권을 뽑거나 번호판 인식으로 들어갑니다. 입차 시각이 요금 기준이 됩니다.",
              "주차: 기둥 번호나 구역 표시를 사진으로 남겨 두면 나올 때 차를 쉽게 찾을 수 있습니다.",
              "정산: 사전 정산기나 출구 정산기에서 카드·간편결제로 냅니다. 감면 대상이면 증빙을 보여 주세요.",
              "출차: 사전 정산 뒤에는 보통 15~30분 안에 나가야 추가 요금이 붙지 않습니다.",
            ],
  });

  /* ---- 요금 절약 ---- */
  blocks.push({
    h2: "주차 요금 아끼는 방법",
    ul: [
      "공영주차장은 경차 50%, 저공해 자동차 50%, 장애인·국가유공자 차량 감면처럼 조례로 정한 할인이 있습니다. 대상이라면 정산할 때 꼭 말하세요.",
      fee.dayWon ? `오래 세운다면 시간 요금 대신 1일 주차권(${n(fee.dayWon)}원)이 유리한지 비교하세요.` : "하루 이상 세운다면 1일 주차권이나 정기권이 있는지 관리기관에 물어보세요.",
      fee.monthWon ? `매일 출퇴근에 쓴다면 월 정기권(${n(fee.monthWon)}원)이 시간 요금보다 훨씬 저렴할 수 있습니다.` : "출퇴근용이라면 월 정기권 판매 여부를 확인해 보세요.",
      "지자체가 운영하는 공영주차장 공유 사업(거주자 우선 주차 구획의 낮 시간 개방 등)을 이용하면 저렴하게 세울 수 있습니다.",
      "주말·공휴일이나 야간에 무료 개방하는 공공기관 주차장이 많습니다. 기관 누리집의 주차 안내를 확인하세요.",
    ],
  });

  /* ---- 주정차 규칙 ---- */
  blocks.push({
    h2: "주차장 밖에 세우면 안 되는 곳",
    p: [
      `${josa(name, "이/가")} 만차라고 주변 도로에 잠깐 세우면 단속될 수 있습니다. 아래 구역은 주민 신고만으로도 과태료가 부과되는 대표적인 절대 주정차 금지 구역입니다.`,
    ],
    ul: [
      "소화전 주변 5m 이내 (승용차 과태료 8만 원 수준, 일반 구역의 두 배)",
      "교차로 가장자리와 도로 모퉁이 5m 이내",
      "버스정류소 표지판 주변 10m 이내",
      "횡단보도 위와 정지선 안쪽",
      "어린이보호구역(오전 8시~오후 8시): 일반 구역의 세 배 과태료",
      "인도(보도) 위: 보행자 통행을 막아 상시 단속 대상",
    ],
    after: ["과태료 금액은 차종과 지자체, 법령 개정에 따라 달라질 수 있습니다. 짧은 정차라도 위 구역은 피하고 가까운 공영주차장을 이용하는 것이 결국 저렴합니다."],
  });

  /* ---- 이용 팁 ---- */
  blocks.push({
    h2: "이용 전 확인하면 좋은 것",
    ul: [
      cap && cap < 30
        ? `주차면이 ${n(cap)}면으로 적어 출퇴근 시간이나 주말 낮에는 금방 찰 수 있습니다. 가까운 대체 주차장을 하나 더 알아 두세요.`
        : cap && cap >= 300
          ? `주차면이 ${n(cap)}면으로 넓어 자리를 찾기는 쉽지만, 내 차 위치를 사진으로 남겨 두면 나올 때 편합니다.`
          : "혼잡 시간대에는 입구에서 대기할 수 있으니 여유 있게 도착하세요.",
      is24 ? "심야에 이용한다면 조명과 CCTV가 있는 출입구 가까운 자리를 고르는 것이 안전합니다." : "운영 종료 시각 전에 출차해야 차량이 갇히지 않습니다.",
      fee.free ? "무료 주차장은 장기 주차 차량이 많아 회전율이 낮습니다. 짧게 볼일을 볼 때는 이른 시간에 방문하세요." : "정산 전에 할인 대상(경차·저공해차·장애인 차량 등)인지 확인하고 증빙을 준비하세요.",
      "전기차라면 주차장 안이나 가까운 곳에 충전기가 있는지 확인해 충전과 주차를 한 번에 해결할 수 있습니다.",
      "공공데이터는 지자체가 주기적으로 갱신하지만 현장 변경이 늦게 반영될 수 있습니다. 요금·운영시간이 중요하다면 관리기관에 전화로 확인하세요.",
    ],
  });

  /* ---- 관련 정보 ---- */
  blocks.push({
    h2: `${region} 함께 찾는 정보`,
    p: [`주차 말고도 ${region}에서 운전할 때 자주 찾는 정보를 모았습니다.`],
    links: [
      { label: `${region} 전기차 충전소`, href: withQuery("/charge", { type: "ev", sido: sido?.slug, gu: gu?.code }), note: "충전기 실시간 상태" },
      { label: `${region} 자동차 정비소`, href: withQuery("/repair", { type: "shop", sido: sido?.slug, gu: gu?.code }) },
      { label: `${region} 자동차 검사소`, href: withQuery("/repair", { type: "inspection", sido: sido?.slug, gu: gu?.code }) },
      { label: "유류비·충전비 계산기", href: "/guide/calculator" },
    ],
  });

  /* ---- 데이터 안내 ---- */
  blocks.push({
    h2: "정보 출처와 기준일",
    p: [
      `이 페이지는 ${josa(org || "관할 지방자치단체", "이/가")} 공공데이터포털에 제공한 전국주차장정보표준데이터를 차곳간이 정리한 것입니다.${refDate ? ` 데이터 기준일은 ${refDate}입니다.` : ""} 표준데이터는 지자체가 직접 입력하므로 요금이나 운영시간이 바뀐 뒤 반영까지 시간이 걸릴 수 있습니다.`,
      "잘못된 정보를 발견하면 관리기관이나 공공데이터포털의 ‘오류 신고’를 이용해 주세요. 원천 데이터가 고쳐지면 차곳간에도 매월 자동으로 반영됩니다.",
    ],
  });

  /* ---- FAQ ---- */
  const c60 = costFor(fee, 60);
  const faq: Faq[] = [
    {
      q: `${name} 주차 요금은 얼마인가요?`,
      a: fee.free
        ? `${josa(name, "은/는")} 무료 주차장으로 등록되어 있습니다. 운영 방침이 바뀔 수 있으니 현장 안내판을 확인하세요.`
        : c60 !== undefined
          ? `등록된 요금 기준으로 1시간 주차 시 약 ${n(c60)}원입니다.${fee.dayWon ? ` 1일 주차권은 ${n(fee.dayWon)}원입니다.` : ""}`
          : `요금 구분은 ‘${feeText || "미등록"}’이며 세부 요금은 등록되어 있지 않습니다. 관리기관${row.tel ? `(${row.tel})` : ""}에 문의하세요.`,
    },
    {
      q: `${josa(name, "은/는")} 24시간 운영하나요?`,
      a: is24 ? "평일 기준 24시간 운영으로 등록되어 있습니다." : weekday ? `평일 운영시간은 ${weekday}입니다. 주말·공휴일은 본문 표를 참고하세요.` : "운영시간이 등록되어 있지 않습니다. 관리기관에 확인하세요.",
    },
    {
      q: `${name}에는 몇 대까지 주차할 수 있나요?`,
      a: cap ? `주차면은 ${n(cap)}면입니다. ${regionGu} 평균${ctx.avgCapacity ? `(${n(ctx.avgCapacity)}면)` : ""}과 비교해 규모를 가늠해 보세요.` : "주차면 수가 등록되어 있지 않습니다.",
    },
    {
      q: `${name}에 장애인 전용 주차구역이 있나요?`,
      a: disabled ? "장애인 전용 주차구역을 보유한 주차장으로 등록되어 있습니다." : "보유 여부가 ‘없음’이거나 등록되어 있지 않습니다. 필요하면 방문 전에 관리기관에 확인하세요.",
    },
    {
      q: `${region}에서 무료 주차장은 몇 곳인가요?`,
      a: `공공데이터 기준으로 ${region}에는 무료로 등록된 주차장이 ${n(freeCount)}곳 있습니다. 차곳간의 ${region} 무료 주차장 목록에서 확인할 수 있습니다.`,
    },
    {
      q: `${name} 결제는 어떻게 하나요?`,
      a: pay ? `등록된 결제 방법은 ‘${pay}’입니다. 현장 정산기 사정에 따라 일부 수단이 안 될 수 있습니다.` : "결제 방법이 등록되어 있지 않습니다. 카드와 소액 현금을 함께 준비하면 안전합니다.",
    },
    {
      q: `${name} 월 정기권이 있나요?`,
      a: fee.monthWon ? `월 정기권은 ${n(fee.monthWon)}원으로 등록되어 있습니다. 판매 수량이 정해진 경우가 많으니 관리기관에 먼저 문의하세요.` : "월 정기권 정보는 등록되어 있지 않습니다. 관리기관에 판매 여부를 문의하세요.",
    },
    {
      q: `${name} 관리기관 연락처는요?`,
      a: row.tel ? `관리기관${org ? `(${org})` : ""} 전화번호는 ${row.tel}입니다.` : `${org ? `${josa(org, "이/가")} 관리하며, ` : ""}전화번호는 등록되어 있지 않습니다.`,
    },
  ];

  return { lead, blocks, faq };
}
