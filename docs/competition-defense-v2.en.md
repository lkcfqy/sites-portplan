# PortPlan V2 — English defence and demonstration kit

Prepared: 12 October 2026. This is a preparation document, not a record of submission, organizer approval, field validation, or competition ranking. The three-minute format is a rehearsal choice; the official speaking time and permission to present in English have not been confirmed. Public eligibility includes enrolled graduate students; it does not settle the minimum team size or AI policy. No personal identifiers are needed in this document.

**Working title:** Import Container Pickup, Devanning, and Empty-Return Scheduling under Public Retroactive Storage Tariffs.

**Core message:** PortPlan turns a specific, source-checked tariff mechanism into an auditable scheduling model, then tests when joint scheduling helps and when stronger baselines remove its apparent advantage. It is an application and reproducibility contribution, not a claim to have invented mixed-integer optimization or joint container scheduling.

## 1. Ten difficult questions and defensible answers

### 1. Your orders are synthetic. What have you actually proved about real business value?

**Answer:** We have tested behavior under specified public tariffs and synthetic operational conditions. The tariff sources are real; the experimental orders, release dates, deadlines, and capacities are generated. Public vehicle visits from Gwangyang and a small Incheon gate snapshot lack the fields needed for a PNC shipment replay, so they were not used to validate savings. We therefore do not claim realized company savings or a deployment return on investment. The current result is a reproducible account of where this model helps, ties, or fails. Real business value requires shipment-level data and confirmation of the applicable contract and operating constraints.

**中文要点：** 真实规则、合成订单、外港观测三者分清。不可把外部真实记录数量与模拟节省拼成实证故事。

### 2. Joint pickup, devanning, returns, and D&D already appear in the literature. What is original here?

**Answer:** We do not claim that joint scheduling is new. Prior work addresses devanning and detention, pickup and return decisions, and uncertain D&D. Our candidate contribution is a transparent implementation of PNC's particular retroactive storage rule, its interaction with a separate carrier charge, and a reproducible test suite with stronger baselines and explicit failure cases. An ablation must show whether the rule or joint objective changes decisions. If it does not, we can claim faithful implementation, not a demonstrated performance contribution. The literature comparison identifies verified differences rather than inferring novelty from features not mentioned in a product page.

**中文要点：** 已有直接先例；局部规则组合与透明验证可以是应用贡献，不能升级成首次算法。消融无差异时撤回机制性能主张。

### 3. Did you make FIFO deliberately weak so the optimizer would win?

**Answer:** The V1 baselines shared an irreversible greedy construction and were not sufficient evidence against strong scheduling methods. V2 includes deadline ordering and a multi-start permutation relocation and swap search, decoded into earliest feasible slots. This is stronger than the original rules, but is not a state-of-the-art benchmark. We compare against the cheapest complete feasible baseline in each case and separately against the strong search. All methods receive the same orders and constraints. The strong search has a fixed iteration budget while the MILP has a solver time limit; these are disclosed and are not claimed to be equal CPU budgets. If strong search ties the optimizer, the correct conclusion is that the additional optimization benefit is small in those cases.

**中文要点：** 答辩要说具体基线，不数名称。固定迭代与固定秒数不等CPU；强基线持平也保留。

### 4. Does “combined D&D” already include terminal storage? Are you double counting?

**Answer:** We did not infer the answer from the name. Maersk's PNC notice dated 26 December 2022 states that, from January 2023, terminal storage invoiced directly to importers is outside Maersk's own D&D rules. That supports studying both charges together for the stated service arrangement. It does not prove that every customer's shipment uses these standard terms. Contract free time, included services, and negotiated prices still need checking. We keep that distinction between a documented public benchmark and shipment-specific billing applicability.

**中文要点：** 展示通知原文“outside of our own D&D rules”；证明研究组合有依据，不证明所有合同都适用。

### 5. PNC's web page shows different prices, and your Maersk tier interpretation is unconfirmed. How can the numbers be trusted?

**Answer:** We fix the dated 2026 PNC PDF as the public reference and disclose the discrepancy with the older prices on the inquiry page. The Maersk daily-slab accumulation is explicitly an implementation assumption; an example within one charging slab does not settle behavior across slabs. Calculation correctness and contract applicability are separate questions. Boundary tests and independent recalculation address the first. Contract confirmation is still missing. Sensitivity tests quantify exposure to the assumption, but do not turn an alternative stress-test rule into an official tariff or constitute business confirmation.

**中文要点：** 代码测试不能证明合同解释；40HC免费10天后3天=90,000只在同一档，不能验证跨档累进。

### 6. Does subtracting prior costs inflate your saving percentage?

**Answer:** It changes the denominator, which is why we report both. Total cost is the modeled charge from discharge through pickup and empty return. Incremental cost subtracts the same tariff-based reference amount, calculated as of the day before planning, from every policy. That reference is not evidence of payment or an accounting sunk cost. Subtracting a common constant preserves the optimal schedule but changes the percentage. In V2, the same 36 paired cases produced a 15.74% incremental reduction and an 8.86% total-cost reduction, both representing 20,073,600 won. These are synthetic experiment results, not realized business savings.

**中文要点：** 同一配对集合、绝对韩元、双分母一起报。字段`sunkCost`不是已付款事实。

### 7. Your daily capacity model is not a real dispatch plan. Can these schedules actually be executed?

**Answer:** Feasibility is conditional on the stated daily model. A transport allowance counts pickup and return events, not trucks or driver shifts. Travel times, appointment slots, detailed gate timing, and return-depot acceptance are not fully modeled. Assumptions about same-day return, staging release, container-size capacity, and clearing all orders by the horizon can affect cost and feasibility. We tested next-day versus same-day return and container versus TEU staging. A further conservative plan reserves one extra unloading day for every box and two transport movements every day. It is feasible within that stated disturbance envelope, but cost 32.29% more in total modeled charges across six synthetic cases. The output still requires operational review.

**中文要点：** 不把抽象可行称现场可执行。V2实际测试哪些假设就说哪些；不能预告式声称已验证。

### 8. All your methods know the future. Why would the result survive unexpected arrivals or disruption?

**Answer:** A static full-information experiment does not establish online performance. It can fairly compare static methods if their information is identical. In a rolling or disruption experiment, each method must see only information available at that decision time. A clairvoyant solution can be shown separately as a reference bound, not as a policy a dispatcher could achieve. Randomly generating inputs is also not the same as solving a stochastic optimization problem. The original plans became infeasible in 16 of 18 fixed disruption checks. The conservative buffer survived those checks and has a monotonic feasibility argument for its stated envelope. It was designed after observing the failures, so we report it as an exploratory tradeoff, not independent confirmation or an online recovery policy.

**中文要点：** 随机生成不等随机优化；有未来实际信息的结果只作参考下界。

### 9. Does “optimal” guarantee correctness? What happens to timeouts, missing containers, and failed cases?

**Answer:** “Optimal” is the solver's status for the specified model and inputs. It is not an industry-wide optimum or third-party certification. We recalculate costs, event order, deadlines, and resource use with separate code, and compare small instances with exhaustive enumeration. A result missing an order is not a complete feasible schedule. Failed results have no comparable cost, and we do not treat them as zero or use their partial cost in a saving percentage. Greedy failure, failure to find an incumbent before a time limit, and proven model infeasibility are reported separately. One concrete counterexample is scale-new-arrivals-tight-n100: strong search found a complete zero-cost plan, while the raw MILP returned no incumbent within two seconds. A recommended fallback must preserve that solver status rather than rewrite it as a solver success.

**中文要点：** 内部独立实现不是外部认证；失败成本null；具体case ID、原因和状态必须准备好。

### 10. What did the entrant contribute if AI and an open-source solver produced the work? Is an English solo presentation allowed?

**Answer:** The contribution record must distinguish existing software, AI assistance, and work the entrant actually performed and checked. It should record decisions, implementation changes, source checks, experiments, and verification evidence—not claim tasks the entrant has not done. GLPK/glpk.js is credited as the solver, and AI support in drafting, coding, testing, or translation is disclosed. Public registration includes graduate students and limits teams to four, but does not by itself settle a one-person minimum, AI policy, or presentation language. We can prepare an English defence now while awaiting organizer confirmation. The entrant must be able to explain the model, code, assumptions, and counterexamples directly.

**中文要点：** 贡献模板由本人按实际填写；英文稿已准备≠已获准英语答辩；不写任何无关个人信息。

## 2. Three-minute demonstration script

Rehearse this as a concise evidence demonstration. Use a case selected and identified in advance; do not present the highest-saving case as representative. Show only features actually present in the reviewed build. If displaying stored results, say so. If a live solve times out, show the real status.

**0:00–0:25 — The tariff mechanism.**

> A one-day delay can cost more than one extra daily charge. Under PNC's 2026 public tariff, a twenty-foot import container stored for fourteen days costs 318,500 won. At fifteen days, it costs 500,500 won, because the higher rate applies to all chargeable days. This is a verified tariff example, not a saving produced by our optimizer.

**0:25–0:50 — Inputs and scope.**

> PortPlan connects this rule to pickup, warehouse devanning, and empty return. The orders on screen are synthetic. The public tariffs have traceable sources, but the customer contract and operational data have not been validated. Each method receives the same orders, deadlines, and daily transport, unloading, and staging limits.

**0:50–1:25 — Comparison.**

> V2 compares 48 distinct generated order sets using stronger search and explicit, unequal calculation budgets. In 36 complete feasible pairs, the modeled charge difference was 20,073,600 won: 15.74 percent of incremental charges, or 8.86 percent of total charges. Fourteen new-arrival pairs cost zero under both methods. A tie remains a tie; failed schedules do not become zero-cost results.

**1:25–1:55 — Audit a decision.**

> For this container, we can inspect its pickup date, devanning period, empty-return date, and charge. A cheaper schedule is unacceptable if it violates a deadline or capacity. Separate recalculation checks those requirements. An optimal status means optimal within this model; it does not certify a real dispatch plan or a new optimization algorithm.

**1:55–2:25 — A counterexample.**

> At one hundred containers, strong search found a zero-cost plan while the raw MILP timed out without a plan. Under fixed operational disruptions, sixteen of eighteen original plans became infeasible. An exploratory conservative buffer survived all eighteen checks, but increased total modeled charges by 32.29 percent. Its guarantee covers only the stated daily uncertainty envelope, not general real-world disruption.

**2:25–3:00 — Contribution and next evidence.**

> Earlier research already studies container scheduling and detention. Our contribution is a source-checked local tariff model, auditable schedules, and reproducible comparisons that expose limitations as well as improvements. The current conclusions apply to the tested synthetic conditions. Shipment-level contract and operational validation are still required. The code, source record, and use of open-source and AI assistance are disclosed so the work can be checked.

**中文演示控制：** 源规则→合成标签→强基线比较→单箱/容量审核→反例→贡献与边界。摘要数字等V2复算后写进结果卡。原样展示负/零收益、状态及失败，不用最大改善case替代总体。

## 3. Verified V2 result card

Reviewed sources: `data/benchmark-v2.json`, `data/robustness-v2.json`, and `data/conservative-v2.json`. Independent standard-library Python recalculation is saved in `scripts/review-v2.py`; its file hashes, checked populations, and results are in `data/review-v2.json`. It checked 435 archived complete schedules without cost or constraint discrepancies, plus six conservative cost calculations and 30 conservative constraint checks. Repeated checks are not independent observations.

| Item | Reviewed value and interpretation |
|---|---|
| Main population | 48 distinct generated order sets: 3 mechanisms × 2 capacities × 16/50 containers × 4 repeats; 48 distinct seeds |
| Raw MILP outcomes | 44 complete feasible: 33 proven model-optimal, 11 feasible only; 4 proven model-infeasible |
| Strong search | 36 complete feasible; 12 restarts plus 80 permutation moves, not a certified state-of-the-art implementation |
| Comparable population | 36 complete feasible pairs; 12 without a complete baseline, including 8 with a MILP plan and 4 model-infeasible |
| Incremental charges | 127,526,150 → 107,452,550 KRW; difference 20,073,600 KRW; 15.7408% |
| Total charges, same pairs | 226,637,050 → 206,563,450 KRW; same difference; 8.8572% |
| Positive / tied / negative | 19 / 17 / 0 pairs; 14 ties have zero charges and an undefined percentage denominator |
| Mechanism restriction | All 14 paired new-arrival cases cost zero under both methods; gains are in aged-backlog and batch-release cases |
| Runtime limitation | Main strong-search wall time ≈8.58 s total, MILP ≈25.91 s; medians ≈160/37 ms, MILP p95 ≈2,077 ms. Unequal budgets and tails preclude a blanket speed claim |
| Separate 100-container controls | 4 cases, only 1 cost pair; MILP 2 feasible incumbents / 2 no-incumbent timeouts; no proven optimum |
| Exact-tariff ablation | Using a deliberately progressive PNC proxy produced schedules costing 185,200 KRW more when repriced at the default research tariff, across 6 pairs; this is assumption loss, not realized saving |
| Strict joint-objective evidence | Storage-only: 5 completed lexicographic pairs, 87,550 KRW extra / 1.0937% of total reference cost. D&D-only: 6 pairs, 487,550 KRW / 5.8385%. Each nonzero strict difference is concentrated in one base case |
| Unresolved ablation | A sixth storage-only case lacks a completed tie-break; its 101,800 KRW excess cannot be attributed strictly to omitting the joint objective |
| Original operational plans | 16 of 18 fixed disruption checks invalid; all 18 hindsight re-solves feasible, but those re-solves are not online recovery |
| Exploratory conservative buffer | 6 plans feasible and model-optimal; 0 invalid among 18 specified disruption checks; total charges 14,408,650 → 19,061,200 KRW, +4,652,550 / +32.2900% |

Three counterexamples to rehearse: `new-arrivals-balanced-n16-r1` (all zero costs); `batch-release-balanced-n16-r3` (strong search and MILP both 145,600 KRW); `scale-new-arrivals-tight-n100` (strong search succeeds at zero cost; raw MILP times out without an incumbent). For operational failure, `stress-v2-29001` originally needs six transport movements on day 3 against four after disruption.

**Scope of the conservative guarantee:** retain fixed pickup, devanning-start, and return dates; each actual devanning duration is between nominal and nominal+1 day; each day's transport capacity is at least max(0, nominal−2); all other modeled inputs remain unchanged. Actual occupancy is then contained within the planned worst-case occupancy. This is a deterministic property of the daily model, not an estimated random failure probability. It excludes later releases, larger delays, warehouse/staging losses, and unmodeled route or appointment restrictions. The six-case buffer experiment was designed after the initial stress results and reuses those cases.

## 4. Authorship and AI-assistance disclosure

Use only after the entrant checks the actual contribution record in `submission-outline-v2.md`:

> This project uses open-source components including GLPK/glpk.js and AI-assisted tools for portions of source organization, code and document drafting, test design, and translation. The tools and scope are recorded in the contribution log. The entrant is responsible for verifying sources, model assumptions, implementation, and experimental conclusions. Existing solvers and AI-assisted components are not presented as an algorithm independently invented by the entrant. Competition eligibility, AI-use rules, and presentation-language permission remain subject to organizer confirmation.

This wording does not substitute for actually checking the work. The entrant should be able to calculate the tariff boundary, explain why a common cost constant does not change the optimal schedule, draw a two-container capacity conflict, distinguish failure statuses, reproduce a counterexample, and identify each unverified assumption.

## 5. Source notes for the defence

- Public competition conditions and unknowns: [rules-status-v2.md](rules-status-v2.md), with the [official 2026 page](https://anchor.changwon.ac.kr/main/menu?gc=Program&do=sinform&spod=s1&program_id=VKoDUNlZwONq&psin_id=VKoDUNlMqh4n). English presentation and one-person-team permission remain unconfirmed.
- [PNC 2026 official tariff](https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf), pages 3–4; [Maersk separate PNC storage notice](https://www.maersk.com/~/media_sc9/maersk/local-information/files/asia-pacific/korea/import/busan-port-import-storage-fee-imposition-process-change-information-26dec.pdf), English page 2.
- Prior art and products: [prior-art-v2.md](prior-art-v2.md). Jeong et al. 2020 and 2026 directly overlap with devanning, retrieval/return, and D&D. PortPro's published workflow already automates full-pickup/empty-return matching; do not claim competitors only display fees.
- Full challenge and conditional claims: [reviewer-v2.md](reviewer-v2.md); report outline and contribution log: [submission-outline-v2.md](submission-outline-v2.md).
