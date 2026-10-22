# PortPlan V6 — English understanding notes

Generated 2026-10-13T05:33:08+00:00. This is an AI-created Korean research draft, not approval of entrant authorship, registration, eligibility or English delivery.

## 01. 실행을 잠그고 복구하면 완주가 늘지만 비용도 늡니다.

Lead with the tradeoff. On 36 frozen new-seed synthetic inputs, locked recovery completed 29 versus stable retention 23. In their 23 jointly completed pairs, recovery cost ₩9,361,000 more. This is not real port deployment evidence.

## 02. 하루의 연기가 182,000원을 더 만들 수 있습니다.

The proposed user coordinates known import dry containers, shared haulage and warehouse work. The 2026 PNC standard tariff retroactively applies the reached rate to all chargeable days. The 15-day official example is 500,500 KRW; 14 days yields 318,500. This local charge difference is not a measured business saving.

## 03. 세 사건과 실제 이력을 하나의 일별 계획에 넣습니다.

Every candidate contains all three event dates for every box. Maintain release, delivery, continuous work, return lag, horizon and daily resources. Past execution is immutable, ongoing unloading keeps its remaining occupancy. All orders are known initially; there is no new-order module or oracle future-capacity access.

## 04. 서로 다른 증거를 섞어서 실제 효과로 부르지 않습니다.

Public tariffs support declared charge mechanics, not all contracts. Synthetic episodes test the declared scheduling model. Independent implementations check code/model consistency. Public freight CSV audit checks source-backed ingest quality. None substitutes for actual container orders, realized savings or third-party certification.

## 05. V5의 8개 실패를 3 · 4 · 1로 나눴습니다.

Retrospective V5 diagnosis covers eight failed cases and sixteen method episodes. Categories are 3 initially nominal-infeasible, 4 infeasible even with the actual future, and 1 with a feasible hindsight path but irrecoverable executed prefixes. Twenty-nine unique models used additional up-to-ten-second native budgets, outside online evaluation.

## 06. 값싼 불가능 설명은 4 / 16만 증명합니다.

For each box, minimize resource use over all individually legal locked trips, then sum these minima over an interval. Demand above interval capacity proves infeasibility. Cuts prove only four of the sixteen old failed episodes; twelve remain unknown. Independent Python enumerates trips without importing JS or invoking a solver. No contradiction is not a feasibility certificate.

## 07. 현재 잠금 안에서 완전 후보를 만들고, 남은 예산으로 비교합니다.

Recovery adds a separate execution-lock-aware trip constructor, incremental resources, bounded rollback and fixed restarts. Cached valid dates are retained and repriced. Construction and MILP share a cooperative 200ms call budget; this is not a hard 200ms interruption. It can improve earlier choices/search coverage, but cannot undo physical history or create missing capacity.

## 08. 오늘의 저용량을 하루 더 가정하면 오히려 실패할 수 있습니다.

The one-day forecast is a falsifiable conservative assumption, not knowledge of private shock duration. It caps tomorrow at today observed capacity while preserving history/current day. A conservative subproblem can be infeasible when the nominal observed model is feasible; retain forecastSubproblemStatus and do not claim nominal infeasibility or optimality.

## 09. 새 36개와 기존 24개를 분리해 240 episode를 보존했습니다.

The prospective local freeze precedes generation/inspection of seeds 81001–81036. All 36 primary and all 24 development controls ran four policies, 240 cold episodes total. Source snapshots are hash-bound. Primary runs precede controls; no parameter or seed changes after first primary run. Common fairness is the parent-enforced full-episode 5000ms, not identical per-call semantics.

## 10. 완주는 21 · 23 · 29 · 27, 100상자에서는 4 · 5 · 10 · 10입니다.

Read all methods and scales together. Completion counts are [21, 23, 29, 27] on 36 primary cases. The full panel retains failures, and incomplete terminal fees are null. These are experiment counts, not estimated real-world success probabilities.

## 11. 완료가 늘어난 대가로 요금과 변경도 증가했습니다.

Locked recovery gains 6 completions and loses none versus retention, but in 23 common complete pairs it is never cheaper: 0 cheaper, 13 tied, 10 dearer. Total base is ₩147,098,350; incremental base ₩76,377,700. Costs increase 6.36% total and 12.26% incremental. Revisions rise 715→1062. Of the six gains, 5 are initial-search coverage where retention has no day-zero plan; 1 is a later successful path with different initial dates. Do not call this the recovery of six identical executed prefixes.

## 12. 1일 보수 예측은 복구보다 완주도 비용도 불리했습니다.

The preregistered local one-day assumption underperforms plain recovery on this panel: it gains zero and loses 2 completions, while the 27 joint completions cost ₩14,322,150 more. Cheaper/tied/dearer are 4/11/12, so even the negative aggregate contains favorable cases. Keep them all; do not retune persistence using primary or post-primary development results.

## 13. 전체 episode에는 공통 한도, 각 호출은 다른 예산 의미입니다.

The cold-episode timer includes imports, all sequential decisions, audits and final IPC. Native binding preparation and stop-check overhead can overrun a cooperative call deadline, recorded in actual call wall time. Method callback counts are not individual native GLPK solve counts. Unknown physical histories/counters after killed children must remain unknown, not zero; this archive reports no hard timeouts.

## 14. 기존 개발 24개는 새 검증과 합치지 않습니다.

Development controls rerun all 24 old V5 inputs after the primary panel. Counts are [16, 16, 16, 12]; recovery provides no completion gain here. Keep the identical-fee recovery result and worse persistence result separate. The control panel is not a second held-out set or a basis for selecting a new tuned policy.

## 15. 공개 CSV를 재검산했지만 PNC 실주문을 얻었다고 하지 않습니다.

The MIT-licensed author repository is a generated instance based on historical California freight, not an MIT university dataset or PNC orders. Independently verify 47 customers, depot, units, matrix shapes/direction/zeros and source hashes. 39 checks pass with 11 semantic gaps. A missing shift start keeps all 47 arrival-window tests null. This is source-backed input quality evidence, no route optimization or port-fee performance.

## 16. 새 알고리즘 이름보다 검증 가능한 결합과 경계를 제시합니다.

There is direct prior art in demurrage/detention, rolling drayage, MILP, ALNS and pickup/return matching. Claim an inspectable application and evidence chain, not a first algorithm. V5 historical fastEvent coverage is separate from V6: thirty of thirty-six candidates, four fee losses versus event search, and higher paired costs versus raw MILP. Public logistics originals are components with licenses, not matched operational port fee data.

## 17. 세 ZIP을 같은 폴더에 합치고, 기록에서 실행과 실패를 따라갑니다.

All three archives use a common portplan/ root and must be extracted into the same parent directory. Source alone is not the complete V6 evidence package. The webpage uses a projection of the 107MiB archive; the experiment ZIP carries full stage histories. In a short demo show the declared fee mechanism, history locks, causal reveal, full panel and adverse evidence. A chosen playback is an illustration, never a representative cost statistic.

## 18. 조사·구현·자료는 AI가 수행했고, 본인 확인과 당해 자격은 미확인입니다.

These are AI-created drafts, not an authorship declaration. The deadline is printed without a separate timezone label; KST is the local-university interpretation. Current student eligibility, up-to-four team membership and a twenty-page slide ceiling are public. Solo, AI interpretation, English, scoring and the 2026 pledge remain unresolved. The historical 2025 pledge required direct creation and prohibited proxy writing/presentation; do not sign it for the user. In checked 2025 recruitment tables 최우수 was highest listed; do not import the new 2026 대상 ranking into 2025.

## Full paired denominators

| 비교 (후보−기준) | 쌍 | 후보 낮음/동일/높음 | 총요금 증가 | 총 분모 | 추가 분모 | 총 증가율 | 추가 증가율 | 0원 총/추가 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 실행 잠금 복구 − 유효 계획 유지 | 23 | 0/13/10 | ₩9,361,000 | ₩147,098,350 | ₩76,377,700 | 6.363770% | 12.256195% | 7/7 |
| 1일 보수 예측 + 복구 − 유효 계획 유지 | 22 | 1/7/14 | ₩14,897,850 | ₩147,098,350 | ₩76,377,700 | 10.127816% | 19.505497% | 6/6 |
| 1일 보수 예측 + 복구 − 실행 잠금 복구 | 27 | 4/11/12 | ₩14,322,150 | ₩228,569,400 | ₩130,998,000 | 6.265996% | 10.933106% | 8/8 |
| 유효 계획 유지 − 매일 MILP | 21 | 3/12/6 | ₩67,400 | ₩96,099,050 | ₩50,996,700 | 0.070136% | 0.132165% | 8/8 |

For Git transport, the 112,117,733-byte V6 archive is stored as 29 ordered chunks of at most 4,000,000 bytes (the last is smaller), with data/archives-v6/rolling-v6/manifest.json. npm run build and npm run verify:v6 invoke the restorer, verify each chunk and the complete SHA-256, and restore only a missing original. Git clone and npm ci do not perform restoration; before other direct scripts, run python scripts/restore-evidence-v6.py. The same three website ZIPs collectively include the complete original, web view, chunks and manifest under portplan/. Existing originals are never replaced. This lossless transport change does not alter experiments, protocol, first-run source or the original SHA.

## Hash-bound actual inputs

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

Extract all three evidence ZIPs into the same parent directory. Do not sign personal authorship or repeat proxy-written notes as proof of the entrant’s understanding. The draft is an inspectable research deliverable; official AI eligibility and personal authorship remain unresolved.
