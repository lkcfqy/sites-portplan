# PortPlan V5 — English understanding notes for the Korean research draft

Generated 2026-10-13T03:08:10+00:00. State: V5 저장 결과 기반 연구자료 초안. Research drafts do not establish entrant authorship, registration, or permission for English delivery.

## 01. 한정 예산에서 완전 후보를 늘리고, 유효 계획의 변경을 줄입니다.

V5 investigates two changes: obtaining a complete candidate within a limited budget, and retaining an existing executable date plan while it remains valid. The complete archived panel supports the final headline only within its synthetic scope. Final-return latency is not claimed lower: both searches may use the full budget. These are research drafts, not customer savings or contest eligibility attestations.

## 02. 계산 속도와 계획 안정성을 각각 검증합니다.

The static and rolling questions are separate. A faster candidate may have a higher cost. A stable policy may reduce changes but miss a cheaper currently feasible schedule or fail after an unforeseen shock. These are explicit tradeoffs, not assumptions of superiority.

## 03. 한 날의 연기가 182,000원을 더 만들 수 있습니다.

The published PNC retrospective rule produces a 182,000 won increase from fourteen to fifteen storage days for a twenty-foot dry box. The fifteen-day number matches an official example; the difference is derived arithmetic. Neither is a V5 optimization outcome or an observed customer invoice.

## 04. 공개 규칙과 생성 주문의 증거 범위를 지킵니다.

Tariff rules, real gate-duration observations, and generated lifecycle orders support different claims. Korea-specific cross-band D&D accumulation remains a disclosed interpretation. The October 13 rules update found no new official AI, solo-team, or scoring condition; silence is not permission.

## 05. 반출·적출·반납을 모두 완료한 계획만 계산합니다.

V5 changes construction and execution policy, not the daily lifecycle objective. Complete audited plans account for all pickups, consecutive unloading operations, and returns. Subtracting a fixed prior fee base does not change the preferred schedule. Partial plans have null cost, not zero cost.

## 06. V4에서 확인한 약점으로 개발하고, 새 seed에서 다시 비교합니다.

V4 is development evidence: its negative results motivated the implementation change. V5 uses new fixed seeds within the same synthetic generator. This is a generator-internal holdout, not external company validation, a temporal business holdout, or proof of generalization to new distributions.

## 07. 날짜 비용을 한 번 계산하고, 자원 점유를 증분 갱신합니다.

The constructor caches separable pickup and return date prices, sorts once per construction attempt, and updates resource arrays in place. Limited rollback repair and seeded restarts seek a complete candidate. fastEvent spends at most 200 milliseconds on construction and uses the remainder of the same cold one-second budget for V4 event-date search. This static constructor does not support executed-event locks.

## 08. 오늘도 유효하면 유지하고, 무효일 때만 다시 풉니다.

stableRetain audits cached dates against the current causal snapshot and immutable executed events. It reuses them only if all known orders, resources, and date boundaries remain valid. It recomputes costs under current tariffs without claiming current optimality. It invokes the solver initially or when the cached plan is invalid. Lower disruption can come at a fee premium.

## 09. 세 정책의 초기화·계산·검산을 같은 강제 한도에 넣습니다.

Three methods share a parent-enforced one-second cold budget. All setup, candidate construction, search, audit, and result delivery count. The complete fixed panel remains intact. Received checkpoints can survive termination without preserving a killed solve proof. Source snapshots and hashes support reproducibility, not external preregistration.

## 10. 완전 후보 수와 최적 증명을 별도로 확인합니다.

Availability and proof are separate. A timeout checkpoint can be a complete feasible plan; a solver without an incumbent has no complete-plan fee. fastEvent is heuristic. Read missing outcomes together with paired cost results rather than treating a low paired cost as high execution coverage.

## 11. 더 강한 기준과의 비용 차이를 승리·동률·손실 모두로 읽습니다.

Compare fastEvent with both V4 event search and raw MILP. Each row is conditional on both policies finishing. The weighted percentage uses incremental modeled fees, and negative differences mean V5 costs more. Retain all zero-cost denominators, missing pairs, and losses. Different paired panels cannot be compared as a common population estimate.

## 12. 안정성은 완료·호출·변경을 같이 보고 판단합니다.

The two execution policies receive the same day-start causal information and frozen history. Report complete episodes, solver calls, reused plans, and changes to unexecuted event dates. Their number of solves differs, so this is not an equal-total-computation comparison. Initially known orders and unrevealed synthetic capacity durations define the scope.

## 13. 변경이 줄어도 비용이 늘면 그 대가를 그대로 표시합니다.

The stability table uses total lifecycle fees, a different denominator from the static incremental-fee comparison. A positive date-change difference means daily reoptimization changed more pending event dates. Changes are not a measured labor cost. Separate initial solves may produce different date plans under time limits: those cases cannot attribute all later differences to retention alone. The retained plan can be more expensive or fail; those outcomes stay visible.

## 14. 별도 Python 모델로 검산하고, 증명 범위를 한정합니다.

Python reconstructs tariff arithmetic and a trip-column model independently of the JavaScript implementation. The native solver uses extra two-second-per-objective time outside the static comparison. The certificate covers 36 primary seeds and six repeated-input three-second controls, not 42 independent scenarios. Numeric-tolerance optimal status is distinct from the declared safe-integer proof. The certificate validates static model candidates, not the entire rolling history or actual contract invoices.

## 15. 실패를 보존하고, 검증한 응용만 주장합니다.

Caching, incremental resource updates, neighborhood search, and rolling retention are established ideas. The contribution is the inspectable application to specific public fees and execution state with stronger comparisons. Retain failures, unfavorable costs, and previous development negatives. No deployment, external operational validation, firstness, or victory probability is claimed.

## 16. 자료와 시연은 준비하고, 본인 기여를 꾸미지 않습니다.

Most work this round was autonomously performed by AI. The materials do not state that the entrant personally implemented or verified it. The October 13 official update found no new solo, English, AI, or scoring clarification. The 2025 direct-creation pledge is historical evidence, not a confirmed 2026 AI policy. Provide reviewable drafts without signing, registering, or falsely claiming personal work.

## Reading the static results

| 방법 | 완전 검산 / 전체 | 최적 증명 | 강제 한도 | 보존 후보 |
| --- | --- | --- | --- | --- |
| 기본 MILP | 24 / 36 | 24 | 11 | 0 |
| V4 직접 날짜 탐색 | 27 / 36 | 0 | 1 | 0 |
| V5 빠른 구성 + 날짜 탐색 | 30 / 36 | 0 | 0 | 0 |

| V5 후보의 기준 | 완전 쌍 | 낮음 / 같음 / 높음 | 기준−V5 합계 | 가중 차이 |
| --- | --- | --- | --- | --- |
| V4 직접 날짜 탐색 | 27 | 9 / 14 / 4 | ₩2,076,050 | 4.06% |
| 기본 MILP | 24 | 0 / 17 / 7 | −₩3,102,500 | -7.54% |

Positive static differences use baseline incremental modeled fees minus V5 incremental fees. The rolling tradeoff instead uses total lifecycle fees. A null or zero denominator does not become a percentage.

## Reading the execution results

| 정책 | 완전 실행 / 전체 | solver 호출 | 계획 재사용 | 날짜 변경 |
| --- | --- | --- | --- | --- |
| 매일 재최적화 | 16 / 24 | 242 | 0 | 876 |
| 유효 계획 유지 | 16 / 24 | 49 | 192 | 194 |

| 완전 쌍 | 유지 비용 낮음 / 같음 / 높음 | 매일−유지 비용 | 총비용 가중 차이 | 날짜변경 매일→유지 |
| --- | --- | --- | --- | --- |
| 16 | 1 / 14 / 1 | −₩3,200 | -0.007454% | 621 → 164 |

The fixed V5 seeds are new but their generator is shared with the V4 development panel. No external company data or temporal business holdout is implied. Stable retention is not a current optimality proof.

날짜 변경 감소 73.59%. 유지 비용 증가 ₩3,200: 총비용 0.007454% / 추가비용 0.012746%. 같은 완전 쌍의 다른 분모입니다.

초기 날짜가 다른 경로: 0 / 24. 해당 경로의 차이를 유지 정책만의 효과로 귀속하지 않습니다.

## Archive binding

| 원자료 | SHA-256 |
| --- | --- |
| protocol-v5.json | `7cfee99b5522236c3fd70a13b4fcbf11e2273d0c0cd3dd887465608c1f1c2109` |
| benchmark-v5.json | `d04e704749b8b93449aaa6ce8270959a52c4d9eefdb21926e37c7ff694ee754e` |
| rolling-v5.json | `482f6f8df7f0d46cf7d8b0356961c1aaf787f5e9f1566db7e18ce7c1afa23592` |
| certificate-input-v5.json | `2da426c32bf0eebb501c8ed97af2c51a1f63e4b549415faf9fc750335e372639` |
| certificate-v5.json | `70744bf584ba3a6709a24b02b90428f4f55217eb07adf9dcfc7fe5c88e6021fb` |

## Reproduction

Run `node scripts/benchmark-v5.mjs --output artifacts/benchmark-v5-reproduction.json` to create a separate result. Use `python scripts/certify-v5.py --archive artifacts/benchmark-v5-reproduction.json` to flatten and certify all 36 primary plus six repeated-input controls into separate artifacts. Do not overwrite protected first-run data. `python scripts/build-defense-v5.py --require-results` binds these submission drafts to the named archived JSON, certificate input, and evidence bindings.
