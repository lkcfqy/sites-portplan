# PortPlan V5 发布检查

本文件记录产品发布检查；它不替换首次研究结果或声称真实业务收益。

- `python scripts/verify-release-v5.py`：126 项测试通过，V4/V5 冻结结果 SHA 保持一致，标准库独立审阅 `valid:true`。没有重跑研究实验。
- 工作台：默认 V5 三候选；切回 V4 后七策略可重算。两种模式导出的 12 箱 CSV、可见日期与费用、scenario JSON 的求解配置一致；示例新增费为 2,309,600 韩元。
- V5 研究页：归档与浏览器因果执行重跑、执行 JSON 导出、取消与换场景停止、键盘日期滑块通过。108 条主方法记录与 42 条证书实例均显示；8 个资料下载返回成功。
- 初始工作台不请求 V4/V5 研究档案。进入 V5 研究页仅读取当前视图的 JSON，首次切旧版才加载其档案；浏览器请求记录确认延后读取和按视图读取，资料下载仍完整保留。网络中断模拟的重试与迟到响应保留当前视图检查通过；切子视图也会停止重跑 Worker。
- 390×844 与 1440×1000 本地浏览器检查通过，V5 四类视图与 V4 四类档案均无页面横向溢出，移动导航保持一行。修正了 V4 信息哈希断行和手机端场景选择栏压缩。控制台与 HTTP 错误均为零。
- 韩文 PDF 16 页。检查所有页面内容与页脚不重叠，并目视检查关键费用取舍、证明范围页；文本包含实际结果。
- 生产构建采用本地静态 Vite/GLPK Worker。上传订单仍在浏览器中求解，新的研究执行 Worker 可以停止；产品组合预算单独披露，不套用研究的父进程 1 秒成绩。

可选浏览器复现需系统 Chromium；这不属于部署依赖：

```sh
python -m pip install -r requirements-browser-v5.txt
npm run build
npm run preview -- --port 5174
# 另一个终端，默认写到忽略的 artifacts/browser-v5/
python scripts/browser-qa-v5.py
```

用 `PORTPLAN_QA_BASE` 指定本地预览地址，`PORTPLAN_CHROMIUM_PATH` 指定 Chromium。PDF 生成用本地开发服务，先 `npm run defense:v5` 与 `npm run dev -- --port 5173`，随后 `python scripts/render-defense-v5.py`；可用 `PORTPLAN_DEFENSE_URL` 指定本地展示 HTML。它写 `docs/defense-v5.ko.pdf`，布局检查与截图写入 `artifacts/defense-v5/`，不改变研究 JSON。

首次研究证据、独立核验和红队限制分别见 [report-v5.zh.md](report-v5.zh.md)、[reviewer-v5.md](reviewer-v5.md)、[results-redteam-v5.md](results-redteam-v5.md)。
