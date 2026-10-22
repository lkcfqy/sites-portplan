# V7：公开散粮港口日志的身份、关联与记录时序审计

本模块实际使用已取得的 Zenodo 22019684 `CargoPickup_IoT.sqlite` 原件（CC BY 4.0，SHA-256 `edcb515fddc502db99a2122cf8d69b951d00269644aa46f6d550a43bb017075f`），不制造集装箱订单或收费字段。发布者称其为现场采集的散粮港口过程日志；我们没有独立认证采集来源。来源、许可及原件位于 `data/public/v6-data-sources/port-bulk-ocel-22019684/`，不是 PNC 箱级订单。

`scripts/audit-port-ledger-v7.py` 用 Python 标准库只读 SQLite，结果见 `data/port-ledger-v7.json`。这是事后数据质量与流程记录审计，没有预测模型、求解器或节费实验。

## 身份与关联

全局 event 表和原生类型表均有 6,989 行，只有 6,950 个不同 event ID。39 个额外重复 ID 对应不同时间的原生出现；event-object 表还有39行完全相同的关系重复。直接把全局event、类型事件、关系表仅按event ID多表连接会扩成7,492行，不能把这些连接行当作7,492次真实事件。

本实现将每条类型表的 `(table,rowid)` 保留为出现身份，不按ID静默去重或覆盖时间。event-object的唯一成员集合仅用于判断关联，重复关系仍在数据质量统计中单列。全局与类型事件的ID/类型多重集合匹配，悬空事件/对象引用为0；全部1,892条核心及异常事件均有明确分析归属。

实际event-object关联只给出Truck，不直接给出Pickup Plan。代码不解析诸如event ID中的Pcp文字来猜计划号，而使用有类型的 `Truck → Pickup Plan`、`Assigned truck for pickup plan` 原生对象关系及记录时间。该卡车下一次分配形成观测窗口的右界；分配关系的源行号保留，重复同时分配为歧义。这个事后窗口使用完整历史，不能冒充在线调度时的信息集。

## 全部窗口的结果

原件有50个Truck对象、489条分配窗口。这是日志对象计数，不是已证实的可用车队容量。核心阶段为 `Enterport / LoadTruck / WeighLoadedTruck / ExitPort`：

| 分类 | 窗口数 | 含义 |
|---|---:|---|
| complete_ordered_observation | 454 | 四阶段各有一次明确记录，记录时钟顺序正确 |
| incomplete_observation | 35 | 至少一个核心阶段缺记录，保留原异常事件及缺失列表 |
| ambiguous_observation | 0 | 该原件未出现多核心阶段或同时分配歧义；手算fixture覆盖该分支 |
| observed_clock_reversal | 0 | 该原件未出现四唯一阶段的时钟倒置；fixture覆盖倒置并排除跨度统计 |

35个缺失观测不自动称物理失败、订单未完成或“可以恢复”；源记录无法支持这些业务结论。缺失、歧义和倒置各有明确分母，不能填默认时间或用首/末事件随意补链。

454个完整窗口的进港至出港记录时钟差中位数为4,231秒，LoadTruck至重车称重记录时钟差中位数为2,108秒。保留全部原始无时区字符串，不赋予UTC或Asia/Seoul；时区、系统时钟同步和LoadTruck事件究竟表示开始/结束均未知。因此这些只叫“记录时钟跨度”，不能改名卸货服务时长、跨港时长预测误差或容量利用率。

## 验证及复现

手算输入的卡车/计划和事件ID使用互不包含的任意字符串，验证关联来自源关系而非命名。两个不同分配窗口复用同一opaque事件ID，仍保留两个源出现；多表连接膨胀与原生出现计数分别报告。额外fixture涵盖时钟倒置、多阶段歧义及先于首分配的无归属观察；这些不能被计作完整窗口或纳入完整跨度。

```sh
node --test tests/port-ledger-v7.test.mjs
python scripts/audit-port-ledger-v7.py --output artifacts/port-ledger-v7-reproduction.json
python scripts/review-port-ledger-v7.py
```

复现读取同一许可原件，校验已保存的取证清单；原件不清洗覆盖。独立SQL关联及计数复核另存 `data/port-ledger-review-v7.json`，不借用主审计的窗口分配函数。网站展示所有窗口的来源阶段、缺失和异常，可回查原始出现键和记录时间，不展示与此研究无关的RFID或车牌字段。

这项证据支持公开日志的身份、关联和时序处理，并实际展示全公开数据的用途。箱型、卸船放行、仓库槽位/箱位/运力容量、 matched empty return 及收费合同仍缺失；没有把散粮提货改为集装箱提卸还，没有把该日志加入36个合成收费场景的分母。
