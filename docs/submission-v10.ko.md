# PortPlan V10 · 동일 요금 유지와 native 계획 안정성

AI 작성 준비 자료. 참가자 본인의 창작·검증·이해·참가자격 확인서가 아닙니다.

선언된 관측 문턱을 모두 충족하지 못했습니다. V10은 실험 선택 항목이며 기본값 권고 조건을 충족하지 않았습니다.

완결된 새 주문 실험과 독립 물리/통계 검산에서 생성했습니다. 합성 일 단위 모델이며 실현 절감·기업 검증·전역 최소 변경이 아닙니다.

동일 생성분포 · 새 주문 시드: V10 완주 156/216, 원래 native 153/216; 완주 얻음/잃음 3/0. 손실 업무 시나리오 0개; 같은 시나리오 반복을 독립 사례로 세지 않습니다. 공동 완주 153쌍의 날짜 변경 53667→12117 (77.42% 감소). 총요금 절감 -0.01166647%, 조건부 95% CI [-0.06264978374, 0.0178671957]; 추가요금 절감 -0.02002230%, CI [-0.1066936675, 0.03042521996]. 0을 포함한 구간은 안정적 비용 우위가 아니며 음의 절감 점추정은 더 비쌈을 뜻합니다.

V7 대비 별도 공동 완주 집합의 추가 두 요금 절감은 9.180%, 95% CI [6.488110178, 11.7562391]; 분모 43개 시나리오/129쌍입니다. 전체 완주 얻음/잃음 27/15; 손실은 V7이 완주했지만 V10이 실패한 반복입니다. 이는 native 대비 비용 구간과 기준·분모가 다른 조건부 결과이며 전체 순위나 완주 손실 상쇄로 쓰지 않습니다.

스트레스 · 새 주문 시드: V10 완주 132/216, 원래 native 120/216; 완주 얻음/잃음 15/3. 손실 업무 시나리오 1개; 같은 시나리오 반복을 독립 사례로 세지 않습니다. 공동 완주 117쌍의 날짜 변경 45972→17625 (61.66% 감소). 총요금 절감 -0.16405648%, 조건부 95% CI [-0.6282350661, 0.04157422929]; 추가요금 절감 -0.28474977%, CI [-1.063162036, 0.06948376842]. 0을 포함한 구간은 안정적 비용 우위가 아니며 음의 절감 점추정은 더 비쌈을 뜻합니다.

V7 대비 별도 공동 완주 집합의 추가 두 요금 절감은 10.883%, 95% CI [6.905172586, 14.42325021]; 분모 32개 시나리오/95쌍입니다. 전체 완주 얻음/잃음 37/12; 손실은 V7이 완주했지만 V10이 실패한 반복입니다. 이는 native 대비 비용 구간과 기준·분모가 다른 조건부 결과이며 전체 순위나 완주 손실 상쇄로 쓰지 않습니다.

## 01. 같은 요금이라면 유효한 날짜를 그대로 유지할 수 있을까요?

PortPlan V10은 원래 native HiGHS가 계산한 새 후보와 현재 유효 계획을 같은 관측 정보로 재검사합니다. 실제 요금이 엄격히 낮을 때만 계획을 교체합니다.

현재 유효 계획 → native 후보·같은 요금? → 동률 유지 / 엄격 절감 교체

선언된 관측 문턱을 모두 충족하지 못했습니다. V10은 실험 선택 항목이며 기본값 권고 조건을 충족하지 않았습니다. V10 동일 생성분포 · 새 주문 시드 156/216; 스트레스 · 새 주문 시드 132/216 / native 동일 생성분포 · 새 주문 시드 153/216; 스트레스 · 새 주문 시드 120/216. 알려진 합성 주문의 일 단위 모형이며 실제 기업 절감·우승 확률이 아닙니다.

## 02. 반출·적출·반납과 요금을 하나의 날짜 장부로 연결합니다.

반출·반납은 각각 운송 작업을 사용합니다. 적출은 연속 창고 일수를 차지하고, 반출부터 반납 전까지 체류 공간을 점유합니다.

| 모형 | 계산할 항목 | 미포함 범위 |
| --- | --- | --- |
| 반출 p / 적출 u / 반납 r | 방출·납기·선후행·실행 잠금 | 도로 경로·예약·기사 근무시간 |
| 일별 운송·창고·체류 [p,r) | 용량·연속 점유·container/TEU | 시간대별 실운영 |
| PNC 보관료 / Maersk D&D | 공개 요율·명시한 기산일 해석 | 계약·실제 청구·세금 검증 |

기존 주문은 시작 시 모두 알려집니다. 비용 목표는 선언한 두 요금이며 신규 주문 도착이나 전체 물류 원가가 아닙니다.

## 03. V9의 한계도 수정하지 않은 이전 결과로 남깁니다.

V9는 V8의 늦은 후보 전달을 개선했지만 V7에 대한 일관된 향상을 보이지 않았습니다. 이를 V10의 다른 새 주문 입력과 빼서 개선량으로 만들지 않습니다.

| 이전 V9 평가 · 별도 입력 | V9 완주 | V7 완주 |
| --- | --- | --- |
| 동일 생성분포 · 새 주문 시드 | 150/216 | 150/216 |
| 스트레스 · 새 주문 시드 | 84/216 | 85/216 |

이전 V8/V9 최초 입력·반복·실패·비용 악화는 그대로 보존합니다. 같은 새 V10 입력에서 함께 실행한 정책끼리만 이번 차이를 계산합니다.

## 04. V10: 단 한 번의 native MILP와 엄격한 비용 교체 규칙입니다.

현재 cache를 재가격·물리/잠금 검사한 뒤 원래 native 서비스를 한 번 호출합니다. 현재 유효 cache보다 추가 요금이 엄격히 낮은 적시 후보만 교체합니다.

cache 재가격·검사 → native MILP 1회 → 엄격 절감만 교체

비교 epsilon은 고정 0.000001원입니다. 동일/더 높은 요금은 유지합니다. cache가 없거나 무효이면 기존 복구 방식으로 완전 후보를 구합니다.

## 05. 날짜 유지의 의미와 보장하지 않는 것을 구분합니다.

같은 비용의 후보를 거부하면 그 호출의 불필요한 변경을 피할 수 있습니다. 엄격히 더 저렴한 후보는 여러 날짜를 바꿀 수 있고 이후 경로도 달라집니다.

| 구현한 것 | 구현/증명하지 않은 것 |
| --- | --- |
| 동일 요금의 유효 cache 유지 | 전체 경로 최소 변경 |
| strict fee replacement | 두 번째 단계 사전식/lexicographic 최적화 |
| 같은 native 요금 목표·1회 solve | 변경 1회를 임의 원화 가중치로 환산 |
| 현재 관측·실행 잠금 검사 | 미래 충격의 완주·비용 보장 |

더 적은 날짜 변경과 비용·완주의 교환관계는 실험에서 확인합니다. 지역 선택 규칙을 전역 안정성 정리로 표현하지 않습니다.

## 06. native 기준과 웹 시연을 정확히 구분합니다.

V10과 원래 HiGHS는 같은 native Python 서비스·모형·수치 예산을 사용합니다. 초기화, IPC, 날짜 복사·재가격·검사는 전체 기한에 포함합니다.

| 항목 | 실행 범위 |
| --- | --- |
| V10 / 원래 native HiGHS | 오프라인 연구 worker와 Python/HiGHS |
| 웹 브라우저 계획기 | 기존 GLPK와 합성 입력 시뮬레이터 |
| 일별 / 전체 냉 기한 | 200ms / 부모 5,000ms |
| 검산 | 기록 시각 일관성·독립 날짜/요율 재구성 |

웹에서 native HiGHS를 실행한다고 주장하지 않습니다. 내부 기록 검산은 외부 시계 인증·같은 CPU 시간·절대 실시간 보장이 아닙니다.

## 07. 기존 생성·충격 메커니즘에 새 주문 시드를 사전 고정했습니다.

144개 업무 시나리오 × 5개 정책 × 3개 알고리즘/타이밍 반복 = 2,160개 episode. 반복은 새 독립 업무 표본이 아닙니다.

| 패널 / 반복 | 범위 |
| --- | --- |
| 동일 생성분포 72개 | 기존 생성기·기존 충격; 새 주문 시드 |
| 스트레스 72개 | 기존 V8/V9 충격 catalog; 새 주문 시드 |
| 모든 정책·반복 | 순차 냉 worker; 순서 순환; 모든 실패 보존 |
| 해석 | 패널별 보고; 입력 교체·실패 재추첨 없음 |

구현·예산·분석을 새 입력 생성 전에 고정합니다. 144개 업무 시나리오를 432개 독립 사례로 세지 않습니다.

## 08. 동일 생성분포 · 새 주문 시드 조건부 비용보다 전체 완주를 먼저 봅니다.

완주는 물리 행동과 최종 검사를 부모 기한 내 수락한 경우입니다. 미확보 이력과 비용은 null이며 물리 불가능이나 0원으로 바꾸지 않습니다.

| 정책 | 완주/전체 | 3회 모두 완주 시나리오 | 미확보 이력 |
| --- | --- | --- | --- |
| V5 유효 계획 유지 | 122/216 | 40 | 0 |
| V7 비용 다듬기 | 144/216 | 48 | 0 |
| V9 적시 후보 전달 | 145/216 | 48 | 0 |
| 독립 native HiGHS | 153/216 | 51 | 0 |
| V10 동일 요금 계획 유지 | 156/216 | 52 | 0 |

episode 완주 수, 세 반복 모두 완주한 시나리오, 이력 미확보를 분리합니다. 조건부 Pareto가 전체 완주 손실을 덮지 않습니다.

## 09. 동일 생성분포 · 새 주문 시드 같은 공동 완주 반복의 요금만 비교합니다.

양수 절감은 기준 − 후보입니다. 시나리오 내 일치하는 공동 완주 반복을 평균한 뒤 시나리오를 동일 가중합니다.

| 후보 / 기준 | 시나리오 / 쌍 | 총요금 절감 | 추가요금 절감 | 낮음/동일/높음 |
| --- | --- | --- | --- | --- |
| V10 동일 요금 계획 유지 / 독립 native HiGHS | 51 / 153 | -0.01% | -0.02% | 3/42/6 |
| V10 동일 요금 계획 유지 / V9 적시 후보 전달 | 44 / 130 | 5.37% | 9.13% | 19/24/1 |
| V10 동일 요금 계획 유지 / V7 비용 다듬기 | 43 / 129 | 5.41% | 9.18% | 19/23/1 |
| V10 동일 요금 계획 유지 / V5 유효 계획 유지 | 38 / 114 | 0.57% | 1.01% | 13/22/3 |
| 독립 native HiGHS / V7 비용 다듬기 | 42 / 126 | 5.45% | 9.18% | 19/22/1 |

비교별 분모가 다릅니다. 구간이 0을 포함하면 안정적인 비용 우위를 주장하지 않습니다. 모든 악화 ID와 조건부 구간은 보고서에 보존합니다.

## 10. 스트레스 · 새 주문 시드 조건부 비용보다 전체 완주를 먼저 봅니다.

완주는 물리 행동과 최종 검사를 부모 기한 내 수락한 경우입니다. 미확보 이력과 비용은 null이며 물리 불가능이나 0원으로 바꾸지 않습니다.

| 정책 | 완주/전체 | 3회 모두 완주 시나리오 | 미확보 이력 |
| --- | --- | --- | --- |
| V5 유효 계획 유지 | 81/216 | 27 | 0 |
| V7 비용 다듬기 | 107/216 | 35 | 0 |
| V9 적시 후보 전달 | 108/216 | 36 | 0 |
| 독립 native HiGHS | 120/216 | 40 | 0 |
| V10 동일 요금 계획 유지 | 132/216 | 44 | 0 |

episode 완주 수, 세 반복 모두 완주한 시나리오, 이력 미확보를 분리합니다. 조건부 Pareto가 전체 완주 손실을 덮지 않습니다.

## 11. 스트레스 · 새 주문 시드 같은 공동 완주 반복의 요금만 비교합니다.

양수 절감은 기준 − 후보입니다. 시나리오 내 일치하는 공동 완주 반복을 평균한 뒤 시나리오를 동일 가중합니다.

| 후보 / 기준 | 시나리오 / 쌍 | 총요금 절감 | 추가요금 절감 | 낮음/동일/높음 |
| --- | --- | --- | --- | --- |
| V10 동일 요금 계획 유지 / 독립 native HiGHS | 39 / 117 | -0.16% | -0.28% | 3/28/8 |
| V10 동일 요금 계획 유지 / V9 적시 후보 전달 | 32 / 96 | 6.59% | 11.19% | 19/11/2 |
| V10 동일 요금 계획 유지 / V7 비용 다듬기 | 32 / 95 | 6.41% | 10.88% | 17/13/2 |
| V10 동일 요금 계획 유지 / V5 유효 계획 유지 | 26 / 78 | -0.07% | -0.11% | 7/14/5 |
| 독립 native HiGHS / V7 비용 다듬기 | 29 / 86 | 5.26% | 8.85% | 13/15/1 |

비교별 분모가 다릅니다. 구간이 0을 포함하면 안정적인 비용 우위를 주장하지 않습니다. 모든 악화 ID와 조건부 구간은 보고서에 보존합니다.

## 12. 완주 손실·최악 비용 악화를 모든 비교에서 보존합니다.

완주 얻음/잃음은 전체 일치 반복의 episode 기준입니다. 최악 비용 증가는 비교 가능한 시나리오 평균 기준입니다.

| 패널 | 비교 | 비용 악화 시나리오 | 최악 증가 ₩ | 완주 얻음/잃음 |
| --- | --- | --- | --- | --- |
| same-distribution | v10VsHiGHS | 6 | 30,000 | 3 / 0 |
| same-distribution | v10VsV9 | 1 | 21,067 | 26 / 15 |
| same-distribution | v10VsV7 | 1 | 21,067 | 27 / 15 |
| same-distribution | v10VsV5 | 3 | 33,200 | 42 / 8 |
| same-distribution | highsVsV7 | 1 | 2,867 | 27 / 18 |
| stress | v10VsHiGHS | 8 | 392,150 | 15 / 3 |
| stress | v10VsV9 | 2 | 18,200 | 36 / 12 |
| stress | v10VsV7 | 2 | 18,200 | 37 / 12 |
| stress | v10VsV5 | 5 | 231,550 | 54 / 3 |
| stress | highsVsV7 | 1 | 9,100 | 34 / 21 |

어느 이전 기준에든 완주 손실이 있으면 기본값 관측 자격을 얻지 못합니다. 모든 총/추가 요금 악화·완주 손실 ID를 보고서에 남깁니다.

## 13. 변경 수는 같은 공동 완주 집합에서 별도 단위로 비교합니다.

변경 1회는 아직 실행하지 않은 반출·적출 시작·반납 날짜 하나의 수정입니다. 비용과 합친 점수나 임의 원화 가중치를 만들지 않습니다.

| 패널 | 비교 | 공동 완주 반복 | 기준 변경 합 | 후보 변경 합 |
| --- | --- | --- | --- | --- |
| same-distribution | v10VsHiGHS | 153 | 53,667 | 12,117 |
| same-distribution | v10VsV9 | 130 | 6,033 | 9,709 |
| same-distribution | v10VsV7 | 129 | 5,778 | 9,489 |
| same-distribution | v10VsV5 | 114 | 3,351 | 7,755 |
| same-distribution | highsVsV7 | 126 | 5,589 | 40,758 |
| stress | v10VsHiGHS | 117 | 45,972 | 17,625 |
| stress | v10VsV9 | 96 | 10,510 | 14,157 |
| stress | v10VsV7 | 95 | 10,058 | 14,094 |
| stress | v10VsV5 | 78 | 4,854 | 10,002 |
| stress | highsVsV7 | 86 | 7,274 | 31,677 |

변경 수의 미확보 값은 0이 아닙니다. native 안정성 주장은 같은 native 공동 완주 쌍에서 엄격히 적은 변경과 비용 구간 조건을 함께 요구합니다.

## 14. 다섯 방법이 모두 완주한 집합에서 요금·변경의 Pareto를 따로 봅니다.

다섯 방법의 동일 반복이 모두 완주한 부분집합만 사용합니다. 시나리오별 공동 반복을 평균한 뒤 시나리오를 동일 가중합니다.

| 패널 | 정책 | 시나리오/반복 | 총요금 평균합 ₩ | 추가요금 평균합 ₩ | 변경 평균합 |
| --- | --- | --- | --- | --- | --- |
| same-distribution | V5 유효 계획 유지 | 36 / 108 | 150,747,750 | 87,094,400 | 940 |
| same-distribution | V7 비용 다듬기 | 36 / 108 | 156,822,983 | 93,169,633 | 1,035 |
| same-distribution | V9 적시 후보 전달 | 36 / 108 | 156,749,683 | 93,096,333 | 1,106 |
| same-distribution | 독립 native HiGHS | 36 / 108 | 150,204,450 | 86,551,100 | 10,751 |
| same-distribution | V10 동일 요금 계획 유지 | 36 / 108 | 150,289,050 | 86,635,700 | 2,311 |
| stress | V5 유효 계획 유지 | 25 / 74 | 153,615,000 | 91,410,900 | 1,326 |
| stress | V7 비용 다듬기 | 25 / 74 | 159,157,533 | 96,953,433 | 1,493 |
| stress | V9 적시 후보 전달 | 25 / 74 | 158,948,233 | 96,744,133 | 1,584 |
| stress | 독립 native HiGHS | 25 / 74 | 153,112,500 | 90,908,400 | 8,785 |
| stress | V10 동일 요금 계획 유지 | 25 / 74 | 153,492,750 | 91,288,650 | 3,083 |

이 선택된 집합의 요금과 변경은 별도 축입니다. 우위는 양쪽 비악화와 한쪽 엄격 개선일 때만이며, 전체 완주 손실·선택 편향은 남습니다.

## 15. 원 날짜·요금·선택 근거와 통계를 독립 검산합니다.

Python이 2,160개 episode를 확인했습니다. V10 선택 호출 4,236개, 동률 유지 2,961개, 엄격 교체 0개를 원 날짜에서 재구성합니다.

| 검산 | 경계 |
| --- | --- |
| cache / proposal / selected 원 날짜 | 현재 요율·물리 자원·실행 잠금 재계산 |
| 동률 유지 / 엄격 교체 | 완전 proof와 기록된 기한 일관성 |
| bootstrap / 공동 Pareto / 관측 문턱 | 별도 Python 통계 검산; 같은 index SHA |
| 현장·전역 최적·외부 시계 인증 | 확인하지 않음 |

조건부 비용 구간은 공동 완주 선택 편향을 제거하지 않습니다. 내부 독립 검산은 제3자 인증이나 운영 보장이 아닙니다.

## 16. 실제 기능과 연구 기준을 같은 성과로 합치지 않습니다.

웹은 합성 주문·용량 사건의 날짜별 관측·잠금·실패·내보내기를 제공합니다. 명시적 가격·권한의 자원 메뉴는 별도 현재 관측 복구 도구입니다.

합성 웹 시뮬레이션 → native 연구 증거 → 공개 출처·독립 검산

작은 교육 예제는 공식 144개 입력이나 실제 현장 성과가 아닙니다. 자원 제안은 구매·배차가 아니며 V10 자체가 전역 최소 변경을 보장하지 않습니다.

## 17. 공개 자료로 개발을 계속하고 남은 검증은 범위별로 기록합니다.

공개 출처·공개 요율·재현 가능한 실험이 기본 개발 경로입니다. 기업 자료·연락처·현장 시험은 선택 확장이며 이 경로의 선행 조건이 아닙니다.

| 검증 기록 | 현재 상태 |
| --- | --- |
| 알고리즘 연구 | 완결 실험·두 검산; 선언된 문턱은 별도 판정 |
| 브라우저 실제 조작 | 미검증 · 지원 연결 입구 없음 |
| 현장 적합성 / 견적 / 효과 | 선택 확장 · 미실시; 공개 연구의 선행 조건 아님 |
| 본인 설명 / 질의 / 재현 | 빈 양식 제공 · 미확인 |
| 등록 / 당해 AI 규정 / 서약 | 명확히 확인되지 않음; 자료 제출 11/6 18:00 KST 해석 |

공개 등록은 정원 소진 시 종료하며 사용자의 자리·자격은 미확인입니다. 당해 AI 규정과 본인 이해를 대신 인증하지 않습니다.

## 18. 사전 문턱과 전체 원본을 함께 보고 다음 판단을 내립니다.

선언된 관측 문턱을 모두 충족하지 못했습니다. V10은 실험 선택 항목이며 기본값 권고 조건을 충족하지 않았습니다.

| 패널 | 모든 기준 완주 손실 0 | native 완주 손실 0 | 동일 쌍 변경 감소 | 두 비용 구간 조건 |
| --- | --- | --- | --- | --- |
| 동일 생성분포 · 새 주문 시드 | False | True | True | True |
| 스트레스 · 새 주문 시드 | False | False | True | True |

관측 문턱 통과도 운영 기본값 보장이 아닙니다. 전체 입력·모든 반복·실패·proof·고정 source·두 검산을 SHA로 전달하며 최초 결과를 덮어쓰지 않습니다.

## 전체 비교 요금·변경·불리한 결과

절감 = 기준 − 후보. 시나리오 내 공동 완주 반복을 먼저 평균한 뒤 시나리오를 동일 가중합니다. 비교별 분모가 다르고 실패 비용은 null입니다. 비용 구간은 선택된 공동 완주 집합에 조건부이며 독립 검산이 완주 선택 편향을 제거하지 않습니다.

### 동일 생성분포 · 새 주문 시드

| method | complete / all | all 3 repeats | unknown history | observed revisions / unknown | parent mean ms |
| --- | --- | --- | --- | --- | --- |
| stableRetainV5 | 122 / 216 | 40 | 0 | 4134 / 0 | 289.64 |
| costPolishV7 | 144 / 216 | 48 | 0 | 7492 / 0 | 310.02 |
| adaptiveV9 | 145 / 216 | 48 | 0 | 7702 / 0 | 355.47 |
| highsV8 | 153 / 216 | 51 | 0 | 55431 / 0 | 577.51 |
| stableHiGHSV10 | 156 / 216 | 52 | 0 | 12606 / 0 | 593.64 |

#### v10VsHiGHS · V10 동일 요금 계획 유지 / 독립 native HiGHS

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 51 / 153 | 382,292,050.00 | 382,336,650.00 | -44,600.00 | -0.01% | 3/42/6 | 30,000.00 | 20 / 60 | [-0.06264978374, 0.0178671957] |
| incremental | 51 / 153 | 222,751,650.00 | 222,796,250.00 | -44,600.00 | -0.02% | 3/42/6 | 30,000.00 | 20 / 60 | [-0.1066936675, 0.03042521996] |

완주 얻음/잃음: 3 / 0 episodes. 시나리오 평균 완주율 차이: 0.013889; 95% CI [0, 0.04166666667].
같은 공동 완주 반복의 변경 합: 53667 → 12117; n=153.

total: raw matched episode sums KRW 1,146,876,150.00 → 1,147,009,950.00; mean scenario saving KRW 95% CI [-3327.45098, 1594.803922]; bootstrap scenario n=51, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n24-r2`
- `v10-same-distribution-batch-release-balanced-n24-r3`
- `v10-same-distribution-batch-release-balanced-n50-r3`
- `v10-same-distribution-batch-release-balanced-n50-r4`
- `v10-same-distribution-batch-release-balanced-n100-r4`
- `v10-same-distribution-batch-release-tight-n50-r4`

**total / negativeEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-same-distribution-batch-release-balanced-n24-r3::repeat-1`
- `v10-same-distribution-batch-release-balanced-n24-r3::repeat-2`
- `v10-same-distribution-batch-release-balanced-n24-r3::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r3::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r3::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r3::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-tight-n50-r4::repeat-1`
- `v10-same-distribution-batch-release-tight-n50-r4::repeat-2`
- `v10-same-distribution-batch-release-tight-n50-r4::repeat-3`

incremental: raw matched episode sums KRW 668,254,950.00 → 668,388,750.00; mean scenario saving KRW 95% CI [-3327.45098, 1594.803922]; bootstrap scenario n=51, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n24-r2`
- `v10-same-distribution-batch-release-balanced-n24-r3`
- `v10-same-distribution-batch-release-balanced-n50-r3`
- `v10-same-distribution-batch-release-balanced-n50-r4`
- `v10-same-distribution-batch-release-balanced-n100-r4`
- `v10-same-distribution-batch-release-tight-n50-r4`

**incremental / negativeEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-same-distribution-batch-release-balanced-n24-r3::repeat-1`
- `v10-same-distribution-batch-release-balanced-n24-r3::repeat-2`
- `v10-same-distribution-batch-release-balanced-n24-r3::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r3::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r3::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r3::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-tight-n50-r4::repeat-1`
- `v10-same-distribution-batch-release-tight-n50-r4::repeat-2`
- `v10-same-distribution-batch-release-tight-n50-r4::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`

**lostEpisodeIds — all retained**

none / 없음 / 无

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### v10VsV9 · V10 동일 요금 계획 유지 / V9 적시 후보 전달

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 44 / 130 | 366,237,383.33 | 346,556,150.00 | 19,681,233.33 | 5.37% | 19/24/1 | 21,066.67 | 14 / 40 | [3.727077625, 6.986050377] |
| incremental | 44 / 130 | 215,649,083.33 | 195,967,850.00 | 19,681,233.33 | 9.13% | 19/24/1 | 21,066.67 | 14 / 40 | [6.391722115, 11.69514086] |

완주 얻음/잃음: 26 / 15 episodes. 시나리오 평균 완주율 차이: 0.050926; 95% CI [-0.0462962963, 0.1481481481].
같은 공동 완주 반복의 변경 합: 6033 → 9709; n=130.

total: raw matched episode sums KRW 1,098,712,150.00 → 1,039,668,450.00; mean scenario saving KRW 95% CI [179146.9602, 768878.589]; bootstrap scenario n=44, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4`

**total / negativeEpisodeIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`

incremental: raw matched episode sums KRW 646,947,250.00 → 587,903,550.00; mean scenario saving KRW 95% CI [179146.9602, 768878.589]; bootstrap scenario n=44, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4`

**incremental / negativeEpisodeIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`

**lostEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### v10VsV7 · V10 동일 요금 계획 유지 / V7 비용 다듬기

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 43 / 129 | 366,364,933.33 | 346,556,150.00 | 19,808,783.33 | 5.41% | 19/23/1 | 21,066.67 | 13 / 39 | [3.827665652, 7.105955147] |
| incremental | 43 / 129 | 215,776,633.33 | 195,967,850.00 | 19,808,783.33 | 9.18% | 19/23/1 | 21,066.67 | 13 / 39 | [6.488110178, 11.7562391] |

완주 얻음/잃음: 27 / 15 episodes. 시나리오 평균 완주율 차이: 0.055556; 95% CI [-0.04166666667, 0.1527777778].
같은 공동 완주 반복의 변경 합: 5778 → 9489; n=129.

total: raw matched episode sums KRW 1,099,094,800.00 → 1,039,668,450.00; mean scenario saving KRW 95% CI [187327.1027, 776915.4167]; bootstrap scenario n=43, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4`

**total / negativeEpisodeIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`

incremental: raw matched episode sums KRW 647,329,900.00 → 587,903,550.00; mean scenario saving KRW 95% CI [187327.1027, 776915.4167]; bootstrap scenario n=43, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4`

**incremental / negativeEpisodeIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`

**lostEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### v10VsV5 · V10 동일 요금 계획 유지 / V5 유효 계획 유지

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 38 / 114 | 178,162,050.00 | 177,138,550.00 | 1,023,500.00 | 0.57% | 13/22/3 | 33,200.00 | 12 / 36 | [0.1261379376, 1.161382881] |
| incremental | 38 / 114 | 101,304,800.00 | 100,281,300.00 | 1,023,500.00 | 1.01% | 13/22/3 | 33,200.00 | 12 / 36 | [0.2166765502, 2.068417925] |

완주 얻음/잃음: 42 / 8 episodes. 시나리오 평균 완주율 차이: 0.157407; 95% CI [0.06018518519, 0.2638888889].
같은 공동 완주 반복의 변경 합: 3351 → 7755; n=114.

total: raw matched episode sums KRW 534,486,150.00 → 531,415,650.00; mean scenario saving KRW 95% CI [4641.907895, 61188.35526]; bootstrap scenario n=38, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n50-r1`
- `v10-same-distribution-batch-release-balanced-n100-r4`
- `v10-same-distribution-batch-release-tight-n50-r1`

**total / negativeEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n50-r1::repeat-3`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v10-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v10-same-distribution-batch-release-tight-n50-r1::repeat-3`

incremental: raw matched episode sums KRW 303,914,400.00 → 300,843,900.00; mean scenario saving KRW 95% CI [4641.907895, 61188.35526]; bootstrap scenario n=38, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n50-r1`
- `v10-same-distribution-batch-release-balanced-n100-r4`
- `v10-same-distribution-batch-release-tight-n50-r1`

**incremental / negativeEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n50-r1::repeat-3`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v10-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v10-same-distribution-batch-release-tight-n50-r1::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v10-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v10-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r1::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r1::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r1::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r3::repeat-3`

**lostEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-tight-n50-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v10-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v10-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r1::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r1::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r1::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r3::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### highsVsV7 · 독립 native HiGHS / V7 비용 다듬기

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 42 / 126 | 338,080,983.33 | 319,662,050.00 | 18,418,933.33 | 5.45% | 19/22/1 | 2,866.67 | 13 / 39 | [3.590109484, 7.354110728] |
| incremental | 42 / 126 | 200,696,583.33 | 182,277,650.00 | 18,418,933.33 | 9.18% | 19/22/1 | 2,866.67 | 13 / 39 | [6.166972512, 11.98497554] |

완주 얻음/잃음: 27 / 18 episodes. 시나리오 평균 완주율 차이: 0.041667; 95% CI [-0.05555555556, 0.1527777778].
같은 공동 완주 반복의 변경 합: 5589 → 40758; n=126.

total: raw matched episode sums KRW 1,014,242,950.00 → 958,986,150.00; mean scenario saving KRW 95% CI [172865.3373, 756539.752]; bootstrap scenario n=42, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4`

**total / negativeEpisodeIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`

incremental: raw matched episode sums KRW 602,089,750.00 → 546,832,950.00; mean scenario saving KRW 95% CI [172865.3373, 756539.752]; bootstrap scenario n=42, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4`

**incremental / negativeEpisodeIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`

**lostEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`
- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### 다섯 방법 공동 완주: 요금/변경 별도 축
 
jointScenarioCount=36; jointEpisodeCount=108. 시나리오 내 공동 반복을 평균한 뒤 시나리오 평균을 합합니다. 변경 평균 축과 원 episode 변경 합은 별도입니다. 공동 표본 없음/미확보 변경은 null입니다.

| method | total scenario-mean sum KRW | incremental scenario-mean sum KRW | revision scenario-mean sum | raw episode revisions | full-sample complete / all |
| --- | --- | --- | --- | --- | --- |
| stableRetainV5 | 150,747,750.00 | 87,094,400.00 | 940.000 | 2,820 | 122 / 216 |
| costPolishV7 | 156,822,983.33 | 93,169,633.33 | 1,035.000 | 3,105 | 144 / 216 |
| adaptiveV9 | 156,749,683.33 | 93,096,333.33 | 1,106.000 | 3,318 | 145 / 216 |
| highsV8 | 150,204,450.00 | 86,551,100.00 | 10,751.000 | 32,253 | 153 / 216 |
| stableHiGHSV10 | 150,289,050.00 | 86,635,700.00 | 2,311.000 | 6,933 | 156 / 216 |

```json
{
  "totalAndRevisions": [
    {
      "method": "stableRetainV5",
      "dominates": [
        "costPolishV7",
        "adaptiveV9"
      ],
      "dominatedBy": [],
      "pareto": true
    },
    {
      "method": "costPolishV7",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
      ],
      "pareto": false
    },
    {
      "method": "adaptiveV9",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
      ],
      "pareto": false
    },
    {
      "method": "highsV8",
      "dominates": [],
      "dominatedBy": [],
      "pareto": true
    },
    {
      "method": "stableHiGHSV10",
      "dominates": [],
      "dominatedBy": [],
      "pareto": true
    }
  ],
  "incrementalAndRevisions": [
    {
      "method": "stableRetainV5",
      "dominates": [
        "costPolishV7",
        "adaptiveV9"
      ],
      "dominatedBy": [],
      "pareto": true
    },
    {
      "method": "costPolishV7",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
      ],
      "pareto": false
    },
    {
      "method": "adaptiveV9",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
      ],
      "pareto": false
    },
    {
      "method": "highsV8",
      "dominates": [],
      "dominatedBy": [],
      "pareto": true
    },
    {
      "method": "stableHiGHSV10",
      "dominates": [],
      "dominatedBy": [],
      "pareto": true
    }
  ]
}
```

#### 사전 선언한 관측 문턱

```json
{
  "candidateMethod": "stableHiGHSV10",
  "assessmentState": "complete-panel",
  "completionLossCountsByBaseline": {
    "highsV8": 0,
    "adaptiveV9": 15,
    "costPolishV7": 15,
    "stableRetainV5": 8
  },
  "completionNonRegressionAllBaselines": false,
  "defaultRecommendationEligible": false,
  "nativeComparison": {
    "lostEpisodeCount": 0,
    "revisionPairedEpisodeCount": 153,
    "revisionDelta": -41550,
    "strictRevisionReduction": true,
    "incrementalFeeClaim": "no_stable_advantage",
    "totalFeeClaim": "no_stable_advantage",
    "noRobustFeeDeterioration": true,
    "stabilityImprovementClaimAllowed": true
  },
  "scope": "Observed necessary gates only. Any full-sample completion loss against an old baseline prevents default eligibility. A fee interval containing zero gives no stable fee advantage; stability is conditional on the exact native paired set. No production or universal non-regression claim."
}
```

### 스트레스 · 새 주문 시드

| method | complete / all | all 3 repeats | unknown history | observed revisions / unknown | parent mean ms |
| --- | --- | --- | --- | --- | --- |
| stableRetainV5 | 81 / 216 | 27 | 0 | 6450 / 0 | 326.66 |
| costPolishV7 | 107 / 216 | 35 | 0 | 17994 / 0 | 412.07 |
| adaptiveV9 | 108 / 216 | 36 | 0 | 18356 / 0 | 455.25 |
| highsV8 | 120 / 216 | 40 | 0 | 60036 / 0 | 575.97 |
| stableHiGHSV10 | 132 / 216 | 44 | 0 | 25479 / 0 | 601.18 |

#### v10VsHiGHS · V10 동일 요금 계획 유지 / 독립 native HiGHS

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 39 / 117 | 298,311,900.00 | 298,801,300.00 | -489,400.00 | -0.16% | 3/28/8 | 392,150.00 | 15 / 45 | [-0.6282350661, 0.04157422929] |
| incremental | 39 / 117 | 171,870,200.00 | 172,359,600.00 | -489,400.00 | -0.28% | 3/28/8 | 392,150.00 | 15 / 45 | [-1.063162036, 0.06948376842] |

완주 얻음/잃음: 15 / 3 episodes. 시나리오 평균 완주율 차이: 0.055556; 95% CI [0, 0.125].
같은 공동 완주 반복의 변경 합: 45972 → 17625; n=117.

total: raw matched episode sums KRW 894,935,700.00 → 896,403,900.00; mean scenario saving KRW 95% CI [-36073.62179, 2406.987179]; bootstrap scenario n=39, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r3`
- `v10-stress-aged-backlog-balanced-n50-r2`
- `v10-stress-aged-backlog-balanced-n50-r3`
- `v10-stress-aged-backlog-balanced-n100-r1`
- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`
- `v10-stress-batch-release-tight-n50-r4`
- `v10-stress-batch-release-tight-n100-r1`

**total / negativeEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r3::repeat-3`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`
- `v10-stress-batch-release-balanced-n100-r4::repeat-3`
- `v10-stress-batch-release-tight-n50-r4::repeat-1`
- `v10-stress-batch-release-tight-n50-r4::repeat-2`
- `v10-stress-batch-release-tight-n50-r4::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

incremental: raw matched episode sums KRW 515,610,600.00 → 517,078,800.00; mean scenario saving KRW 95% CI [-36073.62179, 2406.987179]; bootstrap scenario n=39, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r3`
- `v10-stress-aged-backlog-balanced-n50-r2`
- `v10-stress-aged-backlog-balanced-n50-r3`
- `v10-stress-aged-backlog-balanced-n100-r1`
- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`
- `v10-stress-batch-release-tight-n50-r4`
- `v10-stress-batch-release-tight-n100-r1`

**incremental / negativeEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r3::repeat-3`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`
- `v10-stress-batch-release-balanced-n100-r4::repeat-3`
- `v10-stress-batch-release-tight-n50-r4::repeat-1`
- `v10-stress-batch-release-tight-n50-r4::repeat-2`
- `v10-stress-batch-release-tight-n50-r4::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-batch-release-tight-n100-r3::repeat-1`
- `v10-stress-batch-release-tight-n100-r3::repeat-2`
- `v10-stress-batch-release-tight-n100-r3::repeat-3`

**lostEpisodeIds — all retained**

- `v10-stress-new-arrivals-tight-n24-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-batch-release-tight-n100-r3::repeat-1`
- `v10-stress-batch-release-tight-n100-r3::repeat-2`
- `v10-stress-batch-release-tight-n100-r3::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### v10VsV9 · V10 동일 요금 계획 유지 / V9 적시 후보 전달

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 32 / 96 | 454,634,216.67 | 424,655,350.00 | 29,978,866.67 | 6.59% | 19/11/2 | 18,200.00 | 8 / 24 | [4.326216297, 8.641144431] |
| incremental | 32 / 96 | 267,992,266.67 | 238,013,400.00 | 29,978,866.67 | 11.19% | 19/11/2 | 18,200.00 | 8 / 24 | [7.343589128, 14.47182643] |

완주 얻음/잃음: 36 / 12 episodes. 시나리오 평균 완주율 차이: 0.111111; 95% CI [0.01388888889, 0.2222222222].
같은 공동 완주 반복의 변경 합: 10510 → 14157; n=96.

total: raw matched episode sums KRW 1,363,902,650.00 → 1,273,966,050.00; mean scenario saving KRW 95% CI [372086.1068, 1637375.729]; bootstrap scenario n=32, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`

**total / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`

incremental: raw matched episode sums KRW 803,976,800.00 → 714,040,200.00; mean scenario saving KRW 95% CI [372086.1068, 1637375.729]; bootstrap scenario n=32, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`

**incremental / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`

**gainedEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**lostEpisodeIds — all retained**

- `v10-stress-batch-release-tight-n50-r2::repeat-1`
- `v10-stress-batch-release-tight-n50-r2::repeat-2`
- `v10-stress-batch-release-tight-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n50-r3::repeat-1`
- `v10-stress-batch-release-tight-n50-r3::repeat-2`
- `v10-stress-batch-release-tight-n50-r3::repeat-3`
- `v10-stress-batch-release-tight-n100-r2::repeat-1`
- `v10-stress-batch-release-tight-n100-r2::repeat-2`
- `v10-stress-batch-release-tight-n100-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r4::repeat-1`
- `v10-stress-batch-release-tight-n100-r4::repeat-2`
- `v10-stress-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### v10VsV7 · V10 동일 요금 계획 유지 / V7 비용 다듬기

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 32 / 95 | 453,721,600.00 | 424,655,350.00 | 29,066,250.00 | 6.41% | 17/13/2 | 18,200.00 | 8 / 24 | [4.055387922, 8.636337618] |
| incremental | 32 / 95 | 267,079,650.00 | 238,013,400.00 | 29,066,250.00 | 10.88% | 17/13/2 | 18,200.00 | 8 / 24 | [6.905172586, 14.42325021] |

완주 얻음/잃음: 37 / 12 episodes. 시나리오 평균 완주율 차이: 0.115741; 95% CI [0.01388888889, 0.222337963].
같은 공동 완주 반복의 변경 합: 10058 → 14094; n=95.

total: raw matched episode sums KRW 1,344,355,850.00 → 1,257,187,100.00; mean scenario saving KRW 95% CI [363753.4766, 1588119.193]; bootstrap scenario n=32, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`

**total / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`
- `v10-stress-batch-release-balanced-n100-r4::repeat-3`

incremental: raw matched episode sums KRW 791,349,200.00 → 704,180,450.00; mean scenario saving KRW 95% CI [363753.4766, 1588119.193]; bootstrap scenario n=32, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`

**incremental / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`
- `v10-stress-batch-release-balanced-n100-r4::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**lostEpisodeIds — all retained**

- `v10-stress-batch-release-tight-n50-r2::repeat-1`
- `v10-stress-batch-release-tight-n50-r2::repeat-2`
- `v10-stress-batch-release-tight-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n50-r3::repeat-1`
- `v10-stress-batch-release-tight-n50-r3::repeat-2`
- `v10-stress-batch-release-tight-n50-r3::repeat-3`
- `v10-stress-batch-release-tight-n100-r2::repeat-1`
- `v10-stress-batch-release-tight-n100-r2::repeat-2`
- `v10-stress-batch-release-tight-n100-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r4::repeat-1`
- `v10-stress-batch-release-tight-n100-r4::repeat-2`
- `v10-stress-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### v10VsV5 · V10 동일 요금 계획 유지 / V5 유효 계획 유지

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 26 / 78 | 156,510,500.00 | 156,612,550.00 | -102,050.00 | -0.07% | 7/14/5 | 231,550.00 | 7 / 21 | [-0.8919465838, 0.3738398134] |
| incremental | 26 / 78 | 94,042,500.00 | 94,144,550.00 | -102,050.00 | -0.11% | 7/14/5 | 231,550.00 | 7 / 21 | [-1.377347012, 0.6338425076] |

완주 얻음/잃음: 54 / 3 episodes. 시나리오 평균 완주율 차이: 0.236111; 95% CI [0.1388888889, 0.3472222222].
같은 공동 완주 반복의 변경 합: 4854 → 10002; n=78.

total: raw matched episode sums KRW 469,531,500.00 → 469,837,650.00; mean scenario saving KRW 95% CI [-35018.50962, 25294.90385]; bootstrap scenario n=26, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`
- `v10-stress-batch-release-tight-n50-r1`
- `v10-stress-batch-release-tight-n50-r4`
- `v10-stress-batch-release-tight-n100-r1`

**total / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`
- `v10-stress-batch-release-balanced-n100-r4::repeat-3`
- `v10-stress-batch-release-tight-n50-r1::repeat-1`
- `v10-stress-batch-release-tight-n50-r1::repeat-2`
- `v10-stress-batch-release-tight-n50-r1::repeat-3`
- `v10-stress-batch-release-tight-n50-r4::repeat-1`
- `v10-stress-batch-release-tight-n50-r4::repeat-2`
- `v10-stress-batch-release-tight-n50-r4::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

incremental: raw matched episode sums KRW 282,127,500.00 → 282,433,650.00; mean scenario saving KRW 95% CI [-35018.50962, 25294.90385]; bootstrap scenario n=26, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`
- `v10-stress-batch-release-tight-n50-r1`
- `v10-stress-batch-release-tight-n50-r4`
- `v10-stress-batch-release-tight-n100-r1`

**incremental / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`
- `v10-stress-batch-release-balanced-n100-r4::repeat-3`
- `v10-stress-batch-release-tight-n50-r1::repeat-1`
- `v10-stress-batch-release-tight-n50-r1::repeat-2`
- `v10-stress-batch-release-tight-n50-r1::repeat-3`
- `v10-stress-batch-release-tight-n50-r4::repeat-1`
- `v10-stress-batch-release-tight-n50-r4::repeat-2`
- `v10-stress-batch-release-tight-n50-r4::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r4::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r4::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r4::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r4::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r3::repeat-1`
- `v10-stress-batch-release-tight-n100-r3::repeat-2`
- `v10-stress-batch-release-tight-n100-r3::repeat-3`

**lostEpisodeIds — all retained**

- `v10-stress-batch-release-tight-n50-r2::repeat-1`
- `v10-stress-batch-release-tight-n50-r2::repeat-2`
- `v10-stress-batch-release-tight-n50-r2::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r4::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r4::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r4::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r4::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r3::repeat-1`
- `v10-stress-batch-release-tight-n100-r3::repeat-2`
- `v10-stress-batch-release-tight-n100-r3::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### highsVsV7 · 독립 native HiGHS / V7 비용 다듬기

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 29 / 86 | 310,962,316.67 | 294,591,500.00 | 16,370,816.67 | 5.26% | 13/15/1 | 9,100.00 | 8 / 24 | [2.934802417, 7.745801663] |
| incremental | 29 / 86 | 184,893,716.67 | 168,522,900.00 | 16,370,816.67 | 8.85% | 13/15/1 | 9,100.00 | 8 / 24 | [4.955998979, 12.63684726] |

완주 얻음/잃음: 34 / 21 episodes. 시나리오 평균 완주율 차이: 0.060185; 95% CI [-0.05555555556, 0.1805555556].
같은 공동 완주 반복의 변경 합: 7274 → 31677; n=86.

total: raw matched episode sums KRW 916,078,000.00 → 867,045,550.00; mean scenario saving KRW 95% CI [184547.4425, 1056658.362]; bootstrap scenario n=29, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n100-r1`

**total / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n100-r1::repeat-1`
- `v10-stress-batch-release-balanced-n100-r1::repeat-2`
- `v10-stress-batch-release-balanced-n100-r1::repeat-3`

incremental: raw matched episode sums KRW 544,791,400.00 → 495,758,950.00; mean scenario saving KRW 95% CI [184547.4425, 1056658.362]; bootstrap scenario n=29, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n100-r1`

**incremental / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n100-r1::repeat-1`
- `v10-stress-batch-release-balanced-n100-r1::repeat-2`
- `v10-stress-batch-release-balanced-n100-r1::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**lostEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-stress-batch-release-tight-n50-r2::repeat-1`
- `v10-stress-batch-release-tight-n50-r2::repeat-2`
- `v10-stress-batch-release-tight-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n50-r3::repeat-1`
- `v10-stress-batch-release-tight-n50-r3::repeat-2`
- `v10-stress-batch-release-tight-n50-r3::repeat-3`
- `v10-stress-batch-release-tight-n100-r2::repeat-1`
- `v10-stress-batch-release-tight-n100-r2::repeat-2`
- `v10-stress-batch-release-tight-n100-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r3::repeat-1`
- `v10-stress-batch-release-tight-n100-r3::repeat-2`
- `v10-stress-batch-release-tight-n100-r3::repeat-3`
- `v10-stress-batch-release-tight-n100-r4::repeat-1`
- `v10-stress-batch-release-tight-n100-r4::repeat-2`
- `v10-stress-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### 다섯 방법 공동 완주: 요금/변경 별도 축
 
jointScenarioCount=25; jointEpisodeCount=74. 시나리오 내 공동 반복을 평균한 뒤 시나리오 평균을 합합니다. 변경 평균 축과 원 episode 변경 합은 별도입니다. 공동 표본 없음/미확보 변경은 null입니다.

| method | total scenario-mean sum KRW | incremental scenario-mean sum KRW | revision scenario-mean sum | raw episode revisions | full-sample complete / all |
| --- | --- | --- | --- | --- | --- |
| stableRetainV5 | 153,615,000.00 | 91,410,900.00 | 1,326.000 | 3,919 | 81 / 216 |
| costPolishV7 | 159,157,533.33 | 96,953,433.33 | 1,492.667 | 4,419 | 107 / 216 |
| adaptiveV9 | 158,948,233.33 | 96,744,133.33 | 1,583.667 | 4,692 | 108 / 216 |
| highsV8 | 153,112,500.00 | 90,908,400.00 | 8,785.000 | 26,274 | 120 / 216 |
| stableHiGHSV10 | 153,492,750.00 | 91,288,650.00 | 3,083.000 | 9,186 | 132 / 216 |

```json
{
  "totalAndRevisions": [
    {
      "method": "stableRetainV5",
      "dominates": [
        "costPolishV7",
        "adaptiveV9"
      ],
      "dominatedBy": [],
      "pareto": true
    },
    {
      "method": "costPolishV7",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
      ],
      "pareto": false
    },
    {
      "method": "adaptiveV9",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
      ],
      "pareto": false
    },
    {
      "method": "highsV8",
      "dominates": [],
      "dominatedBy": [],
      "pareto": true
    },
    {
      "method": "stableHiGHSV10",
      "dominates": [],
      "dominatedBy": [],
      "pareto": true
    }
  ],
  "incrementalAndRevisions": [
    {
      "method": "stableRetainV5",
      "dominates": [
        "costPolishV7",
        "adaptiveV9"
      ],
      "dominatedBy": [],
      "pareto": true
    },
    {
      "method": "costPolishV7",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
      ],
      "pareto": false
    },
    {
      "method": "adaptiveV9",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
      ],
      "pareto": false
    },
    {
      "method": "highsV8",
      "dominates": [],
      "dominatedBy": [],
      "pareto": true
    },
    {
      "method": "stableHiGHSV10",
      "dominates": [],
      "dominatedBy": [],
      "pareto": true
    }
  ]
}
```

#### 사전 선언한 관측 문턱

```json
{
  "candidateMethod": "stableHiGHSV10",
  "assessmentState": "complete-panel",
  "completionLossCountsByBaseline": {
    "highsV8": 3,
    "adaptiveV9": 12,
    "costPolishV7": 12,
    "stableRetainV5": 3
  },
  "completionNonRegressionAllBaselines": false,
  "defaultRecommendationEligible": false,
  "nativeComparison": {
    "lostEpisodeCount": 3,
    "revisionPairedEpisodeCount": 117,
    "revisionDelta": -28347,
    "strictRevisionReduction": true,
    "incrementalFeeClaim": "no_stable_advantage",
    "totalFeeClaim": "no_stable_advantage",
    "noRobustFeeDeterioration": true,
    "stabilityImprovementClaimAllowed": false
  },
  "scope": "Observed necessary gates only. Any full-sample completion loss against an old baseline prevents default eligibility. A fee interval containing zero gives no stable fee advantage; stability is conditional on the exact native paired set. No production or universal non-regression claim."
}
```

## 압력 완주 손실의 사후 읽기 전용 진단

native 대비 압력 손실 3회는 한 업무 시나리오의 세 반복입니다. D5 native는 약 4.3–4.5ms에 엄격 불가능을 반환했으며 초과 시간이 아닙니다. C017의 D4 시작 2일 연속 적출과 C010의 D5 납기·미실행 하한이 D5 최소 창고 수요 2를 요구하지만 알려진 용량은 1입니다.
이 증명은 V10의 이미 실행한 물리 prefix에 한정됩니다. D0부터 불가능하다는 뜻이나 D4 후보로 한 번 바꾸면 반드시 완주한다는 뜻이 아닙니다. 원 경로는 D1부터 달랐습니다. 새 solve·온라인 재실행·새 holdout 없이 원 최초 결과를 보존합니다.
원 증거와 범위: [v10-loss-diagnosis.zh.md](v10-loss-diagnosis.zh.md).

## 원본·재현·독립 선택 검산

| evidence input | SHA-256 |
| --- | --- |
| data/v10-results.json | 79a12024d00ab7a47e2834bcf42644901cfa49c1600e463494fb453e7f7ccfc9 |
| data/evidence-v10/v10-frozen-first/first-run/complete.json | 33d07f60afb4b4248682badc631512a54070cca22fd106c7dd5062d4669bf9c2 |
| data/protocol-v10.json | fa5c6d49f43f0bf79b1905ae445300396469a985134296e1bfff94bd544414ad |
| data/review-v10.json | def9cd2920b9976a02d2e495903a3b001369eea4f039d7216325878a81fd634d |
| data/bootstrap-review-v10.json | a55a55cf7d36a14eccbbb4b34162b8413bc4893d8d006d7b875b0ee9a30a3648 |
| data/v9-results.json | fe021614be03707bde070e499f7d626170f48add832bffe1ac38de1987399d1c |
| data/evidence-v9/v9-frozen-first/first-run/complete.json | 83d165a965e421af0ebc0b399f426eab3ae48eddc4a564374a6074f9edad7204 |
| data/review-v9.json | 7716e885b7ea673bba6e552b1e6c52f3137cad4157058b8d59696175f10c6c50 |
| data/championship-acceptance-v10.json | 98075e70e805b941ec8924f2008fc6d5721f4c0c43c9a9c4a76f6b65ed3b39a4 |
| data/v10-loss-diagnosis.json | 22f148545608fa82af15a360e30fa7a135bfcd3cebb864330ed5a0647eff82c3 |

```json
{
  "calls": 4236,
  "cacheAcceptedCalls": 2973,
  "nativeAcceptedCalls": 1119,
  "retainedCacheCalls": 2973,
  "completeNativeProposals": 4110,
  "strictReplacements": 0,
  "feeTiesRetained": 2961
}
```

```bash
python scripts/restore-evidence-v10.py
python scripts/review-v10.py --run data/evidence-v10/v10-frozen-first/first-run --output artifacts/review-v10-reproduction.json
python scripts/review-bootstrap-v10.py --run data/evidence-v10/v10-frozen-first/first-run --output artifacts/bootstrap-v10-reproduction.json
python scripts/build-defense-v10.py --require-results --bootstrap-review data/bootstrap-review-v10.json
```

Native HiGHS 연구 기준은 브라우저 GLPK 실행과 별도입니다. / Native HiGHS 研究基准与浏览器 GLPK 分开。
首次结果不可覆盖；新复现写入新路径。现场验收和本人答辩记录保持空白，不替用户填写通过。

