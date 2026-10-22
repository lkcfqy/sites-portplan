const FORMAL_INDEX = '141ac68b0627e74ffa41f881078d9d73304263240e858d148c64e91562217646';
const REPORTS = new Set(['/data/browser-acceptance-v13.json', '/data/development-guard-v13.json', '/data/development-guard-review-v13.json']);

export async function fetchBoundContinuationReport(reference, request = fetch) {
  if (!reference || !REPORTS.has(reference.path) || !/^[a-f0-9]{64}$/.test(reference.sha256 ?? '')) throw new Error('推进记录缺少有效的站内路径或原始 SHA。');
  const response = await request(reference.path);
  if (!response.ok) throw new Error('推进记录 HTTP ' + response.status);
  const bytes = await response.arrayBuffer();
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(v => v.toString(16).padStart(2, '0')).join('');
  if (digest !== reference.sha256) throw new Error('推进记录的原始字节与声明不一致。');
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function validateContinuationV13(status, browser, development, review) {
  const need = (value, message) => { if (!value) throw new Error(message); };
  need(status?.schemaVersion === 'portplan-continuation-v13' && status.formalIndexSha256 === FORMAL_INDEX, '本轮状态未绑定 V12 首次正式研究。');
  need(status.fullChampionshipPlanComplete === false && status.defaultRecommendationEligible === false && status.enterpriseRecordsRequired === false, '有限开发范围或未验收状态不完整。');
  if (status.browserAcceptance?.status === 'passed') {
    need(browser?.schemaVersion === 'portplan-published-browser-acceptance-v13' && browser.valid === true && browser.actualBrowser === true && browser.fixture !== true, '缺少实际浏览器操作记录。');
    need(browser.browser?.engine === 'Chromium' && Number.isSafeInteger(browser.totalChecks) && browser.totalChecks >= 45 && browser.passedChecks === browser.totalChecks && browser.openProductIssues === 0 && browser.unresolvedHarnessIssues === 0, '浏览器操作覆盖未完成或仍有未解决问题。');
    need(Array.isArray(browser.cases) && browser.cases.length === browser.totalChecks && browser.cases.every(item => item.status === 'passed' && typeof item.id === 'string' && typeof item.group === 'string' && Number.isInteger(item.checklistRow) && item.checklistRow >= 1 && item.checklistRow <= 10) && new Set(browser.cases.map(item => item.group + '/' + item.id)).size === browser.totalChecks && new Set(browser.cases.map(item => item.checklistRow)).size === 10, '浏览器记录缺少完整且不重复的实际验收项目。');
    need(browser.entrantUnderstandingCertified === false && browser.nativeFormalExperiment === false, '浏览器检查被扩大为本人或原生正式实验验收。');
  }
  if (status.algorithmDevelopment?.status === 'reviewed_seen_controlled_experiment') {
    need(development?.schemaVersion === 'portplan-v13-controlled-development' && development.executionState === 'complete' && development.fixture !== true, '开发分支原始记录不完整。');
    need(development.businessCases === 2 && development.timingRepeats === 3 && development.plannedRuns === 12 && development.recordedRuns === 12 && development.freshHeldOutBusinessCases === 0 && development.forcedEndpoints === true, '受控开发范围或全部运行覆盖不匹配。');
    need(review?.schemaVersion === 'portplan-independent-guard-replay-review-v13' && review.valid === true && review.readOnly === true && review.importsJavaScript === false && review.solverRuns === 0 && /^[a-f0-9]{64}$/.test(development.inputIndexSha256 ?? '') && review.inputIndexSha256 === development.inputIndexSha256, '开发复核未绑定同一首次原档。');
    need(development.defaultRecommendationEligible === false && development.fullChampionshipPlanComplete === false, '旧端点开发不能作为默认替换或完整冲冠验收。');
    for (const branch of ['seed', 'native']) {
      const item = development.byBranch?.[branch];
      need(item && ['complete', 'failed', 'unknown'].every(key => Number.isSafeInteger(item[key]) && item[key] >= 0) && item.complete + item.failed + item.unknown === 6, '分支必须保留全部六次运行与失败。');
    }
  }
  return true;
}

export async function renderContinuationV13(container) {
  const element = (tag, text) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; return node; };
  const link = (text, href) => { const node = element('a', text); node.href = href; node.className = 'button small'; return node; };
  container.className = 'card reading-card';
  container.replaceChildren(element('h2', '本轮推进 · 浏览器验收与 V13 有限开发'));
  try {
    const response = await fetch('/data/continuation-v13.json');
    if (!response.ok) throw new Error('状态 HTTP ' + response.status);
    const status = await response.json();
    const browser = status.browserAcceptance?.status === 'passed' ? await fetchBoundContinuationReport(status.browserAcceptance.record) : null;
    const completed = status.algorithmDevelopment?.status === 'reviewed_seen_controlled_experiment';
    const development = completed ? await fetchBoundContinuationReport(status.algorithmDevelopment.record) : null;
    const review = completed ? await fetchBoundContinuationReport(status.algorithmDevelopment.review) : null;
    validateContinuationV13(status, browser, development, review);
    container.append(element('p', browser ? `真实 Chromium 自动化已通过 ${browser.passedChecks} 项操作检查：桌面与 390px 窄屏、支持页面的中韩切换、键盘、导入导出、成功/失败教学及停止重跑。5 秒截止使用明确记录的受控 Worker 停滞测试。` : '本轮浏览器验收记录尚未完成，暂不展示通过结论。'));
    if (development) {
      const table = element('table'); table.className = 'data-table';
      const head = element('tr'); for (const text of ['强制 D5 端点', '完整 / 6', '已知失败', '未知']) head.append(element('th', text));
      const thead = element('thead'); thead.append(head); table.append(thead);
      const body = element('tbody');
      for (const [key, label] of [['seed', '原完整构造端点'], ['native', '原原生端点']]) {
        const row = element('tr'), item = development.byBranch[key];
        for (const text of [label, item.complete, item.failed, item.unknown]) row.append(element('td', String(text)));
        body.append(row);
      }
      table.append(body); const wrap = element('div'); wrap.className = 'table-wrap'; wrap.append(table); container.append(wrap);
      container.append(element('p', 'V13 为严格省费替换增加明日必要仓库负荷保护。上表只含两个已见业务案例、两种强制端点和三次时钟重复；D6 后才使用同一 V13 方法自然延续。它检验端点选择机制，不是自然初始化、新留出样本或总体完成率。全部首次失败保留。'));
    } else container.append(element('p', 'V13 已实现严格省费替换的必要仓位保护；受控开发实验及独立审阅尚未全部完成，不填入预计成绩。'));
    container.append(element('p', '完整冲冠计划尚未完成：算法默认替换门槛与本人资格、报名、复现及答辩仍分别验收。企业资料和联系人为可选增强。下方 V12 的 2,592 次首次正式成绩保持原样。'));
    const links = element('div'); links.className = 'heading-tools research-links';
    links.append(link('本轮验收状态', '/data/championship-acceptance-v13.json'), link('浏览器操作记录', '/data/browser-acceptance-v13.json'), link('V13 方法与限制', '/downloads/method-v13.md'), link('受控开发协议', '/data/protocol-development-v13.json'));
    if (development) links.append(link('全部开发结果', '/data/development-guard-v13.json'), link('独立开发复核', '/data/development-guard-review-v13.json'));
    container.append(links);
  } catch (error) {
    container.append(element('p', '本轮推进记录尚未通过完整性检查：' + error.message + '；未据此宣布验收通过。下方首次研究资料可独立查看。'));
  }
}
