const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;};
const number=value=>Number.isFinite(value)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:2}).format(value):'—';
const methods={stableRetainV5:'V5 稳定保留',lockedRecoveryV6:'V6 执行锁恢复',costPolishV7:'V7 费用修整',adaptiveV8:'V8 自适应决策',highsV8:'原生 HiGHS'};
const names={nominal_infeasible_from_start:'原始名义模型不可行',actual_hindsight_and_observed_prefix_infeasible:'观察前缀与实际全知均不可行',observed_prefix_feasible_online_search_miss:'当时观察下存在完整候选，在线未找到'};
function table(title,headers,rows){const card=el('article','card schedule-section'),head=el('div','card-header');head.append(el('h2','card-title',title));card.append(head);const wrap=el('div','table-wrap'),t=el('table','data-table'),thead=el('thead'),tr=el('tr');headers.forEach(h=>tr.append(el('th','',h)));thead.append(tr);t.append(thead);const body=el('tbody');rows.forEach(row=>{const tr=el('tr');row.forEach(value=>tr.append(el('td','',value??'—')));body.append(tr);});t.append(body);wrap.append(t);card.append(wrap);return card;}
function link(label,path){const a=el('a','button small',label);a.href=path;a.download=path.split('/').pop();return a;}
function notice(text,warning=false){return el('div','notice'+(warning?' warning':''),text);}

export function mountResearchV8UI(container){
  let loading=false;
  const content=el('div'),heading=el('div','page-heading'),text=el('div'),tools=el('div','heading-tools'),refresh=el('button','button','刷新验证状态');
  text.append(el('div','eyebrow','V8 / DECISIONS & INDEPENDENT EVIDENCE'),el('h1','','V8 方法与验证'));text.querySelector('h1').id='research-v8-title';
  text.append(el('p','','初始化、同历史决策和整段执行分别验证；每项结论保留自己的输入、预算和分母。'));
  tools.append(refresh);heading.append(text,tools);container.replaceChildren(heading,content);
  refresh.addEventListener('click',load);
  async function json(path){const r=await fetch(path);if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
  async function load(){
    if(loading)return;loading=true;refresh.disabled=true;content.replaceChildren(notice('正在读取已保存的验证记录…'));
    try{
      const [release,diagnosis]=await Promise.all([json('/data/v8-release.json'),json('/data/failure-diagnosis-v8.json')]);
      content.replaceChildren(notice('公开费率与合成订单的研究原型。原生求解器、内部独立审核和公开资料不等同企业实测收益或第三方认证。',true));
      content.append(notice('当前主路线使用可核验公开资料和可复现实验；企业实单、报价、联系人及试点属于可选增强。以下 V8 原始研究记录保持不变，不以缺少企业资料停止后续研发。'));
      const currentRoute=el('div','heading-tools research-links');for(const [label,path]of [['当前公开证据包','/data/public-evidence-readiness-v11.json'],['公开资料路线说明','/downloads/public-evidence-route-v11.zh.md'],['换电脑恢复开发','/downloads/recovery-guide.zh.md']])currentRoute.append(link(label,path));content.append(currentRoute);
      const status=el('article','card reading-card');status.append(el('h2','','V8 历史交付记录'),el('p','',release.notes));
      status.append(el('p','',`正式留出：${release.formalExperimentComplete?'已完成':'尚未完成'}；独立复核：${release.independentReviewComplete?'已完成':'尚未完成'}；企业验证（可选）：${release.externalBusinessValidation==='completed'?'有明确记录':'未作企业实测收益声明'}；参赛者本人答辩验收：${release.entrantDefenseValidation==='completed'?'有明确记录':'尚未进行'}。`));content.append(status);
      const diagnosisRows=diagnosis.cases.map(c=>[c.id,`D${c.originalOnlineFailure.day}`,names[c.category]??c.category??'见完整诊断',
        c.failureSnapshot?.fixedEvents?Object.values(c.failureSnapshot.fixedEvents).reduce((n,v)=>n+Object.keys(v).length,0):'见证据']);
      content.append(table('旧 V7 九失败：独立离线诊断',['案例','原失败日','分类','原执行锁数'],diagnosisRows));
      content.append(notice('诊断覆盖原始名义、观察＋原历史、全知实际无锁及同锁四层。旧 36 例有六例在实际容量下全知也不可行，当前模型的完成上界为 30/36；全知可行见证仍不保证未知未来的在线完成。额外诊断预算不属于在线成绩。',true));
      const materials=el('div','heading-tools research-links');
      for(const [label,path] of [['V8 实施进度','/downloads/v8-progress.zh.md'],['失败诊断报告','/downloads/failure-diagnosis-v8.md'],['完整诊断证据','/data/failure-diagnosis-v8.json'],['自适应方法','/downloads/adaptive-method-v8.md'],['原生对照方法','/downloads/highs-method-v8.md'],['实验协议','/downloads/experiment-protocol-v8.md']])materials.append(link(label,path));content.append(materials);
      if(release.formalExperimentComplete){
        const report=await json('/data/v8-results.json');
        for(const [panel,s]of Object.entries(report.summary.panels)){
          content.append(table(panel==='same-distribution'?'同生成机制：新留出':'新扰动：压力面板',
            ['方法','完整执行次数 / 运行数','三次均完整的场景','任一次完整的场景','硬截止／历史未知'],
            Object.entries(s.byMethod).map(([method,v])=>[methods[method]??method,`${v.completeEpisodeCount} / ${v.recordedEpisodeCount}`,`${v.fullyCompletedScenarioCount} / ${v.scenarioCount}`,`${v.anyCompletedScenarioCount} / ${v.scenarioCount}`,`${v.hardDeadlineCount} / ${v.executionHistoryUnavailableCount}`])));
          content.append(table('费用与完成取舍：'+panel,['比较','完整次数增／损','配对场景／运行','总两费节省','新增费节省','更低／同／更高（场景）'],
            Object.values(s.comparisons).map(p=>[`${methods[p.candidateMethod]} / ${methods[p.baselineMethod]}`,`${p.completion.gainedEpisodeCount} / ${p.completion.lostEpisodeCount}`,`${p.fees.total.pairedScenarioCount} / ${p.fees.total.pairedEpisodeCount}`,
              p.fees.total.weightedSavingsPct===null?'无有效分母':number(p.fees.total.weightedSavingsPct)+'%',p.fees.incremental.weightedSavingsPct===null?'无有效分母':number(p.fees.incremental.weightedSavingsPct)+'%',
              `${p.fees.total.scenarioWinTieLoss.win} / ${p.fees.total.scenarioWinTieLoss.tie} / ${p.fees.total.scenarioWinTieLoss.loss}`])));
        }
        content.append(notice('每个面板 72 个业务场景，各方法三次预固定运行；216 次运行不是 216 个独立场景。费用仅使用同场景同运行双方完整的配对，再对场景等权。正数为省费，负数为更贵；不同配对分母不能横向排名。完整区间、负例与原始记录见下载材料。',true));
        const files=el('div','heading-tools research-links');for(const [label,path]of [['V8 完整结果索引','/data/v8-results.json'],['V8 研究报告','/downloads/report-v8.zh.md'],['独立结果复核','/downloads/review-v8.md'],['韩文展示','/downloads/defense-v8.ko.pdf'],['韩文参赛报告','/downloads/submission-v8.ko.md']])files.append(link(label,path));content.append(files);
        if(release.materials?.editablePresentation)files.append(link('可编辑韩文 PPT','/downloads/defense-v8.ko.pptx'));
        files.append(link('统计区间独立复核','/data/bootstrap-review-v8.json'));
        content.append(notice('当前下载包保留源码、结果JSON与哈希清单。V8/V9 的22片历史二进制原档不在当前ZIP中；按恢复说明从固定授权Git提交取得，旧Sites版本仅作第二记录。全部历史输入、失败、重复和冻结源码的原SHA保持不变，当前ZIP不含Git历史。'));
        const packages=el('div','heading-tools research-links');for(const [label,path]of [['当前源码与保留证据清单','/data/download-packages-v14.json'],['V8/V9 历史原档恢复说明','/downloads/recovery-v14.zh.md'],['22片历史原档与SHA','/data/historical-transport-policy-v14.json'],['项目源码','/downloads/portplan-source.zip'],['V6 必要实验资料','/downloads/portplan-experiments-v6.zip'],['V7 必要实验资料','/downloads/portplan-experiments-v7.zip'],['公开输入','/downloads/portplan-public-inputs-v6.zip'],['求解器源码','/downloads/portplan-solver-source.zip']])packages.append(link(label,path));content.append(packages);
      }else content.append(notice('新留出尚未全部完成，当前没有 V8 的改善百分比。V7 原始结果仍在“决策与证据 · V7”保留。'));
    }catch(error){content.replaceChildren(notice('验证记录读取失败：'+error.message+'。可刷新重试；没有用预计成绩填充。',true));}
    finally{loading=false;refresh.disabled=false;}
  }
  load();
}
