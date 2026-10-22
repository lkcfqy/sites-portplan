# V7：公开来源支持的 classical GRASP 对照适配

`src/grasp-planner-v7.js` 是 classical GRASP（Greedy Randomized Adaptive Search Procedures）对 PortPlan 日级费用、资源与已执行事件模型的实现适配。它用于增加一个有明确外部方法依据的对照；不是原论文代码复现、港口论文成绩复现、文献最先进算法认证或新留出效果声明。新场景的费用、成功率和稳定性必须等冻结协议下的完整实验。

## 实际读到的方法依据

来源为 M. G. C. Resende 与 C. C. Ribeiro 的作者公开 AT&T 报告 **GRASP: Greedy Randomized Adaptive Search Procedures**（2008，修订 December 2010）：<https://www.resende.info/mauricio/doc/sgrasp2010.pdf>。本轮文献审阅实际读取 §2.2、§2.4、§3 和 Figures 2、3、5、6，包括 PDF 索引 6–7 的 value-based restricted candidate list（RCL）：

\[
RCL=\{e\in C_{feasible}:c(e)\leq c_{min}+\alpha(c_{max}-c_{min})\},\quad 0\leq\alpha\leq1.
\]

每次插入后更新当前合法候选及 greedy value；从 RCL 随机选择，重复构造并进行局部改进。原文讨论 construction 失败后修复或舍弃、多启动以及 first-improving/best-improving local search。本实现舍弃失败构造，使用 first-improving 单箱及双箱邻域。固定 α 没有根据已取得成绩自适应更新概率，因此不是 reactive GRASP。

该报告可以公开阅读，但未发现明确复制许可；源码包保存引用与来源记录，不重新分发报告 PDF。公开方法来源与本项目实现贡献的更广范围说明见 `docs/external-methods-v7.md`。

## 本项目选择的构造候选与资源影响

一个可插入候选是某箱完整的 `(pickupDay, unloadDay, returnDay)`，不是道路路线。每箱合法域同时满足放行、交付、规划期、卸货持续时间、返空滞后、全部已执行日期和 `minEventDay`。未执行事件不能被移到观察日之前。开始的卸货保留完整连续占槽；已提箱箱位仍从原提箱日连续计至还空。完整 trip 的历史与未来资源只计一次。

首轮按合法域大小、最晚开始日、已固定事件数量和箱号排序；后续轮使用固定种子的 Fisher–Yates 洗牌。每个箱插入时重新枚举在当前运输、仓库和场地占用下**完整可行**的 trip。它不同于 V6 的排序构造加有限回溯：本方法没有 rollback repair，而是对全部当前合法 trip 计算 value-RCL。

本项目 greedy value 混合主目标新增费用与资源影响：

- 主目标新增费用由当前公布模型重算；`joint` 包含两费，另支持已披露的单目标模式。
- 资源影响为该 trip 的每次运输、每个卸货槽日及每个箱位日需求，分别除以该日未占用容量后相加。同日提还算两次运输，40 英尺在 TEU 模式占两份场地；无跨日库存时没有场地项。
- 对本次箱的当前完整合法候选分别做 min–max 归一化，得到 `feePart` 与 `resourcePart`。没有差异的一项为 0。
- greedy value 为 `(1−resourceImpactWeight) × feePart + resourceImpactWeight × resourcePart`，之后应用上述经典 RCL 阈值并在 RCL 中均匀抽样。

资源影响、混合尺度、按箱决定候选、三事件域和执行锁都是问题适配选择，不能归为原报告的港口模型。α=0 是当前 composite value 的最贪心候选（平局可随机），不是必然费用最贪心；α=1 在当前箱的完整可行 trip 中随机，不取消合法性约束。

## 有限 first-improving 局部搜索

完整构造先独立重建收费并审计，再进入局部搜索。每轮以固定种子洗牌箱顺序：

1. 单箱邻域撤下该箱完整 trip，在其原锁定域内按主目标、联合新增费用和日期的固定顺序找第一个费用改善且资源可行的替代。发现后立刻更新占用并重新审计。
2. 双箱邻域同时撤下两只箱，尝试两组原锁定域中的替代 trip；允许一只箱费用增加，只要两只箱合计的主目标改善，或主目标相同而联合新增费用改善。当前 trip 保留为可选项；每只箱最多 12 个费用顺序候选，加当前 trip。全调用最多检查 256 对组合。
3. 原占用的撤除与恢复以规划期内有界循环完成，不能把中间少箱状态作为完整方案。最多三轮；没有改进或预算耗尽即停止。

邻域没有穷尽，且时间截止可能中断搜索；不能声明到达完整邻域局部最优，更不能声明全局最优。所有成功状态都是 `feasible`，`optimality=source_adapted_grasp_heuristic`。没找到解只返回空排程与 null 费用，不生成不可行证书。

## 前置固定参数与预算

本模块默认值在任何 V7 新留出输入生成之前写入 `GRASP_V7_DEFAULTS`：

| 参数 | 固定默认值 |
|---|---:|
| 整次调用 `timeBudgetMs` | 200 ms |
| RCL `alpha` | 0.25 |
| `resourceImpactWeight` | 0.15 |
| 随机重启 `maxRestarts` | 127，连首轮最多 128 次构造；API 范围 0–128 |
| `maxLocalPasses` | 3 |
| 双箱费用候选 `pairCandidateLimit` | 12，加当前 trip |
| 全调用双箱组合 `maxPairChecks` | 256 |
| 尾部审计预留 `auditReserveMs` | 5 ms |
| 保留合法缓存 `retainFeasible` | true |

开发期曾先设 15 次随机重启（最多 16 次构造）。只探测旧 V5 前两个 12 箱名义输入：第一个完整可行，第二个 16 次构造都失败，分别约 57 和 27 ms，没有用完 200 ms。基于这两个明确的旧开发观察，在任何 V7 新留出生成前将默认上限修订为 127 次重启（最多 128 次构造）；α、资源影响权重、局部邻域、审计预留和总预算均未改变。该修订不是新留出结果筛选，不能隐去原负例或把开发结果当正式成绩。

时钟从进入 planner、克隆输入之前开始，覆盖输入与参数校验、合法域、全部 RCL 构造、局部搜索、重算收费、候选审计与汇总。`timeLimitSeconds:0.2` 在本方法也只表示整个调用 200 ms；优先级为单次毫秒、单次秒、工厂毫秒、工厂秒、默认 200 ms。没有给构造、局部搜索或 MILP 额外预算，本对照根本不调用 MILP。模块 import 在 callable API 建立之前完成，另由外层 episode 冷启动墙钟计入。200 ms 是合作式截止，实际返回与原子占用恢复可能跨 deadline，`deadlineOverrunMs` 如实保留；完整 episode 仍需共同的冷进程父层 5,000 ms 硬预算。

每个候选在审计和汇总完成后再次检查 deadline，晚完成的候选丢弃。此前已在预算内完整接受的 incumbent 可以保留返回；它不是绝对墙钟中断。实时预算会影响完成的重启数量和结果，不能声称不同设备总能得到相同排程。

每个 episode 必须用新的 `createGraspPlanner(config)`。合法缓存只保存三个日期，之后按当前公开模型和当日快照重新计费及审核；有效时直接保留，不宣称当日重新最优。配置 `retainFeasible:false` 时有效缓存仍是已审计 fallback，继续在同一调用预算内搜索。不同 episode、不同订单/业务日口径或倒退的决策日不允许继承缓存。所有输入和输出都与内部缓存隔离。

```js
import {createGraspPlanner} from './src/grasp-planner-v7.js';
const planner=createGraspPlanner({timeBudgetMs:200});
const result=await planner(observedScenario,{
  minEventDay:today,
  fixedEvents:executedDates,
  objectiveMode:'joint',
});
```

`plannerMetadata` 保留调用、构造和复用次数（`solverCalls=0`），完整候选首次接受时间、合法域/RCL/单箱/双箱计数、参数、种子、实际调用时间和 deadline overrun。不接收私有冲击列表、真实未来容量或持续时间。外层执行器只应传原滚动核心提供的当时观察与精确历史锁。

## 小例验证及效果边界

`tests/grasp-v7.test.mjs` 只用手工小例：独立枚举费用和每日资源、确实需要双箱交换的局部陷阱、进行中卸货、同日双运输、TEU、未知未来相同前缀、缓存收费重算/隔离、非法与稀疏输入、极小预算和失败费用为 null。小例参数覆盖边界与邻域机制，不用于选择新留出成绩最优参数。

旧 V5/V6 开发输入可另作开发控制，不能加入前瞻分母、删去失败、凭更多时间把额外原生证书算成在线成功，或将公开运输客户造出缺失字段用于真实港口收益声明。实验必须同时报告完整执行覆盖、共同完成路径的费用和日期变化、初始方案差异、失败日、调用预算以及全部零和负效果；本方法的外部依据提升对照的可解释性，不预先证明它更强、更省费或比赛领先。
