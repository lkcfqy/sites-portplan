# V8 原生 HiGHS 对照方法

这是用于同港口日模型比较的原生求解器基线，不是新的业务数据、第三方认证或完整滚动策略的最优性证明。实现位于 `scripts/highs-service-v8.py` 与 `scripts/highs-planner-v8.mjs`，所有既有 V1—V7 源码和证据保持独立。

## 冻结接口与参数

```js
import {createHiGHSPlanner} from './scripts/highs-planner-v8.mjs';
const planner = createHiGHSPlanner({timeBudgetMs: 200});
try {
  const startup = await planner.ready();
  // 必须把 ready 的启动墙钟纳入各方法相同的整 episode 硬预算。
  const candidate = await planner(observedScenario, {
    objectiveMode: 'joint', minEventDay: today, fixedEvents: executedHistory,
  });
} finally {
  await planner.close();
}
```

每个顺序执行的 episode 创建一个实例和一个 Python 子进程；`ready()` 在 SciPy 完整加载后返回，并报告启动墙钟、进程 ID 及 Python/SciPy/NumPy 版本。重复 `ready()` 不会启动第二个进程。`close()` 可重复调用，结束进程并清理所有等待的 IPC 调用。适配器只由 Node 实验执行器导入，不能从浏览器的 `src/` 模块导入。

冻结默认配置：每决策目标 200ms、审核预留 2ms、一个 HiGHS 线程、原生随机种子 0、presolve 开启、相对 gap 目标 0、不进行第二目标求解、每次都尝试重优化；已通过本次观察审计的旧计划可作无新 incumbent 时的 fallback。所有参数在正式留出实验前确定，不根据正式留出结果调整。

共同 episode 硬预算应覆盖 worker 创建、模块导入、`ready()`、全部逐日调用、终检、IPC 与结束回执。`ready()` 的启动成本不在之后每个 200ms 调用内重复扣除，但不能从共同 episode 预算中删除。未显式调用 `ready()` 时，lazy 冷启动计入首次调用自身预算。

`options.timeBudgetMs` 优先于 `options.timeLimitSeconds * 1000`，否则使用默认 200ms。只支持 `joint` 增量两费；不接受 fractional-KRW 目标，不舍入费用。货币目标和其完整上界均须处于 JavaScript 安全整数范围。所有执行锁必须为 `minEventDay` 之前的真实已执行日期，未执行事件不得放回过去。

## 独立模型

Python 从 JSON 场景重新建立时间索引整数模型，不读取或复制 JavaScript/GLPK 系数矩阵。基础日期解析、公开费率逐日枚举和复核复用内部独立实现 `scripts/certify-v4.py`。

对箱 i 和合法日期 d，设提箱、开始卸货、还空的二元变量分别为 P(i,d)、U(i,d)、R(i,d)。每种事件恰好发生一次。变量日期域纳入 release、卸货完成 due、horizon、returnLag，以及执行锁和最早未执行日；单箱先后边界传播只删除不可能参与合法 trip 的日期。

对每箱、每个日期切点 d：

- 截至 d 的卸货开始总数，不超过截至 d 的提箱总数。
- 截至 d 的还空总数，不超过截至 d − (unloadDays − 1 + returnLagDays) 的卸货开始总数。

对于整数且恰好一次的事件，这些累计约束准确表达 `pickup <= unload` 与 `return >= unload + unloadDays − 1 + returnLagDays`。累计形式比只比较日期期望的约束更强，不增加任何未来信息。

每日资源约束独立重建：

- **运输**：当天 P 与 R 的总和。即使同日提还，也产生两次运输。
- **卸货**：开始于 u 的箱占用 u 至 u + unloadDays − 1 的每一天。
- **堆存**：截至当天的累计 P 减累计 R，按 container 或 sizeFt/20 的 TEU 权重计入。它恰好对应 `[pickup, return)`，同日提还占零堆存。

全部历史日期仍在模型和审计中。已锁定开始卸货的箱，其未完成的卸货尾段不能删除、重启或缩短；已经提箱的箱在合法还空前仍占堆存。变量数量 O(NH)，避免在在线预算内先枚举 O(NH³) 完整 trip。模型生成的累计约束稀疏项规模 O(NH²)。

目标为每个箱的新增 PNC 仓储费与新增船公司 D&D 之和。前者只依赖提箱日，后者只依赖还空日，因此分别放入 P 和 R 的系数，与完整 trip 的 joint 费用相同。Python 使用首尔日期、08:00 PNC 起算、20/40ft 标准费率、声明的模式与倍率，并扣除 horizon 开始前已产生费用。固定历史的费率仍重新计入总费用，不通过删除已执行订单降低目标。

## 预算、状态与证据

Node 从输入复制之前开始用单调时钟计量，覆盖验证、cache 复核、lazy 启动（若未 ready）、序列化、IPC、Python 建模/求解/复核，以及 JavaScript 复核。跨进程使用同机器绝对 Unix 截止时刻传递剩余预算，Python 收到后转换为本地单调截止时刻；序列化、管道传输和 JSON 解析不会获得新预算。墙钟发生外部跳变时跨进程传递可能受影响，最终是否按时接受候选仍由 Node 单调时钟裁定。

Python 在建模循环中检查截止时刻；实际 HiGHS `time_limit` 是模型完成后的剩余时间，再扣 2ms 复核预留。原生限时是协作式时间限制。Node 还设声明的 250ms 额外保护宽限以终止不响应的本地进程；这段宽限不属于有效候选预算。任何超过原调用截止时间的新候选都会丢弃；若在预算内已经接受有效 cache，它可以继续作为结果。实际过期量和进程强制终止标记必须保留，不能宣称每调用绝不超过 200ms。

没有 incumbent 的 `time_limit` 是未判定，费用保持 `null`。只有 HiGHS 状态 2 或合法日期域为空的解析依据才能报告当前模型不可行；超时不转换成不可行。HiGHS 状态 0、gap、下界和原生消息保存在 `plannerMetadata.nativeCertificate`。原生状态只针对当前已知信息和执行锁模型，使用求解器数值容差；它不证明未来容量冲击下整条滚动策略最优。

所有新 incumbent 经两次独立核对：Python 重计日期、费用、每日资源和执行锁；Node 只取日期，通过现有 `rowFor` 重建标准行，再做 `auditSchedule`、`auditFrozenEvents` 及两语言费用总额精确对账。Python 提供的成本不能覆盖引擎价格。非法日期、锁变化或费用不一致返回 `audit_failed`，不作为成功。有效 cache 同样对当前容量、费率与历史重新审计。

## 验证和边界

运行 `node --test tests/highs-v8.test.mjs`。测试使用手写 fixture，包含独立穷举 tiny trip 的最小 joint 目标、混合箱型、资源关闭、已完成和正在卸货的历史、TEU、同日双运输、解析和原生不可行、fractional-KRW 拒绝、输入复制耗时、晚 incumbent 丢弃、伪造费用/日期拒绝、持久进程与清理、超时 fallback，以及完整滚动执行终检。协议 fixture 只用于适配器错误与超时测试，不能进入实验成绩。

该实现没有利用正式留出场景进行调参。基线的竞争力要通过预先冻结的同预算实验判断；模型正确、tiny 最优与原生状态可复核，不等于大规模有限时间下必有 incumbent，也不保证其完整滚动策略胜过其他方法。
