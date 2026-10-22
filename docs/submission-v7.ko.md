# PortPlan V7 연구 보고서 초안

생성 2026-10-13T12:53:05+00:00. 완결된 원자료·독립 복산·해시를 검사한 AI 작성 초안. 발표 18쪽이며 참가/본인 창작 서약이 아니다.

## 초록

새 합성36개에서 다섯 정책의 완주는 매일 MILP 20/36 / 유효 계획 유지 21/36 / V6 잠금 복구 26/36 / V7 비용 다듬기 27/36 / GRASP 적응 기준선 17/36이다. V7 비용 다듬기는 V6와 완전 26쌍에서 총요금 Δ=−₩8,711,850, 추가요금 Δ=-6.33%, 기준 총 분모 ₩230,909,850, 추가 분모 ₩137,668,850이다. 유지 정책과 완전 20쌍에서는 추가요금 Δ=6.35%이며 더 비싼 5쌍과 1개 완주 손실이 있다. GRASP와 완전 17쌍 결과 및 모든 악화·누락도 보고한다. 공개 RCPSP 480개와 벌크항만 ledger는 별도 검증이며 실항만 절감으로 합산하지 않는다.

## 모델·방법·예산

공개 한국 표준 요율과 p/u/r 날짜, 운송 endpoint, 창고 연속 적출, [p,r) staging 모델이다. 과거 실행과 진행 중 적출을 고정한다. 모든 주문은 초기 알려지고 미래 shock/duration은 비공개다. 경로·예약·기사·개별 계약·세금·신규 주문 공개 과정·실제 작업비는 이 실험의 검증 범위 밖이다.

PNC 20ft의 14일 318,500원→15일 500,500원 차이 182,000원은 [공식 요율](https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf) 산례이며 invoice나 실현 절감이 아니다. 추가요금은 전체 요금에서 계획 전 발생분을 뺀 모형 목표다.

costPolish는 V6의 완전 구성 후보가 원 phase 안에 일찍 도착하면, 남은 시간에 현재 joint fee를 엄격히 낮추는 이동만 수락한다. 유효 cache는 유지한다. 같은 snapshot의 endpoint 검산이 미래 전체 경로의 우월을 보장하지 않는다. GRASP는 α=0.25, 자원 가중 0.15, 최대 128개 구성, 제한 단일·쌍 개선, MILP 없는 고전 framework 적응이다. 최종 시도 수는 기존 작은 개발 probe에서 미사용 예산을 보고 prospective 생성 전에 고정했다. 원 논문이나 SOTA 재현이 아니다.

protocolVersion `portplan-v7-cost-polishing-and-public-method-adaptation-20261013-01`. 새 seed 91001…91036과 기존 V6 개발 입력 36개, 각 5정책이다. 최초 source와 로컬 protocol을 새 입력 생성 전에 고정했으며 외부 사전등록은 아니다. cold 부모 5,000ms는 import·호출·감사·IPC·부모 terminal 검산을 포함한다. V4/V5 solver 내부 0.2초와 V6/V7/GRASP whole-call 협력식 200ms는 의미가 다르며 동일 CPU나 강제 호출 지연을 주장하지 않는다.

## 새 주 평가 — 전체 분모

| 정책 | 완주/전체 | 알려진 실패 | 이력 미확보 | 관측 solver 호출 |
| --- | --- | --- | --- | --- |
| 매일 MILP | 20 / 36 | 16 | 0 | 294 |
| 유효 계획 유지 | 21 / 36 | 15 | 0 | 65 |
| V6 잠금 복구 | 26 / 36 | 10 | 0 | 71 |
| V7 비용 다듬기 | 27 / 36 | 9 | 0 | 71 |
| GRASP 적응 기준선 | 17 / 36 | 19 | 0 | 0 |

| 상자수 | 사례 | 매일 MILP | 유효 계획 유지 | V6 잠금 복구 | V7 비용 다듬기 | GRASP 적응 기준선 |
| --- | --- | --- | --- | --- | --- | --- |
| 24 | 12 | 8 | 9 | 9 | 9 | 6 |
| 50 | 12 | 8 | 8 | 8 | 9 | 5 |
| 100 | 12 | 4 | 4 | 9 | 9 | 6 |

## 새 주 평가 — 완전 쌍의 비용

| 비교: 후보−기준 | 완전 쌍 | 낮음/동일/높음 | 총요금 Δ | 기준 총 분모 | 기준 추가 분모 | 총 Δ% | 추가 Δ% | 0원 총/추가 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| polishVsLocked | 26 | 8/18/0 | −₩8,711,850 | ₩230,909,850 | ₩137,668,850 | -3.77% | -6.33% | 7/7 |
| polishVsStable | 20 | 0/15/5 | ₩2,269,200 | ₩66,327,350 | ₩35,756,150 | 3.42% | 6.35% | 6/6 |
| graspVsLocked | 17 | 3/6/8 | ₩3,304,800 | ₩184,495,550 | ₩106,442,050 | 1.79% | 3.10% | 6/6 |
| polishVsGrasp | 17 | 10/6/1 | −₩6,072,050 | ₩187,800,350 | ₩109,746,850 | -3.23% | -5.53% | 6/6 |
| lockedVsStable | 20 | 0/15/5 | ₩6,309,500 | ₩66,327,350 | ₩35,756,150 | 9.51% | 17.65% | 6/6 |
| stableVsDaily | 19 | 1/14/4 | ₩246,500 | ₩65,170,850 | ₩34,626,950 | 0.38% | 0.71% | 6/6 |

Δ=후보−기준이며 원 archive savings는 기준−후보다. %는 해당 쌍의 기준 합계를 분모로 한 가중 변화다. 각 비교의 쌍은 다르고, 0원 %는 null, 미완료 전체 요금은 null이다. 모든 0원·악화·누락을 유지한다.

| 비교 | 기준/후보누락 | 최악증가 | 얻은/잃은완주 | 날짜변경기준→후보 |
| --- | --- | --- | --- | --- |
| polishVsLocked | 10/9 | ₩0 | 1/0 | 1491→1486 |
| polishVsStable | 15/9 | ₩918,500 | 7/1 | 483→738 |
| graspVsLocked | 10/19 | ₩3,129,500 | 0/9 | 1073→1866 |
| polishVsGrasp | 19/9 | ₩215,600 | 10/0 | 1866→1033 |
| lockedVsStable | 15/10 | ₩3,096,300 | 6/1 | 483→720 |
| stableVsDaily | 16/15 | ₩135,000 | 2/1 | 1505→485 |

## 초기 계획·회복 효과 범위

| 시작비교 | 평가 | 동일 | 다름 | 미평가 |
| --- | --- | --- | --- | --- |
| dailyReoptV4__stableRetainV5 | 23 | 22 | 1 | 13 |
| dailyReoptV4__lockedRecoveryV6 | 24 | 17 | 7 | 12 |
| dailyReoptV4__costPolishV7 | 24 | 17 | 7 | 12 |
| dailyReoptV4__graspBaselineV7 | 16 | 0 | 16 | 20 |
| stableRetainV5__lockedRecoveryV6 | 24 | 17 | 7 | 12 |
| stableRetainV5__costPolishV7 | 24 | 17 | 7 | 12 |
| stableRetainV5__graspBaselineV7 | 15 | 0 | 15 | 21 |
| lockedRecoveryV6__costPolishV7 | 29 | 22 | 7 | 7 |
| lockedRecoveryV6__graspBaselineV7 | 18 | 0 | 18 | 18 |
| costPolishV7__graspBaselineV7 | 18 | 0 | 18 | 18 |

완전·검산된 D0 계획과 observation hash가 같을 때만 비교한다. 빈 기록·부분·미확보 계획은 같음이 아니다. 초기 날짜가 달랐다면 동일 executed prefix의 회복 효과로 보지 않는다. 이력 미확보는 실행 없음이나 실무 실패의 증거가 아니다.

| V7vsV6 추가완주 사례 | 기준실패day | 초기날짜같음 | 해석 |
| --- | --- | --- | --- |
| v7-new-arrivals-tight-n50-r1 | 3 | True | D+0…1 같은 날짜·물리 이력·state·관측; D+2 분기 후 기준 D+3 완전 계획 미확보. 실패일 같은 prefix 회복·불가능 증명은 아님 |

## 시간·호출·감사

| 정책 | episode중앙ms | p95ms | 최대callms | harddeadline기록 |
| --- | --- | --- | --- | --- |
| 매일 MILP | 378.8 | 1,311.3 | 418.6 | 0 |
| 유효 계획 유지 | 263.8 | 737.8 | 443.5 | 0 |
| V6 잠금 복구 | 308.0 | 800.6 | 328.4 | 0 |
| V7 비용 다듬기 | 331.9 | 776.6 | 319.5 | 0 |
| GRASP 적응 기준선 | 290.6 | 700.1 | 198.7 | 0 |

새 완전 terminal 111개, audit 실패 0개. 강제 kill·미전달 episode의 physical history·counters·revisions는 unknown이며 0으로 채우지 않는다. 부모 검산까지 5,000ms 안에 끝난 완전 결과만 완주다. process-exit 시간은 별도다.

## 기존36 개발대조 — 별도분모

| 정책 | 완주/전체 | 알려진 실패 | 이력 미확보 | 관측 solver 호출 |
| --- | --- | --- | --- | --- |
| 매일 MILP | 20 / 36 | 16 | 0 | 290 |
| 유효 계획 유지 | 21 / 36 | 15 | 0 | 62 |
| V6 잠금 복구 | 29 / 36 | 7 | 0 | 74 |
| V7 비용 다듬기 | 29 / 36 | 7 | 0 | 74 |
| GRASP 적응 기준선 | 17 / 36 | 19 | 0 | 0 |

| 비교: 후보−기준 | 완전 쌍 | 낮음/동일/높음 | 총요금 Δ | 기준 총 분모 | 기준 추가 분모 | 총 Δ% | 추가 Δ% | 0원 총/추가 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| polishVsLocked | 29 | 9/19/1 | −₩6,188,600 | ₩231,735,550 | ₩134,164,150 | -2.67% | -4.61% | 9/9 |
| polishVsStable | 21 | 0/12/9 | ₩3,701,400 | ₩96,360,250 | ₩51,203,300 | 3.84% | 7.23% | 6/6 |
| graspVsLocked | 17 | 4/6/7 | ₩4,713,800 | ₩188,443,350 | ₩104,758,050 | 2.50% | 4.50% | 6/6 |
| polishVsGrasp | 17 | 9/6/2 | −₩7,071,700 | ₩193,157,150 | ₩109,471,850 | -3.66% | -6.46% | 6/6 |
| lockedVsStable | 21 | 0/12/9 | ₩7,445,400 | ₩96,360,250 | ₩51,203,300 | 7.73% | 14.54% | 6/6 |
| stableVsDaily | 20 | 3/12/5 | ₩31,000 | ₩96,089,950 | ₩50,987,600 | 0.03% | 0.06% | 7/7 |

| 비교 | 기준/후보누락 | 최악증가 | 얻은/잃은완주 | 날짜변경기준→후보 |
| --- | --- | --- | --- | --- |
| polishVsLocked | 7/7 | ₩26,800 | 0/0 | 2091→2256 |
| polishVsStable | 15/7 | ₩1,472,250 | 8/0 | 528→1081 |
| graspVsLocked | 7/19 | ₩4,219,900 | 0/12 | 1175→1562 |
| polishVsGrasp | 19/7 | ₩209,300 | 12/0 | 1562→1334 |
| lockedVsStable | 15/7 | ₩3,111,550 | 8/0 | 528→882 |
| stableVsDaily | 16/15 | ₩42,300 | 1/0 | 1690→500 |

기존 입력은 개발에 사용되었으며 새 36개와 합쳐 72개 holdout이라고 하지 않는다. frozen input-only bundle은 명목 주문·shock·원 ID 및 기존 전체 archive SHA에 묶였다. 기존 결과를 복사해 새 정책 성적처럼 쓰지 않는다.

## 원 PSPLIB 공개 RCPSP — 별도 실험

protocol `portplan-v7-original-public-rcpsp-20261013-01`. 알려진 ProGen 생성 j30 전체 480개다. 30활동+2dummy, 4 renewable 자원, 원 duration/demand/precedence/release/horizon 및 abstract ticks를 유지한다. due/tardiness 필드는 보존하되 원 makespan 목표에 hard due를 추가하지 않는다. 공식 OPT/merged를 평가에만 쓰고 search에 전달하지 않는다.

baselineSerialSGS는 stable topological 순서의 한 번 구성이다. iteratedSGS는 최대 256 segment removal/random insertion, 8 positive-duration jobs, tie 허용 hill climbing의 문헌 참고 subset이다. adaptive weights/mobile/non-peak/right-left justify/full ALNS는 없다. 두 방법의 warm 100ms는 구성·검색·in-method audit·return을 포함하고 import/parsing/download와 post-call 평가 재검산을 제외한다. hard 부모 call timer나 cold 동일 비교가 아니다. 두 방법은 같은 최대 한도이며 실제 소비 시간은 다르다.

| 방법 | 제때완전/480 | 공식값일치 | 평균gap% | 최대gap% | 100ms초과 |
| --- | --- | --- | --- | --- | --- |
| baselineSerialSGS | 480/480 | 172 | 9.4 | 44.4 | 0 |
| iteratedSGS | 480/480 | 353 | 0.9 | 17.6 | 0 |

완전 480쌍, 개선/동일/악화 307/173/0이다. 기준 makespan 합 31179, 후보 합 28604, 감소 8.26%. gap %의 평균은 완전 결과의 개별 reference gap % 산술평균이다. 공식 최적값은 timed solver baseline이 아니며 각 schedule의 feasibility는 별도 Python이 감사했다.

원 수치 자료는 연구 평가 사용 조건만 확인하여 website ZIP에 재분배하지 않는다. 공식 3 URL/SHA로 download-on-demand 재현한다. 공개 원 RCPSP는 컨테이너 fee/staging/rolling 전체 모형의 외부 검증이나 실주문이 아니다.

| 원 공개 파일 | URL | SHA-256 |
| --- | --- | --- |
| j30.sm.tgz | https://www.om-db.wi.tum.de/psplib/download_dataset.php?set=j30&mode=sm&format=tgz | `c18202a56588e3cdf3c1aebc5fa59d06b22ee634c74ddf554b6df6bc100044ff` |
| j30.opt | https://www.om-db.wi.tum.de/psplib/download_solution.php?set=j30&mode=sm&type=opt | `9036456d909d5d2102975c13dd6fe36fe503b3ed1df5b91fa652aa7dc9648ee3` |
| j30-merged.json | https://www.om-db.wi.tum.de/psplib/download_merged.php?set=j30&mode=sm | `8f2c005cdf81bf0c962e2930c9c241ed327ba832202ff579d953c4e93f39029e` |

## 실제 공개 곡물항만 ledger — 성능 실험 아님

CC BY 4.0 원 SQLite: 6,989 typed occurrences, 39 reused IDs, 489 assignment visits=454 ordered+35 incomplete. table/rowid identity와 original timestamps를 보존하며 edge 중복은 별도 보고한다. naive join 7492행. solver/fee/추가 사업 필드=0/0/0이다.

Truck assignment→다음 assignment의 회고 창으로 event-object membership을 감사했다. 이는 온라인 정보 집합이 아니다. timezone/clock calibration은 미확인이다. gate 또는 load-to-weigh clock span은 적출 service가 아니다. 실측 resource capacity/fee/empty return/container lifecycle이 없고, 출처의 현장 수집 설명을 독립 인증하지 않았다. 원 source의 39 ID 충돌을 DISTINCT로 삭제하지 않는다.

[공개 원자료](https://zenodo.org/records/22019684) 및 내부 독립 SQL 복산은 진위 인증이나 외부 전문가 심사가 아니다. 기존 V6 원 7MB source를 재사용하며 새 실제 PNC 실험으로 세지 않는다.

## 모두 유지한 주 평가 사례

| 사례 | 규모 | 매일 MILP | 유효 계획 유지 | V6 잠금 복구 | V7 비용 다듬기 | GRASP 적응 기준선 |
| --- | --- | --- | --- | --- | --- | --- |
| v7-aged-backlog-balanced-n24-r1 | 24 | ₩16,829,900 / feasible | ₩16,829,900 / feasible | ₩16,829,900 / feasible | ₩16,829,900 / feasible | ₩18,233,950 / feasible |
| v7-aged-backlog-balanced-n24-r2 | 24 | ₩13,548,850 / feasible | ₩13,683,850 / feasible | ₩13,683,850 / feasible | ₩13,683,850 / feasible | ₩14,044,400 / feasible |
| v7-aged-backlog-balanced-n50-r1 | 50 | ₩29,415,000 / feasible | ₩29,459,600 / feasible | ₩32,555,900 / feasible | ₩30,378,100 / feasible | null / rolling_failed |
| v7-aged-backlog-balanced-n50-r2 | 50 | ₩20,978,200 / feasible | null / rolling_failed | ₩24,962,350 / feasible | ₩22,559,900 / feasible | ₩23,541,250 / feasible |
| v7-aged-backlog-balanced-n100-r1 | 100 | null / rolling_failed | null / rolling_failed | ₩59,503,300 / feasible | ₩59,503,300 / feasible | ₩62,632,800 / feasible |
| v7-aged-backlog-balanced-n100-r2 | 100 | null / rolling_failed | null / rolling_failed | ₩65,430,250 / feasible | ₩65,083,650 / feasible | ₩64,868,050 / feasible |
| v7-aged-backlog-tight-n24-r1 | 24 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v7-aged-backlog-tight-n24-r2 | 24 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v7-aged-backlog-tight-n50-r1 | 50 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v7-aged-backlog-tight-n50-r2 | 50 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v7-aged-backlog-tight-n100-r1 | 100 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v7-aged-backlog-tight-n100-r2 | 100 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v7-new-arrivals-balanced-n24-r1 | 24 | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible |
| v7-new-arrivals-balanced-n24-r2 | 24 | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible |
| v7-new-arrivals-balanced-n50-r1 | 50 | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible |
| v7-new-arrivals-balanced-n50-r2 | 50 | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible |
| v7-new-arrivals-balanced-n100-r1 | 100 | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible |
| v7-new-arrivals-balanced-n100-r2 | 100 | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible |
| v7-new-arrivals-tight-n24-r1 | 24 | null / rolling_failed | ₩9,100 / feasible | ₩9,100 / feasible | ₩9,100 / feasible | null / rolling_failed |
| v7-new-arrivals-tight-n24-r2 | 24 | ₩36,400 / feasible | ₩36,400 / feasible | ₩36,400 / feasible | ₩36,400 / feasible | null / rolling_failed |
| v7-new-arrivals-tight-n50-r1 | 50 | null / rolling_failed | null / rolling_failed | null / rolling_failed | ₩0 / feasible | null / rolling_failed |
| v7-new-arrivals-tight-n50-r2 | 50 | ₩45,500 / feasible | ₩109,200 / feasible | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v7-new-arrivals-tight-n100-r1 | 100 | null / rolling_failed | null / rolling_failed | ₩0 / feasible | ₩0 / feasible | null / rolling_failed |
| v7-new-arrivals-tight-n100-r2 | 100 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v7-batch-release-balanced-n24-r1 | 24 | ₩364,000 / feasible | ₩364,000 / feasible | ₩364,000 / feasible | ₩364,000 / feasible | ₩382,200 / feasible |
| v7-batch-release-balanced-n24-r2 | 24 | ₩209,300 / feasible | ₩209,300 / feasible | ₩209,300 / feasible | ₩209,300 / feasible | ₩218,400 / feasible |
| v7-batch-release-balanced-n50-r1 | 50 | ₩509,600 / feasible | ₩509,600 / feasible | ₩509,600 / feasible | ₩509,600 / feasible | ₩546,000 / feasible |
| v7-batch-release-balanced-n50-r2 | 50 | ₩743,000 / feasible | ₩718,900 / feasible | ₩718,900 / feasible | ₩718,900 / feasible | ₩821,700 / feasible |
| v7-batch-release-balanced-n100-r1 | 100 | ₩919,100 / feasible | ₩919,100 / feasible | ₩1,037,400 / feasible | ₩1,019,200 / feasible | ₩1,028,300 / feasible |
| v7-batch-release-balanced-n100-r2 | 100 | ₩1,210,300 / feasible | ₩1,210,300 / feasible | ₩1,246,700 / feasible | ₩1,246,700 / feasible | ₩1,483,300 / feasible |
| v7-batch-release-tight-n24-r1 | 24 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v7-batch-release-tight-n24-r2 | 24 | ₩624,200 / feasible | ₩624,200 / feasible | ₩624,200 / feasible | ₩624,200 / feasible | null / rolling_failed |
| v7-batch-release-tight-n50-r1 | 50 | null / rolling_failed | ₩1,010,100 / feasible | ₩2,936,300 / feasible | ₩1,570,600 / feasible | null / rolling_failed |
| v7-batch-release-tight-n50-r2 | 50 | ₩715,700 / feasible | ₩743,000 / feasible | ₩1,875,300 / feasible | ₩1,396,700 / feasible | null / rolling_failed |
| v7-batch-release-tight-n100-r1 | 100 | null / rolling_failed | null / rolling_failed | ₩4,834,500 / feasible | ₩3,333,300 / feasible | null / rolling_failed |
| v7-batch-release-tight-n100-r2 | 100 | null / rolling_failed | null / rolling_failed | ₩3,542,600 / feasible | ₩3,121,300 / feasible | null / rolling_failed |

## 모두 유지한 개발 사례

| 사례 | 규모 | 매일 MILP | 유효 계획 유지 | V6 잠금 복구 | V7 비용 다듬기 | GRASP 적응 기준선 |
| --- | --- | --- | --- | --- | --- | --- |
| v6-aged-backlog-balanced-n24-r1--development-control | 24 | ₩10,911,450 / feasible | ₩10,911,450 / feasible | ₩11,246,350 / feasible | ₩11,246,350 / feasible | ₩11,565,350 / feasible |
| v6-aged-backlog-balanced-n24-r2--development-control | 24 | ₩18,579,700 / feasible | ₩18,534,700 / feasible | ₩18,534,700 / feasible | ₩18,534,700 / feasible | ₩19,298,750 / feasible |
| v6-aged-backlog-balanced-n50-r1--development-control | 50 | ₩26,693,750 / feasible | ₩26,683,750 / feasible | ₩28,207,300 / feasible | ₩27,123,000 / feasible | null / rolling_failed |
| v6-aged-backlog-balanced-n50-r2--development-control | 50 | ₩32,422,150 / feasible | ₩32,402,150 / feasible | ₩35,513,700 / feasible | ₩33,874,400 / feasible | ₩34,912,900 / feasible |
| v6-aged-backlog-balanced-n100-r1--development-control | 100 | null / rolling_failed | null / rolling_failed | ₩61,918,450 / feasible | ₩61,918,450 / feasible | ₩66,138,350 / feasible |
| v6-aged-backlog-balanced-n100-r2--development-control | 100 | null / rolling_failed | null / rolling_failed | ₩55,710,650 / feasible | ₩55,315,950 / feasible | ₩55,933,800 / feasible |
| v6-aged-backlog-tight-n24-r1--development-control | 24 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v6-aged-backlog-tight-n24-r2--development-control | 24 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v6-aged-backlog-tight-n50-r1--development-control | 50 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v6-aged-backlog-tight-n50-r2--development-control | 50 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v6-aged-backlog-tight-n100-r1--development-control | 100 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v6-aged-backlog-tight-n100-r2--development-control | 100 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v6-new-arrivals-balanced-n24-r1--development-control | 24 | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible |
| v6-new-arrivals-balanced-n24-r2--development-control | 24 | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible |
| v6-new-arrivals-balanced-n50-r1--development-control | 50 | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible |
| v6-new-arrivals-balanced-n50-r2--development-control | 50 | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible |
| v6-new-arrivals-balanced-n100-r1--development-control | 100 | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible |
| v6-new-arrivals-balanced-n100-r2--development-control | 100 | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible | ₩0 / feasible |
| v6-new-arrivals-tight-n24-r1--development-control | 24 | ₩0 / feasible | ₩9,100 / feasible | ₩9,100 / feasible | ₩9,100 / feasible | null / rolling_failed |
| v6-new-arrivals-tight-n24-r2--development-control | 24 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v6-new-arrivals-tight-n50-r1--development-control | 50 | null / rolling_failed | null / rolling_failed | ₩54,600 / feasible | ₩27,300 / feasible | null / rolling_failed |
| v6-new-arrivals-tight-n50-r2--development-control | 50 | null / rolling_failed | null / rolling_failed | ₩0 / feasible | ₩0 / feasible | null / rolling_failed |
| v6-new-arrivals-tight-n100-r1--development-control | 100 | null / rolling_failed | null / rolling_failed | ₩0 / feasible | ₩0 / feasible | null / rolling_failed |
| v6-new-arrivals-tight-n100-r2--development-control | 100 | null / rolling_failed | null / rolling_failed | ₩0 / feasible | ₩0 / feasible | null / rolling_failed |
| v6-batch-release-balanced-n24-r1--development-control | 24 | ₩336,700 / feasible | ₩336,700 / feasible | ₩336,700 / feasible | ₩336,700 / feasible | ₩345,800 / feasible |
| v6-batch-release-balanced-n24-r2--development-control | 24 | null / rolling_failed | ₩239,300 / feasible | ₩239,300 / feasible | ₩239,300 / feasible | ₩227,500 / feasible |
| v6-batch-release-balanced-n50-r1--development-control | 50 | ₩600,600 / feasible | ₩618,800 / feasible | ₩1,067,400 / feasible | ₩891,800 / feasible | ₩682,500 / feasible |
| v6-batch-release-balanced-n50-r2--development-control | 50 | ₩830,800 / feasible | ₩839,900 / feasible | ₩1,118,800 / feasible | ₩970,500 / feasible | ₩985,500 / feasible |
| v6-batch-release-balanced-n100-r1--development-control | 100 | ₩1,219,400 / feasible | ₩1,219,400 / feasible | ₩1,374,100 / feasible | ₩1,374,100 / feasible | ₩1,428,700 / feasible |
| v6-batch-release-balanced-n100-r2--development-control | 100 | ₩1,365,000 / feasible | ₩1,365,000 / feasible | ₩1,383,200 / feasible | ₩1,383,200 / feasible | ₩1,638,000 / feasible |
| v6-batch-release-tight-n24-r1--development-control | 24 | ₩600,600 / feasible | ₩600,600 / feasible | ₩600,600 / feasible | ₩600,600 / feasible | null / rolling_failed |
| v6-batch-release-tight-n24-r2--development-control | 24 | ₩564,200 / feasible | ₩606,500 / feasible | ₩606,500 / feasible | ₩606,500 / feasible | null / rolling_failed |
| v6-batch-release-tight-n50-r1--development-control | 50 | ₩946,400 / feasible | ₩973,700 / feasible | ₩2,148,800 / feasible | ₩1,425,500 / feasible | null / rolling_failed |
| v6-batch-release-tight-n50-r2--development-control | 50 | ₩1,019,200 / feasible | ₩1,019,200 / feasible | ₩1,419,100 / feasible | ₩1,445,900 / feasible | null / rolling_failed |
| v6-batch-release-tight-n100-r1--development-control | 100 | null / rolling_failed | null / rolling_failed | ₩4,428,900 / feasible | ₩3,666,000 / feasible | null / rolling_failed |
| v6-batch-release-tight-n100-r2--development-control | 100 | null / rolling_failed | null / rolling_failed | ₩5,817,300 / feasible | ₩4,557,600 / feasible | null / rolling_failed |

## 새주평가 모든 비용 악화·완주변경 ID

### polishVsLocked

요금악화: 없음.

얻은완주: `v7-new-arrivals-tight-n50-r1`.

잃은완주: 없음.

### polishVsStable

요금악화: `v7-aged-backlog-balanced-n50-r1`, `v7-batch-release-balanced-n100-r1`, `v7-batch-release-balanced-n100-r2`, `v7-batch-release-tight-n50-r1`, `v7-batch-release-tight-n50-r2`.

얻은완주: `v7-aged-backlog-balanced-n50-r2`, `v7-aged-backlog-balanced-n100-r1`, `v7-aged-backlog-balanced-n100-r2`, `v7-new-arrivals-tight-n50-r1`, `v7-new-arrivals-tight-n100-r1`, `v7-batch-release-tight-n100-r1`, `v7-batch-release-tight-n100-r2`.

잃은완주: `v7-new-arrivals-tight-n50-r2`.

### graspVsLocked

요금악화: `v7-aged-backlog-balanced-n24-r1`, `v7-aged-backlog-balanced-n24-r2`, `v7-aged-backlog-balanced-n100-r1`, `v7-batch-release-balanced-n24-r1`, `v7-batch-release-balanced-n24-r2`, `v7-batch-release-balanced-n50-r1`, `v7-batch-release-balanced-n50-r2`, `v7-batch-release-balanced-n100-r2`.

얻은완주: 없음.

잃은완주: `v7-aged-backlog-balanced-n50-r1`, `v7-new-arrivals-tight-n24-r1`, `v7-new-arrivals-tight-n24-r2`, `v7-new-arrivals-tight-n100-r1`, `v7-batch-release-tight-n24-r2`, `v7-batch-release-tight-n50-r1`, `v7-batch-release-tight-n50-r2`, `v7-batch-release-tight-n100-r1`, `v7-batch-release-tight-n100-r2`.

### polishVsGrasp

요금악화: `v7-aged-backlog-balanced-n100-r2`.

얻은완주: `v7-aged-backlog-balanced-n50-r1`, `v7-new-arrivals-tight-n24-r1`, `v7-new-arrivals-tight-n24-r2`, `v7-new-arrivals-tight-n50-r1`, `v7-new-arrivals-tight-n100-r1`, `v7-batch-release-tight-n24-r2`, `v7-batch-release-tight-n50-r1`, `v7-batch-release-tight-n50-r2`, `v7-batch-release-tight-n100-r1`, `v7-batch-release-tight-n100-r2`.

잃은완주: 없음.

### lockedVsStable

요금악화: `v7-aged-backlog-balanced-n50-r1`, `v7-batch-release-balanced-n100-r1`, `v7-batch-release-balanced-n100-r2`, `v7-batch-release-tight-n50-r1`, `v7-batch-release-tight-n50-r2`.

얻은완주: `v7-aged-backlog-balanced-n50-r2`, `v7-aged-backlog-balanced-n100-r1`, `v7-aged-backlog-balanced-n100-r2`, `v7-new-arrivals-tight-n100-r1`, `v7-batch-release-tight-n100-r1`, `v7-batch-release-tight-n100-r2`.

잃은완주: `v7-new-arrivals-tight-n50-r2`.

### stableVsDaily

요금악화: `v7-aged-backlog-balanced-n24-r2`, `v7-aged-backlog-balanced-n50-r1`, `v7-new-arrivals-tight-n50-r2`, `v7-batch-release-tight-n50-r2`.

얻은완주: `v7-new-arrivals-tight-n24-r1`, `v7-batch-release-tight-n50-r1`.

잃은완주: `v7-aged-backlog-balanced-n50-r2`.

## 기존개발 모든 비용 악화·완주변경 ID

### polishVsLocked

요금악화: `v6-batch-release-tight-n50-r2--development-control`.

얻은완주: 없음.

잃은완주: 없음.

### polishVsStable

요금악화: `v6-aged-backlog-balanced-n24-r1--development-control`, `v6-aged-backlog-balanced-n50-r1--development-control`, `v6-aged-backlog-balanced-n50-r2--development-control`, `v6-batch-release-balanced-n50-r1--development-control`, `v6-batch-release-balanced-n50-r2--development-control`, `v6-batch-release-balanced-n100-r1--development-control`, `v6-batch-release-balanced-n100-r2--development-control`, `v6-batch-release-tight-n50-r1--development-control`, `v6-batch-release-tight-n50-r2--development-control`.

얻은완주: `v6-aged-backlog-balanced-n100-r1--development-control`, `v6-aged-backlog-balanced-n100-r2--development-control`, `v6-new-arrivals-tight-n50-r1--development-control`, `v6-new-arrivals-tight-n50-r2--development-control`, `v6-new-arrivals-tight-n100-r1--development-control`, `v6-new-arrivals-tight-n100-r2--development-control`, `v6-batch-release-tight-n100-r1--development-control`, `v6-batch-release-tight-n100-r2--development-control`.

잃은완주: 없음.

### graspVsLocked

요금악화: `v6-aged-backlog-balanced-n24-r1--development-control`, `v6-aged-backlog-balanced-n24-r2--development-control`, `v6-aged-backlog-balanced-n100-r1--development-control`, `v6-aged-backlog-balanced-n100-r2--development-control`, `v6-batch-release-balanced-n24-r1--development-control`, `v6-batch-release-balanced-n100-r1--development-control`, `v6-batch-release-balanced-n100-r2--development-control`.

얻은완주: 없음.

잃은완주: `v6-aged-backlog-balanced-n50-r1--development-control`, `v6-new-arrivals-tight-n24-r1--development-control`, `v6-new-arrivals-tight-n50-r1--development-control`, `v6-new-arrivals-tight-n50-r2--development-control`, `v6-new-arrivals-tight-n100-r1--development-control`, `v6-new-arrivals-tight-n100-r2--development-control`, `v6-batch-release-tight-n24-r1--development-control`, `v6-batch-release-tight-n24-r2--development-control`, `v6-batch-release-tight-n50-r1--development-control`, `v6-batch-release-tight-n50-r2--development-control`, `v6-batch-release-tight-n100-r1--development-control`, `v6-batch-release-tight-n100-r2--development-control`.

### polishVsGrasp

요금악화: `v6-batch-release-balanced-n24-r2--development-control`, `v6-batch-release-balanced-n50-r1--development-control`.

얻은완주: `v6-aged-backlog-balanced-n50-r1--development-control`, `v6-new-arrivals-tight-n24-r1--development-control`, `v6-new-arrivals-tight-n50-r1--development-control`, `v6-new-arrivals-tight-n50-r2--development-control`, `v6-new-arrivals-tight-n100-r1--development-control`, `v6-new-arrivals-tight-n100-r2--development-control`, `v6-batch-release-tight-n24-r1--development-control`, `v6-batch-release-tight-n24-r2--development-control`, `v6-batch-release-tight-n50-r1--development-control`, `v6-batch-release-tight-n50-r2--development-control`, `v6-batch-release-tight-n100-r1--development-control`, `v6-batch-release-tight-n100-r2--development-control`.

잃은완주: 없음.

### lockedVsStable

요금악화: `v6-aged-backlog-balanced-n24-r1--development-control`, `v6-aged-backlog-balanced-n50-r1--development-control`, `v6-aged-backlog-balanced-n50-r2--development-control`, `v6-batch-release-balanced-n50-r1--development-control`, `v6-batch-release-balanced-n50-r2--development-control`, `v6-batch-release-balanced-n100-r1--development-control`, `v6-batch-release-balanced-n100-r2--development-control`, `v6-batch-release-tight-n50-r1--development-control`, `v6-batch-release-tight-n50-r2--development-control`.

얻은완주: `v6-aged-backlog-balanced-n100-r1--development-control`, `v6-aged-backlog-balanced-n100-r2--development-control`, `v6-new-arrivals-tight-n50-r1--development-control`, `v6-new-arrivals-tight-n50-r2--development-control`, `v6-new-arrivals-tight-n100-r1--development-control`, `v6-new-arrivals-tight-n100-r2--development-control`, `v6-batch-release-tight-n100-r1--development-control`, `v6-batch-release-tight-n100-r2--development-control`.

잃은완주: 없음.

### stableVsDaily

요금악화: `v6-new-arrivals-tight-n24-r1--development-control`, `v6-batch-release-balanced-n50-r1--development-control`, `v6-batch-release-balanced-n50-r2--development-control`, `v6-batch-release-tight-n24-r2--development-control`, `v6-batch-release-tight-n50-r1--development-control`.

얻은완주: `v6-batch-release-balanced-n24-r2--development-control`.

잃은완주: 없음.

## 근거·전달·작성기여

[방법출처](external-methods-v7.md), [비용방법](cost-method-v7.md), [GRASP적응](grasp-adaptation-v7.md), [공개검증](public-validation-v7.md), [전체중문보고서](report-v7.zh.md), [실제기여](contribution-log-v7.md). 별도Python/SQL복산은내부독립구현이며기관인증/solver최적성재증명/세계최고/입상확률이아니다.

공통 portplan/ 루트로 네 ZIP을 같은 부모 폴더에 풀어 합친다: `portplan-source.zip`, `portplan-experiments-v6.zip`, `portplan-experiments-v7.zip`, `portplan-public-inputs-v6.zip`. public-inputs-v6 이름은 V7 허가된 reference까지 포함하는 기존 전달 alias다. projection은 원본 대체가 아니다. 최초 실행 원본을 덮어쓰지 않으며 V6 자료를 그대로 보존한다.

```sh
npm ci --prefix vendor/experiments/v7-first-run-source
node vendor/experiments/v7-first-run-source/scripts/rolling-benchmark-v7.mjs --output artifacts/repro-rolling-v7.json
node vendor/experiments/public-v7-first-run-source/scripts/public-resource-benchmark-v7.mjs --download --input-dir artifacts/public-v7-inputs --output artifacts/repro-public-resource-v7.json
python scripts/build-defense-v7.py --require-results
```

공개 RCPSP 재현은 공식 입력 SHA와 최초 source hash가 맞는 frozen 버전에서 실행한다. 한도 성적은 장비·부하에 따라 달라질 수 있다. 이 generator는 실험·브라우저·PDF 렌더를 실행하지 않는다.

[2026 공식 페이지](https://anchor.changwon.ac.kr/main/menu?gc=Program&do=sinform&spod=s1&program_id=VKoDUNlZwONq&psin_id=VKoDUNlMqh4n)의 발표 ≤20쪽 조건에 맞춘 18쪽 초안이다. 사용자 직접 구현·검증·이해·재학·참가 및 AI 허용은 확인되지 않았으며 대신 서약하지 않는다. 조사·개발·계산·자료 작성은 AI가 수행했다. 역사적 2025 직접 창작·대리 작성 금지 서약과 확인되지 않은 2026 적용을 구분한다. 외부 연락·등록·대리 서명·발표를 하지 않았다.

## 이번 생성에 사용한 원본 SHA

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
