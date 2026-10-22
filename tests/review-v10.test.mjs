import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {rowFor,summarize} from '../src/engine.js';
import {runRollingScenario} from '../src/rolling-plan.js';

const FIELDS=['storageCost','ddCost','totalCost','sunkCost','incrementalCost','objectiveCost'];
const fee=result=>Object.fromEntries(FIELDS.map(field=>[field,result[field]]));
const dates=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const scenario=(aged=false)=>({id:'handwritten-v10-independent-review',horizonStart:'2026-10-15',horizonDays:7,
  truckCapacity:4,warehouseCapacity:2,stagingCapacity:2,containers:[{id:'A',sizeFt:20,releaseDay:0,unloadDays:1,dueDay:5,
    dischargeDateTime:aged?'2026-09-30T07:00:00+09:00':'2026-10-14T07:00:00+09:00',dataOrigin:'synthetic'}]});
const validAudit=()=>({valid:true,errors:[],scheduleAudit:{valid:true,errors:[]},freezeAudit:{valid:true,errors:[]}});
async function fixture({aged=false,improve=false}={}) {
  const s=scenario(aged),initial=summarize(s,'fixture',[rowFor(s,s.containers[0],2,2,4)],0),
    alternate=summarize(s,'fixture',[rowFor(s,s.containers[0],1,1,2)],0),trace=[];
  let previous=null,replacements=0,ties=0;
  const result=await runRollingScenario(s,[],{planner:async(observed,o)=>{
    const day=o.minEventDay,before=previous,proposal=day===1?alternate:before??initial;
    const replace=!before||(improve&&day===1),selected=replace?proposal:before,source=replace?'native_highs':'cached_incumbent',
      changes=(a,b)=>a?dates(b.rows).reduce((n,row)=>n+['pickupDay','unloadDay','returnDay'].filter(key=>!Object.hasOwn(o.fixedEvents[row.id]??{},key)&&row[key]!==a.rows.find(r=>r.id===row.id)[key]).length,0):null;
    if(before&&replace)replacements++;if(before&&!replace&&proposal.incrementalCost===before.incrementalCost)ties++;
    const decisionReason=!before?'initialize_native':replace?'strict_fee_replacement':'retain_fee_tie',
      proof={rule:'strict_fee_replacement_retain_ties',feeEpsilonKRW:1e-6,cacheStatus:before?'valid':'absent',cacheValid:!!before,
        beforeDates:before?dates(before.rows):null,beforeFees:before?fee(before):null,proposalDates:dates(proposal.rows),proposalFees:fee(proposal),
        afterDates:dates(selected.rows),afterFees:fee(selected),nativeCostMinusCacheKRW:before?proposal.incrementalCost-before.incrementalCost:null,
        cacheCostMinusSelectedKRW:before?before.incrementalCost-selected.incrementalCost:null,changedEventCount:changes(before,selected),
        proposalChangedEventCount:changes(before,proposal),decisionReason,selectedSource:source,
        cacheGate:before?{auditFinishedAtMs:1,selectionFinishedAtMs:1.25,acceptedAtMs:1.5}:{auditFinishedAtMs:null,selectionFinishedAtMs:null,acceptedAtMs:null},
        nativeGate:{receivedAtMs:2,copiedAtMs:3,auditFinishedAtMs:4,feesMatchedAtMs:5,selectionFinishedAtMs:6,acceptedAtMs:replace?7:null,outcome:decisionReason}};
    trace.push({day,timeBudgetMs:200,wallTimeMs:10,callWallMs:10,candidateSource:source,stabilitySelection:proof,
      nativeCertificate:{hasIncumbent:true,objectiveCost:proposal.objectiveCost,independentCosts:fee(proposal)},
      stages:{...(before?{cacheAudit:validAudit()}:{}),native:{audit:validAudit(),independentCostsMatch:true}},
      strictReplacementCount:replacements,tieRetainedCount:ties});previous=selected;return selected;
  }});
  assert.equal(result.complete,true);
  return {nominalScenario:s,events:[],result:{...result,policy:'stableHiGHSV10',auditValid:true,plannerTrace:trace,
    hardWallMs:5000,wallTimeMs:100,outputDeliveredWithinBudget:true,executionHistoryUnavailable:false,
    finalReceivedMs:90,receiptValidatedMs:100}};
}
async function review(record) {
  const directory=await mkdtemp(join(tmpdir(),'portplan-independent-v10-'));
  try {const path=join(directory,'record.json');await writeFile(path,JSON.stringify(record));
    return spawnSync('python3',['scripts/review-v10.py','--episode',path],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  }finally {await rm(directory,{recursive:true,force:true});}
}
const second=record=>record.result.plannerTrace[1];
async function rejects(mutator,pattern) {
  const record=await fixture();mutator(record);const result=await review(record);
  assert.notEqual(result.status,0,result.stdout);if(pattern)assert.match(result.stderr,pattern);
}

test('independent V10 ledger accepts exact fee ties retained across complete physical execution',async()=>{
  const result=await review(await fixture());assert.equal(result.status,0,result.stderr);
  const output=JSON.parse(result.stdout);assert.equal(output.solverRuns,0);
  assert.equal(output.checked.nativeStabilitySelection.retainedCacheCalls,4);
});

test('independent V10 ledger accepts a strictly cheaper current-snapshot native replacement',async()=>{
  const result=await review(await fixture({aged:true,improve:true}));assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).checked.nativeStabilitySelection.strictReplacements,1);
});

test('a native fee tie cannot replace an already accepted valid cache',async()=>{
  await rejects(record=>{const m=second(record),p=m.stabilitySelection;p.nativeGate.acceptedAtMs=7;
    p.selectedSource='native_highs';m.candidateSource='native_highs';p.afterDates=p.proposalDates;
    p.afterFees=p.proposalFees;p.changedEventCount=3;},/ties must retain/);
});

test('native proposal, cache, selected fee proofs and selected physical decisions remain independently bound',async()=>{
  await rejects(record=>{second(record).stabilitySelection.proposalFees.incrementalCost++;},/proposal\/incrementalCost/);
  await rejects(record=>{second(record).stabilitySelection.beforeDates[0].returnDay=5;},/cached date binding/);
  await rejects(record=>{second(record).stabilitySelection.afterDates[0].returnDay=5;},/selected|retained/);
  await rejects(record=>{second(record).stabilitySelection.proposalChangedEventCount=0;},/proposed pending-event changes/);
});

test('late first native acceptance cannot be backdated by internal incumbent metadata',async()=>{
  await rejects(record=>{const m=record.result.plannerTrace[0];m.firstIncumbentMs=1;m.wallTimeMs=300;m.callWallMs=300;
    m.stabilitySelection.nativeGate.acceptedAtMs=201;},/whole-call deadline/);
});

test('a timely cached plan may survive optional native work that returns after the daily cutoff',async()=>{
  const record=await fixture(),m=second(record);m.wallTimeMs=300;m.callWallMs=300;
  Object.assign(m.stabilitySelection.nativeGate,{receivedAtMs:201,copiedAtMs:202,auditFinishedAtMs:203,
    feesMatchedAtMs:204,selectionFinishedAtMs:205,acceptedAtMs:null,outcome:'late_candidate'});
  for(const call of record.result.plannerTrace.slice(1))call.tieRetainedCount--;
  m.stabilitySelection.decisionReason='retain_without_timely_valid_native';
  const result=await review(record);assert.equal(result.status,0,result.stderr);
});

test('independent native fee reconciliation cannot be forged to accept inconsistent backend prices',async()=>{
  await rejects(record=>{record.result.plannerTrace[0].nativeCertificate.objectiveCost++;},/fee reconciliation/);
});

test('recorded audit flags cannot disguise a violation of pending-day or physical date constraints',async()=>{
  await rejects(record=>{second(record).stabilitySelection.proposalDates[0].unloadDay=0;},/physical validity|combined independent validity/);
});

test('parent five-second completion deadline remains binding despite native daily evidence',async()=>{
  await rejects(record=>{record.result.wallTimeMs=5001;},/parent budget/);
});

test('V10 declaration expands only metadata and binds independent new business and repeat seeds',()=>{
  const code="import importlib.util,json; s=importlib.util.spec_from_file_location('r','scripts/review-v10.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); p=json.load(open('data/protocol-v10.json')); x=m.declared_cases(p); assert len(x)==144 and len({r['seed'] for r in x})==144; p['panels'][0]['baseSeed']=391001; m.declared_cases(p)";
  const result=spawnSync('python3',['-c',code],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/Unseen business seeds/);
});

test('joint five-method Pareto uses identical repeat/scenario sets and never invents missing estimates',()=>{
  const code="import importlib.util; s=importlib.util.spec_from_file_location('r','scripts/review-bootstrap-v10.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); methods=m.METHODS; row=lambda f,r:{'complete':True,'totalCost':f,'incrementalCost':f,'revisionCount':r}; u={x:[row(100+i,5-i) for _ in range(3)] for i,x in enumerate(methods)}; c=[{'id':'handwritten','units':u}]; p=m.joint_complete_pareto(c); assert p['jointScenarioCount']==1 and p['jointEpisodeCount']==3; assert all(x['pareto'] for x in p['frontiers']['incrementalAndRevisions']); u[methods[0]][0]['complete']=False; p=m.joint_complete_pareto(c); assert p['jointEpisodeCount']==2 and p['scenarios'][0]['pairedRepeatCount']==2; u[methods[1]][1]['revisionCount']=None; p=m.joint_complete_pareto(c); assert p['byMethod'][methods[1]]['scenarioMeanRevisionCountSum'] is None; assert p['frontiers']['incrementalAndRevisions'][1]['pareto'] is None; [r.update(complete=False) for r in u[methods[0]]]; p=m.joint_complete_pareto(c); assert p['jointScenarioCount']==0 and all(x['pareto'] is None for x in p['frontiers']['totalAndRevisions']); assert p['byMethod'][methods[0]]['episodeTotalCostSumKRW'] is None";
  const result=spawnSync('python3',['-c',code],{cwd:new URL('../',import.meta.url),encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});

test('bootstrap still independently resamples entire scenarios and preserves empty denominators',()=>{
  const code="import importlib.util; s=importlib.util.spec_from_file_location('r','scripts/review-bootstrap-v10.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); z=m.cluster_bootstrap([],700001,2000); assert z['meanSavings95CI'] is None; x=m.cluster_bootstrap([(100,80)],700001,2000); assert x['meanSavings95CI']==[20,20] and x['weightedSavingsPct95CI']==[20,20]; y=m.cluster_bootstrap([(0,0)],700001,2000); assert y['weightedSavingsPct95CI'] is None";
  const result=spawnSync('python3',['-c',code],{cwd:new URL('../',import.meta.url),encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});

test('observed recommendation gates reject completion losses, unknown revision subsets and robust fee deterioration',()=>{
  const code="import importlib.util; s=importlib.util.spec_from_file_location('r','scripts/review-bootstrap-v10.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); c=[{'id':str(i),'units':{x:[{'complete':True,'revisionCount':1 if x=='stableHiGHSV10' else 5} for _ in range(3)] for x in m.METHODS}} for i in range(72)]; fees={k:{'weightedSavingsPct95CI':[0,1]} for k in ('total','incremental')}; p={'v10VsHiGHS':{'fees':fees}}; g=m.decision_gates(c,p); assert g['defaultRecommendationEligible'] and g['nativeComparison']['stabilityImprovementClaimAllowed']; c[0]['units']['stableHiGHSV10'][0]['complete']=False; g=m.decision_gates(c,p); assert not g['defaultRecommendationEligible'] and not g['nativeComparison']['stabilityImprovementClaimAllowed']; c[0]['units']['stableHiGHSV10'][0]['complete']=True; c[0]['units']['highsV8'][0]['revisionCount']=None; g=m.decision_gates(c,p); assert g['nativeComparison']['revisionDelta'] is None and not g['nativeComparison']['strictRevisionReduction']; c[0]['units']['highsV8'][0]['revisionCount']=5; fees['incremental']['weightedSavingsPct95CI']=[-2,-1]; g=m.decision_gates(c,p); assert not g['nativeComparison']['noRobustFeeDeterioration'] and not g['nativeComparison']['stabilityImprovementClaimAllowed']; g=m.decision_gates(c[:1],p); assert g['assessmentState']=='partial-panel' and not g['defaultRecommendationEligible']";
  const result=spawnSync('python3',['-c',code],{cwd:new URL('../',import.meta.url),encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});
