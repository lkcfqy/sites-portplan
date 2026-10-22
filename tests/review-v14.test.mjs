import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {rowFor,summarize} from '../src/engine.js';
import {runRollingScenario} from '../src/rolling-plan.js';

const FEES=['storageCost','ddCost','totalCost','sunkCost','incrementalCost','objectiveCost'];
const fees=x=>Object.fromEntries(FEES.map(k=>[k,x[k]]));
const dates=x=>x.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const audit=()=>({valid:true,errors:[],scheduleAudit:{valid:true,errors:[]},freezeAudit:{valid:true,errors:[]}});
const inactiveGuard=()=>({attempted:false,complete:false,timely:null,eligible:false,decision:'not_applicable',reason:'no_strict_fee_decrease',
  incumbentSource:null,incumbentDates:null,incumbentFees:null,proposalDates:null,proposalFees:null,incumbentM:null,proposalM:null,selectedM:null,
  scoringStartedAtMs:null,scoringFinishedAtMs:null,comparisonFinishedAtMs:null,acceptedAtMs:null,rejectedAtMs:null,error:null});
const emptyScore=()=>({attempted:false,complete:false,cache:null,proposal:null,beforeM:null,proposalM:null,selectedM:null,
  startedAtMs:null,finishedAtMs:null,timely:null,skipReason:'no_valid_fee_tie',error:null});

async function naturalFixture(){
  const s={id:'handwritten-natural-v14',horizonStart:'2026-10-13',horizonDays:4,truckCapacity:4,warehouseCapacity:2,stagingCapacity:2,
    containers:[{id:'A',sizeFt:20,releaseDay:0,unloadDays:1,dueDay:3,dischargeDateTime:'2026-10-13T07:00:00+09:00',dataOrigin:'synthetic'}]};
  const seed=summarize(s,'handwritten',[rowFor(s,s.containers[0],0,0,1)],0),trace=[];
  let previous=null;
  const result=await runRollingScenario(s,[],{planner:async(_observed,o)=>{
    const before=previous,source=before?'cached_incumbent':'quick_constructor';
    const event={sequence:1,source:'quick_constructor',receivedAtMs:1,copiedAtMs:2,auditFinishedAtMs:3,selectionFinishedAtMs:4,
      acceptedAtMs:5,proposedDates:dates(seed.rows),dates:dates(seed.rows),fees:fees(seed),outcome:'accepted',audit:{valid:true,errors:[]}};
    const proof={rule:'strict_fee_requires_no_m_increase_ties_require_lower_m',feeEpsilonKRW:1e-6,cacheStatus:before?'valid':'absent',cacheValid:!!before,
      beforeDates:before?dates(before.rows):null,beforeFees:before?fees(before):null,proposalDates:null,proposalFees:null,afterDates:dates(seed.rows),afterFees:fees(seed),
      nativeCostMinusCacheKRW:null,nativeCostMinusIncumbentKRW:null,cacheCostMinusSelectedKRW:before?0:null,changedEventCount:before?0:null,proposalChangedEventCount:null,
      decisionReason:before?'retain_without_timely_valid_native':'timely_complete_constructor',selectedSource:source,commitmentScore:emptyScore(),strictFeeGuard:inactiveGuard(),
      publicCapacities:Object.fromEntries(['truck','warehouse','staging'].map(k=>[k,Array(s.horizonDays).fill(s[k+'Capacity'])])),
      cacheGate:before?{auditFinishedAtMs:1,selectionFinishedAtMs:1.25,acceptedAtMs:1.5}:{auditFinishedAtMs:null,selectionFinishedAtMs:null,acceptedAtMs:null},
      constructorDelivery:{budgetMs:40,auditReserveMs:5,maxRestarts:3,deadlineAtMs:before?null:40,events:before?[]:[event],firstAcceptedAtMs:before?null:5,
        selectedAcceptanceAtMs:before?null:5,returnedResultUsedAsReceipt:false},
      preNativeIncumbent:{source,dates:dates(seed.rows),fees:fees(seed),acceptedAtMs:before?1.5:5},
      nativeGate:{receivedAtMs:10,copiedAtMs:null,auditFinishedAtMs:null,feesMatchedAtMs:null,selectionFinishedAtMs:null,acceptedAtMs:null,outcome:'no_incumbent'}};
    trace.push({day:o.minEventDay,callWallMs:20,metadata:{timeBudgetMs:200,wallTimeMs:20,candidateSource:source,stabilitySelection:proof,
      developmentEndpointImport:null,decisionCalls:o.minEventDay+1,solverCalls:0,strictReplacementCount:0,tieRetainedCount:0,commitmentReplacementCount:0,
      constructorCalls:1,acceptedConstructorReceipts:1,nativeCertificate:{hasIncumbent:false,solverThreads:1},
      stages:{...(before?{cacheAudit:audit()}:{}),quickConstructor:before?{status:'valid_cache_skip'}:
        {status:'feasible',returnedCompleteCandidate:true,returnedCandidateAccepted:false,acceptedReceiptCount:1},native:{status:'budget_skipped'}}}});
    previous=seed;return seed;
  }});
  assert.equal(result.complete,true);
  return {nominalScenario:s,events:[],result:{...result,policy:'guardedHiGHSV13',auditValid:true,plannerTrace:trace,hardWallMs:5000,
    wallTimeMs:100,outputDeliveredWithinBudget:true,executionHistoryUnavailable:false,finalReceivedMs:90,receiptValidatedMs:100}};
}

async function check(record){
  const dir=await mkdtemp(join(tmpdir(),'portplan-v14-handwritten-'));
  try{const file=join(dir,'fixture.json');await writeFile(file,JSON.stringify(record));
    return spawnSync('python3',['scripts/review-v14.py','--episode',file,'--fixture'],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  }finally{await rm(dir,{recursive:true,force:true});}
}
async function rejects(change,pattern){const record=await naturalFixture();change(record);const r=await check(record);
  assert.notEqual(r.status,0,r.stdout);if(pattern)assert.match(r.stderr,pattern);}

test('natural D0 guarded policy accepts only its copied constructor and retains current complete physical history',async()=>{
  const r=await check(await naturalFixture());assert.equal(r.status,0,r.stderr);const reviewed=JSON.parse(r.stdout);
  assert.equal(reviewed.fixture,true);assert.equal(reviewed.solverRuns,0);assert.equal(reviewed.checked.guardedSelection.acceptedConstructorReceipts,1);
  assert.equal(reviewed.checked.actualNativeRequests,0);
});
test('formal natural D0 rejects development import, replay prefix, and forged natural call counters',async()=>{
  await rejects(r=>{r.result.plannerTrace[0].metadata.developmentEndpointImport={accepted:true};},/no development import/);
  await rejects(r=>{r.result.replayPrefixChecks=[];},/forced-replay evidence/);
  await rejects(r=>{r.result.plannerTrace[0].phase='archived_prefix';},/prefix was forced/);
  await rejects(r=>{r.result.plannerTrace[0].metadata.decisionCalls=0;},/natural D0 decision count/);
  await rejects(r=>{r.result.plannerTrace[0].metadata.solverCalls=2;},/native request counter/);
});
test('constructor copy audit final acceptance and selected full dates remain independently bound',async()=>{
  await rejects(r=>{r.result.plannerTrace[0].metadata.stabilitySelection.constructorDelivery.events[0].acceptedAtMs=41;},/after deadline/);
  await rejects(r=>{r.result.plannerTrace[0].metadata.stabilitySelection.preNativeIncumbent.dates[0].returnDay=2;},/pre-native incumbent/);
  await rejects(r=>{r.result.plannerTrace[0].metadata.stabilitySelection.afterDates[0].returnDay=2;},/selected complete dates/);
  await rejects(r=>{r.result.plannerTrace[1].metadata.constructorCalls=0;},/natural cumulative/);
});
test('unknown physical history cannot become apparent execution or zero-valued failure fees',async()=>{
  await rejects(r=>{r.result.executionHistoryUnavailable=true;},/unknown physical history/);
  await rejects(r=>{r.result.complete=false;},/null complete fees/);
});
test('portable provenance, full seven-method scalar/raw I/O and independent strict M fixtures use no solver',()=>{
  const r=spawnSync('python3',['tests/review-v14-fixtures.py','-v'],{cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:30000});
  assert.equal(r.status,0,r.stdout+'\n'+r.stderr);assert.match(r.stderr,/Ran \d+ tests/);
});
