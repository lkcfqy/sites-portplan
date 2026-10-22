# V6：带执行锁的可行恢复与共同预算择解

`src/recovery-planner-v6.js` 在原滚动信息规则下，增加独立的锁定三事件构造器。它先寻找完整可行方案，再以同一次调用剩余预算运行锁定 MILP，并选择已完整审计的候选。该模块没有读取未来冲击的接口，没有改动 V4 引擎、滚动模拟器、V5 稳定策略或历史原始结果；本方法不声称首创、总能恢复、全局在线最优或改善新留出集表现。

## 先分清需要恢复的失败

V5 开发案例的独立分层诊断保存于 `data/failure-diagnosis-v6.json`。24 个滚动案例、两种策略共 48 个 episode，16 个失败 episode 对应 8 个案例。全部失败日的**当时观察信息、精确已执行锁和最早未执行日**模型均被原生 HiGHS 判为不可行，没有发现只是 GLPK 0.2 秒未取得 incumbent、且同一前缀仍可恢复的旧失败。

- 3 个案例从名义初始模型已不可行，合计 6 个失败 episode。
- 4 个案例名义模型可行，但真实全路径即使全知也不可行，合计 8 个失败 episode。
- `new-arrivals-tight-n24-r2` 的真实全路径存在全知可行方案，但两种策略到 D8 已各固定 37 个事件；这些既有前缀都没有合法延续，合计 2 个失败 episode。

最后一类不能称为“原始输入全局无解”，也不能在失败日通过撤销历史承诺修复。恢复构造器适用于当前锁定模型仍可行的情况，或帮助在更早决策点取得不同的可行解；它不能消除真正不足的容量、过紧期限或已经形成的不可恢复前缀。诊断使用更多原生计算预算，是离线验证，不进入在线信息集合。

## 独立锁定三事件域

V5 的 `solveFastConstructor` 明确拒绝执行锁，因此本实现没有把旧无锁构造器作为恢复候选。对每箱枚举完整 `(p,u,r)`：

- 已发生提箱、卸货开始、还箱的日期分别只允许其固定值。
- 没有固定值的事件日必须不早于 `minEventDay`。
- 提箱不得早于放行日，卸货不得早于提箱，卸货结束不得超过交付期限。
- 还箱不得早于 `unloadDay + unloadDays − 1 + returnLagDays`，所有事件及卸货区间均在原完整规划期内。

每个候选的全部资源占用均计入同一日数组：提箱和还箱各一次运输；卸货从开始日到完成日每天一个槽；箱位在 `pickupDay ≤ day < returnDay` 占用，按箱或 TEU 计算。已开始卸货的尾部不能删除、暂停或重新开始；已提箱的箱位从原提箱日连续计至合法还箱日。历史已占用与未来固定尾部都保留，**不另行扣一次固定占用再把完整 trip 重复计入**。

构造按域大小、期限、已固定事件数和费用压力等次序尝试，之后进行有限次固定种子的随机重启。每次放置增量更新资源；失败时最多撤下最近 3 个已放置箱，与失败箱共同作最多 128 次候选检查的回溯修复。撤下的箱仍使用其原锁定域，不能改变已执行日期。成功后执行少量直接日期 relocation，只在完整合法域内寻找更低费用候选。函数返回完整审计过的启发式结果或空排程，不把部分放置费用作为成功，不把构造失败冒充不可行证明。

## 候选审计与计划保留

工厂入口 `createRecoveryPlanner` 返回按日串行调用的 `planner(scenario, options)`。每个滚动 episode 创建一个独立工厂实例。缓存只存完整通过审计的箱号和三个事件日期；每次使用当前订单及收费参数调用 `rowFor` 重算费用、完成日、资源和汇总。

默认 `retainFeasible: true`：缓存在当前 snapshot 下仍通过 `auditSchedule` 与 `auditFrozenEvents` 时，完整保留日期，不调用构造或 MILP，返回 `feasible / retained_plan_not_reoptimized`。它可能比当天重新求解更贵，不继承旧最优性证书。

缓存失效或初始无缓存时先调用锁定构造器，再运行当前信息下的锁定 MILP。每个回调使用独立输入副本，结果只读取一次快照；有限整数日与规划期边界预检先于资源循环。回调提供的费用、尺寸或完成日不是权威记录，事件日期按当前真实模型重建，再进行静态资源/先后审计和冻结历史审计。回调不能通过提高自己的容量副本或删除锁来影响原输入审计。

在完整候选中按当前 `objectiveMode` 主费用选择，主费用相同时按联合增量费用选择，完全同价时优先 MILP 候选。构造结果始终是 `feasible / locked_constructor_heuristic`；MILP 的最优状态仅描述**当前观察模型和名义未来预测**，不证明真实未来路径或完整在线过程最优。若 MILP 声称不可行却已有当前完整审计可行候选，保留候选并在阶段记录 `infeasibilityContradictsAuditedIncumbent`，不能覆盖掉可行证据。

`retainFeasible: false` 是预先定义的每日搜索消融：有效缓存仍可作为已审计 fallback，但每天继续构造和 MILP。有效缓存不足以证明当前最优。无候选时所有完整费用字段为 null，既有无效缓存不会作为结果；只有预算内 MILP 返回不可行状态时才报告 `solver_reported_infeasible`，构造耗尽或超时仅表示未找到方案。

## 同一次调用的合作式 200 ms 预算

默认参数在新留出协议运行前定义为：

| 参数 | 默认值与含义 |
| --- | --- |
| `timeBudgetMs` | 200；一次 `planner` 调用的总合作预算 |
| `constructorShare` | 0.4；构造阶段最多用初始预算的 40%，提前结束的剩余时间可交给 MILP |
| `auditReserveMs` | 5；进入 MILP 前为后续审计、重算和返回准备保留时间 |
| `maxRestarts` | 15；加首轮最多 16 次构造尝试 |
| `retainFeasible` | true；有效缓存直接保留 |
| 随机种子 | 使用当前已知 `options.seed`、名义情景 seed 或 42；不从真实冲击路径取得种子 |

`options.timeBudgetMs` 可显式指定总预算；否则提供的 `options.timeLimitSeconds` 按秒转换成**整个调用**预算，而不是额外给 MILP 一份独立预算。例如 V4 回调传入 `timeLimitSeconds: 0.2` 时，构造加 MILP 共享 200 ms。

计时从进入 `planner`、输入快照之前开始，包括输入克隆、验证、缓存审计、构造、GLPK 实例初始化、MILP 模型准备、候选重算和选择。顶层模块 import 在该 API 可调用之前完成，不进入这次函数的计时；研究应单独记录 episode 的冷启动 import 开销。GLPK 实例懒初始化，在第一次使用该模块时消耗当前调用预算，以后进程内复用。

默认求解器包装原 `solveMILP`。JS 模型准备完成后，每次实际 `glpk.solve` 前重新读取剩余预算，向 GLPK 传入不大于剩余整数毫秒的限时；二级词典序调用也使用同一 deadline。安装的 `glpk.js 5.0.0` 源码 `src/glpk.js` 把 `opt_.tmlim * 1000` 传入 C 的 `int tm_lim`，`src/glpk.js.c` 将其赋给 `parm.tm_lim`，**没有一秒限时下限**。

这仍是合作式 deadline，不是绝对墙钟中断。GLPK binding 自己的矩阵装载、原生限时检查及返回开销无法在 JS 中随时中断，且 GLPK 内部限时不覆盖 binding 在调用前后的全部工作。模块把这些实际墙钟开销计入阶段和总耗时，披露 `deadlineOverrunMs`；外层研究执行器仍需单独的 episode 硬限时。晚于总 deadline 才完成审计或费用汇总的新增候选被丢弃；已有此前接受的完整候选仍可返回，并如实记录实际 overrun。不能把本方法描述为每个调用绝不超过 200 ms。

## API 和记录

```js
import {createRecoveryPlanner} from './src/recovery-planner-v6.js';
import {runRollingScenario} from './src/rolling-plan.js';

const planner = createRecoveryPlanner({timeBudgetMs:200});
const result = await runRollingScenario(nominal, capacityEvents, {
  planner,
  timeLimitSeconds:0.2,
});
```

还导出 `solveLockedConstructor(scenario, options)`，可单独验证手算 fixture；支持 `fixedEvents/minEventDay/deadlineMs/timeBudgetMs/maxRestarts/seed/objectiveMode`。工厂的 `constructor/solver/now` 可注入测试回调，生产默认使用真实单调时钟和锁定模型。求解回调的第三参数仅含共同 deadline、时钟和尾部保留预算，不含冲击列表或真实未来。除这些回调外的工厂数据选项作为求解默认值，单次调用覆盖默认值。

每次结果的 `plannerMetadata` 保存：

- 累计 `decisionCalls/constructorCalls/solverCalls/reusedPlans/replannedDueToInvalid`，失败和异常调用也计入。
- 来源 `retained_plan/cached_incumbent/locked_constructor/locked_milp/no_complete_plan`。
- 总预算、实际墙钟时间、超出 deadline 的时间和合作式预算标记。
- `stages.cacheAudit`、构造计数与随机规则、MILP 原始状态/主张、阶段实际耗时、候选审计和晚候选拒绝记录。
- 默认 MILP 的 `nativeBudgetMetadata`：实例初始化耗时、每次原生 GLPK 调用的实际整数毫秒限时和预算不足跳过次数。

`solverCalls` 是求解回调次数；一次回调可能包含两个词典序原生阶段，也可能因初始化或模型准备耗尽预算而没有真正调用 GLPK。`nativeLimitsMs.length` 给出真正原生调用次数。计数在工厂生命周期累计，不能跨实验共用实例。现有滚动核心没有自动保留此字段，研究脚本或演示应在回调 wrapper 中记录它，并明确设置 V6 策略标签。

## 当前验证与后续公平评估

`tests/recovery-v6.test.mjs` 只使用手算合成 fixture，没有运行新的留出种子。测试覆盖：精确锁域、进行中占用、TEU、同日双运输、独立小例枚举、明确触发 rollback 的资源冲突、没有 MILP incumbent 时保留构造候选、共同 deadline、快照/汇总耗尽预算、晚候选拒绝、输入及旧输出变异隔离、未知未来前缀不可区别、费用重算、非法 partial、真实不可行以及默认 GLPK 毫秒限时。独立只读审查发现的汇总跨 deadline 接纳问题已增加边界检查和回归。

在新冻结协议下应比较：原锁定 MILP、V5 保留可行计划、V6 保留可行加恢复、以及预先定义的每日恢复消融。保持同一已知订单、名义容量、实际冲击、揭示规则、历史锁和**每次调用总预算**；不同调用次数意味着总 CPU 不同。报告完整完成率、失败日与分层原因、配对完整执行费用、日期变更数、首次可行候选时间、求解/构造次数、冷启动和 deadline overrun。费用只配对同案例双方完整成功结果，失败保留 null，不能把恢复失败或截止期不可行案例排除。

旧 V5 结果用于诊断和开发，不替代新留出评价。无需未来信息而改变更早决策是否改善那类不可恢复前缀、以及构造分走预算是否反而损害 MILP 质量，都必须由冻结的新实验回答，当前没有效果结论。
