# 当前源码包与V8/V9历史原档恢复

当前发布的下载包保留实现源码、依赖锁、全部源JSON与哈希清单、公开输入、当前构建需要的V6/V7资料，以及其他未列为省略项的证据。**只有22个V8/V9历史二进制分片不在当前ZIP中。** 原始源码树、授权Git备份、原始归档和所有历史SHA均未删除或重写。

这项分层用于满足静态网站单文件25MiB、展开归档256MiB的限制，不改变实验成绩或算法。V14首次正式研究和两份独立审核现已完成，压力默认门槛未通过；各版本的研究状态与分母仍以对应结果和独立审核为准。文件恢复检查不能代替算法、浏览器或本人验收。

## 只恢复当前网站源码与保留证据

保存 `/data/download-packages-v14.json`，下载其中 `packages` 列出的全部ZIP，核对每个文件的 `bytes` 和 `sha256`，再解压到同一个父目录，合并为一个 `portplan/` 项目。包数由当次清单决定。V9—V13的下载清单别名也列出相同的当前包，并附同一省略政策，不代表包含那些历史版本的全部原档。

进入项目后先读 `AGENTS.md`。使用Node.js 22.12或更新版本（本轮实际为24.19.0）与Python 3.12或更新版本，确保 `python` 指向该解释器，然后运行：

```sh
npm ci
npm run build
```

当前包的原样安装和构建不需要Git凭据，也不需要省略的V8/V9分片。V6/V7必要归档仍在当前包中，构建按现有流程恢复其展示资料。原生求解依赖、重跑算法和恢复大型正式原档是独立操作，不属于上述网站构建。

包内 `source-recovery.json` 保留当前AGENTS、安全Sites身份、明确的历史省略范围和全部保留源码路径清单。恢复包重构建时只允许政策列出的22个历史分片缺失；其他保留源码路径缺失会报错。后续编辑仍存在的源码会记录为新的打包快照；若要删除或重组已声明源码路径，先转到拥有完整来源记录的授权Git工作副本，不要删改恢复清单来掩盖缺文件。

ZIP没有 `.git/`、Git提交历史、运行环境或凭据。它是当前源码与保留证据快照，不能称为完整历史归档或完整Git克隆。原Sites的 `project_id` 与静态目录配置仍保留，换电脑不应另建同名项目。

## 恢复当前V14正式原档

当前V14分片按归档种类分开打包，每5片一组。例如正式记录使用 `portplan-experiments-v14.zip` 及其 `-part2` 后续包，首次浏览器记录独立使用 `portplan-experiments-v14-browser-first.zip`；复测记录另包保存，不与正式记录合并。所有实际包及大小仍以下载清单为准，构建同时检查每个静态文件不超过25MiB。

下载并合并所有当前ZIP后，按需恢复V14正式原档：

```sh
python -B scripts/restore-evidence-v14.py --manifest data/archives-v14/formal/manifest.json --destination data/evidence-v14
```

新恢复器先在目标目录内建立临时stage，逐片核对压缩归档和每个原始文件SHA，再在同一文件系统内重命名装入恢复根。恢复期间需要一份展开原档，加上较小的压缩临时文件和现有分片空间，不采用旧V12恢复器的完整stage再完整复制流程。目标已存在且逐字节一致时可幂等复用；存在冲突内容时拒绝替换，不覆盖原件。该命令只恢复已保存记录，不运行求解器或重新生成成绩。

正式原档为4,016,168,738个字节；连同源码、依赖、构建和临时文件，建议先留至少8GB可用磁盘。恢复完成后，直接运行冻结原档中的两份独立Python程序：

```sh
python -B data/evidence-v14/v14-frozen-first/source/scripts/review-v14.py --run data/evidence-v14/v14-frozen-first/first-run --output artifacts/recovered-v14-physical.json
python -B data/evidence-v14/v14-frozen-first/source/scripts/review-bootstrap-v14.py --run data/evidence-v14/v14-frozen-first/first-run --output artifacts/recovered-v14-statistics.json
```

这两份复核只需Python标准库，不导入JavaScript、不运行求解器或新增实验；`-B`防止重写冻结缓存。输出文件必须是新路径，重复执行时更换文件名，不覆盖首次复核。正式首索引SHA、物理与统计复核SHA见`data/v14-results.json`和`data/v14-release.json`。

已完成的同Linux空目录演练见[恢复收据](../data/recovery-verification-v14.json)：21包合并、993份保留源码、安装、构建、四份V14归档3994文件恢复、冻结双审重算及事后SHA全部通过。该收据只认证其中绑定的`497c414f93d49b37d70ffcdcf5849cedcd62a3b0df924a0aa19bc8bb785f4f03`分包清单；加入收据和证明归档后的最终包另行核验，不把这份收据泛称为任意后续包已安装。未测试其他操作系统，也不代表参赛者本人已完成复现。

## 取得22片历史原档

精确清单是 `/data/historical-transport-policy-v14.json`：V8有10片（含1片开发归档），V9有12片，共73,513,198个原始字节。每片给出原路径、字节数、SHA-256；所有对应JSON和原哈希清单仍保留在当前源码包中。

**主要恢复来源是原项目的授权私有Git源码**，固定提交：

```text
f99d252180d87ef616278ca8e14e17b496480fb4
```

使用拥有原Sites源码仓库权限的账户打开或克隆完整Git来源。当前源码下载ZIP不携带仓库权限；需要历史资料时使用自己已有的授权，不将临时凭据写进源码、命令分享记录或ZIP。该提交的22片文件已逐个核对原始字节和SHA。

在授权Git副本中，可以从固定提交提取 `data/archives-v8/` 和 `data/archives-v9/`，再按政策逐片校验。确认这些历史路径没有需要保留的本地修改后，可执行：

```sh
git restore --source=f99d252180d87ef616278ca8e14e17b496480fb4 --worktree -- data/archives-v8 data/archives-v9
```

此命令只用于授权Git工作副本，不适用于没有 `.git/` 的下载包目录。若仍使用下载包项目，将核验后的22片按原相对路径复制进去即可；不能用重新生成订单、重新运行算法或改SHA代替原件。

原片齐全并核验后，可按各版本自己的恢复说明运行旧恢复器，例如：

```sh
python scripts/restore-evidence-v8.py
python scripts/restore-evidence-v9.py
```

这恢复保存的原始记录，不重跑优化器。按需选择一个版本恢复，避免同时展开不需要的大型旧归档。独立审查冻结Python源码时使用 `python -B`，避免在恢复副本中重写随归档保留的 `.pyc`；V13首次scratch缓存现象与后续逐文件核验记录保持不变。

## 第二历史记录与范围边界

同一项目的旧Sites保存版本14是第二历史记录：

```text
YOUR_SITES_PROJECT_ID~appgver_387ea040c75481918d2412f31941b8d7
```

它对应上述Git提交及当时的完整下载包，需通过授权Sites版本访问。这里没有声明一个可匿名访问、永久不变的历史归档直链；当前站点URL和相对 `/downloads/` 地址会随新发布变化，不能当作旧版本的不可变下载地址。

首次从完整源码打包时，构建器必须同时核对政策列出的原片字节与固定Git对象，才允许在当前ZIP中省略；从已核验的当前包恢复后，则以包内明确的省略政策和保留源码清单重构建，不强求已经省略的文件或Git对象存在。其他任何省略、冲突历史字节或丢失的保留源码均拒绝打包。

本说明区分当前构建恢复、历史资料恢复、算法重跑、独立审查及用户本人复现；任何一项文件检查不自动证明其他系统兼容性、浏览器验收、经营收益或比赛名次。

磁盘预算：单份展开原档的优势针对首次恢复到新目标；若目标已存在，幂等核验仍需额外一份完整临时 stage，加上已有目标占用。请按 manifest 的 uncompressedFileBytes 和 archiveBytes 预留空间。
