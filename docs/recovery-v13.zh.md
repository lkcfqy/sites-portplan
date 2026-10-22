# V13 开发及浏览器证明恢复

完整源码包清单见 `data/download-packages-v13.json`，请下载其中**全部** ZIP，并在同一空目录解压；这些分包共同构成一个项目。每包大小与 SHA 在清单中。恢复后用 `npm ci`、`npm run build` 开发页面；本轮浏览器自动化使用云电脑已有 Chromium/Python Playwright，运行环境需自行具备相应工具。原生求解环境另按原 V12 快速开始配置。没有 GPU 前置要求。

新增的开发和操作证明另用无损归档保留：

- `data/archives-v13/browser-first/manifest.json`：旧发布构建上的 45 项与补充 4 项真实浏览器记录。
- `data/archives-v13/guard-development/manifest.json`：预注册源码、全部 12 次首次受控回放、失败、独立审核及其原始依赖。
- `data/archives-v13/browser-final/manifest.json`：更新展示后的同一套 49 项真实浏览器复测。以该文件实际存在及其 SHA 清单为准。

每份归档可运行 `python scripts/restore-evidence-v12.py --manifest <上述某一manifest> --destination data/evidence-v13` 恢复，目的目录中的各 `archiveRoot` 需为新目录。脚本的 V12 名称表示共享传输格式；没有改写 V12 正式实验。恢复器先核每段、压缩流及逐文件 SHA，不会求解或重跑实验。

恢复 guard-development 后，可直接从其中的冻结源码执行**只读**独立审核：

```bash
python -B data/evidence-v13/v13-guard-first/artifacts/v13-guard-first-development/source/scripts/review-replay-guard-v13.py \
  --run data/evidence-v13/v13-guard-first/artifacts/v13-guard-first-development \
  --output /tmp/portplan-v13-new-review.json
```

输出路径必须尚不存在。`-B` 禁止导入时写 Python 缓存，便于审查后逐字节核对恢复文件。该审核只用 Python 标准库、归档内的冻结审查器和原始证据；它不调用 JavaScript 或优化器。归档含协议要求的 24 个原始来源，以及独立筛选额外需要的 5 份旧记录；额外记录从未作为新规划器输入，无需为了这一开发审核再恢复整份 V12 三千兆原档。另行完整复核 V12 时仍按其原恢复说明操作。

这次已经在独立新目录实际恢复首轮浏览器证明和受控开发证明，并用恢复出的冻结 Python 审查器得到相同审核字节。最终包逐字节检查、后续浏览器证明恢复和线上验收分别记录，不能将较早包的安装检查冒充最终包安装检查。历史正式研究、受控开发、操作测试以及个人参赛状态各有独立范围。
