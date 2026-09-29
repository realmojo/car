# 차곳간 (car.keywordegg.com)

충전소, 주차장, 정비소, 도로 상황을 **공공데이터**로 보여 주는 자동차 생활 정보 사이트입니다.
UI 는 keywordegg.com 의 콘텐츠 스킨(다크 셸 + 아이보리 카드, 올리브 포인트, Pretendard)을 따르고,
기술 스택도 같습니다: Next.js 16 (App Router) + Tailwind 4 + OpenNext Cloudflare Workers.

> 오피넷(한국석유공사) 데이터는 저작권정책상 영리 이용(애드센스)에 사전 허락이 필요해 사용하지 않습니다.

## 페이지 구조 (1depth 카테고리 / 2depth 상세)

| 1depth | 하위 분류 (쿼리) | 2depth 상세 | 데이터 |
|---|---|---|---|
| `/charge` | `?type=ev` 전기차 · `?type=h2` 수소 | `/charge/ev-<zscode>-<statId>`, `/charge/h2-<key>` | 환경공단 API (실시간), 가스안전공사 (DB) |
| `/parking` | `?f=public` 공영 · `?f=free` 무료 | `/parking/<sido>-<key>` | 전국주차장정보표준데이터 (DB) |
| `/repair` | `?type=shop` 정비소 · `inspection` 검사소 · `recall` 리콜 | `/repair/shop-…`, `/repair/insp-…`, `/repair/recall-<key>` | 정비업체·검사소 표준데이터, 리콜현황 (DB) |
| `/road` | `?type=event` 돌발상황 · `cctv` CCTV · `caution` 주의운전구간 · `rest` 휴게소 | `/road/cctv-<ex\|its>-<id>`, `/road/rest-<key>` | ITS 돌발상황·CCTV·재난·주의운전구간 (실시간), 도로공사 휴게시설 (DB) |
| `/guide` | - | `/guide/<slug>` (연비 순위, 전기차 주행거리, 계산기, 충전 규격, 검사 주기) | 에너지공단 표시연비 (DB) |
| `/search` | `?q=&sido=` | - | DB 데이터 전체 |

지역은 모든 목록에서 `?sido=<슬러그>&gu=<시군구코드>&q=<검색어>&page=` 로 거릅니다.

## 데이터

**실시간 API** (요청 시 호출, `lib/cache.ts` 로 5~10분 캐시)
- 한국환경공단 전기자동차 충전소 정보 → `DATA_GO_KR_SERVICE_KEY`
- 국가교통정보센터 돌발상황정보, CCTV 화상자료 → `ITS_API_KEY` (ITS 사이트에서 서비스별 이용 신청 필요, 서비스당 하루 1,000건)
- 선택: 재난상황정보(`ITS_DISASTER_URL`), 주의운전구간(`ITS_CAUTION_URL`) — ITS 오픈데이터 상세 페이지의 요청 주소를 넣으면 켜집니다

**DB 데이터** (월 단위로 바뀌는 목록형 데이터) — Supabase `pflow-kr` 프로젝트의 `car_*` 테이블.
공개 읽기 전용(RLS)이라 사이트는 publishable 키로 PostgREST 를 읽습니다 (`lib/supabase.ts`, `lib/places.ts`, `lib/datasets.ts`).
배포 파일에는 데이터가 들어가지 않습니다.

| 테이블 | 원본 | 적재 방식 |
|---|---|---|
| `car_parking` | 전국주차장정보표준데이터 | 포털 전체 다운로드 JSON, 10,000건씩 |
| `car_repair` | 전국자동차정비업체표준데이터 | 포털 전체 다운로드 JSON, 10,000건씩 |
| `car_inspection` | 전국자동차검사소표준데이터 | 포털 전체 다운로드 JSON, 10,000건씩 |
| `car_rest` | 한국도로공사 휴게시설 (주유소 행 제외) | data.ex.co.kr API 한 번 |
| `car_hydrogen` | 한국가스안전공사_수소충전소 현황 | 공공데이터포털 파일 다운로드 |
| `car_recall` | 한국교통안전공단_자동차결함 리콜현황 | 공공데이터포털 파일 다운로드 |
| `car_efficiency` | 한국에너지공단_자동차 표시연비 | 공공데이터포털 파일 다운로드 |

- 적재: Edge Function `car-sync` (`supabase/functions/car-sync`). 변환 규칙은 `lib/mappers.ts` 를 함께 씁니다
- 인증키: Supabase Vault `car_ex_key` (휴게소) (Edge Function 이 service_role 전용 `car_sync_config()` 로 읽음)
- 수동 실행: `select public.car_sync_dataset('parking');` (나머지 이름도 같음)
- 자동 갱신: pg_cron 매월 1일 새벽(한국시간) 전체 재적재, 15일에 45일 넘게 갱신 안 된 행 정리
- 기록: `car_sync_log` 테이블 (건수·오류)
- 환경변수(선택): `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` — 기본값이 코드에 들어 있음

주차장·정비업체·검사소는 표준데이터 상세 페이지의 다운로드 버튼이 쓰는 JSON
(`/download/columList.json` → `/download/standard.json`)을 그대로 받으므로 인증키·활용신청이 필요 없습니다.

`npm run data:mock` 은 로컬 개발용 가짜 데이터(`public/data`, git 제외)를 만들고, `MOCK_DATA=1` 일 때만 이 파일을 읽습니다.

## 환경변수

`.dev.vars.example` 를 `.dev.vars` 로 복사해 채웁니다. 배포 환경은 Cloudflare 대시보드
(Workers & Pages > car > Settings > Variables and Secrets)에 설정합니다.

## 실행

```bash
npm install
npm run data:mock          # 가짜 데이터로 public/data 생성
MOCK_DATA=1 npm run dev    # 실시간 API 도 가짜 데이터로

npm run dev                # 실제 데이터 (Supabase)
```

## Cloudflare 배포 (Git 연동 Workers Builds)

| 항목 | 값 |
|---|---|
| 빌드 명령 | `npx opennextjs-cloudflare build` |
| 배포 명령 | `npx opennextjs-cloudflare deploy` |
| 버전 명령 | `npx wrangler versions upload` |
| 루트 디렉터리 | `/` |
| 프로덕션 브랜치 | `main` |

`opennextjs-cloudflare build` 는 `package.json` 의 `build`(`next build`)만 실행합니다. 데이터는 빌드에 넣지 않고 DB 에서 읽습니다.

실행 시 환경변수 (Workers > car > Settings > Variables and Secrets):
`DATA_GO_KR_SERVICE_KEY`, `ITS_API_KEY` (+ 선택 `ITS_DISASTER_URL`, `ITS_CAUTION_URL`).

Node 버전은 `.node-version` (22) 으로 고정했습니다. `wrangler.jsonc` 의 `name`("car")은 대시보드의 Worker 이름과 같아야 합니다.

## 상세 페이지 본문과 광고

모든 2depth 상세 페이지(주차장·정비소·검사소·리콜·전기차/수소 충전소·휴게소·CCTV·가이드)는 데이터로 만든 5,000자 이상 본문을 싣습니다.

- 본문 생성: `lib/content/*.ts` — 요금 계산 예시, 같은 시군구 통계와 주변 시설(`placeContext`), 이용 안내, 자주 묻는 질문
- 렌더링: `components/article/ArticleBody.tsx` (요약·본문·FAQ)
- 구조화 데이터: `lib/content/jsonld.ts` — WebPage, ParkingFacility / AutoRepair / AutomotiveBusiness / Place, Article, FAQPage (+ Crumbs 의 BreadcrumbList)
- 광고: `components/ads/AdSlot.tsx`, 게시자·광고 단위 ID 는 `lib/ads.ts`. 상세 페이지마다 상단·제목 아래·h2 아래(2곳)

## 검색엔진용 파일

| 경로 | 내용 |
|---|---|
| `/robots.txt` | `app/robots.txt/route.ts`. 네이버(Yeti)·다음(Daumoa) 규칙 포함. 다음 소유확인 값은 `DAUM_VERIFICATION` 에 넣는다 |
| `/sitemap.xml` | 모든 주소를 담은 단일 사이트맵 (`lib/sitemap.ts`): 홈·카테고리·시도별 목록·가이드 + 수소충전소·휴게소·리콜·주차장·정비소·검사소 상세, 최대 50,000개 |
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
