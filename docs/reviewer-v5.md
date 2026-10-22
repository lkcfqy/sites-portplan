# V5 独立账本复核结论 · 2026-10-13

完整归档的只读第二实现复核通过，机器结果见 [`data/review-v5.json`](../data/review-v5.json)。纯标准库 reviewer 不运行求解器，也不导入主实现：重新核对 36 个静态主案例的 108 条方法记录、6 个同输入控制的 18 条记录、24 个滚动案例的 48 条记录。逐箱重算 81 个主实验完整方案、13 个控制完整方案和 32 个滚动完整执行，并检查 483 个逐日轨迹项。缺失、超时、失败和不利成本结果均未从分母中移除。

## 覆盖和证明口径

1 秒静态主实验的完整可行方案为 rawMILP 24/36、v4EventSearch 27/36、fastEvent 30/36。rawMILP 的 24 个最优标签都带完整审计方案并在父进程截止前送达；后两者仍是启发式。复核检查所有截止、最终 receipt、保留 checkpoint 标签和三组配对汇总，没有把迟到求解证明当成及时结果。

独立 Python/HiGHS 以额外验证预算核验 42 条案例记录、94 个完整候选，均无费用或模型矛盾。分类必须保留：

| 组别 | 独立最优 | 独立不可行 | 可行且有下界，未证明最优 |
| --- | ---: | ---: | ---: |
| 36 个主案例 | 31 | 1 | 4 |
| 6 个同输入预算控制 | 5 | 0 | 1 |

没有遗漏或 `no_certificate`；这不表示所有案例都最优。42 包含 6 个同输入控制，不是 42 个独立场景。控制的 scenario 已逐字段与其 `referenceCaseId` 对应主输入核对完全一致，原箱号和情景 ID 均保留；主实验及控制分别汇总。

## 稳定计划的费用与分母

两种滚动策略各完成 16/24 个案例，各失败 8 个；没有新增/失去完成案例，首次计划也没有日期差异。费用只在共同完成的同一 16 个 episode 上配对。

| 配对口径 | dailyReopt | stableRetain | 稳定策略额外费用 |
| --- | ---: | ---: | ---: |
| 累计总费用 KRW | 42,928,550 | 42,931,750 | +3,200（+0.007454%） |
| 规划后增量费用 KRW | 25,105,050 | 25,108,250 | +3,200（+0.012746%） |

两个百分比的分母分别为上述 daily 累计总费用和 daily 增量费用，不能互换。16 对中 5 个增量基线为零；不对这些案例单独除以零。稳定策略 1 例更便宜、14 例相同、1 例更贵，最差多 9,100 KRW。没有把失败 episode 的部分费用当成 0 加入配对。

共同完成组的待执行日期变化为 621→164，减少 73.591%；solverCalls 为 206→33。全 24 案例另列日期变化 876→194、solverCalls 242→49、稳定策略复用 192 次。复核从逐日信息、冻结历史和前一个完整日期计划重新判断稳定触发条件，检查每次及累计计数、调用墙钟时间与 revisions 的具体事件。两策略每次 solver 限时相同，但总调用次数和 episode 总工作不同，不能表述为总 CPU 预算相同。

## 输入绑定与复现

- 协议：[protocol-v5.json](../data/protocol-v5.json)，固定 SHA-256 `7cfee99b5522236c3fd70a13b4fcbf11e2273d0c0cd3dd887465608c1f1c2109`。
- 静态原始档案：[benchmark-v5.json](../data/benchmark-v5.json)，SHA-256 `d04e704749b8b93449aaa6ce8270959a52c4d9eefdb21926e37c7ff694ee754e`。
- 滚动原始档案：[rolling-v5.json](../data/rolling-v5.json)，SHA-256 `482f6f8df7f0d46cf7d8b0356961c1aaf787f5e9f1566db7e18ce7c1afa23592`。
- 原生验证：[certificate-input-v5.json](../data/certificate-input-v5.json) 与 [certificate-v5.json](../data/certificate-v5.json)。输入 SHA-256 `2da426c32bf0eebb501c8ed97af2c51a1f63e4b549415faf9fc750335e372639`，证书通过 `evidenceBindings` 再绑定原档案、协议、两组案例列表、独立实现及 wrapper 字节。
- 首轮源码：`vendor/experiments/v5-first-run-source/` 与 `vendor/experiments/v5-rolling-first-run-source/`，各自 manifest 和实验源哈希匹配。当前 `src/engine.js` 已在实验后新增可选工作台流程，字节与首轮不同；报告保留此差异，首轮统计仍归于保存的源码快照，不冒充当前产品全部路径的公平预算结果。

运行 `python scripts/review-v5.py` 复核既有档案；`node --test tests/review-v5.test.mjs` 的 9 组手工 fixture 测试通过。审核未重跑主实验，未改变任何原始结果。完整方法和审核边界见 [independent-validation-v5.md](independent-validation-v5.md)。

## 结论范围

通过意味着这些内部归档在费用、约束、因果观察、执行冻结、预算标签、计数、配对分母及输入绑定上彼此一致。仍存在 8/24 滚动失败、4 个主案例和 1 个控制的原生最优性未证明，以及稳定策略可能更贵的真实反例。

它不是第三方认证，不证明真实客户节省、合同 D&D 解释获承运人认可、日内线路/时窗可行性、真实业务总体效果或比赛名次。全部订单、容量及 shocks 均为合成数据；收费假设和日粒度简化继续适用。
