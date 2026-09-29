# 원본 CSV 두는 곳

공공데이터포털에서 내려받은 CSV 를 아래 이름으로 넣고 **커밋**하세요.
Cloudflare 빌드(`npm run build`)가 이 파일들로 `public/data` 를 만듭니다. 로컬에서는 `npm run data:sync` 로 확인할 수 있습니다.
CSV 가 있으면 API 보다 우선합니다. 인코딩(UTF-8/EUC-KR)은 자동으로 인식합니다.

| 파일 이름 | 데이터 |
|---|---|
| `parking.csv` | 전국주차장정보표준데이터 |
| `repair.csv` | 전국자동차정비업체표준데이터 |
| `inspection.csv` | 전국자동차검사소표준데이터 |
| `hydrogen.csv` | 한국가스안전공사_수소충전소 현황 |
| `rest.csv` | 한국도로공사_휴게시설 현황 (API 사용 시 불필요) |
| `recall.csv` | 한국교통안전공단_자동차결함 리콜현황 |
| `efficiency.csv` | 한국에너지공단_자동차 표시연비 정보 |
