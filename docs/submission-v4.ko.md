# 공개 소급형 단계요율과 실행 이력을 고려한 수입 컨테이너 반출·적출·공컨테이너 반납 일정계획

**PortPlan V4 연구보고서 초안** · V4 결과 파일 기반 연구자료 초안 · 생성 2026-10-12T18:21:41+00:00

이 보고서는 AI가 자율적으로 개발·조사한 연구자료의 설명 초안이다. 제출자 본인이 구현·검증한 것으로 표시하지 않으며, 참가 자격·AI 정책·등록 완료를 증명하지 않는다. 기록된 결과는 아래 원자료의 해시와 연결된다.

## 초록

PortPlan은 공개 PNC 2026 소급형 보관료와 명시한 Maersk Korea D&D 해석을 사용하여 반출, 적출, 공컨테이너 반납의 일별 일정을 연구한다. 반출과 반납은 운송 용량을 공유하고, 적출과 대기 공간은 일정 간 충돌을 만든다. V4는 직접 사건 날짜 탐색, 검산 후보를 보존하는 안전 전처리, 실행 이력 고정 일별 재계획, Python/HiGHS 독립 검산을 구현한다. 정적 생성 사례 18개에서 직접 날짜 탐색은 14개, 검증 후보와 전처리를 결합한 정책은 14개의 완전 일정을 반환했다. 두 방법이 모두 완료한 14개 쌍에서 기준−후보 추가비용 합은 −₩2,140,500이며, 후보 비용이 낮은/같은/높은 쌍은 각각 3/9/2개다. 실행 가능성과 쌍 비용 차이를 별도 해석하며 이를 실현 기업 절감으로 일반화하지 않는다. 별도 용량 장애 실험 12개에서 원계획은 5개, 일별 재계획은 11개 경로를 완료했다. 모두 완료한 5개 쌍의 최종 비용 차이는 ₩0이며 정책의 총 계산 횟수는 같지 않다. 공개 요율, 실제 게이트 관측, 생성 주문은 서로 다른 증거다. 실제 선적 청구·기업 운영 절감이나 알고리즘 최초를 주장하지 않는다.

## 1. 문제와 적용 범위

제한된 운송·창고·대기 용량 아래에서 요금 단계가 바뀌기 전에 어떤 상자를 먼저 반출할지 결정한다. 반출만 빠르게 하는 정책은 반납을 지연시켜 D&D를 늘릴 수 있고, 미래 장애를 아는 정적 해는 실행 중 상태를 무시할 수 있다. 연구 질문은 제한된 계산 시간의 완전 일정 확보, 공개 이후 장애 대응, 같은 비용 정의의 재현 가능한 비교다.

일반 20′/40′ 드라이 컨테이너, 고정 유한 기간, 일별 결정, 알려진 주문을 대상으로 한다. 도로 경로, 기사별 운행, 게이트 예약, 새 주문 발생, 화물별 계약 및 세금을 모형에 포함하지 않는다. 일별 원자적 실행은 물리적 하루 내 운행 순서를 보장하지 않는다.

## 2. 요율과 증거

[PNC 2026 Standard Tariff](https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf)는 4일 무료, 소급 최고 구간 단가와 08:00 경계를 제공한다. 20′ 14일 보관료는 318,500원, 15일은 공식 산례와 같은 500,500원이며, 차이는 182,000원이다. 40′는 2 TEU다. 화주 조회 화면과 정식 PDF의 요율 충돌을 유지하며 VAT·실제 계약을 추정하지 않는다.

[Maersk Korea 공개 표](https://www.maersk.com/local-information/asia-pacific/south-korea/import)의 요율과 기산/종료일은 확인했지만 한국의 구간 간 누적 계산을 확정하는 산례는 찾지 못했다. 일별 누적 방식은 밝혀 둔 모델 해석이며, 다른 나라 규칙을 한국 증거로 대체하지 않는다.

광양 차량 게이트 자료는 실제 공개 관측이고 별도의 시간 오차 검증에 쓰였다. PNC 반출·적출·반납 주문 데이터가 아니다. V4 주문, 용량 및 장애는 생성 설정이다. 출처와 검토 깊이는 `source-audit.md`, `rules-status-v2.md`, `public-only-evidence-v3.md`에 남아 있다.

## 3. 모형과 방법

각 상자에 반출일 p, 적출 시작일 u, 반납일 r을 선택한다. p는 방출 가능일 이후이고 u≥p다. 연속 적출 종료는 화물 인도 기한 이내며 r은 적출과 선언한 반납 지연 이후, 전체 계획기간 안에 놓인다. 반출·반납은 각각 운송 1회, 적출 기간은 창고 슬롯, [p,r) 기간은 대기 슬롯을 사용한다.

목표는 Σ(PNC 보관료+D&D−계획 전 고정 발생액)다. 고정 발생액을 빼도 최적 일정은 바뀌지 않는다. 비용 계산과 모든 자원 제약을 통과한 완전 일정만 비교하며 부분 결과의 비용은 null이다.

기준 순열 탐색은 가장 빠른 완전 해독을 이용한다. 직접 날짜 탐색은 (p,u,r)을 재배치하고 소규모 삭제·재삽입을 시도한다. 전처리는 상자별 독립 최소비용의 합을 하한으로 사용한다. 검산된 후보 비용보다 특정 사건 고정 하한이 큰 날짜만 제거하므로 주목표 최적 해를 보존한다. 정확한 안전 정수 계수의 하한 달성 증명은 GLPK 호출 성공과 구분한다. cutoff는 GLPK MIP warm start가 아니며 합성 정책에 초기 해·전처리 시간을 포함한다.

## 4. 인과적 일별 재계획

모든 주문은 처음부터 알려지고 미래 실제 용량 장애는 숨겨진다. 매일 시작에 관측 또는 공고된 용량과 실행 이력을 받는다. 미공개 미래 용량은 명목 예측을 사용한다. 실제 반출·적출 시작·반납 날짜는 고정하고, 시작한 연속 작업의 용량 점유를 보존한다. 후보를 검산한 뒤 오늘의 작업만 실행하여 기록을 고정한다.

관측 과거가 동일한 경로에서 미공개 미래만 바꾸는 prefix 검사를 사용한다. 공개 이전 snapshot과 실행 결정이 달라지면 정보 누출이다. 사후 전체정보 해는 참고 정책으로 분리한다. 현재 구현은 알려진 주문과 용량 장애만 다루며, 미래 새 주문과 알려지지 않은 적출시간 대응을 구현했다고 주장하지 않는다.

## 5. 정적 동예산 실험

사전 고정한 18개 셀은 3 발생 메커니즘(적체·신규 도착·일괄 방출), 2 용량 프로필, 3 규모(16/50/100)의 전체 조합이다. 새 seed 1개씩 사용하고 결과에 따라 사례를 교체하지 않는다. 비교 정책은 순열 탐색, 직접 날짜 탐색, 기본 MILP, 검증 후보+안전 전처리 MILP다.

부모 프로세스가 각 정책에 1000ms를 강제한다. 프로세스 시작, 동적 import, WASM 초기화, 초기 해, 전처리, 모형 생성, 검산, 결과 전달이 포함된다. 한 번에 한 정책만 실행하며 순서를 회전한다. 한도 전에 수신한 완전 검산 후보만 보존하고, 종료된 계산의 증명은 보존하지 않는다. 종료 전달 오버헤드와 환경을 별도로 기록한다. 내부 byte hash와 사전 저장은 외부 사전등록이 아니다.

| 방법 | 완전 일정 / 전체 | 최적 증명 | 강제 한도 | 보존 후보 |
| --- | --- | --- | --- | --- |
| 순열 탐색 | 13 / 18 | 0 | 2 | 1 |
| 직접 날짜 탐색 | 14 / 18 | 0 | 3 | 1 |
| 기본 MILP | 12 / 18 | 12 | 5 | 0 |
| 검증 후보 + 전처리 MILP | 14 / 18 | 11 | 6 | 3 |

| 비교: 후보 / 기준 | 완전 쌍 | 낮음 / 같음 / 높음 | 기준−후보 합계 | 가중 차이 |
| --- | --- | --- | --- | --- |
| 검증 후보 + 전처리 MILP / 순열 탐색 | 13 | 4 / 7 / 2 | −₩1,413,100 | -6.47% |
| 검증 후보 + 전처리 MILP / 직접 날짜 탐색 | 14 | 3 / 9 / 2 | −₩2,140,500 | -7.61% |
| 검증 후보 + 전처리 MILP / 기본 MILP | 12 | 0 / 10 / 2 | −₩1,952,550 | -7.50% |
| 직접 날짜 탐색 / 순열 탐색 | 13 | 4 / 7 / 2 | ₩838,700 | 3.84% |

가중 차이는 Σ(기준 추가비용−후보 추가비용)/Σ기준 추가비용이다. 행마다 완전 쌍 집합이 다를 수 있다. 완전 쌍 밖의 실패, 0원 분모, 비용 증가를 유지하며 전체 생애주기 비용과 추가비용의 분모를 혼동하지 않는다. 생성 스트레스 셀은 현실 고객 모집단 표본이 아니므로 신뢰구간이나 예상 사업 절감으로 해석하지 않는다.

고정 정적 패널 전체 결과(각 칸: 추가비용 / 원래 상태):

| 고정 사례 | 순열 탐색 | 직접 날짜 탐색 | 기본 MILP | 검증 후보 + 전처리 MILP |
| --- | --- | --- | --- | --- |
| v4-aged-backlog-balanced-n16 | ₩4,878,950 / feasible | ₩4,880,250 / feasible | ₩4,843,400 / optimal | ₩4,843,400 / optimal |
| v4-aged-backlog-balanced-n50 | ₩13,023,750 / feasible | ₩12,750,650 / feasible | ₩12,014,450 / optimal | ₩13,921,500 / hard_time_limit |
| v4-aged-backlog-balanced-n100 | null / hard_time_limit | null / hard_time_limit | null / hard_time_limit | null / hard_time_limit |
| v4-aged-backlog-tight-n16 | null / no_feasible_schedule_found | ₩7,113,450 / feasible | ₩7,002,150 / optimal | ₩7,002,150 / optimal |
| v4-aged-backlog-tight-n50 | null / no_feasible_schedule_found | null / no_feasible_schedule_found | null / hard_time_limit | null / hard_time_limit |
| v4-aged-backlog-tight-n100 | null / no_feasible_schedule_found | null / no_feasible_schedule_found | null / infeasible | null / hard_time_limit |
| v4-new-arrivals-balanced-n16 | ₩0 / feasible | ₩0 / feasible | ₩0 / optimal | ₩0 / optimal |
| v4-new-arrivals-balanced-n50 | ₩0 / feasible | ₩0 / feasible | ₩0 / optimal | ₩0 / optimal |
| v4-new-arrivals-balanced-n100 | ₩0 / feasible | ₩0 / feasible | ₩0 / optimal | ₩0 / optimal |
| v4-new-arrivals-tight-n16 | ₩0 / feasible | ₩0 / feasible | ₩0 / optimal | ₩0 / optimal |
| v4-new-arrivals-tight-n50 | ₩0 / feasible | ₩0 / feasible | ₩0 / optimal | ₩0 / optimal |
| v4-new-arrivals-tight-n100 | ₩0 / feasible | ₩0 / feasible | null / hard_time_limit | ₩0 / optimal |
| v4-batch-release-balanced-n16 | ₩309,400 / feasible | ₩282,100 / feasible | ₩282,100 / optimal | ₩282,100 / optimal |
| v4-batch-release-balanced-n50 | ₩618,800 / feasible | ₩627,900 / feasible | ₩609,700 / optimal | ₩609,700 / optimal |
| v4-batch-release-balanced-n100 | ₩1,055,600 / hard_time_limit | ₩1,055,600 / hard_time_limit | ₩1,010,100 / optimal | ₩1,055,600 / hard_time_limit |
| v4-batch-release-tight-n16 | ₩300,300 / feasible | ₩254,800 / feasible | ₩254,800 / optimal | ₩254,800 / optimal |
| v4-batch-release-tight-n50 | ₩1,658,900 / feasible | ₩1,155,700 / feasible | null / hard_time_limit | ₩2,291,700 / hard_time_limit |
| v4-batch-release-tight-n100 | null / no_feasible_schedule_found | null / hard_time_limit | null / hard_time_limit | null / no_feasible_schedule_found |

`hard_time_limit`에도 한도 전 검산된 후보가 보존되면 완전 비용이 표시될 수 있다. 이 경우 후보는 실행 가능하지만 종료된 계산의 최적 증명은 없으며 raw GLPK 성공으로 바꾸지 않는다. null은 0원이 아니다.

## 6. 독립 검산과 수학적 증명

`scripts/certify-v4.py`는 JavaScript 함수·계수를 읽지 않고 Python에서 날짜, 공개 요율, 자원 점유와 trip-column 정수모형을 재구성한다. HiGHS의 검산 후보와 하한을 기존 결과에 맞춰 비용·최적 상태의 모순을 찾는다. 프로젝트 내부의 독립 구현이며 외부 기관 인증이나 실제 계약 승인이 아니다. 추가 HiGHS 계산 예산은 정적 1000ms 정책 비교에 포함하지 않는다. 인증 범위는 정적 일별 모형이고 rolling 실행 이력 전체를 인증하지 않는다.

| 검토 항목 | 기록 |
| --- | --- |
| 독립 검토 사례 | 18 / 18 |
| 후보 일정 비용·제약 검토 | 53 |
| 검토 오류 사례 | 0 |
| 독립 최적 증명 / 불가능 증명 | 15 / 1 |
| 미증명 후보 / 허용오차 최적 | 2 / 0 |
| 증명 없음 / 제외 사례 | 0 / 0 |

증명 없음은 오류와 다르다. 안전 정수 목표의 증명 상태와 비정수 요율의 수치 허용오차 solver-optimal 상태를 구분한다. 후자는 provenOptimal=false이며 정확한 수학 증명으로 표시하지 않는다. `certificate-method-v4.md`가 수치 보장과 반례를 설명한다. 제외 사례가 있다면 입력 순서 앞 N개만 검토한 것으로 설명하며, 미검토 사례의 최적성을 주장하지 않는다. 수치 허용오차·하한·gap·상태는 원자료에 보존된다.

## 7. 장애 대응 결과와 실패

| 정책 | 완전 실행 | 전체 | 실패 | 미실행 날짜 변경 |
| --- | --- | --- | --- | --- |
| 원계획 유지 | 5 | 12 | 7 | 0 |
| 인과적 일별 재계획 | 11 | 12 | 1 | 316 |
| 사후 전체정보 참고 | 12 | 12 | 0 | 0 |

원계획·일별 재계획이 모두 끝난 5개 쌍의 최종 비용 차이: ₩0. 원계획 실패에서 재계획이 완료한 경로: 6개.

일별 장애 실험은 정적 패널 및 예산과 별도다. 각 solve의 내부 한도는 0.2초이나 정책별 호출 수가 다르므로 총 계산 동예산이라고 주장하지 않는다. 전체 실행, 실패한 날, 이미 수행한 작업, 미실행 사건 날짜 변경을 기록한다. 양 정책이 모두 완료한 경로에서만 최종 비용을 비교한다. 실제 운영 실패 확률이나 모든 장애에 대한 보장을 추정하지 않는다.

| 경로 | 정책 | 실패일 (0부터) | 원인 |
| --- | --- | --- | --- |
| rolling-aged-backlog-n12-r1 | 원계획 유지 | 3 | candidate_rejected |
| rolling-aged-backlog-n12-r1 | 사후 전체정보 참고 | — | optimal |
| rolling-aged-backlog-n12-r2 | 원계획 유지 | 7 | candidate_rejected |
| rolling-aged-backlog-n12-r2 | 사후 전체정보 참고 | — | optimal |
| rolling-aged-backlog-n24-r1 | 원계획 유지 | 5 | candidate_rejected |
| rolling-aged-backlog-n24-r1 | 사후 전체정보 참고 | — | optimal |
| rolling-aged-backlog-n24-r2 | 원계획 유지 | 3 | candidate_rejected |
| rolling-aged-backlog-n24-r2 | 사후 전체정보 참고 | — | optimal |
| rolling-new-arrivals-n12-r1 | 원계획 유지 | 7 | candidate_rejected |
| rolling-new-arrivals-n12-r1 | 인과적 일별 재계획 | 7 | no_complete_plan |
| rolling-new-arrivals-n12-r1 | 사후 전체정보 참고 | — | optimal |
| rolling-new-arrivals-n12-r2 | 사후 전체정보 참고 | — | optimal |
| rolling-new-arrivals-n24-r1 | 사후 전체정보 참고 | — | optimal |
| rolling-new-arrivals-n24-r2 | 원계획 유지 | 7 | candidate_rejected |
| rolling-new-arrivals-n24-r2 | 사후 전체정보 참고 | — | optimal |
| rolling-batch-release-n12-r1 | 사후 전체정보 참고 | — | optimal |
| rolling-batch-release-n12-r2 | 사후 전체정보 참고 | — | optimal |
| rolling-batch-release-n24-r1 | 원계획 유지 | 7 | candidate_rejected |
| rolling-batch-release-n24-r1 | 사후 전체정보 참고 | — | optimal |
| rolling-batch-release-n24-r2 | 사후 전체정보 참고 | — | optimal |

정적 실패 상태를 모두 유지한다.

| 방법 | 원래 상태 | 사례 수 |
| --- | --- | --- |
| 검증 후보 + 전처리 MILP | hard_time_limit | 3 |
| 검증 후보 + 전처리 MILP | no_feasible_schedule_found | 1 |
| 기본 MILP | hard_time_limit | 5 |
| 기본 MILP | infeasible | 1 |
| 순열 탐색 | hard_time_limit | 1 |
| 순열 탐색 | no_feasible_schedule_found | 4 |
| 직접 날짜 탐색 | hard_time_limit | 2 |
| 직접 날짜 탐색 | no_feasible_schedule_found | 2 |

한도 내 완전 후보 없음은 수학적 불가능 증명이 아니다. 사후 가능 일정은 되돌릴 수 없는 이전 작업을 가진 온라인 성공을 보장하지 않는다. 최고 절감 사례를 대표 결과로 선택하지 않는다.

## 8. 관련 연구와 기여 범위

Jeong et al.의 적출/반납/D&D, 동적 drayage rolling horizon, ALNS, MIP 전처리와 정수 반사실 설명에는 직접 선례가 있다. 상용 PortPro도 반출/반납 예약 매칭을 공개한다. 선행 연구가 같은 한국 요율이나 같은 이력 모형을 전혀 다루지 않는다고 초록만 보고 추정하지 않는다. 참고문헌과 실제 읽기 깊이는 `prior-art-v2.md`와 `research-roadmap-v4.md`에 있다.

주장 가능한 기여는 특정 공개 소급 요율, 일별 실행 상태, 동일 계산 예산, 독립 검산을 결합한 검사 가능한 응용이다. 알고리즘 최초·세계 최고·산업 최적·PNC 실제 배치·실현 기업 절감·1위 보장은 주장하지 않는다.

## 9. 저자와 제출 상태

이번 개발과 조사, 검산 스크립트, 실험 준비와 문안은 AI가 자율 수행했다. 제출자 본인의 코드 작성, 원문 확인, 산례 검증, 실험 재현 및 발표 숙련은 확인되지 않았다. 이를 대신 완료했다고 기록하거나 서약하지 않는다. GLPK/glpk.js, NumPy/SciPy/HiGHS 및 참고 자료의 기여와 라이선스는 별도로 기록한다.

[2026 공식 공고](https://anchor.changwon.ac.kr/main/menu?gc=Program&do=sinform&spod=s1&program_id=VKoDUNlZwONq&psin_id=VKoDUNlMqh4n)는 11월 6일 18:00 자료 마감, 11월 13일 1차 심사, 11월 20일 발표, 보고서·전 데이터/코드와 20쪽 이하 발표자료를 명시한다. 1인 팀, 영어 발표, 생성식 AI 조건은 공개 확인 미완료다. 2025 공식 서약의 본인 창작·대리 작성 금지는 역사 근거이며 2026 적용과 AI 해석은 미확인이다. `competition-research-v4.md`가 원문 링크, 날짜 충돌, 연도별 시상 차이를 정리한다.

## 10. 재현과 원자료 연결

```bash
node scripts/benchmark-v4.mjs
python scripts/certify-v4.py --input /absolute/path/data/benchmark-v4.json --output /absolute/path/data/certificate-v4.json --max-cases 18
python scripts/build-defense-v4.py --require-results
```

시간 한도 결과는 장비 부하에 따라 달라질 수 있다. 아래 해시는 이번 자료가 참조하는 저장 결과를 식별한다. 재실행 결과와 원래 결과를 섞지 않는다.

| 입력 | SHA-256 |
|---|---|
| protocol-v4.json | `cfda2b5cdf2bd5806a9fdbc0b380eea7e03cccfe04e51e01528365d0230acfc1` |
| benchmark-v4.json | `96f7cd638535391ba78c191c7d4d9681746d799360234c3818d4a123862de3af` |
| rolling-v4.json | `0f7aa70153dc39035527660ca6ed3c464da580a9bd87aa1f1c3ec0c307c67aa3` |
| rolling-protocol-v4.json | `f089a13aa08a153bc956753966f4be4c7e7b9ac50c621bb6d54a84e4eb8f0ecc` |
| certificate-v4.json | `dd77a4ed9c694ad0f857237c08601170b81354b35e17a36859904f0d8dd5d999` |

생성기: `scripts/build-defense-v4.py`. 영문 이해용 발표 노트: `docs/defense-v4.en.md`. 한글 16쪽 발표 초안: `docs/defense-v4.ko.html`. 연구보고서·코드·데이터는 검토용 준비물이며 제출 완료 기록이 아니다.
