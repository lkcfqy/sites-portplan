# V4 日粒度独立实现证书

`scripts/certify-v4.py` 用 Python、SciPy 1.17 / HiGHS，从情景原始字段重新建立提箱、卸货、还空箱模型，并逐箱检查 JavaScript 策略输出。它不导入 JS 引擎、GLPK 模型、JS 费用系数或 JS 的可行性审计函数。它是项目内部的独立实现验证，**不是第三方认证**，也不证明真实港口订单节省或承运人合同解释获得批准。

## 使用和输入

```sh
python scripts/certify-v4.py \
  --input /absolute/path/benchmark-cases.json \
  --output /absolute/path/certificate-v4.json \
  --time-limit 2 --max-cases 12
node --test tests/certificate-v4.test.mjs
```

输入必须为 `{ "cases": [{ "id": "case-id", "scenario": {...}, "policies": { "optimized": {...}, "fifo": {...} } }] }`。`scenario` 和策略结果沿用 `src/engine.js` 的公开 JSON 结构；每条完整排程含箱号、箱型、三个事件日、卸货完成日和全部逐箱费用。总费用及 `objectiveCost` 也必须提供。`tariff`、`operations` 允许部分覆盖，未提供项由证书实现自己的默认常量补足。

`--max-cases` 选择**输入顺序的前 N 个情景**，默认 12，不是随机抽样。输出保留输入总数、检查数、遗漏数和完整输入文件 SHA-256。提交时必须描述上游情景选择规则；只检验前 12 个不能声称覆盖完整基准。`--time-limit` 默认每情景、每主目标给 HiGHS 2 秒，建列和审计的额外时间单列为 `wallSeconds`；`solverWallSeconds` 是求解器调用耗时。证书计算是额外验证预算，不能包装为与浏览器策略相同 CPU 预算的性能比较。

## 独立日期和费用

日期用 Python `datetime` 解析显式时区，再转换为 UTC+09:00。PNC 存储从首尔卸船时刻早于 08:00 的当天开始；08:00 及以后从翌日开始。提箱日计入存储天数，还箱日计入 D&D 天数。规划前累计费用按规划开始前一天重算，增量费用为总累计费用减去规划前累计费用。

费用采用逐个计费日枚举，而不是 JS 分段公式。默认 PNC：4 天免期，收费天数档宽 3、2、5、无限天，费率 9,100、18,200、31,850、45,500 KRW/TEU，按达到的最高档追溯全部收费天数。默认 D&D：10 天免期，每箱按 5、5、无限天档宽累加；20 英尺费率 15,000、30,000、50,000，40 英尺费率 30,000、50,000、90,000 KRW。D&D 的累加方式仍是项目披露的合同解释假设，需要核对实际合同。

证书支持两种收费模式、免费天数和倍率覆盖。覆盖免费天数会平移所有档位边界，这只是研究假设。PNC progressive、D&D retroactive 和任何倍率覆盖同样是敏感性情景，不是已核实合同。容许的情景参数范围与公开引擎接口一致。

## 不同的数学模型

对于每个箱 i，独立枚举全部合法 `(p,u,r)` 三元组：

- `release_i ≤ p ≤ u`；
- `u + unloadDays_i − 1 ≤ due_i`；
- `r ≥ u + unloadDays_i − 1 + returnLagDays`；
- 三个事件及卸货持续区间均在规划期内。

每个三元组建立一个二元列 `x[i,p,u,r]`，每箱恰好选一列。这与浏览器 GLPK 的三个事件变量与累计先后约束结构不同。每列携带整段资源占用：

- 提箱日和还箱日各 1 次运输。同日提还的重复系数相加为 2；
- `u` 到 `u + unloadDays − 1` 每天 1 个卸货槽；
- `p ≤ day < r` 每天占场地，按箱计 1，或按 TEU 计 `sizeFt/20`。

每日分别约束运输、卸货、场地容量。三种容量均支持常量或长度等于规划天数的整数数组；20/40 英尺分别计算费用及 TEU 场地权重。主目标为 joint 增量费用、storageOnly 增量存储费用或 ddOnly 增量 D&D 费用。政策结果可声明自己的 `objectiveMode`，证书对该案例出现的各主目标分别求解。

本证书没有验证单目标消融的第二阶段词典序联合费用最优性。它检验所声明的**主目标**及全部实际费用；不能据此宣称第二阶段已完成。它也不重放 rolling horizon 历史、不验证冻结决策或每日可获知的信息集合：仅适用于输入所描述的静态确定性日模型。场地是跨日库存，不是日内物理峰值；线路、旅行时间、日内时窗、关务和随机信息均不在该证书范围内。

结果带 `executionConstraints` 时退出非 0，避免用未锁定静态模型为滚动执行最优声明背书。基准 `hard_time_limit` 若保留完整 checkpoint，可正常逐箱检查；空 `hard_time_limit`、`worker_error`、`audit_failed` 结果均明确记录无完整候选。

## 审计、界和失败含义

每个完整策略方案都独立核验箱号覆盖、事件整数与范围、尺寸、截止日、先后、所有逐箱费用和每日资源，并核对汇总费用及已提供的日期、usage。即使不同箱的费用篡改互相抵消，逐箱核验仍会拒绝。

证书记录 HiGHS 状态、审计过的 incumbent、下界、相对 MIP gap、节点数和墙钟时间。独立 incumbent 同样经过费用与可行性审计。字段含义：

| `certificateStatus` | 可支持的结论 |
| --- | --- |
| `proven_optimal` | 全部主目标系数及任意选择的目标和值在安全整数范围内；HiGHS 给出 optimal 且 incumbent 审计通过 |
| `solver_optimal_with_numeric_tolerance` | 非安全整数主目标；仅报告 HiGHS 原生 optimal 状态和数值容差内的界一致性，不能声称精确数学最优 |
| `proven_infeasible` | 无合法列或 HiGHS 证明该模型不可行；成本为 null |
| `feasible_with_bound` | 有审计通过的解和有效求解下界，尚未证明最优 |
| `feasible_only` | 有审计通过的解但无可报告下界 |
| `no_certificate` | 超时或求解失败，没有可用完整证书；绝不补 0 费用 |

输出 `policyAudits` 中保留每个方案独立计算的费用、资源及与界的比较。启发式方案高于独立最优解是正常结果。候选费用低于独立下界、声称 optimal 却被独立更优方案反驳、声称 infeasible 却出现独立可行解、输入或逐箱审计错误，均令命令退出 1。输入 JSON 无法读取/解析退出 2。正常超时无证书本身不令审计失败；它会明确计入 `noCertificateCount`。退出 0 或 `passedCaseCount` 表示未发现矛盾，**不能替代 `provenOptimalCount` 或声称所有案例最优**。

`numericalAssurance` 披露系数和目标和是否处于 JavaScript 安全整数范围（绝对值不超过 `2^53−1`）。逐箱费用比较容差为 absolute `1e−12` / relative `1e−10`；整数主目标的证书比较只用 absolute `1e−6`，不同整数目标不会因金额大而被相对容差混同。非整数主目标的界比较为 absolute `1e−6` / relative `1e−10`，只可标 `bounds_consistent_with_numeric_tolerance`，永远不会标 `verified_optimal`。这些是输出比较容差，不是数学误差界，也不是 HiGHS 内部容差参数；例如 `pncMultiplier=1e−12` 时不同方案相差 `9.1e−9`，必须如实保留数值最优性限制。summary 分别报告 `provenOptimalCount` 和 `solverOptimalWithNumericToleranceCount`。

失败策略必须提供空 `rows`，费用必须 null 或缺省。部分排程不作为完整候选比较；启发式 `no_feasible_schedule_found` 不等于模型不可行。策略 `time_limit` 可以带完整可行 incumbent，也可以为空，这两种情况分别报告。

## 验证证据

`tests/certificate-v4.test.mjs` 的所有手工数值没有调用 JS 引擎或费用函数，覆盖：默认 20/40 英尺费用及规划前累计费用、首尔 08:00 日界、同日双运输和零跨日场地、按日变化容量、TEU、两种收费模式与三种主目标、相互抵消的逐箱篡改、先后/容量篡改、假最优、诚实不可行、失败成本为 0、检查数截断披露、极短预算无 incumbent 时的 null 成本，以及 `1e−12` 倍率浮点反例不误判精确最优。项目仍需保留大样本基准原始输出；小例通过只证实这些边界和模型实现，不能代替外部有效性。
