# V9: timely complete-candidate delivery

Status: implemented with deterministic mechanism tests and hand-written fixture checks. No new prospective performance result is asserted by this document. The V8 first formal run and all negative results remain unchanged. Its 144 scenarios are development data for subsequent versions.

## Problem and resulting behavior

V8 initialized or rebuilt its plan by awaiting the entire nested V7/V6 recovery pipeline. That pipeline could construct a complete candidate early, then spend the remaining time on polishing or MILP. If the pipeline returned after the V8 outer deadline, V8 first saw the candidate too late and discarded it. An internal `firstIncumbentMs` field did not establish actual receipt and independent acceptance by V8.

V9 owns this recovery pipeline. The constructor synchronously publishes each complete improving candidate at its actual acceptance point. The outer V9 controller immediately isolates the proposal, rebuilds every row and price against the pristine current snapshot, audits continuous resource usage and execution locks, evaluates the selection rule, and checks its original deadline. A complete candidate accepted through this gate remains available if later optional work returns late or throws. A candidate first received, copied, audited, or selected after the deadline is never accepted retroactively.

## Scope and unchanged choices

New files are `src/candidate-delivery-v9.js`, `src/locked-recovery-v9.js`, and `src/adaptive-planner-v9.js`. V1–V8 implementation, protocols, and archived evidence are not edited. The owned constructor is derived from V6 with the same trip enumeration, order rules, bounded rollback, 15 restarts, and relocation rules. The sole constructor mechanism addition is synchronous complete-candidate publication. The existing V7 complete-plan polisher and shared engine/audit helpers remain dependencies.

The declared defaults are the same as V8: whole-call budget 200 ms, audit reserve 5 ms, constructor share 0.4, fee tolerance 0.005, at most six changed pending events, two-day forecast-pressure window, pressure guard enabled, and positive fee opportunity above a zero-KRW threshold. Polish defaults remain two passes, 32 pairs, 12 candidate trips, 384 pair checks, and 16 single targets. These values were not retuned using the old V8 formal scenarios.

Current-snapshot joint fees govern recovery selection. A strictly cheaper candidate replaces the current recovery incumbent; the legacy MILP equal-fee tie preference is preserved. Cached-plan polishing still requires a strict joint-fee decrease, the declared change cap, a fee saving above the stability tolerance, and no worsening of the declared deterministic pressure proxy when enabled. This proxy is not a probability of future failure.

## API and deadline contract

`createAdaptivePlannerV9(configuration)` returns one asynchronous `(scenario, options)` planner per sequential rolling episode. Results use `policy: "adaptiveV9"`. The controller rejects overlapping calls, non-joint objectives, malformed capacities, and executed-event locks that are not strictly before `minEventDay`. Only currently revealed snapshots and exact past execution locks are supplied; future shocks stay with the simulator.

The outer clock starts before input copying. Input isolation, validation, cache audit, gate construction, constructor callback processing, canonical repricing, physical/lock audit, and selection all consume that same budget. The gate takes actual entry/completion timestamps from the outer clock. It does not trust candidate fees, audit flags, capacities, execution locks, or internal first-incumbent timestamps. Candidate copies and returned results cannot mutate retained state.

The time budget is cooperative, not a hard interrupt of synchronous native work. Optional native work can return after 200 ms; it cannot erase an already accepted incumbent or introduce a late one. The separate five-second cold-episode parent deadline still requires complete execution, terminal checks, and cleanup before success is recorded. V9 does not add a parent IPC stream or a new acknowledgement deadline.

An optional `configuration.onIncumbent(candidate, receipt)` observer receives an isolated diagnostic copy after acceptance. Its return value or exception cannot reject an accepted incumbent. Official benchmark runs leave this observer disabled. It is not an acknowledgement of delivery to a parent process, a real operational controller, or a human operator.

## Candidate evidence

`plannerMetadata.candidateDelivery` has schema `portplan-v9-candidate-delivery-1`. It records `deadlineBasis: "outer-planner-start"`, call/day identifiers, budget, first/selected acceptance times, selected candidate sequence, final closed state, and every gate offer. Each offer records:

- Its sequential identity and source: `cache`, `locked_constructor`, `recovery_polish`, `locked_milp`, or `adaptive_polish`.
- Actual `receivedAtMs`, `copyCompletedAtMs`, `auditCompletedAtMs`, `selectionCompletedAtMs`, and `acceptedAtMs`, all relative to the outer start.
- Copied `proposedDates`, canonical valid `dates`, independently reconstructed `incrementalCost`, and physical/lock audit details when that phase ran.
- An outcome distinguishing acceptance, invalidity, late receipt/copy/audit/selection, guard rejection, lack of improvement, copy/audit/selection errors, unsupported asynchronous selection, or a closed gate.

`proposedDates` is retained immediately after successful copying even for malformed or invalid proposals. A proposal already late at receipt is not copied or audited. The final decision dates, fee, and `incumbentAcceptedAtMs` bind to the selected accepted sequence. A failed call has no accepted incumbent and keeps all fee fields unknown rather than inventing zero cost.

The timestamps are instrumented process-clock observations, not a cryptographic proof of external physical delivery. Deterministic tests control the outer clock to verify phase cutoffs; a separate Python reviewer checks artifact bindings, date feasibility, fees, accepted-time ordering, selection guards, and final selected-candidate identity.

## Validation and limits

Run the focused checks with:

```sh
node --test tests/adaptive-v9.test.mjs tests/candidate-delivery-v9.test.mjs
```

They include a hand-written 11-ms synchronous candidate followed by a 219-ms MILP return; forged internal timing; actually late callbacks; copy/audit/selection overruns; candidate mutation; solver/constructor exceptions; late optional polishing; closed-gate behavior; execution-history and continuing-unload capacity violations; an independent exhaustive tiny-domain fee oracle; causal prefixes; and unchanged V8 guard defaults.

Mechanism tests establish the intended behavior on these fixtures. They do not show that V9 improves completion, cost, robustness, or competition rank. Those claims require the separately frozen prospective protocol and its full independent review, including negative outcomes and explicit paired-case denominators.
