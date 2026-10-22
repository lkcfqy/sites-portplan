# V7：原始 PSPLIB 外部资源调度的部分验证

方案已选定：使用 **PSPLIB j30 的原始通用 RCPSP**，验证连续作业、前后顺序及可再生资源容量。没有把任务改成港口箱，没有运输端点或可变箱位，没有费用计算。480个实例是已发表、已知的生成基准，不是现实订单、新留出样本或比赛排名证据。本轮不重复V6的11来源普查，也没有取得新的PNC完整订单链。

## 已取得的官方来源与研究使用依据

[PSPLIB官方库说明](https://www.om-db.wi.tum.de/psplib/library.php)明示：

> The data sets may be used for the evaluation of solution procedures for single- and multi-mode resource-constrained project scheduling problems.
>
> Researchers may download the benchmark sets to evaluate their algorithms, and they may send their results to be added to the library.

同页说明实例由标准项目生成器ProGen生成。[当期single-mode下载页](https://www.om-db.wi.tum.de/psplib/getdata.php?mode=sm)列出j30“480 instances (fully optimal)”，提供原实例TGZ/ZIP、OPT参考和合并JSON。2026-10-13直接取得原件，HTTP200；URL、时间、SHA及失败尝试保存在[manifest](../data/public/v7-validation/manifest.json)。旧`getdata_sm.html`、`format.html`和导航中的`solutions.php`为404，原响应仍保留，不把失败页当规则。

研究评价用途有直接官方依据。没有取得MIT/CC或明确的原数值文件再分发许可，因此原TGZ、OPT和合并JSON只进入按官方URL下载的研究缓存；不自动加到网站公开ZIP。方法示例的MIT许可不替PSPLIB数值实例授予许可。没有联系、上传结果、报名、认证绕过或403重试。

| 官方原件 | 本次字节 | SHA-256 |
|---|---:|---|
| [j30 TGZ](https://www.om-db.wi.tum.de/psplib/download_dataset.php?set=j30&mode=sm&format=tgz) | 187,623 | `c18202a56588e3cdf3c1aebc5fa59d06b22ee634c74ddf554b6df6bc100044ff` |
| [j30 OPT](https://www.om-db.wi.tum.de/psplib/download_solution.php?set=j30&mode=sm&type=opt) | 16,199 | `9036456d909d5d2102975c13dd6fe36fe503b3ed1df5b91fa652aa7dc9648ee3` |
| [j30 merged JSON](https://www.om-db.wi.tum.de/psplib/download_merged.php?set=j30&mode=sm) | 156,950 | `8f2c005cdf81bf0c962e2930c9c241ed327ba832202ff579d953c4e93f39029e` |

合并JSON及OPT给出480个已发表最优makespan，**没有提供每个任务的实际执行起点/业务历史**。参考历史CPU时间来自旧硬件，不能与本机耗时比较。

## 当前能够直接核对的约束

原数据每实例32个任务，含两个虚拟source/sink、30个实任务、4种常量可再生资源，无非可再生/双约束资源。每任务原生字段包括单模式duration、4维需求和后继；资源容量、项目release、horizon都来自源文件。时间是抽象整数tick，不是分钟、天、日历时区或司机班次。

对任务j保留原开始时间s和持续时间d，检查：

- 每个前驱i满足 `s[j] >= s[i] + d[i]`。
- 作业不抢占，资源需求在半开区间`[s[j], s[j]+d[j])`持续占用。
- 每种资源k、每tick，所有活动任务需求之和不超过原容量。
- 原项目release和源horizon保留；没有增加实际订单release、fleet、shift或tariff。

`.sm`项目行另含due date、tardiness cost、MPM-Time。它们保留为来源字段，但**不当作标准RCPSP makespan目标中的硬截止条件**。把project due直接填PortPlan dueDay会改变问题，甚至将官方可行最优实例判成不可能。

这给PortPlan连续卸货/资源容量/前后关系提供一个外部数学组件检验。原问题没有反出/还空共用运输端点，也没有从p到r的可变箱位占用；即使所有RCPSP计划通过，也不证明完整PortPlan模型、公开收费公式或真实港口执行正确。V6的48×48货运矩阵、实港访问组件与此RCPSP证据各自保留来源含义，不合并为真实箱订单。

## 方法来源与具体变更

基准`baselineSerialSGS`以原任务ID升序稳定Kahn拓扑序，执行一次serial schedule generation：每任务在全部前驱完成后寻找四资源都容纳连续duration的最早窗口。

`iteratedSGS`从同一基准计划开始，固定最大256步；每步移走8个正duration任务组成的优先序片段，再按原拓扑顺序随机插到合法前驱/后继索引之间，重新SGS，接受makespan降低或持平。随机为固定LCG，种子`97001+canonical case index`。这是 **literature-inspired bounded iterated SGS**，没有完整原ALNS的自适应轮盘权重、most-mobile/non-peak删除、right/left justification及5,000步设置，不称首次、全局局部最优、完整原论文复现或SOTA。

实际读到的方法示例是[N-Wouda/ALNS](https://github.com/N-Wouda/ALNS/tree/5ef1fd1171e6be49c947cd3e56e485509b9c1d64)，固定commit `5ef1fd1171e6be49c947cd3e56e485509b9c1d64`，MIT copyright2019 Niels Wouda and contributors。原[notebook](../data/public/v7-external-methods/alns/resource_constrained_project_scheduling_problem.ipynb)与[许可通知](../data/public/v7-external-methods/alns/LICENSE.md)保留；检查了SGS/segment/random_insert代码。示例引Fleszar & Hindi (2004), EJOR155(2):402–413, [DOI](https://doi.org/10.1016/S0377-2217(02)00884-6)。期刊本体只核对元数据/摘要，不能写已阅读全文。更多方法来源说明见[external-methods-v7.md](external-methods-v7.md)。

## 正式比较前冻结的协议

[protocol-public-v7.json](../data/protocol-public-v7.json)固定全部480项，参数1…48×重复1…10，canonical顺序；两方法逐项轮换、单次串行执行。

- 每方法每实例100ms的**进程内合作式**墙钟，调用前至完整返回；包含初始构造、搜索、内部event-sweep检算及返回对象。
- import、下载、解压、一次解析、参考值连接及评价者的重复终检在方法计时外，两方相同；不是冷启动或父进程强制100ms中断。实际超时返回不能计及时完成，已审计候选另保留。
- `maxIterations=256`、`removeCount=8`、尾部检算预留2ms；不按新结果修改。
- 官方OPT只用于评价，绝不传入heuristic接受/停止；与官方merged逐项核对。
- 完成、时限、错误、最优参考差、零分母、费用不适用、缺配对和负例全部保留。仅双方及时完成的同一实例比较makespan；原始480始终在分母。
- 首次结果不可覆盖，源码/协议在第一方法调用前留snapshot。公开基准是已知生成实例，不称独立实业务留出或外部正式预注册。

最终正式前协议SHA-256：`8c5370eaf867b167663717b97e6c895b796dbb832b84375ef61ad3a5b4bed364`。正式比较按该协议和统一CPU窗口首次完成。初次480例性能结果未触发参数、代码或实例替换。

## 首次正式结果：原模型、全部480例

首次归档[data/public-resource-v7.json](../data/public-resource-v7.json)共3,088,335字节，SHA-256 `8006575658f320ba0db851af8e6f0251ac9935bb8d72790bf0b9f405594d4dd6`。原始输入按协议不变，首方法调用前的[source snapshot](../vendor/experiments/public-v7-first-run-source/manifest.json)与实现SHA保留，日志为`artifacts/public-resource-v7/first-run.stdout.log`。本轮没有重跑择优或看结果调参。

| 记录 | 固定优先序Serial SGS | 受限Iterated SGS |
|---|---:|---:|
| 及时完整 / 全部 | 480 / 480 | 480 / 480 |
| 达到官方最优参考值 | 172 | 353 |
| 仍高于最优参考值 | 308 | 127 |
| gap中位数（tick） | 4.5 | 0 |
| gap p95（%） | 27.272727% | 4.615385% |
| 最坏gap（tick / %） | 37 / 44.444444% | 12 / 17.647059% |
| 方法墙钟中位数（ms） | 0.032348 | 12.576058 |
| 方法墙钟最大值（ms） | 1.045218 | 32.929454 |
| 超时返回 / 低于参考 / 内部检算异常 | 0 / 0 / 0 | 0 / 0 / 0 |

全部480例配对：307例更短、173例相同、0例更长；缺基准/迭代均0，零makespan分母0。makespan合计31,179→28,604 tick，减少2,575 tick；加权减少`Σ(基准−迭代)/Σ基准`为8.258764%。这是同一公开原问题的抽象工期指标，不是港口停留日、财务节省或现实成功概率。

迭代方法所有实例均完成固定256步，没有耗尽100ms上限；它实际用了更多计算时间，不能称总CPU相同。它保留同一初始基准并只接受不变/更优makespan，所以本轮0例更长并不是普遍优越或SOTA证明；仍有127例未匹配已知最优，最差差12 tick。算法状态始终启发式；“等于官方最优参考”不是新独立最优性证书。

此处先报告内部event-sweep审计，另一实现从原字节逐计划复核另行提供。它与完整PortPlan费用/运输/箱位模型的成绩不合并。

## 已完成的输入核对与代码验证

[独立Python输入审计](../data/public/v7-validation/audit-psplib-j30.py)直接解析TGZ，核对全部480个DAG、32节点/4资源、source/sink、源release=0、需求合法、OPT对应及critical-path/resource-work下界。它构造的是新串行拓扑审计fixture、不是源提供的历史排程，也不是SGS/迭代方法性能比较；480个fixture均通过原先后与资源检算，solver调用0，未造port业务字段。详见[profile](../data/public/v7-validation/psplib-j30-audit.json)。

新[src/rcpsp-v7.js](../src/rcpsp-v7.js)包含原字段解析、SGS、受限destroy/repair及独立event-sweep终检。SGS按tick数组放置，检算按资源事件sweep相加；正式结果仍应由另一实现从源字节重建、检查全部开始向量、前后约束、容量与makespan。内部独立路径不是外部机构认证。

[手算测试](../tests/rcpsp-v7.test.mjs)覆盖：原ID/release映射、project due不当硬期限、两资源、半开结束、零dummy、容量/先后/部分结果拒绝、循环/模式/维度异常、修复索引两端与仍存在的传递后继、固定seed/iteration再现、超时不升级完成以及小例独立穷举。正式前源码审查修正了“直接后继被移除时仍须尊重传递后继”的插入范围，并加入五任务链回归；没有借480例性能结果调整参数。

## 运行与交付

```sh
node --test tests/rcpsp-v7.test.mjs
node scripts/public-resource-benchmark-v7.mjs --download-only
# 统一CPU窗口后，仅首次归档一次：
node scripts/public-resource-benchmark-v7.mjs --record-first-run
# 后续复算写新路径，保留首次档案：
node scripts/public-resource-benchmark-v7.mjs --output artifacts/repro-public-resource-v7.json
```

下载脚本只用官方公开URL，校验字节与SHA，无失败绕过；缓存默认`artifacts/public-v7-inputs`，原件不会加入网站ZIP。也可用`--input-dir /tmp/portplan-v7-psplib`读取本轮已校验研究缓存。首次归档路径`data/public-resource-v7.json`；它保留每实例原ID、官方最优、两方法最终开始向量/候选/状态、时间和检算，不携带完整原实例系数作为raw再分发。

本轮唯一推荐是先做这条原模型外部资源验证，不把MIPLIB匿名MPS重新改成箱链。V6已查drayage-25-23的真实空间/生成时序混合来源且再分发许可未明，本轮没有新增许可证据，所以不重复下载或宣称它已直接可用。现实箱链缺失仍保持缺失；源码和当前全部成果由AI完成，外部基准不会改变用户作者资格或官方AI规则未知状态。
