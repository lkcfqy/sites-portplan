# LogisticSolver 2026：2026-10-15 公开规则复查（V8）

记录时间：2026-10-15 08:32 UTC。下面的网页复查于当日约 06:04 UTC 完成；各完成时间取自本轮下载文件的修改时间。只读访问公开资料，未登录、报名、联系主办方或提交材料。本文件仅记录赛事规则证据，不代表完成参赛手续，也不代表 V8 实验结果。

## 本轮来源与变化

| 来源 | 本轮获取完成时间（UTC） | 结果 |
|---|---|---|
| [ANCHOR 官方比赛页](https://anchor.changwon.ac.kr/main/menu?gc=Program&do=sinform&spod=s1&program_id=VKoDUNlZwONq&psin_id=VKoDUNlMqh4n) | 2026-10-15 06:04:07 | HTTP 200；SHA-256 `99203d6e58ac422e64ec06ce2fe7c25f1f7e8b2a4f176c2560ae41ab0f08320e`，与 V4/V5 已保存原件字节一致。 |
| [工业系统工程系通知](https://www.changwon.ac.kr/ie/na/ntt/selectNttInfo.do?mi=6583&nttSn=1416220) | 2026-10-15 06:04:11 | HTTP 200；SHA-256 `93a32e6388c5f8a910567dfb7cebb8bdded59a9fd763f198c0ec20fe32152960`。与 V4 对比仅附件下载次数 21→25、13→16；未新增附件或正文规则。 |
| [ANCHOR 社区公告首页](https://anchor.changwon.ac.kr/main/menu?gc=597CJOU) | 2026-10-15 06:04:13 | HTTP 200；本页未见本赛新增规则说明。 |
| [ANCHOR FAQ](https://anchor.changwon.ac.kr/main/menu?gc=968YTYN) | 2026-10-15 06:04:16 | HTTP 200；未取得本赛新增解释。 |

本轮下载缓存位于 `/tmp/competition-recheck-20261015/`；它是临时工作缓存，不属于最终材料包。本轮没有覆盖旧证据或另存数据目录；可持久追溯的官网旧原件、海报与 manifest 仍见 [`data/public/v4-competition/`](../data/public/v4-competition/) 和 [`data/public/v5-rules/manifest.json`](../data/public/v5-rules/manifest.json)。比赛页本轮哈希与这些既有证据一致。完整历史研究见 [`competition-research-v4.md`](competition-research-v4.md)，上轮检查见 [`rules-update-v5.md`](rules-update-v5.md)。

本轮还用韩文检索 LogisticSolver、스마트물류 문제해결 경진대회 与 2026、심사、평가기준、평가、AI 等组合，并检查学校公开索引。未取得更具体的当届评分表、数值权重或 AI 条款。这是有界公开调查，未登录后的资料和主办方未公开通知不在已验证范围。

## 当届已确认事项

以下以 [2026 官方比赛页](https://anchor.changwon.ac.kr/main/menu?gc=Program&do=sinform&spod=s1&program_id=VKoDUNlZwONq&psin_id=VKoDUNlMqh4n)为主，并沿用已目视检查的[系通知 LogisticSolver 海报原件](https://www.changwon.ac.kr/common/nttFileDownload.do?fileKey=100bf928e03637d75436589b85a0c165)交叉证据。

| 项目 | 可确认内容 | 解释边界 |
|---|---|---|
| 比赛 | 2026 智慧物流问题解决竞赛，2nd LogisticSolver | 与另一项 Logi-nnovation 新事业创意赛不同。 |
| 主题 | 找出港口、国际、复合物流等产业问题，以技术与数据提出服务、解决方案、政策或策略 | PortPlan 港后提箱、卸货、还空联合计划可围绕这一主题陈述。 |
| 学籍 | 国立昌原大学在读学生，包含研究生 | 没有核实用户本人学籍。 |
| 团队 | 4 人以内组成团队 | 没有写明最低人数；单人队接受与否仍未知。 |
| 报名 | 免费，登录后申请，满额可按先到先得提前结束 | 公开页面状态不证明用户已报名或已占位；总定员也不是剩余名额。 |
| 材料截止 | **2026-11-06 18:00** | 页面无独立时区标签；按韩国当地 KST 理解则为 09:00 UTC，需以主办方安排为准。 |
| 初审 / 展示 | 2026-11-13 / 2026-11-20 | 不能把展示日期当作报告与代码提交截止日。 |
| 初审材料 | 报告、数据、代码等全部提交 | 仅提交 Sites 链接不足以覆盖公告列出的材料。 |
| 展示材料 | **20 页以内** | 当届格式、另行提交时间和演讲/问答时长未取得证据。 |
| 最高奖 | 대상：1 队，庆尚南道知事奖 | 另列最优秀、优秀及鼓励奖；不能承诺名次。 |

系海报使用 `rise.changwon.ac.kr` 入口，ANCHOR 项目页使用会员申请入口；没有执行账户操作，尚不能确认两者是否互通或是否需要分别办理。

## 尚未确认的事项

- **公开规则没有给出已验证的评分维度和数值权重。** 项目内部验收门槛、实验改进幅度与开发优先级均不能标成官方评分表，也不能用于计算夺冠概率或保证第一名。
- 报告篇幅、当届展示文件格式、展示材料另行截止时间、演讲/问答时长；不能套用另一赛道的 5 页商业计划书限制，也不能把 2025 时长当成 2026 安排。
- 用户本人资格、报名状态、可用名额、单人队是否接受，以及具体报名/材料上传步骤。
- 英语或双语答辩是否接受；公开材料没有建立明确许可或禁止。
- 当届生成式 AI 使用、贡献披露与个人创作誓约的具体规定；没有取得 2026 完整誓约原件。

历史边界：[2025 官方追加募集 HWP](https://www.changwon.ac.kr/common/nttFileDownload.do?fileKey=80ba177d7105abfe736e49ff43210095)的参赛誓约要求本人直接创作，并禁止虚假信息、抄袭、代写和代讲。原件没有专门生成式 AI 条款；2026 是否沿用、代写条款如何适用于 AI 辅助仍未确认。因此不能称其为“2026 明确 AI 禁令”，也不能声称主办方已批准全部 AI 代作。

可继续完成研发、验证、归档及材料准备；实际报名、本人身份、当届誓约与真实贡献需由参赛者如实确认。具体自检和办理清单见 [`entrant-readiness-v8.zh.md`](entrant-readiness-v8.zh.md)。
