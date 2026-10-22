# PortPlan V6 연구 보고서 초안

생성 2026-10-13T05:33:08+00:00. 발표 18쪽. 실제 완결된 원자료와 해시를 검사한 AI 작성 연구 초안이며 참가·본인 창작 확인 서류가 아니다.

## 초록

새 합성 입력 36개에서 일별 MILP, 유효 계획 유지, 실행 잠금 복구, 1일 보수 예측 복구의 완주 수는 각각 21·23·29·27였다. 잠금 복구는 유지 대비 6개의 추가 완주를 얻었지만, 완전 23쌍에서 총요금 ₩9,361,000와 날짜 변경이 늘었다. 1일 예측은 복구 대비 2개의 완주를 잃고 완전 27쌍에서 ₩14,322,150 더 비쌌다. 완주 차이를 절감액으로 바꾸지 않으며 24개 개발 입력은 별도 보고한다.

## 업무 문제와 공개 요율

[PNC 공식 2026 PDF](https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf)의 소급 방식으로 20피트 14일 318,500원, 15일 500,500원의 차이는 182,000원이다. 공개 표준 요율 산례이며 실제 invoice/최적화 절감은 아니다. 한국 Maersk 구간 누적은 명시한 모델 해석이며 단건 계약과 일치함을 확인하지 않았다. 날짜 목표는 공동 추가요금(수명 전체 요금에서 계획 전 발생분을 뺀 값)이고 경로·기사·예약·새 주문·실현 작업비·세금은 미구현이다.

## 방법과 프로토콜

원자료 protocolVersion `portplan-v6-causal-recovery-and-failure-explanations-20261013-01`. 모든 주문은 초기 알려지고 미래 충격과 지속기간은 비공개다. 현재 이력과 진행 중 적출은 정확히 보존한다. 잠금 복구는 유효 캐시를 재가격·검산하고 무효/초기 시 잠금 trip 구성/제한 repair 후 남은 예산 MILP와 완전 후보를 비교한다. 200ms는 협력식 함수 한도이며 호출 최대벽시계가 넘을 수 있다. 1일 예측은 내일의 용량을 오늘 관측과 명목 예측의 최소로 낮추는 가정이다. 보수 자모형의 infeasible/optimal은 명목 모형의 불가능/최적으로 승격하지 않는다.

공통 cold episode 강제 한도는 5,000ms이며 import, 모든 호출, 모델·검산, 완전 결과 IPC를 포함한다. 기존 정책의 내부 solver 0.2초와 새 정책의 함수 전체 200ms 의미는 다르다. 동일 총 CPU/동일 강제 호출 한도가 아니다. 새 seed 범위와 source snapshot은 최초 생성 전에 로컬 고정했으나 외부 사전등록이 아니다. 모든 주 평가 후 개발 대조를 실행했고 이번 결과로 정책이나 예측일수를 수정하지 않았다.

## 새 주 평가 — 전체 분모

| 정책 | 완료 / 전체 | 실패 | solver 호출 | 날짜 변경 |
| --- | --- | --- | --- | --- |
| 매일 MILP | 21 / 36 | 15 | 303 | 2,082 |
| 유효 계획 유지 | 23 / 36 | 13 | 66 | 715 |
| 실행 잠금 복구 | 29 / 36 | 7 | 74 | 1,947 |
| 1일 보수 예측 + 복구 | 27 / 36 | 9 | 78 | 2,280 |

| 상자수 | 사례 | 매일 | 유지 | 잠금복구 | 1일예측 |
| --- | --- | --- | --- | --- | --- |
| 24상자 | 12 | 8 | 9 | 9 | 9 |
| 50상자 | 12 | 9 | 9 | 10 | 8 |
| 100상자 | 12 | 4 | 5 | 10 | 10 |

## 새 주 평가 — 완전 쌍의 요금

| 비교 (후보−기준) | 쌍 | 후보 낮음/동일/높음 | 총요금 증가 | 총 분모 | 추가 분모 | 총 증가율 | 추가 증가율 | 0원 총/추가 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 실행 잠금 복구 − 유효 계획 유지 | 23 | 0/13/10 | ₩9,361,000 | ₩147,098,350 | ₩76,377,700 | 6.363770% | 12.256195% | 7/7 |
| 1일 보수 예측 + 복구 − 유효 계획 유지 | 22 | 1/7/14 | ₩14,897,850 | ₩147,098,350 | ₩76,377,700 | 10.127816% | 19.505497% | 6/6 |
| 1일 보수 예측 + 복구 − 실행 잠금 복구 | 27 | 4/11/12 | ₩14,322,150 | ₩228,569,400 | ₩130,998,000 | 6.265996% | 10.933106% | 8/8 |
| 유효 계획 유지 − 매일 MILP | 21 | 3/12/6 | ₩67,400 | ₩96,099,050 | ₩50,996,700 | 0.070136% | 0.132165% | 8/8 |

요금 증가 = 후보−기준. 기록의 savings 필드는 반대로 기준−후보다. 분모가 0이면 %는 null이고 0원 쌍을 삭제하지 않는다. 비용은 모두 두 정책이 끝까지 완료한 동일 사례에만 비교하며 실패 비용은 null이다. 각 비교의 쌍은 다르다.

| 비교 | 기준/후보 누락 | 날짜 변경 기준→후보 | 최악 증가 | 얻은/잃은 완주 |
| --- | --- | --- | --- | --- |
| lockedVsStable | 13/7 | 715→1062 | ₩5,018,050 | 6/0 |
| persistenceVsStable | 13/9 | 634→1310 | ₩5,543,550 | 5/1 |
| persistenceVsLocked | 7/9 | 1641→2077 | ₩10,103,800 | 0/2 |
| stableVsDaily | 15/13 | 1890→576 | ₩42,300 | 2/0 |

날짜 변경은 미실행 p/u/r 날짜의 변경 횟수이고 인건비·개별 상자 수·actual 변경 수가 아니다. Initial equality는 완전 검산된 시작 계획만 비교하며 빈 기록은 동등 계획이 아니다.

추가 완주 6개 중 5개는 기준 D0 무후보, 1개는 초기 날짜가 다른 후속 경로입니다. 동일 prefix의 복구만으로 귀속하지 않습니다.

| 추가 완주 사례 | 기준 무후보 시점 | 초기 날짜 비교 | 해석 |
| --- | --- | --- | --- |
| v6-aged-backlog-balanced-n100-r1 | 0 | None | 초기 검색 완전 후보 확보 |
| v6-new-arrivals-tight-n50-r2 | 3 | False | 다른 초기 계획의 후속 성공; 같은 prefix 인과효과 아님 |
| v6-new-arrivals-tight-n100-r1 | 0 | None | 초기 검색 완전 후보 확보 |
| v6-new-arrivals-tight-n100-r2 | 0 | None | 초기 검색 완전 후보 확보 |
| v6-batch-release-tight-n100-r1 | 0 | None | 초기 검색 완전 후보 확보 |
| v6-batch-release-tight-n100-r2 | 0 | None | 초기 검색 완전 후보 확보 |

| 시작 비교 | 평가 | 동일 | 다름 | 미평가 |
| --- | --- | --- | --- | --- |
| dailyReoptV4__stableRetainV5 | 24 | 24 | 0 | 12 |
| dailyReoptV4__lockedRecoveryV6 | 24 | 17 | 7 | 12 |
| dailyReoptV4__persistenceRecoveryV6 | 24 | 15 | 9 | 12 |
| stableRetainV5__lockedRecoveryV6 | 25 | 17 | 8 | 11 |
| stableRetainV5__persistenceRecoveryV6 | 25 | 15 | 10 | 11 |
| lockedRecoveryV6__persistenceRecoveryV6 | 31 | 29 | 2 | 5 |

## 전체 실행의 계산 기록

| 정책 | episode 중앙 ms | p95 ms | 호출 최대 ms | 강제 종료 |
| --- | --- | --- | --- | --- |
| 매일 MILP | 388.1 | 1945.9 | 438.2 | 0 |
| 유효 계획 유지 | 339.4 | 712.9 | 489.7 | 0 |
| 실행 잠금 복구 | 328.4 | 788.1 | 306.1 | 0 |
| 1일 보수 예측 + 복구 | 350.4 | 824.0 | 304.5 | 0 |

새 주 평가 완전 terminal audit 100개, 기록된 audit 실패 0개. 알려진 physical execution 실패와 결과 전달 불가/이력 미확보는 구분한다. 실제 종료가 늦어도 기록된 IPC 수신 시점을 기준으로 강제 한도 내 완주를 판정한다. solverCalls는 callback 횟수이며 내부 두 단계 원생 GLPK 호출 횟수와 같다고 하지 않는다.

## 24개 개발 대조 — 별도 분모

| 정책 | 완료 / 전체 | 실패 | solver 호출 | 날짜 변경 |
| --- | --- | --- | --- | --- |
| 매일 MILP | 16 / 24 | 8 | 242 | 876 |
| 유효 계획 유지 | 16 / 24 | 8 | 49 | 194 |
| 실행 잠금 복구 | 16 / 24 | 8 | 47 | 186 |
| 1일 보수 예측 + 복구 | 12 / 24 | 12 | 50 | 133 |

| 비교 (후보−기준) | 쌍 | 후보 낮음/동일/높음 | 총요금 증가 | 총 분모 | 추가 분모 | 총 증가율 | 추가 증가율 | 0원 총/추가 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 실행 잠금 복구 − 유효 계획 유지 | 16 | 0/16/0 | ₩0 | ₩42,931,750 | ₩25,108,250 | 0.000000% | 0.000000% | 5/5 |
| 1일 보수 예측 + 복구 − 유효 계획 유지 | 12 | 0/9/3 | ₩514,350 | ₩41,607,350 | ₩23,874,850 | 1.236200% | 2.154359% | 4/4 |
| 1일 보수 예측 + 복구 − 실행 잠금 복구 | 12 | 0/9/3 | ₩514,350 | ₩41,607,350 | ₩23,874,850 | 1.236200% | 2.154359% | 4/4 |
| 유효 계획 유지 − 매일 MILP | 16 | 1/14/1 | ₩3,200 | ₩42,928,550 | ₩25,105,050 | 0.007454% | 0.012746% | 5/5 |

V5 입력은 방법 개발에 사용되었다. 새 독립 표본이나 추가 검증 24개로 합치지 않는다. 개발 성적을 보고 새 주 평가 정책을 고르거나 seed/파라미터를 교체하지 않는다.

## 기존 V5 실패의 오프라인 진단

| 범위 | 사례 | episode |
| --- | --- | --- |
| 명목 시작부터 불가능 | 3 | 6 |
| actual 전 경로도 불가능 | 4 | 8 |
| 전 경로 가능 / 실행 prefix 불가능 | 1 | 2 |

29개 중복 제거 모델의 추가 HiGHS 진단은 10.0초/모델이다. solverStatus=2 또는 분석적 공집합만 불가능으로 인정하며 timeout/no incumbent를 불가능으로 바꾸지 않는다. 현재 잠긴 prefix의 불가능은 초기 명목 모델이나 실제 사업의 영구 불가능을 뜻하지 않는다. 한 사례는 actual 전 경로가 가능하지만 과거 실행 후 연속이 불가능했다. 이 범위는 기존 V5에만 적용하며 V6 새 실패에 동일 native 증명이 있다고 주장하지 않는다.

## 필요조건 witness와 independent review

기존 16 실패 episode 가운데 4개만 필요조건으로 증명하며 12개는 unknown이다. D+1…9 적출 최소 28>27, D+8…13 운송 24>22가 두 종류 witness다. 40 입력, 64,808 합법 trip, 4,200 구간, 15 witness를 별도 Python이 JS/solver 없이 검사했다. 자원별 독립 최소값은 결합 충돌을 놓칠 수 있으므로 위반 없음은 가능을 뜻하지 않는다.

## 실제 공개 입력과 source 감사

저자 MIT 라이선스 California 연구 인스턴스: 고객 47개(Delivery 33, Pickup 14)와 depot, 양 행렬 48×48. 독립 구조 검사 39개 통과, 의미 공백 11개. MIT는 라이선스이며 MIT 기관 데이터로 표시하지 않는다. 저자는 역사 기반 generated라고 설명하고 행렬은 ORS 생성 추정이다. 실제 실측 그대로인 필드 목록은 미공개다. 파일 순서 row i→ID i는 구조상 일치지만 저자의 명시 row label이 없다. 각 행렬 비대각 0 유향 arc 4개와 비대칭 무향 pair 1116개를 보존했고 원인/좌표는 미확인이다. shift start가 없어 직접 도착 판정 47개 모두 null이다. Arr를 release로 바꾸거나 운력·요율·port event를 생성하지 않았다.

| 자료 | 실제/파생의 근거 | 라이선스 / 범위 |
| --- | --- | --- |
| [amazon-last-mile-practice](https://registry.opendata.aws/amazon-last-mile-challenges/) | publisher-described real historical routes; planned package service and windows; actual stop sequences | CC BY-NC 4.0 |
| [california-freight-47-derived](https://github.com/pengdongbo/Robust-BET-Dispatching-Dataset/tree/0e608495c1520d1634d57c748f84156453d17869) | author-described generated instance based on real historical one-day freight movements; ORS-estimated matrices | MIT; root repository license, no separate data exception found |
| [delivering-data-15310106](https://zenodo.org/records/15310106) | real 3PL delivery demands, recipient-type-derived service/windows, API-generated matrices | CC BY 4.0 for dataset, as stated in Zenodo metadata |
| [port-bulk-ocel-22019684](https://zenodo.org/records/22019684) | curator-described Chinese port operational event log; bulk/silo cargo rather than container operations; operational collection authenticity not independently established | CC BY 4.0 |
| [korea-bscc-42](https://bscc.kr/user/corporate/view.bscc?idx=42&menuCd=DOM_000000103002000000) | catalogue/sample of container gate events, not retrieved complete dispatch requests | page says free; explicit reuse license not established |
| [korea-bigdata-sea-375](https://www.bigdata-sea.kr/datasearch/base/view.do?prodId=PROD_000375) | container gate information listing, original records not acquired | not verified |
| [korea-mof-container-15011649](https://www.data.go.kr/data/15011649/fileData.do) | official catalogue; links to interactive PORT-MIS cargo search rather than a retrieved XLSX | catalogue says 이용허락범위 제한 없음; unrestricted range |
| [miplib-drayage-25-23](https://miplib.zib.de/instance_details_drayage-25-23.html) | real Dutch reefer operational spatial sample with generated timing/service/resource configuration; anonymous MPS | explicit redistribution license not located on checked official pages |
| [antwerp-stoop-2024](https://link.springer.com/article/10.1007/s00291-024-00762-2) | paper real-carrier test case with nonpublic and request-only data | no public source-data license established |
| [plos-rmg-2026](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0357406) | paper describes110 actual container tasks; public simplest code generates synthetic110 tasks | 미확인 |
| [dryad-freight-47](https://datadryad.org/dataset/doi:10.5061/dryad.6hdr7srbv) | official real-case data metadata; original ZIP unavailable through attempted official endpoints | CC0 1.0 from official dataset metadata |

현재 완전 PortPlan shipment-core dataset은 확보하지 못했다. Amazon practice는 CC BY-NC 4.0, Pharma 자료는 CC BY 4.0, 벌크 항만 OCEL은 컨테이너 아닌 별도 이벤트 구성요소다. Dryad 원 ZIP과 일부 원청자료는 접근 실패/미확보로 남기고 GitHub digest와 바꾸지 않는다. 어떤 세계적 데이터 부재도 주장하지 않는다. 개별 source 원자료·다운로드/실패·LICENSE는 공개입력 ZIP에 있다.

## 선례·제한·다음 검증

MILP, rolling drayage, ALNS, 캐시, repair와 상용 반출/반납 matching은 선례가 있다. 기여는 공개 한국 요율과 실행 상태, 짧은 예산 완전 후보, 잠금 복구/필요조건 및 내부 독립 감사의 확인 가능한 결합이다. 최초, 일반 우월, 실현 절감, 세계 최고나 입상 확률을 주장하지 않는다. 동일 생성기 새 seed는 기업·시간상 외부 검증이 아니며 한정된 충격 종류와 모든 주문 초기 공개라는 조건을 유지한다.

V5 역사 비교: fastEvent는 1초 36개 중 30개, 기존 event 27개, raw MILP 24개 후보. event 완전 27쌍에 4개 비용 손실이 있고 raw 대비 더 비쌌다. V5 정적 6개 무후보 중 1개 native 불가능/5개 추가 예산 가능이었으며 V6 완료 성적에 합산하지 않는다. 새로운 방법의 7개 실패를 전부 모델 불가능으로 해석하지 않는다. 추가 운력·기한 협상·실주문/개별 계약·예약/경로·실제 업무비는 별도 데이터와 개입 모델이 필요하다.

## 공식 상태와 실제 작성 기여

[2026 공식 페이지](https://anchor.changwon.ac.kr/main/menu?gc=Program&do=sinform&spod=s1&program_id=VKoDUNlZwONq&psin_id=VKoDUNlMqh4n)는 11월6일18:00 마감, 보고서·데이터/코드 일체, 발표≤20쪽, 창원대 재학생(대학원 포함), 최대4인 팀과 총정원40명을 명시한다. 페이지에 별도 시각대 라벨은 없고 KST는 현지 해석이다. 2026-10-13 공개 재확인에서 실질 변경은 찾지 못했다. 사용자 등록·재학, solo, AI, 영어, 점수 가중치·발표 시간, 2026 창작 서약은 미확인이다. 2025 서약의 직접 창작/대리 작성 금지와 2026 적용 여부를 구별한다. 확인한 2025 모집상 최우수는 당시 최고 열거 상이고 2026 대상 순위를 소급하지 않는다. 최종 2025 전체 수상표는 미확보다.

V6 조사·개발·계산 실행·감사·보고서·발표 자료는 AI가 수행했다. 사용자 본인의 개발, 검증 또는 이해 완료는 확인되지 않았다. 등록, 외부 연락, 대리 서명/발표를 하지 않았다. 본 보고서는 작성자 자격 충족을 주장하는 서약이 아니다.

## 전체 주 평가 사례 — 누락을 지우지 않는 표

| 사례 | 상자수 | 매일 MILP | 유효 계획 유지 | 실행 잠금 복구 | 1일 보수 예측 + 복구 |
| --- | --- | --- | --- | --- | --- |
| v6-aged-backlog-balanced-n24-r1 | 24 | ₩10,911,450 / complete | ₩10,911,450 / complete | ₩11,246,350 / complete | ₩11,484,050 / complete |
| v6-aged-backlog-balanced-n24-r2 | 24 | ₩18,579,700 / complete | ₩18,534,700 / complete | ₩18,534,700 / complete | ₩18,779,700 / complete |
| v6-aged-backlog-balanced-n50-r1 | 50 | ₩26,693,750 / complete | ₩26,683,750 / complete | ₩28,207,300 / complete | ₩28,207,300 / complete |
| v6-aged-backlog-balanced-n50-r2 | 50 | ₩32,422,150 / complete | ₩32,402,150 / complete | ₩32,402,150 / complete | ₩35,513,700 / complete |
| v6-aged-backlog-balanced-n100-r1 | 100 | null / rolling_failed | null / rolling_failed | ₩61,918,450 / complete | ₩72,022,250 / complete |
| v6-aged-backlog-balanced-n100-r2 | 100 | null / rolling_failed | ₩50,692,600 / complete | ₩55,710,650 / complete | ₩56,236,150 / complete |
| v6-aged-backlog-tight-n24-r1 | 24 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v6-aged-backlog-tight-n24-r2 | 24 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v6-aged-backlog-tight-n50-r1 | 50 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v6-aged-backlog-tight-n50-r2 | 50 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v6-aged-backlog-tight-n100-r1 | 100 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v6-aged-backlog-tight-n100-r2 | 100 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v6-new-arrivals-balanced-n24-r1 | 24 | ₩0 / complete | ₩0 / complete | ₩0 / complete | ₩0 / complete |
| v6-new-arrivals-balanced-n24-r2 | 24 | ₩0 / complete | ₩0 / complete | ₩0 / complete | ₩0 / complete |
| v6-new-arrivals-balanced-n50-r1 | 50 | ₩0 / complete | ₩0 / complete | ₩0 / complete | ₩0 / complete |
| v6-new-arrivals-balanced-n50-r2 | 50 | ₩0 / complete | ₩0 / complete | ₩0 / complete | ₩0 / complete |
| v6-new-arrivals-balanced-n100-r1 | 100 | ₩0 / complete | ₩0 / complete | ₩0 / complete | ₩0 / complete |
| v6-new-arrivals-balanced-n100-r2 | 100 | ₩0 / complete | ₩0 / complete | ₩0 / complete | ₩0 / complete |
| v6-new-arrivals-tight-n24-r1 | 24 | ₩0 / complete | ₩9,100 / complete | ₩9,100 / complete | ₩0 / complete |
| v6-new-arrivals-tight-n24-r2 | 24 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v6-new-arrivals-tight-n50-r1 | 50 | ₩0 / complete | ₩0 / complete | ₩54,600 / complete | null / rolling_failed |
| v6-new-arrivals-tight-n50-r2 | 50 | null / rolling_failed | null / rolling_failed | ₩0 / complete | null / rolling_failed |
| v6-new-arrivals-tight-n100-r1 | 100 | null / rolling_failed | null / rolling_failed | ₩0 / complete | ₩0 / complete |
| v6-new-arrivals-tight-n100-r2 | 100 | null / rolling_failed | null / rolling_failed | ₩0 / complete | ₩36,400 / complete |
| v6-batch-release-balanced-n24-r1 | 24 | ₩336,700 / complete | ₩336,700 / complete | ₩336,700 / complete | ₩345,800 / complete |
| v6-batch-release-balanced-n24-r2 | 24 | null / rolling_failed | ₩239,300 / complete | ₩239,300 / complete | ₩239,300 / complete |
| v6-batch-release-balanced-n50-r1 | 50 | ₩600,600 / complete | ₩618,800 / complete | ₩1,067,400 / complete | ₩827,600 / complete |
| v6-batch-release-balanced-n50-r2 | 50 | ₩830,800 / complete | ₩839,900 / complete | ₩1,118,800 / complete | ₩1,173,900 / complete |
| v6-batch-release-balanced-n100-r1 | 100 | ₩1,219,400 / complete | ₩1,219,400 / complete | ₩1,374,100 / complete | ₩1,337,700 / complete |
| v6-batch-release-balanced-n100-r2 | 100 | ₩1,365,000 / complete | ₩1,365,000 / complete | ₩1,383,200 / complete | ₩1,383,200 / complete |
| v6-batch-release-tight-n24-r1 | 24 | ₩600,600 / complete | ₩600,600 / complete | ₩600,600 / complete | ₩615,600 / complete |
| v6-batch-release-tight-n24-r2 | 24 | ₩564,200 / complete | ₩606,500 / complete | ₩606,500 / complete | ₩776,200 / complete |
| v6-batch-release-tight-n50-r1 | 50 | ₩946,400 / complete | ₩973,700 / complete | ₩2,148,800 / complete | ₩2,639,700 / complete |
| v6-batch-release-tight-n50-r2 | 50 | ₩1,028,300 / complete | ₩1,064,700 / complete | ₩1,419,100 / complete | ₩2,436,300 / complete |
| v6-batch-release-tight-n100-r1 | 100 | null / rolling_failed | null / rolling_failed | ₩4,428,900 / complete | ₩4,428,900 / complete |
| v6-batch-release-tight-n100-r2 | 100 | null / rolling_failed | null / rolling_failed | ₩5,817,300 / complete | ₩4,407,800 / complete |

## 전체 개발 대조 사례 — 별도 표

| 사례 | 상자수 | 매일 MILP | 유효 계획 유지 | 실행 잠금 복구 | 1일 보수 예측 + 복구 |
| --- | --- | --- | --- | --- | --- |
| v5-rolling-aged-backlog-balanced-n12-r1--development-control | 12 | ₩8,935,900 / complete | ₩8,935,900 / complete | ₩8,935,900 / complete | ₩9,402,050 / complete |
| v5-rolling-aged-backlog-balanced-n12-r2--development-control | 12 | ₩5,319,800 / complete | ₩5,319,800 / complete | ₩5,319,800 / complete | ₩5,349,800 / complete |
| v5-rolling-aged-backlog-balanced-n24-r1--development-control | 24 | ₩13,087,000 / complete | ₩13,087,000 / complete | ₩13,087,000 / complete | ₩13,087,000 / complete |
| v5-rolling-aged-backlog-balanced-n24-r2--development-control | 24 | ₩13,345,550 / complete | ₩13,345,550 / complete | ₩13,345,550 / complete | ₩13,345,550 / complete |
| v5-rolling-aged-backlog-tight-n12-r1--development-control | 12 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v5-rolling-aged-backlog-tight-n12-r2--development-control | 12 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v5-rolling-aged-backlog-tight-n24-r1--development-control | 24 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v5-rolling-aged-backlog-tight-n24-r2--development-control | 24 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v5-rolling-new-arrivals-balanced-n12-r1--development-control | 12 | ₩0 / complete | ₩0 / complete | ₩0 / complete | ₩0 / complete |
| v5-rolling-new-arrivals-balanced-n12-r2--development-control | 12 | ₩0 / complete | ₩0 / complete | ₩0 / complete | ₩0 / complete |
| v5-rolling-new-arrivals-balanced-n24-r1--development-control | 24 | ₩0 / complete | ₩0 / complete | ₩0 / complete | ₩0 / complete |
| v5-rolling-new-arrivals-balanced-n24-r2--development-control | 24 | ₩0 / complete | ₩0 / complete | ₩0 / complete | ₩0 / complete |
| v5-rolling-new-arrivals-tight-n12-r1--development-control | 12 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v5-rolling-new-arrivals-tight-n12-r2--development-control | 12 | ₩9,100 / complete | ₩9,100 / complete | ₩9,100 / complete | null / rolling_failed |
| v5-rolling-new-arrivals-tight-n24-r1--development-control | 24 | ₩0 / complete | ₩0 / complete | ₩0 / complete | null / rolling_failed |
| v5-rolling-new-arrivals-tight-n24-r2--development-control | 24 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v5-rolling-batch-release-balanced-n12-r1--development-control | 12 | ₩136,500 / complete | ₩145,600 / complete | ₩145,600 / complete | ₩145,600 / complete |
| v5-rolling-batch-release-balanced-n12-r2--development-control | 12 | ₩178,800 / complete | ₩172,900 / complete | ₩172,900 / complete | ₩172,900 / complete |
| v5-rolling-batch-release-balanced-n24-r1--development-control | 24 | ₩291,200 / complete | ₩291,200 / complete | ₩291,200 / complete | ₩291,200 / complete |
| v5-rolling-batch-release-balanced-n24-r2--development-control | 24 | ₩309,400 / complete | ₩309,400 / complete | ₩309,400 / complete | ₩327,600 / complete |
| v5-rolling-batch-release-tight-n12-r1--development-control | 12 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v5-rolling-batch-release-tight-n12-r2--development-control | 12 | null / rolling_failed | null / rolling_failed | null / rolling_failed | null / rolling_failed |
| v5-rolling-batch-release-tight-n24-r1--development-control | 24 | ₩805,700 / complete | ₩805,700 / complete | ₩805,700 / complete | null / rolling_failed |
| v5-rolling-batch-release-tight-n24-r2--development-control | 24 | ₩509,600 / complete | ₩509,600 / complete | ₩509,600 / complete | null / rolling_failed |

## 모든 비용 음성 사례 ID와 완료 변경

### lockedVsStable

후보 더 비싼 사례: `v6-aged-backlog-balanced-n24-r1`, `v6-aged-backlog-balanced-n50-r1`, `v6-aged-backlog-balanced-n100-r2`, `v6-new-arrivals-tight-n50-r1`, `v6-batch-release-balanced-n50-r1`, `v6-batch-release-balanced-n50-r2`, `v6-batch-release-balanced-n100-r1`, `v6-batch-release-balanced-n100-r2`, `v6-batch-release-tight-n50-r1`, `v6-batch-release-tight-n50-r2`.

추가 완주: `v6-aged-backlog-balanced-n100-r1`, `v6-new-arrivals-tight-n50-r2`, `v6-new-arrivals-tight-n100-r1`, `v6-new-arrivals-tight-n100-r2`, `v6-batch-release-tight-n100-r1`, `v6-batch-release-tight-n100-r2`.

잃은 완주: 없음.

### persistenceVsStable

후보 더 비싼 사례: `v6-aged-backlog-balanced-n24-r1`, `v6-aged-backlog-balanced-n24-r2`, `v6-aged-backlog-balanced-n50-r1`, `v6-aged-backlog-balanced-n50-r2`, `v6-aged-backlog-balanced-n100-r2`, `v6-batch-release-balanced-n24-r1`, `v6-batch-release-balanced-n50-r1`, `v6-batch-release-balanced-n50-r2`, `v6-batch-release-balanced-n100-r1`, `v6-batch-release-balanced-n100-r2`, `v6-batch-release-tight-n24-r1`, `v6-batch-release-tight-n24-r2`, `v6-batch-release-tight-n50-r1`, `v6-batch-release-tight-n50-r2`.

추가 완주: `v6-aged-backlog-balanced-n100-r1`, `v6-new-arrivals-tight-n100-r1`, `v6-new-arrivals-tight-n100-r2`, `v6-batch-release-tight-n100-r1`, `v6-batch-release-tight-n100-r2`.

잃은 완주: `v6-new-arrivals-tight-n50-r1`.

### persistenceVsLocked

후보 더 비싼 사례: `v6-aged-backlog-balanced-n24-r1`, `v6-aged-backlog-balanced-n24-r2`, `v6-aged-backlog-balanced-n50-r2`, `v6-aged-backlog-balanced-n100-r1`, `v6-aged-backlog-balanced-n100-r2`, `v6-new-arrivals-tight-n100-r2`, `v6-batch-release-balanced-n24-r1`, `v6-batch-release-balanced-n50-r2`, `v6-batch-release-tight-n24-r1`, `v6-batch-release-tight-n24-r2`, `v6-batch-release-tight-n50-r1`, `v6-batch-release-tight-n50-r2`.

추가 완주: 없음.

잃은 완주: `v6-new-arrivals-tight-n50-r1`, `v6-new-arrivals-tight-n50-r2`.

### stableVsDaily

후보 더 비싼 사례: `v6-new-arrivals-tight-n24-r1`, `v6-batch-release-balanced-n50-r1`, `v6-batch-release-balanced-n50-r2`, `v6-batch-release-tight-n24-r2`, `v6-batch-release-tight-n50-r1`, `v6-batch-release-tight-n50-r2`.

추가 완주: `v6-aged-backlog-balanced-n100-r2`, `v6-batch-release-balanced-n24-r2`.

잃은 완주: 없음.

## 재현과 전달

세 ZIP은 모두 portplan/ 아래로 압축되어 같은 부모 디렉터리에 풀어 합쳐야 전체 자료가 된다. portplan-source.zip은 소스/기존 증거, portplan-experiments-v6.zip은 전체 V6 실험, portplan-public-inputs-v6.zip은 공개 원자료/라이선스다. 웹 projection은 전체 로그의 대체 원본이 아니다. 아래 재실행은 새 파일에 쓰고 first-run 원본을 덮어쓰지 않는다.

```sh
npm ci --prefix vendor/experiments/v6-first-run-source
node vendor/experiments/v6-first-run-source/scripts/rolling-benchmark-v6.mjs --output artifacts/repro-rolling-v6.json
python scripts/audit-public-orders-v6.py --output artifacts/repro-public-audit-v6.json --report artifacts/repro-public-audit-v6.md
python scripts/build-defense-v6.py --require-results
```

실제 성적은 frozen source snapshot을 사용해 재현하고 한도 결과는 기기/부하에 따라 달라질 수 있다. 현재 소스와 최초 실행 해시의 차이는 공개해도 최초 증거를 다시 이름 붙이지 않는다. PDF와 화면 가독성 확인은 별도 최종 산출이며 본 스크립트는 브라우저나 실험을 실행하지 않는다.

Git 전송용으로 V6 원본 112,117,733바이트를 순서 있는 29개 분할본(각 최대 4,000,000바이트, 마지막은 더 작음)과 `data/archives-v6/rolling-v6/manifest.json`에 저장한다. `npm run build`와 `npm run verify:v6`는 복원기를 호출해 각 조각과 전체 SHA-256을 검사하고 누락된 원본만 복원한다. Git clone이나 npm ci 자체는 복원을 실행하지 않으며 다른 직접 실행 전에 `python scripts/restore-evidence-v6.py`를 쓸 수 있다. 웹사이트의 기존 세 ZIP을 합치면 완전 원본·웹뷰·분할본·manifest가 모두 있고 같은 portplan/ 루트로 풀면 된다. 기존 원본은 대체하지 않으며 이는 무손실 전송 변경일 뿐 실험·프로토콜·최초 소스나 원본 SHA를 바꾸지 않는다.

## 출처 바이트

| 실제 입력 | SHA-256 |
| --- | --- |
| data/protocol-v6.json | `6b40337ee36ff9ff10dbd22e4953932aa17900a5d12cbc3a5f75e36518660311` |
| data/rolling-v6.json | `695f7a62aeccd645bbd1374899fc21afe6caad1549bfbc7fa2d25e1ed62552a4` |
| data/failure-diagnosis-v6.json | `57f9a34ed16a20c9fab115c0666b8c826d1c77bbe0d2a660a777d7ef0c2c419d` |
| data/feasibility-witnesses-v6.json | `2a5f76e5c8df79c889b0840d3a901fa68579d247978156bf0e40fe875aafbc94` |
| data/feasibility-review-v6.json | `eae5e16cda332f6935598b2812e7e0d58cf87182b3a3eeeeb3ef475b640ee5a0` |
| data/public-orders-audit-v6.json | `57f011bc3f16d083ef4063a26735da526a142d0a20f1ff57e187653af28604f5` |
| data/public-sources-v6.json | `22f9fdf51a1977c48549d6dd4d952509a9ece91fa1e1c187206d3bcb9b585a7b` |
| data/rolling-v5.json | `482f6f8df7f0d46cf7d8b0356961c1aaf787f5e9f1566db7e18ce7c1afa23592` |
| data/benchmark-v5.json | `d04e704749b8b93449aaa6ce8270959a52c4d9eefdb21926e37c7ff694ee754e` |
| data/public/v5-rules/manifest.json | `1d849beb9a5a2ab11ac106dc56dbc28e6c08ade7ea1ed1723448e5414098c267` |
| vendor/experiments/v6-first-run-source/manifest.json | `bff94bc20dbfcc261f8b43fa92ba186a5b1ff602dad781472ee3beb5ee54f70b` |
