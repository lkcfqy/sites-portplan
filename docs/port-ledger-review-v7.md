# V7 原生港口日志的独立 SQL 复核

`scripts/review-port-ledger-v7.py` 直接读取许可原件 `CargoPickup_IoT.sqlite`，重新建立事件出现、关联和访问窗口，逐项比对既有 `data/port-ledger-v7.json`。它只使用 Python 标准库 SQLite、时钟解析与汇总，不导入或调用 `scripts/audit-port-ledger-v7.py` 的函数，不运行求解器，不重新执行主审核生成器。

证书 `data/port-ledger-review-v7.json` 为 `valid:true / readOnly:true / fixture:false / solverRuns:0`。原件以 SQLite `mode=ro` 打开，并设置 `query_only`；连接的 source database changes 为 0。该复核只写新的证书文件，不清洗、覆盖输入或填充业务字段。

## 原件与结果的绑定

SQLite SHA-256 固定为 `edcb515fddc502db99a2122cf8d69b951d00269644aa46f6d550a43bb017075f`，并复核已保存的来源取证清单。原账本 SHA-256 固定为 `2e0d2f31587b2455f85388092ef3fcc7fd94e9d11644613d42eb78c6beb9362b`；账本内部声明的 source SHA 与实际原件一致，主生成器的 implementation SHA 也与当前文件一致。

`inputHashes` 使用仓库相对路径，绑定实际 SQLite、实际账本、来源清单、主生成器、本独立检查器和其测试。源许可为 CC BY 4.0，来源 URL 为 `https://zenodo.org/records/22019684`。发布者描述此资料为现场采集的散粮港口日志；我们没有独立认证采集过程，不能将它改称集装箱订单。

## 与主审核不同的独立关联

主审核以 Python 对各 Truck 的排序分配和二分查找进行关联；本检查器用 SQL 关系操作独立完成：

1. 读取原 `event_map_type`，将全部 20 个类型表以 `UNION ALL` 汇入统一出现关系。每个 `(table,rowid)` 是源出现身份，重复 event ID 保留为不同出现，不覆盖 recorded timestamp。
2. 对 `event_object` 用 `DISTINCT (event ID, object ID)` 建立成员关系，完整重复的源关系另行统计。只有独立类型表明为 Truck 的对象进入 truck membership；不解析 event ID 的任何子串推断计划或卡车。
3. 从原有 `Truck → Pickup Plan`、`Assigned truck for pickup plan` 边取窗口。SQL `LEAD` 按 Truck 分区、按解析后的原无时区 assigned time 与原 rowid 排序，给出同一卡车下一次分配。
4. 各核心及异常出现依 truck membership 和 recorded clock 进入半开窗口 `[assignedAt,nextAssignedAt)`。同一时间多次分配明确标为歧义，不任选其中一个计划；先于首分配、非法时钟或多 Truck 归属的出现保留为 unmatched。恰在下次分配时间的出现属于后一窗口。

窗口是使用完整历史的**事后观测**，不是在线规划器当时可见的信息。字符串中的命名不构成关联证据。

## 全量比较内容

对全部 489 个窗口按原身份与顺序，递归比较每个字段：assignment 源 rowid、Truck、Pickup Plan、assigned/next assigned 原字符串、同时分配歧义、四阶段的完整出现列表、异常出现列表、每个 occurrence key/event ID/type/typeMap/truck membership/timestamp parsed 标记、缺失与多阶段列表、分类和两种跨度。

每个完整唯一四阶段窗口再检查 recorded clocks 的顺序。仅顺序成立者进入 gate 与 LoadTruck-to-WeighLoadedTruck 跨度；缺失、歧义、时钟倒置不补默认时间、不进入完整分母。两种跨度的 count、minimum、median、mean、nearest-rank p95、maximum 全量重算。原始无时区时间字符串保持精确一致，数值比较仅允许微小浮点舍入差。

全局 event 与类型出现的 `(event ID,type)` 多重集合、悬空引用、全部核心及异常归属、每个类型表计数、非法时间/无关联/多 Truck 出现键也独立比较。直接 SQL JOIN 分别统计原关联与唯一 membership 的连接膨胀，不能把连接行计为真实出现。

## 确认的原数据结果

| 检查 | 原件复算结果 |
| --- | ---: |
| 全局 event 行 / 原生类型出现 | 6,989 / 6,989 |
| 不同全局 event ID | 6,950 |
| 全局重复 ID 额外行 | 39 |
| 相同 ID 的类型时钟冲突数 | 39 |
| event-object 源行 / 完全重复额外行 | 7,258 / 39 |
| 原始多表连接行 | 7,492 |
| 使用唯一 membership 的连接行 | 7,336 |
| Truck 对象 / 分配窗口 | 50 / 489 |
| 完整有序 / 不完整观测窗口 | 454 / 35 |
| 核心及异常出现 / 已归属 / 无归属 | 1,892 / 1,892 / 0 |

所有 489 个窗口的源出现、关联、时间、阶段、异常及跨度与原账本一致，三个 accounting integrity 项通过。454 个完整窗口的 gate span 中位数为 4,231 秒，LoadTruck 至重车称重 recorded span 中位数为 2,108 秒。

这两个数仅是**记录时钟差**。时区、跨系统时钟同步与 LoadTruck 表示开始还是完成未知；不能改为卸货服务时间、预测误差或容量利用率。50 个 Truck 对象不是已经证明可用的车队容量，35 个缺失观测不是自动证明物理失败、订单未完成或可恢复。

## 验证与复现

```sh
python scripts/review-port-ledger-v7.py
node --test tests/port-ledger-review-v7.test.mjs
```

7 个独立内存 SQLite fixture 测试通过。手算例使用互不包含的 opaque 卡车/计划/事件 ID，并跨两个窗口复用同一个 event ID；六个原生出现因重复源关系会产生 16 个原始 JOIN 行或 8 个唯一 membership JOIN 行，仍只有六个观察。测试另覆盖下一次分配精确边界、同时分配歧义、非法时钟保留，以及篡改 timestamp、缺失列表、plan/truck 关联、分类、跨度或 summary 时的拒绝。

测试不导入主审核，也不运行正式生成器或求解器；手写 fixture 不冒充真实源证书。最终证书保留逐窗口独立比较结果及阶段/异常计数，可与完整原账本的源出现回查对应。

该证据支持原生公开散粮日志的身份、关联与记录时序处理。集装箱生命周期、匹配空箱归还、收费合同、仓库/箱位/运力容量和真实装卸服务起止仍缺失；没有把这些缺失项从 ID 名称补出，没有生成箱级收费结果，也没有将此日志加入合成收费实验分母。
