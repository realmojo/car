/**
 * 발급받은 인증키로 각 API 를 한 번씩 호출해 응답 상태와 필드 이름을 출력한다.
 *   node --no-warnings scripts/check-apis.ts
 * 필드 이름이 코드의 기대값과 다르면 출력 결과를 보고 매퍼를 고친다.
 */
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

async function loadEnv() {
  for (const f of [".dev.vars", ".env"]) {
    const file = path.join(ROOT, f);
    if (!existsSync(file)) continue;
    for (const line of (await readFile(file, "utf8")).split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
      if (m && !process.env[m[1]] && m[2]) process.env[m[1]] = m[2];
    }
  }
}

function dataKey() {
  const k = process.env.DATA_GO_KR_SERVICE_KEY ?? "";
  return k.includes("%") ? k : encodeURIComponent(k);
}

function firstArray(json: unknown): Record<string, unknown>[] {
  if (Array.isArray(json)) return json as Record<string, unknown>[];
  if (json && typeof json === "object") {
    for (const k of ["response", "body", "items", "item", "data", "list"]) {
      const v = (json as Record<string, unknown>)[k];
      if (v !== undefined) {
        const a = firstArray(v);
        if (a.length) return a;
      }
    }
  }
  return [];
}

async function check(name: string, url: string) {
  const shown = url.replace(/(serviceKey|apiKey|key)=[^&]+/g, "$1=***");
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
    const text = await res.text();
    let rows: Record<string, unknown>[] = [];
    try {
      rows = firstArray(JSON.parse(text));
    } catch {
      console.log(`✗ ${name} (${res.status}) JSON 아님: ${text.slice(0, 200).replace(/\s+/g, " ")}`);
      return;
    }
    if (!rows.length) {
      console.log(`△ ${name} (${res.status}) 결과 0건: ${text.slice(0, 300).replace(/\s+/g, " ")}`);
      return;
    }
    console.log(`✓ ${name} (${res.status}) ${rows.length}건`);
    console.log(`   필드: ${Object.keys(rows[0]).join(", ")}`);
    console.log(`   예시: ${JSON.stringify(rows[0]).slice(0, 300)}`);
  } catch (e) {
    console.log(`✗ ${name} 요청 실패: ${e instanceof Error ? e.message : e}  ${shown}`);
  }
}

await loadEnv();
const box = "minX=124&maxX=132&minY=33&maxY=39";
const its = process.env.ITS_API_KEY;
const ex = process.env.EX_API_KEY;

if (process.env.DATA_GO_KR_SERVICE_KEY) {
  await check(
    "환경공단 전기차 충전소 (강남구)",
    `https://apis.data.go.kr/B552584/EvCharger/getChargerInfo?serviceKey=${dataKey()}&pageNo=1&numOfRows=5&zcode=11&zscode=11680&dataType=JSON`,
  );
  await check(
    "전국주차장정보표준데이터",
    `https://api.data.go.kr/openapi/tn_pubr_prkplce_info_api?serviceKey=${dataKey()}&pageNo=1&numOfRows=5&type=json`,
  );
} else console.log("- DATA_GO_KR_SERVICE_KEY 없음");

if (its) {
  await check("ITS 돌발상황", `https://openapi.its.go.kr:9443/eventInfo?apiKey=${its}&type=all&eventType=all&${box}&getType=json`);
  await check("ITS CCTV 고속도로 (HTTPS)", `https://openapi.its.go.kr:9443/cctvInfo?apiKey=${its}&type=ex&cctvType=4&${box}&getType=json`);
  await check("ITS CCTV 국도 (HTTPS)", `https://openapi.its.go.kr:9443/cctvInfo?apiKey=${its}&type=its&cctvType=4&${box}&getType=json`);
  for (const [name, env] of [["ITS 재난상황", "ITS_DISASTER_URL"], ["ITS 주의운전구간", "ITS_CAUTION_URL"]]) {
    const u = process.env[env];
    if (u) await check(name, `${u}${u.includes("?") ? "&" : "?"}apiKey=${its}&type=all&${box}&getType=json`);
    else console.log(`- ${name}: ${env} 미설정 (선택)`);
  }
} else console.log("- ITS_API_KEY 없음");

if (ex) {
  await check("도로공사 휴게소", `https://data.ex.co.kr/openapi/restinfo/hiwaySvarInfoList?key=${ex}&type=json&numOfRows=5&pageNo=1`);
} else console.log("- EX_API_KEY 없음");
