# V7：完整锁定方案的联合费用修整

`src/cost-recovery-v7.js` 在冻结的 V6 锁定恢复器外增加有限的费用搜索。工厂 `createCostRecoveryPlanner` 保留同一次调用的总合作预算、当前观察信息、历史执行锁和完整候选审计；新模块不改动 V6、引擎、滚动规则或旧原始结果。本方法不声称首创、在线最优、每次绝不超时或比相同预算 V6 必然更便宜。

目标是改善**当前 snapshot 上已有的完整可行种子**。这与提升最终滚动完成率、降低真实执行费用或证明某条历史前缀可恢复不同；后者必须用冻结的新留出协议评估。订单在初始全部已知，未知的是未来容量冲击，不扩展成未知订单实验。公开费率与合成订单只能支持模型研究，不能宣称真实业务节省。

## 完整种子的费用不增约束

`polishCompletePlan(scenario, seedCandidate, options)` 首先用当前订单与收费参数对种子的三个事件日期调用 `rowFor` 重建。回调提供的费用、箱尺寸、完成日或所谓证书均不直接采信。种子必须包含每个已知箱且无重复，所有日期为规划期内整数；完整 `auditSchedule` 和 `auditFrozenEvents` 都通过后才被接受。

在同一个 snapshot、相同 `fixedEvents/minEventDay` 下，修整保存一份完整 incumbent。每个变化须重新定价全部箱并通过两种完整审计，且联合增量费用严格小于 incumbent，才被接受。超出搜索 deadline 才完成审计或汇总的新增候选被丢弃。每次已接受变化满足：

```text
联合增量费用(next) < 联合增量费用(incumbent)
最终修整费用 <= 当前 snapshot 重新定价后的种子费用
```

同一 snapshot 的沉没费用固定，因此总费用也不会因该修整增加。联合目标是港口堆存与 D&D 的增量费用之和；本模块明确拒绝 `ddOnly/storageOnly`，不把某一费用下降等同于联合费用下降。找不到严格下降、搜索关闭或 deadline 已到时保留已审计完整种子；种子非法或不完整时返回空排程与 null 费用，不把部分排程计为成功。

这条约束只比较传入种子与同日修整，不保证不同策略的历史路径费用不增。V6 最终也可能选择更便宜的 MILP 完整候选；V7 检查最终结果不超过已审计种子费用，并单独保留修整前后证据，避免最终 MILP 获胜覆盖掉修整过程。修整对同价变化不改日期；V6 的最终同价候选规则仍可选择 MILP，因此不声称所有阶段都无同价变更。

## 物理事件锁与资源区间

已发生提箱、卸货开始和还箱保持各自精确日期；未固定事件不早于 `minEventDay`。开始卸货的箱继续从原卸货日连续占用至完成日，不能重新开始、暂停或移除尾部。提箱至还箱的箱位占用连续保留。

搜索按引擎既有日级含义计数：提箱和还箱各一次运输，同一天时累计两次；卸货每天一个槽，区间为 `unloadDay` 至 `unloadDay + unloadDays - 1`；箱位区间为 `pickupDay <= day < returnDay`，按原模型的箱或 TEU 权重。做局部候选时从完整资源用量暂时扣除目标箱的完整 trip，再加入其候选 trip；执行锁仍限制该箱的历史日期，不能借此删除过去资源或固定的未来尾部。真实当前容量不放宽。

构造回调与求解回调取得独立输入副本，种子修整依据回调之外保留的当前 snapshot 与锁审计。回调提高自己的容量、删除自己的锁或修改自己的费用不能改变最终审计。模块没有事件列表或未来实际容量接口，缓存每天也按当前观察信息重新审计与定价。

## 有限的单箱与双箱搜索

先处理当前增量费用较高的箱，尝试单事件日期变化、卸货与还箱组合、有限整段平移。费用按提箱日的堆存增量及还箱日的 D&D 增量分解，逐箱懒计算价格数组；资源检查使用日数组，避免为每个明显非法候选重建全计划。

单箱提前可能被另一个箱阻挡，因此接着尝试双箱整段交换、单事件交换和有限的双箱重新插入。候选列表同时保留低价候选及少量涨价候选，使低费用箱可以稍晚、换取高费用箱更早，总费用仍严格下降。双箱优先级依据预计整段交换收益和费用压力，不读取未来冲击。

每次真正接纳仍必须通过完整定价与双重审计；局部资源过滤只用于加速，不能替代证书。候选枚举是有界启发式，没有穷举或局部最优证明。

## 预先定义的参数与共同预算

导出 `COST_RECOVERY_DEFAULTS`，默认值在 V7 新留出种子运行前确定：

| 参数 | 默认值 | 含义 |
| --- | ---: | --- |
| `timeBudgetMs` | 200 | 整次 planner 调用的合作式预算 |
| `constructorShare` | 0.4 | 原 V6 构造加修整阶段最多占初始预算的 40% |
| `auditReserveMs` | 5 | V6 进入 MILP 前预留审计和返回时间 |
| `maxRestarts` | 15 | V6 种子首轮加最多 15 次重启 |
| `retainFeasible` | true | 当前缓存仍可行时直接保留日期 |
| `maxPasses` | 2 | 最多两轮单箱加双箱搜索 |
| `maxSingleTargets` | 16 | 每轮最多处理 16 个高费用箱 |
| `maxPairs` | 32 | 每轮最多检查 32 对箱 |
| `candidateCap` | 12 | 每箱双箱重新插入候选上限 |
| `maxPairChecks` | 384 | 整次修整的双箱候选组合检查上限 |

原 V6 种子获得完整构造阶段 deadline，而非进一步拆分固定份额；只有种子提前返回，才利用其余构造时间修整。构造和修整后用整次调用的剩余预算进入 MILP，不额外增加第二份 200 ms。额外克隆、重定价和审计会消耗原先可给 MILP 的时间，可能降低 MILP 候选质量；不能由上述同种子不增约束推出同预算 V7 支配 V6。

计时从外层 planner 入口开始，scenario 与 options 各只读取一次快照，校验与规划使用同一份快照；其克隆耗时先从预算扣除，V6 内部再把克隆、验证、缓存审计、构造、修整、GLPK 首次初始化、建模、原生调用、最终审计和返回计入剩余预算。顶层 import 在函数可调用之前完成；正式冷 episode 的父进程限时单独包含 import，协议使用统一 5 秒硬限时。默认原生求解继续使用冻结 V6 的毫秒 GLPK 包装及共同 deadline。

合作式检查不能中断正在发生的 JS 重定价、审计、垃圾回收或原生调用开销。结果记录实际墙钟及 `deadlineOverrunMs`，不能声称每次严格不超过 200 ms。已审计种子在 deadline 到达时可返回，新改善必须在 deadline 前完成审计与汇总。单独直接调用 `polishCompletePlan` 默认搜索预算为 80 ms，可通过 `deadlineMs` 或 `timeBudgetMs` 覆盖；它不是另一份独立的工厂预算。

## API、缓存与审计证据

```js
import {createCostRecoveryPlanner, COST_RECOVERY_DEFAULTS} from './src/cost-recovery-v7.js';

const planner = createCostRecoveryPlanner({...COST_RECOVERY_DEFAULTS});
const result = await planner(currentObservedScenario, {
  fixedEvents,
  minEventDay: currentDay,
  timeBudgetMs: 200,
  objectiveMode: 'joint',
});
```

每个滚动 episode 创建独立工厂，按日串行调用。可注入 `seedConstructor/solver/now` 作测试；生产使用 V6 锁定构造、锁定 MILP 与单调时钟。单次调用可覆盖 V6 时间、锁和求解选项；修整参数在工厂创建时定义。`retainFeasible:true` 时，有效缓存不额外构造、修整或求解，返回 `feasible / retained_plan_not_reoptimized`。其它成功均明确为启发式 feasible，不继承当前子问题的最优标签。原生不可行主张仅在 `subproblemStatus` 留存，V7 空候选返回 `not_proven`。

`plannerMetadata` 保留 V6 累计调用、来源、阶段和原生预算记录，新增 `polishCalls/acceptedCostMoves/wholeCallBudgetMs/wholeCallWallMs/deadlineOverrunMs/policyOptimalityClaim/finalVsAuditedSeedNonincrease`。具体修整证据在 `plannerMetadata.polishMetadata`，构造阶段的相同记录在 `stages.locked_constructor.constructorMetadata.costPolish`；compact runner 可用引用替代重复记录。

每个 `seedAccepted:true` 都保存 `beforeDates/afterDates`，包含所有箱的 `{id,pickupDay,unloadDay,returnDay}`；即使 `attempted:false`、deadline 已到或 `maxPasses:0` 也保留，避免只验证有尝试的子集。独立校验者用当日 snapshot 重建这些日期、重算费用并检查冻结与资源；不依赖标量自报。其它字段为 `seedIncrementalCost/finalIncrementalCost/seedObjectiveCost/finalObjectiveCost/jointNonincrease/seedAudit/finalAudit`、严格下降规则、已试单箱/双箱/组合数、容量拒绝、完整审计数、接纳变化及其费用、迟到候选丢弃数、参数和实际耗时。证明数组不含逐箱费率行，也不会被最终 MILP 方案覆盖。

## 手算验证与旧案例开发检查

两箱 fixture 的种子安排 A 在 D0、B 在 D1 依次提箱并卸货，占满对应资源区间；单独把 B 提前违反资源限制。A 放箱时间较短、B 已积累较高费用，交换整段 trip 后可行且更便宜：总费用从 91,000 降至 81,900 KRW。沉没费用为 27,300，因此联合**增量**费用从 63,700 降至 54,600，减少 9,100。冻结 A 的提箱、或使 B 的 TEU 不能进入 D0 箱位，都正确拒绝这次交换。

20 项测试还覆盖进行中卸货尾部、未来事件 floor、同价不改日期、费用字段伪造、证明日期独立复算、输入/输出变异隔离、非法部分候选、deadline 中断、`maxPasses:0` 无尝试证据、整调用预算扣除、输入 getter 不能使目标校验与求解错位、保留缓存、回调不能提高真实容量或删除锁、原生状态不提升为最优/不可行证明、不同未知未来下已知前缀不可区别，以及真实 V6/GLPK 集成。

开发检查只读取既有 V6 冻结主实验 36 案例（原始数据 SHA-256 `695f7a62aeccd645bbd1374899fc21afe6caad1549bfbc7fa2d25e1ed62552a4`），取已成功审计的 D0 V6 完整方案作为种子。snapshot 使用原名义未来，只应用 D0 已揭示容量事实；没有读取实际未来容量，也没有运行或生成 V7 新留出种子。5 案例无 D0 完整种子，保留为不可检查；其余 31 个种子以**额外独立 25 ms 修整预算**检查，10 个降低费用、21 个不变、0 个增加，全部最终审计有效，组件费用减少合计 10,954,950 KRW。计时及垃圾回收使最慢组件调用为 89.57 ms，超过该合作预算；这是需要披露的边界。

该组件检查不是同预算策略比较，不是完整滚动重跑，也不是已实现的业务费用或留出泛化结果。新冻结实验需比较相同名义订单、实际冲击、揭示时间、严格历史锁、每调用 200 ms 和每冷 episode 5 秒硬限时的 V6/V7 与外部公平基准；分别报告完整完成率、配对完整执行联合费用、日期变化、调用次数、冷启动/overrun，并对每个已接受种子独立验证费用不增。失败费用仍为 null，不能靠排除失败或仅选择有改善的种子得出效果结论。
