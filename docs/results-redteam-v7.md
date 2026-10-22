# V7 最终结果红队审查

只读核验：2026-10-13T12:53:32+00:00。本轮只新写本文件，没有运行求解器、实验或改写旧材料/原档。逐案例重算了主36与开发36的全部12条配对摘要、费用和缺对及负例ID；核对三份独立审核的输入哈希链。

可以作为主结论的是：在声明的合成日模型和共同冷episode预算下，V7费用抛光完成27/36，锁定恢复26/36；26个共同完成对的新增费合计低6.328120%，总费低3.772836%。该结果没有推出全局最优、业务节省、所有对照优势或第一概率。与稳定保留的20对里，V7新增费反而高6.346321%，5例更贵，且丢失一个完成案例。开发控制里也存在V7比锁定恢复多26,800韩元的明确反例。

## 1. 六个主比较必须共同出现

原档保存五方法×新36及开发36，共360 episode；主完成20/21/26/27/17、开发20/21/29/29/17（顺序：每日MILP/保留/锁定恢复/费用抛光/GRASP）。全部227次完整执行、133次已知未完成，未交付历史/强制超时/审计失败均0。零费用是完整有效计划的费用；失败费用均null。

下表Δ=候选−基准，负数才表示更低。原JSON的savings符号相反。配对/缺基准/缺候选分母均保留；“低/同/高”为候选相对基准。总费/新增费的基准分母分开，不能只挑较大的新增费百分比。

| 比较key | 配对/缺B/缺C | 低/同/高 | Δ费KRW | Δ总% / Δ新增% | 基准总 / 新增KRW | 0总/新增 | 完成增/损 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| polishVsLocked | 26/10/9 | 8/18/0 | -8,711,850 | -3.7728% / -6.3281% | 230,909,850 / 137,668,850 | 7/7 | 1/0 |
| polishVsStable | 20/15/9 | 0/15/5 | +2,269,200 | 3.4212% / 6.3463% | 66,327,350 / 35,756,150 | 6/6 | 7/1 |
| graspVsLocked | 17/10/19 | 3/6/8 | +3,304,800 | 1.7913% / 3.1048% | 184,495,550 / 106,442,050 | 6/6 | 0/9 |
| polishVsGrasp | 17/19/9 | 10/6/1 | -6,072,050 | -3.2332% / -5.5328% | 187,800,350 / 109,746,850 | 6/6 | 10/0 |
| lockedVsStable | 20/15/10 | 0/15/5 | +6,309,500 | 9.5127% / 17.6459% | 66,327,350 / 35,756,150 | 6/6 | 6/1 |
| stableVsDaily | 19/16/15 | 1/14/4 | +246,500 | 0.3782% / 0.7119% | 65,170,850 / 34,626,950 | 6/6 | 2/1 |

keys定义：polishVsLocked=费用抛光vs锁定恢复；polishVsStable=抛光vs保留；graspVsLocked=GRASPvs锁定恢复；polishVsGrasp=抛光vsGRASP；lockedVsStable=锁定恢复vs保留；stableVsDaily=保留vs每日MILP。不同pair包含的案例不同，不能交叉减合计或给缺对的失败补0。

主polishVsLocked的同26对日期变化1491→1486，仅下降0.3353%；并非高额稳定性改进。polishVsStable的同20对日期变化483→738反而增加，最差增费918,500。不要把V5或V6不同面板的变化百分比移到V7。

## 2. 唯一完成增益不是D3同前缀救回

主polishVsLocked只新增`v7-new-arrivals-tight-n50-r1`。我直接比较了对应的timeline对象：

| 日 | observedEvents / observationHash | 完整dates/decisions | executedEvents及state | 结果 |
| --- | --- | --- | --- | --- |
| D0 | 都相同 | 相同 | 相同 | 两法执行；planner状态optimal/feasible不同但排程相同 |
| D1 | 都相同 | 相同 | 相同 | 两法执行 |
| D2 | 都相同 | 已不同 | 已不同 | 同当时信息开始采用不同路径 |
| D3 | events相同 / hash不同 | 锁定恢复无计划 | 历史prefix已经不同 | 锁定恢复no_feasible_schedule_found；V7继续执行 |

D2两法均执行11个事件，但事件身份不同：锁定恢复对C002提箱/开始卸货，V7在对应位置对C013提箱/开始卸货。D3的观测hash已不同，不能说两法面对同一锁定snapshot，更不能说V7在D3救回了锁定恢复那个既成物理前缀。准确叙事是：D0、D1相同；D2在相同已知信息下计划及执行分叉；锁定恢复D3没有找到完整锁定计划，V7自己的路径最终完成。当前记录没有给失败prefix的独立native不可行/可恢复证书。

该新增完成的V7终费为0，失败基准终费null；它不进入26个费用配对，不能通过把失败补零计“额外节省”。两条路径的差异也可能涉及预算内候选/求解返回而不只是一个邻域算子，单例不能证明普遍恢复因果效果。

## 3. 开发反例反驳episode不退步保证

36个开发控制复用既有V6输入、用于方法开发，不能并入新36或按这些成绩再选方法/参数。全部六条开发比较如下：

| 比较key | 配对/缺B/缺C | 低/同/高 | Δ费KRW | Δ总% / Δ新增% | 基准总 / 新增KRW | 0总/新增 | 完成增/损 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| polishVsLocked | 29/7/7 | 9/19/1 | -6,188,600 | -2.6705% / -4.6127% | 231,735,550 / 134,164,150 | 9/9 | 0/0 |
| polishVsStable | 21/15/7 | 0/12/9 | +3,701,400 | 3.8412% / 7.2288% | 96,360,250 / 51,203,300 | 6/6 | 8/0 |
| graspVsLocked | 17/7/19 | 4/6/7 | +4,713,800 | 2.5014% / 4.4997% | 188,443,350 / 104,758,050 | 6/6 | 0/12 |
| polishVsGrasp | 17/19/7 | 9/6/2 | -7,071,700 | -3.6611% / -6.4598% | 193,157,150 / 109,471,850 | 6/6 | 12/0 |
| lockedVsStable | 21/15/7 | 0/12/9 | +7,445,400 | 7.7266% / 14.5409% | 96,360,250 / 51,203,300 | 6/6 | 8/0 |
| stableVsDaily | 20/16/15 | 3/12/5 | +31,000 | 0.0323% / 0.0608% | 96,089,950 / 50,987,600 | 7/7 | 1/0 |

关键反例`v6-batch-release-tight-n50-r2--development-control`：两法都完整完成；锁定恢复总费1,419,100、新增费1,291,700，V7总费1,445,900、新增费1,318,500，V7多26,800。原扰动是D3揭示的仓库容量3、私有持续2天；没有提前给planner持续期。D0 observedEvents/hash相同，但决策、执行及state已不同；此后锁定历史逐步不同。不能说同一完整方案被抛光变贵，能说声明的整次执行并不保证不退步。

同snapshot的严格降费约束只比较该次已审计construction seed与该次最终候选；它没有保证另一个方法的candidate相同，也没有保证后续真实路径更便宜。polish耗用原构造阶段剩余预算还会改变MILP可用时间及返回候选。独立rolling审核中的80次strict-improvement call、49,276,250韩元same-snapshot合计是重复决策的模型金额，不能另当实现企业节省或一次episode收益相加。

## 4. 不同初始方案和未知失败须保留

五法都具备完整可比D0计划的主案例只有15个，其中0个五法全部相同；其余21个不能做五法完整初始比较。不能把“0全相同”写成“36全部确认不同”，也不能把空/部分记录当同一初始计划。锁定恢复vs抛光单独有29个可比初始对，22相同/7不同/7不可比，不能扩大为所有27个完成案例同初始。

V7费用抛光的九个未完成案例如下。它们终费null，状态均no_feasible_schedule_found；该状态本身不能证明原名义模型、当前锁定模型或actual全知模型不可行。旧V5的3/4/1 native分层和4/16必要cut不能迁移到这些新seed。

| 主V7未完成ID | 失败day（0起） | 原状态 |
| --- | --- | --- |
| v7-aged-backlog-tight-n24-r1 | 0 | no_feasible_schedule_found |
| v7-aged-backlog-tight-n24-r2 | 7 | no_feasible_schedule_found |
| v7-aged-backlog-tight-n50-r1 | 0 | no_feasible_schedule_found |
| v7-aged-backlog-tight-n50-r2 | 0 | no_feasible_schedule_found |
| v7-aged-backlog-tight-n100-r1 | 0 | no_feasible_schedule_found |
| v7-aged-backlog-tight-n100-r2 | 0 | no_feasible_schedule_found |
| v7-new-arrivals-tight-n50-r2 | 3 | no_feasible_schedule_found |
| v7-new-arrivals-tight-n100-r2 | 0 | no_feasible_schedule_found |
| v7-batch-release-tight-n24-r1 | 0 | no_feasible_schedule_found |

锁定恢复有些raw plannerStatus=infeasible，但那也是该实现当时锁模型的状态，不自动升级为原始输入全局无解或现实港口不可恢复。若要给出新的nominal/actual/prefix分层，需要另行冻结/标明离线预算与证书，本审查不运行它。

## 5. 方法、计算与原件的声明边界

GRASP对照有经典外部来源：作者公开Resende/Ribeiro报告、value-based RCL、多启动、first-improvement。实际是对完整提卸还trip的港口日模型适配，α=0.25、资源影响0.15、最多128构造、有限单/双箱邻域、无MILP；不是原论文代码复现、reactive GRASP或SOTA。开发期15→127次重启上限依据旧V5两个12箱输入的未用满预算观察，发生在新seed生成之前并已记录；不能隐去这一开发选择或写完全没有数据辅助设计。

主协议新seed91001…91036、共同父进程5,000ms冷episode预算，从fork前到IPC和父层收费/资源/物理ledger终检；每一方法有不同调用次数和内部时钟语义。V4/V5内部solver0.2s，V6/V7/GRASP是整函数合作式200ms，实际可overrun；不能称五法调用绝对200ms或总CPU相同。研究完成记录/源snapshot可核对，但保存的时钟不能独立证明当时CPU隔离和绝对实时中断。

收费结果针对声明的PNC规则及Maersk模型解释、合成订单/容量/扰动，不是实际合同或真实invoice。不能用字段审计、港口事件或RCPSP最优参考替代费用合同与业务效果验证。

## 6. 公开480例验证的范围

PSPLIB j30保留原通用RCPSP及官方OPT参考，没有PortPlan字段映射。480个是ProGen已发表生成基准，非现实物流订单/新留出。warm每方法100ms合作时钟、最多256步；引用MIT ALNS example的SGS/segment/random insertion，但没有完整原adaptive ALNS的全部算子、justification和5,000步设置。

| 记录 | 固定SerialSGS | 受限IteratedSGS |
| --- | --- | --- |
| 及时完整 | 480 | 480 |
| 等于官方最优参考 | 172 | 353 |
| gap中位tick | 4.5 | 0 |
| gap p95% | 27.2727 | 4.6154 |
| median方法ms | 0.032348 | 12.576058 |

307更短/173相同/0更长，makespan合计31,179→28,604、减少8.258764%；但保持共同初解并只接受不差结果的incumbent guard使0更长符合设计，不能据此声称全算法/所有输入无风险。迭代实际CPU明显更多，仍有127个没达到最优、最差12tick/17.647059%。独立审核从原始资源/先后约束确认960个计划及候选，匹配参考值不是新求解器最优证明。项目due/tardiness不是RCPSP硬期限，原时间是抽象tick；运输端点、p到r箱位及费用没有被验证。

官网明确允许research evaluation，未取得原数值文件MIT/CC再分发许可；原TGZ/OPT/merged缓存按URL+SHA下载，不混进公开ZIP。方法MIT通知和原代码保留，不把它继承为数据许可。

## 7. 公开散粮日志不是箱链或容量实测

Zenodo22019684原SQLite、CC BY4.0，发布者声称现场采集，采集真实性尚未独立认证。489个分配观测窗口中454完整有序、35缺观察；50个Truck对象不是已知可用车队。重复event ID及关联膨胀按原出现身份保留，不能把join行数当实际事件数。

记录时钟均无时区/同步校准；进出港差中位4,231秒、LoadTruck→重车称重差中位2,108秒都只是记录跨度，LoadTruck是否开始/结束也未知，不是实际装卸service或容量利用率。35缺观察不等于物理失败或未交付订单。分析采用事后完整Truck→Pickup Plan分配窗，不是在线planner信息集。

箱生涯、卸船release、仓库/箱位/运力容量、matched empty return及收费合同缺失；无合成补填。这条公开日志独立SQL审核支持身份、关联、记录时序，不把它加入36个模拟费用案例或480个RCPSP分母，也不需要用户提供私有订单才能完成上述公开验证。

## 8. 全部负例ID

以下ID直接从两组raw共同完成对的实际费用重算，与归档negativeSavingsCaseIds一致。空组写“无”，保留副对照不利结果。

### polishVsLocked

主36：无。

开发36：`v6-batch-release-tight-n50-r2--development-control`。

### polishVsStable

主36：`v7-aged-backlog-balanced-n50-r1`, `v7-batch-release-balanced-n100-r1`, `v7-batch-release-balanced-n100-r2`, `v7-batch-release-tight-n50-r1`, `v7-batch-release-tight-n50-r2`。

开发36：`v6-aged-backlog-balanced-n24-r1--development-control`, `v6-aged-backlog-balanced-n50-r1--development-control`, `v6-aged-backlog-balanced-n50-r2--development-control`, `v6-batch-release-balanced-n50-r1--development-control`, `v6-batch-release-balanced-n50-r2--development-control`, `v6-batch-release-balanced-n100-r1--development-control`, `v6-batch-release-balanced-n100-r2--development-control`, `v6-batch-release-tight-n50-r1--development-control`, `v6-batch-release-tight-n50-r2--development-control`。

### graspVsLocked

主36：`v7-aged-backlog-balanced-n24-r1`, `v7-aged-backlog-balanced-n24-r2`, `v7-aged-backlog-balanced-n100-r1`, `v7-batch-release-balanced-n24-r1`, `v7-batch-release-balanced-n24-r2`, `v7-batch-release-balanced-n50-r1`, `v7-batch-release-balanced-n50-r2`, `v7-batch-release-balanced-n100-r2`。

开发36：`v6-aged-backlog-balanced-n24-r1--development-control`, `v6-aged-backlog-balanced-n24-r2--development-control`, `v6-aged-backlog-balanced-n100-r1--development-control`, `v6-aged-backlog-balanced-n100-r2--development-control`, `v6-batch-release-balanced-n24-r1--development-control`, `v6-batch-release-balanced-n100-r1--development-control`, `v6-batch-release-balanced-n100-r2--development-control`。

### polishVsGrasp

主36：`v7-aged-backlog-balanced-n100-r2`。

开发36：`v6-batch-release-balanced-n24-r2--development-control`, `v6-batch-release-balanced-n50-r1--development-control`。

### lockedVsStable

主36：`v7-aged-backlog-balanced-n50-r1`, `v7-batch-release-balanced-n100-r1`, `v7-batch-release-balanced-n100-r2`, `v7-batch-release-tight-n50-r1`, `v7-batch-release-tight-n50-r2`。

开发36：`v6-aged-backlog-balanced-n24-r1--development-control`, `v6-aged-backlog-balanced-n50-r1--development-control`, `v6-aged-backlog-balanced-n50-r2--development-control`, `v6-batch-release-balanced-n50-r1--development-control`, `v6-batch-release-balanced-n50-r2--development-control`, `v6-batch-release-balanced-n100-r1--development-control`, `v6-batch-release-balanced-n100-r2--development-control`, `v6-batch-release-tight-n50-r1--development-control`, `v6-batch-release-tight-n50-r2--development-control`。

### stableVsDaily

主36：`v7-aged-backlog-balanced-n24-r2`, `v7-aged-backlog-balanced-n50-r1`, `v7-new-arrivals-tight-n50-r2`, `v7-batch-release-tight-n50-r2`。

开发36：`v6-new-arrivals-tight-n24-r1--development-control`, `v6-batch-release-balanced-n50-r1--development-control`, `v6-batch-release-balanced-n50-r2--development-control`, `v6-batch-release-tight-n24-r2--development-control`, `v6-batch-release-tight-n50-r1--development-control`。

## 9. 可重复性与最终表述检查

原始完整rolling文件为118,230,496B，网页view是回放投影，不能替代阶段/候选/锁历史原档。Git transport使用可校验分块/manifest；复原脚本只恢复缺失原档并校验SHA，不替换已有原档，不是新实验。后续重跑必须写新路径且限时结果会随设备/负载变化。原始协议和first-run源码snapshot优先，不用当前改动源码重新命名首次结果。

当前prepare-public实际生成四份：portplan-source.zip、portplan-experiments-v6.zip、portplan-experiments-v7.zip、portplan-public-inputs-v6.zip；最后一份也容纳V7许可方法及来源页。复现全部历史与本轮应取齐并在同一portplan/根合并，别沿用V6“只有三份”而漏掉V7实验包。PSPLIB数值缓存独立按官方URL/SHA取得，复制方法许可不会取消数据范围限制。

检查了三份review的valid:true及inputHashes，均与当前原件匹配。它们是内部独立实现/只读复核，不是外部机构认证；钟表、数据发布真实性和现场效用不在其证明范围。发布后的source-profile元信息现已链接实际独立审核及480例/960结果计数；该非冻结状态信息更新没有改变取得原件、冻结协议、首次源码或结果。本审查只写本文件，没有改旧manifest。

最终可用表述：费用抛光在这批新合成输入中相对锁定恢复改善配对费用并多一个完成，但在其他对照/开发控制有费用或完成损失；经典来源适配提升对照可解释性；公开原模型及原港口日志提供不同粒度的外部部分核验。不能写第一/保证获奖、SOTA、全局最优、不退步或现实合同节费。研发和材料主要由AI完成，用户个人创作/理解与当届AI资格仍未确证，不代签/报名；没有私有数据前置需求。

## 核对的关键原件SHA-256

| 原件 | SHA-256 |
| --- | --- |
| data/rolling-v7.json | `a8b0d67f7ff5fbf3b27fe260ab8d9d17be331a9942df37704d8d8365546000c6` |
| data/protocol-v7.json | `bb70fa6938ffbb162347142cbb2788f9ece00ac695a8b8ed5a647cd08aedb96f` |
| vendor/experiments/v7-first-run-source/manifest.json | `2c529a3341f69983a669098858ae3f6a39445dd3eb1e287e584b9630e24bd32f` |
| data/rolling-review-v7.json | `580b0c92a329020c6d986ee39b4e9153da6b688bb0d37d8464ef94895e6024d6` |
| data/public-resource-v7.json | `8006575658f320ba0db851af8e6f0251ac9935bb8d72790bf0b9f405594d4dd6` |
| data/protocol-public-v7.json | `8c5370eaf867b167663717b97e6c895b796dbb832b84375ef61ad3a5b4bed364` |
| data/public-resource-review-v7.json | `0ca57ba433fad8ae94bbee4a3ae03b571fcfcefc4bd34145f761f4a8f08d0c40` |
| data/port-ledger-v7.json | `2e0d2f31587b2455f85388092ef3fcc7fd94e9d11644613d42eb78c6beb9362b` |
| data/port-ledger-review-v7.json | `62dd82362c1cbd89b3eff81fb0cb400ccf93f535eb3fad152c66dacddd65a100` |
| data/public/v7-external-methods/manifest.json | `bc8217f6bc6a3ccfcc22c44d487100cdae844b5bdd89aa14b77e3b5783522990` |
