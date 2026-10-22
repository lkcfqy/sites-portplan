import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const script=fileURLToPath(new URL('../scripts/review-rolling-v7.py',import.meta.url));
const methods=['dailyReoptV4','stableRetainV5','lockedRecoveryV6','costPolishV7','graspBaselineV7'];
const clone=value=>structuredClone(value);
const stable=value=>Array.isArray(value)?`[${value.map(stable).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`:JSON.stringify(value);
const checksum=value=>'sha256:'+createHash('sha256').update(stable(value)).digest('hex');
const box={id:'T',sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:1};
const nominal={id:'hand-built-fixture',seed:1,horizonStart:'2026-10-12',horizonDays:3,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,containers:[box]};
const actual={...clone(nominal),truckCapacity:[2,2,2],warehouseCapacity:[1,1,1],stagingCapacity:[1,1,1]};
const dates=[{id:'T',pickupDay:0,unloadDay:0,returnDay:1}];
const priced={id:'T',sizeFt:20,pickupDay:0,unloadDay:0,unloadEndDay:0,returnDay:1,storageDays:14,ddDays:15,storageCost:318500,ddCost:75000,
  priorStorageCost:286650,priorDDCost:45000,totalCost:393500,sunkCost:331650,incrementalCost:61850};
const protocol={budget:{hardWallMs:5000},callBudgets:Object.fromEntries(methods.map(method=>[method,methods.indexOf(method)<2?{timeLimitSeconds:.2}:{timeBudgetMs:200}]))};
const dateHash=rows=>createHash('sha256').update(JSON.stringify(rows)).digest('hex');
const auditProof={valid:true,errors:[],scheduleAudit:{valid:true,errors:[]},freezeAudit:{valid:true,errors:[]}};
function polishProof(){return {
  method:'strict joint-fee complete-plan relocation and paired reinsertion',parameters:{maxPasses:2,maxPairs:32,candidateCap:12,maxPairChecks:384,maxSingleTargets:16},
  attempted:true,seedAccepted:true,strictDecreaseOnly:true,sameSnapshotAndLocks:true,acceptedMoves:1,singleMovesExamined:1,pairMovesExamined:0,pairCombinationChecks:0,
  feasibleCandidatesAudited:1,equalCostMovesSkipped:0,capacityRejected:0,lateImprovementsDiscarded:0,seedAudit:clone(auditProof),finalAudit:clone(auditProof),
  seedIncrementalCost:91850,seedObjectiveCost:91850,finalIncrementalCost:61850,finalObjectiveCost:61850,jointNonincrease:true,
  beforeDates:[{id:'T',pickupDay:0,unloadDay:0,returnDay:2}],afterDates:clone(dates),
  acceptedMoveHistory:[{type:'single-relocation',beforeIncrementalCost:91850,afterIncrementalCost:61850,changedIds:['T']}]
};}
function result(method){
  const fixed={},timeline=[],plannerTrace=[];
  for(let day=0;day<2;day++){
    const observedEvents=['truck','warehouse','staging'].map(resource=>({kind:'day_start_capacity',day,resource,capacity:nominal[resource+'Capacity'],activeShockIds:[],announcements:[]}));
    const state=[{id:'T',phase:day?'returned':'awaiting_return',pickupDay:0,unloadDay:0,...(day?{returnDay:1}:{})}];
    timeline.push({day,observedEvents,observationHash:checksum({scenario:actual,observedEvents,fixedEvents:clone(fixed),minEventDay:day}),decisions:clone(dates),
      executedEvents:day?[{id:'T',event:'return',day:1}]:[{id:'T',event:'pickup',day:0},{id:'T',event:'unloadStart',day:0}],
      status:'executed',plannerStatus:'feasible',revisionCount:0,revisions:[],state,audit:{scheduleAudit:{valid:true},freezeAudit:{valid:true}}});
    const daily=method==='dailyReoptV4',legacy=method==='stableRetainV5',grasp=method==='graspBaselineV7',recovery=method==='lockedRecoveryV6'||method==='costPolishV7',retained=day===1&&!daily;
    const trace={day,decisionCalls:day+1,solverCalls:daily?day+1:legacy?1:0,constructorCalls:recovery||grasp?1:0,reusedPlans:retained?1:0,replannedDueToInvalid:0,
      candidateSource:daily?'daily_solver':retained?'retained_plan':legacy?'solver_initial':grasp?'grasp_construction':'locked_constructor',callWallMs:.5,plannerStatus:'feasible'};
    if(legacy&&retained)trace.cacheAudit={valid:true};
    if(recovery)trace.stages=retained?{cacheAudit:{valid:true,rows:{omittedDuplicateRows:1,dateSHA256:dateHash(dates),pricingRowsNotArchived:true}}}:{locked_constructor:{status:'feasible',audit:{valid:true}},locked_milp:{status:'budget_skipped'}};
    if(method==='costPolishV7')Object.assign(trace,{wholeCallBudgetMs:200,policyOptimalityClaim:false,polishCalls:1,acceptedCostMoves:1,
      finalVsAuditedSeedNonincrease:day?null:true,...(!day?{polishMetadata:polishProof()}:{})});
    if(grasp)Object.assign(trace,{timeBudgetMs:200,cooperativeDeadline:true,retainFeasible:true,globalOptimalityClaim:false,localOptimalityClaim:false,
      searchStats:{alpha:.25,resourceImpactWeight:.15,seed:1,maxRestarts:127,maxLocalPasses:3,pairCandidateLimit:12,maxPairChecks:256,
        attemptCount:day?0:1,completedConstructions:day?0:1,tripDomainsEnumerated:day?0:6,feasibleInsertionChecks:day?0:1,rclSelections:day?0:1,
        singleChecks:0,singleImprovements:0,pairChecks:0,pairImprovements:0,auditedCandidates:1,firstIncumbentMs:.05,lateCandidateDiscarded:0,cacheStatus:day?'valid':'absent'}});
    plannerTrace.push(trace);fixed.T={pickupDay:0,unloadDay:0,...(day?{returnDay:1}:{})};
  }
  const latest=plannerTrace.at(-1);
  return {policy:method,status:'feasible',complete:true,auditValid:true,executionHistoryUnavailable:false,deadlineReached:false,
    outputDeliveredWithinBudget:true,endToEndCompletedWithinBudget:true,episodeCompletedWithinBudget:true,
    hardWallMs:5000,wallTimeMs:100,processExitWallTimeMs:101,finalReceivedMs:98,receiptValidatedMs:100,timeLimitSeconds:.2,objectiveMode:'joint',runtimeMs:2,
    perCallBudget:{configuration:clone(protocol.callBudgets[method]),interpretation:methods.indexOf(method)<2?'legacy optimizer-internal seconds; setup/audit extra':'cooperative whole-call milliseconds; not a hard per-call timer'},rows:[clone(priced)],
    storageCost:318500,ddCost:75000,totalCost:393500,sunkCost:331650,incrementalCost:61850,objectiveCost:61850,lateCount:0,
    revisionCount:0,timeline,plannerTrace,plannerStats:{...latest,planningWallMs:1,callWallMs:[.5,.5],maxCallWallMs:.5},
    usage:[{truck:1,warehouse:1,staging:1},{truck:1,warehouse:0,staging:0}],executionThroughDay:1,
    executedEvents:timeline.flatMap(entry=>entry.executedEvents),finalState:clone(timeline.at(-1).state),failure:null,
    terminalAudit:{engine:{valid:true,errors:[]},independentErrors:[]},auditErrors:[]};
}
function fixture(){return {id:'hand-built-fixture',nominalScenario:clone(nominal),scenario:clone(actual),events:[],policies:Object.fromEntries(methods.map(method=>[method,result(method)]))};}
function unknown(method){
  return {policy:method,status:'hard_time_limit',complete:false,auditValid:false,executionHistoryUnavailable:true,deadlineReached:true,
    outputDeliveredWithinBudget:false,endToEndCompletedWithinBudget:false,episodeCompletedWithinBudget:false,hardWallMs:5000,wallTimeMs:5000,processExitWallTimeMs:5001,finalReceivedMs:null,receiptValidatedMs:null,
    rows:[],timeline:[],executedEvents:[],plannerTrace:[],usage:[],revisionCount:null,finalState:null,
    totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,objectiveCost:null,lateCount:null,
    plannerStats:Object.fromEntries(['decisionCalls','solverCalls','constructorCalls','reusedPlans','replannedDueToInvalid','planningWallMs'].map(key=>[key,null]))};
}
const runner=`import importlib.util,json,sys
s=importlib.util.spec_from_file_location('review_v7',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
p=json.load(open(sys.argv[2]))
try:
 if p['action']=='episode': value=m.audit_episode(p['case'],p['case']['policies'][p['method']],p['method'],p['protocol'])
 elif p['action']=='initial': value=m.initial_comparison(p['case'])
 elif p['action']=='summary': value=m.summary(p['cases'])
 print(json.dumps({'valid':True,'value':value}))
except (ValueError,KeyError,TypeError,IndexError) as e:
 print(json.dumps({'valid':False,'error':str(e)}));sys.exit(1)
`;
async function review(payload){
  const directory=await mkdtemp(join(tmpdir(),'portplan-rolling-review-v7-'));
  try{
    const input=join(directory,'fixture.json');await writeFile(input,JSON.stringify(payload));
    const process=spawnSync('python',['-c',runner,script,input],{encoding:'utf8',timeout:10000});
    assert.equal(process.error,undefined,process.error?.message);assert.equal(process.stderr,'');
    return {status:process.status,report:JSON.parse(process.stdout)};
  }finally{await rm(directory,{recursive:true,force:true});}
}
test('hand-priced trajectories independently validate five methods, compact cache and a 30000 KRW same-snapshot polish decrease',async()=>{
  for(const method of methods){
    const {status,report}=await review({action:'episode',case:fixture(),method,protocol});
    assert.equal(status,0,report.error);assert.equal(report.value.complete,true);assert.equal(report.value.timelineEntries,2);
    assert.equal(report.value.pricedRows,1);
    assert.equal(report.value.polishBeforeAfterAudited,method==='costPolishV7'?1:0);
    assert.equal(report.value.polishSameSnapshotSavingsKRW,method==='costPolishV7'?30000:0);
  }
});
test('physical locks, fee tampering, compact commitment corruption, GRASP proof and parent audit overrun fail',async()=>{
  for(const [method,edit,match]of [
    ['lockedRecoveryV6',r=>{r.timeline[1].decisions[0].pickupDay=1;r.timeline[1].decisions[0].unloadDay=1;r.timeline[1].decisions[0].returnDay=2;},/changed executed|precedence\/deadline/],
    ['stableRetainV5',r=>{r.rows[0].storageCost+=1;},/storageCost/],
    ['lockedRecoveryV6',r=>{r.plannerTrace[1].stages.cacheAudit.rows.dateSHA256='wrong';},/cache date commitment/],
    ['graspBaselineV7',r=>{r.plannerTrace[0].globalOptimalityClaim=true;},/no-proof/],
    ['graspBaselineV7',r=>{r.plannerTrace[0].solverCalls=1;},/solverCalls/],
    ['stableRetainV5',r=>{r.terminalAudit.engine.errors=['contradictory error'];},/terminal dual audit/],
    ['stableRetainV5',r=>{r.timeline[1].status='unrecognized_failure';},/unsupported coordinator/],
    ['stableRetainV5',r=>{r.receiptValidatedMs=5001;},/receipt audit clock/],
  ]){
    const c=fixture();edit(c.policies[method]);const outcome=await review({action:'episode',case:c,method,protocol});
    assert.equal(outcome.status,1);assert.match(outcome.report.error,match);
  }
});
test('polish proofs require complete same-snapshot endpoints; MILP selection may be cheaper and different',async()=>{
  const method='costPolishV7';
  for(const [edit,match]of [
    [r=>{r.plannerTrace[0].polishMetadata.seedIncrementalCost+=1;},/seedIncrementalCost/],
    [r=>{r.plannerTrace[0].polishMetadata.beforeDates=[];},/incomplete container/],
    [r=>{r.plannerTrace[0].polishMetadata.afterDates=[{id:'T',pickupDay:1,unloadDay:1,returnDay:2}];},/finalIncrementalCost/],
    [r=>{r.plannerTrace[0].polishMetadata.acceptedMoveHistory[0].afterIncrementalCost=91850;},/nonstrict/],
  ]){
    const c=fixture();edit(c.policies[method]);const outcome=await review({action:'episode',case:c,method,protocol});
    assert.equal(outcome.status,1);assert.match(outcome.report.error,match);
  }
  const c=fixture(),r=c.policies[method],t=r.plannerTrace[0],p=t.polishMetadata;
  p.beforeDates=[{id:'T',pickupDay:1,unloadDay:1,returnDay:2}];p.afterDates=[{id:'T',pickupDay:0,unloadDay:0,returnDay:2}];
  p.seedIncrementalCost=p.seedObjectiveCost=273850;p.finalIncrementalCost=p.finalObjectiveCost=91850;
  p.acceptedMoveHistory=[{type:'single-relocation',beforeIncrementalCost:273850,afterIncrementalCost:91850,changedIds:['T']}];
  t.candidateSource='locked_milp';t.solverCalls=1;t.stages.locked_milp={status:'feasible',audit:{valid:true}};
  r.plannerTrace[1].solverCalls=r.plannerStats.solverCalls=1;
  let outcome=await review({action:'episode',case:c,method,protocol});assert.equal(outcome.status,0,outcome.report.error);
  const unchanged=fixture(),u=unchanged.policies[method],proof=u.plannerTrace[0].polishMetadata;
  proof.attempted=false;proof.beforeDates=clone(dates);proof.seedIncrementalCost=proof.seedObjectiveCost=61850;
  proof.acceptedMoves=0;proof.acceptedMoveHistory=[];u.plannerTrace[0].acceptedCostMoves=u.plannerTrace[1].acceptedCostMoves=u.plannerStats.acceptedCostMoves=0;
  outcome=await review({action:'episode',case:unchanged,method,protocol});assert.equal(outcome.status,0,outcome.report.error);
});
test('unknown hard deadline preserves null histories/counters and clock chronology is enforced',async()=>{
  const method='dailyReoptV4',c=fixture();c.policies[method]=unknown(method);
  let outcome=await review({action:'episode',case:c,method,protocol});assert.equal(outcome.status,0,outcome.report.error);assert.equal(outcome.report.value.historyAvailable,false);
  for(const edit of [r=>{r.plannerStats.solverCalls=0;},r=>{r.wallTimeMs=r.processExitWallTimeMs=0;},r=>{r.deadlineReached=false;}]){
    const changed=clone(c);edit(changed.policies[method]);outcome=await review({action:'episode',case:changed,method,protocol});assert.equal(outcome.status,1);
  }
  const success=fixture();success.policies[method].processExitWallTimeMs=0;
  outcome=await review({action:'episode',case:success,method,protocol});assert.equal(outcome.status,1);assert.match(outcome.report.error,/exit clock/);
  const runtime=fixture();runtime.policies[method].runtimeMs=101;
  outcome=await review({action:'episode',case:runtime,method,protocol});assert.equal(outcome.status,1);assert.match(outcome.report.error,/runtime exceeds/);
  const known=fixture(),r=known.policies.stableRetainV5,t=r.timeline[1];
  Object.assign(r,{status:'rolling_failed',complete:false,auditValid:false,episodeCompletedWithinBudget:false,rows:[],usage:[],failure:{day:1},executionThroughDay:0,
    finalState:clone(r.timeline[0].state),executedEvents:clone(r.timeline[0].executedEvents)});
  for(const key of ['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost','lateCount'])r[key]=null;
  Object.assign(t,{status:'planner_error',plannerStatus:'planner_error',decisions:[],executedEvents:[],state:clone(r.timeline[0].state)});
  delete t.plannerStatus; // Coordinator catch has status but no candidate status.
  Object.assign(r.plannerTrace[1],{plannerStatus:'planner_error',candidateSource:'planner_exception',error:'handcrafted throw after unknown internal search',solverCalls:null,constructorCalls:0,reusedPlans:null,replannedDueToInvalid:null});
  Object.assign(r.plannerStats,{solverCalls:null,constructorCalls:0,reusedPlans:null,replannedDueToInvalid:null});
  outcome=await review({action:'episode',case:known,method:'stableRetainV5',protocol});assert.equal(outcome.status,0,outcome.report.error);
  r.plannerTrace[1].solverCalls=r.plannerStats.solverCalls=0;
  outcome=await review({action:'episode',case:known,method:'stableRetainV5',protocol});assert.equal(outcome.status,1);assert.match(outcome.report.error,/solverCalls/);
});
test('unavailable, partial or unaudited initial candidates are null comparisons instead of equal empty plans',async()=>{
  const c=fixture();c.policies.dailyReoptV4=unknown('dailyReoptV4');
  let outcome=await review({action:'initial',case:c});assert.equal(outcome.status,0);assert.equal(outcome.report.value.allEqual,null);
  assert.equal(outcome.report.value.pairs.dailyReoptV4__stableRetainV5.decisionsEqual,null);
  const partial=fixture();partial.policies.dailyReoptV4.timeline[0].decisions=[];
  outcome=await review({action:'initial',case:partial});assert.equal(outcome.status,0);assert.equal(outcome.report.value.pairs.dailyReoptV4__stableRetainV5.evaluated,false);
  const unaudited=fixture();unaudited.policies.dailyReoptV4.timeline[0].audit.scheduleAudit.valid=false;
  outcome=await review({action:'initial',case:unaudited});assert.equal(outcome.status,0);assert.equal(outcome.report.value.allEqual,null);
});
test('summary counter denominators preserve unavailable episodes while monetary pairs exclude them',async()=>{
  const c=fixture();c.count=1;c.policies.dailyReoptV4=unknown('dailyReoptV4');
  c.initialComparison=(await review({action:'initial',case:c})).report.value;
  const outcome=await review({action:'summary',cases:[c]});assert.equal(outcome.status,0);
  const s=outcome.report.value;
  assert.equal(s.byMethod.dailyReoptV4.counters.solverCalls.observedSum,0);
  assert.equal(s.byMethod.dailyReoptV4.counters.solverCalls.knownEpisodeCount,0);
  assert.equal(s.byMethod.dailyReoptV4.counters.solverCalls.unknownEpisodeCount,1);
  assert.equal(s.comparisons.stableVsDaily.pairedCaseCount,0);assert.equal(s.comparisons.stableVsDaily.weightedTotalSavingsPct,null);
  assert.deepEqual(s.comparisons.stableVsDaily.gainedFromUnavailableHistoryCaseIds,[c.id]);
  assert.deepEqual(s.comparisons.stableVsDaily.gainedFromKnownFailureCaseIds,[]);
});
