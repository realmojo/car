/**
 * 동기화 스크립트(scripts/sync-data.ts)와 페이지가 함께 쓰는 데이터 형식.
 * 원본 표준데이터의 열 이름은 기관·버전마다 달라서, 스크립트가 이 공통 형식으로 바꿔 저장한다.
 */

export type DatasetId =
  | "parking"
  | "repair"
  | "inspection"
  | "hydrogen"
  | "rest"
  | "recall"
  | "efficiency";

export interface Row {
  /** 데이터셋 안에서 고유한 짧은 키 (URL 에 쓴다) */
  key: string;
  name: string;
  /** 목록에서 이름 옆에 붙는 짧은 설명 (예: 공영 · 노외) */
  sub?: string;
  address?: string;
  lat?: number;
  lng?: number;
  tel?: string;
  /** 시도 슬러그 */
  sido?: string;
  /** 시군구 대표 코드 (lib/codes.ts SIGUNGU 의 code) */
  gu?: string;
  /** 목록 뱃지 */
  tags: string[];
  /** 필터용 플래그 (예: free, public) */
  flags: string[];
  /** 상세 페이지 표: [항목명, 값] */
  info: Array<[string, string]>;
  /** 정렬용 숫자 (예: 연비) */
  num?: Record<string, number>;
}

/** 시도별로 나눠 저장하는 데이터셋. 나머지는 all 한 파일 */
export const SHARDED: Record<DatasetId, boolean> = {
  parking: true,
  repair: true,
  inspection: true,
  hydrogen: false,
  rest: false,
  recall: false,
  efficiency: false,
};

export interface Shard {
  dataset: DatasetId;
  shard: string;
  syncedAt: string;
  source: string;
  items: Row[];
}

export interface SyncMeta {
  syncedAt: string;
  mock: boolean;
  counts: Partial<Record<DatasetId, number>>;
}
