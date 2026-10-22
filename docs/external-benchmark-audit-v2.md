# External benchmark audit — PLOS ONE 2025

Checked and downloaded 2026-10-12 UTC. **This is an independently published constructed scheduling instance, not real public shipment orders.** It is useful as a future external routing/appointment benchmark; it cannot validate PNC storage or Maersk D&D savings in the current day-level planner.

Source: Huang P, Wang H, Tan F, Jiang Y, Cai J (2025), [Optimization of external container delivery and pickup scheduling based on appointment mechanism](https://doi.org/10.1371/journal.pone.0318606), PLOS ONE 20(2): e0318606. The experimental setup explicitly describes a constructed simulation of one terminal, six external yards and a 24-hour task cycle. The publication XML states CC BY 4.0; retain the authors and source attribution. No private access, credentials or author contact was used.

## What was downloaded and inspected

| Official artifact | Local original | Size | Contents |
|---|---|---:|---|
| [S1 Code](https://doi.org/10.1371/journal.pone.0318606.s001) | `data/public/v2-external-plos-code.zip` | 17,819 bytes | `Main.py`, `README.docx`, `demand2`, `distance`, `time_list2` |
| [S2, labeled “Date” by publisher](https://doi.org/10.1371/journal.pone.0318606.s002) | `data/public/v2-external-plos-data.zip` | 141,081 bytes | One workbook, `Date/Date.xlsx` |
| [Article XML](https://journals.plos.org/plosone/article/file?id=10.1371%2Fjournal.pone.0318606&type=manuscript) | `data/public/v2-external-plos-article.xml` | 139,217 bytes | Original article, tables, methods and license |

The originals remain unmodified. URL, UTC retrieval time, ZIP inventory and original SHA-256 are in `v2-external-download-metadata.json`; a complete file hash list is in `v2-external-manifest.json`. `v2-external-plos-instance-audit.json` preserves parsed fields, workbook cell inventory and conflicting parameter variants. Total source download is under 300 KB. No package installation or algorithm execution was performed.

## Dataset grain and dictionary

| Source / field | Grain / unit | Interpretation |
|---|---|---|
| S1 `demand2` | Six yard records, two directional integer task counts | Aggregate yard-to-terminal and terminal-to-yard demands. Includes a sentinel `100` before each six-yard row; it is not an extra yard demand. Node indexing was checked against article Table 2. |
| S1 `time_list2` | Six delivery windows, minutes from start of one modeled day | A lower/upper delivery-window pair per yard. No calendar date or observed timestamp. |
| S1 `distance` | Symmetric 7×7 matrix, km | One terminal and six yard nodes; numeric distances, no latitude/longitude or named real locations. |
| `Main.py` appointment limits | 12 slots × 120 minutes | Maximum accepted terminal arrivals per time slot; has a disagreement with Table 3. |
| `Main.py` service and cost parameters | Minutes, km/h, RMB/L, L/km, L/h | Model parameters; not shipment-specific observed charges. |
| S2 workbook, Sheet1 | 11 populated row elements / 41 nonempty cells | Six 500-value cost-iteration series, figure labels and two 12-value terminal arrival series. This is result data, not 500 independent instances or shipment observations. |
| S2 Sheets2/3 | Empty | No hidden second/third shipment table was found in their XML. |

A sample input is yard 2: delivery window `[0,720]` minutes, 63 delivery tasks to the terminal and 50 pickup tasks from the terminal. Across six yards there are **296 tasks each direction, 592 directional tasks total**. These are not 592 identified containers with matched import and empty-return lifecycles. In particular, terminal-bound delivery tasks cannot simply be relabeled as the same imported containers' empty returns.

The workbook's “Actual arrival quantity” label is a plotted algorithm-result series within the constructed experiment; the word “Actual” does not turn it into an observed operational gate log.

## Concrete reproduction issues found

1. **Slot 9 capacity differs.** Article XML Table 3 gives `37`; both `Main.py` line 756 and S2 `Sheet1!J79` give `47`. All 12 original values of both variants are preserved. A reproduction must choose and disclose a variant or report both.
2. **Service parameters differ.** Article Table 5 lists yard handling `3.5` and terminal operation `2.5`; code lines 757/759 use `3` and `6`. The gate wait is `5` in both. The text separately mentions a 120-minute yard wait, while the code also has 120-minute advances; those concepts should not be merged without a full model audit.
3. **The workbook is mostly outcomes.** It contains no raw shipment table. The meaningful instance inputs are the three small text files and constants inside `Main.py`, supplemented by the article tables.
4. **Execution setup is not fully pinned.** README lists numpy/matplotlib, but source also imports pandas and uses the TkAgg GUI backend. No dependency versions or random-seed call were found in the supplied source. Only the supplied script was inspected; no claim of reproducing the published minimum cost is made.
5. **Baseline comparisons remain unverified.** S2 contains ACO/VNS/IACO result series, but the archive has only one Python source file. This pass does not establish complete independently runnable implementations of all reported baselines. Saved outcomes are not an optimality certificate.

These are observed reproducibility limits, not conclusions that the paper's result is invalid.

## Fair use as an external benchmark

A legitimate future reproduction would preserve minute-level time windows, distances, multi-trip route sequencing, terminal appointment limits, loaded/empty travel costs, waiting, penalties and vehicle fixed costs. It would first reconcile the parameter variants, then compare algorithms on the same objective and constraints with repeated recorded seeds. The published IACO outcome can be a reproduction target, not a certified optimum.

For the current PortPlan schema, only general ideas such as capacity stress and release/due-window handling transfer directly. A mapper could preserve the six yard rows, two direction counts, full distance matrix and both capacity variants in a **separate external scheduling schema**. Expanding aggregate tasks would produce generated task IDs; these must be tagged as derived/synthetic. Converting minutes into days changes the feasible set and therefore cannot produce a like-for-like comparison.

Missing for a real PNC/Maersk evaluation: identified shipments, discharge dates/times, customs release, container sizes, free-time contracts, carrier identity, terminal storage terms, warehouse unloading records and links from each import pickup to its empty return. Adding these values would create an adapted synthetic scenario, not recover real data. Do not impute them and advertise the result as external real-world validation.

**Decision:** retain the original public artifacts and parsed external instance as an honest future benchmark lead. Do not put its saved cost series or percentages onto PortPlan's performance leaderboard, and do not add it to a count of real PNC orders.
