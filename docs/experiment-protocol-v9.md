# V9 及时候选交付实验协议

本文件解释 `data/protocol-v9.json` 与新 runner；不是实验结果。V8 首次 144 场景、2,160 episodes、负结果和发布材料保持原样。此前 V8 的场景与种子只能用于 V9 开发回归，不能再次称为新的留出验证。

## 固定方法和预算

方法按固定 allow-list 注册，不能由输入传入模块路径：

| ID | 工厂 |
| --- | --- |
| stableRetainV5 | 原 `createStablePlanner` |
| costPolishV7 | 原 `createCostRecoveryPlanner` |
| adaptiveV8 | 原 `createAdaptivePlanner` |
| adaptiveV9 | `createAdaptivePlannerV9` |
| highsV8 | 原原生 `createHiGHSPlanner` |

省略 V6，使总成本仍为 144 × 3 × 5 = 2,160 个冷启动 episode。所有旧方法继续使用 V8 协议中的工厂和调用参数；V9 的固定参数与 V8 相同，包括 200 ms 日调用预算、0.5% 费用容忍、最多 6 项待执行事件变更、2 日压力视窗和启用压力保护。不能根据新留出结果挑选日预算。

每 episode 从父进程 fork 前开始计时，5,000 ms 内必须送达并由父进程完成终态审核。计时包括冷启动、模块加载、原生 Python/SciPy ready、全部滚动决策、终态双重审核、原生进程关闭、IPC 和父审核。原生线程固定为 1。episode 及原生子进程置于独立 POSIX process group，超时或退出时清理整组。

V5 使用旧 solver-internal seconds；其余使用合作式 whole-call 毫秒预算。这两类日调用时钟不宣称完全相同。父进程的 5 秒端到端规则对五种方法相同。

## 候选交付证据

本轮修复是内部构造器同步 `onCandidate` 到外层 gate。gate 应在及时检查前完成复制、按原始当前观测重建日期费用、资源审核和执行锁审核，再保留 incumbent。内部构造器的 `firstIncumbentMs` 不能替代外层 gate 接纳时刻。

正式实验不开启 diagnostic `onIncumbent` observer，不增加候选 IPC 流，不将父进程 enqueue acknowledgement 引入日候选接纳条件。原有终态 IPC 与 5 秒父审核继续负责完整 episode 的完成判断。

完整的 `result.plannerTrace[day].candidateDelivery` 原样保留，不受 debug compaction 的 128 项数组或重复 rows 限制；记录 gate 的 timing、日期、费用证明以及拒绝/接纳结果。构造器诊断不等于执行证据。若未在父时限内收到有效终态，顶层费用、修订计数和物理历史保持 null/unavailable。

父进程若收到不合法、身份错误、重复或迟到的 terminal receipt，会在 `unacceptedTerminalReceipts` 保留完整原消息、接收/审核时刻和原因。该字段是未接纳原始证据，不作为已发生的物理执行或完整费用。

## 新输入与重复

两个面板分别有 72 个业务场景，各为：

- 3 类机制：aged-backlog、new-arrivals、batch-release；
- 2 类容量：balanced、tight；
- 24、50、100 个箱；
- 每个组合 4 个业务种子及预声明冲击模式。

same-distribution 使用 391001–391072；stress 使用 392001–392072。生成器 `makeScenarioV2` 及其 SHA256 不变。所有初始订单仍在开始时已知。恢复持续时间只有模拟器知道，规划器只收到当日当前公开观测；不能披露未公告的未来容量或持续时间。冲击表完全继承 V8 两面板定义，故新结果检验的是新种子上的同一类假设，不扩大到真实业务总体。

算法/时钟重复固定为 39011、39023、39039。原生 HiGHS 的内部 RNG 仍固定为 0，因此这些是原生计时重复，而不是三个独立原生随机算法种子。方法执行顺序随场景序号和重复序号循环。各方法串行运行，避免同一基准同时占用 CPU。

## 冻结和执行

`--inspect` 只展开 metadata，不生成订单。完成算法、审计和测试后，由 root 授权冻结：

```sh
node scripts/benchmark-v9.mjs --freeze --output artifacts/v9-frozen-first
node scripts/benchmark-v9.mjs --run --frozen artifacts/v9-frozen-first
```

冻结会 SHA256 绑定全部 src/scripts 的 JS/MJS/Python、package/lock 与 V2/V8/V9 协议，并逐文件复制到 `source/`。冻结本身不生成新的订单。执行前校验 live source、冻结 snapshot、协议字节和纯 metadata expansion 全部一致；订单生成器与 episode worker 都从冻结 snapshot 导入，规划器也从该 snapshot 取工厂。

每个输入和完整 episode 独立保存，index 只保留带 SHA256 的 scalar receipt。文件 exclusive 创建；首次结果不能被覆盖。每次算法重复后保存 checkpoint 和 append-only NDJSON。终态 `complete.json` 只在全部 2,160 episodes 都记录后生成。重复订单指纹只披露，不重新采样。

## 分析与边界

两个面板分开报告，不能合并成排行榜。业务场景是统计单位，三次重复不是三个新业务样本。完成率使用全部预声明 repeats；条件费用只使用同一场景、同一重复下双方都及时完成的配对，再在场景内求均值，让每个有配对的场景权重相同。各比较拥有不同分母，不能跨分母排名。

固定比较键为 `v9VsV8`、`v9VsV7`、`v9VsV5`、`v9VsHiGHS`、`highsVsV7`。保留所有完成增益/损失、未知历史、零费用分母、负节省、最差损失、修订和逐场景结果。未完成费用保持 null。

置信区间沿用 seed 700001、LCG、2,000 次整场景 cluster bootstrap 与线性 percentile quantile；不改统计抽样规则。费用区间条件于双方完成配对，不消除完成选择偏差。另由独立 Python 物理/费用 ledger 与 bootstrap 复算核验。

完整路径实验允许各方法初始方案不同，不能隔离共同执行前缀下的恢复能力。结论只限合成、已知订单、每日原子化资源模型；原生 HiGHS 是同模型参考，不构成真实业务节省或夺冠保证。

