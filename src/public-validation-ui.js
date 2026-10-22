/** Public evidence checks: source worked examples and our deductions remain separate. */
import { evaluatePublicExamples } from './public-fee-validation.js';

const number=new Intl.NumberFormat('zh-CN');
const money=value=>Number.isFinite(value)?number.format(value):'—';
const el=(tag,className,text)=>{const n=document.createElement(tag);if(className)n.className=className;if(text!==undefined)n.textContent=String(text);return n;};
const dollars=value=>Number.isFinite(value)?value.toFixed(2)+'%':'—';
const modelNames={global_median:'训练集全局中位数',hour_median:'按入场小时的中位数',weekday_hour_median:'按星期与入场小时的中位数'};
function download(filename,value,mime='application/json'){const blob=new Blob([typeof value==='string'?value:JSON.stringify(value,null,2)],{type:mime}),url=URL.createObjectURL(blob),a=el('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function externalLink(text,url){const a=el('a','',text);if(typeof url==='string'&&/^https?:\/\//.test(url)){a.href=url;a.target='_blank';a.rel='noopener';}return a;}
function sourceDescription(source){return `${source?.title||'公开来源'}${Number.isInteger(source?.page)?' · 第 '+source.page+' 页':''}`;}
const feeNames={pncStorage:'PNC 进口仓储费',maerskDD:'Maersk 韩国进口 D&D'};
const statusNames={pass:'数值一致',fail:'出现差异',invalid:'输入无效'};

export function mountPublicValidationUI(container,options={}){
  let evaluation=null,academic=null,observed=null,mode='fees';
  const $=id=>container.querySelector('#'+id);
  container.innerHTML=`
    <div class="page-heading"><div><div class="eyebrow">PUBLIC EVIDENCE / SOURCE-LEVEL CHECKS</div><h1 id="public-validation-title">公开验证</h1><p>把官方算例、规则推导和外部学术基准分开，核验每一类证据实际支持什么。</p></div><div class="heading-tools"><button id="pv-export" class="button">导出核验记录</button><button id="pv-rerun" class="button primary">重新核验算例</button></div></div>
    <div class="context-strip"><span class="pill">全部使用公开资料</span><span>无需企业私有记录 · 不推断真实业务节省</span><span class="end">PUBLIC / TRACEABLE</span></div>
    <div class="public-materials"><div class="heading-tools research-links"><a class="button small" href="/downloads/defense-v3.pdf" download="defense-v3.pdf">14 页英文展示 PDF</a><a class="button small" href="/downloads/competition-defense-v3.en.md" download="competition-defense-v3.en.md">英文答辩讲稿</a><a class="button small" href="/downloads/public-only-evaluation-v3.md" download="public-only-evaluation-v3.md">V3 公开证据自评</a></div><p class="tiny text-muted">全公开项目 · 展示与讲稿为草稿，提交规则及英文展示权限待确认。</p></div>
    <div class="research-nav" aria-label="公开证据类别"><button class="research-nav-button active" data-public-section="fees" aria-pressed="true">官方算例与边界</button><button class="research-nav-button" data-public-section="observed" aria-pressed="false">公开观测时间留出</button><button class="research-nav-button" data-public-section="academic" aria-pressed="false">外部学术基准</button><button class="research-nav-button" data-public-section="scope" aria-pressed="false">证据支持范围</button></div>
    <div id="pv-fees"><div id="pv-summary"></div><div id="pv-official" class="public-example-grid"></div><div id="pv-derived" class="schedule-section"></div></div>
    <div id="pv-observed" hidden></div>
    <div id="pv-academic" hidden></div>
    <div id="pv-scope" hidden></div>
  `;
  function metrics(items){const root=el('div','metrics');for(const [label,value,unit,note] of items){const card=el('article','metric'+(root.children.length===0?' primary-metric':''));card.append(el('div','metric-label',label));const metric=el('div','metric-value',value);metric.append(el('span','unit',unit));card.append(metric,el('div','metric-sub',note));root.append(card);}return root;}
  function notice(text,warning=false){const box=el('div','notice'+(warning?' warning':''));box.append(el('span','',text));return box;}
  function table(title,headers,rows,subtitle=''){
    const card=el('article','card'),head=el('div','card-header'),heading=el('div');heading.append(el('h2','card-title',title));if(subtitle)heading.append(el('p','card-subtitle',subtitle));head.append(heading);card.append(head);
    const t=el('table','data-table'),thead=el('thead'),tr=el('tr');headers.forEach(h=>tr.append(el('th','',h)));thead.append(tr);t.append(thead);const body=el('tbody');for(const values of rows){const row=el('tr');for(const value of values){const td=el('td');if(value instanceof Node)td.append(value);else td.textContent=value??'—';row.append(td);}body.append(row);}t.append(body);const wrap=el('div','table-wrap');wrap.append(t);card.append(wrap);return card;
  }
  function renderFeeChecks(){
    const summary=evaluation.summary,$summary=$('pv-summary');$summary.replaceChildren();
    $summary.append(notice('“官方刊载算例”是来源直接展示的数值；“规则推导边界”由本项目根据条款计算。两者都不是客户实际发票。Maersk 官方例仅位于第一收费档，不能确定跨档计价解释。',true));
    $summary.append(metrics([
      ['官方刊载算例',summary.officialWorkedExamples,'个','有明确来源页码与刊载金额'],
      ['本项目推导边界',summary.derivedCases,'个','检验实现与已声明规则解释一致'],
      ['数值一致',summary.passed,'个',`共 ${summary.total} 个检查 · 不是 ${summary.total} 个官方案例`],
      ['差异 / 无效',summary.failed+summary.invalid,'个',`${summary.failed} 个差异 / ${summary.invalid} 个无效输入`]
    ]));
    const official=$('pv-official');official.replaceChildren();
    for(const example of evaluation.cases.filter(c=>c.evidenceType==='official_worked_example')){
      const card=el('article','card reading-card public-example-card'),heading=el('div','maturity-header');heading.append(el('h2','',feeNames[example.feeType]||example.feeType),el('span','pill '+(example.status==='pass'?'':'orange'),statusNames[example.status]||example.status));card.append(heading,el('div','eyebrow','OFFICIAL WORKED EXAMPLE'));
      const values=el('div','public-example-values');for(const [label,value] of [['来源刊载 / ₩',example.expectedKRW],['当前引擎 / ₩',example.actualKRW]]){const cell=el('div');cell.append(el('span','',label),el('strong','mono',money(value)));values.append(cell);}card.append(values);
      card.append(el('div','rate-details',example.formula),el('p','',example.sourceInterpretation));card.append(externalLink(sourceDescription(example.source)+' ↗',example.source?.url));
      const detail=el('p','tiny public-example-footnote',`${example.sizeLabel||example.sizeFt+' ft'} · 累计 ${example.elapsedDays} 天 · 另行算式复核 ${money(example.referenceKRW)} ₩ · 非实际账单`);card.append(detail);official.append(card);
    }
    const derived=$('pv-derived');derived.replaceChildren();derived.append(table('规则推导边界 · 单独列示',['费用 / 箱型','累计天数','推导公式','推导预期 / ₩','引擎计算 / ₩','状态','依据'],evaluation.cases.filter(c=>c.evidenceType==='derived_boundary_case').map(c=>{const tag=el('span','pill '+(c.status==='pass'?'neutral':'orange'),statusNames[c.status]||c.status);return [`${feeNames[c.feeType]||c.feeType} / ${c.sizeFt} ft`,c.elapsedDays,c.formula,money(c.expectedKRW),money(c.actualKRW),tag,externalLink(c.source?.page?'来源第 '+c.source.page+' 页 ↗':'公开费率页 ↗',c.source?.url)];}),'这些数值由本项目推导；D&D 跨档累加检查仍以已披露的模型解释为前提。'));
    derived.append(notice('推导值、独立结构的参考算式和当前引擎相同，说明实现一致性；不能把同一规则的多次计算当成多个独立业务证据。'));
  }
  function renderScope(){
    const root=$('pv-scope');root.replaceChildren();root.append(table('证据能支持什么',['证据层级','可以支持','不能支持'],[
      ['官方刊载算例','窄范围算术与来源示例是否一致','任意合同适用性、真实发票或运营节省'],
      ['按条款推导的边界','实现是否按声明解释处理免费期与档位','把本项目推导当成独立官方数值证据'],
      ['项目合成场景','相同信息与资源约束下的方法比较','现实企业的平均节省或代表性需求'],
      ['外部学术公开代码','诊断文件完整性、运行状态和输出可核验性','把减预算运行当成论文完整复现或方法优越性证明'],
      ['公开观测时间留出','预先分开的时间段上检验停留时长估计误差','PNC 提还箱收益、已部署预测或跨港普适性'],
      ['指定扰动与保守缓冲','已列扰动下的可行性与费用权衡','预测未知风险或保证在线恢复成功']
    ]));
    const card=el('article','card reading-card schedule-section');card.append(el('h2','','当前研究定位'),el('p','','本项目使用公开资料构建可核验、可复现的决策模型。没有真实箱级业务订单，因此不宣称企业实测节省。公开路线的价值在于公开规则是否实现正确、方法比较是否公平、失败是否披露，以及结论能否在不同构造机制下复现。'));root.append(card);
  }
  function renderAcademic(){
    const root=$('pv-academic');root.replaceChildren();
    if(!academic){root.append(notice('外部学术基准记录尚未载入。这里只显示已获取、已核对并运行的公开数据，不以预计结果替代证据。'));return;}
    if(options.renderAcademic){options.renderAcademic(root,academic,{el,table,metrics,notice,money,percent:dollars,externalLink});return;}
    const summary=academic.summary||{},runs=academic.runs||[];
    root.append(notice('这是外部公开学术代码的复现诊断，与 PortPlan 使用的目标函数和数据口径不同，不做跨模型费用排行。原样代码失败与补文件假设版必须分开；运行完成不等于原论文或费用已独立复现。',true));
    root.append(metrics([
      ['公开代码运行记录',summary.runCount??runs.length,'次','保留失败、超时和补文件标记'],
      ['程序运行完成',summary.completedCount??'—','次','仅表示程序结束并产出记录'],
      ['错误 / 超时',(summary.errorCount??0)+(summary.timeoutCount??0),'次',`${summary.errorCount??'—'} 次错误 / ${summary.timeoutCount??'—'} 次超时`],
      ['目标费用独立核验',summary.independentlyCostVerifiedCount??'—','次','不把原程序自报费用当作真值']
    ]));
    const protocol=academic.protocol||{},budget=protocol.budget||{},published=protocol.paperPublishedBudget||{},tracks=summary.byTrack||{};
    root.append(table('原样文件与显式补件 · 分开统计',['运行轨道','记录数','完成','错误','超时','完成输出存在核验问题'],Object.entries(tracks).map(([key,value])=>[key==='original-files'?'原样公开文件':'显式 distance → distance2 补件假设',value.runCount,value.completedCount,value.errorCount,value.timeoutCount,value.checkedOutputWithIssuesCount]),'运行状态由本项目记录，输出结构由本项目另行检查；不代表外部机构认证。'));
    const status={completed:'运行完成',complete:'运行完成',success:'运行完成',error:'运行错误',failed:'运行失败',timeout:'超时',invalid:'记录无效',implementation_error:'原样运行错误',completed_reported_cost_unverified:'完成 · 目标值未核验'};
    root.append(table('逐次运行结果',['参数版本 / 种子','使用的公开文件','运行状态','墙钟时间 / 秒','自报目标值 / RMB','核验结果'],runs.map(run=>{
      const modeTag=el('span','pill '+(run.distance2Alias?'orange':'neutral'),run.distance2Alias?'补文件假设版':'原样公开文件');
      const audit=run.audit||{},issues=audit.errors||[];
      const result=run.errorType==='FileNotFoundError'?'缺少 distance2 文件':issues.length?`输出结构／时间检查存在 ${issues.length} 项问题；成本未重建`:run.errorType||run.error||'目标费用未独立核验';
      return [`${run.variant==='paper'?'论文参数':'代码参数'} / ${run.seed??'—'}`,modeTag,status[run.status]||run.status||'未记录',Number.isFinite(run.processWallSeconds??run.wallSeconds)?(run.processWallSeconds??run.wallSeconds).toFixed(2):'—',Number.isFinite(run.reportedCost)?run.reportedCost.toLocaleString('zh-CN',{maximumFractionDigits:2}):'—',result];
    }),'保留原模型人民币目标值，仅用于运行诊断；不能与 PortPlan 的韩元费用比较，也不能据自报目标值认定解有效。'));
    const caveat=el('article','card reading-card schedule-section');caveat.append(el('h2','','缩减计算预算，不是完整论文复现'),el('p','',`本轮每次运行 ${budget.ants??'—'} 只蚂蚁 × ${budget.iterations??'—'} 次迭代，进程限时 ${budget.timeoutSeconds??'—'} 秒。论文公布预算为 ${published.ants??'—'} 只蚂蚁 × ${published.iterations??'—'} 次迭代，因此不据此评价原论文最优值或算法质量。`),el('p','','公开代码引用的 distance2 文件缺失。显式用 distance 矩阵补位后能运行，但这只是研究假设；不能称原样成功复现。返回的路径与时间数组存在长度不一致等问题，且重载／空载状态未充分标注，尚不能完整认证方向性任务、时间窗或重建全部成本。'),el('p','','协议在原样／补件各一次探测后冻结，再执行参数与种子组合；这不是先于所有观察的预注册。公开失败记录用于界定证据边界，没有与 PortPlan 做同模型、同数据、同成本口径比较。'));
    const links=el('div','heading-tools research-links');for(const [text,path] of [['复现诊断报告','/downloads/external-reproduction-v3.md'],['下载冻结协议','/data/public-reproduction-protocol-v3.json']]){const a=el('a','button small',text);a.href=path;a.download=path.split('/').pop();links.append(a);}caveat.append(links);root.append(caveat);
    const details=el('details','card editor-card'),head=el('summary');head.append(el('h2','card-title','公开代码来源、摘要与运行环境'));details.append(head);const body=el('div','card-body');
    if(protocol.sourceDOI)body.append(externalLink('PLOS ONE 原论文 ↗','https://doi.org/'+protocol.sourceDOI));
    if(protocol.sourceCodeDOI){body.append(el('span','',' · '),externalLink('公开补充代码 ↗','https://doi.org/'+protocol.sourceCodeDOI));}
    body.append(el('p','tiny public-source-hash',`冻结协议 SHA-256：${academic.protocolSHA256||'未载入'}`));
    const source=protocol.source||{},snapshot={executionState:academic.executionState,protocolVersion:protocol.version,budget,paperPublishedBudget:published,seeds:protocol.seeds,source:{originalMainSHA256:source.originalMainSHA256,archiveSHA256:source.archiveSHA256,inputSHA256:source.inputSHA256,adapterChanges:source.adapterChanges},environment:runs.find(r=>r.environment)?.environment,runs:runs.map(r=>({id:r.id,status:r.status,structuralErrors:r.audit?.errors,limitations:r.audit?.limitations}))};
    body.append(el('pre','public-protocol-json',JSON.stringify(snapshot,null,2)));details.append(body);root.append(details);
  }

  function renderObserved(){
    const root=$('pv-observed');root.replaceChildren();
    if(!observed){root.append(notice('公开观测的时间留出验证记录尚未载入。没有已完成结果时不填入预计误差或改进数值。'));return;}
    const summary=observed.summary||{},improvement=summary.maeImprovementPct;
    root.append(notice('使用真实公开的光阳港车辆进出观测，检验场内停留时长估计。它不是 PNC 箱级订单、仓库卸货或公路行程记录，也不验证提还箱费用节省。'));
    root.append(notice('这是探索性回顾校验：在阅读汇总数据后设计，候选方法在拟合前固定；不是前瞻部署试验。1–4 月训练、5 月选模、6 月仅评估，保留全部候选结果。',true));
    root.append(metrics([
      ['真实公开非空记录',summary.records??'—','条','光阳港车辆进出记录 · 非企业私有订单'],
      ['留出集平均绝对误差',Number.isFinite(summary.testMAE)?summary.testMAE.toFixed(2):'—','分钟',`${summary.testCount??'—'} 条留出记录 · MAE 越低越好`],
      ['固定基准 MAE',Number.isFinite(summary.baselineMAE)?summary.baselineMAE.toFixed(2):'—','分钟','在同一留出集、相同可用信息下比较'],
      [Number.isFinite(improvement)&&improvement<0?'相对基准 · 误差上升':'相对基准 · MAE 降低',Number.isFinite(improvement)?Math.abs(improvement).toFixed(2):'—','%',Number.isFinite(improvement)&&improvement<=0?'未显示误差改善，结果照实保留':'误差变化，不称业务预测准确率']
    ]));
    const card=el('article','card reading-card');card.append(el('h2','','按时间分开训练、选模和检验'),el('p','',`训练记录 ${summary.trainCount??'—'} 条，验证记录 ${summary.validationCount??'—'} 条，最终留出记录 ${summary.testCount??'—'} 条。选择模型：${modelNames[summary.selectedModel]||summary.selectedModel||'未记录'}。`));
    card.append(el('p','','训练与选模不能使用最终留出集的结果来挑选方案。若仅一个季节或一个码头有数据，不能据此推断跨港、跨季节或上线后的表现。'));root.append(card);
    if(observed.periods){const entries=Object.entries(observed.periods);root.append(table('时间切分与实际覆盖',['阶段','实际首条 → 末条','有记录日期','观测记录'],entries.map(([key,value])=>[({train:'1–4 月训练',validation:'5 月选模',test:'6 月最终留出'})[key]||key,`${value.firstEntry?.slice(0,10)||'—'} → ${value.lastEntry?.slice(0,10)||'—'}`,value.observedDates,money(value.visits)]),'缺失日期不当作零活动日；固定训练统计，不用 5 月或 6 月标签重新拟合。'));}
    if(observed.candidates?.length)root.append(table('所有候选方法 · 按 5 月 MAE 选模',['方法','训练分组数','5 月选模 MAE / 分钟','6 月留出 MAE / 分钟','6 月 P90 绝对误差 / 分钟','选择状态'],observed.candidates.map(c=>[modelNames[c.model]||c.model,c.learnedGroups,Number.isFinite(c.validation?.mae)?c.validation.mae.toFixed(2):'—',Number.isFinite(c.test?.mae)?c.test.mae.toFixed(2):'—',money(c.test?.p90AbsoluteError),c.model===summary.selectedModel?'5 月选定':'保留对照']),'仅使用入场时已知的小时/星期；小样本分组退回训练集全局中位数。没有使用未来出场时间作为特征。'));
    const interval=summary.dailyBootstrap95IntervalMinutes;
    if(Array.isArray(interval)&&interval.length===2){const note=el('article','card reading-card schedule-section');note.append(el('h2','','误差与不确定性口径'),el('p','',`留出集覆盖 ${summary.observedTestDates} 个有记录日期。按日期等权的平均 MAE 改善为 ${summary.equalDateMeanMAEImprovementMinutes.toFixed(3)} 分钟；日期重采样的 95% 描述性区间为 ${interval[0].toFixed(3)}–${interval[1].toFixed(3)} 分钟。这个日期等权口径与上方按访问记录加权的 MAE 不同。`),el('p','',`最终模型 P90 绝对误差为 ${summary.testP90AbsoluteError} 分钟。由于没有稳定的去匿名车辆标识，不能把每条访问当作独立车辆样本；区间不是部署保证。`));root.append(note);}
    const source=el('article','card reading-card schedule-section');source.append(el('h2','','公开来源与复现'),el('p','','目标值是出场时间减入场时间。原始 CSV 时区没有显式标注；韩国时间按码头位置推断。用于本实验的清洗数据不含车牌。'));
    if(observed.source?.catalogUrl)source.append(externalLink('查看 YGPA 公开数据目录 ↗',observed.source.catalogUrl));
    source.append(el('p','tiny public-source-hash',`来源 SHA-256：${observed.source?.sha256||'未载入'}；协议 SHA-256：${observed.protocolSha256||'未载入'}`));
    const links=el('div','heading-tools research-links');for(const [text,path] of [['下载去标识 CSV','/data/public/v3-gate-visits-deidentified.csv'],['阅读留出验证说明','/downloads/public-gate-validation-v3.md'],['公开证据路线','/downloads/public-only-evidence-v3.md']]){const a=el('a','button small',text);a.href=path;a.download=path.split('/').pop();links.append(a);}source.append(links);root.append(source);
    const limits=['光阳港车辆场内访问记录不能替代 PNC 箱级提还链路、卡车路线或仓库作业记录。','缺失日期不补为零；重复车辆不能可靠分离，按日期重采样只是回顾性误差诊断。','本次训练保持 1–4 月固定，5 月选择候选，6 月仅用于结果评估。','停留时长估计误差不能换算成费用节省、预约容量或真实运营有效性。'];if(Array.isArray(limits)&&limits.length){const limitations=el('article','card reading-card schedule-section');limitations.append(el('h2','','仍然不能支持的结论'));const list=el('ul');for(const text of limits)list.append(el('li','',typeof text==='string'?text:JSON.stringify(text)));limitations.append(list);root.append(limitations);}
  }
  function activate(section){mode=section;container.querySelectorAll('[data-public-section]').forEach(button=>{const active=button.dataset.publicSection===section;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});for(const key of ['fees','observed','academic','scope'])$('pv-'+key).hidden=key!==section;$('pv-rerun').hidden=section!=='fees';$('pv-export').disabled=section==='academic'?!academic:section==='observed'?!observed:false;}
  function rerun(){evaluation=evaluatePublicExamples();renderFeeChecks();}
  container.querySelectorAll('[data-public-section]').forEach(button=>button.addEventListener('click',()=>activate(button.dataset.publicSection)));
  $('pv-rerun').addEventListener('click',rerun);$('pv-export').addEventListener('click',()=>download(mode==='academic'?'portplan-public-academic-evidence.json':mode==='observed'?'portplan-public-gate-validation.json':mode==='scope'?'portplan-public-evidence-scope.json':'portplan-public-fee-validation.json',mode==='academic'?academic:mode==='observed'?observed:mode==='scope'?{generatedAt:new Date().toISOString(),feeSummary:evaluation.summary,academicSummary:academic?.summary??null,observedSummary:observed?.summary??null,claimBoundary:'No actual container invoices or field savings validation; public code reproduction remains incomplete.'}:{generatedAt:new Date().toISOString(),...evaluation}));
  rerun();renderScope();renderAcademic();renderObserved();
  const controller={setAcademicEvidence(value){academic=value;renderAcademic();activate(mode);},setObservedEvidence(value){observed=value;renderObserved();activate(mode);}};
  Promise.allSettled([['/data/external-reproduction-v3.json',controller.setAcademicEvidence],['/data/public-gate-validation-v3.json',controller.setObservedEvidence]].map(async([url,apply])=>{const response=await fetch(url);if(response.ok)apply(await response.json());}));
  return controller;
}
