// Read-only delivery-development evidence. No optimizer runs in this view.
export const METHODS_V15=Object.freeze(['seededHiGHSV12','guardedHiGHSV13','timelyHiGHSV15']);
export const EVIDENCE_PATHS_V15=Object.freeze({results:'/data/delivery-v15-first-index.json',review:'/data/review-delivery-v15.json',protocol:'/data/protocol-development-v15.json'});
export const CASE_DAYS_V15=Object.freeze([
  Object.freeze({caseId:'v14-stress-aged-backlog-balanced-n50-r2',interventionDay:6}),
  Object.freeze({caseId:'v14-stress-new-arrivals-tight-n100-r3',interventionDay:6}),
  Object.freeze({caseId:'v14-stress-new-arrivals-tight-n100-r4',interventionDay:3}),
  Object.freeze({caseId:'v14-stress-new-arrivals-tight-n50-r1',interventionDay:7}),
]);
const LABELS={seededHiGHSV12:'V12 · 经济主干',guardedHiGHSV13:'V13 · 严格 M 负控',timelyHiGHSV15:'V15 · 提前返回目标'};
const HASH=/^[a-f0-9]{64}$/,COMMIT=/^[a-f0-9]{40}$/;
const need=(condition,message)=>{if(!condition)throw new Error(message);};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
const count=(value,max=Infinity)=>Number.isSafeInteger(value)&&value>=0&&value<=max;
const sameKeys=(value,keys)=>value&&typeof value==='object'&&Object.keys(value).sort().join('|')===[...keys].sort().join('|');
function sameTree(a,b){if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return a===b;if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((value,i)=>sameTree(value,b[i]));return sameKeys(a,Object.keys(b))&&Object.keys(a).every(key=>sameTree(a[key],b[key]));}
const endpoints=()=>CASE_DAYS_V15.flatMap(c=>[1,2,3].map(repeatIndex=>({...c,repeatIndex,endpointId:c.caseId+'::repeat-'+repeatIndex,algorithmSeed:[79011,79023,79039][repeatIndex-1]})));
function completeReceipt(receipt){
  return Boolean(receipt?.complete===true&&receipt.auditValid===true&&['feasible','optimal'].includes(receipt.status)&&receipt.scalarReceipt===true&&receipt.terminalRowCount>0&&receipt.artifact?.path&&finite(receipt.totalCost)&&finite(receipt.incrementalCost)
    &&['terminalReceiptAcceptedAsHistory','endToEndCompletedWithinBudget','episodeCompletedWithinBudget','outputDeliveredWithinBudget','terminalReceiptWithinBudget','normalWorkerExit'].every(key=>receipt[key]===true)
    &&receipt.deadlineReached===false&&receipt.exitCode===0&&receipt.exitSignal===null&&receipt.hardWallMs===5000
    &&receipt.processGroupCleanup?.successful===true&&receipt.processGroupCleanup.verifiedProcessGroupGone===true&&receipt.processGroupCleanup.verificationResult==='ESRCH'
    &&[receipt.wallTimeMs,receipt.endToEndWallTimeMs,receipt.receiptValidatedMs,receipt.processGroupCleanup.finishedAtMs].every(value=>finite(value)&&value>=0&&value<=5000));
}
const outcome=row=>({jobId:row.jobId,endpointId:row.endpointId,caseId:row.caseId,repeatIndex:row.repeatIndex,interventionDay:row.interventionDay,status:row.receipt.status,complete:completeReceipt(row.receipt),failureDay:row.receipt.failure?.day??null,totalCost:row.receipt.totalCost,incrementalCost:row.receipt.incrementalCost,revisionCount:row.receipt.revisionCount});

/** Publication consistency checks, not a replacement for independent physics review. */
export function validateResearchV15Evidence(result,review,protocol,release){
  need(release?.schemaVersion==='portplan-v15-development-release'&&release.candidateMethod==='timelyHiGHSV15'&&release.developmentExperimentComplete===true&&release.independentReviewComplete===true,'开发首跑与独立审核尚未全部就绪。');
  need(release.fullChampionshipPlanComplete===false&&release.defaultRecommendationEligible===false&&release.formalExperiment===false&&release.latestFormalStudy==='v14','开发结果不能标记为新正式研究、默认通过或完整冲冠计划完成。');
  need(result?.schemaVersion==='portplan-v15-cold-cache-delivery-results'&&result.executionState==='complete'&&result.fixture!==true,'尚非完整的首次受控开发索引。');
  need(review?.schemaVersion==='portplan-independent-delivery-review-v15'&&review.valid===true&&review.readOnly===true&&review.importsJavaScript===false&&review.solverRuns===0&&review.fixture!==true,'独立只读审核无效或为测试夹具。');
  need(protocol?.schemaVersion==='portplan-v15-seen-cold-cache-delivery-development-protocol'&&protocol.dataRole==='seen-synthetic-controlled-cold-cache-development'&&sameTree(protocol.methods,METHODS_V15)&&sameTree(protocol.caseDays,CASE_DAYS_V15),'方法或全部四个已见场景声明不一致。');
  need(protocol.uniqueBusinessScenarioCount===4&&protocol.archivedEndpointCount===12&&protocol.branchRunCount===36&&protocol.prefixSourceMethod==='guardedHiGHSV13'&&protocol.historicalCacheImported===false,'受控前缀或开发覆盖声明不一致。');
  for(const key of ['newHeldOutExperiments','newOrderGeneration','newAlgorithmSeeds'])need(protocol[key]===0,'开发声明不得生成新订单、种子或留出实验。');
  for(const value of [protocol,result,result.summary,review.summary])need(value?.ciComputed===false&&value.newHeldOutExperiments===0&&value.historicalCacheImported===false,'不得把已见端点回放扩成新样本、历史缓存或置信区间。');
  need(result.newGeneratedSeeds===0&&sameTree(result.sourceConsistency,{before:true,after:true}),'缺少冻结源码前后原字节检查。');
  need(protocol.budget?.dailyBudgetMs===200&&protocol.budget.parentHardWallMs===5000&&protocol.budget.nativeThreads===1&&protocol.budget.nativeRandomSeed===0,'预算或原生线程、随机种子声明不一致。');
  const parent={normalWorkerExitRequired:true,confirmedProcessGroupGoneRequired:true,processGroupVerificationResult:'ESRCH',cleanupWithinHardWallRequired:true,endToEndWithinHardWallRequired:true,timelyFinalAloneIsCompletion:false};
  need(sameTree(protocol.budget.parentAcceptance,parent),'缺少完整冷父进程生命周期声明。');
  for(const method of METHODS_V15){const b=protocol.callBudgets?.[method];need(b?.timeBudgetMs===200&&b.timeLimitSeconds===.2&&b.auditReserveMs===2&&b.constructorBudgetMs===40&&b.constructorAuditReserveMs===5&&b.maxRestarts===3&&b.retainCacheFallback===true,'某方法调用预算或 V12 初解行为发生变化。');need(method==='timelyHiGHSV15'?b.nativeReturnReserveMs===10:!Object.hasOwn(b,'nativeReturnReserveMs'),'10ms 预留未固定或污染负控。');}
  const change=protocol.candidateChange;need(change?.method==='timelyHiGHSV15'&&change.nativeReturnReserveMs===10&&change.wholeCallMs===200&&change.nativeTargetMs===190&&change.serviceAuditReserveMs===2,'190ms 返回目标须位于原 200ms 完整接纳预算内。');
  need(sameTree(protocol.analysis?.primaryComparison,['seededHiGHSV12','timelyHiGHSV15'])&&sameTree(protocol.analysis?.negativeControl,['guardedHiGHSV13','timelyHiGHSV15']),'主对照或负控身份不一致。');
  need(COMMIT.test(result.sourceCommit??'')&&review.sourceCommit===result.sourceCommit&&(!release.sourceCommit||release.sourceCommit===result.sourceCommit),'开发与审核未绑定同一冻结源码提交。');
  need(HASH.test(result.declarationSha256??'')&&review.declarationSha256===result.declarationSha256,'开发与审核未绑定同一原始声明。');
  need(review.inputIndexSha256===release.evidence?.results?.sha256&&HASH.test(review.inputIndexSha256??''),'审核没有绑定原始索引字节。');
  need(result.protocolSha256===release.evidence?.protocol?.sha256&&review.protocolSha256===result.protocolSha256&&HASH.test(result.protocolSha256??''),'审核、索引与协议原始字节没有绑定。');
  need(HASH.test(review.implementationSha256??'')&&review.implementationSha256===result.implementationHashes?.['scripts/review-delivery-v15.py'],'独立审核未绑定首次运行前冻结的审核器源码。');
  need(sameTree(result.sourceBindings,protocol.sourceBindings)&&result.implementationHashes?.['data/protocol-development-v15.json']===result.protocolSha256,'原始输入与冻结协议绑定不一致。');
  const expected=endpoints(),defined=protocol.endpoints;need(Array.isArray(defined)&&defined.length===12&&new Set(defined.map(row=>row.endpointId)).size===12,'十二个原始重复端点缺失或重复。');
  for(const endpoint of expected){const actual=defined.find(row=>row.endpointId===endpoint.endpointId);need(actual&&Object.entries(endpoint).every(([key,value])=>actual[key]===value),'原始重复端点、干预日或算法种子变化。');}
  need(Array.isArray(result.records)&&result.records.length===36&&Array.isArray(protocol.jobs)&&protocol.jobs.length===36&&new Set(result.records.map(row=>row.jobId)).size===36,'全部 36 个首次分支必须保留。');
  need(Array.isArray(review.episodes)&&review.episodes.length===36&&new Set(review.episodes.map(row=>row.jobId)).size===36&&review.coverage?.episodes===36,'独立审核没有覆盖全部 36 个分支。');
  const byEndpoint=new Map(),artifacts=new Set();let completed=0,unknown=0;
  for(let index=0;index<36;index++){
    const row=result.records[index],job=protocol.jobs[index],endpoint=expected.find(e=>e.endpointId===row.endpointId),r=row.receipt,checked=review.episodes.find(e=>e.jobId===row.jobId);
    need(endpoint&&METHODS_V15.includes(row.method)&&Object.entries(job).every(([key,value])=>row[key]===value)&&Object.entries(endpoint).every(([key,value])=>row[key]===value),'分支顺序、端点身份、方法或干预日与协议不符。');
    const identity=row.endpointId+'|'+row.method;need(!byEndpoint.has(identity),'同一端点方法重复，不能补跑覆盖首跑。');byEndpoint.set(identity,row);
    need(typeof row.artifact?.path==='string'&&HASH.test(row.artifact.sha256??'')&&!artifacts.has(row.artifact.path)&&sameTree(r?.artifact,row.artifact),'原始分支证据缺失、复用或收据未绑定。');artifacts.add(row.artifact.path);
    need(checked?.artifactSha256===row.artifact.sha256&&checked.complete===r.complete&&checked.historyAvailable===!r.executionHistoryUnavailable,'独立审核与原始分支身份、完成或未知历史状态不一致。');
    need(typeof r.complete==='boolean'&&typeof r.executionHistoryUnavailable==='boolean'&&typeof r.status==='string'&&r.policy===row.method,'终态状态或真实方法缺失。');
    need(r.complete===completeReceipt(r),'完整结果必须同时通过全模型审核、正常退出、进程组消失及 5 秒父接纳。');
    if(r.complete){completed++;need(r.revisionCount===null||count(r.revisionCount),'完整改期计数无效。');}
    else for(const field of ['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost','lateCount'])need(r[field]===null,'失败完整金额必须为 null，不得写成零或残缺费用。');
    unknown+=Number(r.executionHistoryUnavailable);need(r.failure?.day===undefined||count(r.failure.day,13),'失败日无效。');
  }
  need(review.coverage.completeEpisodes===completed&&review.coverage.historyUnavailable===unknown,'完成或未知历史总数与独立审核不一致。');
  const summary=result.summary;need(summary?.runCount===36&&summary.uniqueBusinessScenarioCount===4&&summary.archivedEndpointCount===12&&sameKeys(summary.byMethod,METHODS_V15)&&sameTree(summary,review.summary),'原始索引与独立审核摘要不一致。');
  for(const method of METHODS_V15){const rows=result.records.filter(row=>row.method===method),m=summary.byMethod[method];need(rows.length===12&&m.runCount===12&&m.completeWithinBudgetCount===rows.filter(row=>completeReceipt(row.receipt)).length&&m.unknownHistoryCount===rows.filter(row=>row.receipt.executionHistoryUnavailable).length&&sameTree(m.outcomes,rows.map(outcome)),'方法完成数、终态费用或全部失败被更改。');}
  need(Array.isArray(summary.comparisons)&&summary.comparisons.length===2,'两项全部端点配对不可省略。');
  for(let index=0;index<2;index++){
    const pair=summary.comparisons[index],baseline=METHODS_V15[index];need(pair.baselineMethod===baseline&&pair.candidateMethod==='timelyHiGHSV15'&&pair.endpointPairCount===12&&Array.isArray(pair.pairs)&&pair.pairs.length===12,'配对身份或分母错误。');
    const calculated=expected.map(endpoint=>{const b=byEndpoint.get(endpoint.endpointId+'|'+baseline).receipt,a=byEndpoint.get(endpoint.endpointId+'|timelyHiGHSV15').receipt,joint=b.complete&&a.complete;return {endpointId:endpoint.endpointId,caseId:endpoint.caseId,repeatIndex:endpoint.repeatIndex,baselineComplete:b.complete,candidateComplete:a.complete,jointlyCompleted:joint,totalBaselineMinusCandidateKRW:joint?b.totalCost-a.totalCost:null,incrementalBaselineMinusCandidateKRW:joint?b.incrementalCost-a.incrementalCost:null,revisionBaselineMinusCandidate:joint&&finite(b.revisionCount)&&finite(a.revisionCount)?b.revisionCount-a.revisionCount:null};});
    need(sameTree(pair.pairs,calculated)&&pair.jointlyCompletedEndpointPairCount===calculated.filter(p=>p.jointlyCompleted).length&&pair.gained===calculated.filter(p=>!p.baselineComplete&&p.candidateComplete).length&&pair.lost===calculated.filter(p=>p.baselineComplete&&!p.candidateComplete).length,'全部 24 对端点的完成增损、共同分母、负费用差或 null 被改写。');
  }
  return true;
}

export async function readBoundResearchV15(role,reference,{request=globalThis.fetch,crypto=globalThis.crypto}={}){
  need(Object.hasOwn(EVIDENCE_PATHS_V15,role)&&reference?.path===EVIDENCE_PATHS_V15[role]&&HASH.test(reference.sha256??'')&&count(reference.bytes)&&reference.bytes>0,'开发证据缺少允许的站内路径、字节数或原始 SHA。');
  need(crypto?.subtle,'浏览器无法执行原始字节 SHA-256 校验。');const response=await request(reference.path);need(response.ok,'开发证据读取失败：'+reference.path);
  const bytes=await response.arrayBuffer();need(reference.bytes===bytes.byteLength,'开发证据字节数不一致。');
  const actual=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');need(actual===reference.sha256,'开发证据原始字节 SHA 不一致：'+reference.path);
  return JSON.parse(new TextDecoder().decode(bytes));
}

const node=(tag,cls,text)=>{const element=document.createElement(tag);if(cls)element.className=cls;if(text!==undefined)element.textContent=String(text);return element;};
const number=value=>finite(value)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:4}).format(value):'null';
const notice=(text,warning=false)=>node('div','notice'+(warning?' warning':''),text);
function link(text,path,download=false){const element=node('a','button small',text);element.href=path;if(download)element.download=path.split('/').pop();return element;}
function table(title,headers,rows){const article=node('article','card reading-card'),wrap=node('div','table-wrap'),t=node('table','data-table'),head=node('thead'),h=node('tr'),body=node('tbody');for(const value of headers)h.append(node('th','',value));head.append(h);for(const row of rows){const tr=node('tr');for(const value of row)tr.append(node('td','',value??'null'));body.append(tr);}t.append(head,body);wrap.append(t);article.append(node('h2','card-title',title),wrap);return article;}
function details(label,value,key){const element=node('details','card reading-card'),pre=node('pre','',JSON.stringify(value,null,2));if(key)element.dataset[key]='true';pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';pre.style.maxHeight='420px';pre.style.overflow='auto';element.append(node('summary','',label),pre);return element;}
function endpointLabel(row){return row.caseId.replace('v14-stress-','')+' / 重复 '+row.repeatIndex;}
function resultLabel(row){return (row.complete?'完整':row.status==='unknown'?'未知':'失败')+(row.failureDay===null?'':' D'+row.failureDay)+' · '+row.status+'\n总两费 '+number(row.totalCost)+' / 新增 '+number(row.incrementalCost)+' KRW';}

export function mountResearchV15UI(container,{request=globalThis.fetch,crypto=globalThis.crypto}={}){
  const heading=node('div','page-heading'),title=node('div'),content=node('div'),refresh=node('button','button','刷新已保存证据');refresh.type='button';
  const h1=node('h1','','给完整候选留出原预算内的交付时间');h1.id='research-v15-title';title.append(node('div','eyebrow','V15 / SEEN-ENDPOINT DELIVERY DEVELOPMENT'),h1,node('p','','基于已见 V14 损失端点的冷缓存受控开发；最新正式研究仍是 V14。'));heading.append(title,refresh);
  const scope=node('article','card reading-card');scope.append(node('p','','唯一候选改动：V12 经济接受主干内固定预留 10ms，原生返回目标 190ms，完整审计与原子接纳仍须落在原 200ms 内。190ms 与 200ms 都是合作式时钟目标，不能称硬时限保证；完整 episode 仍受 5 秒冷父时钟审核。'),node('p','','全部四个已见合成业务场景、各自原三次重复前缀与 V12/V13/V15 三方法，共 12 个端点、36 个分支。先重放原 V13 物理前缀，各方法均不导入历史私有缓存，再从固定干预日自然续跑。这不是自然 D0 历史重现，不增加独立业务样本，不给出新留出置信区间。'),node('p','','公开资料与明确标注的合成实验路线继续推进；企业业务资料与联系人是可选增强。网站和已发布材料可匿名读取。网页仅核验已保存字节，不运行原生求解器。'));
  const history=node('div','heading-tools research-links');for(const [label,path,download]of [['V14 最新正式研究','/#research-v14'],['V15 方法说明','/downloads/method-v15.md',true],['本轮完整开发报告','/downloads/v15-development-results.zh.md',true],['当前源码与恢复','/downloads/recovery-v15.zh.md'],['全部源码分包清单','/data/download-packages-v15.json',true],['公开范围说明','/downloads/public-access-v15.zh.md',true],['本轮发布状态','/data/v15-development-release.json',true]])history.append(link(label,path,download));
  container.replaceChildren(heading,scope,content,history);let busy=false,destroyed=false,generation=0;
  async function load(){if(busy||destroyed)return;busy=true;refresh.disabled=true;const token=++generation;content.replaceChildren(notice('开发首跑、独立只读审核及原始 SHA 尚待全部核对；不显示预计成绩。'));
    try{
      const response=await request('/data/v15-development-release.json');need(response.ok,'开发状态尚未提供。');const release=await response.json();need(release.developmentExperimentComplete===true&&release.independentReviewComplete===true,'完整首跑与独立审核尚未全部完成。');
      const [result,review,protocol]=await Promise.all(Object.keys(EVIDENCE_PATHS_V15).map(role=>readBoundResearchV15(role,release.evidence?.[role],{request,crypto})));validateResearchV15Evidence(result,review,protocol,release);if(destroyed||token!==generation)return;
      const rendered=node('div');rendered.dataset.v15Ready='true';rendered.append(notice('首次开发记录与独立审核原字节已核对：4 个已见业务场景 × 3 次原重复 × 3 方法 = 36 个分支。最新正式研究为 V14；本轮开发已完成不等于完整冲冠计划完成，也不等于默认推荐通过。',true));
      if(result.summary.comparisons.every(pair=>pair.gained===0&&pair.lost===0))rendered.append(notice('两个对照的完成新增与损失均为 0：本轮未观察到完成率提升。共同完成端点上的费用即使相同，也不证明稳定优越。',true));
      rendered.append(table('全部首次分支 · 同一 12 个端点',['方法 ID','完整 / 12','失败或未完整 / 12','历史未知 / 12'],METHODS_V15.map(method=>{const m=result.summary.byMethod[method];return [LABELS[method]+' · '+method,m.completeWithinBudgetCount,12-m.completeWithinBudgetCount,m.unknownHistoryCount];})));
      rendered.append(table('全部 12 个重复端点 · 失败费用保留 null',['已见场景 / 原重复','冷缓存干预日',...METHODS_V15.map(method=>LABELS[method])],endpoints().map(endpoint=>[endpointLabel(endpoint),'D'+endpoint.interventionDay,...METHODS_V15.map(method=>resultLabel(result.summary.byMethod[method].outcomes.find(row=>row.endpointId===endpoint.endpointId)))])));
      rendered.append(table('V15 与两基准 · 各自匹配的 12 个端点',['基准','完成新增','完成损失','共同完整端点 / 12'],result.summary.comparisons.map(pair=>[LABELS[pair.baselineMethod],pair.gained,pair.lost,pair.jointlyCompletedEndpointPairCount])));
      const pairs=result.summary.comparisons.map(pair=>({baselineMethod:pair.baselineMethod,candidateMethod:pair.candidateMethod,endpointPairCount:pair.endpointPairCount,jointlyCompletedEndpointPairCount:pair.jointlyCompletedEndpointPairCount,gained:pair.gained,lost:pair.lost,pairs:pair.pairs}));rendered.append(details('全部 24 对：完成增损、两费差、改期差与所有负例',pairs,'v15Adverse'));
      rendered.append(notice('费用差定义为“基准 − V15”：负值表示 V15 更贵。仅双方完整的同端点、同重复配对有金额或改期差，其他均为 null；不把失败写成零费用，不混用两项对照的共同分母。重复只反映既定输入上的时钟与算法差异。最新正式 V14 的默认替换门槛未通过；V15 尚未进行新的自然 D0 正式验证。不推断新场景胜出、企业收益或比赛名次。',true));
      const callDetails=review.episodes.map(row=>({jobId:row.jobId,complete:row.complete,historyAvailable:row.historyAvailable,actualDecisionCalls:row.actualDecisionCalls,actualNativeRequests:row.actualNativeRequests,cooperativeCallOverruns:row.cooperativeCallOverruns??null,firstLiveCall:row.firstLiveCall??null,deliveryBudget:row.deliveryBudget??null,parentLifecycle:row.parentLifecycle}));rendered.append(details('逐分支首次实际调用、超时与完整父生命周期',callDetails,'v15Calls'));
      const downloads=node('div','heading-tools research-links');for(const [role,label]of [['results','原始首次索引'],['review','独立只读审核'],['protocol','冻结开发协议']])downloads.append(link(label,EVIDENCE_PATHS_V15[role],true));rendered.append(downloads);content.replaceChildren(rendered);
    }catch(error){if(!destroyed&&token===generation){const pending=notice('V15 开发证据尚未通过完整检查：'+error.message+' 不显示任何预计成绩；V14 正式研究可独立查看。',true);pending.dataset.v15Pending='true';content.replaceChildren(pending);}}
    finally{if(!destroyed&&token===generation){busy=false;refresh.disabled=false;}}
  }
  refresh.addEventListener('click',load);const ready=load();return {ready,refresh:load,destroy(){destroyed=true;generation++;container.replaceChildren();}};
}
