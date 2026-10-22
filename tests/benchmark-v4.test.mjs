import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {solveEventSearch} from '../src/event-search-v4.js';
import {rowFor,summarize,auditSchedule} from '../src/engine.js';
import {independentAuditV2} from '../scripts/benchmark-v2.mjs';
import {PROTOCOL_SHA256_V4,protocolV4,runIsolatedV4,compareMethodsV4,summarizeV4,isFeasibleV4} from '../scripts/benchmark-v4.mjs';

test('V4 frozen matrix covers every declared mechanism, capacity and scale exactly once',async()=>{
  const bytes=await readFile(new URL('../data/protocol-v4.json',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),PROTOCOL_SHA256_V4);
  assert.equal(protocolV4.primaryCases.length,18);
  assert.deepEqual(protocolV4.primaryCases.map(c=>c.seed),Array.from({length:18},(_,i)=>41001+i));
  for(const mechanism of ['aged-backlog','new-arrivals','batch-release'])for(const capacityProfile of ['balanced','tight'])for(const count of [16,50,100])
    assert.equal(protocolV4.primaryCases.filter(c=>c.mechanism===mechanism&&c.capacityProfile===capacityProfile&&c.count===count).length,1);
  assert.equal(protocolV4.budget.hardWallMs,1000);
});

test('first-run source snapshot preserves every source hash recorded by the experiment',async()=>{
  const data=JSON.parse(await readFile(new URL('../data/benchmark-v4.json',import.meta.url),'utf8'));
  const manifest=JSON.parse(await readFile(new URL('../vendor/experiments/v4-first-run-source/manifest.json',import.meta.url),'utf8'));
  for(const [path,hash]of Object.entries(data.implementationHashes)) {
    const bytes=await readFile(new URL(`../vendor/experiments/v4-first-run-source/${path}`,import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'),hash);
    assert.equal(manifest.files[path].matchesExperiment,true);
  }
});

test('direct event search changes dates of a fixed container and audits every checkpoint',()=>{
  const c={id:'date-move',sizeFt:40,releaseDay:0,unloadDays:1,dueDay:3,dischargeDateTime:'2026-09-27T07:00:00+09:00',dataOrigin:'synthetic'};
  const s={horizonStart:'2026-10-12',horizonDays:5,truckCapacity:[1,1,1,1,1],warehouseCapacity:1,stagingCapacity:2,operations:{returnLagDays:1,stagingUnit:'teu'},containers:[c]};
  const initial=summarize(s,'delayed',[rowFor(s,c,2,2,3)],0),checkpoints=[];
  const result=solveEventSearch(s,{timeBudgetMs:60,seed:7,initialPolicies:{delayed:initial},onIncumbent:r=>checkpoints.push(r)});
  assert.equal(result.status,'feasible');
  assert.ok(result.incrementalCost<initial.incrementalCost);
  assert.equal(result.rows[0].pickupDay,0);assert.equal(result.rows[0].returnDay,1);
  assert.ok(result.searchMetadata.relocations+result.searchMetadata.destroyRepairAttempts+result.searchMetadata.fullRestartAttempts>0);
  for(const r of [...checkpoints,result]) {assert.equal(auditSchedule(s,r.rows).valid,true);assert.deepEqual(independentAuditV2(s,r),[]);}
});

test('expired and impossible direct search never prices a partial schedule',()=>{
  const c={id:'blocked',sizeFt:40,releaseDay:0,unloadDays:1,dueDay:2,dischargeDateTime:'2026-10-10T07:00:00+09:00',dataOrigin:'synthetic'};
  const s={horizonStart:'2026-10-12',horizonDays:4,truckCapacity:1,warehouseCapacity:1,stagingCapacity:1,operations:{returnLagDays:1,stagingUnit:'teu'},containers:[c]};
  for(const options of [{deadlineMs:performance.now()-1},{timeBudgetMs:15,initialPolicies:{}}]) {
    const result=solveEventSearch(s,options);assert.deepEqual(result.rows,[]);assert.equal(result.totalCost,null);assert.equal(result.incrementalCost,null);
    assert.equal(result.status,'no_feasible_schedule_found');assert.equal(result.optimality,'heuristic');
  }
});

test('external event-search date proposals cannot falsify fees or inject infinite calendar loops',()=>{
  const c={id:'proposal',sizeFt:20,releaseDay:0,unloadDays:1,dueDay:2,dischargeDateTime:'2026-09-27T07:00:00+09:00',dataOrigin:'synthetic'};
  const s={horizonStart:'2026-10-12',horizonDays:4,truckCapacity:1,warehouseCapacity:1,stagingCapacity:1,containers:[c]};
  const row=rowFor(s,c,2,2,3),tampered={...row,incrementalCost:-1e9,storageCost:0,ddCost:0,totalCost:0,sunkCost:0};
  const result=solveEventSearch(s,{timeBudgetMs:50,initialPolicies:{tampered:{rows:[tampered],incrementalCost:-1e9,totalCost:0}}});
  assert.ok(result.incrementalCost>0);assert.deepEqual(independentAuditV2(s,result),[]);
  const invalid=solveEventSearch({...s,stagingCapacity:0},{timeBudgetMs:10,initialPolicies:{malformed:{rows:[{...tampered,unloadDay:Infinity,returnDay:Infinity}]}}});
  assert.deepEqual(invalid.rows,[]);assert.equal(invalid.incrementalCost,null);
});

test('parent hard wall kills synchronous worker and retains only a timely audited checkpoint',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'portplan-wall-'));
  try {
    const fixture=join(dir,'worker.mjs');
    await writeFile(fixture,`process.once('message',()=>{process.send({type:'checkpoint',result:{policy:'fixture',status:'feasible',auditValid:true,rows:[{id:'one'}],incrementalCost:10,totalCost:12,objectiveCost:10,optimality:'heuristic',incumbentSource:'fixture-initial'}}); const end=Date.now()+700; while(Date.now()<end){}; process.send({type:'final',result:{status:'optimal',auditValid:true,rows:[{}],incrementalCost:0,totalCost:0,objectiveCost:0,optimality:'proven_optimal'}});});\n`);
    const r=await runIsolatedV4({},'fixture',{hardWallMs:180,workerScript:fixture});
    assert.equal(r.deadlineReached,true);assert.equal(r.endToEndCompletedWithinBudget,false);
    assert.equal(r.retainedCheckpoint,true);assert.equal(r.incrementalCost,10);assert.equal(r.status,'hard_time_limit');
    assert.equal(r.optimality,'feasible_incumbent_only');assert.equal(r.exitSignal,'SIGKILL');
    assert.ok(r.checkpointReceivedMs<180);assert.ok(r.wallTimeMs>=170);assert.ok(r.processExitWallTimeMs<600);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test('V4 summaries retain absent incumbents, zero denominators and negative savings',()=>{
  const feasible=n=>({auditValid:true,status:'feasible',rows:[{}],incrementalCost:n,totalCost:n+100,objectiveCost:n,optimality:'heuristic',wallTimeMs:1000,processExitWallTimeMs:1001,endToEndCompletedWithinBudget:true});
  const missing={auditValid:false,status:'hard_time_limit',rows:[],incrementalCost:null,totalCost:null,wallTimeMs:1000,deadlineReached:true};
  const policies={permutation:feasible(0),eventSearch:feasible(0),rawMILP:missing,presolveMILP:feasible(5)};
  assert.equal(compareMethodsV4(policies,'permutation','eventSearch').incrementalSavingsPct,null);
  assert.equal(compareMethodsV4(policies,'eventSearch','presolveMILP').incrementalSavingsKRW,-5);
  const summary=summarizeV4([{count:16,policies}]);
  assert.equal(summary.comparisons.presolveVsEventSearch.negativeSavingsCount,1);
  assert.equal(summary.comparisons.presolveVsRawMILP.pairedCaseCount,0);
  assert.equal(summary.byPolicy.rawMILP.feasibleCount,0);
});

test('completed V4 archive retains all frozen cases and independent audited costs',async()=>{
  const data=JSON.parse(await readFile(new URL('../data/benchmark-v4.json',import.meta.url),'utf8'));
  assert.equal(data.executionState,'complete');assert.equal(data.protocolHash,PROTOCOL_SHA256_V4);
  assert.deepEqual(data.cases.map(c=>c.id),protocolV4.primaryCases.map(c=>c.id));
  for(const c of data.cases) {
    assert.deepEqual(Object.keys(c.policies).sort(),[...protocolV4.methods].sort());
    for(const r of Object.values(c.policies)) {
      assert.equal(r.hardWallMs,1000);assert.ok(Number.isFinite(r.wallTimeMs));
      if(isFeasibleV4(r)) {assert.equal(r.rows.length,c.count);assert.deepEqual(independentAuditV2(c.scenario,r),[]);}
      else if(!r.rows.length)assert.equal(r.incrementalCost,null);
      if(r.optimality==='proven_optimal')assert.equal(r.endToEndCompletedWithinBudget,true);
      if(r.retainedCheckpoint)assert.equal(r.optimality,'feasible_incumbent_only');
    }
  }
  assert.deepEqual(data.summary,summarizeV4(data.cases));
});
