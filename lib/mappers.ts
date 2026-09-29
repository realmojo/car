/**
 * 공공데이터 원본 행 → 앱 공통 Row 변환.
 * scripts/sync-data.ts(로컬·빌드 동기화)와 supabase/functions/car-sync(Supabase 적재)가 함께 쓴다.
 * Deno 에서도 돌아가도록 상대 경로 import 에 .ts 확장자를 붙인다.
 */
import { findSidoByAddress, findSigunguByAddress } from "./codes.ts";
import type { DatasetId, Row } from "./dataset-types.ts";

export type Raw = Record<string, unknown>;

/* ------------------------------------------------------------ 공통 도구 */

function pick(row: Raw, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "" && String(v).trim() !== "null") {
      return String(v).trim();
    }
  }
  return "";
}

function num(v: string): number | undefined {
  const n = Number(v.replace(/[,\s]/g, ""));
  return v && Number.isFinite(n) ? n : undefined;
}

/** 위도·경도가 한반도 범위일 때만 쓴다 */
function coords(row: Raw, latKeys: string[], lngKeys: string[]) {
  const lat = num(pick(row, latKeys));
  const lng = num(pick(row, lngKeys));
  if (lat && lng && lat > 32 && lat < 39.5 && lng > 124 && lng < 132) return { lat, lng };
  return {};
}

/** "0900" / "09:00" → "09:00" */
function hhmm(v: string) {
  const d = v.replace(/\D/g, "");
  if (d.length === 3 || d.length === 4) return `${d.padStart(4, "0").slice(0, 2)}:${d.padStart(4, "0").slice(2)}`;
  return v;
}

function range(a: string, b: string) {
  if (!a && !b) return "";
  if (hhmm(a) === "00:00" && (hhmm(b) === "23:59" || hhmm(b) === "24:00")) return "24시간";
  return `${hhmm(a)} ~ ${hhmm(b)}`;
}

function won(v: string) {
  const n = num(v);
  return n === undefined ? v : `${n.toLocaleString("ko-KR")}원`;
}

function fnv(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

function info(pairs: Array<[string, string | undefined]>): Array<[string, string]> {
  return pairs.filter((p): p is [string, string] => Boolean(p[1]));
}

function locate(address: string) {
  const sido = findSidoByAddress(address);
  const gu = sido ? findSigunguByAddress(sido, address) : undefined;
  return { sido: sido?.slug, gu: gu?.code };
}

/* ------------------------------------------------------------ 매퍼 */

const ADDR = ["rdnmadr", "소재지도로명주소", "도로명주소", "주소", "소재지", "svarAddr"];
const JIBUN = ["lnmadr", "소재지지번주소", "지번주소"];
const LAT = ["latitude", "위도", "lat", "yValue"];
const LNG = ["longitude", "경도", "lng", "lon", "xValue"];
const TEL = ["phoneNumber", "전화번호", "대표전화", "연락처", "rprsTelNo"];

export type Mapper = (row: Raw) => Row | null;

export const MAPPERS: Record<DatasetId, Mapper> = {
  parking(r) {
    const name = pick(r, ["prkplceNm", "주차장명"]);
    const address = pick(r, ADDR) || pick(r, JIBUN);
    if (!name || !address) return null;
    const se = pick(r, ["prkplceSe", "주차장구분"]);
    const type = pick(r, ["prkplceType", "주차장유형"]);
    const fee = pick(r, ["parkingchrgeInfo", "요금정보"]);
    const cap = pick(r, ["prkcmprt", "주차구획수"]);
    const basic = [pick(r, ["basicTime", "주차기본시간"]), pick(r, ["basicCharge", "주차기본요금"])];
    const add = [pick(r, ["addUnitTime", "추가단위시간"]), pick(r, ["addUnitCharge", "추가단위요금"])];
    const flags: string[] = [];
    if (se.includes("공영")) flags.push("public");
    if (fee.includes("무료")) flags.push("free");
    if (pick(r, ["pwdbsPpkZoneYn", "장애인전용주차구역보유여부"]) === "Y") flags.push("disabled");
    const weekday = range(
      pick(r, ["weekdayOperOpenHhmm", "평일운영시작시각"]),
      pick(r, ["weekdayOperColseHhmm", "weekdayOperCloseHhmm", "평일운영종료시각"]),
    );
    return {
      key: fnv(pick(r, ["prkplceNo", "주차장관리번호"]) || name + address),
      name,
      sub: [se, type].filter(Boolean).join(" · "),
      address,
      tel: pick(r, TEL),
      ...coords(r, LAT, LNG),
      ...locate(address),
      tags: [fee, cap && `${cap}면`, weekday === "24시간" ? "24시간" : ""].filter(Boolean),
      flags,
      num: cap ? { capacity: Number(cap) || 0 } : undefined,
      info: info([
        ["구분", [se, type].filter(Boolean).join(" · ")],
        ["도로명 주소", address],
        ["지번 주소", pick(r, JIBUN)],
        ["주차면", cap && `${cap}면`],
        ["요금", fee],
        ["기본 요금", basic[1] && num(basic[1]) === 0 ? "무료" : basic[0] && basic[1] ? `${basic[0]}분 ${won(basic[1])}` : ""],
        ["추가 요금", add[0] && add[1] ? `${add[0]}분마다 ${won(add[1])}` : ""],
        ["1일 주차권", pick(r, ["dayCmmtkt", "1일주차권요금"]) && won(pick(r, ["dayCmmtkt", "1일주차권요금"]))],
        ["월 정기권", pick(r, ["monthCmmtkt", "월정기권요금"]) && won(pick(r, ["monthCmmtkt", "월정기권요금"]))],
        ["운영 요일", pick(r, ["operDay", "운영요일"])],
        ["평일", weekday],
        ["토요일", range(pick(r, ["satOperOperOpenHhmm", "satOperOpenHhmm", "토요일운영시작시각"]), pick(r, ["satOperCloseHhmm", "토요일운영종료시각"]))],
        ["공휴일", range(pick(r, ["holidayOperOpenHhmm", "공휴일운영시작시각"]), pick(r, ["holidayCloseOpenHhmm", "holidayOperCloseHhmm", "공휴일운영종료시각"]))],
        ["결제 방법", pick(r, ["metpay", "결제방법"])],
        ["특기사항", pick(r, ["spcmnt", "특기사항"])],
        ["관리기관", pick(r, ["institutionNm", "관리기관명"])],
        ["전화", pick(r, TEL)],
        ["기준일", pick(r, ["referenceDate", "데이터기준일자"])],
      ]),
    };
  },

  repair(r) {
    const name = pick(r, ["자동차정비업체명", "정비업체명", "업체명", "사업장명", "mntnceEntrpsNm", "bplcNm", "entrpsNm"]);
    const address = pick(r, ADDR) || pick(r, JIBUN);
    if (!name || !address) return null;
    const status = pick(r, ["영업상태", "영업상태명", "bsnSttus"]);
    if (/폐업|취소|말소/.test(status)) return null;
    const kind = pick(r, ["자동차정비업체종류", "정비업체종류", "업종", "업태", "mntnceEntrpsSe"]);
    const flags: string[] = [];
    if (kind.includes("종합")) flags.push("general");
    if (kind.includes("소형")) flags.push("small");
    if (kind.includes("부분") || kind.includes("전문")) flags.push("partial");
    if (kind.includes("원동기")) flags.push("motor");
    const hours = range(pick(r, ["운영시작시각", "operOpenHm"]), pick(r, ["운영종료시각", "operCloseHm"]));
    return {
      key: fnv(name + address),
      name,
      sub: kind,
      address,
      tel: pick(r, TEL),
      ...coords(r, LAT, LNG),
      ...locate(address),
      tags: [kind, status && status !== "영업" && status !== "정상" ? status : ""].filter(Boolean),
      flags,
      info: info([
        ["업체 종류", kind],
        ["도로명 주소", address],
        ["지번 주소", pick(r, JIBUN)],
        ["영업 상태", status],
        ["운영 시간", hours],
        ["전화", pick(r, TEL)],
        ["사업 등록일", pick(r, ["사업등록일자", "등록일자"])],
        ["관리기관", pick(r, ["관리기관명", "institutionNm"])],
        ["기준일", pick(r, ["데이터기준일자", "referenceDate"])],
      ]),
    };
  },

  inspection(r) {
    const name = pick(r, ["자동차검사소명", "검사소명", "inspofcNm"]);
    const address = pick(r, ADDR) || pick(r, JIBUN);
    if (!name || !address) return null;
    const kind = pick(r, ["자동차검사소구분", "검사소구분", "검사소유형", "지정구분", "inspofcSe"]);
    const tel = pick(r, ["검사소전화번호", ...TEL]);
    const hours =
      pick(r, ["운영시간", "평일운영시간"]) ||
      range(pick(r, ["평일운영시작시각", "운영시작시각"]), pick(r, ["평일운영종료시각", "운영종료시각"]));
    const flags: string[] = [];
    if (kind.includes("공단") || name.includes("교통안전공단")) flags.push("ts");
    else flags.push("private");
    return {
      key: fnv(name + address),
      name,
      sub: kind,
      address,
      tel,
      ...coords(r, LAT, LNG),
      ...locate(address),
      tags: [kind, flags.includes("ts") ? "공단 직영" : "민간 지정"].filter((t, i, a) => t && a.indexOf(t) === i),
      flags,
      info: info([
        ["구분", kind],
        ["도로명 주소", address],
        ["지번 주소", pick(r, JIBUN)],
        ["운영 시간", hours],
        ["검사 종류", pick(r, ["검사종류", "검사가능종류", "검사업무"])],
        ["검사 차종", pick(r, ["검사가능차종", "검사차종"])],
        ["전화", tel],
        ["관리기관", pick(r, ["관리기관명", "institutionNm"])],
        ["기준일", pick(r, ["데이터기준일자", "referenceDate"])],
      ]),
    };
  },

  hydrogen(r) {
    const name = pick(r, ["충전소명", "충전소", "stationNm"]);
    const address = [pick(r, ["주소", "소재지", "도로명주소", "소재지도로명주소"]), pick(r, ["상세주소"])]
      .filter(Boolean)
      .join(" ");
    if (!name || !address) return null;
    const supply = pick(r, ["공급방식", "충전방식"]);
    const chargers = pick(r, ["충전기수", "충전기 수", "충전기대수", "충전기 대수", "충전기수량"]);
    const vehicles = pick(r, ["충전가능차량", "충전가능차종", "충전가능차량코드"]);
    const flags: string[] = [];
    if (/버스|대형|상용/.test(vehicles)) flags.push("bus");
    return {
      key: fnv(name + address),
      name,
      sub: supply,
      address,
      tel: pick(r, TEL),
      ...coords(r, LAT, LNG),
      ...locate(address),
      tags: [supply, chargers && `충전기 ${chargers}기`, vehicles].filter(Boolean),
      flags,
      info: info([
        ["공급 방식", supply],
        ["주소", address],
        ["충전기", chargers && `${chargers}기`],
        ["충전 가능 차량", vehicles],
        ["운영 요일", pick(r, ["이용가능요일", "운영요일"])],
        ["운영 시간", pick(r, ["운영시간", "이용시간"])],
        ["휴무", pick(r, ["휴식일정", "휴무일", "휴무"])],
        ["전화", pick(r, TEL)],
        ["운영사", pick(r, ["운영사", "운영기관", "사업자"])],
        ["용도", pick(r, ["용도"])],
        ["구축 연도", pick(r, ["구축연도", "설치연도", "준공연도"])],
        ["기준일", pick(r, ["데이터기준일자", "기준일자"])],
      ]),
    };
  },

  rest(r) {
    const name = pick(r, ["svarNm", "휴게소명", "시설명"]);
    if (!name) return null;
    // 휴게시설 목록에 같은 자리의 주유소·충전소가 따로 들어 있다. 주유 정보는 다루지 않으므로 뺀다
    if (/주유소|LPG|충전소/.test(name) && !/휴게소|쉼터/.test(name)) return null;
    const route = pick(r, ["routeNm", "노선명"]);
    const dir = pick(r, ["gudClssNm", "방향", "상하행구분", "방향구분"]);
    const address = pick(r, ADDR);
    const small = pick(r, ["cocrPrkgTrcn", "소형주차대수", "소형차주차면수"]);
    const large = pick(r, ["fscarPrkgTrcn", "대형주차대수", "대형차주차면수"]);
    const kind = pick(r, ["svarGbNm", "휴게시설구분", "시설구분"]) || (name.includes("졸음쉼터") ? "졸음쉼터" : "휴게소");
    return {
      key: fnv(pick(r, ["svarCd", "휴게소코드"]) || name + route + dir),
      name,
      sub: [route, dir].filter(Boolean).join(" · "),
      address,
      tel: pick(r, TEL),
      ...coords(r, LAT, LNG),
      ...(address ? locate(address) : {}),
      tags: [kind, route, dir].filter(Boolean),
      flags: kind.includes("졸음") ? ["drowsy"] : ["rest"],
      info: info([
        ["구분", kind],
        ["노선", route],
        ["방향", dir],
        ["주소", address],
        ["소형차 주차", small && `${small}면`],
        ["대형차 주차", large && `${large}면`],
        ["장애인 주차", pick(r, ["dspnPrkgTrcn", "장애인주차대수"]) && `${pick(r, ["dspnPrkgTrcn", "장애인주차대수"])}면`],
        ["편의시설", pick(r, ["편의시설", "convenience", "부대시설"])],
        ["전화", pick(r, TEL)],
      ]),
    };
  },

  recall(r) {
    const car = pick(r, ["차명", "차종", "모델명", "carNm"]);
    const maker = pick(r, ["제작자", "제조사", "제작사", "제작사명", "mkrNm"]);
    if (!car) return null;
    const from = pick(r, ["생산기간(부터)", "생산시작일", "생산기간시작"]);
    const to = pick(r, ["생산기간(까지)", "생산종료일", "생산기간종료"]);
    const period = pick(r, ["생산기간"]) || [from, to].filter(Boolean).join(" ~ ");
    const start = pick(r, ["리콜개시일", "시정개시일", "리콜시작일", "리콜개시일자"]);
    const reason = pick(r, ["리콜사유", "결함내용", "리콜내용", "리콜사유및내용"]);
    return {
      key: fnv(maker + car + period + start + reason.slice(0, 40)),
      name: car,
      sub: maker,
      tags: [maker, start && `${start} 개시`].filter(Boolean),
      flags: [],
      num: { date: Number(start.replace(/\D/g, "").slice(0, 8)) || 0 },
      info: info([
        ["제작사", maker],
        ["차명", car],
        ["생산 기간", period],
        ["리콜 개시일", start],
        ["대상 대수", pick(r, ["대상대수", "리콜대수", "대상차량대수"])],
        ["리콜 사유", reason],
        ["시정 방법", pick(r, ["시정방법", "조치방법"])],
      ]),
    };
  },

  efficiency(r) {
    const name = pick(r, ["모델명", "차명", "모델"]);
    if (!name) return null;
    const maker = pick(r, ["업체명", "제조(수입사)", "제조사", "제작사", "제조업체"]);
    const fuel = pick(r, ["연료", "유종", "사용연료", "연료종류"]);
    const type = pick(r, ["차종", "차급", "차량구분"]);
    const shape = pick(r, ["유형"]);
    const combined = num(pick(r, ["복합연비", "복합_연비", "복합", "복합에너지소비효율"]));
    const city = num(pick(r, ["도심연비", "도심_연비", "도심"]));
    const highway = num(pick(r, ["고속도로연비", "고속도로_연비", "고속도로", "고속"]));
    const rangeKm = num(pick(r, ["1회충전주행거리", "1회충전 주행거리", "주행거리"]));
    const grade = num(pick(r, ["등급", "연비등급", "에너지소비효율등급"]).replace(/\D/g, ""));
    // 연료 열이 없는 파일은 1회 충전 주행거리가 있으면 전기차로 본다
    const ev = fuel ? /전기/.test(fuel) && !/하이브리드/.test(fuel) : Boolean(rangeKm);
    const unit = ev ? "km/kWh" : /수소/.test(fuel) ? "km/kg" : "km/L";
    const flags: string[] = [];
    if (ev) flags.push("ev");
    else if (/하이브리드/.test(fuel)) flags.push("hybrid");
    else if (/수소/.test(fuel)) flags.push("h2");
    else flags.push("ice");
    return {
      key: fnv(maker + name + fuel + pick(r, ["배기량", "출시연도", "연식"]) + (combined ?? "")),
      name,
      sub: maker,
      tags: [fuel || (ev ? "전기" : ""), type, shape, grade ? `${grade}등급` : ""].filter(Boolean),
      flags,
      num: {
        ...(combined ? { combined } : {}),
        ...(rangeKm ? { range: rangeKm } : {}),
        ...(grade ? { grade } : {}),
      },
      info: info([
        ["제조사", maker],
        ["연료", fuel || (ev ? "전기" : "")],
        ["차종", type],
        ["유형", shape],
        ["복합 연비", combined ? `${combined} ${unit}` : ""],
        ["도심 연비", city ? `${city} ${unit}` : ""],
        ["고속도로 연비", highway ? `${highway} ${unit}` : ""],
        ["1회 충전 주행거리", rangeKm ? `${rangeKm} km` : ""],
        ["에너지소비효율 등급", grade ? `${grade}등급` : ""],
        ["CO2 배출량", pick(r, ["CO2", "CO2배출량", "이산화탄소배출량"]) && `${pick(r, ["CO2", "CO2배출량", "이산화탄소배출량"])} g/km`],
        ["배기량", pick(r, ["배기량"]) && `${pick(r, ["배기량"])} cc`],
        ["변속기", pick(r, ["변속기", "변속형식"])],
        ["출시 연도", pick(r, ["출시연도", "연식"])],
      ]),
    };
  },
};

/** 응답 JSON 에서 객체 배열을 찾는다 (body.items / items.item / data / list …) */
export function findArray(json: unknown): Raw[] {
  if (Array.isArray(json)) return json as Raw[];
  if (json && typeof json === "object") {
    for (const key of ["items", "item", "data", "list", "body", "response", "row"]) {
      const v = (json as Raw)[key];
      if (v !== undefined) {
        const found = findArray(v);
        if (found.length) return found;
      }
    }
  }
  return [];
}
