export class ApiKeyMissingError extends Error {
  constructor(what: string) {
    super(`${what} API 키가 설정되지 않았습니다.`);
    this.name = "ApiKeyMissingError";
  }
}

/** 화면에 보여줄 오류 문구 */
export function errorMessage(e: unknown): string {
  if (e instanceof ApiKeyMissingError) return e.message;
  if (e instanceof Error) return e.message || "데이터를 불러오지 못했습니다.";
  return "데이터를 불러오지 못했습니다.";
}

/** 실패해도 페이지 전체가 죽지 않도록 결과와 오류를 함께 돌려준다 */
export async function attempt<T>(p: Promise<T>): Promise<{ data: T | null; error: string | null }> {
  try {
    return { data: await p, error: null };
  } catch (e) {
    console.error(e);
    return { data: null, error: errorMessage(e) };
  }
}
