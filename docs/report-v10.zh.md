# PortPlan V10：同费保留与原生排程稳定性

AI 编写的准备资料；不代表参赛者本人创作、理解、报名资格、现场验证或已提交。

## 本轮直接结果

同生成机制·新订单种子：V10完成156/216，原生HiGHS完成153/216；匹配重复完成增加/损失为3/0。损失涉及0个业务情景，不能把同一情景的多次重复当独立业务失败。共同完成153对中，改期53667→12117，下降77.42%。总费用节省-0.01166647%，条件95%区间[-0.06264978374, 0.0178671957]；增量费用节省-0.02002230%，条件95%区间[-0.1066936675, 0.03042521996]。区间跨零时只能说未观察到稳健费用优势；负节省点估计代表候选更贵。

相对V7的另一个配对集：增量两费条件节省9.180%，95%区间[6.488110178, 11.7562391]；分母43个情景/129对。全样本完成增加/损失27/15，后者是V7完成而V10失败的重复。这项条件节省与相对原生HiGHS无稳健费用优势属于不同基准和分母，不能混为统一排名或抵消完成损失。

压力扰动·新订单种子：V10完成132/216，原生HiGHS完成120/216；匹配重复完成增加/损失为15/3。损失涉及1个业务情景，不能把同一情景的多次重复当独立业务失败。共同完成117对中，改期45972→17625，下降61.66%。总费用节省-0.16405648%，条件95%区间[-0.6282350661, 0.04157422929]；增量费用节省-0.28474977%，条件95%区间[-1.063162036, 0.06948376842]。区间跨零时只能说未观察到稳健费用优势；负节省点估计代表候选更贵。

相对V7的另一个配对集：增量两费条件节省10.883%，95%区间[6.905172586, 14.42325021]；分母32个情景/95对。全样本完成增加/损失37/12，后者是V7完成而V10失败的重复。这项条件节省与相对原生HiGHS无稳健费用优势属于不同基准和分母，不能混为统一排名或抵消完成损失。

V10 的改动是：原生 HiGHS 每日只求解一次；先对当前缓存按当天观测重新计费并检查物理约束与已执行锁定，只在新方案严格节省费用时替换。同费保留当前有效日期。数值容差固定为 0.000001 韩元。
这不是全局最少改期算法、第二阶段词典序优化，也没有把一次改期乘以任意韩元权重。严格省费方案仍可能改变许多日期及未来轨迹。

## 当前结果的边界

两组各 72 个新订单情景，沿用旧生成器和扰动机制；每情景 3 次算法/计时重复、5 个方法，共 2,160 次完整冷启动。日预算 200ms，整段父进程 5s；初始化、IPC、检查及终端接收计入预算。重复不是新独立业务样本。
对任何旧基准出现完成损失，均不满足预声明默认候选必要门槛。对原生 HiGHS 的条件稳定性结论还要求零完成损失、完全相同配对集内改期严格减少，以及总费/增量费两个可用区间均不完全落在负侧。区间含零只能说没有稳健费用优势。

```json
{
  "same-distribution": {
    "candidateMethod": "stableHiGHSV10",
    "assessmentState": "complete-panel",
    "completionLossCountsByBaseline": {
      "highsV8": 0,
      "adaptiveV9": 15,
      "costPolishV7": 15,
      "stableRetainV5": 8
    },
    "completionNonRegressionAllBaselines": false,
    "defaultRecommendationEligible": false,
    "nativeComparison": {
      "lostEpisodeCount": 0,
      "revisionPairedEpisodeCount": 153,
      "revisionDelta": -41550,
      "strictRevisionReduction": true,
      "incrementalFeeClaim": "no_stable_advantage",
      "totalFeeClaim": "no_stable_advantage",
      "noRobustFeeDeterioration": true,
      "stabilityImprovementClaimAllowed": true
    },
    "scope": "Observed necessary gates only. Any full-sample completion loss against an old baseline prevents default eligibility. A fee interval containing zero gives no stable fee advantage; stability is conditional on the exact native paired set. No production or universal non-regression claim."
  },
  "stress": {
    "candidateMethod": "stableHiGHSV10",
    "assessmentState": "complete-panel",
    "completionLossCountsByBaseline": {
      "highsV8": 3,
      "adaptiveV9": 12,
      "costPolishV7": 12,
      "stableRetainV5": 3
    },
    "completionNonRegressionAllBaselines": false,
    "defaultRecommendationEligible": false,
    "nativeComparison": {
      "lostEpisodeCount": 3,
      "revisionPairedEpisodeCount": 117,
      "revisionDelta": -28347,
      "strictRevisionReduction": true,
      "incrementalFeeClaim": "no_stable_advantage",
      "totalFeeClaim": "no_stable_advantage",
      "noRobustFeeDeterioration": true,
      "stabilityImprovementClaimAllowed": false
    },
    "scope": "Observed necessary gates only. Any full-sample completion loss against an old baseline prevents default eligibility. A fee interval containing zero gives no stable fee advantage; stability is conditional on the exact native paired set. No production or universal non-regression claim."
  }
}
```

未达到全部门槛时，V10 应保持实验选项。即使观察门槛通过，也不证明真实运营适合作为默认方案、未来不退步或夺冠概率。

## 保留既有负面历史

上一轮 V9：同生成机制·新订单种子 150/216; 压力扰动·新订单种子 84/216；同轮 V7：同生成机制·新订单种子 150/216; 压力扰动·新订单种子 85/216。
以上属于上一轮不同订单输入，不与 V10 的新输入计数相减作为提升。旧输入、失败和不利结果均保留。

## 公开资料路线与分别记录的验收范围

| 验收范围 | 当前证据/状态 |
| --- | --- |
| 算法研究 | 本报告的2,160次新订单实验、独立物理与统计复核；观察门槛逐项报告 |
| 浏览器真实交互 | 尚未执行；当前缺少受支持浏览器连接入口。构建、DOM、Worker检查不能替代 |
| 企业业务（可选） | 尚未开展；实单、报价、反馈和账单不属于公开资料路线的必需前置条件，不反复索要 |
| 本人复现与答辩 | 未验收；保留空白记录，AI不替本人填写理解、贡献、报名或通过 |

材料截止为2026-11-06 18:00，按韩国大学语境解释为KST，官方页面没有独立时区标记；报名为满额即止，剩余名额与本人占位未知。当届完整AI规定、资格、誓约和本人准备仍须确认。
默认以可核验公开资料、公开数据和明确标注的可复现实验继续开发。范围说明与可选空CSV见 `docs/acceptance-handoff-v10.zh.md`；浏览器范围见 `docs/browser-acceptance-v10.zh.md`；本轮官方复查见 `docs/rules-update-v10.md`。这些是准备与只读核查，不构成报名、提交、签署或现场验收通过。

## 压力完成损失的事后只读诊断

相对原生HiGHS的3次压力完成损失来自同一个业务场景的3次重复。D5原生服务约4.3–4.5ms即返回严格不可行，未触及日或整段时限；这是已执行前缀的不可行性，不是迟到候选。
独立Python从物理记录重建：C017已于D4开始连续2日卸货，因此D5必占1仓位；C010在D5仍未提卸、截止D5且未执行事件不能回到过去，因此D5也必占1。必要需求2大于当日公开容量1。
证明仅针对V10走到D5的已执行前缀，不证明D0原问题无解、不代表基准另一前缀不可行，也不排除真实业务加仓位等补救。D1已经产生路径分歧；D4同费保留展示改期/未来可恢复性的取舍，未受控重放“只替换D4”，不能声称换一次就必定完成。
完整原始绑定与必要条件见[只读损失诊断](v10-loss-diagnosis.zh.md)。该诊断未新增求解、在线重跑或新留出，也未改变首次结果。

## 完整配对费用、改期和不利结果

节省 = 基准 − 候选。每个情景内先平均共同完成的匹配重复，再对情景等权。各比较分母不同，失败费用为 null。费用区间以共同完成集合为条件，独立重算不能消除完成选择偏差。

### 同生成机制·新订单种子

| method | complete / all | all 3 repeats | unknown history | observed revisions / unknown | parent mean ms |
| --- | --- | --- | --- | --- | --- |
| stableRetainV5 | 122 / 216 | 40 | 0 | 4134 / 0 | 289.64 |
| costPolishV7 | 144 / 216 | 48 | 0 | 7492 / 0 | 310.02 |
| adaptiveV9 | 145 / 216 | 48 | 0 | 7702 / 0 | 355.47 |
| highsV8 | 153 / 216 | 51 | 0 | 55431 / 0 | 577.51 |
| stableHiGHSV10 | 156 / 216 | 52 | 0 | 12606 / 0 | 593.64 |

#### v10VsHiGHS · V10 동일 요금 계획 유지 / 독립 native HiGHS

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 51 / 153 | 382,292,050.00 | 382,336,650.00 | -44,600.00 | -0.01% | 3/42/6 | 30,000.00 | 20 / 60 | [-0.06264978374, 0.0178671957] |
| incremental | 51 / 153 | 222,751,650.00 | 222,796,250.00 | -44,600.00 | -0.02% | 3/42/6 | 30,000.00 | 20 / 60 | [-0.1066936675, 0.03042521996] |

完成增加/损失: 3 / 0 episodes. 情景平均完成率差: 0.013889; 95% CI [0, 0.04166666667].
同一配对完成重复的改期合计: 53667 → 12117; n=153.

total: raw matched episode sums KRW 1,146,876,150.00 → 1,147,009,950.00; mean scenario saving KRW 95% CI [-3327.45098, 1594.803922]; bootstrap scenario n=51, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n24-r2`
- `v10-same-distribution-batch-release-balanced-n24-r3`
- `v10-same-distribution-batch-release-balanced-n50-r3`
- `v10-same-distribution-batch-release-balanced-n50-r4`
- `v10-same-distribution-batch-release-balanced-n100-r4`
- `v10-same-distribution-batch-release-tight-n50-r4`

**total / negativeEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-same-distribution-batch-release-balanced-n24-r3::repeat-1`
- `v10-same-distribution-batch-release-balanced-n24-r3::repeat-2`
- `v10-same-distribution-batch-release-balanced-n24-r3::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r3::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r3::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r3::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-tight-n50-r4::repeat-1`
- `v10-same-distribution-batch-release-tight-n50-r4::repeat-2`
- `v10-same-distribution-batch-release-tight-n50-r4::repeat-3`

incremental: raw matched episode sums KRW 668,254,950.00 → 668,388,750.00; mean scenario saving KRW 95% CI [-3327.45098, 1594.803922]; bootstrap scenario n=51, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n24-r2`
- `v10-same-distribution-batch-release-balanced-n24-r3`
- `v10-same-distribution-batch-release-balanced-n50-r3`
- `v10-same-distribution-batch-release-balanced-n50-r4`
- `v10-same-distribution-batch-release-balanced-n100-r4`
- `v10-same-distribution-batch-release-tight-n50-r4`

**incremental / negativeEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-same-distribution-batch-release-balanced-n24-r3::repeat-1`
- `v10-same-distribution-batch-release-balanced-n24-r3::repeat-2`
- `v10-same-distribution-batch-release-balanced-n24-r3::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r3::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r3::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r3::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-tight-n50-r4::repeat-1`
- `v10-same-distribution-batch-release-tight-n50-r4::repeat-2`
- `v10-same-distribution-batch-release-tight-n50-r4::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`

**lostEpisodeIds — all retained**

none / 없음 / 无

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### v10VsV9 · V10 동일 요금 계획 유지 / V9 적시 후보 전달

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 44 / 130 | 366,237,383.33 | 346,556,150.00 | 19,681,233.33 | 5.37% | 19/24/1 | 21,066.67 | 14 / 40 | [3.727077625, 6.986050377] |
| incremental | 44 / 130 | 215,649,083.33 | 195,967,850.00 | 19,681,233.33 | 9.13% | 19/24/1 | 21,066.67 | 14 / 40 | [6.391722115, 11.69514086] |

完成增加/损失: 26 / 15 episodes. 情景平均完成率差: 0.050926; 95% CI [-0.0462962963, 0.1481481481].
同一配对完成重复的改期合计: 6033 → 9709; n=130.

total: raw matched episode sums KRW 1,098,712,150.00 → 1,039,668,450.00; mean scenario saving KRW 95% CI [179146.9602, 768878.589]; bootstrap scenario n=44, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4`

**total / negativeEpisodeIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`

incremental: raw matched episode sums KRW 646,947,250.00 → 587,903,550.00; mean scenario saving KRW 95% CI [179146.9602, 768878.589]; bootstrap scenario n=44, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4`

**incremental / negativeEpisodeIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`

**lostEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### v10VsV7 · V10 동일 요금 계획 유지 / V7 비용 다듬기

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 43 / 129 | 366,364,933.33 | 346,556,150.00 | 19,808,783.33 | 5.41% | 19/23/1 | 21,066.67 | 13 / 39 | [3.827665652, 7.105955147] |
| incremental | 43 / 129 | 215,776,633.33 | 195,967,850.00 | 19,808,783.33 | 9.18% | 19/23/1 | 21,066.67 | 13 / 39 | [6.488110178, 11.7562391] |

完成增加/损失: 27 / 15 episodes. 情景平均完成率差: 0.055556; 95% CI [-0.04166666667, 0.1527777778].
同一配对完成重复的改期合计: 5778 → 9489; n=129.

total: raw matched episode sums KRW 1,099,094,800.00 → 1,039,668,450.00; mean scenario saving KRW 95% CI [187327.1027, 776915.4167]; bootstrap scenario n=43, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4`

**total / negativeEpisodeIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`

incremental: raw matched episode sums KRW 647,329,900.00 → 587,903,550.00; mean scenario saving KRW 95% CI [187327.1027, 776915.4167]; bootstrap scenario n=43, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4`

**incremental / negativeEpisodeIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`

**lostEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### v10VsV5 · V10 동일 요금 계획 유지 / V5 유효 계획 유지

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 38 / 114 | 178,162,050.00 | 177,138,550.00 | 1,023,500.00 | 0.57% | 13/22/3 | 33,200.00 | 12 / 36 | [0.1261379376, 1.161382881] |
| incremental | 38 / 114 | 101,304,800.00 | 100,281,300.00 | 1,023,500.00 | 1.01% | 13/22/3 | 33,200.00 | 12 / 36 | [0.2166765502, 2.068417925] |

完成增加/损失: 42 / 8 episodes. 情景平均完成率差: 0.157407; 95% CI [0.06018518519, 0.2638888889].
同一配对完成重复的改期合计: 3351 → 7755; n=114.

total: raw matched episode sums KRW 534,486,150.00 → 531,415,650.00; mean scenario saving KRW 95% CI [4641.907895, 61188.35526]; bootstrap scenario n=38, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n50-r1`
- `v10-same-distribution-batch-release-balanced-n100-r4`
- `v10-same-distribution-batch-release-tight-n50-r1`

**total / negativeEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n50-r1::repeat-3`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v10-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v10-same-distribution-batch-release-tight-n50-r1::repeat-3`

incremental: raw matched episode sums KRW 303,914,400.00 → 300,843,900.00; mean scenario saving KRW 95% CI [4641.907895, 61188.35526]; bootstrap scenario n=38, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n50-r1`
- `v10-same-distribution-batch-release-balanced-n100-r4`
- `v10-same-distribution-batch-release-tight-n50-r1`

**incremental / negativeEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n50-r1::repeat-3`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-tight-n50-r1::repeat-1`
- `v10-same-distribution-batch-release-tight-n50-r1::repeat-2`
- `v10-same-distribution-batch-release-tight-n50-r1::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v10-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v10-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r1::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r1::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r1::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r3::repeat-3`

**lostEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-tight-n50-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n100-r1::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r1::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r1::repeat-3`
- `v10-same-distribution-aged-backlog-balanced-n100-r2::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r2::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r2::repeat-3`
- `v10-same-distribution-aged-backlog-balanced-n100-r4::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r4::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r4::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r1::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r1::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r1::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r3::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r3::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r3::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### highsVsV7 · 독립 native HiGHS / V7 비용 다듬기

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 42 / 126 | 338,080,983.33 | 319,662,050.00 | 18,418,933.33 | 5.45% | 19/22/1 | 2,866.67 | 13 / 39 | [3.590109484, 7.354110728] |
| incremental | 42 / 126 | 200,696,583.33 | 182,277,650.00 | 18,418,933.33 | 9.18% | 19/22/1 | 2,866.67 | 13 / 39 | [6.166972512, 11.98497554] |

完成增加/损失: 27 / 18 episodes. 情景平均完成率差: 0.041667; 95% CI [-0.05555555556, 0.1527777778].
同一配对完成重复的改期合计: 5589 → 40758; n=126.

total: raw matched episode sums KRW 1,014,242,950.00 → 958,986,150.00; mean scenario saving KRW 95% CI [172865.3373, 756539.752]; bootstrap scenario n=42, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4`

**total / negativeEpisodeIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`

incremental: raw matched episode sums KRW 602,089,750.00 → 546,832,950.00; mean scenario saving KRW 95% CI [172865.3373, 756539.752]; bootstrap scenario n=42, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4`

**incremental / negativeEpisodeIds — all retained**

- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-balanced-n100-r4::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`

**lostEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n50-r2::repeat-3`
- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-same-distribution-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n24-r3::repeat-3`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-tight-n50-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r2::repeat-3`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-1`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-2`
- `v10-same-distribution-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n24-r3::repeat-3`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-1`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-2`
- `v10-same-distribution-aged-backlog-tight-n50-r1::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r2::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n50-r4::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r3::repeat-3`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-1`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-2`
- `v10-same-distribution-new-arrivals-tight-n100-r4::repeat-3`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-1`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-2`
- `v10-same-distribution-batch-release-balanced-n50-r2::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### 五方法共同完成集：独立费用/改期轴
 
jointScenarioCount=36; jointEpisodeCount=108. 先平均每情景共同重复，再将情景均值求和；改期均值轴与原始 episode 改期合计分开。无共同样本或未知改期为 null。

| method | total scenario-mean sum KRW | incremental scenario-mean sum KRW | revision scenario-mean sum | raw episode revisions | full-sample complete / all |
| --- | --- | --- | --- | --- | --- |
| stableRetainV5 | 150,747,750.00 | 87,094,400.00 | 940.000 | 2,820 | 122 / 216 |
| costPolishV7 | 156,822,983.33 | 93,169,633.33 | 1,035.000 | 3,105 | 144 / 216 |
| adaptiveV9 | 156,749,683.33 | 93,096,333.33 | 1,106.000 | 3,318 | 145 / 216 |
| highsV8 | 150,204,450.00 | 86,551,100.00 | 10,751.000 | 32,253 | 153 / 216 |
| stableHiGHSV10 | 150,289,050.00 | 86,635,700.00 | 2,311.000 | 6,933 | 156 / 216 |

```json
{
  "totalAndRevisions": [
    {
      "method": "stableRetainV5",
      "dominates": [
        "costPolishV7",
        "adaptiveV9"
      ],
      "dominatedBy": [],
      "pareto": true
    },
    {
      "method": "costPolishV7",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
      ],
      "pareto": false
    },
    {
      "method": "adaptiveV9",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
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
      "dominates": [],
      "dominatedBy": [],
      "pareto": true
    }
  ],
  "incrementalAndRevisions": [
    {
      "method": "stableRetainV5",
      "dominates": [
        "costPolishV7",
        "adaptiveV9"
      ],
      "dominatedBy": [],
      "pareto": true
    },
    {
      "method": "costPolishV7",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
      ],
      "pareto": false
    },
    {
      "method": "adaptiveV9",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
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
      "dominates": [],
      "dominatedBy": [],
      "pareto": true
    }
  ]
}
```

#### 预声明观察门槛

```json
{
  "candidateMethod": "stableHiGHSV10",
  "assessmentState": "complete-panel",
  "completionLossCountsByBaseline": {
    "highsV8": 0,
    "adaptiveV9": 15,
    "costPolishV7": 15,
    "stableRetainV5": 8
  },
  "completionNonRegressionAllBaselines": false,
  "defaultRecommendationEligible": false,
  "nativeComparison": {
    "lostEpisodeCount": 0,
    "revisionPairedEpisodeCount": 153,
    "revisionDelta": -41550,
    "strictRevisionReduction": true,
    "incrementalFeeClaim": "no_stable_advantage",
    "totalFeeClaim": "no_stable_advantage",
    "noRobustFeeDeterioration": true,
    "stabilityImprovementClaimAllowed": true
  },
  "scope": "Observed necessary gates only. Any full-sample completion loss against an old baseline prevents default eligibility. A fee interval containing zero gives no stable fee advantage; stability is conditional on the exact native paired set. No production or universal non-regression claim."
}
```

### 压力扰动·新订单种子

| method | complete / all | all 3 repeats | unknown history | observed revisions / unknown | parent mean ms |
| --- | --- | --- | --- | --- | --- |
| stableRetainV5 | 81 / 216 | 27 | 0 | 6450 / 0 | 326.66 |
| costPolishV7 | 107 / 216 | 35 | 0 | 17994 / 0 | 412.07 |
| adaptiveV9 | 108 / 216 | 36 | 0 | 18356 / 0 | 455.25 |
| highsV8 | 120 / 216 | 40 | 0 | 60036 / 0 | 575.97 |
| stableHiGHSV10 | 132 / 216 | 44 | 0 | 25479 / 0 | 601.18 |

#### v10VsHiGHS · V10 동일 요금 계획 유지 / 독립 native HiGHS

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 39 / 117 | 298,311,900.00 | 298,801,300.00 | -489,400.00 | -0.16% | 3/28/8 | 392,150.00 | 15 / 45 | [-0.6282350661, 0.04157422929] |
| incremental | 39 / 117 | 171,870,200.00 | 172,359,600.00 | -489,400.00 | -0.28% | 3/28/8 | 392,150.00 | 15 / 45 | [-1.063162036, 0.06948376842] |

完成增加/损失: 15 / 3 episodes. 情景平均完成率差: 0.055556; 95% CI [0, 0.125].
同一配对完成重复的改期合计: 45972 → 17625; n=117.

total: raw matched episode sums KRW 894,935,700.00 → 896,403,900.00; mean scenario saving KRW 95% CI [-36073.62179, 2406.987179]; bootstrap scenario n=39, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r3`
- `v10-stress-aged-backlog-balanced-n50-r2`
- `v10-stress-aged-backlog-balanced-n50-r3`
- `v10-stress-aged-backlog-balanced-n100-r1`
- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`
- `v10-stress-batch-release-tight-n50-r4`
- `v10-stress-batch-release-tight-n100-r1`

**total / negativeEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r3::repeat-3`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`
- `v10-stress-batch-release-balanced-n100-r4::repeat-3`
- `v10-stress-batch-release-tight-n50-r4::repeat-1`
- `v10-stress-batch-release-tight-n50-r4::repeat-2`
- `v10-stress-batch-release-tight-n50-r4::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

incremental: raw matched episode sums KRW 515,610,600.00 → 517,078,800.00; mean scenario saving KRW 95% CI [-36073.62179, 2406.987179]; bootstrap scenario n=39, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r3`
- `v10-stress-aged-backlog-balanced-n50-r2`
- `v10-stress-aged-backlog-balanced-n50-r3`
- `v10-stress-aged-backlog-balanced-n100-r1`
- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`
- `v10-stress-batch-release-tight-n50-r4`
- `v10-stress-batch-release-tight-n100-r1`

**incremental / negativeEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r3::repeat-3`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n50-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n50-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n50-r3::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`
- `v10-stress-batch-release-balanced-n100-r4::repeat-3`
- `v10-stress-batch-release-tight-n50-r4::repeat-1`
- `v10-stress-batch-release-tight-n50-r4::repeat-2`
- `v10-stress-batch-release-tight-n50-r4::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-batch-release-tight-n100-r3::repeat-1`
- `v10-stress-batch-release-tight-n100-r3::repeat-2`
- `v10-stress-batch-release-tight-n100-r3::repeat-3`

**lostEpisodeIds — all retained**

- `v10-stress-new-arrivals-tight-n24-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-batch-release-tight-n100-r3::repeat-1`
- `v10-stress-batch-release-tight-n100-r3::repeat-2`
- `v10-stress-batch-release-tight-n100-r3::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### v10VsV9 · V10 동일 요금 계획 유지 / V9 적시 후보 전달

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 32 / 96 | 454,634,216.67 | 424,655,350.00 | 29,978,866.67 | 6.59% | 19/11/2 | 18,200.00 | 8 / 24 | [4.326216297, 8.641144431] |
| incremental | 32 / 96 | 267,992,266.67 | 238,013,400.00 | 29,978,866.67 | 11.19% | 19/11/2 | 18,200.00 | 8 / 24 | [7.343589128, 14.47182643] |

完成增加/损失: 36 / 12 episodes. 情景平均完成率差: 0.111111; 95% CI [0.01388888889, 0.2222222222].
同一配对完成重复的改期合计: 10510 → 14157; n=96.

total: raw matched episode sums KRW 1,363,902,650.00 → 1,273,966,050.00; mean scenario saving KRW 95% CI [372086.1068, 1637375.729]; bootstrap scenario n=32, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`

**total / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`

incremental: raw matched episode sums KRW 803,976,800.00 → 714,040,200.00; mean scenario saving KRW 95% CI [372086.1068, 1637375.729]; bootstrap scenario n=32, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`

**incremental / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`

**gainedEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**lostEpisodeIds — all retained**

- `v10-stress-batch-release-tight-n50-r2::repeat-1`
- `v10-stress-batch-release-tight-n50-r2::repeat-2`
- `v10-stress-batch-release-tight-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n50-r3::repeat-1`
- `v10-stress-batch-release-tight-n50-r3::repeat-2`
- `v10-stress-batch-release-tight-n50-r3::repeat-3`
- `v10-stress-batch-release-tight-n100-r2::repeat-1`
- `v10-stress-batch-release-tight-n100-r2::repeat-2`
- `v10-stress-batch-release-tight-n100-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r4::repeat-1`
- `v10-stress-batch-release-tight-n100-r4::repeat-2`
- `v10-stress-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### v10VsV7 · V10 동일 요금 계획 유지 / V7 비용 다듬기

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 32 / 95 | 453,721,600.00 | 424,655,350.00 | 29,066,250.00 | 6.41% | 17/13/2 | 18,200.00 | 8 / 24 | [4.055387922, 8.636337618] |
| incremental | 32 / 95 | 267,079,650.00 | 238,013,400.00 | 29,066,250.00 | 10.88% | 17/13/2 | 18,200.00 | 8 / 24 | [6.905172586, 14.42325021] |

完成增加/损失: 37 / 12 episodes. 情景平均完成率差: 0.115741; 95% CI [0.01388888889, 0.222337963].
同一配对完成重复的改期合计: 10058 → 14094; n=95.

total: raw matched episode sums KRW 1,344,355,850.00 → 1,257,187,100.00; mean scenario saving KRW 95% CI [363753.4766, 1588119.193]; bootstrap scenario n=32, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`

**total / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`
- `v10-stress-batch-release-balanced-n100-r4::repeat-3`

incremental: raw matched episode sums KRW 791,349,200.00 → 704,180,450.00; mean scenario saving KRW 95% CI [363753.4766, 1588119.193]; bootstrap scenario n=32, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`

**incremental / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`
- `v10-stress-batch-release-balanced-n100-r4::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**lostEpisodeIds — all retained**

- `v10-stress-batch-release-tight-n50-r2::repeat-1`
- `v10-stress-batch-release-tight-n50-r2::repeat-2`
- `v10-stress-batch-release-tight-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n50-r3::repeat-1`
- `v10-stress-batch-release-tight-n50-r3::repeat-2`
- `v10-stress-batch-release-tight-n50-r3::repeat-3`
- `v10-stress-batch-release-tight-n100-r2::repeat-1`
- `v10-stress-batch-release-tight-n100-r2::repeat-2`
- `v10-stress-batch-release-tight-n100-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r4::repeat-1`
- `v10-stress-batch-release-tight-n100-r4::repeat-2`
- `v10-stress-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### v10VsV5 · V10 동일 요금 계획 유지 / V5 유효 계획 유지

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 26 / 78 | 156,510,500.00 | 156,612,550.00 | -102,050.00 | -0.07% | 7/14/5 | 231,550.00 | 7 / 21 | [-0.8919465838, 0.3738398134] |
| incremental | 26 / 78 | 94,042,500.00 | 94,144,550.00 | -102,050.00 | -0.11% | 7/14/5 | 231,550.00 | 7 / 21 | [-1.377347012, 0.6338425076] |

完成增加/损失: 54 / 3 episodes. 情景平均完成率差: 0.236111; 95% CI [0.1388888889, 0.3472222222].
同一配对完成重复的改期合计: 4854 → 10002; n=78.

total: raw matched episode sums KRW 469,531,500.00 → 469,837,650.00; mean scenario saving KRW 95% CI [-35018.50962, 25294.90385]; bootstrap scenario n=26, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`
- `v10-stress-batch-release-tight-n50-r1`
- `v10-stress-batch-release-tight-n50-r4`
- `v10-stress-batch-release-tight-n100-r1`

**total / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`
- `v10-stress-batch-release-balanced-n100-r4::repeat-3`
- `v10-stress-batch-release-tight-n50-r1::repeat-1`
- `v10-stress-batch-release-tight-n50-r1::repeat-2`
- `v10-stress-batch-release-tight-n50-r1::repeat-3`
- `v10-stress-batch-release-tight-n50-r4::repeat-1`
- `v10-stress-batch-release-tight-n50-r4::repeat-2`
- `v10-stress-batch-release-tight-n50-r4::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

incremental: raw matched episode sums KRW 282,127,500.00 → 282,433,650.00; mean scenario saving KRW 95% CI [-35018.50962, 25294.90385]; bootstrap scenario n=26, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1`
- `v10-stress-batch-release-balanced-n100-r4`
- `v10-stress-batch-release-tight-n50-r1`
- `v10-stress-batch-release-tight-n50-r4`
- `v10-stress-batch-release-tight-n100-r1`

**incremental / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n24-r1::repeat-1`
- `v10-stress-batch-release-balanced-n24-r1::repeat-2`
- `v10-stress-batch-release-balanced-n24-r1::repeat-3`
- `v10-stress-batch-release-balanced-n100-r4::repeat-1`
- `v10-stress-batch-release-balanced-n100-r4::repeat-2`
- `v10-stress-batch-release-balanced-n100-r4::repeat-3`
- `v10-stress-batch-release-tight-n50-r1::repeat-1`
- `v10-stress-batch-release-tight-n50-r1::repeat-2`
- `v10-stress-batch-release-tight-n50-r1::repeat-3`
- `v10-stress-batch-release-tight-n50-r4::repeat-1`
- `v10-stress-batch-release-tight-n50-r4::repeat-2`
- `v10-stress-batch-release-tight-n50-r4::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r4::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r4::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r4::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r4::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r3::repeat-1`
- `v10-stress-batch-release-tight-n100-r3::repeat-2`
- `v10-stress-batch-release-tight-n100-r3::repeat-3`

**lostEpisodeIds — all retained**

- `v10-stress-batch-release-tight-n50-r2::repeat-1`
- `v10-stress-batch-release-tight-n50-r2::repeat-2`
- `v10-stress-batch-release-tight-n50-r2::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n24-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n50-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r1::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r4::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r4::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r4::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n50-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r4::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r4::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r4::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r3::repeat-1`
- `v10-stress-batch-release-tight-n100-r3::repeat-2`
- `v10-stress-batch-release-tight-n100-r3::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### highsVsV7 · 독립 native HiGHS / V7 비용 다듬기

| fee | scenario / repeat | baseline scenario-mean sum KRW | candidate scenario-mean sum KRW | savings KRW | savings % | lower/same/higher | worst increase KRW | zero baseline scenario/repeat | conditional 95% CI % |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 29 / 86 | 310,962,316.67 | 294,591,500.00 | 16,370,816.67 | 5.26% | 13/15/1 | 9,100.00 | 8 / 24 | [2.934802417, 7.745801663] |
| incremental | 29 / 86 | 184,893,716.67 | 168,522,900.00 | 16,370,816.67 | 8.85% | 13/15/1 | 9,100.00 | 8 / 24 | [4.955998979, 12.63684726] |

完成增加/损失: 34 / 21 episodes. 情景平均完成率差: 0.060185; 95% CI [-0.05555555556, 0.1805555556].
同一配对完成重复的改期合计: 7274 → 31677; n=86.

total: raw matched episode sums KRW 916,078,000.00 → 867,045,550.00; mean scenario saving KRW 95% CI [184547.4425, 1056658.362]; bootstrap scenario n=29, draws=2000.

**total / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n100-r1`

**total / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n100-r1::repeat-1`
- `v10-stress-batch-release-balanced-n100-r1::repeat-2`
- `v10-stress-batch-release-balanced-n100-r1::repeat-3`

incremental: raw matched episode sums KRW 544,791,400.00 → 495,758,950.00; mean scenario saving KRW 95% CI [184547.4425, 1056658.362]; bootstrap scenario n=29, draws=2000.

**incremental / negativeScenarioIds — all retained**

- `v10-stress-batch-release-balanced-n100-r1`

**incremental / negativeEpisodeIds — all retained**

- `v10-stress-batch-release-balanced-n100-r1::repeat-1`
- `v10-stress-batch-release-balanced-n100-r1::repeat-2`
- `v10-stress-batch-release-balanced-n100-r1::repeat-3`

**gainedEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**lostEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n100-r2::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r2::repeat-3`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-1`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-2`
- `v10-stress-aged-backlog-balanced-n100-r3::repeat-3`
- `v10-stress-batch-release-tight-n50-r2::repeat-1`
- `v10-stress-batch-release-tight-n50-r2::repeat-2`
- `v10-stress-batch-release-tight-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n50-r3::repeat-1`
- `v10-stress-batch-release-tight-n50-r3::repeat-2`
- `v10-stress-batch-release-tight-n50-r3::repeat-3`
- `v10-stress-batch-release-tight-n100-r2::repeat-1`
- `v10-stress-batch-release-tight-n100-r2::repeat-2`
- `v10-stress-batch-release-tight-n100-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r3::repeat-1`
- `v10-stress-batch-release-tight-n100-r3::repeat-2`
- `v10-stress-batch-release-tight-n100-r3::repeat-3`
- `v10-stress-batch-release-tight-n100-r4::repeat-1`
- `v10-stress-batch-release-tight-n100-r4::repeat-2`
- `v10-stress-batch-release-tight-n100-r4::repeat-3`

**gainedFromKnownFailureEpisodeIds — all retained**

- `v10-stress-aged-backlog-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n24-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n50-r3::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r2::repeat-3`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-1`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-2`
- `v10-stress-new-arrivals-balanced-n100-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n24-r3::repeat-3`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-1`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-2`
- `v10-stress-new-arrivals-tight-n100-r3::repeat-3`
- `v10-stress-batch-release-balanced-n24-r2::repeat-1`
- `v10-stress-batch-release-balanced-n24-r2::repeat-2`
- `v10-stress-batch-release-balanced-n24-r2::repeat-3`
- `v10-stress-batch-release-balanced-n50-r2::repeat-1`
- `v10-stress-batch-release-balanced-n50-r2::repeat-2`
- `v10-stress-batch-release-balanced-n50-r2::repeat-3`
- `v10-stress-batch-release-tight-n100-r1::repeat-1`
- `v10-stress-batch-release-tight-n100-r1::repeat-2`
- `v10-stress-batch-release-tight-n100-r1::repeat-3`

**gainedFromUnknownHistoryEpisodeIds — all retained**

none / 없음 / 无

#### 五方法共同完成集：独立费用/改期轴
 
jointScenarioCount=25; jointEpisodeCount=74. 先平均每情景共同重复，再将情景均值求和；改期均值轴与原始 episode 改期合计分开。无共同样本或未知改期为 null。

| method | total scenario-mean sum KRW | incremental scenario-mean sum KRW | revision scenario-mean sum | raw episode revisions | full-sample complete / all |
| --- | --- | --- | --- | --- | --- |
| stableRetainV5 | 153,615,000.00 | 91,410,900.00 | 1,326.000 | 3,919 | 81 / 216 |
| costPolishV7 | 159,157,533.33 | 96,953,433.33 | 1,492.667 | 4,419 | 107 / 216 |
| adaptiveV9 | 158,948,233.33 | 96,744,133.33 | 1,583.667 | 4,692 | 108 / 216 |
| highsV8 | 153,112,500.00 | 90,908,400.00 | 8,785.000 | 26,274 | 120 / 216 |
| stableHiGHSV10 | 153,492,750.00 | 91,288,650.00 | 3,083.000 | 9,186 | 132 / 216 |

```json
{
  "totalAndRevisions": [
    {
      "method": "stableRetainV5",
      "dominates": [
        "costPolishV7",
        "adaptiveV9"
      ],
      "dominatedBy": [],
      "pareto": true
    },
    {
      "method": "costPolishV7",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
      ],
      "pareto": false
    },
    {
      "method": "adaptiveV9",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
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
      "dominates": [],
      "dominatedBy": [],
      "pareto": true
    }
  ],
  "incrementalAndRevisions": [
    {
      "method": "stableRetainV5",
      "dominates": [
        "costPolishV7",
        "adaptiveV9"
      ],
      "dominatedBy": [],
      "pareto": true
    },
    {
      "method": "costPolishV7",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
      ],
      "pareto": false
    },
    {
      "method": "adaptiveV9",
      "dominates": [],
      "dominatedBy": [
        "stableRetainV5"
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
      "dominates": [],
      "dominatedBy": [],
      "pareto": true
    }
  ]
}
```

#### 预声明观察门槛

```json
{
  "candidateMethod": "stableHiGHSV10",
  "assessmentState": "complete-panel",
  "completionLossCountsByBaseline": {
    "highsV8": 3,
    "adaptiveV9": 12,
    "costPolishV7": 12,
    "stableRetainV5": 3
  },
  "completionNonRegressionAllBaselines": false,
  "defaultRecommendationEligible": false,
  "nativeComparison": {
    "lostEpisodeCount": 3,
    "revisionPairedEpisodeCount": 117,
    "revisionDelta": -28347,
    "strictRevisionReduction": true,
    "incrementalFeeClaim": "no_stable_advantage",
    "totalFeeClaim": "no_stable_advantage",
    "noRobustFeeDeterioration": true,
    "stabilityImprovementClaimAllowed": false
  },
  "scope": "Observed necessary gates only. Any full-sample completion loss against an old baseline prevents default eligibility. A fee interval containing zero gives no stable fee advantage; stability is conditional on the exact native paired set. No production or universal non-regression claim."
}
```

## 原始证据、复现与独立选择复核

| evidence input | SHA-256 |
| --- | --- |
| data/v10-results.json | 79a12024d00ab7a47e2834bcf42644901cfa49c1600e463494fb453e7f7ccfc9 |
| data/evidence-v10/v10-frozen-first/first-run/complete.json | 33d07f60afb4b4248682badc631512a54070cca22fd106c7dd5062d4669bf9c2 |
| data/protocol-v10.json | fa5c6d49f43f0bf79b1905ae445300396469a985134296e1bfff94bd544414ad |
| data/review-v10.json | def9cd2920b9976a02d2e495903a3b001369eea4f039d7216325878a81fd634d |
| data/bootstrap-review-v10.json | a55a55cf7d36a14eccbbb4b34162b8413bc4893d8d006d7b875b0ee9a30a3648 |
| data/v9-results.json | fe021614be03707bde070e499f7d626170f48add832bffe1ac38de1987399d1c |
| data/evidence-v9/v9-frozen-first/first-run/complete.json | 83d165a965e421af0ebc0b399f426eab3ae48eddc4a564374a6074f9edad7204 |
| data/review-v9.json | 7716e885b7ea673bba6e552b1e6c52f3137cad4157058b8d59696175f10c6c50 |
| data/championship-acceptance-v10.json | 98075e70e805b941ec8924f2008fc6d5721f4c0c43c9a9c4a76f6b65ed3b39a4 |
| data/v10-loss-diagnosis.json | 22f148545608fa82af15a360e30fa7a135bfcd3cebb864330ed5a0647eff82c3 |

```json
{
  "calls": 4236,
  "cacheAcceptedCalls": 2973,
  "nativeAcceptedCalls": 1119,
  "retainedCacheCalls": 2973,
  "completeNativeProposals": 4110,
  "strictReplacements": 0,
  "feeTiesRetained": 2961
}
```

```bash
python scripts/restore-evidence-v10.py
python scripts/review-v10.py --run data/evidence-v10/v10-frozen-first/first-run --output artifacts/review-v10-reproduction.json
python scripts/review-bootstrap-v10.py --run data/evidence-v10/v10-frozen-first/first-run --output artifacts/bootstrap-v10-reproduction.json
python scripts/build-defense-v10.py --require-results --bootstrap-review data/bootstrap-review-v10.json
```

Native HiGHS 연구 기준은 브라우저 GLPK 실행과 별도입니다. / Native HiGHS 研究基准与浏览器 GLPK 分开。
首次结果不可覆盖；新复现写入新路径。现场验收和本人答辩记录保持空白，不替用户填写通过。

