# PortPlan V2：强基准、合同假设与运营敏感性

V2继承[默认模型](model.md)。没有传入V2参数时，PNC/DD费用、日历口径、容量限制和优化目标保持V1；新增两个比较策略和结果元数据。所有非默认合同参数都只是研究情景，不能冒充核实过的合同价。

## 参数接口

```js
const scenario = {
  ...makeDemoScenario(42, 12),
  tariff: {
    pncFreeDays: 4, ddFreeDays: 10,
    pncMultiplier: 1, ddMultiplier: 1,
    pncMode: 'retroactive', // 或 'progressive'
    ddMode: 'progressive',  // 或 'retroactive'
  },
  operations: {
    returnLagDays: 1,       // 0 = 卸货最后一天可还箱；1 = 翌日才可还箱
    stagingUnit: 'container', // 或 'teu'
  },
};
const result = await solveScenario(scenario, {
  timeLimitSeconds: 2,
  objectiveMode: 'joint',  // 或 'storageOnly' / 'ddOnly'
  strongSearch: {seed: 42, restartCount: 12, iterations: 80},
});
```

省略tariff/operations字段或只传部分字段，均与默认值合并。参数常量导出为`DEFAULT_TARIFF`、`DEFAULT_OPERATIONS`；合并函数为`tariffParameters(tariff)`、`operationParameters(scenario)`。`containerCost(c,p,r,horizonStart,tariff)`第五参数是**tariff对象，不是整个scenario**；纯费用函数`pncStorageCost(days,sizeFt,tariff)`与`maerskDDCost(days,sizeFt,tariff)`第三参数相同。

PNC的超免期档宽保持3、2、5、无限天，DD保持5、5、无限天。修改freeDays时**所有档位边界一起平移**，只是一个透明、可计算的研究假设。它不代表真实延长免费期合同的通用行为：某些合同会延长免期但保留原始计费档位，届时首个收费日可能直接使用高档费率。本版没有把这些合同机制混为一谈。

`retroactive`表示达到的最高档单价乘所有超免期天数；`progressive`表示按各档天数累加。PNC progressive和DD retroactive都是压力/代理模型，不能标为已核实的官方计费逻辑。倍率直接乘各自费用，不改变时间或容量限制。免费期只允许0—365的整数，倍率只允许0—100有限数。

## 运营边界

卸货开始u、持续L天、返回滞后lag时，`r ≥ u+L−1+lag`。默认lag=1与V1相同。同日模式lag=0允许`p=u=r`；当天仍消耗**两次运输移动**与一个卸货槽，不会错误地按一次运输计算。

场地口径始终保持`p ≤ day < r`，因此是跨日保留库存位，而非每分钟物理场地峰值。同日提卸还箱不占跨日库存位。界面和评审必须说明该简化；真实业务仍需日内临时场地、线路和时窗验证。`stagingUnit='teu'`时20英尺占1、40英尺占2；装卸槽依旧每箱占1，运输移动依旧每个事件占1。

## 更强的对照

新策略key：`earliestDeadline`、`strongSearch`。前者按卸货截止日排序，再按卸船时刻、箱号，仍使用完整的最早可行提卸还序列。

`strongSearch`是可复现的排列搜索：

1. 保存FIFO、免费期、边际成本和最早截止日四个基线中的最佳完整可行结果。
2. 用固定seed的LCG随机数执行固定数量的Fisher–Yates随机排列起点。每个排列都从空排程重新进行完整贪心解码。
3. 从当前最佳排列开始，交替尝试relocate（移动一个箱的位置）与swap（交换两个位置）邻域。每个候选都重新生成完整排程；主目标改善，或主目标相同而联合成本改善时接受。
4. 全部完整候选通过硬约束审计。只排了一部分的失败候选绝不计入成本比较。

默认12次随机起点、80次邻域尝试，合计92次完整解码尝试；另含4个初始基线。由于有重复排列或空操作，92是**尝试次数**而不是92个独立解。不是遍历全部邻域，也不声称达到局部最优或全局最优。元数据报告seed、尝试次数、可行次数、改进次数、wall time、初始基线时间是否包含。

单独调用：

```js
import {solveStrongSearch} from '../src/strong-baseline.js';
const strong = solveStrongSearch(scenario, {seed: 42, restartCount: 12, iterations: 80});
```

该单独调用会自行计算4个初始基线，其runtime包含初始基线时间。`solveScenario`已经算过四个基线后传入`initialPolicies`，此时strongSearch runtime不重复计入它们，metadata中`includesInitialPolicyRuntime=false`。要做公平计算成本报告，应使用逐策略外部wall-clock计时并说明GLPK初始化是否包含，**不得称MILP两秒与强基准固定92次候选为相同CPU预算**。

`solveScenario`默认包含strongSearch；传`strongSearch:false`可跳过。失败状态、null费用、不将失败视为不可行证明的规则与V1一致。

## 单目标消融与平局处理

`options.objectiveMode`优先于`scenario.objectiveMode`，默认joint。storageOnly只在主目标中考虑规划后的PNC费用；ddOnly只考虑规划后的DD费用。返回的`storageCost/ddCost/totalCost/incrementalCost`**始终重新计算全部费用**。`objectiveCost`是指定目标口径。

只优化一种费用时，许多同样最优的解可能拥有不同的另一费用；任由求解器选取极差平局会夸大联合优化贡献。因此默认使用两阶段词典序求解：

1. 在指定预算内求主目标。
2. 仅当主目标被证明最优、且原预算仍有剩余时，约束主目标维持最优值（数值容差1e−6韩元），再最小化联合费用。**第二阶段使用原预算的剩余时间，不重新获得完整预算。**

`tieBreakStatus`：`optimal`代表完成第二阶段最优；`feasible_only`有第二阶段可行解但未证其最优；`not_run_budget`无剩余预算；`primary_not_proven`第一阶段未证最优；`no_secondary_incumbent`第二阶段没有返回可行整数解；`not_applicable`为joint；`disabled`为显式`lexicographic:false`。未完成最优平局处理的单目标结果不得用于严格的联合贡献归因。

MILP超时只返回完整且审计通过的可行整数解，否则没有rows、费用为null。没有返回解并不等于证明不可行。状态`optimal`在单目标下指主目标最优，还必须结合tieBreakStatus解释联合费用。

## 新增验证

`node --test tests/engine.test.mjs tests/v2-engine.test.mjs`共13组测试通过。V2新增独立穷举oracle：重新实现日历、可选费率、同日/翌日、TEU场地与全部容量检查，枚举小实例全部p/u/r组合，分别核对joint与两个词典序单目标。另覆盖手工费用算例、同日双运输/零跨日库存边界、种子确定性、强基准改善、非法参数和假设警告，以及优化器无可行解时的完整方案选择。默认V1的7组测试保持通过。

默认示例seed=42、12箱在一次验证中：最佳简单基线增量费用2,453,250韩元，强基准2,368,250，MILP2,309,600。这个例子只验证算法机制，正式结论应来自预先冻结的全样本基准并包含失败、超时、零改善和大规模案例；不得用它替代正式评估。

## 工作台推荐与求解器失败

`solveScenario`增加`recommendedPolicy`、`fallbackUsed`、`selectionReason`，但保留每一个原始策略的结果与状态。当MILP在预算内没有可行整数解，而强基准已有完整可行方案时，工作台推荐该完整方案，不将它隐藏。候选必须完整、费用有限且再次通过约束审计；先按指定主目标，再按联合费用排序，平局优先optimized、其次strongSearch。返回方案仍标注其真实求解状态，启发式不会被改成最优。此产品修正不更改已经冻结的实验结果或超时计数。
