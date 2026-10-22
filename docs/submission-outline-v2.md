# PortPlan V2：6–8页论文式竞赛报告架构与证据台账

版本：2026-10-12，V2归档已完成独立复算。以下页数是作者的排版建议，**不是已核实的官方报告篇幅限制**。官方公开材料要求提交报告及数据/代码，演示材料不超过20页；公开资格包含在读研究生；单人资格下限、AI边界、英语答辩许可、评分权重、答辩时长尚未确证。实际提交前以当届主办方回复及最新通知为准。本文件不构成已提交或已获准参赛的记录。

建议题目：**公开追溯阶梯费率下的进口箱提箱—卸货—还空联合排程：可复现实验与适用边界**。

韩文：**공개 소급형 단계요율을 고려한 수입 컨테이너 반출·적출·공컨테이너 반납 통합 일정계획: 재현 가능한 실험과 적용 한계**。

这里的“적출”指从箱内卸货，避免与码头船边卸船“양하”混淆。目标使用者可写成“拟服务昌原地区进口企业的计划人员”，不能写成“已与昌原企业合作”或“昌原实单验证”。

## 一、研究命题与可证伪条件

研究问题：在指定公开收费规则、合同解释和日级资源约束下，联合决定提箱、卸货及空箱归还，是否相对明确实现的强基线降低费用；收益依赖哪些条件？

贡献声明按证据逐级开放，不把“系统能运行”直接升级成“方法领先”：

| 证据等级 | 允许的声明 | 必须满足的门槛 | 否定/收窄条件 |
|---|---|---|---|
| 规则工程 | 正确编码已核实的PNC追溯收费机制 | 原件、适用范围、费率边界、独立算例一致 | 来源冲突未解决、单位或起止日错误 |
| 建模工程 | 在列明假设下产生可审核的完整日计划 | 每箱时序、三类容量、截止期、费用分别复算 | 丢箱、期限或容量违反、无解被记零费用 |
| 算法比较 | 在固定合成场景上优于所实现强基线 | 同输入/信息/约束；公平预算；全部结果保留 | 强基线持平或更优时，不再主张普遍优势 |
| 机制价值 | 联合费用或追溯档位对决策有可量化影响 | 消融求排程后统一按目标收费规则复算 | 消融差为零时，只能说机制已实现 |
| 稳健性 | 在指定扰动集合内仍有效 | 合同/容量/时序变化全部报告，含坏结果 | 仅默认参数有效时，声明仅限默认情景 |
| 业务价值 | 在真实业务上可实现节省 | 完整且可审计的实际订单、资源、合同及回放/现场证据 | 当前缺失，不开放这一级声明 |
| 创新性 | 与某一明确已有方法存在可核实差异 | 逐篇/逐产品对照、作者自己的实质改进 | 尚有直接先例，不使用“首次联合优化” |

## 二、8页主报告布局（可压至6页）

| 页 | 内容与要回答的问题 | 最小证据/图表 | 必须紧邻的限制 |
|---|---|---|---|
| 1 | 标题、摘要、问题：为什么一天可能产生非线性费用变化？给出研究问题及贡献边界 | PNC 20英尺第14日318,500→第15日500,500 KRW的原规则算例；提—卸—还决策图 | 算例是费率机制，不是优化收益；研究使用合成订单 |
| 2 | 数据与来源：哪些是真实规则，哪些是生成的订单，哪些只是外部观测？ | 字段来源表；2026 PDF与旧网页差异；Maersk分开收费通知；真实订单缺失清单 | 光阳车辆进出不是PNC箱级订单，没有进入收益验证 |
| 3 | 方法：收费函数、变量、约束、业务语义 | 一组公式；时间轴；08:00边界、按箱/TEU容量、运输额度定义 | 日级静态、运输额度不是车数、预约/司机/路径未建模；按实际V2实现更新 |
| 4 | 相关工作与可定位贡献：比已有工作具体多/少什么？ | 3–5篇相关文献与商业工具功能矩阵；来源原文允许确认的差异 | 文献已有提还箱、拆箱/滞箱及不确定D&D；不能宣称联合优化首创 |
| 5 | 实验协议：如何让对照有机会推翻我们？ | 生成机制×规模×容量×种子矩阵；强基线预算；冻结协议哈希/时间 | 冻结只能证明记录生成后不改，不能自动证明从未试验；种子/重复订单相关性明示 |
| 6 | 主要结果：强基线是否已接近最优？ | 可行率与状态表；配对增量/总费用；按机制/规模分面；失败案例表 | 只对完整可行配对计算百分比；超时≠不可行；描述性场景汇总不等于企业平均收益 |
| 7 | 消融、敏感性和反例：贡献来自何处、什么时候失效？ | PNC-only/D&D-only/joint；规则变化；资源扰动；至少一个零收益或坏案例 | 统一真实研究计费复算；无扰动回放时不写“鲁棒” |
| 8 | 讨论、结论、复现、作者/AI贡献 | 可开放声明清单；部署缺口；源码/数据/协议索引；AI披露 | 不写官方评分、胜率、已验证商业ROI；参赛资格与AI规则待核实 |

6页版：第1页兼容第4页的简要相关工作，第7页并入第6页的下半部分；完整文献矩阵和敏感性表进附录。不得压掉来源区别、失败案例或公平比较定义来腾空间。摘要最后写，必须与最终V2结果一致。

## 三、核心公式与术语要求

对箱i，提箱日p_i、卸货开始日u_i、还空日r_i、卸货天数L_i。V2约束为p_i≥release_i，u_i≥p_i，r_i≥u_i+L_i−1+lag，u_i+L_i−1≤due_i；默认lag=1，允许最后卸货日归还的压力配置lag=0。运输按每日提/还事件计，卸货按连续占用日计，场地按提箱至还空前占用日计。

PNC的指定标准费用：`max(0,储存日数−4) × 最终达到档位单价 × TEU`。Maersk本版逐档累加解释须独立注明“当地合同尚未核实”。

成本口径：`C_total = C_PNC + C_DD`；`C_incremental = C_total − C_prior_base`。`C_prior_base`是按规划期前一日规则计算的固定比较基数，不是已支付费用证明，也不是会计定义的沉没成本。两种目标相差常数，最优排程相同；百分比不同。报告绝对KRW差及两个分母。

配对指标：`Σ(C_baseline−C_candidate) / Σ(C_baseline)`，基准为同场景最便宜完整可行的指定基线。提供配对数量和排除原因；不能把未排完订单的费用混入。强基线与优化候选相等时，写持平；若优化候选更贵，保留负改善。

## 四、拟用证据与文件索引

- 规则与来源：`data/source_registry.json`、`docs/source-audit.md`、`data/public/pnc_2026_standard_tariff.pdf`、`data/public/maersk_pnc_storage_2023.pdf`。
- V1可核验历史：`data/benchmark.json`、`docs/evaluation.md`、`docs/reviewer-challenge.md`。V1的9.8129%不能充当V2结果。
- V2实验：`data/benchmark-v2.json`、`docs/evaluation-v2.md`及冻结协议；`data/robustness-v2.json`与`data/conservative-v2.json`分别记录运营压力与事后设计的保守缓冲补充。独立复算命令`python scripts/review-v2.py`；`data/review-v2.json`记录归档哈希、435完整排程检查、6保守名义费用复算与30保守约束检查。
- 文献与规则复核：`docs/prior-art-v2.md`及`docs/rules-status-v2.md`。9项研究、3项产品按实际阅读深度区分；Jeong2020/2026是直接先例。PortPro公开资料也已描述满箱提取/空箱归还自动匹配，不可声称竞品只展示费用。
- 许可与求解器：`LICENSE`、`THIRD_PARTY.md`、`docs/solver-source.md`。把应用代码、求解器、原始规则文档的权属分别列出。
- 答辩与演示：`docs/competition-defense-v2.en.md`（英文主稿），`docs/competition-defense-v2.ko.md`（韩语简要摘要/术语）；红队门槛与复算：`docs/reviewer-v2.md`。

## 五、作者贡献与AI辅助透明记录模板

以下是**待本人逐项核实填写的模板**，不能由AI替参赛者认领尚未做过的工作。保存实际日期、文件版本与可检查的修改/测试证据；不需要保存或提交私密思维过程。

| 日期/版本 | 工作与决定 | 本人具体完成内容 | AI辅助内容/工具版本 | 本人验证方式及结果 | 对应文件/提交/测试 | 尚未理解或未验证之处 |
|---|---|---|---|---|---|---|
| 待填写 | 问题边界与使用者选择 | 待本人填写 | 例如候选问题整理，不预填为事实 | 查阅来源、解释排除项 | 待填写 | 待填写 |
| 待填写 | 费用规则与合同假设 | 待本人填写 | 例如资料摘录/代码草稿 | 手算边界，与原文逐条核对 | 待填写 | 待填写 |
| 待填写 | 模型与优化器 | 待本人填写 | 例如变量/约束草稿、实现辅助 | 口头解释约束、枚举小例、失败测试 | 待填写 | 待填写 |
| 待填写 | 实验设计与反例 | 待本人填写 | 例如场景生成、审计建议 | 核对预算、未筛选结果、复算 | 待填写 | 待填写 |
| 待填写 | 界面、写作与英语答辩 | 待本人填写 | 例如前端实现/翻译润色 | 本人逐页运行、来源检查、答辩演练 | 待填写 | 待填写 |

可在本人核实后使用的披露文本：

> 本作品使用GLPK/glpk.js等开源软件，并使用AI辅助工具进行部分资料整理、代码与文字草拟、测试设计及翻译。各工具及使用范围在贡献记录中列明。提交者负责核对公开来源、模型假设、实现与实验结果，并对最终声明承担责任。开源求解器及AI辅助部分不作为提交者独立原创算法声明。参赛政策适用性以主办方确认结果为准。

本人答辩掌握门槛：不看讲稿解释15日费用算例；解释减常数为什么不改排程；用两箱三天画出容量冲突；区分求解超时、启发式失败和数学不可行；定位一项未证实收费假设；复现一个负/零收益案例；说明代码哪部分使用开源、哪部分AI辅助、哪部分本人验证。

## 六、交付前证据门槛

1. 每个摘要数字能定位到数据文件、case集合、分母与脚本；V1/V2不混用。
2. 每个成功排程通过费用与容量独立复算；每种异常状态有真实用例。
3. 强基线、资源预算、所有失败/负改善和不配对数量公开。
4. “联合”“追溯档位”“稳健性”的贡献分别有对应消融或收窄措辞。
5. 相关工作存在直接先例，摘要不使用首次/唯一/行业最优。
6. 数据真实性与隐私、软件与原始材料许可边界清楚。
7. 本人完成贡献记录及答辩掌握验证；未核实规则仍标待核实。

以上是内部证据门槛，不是官方评分或保证获奖的清单。

## 七、已核验结果如何落入正文

**摘要主数值：** 主48组不同生成订单中，MILP44组完整可行（33模型最优、11仅可行），4模型不可行；strongSearch36组完整可行。36组配对的模型费用差为20,073,600 KRW，占基准增量15.74%、总两费8.86%；19改善、17持平、0变差。14组新到港配对均为双方零费用，因此摘要必须限定积压与集中释放下的价值，不写普适降本。

**第6页反例：** `scale-new-arrivals-tight-n100`中strongSearch完整零费、原MILP在2秒内没有找到解；100箱总共只有1组成本配对。`batch-release-balanced-n16-r3`中强搜索与MILP同为145,600 KRW。不能只展示最优器胜出的案例。

**第7页机制及取舍：** PNC误设逐档代理在默认规则复算多185,200 KRW（6对）；storageOnly严格完成次级平局优化的5对仅多87,550 KRW，不能采用含未完成平局优化case的189,350作为严格贡献；ddOnly多487,550且全部集中于一个基础订单。静态原计划18次固定扰动有16次失效。探索性保守规则使18次检查均可行，但总两费增加4,652,550 KRW/32.29%；其保证依赖明确的时长/运力范围，不是在线恢复或随机失效率。

**用于首页的英文摘要草稿：**

> PortPlan studies pickup, devanning, and empty-return scheduling under the published 2026 PNC storage tariff and a disclosed interpretation of Maersk Korea D&D. The model preserves PNC's retroactive highest-bracket charge and enforces daily transport, unloading, staging, and delivery constraints. Forty-eight distinct synthetic order sets cover aged backlog, new arrivals, and batch releases at two capacities and two scales. The MILP produced 44 complete feasible plans, including 33 model-optimal solutions; a fixed-budget multi-start permutation search produced 36. Across 36 feasible pairs, the modeled cost difference was KRW 20,073,600, or 15.74% of incremental charges and 8.86% of total charges. All 14 paired new-arrival cases had zero charges under both methods. A separate 100-container case favored the heuristic in solution availability. Six additional operational cases exposed 16 invalid original plans across 18 fixed disruption checks. An exploratory conservative buffer preserved feasibility in those checks and within its stated daily uncertainty envelope, at a 32.29% increase in total modeled charges. Independent recalculation checked archived costs and constraints. These results support a conditional application and reproducibility contribution, not algorithmic novelty, verified shipment billing, online recovery, or realized enterprise savings.

摘要引用的主实验、单列100箱、运营压力、事后保守补充是四种不同证据，正文必须分开。固定迭代strongSearch与2秒MILP不是等CPU比较，强搜索也不是经认证的先进算法；摘要篇幅不足时把这两点放紧邻的实验口径框，不能省掉。
