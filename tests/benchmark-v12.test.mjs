import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {rowFor,summarize} from '../src/engine.js';
import {compactPlannerMetadataV12,createEpisodePlannerV12,unknownEpisodeV12} from '../scripts/episode-v12.worker.mjs';
import {METHODS_V12,enumerateCasesV12,validateProtocolV12,executionOrderV12,runColdEpisodeV12,validateCompleteReceiptV12,
  summarizePanelV12,summarizeExperimentV12,pairedBootstrapV12,jointCompleteParetoV12,observedDecisionGatesV12,compactEpisodeReceiptV12,isCompleteV12,assertNewOutputV12} from '../scripts/benchmark-v12.mjs';

const tiny=()=>({id:'handcrafted-v12',horizonStart:'2026-10-12',horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:2,
  containers:[{id:'handcrafted-C1',sizeFt:20,releaseDay:0,unloadDays:1,dueDay:2,dischargeDateTime:'2026-10-10T07:00:00+09:00',dataOrigin:'synthetic'}]});
function terminalFixture(s=tiny()){
  const row=rowFor(s,s.containers[0],0,0,1),dates={id:row.id,pickupDay:0,unloadDay:0,returnDay:1};
  const timeline=[0,1].map(day=>({day,status:'executed',audit:{scheduleAudit:{valid:true,errors:[]},freezeAudit:{valid:true,errors:[]}},
    observationHash:'fixture-current-public-observation',observedEvents:['truck','warehouse','staging'].map(resource=>({resource,capacity:s[resource+'Capacity']})),
    decisions:[dates],state:[{id:row.id,phase:day===0?'awaiting_return':'returned'}],revisions:[],
    executedEvents:day===0?[{id:row.id,event:'pickup',day},{id:row.id,event:'unloadStart',day}]:[{id:row.id,event:'return',day}]}));
  return {...summarize(s,'fixture',[row],0,'feasible'),complete:true,auditValid:true,executionHistoryUnavailable:false,revisionCount:0,
    timeline,executedEvents:timeline.flatMap(entry=>entry.executedEvents),executionThroughDay:1,
    terminalAudit:{engine:{valid:true,errors:[]},independentErrors:[]},episodeCompletedWithinBudget:true,outputDeliveredWithinBudget:true,
    hardWallMs:5000,wallTimeMs:50,endToEndWallTimeMs:50,receiptValidatedMs:20,finalReceivedMs:10,processExitWallTimeMs:30,processCloseWallTimeMs:31,
    cleanupFinishedMs:40,terminalReceiptWithinBudget:true,terminalReceiptAcceptedAsHistory:true,endToEndCompletedWithinBudget:true,deadlineReached:false,
    normalWorkerExit:true,exitCode:0,exitSignal:null,processGroupCleanup:{mode:'posix-process-group',attempted:true,killSignalSent:false,attempts:[],startedAtMs:31,
      finishedAtMs:40,verifiedProcessGroupGone:true,verificationResult:'ESRCH',verificationAtMs:39,verificationError:null,successful:true},unacceptedTerminalReceipts:[],
    plannerStats:{decisionCalls:2,solverCalls:1,constructorCalls:1,reusedPlans:1,replannedDueToInvalid:0,planningWallMs:10,callWallMs:[8,2]}};
}
const complete=(fee,revisionCount=0)=>({...terminalFixture(),totalCost:fee,incrementalCost:fee,revisionCount});
const allPolicies=fee=>Object.fromEntries(METHODS_V12.map(method=>[method,complete(fee)]));

import {freezeExperimentV12,assertReadyForFreezeV12,verifyHistoricalSeedExclusionsV12,initializationEvidenceV12} from '../scripts/benchmark-v12.mjs';

test('six methods declare 144 unseen metadata scenarios and all prior protocol seed exclusions without generating orders',async()=>{
  const protocol=JSON.parse(await readFile(new URL('../data/protocol-v12.json',import.meta.url),'utf8'));
  assert.equal(validateProtocolV12(protocol),protocol);
  assert.equal(METHODS_V12.length,6);const cases=enumerateCasesV12(protocol);
  assert.equal(cases.length,144);assert.equal(new Set(cases.map(c=>c.seed)).size,144);
  assert.deepEqual(cases.filter(c=>c.panel==='same-distribution').map(c=>c.seed),Array.from({length:72},(_,i)=>691001+i));
  assert.deepEqual(cases.filter(c=>c.panel==='stress').map(c=>c.seed),Array.from({length:72},(_,i)=>692001+i));
  assert.equal(cases.length*protocol.algorithmRepeats.length*METHODS_V12.length,2592);
  const old=new Set(protocol.historicalSeedExclusions.excludedSeeds);
  assert.ok(cases.every(c=>!old.has(c.seed)));assert.ok(protocol.algorithmRepeats.every(r=>!old.has(r.seed)));
  const checked=await verifyHistoricalSeedExclusionsV12(protocol);
  assert.ok(checked.protocolCount>=15);assert.ok(checked.excludedSeedCount>1000);
  const v10=JSON.parse(await readFile(new URL('../data/protocol-v10.json',import.meta.url),'utf8'));
  for(const method of ['costPolishV7','adaptiveV9','highsV8','stableHiGHSV10'])assert.deepEqual(protocol.callBudgets[method],v10.callBudgets[method]);
  assert.deepEqual(protocol.callBudgets.commitmentHiGHSV11,v10.callBudgets.highsV8);
  assert.equal(protocol.callBudgets.seededHiGHSV12.constructorBudgetMs,40);
  assert.equal(protocol.callBudgets.seededHiGHSV12.constructorAuditReserveMs,5);
  assert.equal(protocol.callBudgets.seededHiGHSV12.maxRestarts,3);
  const counts=Object.fromEntries(METHODS_V12.map(m=>[m,Array(6).fill(0)]));
  for(let i=0;i<6;i++)for(const [position,method]of executionOrderV12(i,0).entries())counts[method][position]++;
  assert.ok(Object.values(counts).every(row=>row.every(n=>n===1)));
  const manifest=JSON.parse(await readFile(new URL('../data/evidence-v10/v10-frozen-first/manifest.json',import.meta.url),'utf8'));
  for(const path of ['scripts/benchmark-v10.mjs','scripts/episode-v10.worker.mjs','data/protocol-v10.json']){
    const raw=await readFile(new URL('../'+path,import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),manifest.implementationHashes[path],path+' historical bytes changed');
  }
});

test('draft cannot freeze or execute and fixed parameters, seeds, observers and comparisons cannot silently drift',async()=>{
  const protocol=JSON.parse(await readFile(new URL('../data/protocol-v12.json',import.meta.url),'utf8'));
  const draft=structuredClone(protocol);draft.executionAuthorization={status:'draft-development-not-ready',reason:'Independent rejection fixture; never a real execution authorization.'};
  assert.equal(validateProtocolV12(draft),draft);
  assert.throws(()=>assertReadyForFreezeV12(draft),/still draft/);
  const ready=structuredClone(protocol);ready.executionAuthorization={status:'ready-for-source-freeze',reason:'Independent guard fixture only; no actual source freeze.'};
  assert.doesNotThrow(()=>assertReadyForFreezeV12(ready));
  const dir=await mkdtemp(join(tmpdir(),'v12-draft-'));
  try{
    const target=join(dir,'must-not-exist'),draftPath=join(dir,'draft-protocol.json'),readyPath=join(dir,'ready-test-protocol.json');
    await writeFile(draftPath,JSON.stringify(draft));await writeFile(readyPath,JSON.stringify(ready));
    await assert.rejects(freezeExperimentV12(target,{rejectionTestProtocolPath:draftPath}),/still draft/);
    await assert.rejects(access(target),/ENOENT/);
    await assert.rejects(freezeExperimentV12(target,{rejectionTestProtocolPath:readyPath}),/Rejection-only test protocol cannot authorize/);
    await assert.rejects(access(target),/ENOENT/);
  }
  finally{await rm(dir,{recursive:true,force:true});}
  const retuned=structuredClone(protocol);retuned.callBudgets.seededHiGHSV12.timeBudgetMs=1000;assert.throws(()=>validateProtocolV12(retuned),/200ms/);
  const seedBudget=structuredClone(protocol);seedBudget.callBudgets.seededHiGHSV12.constructorBudgetMs=80;assert.throws(()=>validateProtocolV12(seedBudget),/parameters/);
  const observer=structuredClone(protocol);observer.callBudgets.adaptiveV9.onIncumbent='diagnostic';assert.throws(()=>validateProtocolV12(observer),/observers/);
  const collide=structuredClone(protocol);collide.historicalSeedExclusions.excludedSeeds.push(691001);assert.throws(()=>validateProtocolV12(collide),/overlap/);
  const editedHistory=structuredClone(protocol);editedHistory.historicalSeedExclusions.sources[0].sha256='0'.repeat(64);await assert.rejects(verifyHistoricalSeedExclusionsV12(editedHistory),/hash differs/);
  const editedPairs=structuredClone(protocol);delete editedPairs.analysis.comparisons.v12VsV11;assert.throws(()=>validateProtocolV12(editedPairs),/pairs/);
  const bootstrap=structuredClone(protocol);bootstrap.analysis.bootstrap.seed=1;assert.throws(()=>validateProtocolV12(bootstrap),/bootstrap/);
});

test('worker allow-list and metadata preserve full constructor, commitment, native and rejected delivery proofs',async()=>{
  await assert.rejects(createEpisodePlannerV12('../arbitrary',{}),/fixed method registry/);
  const dates=Array.from({length:150},(_,i)=>({id:'manual-'+i,pickupDay:0,unloadDay:0,returnDay:1}));
  const stabilitySelection={beforeDates:dates,proposalDates:dates,afterDates:dates,commitmentScore:{complete:true,beforeM:2,proposalM:1,details:dates},
    constructorDelivery:{budgetMs:40,events:dates.map((row,sequence)=>({sequence,source:'deterministic_seed',proposedDates:dates,dates:[row],outcome:'rejected_late',acceptedAtMs:null}))},
    preNativeIncumbent:{source:'constructor',dates,fees:{incrementalCost:0},acceptedAtMs:12}};
  const candidateDelivery={receipts:dates.map((row,sequence)=>({sequence,dates:[row],timely:false,accepted:false}))};
  const metadata={action:'rebuild',decisionReason:'no_valid_cache',stabilitySelection,candidateDelivery,nativeCertificate:{rows:dates},rows:dates};
  const compact=compactPlannerMetadataV12(metadata,{});
  assert.deepEqual(compact.stabilitySelection,stabilitySelection);assert.deepEqual(compact.candidateDelivery,candidateDelivery);
  assert.deepEqual(compact.nativeCertificate,metadata.nativeCertificate);assert.equal(compact.rows.omittedDuplicateRows,150);
});

test('terminal receipt requires physical execution and correct fees; initialization is separate from unknown or later failure',()=>{
  const input={nominalScenario:tiny(),events:[]},result=terminalFixture();
  assert.deepEqual(validateCompleteReceiptV12(input,result),[]);
  const tampered=structuredClone(result);tampered.incrementalCost+=1;assert.ok(validateCompleteReceiptV12(input,tampered).length>0);
  const staticOnly={...result,timeline:[]};assert.ok(validateCompleteReceiptV12(input,staticOnly).length>0);
  assert.equal(initializationEvidenceV12(result).initialPlanAccepted,true);
  const later={...result,complete:false,failure:{day:2,kind:'no_complete_plan'}};
  assert.equal(initializationEvidenceV12(later).failurePhase,'after_initialization');
  const unknown=unknownEpisodeV12('seededHiGHSV12','fixture timeout','hard_time_limit');
  assert.equal(initializationEvidenceV12(unknown).initialPlanAccepted,null);assert.equal(initializationEvidenceV12(unknown).failurePhase,'history_unavailable');
  assert.equal(initializationEvidenceV12(unknown).dayZeroCallWallMs,null);
  const receipt=compactEpisodeReceiptV12({...result,initializationEvidence:initializationEvidenceV12(result)},{path:'episodes/fixture.json',sha256:'a'.repeat(64)});
  assert.equal(receipt.rows,undefined);assert.equal(receipt.initializationEvidence.initialPlanAccepted,true);assert.equal(isCompleteV12(receipt),true);
  assert.equal(isCompleteV12({...receipt,episodeCompletedWithinBudget:false}),false);
});

test('cold parent keeps rejected raw receipts and unknown timeout fees/counters without relabeling progress as execution',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'v12-cold-fixture-'));
  try{
    const worker=join(dir,'worker.mjs'),input={episodeId:'manual',nominalScenario:tiny(),events:[],method:'seededHiGHSV12'};
    const invalid={...terminalFixture(),timeline:[]};
    await writeFile(worker,`process.once('message',input=>{process.send({type:'final',episodeId:input.episodeId,method:input.method,result:${JSON.stringify(invalid)}},()=>process.disconnect());});\n`);
    const rejected=await runColdEpisodeV12(input,{hardWallMs:1500,workerScript:worker});
    assert.equal(rejected.complete,false);assert.equal(rejected.totalCost,null);assert.equal(rejected.revisionCount,null);
    assert.equal(rejected.unacceptedTerminalReceipts.length,1);assert.deepEqual(rejected.unacceptedTerminalReceipts[0].message.result,invalid);
    await writeFile(worker,"process.once('message',()=>{process.send({type:'progress',solverCalls:100});setInterval(()=>{},1000);});\n");
    const timeout=await runColdEpisodeV12(input,{hardWallMs:250,workerScript:worker});
    assert.equal(timeout.status,'hard_time_limit');assert.equal(timeout.executionHistoryUnavailable,true);assert.equal(timeout.plannerStats.solverCalls,null);
    assert.equal(timeout.incrementalCost,null);assert.ok(timeout.wallTimeMs>=timeout.actualCutoffMs);assert.equal(timeout.wallTimeMs,timeout.endToEndWallTimeMs);
    assert.equal(timeout.initializationEvidence.initialPlanAccepted,null);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('timely physical final requires normal exit, verified ESRCH cleanup and a complete end-to-end budget',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'v12-lifecycle-')),worker=join(dir,'worker.mjs');
  const input={episodeId:'manual',nominalScenario:tiny(),events:[],method:'seededHiGHSV12'},physical=terminalFixture();
  const writeWorker=after=>writeFile(worker,`process.once('message',input=>{process.send({type:'final',episodeId:input.episodeId,method:input.method,result:${JSON.stringify(physical)}},()=>{${after}});});\n`);
  const rejected=(result,reason)=>{
    assert.equal(isCompleteV12(result),false);assert.equal(result.complete,false);assert.equal(result.totalCost,null);assert.equal(result.incrementalCost,null);
    assert.equal(result.executionHistoryUnavailable,true);assert.equal(result.terminalReceiptWithinBudget,true);assert.equal(result.outputDeliveredWithinBudget,true);
    assert.equal(result.terminalReceiptAcceptedAsHistory,false);assert.equal(result.endToEndCompletedWithinBudget,false);
    assert.ok(result.unacceptedTerminalReceipts.some(row=>row.reason===reason));
    assert.deepEqual(result.unacceptedTerminalReceipts.find(row=>row.reason===reason).message.result,physical);
    const compact=compactEpisodeReceiptV12(result,{path:'episodes/lifecycle.json',sha256:'a'.repeat(64)});
    for(const field of ['processGroupCleanup','unacceptedTerminalReceipts','normalWorkerExit','processCloseWallTimeMs','endToEndWallTimeMs','cleanupFinishedMs'])assert.deepEqual(compact[field],result[field]);
  };
  try{
    await writeWorker('process.disconnect();');
    const clean=await runColdEpisodeV12(input,{hardWallMs:1500,workerScript:worker});
    assert.equal(isCompleteV12(clean),true);assert.equal(clean.normalWorkerExit,true);assert.equal(clean.processGroupCleanup.verificationResult,'ESRCH');
    assert.ok(clean.processExitWallTimeMs<=clean.processCloseWallTimeMs);assert.ok(clean.processCloseWallTimeMs<=clean.cleanupFinishedMs);
    assert.ok(clean.cleanupFinishedMs<=clean.wallTimeMs);assert.equal(clean.wallTimeMs,clean.endToEndWallTimeMs);
    assert.equal(isCompleteV12({...clean,exitCode:7}),false);assert.equal(isCompleteV12({...clean,processGroupCleanup:{...clean.processGroupCleanup,verificationResult:null}}),false);
    await writeWorker('process.disconnect();process.exitCode=7;');
    const nonzero=await runColdEpisodeV12(input,{hardWallMs:1500,workerScript:worker});
    rejected(nonzero,'worker_exit_not_clean');assert.equal(nonzero.exitCode,7);assert.equal(nonzero.normalWorkerExit,false);
    await writeWorker('setInterval(()=>{},1000);');
    const hanging=await runColdEpisodeV12(input,{hardWallMs:300,workerScript:worker});
    rejected(hanging,'terminal_lifecycle_exceeded_parent_deadline');assert.equal(hanging.deadlineReached,true);assert.ok(hanging.actualCutoffMs>=300);
    await writeWorker('process.disconnect();');
    const originalKill=process.kill;
    try{
      process.kill=function(pid,signal){if(pid<0&&signal===0)throw Object.assign(new Error('fixture cleanup permission failure'),{code:'EPERM'});return originalKill.call(process,pid,signal);};
      const unverified=await runColdEpisodeV12(input,{hardWallMs:1500,workerScript:worker});
      rejected(unverified,'process_group_cleanup_unverified');assert.equal(unverified.processGroupCleanup.verificationError,'EPERM');
      assert.equal(unverified.normalWorkerExit,true);assert.equal(unverified.processGroupCleanup.successful,false);
    }finally{process.kill=originalKill;}
    try{
      let delayed=false;
      process.kill=function(pid,signal){if(pid<0&&signal===0&&!delayed){delayed=true;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,400);}return originalKill.call(process,pid,signal);};
      const lateCleanup=await runColdEpisodeV12(input,{hardWallMs:300,workerScript:worker});
      rejected(lateCleanup,'terminal_lifecycle_exceeded_parent_deadline');assert.equal(lateCleanup.normalWorkerExit,true);
      assert.equal(lateCleanup.processGroupCleanup.verificationResult,'ESRCH');assert.ok(lateCleanup.cleanupFinishedMs>300);
      assert.equal(lateCleanup.deadlineReached,true);assert.equal(lateCleanup.actualCutoffMs,null);
    }finally{process.kill=originalKill;}
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('six-method paired summaries keep scenario weighting, negative outcomes, completion losses, nulls and distinct panels',()=>{
  const cases=[{id:'a',panel:'same-distribution',repeats:[1,2,3].map(repeatIndex=>({repeatIndex,policies:{...allPolicies(100),seededHiGHSV12:complete(80)}}))},
    {id:'b',panel:'same-distribution',repeats:[{repeatIndex:1,policies:{...allPolicies(1000),seededHiGHSV12:complete(1100)}},
      ...[2,3].map(repeatIndex=>({repeatIndex,policies:{...allPolicies(1000),seededHiGHSV12:unknownEpisodeV12('seededHiGHSV12','fixture')}}))]},
    {id:'c',panel:'same-distribution',repeats:[{repeatIndex:1,policies:{...allPolicies(0),costPolishV7:unknownEpisodeV12('costPolishV7','unknown'),seededHiGHSV12:complete(0)}}]},
    {id:'d',panel:'stress',repeats:[{repeatIndex:1,policies:allPolicies(0)}]}];
  const summary=summarizePanelV12(cases.slice(0,3),{bootstrap:{draws:40,seed:7}}),pair=summary.comparisons.v12VsV7;
  assert.equal(pair.fees.total.pairedScenarioCount,2);assert.equal(pair.fees.total.pairedEpisodeCount,4);
  assert.equal(pair.fees.total.baselineScenarioMeanSumKRW,1100);assert.equal(pair.fees.total.candidateScenarioMeanSumKRW,1180);
  assert.equal(pair.fees.total.scenarioWeightedSavingsKRW,-80);assert.deepEqual(pair.fees.total.scenarioWinTieLoss,{win:1,tie:0,loss:1});
  assert.equal(pair.completion.gainedEpisodeCount,1);assert.equal(pair.completion.lostEpisodeCount,2);assert.deepEqual(pair.completion.gainedFromUnknownHistoryEpisodeIds,['c::repeat-1']);
  assert.equal(summary.byMethod.costPolishV7.counters.decisionCalls.unknownEpisodeCount,1);
  const all=summarizeExperimentV12(cases,{bootstrap:{draws:20,seed:7}});
  assert.equal(all.panels.stress.scenarioCount,1);assert.equal(all.panels['same-distribution'].scenarioCount,3);
  assert.equal(all.panels.stress.comparisons.v12VsV11.fees.incremental.weightedSavingsPct,null);
  assert.equal(summary.observedDecisionGates.defaultRecommendationEligible,false);
});

test('all-six Pareto uses exactly matching completed repeats; missing V11 or unknown revisions cannot improve a frontier',()=>{
  const policies=(fee,revision)=>({...allPolicies(fee),seededHiGHSV12:complete(fee*.8,revision)});
  const a=policies(100,8);for(const method of METHODS_V12)if(method!=='seededHiGHSV12')a[method].revisionCount=10;
  const excluded={...policies(999999,0),commitmentHiGHSV11:unknownEpisodeV12('commitmentHiGHSV11','fixture')};
  const cases=[{id:'a',repeats:[{repeatIndex:1,policies:a},{repeatIndex:2,policies:a},{repeatIndex:3,policies:excluded}]},
    {id:'b',repeats:[{repeatIndex:1,policies:{...allPolicies(1000),seededHiGHSV12:complete(800,5)}}]}];
  for(const method of METHODS_V12)if(method!=='seededHiGHSV12')cases[1].repeats[0].policies[method].revisionCount=20;
  const joint=jointCompleteParetoV12(cases);
  assert.equal(joint.eligibility,'all-six-matching-complete-repeats');assert.equal(joint.jointScenarioCount,2);assert.equal(joint.jointEpisodeCount,3);
  assert.equal(joint.byMethod.seededHiGHSV12.scenarioMeanIncrementalCostSumKRW,880);assert.equal(joint.byMethod.seededHiGHSV12.episodeIncrementalCostSumKRW,960);
  assert.equal(joint.byMethod.seededHiGHSV12.scenarioMeanRevisionCountSum,13);assert.equal(joint.byMethod.seededHiGHSV12.episodeRevisionCountSum,21);
  assert.equal(joint.frontiers.incrementalAndRevisions.find(r=>r.method==='seededHiGHSV12').dominates.length,5);
  cases[1].repeats[0].policies.seededHiGHSV12.revisionCount=null;
  const unknown=jointCompleteParetoV12(cases);assert.equal(unknown.byMethod.seededHiGHSV12.scenarioMeanRevisionCountSum,null);
  assert.equal(unknown.frontiers.totalAndRevisions.find(r=>r.method==='seededHiGHSV12').pareto,null);
});

test('completion losses against any of five methods override gains while native conditional claims retain exact fee/revision gates',()=>{
  const policies=allPolicies(100);policies.seededHiGHSV12.revisionCount=5;
  for(const method of METHODS_V12)if(method!=='seededHiGHSV12')policies[method].revisionCount=10;
  const summary=summarizePanelV12([{id:'manual',repeats:[{repeatIndex:1,policies}]}],{bootstrap:{draws:20,seed:7}});
  const gates=observedDecisionGatesV12(summary.comparisons,{completePanel:true});
  assert.equal(gates.defaultRecommendationEligible,true);assert.equal(Object.keys(gates.completionLossCountsByBaseline).length,5);
  assert.equal(gates.nativeComparison.incrementalFeeClaim,'no_stable_advantage');assert.equal(gates.nativeComparison.stabilityImprovementClaimAllowed,true);
  assert.deepEqual(gates.nativeComparison,gates.nativeComparisons.highsV8);
  const loss=structuredClone(summary.comparisons);loss.v12VsV11.completion.lostEpisodeCount=1;loss.v12VsHiGHS.completion.gainedEpisodeCount=100;
  const lost=observedDecisionGatesV12(loss,{completePanel:true});assert.equal(lost.defaultRecommendationEligible,false);assert.equal(lost.nativeComparisons.commitmentHiGHSV11.stabilityImprovementClaimAllowed,false);
  assert.equal(observedDecisionGatesV12(summary.comparisons,{completePanel:false}).defaultRecommendationEligible,false);
  const unknown=structuredClone(summary.comparisons);unknown.v12VsHiGHS.revisions.pairedEpisodeCount=0;
  assert.equal(observedDecisionGatesV12(unknown,{completePanel:true}).nativeComparison.revisionDelta,null);
  const dearer=structuredClone(summary.comparisons);dearer.v12VsHiGHS.fees.total.uncertainty.weightedSavingsPct95CI=[-10,-1];
  assert.equal(observedDecisionGatesV12(dearer,{completePanel:true}).nativeComparison.stabilityImprovementClaimAllowed,false);
});

test('existing first output is refused and missing history remains null',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'v12-first-run-'));
  try{const file=join(dir,'first.json');await writeFile(file,'preserve');await assert.rejects(assertNewOutputV12(file),/preserve the first run/);assert.equal(await readFile(file,'utf8'),'preserve');}
  finally{await rm(dir,{recursive:true,force:true});}
  const unknown=unknownEpisodeV12('seededHiGHSV12','fixture');assert.equal(unknown.totalCost,null);assert.equal(unknown.revisionCount,null);
});

test('six V12 factories produce audited cold episodes on handcrafted orders only',{
  skip:process.env.PORTPLAN_V12_FACTORY_SMOKE!=='1'},async()=>{
  const protocol=JSON.parse(await readFile(new URL('../data/protocol-v12.json',import.meta.url),'utf8'));
  for(const method of METHODS_V12){
    const input={episodeId:`manual-${method}`,nominalScenario:tiny(),events:[],method,algorithmSeed:69011,repeatIndex:1,callBudgets:protocol.callBudgets};
    const result=await runColdEpisodeV12(input,{hardWallMs:5000});
    assert.equal(isCompleteV12(result),true,`${method}: ${JSON.stringify(result.failure)}`);
    assert.deepEqual(validateCompleteReceiptV12(input,result),[]);
    if(['commitmentHiGHSV11','seededHiGHSV12'].includes(method))assert.ok(result.plannerTrace.every(entry=>entry.stabilitySelection));
  }
});
