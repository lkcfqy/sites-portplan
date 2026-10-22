# V6：V5 剩余失败的离线诊断

这是既有 V5 证据的分层检查，未重跑在线策略，未改 V1–V5 原始 JSON。它复用内部独立 Python 的日费用/完整 trip 数学，并新增严格的执行锁定过滤和逐箱锁审计；不是第三方认证或新留出成绩。

复核全部 24 个滚动案例、48 个方法 episode、483 个逐日轨迹；其中 8 个案例、16 个 episode 未完成。额外诊断顺序运行 29 个去重模型，HiGHS 单线程，每模型最多 10 秒。该预算不属于归档的在线 0.2 秒成绩。

## 分层与证据

每个失败分别求解 nominal 从开始、actual 全知从开始、失败日 observed＋实际已执行历史三层模型。最后一层锁住每个已执行提箱、开始卸货、还箱日，所有未执行事件至少在失败日；历史开始的卸货仍占用其整个持续区间，不能删除过去动作或进行中的占槽来伪造恢复。

证据保留原生 status、求解消息、下界、MIP gap、完整可行 incumbent、求解及建模墙钟。空合法 trip 域的不可行是明确解析证明；其余不可行须 HiGHS status 2。不可行没有有限可行目标，bound=null 不代表费用 0。time_limit 没有 incumbent 仅是 unresolved，不能改成不可行。

| 分类 | 失败 episode 数 |
| --- | ---: |
| nominal 初始即不可行 | 6 |
| actual 全知及已执行前缀均不可行 | 8 |
| 全知可行，但已执行前缀使当时观察下不可恢复 | 2 |

按案例计，这是 **3 个初始不可行、4 个新增容量冲击后即使全知也不可行、1 个全知可行但已执行前缀不可恢复**。本轮 23 个去重不可行模型全部由原生 HiGHS `solverStatus=2` 证明，6 个去重可行模型均完成最优求解；没有把 timeout/no incumbent 当作不可行，也没有未判定结果。两策略的全部 16 个失败 episode 在其各自失败日的观察与实际历史下都已不可恢复，未发现“0.2 秒内未找到解但该历史仍可恢复”的实例。

唯一属于最后一类的是 `v5-rolling-new-arrivals-tight-n24-r2`：D+8，两策略各有 37 项已执行事件，固定日期并不相同；运输容量在 D+7、D+8 降为每日 2 次。actual 全知从开始存在完整方案，但两条已执行历史都令当时 observed 模型不可行。该结论不允许撤销历史来恢复，也不证明任何在线策略能事先知道下一日的私有冲击持续时间。

全知从开始可行，不等于已经执行某些动作后仍可恢复；全知证据也不是在线策略可使用的信息。所有事件及证书输入、每个方法的固定历史、模型哈希及完整 rows 位于 [failure-diagnosis-v6.json](../data/failure-diagnosis-v6.json)。

| 案例 / 方法 | 失败日 | nominal | actual 全知 | observed＋执行锁 |
| --- | ---: | --- | --- | --- |
| v5-rolling-aged-backlog-tight-n12-r1 / dailyReopt | 0 | proven_infeasible | proven_infeasible | proven_infeasible |
| v5-rolling-aged-backlog-tight-n12-r1 / stableRetain | 0 | proven_infeasible | proven_infeasible | proven_infeasible |
| v5-rolling-aged-backlog-tight-n12-r2 / stableRetain | 5 | proven_optimal | proven_infeasible | proven_infeasible |
| v5-rolling-aged-backlog-tight-n12-r2 / dailyReopt | 5 | proven_optimal | proven_infeasible | proven_infeasible |
| v5-rolling-aged-backlog-tight-n24-r1 / dailyReopt | 0 | proven_infeasible | proven_infeasible | proven_infeasible |
| v5-rolling-aged-backlog-tight-n24-r1 / stableRetain | 0 | proven_infeasible | proven_infeasible | proven_infeasible |
| v5-rolling-aged-backlog-tight-n24-r2 / stableRetain | 3 | proven_optimal | proven_infeasible | proven_infeasible |
| v5-rolling-aged-backlog-tight-n24-r2 / dailyReopt | 3 | proven_optimal | proven_infeasible | proven_infeasible |
| v5-rolling-new-arrivals-tight-n12-r1 / dailyReopt | 4 | proven_optimal | proven_infeasible | proven_infeasible |
| v5-rolling-new-arrivals-tight-n12-r1 / stableRetain | 4 | proven_optimal | proven_infeasible | proven_infeasible |
| v5-rolling-new-arrivals-tight-n24-r2 / stableRetain | 8 | proven_optimal | proven_optimal | proven_infeasible |
| v5-rolling-new-arrivals-tight-n24-r2 / dailyReopt | 8 | proven_optimal | proven_optimal | proven_infeasible |
| v5-rolling-batch-release-tight-n12-r1 / dailyReopt | 0 | proven_infeasible | proven_infeasible | proven_infeasible |
| v5-rolling-batch-release-tight-n12-r1 / stableRetain | 0 | proven_infeasible | proven_infeasible | proven_infeasible |
| v5-rolling-batch-release-tight-n12-r2 / stableRetain | 8 | proven_optimal | proven_infeasible | proven_infeasible |
| v5-rolling-batch-release-tight-n12-r2 / dailyReopt | 8 | proven_optimal | proven_infeasible | proven_infeasible |

## 静态 fastEvent 的六个未找到解案例

既有 V5 原生证书表明：5 个存在独立完整可行方案，1 个证明模型不可行。搜索未找到完整方案不能整体解释为订单不可行；这里复用已绑定的证书，不新增静态实验。

| 案例 | 在线状态 | 既有证书 | 目标 / KRW | 下界 / KRW |
| --- | --- | --- | ---: | ---: |
| v5-aged-backlog-tight-n16-r1 | no_feasible_schedule_found | proven_optimal | 6275200.0 | 6275199.999999994 |
| v5-aged-backlog-tight-n16-r2 | no_feasible_schedule_found | proven_infeasible | None | None |
| v5-aged-backlog-tight-n50-r1 | no_feasible_schedule_found | feasible_with_bound | 21881100.0 | 21861100.000000022 |
| v5-aged-backlog-tight-n50-r2 | no_feasible_schedule_found | proven_optimal | 20898050.0 | 20898050.0 |
| v5-aged-backlog-tight-n100-r1 | no_feasible_schedule_found | feasible_with_bound | 47493000.0 | 47448400.0 |
| v5-aged-backlog-tight-n100-r2 | no_feasible_schedule_found | feasible_with_bound | 44716150.0 | 44589150.00000001 |

## 范围与复现

运行 `python scripts/diagnose-failures-v6.py` 生成诊断；`--time-limit` 控制每个去重模型的额外预算。每个 incumbent 都复核释放、先后、截止日、容量、费用、全部执行锁和最早未执行日期。源档案哈希在前后分别核对；所有模型都保留证据状态，没有将无解返回补成 0 成本。

`node --test tests/failure-diagnosis-v6.test.mjs` 的 5 项手工 fixture 测试通过：精确历史及未执行日界、进行中卸货不能被仓库降容“抹去”、空 trip 域解析证据、非法伪历史和极短预算只能未判定。没有调用 JavaScript 模型或生成新留出种子。

全部订单、容量及冲击仍为合成。此诊断不能证明真实业务回收率、因果最优行动、线上费用节省或比赛名次；若前缀已经不可行，新恢复启发式必须如实失败。全知不可行、nominal 初始不可行和历史承诺造成的不可恢复是不同边界，不能用删历史、删箱或全知未来修补在线成绩。
