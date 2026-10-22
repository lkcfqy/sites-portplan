# V12 旧输入原生诊断：独立只读复核交接

本说明不是已通过的审核，也不启动求解器。首次原档目录为 `artifacts/native-diagnostic-v12-first/`。预声明 SHA-256 为 `5ee08d9398e517d559b7603f5ff9886bc20c0a15393c68005eab88496717ad2b`，冻结 runner SHA 为 `361eef862591661835ef1631a80d18eee895c2aca056eaf041199e5266484040`。若目录尚无 `complete.json`，只能报告实际已完成记录数，不填预计结果。

## 独立输入重建

`original/commitment-slack-review-v11.json` 固定 SHA 为 `fb37b8ea5c2cf738ad73548a93f1f65cc541bf7c111be59f76bd88fb023ee27b`；`original/complete-v10.json` 固定 SHA 为 `33d07f60afb4b4248682badc631512a54070cca22fd106c7dd5062d4669bf9c2`。

从前者的 `v10VsV7LossEpisodes` 选取全部 `repeatIndex=1`，按原数组顺序得到9个不同场景。预期5个D0、1个D4、3个D6。每点的原始输入及原V10失败episode依次为 `original/01-input.json` / `01-episode.json` 至09；它们的字节必须匹配原V10索引中的inputArtifact和stableHiGHSV10 artifact。来源case、repeat、失败日及V7已完成事实均需核对。

独立使用原 `nominalScenario` 和该episode截至失败日的 `timeline.observedEvents`，逐日重建实际已经知道的容量。仅 `announcedDuration` 公开的未来区间可覆盖名义容量；不能读取 `input.events` 的私有持续期。失败日前的真实 `executedEvents` 形成过去锁，失败日未执行的候选不能进入历史。对照 `snapshots/NN.json` 的全箱订单、三资源每日容量、已执行锁、原始 `observationHash`、snapshotSha256及fixedEventsSha256。

## 矩阵与原档

逐项核对36个唯一任务：每个公共快照 × `cpsatV12/highsV8` × `200/2000ms` 各一次；父层硬预算全部为5000ms，不允许重复替换、漏掉难例、扩大个别预算或追加重试。预算/方法轮转顺序见固定声明。源码逐字节与 `implementationHashes` 相符，实际worker来自 `source/scripts/compare-native-v12.mjs`，两个adapter、两个service、HiGHS账本与依赖锁均有保留。

`records/NNN.json` 为每次冷任务的完整记录；`complete.json` 与可选 `data/native-diagnostic-v12.json` 仅为索引/摘要。后者必须绑定每份原档SHA，不能用摘要取代原生返回值、失败及晚候选。任何先前声明或不完整运行也不得删除后假装第一次成功。

## 独立物理和费用

建议使用原独立Python账本重新计算，不导入CP-SAT模型、HiGHS MILP系数或JavaScript辅助函数，也不再次调用优化器。审核对象包括：

- `result` 中正式交付的完整日期与费用；
- `rawTerminal` / 早于cleanup的planner receipt中的完整候选；
- `plannerMetadata.nativeCertificate.rows`、CP的 `discardedLateCandidate` 等完整原生候选，即使晚到而未被接受。

每份完整候选核对释放/交期/末日/lag、全部过去锁、持续卸货、`[pickup,return)`堆场、20/40ft TEU、同日提还两次运输和全部历史日容量。逐箱复算PNC追溯阶梯、Maersk声明累加阶梯、首日08:00、沉没两费、新增两费及合计；允许的公开费率敏感性若出现也按原输入处理。

“完整候选经独立审核有效”不等于“在原预算内接受”。晚到的候选可以物理有效，但不能进入及时计划计数。没有完整接纳计划时，顶层费用必须null；不能以零代表未完成。

## 状态、下界与期限

CP-SAT的状态值与HiGHS不同：CP为OPTIMAL=4、FEASIBLE=2、INFEASIBLE=3、MODEL_INVALID=1、UNKNOWN=0；HiGHS/SciPy为optimal=0、limit=1、infeasible=2、unbounded=3、error=4。必须按各自backend解释，不能复用数值映射。两者均固定单线程、seed0。

CP的精确整数目标与独立账本比较；浮点 `reportedObjectiveDouble` / `reportedLowerBoundDouble` 是原始遥测，不是费用取整。只有及时OPTIMAL和精确目标核对有效，才使用匹配的精确下界。晚CP证书必须清空顶层lowerBound/source及所有接纳proof，原bound只能在discarded/raw遥测。HiGHS旧服务的晚下界保留于raw证书，但摘要 `lowerBound` 只有及时已接纳完整计划才有值；`nativeRawLowerBound` 不作及时证明。

核对服务启动、日调用、服务/JS审核、候选gate、cleanup、终端接收、父层复算、process exit/close及进程组清理时间。有效父终态要求exit0、无signal、worker cleanupSuccess=true、error=null、进程组已验证消失且共同5秒内结束。计时器未触发但同步工作跨过5秒，同样不能接受。`actualCutoffMs` 仅表示真实计时器触发，不能用完成时刻伪造它。

原HiGHS适配器没有CP新增的显式acceptedAt字段。此处只能审计其保存时钟、源代码gate和接纳/丢弃的一致性，不应声称外部认证了每个原生微秒。单调时钟、OS调度和第三方真实性均不由此认证。

## 结论范围

四格统计分别为每方法/预算的9个旧快照，必要时再分5个D0与4个后续失败点；2000ms档明确离线。单点有计划不代表完整滚动路径获救，没有新独立业务样本，也未将CP-SAT加入V12正式六方法分母。审核完成后另保存只读结果与实现哈希，再更新reviewComplete；runner本身保持 `independentPythonReviewComplete:false` 的首次原档不改写。
