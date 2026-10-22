import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {rowFor,summarize} from '../src/engine.js';
import {runRollingScenario} from '../src/rolling-plan.js';
import {scoreCommitmentSlackV11} from '../src/commitment-slack-v11.js';

const COSTS=['storageCost','ddCost','totalCost','sunkCost','incrementalCost','objectiveCost'];
const fees=result=>Object.fromEntries(COSTS.map(key=>[key,result[key]]));
const dates=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const validAudit=()=>({valid:true,errors:[],scheduleAudit:{valid:true,errors:[]},freezeAudit:{valid:true,errors:[]}});
const scene=()=>({id:'handwritten-v12-review',horizonStart:'2026-10-13',horizonDays:7,truckCapacity:4,warehouseCapacity:2,stagingCapacity:2,
  containers:[{id:'A',sizeFt:20,releaseDay:0,unloadDays:2,dueDay:5,dischargeDateTime:'2026-10-13T07:00:00+09:00',dataOrigin:'synthetic'}]});
const emptyScore=()=>({attempted:false,complete:false,cache:null,proposal:null,beforeM:null,proposalM:null,selectedM:null,
  startedAtMs:null,finishedAtMs:null,timely:null,skipReason:'no_valid_fee_tie',error:null});

async function fixture(mode='seed_only'){
  const s=scene(),seed=summarize(s,'fixture',[rowFor(s,s.containers[0],0,0,2)],0),
    alternative=summarize(s,'fixture',[rowFor(s,s.containers[0],2,2,4)],0),trace=[];
  let previous=null,ties=0,commitments=0;
  const result=await runRollingScenario(s,[],{planner:async(observed,o)=>{
    const day=o.minEventDay,before=previous,pre=before??seed;
    const proposal=mode==='lower_m'?(day===0?alternative:pre):mode==='tie'?pre:null;
    const scoring=emptyScore();
    let replace=false;
    if(proposal){
      const a=scoreCommitmentSlackV11(observed,pre.rows,o),b=scoreCommitmentSlackV11(observed,proposal.rows,o);
      replace=b.mandatoryWarehouseTomorrow<a.mandatoryWarehouseTomorrow;
      Object.assign(scoring,{attempted:true,complete:true,cache:a,proposal:b,beforeM:a.mandatoryWarehouseTomorrow,
        proposalM:b.mandatoryWarehouseTomorrow,selectedM:replace?b.mandatoryWarehouseTomorrow:a.mandatoryWarehouseTomorrow,
        startedAtMs:14,finishedAtMs:15,timely:true,skipReason:null});
      if(replace)commitments++;else ties++;
    }
    const selected=replace?proposal:pre,source=replace?'native_highs':before?'cached_incumbent':'quick_constructor';
    const reason=proposal?(replace?'equal_fee_lower_mandatory_warehouse':'retain_fee_tie_no_lower_mandatory_warehouse'):before?'retain_without_timely_valid_native':'timely_complete_constructor';
    const changes=(a,b)=>a?dates(b.rows).reduce((n,r)=>n+['pickupDay','unloadDay','returnDay'].filter(k=>!Object.hasOwn(o.fixedEvents[r.id]??{},k)&&r[k]!==a.rows.find(x=>x.id===r.id)[k]).length,0):null;
    const event={sequence:1,source:'quick_constructor',receivedAtMs:1,copiedAtMs:2,auditFinishedAtMs:3,selectionFinishedAtMs:4,
      acceptedAtMs:5,proposedDates:dates(seed.rows),dates:dates(seed.rows),fees:fees(seed),outcome:'accepted',audit:{valid:true,errors:[]}};
    const proof={rule:'strict_fee_then_lower_next_day_mandatory_warehouse_on_ties',feeEpsilonKRW:1e-6,
      cacheStatus:before?'valid':'absent',cacheValid:!!before,beforeDates:before?dates(before.rows):null,beforeFees:before?fees(before):null,
      proposalDates:proposal?dates(proposal.rows):null,proposalFees:proposal?fees(proposal):null,
      afterDates:dates(selected.rows),afterFees:fees(selected),nativeCostMinusCacheKRW:before&&proposal?0:null,
      nativeCostMinusIncumbentKRW:proposal?0:null,cacheCostMinusSelectedKRW:before?0:null,
      changedEventCount:changes(before,selected),proposalChangedEventCount:proposal?changes(before,proposal):null,
      decisionReason:reason,selectedSource:source,commitmentScore:scoring,
      publicCapacities:Object.fromEntries(['truck','warehouse','staging'].map(r=>[r,Array(s.horizonDays).fill(s[r+'Capacity'])])),
      cacheGate:before?{auditFinishedAtMs:1,selectionFinishedAtMs:1.25,acceptedAtMs:1.5}:{auditFinishedAtMs:null,selectionFinishedAtMs:null,acceptedAtMs:null},
      constructorDelivery:{budgetMs:40,auditReserveMs:5,maxRestarts:3,deadlineAtMs:before?null:40,events:before?[]:[event],
        firstAcceptedAtMs:before?null:5,selectedAcceptanceAtMs:before?null:5,returnedResultUsedAsReceipt:false},
      preNativeIncumbent:{source:before?'cached_incumbent':'quick_constructor',dates:dates(pre.rows),fees:fees(pre),acceptedAtMs:before?1.5:5},
      nativeGate:{receivedAtMs:10,copiedAtMs:proposal?11:null,auditFinishedAtMs:proposal?12:null,feesMatchedAtMs:proposal?13:null,
        selectionFinishedAtMs:proposal?16:null,acceptedAtMs:replace?17:null,outcome:proposal?reason:'no_incumbent'}};
    trace.push({day,timeBudgetMs:200,wallTimeMs:30,callWallMs:30,candidateSource:source,stabilitySelection:proof,
      nativeCertificate:proposal?{hasIncumbent:true,objectiveCost:proposal.objectiveCost,independentCosts:fees(proposal)}:{hasIncumbent:false},
      stages:{...(before?{cacheAudit:validAudit()}:{}),quickConstructor:before?{status:'valid_cache_skip'}:
        {status:'feasible',returnedCompleteCandidate:true,returnedCandidateAccepted:false,acceptedReceiptCount:1},
        native:{...(proposal?{audit:validAudit(),independentCostsMatch:true}:{}),status:proposal?'optimal':'time_limit'}},
      constructorCalls:1,acceptedConstructorReceipts:1,strictReplacementCount:0,tieRetainedCount:ties,commitmentReplacementCount:commitments});
    previous=selected;return selected;
  }});
  assert.equal(result.complete,true);
  return {nominalScenario:s,events:[],result:{...result,policy:'seededHiGHSV12',auditValid:true,plannerTrace:trace,hardWallMs:5000,
    wallTimeMs:100,outputDeliveredWithinBudget:true,executionHistoryUnavailable:false,finalReceivedMs:90,receiptValidatedMs:100}};
}
async function review(record){
  const directory=await mkdtemp(join(tmpdir(),'portplan-review-v12-'));
  try{const path=join(directory,'record.json');await writeFile(path,JSON.stringify(record));
    return spawnSync('python3',['scripts/review-v12.py','--episode',path],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  }finally{await rm(directory,{recursive:true,force:true});}
}
const first=record=>record.result.plannerTrace[0];
async function rejects(mutator,pattern,mode='seed_only'){
  const record=await fixture(mode);mutator(record);const checked=await review(record);
  assert.notEqual(checked.status,0,checked.stdout);if(pattern)assert.match(checked.stderr,pattern);
}
function python(code){const r=spawnSync('python3',['-c',code],{cwd:new URL('../',import.meta.url),encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r;}
const load=(name)=>`import importlib.util,json,copy; s=importlib.util.spec_from_file_location('r','scripts/${name}.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); `;

test('complete constructor receipt is preserved through missing native incumbents and full physical history',async()=>{
  const checked=await review(await fixture());assert.equal(checked.status,0,checked.stderr);
  const output=JSON.parse(checked.stdout);assert.equal(output.solverRuns,0);
  assert.equal(output.checked.nativeStabilitySelection.acceptedConstructorReceipts,1);
  assert.equal(output.checked.nativeStabilitySelection.retainedConstructorCalls,1);
});

test('equal fees can select strictly lower independently rebuilt complete M from the timely seed',async()=>{
  const checked=await review(await fixture('lower_m'));assert.equal(checked.status,0,checked.stderr);
  assert.equal(JSON.parse(checked.stdout).checked.nativeStabilitySelection.commitmentReplacements,1);
});

test('equal M retains the full current seed/cache dates and does not count an M replacement',async()=>{
  const checked=await review(await fixture('tie'));assert.equal(checked.status,0,checked.stderr);
  assert.equal(JSON.parse(checked.stdout).checked.nativeStabilitySelection.commitmentReplacements,0);
});

test('returned-candidate metadata cannot synthesize a constructor receipt',async()=>{
  await rejects(r=>{first(r).stabilitySelection.constructorDelivery.returnedResultUsedAsReceipt=true;},/returnedResultUsedAsReceipt/);
  await rejects(r=>{first(r).stabilitySelection.constructorDelivery.events=[];},/first accepted constructor receipt|pre-native incumbent/);
});

test('constructor receipt, complete copy, audit and acceptance all share the original 40ms cap',async()=>{
  await rejects(r=>{const m=first(r);m.wallTimeMs=80;m.stabilitySelection.constructorDelivery.events[0].acceptedAtMs=41;},/after deadline/);
  await rejects(r=>{first(r).stabilitySelection.constructorDelivery.events[0].copiedAtMs=0.5;},/chronology/);
  await rejects(r=>{first(r).stabilitySelection.constructorDelivery.events[0].fees.incrementalCost++;},/constructor fee/);
  await rejects(r=>{first(r).stabilitySelection.constructorDelivery.events[0].proposedDates[0].returnDay=5;},/copied dates binding/);
});

test('complete pre-native dates, fees and actual selected dates remain bound',async()=>{
  await rejects(r=>{first(r).stabilitySelection.preNativeIncumbent.dates[0].returnDay=4;},/pre-native incumbent/);
  await rejects(r=>{first(r).stabilitySelection.afterDates[0].returnDay=4;},/selected complete dates/);
  await rejects(r=>{r.result.plannerTrace[1].stabilitySelection.beforeDates[0].returnDay=4;},/original cached full dates/);
});

test('complete M proofs cannot narrow legal domains or change shadow locks, capacities or avoidance witnesses',async()=>{
  await rejects(r=>{first(r).stabilitySelection.commitmentScore.proposal.containers[0].legalTripCount--;},/containers/,'lower_m');
  await rejects(r=>{first(r).stabilitySelection.commitmentScore.cache.shadowFixedEvents={};},/shadowFixedEvents/,'lower_m');
  await rejects(r=>{first(r).stabilitySelection.commitmentScore.proposal.publicCapacities.warehouse[1]=0;},/publicCapacities/,'lower_m');
  await rejects(r=>{first(r).stabilitySelection.commitmentScore.proposal.containers[0].avoidanceWitness.unloadDay++;},/containers/,'lower_m');
});

test('incomplete or late M never authorizes a fee-tie replacement',async()=>{
  await rejects(r=>{const score=first(r).stabilitySelection.commitmentScore;score.proposal.complete=false;score.proposal.status='time_limit';},/partial score cannot become zero/,'lower_m');
  await rejects(r=>{const m=first(r),p=m.stabilitySelection;m.wallTimeMs=250;p.commitmentScore.finishedAtMs=201;p.commitmentScore.timely=false;
    p.nativeGate.selectionFinishedAtMs=202;p.nativeGate.acceptedAtMs=203;},/after deadline/,'lower_m');
  await rejects(r=>{first(r).nativeCertificate.objectiveCost++;},/forged native fees|fee reconciliation/,'lower_m');
});

test('timely seed survives optional native work that is received after the daily cutoff',async()=>{
  const record=await fixture(),m=first(record);m.wallTimeMs=250;m.callWallMs=250;m.stabilitySelection.nativeGate.receivedAtMs=210;
  const checked=await review(record);assert.equal(checked.status,0,checked.stderr);
});

test('failure fees remain null and the cold parent deadline is independently binding',async()=>{
  await rejects(r=>{r.result.wallTimeMs=5001;},/parent budget/);
});

test('independent M respects public zero capacities, TEU weight, same-day double truck moves and horizon edges',()=>{
  python(load('review-v12')+`
s={'id':'handwritten','horizonStart':'2026-10-13','horizonDays':6,'truckCapacity':[2,1,0,2,2,2],'warehouseCapacity':[1,1,0,0,0,0],'stagingCapacity':2,'operations':{'stagingUnit':'teu'},'containers':[{'id':'A','sizeFt':40,'releaseDay':1,'unloadDays':1,'dueDay':3,'dischargeDateTime':'2026-10-13T07:00:00+09:00'}]}
r=[{'id':'A','pickupDay':1,'unloadDay':1,'returnDay':3}]
x=m.independent_commitment(s,r,{},0)
assert x['mandatoryWarehouseTomorrow']==1 and x['containers'][0]['stagingWeight']==2
s['operations']['returnLagDays']=0;s['containers'][0]['releaseDay']=0;s['containers'][0]['dueDay']=4;s['truckCapacity']=2;s['warehouseCapacity']=1;s['stagingCapacity']=0
r=[{'id':'A','pickupDay':0,'unloadDay':0,'returnDay':0}];x=m.independent_commitment(s,r,{},0)
assert x['mandatoryWarehouseTomorrow']==0 and x['containers'][0]['legalTripCount']==1
x=m.independent_commitment(s,r,{'A':{'pickupDay':0,'unloadDay':0,'returnDay':0}},5)
assert not x['tomorrowInsideHorizon'] and x['publicWarehouseCapacityTomorrow'] is None
`);
});

test('formal metadata expansion fixes 144 unseen seeds and refuses altered declaration',()=>{
  python(load('review-v12')+`p=json.load(open('data/protocol-v12.json')); x=m.declared_cases(p); assert len(x)==144 and len({r['seed'] for r in x})==144 and x[0]['seed']==691001 and x[72]['seed']==692001
p['algorithmRepeats'][0]['seed']=49011
try: m.declared_cases(p)
except ValueError: pass
else: raise AssertionError('changed old repeat seed accepted')
`);
});

test('six-method common set preserves repeat matching and null revisions instead of invented zero',()=>{
  python(load('review-bootstrap-v12')+`
row=lambda f,r:{'complete':True,'totalCost':f,'incrementalCost':f,'revisionCount':r}
u={x:[row(100+i,7-i) for _ in range(3)] for i,x in enumerate(m.METHODS)}; c=[{'id':'handwritten','units':u}]
p=m.joint_complete_pareto(c);assert p['jointEpisodeCount']==3 and p['eligibility']=='all-six-matching-complete-repeats'
u[m.METHODS[0]][0]['complete']=False;u[m.METHODS[-1]][1]['revisionCount']=None
p=m.joint_complete_pareto(c);assert p['jointEpisodeCount']==2 and p['byMethod'][m.METHODS[-1]]['scenarioMeanRevisionCountSum'] is None
assert p['frontiers']['incrementalAndRevisions'][-1]['pareto'] is None
`);
});

test('all five full-sample completion loss gates bind despite net gains and pairwise conditional benefits',()=>{
  python(load('review-bootstrap-v12')+`
c=[{'id':str(i),'units':{x:[{'complete':True,'revisionCount':1 if x=='seededHiGHSV12' else 5} for _ in range(3)] for x in m.METHODS}} for i in range(72)]
fees={k:{'weightedSavingsPct95CI':[0,1]} for k in ('total','incremental')};p={k:{'fees':copy.deepcopy(fees)} for k in ('v12VsV11','v12VsV10','v12VsHiGHS')}
g=m.decision_gates(c,p);assert g['defaultRecommendationEligible'] and len(g['nativeComparisons'])==3
c[0]['units']['seededHiGHSV12'][0]['complete']=False
for i in (1,2): c[i]['units']['commitmentHiGHSV11'][0]['complete']=False
g=m.decision_gates(c,p);assert not g['defaultRecommendationEligible'] and g['completionLossCountsByBaseline']['commitmentHiGHSV11']==1 and g['completionGainCountsByBaseline']['commitmentHiGHSV11']==2
c[0]['units']['seededHiGHSV12'][0]['complete']=True;c[0]['units']['stableHiGHSV10'][0]['revisionCount']=None
p['v12VsHiGHS']['fees']['incremental']['weightedSavingsPct95CI']=[-2,-1]
g=m.decision_gates(c,p);assert g['nativeComparisons']['stableHiGHSV10']['revisionDelta'] is None and not g['nativeComparisons']['highsV8']['stabilityImprovementClaimAllowed']
assert not m.decision_gates(c[:1],p)['defaultRecommendationEligible']
`);
});

test('scenario-cluster bootstrap preserves empty and zero denominators and never splits repeats',()=>{
  python(load('review-bootstrap-v12')+`assert m.cluster_bootstrap([],700001,2000)['meanSavings95CI'] is None
assert m.cluster_bootstrap([(100,80)],700001,2000)['weightedSavingsPct95CI']==[20,20]
assert m.cluster_bootstrap([(0,0)],700001,2000)['weightedSavingsPct95CI'] is None
`);
});

test('independent statistics match producer on handwritten panels including negative episodes and distinct paired sets',async()=>{
  const {summarizePanelV12,METHODS_V12}=await import('../scripts/benchmark-v12.mjs');
  const cases=Array.from({length:2},(_,i)=>({id:`handwritten-statistics-${i}`,repeats:Array.from({length:3},(_,j)=>({repeatIndex:j+1,
    policies:Object.fromEntries(METHODS_V12.map((method,k)=>{const complete=!(i===0&&j===0&&k===0)&&!(i===1&&j===2&&k===5);
      return [method,{policy:method,status:complete?'feasible':'rolling_failed',complete,auditValid:complete,episodeCompletedWithinBudget:complete,
        terminalReceiptWithinBudget:true,terminalReceiptAcceptedAsHistory:true,endToEndCompletedWithinBudget:true,
        outputDeliveredWithinBudget:true,deadlineReached:false,normalWorkerExit:true,exitCode:0,exitSignal:null,
        hardWallMs:5000,wallTimeMs:100,endToEndWallTimeMs:100,receiptValidatedMs:90,
        processGroupCleanup:{successful:true,verifiedProcessGroupGone:true,verificationResult:'ESRCH',finishedAtMs:99},
        rows:complete?[{id:'A'}]:[],totalCost:complete?1000+10*i+7*j-6*k:null,incrementalCost:complete?500+7*j+2*k:null,
        revisionCount:10+k,executionHistoryUnavailable:false,initializationEvidence:{initialPlanAccepted:true,failurePhase:complete?null:'after_initialization'}}];}))}))}));
  const units=cases.map(c=>({id:c.id,units:Object.fromEntries(METHODS_V12.map(m=>[m,c.repeats.map(r=>r.policies[m])]))}));
  const summary=summarizePanelV12(cases),directory=await mkdtemp(join(tmpdir(),'portplan-v12-stats-'));
  try{const path=join(directory,'handwritten.json');await writeFile(path,JSON.stringify({units,summary}));
    python(load('review-bootstrap-v12')+`d=json.load(open(${JSON.stringify(path)}));m.compare_panel(d['units'],d['summary'],700001,2000,'handwritten')`);
    summary.comparisons.v12VsV7.completion.lostEpisodeIds=[];
    await writeFile(path,JSON.stringify({units,summary}));
    const r=spawnSync('python3',['-c',load('review-bootstrap-v12')+`d=json.load(open(${JSON.stringify(path)}));m.compare_panel(d['units'],d['summary'],700001,2000,'handwritten')`],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
    assert.notEqual(r.status,0);assert.match(r.stderr,/lostEpisodeIds/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
