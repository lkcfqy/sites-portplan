# PortPlan V8 · 오늘의 반출·적출·반납 결정

AI 작성 초안. 참가자 본인의 창작·검증·이해·참가자격 확인서가 아닙니다.

공식 완결 결과와 별도 Python 검산이 동일한 원본 SHA-256에 연결된 뒤 작성했습니다. 합성 일 단위 모형 연구이며 기업 실현 절감액이 아닙니다.

## 01. 오늘 어떤 컨테이너를 반출하고, 언제 적출·반납해야 할까요?

사용자: 알려진 수입 컨테이너와 일별 운송·창고를 함께 조정하는 계획 담당자. PortPlan은 요율 조회를 완전한 날짜 계획과 실행 이력으로 연결합니다.

반출 결정 → 창고 적출 → 공컨테이너 반납

V8의 완주 개선 가설은 지지되지 않았습니다. 동일분포 V8 80/216 vs V7 156/216; 스트레스 V8 48/216 vs V7 89/216. 제품 기능 추가를 알고리즘 성능 개선이나 기업 실현 절감으로 바꾸어 주장하지 않습니다.

## 02. 세 행동은 같은 자원을 공유합니다.

반출과 반납은 각각 운송 작업을 사용합니다. 적출은 여러 날 연속 점유할 수 있으며, 반출부터 반납 전까지 체류 공간을 사용합니다.

| 행동/상태 | 공유 자원 | 지킬 제약 |
| --- | --- | --- |
| 반출 p | 운송 작업 | 방출 가능일 이후 |
| 적출 u | 연속 창고 점유 | 완료가 납기 이내 |
| 반납 r | 운송 작업 | 적출 완료와 반납 지연 이후 |
| 체류 [p,r) | staging | 계획기간 내 모든 날짜의 용량 |

일 단위 원자적 실행 모델입니다. 도로 경로·예약 슬롯·기사 근무시간·신규 주문 도착은 모델링하지 않았습니다.

## 03. 가격을 먼저 정확히 계산하고, 전체 계획에서 선택합니다.

PNC 공개 표준 보관료의 최고 도달 구간 소급 방식과 Maersk 한국 표준 D&D 해석을 함께 계산합니다. 한 상자의 요금 노출은 전체 계획의 지연 비용과 다릅니다.

공식 요율·기산일 → 완전한 날짜 후보 → 비용·자원·잠금 재검사

개별 계약·실제 청구서·세금·운송비·창고 임차료는 확인하지 않았습니다. 목표는 두 요금의 선언된 부분 문제입니다.

## 04. G0: 실패를 모두 같은 문제로 취급하지 않습니다.

기존 V7 36개 중 9개 실패를 독립 Python trip 모델로 사후 진단했습니다. D0 실패 7개, 실행 이후 실패 2개입니다.

| 진단 층 | 가능 | 불가능 | 미결 |
| --- | --- | --- | --- |
| nominalFromStart | 5 | 4 | 0 |
| observedExecutedPrefix | 4 | 5 | 0 |
| actualHindsightFromStart | 3 | 6 | 0 |
| actualHindsightExecutedPrefix | 3 | 6 | 0 |

36개 층 요청 / 중복 제외 22개 모델. 추가 오프라인 진단 예산이며 온라인 성과가 아닙니다.

## 05. G0는 개선 가능한 대상을 구체적으로 좁힙니다.

실제 미래를 전부 알아도 불가능한 기존 실패는 6개입니다. 원래 자원·납기 모델이 같다면 전체 완주 상한은 30/36 이하입니다.

| 기존 실패 분류 | 사례 수 |
| --- | --- |
| nominal_infeasible_from_start | 4 |
| actual_hindsight_and_observed_prefix_infeasible | 1 |
| observed_prefix_feasible_online_search_miss | 4 |

G0 사후 진단 자체는 원 알고리즘 가시간 실험이 아닙니다. 이후 원 seed·고정 V7 코드의 추가 예산 탐침은 별도 개발 결과로 보고합니다. 기존 입력은 새 holdout이 아닙니다.

## 06. 같은 실행 이력의 개발 검사에서도 단순 기준과 비교합니다.

동일 snapshot 개발 28개, 전체 호출 392개를 별도 검사했습니다. V8과 단순 유지의 적시 공동 63쌍: 더 저렴/동일/더 비쌈 0/63/0.

| 개발 방법 | 적시 완전 / 시도 | 늦은 완전 후보 | 적시 후보 날짜 변경 |
| --- | --- | --- | --- |
| 단순 유지/복구 | 63/72 | 3 | 750 |
| 매번 다듬기/복구 | 63/72 | 3 | 1146 |
| 매번 재구성 | 51/72 | 15 | 2034 |
| V8 조건부 결정 | 63/72 | 0 | 750 |

warm 동일 이력 개발 검사입니다. 이 결과에서 V8이 단순 유지보다 낫다고 주장하지 않습니다. 날짜 변경 감소는 더 비싼 요금과 함께 나타날 수 있으며 냉 전체 episode와 합치지 않습니다. 원 seed 추가 예산 8회: 1,000ms에서만 적시 완전 1개, 양쪽 미완료 3개. 원래 내부 cache의 정확한 재현은 아닙니다.

## 07. V8: 유효한 계획을 유지하고, 필요할 때만 개선·복구합니다.

현재 계획을 잠금과 자원으로 재검사합니다. 유효하면 비용 기회를 확인하고 날짜 변경·단기 압력 보호를 적용합니다. 무효이면 잠금 복구를 시도합니다.

현재 계획 유효? / 예 → 유지/조건부 개선 → 무효 → 잠금 복구 → 완전 후보만 수락

단기 압력은 현재 명목 예측의 대리 지표입니다. 미래 완주 보장·전체 경로 비용 비증가·전역 최적 증명이 아닙니다.

## 08. 분모와 반복을 먼저 고정했습니다.

144개 업무 시나리오 × 5개 정책 × 3개 알고리즘/타이밍 반복 = 2,160개 episode. 반복은 새로운 업무 시나리오가 아닙니다.

| 패널 | 시나리오 | 범위 |
| --- | --- | --- |
| 동일 생성분포 · 새 시드 | 72 | 기존 생성기와 충격 유형, 새로운 독립 생성 시드 |
| 새 충격 스트레스 | 72 | 반복 감소·미공지 회복 지연·연속 자원 충격·점진 회복; 모든 초기 주문은 알려짐 |

전체 냉 episode 부모 기한 5,000ms. 초기화·실행·IPC·부모 검사를 포함합니다. 호출별 내부 시계는 같지 않습니다.

## 09. 동일 생성분포 · 새 시드 먼저 완주와 미확보 이력을 확인합니다.

완주는 모든 물리 행동과 최종 검사까지 기한 내 수락한 경우입니다. 미확보 이력은 물리적으로 실패했다고 단정하지 않습니다.

| 정책 | 완주 episode / 전체 | 세 반복 모두 완주 시나리오 | 미확보 이력 |
| --- | --- | --- | --- |
| V5 유효 계획 유지 | 120 / 216 | 40 | 0 |
| V6 실행 잠금 복구 | 156 / 216 | 52 | 0 |
| V7 비용 다듬기 | 156 / 216 | 52 | 0 |
| V8 조건부 의사결정 | 80 / 216 | 25 | 0 |
| 독립 native HiGHS | 166 / 216 | 55 | 0 |

막대는 episode 완주 수입니다. 세 반복 모두 완주한 시나리오 수와 미확보 이력도 함께 표시합니다.

## 10. 동일 생성분포 · 새 시드 같은 사례의 완주 쌍만 요금을 비교합니다.

양수는 후보가 더 저렴합니다. 시나리오별로 일치하는 완주 반복의 평균을 먼저 구하고 시나리오를 동일 가중합니다.

| 후보 / 기준 | 시나리오 / 쌍 | 총요금 절감 | 추가요금 절감 | 낮음/동일/높음 |
| --- | --- | --- | --- | --- |
| V8 조건부 의사결정 / V7 비용 다듬기 | 28 / 80 | -0.05% | -0.09% | 0/26/2 |
| V8 조건부 의사결정 / V5 유효 계획 유지 | 28 / 80 | -0.05% | -0.08% | 0/27/1 |
| V8 조건부 의사결정 / V6 실행 잠금 복구 | 28 / 80 | 0.22% | 0.37% | 1/26/1 |
| V8 조건부 의사결정 / 독립 native HiGHS | 28 / 80 | -0.35% | -0.61% | 1/19/8 |
| 독립 native HiGHS / V7 비용 다듬기 | 49 / 147 | 5.69% | 9.96% | 26/22/1 |

비교마다 분모가 다릅니다. 총/추가 요금의 원화 분모·영 비용·모든 악화 ID·구간은 보고서에 공개합니다. 실패 요금은 null입니다.

## 11. 새 충격 스트레스 먼저 완주와 미확보 이력을 확인합니다.

완주는 모든 물리 행동과 최종 검사까지 기한 내 수락한 경우입니다. 미확보 이력은 물리적으로 실패했다고 단정하지 않습니다.

| 정책 | 완주 episode / 전체 | 세 반복 모두 완주 시나리오 | 미확보 이력 |
| --- | --- | --- | --- |
| V5 유효 계획 유지 | 66 / 216 | 22 | 0 |
| V6 실행 잠금 복구 | 92 / 216 | 30 | 0 |
| V7 비용 다듬기 | 89 / 216 | 29 | 0 |
| V8 조건부 의사결정 | 48 / 216 | 16 | 0 |
| 독립 native HiGHS | 116 / 216 | 38 | 0 |

막대는 episode 완주 수입니다. 세 반복 모두 완주한 시나리오 수와 미확보 이력도 함께 표시합니다.

## 12. 새 충격 스트레스 같은 사례의 완주 쌍만 요금을 비교합니다.

양수는 후보가 더 저렴합니다. 시나리오별로 일치하는 완주 반복의 평균을 먼저 구하고 시나리오를 동일 가중합니다.

| 후보 / 기준 | 시나리오 / 쌍 | 총요금 절감 | 추가요금 절감 | 낮음/동일/높음 |
| --- | --- | --- | --- | --- |
| V8 조건부 의사결정 / V7 비용 다듬기 | 16 / 48 | 0.00% | 0.00% | 0/16/0 |
| V8 조건부 의사결정 / V5 유효 계획 유지 | 16 / 48 | 0.00% | 0.00% | 0/16/0 |
| V8 조건부 의사결정 / V6 실행 잠금 복구 | 16 / 48 | 0.00% | 0.00% | 0/16/0 |
| V8 조건부 의사결정 / 독립 native HiGHS | 16 / 48 | 0.57% | 0.90% | 2/9/5 |
| 독립 native HiGHS / V7 비용 다듬기 | 28 / 82 | 6.43% | 10.65% | 16/10/2 |

비교마다 분모가 다릅니다. 총/추가 요금의 원화 분모·영 비용·모든 악화 ID·구간은 보고서에 공개합니다. 실패 요금은 null입니다.

## 13. 불리한 결과도 같은 화면에 남깁니다.

표의 완주 증감은 episode 기준입니다. 최악 요금 악화는 비교 가능한 시나리오 평균 기준입니다. 단위와 분모를 바꿔 섞지 않습니다.

| 패널 | 비교 | 총요금 악화 시나리오 | 최악 증가 ₩ | 완주 얻음/잃음 |
| --- | --- | --- | --- | --- |
| same-distribution | adaptiveVsV7 | 2 | 53,350 | 0 / 76 |
| same-distribution | adaptiveVsV5 | 1 | 53,350 | 0 / 40 |
| same-distribution | adaptiveVsV6 | 1 | 53,350 | 0 / 76 |
| same-distribution | adaptiveVsHiGHS | 8 | 153,350 | 0 / 86 |
| same-distribution | highsVsV7 | 1 | 7,300 | 19 / 9 |
| stress | adaptiveVsV7 | 0 | 0 | 0 / 41 |
| stress | adaptiveVsV5 | 0 | 0 | 0 / 18 |
| stress | adaptiveVsV6 | 0 | 0 | 0 / 44 |
| stress | adaptiveVsHiGHS | 5 | 40,000 | 0 / 68 |
| stress | highsVsV7 | 2 | 235,000 | 34 / 7 |

전체 악화·완주 손실 ID는 보고서에 보존합니다. HiGHS/V7 공통 완주 쌍의 날짜 변경: 동일 생성분포 · 새 시드 6,300→49,350 (147쌍); 새 충격 스트레스 9,394→29,876 (82쌍). 더 많은 완주·조건부 요금 개선과 변경 대가를 함께 봅니다.

## 14. 계산 기한과 날짜 변경의 대가도 공개합니다.

날짜 변경은 미실행 사건 날짜의 변경 횟수입니다. 작업자 시간·재배차 비용·서로 다른 컨테이너 수로 해석하지 않습니다.

| 패널 | 정책 | 평균 부모 ms | 강제 기한 | 관측 변경 / 미확보 episode |
| --- | --- | --- | --- | --- |
| same-distribution | V5 유효 계획 유지 | 286.6 | 0 | 3674 / 0 |
| same-distribution | V6 실행 잠금 복구 | 299.5 | 0 | 7590 / 0 |
| same-distribution | V7 비용 다듬기 | 310.1 | 0 | 7335 / 0 |
| same-distribution | V8 조건부 의사결정 | 246.5 | 0 | 1563 / 0 |
| same-distribution | 독립 native HiGHS | 587.2 | 0 | 55792 / 0 |
| stress | V5 유효 계획 유지 | 308.5 | 0 | 5740 / 0 |
| stress | V6 실행 잠금 복구 | 373.1 | 0 | 15175 / 0 |
| stress | V7 비용 다듬기 | 378.4 | 0 | 14034 / 0 |
| stress | V8 조건부 의사결정 | 253.8 | 0 | 2659 / 0 |
| stress | 독립 native HiGHS | 560.6 | 0 | 53715 / 0 |

HiGHS native 시작도 전체 부모 기한에 포함됩니다. 중간 호출은 협력식 예산이며, 동일 CPU 또는 절대 실시간 보장은 주장하지 않습니다.

## 15. 독립 구현은 무엇을 확인했을까요?

Python 장부가 2,160개 episode, 수락 계획 16,400개, 기록된 물리 행동 211,673개를 재구성했습니다. 완주 1,089개와 이력 미확보 0개를 구분했습니다.

| 확인한 범위 | 경계 |
| --- | --- |
| 요율·일별 자원·실행 잠금 | JS 행렬을 재사용하지 않는 내부 독립 구현 |
| V8 후보 수락 및 점추정 | 공식 결과의 독립 재계산 |
| scenario-cluster bootstrap 구간 | 별도 Python 통계 검산에서 동일 원본의 구간을 재계산함 |
| 현장 효과·전역 최적·제3자 인증 | 확인하지 않음 |

구간은 완주 쌍에 조건부인 시나리오 cluster bootstrap입니다. 완주 선택 편향을 제거하지 않으며 관측 밖 운영 집단에 외삽하지 않습니다.

## 16. 내 입력으로 성공과 중단을 직접 확인할 수 있습니다.

작업대 주문 가져오기 → 모의 용량 사건 설정 → 두 정책 순차 실행 → 날짜별 관측·잠금·권고·실패 검사 → 정확한 입력/결과 내보내기.

주문 + 명시적 가정 → 당일 정보·실행 잠금 → 권고 + 실패 + 내보내기

화면의 10개 주문 완주/중단 예시는 합성 학습용입니다. 공식 연구 시나리오나 실제 현장 실적이 아닙니다. 변경한 용량 가정은 이전 입력과 비교 표시합니다.

## 17. 증거와 기여의 경계를 끝까지 유지합니다.

핵심은 알려진 합성 주문의 일별 비용·완주·안정성입니다. 공개 PSPLIB 자원 모델과 벌크항만 로그는 별도의 부분 검증이며 실제 컨테이너 절감으로 합치지 않습니다.

| 주체/주장 | 현재 상태 |
| --- | --- |
| 설계·구현·실험·자료 작성 | AI 수행; 원 연구·공개 코드·라이선스 귀속 유지 |
| 사용자 본인 개발·검증·답변 숙련 | pending · 대신 인정하지 않음 |
| 전문가·기업 검증, 현장 비용 절감 | 미수행 |
| 개인 참가·AI 해석·등록/서약 | 본 자료로 확인하지 않음 |

알고리즘 최초·SOTA·모든 경우 우월·현실 ROI·우승 확률을 주장하지 않습니다.

## 18. 심사위원이 같은 결정을 다시 계산할 수 있게 전달합니다.

전체 입력·모든 반복·실패·실행 장부·고정 source·독립 검산·모든 악화 ID를 연결합니다. 새 재현은 새 출력 경로에 기록하며 최초 결과를 덮어쓰지 않습니다.

| 자료 | 찾을 내용 |
| --- | --- |
| 한국어 보고서 | 정확한 분모·원화·구간·모든 불리한 ID |
| 영어 이해 노트 | 발표 주제별 가정·결과·한계 |
| 기여 기록 | AI와 사용자 미확인 상태 |
| V8 formal archive + review | 해시로 연결된 원 입력·모든 episode·독립 검사 |

발표는 오늘의 결정 → 세 행동 → 실제 진단 → 고정 실험 → 손실·한계 → 직접 재현 순서로 진행합니다. 이 자료는 제출이나 서명이 아닙니다.

## 정확한 요금·완주 분모·구간·악화 목록

절감 = 기준 − 후보. 각 시나리오에서 일치한 완주 반복만 평균한 후 시나리오를 동일 가중합니다. 총요금과 추가요금의 원화 분모가 다릅니다. 0원 분모의 비율은 null입니다.
구간은 percentile scenario-cluster bootstrap입니다. 구간은 동일 formal index의 별도 Python 통계 검산에서 독립 재계산했습니다. 물리·요율 검산과는 별도이며 완주 쌍 선택 편향은 남습니다.

### 동일 생성분포 · 새 시드

#### adaptiveVsV7 · V8 조건부 의사결정 / V7 비용 다듬기

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 시나리오 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 28 / 80 | 107,913,100.00 | 107,969,400.00 | -56,300.00 | -0.05% | 0/26/2 | 53,350.00 | 10 / 30 | [-0.15, 0.00] |
| incremental | 28 / 80 | 62,844,150.00 | 62,900,450.00 | -56,300.00 | -0.09% | 0/26/2 | 53,350.00 | 10 / 30 | [-0.27, 0.00] |

완주 얻음/잃음 episode: 0 / 76. 시나리오 평균 완주율 차이: -0.351852; 독립 검산 95% 구간: [-0.46, -0.25].
비교 가능한 날짜 변경: 1346 → 1371; 80쌍.

total 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 273,389,050.00 ₩ / 후보 273,448,300.00 ₩.

**total / negativeScenarioIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2`
- `v8-same-distribution-batch-release-balanced-n100-r4`

**total / negativeEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`
- `v8-same-distribution-batch-release-balanced-n100-r4::repeat-3`

incremental 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 162,857,600.00 ₩ / 후보 162,916,850.00 ₩.

**incremental / negativeScenarioIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2`
- `v8-same-distribution-batch-release-balanced-n100-r4`

**incremental / negativeEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`
- `v8-same-distribution-batch-release-balanced-n100-r4::repeat-3`

**gainedEpisodeIds — 전체 보존**

없음.

**lostEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n50-r1::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r1::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r1::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r3::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r3::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r3::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n50-r4::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r4::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r4::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n50-r1::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n50-r1::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n50-r1::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n50-r3::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n50-r3::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n50-r3::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n100-r2::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n100-r2::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n100-r2::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v8-same-distribution-batch-release-balanced-n100-r1::repeat-1`
- `v8-same-distribution-batch-release-balanced-n100-r3::repeat-1`
- `v8-same-distribution-batch-release-balanced-n100-r3::repeat-2`
- `v8-same-distribution-batch-release-balanced-n100-r3::repeat-3`
- `v8-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r1::repeat-1`
- `v8-same-distribution-batch-release-tight-n24-r1::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r1::repeat-3`
- `v8-same-distribution-batch-release-tight-n24-r3::repeat-1`
- `v8-same-distribution-batch-release-tight-n24-r3::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r3::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r1::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r3::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r3::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r3::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r4::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r4::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r4::repeat-3`
- `v8-same-distribution-batch-release-tight-n100-r1::repeat-1`
- `v8-same-distribution-batch-release-tight-n100-r1::repeat-2`
- `v8-same-distribution-batch-release-tight-n100-r1::repeat-3`
- `v8-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v8-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v8-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v8-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v8-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v8-same-distribution-batch-release-tight-n100-r3::repeat-3`
- `v8-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v8-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v8-same-distribution-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

없음.

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### adaptiveVsV5 · V8 조건부 의사결정 / V5 유효 계획 유지

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 시나리오 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 28 / 80 | 107,916,050.00 | 107,969,400.00 | -53,350.00 | -0.05% | 0/27/1 | 53,350.00 | 10 / 30 | [-0.14, 0.00] |
| incremental | 28 / 80 | 62,847,100.00 | 62,900,450.00 | -53,350.00 | -0.08% | 0/27/1 | 53,350.00 | 10 / 30 | [-0.26, 0.00] |

완주 얻음/잃음 episode: 0 / 40. 시나리오 평균 완주율 차이: -0.185185; 독립 검산 95% 구간: [-0.27, -0.10].
비교 가능한 날짜 변경: 1339 → 1371; 80쌍.

total 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 273,394,950.00 ₩ / 후보 273,448,300.00 ₩.

**total / negativeScenarioIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2`

**total / negativeEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`

incremental 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 162,863,500.00 ₩ / 후보 162,916,850.00 ₩.

**incremental / negativeScenarioIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2`

**incremental / negativeEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`

**gainedEpisodeIds — 전체 보존**

없음.

**lostEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n50-r1::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r1::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r1::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r3::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r3::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r3::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n50-r4::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r4::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r4::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n50-r1::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n50-r1::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n50-r1::repeat-3`
- `v8-same-distribution-batch-release-balanced-n100-r1::repeat-1`
- `v8-same-distribution-batch-release-balanced-n100-r3::repeat-1`
- `v8-same-distribution-batch-release-balanced-n100-r3::repeat-2`
- `v8-same-distribution-batch-release-balanced-n100-r3::repeat-3`
- `v8-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r1::repeat-1`
- `v8-same-distribution-batch-release-tight-n24-r1::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r1::repeat-3`
- `v8-same-distribution-batch-release-tight-n24-r3::repeat-1`
- `v8-same-distribution-batch-release-tight-n24-r3::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r3::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r1::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r3::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r3::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r3::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

없음.

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### adaptiveVsV6 · V8 조건부 의사결정 / V6 실행 잠금 복구

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 시나리오 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 28 / 80 | 108,203,650.00 | 107,969,400.00 | 234,250.00 | 0.22% | 1/26/1 | 53,350.00 | 10 / 30 | [-0.14, 0.87] |
| incremental | 28 / 80 | 63,134,700.00 | 62,900,450.00 | 234,250.00 | 0.37% | 1/26/1 | 53,350.00 | 10 / 30 | [-0.25, 1.43] |

완주 얻음/잃음 episode: 0 / 76. 시나리오 평균 완주율 차이: -0.351852; 독립 검산 95% 구간: [-0.46, -0.25].
비교 가능한 날짜 변경: 1382 → 1371; 80쌍.

total 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 274,257,750.00 ₩ / 후보 273,448,300.00 ₩.

**total / negativeScenarioIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2`

**total / negativeEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`

incremental 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 163,726,300.00 ₩ / 후보 162,916,850.00 ₩.

**incremental / negativeScenarioIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2`

**incremental / negativeEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`

**gainedEpisodeIds — 전체 보존**

없음.

**lostEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n50-r1::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r1::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r1::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r3::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r3::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r3::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n50-r4::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r4::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r4::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n50-r1::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n50-r1::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n50-r1::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n50-r3::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n50-r3::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n50-r3::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n100-r2::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n100-r2::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n100-r2::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v8-same-distribution-batch-release-balanced-n100-r1::repeat-1`
- `v8-same-distribution-batch-release-balanced-n100-r3::repeat-1`
- `v8-same-distribution-batch-release-balanced-n100-r3::repeat-2`
- `v8-same-distribution-batch-release-balanced-n100-r3::repeat-3`
- `v8-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r1::repeat-1`
- `v8-same-distribution-batch-release-tight-n24-r1::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r1::repeat-3`
- `v8-same-distribution-batch-release-tight-n24-r3::repeat-1`
- `v8-same-distribution-batch-release-tight-n24-r3::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r3::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r1::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r3::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r3::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r3::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r4::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r4::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r4::repeat-3`
- `v8-same-distribution-batch-release-tight-n100-r1::repeat-1`
- `v8-same-distribution-batch-release-tight-n100-r1::repeat-2`
- `v8-same-distribution-batch-release-tight-n100-r1::repeat-3`
- `v8-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v8-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v8-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v8-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v8-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v8-same-distribution-batch-release-tight-n100-r3::repeat-3`
- `v8-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v8-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v8-same-distribution-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

없음.

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### adaptiveVsHiGHS · V8 조건부 의사결정 / 독립 native HiGHS

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 시나리오 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 28 / 80 | 107,589,950.00 | 107,969,400.00 | -379,450.00 | -0.35% | 1/19/8 | 153,350.00 | 12 / 36 | [-1.01, -0.09] |
| incremental | 28 / 80 | 62,521,000.00 | 62,900,450.00 | -379,450.00 | -0.61% | 1/19/8 | 153,350.00 | 12 / 36 | [-1.67, -0.15] |

완주 얻음/잃음 episode: 0 / 86. 시나리오 평균 완주율 차이: -0.398148; 독립 검산 95% 구간: [-0.51, -0.29].
비교 가능한 날짜 변경: 25827 → 1371; 80쌍.

total 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 272,649,850.00 ₩ / 후보 273,448,300.00 ₩.

**total / negativeScenarioIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2`
- `v8-same-distribution-new-arrivals-balanced-n24-r3`
- `v8-same-distribution-new-arrivals-tight-n24-r1`
- `v8-same-distribution-new-arrivals-tight-n24-r3`
- `v8-same-distribution-batch-release-balanced-n24-r4`
- `v8-same-distribution-batch-release-balanced-n50-r3`
- `v8-same-distribution-batch-release-balanced-n50-r4`
- `v8-same-distribution-batch-release-balanced-n100-r4`

**total / negativeEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`
- `v8-same-distribution-new-arrivals-balanced-n24-r3::repeat-1`
- `v8-same-distribution-new-arrivals-balanced-n24-r3::repeat-2`
- `v8-same-distribution-new-arrivals-balanced-n24-r3::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n24-r1::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n24-r1::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n24-r1::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v8-same-distribution-batch-release-balanced-n24-r4::repeat-1`
- `v8-same-distribution-batch-release-balanced-n24-r4::repeat-2`
- `v8-same-distribution-batch-release-balanced-n24-r4::repeat-3`
- `v8-same-distribution-batch-release-balanced-n50-r3::repeat-1`
- `v8-same-distribution-batch-release-balanced-n50-r3::repeat-2`
- `v8-same-distribution-batch-release-balanced-n50-r3::repeat-3`
- `v8-same-distribution-batch-release-balanced-n50-r4::repeat-1`
- `v8-same-distribution-batch-release-balanced-n50-r4::repeat-2`
- `v8-same-distribution-batch-release-balanced-n50-r4::repeat-3`
- `v8-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v8-same-distribution-batch-release-balanced-n100-r4::repeat-3`

incremental 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 162,118,400.00 ₩ / 후보 162,916,850.00 ₩.

**incremental / negativeScenarioIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2`
- `v8-same-distribution-new-arrivals-balanced-n24-r3`
- `v8-same-distribution-new-arrivals-tight-n24-r1`
- `v8-same-distribution-new-arrivals-tight-n24-r3`
- `v8-same-distribution-batch-release-balanced-n24-r4`
- `v8-same-distribution-batch-release-balanced-n50-r3`
- `v8-same-distribution-batch-release-balanced-n50-r4`
- `v8-same-distribution-batch-release-balanced-n100-r4`

**incremental / negativeEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`
- `v8-same-distribution-new-arrivals-balanced-n24-r3::repeat-1`
- `v8-same-distribution-new-arrivals-balanced-n24-r3::repeat-2`
- `v8-same-distribution-new-arrivals-balanced-n24-r3::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n24-r1::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n24-r1::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n24-r1::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v8-same-distribution-batch-release-balanced-n24-r4::repeat-1`
- `v8-same-distribution-batch-release-balanced-n24-r4::repeat-2`
- `v8-same-distribution-batch-release-balanced-n24-r4::repeat-3`
- `v8-same-distribution-batch-release-balanced-n50-r3::repeat-1`
- `v8-same-distribution-batch-release-balanced-n50-r3::repeat-2`
- `v8-same-distribution-batch-release-balanced-n50-r3::repeat-3`
- `v8-same-distribution-batch-release-balanced-n50-r4::repeat-1`
- `v8-same-distribution-batch-release-balanced-n50-r4::repeat-2`
- `v8-same-distribution-batch-release-balanced-n50-r4::repeat-3`
- `v8-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v8-same-distribution-batch-release-balanced-n100-r4::repeat-3`

**gainedEpisodeIds — 전체 보존**

없음.

**lostEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n50-r1::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r1::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r1::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r3::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r3::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r3::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n50-r4::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n50-r4::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n50-r4::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v8-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v8-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v8-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v8-same-distribution-new-arrivals-balanced-n24-r1::repeat-1`
- `v8-same-distribution-new-arrivals-balanced-n24-r1::repeat-2`
- `v8-same-distribution-new-arrivals-balanced-n24-r1::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n24-r2::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n24-r2::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n24-r2::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n50-r1::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n50-r1::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n50-r1::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n100-r2::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n100-r2::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n100-r2::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v8-same-distribution-batch-release-balanced-n24-r2::repeat-1`
- `v8-same-distribution-batch-release-balanced-n24-r2::repeat-2`
- `v8-same-distribution-batch-release-balanced-n24-r2::repeat-3`
- `v8-same-distribution-batch-release-balanced-n100-r1::repeat-1`
- `v8-same-distribution-batch-release-balanced-n100-r3::repeat-1`
- `v8-same-distribution-batch-release-balanced-n100-r3::repeat-2`
- `v8-same-distribution-batch-release-balanced-n100-r3::repeat-3`
- `v8-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r1::repeat-1`
- `v8-same-distribution-batch-release-tight-n24-r1::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r1::repeat-3`
- `v8-same-distribution-batch-release-tight-n24-r3::repeat-1`
- `v8-same-distribution-batch-release-tight-n24-r3::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r3::repeat-3`
- `v8-same-distribution-batch-release-tight-n24-r4::repeat-1`
- `v8-same-distribution-batch-release-tight-n24-r4::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r4::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r1::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r3::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r3::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r3::repeat-3`
- `v8-same-distribution-batch-release-tight-n50-r4::repeat-1`
- `v8-same-distribution-batch-release-tight-n50-r4::repeat-2`
- `v8-same-distribution-batch-release-tight-n50-r4::repeat-3`
- `v8-same-distribution-batch-release-tight-n100-r1::repeat-1`
- `v8-same-distribution-batch-release-tight-n100-r1::repeat-2`
- `v8-same-distribution-batch-release-tight-n100-r1::repeat-3`
- `v8-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v8-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v8-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v8-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v8-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v8-same-distribution-batch-release-tight-n100-r3::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

없음.

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### highsVsV7 · 독립 native HiGHS / V7 비용 다듬기

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 시나리오 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 49 / 147 | 474,457,350.00 | 447,472,050.00 | 26,985,300.00 | 5.69% | 26/22/1 | 7,300.00 | 13 / 39 | [3.55, 8.20] |
| incremental | 49 / 147 | 270,890,550.00 | 243,905,250.00 | 26,985,300.00 | 9.96% | 26/22/1 | 7,300.00 | 13 / 39 | [6.25, 13.84] |

완주 얻음/잃음 episode: 19 / 9. 시나리오 평균 완주율 차이: 0.046296; 독립 검산 95% 구간: [-0.03, 0.13].
비교 가능한 날짜 변경: 6300 → 49350; 147쌍.

total 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 1,423,372,050.00 ₩ / 후보 1,342,416,150.00 ₩.

**total / negativeScenarioIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n24-r3`

**total / negativeEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n24-r3::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n24-r3::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n24-r3::repeat-3`

incremental 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 812,671,650.00 ₩ / 후보 731,715,750.00 ₩.

**incremental / negativeScenarioIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n24-r3`

**incremental / negativeEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v8-same-distribution-aged-backlog-balanced-n24-r3::repeat-1`
- `v8-same-distribution-aged-backlog-balanced-n24-r3::repeat-2`
- `v8-same-distribution-aged-backlog-balanced-n24-r3::repeat-3`

**gainedEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v8-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v8-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v8-same-distribution-new-arrivals-balanced-n24-r1::repeat-1`
- `v8-same-distribution-new-arrivals-balanced-n24-r1::repeat-2`
- `v8-same-distribution-new-arrivals-balanced-n24-r1::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n24-r2::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n24-r2::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n24-r2::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v8-same-distribution-batch-release-balanced-n24-r2::repeat-1`
- `v8-same-distribution-batch-release-balanced-n24-r2::repeat-2`
- `v8-same-distribution-batch-release-balanced-n24-r2::repeat-3`
- `v8-same-distribution-batch-release-tight-n24-r4::repeat-1`
- `v8-same-distribution-batch-release-tight-n24-r4::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r4::repeat-3`

**lostEpisodeIds — 전체 보존**

- `v8-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n50-r3::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n50-r3::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n50-r3::repeat-3`
- `v8-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v8-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v8-same-distribution-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

- `v8-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v8-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v8-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v8-same-distribution-new-arrivals-balanced-n24-r1::repeat-1`
- `v8-same-distribution-new-arrivals-balanced-n24-r1::repeat-2`
- `v8-same-distribution-new-arrivals-balanced-n24-r1::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n24-r2::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n24-r2::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n24-r2::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v8-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v8-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v8-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v8-same-distribution-batch-release-balanced-n24-r2::repeat-1`
- `v8-same-distribution-batch-release-balanced-n24-r2::repeat-2`
- `v8-same-distribution-batch-release-balanced-n24-r2::repeat-3`
- `v8-same-distribution-batch-release-tight-n24-r4::repeat-1`
- `v8-same-distribution-batch-release-tight-n24-r4::repeat-2`
- `v8-same-distribution-batch-release-tight-n24-r4::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

### 새 충격 스트레스

#### adaptiveVsV7 · V8 조건부 의사결정 / V7 비용 다듬기

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 시나리오 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 16 / 48 | 32,668,650.00 | 32,668,650.00 | 0.00 | 0.00% | 0/16/0 | 0.00 | 4 / 12 | [0.00, 0.00] |
| incremental | 16 / 48 | 20,375,550.00 | 20,375,550.00 | 0.00 | 0.00% | 0/16/0 | 0.00 | 4 / 12 | [0.00, 0.00] |

완주 얻음/잃음 episode: 0 / 41. 시나리오 평균 완주율 차이: -0.189815; 독립 검산 95% 구간: [-0.29, -0.11].
비교 가능한 날짜 변경: 1737 → 1737; 48쌍.

total 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 98,005,950.00 ₩ / 후보 98,005,950.00 ₩.

**total / negativeScenarioIds — 전체 보존**

없음.

**total / negativeEpisodeIds — 전체 보존**

없음.

incremental 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 61,126,650.00 ₩ / 후보 61,126,650.00 ₩.

**incremental / negativeScenarioIds — 전체 보존**

없음.

**incremental / negativeEpisodeIds — 전체 보존**

없음.

**gainedEpisodeIds — 전체 보존**

없음.

**lostEpisodeIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n24-r1::repeat-1`
- `v8-stress-aged-backlog-balanced-n24-r1::repeat-2`
- `v8-stress-aged-backlog-balanced-n24-r1::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r1::repeat-1`
- `v8-stress-aged-backlog-balanced-n50-r1::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r1::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v8-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r4::repeat-1`
- `v8-stress-aged-backlog-balanced-n50-r4::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r4::repeat-3`
- `v8-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v8-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v8-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v8-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v8-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v8-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v8-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v8-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v8-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v8-stress-aged-backlog-balanced-n100-r4::repeat-1`
- `v8-stress-aged-backlog-balanced-n100-r4::repeat-2`
- `v8-stress-aged-backlog-balanced-n100-r4::repeat-3`
- `v8-stress-new-arrivals-tight-n50-r4::repeat-1`
- `v8-stress-new-arrivals-tight-n50-r4::repeat-2`
- `v8-stress-new-arrivals-tight-n50-r4::repeat-3`
- `v8-stress-batch-release-tight-n50-r1::repeat-1`
- `v8-stress-batch-release-tight-n50-r1::repeat-2`
- `v8-stress-batch-release-tight-n50-r1::repeat-3`
- `v8-stress-batch-release-tight-n100-r1::repeat-1`
- `v8-stress-batch-release-tight-n100-r1::repeat-2`
- `v8-stress-batch-release-tight-n100-r1::repeat-3`
- `v8-stress-batch-release-tight-n100-r3::repeat-1`
- `v8-stress-batch-release-tight-n100-r3::repeat-2`
- `v8-stress-batch-release-tight-n100-r3::repeat-3`
- `v8-stress-batch-release-tight-n100-r4::repeat-1`
- `v8-stress-batch-release-tight-n100-r4::repeat-2`
- `v8-stress-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

없음.

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### adaptiveVsV5 · V8 조건부 의사결정 / V5 유효 계획 유지

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 시나리오 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 16 / 48 | 32,668,650.00 | 32,668,650.00 | 0.00 | 0.00% | 0/16/0 | 0.00 | 4 / 12 | [0.00, 0.00] |
| incremental | 16 / 48 | 20,375,550.00 | 20,375,550.00 | 0.00 | 0.00% | 0/16/0 | 0.00 | 4 / 12 | [0.00, 0.00] |

완주 얻음/잃음 episode: 0 / 18. 시나리오 평균 완주율 차이: -0.083333; 독립 검산 95% 구간: [-0.15, -0.03].
비교 가능한 날짜 변경: 1737 → 1737; 48쌍.

total 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 98,005,950.00 ₩ / 후보 98,005,950.00 ₩.

**total / negativeScenarioIds — 전체 보존**

없음.

**total / negativeEpisodeIds — 전체 보존**

없음.

incremental 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 61,126,650.00 ₩ / 후보 61,126,650.00 ₩.

**incremental / negativeScenarioIds — 전체 보존**

없음.

**incremental / negativeEpisodeIds — 전체 보존**

없음.

**gainedEpisodeIds — 전체 보존**

없음.

**lostEpisodeIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n24-r1::repeat-1`
- `v8-stress-aged-backlog-balanced-n24-r1::repeat-2`
- `v8-stress-aged-backlog-balanced-n24-r1::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r1::repeat-1`
- `v8-stress-aged-backlog-balanced-n50-r1::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r1::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v8-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r4::repeat-1`
- `v8-stress-aged-backlog-balanced-n50-r4::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r4::repeat-3`
- `v8-stress-batch-release-tight-n50-r1::repeat-1`
- `v8-stress-batch-release-tight-n50-r1::repeat-2`
- `v8-stress-batch-release-tight-n50-r1::repeat-3`
- `v8-stress-batch-release-tight-n50-r3::repeat-1`
- `v8-stress-batch-release-tight-n50-r3::repeat-2`
- `v8-stress-batch-release-tight-n50-r3::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

없음.

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### adaptiveVsV6 · V8 조건부 의사결정 / V6 실행 잠금 복구

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 시나리오 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 16 / 48 | 32,668,650.00 | 32,668,650.00 | 0.00 | 0.00% | 0/16/0 | 0.00 | 4 / 12 | [0.00, 0.00] |
| incremental | 16 / 48 | 20,375,550.00 | 20,375,550.00 | 0.00 | 0.00% | 0/16/0 | 0.00 | 4 / 12 | [0.00, 0.00] |

완주 얻음/잃음 episode: 0 / 44. 시나리오 평균 완주율 차이: -0.203704; 독립 검산 95% 구간: [-0.30, -0.11].
비교 가능한 날짜 변경: 1737 → 1737; 48쌍.

total 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 98,005,950.00 ₩ / 후보 98,005,950.00 ₩.

**total / negativeScenarioIds — 전체 보존**

없음.

**total / negativeEpisodeIds — 전체 보존**

없음.

incremental 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 61,126,650.00 ₩ / 후보 61,126,650.00 ₩.

**incremental / negativeScenarioIds — 전체 보존**

없음.

**incremental / negativeEpisodeIds — 전체 보존**

없음.

**gainedEpisodeIds — 전체 보존**

없음.

**lostEpisodeIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n24-r1::repeat-1`
- `v8-stress-aged-backlog-balanced-n24-r1::repeat-2`
- `v8-stress-aged-backlog-balanced-n24-r1::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r1::repeat-1`
- `v8-stress-aged-backlog-balanced-n50-r1::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r1::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v8-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v8-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r4::repeat-1`
- `v8-stress-aged-backlog-balanced-n50-r4::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r4::repeat-3`
- `v8-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v8-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v8-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v8-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v8-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v8-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v8-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v8-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v8-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v8-stress-aged-backlog-balanced-n100-r4::repeat-1`
- `v8-stress-aged-backlog-balanced-n100-r4::repeat-2`
- `v8-stress-aged-backlog-balanced-n100-r4::repeat-3`
- `v8-stress-new-arrivals-tight-n50-r4::repeat-1`
- `v8-stress-new-arrivals-tight-n50-r4::repeat-2`
- `v8-stress-new-arrivals-tight-n50-r4::repeat-3`
- `v8-stress-batch-release-tight-n50-r1::repeat-2`
- `v8-stress-batch-release-tight-n50-r1::repeat-3`
- `v8-stress-batch-release-tight-n50-r3::repeat-1`
- `v8-stress-batch-release-tight-n50-r3::repeat-2`
- `v8-stress-batch-release-tight-n50-r3::repeat-3`
- `v8-stress-batch-release-tight-n100-r1::repeat-1`
- `v8-stress-batch-release-tight-n100-r1::repeat-2`
- `v8-stress-batch-release-tight-n100-r1::repeat-3`
- `v8-stress-batch-release-tight-n100-r3::repeat-1`
- `v8-stress-batch-release-tight-n100-r3::repeat-2`
- `v8-stress-batch-release-tight-n100-r3::repeat-3`
- `v8-stress-batch-release-tight-n100-r4::repeat-1`
- `v8-stress-batch-release-tight-n100-r4::repeat-2`
- `v8-stress-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

없음.

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### adaptiveVsHiGHS · V8 조건부 의사결정 / 독립 native HiGHS

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 시나리오 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 16 / 48 | 32,854,550.00 | 32,668,650.00 | 185,900.00 | 0.57% | 2/9/5 | 40,000.00 | 5 / 15 | [-1.10, 1.77] |
| incremental | 16 / 48 | 20,561,450.00 | 20,375,550.00 | 185,900.00 | 0.90% | 2/9/5 | 40,000.00 | 5 / 15 | [-1.36, 2.92] |

완주 얻음/잃음 episode: 0 / 68. 시나리오 평균 완주율 차이: -0.314815; 독립 검산 95% 구간: [-0.43, -0.22].
비교 가능한 날짜 변경: 18825 → 1737; 48쌍.

total 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 98,563,650.00 ₩ / 후보 98,005,950.00 ₩.

**total / negativeScenarioIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n24-r4`
- `v8-stress-new-arrivals-balanced-n24-r1`
- `v8-stress-batch-release-balanced-n50-r2`
- `v8-stress-batch-release-balanced-n50-r3`
- `v8-stress-batch-release-balanced-n100-r1`

**total / negativeEpisodeIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n24-r4::repeat-1`
- `v8-stress-aged-backlog-balanced-n24-r4::repeat-2`
- `v8-stress-aged-backlog-balanced-n24-r4::repeat-3`
- `v8-stress-new-arrivals-balanced-n24-r1::repeat-1`
- `v8-stress-new-arrivals-balanced-n24-r1::repeat-2`
- `v8-stress-new-arrivals-balanced-n24-r1::repeat-3`
- `v8-stress-batch-release-balanced-n50-r2::repeat-1`
- `v8-stress-batch-release-balanced-n50-r2::repeat-2`
- `v8-stress-batch-release-balanced-n50-r2::repeat-3`
- `v8-stress-batch-release-balanced-n50-r3::repeat-1`
- `v8-stress-batch-release-balanced-n50-r3::repeat-2`
- `v8-stress-batch-release-balanced-n50-r3::repeat-3`
- `v8-stress-batch-release-balanced-n100-r1::repeat-1`
- `v8-stress-batch-release-balanced-n100-r1::repeat-2`
- `v8-stress-batch-release-balanced-n100-r1::repeat-3`

incremental 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 61,684,350.00 ₩ / 후보 61,126,650.00 ₩.

**incremental / negativeScenarioIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n24-r4`
- `v8-stress-new-arrivals-balanced-n24-r1`
- `v8-stress-batch-release-balanced-n50-r2`
- `v8-stress-batch-release-balanced-n50-r3`
- `v8-stress-batch-release-balanced-n100-r1`

**incremental / negativeEpisodeIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n24-r4::repeat-1`
- `v8-stress-aged-backlog-balanced-n24-r4::repeat-2`
- `v8-stress-aged-backlog-balanced-n24-r4::repeat-3`
- `v8-stress-new-arrivals-balanced-n24-r1::repeat-1`
- `v8-stress-new-arrivals-balanced-n24-r1::repeat-2`
- `v8-stress-new-arrivals-balanced-n24-r1::repeat-3`
- `v8-stress-batch-release-balanced-n50-r2::repeat-1`
- `v8-stress-batch-release-balanced-n50-r2::repeat-2`
- `v8-stress-batch-release-balanced-n50-r2::repeat-3`
- `v8-stress-batch-release-balanced-n50-r3::repeat-1`
- `v8-stress-batch-release-balanced-n50-r3::repeat-2`
- `v8-stress-batch-release-balanced-n50-r3::repeat-3`
- `v8-stress-batch-release-balanced-n100-r1::repeat-1`
- `v8-stress-batch-release-balanced-n100-r1::repeat-2`
- `v8-stress-batch-release-balanced-n100-r1::repeat-3`

**gainedEpisodeIds — 전체 보존**

없음.

**lostEpisodeIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n24-r1::repeat-1`
- `v8-stress-aged-backlog-balanced-n24-r1::repeat-2`
- `v8-stress-aged-backlog-balanced-n24-r1::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r1::repeat-1`
- `v8-stress-aged-backlog-balanced-n50-r1::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r1::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v8-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v8-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v8-stress-aged-backlog-balanced-n50-r4::repeat-1`
- `v8-stress-aged-backlog-balanced-n50-r4::repeat-2`
- `v8-stress-aged-backlog-balanced-n50-r4::repeat-3`
- `v8-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v8-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v8-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v8-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v8-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v8-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v8-stress-new-arrivals-balanced-n24-r4::repeat-1`
- `v8-stress-new-arrivals-balanced-n24-r4::repeat-2`
- `v8-stress-new-arrivals-balanced-n24-r4::repeat-3`
- `v8-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v8-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v8-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v8-stress-new-arrivals-balanced-n50-r4::repeat-1`
- `v8-stress-new-arrivals-balanced-n50-r4::repeat-2`
- `v8-stress-new-arrivals-balanced-n50-r4::repeat-3`
- `v8-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v8-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v8-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v8-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v8-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v8-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v8-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v8-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v8-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v8-stress-new-arrivals-tight-n50-r4::repeat-2`
- `v8-stress-new-arrivals-tight-n50-r4::repeat-3`
- `v8-stress-new-arrivals-tight-n100-r1::repeat-1`
- `v8-stress-new-arrivals-tight-n100-r1::repeat-2`
- `v8-stress-new-arrivals-tight-n100-r1::repeat-3`
- `v8-stress-batch-release-balanced-n24-r2::repeat-1`
- `v8-stress-batch-release-balanced-n24-r2::repeat-2`
- `v8-stress-batch-release-balanced-n24-r2::repeat-3`
- `v8-stress-batch-release-balanced-n100-r2::repeat-1`
- `v8-stress-batch-release-balanced-n100-r2::repeat-2`
- `v8-stress-batch-release-balanced-n100-r2::repeat-3`
- `v8-stress-batch-release-tight-n50-r1::repeat-1`
- `v8-stress-batch-release-tight-n50-r1::repeat-2`
- `v8-stress-batch-release-tight-n50-r1::repeat-3`
- `v8-stress-batch-release-tight-n50-r3::repeat-1`
- `v8-stress-batch-release-tight-n50-r3::repeat-2`
- `v8-stress-batch-release-tight-n50-r3::repeat-3`
- `v8-stress-batch-release-tight-n50-r4::repeat-1`
- `v8-stress-batch-release-tight-n50-r4::repeat-2`
- `v8-stress-batch-release-tight-n50-r4::repeat-3`
- `v8-stress-batch-release-tight-n100-r1::repeat-1`
- `v8-stress-batch-release-tight-n100-r1::repeat-2`
- `v8-stress-batch-release-tight-n100-r1::repeat-3`
- `v8-stress-batch-release-tight-n100-r3::repeat-1`
- `v8-stress-batch-release-tight-n100-r3::repeat-2`
- `v8-stress-batch-release-tight-n100-r3::repeat-3`
- `v8-stress-batch-release-tight-n100-r4::repeat-1`
- `v8-stress-batch-release-tight-n100-r4::repeat-2`
- `v8-stress-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

없음.

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### highsVsV7 · 독립 native HiGHS / V7 비용 다듬기

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 시나리오 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 28 / 82 | 313,077,416.67 | 292,943,550.00 | 20,133,866.67 | 6.43% | 16/10/2 | 235,000.00 | 4 / 12 | [3.69, 11.17] |
| incremental | 28 / 82 | 189,035,416.67 | 168,901,550.00 | 20,133,866.67 | 10.65% | 16/10/2 | 235,000.00 | 4 / 12 | [6.38, 17.12] |

완주 얻음/잃음 episode: 34 / 7. 시나리오 평균 완주율 차이: 0.125000; 독립 검산 95% 구간: [0.03, 0.22].
비교 가능한 날짜 변경: 9394 → 29876; 82쌍.

total 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 903,469,800.00 ₩ / 후보 843,868,550.00 ₩.

**total / negativeScenarioIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n24-r2`
- `v8-stress-batch-release-balanced-n24-r4`

**total / negativeEpisodeIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n24-r1::repeat-1`
- `v8-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v8-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v8-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v8-stress-batch-release-balanced-n24-r4::repeat-1`
- `v8-stress-batch-release-balanced-n24-r4::repeat-2`
- `v8-stress-batch-release-balanced-n24-r4::repeat-3`

incremental 원 반복 단위 비용합(시나리오 동일가중 합과 다름): 기준 548,499,650.00 ₩ / 후보 488,898,400.00 ₩.

**incremental / negativeScenarioIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n24-r2`
- `v8-stress-batch-release-balanced-n24-r4`

**incremental / negativeEpisodeIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n24-r1::repeat-1`
- `v8-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v8-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v8-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v8-stress-batch-release-balanced-n24-r4::repeat-1`
- `v8-stress-batch-release-balanced-n24-r4::repeat-2`
- `v8-stress-batch-release-balanced-n24-r4::repeat-3`

**gainedEpisodeIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v8-stress-new-arrivals-balanced-n24-r4::repeat-1`
- `v8-stress-new-arrivals-balanced-n24-r4::repeat-2`
- `v8-stress-new-arrivals-balanced-n24-r4::repeat-3`
- `v8-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v8-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v8-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v8-stress-new-arrivals-balanced-n50-r4::repeat-1`
- `v8-stress-new-arrivals-balanced-n50-r4::repeat-2`
- `v8-stress-new-arrivals-balanced-n50-r4::repeat-3`
- `v8-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v8-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v8-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v8-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v8-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v8-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v8-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v8-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v8-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v8-stress-new-arrivals-tight-n100-r1::repeat-1`
- `v8-stress-new-arrivals-tight-n100-r1::repeat-2`
- `v8-stress-new-arrivals-tight-n100-r1::repeat-3`
- `v8-stress-batch-release-balanced-n24-r2::repeat-1`
- `v8-stress-batch-release-balanced-n24-r2::repeat-2`
- `v8-stress-batch-release-balanced-n24-r2::repeat-3`
- `v8-stress-batch-release-balanced-n100-r2::repeat-1`
- `v8-stress-batch-release-balanced-n100-r2::repeat-2`
- `v8-stress-batch-release-balanced-n100-r2::repeat-3`
- `v8-stress-batch-release-tight-n50-r3::repeat-1`
- `v8-stress-batch-release-tight-n50-r3::repeat-2`
- `v8-stress-batch-release-tight-n50-r3::repeat-3`
- `v8-stress-batch-release-tight-n50-r4::repeat-1`
- `v8-stress-batch-release-tight-n50-r4::repeat-2`
- `v8-stress-batch-release-tight-n50-r4::repeat-3`

**lostEpisodeIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v8-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v8-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v8-stress-aged-backlog-balanced-n100-r4::repeat-1`
- `v8-stress-aged-backlog-balanced-n100-r4::repeat-2`
- `v8-stress-aged-backlog-balanced-n100-r4::repeat-3`
- `v8-stress-new-arrivals-tight-n50-r4::repeat-1`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

- `v8-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v8-stress-new-arrivals-balanced-n24-r4::repeat-1`
- `v8-stress-new-arrivals-balanced-n24-r4::repeat-2`
- `v8-stress-new-arrivals-balanced-n24-r4::repeat-3`
- `v8-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v8-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v8-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v8-stress-new-arrivals-balanced-n50-r4::repeat-1`
- `v8-stress-new-arrivals-balanced-n50-r4::repeat-2`
- `v8-stress-new-arrivals-balanced-n50-r4::repeat-3`
- `v8-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v8-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v8-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v8-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v8-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v8-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v8-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v8-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v8-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v8-stress-new-arrivals-tight-n100-r1::repeat-1`
- `v8-stress-new-arrivals-tight-n100-r1::repeat-2`
- `v8-stress-new-arrivals-tight-n100-r1::repeat-3`
- `v8-stress-batch-release-balanced-n24-r2::repeat-1`
- `v8-stress-batch-release-balanced-n24-r2::repeat-2`
- `v8-stress-batch-release-balanced-n24-r2::repeat-3`
- `v8-stress-batch-release-balanced-n100-r2::repeat-1`
- `v8-stress-batch-release-balanced-n100-r2::repeat-2`
- `v8-stress-batch-release-balanced-n100-r2::repeat-3`
- `v8-stress-batch-release-tight-n50-r3::repeat-1`
- `v8-stress-batch-release-tight-n50-r3::repeat-2`
- `v8-stress-batch-release-tight-n50-r3::repeat-3`
- `v8-stress-batch-release-tight-n50-r4::repeat-1`
- `v8-stress-batch-release-tight-n50-r4::repeat-2`
- `v8-stress-batch-release-tight-n50-r4::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

## G0 전체 실패 층별 상태

| V7 실패 ID | 실패일 | 원 명목 | 관측+기존 잠금 | 전지적 실제 | 전지적 실제+잠금 |
| --- | --- | --- | --- | --- | --- |
| v7-aged-backlog-tight-n24-r1 | 0 | infeasible | infeasible | infeasible | infeasible |
| v7-aged-backlog-tight-n24-r2 | 7 | feasible | infeasible | infeasible | infeasible |
| v7-aged-backlog-tight-n50-r1 | 0 | feasible | feasible | infeasible | infeasible |
| v7-aged-backlog-tight-n50-r2 | 0 | infeasible | infeasible | infeasible | infeasible |
| v7-aged-backlog-tight-n100-r1 | 0 | feasible | feasible | feasible | feasible |
| v7-aged-backlog-tight-n100-r2 | 0 | infeasible | infeasible | infeasible | infeasible |
| v7-new-arrivals-tight-n50-r2 | 3 | feasible | feasible | feasible | feasible |
| v7-new-arrivals-tight-n100-r2 | 0 | feasible | feasible | feasible | feasible |
| v7-batch-release-tight-n24-r1 | 0 | infeasible | infeasible | infeasible | infeasible |

G0 독립 오프라인 해답 자체는 원 온라인 알고리즘의 가시간 성공을 뜻하지 않습니다. 이후 실제 수행한 원 seed 추가 예산 개발 검사는 다음 절에 별도 보고합니다.

## 동일 이력 개발 자료 원 요약

아래는 과거 입력 기반의 별도 개발 자료입니다. warm snapshot 검사는 냉 전체 episode 새 평가와 합치지 않습니다.
```json
{
  "resultCount": 392,
  "panelSummaries": {
    "stratified-mechanism-200ms": {
      "methods": {
        "retainOrRecoverV7": {
          "taskSeedRunCount": 72,
          "uniqueSnapshotCount": 24,
          "timelyCompleteCount": 63,
          "failedOrLateCount": 9,
          "lateCompleteCount": 3,
          "auditRejectedCount": 0,
          "statuses": {
            "timely_complete_snapshot": 63,
            "late_complete_snapshot": 3,
            "no_complete_snapshot": 6
          },
          "actions": {
            "retain": 51,
            "rebuild": 21
          },
          "changedEventCountOnTimelyResults": 750,
          "referenceAvailableCount": 63,
          "wallTimeMs": {
            "count": 72,
            "median": 0.915372499999819,
            "p95": 70.46518100000048,
            "max": 247.2075920000002
          }
        },
        "alwaysPolishOrRecoverV7": {
          "taskSeedRunCount": 72,
          "uniqueSnapshotCount": 24,
          "timelyCompleteCount": 63,
          "failedOrLateCount": 9,
          "lateCompleteCount": 3,
          "auditRejectedCount": 0,
          "statuses": {
            "timely_complete_snapshot": 63,
            "late_complete_snapshot": 3,
            "no_complete_snapshot": 6
          },
          "actions": {
            "polish": 51,
            "rebuild": 21
          },
          "changedEventCountOnTimelyResults": 1146,
          "referenceAvailableCount": 63,
          "wallTimeMs": {
            "count": 72,
            "median": 6.294849500000055,
            "p95": 69.58837100000073,
            "max": 247.44593600000007
          }
        },
        "alwaysRebuildV7": {
          "taskSeedRunCount": 72,
          "uniqueSnapshotCount": 24,
          "timelyCompleteCount": 51,
          "failedOrLateCount": 21,
          "lateCompleteCount": 15,
          "auditRejectedCount": 0,
          "statuses": {
            "timely_complete_snapshot": 51,
            "late_complete_snapshot": 15,
            "no_complete_snapshot": 6
          },
          "actions": {
            "rebuild": 72
          },
          "changedEventCountOnTimelyResults": 2034,
          "referenceAvailableCount": 51,
          "wallTimeMs": {
            "count": 72,
            "median": 34.617971500000294,
            "p95": 244.17199500000015,
            "max": 248.421067
          }
        },
        "adaptiveV8": {
          "taskSeedRunCount": 72,
          "uniqueSnapshotCount": 24,
          "timelyCompleteCount": 63,
          "failedOrLateCount": 9,
          "lateCompleteCount": 0,
          "auditRejectedCount": 0,
          "statuses": {
            "timely_complete_snapshot": 63,
            "no_complete_snapshot": 9
          },
          "actions": {
            "retain": 51,
            "failed": 9,
            "rebuild": 12
          },
          "changedEventCountOnTimelyResults": 750,
          "referenceAvailableCount": 63,
          "wallTimeMs": {
            "count": 72,
            "median": 6.074276499999826,
            "p95": 73.62964900000043,
            "max": 248.59621700000002
          }
        }
      },
      "adaptiveVs": {
        "retainOrRecoverV7": {
          "allPairedRuns": 72,
          "jointTimelyRunCount": 63,
          "gainedTimely": 0,
          "lostTimely": 0,
          "lowerFeeCount": 0,
          "equalFeeCount": 63,
          "higherFeeCount": 0,
          "snapshotTotalFeeDifferenceKRW": 0,
          "snapshotIncrementalFeeDifferenceKRW": 0,
          "baselineChangedEvents": 750,
          "adaptiveChangedEvents": 750,
          "negativeCaseIds": [],
          "scope": "Repeated same-snapshot model amounts, not additive realized business savings or terminal episode fees."
        },
        "alwaysPolishOrRecoverV7": {
          "allPairedRuns": 72,
          "jointTimelyRunCount": 63,
          "gainedTimely": 0,
          "lostTimely": 0,
          "lowerFeeCount": 0,
          "equalFeeCount": 51,
          "higherFeeCount": 12,
          "snapshotTotalFeeDifferenceKRW": 4396200,
          "snapshotIncrementalFeeDifferenceKRW": 4396200,
          "baselineChangedEvents": 1146,
          "adaptiveChangedEvents": 750,
          "negativeCaseIds": [
            {
              "taskId": "mechanism-aged-backlog-balanced-2",
              "seed": 1103,
              "extraSnapshotFeeKRW": 20000
            },
            {
              "taskId": "mechanism-aged-backlog-balanced-2",
              "seed": 2207,
              "extraSnapshotFeeKRW": 20000
            },
            {
              "taskId": "mechanism-aged-backlog-balanced-2",
              "seed": 3301,
              "extraSnapshotFeeKRW": 20000
            },
            {
              "taskId": "mechanism-batch-release-tight-1",
              "seed": 1103,
              "extraSnapshotFeeKRW": 75500
            },
            {
              "taskId": "mechanism-batch-release-tight-1",
              "seed": 2207,
              "extraSnapshotFeeKRW": 75500
            },
            {
              "taskId": "mechanism-batch-release-tight-1",
              "seed": 3301,
              "extraSnapshotFeeKRW": 75500
            },
            {
              "taskId": "mechanism-batch-release-tight-2",
              "seed": 1103,
              "extraSnapshotFeeKRW": 715200
            },
            {
              "taskId": "mechanism-batch-release-tight-2",
              "seed": 2207,
              "extraSnapshotFeeKRW": 715200
            },
            {
              "taskId": "mechanism-batch-release-tight-2",
              "seed": 3301,
              "extraSnapshotFeeKRW": 715200
            },
            {
              "taskId": "mechanism-batch-release-tight-3",
              "seed": 1103,
              "extraSnapshotFeeKRW": 654700
            },
            {
              "taskId": "mechanism-batch-release-tight-3",
              "seed": 2207,
              "extraSnapshotFeeKRW": 654700
            },
            {
              "taskId": "mechanism-batch-release-tight-3",
              "seed": 3301,
              "extraSnapshotFeeKRW": 654700
            }
          ],
          "scope": "Repeated same-snapshot model amounts, not additive realized business savings or terminal episode fees."
        },
        "alwaysRebuildV7": {
          "allPairedRuns": 72,
          "jointTimelyRunCount": 51,
          "gainedTimely": 12,
          "lostTimely": 0,
          "lowerFeeCount": 0,
          "equalFeeCount": 48,
          "higherFeeCount": 3,
          "snapshotTotalFeeDifferenceKRW": 300300,
          "snapshotIncrementalFeeDifferenceKRW": 300300,
          "baselineChangedEvents": 2034,
          "adaptiveChangedEvents": 750,
          "negativeCaseIds": [
            {
              "taskId": "mechanism-batch-release-balanced-3",
              "seed": 1103,
              "extraSnapshotFeeKRW": 100100
            },
            {
              "taskId": "mechanism-batch-release-balanced-3",
              "seed": 2207,
              "extraSnapshotFeeKRW": 100100
            },
            {
              "taskId": "mechanism-batch-release-balanced-3",
              "seed": 3301,
              "extraSnapshotFeeKRW": 100100
            }
          ],
          "scope": "Repeated same-snapshot model amounts, not additive realized business savings or terminal episode fees."
        }
      }
    },
    "observed-feasible-misses-200ms": {
      "methods": {
        "retainOrRecoverV7": {
          "taskSeedRunCount": 12,
          "uniqueSnapshotCount": 4,
          "timelyCompleteCount": 0,
          "failedOrLateCount": 12,
          "lateCompleteCount": 0,
          "auditRejectedCount": 0,
          "statuses": {
            "no_complete_snapshot": 12
          },
          "actions": {
            "initialize": 9,
            "rebuild": 3
          },
          "changedEventCountOnTimelyResults": 0,
          "referenceAvailableCount": 0,
          "wallTimeMs": {
            "count": 12,
            "median": 225.75783850000062,
            "p95": 331.9816409999985,
            "max": 331.9816409999985
          }
        },
        "alwaysPolishOrRecoverV7": {
          "taskSeedRunCount": 12,
          "uniqueSnapshotCount": 4,
          "timelyCompleteCount": 0,
          "failedOrLateCount": 12,
          "lateCompleteCount": 0,
          "auditRejectedCount": 0,
          "statuses": {
            "no_complete_snapshot": 12
          },
          "actions": {
            "initialize": 9,
            "rebuild": 3
          },
          "changedEventCountOnTimelyResults": 0,
          "referenceAvailableCount": 0,
          "wallTimeMs": {
            "count": 12,
            "median": 225.92059700000027,
            "p95": 331.1498530000026,
            "max": 331.1498530000026
          }
        },
        "alwaysRebuildV7": {
          "taskSeedRunCount": 12,
          "uniqueSnapshotCount": 4,
          "timelyCompleteCount": 0,
          "failedOrLateCount": 12,
          "lateCompleteCount": 0,
          "auditRejectedCount": 0,
          "statuses": {
            "no_complete_snapshot": 12
          },
          "actions": {
            "initialize": 9,
            "rebuild": 3
          },
          "changedEventCountOnTimelyResults": 0,
          "referenceAvailableCount": 0,
          "wallTimeMs": {
            "count": 12,
            "median": 226.85604200000034,
            "p95": 330.1763150000006,
            "max": 330.1763150000006
          }
        },
        "adaptiveV8": {
          "taskSeedRunCount": 12,
          "uniqueSnapshotCount": 4,
          "timelyCompleteCount": 0,
          "failedOrLateCount": 12,
          "lateCompleteCount": 0,
          "auditRejectedCount": 0,
          "statuses": {
            "no_complete_snapshot": 12
          },
          "actions": {
            "failed": 12
          },
          "changedEventCountOnTimelyResults": 0,
          "referenceAvailableCount": 0,
          "wallTimeMs": {
            "count": 12,
            "median": 226.31256700000176,
            "p95": 333.7927149999996,
            "max": 333.7927149999996
          }
        }
      },
      "adaptiveVs": {
        "retainOrRecoverV7": {
          "allPairedRuns": 12,
          "jointTimelyRunCount": 0,
          "gainedTimely": 0,
          "lostTimely": 0,
          "lowerFeeCount": 0,
          "equalFeeCount": 0,
          "higherFeeCount": 0,
          "snapshotTotalFeeDifferenceKRW": 0,
          "snapshotIncrementalFeeDifferenceKRW": 0,
          "baselineChangedEvents": 0,
          "adaptiveChangedEvents": 0,
          "negativeCaseIds": [],
          "scope": "Repeated same-snapshot model amounts, not additive realized business savings or terminal episode fees."
        },
        "alwaysPolishOrRecoverV7": {
          "allPairedRuns": 12,
          "jointTimelyRunCount": 0,
          "gainedTimely": 0,
          "lostTimely": 0,
          "lowerFeeCount": 0,
          "equalFeeCount": 0,
          "higherFeeCount": 0,
          "snapshotTotalFeeDifferenceKRW": 0,
          "snapshotIncrementalFeeDifferenceKRW": 0,
          "baselineChangedEvents": 0,
          "adaptiveChangedEvents": 0,
          "negativeCaseIds": [],
          "scope": "Repeated same-snapshot model amounts, not additive realized business savings or terminal episode fees."
        },
        "alwaysRebuildV7": {
          "allPairedRuns": 12,
          "jointTimelyRunCount": 0,
          "gainedTimely": 0,
          "lostTimely": 0,
          "lowerFeeCount": 0,
          "equalFeeCount": 0,
          "higherFeeCount": 0,
          "snapshotTotalFeeDifferenceKRW": 0,
          "snapshotIncrementalFeeDifferenceKRW": 0,
          "baselineChangedEvents": 0,
          "adaptiveChangedEvents": 0,
          "negativeCaseIds": [],
          "scope": "Repeated same-snapshot model amounts, not additive realized business savings or terminal episode fees."
        }
      }
    },
    "observed-feasible-misses-1000ms": {
      "methods": {
        "retainOrRecoverV7": {
          "taskSeedRunCount": 12,
          "uniqueSnapshotCount": 4,
          "timelyCompleteCount": 3,
          "failedOrLateCount": 9,
          "lateCompleteCount": 0,
          "auditRejectedCount": 0,
          "statuses": {
            "no_complete_snapshot": 9,
            "timely_complete_snapshot": 3
          },
          "actions": {
            "initialize": 9,
            "rebuild": 3
          },
          "changedEventCountOnTimelyResults": 177,
          "referenceAvailableCount": 3,
          "wallTimeMs": {
            "count": 12,
            "median": 1026.4342899999983,
            "p95": 1130.6208729999998,
            "max": 1130.6208729999998
          }
        },
        "alwaysPolishOrRecoverV7": {
          "taskSeedRunCount": 12,
          "uniqueSnapshotCount": 4,
          "timelyCompleteCount": 3,
          "failedOrLateCount": 9,
          "lateCompleteCount": 0,
          "auditRejectedCount": 0,
          "statuses": {
            "no_complete_snapshot": 9,
            "timely_complete_snapshot": 3
          },
          "actions": {
            "initialize": 9,
            "rebuild": 3
          },
          "changedEventCountOnTimelyResults": 177,
          "referenceAvailableCount": 3,
          "wallTimeMs": {
            "count": 12,
            "median": 1026.5980844999995,
            "p95": 1136.8453930000032,
            "max": 1136.8453930000032
          }
        },
        "alwaysRebuildV7": {
          "taskSeedRunCount": 12,
          "uniqueSnapshotCount": 4,
          "timelyCompleteCount": 3,
          "failedOrLateCount": 9,
          "lateCompleteCount": 0,
          "auditRejectedCount": 0,
          "statuses": {
            "no_complete_snapshot": 9,
            "timely_complete_snapshot": 3
          },
          "actions": {
            "initialize": 9,
            "rebuild": 3
          },
          "changedEventCountOnTimelyResults": 177,
          "referenceAvailableCount": 3,
          "wallTimeMs": {
            "count": 12,
            "median": 1026.6895084999996,
            "p95": 1146.8898370000024,
            "max": 1146.8898370000024
          }
        },
        "adaptiveV8": {
          "taskSeedRunCount": 12,
          "uniqueSnapshotCount": 4,
          "timelyCompleteCount": 3,
          "failedOrLateCount": 9,
          "lateCompleteCount": 0,
          "auditRejectedCount": 0,
          "statuses": {
            "no_complete_snapshot": 9,
            "timely_complete_snapshot": 3
          },
          "actions": {
            "failed": 9,
            "rebuild": 3
          },
          "changedEventCountOnTimelyResults": 177,
          "referenceAvailableCount": 3,
          "wallTimeMs": {
            "count": 12,
            "median": 1027.0710240000044,
            "p95": 1130.0407909999994,
            "max": 1130.0407909999994
          }
        }
      },
      "adaptiveVs": {
        "retainOrRecoverV7": {
          "allPairedRuns": 12,
          "jointTimelyRunCount": 3,
          "gainedTimely": 0,
          "lostTimely": 0,
          "lowerFeeCount": 0,
          "equalFeeCount": 3,
          "higherFeeCount": 0,
          "snapshotTotalFeeDifferenceKRW": 0,
          "snapshotIncrementalFeeDifferenceKRW": 0,
          "baselineChangedEvents": 177,
          "adaptiveChangedEvents": 177,
          "negativeCaseIds": [],
          "scope": "Repeated same-snapshot model amounts, not additive realized business savings or terminal episode fees."
        },
        "alwaysPolishOrRecoverV7": {
          "allPairedRuns": 12,
          "jointTimelyRunCount": 3,
          "gainedTimely": 0,
          "lostTimely": 0,
          "lowerFeeCount": 0,
          "equalFeeCount": 3,
          "higherFeeCount": 0,
          "snapshotTotalFeeDifferenceKRW": 0,
          "snapshotIncrementalFeeDifferenceKRW": 0,
          "baselineChangedEvents": 177,
          "adaptiveChangedEvents": 177,
          "negativeCaseIds": [],
          "scope": "Repeated same-snapshot model amounts, not additive realized business savings or terminal episode fees."
        },
        "alwaysRebuildV7": {
          "allPairedRuns": 12,
          "jointTimelyRunCount": 3,
          "gainedTimely": 0,
          "lostTimely": 0,
          "lowerFeeCount": 0,
          "equalFeeCount": 3,
          "higherFeeCount": 0,
          "snapshotTotalFeeDifferenceKRW": 0,
          "snapshotIncrementalFeeDifferenceKRW": 0,
          "baselineChangedEvents": 177,
          "adaptiveChangedEvents": 177,
          "negativeCaseIds": [],
          "scope": "Repeated same-snapshot model amounts, not additive realized business savings or terminal episode fees."
        }
      }
    }
  },
  "originalSeedBudgetPairs": [
    {
      "taskId": "miss-v7-aged-backlog-tight-n50-r1",
      "seed": 91009,
      "day": 0,
      "originalExecutedEventCount": 0,
      "at200ms": "no_complete_snapshot",
      "at1000ms": "no_complete_snapshot",
      "foundOnlyWith1000ms": false,
      "totalFeeAt200ms": null,
      "totalFeeAt1000ms": null,
      "scope": "Frozen V7 same-snapshot fresh factories, private old cache not restored."
    },
    {
      "taskId": "miss-v7-aged-backlog-tight-n100-r1",
      "seed": 91011,
      "day": 0,
      "originalExecutedEventCount": 0,
      "at200ms": "no_complete_snapshot",
      "at1000ms": "no_complete_snapshot",
      "foundOnlyWith1000ms": false,
      "totalFeeAt200ms": null,
      "totalFeeAt1000ms": null,
      "scope": "Frozen V7 same-snapshot fresh factories, private old cache not restored."
    },
    {
      "taskId": "miss-v7-new-arrivals-tight-n50-r2",
      "seed": 91022,
      "day": 3,
      "originalExecutedEventCount": 17,
      "at200ms": "no_complete_snapshot",
      "at1000ms": "timely_complete_snapshot",
      "foundOnlyWith1000ms": true,
      "totalFeeAt200ms": null,
      "totalFeeAt1000ms": 9100,
      "scope": "Frozen V7 same-snapshot fresh factories, private old cache not restored."
    },
    {
      "taskId": "miss-v7-new-arrivals-tight-n100-r2",
      "seed": 91024,
      "day": 0,
      "originalExecutedEventCount": 0,
      "at200ms": "no_complete_snapshot",
      "at1000ms": "no_complete_snapshot",
      "foundOnlyWith1000ms": false,
      "totalFeeAt200ms": null,
      "totalFeeAt1000ms": null,
      "scope": "Frozen V7 same-snapshot fresh factories, private old cache not restored."
    }
  ],
  "independentUnitWarning": "Snapshots share source cases; three algorithm seeds are repeated runs, not independent logistics cases."
}
```

## 원 알고리즘·원 seed 추가 예산 개발 검사 — 실제 수행

고정 V7 코드의 fresh factory를 원 scenario.seed로 실행한 8개 실제 호출입니다. 같은 기존 snapshot에서 200ms와 1000ms를 비교했습니다. 새 holdout·새 업무 시나리오·전체 냉 episode 성과로 세지 않습니다.

| 기존 task ID | 원 seed | 실패일 | 기존 실행 잠금 수 | 200ms 상태 | 1000ms 상태 | 1000ms 완전 총요금 ₩ |
| --- | --- | --- | --- | --- | --- | --- |
| miss-v7-aged-backlog-tight-n50-r1 | 91009 | 0 | 0 | no_complete_snapshot | no_complete_snapshot | null |
| miss-v7-aged-backlog-tight-n100-r1 | 91011 | 0 | 0 | no_complete_snapshot | no_complete_snapshot | null |
| miss-v7-new-arrivals-tight-n50-r2 | 91022 | 3 | 17 | no_complete_snapshot | timely_complete_snapshot | 9,100 |
| miss-v7-new-arrivals-tight-n100-r2 | 91024 | 0 | 0 | no_complete_snapshot | no_complete_snapshot | null |

D3 결과는 원 실행 잠금을 보존한 단일 관측 snapshot의 추가 예산 검사입니다. private한 원 V7 cache 상태를 복원하지 않았으므로 아카이브 내부 상태 또는 전체 온라인 episode의 정확한 재실행이라고 부르지 않습니다. 세 D0가 더 큰 예산에서도 실패한 사실과 한 D3의 완전 후보를 모두 보존합니다.
G0 원본의 originalAlgorithmExtraBudgetReplay 필드는 진단 생성 시점의 역사적 상태이며, 이후 수행된 위 개발 실험의 현재 상태를 대신하지 않습니다.

## 원본 연결

| 증거 입력 | SHA-256 |
| --- | --- |
| data/v8-results.json | e033704ef2e27a6f1b2fc8d55ba94809b8fd8a77c6aa3d50d19a77a3199ed92b |
| data/evidence-v8/v8-frozen-first/first-run/complete.json | e873aae0c65fcf51d7335fb3aa57f5285bdbb12bf9c286fb4018c8b2213205b6 |
| data/protocol-v8.json | fa886fe62cd2fdb08097bff97e64bc20cd4fe00198c2b4b9caff9d8a7bb3deb5 |
| data/review-v8.json | e641527d79883fc467fdf7b1246a257cc5d622f31686c90179c065652f00d3e0 |
| data/bootstrap-review-v8.json | 11acbc4de3c73edff3cd203028d1beca13e9e635415b3cecdf00d77af9bd30f7 |
| data/failure-diagnosis-v8.json | b17cef73f79c8259cab5d68e194a36e858c4c1adc8613f16c5a18a5b51be99e7 |
| data/evidence-v8/mechanism-v8-first/results.json | 537140a831fb5807bb703b2757b9203c328d3062a6e486006c3780e44c0eaf23 |
| data/evidence-v8/mechanism-v8-first/audit.json | d1c84d369197ff6cf4520d09cb77af30c3d1addd1ddcf5c377860a5e742d2f93 |

복원된 formal index의 각 inputArtifact와 episode artifact가 원 SHA로 연결됩니다. 공개 wrapper는 전체 장부를 대체하지 않습니다. 원자료 복원과 독립 검산은 새 성과 생성이 아닙니다.

## 재현

```bash
python scripts/restore-evidence-v8.py
python scripts/review-v8.py --run data/evidence-v8/v8-frozen-first/first-run --output artifacts/review-v8-reproduction.json
python scripts/build-defense-v8.py --require-results --development data/evidence-v8/mechanism-v8-first/results.json --development-review data/evidence-v8/mechanism-v8-first/audit.json --bootstrap-review data/bootstrap-review-v8.json
```

새 실험은 고정 source·protocol을 확인한 별도 출력 경로에서 수행합니다. 최초 결과를 덮어쓰지 않습니다. 개인 참가·AI 조건·등록·서약·본인 발표 숙련은 별도 확인 대상입니다.
