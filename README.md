# 김군카 (car.kimgoon.kr)

한국석유공사 **오피넷** 유가정보 API와 **한국환경공단 전기자동차 충전소 정보** API(공공데이터포털)로
오늘의 기름값, 최저가 주유소, 전기차 충전소 정보를 보여 주는 사이트입니다.
UI 는 keywordegg.com 의 콘텐츠 스킨(다크 셸 + 아이보리 카드, 올리브 포인트 컬러, Pretendard)을 그대로 따릅니다.

기술 스택도 keywordegg 와 같습니다: Next.js 16 (App Router) + Tailwind 4 + OpenNext Cloudflare Workers.

## 페이지

| 경로 | 내용 | 데이터 |
|---|---|---|
| `/` | 전국 평균 유가 5종, 7일 추이 차트, 시도별 평균가, 서비스 소개·FAQ | 오피넷 |
| `/fuel` | 유가 정보, 전국 최저가 TOP 10(유종 선택), 시도별 평균가 | 오피넷 |
| `/fuel/[sido]` | 시도 최저가 주유소 20곳, 시군구별 평균가 | 오피넷 |
| `/fuel/[sido]/[sigun]` | 시군구 최저가 주유소 20곳 | 오피넷 |
| `/fuel/station/[id]` | 주유소 상세(유종별 가격, 부가서비스, 길찾기) | 오피넷 |
| `/fuel/nearby` | 내 위치 반경 1/3/5km 주유소 가격순·거리순 | 오피넷 (`/api/fuel/around`) |
| `/ev`, `/ev/[sido]` | 지역 선택, 충전 규격 안내 | 정적 |
| `/ev/[sido]/[sigungu]` | 시군구 충전소 목록, 충전 가능 대수, 급속/완속·무료주차 필터 | 환경공단 |
| `/calculator` | 유류비·전기차 충전비 계산기 (오늘 평균 유가 자동 입력) | 오피넷 |

## 환경변수

`.dev.vars.example` 를 `.dev.vars` 로 복사해 채웁니다. 배포 환경은 Cloudflare 대시보드
(Workers & Pages > car > Settings > Variables and Secrets)에 설정합니다.

| 변수 | 설명 |
|---|---|
| `OPINET_API_KEY` | [오피넷 무료 API](https://www.opinet.co.kr/user/custapi/openApiInfo.do) 인증키 |
| `DATA_GO_KR_SERVICE_KEY` | [공공데이터포털 전기자동차 충전소 정보](https://www.data.go.kr/data/15076352/openapi.do) 일반 인증키 (Decoding/Encoding 모두 가능) |
| `NEXT_PUBLIC_BASE_URL` | 사이트 주소 (기본 `https://car.kimgoon.kr`) |
| `MOCK_DATA` | `1` 이면 API 대신 가짜 데이터로 화면을 띄웁니다 (개발용, 운영에서는 비워 두세요) |

## 실행

```bash
npm install
MOCK_DATA=1 npm run dev   # 키 없이 화면 확인
npm run dev               # .dev.vars 의 실제 키 사용
npm run cf:deploy         # Cloudflare 배포
```

## 호출 한도와 캐시

오피넷 무료 키는 하루 1,500건, 공공데이터포털 개발계정은 하루 1,000건입니다.
`lib/cache.ts` 가 가공된 응답을 워커 메모리 + Cloudflare Cache API 에 보관합니다.

- 평균 유가·시도/시군구 평균: 1시간
- 최저가 주유소·주유소 상세: 30분
- 주변 주유소: 15분 (좌표를 100m 격자로 묶어 공유)
- 전기차 충전소: 10분

트래픽이 늘면 공공데이터포털에서 운영계정(활용사례 등록)으로 한도를 늘리세요.

## 참고

- 오피넷 좌표(KATEC)는 `proj4` 로 WGS84 와 서로 변환합니다 (`lib/geo.ts`).
- 환경공단 API 는 법정동 코드(zscode)로 조회합니다. 구가 있는 시(수원·성남 등)는 시·구 코드를,
  특별자치도(강원 51/42, 전북 52/45)는 신·구 코드를 모두 조회해 합칩니다 (`lib/codes.ts`).
  2026년 인천 행정구역 개편, 화성시 구 신설 등 새 코드는 아직 반영되어 있지 않습니다.
