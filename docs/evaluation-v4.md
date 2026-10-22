# V4: equal end-to-end budget, stronger event-date search, and retained negative results

The frozen 18-case experiment does **not** show a general fee advantage for the safe-presolve composite. Direct event-date search improves the old permutation search on the paired cost aggregate, while cold raw GLPK is faster on the median and achieves more within-budget optimal solutions. The composite produces six analytic lower-bound certificates and preserves two additional feasible outcomes relative to raw GLPK, but its initialization cost causes material losses in two comparisons. These findings support an audited planning and certification contribution; they do not support a claim of universal cost superiority, observed customer savings, or a likely competition placing.

Evidence: [frozen protocol](../data/protocol-v4.json), [complete raw archive](../data/benchmark-v4.json), [runner](../scripts/benchmark-v4.mjs), [date-search implementation](../src/event-search-v4.js), and [checks](../tests/benchmark-v4.test.mjs).

## Protocol and data boundary

The protocol was saved before executing V4 cases. Its SHA-256 is `cfda2b5cdf2bd5806a9fdbc0b380eea7e03cccfe04e51e01528365d0230acfc1`. This proves byte identity and local sequencing, not external preregistration. The 18 cells are a complete 3 × 2 × 3 factorial: aged backlog, new arrivals, and batch release; balanced and tight capacity profiles; 16, 50, and 100 containers. Each cell uses one distinct fixed seed, 41001 through 41018. No outcomes were used to select or replace cells. These are artificial stress cells, not 18 representative business samples.

The unchanged V2 generator defines synthetic order dates, release dates, unloading durations, deadlines, and capacities. All fees use publicly sourced tariff parameters and the already disclosed D&D progressive interpretation. No private terminal records, orders, customer histories, or internal dispatch plans enter the experiment. Incremental modeled fees subtract the fixed pre-horizon accrued-fee base; that base is not verified accounting expenditure. Independent fee and resource checks reuse the separately implemented V2 audit, together with the engine's complete-schedule audit.

Each method runs in a new Node child process with the same 1,000 ms parent-clock budget. That clock includes spawning, dynamic imports, greedy initialization, WASM setup, model construction, presolve, auditing, and result delivery. An internal GLPK time limit is only advisory. The parent kills a child at its deadline and accepts no messages received after the budget. Complete independently audited checkpoints received before the deadline may survive a kill, with their source exposed and their status reduced to an unproved feasible incumbent. A killed solve never inherits a later optimality proof. Recorded kill/exit overhead can extend beyond 1,000 ms, but no later incumbent or proof is accepted.

Only one method child runs at a time; method order rotates each case. Timing remains subject to host and operating-system variation. The archive records source hashes, Node and OS details, host introspection, cgroup limits, and per-method delivery/exit timings. The run is a single exploratory measurement; wall-clock-limited stochastic search need not replay an identical number of iterations.

## Methods

| Archive key | Method | Incumbent and proof semantics |
| --- | --- | --- |
| `permutation` | Four original greedy policies, then batches of one randomized start and four permutation relocate/swap moves with the original earliest decoder. | Heuristic only. Initial-policy construction and every batch consume the budget. |
| `eventSearch` | Four greedy initial policies, followed by direct `(pickup, unloading-start, return)` date relocation, full restarts, and randomized removal/repair of two to six containers. | Heuristic only. Every trip checks daily truck movements, unloading slots, and staging occupancy; every accepted complete candidate is audited. |
| `rawMILP` | Cold time-indexed GLPK MILP with V4 domain presolve disabled and no heuristic fallback. | A feasible/optimal result belongs to raw GLPK; a timeout without a delivered solution has null fees. |
| `presolveMILP` | Four greedy policies and a small permutation batch supply an audited cutoff; then cold MILP uses individual-trip conditional lower bounds to reduce event domains. | A composite, not a GLPK warm start. An exact integer independent-bound certificate is analytic proof; initial-policy checkpoint fallback is heuristic and is not GLPK success. |

The event search sorts individually feasible trip dates by modeled objective, total incremental fees, and shorter staging residence. Repair usually chooses its cheapest feasible trip and occasionally samples one of the first three feasible alternatives. Single-container moves can alter all three dates while keeping every other container's dates fixed; a permutation decoder cannot express those moves directly. A separate current state permits small uphill repair moves to escape local minima, while the best complete audited incumbent is retained. No superiority guarantee is claimed.

The existing greedy initialization and permutation decoder are synchronous and do not support cancellation inside every original helper. The authoritative parent deadline and checkpoint mechanism cover those calls. The new direct-date candidate and repair loops check their cooperative deadline inside candidate and resource loops. A partial repair is discarded and never assigned a valid fee total.

## Completed results

All 18 declared cells and all four methods are retained. The archive contains 53 complete feasible schedules; all 53 pass independent constraint and fee audits. Eight current V4 tests pass, including an actual synchronous child that the parent kills while retaining only a timely feasible checkpoint, external-input hardening, and source-snapshot byte verification.

| Method | Complete feasible outcomes / 18 | Within-budget optimal proofs | Hard deadline kills | Retained feasible checkpoint after kill | Median end-to-end ms |
| --- | ---: | ---: | ---: | ---: | ---: |
| Permutation | 13 | 0 | 2 | 1 | 984.5 |
| Direct event search | 14 | 0 | 3 | 1 | 981.1 |
| Raw MILP | 12 | 12 | 5 | 0 | 212.7 |
| Safe-presolve composite | 14 | 11 | 6 | 3 | 672.5 |

The composite's 11 proofs comprise **six independent lower-bound certificates and five GLPK optimal solutions**. All six certificates are new-arrival cells with zero incremental modeled fees. Their value is proving that an audited feasible zero-fee plan already attains the nonnegative lower bound; their savings are zero. Raw GLPK proves one aged-backlog tight 100-container cell infeasible. Heuristic failures and other timeouts are not infeasibility proofs.

| Candidate compared with baseline | Paired cells | Lower candidate fees | Equal fees | Higher candidate fees | Paired modeled fee difference, KRW | Weighted modeled incremental reduction |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Event search vs permutation | 13 | 4 | 7 | 2 | 838,700 | 3.839% |
| Composite vs permutation | 13 | 4 | 7 | 2 | −1,413,100 | −6.469% |
| Composite vs event search | 14 | 3 | 9 | 2 | −2,140,500 | −7.612% |
| Composite vs raw MILP | 12 | 0 | 10 | 2 | −1,952,550 | −7.505% |
| Raw MILP vs event search | 12 | 5 | 7 | 0 | 948,050 | 3.516% |

Positive fee difference means the candidate costs less. Percentages divide the paired aggregate difference by the paired baseline incremental-fee sum; they are not a mean of per-case percentages. Different rows have different paired subsets. Six paired permutation/event cells have zero baseline fees, so their per-cell percentages are null while the zero outcomes remain in aggregate counts. The raw-MILP comparisons include five zero-fee paired cells and exclude its missing outcomes; a favorable paired result does not erase raw MILP's lower feasibility count.

By scale, complete feasible counts `(permutation, eventSearch, rawMILP, presolveMILP)` are `(5,6,6,6)` for 16 containers, `(5,5,4,5)` for 50 containers, and `(3,3,2,3)` for 100 containers. Tightness and mechanism matter as much as size; these six cells per scale do not estimate a general success rate.

## Cases that limit the claim

- Aged-backlog balanced 50: raw MILP proves 12,014,450 KRW; event search finds 12,750,650; permutation finds 13,023,750; the composite is killed and retains its initial marginal-cost plan at 13,921,500. The composite is 1,907,050 KRW worse than raw MILP in this cell.
- Batch-release tight 50: event search finds 1,155,700 KRW versus permutation's 1,658,900. Raw MILP supplies no incumbent before its deadline. The composite retains its initial earliest-deadline plan at 2,291,700, which is 1,136,000 KRW worse than event search.
- Batch-release balanced 100: raw MILP proves 1,010,100 KRW; the other three methods are killed while retaining an initial FIFO plan at 1,055,600.
- Event search has two paired losses against permutation: 1,300 KRW on aged-backlog balanced 16 and 9,100 KRW on batch-release balanced 50. A stronger move space is not a universal finite-budget improvement.
- Aged-backlog balanced 100, aged-backlog tight 50, and batch-release tight 100 supply no complete solution for any method under the budget. Their null costs remain in the archive and denominators.

The current evidence favors exposing strategy choice and incumbent source rather than silently defaulting every scenario to the composite. An analytic certificate can terminate easy zero-fee cases with proof, while raw GLPK can be more efficient when heuristic initialization consumes most of a short budget. The result is a reason to measure dispatch policies and setup cost in a subsequent separately frozen protocol; it is not permission to tune this run and replace its negative findings.

## Reproduction and checks

Run `node scripts/benchmark-v4.mjs` to execute the declared matrix and write a separate reproduction to `artifacts/benchmark-v4-reproduction.json`, then `node --test tests/benchmark-v4.test.mjs` to verify frozen cases, deadline handling, direct-date moves, null partial fees, retained losses, and every archived complete schedule. The current runner rejects overwriting `data/benchmark-v4.json`; an optional `--output` selects a different output path. The first-run snapshot preserves its original runner's output behavior inside the snapshot. Runtime-dependent outcomes may vary across hosts even with the same scenario seeds. `implementationHashes` identifies the source bytes used in the archived run.

The complete experiment source is retained in [the first-run snapshot](../vendor/experiments/v4-first-run-source/manifest.json). All eight source/protocol entries hashed at launch match the snapshot bytes. Additional runtime dependencies, package metadata, and the V4 protocol are included and identified separately. The snapshot runner needs its original `glpk.js` dependency installed from the copied lockfile; run it inside the snapshot directory to keep a rerun's archive separate from the recorded first result.

After the first run, the current event-search API was hardened to rebuild supplied initial-policy fee rows from the authoritative scenario and proposed dates, and to reject malformed/infinite dates before auditing. This protects external integrations from falsified initial costs. The original experiment used the engine's own untampered greedy initial policies, so this repair does not invalidate its recorded inputs. It can change runtime and attempted move counts; the first-run archive has **not** been replaced with post-repair results. A new regression check covers falsified fee fields and infinite dates. The source snapshot preserves the exact original search for study, while production code uses the safer API.

This experiment does not evaluate live traffic, contract-specific billing, intraday travel times, customs holds, or real-time routing. Dynamic operational execution is evaluated separately in the V4 rolling protocol; those results must not be merged into the paired fee denominator here.
