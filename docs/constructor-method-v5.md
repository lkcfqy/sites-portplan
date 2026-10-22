# V5 fast feasible constructor

V4's equal end-to-end experiment found that constructing four original greedy policies could exhaust a short budget before a 100-container search or MILP supplied a complete incumbent. Those policies repeatedly scan every pending container, rebuild occupancy from existing rows, and decode dates inside the scan. The V5 constructor replaces that initialization path with cached per-day prices, one sorted container order per attempt, and resource occupancy arrays updated in place. It supplies an audited feasible candidate quickly when construction succeeds; it does not certify optimality or guarantee a lower-cost plan.

Implementation: [fast-constructor-v5.js](../src/fast-constructor-v5.js). Checks: [constructor-v5.test.mjs](../tests/constructor-v5.test.mjs). V4 evidence remains in [evaluation-v4.md](evaluation-v4.md) and its unchanged archive. New V5 evaluation must use a separately frozen protocol and new seeds; V4 is development data.

## Interface

```js
import {solveFastConstructor} from './src/fast-constructor-v5.js';

const start = performance.now();
const candidate = solveFastConstructor(scenario, {
  deadlineMs: start + 200,  // Absolute performance.now() clock in this process.
  seed: scenario.seed,
  maxRestarts: 16,
  objectiveMode: 'joint',
  onIncumbent(result) {
    // Complete audited, canonically priced snapshot; safe to send by IPC.
  },
});
```

`timeBudgetMs` is an alternative relative budget, defaulting to 1,000 ms. An explicit `deadlineMs` takes precedence. `maxRestarts` counts additional attempts after the first: 0 makes one deadline-order attempt; 16 permits 17 attempts. The default is 15 additional attempts; the supported range is 0–128. Attempts stop when either this count or the deadline is reached. `seed` uses the project's deterministic 32-bit LCG; finite-budget execution can still vary with host timing. `objectiveMode` supports `joint`, `storageOnly`, and `ddOnly` and uses the full incremental modeled fee as a secondary preference.

Success returns the standard complete policy result with `policy: 'fastConstructor'`, `status: 'feasible'`, `auditValid: true`, canonical rows and fee totals, `optimality: 'heuristic'`, an `incumbentSource` such as `fast-constructor-deadline`, and `constructorMetadata`. That metadata records preparation and first-incumbent times, attempts and sort choices, trip/capacity/repair counts, improvements, callback errors, and deadline status. The result can enter an existing event search through `initialPolicies` or serve as an audited cutoff for the presolver. It is a feasible candidate, not a GLPK MIP warm start.

Failure returns `status: 'no_feasible_schedule_found'`, empty `rows` and `usage`, and null fee and objective totals. Failed/partial constructions are never costed as completed plans. Even an empty individually feasible trip domain is reported through this heuristic failure status; the constructor API does not issue mathematical infeasibility proofs. Unsupported executed-event locks (`fixedEvents` or `minEventDay`) throw rather than silently suggesting a plan inconsistent with already executed actions.

## Price and domain preparation

The research fee model separates storage, which depends on pickup day, from D&D, which depends on return day. For each container and each of the `H` horizon days, one canonical `containerCost(c, d, d, ...)` call provides both day-price components and their fixed pre-horizon fee bases. Price ranking therefore uses `N × H` evaluations instead of repeating date parsing for every candidate triple or every pending scan. The resulting separable sum is used only to rank trip choices; completed rows are repriced with `rowFor` before acceptance.

Each container's legal `(pickup, unloading-start, return)` triples are enumerated once. Release, delivery deadline, unloading duration, return lag, and horizon limits restrict the domain. Prefix counts of individually unavailable warehouse or staging days reject impossible intervals in constant time. A same-day pickup/return requires two truck movements on the same day. Warehouse occupancy covers all unloading days; staging covers `[pickup, return)` and uses either container units or TEU as configured.

Trip domains are ordered by selected objective, full incremental fee, shorter staging residence, return day, pickup day, and unloading-start day. This direct date ranking can delay pickup or return relative to an earliest decoder. Domain preparation costs at most `O(N × H³)` candidate enumeration plus sorting, with `H ≤ 31` and `N ≤ 100` under scenario validation. This is a bounded small-horizon method, not an asymptotic solution for arbitrarily large horizons.

## Construction and bounded repair

Each attempt sorts containers once, reserves a chosen trip, and updates integer truck, warehouse, and staging occupancy arrays in place. It does not repeatedly copy all prior rows or rescan all pending containers to choose the next container.

The first four attempts, when allowed, use these fixed orders:

1. Earliest latest-unloading-start date, then release and domain size.
2. Release day, then latest unloading-start date and domain size.
3. Largest next-day modeled fee increase at that container's cheapest individually feasible trip, then deadline and domain size.
4. Smallest individually feasible trip domain, then deadline and release.

Later attempts use seeded random container orders. They normally choose the cheapest resource-feasible trip, occasionally sampling one of the first three feasible alternatives. This creates variety without rebuilding trip domains or pricing dates.

When a container cannot be placed, repair removes at most the last three reservations, combines those containers with the failed container, orders this group by smaller domain and earlier deadline, and performs depth-first trip repair. A repair may inspect at most 128 candidate trips across a group of at most four containers. Every successful speculative reservation is removed again on a normal failed branch or candidate-limit cutoff. If time expires during an array update, the entire attempt's private occupancy arrays and selections are abandoned; neither is reused by another attempt or published as an incumbent.

The method can fail where a broader search or MILP finds a plan. Small repair groups and candidate limits are deliberate controls on initialization cost. Successful construction can also cost more than other methods. The downstream event search or MILP remains responsible for improving or proving the candidate within its remaining budget.

## Auditing, callbacks, and deadlines

All day-price, trip-generation, resource-check, construction, and recursive-repair candidate loops check a finite cooperative deadline. Only a complete selection reaches row construction. The constructor rebuilds every row and fee from the authoritative scenario, audits full coverage and all daily capacities, and summarizes canonical totals. It checks the deadline again after row construction, audit, and summary before accepting a new incumbent.

`onIncumbent` runs synchronously only after a complete audited improvement is retained. Rows, usage records, audit errors, sorting metadata, attempt records, and callback-error arrays are copied so callback mutation cannot alter retained rows or future sorting choices. A callback exception is recorded in metadata; the already audited incumbent remains available in the final return. Observers can themselves take arbitrary time, so cooperative checking cannot impose a hard process deadline on a slow callback. The equal-budget experiment's parent process must still enforce its own wall-clock cutoff and accept only timely delivered audited messages.

The implementation uses no external incumbent fee fields. Full pricing happens only for complete candidates, preventing fictitious negative costs or partial totals from entering a recommendation. The constructor does not mutate input scenarios.

## Development observations and limits

One development diagnostic used all 18 existing V4 cases, a 200 ms relative constructor budget, and 16 additional attempts. This was a same-process calibration with imported modules already available, not a cold end-to-end benchmark or a new held-out evaluation. It wrote only a temporary diagnostic file and left the V4 archive unchanged.

The constructor supplied 15 complete candidates out of 18; all 15 passed the independent V2 fee and resource audit. Observed complete-call mean was 15.95 ms and maximum was 38.21 ms. On successful 100-container cases, the first complete incumbent appeared at approximately 13.6–17.5 ms. These times describe that diagnostic environment and are not promised latency bounds.

The constructor found complete plans for two V4 cells where every original 1,000 ms method had delivered no incumbent: aged-backlog balanced 100 and batch-release tight 100. Their modeled incremental fees were 39,053,800 and 4,137,500 KRW. These are development findings, not new generalization evidence. The constructor still failed aged-backlog tight 16, 50, and 100; several successful candidate fees exceeded the archived event-search or MILP fees. Fast feasibility must not be presented as universal fee superiority.

Seven focused tests cover same-day double truck use, TEU aggregation, changing daily capacities and interval endpoints, rollback repair that must delay a previous return, callback mutation and observer exceptions, expired or invalid budgets with null partial fees, and canonical 100-container pricing across all three objective modes. The repair fixtures were independently checked by a separate reviewer using small exhaustive resource enumeration. Review identified mutable callback arrays; those were isolated and included in the regression check.

The next fair evaluation should freeze unseen seeds and the exact constructor/search handoff before running. Compare cold raw MILP, archived V4 search behavior, and a fast-constructor candidate followed by direct event search under the same parent-enforced end-to-end budget. Retain failures, high-cost incumbents, zero costs, and losses. Initialization speed is the hypothesis; general savings remain unproved.
