# PortPlan V8：独立审核记录

审核日期：2026-10-15。对象为首次冻结144业务场景、三次重复、五方法的2160次完整运行记录。正式索引SHA-256为`e873aae0c65fcf51d7335fb3aa57f5285bdbb12bf9c286fb4018c8b2213205b6`。

## 物理执行与点估计

`scripts/review-v8.py`输出`data/review-v8.json`，`valid=true`、`fixture=false`。逐条校验冻结源码/协议、独立生成的输入、因果观察哈希、过去动作锁、连续卸货、半开在场占用、运输箱次、TEU、完整费用及null失败费用，并验证V8修整接受守门和配对点估计。

| 核验项 | 覆盖 |
|---|---:|
| 方法运行 | 2,160 |
| 完整执行路径 | 1,089 |
| 终端历史未知 | 0 |
| 接受的完整候选 | 16,400 |
| 原始物理事件 | 211,673 |
| 修整证明端点 | 1,606 |

## 统计区间

`scripts/review-bootstrap-v8.py`输出`data/bootstrap-review-v8.json`，有效且绑定同一正式索引和冻结manifest。它独立读取完整episode及SHA，重新确认完成资格，以场景为抽样单位，预固定seed700001、2000次LCG抽样，复算两面板五组比较的完成率差、总两费和新增费区间及分母，全部匹配。

数值核对容差：费用1e-6韩元、百分比1e-9个百分点、完成率1e-12。区间条件于共同完成集合，不消除完成选择偏差；三次重复不增加独立业务场景数。这个额外统计审核在算法冻结后独立编写，不改变原算法、原始运行、统计程序或首次结果。

两个程序都只读、不导入或执行JS、不调用求解器。这里的“独立”指内部不同语言/不同实现的重建，不是外部机构认证；没有证明实际企业收益、全路径最优或比赛名次。原生HiGHS的当前快照状态不升级为整条未知未来路径的最优证明。

## 留存与复现

原始数据和首次方法源码保存在`data/archives-v8/formal/`的3.5MB以内SHA分块；恢复后目录为`data/evidence-v8/v8-frozen-first/`。开发实验另保存在`data/archives-v8/development/`，不得与正式分母合并。所有不利案例、失败、费用上升、完成损失和重复不一致均保留。

```sh
python scripts/restore-evidence-v8.py
python scripts/review-v8.py --run data/evidence-v8/v8-frozen-first/first-run --output artifacts/review-v8-reproduction.json
python scripts/review-bootstrap-v8.py --run data/evidence-v8/v8-frozen-first/first-run --output artifacts/bootstrap-review-v8-reproduction.json
```

审核输出路径必须不存在；不覆盖首次审核。具体实验结果、退步原因和后续工作见[中文报告](report-v8.zh.md)。
