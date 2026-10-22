# V7 公开 RCPSP 结果的独立复核

`scripts/review-public-resource-v7.py` 仅复核冻结的公开实验记录，不调用求解器、不导入生产 JavaScript，也不重新运行正式实验。实现只依赖 Python 标准库；Node 测试经独立 Python 入口检查手写小例。输出为 `data/public-resource-review-v7.json`，包含 `valid/readOnly/fixture/solverRuns`、输入 SHA-256、独立重算汇总和逐案例派生资源账本。

## 输入与来源绑定

正式入口固定检查协议 SHA-256 `8c5370eaf867b167663717b97e6c895b796dbb832b84375ef61ad3a5b4bed364` 和结果 SHA-256 `8006575658f320ba0db851af8e6f0251ac9935bb8d72790bf0b9f405594d4dd6`。保留全部 480 个 J30 案例和两种方法，共 960 个结果，不替换案例、不选择更好的重跑结果。

原始数字输入只从本地研究缓存读取：`j30.sm.tgz`、`j30.opt`、`j30-merged.json` 均按协议中的字节数、官方 URL 和 SHA 校验。`tarfile` 在内存读取 `.sm`，不提取或复制原始数据到网站或复核成果。协议引用 PSPLIB 的研究使用说明允许评估求解程序；没有据此推断原始文件的再分发许可。外部 ALNS 示例的 MIT 许可与指定 commit 记录按原协议绑定。

检查器验证当前生产代码、测试、外部示例/许可与第一次运行前的逐文件快照 SHA 全部一致，并检查快照 manifest 的协议 hash、实现 hash 和 `capturedBeforeFirstMethodCall` 标记。`inputHashes` 只使用仓库可解析的相对路径，包含冻结结果、协议、生产源、快照及本检查器与测试；临时缓存的三个原始来源另存于 `originalCacheHashes`，不混入绝对路径。正式证书绑定原记录的 runtime、开始/结束时间及协议先冻结的顺序；这不是对机器时钟或快照捕获过程的额外独立证明。

## 独立源解析与排程审计

Python 按原 `.sm` 语法独立解析一项目、32 个源 job ID、单模式、四个原可再生资源容量、完整需求向量、非抢占工期、先后边与原规划期。项目 release 必须为 0，两个 dummy 的工期及资源需求必须为 0；解析检查完整编号、重复、未知后继、多模式及循环。项目 due date、tardiness cost 与 MPM time 原样保留为来源元数据，**不把 due date 当作标准 RCPSP 的硬期限**。

对每个方法结果及其嵌套 candidate 分别检查：

- 源 ID 唯一完整，32 个起点均为非负有限整数，不能由重复 ID 隐去活动。
- 活动从一个起点连续执行完整原工期；release、原 horizon 和每一条 finish-to-start 边均成立。
- 源 dummy 在 release，零工期 sink 位于全活动完成时刻；makespan 由全部活动结束时间重新计算。
- 每个原资源采用独立的逐 tick 差分数组，起点加需求、终点减需求，半开区间 `[start, finish)` 连续累计；用量不超过原容量，终点清零且积分等于 `sum(duration × demand)`。
- 排程及 candidate 的自报 `audit.valid/errors/makespan` 与独立检查一致，成功起点与嵌套候选一致；自报 valid 不能遮住非法排程。
- OPT 表独立解析后与官方 merged 文件的全部 480 个已证最优值一一连接；任何候选或最终 makespan 小于其官方参考均被拒绝。参考值用于评分，复核不执行搜索。

差分账本与生产 SGS 的逐 tick 放置、生产审计的事件 sweep 分开实现。证书只发布派生的资源峰值和资源 tick 总量，不复制原需求、工期或容量文件。

## 时间、方法和汇总规则

每个结果的 external whole-call 与 internal clock 均要求有限、非负、内部不超过外部。成功资格需要两个时钟均不超过冻结的 warm 100 ms；external overrun 必须等于 `max(0, external − 100)`。合法的晚返回可以保留已审计 candidate，但成功日期和目标为 null，不能计入完整完成率或费用/目标配对。

方法 key、共同 seed `97001 + 原规范索引`、轮换执行顺序、100 ms 合作预算、零起点 baseline 次序和完整拓扑 priority 均校验。baseline 的 iterations 与 acceptedMoves 必须为 0；iteratedSGS 不超过冻结的 256 轮，acceptedMoves 不超过 iterations。8 活动 segment removal 与 2 ms audit reserve 属于源/协议绑定参数，结果没有逐轮日志，复核不能由终态验证每一个未保存的中间动作。启发式仅允许 `not_proven / feasible`，不把碰到官方最优值写成求解器最优证明；目标固定为原始抽象 tick makespan，fee 必须为 `not_applicable`。

全部汇总从独立有效且及时的完整候选重算，包括方法完成/缺失/最优匹配/低于参考/零分母、gap tick 与百分比的中位数及 nearest-rank p95、总 makespan、墙钟、iterations、状态、overrun，以及双成功配对的改善、持平、恶化、缺失、加权下降与所有恶化 case ID。对象键与计数完整比较，浮点计算只允许很小的舍入容差，不以自报 summary 为权威。

保存时钟和计数只能支持记录一致性与上述资格检查，不能独立证明 CPU 隔离、未保存的中间搜索行为或硬实时中断。该公开协议不包含 parent 强制逐调用中断，也不包含 cold import 的相等预算。

## 本次结论与复现

独立复核通过：480 个实例、960 个结果和 960 个嵌套候选均完整合法且在记录的 warm 100 ms 内，官方 OPT/merged 480 个参考连接一致，未发现低于已知最优、缺失或恶化配对。baseline 匹配 172 个官方最优，iteratedSGS 匹配 353 个；307 对改善、173 对持平、0 对变差。总 makespan 从 31,179 降至 28,604，减少 2,575 个抽象 tick，加权下降 8.258763911607172%。这些是已公开、已知的 ProGen 生成基准结果，不是新私有留出集、真实物流订单、港口费用或现金节省。

```sh
python scripts/review-public-resource-v7.py --input-dir /tmp/portplan-v7-psplib
node --test tests/public-resource-review-v7.test.mjs
```

无原始缓存时应先按冻结协议的官方 URL/SHA 获取同一份研究输入，再提供 `--input-dir`；检查器不下载替代数据，也不调用实验 runner。默认只写新的复核 JSON，不改冻结输入、生产源或历史结果。

手写负面 fixture 检查重复/漏 job ID、违反 precedence、超过四资源之一、错误 makespan、自报伪 audit、低于参考、错误 clock/budget/overrun、超迭代、错误 seed/priority、虚假最优以及合法晚 candidate 的排除。fixture 与正式证书明确分开，测试通过不代替全部 480 个真实源文件的复核。

该验证只支持标准 RCPSP 的通用连续资源与先后关系，不能扩展为 PortPlan 的提箱/还箱运输端点、可变箱位区间、港口收费模型、完整原版 ALNS、SOTA 或比赛名次结论。
