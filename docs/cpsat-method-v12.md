# V12 独立原生 CP-SAT 原型：同一日模型的另一种表达

本原型用于独立同模型诊断和离线强参照，不加入本轮 V12 正式六方法分母。尚无新正式面板成绩，也不预设它比 HiGHS 或现有方法更强。只使用手写小情景、既有开发输入和可核验公开参考；没有要求企业实单、联系人或私有报价。

新增服务 `scripts/cpsat-service-v12.py` 独立编写 Python 校验、费用和逐日物理账本，不导入 HiGHS/SciPy、`certify-v4.py`、JavaScript 系数或旧 MILP 矩阵。Node 适配器 `scripts/cpsat-planner-v12.mjs` 仅复用已有 JSON-lines 通信、初始化、期限和第二语言审核规范。所有旧算法与正式证据保持不变。

## 依赖隔离与许可

```sh
python3 -m venv /workspace/.venvs/portplan-cpsat
/workspace/.venvs/portplan-cpsat/bin/python -m pip install -r requirements-cpsat-v12.txt
PORTPLAN_CPSAT_PYTHON=/workspace/.venvs/portplan-cpsat/bin/python \
  node --test tests/cpsat-v12.test.mjs
```

依赖锁定 OR-Tools `9.15.6755` 及本环境实际安装的传递依赖。当前环境为 Python 3.12，venv 自带 NumPy，不改变原研究环境 NumPy 2.3.5 / SciPy 1.17.0。无需 GPU。venv 与 wheel 不纳入源码 ZIP；复现者按依赖锁安装，或用 `PORTPLAN_CPSAT_PYTHON`/工厂配置指定独立 Python。网络安装保持继承代理与 CA 校验，不绕过网络策略。

OR-Tools 使用 Apache-2.0；官方 RCPSP CP-SAT 参考及其许可证已保存在 `data/public/v7-external-methods/ortools/rcpsp_sat.py` 与 `LICENSE`。本项目没有把 RCPSP 算法结果称为本问题成绩，也没有拷贝旧 HiGHS 的数学构造。参考的全局 Cumulative 与 interval 建模概念来自 OR-Tools 官方公开文档和该已归档样例。

## 独立数学模型

每箱三个整数决策日 `p`、`u`、`r` 分别表示提箱、开始卸货、还空。它们严格位于 `0..H−1`，并满足释放日、`u≥p`、连续卸货末日不晚于交期及 `r≥u+unloadDays−1+returnLagDays`。过去事件逐项等于真实已执行锁；尚未执行事件不能安排到当前决策日之前。

资源使用 CP-SAT 的全局 interval/cumulative 约束：

- 运输：分别放入 `[p,p+1)` 与 `[r,r+1)` 两个单位需求 interval。同日提还仍消耗两次运输。
- 仓库：`[u,u+unloadDays)` 连续 interval，每日一个卸货槽，已开始卸货的历史与后续日都不能消失。
- 堆场：变量长度的 `[p,r)` interval；箱单位 demand=1，TEU 单位 40ft demand=2。`p=r` 时长度为零，不产生堆场占用。

对变化日容量 `cap[d]`，取该资源规划期最大容量 `M`。每一天增加固定 `[d,d+1)` 占位 interval，demand=`M−cap[d]`，并令全局 cumulative capacity=`M`。于是每个整数日恰好留下 `cap[d]` 给真实箱使用；包括全部已执行历史日。该表达不删除因容量不足而暂时不可行的日期，也不偷看未来冲击。

提箱日的仓储费增量、还箱日的 D&D 增量分别通过 AddElement 选择独立价格表，再最小化总和。PNC 默认按最高到达档位追溯重定价超免费期全部天数；Maersk 默认按已声明的渐进档累加。韩国 08:00 仓储起算、20/40ft、历史已计提费用与新增费用均分别复算。既有已声明的渐进/追溯敏感性覆盖也保留，不默默替换其假设；费用仍非合同或实际收益证明。

## 整数状态、上下界与时限

CP-SAT 要求每个事件增量费用为安全整数 KRW，总最大目标不超过 JavaScript 安全整数上限。分数价格直接拒绝，不四舍五入。完整两费、沉没费用与新增费用分开输出。

`solverStatus` 保留原 CP-SAT 状态整数，`solverMessage` 保留 `OPTIMAL/FEASIBLE/INFEASIBLE/MODEL_INVALID/UNKNOWN` 名称。只有及时完成双语言审核的 OPTIMAL 才标为当前整数模型最优；FEASIBLE 仅为可行 incumbent；只有 INFEASIBLE 才声明当前观察和固定历史下无解。UNKNOWN 与预算耗尽都不称无解，所有无候选金额为 null。

OR-Tools 的 `objective_value` / `best_objective_bound` API 是双精度遥测，可能把整数 61,850 显示成 61,849.99999999999。原始遥测保留在 `reportedObjectiveDouble` / `reportedLowerBoundDouble`。候选目标从整数费用变量逐项精确求和，与独立逐日账本严格核对；不对价格作舍入。OPTIMAL 状态建立后，精确整数目标本身给出匹配下界，并明确 `lowerBoundSource`。FEASIBLE 保留未取整的原生下界遥测及出处；未知、模型非法或无解结果没有有限费用目标或误导性的零下界。

固定 `num_search_workers=1`、`random_seed=0`、相对/绝对 gap limit=0，无额外并行 portfolio 或 GPU。固定线程与种子不消除墙钟造成的重跑差异。

工厂 `createCPSATPlanner(configuration)` 与原生 HiGHS 同样返回可顺序调用的 planner，并提供异步 `ready({timeoutMs})` 和幂等 `close()`。默认日预算 200ms、审核预留 2ms、硬中止额外宽限 250ms。`ready` 的服务启动计入父进程冷 episode 总预算，不能免费预热。日预算包含克隆、校验、缓存审核、IPC、CP 建模/求解、Python 审核、JS 费用/资源/历史审核和选择证明构造；新候选过期拒绝。此前及时审核的缓存可在可选求解迟到时保留，但仍只记可行，不升级为滚动全局最优。

服务和适配器保留模型/求解/审核耗时、原生时限、输入接收剩余时间、单线程/种子及完整 native certificate。若完整已审计候选在服务终态构造时跨过期限，候选留在 `discardedLateCandidate` 供诊断，接纳字段仍为空且不标最优；过期无解证明同样仅标记为已丢弃。请求只传当前 Scenario、过去锁和绝对期限，未传未来真实容量恢复列表。原生服务/线程调度、终端 IPC 仍需父进程硬截止，协作期限不是跨机器实时保证。

## 当前核验范围

`tests/cpsat-v12.test.mjs` 不导入 JS 引擎或旧 certifier 作为 oracle，使用完整手写日期元组枚举与直接逐日资源统计，对照包括运输/仓库关闭、TEU、同日双运输、历史完成、持续卸货、截止/末日/lag 和手算费用边界。另核对公开费率起算与分数拒收、未知状态及进程启动/关闭。

本轮 6 项测试全部通过，无跳过。其中完整枚举组覆盖 17 个手写快照；另外核对手算金额、时钟起算与进程/状态边界。测试使用 2 秒正确性预算，不属于统一 200ms 性能成绩。开发中曾因原生 double 遥测与精确整数不完全相等而错误拒收，现改为精确整数变量核对并保留原始 double，未更改费用定义。

这些属于小实例正确性核验，不是正式新种子或总体性能研究。若原型在后续旧开发例上很慢、UNKNOWN 或不利，同样保留原记录，不以新正式场景替换或筛选。
