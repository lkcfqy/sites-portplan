# PortPlan V3 — public-only presentation script

## Three-minute script

Good afternoon. PortPlan asks a specific question: when container storage fees jump across a charging tier, how should a capacity-constrained importer schedule pickup, unloading and empty return?

The entire project uses information available online. We combine official Korean tariff publications, controlled scheduling experiments, public vehicle gate records, and an attempted reproduction of an independently published method. Each source supports a different claim.

For PNC, a twenty-foot container stored for fourteen days costs 318,500 won under the published rule. At fifteen days, the fee becomes 500,500 won, because the highest reached rate applies to all chargeable days. The additional day therefore adds 182,000 won. Our implementation agrees with the explicit fifteen-day example in PNC's official PDF. A separate Maersk official example confirms a first-band charge of 90,000 won; it does not settle the cross-band interpretation, which we disclose.

Our scheduling experiment covers forty-eight distinct generated order sets and compares six methods under identical information and constraints. Across thirty-six feasible pairs, modeled incremental charges fall by 15.74 percent relative to the strongest available internal baseline. Fourteen new-arrival pairs cost zero under both methods. These are conditional model results, not realized enterprise savings.

We also test a component on real public observations. More than fifty-eight thousand Gwangyang gate visits supply entry and exit timestamps. January to April trains three declared estimators, May selects one, and June remains the test period. On 9,152 June visits, the selected entry-hour median has a mean absolute error of 16.47 minutes, compared with 16.88 minutes for the global median. The improvement is modest and concerns gate duration only.

Finally, the project exposes failures. A hundred-container case favors the heuristic when the integer solver times out. A conservative buffer survives eighteen specified disturbance checks but costs 32.29 percent more in total modeled charges. The external paper's original archive also fails because a referenced file is missing; a clearly labeled supplemental assumption produces outputs whose complete feasibility remains unverified.

Our contribution is an inspectable public-data application: exact fee rules, reproducible conditional scheduling value, real-observation error testing, and an explicit cost of resilience. All sources, assumptions, code and failed cases are available for review.

## Questions about the public-only scope

**Can a project be complete without private company data?**

Yes, within a public-data research scope. Official worked examples validate narrow calculations; fixed simulations evaluate the planning model; observed gate records test a duration-estimation component. Enterprise deployment, private contractual applicability and realized savings are outside this submission's claims.

**Are the 58,171 gate visits real container orders?**

They are observed vehicle visits at Gwangyang West Container Terminal. They have no matched PNC discharge-to-empty-return chain. We do not relabel them as containers or use them to claim PNC savings.

**Why is the observed-data improvement only 2.42 percent?**

The declared models use very little information: entry hour and weekday. The selected method is chosen on May, not June. Its June mean absolute error is reported together with a 35-minute P90 absolute error. A small improvement is retained rather than replaced by a favorable, retrospectively selected result.

**Does the paper reproduction establish that PortPlan beats an external algorithm?**

No. The external study has a minute-level routing and appointment objective. The original archive lacks a required distance file; the supplemental-assumption outputs have route/time structural inconsistencies. We report those findings and unverified costs, without putting them on a cross-model performance leaderboard.

**What remains unknown?**

The Korean D&D cross-band accumulation interpretation is not settled by the available official first-band example. The daily model also excludes routes, appointments and executed-action freezing. These limitations delimit the result; they do not require the entrant to obtain private evidence to complete this public-only study.

**What did the entrant develop?**

The project uses GLPK and AI-assisted development, with sources and licenses retained. The entrant must accurately describe their own review, decisions and changes and be able to explain the fee rules, model and evidence. The submission does not claim the open-source solver or existing joint scheduling concept as an original algorithm.
