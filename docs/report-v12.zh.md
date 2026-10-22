# PortPlan V12：及时完整初解与同费必要仓位

AI 编写的准备材料；不代表本人已理解、亲自完成、已经报名或通过浏览器验收。公开资料主路线无需企业实单、私人报价或联系人；企业试点为可选增强。

200ms 是调用合作式目标，不是硬返回保证；完整冷 episode 5 秒须包含父进程终态审核、worker正常退出及进程组清理验证，仅及时收件不算完成。旧 15/15 D0 初解开发的调用返回约 207–220ms，不是全部 63 个 D0 失败，更不是完整路径完成率。
本轮 144 个新业务场景、3 次预固定算法/时钟重复、6 方法，共 2,592 次 episode。重复不是独立业务样本；失败费用为 null。全路径结果包含不同初始计划，不自动归因为相同历史下恢复。
费用和改期使用各对共同完成集合，先场景内平均、再等权；场景聚类区间不能消除完成选择偏差。任何基准完成损失不能由净增、费用或 Pareto 抵消。V5 未列入本轮，不推断对 V5 不退步。
必要仓位是当前快照下的必要下界，不预测未来。CP-SAT 只作旧 9 快照独立诊断，不混入正式六法分母，也不据此宣称胜过 CP-SAT。

## 01. 先交付完整初解，再比较同费必要仓位

V12将及时接受的完整初解与同费候选必要仓位选择结合；初始化、后续失败与整段完成分别检验。

## 02. 日级约束和两费模型

提箱和还空分别消耗运输箱次；卸货连续占用仓库，在场占用为[p,r)。未建模路线、日内预约、私有合同和全部企业成本。

## 03. 公开证据主路线

公开费率、公开观测、数学基准和合成实验各有范围。企业实单、私人报价、联系人和试点为可选增强，不是继续研发的条件。

## 04. 完整初解共享原有调用时钟

没有有效incumbent时，构造与独立审核也计入原200ms合作式调用；原生求解只使用剩余预算。内部发现或函数返回不能代替实际接受记录。

## 05. 必要仓位是下界

同费候选的明日必需仓位得分来自当前快照的必要下界，不预测未公告容量，也不保证未来完整执行或全局最少改期。

## 06. 合作式预算不等于硬返回保证

旧D0开发的15个及时初解与约207–220ms调用返回必须同时披露；它不是全部63个D0失败，也不是15次完整滚动完成。

## 07. 场景、重复与六方法

正式记录使用144个新业务场景、三次固定算法/时钟重复和六方法；生成器与扰动目录沿用既有规则。重复不能当成新的独立业务样本。

## 08. 同生成机制：初始化与后续失败

按同一正式输入列出完整执行、初始计划接受、已知D0失败、已知后续失败和未知D0历史。未知不能改填为零。

| 方法 | 完整 | 初始接受 | D0失败 | 后续失败 | D0未知 |
| --- | --- | --- | --- | --- | --- |
| costPolishV7 | 166/216 | 183 | 33 | 17 | 0 |
| adaptiveV9 | 165/216 | 183 | 33 | 18 | 0 |
| highsV8 | 166/216 | 175 | 41 | 9 | 0 |
| stableHiGHSV10 | 169/216 | 175 | 41 | 6 | 0 |
| commitmentHiGHSV11 | 169/216 | 175 | 41 | 6 | 0 |
| seededHiGHSV12 | 181/216 | 187 | 29 | 6 | 0 |

## 09. 压力扰动：初始化与后续失败

压力面板单列，不与同分布合并排名。完整初解接受不等于完成整条真实冲击路径。

| 方法 | 完整 | 初始接受 | D0失败 | 后续失败 | D0未知 |
| --- | --- | --- | --- | --- | --- |
| costPolishV7 | 79/216 | 186 | 30 | 107 | 0 |
| adaptiveV9 | 81/216 | 186 | 30 | 105 | 0 |
| highsV8 | 105/216 | 179 | 37 | 74 | 0 |
| stableHiGHSV10 | 114/216 | 179 | 37 | 65 | 0 |
| commitmentHiGHSV11 | 111/216 | 178 | 38 | 67 | 0 |
| seededHiGHSV12 | 120/216 | 189 | 27 | 69 | 0 |

## 10. 同生成机制：各基准的共同完成比较

每对比较使用自己的共同完成场景及重复。正节省表示候选更便宜，负数表示更贵；区间跨零不能称稳健费用优势。

| V12 / 基准 | 完成增/损 | 场景/配对 | 新增两费节省 | 条件95%区间 | 改期基准→V12 |
| --- | --- | --- | --- | --- | --- |
| commitmentHiGHSV11 | 13/1 | 57/168 | -0.00% | [-0.01812661245, 0] | 17177→16734 |
| stableHiGHSV10 | 13/1 | 57/168 | 0.04% | [-0.02692932798, 0.1664756] | 12007→16734 |
| highsV8 | 19/4 | 55/162 | -0.12% | [-0.3968766484, 0.04366916925] | 56594→16245 |
| adaptiveV9 | 21/5 | 54/160 | 9.56% | [6.531162036, 12.96666403] | 7285→19552 |
| costPolishV7 | 20/5 | 55/161 | 10.12% | [6.999731622, 13.80005201] | 7182→19828 |

## 11. 压力扰动：各基准的共同完成比较

费用和改期必须在完全相同的配对集合中解释，先场景内平均再等权。不能跨分母宣布综合领先。

| V12 / 基准 | 完成增/损 | 场景/配对 | 新增两费节省 | 条件95%区间 | 改期基准→V12 |
| --- | --- | --- | --- | --- | --- |
| commitmentHiGHSV11 | 9/0 | 37/111 | 0.00% | [0, 0] | 16515→17272 |
| stableHiGHSV10 | 9/3 | 37/111 | -0.02% | [-0.08227406499, 0.00276016906] | 13488→17272 |
| highsV8 | 18/3 | 34/102 | -0.73% | [-2.354613746, -0.01998982964] | 35943→15817 |
| adaptiveV9 | 50/11 | 24/70 | 8.38% | [0.9787944182, 12.51218319] | 6130→8495 |
| costPolishV7 | 51/10 | 23/69 | 6.70% | [1.698662058, 10.10465301] | 5846→8217 |

## 12. 同生成机制：六法共同集合

六法共同完成集合与两两配对集合不同；费用和改期分别作为轴，不将一次改期任意换算为韩元。

| 方法 | 场景均值总两费之和 | 场景均值新增两费之和 | 场景均值改期之和 |
| --- | --- | --- | --- |
| costPolishV7 | 313,500,717 | 181,128,317 | 1,814.00 |
| adaptiveV9 | 312,431,017 | 180,058,617 | 1,876.33 |
| highsV8 | 294,098,550 | 161,726,150 | 17,316.00 |
| stableHiGHSV10 | 294,337,450 | 161,965,050 | 3,451.00 |
| commitmentHiGHSV11 | 294,246,450 | 161,874,050 | 5,130.00 |
| seededHiGHSV12 | 294,246,450 | 161,874,050 | 5,018.50 |

## 13. 压力扰动：六法共同集合

共同集合内的Pareto位置不抵消全样本完成损失。无共同样本或未知改期保持null。

| 方法 | 场景均值总两费之和 | 场景均值新增两费之和 | 场景均值改期之和 |
| --- | --- | --- | --- |
| costPolishV7 | 295,541,183 | 172,624,733 | 1,948.67 |
| adaptiveV9 | 298,784,633 | 175,868,183 | 2,009.00 |
| highsV8 | 283,462,250 | 160,545,800 | 7,045.00 |
| stableHiGHSV10 | 283,944,950 | 161,028,500 | 2,354.00 |
| commitmentHiGHSV11 | 283,979,500 | 161,063,050 | 2,735.00 |
| seededHiGHSV12 | 283,979,500 | 161,063,050 | 2,739.00 |

## 14. 预声明观察门槛

对任意包含基准有完成损失即不通过默认候选必要门槛；相对三个原生基准的条件稳定性各自判断。V5未纳入，不推断对V5不退步。

| 패널 | 5기준 손실 0 | 관측 기본값 필요조건 | native/V10/V11 안정성 조건 |
| --- | --- | --- | --- |
| 동일 생성분포 · 새 주문 시드 | False | False | False/False/False |
| 스트레스 · 새 주문 시드 | False | False | False/False/False |

## 15. 全部不利结果

总两费与新增两费的全部负场景、负运行和全部完成损失均在下方逐条保留；不删除昂贵、无解、迟交或未知案例。

| 패널 | V12 / 基准 | 완주 손실 | 총요금 악화 시나리오 | 추가요금 악화 시나리오 |
| --- | --- | --- | --- | --- |
| same-distribution | commitmentHiGHSV11 | 1 | 1 | 1 |
| same-distribution | stableHiGHSV10 | 1 | 2 | 2 |
| same-distribution | highsV8 | 4 | 8 | 8 |
| same-distribution | adaptiveV9 | 5 | 1 | 1 |
| same-distribution | costPolishV7 | 5 | 1 | 1 |
| stress | commitmentHiGHSV11 | 0 | 0 | 0 |
| stress | stableHiGHSV10 | 3 | 1 | 1 |
| stress | highsV8 | 3 | 8 | 8 |
| stress | adaptiveV9 | 11 | 5 | 5 |
| stress | costPolishV7 | 10 | 5 | 5 |

## 16. 开发诊断不混入正式分母

旧D0、同前缀控制延续和CP-SAT旧9快照诊断分别作为开发动机，不是新正式输入或第七种正式方法。

## 17. 证据和跨电脑复现

输入、原始episode、首次冻结源码和两份独立复核由SHA绑定。下载清单全部包合并同根，重跑另建目录，不覆盖首次结果。

| 증거 | SHA-256 |
| --- | --- |
| 정식 index | 141ac68b0627e74ffa41f881078d9d73304263240e858d148c64e91562217646 |
| 물리·선택 검산 | cf1ef392780593c71ad90cfcc1f2a3911d78fdcaa2ee55cd4405929aa66dd757 |
| 통계 검산 | 82e7c19eb8e7b4db27ef98b5d0a94fbb6bbd617fc5381dc22a4b7398d7ca2a17 |

## 18. 本人复现与答辩独立记录

材料生成不等于本人理解、资格报名或真实浏览器验收。使用空表记录实际复现与问答，不代签或代讲，官方时长未知时不杜撰。

## 同生成机制 · 新订单种子

### v12VsV11 · seededHiGHSV12 / commitmentHiGHSV11

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 57/168 | 387,881,900.000000 | 387,891,000.000000 | -0.00% | [-0.01006269807, 0] | 9,100.000000 | {"win": 0, "tie": 56, "loss": 1} |
| total raw episode sums |  | 1,050,848,700.000000 | 1,050,876,000.000000 |  | KRW CI [-478.9473684, 0] |  |  |
| incremental | 57/168 | 214,380,000.000000 | 214,389,100.000000 | -0.00% | [-0.01812661245, 0] | 9,100.000000 | {"win": 0, "tie": 56, "loss": 1} |
| incremental raw episode sums |  | 584,955,100.000000 | 584,982,400.000000 |  | KRW CI [-478.9473684, 0] |  |  |

Completion gained/lost: 13/1; completion scenario CI [0.009259259259, 0.1111111111]
Revisions on same matching complete set: 17177 → 16734; n=168

**total/negativeScenarioIds — ALL retained**

- `v12-same-distribution-new-arrivals-tight-n50-r4`

**total/negativeEpisodeIds — ALL retained**

- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-3`

**incremental/negativeScenarioIds — ALL retained**

- `v12-same-distribution-new-arrivals-tight-n50-r4`

**incremental/negativeEpisodeIds — ALL retained**

- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-3`

**gainedEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v12-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v12-same-distribution-aged-backlog-tight-n50-r3::repeat-1`
- `v12-same-distribution-aged-backlog-tight-n50-r3::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n100-r2::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n100-r2::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n100-r2::repeat-3`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-3`

**lostEpisodeIds — ALL retained**

- `v12-same-distribution-new-arrivals-tight-n100-r4::repeat-1`

### v12VsV10 · seededHiGHSV12 / stableHiGHSV10

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 57/168 | 387,972,900.000000 | 387,891,000.000000 | 0.02% | [-0.01516333447, 0.09580876055] | 30,000.000000 | {"win": 4, "tie": 51, "loss": 2} |
| total raw episode sums |  | 1,051,121,700.000000 | 1,050,876,000.000000 |  | KRW CI [-1062.587719, 5015.219298] |  |  |
| incremental | 57/168 | 214,471,000.000000 | 214,389,100.000000 | 0.04% | [-0.02692932798, 0.1664756] | 30,000.000000 | {"win": 4, "tie": 51, "loss": 2} |
| incremental raw episode sums |  | 585,228,100.000000 | 584,982,400.000000 |  | KRW CI [-1062.587719, 5015.219298] |  |  |

Completion gained/lost: 13/1; completion scenario CI [0.009259259259, 0.1111111111]
Revisions on same matching complete set: 12007 → 16734; n=168

**total/negativeScenarioIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r2`
- `v12-same-distribution-new-arrivals-tight-n50-r4`

**total/negativeEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-3`

**incremental/negativeScenarioIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r2`
- `v12-same-distribution-new-arrivals-tight-n50-r4`

**incremental/negativeEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-3`

**gainedEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v12-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v12-same-distribution-aged-backlog-tight-n50-r3::repeat-1`
- `v12-same-distribution-aged-backlog-tight-n50-r3::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n100-r2::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n100-r2::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n100-r2::repeat-3`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-3`

**lostEpisodeIds — ALL retained**

- `v12-same-distribution-new-arrivals-tight-n100-r4::repeat-1`

### v12VsV9 · seededHiGHSV12 / adaptiveV9

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 54/160 | 482,809,416.666667 | 456,196,700.000000 | 5.51% | [3.698049207, 7.755594433] | 30,000.000000 | {"win": 23, "tie": 30, "loss": 1} |
| total raw episode sums |  | 1,408,660,100.000000 | 1,332,013,950.000000 |  | KRW CI [228361.0725, 813875.7176] |  |  |
| incremental | 54/160 | 278,476,716.666667 | 251,864,000.000000 | 9.56% | [6.531162036, 12.96666403] | 30,000.000000 | {"win": 23, "tie": 30, "loss": 1} |
| incremental raw episode sums |  | 808,509,600.000000 | 731,863,450.000000 |  | KRW CI [228361.0725, 813875.7176] |  |  |

Completion gained/lost: 21/5; completion scenario CI [0.004513888889, 0.1527777778]
Revisions on same matching complete set: 7285 → 19552; n=160

**total/negativeScenarioIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2`

**total/negativeEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`

**incremental/negativeScenarioIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2`

**incremental/negativeEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`

**gainedEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-1`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-2`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-3`
- `v12-same-distribution-new-arrivals-balanced-n24-r2::repeat-1`
- `v12-same-distribution-new-arrivals-balanced-n24-r2::repeat-2`
- `v12-same-distribution-new-arrivals-balanced-n24-r2::repeat-3`
- `v12-same-distribution-new-arrivals-balanced-n50-r3::repeat-1`
- `v12-same-distribution-new-arrivals-balanced-n50-r3::repeat-2`
- `v12-same-distribution-new-arrivals-balanced-n50-r3::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n50-r1::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r1::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r1::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v12-same-distribution-batch-release-balanced-n24-r2::repeat-1`
- `v12-same-distribution-batch-release-balanced-n24-r2::repeat-2`
- `v12-same-distribution-batch-release-balanced-n24-r2::repeat-3`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-3`

**lostEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-tight-n50-r3::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n100-r4::repeat-1`

### v12VsHiGHS · seededHiGHSV12 / highsV8

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 55/162 | 387,615,800.000000 | 387,872,800.000000 | -0.07% | [-0.2276973894, 0.02358529862] | 115,000.000000 | {"win": 5, "tie": 42, "loss": 8} |
| total raw episode sums |  | 1,050,020,400.000000 | 1,050,821,400.000000 |  | KRW CI [-11900.68182, 1678.181818] |  |  |
| incremental | 55/162 | 214,113,900.000000 | 214,370,900.000000 | -0.12% | [-0.3968766484, 0.04366916925] | 115,000.000000 | {"win": 5, "tie": 42, "loss": 8} |
| incremental raw episode sums |  | 584,126,800.000000 | 584,927,800.000000 |  | KRW CI [-11900.68182, 1678.181818] |  |  |

Completion gained/lost: 19/4; completion scenario CI [0.00462962963, 0.1388888889]
Revisions on same matching complete set: 56594 → 16245; n=162

**total/negativeScenarioIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2`
- `v12-same-distribution-aged-backlog-tight-n50-r2`
- `v12-same-distribution-new-arrivals-tight-n50-r4`
- `v12-same-distribution-batch-release-balanced-n50-r4`
- `v12-same-distribution-batch-release-balanced-n100-r4`
- `v12-same-distribution-batch-release-tight-n50-r1`
- `v12-same-distribution-batch-release-tight-n50-r3`
- `v12-same-distribution-batch-release-tight-n50-r4`

**total/negativeEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-1`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-2`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v12-same-distribution-batch-release-balanced-n50-r4::repeat-1`
- `v12-same-distribution-batch-release-balanced-n50-r4::repeat-2`
- `v12-same-distribution-batch-release-balanced-n50-r4::repeat-3`
- `v12-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v12-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v12-same-distribution-batch-release-balanced-n100-r4::repeat-3`
- `v12-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v12-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v12-same-distribution-batch-release-tight-n50-r1::repeat-3`
- `v12-same-distribution-batch-release-tight-n50-r3::repeat-1`
- `v12-same-distribution-batch-release-tight-n50-r3::repeat-2`
- `v12-same-distribution-batch-release-tight-n50-r3::repeat-3`
- `v12-same-distribution-batch-release-tight-n50-r4::repeat-1`
- `v12-same-distribution-batch-release-tight-n50-r4::repeat-2`
- `v12-same-distribution-batch-release-tight-n50-r4::repeat-3`

**incremental/negativeScenarioIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2`
- `v12-same-distribution-aged-backlog-tight-n50-r2`
- `v12-same-distribution-new-arrivals-tight-n50-r4`
- `v12-same-distribution-batch-release-balanced-n50-r4`
- `v12-same-distribution-batch-release-balanced-n100-r4`
- `v12-same-distribution-batch-release-tight-n50-r1`
- `v12-same-distribution-batch-release-tight-n50-r3`
- `v12-same-distribution-batch-release-tight-n50-r4`

**incremental/negativeEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-1`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-2`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v12-same-distribution-batch-release-balanced-n50-r4::repeat-1`
- `v12-same-distribution-batch-release-balanced-n50-r4::repeat-2`
- `v12-same-distribution-batch-release-balanced-n50-r4::repeat-3`
- `v12-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v12-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v12-same-distribution-batch-release-balanced-n100-r4::repeat-3`
- `v12-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v12-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v12-same-distribution-batch-release-tight-n50-r1::repeat-3`
- `v12-same-distribution-batch-release-tight-n50-r3::repeat-1`
- `v12-same-distribution-batch-release-tight-n50-r3::repeat-2`
- `v12-same-distribution-batch-release-tight-n50-r3::repeat-3`
- `v12-same-distribution-batch-release-tight-n50-r4::repeat-1`
- `v12-same-distribution-batch-release-tight-n50-r4::repeat-2`
- `v12-same-distribution-batch-release-tight-n50-r4::repeat-3`

**gainedEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v12-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v12-same-distribution-aged-backlog-tight-n50-r3::repeat-1`
- `v12-same-distribution-aged-backlog-tight-n50-r3::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n24-r4::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n24-r4::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n24-r4::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n100-r2::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n100-r2::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n100-r2::repeat-3`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-3`

**lostEpisodeIds — ALL retained**

- `v12-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n100-r4::repeat-1`

### v12VsV7 · seededHiGHSV12 / costPolishV7

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 55/161 | 487,753,683.333333 | 459,104,000.000000 | 5.87% | [3.994891628, 8.346497153] | 30,000.000000 | {"win": 23, "tie": 31, "loss": 1} |
| total raw episode sums |  | 1,415,472,900.000000 | 1,334,921,250.000000 |  | KRW CI [250222.7652, 839287.0833] |  |  |
| incremental | 55/161 | 283,193,483.333333 | 254,543,800.000000 | 10.12% | [6.999731622, 13.80005201] | 30,000.000000 | {"win": 23, "tie": 31, "loss": 1} |
| incremental raw episode sums |  | 815,094,900.000000 | 734,543,250.000000 |  | KRW CI [250222.7652, 839287.0833] |  |  |

Completion gained/lost: 20/5; completion scenario CI [7.517135063e-19, 0.1481481481]
Revisions on same matching complete set: 7182 → 19828; n=161

**total/negativeScenarioIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2`

**total/negativeEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`

**incremental/negativeScenarioIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2`

**incremental/negativeEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`

**gainedEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-1`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-2`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-3`
- `v12-same-distribution-new-arrivals-balanced-n24-r2::repeat-1`
- `v12-same-distribution-new-arrivals-balanced-n24-r2::repeat-2`
- `v12-same-distribution-new-arrivals-balanced-n24-r2::repeat-3`
- `v12-same-distribution-new-arrivals-balanced-n50-r3::repeat-1`
- `v12-same-distribution-new-arrivals-balanced-n50-r3::repeat-2`
- `v12-same-distribution-new-arrivals-balanced-n50-r3::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n50-r1::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r1::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r1::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v12-same-distribution-batch-release-balanced-n24-r2::repeat-1`
- `v12-same-distribution-batch-release-balanced-n24-r2::repeat-2`
- `v12-same-distribution-batch-release-balanced-n24-r2::repeat-3`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-3`

**lostEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-tight-n50-r3::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n100-r4::repeat-1`

### v11VsV10 · commitmentHiGHSV11 / stableHiGHSV10

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 56/168 | 331,574,400.000000 | 331,483,400.000000 | 0.03% | [-0.01310975905, 0.1164386915] | 30,000.000000 | {"win": 4, "tie": 51, "loss": 1} |
| total raw episode sums |  | 994,723,200.000000 | 994,450,200.000000 |  | KRW CI [-908.9285714, 5250.848214] |  |  |
| incremental | 56/168 | 185,378,550.000000 | 185,287,550.000000 | 0.05% | [-0.02343325284, 0.200147288] | 30,000.000000 | {"win": 4, "tie": 51, "loss": 1} |
| incremental raw episode sums |  | 556,135,650.000000 | 555,862,650.000000 |  | KRW CI [-908.9285714, 5250.848214] |  |  |

Completion gained/lost: 1/1; completion scenario CI [0, 0]
Revisions on same matching complete set: 12069 → 17271; n=168

**total/negativeScenarioIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r2`

**total/negativeEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`

**incremental/negativeScenarioIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r2`

**incremental/negativeEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`

**gainedEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`

**lostEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`

### v10VsHiGHS · stableHiGHSV10 / highsV8

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 54/162 | 331,202,300.000000 | 331,556,200.000000 | -0.11% | [-0.3183831832, 0.008262071544] | 115,000.000000 | {"win": 3, "tie": 43, "loss": 8} |
| total raw episode sums |  | 993,606,900.000000 | 994,668,600.000000 |  | KRW CI [-14446.2963, 513.1481481] |  |  |
| incremental | 54/162 | 185,006,450.000000 | 185,360,350.000000 | -0.19% | [-0.5390240255, 0.01525360653] | 115,000.000000 | {"win": 3, "tie": 43, "loss": 8} |
| incremental raw episode sums |  | 555,019,350.000000 | 556,081,050.000000 |  | KRW CI [-14446.2963, 513.1481481] |  |  |

Completion gained/lost: 7/4; completion scenario CI [-0.02777777778, 0.05555555556]
Revisions on same matching complete set: 57288 → 11556; n=162

**total/negativeScenarioIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2`
- `v12-same-distribution-aged-backlog-tight-n50-r2`
- `v12-same-distribution-batch-release-balanced-n50-r4`
- `v12-same-distribution-batch-release-balanced-n100-r4`
- `v12-same-distribution-batch-release-tight-n50-r1`
- `v12-same-distribution-batch-release-tight-n50-r3`
- `v12-same-distribution-batch-release-tight-n50-r4`
- `v12-same-distribution-batch-release-tight-n100-r3`

**total/negativeEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-1`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-2`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-3`
- `v12-same-distribution-batch-release-balanced-n50-r4::repeat-1`
- `v12-same-distribution-batch-release-balanced-n50-r4::repeat-2`
- `v12-same-distribution-batch-release-balanced-n50-r4::repeat-3`
- `v12-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v12-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v12-same-distribution-batch-release-balanced-n100-r4::repeat-3`
- `v12-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v12-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v12-same-distribution-batch-release-tight-n50-r1::repeat-3`
- `v12-same-distribution-batch-release-tight-n50-r3::repeat-1`
- `v12-same-distribution-batch-release-tight-n50-r3::repeat-2`
- `v12-same-distribution-batch-release-tight-n50-r3::repeat-3`
- `v12-same-distribution-batch-release-tight-n50-r4::repeat-1`
- `v12-same-distribution-batch-release-tight-n50-r4::repeat-2`
- `v12-same-distribution-batch-release-tight-n50-r4::repeat-3`
- `v12-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v12-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v12-same-distribution-batch-release-tight-n100-r3::repeat-3`

**incremental/negativeScenarioIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2`
- `v12-same-distribution-aged-backlog-tight-n50-r2`
- `v12-same-distribution-batch-release-balanced-n50-r4`
- `v12-same-distribution-batch-release-balanced-n100-r4`
- `v12-same-distribution-batch-release-tight-n50-r1`
- `v12-same-distribution-batch-release-tight-n50-r3`
- `v12-same-distribution-batch-release-tight-n50-r4`
- `v12-same-distribution-batch-release-tight-n100-r3`

**incremental/negativeEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-1`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-2`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-3`
- `v12-same-distribution-batch-release-balanced-n50-r4::repeat-1`
- `v12-same-distribution-batch-release-balanced-n50-r4::repeat-2`
- `v12-same-distribution-batch-release-balanced-n50-r4::repeat-3`
- `v12-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v12-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v12-same-distribution-batch-release-balanced-n100-r4::repeat-3`
- `v12-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v12-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v12-same-distribution-batch-release-tight-n50-r1::repeat-3`
- `v12-same-distribution-batch-release-tight-n50-r3::repeat-1`
- `v12-same-distribution-batch-release-tight-n50-r3::repeat-2`
- `v12-same-distribution-batch-release-tight-n50-r3::repeat-3`
- `v12-same-distribution-batch-release-tight-n50-r4::repeat-1`
- `v12-same-distribution-batch-release-tight-n50-r4::repeat-2`
- `v12-same-distribution-batch-release-tight-n50-r4::repeat-3`
- `v12-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v12-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v12-same-distribution-batch-release-tight-n100-r3::repeat-3`

**gainedEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n24-r4::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n24-r4::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n24-r4::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r2::repeat-3`

**lostEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n24-r3::repeat-3`

### highsVsV7 · highsV8 / costPolishV7

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 50/148 | 373,063,066.666667 | 350,521,150.000000 | 6.04% | [3.958980448, 8.937754562] | 0.000000 | {"win": 22, "tie": 28, "loss": 0} |
| total raw episode sums |  | 1,000,082,700.000000 | 938,736,450.000000 |  | KRW CI [182889.2083, 794700] |  |  |
| incremental | 50/148 | 213,384,616.666667 | 190,842,700.000000 | 10.56% | [7.005387321, 15.00208725] | 0.000000 | {"win": 22, "tie": 28, "loss": 0} |
| incremental raw episode sums |  | 575,659,450.000000 | 514,313,200.000000 |  | KRW CI [182889.2083, 794700] |  |  |

Completion gained/lost: 18/18; completion scenario CI [-0.08796296296, 0.09259259259]
Revisions on same matching complete set: 5520 → 52710; n=148

**total/negativeScenarioIds — ALL retained**

none / 없음 / 无

**total/negativeEpisodeIds — ALL retained**

none / 없음 / 无

**incremental/negativeScenarioIds — ALL retained**

none / 없음 / 无

**incremental/negativeEpisodeIds — ALL retained**

none / 없음 / 无

**gainedEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-1`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-2`
- `v12-same-distribution-aged-backlog-tight-n50-r2::repeat-3`
- `v12-same-distribution-new-arrivals-balanced-n24-r2::repeat-1`
- `v12-same-distribution-new-arrivals-balanced-n24-r2::repeat-2`
- `v12-same-distribution-new-arrivals-balanced-n24-r2::repeat-3`
- `v12-same-distribution-new-arrivals-balanced-n50-r3::repeat-1`
- `v12-same-distribution-new-arrivals-balanced-n50-r3::repeat-2`
- `v12-same-distribution-new-arrivals-balanced-n50-r3::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n50-r1::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r1::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r1::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v12-same-distribution-batch-release-balanced-n24-r2::repeat-1`
- `v12-same-distribution-batch-release-balanced-n24-r2::repeat-2`
- `v12-same-distribution-batch-release-balanced-n24-r2::repeat-3`

**lostEpisodeIds — ALL retained**

- `v12-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v12-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v12-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v12-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v12-same-distribution-aged-backlog-tight-n50-r3::repeat-1`
- `v12-same-distribution-aged-backlog-tight-n50-r3::repeat-2`
- `v12-same-distribution-aged-backlog-tight-n50-r3::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n24-r4::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n24-r4::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n24-r4::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v12-same-distribution-new-arrivals-tight-n100-r2::repeat-1`
- `v12-same-distribution-new-arrivals-tight-n100-r2::repeat-2`
- `v12-same-distribution-new-arrivals-tight-n100-r2::repeat-3`
- `v12-same-distribution-batch-release-tight-n100-r4::repeat-2`

### All-six common-complete subset and observed necessary gates

```json
{
  "jointCompletePareto": {
    "jointScenarioCount": 48,
    "jointEpisodeCount": 143,
    "eligibility": "all-six-matching-complete-repeats",
    "byMethod": {
      "costPolishV7": {
        "scenarioCount": 48,
        "jointEpisodeCount": 143,
        "scenarioMeanTotalCostSumKRW": 313500716.6666667,
        "scenarioMeanIncrementalCostSumKRW": 181128316.66666666,
        "scenarioMeanRevisionCountSum": 1814,
        "episodeTotalCostSumKRW": 940502150,
        "episodeIncrementalCostSumKRW": 543384950,
        "episodeRevisionCountSum": 5303,
        "knownRevisionEpisodeCount": 143,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 166,
        "fullSampleEpisodeCount": 216
      },
      "adaptiveV9": {
        "scenarioCount": 48,
        "jointEpisodeCount": 143,
        "scenarioMeanTotalCostSumKRW": 312431016.6666667,
        "scenarioMeanIncrementalCostSumKRW": 180058616.66666666,
        "scenarioMeanRevisionCountSum": 1876.3333333333333,
        "episodeTotalCostSumKRW": 937293050,
        "episodeIncrementalCostSumKRW": 540175850,
        "episodeRevisionCountSum": 5490,
        "knownRevisionEpisodeCount": 143,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 165,
        "fullSampleEpisodeCount": 216
      },
      "highsV8": {
        "scenarioCount": 48,
        "jointEpisodeCount": 143,
        "scenarioMeanTotalCostSumKRW": 294098550,
        "scenarioMeanIncrementalCostSumKRW": 161726150,
        "scenarioMeanRevisionCountSum": 17316,
        "episodeTotalCostSumKRW": 882295650,
        "episodeIncrementalCostSumKRW": 485178450,
        "episodeRevisionCountSum": 50978,
        "knownRevisionEpisodeCount": 143,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 166,
        "fullSampleEpisodeCount": 216
      },
      "stableHiGHSV10": {
        "scenarioCount": 48,
        "jointEpisodeCount": 143,
        "scenarioMeanTotalCostSumKRW": 294337450,
        "scenarioMeanIncrementalCostSumKRW": 161965050,
        "scenarioMeanRevisionCountSum": 3451,
        "episodeTotalCostSumKRW": 883012350,
        "episodeIncrementalCostSumKRW": 485895150,
        "episodeRevisionCountSum": 10196,
        "knownRevisionEpisodeCount": 143,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 169,
        "fullSampleEpisodeCount": 216
      },
      "commitmentHiGHSV11": {
        "scenarioCount": 48,
        "jointEpisodeCount": 143,
        "scenarioMeanTotalCostSumKRW": 294246450,
        "scenarioMeanIncrementalCostSumKRW": 161874050,
        "scenarioMeanRevisionCountSum": 5130,
        "episodeTotalCostSumKRW": 882739350,
        "episodeIncrementalCostSumKRW": 485622150,
        "episodeRevisionCountSum": 15147,
        "knownRevisionEpisodeCount": 143,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 169,
        "fullSampleEpisodeCount": 216
      },
      "seededHiGHSV12": {
        "scenarioCount": 48,
        "jointEpisodeCount": 143,
        "scenarioMeanTotalCostSumKRW": 294246450,
        "scenarioMeanIncrementalCostSumKRW": 161874050,
        "scenarioMeanRevisionCountSum": 5018.5,
        "episodeTotalCostSumKRW": 882739350,
        "episodeIncrementalCostSumKRW": 485622150,
        "episodeRevisionCountSum": 14746,
        "knownRevisionEpisodeCount": 143,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 181,
        "fullSampleEpisodeCount": 216
      }
    },
    "frontiers": {
      "totalAndRevisions": [
        {
          "method": "costPolishV7",
          "dominates": [],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "adaptiveV9",
          "dominates": [],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "highsV8",
          "dominates": [],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "stableHiGHSV10",
          "dominates": [],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "commitmentHiGHSV11",
          "dominates": [],
          "dominatedBy": [
            "seededHiGHSV12"
          ],
          "pareto": false
        },
        {
          "method": "seededHiGHSV12",
          "dominates": [
            "commitmentHiGHSV11"
          ],
          "dominatedBy": [],
          "pareto": true
        }
      ],
      "incrementalAndRevisions": [
        {
          "method": "costPolishV7",
          "dominates": [],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "adaptiveV9",
          "dominates": [],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "highsV8",
          "dominates": [],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "stableHiGHSV10",
          "dominates": [],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "commitmentHiGHSV11",
          "dominates": [],
          "dominatedBy": [
            "seededHiGHSV12"
          ],
          "pareto": false
        },
        {
          "method": "seededHiGHSV12",
          "dominates": [
            "commitmentHiGHSV11"
          ],
          "dominatedBy": [],
          "pareto": true
        }
      ]
    },
    "scenarios": [
      {
        "scenarioId": "v12-same-distribution-aged-backlog-balanced-n24-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 18089283.333333332,
            "incrementalCost": 10278383.333333334,
            "revisionCount": 65.33333333333333
          },
          "adaptiveV9": {
            "totalCost": 18059116.666666668,
            "incrementalCost": 10248216.666666666,
            "revisionCount": 67.33333333333333
          },
          "highsV8": {
            "totalCost": 17583300,
            "incrementalCost": 9772400,
            "revisionCount": 100
          },
          "stableHiGHSV10": {
            "totalCost": 17583300,
            "incrementalCost": 9772400,
            "revisionCount": 47
          },
          "commitmentHiGHSV11": {
            "totalCost": 17583300,
            "incrementalCost": 9772400,
            "revisionCount": 47
          },
          "seededHiGHSV12": {
            "totalCost": 17583300,
            "incrementalCost": 9772400,
            "revisionCount": 47
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-aged-backlog-balanced-n24-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 11525300,
            "incrementalCost": 6171950,
            "revisionCount": 28
          },
          "adaptiveV9": {
            "totalCost": 11525300,
            "incrementalCost": 6171950,
            "revisionCount": 28
          },
          "highsV8": {
            "totalCost": 11525300,
            "incrementalCost": 6171950,
            "revisionCount": 47
          },
          "stableHiGHSV10": {
            "totalCost": 11570300,
            "incrementalCost": 6216950,
            "revisionCount": 28
          },
          "commitmentHiGHSV11": {
            "totalCost": 11555300,
            "incrementalCost": 6201950,
            "revisionCount": 34
          },
          "seededHiGHSV12": {
            "totalCost": 11555300,
            "incrementalCost": 6201950,
            "revisionCount": 34
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-aged-backlog-balanced-n24-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 11582400,
            "incrementalCost": 5727350,
            "revisionCount": 24
          },
          "adaptiveV9": {
            "totalCost": 11842650,
            "incrementalCost": 5987600,
            "revisionCount": 17.333333333333332
          },
          "highsV8": {
            "totalCost": 11582400,
            "incrementalCost": 5727350,
            "revisionCount": 79
          },
          "stableHiGHSV10": {
            "totalCost": 11582400,
            "incrementalCost": 5727350,
            "revisionCount": 28
          },
          "commitmentHiGHSV11": {
            "totalCost": 11582400,
            "incrementalCost": 5727350,
            "revisionCount": 28
          },
          "seededHiGHSV12": {
            "totalCost": 11582400,
            "incrementalCost": 5727350,
            "revisionCount": 28
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-aged-backlog-balanced-n24-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 14998316.666666666,
            "incrementalCost": 8004466.666666667,
            "revisionCount": 3.3333333333333335
          },
          "adaptiveV9": {
            "totalCost": 14903216.666666666,
            "incrementalCost": 7909366.666666667,
            "revisionCount": 8.333333333333334
          },
          "highsV8": {
            "totalCost": 14310900,
            "incrementalCost": 7317050,
            "revisionCount": 95
          },
          "stableHiGHSV10": {
            "totalCost": 14310900,
            "incrementalCost": 7317050,
            "revisionCount": 4
          },
          "commitmentHiGHSV11": {
            "totalCost": 14310900,
            "incrementalCost": 7317050,
            "revisionCount": 4
          },
          "seededHiGHSV12": {
            "totalCost": 14310900,
            "incrementalCost": 7317050,
            "revisionCount": 4
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-aged-backlog-balanced-n50-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 30581650,
            "incrementalCost": 17290400,
            "revisionCount": 94
          },
          "adaptiveV9": {
            "totalCost": 30581650,
            "incrementalCost": 17290400,
            "revisionCount": 94
          },
          "highsV8": {
            "totalCost": 29254550,
            "incrementalCost": 15963300,
            "revisionCount": 145
          },
          "stableHiGHSV10": {
            "totalCost": 29254550,
            "incrementalCost": 15963300,
            "revisionCount": 74
          },
          "commitmentHiGHSV11": {
            "totalCost": 29254550,
            "incrementalCost": 15963300,
            "revisionCount": 74
          },
          "seededHiGHSV12": {
            "totalCost": 29254550,
            "incrementalCost": 15963300,
            "revisionCount": 74
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-aged-backlog-balanced-n50-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 27220666.666666668,
            "incrementalCost": 15648666.666666666,
            "revisionCount": 72
          },
          "adaptiveV9": {
            "totalCost": 27220666.666666668,
            "incrementalCost": 15648666.666666666,
            "revisionCount": 72
          },
          "highsV8": {
            "totalCost": 26634300,
            "incrementalCost": 15062300,
            "revisionCount": 146
          },
          "stableHiGHSV10": {
            "totalCost": 26614300,
            "incrementalCost": 15042300,
            "revisionCount": 64
          },
          "commitmentHiGHSV11": {
            "totalCost": 26614300,
            "incrementalCost": 15042300,
            "revisionCount": 64
          },
          "seededHiGHSV12": {
            "totalCost": 26614300,
            "incrementalCost": 15042300,
            "revisionCount": 64
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-aged-backlog-balanced-n50-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 21061816.666666668,
            "incrementalCost": 11839916.666666666,
            "revisionCount": 31.333333333333332
          },
          "adaptiveV9": {
            "totalCost": 21061816.666666668,
            "incrementalCost": 11839916.666666666,
            "revisionCount": 31.333333333333332
          },
          "highsV8": {
            "totalCost": 20638900,
            "incrementalCost": 11417000,
            "revisionCount": 96
          },
          "stableHiGHSV10": {
            "totalCost": 20638900,
            "incrementalCost": 11417000,
            "revisionCount": 30
          },
          "commitmentHiGHSV11": {
            "totalCost": 20623900,
            "incrementalCost": 11402000,
            "revisionCount": 59
          },
          "seededHiGHSV12": {
            "totalCost": 20623900,
            "incrementalCost": 11402000,
            "revisionCount": 59
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-aged-backlog-balanced-n50-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 30207800,
            "incrementalCost": 14176500,
            "revisionCount": 3
          },
          "adaptiveV9": {
            "totalCost": 30207800,
            "incrementalCost": 14176500,
            "revisionCount": 3
          },
          "highsV8": {
            "totalCost": 30207800,
            "incrementalCost": 14176500,
            "revisionCount": 105
          },
          "stableHiGHSV10": {
            "totalCost": 30207800,
            "incrementalCost": 14176500,
            "revisionCount": 3
          },
          "commitmentHiGHSV11": {
            "totalCost": 30207800,
            "incrementalCost": 14176500,
            "revisionCount": 3
          },
          "seededHiGHSV12": {
            "totalCost": 30207800,
            "incrementalCost": 14176500,
            "revisionCount": 3
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-aged-backlog-balanced-n100-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 65810050,
            "incrementalCost": 37536750,
            "revisionCount": 222
          },
          "adaptiveV9": {
            "totalCost": 65563683.333333336,
            "incrementalCost": 37290383.333333336,
            "revisionCount": 215
          },
          "highsV8": {
            "totalCost": 61837350,
            "incrementalCost": 33564050,
            "revisionCount": 274
          },
          "stableHiGHSV10": {
            "totalCost": 61787350,
            "incrementalCost": 33514050,
            "revisionCount": 126
          },
          "commitmentHiGHSV11": {
            "totalCost": 61817350,
            "incrementalCost": 33544050,
            "revisionCount": 213
          },
          "seededHiGHSV12": {
            "totalCost": 61817350,
            "incrementalCost": 33544050,
            "revisionCount": 213
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-aged-backlog-balanced-n100-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 56365216.666666664,
            "incrementalCost": 30552416.666666668,
            "revisionCount": 17
          },
          "adaptiveV9": {
            "totalCost": 55848200,
            "incrementalCost": 30035400,
            "revisionCount": 17
          },
          "highsV8": {
            "totalCost": 51038950,
            "incrementalCost": 25226150,
            "revisionCount": 154
          },
          "stableHiGHSV10": {
            "totalCost": 51038950,
            "incrementalCost": 25226150,
            "revisionCount": 18
          },
          "commitmentHiGHSV11": {
            "totalCost": 51038950,
            "incrementalCost": 25226150,
            "revisionCount": 50
          },
          "seededHiGHSV12": {
            "totalCost": 51038950,
            "incrementalCost": 25226150,
            "revisionCount": 50
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-balanced-n24-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 4
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 4
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 224
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 59
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 83
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 79
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-balanced-n24-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 131
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 20
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 20
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-balanced-n24-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 35
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 35
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 163
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 44
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 44
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 44
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-balanced-n50-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 384
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 50
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 61
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 110
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-balanced-n50-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 393
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 104
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 153
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 128
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-balanced-n50-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 24
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 24
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 239
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 85
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 85
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 57
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-balanced-n100-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 839
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 60
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 60
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-balanced-n100-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 637
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 169
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 297
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 278
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-balanced-n100-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 3.3333333333333335
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 5
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 744
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 181
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 353
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 203
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-balanced-n100-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 44
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 44
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 761
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 140
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 243
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 115
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-tight-n24-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 45500,
            "incrementalCost": 45500,
            "revisionCount": 62
          },
          "adaptiveV9": {
            "totalCost": 45500,
            "incrementalCost": 45500,
            "revisionCount": 62
          },
          "highsV8": {
            "totalCost": 45500,
            "incrementalCost": 45500,
            "revisionCount": 239
          },
          "stableHiGHSV10": {
            "totalCost": 45500,
            "incrementalCost": 45500,
            "revisionCount": 77
          },
          "commitmentHiGHSV11": {
            "totalCost": 45500,
            "incrementalCost": 45500,
            "revisionCount": 77
          },
          "seededHiGHSV12": {
            "totalCost": 45500,
            "incrementalCost": 45500,
            "revisionCount": 77
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-tight-n24-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 50.666666666666664
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 61.333333333333336
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 282
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 83
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 83
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 114
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-tight-n50-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 9100,
            "incrementalCost": 9100,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 2
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 465
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 120
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 120
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 193
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-tight-n100-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 185
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 185
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 1052
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 251
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 398
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 441
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-tight-n100-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 18200,
            "incrementalCost": 18200,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 18200,
            "incrementalCost": 18200,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 873
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 257
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 457
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 457
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-new-arrivals-tight-n100-r4",
        "pairedRepeatCount": 2,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 139
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 139
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 970
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 157
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 243
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 309.5
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-balanced-n24-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 300300,
            "incrementalCost": 263900,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 300300,
            "incrementalCost": 263900,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 300300,
            "incrementalCost": 263900,
            "revisionCount": 94
          },
          "stableHiGHSV10": {
            "totalCost": 300300,
            "incrementalCost": 263900,
            "revisionCount": 0
          },
          "commitmentHiGHSV11": {
            "totalCost": 300300,
            "incrementalCost": 263900,
            "revisionCount": 0
          },
          "seededHiGHSV12": {
            "totalCost": 300300,
            "incrementalCost": 263900,
            "revisionCount": 0
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-balanced-n24-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 236600,
            "incrementalCost": 200200,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 236600,
            "incrementalCost": 200200,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 236600,
            "incrementalCost": 200200,
            "revisionCount": 149
          },
          "stableHiGHSV10": {
            "totalCost": 236600,
            "incrementalCost": 200200,
            "revisionCount": 24
          },
          "commitmentHiGHSV11": {
            "totalCost": 236600,
            "incrementalCost": 200200,
            "revisionCount": 26
          },
          "seededHiGHSV12": {
            "totalCost": 236600,
            "incrementalCost": 200200,
            "revisionCount": 26
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-balanced-n24-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 254800,
            "incrementalCost": 236600,
            "revisionCount": 8
          },
          "adaptiveV9": {
            "totalCost": 254800,
            "incrementalCost": 236600,
            "revisionCount": 8
          },
          "highsV8": {
            "totalCost": 254800,
            "incrementalCost": 236600,
            "revisionCount": 104
          },
          "stableHiGHSV10": {
            "totalCost": 254800,
            "incrementalCost": 236600,
            "revisionCount": 23
          },
          "commitmentHiGHSV11": {
            "totalCost": 254800,
            "incrementalCost": 236600,
            "revisionCount": 23
          },
          "seededHiGHSV12": {
            "totalCost": 254800,
            "incrementalCost": 236600,
            "revisionCount": 23
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-balanced-n50-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 591500,
            "incrementalCost": 546000,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 591500,
            "incrementalCost": 546000,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 591500,
            "incrementalCost": 546000,
            "revisionCount": 303
          },
          "stableHiGHSV10": {
            "totalCost": 591500,
            "incrementalCost": 546000,
            "revisionCount": 0
          },
          "commitmentHiGHSV11": {
            "totalCost": 591500,
            "incrementalCost": 546000,
            "revisionCount": 17
          },
          "seededHiGHSV12": {
            "totalCost": 591500,
            "incrementalCost": 546000,
            "revisionCount": 17
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-balanced-n50-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 682500,
            "incrementalCost": 491400,
            "revisionCount": 20
          },
          "adaptiveV9": {
            "totalCost": 682500,
            "incrementalCost": 491400,
            "revisionCount": 20
          },
          "highsV8": {
            "totalCost": 682500,
            "incrementalCost": 491400,
            "revisionCount": 340
          },
          "stableHiGHSV10": {
            "totalCost": 682500,
            "incrementalCost": 491400,
            "revisionCount": 42
          },
          "commitmentHiGHSV11": {
            "totalCost": 682500,
            "incrementalCost": 491400,
            "revisionCount": 57
          },
          "seededHiGHSV12": {
            "totalCost": 682500,
            "incrementalCost": 491400,
            "revisionCount": 57
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-balanced-n50-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 673400,
            "incrementalCost": 500500,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 673400,
            "incrementalCost": 500500,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 673400,
            "incrementalCost": 500500,
            "revisionCount": 270
          },
          "stableHiGHSV10": {
            "totalCost": 673400,
            "incrementalCost": 500500,
            "revisionCount": 40
          },
          "commitmentHiGHSV11": {
            "totalCost": 673400,
            "incrementalCost": 500500,
            "revisionCount": 85
          },
          "seededHiGHSV12": {
            "totalCost": 673400,
            "incrementalCost": 500500,
            "revisionCount": 85
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-balanced-n50-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 455000,
            "incrementalCost": 409500,
            "revisionCount": 29
          },
          "adaptiveV9": {
            "totalCost": 455000,
            "incrementalCost": 409500,
            "revisionCount": 29
          },
          "highsV8": {
            "totalCost": 445900,
            "incrementalCost": 400400,
            "revisionCount": 280
          },
          "stableHiGHSV10": {
            "totalCost": 455000,
            "incrementalCost": 409500,
            "revisionCount": 51
          },
          "commitmentHiGHSV11": {
            "totalCost": 455000,
            "incrementalCost": 409500,
            "revisionCount": 147
          },
          "seededHiGHSV12": {
            "totalCost": 455000,
            "incrementalCost": 409500,
            "revisionCount": 147
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-balanced-n100-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 964600,
            "incrementalCost": 837200,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 964600,
            "incrementalCost": 837200,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 955500,
            "incrementalCost": 828100,
            "revisionCount": 566
          },
          "stableHiGHSV10": {
            "totalCost": 955500,
            "incrementalCost": 828100,
            "revisionCount": 0
          },
          "commitmentHiGHSV11": {
            "totalCost": 955500,
            "incrementalCost": 828100,
            "revisionCount": 30
          },
          "seededHiGHSV12": {
            "totalCost": 955500,
            "incrementalCost": 828100,
            "revisionCount": 30
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-balanced-n100-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1264900,
            "incrementalCost": 1128400,
            "revisionCount": 26
          },
          "adaptiveV9": {
            "totalCost": 1264900,
            "incrementalCost": 1128400,
            "revisionCount": 26
          },
          "highsV8": {
            "totalCost": 1264900,
            "incrementalCost": 1128400,
            "revisionCount": 597
          },
          "stableHiGHSV10": {
            "totalCost": 1264900,
            "incrementalCost": 1128400,
            "revisionCount": 98
          },
          "commitmentHiGHSV11": {
            "totalCost": 1264900,
            "incrementalCost": 1128400,
            "revisionCount": 98
          },
          "seededHiGHSV12": {
            "totalCost": 1264900,
            "incrementalCost": 1128400,
            "revisionCount": 98
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-balanced-n100-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1164800,
            "incrementalCost": 1046500,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 1164800,
            "incrementalCost": 1046500,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 1164800,
            "incrementalCost": 1046500,
            "revisionCount": 665
          },
          "stableHiGHSV10": {
            "totalCost": 1164800,
            "incrementalCost": 1046500,
            "revisionCount": 0
          },
          "commitmentHiGHSV11": {
            "totalCost": 1164800,
            "incrementalCost": 1046500,
            "revisionCount": 28
          },
          "seededHiGHSV12": {
            "totalCost": 1164800,
            "incrementalCost": 1046500,
            "revisionCount": 28
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-balanced-n100-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1346800,
            "incrementalCost": 1092000,
            "revisionCount": 37
          },
          "adaptiveV9": {
            "totalCost": 1352866.6666666667,
            "incrementalCost": 1098066.6666666667,
            "revisionCount": 51.666666666666664
          },
          "highsV8": {
            "totalCost": 1292200,
            "incrementalCost": 1037400,
            "revisionCount": 593
          },
          "stableHiGHSV10": {
            "totalCost": 1355900,
            "incrementalCost": 1101100,
            "revisionCount": 91
          },
          "commitmentHiGHSV11": {
            "totalCost": 1346800,
            "incrementalCost": 1092000,
            "revisionCount": 189
          },
          "seededHiGHSV12": {
            "totalCost": 1346800,
            "incrementalCost": 1092000,
            "revisionCount": 189
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-tight-n24-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 985000,
            "incrementalCost": 966800,
            "revisionCount": 48
          },
          "adaptiveV9": {
            "totalCost": 985000,
            "incrementalCost": 966800,
            "revisionCount": 48
          },
          "highsV8": {
            "totalCost": 985000,
            "incrementalCost": 966800,
            "revisionCount": 118
          },
          "stableHiGHSV10": {
            "totalCost": 985000,
            "incrementalCost": 966800,
            "revisionCount": 50
          },
          "commitmentHiGHSV11": {
            "totalCost": 985000,
            "incrementalCost": 966800,
            "revisionCount": 50
          },
          "seededHiGHSV12": {
            "totalCost": 985000,
            "incrementalCost": 966800,
            "revisionCount": 50
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-tight-n24-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 282100,
            "incrementalCost": 218400,
            "revisionCount": 21
          },
          "adaptiveV9": {
            "totalCost": 282100,
            "incrementalCost": 218400,
            "revisionCount": 21
          },
          "highsV8": {
            "totalCost": 282100,
            "incrementalCost": 218400,
            "revisionCount": 151
          },
          "stableHiGHSV10": {
            "totalCost": 282100,
            "incrementalCost": 218400,
            "revisionCount": 25
          },
          "commitmentHiGHSV11": {
            "totalCost": 282100,
            "incrementalCost": 218400,
            "revisionCount": 60
          },
          "seededHiGHSV12": {
            "totalCost": 282100,
            "incrementalCost": 218400,
            "revisionCount": 60
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-tight-n24-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 591500,
            "incrementalCost": 591500,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 460900,
            "incrementalCost": 460900,
            "revisionCount": 6
          },
          "highsV8": {
            "totalCost": 345800,
            "incrementalCost": 345800,
            "revisionCount": 209
          },
          "stableHiGHSV10": {
            "totalCost": 345800,
            "incrementalCost": 345800,
            "revisionCount": 27
          },
          "commitmentHiGHSV11": {
            "totalCost": 345800,
            "incrementalCost": 345800,
            "revisionCount": 33
          },
          "seededHiGHSV12": {
            "totalCost": 345800,
            "incrementalCost": 345800,
            "revisionCount": 33
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-tight-n24-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 427700,
            "incrementalCost": 391300,
            "revisionCount": 32
          },
          "adaptiveV9": {
            "totalCost": 427700,
            "incrementalCost": 391300,
            "revisionCount": 32
          },
          "highsV8": {
            "totalCost": 418600,
            "incrementalCost": 382200,
            "revisionCount": 183
          },
          "stableHiGHSV10": {
            "totalCost": 345800,
            "incrementalCost": 309400,
            "revisionCount": 30
          },
          "commitmentHiGHSV11": {
            "totalCost": 345800,
            "incrementalCost": 309400,
            "revisionCount": 30
          },
          "seededHiGHSV12": {
            "totalCost": 345800,
            "incrementalCost": 309400,
            "revisionCount": 30
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-tight-n50-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1194800,
            "incrementalCost": 1131100,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 1176600,
            "incrementalCost": 1112900,
            "revisionCount": 2
          },
          "highsV8": {
            "totalCost": 928200,
            "incrementalCost": 864500,
            "revisionCount": 296
          },
          "stableHiGHSV10": {
            "totalCost": 1037400,
            "incrementalCost": 973700,
            "revisionCount": 60
          },
          "commitmentHiGHSV11": {
            "totalCost": 1037400,
            "incrementalCost": 973700,
            "revisionCount": 60
          },
          "seededHiGHSV12": {
            "totalCost": 1037400,
            "incrementalCost": 973700,
            "revisionCount": 60
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-tight-n50-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 964100,
            "incrementalCost": 818500,
            "revisionCount": 109
          },
          "adaptiveV9": {
            "totalCost": 940000,
            "incrementalCost": 794400,
            "revisionCount": 117
          },
          "highsV8": {
            "totalCost": 858100,
            "incrementalCost": 712500,
            "revisionCount": 349
          },
          "stableHiGHSV10": {
            "totalCost": 858100,
            "incrementalCost": 712500,
            "revisionCount": 58
          },
          "commitmentHiGHSV11": {
            "totalCost": 858100,
            "incrementalCost": 712500,
            "revisionCount": 58
          },
          "seededHiGHSV12": {
            "totalCost": 858100,
            "incrementalCost": 712500,
            "revisionCount": 58
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-tight-n50-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1316300,
            "incrementalCost": 1125200,
            "revisionCount": 50
          },
          "adaptiveV9": {
            "totalCost": 1255800,
            "incrementalCost": 1064700,
            "revisionCount": 56
          },
          "highsV8": {
            "totalCost": 1055600,
            "incrementalCost": 864500,
            "revisionCount": 263
          },
          "stableHiGHSV10": {
            "totalCost": 1101100,
            "incrementalCost": 910000,
            "revisionCount": 78
          },
          "commitmentHiGHSV11": {
            "totalCost": 1101100,
            "incrementalCost": 910000,
            "revisionCount": 102
          },
          "seededHiGHSV12": {
            "totalCost": 1101100,
            "incrementalCost": 910000,
            "revisionCount": 102
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-tight-n50-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1390566.6666666667,
            "incrementalCost": 1308666.6666666667,
            "revisionCount": 47
          },
          "adaptiveV9": {
            "totalCost": 1258500,
            "incrementalCost": 1176600,
            "revisionCount": 59
          },
          "highsV8": {
            "totalCost": 864500,
            "incrementalCost": 782600,
            "revisionCount": 321
          },
          "stableHiGHSV10": {
            "totalCost": 891800,
            "incrementalCost": 809900,
            "revisionCount": 50
          },
          "commitmentHiGHSV11": {
            "totalCost": 891800,
            "incrementalCost": 809900,
            "revisionCount": 50
          },
          "seededHiGHSV12": {
            "totalCost": 891800,
            "incrementalCost": 809900,
            "revisionCount": 50
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-tight-n100-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 5072950,
            "incrementalCost": 4854550,
            "revisionCount": 198
          },
          "adaptiveV9": {
            "totalCost": 5000150,
            "incrementalCost": 4781750,
            "revisionCount": 204
          },
          "highsV8": {
            "totalCost": 2344600,
            "incrementalCost": 2126200,
            "revisionCount": 506
          },
          "stableHiGHSV10": {
            "totalCost": 2344600,
            "incrementalCost": 2126200,
            "revisionCount": 215
          },
          "commitmentHiGHSV11": {
            "totalCost": 2344600,
            "incrementalCost": 2126200,
            "revisionCount": 225
          },
          "seededHiGHSV12": {
            "totalCost": 2344600,
            "incrementalCost": 2126200,
            "revisionCount": 225
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-tight-n100-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 3474700,
            "incrementalCost": 3356400,
            "revisionCount": 82
          },
          "adaptiveV9": {
            "totalCost": 3474700,
            "incrementalCost": 3356400,
            "revisionCount": 82
          },
          "highsV8": {
            "totalCost": 2011100,
            "incrementalCost": 1892800,
            "revisionCount": 670
          },
          "stableHiGHSV10": {
            "totalCost": 2011100,
            "incrementalCost": 1892800,
            "revisionCount": 84
          },
          "commitmentHiGHSV11": {
            "totalCost": 2011100,
            "incrementalCost": 1892800,
            "revisionCount": 93
          },
          "seededHiGHSV12": {
            "totalCost": 2011100,
            "incrementalCost": 1892800,
            "revisionCount": 93
          }
        }
      },
      {
        "scenarioId": "v12-same-distribution-batch-release-tight-n100-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 2350500,
            "incrementalCost": 2314100,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 2350500,
            "incrementalCost": 2314100,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 1483300,
            "incrementalCost": 1446900,
            "revisionCount": 652
          },
          "stableHiGHSV10": {
            "totalCost": 1565200,
            "incrementalCost": 1528800,
            "revisionCount": 186
          },
          "commitmentHiGHSV11": {
            "totalCost": 1483300,
            "incrementalCost": 1446900,
            "revisionCount": 316
          },
          "seededHiGHSV12": {
            "totalCost": 1483300,
            "incrementalCost": 1446900,
            "revisionCount": 316
          }
        }
      }
    ],
    "scope": "Conditional all-six jointly completed matching repeats; average within scenario then equal scenario weight. No revision-to-KRW conversion. This table never overrides full-sample completion losses or establishes universal dominance."
  },
  "observedDecisionGates": {
    "candidateMethod": "seededHiGHSV12",
    "assessmentState": "complete-panel",
    "completionLossCountsByBaseline": {
      "commitmentHiGHSV11": 1,
      "stableHiGHSV10": 1,
      "adaptiveV9": 5,
      "highsV8": 4,
      "costPolishV7": 5
    },
    "completionGainCountsByBaseline": {
      "commitmentHiGHSV11": 13,
      "stableHiGHSV10": 13,
      "adaptiveV9": 21,
      "highsV8": 19,
      "costPolishV7": 20
    },
    "completionNonRegressionAllBaselines": false,
    "defaultRecommendationEligible": false,
    "nativeComparison": {
      "lostEpisodeCount": 4,
      "revisionPairedEpisodeCount": 162,
      "revisionDelta": -40349,
      "strictRevisionReduction": true,
      "incrementalFeeClaim": "no_stable_advantage",
      "totalFeeClaim": "no_stable_advantage",
      "noRobustFeeDeterioration": true,
      "stabilityImprovementClaimAllowed": false
    },
    "nativeComparisons": {
      "commitmentHiGHSV11": {
        "lostEpisodeCount": 1,
        "revisionPairedEpisodeCount": 168,
        "revisionDelta": -443,
        "strictRevisionReduction": true,
        "incrementalFeeClaim": "no_stable_advantage",
        "totalFeeClaim": "no_stable_advantage",
        "noRobustFeeDeterioration": true,
        "stabilityImprovementClaimAllowed": false
      },
      "stableHiGHSV10": {
        "lostEpisodeCount": 1,
        "revisionPairedEpisodeCount": 168,
        "revisionDelta": 4727,
        "strictRevisionReduction": false,
        "incrementalFeeClaim": "no_stable_advantage",
        "totalFeeClaim": "no_stable_advantage",
        "noRobustFeeDeterioration": true,
        "stabilityImprovementClaimAllowed": false
      },
      "highsV8": {
        "lostEpisodeCount": 4,
        "revisionPairedEpisodeCount": 162,
        "revisionDelta": -40349,
        "strictRevisionReduction": true,
        "incrementalFeeClaim": "no_stable_advantage",
        "totalFeeClaim": "no_stable_advantage",
        "noRobustFeeDeterioration": true,
        "stabilityImprovementClaimAllowed": false
      }
    },
    "scope": "Observed necessary gates against the five included comparators only. Any full-sample completion loss blocks default eligibility; net gains and conditional fees/Pareto position do not offset losses. Native stability claims use each exact native paired set; zero-inclusive fee intervals do not prove stable savings. No claim against omitted V5 or universal/production recommendation."
  }
}
```

## 压力扰动 · 新订单种子

### v12VsV11 · seededHiGHSV12 / commitmentHiGHSV11

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 37/111 | 324,030,200.000000 | 324,030,200.000000 | 0.00% | [0, 0] | 0.000000 | {"win": 0, "tie": 37, "loss": 0} |
| total raw episode sums |  | 972,090,600.000000 | 972,090,600.000000 |  | KRW CI [0, 0] |  |  |
| incremental | 37/111 | 185,761,200.000000 | 185,761,200.000000 | 0.00% | [0, 0] | 0.000000 | {"win": 0, "tie": 37, "loss": 0} |
| incremental raw episode sums |  | 557,283,600.000000 | 557,283,600.000000 |  | KRW CI [0, 0] |  |  |

Completion gained/lost: 9/0; completion scenario CI [0, 0.09722222222]
Revisions on same matching complete set: 16515 → 17272; n=111

**total/negativeScenarioIds — ALL retained**

none / 없음 / 无

**total/negativeEpisodeIds — ALL retained**

none / 없음 / 无

**incremental/negativeScenarioIds — ALL retained**

none / 없음 / 无

**incremental/negativeEpisodeIds — ALL retained**

none / 없음 / 无

**gainedEpisodeIds — ALL retained**

- `v12-stress-new-arrivals-tight-n50-r4::repeat-1`
- `v12-stress-new-arrivals-tight-n50-r4::repeat-2`
- `v12-stress-new-arrivals-tight-n50-r4::repeat-3`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-3`
- `v12-stress-batch-release-tight-n100-r1::repeat-1`
- `v12-stress-batch-release-tight-n100-r1::repeat-2`
- `v12-stress-batch-release-tight-n100-r1::repeat-3`

**lostEpisodeIds — ALL retained**

none / 없음 / 无

### v12VsV10 · seededHiGHSV12 / stableHiGHSV10

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 37/111 | 323,995,650.000000 | 324,030,200.000000 | -0.01% | [-0.04904962771, 0.001598464632] | 36,400.000000 | {"win": 1, "tie": 35, "loss": 1} |
| total raw episode sums |  | 971,986,950.000000 | 972,090,600.000000 |  | KRW CI [-2951.351351, 150] |  |  |
| incremental | 37/111 | 185,726,650.000000 | 185,761,200.000000 | -0.02% | [-0.08227406499, 0.00276016906] | 36,400.000000 | {"win": 1, "tie": 35, "loss": 1} |
| incremental raw episode sums |  | 557,179,950.000000 | 557,283,600.000000 |  | KRW CI [-2951.351351, 150] |  |  |

Completion gained/lost: 9/3; completion scenario CI [-0.02777777778, 0.08333333333]
Revisions on same matching complete set: 13488 → 17272; n=111

**total/negativeScenarioIds — ALL retained**

- `v12-stress-batch-release-tight-n50-r1`

**total/negativeEpisodeIds — ALL retained**

- `v12-stress-batch-release-tight-n50-r1::repeat-1`
- `v12-stress-batch-release-tight-n50-r1::repeat-2`
- `v12-stress-batch-release-tight-n50-r1::repeat-3`

**incremental/negativeScenarioIds — ALL retained**

- `v12-stress-batch-release-tight-n50-r1`

**incremental/negativeEpisodeIds — ALL retained**

- `v12-stress-batch-release-tight-n50-r1::repeat-1`
- `v12-stress-batch-release-tight-n50-r1::repeat-2`
- `v12-stress-batch-release-tight-n50-r1::repeat-3`

**gainedEpisodeIds — ALL retained**

- `v12-stress-new-arrivals-tight-n50-r4::repeat-1`
- `v12-stress-new-arrivals-tight-n50-r4::repeat-2`
- `v12-stress-new-arrivals-tight-n50-r4::repeat-3`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-3`
- `v12-stress-batch-release-tight-n100-r1::repeat-1`
- `v12-stress-batch-release-tight-n100-r1::repeat-2`
- `v12-stress-batch-release-tight-n100-r1::repeat-3`

**lostEpisodeIds — ALL retained**

- `v12-stress-batch-release-tight-n100-r3::repeat-1`
- `v12-stress-batch-release-tight-n100-r3::repeat-2`
- `v12-stress-batch-release-tight-n100-r3::repeat-3`

### v12VsV9 · seededHiGHSV12 / adaptiveV9

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 24/70 | 299,913,033.333333 | 285,089,700.000000 | 4.94% | [0.5902824818, 7.465586582] | 305,866.666667 | {"win": 8, "tie": 11, "loss": 5} |
| total raw episode sums |  | 897,482,300.000000 | 853,048,700.000000 |  | KRW CI [35406.49306, 1350155.417] |  |  |
| incremental | 24/70 | 176,878,283.333333 | 162,054,950.000000 | 8.38% | [0.9787944182, 12.51218319] | 305,866.666667 | {"win": 8, "tie": 11, "loss": 5} |
| incremental raw episode sums |  | 528,614,650.000000 | 484,181,050.000000 |  | KRW CI [35406.49306, 1350155.417] |  |  |

Completion gained/lost: 50/11; completion scenario CI [0.06481481481, 0.2962962963]
Revisions on same matching complete set: 6130 → 8495; n=70

**total/negativeScenarioIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n24-r2`
- `v12-stress-aged-backlog-balanced-n24-r4`
- `v12-stress-batch-release-balanced-n24-r1`
- `v12-stress-batch-release-balanced-n24-r4`
- `v12-stress-batch-release-tight-n50-r1`

**total/negativeEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v12-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v12-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-1`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-2`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-3`
- `v12-stress-batch-release-balanced-n24-r1::repeat-1`
- `v12-stress-batch-release-balanced-n24-r1::repeat-2`
- `v12-stress-batch-release-balanced-n24-r1::repeat-3`
- `v12-stress-batch-release-balanced-n24-r4::repeat-1`
- `v12-stress-batch-release-balanced-n24-r4::repeat-2`
- `v12-stress-batch-release-balanced-n24-r4::repeat-3`
- `v12-stress-batch-release-tight-n50-r1::repeat-1`
- `v12-stress-batch-release-tight-n50-r1::repeat-2`
- `v12-stress-batch-release-tight-n50-r1::repeat-3`

**incremental/negativeScenarioIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n24-r2`
- `v12-stress-aged-backlog-balanced-n24-r4`
- `v12-stress-batch-release-balanced-n24-r1`
- `v12-stress-batch-release-balanced-n24-r4`
- `v12-stress-batch-release-tight-n50-r1`

**incremental/negativeEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v12-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v12-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-1`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-2`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-3`
- `v12-stress-batch-release-balanced-n24-r1::repeat-1`
- `v12-stress-batch-release-balanced-n24-r1::repeat-2`
- `v12-stress-batch-release-balanced-n24-r1::repeat-3`
- `v12-stress-batch-release-balanced-n24-r4::repeat-1`
- `v12-stress-batch-release-balanced-n24-r4::repeat-2`
- `v12-stress-batch-release-balanced-n24-r4::repeat-3`
- `v12-stress-batch-release-tight-n50-r1::repeat-1`
- `v12-stress-batch-release-tight-n50-r1::repeat-2`
- `v12-stress-batch-release-tight-n50-r1::repeat-3`

**gainedEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v12-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v12-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v12-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v12-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v12-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v12-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v12-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v12-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v12-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v12-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v12-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v12-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v12-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v12-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v12-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v12-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v12-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v12-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v12-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v12-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v12-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v12-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v12-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v12-stress-new-arrivals-tight-n50-r4::repeat-1`
- `v12-stress-new-arrivals-tight-n50-r4::repeat-2`
- `v12-stress-new-arrivals-tight-n50-r4::repeat-3`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-3`
- `v12-stress-batch-release-balanced-n50-r2::repeat-1`
- `v12-stress-batch-release-balanced-n50-r2::repeat-2`
- `v12-stress-batch-release-balanced-n50-r2::repeat-3`
- `v12-stress-batch-release-balanced-n50-r3::repeat-1`
- `v12-stress-batch-release-balanced-n50-r3::repeat-2`
- `v12-stress-batch-release-balanced-n50-r3::repeat-3`
- `v12-stress-batch-release-balanced-n100-r2::repeat-2`
- `v12-stress-batch-release-balanced-n100-r2::repeat-3`
- `v12-stress-batch-release-balanced-n100-r3::repeat-1`
- `v12-stress-batch-release-balanced-n100-r3::repeat-2`
- `v12-stress-batch-release-balanced-n100-r3::repeat-3`
- `v12-stress-batch-release-tight-n50-r4::repeat-1`
- `v12-stress-batch-release-tight-n50-r4::repeat-2`
- `v12-stress-batch-release-tight-n50-r4::repeat-3`
- `v12-stress-batch-release-tight-n100-r1::repeat-1`
- `v12-stress-batch-release-tight-n100-r1::repeat-2`
- `v12-stress-batch-release-tight-n100-r1::repeat-3`
- `v12-stress-batch-release-tight-n100-r4::repeat-1`
- `v12-stress-batch-release-tight-n100-r4::repeat-2`
- `v12-stress-batch-release-tight-n100-r4::repeat-3`

**lostEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v12-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v12-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v12-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v12-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v12-stress-batch-release-tight-n100-r2::repeat-1`
- `v12-stress-batch-release-tight-n100-r2::repeat-2`
- `v12-stress-batch-release-tight-n100-r2::repeat-3`
- `v12-stress-batch-release-tight-n100-r3::repeat-1`
- `v12-stress-batch-release-tight-n100-r3::repeat-2`
- `v12-stress-batch-release-tight-n100-r3::repeat-3`

### v12VsHiGHS · seededHiGHSV12 / highsV8

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 34/102 | 292,388,550.000000 | 293,627,750.000000 | -0.42% | [-1.448371202, -0.01130544378] | 688,750.000000 | {"win": 2, "tie": 24, "loss": 8} |
| total raw episode sums |  | 877,165,650.000000 | 880,883,250.000000 |  | KRW CI [-87117.94118, -962.2426471] |  |  |
| incremental | 34/102 | 168,816,900.000000 | 170,056,100.000000 | -0.73% | [-2.354613746, -0.01998982964] | 688,750.000000 | {"win": 2, "tie": 24, "loss": 8} |
| incremental raw episode sums |  | 506,450,700.000000 | 510,168,300.000000 |  | KRW CI [-87117.94118, -962.2426471] |  |  |

Completion gained/lost: 18/3; completion scenario CI [0, 0.1388888889]
Revisions on same matching complete set: 35943 → 15817; n=102

**total/negativeScenarioIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n100-r3`
- `v12-stress-batch-release-balanced-n24-r1`
- `v12-stress-batch-release-balanced-n24-r4`
- `v12-stress-batch-release-balanced-n100-r1`
- `v12-stress-batch-release-balanced-n100-r4`
- `v12-stress-batch-release-tight-n50-r1`
- `v12-stress-batch-release-tight-n50-r4`
- `v12-stress-batch-release-tight-n100-r4`

**total/negativeEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v12-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v12-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v12-stress-batch-release-balanced-n24-r1::repeat-1`
- `v12-stress-batch-release-balanced-n24-r1::repeat-2`
- `v12-stress-batch-release-balanced-n24-r1::repeat-3`
- `v12-stress-batch-release-balanced-n24-r4::repeat-1`
- `v12-stress-batch-release-balanced-n24-r4::repeat-2`
- `v12-stress-batch-release-balanced-n24-r4::repeat-3`
- `v12-stress-batch-release-balanced-n100-r1::repeat-1`
- `v12-stress-batch-release-balanced-n100-r1::repeat-2`
- `v12-stress-batch-release-balanced-n100-r1::repeat-3`
- `v12-stress-batch-release-balanced-n100-r4::repeat-1`
- `v12-stress-batch-release-balanced-n100-r4::repeat-2`
- `v12-stress-batch-release-balanced-n100-r4::repeat-3`
- `v12-stress-batch-release-tight-n50-r1::repeat-1`
- `v12-stress-batch-release-tight-n50-r1::repeat-2`
- `v12-stress-batch-release-tight-n50-r1::repeat-3`
- `v12-stress-batch-release-tight-n50-r4::repeat-1`
- `v12-stress-batch-release-tight-n50-r4::repeat-2`
- `v12-stress-batch-release-tight-n50-r4::repeat-3`
- `v12-stress-batch-release-tight-n100-r4::repeat-1`
- `v12-stress-batch-release-tight-n100-r4::repeat-2`
- `v12-stress-batch-release-tight-n100-r4::repeat-3`

**incremental/negativeScenarioIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n100-r3`
- `v12-stress-batch-release-balanced-n24-r1`
- `v12-stress-batch-release-balanced-n24-r4`
- `v12-stress-batch-release-balanced-n100-r1`
- `v12-stress-batch-release-balanced-n100-r4`
- `v12-stress-batch-release-tight-n50-r1`
- `v12-stress-batch-release-tight-n50-r4`
- `v12-stress-batch-release-tight-n100-r4`

**incremental/negativeEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v12-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v12-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v12-stress-batch-release-balanced-n24-r1::repeat-1`
- `v12-stress-batch-release-balanced-n24-r1::repeat-2`
- `v12-stress-batch-release-balanced-n24-r1::repeat-3`
- `v12-stress-batch-release-balanced-n24-r4::repeat-1`
- `v12-stress-batch-release-balanced-n24-r4::repeat-2`
- `v12-stress-batch-release-balanced-n24-r4::repeat-3`
- `v12-stress-batch-release-balanced-n100-r1::repeat-1`
- `v12-stress-batch-release-balanced-n100-r1::repeat-2`
- `v12-stress-batch-release-balanced-n100-r1::repeat-3`
- `v12-stress-batch-release-balanced-n100-r4::repeat-1`
- `v12-stress-batch-release-balanced-n100-r4::repeat-2`
- `v12-stress-batch-release-balanced-n100-r4::repeat-3`
- `v12-stress-batch-release-tight-n50-r1::repeat-1`
- `v12-stress-batch-release-tight-n50-r1::repeat-2`
- `v12-stress-batch-release-tight-n50-r1::repeat-3`
- `v12-stress-batch-release-tight-n50-r4::repeat-1`
- `v12-stress-batch-release-tight-n50-r4::repeat-2`
- `v12-stress-batch-release-tight-n50-r4::repeat-3`
- `v12-stress-batch-release-tight-n100-r4::repeat-1`
- `v12-stress-batch-release-tight-n100-r4::repeat-2`
- `v12-stress-batch-release-tight-n100-r4::repeat-3`

**gainedEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v12-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v12-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v12-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v12-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v12-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v12-stress-new-arrivals-tight-n50-r4::repeat-1`
- `v12-stress-new-arrivals-tight-n50-r4::repeat-2`
- `v12-stress-new-arrivals-tight-n50-r4::repeat-3`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-3`
- `v12-stress-batch-release-balanced-n50-r2::repeat-1`
- `v12-stress-batch-release-balanced-n50-r2::repeat-2`
- `v12-stress-batch-release-balanced-n50-r2::repeat-3`
- `v12-stress-batch-release-tight-n100-r1::repeat-1`
- `v12-stress-batch-release-tight-n100-r1::repeat-2`
- `v12-stress-batch-release-tight-n100-r1::repeat-3`

**lostEpisodeIds — ALL retained**

- `v12-stress-batch-release-tight-n50-r3::repeat-1`
- `v12-stress-batch-release-tight-n50-r3::repeat-2`
- `v12-stress-batch-release-tight-n50-r3::repeat-3`

### v12VsV7 · seededHiGHSV12 / costPolishV7

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 23/69 | 295,541,183.333333 | 283,979,500.000000 | 3.91% | [1.011158823, 5.943676056] | 287,833.333333 | {"win": 7, "tie": 11, "loss": 5} |
| total raw episode sums |  | 886,623,550.000000 | 851,938,500.000000 |  | KRW CI [54829.14855, 1092675.815] |  |  |
| incremental | 23/69 | 172,624,733.333333 | 161,063,050.000000 | 6.70% | [1.698662058, 10.10465301] | 287,833.333333 | {"win": 7, "tie": 11, "loss": 5} |
| incremental raw episode sums |  | 517,874,200.000000 | 483,189,150.000000 |  | KRW CI [54829.14855, 1092675.815] |  |  |

Completion gained/lost: 51/10; completion scenario CI [0.07407407407, 0.3055555556]
Revisions on same matching complete set: 5846 → 8217; n=69

**total/negativeScenarioIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n24-r2`
- `v12-stress-aged-backlog-balanced-n24-r4`
- `v12-stress-batch-release-balanced-n24-r1`
- `v12-stress-batch-release-balanced-n24-r4`
- `v12-stress-batch-release-tight-n50-r1`

**total/negativeEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v12-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v12-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-1`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-2`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-3`
- `v12-stress-batch-release-balanced-n24-r1::repeat-1`
- `v12-stress-batch-release-balanced-n24-r1::repeat-2`
- `v12-stress-batch-release-balanced-n24-r1::repeat-3`
- `v12-stress-batch-release-balanced-n24-r4::repeat-1`
- `v12-stress-batch-release-balanced-n24-r4::repeat-2`
- `v12-stress-batch-release-balanced-n24-r4::repeat-3`
- `v12-stress-batch-release-tight-n50-r1::repeat-1`
- `v12-stress-batch-release-tight-n50-r1::repeat-2`
- `v12-stress-batch-release-tight-n50-r1::repeat-3`

**incremental/negativeScenarioIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n24-r2`
- `v12-stress-aged-backlog-balanced-n24-r4`
- `v12-stress-batch-release-balanced-n24-r1`
- `v12-stress-batch-release-balanced-n24-r4`
- `v12-stress-batch-release-tight-n50-r1`

**incremental/negativeEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v12-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v12-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-1`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-2`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-3`
- `v12-stress-batch-release-balanced-n24-r1::repeat-1`
- `v12-stress-batch-release-balanced-n24-r1::repeat-2`
- `v12-stress-batch-release-balanced-n24-r1::repeat-3`
- `v12-stress-batch-release-balanced-n24-r4::repeat-1`
- `v12-stress-batch-release-balanced-n24-r4::repeat-2`
- `v12-stress-batch-release-balanced-n24-r4::repeat-3`
- `v12-stress-batch-release-tight-n50-r1::repeat-1`
- `v12-stress-batch-release-tight-n50-r1::repeat-2`
- `v12-stress-batch-release-tight-n50-r1::repeat-3`

**gainedEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v12-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v12-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v12-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v12-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v12-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v12-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v12-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v12-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v12-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v12-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v12-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v12-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v12-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v12-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v12-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v12-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v12-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v12-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v12-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v12-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v12-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v12-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v12-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v12-stress-new-arrivals-tight-n50-r4::repeat-1`
- `v12-stress-new-arrivals-tight-n50-r4::repeat-2`
- `v12-stress-new-arrivals-tight-n50-r4::repeat-3`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v12-stress-new-arrivals-tight-n100-r4::repeat-3`
- `v12-stress-batch-release-balanced-n50-r2::repeat-1`
- `v12-stress-batch-release-balanced-n50-r2::repeat-2`
- `v12-stress-batch-release-balanced-n50-r2::repeat-3`
- `v12-stress-batch-release-balanced-n50-r3::repeat-1`
- `v12-stress-batch-release-balanced-n50-r3::repeat-2`
- `v12-stress-batch-release-balanced-n50-r3::repeat-3`
- `v12-stress-batch-release-balanced-n100-r2::repeat-1`
- `v12-stress-batch-release-balanced-n100-r2::repeat-2`
- `v12-stress-batch-release-balanced-n100-r2::repeat-3`
- `v12-stress-batch-release-balanced-n100-r3::repeat-1`
- `v12-stress-batch-release-balanced-n100-r3::repeat-2`
- `v12-stress-batch-release-balanced-n100-r3::repeat-3`
- `v12-stress-batch-release-tight-n50-r4::repeat-1`
- `v12-stress-batch-release-tight-n50-r4::repeat-2`
- `v12-stress-batch-release-tight-n50-r4::repeat-3`
- `v12-stress-batch-release-tight-n100-r1::repeat-1`
- `v12-stress-batch-release-tight-n100-r1::repeat-2`
- `v12-stress-batch-release-tight-n100-r1::repeat-3`
- `v12-stress-batch-release-tight-n100-r4::repeat-1`
- `v12-stress-batch-release-tight-n100-r4::repeat-2`
- `v12-stress-batch-release-tight-n100-r4::repeat-3`

**lostEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v12-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v12-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v12-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v12-stress-batch-release-tight-n100-r2::repeat-1`
- `v12-stress-batch-release-tight-n100-r2::repeat-2`
- `v12-stress-batch-release-tight-n100-r2::repeat-3`
- `v12-stress-batch-release-tight-n100-r3::repeat-1`
- `v12-stress-batch-release-tight-n100-r3::repeat-2`
- `v12-stress-batch-release-tight-n100-r3::repeat-3`

### v11VsV10 · commitmentHiGHSV11 / stableHiGHSV10

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 37/111 | 323,995,650.000000 | 324,030,200.000000 | -0.01% | [-0.04904962771, 0.001598464632] | 36,400.000000 | {"win": 1, "tie": 35, "loss": 1} |
| total raw episode sums |  | 971,986,950.000000 | 972,090,600.000000 |  | KRW CI [-2951.351351, 150] |  |  |
| incremental | 37/111 | 185,726,650.000000 | 185,761,200.000000 | -0.02% | [-0.08227406499, 0.00276016906] | 36,400.000000 | {"win": 1, "tie": 35, "loss": 1} |
| incremental raw episode sums |  | 557,179,950.000000 | 557,283,600.000000 |  | KRW CI [-2951.351351, 150] |  |  |

Completion gained/lost: 0/3; completion scenario CI [-0.04166666667, 0]
Revisions on same matching complete set: 13488 → 16515; n=111

**total/negativeScenarioIds — ALL retained**

- `v12-stress-batch-release-tight-n50-r1`

**total/negativeEpisodeIds — ALL retained**

- `v12-stress-batch-release-tight-n50-r1::repeat-1`
- `v12-stress-batch-release-tight-n50-r1::repeat-2`
- `v12-stress-batch-release-tight-n50-r1::repeat-3`

**incremental/negativeScenarioIds — ALL retained**

- `v12-stress-batch-release-tight-n50-r1`

**incremental/negativeEpisodeIds — ALL retained**

- `v12-stress-batch-release-tight-n50-r1::repeat-1`
- `v12-stress-batch-release-tight-n50-r1::repeat-2`
- `v12-stress-batch-release-tight-n50-r1::repeat-3`

**gainedEpisodeIds — ALL retained**

none / 없음 / 无

**lostEpisodeIds — ALL retained**

- `v12-stress-batch-release-tight-n100-r3::repeat-1`
- `v12-stress-batch-release-tight-n100-r3::repeat-2`
- `v12-stress-batch-release-tight-n100-r3::repeat-3`

### v10VsHiGHS · stableHiGHSV10 / highsV8

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 34/102 | 292,388,550.000000 | 293,593,200.000000 | -0.41% | [-1.42145779, -0.01131872532] | 688,750.000000 | {"win": 2, "tie": 23, "loss": 9} |
| total raw episode sums |  | 877,165,650.000000 | 880,779,600.000000 |  | KRW CI [-85302.24265, -1016.654412] |  |  |
| incremental | 34/102 | 168,816,900.000000 | 170,021,550.000000 | -0.71% | [-2.297267662, -0.02001303742] | 688,750.000000 | {"win": 2, "tie": 23, "loss": 9} |
| incremental raw episode sums |  | 506,450,700.000000 | 510,064,650.000000 |  | KRW CI [-85302.24265, -1016.654412] |  |  |

Completion gained/lost: 12/3; completion scenario CI [-0.01388888889, 0.09722222222]
Revisions on same matching complete set: 35943 → 12303; n=102

**total/negativeScenarioIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n50-r1`
- `v12-stress-aged-backlog-balanced-n100-r3`
- `v12-stress-batch-release-balanced-n24-r1`
- `v12-stress-batch-release-balanced-n24-r4`
- `v12-stress-batch-release-balanced-n100-r1`
- `v12-stress-batch-release-balanced-n100-r4`
- `v12-stress-batch-release-tight-n50-r1`
- `v12-stress-batch-release-tight-n50-r4`
- `v12-stress-batch-release-tight-n100-r4`

**total/negativeEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n50-r1::repeat-1`
- `v12-stress-aged-backlog-balanced-n50-r1::repeat-2`
- `v12-stress-aged-backlog-balanced-n50-r1::repeat-3`
- `v12-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v12-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v12-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v12-stress-batch-release-balanced-n24-r1::repeat-1`
- `v12-stress-batch-release-balanced-n24-r1::repeat-2`
- `v12-stress-batch-release-balanced-n24-r1::repeat-3`
- `v12-stress-batch-release-balanced-n24-r4::repeat-1`
- `v12-stress-batch-release-balanced-n24-r4::repeat-2`
- `v12-stress-batch-release-balanced-n24-r4::repeat-3`
- `v12-stress-batch-release-balanced-n100-r1::repeat-1`
- `v12-stress-batch-release-balanced-n100-r1::repeat-2`
- `v12-stress-batch-release-balanced-n100-r1::repeat-3`
- `v12-stress-batch-release-balanced-n100-r4::repeat-1`
- `v12-stress-batch-release-balanced-n100-r4::repeat-2`
- `v12-stress-batch-release-balanced-n100-r4::repeat-3`
- `v12-stress-batch-release-tight-n50-r1::repeat-1`
- `v12-stress-batch-release-tight-n50-r1::repeat-2`
- `v12-stress-batch-release-tight-n50-r1::repeat-3`
- `v12-stress-batch-release-tight-n50-r4::repeat-1`
- `v12-stress-batch-release-tight-n50-r4::repeat-2`
- `v12-stress-batch-release-tight-n50-r4::repeat-3`
- `v12-stress-batch-release-tight-n100-r4::repeat-1`
- `v12-stress-batch-release-tight-n100-r4::repeat-2`
- `v12-stress-batch-release-tight-n100-r4::repeat-3`

**incremental/negativeScenarioIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n50-r1`
- `v12-stress-aged-backlog-balanced-n100-r3`
- `v12-stress-batch-release-balanced-n24-r1`
- `v12-stress-batch-release-balanced-n24-r4`
- `v12-stress-batch-release-balanced-n100-r1`
- `v12-stress-batch-release-balanced-n100-r4`
- `v12-stress-batch-release-tight-n50-r1`
- `v12-stress-batch-release-tight-n50-r4`
- `v12-stress-batch-release-tight-n100-r4`

**incremental/negativeEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n50-r1::repeat-1`
- `v12-stress-aged-backlog-balanced-n50-r1::repeat-2`
- `v12-stress-aged-backlog-balanced-n50-r1::repeat-3`
- `v12-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v12-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v12-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v12-stress-batch-release-balanced-n24-r1::repeat-1`
- `v12-stress-batch-release-balanced-n24-r1::repeat-2`
- `v12-stress-batch-release-balanced-n24-r1::repeat-3`
- `v12-stress-batch-release-balanced-n24-r4::repeat-1`
- `v12-stress-batch-release-balanced-n24-r4::repeat-2`
- `v12-stress-batch-release-balanced-n24-r4::repeat-3`
- `v12-stress-batch-release-balanced-n100-r1::repeat-1`
- `v12-stress-batch-release-balanced-n100-r1::repeat-2`
- `v12-stress-batch-release-balanced-n100-r1::repeat-3`
- `v12-stress-batch-release-balanced-n100-r4::repeat-1`
- `v12-stress-batch-release-balanced-n100-r4::repeat-2`
- `v12-stress-batch-release-balanced-n100-r4::repeat-3`
- `v12-stress-batch-release-tight-n50-r1::repeat-1`
- `v12-stress-batch-release-tight-n50-r1::repeat-2`
- `v12-stress-batch-release-tight-n50-r1::repeat-3`
- `v12-stress-batch-release-tight-n50-r4::repeat-1`
- `v12-stress-batch-release-tight-n50-r4::repeat-2`
- `v12-stress-batch-release-tight-n50-r4::repeat-3`
- `v12-stress-batch-release-tight-n100-r4::repeat-1`
- `v12-stress-batch-release-tight-n100-r4::repeat-2`
- `v12-stress-batch-release-tight-n100-r4::repeat-3`

**gainedEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v12-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v12-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v12-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v12-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v12-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v12-stress-batch-release-balanced-n50-r2::repeat-1`
- `v12-stress-batch-release-balanced-n50-r2::repeat-2`
- `v12-stress-batch-release-balanced-n50-r2::repeat-3`
- `v12-stress-batch-release-tight-n100-r3::repeat-1`
- `v12-stress-batch-release-tight-n100-r3::repeat-2`
- `v12-stress-batch-release-tight-n100-r3::repeat-3`

**lostEpisodeIds — ALL retained**

- `v12-stress-batch-release-tight-n50-r3::repeat-1`
- `v12-stress-batch-release-tight-n50-r3::repeat-2`
- `v12-stress-batch-release-tight-n50-r3::repeat-3`

### highsVsV7 · highsV8 / costPolishV7

| fee | scenario / repeat | baseline KRW | candidate KRW | savings % | conditional scenario CI | worst increase KRW | win/tie/loss |
| --- | --- | --- | --- | --- | --- | --- | --- |
| total | 23/69 | 295,541,183.333333 | 283,462,250.000000 | 4.09% | [1.465005245, 6.13459469] | 156,650.000000 | {"win": 9, "tie": 11, "loss": 3} |
| total raw episode sums |  | 886,623,550.000000 | 850,386,750.000000 |  | KRW CI [74498.36957, 1124223.007] |  |  |
| incremental | 23/69 | 172,624,733.333333 | 160,545,800.000000 | 7.00% | [2.427387089, 10.33844012] | 156,650.000000 | {"win": 9, "tie": 11, "loss": 3} |
| incremental raw episode sums |  | 517,874,200.000000 | 481,637,400.000000 |  | KRW CI [74498.36957, 1124223.007] |  |  |

Completion gained/lost: 36/10; completion scenario CI [0.02314814815, 0.2268518519]
Revisions on same matching complete set: 5846 → 21135; n=69

**total/negativeScenarioIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n24-r2`
- `v12-stress-aged-backlog-balanced-n24-r4`
- `v12-stress-batch-release-balanced-n24-r1`

**total/negativeEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v12-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v12-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-1`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-2`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-3`
- `v12-stress-batch-release-balanced-n24-r1::repeat-1`
- `v12-stress-batch-release-balanced-n24-r1::repeat-2`
- `v12-stress-batch-release-balanced-n24-r1::repeat-3`

**incremental/negativeScenarioIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n24-r2`
- `v12-stress-aged-backlog-balanced-n24-r4`
- `v12-stress-batch-release-balanced-n24-r1`

**incremental/negativeEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v12-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v12-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-1`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-2`
- `v12-stress-aged-backlog-balanced-n24-r4::repeat-3`
- `v12-stress-batch-release-balanced-n24-r1::repeat-1`
- `v12-stress-batch-release-balanced-n24-r1::repeat-2`
- `v12-stress-batch-release-balanced-n24-r1::repeat-3`

**gainedEpisodeIds — ALL retained**

- `v12-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v12-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v12-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v12-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v12-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v12-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v12-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v12-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v12-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v12-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v12-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v12-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v12-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v12-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v12-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v12-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v12-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v12-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v12-stress-batch-release-balanced-n50-r3::repeat-1`
- `v12-stress-batch-release-balanced-n50-r3::repeat-2`
- `v12-stress-batch-release-balanced-n50-r3::repeat-3`
- `v12-stress-batch-release-balanced-n100-r2::repeat-1`
- `v12-stress-batch-release-balanced-n100-r2::repeat-2`
- `v12-stress-batch-release-balanced-n100-r2::repeat-3`
- `v12-stress-batch-release-balanced-n100-r3::repeat-1`
- `v12-stress-batch-release-balanced-n100-r3::repeat-2`
- `v12-stress-batch-release-balanced-n100-r3::repeat-3`
- `v12-stress-batch-release-tight-n50-r3::repeat-1`
- `v12-stress-batch-release-tight-n50-r3::repeat-2`
- `v12-stress-batch-release-tight-n50-r3::repeat-3`
- `v12-stress-batch-release-tight-n50-r4::repeat-1`
- `v12-stress-batch-release-tight-n50-r4::repeat-2`
- `v12-stress-batch-release-tight-n50-r4::repeat-3`
- `v12-stress-batch-release-tight-n100-r4::repeat-1`
- `v12-stress-batch-release-tight-n100-r4::repeat-2`
- `v12-stress-batch-release-tight-n100-r4::repeat-3`

**lostEpisodeIds — ALL retained**

- `v12-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v12-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v12-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v12-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v12-stress-batch-release-tight-n100-r2::repeat-1`
- `v12-stress-batch-release-tight-n100-r2::repeat-2`
- `v12-stress-batch-release-tight-n100-r2::repeat-3`
- `v12-stress-batch-release-tight-n100-r3::repeat-1`
- `v12-stress-batch-release-tight-n100-r3::repeat-2`
- `v12-stress-batch-release-tight-n100-r3::repeat-3`

### All-six common-complete subset and observed necessary gates

```json
{
  "jointCompletePareto": {
    "jointScenarioCount": 23,
    "jointEpisodeCount": 69,
    "eligibility": "all-six-matching-complete-repeats",
    "byMethod": {
      "costPolishV7": {
        "scenarioCount": 23,
        "jointEpisodeCount": 69,
        "scenarioMeanTotalCostSumKRW": 295541183.3333334,
        "scenarioMeanIncrementalCostSumKRW": 172624733.33333334,
        "scenarioMeanRevisionCountSum": 1948.6666666666667,
        "episodeTotalCostSumKRW": 886623550,
        "episodeIncrementalCostSumKRW": 517874200,
        "episodeRevisionCountSum": 5846,
        "knownRevisionEpisodeCount": 69,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 79,
        "fullSampleEpisodeCount": 216
      },
      "adaptiveV9": {
        "scenarioCount": 23,
        "jointEpisodeCount": 69,
        "scenarioMeanTotalCostSumKRW": 298784633.3333334,
        "scenarioMeanIncrementalCostSumKRW": 175868183.33333334,
        "scenarioMeanRevisionCountSum": 2009,
        "episodeTotalCostSumKRW": 896353900,
        "episodeIncrementalCostSumKRW": 527604550,
        "episodeRevisionCountSum": 6027,
        "knownRevisionEpisodeCount": 69,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 81,
        "fullSampleEpisodeCount": 216
      },
      "highsV8": {
        "scenarioCount": 23,
        "jointEpisodeCount": 69,
        "scenarioMeanTotalCostSumKRW": 283462250,
        "scenarioMeanIncrementalCostSumKRW": 160545800,
        "scenarioMeanRevisionCountSum": 7045,
        "episodeTotalCostSumKRW": 850386750,
        "episodeIncrementalCostSumKRW": 481637400,
        "episodeRevisionCountSum": 21135,
        "knownRevisionEpisodeCount": 69,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 105,
        "fullSampleEpisodeCount": 216
      },
      "stableHiGHSV10": {
        "scenarioCount": 23,
        "jointEpisodeCount": 69,
        "scenarioMeanTotalCostSumKRW": 283944950,
        "scenarioMeanIncrementalCostSumKRW": 161028500,
        "scenarioMeanRevisionCountSum": 2354,
        "episodeTotalCostSumKRW": 851834850,
        "episodeIncrementalCostSumKRW": 483085500,
        "episodeRevisionCountSum": 7062,
        "knownRevisionEpisodeCount": 69,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 114,
        "fullSampleEpisodeCount": 216
      },
      "commitmentHiGHSV11": {
        "scenarioCount": 23,
        "jointEpisodeCount": 69,
        "scenarioMeanTotalCostSumKRW": 283979500,
        "scenarioMeanIncrementalCostSumKRW": 161063050,
        "scenarioMeanRevisionCountSum": 2735,
        "episodeTotalCostSumKRW": 851938500,
        "episodeIncrementalCostSumKRW": 483189150,
        "episodeRevisionCountSum": 8205,
        "knownRevisionEpisodeCount": 69,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 111,
        "fullSampleEpisodeCount": 216
      },
      "seededHiGHSV12": {
        "scenarioCount": 23,
        "jointEpisodeCount": 69,
        "scenarioMeanTotalCostSumKRW": 283979500,
        "scenarioMeanIncrementalCostSumKRW": 161063050,
        "scenarioMeanRevisionCountSum": 2739,
        "episodeTotalCostSumKRW": 851938500,
        "episodeIncrementalCostSumKRW": 483189150,
        "episodeRevisionCountSum": 8217,
        "knownRevisionEpisodeCount": 69,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 120,
        "fullSampleEpisodeCount": 216
      }
    },
    "frontiers": {
      "totalAndRevisions": [
        {
          "method": "costPolishV7",
          "dominates": [
            "adaptiveV9"
          ],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "adaptiveV9",
          "dominates": [],
          "dominatedBy": [
            "costPolishV7"
          ],
          "pareto": false
        },
        {
          "method": "highsV8",
          "dominates": [],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "stableHiGHSV10",
          "dominates": [
            "commitmentHiGHSV11",
            "seededHiGHSV12"
          ],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "commitmentHiGHSV11",
          "dominates": [
            "seededHiGHSV12"
          ],
          "dominatedBy": [
            "stableHiGHSV10"
          ],
          "pareto": false
        },
        {
          "method": "seededHiGHSV12",
          "dominates": [],
          "dominatedBy": [
            "stableHiGHSV10",
            "commitmentHiGHSV11"
          ],
          "pareto": false
        }
      ],
      "incrementalAndRevisions": [
        {
          "method": "costPolishV7",
          "dominates": [
            "adaptiveV9"
          ],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "adaptiveV9",
          "dominates": [],
          "dominatedBy": [
            "costPolishV7"
          ],
          "pareto": false
        },
        {
          "method": "highsV8",
          "dominates": [],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "stableHiGHSV10",
          "dominates": [
            "commitmentHiGHSV11",
            "seededHiGHSV12"
          ],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "commitmentHiGHSV11",
          "dominates": [
            "seededHiGHSV12"
          ],
          "dominatedBy": [
            "stableHiGHSV10"
          ],
          "pareto": false
        },
        {
          "method": "seededHiGHSV12",
          "dominates": [],
          "dominatedBy": [
            "stableHiGHSV10",
            "commitmentHiGHSV11"
          ],
          "pareto": false
        }
      ]
    },
    "scenarios": [
      {
        "scenarioId": "v12-stress-aged-backlog-balanced-n24-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 20388650,
            "incrementalCost": 10993800,
            "revisionCount": 54
          },
          "adaptiveV9": {
            "totalCost": 20388650,
            "incrementalCost": 10993800,
            "revisionCount": 54
          },
          "highsV8": {
            "totalCost": 20388650,
            "incrementalCost": 10993800,
            "revisionCount": 91
          },
          "stableHiGHSV10": {
            "totalCost": 20388650,
            "incrementalCost": 10993800,
            "revisionCount": 61
          },
          "commitmentHiGHSV11": {
            "totalCost": 20388650,
            "incrementalCost": 10993800,
            "revisionCount": 61
          },
          "seededHiGHSV12": {
            "totalCost": 20388650,
            "incrementalCost": 10993800,
            "revisionCount": 61
          }
        }
      },
      {
        "scenarioId": "v12-stress-aged-backlog-balanced-n24-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 13853100,
            "incrementalCost": 7683200,
            "revisionCount": 63
          },
          "adaptiveV9": {
            "totalCost": 13853100,
            "incrementalCost": 7683200,
            "revisionCount": 63
          },
          "highsV8": {
            "totalCost": 13929500,
            "incrementalCost": 7759600,
            "revisionCount": 84
          },
          "stableHiGHSV10": {
            "totalCost": 13873100,
            "incrementalCost": 7703200,
            "revisionCount": 52
          },
          "commitmentHiGHSV11": {
            "totalCost": 13873100,
            "incrementalCost": 7703200,
            "revisionCount": 52
          },
          "seededHiGHSV12": {
            "totalCost": 13873100,
            "incrementalCost": 7703200,
            "revisionCount": 52
          }
        }
      },
      {
        "scenarioId": "v12-stress-aged-backlog-balanced-n24-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 16886750,
            "incrementalCost": 9572550,
            "revisionCount": 52
          },
          "adaptiveV9": {
            "totalCost": 16886750,
            "incrementalCost": 9572550,
            "revisionCount": 55
          },
          "highsV8": {
            "totalCost": 17043400,
            "incrementalCost": 9729200,
            "revisionCount": 96
          },
          "stableHiGHSV10": {
            "totalCost": 17023400,
            "incrementalCost": 9709200,
            "revisionCount": 53
          },
          "commitmentHiGHSV11": {
            "totalCost": 17023400,
            "incrementalCost": 9709200,
            "revisionCount": 66
          },
          "seededHiGHSV12": {
            "totalCost": 17023400,
            "incrementalCost": 9709200,
            "revisionCount": 66
          }
        }
      },
      {
        "scenarioId": "v12-stress-aged-backlog-balanced-n50-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 28517700,
            "incrementalCost": 16319500,
            "revisionCount": 145.66666666666666
          },
          "adaptiveV9": {
            "totalCost": 28517700,
            "incrementalCost": 16319500,
            "revisionCount": 145.66666666666666
          },
          "highsV8": {
            "totalCost": 28309000,
            "incrementalCost": 16110800,
            "revisionCount": 195
          },
          "stableHiGHSV10": {
            "totalCost": 28310850,
            "incrementalCost": 16112650,
            "revisionCount": 118
          },
          "commitmentHiGHSV11": {
            "totalCost": 28309000,
            "incrementalCost": 16110800,
            "revisionCount": 155
          },
          "seededHiGHSV12": {
            "totalCost": 28309000,
            "incrementalCost": 16110800,
            "revisionCount": 155
          }
        }
      },
      {
        "scenarioId": "v12-stress-aged-backlog-balanced-n50-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 32971966.666666668,
            "incrementalCost": 18891116.666666668,
            "revisionCount": 130.33333333333334
          },
          "adaptiveV9": {
            "totalCost": 32971966.666666668,
            "incrementalCost": 18891116.666666668,
            "revisionCount": 130.33333333333334
          },
          "highsV8": {
            "totalCost": 32687050,
            "incrementalCost": 18606200,
            "revisionCount": 119
          },
          "stableHiGHSV10": {
            "totalCost": 32687050,
            "incrementalCost": 18606200,
            "revisionCount": 95
          },
          "commitmentHiGHSV11": {
            "totalCost": 32687050,
            "incrementalCost": 18606200,
            "revisionCount": 95
          },
          "seededHiGHSV12": {
            "totalCost": 32687050,
            "incrementalCost": 18606200,
            "revisionCount": 95
          }
        }
      },
      {
        "scenarioId": "v12-stress-aged-backlog-balanced-n100-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 60320816.666666664,
            "incrementalCost": 35846516.666666664,
            "revisionCount": 338.6666666666667
          },
          "adaptiveV9": {
            "totalCost": 59739316.666666664,
            "incrementalCost": 35265016.666666664,
            "revisionCount": 345.3333333333333
          },
          "highsV8": {
            "totalCost": 55617100,
            "incrementalCost": 31142800,
            "revisionCount": 341
          },
          "stableHiGHSV10": {
            "totalCost": 55617100,
            "incrementalCost": 31142800,
            "revisionCount": 226
          },
          "commitmentHiGHSV11": {
            "totalCost": 55617100,
            "incrementalCost": 31142800,
            "revisionCount": 226
          },
          "seededHiGHSV12": {
            "totalCost": 55617100,
            "incrementalCost": 31142800,
            "revisionCount": 226
          }
        }
      },
      {
        "scenarioId": "v12-stress-aged-backlog-balanced-n100-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 52382550,
            "incrementalCost": 30150900,
            "revisionCount": 350
          },
          "adaptiveV9": {
            "totalCost": 54910950,
            "incrementalCost": 32679300,
            "revisionCount": 368
          },
          "highsV8": {
            "totalCost": 48920950,
            "incrementalCost": 26689300,
            "revisionCount": 287
          },
          "stableHiGHSV10": {
            "totalCost": 49021000,
            "incrementalCost": 26789350,
            "revisionCount": 227
          },
          "commitmentHiGHSV11": {
            "totalCost": 49021000,
            "incrementalCost": 26789350,
            "revisionCount": 227
          },
          "seededHiGHSV12": {
            "totalCost": 49021000,
            "incrementalCost": 26789350,
            "revisionCount": 227
          }
        }
      },
      {
        "scenarioId": "v12-stress-aged-backlog-balanced-n100-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 62552183.333333336,
            "incrementalCost": 36236783.333333336,
            "revisionCount": 244.66666666666666
          },
          "adaptiveV9": {
            "totalCost": 63931200,
            "incrementalCost": 37615800,
            "revisionCount": 259
          },
          "highsV8": {
            "totalCost": 59652600,
            "incrementalCost": 33337200,
            "revisionCount": 304
          },
          "stableHiGHSV10": {
            "totalCost": 59652600,
            "incrementalCost": 33337200,
            "revisionCount": 193
          },
          "commitmentHiGHSV11": {
            "totalCost": 59652600,
            "incrementalCost": 33337200,
            "revisionCount": 193
          },
          "seededHiGHSV12": {
            "totalCost": 59652600,
            "incrementalCost": 33337200,
            "revisionCount": 193
          }
        }
      },
      {
        "scenarioId": "v12-stress-new-arrivals-balanced-n24-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 12
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 12
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 161
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 38
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 45
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 77
          }
        }
      },
      {
        "scenarioId": "v12-stress-new-arrivals-balanced-n24-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 12
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 12
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 161
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 40
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 40
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 46
          }
        }
      },
      {
        "scenarioId": "v12-stress-new-arrivals-balanced-n50-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 44
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 44
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 442
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 95
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 95
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 121
          }
        }
      },
      {
        "scenarioId": "v12-stress-new-arrivals-balanced-n50-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 366
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 49
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 121
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 123
          }
        }
      },
      {
        "scenarioId": "v12-stress-new-arrivals-balanced-n100-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 53
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 53
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 878
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 169
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 169
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 165
          }
        }
      },
      {
        "scenarioId": "v12-stress-new-arrivals-balanced-n100-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 24
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 24
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 800
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 102
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 246
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 188
          }
        }
      },
      {
        "scenarioId": "v12-stress-batch-release-balanced-n24-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 436800,
            "incrementalCost": 318500,
            "revisionCount": 6
          },
          "adaptiveV9": {
            "totalCost": 436800,
            "incrementalCost": 318500,
            "revisionCount": 6
          },
          "highsV8": {
            "totalCost": 464100,
            "incrementalCost": 345800,
            "revisionCount": 132
          },
          "stableHiGHSV10": {
            "totalCost": 473200,
            "incrementalCost": 354900,
            "revisionCount": 44
          },
          "commitmentHiGHSV11": {
            "totalCost": 473200,
            "incrementalCost": 354900,
            "revisionCount": 44
          },
          "seededHiGHSV12": {
            "totalCost": 473200,
            "incrementalCost": 354900,
            "revisionCount": 44
          }
        }
      },
      {
        "scenarioId": "v12-stress-batch-release-balanced-n24-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 412200,
            "incrementalCost": 321200,
            "revisionCount": 30
          },
          "adaptiveV9": {
            "totalCost": 412200,
            "incrementalCost": 321200,
            "revisionCount": 30
          },
          "highsV8": {
            "totalCost": 412200,
            "incrementalCost": 321200,
            "revisionCount": 129
          },
          "stableHiGHSV10": {
            "totalCost": 412200,
            "incrementalCost": 321200,
            "revisionCount": 62
          },
          "commitmentHiGHSV11": {
            "totalCost": 412200,
            "incrementalCost": 321200,
            "revisionCount": 69
          },
          "seededHiGHSV12": {
            "totalCost": 412200,
            "incrementalCost": 321200,
            "revisionCount": 69
          }
        }
      },
      {
        "scenarioId": "v12-stress-batch-release-balanced-n24-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 418600,
            "incrementalCost": 382200,
            "revisionCount": 5
          },
          "adaptiveV9": {
            "totalCost": 418600,
            "incrementalCost": 382200,
            "revisionCount": 5
          },
          "highsV8": {
            "totalCost": 418600,
            "incrementalCost": 382200,
            "revisionCount": 136
          },
          "stableHiGHSV10": {
            "totalCost": 418600,
            "incrementalCost": 382200,
            "revisionCount": 42
          },
          "commitmentHiGHSV11": {
            "totalCost": 418600,
            "incrementalCost": 382200,
            "revisionCount": 42
          },
          "seededHiGHSV12": {
            "totalCost": 418600,
            "incrementalCost": 382200,
            "revisionCount": 42
          }
        }
      },
      {
        "scenarioId": "v12-stress-batch-release-balanced-n24-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 400400,
            "incrementalCost": 345800,
            "revisionCount": 17
          },
          "adaptiveV9": {
            "totalCost": 400400,
            "incrementalCost": 345800,
            "revisionCount": 17
          },
          "highsV8": {
            "totalCost": 400400,
            "incrementalCost": 345800,
            "revisionCount": 144
          },
          "stableHiGHSV10": {
            "totalCost": 418600,
            "incrementalCost": 364000,
            "revisionCount": 42
          },
          "commitmentHiGHSV11": {
            "totalCost": 418600,
            "incrementalCost": 364000,
            "revisionCount": 42
          },
          "seededHiGHSV12": {
            "totalCost": 418600,
            "incrementalCost": 364000,
            "revisionCount": 42
          }
        }
      },
      {
        "scenarioId": "v12-stress-batch-release-balanced-n50-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 536900,
            "incrementalCost": 436800,
            "revisionCount": 14
          },
          "adaptiveV9": {
            "totalCost": 536900,
            "incrementalCost": 436800,
            "revisionCount": 14
          },
          "highsV8": {
            "totalCost": 536900,
            "incrementalCost": 436800,
            "revisionCount": 267
          },
          "stableHiGHSV10": {
            "totalCost": 536900,
            "incrementalCost": 436800,
            "revisionCount": 28
          },
          "commitmentHiGHSV11": {
            "totalCost": 536900,
            "incrementalCost": 436800,
            "revisionCount": 34
          },
          "seededHiGHSV12": {
            "totalCost": 536900,
            "incrementalCost": 436800,
            "revisionCount": 34
          }
        }
      },
      {
        "scenarioId": "v12-stress-batch-release-balanced-n50-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1518700,
            "incrementalCost": 1464100,
            "revisionCount": 119
          },
          "adaptiveV9": {
            "totalCost": 1458200,
            "incrementalCost": 1403600,
            "revisionCount": 123
          },
          "highsV8": {
            "totalCost": 937300,
            "incrementalCost": 882700,
            "revisionCount": 286
          },
          "stableHiGHSV10": {
            "totalCost": 937300,
            "incrementalCost": 882700,
            "revisionCount": 105
          },
          "commitmentHiGHSV11": {
            "totalCost": 937300,
            "incrementalCost": 882700,
            "revisionCount": 145
          },
          "seededHiGHSV12": {
            "totalCost": 937300,
            "incrementalCost": 882700,
            "revisionCount": 145
          }
        }
      },
      {
        "scenarioId": "v12-stress-batch-release-balanced-n100-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1094700,
            "incrementalCost": 985500,
            "revisionCount": 63
          },
          "adaptiveV9": {
            "totalCost": 1090766.6666666667,
            "incrementalCost": 981566.6666666666,
            "revisionCount": 79
          },
          "highsV8": {
            "totalCost": 1019200,
            "incrementalCost": 910000,
            "revisionCount": 653
          },
          "stableHiGHSV10": {
            "totalCost": 1073800,
            "incrementalCost": 964600,
            "revisionCount": 130
          },
          "commitmentHiGHSV11": {
            "totalCost": 1073800,
            "incrementalCost": 964600,
            "revisionCount": 130
          },
          "seededHiGHSV12": {
            "totalCost": 1073800,
            "incrementalCost": 964600,
            "revisionCount": 130
          }
        }
      },
      {
        "scenarioId": "v12-stress-batch-release-balanced-n100-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1010100,
            "incrementalCost": 910000,
            "revisionCount": 51
          },
          "adaptiveV9": {
            "totalCost": 1010100,
            "incrementalCost": 910000,
            "revisionCount": 51
          },
          "highsV8": {
            "totalCost": 1001000,
            "incrementalCost": 900900,
            "revisionCount": 672
          },
          "stableHiGHSV10": {
            "totalCost": 1010100,
            "incrementalCost": 910000,
            "revisionCount": 253
          },
          "commitmentHiGHSV11": {
            "totalCost": 1010100,
            "incrementalCost": 910000,
            "revisionCount": 268
          },
          "seededHiGHSV12": {
            "totalCost": 1010100,
            "incrementalCost": 910000,
            "revisionCount": 268
          }
        }
      },
      {
        "scenarioId": "v12-stress-batch-release-tight-n50-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1839066.6666666667,
            "incrementalCost": 1766266.6666666667,
            "revisionCount": 120.33333333333333
          },
          "adaptiveV9": {
            "totalCost": 1821033.3333333333,
            "incrementalCost": 1748233.3333333333,
            "revisionCount": 118.66666666666667
          },
          "highsV8": {
            "totalCost": 1724300,
            "incrementalCost": 1651500,
            "revisionCount": 301
          },
          "stableHiGHSV10": {
            "totalCost": 2090500,
            "incrementalCost": 2017700,
            "revisionCount": 130
          },
          "commitmentHiGHSV11": {
            "totalCost": 2126900,
            "incrementalCost": 2054100,
            "revisionCount": 170
          },
          "seededHiGHSV12": {
            "totalCost": 2126900,
            "incrementalCost": 2054100,
            "revisionCount": 170
          }
        }
      }
    ],
    "scope": "Conditional all-six jointly completed matching repeats; average within scenario then equal scenario weight. No revision-to-KRW conversion. This table never overrides full-sample completion losses or establishes universal dominance."
  },
  "observedDecisionGates": {
    "candidateMethod": "seededHiGHSV12",
    "assessmentState": "complete-panel",
    "completionLossCountsByBaseline": {
      "commitmentHiGHSV11": 0,
      "stableHiGHSV10": 3,
      "adaptiveV9": 11,
      "highsV8": 3,
      "costPolishV7": 10
    },
    "completionGainCountsByBaseline": {
      "commitmentHiGHSV11": 9,
      "stableHiGHSV10": 9,
      "adaptiveV9": 50,
      "highsV8": 18,
      "costPolishV7": 51
    },
    "completionNonRegressionAllBaselines": false,
    "defaultRecommendationEligible": false,
    "nativeComparison": {
      "lostEpisodeCount": 3,
      "revisionPairedEpisodeCount": 102,
      "revisionDelta": -20126,
      "strictRevisionReduction": true,
      "incrementalFeeClaim": "conditional_deterioration_interval_negative",
      "totalFeeClaim": "conditional_deterioration_interval_negative",
      "noRobustFeeDeterioration": false,
      "stabilityImprovementClaimAllowed": false
    },
    "nativeComparisons": {
      "commitmentHiGHSV11": {
        "lostEpisodeCount": 0,
        "revisionPairedEpisodeCount": 111,
        "revisionDelta": 757,
        "strictRevisionReduction": false,
        "incrementalFeeClaim": "no_stable_advantage",
        "totalFeeClaim": "no_stable_advantage",
        "noRobustFeeDeterioration": true,
        "stabilityImprovementClaimAllowed": false
      },
      "stableHiGHSV10": {
        "lostEpisodeCount": 3,
        "revisionPairedEpisodeCount": 111,
        "revisionDelta": 3784,
        "strictRevisionReduction": false,
        "incrementalFeeClaim": "no_stable_advantage",
        "totalFeeClaim": "no_stable_advantage",
        "noRobustFeeDeterioration": true,
        "stabilityImprovementClaimAllowed": false
      },
      "highsV8": {
        "lostEpisodeCount": 3,
        "revisionPairedEpisodeCount": 102,
        "revisionDelta": -20126,
        "strictRevisionReduction": true,
        "incrementalFeeClaim": "conditional_deterioration_interval_negative",
        "totalFeeClaim": "conditional_deterioration_interval_negative",
        "noRobustFeeDeterioration": false,
        "stabilityImprovementClaimAllowed": false
      }
    },
    "scope": "Observed necessary gates against the five included comparators only. Any full-sample completion loss blocks default eligibility; net gains and conditional fees/Pareto position do not offset losses. Native stability claims use each exact native paired set; zero-inclusive fee intervals do not prove stable savings. No claim against omitted V5 or universal/production recommendation."
  }
}
```

## 原始证据哈希

```json
{
  "data/v12-release.json": "dd42a8f06cbe94cec999e41c14aa28ec070f148b7d6699b759ff8036ead2ed26",
  "data/v12-results.json": "7191864395c3e45230477610c0bfb6da2fac49bbc5344fb5cf60bbe271745c5d",
  "data/evidence-v12/v12-frozen-first/first-run/complete.json": "141ac68b0627e74ffa41f881078d9d73304263240e858d148c64e91562217646",
  "data/protocol-v12.json": "b0b7c0d0ee8f49bda0ff69b6d8f4701d0e360cccc489a28377745a5635e5069a",
  "data/evidence-v12/v12-frozen-first/manifest.json": "a1266ca661fa1927e65182aff54755f3a8a15bb28096d3e1227c35a54a6e9165",
  "data/review-v12.json": "cf1ef392780593c71ad90cfcc1f2a3911d78fdcaa2ee55cd4405929aa66dd757",
  "data/bootstrap-review-v12.json": "82e7c19eb8e7b4db27ef98b5d0a94fbb6bbd617fc5381dc22a4b7398d7ca2a17",
  "data/development-seed-review-v12.json": "f806399473fab8b096b7f42eb10c584c2fcb626577b23e84595bf7a79b8c24f3",
  "data/seeded-initial-development-v12.json": "9aa595576ed12988d58a6910583a7feaab365e5430d134c123e29f30da704cbf",
  "artifacts/seeded-v12-d0-first-development/summary.json": "5b3104a5b8987ff36d00edc575e4b7850f23d225a109fca589026d66870db349",
  "data/native-diagnostic-review-v12-final.json": "0d7aed9b2f02a12e02884688ed23a1219293b22df8830dd0c3130e229ffe5dd2",
  "data/native-diagnostic-v12.json": "2e284c8aec25ff58df54668a5a52d6d65b893a8393c848d24a445df224ba2ef6",
  "data/public-source-field-coverage-v12.json": "5660d61f75074d4173b15696b140f78e80002c7ab2a4d68dc8b8e294e01015bb",
  "docs/public-source-field-coverage-v12.zh.md": "ee6329b7a4b90f4eb6b67400b55219cb2b1ddd04377d43c45776093ae857f09c"
}
```

