# V12：旧失败快照上的 CP-SAT / HiGHS 预声明诊断

这项比较只诊断已经看过的 V10 失败输入，不重新运行完整在线策略，不产生新订单或新留出成绩。相同的订单/当前公开容量/真实历史锁分别交给新 CP-SAT 和原始 `highsV8`；2000ms 档是额外离线诊断，不能冒充 200ms 实时榜。

固定选取 `data/commitment-slack-review-v11.json` 的 `v10VsV7LossEpisodes` 中所有 `repeatIndex=1` 条目。实际恰好 9 个不同场景：5 个 D0、1 个 D4 和 3 个 D6。全部纳入，不依据求解状态或费用剔除难例。原输入、原失败、全部不利状态继续保留。

公共快照从原输入 `nominalScenario` 和失败日及此前实际 `timeline.observedEvents` 重建。只有明确的公开 `announcedDuration` 可以改变尚未观察的未来日；没有公告的未来保持名义值。物理锁只来自失败日前 `executedEvents`，不导入失败日尚未执行的方案。重建后的原始 `observationHash` 必须逐字节匹配，并核对 V11 已记录的快照和锁 SHA（存在时）。`input.events` 原档只用于留存来源，不传入任何诊断 planner。

每点有两个方法 × 两个预算档，共 36 个冷任务；每个任务都启动全新的工厂和 Python 服务，没有导入前次缓存或更长预算解。方法固定一线程、seed0。日调用分别为200ms或2000ms，ready、冷启动、该次调用、清理、IPC和父层完整候选核查合计仍受共同5秒父进程硬期限。确定性轮转预算和方法顺序，严格串行执行。

```sh
# 先声明并写原档、源快照、所有9个公共输入；不会创建native服务。
node scripts/compare-native-v12.mjs --declare \
  --output artifacts/native-diagnostic-v12-first

# 仅在获得独占CPU计时窗口后启动，不与其他研究求解竞争。
node scripts/compare-native-v12.mjs --run \
  --directory artifacts/native-diagnostic-v12-first \
  --summary data/native-diagnostic-v12.json
```

输出目录必须是全新路径；声明、source、original、snapshot、每个原始结果、checkpoint、首次完成索引和摘要均使用独占创建，绝不覆盖。`execution-start.json` 是启动锁，已有启动记录的任务集不能悄悄重试。若基础设施错误导致首次尝试中止，保留所有已写结果，任何修订应在新目录中明确声明，不能当作删除第一次成绩。

实际 worker 从声明中保留的源快照导入两个适配器/服务，运行前核验源、输入和原档 SHA。每条记录保留完整 native certificate，包括状态、下界、完整候选、过期候选拒绝、双语言内层审核和时钟；另保留ready、父进程接收/核查/退出时间、硬截止与进程组清理。未及时交付完整计划时金额为null；raw晚下界只能作为原始遥测留存，不写成摘要的及时可用 `lowerBound`。

只有完整有效候选且父终端接收/复算/退出都在五秒内，才记 `acceptedPlanWithinBudget=true`。这表示当前确定性快照可排出计划，不代表后续未知轨迹能完整执行，更不表示现实资源已执行。`complete.json` 和摘要明确 `independentPythonReviewComplete:false`；独立 Python 物理/费用/信息范围审核由另一个实现单独完成，runner 不自行宣称第三方认证。

本文件是预声明方法，尚不填任何预计更优结果。完整原档的 XZ 打包与站点发布由根工作流另行处理，venv 不进入ZIP或证据归档。
