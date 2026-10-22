# PortPlan：换电脑恢复与继续开发

PortPlan 可以在另一台电脑恢复开发，不依赖原机器缓存。当前主路线是公开资料、公开费率、公开基准和有明确标记的可复现实验；企业实单、私人报价、联系人及试点均为可选增强，恢复或继续研发不需要先提供这些资料。进入项目后先读根目录 `AGENTS.md`，保留这项用户约定。

## 选择恢复来源

**优先使用有权限的最新 Git 源码。** 在已授权的 Sites 账户/工作环境中打开同一项目并同步原源码仓库，或使用为该私有仓库取得的有效 Git 凭据。私有仓库不保证匿名克隆；原机器的临时凭据不会随源码迁移。Git 中的 `.openai/hosting.json` 保留原项目身份，不能因为换电脑而另建一个同名站点。

**也可使用站内下载包恢复文件快照。** 打开当前研究页的“全部下载包与 SHA”清单，保存清单并下载其中每个 ZIP；逐项核对字节数和 SHA-256，然后全部解压到同一父目录。各包共同使用 `portplan/` 根目录，目录应合并，不应把后续包解压成彼此独立的项目。包的数量随证据增长变化，不按旧文稿中的固定数量下载。

新的源码包包含：

- 本次构建时的最新 `AGENTS.md`，并在恢复清单中记录其 SHA-256。
- 安全的 `.openai/hosting.json`：只保留原 `project_id` 与 `static.directory`，不包含凭据或私有运行设置。
- `source-recovery.json`：记录该源码快照的约定及安全项目配置哈希；站内另有 `/data/source-recovery-v11.json`，下载包清单也含相同恢复信息。
- 项目代码、依赖锁定文件、文档及按下载清单分包保留的研究证据。冻结输入、失败、输出、源码快照与原始哈希不因恢复方式改变。

ZIP 是对应那次发布构建的文件快照，不含 Git 历史，也不保证包含此后仅推送到 Git 的新提交。若最新约定或代码只存在于 Git，应同步最新 Git；旧下载包不能被称为最新备份。后续重新构建会按当时的 `AGENTS.md` 和原项目配置重新生成恢复信息。

## 最小环境与启动

建议安装 Node.js 24、npm 和 Python 3.12。当前 Vite 接受 Node.js `^20.19.0` 或 `>=22.12.0`；构建脚本要求终端中 `python` 指向 Python 3。先确认 `node --version`、`npm --version`、`python --version` 可运行。

在恢复后的项目根目录执行：

```sh
npm ci
npm run build
npm run dev
```

`npm ci` 按锁定文件安装依赖。`build` 会从已保存分块恢复所需 V6/V7 展示原档、生成 `public/` 下载与数据目录，再构建 `dist/` 并检查 Sites 大小限制；然后开发服务器即可加载这些数据。新 checkout 上仅运行 `npm run dev` 可能缺少尚未生成的 `public/`。

`node_modules/`、根 `public/`、`dist/`、本机缓存、`.env*`、运行环境和凭据不属于源码备份；其中生成目录应重新构建，环境变量和权限应在新机器按实际需要重新配置。当前浏览器本地功能不需要 GPU，也不需要把旧机器的环境文件带入源码包。

原生 HiGHS 与 Python 科研复核另需：

```sh
python -m pip install -r requirements-research-v4.txt
```

只读恢复 V10 首次原档可运行：

```sh
python scripts/restore-evidence-v10.py
```

这不会重跑优化算法。其他版本、开发档和独立复核命令见项目 README。若确实重新运行实验，使用归档内冻结 runner 和全新输出目录，不覆盖首次证据；不同机器的限时结果可能不同。重新生成 V12 韩文 PDF/PPT 另需 `requirements-materials-v12.txt` 和系统 Noto CJK 字体，已有材料可直接阅读。

V12 使用无损 XZ 分块保存新增研究证据，旧版本分块和原始 SHA 保留。正式归档生成后可执行 `python scripts/restore-evidence-v12.py`；开发归档使用同一恢复器并显式指定 `--manifest data/archives-v12/seed-development/manifest.json --destination data/evidence-v12` 等对应路径。恢复器先核验分块和整体 SHA，再安全展开；已存在但内容不同的目标会拒绝覆盖。

V12 材料同时引用正式研究与单列的旧 D0 开发动机，重生成前应恢复两者：

```sh
python scripts/restore-evidence-v12.py
python scripts/restore-evidence-v12.py --manifest data/archives-v12/seed-development/manifest.json --destination data/evidence-v12
python -m pip install -r requirements-materials-v12.txt
python scripts/build-defense-v12.py --check-only
```

检查通过后可用 `--generate` 生成尚不存在的 V12 材料；已有文件默认不覆盖。正式原档的复核与全新输出目录重跑示例见[原生 V12 快速上手](native-v12-quickstart.zh.md)。旧开发原始路径是历史定位，读取器也识别已核验分块恢复后的对应路径；不会把开发摘要当作新正式成绩。

独立 CP-SAT 诊断使用单独环境，不改变原 HiGHS 依赖。在 Linux 中可执行：

```sh
python -m venv .venv-cpsat
.venv-cpsat/bin/python -m pip install -r requirements-cpsat-v12.txt
PORTPLAN_CPSAT_PYTHON=.venv-cpsat/bin/python node --test tests/cpsat-v12.test.mjs
```

该环境只用于独立诊断，不是启动网页或读取既有证据的条件，也不需要 GPU。限时原生实验采用 Linux/POSIX 进程组清理；其他操作系统的原生计时与清理尚未验收，不能沿用当前机器的性能结论。

## 继续发布到原 Sites 项目

先核对 `.openai/hosting.json` 的 `project_id` 与恢复清单一致，保持原静态目录配置。项目 ID 只标识项目，不赋予读取、写入或发布权限；需要在拥有相应权限的 Sites 账户中继续操作。不要把临时仓库凭据写进项目、ZIP 或命令分享记录。

源码恢复后，使用原项目的正常同步、检查和发布流程。ZIP 不含 `.git/`，需要 Git 历史或提交关系时应连接已授权的原仓库；不要将文件快照误当完整 Git 克隆。发布前需通过单文件 25 MiB、展开归档 256 MiB 检查；体积超限应调整无损传输或分包，不能删研究证据或改原始哈希。

构建和文件恢复不等于完成真实浏览器操作验收、报名或本人答辩。当前公开证据研究范围见站内公开资料路线说明；企业试点保持可选，不反复索要业务资料、报价或联系人。

## 本轮实际恢复检查

已经将14个预发布分包逐个校验SHA并合并到新建目录，核对最新AGENTS与原项目身份，执行`npm ci`、完整构建、V8/V9/V10原档恢复、五类公开证据检查及144项端点逐箱检查，均通过。记录见`data/recovery-verification-v11.json`。这是同一托管Linux环境中的干净目录演练，不能代替其他操作系统兼容性或真实浏览器验收；最终发布包另行核对大小与下载哈希。
