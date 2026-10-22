import {readFile,writeFile,mkdir,access,readdir,copyFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {cpus,totalmem,platform,release,arch} from 'node:os';
import {resolve,dirname,relative,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {METHODS_V14} from './episode-v14.worker.mjs';
import {isCompleteV12,runColdEpisodeV12,compactEpisodeReceiptV12,initializationEvidenceV12,validateCompleteReceiptV12,
  FIXED_CALL_BUDGETS_V12,FIXED_MATRIX_V12,FIXED_PARENT_ACCEPTANCE_V12,FIXED_COMPARISONS_V12,collectDeclaredSeedsV12,assertNewOutputV12} from './benchmark-v12.mjs';
import {realizeDeclaredShocksV7} from './rolling-benchmark-v7.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const execFileAsync=promisify(execFile),EPS=1e-6;
const ORIGINAL_V12_PROTOCOL=JSON.parse(await readFile(new URL('../data/protocol-v12.json',import.meta.url)));
export {METHODS_V14};
// The cold clock, parent physical receipt audit and lifecycle acceptance retain
// every frozen V12 byte; only a new allow-listed worker is selected at runtime.
export const isCompleteV14=isCompleteV12,runColdEpisodeV14=runColdEpisodeV12,compactEpisodeReceiptV14=compactEpisodeReceiptV12,
  initializationEvidenceV14=initializationEvidenceV12,validateCompleteReceiptV14=validateCompleteReceiptV12,assertNewOutputV14=assertNewOutputV12;
export const sha256=value=>createHash('sha256').update(value).digest('hex');
export const FIXED_CALL_BUDGETS_V14=Object.freeze({...structuredClone(FIXED_CALL_BUDGETS_V12),guardedHiGHSV13:structuredClone(FIXED_CALL_BUDGETS_V12.seededHiGHSV12)});
export const FIXED_MATRIX_V14=FIXED_MATRIX_V12;
export const FIXED_COMPARISONS_V14=Object.freeze({v13VsV12:['seededHiGHSV12','guardedHiGHSV13'],v13VsV11:['commitmentHiGHSV11','guardedHiGHSV13'],
  v13VsV10:['stableHiGHSV10','guardedHiGHSV13'],v13VsV9:['adaptiveV9','guardedHiGHSV13'],v13VsHiGHS:['highsV8','guardedHiGHSV13'],v13VsV7:['costPolishV7','guardedHiGHSV13'],
  ...structuredClone(FIXED_COMPARISONS_V12)});
const FIXED_REPEATS_V14=[{index:1,seed:79011},{index:2,seed:79023},{index:3,seed:79039}];
export function canonicalJSONV14(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('Non-finite protocol/evidence value.');return JSON.stringify(value);}
  if(Array.isArray(value))return '['+value.map(canonicalJSONV14).join(',')+']';
  if(!value||typeof value!=='object')throw new Error('Evidence must contain finite JSON values.');
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJSONV14(value[key])).join(',')+'}';
}
const same=(a,b)=>canonicalJSONV14(a)===canonicalJSONV14(b);

/** Pure declarations only. No synthetic order generator is invoked here. */
export function enumerateCasesV14(protocol){
  const cases=[],ids=new Set(),seeds=new Set();
  for(const panel of protocol.panels){
    let index=0;
    for(const mechanism of protocol.matrix.mechanisms)for(const capacityProfile of protocol.matrix.capacityProfiles)
      for(const count of protocol.matrix.counts)for(let repeat=1;repeat<=protocol.matrix.scenariosPerCell;repeat++){
        const pattern=panel.shockPatterns[(repeat-1)%panel.shockPatterns.length];
        const config={id:`v14-${panel.id}-${mechanism}-${capacityProfile}-n${count}-r${repeat}`,panel:panel.id,dataRole:'held-out',
          mechanism,capacityProfile,count,scenarioRepeat:repeat,seed:panel.baseSeed+index++,shockPattern:pattern.name,shocks:structuredClone(pattern.shocks)};
        if(ids.has(config.id)||seeds.has(config.seed))throw new Error('V14 identifiers and generator seeds must be unique.');
        ids.add(config.id);seeds.add(config.seed);cases.push(config);
      }
    if(index!==panel.scenarioCount)throw new Error('Panel scenario count differs from its declared matrix.');
  }
  return cases;
}
export const collectDeclaredSeedsV14=collectDeclaredSeedsV12;
export async function verifyHistoricalSeedExclusionsV14(protocol){
  const declared=protocol.historicalSeedExclusions,seeds=new Set(),seen=new Set();
  if(!Array.isArray(declared?.sources)||!declared.sources.length)throw new Error('Missing historical seed source bindings.');
  for(const source of declared.sources){
    if(!(['data/benchmark.json','data/benchmark-v4.json'].includes(source.path)||/^data\/[A-Za-z0-9_-]*protocol[A-Za-z0-9_-]*\.json$/.test(source.path))
      ||source.path==='data/protocol-v14.json'||seen.has(source.path))throw new Error('Unsafe/duplicate historical seed source.');
    seen.add(source.path);const raw=await readFile(join(ROOT,source.path));
    if(sha256(raw)!==source.sha256)throw new Error('Historical seed source hash differs: '+source.path);
    for(const seed of collectDeclaredSeedsV14(JSON.parse(raw)))seeds.add(seed);
  }
  if(!same([...seeds].sort((a,b)=>a-b),declared.excludedSeeds))throw new Error('Historical seed exclusion set differs.');
  return {metadataSourceCount:seen.size,excludedSeedCount:seeds.size};
}
export function validateProtocolV14(protocol){
  canonicalJSONV14(protocol);
  if(protocol.schemaVersion!=='portplan-protocol-v14'||!same(protocol.methods,METHODS_V14))throw new Error('V14 must declare the seven fixed methods.');
  if(!['draft-development-not-ready','ready-for-source-freeze'].includes(protocol.executionAuthorization?.status))throw new Error('Explicit V14 preregistration state required.');
  if(protocol.budget.hardWallMs!==5000||protocol.budget.cpuThreads!==1||!same(protocol.budget.parentAcceptance,FIXED_PARENT_ACCEPTANCE_V12))throw new Error('V14 retains complete V12 5000ms lifecycle acceptance and one thread.');
  if(!same(protocol.callBudgets,FIXED_CALL_BUDGETS_V14))throw new Error('Fixed baseline and V13 200/40/5/3 budgets must not drift or enable development imports/observers.');
  if(!same(protocol.algorithmRepeats,FIXED_REPEATS_V14)||!same(protocol.matrix,FIXED_MATRIX_V14))throw new Error('V14 repeats or 144-case matrix drifted.');
  if(!same(protocol.analysis.comparisons,FIXED_COMPARISONS_V14))throw new Error('V14 prespecified 14 comparison pairs differ.');
  if(protocol.analysis.bootstrap.seed!==800001||protocol.analysis.bootstrap.draws!==2000)throw new Error('V14 bootstrap remains 2000 draws with seed 800001.');
  if(protocol.panels.length!==2||protocol.panels[0]?.id!=='same-distribution'||protocol.panels[0]?.baseSeed!==791001||protocol.panels[1]?.id!=='stress'||protocol.panels[1]?.baseSeed!==792001)throw new Error('V14 fresh business seed declarations differ.');
  for(const [index,panel]of protocol.panels.entries())if(panel.scenarioCount!==72||!same(panel.shockPatterns,ORIGINAL_V12_PROTOCOL.panels[index].shockPatterns))throw new Error('V14 keeps the original two 72-case shock catalogs.');
  if(protocol.initialization?.mode!=='natural-from-day-zero'||protocol.initialization.forcedEndpointImports!==false)throw new Error('V14 requires natural full-D0 policy initialization without endpoint imports.');
  if(protocol.sampling?.freshBusinessScenarios!==true)throw new Error('V14 requires fresh business scenarios.');
  if(protocol.executionAuthorization.requiresCommittedSource!==true||protocol.executionAuthorization.requiresPushedSource!==true||protocol.executionAuthorization.requiresRootExplicitRunAuthorization!==true||protocol.executionAuthorization.generationAllowedByProtocolAlone!==false)throw new Error('V14 generation requires committed/pushed frozen source and separate explicit root runtime authorization.');
  if(!protocol.frozenAlgorithmBindings||Object.keys(protocol.frozenAlgorithmBindings).length<25)throw new Error('Frozen method and transitive implementation bindings are required.');
  for(const [path,digest]of Object.entries(protocol.frozenAlgorithmBindings))if(!/^(src|scripts)\/[A-Za-z0-9_./-]+$/.test(path)||path.split('/').includes('..')||!/^[a-f0-9]{64}$/.test(digest))throw new Error('Unsafe frozen algorithm binding.');
  const excluded=protocol.historicalSeedExclusions?.excludedSeeds;
  if(!Array.isArray(excluded)||new Set(excluded).size!==excluded.length||!excluded.every(Number.isInteger))throw new Error('Explicit unique historical seed exclusions required.');
  const cases=enumerateCasesV14(protocol);
  if(cases.length!==144||cases.some(row=>excluded.includes(row.seed))||protocol.algorithmRepeats.some(row=>excluded.includes(row.seed)))throw new Error('V14 business/repeat seeds overlap prior evidence or matrix differs.');
  if(protocol.generator.implementationSHA256!==ORIGINAL_V12_PROTOCOL.generator.implementationSHA256)throw new Error('V14 must retain the frozen generator bytes.');
  return protocol;
}
export function assertReadyForFreezeV14(protocol){if(protocol.executionAuthorization?.status!=='ready-for-source-freeze')throw new Error('V14 is still draft: root must finalize independent review and authorize source freeze.');}
export function executionOrderV14(scenarioIndex,repeatIndex){const start=(scenarioIndex+repeatIndex)%METHODS_V14.length;return METHODS_V14.map((_,offset)=>METHODS_V14[(start+offset)%METHODS_V14.length]);}

const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const sum=values=>values.reduce((total,value)=>total+value,0);
const classification=value=>value>EPS?'win':value< -EPS?'loss':'tie';
function quantile(sorted,p){if(!sorted.length)return null;const x=(sorted.length-1)*p,low=Math.floor(x);return sorted[low]+(sorted[Math.ceil(x)]-sorted[low])*(x-low);}
/** Cluster bootstrap: each draw resamples whole business scenarios, retaining
 * every predeclared repeat together. Three runs are not three new scenarios. */
export function pairedBootstrapV14(units,{seed=800001,draws=2000}={}){
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
      const b=repetition.policies[baseline],a=repetition.policies[candidate],bc=isCompleteV14(b),ac=isCompleteV14(a);
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
      uncertainty:pairedBootstrapV14(units.map(u=>u[name]),bootstrap)};
  }
  const revisions=allPairs.filter(p=>Number.isFinite(p.baseline.revisionCount)&&Number.isFinite(p.candidate.revisionCount));
  return {baselineMethod:baseline,candidateMethod:candidate,scenarioCount:cases.length,episodePairCount:sum(cases.map(c=>c.repeats.length)),
    completion:{gainedEpisodeCount:gained,lostEpisodeCount:lost,gainedEpisodeIds:gainIds,lostEpisodeIds:lossIds,
      gainedFromKnownFailureEpisodeIds:knownFailureGainIds,gainedFromUnknownHistoryEpisodeIds:unknownHistoryGainIds,
      meanScenarioRateGain:mean(completionUnits.map(u=>u.candidate)),
      uncertainty:{unit:'scenario completion-rate difference',
        meanScenarioRateGain95CI:pairedBootstrapV14(completionUnits.map(u=>({baseline:0,candidate:-u.candidate})),bootstrap).meanSavings95CI},
      interpretation:'Timely complete audited receipts; an unavailable history is not proof of physical execution failure.'},
    fees,revisions:{pairedEpisodeCount:revisions.length,baselineObservedSum:sum(revisions.map(p=>p.baseline.revisionCount)),candidateObservedSum:sum(revisions.map(p=>p.candidate.revisionCount))},
    pairedScenarios:units.map(u=>({scenarioId:u.scenarioId,pairedRepeatCount:u.pairedRepeatCount,totalSavingsKRW:u.total.baseline-u.total.candidate,
      incrementalSavingsKRW:u.incremental.baseline-u.incremental.candidate})),
    interpretation:'Each scenario has equal weight after averaging matching jointly completed repeats. Each comparison has its own eligibility set; do not rank methods across denominators.'};
}

/** One eligibility set for all seven methods. Do not mix these denominators
 * with pairwise tables or convert event revisions into invented fee weights. */
export function jointCompleteParetoV14(cases,fullSampleByMethod={}){
  const scenarios=[],allPairs=[];
  for(const c of cases){
    const repeats=c.repeats.filter(r=>METHODS_V14.every(method=>isCompleteV14(r.policies[method])));
    if(!repeats.length)continue;
    allPairs.push(...repeats);
    scenarios.push({scenarioId:c.id,pairedRepeatCount:repeats.length,byMethod:Object.fromEntries(METHODS_V14.map(method=>{
      const values=repeats.map(r=>r.policies[method]),known=values.every(r=>Number.isFinite(r.revisionCount));
      return [method,{totalCost:mean(values.map(r=>r.totalCost)),incrementalCost:mean(values.map(r=>r.incrementalCost)),
        revisionCount:known?mean(values.map(r=>r.revisionCount)):null}];
    }))});
  }
  const byMethod=Object.fromEntries(METHODS_V14.map(method=>{
    const values=allPairs.map(r=>r.policies[method]),known=values.filter(r=>Number.isFinite(r.revisionCount)),has=scenarios.length>0,allKnown=has&&known.length===values.length;
    return [method,{scenarioCount:scenarios.length,jointEpisodeCount:allPairs.length,
      scenarioMeanTotalCostSumKRW:has?sum(scenarios.map(s=>s.byMethod[method].totalCost)):null,
      scenarioMeanIncrementalCostSumKRW:has?sum(scenarios.map(s=>s.byMethod[method].incrementalCost)):null,
      scenarioMeanRevisionCountSum:allKnown?sum(scenarios.map(s=>s.byMethod[method].revisionCount)):null,
      episodeTotalCostSumKRW:has?sum(values.map(r=>r.totalCost)):null,episodeIncrementalCostSumKRW:has?sum(values.map(r=>r.incrementalCost)):null,
      episodeRevisionCountSum:allKnown?sum(known.map(r=>r.revisionCount)):null,knownRevisionEpisodeCount:known.length,unknownRevisionEpisodeCount:values.length-known.length,
      fullSampleCompleteEpisodeCount:fullSampleByMethod[method]?.completeEpisodeCount??cases.reduce((n,c)=>n+c.repeats.filter(r=>isCompleteV14(r.policies[method])).length,0),
      fullSampleEpisodeCount:fullSampleByMethod[method]?.recordedEpisodeCount??cases.reduce((n,c)=>n+c.repeats.filter(r=>r.policies[method]).length,0)}];
  }));
  const frontier=feeKey=>METHODS_V14.map(method=>{
    const current=byMethod[method],comparable=scenarios.length>0&&Number.isFinite(current[feeKey])&&Number.isFinite(current.scenarioMeanRevisionCountSum);
    const dominates=(left,right)=>Number.isFinite(left[feeKey])&&Number.isFinite(left.scenarioMeanRevisionCountSum)
      &&Number.isFinite(right[feeKey])&&Number.isFinite(right.scenarioMeanRevisionCountSum)
      &&left[feeKey]<=right[feeKey]+EPS&&left.scenarioMeanRevisionCountSum<=right.scenarioMeanRevisionCountSum+EPS
      &&(left[feeKey]<right[feeKey]-EPS||left.scenarioMeanRevisionCountSum<right.scenarioMeanRevisionCountSum-EPS);
    const worse=comparable?METHODS_V14.filter(other=>other!==method&&dominates(current,byMethod[other])):[];
    const better=comparable?METHODS_V14.filter(other=>other!==method&&dominates(byMethod[other],current)):[];
    return {method,dominates:worse,dominatedBy:better,pareto:comparable?better.length===0:null};
  });
  return {jointScenarioCount:scenarios.length,jointEpisodeCount:allPairs.length,eligibility:'all-seven-matching-complete-repeats',byMethod,
    frontiers:{totalAndRevisions:frontier('scenarioMeanTotalCostSumKRW'),incrementalAndRevisions:frontier('scenarioMeanIncrementalCostSumKRW')},scenarios,
    scope:'Conditional all-seven jointly completed matching repeats; average within scenario then equal scenario weight. No revision-to-KRW conversion. This table never overrides full-sample completion losses or establishes universal dominance.'};
}

/** Prespecified necessary observation gates, never a production recommendation. */
export function observedDecisionGatesV14(comparisons,{completePanel=false}={}){
  const names={seededHiGHSV12:'v13VsV12',commitmentHiGHSV11:'v13VsV11',stableHiGHSV10:'v13VsV10',adaptiveV9:'v13VsV9',highsV8:'v13VsHiGHS',costPolishV7:'v13VsV7'};
  const completionLossCountsByBaseline=Object.fromEntries(Object.entries(names).map(([method,key])=>[method,comparisons[key].completion.lostEpisodeCount]));
  const completionGainCountsByBaseline=Object.fromEntries(Object.entries(names).map(([method,key])=>[method,comparisons[key].completion.gainedEpisodeCount]));
  const completionNonRegressionAllBaselines=Object.values(completionLossCountsByBaseline).every(count=>count===0);
  const nativeComparisons={};
  for(const method of ['seededHiGHSV12','commitmentHiGHSV11','stableHiGHSV10','highsV8']){
    const pair=comparisons[names[method]],revision=pair.revisions,feeCount=pair.fees.incremental.pairedEpisodeCount;
    const known=feeCount>0&&revision.pairedEpisodeCount===feeCount;
    const revisionDelta=known?revision.candidateObservedSum-revision.baselineObservedSum:null;
    const claim=fee=>{const ci=fee.uncertainty.weightedSavingsPct95CI;return !ci||ci.some(v=>!Number.isFinite(v))?'unavailable':ci[0]>0?'conditional_savings_interval_positive':ci[1]<0?'conditional_deterioration_interval_negative':'no_stable_advantage';};
    const incrementalFeeClaim=claim(pair.fees.incremental),totalFeeClaim=claim(pair.fees.total);
    const noRobustFeeDeterioration=[incrementalFeeClaim,totalFeeClaim].every(value=>value!=='unavailable'&&value!=='conditional_deterioration_interval_negative');
    const strictRevisionReduction=known&&revisionDelta<0;
    nativeComparisons[method]={lostEpisodeCount:pair.completion.lostEpisodeCount,revisionPairedEpisodeCount:revision.pairedEpisodeCount,
      revisionDelta,strictRevisionReduction,incrementalFeeClaim,totalFeeClaim,noRobustFeeDeterioration,
      stabilityImprovementClaimAllowed:completePanel&&pair.completion.lostEpisodeCount===0&&strictRevisionReduction&&noRobustFeeDeterioration};
  }
  return {candidateMethod:'guardedHiGHSV13',assessmentState:completePanel?'complete-panel':'partial-panel',completionLossCountsByBaseline,
    completionGainCountsByBaseline,completionNonRegressionAllBaselines,defaultRecommendationEligible:completePanel&&completionNonRegressionAllBaselines,
    nativeComparison:nativeComparisons.highsV8,nativeComparisons,
    scope:'Observed necessary gates against the six included comparators only. Any full-sample completion loss blocks default eligibility; net gains and conditional fees/Pareto position do not offset losses. Native stability claims use each exact native paired set; zero-inclusive fee intervals do not prove stable savings. No claim against omitted V5 or universal/production recommendation.'};
}

export function summarizePanelV14(cases,{bootstrap={}}={}){
  const byMethod={};
  for(const method of METHODS_V14){
    const results=cases.flatMap(c=>c.repeats.map(r=>r.policies[method])).filter(Boolean),statuses={};for(const r of results)statuses[r.status]=(statuses[r.status]??0)+1;
    const values=key=>results.map(r=>r[key]).filter(Number.isFinite);
    const initialization=results.map(result=>result.initializationEvidence??initializationEvidenceV14(result));
    byMethod[method]={scenarioCount:cases.length,recordedEpisodeCount:results.length,completeEpisodeCount:results.filter(isCompleteV14).length,
      initialization:{knownDayZeroCount:initialization.filter(entry=>entry.initialPlanAccepted!==null).length,
        acceptedInitialPlanCount:initialization.filter(entry=>entry.initialPlanAccepted===true).length,
        knownInitialFailureCount:initialization.filter(entry=>entry.failurePhase==='initialization').length,
        knownLaterFailureCount:initialization.filter(entry=>entry.failurePhase==='after_initialization').length,
        unknownDayZeroCount:initialization.filter(entry=>entry.initialPlanAccepted===null).length},
      fullyCompletedScenarioCount:cases.filter(c=>c.repeats.length===3&&c.repeats.every(r=>isCompleteV14(r.policies[method]))).length,
      anyCompletedScenarioCount:cases.filter(c=>c.repeats.some(r=>isCompleteV14(r.policies[method]))).length,
      meanScenarioCompletionRate:mean(cases.map(c=>mean(c.repeats.map(r=>Number(isCompleteV14(r.policies[method])))))),
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
  const comparisons=Object.fromEntries(Object.entries(FIXED_COMPARISONS_V14).map(([key,[baseline,candidate]])=>[key,compareMethods(cases,baseline,candidate,bootstrap)]));
  const jointCompletePareto=jointCompleteParetoV14(cases,byMethod);
  const allMethodCommonComplete={scenarioCount:jointCompletePareto.jointScenarioCount,episodeCount:jointCompletePareto.jointEpisodeCount,
    byMethod:Object.fromEntries(METHODS_V14.map(method=>{const row=jointCompletePareto.byMethod[method];return [method,{
      totalScenarioMeanSumKRW:row.scenarioMeanTotalCostSumKRW,incrementalScenarioMeanSumKRW:row.scenarioMeanIncrementalCostSumKRW,
      revisionObservedSum:row.episodeRevisionCountSum}];})),scope:jointCompletePareto.scope+' Thin-table revisionObservedSum is the raw matched-episode count; frontier revision axis uses scenarioMeanRevisionCountSum instead.'};
  const completePanel=cases.length===72&&cases.every(c=>c.repeats.length===3&&c.repeats.every(r=>METHODS_V14.every(method=>r.policies[method])));
  return {scenarioCount:cases.length,byMethod,comparisons,jointCompletePareto,allMethodCommonComplete,
    observedDecisionGates:observedDecisionGatesV14(comparisons,{completePanel})};
}

export function summarizeExperimentV14(cases,options={}){
  return {statisticalUnit:'scenario',recordedScenarioCount:cases.length,
    panels:Object.fromEntries([...new Set(cases.map(c=>c.panel))].map(panel=>[panel,summarizePanelV14(cases.filter(c=>c.panel===panel),options)])),
    interpretation:'Panels remain separate. All three repeats are retained; repeated seeds/timing runs do not increase the number of business scenarios. No pooled leaderboard.'};
}

async function environmentV14(){
  const cgroup={};for(const path of ['/sys/fs/cgroup/cpu.max','/sys/fs/cgroup/memory.max'])try{cgroup[path]=(await readFile(path,'utf8')).trim();}catch{cgroup[path]='unavailable';}
  return {node:process.version,platform:platform(),release:release(),arch:arch(),hostLogicalCPUs:cpus().length,cpuModel:cpus()[0]?.model,
    hostMemoryBytes:totalmem(),cgroupLimits:cgroup,nativeThreadEnvironment:{OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1',NUMEXPR_NUM_THREADS:'1'}};
}
export async function verifyFrozenAlgorithmsV14(protocol,{rootDirectory=ROOT}={}){
  for(const [path,digest]of Object.entries(protocol.frozenAlgorithmBindings))if(sha256(await readFile(join(rootDirectory,path)))!==digest)throw new Error('Previously frozen algorithm bytes differ: '+path);
  return {boundFileCount:Object.keys(protocol.frozenAlgorithmBindings).length,unchanged:true};
}
async function sourcePathsV14(protocol){
  const paths=['AGENTS.md','package.json','package-lock.json','data/protocol-v2.json','data/protocol-v12.json','data/protocol-v14.json'];
  for(const name of await readdir(ROOT))if(/^requirements[^/]*\.txt$/.test(name))paths.push(name);
  for(const source of protocol.historicalSeedExclusions.sources)paths.push(source.path);
  async function collect(directory){for(const entry of await readdir(join(ROOT,directory),{withFileTypes:true})){
    const path=directory+'/'+entry.name;if(entry.isDirectory())await collect(path);else if(/\.(js|mjs|py)$/.test(entry.name))paths.push(path);
  }}
  await collect('src');await collect('scripts');return [...new Set(paths)].sort();
}
async function hashSourcesV14(protocol){const hashes={};for(const path of await sourcePathsV14(protocol))hashes[path]=sha256(await readFile(join(ROOT,path)));return hashes;}
export function gitBlobHashV14(bytes,format='sha1'){
  if(!['sha1','sha256'].includes(format))throw new Error('Unsupported Git object format.');
  const buffer=Buffer.from(bytes);return createHash(format).update('blob '+buffer.length+'\0').update(buffer).digest('hex');
}
/** Actual committed-file verification is distinct from SHA256 byte integrity.
 * The optional root is a small isolated Git-fixture seam, never a CLI bypass. */
export async function verifyCommittedSourcesV14(implementationHashes,{rootDirectory=ROOT,sourceGitCommit=null}={}){
  const git=async args=>(await execFileAsync('git',args,{cwd:rootDirectory,encoding:'buffer',maxBuffer:32*1024*1024})).stdout;
  const gitObjectFormat=(await git(['rev-parse','--show-object-format'])).toString().trim();
  if(!['sha1','sha256'].includes(gitObjectFormat))throw new Error('Unsupported committed source object format.');
  const commit=sourceGitCommit??(await git(['rev-parse','HEAD'])).toString().trim();
  if(!new RegExp('^[a-f0-9]{'+(gitObjectFormat==='sha1'?40:64)+'}$').test(commit))throw new Error('A full source Git commit is required.');
  const sourceGitTree=(await git(['rev-parse',commit+'^{tree}'])).toString().trim(),tree=new Map();
  for(const record of (await git(['ls-tree','--full-tree','-r','-z',commit])).toString().split('\0')){
    if(!record)continue;const match=/^(\d+) (\w+) ([a-f0-9]+)\t(.+)$/.exec(record);if(match)tree.set(match[4],{mode:match[1],type:match[2],hash:match[3]});
  }
  const committedBlobHashes={};
  for(const [path,digest]of Object.entries(implementationHashes)){
    if(path.startsWith('/')||path.includes('\\')||path.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Unsafe committed source path.');
    const raw=await readFile(join(rootDirectory,path));if(sha256(raw)!==digest)throw new Error('Source changed before committed-blob verification: '+path);
    const entry=tree.get(path);if(!entry||entry.type!=='blob'||!['100644','100755'].includes(entry.mode)||gitBlobHashV14(raw,gitObjectFormat)!==entry.hash)throw new Error('Runtime/protocol source must first be committed without byte changes: '+path);
    committedBlobHashes[path]=entry.hash;
  }
  return {sourceGitCommit:commit,sourceGitTree,gitObjectFormat,committedBlobHashes,sourceCommitVerified:true,
    scope:'Local Git object and source-byte verification at freeze/run. The commit is a provenance identifier, not a remote signature or third-party endorsement.'};
}
export function validateSourcePushReceiptV14(receipt,sourceGitCommit){
  const keys=['schemaVersion','sourceGitCommit','remoteName','branch','observedRemoteCommit','verifiedAt','verification'];
  if(!same(Object.keys(receipt).sort(),keys.sort())||receipt.schemaVersion!=='portplan-v14-root-verified-source-push'
    ||receipt.sourceGitCommit!==sourceGitCommit||receipt.observedRemoteCommit!==sourceGitCommit||receipt.remoteName!=='origin'||receipt.branch!=='main'
    ||typeof receipt.verifiedAt!=='string'||!receipt.verifiedAt.endsWith('Z')||!Number.isFinite(Date.parse(receipt.verifiedAt))
    ||receipt.verification!=='git push then authenticated git ls-remote exact branch; root observation, not external attestation')throw new Error('A matching root-observed authenticated source-push receipt is required.');
  return receipt;
}

/** No prospective order generation occurs during freeze. Draft protocols and
 * uncommitted files fail before exclusive output-directory creation. */
export async function freezeExperimentV14(destination,{pushReceiptPath,rejectionTestProtocolPath}={}){
  const target=resolve(destination);await assertNewOutputV14(target);
  const protocolBytes=await readFile(rejectionTestProtocolPath??join(ROOT,'data/protocol-v14.json')),protocol=validateProtocolV14(JSON.parse(protocolBytes));
  assertReadyForFreezeV14(protocol);
  if(rejectionTestProtocolPath!==undefined)throw new Error('Rejection-only fixture protocol cannot authorize a real V14 freeze.');
  await verifyHistoricalSeedExclusionsV14(protocol);const frozenAlgorithmVerification=await verifyFrozenAlgorithmsV14(protocol);
  const implementationHashes=await hashSourcesV14(protocol),gitEvidence=await verifyCommittedSourcesV14(implementationHashes);
  if(!pushReceiptPath)throw new Error('V14 freeze requires --push-receipt PATH from the separately verified root push.');
  const pushReceiptBytes=await readFile(pushReceiptPath),pushReceipt=validateSourcePushReceiptV14(JSON.parse(pushReceiptBytes),gitEvidence.sourceGitCommit);
  if(implementationHashes['scripts/benchmark-v2.mjs']!==protocol.generator.implementationSHA256)throw new Error('Frozen generator differs from protocol.');
  const manifest={schemaVersion:'portplan-v14-frozen-source',frozenAt:new Date().toISOString(),protocolHash:sha256(protocolBytes),protocol,
    implementationHashes,...gitEvidence,sourcePushReceipt:{path:'source-push-receipt.json',sha256:sha256(pushReceiptBytes),record:pushReceipt},
    frozenAlgorithmVerification,scenarioMetadata:enumerateCasesV14(protocol),generatedProspectiveInputs:false,environment:await environmentV14()};
  await mkdir(dirname(target),{recursive:true});await mkdir(target,{recursive:false});
  for(const path of Object.keys(implementationHashes)){
    const destination=join(target,'source',path);await mkdir(dirname(destination),{recursive:true});await copyFile(join(ROOT,path),destination);
    if(sha256(await readFile(destination))!==implementationHashes[path])throw new Error('Source changed during snapshot copy: '+path);
  }
  if(!same(await hashSourcesV14(protocol),implementationHashes))throw new Error('Live source changed while freezing.');
  await verifyCommittedSourcesV14(implementationHashes,{sourceGitCommit:manifest.sourceGitCommit});
  await writeFile(join(target,'source-push-receipt.json'),pushReceiptBytes,{flag:'wx'});
  // Manifest-last is the commit marker; a partial WX directory cannot run or
  // be reused. This deliberately does not claim directory-level atomic rename.
  await writeFile(join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});return manifest;
}
export function assertFrozenProtocolBindingV14(manifest,protocolBytes){
  if(sha256(protocolBytes)!==manifest.protocolHash)throw new Error('Frozen protocol byte hash differs.');
  const parsed=validateProtocolV14(JSON.parse(protocolBytes));if(!same(parsed,manifest.protocol))throw new Error('Embedded frozen protocol differs from its hash-bound bytes.');return parsed;
}
export async function loadFrozenExperimentV14(directory){
  const manifest=JSON.parse(await readFile(join(directory,'manifest.json')));
  if(manifest.schemaVersion!=='portplan-v14-frozen-source')throw new Error('Not a V14 frozen source manifest.');
  const protocol=assertFrozenProtocolBindingV14(manifest,await readFile(join(directory,'source/data/protocol-v14.json')));assertReadyForFreezeV14(protocol);
  await verifyHistoricalSeedExclusionsV14(protocol);await verifyFrozenAlgorithmsV14(protocol);
  if(!same(await hashSourcesV14(protocol),manifest.implementationHashes))throw new Error('Live source differs from frozen source; prospective execution is forbidden.');
  for(const [path,digest]of Object.entries(manifest.implementationHashes)){
    const raw=await readFile(join(directory,'source',path));if(sha256(raw)!==digest||gitBlobHashV14(raw,manifest.gitObjectFormat)!==manifest.committedBlobHashes[path])throw new Error('Frozen source/committed blob changed: '+path);
  }
  const committed=await verifyCommittedSourcesV14(manifest.implementationHashes,{sourceGitCommit:manifest.sourceGitCommit});
  for(const key of ['sourceGitCommit','sourceGitTree','gitObjectFormat','committedBlobHashes','sourceCommitVerified'])if(!same(committed[key],manifest[key]))throw new Error('Source Git provenance differs: '+key);
  if(manifest.sourcePushReceipt?.path!=='source-push-receipt.json')throw new Error('Missing or unsafe frozen source-push receipt.');
  const pushBytes=await readFile(join(directory,manifest.sourcePushReceipt.path)),push=JSON.parse(pushBytes);
  if(sha256(pushBytes)!==manifest.sourcePushReceipt.sha256||!same(push,manifest.sourcePushReceipt.record))throw new Error('Frozen source-push receipt differs.');
  validateSourcePushReceiptV14(push,manifest.sourceGitCommit);
  if(!same(enumerateCasesV14(protocol),manifest.scenarioMetadata)||manifest.generatedProspectiveInputs!==false)throw new Error('Frozen metadata declaration differs.');
  return manifest;
}
export async function writeFirstRunAuthorizationV14(frozen,output,manifest,manifestSha256){
  if(!/^[a-f0-9]{64}$/.test(manifestSha256))throw new Error('The exact frozen manifest byte SHA is required.');
  const marker={schemaVersion:'portplan-v14-first-run-execution-start',rootAuthorized:true,startedAt:new Date().toISOString(),
    manifestSha256,protocolHash:manifest.protocolHash,sourceGitCommit:manifest.sourceGitCommit,sourcePushReceiptSha256:manifest.sourcePushReceipt.sha256,
    plannedEpisodeCount:3024,outputRelativeToFrozen:relative(frozen,output)};
  const bytes=JSON.stringify(marker,null,2)+'\n',path=join(frozen,'execution-start.json');
  // A freeze has one immutable first attempt across every possible output
  // path. A partial/harness failure consumes it and cannot silently restart.
  await writeFile(path,bytes,{flag:'wx'});
  return {marker,artifact:{path:relative(output,path),sha256:sha256(bytes)}};
}

export async function runFrozenExperimentV14(frozenDirectory,outputDirectory,{rootAuthorized=false}={}){
  if(rootAuthorized!==true)throw new Error('A separate explicit root runtime authorization is required before any V14 input generation or solver work.');
  const frozen=resolve(frozenDirectory);await assertNewOutputV14(join(frozen,'execution-start.json'));
  const manifest=await loadFrozenExperimentV14(frozen),protocol=manifest.protocol,manifestBytes=await readFile(join(frozen,'manifest.json'));
  if(!same(JSON.parse(manifestBytes),manifest))throw new Error('Manifest changed during the pre-generation gate.');
  const output=resolve(outputDirectory??join(frozen,'first-run'));await assertNewOutputV14(output);
  const manifestSha256=sha256(manifestBytes),authorization=await writeFirstRunAuthorizationV14(frozen,output,manifest,manifestSha256);
  await mkdir(dirname(output),{recursive:true});await mkdir(output,{recursive:false});await mkdir(join(output,'inputs'));await mkdir(join(output,'episodes'));await mkdir(join(output,'checkpoints'));
  const state={schemaVersion:'portplan-v14-streamed-experiment',studyMethod:'guardedHiGHSV13',initialization:protocol.initialization,
    protocolHash:manifest.protocolHash,manifestSha256,executionStartArtifact:authorization.artifact,frozenSource:relative(output,frozen),implementationHashes:manifest.implementationHashes,
    sourceGitCommit:manifest.sourceGitCommit,sourceGitTree:manifest.sourceGitTree,gitObjectFormat:manifest.gitObjectFormat,committedBlobHashes:manifest.committedBlobHashes,sourcePushReceipt:manifest.sourcePushReceipt,
    rootAuthorized:true,protocol,startedAt:new Date().toISOString(),environment:await environmentV14(),executionState:'running',cases:[],summary:null,limitations:protocol.analysisRules};
  // First-run WX authorization markers precede even importing the generator.
  await writeFile(join(output,'run.json'),JSON.stringify(state,null,2)+'\n',{flag:'wx'});await writeFile(join(output,'episodes.ndjson'),'',{flag:'wx'});
  const {makeScenarioV2}=await import(pathToFileURL(join(frozen,'source/scripts/benchmark-v2.mjs')).href);
  const {runColdEpisodeV12:runFrozenColdEpisode}=await import(pathToFileURL(join(frozen,'source/scripts/benchmark-v12.mjs')).href);
  const fingerprints=new Map(),duplicateOrderLists=[];let checkpointSequence=0,finishedEpisodeCount=0;
  const save=async completedRepeat=>{
    state.updatedAt=new Date().toISOString();const inferential=state.executionState==='complete';
    state.summary={...summarizeExperimentV14(state.cases,{bootstrap:inferential?protocol.analysis.bootstrap:{...protocol.analysis.bootstrap,draws:0}}),
      inferentialState:inferential?'complete-scenario-cluster-bootstrap':'pending-until-complete-run'};
    checkpointSequence++;
    await writeFile(join(output,'checkpoints',`checkpoint-${String(checkpointSequence).padStart(4,'0')}.json`),JSON.stringify({
      schemaVersion:'portplan-v14-immutable-checkpoint',sequence:checkpointSequence,protocolHash:manifest.protocolHash,sourceGitCommit:manifest.sourceGitCommit,
      executionState:state.executionState,finishedEpisodeCount,completedRepeat,updatedAt:state.updatedAt},null,2)+'\n',{flag:'wx'});
    await writeFile(join(output,'run.checkpoint.json'),JSON.stringify(state,null,2)+'\n');
  };
  for(const [scenarioIndex,config]of manifest.scenarioMetadata.entries()){
    const nominalScenario=makeScenarioV2(config),events=realizeDeclaredShocksV7(nominalScenario,config.shocks);
    const fingerprint=sha256(JSON.stringify(nominalScenario.containers.map(({id,...row})=>row)));
    if(fingerprints.has(fingerprint))duplicateOrderLists.push({id:config.id,duplicateOf:fingerprints.get(fingerprint),sha256:fingerprint});else fingerprints.set(fingerprint,config.id);
    const inputBytes=JSON.stringify({config,nominalScenario,events},null,2)+'\n',inputPath=`inputs/${config.id}.json`;
    await writeFile(join(output,inputPath),inputBytes,{flag:'wx'});
    const c={...config,inputArtifact:{path:inputPath,sha256:sha256(inputBytes)},orderFingerprint:fingerprint,repeats:[]};state.cases.push(c);
    for(const [repeatIndex,repetition]of protocol.algorithmRepeats.entries()){
      const order=executionOrderV14(scenarioIndex,repeatIndex),record={repeatIndex:repeatIndex+1,algorithmSeed:repetition.seed,methodExecutionOrder:order,policies:{}};c.repeats.push(record);
      for(const method of order){
        const episodeId=`${config.id}--a${repeatIndex+1}--${method}`;
        const result=await runFrozenColdEpisode({episodeId,nominalScenario,events,method,algorithmSeed:repetition.seed,repeatIndex:repeatIndex+1,callBudgets:protocol.callBudgets},
          {hardWallMs:5000,workerScript:join(frozen,'source/scripts/episode-v14.worker.mjs')});
        const bytes=JSON.stringify({episodeId,caseId:config.id,scenarioId:config.id,panel:config.panel,repeat:repeatIndex+1,repeatIndex:repeatIndex+1,algorithmSeed:repetition.seed,method,result},null,2)+'\n';
        const path=`episodes/${episodeId}.json`,artifact={path,sha256:sha256(bytes)};await writeFile(join(output,path),bytes,{flag:'wx'});
        const receipt=compactEpisodeReceiptV14(result,artifact);record.policies[method]=receipt;finishedEpisodeCount++;
        await appendFile(join(output,'episodes.ndjson'),JSON.stringify({episodeId,scenarioId:config.id,panel:config.panel,repeatIndex:repeatIndex+1,algorithmSeed:repetition.seed,method,receipt})+'\n');
        console.log(`${config.panel} ${episodeId}: ${result.status}; complete=${isCompleteV14(result)}; historyUnknown=${result.executionHistoryUnavailable}; total=${result.totalCost}`);
      }
      await save({scenarioId:c.id,...record});
    }
  }
  if(finishedEpisodeCount!==3024)throw new Error('V14 first-run matrix is incomplete; no success receipt may be written.');
  for(const [path,digest]of Object.entries(manifest.implementationHashes))if(sha256(await readFile(join(frozen,'source',path)))!==digest)throw new Error('Frozen source changed during first run: '+path);
  state.sourceConsistency={frozenBefore:true,frozenAfter:true};
  state.duplicateOrderLists=duplicateOrderLists;state.executionState='complete';await save(null);
  await writeFile(join(output,'complete.json'),JSON.stringify({...state,completedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'});return {output,summary:state.summary};
}

function option(args,name){const index=args.indexOf(name);if(index<0)return null;const value=args[index+1];if(!value||value.startsWith('--'))throw new Error(name+' requires a value.');return value;}
async function main(){
  const args=process.argv.slice(2);
  if(args.includes('--inspect')){const protocol=validateProtocolV14(JSON.parse(await readFile(join(ROOT,'data/protocol-v14.json'))));
    console.log(JSON.stringify({state:'declaration-only-no-inputs-generated',scenarioMetadata:enumerateCasesV14(protocol),episodeCount:3024,
      historicalSeeds:await verifyHistoricalSeedExclusionsV14(protocol),frozenAlgorithms:await verifyFrozenAlgorithmsV14(protocol)},null,2));return;}
  if(args.includes('--freeze')){const output=option(args,'--output');if(!output)throw new Error('--freeze requires an exclusive --output PATH.');
    const manifest=await freezeExperimentV14(output,{pushReceiptPath:option(args,'--push-receipt')});console.log(JSON.stringify({frozenDirectory:resolve(output),protocolHash:manifest.protocolHash,sourceGitCommit:manifest.sourceGitCommit,generatedInputs:false},null,2));return;}
  if(args.includes('--run')){const frozen=option(args,'--frozen');if(!frozen)throw new Error('--run requires --frozen PATH.');
    console.log(JSON.stringify(await runFrozenExperimentV14(frozen,option(args,'--output'),{rootAuthorized:args.includes('--root-authorized')}),null,2));return;}
  throw new Error('Choose --inspect, --freeze --output NEW_PATH --push-receipt PATH, or explicitly authorized --run --frozen PATH --root-authorized [--output NEW_PATH]. No implicit generation, resume or retry.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();

