import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {runRollingScenario} from '../src/rolling-plan.js';
import {runColdEpisodeV12,isCompleteV12} from '../scripts/benchmark-v12.mjs';
import {validateDeliveryProtocolV15,verifyDeliverySourcesV15,jobsForDeliveryV15,safeEvidencePathV15,runDeclaredDeliveryReplayV15,CALL_BUDGETS_DELIVERY_V15} from '../scripts/replay-delivery-v15.mjs';
import {runDeliveryReplayV15,prefixProjectionV15,evidenceHashV15,createDeliveryPlannerV15} from '../scripts/replay-delivery-v15.worker.mjs';
import {reconstructReplayEndpointV13,REPLAY_FEES_V13} from '../scripts/replay-guard-v13.worker.mjs';

async function fixtureInput(method='timelyHiGHSV15'){
  const nominalScenario={id:'handwritten-v15-cold-cache',horizonStart:'2026-10-17',horizonDays:9,truckCapacity:2,warehouseCapacity:1,stagingCapacity:2,
    operations:{returnLagDays:1,stagingUnit:'container'},containers:[{id:'fixture-C1',sizeFt:20,releaseDay:0,unloadDays:1,dueDay:8,
      dischargeDateTime:'2026-10-15T07:00:00+09:00',dataOrigin:'synthetic'}]};
  const events=[{id:'private-future-truck',resource:'truck',revealDay:7,capacity:0,duration:1}],dates=[{id:'fixture-C1',pickupDay:0,unloadDay:7,returnDay:8}],trace=[];
  let publicSnapshot,fixedEvents;
  const originalResult=await runRollingScenario(nominalScenario,events,{timeLimitSeconds:.2,planner:(snapshot,options)=>{
    const candidate=reconstructReplayEndpointV13(snapshot,dates,options.fixedEvents,options.minEventDay);
    trace.push({day:options.minEventDay,stabilitySelection:{afterFees:Object.fromEntries(REPLAY_FEES_V13.map(key=>[key,candidate[key]]))}});
    if(options.minEventDay===3){publicSnapshot=structuredClone(snapshot);fixedEvents=structuredClone(options.fixedEvents);}
    return candidate;
  }});
  assert.equal(originalResult.complete,true);originalResult.plannerTrace=trace;
  const caseDefinition={caseId:nominalScenario.id,repeatIndex:1,algorithmSeed:79011,interventionDay:3,publicSnapshot,fixedEvents,
    publicSnapshotSha256:evidenceHashV15(publicSnapshot),fixedEventsSha256:evidenceHashV15(fixedEvents),
    prefixProjectionSha256:evidenceHashV15(prefixProjectionV15(originalResult.timeline,3)),originalObservationHash:originalResult.timeline[3].observationHash};
  return {episodeId:'fixture-v15-'+method,method,caseId:nominalScenario.id,repeatIndex:1,algorithmSeed:79011,dailyBudgetMs:200,
    plannerConfiguration:CALL_BUDGETS_DELIVERY_V15[method],nominalScenario,events,originalResult,caseDefinition};
}

function fixtureFactory(configuration,captures={calls:[],ready:0,closed:0},behavior='native'){
  for(const key of ['events','originalResult','caseDefinition','enableDevelopmentEndpointImport'])assert.equal(Object.hasOwn(configuration,key),false);
  const dates=[{id:'fixture-C1',pickupDay:0,unloadDay:7,returnDay:8}];
  const planner=async(snapshot,options)=>{
    captures.calls.push({snapshot:structuredClone(snapshot),options:structuredClone(options)});
    if(behavior==='missing')return null;
    const candidate=reconstructReplayEndpointV13(snapshot,dates,options.fixedEvents,options.minEventDay);
    candidate.plannerMetadata={solverCalls:captures.calls.length,decisionCalls:captures.calls.length,candidateSource:behavior==='constructor'?'quick_constructor':'native_highs',
      stabilitySelection:{cacheStatus:captures.calls.length===1?'absent':'valid',beforeDates:captures.calls.length===1?null:structuredClone(dates)},
      nativeCertificate:{fixture:true,hasIncumbent:behavior!=='constructor',allUnacceptedLateRows:[{proof:'retain-this-raw'}]}};
    if(behavior==='illegal_import')candidate.plannerMetadata.developmentEndpointImport={accepted:true,sourceDates:dates};
    return candidate;
  };
  planner.ready=async()=>{captures.ready++;};planner.close=async()=>{captures.closed++;};
  return planner;
}

test('V15 binds every original repeat from the four seen loss cases, without generating or solving',async()=>{
  const protocol=JSON.parse(await fs.readFile(new URL('../data/protocol-development-v15.json',import.meta.url)));
  assert.equal(validateDeliveryProtocolV15(protocol),protocol);assert.deepEqual(jobsForDeliveryV15(protocol.endpoints),protocol.jobs);
  const report=await verifyDeliverySourcesV15(protocol);assert.equal(report.verifiedSourceCount,18);assert.equal(report.archivedEndpointCount,12);assert.equal(report.plannedRuns,36);assert.equal(report.optimizerCalls,0);
  assert.equal(protocol.endpoints.filter(row=>row.originalLossEpisode).length,8);assert.equal(protocol.endpoints.filter(row=>row.originalComplete).length,4);
  for(const endpoint of protocol.endpoints)assert.equal(protocol.jobs.filter(row=>row.endpointId===endpoint.endpointId).length,3);
  for(const change of [x=>x.jobs.reverse(),x=>x.endpoints.splice(2,1),x=>x.endpoints[0].algorithmSeed=79039,x=>x.budget.dailyBudgetMs=210,x=>x.callBudgets.timelyHiGHSV15.nativeReturnReserveMs=15]){
    const modified=structuredClone(protocol);change(modified);assert.throws(()=>validateDeliveryProtocolV15(modified));
  }
});

test('V15 rejects unsafe evidence, arbitrary planners and implicit runtime authorization',async()=>{
  for(const name of ['../escape','/absolute','a/../b','a//b','a\\b','a\0b'])assert.throws(()=>safeEvidencePathV15(name));
  await assert.rejects(createDeliveryPlannerV15('arbitraryMethod',{}),/Only the three/);
  await assert.rejects(createDeliveryPlannerV15('timelyHiGHSV15',{enableDevelopmentEndpointImport:true}),/Forbidden injected/);
  await assert.rejects(runDeclaredDeliveryReplayV15('/does-not-exist'),/Root must separately authorize/);
});

test('handwritten V15 slice preserves the full physical prefix, never imports cache and reveals future only on time',async()=>{
  const input=await fixtureInput(),captures={calls:[],ready:0,closed:0};
  const result=await runDeliveryReplayV15(input,{plannerFactoryForTest:config=>fixtureFactory(config,captures)});
  assert.equal(result.complete,true);assert.equal(result.auditValid,true);assert.equal(captures.ready,1);assert.equal(captures.closed,1);
  assert.equal(result.replayPrefixChecks.length,3);assert.equal(evidenceHashV15(prefixProjectionV15(result.timeline,3)),input.caseDefinition.prefixProjectionSha256);
  assert.equal(result.historicalCacheImported,false);assert.equal(result.naturalFullD0,false);assert.equal(captures.calls[0].options.minEventDay,3);
  assert.equal(captures.calls[0].snapshot.truckCapacity[7],2);assert.equal(captures.calls.find(row=>row.options.minEventDay===7).snapshot.truckCapacity[7],0);
  for(const call of captures.calls)for(const value of [call.snapshot,call.options])for(const key of ['events','futureEvents','actualScenario','realizedScenario','unrevealedEvents','originalResult','caseDefinition'])assert.equal(Object.hasOwn(value,key),false);
  assert.ok(result.plannerTrace.slice(0,3).every(row=>row.phase==='archived_prefix'&&row.actualNativeRequests===0&&row.claimsNativeDiscovery===false&&row.forcedStepTimely));
  assert.equal(result.plannerTrace[3].phase,'cold_cache_intervention');assert.equal(result.plannerTrace[3].metadata.stabilitySelection.beforeDates,null);
  assert.equal(result.plannerTrace[3].metadata.nativeCertificate.allUnacceptedLateRows[0].proof,'retain-this-raw');
  assert.equal(result.plannerStats.actualDecisionCalls,6);assert.equal(result.plannerStats.solverCalls,6);
});

test('constructor or missing native candidates do not acquire native-discovery claims, and failures retain null fees',async()=>{
  const input=await fixtureInput();
  const constructed=await runDeliveryReplayV15(input,{plannerFactoryForTest:config=>fixtureFactory(config,undefined,'constructor')});
  assert.equal(constructed.complete,true);assert.equal(constructed.plannerTrace[3].claimsNativeDiscovery,false);assert.equal(constructed.plannerTrace[3].selectedSource,'quick_constructor');
  const captures={calls:[],ready:0,closed:0},missing=await runDeliveryReplayV15(input,{plannerFactoryForTest:config=>fixtureFactory(config,captures,'missing')});
  assert.equal(missing.complete,false);assert.equal(missing.failure.day,3);assert.equal(missing.totalCost,null);assert.equal(missing.incrementalCost,null);
  assert.equal(missing.plannerTrace.at(-1).plannerStatus,'missing_result');assert.equal(missing.plannerTrace.at(-1).actualNativeRequests,null);assert.equal(captures.calls.length,1);assert.equal(captures.closed,1);
});

test('forbidden development import receipt is preserved before rejection',async()=>{
  const input=await fixtureInput(),result=await runDeliveryReplayV15(input,{plannerFactoryForTest:config=>fixtureFactory(config,undefined,'illegal_import')});
  assert.equal(result.complete,false);assert.equal(result.failure.day,3);assert.equal(result.totalCost,null);
  assert.equal(result.plannerTrace[3].metadata.developmentEndpointImport.accepted,true);assert.match(result.plannerTrace[3].error,/No historical cache imports/);
});

test('mocked cold V15 branch uses the frozen 5s normal-exit and ESRCH parent lifecycle',async()=>{
  const directory=await fs.mkdtemp(join(tmpdir(),'portplan-v15-cold-fixture-'));
  try{
    const worker=join(directory,'fixture-worker.mjs'),workerURL=new URL('../scripts/replay-delivery-v15.worker.mjs',import.meta.url).href,
      replayURL=new URL('../scripts/replay-guard-v13.worker.mjs',import.meta.url).href;
    await fs.writeFile(worker,`import assert from 'node:assert/strict';import {runDeliveryReplayV15} from ${JSON.stringify(workerURL)};import {reconstructReplayEndpointV13} from ${JSON.stringify(replayURL)};\n${fixtureFactory.toString()}\nprocess.once('message',async input=>{const result=await runDeliveryReplayV15(input,{plannerFactoryForTest:fixtureFactory});process.send({type:'final',episodeId:input.episodeId,method:input.method,result},()=>process.disconnect());});\n`);
    const result=await runColdEpisodeV12(await fixtureInput(),{hardWallMs:5000,workerScript:worker});
    assert.equal(isCompleteV12(result),true,JSON.stringify(result.failure));assert.equal(result.normalWorkerExit,true);assert.equal(result.processGroupCleanup.verificationResult,'ESRCH');
    assert.equal(result.historicalCacheImported,false);assert.equal(result.replayPrefixChecks.length,3);assert.equal(result.timeline.length,9);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});
