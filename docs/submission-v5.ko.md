# 공개 단계요율 아래의 빠른 완전 후보 구성과 유효 실행계획 유지

**PortPlan V5 한글 연구보고서 초안** · V5 저장 결과 기반 연구자료 초안 · 생성 2026-10-13T03:08:10+00:00

본 자료의 조사·코드·실험 준비·설명 초안은 AI가 자율 수행했다. 제출자 본인이 직접 개발·검증한 것이라고 표시하지 않는다. 참가 자격, 등록 및 생성형 AI 조건의 확인 기록도 아니다.

## 초록

PortPlan V5는 PNC 소급형 보관료와 명시한 Maersk Korea 해석을 고려한 일별 반출·적출·공컨테이너 반납 계획에서 빠른 완전 후보와 안정적인 실행 날짜의 가치를 연구한다. 반출·반납 날짜 비용 캐시와 증분 자원 배열로 구성하고, 정적 총 1,000ms 중 최대 200ms 구성 후 V4 날짜 탐색을 실행한다. 별도 안정 정책은 현재 snapshot과 실행 이력에 유효한 날짜를 유지하고 처음 또는 무효일 때만 다시 푼다. 새 생성 seed 36개에서 완전 후보는 기본 MILP 24개, V4 직접 날짜 탐색 27개, V5 fastEvent 30개였다. V4와 V5 모두 완료한 27개 쌍에서 기준−V5 추가비용 합은 ₩2,076,050, 가중 차이는 4.06%이고 낮음/같음/높음은 9/14/4개다. 별도 24개 실행 경로에서 매일 재최적화 16개, 유효 계획 유지 16개가 완료했다. 두 정책 모두 완료한 16개 쌍의 날짜 변경은 621→164회(73.59% 감소), 유지 비용 증가는 ₩3,200였다. 총비용 분모 ₩42,928,550에서는 0.007454%, 추가비용 분모 ₩25,105,050에서는 0.012746%다. 전체 24경로 solver 호출은 242→49이나 호출 수가 달라 총 계산 동예산으로 해석하지 않는다. 같은 생성 메커니즘의 새 seed 비교이지 외부 기업·실제 업무 기간 검증은 아니며 실제 고객 절감이나 최초 알고리즘을 주장하지 않는다.

## 1. 문제와 변경 동기

반출과 반납은 운송을 공유하고 연속 적출 및 대기 공간이 계획을 결합한다. PNC 최고 도달 단가의 소급 적용은 하루의 연기가 큰 차이를 만들 수 있다. 20′ 14일 318,500원, 15일 500,500원의 차이는 182,000원이며 15일 금액은 [PNC 공식 PDF](https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf) 산례와 일치한다. 이것은 규칙 예시이지 V5 성과나 실제 청구서가 아니다.

V4 개발 실험은 전처리 결합이 강한 직접 날짜 탐색보다 비용상 우세하지 않음을 보였다. V5는 완전 후보 구성 비용과 불필요한 날짜 변경을 줄이는 두 질문으로 이어진다. V4 음성 결과를 지우거나 V4/V5 패널을 합쳐 성과를 산출하지 않는다.

## 2. 자료, 모형과 범위

PNC 공개 요율·무료기간·08:00 경계는 공식 자료에 근거한다. 한국 Maersk 구간 간 일일 누적은 밝혀 둔 모델 해석으로 현행 계약 확정 산식이라고 표시하지 않는다. 차량 게이트 시간은 실제 관측의 별도 오차 검증이고 PNC 주문이나 반납 생애주기가 아니다. V5 주문, 용량, 장애는 생성 설정이다.

모형은 각 상자의 반출 p, 적출 시작 u, 반납 r을 모두 선택한다. 방출 가능일·화물 기한·연속 적출·반납 지연·전체 기간 종료를 지키며, 반출/반납 각 운송 1회, 적출 중 창고 슬롯, [p,r) 대기 슬롯을 쓴다. 목표는 Σ(PNC+D&D−계획 전 고정 발생액)다. 고정 발생액 차감은 최적 날짜를 바꾸지 않는다. 완전 검산 후보만 비용을 갖고 부분 결과는 null이다. 경로·기사 운행·예약·새 주문·세금·개별 계약은 구현하지 않는다.

## 3. V4 개발집합과 V5 새 seed의 관계

V4 결과를 보고 방법을 개발했으므로 V4는 독립 테스트로 제시하지 않는다. V5 정적 패널은 새 고정 36 seed, 안정 실행은 별도 새 고정 24 경로다. 같은 기존 합성 생성 메커니즘을 사용한다. 따라서 생성기 내부 seed 분리이며 외부 기업 자료, 시간상 업무 holdout 또는 다른 분포의 일반화 검증이 아니다. 프로토콜은 결과 전에 고정하고 전체 사례와 실패를 유지한다. 내부 해시와 저장 순서는 외부 사전등록을 의미하지 않는다.

## 4. 정적 방법과 계산 예산

`solveFastConstructor`는 상자마다 날짜 요금 배열을 계산해 trip 반복 중 날짜 파싱을 피한다. 구성 시도마다 한 번 정렬하고 운송/창고/대기 배열을 증분 갱신하며 한정 rollback repair와 재시작을 사용한다. 완전 일정이 주 엔진 검산을 통과할 때만 후보가 된다. 날짜비용 준비·구성도 예산 안이다. 기존 캐시, 자원 증분 업데이트 및 이웃 탐색 기법의 응용이지 새로운 일반 최적화 패러다임이 아니다.

fastEvent는 콜드 시작 1,000ms 전체 예산 안에서 초기 구성 최대 200ms, 그 뒤 남은 시간에 V4 직접 날짜 탐색을 쓴다. 기본 MILP와 V4 날짜 탐색을 같은 부모 강제 한도로 비교하며 로딩·초기 해·검산·IPC 수신을 포함한다. 순서를 회전하고 한 번에 한 방법만 실행한다. 한도 전 받은 검산 후보만 보존하고 종료된 solve의 증명은 유지하지 않는다. 이 정적 구성기는 실행 lock을 지원하지 않으며 안정 정책의 초기 solver를 대체했다고 주장하지 않는다.

| 방법 | 완전 검산 / 전체 | 최적 증명 | 강제 한도 | 보존 후보 |
| --- | --- | --- | --- | --- |
| 기본 MILP | 24 / 36 | 24 | 11 | 0 |
| V4 직접 날짜 탐색 | 27 / 36 | 0 | 1 | 0 |
| V5 빠른 구성 + 날짜 탐색 | 30 / 36 | 0 | 0 | 0 |

끝까지 받은 부모 wall time의 통상 중앙값(짝수 건수는 중앙 두 값 평균):

| 방법 | wall time 중앙값 |
| --- | --- |
| 기본 MILP | 203.00 ms |
| V4 직접 날짜 탐색 | 981.13 ms |
| V5 빠른 구성 + 날짜 탐색 | 981.09 ms |

| V5 후보의 기준 | 완전 쌍 | 낮음 / 같음 / 높음 | 기준−V5 합계 | 가중 차이 |
| --- | --- | --- | --- | --- |
| V4 직접 날짜 탐색 | 27 | 9 / 14 / 4 | ₩2,076,050 | 4.06% |
| 기본 MILP | 24 | 0 / 17 / 7 | −₩3,102,500 | -7.54% |

가중 차이는 Σ(기준 추가비용−V5 추가비용)/Σ기준 추가비용이다. 완전 쌍 집합이 행마다 다를 수 있으며, 음수는 V5가 더 비쌈을 뜻한다. 추가비용의 분모를 전체 생애주기 비용으로 바꾸어 표기하지 않는다.

| 기준 | 0원 기준 쌍 | 기준 누락 | V5 누락 | V5 최악 손실 |
| --- | --- | --- | --- | --- |
| V4 직접 날짜 탐색 | 10 | 9 | 6 | ₩230,750 |
| 기본 MILP | 11 | 12 | 6 | ₩1,618,650 |

### 별도 3초 보충 패널

선언한 보충 패널은 주 패널의 100개 상자 주문을 재사용하고 같은 세 정책에 3초를 준다. 새로운 독립 입력이나 1초 주 성과에 합산하지 않는다. 실행 시간 확대의 참고이며 1초 실패를 사후 삭제하는 구실이 아니다.

| 보충 사례 | 원래 주 사례 | 기본 MILP | V4 직접 날짜 탐색 | V5 빠른 구성 + 날짜 탐색 |
| --- | --- | --- | --- | --- |
| v5-aged-backlog-balanced-n100-r1--control3000 | v5-aged-backlog-balanced-n100-r1 | null / hard_time_limit | ₩31,203,700 / feasible | ₩30,394,100 / feasible |
| v5-aged-backlog-tight-n100-r1--control3000 | v5-aged-backlog-tight-n100-r1 | null / hard_time_limit | null / no_feasible_schedule_found | null / no_feasible_schedule_found |
| v5-new-arrivals-balanced-n100-r1--control3000 | v5-new-arrivals-balanced-n100-r1 | ₩0 / optimal | ₩0 / feasible | ₩0 / feasible |
| v5-new-arrivals-tight-n100-r1--control3000 | v5-new-arrivals-tight-n100-r1 | ₩0 / optimal | ₩0 / feasible | ₩0 / feasible |
| v5-batch-release-balanced-n100-r1--control3000 | v5-batch-release-balanced-n100-r1 | ₩991,900 / optimal | ₩1,010,100 / feasible | ₩1,149,300 / feasible |
| v5-batch-release-tight-n100-r1--control3000 | v5-batch-release-tight-n100-r1 | null / hard_time_limit | ₩1,728,500 / feasible | ₩1,849,000 / feasible |

## 5. 실행 이력과 유효 계획 유지

매일 정책은 모든 초기 주문과 오늘까지의 관측 용량, 고정 실행 이력만 받는다. 공개 전 실제 미래 장애 및 기간은 숨기고 미래 용량은 명목 예측한다. 반출·적출 시작·반납 이력은 바꾸지 않는다. 시작한 연속 작업의 점유도 유지한다. 후보를 검산한 뒤 오늘 사건만 실행한다. 동일 관측 과거에 다른 미공개 미래를 주는 prefix 검사는 계속 적용한다.

stableRetain은 각 에피소드에 저장한 완전 날짜 계획을 현재 snapshot과 고정 사건/최소 사건 날짜에 재검산한다. 비용도 현재 요율로 다시 계산한다. 아직 유효하면 solver를 호출하지 않고 `retained_plan_not_reoptimized`를 기록한다. 처음이거나 무효면 기존 optimizer를 호출한다. 현재 더 낮은 비용 해가 있어도 유지할 수 있으므로 현재 최적 또는 무료 안정성으로 설명하지 않는다.

| 정책 | 완전 실행 / 전체 | solver 호출 | 계획 재사용 | 날짜 변경 |
| --- | --- | --- | --- | --- |
| 매일 재최적화 | 16 / 24 | 242 | 0 | 876 |
| 유효 계획 유지 | 16 / 24 | 49 | 192 | 194 |

각 solve 내부 한도는 0.2초이고 초기화·모형 작성·검산을 포함한 엄격한 에피소드 전체 wall 한도가 아니다. 두 정책은 동일 관측과 이력 의미를 공유하나 solver 호출 횟수가 달라 총 CPU 동예산 비교가 아니다. 결과는 현재 고정 용량 장애와 알려진 초기 주문에 제한된다. 변경 횟수는 미실행 사건 날짜 변경이며 측정한 실제 작업비가 아니다.

초기 날짜가 다른 경로: 0 / 24. 해당 경로의 차이를 유지 정책만의 효과로 귀속하지 않습니다.

동일 optimizer와 입력이라도 두 초기 solve는 별도 호출이다. 시간 한도와 동률 선택에 따른 초기 날짜 차이를 숨기지 않는다. 초기 계획이 다르면 이후 비용/변경 차이 전체가 날짜 유지 규칙의 인과 효과라고 주장하지 않는다.

| 완전 쌍 | 유지 비용 낮음 / 같음 / 높음 | 매일−유지 비용 | 총비용 가중 차이 | 날짜변경 매일→유지 |
| --- | --- | --- | --- | --- |
| 16 | 1 / 14 / 1 | −₩3,200 | -0.007454% | 621 → 164 |

위 비용 차이는 모두 완료한 경로의 **총 생애주기 비용**으로 정적 추가비용과 다른 분모다. 실패 경로를 저비용 완료로 처리하지 않는다. 날짜 변경 감소와 비용 증가/완료 실패를 동시에 공개한다.

날짜 변경 감소 73.59%. 유지 비용 증가 ₩3,200: 총비용 0.007454% / 추가비용 0.012746%. 같은 완전 쌍의 다른 분모입니다.

| 동일 완전 쌍의 분모 | 매일 기준액 | 유지 추가액 | 유지 증가율 |
| --- | --- | --- | --- |
| 총 생애주기 비용 | ₩42,928,550 | ₩3,200 | 0.007454% |
| 추가비용 | ₩25,105,050 | ₩3,200 | 0.012746% |

## 6. 독립 검산과 증명

Python/HiGHS는 JS 비용 함수·모형 계수를 가져오지 않고 날짜, 요율, 자원을 다시 계산하고 별도 trip-column 모형을 구축한다. 후보, 하한 및 최적 상태의 모순을 찾는다. 안전 정수 목표의 선언 증명 상태와 비정수 수치 허용오차 solver-optimal 상태를 구분한다. 내부 독립 구현이지 외부 인증·실제 계약 검증은 아니다. 추가 HiGHS 예산은 1초 정적 정책 비교 밖이다. 정적 증명은 rolling 이력 전체의 수학적 인증이 아니다.

| 독립 확인 | 결과 |
| --- | --- |
| 검토 기록 (입력 재사용 포함) | 42 / 42 |
| 검산 후보 / 오류 사례 | 94 / 0 |
| 최적 증명 / 불가능 증명 | 36 / 1 |
| 미증명 후보 / 허용오차 최적 | 5 / 0 |
| 증명 없음 / 제외 사례 | 0 / 0 |

검토 대상은 **36개 독립 생성 주 seed + 6개 주 입력 재사용 3초 제어**다. 42개 독립 주문 사례라고 하지 않는다. `certificate-input-v5.json`이 42개 기록을 평탄화하며 원래 archive 해시를 보존하고, 결과의 `inputSha256`과 `evidenceBindings`가 그 파일과 원 archive 및 프로토콜을 연결한다. 추가 2초/목표의 native 계산은 1초 정책 성공 건수에 합치지 않는다.

일부만 검토했다면 입력 순서 앞 N개임을 명시하고 제외 사례의 최적성은 주장하지 않는다. 미증명 유계 후보와 증명 없음은 실패와 별개다. 자세한 수치 의미는 `certificate-method-v4.md`를 참조한다.

## 7. 전체 결과와 실패

완전 정적 후보 없는 원래 상태를 유지한다.

| 방법 | 실패 상태 | 사례 수 |
| --- | --- | --- |
| V5 빠른 구성 + 날짜 탐색 | no_feasible_schedule_found | 6 |
| 기본 MILP | hard_time_limit | 11 |
| 기본 MILP | infeasible | 1 |
| V4 직접 날짜 탐색 | hard_time_limit | 1 |
| V4 직접 날짜 탐색 | no_feasible_schedule_found | 8 |

전체 고정 정적 패널(칸: 추가비용 / 원래 상태):

| 사례 | 기본 MILP | V4 직접 날짜 탐색 | V5 빠른 구성 + 날짜 탐색 |
| --- | --- | --- | --- |
| v5-aged-backlog-balanced-n16-r1 | ₩5,909,150 / optimal | ₩6,180,850 / feasible | ₩6,124,000 / feasible |
| v5-aged-backlog-balanced-n16-r2 | ₩3,276,850 / optimal | ₩3,504,700 / feasible | ₩3,495,250 / feasible |
| v5-aged-backlog-balanced-n50-r1 | ₩13,437,800 / optimal | ₩14,545,200 / feasible | ₩14,197,200 / feasible |
| v5-aged-backlog-balanced-n50-r2 | ₩14,450,650 / optimal | ₩15,838,550 / feasible | ₩16,069,300 / feasible |
| v5-aged-backlog-balanced-n100-r1 | null / hard_time_limit | null / no_feasible_schedule_found | ₩31,570,650 / feasible |
| v5-aged-backlog-balanced-n100-r2 | null / hard_time_limit | null / no_feasible_schedule_found | ₩34,581,450 / feasible |
| v5-aged-backlog-tight-n16-r1 | null / hard_time_limit | null / no_feasible_schedule_found | null / no_feasible_schedule_found |
| v5-aged-backlog-tight-n16-r2 | null / infeasible | null / no_feasible_schedule_found | null / no_feasible_schedule_found |
| v5-aged-backlog-tight-n50-r1 | null / hard_time_limit | null / no_feasible_schedule_found | null / no_feasible_schedule_found |
| v5-aged-backlog-tight-n50-r2 | null / hard_time_limit | null / no_feasible_schedule_found | null / no_feasible_schedule_found |
| v5-aged-backlog-tight-n100-r1 | null / hard_time_limit | null / no_feasible_schedule_found | null / no_feasible_schedule_found |
| v5-aged-backlog-tight-n100-r2 | null / hard_time_limit | null / no_feasible_schedule_found | null / no_feasible_schedule_found |
| v5-new-arrivals-balanced-n16-r1 | ₩0 / optimal | ₩0 / feasible | ₩0 / feasible |
| v5-new-arrivals-balanced-n16-r2 | ₩0 / optimal | ₩0 / feasible | ₩0 / feasible |
| v5-new-arrivals-balanced-n50-r1 | ₩0 / optimal | ₩0 / feasible | ₩0 / feasible |
| v5-new-arrivals-balanced-n50-r2 | ₩0 / optimal | ₩0 / feasible | ₩0 / feasible |
| v5-new-arrivals-balanced-n100-r1 | ₩0 / optimal | ₩0 / feasible | ₩0 / feasible |
| v5-new-arrivals-balanced-n100-r2 | ₩0 / optimal | ₩0 / feasible | ₩0 / feasible |
| v5-new-arrivals-tight-n16-r1 | ₩9,100 / optimal | ₩9,100 / feasible | ₩9,100 / feasible |
| v5-new-arrivals-tight-n16-r2 | ₩0 / optimal | ₩0 / feasible | ₩0 / feasible |
| v5-new-arrivals-tight-n50-r1 | ₩0 / optimal | ₩0 / feasible | ₩0 / feasible |
| v5-new-arrivals-tight-n50-r2 | ₩0 / optimal | ₩0 / feasible | ₩0 / feasible |
| v5-new-arrivals-tight-n100-r1 | ₩0 / optimal | ₩0 / feasible | ₩18,200 / feasible |
| v5-new-arrivals-tight-n100-r2 | ₩0 / optimal | ₩45,500 / feasible | ₩0 / feasible |
| v5-batch-release-balanced-n16-r1 | ₩109,200 / optimal | ₩109,200 / feasible | ₩109,200 / feasible |
| v5-batch-release-balanced-n16-r2 | ₩227,500 / optimal | ₩242,500 / feasible | ₩227,500 / feasible |
| v5-batch-release-balanced-n50-r1 | ₩527,800 / optimal | ₩527,800 / feasible | ₩527,800 / feasible |
| v5-batch-release-balanced-n50-r2 | ₩591,500 / optimal | ₩591,500 / feasible | ₩591,500 / feasible |
| v5-batch-release-balanced-n100-r1 | ₩991,900 / optimal | ₩1,046,500 / feasible | ₩1,210,300 / feasible |
| v5-batch-release-balanced-n100-r2 | ₩1,155,700 / optimal | ₩1,173,900 / feasible | ₩1,210,300 / feasible |
| v5-batch-release-tight-n16-r1 | ₩263,900 / optimal | ₩405,800 / feasible | ₩263,900 / feasible |
| v5-batch-release-tight-n16-r2 | ₩218,400 / optimal | ₩218,400 / feasible | ₩218,400 / feasible |
| v5-batch-release-tight-n50-r1 | null / hard_time_limit | ₩1,339,900 / feasible | ₩1,170,700 / feasible |
| v5-batch-release-tight-n50-r2 | null / hard_time_limit | ₩1,238,800 / feasible | ₩1,190,600 / feasible |
| v5-batch-release-tight-n100-r1 | null / hard_time_limit | null / hard_time_limit | ₩2,449,100 / feasible |
| v5-batch-release-tight-n100-r2 | null / hard_time_limit | ₩4,158,400 / feasible | ₩2,467,300 / feasible |

`hard_time_limit`이라도 한도 전 검산 후보가 보존되면 비용은 유효할 수 있다. 이는 후보 실행 가능성이고 종료된 GLPK의 최적 증명이나 성공으로 바꾸지 않는다. null은 0원이 아니다.

전체 실행 경로(실패일은 0부터 시작):

| 경로 | 매일 재최적화 | 유효 계획 유지 | 초기 날짜 비교 |
| --- | --- | --- | --- |
| v5-rolling-aged-backlog-balanced-n12-r1 | 완료 ₩8,935,900 | 완료 ₩8,935,900 | 동일 |
| v5-rolling-aged-backlog-balanced-n12-r2 | 완료 ₩5,319,800 | 완료 ₩5,319,800 | 동일 |
| v5-rolling-aged-backlog-balanced-n24-r1 | 완료 ₩13,087,000 | 완료 ₩13,087,000 | 동일 |
| v5-rolling-aged-backlog-balanced-n24-r2 | 완료 ₩13,345,550 | 완료 ₩13,345,550 | 동일 |
| v5-rolling-aged-backlog-tight-n12-r1 | 실패일 0 / no_complete_plan | 실패일 0 / no_complete_plan | 동일 |
| v5-rolling-aged-backlog-tight-n12-r2 | 실패일 5 / no_complete_plan | 실패일 5 / no_complete_plan | 동일 |
| v5-rolling-aged-backlog-tight-n24-r1 | 실패일 0 / no_complete_plan | 실패일 0 / no_complete_plan | 동일 |
| v5-rolling-aged-backlog-tight-n24-r2 | 실패일 3 / no_complete_plan | 실패일 3 / no_complete_plan | 동일 |
| v5-rolling-new-arrivals-balanced-n12-r1 | 완료 ₩0 | 완료 ₩0 | 동일 |
| v5-rolling-new-arrivals-balanced-n12-r2 | 완료 ₩0 | 완료 ₩0 | 동일 |
| v5-rolling-new-arrivals-balanced-n24-r1 | 완료 ₩0 | 완료 ₩0 | 동일 |
| v5-rolling-new-arrivals-balanced-n24-r2 | 완료 ₩0 | 완료 ₩0 | 동일 |
| v5-rolling-new-arrivals-tight-n12-r1 | 실패일 4 / no_complete_plan | 실패일 4 / no_complete_plan | 동일 |
| v5-rolling-new-arrivals-tight-n12-r2 | 완료 ₩9,100 | 완료 ₩9,100 | 동일 |
| v5-rolling-new-arrivals-tight-n24-r1 | 완료 ₩0 | 완료 ₩0 | 동일 |
| v5-rolling-new-arrivals-tight-n24-r2 | 실패일 8 / no_complete_plan | 실패일 8 / no_complete_plan | 동일 |
| v5-rolling-batch-release-balanced-n12-r1 | 완료 ₩136,500 | 완료 ₩145,600 | 동일 |
| v5-rolling-batch-release-balanced-n12-r2 | 완료 ₩178,800 | 완료 ₩172,900 | 동일 |
| v5-rolling-batch-release-balanced-n24-r1 | 완료 ₩291,200 | 완료 ₩291,200 | 동일 |
| v5-rolling-batch-release-balanced-n24-r2 | 완료 ₩309,400 | 완료 ₩309,400 | 동일 |
| v5-rolling-batch-release-tight-n12-r1 | 실패일 0 / no_complete_plan | 실패일 0 / no_complete_plan | 동일 |
| v5-rolling-batch-release-tight-n12-r2 | 실패일 8 / no_complete_plan | 실패일 8 / no_complete_plan | 동일 |
| v5-rolling-batch-release-tight-n24-r1 | 완료 ₩805,700 | 완료 ₩805,700 | 동일 |
| v5-rolling-batch-release-tight-n24-r2 | 완료 ₩509,600 | 완료 ₩509,600 | 동일 |

유리한 사례만 선택하거나 실패 후 새 seed로 대체하지 않는다. 저장 실행 기록에 이미 수행한 사건은 남아 있고 사후 날짜 변경으로 지워지지 않는다.

## 8. 선례, 저자와 공식 규칙

적출/반납/D&D 연구, rolling drayage, ALNS, 증분 자원 구성과 상용 반출/반납 예약 매칭에는 선례가 있다. 읽기 깊이와 한계는 `prior-art-v2.md`, `research-roadmap-v4.md`에 있다. 공개 한국 요율과 실행 상태, 강한 예산 비교, 실패 보존 및 독립 검산을 결합한 확인 가능한 응용을 주장한다. 최초·세계 최고·PNC 배치·실현 기업 절감·1위 확률은 주장하지 않는다.

본회차 조사·개발·초안은 AI가 자율 수행했다. 사용자 본인이 작성하거나 실험 재현, 원문 검증, 발표 습득을 완료했는지는 확인되지 않았다. `contribution-log-v5.md`는 실제 AI 및 오픈소스 기여를 구분하며 이를 본인 독창적 성과로 대신 기재하지 않는다.

[2026 공식 페이지](https://anchor.changwon.ac.kr/main/menu?gc=Program&do=sinform&spod=s1&program_id=VKoDUNlZwONq&psin_id=VKoDUNlMqh4n)는 11월 6일 18:00 자료 마감, 11월 13일 1차심사, 11월 20일 발표, 보고서 및 전 데이터/코드, 발표자료 ≤20쪽을 명시한다. 10월13일 재확인에서 페이지와 포스터는 동일했고 AI, 당해 창작 서약, 단독 팀, 영어, 점수표에 새 공개 설명은 없었다. 정원 40명은 총 정원이지 남은 자리 수가 아니다. 2025 직접 창작·대리 작성 금지 서약은 역사 근거이고 2026 적용/AI 해석은 미확인이다. 이 자료는 가입·등록·작성자 승인 기록이 아니다.

## 9. 재현과 파일 연결

```bash
node scripts/benchmark-v5.mjs --output artifacts/benchmark-v5-reproduction.json
node scripts/rolling-benchmark-v5.mjs --output artifacts/rolling-v5-reproduction.json
python scripts/certify-v5.py --archive artifacts/benchmark-v5-reproduction.json
python scripts/build-defense-v5.py --require-results
```

원래 first-run archive를 덮어쓰지 않는다. 다시 실행한 결과는 계산 부하에 따라 달라질 수 있으며 원래 수치와 혼합하지 않는다. 이 생성기는 명명된 저장 V5 데이터에만 연결되고 실험을 실행하지 않는다. 아래 해시는 생성일이 아닌 실제 파일 바이트를 식별한다.

| 원자료 | SHA-256 |
| --- | --- |
| protocol-v5.json | `7cfee99b5522236c3fd70a13b4fcbf11e2273d0c0cd3dd887465608c1f1c2109` |
| benchmark-v5.json | `d04e704749b8b93449aaa6ce8270959a52c4d9eefdb21926e37c7ff694ee754e` |
| rolling-v5.json | `482f6f8df7f0d46cf7d8b0356961c1aaf787f5e9f1566db7e18ce7c1afa23592` |
| certificate-input-v5.json | `2da426c32bf0eebb501c8ed97af2c51a1f63e4b549415faf9fc750335e372639` |
| certificate-v5.json | `70744bf584ba3a6709a24b02b90428f4f55217eb07adf9dcfc7fe5c88e6021fb` |

16쪽 HTML: `docs/defense-v5.ko.html`. 이해용 영문: `docs/defense-v5.en.md`. V4 파일은 보존한다. 발표 자격 및 본인 기여를 확인하기 전 연구자료 초안으로 유지한다.
