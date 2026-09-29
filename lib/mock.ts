/**
 * MOCK_DATA=1 일 때 실시간 API(환경공단 충전소, ITS 돌발상황) 대신 쓰는 가짜 데이터.
 * 표준데이터(주차장·정비소 등)의 가짜 데이터는 scripts/sync-data.ts --mock 이 만든다.
 */
import type { EvStation } from "./ev";
import type { RoadEvent } from "./its";
import { CHARGER_STATUS, CHARGER_TYPES, SLOW_TYPES } from "./codes";

function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function stamp(minutesAgo = 0) {
  const d = new Date(Date.now() - minutesAgo * 60000 + 9 * 3600000);
  return d.toISOString().replace(/\D/g, "").slice(0, 14);
}

export function evStations(zscode: string): EvStation[] {
  const r = rng(zscode);
  const types = Object.keys(CHARGER_TYPES);
  const stats = ["2", "2", "2", "3", "3", "1", "5", "9"];
  return Array.from({ length: 48 }, (_, i) => {
    const n = 1 + Math.floor(r() * 6);
    return {
      id: `ME${String(174000 + i)}`,
      zscode,
      name: `${["구청", "주민센터", "이마트", "홈플러스", "공영주차장", "아파트", "체육공원"][i % 7]} ${i + 1}`,
      address: `서울특별시 강남구 선릉로 ${10 + i * 7}`,
      location: i % 3 === 0 ? "지하 2층" : "",
      useTime: i % 4 === 0 ? "09:00~18:00" : "24시간 이용가능",
      lat: 37.49 + r() * 0.06,
      lng: 127.02 + r() * 0.08,
      operator: ["환경부", "에버온", "차지비", "SK일렉링크", "대영채비"][i % 5],
      operatorTel: "1661-9408",
      parkingFree: r() > 0.5,
      limited: i % 6 === 0,
      limitDetail: i % 6 === 0 ? "입주민 외 이용 제한" : "",
      note: "",
      chargers: Array.from({ length: n }, (_, j) => {
        const type = types[Math.floor(r() * types.length)];
        const stat = stats[Math.floor(r() * stats.length)];
        const fast = !SLOW_TYPES.has(type);
        return {
          id: String(j + 1).padStart(2, "0"),
          type,
          typeName: CHARGER_TYPES[type],
          fast,
          output: fast ? [50, 100, 200][Math.floor(r() * 3)] : 7,
          stat,
          statName: CHARGER_STATUS[stat].name,
          state: CHARGER_STATUS[stat].state,
          statUpdDt: stamp(Math.floor(r() * 60)),
        };
      }),
    };
  });
}

export function roadEvents(): RoadEvent[] {
  const base = [
    ["고속도로", "교통사고", "추돌사고", "경부고속도로", "1", "서울방향", "1차로", "양재IC 부근 추돌사고 처리 중"],
    ["고속도로", "공사", "도로보수", "영동고속도로", "50", "강릉방향", "2차로", "용인IC~양지IC 포장 보수 공사"],
    ["국도", "기상", "안개", "국도 44호선", "44", "양양방향", "", "한계령 구간 짙은 안개, 서행 운전"],
    ["고속도로", "기타돌발", "낙하물", "서해안고속도로", "15", "목포방향", "3차로", "화성휴게소 부근 낙하물 수거 중"],
    ["국도", "공사", "차로통제", "국도 3호선", "3", "상행", "1차로", "의정부 구간 차로 통제"],
    ["고속도로", "교통사고", "차량고장", "중부고속도로", "35", "통영방향", "갓길", "고장 차량 조치 중"],
  ];
  return base.map(([roadType, eventType, detailType, roadName, roadNo, direction, lanes, message], i) => ({
    id: `mock-${i}`,
    roadType,
    eventType,
    detailType,
    roadName,
    roadNo,
    direction,
    lanesBlocked: lanes,
    message,
    startDate: stamp(i * 17 + 3),
    endDate: "",
    lat: 37.2 + i * 0.1,
    lng: 127.0 + i * 0.12,
  }));
}
