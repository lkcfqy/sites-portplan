# V15开发记录与当前源码恢复

V15是基于已见V14失败端点的受控开发回放，不是新业务样本、自然从D0开始的完整正式研究，也不提供新的置信区间。最新正式研究仍为V14。候选方法ID为 `timelyHiGHSV15`；本轮只检查预先固定的原生返回预留时间10ms，整次调用200ms与父时钟5s预算不变。首次36分支和冻结Python首审现已完成，三方法均5/12、无完成增损；[实际结果](v15-development-results.zh.md)不能替代下面的文件恢复检查。

## 当前全部包

读取 `/data/download-packages-v15.json`，下载 `packages` 全部动态列出的ZIP，逐个核对 `bytes`、SHA-256和安全成员后，合并解压到同一个父目录中的 `portplan/`。旧V9—V14别名也列出同一当前包集合。V15按归档种类独立分包，每5片一组，例如 `portplan-experiments-v15-delivery-development.zip`；以实际清单为准，不固定包数。

安装Node.js 22.12或更新版本（本轮实际24.19.0）及Python 3.12或更新版本，确保`python`指向该解释器。进入恢复项目先读 `AGENTS.md`，再运行：

```sh
npm ci
npm run build
```

当前源码包无需Git、所有者凭据或22片省略的旧V8/V9二进制即可构建。固定省略清单、授权历史Git和旧Sites保存版本范围继续见 `historical-transport-policy-v14.json` 与 [V14恢复说明](recovery-v14.zh.md)。网站现允许匿名读取，Git仓库权限与未发布历史归档权限保持各自范围；ZIP仍不带Git历史、凭据或管理权限。

## 仅恢复新增V15开发归档

下载包保留 `data/archives-v15/<kind>/` 的原始分片、manifest和完整逐文件收据。只有实际生成的归档才可恢复；原始回放、失败、审核及冻结源码不覆盖。`data/evidence-v15/` 是可重建的展开目录，不再进入源码ZIP。按需选择实际存在的kind，例如：

```sh
python -B scripts/restore-evidence-v15.py --manifest data/archives-v15/delivery-development/manifest.json --destination data/evidence-v15
```

新入口只接受 `v15-` 根目录的generic development归档，完整检查每片、合并XZ、TAR安全成员、入口及全部文件SHA，再通过已冻结V14运输恢复器在目标内stage并同文件系统重命名安装。首次新目标需要一份展开原档加压缩临时空间；对已有目标做幂等复核还需要额外一份stage。已存在且字节一致时复用，冲突内容拒绝替换。该操作不运行原生求解器，也不重复恢复约4GB的V14正式原档。

开发只读审查应使用归档内实际冻结的 `review-delivery-v15.py`、原始 `--run` 目录和全新的外部 `--output` 路径，并加 `python -B`，防止改写归档中的Python缓存。实际相对路径、来源SHA、分支数量和审核绑定以开发manifest及原始收据为准，不能用 `--fixture` 或重跑native代替原审核。完整包安装、V15原档恢复和只读审查分别记录，不把其中一步称为新正式实验或冠军证明。

当前`delivery-development`归档的实际审核命令为：

```sh
python -B data/evidence-v15/v15-seen-delivery-first/artifacts/v15-seen-delivery-first/source/scripts/review-delivery-v15.py --run data/evidence-v15/v15-seen-delivery-first/artifacts/v15-seen-delivery-first --output artifacts/recovered-v15-review-01.json
```

输出SHA应与`data/review-delivery-v15.json`一致：`588c5e5f9beb549765a746a311a70d5fc22d23d4947cbd45ab349900b0985cf5`。命令只使用Python标准库，不需要GPU、SciPy或原生优化器。新增开发归档约169MB原文，公开访问证明另约4.24MB；当前源码、依赖、构建和临时stage仍需额外空间，建议至少留2GB。若要恢复旧V14正式约4GB资料，继续单独按V14指南的磁盘预算执行，不混入本次小恢复。

## 验收边界

最终当前包的实际恢复验收应绑定当次全部ZIP的清单SHA，验证无Git干净安装和构建，再仅恢复V15各kind、执行冻结只读审查并重核全部恢复文件SHA。已保存的V14成功收据与全部历史失败不重写，也不在V15验证中再展开V14原档。包数、大小和平台25MiB/256MiB限额必须在实际最终构建后核对；本准备说明本身不证明尚未执行的恢复或开发回放已经通过。
