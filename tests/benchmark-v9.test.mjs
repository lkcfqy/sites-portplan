import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {rowFor,summarize} from '../src/engine.js';
import {compactPlannerMetadataV9,createEpisodePlannerV9,unknownEpisodeV9} from '../scripts/episode-v9.worker.mjs';
import {METHODS_V9,enumerateCasesV9,validateProtocolV9,executionOrderV9,runColdEpisodeV9,validateCompleteReceiptV9,
  summarizePanelV9,summarizeExperimentV9,pairedBootstrapV9,compactEpisodeReceiptV9,isCompleteV9,assertNewOutputV9} from '../scripts/benchmark-v9.mjs';

const tiny=()=>({id:'handcrafted-v9',horizonStart:'2026-10-12',horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:2,
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
    plannerStats:{decisionCalls:2,solverCalls:1,constructorCalls:1,reusedPlans:1,replannedDueToInvalid:0,planningWallMs:10,callWallMs:[8,2]}};
}
const complete=(fee,revisionCount=0)=>({...terminalFixture(),totalCost:fee,incrementalCost:fee,revisionCount});
const allPolicies=fee=>Object.fromEntries(METHODS_V9.map(method=>[method,complete(fee)]));

test('V9 predeclared matrix enumerates 144 unique metadata cases, fixed three repeats, separate stress and known orders without generation',async()=>{
  const protocol=JSON.parse(await readFile(new URL('../data/protocol-v9.json',import.meta.url),'utf8'));
  assert.equal(validateProtocolV9(protocol),protocol);const cases=enumerateCasesV9(protocol);
  assert.equal(cases.length,144);assert.equal(new Set(cases.map(c=>c.seed)).size,144);assert.equal(new Set(cases.map(c=>c.id)).size,144);
  assert.deepEqual(protocol.methods,METHODS_V9);assert.equal(protocol.generator.ordersKnownAtStart,true);assert.equal(protocol.algorithmRepeats.length,3);
  for(const panel of protocol.panels){
    const subset=cases.filter(c=>c.panel===panel.id);assert.equal(subset.length,72);
    for(const mechanism of protocol.matrix.mechanisms)for(const capacity of protocol.matrix.capacityProfiles)for(const count of protocol.matrix.counts)
      assert.equal(subset.filter(c=>c.mechanism===mechanism&&c.capacityProfile===capacity&&c.count===count).length,4);
  }
  assert.equal(cases.filter(c=>c.panel==='stress').flatMap(c=>c.shocks).some(s=>s.announcedDuration!==undefined),false);
  const original=JSON.parse(await readFile(new URL('../data/protocol-v7.json',import.meta.url),'utf8'));
  const previous=JSON.parse(await readFile(new URL('../data/protocol-v8.json',import.meta.url),'utf8'));
  const oldSeeds=new Set(original.primaryCases.map(c=>c.seed));
  for(const panel of previous.panels)for(let i=0;i<panel.scenarioCount;i++)oldSeeds.add(panel.baseSeed+i);
  assert.ok(cases.every(c=>!oldSeeds.has(c.seed)));
  for(const method of ['stableRetainV5','costPolishV7','adaptiveV8','highsV8'])assert.deepEqual(protocol.callBudgets[method],previous.callBudgets[method]);
  assert.deepEqual(protocol.callBudgets.adaptiveV9,protocol.callBudgets.adaptiveV8);
  const orderCounts=Object.fromEntries(METHODS_V9.map(method=>[method,Array(5).fill(0)]));
  for(let i=0;i<5;i++)for(const [position,method]of executionOrderV9(i,0).entries())orderCounts[method][position]++;
  assert.ok(Object.values(orderCounts).every(counts=>counts.every(n=>n===1)));
  const forged=structuredClone(protocol);forged.panels[1].baseSeed=forged.panels[0].baseSeed;
  assert.throws(()=>validateProtocolV9(forged),/unique/);
  const retuned=structuredClone(protocol);retuned.callBudgets.adaptiveV9.timeBudgetMs=1000;
  assert.throws(()=>validateProtocolV9(retuned),/200ms/);
  const observer=structuredClone(protocol);observer.callBudgets.adaptiveV9.onIncumbent='diagnostic';
  assert.throws(()=>validateProtocolV9(observer),/observers/);
  const resampled=structuredClone(protocol);resampled.analysis.bootstrap.seed=1;
  assert.throws(()=>validateProtocolV9(resampled),/bootstrap/);
});

test('worker refuses arbitrary factory registries and preserves complete adaptive explanations and date proofs',async()=>{
  await assert.rejects(createEpisodePlannerV9('../outside',{}),/fixed method registry/);
  const dates=Array.from({length:150},(_,i)=>({id:`proof-${i}`,pickupDay:0,unloadDay:0,returnDay:1}));
  const metadata={action:'polish',decisionReason:'approaching fee tier',feeOpportunity:{candidates:dates},adaptiveDecision:{alternatives:dates},
    phaseWallMs:{cacheAudit:1,polish:15},polishMetadata:{beforeDates:dates,afterDates:dates},rows:dates.map(row=>({...row,extra:'duplicate price'}))};
  const omissions={},compact=compactPlannerMetadataV9(metadata,omissions);
  assert.equal(compact.action,'polish');assert.equal(compact.decisionReason,metadata.decisionReason);
  assert.deepEqual(compact.feeOpportunity,metadata.feeOpportunity);assert.deepEqual(compact.adaptiveDecision,metadata.adaptiveDecision);
  assert.deepEqual(compact.polishMetadata.beforeDates,dates);assert.deepEqual(compact.polishMetadata.afterDates,dates);
  assert.equal(compact.rows.omittedDuplicateRows,150);assert.ok(omissions.rows>0);
  const candidateDelivery={receipts:dates.map((row,sequence)=>({sequence,beforeDates:dates,afterDates:[row],timely:true,accepted:true})),audit:{valid:true}};
  assert.deepEqual(compactPlannerMetadataV9({candidateDelivery},{}).candidateDelivery,candidateDelivery);
});

test('terminal receipt requires physical execution and independently repriced fee evidence',()=>{
  const input={nominalScenario:tiny(),events:[]},receipt=terminalFixture();
  assert.deepEqual(validateCompleteReceiptV9(input,receipt),[]);
  const wrong=structuredClone(receipt);wrong.totalCost+=1;
  assert.ok(validateCompleteReceiptV9(input,wrong).some(error=>error.includes('totalCost mismatch')));
  const staticOnly=structuredClone(receipt);staticOnly.timeline=[];assert.ok(validateCompleteReceiptV9(input,staticOnly).length>0);
});

test('parent accepts only timely audited full receipts and keeps unknown timeout fees/counters null',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'portplan-v9-parent-'));
  try{
    const worker=join(dir,'fixture.mjs'),input={episodeId:'manual',nominalScenario:tiny(),events:[],method:'adaptiveV9'};
    await writeFile(worker,`process.once('message',input=>{process.send({type:'final',episodeId:input.episodeId,method:input.method,result:${JSON.stringify(terminalFixture())}},()=>process.disconnect());});\n`);
    const accepted=await runColdEpisodeV9(input,{hardWallMs:1500,workerScript:worker});
    assert.equal(isCompleteV9(accepted),true);assert.ok(accepted.receiptValidatedMs<=1500);assert.equal(accepted.outputDeliveredWithinBudget,true);
    const staticOnly={...terminalFixture(),timeline:[]};
    await writeFile(worker,`process.once('message',input=>{process.send({type:'final',episodeId:input.episodeId,method:input.method,result:${JSON.stringify(staticOnly)}},()=>process.disconnect());});\n`);
    const rejected=await runColdEpisodeV9(input,{hardWallMs:1500,workerScript:worker});
    assert.equal(rejected.rejectedTerminalCount,1);assert.equal(rejected.complete,false);assert.equal(rejected.totalCost,null);
    assert.equal(rejected.unacceptedTerminalReceipts.length,1);
    assert.equal(rejected.unacceptedTerminalReceipts[0].reason,'terminal_audit_rejected');
    assert.deepEqual(rejected.unacceptedTerminalReceipts[0].message.result,staticOnly);
    assert.ok(rejected.unacceptedTerminalReceipts[0].errors.length>0);
    await writeFile(worker,"process.once('message',()=>{process.send({type:'progress',decisionCalls:99});setInterval(()=>{},1000);});\n");
    const timed=await runColdEpisodeV9(input,{hardWallMs:250,workerScript:worker});
    assert.equal(timed.status,'hard_time_limit');assert.equal(timed.executionHistoryUnavailable,true);
    assert.equal(timed.revisionCount,null);assert.equal(timed.plannerStats.decisionCalls,null);assert.equal(timed.incrementalCost,null);
    assert.ok(Number.isFinite(timed.actualCutoffMs));assert.equal(timed.wallTimeMs,timed.actualCutoffMs);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('hard timeout terminates the native descendant process group', {skip:process.platform==='win32'},async()=>{
  const dir=await mkdtemp(join(tmpdir(),'portplan-v9-process-group-'));
  try{
    const worker=join(dir,'fixture.mjs'),pidFile=join(dir,'descendant.pid');
    await writeFile(worker,`import{spawn}from'node:child_process';import{writeFile}from'node:fs/promises';process.once('message',async()=>{const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});await writeFile(${JSON.stringify(pidFile)},String(child.pid));setInterval(()=>{},1000);});\n`);
    const result=await runColdEpisodeV9({episodeId:'group',nominalScenario:tiny(),events:[],method:'highsV8'},{hardWallMs:600,workerScript:worker});
    assert.equal(result.status,'hard_time_limit');const pid=Number(await readFile(pidFile,'utf8'));
    let state=null;try{state=(await readFile(`/proc/${pid}/stat`,'utf8')).split(' ')[2];}catch(error){if(error.code!=='ENOENT')throw error;}
    assert.ok(state===null||state==='Z',`Native descendant still alive with state ${state}`);
    assert.equal(result.processGroupCleanup.mode,'posix-process-group');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('scenario-paired analysis retains repeat matching, negative fees, null denominators and unknown completion gains',()=>{
  const cases=[{id:'a',panel:'same-distribution',repeats:[1,2,3].map(repeatIndex=>({repeatIndex,policies:{...allPolicies(100),adaptiveV9:complete(80)}}))},
    {id:'b',panel:'same-distribution',repeats:[{repeatIndex:1,policies:{...allPolicies(1000),adaptiveV9:complete(1100)}},
      ...[2,3].map(repeatIndex=>({repeatIndex,policies:{...allPolicies(1000),adaptiveV9:unknownEpisodeV9('adaptiveV9','fixture failure')}}))]},
    {id:'c',panel:'same-distribution',repeats:[{repeatIndex:1,policies:{...allPolicies(0),stableRetainV5:unknownEpisodeV9('stableRetainV5','unknown'),adaptiveV9:complete(0)}}]},
    {id:'d',panel:'stress',repeats:[{repeatIndex:1,policies:allPolicies(0)}]}];
  const summary=summarizePanelV9(cases.slice(0,3),{bootstrap:{draws:100,seed:7}}),comparison=summary.comparisons.v9VsV5;
  assert.equal(comparison.fees.total.pairedScenarioCount,2);assert.equal(comparison.fees.total.pairedEpisodeCount,4);
  assert.equal(comparison.fees.total.baselineScenarioMeanSumKRW,1100);assert.equal(comparison.fees.total.candidateScenarioMeanSumKRW,1180);
  assert.equal(comparison.fees.total.scenarioWeightedSavingsKRW,-80);assert.equal(comparison.fees.total.baselineEpisodeSumKRW,1300);
  assert.deepEqual(comparison.fees.total.scenarioWinTieLoss,{win:1,tie:0,loss:1});assert.deepEqual(comparison.fees.total.negativeScenarioIds,['b']);
  assert.equal(comparison.completion.gainedEpisodeCount,1);assert.equal(comparison.completion.lostEpisodeCount,2);
  assert.deepEqual(comparison.completion.gainedFromUnknownHistoryEpisodeIds,['c::repeat-1']);
  assert.equal(summary.byMethod.stableRetainV5.counters.decisionCalls.unknownEpisodeCount,1);
  const experiment=summarizeExperimentV9(cases,{bootstrap:{draws:20}});
  assert.equal(experiment.panels['same-distribution'].scenarioCount,3);assert.equal(experiment.panels.stress.scenarioCount,1);
  assert.equal(experiment.panels.stress.comparisons.v9VsV7.fees.total.weightedSavingsPct,null);
  assert.equal(experiment.panels.stress.comparisons.v9VsV7.fees.incremental.zeroBaselineEpisodeCount,1);
  const units=[{baseline:100,candidate:90},{baseline:200,candidate:220}];
  assert.deepEqual(pairedBootstrapV9(units,{seed:6,draws:20}),pairedBootstrapV9(units,{seed:6,draws:20}));
});

test('lightweight receipt contains a hash reference rather than fake rows; existing output cannot be overwritten',async()=>{
  const artifact={path:'episodes/fixture.json',sha256:'a'.repeat(64)},receipt=compactEpisodeReceiptV9(terminalFixture(),artifact);
  assert.equal(receipt.rows,undefined);assert.equal(receipt.timeline,undefined);assert.equal(receipt.terminalRowCount,1);assert.equal(isCompleteV9(receipt),true);
  const missingProof={...receipt,episodeCompletedWithinBudget:false};assert.equal(isCompleteV9(missingProof),false);
  const dir=await mkdtemp(join(tmpdir(),'portplan-v9-no-overwrite-'));
  try{const path=join(dir,'first.json');await writeFile(path,'preserve');await assert.rejects(assertNewOutputV9(path),/preserve the first run/);assert.equal(await readFile(path,'utf8'),'preserve');}
  finally{await rm(dir,{recursive:true,force:true});}
});

test('five V9 allowed factories deliver a cold dual-audited episode on handcrafted orders',{
  skip:process.env.PORTPLAN_V9_FACTORY_SMOKE!=='1'},async()=>{
  const protocol=JSON.parse(await readFile(new URL('../data/protocol-v9.json',import.meta.url),'utf8'));
  for(const method of METHODS_V9){
    const input={episodeId:`handcrafted-${method}`,nominalScenario:tiny(),events:[],method,algorithmSeed:29011,repeatIndex:1,callBudgets:protocol.callBudgets};
    const result=await runColdEpisodeV9(input,{hardWallMs:5000});
    assert.equal(isCompleteV9(result),true,`${method}: ${JSON.stringify(result.failure)}`);
    assert.deepEqual(validateCompleteReceiptV9(input,result),[]);assert.ok(result.receiptValidatedMs<=5000);
    assert.ok(Number.isFinite(result.startupWallMs));
    if(method==='adaptiveV9')assert.ok(result.plannerTrace.every(entry=>entry.action&&entry.decisionReason&&entry.candidateDelivery));
    if(method==='highsV8')assert.ok(result.plannerTrace.every(entry=>entry.stages.readyAtCallStart===true));
  }
});

