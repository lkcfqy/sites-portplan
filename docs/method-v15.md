# V15：原预算内的原生返回预留候选

V15 是待开发验证的 `timelyHiGHSV15`。它以冻结 V12 为经济接受主干，只给原生服务返回和外层审计预留固定 **10ms**，不增加每日 200ms 合作预算，也不改变冷父进程 5 秒完整生命周期。它没有沿用 V13 的严格省费 M 硬守卫，没有新增未来预测或资源风险指标，当前没有真实原生运行结果。

模块为 [highs-planner-v15.mjs](../scripts/highs-planner-v15.mjs)，导出 `createTimelySeededHiGHSPlannerV15(configuration={})`，返回异步 `planner(publicSnapshot, callOptions)`，并保留 `ready()`、`close()`。方法 ID 为 `timelyHiGHSV15`。`nativeReturnReserveMs` 工厂配置只允许固定值 10，不能逐调用覆盖或在本轮试多个值选择好结果。测试允许注入现有的 `now`、构造器和服务路径，但正式/受控开发运行器必须采用冻结配置及真实原生服务。

## 唯一策略差异

同一次调用的原始开始时刻为 `started`，预算为 `budget`：

```text
wholeDeadline = started + budget
nativeDeadline = wholeDeadline - 10ms

默认 budget = 200ms：
nativeReturnTarget = 190ms（传给原生服务的合作目标）
outerAcceptanceDeadline = 200ms（完整审计、费用匹配、选择与原子接纳）
```

克隆、输入校验、缓存审计和构造阶段先消耗同一时钟；`ready` 等待、序列化、IPC、Python 建模、求解和独立审计使用较早的原生截止，没有获得新的完整 190ms。Python 内部原 `auditReserveMs=2` 不变，10ms 也不外加在 200ms 之后。

跨进程时间转换先采 `Date.now()`，紧接采单调时钟；`remaining=nativeDeadline−laterMonotonicSample`，请求的绝对 Unix 截止为 `earlierUnixSample+remaining`。两次采样之间若被抢占，只能保守缩短服务余时，不能把旧余时加到较晚墙钟上向后推迟截止。序列化完成和实际发送前再次检查较早截止；余时不足时不发送请求，保留已有及时完整解或如实失败。

**190ms 是返回目标，不是新增接纳门槛。** 若原生在 195ms 才返回，但复制、完整物理/锁/费用审计和最终选择全在原 200ms 内完成，仍按 V12 经济规则接纳，同时保留“原生返回目标未达”与服务超时量。若在 200ms 之后才完成审计或最终选择，不能追认；已有及时解继续保留，没有及时解则费用为 null，迟到原始候选及证据仍保存。合作预算不保证函数在 200ms 内硬返回。

异常原生等待的 hard-kill 仍按外层 `wholeDeadline + hardOverrunGraceMs`（默认 200+250ms）安排，只用于故障清理，不延长候选接纳时间。完整 episode 必须仍由原冷父进程契约在 5 秒内完成启动、所有调用、终审、正常退出、ESRCH 进程组消失确认和最终父接纳。V15 模块本身不能代替父生命周期审核。

## 保留的 V12 行为

- 当前完整缓存每次重新价格和全模型审计；实例或日期倒退时重置，实际执行锁严格早于当前日，候选不得改写已执行动作。
- 无有效初解时，原构造阶段仍是前 40ms 上限、审计预留 5ms、`maxRestarts=3`；只有同步实际交付且完成外层审计/选择的完整候选可接纳，构造返回值和自报发现时间不补票。
- 严格省费候选仍直接按 V12 的费用规则接受，即使其明日必要仓负荷 M 增加。只有同费时才沿用原 V11/V12 完整及时的 M 严格下降规则；不发明风险概率，不将较低 M 称作未来可恢复证明。
- 物理、日期、资源、历史锁和两语言费用核对，以及 `1e-6` 费用容差、所有拒绝和迟到记录均保留。
- 规划器只接收当天公开快照与真实执行锁，拒绝未来私人事件载荷。它没有开发端点/历史缓存导入接口。

冻结 V12 源 SHA 为 `aa7a320e1916f6c157b2eed7ebad7eb2ad06c83bc6cea6743e1e45ca5e3285e4`；共用、未修改的 [highs-service-v8.py](../scripts/highs-service-v8.py) SHA 为 `2e216ce22c820d1aa718b9ba6511ee661dd588504f3f0e6def2b77ce98eedb02`。V1–V14 的算法、协议、原始结果与分数均保持原字节。

## 可独立核对的元数据

`plannerMetadata.deliveryBudget` 的 schema 为 `portplan-v15-native-return-budget`。除 Unix 字段外，下表时间均相对该次调用开始：

| 字段 | 含义 |
| --- | --- |
| `wholeDeadlineAtMs` / `outerAcceptanceDeadlineAtMs` | 原始完整接纳截止，默认 200 |
| `nativeDeadlineAtMs` / `nativeReturnTargetAtMs` | 服务提前返回目标，默认 190 |
| `nativeReturnReserveMs` / `serviceAuditReserveMs` | 固定工程预留 10 / 原 Python 内部预留 2 |
| `nativeRequestStartedAtMs` / `readyFinishedAtMs` | 请求开始与 ready 等待完成后的时刻 |
| `requestUnixNowMs` / `requestClockSampleAtMs` | 先采的 Unix 墙钟和后采的单调时刻 |
| `remainingAtServiceReadyMs` / `nativeDeadlineUnixMs` | 从原生截止扣除已耗时间的余时 / 实际请求 Unix 截止 |
| `serializationFinishedAtMs` / `preSendCheckedAtMs` | 序列化完成 / 发送前再次核验时刻 |
| `requestSentAtMs` / `serviceRequestDispatched` | 实际发送时刻及是否真的发出；未发送时刻为 null |
| `requestStatus` | 未请求、较早预算在哪个阶段耗尽，或已发送 |
| `actualServiceResponse` | 仅真实 pending 请求 ID 的 Python `result` 收包回调置 true；不是“请求已发送”或“等待已结束” |
| `requestSettledAtMs` / `requestSettlement` | 请求等待结算时刻及真实回包、hard timeout、service error 或未发送的区别 |
| `nativeResponseReceivedAtMs` / `nativeReturnTargetMet` | 实际已发送请求的响应时刻 / 是否达到较早返回目标；未发送时为 null |

原 `stabilitySelection.nativeGate` 继续保存接收、复制、审计、费用核对、选择、接纳/拒绝时刻；其中 `receivedAtMs` 沿用 V12 的等待结算语义，也可能是硬超时合成或服务异常。它等于 `requestSettledAtMs`，不能据此认定收到 Python 回包。只有 `actualServiceResponse=true` 时 `nativeResponseReceivedAtMs` 和 `nativeReturnTargetMet` 才有实际值；已发送但因 hard timeout、进程退出、坏 JSON 或管道错误结算时，两者仍为 null，不能把未知响应当成 0ms、目标命中或目标未达。请求结算/硬超时即关闭响应证据写入，迟到回调不得重新提升已结算的标记；交付的 `deliveryBudget` 是独立快照，后续回调或 `close()` 不改写它。完整 `nativeCertificate` 保留原生状态、费用、行、模型/求解/审计时长与其相对较早截止的超时量。原缓存、构造和同费 M 证据不精简成成功标志。内部时间和 OS 回执不是外部认证时钟。

## 当前验证与可反证范围

[highs-v15.test.mjs](../tests/highs-v15.test.mjs) 的定向测试只启动手写 JSON 服务夹具，不载入 SciPy/HiGHS，不优化、不生成场景。它核对实际 wire 截止、两时钟采样间抢占的保守转换、195ms 目标未达但外层及时接纳、超过 200ms 拒绝及及时缓存保留、序列化跨越较早截止时不发送、V12 严格省费/同费 M/构造行为、执行锁/费用伪造/未来载荷拒绝和实例隔离。真实夹具进程退出、坏 JSON 和硬超时测试另核对“已发送但未收到响应”的 null 语义；硬超时夹具使用较小测试预算，不改实验预算。旧 V12 和 Python 服务 SHA 也直接断言不变。模拟时间不构成真实性能证据。

后续仅可按另行声明的协议，对已见 V14 四个损失场景及其原三次重复进行受控开发，保留 V12/V13 负控和全部首次失败。n100-r4 的 D3 同前缀端点尤其适合检验“完整候选及时交付”假设；从失败日冷缓存启动的分支必须与自然 D0 全路径区分，不能称恢复了原自然运行的耗时状态。三次时钟重复不能扩为三个独立业务场景，不计算或暗示新留出置信区间。

固定 10ms 是预先声明的工程假设，**可能缩短有效求解时间、降低候选覆盖或使费用/完整路径更差**。当前没有运行该开发实验，也未证明能修复 D3 迟到，更没有证据能修复另外七条原生报告当前前缀无解的记录。开发之后仍须保留所有负例，候选若不获支持便如实失败，不调参补跑美化；任何未来新场景正式实验都需另行冻结与预注册。公开资料路线不要求企业私有订单，当前也不声称实单 ROI、生产默认通过或竞赛名次。
