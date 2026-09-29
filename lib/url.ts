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

export type SearchParams = Promise<Record<string, string | string[] | undefined>>;
