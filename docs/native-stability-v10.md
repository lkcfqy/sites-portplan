# V10：原生 HiGHS 严格费用替换与同费保留

这是独立的新适配器 `scripts/highs-planner-v10.mjs`。V1–V9、旧原生适配器和 `highs-service-v8.py` 均保持原样。新方法键为 `stableHiGHSV10`；它仍求解同一个当前观察下的原生时间索引 MILP，未增加费用、改期权重、阈值预算或新的服务端目标。

## 唯一选择规则

每次调用先把上一次实际交付的完整日期按**当前**快照重新计价、核查资源与过去事件锁。若缓存仍可行且及时审核完毕，就保留为当前 incumbent，并照旧调用原生服务。原生候选通过 Python 与 JavaScript 的物理/费用核查后：

- 没有当前有效缓存时，及时有效的原生候选按旧方法接纳。
- 有当前有效缓存时，只有 `nativeIncrementalCost < cachedIncrementalCost - 1e-6` 才替换。
- 同费、差额不超过固定 `1e-6 KRW` 或更贵时，保留缓存的完整日期。

`1e-6` 仅用于数值严格比较，固定写入实现，非可调改期价格或业务优化旋钮。当前真实原生服务只接受整数 KRW 目标；单位测试的假服务另覆盖亚微小数值边界。由于费用比较在同一当前快照、同一箱集上进行，其沉没费用相同，比较新增两费与比较完整两费的顺序一致。过去事件不允许移动。

这一规则不承诺全局最少改期、最少改变箱数或全局词典序最优。不增加任何把一次改期换算为 KRW 的任意权重。它只拒绝替换一个已经有效的方案为同费或更贵的原生提议；更便宜提议可能改动很多日期。无效缓存也不能否决合法恢复。整段滚动路径并无全局最优或未知未来可行性保证。

## 工厂 API 和预算

```js
import {createStableHiGHSPlannerV10} from './scripts/highs-planner-v10.mjs';
const planner = createStableHiGHSPlannerV10({timeBudgetMs:200});
try {
  await planner.ready(); // 必须计入同一 episode 的父进程冷启动总预算。
  const result = await planner(currentObservation, {
    minEventDay:currentDay,
    fixedEvents:executedPastEvents,
    objectiveMode:'joint',
  });
} finally {
  await planner.close();
}
```

API、配置和默认值均沿用 V8 适配器：`timeBudgetMs:200`、`auditReserveMs:2`、`initializationTimeoutMs:10000`、`hardOverrunGraceMs:250`、`pythonExecutable:'python3'`、`servicePath:null`、`retainCacheFallback:true` 和单调 `now` 回调。调用级 `timeBudgetMs` 优先于 `timeLimitSeconds × 1000`，再优先于工厂预算。工厂默认数据选项也与旧版相同。`ready({timeoutMs})` 可重复调用，复用一个服务进程；`close()` 为异步且幂等。

正式对照中 V10 与旧 `highsV8` 配置必须完全相同，`retainCacheFallback:true`。禁用该选项会与旧版一样关闭缓存回退，本轮方法比较不采用该配置。每个工厂实例仅对应一个顺序调用 episode；不允许并发决策。

每次决策同一 200 ms 协作墙钟预算包括复制输入、校验、当前缓存重价/审核、服务初始化（若未预热）、序列化与 IPC、Python 建模/求解/审核、JavaScript 重价/审核、选择和完整选择证明的构造。新候选的日期和费用证明构造完后才读最终接纳时钟，超时提议不追认。此前及时审核并接纳的缓存可以在可选原生调用晚结束时继续交付，不能因原生超时而抹掉；因此适配器实际返回时间可能超过协作日预算。保留该及时缓存不等于晚候选被接受。原生接收期限、250 ms 额外服务终止宽限、整段 5 秒冷启动父进程硬中止须按旧方法共同披露。

服务启动时间保持 `startupWallMs`，实验父进程须从创建 worker 开始累计，不能将 `ready()` 视作免费预热。新适配器不启动额外求解或额外 Python 进程。

## 选择证明与原生证书

原生回包、求解状态、下界、费用复算与时限等原字段保存在 `plannerMetadata.nativeCertificate`。旧 `stages.cacheAudit`、`stages.native.audit` 和 `stages.native.independentCostsMatch` 保留。

`plannerMetadata.stabilitySelection` 提供独立重算所需的完整端点：

| 字段 | 含义 |
| --- | --- |
| `rule`、`feeEpsilonKRW` | 固定规则及 `1e-6` 比较容差 |
| `cacheStatus`、`cacheValid` | 无缓存、有效、无效、其他 episode、回退禁用或预算未及审核 |
| `beforeDates`、`beforeFees` | 上一次真正交付的全箱日期及其在当前快照下可重建的费用 |
| `proposalDates`、`proposalFees` | 原生完整复制日期及可重建费用；日期即使审核失败也保留，不表示已接纳 |
| `afterDates`、`afterFees` | 本次最终交付的完整日期和费用；无有效计划时为 null |
| `nativeCostMinusCacheKRW` | 当前有效缓存与有效提议之间的费用差，负数表示提议较低 |
| `cacheCostMinusSelectedKRW` | 当前有效缓存减最终方案的费用差 |
| `changedEventCount` | 有效缓存到最终方案的提/卸/还事件改动数；无有效参考时为 null |
| `proposalChangedEventCount` | 有效缓存到原生提议的事件改动数，不等于实际接受的改期 |
| `decisionReason`、`selectedSource` | 严格降费替换、同费保留、较贵保留、无缓存初始化、无效缓存恢复等最终选择理由 |
| `cacheGate` | 审核完毕、完整选择证明构造完毕及及时接纳的相对时间 |
| `nativeGate` | 接收、复制、审核、费用核对、完整选择证明构造及及时接纳的相对时间，以及 outcome |

所有 `AtMs` 以本次调用开始为零。阶段未到达或候选未接纳时为 null。`nativeGate.acceptedAtMs` 只有真正被选中的及时原生提议才有值；同费提议不接受，因此保持 null。`cacheGate.acceptedAtMs` 记录此前保留方案及时接纳的时刻，即使后续原生迟到也可核对。`strictReplacementCount` 和 `tieRetainedCount` 为工厂累计计数，只在该选择及时完成时增加。

失败结果保持旧版完整空值形状：`rows:[]`，完整两费、新增费、沉没费用、目标费用及迟到数均为 null，完整原生回包及拒绝原因仍保留。被保留缓存的状态为 `feasible` 和 `retained_audited_incumbent_not_reoptimized`，不因为未采用的原生回包声称 optimal 就将保留方案升级为最优。

## 定向验证

```sh
node --test tests/highs-v10.test.mjs
```

测试使用旧版独立 Python 假服务，覆盖同费却改日期、严格降费、较贵候选、固定微小容差、当前费率重价、容量失效、过去锁/费用伪造、复制和最终选择超时、返回结果篡改不污染缓存、就绪/关闭接口。另有少量真实原生成功与 40 英尺持续卸货的物理和双语言费用核对。它们只是定向小实例测试，不是大规模开发或正式新面板成绩。

本模块不接受未来隐藏冲击，不改变订单生成器或旧实验。方法冻结后仍需新验证与独立复核，实际结果可能在完成、费用和改期上互有得失。
