# Prior art and contribution boundaries — V2

Reviewed 2026-10-12 UTC. Machine-readable companion: `data/prior-art-v2.json`. Nine research works and three official products were checked. This is a focused search, not proof that all prior work has been exhausted.

An auditable application of public Korean tariff rules to resource-constrained pickup, unloading and empty-return planning, with reproducible policy comparisons and explicit contractual uncertainty. This is an application/engineering contribution; novelty of the combination has not been established.

## What the literature already covers

| ID / publication | Verified capability | Review depth / boundary |
|---|---|---|
| R1 · Yoonjea Jeong, Subrata Saha, Ilkyeong Moon (2020). [Optimal devanning time and detention charges for container supply chains](https://snu.elsevierpure.com/en/publications/optimal-devanning-time-and-detention-charges-for-container-supply/). DOI [10.1016/j.tre.2020.102055](https://doi.org/10.1016/j.tre.2020.102055) | Optimizes devanning time in a laden/empty container supply chain. Compares three late-return/detention decision scenarios and centralized/decentralized policies. | author-institution abstract and publisher-deposited metadata. Direct precedent for linking unpacking, empty return and detention. Full mathematical model was not reviewed; no claim that this paper lacks a particular tariff. |
| R2 · Yoonjea Jeong, Gwang Kim, Youngchul Shin (2026). [Uncertain demurrage and detention decisions in hinterland container management](https://onlinelibrary.wiley.com/doi/10.1111/itor.13622). DOI [10.1111/itor.13622](https://doi.org/10.1111/itor.13622) | Models demurrage/detention decisions and individual free-time policies under uncertainty. Includes early/late retrieval and return scenarios. | publisher abstract, references and data-availability statement. Online publication 2025-01-31; final issue September 2026, 33(5):3548–3579. Data available on request, not openly downloaded. No new-uncertainty-model claim for PortPlan. |
| R3 · Yujian Song, Yuting Zhang, Wanli Wang, Ming Xue (2023). [A Branch and Price Algorithm for the Drop-and-Pickup Container Drayage Problem with Empty Container Constraints](https://www.mdpi.com/2071-1050/15/7/5638). DOI [10.3390/su15075638](https://doi.org/10.3390/su15075638) | Drop a container at a customer, leave while packing/unpacking occurs, then collect it. Limited empty containers; MILP minimizing travel costs; branch-and-price algorithm. | publisher-deposited abstract and metadata. Direct algorithmic precedent. Publisher HTML returned HTTP 429; features verified from the publisher-deposited Crossref abstract, not a full equation audit. Reported savings cannot be compared to PortPlan percentages. |
| R4 · Xuhui Yu, Yin Feng, Cong He, Chang Liu (2024). [Modeling and Optimization of Container Drayage Problem with Empty Container Constraints across Multiple Inland Depots](https://www.mdpi.com/2071-1050/16/12/5090). DOI [10.3390/su16125090](https://doi.org/10.3390/su16125090) | Combines trucking operation modes, empty relocation strategies, empty constraints and multiple inland depots. MILP plus improved genetic algorithm; evaluates randomly generated instances. | publisher-deposited abstract and metadata. Direct evidence that integrating operating constraints is established. Publisher HTML returned HTTP 429; no inference of missing features from abstract. |
| R5 · M. Bruglieri, S. Mancini, R. Peruzzini, O. Pisacane (2021). [The Multi-period Multi-trip Container Drayage Problem with Release and Due Dates](https://www.sciencedirect.com/science/article/pii/S0305054820302197). DOI [10.1016/j.cor.2020.105102](https://doi.org/10.1016/j.cor.2020.105102) | Divides horizon into days and permits multiple trips per truck per day. Container customers have release and due dates. | publisher-indexed abstract and Crossref metadata. A daily multi-period scheduling formulation is not novel by itself. Open institutional manuscript located but fetch returned HTTP 403; not a full-model comparison. |
| R6 · Stefano Fazi, Sourabh Kumar Choudhary, Jing-Xin Dong (2023). [The multi-trip container drayage problem with synchronization for efficient empty containers re-usage](https://www.sciencedirect.com/science/article/pii/S0377221723001947). DOI [10.1016/j.ejor.2023.02.041](https://doi.org/10.1016/j.ejor.2023.02.041) | Time-window multi-trip drayage with limited inland empty stock, street-turning and extra-depot retrieval. Synchronizes trips and empty inventory; column-and-row generation within branch-and-price. | publisher-indexed abstract/highlights and institution metadata. A stronger routing/synchronization precedent. Institution exposes a CC BY paper, but this pass inspected the abstract/highlights and metadata only. Published real-world case does not supply PortPlan with real PNC demand. |
| R7 · Pengfei Huang, Hao Wang, Fangjiao Tan, Yuyue Jiang, Jinfen Cai (2025). [Optimization of external container delivery and pickup scheduling based on appointment mechanism](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0318606). DOI [10.1371/journal.pone.0318606](https://doi.org/10.1371/journal.pone.0318606) | Joint external delivery/pickup scheduling with soft time windows and appointment feedback. Fleet operating-cost model; adaptive ant colony algorithm with particle-swarm parameter tuning. Open paper links supporting code and data ZIP files. | open full text, methods/assumptions/supporting links. Full article methods/assumptions and support links inspected; supporting ZIP contents not validated or used. Published cost reductions are not a comparable benchmark without aligning instances, objective and constraints. |
| R8 · Kap Hwan Kim, Ki Young Kim (2007). [Optimal price schedules for storage of inbound containers](https://www.sciencedirect.com/science/article/pii/S0191261507000185). DOI [10.1016/j.trb.2007.02.001](https://doi.org/10.1016/j.trb.2007.02.001) | Optimizes the storage price schedule for inbound containers. Schedule includes a free-time limit and storage price per unit time. | publisher-indexed abstract and Crossref metadata. Storage pricing and free-time optimization are longstanding. This is a terminal pricing perspective; the abstract does not establish whether it contains PNC-style retroactive bands. |
| R9 · Katrien Storms, Christa Sys, Thierry Vanelslander, Ruben Van Deuren (2023). [Demurrage and detention: from operational challenges towards solutions](https://link.springer.com/article/10.1186/s41072-023-00132-1). DOI [10.1186/s41072-023-00132-1](https://doi.org/10.1186/s41072-023-00132-1) | Reviews D&D terminology and operational challenges using literature, industry discussion and validation. Identifies digitalization, additional hinterland free time and negotiation attention as feasible solutions. | open full text, introduction/research approach/definitions/conclusions. Industry evidence concerns a maritime supply-chain setting with substantial European/Antwerp input. It does not validate Korean carrier contracts, tariff formulas or PortPlan savings. |

The closest conceptual overlaps are R1/R2 (unpacking, retrieval/return and D&D), R3/R5/R6 (operational scheduling), and R8 (storage pricing). R7 is a useful open implementation/data lead. Its linked artifacts have not been independently reproduced. R9 supports the business problem, not the numerical correctness of Korean tariffs.

## What products already do

| Product | Verified public capability | Comparison limit |
|---|---|---|
| [Portcast Maersk D&D Calculator / Command Center / Freight Audit](https://www.portcast.io/dd-tool/maersk-demurrage-and-detention) | Estimates D&D from selected delay days, free days and port/container daily rates. Advertises configurable risk thresholds, alerts and contract/invoice checking. | Vendor claims, not an independent performance audit. Page does not establish supported Korean contract coverage or optimizer architecture. Do not claim competing products lack joint optimization merely because it is not described here. |
| [Maersk MyFinance D&D tool](https://www.maersk.com/news/articles/2023/11/15/simplify-demurrage-and-detention) | B/L lookup shows container-level free days, last free day and D&D details. Provides payment and purchase of additional free time through the authenticated portal. | Page displays 17 January 2024 despite 2023 URL path. Demonstrates existing fee visibility; generic explanatory examples are not proof of Korean combined-D&D slab arithmetic. |
| [PortPro appointment automation and dual transaction matching](https://portpro.io/all-resources/blog/article/automate-dual-transaction) | Automates empty-return appointment booking after ready-to-return, completed live unload or empty status. Allows maximum pickup/drop-off appointment capacity by day/time. Matches full pickup and empty return, checks terminal/shift acceptance and container size, and requests dual appointments. | Direct commercial precedent for action-oriented joint movement workflows. Supported terminals and Korean availability were not established. No cost-optimality or relative performance claim follows from this walkthrough. |

These are positive feature observations. “Not described on this page” must not become “the product cannot do it.” Vendor savings claims and research percentages are not valid denominators for a PortPlan leaderboard.

## Defensible contribution to test

A useful contest question is: **When truck and unloading capacity are scarce, how much does preserving the exact terminal fee jump and the full empty-return lifecycle change the preferred schedule?** The contribution can be a carefully evidenced local application and experiment, with a usable explanation of each decision. Merely wrapping a solver or LLM in a dashboard does not establish an algorithmic contribution.

The proposed PNC contribution is conditional: encode the official 2026 retroactive storage schedule, make the public-page rate conflict visible, and quantify the consequence of omitting the jump. It is not yet established that this combination is unprecedented. The Maersk cross-slab accumulation rule remains a disclosed model interpretation (see `docs/rules-status-v2.md`).

Recommended evaluation requirements:

- Evaluate all policies on identical orders, feasibility constraints, horizon and terminal/return accounting.
- Ablate retroactive versus flat/progressive storage treatment using the same scenario and report cost, not only rank.
- Compare joint planning with pickup-only scheduling while completing every empty return.
- Stress clearance delays, unloading capacity and return slots; separate infeasibility from cost increases.
- Sensitivity for 2025/2026 PNC public-rate conflict and unconfirmed Maersk cross-slab arithmetic.
- Keep held-out seeds/instances and an independently implemented cost/feasibility checker.
- Real operational validation requires shipment-level discharge, release, sizes, contract free time, unloading and return records; public gate visits alone cannot supply those fields.

Claims to remove from slides and submission:

- First joint pickup-and-empty-return optimizer.
- First method linking unpacking and detention.
- First use of MILP, AI or uncertainty for container drayage.
- Competitors only display fees and never automate decisions.
- First Korea-wide or PNC-deployed product.
- Proven enterprise savings, live PNC orders, or guaranteed competition victory.

## Evidence capture

Crossref responses preserve publisher-deposited bibliographic metadata; the JSON file records which abstracts were actually accessible. `data/public/v2-research-source-manifest.json` records local SHA-256 values and retrieval method. Official website observations are summarized in `v2-web-observations.json`; those summaries are researcher transcriptions, not raw HTML. No paywall bypass, private product access, account creation, or outreach was used.

### R7 attachment follow-up

The supplementary ZIPs were subsequently downloaded and inspected. They contain a constructed one-day instance and saved algorithm/figure results, with capacity and service-time discrepancies between article and code. They are not real shipment orders. See [`external-benchmark-audit-v2.md`](external-benchmark-audit-v2.md) for the parsed fields, original hashes and conditions for a fair reproduction; this follow-up supersedes the initial attachment-inspection status in the table above.
