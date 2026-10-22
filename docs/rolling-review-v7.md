# V7 五方法冷启动执行：独立复核

完整原档复核通过，机器结果见 [rolling-review-v7.json](../data/rolling-review-v7.json)。`scripts/review-rolling-v7.py` 为纯 Python 标准库，复用已有独立 Python 日期、费用和资源数学，不导入 JavaScript，不运行优化器或重新执行在线方法。手算 fixture 不生成任何前瞻实验种子。

全部 **72 个案例 × 5 方法＝360 个 episode** 均覆盖：227 个完整执行、133 个已知失败、0 个历史不可用。独立核对 3,161 个逐日轨迹、3,028 个接受的完整日期计划、12,518 行终局逐箱费用、1,351 个压缩缓存日期承诺。145 次 polish proof 中，34 次 seed 未接受；111 次完整 seed 前后日期均按相同信息和锁独立审核/复价，其中 80 次严格减费、31 次相同。本轮没有父截止未知或 planner exception；这些分支以手算 fixture 验证，不能把未观察到的动作和调用补为 0。

## 新种子主实验的结果与取舍

| 方法 | 主实验完整执行 / 36 | 旧输入开发控制完整执行 / 36 |
| --- | ---: | ---: |
| dailyReoptV4 | 20 | 20 |
| stableRetainV5 | 21 | 21 |
| lockedRecoveryV6 | 26 | 29 |
| costPolishV7 | 27 | 29 |
| graspBaselineV7 | 17 | 17 |

costPolish 对 lockedRecovery 的 **26 个共同完成**主案例，增量费为 137,668,850→128,957,000 KRW，少 **8,711,850 KRW（6.328120%）**；总费用减少 3.772836%。8 例更低、18 例相同、0 例更高，日期变化 1,491→1,486，新增完成 `v7-new-arrivals-tight-n50-r1`，未失去完成。此结果支持该冻结合成样本中的覆盖/费用改善，不能升级为所有实例的支配定理。

costPolish 对 stableRetain 的 **20 个共同完成**主案例，增量费为 35,756,150→38,025,350 KRW，多 **2,269,200 KRW（6.346321%）**；0 例更低、15 例相同、5 例更高，最差多 918,500 KRW，日期变化 483→738。它新增 7 个完成且失去 `v7-new-arrivals-tight-n50-r2`。不能将覆盖优势写成相同配对集全面节费或更稳定。

对 GRASP 的 17 个共同完成主案例，costPolish 增量费少 6,072,050 KRW（5.532778%），10 例更低、6 例相同、1 例更高，最差多 215,600 KRW，新增 10 个完成且无失去。GRASP 是一个披露参数的经典适配基线，结果不证明胜过原论文、同问题最佳方法或真实订单上的最优调度。

开发控制单独保留：costPolish 对 lockedRecovery 的 29 个共同完成案例，增量费少 6,188,600 KRW（4.612708%），9 例更低、19 例相同、**1 例更高（26,800 KRW）**，日期变化反而为 2,091→2,256。旧输入已用于开发，这个负例不能删除，开发结果也不能并入 36 个新种子的主分母。百分比分母均来自该比较各自的共同完成 baseline 增量费；累计总费、不同配对集和失败部分费用不能混用。

五方法在主实验中只有 15/36 例初始候选全部完整可比，且没有五方法日期全相同的案例。locked/cost 两方法的初始候选为 29 例可比，22 例同日期、7 例不同、7 例不可比；这些完整 episode 比较包含初始化和后续恢复的共同影响，不能声称隔离了相同已执行历史后的恢复效果。

## 审核内容与边界

审核范围是 36 个全新主案例与 36 个 V6 输入开发控制，五方法为 dailyReoptV4、stableRetainV5、lockedRecoveryV6、costPolishV7、graspBaselineV7。开发控制从冻结的输入专用 bundle 逐字段核对原 nominal scenario 和 shocks，保留 referenceCaseId、source SHA 与独立分母，不作为新增留出样本。bundle 字节必须与首轮 snapshot 一致，origin 声明绑定 V6 全原档 SHA；再用冻结 V6 协议的全部 36 个配置，独立重建原 nominal scenario、整数比例 shocks、规模和种子，核对全部 bundle 输入而无需导入 112 MB 的旧 solver results/debug。

逐日重建当天可见信息及 observation checksum：过去/当天容量可见，私有未来 shocks 和 duration 不可读取。核对所有已执行锁、未执行事件不得回到过去、释放/先后/期限、每日双运输、持续卸货和按箱/TEU 的跨日场地占用。当天实际动作必须与完整日期计划一致，终局逐箱费用及资源必须与完整执行历史一致；失败完整费用为 null。所有 summary、负收益、失去完成、零分母、日期变化与初始计划比较均重新计算，初始空、部分或未经审计的方案不可比较。

V7 compact archive 省略重复缓存费用 rows 和大型模型 debug 数组，保留物理 timeline、state、执行动作、audits、终局 fee rows。审核以此前接受的完整 dates 重新核对当天缓存可行性和 date SHA；这不声称核验未归档的原缓存费用字段，也不将被省略诊断当成没有动作。计数和墙钟仍保留逐调用证据；历史不可用的调用保持 null 与 unknown 分母。若 planner 抛错并丢失内部 stage metadata，保留可见的执行前缀，同时内部累计 solver/reuse/replan 等未知计数仍须为 null，不能补 0。

costPolishV7 的同快照证据单独复核。每次接受 seed 时须保留完整 beforeDates/afterDates，按相同观测、执行锁及 minEventDay 独立审计并重算联合增量费，核对费用声明、非增费与严格下降的 move chain 端点。最终选择 constructor 时 dates 必须等于 afterDates；若最终选中更便宜 MILP，可采用不同 dates，但仍核对其费用不高于已审计 seed。只具备 move chain 数值时不能独立重建每个中间移动；完整日期端点才是此次独立费用证据。全档 111 次 seed 的局部端点改善累计为 49,276,250 KRW，此值包括同一 episode 多次规划，**不是终局执行节省**。局部同快照改进不证明整次 episode 胜过另一方法。

GRASP 是经典方法在披露日模型上的适配，不是同问题论文复现。核对零 MIP/solver 调用、constructor/reuse/replan 数、cacheStatus、预算和参数、及时经审计 incumbent、完整 dates；不将 heuristic feasible/no_feasible_schedule_found 提升为最优、局部最优或不可行证明。

共同父进程预算为整个冷 episode 的 5,000 ms，包括 imports、所有调用、终局双审计及 IPC 接收后的父审计。finalReceivedMs 必须不晚于 receiptValidatedMs，validated receipt 必须在预算内，退出 clock 不得更早。V6/V7/GRASP 为 200 ms 协作式整调用预算，旧两方法为 solver 内部 0.2 秒限时；语义不同，不能宣称相同硬单次预算。无及时 terminal output 的历史、动作、调用数未知，不补为 0。

源 manifest 必须在首个新种子生成前捕获，逐项绑定冻结 runner/worker、算法、依赖、生成器和协议，并核对当前 runtime 字节。发布 package 版本和已声明新命令可单独披露，不能借包装差异更改算法或依赖。

## 字节绑定与复现

- 原档 [rolling-v7.json](../data/rolling-v7.json)：118,230,496 字节，SHA-256 `a8b0d67f7ff5fbf3b27fe260ab8d9d17be331a9942df37704d8d8365546000c6`。
- 冻结协议 [protocol-v7.json](../data/protocol-v7.json)：SHA-256 `bb70fa6938ffbb162347142cbb2788f9ece00ac695a8b8ed5a647cd08aedb96f`。
- 首轮 snapshot 输入 bundle `vendor/experiments/v7-first-run-source/data/development-inputs-v7.json`：SHA-256 `ebbe72679c93fd53e2bb98c9abe49df25c9e3b96232ca44005f53adcd78ace57`。
- V6 重建协议 [protocol-v6.json](../data/protocol-v6.json)：SHA-256 `6b40337ee36ff9ff10dbd22e4953932aa17900a5d12cbc3a5f75e36518660311`；bundle origin 声明绑定原 V6 档 `695f7a62aeccd645bbd1374899fc21afe6caad1549bfbc7fa2d25e1ed62552a4`。
- 首轮 19 个 runtime 文件及 manifest 均核对，manifest SHA-256 `2c529a3341f69983a669098858ae3f6a39445dd3eb1e287e584b9630e24bd32f`。机器报告另绑定审核器与独立费用实现本身的 SHA。

Git 传输布局为 `data/archives-v7/rolling-v7/manifest.json` 和 30 个按序原始字节分块，每块最多 4,000,000 字节。此布局避开单 Git 对象大小限制，不删行、不改数值、不重新生成实验；完整发布 ZIP 保留原始完整 JSON。恢复器 `scripts/restore-evidence-v7.py` 验证每块和拼接整体 SHA，只在 canonical 原档缺失时原子恢复，已有错误字节的原档拒绝替换。此次实际校验全部 30 块及完整 SHA，通过且没有替换现存原档；随后完整只读审核再次通过。

运行 `python scripts/review-rolling-v7.py --output artifacts/rolling-review-v7-reproduction.json`；CLI 只在原档缺失时先调用恢复器，再以同一冻结 SHA 只读审核。传输 manifest 存在时，报告的 `cliEvidenceBootstrap` 记录实际恢复与否、manifest/恢复器 SHA、分块声明和原档 SHA；逐块恢复检查由恢复器负责，审核器复核完整 canonical 字节流。import `review(root: Path)` 始终只读，缺原档直接报错，不恢复或改已有报告；不会覆盖 V1–V6 原档。

六组手算 fixture 已通过，覆盖五方法完整账本、30,000 KRW 同快照改善、缓存 SHA 与费用/锁篡改、最终更便宜 MILP、未经尝试的完整 seed 证据、GRASP 伪 proof/solver 计数、父审计时钟、null 初始计划和 unknown 分母。三项 CLI 窄验证另核对缺档只读 API、缺档 CLI 恢复、现存原档不调用恢复器。只读 helper 核对冻结 worker/runner 的字段与 source 语义，补齐 referenceConfig 和显式 throw 分支的 schema 匹配。

此审核是内部第二实现，订单与 shocks 仍为合成，不证明 GLPK 每次最优或不可行、真实客户节省、日内线路可行性、第三方认证或比赛排名。公开资源基准与真实港口历史台账由其他审核分别处理，不与这些合成费用/完成分母混算。
