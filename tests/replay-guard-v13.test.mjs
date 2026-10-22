import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {rowFor,summarize} from '../src/engine.js';
import {runRollingScenario} from '../src/rolling-plan.js';
import {runColdEpisodeV12,isCompleteV12,compactEpisodeReceiptV12} from '../scripts/benchmark-v12.mjs';
import {validateReplayProtocolV13,verifyReplaySourcesV13,jobsForV13,safeEvidencePathV13,runDeclaredReplayV13,summarizeReplayV13,assertFrozenProtocolBindingV13} from '../scripts/replay-guard-v13.mjs';
import {canonicalJSONV13,evidenceHashV13,prefixProjectionV13,reconstructReplayEndpointV13,runReplayGuardBranchV13,REPLAY_FEES_V13} from '../scripts/replay-guard-v13.worker.mjs';

const configuration={timeBudgetMs:200,timeLimitSeconds:.2,constructorBudgetMs:40,constructorAuditReserveMs:5,maxRestarts:3};
async function handcraftedInput(branch='forced_native'){
  const nominalScenario={id:'handwritten-seen-v13',horizonStart:'2026-10-12',horizonDays:9,truckCapacity:2,warehouseCapacity:1,stagingCapacity:2,
    operations:{returnLagDays:1,stagingUnit:'container'},containers:[{id:'manual-C1',sizeFt:20,releaseDay:0,unloadDays:1,dueDay:8,
      dischargeDateTime:'2026-10-10T07:00:00+09:00',dataOrigin:'synthetic'}]};
  const events=[{id:'private-later-truck',resource:'truck',revealDay:7,capacity:0,duration:1}],seed=[{id:'manual-C1',pickupDay:0,unloadDay:6,returnDay:7}],
    native=[{id:'manual-C1',pickupDay:0,unloadDay:7,returnDay:8}],trace=[];
  let publicSnapshot,fixedEvents;
  const originalResult=await runRollingScenario(nominalScenario,events,{timeLimitSeconds:.2,planner:(snapshot,options)=>{
    const chosen=options.minEventDay<5?seed:native;
    const candidate=reconstructReplayEndpointV13(snapshot,chosen,options.fixedEvents,options.minEventDay);
    trace.push({day:options.minEventDay,stabilitySelection:{afterFees:Object.fromEntries(REPLAY_FEES_V13.map(k=>[k,candidate[k]]))}});
    if(options.minEventDay===5){publicSnapshot=structuredClone(snapshot);fixedEvents=structuredClone(options.fixedEvents);}
    return candidate;
  }});
  assert.equal(originalResult.complete,true);originalResult.plannerTrace=trace;
  const endpoints=Object.fromEntries([['seed',seed],['native',native]].map(([key,dates])=>{
    const candidate=reconstructReplayEndpointV13(publicSnapshot,dates,fixedEvents,5);
    return [key,{dates,datesSha256:evidenceHashV13(dates),fees:Object.fromEntries(REPLAY_FEES_V13.map(k=>[k,candidate[k]]))}];
  }));
  const prefixProjectionSha256=evidenceHashV13(prefixProjectionV13(originalResult.timeline));
  const caseDefinition={caseId:nominalScenario.id,publicSnapshot,fixedEvents,endpoints,prefixProjectionSha256,originalObservationHash:originalResult.timeline[5].observationHash,
    identity:{publicSnapshotSha256:evidenceHashV13(publicSnapshot),fixedEventsSha256:evidenceHashV13(fixedEvents),prefixProjectionSha256,
      seedDatesSha256:endpoints.seed.datesSha256,nativeDatesSha256:endpoints.native.datesSha256}};
  return {episodeId:'handwritten-'+branch,method:'controlledGuardReplayV13',caseId:nominalScenario.id,branch,endpointKey:branch==='forced_seed'?'seed':'native',
    algorithmSeed:69011,timingRepeatIndex:1,dailyBudgetMs:200,plannerConfiguration:configuration,nominalScenario,events,originalResult,caseDefinition};
}

function mockFactory(configuration,captures={calls:[],ready:0,closed:0,imports:0},rejectImport=false){
  assert.equal(configuration.enableDevelopmentEndpointImport,true);let stored;
  const planner=async(snapshot,options)=>{
    captures.calls.push({snapshot:structuredClone(snapshot),options:structuredClone(options)});
    const candidate=reconstructReplayEndpointV13(snapshot,stored,options.fixedEvents,options.minEventDay);
    candidate.plannerMetadata={solverCalls:captures.calls.length,stabilitySelection:{strictFeeGuard:{decision:'handwritten-fixture',proof:{dates:structuredClone(stored)}}},
      nativeCertificate:{fixture:true,rawProof:Array.from({length:80},(_,sequence)=>({sequence,dates:structuredClone(stored)}))}};
    return candidate;
  };
  planner.ready=async()=>{captures.ready++;};planner.close=async()=>{captures.closed++;};
  planner.importDevelopmentEndpoint=(snapshot,dates,options)=>{
    captures.imports++;const startedAtMs=performance.now();
    const candidate=reconstructReplayEndpointV13(snapshot,dates,options.fixedEvents,options.minEventDay);
    if(!rejectImport)stored=structuredClone(dates);
    return {accepted:!rejectImport,status:rejectImport?'late_commit':'accepted',audit:{valid:true,errors:[]},decisionCalls:0,solverCalls:0,
      claimsNativeDiscovery:false,claimsPhysicalExecution:false,startedAtMs,deadlineMs:options.deadlineMs,acceptedAtMs:rejectImport?null:performance.now()-startedAtMs,
      snapshot:structuredClone(snapshot),sourceDates:structuredClone(dates),canonicalDates:structuredClone(dates),fixedEvents:structuredClone(options.fixedEvents),minEventDay:5,
      fees:Object.fromEntries(REPLAY_FEES_V13.map(key=>[key,candidate[key]]))};
  };
  return planner;
}

test('V13 declares exactly two seen case pairs, twelve rotated clock runs and unchanged bound originals without solving',async()=>{
  const protocol=JSON.parse(await fs.readFile(new URL('../data/protocol-development-v13.json',import.meta.url)));
  assert.equal(validateReplayProtocolV13(protocol),protocol);assert.deepEqual(jobsForV13(protocol.cases),protocol.jobs);
  const checked=await verifyReplaySourcesV13(protocol);assert.equal(checked.verifiedSourceCount,24);assert.equal(checked.optimizerCalls,0);
  assert.equal(checked.uniqueBusinessScenarioCount,2);assert.equal(checked.equivalentOriginalEpisodeReferences,6);assert.equal(checked.plannedRuns,12);
  assert.deepEqual(protocol.jobs.map(job=>job.algorithmSeed),Array(12).fill(69011));
  const bad=structuredClone(protocol);bad.jobs[0].algorithmSeed=69023;assert.throws(()=>validateReplayProtocolV13(bad));
  const reordered=structuredClone(protocol);reordered.jobs.reverse();assert.throws(()=>validateReplayProtocolV13(reordered));
  const stale=structuredClone(protocol);stale.sourceBindings[stale.cases[0].sourceInputArtifact.path]='0'.repeat(64);assert.throws(()=>validateReplayProtocolV13(stale));
});

test('V13 evidence paths, finite canonical hashes and explicit root runtime authorization fail closed',async()=>{
  for(const name of ['../escape','/absolute','a/../b','a//b','a\\b','a\0b'])assert.throws(()=>safeEvidencePathV13(name));
  assert.equal(canonicalJSONV13({z:[2,{b:1,a:0}],a:'한글'}),'\u007b"a":"한글","z":[2,{"a":0,"b":1}]}');
  assert.equal(evidenceHashV13({b:2,a:1}),evidenceHashV13({a:1,b:2}));assert.notEqual(evidenceHashV13([1,2]),evidenceHashV13([2,1]));
  for(const value of [NaN,Infinity,undefined,{a:undefined}])assert.throws(()=>canonicalJSONV13(value));
  await assert.rejects(runDeclaredReplayV13('/does-not-exist'),/Root must separately authorize/);
});

test('embedded protocol semantics cannot drift from hash-bound frozen bytes before first-run authorization',async()=>{
  const bytes=await fs.readFile(new URL('../data/protocol-development-v13.json',import.meta.url));
  const declaration={protocol:JSON.parse(bytes),protocolSha256:createHash('sha256').update(bytes).digest('hex')};
  assert.deepEqual(assertFrozenProtocolBindingV13(declaration,bytes),declaration.protocol);
  for(const key of ['hypothesis','scopeLimits','selectionRule']){
    const tampered=structuredClone(declaration);tampered.protocol[key]='Changed embedded-only explanation with unchanged displayed protocol SHA.';
    assert.doesNotThrow(()=>validateReplayProtocolV13(tampered.protocol),'This regression must exercise the all-field binding rather than an existing matrix guard.');
    assert.throws(()=>assertFrozenProtocolBindingV13(tampered,bytes),/Embedded declaration protocol differs/);
  }
  assert.throws(()=>assertFrozenProtocolBindingV13({...declaration,protocolSha256:'0'.repeat(64)},bytes),/Frozen protocol bytes differ/);
});

test('handwritten controlled branches retain D0-D4 exactly, import once and reveal private capacity only when observed',async()=>{
  for(const branch of ['forced_seed','forced_native']){
    const input=await handcraftedInput(branch),captures={calls:[],ready:0,closed:0,imports:0};
    const result=await runReplayGuardBranchV13(input,{plannerFactory:config=>mockFactory(config,captures)});
    assert.equal(captures.ready,1);assert.equal(captures.closed,1);assert.equal(captures.imports,1);assert.equal(result.replayPrefixChecks.length,5);
    assert.equal(evidenceHashV13(prefixProjectionV13(result.timeline)),input.caseDefinition.prefixProjectionSha256);
    assert.equal(result.replayEndpointImportReceipt.accepted,true);assert.equal(captures.calls[0].options.minEventDay,6);
    assert.equal(captures.calls[0].snapshot.truckCapacity[7],2,'Unrevealed future shock leaked on D6.');
    assert.equal(captures.calls[1].options.minEventDay,7);assert.equal(captures.calls[1].snapshot.truckCapacity[7],0);
    for(const call of captures.calls)for(const value of [call.snapshot,call.options])for(const key of ['events','futureEvents','actualScenario','realizedScenario','unrevealedEvents'])assert.equal(Object.hasOwn(value,key),false);
    if(branch==='forced_seed'){assert.equal(result.complete,false);assert.equal(result.failure.day,7);assert.equal(result.totalCost,null);assert.equal(result.executionHistoryUnavailable,false);}
    else{assert.equal(result.complete,true);assert.equal(result.auditValid,true);assert.equal(result.plannerTrace[6].metadata.nativeCertificate.rawProof.length,80);}
    assert.ok(result.plannerTrace.slice(0,6).every(row=>row.forcedStepTimely&&row.forcedStepAcceptanceWallMs<=200));
  }
});

test('a rejected import is preserved and fails that branch before any continuation or fake native request',async()=>{
  const input=await handcraftedInput(),captures={calls:[],ready:0,closed:0,imports:0};
  const result=await runReplayGuardBranchV13(input,{plannerFactory:config=>mockFactory(config,captures,true)});
  assert.equal(result.complete,false);assert.equal(result.failure.day,5);assert.equal(result.totalCost,null);assert.equal(captures.calls.length,0);
  assert.equal(result.replayEndpointImportReceipt.accepted,false);assert.equal(result.replayEndpointImportReceipt.status,'late_commit');
  assert.equal(result.plannerStats.actualNativeRequests,0);assert.equal(captures.closed,1);assert.equal(result.executionHistoryUnavailable,false);
});

test('forced endpoint reconstruction rejects altered fees, missing orders, non-finite dates and changed physical locks',async()=>{
  const input=await handcraftedInput(),c=input.caseDefinition,dates=c.endpoints.native.dates;
  assert.throws(()=>reconstructReplayEndpointV13(c.publicSnapshot,dates,c.fixedEvents,5,{...c.endpoints.native.fees,totalCost:1}));
  assert.throws(()=>reconstructReplayEndpointV13(c.publicSnapshot,[],c.fixedEvents,5));
  assert.throws(()=>reconstructReplayEndpointV13(c.publicSnapshot,[{...dates[0],returnDay:Infinity}],c.fixedEvents,5));
  assert.throws(()=>reconstructReplayEndpointV13(c.publicSnapshot,dates,{[dates[0].id]:{pickupDay:1}},5));
});

test('a null continuation remains a first failed path with unknown request count and no retry',async()=>{
  const input=await handcraftedInput(),captures={calls:[],ready:0,closed:0,imports:0};let calls=0;
  const result=await runReplayGuardBranchV13(input,{plannerFactory:configuration=>{
    const base=mockFactory(configuration,captures),planner=async()=>{calls++;return null;};
    planner.ready=base.ready;planner.close=base.close;planner.importDevelopmentEndpoint=base.importDevelopmentEndpoint;return planner;
  }});
  assert.equal(calls,1);assert.equal(result.failure.day,6);assert.equal(result.complete,false);assert.equal(result.incrementalCost,null);
  assert.equal(result.executionHistoryUnavailable,false);assert.equal(result.plannerStats.actualNativeRequests,null);
  assert.equal(result.plannerTrace.at(-1).plannerStatus,'missing_result');assert.equal(captures.closed,1);
});

test('cold mocked V13 worker uses the unchanged V12 parent lifecycle and retains a complete physical timeline',async()=>{
  const dir=await fs.mkdtemp(join(tmpdir(),'v13-cold-mock-'));
  try{
    const worker=join(dir,'mock-worker.mjs'),moduleURL=new URL('../scripts/replay-guard-v13.worker.mjs',import.meta.url).href;
    await fs.writeFile(worker,`import assert from 'node:assert/strict';import {runReplayGuardBranchV13,reconstructReplayEndpointV13,REPLAY_FEES_V13} from ${JSON.stringify(moduleURL)};\n${mockFactory.toString()}\nprocess.once('message',async input=>{const result=await runReplayGuardBranchV13(input,{plannerFactory:mockFactory});process.send({type:'final',episodeId:input.episodeId,method:input.method,result},()=>process.disconnect());});\n`);
    const input=await handcraftedInput(),result=await runColdEpisodeV12(input,{hardWallMs:5000,workerScript:worker});
    assert.equal(isCompleteV12(result),true,JSON.stringify(result.failure));assert.equal(result.normalWorkerExit,true);assert.equal(result.processGroupCleanup.verificationResult,'ESRCH');
    assert.equal(result.timeline.length,9);assert.equal(result.replayPrefixChecks.length,5);assert.equal(result.plannerStats.actualNativeRequests,3);
    const receipt=compactEpisodeReceiptV12(result,{path:'episodes/handwritten.json',sha256:'a'.repeat(64)});assert.equal(isCompleteV12(receipt),true);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('development summary keeps matching pair eligibility and never computes CI or imputes failed fees',async()=>{
  const input=await handcraftedInput(),result=await runReplayGuardBranchV13(input,{plannerFactory:mockFactory});
  const host={...result,hardWallMs:5000,wallTimeMs:50,endToEndWallTimeMs:50,receiptValidatedMs:20,exitCode:0,exitSignal:null,deadlineReached:false,
    normalWorkerExit:true,terminalReceiptWithinBudget:true,outputDeliveredWithinBudget:true,terminalReceiptAcceptedAsHistory:true,endToEndCompletedWithinBudget:true,episodeCompletedWithinBudget:true,
    processGroupCleanup:{successful:true,verifiedProcessGroupGone:true,verificationResult:'ESRCH',finishedAtMs:40}};
  const receipt=compactEpisodeReceiptV12(host,{path:'episodes/fixture.json',sha256:'a'.repeat(64)});
  const caseId='v12-stress-batch-release-tight-n100-r2',records=[{jobId:'seed',caseId,timingRepeatIndex:1,branch:'forced_seed',receipt},
    {jobId:'native',caseId,timingRepeatIndex:1,branch:'forced_native',receipt:{...receipt,complete:false,totalCost:null,incrementalCost:null,episodeCompletedWithinBudget:false}}];
  const summary=summarizeReplayV13(records);assert.equal(summary.ciComputed,false);assert.equal(summary.uniqueBusinessScenarioCount,2);
  assert.equal(summary.pairs[0].jointlyCompleted,false);assert.equal(summary.pairs[0].incrementalSeedMinusNativeKRW,null);assert.equal(summary.jointlyCompletedTimingPairCount,0);
});
