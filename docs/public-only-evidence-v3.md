# Public-only evidence plan — V3

This route uses public sources and reproducible computation. It does not depend on a business introduction, private shipment records, interviews, an organizer response or new material from the entrant. Preparation can continue with a clear separation between public observations, published constructed instances, official fee examples and our own experiments.

## What each public source can establish

| Evidence | What can be tested | What the result cannot establish |
|---|---|---|
| PNC 2026 standard tariff and its worked example | Exact fee arithmetic, retroactive bands, free days and the 08:00 counting rule | Every shipment's negotiated contract, tax basis or actual invoice |
| Maersk Korea tariff and official calculator example | Public dry-container rates, inclusive dates and the first charging band | The unconfirmed cross-band accumulation interpretation or all special deals |
| Gwangyang West public gate visits | Coverage, missingness, visit-duration distribution and public-record data quality | PNC shipment demand, unloading, contracts or savings |
| Incheon public anonymized gate-event sample | Public event schema and limitations | Matched complete import-to-empty-return lifecycles |
| PLOS 2025 source code and supplements | Independent provenance of an external constructed instance; reproduction of its own algorithm/constraints | Real orders, PNC operating performance, or a comparison under a different objective |
| Our generated stress instances | Repeatable solver correctness, policy comparisons, ablations and robustness within explicit assumptions | Out-of-sample business savings or observed operations |

These sources support a strong computational prototype and transparent evaluation. The project should claim **a reproducible public-evidence study of tariff-aware planning**, with documented scope, rather than a deployed solution or proven real-world savings.

## Official fee examples, kept separate from derived tests

- **PNC:** `data/public/pnc_2026_standard_tariff.pdf`, page 4, [official original](https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf). The stated example is a full 20′ import at 15 storage days: 11 chargeable days × ₩45,500 = **₩500,500**. No particular discharge or pickup date is supplied in that example. Any dates used by a test harness to create 15 days are generated test inputs, not an observed invoice.
- **Maersk:** `data/public/v2-maersk-korea-calculator-guide.pdf`, page 1, [official original](https://www.maersk.com/~/media_sc9/maersk/local-information/files/asia-pacific/korea/import/freetime-pre-do-check-guideline.pdf). The screenshot gives 40 Dry High, free December 3–12, 2025, return December 15, three chargeable days and **₩90,000**. This does not cross a paid rate boundary.
- Tests at days 4/5, 7/8, 9/10, 14/15 and 08:00 are **derived boundary tests** of PNC's published rule, not more official worked examples. Tests across Maersk days 15/16 or 20/21 remain conditional on the disclosed accumulation interpretation.

The PNC public-rate conflict and Maersk cross-band uncertainty remain in `rules-status-v2.md`; an official-example pass does not remove them.

## PLOS external instance: exact public inputs

Citation: Huang P, Wang H, Tan F, Jiang Y, Cai J (2025), [Optimization of external container delivery and pickup scheduling based on appointment mechanism](https://doi.org/10.1371/journal.pone.0318606), PLOS ONE 20(2): e0318606, CC BY 4.0. The experimental setup calls this a constructed simulation: one terminal, six external yards, 24 hours. It is an independently published constructed instance, not a real shipment ledger.

Unmodified artifacts and hashes:

- `data/public/v2-external-plos-code.zip`: S1; contains `S1 file/Code/Main.py`, `demand2`, `distance`, `time_list2`, `README.docx`.
- `data/public/v2-external-plos-data.zip`: S2; contains `Date/Date.xlsx`.
- `data/public/v2-external-plos-article.xml`: original article with machine-readable tables and MathML equations.
- `data/public/v2-external-download-metadata.json` and `v2-external-manifest.json`: source URLs, retrieval time and SHA-256.
- `data/public/v2-external-plos-instance-audit.json`: extracted input matrix, field provenance, both parameter variants and workbook cell inventory.

The original text inputs, cross-checked against article Table 2, are:

| Yard node | Delivery earliest minute | Delivery latest minute | Yard → terminal tasks | Terminal → yard tasks |
|---:|---:|---:|---:|---:|
| 2 | 0 | 720 | 63 | 50 |
| 3 | 240 | 840 | 51 | 60 |
| 4 | 960 | 1440 | 43 | 40 |
| 5 | 0 | 360 | 36 | 45 |
| 6 | 720 | 1080 | 31 | 36 |
| 7 | 720 | 1440 | 72 | 65 |

There are 296 tasks in each direction, **592 directional tasks in total**. The `100` before each six-yard demand row is an indexing/sentinel value, not an additional order count. Delivery and pickup counts are aggregate directions; they do not identify 296 paired import and empty-return containers.

`distance` is the following symmetric matrix in km; node 1 is the terminal:

```text
        1  2  3  4  5  6  7
1       0 40 43 30 30 16 21
2      40  0 44 15 46 24 30
3      43 44  0 31 16 42 23
4      30 15 31  0 32 18 16
5      30 46 16 32  0 46 42
6      16 24 42 18 46  0 19
7      21 30 23 16 42 19  0
```

Time is measured in minutes on `[0,1440]`; the 12 terminal appointment slots are 120 minutes each. No calendar date, tariff, container size, discharge, customs release or shipment contract exists in these inputs. Do not invent those values to turn this into a PNC dataset.

### Preserve the two parameter variants

| Parameter | Article tables | Supplied code / S2 |
|---|---|---|
| Slot capacities | `[41,39,45,42,40,31,37,35,37,41,39,43]` | `[41,39,45,42,40,31,37,35,47,41,39,43]` |
| Yard handling `t1`, minutes | 3.5 | 3 |
| Gate waiting `t2`, minutes | 5 | 5 |
| Terminal operation `t3`, minutes | 2.5 | 6 |
| Early/late flexibility | 15 / 60 minutes | 15 / 60 minutes |
| Early/late penalty factors | 0.2 / 2 | 0.2 / 2 |
| Loaded/empty speed | 40 / 60 km/h | 40 / 60 km/h |
| Loaded/empty fuel cost | 2.8 / 1.76 RMB/km | 0.35 / 0.22 L/km × 8 RMB/L |
| Idling fuel cost | 6.4 RMB/h | 0.8 L/h × 8 RMB/L |
| Vehicle daily fixed cost | 400 RMB | 400 RMB per route/truck |

Source mapping: article Tables 1–5; `Main.py` lines 756–770. Do not silently create a third hybrid profile. Label results “article-table parameter variant” or “supplied-code parameter variant”; neither label resolves which version generated every reported result.

S2 `Sheet1` has 41 nonempty cells in 11 row elements: six cost sequences of 500 iterations and two 12-slot arrival series plus labels. Sheets 2 and 3 are empty. A 500-iteration sequence is not 500 independent test instances. The row named “Actual arrival quantity” is a figure-result series from this experiment, not an operational gate log.

## Original objective and route semantics

Article equation (1) minimizes:

\[
Z = Z_{transport} + Z_{transfer} + Z_{fixed} + Z_{early/late}.
\]

Equations (2)–(5) respectively describe terminal/yard travel, empty inter-yard repositioning, per-vehicle fixed costs and gate-arrival penalties. This is **fleet cost in RMB**, not terminal storage plus carrier D&D in KRW.

For understanding the supplied code, the cost components have the following numerical form:

\[
2.8 L_{loaded} + 1.76 L_{empty}
+ \frac{6.4}{60} M_{charged\ service}
+ 400 K
+ \sum_a \{0.2\max(0,r_a-A_a)+2\max(0,A_a-d_a)\}.
\]

Here distances are km, `K` is the number of completed truck routes, and `M` is the service/idling time actually charged by the source implementation. It is not automatically all elapsed waiting. This component summary is not a claim that every branch or paper equation has been proved equivalent to it.

In normal code branches, yard→terminal travel adds `60*distance/speed + t1/2 + t2 + t3/2` minutes; terminal→yard adds `60*distance/speed + t3/2 + t1/2`. Corresponding service minutes receive the `6.4/60` charge. Inter-yard repositioning charges empty travel plus `t1` service minutes. Early/late penalties use arrival relative to the yard's delivery window. `total_path` stores routes, `total_node_time_list` stores corresponding minute values, and `slot_list` stores terminal arrivals by slot. The final fixed-cost addition is `len(total_path)*400` (line 594).

The full model also requires directional demand completion, truck route continuity/return, travel and handling times, the terminal appointment limit and soft-window eligibility. A valid result needs more than a low scalar objective.

## New static findings affecting exact reproduction

1. **Missing input reference:** `Main.py` calls `calculate_distance('distance2', …)` at lines 475, 489, 509, 519 and later branches. S1 contains `distance` but no `distance2`. The contents of that missing file are unknown. Copying `distance` to `distance2` is a repair assumption, not execution of the unchanged released package.
2. **Possible capacity off-by-one:** several branches check a slot count `<= limit` and then increment it. This can permit `limit+1` if that branch is reached. The independent feasibility checker must enforce the actual capacity inequality; only a failing trace establishes that a particular result violates it.
3. **Formula presentation ambiguity:** the MathML of equation (6) ends its late interval with `t_d + t_1`, while the declared late allowance and equation (14) use `t_l`. Record this as an unresolved notation discrepancy; do not silently declare the paper and implementation identical.
4. **Execution environment:** README does not pin dependency versions; source imports pandas as well as numpy/matplotlib and selects TkAgg. No seed call was found in the supplied script. Headless execution and explicit seeds are acceptable reproduction adaptations only if recorded separately from model changes.
5. **Completion must be checked:** do not assume every returned route collection serves all 592 directional tasks or returns every truck to origin within the horizon. Recompute it from route/task event evidence. Preserve invalid/unfinished runs as failures rather than discarding them from averages.

These observations identify review requirements, not a blanket rejection of the publication. See `external-benchmark-audit-v2.md` for the original attachment inspection.

## Minimum fair external work that is implementable

### Preferred: replicate the source method on its own instance

Use the unchanged archive as the baseline artifact. First perform a bounded probe. Record any missing-file/GUI/dependency failures. A separately named repaired execution may substitute `distance2 := distance`, but must report that assumption, the exact patch, source hash, parameter variant, seed, budget and dependency versions. Run the same fixed budget for the two variants and retain all run statuses.

Independently recompute directional task counts, route continuity, terminal arrivals, capacity exceedances, timing/window violations, horizon completion and cost components. Compare a reproduced valid source run with the publication's saved result only under the same parameter interpretation. The published minimum of about RMB 74,887 is a reported result, not a certified optimum. This work is an **external reproduction and audit**, not “PortPlan beats IACO.”

### Optional smaller exact subproblem: delivery appointment allocation relaxation

If full route reproduction remains blocked, an explicitly labeled **source-derived appointment relaxation** is implementable from the original six delivery demands, minute windows, penalties and both slot-capacity vectors. It is a limited capacity/window check, not the original drayage problem.

Define integer `x[i,t]` = number of yard `i`'s terminal-bound delivery tasks assigned to slot `t`. Keep the original 296 delivery tasks. For each slot use its actual minute interval, clipping the extended window to `[0,1440]`. Define `c[i,t]` as the minimum early/late penalty over times in that slot that lie within `[r[i]-15,d[i]+60]`; disallow the arc if that intersection is empty. Declare slot endpoints explicitly, e.g. half-open slots with minute 1440 assigned to the final slot. Do not silently evaluate every task at the slot start.

\[
\min \sum_{i,t} c_{i,t}x_{i,t},\qquad
\sum_t x_{i,t}=Q_{i1},\quad
\sum_i x_{i,t}\le R_t,\quad x_{i,t}\in\mathbb{Z}_{\ge0}.
\]

This is a small transportation/min-cost-flow problem. It deliberately relaxes trucks, travel, handling, terminal-to-yard pickups and route coupling; the full terminal capacity is therefore an optimistic resource budget. A feasible or zero-penalty solution does not prove full-route feasibility. With the published capacities the instance may have little discriminatory power; if stress levels are added, label them as our derived scenarios and preserve the original case separately. Report only the relaxation's penalty and feasibility, never the original total fleet-cost percentage improvement.

Do not relabel this as a 14-day tariff benchmark, assign fake containers/contracts, or compare its RMB objective to PortPlan's KRW costs. A smaller honest subproblem is better evidence than a numerically impressive comparison between different problems.

## Competition deliverables under the public-only route

1. A source table and downloadable originals with hashes, observation/constructed/derived labels and known conflicts.
2. Separate official-example and derived-boundary fee checks, with counts and unresolved applicability stated.
3. A public-method reproduction audit with executable settings, valid/invalid run counts and a source-linked discrepancy log.
4. PortPlan's own labeled generated benchmark with exact feasibility checking, baseline alignment, held-out instances and targeted tariff/return-lifecycle ablations.
5. A short claim table: what was observed, what was reproduced, what is conditional and what remains untested. No real customer savings or external endorsement is claimed.

This evidence can all be produced without contacting anyone or obtaining private operational data. It provides a concrete, reproducible competition submission while keeping the remaining validity limits visible.
