// V14 is the experiment batch; the evaluated candidate remains guardedHiGHSV13.
export const METHODS_V14=Object.freeze(['costPolishV7','adaptiveV9','highsV8','stableHiGHSV10','commitmentHiGHSV11','seededHiGHSV12','guardedHiGHSV13']);
export const EVIDENCE_PATHS_V14=Object.freeze({results:'/data/v14-results.json',review:'/data/review-v14.json',statistics:'/data/bootstrap-review-v14.json',protocol:'/data/protocol-v14.json'});
export const CANDIDATE_PAIRS_V14=Object.freeze({v13VsV12:'seededHiGHSV12',v13VsV11:'commitmentHiGHSV11',v13VsV10:'stableHiGHSV10',v13VsV9:'adaptiveV9',v13VsHiGHS:'highsV8',v13VsV7:'costPolishV7'});
const SECONDARY_PAIRS={v12VsV11:['commitmentHiGHSV11','seededHiGHSV12'],v12VsV10:['stableHiGHSV10','seededHiGHSV12'],v12VsV9:['adaptiveV9','seededHiGHSV12'],v12VsHiGHS:['highsV8','seededHiGHSV12'],v12VsV7:['costPolishV7','seededHiGHSV12'],v11VsV10:['stableHiGHSV10','commitmentHiGHSV11'],v10VsHiGHS:['highsV8','stableHiGHSV10'],highsVsV7:['costPolishV7','highsV8']};
const LABELS={costPolishV7:'V7 费用修整',adaptiveV9:'V9 及时候选',highsV8:'原生 HiGHS',stableHiGHSV10:'V10 同费保留',commitmentHiGHSV11:'V11 必需仓位选择',seededHiGHSV12:'V12 完整初解与必需仓位',guardedHiGHSV13:'V13 必要仓位保护'};
const PANELS={'same-distribution':'同生成机制 · 新订单种子',stress:'压力扰动 · 新订单种子'};
const HASH=/^[a-f0-9]{64}$/;
const need=(value,message)=>{if(!value)throw new Error(message);};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const integer=(value,max=Infinity)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
const sameKeys=(value,keys)=>value&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
const close=(a,b,tolerance=1e-9)=>a===null&&b===null||finite(a)&&finite(b)&&Math.abs(a-b)<=tolerance;
function sameTree(a,b,tolerance=0){if(finite(a)&&finite(b))return Math.abs(a-b)<=tolerance;if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return a===b;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,i)=>sameTree(value,b[i],tolerance));return sameKeys(a,Object.keys(b))&&Object.keys(a).every(key=>sameTree(a[key],b[key],tolerance));}
function ids(value,label){need(Array.isArray(value)&&value.every(id=>typeof id==='string'&&id.length>0)&&new Set(value).size===value.length,label+'缺失或重复。');}
function sameInterval(a,b,label){need(a===null&&b===null||Array.isArray(a)&&Array.isArray(b)&&a.length===2&&b.length===2&&a.every((v,i)=>finite(v)&&close(v,b[i]))&&a[0]<=a[1],label+'与独立复算不一致。');}

/** Fail-closed publication checks; this is not another physical/statistical audit. */
export function validateResearchV14Evidence(result,review,statistics,protocol,release){
  need(release?.schemaVersion==='portplan-v14-release'&&release.candidateMethod==='guardedHiGHSV13'&&['formalExperimentComplete','independentReviewComplete','independentBootstrapReviewComplete'].every(key=>release[key]===true),'正式结果与两份独立审核尚未全部就绪。');
  need(result?.schemaVersion==='portplan-v14-published-results'&&result.executionState==='complete'&&result.fixture===false,'结果不是已完成的 V14 正式原档摘要。');
  need(result.scenarioCount===144&&result.episodeCount===3024,'正式研究覆盖不完整。');
  need(protocol?.schemaVersion==='portplan-protocol-v14'&&sameTree(protocol.methods,METHODS_V14),'七方法声明不匹配。');
  need(protocol.rollout?.startDay===0&&protocol.rollout.initialization==='natural'&&protocol.rollout.forcedEndpointImports===false&&protocol.rollout.freshBusinessScenarios===144,'本轮不是声明的全新订单自然 D0 验证。');
  need(sameTree(result.protocol,protocol),'公开结果与原始协议不一致。');
  need(protocol.budget?.hardWallMs===5000&&METHODS_V14.every(method=>protocol.callBudgets?.[method]?.timeBudgetMs===200),'200 ms 合作目标或 5 秒完整父时钟声明不一致。');
  need(sameTree(protocol.budget.parentAcceptance,{normalWorkerExitRequired:true,confirmedProcessGroupGoneRequired:true,processGroupVerificationResult:'ESRCH',cleanupWithinHardWallRequired:true,endToEndWithinHardWallRequired:true,timelyFinalAloneIsCompletion:false}),'缺少完整父生命周期声明。');
  for(const [value,schema] of [[review,'portplan-independent-v14-run-review'],[statistics,'portplan-independent-v14-bootstrap-review']])need(value?.schemaVersion===schema&&value.valid===true&&value.fixture===false&&value.readOnly===true&&value.importsJavaScript===false&&value.solverRuns===0,'独立审核未完成、无效或为测试 fixture。');
  need(review.summary?.episodes===3024&&statistics.episodeCount===3024&&statistics.businessScenarioCount===144,'独立审核未覆盖完整首次研究。');
  const index=result.formalIndex?.sha256,frozen=review.frozenManifestSha256;
  need(HASH.test(index??'')&&review.inputIndexSha256===index&&statistics.inputIndexSha256===index,'结果与独立审核没有绑定同一正式索引。');
  need(HASH.test(frozen??'')&&statistics.frozenManifestSha256===frozen&&(!result.frozenManifestSha256||result.frozenManifestSha256===frozen),'冻结源码绑定不一致。');
  need(review.protocolSha256===release.evidence?.protocol?.sha256&&statistics.protocolSha256===release.evidence.protocol.sha256,'审核与原始协议字节没有绑定。');
  need(result.summary?.inferentialState==='complete-scenario-cluster-bootstrap'&&sameKeys(result.summary.panels,Object.keys(PANELS)),'面板或场景聚类区间未完成。');
  const pairs=protocol.analysis?.comparisons;
  const expectedPairs={...Object.fromEntries(Object.entries(CANDIDATE_PAIRS_V14).map(([key,baseline])=>[key,[baseline,'guardedHiGHSV13']])),...SECONDARY_PAIRS};
  need(sameTree(pairs,expectedPairs)&&protocol.analysis.candidateMethod==='guardedHiGHSV13'&&sameTree(protocol.analysis.comparisonGroups?.primary,Object.keys(CANDIDATE_PAIRS_V14))&&sameTree(protocol.analysis.comparisonGroups?.secondary,Object.keys(SECONDARY_PAIRS)),'缺少预声明的六个主配对或八个次配对。');
  const definition=protocol.analysis.defaultGateDefinition;
  need(definition?.candidateMethod==='guardedHiGHSV13'&&definition.completePanelRequired===true&&definition.scenariosPerPanel===72&&definition.repeatsPerScenario===3&&definition.allMethodsPerRepeatRequired===true&&sameTree(definition.comparators,METHODS_V14.slice(0,6))&&definition.maximumMatchingRepeatCompletionLossesPerComparator===0&&definition.allowNetGainsToOffsetLosses===false&&definition.feeOrRevisionConditionInDefaultGate===false,'预声明默认必要门槛不一致。');
  for(const pair of Object.values(pairs))need(Array.isArray(pair)&&pair.length===2&&pair[0]!==pair[1]&&pair.every(method=>METHODS_V14.includes(method)),'协议配对身份无效。');
  for(const panel of Object.keys(PANELS)){
    const p=result.summary.panels[panel],r=review.pointEstimates?.[panel],s=statistics.panels?.[panel];
    need(p?.scenarioCount===72&&r&&s&&sameKeys(p.byMethod,METHODS_V14)&&sameKeys(p.comparisons,Object.keys(pairs)),'面板、方法或配对覆盖不完整。');
    for(const method of METHODS_V14){
      const a=p.byMethod[method],b=r.byMethod?.[method],c=s.byMethod?.[method];
      need(b&&c&&a.recordedEpisodeCount===216&&integer(a.completeEpisodeCount,216),'方法运行覆盖不完整。');
      for(const key of ['recordedEpisodeCount','completeEpisodeCount','fullyCompletedScenarioCount','anyCompletedScenarioCount'])need(a[key]===b[key]&&a[key]===c[key]&&integer(a[key],key.includes('Scenario')?72:216),'完成覆盖与独立复核不一致。');
      need(a.initialization&&sameTree(a.initialization,b.initialization)&&sameTree(a.initialization,c.initialization),'D0 与后续失败尚未分别复核。');
      for(const value of Object.values(a.initialization))need(integer(value,216),'初始化计数无效。');
    }
    for(const [name,[baseline,candidate]]of Object.entries(pairs)){
      const a=p.comparisons[name],b=r.comparisons?.[name],c=s.comparisons?.[name];
      need(b&&c&&a.baselineMethod===baseline&&a.candidateMethod===candidate,'实际配对与预声明不一致。');
      for(const [count,key,independent]of [['lostEpisodeCount','lostEpisodeIds','lostEpisodes'],['gainedEpisodeCount','gainedEpisodeIds','gainedEpisodes']]){ids(a.completion?.[key],'完成变化索引');need(integer(a.completion[count],216)&&a.completion[key].length===a.completion[count]&&a.completion[count]===b[independent],'完成收益或损失未完整保留。');}
      sameInterval(a.completion.uncertainty?.meanScenarioRateGain95CI,c.completionRateGain95CI,'完成区间');
      need(sameTree([a.revisions?.baselineObservedSum,a.revisions?.candidateObservedSum],b.revisions),'改期分子或未知状态与物理复核不一致。');need(integer(a.revisions?.pairedEpisodeCount,216)&&a.revisions.pairedEpisodeCount<=a.fees.total.pairedEpisodeCount&&a.revisions.pairedEpisodeCount<=a.fees.incremental.pairedEpisodeCount,'改期已知匹配条数超出共同完成集合。');
      for(const key of ['total','incremental']){
        const fee=a.fees?.[key],point=b.fees?.[key],boot=c.fees?.[key];need(fee&&point&&boot,'缺少两费配对统计。');
        need(integer(fee.pairedScenarioCount,72)&&integer(fee.pairedEpisodeCount,216)&&fee.pairedScenarioCount===point.pairedScenarios&&fee.pairedEpisodeCount===point.pairedEpisodes&&fee.pairedScenarioCount===boot.pairedScenarioCount&&fee.pairedEpisodeCount===boot.pairedEpisodeCount,'条件费用分母与独立复核不一致。');
        for(const field of ['baselineScenarioMeanSumKRW','candidateScenarioMeanSumKRW'])need(close(fee[field],point[field],1e-5),'费用分子与独立复算不一致。');
        const expected=point.baselineScenarioMeanSumKRW?100*(point.baselineScenarioMeanSumKRW-point.candidateScenarioMeanSumKRW)/point.baselineScenarioMeanSumKRW:null;
        need(close(fee.weightedSavingsPct,expected),'节费率与配对分子不一致。');
        for(const field of ['negativeScenarioIds','negativeEpisodeIds'])ids(fee[field],'费用负例');
        need(sameTree(fee.scenarioWinTieLoss,point.scenarioWinTieLoss)&&fee.negativeScenarioIds.length===point.scenarioWinTieLoss?.loss,'不利场景没有完整保留。');
        sameInterval(fee.uncertainty?.weightedSavingsPct95CI,boot.weightedSavingsPct95CI,'费用区间');
      }
    }
    const gate=p.observedDecisionGates,checked=s.observedDecisionGates,withoutAlias=value=>value&&Object.fromEntries(Object.entries(value).filter(([key])=>key!=='nativeComparison'));
    need(gate?.assessmentState==='complete-panel'&&sameTree(withoutAlias(gate),withoutAlias(checked),1e-9)&&typeof gate.defaultRecommendationEligible==='boolean','观察门槛没有独立复算或面板未完成。');
    need(gate.defaultRecommendationEligible===Object.keys(CANDIDATE_PAIRS_V14).every(name=>p.comparisons[name].completion.lostEpisodeCount===0),'默认必要门槛必须精确反映六个基准的零完成损失。');
    const common=p.jointCompletePareto;
    need(common&&integer(common.jointScenarioCount,72)&&integer(common.jointEpisodeCount,216)&&sameKeys(common.byMethod,METHODS_V14)&&sameTree(common,s.jointCompletePareto,1e-6),'七法共同完成集合与独立复核不一致。');
  }
  return true;
}

export async function readBoundResearchV14(role,reference,{request=globalThis.fetch,crypto=globalThis.crypto}={}){
  need(Object.hasOwn(EVIDENCE_PATHS_V14,role)&&reference?.path===EVIDENCE_PATHS_V14[role]&&HASH.test(reference.sha256??''),'正式证据缺少允许的站内路径或原始 SHA。');
  need(crypto?.subtle,'浏览器无法执行原始字节 SHA-256 校验。');
  const response=await request(reference.path);need(response.ok,'正式证据读取失败：'+reference.path);
  const bytes=await response.arrayBuffer(),actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');
  need(actual===reference.sha256,'正式证据原始字节 SHA 不一致：'+reference.path);
  if(reference.bytes!==undefined)need(reference.bytes===bytes.byteLength,'正式证据字节数不一致。');
  return JSON.parse(new TextDecoder().decode(bytes));
}

const node=(tag,cls,text)=>{const element=document.createElement(tag);if(cls)element.className=cls;if(text!==undefined)element.textContent=String(text);return element;};
const number=value=>finite(value)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:4}).format(value):'null';
const percentage=value=>finite(value)?number(value)+'%':'null';
const interval=value=>Array.isArray(value)?'['+value.map(String).join(', ')+']':'null';
const notice=(text,warning=false)=>node('div','notice'+(warning?' warning':''),text);
function link(text,path,download=false){const a=node('a','button small',text);a.href=path;if(download)a.download=path.split('/').pop();return a;}
function table(title,headers,rows){const article=node('article','card reading-card'),wrap=node('div','table-wrap'),t=node('table','data-table'),head=node('thead'),h=node('tr'),body=node('tbody');for(const value of headers)h.append(node('th','',value));head.append(h);for(const row of rows){const tr=node('tr');for(const value of row)tr.append(node('td','',value??'null'));body.append(tr);}t.append(head,body);wrap.append(t);article.append(node('h2','card-title',title),wrap);return article;}
function adverse(panel){return Object.fromEntries(Object.entries(panel.comparisons).map(([key,p])=>[key,{completionLosses:p.completion.lostEpisodeIds,completionGains:p.completion.gainedEpisodeIds,totalFeeNegativeScenarios:p.fees.total.negativeScenarioIds,totalFeeNegativeEpisodes:p.fees.total.negativeEpisodeIds,incrementalFeeNegativeScenarios:p.fees.incremental.negativeScenarioIds,incrementalFeeNegativeEpisodes:p.fees.incremental.negativeEpisodeIds}]));}

export function mountResearchV14UI(container,{request=globalThis.fetch,crypto=globalThis.crypto}={}){
  const heading=node('div','page-heading'),title=node('div'),content=node('div'),refresh=node('button','button','刷新已保存证据');refresh.type='button';
  const h1=node('h1','','从第一天自然执行，检验 V13 必要仓位保护');h1.id='research-v14-title';
  title.append(node('div','eyebrow','V14 / NATURAL D0 STUDY OF GUARDED V13'),h1,node('p','','V14 是本次验证批次，候选方法仍为 guardedHiGHSV13。全部方法从 D0 自然初始化，不导入强制端点。'));heading.append(title,refresh);
  const scope=node('article','card reading-card');scope.append(node('p','','公开资料、标准费率与明确标记的合成已知订单研究；企业资料和联系人是可选增强。网页展示离线原生研究记录，不在浏览器运行原生 V13。'),node('p','','每次调用 200 ms 为合作式目标。冷 episode 的完整 5 秒包括父层终态审核、正常退出和进程组清理确认；及时 final 不是完成。必要仓位仅是当前观察下的必要下界，不预知未公布未来。'));
  const history=node('div','heading-tools research-links');history.append(link('V12 首发及 V13 开发历史','/#research-v12'),link('来源与复现','/#sources'),link('当前分包与历史恢复','/downloads/recovery-v14.zh.md'),link('当前全部源码分包','/data/download-packages-v14.json',true),link('本轮状态原文','/data/v14-release.json',true));
  container.replaceChildren(heading,scope,content,history);let busy=false,destroyed=false,generation=0;
  async function load(){if(busy||destroyed)return;busy=true;refresh.disabled=true;const token=++generation;content.replaceChildren(notice('正式结果、物理审核、统计审核与原始 SHA 尚待全部核对；不显示预计成绩。'));
    try{
      const response=await request('/data/v14-release.json');need(response.ok,'正式状态尚未提供。');const release=await response.json();
      need(['formalExperimentComplete','independentReviewComplete','independentBootstrapReviewComplete'].every(key=>release[key]===true),'正式结果与双独立审核尚未全部完成。');
      const docs=await Promise.all(Object.keys(EVIDENCE_PATHS_V14).map(role=>readBoundResearchV14(role,release.evidence?.[role],{request,crypto})));
      const [result,review,statistics,protocol]=docs;validateResearchV14Evidence(result,review,statistics,protocol,release);if(destroyed||token!==generation)return;
      const rendered=node('div');rendered.dataset.v14Ready='true';rendered.append(notice('原始结果及两份独立审核已绑定同一首次研究：144 个业务场景 × 3 次固定时序重复 × 7 方法 = 3,024 个 episode。重复不是额外独立业务样本。'));
      for(const [key,label]of Object.entries(PANELS)){
        const panel=result.summary.panels[key],section=node('section');section.dataset.v14Panel=key;
        section.append(table(label,['方法','完整 / 216','D0 初始接受','已知 D0 失败','已知后续失败','D0 历史未知'],METHODS_V14.map(method=>{const p=panel.byMethod[method],i=p.initialization;return [LABELS[method],p.completeEpisodeCount,i.acceptedInitialPlanCount,i.knownInitialFailureCount,i.knownLaterFailureCount,i.unknownDayZeroCount];})));
        section.append(table('V13 与各基准 · '+label,['基准','完成增 / 损','总两费共同场景 / 重复','总两费节省 · 条件 95% CI','新增两费共同场景 / 重复','新增两费节省 · 条件 95% CI','改期 · 已知配对 / 基准 → V13'],Object.keys(CANDIDATE_PAIRS_V14).map(name=>{const p=panel.comparisons[name],a=p.fees.total,b=p.fees.incremental;return [LABELS[p.baselineMethod],p.completion.gainedEpisodeCount+' / '+p.completion.lostEpisodeCount,a.pairedScenarioCount+' / '+a.pairedEpisodeCount,percentage(a.weightedSavingsPct)+' · '+interval(a.uncertainty.weightedSavingsPct95CI),b.pairedScenarioCount+' / '+b.pairedEpisodeCount,percentage(b.weightedSavingsPct)+' · '+interval(b.uncertainty.weightedSavingsPct95CI),number(p.revisions.pairedEpisodeCount)+' 对 / '+number(p.revisions.baselineObservedSum)+' → '+number(p.revisions.candidateObservedSum)];})));
        const gate=node('article','card reading-card'),passed=panel.observedDecisionGates.defaultRecommendationEligible;gate.dataset.v14Gate=passed?'passed':'failed';gate.append(node('h2','card-title',label+' · 默认替换必要门槛：'+(passed?'通过':'未通过')),notice('按预声明全样本逐一检查六个基准的完成损失，净收益、条件节费与 Pareto 位置不能抵消损失。观察门槛通过也不自动证明现实部署适用或保证名次。',!passed));section.append(gate);
        const details=node('details','card reading-card'),pre=node('pre','',JSON.stringify(adverse(panel),null,2));details.dataset.v14Adverse='true';pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';pre.style.maxHeight='420px';pre.style.overflow='auto';details.append(node('summary','','全部完成收益、损失与两费负例 · '+label),pre);section.append(details);
        const common=panel.jointCompletePareto;section.append(table('七法共同完成集合 · '+common.jointScenarioCount+' 场景 / '+common.jointEpisodeCount+' 匹配重复',['方法','场景均值总两费之和 / KRW','场景均值新增两费之和 / KRW','场景均值改期之和'],METHODS_V14.map(method=>{const p=common.byMethod[method];return [LABELS[method],number(p.scenarioMeanTotalCostSumKRW),number(p.scenarioMeanIncrementalCostSumKRW),number(p.scenarioMeanRevisionCountSum)];})));
        rendered.append(section);
      }
      rendered.append(notice('费用仅在同场景、同重复双方完整执行的集合先场景内平均、再场景等权。配对改期另列已知匹配条数及原始事件总数；七法共同 Pareto 集的改期轴才使用场景均值等权。条件区间不能消除完成选择偏差；跨零不证明稳定节费，负节费与最坏损失保留。95% 区间为未做多重比较校正的单项描述区间，不证明同时优于全部基准。失败完整金额为 null。七法共同集合另有分母，不合并面板或混成排名。',true));
      const downloads=node('div','heading-tools research-links');for(const [role,text]of [['results','正式结果与全部负例'],['review','独立物理审核'],['statistics','独立统计与区间审核'],['protocol','预声明协议']])downloads.append(link(text,EVIDENCE_PATHS_V14[role],true));rendered.append(downloads);const materials=node('div','heading-tools research-links');for(const [label,path]of [['中文完整报告','/downloads/report-v14.zh.md'],['韩文报告','/downloads/submission-v14.ko.md'],['韩文 PDF','/downloads/defense-v14.ko.pdf'],['可编辑韩文 PPT','/downloads/defense-v14.ko.pptx'],['材料字节与渲染审核','/data/material-review-v14.json']])materials.append(link(label,path,true));rendered.append(materials);content.replaceChildren(rendered);
    }catch(error){if(!destroyed&&token===generation){const pending=notice('V14 正式证据尚未通过完整检查：'+error.message+' 不显示任何预计成绩；旧 V12/V13 历史可独立查看。',true);pending.dataset.v14Pending='true';content.replaceChildren(pending);}}
    finally{if(!destroyed&&token===generation){busy=false;refresh.disabled=false;}}
  }
  refresh.addEventListener('click',load);const ready=load();return {ready,refresh:load,destroy(){destroyed=true;generation++;container.replaceChildren();}};
}
