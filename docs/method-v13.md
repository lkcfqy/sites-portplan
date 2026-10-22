# V13：严格省费替换也检查明日必要卸货负荷

V13 是有限开发候选，独立保存在 `scripts/highs-planner-v13.mjs`，导出 `createGuardedCommitmentHiGHSPlannerV13`，策略名为 `guardedHiGHSV13`。它复制 V12 生命周期，只收紧已有完整 incumbent 的严格省费替换条件；V1—V12 的冻结源码、协议、数据和分数不改写。

## 默认决策规则

所有候选先通过完整日期、公开资源、执行锁与价格重算审核。joint 新增两费比较沿用 `1e-6 KRW` 容差。

| 当前及时审核的 incumbent | 原生 proposal | V13 选择条件 |
| --- | --- | --- |
| 不存在 | 完整且及时 | 可接纳，无虚构 incumbent 对照 |
| 存在 | 严格更省费 | 两端 M 评分完整、及时且 `proposalM <= incumbentM`，最终选择也须及时 |
| 存在 | 同费 | 两端 M 评分完整、及时且 `proposalM < incumbentM`，保留 V11/V12 同费规则 |
| 存在 | 更贵 | 保留 incumbent |

严格更省费但 M 升高，或任何评分不完整、发生错误、超过截止时刻，均保留已及时审核的 incumbent。保护同样适用于本次快速构造出的完整方案，不能因 `cacheValid=false` 而被更贵或未通过 M 审查的 native 覆盖。失效旧缓存没有否决权；若构造和当前 native 都未及时形成完整方案，保留真实失败及 `null` 费用。

M 使用冻结的 `scoreCommitmentSlackV11`：分别将各候选今天的实际提箱、开始卸货、还空动作加入 shadow 锁，所有其余未执行事件不得早于明天。每箱独立枚举符合日期、期限、returnLag、执行锁，以及当前公开单箱资源容量的完整行程域；若该域每种行程都在明天占用卸货槽，则贡献 1。汇总所有箱得到明日必要仓库负荷下界。历史开始卸货的尾段、20/40ft 的 container/TEU 单位、同日双运输与 `[pickup, return)` 堆存均沿用已审核语义。

M 是联合可行域投影的必要下界。`M <= 公开明日容量` 不证明联合可行，也不保证未公告冲击下能恢复。公开未来供给仍是当前 snapshot 所给的名义或已公告供给，不能用事后实际容量评分。API 拒绝 `events`、`futureEvents`、`actualScenario`、`realizedScenario`、`unrevealedEvents` 等私有未来载荷。

## 预算与来源

默认整个决策调用仍为 200ms；从输入复制前开始计量，含验证、缓存审核、构造、序列化/IPC、Python 建模/求解/复核、JS 重审、M 评分和最终选择。缺少有效缓存时，构造截止为 `min(调用起点 + 40ms, 整体截止 − 5ms)`，固定 `maxRestarts=3`，沿用四种确定排序；只有真实 callback 收件在该截止内完成外层复制、审核、计价与选择才可接受。constructor 返回重复候选或内部自报时间不能倒填 receipt。

native 使用同一总截止剩余预算与 2ms 审核预留；冷 `ready()` 仍需计入共同 5 秒 episode 父预算。250ms 额外进程保护宽限不属于候选有效预算。原生求解或可选工作可能让函数返回晚于 200ms，必须保留真实墙钟和超时量；此前按时接纳的完整 incumbent 不因晚 native 消失。此方法没有声称每调用硬限 200ms，也没有改变父执行器的冷启动、退出清理和终检边界。

默认算法不按某个历史案例或箱号设分支。当前改动针对已见诊断中两个 D5 严格省费后 M 恶化的业务场景（三次重复共六条原始记录）提出假设。它不代表修复全部 11/14 类损失，不证明新场景优势，也不代表已通过默认替换验收。

## 审核字段

`plannerMetadata.stabilitySelection` 保留 V12 的 constructor receipt、`preNativeIncumbent`、原始 proposal、选择前后完整日期/费用、公开容量及 `nativeGate`。新增 `strictFeeGuard`：

- 输入：`incumbentSource`、`incumbentDates`、`incumbentFees`、`proposalDates`、`proposalFees`。
- 评分：`incumbentM`、`proposalM`、`selectedM`、`complete`、`timely`、`error`；完整逐箱域、shadow 锁和计数位于同层 `commitmentScore.cache/proposal`。
- 时刻：`scoringStartedAtMs`、`scoringFinishedAtMs`、`comparisonFinishedAtMs`、`acceptedAtMs`、`rejectedAtMs`，均相对该次 planner 调用起点。
- 裁定：`attempted`、`eligible`、`decision`、`reason`。只有最终 gate 内实际接纳后才写 `decision=accepted`，增加 `strictReplacementCount` 并把 `selectedM` 改成 proposal 值。

典型接受原因为 `no_mandatory_load_increase`；拒绝原因为 `mandatory_load_increase`、`incomplete_score`、`scoring_error` 或最终 `late_selection`。晚评分不能把选中缓存的 M、日期、费用和计数改写成被拒绝 proposal 的值。非严格省费分支的 guard 明确 `attempted=false`，不把未计算的 M 当作 0。

## 显式开发重放导入

默认禁止端点导入。受控已见案例实验必须显式配置：

```js
const planner = createGuardedCommitmentHiGHSPlannerV13({
  enableDevelopmentEndpointImport: true,
});
await planner.ready(); // 纳入共同冷 episode 预算
const forcedStepStarted = performance.now();
const receipt = planner.importDevelopmentEndpoint(publicSnapshot, endpointDates, {
  fixedEvents, minEventDay: 5, objectiveMode: 'joint',
  deadlineMs: forcedStepStarted + 200,
});
```

`importDevelopmentEndpoint` 是同步、一次性开发 API，仅允许 open/idle 且 `decisionCalls=solverCalls=0` 的 factory；一次失败也消耗该次导入机会。它使用 factory 的同一时钟，不能换一个时钟重置截止。完整复制、日期/费用/锁/资源审核和 proof 复制全部通过最终 deadline 判定后，才原子写入缓存、exact episode key 与 `lastDay`。它不启动求解、不计决策、不执行物理动作、不称为 native 发现，也不用于默认算法或新样本自然初始化。

receipt 有绝对 `startedAtMs/deadlineMs`，以及相对起点的 `receivedAtMs`、`copiedAtMs`、`validatedAtMs`、`auditFinishedAtMs`、`proofFinishedAtMs`、`acceptedAtMs/rejectedAtMs`；并保留完整 public snapshot、源日期、精确原锁、canonical 日期、重算费用与审核结果。harness 应绑定这些输入和 receipt 的 SHA，并核对 `startedAtMs + acceptedAtMs <= forcedStepStarted + 200`。D5 强制候选的重建、审核、导入和 callback 交付共用该截止；交付后的模拟器外层复制、审核和日级原子动作不属于这个 200ms 指标，仍与 ready、后续执行、终检、IPC 和进程清理共同计入冷 5 秒父预算。

失败或晚导入不改变缓存和决策计数。返回 receipt 与私有 cache/proof 隔离，特殊箱号使用自身属性语义；D6 正常规划重新审核当前观察和执行锁。不能用 fake native priming 替代这条明确标注的受控导入记录。

## 定向验证

`node --test tests/highs-v13.test.mjs` 运行手写 mock-service 与 fakeclock 测试，覆盖严格更省且 M 下降/相同、M 升高拒绝、同费规则、无 incumbent、构造来源、评分不完整/异常/晚完成、失效缓存、伪造价格/执行锁、特殊箱号，以及导入默认禁用/一次性/迟到原子性/不污染后续缓存/继承锁隔离。该套测试不启动实际 HiGHS 或新的 benchmark，不构成新留出实验或完整路径收益证据。
