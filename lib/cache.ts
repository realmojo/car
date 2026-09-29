/**
 * 공공데이터 API 응답 캐시.
 *
 * 오피넷 무료 키는 하루 1,500건, 공공데이터포털 개발계정은 하루 1,000건으로
 * 호출 한도가 작다. 방문자마다 원본 API 를 부르면 금방 막히므로
 *   1) 워커 인스턴스 메모리
 *   2) Cloudflare Cache API (같은 데이터센터의 모든 인스턴스가 공유)
 * 두 단계로 가공이 끝난 결과를 보관한다. Node(next dev) 에는 Cache API 가
 * 없으므로 메모리 캐시만 동작한다.
 */

interface MemoEntry {
  expires: number;
  value: unknown;
}

const memo = new Map<string, MemoEntry>();
const inflight = new Map<string, Promise<unknown>>();
const MEMO_LIMIT = 300;

function edgeCache(): Cache | null {
  const storage = (globalThis as { caches?: CacheStorage & { default?: Cache } }).caches;
  return storage?.default ?? null;
}

function cacheRequest(key: string) {
  return new Request(`https://cache.car.internal/${encodeURIComponent(key)}`);
}

export async function cached<T>(
  key: string,
  ttlSec: number,
  loader: () => Promise<T>,
): Promise<T> {
  const now = Date.now();
  const hit = memo.get(key);
  if (hit && hit.expires > now) return hit.value as T;

  const running = inflight.get(key);
  if (running) return running as Promise<T>;

  const task = (async () => {
    const edge = edgeCache();
    if (edge) {
      try {
        const res = await edge.match(cacheRequest(key));
        if (res) {
          const value = (await res.json()) as T;
          remember(key, value, ttlSec);
          return value;
        }
      } catch {
        // 캐시 조회 실패는 무시하고 원본을 부른다
      }
    }

    const value = await loader();
    remember(key, value, ttlSec);

    if (edge) {
      try {
        await edge.put(
          cacheRequest(key),
          new Response(JSON.stringify(value), {
            headers: {
              "content-type": "application/json",
              "cache-control": `public, max-age=${ttlSec}`,
            },
          }),
        );
      } catch {
        // 저장 실패는 다음 요청에서 다시 시도한다
      }
    }
    return value;
  })();

  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}

function remember(key: string, value: unknown, ttlSec: number) {
  if (memo.size >= MEMO_LIMIT) {
    const oldest = memo.keys().next().value;
    if (oldest !== undefined) memo.delete(oldest);
  }
  memo.set(key, { expires: Date.now() + ttlSec * 1000, value });
}

/** 타임아웃이 걸린 fetch. 공공 API 가 가끔 응답 없이 매달린다 */
export async function fetchText(url: string, timeoutMs = 12000): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}
