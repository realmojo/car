/** 빈 값을 뺀 쿼리스트링 URL */
export function withQuery(path: string, params: Record<string, string | number | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "" && !(k === "page" && Number(v) <= 1)) qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

/** Next searchParams 값 하나를 문자열로 */
export function one(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** Next searchParams → URLSearchParams (옛 주소 리다이렉트용) */
export function toParams(sp: Record<string, string | string[] | undefined>) {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (v !== undefined) out.set(k, one(v));
  return out;
}

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export type Section = "parking" | "repair" | "charge";

/**
 * 지역 목록 주소: /<카테고리>/<종류>/<시도>/<시군구코드> (lib/regions.ts 설명 참고).
 * 쿼리(q·page 등)는 빈 값을 빼고 붙인다. middleware 에서도 쓰므로 이 파일은 가볍게 둔다.
 */
export function listPath(
  section: Section,
  kind: string,
  sido?: string,
  gu?: string,
  query: Record<string, string | number | undefined | null> = {},
) {
  const path = [`/${section}/${kind}`, sido, sido && gu].filter(Boolean).join("/");
  return withQuery(path, query);
}
