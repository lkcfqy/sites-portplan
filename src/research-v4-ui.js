import {fetchEvidenceJson,evidenceTransportPath} from './evidence-transport.js';
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node;};
const money=value=>Number.isFinite(value)?new Intl.NumberFormat('zh-CN').format(Math.round(value)):'—';
const names={permutation:'排列搜索',eventSearch:'直接日期搜索',rawMILP:'原始 MILP',presolveMILP:'预处理组合'};
const status=s=>({optimal:'模型内最优',feasible:'完整可行',rolling_failed:'执行未完成',hard_time_limit:'硬限时无完整解',time_limit:'限时无完整解',infeasible:'模型不可行',no_feasible_schedule_found:'搜索未找到完整解'}[s]??s??'—');
const resultStatus=r=>r.retainedCheckpoint&&r.rows?.length?'硬限时 · 保留完整可行解':status(r.status);
function table(title,headers,rows){
  const card=el('article','card schedule-section'),head=el('div','card-header');head.append(el('h2','card-title',title));card.append(head);
  const wrap=el('div','table-wrap'),t=el('table','data-table'),h=el('thead'),tr=el('tr');headers.forEach(v=>tr.append(el('th','',v)));h.append(tr);t.append(h);
  const body=el('tbody');for(const values of rows){const row=el('tr');for(const v of values){const td=el('td');if(v instanceof Node)td.append(v);else td.textContent=v??'—';row.append(td);}body.append(row);}t.append(body);wrap.append(t);card.append(wrap);return card;
}
function note(text,warning=false){return el('div','notice'+(warning?' warning':''),text);}
function link(label,path){const a=el('a','button small',label);a.href=evidenceTransportPath(path);a.download=evidenceTransportPath(path).split('/').pop();return a;}
function download(name,value){const a=el('a'),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export function mountResearchV4UI(container){
  let evidence={},mode='rolling',selected=0,day=0,live=null,worker=null,job=0;
  container.innerHTML=`<div class="page-heading"><div><div class="eyebrow">V4 / EXECUTION & REPRODUCIBLE EVIDENCE</div><h1 id="research-v4-title">决策与证据</h1><p>检验计划如何执行、异常如何恢复，以及每一项结果的证据边界。</p></div><div class="heading-tools"><a class="button" href="/downloads/defense-v4.ko.pdf" download>韩文展示 PDF</a><a class="button" href="/downloads/portplan-source.zip" download>完整源码与证据</a></div></div><div class="context-strip"><span class="pill">公开规则 · 合成订单</span><span>日级模型 · 已执行动作固定 · 未知未来容量不传给规划器</span></div><div class="research-nav" aria-label="V4 证据类型"></div><div class="v4-content"></div>`;
  const nav=container.querySelector('.research-nav'),content=container.querySelector('.v4-content');
  for(const [key,label] of [['rolling','滚动执行'],['budget','同预算对照'],['certificate','独立核验'],['submission','参赛资料']]){
    const b=el('button','research-nav-button',label);b.dataset.v4Mode=key;b.addEventListener('click',()=>{mode=key;render();});nav.append(b);
  }
  const complete=key=>evidence[key]?.executionState==='complete'||key==='certificate-v4'&&evidence[key]?.summary;
  function render(){
    for(const b of nav.children){b.classList.toggle('active',b.dataset.v4Mode===mode);b.setAttribute('aria-pressed',String(b.dataset.v4Mode===mode));}
    content.replaceChildren();if(mode==='rolling')renderRolling();else if(mode==='budget')renderBudget();else if(mode==='certificate')renderCertificates();else renderSubmission();
  }
  function renderRolling(){
    const data=evidence['rolling-v4'];
    if(!complete('rolling-v4')){content.append(note('滚动实验档案暂未载入；请检查连接后刷新。'));return;}
    const s=data.summary,items=[['静态原计划',s.byMethod.static.completeCount],['因果滚动计划',s.byMethod.rolling.completeCount],['全知参考',s.byMethod.hindsight.completeCount]];
    const stats=el('div','v4-stat-grid');for(const [label,n]of items){const card=el('article','metric');card.append(el('div','metric-label',label),el('div','metric-value',`${n} / ${s.caseCount}`),el('div','metric-sub','完整执行数 · 全知参考不属于在线方法'));stats.append(card);}content.append(stats);
    content.append(note('所有订单初始已知，未来容量冲击未知。滚动方法每天重算；静态方法保持首日计划。两者每次求解限时相同，重算次数不同，因此不宣称总计算预算相等。',true));
    const controls=el('div','v4-controls card reading-card'),label=el('label','field','查看固定场景'),select=el('select');select.setAttribute('aria-label','滚动实验场景');
    data.cases.forEach((c,i)=>{const option=el('option','',`${c.id} · ${status(c.policies.rolling.status)}`);option.value=i;select.append(option);});select.value=String(selected);label.append(select);controls.append(label);
    const run=el('button','button primary','本机重新运行'),cancel=el('button','button','停止'),exportButton=el('button','button','导出执行记录');cancel.disabled=!worker;run.disabled=!!worker;
    controls.append(run,cancel,exportButton);content.append(controls);
    select.addEventListener('change',()=>{selected=Number(select.value);day=0;live=null;job++;if(worker){worker.terminate();worker=null;}render();});
    const c=data.cases[selected],r=live??c.policies.rolling;
    exportButton.addEventListener('click',()=>download('portplan-rolling-execution.json',{nominalScenario:c.nominalScenario,events:c.events,result:r}));
    cancel.addEventListener('click',()=>{worker?.terminate();worker=null;job++;render();});
    run.addEventListener('click',()=>{
      if(worker)return;const id=++job,activeWorker=new Worker(new URL('./research-v4.worker.js',import.meta.url),{type:'module'});worker=activeWorker;render();
      activeWorker.onmessage=({data:message})=>{if(message.id!==id||job!==id||worker!==activeWorker)return;if(message.error){live={status:'rolling_failed',failure:{reason:message.error},timeline:[]};}else live=message.result;activeWorker.terminate();worker=null;day=0;render();};
      activeWorker.onerror=event=>{if(job!==id||worker!==activeWorker)return;live={status:'rolling_failed',failure:{reason:event.message},timeline:[]};activeWorker.terminate();worker=null;render();};
      activeWorker.postMessage({id,scenario:c.nominalScenario,events:c.events,timeLimitSeconds:0.3});
    });
    if(worker)content.append(note('正在浏览器后台重跑；设备速度和限时会影响结果，可随时停止。'));
    content.append(note(`${live?'本机重跑':'归档结果'}：${status(r.status)}${r.complete?` · 最终两费 ${money(r.totalCost)} ₩ · ${r.revisionCount} 个待执行事件日期变化`:` · 完整计划费用未定义 · ${r.failure?.reason??''}`}`));
    const timeline=r.timeline??[];if(!timeline.length)return;day=Math.min(day,timeline.length-1);
    const slider=el('input');slider.type='range';slider.min='0';slider.max=String(timeline.length-1);slider.step='1';slider.value=String(day);slider.setAttribute('aria-label','查看执行到第几天');const box=el('div','v4-day-control');box.append(el('label','',`执行时点 D+${timeline[day].day}`),slider);content.append(box);
    slider.addEventListener('input',()=>{day=Number(slider.value);render();});
    const entry=timeline[day];content.append(table('当时已观察的资源',['资源','当天容量','已宣布持续期'],(entry.observedEvents??[]).map(e=>[({truck:'运输箱次',warehouse:'卸货槽',staging:'跨日箱位'}[e.resource]),e.capacity,(e.announcements??[]).map(a=>a.announcedDuration?`${a.announcedDuration} 天`:'仅当日已知').join('；')||'未来使用名义预测'])));
    content.append(table('执行历史与今日动作',['箱号','作业','执行日'],timeline.slice(0,day+1).flatMap(e=>(e.executedEvents??[]).map(a=>[a.id,({pickup:'提箱',unloadStart:'开始卸货',return:'还空箱'}[a.event]??a.event),`D+${a.day}`]))));
    if(entry.revisions?.length)content.append(table('当天重排变化',['箱号','事件','原计划','新计划'],entry.revisions.map(a=>[a.id,a.event,`D+${a.previousDay}`,`D+${a.newDay}`])));
    content.append(el('p','tiny text-muted',`信息快照 SHA-256：${entry.observationHash??'—'} · 当天状态 ${entry.status} · 已执行日期由下一次规划的硬约束固定。`));
  }
  function renderBudget(){
    const data=evidence['benchmark-v4'];if(!complete('benchmark-v4')){content.append(note('同预算档案暂未载入。'));return;}
    content.append(note(`完整 ${data.summary.caseCount} 个预固定合成场景，4 种方法各自享有 1,000 ms 端到端硬预算。包括进程启动、依赖加载、初始方案、建模、求解、审计和消息交付。所有失败和负改善保留。`,true));
    content.append(table('可行性与最优状态',['方法','完整解 / 全部','预算内最优','硬截止次数','保留检查点'],Object.entries(data.summary.byPolicy).map(([m,s])=>[names[m],`${s.feasibleCount} / ${s.caseCount}`,s.provenOptimalCount,s.hardDeadlineCount,s.retainedCheckpointCount])));
    content.append(table('费用比较：同一配对集合',['对照','配对数','新增费用差 / ₩','加权改善','更低 / 相同 / 更高'],Object.entries(data.summary.comparisons).map(([,s])=>[`${names[s.candidateMethod]} 对 ${names[s.baselineMethod]}`,s.pairedCaseCount,money(s.incrementalSavingsKRW),Number.isFinite(s.weightedIncrementalSavingsPct)?s.weightedIncrementalSavingsPct.toFixed(2)+'%':'—',`${s.positiveSavingsCount} / ${s.tiedCount} / ${s.negativeSavingsCount}`])));
    const rows=data.cases.flatMap(c=>Object.entries(c.policies).map(([m,r])=>[c.id,names[m],resultStatus(r),money(r.incrementalCost),r.incumbentSource??'无',r.retainedCheckpoint?'硬截止保留可行候选':r.endToEndCompletedWithinBudget?'预算内完成':'未完成']));content.append(table('所有场景与方法',['场景','方法','状态','新增费用 / ₩','解的来源','端到端预算'],rows));
    content.append(note('预处理组合不是普遍更省费。初始化开销可能减少 MILP 的剩余预算；检查点回退属于启发式可行解，不能冒充 GLPK 最优证明。零费用场景不显示百分比。',true));
    const links=el('div','heading-tools research-links');links.append(link('完整对照 JSON','/data/benchmark-v4.json'),link('冻结协议','/data/protocol-v4.json'),link('实验报告','/downloads/evaluation-v4.md'));content.append(links);
  }
  function renderCertificates(){
    const data=evidence['certificate-v4'];if(!data?.summary){content.append(note('独立核验档案暂未载入。'));return;}
    const s=data.summary;content.append(note(`独立 Python 实现核对 ${s.caseCount} 个静态场景，${s.auditedCandidateCount??'—'} 个完整候选逐箱核验；${s.failedCaseCount} 个场景审计失败。它重新枚举合法作业三元组，用原生 HiGHS 求解，不读取 GLPK 的系数。`));
    content.append(table('独立解与界',['场景','审计','HiGHS 状态','独立主目标 / ₩','下界 / ₩','间隙'],data.cases.map(c=>{const v=c.certificates.joint??{};return [c.id,c.valid?'通过':'失败',v.certificateStatus??v.status,money(v.objectiveCost),money(v.lowerBound),Number.isFinite(v.relativeGap)?(v.relativeGap*100).toFixed(3)+'%':'—'];})));
    content.append(note('这是与主实现分开的内部验证，覆盖声明的日级费用与容量模型；不等于外部机构认证、合同适用性或真实港口收益，也不认证滚动历史的最优性。浮点收费只报告数值容差内的一致性。',true));
    const links=el('div','heading-tools research-links');links.append(link('独立核验 JSON','/data/certificate-v4.json'),link('方法与数值边界','/downloads/certificate-method-v4.md'));content.append(links);
  }
  function renderSubmission(){
    content.append(note('LogisticSolver 2026：材料截止 11 月 6 日 18:00；官方要求报告、全部数据与代码、展示不超过 20 页。评分权重、单人参赛、AI 与语言边界尚未取得当届明确规则。',true));
    const grid=el('div','download-grid');for(const [title,description,path]of [
      ['韩文主展示','从归档实验生成；含失败、模型边界与 AI 贡献。','defense-v4.ko.pdf'],
      ['韩文报告草稿','规则、方法、结果和提交条件，不能代签作者声明。','submission-v4.ko.md'],
      ['中文研究报告','完整对照、滚动执行与独立审计。','report-v4.zh.md'],
      ['英文答辩讲稿','配套讲解与问答，用于理解和准备。','defense-v4.en.md'],
      ['竞赛官方调研','奖级、往届证书、当届要求与未确认事项。','competition-research-v4.md'],
      ['文献与方法路线','已有先例、读取范围和项目贡献。','research-roadmap-v4.md'],
      ['内部红队审阅','数值、因果信息、冻结与公平性检查。','reviewer-v4.md'],
      ['真实贡献记录','开源、AI 自主研发及尚未取得的本人贡献证据。','contribution-log-v4.md'],
    ]){const card=el('article','download-tile');card.append(el('h3','',title),el('p','',description),link('下载','/downloads/'+path));grid.append(card);}content.append(grid);
  }
  Promise.allSettled(['benchmark-v4','rolling-v4','certificate-v4'].map(async key=>{evidence[key]=await fetchEvidenceJson(`/data/${key}.json`);})).then(render);render();
}
