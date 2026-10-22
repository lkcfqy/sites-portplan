# PortPlan V9 · 적시 후보 전달과 오늘의 반출·적출·반납

AI 작성 준비 자료. 참가자 본인의 창작·검증·이해·참가자격 확인서가 아닙니다.

완결 공식 결과, 독립 물리 검산, 별도 bootstrap 검산이 동일 원본 SHA-256에 연결된 뒤 작성했습니다. 알려진 합성 주문의 일 단위 모형 연구이며 실제 기업 실현 절감액이 아닙니다.

이 고정 평가에서 V9는 두 패널 모두 V8보다 완주 수가 많았습니다.

## 01. 오늘의 반출·적출·반납을 실행 가능한 날짜로 연결합니다.

PortPlan은 알려진 수입 컨테이너와 일별 운송·창고·체류 공간을 함께 계획하는 연구용 도구입니다. 이번 V9는 완전 후보를 제시간에 전달하는 문제를 검증합니다.

현재 정보·실행 잠금 → 완전한 날짜 후보 → 기한 내 검사·수락

이 고정 평가에서 V9는 두 패널 모두 V8보다 완주 수가 많았습니다. V9 동일 생성분포 · 새 주문 시드 150/216; 스트레스 · 새 주문 시드 84/216 / V8 동일 생성분포 · 새 주문 시드 96/216; 스트레스 · 새 주문 시드 57/216 / V7 동일 생성분포 · 새 주문 시드 150/216; 스트레스 · 새 주문 시드 85/216. 합성 모델 결과이며 실제 기업 절감·우승 확률이 아닙니다.

## 02. 세 행동의 날짜와 요금을 같은 자원 장부에서 계산합니다.

반출·반납은 각각 운송 작업을 사용합니다. 적출은 연속 창고 일수를 차지하고, 반출부터 반납 전까지 체류 공간을 점유합니다.

| 행동/모형 | 계산할 항목 | 경계 |
| --- | --- | --- |
| 반출 p / 적출 u / 반납 r | 방출·납기·선후행·실행 잠금 | 일 단위 원자적 실행 |
| 운송·연속 창고·체류 [p,r) | 날짜별 용량; container 또는 TEU | 도로 경로·슬롯·기사 근무시간 미포함 |
| PNC 보관료 / Maersk D&D | 공개 요율·기산일·누진/소급 가정 | 개별 계약·청구서·세금 미확인 |

비용 목표는 선언된 두 요금입니다. 기존 주문은 시작 시 모두 알려지며 신규 주문 도착을 평가하지 않습니다.

## 03. V8의 실제 후퇴를 개선의 출발점으로 남깁니다.

이전 최초 평가에서 V8은 V7보다 완주가 적었습니다. 내부 구성기가 후보를 찾았다는 사실만으로 외부 계획기가 기한 내 검사·수락했다고 볼 수 없었습니다.

| 이전 V8 평가 · 별도 입력 | V8 완주 | V7 완주 |
| --- | --- | --- |
| 동일 생성분포 · 새 주문 시드 | 80/216 | 156/216 |
| 스트레스 · 새 주문 시드 | 48/216 | 89/216 |

이전 결과와 실패를 수정하지 않습니다. 예산 소진·늦은 인수·추가 검사 비용을 V9의 개발 동기로 사용하며, 새 성능 분모에 합치지 않습니다.

## 04. V9 가설: 먼저 받은 완전 후보를 외부 검사 뒤 보존합니다.

구성기의 동기식 onCandidate가 외부 gate에 후보를 전달합니다. 외부 gate는 복사·재가격·물리/잠금 검사·선택이 끝난 시각으로 수락을 결정합니다.

구성기 후보 → 실제 수신 → 독립 날짜 복사·검사 → 기한 내 수락만 보존

공식 평가에서는 observer와 부모 후보 stream을 쓰지 않습니다. 부모 IPC 확인이나 내부 firstIncumbentMs를 일별 수락 증거로 바꾸지 않습니다. 가설의 지지는 실제 결과로 판단합니다.

## 05. 유지·개선·복구의 조건은 전달 방식과 구분합니다.

현재 계획이 유효하면 유지하거나 더 저렴한 후보만 검토합니다. 실행한 날짜는 잠그고, 미실행 날짜 변경 수와 단기 명목 압력을 보호합니다.

| 조건 | 선언된 수락 규칙 |
| --- | --- |
| 유효 cache | 기본 유지; 비용이 엄격히 낮은 후보만 개선 검토 |
| 날짜 변경·비용 허용 | 최대 6개 미실행 사건 변경; 0.5% 허용 경계 |
| 단기 압력 | 현재 명목 예측의 2일 대리 지표 비악화 |
| 무효 cache / 초기 계획 | 실행 잠금과 날짜 하한을 지킨 완전 복구 후보 |

현재 snapshot의 수락 조건입니다. 미래 완주 보장·전체 경로 비용 비증가·전역 최적을 뜻하지 않습니다.

## 06. 자원이 부족하면 명시한 메뉴에서 구매 비용을 계산합니다.

각 추가 자원 package에 가격·단위·날짜·가용일·허용 여부를 입력합니다. 승인된 현재/미래 package만 선택하여 고정 실행 이력을 지킨 복구안을 제안합니다.

| 선택 목표 | 증명할 수 있는 범위 |
| --- | --- |
| procurementOnly | 명시된 유한 메뉴 내 추가 구매비 최소 |
| feesPlusProcurement | 현재 모델의 추가 요금 + 구매비 최소 |
| feasible / time limit | 검사한 후보; 최소 비용이 증명된 것은 아님 |
| optimal / infeasible proof | 해당 모델·허용 메뉴에 한정; 실제 공급 보장 아님 |

모형 권고이며 구매·배차를 실행하지 않습니다. 메뉴 밖 대안, 미래 미공지 충격, 실제 견적·조달 가능성·현장 수익은 검증하지 않았습니다.

## 07. 분모와 예산은 새 입력을 만들기 전에 고정했습니다.

144개 업무 시나리오 × 5개 정책 × 3개 반복 = 2,160개 episode. 두 패널 모두 V8의 생성기·충격 유형을 유지하고 새 주문 시드를 사용했습니다.

| 패널 | 업무 시나리오 | 평가 범위 |
| --- | --- | --- |
| 동일 생성분포 | 72 | 기존 생성기·충격 유형; 새 독립 입력 시드 |
| 스트레스 | 72 | V8과 같은 반복 감소·회복 연장/점진 회복·연속 자원 충격 |
| 반복/예산 | 3회 / 냉 5,000ms | 반복은 새 업무 표본 아님; 초기화·모든 결정·IPC·최종 검사 포함 |

정책은 직렬 실행하고 순서를 순환합니다. 일별 내부 시계가 완전히 같거나 실제 운영 실시간 보장을 한다고 주장하지 않습니다.

## 08. 동일 생성분포 · 새 주문 시드 완주와 이력 미확보를 먼저 확인합니다.

완주는 물리 행동과 최종 검사까지 부모 기한 내 수락한 경우입니다. 이력을 확보하지 못한 episode를 물리 불가능이나 0원으로 바꾸지 않습니다.

| 정책 | 완주 episode / 전체 | 세 반복 모두 완주 시나리오 | 미확보 이력 |
| --- | --- | --- | --- |
| V5 유효 계획 유지 | 129 / 216 | 43 | 0 |
| V7 비용 다듬기 | 150 / 216 | 50 | 0 |
| V8 조건부 의사결정 | 96 / 216 | 32 | 0 |
| V9 적시 후보 전달 | 150 / 216 | 50 | 0 |
| 독립 native HiGHS | 156 / 216 | 52 | 0 |

막대는 episode 완주 수입니다. 3회 모두 완주한 시나리오와 미확보 이력을 별도로 표시합니다.

## 09. 동일 생성분포 · 새 주문 시드 공동 완주한 동일 반복만 요금을 비교합니다.

양수는 후보가 더 저렴합니다. 시나리오마다 일치하는 완주 반복을 먼저 평균하고 시나리오를 동일 가중합니다.

| 후보 / 기준 | 시나리오 / 쌍 | 총요금 절감 | 추가요금 절감 | 낮음/동일/높음 |
| --- | --- | --- | --- | --- |
| V9 적시 후보 전달 / V8 조건부 의사결정 | 32 / 96 | 0.00% | 0.00% | 0/32/0 |
| V9 적시 후보 전달 / V7 비용 다듬기 | 50 / 150 | -0.68% | -1.22% | 7/40/3 |
| V9 적시 후보 전달 / V5 유효 계획 유지 | 41 / 123 | -3.72% | -7.00% | 1/31/9 |
| V9 적시 후보 전달 / 독립 native HiGHS | 45 / 135 | -6.62% | -12.36% | 2/22/21 |
| 독립 native HiGHS / V7 비용 다듬기 | 45 / 135 | 5.59% | 9.95% | 22/21/2 |

비교마다 선택된 분모가 다릅니다. 실패 비용은 null입니다. 원화 분모·모든 악화 ID·조건부 구간은 보고서에 공개합니다.

## 10. 스트레스 · 새 주문 시드 완주와 이력 미확보를 먼저 확인합니다.

완주는 물리 행동과 최종 검사까지 부모 기한 내 수락한 경우입니다. 이력을 확보하지 못한 episode를 물리 불가능이나 0원으로 바꾸지 않습니다.

| 정책 | 완주 episode / 전체 | 세 반복 모두 완주 시나리오 | 미확보 이력 |
| --- | --- | --- | --- |
| V5 유효 계획 유지 | 72 / 216 | 23 | 0 |
| V7 비용 다듬기 | 85 / 216 | 28 | 0 |
| V8 조건부 의사결정 | 57 / 216 | 19 | 0 |
| V9 적시 후보 전달 | 84 / 216 | 27 | 0 |
| 독립 native HiGHS | 119 / 216 | 39 | 0 |

막대는 episode 완주 수입니다. 3회 모두 완주한 시나리오와 미확보 이력을 별도로 표시합니다.

## 11. 스트레스 · 새 주문 시드 공동 완주한 동일 반복만 요금을 비교합니다.

양수는 후보가 더 저렴합니다. 시나리오마다 일치하는 완주 반복을 먼저 평균하고 시나리오를 동일 가중합니다.

| 후보 / 기준 | 시나리오 / 쌍 | 총요금 절감 | 추가요금 절감 | 낮음/동일/높음 |
| --- | --- | --- | --- | --- |
| V9 적시 후보 전달 / V8 조건부 의사결정 | 19 / 55 | -0.05% | -0.08% | 0/17/2 |
| V9 적시 후보 전달 / V7 비용 다듬기 | 28 / 83 | 0.03% | 0.05% | 2/24/2 |
| V9 적시 후보 전달 / V5 유효 계획 유지 | 25 / 70 | -3.71% | -6.54% | 0/16/9 |
| V9 적시 후보 전달 / 독립 native HiGHS | 26 / 77 | -4.22% | -7.45% | 1/11/14 |
| 독립 native HiGHS / V7 비용 다듬기 | 26 / 78 | 4.09% | 6.99% | 13/12/1 |

비교마다 선택된 분모가 다릅니다. 실패 비용은 null입니다. 원화 분모·모든 악화 ID·조건부 구간은 보고서에 공개합니다.

## 12. 완주 손실과 비용 악화를 모든 비교에서 보존합니다.

완주 증감은 episode 기준이며, 최악 요금 악화는 공동 완주 시나리오 평균 기준입니다. 유리한 분모만 골라 결론을 바꾸지 않습니다.

| 패널 | 비교 | 총요금 악화 시나리오 | 최악 증가 ₩ | 완주 얻음/잃음 |
| --- | --- | --- | --- | --- |
| same-distribution | v9VsV8 | 0 | 0 | 54 / 0 |
| same-distribution | v9VsV7 | 3 | 1,799,833 | 0 / 0 |
| same-distribution | v9VsV5 | 9 | 4,937,067 | 27 / 6 |
| same-distribution | v9VsHiGHS | 21 | 5,265,267 | 15 / 21 |
| same-distribution | highsVsV7 | 2 | 45,000 | 21 / 15 |
| stress | v9VsV8 | 2 | 29,433 | 29 / 2 |
| stress | v9VsV7 | 2 | 29,433 | 1 / 2 |
| stress | v9VsV5 | 9 | 2,000,217 | 14 / 2 |
| stress | v9VsHiGHS | 14 | 2,347,250 | 7 / 42 |
| stress | highsVsV7 | 1 | 18,200 | 41 / 7 |

총/추가 요금의 모든 악화 시나리오·반복 ID와 완주 손실 ID를 별도 보고서에 그대로 남깁니다.

## 13. 더 많은 완주에도 계산과 날짜 변경의 대가가 있습니다.

날짜 변경은 미실행 사건 날짜의 변경 횟수입니다. 서로 다른 상자 수·작업자 시간·재배차 비용으로 바꾸어 해석하지 않습니다.

| 패널 | 정책 | 평균 부모 ms | 강제 기한 | 관측 변경 / 미확보 episode |
| --- | --- | --- | --- | --- |
| same-distribution | V5 유효 계획 유지 | 287.5 | 0 | 4172 / 0 |
| same-distribution | V7 비용 다듬기 | 303.6 | 0 | 7493 / 0 |
| same-distribution | V8 조건부 의사결정 | 249.8 | 0 | 2184 / 0 |
| same-distribution | V9 적시 후보 전달 | 356.4 | 0 | 7524 / 0 |
| same-distribution | 독립 native HiGHS | 569.1 | 0 | 54054 / 0 |
| stress | V5 유효 계획 유지 | 308.4 | 0 | 5836 / 0 |
| stress | V7 비용 다듬기 | 394.3 | 0 | 14945 / 0 |
| stress | V8 조건부 의사결정 | 265.5 | 0 | 2918 / 0 |
| stress | V9 적시 후보 전달 | 431.6 | 0 | 15395 / 0 |
| stress | 독립 native HiGHS | 564.1 | 0 | 52530 / 0 |

native HiGHS는 같은 모델의 서버 기준이며 웹의 GLPK와 구분합니다. native 시작 시간도 전체 부모 예산에 포함합니다.

## 14. 후보를 찾은 시각과 검사·수락한 시각을 구분합니다.

각 V9 일별 후보의 실제 수신·복사 완료·감사 완료·선택 완료·수락 시각을 전체 receipt sequence와 날짜로 보존합니다. 늦은 후보와 거부 이유도 남깁니다.

| 보존하는 증거 | 확인할 경계 |
| --- | --- |
| candidateDelivery.events 전체 | 수신·복사·감사·선택의 순서와 예산 경계 |
| 선택된 sequence와 날짜 | 독립 재가격·자원·물리 잠금 재구성 |
| 늦음·무효·guard 거부 | 성공 후보만 선별하지 않음 |
| 전체 episode receipt 없음 | 과거 이력·비용 미확보; 후보 부재 증명 아님 |

별도 Python 검산은 기록된 시각의 일관성과 날짜를 재구성합니다. 외부 계측 인증이나 절대 CPU/실시간 보장이 아닙니다.

## 15. 물리와 통계는 서로 다른 Python 검산으로 확인합니다.

독립 장부가 2,160개 episode, 수락 계획 16,519개, 기록된 물리 행동 209,468개를 재구성했습니다. 구간은 별도 통계 검산에 연결합니다.

| 검산 | 범위와 한계 |
| --- | --- |
| 물리·요율·잠금·V9 gate | JS 행렬 미재사용; 내부 독립 구현 |
| scenario-cluster 95% bootstrap | 시나리오 단위 재표집; 별도 Python 재계산 |
| 공동 완주 조건 | 비용 구간의 완주 선택 편향은 남음 |
| 현장·전역 최적·외부 인증 | 이 검산으로 확인하지 않음 |

두 검산은 같은 formal index와 frozen manifest SHA에 묶습니다. 432개 반복을 432개 독립 시나리오로 세지 않습니다.

## 16. 화면에서 내 입력과 명시적 보완 자원을 검토합니다.

주문·모의 용량 사건을 입력하고 두 정책을 순차 비교합니다. 날짜별 정보·실행 잠금·권고·중단 이유를 확인하고 정확한 입력과 결과를 내보냅니다.

입력·가정 확인 → 계획·실패·메뉴 권고 → 입력·장부 내보내기

작은 성공/중단 예시는 합성 학습용입니다. 공식 144개 연구 입력이나 실제 현장 실적이 아닙니다. 보완 자원 제안은 구매가 아닙니다.

## 17. 개인 기여와 현실 검증을 대신 완료로 표시하지 않습니다.

이번 증거는 알려진 합성 주문의 일별 완주·요금·안정성에 한정됩니다. 기존 PSPLIB와 벌크항만 로그의 부분 검증을 실제 컨테이너 절감으로 합치지 않습니다.

| 주체/주장 | 현재 상태 |
| --- | --- |
| 구현·실험·검산·자료 작성 | AI 수행; 원 연구·코드·라이선스 귀속 유지 |
| 사용자 본인 개발·이해·발표 숙련 | pending · 대신 인정하지 않음 |
| 전문가·기업·실제 청구·실현 절감 | 미수행 |
| 참가 자격·등록·서약·AI 규정 | 본 자료로 확인하거나 제출하지 않음 |

최초 알고리즘·SOTA·모든 경우 우월·현실 ROI·우승 확률을 주장하지 않습니다.

## 18. 같은 결정을 다시 계산할 전체 증거를 전달합니다.

새 입력·모든 반복·실패·기한 손실·완전한 후보 receipt·고정 source·독립 검산을 SHA로 연결합니다. 재현은 새 경로에 기록합니다.

| 자료 | 확인할 내용 |
| --- | --- |
| 한국어 보고서 | 정확한 원화·분모·구간·모든 악화/손실 ID |
| 동일 원고의 PDF / 편집 가능 PPTX | 18쪽 이하; 표·문자·도형이 편집 가능 |
| 영어 이해 노트 / 기여 기록 | 가정·결과·한계·미확인 본인 작업 |
| V9 formal archive + 두 검산 | 원 입력·모든 episode·고정 source의 해시 연결 |

이 고정 평가에서 V9는 두 패널 모두 V8보다 완주 수가 많았습니다. 다음 판단도 완주·조건부 요금·변경 대가를 함께 사용합니다. 자료 준비는 대회 제출이나 서명이 아닙니다.

## 정확한 요금·완주 분모·조건부 구간·모든 악화 목록

절감 = 기준 − 후보. 각 시나리오에서 일치한 공동 완주 반복만 평균한 뒤 시나리오를 동일 가중합니다. 총요금과 추가요금의 원화 분모가 다릅니다. 0원 분모의 비율은 null입니다.
모든 95% 구간은 percentile scenario-cluster bootstrap이며 별도 Python 통계 검산에서 동일 원본으로 재계산했습니다. 비용 구간은 선택된 공동 완주 쌍에 조건부입니다. 검산이 완주 선택 편향을 제거하거나 관측 밖 운영 집단으로의 외삽을 정당화하지 않습니다.
날짜 변경의 원가를 관측하지 않았습니다. 날짜 변경 수를 비용에 합산하거나 작업자 시간·재배차비로 환산하지 않습니다.

### 동일 생성분포 · 새 주문 시드

| 정책 | 전체 episode | 완주 | 3회 모두 완주 시나리오 | 1회 이상 완주 시나리오 | 이력 미확보 |
| --- | --- | --- | --- | --- | --- |
| V5 유효 계획 유지 | 216 | 129 | 43 | 43 | 0 |
| V7 비용 다듬기 | 216 | 150 | 50 | 50 | 0 |
| V8 조건부 의사결정 | 216 | 96 | 32 | 32 | 0 |
| V9 적시 후보 전달 | 216 | 150 | 50 | 50 | 0 |
| 독립 native HiGHS | 216 | 156 | 52 | 52 | 0 |

#### v9VsV8 · V9 적시 후보 전달 / V8 조건부 의사결정

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 32 / 96 | 66,452,450.00 | 66,452,450.00 | 0.00 | 0.00% | 0/32/0 | 0.00 | 11 / 33 | [0.00, 0.00] |
| incremental | 32 / 96 | 38,376,500.00 | 38,376,500.00 | 0.00 | 0.00% | 0/32/0 | 0.00 | 11 / 33 | [0.00, 0.00] |

완주 얻음/잃음 episode: 54 / 0. 시나리오 평균 완주율 차이: 0.250000; 독립 검산 95% 구간: [0.15, 0.35].
공동 완주 반복의 관측 날짜 변경 합: 1908 → 1908; 96쌍.

total 원 반복 단위 비용합: 기준 199,357,350.00 ₩ / 후보 199,357,350.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
total 시나리오 평균 절감 원화 95% 구간: [0.00, 0.00]; bootstrap 시나리오 32개 / draw 2000회.

**total / negativeScenarioIds — 전체 보존**

없음.

**total / negativeEpisodeIds — 전체 보존**

없음.

incremental 원 반복 단위 비용합: 기준 115,129,500.00 ₩ / 후보 115,129,500.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
incremental 시나리오 평균 절감 원화 95% 구간: [0.00, 0.00]; bootstrap 시나리오 32개 / draw 2000회.

**incremental / negativeScenarioIds — 전체 보존**

없음.

**incremental / negativeEpisodeIds — 전체 보존**

없음.

**gainedEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n50-r1::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r1::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-3`

**lostEpisodeIds — 전체 보존**

없음.

**gainedFromKnownFailureEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n50-r1::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r1::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### v9VsV7 · V9 적시 후보 전달 / V7 비용 다듬기

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 50 / 150 | 444,944,383.33 | 447,973,816.67 | -3,029,433.33 | -0.68% | 7/40/3 | 1,799,833.33 | 12 / 36 | [-1.47, 0.22] |
| incremental | 50 / 150 | 248,471,883.33 | 251,501,316.67 | -3,029,433.33 | -1.22% | 7/40/3 | 1,799,833.33 | 12 / 36 | [-2.62, 0.39] |

완주 얻음/잃음 episode: 0 / 0. 시나리오 평균 완주율 차이: 0.000000; 독립 검산 95% 구간: [0.00, 0.00].
공동 완주 반복의 관측 날짜 변경 합: 7175 → 7206; 150쌍.

total 원 반복 단위 비용합: 기준 1,334,833,150.00 ₩ / 후보 1,343,921,450.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
total 시나리오 평균 절감 원화 95% 구간: [-160,799.77, 13,335.22]; bootstrap 시나리오 50개 / draw 2000회.

**total / negativeScenarioIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n100-r1`
- `v9-same-distribution-aged-backlog-balanced-n100-r3`
- `v9-same-distribution-aged-backlog-balanced-n100-r4`

**total / negativeEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-1`

incremental 원 반복 단위 비용합: 기준 745,415,650.00 ₩ / 후보 754,503,950.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
incremental 시나리오 평균 절감 원화 95% 구간: [-160,799.77, 13,335.22]; bootstrap 시나리오 50개 / draw 2000회.

**incremental / negativeScenarioIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n100-r1`
- `v9-same-distribution-aged-backlog-balanced-n100-r3`
- `v9-same-distribution-aged-backlog-balanced-n100-r4`

**incremental / negativeEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-1`

**gainedEpisodeIds — 전체 보존**

없음.

**lostEpisodeIds — 전체 보존**

없음.

**gainedFromKnownFailureEpisodeIds — 전체 보존**

없음.

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### v9VsV5 · V9 적시 후보 전달 / V5 유효 계획 유지

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 41 / 123 | 242,939,183.33 | 251,973,733.33 | -9,034,550.00 | -3.72% | 1/31/9 | 4,937,066.67 | 11 / 33 | [-6.39, -1.11] |
| incremental | 41 / 123 | 129,023,383.33 | 138,057,933.33 | -9,034,550.00 | -7.00% | 1/31/9 | 4,937,066.67 | 11 / 33 | [-12.06, -2.06] |

완주 얻음/잃음 episode: 27 / 6. 시나리오 평균 완주율 차이: 0.097222; 독립 검산 95% 구간: [0.01, 0.18].
공동 완주 반복의 관측 날짜 변경 합: 3740 → 4080; 123쌍.

total 원 반복 단위 비용합: 기준 728,817,550.00 ₩ / 후보 755,921,200.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
total 시나리오 평균 절감 원화 95% 구간: [-505,373.73, -43,857.89]; bootstrap 시나리오 41개 / draw 2000회.

**total / negativeScenarioIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n24-r1`
- `v9-same-distribution-aged-backlog-balanced-n50-r2`
- `v9-same-distribution-aged-backlog-balanced-n50-r3`
- `v9-same-distribution-aged-backlog-balanced-n50-r4`
- `v9-same-distribution-aged-backlog-balanced-n100-r3`
- `v9-same-distribution-new-arrivals-tight-n100-r1`
- `v9-same-distribution-batch-release-tight-n50-r1`
- `v9-same-distribution-batch-release-tight-n50-r2`
- `v9-same-distribution-batch-release-tight-n50-r3`

**total / negativeEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n24-r1::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n24-r1::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n24-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-3`

incremental 원 반복 단위 비용합: 기준 387,070,150.00 ₩ / 후보 414,173,800.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
incremental 시나리오 평균 절감 원화 95% 구간: [-505,373.73, -43,857.89]; bootstrap 시나리오 41개 / draw 2000회.

**incremental / negativeScenarioIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n24-r1`
- `v9-same-distribution-aged-backlog-balanced-n50-r2`
- `v9-same-distribution-aged-backlog-balanced-n50-r3`
- `v9-same-distribution-aged-backlog-balanced-n50-r4`
- `v9-same-distribution-aged-backlog-balanced-n100-r3`
- `v9-same-distribution-new-arrivals-tight-n100-r1`
- `v9-same-distribution-batch-release-tight-n50-r1`
- `v9-same-distribution-batch-release-tight-n50-r2`
- `v9-same-distribution-batch-release-tight-n50-r3`

**incremental / negativeEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n24-r1::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n24-r1::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n24-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-3`

**gainedEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-3`

**lostEpisodeIds — 전체 보존**

- `v9-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n24-r4::repeat-1`
- `v9-same-distribution-batch-release-tight-n24-r4::repeat-2`
- `v9-same-distribution-batch-release-tight-n24-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### v9VsHiGHS · V9 적시 후보 전달 / 독립 native HiGHS

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 45 / 135 | 357,410,400.00 | 381,079,700.00 | -23,669,300.00 | -6.62% | 2/22/21 | 5,265,266.67 | 13 / 39 | [-9.55, -4.04] |
| incremental | 45 / 135 | 191,433,350.00 | 215,102,650.00 | -23,669,300.00 | -12.36% | 2/22/21 | 5,265,266.67 | 13 / 39 | [-17.36, -7.51] |

완주 얻음/잃음 episode: 15 / 21. 시나리오 평균 완주율 차이: -0.027778; 독립 검산 95% 구간: [-0.12, 0.07].
공동 완주 반복의 관측 날짜 변경 합: 46317 → 5487; 135쌍.

total 원 반복 단위 비용합: 기준 1,072,231,200.00 ₩ / 후보 1,143,239,100.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
total 시나리오 평균 절감 원화 95% 구간: [-874,626.05, -211,607.58]; bootstrap 시나리오 45개 / draw 2000회.

**total / negativeScenarioIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n24-r1`
- `v9-same-distribution-aged-backlog-balanced-n24-r2`
- `v9-same-distribution-aged-backlog-balanced-n50-r1`
- `v9-same-distribution-aged-backlog-balanced-n50-r2`
- `v9-same-distribution-aged-backlog-balanced-n50-r3`
- `v9-same-distribution-aged-backlog-balanced-n50-r4`
- `v9-same-distribution-aged-backlog-balanced-n100-r1`
- `v9-same-distribution-aged-backlog-balanced-n100-r2`
- `v9-same-distribution-aged-backlog-balanced-n100-r4`
- `v9-same-distribution-new-arrivals-tight-n24-r4`
- `v9-same-distribution-new-arrivals-tight-n50-r3`
- `v9-same-distribution-batch-release-balanced-n50-r4`
- `v9-same-distribution-batch-release-balanced-n100-r3`
- `v9-same-distribution-batch-release-balanced-n100-r4`
- `v9-same-distribution-batch-release-tight-n50-r1`
- `v9-same-distribution-batch-release-tight-n50-r2`
- `v9-same-distribution-batch-release-tight-n50-r3`
- `v9-same-distribution-batch-release-tight-n100-r1`
- `v9-same-distribution-batch-release-tight-n100-r2`
- `v9-same-distribution-batch-release-tight-n100-r3`
- `v9-same-distribution-batch-release-tight-n100-r4`

**total / negativeEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n24-r1::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n24-r1::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n24-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r1::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r1::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n24-r4::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n24-r4::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n24-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r3::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r3::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r3::repeat-3`
- `v9-same-distribution-batch-release-balanced-n50-r4::repeat-1`
- `v9-same-distribution-batch-release-balanced-n50-r4::repeat-2`
- `v9-same-distribution-batch-release-balanced-n50-r4::repeat-3`
- `v9-same-distribution-batch-release-balanced-n100-r3::repeat-1`
- `v9-same-distribution-batch-release-balanced-n100-r3::repeat-2`
- `v9-same-distribution-batch-release-balanced-n100-r3::repeat-3`
- `v9-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v9-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v9-same-distribution-batch-release-balanced-n100-r4::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-3`

incremental 원 반복 단위 비용합: 기준 574,300,050.00 ₩ / 후보 645,307,950.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
incremental 시나리오 평균 절감 원화 95% 구간: [-874,626.05, -211,607.58]; bootstrap 시나리오 45개 / draw 2000회.

**incremental / negativeScenarioIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n24-r1`
- `v9-same-distribution-aged-backlog-balanced-n24-r2`
- `v9-same-distribution-aged-backlog-balanced-n50-r1`
- `v9-same-distribution-aged-backlog-balanced-n50-r2`
- `v9-same-distribution-aged-backlog-balanced-n50-r3`
- `v9-same-distribution-aged-backlog-balanced-n50-r4`
- `v9-same-distribution-aged-backlog-balanced-n100-r1`
- `v9-same-distribution-aged-backlog-balanced-n100-r2`
- `v9-same-distribution-aged-backlog-balanced-n100-r4`
- `v9-same-distribution-new-arrivals-tight-n24-r4`
- `v9-same-distribution-new-arrivals-tight-n50-r3`
- `v9-same-distribution-batch-release-balanced-n50-r4`
- `v9-same-distribution-batch-release-balanced-n100-r3`
- `v9-same-distribution-batch-release-balanced-n100-r4`
- `v9-same-distribution-batch-release-tight-n50-r1`
- `v9-same-distribution-batch-release-tight-n50-r2`
- `v9-same-distribution-batch-release-tight-n50-r3`
- `v9-same-distribution-batch-release-tight-n100-r1`
- `v9-same-distribution-batch-release-tight-n100-r2`
- `v9-same-distribution-batch-release-tight-n100-r3`
- `v9-same-distribution-batch-release-tight-n100-r4`

**incremental / negativeEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n24-r1::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n24-r1::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n24-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r1::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r1::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r3::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n50-r4::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n24-r4::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n24-r4::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n24-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r3::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r3::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r3::repeat-3`
- `v9-same-distribution-batch-release-balanced-n50-r4::repeat-1`
- `v9-same-distribution-batch-release-balanced-n50-r4::repeat-2`
- `v9-same-distribution-batch-release-balanced-n50-r4::repeat-3`
- `v9-same-distribution-batch-release-balanced-n100-r3::repeat-1`
- `v9-same-distribution-batch-release-balanced-n100-r3::repeat-2`
- `v9-same-distribution-batch-release-balanced-n100-r3::repeat-3`
- `v9-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v9-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v9-same-distribution-batch-release-balanced-n100-r4::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-1`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-2`
- `v9-same-distribution-batch-release-tight-n50-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r3::repeat-3`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v9-same-distribution-batch-release-tight-n100-r4::repeat-3`

**gainedEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r1::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r1::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r1::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n24-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n24-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n24-r1::repeat-3`

**lostEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-tight-n50-r3::repeat-1`
- `v9-same-distribution-aged-backlog-tight-n50-r3::repeat-2`
- `v9-same-distribution-aged-backlog-tight-n50-r3::repeat-3`
- `v9-same-distribution-new-arrivals-balanced-n24-r2::repeat-1`
- `v9-same-distribution-new-arrivals-balanced-n24-r2::repeat-2`
- `v9-same-distribution-new-arrivals-balanced-n24-r2::repeat-3`
- `v9-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v9-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v9-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n24-r1::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n24-r1::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n24-r1::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n24-r4::repeat-1`
- `v9-same-distribution-batch-release-tight-n24-r4::repeat-2`
- `v9-same-distribution-batch-release-tight-n24-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r1::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r1::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r1::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n24-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n24-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n24-r1::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### highsVsV7 · 독립 native HiGHS / V7 비용 다듬기

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 45 / 135 | 378,562,433.33 | 357,410,400.00 | 21,152,033.33 | 5.59% | 22/21/2 | 45,000.00 | 11 / 33 | [3.64, 8.31] |
| incremental | 45 / 135 | 212,585,383.33 | 191,433,350.00 | 21,152,033.33 | 9.95% | 22/21/2 | 45,000.00 | 11 / 33 | [6.56, 13.99] |

완주 얻음/잃음 episode: 21 / 15. 시나리오 평균 완주율 차이: 0.027778; 독립 검산 95% 구간: [-0.07, 0.12].
공동 완주 반복의 관측 날짜 변경 합: 5456 → 46317; 135쌍.

total 원 반복 단위 비용합: 기준 1,135,687,300.00 ₩ / 후보 1,072,231,200.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
total 시나리오 평균 절감 원화 95% 구간: [209,239.81, 762,281.69]; bootstrap 시나리오 45개 / draw 2000회.

**total / negativeScenarioIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n24-r3`
- `v9-same-distribution-batch-release-balanced-n24-r4`

**total / negativeEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n24-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n24-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n24-r3::repeat-3`
- `v9-same-distribution-batch-release-balanced-n24-r4::repeat-1`
- `v9-same-distribution-batch-release-balanced-n24-r4::repeat-2`
- `v9-same-distribution-batch-release-balanced-n24-r4::repeat-3`

incremental 원 반복 단위 비용합: 기준 637,756,150.00 ₩ / 후보 574,300,050.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
incremental 시나리오 평균 절감 원화 95% 구간: [209,239.81, 762,281.69]; bootstrap 시나리오 45개 / draw 2000회.

**incremental / negativeScenarioIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n24-r3`
- `v9-same-distribution-batch-release-balanced-n24-r4`

**incremental / negativeEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n24-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n24-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n24-r3::repeat-3`
- `v9-same-distribution-batch-release-balanced-n24-r4::repeat-1`
- `v9-same-distribution-batch-release-balanced-n24-r4::repeat-2`
- `v9-same-distribution-batch-release-balanced-n24-r4::repeat-3`

**gainedEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-tight-n50-r3::repeat-1`
- `v9-same-distribution-aged-backlog-tight-n50-r3::repeat-2`
- `v9-same-distribution-aged-backlog-tight-n50-r3::repeat-3`
- `v9-same-distribution-new-arrivals-balanced-n24-r2::repeat-1`
- `v9-same-distribution-new-arrivals-balanced-n24-r2::repeat-2`
- `v9-same-distribution-new-arrivals-balanced-n24-r2::repeat-3`
- `v9-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v9-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v9-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n24-r1::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n24-r1::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n24-r1::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n24-r4::repeat-1`
- `v9-same-distribution-batch-release-tight-n24-r4::repeat-2`
- `v9-same-distribution-batch-release-tight-n24-r4::repeat-3`

**lostEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v9-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r1::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r1::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r1::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n100-r1::repeat-3`
- `v9-same-distribution-batch-release-tight-n24-r1::repeat-1`
- `v9-same-distribution-batch-release-tight-n24-r1::repeat-2`
- `v9-same-distribution-batch-release-tight-n24-r1::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

- `v9-same-distribution-aged-backlog-tight-n50-r3::repeat-1`
- `v9-same-distribution-aged-backlog-tight-n50-r3::repeat-2`
- `v9-same-distribution-aged-backlog-tight-n50-r3::repeat-3`
- `v9-same-distribution-new-arrivals-balanced-n24-r2::repeat-1`
- `v9-same-distribution-new-arrivals-balanced-n24-r2::repeat-2`
- `v9-same-distribution-new-arrivals-balanced-n24-r2::repeat-3`
- `v9-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v9-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v9-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n24-r1::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n24-r1::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n24-r1::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v9-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v9-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v9-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v9-same-distribution-batch-release-tight-n24-r4::repeat-1`
- `v9-same-distribution-batch-release-tight-n24-r4::repeat-2`
- `v9-same-distribution-batch-release-tight-n24-r4::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

### 스트레스 · 새 주문 시드

| 정책 | 전체 episode | 완주 | 3회 모두 완주 시나리오 | 1회 이상 완주 시나리오 | 이력 미확보 |
| --- | --- | --- | --- | --- | --- |
| V5 유효 계획 유지 | 216 | 72 | 23 | 25 | 0 |
| V7 비용 다듬기 | 216 | 85 | 28 | 29 | 0 |
| V8 조건부 의사결정 | 216 | 57 | 19 | 19 | 0 |
| V9 적시 후보 전달 | 216 | 84 | 27 | 29 | 0 |
| 독립 native HiGHS | 216 | 119 | 39 | 40 | 0 |

#### v9VsV8 · V9 적시 후보 전달 / V8 조건부 의사결정

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 19 / 55 | 64,156,583.33 | 64,189,050.00 | -32,466.67 | -0.05% | 0/17/2 | 29,433.33 | 6 / 18 | [-0.37, 0.00] |
| incremental | 19 / 55 | 40,145,383.33 | 40,177,850.00 | -32,466.67 | -0.08% | 0/17/2 | 29,433.33 | 6 / 18 | [-0.49, 0.00] |

완주 얻음/잃음 episode: 29 / 2. 시나리오 평균 완주율 차이: 0.125000; 독립 검산 95% 구간: [0.05, 0.20].
공동 완주 반복의 관측 날짜 변경 합: 1821 → 2126; 55쌍.

total 원 반복 단위 비용합: 기준 192,269,550.00 ₩ / 후보 192,366,950.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
total 시나리오 평균 절감 원화 95% 구간: [-4,966.67, 0.00]; bootstrap 시나리오 19개 / draw 2000회.

**total / negativeScenarioIds — 전체 보존**

- `v9-stress-batch-release-balanced-n100-r1`
- `v9-stress-batch-release-balanced-n100-r4`

**total / negativeEpisodeIds — 전체 보존**

- `v9-stress-batch-release-balanced-n100-r1::repeat-1`
- `v9-stress-batch-release-balanced-n100-r4::repeat-3`

incremental 원 반복 단위 비용합: 기준 120,235,950.00 ₩ / 후보 120,333,350.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
incremental 시나리오 평균 절감 원화 95% 구간: [-4,966.67, 0.00]; bootstrap 시나리오 19개 / draw 2000회.

**incremental / negativeScenarioIds — 전체 보존**

- `v9-stress-batch-release-balanced-n100-r1`
- `v9-stress-batch-release-balanced-n100-r4`

**incremental / negativeEpisodeIds — 전체 보존**

- `v9-stress-batch-release-balanced-n100-r1::repeat-1`
- `v9-stress-batch-release-balanced-n100-r4::repeat-3`

**gainedEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n50-r1::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r1::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r1::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-3`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-3`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-3`
- `v9-stress-batch-release-tight-n50-r1::repeat-1`
- `v9-stress-batch-release-tight-n50-r1::repeat-3`
- `v9-stress-batch-release-tight-n50-r3::repeat-1`
- `v9-stress-batch-release-tight-n50-r3::repeat-2`
- `v9-stress-batch-release-tight-n50-r3::repeat-3`
- `v9-stress-batch-release-tight-n50-r4::repeat-1`
- `v9-stress-batch-release-tight-n50-r4::repeat-2`
- `v9-stress-batch-release-tight-n50-r4::repeat-3`

**lostEpisodeIds — 전체 보존**

- `v9-stress-new-arrivals-tight-n50-r4::repeat-2`
- `v9-stress-new-arrivals-tight-n50-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n50-r1::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r1::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r1::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-3`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-3`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-3`
- `v9-stress-batch-release-tight-n50-r1::repeat-1`
- `v9-stress-batch-release-tight-n50-r1::repeat-3`
- `v9-stress-batch-release-tight-n50-r3::repeat-1`
- `v9-stress-batch-release-tight-n50-r3::repeat-2`
- `v9-stress-batch-release-tight-n50-r3::repeat-3`
- `v9-stress-batch-release-tight-n50-r4::repeat-1`
- `v9-stress-batch-release-tight-n50-r4::repeat-2`
- `v9-stress-batch-release-tight-n50-r4::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### v9VsV7 · V9 적시 후보 전달 / V7 비용 다듬기

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 28 / 83 | 320,035,516.67 | 319,943,750.00 | 91,766.67 | 0.03% | 2/24/2 | 29,433.33 | 6 / 18 | [-0.03, 0.14] |
| incremental | 28 / 83 | 186,042,866.67 | 185,951,100.00 | 91,766.67 | 0.05% | 2/24/2 | 29,433.33 | 6 / 18 | [-0.05, 0.24] |

완주 얻음/잃음 episode: 1 / 2. 시나리오 평균 완주율 차이: -0.004630; 독립 검산 95% 구간: [-0.01, 0.00].
공동 완주 반복의 관측 날짜 변경 합: 7696 → 8039; 83쌍.

total 원 반복 단위 비용합: 기준 956,931,950.00 ₩ / 후보 956,656,650.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
total 시나리오 평균 절감 원화 95% 구간: [-2,635.77, 12,465.48]; bootstrap 시나리오 28개 / draw 2000회.

**total / negativeScenarioIds — 전체 보존**

- `v9-stress-batch-release-balanced-n100-r1`
- `v9-stress-batch-release-balanced-n100-r4`

**total / negativeEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-stress-batch-release-balanced-n100-r1::repeat-1`
- `v9-stress-batch-release-balanced-n100-r4::repeat-3`

incremental 원 반복 단위 비용합: 기준 555,117,800.00 ₩ / 후보 554,842,500.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
incremental 시나리오 평균 절감 원화 95% 구간: [-2,635.77, 12,465.48]; bootstrap 시나리오 28개 / draw 2000회.

**incremental / negativeScenarioIds — 전체 보존**

- `v9-stress-batch-release-balanced-n100-r1`
- `v9-stress-batch-release-balanced-n100-r4`

**incremental / negativeEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-stress-batch-release-balanced-n100-r1::repeat-1`
- `v9-stress-batch-release-balanced-n100-r4::repeat-3`

**gainedEpisodeIds — 전체 보존**

- `v9-stress-new-arrivals-tight-n50-r4::repeat-1`

**lostEpisodeIds — 전체 보존**

- `v9-stress-new-arrivals-tight-n50-r4::repeat-3`
- `v9-stress-batch-release-tight-n50-r1::repeat-2`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

- `v9-stress-new-arrivals-tight-n50-r4::repeat-1`

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### v9VsV5 · V9 적시 후보 전달 / V5 유효 계획 유지

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 25 / 70 | 220,396,566.67 | 228,576,316.67 | -8,179,750.00 | -3.71% | 0/16/9 | 2,000,216.67 | 6 / 18 | [-6.22, -2.04] |
| incremental | 25 / 70 | 125,063,916.67 | 133,243,666.67 | -8,179,750.00 | -6.54% | 0/16/9 | 2,000,216.67 | 6 / 18 | [-10.45, -3.57] |

완주 얻음/잃음 episode: 14 / 2. 시나리오 평균 완주율 차이: 0.055556; 독립 검산 95% 구간: [0.00, 0.12].
공동 완주 반복의 관측 날짜 변경 합: 3863 → 5078; 70쌍.

total 원 반복 단위 비용합: 기준 630,050,350.00 ₩ / 후보 652,692,550.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
total 시나리오 평균 절감 원화 95% 구간: [-559,157.58, -113,116.08]; bootstrap 시나리오 25개 / draw 2000회.

**total / negativeScenarioIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n50-r1`
- `v9-stress-aged-backlog-balanced-n50-r2`
- `v9-stress-aged-backlog-balanced-n50-r3`
- `v9-stress-aged-backlog-balanced-n50-r4`
- `v9-stress-aged-backlog-balanced-n100-r1`
- `v9-stress-batch-release-balanced-n100-r1`
- `v9-stress-batch-release-balanced-n100-r4`
- `v9-stress-batch-release-tight-n50-r1`
- `v9-stress-batch-release-tight-n50-r4`

**total / negativeEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n50-r1::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r1::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r1::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-3`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-stress-batch-release-balanced-n100-r1::repeat-1`
- `v9-stress-batch-release-balanced-n100-r4::repeat-3`
- `v9-stress-batch-release-tight-n50-r1::repeat-1`
- `v9-stress-batch-release-tight-n50-r4::repeat-1`
- `v9-stress-batch-release-tight-n50-r4::repeat-2`
- `v9-stress-batch-release-tight-n50-r4::repeat-3`

incremental 원 반복 단위 비용합: 기준 356,502,150.00 ₩ / 후보 379,144,350.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
incremental 시나리오 평균 절감 원화 95% 구간: [-559,157.58, -113,116.08]; bootstrap 시나리오 25개 / draw 2000회.

**incremental / negativeScenarioIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n50-r1`
- `v9-stress-aged-backlog-balanced-n50-r2`
- `v9-stress-aged-backlog-balanced-n50-r3`
- `v9-stress-aged-backlog-balanced-n50-r4`
- `v9-stress-aged-backlog-balanced-n100-r1`
- `v9-stress-batch-release-balanced-n100-r1`
- `v9-stress-batch-release-balanced-n100-r4`
- `v9-stress-batch-release-tight-n50-r1`
- `v9-stress-batch-release-tight-n50-r4`

**incremental / negativeEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n50-r1::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r1::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r1::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-3`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-stress-batch-release-balanced-n100-r1::repeat-1`
- `v9-stress-batch-release-balanced-n100-r4::repeat-3`
- `v9-stress-batch-release-tight-n50-r1::repeat-1`
- `v9-stress-batch-release-tight-n50-r4::repeat-1`
- `v9-stress-batch-release-tight-n50-r4::repeat-2`
- `v9-stress-batch-release-tight-n50-r4::repeat-3`

**gainedEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n24-r3::repeat-1`
- `v9-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v9-stress-aged-backlog-balanced-n24-r3::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-3`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-3`
- `v9-stress-batch-release-tight-n50-r1::repeat-3`
- `v9-stress-batch-release-tight-n50-r3::repeat-1`
- `v9-stress-batch-release-tight-n50-r3::repeat-2`
- `v9-stress-batch-release-tight-n50-r3::repeat-3`

**lostEpisodeIds — 전체 보존**

- `v9-stress-new-arrivals-tight-n50-r4::repeat-2`
- `v9-stress-new-arrivals-tight-n50-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n24-r3::repeat-1`
- `v9-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v9-stress-aged-backlog-balanced-n24-r3::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-3`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-3`
- `v9-stress-batch-release-tight-n50-r1::repeat-3`
- `v9-stress-batch-release-tight-n50-r3::repeat-1`
- `v9-stress-batch-release-tight-n50-r3::repeat-2`
- `v9-stress-batch-release-tight-n50-r3::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### v9VsHiGHS · V9 적시 후보 전달 / 독립 native HiGHS

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 26 / 77 | 263,935,550.00 | 275,086,666.67 | -11,151,116.67 | -4.22% | 1/11/14 | 2,347,250.00 | 6 / 18 | [-6.93, -2.99] |
| incremental | 26 / 77 | 149,612,550.00 | 160,763,666.67 | -11,151,116.67 | -7.45% | 1/11/14 | 2,347,250.00 | 6 / 18 | [-11.79, -5.20] |

완주 얻음/잃음 episode: 7 / 42. 시나리오 평균 완주율 차이: -0.162037; 독립 검산 95% 구간: [-0.26, -0.06].
공동 완주 반복의 관측 날짜 변경 합: 27792 → 7410; 77쌍.

total 원 반복 단위 비용합: 기준 789,407,750.00 ₩ / 후보 822,085,400.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
total 시나리오 평균 절감 원화 95% 구간: [-719,960.26, -179,257.66]; bootstrap 시나리오 26개 / draw 2000회.

**total / negativeScenarioIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n24-r1`
- `v9-stress-aged-backlog-balanced-n50-r1`
- `v9-stress-aged-backlog-balanced-n50-r2`
- `v9-stress-aged-backlog-balanced-n50-r4`
- `v9-stress-aged-backlog-balanced-n100-r1`
- `v9-stress-aged-backlog-balanced-n100-r4`
- `v9-stress-batch-release-balanced-n50-r1`
- `v9-stress-batch-release-balanced-n50-r2`
- `v9-stress-batch-release-balanced-n50-r4`
- `v9-stress-batch-release-balanced-n100-r1`
- `v9-stress-batch-release-balanced-n100-r4`
- `v9-stress-batch-release-tight-n50-r1`
- `v9-stress-batch-release-tight-n50-r3`
- `v9-stress-batch-release-tight-n50-r4`

**total / negativeEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n24-r1::repeat-1`
- `v9-stress-aged-backlog-balanced-n24-r1::repeat-2`
- `v9-stress-aged-backlog-balanced-n24-r1::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r1::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r1::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r1::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-3`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-3`
- `v9-stress-batch-release-balanced-n50-r1::repeat-1`
- `v9-stress-batch-release-balanced-n50-r1::repeat-2`
- `v9-stress-batch-release-balanced-n50-r1::repeat-3`
- `v9-stress-batch-release-balanced-n50-r2::repeat-1`
- `v9-stress-batch-release-balanced-n50-r2::repeat-2`
- `v9-stress-batch-release-balanced-n50-r2::repeat-3`
- `v9-stress-batch-release-balanced-n50-r4::repeat-1`
- `v9-stress-batch-release-balanced-n50-r4::repeat-2`
- `v9-stress-batch-release-balanced-n50-r4::repeat-3`
- `v9-stress-batch-release-balanced-n100-r1::repeat-1`
- `v9-stress-batch-release-balanced-n100-r1::repeat-2`
- `v9-stress-batch-release-balanced-n100-r1::repeat-3`
- `v9-stress-batch-release-balanced-n100-r4::repeat-3`
- `v9-stress-batch-release-tight-n50-r1::repeat-1`
- `v9-stress-batch-release-tight-n50-r1::repeat-3`
- `v9-stress-batch-release-tight-n50-r3::repeat-1`
- `v9-stress-batch-release-tight-n50-r3::repeat-2`
- `v9-stress-batch-release-tight-n50-r3::repeat-3`
- `v9-stress-batch-release-tight-n50-r4::repeat-1`
- `v9-stress-batch-release-tight-n50-r4::repeat-2`
- `v9-stress-batch-release-tight-n50-r4::repeat-3`

incremental 원 반복 단위 비용합: 기준 446,602,550.00 ₩ / 후보 479,280,200.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
incremental 시나리오 평균 절감 원화 95% 구간: [-719,960.26, -179,257.66]; bootstrap 시나리오 26개 / draw 2000회.

**incremental / negativeScenarioIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n24-r1`
- `v9-stress-aged-backlog-balanced-n50-r1`
- `v9-stress-aged-backlog-balanced-n50-r2`
- `v9-stress-aged-backlog-balanced-n50-r4`
- `v9-stress-aged-backlog-balanced-n100-r1`
- `v9-stress-aged-backlog-balanced-n100-r4`
- `v9-stress-batch-release-balanced-n50-r1`
- `v9-stress-batch-release-balanced-n50-r2`
- `v9-stress-batch-release-balanced-n50-r4`
- `v9-stress-batch-release-balanced-n100-r1`
- `v9-stress-batch-release-balanced-n100-r4`
- `v9-stress-batch-release-tight-n50-r1`
- `v9-stress-batch-release-tight-n50-r3`
- `v9-stress-batch-release-tight-n50-r4`

**incremental / negativeEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n24-r1::repeat-1`
- `v9-stress-aged-backlog-balanced-n24-r1::repeat-2`
- `v9-stress-aged-backlog-balanced-n24-r1::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r1::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r1::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r1::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r4::repeat-3`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r4::repeat-3`
- `v9-stress-batch-release-balanced-n50-r1::repeat-1`
- `v9-stress-batch-release-balanced-n50-r1::repeat-2`
- `v9-stress-batch-release-balanced-n50-r1::repeat-3`
- `v9-stress-batch-release-balanced-n50-r2::repeat-1`
- `v9-stress-batch-release-balanced-n50-r2::repeat-2`
- `v9-stress-batch-release-balanced-n50-r2::repeat-3`
- `v9-stress-batch-release-balanced-n50-r4::repeat-1`
- `v9-stress-batch-release-balanced-n50-r4::repeat-2`
- `v9-stress-batch-release-balanced-n50-r4::repeat-3`
- `v9-stress-batch-release-balanced-n100-r1::repeat-1`
- `v9-stress-batch-release-balanced-n100-r1::repeat-2`
- `v9-stress-batch-release-balanced-n100-r1::repeat-3`
- `v9-stress-batch-release-balanced-n100-r4::repeat-3`
- `v9-stress-batch-release-tight-n50-r1::repeat-1`
- `v9-stress-batch-release-tight-n50-r1::repeat-3`
- `v9-stress-batch-release-tight-n50-r3::repeat-1`
- `v9-stress-batch-release-tight-n50-r3::repeat-2`
- `v9-stress-batch-release-tight-n50-r3::repeat-3`
- `v9-stress-batch-release-tight-n50-r4::repeat-1`
- `v9-stress-batch-release-tight-n50-r4::repeat-2`
- `v9-stress-batch-release-tight-n50-r4::repeat-3`

**gainedEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n24-r3::repeat-1`
- `v9-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v9-stress-aged-backlog-balanced-n24-r3::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v9-stress-new-arrivals-tight-n50-r4::repeat-1`

**lostEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v9-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v9-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v9-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v9-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v9-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v9-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v9-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v9-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v9-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v9-stress-new-arrivals-balanced-n50-r1::repeat-1`
- `v9-stress-new-arrivals-balanced-n50-r1::repeat-2`
- `v9-stress-new-arrivals-balanced-n50-r1::repeat-3`
- `v9-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v9-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v9-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v9-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v9-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v9-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v9-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v9-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v9-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v9-stress-new-arrivals-tight-n50-r1::repeat-1`
- `v9-stress-new-arrivals-tight-n50-r1::repeat-2`
- `v9-stress-new-arrivals-tight-n50-r1::repeat-3`
- `v9-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v9-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v9-stress-batch-release-balanced-n24-r2::repeat-1`
- `v9-stress-batch-release-balanced-n24-r2::repeat-2`
- `v9-stress-batch-release-balanced-n24-r2::repeat-3`
- `v9-stress-batch-release-balanced-n50-r3::repeat-1`
- `v9-stress-batch-release-balanced-n50-r3::repeat-2`
- `v9-stress-batch-release-balanced-n50-r3::repeat-3`
- `v9-stress-batch-release-tight-n50-r1::repeat-2`
- `v9-stress-batch-release-tight-n100-r1::repeat-1`
- `v9-stress-batch-release-tight-n100-r1::repeat-2`
- `v9-stress-batch-release-tight-n100-r1::repeat-3`
- `v9-stress-batch-release-tight-n100-r4::repeat-1`
- `v9-stress-batch-release-tight-n100-r4::repeat-2`
- `v9-stress-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n24-r3::repeat-1`
- `v9-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v9-stress-aged-backlog-balanced-n24-r3::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v9-stress-new-arrivals-tight-n50-r4::repeat-1`

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

#### highsVsV7 · 독립 native HiGHS / V7 비용 다듬기

| 요금 | 쌍 시나리오/반복 | 기준 평균합 ₩ | 후보 평균합 ₩ | 절감 ₩ | 절감 % | 낮음/동일/높음 | 최악 평균 증가 ₩ | 0원 기준 시나리오/반복 | 독립 검산 95% 구간 % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 26 / 78 | 275,178,433.33 | 263,935,550.00 | 11,242,883.33 | 4.09% | 13/12/1 | 18,200.00 | 6 / 18 | [2.90, 6.61] |
| incremental | 26 / 78 | 160,855,433.33 | 149,612,550.00 | 11,242,883.33 | 6.99% | 13/12/1 | 18,200.00 | 6 / 18 | [4.94, 10.66] |

완주 얻음/잃음 episode: 41 / 7. 시나리오 평균 완주율 차이: 0.157407; 독립 검산 95% 구간: [0.06, 0.26].
공동 완주 반복의 관측 날짜 변경 합: 7233 → 28098; 78쌍.

total 원 반복 단위 비용합: 기준 825,535,300.00 ₩ / 후보 791,806,650.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
total 시나리오 평균 절감 원화 95% 구간: [181,239.23, 727,596.43]; bootstrap 시나리오 26개 / draw 2000회.

**total / negativeScenarioIds — 전체 보존**

- `v9-stress-new-arrivals-tight-n100-r4`

**total / negativeEpisodeIds — 전체 보존**

- `v9-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-3`

incremental 원 반복 단위 비용합: 기준 482,566,300.00 ₩ / 후보 448,837,650.00 ₩. 이 합은 시나리오 동일가중 합과 다릅니다.
incremental 시나리오 평균 절감 원화 95% 구간: [181,239.23, 727,596.43]; bootstrap 시나리오 26개 / draw 2000회.

**incremental / negativeScenarioIds — 전체 보존**

- `v9-stress-new-arrivals-tight-n100-r4`

**incremental / negativeEpisodeIds — 전체 보존**

- `v9-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v9-stress-new-arrivals-tight-n100-r4::repeat-3`

**gainedEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v9-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v9-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v9-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v9-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v9-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v9-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v9-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v9-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v9-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v9-stress-new-arrivals-balanced-n50-r1::repeat-1`
- `v9-stress-new-arrivals-balanced-n50-r1::repeat-2`
- `v9-stress-new-arrivals-balanced-n50-r1::repeat-3`
- `v9-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v9-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v9-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v9-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v9-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v9-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v9-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v9-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v9-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v9-stress-new-arrivals-tight-n50-r1::repeat-1`
- `v9-stress-new-arrivals-tight-n50-r1::repeat-2`
- `v9-stress-new-arrivals-tight-n50-r1::repeat-3`
- `v9-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v9-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v9-stress-batch-release-balanced-n24-r2::repeat-1`
- `v9-stress-batch-release-balanced-n24-r2::repeat-2`
- `v9-stress-batch-release-balanced-n24-r2::repeat-3`
- `v9-stress-batch-release-balanced-n50-r3::repeat-1`
- `v9-stress-batch-release-balanced-n50-r3::repeat-2`
- `v9-stress-batch-release-balanced-n50-r3::repeat-3`
- `v9-stress-batch-release-tight-n100-r1::repeat-1`
- `v9-stress-batch-release-tight-n100-r1::repeat-2`
- `v9-stress-batch-release-tight-n100-r1::repeat-3`
- `v9-stress-batch-release-tight-n100-r4::repeat-1`
- `v9-stress-batch-release-tight-n100-r4::repeat-2`
- `v9-stress-batch-release-tight-n100-r4::repeat-3`

**lostEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n24-r3::repeat-1`
- `v9-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v9-stress-aged-backlog-balanced-n24-r3::repeat-3`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v9-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v9-stress-new-arrivals-tight-n50-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — 전체 보존**

- `v9-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v9-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v9-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v9-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v9-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v9-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v9-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v9-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v9-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v9-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v9-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v9-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v9-stress-new-arrivals-balanced-n50-r1::repeat-1`
- `v9-stress-new-arrivals-balanced-n50-r1::repeat-2`
- `v9-stress-new-arrivals-balanced-n50-r1::repeat-3`
- `v9-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v9-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v9-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v9-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v9-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v9-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v9-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v9-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v9-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v9-stress-new-arrivals-tight-n50-r1::repeat-1`
- `v9-stress-new-arrivals-tight-n50-r1::repeat-2`
- `v9-stress-new-arrivals-tight-n50-r1::repeat-3`
- `v9-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v9-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v9-stress-batch-release-balanced-n24-r2::repeat-1`
- `v9-stress-batch-release-balanced-n24-r2::repeat-2`
- `v9-stress-batch-release-balanced-n24-r2::repeat-3`
- `v9-stress-batch-release-balanced-n50-r3::repeat-1`
- `v9-stress-batch-release-balanced-n50-r3::repeat-2`
- `v9-stress-batch-release-balanced-n50-r3::repeat-3`
- `v9-stress-batch-release-tight-n100-r1::repeat-1`
- `v9-stress-batch-release-tight-n100-r1::repeat-2`
- `v9-stress-batch-release-tight-n100-r1::repeat-3`
- `v9-stress-batch-release-tight-n100-r4::repeat-1`
- `v9-stress-batch-release-tight-n100-r4::repeat-2`
- `v9-stress-batch-release-tight-n100-r4::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — 전체 보존**

없음.

## 이전 V8 평가 — 새 평가와 합치지 않음

V8 동일 생성분포 · 새 주문 시드 80/216; 스트레스 · 새 주문 시드 48/216.
V7 동일 생성분포 · 새 주문 시드 156/216; 스트레스 · 새 주문 시드 89/216.
이전 최초 입력·반복·실패·비용 악화는 변경하지 않습니다. 이 자료는 V9 개발/회귀 검사에 사용할 수 있지만 새 독립 시나리오로 다시 세지 않습니다. 내부 구성 후보 시각, 외부 수신·복사·검사·수락 시각과 전체 냉 episode 수락은 서로 다른 경계입니다.

## G0 전체 실패 층별 상태 — 기존 자료의 사후 진단

| 기존 V7 실패 ID | 실패일 | 원 명목 | 관측+기존 잠금 | 전지적 실제 | 전지적 실제+잠금 |
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

G0는 독립 추가 오프라인 trip 모델 진단입니다. 전지적 해답이나 추가 오프라인 예산을 V9 온라인 입력·성공·신규 holdout 성과로 바꾸지 않습니다.

## 후보 전달 증거와 검산 범위

공식 일별 수락은 내부 동기식 constructor → outer gate입니다. 외부 observer·부모 candidate stream·enqueue acknowledgement는 공식 수락 규칙에 없습니다. 각 endpoint는 기록된 상대 시각의 일관성을 검사하며 외부 계측 인증으로 해석하지 않습니다.
전체 candidateDelivery.events, 제안 날짜, canonical 날짜, 재구성 비용, 수락·거부 이유와 선택 sequence는 개별 episode 원본에 보존됩니다. 미확보 전체 이력은 실제 후보 부재를 증명하지 않습니다.

### 물리·후보 검산 원 요약

```json
{
  "episodes": 2160,
  "completeEpisodes": 1098,
  "historyUnavailable": 0,
  "acceptedPlans": 16519,
  "physicalEvents": 209468,
  "polishEndpoints": 3561
}
```

### 통계 검산 절차

```json
{
  "samplingUnit": "whole business scenario",
  "draws": 2000,
  "seed": 700001,
  "PRNG": "32-bit LCG: (1664525 * state + 1013904223) mod 2^32",
  "interval": "2.5th and 97.5th percentiles with linear interpolation",
  "repeatHandling": "Average only matching jointly complete repeats within each fee scenario; keep all repeats in completion rates",
  "tolerances": {
    "feeKRW": 1e-06,
    "percentagePoints": 1e-09,
    "completionRate": 1e-12
  }
}
```

## 명시적 자원 메뉴 권고 — 구매·현장 성과 아님

메뉴 항목은 resource, days, units, priceKRW, authorized, earliestAvailableDay를 명시합니다. 승인되지 않은 항목, 과거 용량을 바꾸는 항목, 가용일보다 이른 항목은 선택 대상에서 제외합니다. 이미 실행한 사건 날짜는 그대로 유지합니다.
`procurementOnly`의 minimumProcurementProven과 `feesPlusProcurement`의 minimumObjectiveProven은 서로 다른 주장입니다. 검증된 feasible 후보라도 대응 증명이 없으면 최소라고 말하지 않습니다. infeasibleWithinMenuProven은 해당 관측·날짜 도메인·명시 메뉴의 불가능성에 한정됩니다.
권고는 counterfactual이며 구매·배차를 실행하지 않습니다. 추가 요금과 구매비를 함께 표시하더라도 실제 견적·공급 확약·미래 불확실성·업무 도입 효과·현장 ROI를 확인한 것은 아닙니다. 이 기능의 작은 검증 예제를 공식 144개 전체 정책 비교의 분모에 넣지 않습니다.

### 독립 전수 열거로 확인한 합성 교육 예제 4건

한 컨테이너 × 두 변형(rescue / impossible) × 두 목적함수입니다. 네 개 업무 시나리오나 실제 주문이 아닙니다. 실제 견적·구매 권한이 아니라 입력한 합성 가격과 합성 허용 값입니다.

| 합성 record | 요청 목적 | 상태 | 구매비 ₩ | 추가 요금 ₩ | 추가 요금 + 구매비 ₩ | 반납일 |
| --- | --- | --- | --- | --- | --- | --- |
| rescue-procurementOnly | procurementOnly | optimal | 30,000 | 165,500 | 195,500 | D3 |
| rescue-feesPlusProcurement | feesPlusProcurement | optimal | 30,000 | 135,500 | 165,500 | D2 |
| impossible-procurementOnly | procurementOnly | infeasible | null | null | null | null |
| impossible-feesPlusProcurement | feesPlusProcurement | infeasible | null | null | null | null |

구매비만 최소화하는 목적은 요금의 2차 최적화를 요구하지 않습니다. 이 실제 결과의 procurementOnly는 D3 반납을 반환하였고, feesPlusProcurement는 D2를 반환했습니다. 두 결과와 목적 차이를 그대로 보존합니다. 공동 목적의 최적값을 최소 구매비와 혼동하지 않습니다.

독립 Python은 이 작은 날짜 도메인의 모든 적법 날짜와 전체 허용 package 부분집합을 열거했습니다. 이 예제의 최적성 확인을 더 큰 임의 입력이나 알 수 없는 미래 충격의 보장으로 확장하지 않습니다.

## 원본 연결

| 증거 입력 | SHA-256 |
| --- | --- |
| data/v9-results.json | fe021614be03707bde070e499f7d626170f48add832bffe1ac38de1987399d1c |
| data/evidence-v9/v9-frozen-first/first-run/complete.json | 83d165a965e421af0ebc0b399f426eab3ae48eddc4a564374a6074f9edad7204 |
| data/protocol-v9.json | 1f8c22e173bba58165d3e641a28a1ce959ec2f9810baac880bc5553b5a6d1273 |
| data/review-v9.json | 7716e885b7ea673bba6e552b1e6c52f3137cad4157058b8d59696175f10c6c50 |
| data/bootstrap-review-v9.json | e8de544d3bd7203c4e044e104f46798d3a7e1ef9cf83a7a7b2af0d3caff87f51 |
| data/v8-results.json | e033704ef2e27a6f1b2fc8d55ba94809b8fd8a77c6aa3d50d19a77a3199ed92b |
| data/evidence-v8/v8-frozen-first/first-run/complete.json | e873aae0c65fcf51d7335fb3aa57f5285bdbb12bf9c286fb4018c8b2213205b6 |
| data/review-v8.json | e641527d79883fc467fdf7b1246a257cc5d622f31686c90179c065652f00d3e0 |
| data/failure-diagnosis-v8.json | b17cef73f79c8259cab5d68e194a36e858c4c1adc8613f16c5a18a5b51be99e7 |
| data/resource-validation-v9.json | 32b6e1d89bafaec31914a98661c256aed4ceb2e6257eef2077e20fba1fc44227 |
| data/resource-review-v9.json | 6befb3ab1211cad8a784fe1a1a8a16d4324f7ec03d369920e0bd2b182a0d1b48 |

복원된 formal index의 inputArtifact와 episode artifact는 원 SHA로 연결됩니다. wrapper는 전체 장부를 대체하지 않습니다. 자료 복원과 독립 검산은 새 실험 성과 생성이 아닙니다.

## 재현

```bash
python scripts/restore-evidence-v9.py
python scripts/review-v9.py --run data/evidence-v9/v9-frozen-first/first-run --output artifacts/review-v9-reproduction.json
python scripts/review-bootstrap-v9.py --run data/evidence-v9/v9-frozen-first/first-run --output artifacts/bootstrap-v9-reproduction.json
python scripts/build-defense-v9.py --require-results --bootstrap-review data/bootstrap-review-v9.json
```

복원 CLI의 옵션과 통계 검산 파일명은 저장된 각 script의 --help를 확인합니다. 최초 결과를 덮어쓰지 않습니다. 개인 참가·AI 조건·등록·서약·본인 발표 숙련은 별도 확인 대상입니다.
