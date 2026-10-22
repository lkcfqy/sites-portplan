# V6：真实公开数据的原件、字段与可用性核查

核查日期：2026-10-13 UTC。范围是无需联系、登录或访问控制绕过的公开原件；没有运行优化器、修改既有实验或制造缺失的业务字段。文件、原链接、实下载 SHA-256、许可和失败路径见 [manifest.json](../data/public/v6-data-sources/manifest.json)。

**本轮取得了真实历史配送数据、真实运营样本派生运输实例和作者标为现场采集的港口事件日志，但没有取得可直接验证 PortPlan 提箱—仓库卸货—空箱归还及收费链的完整真实订单集。** 这不是“全球不存在开放数据”的结论；只是以下实际核查来源的字段结论。核心 V4/V5 成绩仍属于合成场景，不能因新增公开数据升级为真实港口节费。

最值得继续使用的是作者 MIT 许可的 **47 客户短程运输派生实例**：小、完整、有原生需求/服务/时窗与对应路由矩阵，适合单独检验通用运输约束。它整体基于真实车队样本，时间与服务字段没有逐字段实测证明，且缺车队容量/历史 release。任何新增模型资源都要另列假设，不能改写原件成“真实 PNC 订单”。

## 取得的四套原件

| 来源 | 实际取得规模 | 真实性层次及许可 | 直接覆盖 PortPlan 核心 |
|---|---|---|---|
| Amazon 2021 Last Mile Routing Challenge 官方 practice 小包 | 13 路线、2,051 stops、3,129 包裹出现记录；8 原件 5,250,024 B | 真实历史路线；服务时间为 planned，实际序列可核对；CC BY-NC 4.0 | 否：不是集装箱，没有港口/仓库/空返链。 |
| Dongbo Peng 作者仓库 Robust-BET-Dispatching-Dataset | 47 客户＋depot；需求 CSV 与两张 48×48 矩阵；5 原件 41,454 B | 作者称由真实一日运营样本生成；矩阵由 OpenRouteService 估计；MIT | 否：真实历史 release、车队容量和港口链缺失。 |
| Delivering Data，Zenodo 15310106 | 9 个日索引实例、653 请求出现记录、36 矩阵；ZIP 2,926,700 B | 3PL 真实需求；服务/时窗由收件人类型规则制定，矩阵由 API 生成；数据 CC BY 4.0 | 否：没有实际港口动作与收费；车队资源也不在 ZIP。 |
| Cargo Pickup OCEL，Zenodo 22019684 | SQLite 7,188,480 B；269 提货计划、50 trucks、6,989 事件行 | 作者标为中国港口现场过程记录，未独立认证采集来源；数据 CC BY 4.0 | 否：粮食散货筒仓提货，不是集装箱。 |

四套许可明确的原件共 15,406,658 B，另保留小型元信息与字段审计。原件没有被清洗覆盖、求解或转换成 PortPlan 输入。本文与 manifest 中的“真实”来自发布者的运营来源声明及附件检查，不代表我们获得原公司认证。

## 1. 优先外部实例：47 客户运输需求与矩阵

固定版本：[作者公开仓库](https://github.com/pengdongbo/Robust-BET-Dispatching-Dataset/tree/0e608495c1520d1634d57c748f84156453d17869)，commit `0e608495c1520d1634d57c748f84156453d17869`。原件在 [california-freight-47-derived](../data/public/v6-data-sources/california-freight-47-derived/)；仓库根 [LICENSE](../data/public/v6-data-sources/california-freight-47-derived/LICENSE) 是 MIT，未找到单独的数据例外。保留 Dongbo 的版权声明、原 README 与所有字节。

README 明确称它是基于 California Riverside/San Bernardino 地区重型柴油车队典型一日历史移动的**生成问题实例**。没有把它称为未加工实测日志，也没有逐字段证明时窗和服务时长全为观测。

| 原件 | 实下载 SHA-256 |
|---|---|
| `BETVRPBTW1_robust.csv` | `44896ecea2179f6800ea5403090a41c5a80875fc3b0efc8cb27dde19386cb2cc` |
| `BETVRPB1_dist.csv` | `965e3f94e85af28d17bf7980cdeee920b53dc0656aa001434d8e929e0f1702d5` |
| `BETVRPB1_time.csv` | `8ad75945df9fa2bd12abdd7ae109b9ae1ef5d69737bd628d4631af93dcce52ee` |

实际 CSV 有 48 行：ID 0 是 `Begin Trip` depot，1–47 是 33 Delivery、14 Pickup。原生字段为 `id, stop_type, Stop Duration, weight, Arr, Due`。原 README 声明需求为 lbs、服务及时间窗为分钟、距离为米、旅行时间为秒。服务为 5–166 分钟，需求为 340–33,435 lbs；客户时窗均有序。

两矩阵列标题均为 0–47，其后 48 行无单独行标签，按文件行序对应节点。数值有限非负、对角为零；各有 1,116 对非对称元素，保留 4 个零非对角元素。不能擅自对称化或把零值判作缺失。矩阵是 ORS 生成估计，不是全部节点对的实际行驶记录。详情见 [schema-evidence.json](../data/public/v6-data-sources/california-freight-47-derived/schema-evidence.json)。

**`Arr` 是客户最早访问时窗，不是订单向调度器出现的 release。** 附件没有车队数量、车辆载重、历史 release、箱型、卸船、仓库日容量、空箱归还或港口费。若用它验证外部模型，应以“公开真实运营样本派生运输实例”命名，明确车队与容量来自新增模型假设，按分钟保留服务/窗口，按源秒数转换旅行时间；不能取整为天后把参数叫实测港口动作。

另一个 TRR 2026 作者仓库的 19 客户 CSV（14 Delivery/5 Pickup）已实下载检查，但其行全部是此 47 客户实例的子集；它不是第二个独立实证面板。该另仓库未找到许可证，其原件只在临时取证缓存，没有泛套当前 MIT 或 Dryad 许可。

## 2. Amazon：真路线、planned 服务与大量缺失时窗

[官方开放数据登记](https://registry.opendata.aws/amazon-last-mile-challenges/)指向公开 S3。取得训练包的 `model_apply_inputs/new_route_data.json`、`new_package_data.json`、`new_travel_times.json` 及相应实际序列、评分辅助文件、README 和 License；8 个原件的 MD5 都与 S3 ETag 一致。原始 URL/哈希见 [下载清单](../data/public/v6-data-sources/amazon-last-mile-practice/download-manifest.json)。

字段文档采用 [固定版本 MIT-CAVE 说明](https://github.com/MIT-CAVE/rc-cli/blob/e15f6aca1eb659300f07c28c9e906dbf2aa22ba1/templates/data_structures.md)，运营来源解释参考 [Amazon/MIT 数据论文](https://cdn.amazon.science/1f/02/349d1f594f8d8f97b21ebc02c7b2/2021-amazon-last-mile-routing-research-challenge-data-set.pdf)。数据自身的 [CC BY-NC 4.0 许可](../data/public/v6-data-sources/amazon-last-mile-practice/License.txt) 与代码许可分开，不能称无商业限制。

实际核对得到 13 routes、13 Station、2,038 Dropoff，UTC 日期 2018-07-20 至 2018-08-25。3,129 是包裹出现记录，仅 3,125 个不同 Package ID；4 个 ID 在两个 stops 出现，不能静默按 ID 去重。完整旅行矩阵、stop/package 关联和实际 stop 序列 permutation 均通过检查。

这 13 条全部属于官方 6,112 条训练集，序列逐条一致，因此是 practice 子集，不能宣称新留出。用于这项核对的全训练实际序列仅下载到临时缓存；已归档其 URL/字节/哈希和匹配计数，没有追加 9.6 MB 大文件。

`planned_service_time_seconds` 为 4–732 秒，车容量为 3,313,071–4,247,527 cm³。210 条包裹记录有时间窗，2,919 条没有；原件把每个缺失起止字段编码为裸 `NaN`，route 的 `zone_id` 还含 29 个 `NaN`。这些文件不符合严格 JSON，原件保持不动，未来适配须另存明确标记的 null-normalized 派生文件，不能给缺失窗口造数。

可用于包裹路由的容量/窗口核验，不能作为实际仓库卸货、实时订单 release、箱位、空返或堆存/D&D 的真值。[字段检查结果](../data/public/v6-data-sources/amazon-last-mile-practice/schema-evidence.json)记录了这些限制。

## 3. Pharma：真实需求不等于全部真实动作

[Zenodo 数据](https://zenodo.org/records/15310106)，DOI `10.5281/zenodo.15310106`；数据论文 DOI `10.1016/j.dib.2025.111762`。作者为 Anna Vrani、Savvas D. Apostolidis、Athanasios Ch. Kapoutsis、Elias B. Kosmatopoulos。实下载 ZIP SHA-256 `f28906181e925fa1697b069febff350a331ee8cd73d99cd678de661a350a5005`；MD5 `0daa54c790e7c562665093de95ff1dec` 与 Zenodo 发布值一致，ZIP CRC 检查通过。

读取 `orders/orders.xlsx` 原生 XML 后，九个 sheet 的有效请求行分别是 **78/63/67/69/75/77/66/74/84**，共 653；不能把样式空行当订单，也不能把跨日复用的 NODE_ID 当全局唯一箱号。36 张矩阵均与当日请求＋depot 对齐，有限非负。原件字段为 `NODE_ID, WEIGHT, VOLUME, SERVICE_TIME, EAT, LAT`，第七列在前四张表叫 `TIME WINDOW`、后五张叫 `TIME_WINDOW`。

原论文第 4 节明确：重量、体积、地址与收件人类型来自 3PL 系统；服务及时间窗按收件人类型制定，缺失类型另行补录；距离/旅行时间通过 API 生成。时间窗以每日 08:00 为基准，单位分钟。这是**真实需求＋规则重构服务/时窗＋估计路由**，不能把 SERVICE_TIME 当真实完成时长。本文实际读了原论文 XML 的采集、属性构造、限制及许可段落，不仅使用摘要。

数据在 Zenodo 标 CC BY 4.0；另归档的论文 XML 自身标 **CC BY-NC 4.0**，两者不能混用。原 ZIP 没有日历日期、原始地址、实际动作时间、车队容量、港口生命周期或费用。原件与复算见 [数据 ZIP](../data/public/v6-data-sources/delivering-data-15310106.zip)、[工作簿字段审计](../data/public/v6-data-sources/delivering-data-workbook-audit.json)。

## 4. OCEL：可做中立港口过程审计，不能映射集装箱 p/u/r

[原 Zenodo 记录](https://zenodo.org/records/22019684)，DOI `10.5281/zenodo.22019684`，2026-08-20 发布，CC BY 4.0；发布者 Jia Wei、RongJia Song、Chun Ouyang、Weiping Cui。取得 `CargoPickup_IoT.sqlite`，SHA-256 `edcb515fddc502db99a2122cf8d69b951d00269644aa46f6d550a43bb017075f`；MD5 `dbf640c6245eaef91219a656aee57539` 与原记录一致。没有下载额外传感器附件。

原生对象只有 Cargo、Pickup Plan、Truck、Silo。货种为 Corn、Wheat、Rice、Potato、Other；269 提货计划要求 489 辆次，50 truck 对象、20 cargo、20 silo。事件覆盖申请、评估、批准、派车、进港、空车称重、到筒仓、装货、重车称重、出港等 20 类型。6,989 行事件日期范围为 2024-04-29 07:25:58 至 2024-05-31 08:51:12，无时区；元信息没有具体港口名、完整采集方法或关联原论文，现场真实性尚无法独立认证。

有 39 个 event ID 各重复一次且时间不同，只有 6,950 个唯一 ID；event-object 关系也有 39 个重复三元组。按 ID 联表可能乘行，直接 DISTINCT 可能删除不同时间的访问。事件时间均有值，已检查关系没有对象/事件孤儿。原记录和 [逐表审计](../data/public/v6-data-sources/port-bulk-ocel-22019684/sqlite-profile.json)保留重复证据。

可推荐的映射仅是**散货港口过程观测**：以源 Pickup Plan/Truck 关系列出 `Enter the port → Arrive at the Silo → Load Truck → Weigh the Loaded Truck → Exit the port`；为碰撞 ID 同时保留原 ID、行身份和时间，无法唯一归属的访问明确标歧义。可检查事件顺序、对象引用及可辨识访问区间，但对象状态更新不是完整资源日历。

不能把 `Enter/Load/Exit` 命名成 PortPlan 的提箱/仓库卸货/空箱归还。没有生命周期 start/complete 标识，`Load Truck→Weigh Loaded` 间隔包含后续活动，不是实测卸货时长；没有原生承诺时窗、dispatch release、每日资源容量或港口费。源记录的“空车称重”也不等于空集装箱归还。若做 occupancy 复算，必须先声明区间定义和缺失边界，不从观测数反推真实容量或优化节费。

## 5. 韩国公开箱级与接近的 container 论文附件

| 来源与实际访问 | 已确认内容 | 排除直接核心用途的理由 |
|---|---|---|
| [BSCC idx42](https://bscc.kr/user/corporate/view.bscc?idx=42&menuCd=DOM_000000103002000000) | web 索引目录/样例仍可读，直接 GET 为 503；广告 CSV 约 192,320 KB。 | 未取得完整 CSV；样例是箱级 gate 事件，不含卸船/通关/仓库/资源完整链；免费不等于已确认再利用许可。 |
| [bigdata-sea PROD_000375](https://www.bigdata-sea.kr/datasearch/base/view.do?prodId=PROD_000375) | web 获取 502，配置网络代理 tunnel 为 403。 | 原件未取得、许可未核；没有修改网络/身份或绕过限制。 |
| [韩国海洋水产部 container 目录 15011649](https://www.data.go.kr/data/15011649/fileData.do) | 实取得目录 JSON/HTML，目录许可范围不受限；标 XLSX/100 行。 | 实际下载 URL 指向交互 PORT-MIS 船舶/入港批次查询，未取得其所谓 100 行 XLSX 或真实需求资源记录。 |
| [Stoop 等 2024 Antwerp drayage](https://link.springer.com/article/10.1007/s00291-024-00762-2) | 读官方 Data availability 与公开机构接受稿；包含真实车队案例。 | 官方明确部分商业数据保密，其余需向作者索取；按任务未联系、未登录。 |
| [PLOS 2026 RMG container 任务](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0357406)及官方 GitHub | 正文称 Xi’an 110 实际任务，但 Data Availability 是 simplest dataset；实际 ZIP 用 `rng/randi/randn` 生成 synthetic 110 任务。 | 真实 110 任务未取得；公开代码的表格导出还有硬编码值，不能当实测复现。仓库无 LICENSE，不公开复用整个代码包。 |
| [Sage 2024 BET 案例对应 GJ89 仓库](https://github.com/pengdongbo/Results-for-the-standard-VRPB-dataset-GJ89-) | 实读 XLSX，为 62 个标准 GJ89 实例结果与路线。 | 没有该论文真实 BET 原始需求；不能由论文出现 real-case 字样推断这个附件也是真订单。 |

光阳 gate 数据与仁川公开 gate 样例的既有结论不变：它们是另一港口/过程的公开观测，不是 PNC 订单。本轮没有拿港口年/月统计、AIS 或轨迹图补齐缺失的箱级需求。

## 6. 最贴近 drayage 的 MIPLIB 仍是混合生成实例

实际下载了 [官方 `drayage-25-23.mps.gz`](https://miplib.zib.de/WebData/instances/drayage-25-23.mps.gz)，250,750 B，SHA-256 `207c00284a4edbe92f1cc11705e47f03156830a804fbaf748e19f7c84103e131`。解压为 2,946,494 B MPS；源头 [机构原报告](https://repub.eur.nl/pub/20883/ERS-2010-036-LIS.pdf)第 3 节实际读到：Dutch LSP 的 reefer 任务空间数据真实，但精确 timing 几乎缺失；作者抽样为 33 个 65-job 日实例，时窗、service、job announcement 与均质 40 trucks 均生成或标准化。

报告给 pickup/customer/return 服务 1h/1h/0.5h，不是 65 个箱逐一实测；生成不同 release-uncertainty 版本也不等于真实动态 arrival。MPS 有 11,090 变量、4,630 约束，包含匿名 `c0...` 行，不是完整原订单表，更不含 PNC tariff 或卸船/放行历史。

它可用于原数学模型的公开 benchmark，不能把全部时序称真实，或从匿名系数直接制造 PortPlan 实单。检查的官方实例/下载页未找到明确再分发许可，所以原数值文件仅保留临时取证缓存，交付 [下载元信息](../data/public/v6-data-sources/miplib-drayage-25-23.mps.gz.metadata.json)和原链接，不在许可明确的数据包中混入未核许可文件。

## 7. Dryad 的正式 CC0 不等于本轮已取得原 ZIP

[Dryad DOI 10.5061/dryad.6hdr7srbv](https://doi.org/10.5061/dryad.6hdr7srbv)，标题 *Routing short-haul trucks under the uncertainties of travel time and service time*。官方元数据为 CC0，文件清单描述 `Section_3_3_Real_case_dataset_and_results.zip`，28,702 B，47 客户真实案例 CSV、距离/时间矩阵与方案表。

官方给出的 SHA-256 是 `157b05582281337fdd12c7698d794cf509ddaf7c42282ff4d755430db4b5abf3`，**这是 advertised digest，没有实下载复核**。官方 API 下载路径返回 401、网页 Download 路径返回 403，已停止；取得的仅 [dataset metadata](../data/public/v6-data-sources/dryad-dataset.json)、[文件清单](../data/public/v6-data-sources/dryad-files.json)与落地页。不能把它计入已取得案例。

作者另行主动公开的 MIT 47 客户仓库已成功取得，访问的是正常公开 GitHub，没有重试或绕过 Dryad 限制。没有证明其三 CSV 字节与 Dryad ZIP 相同，因此分别保留来源、许可和取得状态，不能挪用 Dryad digest 来认证 GitHub 原件。

## 可实施的下一步与禁止的字段补全

1. 优先对 MIT 47 客户原字段、单位、节点/矩阵、窗口及需求做独立复算；若实现运输约束模型，以 source-derived freight benchmark 单独报告，保留 source matrix 非对称性，新增车队/容量与目标作为模型设定。它不会自动变成 PortPlan 费率模型的外部成绩。
2. 若需要港口现场过程证据，先对 OCEL 做事件碰撞、对象引用和可识别访问路径审计。可用原生业务词汇回放过程，不给未知容量造值、不由访时差生成“真实 unloadDays”。该模块只有在实际验证完整性/资源语义时有用，不作为节费演示包装。
3. Amazon 和 Pharma 可留作来源/字段质量对照，进一步通用路由实验必须单独协议、费用目标与数据层次；practice 样本、重构字段和缺失窗口都进入分母/限制。没有必要为了增加图表而把不相干任务强行塞进日级箱链。

若未来获得真实 container 请求但仍无费用合同，可以另建“真实请求字段＋公开标准费率仿真”的混合情景，并逐字段标真实、推导与假设。当前取得的资料还缺核心 discharge/release、仓库卸货及 matched empty-return 历史，不能用当前日期、默认 20/40 尺、默认一天卸货、虚构资源或跨港收费补成真实字段。

本轮调研无需用户提供数据即可完成；未取得完整实单是证据边界，不是停止开发的前提。现有公开规则与合成研究仍可继续，关于真实业务效果的声明保持受限。
