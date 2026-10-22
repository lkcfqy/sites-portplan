# V8 执行锁自适应重排：预固定实验协议

本文件说明 `data/protocol-v8.json` 中的预固定实验设计。2026-10-15，方法、预算、参数、生成器、执行器和审核器通过359项测试后，已冻结至 `artifacts/v8-frozen-first/`，随后启动首次144场景实验。协议原字节SHA-256为 `fa886fe62cd2fdb08097bff97e64bc20cd4fe00198c2b4b9caff9d8a7bb3deb5`。冻结属于项目内部首次输入生成前的声明，不构成外部预注册；完成状态及性能结论以最终结果和独立审核为准。

## 研究问题与边界

检验自适应选择保留、局部费用修整或重建，是否在已执行动作不可改写的条件下改善完整执行覆盖、两费和计划稳定性。日级模型保持原定义：所有订单从开始即已知，运输动作按次计量，连续卸货占用各日槽位，临时堆存为 `[pickup, return)`。未来容量变化及其私有持续时间仅属于模拟器。不能据此推断真实生产收益、动态未知订单表现或比赛名次。

全路径实验允许各策略产生不同的初始计划和执行历史，因此验证的是整套策略的最终行为。它不单独证明相同执行历史下的恢复优势；该问题应使用另行声明的同历史诊断。

## 固定场景与重复

| 面板 | 业务场景数 | 新订单生成种子 | 扰动 |
| --- | ---: | --- | --- |
| 同分布留出 | 72 | 181001–181072 | 复用 V7 的四种私有持续时间容量冲击 |
| 新压力面板 | 72 | 182001–182072 | 重复运输冲击、未预告的延长恢复、两个资源先后受损、逐日渐进恢复 |

每个面板是三种订单机制 × 两档资源 × 三种规模（24/50/100 箱）× 四个场景。每个格子的四个场景分别采用四种冲击模式；每个业务场景的基础生成种子全局唯一，不复用订单前缀。生成器 `makeScenarioV2` 保持不变，协议记录其 SHA256。压力场景没有引入未知订单，也不向规划器公布恢复时间。

每个业务场景运行三次，预固定算法种子为 29011、29023、29039。三次都保留，禁止择优。确定性方法也运行三次，作为相同输入的时间重复；这些方法不被宣称使用了随机种子。总计 **144 个业务场景、432 组场景与重复、2160 个方法 episode**。统计单位仍然是业务场景。

重复冲击在第 2、6 日揭示；延长卸货能力下降从第 3 日持续 4 日；双资源模式依次在第 2 日减少运输、第 5 日减少卸货；渐进恢复模式分别在第 3、4、5 日公布运输能力为名义能力减去向上取整的 3/5、2/5、1/5。完整事件定义及同分布模式均以 JSON 协议为准。

不按可解性、速度、费用或重复订单筛选场景。相同订单列表的指纹会在最终档案中公开，不重抽种子。

## 五种方法与时钟

固定允许的工厂注册表位于 `scripts/episode-v8.worker.mjs`，仅包含 `stableRetainV5`、`lockedRecoveryV6`、`costPolishV7`、`adaptiveV8`、`highsV8`。输入不能指定任意工厂模块路径。

所有方法串行运行，顺序按场景序号和重复序号循环轮换。每个方法 episode 新建冷 Node 进程及其 POSIX 进程组，原生库线程设为 1。父时钟从 fork 之前开始，**5000ms** 覆盖导入、工厂和原生服务启动、全部逐日决策、子进程终审、`planner.close()` 清理、终端 IPC 和父进程完整 receipt 验证。完整结果必须在期限内送达并审核通过才能进入完成计数。超时杀死整个进程组，包括 Python 后代；正常退出也对残留进程组做清理。

HiGHS 的 `planner.ready()` 在逐日模拟前调用，SciPy 启动计入父 5000ms 并单列 `startupWallMs`，不占第一个日级调用的合作式 200ms。其他工厂初始化同样包含在父时钟内。V5 的 0.2 秒是求解器内部时限，V6/V7/V8 的 200ms 是合作式调用预算，HiGHS 的日级预算包含 IPC、建模、求解与审核；**不能声称这几个日级时钟具有完全相同语义**。统一可比较的硬边界是父层整个 episode 时限。

父进程对完整结果重复运行引擎与独立费用/资源审计，并要求每箱恰好三个物理执行事件，事件日与终端日期一致、逐日完整记录存在、终审证据成立。没有终端历史的硬超时，历史、改期数和调用数为未知；不能用进度消息伪造零次调用或部分已执行历史。

## 配对分析

两个面板分别报告，不生成混合排行榜。至少比较 V8 对 V7、V5、V6、HiGHS，以及 HiGHS 对 V7。

1. 完成覆盖使用所有三次结果，报告完整 episode、全部三次完成的场景、至少一次完成的场景、逐场景平均完成率、配对完成增加与损失。未知终端历史单独列出，不能解释为已证明物理执行失败。
2. 总两费与新增费只在相同场景、相同重复都完整且通过审核的配对上比较；失败费用为 `null`。先在每个场景内平均匹配完成的重复，再对场景均值等权聚合。公开配对场景数、配对 episode 数、各场景有效重复数及两方法分母。
3. 保留按 episode 累加的原始配对总额，以便复算，但不用三次重复扩张样本数。场景等权节省百分比为 `(sum baseline scenario means - sum candidate scenario means) / sum baseline scenario means`，分母为零时百分比为 `null`。
4. 同时报告场景 win/tie/loss、零基线数、最坏损失、所有费用恶化的场景和 episode、完成 gain/loss、可观察改期与调用数。未知计数保持未知。
5. 预固定种子 700001、2000 次场景聚类 bootstrap。每次重抽完整业务场景，保留其中的全部匹配重复，生成配对场景均值节省和加权节省百分比的 95% percentile 区间。完成率差在全部场景上同样按场景重抽。费用区间条件于共同完成集合，不能消除选择性完成偏差。
6. 每一对方法拥有自己的共同完成集合，禁止跨不同分母将方法排成统一名次。

`incrementalCost` 是两费减去模型开始前沉没费用，不是 V8 相对旧版的费用增量；策略差额由配对字段另算。手工 fixture 仅验证实现和边界，不进入业务效果统计。

## 冻结、执行和首次结果保护

开发与验证完成后，先审核工厂实现、预算、协议和统计规则，再显式冻结。冻结动作只保存协议、全部源文件哈希和源快照，不生成订单。正式运行启动时要求实时源码、源快照与冻结哈希全部匹配；每个 worker 始终从冻结目录的 `source/scripts/episode-v8.worker.mjs` 启动，原生 Python 服务也随其引用冻结快照。父层定时器记录真实触发时刻 `actualCutoffMs`，不把延迟触发伪装成恰好 5000ms；进程退出耗时另列。

```bash
# 只检查协议和纯场景元数据；不生成订单、不运行算法。
node scripts/benchmark-v8.mjs --inspect

# 手工 fixture 测试；不生成留出场景。
node --test tests/benchmark-v8.test.mjs

# 原生工厂集成 smoke：仅手工 1 箱输入，约数秒，避免与正式计时争 CPU。
PORTPLAN_V8_FACTORY_SMOKE=1 node --test tests/benchmark-v8.test.mjs

# 以下两步已用于首次实验；不要在已有目录重跑或覆盖。
node scripts/benchmark-v8.mjs --freeze --output artifacts/v8-frozen-first
node scripts/benchmark-v8.mjs --run --frozen artifacts/v8-frozen-first

# 发布版可能增加审核/材料代码；从恢复后的冻结源码运行，首次结果保持原样。
python3 scripts/restore-evidence-v8.py
node data/evidence-v8/v8-frozen-first/source/scripts/benchmark-v8.mjs --run --frozen data/evidence-v8/v8-frozen-first --output artifacts/v8-reproduction-01
```

无参数不会自动运行留出。输出目录必须不存在，不覆盖已有首次结果。不提供隐式断点续跑：中断的 ledger 与完成的 episode 保留，新的运行另设目录并披露。冻结之后的源码或协议修改会被拒绝，必须使用新冻结版本，且不能将改版后的结果替代首次记录。

## 产物格式与审核入口

冻结目录保存 `manifest.json` 和 `source/`。manifest 包含协议原文、协议 SHA256、实现 SHA256、144 个场景纯元数据、冻结时间和机器信息。

每个运行目录默认位于冻结目录下的 `first-run/`：

| 路径 | 内容 |
| --- | --- |
| `run.json` | 初始不可覆盖的运行配置与机器、协议、源码信息；它只记录起始状态 |
| `inputs/{caseId}.json` | `{config, nominalScenario, events}`，每业务场景一份完整输入 |
| `episodes/{caseId}--a{repeatIndex}--{method}.json` | `{episodeId, caseId, scenarioId, panel, repeat, repeatIndex, algorithmSeed, method, result}` |
| `episodes.ndjson` | 逐 episode 追加的轻量 receipt ledger，包含完整 episode 文件路径及 SHA256 |
| `run.checkpoint.json` | 每次完整方法重复后更新的轻量索引及分面板汇总；中断时可检查 |
| `complete.json` | 全部运行完毕后独占写入的最终索引、重复订单披露、汇总和完成时间 |

最终索引 `cases[].inputArtifact` 引用并哈希输入；`cases[].repeats[].policies[method].artifact` 引用并哈希完整 episode。轻量 receipt 使用 `scalarReceipt:true` 和 `terminalRowCount`，不伪造 `rows` 数组，不替代完整证据。

完整 `result` 沿用滚动 episode 结构，保留完整 `timeline`、逐日 `observationHash/observedEvents/decisions/state/revisions/executedEvents`、最终 `rows`、终审和费用、`plannerTrace`、失败原因与父层时间 receipt。压缩只作用于重复缓存价格与调试模型对象，保留自适应决策解释及完整前后日期证明。

评审应从输入文件与完整 episode 独立重算日期、费用、资源、因果信息和统计。最终索引只是检查入口，不能单独替代输入与原始物理历史审核。每个运行同时记录 Node、操作系统、CPU 型号、宿主逻辑核数、内存和 cgroup CPU/内存限制；宿主逻辑核数不等于容器 CPU 配额。

## 验收与结果入口

正式运行前已完成最终算法、HiGHS适配、手工五方法冷执行、native ready/close、父预算、独立Python正反例审核和协议检查。正式结果将由 `data/v8-results.json` 指向保留全部输入、原始episode和冻结源码的索引，`data/review-v8.json`记录逐条独立核验；没有完整有效结果时不生成改善主张。比赛排名、真实企业收益和参赛者本人理解不属于本实验能证明的事项。
