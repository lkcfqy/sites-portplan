# PortPlan V14 正式研究：现有 V13 守卫策略的自然 D0 检验

这是既有 guardedHiGHSV13 的新研究批次，不是新 V14 排程算法。144 个新合成业务场景、两个独立报告面板、三次时钟重复、七方法共 3024 条；开发端点、旧前缀和旧样本不进入正式分母。

200ms 是构造、原生、审计和评分共享的合作预算。冷父时钟 5 秒包括启动、正常退出、ESRCH 进程组清理与最终父审核。及时 final 不足以接纳完整历史。未接纳或缺失历史保持 unknown/null，失败费用不填零。

默认观察资格仅为完整面板且对六个基线逐个零完成损失；净收益、费用、Pareto 不抵消损失。费用/改期的原生稳定性主张另列，不是默认完成门槛的一部分。

主比较六组、次比较八组事先固定。配对费用用该对照共同完成的匹配重复，先场景内平均再场景等权聚合，两个费用分子分母均披露。配对改期为同一共同完成集合中改期已知的匹配 episode 原始事件总数，另报自身已知条数分母；原生稳定性主张要求全部匹配条数的改期已知。只有七方法 Pareto 的改期轴采用场景内均值再等权聚合。时钟重复不作为独立 CI 样本。bootstrap 固定 seed800001、2000 次场景簇抽样；区间未经多重比较校正，是描述性边际区间，不证明同时优越；共同完成条件不消除选择偏差。全负节省区间为条件费用恶化，含零不证明稳定省费。

M 来自当天公开快照与实际锁，是明日必要仓承诺的代理量，不预测未公告事件，不保证未来可恢复。自然全路径与已见强制前缀开发分别保留；不同初始物理路径的成功不证明同前缀恢复。

公开费率、公开观测、数学基准与合成数据各自标注范围。企业订单、报价、联系人及试点为可选增强，不是本路线前提。不能据此声称企业采纳、实际收益或冠军。V1–V13 历史证据不改写。

同分布 · 新订单观察默认资格：True；各基线完成损失 {"seededHiGHSV12": 0, "commitmentHiGHSV11": 0, "stableHiGHSV10": 0, "adaptiveV9": 0, "highsV8": 0, "costPolishV7": 0}

压力扰动 · 新订单观察默认资格：False；各基线完成损失 {"seededHiGHSV12": 5, "commitmentHiGHSV11": 4, "stableHiGHSV10": 4, "adaptiveV9": 0, "highsV8": 4, "costPolishV7": 0}

## 同分布 · 新订单

| method | complete | recorded | D0 accepted | D0 failed | later failed | D0 unknown |
| --- | --- | --- | --- | --- | --- | --- |
| costPolishV7 | 137 | 216 | 183 | 33 | 46 | 0 |
| adaptiveV9 | 137 | 216 | 183 | 33 | 46 | 0 |
| highsV8 | 150 | 216 | 171 | 45 | 21 | 0 |
| stableHiGHSV10 | 150 | 216 | 171 | 45 | 21 | 0 |
| commitmentHiGHSV11 | 153 | 216 | 171 | 45 | 18 | 0 |
| seededHiGHSV12 | 171 | 216 | 189 | 27 | 18 | 0 |
| guardedHiGHSV13 | 171 | 216 | 189 | 27 | 18 | 0 |

### v13VsV12 [primary]
seededHiGHSV12 → guardedHiGHSV13
Completion gained/lost: 0/0; scenario rate gain 95% CI [0, 0]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 57 | 171 | 445,287,300.000000 | 461,907,750.000000 | -3.73% | [-7.796352452, -0.8259993702] | [-614679.6053, -51981.95175] | 1,335,861,900 | 1,385,723,250 | {'win': 0, 'tie': 36, 'loss': 21} | 8,033,100 |
| incremental | 57 | 171 | 250,769,850.000000 | 267,390,300.000000 | -6.63% | [-13.5605046, -1.46342098] | [-614679.6053, -51981.95175] | 752,309,550 | 802,170,900 | {'win': 0, 'tie': 36, 'loss': 21} | 8,033,100 |
Revisions on this exact pair: 18257 → 21691; known matching episodes=171

### v13VsV11 [primary]
commitmentHiGHSV11 → guardedHiGHSV13
Completion gained/lost: 18/0; scenario rate gain 95% CI [0.02777777778, 0.1527777778]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 51 | 153 | 441,153,200.000000 | 455,154,650.000000 | -3.17% | [-7.030270558, -0.5766484548] | [-664408.3578, -44678.01471] | 1,323,459,600 | 1,365,463,950 | {'win': 0, 'tie': 33, 'loss': 18} | 8,033,100 |
| incremental | 51 | 153 | 247,027,050.000000 | 261,028,500.000000 | -5.67% | [-12.43347923, -1.037241029] | [-664408.3578, -44678.01471] | 741,081,150 | 783,085,500 | {'win': 0, 'tie': 33, 'loss': 18} | 8,033,100 |
Revisions on this exact pair: 13593 → 16861; known matching episodes=153

### v13VsV10 [primary]
stableHiGHSV10 → guardedHiGHSV13
Completion gained/lost: 21/0; scenario rate gain 95% CI [0.04166666667, 0.1666666667]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 50 | 150 | 427,677,550.000000 | 441,724,000.000000 | -3.28% | [-7.158129707, -0.6079120325] | [-651312.25, -44146.175] | 1,283,032,650 | 1,325,172,000 | {'win': 1, 'tie': 30, 'loss': 19} | 8,053,100 |
| incremental | 50 | 150 | 239,997,800.000000 | 254,044,250.000000 | -5.85% | [-12.50526724, -1.090156562] | [-651312.25, -44146.175] | 719,993,400 | 762,132,750 | {'win': 1, 'tie': 30, 'loss': 19} | 8,053,100 |
Revisions on this exact pair: 10710 → 16735; known matching episodes=150

### v13VsV9 [primary]
adaptiveV9 → guardedHiGHSV13
Completion gained/lost: 34/0; scenario rate gain 95% CI [0.0787037037, 0.2408564815]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 46 | 137 | 422,812,200.000000 | 414,035,750.000000 | 2.08% | [-2.661051881, 6.044355157] | [-217010.2264, 614617.7536] | 1,267,499,300 | 1,241,097,150 | {'win': 13, 'tie': 19, 'loss': 14} | 4,959,567 |
| incremental | 46 | 137 | 247,080,550.000000 | 238,304,100.000000 | 3.55% | [-4.566374148, 10.2492458] | [-217010.2264, 614617.7536] | 740,368,050 | 713,965,900 | {'win': 13, 'tie': 19, 'loss': 14} | 4,959,567 |
Revisions on this exact pair: 6289 → 17371; known matching episodes=137

### v13VsHiGHS [primary]
highsV8 → guardedHiGHSV13
Completion gained/lost: 21/0; scenario rate gain 95% CI [0.02777777778, 0.1666666667]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 50 | 150 | 440,942,200.000000 | 455,081,850.000000 | -3.21% | [-7.141506195, -0.6391233812] | [-663354.9, -48872.45] | 1,322,826,600 | 1,365,245,550 | {'win': 1, 'tie': 27, 'loss': 22} | 8,033,100 |
| incremental | 50 | 150 | 246,816,050.000000 | 260,955,700.000000 | -5.73% | [-12.77822035, -1.153681777] | [-663354.9, -48872.45] | 740,448,150 | 782,867,100 | {'win': 1, 'tie': 27, 'loss': 22} | 8,033,100 |
Revisions on this exact pair: 47073 → 15982; known matching episodes=150

### v13VsV7 [primary]
costPolishV7 → guardedHiGHSV13
Completion gained/lost: 34/0; scenario rate gain 95% CI [0.0787037037, 0.2408564815]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 46 | 137 | 423,685,200.000000 | 414,035,750.000000 | 2.28% | [-2.169797095, 6.072776554] | [-169531.2862, 612679.6649] | 1,270,118,300 | 1,241,097,150 | {'win': 13, 'tie': 19, 'loss': 14} | 4,128,867 |
| incremental | 46 | 137 | 247,953,550.000000 | 238,304,100.000000 | 3.89% | [-3.693665808, 10.34734249] | [-169531.2862, 612679.6649] | 742,987,050 | 713,965,900 | {'win': 13, 'tie': 19, 'loss': 14} | 4,128,867 |
Revisions on this exact pair: 6206 → 17371; known matching episodes=137

### v12VsV11 [secondary]
commitmentHiGHSV11 → seededHiGHSV12
Completion gained/lost: 18/0; scenario rate gain 95% CI [0.02777777778, 0.1527777778]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 51 | 153 | 441,153,200.000000 | 441,153,200.000000 | 0.00% | [0, 0] | [0, 0] | 1,323,459,600 | 1,323,459,600 | {'win': 0, 'tie': 51, 'loss': 0} | 0 |
| incremental | 51 | 153 | 247,027,050.000000 | 247,027,050.000000 | 0.00% | [0, 0] | [0, 0] | 741,081,150 | 741,081,150 | {'win': 0, 'tie': 51, 'loss': 0} | 0 |
Revisions on this exact pair: 13593 → 12798; known matching episodes=153

### v12VsV10 [secondary]
stableHiGHSV10 → seededHiGHSV12
Completion gained/lost: 21/0; scenario rate gain 95% CI [0.04166666667, 0.1666666667]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 50 | 150 | 427,677,550.000000 | 427,722,550.000000 | -0.01% | [-0.03301910504, 0.01270533024] | [-3100, 800] | 1,283,032,650 | 1,283,167,650 | {'win': 1, 'tie': 47, 'loss': 2} | 45,000 |
| incremental | 50 | 150 | 239,997,800.000000 | 240,042,800.000000 | -0.02% | [-0.060916343, 0.0223321391] | [-3100, 800] | 719,993,400 | 720,128,400 | {'win': 1, 'tie': 47, 'loss': 2} | 45,000 |
Revisions on this exact pair: 10710 → 12672; known matching episodes=150

### v12VsV9 [secondary]
adaptiveV9 → seededHiGHSV12
Completion gained/lost: 34/0; scenario rate gain 95% CI [0.0787037037, 0.2408564815]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 46 | 137 | 422,812,200.000000 | 397,433,500.000000 | 6.00% | [3.99475268, 8.322104364] | [247139.1667, 895271.5399] | 1,267,499,300 | 1,191,390,500 | {'win': 24, 'tie': 21, 'loss': 1} | 18,200 |
| incremental | 46 | 137 | 247,080,550.000000 | 221,701,850.000000 | 10.27% | [6.794930404, 13.74249929] | [247139.1667, 895271.5399] | 740,368,050 | 664,259,250 | {'win': 24, 'tie': 21, 'loss': 1} | 18,200 |
Revisions on this exact pair: 6289 → 14303; known matching episodes=137

### v12VsHiGHS [secondary]
highsV8 → seededHiGHSV12
Completion gained/lost: 21/0; scenario rate gain 95% CI [0.02777777778, 0.1666666667]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 50 | 150 | 440,942,200.000000 | 441,153,200.000000 | -0.05% | [-0.08551470253, -0.01417912224] | [-7712.25, -1028] | 1,322,826,600 | 1,323,459,600 | {'win': 1, 'tie': 40, 'loss': 9} | 60,000 |
| incremental | 50 | 150 | 246,816,050.000000 | 247,027,050.000000 | -0.09% | [-0.1502806853, -0.02515083519] | [-7712.25, -1028] | 740,448,150 | 741,081,150 | {'win': 1, 'tie': 40, 'loss': 9} | 60,000 |
Revisions on this exact pair: 47073 → 12006; known matching episodes=150

### v12VsV7 [secondary]
costPolishV7 → seededHiGHSV12
Completion gained/lost: 34/0; scenario rate gain 95% CI [0.0787037037, 0.2408564815]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 46 | 137 | 423,685,200.000000 | 397,433,500.000000 | 6.20% | [4.120301133, 8.598397492] | [259277.1014, 929048.2246] | 1,270,118,300 | 1,191,390,500 | {'win': 24, 'tie': 21, 'loss': 1} | 18,200 |
| incremental | 46 | 137 | 247,953,550.000000 | 221,701,850.000000 | 10.59% | [6.9932823, 14.05270971] | [259277.1014, 929048.2246] | 742,987,050 | 664,259,250 | {'win': 24, 'tie': 21, 'loss': 1} | 18,200 |
Revisions on this exact pair: 6206 → 14303; known matching episodes=137

### v11VsV10 [secondary]
stableHiGHSV10 → commitmentHiGHSV11
Completion gained/lost: 3/0; scenario rate gain 95% CI [0, 0.04166666667]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 50 | 150 | 427,677,550.000000 | 427,722,550.000000 | -0.01% | [-0.03301910504, 0.01270533024] | [-3100, 800] | 1,283,032,650 | 1,283,167,650 | {'win': 1, 'tie': 47, 'loss': 2} | 45,000 |
| incremental | 50 | 150 | 239,997,800.000000 | 240,042,800.000000 | -0.02% | [-0.060916343, 0.0223321391] | [-3100, 800] | 719,993,400 | 720,128,400 | {'win': 1, 'tie': 47, 'loss': 2} | 45,000 |
Revisions on this exact pair: 10710 → 13467; known matching episodes=150

### v10VsHiGHS [secondary]
highsV8 → stableHiGHSV10
Completion gained/lost: 3/3; scenario rate gain 95% CI [-0.04166666667, 0.04166666667]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 49 | 147 | 427,511,550.000000 | 427,677,550.000000 | -0.04% | [-0.08639851411, -0.005637705489] | [-6757.142857, -436.7346939] | 1,282,534,650 | 1,283,032,650 | {'win': 2, 'tie': 38, 'loss': 9} | 50,000 |
| incremental | 49 | 147 | 239,831,800.000000 | 239,997,800.000000 | -0.07% | [-0.1512580158, -0.009943647791] | [-6757.142857, -436.7346939] | 719,495,400 | 719,993,400 | {'win': 2, 'tie': 38, 'loss': 9} | 50,000 |
Revisions on this exact pair: 46914 → 9918; known matching episodes=147

### highsVsV7 [secondary]
costPolishV7 → highsV8
Completion gained/lost: 28/15; scenario rate gain 95% CI [-0.04166666667, 0.162037037]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 41 | 122 | 417,091,866.666667 | 393,118,400.000000 | 5.75% | [3.67566256, 7.744825549] | [234381.5854, 997509.3394] | 1,250,338,300 | 1,178,445,200 | {'win': 21, 'tie': 20, 'loss': 0} | 0 |
| incremental | 41 | 122 | 241,751,516.666667 | 217,778,050.000000 | 9.92% | [6.32906549, 13.05277603] | [234381.5854, 997509.3394] | 724,380,950 | 652,487,850 | {'win': 21, 'tie': 20, 'loss': 0} | 0 |
Revisions on this exact pair: 4387 → 38956; known matching episodes=122

### All-seven common-complete subset / observed necessary gates

```json
{
  "jointCompletePareto": {
    "jointScenarioCount": 41,
    "jointEpisodeCount": 122,
    "eligibility": "all-seven-matching-complete-repeats",
    "byMethod": {
      "costPolishV7": {
        "scenarioCount": 41,
        "jointEpisodeCount": 122,
        "scenarioMeanTotalCostSumKRW": 417091866.6666667,
        "scenarioMeanIncrementalCostSumKRW": 241751516.66666666,
        "scenarioMeanRevisionCountSum": 1486.1666666666665,
        "episodeTotalCostSumKRW": 1250338300,
        "episodeIncrementalCostSumKRW": 724380950,
        "episodeRevisionCountSum": 4387,
        "knownRevisionEpisodeCount": 122,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 137,
        "fullSampleEpisodeCount": 216
      },
      "adaptiveV9": {
        "scenarioCount": 41,
        "jointEpisodeCount": 122,
        "scenarioMeanTotalCostSumKRW": 416303800.00000006,
        "scenarioMeanIncrementalCostSumKRW": 240963449.99999997,
        "scenarioMeanRevisionCountSum": 1506.6666666666665,
        "episodeTotalCostSumKRW": 1247974100,
        "episodeIncrementalCostSumKRW": 722016750,
        "episodeRevisionCountSum": 4450,
        "knownRevisionEpisodeCount": 122,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 137,
        "fullSampleEpisodeCount": 216
      },
      "highsV8": {
        "scenarioCount": 41,
        "jointEpisodeCount": 122,
        "scenarioMeanTotalCostSumKRW": 393118400,
        "scenarioMeanIncrementalCostSumKRW": 217778050,
        "scenarioMeanRevisionCountSum": 13108,
        "episodeTotalCostSumKRW": 1178445200,
        "episodeIncrementalCostSumKRW": 652487850,
        "episodeRevisionCountSum": 38956,
        "knownRevisionEpisodeCount": 122,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 150,
        "fullSampleEpisodeCount": 216
      },
      "stableHiGHSV10": {
        "scenarioCount": 41,
        "jointEpisodeCount": 122,
        "scenarioMeanTotalCostSumKRW": 393254400,
        "scenarioMeanIncrementalCostSumKRW": 217914050,
        "scenarioMeanRevisionCountSum": 2736,
        "episodeTotalCostSumKRW": 1178853200,
        "episodeIncrementalCostSumKRW": 652895850,
        "episodeRevisionCountSum": 8130,
        "knownRevisionEpisodeCount": 122,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 150,
        "fullSampleEpisodeCount": 216
      },
      "commitmentHiGHSV11": {
        "scenarioCount": 41,
        "jointEpisodeCount": 122,
        "scenarioMeanTotalCostSumKRW": 393299400,
        "scenarioMeanIncrementalCostSumKRW": 217959050,
        "scenarioMeanRevisionCountSum": 3470,
        "episodeTotalCostSumKRW": 1178988200,
        "episodeIncrementalCostSumKRW": 653030850,
        "episodeRevisionCountSum": 10332,
        "knownRevisionEpisodeCount": 122,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 153,
        "fullSampleEpisodeCount": 216
      },
      "seededHiGHSV12": {
        "scenarioCount": 41,
        "jointEpisodeCount": 122,
        "scenarioMeanTotalCostSumKRW": 393299400,
        "scenarioMeanIncrementalCostSumKRW": 217959050,
        "scenarioMeanRevisionCountSum": 3242,
        "episodeTotalCostSumKRW": 1178988200,
        "episodeIncrementalCostSumKRW": 653030850,
        "episodeRevisionCountSum": 9648,
        "knownRevisionEpisodeCount": 122,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 171,
        "fullSampleEpisodeCount": 216
      },
      "guardedHiGHSV13": {
        "scenarioCount": 41,
        "jointEpisodeCount": 122,
        "scenarioMeanTotalCostSumKRW": 407209850,
        "scenarioMeanIncrementalCostSumKRW": 231869500,
        "scenarioMeanRevisionCountSum": 4507.333333333333,
        "episodeTotalCostSumKRW": 1220619450,
        "episodeIncrementalCostSumKRW": 694662100,
        "episodeRevisionCountSum": 13288,
        "knownRevisionEpisodeCount": 122,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 171,
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
          "dominates": [
            "commitmentHiGHSV11",
            "seededHiGHSV12",
            "guardedHiGHSV13"
          ],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "commitmentHiGHSV11",
          "dominates": [
            "guardedHiGHSV13"
          ],
          "dominatedBy": [
            "stableHiGHSV10",
            "seededHiGHSV12"
          ],
          "pareto": false
        },
        {
          "method": "seededHiGHSV12",
          "dominates": [
            "commitmentHiGHSV11",
            "guardedHiGHSV13"
          ],
          "dominatedBy": [
            "stableHiGHSV10"
          ],
          "pareto": false
        },
        {
          "method": "guardedHiGHSV13",
          "dominates": [],
          "dominatedBy": [
            "stableHiGHSV10",
            "commitmentHiGHSV11",
            "seededHiGHSV12"
          ],
          "pareto": false
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
          "dominates": [
            "commitmentHiGHSV11",
            "seededHiGHSV12",
            "guardedHiGHSV13"
          ],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "commitmentHiGHSV11",
          "dominates": [
            "guardedHiGHSV13"
          ],
          "dominatedBy": [
            "stableHiGHSV10",
            "seededHiGHSV12"
          ],
          "pareto": false
        },
        {
          "method": "seededHiGHSV12",
          "dominates": [
            "commitmentHiGHSV11",
            "guardedHiGHSV13"
          ],
          "dominatedBy": [
            "stableHiGHSV10"
          ],
          "pareto": false
        },
        {
          "method": "guardedHiGHSV13",
          "dominates": [],
          "dominatedBy": [
            "stableHiGHSV10",
            "commitmentHiGHSV11",
            "seededHiGHSV12"
          ],
          "pareto": false
        }
      ]
    },
    "scenarios": [
      {
        "scenarioId": "v14-same-distribution-aged-backlog-balanced-n24-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 16234900,
            "incrementalCost": 8786650,
            "revisionCount": 46
          },
          "adaptiveV9": {
            "totalCost": 16234900,
            "incrementalCost": 8786650,
            "revisionCount": 46
          },
          "highsV8": {
            "totalCost": 16234900,
            "incrementalCost": 8786650,
            "revisionCount": 73
          },
          "stableHiGHSV10": {
            "totalCost": 16234900,
            "incrementalCost": 8786650,
            "revisionCount": 42
          },
          "commitmentHiGHSV11": {
            "totalCost": 16234900,
            "incrementalCost": 8786650,
            "revisionCount": 42
          },
          "seededHiGHSV12": {
            "totalCost": 16234900,
            "incrementalCost": 8786650,
            "revisionCount": 42
          },
          "guardedHiGHSV13": {
            "totalCost": 16234900,
            "incrementalCost": 8786650,
            "revisionCount": 42
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-aged-backlog-balanced-n24-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 10681550,
            "incrementalCost": 6450000,
            "revisionCount": 13
          },
          "adaptiveV9": {
            "totalCost": 10681550,
            "incrementalCost": 6450000,
            "revisionCount": 13
          },
          "highsV8": {
            "totalCost": 10666550,
            "incrementalCost": 6435000,
            "revisionCount": 36
          },
          "stableHiGHSV10": {
            "totalCost": 10666550,
            "incrementalCost": 6435000,
            "revisionCount": 17
          },
          "commitmentHiGHSV11": {
            "totalCost": 10666550,
            "incrementalCost": 6435000,
            "revisionCount": 17
          },
          "seededHiGHSV12": {
            "totalCost": 10666550,
            "incrementalCost": 6435000,
            "revisionCount": 17
          },
          "guardedHiGHSV13": {
            "totalCost": 10742100,
            "incrementalCost": 6510550,
            "revisionCount": 59
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-aged-backlog-balanced-n24-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 11513950,
            "incrementalCost": 6113400,
            "revisionCount": 3
          },
          "adaptiveV9": {
            "totalCost": 11513950,
            "incrementalCost": 6113400,
            "revisionCount": 3
          },
          "highsV8": {
            "totalCost": 11513950,
            "incrementalCost": 6113400,
            "revisionCount": 24
          },
          "stableHiGHSV10": {
            "totalCost": 11513950,
            "incrementalCost": 6113400,
            "revisionCount": 3
          },
          "commitmentHiGHSV11": {
            "totalCost": 11513950,
            "incrementalCost": 6113400,
            "revisionCount": 3
          },
          "seededHiGHSV12": {
            "totalCost": 11513950,
            "incrementalCost": 6113400,
            "revisionCount": 3
          },
          "guardedHiGHSV13": {
            "totalCost": 11513950,
            "incrementalCost": 6113400,
            "revisionCount": 3
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-aged-backlog-balanced-n50-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 34672833.333333336,
            "incrementalCost": 21215583.333333332,
            "revisionCount": 123.33333333333333
          },
          "adaptiveV9": {
            "totalCost": 34672833.333333336,
            "incrementalCost": 21215583.333333332,
            "revisionCount": 123.33333333333333
          },
          "highsV8": {
            "totalCost": 34377150,
            "incrementalCost": 20919900,
            "revisionCount": 151
          },
          "stableHiGHSV10": {
            "totalCost": 34377150,
            "incrementalCost": 20919900,
            "revisionCount": 74
          },
          "commitmentHiGHSV11": {
            "totalCost": 34377150,
            "incrementalCost": 20919900,
            "revisionCount": 74
          },
          "seededHiGHSV12": {
            "totalCost": 34377150,
            "incrementalCost": 20919900,
            "revisionCount": 74
          },
          "guardedHiGHSV13": {
            "totalCost": 34911450,
            "incrementalCost": 21454200,
            "revisionCount": 180
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-aged-backlog-balanced-n50-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 29229700,
            "incrementalCost": 15973600,
            "revisionCount": 76
          },
          "adaptiveV9": {
            "totalCost": 29229700,
            "incrementalCost": 15973600,
            "revisionCount": 76
          },
          "highsV8": {
            "totalCost": 29018200,
            "incrementalCost": 15762100,
            "revisionCount": 164
          },
          "stableHiGHSV10": {
            "totalCost": 29033200,
            "incrementalCost": 15777100,
            "revisionCount": 67
          },
          "commitmentHiGHSV11": {
            "totalCost": 29033200,
            "incrementalCost": 15777100,
            "revisionCount": 83
          },
          "seededHiGHSV12": {
            "totalCost": 29033200,
            "incrementalCost": 15777100,
            "revisionCount": 83
          },
          "guardedHiGHSV13": {
            "totalCost": 31974600,
            "incrementalCost": 18718500,
            "revisionCount": 93
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-aged-backlog-balanced-n50-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 29726150,
            "incrementalCost": 16248400,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 29726150,
            "incrementalCost": 16248400,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 28870600,
            "incrementalCost": 15392850,
            "revisionCount": 132
          },
          "stableHiGHSV10": {
            "totalCost": 28870600,
            "incrementalCost": 15392850,
            "revisionCount": 41
          },
          "commitmentHiGHSV11": {
            "totalCost": 28870600,
            "incrementalCost": 15392850,
            "revisionCount": 41
          },
          "seededHiGHSV12": {
            "totalCost": 28870600,
            "incrementalCost": 15392850,
            "revisionCount": 41
          },
          "guardedHiGHSV13": {
            "totalCost": 29213000,
            "incrementalCost": 15735250,
            "revisionCount": 172
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-aged-backlog-balanced-n50-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 24510000,
            "incrementalCost": 13732950,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 24510000,
            "incrementalCost": 13732950,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 23670800,
            "incrementalCost": 12893750,
            "revisionCount": 49
          },
          "stableHiGHSV10": {
            "totalCost": 23670800,
            "incrementalCost": 12893750,
            "revisionCount": 3
          },
          "commitmentHiGHSV11": {
            "totalCost": 23670800,
            "incrementalCost": 12893750,
            "revisionCount": 3
          },
          "seededHiGHSV12": {
            "totalCost": 23670800,
            "incrementalCost": 12893750,
            "revisionCount": 3
          },
          "guardedHiGHSV13": {
            "totalCost": 23689900,
            "incrementalCost": 12912850,
            "revisionCount": 83
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-aged-backlog-balanced-n100-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 59036533.333333336,
            "incrementalCost": 34193733.333333336,
            "revisionCount": 263.3333333333333
          },
          "adaptiveV9": {
            "totalCost": 58205833.333333336,
            "incrementalCost": 33363033.333333332,
            "revisionCount": 263.3333333333333
          },
          "highsV8": {
            "totalCost": 55132300,
            "incrementalCost": 30289500,
            "revisionCount": 239
          },
          "stableHiGHSV10": {
            "totalCost": 55112300,
            "incrementalCost": 30269500,
            "revisionCount": 153
          },
          "commitmentHiGHSV11": {
            "totalCost": 55132300,
            "incrementalCost": 30289500,
            "revisionCount": 169
          },
          "seededHiGHSV12": {
            "totalCost": 55132300,
            "incrementalCost": 30289500,
            "revisionCount": 169
          },
          "guardedHiGHSV13": {
            "totalCost": 63165400,
            "incrementalCost": 38322600,
            "revisionCount": 348
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-aged-backlog-balanced-n100-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 55899450,
            "incrementalCost": 32339300,
            "revisionCount": 231
          },
          "adaptiveV9": {
            "totalCost": 55899450,
            "incrementalCost": 32339300,
            "revisionCount": 231
          },
          "highsV8": {
            "totalCost": 51488050,
            "incrementalCost": 27927900,
            "revisionCount": 279
          },
          "stableHiGHSV10": {
            "totalCost": 51538050,
            "incrementalCost": 27977900,
            "revisionCount": 130
          },
          "commitmentHiGHSV11": {
            "totalCost": 51518050,
            "incrementalCost": 27957900,
            "revisionCount": 176
          },
          "seededHiGHSV12": {
            "totalCost": 51518050,
            "incrementalCost": 27957900,
            "revisionCount": 176
          },
          "guardedHiGHSV13": {
            "totalCost": 51518050,
            "incrementalCost": 27957900,
            "revisionCount": 176
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-aged-backlog-balanced-n100-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 68328816.66666667,
            "incrementalCost": 35611816.666666664,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 68706416.66666667,
            "incrementalCost": 35989416.666666664,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 64300800,
            "incrementalCost": 31583800,
            "revisionCount": 176
          },
          "stableHiGHSV10": {
            "totalCost": 64315800,
            "incrementalCost": 31598800,
            "revisionCount": 70
          },
          "commitmentHiGHSV11": {
            "totalCost": 64360800,
            "incrementalCost": 31643800,
            "revisionCount": 117
          },
          "seededHiGHSV12": {
            "totalCost": 64360800,
            "incrementalCost": 31643800,
            "revisionCount": 117
          },
          "guardedHiGHSV13": {
            "totalCost": 64360800,
            "incrementalCost": 31643800,
            "revisionCount": 117
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-aged-backlog-balanced-n100-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 56443183.333333336,
            "incrementalCost": 32063983.333333332,
            "revisionCount": 10
          },
          "adaptiveV9": {
            "totalCost": 56348016.666666664,
            "incrementalCost": 31968816.666666668,
            "revisionCount": 10
          },
          "highsV8": {
            "totalCost": 51639000,
            "incrementalCost": 27259800,
            "revisionCount": 222
          },
          "stableHiGHSV10": {
            "totalCost": 51639000,
            "incrementalCost": 27259800,
            "revisionCount": 14
          },
          "commitmentHiGHSV11": {
            "totalCost": 51639000,
            "incrementalCost": 27259800,
            "revisionCount": 14
          },
          "seededHiGHSV12": {
            "totalCost": 51639000,
            "incrementalCost": 27259800,
            "revisionCount": 14
          },
          "guardedHiGHSV13": {
            "totalCost": 51657200,
            "incrementalCost": 27278000,
            "revisionCount": 161.33333333333334
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-new-arrivals-balanced-n24-r1",
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
            "revisionCount": 170
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 18
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 70
          },
          "guardedHiGHSV13": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 70
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-new-arrivals-balanced-n24-r3",
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
            "revisionCount": 187
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 26
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 26
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 17
          },
          "guardedHiGHSV13": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 17
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-new-arrivals-balanced-n24-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 7
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 7
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 201
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 41
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 41
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 19
          },
          "guardedHiGHSV13": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 19
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-new-arrivals-balanced-n50-r1",
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
            "revisionCount": 373
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 46
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 46
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 15
          },
          "guardedHiGHSV13": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 15
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-new-arrivals-balanced-n50-r3",
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
            "revisionCount": 249
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 38
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 38
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          },
          "guardedHiGHSV13": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 0
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-new-arrivals-balanced-n50-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 52
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 52
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 420
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 94
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 94
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 33
          },
          "guardedHiGHSV13": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 33
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-new-arrivals-balanced-n100-r1",
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
            "revisionCount": 787
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 101
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 101
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 105
          },
          "guardedHiGHSV13": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 105
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-new-arrivals-balanced-n100-r2",
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
            "revisionCount": 838
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 229
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 229
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 299
          },
          "guardedHiGHSV13": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 299
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-new-arrivals-balanced-n100-r3",
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
            "revisionCount": 677
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 188
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 248
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 261
          },
          "guardedHiGHSV13": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 261
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-new-arrivals-balanced-n100-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 39
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 39
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 814
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 161
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 300
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 94
          },
          "guardedHiGHSV13": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 94
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-new-arrivals-tight-n24-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 9100,
            "incrementalCost": 9100,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 9100,
            "incrementalCost": 9100,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 9100,
            "incrementalCost": 9100,
            "revisionCount": 239
          },
          "stableHiGHSV10": {
            "totalCost": 27300,
            "incrementalCost": 27300,
            "revisionCount": 32
          },
          "commitmentHiGHSV11": {
            "totalCost": 27300,
            "incrementalCost": 27300,
            "revisionCount": 54
          },
          "seededHiGHSV12": {
            "totalCost": 27300,
            "incrementalCost": 27300,
            "revisionCount": 54
          },
          "guardedHiGHSV13": {
            "totalCost": 27300,
            "incrementalCost": 27300,
            "revisionCount": 54
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-balanced-n24-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 336700,
            "incrementalCost": 291200,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 336700,
            "incrementalCost": 291200,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 336700,
            "incrementalCost": 291200,
            "revisionCount": 100
          },
          "stableHiGHSV10": {
            "totalCost": 336700,
            "incrementalCost": 291200,
            "revisionCount": 0
          },
          "commitmentHiGHSV11": {
            "totalCost": 336700,
            "incrementalCost": 291200,
            "revisionCount": 0
          },
          "seededHiGHSV12": {
            "totalCost": 336700,
            "incrementalCost": 291200,
            "revisionCount": 0
          },
          "guardedHiGHSV13": {
            "totalCost": 336700,
            "incrementalCost": 291200,
            "revisionCount": 0
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-balanced-n24-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 227500,
            "incrementalCost": 218400,
            "revisionCount": 5
          },
          "adaptiveV9": {
            "totalCost": 227500,
            "incrementalCost": 218400,
            "revisionCount": 5
          },
          "highsV8": {
            "totalCost": 227500,
            "incrementalCost": 218400,
            "revisionCount": 127
          },
          "stableHiGHSV10": {
            "totalCost": 227500,
            "incrementalCost": 218400,
            "revisionCount": 20
          },
          "commitmentHiGHSV11": {
            "totalCost": 227500,
            "incrementalCost": 218400,
            "revisionCount": 21
          },
          "seededHiGHSV12": {
            "totalCost": 227500,
            "incrementalCost": 218400,
            "revisionCount": 21
          },
          "guardedHiGHSV13": {
            "totalCost": 227500,
            "incrementalCost": 218400,
            "revisionCount": 21
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-balanced-n24-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 191100,
            "incrementalCost": 191100,
            "revisionCount": 5
          },
          "adaptiveV9": {
            "totalCost": 191100,
            "incrementalCost": 191100,
            "revisionCount": 5
          },
          "highsV8": {
            "totalCost": 182000,
            "incrementalCost": 182000,
            "revisionCount": 107
          },
          "stableHiGHSV10": {
            "totalCost": 182000,
            "incrementalCost": 182000,
            "revisionCount": 0
          },
          "commitmentHiGHSV11": {
            "totalCost": 182000,
            "incrementalCost": 182000,
            "revisionCount": 0
          },
          "seededHiGHSV12": {
            "totalCost": 182000,
            "incrementalCost": 182000,
            "revisionCount": 0
          },
          "guardedHiGHSV13": {
            "totalCost": 182000,
            "incrementalCost": 182000,
            "revisionCount": 0
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-balanced-n24-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 473200,
            "incrementalCost": 418600,
            "revisionCount": 14
          },
          "adaptiveV9": {
            "totalCost": 473200,
            "incrementalCost": 418600,
            "revisionCount": 14
          },
          "highsV8": {
            "totalCost": 473200,
            "incrementalCost": 418600,
            "revisionCount": 126
          },
          "stableHiGHSV10": {
            "totalCost": 473200,
            "incrementalCost": 418600,
            "revisionCount": 30
          },
          "commitmentHiGHSV11": {
            "totalCost": 473200,
            "incrementalCost": 418600,
            "revisionCount": 47
          },
          "seededHiGHSV12": {
            "totalCost": 473200,
            "incrementalCost": 418600,
            "revisionCount": 47
          },
          "guardedHiGHSV13": {
            "totalCost": 500500,
            "incrementalCost": 445900,
            "revisionCount": 53
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-balanced-n50-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 737100,
            "incrementalCost": 673400,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 737100,
            "incrementalCost": 673400,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 737100,
            "incrementalCost": 673400,
            "revisionCount": 303
          },
          "stableHiGHSV10": {
            "totalCost": 737100,
            "incrementalCost": 673400,
            "revisionCount": 0
          },
          "commitmentHiGHSV11": {
            "totalCost": 737100,
            "incrementalCost": 673400,
            "revisionCount": 36
          },
          "seededHiGHSV12": {
            "totalCost": 737100,
            "incrementalCost": 673400,
            "revisionCount": 36
          },
          "guardedHiGHSV13": {
            "totalCost": 737100,
            "incrementalCost": 673400,
            "revisionCount": 36
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-balanced-n50-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 637000,
            "incrementalCost": 564200,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 637000,
            "incrementalCost": 564200,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 637000,
            "incrementalCost": 564200,
            "revisionCount": 254
          },
          "stableHiGHSV10": {
            "totalCost": 637000,
            "incrementalCost": 564200,
            "revisionCount": 0
          },
          "commitmentHiGHSV11": {
            "totalCost": 637000,
            "incrementalCost": 564200,
            "revisionCount": 0
          },
          "seededHiGHSV12": {
            "totalCost": 637000,
            "incrementalCost": 564200,
            "revisionCount": 0
          },
          "guardedHiGHSV13": {
            "totalCost": 637000,
            "incrementalCost": 564200,
            "revisionCount": 0
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-balanced-n50-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 546000,
            "incrementalCost": 418600,
            "revisionCount": 27
          },
          "adaptiveV9": {
            "totalCost": 546000,
            "incrementalCost": 418600,
            "revisionCount": 27
          },
          "highsV8": {
            "totalCost": 518700,
            "incrementalCost": 391300,
            "revisionCount": 266
          },
          "stableHiGHSV10": {
            "totalCost": 536900,
            "incrementalCost": 409500,
            "revisionCount": 64
          },
          "commitmentHiGHSV11": {
            "totalCost": 536900,
            "incrementalCost": 409500,
            "revisionCount": 64
          },
          "seededHiGHSV12": {
            "totalCost": 536900,
            "incrementalCost": 409500,
            "revisionCount": 64
          },
          "guardedHiGHSV13": {
            "totalCost": 588300,
            "incrementalCost": 460900,
            "revisionCount": 79
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-balanced-n100-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1328600,
            "incrementalCost": 1082900,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 1328600,
            "incrementalCost": 1082900,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 1328600,
            "incrementalCost": 1082900,
            "revisionCount": 584
          },
          "stableHiGHSV10": {
            "totalCost": 1328600,
            "incrementalCost": 1082900,
            "revisionCount": 0
          },
          "commitmentHiGHSV11": {
            "totalCost": 1328600,
            "incrementalCost": 1082900,
            "revisionCount": 126
          },
          "seededHiGHSV12": {
            "totalCost": 1328600,
            "incrementalCost": 1082900,
            "revisionCount": 126
          },
          "guardedHiGHSV13": {
            "totalCost": 1328600,
            "incrementalCost": 1082900,
            "revisionCount": 126
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-balanced-n100-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1146600,
            "incrementalCost": 1019200,
            "revisionCount": 27
          },
          "adaptiveV9": {
            "totalCost": 1146600,
            "incrementalCost": 1019200,
            "revisionCount": 27
          },
          "highsV8": {
            "totalCost": 1137500,
            "incrementalCost": 1010100,
            "revisionCount": 583
          },
          "stableHiGHSV10": {
            "totalCost": 1137500,
            "incrementalCost": 1010100,
            "revisionCount": 77
          },
          "commitmentHiGHSV11": {
            "totalCost": 1137500,
            "incrementalCost": 1010100,
            "revisionCount": 77
          },
          "seededHiGHSV12": {
            "totalCost": 1137500,
            "incrementalCost": 1010100,
            "revisionCount": 77
          },
          "guardedHiGHSV13": {
            "totalCost": 1510600,
            "incrementalCost": 1383200,
            "revisionCount": 323
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-balanced-n100-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1155700,
            "incrementalCost": 1037400,
            "revisionCount": 42
          },
          "adaptiveV9": {
            "totalCost": 1155700,
            "incrementalCost": 1037400,
            "revisionCount": 42
          },
          "highsV8": {
            "totalCost": 1092000,
            "incrementalCost": 973700,
            "revisionCount": 633
          },
          "stableHiGHSV10": {
            "totalCost": 1119300,
            "incrementalCost": 1001000,
            "revisionCount": 173
          },
          "commitmentHiGHSV11": {
            "totalCost": 1119300,
            "incrementalCost": 1001000,
            "revisionCount": 231
          },
          "seededHiGHSV12": {
            "totalCost": 1119300,
            "incrementalCost": 1001000,
            "revisionCount": 231
          },
          "guardedHiGHSV13": {
            "totalCost": 1264900,
            "incrementalCost": 1146600,
            "revisionCount": 254
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-balanced-n100-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1301300,
            "incrementalCost": 1137500,
            "revisionCount": 63
          },
          "adaptiveV9": {
            "totalCost": 1301300,
            "incrementalCost": 1137500,
            "revisionCount": 63
          },
          "highsV8": {
            "totalCost": 1274000,
            "incrementalCost": 1110200,
            "revisionCount": 629
          },
          "stableHiGHSV10": {
            "totalCost": 1274000,
            "incrementalCost": 1110200,
            "revisionCount": 126
          },
          "commitmentHiGHSV11": {
            "totalCost": 1274000,
            "incrementalCost": 1110200,
            "revisionCount": 126
          },
          "seededHiGHSV12": {
            "totalCost": 1274000,
            "incrementalCost": 1110200,
            "revisionCount": 126
          },
          "guardedHiGHSV13": {
            "totalCost": 1804500,
            "incrementalCost": 1640700,
            "revisionCount": 132
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-tight-n24-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 442700,
            "incrementalCost": 388100,
            "revisionCount": 48
          },
          "adaptiveV9": {
            "totalCost": 442700,
            "incrementalCost": 388100,
            "revisionCount": 48
          },
          "highsV8": {
            "totalCost": 433600,
            "incrementalCost": 379000,
            "revisionCount": 163
          },
          "stableHiGHSV10": {
            "totalCost": 409500,
            "incrementalCost": 354900,
            "revisionCount": 58
          },
          "commitmentHiGHSV11": {
            "totalCost": 409500,
            "incrementalCost": 354900,
            "revisionCount": 58
          },
          "seededHiGHSV12": {
            "totalCost": 409500,
            "incrementalCost": 354900,
            "revisionCount": 58
          },
          "guardedHiGHSV13": {
            "totalCost": 409500,
            "incrementalCost": 354900,
            "revisionCount": 58
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-tight-n24-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 500000,
            "incrementalCost": 445400,
            "revisionCount": 13
          },
          "adaptiveV9": {
            "totalCost": 500000,
            "incrementalCost": 445400,
            "revisionCount": 13
          },
          "highsV8": {
            "totalCost": 500000,
            "incrementalCost": 445400,
            "revisionCount": 98
          },
          "stableHiGHSV10": {
            "totalCost": 500000,
            "incrementalCost": 445400,
            "revisionCount": 11
          },
          "commitmentHiGHSV11": {
            "totalCost": 500000,
            "incrementalCost": 445400,
            "revisionCount": 11
          },
          "seededHiGHSV12": {
            "totalCost": 500000,
            "incrementalCost": 445400,
            "revisionCount": 11
          },
          "guardedHiGHSV13": {
            "totalCost": 500000,
            "incrementalCost": 445400,
            "revisionCount": 11
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-tight-n50-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1346300,
            "incrementalCost": 1300800,
            "revisionCount": 92
          },
          "adaptiveV9": {
            "totalCost": 1240300,
            "incrementalCost": 1194800,
            "revisionCount": 95
          },
          "highsV8": {
            "totalCost": 791700,
            "incrementalCost": 746200,
            "revisionCount": 352
          },
          "stableHiGHSV10": {
            "totalCost": 809900,
            "incrementalCost": 764400,
            "revisionCount": 112
          },
          "commitmentHiGHSV11": {
            "totalCost": 809900,
            "incrementalCost": 764400,
            "revisionCount": 112
          },
          "seededHiGHSV12": {
            "totalCost": 809900,
            "incrementalCost": 764400,
            "revisionCount": 112
          },
          "guardedHiGHSV13": {
            "totalCost": 809900,
            "incrementalCost": 764400,
            "revisionCount": 112
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-tight-n50-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1449600,
            "incrementalCost": 1395000,
            "revisionCount": 40
          },
          "adaptiveV9": {
            "totalCost": 1334000,
            "incrementalCost": 1279400,
            "revisionCount": 55
          },
          "highsV8": {
            "totalCost": 870400,
            "incrementalCost": 815800,
            "revisionCount": 315
          },
          "stableHiGHSV10": {
            "totalCost": 870400,
            "incrementalCost": 815800,
            "revisionCount": 42
          },
          "commitmentHiGHSV11": {
            "totalCost": 870400,
            "incrementalCost": 815800,
            "revisionCount": 61
          },
          "seededHiGHSV12": {
            "totalCost": 870400,
            "incrementalCost": 815800,
            "revisionCount": 61
          },
          "guardedHiGHSV13": {
            "totalCost": 870400,
            "incrementalCost": 815800,
            "revisionCount": 61
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-tight-n50-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1055600,
            "incrementalCost": 910000,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 1037400,
            "incrementalCost": 891800,
            "revisionCount": 4
          },
          "highsV8": {
            "totalCost": 828100,
            "incrementalCost": 682500,
            "revisionCount": 308
          },
          "stableHiGHSV10": {
            "totalCost": 828100,
            "incrementalCost": 682500,
            "revisionCount": 86
          },
          "commitmentHiGHSV11": {
            "totalCost": 828100,
            "incrementalCost": 682500,
            "revisionCount": 114
          },
          "seededHiGHSV12": {
            "totalCost": 828100,
            "incrementalCost": 682500,
            "revisionCount": 114
          },
          "guardedHiGHSV13": {
            "totalCost": 864500,
            "incrementalCost": 718900,
            "revisionCount": 137
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-tight-n50-r4",
        "pairedRepeatCount": 2,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 937300,
            "incrementalCost": 873600,
            "revisionCount": 71.5
          },
          "adaptiveV9": {
            "totalCost": 937300,
            "incrementalCost": 873600,
            "revisionCount": 70
          },
          "highsV8": {
            "totalCost": 910000,
            "incrementalCost": 846300,
            "revisionCount": 368
          },
          "stableHiGHSV10": {
            "totalCost": 910000,
            "incrementalCost": 846300,
            "revisionCount": 78
          },
          "commitmentHiGHSV11": {
            "totalCost": 910000,
            "incrementalCost": 846300,
            "revisionCount": 78
          },
          "seededHiGHSV12": {
            "totalCost": 910000,
            "incrementalCost": 846300,
            "revisionCount": 78
          },
          "guardedHiGHSV13": {
            "totalCost": 1010100,
            "incrementalCost": 946400,
            "revisionCount": 234
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-tight-n100-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 3307700,
            "incrementalCost": 3143900,
            "revisionCount": 30
          },
          "adaptiveV9": {
            "totalCost": 3307700,
            "incrementalCost": 3143900,
            "revisionCount": 30
          },
          "highsV8": {
            "totalCost": 1847300,
            "incrementalCost": 1683500,
            "revisionCount": 667
          },
          "stableHiGHSV10": {
            "totalCost": 1865500,
            "incrementalCost": 1701700,
            "revisionCount": 180
          },
          "commitmentHiGHSV11": {
            "totalCost": 1865500,
            "incrementalCost": 1701700,
            "revisionCount": 265
          },
          "seededHiGHSV12": {
            "totalCost": 1865500,
            "incrementalCost": 1701700,
            "revisionCount": 265
          },
          "guardedHiGHSV13": {
            "totalCost": 1977400,
            "incrementalCost": 1813600,
            "revisionCount": 192
          }
        }
      },
      {
        "scenarioId": "v14-same-distribution-batch-release-tight-n100-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 3685700,
            "incrementalCost": 3503700,
            "revisionCount": 145
          },
          "adaptiveV9": {
            "totalCost": 3685700,
            "incrementalCost": 3503700,
            "revisionCount": 145
          },
          "highsV8": {
            "totalCost": 2071600,
            "incrementalCost": 1889600,
            "revisionCount": 625
          },
          "stableHiGHSV10": {
            "totalCost": 2071600,
            "incrementalCost": 1889600,
            "revisionCount": 109
          },
          "commitmentHiGHSV11": {
            "totalCost": 2071600,
            "incrementalCost": 1889600,
            "revisionCount": 109
          },
          "seededHiGHSV12": {
            "totalCost": 2071600,
            "incrementalCost": 1889600,
            "revisionCount": 109
          },
          "guardedHiGHSV13": {
            "totalCost": 2641700,
            "incrementalCost": 2459700,
            "revisionCount": 277
          }
        }
      }
    ],
    "scope": "Conditional all-seven jointly completed matching repeats; average within scenario then equal scenario weight. No revision-to-KRW conversion. This table never overrides full-sample completion losses or establishes universal dominance."
  },
  "observedDecisionGates": {
    "candidateMethod": "guardedHiGHSV13",
    "assessmentState": "complete-panel",
    "completionLossCountsByBaseline": {
      "seededHiGHSV12": 0,
      "commitmentHiGHSV11": 0,
      "stableHiGHSV10": 0,
      "adaptiveV9": 0,
      "highsV8": 0,
      "costPolishV7": 0
    },
    "completionGainCountsByBaseline": {
      "seededHiGHSV12": 0,
      "commitmentHiGHSV11": 18,
      "stableHiGHSV10": 21,
      "adaptiveV9": 34,
      "highsV8": 21,
      "costPolishV7": 34
    },
    "completionNonRegressionAllBaselines": true,
    "defaultRecommendationEligible": true,
    "nativeComparison": {
      "lostEpisodeCount": 0,
      "revisionPairedEpisodeCount": 150,
      "revisionDelta": -31091,
      "strictRevisionReduction": true,
      "incrementalFeeClaim": "conditional_deterioration_interval_negative",
      "totalFeeClaim": "conditional_deterioration_interval_negative",
      "noRobustFeeDeterioration": false,
      "stabilityImprovementClaimAllowed": false
    },
    "nativeComparisons": {
      "seededHiGHSV12": {
        "lostEpisodeCount": 0,
        "revisionPairedEpisodeCount": 171,
        "revisionDelta": 3434,
        "strictRevisionReduction": false,
        "incrementalFeeClaim": "conditional_deterioration_interval_negative",
        "totalFeeClaim": "conditional_deterioration_interval_negative",
        "noRobustFeeDeterioration": false,
        "stabilityImprovementClaimAllowed": false
      },
      "commitmentHiGHSV11": {
        "lostEpisodeCount": 0,
        "revisionPairedEpisodeCount": 153,
        "revisionDelta": 3268,
        "strictRevisionReduction": false,
        "incrementalFeeClaim": "conditional_deterioration_interval_negative",
        "totalFeeClaim": "conditional_deterioration_interval_negative",
        "noRobustFeeDeterioration": false,
        "stabilityImprovementClaimAllowed": false
      },
      "stableHiGHSV10": {
        "lostEpisodeCount": 0,
        "revisionPairedEpisodeCount": 150,
        "revisionDelta": 6025,
        "strictRevisionReduction": false,
        "incrementalFeeClaim": "conditional_deterioration_interval_negative",
        "totalFeeClaim": "conditional_deterioration_interval_negative",
        "noRobustFeeDeterioration": false,
        "stabilityImprovementClaimAllowed": false
      },
      "highsV8": {
        "lostEpisodeCount": 0,
        "revisionPairedEpisodeCount": 150,
        "revisionDelta": -31091,
        "strictRevisionReduction": true,
        "incrementalFeeClaim": "conditional_deterioration_interval_negative",
        "totalFeeClaim": "conditional_deterioration_interval_negative",
        "noRobustFeeDeterioration": false,
        "stabilityImprovementClaimAllowed": false
      }
    },
    "scope": "Observed necessary gates against the six included comparators only. Any full-sample completion loss blocks default eligibility; net gains and conditional fees/Pareto position do not offset losses. Native stability claims use each exact native paired set; zero-inclusive fee intervals do not prove stable savings. No claim against omitted V5 or universal/production recommendation."
  }
}
```

## 压力扰动 · 新订单

| method | complete | recorded | D0 accepted | D0 failed | later failed | D0 unknown |
| --- | --- | --- | --- | --- | --- | --- |
| costPolishV7 | 87 | 216 | 183 | 33 | 96 | 0 |
| adaptiveV9 | 86 | 216 | 183 | 33 | 97 | 0 |
| highsV8 | 116 | 216 | 178 | 38 | 62 | 0 |
| stableHiGHSV10 | 117 | 216 | 177 | 39 | 60 | 0 |
| commitmentHiGHSV11 | 118 | 216 | 177 | 39 | 59 | 0 |
| seededHiGHSV12 | 126 | 216 | 189 | 27 | 63 | 0 |
| guardedHiGHSV13 | 124 | 216 | 188 | 28 | 64 | 0 |

### v13VsV12 [primary]
seededHiGHSV12 → guardedHiGHSV13
Completion gained/lost: 3/5; scenario rate gain 95% CI [-0.04641203704, 0.03240740741]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 41 | 121 | 332,641,950.000000 | 369,751,500.000000 | -11.16% | [-17.02812999, -6.652312015] | [-1672575.61, -347267.6829] | 997,907,650 | 1,109,240,850 | {'win': 1, 'tie': 18, 'loss': 22} | 13,470,600 |
| incremental | 41 | 121 | 192,764,150.000000 | 229,873,700.000000 | -19.25% | [-29.4626804, -11.17798967] | [-1672575.61, -347267.6829] | 578,274,250 | 689,607,450 | {'win': 1, 'tie': 18, 'loss': 22} | 13,470,600 |
Revisions on this exact pair: 19842 → 23586; known matching episodes=121

### v13VsV11 [primary]
commitmentHiGHSV11 → guardedHiGHSV13
Completion gained/lost: 10/4; scenario rate gain 95% CI [-0.02314814815, 0.08333333333]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 39 | 114 | 332,093,450.000000 | 369,746,950.000000 | -11.34% | [-17.21832928, -6.730929454] | [-1774204.391, -368079.5192] | 990,424,650 | 1,095,499,050 | {'win': 0, 'tie': 17, 'loss': 22} | 13,470,600 |
| incremental | 39 | 114 | 192,215,650.000000 | 229,869,150.000000 | -19.59% | [-30.18660428, -11.34811681] | [-1774204.391, -368079.5192] | 571,064,250 | 676,138,650 | {'win': 0, 'tie': 17, 'loss': 22} | 13,470,600 |
Revisions on this exact pair: 17265 → 20611; known matching episodes=114

### v13VsV10 [primary]
stableHiGHSV10 → guardedHiGHSV13
Completion gained/lost: 11/4; scenario rate gain 95% CI [-0.01863425926, 0.09259259259]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 38 | 113 | 329,241,050.000000 | 362,880,600.000000 | -10.22% | [-15.46730877, -6.097238997] | [-1656443.158, -295237.0395] | 987,714,050 | 1,088,632,700 | {'win': 0, 'tie': 16, 'loss': 22} | 13,410,600 |
| incremental | 38 | 113 | 189,499,750.000000 | 223,139,300.000000 | -17.75% | [-27.61651698, -10.19168112] | [-1656443.158, -295237.0395] | 568,490,150 | 669,408,800 | {'win': 0, 'tie': 16, 'loss': 22} | 13,410,600 |
Revisions on this exact pair: 14355 → 20043; known matching episodes=113

### v13VsV9 [primary]
adaptiveV9 → guardedHiGHSV13
Completion gained/lost: 38/0; scenario rate gain 95% CI [0.09259259259, 0.2638888889]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 29 | 86 | 413,636,283.333333 | 432,776,100.000000 | -4.63% | [-9.202722486, -1.182230419] | [-1431431.911, -144150.1293] | 1,239,815,500 | 1,297,139,400 | {'win': 5, 'tie': 7, 'loss': 17} | 9,182,000 |
| incremental | 29 | 86 | 245,516,083.333333 | 264,655,900.000000 | -7.80% | [-15.7328346, -1.967585435] | [-1431431.911, -144150.1293] | 735,500,400 | 792,824,300 | {'win': 5, 'tie': 7, 'loss': 17} | 9,182,000 |
Revisions on this exact pair: 9073 → 17844; known matching episodes=86

### v13VsHiGHS [primary]
highsV8 → guardedHiGHSV13
Completion gained/lost: 12/4; scenario rate gain 95% CI [-0.02314814815, 0.09722222222]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 38 | 112 | 331,576,350.000000 | 369,513,550.000000 | -11.44% | [-17.77904467, -6.612835526] | [-1800568.487, -384451.8092] | 991,869,450 | 1,101,665,200 | {'win': 0, 'tie': 13, 'loss': 25} | 13,470,600 |
| incremental | 38 | 112 | 191,716,750.000000 | 229,653,950.000000 | -19.79% | [-31.02336168, -11.26467274] | [-1800568.487, -384451.8092] | 572,427,150 | 682,222,900 | {'win': 0, 'tie': 13, 'loss': 25} | 13,470,600 |
Revisions on this exact pair: 41905 → 21476; known matching episodes=112

### v13VsV7 [primary]
costPolishV7 → guardedHiGHSV13
Completion gained/lost: 37/0; scenario rate gain 95% CI [0.09259259259, 0.2592592593]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 29 | 87 | 413,760,933.333333 | 432,776,100.000000 | -4.60% | [-9.167780282, -1.137889306] | [-1424134.799, -138796.4368] | 1,241,282,800 | 1,298,328,300 | {'win': 5, 'tie': 7, 'loss': 17} | 9,182,000 |
| incremental | 29 | 87 | 245,640,733.333333 | 264,655,900.000000 | -7.74% | [-15.73481958, -1.915463551] | [-1424134.799, -138796.4368] | 736,922,200 | 793,967,700 | {'win': 5, 'tie': 7, 'loss': 17} | 9,182,000 |
Revisions on this exact pair: 9142 → 17970; known matching episodes=87

### v12VsV11 [secondary]
commitmentHiGHSV11 → seededHiGHSV12
Completion gained/lost: 8/0; scenario rate gain 95% CI [0, 0.08333333333]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 40 | 118 | 363,822,600.000000 | 364,362,000.000000 | -0.15% | [-0.4886293408, 0] | [-36377.5, 0] | 1,085,621,200 | 1,086,486,800 | {'win': 0, 'tie': 38, 'loss': 2} | 376,300 |
| incremental | 40 | 118 | 207,320,200.000000 | 207,859,600.000000 | -0.26% | [-0.8298345498, 0] | [-36377.5, 0] | 616,387,000 | 617,252,600 | {'win': 0, 'tie': 38, 'loss': 2} | 376,300 |
Revisions on this exact pair: 17979 → 17784; known matching episodes=118

### v12VsV10 [secondary]
stableHiGHSV10 → seededHiGHSV12
Completion gained/lost: 9/0; scenario rate gain 95% CI [0, 0.09722222222]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 39 | 117 | 360,970,200.000000 | 361,062,400.000000 | -0.03% | [-0.1289444298, 0.04865727484] | [-12546.15385, 4615.384615] | 1,082,910,600 | 1,083,187,200 | {'win': 2, 'tie': 35, 'loss': 2} | 163,100 |
| incremental | 39 | 117 | 204,604,300.000000 | 204,696,500.000000 | -0.05% | [-0.2249790744, 0.08798969913] | [-12546.15385, 4615.384615] | 613,812,900 | 614,089,500 | {'win': 2, 'tie': 35, 'loss': 2} | 163,100 |
Revisions on this exact pair: 15069 → 17328; known matching episodes=117

### v12VsV9 [secondary]
adaptiveV9 → seededHiGHSV12
Completion gained/lost: 43/3; scenario rate gain 95% CI [0.09247685185, 0.2824074074]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 28 | 83 | 347,697,383.333333 | 330,175,850.000000 | 5.04% | [2.693476115, 7.714564205] | [214759.4643, 1104265.595] | 1,041,998,800 | 989,338,650 | {'win': 13, 'tie': 12, 'loss': 3} | 95,550 |
| incremental | 28 | 83 | 208,138,083.333333 | 190,616,550.000000 | 8.42% | [4.535102082, 12.37897117] | [214759.4643, 1104265.595] | 623,366,400 | 570,706,250 | {'win': 13, 'tie': 12, 'loss': 3} | 95,550 |
Revisions on this exact pair: 8218 → 13632; known matching episodes=83

### v12VsHiGHS [secondary]
highsV8 → seededHiGHSV12
Completion gained/lost: 13/3; scenario rate gain 95% CI [-0.01388888889, 0.1111111111]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 38 | 113 | 331,576,350.000000 | 332,399,450.000000 | -0.25% | [-0.7269389258, -0.05924309521] | [-49890.78947, -4234.210526] | 991,878,550 | 993,898,750 | {'win': 0, 'tie': 28, 'loss': 10} | 449,100 |
| incremental | 38 | 113 | 191,716,750.000000 | 192,539,850.000000 | -0.43% | [-1.199768239, -0.1035247319] | [-49890.78947, -4234.210526] | 572,436,250 | 574,456,450 | {'win': 0, 'tie': 28, 'loss': 10} | 449,100 |
Revisions on this exact pair: 42858 → 18309; known matching episodes=113

### v12VsV7 [secondary]
costPolishV7 → seededHiGHSV12
Completion gained/lost: 42/3; scenario rate gain 95% CI [0.08333333333, 0.2777777778]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 28 | 84 | 347,822,033.333333 | 330,175,850.000000 | 5.07% | [2.718488223, 7.774305437] | [217079.1518, 1108136.905] | 1,043,466,100 | 990,527,550 | {'win': 13, 'tie': 12, 'loss': 3} | 100,100 |
| incremental | 28 | 84 | 208,262,733.333333 | 190,616,550.000000 | 8.47% | [4.575047616, 12.46810193] | [217079.1518, 1108136.905] | 624,788,200 | 571,849,650 | {'win': 13, 'tie': 12, 'loss': 3} | 100,100 |
Revisions on this exact pair: 8287 → 13758; known matching episodes=84

### v11VsV10 [secondary]
stableHiGHSV10 → commitmentHiGHSV11
Completion gained/lost: 1/0; scenario rate gain 95% CI [0, 0.01388888889]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 39 | 117 | 360,970,200.000000 | 360,899,300.000000 | 0.02% | [-0.007369621344, 0.05056575019] | [-466.6666667, 5407.692308] | 1,082,910,600 | 1,082,697,900 | {'win': 2, 'tie': 36, 'loss': 1} | 9,100 |
| incremental | 39 | 117 | 204,604,300.000000 | 204,533,400.000000 | 0.03% | [-0.0127003757, 0.09103105665] | [-466.6666667, 5407.692308] | 613,812,900 | 613,600,200 | {'win': 2, 'tie': 36, 'loss': 1} | 9,100 |
Revisions on this exact pair: 15069 → 17691; known matching episodes=117

### v10VsHiGHS [secondary]
highsV8 → stableHiGHSV10
Completion gained/lost: 9/8; scenario rate gain 95% CI [-0.06018518519, 0.06944444444]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 36 | 108 | 328,725,850.000000 | 329,007,650.000000 | -0.09% | [-0.1578813862, -0.02379546852] | [-15952.84722, -1769.444444] | 986,177,550 | 987,022,950 | {'win': 1, 'tie': 26, 'loss': 9} | 106,300 |
| incremental | 36 | 108 | 189,002,750.000000 | 189,284,550.000000 | -0.15% | [-0.2750539639, -0.04040589843] | [-15952.84722, -1769.444444] | 567,008,250 | 567,853,650 | {'win': 1, 'tie': 26, 'loss': 9} | 106,300 |
Revisions on this exact pair: 40113 → 14283; known matching episodes=108

### highsVsV7 [secondary]
costPolishV7 → highsV8
Completion gained/lost: 36/7; scenario rate gain 95% CI [0.04155092593, 0.2361111111]

| fee | scenarios | matching episodes | baseline equal-scenario KRW | candidate equal-scenario KRW | savings % | 95% savings % CI | 95% mean KRW CI | baseline raw episode KRW | candidate raw episode KRW | win/tie/loss | worst scenario loss KRW |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| total | 27 | 80 | 347,588,633.333333 | 329,119,350.000000 | 5.31% | [2.954952191, 8.517474531] | [261120.1852, 1218777.407] | 1,036,561,000 | 984,507,550 | {'win': 15, 'tie': 10, 'loss': 2} | 91,000 |
| incremental | 27 | 80 | 208,047,533.333333 | 189,578,250.000000 | 8.88% | [4.944164308, 13.5146255] | [261120.1852, 1218777.407] | 618,074,200 | 566,020,750 | {'win': 15, 'tie': 10, 'loss': 2} | 91,000 |
Revisions on this exact pair: 7959 → 27927; known matching episodes=80

### All-seven common-complete subset / observed necessary gates

```json
{
  "jointCompletePareto": {
    "jointScenarioCount": 25,
    "jointEpisodeCount": 74,
    "eligibility": "all-seven-matching-complete-repeats",
    "byMethod": {
      "costPolishV7": {
        "scenarioCount": 25,
        "jointEpisodeCount": 74,
        "scenarioMeanTotalCostSumKRW": 341383733.3333334,
        "scenarioMeanIncrementalCostSumKRW": 201979133.3333333,
        "scenarioMeanRevisionCountSum": 2303.333333333333,
        "episodeTotalCostSumKRW": 1023062400,
        "episodeIncrementalCostSumKRW": 604894100,
        "episodeRevisionCountSum": 6802,
        "knownRevisionEpisodeCount": 74,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 87,
        "fullSampleEpisodeCount": 216
      },
      "adaptiveV9": {
        "scenarioCount": 25,
        "jointEpisodeCount": 74,
        "scenarioMeanTotalCostSumKRW": 341259083.3333334,
        "scenarioMeanIncrementalCostSumKRW": 201854483.3333333,
        "scenarioMeanRevisionCountSum": 2317.5,
        "episodeTotalCostSumKRW": 1022683900,
        "episodeIncrementalCostSumKRW": 604515600,
        "episodeRevisionCountSum": 6841,
        "knownRevisionEpisodeCount": 74,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 86,
        "fullSampleEpisodeCount": 216
      },
      "highsV8": {
        "scenarioCount": 25,
        "jointEpisodeCount": 74,
        "scenarioMeanTotalCostSumKRW": 326268850,
        "scenarioMeanIncrementalCostSumKRW": 186864250,
        "scenarioMeanRevisionCountSum": 8394,
        "episodeTotalCostSumKRW": 977626750,
        "episodeIncrementalCostSumKRW": 559458450,
        "episodeRevisionCountSum": 24884,
        "knownRevisionEpisodeCount": 74,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 116,
        "fullSampleEpisodeCount": 216
      },
      "stableHiGHSV10": {
        "scenarioCount": 25,
        "jointEpisodeCount": 74,
        "scenarioMeanTotalCostSumKRW": 326550650,
        "scenarioMeanIncrementalCostSumKRW": 187146050,
        "scenarioMeanRevisionCountSum": 2968,
        "episodeTotalCostSumKRW": 978463050,
        "episodeIncrementalCostSumKRW": 560294750,
        "episodeRevisionCountSum": 8778,
        "knownRevisionEpisodeCount": 74,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 117,
        "fullSampleEpisodeCount": 216
      },
      "commitmentHiGHSV11": {
        "scenarioCount": 25,
        "jointEpisodeCount": 74,
        "scenarioMeanTotalCostSumKRW": 326479750,
        "scenarioMeanIncrementalCostSumKRW": 187075150,
        "scenarioMeanRevisionCountSum": 3624,
        "episodeTotalCostSumKRW": 978250350,
        "episodeIncrementalCostSumKRW": 560082050,
        "episodeRevisionCountSum": 10746,
        "knownRevisionEpisodeCount": 74,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 118,
        "fullSampleEpisodeCount": 216
      },
      "seededHiGHSV12": {
        "scenarioCount": 25,
        "jointEpisodeCount": 74,
        "scenarioMeanTotalCostSumKRW": 326642850,
        "scenarioMeanIncrementalCostSumKRW": 187238250,
        "scenarioMeanRevisionCountSum": 3815,
        "episodeTotalCostSumKRW": 978739650,
        "episodeIncrementalCostSumKRW": 560571350,
        "episodeRevisionCountSum": 11319,
        "knownRevisionEpisodeCount": 74,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 126,
        "fullSampleEpisodeCount": 216
      },
      "guardedHiGHSV13": {
        "scenarioCount": 25,
        "jointEpisodeCount": 74,
        "scenarioMeanTotalCostSumKRW": 359948200,
        "scenarioMeanIncrementalCostSumKRW": 220543600,
        "scenarioMeanRevisionCountSum": 4651,
        "episodeTotalCostSumKRW": 1078655700,
        "episodeIncrementalCostSumKRW": 660487400,
        "episodeRevisionCountSum": 13827,
        "knownRevisionEpisodeCount": 74,
        "unknownRevisionEpisodeCount": 0,
        "fullSampleCompleteEpisodeCount": 124,
        "fullSampleEpisodeCount": 216
      }
    },
    "frontiers": {
      "totalAndRevisions": [
        {
          "method": "costPolishV7",
          "dominates": [
            "guardedHiGHSV13"
          ],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "adaptiveV9",
          "dominates": [
            "guardedHiGHSV13"
          ],
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
          "dominates": [
            "seededHiGHSV12",
            "guardedHiGHSV13"
          ],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "commitmentHiGHSV11",
          "dominates": [
            "seededHiGHSV12",
            "guardedHiGHSV13"
          ],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "seededHiGHSV12",
          "dominates": [
            "guardedHiGHSV13"
          ],
          "dominatedBy": [
            "stableHiGHSV10",
            "commitmentHiGHSV11"
          ],
          "pareto": false
        },
        {
          "method": "guardedHiGHSV13",
          "dominates": [],
          "dominatedBy": [
            "costPolishV7",
            "adaptiveV9",
            "stableHiGHSV10",
            "commitmentHiGHSV11",
            "seededHiGHSV12"
          ],
          "pareto": false
        }
      ],
      "incrementalAndRevisions": [
        {
          "method": "costPolishV7",
          "dominates": [
            "guardedHiGHSV13"
          ],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "adaptiveV9",
          "dominates": [
            "guardedHiGHSV13"
          ],
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
          "dominates": [
            "seededHiGHSV12",
            "guardedHiGHSV13"
          ],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "commitmentHiGHSV11",
          "dominates": [
            "seededHiGHSV12",
            "guardedHiGHSV13"
          ],
          "dominatedBy": [],
          "pareto": true
        },
        {
          "method": "seededHiGHSV12",
          "dominates": [
            "guardedHiGHSV13"
          ],
          "dominatedBy": [
            "stableHiGHSV10",
            "commitmentHiGHSV11"
          ],
          "pareto": false
        },
        {
          "method": "guardedHiGHSV13",
          "dominates": [],
          "dominatedBy": [
            "costPolishV7",
            "adaptiveV9",
            "stableHiGHSV10",
            "commitmentHiGHSV11",
            "seededHiGHSV12"
          ],
          "pareto": false
        }
      ]
    },
    "scenarios": [
      {
        "scenarioId": "v14-stress-aged-backlog-balanced-n24-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 16785900,
            "incrementalCost": 9834400,
            "revisionCount": 65
          },
          "adaptiveV9": {
            "totalCost": 16785900,
            "incrementalCost": 9834400,
            "revisionCount": 65
          },
          "highsV8": {
            "totalCost": 16785900,
            "incrementalCost": 9834400,
            "revisionCount": 84
          },
          "stableHiGHSV10": {
            "totalCost": 16785900,
            "incrementalCost": 9834400,
            "revisionCount": 62
          },
          "commitmentHiGHSV11": {
            "totalCost": 16785900,
            "incrementalCost": 9834400,
            "revisionCount": 62
          },
          "seededHiGHSV12": {
            "totalCost": 16785900,
            "incrementalCost": 9834400,
            "revisionCount": 62
          },
          "guardedHiGHSV13": {
            "totalCost": 17161400,
            "incrementalCost": 10209900,
            "revisionCount": 146
          }
        }
      },
      {
        "scenarioId": "v14-stress-aged-backlog-balanced-n24-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 12642400,
            "incrementalCost": 7417400,
            "revisionCount": 72
          },
          "adaptiveV9": {
            "totalCost": 12642400,
            "incrementalCost": 7417400,
            "revisionCount": 72
          },
          "highsV8": {
            "totalCost": 12492400,
            "incrementalCost": 7267400,
            "revisionCount": 84
          },
          "stableHiGHSV10": {
            "totalCost": 12492400,
            "incrementalCost": 7267400,
            "revisionCount": 66
          },
          "commitmentHiGHSV11": {
            "totalCost": 12492400,
            "incrementalCost": 7267400,
            "revisionCount": 66
          },
          "seededHiGHSV12": {
            "totalCost": 12492400,
            "incrementalCost": 7267400,
            "revisionCount": 66
          },
          "guardedHiGHSV13": {
            "totalCost": 14154800,
            "incrementalCost": 8929800,
            "revisionCount": 136
          }
        }
      },
      {
        "scenarioId": "v14-stress-aged-backlog-balanced-n24-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 13520083.333333334,
            "incrementalCost": 8250933.333333333,
            "revisionCount": 51
          },
          "adaptiveV9": {
            "totalCost": 13520083.333333334,
            "incrementalCost": 8250933.333333333,
            "revisionCount": 51
          },
          "highsV8": {
            "totalCost": 13478300,
            "incrementalCost": 8209150,
            "revisionCount": 107
          },
          "stableHiGHSV10": {
            "totalCost": 13478300,
            "incrementalCost": 8209150,
            "revisionCount": 51
          },
          "commitmentHiGHSV11": {
            "totalCost": 13478300,
            "incrementalCost": 8209150,
            "revisionCount": 66
          },
          "seededHiGHSV12": {
            "totalCost": 13478300,
            "incrementalCost": 8209150,
            "revisionCount": 66
          },
          "guardedHiGHSV13": {
            "totalCost": 13685300,
            "incrementalCost": 8416150,
            "revisionCount": 90
          }
        }
      },
      {
        "scenarioId": "v14-stress-aged-backlog-balanced-n50-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 33439250,
            "incrementalCost": 19725850,
            "revisionCount": 163
          },
          "adaptiveV9": {
            "totalCost": 33439250,
            "incrementalCost": 19725850,
            "revisionCount": 163
          },
          "highsV8": {
            "totalCost": 32790450,
            "incrementalCost": 19077050,
            "revisionCount": 207
          },
          "stableHiGHSV10": {
            "totalCost": 32810450,
            "incrementalCost": 19097050,
            "revisionCount": 119
          },
          "commitmentHiGHSV11": {
            "totalCost": 32790450,
            "incrementalCost": 19077050,
            "revisionCount": 141
          },
          "seededHiGHSV12": {
            "totalCost": 32790450,
            "incrementalCost": 19077050,
            "revisionCount": 141
          },
          "guardedHiGHSV13": {
            "totalCost": 35058800,
            "incrementalCost": 21345400,
            "revisionCount": 197
          }
        }
      },
      {
        "scenarioId": "v14-stress-aged-backlog-balanced-n50-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 37138800,
            "incrementalCost": 20395400,
            "revisionCount": 123
          },
          "adaptiveV9": {
            "totalCost": 37138800,
            "incrementalCost": 20395400,
            "revisionCount": 128
          },
          "highsV8": {
            "totalCost": 36967500,
            "incrementalCost": 20224100,
            "revisionCount": 176
          },
          "stableHiGHSV10": {
            "totalCost": 37073800,
            "incrementalCost": 20330400,
            "revisionCount": 120
          },
          "commitmentHiGHSV11": {
            "totalCost": 37073800,
            "incrementalCost": 20330400,
            "revisionCount": 120
          },
          "seededHiGHSV12": {
            "totalCost": 37073800,
            "incrementalCost": 20330400,
            "revisionCount": 120
          },
          "guardedHiGHSV13": {
            "totalCost": 41151200,
            "incrementalCost": 24407800,
            "revisionCount": 164
          }
        }
      },
      {
        "scenarioId": "v14-stress-aged-backlog-balanced-n50-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 33763300,
            "incrementalCost": 20332450,
            "revisionCount": 123
          },
          "adaptiveV9": {
            "totalCost": 33763300,
            "incrementalCost": 20332450,
            "revisionCount": 123
          },
          "highsV8": {
            "totalCost": 31348850,
            "incrementalCost": 17918000,
            "revisionCount": 166
          },
          "stableHiGHSV10": {
            "totalCost": 31368850,
            "incrementalCost": 17938000,
            "revisionCount": 103
          },
          "commitmentHiGHSV11": {
            "totalCost": 31368850,
            "incrementalCost": 17938000,
            "revisionCount": 103
          },
          "seededHiGHSV12": {
            "totalCost": 31368850,
            "incrementalCost": 17938000,
            "revisionCount": 103
          },
          "guardedHiGHSV13": {
            "totalCost": 33141800,
            "incrementalCost": 19710950,
            "revisionCount": 140
          }
        }
      },
      {
        "scenarioId": "v14-stress-aged-backlog-balanced-n100-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 67784650,
            "incrementalCost": 37403650,
            "revisionCount": 345
          },
          "adaptiveV9": {
            "totalCost": 67784650,
            "incrementalCost": 37403650,
            "revisionCount": 345
          },
          "highsV8": {
            "totalCost": 63496050,
            "incrementalCost": 33115050,
            "revisionCount": 309
          },
          "stableHiGHSV10": {
            "totalCost": 63556050,
            "incrementalCost": 33175050,
            "revisionCount": 212
          },
          "commitmentHiGHSV11": {
            "totalCost": 63496050,
            "incrementalCost": 33115050,
            "revisionCount": 253
          },
          "seededHiGHSV12": {
            "totalCost": 63496050,
            "incrementalCost": 33115050,
            "revisionCount": 253
          },
          "guardedHiGHSV13": {
            "totalCost": 76966650,
            "incrementalCost": 46585650,
            "revisionCount": 358
          }
        }
      },
      {
        "scenarioId": "v14-stress-aged-backlog-balanced-n100-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 55679300,
            "incrementalCost": 32705850,
            "revisionCount": 338.3333333333333
          },
          "adaptiveV9": {
            "totalCost": 55679300,
            "incrementalCost": 32705850,
            "revisionCount": 338.3333333333333
          },
          "highsV8": {
            "totalCost": 52319500,
            "incrementalCost": 29346050,
            "revisionCount": 303
          },
          "stableHiGHSV10": {
            "totalCost": 52289500,
            "incrementalCost": 29316050,
            "revisionCount": 210
          },
          "commitmentHiGHSV11": {
            "totalCost": 52289500,
            "incrementalCost": 29316050,
            "revisionCount": 210
          },
          "seededHiGHSV12": {
            "totalCost": 52452600,
            "incrementalCost": 29479150,
            "revisionCount": 401
          },
          "guardedHiGHSV13": {
            "totalCost": 57108600,
            "incrementalCost": 34135150,
            "revisionCount": 423
          }
        }
      },
      {
        "scenarioId": "v14-stress-aged-backlog-balanced-n100-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 60061550,
            "incrementalCost": 36464000,
            "revisionCount": 244
          },
          "adaptiveV9": {
            "totalCost": 60061550,
            "incrementalCost": 36464000,
            "revisionCount": 244
          },
          "highsV8": {
            "totalCost": 57041800,
            "incrementalCost": 33444250,
            "revisionCount": 395
          },
          "stableHiGHSV10": {
            "totalCost": 57101800,
            "incrementalCost": 33504250,
            "revisionCount": 214
          },
          "commitmentHiGHSV11": {
            "totalCost": 57101800,
            "incrementalCost": 33504250,
            "revisionCount": 214
          },
          "seededHiGHSV12": {
            "totalCost": 57101800,
            "incrementalCost": 33504250,
            "revisionCount": 214
          },
          "guardedHiGHSV13": {
            "totalCost": 59725350,
            "incrementalCost": 36127800,
            "revisionCount": 311
          }
        }
      },
      {
        "scenarioId": "v14-stress-new-arrivals-balanced-n24-r1",
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
            "revisionCount": 179
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 113
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 125
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 58
          },
          "guardedHiGHSV13": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 58
          }
        }
      },
      {
        "scenarioId": "v14-stress-new-arrivals-balanced-n50-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 23
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 23
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 370
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 96
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 133
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 164
          },
          "guardedHiGHSV13": {
            "totalCost": 9100,
            "incrementalCost": 9100,
            "revisionCount": 150
          }
        }
      },
      {
        "scenarioId": "v14-stress-new-arrivals-balanced-n50-r4",
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
            "revisionCount": 390
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 45
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 56
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 58
          },
          "guardedHiGHSV13": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 58
          }
        }
      },
      {
        "scenarioId": "v14-stress-new-arrivals-balanced-n100-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 38
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 38
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 838
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 188
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 271
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 271
          },
          "guardedHiGHSV13": {
            "totalCost": 36400,
            "incrementalCost": 36400,
            "revisionCount": 319
          }
        }
      },
      {
        "scenarioId": "v14-stress-new-arrivals-balanced-n100-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 1
          },
          "adaptiveV9": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 1
          },
          "highsV8": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 813
          },
          "stableHiGHSV10": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 217
          },
          "commitmentHiGHSV11": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 181
          },
          "seededHiGHSV12": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 215
          },
          "guardedHiGHSV13": {
            "totalCost": 0,
            "incrementalCost": 0,
            "revisionCount": 215
          }
        }
      },
      {
        "scenarioId": "v14-stress-batch-release-balanced-n24-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 345800,
            "incrementalCost": 291200,
            "revisionCount": 13
          },
          "adaptiveV9": {
            "totalCost": 345800,
            "incrementalCost": 291200,
            "revisionCount": 13
          },
          "highsV8": {
            "totalCost": 336700,
            "incrementalCost": 282100,
            "revisionCount": 154
          },
          "stableHiGHSV10": {
            "totalCost": 345800,
            "incrementalCost": 291200,
            "revisionCount": 22
          },
          "commitmentHiGHSV11": {
            "totalCost": 345800,
            "incrementalCost": 291200,
            "revisionCount": 38
          },
          "seededHiGHSV12": {
            "totalCost": 345800,
            "incrementalCost": 291200,
            "revisionCount": 38
          },
          "guardedHiGHSV13": {
            "totalCost": 345800,
            "incrementalCost": 291200,
            "revisionCount": 38
          }
        }
      },
      {
        "scenarioId": "v14-stress-batch-release-balanced-n24-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 409500,
            "incrementalCost": 309400,
            "revisionCount": 17
          },
          "adaptiveV9": {
            "totalCost": 409500,
            "incrementalCost": 309400,
            "revisionCount": 17
          },
          "highsV8": {
            "totalCost": 409500,
            "incrementalCost": 309400,
            "revisionCount": 123
          },
          "stableHiGHSV10": {
            "totalCost": 427700,
            "incrementalCost": 327600,
            "revisionCount": 56
          },
          "commitmentHiGHSV11": {
            "totalCost": 427700,
            "incrementalCost": 327600,
            "revisionCount": 62
          },
          "seededHiGHSV12": {
            "totalCost": 427700,
            "incrementalCost": 327600,
            "revisionCount": 62
          },
          "guardedHiGHSV13": {
            "totalCost": 518700,
            "incrementalCost": 418600,
            "revisionCount": 101
          }
        }
      },
      {
        "scenarioId": "v14-stress-batch-release-balanced-n50-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 800800,
            "incrementalCost": 682500,
            "revisionCount": 21
          },
          "adaptiveV9": {
            "totalCost": 800800,
            "incrementalCost": 682500,
            "revisionCount": 21
          },
          "highsV8": {
            "totalCost": 791700,
            "incrementalCost": 673400,
            "revisionCount": 327
          },
          "stableHiGHSV10": {
            "totalCost": 800800,
            "incrementalCost": 682500,
            "revisionCount": 75
          },
          "commitmentHiGHSV11": {
            "totalCost": 800800,
            "incrementalCost": 682500,
            "revisionCount": 85
          },
          "seededHiGHSV12": {
            "totalCost": 800800,
            "incrementalCost": 682500,
            "revisionCount": 85
          },
          "guardedHiGHSV13": {
            "totalCost": 1549700,
            "incrementalCost": 1431400,
            "revisionCount": 93
          }
        }
      },
      {
        "scenarioId": "v14-stress-batch-release-balanced-n50-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 591500,
            "incrementalCost": 491400,
            "revisionCount": 41
          },
          "adaptiveV9": {
            "totalCost": 591500,
            "incrementalCost": 491400,
            "revisionCount": 41
          },
          "highsV8": {
            "totalCost": 582400,
            "incrementalCost": 482300,
            "revisionCount": 322
          },
          "stableHiGHSV10": {
            "totalCost": 582400,
            "incrementalCost": 482300,
            "revisionCount": 106
          },
          "commitmentHiGHSV11": {
            "totalCost": 582400,
            "incrementalCost": 482300,
            "revisionCount": 142
          },
          "seededHiGHSV12": {
            "totalCost": 582400,
            "incrementalCost": 482300,
            "revisionCount": 142
          },
          "guardedHiGHSV13": {
            "totalCost": 709800,
            "incrementalCost": 609700,
            "revisionCount": 172
          }
        }
      },
      {
        "scenarioId": "v14-stress-batch-release-balanced-n100-r1",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1422300,
            "incrementalCost": 1267600,
            "revisionCount": 31
          },
          "adaptiveV9": {
            "totalCost": 1422300,
            "incrementalCost": 1267600,
            "revisionCount": 31
          },
          "highsV8": {
            "totalCost": 1431400,
            "incrementalCost": 1276700,
            "revisionCount": 588
          },
          "stableHiGHSV10": {
            "totalCost": 1431400,
            "incrementalCost": 1276700,
            "revisionCount": 123
          },
          "commitmentHiGHSV11": {
            "totalCost": 1440500,
            "incrementalCost": 1285800,
            "revisionCount": 282
          },
          "seededHiGHSV12": {
            "totalCost": 1440500,
            "incrementalCost": 1285800,
            "revisionCount": 282
          },
          "guardedHiGHSV13": {
            "totalCost": 1440500,
            "incrementalCost": 1285800,
            "revisionCount": 282
          }
        }
      },
      {
        "scenarioId": "v14-stress-batch-release-balanced-n100-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1201200,
            "incrementalCost": 1010100,
            "revisionCount": 0
          },
          "adaptiveV9": {
            "totalCost": 1201200,
            "incrementalCost": 1010100,
            "revisionCount": 0
          },
          "highsV8": {
            "totalCost": 1201200,
            "incrementalCost": 1010100,
            "revisionCount": 591
          },
          "stableHiGHSV10": {
            "totalCost": 1201200,
            "incrementalCost": 1010100,
            "revisionCount": 0
          },
          "commitmentHiGHSV11": {
            "totalCost": 1201200,
            "incrementalCost": 1010100,
            "revisionCount": 182
          },
          "seededHiGHSV12": {
            "totalCost": 1201200,
            "incrementalCost": 1010100,
            "revisionCount": 182
          },
          "guardedHiGHSV13": {
            "totalCost": 1201200,
            "incrementalCost": 1010100,
            "revisionCount": 182
          }
        }
      },
      {
        "scenarioId": "v14-stress-batch-release-balanced-n100-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1183000,
            "incrementalCost": 1028300,
            "revisionCount": 56
          },
          "adaptiveV9": {
            "totalCost": 1183000,
            "incrementalCost": 1028300,
            "revisionCount": 56
          },
          "highsV8": {
            "totalCost": 1183000,
            "incrementalCost": 1028300,
            "revisionCount": 603
          },
          "stableHiGHSV10": {
            "totalCost": 1183000,
            "incrementalCost": 1028300,
            "revisionCount": 247
          },
          "commitmentHiGHSV11": {
            "totalCost": 1183000,
            "incrementalCost": 1028300,
            "revisionCount": 309
          },
          "seededHiGHSV12": {
            "totalCost": 1183000,
            "incrementalCost": 1028300,
            "revisionCount": 309
          },
          "guardedHiGHSV13": {
            "totalCost": 1689400,
            "incrementalCost": 1534700,
            "revisionCount": 341
          }
        }
      },
      {
        "scenarioId": "v14-stress-batch-release-tight-n50-r1",
        "pairedRepeatCount": 2,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1088800,
            "incrementalCost": 1043300,
            "revisionCount": 108
          },
          "adaptiveV9": {
            "totalCost": 1093350,
            "incrementalCost": 1047850,
            "revisionCount": 111.5
          },
          "highsV8": {
            "totalCost": 1179800,
            "incrementalCost": 1134300,
            "revisionCount": 298
          },
          "stableHiGHSV10": {
            "totalCost": 1188900,
            "incrementalCost": 1143400,
            "revisionCount": 126
          },
          "commitmentHiGHSV11": {
            "totalCost": 1188900,
            "incrementalCost": 1143400,
            "revisionCount": 126
          },
          "seededHiGHSV12": {
            "totalCost": 1188900,
            "incrementalCost": 1143400,
            "revisionCount": 126
          },
          "guardedHiGHSV13": {
            "totalCost": 1188900,
            "incrementalCost": 1143400,
            "revisionCount": 126
          }
        }
      },
      {
        "scenarioId": "v14-stress-batch-release-tight-n50-r2",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 882200,
            "incrementalCost": 827600,
            "revisionCount": 133
          },
          "adaptiveV9": {
            "totalCost": 882200,
            "incrementalCost": 827600,
            "revisionCount": 133
          },
          "highsV8": {
            "totalCost": 715700,
            "incrementalCost": 661100,
            "revisionCount": 268
          },
          "stableHiGHSV10": {
            "totalCost": 715700,
            "incrementalCost": 661100,
            "revisionCount": 101
          },
          "commitmentHiGHSV11": {
            "totalCost": 715700,
            "incrementalCost": 661100,
            "revisionCount": 101
          },
          "seededHiGHSV12": {
            "totalCost": 715700,
            "incrementalCost": 661100,
            "revisionCount": 101
          },
          "guardedHiGHSV13": {
            "totalCost": 748900,
            "incrementalCost": 694300,
            "revisionCount": 238
          }
        }
      },
      {
        "scenarioId": "v14-stress-batch-release-tight-n50-r3",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1142400,
            "incrementalCost": 1106000,
            "revisionCount": 158
          },
          "adaptiveV9": {
            "totalCost": 1076900,
            "incrementalCost": 1040500,
            "revisionCount": 159.66666666666666
          },
          "highsV8": {
            "totalCost": 670200,
            "incrementalCost": 633800,
            "revisionCount": 348
          },
          "stableHiGHSV10": {
            "totalCost": 670200,
            "incrementalCost": 633800,
            "revisionCount": 124
          },
          "commitmentHiGHSV11": {
            "totalCost": 670200,
            "incrementalCost": 633800,
            "revisionCount": 124
          },
          "seededHiGHSV12": {
            "totalCost": 670200,
            "incrementalCost": 633800,
            "revisionCount": 124
          },
          "guardedHiGHSV13": {
            "totalCost": 670200,
            "incrementalCost": 633800,
            "revisionCount": 124
          }
        }
      },
      {
        "scenarioId": "v14-stress-batch-release-tight-n50-r4",
        "pairedRepeatCount": 3,
        "byMethod": {
          "costPolishV7": {
            "totalCost": 1501000,
            "incrementalCost": 1391800,
            "revisionCount": 115
          },
          "adaptiveV9": {
            "totalCost": 1437300,
            "incrementalCost": 1328100,
            "revisionCount": 119
          },
          "highsV8": {
            "totalCost": 1046500,
            "incrementalCost": 937300,
            "revisionCount": 351
          },
          "stableHiGHSV10": {
            "totalCost": 1046500,
            "incrementalCost": 937300,
            "revisionCount": 172
          },
          "commitmentHiGHSV11": {
            "totalCost": 1046500,
            "incrementalCost": 937300,
            "revisionCount": 172
          },
          "seededHiGHSV12": {
            "totalCost": 1046500,
            "incrementalCost": 937300,
            "revisionCount": 172
          },
          "guardedHiGHSV13": {
            "totalCost": 1685700,
            "incrementalCost": 1576500,
            "revisionCount": 189
          }
        }
      }
    ],
    "scope": "Conditional all-seven jointly completed matching repeats; average within scenario then equal scenario weight. No revision-to-KRW conversion. This table never overrides full-sample completion losses or establishes universal dominance."
  },
  "observedDecisionGates": {
    "candidateMethod": "guardedHiGHSV13",
    "assessmentState": "complete-panel",
    "completionLossCountsByBaseline": {
      "seededHiGHSV12": 5,
      "commitmentHiGHSV11": 4,
      "stableHiGHSV10": 4,
      "adaptiveV9": 0,
      "highsV8": 4,
      "costPolishV7": 0
    },
    "completionGainCountsByBaseline": {
      "seededHiGHSV12": 3,
      "commitmentHiGHSV11": 10,
      "stableHiGHSV10": 11,
      "adaptiveV9": 38,
      "highsV8": 12,
      "costPolishV7": 37
    },
    "completionNonRegressionAllBaselines": false,
    "defaultRecommendationEligible": false,
    "nativeComparison": {
      "lostEpisodeCount": 4,
      "revisionPairedEpisodeCount": 112,
      "revisionDelta": -20429,
      "strictRevisionReduction": true,
      "incrementalFeeClaim": "conditional_deterioration_interval_negative",
      "totalFeeClaim": "conditional_deterioration_interval_negative",
      "noRobustFeeDeterioration": false,
      "stabilityImprovementClaimAllowed": false
    },
    "nativeComparisons": {
      "seededHiGHSV12": {
        "lostEpisodeCount": 5,
        "revisionPairedEpisodeCount": 121,
        "revisionDelta": 3744,
        "strictRevisionReduction": false,
        "incrementalFeeClaim": "conditional_deterioration_interval_negative",
        "totalFeeClaim": "conditional_deterioration_interval_negative",
        "noRobustFeeDeterioration": false,
        "stabilityImprovementClaimAllowed": false
      },
      "commitmentHiGHSV11": {
        "lostEpisodeCount": 4,
        "revisionPairedEpisodeCount": 114,
        "revisionDelta": 3346,
        "strictRevisionReduction": false,
        "incrementalFeeClaim": "conditional_deterioration_interval_negative",
        "totalFeeClaim": "conditional_deterioration_interval_negative",
        "noRobustFeeDeterioration": false,
        "stabilityImprovementClaimAllowed": false
      },
      "stableHiGHSV10": {
        "lostEpisodeCount": 4,
        "revisionPairedEpisodeCount": 113,
        "revisionDelta": 5688,
        "strictRevisionReduction": false,
        "incrementalFeeClaim": "conditional_deterioration_interval_negative",
        "totalFeeClaim": "conditional_deterioration_interval_negative",
        "noRobustFeeDeterioration": false,
        "stabilityImprovementClaimAllowed": false
      },
      "highsV8": {
        "lostEpisodeCount": 4,
        "revisionPairedEpisodeCount": 112,
        "revisionDelta": -20429,
        "strictRevisionReduction": true,
        "incrementalFeeClaim": "conditional_deterioration_interval_negative",
        "totalFeeClaim": "conditional_deterioration_interval_negative",
        "noRobustFeeDeterioration": false,
        "stabilityImprovementClaimAllowed": false
      }
    },
    "scope": "Observed necessary gates against the six included comparators only. Any full-sample completion loss blocks default eligibility; net gains and conditional fees/Pareto position do not offset losses. Native stability claims use each exact native paired set; zero-inclusive fee intervals do not prove stable savings. No claim against omitted V5 or universal/production recommendation."
  }
}
```

## 全部负例 / 전체 불리한 식별자 부록

Membership is re-derived from all formal scalar receipts. Repeated IDs across comparisons are occurrences, not independent cases. Empty sets are explicitly [].

### same-distribution / v13VsV12

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-new-arrivals-tight-n100-r4",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r2",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r1",
    "v14-same-distribution-batch-release-tight-n100-r2",
    "v14-same-distribution-batch-release-tight-n100-r3",
    "v14-same-distribution-batch-release-tight-n100-r4"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-new-arrivals-tight-n100-r4",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r2",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r1",
    "v14-same-distribution-batch-release-tight-n100-r2",
    "v14-same-distribution-batch-release-tight-n100-r3",
    "v14-same-distribution-batch-release-tight-n100-r4"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-tight-n100-r1",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-new-arrivals-tight-n100-r4",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r2",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-3"
  ]
}
```

### same-distribution / v13VsV11

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r2",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r1",
    "v14-same-distribution-batch-release-tight-n100-r4"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r2",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r1",
    "v14-same-distribution-batch-release-tight-n100-r4"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-balanced-n24-r1",
    "v14-same-distribution-new-arrivals-balanced-n24-r2",
    "v14-same-distribution-new-arrivals-balanced-n100-r1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3",
    "v14-same-distribution-new-arrivals-tight-n50-r4",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r2",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-3"
  ]
}
```

### same-distribution / v13VsV10

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r2",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r1",
    "v14-same-distribution-batch-release-tight-n100-r4"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r2",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r1",
    "v14-same-distribution-batch-release-tight-n100-r4"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-balanced-n24-r1",
    "v14-same-distribution-new-arrivals-balanced-n24-r2",
    "v14-same-distribution-new-arrivals-balanced-n50-r2",
    "v14-same-distribution-new-arrivals-balanced-n100-r1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-new-arrivals-tight-n24-r3",
    "v14-same-distribution-new-arrivals-tight-n50-r2",
    "v14-same-distribution-new-arrivals-tight-n50-r4",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-batch-release-balanced-n24-r2",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r1",
    "v14-same-distribution-batch-release-balanced-n50-r2",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r1",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r2",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r1",
    "v14-same-distribution-batch-release-tight-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n50-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n50-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n50-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r3::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r3::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r3::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n50-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n50-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n50-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-3"
  ]
}
```

### same-distribution / v13VsV9

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-new-arrivals-tight-n100-r4",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r3"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-new-arrivals-tight-n100-r4",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r3"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-balanced-n24-r1",
    "v14-same-distribution-new-arrivals-balanced-n24-r3",
    "v14-same-distribution-new-arrivals-balanced-n24-r4",
    "v14-same-distribution-new-arrivals-balanced-n50-r1",
    "v14-same-distribution-new-arrivals-balanced-n100-r1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3",
    "v14-same-distribution-new-arrivals-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-new-arrivals-tight-n100-r4",
    "v14-same-distribution-batch-release-balanced-n24-r2",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r1",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r1",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n24-r1",
    "v14-same-distribution-batch-release-tight-n50-r1",
    "v14-same-distribution-batch-release-tight-n50-r2",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r1",
    "v14-same-distribution-batch-release-tight-n100-r2",
    "v14-same-distribution-batch-release-tight-n100-r3",
    "v14-same-distribution-batch-release-tight-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-3"
  ]
}
```

### same-distribution / v13VsHiGHS

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-aged-backlog-tight-n50-r3",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r2",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r1",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r1",
    "v14-same-distribution-batch-release-tight-n100-r4"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-aged-backlog-tight-n50-r3",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r2",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r1",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r1",
    "v14-same-distribution-batch-release-tight-n100-r4"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r1"
  ],
  "revisionWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3"
  ]
}
```

### same-distribution / v13VsV7

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-new-arrivals-tight-n100-r4",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r3"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-new-arrivals-tight-n100-r4",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r3"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-balanced-n24-r1",
    "v14-same-distribution-new-arrivals-balanced-n24-r3",
    "v14-same-distribution-new-arrivals-balanced-n24-r4",
    "v14-same-distribution-new-arrivals-balanced-n50-r1",
    "v14-same-distribution-new-arrivals-balanced-n100-r1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3",
    "v14-same-distribution-new-arrivals-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-new-arrivals-tight-n100-r4",
    "v14-same-distribution-batch-release-balanced-n24-r2",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r1",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r1",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n24-r1",
    "v14-same-distribution-batch-release-tight-n50-r1",
    "v14-same-distribution-batch-release-tight-n50-r2",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r1",
    "v14-same-distribution-batch-release-tight-n100-r2",
    "v14-same-distribution-batch-release-tight-n100-r3",
    "v14-same-distribution-batch-release-tight-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-3"
  ]
}
```

### same-distribution / v12VsV11

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [],
  "totalFeeWorseEpisodeIds": [],
  "incrementalFeeWorseScenarioIds": [],
  "incrementalFeeWorseEpisodeIds": [],
  "revisionWorseScenarioIds": [
    "v14-same-distribution-new-arrivals-balanced-n24-r1",
    "v14-same-distribution-new-arrivals-balanced-n24-r2",
    "v14-same-distribution-new-arrivals-balanced-n100-r1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3",
    "v14-same-distribution-new-arrivals-tight-n50-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-3"
  ]
}
```

### same-distribution / v12VsV10

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-new-arrivals-balanced-n24-r1",
    "v14-same-distribution-new-arrivals-balanced-n24-r2",
    "v14-same-distribution-new-arrivals-balanced-n50-r2",
    "v14-same-distribution-new-arrivals-balanced-n100-r1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-new-arrivals-tight-n24-r3",
    "v14-same-distribution-new-arrivals-tight-n50-r2",
    "v14-same-distribution-new-arrivals-tight-n50-r4",
    "v14-same-distribution-batch-release-balanced-n24-r2",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r1",
    "v14-same-distribution-batch-release-balanced-n50-r2",
    "v14-same-distribution-batch-release-balanced-n100-r1",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-tight-n50-r2",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n100-r1"
  ],
  "revisionWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n50-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n50-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n50-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r3::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r3::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r3::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n50-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n50-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n50-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3"
  ]
}
```

### same-distribution / v12VsV9

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-same-distribution-new-arrivals-tight-n24-r1"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-same-distribution-new-arrivals-tight-n24-r1"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-balanced-n24-r1",
    "v14-same-distribution-new-arrivals-balanced-n24-r3",
    "v14-same-distribution-new-arrivals-balanced-n24-r4",
    "v14-same-distribution-new-arrivals-balanced-n50-r1",
    "v14-same-distribution-new-arrivals-balanced-n100-r1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3",
    "v14-same-distribution-new-arrivals-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-new-arrivals-tight-n50-r1",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-new-arrivals-tight-n100-r4",
    "v14-same-distribution-batch-release-balanced-n24-r2",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r1",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r1",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n24-r1",
    "v14-same-distribution-batch-release-tight-n50-r1",
    "v14-same-distribution-batch-release-tight-n50-r2",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r1",
    "v14-same-distribution-batch-release-tight-n100-r2",
    "v14-same-distribution-batch-release-tight-n100-r3"
  ],
  "revisionWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n50-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n50-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n50-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-3"
  ]
}
```

### same-distribution / v12VsHiGHS

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-aged-backlog-tight-n50-r3",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-tight-n50-r1",
    "v14-same-distribution-batch-release-tight-n100-r1"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-aged-backlog-tight-n50-r3",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-tight-n50-r1",
    "v14-same-distribution-batch-release-tight-n100-r1"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3"
  ],
  "revisionWorseScenarioIds": [],
  "revisionWorseEpisodeIds": []
}
```

### same-distribution / v12VsV7

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-same-distribution-new-arrivals-tight-n24-r1"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-same-distribution-new-arrivals-tight-n24-r1"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-balanced-n24-r1",
    "v14-same-distribution-new-arrivals-balanced-n24-r3",
    "v14-same-distribution-new-arrivals-balanced-n24-r4",
    "v14-same-distribution-new-arrivals-balanced-n50-r1",
    "v14-same-distribution-new-arrivals-balanced-n100-r1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3",
    "v14-same-distribution-new-arrivals-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-new-arrivals-tight-n50-r1",
    "v14-same-distribution-new-arrivals-tight-n100-r2",
    "v14-same-distribution-new-arrivals-tight-n100-r4",
    "v14-same-distribution-batch-release-balanced-n24-r2",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r1",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r1",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n24-r1",
    "v14-same-distribution-batch-release-tight-n50-r1",
    "v14-same-distribution-batch-release-tight-n50-r2",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r1",
    "v14-same-distribution-batch-release-tight-n100-r2",
    "v14-same-distribution-batch-release-tight-n100-r3"
  ],
  "revisionWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n50-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n50-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n50-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-3"
  ]
}
```

### same-distribution / v11VsV10

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-new-arrivals-balanced-n24-r1",
    "v14-same-distribution-new-arrivals-balanced-n50-r2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3",
    "v14-same-distribution-new-arrivals-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-new-arrivals-tight-n24-r3",
    "v14-same-distribution-new-arrivals-tight-n50-r2",
    "v14-same-distribution-new-arrivals-tight-n50-r4",
    "v14-same-distribution-batch-release-balanced-n24-r2",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r1",
    "v14-same-distribution-batch-release-balanced-n50-r2",
    "v14-same-distribution-batch-release-balanced-n100-r1",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-tight-n50-r2",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n100-r1"
  ],
  "revisionWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n50-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n50-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n50-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r3::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r3::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r3::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n50-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n50-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n50-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3"
  ]
}
```

### same-distribution / v10VsHiGHS

```json
{
  "completionLostEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r2::repeat-3"
  ],
  "totalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-aged-backlog-tight-n50-r3",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-tight-n50-r1",
    "v14-same-distribution-batch-release-tight-n100-r1"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-aged-backlog-tight-n50-r3",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-tight-n50-r1",
    "v14-same-distribution-batch-release-tight-n100-r1"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-tight-n50-r3::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3"
  ],
  "revisionWorseScenarioIds": [],
  "revisionWorseEpisodeIds": []
}
```

### same-distribution / highsVsV7

```json
{
  "completionLostEpisodeIds": [
    "v14-same-distribution-new-arrivals-tight-n50-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n50-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n50-r1::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r3::repeat-3"
  ],
  "totalFeeWorseScenarioIds": [],
  "totalFeeWorseEpisodeIds": [],
  "incrementalFeeWorseScenarioIds": [],
  "incrementalFeeWorseEpisodeIds": [],
  "revisionWorseScenarioIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3",
    "v14-same-distribution-aged-backlog-balanced-n24-r4",
    "v14-same-distribution-aged-backlog-balanced-n50-r1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4",
    "v14-same-distribution-aged-backlog-balanced-n100-r2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-balanced-n24-r1",
    "v14-same-distribution-new-arrivals-balanced-n24-r3",
    "v14-same-distribution-new-arrivals-balanced-n24-r4",
    "v14-same-distribution-new-arrivals-balanced-n50-r1",
    "v14-same-distribution-new-arrivals-balanced-n50-r3",
    "v14-same-distribution-new-arrivals-balanced-n50-r4",
    "v14-same-distribution-new-arrivals-balanced-n100-r1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3",
    "v14-same-distribution-new-arrivals-balanced-n100-r4",
    "v14-same-distribution-new-arrivals-tight-n24-r1",
    "v14-same-distribution-batch-release-balanced-n24-r1",
    "v14-same-distribution-batch-release-balanced-n24-r2",
    "v14-same-distribution-batch-release-balanced-n24-r3",
    "v14-same-distribution-batch-release-balanced-n24-r4",
    "v14-same-distribution-batch-release-balanced-n50-r1",
    "v14-same-distribution-batch-release-balanced-n50-r3",
    "v14-same-distribution-batch-release-balanced-n50-r4",
    "v14-same-distribution-batch-release-balanced-n100-r1",
    "v14-same-distribution-batch-release-balanced-n100-r2",
    "v14-same-distribution-batch-release-balanced-n100-r3",
    "v14-same-distribution-batch-release-balanced-n100-r4",
    "v14-same-distribution-batch-release-tight-n24-r1",
    "v14-same-distribution-batch-release-tight-n24-r3",
    "v14-same-distribution-batch-release-tight-n50-r1",
    "v14-same-distribution-batch-release-tight-n50-r2",
    "v14-same-distribution-batch-release-tight-n50-r3",
    "v14-same-distribution-batch-release-tight-n50-r4",
    "v14-same-distribution-batch-release-tight-n100-r1",
    "v14-same-distribution-batch-release-tight-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-same-distribution-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r2::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-same-distribution-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r3::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n50-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n50-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n50-r3::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n50-r4::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n50-r4::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n50-r4::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r2::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-1",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-2",
    "v14-same-distribution-new-arrivals-balanced-n100-r4::repeat-3",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-1",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-2",
    "v14-same-distribution-new-arrivals-tight-n24-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n24-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r2::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r3::repeat-3",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-balanced-n100-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n24-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n24-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n24-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n24-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r2::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-2",
    "v14-same-distribution-batch-release-tight-n50-r3::repeat-3",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n50-r4::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r1::repeat-3",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-1",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-2",
    "v14-same-distribution-batch-release-tight-n100-r4::repeat-3"
  ]
}
```

### stress / v13VsV12

```json
{
  "completionLostEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-stress-new-arrivals-tight-n100-r3::repeat-1",
    "v14-stress-new-arrivals-tight-n100-r4::repeat-1"
  ],
  "totalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-new-arrivals-balanced-n24-r4",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r2",
    "v14-stress-batch-release-balanced-n50-r3",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r2",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r2",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r2::repeat-1",
    "v14-stress-batch-release-balanced-n50-r2::repeat-2",
    "v14-stress-batch-release-balanced-n50-r2::repeat-3",
    "v14-stress-batch-release-balanced-n50-r3::repeat-1",
    "v14-stress-batch-release-balanced-n50-r3::repeat-2",
    "v14-stress-batch-release-balanced-n50-r3::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r2::repeat-1",
    "v14-stress-batch-release-balanced-n100-r2::repeat-2",
    "v14-stress-batch-release-balanced-n100-r2::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r2::repeat-1",
    "v14-stress-batch-release-tight-n50-r2::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-1",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-new-arrivals-balanced-n24-r4",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r2",
    "v14-stress-batch-release-balanced-n50-r3",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r2",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r2",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r2::repeat-1",
    "v14-stress-batch-release-balanced-n50-r2::repeat-2",
    "v14-stress-batch-release-balanced-n50-r2::repeat-3",
    "v14-stress-batch-release-balanced-n50-r3::repeat-1",
    "v14-stress-batch-release-balanced-n50-r3::repeat-2",
    "v14-stress-batch-release-balanced-n50-r3::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r2::repeat-1",
    "v14-stress-batch-release-balanced-n100-r2::repeat-2",
    "v14-stress-batch-release-balanced-n100-r2::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r2::repeat-1",
    "v14-stress-batch-release-tight-n50-r2::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-1",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-new-arrivals-balanced-n24-r4",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-new-arrivals-balanced-n100-r2",
    "v14-stress-batch-release-balanced-n24-r3",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r2",
    "v14-stress-batch-release-balanced-n50-r3",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r2",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r2",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r2::repeat-1",
    "v14-stress-batch-release-balanced-n24-r3::repeat-1",
    "v14-stress-batch-release-balanced-n24-r3::repeat-2",
    "v14-stress-batch-release-balanced-n24-r3::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r2::repeat-1",
    "v14-stress-batch-release-balanced-n50-r2::repeat-2",
    "v14-stress-batch-release-balanced-n50-r2::repeat-3",
    "v14-stress-batch-release-balanced-n50-r3::repeat-1",
    "v14-stress-batch-release-balanced-n50-r3::repeat-2",
    "v14-stress-batch-release-balanced-n50-r3::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r2::repeat-1",
    "v14-stress-batch-release-balanced-n100-r2::repeat-2",
    "v14-stress-batch-release-balanced-n100-r2::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r2::repeat-1",
    "v14-stress-batch-release-tight-n50-r2::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-1",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ]
}
```

### stress / v13VsV11

```json
{
  "completionLostEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-stress-new-arrivals-tight-n100-r4::repeat-1"
  ],
  "totalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-new-arrivals-balanced-n24-r4",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r2",
    "v14-stress-batch-release-balanced-n50-r3",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r2",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r2",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r2::repeat-1",
    "v14-stress-batch-release-balanced-n50-r2::repeat-2",
    "v14-stress-batch-release-balanced-n50-r2::repeat-3",
    "v14-stress-batch-release-balanced-n50-r3::repeat-1",
    "v14-stress-batch-release-balanced-n50-r3::repeat-2",
    "v14-stress-batch-release-balanced-n50-r3::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r2::repeat-1",
    "v14-stress-batch-release-balanced-n100-r2::repeat-2",
    "v14-stress-batch-release-balanced-n100-r2::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r2::repeat-1",
    "v14-stress-batch-release-tight-n50-r2::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-new-arrivals-balanced-n24-r4",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r2",
    "v14-stress-batch-release-balanced-n50-r3",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r2",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r2",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r2::repeat-1",
    "v14-stress-batch-release-balanced-n50-r2::repeat-2",
    "v14-stress-batch-release-balanced-n50-r2::repeat-3",
    "v14-stress-batch-release-balanced-n50-r3::repeat-1",
    "v14-stress-batch-release-balanced-n50-r3::repeat-2",
    "v14-stress-batch-release-balanced-n50-r3::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r2::repeat-1",
    "v14-stress-batch-release-balanced-n100-r2::repeat-2",
    "v14-stress-batch-release-balanced-n100-r2::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r2::repeat-1",
    "v14-stress-batch-release-tight-n50-r2::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-new-arrivals-balanced-n24-r3",
    "v14-stress-new-arrivals-balanced-n24-r4",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n50-r4",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-new-arrivals-balanced-n100-r3",
    "v14-stress-new-arrivals-balanced-n100-r4",
    "v14-stress-batch-release-balanced-n24-r3",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r2",
    "v14-stress-batch-release-balanced-n50-r3",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r2",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r2",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-balanced-n24-r3::repeat-1",
    "v14-stress-batch-release-balanced-n24-r3::repeat-2",
    "v14-stress-batch-release-balanced-n24-r3::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r2::repeat-1",
    "v14-stress-batch-release-balanced-n50-r2::repeat-2",
    "v14-stress-batch-release-balanced-n50-r2::repeat-3",
    "v14-stress-batch-release-balanced-n50-r3::repeat-1",
    "v14-stress-batch-release-balanced-n50-r3::repeat-2",
    "v14-stress-batch-release-balanced-n50-r3::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r2::repeat-1",
    "v14-stress-batch-release-balanced-n100-r2::repeat-2",
    "v14-stress-batch-release-balanced-n100-r2::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r2::repeat-1",
    "v14-stress-batch-release-tight-n50-r2::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ]
}
```

### stress / v13VsV10

```json
{
  "completionLostEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n50-r2::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r2::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r2::repeat-3",
    "v14-stress-new-arrivals-tight-n100-r4::repeat-1"
  ],
  "totalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-new-arrivals-balanced-n24-r4",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r2",
    "v14-stress-batch-release-balanced-n50-r3",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r2",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r2",
    "v14-stress-batch-release-tight-n50-r4"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r2::repeat-1",
    "v14-stress-batch-release-balanced-n50-r2::repeat-2",
    "v14-stress-batch-release-balanced-n50-r2::repeat-3",
    "v14-stress-batch-release-balanced-n50-r3::repeat-1",
    "v14-stress-batch-release-balanced-n50-r3::repeat-2",
    "v14-stress-batch-release-balanced-n50-r3::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r2::repeat-1",
    "v14-stress-batch-release-balanced-n100-r2::repeat-2",
    "v14-stress-batch-release-balanced-n100-r2::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r2::repeat-1",
    "v14-stress-batch-release-tight-n50-r2::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-new-arrivals-balanced-n24-r4",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r2",
    "v14-stress-batch-release-balanced-n50-r3",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r2",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r2",
    "v14-stress-batch-release-tight-n50-r4"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r2::repeat-1",
    "v14-stress-batch-release-balanced-n50-r2::repeat-2",
    "v14-stress-batch-release-balanced-n50-r2::repeat-3",
    "v14-stress-batch-release-balanced-n50-r3::repeat-1",
    "v14-stress-batch-release-balanced-n50-r3::repeat-2",
    "v14-stress-batch-release-balanced-n50-r3::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r2::repeat-1",
    "v14-stress-batch-release-balanced-n100-r2::repeat-2",
    "v14-stress-batch-release-balanced-n100-r2::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r2::repeat-1",
    "v14-stress-batch-release-tight-n50-r2::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-new-arrivals-balanced-n24-r3",
    "v14-stress-new-arrivals-balanced-n24-r4",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n50-r4",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-new-arrivals-balanced-n100-r3",
    "v14-stress-batch-release-balanced-n24-r1",
    "v14-stress-batch-release-balanced-n24-r3",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r2",
    "v14-stress-batch-release-balanced-n50-r3",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r2",
    "v14-stress-batch-release-balanced-n100-r3",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r2",
    "v14-stress-batch-release-tight-n50-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r2::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-balanced-n24-r1::repeat-1",
    "v14-stress-batch-release-balanced-n24-r1::repeat-2",
    "v14-stress-batch-release-balanced-n24-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r3::repeat-1",
    "v14-stress-batch-release-balanced-n24-r3::repeat-2",
    "v14-stress-batch-release-balanced-n24-r3::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r2::repeat-1",
    "v14-stress-batch-release-balanced-n50-r2::repeat-2",
    "v14-stress-batch-release-balanced-n50-r2::repeat-3",
    "v14-stress-batch-release-balanced-n50-r3::repeat-1",
    "v14-stress-batch-release-balanced-n50-r3::repeat-2",
    "v14-stress-batch-release-balanced-n50-r3::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r2::repeat-1",
    "v14-stress-batch-release-balanced-n100-r2::repeat-2",
    "v14-stress-batch-release-balanced-n100-r2::repeat-3",
    "v14-stress-batch-release-balanced-n100-r3::repeat-1",
    "v14-stress-batch-release-balanced-n100-r3::repeat-2",
    "v14-stress-batch-release-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r2::repeat-1",
    "v14-stress-batch-release-tight-n50-r2::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3"
  ]
}
```

### stress / v13VsV9

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r1",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-1",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r1",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-1",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r2",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-new-arrivals-balanced-n24-r1",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n50-r4",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-new-arrivals-balanced-n100-r4",
    "v14-stress-new-arrivals-tight-n50-r4",
    "v14-stress-batch-release-balanced-n24-r1",
    "v14-stress-batch-release-balanced-n24-r3",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r3",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r1",
    "v14-stress-batch-release-tight-n50-r2",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-1",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-2",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n24-r1::repeat-1",
    "v14-stress-batch-release-balanced-n24-r1::repeat-2",
    "v14-stress-batch-release-balanced-n24-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r3::repeat-1",
    "v14-stress-batch-release-balanced-n24-r3::repeat-2",
    "v14-stress-batch-release-balanced-n24-r3::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r3::repeat-1",
    "v14-stress-batch-release-balanced-n100-r3::repeat-2",
    "v14-stress-batch-release-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-1",
    "v14-stress-batch-release-tight-n50-r2::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-1",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ]
}
```

### stress / v13VsHiGHS

```json
{
  "completionLostEpisodeIds": [
    "v14-stress-new-arrivals-tight-n50-r1::repeat-1",
    "v14-stress-new-arrivals-tight-n50-r1::repeat-2",
    "v14-stress-new-arrivals-tight-n50-r1::repeat-3",
    "v14-stress-new-arrivals-tight-n100-r4::repeat-1"
  ],
  "totalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-new-arrivals-balanced-n24-r4",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n24-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r2",
    "v14-stress-batch-release-balanced-n50-r3",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r2",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r1",
    "v14-stress-batch-release-tight-n50-r2",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r1::repeat-1",
    "v14-stress-batch-release-balanced-n24-r1::repeat-2",
    "v14-stress-batch-release-balanced-n24-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r2::repeat-1",
    "v14-stress-batch-release-balanced-n50-r2::repeat-2",
    "v14-stress-batch-release-balanced-n50-r2::repeat-3",
    "v14-stress-batch-release-balanced-n50-r3::repeat-1",
    "v14-stress-batch-release-balanced-n50-r3::repeat-2",
    "v14-stress-batch-release-balanced-n50-r3::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r2::repeat-1",
    "v14-stress-batch-release-balanced-n100-r2::repeat-2",
    "v14-stress-batch-release-balanced-n100-r2::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r2::repeat-1",
    "v14-stress-batch-release-tight-n50-r2::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-new-arrivals-balanced-n24-r4",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n24-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r2",
    "v14-stress-batch-release-balanced-n50-r3",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r2",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r1",
    "v14-stress-batch-release-tight-n50-r2",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r1::repeat-1",
    "v14-stress-batch-release-balanced-n24-r1::repeat-2",
    "v14-stress-batch-release-balanced-n24-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r2::repeat-1",
    "v14-stress-batch-release-balanced-n50-r2::repeat-2",
    "v14-stress-batch-release-balanced-n50-r2::repeat-3",
    "v14-stress-batch-release-balanced-n50-r3::repeat-1",
    "v14-stress-batch-release-balanced-n50-r3::repeat-2",
    "v14-stress-batch-release-balanced-n50-r3::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r2::repeat-1",
    "v14-stress-batch-release-balanced-n100-r2::repeat-2",
    "v14-stress-batch-release-balanced-n100-r2::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r2::repeat-1",
    "v14-stress-batch-release-tight-n50-r2::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3"
  ],
  "revisionWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3"
  ]
}
```

### stress / v13VsV7

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r1",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-1",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r1",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-1",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r2",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-new-arrivals-balanced-n24-r1",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n50-r4",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-new-arrivals-balanced-n100-r4",
    "v14-stress-new-arrivals-tight-n50-r4",
    "v14-stress-batch-release-balanced-n24-r1",
    "v14-stress-batch-release-balanced-n24-r3",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r3",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r1",
    "v14-stress-batch-release-tight-n50-r2",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-1",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-2",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n24-r1::repeat-1",
    "v14-stress-batch-release-balanced-n24-r1::repeat-2",
    "v14-stress-batch-release-balanced-n24-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r3::repeat-1",
    "v14-stress-batch-release-balanced-n24-r3::repeat-2",
    "v14-stress-batch-release-balanced-n24-r3::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r3::repeat-1",
    "v14-stress-batch-release-balanced-n100-r3::repeat-2",
    "v14-stress-batch-release-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r2::repeat-1",
    "v14-stress-batch-release-tight-n50-r2::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-1",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ]
}
```

### stress / v12VsV11

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-new-arrivals-balanced-n24-r3",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n50-r4",
    "v14-stress-new-arrivals-balanced-n100-r3",
    "v14-stress-new-arrivals-balanced-n100-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ]
}
```

### stress / v12VsV10

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-batch-release-balanced-n100-r1"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-batch-release-balanced-n100-r1"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-new-arrivals-balanced-n24-r3",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n50-r4",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-new-arrivals-balanced-n100-r3",
    "v14-stress-batch-release-balanced-n24-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r2",
    "v14-stress-batch-release-balanced-n50-r3",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r3",
    "v14-stress-batch-release-balanced-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-balanced-n24-r1::repeat-1",
    "v14-stress-batch-release-balanced-n24-r1::repeat-2",
    "v14-stress-batch-release-balanced-n24-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r2::repeat-1",
    "v14-stress-batch-release-balanced-n50-r2::repeat-2",
    "v14-stress-batch-release-balanced-n50-r2::repeat-3",
    "v14-stress-batch-release-balanced-n50-r3::repeat-1",
    "v14-stress-batch-release-balanced-n50-r3::repeat-2",
    "v14-stress-batch-release-balanced-n50-r3::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r3::repeat-1",
    "v14-stress-batch-release-balanced-n100-r3::repeat-2",
    "v14-stress-batch-release-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3"
  ]
}
```

### stress / v12VsV9

```json
{
  "completionLostEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-3"
  ],
  "totalFeeWorseScenarioIds": [
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-tight-n50-r1"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-tight-n50-r1"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2"
  ],
  "revisionWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-new-arrivals-balanced-n24-r1",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n50-r4",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-new-arrivals-balanced-n100-r4",
    "v14-stress-new-arrivals-tight-n50-r4",
    "v14-stress-batch-release-balanced-n24-r1",
    "v14-stress-batch-release-balanced-n24-r3",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r3",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r1",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-1",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-2",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n24-r1::repeat-1",
    "v14-stress-batch-release-balanced-n24-r1::repeat-2",
    "v14-stress-batch-release-balanced-n24-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r3::repeat-1",
    "v14-stress-batch-release-balanced-n24-r3::repeat-2",
    "v14-stress-batch-release-balanced-n24-r3::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r3::repeat-1",
    "v14-stress-batch-release-balanced-n100-r3::repeat-2",
    "v14-stress-batch-release-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-1",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ]
}
```

### stress / v12VsHiGHS

```json
{
  "completionLostEpisodeIds": [
    "v14-stress-new-arrivals-tight-n50-r1::repeat-1",
    "v14-stress-new-arrivals-tight-n50-r1::repeat-2",
    "v14-stress-new-arrivals-tight-n50-r1::repeat-3"
  ],
  "totalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-batch-release-balanced-n24-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-tight-n50-r1",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-balanced-n24-r1::repeat-1",
    "v14-stress-batch-release-balanced-n24-r1::repeat-2",
    "v14-stress-batch-release-balanced-n24-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-batch-release-balanced-n24-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-tight-n50-r1",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-balanced-n24-r1::repeat-1",
    "v14-stress-batch-release-balanced-n24-r1::repeat-2",
    "v14-stress-batch-release-balanced-n24-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n100-r3"
  ],
  "revisionWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3"
  ]
}
```

### stress / v12VsV7

```json
{
  "completionLostEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-3"
  ],
  "totalFeeWorseScenarioIds": [
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-tight-n50-r1"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-tight-n50-r1"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n100-r3",
    "v14-stress-new-arrivals-balanced-n24-r1",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n50-r4",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-new-arrivals-balanced-n100-r4",
    "v14-stress-new-arrivals-tight-n50-r4",
    "v14-stress-batch-release-balanced-n24-r1",
    "v14-stress-batch-release-balanced-n24-r3",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r3",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r1",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-1",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-2",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n24-r1::repeat-1",
    "v14-stress-batch-release-balanced-n24-r1::repeat-2",
    "v14-stress-batch-release-balanced-n24-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r3::repeat-1",
    "v14-stress-batch-release-balanced-n24-r3::repeat-2",
    "v14-stress-batch-release-balanced-n24-r3::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r3::repeat-1",
    "v14-stress-batch-release-balanced-n100-r3::repeat-2",
    "v14-stress-batch-release-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-1",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ]
}
```

### stress / v11VsV10

```json
{
  "completionLostEpisodeIds": [],
  "totalFeeWorseScenarioIds": [
    "v14-stress-batch-release-balanced-n100-r1"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-stress-batch-release-balanced-n100-r1"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-new-arrivals-balanced-n24-r1",
    "v14-stress-new-arrivals-balanced-n24-r3",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n50-r4",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-new-arrivals-balanced-n100-r2",
    "v14-stress-new-arrivals-balanced-n100-r3",
    "v14-stress-batch-release-balanced-n24-r1",
    "v14-stress-batch-release-balanced-n24-r2",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r2",
    "v14-stress-batch-release-balanced-n50-r3",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r3",
    "v14-stress-batch-release-balanced-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r3::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r2::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r2::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r2::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-balanced-n24-r1::repeat-1",
    "v14-stress-batch-release-balanced-n24-r1::repeat-2",
    "v14-stress-batch-release-balanced-n24-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r2::repeat-1",
    "v14-stress-batch-release-balanced-n24-r2::repeat-2",
    "v14-stress-batch-release-balanced-n24-r2::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r2::repeat-1",
    "v14-stress-batch-release-balanced-n50-r2::repeat-2",
    "v14-stress-batch-release-balanced-n50-r2::repeat-3",
    "v14-stress-batch-release-balanced-n50-r3::repeat-1",
    "v14-stress-batch-release-balanced-n50-r3::repeat-2",
    "v14-stress-batch-release-balanced-n50-r3::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r3::repeat-1",
    "v14-stress-batch-release-balanced-n100-r3::repeat-2",
    "v14-stress-batch-release-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3"
  ]
}
```

### stress / v10VsHiGHS

```json
{
  "completionLostEpisodeIds": [
    "v14-stress-new-arrivals-tight-n50-r1::repeat-1",
    "v14-stress-new-arrivals-tight-n50-r1::repeat-2",
    "v14-stress-new-arrivals-tight-n50-r1::repeat-3",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-1",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-2",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ],
  "totalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-batch-release-balanced-n24-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-tight-n50-r1"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-balanced-n24-r1::repeat-1",
    "v14-stress-batch-release-balanced-n24-r1::repeat-2",
    "v14-stress-batch-release-balanced-n24-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r1",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-batch-release-balanced-n24-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-tight-n50-r1"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-balanced-n24-r1::repeat-1",
    "v14-stress-batch-release-balanced-n24-r1::repeat-2",
    "v14-stress-batch-release-balanced-n24-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3"
  ],
  "revisionWorseScenarioIds": [],
  "revisionWorseEpisodeIds": []
}
```

### stress / highsVsV7

```json
{
  "completionLostEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r2::repeat-3",
    "v14-stress-batch-release-balanced-n24-r3::repeat-1",
    "v14-stress-batch-release-balanced-n24-r3::repeat-2",
    "v14-stress-batch-release-balanced-n24-r3::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-1"
  ],
  "totalFeeWorseScenarioIds": [
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-tight-n50-r1"
  ],
  "totalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3"
  ],
  "incrementalFeeWorseScenarioIds": [
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-tight-n50-r1"
  ],
  "incrementalFeeWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3"
  ],
  "revisionWorseScenarioIds": [
    "v14-stress-aged-backlog-balanced-n24-r1",
    "v14-stress-aged-backlog-balanced-n24-r3",
    "v14-stress-aged-backlog-balanced-n24-r4",
    "v14-stress-aged-backlog-balanced-n50-r1",
    "v14-stress-aged-backlog-balanced-n50-r3",
    "v14-stress-aged-backlog-balanced-n50-r4",
    "v14-stress-aged-backlog-balanced-n100-r4",
    "v14-stress-new-arrivals-balanced-n24-r1",
    "v14-stress-new-arrivals-balanced-n50-r1",
    "v14-stress-new-arrivals-balanced-n50-r4",
    "v14-stress-new-arrivals-balanced-n100-r1",
    "v14-stress-new-arrivals-balanced-n100-r4",
    "v14-stress-new-arrivals-tight-n50-r4",
    "v14-stress-batch-release-balanced-n24-r1",
    "v14-stress-batch-release-balanced-n24-r4",
    "v14-stress-batch-release-balanced-n50-r1",
    "v14-stress-batch-release-balanced-n50-r4",
    "v14-stress-batch-release-balanced-n100-r1",
    "v14-stress-batch-release-balanced-n100-r3",
    "v14-stress-batch-release-balanced-n100-r4",
    "v14-stress-batch-release-tight-n50-r1",
    "v14-stress-batch-release-tight-n50-r2",
    "v14-stress-batch-release-tight-n50-r3",
    "v14-stress-batch-release-tight-n50-r4",
    "v14-stress-batch-release-tight-n100-r4"
  ],
  "revisionWorseEpisodeIds": [
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n24-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r1::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r3::repeat-3",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n50-r4::repeat-3",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-1",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-2",
    "v14-stress-aged-backlog-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n24-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n50-r4::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r1::repeat-3",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-1",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-2",
    "v14-stress-new-arrivals-balanced-n100-r4::repeat-3",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-1",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-2",
    "v14-stress-new-arrivals-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n24-r1::repeat-1",
    "v14-stress-batch-release-balanced-n24-r1::repeat-2",
    "v14-stress-batch-release-balanced-n24-r1::repeat-3",
    "v14-stress-batch-release-balanced-n24-r4::repeat-1",
    "v14-stress-batch-release-balanced-n24-r4::repeat-2",
    "v14-stress-batch-release-balanced-n24-r4::repeat-3",
    "v14-stress-batch-release-balanced-n50-r1::repeat-1",
    "v14-stress-batch-release-balanced-n50-r1::repeat-2",
    "v14-stress-batch-release-balanced-n50-r1::repeat-3",
    "v14-stress-batch-release-balanced-n50-r4::repeat-1",
    "v14-stress-batch-release-balanced-n50-r4::repeat-2",
    "v14-stress-batch-release-balanced-n50-r4::repeat-3",
    "v14-stress-batch-release-balanced-n100-r1::repeat-1",
    "v14-stress-batch-release-balanced-n100-r1::repeat-2",
    "v14-stress-batch-release-balanced-n100-r1::repeat-3",
    "v14-stress-batch-release-balanced-n100-r3::repeat-1",
    "v14-stress-batch-release-balanced-n100-r3::repeat-2",
    "v14-stress-batch-release-balanced-n100-r3::repeat-3",
    "v14-stress-batch-release-balanced-n100-r4::repeat-1",
    "v14-stress-batch-release-balanced-n100-r4::repeat-2",
    "v14-stress-batch-release-balanced-n100-r4::repeat-3",
    "v14-stress-batch-release-tight-n50-r1::repeat-1",
    "v14-stress-batch-release-tight-n50-r1::repeat-2",
    "v14-stress-batch-release-tight-n50-r1::repeat-3",
    "v14-stress-batch-release-tight-n50-r2::repeat-1",
    "v14-stress-batch-release-tight-n50-r2::repeat-2",
    "v14-stress-batch-release-tight-n50-r2::repeat-3",
    "v14-stress-batch-release-tight-n50-r3::repeat-1",
    "v14-stress-batch-release-tight-n50-r3::repeat-2",
    "v14-stress-batch-release-tight-n50-r3::repeat-3",
    "v14-stress-batch-release-tight-n50-r4::repeat-1",
    "v14-stress-batch-release-tight-n50-r4::repeat-2",
    "v14-stress-batch-release-tight-n50-r4::repeat-3",
    "v14-stress-batch-release-tight-n100-r4::repeat-2",
    "v14-stress-batch-release-tight-n100-r4::repeat-3"
  ]
}
```

## 证据 SHA / 原始源码身份

```json
{
  "data/v14-release.json": "545428e33cc3502666515c2a7bfd7bf42328e5193527b8e0896a9d235f6354a2",
  "data/v14-results.json": "18d794150d2928a53cd4661ce2b32c90bf59e18e10299e6817f8e4fd0ee84ce8",
  "data/evidence-v14/v14-frozen-first/first-run/complete.json": "a0081a725e21a019c783bffe5b3c0e8aedf8f8b29903564fa04fa1ee53a2fcb9",
  "data/protocol-v14.json": "7711db53e044231b018a2381b7bdc5a87319f00d3f4848f26803ed1b820bada4",
  "data/evidence-v14/v14-frozen-first/manifest.json": "2833cf5c8ddeb1d01f4f06fba0dd045aa5e82bb6a25cd6d00799e63caddd71bd",
  "sourceGitCommit": "d61118924f7d0f9c1e1f6a43d6725a6deec101a0",
  "data/review-v14.json": "4aef29303ef9872a5bf4bb85b0a7731fb3acb34e090a68981a975d7111e0ab8f",
  "data/bootstrap-review-v14.json": "95d2021efb5d8d20e31eea18b3b2cb5a15732b557b6c391f8eff7d30fefd8a48"
}
```

材料为 AI 辅助草稿；本人资格、报名、当届 AI 规则、真实贡献、独立复现和答辩理解尚须本人确认，技术审核不替代这些事项。
