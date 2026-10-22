# V10 prospective experiment: retain valid native fee ties

This is a prespecified declaration, not a result. The new business inputs must not be generated, inspected, tuned, or trialled before the separately authorized source freeze. Previous V8/V9 first runs and all negative outcomes remain unchanged; their already observed inputs are development data only.

## Single method change and controls

The candidate method is `stableHiGHSV10`, from `scripts/highs-planner-v10.mjs`, factory `createStableHiGHSPlannerV10`. It uses the existing native HiGHS service and the same native model. A valid cache is independently rebuilt, repriced and audited against the current snapshot and exact execution locks. A native proposal replaces it only if its canonical joint incremental fee is strictly less than the cache fee minus the fixed numerical epsilon `1e-6`. Equal-fee or costlier proposals retain the valid cache. Invalid or absent caches use native recovery.

No additional solve, second lexicographic MILP, revision weight in KRW, learned threshold, new solver parameter, or result-selected budget is introduced. Revisions remain counts of changed pending event dates and are never converted into invented business costs.

The five fixed methods, in registry order, are:

1. `stableRetainV5`: unchanged legacy stable-retain baseline.
2. `costPolishV7`: unchanged V7 baseline.
3. `adaptiveV9`: unchanged V9 adaptive controller and synchronous candidate gate.
4. `highsV8`: unchanged original native HiGHS baseline.
5. `stableHiGHSV10`: the single native selection-rule change.

Every old baseline retains its V9 formal call configuration exactly. The candidate configuration equals `callBudgets.highsV8` exactly. V5 retains its legacy solver-internal 0.2 seconds; other methods retain cooperative 200-ms whole-call budgets. Native setup remains separately reported and charged to the parent cold-episode budget. No daily clock is claimed to be identical to the legacy V5 internal solver clock.

## New scenarios, repeats and timing

The generator, fixed order-knowledge assumption, two panels, matrix, and shock patterns are unchanged from V9. There are 3 workload mechanisms × 2 capacity profiles × counts 24/50/100 × 4 scenario repetitions = 72 business scenarios per panel, 144 total. Same-distribution uses new base seeds `491001..491072`; stress uses `492001..492072`. These commitments are fixed before input generation. Three algorithm/timing repeats use `49011`, `49023`, and `49039`. They are not three additional independent business scenarios. Native RNG remains fixed at 0 by the unchanged service.

Each episode executes in a fresh POSIX process group. The parent starts its clock before fork; the common 5000-ms limit includes imports, native `ready`, daily decisions, physical execution, terminal dual audit, native `close`, IPC delivery, and parent receipt validation. Native descendants are group-killed on deadline or worker termination. Complete counts require a terminal full execution receipt audited by the parent before that deadline. Unavailable history and fees remain unknown/null, not zero. Daily native results that arrive or finish audit too late cannot become newly accepted candidates.

All methods run serially; cyclic method order rotates with scenario and repeat. Full scenarios, execution histories, shocks, observations, candidate dates, rejections, terminal evidence and hashes remain append-only. Duplicate order-list fingerprints are disclosed without resampling. All failures and negative outcomes count, including initialization failures, late feasible results, completion losses, and increased fees or revisions.

## Freeze and execution

`scripts/benchmark-v10.mjs --inspect` expands metadata only; it does not call the order generator. `--freeze` is a separate root-authorized action that snapshots protocol, package files, generator, every implementation script and worker with SHA-256 and records `generatedProspectiveInputs: false`. `--run --frozen PATH` verifies live and frozen source hashes and new-output exclusivity before importing the order generator and episode workers from the frozen source snapshot. Frozen artifacts, input files, episode files, and first-run outputs must never be overwritten. A reproduction requires a different output directory.

No `--freeze` or `--run` may be invoked while implementation/review remains open or before root authorization. Development checks use only handwritten fixtures or already observed V8/V9 inputs. Changing methods after seeing prospective outcomes requires another version and new unused scenarios.

## Pairwise estimates and uncertainty

The fixed comparison keys are `v10VsHiGHS`, `v10VsV9`, `v10VsV7`, `v10VsV5`, and `highsVsV7`. The first four compare candidate V10 to the named unchanged baseline. Completion uses all matching scenario-repeat pairs, including failures, and reports both gains and losses. No improvement in average rate erases the individual completion losses.

Fees use each pair's own jointly completed matching repeats: first average those matching repeats within each eligible scenario, then give each eligible scenario equal weight. Disclose scenario and episode denominators, raw episode totals, scenario-mean sums, zero baseline counts, win/tie/loss, negative scenario and episode IDs, and worst losses. Incomplete fees are null. Conditional fee estimates do not remove completion-selection bias and cannot rank methods across different paired subsets.

Both total and incremental fees retain 2000-draw percentile scenario-cluster bootstrap intervals with fixed seed `700001`. Completion intervals resample whole scenario completion-rate differences. Repeats stay together. Same-distribution and stress always remain separate; there is no pooled leaderboard.

## Observed gates for recommendations and claims

`summary.panels[panel].observedDecisionGates` stores the following prespecified necessary checks. `assessmentState` is `complete-panel` only when all 72 scenarios contain three repeats and all five method receipts; otherwise it is `partial-panel` and recommendation/claim flags stay false.

- `completionLossCountsByBaseline` retains the full-sample V10 completion losses against each of the four old methods. `completionNonRegressionAllBaselines` means all observed counts equal zero. `defaultRecommendationEligible` additionally requires a complete panel. Any loss prevents default eligibility in that panel. Passing this necessary finite-sample check is not a production recommendation or a universal non-regression guarantee.
- Native fee claims inspect the savings percentage interval without moving a zero endpoint by numerical tolerance. A missing interval is `unavailable`; a wholly positive interval is conditional evidence of savings; a wholly negative interval is conditional evidence of deterioration; an interval containing zero is `no_stable_advantage`.
- `nativeComparison.revisionDelta` is candidate minus original-native revisions on exactly that native jointly completed repeat set. It is null unless every fee-paired episode has both revision counts. `strictRevisionReduction` requires this complete known set to be nonempty and the delta strictly negative.
- `noRobustFeeDeterioration` requires both fee intervals to be available and neither savings interval wholly below zero. `stabilityImprovementClaimAllowed` additionally requires a complete panel, zero original-native completion losses, and strict revision reduction on that same paired set. This permits only a conditional stability statement, not a general fee or operational claim.

## All-five common subset and Pareto table

Pairwise subsets differ, so an additional `jointCompletePareto` uses only the same scenario-repeats where all five methods completed. For each eligible scenario, average matching joint repeats first. Each method then has separate sums of scenario means for total KRW, incremental KRW, and revision events. The table discloses joint scenario/episode counts, scenario IDs and matching-repeat counts, raw episode sums, and each method's full-sample completion count/denominator alongside the conditional metrics.

The two frontiers are `totalAndRevisions` and `incrementalAndRevisions`. Method A dominates B only if its fee and scenario-mean revision count are both no worse and at least one is strictly better, using numerical comparison epsilon `1e-6`. There is no weighted scalar score or invented revision price. No common sample produces null sums/frontiers. Unknown revisions produce null revision sums and null Pareto status for that method, never an apparent zero-revision winner.

`allMethodCommonComplete` is a thin display alias with `scenarioCount`, `episodeCount`, and method rows `totalScenarioMeanSumKRW`, `incrementalScenarioMeanSumKRW`, `revisionObservedSum`. Its last field is the raw joint-episode revision total, not the scenario-mean revision axis used for Pareto; its scope explicitly states this distinction. Conditional Pareto status never overrides full-sample completion losses or establishes a winner over the entire panel.

## Validation and evidence scope

Run `PORTPLAN_V10_FACTORY_SMOKE=1 node --test tests/benchmark-v10.test.mjs` for handwritten cold factory integration plus process deadlines, receipt audits, preserved selection/gate evidence, repeat matching, null handling, all-five weighting, Pareto direction, default loss checks, zero-inclusive fee intervals, and revision uncertainty. This test command does not generate new business scenarios.

Independent Python reviewers separately reconstruct causal physical execution, prices, V9 candidate gates, V10 native selection proofs, artifact bindings, point estimates, bootstrap intervals, common-set tables and decision gates. Internal independent implementation checks are not third-party certification; recorded clocks are not authenticated physical delivery timestamps. Conclusions remain limited to this synthetic daily atomic truck/warehouse/staging model. Real quotations, enterprise validation, outside user feedback, individual defense readiness and competition ranking require separate evidence.
