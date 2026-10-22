# V9：显式有限资源菜单内的反事实补救

本模块回答一个有限的问题：**在当前已知容量、订单、真实过去事件不变的前提下，从用户明确给出的可购买资源包中，找到能排出完整可行计划的最低采购费用。** 它不会购买、派车、联络供应商，也不会把预测恢复当作未知未来的实际收益。该功能不代表实际运力、库位或堆场资源已经取得。

## API

```js
import {
  solveResourceRecovery,
  auditResourceRecovery,
} from './src/resource-recovery-v9.js';

const options = {
  minEventDay: 2,
  fixedEvents: {A: {pickupDay: 0, unloadDay: 0}},
  actions: [{
    id: 'explicit-warehouse-quote',
    resource: 'warehouse',
    days: [2],
    units: 1,
    priceKRW: 70000,
    authorized: true,
    earliestAvailableDay: 2,
  }],
  objectiveMode: 'procurementOnly',
  timeBudgetMs: 1000,
};
const result = await solveResourceRecovery(currentObservation, options);
// A caller can repeat the independent audit using its original input/menu.
const audit = auditResourceRecovery(currentObservation, options, result);
```

`currentObservation` 是现有引擎的 Scenario，不接收未揭晓的未来冲击列表。`minEventDay` 为当前决策日。`fixedEvents` 必须完整表达已执行事件，所有锁定日期必须严格早于决策日；未执行事件不能移到过去。已开始的连续卸货仍逐日占用仓库，已经提走但尚未归还的箱仍占用堆场。

菜单必须显式提供，允许空数组，最多 64 个不同包。每个包最多选择一次，包间容量可相加。每个包的字段均必填：

| 字段 | 含义 |
| --- | --- |
| `id` | 唯一非空字符串 |
| `resource` | `truck`、`warehouse`、`staging` |
| `days` | 包覆盖的不同规划日，0 为规划期第一日 |
| `units` | 每个覆盖日增加的正整数资源单位 |
| `priceKRW` | 整包价格，非负安全整数 KRW，允许零价 |
| `authorized` | 用户明确声明的布尔授权 |
| `earliestAvailableDay` | 用户明确声明的最早可用日 |

车的单位为每日运输次数；同日提箱加还箱仍为两次。仓库单位为每日可连续卸货箱数。堆场单位服从情景的 `operations.stagingUnit`，为箱或 TEU；40 英尺箱在 TEU 模式下占用 2。模块不补造日内行程、供应商报价或进场许可。

未授权、包内任何一天已经过去、包内任何一天早于其最早可用日，都会使**整个包被排除**。不自动拆包或推迟。`excludedActions` 保留原包事实及所有原因：`not_authorized`、`would_change_past_capacity`、`before_earliest_availability`。格式错误、缺报价/授权/交期、重复包、非法日期、非安全整数会抛出错误，而非默默填默认值。已购容量应由调用者并入当前容量并从可买菜单移除；本模块无采购账本。

## 目标与证明边界

默认 `procurementOnly` 仅最小化选择包的总采购价。两费仍完整重算、单独展示，既有免费可行方案会使采购最小值为零。零价包可能被选择；多个最小采购方案之间没有承诺最少包数或最低两费。

可选 `feesPlusProcurement` 最小化**新增仓储费 + 新增 D&D + 采购价**。历史已计提费用是常数，不影响最优方案。`combinedIncrementalCostKRW` 是这个目标，`combinedTotalCostKRW` 则包含历史已计提两费。此模式的最优不代表采购费单项最低。

实现复用只读的时间索引 GLPK 模型，为每个可买包添加二元变量，并在对应资源日容量行加入 `-units × actionBinary`。关闭原容量的个体预处理，防止错误删除购买资源后才可行的日期。原 V1–V8 代码、算法参数及既有实验不作修改。

| `status` | 可解释为 |
| --- | --- |
| `optimal` | GLPK 返回 OPT、目标为安全整数、完整方案独立审核有效且及时接受；有限菜单内最小值成立 |
| `feasible` | 完整方案审核有效，但未证明严格最小；包括有 incumbent 的限时求解及非整数费用的数值最优 |
| `infeasible` | 空事件域或 GLPK 证明该观察和该可用菜单内无解；不等于现实中无任何补救可能 |
| `time_limit` | 未及时取得并完成审核的有效计划；不证明菜单无解 |
| `candidate_rejected` | 求解器分配或独立复算未通过 |
| `solver_error` | 初始化、建模或原生求解异常 |

严格最小声明须检查 `proof.minimumObjectiveProven`。采购费单项最小另检查 `proof.minimumProcurementProven`；它只在默认模式下可能为真。非整数费率使目标存在浮点系数时，GLPK OPT 仅记为 `solver_optimal_with_numeric_tolerance`。这些是所述 MILP 和求解器的证明状态，不是第三方业务认证。纯 JS 审计器只独立验证方案可行性和费用，明确输出 `optimalityAudited:false`；它不独立重解最优化问题。

## 返回值与独立核验

成功结果包含 `rows`、`selectedActions`、`excludedActions`、采购费用 `procurementCostKRW`、原有 `storageCost/ddCost/totalCost/sunkCost/incrementalCost`、两种合计金额、逐日 `usage`、`audit` 和 `proof`。`counterfactual:true`、`purchaseExecuted:false` 始终标明建议未执行。所有未来费用均只对当前观察的确定性预测有效。

没有完整有效计划时，`rows` 为空，采购费、两费及合计金额均为 `null`，不以零表示失败。完整菜单和排除原因仍保留。失败结果的 `selectedActions:[]` 表示没有已接受建议，不能解读成“零资源可以救援”。

`auditResourceRecovery` 不信任输出的价格、动作详情、费用字段或每日容量。它依据原输入重新筛选授权与交期，逐日叠加包容量，复算每个已知箱的连续卸货、半开区间堆存、TEU、同日双运输、过去锁，以及独立实现的 PNC 和 D&D 公式。输入菜单在 worker 与父页面之间必须绑定；父页面应传入原始 options，不能使用 worker 声称的替代菜单。

预算包括输入复制、验证、GLPK 初始化、建模、求解、最终独立审核、目标一致性校验和完整结果/证明对象构造。默认另留 5 ms 给审核，原生 `tmlim` 使用实际剩余毫秒。所有可行计划、最优声明及菜单内无解证明，都在完整终态对象构造以后做最终接纳检查；晚到的一律返回未知的 `time_limit`，顶层金额仍为 `null`。该预算是协作式墙钟限制，初始化和同步原生调用无法被本函数强行中止；需要硬中断的调用者应在独立 worker 中运行并从父页面终止。模型不声称跨机器固定毫秒性能。

## 验证

```sh
node --test tests/resource-recovery-v9.test.mjs
```

11 项手写 fixture 测试覆盖无采购、非零历史两费、单箱/多箱可相加整包的最低采购费、零价必需包、缺授权/过交期排除、菜单内无解、不可回写的过去、持续卸货、TEU 和同日双运输、两个目标的区别、非整数目标证明边界、极短预算保持未知，以及动作/费用/历史篡改。小情景另用独立完整日期与菜单子集枚举 oracle 检查采购最小值。这些是单元与小型物理核验，不是新增正式竞赛场景成绩，不证明实际业务有效性。

真实使用仍需确认报价真实性、包间是否独立可叠加、道路和日内时间窗、实际仓库/堆场接口、资源采购权限及真实交付条件。这里的用户声明未经过供应商验证。
