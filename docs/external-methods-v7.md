# V7：外部方法依据、许可原件与适配边界

核查日期：2026-10-13 UTC。本文件记录实际阅读和下载的来源，不报告尚未运行的实验结果。原件、固定 commit、HTTP 状态、字节数、SHA-256 和许可在 [manifest.json](../data/public/v7-external-methods/manifest.json)。本轮只新增文献及许可原件，没有修改既有实验或运行优化器。

**建议今天实现两条有明确先例的路线：PortPlan 同模型中的经典 GRASP 适配基线，以及保留原始 RCPSP 定义的独立公开实例验证。** 前者用于检验现有方法是否优于另一种成熟构造与搜索范式；后者用于检验通用 precedence/resource 排程能力。两者不能合并成“外部真实港口节费验证”，也不能据此宣称 SOTA 或复现某篇 drayage 论文。

## 1. PortPlan 可直接比较的方法：经典 GRASP

实际阅读了 Resende 与 Ribeiro 的作者公开报告 [GRASP: Greedy Randomized Adaptive Search Procedures](https://www.resende.info/mauricio/doc/sgrasp2010.pdf)，报告注明 2008 年、2010 年修订；重点核对 §2.2、§2.4、§3 及对应伪代码。另核对 Feo 与 Resende（1995）的[出版社摘要及书目信息](https://link.springer.com/article/10.1007/BF01096763)，DOI `10.1007/BF01096763`；没有取得该 1995 年期刊全文。

经典框架是：重复进行随机贪心构造与局部改善，保留完整可行的最好结果。最小化增量评分 `g(e)` 时，值阈值 RCL 为：

```text
RCL(α) = {e ∈ Cfeasible : g(e) ≤ gmin + α(gmax − gmin)}, 0 ≤ α ≤ 1.
```

每次加入元素后更新合法候选与评分；从 RCL 随机选择。这里 `α=0` 最贪心，`α=1` 允许全部当前合法候选。first-improving 或 best-improving 都有文献依据。若时间预算截断搜索，只能返回已检查可行的 incumbent，不能声称达到局部最优。固定或轮换 α 不等于根据历史表现调整概率的 reactive GRASP。

适配时应明确保留和改变的部分：

| 部分 | 文献框架 | PortPlan 的必要适配 |
|---|---|---|
| 构造元素 | 逐步加入解元素，重算候选 | 一个订单的合法 `pickup/unload/return` 日期三元组；三事件联动是本项目的模型选择。 |
| 贪心评分 | 问题相关增量评分 | 公开费率形成的增量费用、资源压力或 tie-break。复合评分须逐项披露，不能说原论文规定了该费用公式。 |
| 当前可行性 | 检查部分构造合法 | 日期范围、pickup/return 车次、warehouse 卸货容量、staging 区间和执行锁；部分解合法仍可能无法补齐所有订单。 |
| 改善邻域 | 依问题定义局部操作 | 单订单改期、双订单联合移动是本项目邻域；邻域截断、候选上限和接受条件要在协议中固定。 |
| 多启动 | 构造、改善、保留最好完整解 | 只用当前可见 snapshot 和执行锁；不得向构造器传未来 shocks 或使用测试结果调 α。 |
| 时间 | 停止规则可采用时间预算 | 初始化、候选构造、审计与消息传递都计入共同父时钟；保留及时提交的完整可行 checkpoint。 |

可用名称是 **source-adapted classical GRASP / 经典 GRASP 的 PortPlan 适配**。它不是首创框架，也不是作者港口算法的直接代码复现。若只是将旧 event-search 包装成 GRASP 名称，却没有独立的随机 RCL 构造与改善过程，外部基线的解释仍不成立。公共候选域和可行性审计可以共享，但算法步骤、初始化来源与成本必须可查。

### 一个已取得的 MIT GRASP 实现参考

实际下载并阅读 [bruscalia/tsp-grasp](https://github.com/bruscalia/tsp-grasp/tree/f609c5ce753cc9dec6e597056e0da3325167c8ab)，固定 commit `f609c5ce753cc9dec6e597056e0da3325167c8ab`。原 [LICENSE](../data/public/v7-external-methods/tsp-grasp/LICENSE) 是 MIT，版权归 Bruno Scalia C. F. Leite；小型源码及 README 保留原字节。本项目没有运行或直接移植该 TSP 软件。

实际源码有两个值得避免的误读：

- `SemiGreedyArc` 使用 `worst − α(worst − best)`，其 α 语义与上面的经典阈值相反；它还将端点 clip 到内部区间。PortPlan 若采用经典公式，不能照搬该包 α 的解释或默认配置。
- `BaseGrasp.solve` 在启动之间检查时间，构造与局部搜索调用本身不形成硬墙钟边界。它不能替代 PortPlan 的独立父时钟和 checkpoint 审计。

该代码支持“存在许可明确、可检查的通用 GRASP 实现”这一事实；它的目标是旅行距离，默认构造是 CheapestArc，不能把它说成现成的仓库容量、执行冻结或滞箱费算法。归档是参考源码选集，依赖没有全部打包，不能将目录当成已安装的完整 Python 包。

## 2. 外部机制验证：原始 RCPSP 与 serial SGS

实际完整阅读了 Wouda 与 Lan（2023）的开放软件论文 [ALNS: a Python implementation of the adaptive large neighbourhood search metaheuristic](https://doi.org/10.21105/joss.05028)，JOSS 8(81), 5028，及其官方 RCPSP 文档/源码。论文为 CC BY 4.0，代码为 MIT；二者许可不同，分别保留。

固定 [N-Wouda/ALNS commit](https://github.com/N-Wouda/ALNS/tree/5ef1fd1171e6be49c947cd3e56e485509b9c1d64) `5ef1fd1171e6be49c947cd3e56e485509b9c1d64` 的 [RCPSP notebook](../data/public/v7-external-methods/alns/resource_constrained_project_scheduling_problem.ipynb) 已原字节取得，24,485 B，SHA-256 `b479ff92404b2dc4dad6239ce09fd6715d874154cd88dbad3541fa1de965efb4`。原 [MIT notice](../data/public/v7-external-methods/alns/LICENSE.md) 随附。

该 companion implementation 的实际步骤是：拓扑合法任务优先表经 serial SGS 转为开始时刻；每任务先求所有前驱完成后的最早时刻，再寻找容量可容纳其完整固定时长的首个窗口。其 destroy 包括 most-mobile、non-peak、segment；repair 在前驱与后继允许的位置之间随机插入，再做 right/left justification。完整例子还使用分段轮盘自适应权重、HillClimbing 接受和 5,000 次迭代。这不是把一段随机插入代码接上就等于完整 ALNS。

notebook 将 SGS 归因于 Fleszar 与 Hindi（2004）, EJOR 155(2), 402–413，DOI `10.1016/S0377-2217(02)00884-6` 的 Figure 1；将 justification 归因于 Valls、Ballestín 与 Quintanilla（2005）, EJOR 165(2), 375–386，DOI `10.1016/j.ejor.2004.04.008`。本轮核对了这些书目信息、公开摘要及 companion 的实际代码，**没有取得两篇论文的全文或其原作者代码**。出版社对前者直接获取返回 403，没有绕过或联系作者。

原 notebook 的 right-justify horizon 实际取任务时长总和；随后重新 serial-left。它保存的运行输出与结论段的数值并不完全一致，不能拿 notebook 文字作为本项目实验成绩。引用的是方法步骤，不是复用其性能结论。

今天可做的外部验证是：原样保留公开单模式 RCPSP 的任务时长、前驱、可再生资源需求与常量容量，报告 makespan、完整可行率、相对官方 reference 的差距，以及独立逐时段容量/前驱审计。已有独立取证选择 PSPLIB j30 官方全部 480 实例，每例 30 个真实活动加 2 个 dummy；实例是生成研究 benchmark，不能称真实港口订单。官方 research-use 条款与 archive/reference SHA 由 [公开验证调查](public-validation-v7.md) 和其协议单独记录；没有把 ALNS 的 MIT 自动扩展成 PSPLIB 原数据的再分发许可。

若实现只采用 SGS 与固定、有限 destroy/repair，应称 **literature-inspired bounded iterated SGS**，说明与 companion 在 operator selection、acceptance、justification、随机数和停止条件上的差异。相同问题输入有助于检验算法，但并不证明重现了 Fleszar 的完整 VNS、Muller 的完整 ALNS 或现代 RCPSP 最佳方法。官方 reference 本轮未取得实际 start-time 方案，比较 makespan 值不能代替对本地方案的独立可行性审核。

### 为什么不把 RCPSP 数据硬转成港口订单

固定时长任务与半开占用区间能验证资源累计和前驱约束。PortPlan 的 staging 长度由 pickup/return 决策共同形成，还有日期费率阶梯、动态可见订单与执行冻结；这些不是原单模式 RCPSP 字段。为源任务人为追加 release、空箱归还、fleet、收费或 p/r coupling，会产生新合成问题。故本轮保留原始 RCPSP 单独运行，不将其结果并入 PortPlan 的费用分母，也不称其是核心港口业务的完整外部验证。

## 3. 精确模型参考及未选的近港口来源

额外取得了 Google OR-Tools 固定 commit `100f66e6242ab8bf8d32feb8f3bf086db66ae2b5` 的 [rcpsp_sat.py](../data/public/v7-external-methods/ortools/rcpsp_sat.py) 和 [Apache-2.0 LICENSE](../data/public/v7-external-methods/ortools/LICENSE)，实际读了输入类型、interval/precedence/resource 建模。它可作为固定 RCPSP 模型的公开精确实现参考，但本次没有安装、运行或把它列为已评估基线。现有 PortPlan GLPK/HiGHS 对照也不因此自动变成 CP-SAT 对照。

先检查了 V6 已取证的 [真实数据调查](real-data-investigation-v6.md)：Antwerp drayage 的部分实证数据保密/需联系；MIPLIB drayage 的部分业务字段由模型生成、并非 PNC 实单；RMG 论文公开包是 synthetic 任务且没有已确认的开放代码许可。本轮有界搜索另见 TSP、generic scheduling 和 detention 工具，但没有核实到既开放许可、又能原样运行 PortPlan 提箱—卸货—空返与费率/执行锁全链的已发表开源算法。**这是实际核查范围内的结论，不是全球不存在该类公开实现的断言。** 没有再下载 V6 大包、登录、联系或绕访问限制。

## 4. 本轮能支持的表述

- “增加了一条由经典 GRASP 框架独立适配的同模型基线”，需以后续固定协议、代码和完整负结果成立为前提。
- “在原生公开 RCPSP 上验证通用前驱和可再生资源排程机制”，需保留全部固定实例、失败与独立审计；它支持通用算法证据，不支持真实港口节费。
- “外部参考代码按固定 commit 与原许可归档”，可以直接检查原件 hash；没有声称这些源码都已安装运行。

不能宣称：首创 GRASP/SGS/滚动重排、复现上述期刊完整算法、优于最新 SOTA、用 PSPLIB 验证了真实 PNC 收费，或用公开运输样本补齐了实际不存在的历史动作。算法比较还需共同可见信息与预算、完整率和配对费用分母、初始化来源及负结果；文献来源本身不保证新基线强度或优势。
