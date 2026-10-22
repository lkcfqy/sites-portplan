# V6 冷启动完整执行实验：独立复核

完整归档复核通过，机器结果见 [rolling-review-v6.json](../data/rolling-review-v6.json)。`scripts/review-rolling-v6.py` 是纯 Python 标准库，不导入 JavaScript、不运行求解器或重跑在线方法。它复用已有独立 Python 的日期/费用数学，重新审阅全部 **36 个新种子主案例＋24 个 V5 开发控制，四方法共 240 个 episode**。

核对 2,304 个逐日轨迹、2,224 个接受的完整日期计划、54,492 行终局及缓存逐箱费用、574 次声明预测。完整 episode 160 个，已知执行失败 80 个；本轮没有历史丢失或父截止未送达，但这些分支由手工 fixture 检验，不能把未知调用和动作补为 0。

## 审核内容

全部主案例由 Python 的独立 LCG/日期翻译重新生成，核对冻结种子、订单、容量、整数比例冲击及完整 method order。24 个控制与被声明的 V5 原输入和 shocks 逐字段相同，保留原箱号、原 nominal scenario；开发结果分别汇总，不视作新独立样本或并入主分母。

每个接受计划按当天可见信息重新核验覆盖、释放/先后/期限、运输、持续卸货、跨日场地及执行锁。已执行事件不得改变，未执行事件不得回到过去；当天动作须与计划完全一致，最终 rows 须与实际冻结历史相同。缓存的全部定价 rows 和完整终局费用也独立重算，失败完整费用仍为 null。

观测 checksum 只由 nominal 未知未来、实际当前/过去容量及执行历史重建。persistence 只允许把下一日供应预测取 `min(当前观察,原预测)`，逐条核对 forecastChanges；过去/当天不能改变，也不能读取私有 duration。该策略的 forecast infeasible 必须降为未找到方案，不得作为 nominal 不可行声明，forecast optimal 也不得升级为 nominal 最优。

逐日重算 retention、构造器/solver stage 是否实际启动、调用及复用累计数、日期变化身份与数量、每次/总墙钟和失败边界。所有 summary 字段，包括不利费用、增加/失去完成、零分母、缺失 pairs、各规模、最差损失和初始计划比较，均独立重算匹配。只有同信息集下完整、经审计的 day-zero 候选可比较；空、部分、未经审计或不可用的初始计划必须是不可比较的 null。

## 主实验的结果与取舍

| 方法 | 完整执行 / 36 |
| --- | ---: |
| dailyReoptV4 | 21 |
| stableRetainV5 | 23 |
| lockedRecoveryV6 | 29 |
| persistenceRecoveryV6 | 27 |

lockedRecovery 对 stable 的 23 个共同完成案例，增量费用多 **9,361,000 KRW（12.256195%）**，总费用多 6.363770%；0 例更低、13 例相同、10 例更高，最差多 5,018,050 KRW。相同配对的日期变化为 715→1,062。它增加 6 个完整执行且没有失去完成，但提高完成率不能包装成同一配对集节省费用或更稳定。

persistence 对 stable 的 22 个共同完成案例，增量费用多 **14,897,850 KRW（19.505497%）**；1 例更低、7 例相同、14 例更高。它新增 5 个完成且失去 1 个原本完成案例；对 locked 则失去 2 个完成。因此保守预测需要继续研究，没有全面优于 locked 或 stable 的证据。

开发控制的完整数分别为 16/24、16/24、16/24、12/24。这批输入用于开发，不能当作新留出结果。以上费用百分比分母来自各自共同完成配对的 baseline 增量费；累计总费与增量费不能混用，也未将不完整执行的部分费用补入分母。

## 截止、未知和证明边界

四方法共享父进程 **5,000 ms 整个冷 episode** 截止，从 fork 前到接受完整 terminal audit 后 IPC。复核 final receipt、parent decision clock、退出 clock、完成与送达 flags；退出时间不能早于 receipt，hard timeout 的时钟必须达到预算。旧方法的单次 0.2 秒 solver 内部限时和 V6 的 200 ms 协作式整调用预算语义不同，单次调用可超过目标；不能称相同硬单次预算。

无 terminal 输出时，物理历史、日期变化、调用数未知，必须保留 null 和 unknown 分母；没有观察到执行，不等于证明没有发生动作。本轮源记录全部可用并及时送达，但 validator 不依赖这个有利事实。

这里证明账本和已声明信息/约束一致，不重新证明 GLPK 每次的最优或不可行，也不运行大批 native solver。V5 离线失败诊断与必要条件 witness 是另一份既有证据，不能代替 V6 新实例的证明；cheap cuts 的 unknown 继续是 unknown。

## 字节绑定与复现

- 原档案 [rolling-v6.json](../data/rolling-v6.json)：SHA-256 `695f7a62aeccd645bbd1374899fc21afe6caad1549bfbc7fa2d25e1ed62552a4`。
- 冻结协议 [protocol-v6.json](../data/protocol-v6.json)：SHA-256 `6b40337ee36ff9ff10dbd22e4953932aa17900a5d12cbc3a5f75e36518660311`。
- 开发源 [rolling-v5.json](../data/rolling-v5.json)：SHA-256 `482f6f8df7f0d46cf7d8b0356961c1aaf787f5e9f1566db7e18ce7c1afa23592`。
- 首轮 `vendor/experiments/v6-first-run-source/` 的 20 个源文件及 manifest 均绑定实验 implementationHashes。核心算法、执行、生成器与旧数据当前字节仍匹配；package 版本 5→6 和新增发布命令分别披露，依赖、锁定包及旧命令内容核对未改变。

Git 为避开单对象大小限制，将 112,117,733 字节原档按原始字节顺序存入 `data/archives-v6/rolling-v6/` 的 29 个分块（每块最多 4,000,000 字节）及 manifest；没有删行、改变数值或重新生成实验。`scripts/restore-evidence-v6.py` 检查每块及拼接整体 SHA，只在 canonical JSON 缺失时原子恢复，已有不同字节的原档会拒绝替换。可下载的完整发布 ZIP 仍包含完整原始 JSON；Git 中 canonical 原档及可重建 UI projection 被忽略。

运行 `python scripts/review-rolling-v6.py --output artifacts/rolling-review-v6-reproduction.json` 可复核；CLI 在原档缺失时先调用上述无损恢复器，再以同一冻结 SHA 进行只读审核。机器报告的 `cliEvidenceBootstrap` 记录是否发生恢复、分块声明及恢复器/manifest 的字节绑定；这不重跑实验或求解。也可 import `review(root: Path)`，此 API 始终只读，原档缺失时直接报错，不恢复或改已保存报告。

5 组手工 fixture 测试通过，覆盖四方法、定价/历史篡改、预测越界、冲突 audit 标签、父时钟、null 初始比较和 unknown counter 分母。独立红队另确认全部真实 summary/initialEquality，并推动补齐未由实际数据覆盖的 deadline 时钟检查。

订单、容量及 shocks 均为合成，采用披露的日模型与费率解释。通过不证明真实客户节省、日内线路可行性、外部预注册、运营认证、所有未来实例上的优势或比赛名次。
