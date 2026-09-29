/**
 * 전기차·수소 충전소 상세 본문.
 */
import type { Row } from "../dataset-types";
import type { Sido, Sigungu } from "../codes";
import { findSido } from "../codes";
import type { EvStation } from "../ev";
import { summarize } from "../ev";
import { distanceKm } from "../its";
import { withQuery } from "../url";
import { type Article, type Block, type Faq, infoOf, josa, join, km, n, pct } from "./common";

/** 전기·수소차 공통: 친환경차 혜택 */
function ecoBenefits(kind: "전기차" | "수소차"): Block {
  return {
    h2: `${kind} 유지 혜택`,
    p: [`${kind}는 저공해 자동차 1종으로 분류되어 여러 감면 혜택을 받을 수 있습니다. 혜택의 범위와 기간은 정부·지자체 정책에 따라 바뀌므로 이용 전에 최신 기준을 확인하세요.`],
    table: {
      head: ["혜택", "내용"],
      rows: [
        ["구매 보조금", "국고·지자체 보조금 (차종·지역별 상이, 매년 공고)"],
        ["고속도로 통행료", "친환경차 통행료 감면 (하이패스 등록 필요)"],
        ["공영주차장", "주차 요금 감면 (지자체 조례별 상이)"],
        ["혼잡통행료", "일부 지역 혼잡통행료 면제·감면"],
        ["세제", "개별소비세·취득세 감면 (한도·기한 있음)"],
      ],
    },
  };
}

/* ================================================================ 전기차 */

/** 참고 단가 (원/kWh). 운영사·회원 여부·시간대에 따라 다르다 */
const PRICE_FAST = 330;
const PRICE_SLOW = 290;

/** 60kWh 배터리 20→80% (36kWh) 충전 예상 시간(분). 출력의 약 85%로 들어온다고 본다 */
function chargeMinutes(outputKw: number) {
  if (!outputKw) return undefined;
  const effective = Math.min(outputKw, 150) * 0.85;
  return Math.round((36 / effective) * 60);
}

function duration(min?: number) {
  if (min === undefined) return "-";
  if (min < 60) return `약 ${min}분`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `약 ${h}시간${m ? ` ${m}분` : ""}`;
}

export function evArticle(station: EvStation, region: { sido: Sido; gu: Sigungu }, all: EvStation[]): Article {
  const name = station.name;
  const regionName = `${region.sido.short} ${region.gu.name}`;
  const chargers = station.chargers;
  const fast = chargers.filter((c) => c.fast);
  const slow = chargers.filter((c) => !c.fast);
  const available = chargers.filter((c) => c.state === "available").length;
  const charging = chargers.filter((c) => c.state === "charging").length;
  const offline = chargers.filter((c) => c.state === "offline").length;
  const maxKw = Math.max(0, ...chargers.map((c) => c.output));
  const types = [...new Set(chargers.map((c) => c.typeName))].filter(Boolean);
  const sum = summarize(all);
  const nearby = all
    .filter((s) => s.id !== station.id)
    .map((s) => ({ s, d: station.lat && s.lat ? distanceKm(station, s) : undefined }))
    .sort((a, b) => (a.d ?? Infinity) - (b.d ?? Infinity))
    .slice(0, 6);
  const bigger = all.filter((s) => s.chargers.length > chargers.length).length;

  const lead = [
    join([
      `${josa(name, "은/는")} ${region.sido.name} ${region.gu.name}에 있는 전기차 충전소입니다.`,
      station.address ? `주소는 ${station.address}${station.location ? `(${station.location})` : ""}입니다.` : "",
      `충전기는 모두 ${n(chargers.length)}대로 급속 ${n(fast.length)}대, 완속 ${n(slow.length)}대이며, 최대 출력은 ${n(maxKw)}kW입니다.`,
    ]),
    join([
      `지금 충전 가능한 충전기는 ${n(available)}대, 충전 중인 충전기는 ${n(charging)}대입니다.`,
      station.useTime ? `이용 시간은 ${station.useTime},` : "",
      station.operator ? `운영기관은 ${station.operator}입니다.` : "",
    ]),
  ];

  const blocks: Block[] = [];

  blocks.push({
    h2: `${name} 충전기 구성`,
    p: [
      join([
        `${name}에는 ${types.length ? types.join(", ") : "등록되지 않은"} 규격의 충전기가 있습니다.`,
        fast.length
          ? `급속 충전기는 ${n(fast.length)}대로, 출력은 ${[...new Set(fast.map((c) => c.output))].filter(Boolean).sort((a, b) => b - a).map((o) => `${o}kW`).join("·") || "미등록"}입니다.`
          : "급속 충전기는 없고 완속 충전기만 있어, 오래 세워 두면서 충전하는 용도에 알맞습니다.",
        slow.length ? `완속 충전기 ${n(slow.length)}대는 보통 7kW 안팎으로, 완전히 채우는 데 몇 시간이 걸립니다.` : "",
      ]),
      `${regionName}의 충전소 ${n(sum.stations)}곳 가운데 충전기 수 기준 ${n(bigger + 1)}번째로 큰 충전소입니다.`,
    ],
    table: {
      head: ["구분", "대수", "현재 충전 가능"],
      rows: [
        ["급속", `${n(fast.length)}대`, `${n(fast.filter((c) => c.state === "available").length)}대`],
        ["완속", `${n(slow.length)}대`, `${n(slow.filter((c) => c.state === "available").length)}대`],
        ["점검·통신 이상", `${n(offline)}대`, "-"],
      ],
    },
  });

  const outputs = [...new Set(chargers.map((c) => c.output).filter(Boolean))].sort((a, b) => b - a);
  blocks.push({
    h2: "충전 시간과 요금 예상",
    p: [
      `아래 표는 배터리 용량 60kWh인 전기차를 20%에서 80%까지(36kWh) 충전한다고 가정한 예상치입니다. 실제 시간은 차량이 받아들일 수 있는 최대 출력, 배터리 온도, 충전 구간(80% 이후 급격히 느려짐)에 따라 달라집니다. 요금은 환경부 공공 충전기 수준의 참고 단가(급속 약 ${PRICE_FAST}원, 완속 약 ${PRICE_SLOW}원/kWh)로 계산했으며, 운영사와 회원 카드, 시간대에 따라 다릅니다.`,
    ],
    table: {
      head: ["충전기 출력", "20→80% 예상 시간", "예상 요금"],
      rows: (outputs.length ? outputs : [7]).map((o) => [
        `${o}kW`,
        duration(chargeMinutes(o)),
        `약 ${n(Math.round((36 * (o >= 30 ? PRICE_FAST : PRICE_SLOW)) / 100) * 100)}원`,
      ]),
    },
  });

  blocks.push({
    h2: `${name} 이용 정보`,
    ul: [
      `이용 시간: ${station.useTime || "등록되지 않음"}`,
      `주차: ${station.parkingFree ? "충전 중 주차 무료로 등록" : "주차 요금이 있거나 등록되지 않음"}`,
      `이용 제한: ${station.limited ? station.limitDetail || "제한 있음(거주자·직원 전용 등)" : "제한 없음"}`,
      `운영기관: ${station.operator || "-"}${station.operatorTel ? ` (${station.operatorTel})` : ""}`,
      ...(station.note ? [`안내: ${station.note}`] : []),
    ],
    after: [
      station.limited
        ? "이용 제한이 있는 충전소는 아파트 거주자나 건물 이용객만 쓸 수 있는 경우가 많습니다. 외부인 이용 가능 여부를 먼저 확인하세요."
        : "누구나 이용할 수 있는 충전소입니다. 회원 카드가 없어도 신용카드나 앱 결제로 충전할 수 있는 곳이 많지만, 운영사 회원 카드를 쓰면 단가가 더 낮습니다.",
    ],
  });

  blocks.push({
    h2: "충전기 상태 읽는 법",
    table: {
      head: ["상태", "뜻"],
      rows: [
        ["충전 가능", "비어 있어 바로 충전할 수 있음"],
        ["충전 중", "다른 차량이 충전하고 있음. 급속은 보통 30분~1시간 뒤 비워짐"],
        ["점검 중·통신 이상", "고장·점검 또는 상태 정보가 들어오지 않음. 현장에서는 쓸 수 있을 때도 있음"],
      ],
    },
    after: ["충전기 상태는 환경공단 전기차 충전소 정보로 약 10분 간격으로 갱신됩니다. 도착했을 때 상태가 바뀌었을 수 있으니, 급하다면 주변 충전소도 함께 봐 두세요."],
  });

  if (nearby.length) {
    blocks.push({
      h2: `${name} 주변 충전소`,
      table: {
        head: ["충전소", "거리", "충전기", "지금 가능"],
        rows: nearby.map(({ s, d }) => [
          s.name,
          d !== undefined ? km(d) : "-",
          `급속 ${s.chargers.filter((c) => c.fast).length} · 완속 ${s.chargers.filter((c) => !c.fast).length}`,
          `${s.chargers.filter((c) => c.state === "available").length}대`,
        ]),
      },
      links: nearby.map(({ s }) => ({ label: s.name, href: `/charge/ev-${s.zscode}-${s.id}` })),
    });
  }

  blocks.push({
    h2: `${regionName} 충전 인프라 현황`,
    p: [
      `${regionName}에는 충전소 ${n(sum.stations)}곳, 충전기 ${n(sum.chargers)}대가 있습니다. 급속 충전기는 ${n(sum.fast)}대(${pct(sum.fast, sum.chargers)}), 완속 충전기는 ${n(sum.slow)}대입니다. 지금 이 순간 충전 가능한 충전기는 ${n(sum.available)}대, 충전 중인 충전기는 ${n(sum.charging)}대입니다.`,
      "급속 충전기 비율이 낮은 지역에서는 퇴근 시간대와 주말에 급속 충전 대기가 생기기 쉽습니다. 집이나 직장 완속 충전을 기본으로 하고, 급속은 장거리 이동 때 쓰는 것이 효율적입니다.",
    ],
    links: [{ label: `${regionName} 충전소 전체 보기`, href: withQuery("/charge", { type: "ev", sido: region.sido.slug, gu: region.gu.code }) }],
  });

  blocks.push({
    h2: `${name} 충전 순서`,
    ul: [
      "도착 전: 차곳간이나 운영사 앱에서 충전 가능 대수를 확인합니다.",
      "주차: 충전 구역에 차를 세우고 시동(전원)을 끕니다. 충전구 방향이 케이블에 닿는지 확인하세요.",
      "인증: 회원 카드를 태그하거나, 신용카드·앱 QR로 결제 수단을 등록합니다.",
      "연결: 차량 충전구에 맞는 커넥터를 골라 끝까지 밀어 넣습니다. 딸깍 소리가 나야 제대로 연결된 것입니다.",
      "충전: 화면에서 충전 방식(금액·용량·완충)을 선택하고 시작합니다. 앱으로 진행 상황을 볼 수 있습니다.",
      "종료: 종료 버튼을 누르거나 목표에 도달하면 커넥터를 뽑아 제자리에 걸고, 바로 차를 옮깁니다.",
    ],
  });

  blocks.push({
    h2: "결제 방법과 요금 비교",
    p: [
      "전기차 충전 요금은 운영사와 결제 방법에 따라 다릅니다. 환경부가 운영하는 공공 급속 충전기는 전국 요금이 같고, 민간 운영사는 자체 요금을 정합니다. 운영사 회원 카드를 쓰면 비회원 결제보다 저렴하고, 다른 운영사 충전기를 쓸 때는 로밍 요금이 붙을 수 있습니다.",
    ],
    table: {
      head: ["결제 방법", "특징"],
      rows: [
        ["운영사 회원 카드", "가장 저렴한 회원가 적용, 사전 가입 필요"],
        ["환경부 회원 카드", "공공 충전기 회원가, 여러 운영사 로밍 가능"],
        ["신용카드 직접 결제", "가입 없이 바로 결제, 비회원 단가 적용"],
        ["운영사 앱 QR", "앱 등록 카드로 결제, 충전 알림 제공"],
      ],
    },
    after: [
      `${name}의 운영기관은 ${station.operator || "등록되지 않았"}${station.operator ? "입니다" : "습니다"}. 자주 이용한다면 해당 운영사의 회원 카드나 앱을 만들어 두는 것이 이득입니다.`,
    ],
  });

  blocks.push({
    h2: "충전 규격 한눈에 보기",
    table: {
      head: ["규격", "방식", "주로 쓰는 차"],
      rows: [
        ["DC콤보(CCS1)", "직류 급속", "국내 판매 대부분의 전기차"],
        ["차데모", "직류 급속", "일부 초기 일본계 전기차"],
        ["AC3상", "교류 급속", "일부 초기 유럽계 전기차"],
        ["AC 완속(5핀)", "교류 완속", "국내 전기차 대부분"],
        ["NACS", "직류·교류 겸용", "일부 수입 전기차(어댑터 사용 포함)"],
      ],
    },
    after: [`${josa(name, "은/는")} ${types.join(", ") || "규격 미등록"} 충전기를 갖추고 있습니다. 내 차 충전구와 맞는지 확인하고 방문하세요.`],
  });

  blocks.push({
    h2: "겨울철 충전 요령",
    p: [
      "기온이 낮으면 배터리 화학 반응이 느려져 급속 충전 속도가 크게 떨어지고, 주행거리도 줄어듭니다. 주행을 막 마친 따뜻한 배터리 상태에서 충전하거나, 차량의 배터리 예열 기능(목적지를 충전소로 설정하면 자동으로 켜지는 차종이 많음)을 활용하세요.",
      "지하 주차장 충전기는 바깥보다 온도가 높아 겨울 충전에 유리합니다. 반대로 한파에 실외 충전기를 쓸 때는 충전 시간을 넉넉히 잡으세요.",
    ],
  });

  blocks.push({
    h2: "충전이 안 될 때 확인할 것",
    table: {
      head: ["증상", "먼저 해 볼 일"],
      rows: [
        ["인증이 안 됨", "카드를 다시 태그하거나 앱 QR 결제로 바꿔 시도"],
        ["커넥터가 안 들어감", "충전구 덮개와 잠금 상태 확인, 규격이 맞는지 확인"],
        ["충전이 곧 멈춤", "커넥터를 다시 끝까지 꽂고 재시작, 차량 충전 제한 설정 확인"],
        ["속도가 매우 느림", "배터리 온도·잔량(80% 이상이면 느려짐) 확인, 다른 충전기 이용"],
        ["커넥터가 안 빠짐", "차 문을 잠갔다 풀어 충전구 잠금 해제, 안 되면 운영사 고객센터"],
      ],
    },
    after: [station.operatorTel ? `현장에서 해결되지 않으면 운영기관 고객센터(${station.operatorTel})에 충전기 번호를 알려 주세요.` : "현장에서 해결되지 않으면 충전기에 붙은 운영사 고객센터 번호로 문의하세요."],
  });

  blocks.push(ecoBenefits("전기차"));

  blocks.push({
    h2: "충전 예절과 과태료",
    ul: [
      "급속 충전구역에서 충전을 시작한 뒤 1시간이 지나도록 차를 빼지 않으면 과태료 대상입니다. 충전이 끝나면 바로 이동하세요.",
      "완속 충전구역도 일정 시간(보통 14시간)을 넘겨 계속 세워 두면 과태료가 부과될 수 있습니다.",
      "전기차가 아닌 차가 충전구역에 주차하거나 충전을 방해하면 과태료(10만 원 수준)가 부과됩니다.",
      "충전 커넥터는 사용 뒤 제자리에 걸어 두고, 케이블이 바닥에 끌리지 않게 정리해 주세요.",
    ],
    after: ["과태료 기준은 친환경자동차법과 지자체 조례에 따르며, 적용 대상 시설과 금액이 바뀔 수 있습니다."],
  });

  blocks.push({
    h2: "배터리를 오래 쓰는 충전 습관",
    ul: [
      "급속 충전은 80% 전후에서 멈추세요. 그 이후는 속도가 크게 떨어지고 배터리 부담이 커집니다.",
      "평소에는 20~80% 구간에서 완속 위주로 충전하는 것이 배터리 수명에 좋습니다.",
      "겨울에는 배터리가 차가워 충전 속도가 느립니다. 주행 직후나 배터리 예열 기능을 켠 상태로 충전하면 빨라집니다.",
      "장거리 이동 전에는 경로 위 급속 충전소를 두세 곳 정해 두세요. 한 곳이 고장이어도 당황하지 않습니다.",
    ],
  });

  blocks.push({
    h2: "함께 보면 좋은 정보",
    links: [
      { label: "전기차 충전 규격 총정리", href: "/guide/charger-types", note: "DC콤보·차데모·AC3상" },
      { label: "전기차 주행거리 순위", href: "/guide/ev-range" },
      { label: "유류비·충전비 계산기", href: "/guide/calculator?mode=ev" },
      { label: `${regionName} 주차장`, href: withQuery("/parking", { sido: region.sido.slug, gu: region.gu.code }) },
    ],
    p: ["출처: 한국환경공단 전기자동차 충전소 정보(공공데이터포털). 충전기 상태는 실시간에 가깝지만 실제와 다를 수 있습니다."],
  });

  const faq: Faq[] = [
    { q: `${name} 충전기는 몇 대인가요?`, a: `모두 ${n(chargers.length)}대로 급속 ${n(fast.length)}대, 완속 ${n(slow.length)}대입니다.` },
    { q: `${name} 지금 충전할 수 있나요?`, a: `마지막 갱신 기준 충전 가능한 충전기는 ${n(available)}대입니다. 상태는 약 10분마다 갱신됩니다.` },
    { q: `${name} 이용 시간은?`, a: station.useTime ? `${station.useTime}로 등록되어 있습니다.` : "이용 시간이 등록되어 있지 않습니다." },
    { q: `${name} 주차비가 있나요?`, a: station.parkingFree ? "충전 중 주차 무료로 등록되어 있습니다." : "주차 무료로 등록되어 있지 않습니다. 건물·주차장 요금이 따로 붙을 수 있습니다." },
    { q: "어떤 차가 충전할 수 있나요?", a: `이 충전소의 충전 규격은 ${types.join(", ") || "미등록"}입니다. 국내 대부분의 전기차는 DC콤보(급속)와 AC 완속을 씁니다.` },
    { q: `${name} 운영기관 연락처는요?`, a: station.operatorTel ? `${station.operator || "운영기관"} 고객센터는 ${station.operatorTel}입니다.` : "운영기관 연락처가 등록되어 있지 않습니다. 충전기에 붙은 번호로 문의하세요." },
    { q: "충전 중에 차 안에 있어도 되나요?", a: "네, 전기차는 충전 중에도 차 안에서 기다릴 수 있고 에어컨·히터를 켤 수도 있습니다. 다만 충전 시간이 조금 늘어납니다." },
    { q: "회원 카드가 없어도 충전할 수 있나요?", a: "대부분의 충전기는 신용카드나 앱 QR 결제를 지원합니다. 다만 비회원 단가가 적용되어 조금 더 비쌉니다." },
    { q: "급속 충전은 얼마나 걸리나요?", a: `${maxKw ? `${maxKw}kW 충전기로 60kWh 배터리를 20%에서 80%까지 채우면 ${duration(chargeMinutes(maxKw))}` : "출력에 따라 다르지만 보통 30분~1시간"} 정도 걸립니다.` },
  ];

  return { lead, blocks, faq };
}

/* ================================================================ 수소 */

export function hydrogenArticle(row: Row, all: Row[]): Article {
  const name = row.name;
  const sido = row.sido ? findSido(row.sido) : undefined;
  const supply = infoOf(row, "공급 방식");
  const chargers = infoOf(row, "충전기");
  const vehicles = infoOf(row, "충전 가능 차량");
  const days = infoOf(row, "운영 요일");
  const hours = infoOf(row, "운영 시간");
  const off = infoOf(row, "휴무");
  const op = infoOf(row, "운영사");
  const use = infoOf(row, "용도");
  const built = infoOf(row, "구축 연도");
  const sameSido = all.filter((r) => r.sido === row.sido);
  const nearby = all
    .filter((r) => r.key !== row.key && r.lat && row.lat)
    .map((r) => ({ r, d: distanceKm({ lat: row.lat!, lng: row.lng! }, { lat: r.lat!, lng: r.lng! }) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 6);
  const nearestOther = nearby[0];
  const bySido = new Map<string, number>();
  for (const r of all) if (r.sido) bySido.set(r.sido, (bySido.get(r.sido) ?? 0) + 1);
  const top = [...bySido.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  const lead = [
    join([
      `${josa(name, "은/는")} ${sido?.name ?? ""}에 있는 수소충전소입니다.`,
      row.address ? `주소는 ${row.address}입니다.` : "",
      supply ? `수소는 ${supply} 방식으로 공급받습니다.` : "",
    ]),
    join([
      hours ? `운영 시간은 ${hours}${days ? `(${days})` : ""}입니다.` : "",
      `전국 수소충전소 ${n(all.length)}곳 중 ${sido?.short ?? "이 지역"}에는 ${n(sameSido.length)}곳이 있습니다.`,
    ]),
  ];

  const blocks: Block[] = [];
  blocks.push({
    h2: `${name} 기본 정보`,
    table: {
      head: ["항목", "내용"],
      rows: [
        ["충전소 이름", name],
        ["주소", row.address || "-"],
        ["공급 방식", supply || "-"],
        ["충전기", chargers || "-"],
        ["충전 가능 차량", vehicles || "-"],
        ["운영 요일", days || "-"],
        ["운영 시간", hours || "-"],
        ["휴무", off || "-"],
        ["운영사", op || "-"],
        ["용도", use || "-"],
        ["구축 연도", built || "-"],
      ],
    },
    after: [
      use && /연구/.test(use)
        ? "연구용으로 등록된 충전소는 일반 차량 충전을 받지 않거나 제한적으로 운영할 수 있습니다. 방문 전에 일반 이용이 가능한지 확인하세요."
        : "수소충전소는 설비 점검이나 수소 입고 지연으로 예고 없이 운영을 멈추는 일이 있습니다. 출발 전 운영사 공지나 전화로 영업 여부를 확인하는 것이 좋습니다.",
    ],
  });

  blocks.push({
    h2: "수소 공급 방식의 차이",
    table: {
      head: ["방식", "설명", "특징"],
      rows: [
        ["튜브트레일러", "외부 생산 수소를 고압 트레일러로 운반", "가장 흔함. 입고 지연 시 운영 중단 가능"],
        ["파이프라인", "배관으로 수소를 직접 공급", "공급이 안정적"],
        ["현장 생산(온사이트)", "충전소에서 천연가스 개질·수전해로 생산", "운송이 필요 없고 공급량이 많음"],
      ],
    },
    after: [supply ? `${josa(name, "은/는")} ${supply} 방식입니다.` : "이 충전소의 공급 방식은 등록되어 있지 않습니다."],
  });

  blocks.push({
    h2: "수소차 충전 시간과 비용",
    p: [
      "수소 승용차는 700bar 고압으로 충전하며, 탱크를 가득 채우는 데 보통 5분 안팎이면 충분합니다. 다만 앞차 충전 직후에는 압력을 다시 올리는 시간이 필요해 대기가 길어질 수 있습니다. 버스·트럭 같은 상용차는 350bar 또는 대용량 설비를 쓰며, 승용차와 충전 설비가 다른 경우가 많습니다.",
      "수소 판매 가격은 충전소마다 다르며 kg당 1만 원 안팎에서 정해지는 경우가 많습니다. 수소 승용차 탱크 용량이 6kg 남짓이므로 가득 충전하면 대략 6만~7만 원, 주행거리는 차종과 조건에 따라 500~600km 수준입니다.",
    ],
  });

  blocks.push({
    h2: "충전할 때 알아 둘 점",
    ul: [
      "수소충전소는 안전 관리 때문에 운전자가 직접 충전하지 않고 충전원이 충전하는 곳이 많습니다.",
      "충전 중에는 시동을 끄고 차에서 내려 안내에 따르세요.",
      "겨울철이나 연속 충전 시에는 충전 속도가 느려지거나 가득 채우지 못할 수 있습니다.",
      "잔량이 20% 아래로 내려가기 전에 충전 계획을 세우세요. 수소충전소는 전기차 충전소보다 훨씬 적습니다.",
      "휴무일과 점심·정비 시간을 확인하세요. 일부 충전소는 오후 늦게 문을 닫습니다.",
    ],
  });

  if (nearby.length) {
    blocks.push({
      h2: `${name}에서 가까운 수소충전소`,
      p: [
        nearestOther
          ? `가장 가까운 다른 수소충전소는 ${josa(nearestOther.r.name, "으로/로")} 직선거리 약 ${km(nearestOther.d)}입니다. 이곳이 운영을 멈췄을 때를 대비해 대체 충전소를 알아 두세요.`
          : "",
      ].filter(Boolean),
      table: {
        head: ["충전소", "거리", "공급 방식"],
        rows: nearby.map(({ r, d }) => [r.name, km(d), infoOf(r, "공급 방식") || "-"]),
      },
      links: nearby.map(({ r }) => ({ label: r.name, href: `/charge/h2-${r.key}` })),
    });
  }

  blocks.push({
    h2: "지역별 수소충전소 수",
    p: [`차곳간에 등록된 전국 수소충전소는 ${n(all.length)}곳입니다. 충전소가 많은 지역은 다음과 같습니다.`],
    table: {
      head: ["지역", "충전소 수", "비율"],
      rows: top.map(([s, c]) => [findSido(s)?.name ?? s, `${n(c)}곳`, pct(c, all.length)]),
    },
    links: [{ label: `${sido?.short ?? ""} 수소충전소 목록`, href: withQuery("/charge", { type: "h2", sido: row.sido }) }],
  });

  blocks.push({
    h2: "수소 충전 비용 계산",
    p: ["탱크 용량 약 6.3kg인 수소 승용차를 기준으로, 남은 양에 따라 가득 충전할 때 드는 비용을 kg당 가격별로 계산했습니다. 실제 판매가는 충전소 누리집이나 현장 게시판에서 확인하세요."],
    table: {
      head: ["충전량", "kg당 9,000원", "kg당 10,000원", "kg당 11,000원"],
      rows: [
        [1.5, "약 25% 충전"],
        [3.2, "약 50% 충전"],
        [5.0, "약 80% 충전"],
        [6.3, "빈 탱크에서 가득"],
      ].map(([kg, label]) => [
        `${label} (${kg}kg)`,
        `${n(Math.round((Number(kg) * 9000) / 100) * 100)}원`,
        `${n(Math.round((Number(kg) * 10000) / 100) * 100)}원`,
        `${n(Math.round((Number(kg) * 11000) / 100) * 100)}원`,
      ]),
    },
  });

  blocks.push({
    h2: "수소충전소 이용 순서",
    ul: [
      "영업 확인: 운영 시간과 휴무일, 당일 수소 재고를 운영사 공지나 전화로 확인합니다.",
      "진입·정차: 안내에 따라 충전기 앞에 차를 세우고 시동을 끕니다.",
      "충전 요청: 충전원에게 충전량(가득 또는 금액)을 알려 줍니다. 셀프 충전소라면 화면 안내를 따릅니다.",
      "대기: 충전 중에는 차 안이나 지정된 대기 장소에 머뭅니다. 흡연과 휴대폰 사용을 삼가세요.",
      "결제·출발: 충전량을 확인하고 결제한 뒤, 노즐이 분리된 것을 확인하고 출발합니다.",
    ],
  });

  blocks.push({
    h2: "수소차와 충전소의 안전",
    p: [
      "수소는 공기보다 매우 가벼워 새어 나와도 위로 빠르게 흩어지는 성질이 있습니다. 수소충전소에는 누출 감지기와 자동 차단 장치, 화염 감지기가 설치되어 있고, 한국가스안전공사가 설치와 정기 검사를 관리합니다.",
      "수소차의 탄소섬유 수소 탱크는 충돌·화재·총격 시험을 거친 고압 용기입니다. 사고가 나면 차량의 안전장치가 탱크 밸브를 자동으로 잠그도록 설계되어 있습니다. 그래도 사고 뒤에는 반드시 제작사 서비스센터에서 탱크와 배관 점검을 받으세요.",
    ],
  });

  blocks.push({
    h2: "수소차의 원리와 특징",
    p: [
      "수소 전기차(FCEV)는 탱크에 저장한 수소와 공기 중 산소를 연료전지에서 반응시켜 전기를 만들고, 그 전기로 모터를 돌립니다. 달릴 때 나오는 것은 물(수증기)뿐이고, 공기를 빨아들이는 과정에서 미세먼지를 걸러 내는 공기 정화 효과도 있습니다.",
      "전기차와 비교하면 충전이 몇 분 만에 끝나고 겨울철 주행거리 감소가 상대적으로 적은 것이 장점입니다. 반면 충전소 수가 적고 운영 시간이 제한적이어서, 생활권 안에 이용 가능한 충전소가 있는지가 가장 중요합니다.",
    ],
  });

  blocks.push({
    h2: "겨울철 수소차 관리",
    ul: [
      "주행 뒤 생긴 물이 얼지 않도록 차량이 자동으로 배출하는 기능이 있습니다. 시동을 끈 뒤 잠시 물 배출 소리가 나는 것은 정상입니다.",
      "한파에는 충전 속도가 느려지고 대기 줄이 길어질 수 있습니다. 잔량에 여유를 두고 충전하세요.",
      "눈이 오는 날에는 충전소가 안전을 위해 운영 시간을 줄이는 경우가 있습니다.",
    ],
  });

  blocks.push({
    h2: "수소차 정기 점검 항목",
    table: {
      head: ["항목", "내용"],
      rows: [
        ["연료전지 공기 필터", "공기 중 이물질을 거르는 필터. 주행 환경에 따라 정기 교환"],
        ["이온 필터", "연료전지 냉각수의 전도도를 낮추는 필터. 제작사 주기에 따라 교환"],
        ["냉각수", "연료전지·전장 냉각수 상태 점검"],
        ["수소 탱크·배관", "누출 여부와 고정 상태 점검, 사고 뒤 필수 점검"],
        ["일반 소모품", "타이어, 브레이크, 에어컨 필터 등은 일반 차량과 같이 관리"],
      ],
    },
    after: ["수소차 고유 부품은 전용 장비가 있는 제작사 서비스센터에서 점검받는 것이 안전합니다."],
  });

  blocks.push(ecoBenefits("수소차"));

  blocks.push({
    h2: "운영 여부와 재고 확인하는 법",
    ul: [
      "운영사 누리집·앱: 수소 재고와 영업 상태를 실시간에 가깝게 공지하는 운영사가 많습니다.",
      "수소 충전소 통합 안내: 정부·유관기관이 제공하는 수소 충전소 정보 서비스에서 전국 충전소의 운영 상태를 볼 수 있습니다.",
      "전화 확인: 공지가 없다면 출발 전에 전화로 오늘 충전이 되는지 물어보는 것이 가장 확실합니다.",
      "차량 내비게이션: 수소차 전용 내비게이션은 주변 충전소 운영 정보를 보여 주는 경우가 많습니다.",
    ],
  });

  blocks.push({
    h2: "장거리 여행 전 충전 계획",
    p: [
      `수소충전소는 전국에 ${n(all.length)}곳으로 아직 많지 않고, 수도권과 일부 광역시에 몰려 있습니다. 장거리 여행을 떠나기 전에는 출발지와 목적지, 경유지 주변의 충전소 운영 시간을 모두 확인하고, 한 곳이 문을 닫아도 갈 수 있는 두 번째 충전소를 정해 두세요.`,
      "고속도로 휴게소에도 수소충전소가 늘고 있어 장거리 이동이 예전보다 편해졌습니다. 다만 휴게소 충전소도 야간이나 정비 시간에는 운영하지 않을 수 있으니 방문 전에 확인하는 습관이 중요합니다.",
    ],
  });

  blocks.push({
    h2: "충전이 안 될 때 확인할 것",
    table: {
      head: ["상황", "대처"],
      rows: [
        ["도착했는데 영업 중지", "운영사 공지 확인 후 가장 가까운 다른 충전소로 이동"],
        ["대기 차량이 많음", "압력 회복 시간 때문에 한 대당 10분 이상 걸릴 수 있어 대기 시간 고려"],
        ["가득 채워지지 않음", "연속 충전·저온으로 압력이 낮을 때 생김. 잠시 뒤 추가 충전"],
        ["결제가 안 됨", "현장 결제 수단(카드·앱) 확인, 충전원에게 문의"],
      ],
    },
    after: [row.tel ? `${name} 연락처는 ${row.tel}입니다.` : "충전소 연락처가 등록되어 있지 않아, 운영사 누리집이나 지도 서비스에서 전화번호를 확인하세요."],
  });

  blocks.push({
    h2: "수소차를 탄다면 함께 볼 정보",
    ul: [
      "장거리 이동 전에는 목적지와 경로의 수소충전소 운영 여부를 미리 확인하세요.",
      "수소차도 정기적으로 수소 탱크와 배관 점검을 받아야 합니다. 제작사 서비스센터의 점검 주기를 따르세요.",
      "수소차는 자동차 검사 때 고압가스 용기 관련 항목을 추가로 확인합니다.",
    ],
    links: [
      { label: "전기차 충전소 찾기", href: "/charge?type=ev" },
      { label: "차종별 연비 순위", href: "/guide/fuel-economy" },
      { label: "자동차 검사 주기", href: "/guide/car-inspection" },
    ],
  });

  blocks.push({
    h2: "정보 출처",
    p: ["이 페이지는 한국가스안전공사 수소충전소 현황(공공데이터포털)을 정리한 것입니다. 운영 시간과 가격은 수시로 바뀔 수 있으니 운영사에 확인하세요."],
  });

  const faq: Faq[] = [
    { q: `${name} 운영 시간은?`, a: hours ? `${hours}${days ? ` (${days})` : ""}로 등록되어 있습니다.${off ? ` 휴무는 ${off}입니다.` : ""}` : "운영 시간이 등록되어 있지 않습니다." },
    { q: `${name}에서 버스도 충전할 수 있나요?`, a: vehicles ? `충전 가능 차량은 ‘${vehicles}’로 등록되어 있습니다.` : "충전 가능 차량이 등록되어 있지 않습니다. 운영사에 문의하세요." },
    { q: "수소 충전은 얼마나 걸리나요?", a: "승용차 기준 가득 채우는 데 5분 안팎이지만, 앞차 충전 직후에는 대기 시간이 생길 수 있습니다." },
    { q: "수소 가격은 얼마인가요?", a: "충전소마다 다르며 kg당 1만 원 안팎인 경우가 많습니다. 정확한 가격은 운영사에 확인하세요." },
    { q: `${name} 연락처는요?`, a: row.tel ? `등록된 전화번호는 ${row.tel}입니다.` : "전화번호가 등록되어 있지 않습니다. 운영사 누리집에서 확인하세요." },
    { q: "수소충전소가 갑자기 문을 닫는 이유는요?", a: "수소 입고 지연, 설비 점검, 압축기 고장 등으로 임시 중단하는 일이 있습니다. 출발 전 운영 공지를 확인하세요." },
    { q: "직접 충전할 수 있나요?", a: "안전 관리 때문에 충전원이 충전해 주는 곳이 많고, 일부는 교육을 받은 운전자의 셀프 충전을 허용합니다. 현장 안내를 따르세요." },
    { q: "수소차 한 번 충전으로 얼마나 가나요?", a: "승용차 기준 가득 충전하면 차종과 운전 조건에 따라 대략 500~600km를 달릴 수 있습니다." },
    { q: `${sido?.short ?? "이 지역"}에 수소충전소는 몇 곳인가요?`, a: `차곳간 기준 ${n(sameSido.length)}곳입니다.` },
  ];

  return { lead, blocks, faq };
}
