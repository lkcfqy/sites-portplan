import {readFile,writeFile,mkdir,access,readdir,copyFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fork} from 'node:child_process';
import {cpus,totalmem,platform,release,arch} from 'node:os';
import {resolve,dirname,relative,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {METHODS_V10,unknownEpisodeV10} from './episode-v10.worker.mjs';
import {isCompleteV7,validateCompleteReceiptV7,realizeDeclaredShocksV7} from './rolling-benchmark-v7.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const WORKER=fileURLToPath(new URL('./episode-v10.worker.mjs',import.meta.url));
const FEE_FIELDS=['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost','lateCount'];
const EPS=1e-6;
export const isCompleteV10=result=>result?.scalarReceipt===true?
  Boolean(result.complete===true&&result.auditValid===true&&result.episodeCompletedWithinBudget===true&&['feasible','optimal'].includes(result.status)
    &&result.terminalRowCount>0&&result.artifact?.path&&Number.isFinite(result.totalCost)&&Number.isFinite(result.incrementalCost)):isCompleteV7(result);
export const validateCompleteReceiptV10=validateCompleteReceiptV7;
export {METHODS_V10};
export const sha256=value=>createHash('sha256').update(value).digest('hex');

/** Parent clock includes process launch/imports, native ready, all decisions,
 * dual audits, child cleanup, terminal IPC and this parent's receipt validation.
 * Detached POSIX process groups contain Python as well as the Node worker. */
export function runColdEpisodeV10(input,{hardWallMs=5000,workerScript=WORKER}={}){
  if(!Number.isFinite(hardWallMs)||hardWallMs<=0)throw new Error('hardWallMs must be positive and finite.');
  return new Promise(resolveResult=>{
    const started=performance.now(),episodeId=input.episodeId??input.nominalScenario?.id,method=input.method;
    const grouped=process.platform!=='win32';
    const child=fork(workerScript,[],{stdio:['ignore','ignore','pipe','ipc'],serialization:'advanced',detached:grouped,
      env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1',NUMEXPR_NUM_THREADS:'1'}});
    let final=null,finalReceivedMs=null,receiptValidatedMs=null,actualCutoffMs=null,deadlineReached=false,stderr='',rejectedTerminalCount=0,rejectedTerminalErrors=[];
    const unacceptedTerminalReceipts=[];
    let killSignalSent=false;
    const killGroup=()=>{
      try{if(grouped&&child.pid)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');killSignalSent=true;}
      catch(error){if(error.code!=='ESRCH')stderr=(stderr+' '+String(error)).slice(-4000);}
    };
    child.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-4000);});
    const timer=setTimeout(()=>{actualCutoffMs=performance.now()-started;if(!final)deadlineReached=true;killGroup();},Math.max(0,hardWallMs-(performance.now()-started)));
    child.on('message',message=>{
      const elapsed=performance.now()-started;
      if(message?.type!=='final')return;
      const keepRejected=(reason,errors=[],validatedMs=null)=>unacceptedTerminalReceipts.push({parentReceivedMs:elapsed,
        receiptValidatedMs:validatedMs,reason,errors:structuredClone(errors),message:structuredClone(message),
        interpretation:'Unaccepted raw terminal evidence; not an accepted physical execution history or a complete fee receipt.'});
      if(message.method!==method||message.episodeId!==episodeId){keepRejected('terminal_identity_mismatch');return;}
      if(final){keepRejected('duplicate_terminal_receipt');return;}
      if(deadlineReached||elapsed>hardWallMs){keepRejected('terminal_received_after_parent_deadline');return;}
      const result=message.result;
      if(!result||typeof result.status!=='string'||typeof result.complete!=='boolean'){keepRejected('malformed_terminal_receipt');return;}
      if(result.complete){
        const errors=validateCompleteReceiptV10(input,result);
        if(errors.length){rejectedTerminalCount++;rejectedTerminalErrors=errors.slice(0,20);keepRejected('terminal_audit_rejected',errors,performance.now()-started);return;}
      }
      const validated=performance.now()-started;
      if(validated>hardWallMs){keepRejected('terminal_audit_completed_after_parent_deadline',[],validated);return;}
      final=result;finalReceivedMs=elapsed;receiptValidatedMs=validated;
    });
    child.on('error',error=>{stderr=(stderr+' '+String(error)).slice(-4000);});
    child.on('close',(code,signal)=>{
      clearTimeout(timer);killGroup();const exitMs=performance.now()-started;
      if(!final&&exitMs>=hardWallMs)deadlineReached=true;
      const result=final??unknownEpisodeV10(method,deadlineReached?'No audited terminal receipt was delivered and parent-validated within the common whole-episode budget. History/counters are unavailable.':`Worker exited without a valid terminal receipt (${code}, ${signal}). ${stderr}`,deadlineReached?'hard_time_limit':'worker_error');
      if(!result.complete){result.rows=[];result.usage=[];for(const key of FEE_FIELDS)result[key]=null;}
      resolveResult({...result,policy:method,hardWallMs,wallTimeMs:receiptValidatedMs??actualCutoffMs??exitMs,actualCutoffMs,processExitWallTimeMs:exitMs,
        finalReceivedMs,receiptValidatedMs,rejectedTerminalCount,rejectedTerminalErrors,unacceptedTerminalReceipts,deadlineReached,outputDeliveredWithinBudget:Boolean(final),
        episodeCompletedWithinBudget:Boolean(final&&isCompleteV10(result)),endToEndCompletedWithinBudget:Boolean(final),
        processGroupCleanup:{mode:grouped?'posix-process-group':'worker-only',killSignalSent},exitCode:code,exitSignal:signal,stderr:stderr||null});
    });
    child.send({...input,episodeId},error=>{if(error){stderr=(stderr+' '+String(error)).slice(-4000);killGroup();}});
  });
}

export async function assertNewOutputV10(path){
  try{await access(path);}catch(error){if(error.code==='ENOENT')return;throw error;}
  throw new Error('Output already exists; preserve the first run and choose a new path.');
}

/** Pure metadata expansion; never invokes the synthetic order generator. */
export function enumerateCasesV10(protocol){
  const cases=[],ids=new Set(),seeds=new Set();
  for(const panel of protocol.panels){
    let index=0;
    for(const mechanism of protocol.matrix.mechanisms)for(const capacityProfile of protocol.matrix.capacityProfiles)
      for(const count of protocol.matrix.counts)for(let repeat=1;repeat<=protocol.matrix.scenariosPerCell;repeat++){
        const pattern=panel.shockPatterns[(repeat-1)%panel.shockPatterns.length];
        const config={id:`v10-${panel.id}-${mechanism}-${capacityProfile}-n${count}-r${repeat}`,panel:panel.id,dataRole:'held-out',
          mechanism,capacityProfile,count,scenarioRepeat:repeat,seed:panel.baseSeed+index++,shockPattern:pattern.name,shocks:structuredClone(pattern.shocks)};
        if(ids.has(config.id)||seeds.has(config.seed))throw new Error('V10 scenario identifiers and generator seeds must be unique across panels.');
        ids.add(config.id);seeds.add(config.seed);cases.push(config);
      }
    if(index!==panel.scenarioCount)throw new Error('Declared panel scenario count differs from its matrix.');
  }
  return cases;
}

const FIXED_CALL_BUDGETS_V10={"stableRetainV5":{"timeLimitSeconds":0.2},"costPolishV7":{"timeLimitSeconds":0.2,"timeBudgetMs":200,"constructorShare":0.4,"auditReserveMs":5,"maxRestarts":15,"retainFeasible":true,"maxPasses":2,"maxPairs":32,"candidateCap":12,"maxPairChecks":384,"maxSingleTargets":16},"highsV8":{"timeBudgetMs":200,"timeLimitSeconds":0.2,"objectiveMode":"joint","auditReserveMs":2,"hardOverrunGraceMs":250,"initializationTimeoutMs":10000,"retainCacheFallback":true},"adaptiveV9":{"timeLimitSeconds":0.2,"timeBudgetMs":200,"constructorShare":0.4,"auditReserveMs":5,"maxRestarts":15,"retainFeasible":true,"maxPasses":2,"maxPairs":32,"candidateCap":12,"maxPairChecks":384,"maxSingleTargets":16,"feeToleranceRatio":0.005,"maxChangedEvents":6,"lookaheadDays":2,"pressureGuard":true,"opportunityThresholdKRW":0},"stableHiGHSV10":{"timeBudgetMs":200,"timeLimitSeconds":0.2,"objectiveMode":"joint","auditReserveMs":2,"hardOverrunGraceMs":250,"initializationTimeoutMs":10000,"retainCacheFallback":true}};
const FIXED_MATRIX_V10={"mechanisms":["aged-backlog","new-arrivals","batch-release"],"capacityProfiles":["balanced","tight"],"counts":[24,50,100],"scenariosPerCell":4};
const FIXED_COMPARISONS_V10={"v10VsHiGHS":["highsV8","stableHiGHSV10"],"v10VsV9":["adaptiveV9","stableHiGHSV10"],"v10VsV7":["costPolishV7","stableHiGHSV10"],"v10VsV5":["stableRetainV5","stableHiGHSV10"],"highsVsV7":["costPolishV7","highsV8"]};
function canonicalJSONV10(value){return JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(v=>JSON.parse(canonicalJSONV10(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonicalJSONV10(value[k]))])):value);}
export function validateProtocolV10(protocol){
  if(protocol.schemaVersion!=='portplan-protocol-v10'||JSON.stringify(protocol.methods)!==JSON.stringify(METHODS_V10))throw new Error('Protocol must declare the five fixed allowed methods.');
  if(protocol.budget.hardWallMs!==5000||protocol.budget.cpuThreads!==1)throw new Error('V10 common budget must be 5000ms with one native thread.');
  if(protocol.algorithmRepeats.length!==3||new Set(protocol.algorithmRepeats.map(r=>r.seed)).size!==3)throw new Error('Exactly three predeclared repeat seeds are required.');
  if(canonicalJSONV10(protocol.algorithmRepeats)!==canonicalJSONV10([{index:1,seed:49011},{index:2,seed:49023},{index:3,seed:49039}]))throw new Error('V10 repeat seeds must remain the three prespecified 49011/49023/49039 values.');
  for(const method of METHODS_V10)if(!protocol.callBudgets[method])throw new Error(`Missing call budget for ${method}.`);
  for(const method of METHODS_V10){
    const budget=protocol.callBudgets[method];
    if(Object.hasOwn(budget,'onIncumbent'))throw new Error('Formal diagnostic observers are forbidden.');
    if(budget.timeLimitSeconds!==.2||(method!=='stableRetainV5'&&budget.timeBudgetMs!==200))throw new Error('V10 retains the fixed existing 200ms daily budgets.');
  }
  if(JSON.stringify(protocol.callBudgets.stableHiGHSV10)!==JSON.stringify(protocol.callBudgets.highsV8))throw new Error('V10 stable native and original native must retain identical fixed call configuration.');
  if(canonicalJSONV10(protocol.callBudgets)!==canonicalJSONV10(FIXED_CALL_BUDGETS_V10))throw new Error('V10 baseline budgets and parameters must remain unchanged.');
  if(canonicalJSONV10(protocol.matrix)!==canonicalJSONV10(FIXED_MATRIX_V10))throw new Error('V10 must retain the fixed 144-case matrix.');
  if(canonicalJSONV10(protocol.analysis.comparisons)!==canonicalJSONV10(FIXED_COMPARISONS_V10))throw new Error('V10 comparison pairs are prespecified.');
  if(protocol.panels[0]?.id!=='same-distribution'||protocol.panels[0]?.baseSeed!==491001||protocol.panels[1]?.id!=='stress'||protocol.panels[1]?.baseSeed!==492001)throw new Error('V10 unseen business seed commitments must remain 491001/492001.');
  if(protocol.nativeSelectionRule?.fixedNumericalEpsilon!==1e-6)throw new Error('V10 selection epsilon is fixed, not a tunable fee weight.');
  if(protocol.analysis.bootstrap.seed!==700001||protocol.analysis.bootstrap.draws!==2000)throw new Error('V10 bootstrap must retain the fixed 2000-draw seed-700001 rule.');
  const cases=enumerateCasesV10(protocol);
  if(cases.length!==144||protocol.panels.length!==2||protocol.panels.some(p=>p.scenarioCount!==72))throw new Error('V10 needs two separate panels of 72 scenarios.');
  for(const c of cases)for(const shock of c.shocks)if(Object.hasOwn(shock,'announcedDuration'))throw new Error('Stress tests must not disclose private recovery duration.');
  return protocol;
}

export function executionOrderV10(scenarioIndex,repeatIndex){
  const start=(scenarioIndex+repeatIndex)%METHODS_V10.length;
  return METHODS_V10.map((_,offset)=>METHODS_V10[(start+offset)%METHODS_V10.length]);
}

const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const sum=values=>values.reduce((total,value)=>total+value,0);
const classification=value=>value>EPS?'win':value< -EPS?'loss':'tie';
function quantile(sorted,p){if(!sorted.length)return null;const x=(sorted.length-1)*p,low=Math.floor(x);return sorted[low]+(sorted[Math.ceil(x)]-sorted[low])*(x-low);}
/** Cluster bootstrap: each draw resamples whole business scenarios, retaining
 * every predeclared repeat together. Three runs are not three new scenarios. */
export function pairedBootstrapV10(units,{seed=700001,draws=2000}={}){
  if(!units.length)return {unit:'scenario',scenarioCount:0,draws,meanSavings95CI:null,weightedSavingsPct95CI:null};
  let state=seed>>>0;const draw=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const means=[],percentages=[];
  for(let d=0;d<draws;d++){
    let b=0,c=0;
    for(let i=0;i<units.length;i++){const u=units[Math.floor(draw()*units.length)];b+=u.baseline;c+=u.candidate;}
    means.push((b-c)/units.length);if(b!==0)percentages.push(100*(b-c)/b);
  }
  means.sort((a,b)=>a-b);percentages.sort((a,b)=>a-b);
  return {unit:'scenario',scenarioCount:units.length,draws,meanSavings95CI:[quantile(means,.025),quantile(means,.975)],
    weightedSavingsPct95CI:percentages.length?[quantile(percentages,.025),quantile(percentages,.975)]:null,
    interpretation:'Percentile scenario-cluster bootstrap; conditional fee sample is the pairwise jointly completed set, not a missing-at-random estimate.'};
}

function compareMethods(cases,baseline,candidate,bootstrap){
  const units=[],allPairs=[],completionUnits=[];let gained=0,lost=0;
  const gainIds=[],lossIds=[],knownFailureGainIds=[],unknownHistoryGainIds=[];
  for(const c of cases){
    const repeatPairs=[],differences=[];
    for(const repetition of c.repeats){
      const b=repetition.policies[baseline],a=repetition.policies[candidate],bc=isCompleteV10(b),ac=isCompleteV10(a);
      differences.push(Number(ac)-Number(bc));
      const pairId=`${c.id}::repeat-${repetition.repeatIndex}`;
      if(ac&&!bc){gained++;gainIds.push(pairId);(b?.executionHistoryUnavailable?unknownHistoryGainIds:knownFailureGainIds).push(pairId);}
      if(bc&&!ac){lost++;lossIds.push(pairId);}
      if(bc&&ac){const pair={scenarioId:c.id,pairId,baseline:b,candidate:a};repeatPairs.push(pair);allPairs.push(pair);}
    }
    completionUnits.push({baseline:0,candidate:mean(differences)});
    if(repeatPairs.length){
      units.push({scenarioId:c.id,pairedRepeatCount:repeatPairs.length,
        total:{baseline:mean(repeatPairs.map(p=>p.baseline.totalCost)),candidate:mean(repeatPairs.map(p=>p.candidate.totalCost))},
        incremental:{baseline:mean(repeatPairs.map(p=>p.baseline.incrementalCost)),candidate:mean(repeatPairs.map(p=>p.candidate.incrementalCost))}});
    }
  }
  const fees={};
  for(const [name,key]of [['total','totalCost'],['incremental','incrementalCost']]){
    const b=sum(units.map(u=>u[name].baseline)),a=sum(units.map(u=>u[name].candidate));
    const counts={win:0,tie:0,loss:0};for(const u of units)counts[classification(u[name].baseline-u[name].candidate)]++;
    fees[name]={pairedScenarioCount:units.length,pairedEpisodeCount:allPairs.length,baselineScenarioMeanSumKRW:b,candidateScenarioMeanSumKRW:a,
      scenarioWeightedSavingsKRW:b-a,weightedSavingsPct:b===0?null:100*(b-a)/b,scenarioWinTieLoss:counts,
      baselineEpisodeSumKRW:sum(allPairs.map(p=>p.baseline[key])),candidateEpisodeSumKRW:sum(allPairs.map(p=>p.candidate[key])),
      zeroBaselineScenarioCount:units.filter(u=>u[name].baseline===0).length,zeroBaselineEpisodeCount:allPairs.filter(p=>p.baseline[key]===0).length,
      worstScenarioLossKRW:Math.max(0,...units.map(u=>u[name].candidate-u[name].baseline)),
      negativeScenarioIds:units.filter(u=>u[name].candidate-u[name].baseline>EPS).map(u=>u.scenarioId),
      negativeEpisodeIds:allPairs.filter(p=>p.candidate[key]-p.baseline[key]>EPS).map(p=>p.pairId),
      uncertainty:pairedBootstrapV10(units.map(u=>u[name]),bootstrap)};
  }
  const revisions=allPairs.filter(p=>Number.isFinite(p.baseline.revisionCount)&&Number.isFinite(p.candidate.revisionCount));
  return {baselineMethod:baseline,candidateMethod:candidate,scenarioCount:cases.length,episodePairCount:sum(cases.map(c=>c.repeats.length)),
    completion:{gainedEpisodeCount:gained,lostEpisodeCount:lost,gainedEpisodeIds:gainIds,lostEpisodeIds:lossIds,
      gainedFromKnownFailureEpisodeIds:knownFailureGainIds,gainedFromUnknownHistoryEpisodeIds:unknownHistoryGainIds,
      meanScenarioRateGain:mean(completionUnits.map(u=>u.candidate)),
      uncertainty:{unit:'scenario completion-rate difference',
        meanScenarioRateGain95CI:pairedBootstrapV10(completionUnits.map(u=>({baseline:0,candidate:-u.candidate})),bootstrap).meanSavings95CI},
      interpretation:'Timely complete audited receipts; an unavailable history is not proof of physical execution failure.'},
    fees,revisions:{pairedEpisodeCount:revisions.length,baselineObservedSum:sum(revisions.map(p=>p.baseline.revisionCount)),candidateObservedSum:sum(revisions.map(p=>p.candidate.revisionCount))},
    pairedScenarios:units.map(u=>({scenarioId:u.scenarioId,pairedRepeatCount:u.pairedRepeatCount,totalSavingsKRW:u.total.baseline-u.total.candidate,
      incrementalSavingsKRW:u.incremental.baseline-u.incremental.candidate})),
    interpretation:'Each scenario has equal weight after averaging matching jointly completed repeats. Each comparison has its own eligibility set; do not rank methods across denominators.'};
}

/** One eligibility set for all five methods. Do not mix these denominators
 * with pairwise tables or convert event revisions into invented fee weights. */
export function jointCompleteParetoV10(cases,fullSampleByMethod={}){
  const scenarios=[],allPairs=[];
  for(const c of cases){
    const repeats=c.repeats.filter(r=>METHODS_V10.every(method=>isCompleteV10(r.policies[method])));
    if(!repeats.length)continue;
    allPairs.push(...repeats);
    scenarios.push({scenarioId:c.id,pairedRepeatCount:repeats.length,byMethod:Object.fromEntries(METHODS_V10.map(method=>{
      const values=repeats.map(r=>r.policies[method]),known=values.every(r=>Number.isFinite(r.revisionCount));
      return [method,{totalCost:mean(values.map(r=>r.totalCost)),incrementalCost:mean(values.map(r=>r.incrementalCost)),
        revisionCount:known?mean(values.map(r=>r.revisionCount)):null}];
    }))});
  }
  const byMethod=Object.fromEntries(METHODS_V10.map(method=>{
    const values=allPairs.map(r=>r.policies[method]),known=values.filter(r=>Number.isFinite(r.revisionCount)),has=scenarios.length>0,allKnown=has&&known.length===values.length;
    return [method,{scenarioCount:scenarios.length,jointEpisodeCount:allPairs.length,
      scenarioMeanTotalCostSumKRW:has?sum(scenarios.map(s=>s.byMethod[method].totalCost)):null,
      scenarioMeanIncrementalCostSumKRW:has?sum(scenarios.map(s=>s.byMethod[method].incrementalCost)):null,
      scenarioMeanRevisionCountSum:allKnown?sum(scenarios.map(s=>s.byMethod[method].revisionCount)):null,
      episodeTotalCostSumKRW:has?sum(values.map(r=>r.totalCost)):null,episodeIncrementalCostSumKRW:has?sum(values.map(r=>r.incrementalCost)):null,
      episodeRevisionCountSum:allKnown?sum(known.map(r=>r.revisionCount)):null,knownRevisionEpisodeCount:known.length,unknownRevisionEpisodeCount:values.length-known.length,
      fullSampleCompleteEpisodeCount:fullSampleByMethod[method]?.completeEpisodeCount??cases.reduce((n,c)=>n+c.repeats.filter(r=>isCompleteV10(r.policies[method])).length,0),
      fullSampleEpisodeCount:fullSampleByMethod[method]?.recordedEpisodeCount??cases.reduce((n,c)=>n+c.repeats.filter(r=>r.policies[method]).length,0)}];
  }));
  const frontier=feeKey=>METHODS_V10.map(method=>{
    const current=byMethod[method],comparable=scenarios.length>0&&Number.isFinite(current[feeKey])&&Number.isFinite(current.scenarioMeanRevisionCountSum);
    const dominates=(left,right)=>Number.isFinite(left[feeKey])&&Number.isFinite(left.scenarioMeanRevisionCountSum)
      &&Number.isFinite(right[feeKey])&&Number.isFinite(right.scenarioMeanRevisionCountSum)
      &&left[feeKey]<=right[feeKey]+EPS&&left.scenarioMeanRevisionCountSum<=right.scenarioMeanRevisionCountSum+EPS
      &&(left[feeKey]<right[feeKey]-EPS||left.scenarioMeanRevisionCountSum<right.scenarioMeanRevisionCountSum-EPS);
    const worse=comparable?METHODS_V10.filter(other=>other!==method&&dominates(current,byMethod[other])):[];
    const better=comparable?METHODS_V10.filter(other=>other!==method&&dominates(byMethod[other],current)):[];
    return {method,dominates:worse,dominatedBy:better,pareto:comparable?better.length===0:null};
  });
  return {jointScenarioCount:scenarios.length,jointEpisodeCount:allPairs.length,eligibility:'all-five-matching-complete-repeats',byMethod,
    frontiers:{totalAndRevisions:frontier('scenarioMeanTotalCostSumKRW'),incrementalAndRevisions:frontier('scenarioMeanIncrementalCostSumKRW')},scenarios,
    scope:'Conditional all-five jointly completed matching repeats; average within scenario then equal scenario weight. No revision-to-KRW conversion. This table never overrides full-sample completion losses or establishes universal dominance.'};
}

/** Prespecified necessary observation gates, never a production recommendation. */
export function observedDecisionGatesV10(comparisons,{completePanel=false}={}){
  const names={highsV8:'v10VsHiGHS',adaptiveV9:'v10VsV9',costPolishV7:'v10VsV7',stableRetainV5:'v10VsV5'};
  const completionLossCountsByBaseline=Object.fromEntries(Object.entries(names).map(([method,key])=>[method,comparisons[key].completion.lostEpisodeCount]));
  const completionNonRegressionAllBaselines=Object.values(completionLossCountsByBaseline).every(count=>count===0);
  const native=comparisons.v10VsHiGHS,revision=native.revisions,feeCount=native.fees.incremental.pairedEpisodeCount;
  const knownRevisions=feeCount>0&&revision.pairedEpisodeCount===feeCount;
  const revisionDelta=knownRevisions?revision.candidateObservedSum-revision.baselineObservedSum:null;
  const claim=fee=>{const ci=fee.uncertainty.weightedSavingsPct95CI;
    return !ci?'unavailable':ci[0]>0?'conditional_savings_interval_positive':ci[1]<0?'conditional_deterioration_interval_negative':'no_stable_advantage';};
  const incrementalFeeClaim=claim(native.fees.incremental),totalFeeClaim=claim(native.fees.total);
  const noRobustFeeDeterioration=[incrementalFeeClaim,totalFeeClaim].every(value=>value!=='unavailable'&&value!=='conditional_deterioration_interval_negative');
  const strictRevisionReduction=knownRevisions&&revisionDelta<0;
  return {candidateMethod:'stableHiGHSV10',assessmentState:completePanel?'complete-panel':'partial-panel',completionLossCountsByBaseline,
    completionNonRegressionAllBaselines,defaultRecommendationEligible:completePanel&&completionNonRegressionAllBaselines,
    nativeComparison:{lostEpisodeCount:native.completion.lostEpisodeCount,revisionPairedEpisodeCount:revision.pairedEpisodeCount,
      revisionDelta,strictRevisionReduction,incrementalFeeClaim,totalFeeClaim,noRobustFeeDeterioration,
      stabilityImprovementClaimAllowed:completePanel&&native.completion.lostEpisodeCount===0&&strictRevisionReduction&&noRobustFeeDeterioration},
    scope:'Observed necessary gates only. Any full-sample completion loss against an old baseline prevents default eligibility. A fee interval containing zero gives no stable fee advantage; stability is conditional on the exact native paired set. No production or universal non-regression claim.'};
}

export function summarizePanelV10(cases,{bootstrap={}}={}){
  const byMethod={};
  for(const method of METHODS_V10){
    const results=cases.flatMap(c=>c.repeats.map(r=>r.policies[method])).filter(Boolean),statuses={};for(const r of results)statuses[r.status]=(statuses[r.status]??0)+1;
    const values=key=>results.map(r=>r[key]).filter(Number.isFinite);
    byMethod[method]={scenarioCount:cases.length,recordedEpisodeCount:results.length,completeEpisodeCount:results.filter(isCompleteV10).length,
      fullyCompletedScenarioCount:cases.filter(c=>c.repeats.length===3&&c.repeats.every(r=>isCompleteV10(r.policies[method]))).length,
      anyCompletedScenarioCount:cases.filter(c=>c.repeats.some(r=>isCompleteV10(r.policies[method]))).length,
      meanScenarioCompletionRate:mean(cases.map(c=>mean(c.repeats.map(r=>Number(isCompleteV10(r.policies[method])))))),
      executionHistoryUnavailableCount:results.filter(r=>r.executionHistoryUnavailable===true).length,
      auditFailureCount:results.filter(r=>r.status==='audit_failed'||r.rejectedTerminalCount>0).length,
      hardDeadlineCount:results.filter(r=>r.deadlineReached).length,statuses,
      wallTimeMs:{observedCount:values('wallTimeMs').length,mean:mean(values('wallTimeMs')),max:values('wallTimeMs').length?Math.max(...values('wallTimeMs')):null},
      revisionCount:{knownEpisodeCount:values('revisionCount').length,unknownEpisodeCount:results.length-values('revisionCount').length,observedSum:sum(values('revisionCount'))},
      counters:Object.fromEntries(['decisionCalls','solverCalls','constructorCalls','reusedPlans','planningWallMs'].map(key=>{
        const known=results.map(r=>r.plannerStats?.[key]).filter(Number.isFinite);
        return [key,{knownEpisodeCount:known.length,unknownEpisodeCount:results.length-known.length,observedSum:sum(known)}];
      }))};
  }
  const comparisons={
    v10VsHiGHS:compareMethods(cases,'highsV8','stableHiGHSV10',bootstrap),
    v10VsV9:compareMethods(cases,'adaptiveV9','stableHiGHSV10',bootstrap),
    v10VsV7:compareMethods(cases,'costPolishV7','stableHiGHSV10',bootstrap),
    v10VsV5:compareMethods(cases,'stableRetainV5','stableHiGHSV10',bootstrap),
    highsVsV7:compareMethods(cases,'costPolishV7','highsV8',bootstrap)};
  const jointCompletePareto=jointCompleteParetoV10(cases,byMethod);
  const allMethodCommonComplete={scenarioCount:jointCompletePareto.jointScenarioCount,episodeCount:jointCompletePareto.jointEpisodeCount,
    byMethod:Object.fromEntries(METHODS_V10.map(method=>{const row=jointCompletePareto.byMethod[method];return [method,{
      totalScenarioMeanSumKRW:row.scenarioMeanTotalCostSumKRW,incrementalScenarioMeanSumKRW:row.scenarioMeanIncrementalCostSumKRW,
      revisionObservedSum:row.episodeRevisionCountSum}];})),scope:jointCompletePareto.scope+' Thin-table revisionObservedSum is the raw matched-episode count; frontier revision axis uses scenarioMeanRevisionCountSum instead.'};
  const completePanel=cases.length===72&&cases.every(c=>c.repeats.length===3&&c.repeats.every(r=>METHODS_V10.every(method=>r.policies[method])));
  return {scenarioCount:cases.length,byMethod,comparisons,jointCompletePareto,allMethodCommonComplete,
    observedDecisionGates:observedDecisionGatesV10(comparisons,{completePanel})};
}

export function summarizeExperimentV10(cases,options={}){
  return {statisticalUnit:'scenario',recordedScenarioCount:cases.length,
    panels:Object.fromEntries([...new Set(cases.map(c=>c.panel))].map(panel=>[panel,summarizePanelV10(cases.filter(c=>c.panel===panel),options)])),
    interpretation:'Panels remain separate. All three repeats are retained; repeated seeds/timing runs do not increase the number of business scenarios. No pooled leaderboard.'};
}

async function environmentV10(){
  const cgroup={};for(const path of ['/sys/fs/cgroup/cpu.max','/sys/fs/cgroup/memory.max'])try{cgroup[path]=(await readFile(path,'utf8')).trim();}catch{cgroup[path]='unavailable';}
  return {node:process.version,platform:platform(),release:release(),arch:arch(),hostLogicalCPUs:cpus().length,cpuModel:cpus()[0]?.model,
    hostMemoryBytes:totalmem(),cgroupLimits:cgroup,nativeThreadEnvironment:{OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1',NUMEXPR_NUM_THREADS:'1'}};
}
async function sourcePathsV10(){
  const paths=['package.json','package-lock.json','data/protocol-v2.json','data/protocol-v8.json','data/protocol-v9.json','data/protocol-v10.json'];
  async function collect(dir){for(const item of await readdir(join(ROOT,dir),{withFileTypes:true})){
    const path=join(dir,item.name);if(item.isDirectory())await collect(path);else if(/\.(?:js|mjs|py)$/.test(item.name))paths.push(path);
  }}
  await collect('src');await collect('scripts');return paths.sort();
}
async function hashSourcesV10(){const hashes={};for(const path of await sourcePathsV10())hashes[path]=sha256(await readFile(join(ROOT,path)));return hashes;}

/** Freeze is deliberately separate from run. It creates no prospective orders. */
export async function freezeExperimentV10(destination){
  const target=resolve(destination);await assertNewOutputV10(target);
  const protocolBytes=await readFile(join(ROOT,'data/protocol-v10.json')),protocol=validateProtocolV10(JSON.parse(protocolBytes));
  // Every factory must exist before freeze; an incomplete implementation cannot
  // accidentally create a nominally frozen, unusable experiment.
  for(const path of ['src/adaptive-planner-v9.js','scripts/highs-planner-v8.mjs','scripts/highs-planner-v10.mjs'])await access(join(ROOT,path));
  const implementationHashes=await hashSourcesV10();
  if(implementationHashes['scripts/benchmark-v2.mjs']!==protocol.generator.implementationSHA256)throw new Error('Unchanged generator implementation differs from protocol.');
  const manifest={schemaVersion:'portplan-v10-frozen-source',frozenAt:new Date().toISOString(),protocolHash:sha256(protocolBytes),protocol,
    implementationHashes,scenarioMetadata:enumerateCasesV10(protocol),generatedProspectiveInputs:false,environment:await environmentV10()};
  await mkdir(dirname(target),{recursive:true});await mkdir(target,{recursive:false});
  for(const path of Object.keys(implementationHashes)){const destination=join(target,'source',path);await mkdir(dirname(destination),{recursive:true});await copyFile(join(ROOT,path),destination);}
  await writeFile(join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return manifest;
}

export async function loadFrozenExperimentV10(directory){
  const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
  if(manifest.schemaVersion!=='portplan-v10-frozen-source')throw new Error('Not a V10 frozen source manifest.');
  validateProtocolV10(manifest.protocol);
  if(JSON.stringify(await hashSourcesV10())!==JSON.stringify(manifest.implementationHashes))throw new Error('Live source differs from frozen hashes; no prospective execution is permitted.');
  const protocolBytes=await readFile(join(ROOT,'data/protocol-v10.json'));
  if(sha256(protocolBytes)!==manifest.protocolHash)throw new Error('Frozen protocol bytes changed.');
  for(const [path,expected]of Object.entries(manifest.implementationHashes))if(sha256(await readFile(join(directory,'source',path)))!==expected)throw new Error(`Frozen source snapshot changed: ${path}`);
  if(JSON.stringify(enumerateCasesV10(manifest.protocol))!==JSON.stringify(manifest.scenarioMetadata))throw new Error('Frozen scenario declarations changed.');
  return manifest;
}

/** Only scalar/counter receipts stay in memory. Full histories, all dates,
 * observations, proofs and failures are separately append-only episode files. */
export function compactEpisodeReceiptV10(result,artifact){
  const keys=['policy','status','complete','auditValid','executionHistoryUnavailable','revisionCount','failure','startupWallMs',
    'hardWallMs','wallTimeMs','actualCutoffMs','processExitWallTimeMs','finalReceivedMs','receiptValidatedMs','rejectedTerminalCount','rejectedTerminalErrors',
    'deadlineReached','outputDeliveredWithinBudget','episodeCompletedWithinBudget','endToEndCompletedWithinBudget','exitCode','exitSignal',...FEE_FIELDS];
  return {...Object.fromEntries(keys.filter(key=>Object.hasOwn(result,key)).map(key=>[key,result[key]])),
    plannerStats:result.plannerStats?Object.fromEntries(Object.entries(result.plannerStats).filter(([,value])=>value===null||typeof value!=='object')):null,
    scalarReceipt:true,terminalRowCount:result.rows?.length??0,artifact};
}

export async function runFrozenExperimentV10(frozenDirectory,outputDirectory){
  const frozen=resolve(frozenDirectory),manifest=await loadFrozenExperimentV10(frozen),protocol=manifest.protocol;
  const output=resolve(outputDirectory??join(frozen,'first-run'));await assertNewOutputV10(output);
  // Formal inputs are first generated below, after frozen hashes and output
  // exclusivity have passed. Importing the module is not input generation.
  const {makeScenarioV2}=await import(pathToFileURL(join(frozen,'source/scripts/benchmark-v2.mjs')).href);
  await mkdir(dirname(output),{recursive:true});await mkdir(output,{recursive:false});await mkdir(join(output,'inputs'));await mkdir(join(output,'episodes'));
  const state={schemaVersion:'portplan-v10-streamed-experiment',protocolHash:manifest.protocolHash,frozenSource:relative(output,frozen),
    implementationHashes:manifest.implementationHashes,protocol,startedAt:new Date().toISOString(),environment:await environmentV10(),
    executionState:'running',cases:[],summary:null,limitations:protocol.analysisRules};
  await writeFile(join(output,'run.json'),JSON.stringify(state,null,2)+'\n',{flag:'wx'});
  await writeFile(join(output,'episodes.ndjson'),'',{flag:'wx'});
  const allOrderFingerprints=new Map(),duplicateOrderLists=[];
  const save=async()=>{state.updatedAt=new Date().toISOString();
    const inferential=state.executionState==='complete';
    state.summary={...summarizeExperimentV10(state.cases,{bootstrap:inferential?protocol.analysis.bootstrap:{...protocol.analysis.bootstrap,draws:0}}),
      inferentialState:inferential?'complete-scenario-cluster-bootstrap':'pending-until-complete-run'};
    const next=join(output,'run.checkpoint.json');await writeFile(next,JSON.stringify(state,null,2)+'\n');};
  for(const [scenarioIndex,config]of manifest.scenarioMetadata.entries()){
    const nominalScenario=makeScenarioV2(config),events=realizeDeclaredShocksV7(nominalScenario,config.shocks);
    const fingerprint=sha256(JSON.stringify(nominalScenario.containers.map(({id,...row})=>row)));
    if(allOrderFingerprints.has(fingerprint))duplicateOrderLists.push({id:config.id,duplicateOf:allOrderFingerprints.get(fingerprint),sha256:fingerprint});
    else allOrderFingerprints.set(fingerprint,config.id);
    const bytes=JSON.stringify({config,nominalScenario,events},null,2)+'\n',inputPath=`inputs/${config.id}.json`;
    await writeFile(join(output,inputPath),bytes,{flag:'wx'});
    const c={...config,inputArtifact:{path:inputPath,sha256:sha256(bytes)},orderFingerprint:fingerprint,repeats:[]};state.cases.push(c);
    for(const [repeatIndex,repeat]of protocol.algorithmRepeats.entries()){
      const order=executionOrderV10(scenarioIndex,repeatIndex),record={repeatIndex:repeatIndex+1,algorithmSeed:repeat.seed,methodExecutionOrder:order,policies:{}};
      c.repeats.push(record);
      for(const method of order){
        const episodeId=`${config.id}--a${repeatIndex+1}--${method}`;
        const result=await runColdEpisodeV10({episodeId,nominalScenario,events,method,algorithmSeed:repeat.seed,repeatIndex:repeatIndex+1,callBudgets:protocol.callBudgets},
          {hardWallMs:protocol.budget.hardWallMs,workerScript:join(frozen,'source/scripts/episode-v10.worker.mjs')});
        const resultBytes=JSON.stringify({episodeId,caseId:config.id,scenarioId:config.id,panel:config.panel,repeat:repeatIndex+1,repeatIndex:repeatIndex+1,algorithmSeed:repeat.seed,method,result},null,2)+'\n';
        const path=`episodes/${episodeId}.json`,artifact={path,sha256:sha256(resultBytes)};
        await writeFile(join(output,path),resultBytes,{flag:'wx'});
        const receipt=compactEpisodeReceiptV10(result,artifact);record.policies[method]=receipt;
        await appendFile(join(output,'episodes.ndjson'),JSON.stringify({episodeId,scenarioId:config.id,panel:config.panel,repeatIndex:repeatIndex+1,algorithmSeed:repeat.seed,method,receipt})+'\n');
        console.log(`${config.panel} ${episodeId}: ${result.status}; complete=${result.complete}; historyUnknown=${result.executionHistoryUnavailable}; total=${result.totalCost}`);
      }
      await save();
    }
  }
  state.duplicateOrderLists=duplicateOrderLists;state.executionState='complete';await save();
  await writeFile(join(output,'complete.json'),JSON.stringify({...state,completedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
  return {output,summary:state.summary};
}

function option(args,name){const index=args.indexOf(name);if(index<0)return null;const value=args[index+1];if(!value||value.startsWith('--'))throw new Error(`${name} requires a value.`);return value;}
async function main(){
  const args=process.argv.slice(2);
  if(args.includes('--inspect')){
    const protocol=validateProtocolV10(JSON.parse(await readFile(join(ROOT,'data/protocol-v10.json'),'utf8')));
    console.log(JSON.stringify({state:'declaration-only-no-inputs-generated',caseMetadata:enumerateCasesV10(protocol),episodeCount:144*3*5},null,2));return;
  }
  if(args.includes('--freeze')){
    const output=option(args,'--output')??join(ROOT,'artifacts',`v10-frozen-${new Date().toISOString().replace(/[:.]/g,'-')}`);
    const manifest=await freezeExperimentV10(output);console.log(JSON.stringify({frozenDirectory:resolve(output),protocolHash:manifest.protocolHash,generatedInputs:false},null,2));return;
  }
  if(args.includes('--run')){
    const frozen=option(args,'--frozen');if(!frozen)throw new Error('--run requires --frozen PATH. Freeze and review source/protocol before prospective execution.');
    console.log(JSON.stringify(await runFrozenExperimentV10(frozen,option(args,'--output')),null,2));return;
  }
  throw new Error('Choose --inspect (metadata only), --freeze [--output PATH], or --run --frozen PATH [--output NEW_PATH]. No holdout inputs were generated.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();


