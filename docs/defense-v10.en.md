# PortPlan V10 — native strict-fee cache retention

AI-created preparation. No entrant-authorship, understanding, field-acceptance, eligibility or submission attestation.

V10 makes one native MILP call and replaces a valid audited cache only for strictly lower current-snapshot joint fees by more than the fixed KRW 1e-6 epsilon. Ties retain the cache. This is not a second-stage lexicographic solve, globally minimum revision algorithm, or revision-to-KRW weighted objective.

same-distribution: V10 completed 156/216 versus original native 153/216; gained/lost completion repeats 3/0, with losses in 0 distinct business scenarios. On the same 153 jointly completed repeats, revisions fell 53667 to 12117 (77.42%). Total-fee savings -0.01166647%, conditional 95% CI [-0.06264978374, 0.0178671957]; incremental-fee savings -0.02002230%, CI [-0.1066936675, 0.03042521996]. An interval spanning zero supports no stable fee advantage; a negative savings point estimate means higher candidate fees.

On the separate V7 paired set, incremental two-fee savings are 9.180%, 95% CI [6.488110178, 11.7562391], over 43 scenarios/129 repeats. Full-sample gained/lost completions are 27/15; losses are repeats where V7 completed and V10 did not. These conditional savings have a different baseline and denominator from the native comparison; they do not create a unified ranking or cancel completion losses.

stress: V10 completed 132/216 versus original native 120/216; gained/lost completion repeats 15/3, with losses in 1 distinct business scenarios. On the same 117 jointly completed repeats, revisions fell 45972 to 17625 (61.66%). Total-fee savings -0.16405648%, conditional 95% CI [-0.6282350661, 0.04157422929]; incremental-fee savings -0.28474977%, CI [-1.063162036, 0.06948376842]. An interval spanning zero supports no stable fee advantage; a negative savings point estimate means higher candidate fees.

On the separate V7 paired set, incremental two-fee savings are 10.883%, 95% CI [6.905172586, 14.42325021], over 32 scenarios/95 repeats. Full-sample gained/lost completions are 37/12; losses are repeats where V7 completed and V10 did not. These conditional savings have a different baseline and denominator from the native comparison; they do not create a unified ranking or cancel completion losses.

## 01. 같은 요금이라면 유효한 날짜를 그대로 유지할 수 있을까요?

V10 retains a currently feasible cached schedule unless one native HiGHS candidate has strictly lower independently reconstructed current-snapshot joint fees. V10 동일 생성분포 · 새 주문 시드 156/216; 스트레스 · 새 주문 시드 132/216 / native 동일 생성분포 · 새 주문 시드 153/216; 스트레스 · 새 주문 시드 120/216. The declared observed gates determine whether V10 stays experimental; they are not a production recommendation or first-place probability.

## 02. 반출·적출·반납과 요금을 하나의 날짜 장부로 연결합니다.

The unchanged daily model covers pickup, consecutive unloading, return, exact past locks, transport and staging, plus explicitly interpreted PNC/Maersk tariffs. It does not model routes, appointments, driver hours, incoming orders, private contracts, invoices, taxes or all logistics costs.

## 03. V9의 한계도 수정하지 않은 이전 결과로 남깁니다.

The prior V9 first run remains unchanged: 동일 생성분포 · 새 주문 시드 150/216; 스트레스 · 새 주문 시드 84/216; prior V7 동일 생성분포 · 새 주문 시드 150/216; 스트레스 · 새 주문 시드 85/216. These are separate older input cohorts. V10 effects must compare methods run on the same new V10 input and repeat, not subtract counts across versions or cohorts.

## 04. V10: 단 한 번의 native MILP와 엄격한 비용 교체 규칙입니다.

One native MILP call uses the original same-model service and budget. A valid cache is replaced only when candidate joint incremental fees are lower by more than the fixed KRW 1e-6 numerical epsilon. Ties and costlier proposals retain the cache; absent or invalid cache follows original recovery.

## 05. 날짜 유지의 의미와 보장하지 않는 것을 구분합니다.

Retaining an equal-fee valid cache avoids unproductive changes at that call, but a strictly cheaper candidate may change many dates and the future trajectory. V10 is not a global minimum-revision algorithm, a second-stage lexicographic solve, or a KRW-weighted revision objective.

## 06. native 기준과 웹 시연을 정확히 구분합니다.

V10 and original native HiGHS share one Python service, model and numeric configuration. Native startup, IPC and outer copy/repricing/audits are charged to the cold deadline. The browser continues to use GLPK; native experiment results do not establish a browser-native deployment or external real-time certification.

## 07. 기존 생성·충격 메커니즘에 새 주문 시드를 사전 고정했습니다.

144 new order scenarios x 5 fixed methods x 3 retained repeats = 2160 episodes. Generator and shock mechanisms are unchanged; only the order seeds are new. Cases, repeats, negative outcomes and deadlines are retained. Separate panels and business-scenario bootstrap avoid counting 432 repeats as independent scenarios.

## 08. 동일 생성분포 · 새 주문 시드 조건부 비용보다 전체 완주를 먼저 봅니다.

Full-sample completion precedes conditional cost analysis. Completed episodes, business scenarios completing all three repeats, and unavailable histories remain separate. A favorable conditional Pareto position cannot override completion losses.

## 09. 동일 생성분포 · 새 주문 시드 같은 공동 완주 반복의 요금만 비교합니다.

Fees use matching jointly complete repeats, averaged inside each scenario then equally weighted by scenario. Pair-specific denominators differ. A fee interval containing zero supports no stable fee advantage; all adverse fee identifiers and conditional intervals remain disclosed.

## 10. 스트레스 · 새 주문 시드 조건부 비용보다 전체 완주를 먼저 봅니다.

Full-sample completion precedes conditional cost analysis. Completed episodes, business scenarios completing all three repeats, and unavailable histories remain separate. A favorable conditional Pareto position cannot override completion losses.

## 11. 스트레스 · 새 주문 시드 같은 공동 완주 반복의 요금만 비교합니다.

Fees use matching jointly complete repeats, averaged inside each scenario then equally weighted by scenario. Pair-specific denominators differ. A fee interval containing zero supports no stable fee advantage; all adverse fee identifiers and conditional intervals remain disclosed.

## 12. 완주 손실·최악 비용 악화를 모든 비교에서 보존합니다.

Every comparison retains completion gains/losses and worst scenario-average fee increases. Any completion loss to any previous baseline fails the necessary observed default-eligibility gate. Every negative total/incremental fee scenario/repeat ID and lost completion ID remains in the report.

## 13. 변경 수는 같은 공동 완주 집합에서 별도 단위로 비교합니다.

Revisions count edits of pending pickup, unload-start or return dates. Compare them on exactly the same jointly complete repeats, separately from money. Unknown counts remain unknown. No invented KRW weight, unified score or cross-denominator ranking is used.

## 14. 다섯 방법이 모두 완주한 집합에서 요금·변경의 Pareto를 따로 봅니다.

The all-five-method jointly complete matching-repeat subset has one disclosed common denominator per panel. Equal-scenario-weight total/incremental fees and revision counts remain separate axes. Dominance requires no worse on both and strictly better on one; no weighted total score or pooled panel leaderboard is constructed.

## 15. 원 날짜·요금·선택 근거와 통계를 독립 검산합니다.

Separate read-only Python implementations reconstruct original cache/proposal/selected dates, tariffs, resources, locks, strict replacement, intervals, common-subset Pareto and observed gates. They verify recorded timing consistency, not external clock authenticity, future policy optimality or operational suitability.

## 16. 실제 기능과 연구 기준을 같은 성과로 합치지 않습니다.

Browser simulation, finite-menu counterfactual recovery and native research comparisons have separate scopes. Teaching fixtures are not the 144 formal business scenarios, supplier commitments or field savings. V10 does not purchase resources, dispatch vehicles or guarantee globally minimal revisions.

## 17. 공개 자료로 개발을 계속하고 남은 검증은 범위별로 기록합니다.

Public sources, public tariffs and reproducible experiments are the default development route. Enterprise records, contacts and a business pilot are optional extensions, not prerequisites. Browser interaction lacks a supported connection; algorithm replacement gates and personal readiness remain separate unresolved items. The materials deadline is November 6 at 18:00 interpreted as KST; capacity-based registration, entrant eligibility and current-year AI conditions are not verified.

## 18. 사전 문턱과 전체 원본을 함께 보고 다음 판단을 내립니다.

The declared observed gate results determine whether V10 remains experimental. Passing finite-sample gates still does not establish a production default or universal non-regression. Complete inputs, every repeat, failures, native proofs, frozen source and both independent reviews are bound by SHA and first-run results remain immutable.

## Read-only post-hoc pressure-loss diagnosis

The three native-comparison pressure losses are three repeats of one business scenario. At D5, native returned strict infeasibility in about 4.3–4.5ms, not a deadline loss. A Python necessary-condition proof reconstructs C017 already unloading across D4–D5 and C010 still pending with due D5: warehouse demand at D5 is at least two against capacity one.
The proof applies only to the V10 executed prefix. Paths already diverged at D1; retaining equal-fee dates at D4 exposes a stability/recoverability tradeoff but no controlled replay proves that replacing D4 alone completes the path. The diagnosis adds no solver calls, online reruns or held-out cases and changes no first-run outcomes. See v10-loss-diagnosis.zh.md.

## Exact result and proof bindings

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

See the Korean or Chinese full report for every adverse identifier, pair-specific fee denominator, paired revisions, conditional CI, common-subset Pareto and observed gate. No cross-denominator ranking, universal dominance, global minimum revisions, external clock certification, field ROI or first-place probability is claimed.

```bash
python scripts/restore-evidence-v10.py
python scripts/review-v10.py --run data/evidence-v10/v10-frozen-first/first-run --output artifacts/review-v10-reproduction.json
python scripts/review-bootstrap-v10.py --run data/evidence-v10/v10-frozen-first/first-run --output artifacts/bootstrap-v10-reproduction.json
python scripts/build-defense-v10.py --require-results --bootstrap-review data/bootstrap-review-v10.json
```
