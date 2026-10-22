import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {rowFor,summarize} from '../src/engine.js';
import {runColdEpisodeV12,isCompleteV12} from '../scripts/benchmark-v12.mjs';
import {METHODS_V14,validateProtocolV14,enumerateCasesV14,verifyHistoricalSeedExclusionsV14,verifyFrozenAlgorithmsV14,
  executionOrderV14,runColdEpisodeV14,isCompleteV14,compactEpisodeReceiptV14,freezeExperimentV14,assertReadyForFreezeV14,runFrozenExperimentV14,
  summarizePanelV14,summarizeExperimentV14,jointCompleteParetoV14,observedDecisionGatesV14,sha256,verifyCommittedSourcesV14,gitBlobHashV14,
  validateSourcePushReceiptV14,assertFrozenProtocolBindingV14,writeFirstRunAuthorizationV14,canonicalJSONV14} from '../scripts/benchmark-v14.mjs';
import {compactPlannerMetadataV14,createEpisodePlannerV14,runEpisodeV14,unknownEpisodeV14} from '../scripts/episode-v14.worker.mjs';

const exec=promisify(execFile);
const tiny=()=>({id:'handwritten-v14',horizonStart:'2026-10-12',horizonDays:5,truckCapacity:2,warehouseCapacity:1,stagingCapacity:2,
  containers:[{id:'manual-C1',sizeFt:20,releaseDay:0,unloadDays:1,dueDay:4,dischargeDateTime:'2026-10-10T07:00:00+09:00',dataOrigin:'synthetic'}]});
function terminalFixture(){
  const s=tiny(),row=rowFor(s,s.containers[0],0,0,1),dates={id:row.id,pickupDay:0,unloadDay:0,returnDay:1};
  const timeline=[0,1].map(day=>({day,status:'executed',audit:{scheduleAudit:{valid:true,errors:[]},freezeAudit:{valid:true,errors:[]}},
    observationHash:'fixture-current-public-observation',observedEvents:['truck','warehouse','staging'].map(resource=>({resource,capacity:s[resource+'Capacity']})),
    decisions:[dates],state:[{id:row.id,phase:day===0?'awaiting_return':'returned'}],revisions:[],
    executedEvents:day===0?[{id:row.id,event:'pickup',day},{id:row.id,event:'unloadStart',day}]:[{id:row.id,event:'return',day}]}));
  return {...summarize(s,'fixture',[row],0,'feasible'),complete:true,auditValid:true,executionHistoryUnavailable:false,revisionCount:0,
    timeline,executedEvents:timeline.flatMap(row=>row.executedEvents),executionThroughDay:1,terminalAudit:{engine:{valid:true,errors:[]},independentErrors:[]},
    hardWallMs:5000,wallTimeMs:50,endToEndWallTimeMs:50,receiptValidatedMs:20,finalReceivedMs:10,processExitWallTimeMs:30,processCloseWallTimeMs:31,
    cleanupFinishedMs:40,terminalReceiptWithinBudget:true,outputDeliveredWithinBudget:true,terminalReceiptAcceptedAsHistory:true,endToEndCompletedWithinBudget:true,
    episodeCompletedWithinBudget:true,deadlineReached:false,normalWorkerExit:true,exitCode:0,exitSignal:null,
    processGroupCleanup:{mode:'posix-process-group',attempted:true,killSignalSent:false,attempts:[],startedAtMs:31,finishedAtMs:40,
      verifiedProcessGroupGone:true,verificationResult:'ESRCH',verificationAtMs:39,verificationError:null,successful:true},unacceptedTerminalReceipts:[],
    plannerStats:{decisionCalls:2,solverCalls:1,constructorCalls:1,reusedPlans:1,planningWallMs:10}};
}
const complete=(fee=100,revisionCount=0)=>({...terminalFixture(),totalCost:fee,incrementalCost:fee,revisionCount});
const policies=(fee=100)=>Object.fromEntries(METHODS_V14.map(method=>[method,complete(fee)]));

test('V14 metadata commits 144 fresh scenarios and 3024 runs while preserving all 25 old implementation bytes',async()=>{
  const protocol=JSON.parse(await fs.readFile(new URL('../data/protocol-v14.json',import.meta.url)));
  assert.equal(validateProtocolV14(protocol),protocol);assert.deepEqual(METHODS_V14,['costPolishV7','adaptiveV9','highsV8','stableHiGHSV10','commitmentHiGHSV11','seededHiGHSV12','guardedHiGHSV13']);
  const cases=enumerateCasesV14(protocol);assert.equal(cases.length,144);assert.equal(cases.length*3*METHODS_V14.length,3024);
  assert.deepEqual(cases.filter(row=>row.panel==='same-distribution').map(row=>row.seed),Array.from({length:72},(_,index)=>791001+index));
  assert.deepEqual(cases.filter(row=>row.panel==='stress').map(row=>row.seed),Array.from({length:72},(_,index)=>792001+index));
  assert.deepEqual(protocol.algorithmRepeats.map(row=>row.seed),[79011,79023,79039]);assert.equal(Object.keys(protocol.analysis.comparisons).length,14);
  assert.deepEqual(await verifyHistoricalSeedExclusionsV14(protocol),{metadataSourceCount:19,excludedSeedCount:1316});
  assert.deepEqual(await verifyFrozenAlgorithmsV14(protocol),{boundFileCount:25,unchanged:true});
  assert.ok([41022,41031,41083,41105,41114].every(seed=>protocol.historicalSeedExclusions.excludedSeeds.includes(seed)));
  const positions=Object.fromEntries(METHODS_V14.map(method=>[method,Array(7).fill(0)]));
  for(let index=0;index<7;index++)for(const [position,method]of executionOrderV14(index,0).entries())positions[method][position]++;
  assert.ok(Object.values(positions).every(row=>row.every(count=>count===1)));
});

test('draft freeze and unauthorized run fail before writing or generating, independent of the saved readiness state',async()=>{
  const protocol=JSON.parse(await fs.readFile(new URL('../data/protocol-v14.json',import.meta.url))),draft=structuredClone(protocol),ready=structuredClone(protocol);
  draft.executionAuthorization.status='draft-development-not-ready';ready.executionAuthorization.status='ready-for-source-freeze';
  assert.throws(()=>assertReadyForFreezeV14(draft),/still draft/);assert.doesNotThrow(()=>assertReadyForFreezeV14(ready));
  const dir=await fs.mkdtemp(join(tmpdir(),'v14-draft-'));
  try{
    const path=join(dir,'draft.json'),readyPath=join(dir,'ready.json'),target=join(dir,'must-not-exist');
    await fs.writeFile(path,JSON.stringify(draft));await fs.writeFile(readyPath,JSON.stringify(ready));
    await assert.rejects(freezeExperimentV14(target,{rejectionTestProtocolPath:path}),/still draft/);
    await assert.rejects(freezeExperimentV14(target,{rejectionTestProtocolPath:readyPath}),/Rejection-only fixture/);
    await assert.rejects(fs.access(target),/ENOENT/);
    await assert.rejects(runFrozenExperimentV14(target),/separate explicit root runtime authorization/);
    await assert.rejects(fs.access(target),/ENOENT/);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
  const retuned=structuredClone(protocol);retuned.callBudgets.guardedHiGHSV13.constructorBudgetMs=80;assert.throws(()=>validateProtocolV14(retuned),/budgets/);
  const imported=structuredClone(protocol);imported.callBudgets.guardedHiGHSV13.enableDevelopmentEndpointImport=false;assert.throws(()=>validateProtocolV14(imported),/budgets/);
  const reused=structuredClone(protocol);reused.historicalSeedExclusions.excludedSeeds.push(791001);assert.throws(()=>validateProtocolV14(reused),/overlap/);
  const forced=structuredClone(protocol);forced.initialization.forcedEndpointImports=true;assert.throws(()=>validateProtocolV14(forced),/natural/);
});

test('actual Git blobs, not merely a claimed HEAD, gate source freeze in an isolated metadata fixture',async()=>{
  const dir=await fs.mkdtemp(join(tmpdir(),'v14-git-fixture-')),original='export const handcrafted = 1;\n';
  const git=args=>exec('git',args,{cwd:dir,encoding:'utf8'});
  try{
    await git(['-c','init.defaultBranch=main','init','-q']);await fs.writeFile(join(dir,'runtime.mjs'),original);await git(['add','runtime.mjs']);
    await git(['-c','user.name=PortPlan Fixture','-c','user.email=fixture@example.invalid','-c','commit.gpgsign=false','-c','core.hooksPath=/dev/null','commit','-q','-m','isolated source-byte fixture']);
    const hashes={'runtime.mjs':sha256(original)},verified=await verifyCommittedSourcesV14(hashes,{rootDirectory:dir});
    assert.equal(verified.sourceCommitVerified,true);assert.equal(verified.committedBlobHashes['runtime.mjs'],gitBlobHashV14(original,verified.gitObjectFormat));
    assert.equal((await git(['rev-parse','HEAD'])).stdout.trim(),verified.sourceGitCommit);
    const changed='export const handcrafted = 2;\n';await fs.writeFile(join(dir,'runtime.mjs'),changed);
    await assert.rejects(verifyCommittedSourcesV14({'runtime.mjs':sha256(changed)},{rootDirectory:dir}),/must first be committed/);
    await fs.writeFile(join(dir,'runtime.mjs'),original);await fs.writeFile(join(dir,'untracked.mjs'),'fixture');
    await assert.rejects(verifyCommittedSourcesV14({...hashes,'untracked.mjs':sha256('fixture')},{rootDirectory:dir}),/must first be committed/);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('root push provenance must match the committed source and full embedded protocol must match frozen bytes',async()=>{
  const commit='a'.repeat(40),receipt={schemaVersion:'portplan-v14-root-verified-source-push',sourceGitCommit:commit,remoteName:'origin',branch:'main',
    observedRemoteCommit:commit,verifiedAt:'2026-10-17T01:00:00Z',verification:'git push then authenticated git ls-remote exact branch; root observation, not external attestation'};
  assert.equal(validateSourcePushReceiptV14(receipt,commit),receipt);
  for(const changed of [{observedRemoteCommit:'b'.repeat(40)},{verification:'external certification'},{verifiedAt:'invalid'},{extra:'unreviewed fields'}])assert.throws(()=>validateSourcePushReceiptV14({...receipt,...changed},commit),/source-push receipt/);
  const bytes=await fs.readFile(new URL('../data/protocol-v14.json',import.meta.url)),manifest={protocol:JSON.parse(bytes),protocolHash:sha256(bytes)};
  assert.deepEqual(assertFrozenProtocolBindingV14(manifest,bytes),manifest.protocol);
  const drifted=structuredClone(manifest);drifted.protocol.purpose='Embedded-only semantic change with unchanged displayed SHA.';
  assert.doesNotThrow(()=>validateProtocolV14(drifted.protocol));assert.throws(()=>assertFrozenProtocolBindingV14(drifted,bytes),/Embedded frozen protocol differs/);
  for(const value of [Infinity,NaN,undefined])assert.throws(()=>canonicalJSONV14(value));
});

test('one frozen source has one WX first attempt even if a second run requests a different output directory',async()=>{
  const dir=await fs.mkdtemp(join(tmpdir(),'v14-first-attempt-')),frozen=join(dir,'frozen'),output=join(frozen,'first-run');
  try{
    await fs.mkdir(frozen);const manifest={protocolHash:'a'.repeat(64),sourceGitCommit:'b'.repeat(40),sourcePushReceipt:{sha256:'c'.repeat(64)}};
    const first=await writeFirstRunAuthorizationV14(frozen,output,manifest,'d'.repeat(64));assert.equal(first.marker.outputRelativeToFrozen,'first-run');
    assert.equal(first.marker.rootAuthorized,true);assert.equal(first.marker.plannedEpisodeCount,3024);
    const bytes=await fs.readFile(join(frozen,'execution-start.json'));assert.equal(first.artifact.sha256,sha256(bytes));
    await assert.rejects(writeFirstRunAuthorizationV14(frozen,join(dir,'alternative'),manifest,'d'.repeat(64)),/EEXIST/);
    await assert.rejects(runFrozenExperimentV14(frozen,join(dir,'alternative'),{rootAuthorized:true}),/preserve the first run/);
    assert.deepEqual(await fs.readFile(join(frozen,'execution-start.json')),bytes);await assert.rejects(fs.access(join(dir,'alternative')),/ENOENT/);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('worker allows only seven fixed factories and default V13 refuses offline development imports without launching Python',async()=>{
  await assert.rejects(createEpisodePlannerV14('../arbitrary',{}),/fixed method registry/);
  for(const key of ['enableDevelopmentEndpointImport','servicePath','pythonExecutable','seedConstructor','now','onIncumbent'])await assert.rejects(createEpisodePlannerV14('guardedHiGHSV13',{[key]:false}),/forbids development/);
  const planner=await createEpisodePlannerV14('guardedHiGHSV13',{});
  try{assert.throws(()=>planner.importDevelopmentEndpoint({},[],{}),/disabled by default/);}finally{await planner.close();}
  const input={method:'guardedHiGHSV13',nominalScenario:tiny(),events:[],algorithmSeed:79011,repeatIndex:1,callBudgets:{guardedHiGHSV13:{timeBudgetMs:200}}};
  for(const key of ['originalResult','endpointDates','developmentEndpoint','forcedPrefix','replayPrefix','plannerFactoryForTest'])await assert.rejects(runEpisodeV14({...input,[key]:{}}),/natural full-D0/);
});

test('natural D0 handwritten worker calls never receive future events or a forced prefix and retain full V13 guard proofs',async()=>{
  const calls=[];let ready=0,closed=0;
  const plannerFactoryForTest=configuration=>{
    assert.equal(Object.hasOwn(configuration,'enableDevelopmentEndpointImport'),false);
    const planner=async(snapshot,options)=>{
      calls.push({snapshot:structuredClone(snapshot),options:structuredClone(options)});
      const row=rowFor(snapshot,snapshot.containers[0],0,0,4),candidate=summarize(snapshot,'handwritten',[row],0,'feasible',{objectiveMode:'joint'});
      return {...candidate,plannerMetadata:{solverCalls:calls.length,developmentEndpointImport:null,
        stabilitySelection:{strictFeeGuard:{incumbentDates:[row],proposalDates:[row],complete:true,decision:'handwritten'},constructorDelivery:{events:[]}},
        nativeCertificate:{rawDates:Array.from({length:150},()=>({...row}))}}};
    };
    planner.ready=async()=>{ready++;};planner.close=async()=>{closed++;};return planner;
  };
  const result=await runEpisodeV14({method:'guardedHiGHSV13',nominalScenario:tiny(),events:[{id:'unrevealed',resource:'truck',revealDay:2,duration:1,capacity:0}],
    algorithmSeed:79011,repeatIndex:1,callBudgets:{guardedHiGHSV13:{timeBudgetMs:200,timeLimitSeconds:.2}}},{plannerFactoryForTest});
  assert.equal(ready,1);assert.equal(closed,1);assert.equal(result.complete,true);assert.equal(result.auditValid,true);
  assert.equal(result.naturalFullD0,true);assert.equal(result.developmentEndpointImportEnabled,false);assert.equal(calls[0].options.minEventDay,0);assert.deepEqual(calls[0].options.fixedEvents,{});
  assert.equal(calls[0].snapshot.truckCapacity[2],2);assert.equal(calls[2].snapshot.truckCapacity[2],0);
  for(const call of calls)for(const value of [call.snapshot,call.options])for(const key of ['events','futureEvents','actualScenario','unrevealedEvents','originalResult'])assert.equal(Object.hasOwn(value,key),false);
  assert.equal(result.plannerTrace[0].nativeCertificate.rawDates.length,150);assert.equal(result.plannerTrace[0].developmentEndpointImport,null);
});

test('V14 proof compaction and cold parent reuse the exact frozen V12 lifecycle and preserve full strict-fee evidence',async()=>{
  assert.equal(runColdEpisodeV14,runColdEpisodeV12);assert.equal(isCompleteV14,isCompleteV12);
  const metadata={stabilitySelection:{strictFeeGuard:{proposalDates:Array.from({length:150},(_,index)=>({id:'manual-'+index,returnDay:1})),proof:{mandatoryWarehouseTomorrow:2}}},developmentEndpointImport:null};
  assert.deepEqual(compactPlannerMetadataV14(metadata,{}).stabilitySelection,metadata.stabilitySelection);
  const dir=await fs.mkdtemp(join(tmpdir(),'v14-cold-'));
  try{
    const worker=join(dir,'worker.mjs'),physical=terminalFixture();
    await fs.writeFile(worker,`process.once('message',input=>process.send({type:'final',episodeId:input.episodeId,method:input.method,result:${JSON.stringify(physical)}},()=>process.disconnect()));\n`);
    const result=await runColdEpisodeV14({episodeId:'handwritten',nominalScenario:tiny(),events:[],method:'guardedHiGHSV13'},{hardWallMs:5000,workerScript:worker});
    assert.equal(isCompleteV14(result),true);assert.equal(result.processGroupCleanup.verificationResult,'ESRCH');assert.ok(result.wallTimeMs<=5000);
    const receipt=compactEpisodeReceiptV14(result,{path:'episodes/manual.json',sha256:'a'.repeat(64)});assert.equal(isCompleteV14(receipt),true);
    assert.deepEqual(receipt.processGroupCleanup,result.processGroupCleanup);assert.deepEqual(receipt.unacceptedTerminalReceipts,result.unacceptedTerminalReceipts);
  }finally{await fs.rm(dir,{recursive:true,force:true});}
});

test('a forbidden import receipt fails natural execution and remains full rejected-candidate evidence',async()=>{
  const s=tiny(),illegalReceipt={accepted:true,sourceDates:[{id:'manual-C1',pickupDay:0,unloadDay:0,returnDay:1}],claimsNativeDiscovery:false};
  const result=await runEpisodeV14({method:'guardedHiGHSV13',nominalScenario:s,events:[],algorithmSeed:79011,repeatIndex:1,
    callBudgets:{guardedHiGHSV13:{timeBudgetMs:200,timeLimitSeconds:.2}}},{plannerFactoryForTest:()=>{
    const planner=async snapshot=>({...summarize(snapshot,'handwritten',[rowFor(snapshot,snapshot.containers[0],0,0,1)],0,'feasible'),
      plannerMetadata:{developmentEndpointImport:illegalReceipt}});planner.close=async()=>{};return planner;
  }});
  assert.equal(result.complete,false);assert.equal(result.failure.day,0);assert.equal(result.totalCost,null);
  assert.deepEqual(result.plannerTrace[0].developmentEndpointImport,illegalReceipt);assert.match(result.plannerTrace[0].error,/cannot appear/);
});

test('seven-way statistics retain pair-specific negative fees, distinct panels, unknown counters and all-six completion losses',()=>{
  const cases=[{id:'a',panel:'same-distribution',repeats:[1,2,3].map(repeatIndex=>({repeatIndex,policies:{...policies(100),guardedHiGHSV13:complete(80)}}))},
    {id:'b',panel:'same-distribution',repeats:[{repeatIndex:1,policies:{...policies(1000),guardedHiGHSV13:complete(1100)}},
      ...[2,3].map(repeatIndex=>({repeatIndex,policies:{...policies(1000),guardedHiGHSV13:unknownEpisodeV14('guardedHiGHSV13','handwritten unknown')}}))]},
    {id:'c',panel:'stress',repeats:[{repeatIndex:1,policies:policies(0)}]}];
  const summary=summarizeExperimentV14(cases,{bootstrap:{draws:30,seed:7}}),pair=summary.panels['same-distribution'].comparisons.v13VsV12;
  assert.equal(pair.fees.total.pairedScenarioCount,2);assert.equal(pair.fees.total.pairedEpisodeCount,4);assert.equal(pair.fees.total.scenarioWeightedSavingsKRW,-80);
  assert.deepEqual(pair.fees.total.scenarioWinTieLoss,{win:1,tie:0,loss:1});assert.equal(pair.completion.lostEpisodeCount,2);
  assert.equal(summary.panels.stress.comparisons.v13VsV7.fees.total.weightedSavingsPct,null);assert.equal(summary.panels['same-distribution'].byMethod.guardedHiGHSV13.counters.solverCalls.unknownEpisodeCount,2);
  assert.equal(Object.keys(summary.panels.stress.comparisons).length,14);assert.equal(summary.panels['same-distribution'].observedDecisionGates.defaultRecommendationEligible,false);
  const gates=observedDecisionGatesV14(summary.panels['same-distribution'].comparisons,{completePanel:true});assert.equal(Object.keys(gates.completionLossCountsByBaseline).length,6);
  assert.equal(Object.keys(gates.nativeComparisons).length,4);assert.equal(gates.defaultRecommendationEligible,false);
});

test('all-seven Pareto cannot include repeats missing V12 and completion gains do not cancel any comparator loss',()=>{
  const all=policies(100);for(const method of METHODS_V14)all[method].revisionCount=10;all.guardedHiGHSV13=complete(80,5);
  const excluded={...policies(999999),seededHiGHSV12:unknownEpisodeV14('seededHiGHSV12','manual')};
  const cases=[{id:'a',repeats:[{repeatIndex:1,policies:all},{repeatIndex:2,policies:excluded}]}],joint=jointCompleteParetoV14(cases);
  assert.equal(joint.eligibility,'all-seven-matching-complete-repeats');assert.equal(joint.jointEpisodeCount,1);assert.equal(joint.byMethod.guardedHiGHSV13.scenarioMeanIncrementalCostSumKRW,80);
  assert.equal(joint.frontiers.incrementalAndRevisions.find(row=>row.method==='guardedHiGHSV13').dominates.length,6);
  const summary=summarizePanelV14([{id:'a',repeats:[{repeatIndex:1,policies:all}]}],{bootstrap:{draws:30,seed:7}}),gates=observedDecisionGatesV14(summary.comparisons,{completePanel:true});
  assert.equal(gates.defaultRecommendationEligible,true);
  const lost=structuredClone(summary.comparisons);lost.v13VsV12.completion.lostEpisodeCount=1;lost.v13VsV7.completion.gainedEpisodeCount=999;
  assert.equal(observedDecisionGatesV14(lost,{completePanel:true}).defaultRecommendationEligible,false);assert.equal(observedDecisionGatesV14(summary.comparisons,{completePanel:false}).defaultRecommendationEligible,false);
});

test('seven actual cold factories on handwritten input only require an explicit separate native window',{
  skip:process.env.PORTPLAN_V14_FACTORY_SMOKE!=='1'},async()=>{
  const protocol=JSON.parse(await fs.readFile(new URL('../data/protocol-v14.json',import.meta.url)));
  for(const method of METHODS_V14){
    const result=await runColdEpisodeV14({episodeId:'handwritten-'+method,nominalScenario:tiny(),events:[],method,algorithmSeed:79011,repeatIndex:1,callBudgets:protocol.callBudgets},
      {hardWallMs:5000,workerScript:new URL('../scripts/episode-v14.worker.mjs',import.meta.url)});
    assert.equal(isCompleteV14(result),true,method+': '+JSON.stringify(result.failure));assert.equal(result.naturalFullD0,true);
    if(method==='guardedHiGHSV13')assert.ok(result.plannerTrace.every(row=>row.developmentEndpointImport===null));
  }
});
