import {mountResearchV10UI} from './research-v10-ui.js';
import {renderContinuationV13} from './continuation-v13-ui.js';

export const METHODS_V12=Object.freeze(['costPolishV7','adaptiveV9','highsV8','stableHiGHSV10','commitmentHiGHSV11','seededHiGHSV12']);
const LABELS={costPolishV7:'V7 费用修整',adaptiveV9:'V9 及时候选',highsV8:'原生 HiGHS',stableHiGHSV10:'V10 同费保留',commitmentHiGHSV11:'V11 必需仓位选择',seededHiGHSV12:'V12 完整初解 + 必需仓位'};
const PAIRS={v12VsV11:['commitmentHiGHSV11','seededHiGHSV12'],v12VsV10:['stableHiGHSV10','seededHiGHSV12'],v12VsV9:['adaptiveV9','seededHiGHSV12'],v12VsHiGHS:['highsV8','seededHiGHSV12'],v12VsV7:['costPolishV7','seededHiGHSV12'],v11VsV10:['stableHiGHSV10','commitmentHiGHSV11'],v10VsHiGHS:['highsV8','stableHiGHSV10'],highsVsV7:['costPolishV7','highsV8']};
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
const number=value=>Number.isFinite(value)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:3}).format(value):'null';
const percent=value=>Number.isFinite(value)?number(value)+'%':'null';
const interval=value=>Array.isArray(value)?'['+value.map(v=>Number.isFinite(v)?String(v):'null').join(', ')+']':'null';
const notice=(text,warning=false)=>node('div','notice'+(warning?' warning':''),text);
function link(label,path){const a=node('a','button small',label);a.href=path;a.download=path.split('/').pop();return a;}
function links(entries){const wrap=node('div','heading-tools research-links');for(const [label,path]of entries)wrap.append(link(label,path));return wrap;}
function table(title,headers,rows){const card=node('article','card schedule-section'),head=node('div','card-header'),wrap=node('div','table-wrap'),t=node('table','data-table'),thead=node('thead'),tr=node('tr'),tbody=node('tbody');head.append(node('h2','card-title',title));for(const value of headers)tr.append(node('th','',value));thead.append(tr);for(const values of rows){const r=node('tr');for(const value of values)r.append(node('td','',value??'null'));tbody.append(r);}t.append(thead,tbody);wrap.append(t);card.append(head,wrap);return card;}
function raw(title,value){const details=node('details','card reading-card'),pre=node('pre','',JSON.stringify(value,null,2));pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';pre.style.maxHeight='380px';pre.style.overflow='auto';details.append(node('summary','',title),pre);return details;}

export function validateResearchV12Packages(manifest){
  if(manifest?.schemaVersion!=='portplan-v12-download-packages'||manifest.sourceRecovery?.archiveRoot!=='portplan/'||!Array.isArray(manifest.packages)||manifest.packages.length===0)throw new Error('恢复包清单或统一 portplan/ 根目录声明不完整。');
  const urls=new Set();
  for(const p of manifest.packages){
    if(!p||typeof p.file!=='string'||!/^portplan-[A-Za-z0-9_-]+\.zip$/.test(p.file)||p.url!=='/downloads/'+p.file||!Number.isSafeInteger(p.bytes)||p.bytes<=0||typeof p.sha256!=='string'||!/^[a-f0-9]{64}$/.test(p.sha256)||urls.has(p.url))throw new Error('恢复包文件名、站内地址、字节数或 SHA-256 不完整或重复。');
    urls.add(p.url);
  }
  return manifest.packages;
}

/** Publication guards only; independent Python reports perform the physical/statistical review. */
export function validateResearchV12Evidence(wrapper,review,statistics){
  const need=(condition,message)=>{if(!condition)throw new Error(message);};
  const close=(a,b,tolerance=1e-9)=>a===null&&b===null||Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance;
  const sameObject=(a,b)=>a&&b&&Object.keys(a).sort().join()===Object.keys(b).sort().join()&&Object.keys(a).every(key=>a[key]===b[key]);
  need(wrapper?.schemaVersion==='portplan-v12-published-results'&&wrapper.executionState==='complete','V12 正式结果尚未完成。');
  need(wrapper.scenarioCount===144&&wrapper.episodeCount===2592,'正式场景/运行覆盖不完整。');
  need(review?.schemaVersion==='portplan-independent-v12-run-review'&&review.valid===true&&review.fixture===false&&review.summary?.episodes===2592,'物理复核无效、未完成或为教学 fixture。');
  need(statistics?.schemaVersion==='portplan-independent-v12-bootstrap-review'&&statistics.valid===true&&statistics.fixture!==true&&statistics.episodeCount===2592&&statistics.businessScenarioCount===144,'统计复核无效或覆盖不完整。');
  for(const item of [review,statistics])need(item.readOnly===true&&item.importsJavaScript===false&&item.solverRuns===0,'复核不是独立只读范围。');
  const indexHash=wrapper.formalIndex?.sha256;need(typeof indexHash==='string'&&/^[a-f0-9]{64}$/.test(indexHash)&&review.inputIndexSha256===indexHash&&statistics.inputIndexSha256===indexHash,'结果与独立复核不是同一正式原档。');
  need(review.frozenManifestSha256&&review.frozenManifestSha256===statistics.frozenManifestSha256,'两份复核未绑定同一冻结版本。');
  need(JSON.stringify(wrapper.protocol?.methods)===JSON.stringify(METHODS_V12),'六方法声明不匹配。');
  need(wrapper.summary?.inferentialState==='complete-scenario-cluster-bootstrap','统计区间尚未完成。');
  for(const panel of ['same-distribution','stress']){
    const s=wrapper.summary.panels?.[panel],r=review.pointEstimates?.[panel],b=statistics.panels?.[panel];need(s?.scenarioCount===72&&r&&b,'缺少完整面板。');
    need(Object.keys(s.byMethod??{}).sort().join()===METHODS_V12.slice().sort().join()&&Object.keys(s.comparisons??{}).sort().join()===Object.keys(PAIRS).sort().join(),'方法或配对不完整。');
    for(const method of METHODS_V12){const p=s.byMethod[method];need(p.recordedEpisodeCount===216&&p.completeEpisodeCount===r.byMethod?.[method]?.completeEpisodeCount&&p.completeEpisodeCount===b.byMethod?.[method]?.completeEpisodeCount,'完成覆盖与独立复核不一致。');need(sameObject(p.initialization,b.byMethod[method].initialization),'初始化与后续失败尚未独立复算。');}
    for(const [name,[baseline,candidate]]of Object.entries(PAIRS)){const p=s.comparisons[name],q=r.comparisons?.[name],v=b.comparisons?.[name];need(q&&v&&p.baselineMethod===baseline&&p.candidateMethod===candidate,'配对身份不一致。');need(p.completion.lostEpisodeCount===q.lostEpisodes&&p.completion.lostEpisodeIds?.length===p.completion.lostEpisodeCount&&new Set(p.completion.lostEpisodeIds).size===p.completion.lostEpisodeCount,'完成损失未完整保留。');for(const key of ['total','incremental']){const fee=p.fees[key],checked=v.fees?.[key],point=q.fees[key];need(checked&&fee.pairedScenarioCount===checked.pairedScenarioCount&&fee.pairedEpisodeCount===checked.pairedEpisodeCount&&fee.pairedScenarioCount===point.pairedScenarios&&fee.pairedEpisodeCount===point.pairedEpisodes,'费用分母与复核不一致。');const expectedSaving=point.baselineScenarioMeanSumKRW?100*(point.baselineScenarioMeanSumKRW-point.candidateScenarioMeanSumKRW)/point.baselineScenarioMeanSumKRW:null;need(close(fee.weightedSavingsPct,expectedSaving),'费用节省与独立点估计不一致。');for(const field of ['negativeScenarioIds','negativeEpisodeIds'])need(Array.isArray(fee[field])&&new Set(fee[field]).size===fee[field].length,'费用负例索引缺失或重复。');need(fee.negativeScenarioIds.length===point.scenarioWinTieLoss.loss,'不利场景索引不完整。');const a=fee.uncertainty?.weightedSavingsPct95CI,c=checked.weightedSavingsPct95CI;need(a===null&&c===null||Array.isArray(a)&&Array.isArray(c)&&a.length===2&&c.length===2&&a.every((value,i)=>close(value,c[i])),'费用区间与独立复算不一致。');}}
  }
  return true;
}

export function mountResearchV12UI(container){
  const heading=node('div','page-heading'),copy=node('div'),content=node('div'),refresh=node('button','button','刷新已保存证据'),title=node('h1','','先及时交付完整初解，再比较同费必需仓位');title.id='research-v12-title';refresh.type='button';copy.append(node('div','eyebrow','V12 / INITIAL PLAN & NECESSARY WAREHOUSE COMMITMENT'),title,node('p','','初始化失败与后续执行失败分别报告；方法、重复、全部负例和共同分母一并检查。'));heading.append(copy,refresh);let busy=false;
  // Post-first-experiment presentation addition; frozen UI bytes remain in the experiment archive.
  const recovery=node('article','card reading-card'),packageList=node('div');packageList.setAttribute('aria-live','polite');
  recovery.append(node('h2','','当前源码与保留证据下载包'),node('p','','保存清单并下载其中全部 ZIP，逐项核对 bytes 和 SHA-256，再解压到同一父目录，合并为一个 portplan/ 项目；不要将各分包恢复为彼此独立的项目。当前构建保留所需资料，22片 V8/V9 历史二进制原档按政策单独恢复；ZIP 不是完整历史归档。'),links([['当前全部下载包与 SHA','/data/download-packages-v12.json'],['当前包构建与历史恢复说明','/downloads/recovery-v14.zh.md'],['22片历史原档省略清单','/data/historical-transport-policy-v14.json'],['源码恢复元信息','/data/source-recovery-v11.json']]),packageList,node('p','','源码包保留 AGENTS.md 与安全的原 Sites 项目配置；当前包原样安装和构建不需要 Git 凭据。历史原档以固定授权 Git 提交为主恢复来源，旧 Sites 保存版本为第二记录；当前 ZIP 不含 Git 历史。网页展示离线原生 V12 的保存记录，不在浏览器运行该求解器。'));
  const continuation=node('article');
  container.replaceChildren(heading,continuation,content,recovery);
  const history=node('details','card reading-card'),body=node('div');history.append(node('summary','','历史研究：V10 正式成绩与 V11 旧开发资料（独立输入，不并入 V12）'),body);history.addEventListener('toggle',()=>{if(history.open&&!body.childNodes.length){mountResearchV10UI(body);const oldTitle=body.querySelector('h1');if(oldTitle)oldTitle.id='research-v12-history-v10-title';}});container.append(history);
  async function json(path){const response=await fetch(path);if(!response.ok)throw new Error(path+' HTTP '+response.status);return response.json();}
  async function loadPackages(){packageList.replaceChildren(notice('正在读取当前发布的源码与保留证据包清单…'));try{const packages=validateResearchV12Packages(await json('/data/download-packages-v12.json')),list=node('ul');for(const p of packages){const item=node('li'),sha=node('code','','SHA-256: '+p.sha256);sha.style.display='block';sha.style.overflowWrap='anywhere';item.append(link(p.file,p.url),node('p','',number(p.bytes)+' bytes · '+number(p.bytes/1048576)+' MiB'),sha);list.append(item);}packageList.replaceChildren(node('p','',`清单列出 ${packages.length} 个 ZIP（当前源码与保留证据），请全部下载；22片 V8/V9 历史原档另按恢复说明取得。以下大小与 SHA 来自发布清单，供下载后核对；本页未预先校验 ZIP 内容。`),list);}catch(error){packageList.replaceChildren(notice('全部恢复包清单暂不可用（当前源码与保留证据）：'+error.message+'。请勿依据旧包数认定已完整恢复；可刷新重试。',true));}}
  async function load(){if(busy)return;busy=true;refresh.disabled=true;const packagesLoaded=loadPackages(),continuationLoaded=renderContinuationV13(continuation);content.replaceChildren(notice('正在读取 V12 正式状态；未完成时不显示预计成绩。'));try{
    const release=await json('/data/v12-release.json');content.replaceChildren(notice('公开证据路线：公开费率、公开基准和明确标记的合成已知订单研究。不同公开资料不拼作同一真实箱级提卸还轨迹，完整生命周期仍是仿真。企业实单、私人报价、联系人及试点均为可选增强，不是继续研发的条件。'));
    content.append(links([['公开证据研究包','/data/public-evidence-readiness-v11.json'],['公开资料路线说明','/downloads/public-evidence-route-v11.zh.md'],['公开源字段覆盖审计','/data/public-source-field-coverage-v12.json'],['公开字段与完整生命周期边界','/downloads/public-source-field-coverage-v12.zh.md'],['跨电脑恢复','/downloads/recovery-guide.zh.md']]));
    content.append(notice('V12 首发研究记录（其中验收状态为首发时状态；本轮更新见上方）：'+(release.notes??'正式实验尚未验收；保留当前开发范围。'),true));
    content.append(notice('预算为每次调用 200 ms 合作式目标、完整冷启动 episode 5 秒父进程硬边界。5 秒内必须完成父进程终态审核、worker 正常退出及进程组清理验证，仅及时收到结果不算完成。旧 D0 开发中的 15/15 指及时完整初解，调用返回墙钟约 207–220 ms；不是硬 200 ms 保证，也不是 15 次完整滚动执行。'));
    if(release.formalExperimentComplete&&release.independentReviewComplete&&release.independentBootstrapReviewComplete){
      const [result,review,statistics]=await Promise.all([json('/data/v12-results.json'),json('/data/review-v12.json'),json('/data/bootstrap-review-v12.json')]);validateResearchV12Evidence(result,review,statistics);
      for(const [panel,s]of Object.entries(result.summary.panels)){const label=panel==='stress'?'压力扰动 · 新订单种子':'同生成机制 · 新订单种子';content.append(table(label,['方法','完整 / 216','及时接受初始计划','已知 D0 失败','已知后续失败','D0 历史未知'],METHODS_V12.map(method=>{const v=s.byMethod[method],i=v.initialization;return [LABELS[method],v.completeEpisodeCount,i.acceptedInitialPlanCount,i.knownInitialFailureCount,i.knownLaterFailureCount,i.unknownDayZeroCount];})));
        content.append(table('同场景配对 · '+label,['候选 / 基线','完成增 / 损','共同场景 / 运行','新增两费节省','条件 95% 区间','改期 · 基线→候选'],Object.values(s.comparisons).map(p=>[LABELS[p.candidateMethod]+' / '+LABELS[p.baselineMethod],p.completion.gainedEpisodeCount+' / '+p.completion.lostEpisodeCount,p.fees.incremental.pairedScenarioCount+' / '+p.fees.incremental.pairedEpisodeCount,percent(p.fees.incremental.weightedSavingsPct),interval(p.fees.incremental.uncertainty.weightedSavingsPct95CI),number(p.revisions.baselineObservedSum)+' → '+number(p.revisions.candidateObservedSum)])));
        const adverse=Object.fromEntries(Object.entries(s.comparisons).map(([key,p])=>[key,{completionLosses:p.completion.lostEpisodeIds,totalFeeNegativeScenarios:p.fees.total.negativeScenarioIds,totalFeeNegativeEpisodes:p.fees.total.negativeEpisodeIds,incrementalFeeNegativeScenarios:p.fees.incremental.negativeScenarioIds,incrementalFeeNegativeEpisodes:p.fees.incremental.negativeEpisodeIds}]));content.append(raw(label+' · 全部完成损失与费用负例',adverse),raw(label+' · 六法共同完成集合与观察门槛',{jointCompletePareto:s.jointCompletePareto,observedDecisionGates:s.observedDecisionGates}));
      }
      content.append(notice('144 个业务场景 × 3 次预固定算法/时钟重复 × 6 方法 = 2,592 次 episode。每面板每方法 216 次不是 216 个独立业务场景。费用和改期仅在各自共同完成配对中比较，先场景内平均，再等权；场景聚类区间不能消除完成选择偏差。失败金额为 null。不同配对及六法共同集合不可混成排名。',true));
      content.append(links([['正式结果与全部负例','/data/v12-results.json'],['独立物理与选择审核','/data/review-v12.json'],['独立场景区间复算','/data/bootstrap-review-v12.json'],['中文报告','/downloads/report-v12.zh.md'],['韩文报告','/downloads/submission-v12.ko.md'],['韩文 PDF（≤20页）','/downloads/defense-v12.ko.pdf'],['原生可编辑韩文 PPT','/downloads/defense-v12.ko.pptx'],['英文说明','/downloads/defense-v12.en.md'],['作者贡献与本人空表','/downloads/contribution-log-v12.md']]));
    }else content.append(notice('V12 正式结果或双独立复核尚未完成；这里不使用开发结果填充正式成绩。旧 V11 开发与 V10 结果在下方历史折叠区单列。',true));
    content.append(notice('同费必需仓位是当前公开快照下的必要下界，不预测未公告的未来容量。CP-SAT 仅为旧 9 个快照的独立诊断，不属于正式六方法或 2,592 次分母。V5 未包含在本轮，不能推断对 V5 不退步。'));
    const development=node('details','card reading-card');development.append(node('summary','','开发动机与旧输入诊断（非本轮正式成绩）'),notice('D0 开发仅为已见 V10 相对 V7 初始损失的 15 个 endpoint；同前缀延续仅为一个已见场景的控制分支。不得解释为全部 D0 失败、自然初始化或新总体收益。'),links([['旧 D0 初解记录','/data/seeded-initial-development-v12.json'],['D0 独立复核','/data/development-seed-review-v12.json'],['固定前缀开发延续','/data/replay-commitment-v11.json'],['固定前缀独立复核','/data/replay-commitment-v11-review.json']]));
    const cp=node('div');development.append(cp);content.append(development);
    try{const diagnostic=await json('/data/native-diagnostic-review-v12-final.json'),response=await fetch('/data/native-diagnostic-v12.json');if(!response.ok||!globalThis.crypto?.subtle)throw new Error('Diagnostic byte verification unavailable');const bytes=await response.arrayBuffer(),digest=[...new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',bytes))].map(value=>value.toString(16).padStart(2,'0')).join('');if(diagnostic.schemaVersion==='portplan-independent-native-diagnostic-review-v12'&&diagnostic.valid===true&&diagnostic.publishedSummarySha256===digest&&diagnostic.snapshotCount===9&&diagnostic.taskCount===36&&diagnostic.newHeldOutScenarios===0){cp.append(notice('已保存并绑定原始摘要的 CP-SAT / HiGHS 旧快照资料单列：9 快照 × 2 方法 × 200/2000ms 两种诊断预算；不据此宣称胜过 CP-SAT 或扩大正式分母。前缀无解也不等于原场景从零无解。'),links([['旧快照诊断原始摘要','/data/native-diagnostic-v12.json'],['强化独立诊断审阅原文','/data/native-diagnostic-review-v12-final.json'],['诊断范围说明','/downloads/native-diagnostic-v12.md'],['CP-SAT 方法范围','/downloads/cpsat-method-v12.md']]));}else cp.append(notice('CP-SAT 旧快照资料尚未通过原始字节与独立审阅的展示检查；未用于本轮成绩。'));}catch{cp.append(notice('CP-SAT 旧快照资料尚未通过原始字节与独立审阅的展示检查；未用于本轮成绩。'));}
    content.append(notice(`V12 首发时的验收记录——浏览器真实操作：${release.browserInteractionValidation==='completed'?'已有实际记录':'尚未验收'}；本人复现与答辩：${release.entrantDefenseValidation==='completed'?'已有实际记录':'尚未验收'}。当前验收见上方“本轮推进”；不保证比赛名次。`));
  }catch(error){content.replaceChildren(notice('V12 证据尚不可展示：'+error.message+'。未填入预计成绩；历史研究可从下方展开。',true));}finally{await Promise.allSettled([packagesLoaded,continuationLoaded]);busy=false;refresh.disabled=false;}}
  refresh.addEventListener('click',load);load();
}
