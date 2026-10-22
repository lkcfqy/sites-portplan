# PortPlan V7 실제 기여 기록

생성 2026-10-13T12:53:05+00:00. AI 자체 수행 기록이며 사용자 본인 창작·검증·이해·참가자격 확인서가 아니다.

| 작업 | 실제 수행 주체 | 확인 범위 |
| --- | --- | --- |
| 공개 GRASP/SGS/ALNS 및 라이선스 조사 | AI | 실제 원문/코드·고정commit·허가원件·접근한계 |
| V7 비용다듬기 및 GRASP 적응 구현 | AI | 최초 실행source와 frozen protocol; 방법의 새로움 미주장 |
| 새36×5 및 기존개발36×5 실행 | AI | 전체360episode, null/0원/악화/unknown 보존 |
| 원공개RCPSP480×2 실행과 별도Python검산 | AI | warm100ms·원모델·공식reference; fullALNS/SOTA아님 |
| 실제벌크항만 occurrence/assignment/clock 감사 | AI | 6,989occurrences/489visits; 별도SQL복산·0solver/0fee |
| 18쪽韓文자료·영문노트·보고서 작성 | AI | 완결원자료 guard후생성; PDF/화면검토는별도 |
| 사용자 직접개발·검증·이해·참가/서약 | 미확인 | AI수행을사용자개인기여로옮기지않음 |

원 연구·GLPK/HiGHS/SciPy·MIT ALNS/TSP·Apache OR-Tools·공개 자료의 저작권은 원 소유자에게 귀속하며 개별 원 notice를 유지한다. 2025 직접 창작·대리 작성/발표 금지 근거를 2026 규정으로 확정하지 않고 AI 허용이나 참가 자격도 대신 인정하지 않는다. 등록·외부 연락·대리 서명·발표를 수행하지 않았다.

새 주 평가를 본 뒤 seed·사례·파라미터를 교체하지 않았다. 최종 GRASP 시도 수 설정에 사용한 이전 개발 probe는 고정 protocol에 공개되어 있다. 기존 V6 자료와 최초 결과는 그대로 유지한다. 이후 실제 사용자 수정·검증이 있다면 날짜·범위·증거를 별도 기록하고 자동 완료 표시하지 않는다.

## 자료 생성의 실제 입력

| 입력 / Evidence input | SHA-256 |
| --- | --- |
| data/protocol-v7.json | `bb70fa6938ffbb162347142cbb2788f9ece00ac695a8b8ed5a647cd08aedb96f` |
| data/protocol-public-v7.json | `8c5370eaf867b167663717b97e6c895b796dbb832b84375ef61ad3a5b4bed364` |
| data/rolling-v7.json | `a8b0d67f7ff5fbf3b27fe260ab8d9d17be331a9942df37704d8d8365546000c6` |
| vendor/experiments/v7-first-run-source/manifest.json | `2c529a3341f69983a669098858ae3f6a39445dd3eb1e287e584b9630e24bd32f` |
| vendor/experiments/v7-first-run-source/data/development-inputs-v7.json | `ebbe72679c93fd53e2bb98c9abe49df25c9e3b96232ca44005f53adcd78ace57` |
| data/public-resource-v7.json | `8006575658f320ba0db851af8e6f0251ac9935bb8d72790bf0b9f405594d4dd6` |
| vendor/experiments/public-v7-first-run-source/manifest.json | `703d5b4747008d3f333c93821b616fdaedc088884988d7cac22f0507567a3f81` |
| data/port-ledger-v7.json | `2e0d2f31587b2455f85388092ef3fcc7fd94e9d11644613d42eb78c6beb9362b` |
| data/public/v6-data-sources/port-bulk-ocel-22019684/CargoPickup_IoT.sqlite | `edcb515fddc502db99a2122cf8d69b951d00269644aa46f6d550a43bb017075f` |
| data/rolling-review-v7.json | `580b0c92a329020c6d986ee39b4e9153da6b688bb0d37d8464ef94895e6024d6` |
| data/public-resource-review-v7.json | `0ca57ba433fad8ae94bbee4a3ae03b571fcfcefc4bd34145f761f4a8f08d0c40` |
| data/port-ledger-review-v7.json | `62dd82362c1cbd89b3eff81fb0cb400ccf93f535eb3fad152c66dacddd65a100` |
| data/public/v7-external-methods/manifest.json | `bc8217f6bc6a3ccfcc22c44d487100cdae844b5bdd89aa14b77e3b5783522990` |
| data/public/v7-validation/manifest.json | `9ea7a75ca6f7cd9eeedf75023d018ef766796b9e9a4462ae0e0798f848298d7f` |
