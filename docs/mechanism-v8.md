# V8 开发数据：同前缀机制与预算实验

**状态：首轮 392 次开发调用已完成，并通过独立 Python 审核。** 所有任务来自已经检查过的旧 V7 数据，属于开发诊断，不能作为新留出成绩。下列任务清单和设置在第一次调用前冻结；本轮未据结果调参或换任务。

首轮结果与独立审核位于 `artifacts/mechanism-v8-first/results.json` 和 `audit.json`。完整实验用时约 73.7 秒；392 个结果中，274 个返回完整排程均通过独立费用、资源和历史锁审核，其中 21 个迟到，253 个在预算内完成最终审核。它们是同日 snapshot 结果，不是完整执行 episode。

| 策略 | 24 任务 × 3 种子的及时完整结果 | 完整但迟到 | 及时结果的未执行日期变化 |
| --- | ---: | ---: | ---: |
| 合法保留，否则 V7 恢复 | 63/72 | 3 | 750 |
| 合法也固定抛光，否则 V7 恢复 | 63/72 | 3 | 1146 |
| 总是 V7 重新构造 | 51/72 | 15 | 2034 |
| 自适应 V8 | 63/72 | 0 | 750 |

自适应 V8 与简单保留的 63 个共同及时结果中，费用和改期全部相同，本面板**没有证明自适应比简单保留更好**。相对固定抛光，V8 的 12 个运行对更贵、51 个同价，改期从 1146 降到 750，减少约 34.6%；这体现当前模型费用与少改期的取舍。相对总重建，V8 多 12 个及时结果（四个任务 × 三种子），双方共同及时的 51 对中 V8 有三对更贵、48 对同价。不同策略及时结果分母不同，不能仅凭改期合计横向断言优势。

四个漏解任务在 200ms 下四策略都为 0/12 及时完整；1000ms 下四策略都为 3/12，仅 D3 原 17 个动作锁案例成功。使用原 scenario.seed 的冻结 V7 配对探针也仅该 D3 案例由 200ms 未找到完整方案变为 1000ms 及时完整，当前模型总费 9100 KRW；三个 D0 初始化探针在 1000ms 仍未找到方案。因此这批开发结果支持继续检验冲突恢复的额外计算预算，尚未支持“一律给初始化更多时间即可救回”的结论。所有负结果保留，未据四例改变触发阈值。

原始结果 SHA-256：`537140a831fb5807bb703b2757b9203c328d3062a6e486006c3780e44c0eaf23`；协议 SHA-256：`01571193568db7e11ef7e32aa844f9ca2679b3b625ff99bc1cf3bce83f2737cc`。独立审核验证原观察 hash、完整同前缀、全部任务／种子／预算顺序、每个完整返回排程（含迟到）、null 失败费用、改期和配对摘要；审核不调用求解器、不导入 JavaScript。

已预声明 28 个任务，来自 24 个原案例。三种订单机制 × 两种容量松紧形成六层，每层两个普通日与两个容量公告日 snapshot，共 24 个；另纳入 G0 全部四个当时观察下可行的漏解。

Six mechanism x capacity strata, two ordinary and two capacity-announcement snapshots each. Sort cases by repeat, size, ID. Ordinary: V7 earliest day>=1 with prior complete accepted dates and no new announcement; round-robin subsequent ordinary days if fewer cases. Announcement: rotate sorted cases from index two, use each V7 path first observed announcement day. If fewer than two distinct snapshots, try V6, stable-retain, daily-reopt source paths in that order and discard exact snapshotHash duplicates. Add all four G0 observed-prefix-feasible misses, including D3 original 17 locks. No V8 outcome participates.

四策略取得同一个当时观察、同一执行锁、同一最早未执行日和同一份上一完整计划日期。固定保留和固定抛光直接重计价／审核上一计划；需要恢复时调用冻结 V7 新工厂。固定重建直接使用冻结 V7 新工厂；自适应方法通过 initialDates 获得相同参考。没有伪造 V7 私有缓存注入。

三个算法随机种子固定为 1103、2207、3301，全部保存。24 个机制任务使用 200ms；四漏解使用 200/1000ms。另对四漏解实际运行冻结 V7 原始 scenario.seed 的 200/1000ms 配对，共 392 次调用。

导入、工厂创建和独立手工小例的 GLPK 初始化在计时之外。输入克隆、方法内重计价／审计、构造／修整／求解及最终独立回执审核计入调用预算。预算为合作式截止；记录真实超时，迟到完整结果不计及时成功，也不声称硬中断。不同于 V7 整条路径 5 秒冷 episode，不可混合比较。

三个 D0 漏解没有上一完整计划，previousDates=null，属于初始化与预算探针；不能计为稳定性选择。D3 漏解则精确保留原 17 个执行动作和前日完整日期。原 V7 私有缓存状态不可注入，D3 预算探针只称同冻结源码／原种子／原 snapshot 的 fresh-factory 调用，不称精确重放原内部缓存状态。

实际选样分母：普通日 12、容量公告日 12；当前上一计划合法 17、当前已失效 8、无上一计划的 D0 初始化 3。

aged-backlog/tight 只有一个 V7 案例到达公告日；V6 与稳定保留的公告输入与它完全相同，按预声明来源优先级去重后使用每日重算的另一条原始历史。两条输入分别有 43 与 44 个原动作锁，来源方法保留在下表，不当作独立现实业务样本。

| 类型 / 来源方法 | 原案例 | 日 | 箱数 | 原动作锁 | 当前上一计划可行 | 输入 hash |
| --- | --- | ---: | ---: | ---: | --- | --- |
| ordinary / costPolishV7 | v7-aged-backlog-balanced-n24-r1 | D1 | 24 | 11 | 是 | `sha256:6b3ccaa7f6939bfb9508794b0891f7572deacaf851891536176ed0206e4987c4` |
| ordinary / costPolishV7 | v7-aged-backlog-balanced-n50-r1 | D1 | 50 | 23 | 是 | `sha256:5b2b10941c0a49a36143905cbff9b81a98c6e68b2df8cfbf8f9b1ef6f96dfc73` |
| capacity-announcement / costPolishV7 | v7-aged-backlog-balanced-n100-r1 | D2 | 100 | 84 | 否 | `sha256:b405ed98a3c9343d0a6025c7d164099dcd5d5998a66b8f79fc31fe2a22bd4e6d` |
| capacity-announcement / costPolishV7 | v7-aged-backlog-balanced-n24-r2 | D3 | 24 | 28 | 否 | `sha256:8d5abdd76df6c84632ae28558af1807fd8b28f7669d1ed0c839825cd67d759f8` |
| ordinary / costPolishV7 | v7-aged-backlog-tight-n24-r2 | D1 | 24 | 7 | 是 | `sha256:4d4e7fd742aca89508146817beb2cc4bec956824fe636a82a6f2c8106e8414ce` |
| ordinary / costPolishV7 | v7-aged-backlog-tight-n24-r2 | D2 | 24 | 14 | 是 | `sha256:0dbcc45e9e432c63172bc82e46cd6baf178169872a8dc68fac24de79161ed2df` |
| capacity-announcement / costPolishV7 | v7-aged-backlog-tight-n24-r2 | D7 | 24 | 43 | 否 | `sha256:387b2ad124494c4b605cce29af7c36e46152e1e9c8036e85ee44a2ce680d4a7c` |
| capacity-announcement / dailyReoptV4 | v7-aged-backlog-tight-n24-r2 | D7 | 24 | 44 | 否 | `sha256:4478e47af35ce74529a57d83e1050ebda72e0bf5701a41bb47d9ca78eb6bb6e0` |
| ordinary / costPolishV7 | v7-new-arrivals-balanced-n24-r1 | D1 | 24 | 0 | 是 | `sha256:8bc27ca094e7c77f0a0976f9395327a3f2a19235a25d9df85d5b7691b30b137e` |
| ordinary / costPolishV7 | v7-new-arrivals-balanced-n50-r1 | D1 | 50 | 3 | 是 | `sha256:9b1b9a550cad6ba65e76bdfca90826f9872592dc793f52f74a97660c83a583b9` |
| capacity-announcement / costPolishV7 | v7-new-arrivals-balanced-n100-r1 | D2 | 100 | 52 | 否 | `sha256:20af35edb55688d05fe9ecd9fe274002dea07d88491ca72395dbc218a58a38ff` |
| capacity-announcement / costPolishV7 | v7-new-arrivals-balanced-n24-r2 | D3 | 24 | 4 | 是 | `sha256:2c27a729cc07ab0df8ed808bd2c5c9e56c8dcfcaba5eb519df5c575f90322b03` |
| ordinary / costPolishV7 | v7-new-arrivals-tight-n24-r1 | D1 | 24 | 6 | 是 | `sha256:1a0e34727b920cf64d75d3700395c89ccad1404a752b45c5cd884864d5886407` |
| ordinary / costPolishV7 | v7-new-arrivals-tight-n50-r1 | D1 | 50 | 7 | 是 | `sha256:dbae2958d32ffdc903584430afce60bcad5c3f751ffe9011995bcbb13600c139` |
| capacity-announcement / costPolishV7 | v7-new-arrivals-tight-n100-r1 | D4 | 100 | 97 | 是 | `sha256:d10a19850079b4f9c0c488336b17b03e97a8bfbfe70f30e71d0a16e2e8430abf` |
| capacity-announcement / costPolishV7 | v7-new-arrivals-tight-n24-r2 | D7 | 24 | 41 | 否 | `sha256:6513203ac8fe7dff49d4b0ca58d979525c3a43d613f3918967b3f2d41698b061` |
| ordinary / costPolishV7 | v7-batch-release-balanced-n24-r1 | D1 | 24 | 9 | 是 | `sha256:0aefe96649eaa6ff5dad9e4e7bbfbf9c619feeaf80d69e53fb5ed7b4b3d5bc9c` |
| ordinary / costPolishV7 | v7-batch-release-balanced-n50-r1 | D1 | 50 | 17 | 是 | `sha256:8846a87f87c83e2310c18823eba95ae197f984eb004d62b914b0284b99950a58` |
| capacity-announcement / costPolishV7 | v7-batch-release-balanced-n100-r1 | D2 | 100 | 70 | 是 | `sha256:6ead0494f978c516c15f7fecf8b66b4fbe9d5974914c43adb4a3198a90f9f0a3` |
| capacity-announcement / costPolishV7 | v7-batch-release-balanced-n24-r2 | D3 | 24 | 15 | 是 | `sha256:4e8d6e3705703bc1dd40785a36d5a73641116e98e6cdbe7cbf24c9bddb42b7bc` |
| ordinary / costPolishV7 | v7-batch-release-tight-n50-r1 | D1 | 50 | 16 | 是 | `sha256:bf426ac9ed5263195f683c587017e31cc7dd5975b6ca032e864b00539c4b1d2b` |
| ordinary / costPolishV7 | v7-batch-release-tight-n100-r1 | D1 | 100 | 30 | 是 | `sha256:a5eebbda8576671c5a2e69d5b654135f9bb655a2d9eccd138e0fbe595ebcea8a` |
| capacity-announcement / costPolishV7 | v7-batch-release-tight-n100-r1 | D4 | 100 | 98 | 是 | `sha256:76272f912b7458d7d81f8965363e62c54ec54cd67cdf130157da9ec929c9fa08` |
| capacity-announcement / costPolishV7 | v7-batch-release-tight-n24-r2 | D7 | 24 | 41 | 否 | `sha256:7967b1d403290ad2ac0a43b39885208f362fc43fa432046ab30f9899644e9815` |
| observed-feasible-misses / costPolishV7 | v7-aged-backlog-tight-n50-r1 | D0 | 50 | 0 | 无上一计划 | `sha256:3c837d15ddd1966a12ad84f54d21527933c4450b504570394daca16e1d95d385` |
| observed-feasible-misses / costPolishV7 | v7-aged-backlog-tight-n100-r1 | D0 | 100 | 0 | 无上一计划 | `sha256:6e499b0e46c93e02a00fc4c06e21534b402b072a4d046a21507392c1342e9b00` |
| observed-feasible-misses / costPolishV7 | v7-new-arrivals-tight-n50-r2 | D3 | 50 | 17 | 否 | `sha256:914ca8689dfab23ea5fec71a221e618a22eb6de3c1e338201fddce0840e863a5` |
| observed-feasible-misses / costPolishV7 | v7-new-arrivals-tight-n100-r2 | D0 | 100 | 0 | 无上一计划 | `sha256:822498c9f033600239ff7a6cac078a963d3ee76c65c3d9003b15102bfa8b1cf3` |

源档 SHA-256：

- `data/rolling-v7.json`：`a8b0d67f7ff5fbf3b27fe260ab8d9d17be331a9942df37704d8d8365546000c6`
- `data/protocol-v7.json`：`bb70fa6938ffbb162347142cbb2788f9ece00ac695a8b8ed5a647cd08aedb96f`
- `data/failure-diagnosis-v8.json`：`b17cef73f79c8259cab5d68e194a36e858c4c1adc8613f16c5a18a5b51be99e7`

计时运行须等自适应源码稳定，并与其他计时实验错开：

```bash
node scripts/mechanism-v8.mjs --run --output-dir artifacts/mechanism-v8-first
```

所有差、失败、迟到、审计拒绝与完整返回的原始日期均保留。费用仅在相同 task／seed／budget 的双方及时完整结果之间比较；失败费用为 null。未执行日期变化、今天／明天改期与总位移相对共同上一计划统计。多个日期可能来自同一案例，三个种子也只是重复运行，不能扩充为独立物流样本。snapshot 费用是当时模型预测，不是最终执行费用或实际节省；不作显著性、泛化或夺冠推断。
