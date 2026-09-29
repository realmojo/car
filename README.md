# 차곳간 (car.kimgoon.kr)

충전소, 주차장, 정비소, 도로 상황을 **공공데이터**로 보여 주는 자동차 생활 정보 사이트입니다.
UI 는 keywordegg.com 의 콘텐츠 스킨(다크 셸 + 아이보리 카드, 올리브 포인트, Pretendard)을 따르고,
기술 스택도 같습니다: Next.js 16 (App Router) + Tailwind 4 + OpenNext Cloudflare Workers.

> 오피넷(한국석유공사) 데이터는 저작권정책상 영리 이용(애드센스)에 사전 허락이 필요해 사용하지 않습니다.

## 페이지 구조 (1depth 카테고리 / 2depth 상세)

| 1depth | 하위 분류 (쿼리) | 2depth 상세 | 데이터 |
|---|---|---|---|
| `/charge` | `?type=ev` 전기차 · `?type=h2` 수소 | `/charge/ev-<zscode>-<statId>`, `/charge/h2-<key>` | 환경공단 API (실시간), 가스안전공사 (동기화) |
| `/parking` | `?f=public` 공영 · `?f=free` 무료 | `/parking/<sido>-<key>` | 전국주차장정보표준데이터 (동기화) |
| `/repair` | `?type=shop` 정비소 · `inspection` 검사소 · `recall` 리콜 | `/repair/shop-…`, `/repair/insp-…`, `/repair/recall-<key>` | 정비업체·검사소 표준데이터, 리콜현황 (동기화) |
| `/road` | `?type=event` 돌발상황 · `cctv` CCTV · `caution` 주의운전구간 · `rest` 휴게소 | `/road/cctv-<ex\|its>-<id>`, `/road/rest-<key>` | ITS 돌발상황·CCTV·재난·주의운전구간 (실시간), 도로공사 휴게시설 (동기화) |
| `/guide` | - | `/guide/<slug>` (연비 순위, 전기차 주행거리, 계산기, 충전 규격, 검사 주기) | 에너지공단 표시연비 (동기화) |
| `/search` | `?q=&sido=` | - | 동기화 데이터 전체 |

지역은 모든 목록에서 `?sido=<슬러그>&gu=<시군구코드>&q=<검색어>&page=` 로 거릅니다.

## Supabase (주차장·정비업체·검사소)

주차장·정비업체·검사소는 행 수가 많아 Supabase `pflow-kr` 프로젝트의 `car_parking`, `car_repair`, `car_inspection`
테이블에 둡니다. 공개 읽기 전용(RLS)이라 사이트는 publishable 키로 읽습니다 (`lib/places.ts`).

- 적재: Edge Function `car-sync` (`supabase/functions/car-sync`)가 공공데이터 표준데이터 API 를 1,000건씩 받아 upsert
- 인증키: Supabase Vault `car_data_go_kr_key` (Edge Function 이 service_role 전용 `car_sync_config()` 로 읽음)
- 실행: `select public.car_sync_dataset('parking');` (repair / inspection 동일) — 페이지별로 pg_net 호출
- 자동 갱신: pg_cron 매월 1일 새벽(한국시간) 전체 재적재, 15일에 45일 넘게 갱신 안 된 행 정리
- 기록: `car_sync_log` 테이블 (페이지별 건수·오류)
- 환경변수(선택): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` — 기본값이 코드에 들어 있음

필요한 공공데이터포털 활용신청: 전국주차장정보표준데이터, 전국자동차정비업체표준데이터, 전국자동차검사소표준데이터.

## 데이터 두 종류

**실시간 API** (요청 시 호출, `lib/cache.ts` 로 5~10분 캐시)
- 한국환경공단 전기자동차 충전소 정보 → `DATA_GO_KR_SERVICE_KEY`
- 국가교통정보센터 돌발상황정보, CCTV 화상자료 → `ITS_API_KEY` (ITS 사이트에서 서비스별 이용 신청 필요, 서비스당 하루 1,000건)
- 선택: 재난상황정보(`ITS_DISASTER_URL`), 주의운전구간(`ITS_CAUTION_URL`) — ITS 오픈데이터 상세 페이지의 요청 주소를 넣으면 켜집니다

**동기화 데이터** (월 단위로 바뀌는 목록형 데이터)
`npm run data:sync` 가 원본을 받아 공통 형식으로 바꾼 뒤 `public/data/<데이터셋>/<시도>.json` 으로 나눠 저장합니다.
Workers 의 서브요청 제한과 일일 호출 한도를 피하고, 페이지는 정적 자산만 읽어 빠릅니다.

| 데이터셋 | 원본 | 가져오는 방법 |
|---|---|---|
| parking | 전국주차장정보표준데이터 | API 기본 주소 내장, 또는 `data/raw/parking.csv` |
| repair | 전국자동차정비업체표준데이터 | `data/raw/repair.csv` 또는 `SYNC_URL_REPAIR` |
| inspection | 전국자동차검사소표준데이터 | `data/raw/inspection.csv` 또는 `SYNC_URL_INSPECTION` |
| hydrogen | 한국가스안전공사_수소충전소 현황 | `data/raw/hydrogen.csv` 또는 `SYNC_URL_HYDROGEN` |
| rest | 한국도로공사 휴게시설 | `EX_API_KEY` (data.ex.co.kr) 또는 `data/raw/rest.csv` |
| recall | 한국교통안전공단_자동차결함 리콜현황 | `data/raw/recall.csv` 또는 `SYNC_URL_RECALL` |
| efficiency | 한국에너지공단_자동차 표시연비 정보 | `data/raw/efficiency.csv` 또는 `SYNC_URL_EFFICIENCY` |

CSV 는 공공데이터포털에서 내려받은 그대로 넣으면 됩니다 (UTF-8/EUC-KR 자동 인식).
열 이름이 바뀌어 변환된 행이 0건이면, 스크립트가 원본의 열 이름을 출력하니 `scripts/sync-data.ts` 의 매퍼 후보에 추가하세요.

## 환경변수

`.dev.vars.example` 를 `.dev.vars` 로 복사해 채웁니다. 배포 환경은 Cloudflare 대시보드
(Workers & Pages > car > Settings > Variables and Secrets)에 설정합니다.

## 실행

```bash
npm install
npm run data:mock          # 가짜 데이터로 public/data 생성
MOCK_DATA=1 npm run dev    # 실시간 API 도 가짜 데이터로

npm run data:sync          # 실제 데이터 동기화 (.dev.vars 의 키 + data/raw/*.csv)
npm run dev
```

## Cloudflare 배포 (Git 연동 Workers Builds)

| 항목 | 값 |
|---|---|
| 빌드 명령 | `npx opennextjs-cloudflare build` |
| 배포 명령 | `npx opennextjs-cloudflare deploy` |
| 버전 명령 | `npx wrangler versions upload` |
| 루트 디렉터리 | `/` |
| 프로덕션 브랜치 | `main` |

`opennextjs-cloudflare build` 는 `package.json` 의 `build` 스크립트를 실행하고, 이 스크립트가
**데이터 동기화(`scripts/sync-data.ts --soft`) → `next build`** 순서로 돕니다.
동기화가 실패해도 빌드는 멈추지 않고, 그 데이터만 "데이터 준비 중"으로 표시됩니다.

환경변수는 두 곳에 넣습니다.

| 위치 (Workers > car > Settings) | 변수 | 용도 |
|---|---|---|
| **Build > 변수 및 비밀** (빌드 시) | `DATA_GO_KR_SERVICE_KEY`, `EX_API_KEY` | 주차장·휴게소 동기화 |
| **Variables and Secrets** (실행 시) | `DATA_GO_KR_SERVICE_KEY`, `ITS_API_KEY` (+ 선택 `ITS_DISASTER_URL`, `ITS_CAUTION_URL`) | 전기차 충전소, 돌발상황, CCTV |

정비소·검사소·수소·리콜·연비처럼 CSV 로만 받는 데이터는 `data/raw/<이름>.csv` 로 **커밋**하면 빌드 때 반영됩니다.
데이터를 갱신하려면 새 CSV 를 커밋하거나 대시보드에서 다시 배포하세요.
Node 버전은 `.node-version` (22) 으로 고정했습니다. `wrangler.jsonc` 의 `name`("car")은 대시보드의 Worker 이름과 같아야 합니다.

## 검색엔진용 파일

| 경로 | 내용 |
|---|---|
| `/robots.txt` | `app/robots.txt/route.ts`. 네이버(Yeti)·다음(Daumoa) 규칙 포함. 다음 소유확인 값은 `DAUM_VERIFICATION` 에 넣는다 |
| `/sitemap.xml` | 사이트맵 인덱스 (`lib/sitemap.ts`) |
| `/sitemaps/pages.xml` | 홈·카테고리·시도별 목록·가이드 |
| `/sitemaps/{parking,repair,inspection}-N.xml` | Supabase 상세 페이지, 5,000개씩 |
| `/sitemaps/{hydrogen,rest,recall}.xml` | 동기화 파일 상세 페이지 |
| `/ads.txt`, `/manifest.webmanifest`, `/og.png` | 애드센스, 웹 앱 매니페스트, 공유 이미지 |

## 키 확인

```bash
npm run check:apis   # .dev.vars 의 키로 각 API 를 한 번씩 호출해 상태와 필드 이름을 출력
```

## 확인이 필요한 부분

이 코드를 만든 환경에서는 공공데이터 API 에 접속할 수 없어 **가짜 데이터로만 검증**했습니다. 실제 키로 처음 돌릴 때 확인하세요.

- 표준데이터 API 주소: 주차장 외에는 포털 상세 페이지의 "요청주소"를 `SYNC_URL_*` 로 넣거나 CSV 를 쓰세요.
- CCTV 는 `cctvType=4`(HTTPS 스트리밍)로 먼저 조회하고, 결과가 없으면 1(HTTP)로 다시 조회합니다. HTTP 영상은 HTTPS 페이지에서 재생되지 않아 새 창 링크로 대신합니다. 영상을 사이트에 직접 띄우는 것이 ITS 이용 조건에 맞는지 확인하세요.
- ITS API 는 9443 포트를 씁니다. Cloudflare Workers 가 이 포트로 나가는 요청을 막으면
  `ITS_API_BASE` 로 443 포트 주소(있다면)를 지정하거나, 이 데이터만 동기화 방식으로 바꿔야 합니다.
- 환경공단 zscode 는 구가 있는 시(수원·성남 등)는 시·구 코드를, 강원(51/42)·전북(52/45)은 신·구 코드를 모두 조회해 합칩니다.
  2026년 인천 행정구역 개편, 화성시 구 신설 코드는 아직 반영되어 있지 않습니다.
- 광고를 붙이기 전에 각 데이터 상세 페이지의 **이용허락범위**가 "제한 없음"인지 확인하세요.
