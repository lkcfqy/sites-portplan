import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {ROLLING_METHODS_V6,FROZEN_PROTOCOL_HASH_V6,loadProtocolV6,runColdEpisodeV6,summarizeRollingV6,compareInitialPlansV6,realizeDeclaredShocksV6,loadDevelopmentInputsV6,isCompleteV6} from '../scripts/rolling-benchmark-v6.mjs';
import {unknownEpisodeV6} from '../scripts/rolling-v6.worker.mjs';
import {independentAuditV2} from '../scripts/benchmark-v2.mjs';

const tiny=()=>({id:'manual-v6-episode',horizonStart:'2026-10-12',horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:2,
  containers:[{id:'manual',sizeFt:20,releaseDay:0,unloadDays:1,dueDay:2,dischargeDateTime:'2026-10-10T07:00:00+09:00',dataOrigin:'synthetic'}]});

test('V6 protocol retains declared factorial and budgets without generating new orders',async()=>{
  const {protocol,protocolHash}=await loadProtocolV6();assert.equal(protocolHash,FROZEN_PROTOCOL_HASH_V6);
  assert.deepEqual(protocol.primaryCases.map(c=>c.seed),Array.from({length:36},(_,i)=>81001+i));
  for(const mechanism of ['aged-backlog','new-arrivals','batch-release'])for(const capacityProfile of ['balanced','tight'])for(const count of [24,50,100])
    assert.equal(protocol.primaryCases.filter(c=>c.mechanism===mechanism&&c.capacityProfile===capacityProfile&&c.count===count).length,2);
  assert.equal(protocol.budget.hardWallMs,5000);
  assert.equal(protocol.callBudgets.dailyReoptV4.timeLimitSeconds,.2);
  assert.equal(protocol.callBudgets.lockedRecoveryV6.timeBudgetMs,200);
  assert.equal(protocol.callBudgets.persistenceRecoveryV6.persistenceDays,1);
});

test('shock reductions use declared ceil arithmetic and development controls preserve all 24 prior inputs',async()=>{
  const nominal={truckCapacity:[10,7,5,3]},events=realizeDeclaredShocksV6(nominal,[{id:'manual-shock',resource:'truck',revealDay:1,duration:2,reductionNumerator:2,reductionDenominator:5}]);
  assert.equal(events[0].capacity,4);assert.equal(events[0].duration,2);assert.equal(events[0].announcedDuration,undefined);
  assert.equal(events[0].reductionNumerator,undefined);
  const {protocol}=await loadProtocolV6(),controls=await loadDevelopmentInputsV6(protocol);
  const previous=JSON.parse(await readFile(new URL('../data/rolling-v5.json',import.meta.url),'utf8'));
  assert.equal(controls.length,24);
  for(const c of controls) {
    const old=previous.cases.find(x=>x.id===c.referenceCaseId);assert.ok(old);
    assert.equal(c.id,c.referenceCaseId+protocol.developmentControls.suffix);
    assert.deepEqual(c.nominalScenario,old.nominalScenario);assert.deepEqual(c.events,old.events);assert.equal(c.dataRole,'development-control');
  }
});

test('cold hard deadline discards mid-episode progress and preserves unknown physical history and counters',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'portplan-v6-deadline-'));
  try {
    const fixture=join(dir,'worker.mjs');
    await writeFile(fixture,`process.once('message',input=>{process.send({type:'progress',episodeId:input.episodeId,method:input.method,calls:1,executedEvents:[{}]});const end=Date.now()+600;while(Date.now()<end){};process.send({type:'final',episodeId:input.episodeId,method:input.method,result:{status:'feasible',complete:true,auditValid:true,rows:[{}],totalCost:0,incrementalCost:0}});});\n`);
    const result=await runColdEpisodeV6({method:'lockedRecoveryV6',nominalScenario:tiny(),events:[]},{hardWallMs:180,workerScript:fixture});
    assert.equal(result.status,'hard_time_limit');assert.equal(result.complete,false);assert.equal(result.executionHistoryUnavailable,true);
    assert.equal(result.outputDeliveredWithinBudget,false);assert.equal(result.exitSignal,'SIGKILL');
    assert.deepEqual(result.timeline,[]);assert.deepEqual(result.executedEvents,[]);assert.deepEqual(result.rows,[]);assert.equal(result.revisionCount,null);
    for(const value of Object.values(result.plannerStats))assert.equal(value,null);
    for(const key of ['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost'])assert.equal(result[key],null);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('only timely matching terminal envelopes deliver known failure history; wrong envelopes remain unknown',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'portplan-v6-final-'));
  try {
    const fixture=join(dir,'worker.mjs');
    await writeFile(fixture,`process.once('message',input=>{process.send({type:'final',episodeId:input.episodeId,method:input.method,result:{status:'rolling_failed',complete:false,executionHistoryUnavailable:false,rows:[],timeline:[{day:0,status:'executed'}],executedEvents:[{day:0}],revisionCount:2,totalCost:999,incrementalCost:999,plannerStats:{decisionCalls:2,solverCalls:2}}},()=>process.disconnect());});\n`);
    const result=await runColdEpisodeV6({method:'dailyReoptV4',nominalScenario:tiny(),events:[]},{hardWallMs:500,workerScript:fixture});
    assert.equal(result.status,'rolling_failed');assert.equal(result.executionHistoryUnavailable,false);assert.equal(result.outputDeliveredWithinBudget,true);
    assert.equal(result.plannerStats.decisionCalls,2);assert.equal(result.revisionCount,2);assert.equal(result.executedEvents.length,1);assert.equal(result.totalCost,null);
    await writeFile(fixture,`process.once('message',input=>{process.send({type:'final',episodeId:'wrong-episode',method:input.method,result:{status:'rolling_failed',complete:false,timeline:[{day:0}],plannerStats:{decisionCalls:0}}},()=>process.disconnect());});\n`);
    const wrong=await runColdEpisodeV6({method:'dailyReoptV4',nominalScenario:tiny(),events:[]},{hardWallMs:500,workerScript:fixture});
    assert.equal(wrong.executionHistoryUnavailable,true);assert.equal(wrong.outputDeliveredWithinBudget,false);assert.equal(wrong.plannerStats.decisionCalls,null);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('initial equality excludes empty, partial, duplicate and unaudited plans and compares valid dates without row order',()=>{
  const s=tiny();
  const initial=(r=1)=>({timeline:[{day:0,status:'executed',observationHash:'same-visible-information',audit:{scheduleAudit:{valid:true},freezeAudit:{valid:true}},decisions:[{id:'manual',pickupDay:0,unloadDay:0,returnDay:r}]}]});
  const policies=Object.fromEntries(ROLLING_METHODS_V6.map(m=>[m,{timeline:[]}]));
  let result=compareInitialPlansV6(s,policies);assert.equal(result.allEqual,null);assert.deepEqual(result.eligibleMethods,[]);
  for(const m of ROLLING_METHODS_V6)policies[m]=initial();result=compareInitialPlansV6(s,policies);assert.equal(result.allEqual,true);
  policies.persistenceRecoveryV6=initial(2);result=compareInitialPlansV6(s,policies);assert.equal(result.allEqual,false);
  policies.persistenceRecoveryV6.timeline[0].audit.freezeAudit.valid=false;result=compareInitialPlansV6(s,policies);assert.equal(result.allEqual,null);
  policies.persistenceRecoveryV6=initial();policies.persistenceRecoveryV6.timeline[0].decisions[0].returnDay=Infinity;
  assert.equal(compareInitialPlansV6(s,policies).allEqual,null);
  policies.persistenceRecoveryV6=initial();policies.persistenceRecoveryV6.timeline[0].decisions.push({...policies.persistenceRecoveryV6.timeline[0].decisions[0]});
  assert.equal(compareInitialPlansV6(s,policies).allEqual,null);
});

test('V6 summaries disclose unknown call coverage, negative fees, zero bases and paired revision counts',()=>{
  const complete=(total,incremental,revision,calls)=>({status:'feasible',complete:true,auditValid:true,rows:[{}],totalCost:total,incrementalCost:incremental,revisionCount:revision,
    executionHistoryUnavailable:false,outputDeliveredWithinBudget:true,plannerStats:{decisionCalls:calls,solverCalls:calls,constructorCalls:0,reusedPlans:0,replannedDueToInvalid:0,planningWallMs:10,callWallMs:[10]},wallTimeMs:20});
  const unknown=()=>unknownEpisodeV6('test','no final','hard_time_limit');
  const failed={status:'rolling_failed',complete:false,auditValid:false,rows:[],totalCost:null,incrementalCost:null,revisionCount:1,executionHistoryUnavailable:false,
    outputDeliveredWithinBudget:true,plannerStats:{decisionCalls:1,solverCalls:1,constructorCalls:0,reusedPlans:0,replannedDueToInvalid:0,planningWallMs:5,callWallMs:[5]}};
  const cases=[{id:'pair',count:24,policies:{dailyReoptV4:complete(100,0,10,2),stableRetainV5:complete(100,0,10,2),lockedRecoveryV6:complete(110,0,4,1),persistenceRecoveryV6:complete(110,0,4,1)}},
    {id:'unknown',count:24,policies:{dailyReoptV4:unknown(),stableRetainV5:unknown(),lockedRecoveryV6:complete(50,0,3,2),persistenceRecoveryV6:complete(50,0,3,2)}},
    {id:'known-failure',count:50,policies:{dailyReoptV4:failed,stableRetainV5:failed,lockedRecoveryV6:unknown(),persistenceRecoveryV6:unknown()}}];
  const summary=summarizeRollingV6(cases),pair=summary.comparisons.lockedVsStable;
  assert.equal(pair.pairedCaseCount,1);assert.equal(pair.totalSavingsKRW,-10);assert.equal(pair.weightedTotalSavingsPct,-10);
  assert.equal(pair.negativeSavingsCount,1);assert.equal(pair.zeroBaselineIncrementalCount,1);assert.equal(pair.weightedIncrementalSavingsPct,null);assert.equal(pair.revisionReductionPct,60);
  assert.equal(summary.byMethod.stableRetainV5.executionHistoryUnavailableCount,1);assert.equal(summary.byMethod.stableRetainV5.knownExecutionFailureCount,1);
  assert.deepEqual(summary.byMethod.stableRetainV5.counters.decisionCalls,{observedSum:3,knownEpisodeCount:2,unknownEpisodeCount:1});
  assert.equal(summary.byMethod.lockedRecoveryV6.completeCount,2);assert.equal(summary.byMethod.lockedRecoveryV6.knownExecutionFailureCount,0);
  assert.deepEqual(pair.gainedFromUnavailableHistoryCaseIds,['unknown']);assert.deepEqual(pair.gainedFromKnownFailureCaseIds,[]);
});

test('four real cold factories deliver independently audited execution on a handcrafted episode',async()=>{
  const s=tiny();
  for(const method of ROLLING_METHODS_V6) {
    const result=await runColdEpisodeV6({nominalScenario:s,events:[],method},{hardWallMs:2000});
    assert.equal(isCompleteV6(result),true,`${method}: ${result.status} ${JSON.stringify(result.failure)}`);
    assert.equal(result.executionHistoryUnavailable,false);assert.ok(result.finalReceivedMs<=2000);assert.deepEqual(independentAuditV2(s,result),[]);
    assert.equal(result.plannerStats.decisionCalls,result.plannerTrace.length);assert.equal(result.plannerStats.callWallMs.length,result.plannerTrace.length);
    assert.equal(result.terminalAudit.engine.valid,true);assert.deepEqual(result.terminalAudit.independentErrors,[]);
  }
});

let archiveExists=true;
try {await access(new URL('../data/rolling-v6.json',import.meta.url));}catch{archiveExists=false;}
test('completed V6 archive preserves prospective cells, all old controls, audits and source snapshot',{skip:!archiveExists},async()=>{
  const data=JSON.parse(await readFile(new URL('../data/rolling-v6.json',import.meta.url),'utf8')),{protocol}=await loadProtocolV6();
  assert.equal(data.executionState,'complete');assert.equal(data.protocolHash,FROZEN_PROTOCOL_HASH_V6);
  assert.deepEqual(data.cases.map(c=>c.id),protocol.primaryCases.map(c=>c.id));assert.equal(data.developmentControls.cases.length,24);
  assert.deepEqual(data.summary,summarizeRollingV6(data.cases));assert.deepEqual(data.developmentControls.summary,summarizeRollingV6(data.developmentControls.cases));
  const controls=await loadDevelopmentInputsV6(protocol);
  for(const c of data.developmentControls.cases) {
    const expected=controls.find(x=>x.id===c.id);assert.deepEqual(c.nominalScenario,expected.nominalScenario);assert.deepEqual(c.events,expected.events);
  }
  for(const c of [...data.cases,...data.developmentControls.cases])for(const result of Object.values(c.policies)) {
    assert.equal(result.hardWallMs,5000);
    if(isCompleteV6(result)){assert.deepEqual(independentAuditV2(c.scenario,result),[]);assert.ok(result.finalReceivedMs<=5000);}
    else for(const key of ['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost'])assert.equal(result[key],null);
    if(result.executionHistoryUnavailable){assert.equal(result.plannerStats.decisionCalls,null);assert.deepEqual(result.timeline,[]);assert.equal(result.revisionCount,null);}
  }
  for(const [path,hash]of Object.entries(data.implementationHashes)) {
    const bytes=await readFile(new URL('../vendor/experiments/v6-first-run-source/'+path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
  }
});
