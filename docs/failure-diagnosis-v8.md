# V8：V7 九个失败的独立离线分层

这份诊断实际重建并审核 V7 九个未完成案例的原始观察和执行前缀；没有运行新留出实验，也没有重跑或覆盖 V7 在线成绩。原成绩仍为 27/36。旧 V7 案例已用于 V8 开发诊断，不能称为 V8 新留出。

九例包含七个 D0 失败和 D3、D7 各一个失败。四层共 36 次模型请求，按完整输入 SHA-256 去重为 22 个独立 trip-column 模型；缓存命中 14 次。HiGHS 1.8.0 / SciPy 1.17.0，单线程串行，先每模型 10 秒，仅可行性未决时再给 60 秒。实际原生调用 22 次，升级 0 个模型，最后未决 0 个模型。

四层分别是：原始名义容量从开始；失败日当时已知容量加原执行锁；全知实际容量从开始；全知实际容量加同一执行锁。后两层只作事后反事实诊断，不能输入在线策略或当成在线恢复方案。

| 失败案例 | 日 / 已执行动作数 | 原名义 | 当时观察＋原执行锁 | 全知实际无锁 | 全知实际同锁 |
| --- | ---: | --- | --- | --- | --- |
| v7-aged-backlog-tight-n24-r1 | D0 / 0 | 不可行 | 不可行 | 不可行 | 不可行 |
| v7-aged-backlog-tight-n24-r2 | D7 / 43 | 可行 | 不可行 | 不可行 | 不可行 |
| v7-aged-backlog-tight-n50-r1 | D0 / 0 | 可行 | 可行 | 不可行 | 不可行 |
| v7-aged-backlog-tight-n50-r2 | D0 / 0 | 不可行 | 不可行 | 不可行 | 不可行 |
| v7-aged-backlog-tight-n100-r1 | D0 / 0 | 可行 | 可行 | 可行 | 可行 |
| v7-aged-backlog-tight-n100-r2 | D0 / 0 | 不可行 | 不可行 | 不可行 | 不可行 |
| v7-new-arrivals-tight-n50-r2 | D3 / 17 | 可行 | 可行 | 可行 | 可行 |
| v7-new-arrivals-tight-n100-r2 | D0 / 0 | 可行 | 可行 | 可行 | 可行 |
| v7-batch-release-tight-n24-r1 | D0 / 0 | 不可行 | 不可行 | 不可行 | 不可行 |

这九个失败中，六个案例即使事先知道全部实际容量也无法完成。因此，在原资源、期限和日级模型不变的条件下，整批 36 例完整执行的上界为 **30/36**；不能将目标直接设为九个全部救回。

四个当时观察下有解的漏解中，`aged-backlog-tight-n50-r1` 的实际全路径仍不可行。其余三个有完整实际可行见证的开发目标是 `aged-backlog-tight-n100-r1`、`new-arrivals-tight-n100-r2`，以及 **`new-arrivals-tight-n50-r2` 在 D3 原有 17 个执行动作精确锁定后的恢复**。全知可行见证不保证未知未来的在线策略能全部完成；后三例仍需实际滚动验证。

分类计数：

- `nominal_infeasible_from_start`：4 例。
- `actual_hindsight_and_observed_prefix_infeasible`：1 例。
- `observed_prefix_feasible_online_search_miss`：4 例。

不同求解器在额外离线预算找到完整可行方案，只能证明原在线方法当时未找到它。原算法加时重放为 **not tested**；不能据此声称给 V7 更多时间必然成功。不可行层也不计为 V8 应救回的案例。

每个模型保留完整输入、模型 SHA-256、每次预算与原生状态、下界、gap、求解／建模墙钟，以及所有可行方案的完整提箱／卸货／还箱日期和独立费用。模型由 Python 独立枚举 trip，不读取 JavaScript 矩阵。已执行事件精确锁定，未执行事件不早于失败日；已开始卸货的全部连续占用和历史场地／运输需求都保留。

可行候选同时通过独立费用／资源／执行锁审核和第二套 Python ledger 日期计费检查。不可行证据是空合法域或 HiGHS 原生 infeasible 状态；原生数值求解结论不是外部机构签章或形式化证明。没有 incumbent 的 time limit 保持未决，费用为 null。

证据文件：[failure-diagnosis-v8.json](../data/failure-diagnosis-v8.json)。源档 SHA-256：

- `data/rolling-v7.json`：`a8b0d67f7ff5fbf3b27fe260ab8d9d17be331a9942df37704d8d8365546000c6`
- `data/protocol-v7.json`：`bb70fa6938ffbb162347142cbb2788f9ece00ac695a8b8ed5a647cd08aedb96f`
- `data/rolling-review-v7.json`：`580b0c92a329020c6d986ee39b4e9153da6b688bb0d37d8464ef94895e6024d6`

复核已保存证据，不重新求解：

```bash
python scripts/diagnose-failures-v8.py --verify-report data/failure-diagnosis-v8.json
```

重新运行诊断须写入新的输出路径；默认拒绝覆盖已存在文件。初始与升级预算控制的是额外原生求解时间，Python 启动、建模和审核另计，不能与 V7 的 5 秒完整冷 episode 成绩混用。

```bash
python scripts/diagnose-failures-v8.py --output artifacts/failure-diagnosis-v8-rerun.json --markdown-output artifacts/failure-diagnosis-v8-rerun.md
```

本证据仅针对声明的合成订单、容量和日级收费模型，不提供业务收益、策略因果优越性或比赛名次保证。
