import './styles.css';
import './v9-shell.css';
import { mountPublicValidationUI } from './public-validation-ui.js';
import { mountResearchV7UI } from './research-v7-ui.js';
import { mountExecutionV8UI } from './execution-v8-ui.js';
import { mountResearchV8UI } from './research-v8-ui.js';
import { mountResearchV10UI } from './research-v10-ui.js';
import { mountResearchV12UI } from './research-v12-ui.js';
import { mountResearchV14UI } from './research-v14-ui.js';
import { mountResearchV15UI } from './research-v15-ui.js';
import { mountResourceRecoveryV9UI } from './resource-recovery-v9-ui.js';
import { explainFeasibility } from './feasibility-explanation-v6.js';
import {pickupFeeExposures,executionTasks} from './decision-explanation.js';
import {fetchEvidenceJson,evidenceTransportPath} from './evidence-transport.js';
import { makeDemoScenario, validateScenario, pncStorageCost, maerskDDCost, storageStartDate, addDays, TARIFF_VERSION, DEFAULT_TARIFF, DEFAULT_OPERATIONS, tariffParameters, operationParameters } from './engine.js';

const icons = {
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  rates:'<path d="M7 3h10l3 3v15H4V3h3Z"/><path d="M8 8h8M8 12h8M8 16h4"/>',
  chart:'<path d="M4 3v17h17M8 16v-5M13 16V7M18 16V4"/>',
  folder:'<path d="M3 7V4h7l2 3h9v13H3V7Z"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 15v6h16v-6"/>',
  play:'<path d="m8 4 12 8-12 8V4Z"/>',
  arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
  money:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/>',
  trend:'<path d="m3 7 7 7 4-4 7 7m-6 0h6v-6"/>',
  box:'<path d="m12 3 9 5v9l-9 5-9-5V8l9-5ZM3 8l9 5 9-5M12 13v9M7 5.8l9 5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l4 2"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  check:'<path d="m5 12 4 4L20 5"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  refresh:'<path d="M20 7V3m0 4h-4M4 17v4m0-4h4M20 7a9 9 0 0 0-15-2M4 17a9 9 0 0 0 15 2"/>',
  code:'<path d="m8 5-7 7 7 7m8-14 7 7-7 7M14 3l-4 18"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.info}</svg>`;
const $ = id => document.getElementById(id);
const nf = new Intl.NumberFormat('zh-CN');
const money = v => Number.isFinite(v) ? nf.format(Math.round(v)) : '—';
const el = (tag, className, text) => { const e=document.createElement(tag); if(className)e.className=className; if(text!==undefined)e.textContent=String(text); return e; };
const setText = (id, text) => { if($(id)) $(id).textContent=text; };
const names={fifo:'先到先提',earliestFreeEnd:'免费期最早结束',marginalCost:'次日增费最高优先',earliestDeadline:'交货期限优先',strongSearch:'多起点局部搜索',fastConstructor:'快速构造候选',eventSearch:'直接日期搜索',optimized:'PortPlan 优化'};
const statusNames={optimal:'已证明最优',feasible:'已找到可行排程',infeasible:'模型已证明不可行',no_feasible_schedule_found:'未找到完整排程',time_limit:'限时内未找到可行解',error:'策略运行失败'};
let scenario = makeDemoScenario(42,12), result = null, revision=0, jobId=0, worker=null, busy=false, selectedPolicy='optimized', scheduleView='table';
let benchmark=null, assessment=null, registry=null, gateData=null, benchmarkV2=null, robustnessV2=null, conservativeV2=null;
let benchmarkV2LoadError=null;
let evidenceVersion='v2', researchSection='main';
let executionV8 = null;
let resourceV9 = null;
const policyOrder=['fifo','earliestFreeEnd','marginalCost','earliestDeadline','strongSearch','fastConstructor','eventSearch','optimized'];

$('app').innerHTML=`
<div class="app-shell">
  <aside class="sidebar" aria-label="主导航">
    <div class="brand"><div class="brand-symbol">P</div><div class="brand-name">PortPlan<small>PLAN WITH EVIDENCE</small></div></div>
    <div class="nav-label">WORKSPACE</div>
    <nav class="nav" aria-label="工作空间">
      <button class="nav-button active" data-tab="planner" aria-current="page">${icon('grid')}<span>排程工作台</span></button>
      <button class="nav-button" data-tab="research-v15">${icon('chart')}<span>V15 交付改进 · 开发</span></button>
      <button class="nav-button" data-tab="research-v14">${icon('chart')}<span>研究与验证 · V14</span></button>
      <button class="nav-button" data-tab="research-v12">${icon('chart')}<span>V12 研究与 V13 开发</span></button>
      <button class="nav-button" data-tab="research-v9">${icon('chart')}<span>历史研究 · V10</span></button>
      <button class="nav-button" data-tab="resource-v9">${icon('money')}<span>资源补救 / 자원 복구</span></button>
      <button class="nav-button" data-tab="execution-v8">${icon('play')}<span>执行模拟 · V8/V9</span></button>
      <button class="nav-button" data-tab="research-v8">${icon('chart')}<span>V8 方法与验证</span></button>
      <button class="nav-button" data-tab="rates">${icon('rates')}<span>费率核验</span></button>
      <button class="nav-button" data-tab="experiments">${icon('chart')}<span>实验与自评</span></button>
      <button class="nav-button" data-tab="sources">${icon('folder')}<span>资料与复现</span></button>
      <button class="nav-button" data-tab="public-validation">${icon('check')}<span>公开验证</span></button>
      <button class="nav-button" data-tab="research-v7">${icon('refresh')}<span>决策与证据 · V7</span></button>
    </nav>
    <div class="sidebar-note"><strong>2026 LogisticSolver</strong><p>港口提还箱排程<br>公开可复现研究原型 · 匿名访问</p><div class="sidebar-version"><span>V15 DEV · V14 FORMAL</span><span>↗</span></div></div>
  </aside>
  <div class="workspace">
    <header class="topbar"><div class="breadcrumb"><span class="mobile-brand">PortPlan</span><span>工作空间</span><span>/</span><strong id="breadcrumb-current">排程工作台</strong></div><div class="topbar-right"><span class="online-label"><span class="live-dot"></span>浏览器本地计算</span><span class="date-label mono">KST · UTC+09:00</span><span class="avatar" aria-label="研究原型">PP</span></div></header>
    <main class="main-content">
      <section id="panel-planner" class="tab-panel" aria-labelledby="planner-title">
        <div class="page-heading"><div><div class="eyebrow">CONTAINER OPERATIONS / PLANNING</div><h1 id="planner-title">港口提还箱排程</h1><p>用公开费率比较提箱、卸货与还箱方案，检验日级模型内可行性。</p></div><div class="heading-tools"><button id="export-plan" class="button secondary-label">${icon('download')}导出排程</button><button id="run" class="button primary">${icon('play')}运行优化</button></div></div>
        <div class="context-strip"><span id="data-badge" class="pill"><span class="live-dot"></span>模拟订单 · 公开费率</span><span id="tariff-label">PNC 2026 标准费率 / Maersk 韩国进口</span><span id="assumption-badge" class="pill orange" hidden>假设压力测试</span><span id="scenario-meta" class="end"></span></div>
        <div id="run-notice" class="notice hidden" role="status" aria-live="polite"></div>
        <div class="metrics">
          <article class="metric primary-metric"><div class="metric-label">推荐方案 · 规划期新增费用 ${icon('money')}</div><div id="metric-cost" class="metric-value">—<span class="unit">₩</span></div><div id="metric-cost-sub" class="metric-sub">仓储费 + 船公司 D&D · 标准价估算</div></article>
          <article class="metric"><div class="metric-label">较最佳可行基准降低 ${icon('trend')}</div><div id="metric-saving" class="metric-value">—<span class="unit">%</span></div><div id="metric-saving-sub" class="metric-sub">相同订单、容量与交货约束</div></article>
          <article class="metric"><div class="metric-label">完成排程 ${icon('box')}</div><div id="metric-count" class="metric-value">—<span class="unit">箱</span></div><div id="metric-count-sub" class="metric-sub">每箱覆盖提箱 → 卸货 → 还空箱</div></article>
          <article class="metric"><div class="metric-label">推荐策略计算时间 ${icon('clock')}</div><div id="metric-runtime" class="metric-value">—<span class="unit">秒</span></div><div id="metric-runtime-sub" class="metric-sub">每日资源限制与卸货期限</div></article>
        </div>
        <div class="dashboard-grid">
          <article class="card"><div class="card-header"><div><h2 class="card-title"><span class="section-index">01</span>策略费用比较</h2><p class="card-subtitle">期内新增费用 · 越低越好 · 韩元 KRW</p></div><span id="comparison-status" class="pill neutral">等待计算</span></div><div class="card-body"><div id="comparison-chart"></div><div class="chart-footnote">${icon('info')}<span>所有策略预先知道全部订单。费用是模拟结果；基准未排完所有箱时不参与费用排名。</span></div></div></article>
          <article class="card"><div class="card-header"><div><h2 class="card-title"><span class="section-index">02</span>计划参数</h2><p class="card-subtitle">调整资源约束，检验方案是否仍然成立</p></div><span class="tiny text-muted">KST</span></div><div class="card-body"><div class="form-grid">
            <label class="field">计划起始日<input id="setting-start" type="date" required /></label><label class="field">计划周期 / 天<input id="setting-days" type="number" min="2" max="31" step="1" /></label>
            <label class="field">每日运输作业 / 箱次<input id="setting-truck" type="text" inputmode="numeric" title="输入非负整数，或以逗号分隔的逐日容量" /><span class="field-hint">提箱、还箱分别占 1 箱次</span></label>
            <label class="field">同时卸货容量 / 箱<input id="setting-warehouse" type="text" inputmode="numeric" title="输入非负整数，或以逗号分隔的逐日容量" /><span class="field-hint">连续卸货天数占用容量</span></label>
            <label class="field"><span id="staging-label">在场箱位 / 箱</span><input id="setting-staging" type="text" inputmode="numeric" title="输入非负整数，或以逗号分隔的逐日容量" /></label><label class="field">MILP 求解限时 / 秒<select id="setting-limit"><option value="2">2 秒</option><option value="5">5 秒</option><option value="10" selected>10 秒</option><option value="30">30 秒</option><option value="60">60 秒</option></select></label>
            <label class="field planner-mode-field">规划模式<select id="setting-mode"><option value="v5" selected>V5 · 快速构造优先</option><option value="v4">V4 · 原有规则与搜索</option></select></label>
          </div><p id="solver-budget-note" class="advanced-note" aria-live="polite"></p><details class="advanced-assumptions" id="advanced-assumptions"><summary>高级假设 <span id="assumption-summary">公开费率基准 · 默认作业假设</span></summary><p class="advanced-note">用于检验规则变化是否改变排程。修改任一默认值会标记“假设压力测试”，不代表官方费率或真实合同。</p><div class="form-grid">
            <label class="field">PNC 免费天数<input id="assumption-pncFreeDays" type="number" min="0" max="365" step="1" value="4" /></label><label class="field">D&amp;D 免费天数<input id="assumption-ddFreeDays" type="number" min="0" max="365" step="1" value="10" /></label>
            <label class="field">PNC 费率倍数<input id="assumption-pncMultiplier" type="number" min="0" max="100" step="0.1" value="1" /></label><label class="field">D&amp;D 费率倍数<input id="assumption-ddMultiplier" type="number" min="0" max="100" step="0.1" value="1" /></label>
            <label class="field">PNC 阶梯解释<select id="assumption-pncMode"><option value="retroactive">到达档位追溯计价</option><option value="progressive">各档逐日累加（假设）</option></select></label><label class="field">D&amp;D 阶梯解释<select id="assumption-ddMode"><option value="progressive">各档逐日累加</option><option value="retroactive">到达档位追溯（假设）</option></select></label>
            <label class="field">卸货完成后最早还箱<select id="assumption-returnLagDays"><option value="1">次日（默认）</option><option value="0">当天（假设）</option></select></label><label class="field">在场容量单位<select id="assumption-stagingUnit"><option value="container">箱数 · 每箱占 1 位</option><option value="teu">TEU · 40 英尺占 2 位</option></select></label>
          </div><p class="advanced-note">免费期变化时保留各收费档宽度并平移；同日提卸还不占跨日库存，未建模日内暂存。运费、税费和随机延迟未纳入。费率核验页始终显示公开基准。</p><button id="reset-assumptions" class="button ghost small">恢复默认假设</button></details><div class="settings-footer"><span>容量支持整数或逐日逗号分隔序列</span><button id="reset" class="button ghost small">${icon('refresh')}重置示例</button></div></div></article>
        </div>
        <article class="card schedule-section"><div class="card-header wrap-mobile"><div><h2 class="card-title"><span class="section-index">03</span>日级排程明细</h2><p id="schedule-subtitle" class="card-subtitle">计划生成后，可检查每个箱子的完整作业链</p></div><div class="heading-tools"><label><span class="sr-only">查看策略</span><select id="policy-select" class="result-select"><option value="optimized">PortPlan 优化</option><option value="fifo">先到先提</option><option value="earliestFreeEnd">免费期最早结束</option><option value="marginalCost">次日增费最高优先</option><option value="earliestDeadline">交货期限优先</option><option value="strongSearch">多起点局部搜索</option></select></label><div class="segment" aria-label="排程视图"><button class="active" data-view="table" aria-pressed="true">明细</button><button data-view="timeline" aria-pressed="false">时间线</button><button data-view="capacity" aria-pressed="false">资源</button></div></div></div><div id="schedule-content"></div><div class="table-footer"><span id="schedule-footer">费用不包含运费、税费与协议折扣</span><span id="schedule-total"></span></div></article>
        <details class="card editor-card" id="orders-editor"><summary><div><h2 class="card-title"><span class="section-index">04</span>订单与情景数据</h2><p class="card-subtitle">展开编辑、导入，或生成可复现的模拟订单</p></div></summary><div class="editor-toolbar"><div class="heading-tools"><label class="field">模拟箱数<input id="demo-count" type="number" min="1" max="100" value="12" style="width:70px" /></label><label class="field">随机种子<input id="demo-seed" type="number" min="0" max="4294967295" value="42" style="width:92px" /></label><button id="generate" class="button small">生成情景</button></div><div class="heading-tools"><button id="import-orders" class="button small">导入 CSV / JSON</button><button id="add-order" class="button small">${icon('plus')}添加</button></div></div><div class="table-wrap"><table class="data-table editor-table"><thead><tr><th>箱号</th><th>箱型 / ft</th><th>卸船时间 / KST</th><th>可提日 D+</th><th>卸货天数</th><th>最迟完成日 D+</th><th>来源</th><th>操作</th></tr></thead><tbody id="orders-body"></tbody></table></div><div class="table-footer"><span>D+0 = 计划起始日；最迟完成日约束卸货完成，非还箱日期。</span><button id="download-template" class="button ghost small">下载订单 CSV</button></div></details>
        <div class="footer-note"><span>研究边界：标准干货箱 · 全部订单预先已知 · 日粒度 · 确定性资源约束</span><span>PORTPLAN / REPRODUCIBLE RESEARCH PROTOTYPE</span></div>
      </section>
      <section id="panel-rates" class="tab-panel" hidden aria-labelledby="rates-title">
        <div class="page-heading"><div><div class="eyebrow">TARIFF VERIFICATION / TRACEABLE INPUTS</div><h1 id="rates-title">先把费率算对</h1><p>公开标准费率是计算依据；实际账单以适用合同、船公司与码头确认为准。</p></div><span class="pill">来源可追溯</span></div>
        <div class="notice warning">${icon('info')}<p>PNC 网页存在与 2026 PDF 不一致的旧价，本版采用 <strong>2026 标准费率 PDF</strong>。Maersk D&D 按逐档累加解释，仍需业务确认；不含协议免费期、税费与冷藏/危险品。</p></div>
        <div class="rate-grid"><article class="card reading-card"><h2>PNC 仓储费核验器</h2><p>按最高到达档位，对全部超过 4 天免费期的天数重新计价。</p><div class="form-grid"><label class="field">箱型<select id="calc-size"><option value="20">20 英尺标准干货箱</option><option value="40">40 英尺标准干货箱</option></select></label><label class="field">累计计费日历天数<input id="calc-days" type="number" value="14" min="0" max="365" step="1" /></label></div><div class="rate-total"><span>估算仓储费 / KRW</span><strong id="calc-storage">—</strong></div><div id="calc-details" class="rate-details"></div><h3>08:00 起算边界</h3><label class="field">卸船时间 / 韩国时间<input id="calc-discharge" type="datetime-local" value="2026-10-01T07:00" /></label><p id="calc-start"></p><a href="https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf" target="_blank" rel="noopener">查看 PNC 2026 标准费率 PDF ↗</a></article>
        <article class="card reading-card"><h2>Maersk 进口合并 D&D 核验器</h2><p>卸船日起算，到还空箱日结束；默认两端包含，按韩国标准干货箱费率计算。</p><div class="form-grid"><label class="field">箱型<select id="dd-size"><option value="20">20 英尺标准干货箱</option><option value="40">40 英尺标准干货箱</option></select></label><label class="field">累计占箱日历天数<input id="dd-days" type="number" value="17" min="0" max="365" step="1" /></label></div><div class="rate-total"><span>估算船公司费用 / KRW</span><strong id="calc-dd">—</strong></div><div id="dd-details" class="rate-details"></div><h3>口径必须分开</h3><p>码头仓储费截至提箱日；船公司 D&D 截至还空箱日。两者是不同收费项目，可能同时发生。</p><p>工作台优先展示“期内新增费用”＝最终估算费用 − 规划日前费用基数；该基数为常数，不影响策略比较。</p><a href="https://www.maersk.com/local-information/asia-pacific/south-korea/import" target="_blank" rel="noopener">查看 Maersk 韩国进口标准 ↗</a></article></div>
        <article class="card schedule-section"><div class="card-header"><div><h2 class="card-title">PNC 标准仓储费阶梯</h2><p class="card-subtitle">普通进口干货箱 · KRW / 超免费天 / 20 英尺；40 英尺 × 2</p></div></div><div class="table-wrap"><table class="data-table"><thead><tr><th>累计天数</th><th>1–4 天</th><th>5–7 天</th><th>8–9 天</th><th>10–14 天</th><th>15 天及以上</th></tr></thead><tbody><tr><td>适用日费率</td><td>免费</td><td>9,100</td><td>18,200</td><td>31,850</td><td>45,500</td></tr><tr><td>计算方式</td><td>0</td><td colspan="4">（累计计费天数 − 4）× 当前最高档日费率 × 箱型系数</td></tr></tbody></table></div></article>
      </section>
      <section id="panel-experiments" class="tab-panel" hidden aria-labelledby="experiments-title"><div class="page-heading"><div><div class="eyebrow">EVIDENCE / BENCHMARK / SELF-ASSESSMENT</div><h1 id="experiments-title">让结果经得起比较</h1><p>检验强基准、规模、规则变化和延误下的表现，保留失败与时间记录。</p></div><button id="download-benchmark" class="button">${icon('download')}实验原始结果</button></div><div class="evidence-toolbar"><div class="segment" aria-label="证据版本"><button data-evidence="v2" class="active" aria-pressed="true">V2 研究版</button><button data-evidence="v1" aria-pressed="false">V1 初版留档</button></div><span class="tiny text-muted">全部为情景研究 · 不推断真实节省</span></div><div id="benchmark-v2-content"></div><div id="benchmark-content" hidden></div><div id="assessment-content" class="schedule-section" hidden></div><div id="research-materials" class="schedule-section"></div></section>
      <section id="panel-sources" class="tab-panel" hidden aria-labelledby="sources-title"><div class="page-heading"><div><div class="eyebrow">SOURCES / DATA PROVENANCE / REPRODUCIBILITY</div><h1 id="sources-title">证据与复现</h1><p>每个输入有出处，每个结论有边界。你的订单文件在浏览器中处理。</p></div><span class="pill neutral">可下载 · 可检查</span></div>
      <div class="notice">${icon('info')}<p><strong>公开费率是真实来源，默认订单是模拟情景。</strong>目前没有 PNC 企业箱级订单或真实账单，优化收益不能解释为现场节省。</p></div>
      <div class="download-grid"><article class="download-tile">${icon('folder')}<h3>完整情景 JSON</h3><p>包含订单、资源容量、随机种子与费率版本，便于复现。</p><button id="download-scenario" class="button small">导出当前情景</button></article><article class="download-tile">${icon('download')}<h3>导入自己的订单</h3><p>支持 CSV 订单和 JSON 情景；导入数据不会上传到服务器。</p><button id="import-sources" class="button small">选择 CSV / JSON</button></article><article class="download-tile">${icon('code')}<h3>源代码与研究材料</h3><p>下载当前源码分包与研究材料；历史原档按恢复说明获取。</p><a class="button small" href="/downloads/portplan-source.zip" download>下载核心源码分包</a><a class="button small" href="/downloads/recovery-v15.zh.md">全部分包与历史恢复</a></article></div>
      <div id="public-observations"></div><h2 class="card-title" style="margin:25px 0 15px">来源登记册</h2><div id="source-list" class="source-list"></div>
      <article class="card reading-card schedule-section"><h2>CSV 数据契约</h2><p>列名：<span class="inline-code">id,sizeFt,dischargeDateTime,releaseDay,unloadDays,dueDay,dataOrigin</span>。所有日期带时区；示例 <span class="inline-code">2026-10-01T07:00:00+09:00</span>。可提日与交货期限均为距计划开始日的整数天。</p><p>CSV 仅替换订单，沿用当前资源与计划周期；JSON 导入整个情景。导入时检查唯一箱号、20/40 英尺、日期与范围；所有导入记录统一标记“用户上传 / 未核验”，不采信文件自报的公开或模拟来源。每次修改都需要重新计算。</p><p>模型假设：单个资源池；每次提箱和还箱各消耗一个车辆箱次；卸货连续占用仓库容量；提箱日起至还箱日前占用在场箱位（20/40 英尺均按一个箱位简化）。没有模拟交通、预约系统、报关随机延迟或真实运输价格。</p></article></section>
      <section id="panel-public-validation" class="tab-panel" hidden aria-labelledby="public-validation-title"></section>
      <section id="panel-research-v7" class="tab-panel" hidden aria-labelledby="research-v7-title"></section>
      <section id="panel-execution-v8" class="tab-panel" hidden aria-label="V8 自定义滚动模拟 / 실행 시뮬레이션"></section>
      <section id="panel-research-v8" class="tab-panel" hidden aria-labelledby="research-v8-title"></section>
      <section id="panel-research-v9" class="tab-panel" hidden aria-labelledby="research-v9-title"></section>
      <section id="panel-research-v12" class="tab-panel" hidden aria-labelledby="research-v12-title"></section>
      <section id="panel-research-v15" class="tab-panel" hidden aria-labelledby="research-v15-title"></section>
      <section id="panel-research-v14" class="tab-panel" hidden aria-labelledby="research-v14-title"></section>
      <section id="panel-resource-v9" class="tab-panel" hidden aria-label="资源补救 / 자원 복구"></section>
    </main>
  </div>
</div><input id="file-input" type="file" accept=".csv,.json,text/csv,application/json" class="visually-hidden-input" aria-label="导入订单文件" />`;

const directOption=el('option','','直接日期搜索');directOption.value='eventSearch';$('policy-select').append(directOption);
const executionExport=el('button','button small','导出日执行表');executionExport.id='export-execution';$('export-plan').parentElement.append(executionExport);
executionExport.addEventListener('click',()=>{
  const p=result?.policies?.[selectedPolicy];if(!policyOK(p))return;
  const tasks=executionTasks(scenario,p.rows),rows=[['date_KST','day','container_id','size_ft','event','resource','units','evidence'],...tasks.map(t=>[addDays(scenario.horizonStart,t.day),t.day,t.id,t.sizeFt,t.event,t.resource,t.units,'daily_model_plan_not_dispatch_confirmation'])];
  download('portplan-daily-execution.csv',csvString(rows),'text/csv;charset=utf-8');
});
const exposureCard=el('article','card reading-card schedule-section');exposureCard.id='fee-exposure';$('schedule-content').closest('.schedule-section').after(exposureCard);
const feasibilityCard=el('article','card reading-card');feasibilityCard.id='feasibility-reasons';feasibilityCard.hidden=true;$('run-notice').after(feasibilityCard);

function renderFeasibilityReason(complete){
  feasibilityCard.replaceChildren();feasibilityCard.hidden=!result||complete;
  if(feasibilityCard.hidden)return;
  const proof=result.feasibilityExplanation??(result.feasibilityExplanation=explainFeasibility(scenario));
  feasibilityCard.append(el('h2','card-title','为什么没有完整方案？'));
  if(proof.status!=='proven_infeasible_necessary_condition'){
    feasibilityCard.append(el('p','','必要条件检查没有发现容量矛盾；这不是可行性证明，也不能排除资源之间的冲突。请结合求解器状态，检查输入或增加搜索预算。'));return;
  }
  feasibilityCard.append(el('p','','以下必要条件已经矛盾，仅延长计算时间无法消除。调整对应条件后仍需重新求解，检查其余约束。'));
  for(const witness of proof.witnesses){
    const item=el('div','priority-item');
    if(witness.kind==='empty_event_domain')item.append(el('h3','',witness.id),el('p','','放行、卸货工期、交货期限或还空终点之间没有合法日期组合。增加容量不能消除这项日历矛盾。'));
    else item.append(el('h3','',`D+${witness.fromDay} 至 D+${witness.toDay} · ${witness.unit}`),el('p','',`至少需要 ${witness.minimumRequired}，目前可用 ${witness.availableCapacity}，区间缺口 ${witness.deficit}。这是区间累计需求的必要下界，不能直接当作新增车辆数或恢复保证。`));
    feasibilityCard.append(item);
  }
}

function policyOK(p){return !!p && ['optimal','feasible'].includes(p.status) && Number.isFinite(p.incrementalCost) && p.rows?.length===scenario.containers.length;}
function notice(message,kind='info'){
  const box=$('run-notice');box.replaceChildren();box.className=`notice ${kind==='info'?'':kind}`;
  if(!message){box.className='notice hidden';return;}
  const wrap=el('span');wrap.innerHTML=icon('info');box.append(wrap,el('span','',message));
}
function invalidate(message='输入已修改。请重新运行优化，更新费用与模型排程。'){
  revision++;result=null;renderResults();notice(message,'warning');
  if(worker){worker.terminate();worker=null;busy=false;$('run').disabled=false;$('run').innerHTML=icon('play')+'运行优化';}
}
function syncSettings(){
  $('setting-start').value=scenario.horizonStart;$('setting-days').value=scenario.horizonDays;
  for(const [id,key] of [['truck','truckCapacity'],['warehouse','warehouseCapacity'],['staging','stagingCapacity']])$('setting-'+id).value=Array.isArray(scenario[key])?scenario[key].join(','):scenario[key];
  $('demo-count').value=scenario.containers.length;$('demo-seed').value=scenario.seed??42;
  setText('scenario-meta',`${scenario.containers.length} CONTAINERS · ${scenario.horizonDays} DAYS`);
  const tariff=tariffParameters(scenario.tariff),operations=operationParameters(scenario);
  for(const [key,value] of Object.entries({...tariff,...operations}))if($('assumption-'+key))$('assumption-'+key).value=value;
  renderAssumptionState();
}
function readSettings(){
  scenario.horizonStart=$('setting-start').value;scenario.horizonDays=Number($('setting-days').value);
  for(const [id,key] of [['truck','truckCapacity'],['warehouse','warehouseCapacity'],['staging','stagingCapacity']]){
    const raw=$('setting-'+id).value.trim();scenario[key]=raw.includes(',')?raw.split(',').map(v=>v.trim()===''?NaN:Number(v)):raw===''?NaN:Number(raw);
  }
  readAssumptions();
  setText('scenario-meta',`${scenario.containers.length} CONTAINERS · ${scenario.horizonDays} DAYS`);
}
function changedAssumptions(){
  const t=tariffParameters(scenario.tariff),o=operationParameters(scenario);
  return Object.keys(DEFAULT_TARIFF).some(key=>t[key]!==DEFAULT_TARIFF[key])||Object.keys(DEFAULT_OPERATIONS).some(key=>o[key]!==DEFAULT_OPERATIONS[key]);
}
function renderAssumptionState(){
  const custom=changedAssumptions(),uploaded=scenario.containers.some(c=>c.dataOrigin==='uploaded'),o=operationParameters(scenario);
  setText('data-badge',(uploaded?'用户上传 / 未核验':'模拟订单')+' · '+(custom?'假设费率与作业规则':'公开费率基准'));
  $('data-badge').className='pill'+(custom?' orange':'');
  $('assumption-badge').hidden=!custom;
  setText('tariff-label',custom?'当前假设用于压力测试，不代表官方收费':'PNC 2026 标准费率 / Maersk 韩国进口');
  setText('assumption-summary',custom?'已修改 · 假设压力测试':'公开费率基准 · 默认作业假设');
  setText('staging-label',o.stagingUnit==='teu'?'在场容量 / TEU':'在场箱位 / 箱');
}
function readAssumptions(){
  const t={};for(const key of Object.keys(DEFAULT_TARIFF)){const input=$('assumption-'+key);t[key]=input.type==='number'?(input.value.trim()===''?NaN:Number(input.value)):input.value;}
  scenario.tariff=t;scenario.operations={returnLagDays:Number($('assumption-returnLagDays').value),stagingUnit:$('assumption-stagingUnit').value};renderAssumptionState();
}
function renderEditor(){
  const body=$('orders-body');body.replaceChildren();
  scenario.containers.forEach((c,index)=>{
    const row=el('tr');
    for(const key of ['id','sizeFt','dischargeDateTime','releaseDay','unloadDays','dueDay']){
      const td=el('td');let input;
      if(key==='sizeFt'){input=el('select');for(const n of [20,40]){const option=el('option','',`${n} ft`);option.value=n;input.append(option);}input.value=c[key];}
      else {input=el('input');input.type=['releaseDay','unloadDays','dueDay'].includes(key)?'number':key==='dischargeDateTime'?'datetime-local':'text';input.value=key==='dischargeDateTime'?(Number.isFinite(Date.parse(c[key]))?new Date(Date.parse(c[key])+9*3600000).toISOString().slice(0,16):''):c[key];if(input.type==='number'){input.step='1';input.min=key==='unloadDays'?'1':'0';input.max=String(scenario.horizonDays-1);}}
      input.dataset.key=key;input.setAttribute('aria-label',`${c.id} ${key}`);
      input.addEventListener('change',()=>{const value=input.type==='number'||key==='sizeFt'?(input.value.trim()===''?NaN:Number(input.value)):key==='dischargeDateTime'?input.value+':00+09:00':input.value.trim();scenario.containers[index][key]=value;invalidate();});
      td.append(input);row.append(td);
    }
    row.append(el('td','',c.dataOrigin==='synthetic'?'模拟':'上传 / 未核验'));
    const td=el('td'),button=el('button','icon-button');button.innerHTML=icon('trash');button.setAttribute('aria-label',`删除 ${c.id}`);button.addEventListener('click',()=>{scenario.containers.splice(index,1);syncSettings();renderEditor();invalidate();});td.append(button);row.append(td);body.append(row);
  });
}
function metric(id,value,unit){const node=$(id);node.replaceChildren(document.createTextNode(value),el('span','unit',unit));}
function recommendedPolicyKey(){
  const preferred=result?.recommendedPolicy;if(typeof preferred==='string'&&policyOK(result?.policies?.[preferred]))return preferred;
  const tieOrder=['optimized','eventSearch','fastConstructor','strongSearch','earliestDeadline','marginalCost','earliestFreeEnd','fifo'];
  return Object.entries(result?.policies||{}).filter(([,p])=>policyOK(p)).sort((a,b)=>a[1].incrementalCost-b[1].incrementalCost||tieOrder.indexOf(a[0])-tieOrder.indexOf(b[0]))[0]?.[0]||'optimized';
}
function renderResults(){
  const menu=$('policy-select'),available=result?policyOrder.filter(key=>result.policies[key]):$('setting-mode').value==='v5'?['fastConstructor','eventSearch','optimized']:policyOrder.filter(key=>key!=='fastConstructor');
  menu.replaceChildren();for(const key of available){const option=el('option','',names[key]);option.value=key;menu.append(option);}
  if(!available.includes(selectedPolicy))selectedPolicy=recommendedPolicyKey();menu.value=selectedPolicy;
  const recommendedKey=recommendedPolicyKey(),opt=result?.policies?.[recommendedKey],rawOptimizer=result?.policies?.optimized,ok=policyOK(opt),baselines=result?Object.entries(result.policies).filter(([k,p])=>k!=='optimized'&&policyOK(p)):[];
  const best=baselines.sort((a,b)=>a[1].incrementalCost-b[1].incrementalCost)[0];
  renderFeasibilityReason(ok);
  metric('metric-cost',ok?money(opt.incrementalCost):'—','₩');
  const saving=ok&&best&&best[1].incrementalCost>0?(best[1].incrementalCost-opt.incrementalCost)/best[1].incrementalCost*100:null;
  metric('metric-saving',saving===null?'—':saving.toFixed(1),'%');
  setText('metric-saving-sub',ok&&best?`${saving!==null?money(best[1].incrementalCost-opt.incrementalCost)+' ₩ · ':''}对比「${names[best[0]]}」`:'相同订单、容量与交货约束');
  metric('metric-count',ok?String(opt.rows.length):'—','箱');
  metric('metric-runtime',opt?((opt.runtimeMs??0)/1000).toFixed(2):'—','秒');
  setText('metric-runtime-sub',opt?`${names[recommendedKey]} · ${statusNames[opt.status]||opt.status}`:'每日资源限制与卸货期限');
  setText('metric-count-sub',ok?'全部卸货按期完成 · 约束校验通过':'每箱覆盖提箱 → 卸货 → 还空箱');
  setText('metric-cost-sub',ok?`${names[recommendedKey]} · 规划日前费用基数 ${money(opt.sunkCost)} ₩`:changedAssumptions()?'仓储费 + D&D · 假设压力测试':'仓储费 + 船公司 D&D · 公开基准估算');
  const status=$('comparison-status');status.textContent=rawOptimizer?(rawOptimizer.methodVersion==='v4-independent-bound-certificate'?'独立下界证书：':'GLPK：')+(statusNames[rawOptimizer.status]||rawOptimizer.status):'等待计算';status.className='pill '+(rawOptimizer?.status==='optimal'?'':rawOptimizer?.status==='feasible'?'orange':'neutral');
  const chart=$('comparison-chart');chart.replaceChildren();
  const max=Math.max(1,...Object.values(result?.policies||{}).filter(policyOK).map(p=>p.incrementalCost));
  for(const key of available){
    const p=result?.policies?.[key],valid=policyOK(p),row=el('div','comparison-row'),label=el('div','comparison-name'+(key===recommendedKey?' optimized':''),names[key]);
    if(key===recommendedKey){label.prepend(el('span','mini-dot'));if(result)label.append(el('span','recommended-tag','推荐'));}
    const track=el('div','bar-track'),fill=el('div','bar-fill'+(key===recommendedKey?' opt':key===best?.[0]?' best':''));fill.style.width=valid?Math.max(p.incrementalCost>0?1:0,p.incrementalCost/max*100)+'%':'0%';track.append(fill);
    const value=el('div','comparison-value',valid?money(p.incrementalCost):p?(p.status==='infeasible'?'不可行':'未找到排程'):'—');if(p){value.title=statusNames[p.status]||p.status;if(Number.isFinite(p.runtimeMs))value.append(el('small','',p.runtimeMs<1000?p.runtimeMs.toFixed(0)+' ms':(p.runtimeMs/1000).toFixed(2)+' s'));}
    row.append(label,track,value);chart.append(row);
  }
  $('export-plan').disabled=!result;renderSchedule();
}
function renderSchedule(){
  const content=$('schedule-content');content.replaceChildren();const p=result?.policies?.[selectedPolicy];
  executionExport.disabled=!policyOK(p);exposureCard.replaceChildren();exposureCard.hidden=!policyOK(p);
  setText('schedule-total','');setText('schedule-footer','费用不包含运费、税费与协议折扣');
  if(!policyOK(p)){
    setText('schedule-subtitle','计划生成后，可检查每个箱子的完整作业链');
    const box=el('div','empty-state');box.append(el('strong','',p?statusNames[p.status]||'未获得完整排程':'模型排程将在运行后显示'),el('span','',p?.status==='infeasible'?'尝试增加容量、放宽交货期限或延长计划周期。':p?.status==='no_feasible_schedule_found'?'此搜索策略未找到方案不等于模型不可行，可切换查看优化方案。':p?.status==='time_limit'?'尝试增加求解限时，或先减少箱数。':'你可以先编辑参数或订单，再运行优化。'));content.append(box);return;
  }
  setText('schedule-subtitle',`${names[selectedPolicy]} · ${statusNames[p.status]} · ${scenario.horizonStart} 起，韩国时间`);
  setText('schedule-total',`新增费用合计 ${money(p.incrementalCost)} ₩`);
  setText('schedule-footer',`最终估算费用 ${money(p.totalCost)} ₩ · 规划日前基数 ${money(p.sunkCost)} ₩`);
  exposureCard.append(el('div','eyebrow','TARIFF EXPOSURE / LOCAL CALCULATION'),el('h2','card-title','哪些箱子面临收费跳涨'));
  for(const r of pickupFeeExposures(scenario,p.rows).slice(0,3))exposureCard.append(el('p','',`${r.id} · 计划 D+${r.pickupDay} 提箱 · 已计 ${r.storageDays} 天；再晚一天，本箱仓储费增加 ${money(r.oneDayStorageExposure)} ₩。`));
  exposureCard.append(el('p','tiny text-muted','这是本箱的仓储费暴露，未重排其他箱或检查延期后的资源可行性，不能解释为全局计划的延期成本。'));
  if(scheduleView==='timeline'){
    const wrap=el('div','timeline'),grid=el('div','timeline-grid');grid.style.gridTemplateColumns=`72px repeat(${scenario.horizonDays},minmax(31px,1fr))`;grid.style.minWidth=`${Math.max(690,scenario.horizonDays*34+72)}px`;grid.append(el('div','timeline-cell day label','箱号'));
    for(let d=0;d<scenario.horizonDays;d++)grid.append(el('div','timeline-cell day',addDays(scenario.horizonStart,d).slice(5)));
    for(const r of [...p.rows].sort((a,b)=>a.pickupDay-b.pickupDay||a.id.localeCompare(b.id))){grid.append(el('div','timeline-cell label',r.id));for(let d=0;d<scenario.horizonDays;d++){const cell=el('div','timeline-cell');if(d===r.pickupDay){const token=el('span','timeline-token','提');token.title='提箱';cell.append(token);}if(d>=r.unloadDay&&d<=r.unloadEndDay){const token=el('span','timeline-token unload','卸');token.title='卸货';cell.append(token);}if(d===r.returnDay){const token=el('span','timeline-token return','还');token.title='还空箱';cell.append(token);}grid.append(cell);}}
    const legend=el('div','timeline-legend');for(const [className,text] of [['pickup','提箱'],['unload','卸货'],['return','还空箱']]){const item=el('span','',text);item.prepend(el('span','legend-dot '+className));legend.append(item);}wrap.append(grid,legend);content.append(wrap);return;
  }
  const table=el('table','data-table'),head=el('thead'),hr=el('tr'),body=el('tbody');
  if(scheduleView==='capacity'){
    for(const label of ['日期 / KST','运输箱次 / 容量','卸货箱数 / 容量',(operationParameters(scenario).stagingUnit==='teu'?'在场 TEU / 容量':'在场箱 / 容量'),'资源检查'])hr.append(el('th','',label));
    for(const u of p.usage){const row=el('tr');row.append(el('td','strong',u.date));for(const key of ['truck','warehouse','staging'])row.append(el('td','number',`${u[key]} / ${u[key+'Capacity']}`));const td=el('td');td.append(el('span','table-tag green','满足限制'));row.append(td);body.append(row);}
  }else{
    for(const label of ['箱号 / 箱型','提箱','卸货','还空箱','仓储费 / ₩','D&D / ₩','期内新增 / ₩','期限'])hr.append(el('th','',label));
    for(const r of [...p.rows].sort((a,b)=>a.pickupDay-b.pickupDay||a.id.localeCompare(b.id))){const row=el('tr'),id=el('td');id.append(el('span','strong',r.id),document.createTextNode(' '),el('span','table-tag',`${r.sizeFt}′`));row.append(id);for(const key of ['pickupDate','unloadDate','returnDate'])row.append(el('td','',r[key]?.slice(5)));for(const key of ['storageCost','ddCost','incrementalCost'])row.append(el('td','number',money(r[key])));const td=el('td');td.append(el('span','table-tag green','按期'));row.append(td);body.append(row);}
  }
  head.append(hr);table.append(head,body);const wrap=el('div','table-wrap');wrap.append(table);content.append(wrap);
}
function renderSolverBudget(){
  const seconds=$('setting-limit').value;
  setText('solver-budget-note',$('setting-mode').value==='v5'?`V5：快速构造预算 200 ms，再做日期搜索预算 250 ms，然后运行 MILP（限时 ${seconds} 秒）。阶段预算相加，初始化与校验另计；这不是研究页的端到端 1 秒公平实验。`:`V4：四项规则策略与 12 次重启 / 80 次搜索尝试，再做 250 ms 日期搜索，MILP 限时 ${seconds} 秒。各阶段另计，初始化可能较久；这不是端到端公平实验。`);
}
function currentSolverOptions(){
  const common={timeLimitSeconds:Number($('setting-limit').value),objectiveMode:'joint',presolveV4:true};
  return $('setting-mode').value==='v5'?{...common,fastV5:{constructorBudgetMs:200,eventSearchBudgetMs:250,maxRestarts:16,seed:scenario.seed??42}}
    :{...common,eventSearchV4:{timeBudgetMs:250,seed:scenario.seed??42},strongSearch:{restartCount:12,iterations:80,seed:scenario.seed??42}};
}
function setPlanningMode(mode){$('setting-mode').value=mode==='v5'?'v5':'v4';renderSolverBudget();}
function setSolveLimit(seconds){
  if(!Number.isFinite(seconds)||seconds<=0||seconds>60)return;
  if(![...$('setting-limit').options].some(option=>Number(option.value)===seconds)){const option=el('option','',`${seconds} 秒（记录值）`);option.value=seconds;$('setting-limit').append(option);}
  $('setting-limit').value=String(seconds);
  renderSolverBudget();
}
async function run(){
  readSettings();const validation=validateScenario(scenario);if(!validation.valid){notice('输入检查未通过：'+validation.errors.join('；'),'error');return;}
  if(worker)worker.terminate();const currentRevision=revision,id=++jobId,submittedOptions=currentSolverOptions();busy=true;$('run').disabled=true;$('run').innerHTML='<span class="spinner"></span>正在求解';
  notice(submittedOptions.fastV5?`正在快速构造完整候选（预算 200 ms），做日期搜索（预算 250 ms），再求解整数规划（限时 ${$('setting-limit').value} 秒）。这些阶段相加，初始化与校验另计。`:`正在比较规则策略与多起点搜索，并求解整数规划。MILP 限时 ${$('setting-limit').value} 秒；规则初始化和搜索另计，大情景可能更久。`);$('run-notice').classList.add('progress-banner');
  try{
    worker=new Worker(new URL('./planner.worker.js',import.meta.url),{type:'module'});
    const next=await new Promise((resolve,reject)=>{worker.onmessage=event=>{if(event.data.id!==id)return;if(event.data.error)reject(new Error(event.data.error));else resolve(event.data.result);};worker.onerror=event=>reject(new Error(event.message||'浏览器求解器加载失败'));worker.postMessage({id,scenario:structuredClone(scenario),options:submittedOptions});});
    if(currentRevision!==revision)return;result=next;result.uiSolveOptions=submittedOptions;selectedPolicy=recommendedPolicyKey();$('policy-select').value=selectedPolicy;renderResults();const p=result.policies[selectedPolicy],rawOptimizer=result.policies.optimized;
    if(policyOK(p))notice(`${selectedPolicy!=='optimized'?(policyOK(rawOptimizer)?'数学优化候选未优于其他方案，':'数学优化未找到完整可行方案，')+'采用「'+names[selectedPolicy]+'」已通过校验的方案；尚未证明全局最优。':p.status==='optimal'?'在当前模型和输入下已证明最优。':'已找到通过约束校验的可行方案，尚未证明最优。'}结果来自${scenario.containers.some(c=>c.dataOrigin==='uploaded')?'用户上传的未核验订单':'模拟订单'}和${changedAssumptions()?'当前压力测试假设':'公开费率基准'}，不能当作真实节省。`);
    else notice(`${statusNames[p.status]||p.status}。${p.status==='infeasible'?'请增加运输/卸货容量、放宽交货期限或延长计划周期。':'请提高求解限时或减小情景规模。'}`,'warning');
  }catch(error){if(currentRevision===revision){result=null;renderResults();notice('运行失败：'+error.message,'error');}}
  finally{if(currentRevision===revision){busy=false;$('run').disabled=false;$('run').innerHTML=icon('play')+'重新运行';worker?.terminate();worker=null;}}
}

function renderCalculators(){
  const days=Number($('calc-days').value),size=Number($('calc-size').value);
  if($('calc-days').value.trim()!==''&&Number.isInteger(days)&&days>=0){setText('calc-storage',money(pncStorageCost(days,size))+' ₩');const next=pncStorageCost(days+1,size)-pncStorageCost(days,size);setText('calc-details',`超过免费期 ${Math.max(0,days-4)} 天 · ${size} 英尺\n再晚一天的新增仓储费：${money(next)} ₩\n第 14 → 15 天，20 英尺标准箱增加 182,000 ₩。`);}else{setText('calc-storage','—');setText('calc-details','请输入非负整数天数。');}
  try{setText('calc-start',`仓储计费起始日：${storageStartDate($('calc-discharge').value+':00+09:00')}。08:00 之前从当天起算；08:00 及之后从次日起算。`);}catch{setText('calc-start','请选择有效的卸船日期与时间。');}
  const ddDays=Number($('dd-days').value),ddSize=Number($('dd-size').value);
  if($('dd-days').value.trim()!==''&&Number.isInteger(ddDays)&&ddDays>=0){setText('calc-dd',money(maerskDDCost(ddDays,ddSize))+' ₩');setText('dd-details',`前 10 天免费；第 11–15 天 ${ddSize===20?'15,000':'30,000'} ₩ / 天\n第 16–20 天 ${ddSize===20?'30,000':'50,000'} ₩ / 天；第 21 天起 ${ddSize===20?'50,000':'90,000'} ₩ / 天\n本版逐档累加假设，不按最高档追溯。`);}else{setText('calc-dd','—');setText('dd-details','请输入非负整数天数。');}
}
function download(name,content,type='application/json'){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function csvCell(value){const str=String(value??'');const safe=/^[=+@\-]/.test(str)?"'"+str:str;return /[",\r\n]/.test(safe)?'"'+safe.replaceAll('"','""')+'"':safe;}
function csvString(rows){return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');}
const columns=['id','sizeFt','dischargeDateTime','releaseDay','unloadDays','dueDay','dataOrigin'];
function exportOrders(){download('portplan-orders.csv',csvString([columns.concat(['tariffVersion','resultType']),...scenario.containers.map(c=>columns.map(k=>c[k]).concat([TARIFF_VERSION,'scenario-input-not-observed-savings']))]),'text/csv;charset=utf-8');}
function exportScenario(){readSettings();download('portplan-scenario.json',JSON.stringify({scenario,metadata:{exportedAt:new Date().toISOString(),tariffVersion:TARIFF_VERSION,solverOptions:currentSolverOptions(),assumptionMode:changedAssumptions()?'hypothesis-stress-test':'public-tariff-benchmark',tariff:tariffParameters(scenario.tariff),operations:operationParameters(scenario),timeZone:'Asia/Seoul',resultType:'Scenario estimate, not observed savings',assumptions:['Known orders; deterministic daily resources','Standard dry containers only; excludes tax and contract prices','Standard combined D&D interpretation requires contract confirmation; altered rates and modes are hypothetical' ]}},null,2));}
function exportPlan(){
  if(!result)return;const p=result.policies[selectedPolicy];if(!policyOK(p)){notice('当前选择的策略没有完整可导出排程，请切换策略。','warning');return;}
  const keys=['id','sizeFt','pickupDate','unloadDate','returnDate','storageCost','ddCost','totalCost','sunkCost','incrementalCost','dataOrigin'];
  download(`portplan-${selectedPolicy}-schedule.csv`,csvString([keys.concat(['tariffVersion','scenarioId','resultType','status','assumptions']),...p.rows.map(r=>keys.map(k=>r[k]).concat([TARIFF_VERSION,scenario.id,'scenario-estimate-not-observed-savings',p.status,JSON.stringify({scope:'Known orders; dry only; excludes tax/contract/transport price',hypothetical:changedAssumptions(),solverOptions:result.uiSolveOptions||currentSolverOptions(),tariff:tariffParameters(scenario.tariff),operations:operationParameters(scenario)})]))]),'text/csv;charset=utf-8');
}
function parseCSV(text){
  const rows=[];let row=[],cell='',quoted=false;text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){const ch=text[i];if(ch==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(!quoted&&cell!=='')throw new Error('CSV 引号格式无效');else quoted=!quoted;}else if(ch===','&&!quoted){row.push(cell);cell='';}else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v!==''))rows.push(row);row=[];cell='';}else cell+=ch;}
  if(quoted)throw new Error('CSV 引号未闭合');if(cell!==''||row.length){row.push(cell);rows.push(row);}if(rows.length<2)throw new Error('CSV 至少需要列名与一行订单');
  const headers=rows.shift().map(v=>v.trim());for(const key of columns.slice(0,6))if(!headers.includes(key))throw new Error('CSV 缺少列：'+key);
  return rows.map((values,index)=>{if(values.length!==headers.length)throw new Error(`第 ${index+2} 行列数不一致`);const r={};headers.forEach((k,i)=>r[k]=values[i]);for(const k of ['sizeFt','releaseDay','unloadDays','dueDay']){if(r[k].trim()==='')throw new Error(`第 ${index+2} 行 ${k} 为空`);r[k]=Number(r[k]);}r.dataOrigin='uploaded';return Object.fromEntries(columns.map(k=>[k,r[k]]));});
}
async function importFile(file){
  if(!file)return;if(file.size>2*1024*1024){notice('导入失败：文件超过 2 MB。','error');return;}
  try{const text=await file.text();let next;if(file.name.toLowerCase().endsWith('.json')){const parsed=JSON.parse(text);next=parsed.scenario||parsed;if(parsed.metadata?.solverOptions){setSolveLimit(parsed.metadata.solverOptions.timeLimitSeconds);setPlanningMode(parsed.metadata.solverOptions.fastV5?'v5':'v4');}}else{next=structuredClone(scenario);next.containers=parseCSV(text);next.id='uploaded-'+Date.now();next.name=file.name;}
    if(Array.isArray(next?.containers))next.containers=next.containers.map(c=>({...c,dataOrigin:'uploaded'}));
    const check=validateScenario(next);if(!check.valid)throw new Error(check.errors.join('；'));const alteredObjective=next.objectiveMode&&next.objectiveMode!=='joint';next.objectiveMode='joint';scenario=next;invalidate('导入成功，来源已标记为“用户上传 / 未核验”。'+(alteredObjective?'工作台已切为仓储与 D&D 联合费用目标。':'')+'请运行优化以生成新排程。');syncSettings();renderEditor();activateTab('planner');
  }catch(error){activateTab('planner');notice('导入失败：'+error.message,'error');}finally{$('file-input').value='';}
}
function activateTab(tab){
  if(!document.getElementById(`panel-${tab}`))return;
  if(tab!=='execution-v8')executionV8?.stop();
  if(tab!=='resource-v9')resourceV9?.stop();
  window.scrollTo(0,0);
  document.querySelectorAll('.nav-button').forEach(button=>{const active=button.dataset.tab===tab;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  document.querySelectorAll('.tab-panel').forEach(panel=>panel.hidden=panel.id!==`panel-${tab}`);
  setText('breadcrumb-current',{planner:'排程工作台',rates:'费率核验',experiments:'实验与自评',sources:'资料与复现','public-validation':'公开验证','research-v7':'决策与证据 · V7','execution-v8':'执行模拟 · V8/V9','research-v8':'V8 方法与验证','research-v9':'历史研究 · V10','research-v12':'V12 研究与 V13 开发','research-v14':'研究与验证 · V14','research-v15':'V15 交付改进 · 开发','resource-v9':'资源补救 / 자원 복구'}[tab]);
  history.replaceState(null,'','#'+encodeURIComponent(tab));
}

const fallbackSources=[
  {title:'PNC 2026 标准费率',type:'官方公开费率',url:'https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf',note:'本版仓储费依据。选择 2026 PDF；最高阶梯对全部超免费天数重新计价，含 08:00 起算规则。'},
  {title:'Maersk 韩国进口费用与条件',type:'官方公开费率',url:'https://www.maersk.com/local-information/asia-pacific/south-korea/import',note:'标准干货箱合并 D&D，默认 10 天免费。本版对阶梯采取逐档累加解释，需要合同确认。'},
  {title:'光阳港西部码头车辆进出公开数据',type:'真实公开观测 · 未进入优化器',url:'https://www.data.go.kr/',note:'不同港口的车辆进出记录，缺少 PNC 箱级链路与还空箱信息，不能验证本项目节省效果。'},
  {title:'LogisticSolver 2026 竞赛公告',type:'比赛官方公告',url:'https://anchor.changwon.ac.kr/main/menu?gc=Program&do=sinform&spod=s1&program_id=VKoDUNlZwONq&psin_id=VKoDUNlMqh4n',note:'竞赛信息以官方页面为准。自评为研究团队判断，不代表官方评分标准。'}
];
function renderSources(){
  const sources=Array.isArray(registry)?registry:registry?.sources||fallbackSources,root=$('source-list');root.replaceChildren();
  for(const source of sources){const card=el('article','source-entry'),title=source.title_zh||source.title||source.name||source.id||'公开资料';card.append(el('h3','',title));const meta=el('div','source-meta');meta.append(el('span','pill neutral',source.type_zh||source.type||({official_tariff:'官方公开费率',official_carrier_tariff:'船公司公开费率',conflict_reconciliation:'版本冲突核查',conflicting_official_web_table:'与新版存在冲突',official_tariff_index:'官方发布索引',open_data_catalog:'公开数据目录',official_competition:'竞赛公告'}[source.kind])||'公开来源'));const date=source.retrieved_at||source.retrievedAt||source.accessed_at||source.accessedAt||source.checked_at_local_date;if(date)meta.append(el('span','',String(date).slice(0,10)+' 获取'));card.append(meta);const note=source.note_zh||source.note||source.notes_zh||source.usage_zh||source.description_zh||source.description||source.used_for||source.claims;if(note)card.append(el('p','',Array.isArray(note)?note.join('；'):typeof note==='object'?JSON.stringify(note):note));const url=source.url||source.source_url;if(url&&/^https?:\/\//.test(url)){const a=el('a','',`查看来源 ↗`);a.href=url;a.target='_blank';a.rel='noopener';card.append(a);}if(source.limitations?.length)card.append(el('p','','适用边界：'+source.limitations.join('；')));root.append(card);}
  const g=$('public-observations');g.replaceChildren();if(gateData){const card=el('article','card reading-card');card.append(el('h2','',gateData.title_zh||'真实公开操作记录 · 光阳港西部码头'));const p=el('p','',`保留 ${money(gateData.rows?.nonblank)} 条非空记录，覆盖 ${money(gateData.period?.dates_with_records)} 个有记录日期；进出时间差中位数 ${gateData.elapsed_minutes?.p50??'—'} 分钟、P90 ${gateData.elapsed_minutes?.p90??'—'} 分钟。`);card.append(p,el('p','',gateData.prohibited_interpretation_zh||'这些是光阳港车辆进出观测，不是 PNC 箱级订单，没有进入提还箱费用优化，不能用于证明节省。'));g.append(card);}}
function listCard(title,items){const card=el('article','card reading-card');card.append(el('h2','',title));if(items?.length){const ul=el('ul');for(const item of items)ul.append(el('li','',typeof item==='string'?item:item.text||item.finding||item.description||JSON.stringify(item)));card.append(ul);}return card;}
function renderLegacyExperiments(){
  const root=$('benchmark-content');root.replaceChildren();
  if(!benchmark){root.append(listCard('尚未载入离线实验记录',['当前工作台可即时比较多种策略。完整批量实验文件生成后，此页展示实际统计。','任何模拟结果都不能直接证明企业现场收益。']));}
  else{
    const summary=benchmark.summary||{},protocol=benchmark.protocol||{};
    const intro=el('div','notice');intro.append(el('span','',protocol.dataLabel||'公开费率 + 合成订单；下列是固定情景实验，不是实际业务节省。'));root.append(intro);
    const metrics=el('div','metrics');
    for(const [label,value,unit,sub] of [
      ['较最佳可行基准 · 加权降低',Number.isFinite(summary.weightedIncrementalSavingsPct)?summary.weightedIncrementalSavingsPct.toFixed(2):'—','%',`${summary.pairedCaseCount??'—'} 组配对 · 新增费用为分母；最终总收费口径 ${Number.isFinite(summary.weightedTotalSavingsPct)?summary.weightedTotalSavingsPct.toFixed(2):'—'}%`],
      ['预先固定情景',summary.caseCount??'—','组',`${summary.positiveSavingsCount??'—'} 组降低 / ${summary.tiedCount??'—'} 组持平 / ${summary.negativeSavingsCount??'—'} 组更高`],
      ['项目内部交叉检查',summary.independentAudit?.checkedFeasibleSchedules??'—','份',`${summary.independentAudit?.failedSchedules??'—'} 份失败 · 另行实现费用和约束检查`],
      ['优化模型证明最优',summary.byPolicy?.optimized?.statuses?.optimal??'—','组',`${summary.noFeasibleBaselineCount??'—'} 组无可行基准，排除收益分母`]
    ]){const card=el('article','metric'+(metrics.children.length===0?' primary-metric':''));card.append(el('div','metric-label',label));const v=el('div','metric-value',value);v.append(el('span','unit',unit));card.append(v,el('div','metric-sub',sub));metrics.append(card);}root.append(metrics);
    const protocolCard=el('article','card reading-card');protocolCard.append(el('h2','','固定实验协议'));
    protocolCard.append(el('p','',`随机种子 ${(protocol.seeds||[]).join(' / ')}；规模 ${(protocol.counts||[]).join(' / ')} 箱；宽松、常规、紧张 3 种容量配置。每个策略拥有相同的完整订单信息、资源限制和硬交货期限。所有预先固定情景均保留。${(protocol.seeds||[]).length} 个种子嵌套组合为 ${summary.caseCount??'—'} 个配置，不是 ${summary.caseCount??'—'} 个独立随机样本。`));
    protocolCard.append(el('p','',`新增费用加权降低 = 配对情景的费用差总和 ÷ 基准新增费用总和；总收费降低使用包含规划日前基数的最终收费总额作分母，两者不可混用。基准选取每个情景中费用最低的完整可行启发式。无可行基准情景与零分母单列；不能将这些情景计为“100% 节省”。`));
    protocolCard.append(el('p','','交叉检查由本项目另行实现，不是外部机构核验。规模与生成机制有限；当前结果不构成真实业务效果或普适优势的证据。'));
    const profileComparisons=['ample','typical','tight'].map(profile=>{const cases=(benchmark.cases||[]).filter(c=>c.profile===profile&&c.comparison?.paired),denominator=cases.reduce((sum,c)=>sum+c.comparison.baselineIncrementalKRW,0),saved=cases.reduce((sum,c)=>sum+c.comparison.incrementalSavingsKRW,0);return `${{ample:'宽松',typical:'常规',tight:'紧张'}[profile]}：${denominator>0?(100*saved/denominator).toFixed(2)+'%':'—'}（${cases.length} 组配对）`;});
    protocolCard.append(el('p','','按资源配置分组的新增费用降低：'+profileComparisons.join('；')+'。这些差异仅适用于当前固定情景。'));
    if(benchmark.infeasibleControl)protocolCard.append(el('p','',`不可行控制组：每日运输箱次为 0 时，优化器${statusNames[benchmark.infeasibleControl.policies?.optimized?.status]||'返回失败'}；此控制组不进入上面的费用统计。`));
    root.append(protocolCard);
    const runs=benchmark.cases||[];
    if(runs.length){const section=el('article','card schedule-section'),header=el('div','card-header');header.append(el('h2','card-title',`逐情景比较 · ${runs.length} 组`),el('span','pill neutral','点击复现载入工作台'));section.append(header);const table=el('table','data-table'),head=el('thead'),hr=el('tr');for(const label of ['情景','配置 / 箱数','优化状态','优化新增 / ₩','最佳基准新增 / ₩','降低 / %','复现'])hr.append(el('th','',label));head.append(hr);table.append(head);const body=el('tbody');
      for(const run of runs){const row=el('tr'),opt=run.policies?.optimized||{},c=run.comparison||{};row.append(el('td','strong',run.id),el('td','',`${{ample:'宽松',typical:'常规',tight:'紧张'}[run.profile]||run.profile} / ${run.count}`),el('td','',statusNames[opt.status]||opt.status),el('td','number',money(opt.incrementalCost)),el('td','number',money(c.baselineIncrementalKRW)),el('td','number',Number.isFinite(c.incrementalSavingsPct)?c.incrementalSavingsPct.toFixed(2):'—'));
        const td=el('td'),button=el('button','button small','复现');button.addEventListener('click',()=>{scenario=structuredClone(run.scenario);setPlanningMode('v4');setSolveLimit(run.policies?.optimized?.timeLimitSeconds??benchmark?.protocol?.solverTimeLimitSeconds??2);invalidate('已载入 V1 情景与记录限时，使用保留的规则与搜索路径重算；限时求解受设备速度影响，结果可能不同。');syncSettings();renderEditor();activateTab('planner');window.scrollTo({top:0,behavior:'smooth'});});td.append(button);row.append(td);body.append(row);
      }table.append(body);const wrap=el('div','table-wrap');wrap.append(table);section.append(wrap);root.append(section);
    }
  }
  const aroot=$('assessment-content');aroot.replaceChildren();
  if(!assessment){const grid=el('div','assessment-grid');grid.append(listCard('目前能够证明',['公开标准费率可以转化为可核验的日级作业成本模型。','同一批模拟订单，可公平比较三种规则策略与数学优化。','每个生成方案都检查运输、卸货、箱位、作业顺序与交货期限。']),listCard('冲击第一仍需补强',['真实 PNC 企业订单与费用核验。','码头、货代或进口企业的业务反馈。','与现有产品对照，说明排程能力的实际贡献。','竞赛评分细则、单人参赛和 AI 辅助规则确认。']));aroot.append(grid);return;}
  const intro=el('article','card reading-card');intro.append(el('div','eyebrow','V1 SELF-ASSESSMENT'),el('h2','',assessment.headline||'第一版自评'),el('p','',(assessment.scope||'').replaceAll('独立核验','项目内部另行实现交叉核验')),el('p','',assessment.judgment||''));aroot.append(intro);
  if(assessment.maturity?.length){const grid=el('div','maturity-grid');for(const item of assessment.maturity){const card=el('article','card reading-card'),head=el('div','maturity-header');head.append(el('h2','',item.dimension),el('span','pill '+(item.status==='已验证'?'':item.status==='缺失'?'orange':'neutral'),item.status));card.append(head,el('p','',item.evidence.replaceAll('独立费用与容量检查','项目内部另行实现的费用与容量检查')),el('p','maturity-gap','待补：'+item.remaining));grid.append(card);}aroot.append(grid);}
  if(assessment.gaps?.length){const section=el('article','card reading-card schedule-section');section.append(el('h2','','下一轮优先事项'));for(const gap of assessment.gaps){const item=el('div','priority-item');item.append(el('span','pill '+(gap.priority==='P0'?'orange':'neutral'),gap.priority),el('h3','',gap.title),el('p','',gap.nextAction));section.append(item);}aroot.append(section);}
}
const pct=v=>Number.isFinite(v)?v.toFixed(2)+'%':'—';
const ms=v=>Number.isFinite(v)?v<1000?v.toFixed(1)+' ms':(v/1000).toFixed(2)+' s':'—';
const mechanismNames={'aged-backlog':'积压老箱','new-arrivals':'新到港箱','batch-release':'集中放行'};
function tableCard(title,headers,rows,subtitle=''){
  const card=el('article','card schedule-section'),head=el('div','card-header'),heading=el('div');heading.append(el('h2','card-title',title));if(subtitle)heading.append(el('p','card-subtitle',subtitle));head.append(heading);card.append(head);
  const table=el('table','data-table'),thead=el('thead'),tr=el('tr');headers.forEach(h=>tr.append(el('th','',h)));thead.append(tr);table.append(thead);const body=el('tbody');
  for(const values of rows){const row=el('tr');for(const value of values){const td=el('td');if(value instanceof Node)td.append(value);else td.textContent=value??'—';row.append(td);}body.append(row);}table.append(body);const wrap=el('div','table-wrap');wrap.append(table);card.append(wrap);return card;
}
function evidenceMetrics(items){
  const metrics=el('div','metrics');for(const [label,value,unit,sub] of items){const card=el('article','metric'+(metrics.children.length===0?' primary-metric':''));card.append(el('div','metric-label',label));const v=el('div','metric-value',value??'—');if(unit)v.append(el('span','unit',unit));card.append(v,el('div','metric-sub',sub||''));metrics.append(card);}return metrics;
}
function textNotice(text,warning=false){const notice=el('div','notice'+(warning?' warning':''));notice.append(el('span','',text));return notice;}
function reproduceButton(run){
  const button=el('button','button small','载入输入');button.disabled=!run.scenario;
  button.addEventListener('click',()=>{scenario=structuredClone(run.scenario);scenario.objectiveMode='joint';setPlanningMode('v4');setSolveLimit(run.policies?.optimized?.timeLimitSeconds??2);selectedPolicy='optimized';$('policy-select').value='optimized';invalidate('已载入 V2 输入、记录限时与 12 次重启 / 80 次尝试的搜索预算，使用保留的规则与搜索路径按联合费用目标重算。限时求解受设备速度影响，同参数结果可能不同。');syncSettings();renderEditor();activateTab('planner');});return button;
}
function evidenceCaseTable(cases,title='逐情景结果'){
  return tableCard(title,['情景 / 生成机制','箱数','优化状态','优化墙钟时间','最低费可行基准','优化新增 / ₩','基准新增 / ₩','降低 / %','输入'],cases.map(run=>{
    const opt=run.policies?.optimized||{},comp=run.comparison||{},id=el('div',''),label=el('div','strong',run.id||'未命名');id.append(label,el('div','tiny text-muted',[mechanismNames[run.mechanism]||run.mechanism,({balanced:'均衡容量',tight:'紧张容量'})[run.capacityProfile]||run.capacityProfile].filter(Boolean).join(' / ')));
    const policy=comp.bestBaseline||run.bestBaseline;
    return [id,run.count??run.scenario?.containers?.length,statusNames[opt.status]||opt.status||'未执行',ms(opt.wallTimeMs??opt.runtimeMs),names[policy]||policy||'无可行基准',money(opt.incrementalCost),money(comp.baselineIncrementalKRW??run.policies?.[policy]?.incrementalCost),pct(comp.incrementalSavingsPct),reproduceButton(run)];
  }),'失败和未证明最优的结果保留；只有完整可行方案进入费用比较。');
}
function policyTimingTable(summary){
  const by=summary.byPolicy||{};
  return tableCard('可行性与计算代价',['策略','完整可行 / 情景数','已证明最优','仅可行 / 未证最优','墙钟中位数','墙钟 P95','失败 / 限时 / 其他状态'],policyOrder.filter(key=>by[key]).map(key=>{
    const p=by[key],states=Object.entries(p.statuses||{}).filter(([s])=>!['optimal','feasible'].includes(s)).map(([s,n])=>`${statusNames[s]||s} ${n}`).join('；');
    return [names[key],`${p.feasibleCount??'—'} / ${p.caseCount??summary.caseCount??'—'}`,p.provenOptimalCount??p.statuses?.optimal??0,key==='optimized'?(p.statuses?.feasible??0):'启发式不证明最优',ms(p.wallTimeMs?.median??p.medianRuntimeMs),ms(p.wallTimeMs?.p95),states||'无'];
  }),'搜索使用固定尝试次数，整数规划使用求解限时；计算预算不等额，实际墙钟时间单独报告。');
}
function renderMainEvidence(root,data,scale=false){
  const summary=data.summary||{},cases=data.cases||[],strong=summary.againstStrongSearch||{},audit=summary.independentAudit;
  const opt=summary.byPolicy?.optimized||{};
  root.append(textNotice(scale?'规模控制组单独报告，不混入主要对照收益；限时内可行不等于已证明最优。':'公开费率 + 合成订单。基准集新增交货期限优先和多起点局部搜索；结论仅适用于这里的固定输入与模型。'));
  root.append(evidenceMetrics([
    ['较最佳可行基准 · 加权降低',Number.isFinite(summary.weightedIncrementalSavingsPct)?summary.weightedIncrementalSavingsPct.toFixed(2):'—','%',`${summary.pairedCaseCount??'—'} 组配对，含 ${summary.zeroBaselineCount??'—'} 组零费基准 · 总收费口径 ${pct(summary.weightedTotalSavingsPct)}`],
    ['相对多起点局部搜索',Number.isFinite(strong.weightedIncrementalSavingsPct)?strong.weightedIncrementalSavingsPct.toFixed(2):'—','%',`${strong.pairedCaseCount??'—'} 组配对 · 以强搜索新增费用为分母`],
    ['已证明模型最优',opt.provenOptimalCount??opt.statuses?.optimal??'—','组',`${opt.statuses?.feasible??0} 组仅可行 / ${summary.noFeasibleOptimizedCount??'—'} 组无可行解 / 共 ${summary.caseCount??cases.length} 组`],
    ['优化墙钟中位数',Number.isFinite(opt.wallTimeMs?.median)?opt.wallTimeMs.median.toFixed(1):'—','ms',`P95 ${ms(opt.wallTimeMs?.p95)} · 含调用与首次初始化`]
  ]));
  const protocol=el('article','card reading-card');protocol.append(el('h2','',scale?'规模实验边界':'比较口径与证据边界'));
  protocol.append(el('p','',`${summary.positiveSavingsCount??'—'} 组费用更低，${summary.tiedCount??'—'} 组持平，${summary.negativeSavingsCount??'—'} 组更高；${summary.noFeasibleBaselineCount??'—'} 组没有完整可行基准。失败情景和零分母不算作“100% 节省”。`));
  protocol.append(el('p','','新增费用 = 最终估算仓储与 D&D 费用 − 规划日前费用基数。加权比例用配对情景费用差总和除以基准费用总和；总收费比例另含规划日前基数，两个分母不能混用。'));
  if(!scale){const seeds=new Set(cases.map(c=>c.seed).filter(v=>v!==undefined)),counts=[...new Set(cases.map(c=>c.count))].sort((a,b)=>a-b),mechanisms=[...new Set(cases.map(c=>c.mechanism))].map(v=>mechanismNames[v]||v).filter(Boolean);protocol.append(el('p','',`已载入 ${cases.length} 个输入、${seeds.size} 个不同种子，规模 ${counts.join(' / ')} 箱，生成机制为${mechanisms.join('、')}。不同种子避免 V1 的嵌套订单复用，但合成配置仍不是现实企业的代表性样本。`));}
  if(audit)protocol.append(el('p','',`项目内部另行实现费用与约束交叉检查：${audit.checkedFeasibleSchedules??'—'} 份可行排程，${audit.failedSchedules??'—'} 份失败；不代表外部机构核验。`));
  if(benchmarkV2?.protocolVersion)protocol.append(el('p','tiny',`内部冻结协议：${benchmarkV2.protocolVersion}；SHA-256 ${String(benchmarkV2.protocolHash||'未载入').slice(0,20)}… 。字节哈希用于复现，不是外部预注册。`));root.append(protocol);
  if(!scale&&summary.byMechanism){
    root.append(tableCard('优势出现在哪里',['订单机制','配对 / 输入','加权新增费用降低','费用持平','零费用基准','无完整可行基准'],Object.entries(summary.byMechanism).map(([key,value])=>[mechanismNames[key]||key,`${value.pairedCaseCount} / ${value.caseCount}`,pct(value.weightedIncrementalSavingsPct),value.tiedCount,value.zeroBaselineCount,value.noFeasibleBaselineCount]),'新到港箱在免费期内时双方可能都为零；无费用差不应解释为优化收益。'));
    const noCharge=summary.byMechanism['new-arrivals'];
    if(noCharge?.pairedCaseCount>0&&noCharge.zeroBaselineCount===noCharge.pairedCaseCount)root.append(textNotice(`新到港机制中 ${noCharge.pairedCaseCount} 组配对的基准费用均为 0，当前没有费用优势。总体比例主要由存在堆存和用箱费用的情景贡献，不能推广到所有订单。`,true));
  }
  root.append(policyTimingTable(summary));if(cases.length)root.append(evidenceCaseTable(cases,scale?'规模控制组明细':'完整主要对照明细'));
}
function renderSensitivity(root){
  const data=benchmarkV2?.sensitivity;if(!data){root.append(listCard('暂无已完成的假设敏感性记录',['完成记录载入后显示实际结果。工作台高级假设可手动检验免费期、阶梯解释、费率倍数、还箱间隔和容量单位。']));return;}
  root.append(textNotice('这里报告“改变假设或优化目标后，产生的排程按默认联合费用重算的额外费用”。正值是参考口径损失，不是节省；它不说明哪种合同解释更真实。',true));
  const summary=Array.isArray(data.summary)?data.summary:Object.values(data.summary||{});
  root.append(tableCard('假设与目标消融',['变体','配对 / 情景数','默认口径额外费用 / ₩','默认口径加权损失','排程变动比例','可行解','同目标费用处理状态'],summary.map(v=>[v.label||v.variant,`${v.kind==='objective-ablation'?(v.strictPairedReferenceCount??v.pairedReferenceCount??'—'):(v.pairedReferenceCount??'—')} / ${v.caseCount??'—'}`,money(v.kind==='objective-ablation'?(v.strictReferenceExtraCostKRW??v.referenceExtraCostKRW):v.referenceExtraCostKRW),pct(v.kind==='objective-ablation'?(v.strictWeightedReferenceExtraCostPct??v.weightedReferenceExtraCostPct):v.weightedReferenceExtraCostPct),Number.isFinite(v.changedScheduleFraction)?pct(v.changedScheduleFraction*100):'—',v.feasibleCount??'—',Object.entries(v.tieBreakStatuses||{}).map(([key,n])=>`${({optimal:'二级目标最优',not_applicable:'不适用',primary_not_proven:'主目标未证最优',no_secondary_incumbent:'二级目标无可行解'})[key]||key} ${n}`).join('；')||'—']),'单目标消融主要费用列仅用同目标费用处理已完成的严格配对子集；其余行用可行参考配对。'));
  const unresolved=summary.filter(v=>(v.unresolvedTieBreakCount??0)>0);for(const item of unresolved)root.append(textNotice(`${item.label||item.variant}：${item.unresolvedTieBreakCount} 个同目标费用处理未完成，原始观测损失 ${pct(item.weightedReferenceExtraCostPct)} 不全部归因于联合排程贡献；主表改报 ${item.strictPairedReferenceCount} 组严格配对 ${pct(item.strictWeightedReferenceExtraCostPct)}，原始记录仍可下载。`,true));
  root.append(listCard('如何解读',['同一个输入可能存在多个同费用的最优排程，排程变动不必然意味着费用变化或业务损失。','仅优化仓储或仅优化 D&D 是机制检验，不代表当前工作台的联合目标；同价情况下尽量使用另一费用作二级目标，未证明主目标或二级求解失败的记录仍保留。','工作台始终以仓储与 D&D 联合费用求解；离线目标消融需通过下载的脚本与冻结配置复现。']));
  const cases=data.cases||[];
  if(cases.length){const details=el('details','card editor-card');const summaryEl=el('summary');summaryEl.append(el('h2','card-title',`逐变体记录 · ${cases.length} 条`));details.append(summaryEl);const table=tableCard('费用与状态明细',['输入 / 变体','优化状态','墙钟时间','参考新增 / ₩','参考额外 / ₩','变动箱比例'],cases.map(run=>{const opt=run.policies?.optimized||{},ref=run.referenceEvaluation||{};return [run.id||`${run.baselineScenarioId} / ${run.variant}`,statusNames[opt.status]||opt.status||'未找到解',ms(opt.wallTimeMs??opt.runtimeMs),money(ref.incrementalCost),money(ref.deltaVsDefaultKRW),Number.isFinite(ref.changedContainerFraction)?pct(ref.changedContainerFraction*100):'—'];}));details.append(table);root.append(details);}
}
function renderRobustness(root){
  if(!robustnessV2){root.append(listCard('暂无已完成的延误稳健性记录',['本页只展示已运行并保存的实验。初始计划受扰动后失效，与知道扰动后的重新优化是不同问题。']));return;}
  const s=robustnessV2.summary||{};
  root.append(textNotice('扰动前计划的约束失效，与“事后已知全部扰动后重算”分别统计。事后全信息重算不是线上恢复能力，也没有证明提前预测或真实延误中的收益。',true));
  root.append(evidenceMetrics([
    ['扰动后原计划失效',s.originalPlanInvalidCount??'—','次',`${s.initialPlansAudited??'—'} 次原计划检查 · 不删除失败`],
    ['事后全信息重算可行',s.hindsightFeasibleCount??'—','次',`${s.disruptionCases??'—'} 个扰动输入 · 非在线恢复`],
    ['事后重算证明最优',s.hindsightOptimalCount??'—','次','仅针对扰动已知的简化模型'],
    ['内部交叉检查',s.independentAuditedSchedules??'—','份',`${s.baseCases??'—'} 个基础输入 / ${s.operationalVariants??'—'} 组作业变体`]
  ]));
  const descriptions=robustnessV2.interpretation||robustnessV2.interpretation_zh;if(descriptions)root.append(listCard('研究边界',Array.isArray(descriptions)?descriptions:[typeof descriptions==='string'?descriptions:JSON.stringify(descriptions)]));
  const by=s.byDisruption;if(by){const rows=Array.isArray(by)?by:Object.entries(by).map(([kind,value])=>({kind,...value}));root.append(tableCard('按扰动分组',['扰动','扰动输入','原计划检查','原计划失效','事后重算可行'],rows.map(r=>[r.label||({'transport-minus-2-on-days-3-5':'第 3–5 日运输额度减 2','unload-plus-1-every-fourth-box':'每第 4 箱卸货增加 1 天',both:'运输减少 + 卸货延迟'}[r.kind])||r.name||r.kind||r.disruption,r.cases??r.caseCount??r.count,r.initialAudited??r.initialPlansAudited,r.initialInvalid??r.originalPlanInvalidCount,r.hindsightFeasible??r.hindsightFeasibleCount])));}
  const card=el('article','card reading-card schedule-section');card.append(el('h2','','完整操作假设与结果'));const p=el('p','','还箱最早日与箱位单位会改变可行域；不同单位下的容量数值不是等量资源，不应直接解释为效率提升。完整扰动、基线审计与重算结果请查看研究材料。');card.append(p);const link=el('a','button small','下载稳健性原始 JSON（gzip）');link.href=evidenceTransportPath('/data/robustness-v2.json');link.download='robustness-v2.json.gz';card.append(link);root.append(card);
}
function renderConservative(root){
  if(!conservativeV2)return;const s=conservativeV2.summary||{};
  const heading=el('article','card reading-card schedule-section');heading.append(el('div','eyebrow','EXPLORATORY / POST-HOC BUFFER'),el('h2','','为抗指定扰动多付多少'),el('p','','观察原计划失效后，探索性设计“所有箱子多预留 1 天卸货、每天少使用 2 个运输箱次”的保守缓冲。该设计使用同一组已知扰动进行回测，没有独立外部验证，也不是在线恢复策略。'));root.append(heading);
  root.append(evidenceMetrics([
    ['保守方案 · 总收费增加',Number.isFinite(s.totalPremiumPct)?s.totalPremiumPct.toFixed(2):'—','%',`同一公开基准下两项最终收费 · +${money(s.totalPremium)} ₩`],
    ['规划期新增费用增加',Number.isFinite(s.incrementalPremiumPct)?s.incrementalPremiumPct.toFixed(2):'—','%','分母扣除规划日前基数，勿与总收费比例混用'],
    ['保守计划在指定扰动下失效',s.conservativeInvalid??'—','次',`${s.conservativeDisturbanceAudits??'—'} 次检查 · 不是随机失败概率`],
    ['原计划在同组扰动下失效',s.originalInvalid??'—','次',`${s.originalDisturbanceAudits??'—'} 次检查 · 对应 ${s.cases??'—'} 个基础输入`]
  ]));
  root.append(textNotice(`这项探索以更高费用换取当前指定范围的余量。${s.conservativeFeasible??'—'} 份保守方案可行、${s.conservativeOptimal??'—'} 份在保守模型内证明最优；没有检验未知扰动，不能将 ${s.conservativeInvalid??'—'} 次失效解释为普遍抗风险保证。`,true));
  const linkBox=el('div','heading-tools research-links');for(const [text,path] of [['下载缓冲实验数据','/data/conservative-v2.json'],['阅读探索说明','/downloads/conservative-v2.md']]){const a=el('a','button small',text);a.href=path;a.download=path.split('/').pop();linkBox.append(a);}root.append(linkBox);
}
function renderV2Experiments(){
  const root=$('benchmark-v2-content');root.replaceChildren();
  const nav=el('div','research-nav');for(const [key,label] of [['main','主要对照'],['scale','规模与限时'],['sensitivity','假设敏感性'],['robustness','延误稳健性']]){const button=el('button','research-nav-button'+(key===researchSection?' active':''),label);button.setAttribute('aria-pressed',String(key===researchSection));button.addEventListener('click',()=>{researchSection=key;renderV2Experiments();});nav.append(button);}root.append(nav);
  const content=el('div','research-content');root.append(content);
  if(researchSection==='robustness'){renderRobustness(content);renderConservative(content);return;}
  if(!benchmarkV2){content.append(listCard('V2 实验记录尚未载入',[benchmarkV2LoadError?`读取失败：${benchmarkV2LoadError}`:'当前工作台已支持更强基准与高级假设。研究面板只展示已完成并保存的数据，不填入预计数值。','可切换“V1 初版留档”查看原始 24 个情景及其局限。']));return;}
  if(researchSection==='sensitivity')renderSensitivity(content);else if(researchSection==='scale'){if(benchmarkV2.scaleControls)renderMainEvidence(content,benchmarkV2.scaleControls,true);else content.append(listCard('暂无已完成的规模控制记录',['规模结果将在实验文件载入后展示。']));}else renderMainEvidence(content,benchmarkV2);
}
function renderResearchMaterials(){
  const root=$('research-materials');root.replaceChildren();const head=el('article','card reading-card');head.append(el('div','eyebrow','RESEARCH POSITIONING'),el('h2','','研究贡献落在可核验的本地机制'),el('p','','已有研究涉及提箱、拆箱、还箱与 D&D 联合排程，本项目不宣称首创。V3 完全使用公开资料，结合本地计价规则、强基准实验、公开观测留出验证与外部代码复现诊断；不要求企业私有数据。'));root.append(head);
  const grid=el('div','download-grid');
  for(const [title,description,path,label] of [
    ['文献与产品差异','核对相关研究与产品，明确已有方法、项目差异和不能声称的贡献。','prior-art-v2.md','阅读差异表'],
    ['全公开英语答辩材料','14 页英文展示草稿，基于公开资料；提交规则与英文展示权限仍待核实。','defense-v3.pdf','下载 V3 英文展示 PDF'],
    ['提交稿结构','按照可复核的研究论证组织报告、图表、数据与代码。','submission-outline-v2.md','下载报告提纲'],
    ['稳健性说明','区分原计划遇扰动失效，与事后全信息优化的结果。','robustness-v2.md','阅读实验说明'],
    ['评审自查','以外部评委可能提出的问题检查证据强度与剩余缺口。','reviewer-v2.md','阅读 V2 自评'],
    ['比赛规则状态','保留单人参赛、AI 辅助边界、评分与展示要求的核实状态。','rules-status-v2.md','阅读规则核实']
  ]){const card=el('article','download-tile');card.append(el('h3','',title),el('p','',description));const link=el('a','button small',label);link.href='/downloads/'+path;link.download=path;card.append(link);if(path==='defense-v3.pdf'){const notes=el('a','button ghost small','配套英文讲稿');notes.href='/downloads/competition-defense-v3.en.md';notes.download='competition-defense-v3.en.md';card.append(notes);const archive=el('a','button ghost small','V2 展示留档');archive.href='/downloads/defense-v2.pdf';archive.download='defense-v2.pdf';card.append(archive);}grid.append(card);}root.append(grid);
}
function renderEvidenceVisibility(){
  document.querySelectorAll('[data-evidence]').forEach(button=>{const active=button.dataset.evidence===evidenceVersion;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
  $('benchmark-v2-content').hidden=evidenceVersion!=='v2';$('benchmark-content').hidden=evidenceVersion!=='v1';$('assessment-content').hidden=evidenceVersion!=='v1';
  $('download-benchmark').disabled=evidenceVersion==='v2'?!benchmarkV2:!benchmark;
}
function renderExperiments(){renderLegacyExperiments();renderV2Experiments();renderResearchMaterials();renderEvidenceVisibility();}

async function loadEvidence(){
  const paths=['benchmark','self-assessment','source_registry','ygpa_gate_statistics','benchmark-v2','robustness-v2','conservative-v2'];
  await Promise.allSettled(paths.map(async(path,i)=>{try{const data=await fetchEvidenceJson(`/data/${path}.json${path==='benchmark-v2'?'.gz':''}`);if(i===0)benchmark=data;if(i===1)assessment=data;if(i===2)registry=data;if(i===3)gateData=data;if(i===4){benchmarkV2=data;benchmarkV2LoadError=null;}if(i===5)robustnessV2=data;if(i===6)conservativeV2=data;}catch(error){if(i===4)benchmarkV2LoadError=error.message;}}));renderSources();renderExperiments();
}

for(const key of [...Object.keys(DEFAULT_TARIFF),...Object.keys(DEFAULT_OPERATIONS)])$('assumption-'+key).addEventListener('change',()=>{readAssumptions();invalidate('假设已修改。请重新计算；非默认值仅用于压力测试，不代表官方费率。');});
$('reset-assumptions').addEventListener('click',()=>{scenario.tariff={...DEFAULT_TARIFF};scenario.operations={...DEFAULT_OPERATIONS};syncSettings();invalidate('已恢复公开费率基准与默认作业假设。请重新计算。');});
document.querySelectorAll('[data-evidence]').forEach(button=>button.addEventListener('click',()=>{evidenceVersion=button.dataset.evidence;renderEvidenceVisibility();}));
document.querySelectorAll('[data-tab]').forEach(button=>{button.setAttribute('aria-label',button.textContent.trim());button.addEventListener('click',()=>activateTab(button.dataset.tab));});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{scheduleView=button.dataset.view;document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('active',b===button);b.setAttribute('aria-pressed',String(b===button));});renderSchedule();}));
$('policy-select').addEventListener('change',event=>{selectedPolicy=event.target.value;renderSchedule();});
for(const id of ['start','days','truck','warehouse','staging'])$('setting-'+id).addEventListener('change',()=>{readSettings();invalidate();});
for(const id of ['mode','limit'])$('setting-'+id).addEventListener('change',()=>{renderSolverBudget();invalidate('规划模式或限时已修改。请重新计算，更新策略比较。');});
$('run').addEventListener('click',run);$('export-plan').addEventListener('click',exportPlan);
$('reset').addEventListener('click',()=>{scenario=makeDemoScenario(42,12);invalidate('已恢复默认模拟情景。请运行优化。');syncSettings();renderEditor();});
$('generate').addEventListener('click',()=>{const count=Number($('demo-count').value),seed=Number($('demo-seed').value);if(!Number.isInteger(count)||count<1||count>100||!Number.isInteger(seed)||seed<0||seed>4294967295){notice('箱数必须是 1–100 的整数；随机种子必须是 0–4294967295 的整数。','error');return;}scenario=makeDemoScenario(seed,count);invalidate('已生成新的可复现模拟情景。请运行优化。');syncSettings();renderEditor();});
$('add-order').addEventListener('click',()=>{if(scenario.containers.length>=100){notice('当前版本最多支持 100 个箱子。','warning');return;}let i=scenario.containers.length+1;while(scenario.containers.some(c=>c.id===`CW-${String(i).padStart(3,'0')}`))i++;scenario.containers.push({id:`CW-${String(i).padStart(3,'0')}`,sizeFt:20,dischargeDateTime:scenario.horizonStart+'T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:Math.max(0,scenario.horizonDays-2),dataOrigin:'synthetic'});syncSettings();renderEditor();invalidate();});
for(const id of ['import-orders','import-sources'])$(id).addEventListener('click',()=>$('file-input').click());$('file-input').addEventListener('change',event=>importFile(event.target.files[0]));
$('download-template').addEventListener('click',exportOrders);$('download-scenario').addEventListener('click',exportScenario);
$('download-benchmark').addEventListener('click',()=>{if(evidenceVersion==='v2'&&benchmarkV2)download('portplan-benchmark-v2.json',JSON.stringify(benchmarkV2,null,2));else if(evidenceVersion==='v1'&&benchmark)download('portplan-benchmark-v1.json',JSON.stringify(benchmark,null,2));else if(result)download('portplan-current-comparison.json',JSON.stringify(result,null,2));});
for(const id of ['calc-size','calc-days','calc-discharge','dd-size','dd-days'])$(id).addEventListener('input',renderCalculators);
mountPublicValidationUI($('panel-public-validation'));
mountResearchV7UI($('panel-research-v7'));
executionV8=mountExecutionV8UI($('panel-execution-v8'),{getScenario:()=>{readSettings();readAssumptions();return structuredClone(scenario);}});
mountResearchV8UI($('panel-research-v8'));
mountResearchV10UI($('panel-research-v9'));
mountResearchV12UI($('panel-research-v12'));
mountResearchV14UI($('panel-research-v14'));
mountResearchV15UI($('panel-research-v15'));
resourceV9=mountResourceRecoveryV9UI($('panel-resource-v9'),{getScenario:()=>{readSettings();readAssumptions();return structuredClone(scenario);}});
renderSolverBudget();syncSettings();renderEditor();renderResults();renderCalculators();renderSources();renderExperiments();loadEvidence();
const initialTab=decodeURIComponent(location.hash.slice(1));
if(initialTab&&document.getElementById('panel-'+initialTab))activateTab(initialTab);
if(!['execution-v8','research-v8','research-v9','research-v12','research-v14','research-v15','resource-v9'].includes(initialTab))run();
