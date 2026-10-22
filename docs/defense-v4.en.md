# PortPlan V4 — English speaker notes for the Korean research draft

Generated 2026-10-12T18:21:41+00:00. Status: V4 결과 파일 기반 연구자료 초안. This is explanatory material, not evidence of entrant authorship, registration, or permission for English delivery.

Read the figures from the Korean slides together with the archived JSON. No V1–V3 percentage substitutes for a missing V4 result. “Independent” means an internal separate implementation, not third-party certification.

## 01. 요금이 급등하기 전에, 실행 가능한 순서를 정합니다.

PortPlan is a public-evidence daily planning prototype. The work links exact published fee rules, feasible lifecycle plans, and execution-aware replanning. This is a research draft: it does not promise a first-place result or realized customer savings.

## 02. 오늘의 반출 결정이 다른 상자의 반납도 바꿉니다.

Pickup and return share transport capacity; unloading and staging create further interactions. We ask whether a complete schedule is available under limited computation, whether executed actions survive replanning, and which modeled cost differences can be reproduced. This is a daily model, not a route or appointment system.

## 03. 14일에서 15일로 넘어갈 때 하루 비용은 182,000원입니다.

For a twenty-foot box, fourteen storage days cost 318,500 won and fifteen cost 500,500 won. The 182,000 won increase arises because the highest rate applies retrospectively to all chargeable days. The fifteen-day amount matches the official worked example; the difference is our calculation, not an observed invoice.

## 04. 규칙, 관측, 생성 주문을 서로 다른 증거로 다룹니다.

Each source supports a different claim. Official tariffs support narrow billing rules; public gate observations validate a separate duration component; synthetic orders compare planning policies. Korea-specific cross-band D&D accumulation remains a disclosed interpretation. None of these records establishes realized PNC customer savings.

## 05. 반출부터 반납까지 모든 작업을 끝내야 유효합니다.

The objective subtracts a fixed pre-horizon fee base; this does not alter the optimizer. Pickup and return consume one movement each, unloading occupies consecutive daily slots, and staging lasts from pickup until the return day, excluding that return day. Partial schedules have null costs and never count as success.

## 06. 날짜를 직접 바꾸고, 검증한 후보는 보존합니다.

Direct search explores actual event dates and bounded destroy/repair neighborhoods. Safe preprocessing uses separately feasible trip minima and an audited upper bound. It removes a date only if its conditional lower bound exceeds that upper bound. A retained heuristic is not a GLPK solution, and a cutoff is not a MIP warm start. Exact integer lower-bound attainment is a separately labeled proof.

## 07. 미래 장애를 알려주지 않고 오늘의 작업만 실행합니다.

All orders are known at the beginning. Only future capacity shocks are withheld. At each day start, the planner receives observed capacity and immutable executed events; unrevealed future capacity remains nominal. It audits a full remaining plan but executes only today. A clairvoyant re-solve is a separate reference, not an online policy.

## 08. 초기화부터 검산까지 네 방법에 같은 시간 한도를 둡니다.

The frozen panel contains 18 synthetic stress cells and all four methods receive a 1000 millisecond parent-enforced budget. Startup, initial policies, solver loading, preprocessing, model construction, audit, and IPC delivery all count. Only an audited checkpoint delivered before the deadline survives a kill; no interrupted optimality proof is retained. Host load and exit-delivery overhead remain visible.

## 09. 비용보다 먼저 완전 일정이 있는지 확인합니다.

Read each method separately. Complete audited schedules, completed optimality proofs, hard deadline terminations, and retained checkpoints measure different things. A candidate preserved before a kill can be feasible without proving optimal. We do not present a hindsight best-of-methods selection as the performance of a single algorithm.

## 10. 전처리 결합은 이 패널에서 직접 날짜 탐색보다 비쌌습니다.

Each row uses only cases in which both policies produced complete audited schedules. Its denominator is the sum of baseline incremental charges, not total lifecycle charges. Negative differences mean the candidate costs more; zero denominators remain undefined. Feasibility and missing pairs must be read alongside the cost table. No customer-population estimate follows from one seed per stress cell.

## 11. 같은 코드를 두 번 호출하지 않고 비용과 모델을 다시 구성합니다.

Python builds a separate trip-column model and computes fees without importing JavaScript coefficients or functions. It checks candidate costs and capacities and compares them with HiGHS bounds and audited incumbents. Safe-integer objectives support the declared exact proof status; noninteger tariff variants retain a numerical-tolerance solver-optimal status, not provenOptimal. This is internal implementation independence, not third-party certification. Its additional solver time is separate from the one-second comparison and it does not certify the full rolling history.

## 12. 장애 대응은 전체 실행과 변경 비용을 함께 보고합니다.

The rolling experiment reports complete executions, failure days, and revisions to unexecuted event dates. Costs are paired only after both policies complete all required lifecycle events. The per-solve GLPK limit is 0.2 seconds; rolling makes more planning calls and has no equal-total-computation claim. The rolling budget and information setting are separate from the static one-second challenge. Known orders and synthetic capacity shocks delimit the conclusion.

## 13. 실패와 비용 증가가 방법의 적용 범위를 보여줍니다.

Failures remain in the denominator and raw artifacts. A hard timeout without an incumbent is different from mathematical infeasibility. Replanning cannot undo physical history, and a feasible hindsight schedule does not imply online success. The deck does not select the best saving case as representative.

## 14. 새로 검증한 결합을 설명하고 기존 연구를 인정합니다.

Joint lifecycle planning, uncertain D&D, rolling horizons, and neighborhood search all have direct precedents. The proposed contribution is an inspectable application of specific public Korean rules, daily execution state, equal-budget stress comparisons, and independent recalculation. We do not claim algorithmic firstness, market leadership, deployment, or verified enterprise savings.

## 15. 한 번의 시연을 코드와 원자료로 다시 확인합니다.

Demonstrate one complete cycle: verify a tariff example, inspect synthetic inputs, produce an audited plan, then reveal a capacity shock and replan with executed events locked. Provide the report, full inputs and outputs, frozen protocol, source hashes, dependencies, and contribution records. Runtime limits make re-execution device-dependent; archived results remain inspectable.

## 16. 연구자료는 준비하되 제출 자격과 기여를 꾸미지 않습니다.

The public 2026 notice sets the material deadline and a twenty-page maximum. Solo eligibility, English presentation, and AI conditions are unresolved. Most work in this round was carried out autonomously by AI. We do not claim that the entrant personally implemented or validated it. A historical 2025 pledge requires direct creation and prohibits proxy writing; its 2026 applicability and AI interpretation remain unverified. This research draft does not attest eligibility or completed registration.

## Reading the archived result tables

| Policy | Complete / all | Optimal | Hard deadline | Retained checkpoint |
| --- | --- | --- | --- | --- |
| 순열 탐색 | 13 / 18 | 0 | 2 | 1 |
| 직접 날짜 탐색 | 14 / 18 | 0 | 3 | 1 |
| 기본 MILP | 12 / 18 | 12 | 5 | 0 |
| 검증 후보 + 전처리 MILP | 14 / 18 | 11 | 6 | 3 |

| Candidate / baseline | Complete pairs | Lower / equal / higher | Baseline−candidate sum | Weighted difference |
| --- | --- | --- | --- | --- |
| 검증 후보 + 전처리 MILP / 순열 탐색 | 13 | 4 / 7 / 2 | −₩1,413,100 | -6.47% |
| 검증 후보 + 전처리 MILP / 직접 날짜 탐색 | 14 | 3 / 9 / 2 | −₩2,140,500 | -7.61% |
| 검증 후보 + 전처리 MILP / 기본 MILP | 12 | 0 / 10 / 2 | −₩1,952,550 | -7.50% |
| 직접 날짜 탐색 / 순열 탐색 | 13 | 4 / 7 / 2 | ₩838,700 | 3.84% |

The weighted percentage uses incremental modeled fees. A total-fee percentage requires its own denominator; the table does not silently relabel one as the other. Different comparator rows can have different paired panels.

## Questions to practice

- Explain the 14→15-day PNC fee jump and the 08:00 boundary without the slides.
- Distinguish a feasible checkpoint, a completed GLPK solve, an analytic bound-attainment proof, and an independently proven optimum.
- Describe precisely what the rolling planner knows: orders known initially, observed capacity until today, nominal unrevealed future.
- Explain why a feasible hindsight re-solve cannot undo an already executed pickup.
- State which parts of the work were autonomously carried out by AI and which entrant contributions remain unverified.

## Evidence binding

- protocol-v4.json SHA-256: `cfda2b5cdf2bd5806a9fdbc0b380eea7e03cccfe04e51e01528365d0230acfc1`
- benchmark-v4.json SHA-256: `96f7cd638535391ba78c191c7d4d9681746d799360234c3818d4a123862de3af`
- rolling-v4.json SHA-256: `0f7aa70153dc39035527660ca6ed3c464da580a9bd87aa1f1c3ec0c307c67aa3`
- certificate-v4.json SHA-256: `dd77a4ed9c694ad0f857237c08601170b81354b35e17a36859904f0d8dd5d999`

- rolling-protocol-v4.json SHA-256: `f089a13aa08a153bc956753966f4be4c7e7b9ac50c621bb6d54a84e4eb8f0ecc`
