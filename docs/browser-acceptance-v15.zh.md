# V15 本地定向浏览器候选验收

本记录只认证候选 UI 提交 `194e6a5197c223893adaf12f7a4be5a8712b9c0a`、dist inventory `f31599fd3a09fb16b21dc67cb6b08f0779d0c8ed5c3cca90ed108c60ce2d7403`（479文件 / 250,902,104字节），不提前认证后续最终构建或公开发布版本。浏览器是实际Chromium 154.0.8037.57，1440×1000与390×1000；无Site凭据、cookies、Authorization或bypass，不运行原生求解器。

首次5项为 **3项通过、2项原生下载取消**，原结果 `artifacts/browser-v15-first/summary.json` SHA `f7efe310651374be2924c1b4fcdb7866f113e1009ab12579d757e06fc3f5a539` 保留。通过项包含：两个尺寸的三方法各5/12完整、每法7失败且完整金额null、12端点矩阵、全部24配对及36调用/父生命周期、两对照新增0/损失0/共同5、醒目冷缓存/已见/非自然D0/不计算新置信区间的边界、V14历史导航和真实刷新；另有明确标记的受控review响应尾部加换行→SHA拒绝/清除旧表→恢复真实字节刷新。它是测试故障注入，未改原证据。

两项下载取消来自harness将公开站点的显式Chromium外网proxy配置用于localhost。只对localhost恢复默认本地Chromium连接后，**独立2项下载补查通过**，没有修改产品source/dist、环境proxy变量或TLS验证。补查 `artifacts/browser-v15-downloads-first/summary.json` SHA `ab9baa99c71e5dc86d9ad677babe443d51fbe91b4d207bf5be38c24d6dbb99a8`。首次包装状态 `product_assertion_failed` 原样保留，不将它悄悄改成通过，也不把该标签当成已证实的产品错误。

**distinct逻辑覆盖是5种，不是7种，也不是首次5项单轮全过。** 旧本地53项、旧匿名公开13项及worker中转修正7项均独立。V15本轮呈现的仍是四个已见场景冷缓存端点开发；三方法各5/12和0新增不证明完成率提升、新留出优势、默认推荐通过或夺冠。

实际点击下载在两个尺寸均各完成3项，共6份原生URL下载原字节全等：

| 当前候选下载 | bytes | SHA-256 |
| --- | ---: | --- |
| 完整V15报告 | 23,062 | `5c89899c7888c0f4e1be44b0d228e8d171a14edaca6ffb83323dff0985c06b9b` |
| 当前动态分包manifest | 218,884 | `2ec4ffb3c8c4f6ecf2ec4def3054e5e3721ae43928b47fb6585eb1140365515e` |
| 当前源码ZIP | 19,974,851 | `22af005405bfed1ff3f5ce02249d7e00d210a3c469d390d8b342319fc3758eae` |

原收据、日志、两份helpers、实际截图及静态输入清单已装入 `data/archives-v15/browser-first/manifest.json`，manifest SHA `ef95e055340e0d0fefcc0cd20e84f244db8f0a89b26aaa6eb5bb103d18743997`。归档34文件，原文1,927,360字节，XZ 912,756字节。六份实际下载payload未重复装入便携proof，仍保留原artifacts位置和bytes/SHA收据；原始文件未删除。此proof不能凭SHA收据假装含有被排除的下载字节。

实际桌面/窄屏截图已人工模型视查，无明显布局问题；宽表在容器内横滚、body无横向溢出。本人理解、资格/报名、现场演示及比赛名次未被自动认证。后续最终源码与包会改变，公开站点的定向浏览器验收须在实际发布后另开新目录，绑定其真实commit/inventory再记录。
