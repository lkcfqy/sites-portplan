import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {rowFor,summarize,auditSchedule} from '../src/engine.js';
import {independentAuditV2} from '../scripts/benchmark-v2.mjs';
import {compactPlannerMetadataV7,unknownEpisodeV7,DEFAULT_FACTORIES_V7} from '../scripts/rolling-v7.worker.mjs';
import {ROLLING_METHODS_V7,FROZEN_PROTOCOL_HASH_V7,loadProtocolV7,runColdEpisodeV7,validateCompleteReceiptV7,summarizeRollingV7,
  compareInitialPlansV7,assertNewOutputV7,developmentBundleV7,validateDevelopmentBundleV7,isCompleteV7} from '../scripts/rolling-benchmark-v7.mjs';

const tiny=()=>({id:'manual-v7-episode',horizonStart:'2026-10-12',horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:2,
  containers:[{id:'manual',sizeFt:20,releaseDay:0,unloadDays:1,dueDay:2,dischargeDateTime:'2026-10-10T07:00:00+09:00',dataOrigin:'synthetic'}]});
function deliveredFixture(s=tiny()) {
  const row=rowFor(s,s.containers[0],0,0,1),dates={id:row.id,pickupDay:0,unloadDay:0,returnDay:1};
  const timeline=[0,1].map(day=>({day,status:'executed',audit:{scheduleAudit:{valid:true,errors:[]},freezeAudit:{valid:true,errors:[]}},
    observationHash:'manual-same-observation',observedEvents:['truck','warehouse','staging'].map(resource=>({resource,capacity:s[resource+'Capacity']})),
    decisions:[dates],state:[{id:row.id,phase:day===0?'awaiting_return':'returned'}],revisions:[],
    executedEvents:day===0?[{id:row.id,event:'pickup',day},{id:row.id,event:'unloadStart',day}]:[{id:row.id,event:'return',day}]}));
  return {...summarize(s,'manual',[row],0,'feasible'),complete:true,auditValid:true,executionHistoryUnavailable:false,revisionCount:0,
    timeline,executedEvents:timeline.flatMap(entry=>entry.executedEvents),executionThroughDay:1,
    terminalAudit:{engine:{valid:true,errors:[]},independentErrors:[]},plannerStats:{decisionCalls:2,solverCalls:1,constructorCalls:1,reusedPlans:1,replannedDueToInvalid:0,planningWallMs:10,callWallMs:[8,2]}};
}

test('V7 execution stays disabled until a pinned protocol; a frozen matrix is inspectable without generating orders',async()=>{
  if(!/^[a-f0-9]{64}$/.test(FROZEN_PROTOCOL_HASH_V7)){await assert.rejects(loadProtocolV7(),/has not been frozen/);return;}
  const {protocol,protocolHash}=await loadProtocolV7();assert.equal(protocolHash,FROZEN_PROTOCOL_HASH_V7);
  assert.deepEqual(protocol.methods,ROLLING_METHODS_V7);assert.equal(ROLLING_METHODS_V7.length,5);
  assert.equal(protocol.budget.hardWallMs,5000);
  assert.equal(new Set(protocol.primaryCases.map(c=>c.seed)).size,protocol.primaryCases.length);
  assert.ok(protocol.primaryCases.every(c=>c.seed>=91001));
});

test('compact planner diagnostics retain date proof, scalar bound/status/clock and audit failures without duplicated pricing rows',()=>{
  const dates=Array.from({length:150},(_,i)=>({id:`manual-${i}`,pickupDay:0,unloadDay:0,returnDay:1}));
  const proof={seedAccepted:true,attempted:false,beforeDates:dates,afterDates:dates,seedIncrementalCost:50,finalIncrementalCost:50,
    seedObjectiveCost:50,finalObjectiveCost:50,jointNonincrease:true,seedAudit:{valid:true,errors:[]},finalAudit:{valid:true,errors:[]}};
  const prices=dates.map(row=>({...row,storageCost:9100,ddCost:15000,unloadEndDay:0,description:'duplicated fee row'.repeat(20)}));
  const metadata={decisionCalls:3,solverCalls:1,constructorCalls:1,polishCalls:1,acceptedCostMoves:0,wallTimeMs:22,deadlineOverrunMs:0,
    polishMetadata:proof,stages:{cacheAudit:{valid:false,errors:['day 1 capacity exceeded'],rows:prices},
      locked_constructor:{constructorMetadata:{costPolish:proof}},native:{status:'feasible',lowerBound:10,upperBound:50,
        model:{name:'debug-model',binaries:Array.from({length:1000},(_,i)=>`x_${i}`),status:'built',audit:{valid:true,errors:[]}},vars:Object.fromEntries(dates.map(row=>[row.id,1]))}}};
  const omissions={},before=JSON.stringify(metadata),compact=compactPlannerMetadataV7(metadata,omissions);
  assert.equal(JSON.stringify(metadata),before);assert.deepEqual(compact.polishMetadata.beforeDates,dates);assert.deepEqual(compact.polishMetadata.afterDates,dates);
  assert.equal(compact.polishMetadata.attempted,false);assert.equal(compact.polishMetadata.seedAccepted,true);
  assert.equal(compact.stages.cacheAudit.valid,false);assert.deepEqual(compact.stages.cacheAudit.errors,['day 1 capacity exceeded']);
  assert.equal(compact.stages.cacheAudit.rows.omittedDuplicateRows,150);assert.match(compact.stages.cacheAudit.rows.dateSHA256,/^[a-f0-9]{64}$/);
  assert.equal(compact.stages.native.lowerBound,10);assert.equal(compact.stages.native.upperBound,50);assert.equal(compact.stages.native.status,'feasible');
  assert.equal(compact.stages.native.model.evidence.audit.valid,true);assert.equal(compact.polishCalls,1);assert.equal(compact.wallTimeMs,22);
  assert.match(compact.stages.locked_constructor.constructorMetadata.costPolish.metadataRef,/polishMetadata/);
  assert.ok(JSON.stringify(compact).length<before.length/2);assert.ok(omissions.rows>0);
  const circular={status:'debug_only'};circular.audit=circular;
  const safe=compactPlannerMetadataV7({model:circular});
  assert.equal(safe.model.sha256,null);assert.equal(safe.model.evidence.audit.omittedCircularReference,true);
});

test('cold complete receipt requires consistent executed history and dual-audited prices, not a static full plan',()=>{
  const s=tiny(),input={nominalScenario:s,events:[]},result=deliveredFixture(s);
  assert.deepEqual(validateCompleteReceiptV7(input,result),[]);
  assert.ok(validateCompleteReceiptV7(input,{...result,timeline:[]}).some(error=>error.includes('physical timeline')));
  const duplicate=structuredClone(result);duplicate.timeline[1].executedEvents.push({...duplicate.timeline[1].executedEvents[0]});
  assert.ok(validateCompleteReceiptV7(input,duplicate).some(error=>error.includes('Duplicate physical event')));
  const tampered=structuredClone(result);tampered.totalCost=1;
  assert.ok(validateCompleteReceiptV7(input,tampered).some(error=>error.includes('Total totalCost mismatch')));
  const noDual=structuredClone(result);delete noDual.terminalAudit;
  assert.ok(validateCompleteReceiptV7(input,noDual).some(error=>error.includes('dual-audit')));
  const contradictory=structuredClone(result);contradictory.terminalAudit.engine.errors=['unexpected failure'];
  assert.ok(validateCompleteReceiptV7(input,contradictory).some(error=>error.includes('dual-audit')));
  const malformed=structuredClone(result);malformed.timeline[0]=null;
  assert.ok(validateCompleteReceiptV7(input,malformed).some(error=>error.includes('Malformed complete execution receipt')));
});

test('parent rejects forged static completion and a timeout keeps execution history and counters unknown',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'portplan-v7-receipt-'));
  try {
    const fixture=join(dir,'worker.mjs'),s=tiny(),staticOnly={...deliveredFixture(s),timeline:[]};
    await writeFile(fixture,`process.once('message',input=>{process.send({type:'final',episodeId:input.episodeId,method:input.method,result:${JSON.stringify(staticOnly)}},()=>process.disconnect());});\n`);
    const rejected=await runColdEpisodeV7({nominalScenario:s,events:[],method:'costPolishV7'},{hardWallMs:500,workerScript:fixture});
    assert.equal(rejected.complete,false);assert.equal(rejected.executionHistoryUnavailable,true);assert.equal(rejected.rejectedTerminalCount,1);
    assert.equal(rejected.totalCost,null);assert.equal(rejected.plannerStats.decisionCalls,null);
    await writeFile(fixture,`process.once('message',()=>{process.send({type:'progress',calls:4});setTimeout(()=>process.disconnect(),700);});\n`);
    const timed=await runColdEpisodeV7({nominalScenario:s,events:[],method:'costPolishV7'},{hardWallMs:180,workerScript:fixture});
    assert.equal(timed.status,'hard_time_limit');assert.equal(timed.executionHistoryUnavailable,true);assert.deepEqual(timed.timeline,[]);assert.equal(timed.revisionCount,null);
    assert.equal(timed.plannerStats.decisionCalls,null);assert.equal(timed.outputDeliveredWithinBudget,false);assert.equal(timed.exitSignal,'SIGKILL');
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('new and reproduction output guards refuse existing files; frozen control bundle contains only declared prior inputs',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'portplan-v7-bundle-'));
  try{
    const existing=join(dir,'existing.json');await writeFile(existing,'preserve me');
    await assert.rejects(assertNewOutputV7(existing),/Output already exists/);await assertNewOutputV7(join(dir,'new.json'));
    assert.equal(await readFile(existing,'utf8'),'preserve me');
  }finally{await rm(dir,{recursive:true,force:true});}
  const protocol={developmentControls:{inputArchive:'data/rolling-v6.json',inputArchiveSha256:'old-source-sha',caseIds:['old-manual'],suffix:'--development-control'}};
  const controls=[{id:'old-manual--development-control',referenceCaseId:'old-manual',referenceArchive:'data/rolling-v6.json',referenceArchiveSha256:'old-source-sha',
    dataRole:'development-control',nominalScenario:tiny(),events:[],referenceConfig:{id:'old-manual',count:1}}];
  const bundle=developmentBundleV7(protocol,controls);assert.deepEqual(validateDevelopmentBundleV7(protocol,bundle),controls);
  assert.equal(bundle.cases[0].policies,undefined);assert.equal(bundle.cases[0].plannerTrace,undefined);
  const wrong=structuredClone(bundle);wrong.cases[0].referenceArchiveSha256='changed';assert.throws(()=>validateDevelopmentBundleV7(protocol,wrong),/references differ/);
});

test('five-method summaries keep pair losses, zero denominators, unavailable history, and initial-plan qualification',()=>{
  const complete=(cost,changes)=>({...deliveredFixture(),totalCost:cost,incrementalCost:cost,revisionCount:changes,outputDeliveredWithinBudget:true});
  const cases=[{id:'manual-pair',count:24,policies:{dailyReoptV4:complete(100,8),stableRetainV5:complete(100,8),lockedRecoveryV6:complete(110,4),costPolishV7:complete(120,4),graspBaselineV7:complete(90,3)}},
    {id:'manual-zero',count:50,policies:Object.fromEntries(ROLLING_METHODS_V7.map(method=>[method,complete(0,0)]))},
    {id:'manual-unknown',count:100,policies:Object.fromEntries(ROLLING_METHODS_V7.map(method=>[method,unknownEpisodeV7(method,'no terminal output','hard_time_limit')]))}];
  const s=summarizeRollingV7(cases);
  assert.equal(s.comparisons.polishVsLocked.totalSavingsKRW,-10);assert.equal(s.comparisons.polishVsLocked.negativeSavingsCount,1);
  assert.equal(s.comparisons.polishVsLocked.zeroBaselineTotalCount,1);assert.equal(s.comparisons.polishVsLocked.pairedCaseCount,2);
  assert.equal(s.byMethod.graspBaselineV7.executionHistoryUnavailableCount,1);assert.equal(s.byMethod.graspBaselineV7.counters.decisionCalls.unknownEpisodeCount,1);
  const empty=Object.fromEntries(ROLLING_METHODS_V7.map(method=>[method,{timeline:[]}]));assert.equal(compareInitialPlansV7(tiny(),empty).allEqual,null);
  const full=Object.fromEntries(ROLLING_METHODS_V7.map(method=>[method,deliveredFixture()]));assert.equal(compareInitialPlansV7(tiny(),full).allEqual,true);
  assert.equal(Object.keys(compareInitialPlansV7(tiny(),full).pairs).length,10);
});

test('five declared fresh factories deliver dual-audited execution on a handcrafted input',{
  skip:process.env.PORTPLAN_V7_FACTORY_SMOKE!=='1'},async()=>{
  const {protocol}=await loadProtocolV7(),budgets=protocol.callBudgets;
  for(const method of ROLLING_METHODS_V7) {
    const input={nominalScenario:tiny(),events:[],method,callBudgets:budgets,methodFactories:DEFAULT_FACTORIES_V7};
    const result=await runColdEpisodeV7(input,{hardWallMs:2000});assert.equal(isCompleteV7(result),true,`${method}: ${JSON.stringify(result.failure)}`);
    assert.deepEqual(validateCompleteReceiptV7(input,result),[]);assert.ok(result.receiptValidatedMs<=2000);
    assert.equal(auditSchedule(input.nominalScenario,result.rows).valid,true);assert.deepEqual(independentAuditV2(input.nominalScenario,result),[]);
  }
});

let archiveExists=true;try{await access(new URL('../data/rolling-v7.json',import.meta.url));}catch{archiveExists=false;}
test('first V7 archive and compact source snapshot remain reproducible after the declared run',{skip:!archiveExists},async()=>{
  const data=JSON.parse(await readFile(new URL('../data/rolling-v7.json',import.meta.url),'utf8')),{protocol}=await loadProtocolV7();
  assert.equal(data.executionState,'complete');assert.equal(data.protocolHash,FROZEN_PROTOCOL_HASH_V7);
  assert.deepEqual(data.cases.map(c=>c.id),protocol.primaryCases.map(c=>c.id));assert.deepEqual(data.summary,summarizeRollingV7(data.cases));
  assert.deepEqual(data.developmentControls.summary,summarizeRollingV7(data.developmentControls.cases));
  for(const c of [...data.cases,...data.developmentControls.cases])for(const result of Object.values(c.policies)) {
    if(isCompleteV7(result)){assert.deepEqual(validateCompleteReceiptV7({nominalScenario:c.nominalScenario,events:c.events},result),[]);assert.ok(result.receiptValidatedMs<=5000);}
    else assert.equal(result.incrementalCost,null);
  }
  for(const [path,expected]of Object.entries(data.implementationHashes)) {
    const bytes=await readFile(new URL('../vendor/experiments/v7-first-run-source/'+path,import.meta.url));assert.equal(createHash('sha256').update(bytes).digest('hex'),expected);
  }
  if(data.developmentInputBundle) {
    const bytes=await readFile(new URL('../vendor/experiments/v7-first-run-source/'+data.developmentInputBundle.path,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),data.developmentInputBundle.sha256);
    assert.deepEqual(validateDevelopmentBundleV7(protocol,JSON.parse(bytes)),data.developmentControls.cases.map(c=>Object.fromEntries(Object.entries(c)
      .filter(([key])=>!['scenario','policies','audits','initialComparison','methodExecutionOrder'].includes(key)))));
  }
});
