# V15：及时完整交付的首次受控开发结果

本轮没有观察到完整执行率、共同完成条件费用或改期改善。V12、V13、V15均完成同一5/12个端点；V15相对两个对照均为新增0、损失0。固定10ms返回预留已实现并可核验，但当前结果不支持将它写成算法胜出或直接升级为默认策略。

## 范围与实施

四个已见V14损失场景，每个保留原三次时钟/算法重复（包括8个原损失和4个原成功重复），三个方法共36个首次分支。每个原重复绑定自己的V13物理历史，从预声明的D3/D6/D7开始冷缓存干预，再自然续跑；三方法均不导入历史私有缓存。这不是自然D0重跑，也没有新增业务样本、种子或置信区间。

候选以V12经济接受规则为主干，将原生绝对返回目标固定提前10ms；机制隔离主比较是V12与V15，V13仅作为旧严格M规则负控。原生目标190ms位于原200ms完整复制、物理/锁/费用审核与原子接纳预算内。Python内部2ms、原构造40ms/5ms/3次、父5秒完整生命周期保持不变。190ms为合作目标，实际函数返回不保证硬200ms。仅真实Python回包计返回目标，服务错误、硬超时和未观测响应分别保留，结算后证据封存。

冻结前22项Node测试通过，其中包括15项独立Python审核夹具；这些手写模拟不构成性能证据。独立协议核对18份原件、12端点及36顺序通过。源码先提交并远程核验，再声明、首次串行求解；没有补跑、续跑、调10ms或替换失败。

源码提交：`b91e3a0a78901816b280d642108649ae51ef073a`。原始声明SHA：`3f2f3172c5ba3e3d45265805e5a20cdd60cc2b8d89b5b66193c1b391957d2af4`。原始索引SHA：`b996dcf846c0e00ba3f89da453176af8f4a4302061e8dd2f27b7d4966196eaee`。协议SHA：`e65a550c749256e04dffa2df20d0d597ee6755914456296cb7264bdf48655b2d`。

## 全部首次分支

| 方法 | 完整 / 12 | 失败 / 12 | 历史未知 |
| --- | ---: | ---: | ---: |
| seededHiGHSV12 | 5 | 7 | 0 |
| guardedHiGHSV13 | 5 | 7 | 0 |
| timelyHiGHSV15 | 5 | 7 | 0 |

下表列出全部12端点；完整费用为终态总两费/新增两费（KRW）。未完整金额保留null，不将残缺路径费用混成节省。

| 已见场景 | 原重复 | 干预日 | V12 | V13 | V15 |
| --- | ---: | ---: | --- | --- | --- |
| v14-stress-aged-backlog-balanced-n50-r2 | 1 | D6 | 失败 D6 · rolling_failed · None/None | 失败 D6 · rolling_failed · None/None | 失败 D6 · rolling_failed · None/None |
| v14-stress-aged-backlog-balanced-n50-r2 | 2 | D6 | 失败 D6 · rolling_failed · None/None | 失败 D6 · rolling_failed · None/None | 失败 D6 · rolling_failed · None/None |
| v14-stress-aged-backlog-balanced-n50-r2 | 3 | D6 | 失败 D6 · rolling_failed · None/None | 失败 D6 · rolling_failed · None/None | 失败 D6 · rolling_failed · None/None |
| v14-stress-new-arrivals-tight-n100-r3 | 1 | D6 | 失败 D6 · rolling_failed · None/None | 失败 D6 · rolling_failed · None/None | 失败 D6 · rolling_failed · None/None |
| v14-stress-new-arrivals-tight-n100-r3 | 2 | D6 | 完整 · feasible · 0/0 | 完整 · feasible · 0/0 | 完整 · feasible · 0/0 |
| v14-stress-new-arrivals-tight-n100-r3 | 3 | D6 | 完整 · feasible · 9100/9100 | 完整 · feasible · 9100/9100 | 完整 · feasible · 9100/9100 |
| v14-stress-new-arrivals-tight-n100-r4 | 1 | D3 | 完整 · feasible · 9100/9100 | 完整 · feasible · 9100/9100 | 完整 · feasible · 9100/9100 |
| v14-stress-new-arrivals-tight-n100-r4 | 2 | D3 | 完整 · feasible · 9100/9100 | 完整 · feasible · 9100/9100 | 完整 · feasible · 9100/9100 |
| v14-stress-new-arrivals-tight-n100-r4 | 3 | D3 | 完整 · feasible · 9100/9100 | 完整 · feasible · 9100/9100 | 完整 · feasible · 9100/9100 |
| v14-stress-new-arrivals-tight-n50-r1 | 1 | D7 | 失败 D7 · rolling_failed · None/None | 失败 D7 · rolling_failed · None/None | 失败 D7 · rolling_failed · None/None |
| v14-stress-new-arrivals-tight-n50-r1 | 2 | D7 | 失败 D7 · rolling_failed · None/None | 失败 D7 · rolling_failed · None/None | 失败 D7 · rolling_failed · None/None |
| v14-stress-new-arrivals-tight-n50-r1 | 3 | D7 | 失败 D7 · rolling_failed · None/None | 失败 D7 · rolling_failed · None/None | 失败 D7 · rolling_failed · None/None |

## 真实时钟与独立复核

冻结的纯Python审查器首次审核通过：36/36记录覆盖、15完整、21失败、未知0，实际物理计划345份（含强制重放的原历史），6576个物理事件。36个父进程均在5秒内交付终态、正常退出、确认进程组消失并完成终审。审查未运行求解器或导入JavaScript。

以下是干预日第一次真实策略调用的记录，历史强制重放不计为原生发现；墙钟时间不能解释为跨机器保证。

| 场景 / 重复 / 方法 | 干预日状态 | 调用墙钟 ms | 原生结算 ms | 接纳 ms | V15真实回包 ms / 190目标 |
| --- | --- | ---: | ---: | ---: | --- |
| v14-stress-aged-backlog-balanced-n50-r2 / 1 / seededHiGHSV12 | infeasible | 22.64375899999999 | 21.80695300000002 | None | — |
| v14-stress-aged-backlog-balanced-n50-r2 / 1 / guardedHiGHSV13 | infeasible | 21.552075000000002 | 20.717903999999976 | None | — |
| v14-stress-aged-backlog-balanced-n50-r2 / 1 / timelyHiGHSV15 | infeasible | 23.637237999999968 | 22.661997000000042 | None | 22.579904999999997 / True |
| v14-stress-new-arrivals-tight-n100-r3 / 1 / guardedHiGHSV13 | infeasible | 33.93994500000002 | 32.83639400000004 | None | — |
| v14-stress-new-arrivals-tight-n100-r3 / 1 / timelyHiGHSV15 | infeasible | 33.944481999999994 | 32.89360899999997 | None | 32.81365999999997 / True |
| v14-stress-new-arrivals-tight-n100-r3 / 1 / seededHiGHSV12 | infeasible | 34.34111300000001 | 33.32710400000002 | None | — |
| v14-stress-new-arrivals-tight-n100-r4 / 1 / timelyHiGHSV15 | optimal | 178.890382 | 175.42077999999998 | 177.522226 | 175.25453199999998 / True |
| v14-stress-new-arrivals-tight-n100-r4 / 1 / seededHiGHSV12 | optimal | 177.06615800000003 | 173.827989 | 175.76721400000002 | — |
| v14-stress-new-arrivals-tight-n100-r4 / 1 / guardedHiGHSV13 | optimal | 180.964432 | 177.599576 | 179.61046800000003 | — |
| v14-stress-new-arrivals-tight-n50-r1 / 1 / seededHiGHSV12 | infeasible | 24.196005000000014 | 23.419828999999993 | None | — |
| v14-stress-new-arrivals-tight-n50-r1 / 1 / guardedHiGHSV13 | infeasible | 24.267280000000028 | 23.464125000000024 | None | — |
| v14-stress-new-arrivals-tight-n50-r1 / 1 / timelyHiGHSV15 | infeasible | 24.301541999999984 | 23.51162599999998 | None | 23.459217999999964 / True |
| v14-stress-new-arrivals-tight-n100-r3 / 2 / timelyHiGHSV15 | optimal | 65.62052599999998 | 62.58899500000001 | 64.35513300000002 | 62.516637 / True |
| v14-stress-new-arrivals-tight-n100-r3 / 2 / seededHiGHSV12 | optimal | 67.16357099999999 | 64.09530699999999 | 65.90016199999997 | — |
| v14-stress-new-arrivals-tight-n100-r3 / 2 / guardedHiGHSV13 | optimal | 65.53877399999999 | 62.479040999999995 | 64.23049800000001 | — |
| v14-stress-new-arrivals-tight-n100-r4 / 2 / seededHiGHSV12 | optimal | 175.671967 | 172.000744 | 174.217693 | — |
| v14-stress-new-arrivals-tight-n100-r4 / 2 / guardedHiGHSV13 | optimal | 174.992749 | 171.442637 | 173.66868900000003 | — |
| v14-stress-new-arrivals-tight-n100-r4 / 2 / timelyHiGHSV15 | optimal | 176.028711 | 172.330759 | 174.61413600000003 | 172.19796100000002 / True |
| v14-stress-new-arrivals-tight-n50-r1 / 2 / guardedHiGHSV13 | infeasible | 24.473460999999986 | 23.687891999999977 | None | — |
| v14-stress-new-arrivals-tight-n50-r1 / 2 / timelyHiGHSV15 | infeasible | 24.543845000000033 | 23.682132999999965 | None | 23.627251 / True |
| v14-stress-new-arrivals-tight-n50-r1 / 2 / seededHiGHSV12 | infeasible | 25.00181699999996 | 24.087437000000023 | None | — |
| v14-stress-aged-backlog-balanced-n50-r2 / 2 / guardedHiGHSV13 | infeasible | 22.500505999999973 | 21.539215000000013 | None | — |
| v14-stress-aged-backlog-balanced-n50-r2 / 2 / timelyHiGHSV15 | infeasible | 22.258155999999985 | 21.390825000000007 | None | 21.329564000000005 / True |
| v14-stress-aged-backlog-balanced-n50-r2 / 2 / seededHiGHSV12 | infeasible | 21.73069099999998 | 20.915487999999982 | None | — |
| v14-stress-new-arrivals-tight-n100-r4 / 3 / guardedHiGHSV13 | optimal | 174.96301599999998 | 171.45246300000002 | 173.550094 | — |
| v14-stress-new-arrivals-tight-n100-r4 / 3 / timelyHiGHSV15 | optimal | 175.229763 | 171.608295 | 173.837602 | 171.471902 / True |
| v14-stress-new-arrivals-tight-n100-r4 / 3 / seededHiGHSV12 | optimal | 199.32394499999998 | 195.86518900000004 | 198.00534300000004 | — |
| v14-stress-new-arrivals-tight-n50-r1 / 3 / timelyHiGHSV15 | infeasible | 24.152453000000037 | 23.35642900000005 | None | 23.26631500000002 / True |
| v14-stress-new-arrivals-tight-n50-r1 / 3 / seededHiGHSV12 | infeasible | 24.402436000000023 | 23.57966200000004 | None | — |
| v14-stress-new-arrivals-tight-n50-r1 / 3 / guardedHiGHSV13 | infeasible | 24.151892999999973 | 23.349538999999993 | None | — |
| v14-stress-aged-backlog-balanced-n50-r2 / 3 / timelyHiGHSV15 | infeasible | 22.007321999999988 | 21.182114000000013 | None | 21.13189 / True |
| v14-stress-aged-backlog-balanced-n50-r2 / 3 / seededHiGHSV12 | infeasible | 24.769812 | 23.74508800000001 | None | — |
| v14-stress-aged-backlog-balanced-n50-r2 / 3 / guardedHiGHSV13 | infeasible | 21.964758999999958 | 21.03881100000001 | None | — |
| v14-stress-new-arrivals-tight-n100-r3 / 3 / seededHiGHSV12 | optimal | 52.31359100000003 | 49.21551200000005 | 50.875842000000034 | — |
| v14-stress-new-arrivals-tight-n100-r3 / 3 / guardedHiGHSV13 | optimal | 52.056197999999995 | 49.05648500000001 | 50.727732 | — |
| v14-stress-new-arrivals-tight-n100-r3 / 3 / timelyHiGHSV15 | optimal | 51.78587600000003 | 48.642830000000004 | 50.28510299999999 | 48.56850899999995 / True |

每法56次真实调用，共168次，本次记录均未超200ms、未出现late_candidate；这只是本轮观察，不是硬时限保证。V15的56个真实回包均命中190ms目标，其中7次返回infeasible，命中目标不等于交付了完整可行候选。[独立只读诊断](v15-independent-findings.zh.md)和[96份原件绑定](../data/v15-delivery-diagnosis.json)保留逐条时刻与失败原因。

每个原D3端点在这次冷缓存切片中三个方法都完成，不能把原V14的一次自然运行迟到称为V15独自修复。冷缓存、服务运行时机和过去真实缓存审计开销均与原自然D0历史不同。其余7个失败端点每法都在预声明D6/D6/D7的首次实际调用失败：构造未交付完整解，原生及时报告当前前缀不可行。这不等于无该前缀限制的全部业务问题被独立证明无解。

## 全部配对与负例

两项对照各12个匹配端点，其中共同完整5对；五对费用差和改期差均为0。只在双方完整的同端点/原重复内比较，其他差值均为null。下面保留全部24对，差值方向为基准减V15，负值才表示V15更贵；本轮不计算置信区间、节省率排名或企业ROI。

```json
[
  {
    "baselineMethod": "seededHiGHSV12",
    "candidateMethod": "timelyHiGHSV15",
    "endpointPairCount": 12,
    "jointlyCompletedEndpointPairCount": 5,
    "gained": 0,
    "lost": 0,
    "pairs": [
      {
        "endpointId": "v14-stress-aged-backlog-balanced-n50-r2::repeat-1",
        "caseId": "v14-stress-aged-backlog-balanced-n50-r2",
        "repeatIndex": 1,
        "baselineComplete": false,
        "candidateComplete": false,
        "jointlyCompleted": false,
        "totalBaselineMinusCandidateKRW": null,
        "incrementalBaselineMinusCandidateKRW": null,
        "revisionBaselineMinusCandidate": null
      },
      {
        "endpointId": "v14-stress-aged-backlog-balanced-n50-r2::repeat-2",
        "caseId": "v14-stress-aged-backlog-balanced-n50-r2",
        "repeatIndex": 2,
        "baselineComplete": false,
        "candidateComplete": false,
        "jointlyCompleted": false,
        "totalBaselineMinusCandidateKRW": null,
        "incrementalBaselineMinusCandidateKRW": null,
        "revisionBaselineMinusCandidate": null
      },
      {
        "endpointId": "v14-stress-aged-backlog-balanced-n50-r2::repeat-3",
        "caseId": "v14-stress-aged-backlog-balanced-n50-r2",
        "repeatIndex": 3,
        "baselineComplete": false,
        "candidateComplete": false,
        "jointlyCompleted": false,
        "totalBaselineMinusCandidateKRW": null,
        "incrementalBaselineMinusCandidateKRW": null,
        "revisionBaselineMinusCandidate": null
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n100-r3::repeat-1",
        "caseId": "v14-stress-new-arrivals-tight-n100-r3",
        "repeatIndex": 1,
        "baselineComplete": false,
        "candidateComplete": false,
        "jointlyCompleted": false,
        "totalBaselineMinusCandidateKRW": null,
        "incrementalBaselineMinusCandidateKRW": null,
        "revisionBaselineMinusCandidate": null
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n100-r3::repeat-2",
        "caseId": "v14-stress-new-arrivals-tight-n100-r3",
        "repeatIndex": 2,
        "baselineComplete": true,
        "candidateComplete": true,
        "jointlyCompleted": true,
        "totalBaselineMinusCandidateKRW": 0,
        "incrementalBaselineMinusCandidateKRW": 0,
        "revisionBaselineMinusCandidate": 0
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n100-r3::repeat-3",
        "caseId": "v14-stress-new-arrivals-tight-n100-r3",
        "repeatIndex": 3,
        "baselineComplete": true,
        "candidateComplete": true,
        "jointlyCompleted": true,
        "totalBaselineMinusCandidateKRW": 0,
        "incrementalBaselineMinusCandidateKRW": 0,
        "revisionBaselineMinusCandidate": 0
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n100-r4::repeat-1",
        "caseId": "v14-stress-new-arrivals-tight-n100-r4",
        "repeatIndex": 1,
        "baselineComplete": true,
        "candidateComplete": true,
        "jointlyCompleted": true,
        "totalBaselineMinusCandidateKRW": 0,
        "incrementalBaselineMinusCandidateKRW": 0,
        "revisionBaselineMinusCandidate": 0
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n100-r4::repeat-2",
        "caseId": "v14-stress-new-arrivals-tight-n100-r4",
        "repeatIndex": 2,
        "baselineComplete": true,
        "candidateComplete": true,
        "jointlyCompleted": true,
        "totalBaselineMinusCandidateKRW": 0,
        "incrementalBaselineMinusCandidateKRW": 0,
        "revisionBaselineMinusCandidate": 0
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n100-r4::repeat-3",
        "caseId": "v14-stress-new-arrivals-tight-n100-r4",
        "repeatIndex": 3,
        "baselineComplete": true,
        "candidateComplete": true,
        "jointlyCompleted": true,
        "totalBaselineMinusCandidateKRW": 0,
        "incrementalBaselineMinusCandidateKRW": 0,
        "revisionBaselineMinusCandidate": 0
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n50-r1::repeat-1",
        "caseId": "v14-stress-new-arrivals-tight-n50-r1",
        "repeatIndex": 1,
        "baselineComplete": false,
        "candidateComplete": false,
        "jointlyCompleted": false,
        "totalBaselineMinusCandidateKRW": null,
        "incrementalBaselineMinusCandidateKRW": null,
        "revisionBaselineMinusCandidate": null
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n50-r1::repeat-2",
        "caseId": "v14-stress-new-arrivals-tight-n50-r1",
        "repeatIndex": 2,
        "baselineComplete": false,
        "candidateComplete": false,
        "jointlyCompleted": false,
        "totalBaselineMinusCandidateKRW": null,
        "incrementalBaselineMinusCandidateKRW": null,
        "revisionBaselineMinusCandidate": null
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n50-r1::repeat-3",
        "caseId": "v14-stress-new-arrivals-tight-n50-r1",
        "repeatIndex": 3,
        "baselineComplete": false,
        "candidateComplete": false,
        "jointlyCompleted": false,
        "totalBaselineMinusCandidateKRW": null,
        "incrementalBaselineMinusCandidateKRW": null,
        "revisionBaselineMinusCandidate": null
      }
    ]
  },
  {
    "baselineMethod": "guardedHiGHSV13",
    "candidateMethod": "timelyHiGHSV15",
    "endpointPairCount": 12,
    "jointlyCompletedEndpointPairCount": 5,
    "gained": 0,
    "lost": 0,
    "pairs": [
      {
        "endpointId": "v14-stress-aged-backlog-balanced-n50-r2::repeat-1",
        "caseId": "v14-stress-aged-backlog-balanced-n50-r2",
        "repeatIndex": 1,
        "baselineComplete": false,
        "candidateComplete": false,
        "jointlyCompleted": false,
        "totalBaselineMinusCandidateKRW": null,
        "incrementalBaselineMinusCandidateKRW": null,
        "revisionBaselineMinusCandidate": null
      },
      {
        "endpointId": "v14-stress-aged-backlog-balanced-n50-r2::repeat-2",
        "caseId": "v14-stress-aged-backlog-balanced-n50-r2",
        "repeatIndex": 2,
        "baselineComplete": false,
        "candidateComplete": false,
        "jointlyCompleted": false,
        "totalBaselineMinusCandidateKRW": null,
        "incrementalBaselineMinusCandidateKRW": null,
        "revisionBaselineMinusCandidate": null
      },
      {
        "endpointId": "v14-stress-aged-backlog-balanced-n50-r2::repeat-3",
        "caseId": "v14-stress-aged-backlog-balanced-n50-r2",
        "repeatIndex": 3,
        "baselineComplete": false,
        "candidateComplete": false,
        "jointlyCompleted": false,
        "totalBaselineMinusCandidateKRW": null,
        "incrementalBaselineMinusCandidateKRW": null,
        "revisionBaselineMinusCandidate": null
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n100-r3::repeat-1",
        "caseId": "v14-stress-new-arrivals-tight-n100-r3",
        "repeatIndex": 1,
        "baselineComplete": false,
        "candidateComplete": false,
        "jointlyCompleted": false,
        "totalBaselineMinusCandidateKRW": null,
        "incrementalBaselineMinusCandidateKRW": null,
        "revisionBaselineMinusCandidate": null
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n100-r3::repeat-2",
        "caseId": "v14-stress-new-arrivals-tight-n100-r3",
        "repeatIndex": 2,
        "baselineComplete": true,
        "candidateComplete": true,
        "jointlyCompleted": true,
        "totalBaselineMinusCandidateKRW": 0,
        "incrementalBaselineMinusCandidateKRW": 0,
        "revisionBaselineMinusCandidate": 0
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n100-r3::repeat-3",
        "caseId": "v14-stress-new-arrivals-tight-n100-r3",
        "repeatIndex": 3,
        "baselineComplete": true,
        "candidateComplete": true,
        "jointlyCompleted": true,
        "totalBaselineMinusCandidateKRW": 0,
        "incrementalBaselineMinusCandidateKRW": 0,
        "revisionBaselineMinusCandidate": 0
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n100-r4::repeat-1",
        "caseId": "v14-stress-new-arrivals-tight-n100-r4",
        "repeatIndex": 1,
        "baselineComplete": true,
        "candidateComplete": true,
        "jointlyCompleted": true,
        "totalBaselineMinusCandidateKRW": 0,
        "incrementalBaselineMinusCandidateKRW": 0,
        "revisionBaselineMinusCandidate": 0
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n100-r4::repeat-2",
        "caseId": "v14-stress-new-arrivals-tight-n100-r4",
        "repeatIndex": 2,
        "baselineComplete": true,
        "candidateComplete": true,
        "jointlyCompleted": true,
        "totalBaselineMinusCandidateKRW": 0,
        "incrementalBaselineMinusCandidateKRW": 0,
        "revisionBaselineMinusCandidate": 0
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n100-r4::repeat-3",
        "caseId": "v14-stress-new-arrivals-tight-n100-r4",
        "repeatIndex": 3,
        "baselineComplete": true,
        "candidateComplete": true,
        "jointlyCompleted": true,
        "totalBaselineMinusCandidateKRW": 0,
        "incrementalBaselineMinusCandidateKRW": 0,
        "revisionBaselineMinusCandidate": 0
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n50-r1::repeat-1",
        "caseId": "v14-stress-new-arrivals-tight-n50-r1",
        "repeatIndex": 1,
        "baselineComplete": false,
        "candidateComplete": false,
        "jointlyCompleted": false,
        "totalBaselineMinusCandidateKRW": null,
        "incrementalBaselineMinusCandidateKRW": null,
        "revisionBaselineMinusCandidate": null
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n50-r1::repeat-2",
        "caseId": "v14-stress-new-arrivals-tight-n50-r1",
        "repeatIndex": 2,
        "baselineComplete": false,
        "candidateComplete": false,
        "jointlyCompleted": false,
        "totalBaselineMinusCandidateKRW": null,
        "incrementalBaselineMinusCandidateKRW": null,
        "revisionBaselineMinusCandidate": null
      },
      {
        "endpointId": "v14-stress-new-arrivals-tight-n50-r1::repeat-3",
        "caseId": "v14-stress-new-arrivals-tight-n50-r1",
        "repeatIndex": 3,
        "baselineComplete": false,
        "candidateComplete": false,
        "jointlyCompleted": false,
        "totalBaselineMinusCandidateKRW": null,
        "incrementalBaselineMinusCandidateKRW": null,
        "revisionBaselineMinusCandidate": null
      }
    ]
  }
]
```

## 新增：四条失败的独立必要容量证书

在首跑与上述逐分支复核之后，新增只读[必要容量界限诊断](capacity-necessary-bounds-v15.zh.md)。7条V15失败全部纳入：aged-backlog-n50-r2的原3重复，在D6最低必要仓位6大于当日公开容量5；new-arrivals-n100-r3的原重复1为8大于6。四条记录只来自两个不同已见上下文，不是四个独立业务样本。其余new-arrivals-n50-r1的原3重复保留`not_explained`。

该诊断对单箱所有时间合法三元组取资源区间需求下界，忽略容量构造联合可行投影的超集；下界之和严格超过公开容量才给证书。独立复核另行重枚举200箱的三个上下文，日期域数量与SHA全等并重算两项当日仓容矛盾。8个手写检查、300资源区间与328用量交叉核对通过，未调用求解器或改变36分支结果。[原始诊断JSON](../data/capacity-necessary-bounds-v15.json)绑定实际失败、原V14前缀、执行锁与冻结物理ledger。

证书仅证明固定已执行前缀下无法满足当前必要条件，不能推广为从D0必败、整个业务无解、规划器可知未来或某个更早选择已被证明致因。它也不证明剩余3条可行。当前已有更明确的下一步：研究更早公开状态下的执行承诺与资源可恢复性，单靠同日返回提速无法救回这四条固定前缀。

## 后续工作与交付边界

最新正式研究仍是V14，其压力默认替换门槛未通过；V15没有新的自然D0正式验证，也没有默认替换资格。下一阶段优先诊断未恢复的跨日执行承诺与未来容量可恢复性，而不是把更多时间预留参数叠成胜出结论。只有开发证据支持明确机制后，才另行冻结、声明新的正式样本；不消耗新留出替已有候选美化成绩。

网站、PDF、PPT、报告、研究证据与当前源码分包已按用户要求全部允许匿名读取。V14正式PDF/PPT仍保留原版，V15作为单列开发补充。公开访问、算法效果、软件恢复和参赛者本人资格/报名/答辩分别验收。企业资料和联系人不是公开研究路线前置条件。完整冲冠计划尚未完成，比赛名次无法保证。

原始公开索引见[data/delivery-v15-first-index.json](../data/delivery-v15-first-index.json)，[独立审核](../data/review-delivery-v15.json)、[协议](../data/protocol-development-v15.json)、[状态](../data/v15-development-release.json)、[恢复说明](recovery-v15.zh.md)分别保留；所有V1–V14冻结证据、分数与SHA不改。
