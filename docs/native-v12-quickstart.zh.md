# 在另一台电脑运行 V12 原生规划器

网页开发、读取既有研究证据和运行原生规划器是三个独立入口。网页先按[恢复指南](recovery-guide.zh.md)执行 `npm ci`、`npm run build`、`npm run dev`。V12 原生方法使用 Node.js 与 Python/CPU，不需要 GPU；当前限时研究使用 Linux/POSIX，其他操作系统的原生时钟和进程组清理尚未验收。

## 最小单次规划示例

先在项目根目录安装原生研究依赖：

```sh
python -m pip install -r requirements-research-v4.txt
```

下面是与预冻结工厂检查同形的**手写合成单箱**，不是公开实单或新研究成绩。运行一次，只观察返回的状态、日期和审核结果；失败时保留状态，不把费用空值当零，也不靠反复运行挑最好的一次。

```sh
node --input-type=module <<'JS'
import {createSeededCommitmentHiGHSPlannerV12} from './scripts/highs-planner-v12.mjs';
import {auditSchedule} from './src/engine.js';

const scenario = {
  id: 'handwritten-v12-example',
  horizonStart: '2026-10-12', horizonDays: 4,
  truckCapacity: 2, warehouseCapacity: 1, stagingCapacity: 2,
  containers: [{
    id: 'example-C1', sizeFt: 20, releaseDay: 0,
    unloadDays: 1, dueDay: 2,
    dischargeDateTime: '2026-10-10T07:00:00+09:00',
    dataOrigin: 'synthetic'
  }]
};
const planner = createSeededCommitmentHiGHSPlannerV12();
try {
  await planner.ready();
  const result = await planner(scenario, {
    timeBudgetMs: 200, minEventDay: 0, fixedEvents: {}
  });
  const completePlan = ['feasible', 'optimal'].includes(result.status)
    && result.rows.length === scenario.containers.length;
  console.log(JSON.stringify({
    status: result.status,
    rows: result.rows,
    incrementalCost: result.incrementalCost,
    audit: completePlan ? auditSchedule(scenario, result.rows) : null,
    selection: result.plannerMetadata?.stabilitySelection
  }, null, 2));
} finally {
  await planner.close();
}
JS
```

这里是一次静态规划调用，`ready()` 与 `close()` 在调用外单列；它没有5秒父进程硬截止，不能拿它的耗时冒充正式冷启动滚动 episode。200ms是合作式调用预算，及时接受完整初解与整个函数准时返回分别记录。浏览器静态工作台和自定义执行页保留各自支持的方法，不能把网页方法的表现写成原生 V12 表现。

有实际已执行动作时，`fixedEvents` 按箱号记录 `pickupDay`、`unloadDay`、`returnDay`，日期必须严格早于 `minEventDay`。只传当前可观察的场景与容量，不能把未来私人事件列表交给规划器。构造初解和原生候选都必须通过完整日期、资源、费用和历史锁审核。

## 读取和复核首次正式研究

正式分块归档生成后，下载清单列出的全部包合并解压，运行：

```sh
python scripts/restore-evidence-v12.py
python scripts/review-v12.py --run data/evidence-v12/v12-frozen-first/first-run
python scripts/review-bootstrap-v12.py --run data/evidence-v12/v12-frozen-first/first-run
```

复核默认只输出结论，不覆写已发布审核，也不重跑优化器。首次输入、失败、完整原始输出、源码及SHA保持不变。需要重新做限时实验时，从归档冻结 runner 启动并指定**全新**输出目录；不同机器时序可产生不同结果，不能覆盖首次成绩：

```sh
node data/evidence-v12/v12-frozen-first/source/scripts/benchmark-v12.mjs \
  --run --frozen data/evidence-v12/v12-frozen-first \
  --output artifacts/v12-reproduction-01
```

本轮仍未通过默认替换门槛。全部完成损失的只读解释见[负例诊断](v12-loss-diagnosis.zh.md)；需要独立重算时，创建输出目录后运行以下命令，它不调用优化器，且拒绝覆盖已有诊断：

```sh
mkdir -p artifacts
python scripts/diagnose-v12-losses.py \
  --run data/evidence-v12/v12-frozen-first/first-run \
  --output artifacts/v12-loss-recalculation-01.json
```

个人练习可使用上面的合成单箱和既有公开证据，不需要企业订单、报价或联系人。本人是否已实际复现、能否解释方法和限制，仍须据实记录；这份说明不代替本人完成记录、资格确认、报名或正式提交。
