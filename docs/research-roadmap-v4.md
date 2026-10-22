# PortPlan V4：公开证据下的研究与开发路线

调研日期：2026-10-12 UTC。本文是方法选择及实施建议，不是新实验结果或官方评分预测。已阅读当前 README、`prior-art-v2.md`、`reviewer-v2.md`、`public-only-evidence-v3.md`、`robustness-v2.md`，以及 `engine.js`、`solver-glpk.js`、`strong-baseline.js`。浏览检索覆盖提还箱与 D&D、滚动冻结、邻域搜索、整数解解释及原生 HiGHS；不联系作者，不以企业资料作为前置条件。

## 方法选择

**优先开发两件事：①带已执行动作冻结的因果滚动排程；②费用跳档驱动的动作解释与反事实复算。** 直接事件日期搜索、同预算比较和原生 HiGHS 对照是这两件事的验证基础，而不是另包装一项算法首创。

当前强项是官方费用函数、独立复算、完整失败记录。最主要的短板不是页面数量，而是静态排程没有落实执行状态，强基准只改排列且预算不匹配，100 箱有无整数可行解的失败，尚不能把每个推荐动作的费用意义讲清楚。V4 应把这些缺口变成一个可否证问题：

> 在积压与集中放行情景中，当收费跳涨与资源冲突发生，同时未来扰动尚不可知，保留完整提卸还生命周期和执行冻结，能否在有限计算预算内提高完整执行率；推荐“今天提哪箱”的代价能否由模型复算验证？

这比“又加一个 MILP / AI 调度器”更有明确评审对象。联合提还箱、D&D、不确定性、滚动调度、反事实解释均有先例；PortPlan 可争取的贡献是具体公开费率与日级作业状态的正确结合、可检查的动作理由和公平实验。组合新颖性仍未建立，不能保证名次。

## 本轮实际读到的来源

下表区分全文、摘要与源代码阅读；查到摘要不等于比较过完整数学模型。原文收费适用性、现实订单及本文未实际运行的方法，不因加入引用而升级为验证。

| 来源 | 本轮读取深度与确认内容 | 对 PortPlan 的约束 / 用途 |
|---|---|---|
| Jeong, Saha, Moon (2020), [Optimal devanning time and detention charges for container supply chains](https://snu.elsevierpure.com/en/publications/optimal-devanning-time-and-detention-charges-for-container-supply/), DOI 10.1016/j.tre.2020.102055 | 作者机构摘要及出版社检索摘要：拆箱时间、还空迟到与 detention、集中/分散决策已有直接研究。未读到全文。 | 不能把拆箱＋还空＋费用联动声称首次提出。 |
| Jeong, Kim, Shin (2026), [Uncertain demurrage and detention decisions in hinterland container management](https://onlinelibrary.wiley.com/doi/10.1111/itor.13622) | 出版社摘要、参考文献、数据声明。在线首次 2025-01-31，卷期 33(5), 3548–3579，2026-09；分析提箱/还箱早晚与不确定性，数据须向作者请求。 | 不能声称首次研究 D&D 不确定性；此公开页面不提供可直接复现的完整订单数据。 |
| Fazi, Roodbergen (2018), [Effects of demurrage and detention regimes on dry-port-based inland container transport](https://research.rug.nl/en/publications/effects-of-demurrage-and-detention-regimes-on-dry-port-based-inla/), DOI 10.1016/j.trc.2018.01.012 | 作者机构摘要与书目：费用制度影响运输合并与港口停留。机构挂出的全文 PDF 本轮返回 403，未审数学式。 | 费用制度改变运输决策是既有研究；不能把其节省率移作 PortPlan 基准。 |
| Bjelić, Vidović, Popović, Ratković (2022), [Rolling-horizon approach in solving dynamic multisize multi-trailer container drayage problem](https://www.sciencedirect.com/science/article/pii/S0957417422005589), DOI 10.1016/j.eswa.2022.117170 | 出版社检索结果中的摘要及 highlights；直接打开返回 403。MILP＋VNS、滚动参数，以及装卸开始前撤回已指派任务已有先例。 | 滚动及任务冻结不是首创；本项目没有实时车辆位置、道路路线和多挂车语义。 |
| Xiao et al. (2014), [Berth Allocation Problem with Quay Crane Assignment for Container Terminals Based on Rolling-Horizon Strategy](https://onlinelibrary.wiley.com/doi/10.1155/2014/845752) | 开放全文第 4–5 节与实验部分。已开工/已完成任务划分；冻结任务占用通过参数带入下一窗口。网页可读文字说明，部分公式未被网页解析器完整显示。 | 为“历史动作不改、进行中资源继续占用”提供明确先例；其泊位/岸桥问题不是本项目费用模型，也不是在线费用比较对象。 |
| Jia, Cui, Chen, Meng (2022), [Dynamic container drayage with uncertain request arrival times and service time windows](https://researchportal.hkust.edu.hk/en/publications/dynamic-container-drayage-with-uncertain-request-arrival-times-an/), DOI 10.1016/j.trb.2022.10.010 | 作者机构完整摘要及书目：MDP、强化学习处理到达请求、整数规划周期分配资源。未读到全文或运行代码。 | 动态信息处理已有更强研究；缺训练数据时不优先做 RL，不能把真实案例存在当作我们的真实数据。 |
| Jung, Jeong (2025), [Bilevel Optimization of Merged Demurrage and Detention Policies under Uncertainty](https://www.ksie.ne.kr/journal/article.php?code=94994), DOI 10.11627/jksie.2025.48.2.001 | 出版社及韩国 KCI 检索索引的题名、摘要片段与书目；出版社原页面和 DOI 打开分别返回 502，KCI 打开超时。 | 新增直接先例线索：merged D&D / 不确定政策不能声称空白。未阅读全文，不能判断是否已有 PNC 追溯收费或相同冻结机制。 |
| Ropke, Pisinger (2006), [An Adaptive Large Neighborhood Search Heuristic for the Pickup and Delivery Problem with Time Windows](https://orbit.dtu.dk/en/publications/an-adaptive-large-neighborhood-search-heuristic-for-the-pickup-an/), DOI 10.1287/trsc.1050.0135 | 作者机构摘要与书目；提交稿链接本轮无法读取。竞争 destroy/repair 子启发式的 ALNS 已有成熟先例。 | 不把删除重插/邻域选择作为自创范式；时间窗车辆路径问题不能自动等同于 PortPlan。 |
| Wouda, Lan (2023), [ALNS: a Python implementation of the adaptive large neighbourhood search metaheuristic](https://joss.theoj.org/papers/10.21105/joss.05028)；[作者开源库](https://github.com/N-Wouda/ALNS) | JOSS 页面、`ALNS.py` 的 destroy/repair/accept/stop 主循环、`stop/MaxRuntime.py`，以及[官方 RCPSP 示例](https://alns.readthedocs.io/en/stable/examples/resource_constrained_project_scheduling_problem.html)的资源计数、删除、修复与双向压紧实现。未运行示例。 | 为可实施强基准提供可读实现。库的运行时停止器从第一次调用起计时，不能照搬后声称包含初始化的端到端同预算；RCPSP 示例的 makespan 与 PortPlan 费用目标不同。 |
| Engelhardt, Kurtz, Birbil, Ralphs, [Counterfactual Explanations for Integer Optimization Problems](https://optimization-online.org/2025/10/counterfactual-explanations-for-integer-optimization-problems/) | 阅读作者预印本 2026-01-05 版本前 4 页：weak / strong CE 寻找模型输入修改，使理想解成为某个/全部最优解。非已确认期刊发表结果。 | 我们固定一个动作再复算的代价属于较窄情景敏感性，不是论文中一般最小输入修改 CE 求解器。 |
| Gurobi 官方 [MIP sensitivity 示例](https://docs.gurobi.com/projects/examples/en/current/examples/sensitivity.html)与[整数模型 dual 说明](https://support.gurobi.com/hc/en-us/articles/360034305272-How-do-I-retrieve-the-dual-Pi-values-for-a-MIP-problem) | 阅读翻转 binary 后复算目标的源代码和状态要求；官方说明不能直接把整数模型或固定整数后的连续模型 dual 解释成一般 MIP 代价。 | 动作重算敏感性是既有技术。可借鉴语义，无须引入收费商业求解器；不把 LP 影子价格展示成真实整数容量价值。 |
| [SciPy `milp` 官方文档](https://docs.scipy.org/doc/scipy/reference/generated/scipy.optimize.milp.html)；[HiGHS](https://highs.dev/)与[原生选项](https://ergo-code.github.io/HiGHS/dev/options/definitions/) | 已读整数 bounds、稀疏约束、time limit、gap、状态、`mip_dual_bound` 和 `mip_gap`；原生 HiGHS 有 threads/random_seed 等选项。 | 可在 cloud 增加独立求解器对照和界。SciPy 默认变量并非 binary，必须显式 `integrality=1` 和 `Bounds(0,1)`。同一目标与约束的更换求解器属于工程/交叉验证贡献。 |

以上是聚焦调研，不是穷尽综述。新增全文可读先例主要是滚动冻结论文、整数反事实预印本和开源实现；受限全文仍须保持“未审模型”标签。

## 优先一：因果滚动排程，冻结真实执行状态

### 最小可交付语义

保留 V2 原始规划起点及绝对日索引，首先只研究固定 14 日内的日初重排。`releaseDay` 表示可提箱时间，另设 `announcedDay` 表示订单何时进入决策信息集；不能仅因最终完整文件中出现一箱，就让所有方法提前知道它。每个扰动另有 `announcedDay` 与 `effectiveDay`。

每天 `today=d` 的顺序固定：①收取截至 d 已宣布的订单/扰动及前一天执行回执；②建立仅含当时可知信息的 snapshot；③冻结历史及进行中动作；④在预算内排剩余任务；⑤独立审核后只执行今天动作；⑥写入不可倒改执行日志。若模拟器预先生成完整路径，策略接口不获得未宣布部分。浏览器逐日播放展示已知/未知和哪些动作固定，不能让滑到未来后重算历史。

| 执行状态 | 下一轮必须保留 | 允许优化 |
|---|---|---|
| 未提箱 | 所有未执行事件禁止安排到 d 之前 | d 及之后的 p/u/r，满足已知放行、期限和 horizon |
| 已提、未开始卸货 | 实际 p 与已结束运输作业 | 尚未开始的 u、尚未执行的 r；在场占用从固定 p 持续到 r |
| 卸货进行中 | 实际 p/u、不可中断卸货及已知剩余时长 | 未来 r；卸货剩余资源占用不能消失，也不能重启一遍来抹去历史 |
| 卸货完成、未还空 | 实际 p/u 和卸货完成回执 | 未来 r；仍计在场箱位 |
| 已还空 | 完整 p/u/r 和已产生费用 | 无；可从剩余模型移除但保留终态费用与完整性记录 |

最小 MILP 改造可直接在现有 x/y/z 事件模型添加固定边界：已发生事件只留真实日的变量；未发生事件只留 d 及以后。若继续把所有箱保留在原 horizon，过去 capacity 用执行时观测值，未来 capacity 用 snapshot 当时已知值。若模型移除已完成箱，则须把进行中箱的未来固定资源占用扣除，不能同时扣除又保留其变量重复计数。

**时长扰动的关键限制：** 在尚未揭晓延误时，可用名义剩余天数；一旦回执显示继续占仓，该事实进入下一 snapshot。在日初宣布“总卸货时长加一天”的测试可以实现，但必须标为公告信息设置，不能借它宣称已解决未知工期。已发生回执与未来预测分开存；缩短释放日、从过去挪走占用、提前知道哪些箱延误均应被 checker 拒绝。

### 初版比较与失败语义

固定信息规则后比较原计划照执行、因果每日重排、V2 保守缓冲后每日重排；FIFO/截止期/直接日期邻域也取得同样 snapshot。事前知道全部扰动的解保留为参考下限，明确为 clairvoyant；它不能计入在线完成率。

主指标为完整执行并满足硬约束的场景数、期限/资源违约、最终生命周期总两费、重排次数、未执行动作变更数、求解延时。只有双方完整执行且同一输入的场景可作终态费用配对；失败保留 null 费用与发生日、已执行日志，部分箱费用不作“低成本完成”。不以大罚项加部分订单后冒充原问题可行。尚未收到订单但期限已过的情况由协议定义并保留。

还应有“前缀不可区别”检查：两条路径在日 d 前的公告、观测和随机种子相同，仅未来扰动不同，则 d 前动作及 snapshots 必须相同。单纯宣称代码没有访问 future 字段不够；该检查可直接推翻信息泄漏。

滚动窗口暂不截短到 3–5 日，避免未还箱被窗口边界删掉而低估 D&D。第一版沿用完整有限终点；未来扩展时需要显式 carry-over 状态与尾部价值，不用每轮强行全清空创造假瓶颈。

## 优先二：把费用跳涨转为可检查动作理由

### 第一层：逐箱费用暴露

给每箱展示当前计费日数、所在档位、下一个追溯跳档日，以及“将提箱/返空延迟一天，该箱费用如何改变”。保持另一事件不变的差必须按真正费用函数计算，并说明该比较未必满足卸货/容量约束。

令 PNC 20′收费函数为 F(s)，含免费期的存储计日为 s，收费天数 q=max(0,s−4)。最高档追溯意味着 s 从 7→8 日（q 从 3→4 天）时，F 从 27,300 跳到 72,800，**晚一天差 45,500 KRW**；s 从 9→10 日差 100,100，14→15 日差 182,000。40′按公开规则倍增。以上为我们从规则推导的机制算例，非新增官方账单。免费期扩展仍属于项目披露的档位平移假设。

这些跳涨可以驱动先提箱候选排序和跳档邻域，但单箱局部暴露不等于全局最佳优先级。为该箱让路可能推迟另一箱还空、占用卸货能力或箱位；界面不把局部差直接称“节省”或“容量影子价格”。

### 第二层：错过今天的动作情景复算

在同一冻结状态及 snapshot 下，令 F0 为原可行域，F1 为新增约束 `pickup_i >= today+1` 的可行域。除这一约束外，订单、资源、规则、已执行动作及未来已知信息均相同。分别求总 joint 费用最优值 C0*、C1*。F1⊆F0，因此若都证最优：

\[
\Delta_i=C_1^*-C_0^*\ge0.
\]

这就是日级模型内“不允许今天提这箱”的最小额外费用，含其他箱重新安排的代价，属于动作情景敏感性。若 Δ=0，今天提它并非所有最优方案必需；一个排程被选中不能证明它唯一正确。若 F1 证无解，可报告“在当前已知硬约束与终点内不能延期”；若仅超时，无解证明不存在。

有有效下界 LB0/LB1 和完整可行上界 UB0/UB1 时，可给出：

\[
\max(0,LB_1-UB_0)\le\Delta_i\le UB_1-LB_0.
\]

上下界必须对应相同费用常数口径及完整可行域；数值容差、缺界或缺可行解显式保留。不能用两个未证最优候选之差冒充上述精确代价。如果没有有效界，界面只显示“候选排程差，未证明最小代价”。这些是模型假设下的离散情景结果，不是从公开观测识别出的真实业务因果效应。

最小产品先对当前推荐的今天提箱动作中的前 1–3 箱、由用户点击或有限后台预算复算；不自动做 100 箱×每天的全量解释。原生 HiGHS 离线计算证书与 browser GLPK 计算结果分别记录。首版仅保证解释正确，是否改善调度要由费用导向邻域消融另证。

## 同预算强基准和独立 HiGHS 是必做支撑

### 直接日期搜索

V2 strongSearch 的排列重定位/交换，每次均按最早可行完整时段解码。它不会直接探索一个已分配箱的其他 `(p,u,r)` 日期组合。V4 至少加入：从已有完整解移除一箱，枚举其他合法 p/u/r 后按费用重插；再加入两箱或小子集删除重插，以释放相互占用。固定的历史事件不得移除；已开工箱仅操作可改事件。

用缓存费用向量和增量资源计数，避免为每个候选重算所有箱；每个邻域内定期检查剩余预算。先保留完整可行 incumbent，再尝试费用改进。有限单箱下降不能声称全局最优；若引入随机破坏、repair、温度/权重，自行实现应称文献启发的 LNS/ALNS 变体，不冒充复现整篇路由算法。基准也必须获得强初解；候选组合策略的所有预处理、启发式与求解器花费共同计时。

### 公平预算与状态

预固定冷启动一次、热启动主要比较；热比较从接收同一输入起覆盖初解、模型/候选构建、求解和后处理。统一 0.5/2/10 秒预算档可作为实施起点，真正冻结协议以实现预算为准。GLPK 内部时限不是端到端墙钟上限，Python 稀疏矩阵构建也计入；候选检查边界造成的超额单列。一次只跑一个方法；原生 HiGHS 固定一线程作算法预算比较，四线程作为另列 cloud 吞吐实验，不能把四核与 browser 单线程差异讲成算法创新。

输出完整可行比例、已证最优、已证无解、时限内无可行解，配对成本正/零/负差、墙钟中位及 p95。native/browser 的环境差异明确分开。不能挑单个最快或最省结果替代同一固定策略；产品组合必须报告组合总预算。

### 两种独立性的界限

原生 HiGHS 直接从统一导出的 MILP 稀疏矩阵读取，可核对 GLPK 状态、费用、下界和 gap；同一建模器意味着它不能独立证明建模正确。因此小规模穷举 oracle 与不调用主实现费用/约束函数的 checker 保留，滚动 checker 另核事件前缀、不可逆状态与公告时间。

SciPy `milp` 需要显式 binary bounds，time_limit 与 mip_rel_gap 都固定。若要线程、种子和 warm start，优先走 `highspy` 原生接口并核对所安装版本支持，不把未列入 SciPy 官方 API 的选项当作可移植承诺。保留原始 status、message、fun、mip_dual_bound、mip_gap，非有限值序列化为 null。将求解器 bound 与独立复算 incumbent 对齐后再报 gap；零目标分母时优先绝对间隙。

## 按证据推进的开发顺序

| 顺序 | 具体交付与进入下一步条件 |
|---|---|
| 1 | snapshot / execution log 数据结构，MILP 固定历史、未发生禁入过去，进行中占用；小型手工与穷举场景通过，前缀不可区别检查通过。 |
| 2 | 因果日初模拟器＋静态/每日重排/保守重排比较；完整保存每天已知信息、资源、动作、失败与最终账；UI 能逐日播放一例成功和一例恢复失败。 |
| 3 | 直接日期单箱与小邻域强基准、统一计时 harness，native HiGHS 对照；确认两种求解器与 independent checker 对费用/完整性一致。 |
| 4 | 单箱跳档解释和有限动作情景复算；为 Δ>0、Δ=0、延期证无解、反事实超时各保留可审计例子。 |
| 5 | 冻结尚未用于选方法的种子及信息协议后跑主实验；V2 16/50/100 箱及机制维度保留，新增未公告放行延期、卸货延长、运输下降，并保留无费用/不可恢复组。正面、持平与负面结果进入同一汇总。 |

预算有限时，先让执行语义、独立审核和一个可读反事实正确运行，再扩张规模。现有 4 核/16 GB 和 browser worker 足以支持上述有界研究开发；具体 100 箱可用性须实测，不能从内存规格推断可靠求解。公开闸口观测的 MAE 留出验证继续作为独立模块，它不识别进口箱 lifecycle，更不决定合成扰动的真实发生概率。

## 提交可使用的贡献措辞

完成上述检查后，可以说：“以公开韩国收费规则为依据，研究追溯式费用跳档下的日级提卸还规划；提供仅利用当时公告信息、固定已执行动作的滚动模拟和独立约束/费用审核；用动作情景复算说明推荐的可延期性与费用代价，并在同预算、同信息的生成场景上比较。”

费用改善、完成率和证书覆盖率只填写实际最终结果。不能说企业实测节省、首次联合优化、文献最先进、一般因果效应、真实恢复保证、预测夺冠或已有主办认可。技术贡献大小要由同预算基准、消融及反例决定，不由目标名次反推。
