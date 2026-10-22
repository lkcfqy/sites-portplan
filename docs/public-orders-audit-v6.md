# V6 公开货运输入独立审计

审计时间：2026-10-13T05:14:17.691390+00:00。结果：`passed_structural_checks_with_semantic_gaps`。

这份数据可用于检验公开货运CSV与有向矩阵的读取质量，不能作为PNC实单、真实港口费用节省或全部客户调度可行性的证据。数据作者将其明确描述为基于加州Riverside及San Bernardino一天历史重卡运行生成的研究实例；原始历史记录及字段生成过程没有提供。

## 来源、许可与原件

固定提交：[作者仓库](https://github.com/pengdongbo/Robust-BET-Dispatching-Dataset/tree/0e608495c1520d1634d57c748f84156453d17869)。审计直接解析三份原字节CSV，独立重算，不读取已有`schema-evidence.json`的结论。无原件改写、无新业务字段、无求解器调用。

仓库根LICENSE为MIT，copyright(c)2024Dongbo；复制/分发应保留版权与许可通知。所取得README没有数据例外声明；这不等于独立确认原始历史数据或OpenRouteService的上游授权。JSON中的permit是来源许可记录，不是法律认证。

| 文件 | 字节 | SHA-256 |
|---|---:|---|
| [LICENSE](https://raw.githubusercontent.com/pengdongbo/Robust-BET-Dispatching-Dataset/0e608495c1520d1634d57c748f84156453d17869/LICENSE) | 1063 | `87c4e845f1fdfac4396365ef3bdc9002f37d515114f4524c165137ed18d6e05c` |
| [README.md](https://raw.githubusercontent.com/pengdongbo/Robust-BET-Dispatching-Dataset/0e608495c1520d1634d57c748f84156453d17869/README.md) | 944 | `0555970cabd42b0f623f86cbcc597e36bdd09977820e5e20f18e266fc8c518c3` |
| [BETVRPBTW1_robust.csv](https://raw.githubusercontent.com/pengdongbo/Robust-BET-Dispatching-Dataset/0e608495c1520d1634d57c748f84156453d17869/Robust_BET_Dispatching_Dataset/BETVRPBTW1_robust.csv) | 1305 | `44896ecea2179f6800ea5403090a41c5a80875fc3b0efc8cb27dde19386cb2cc` |
| [BETVRPB1_dist.csv](https://raw.githubusercontent.com/pengdongbo/Robust-BET-Dispatching-Dataset/0e608495c1520d1634d57c748f84156453d17869/Robust_BET_Dispatching_Dataset/BETVRPB1_dist.csv) | 20288 | `965e3f94e85af28d17bf7980cdeee920b53dc0656aa001434d8e929e0f1702d5` |
| [BETVRPB1_time.csv](https://raw.githubusercontent.com/pengdongbo/Robust-BET-Dispatching-Dataset/0e608495c1520d1634d57c748f84156453d17869/Robust_BET_Dispatching_Dataset/BETVRPB1_time.csv) | 17854 | `8ad75945df9fa2bd12abdd7ae109b9ae1ef5d69737bd628d4631af93dcce52ee` |

下载清单没有原件取得时间；本报告时间是本次本地审计时间，不冒充下载时间。

## 行、字段、单位及映射

共48行：47位客户、1个depot；Delivery=33，Pickup=14。ID核对文件顺序0..47，检查重复ID、重复整行、缺失、数值有限性和非负性。

| 原字段/文件 | README声明单位与解释 | 本审计边界 |
|---|---|---|
| id / stop_type | 节点ID、Delivery/Pickup/Begin Trip | 生成实例节点；不是港口订单或箱号 |
| weight | lbs，需求重量 | 保留正数原值，不自造装载上限或运输符号 |
| Stop Duration | minutes，服务时间 | 无历史实测/生成的逐字段证明 |
| Arr / Due | minutes，时间窗口 | Arr不是订单释放时间；无日期、时区或固定开班时间 |
| BETVRPB1_dist.csv | meters，ORS生成 | 路网估计，不是实测里程 |
| BETVRPB1_time.csv | seconds，ORS生成 | 展示逐客户分钟值仅按秒÷60换算，不等于路线可行性 |

两张矩阵都有列标题0..47，随后48个纯数值行，没有行ID列。审计将第i行按ID=i解释；客户CSV顺序、矩阵维度与零对角线均相符。但README没有明确行顺序定义，结构一致性不能补成作者明示的映射保证。运行时应保留这个限制，不能把首列数值误读成行标签。

| 类型 | 客户数 | 总需求（lbs） | 总服务时间（分钟） |
|---|---:|---:|---:|
| Delivery | 33 | 87747 | 890 |
| Pickup | 14 | 118874 | 368 |

服务时间求和只是数据量描述，不是车辆工时或所需车数；Pickup与Delivery重量不得相加后冒充单车容量需求。

| 客户数值字段 | 最小值 | 最大值 |
|---|---:|---:|
| Stop Duration | 5 | 166 |
| weight | 340 | 33435 |
| Arr | 0 | 240 |
| Due | 120 | 480 |

## 矩阵与窗口的独立检查

| 矩阵 | 维度 | 范围 | 非对角零值（有向） | 非对称对（无向，分母1128） |
|---|---|---|---:|---:|
| distance | 48行，列宽{48: 48} | 0..116999.78 meter | 4 | 1116 |
| travelTime | 48行，列宽{48: 48} | 0..5031.75 second | 4 | 1116 |

非对角零值节点对（有向）为distance=`[[7, 8], [8, 7], [37, 38], [38, 37]]`；travelTime=`[[7, 8], [8, 7], [37, 38], [38, 37]]`。没有坐标或ORS请求原件，零值原因未知；可能涉及同址或路网吸附，但不能确认为同址，更不能因此去重客户。保留零值和方向，不修补或对称化。

客户窗口宽度范围为120..480分钟；Arr>Due的客户ID为`[]`，服务时长超过自身窗口宽度的客户ID为`[]`。后者只是算术筛查；README没有明确Due约束服务开始还是完成，不能宣称完成时窗或全部线路可行。

所读depot窗口为`{'open': 0, 'close': 480}`；不能据此固定开班或把上限当作司机工时终点。47位客户保留matrix[0][id]直达估计及秒÷60换算，`shiftStartMinutes`、最早到达、最早服务与`arrivalWindowReachableAtShiftStart`全部为null。未构造中转路径，没有证明ORS路段最短性，未检查整条路线或全部客户的必要/充分条件。

## 通过、失败与未知

机械检查共39项，通过39项、失败0项。失败输出不会丢弃：脚本仍写JSON及Markdown，并以exit1返回。结构检查通过不消除下列语义缺口。

本次未发现SHA、CSV形状、必填值、ID、数值/非负或窗口顺序失败；有非对角零值、非对称和缺失业务字段，均原样保留。

| 未知字段/含义 | 未知原因与用途影响 |
|---|---|
| matrixRowSemanticMapping | CSV has column IDs but no row labels; README does not explicitly state row order. File-order/zero-diagonal checks support the declared positional interpretation only. |
| shiftStartMinutes | No fixed shift-start field; depot window [0,480] does not establish departure at minute 0. |
| windowClockOriginTimezoneAndHistoricalDate | Only minute windows are declared; no dated clock origin/timezone or original movement date. |
| windowAppliesToServiceStartOrCompletion | README names time windows without defining completion semantics. |
| orderReleaseTime | No release field. Arr is the customer window lower bound; never converted to PortPlan release. |
| vehicleCapacityFleetCountShiftEndAndLoadingPolicy | No such CSV fields; depot Due is not asserted to be a driver shift end. |
| locationCoordinatesAndZeroArcCause | No coordinates; zero arcs may indicate colocated/ORS-snapped stops, but cause cannot be verified. |
| originalObservedFieldsAndGenerationTransformations | README calls this a generated instance based on history; per-field preservation/generation procedures and original logs are not supplied. |
| portContainerIdTypeDischargeCustomsWarehouseCapacityEmptyReturnAndTariff | Not port-container execution/fee data; cannot instantiate the PortPlan import-container fee model. |
| datasetSpecificLicenseExceptionAndUpstreamHistoryOrsRights | Root MIT notice is present; no exception in supplied README, but upstream historical data and ORS contractual rights are not independently verified. |
| samplingRepresentativenessAndCurrentFreshness | One generated historical day; no current operational coverage or independent days established. |

本次只审计一个47客户生成实例，不能检查跨日漂移、当前业务新鲜度或抽样代表性。每个原字段来自历史实测还是经抽样/修改未知；这里没有将任何数值字段标成‘原始真实实测’。

## PortPlan可以及不可以据此做什么

可以增加的证据是：固定来源原件、许可通知、字段单位、48节点有向矩阵与47客户的可复算输入质量审计。这份证据说明我们能保留外部来源的语义和异常。

不能增加V5的真实订单覆盖数、真实费节省、路线最优性或比赛胜率。缺少车辆/仓库容量、箱型与卸船、通关、还空、真实release和费率，不能将这份CSV直接灌入进口箱费用模型；本轮不开发另一条路线优化器。后续若取得对应业务字段，应建立单独的数据契约和来源，再检查连接覆盖及事件时间。

## 复算

```sh
python scripts/audit-public-orders-v6.py
```

依赖仅Python标准库。脚本使用Decimal比较原始数值；输出路径默认`data/public-orders-audit-v6.json`及`docs/public-orders-audit-v6.md`。使用`--source-dir`、`--output`、`--report`可检查副本；脚本以固定提交SHA校验输入，篡改及缺失会失败。JSON包含全部机械checks/failures、未知字段、逐客户直达信息、原件SHA和脚本SHA。
