import test from 'node:test';
import assert from 'node:assert/strict';
import {solveScenario,auditSchedule} from '../src/engine.js';
import {independentAuditV2} from '../scripts/benchmark-v2.mjs';

const scenario=()=>({id:'workbench-v5-repair',seed:17,horizonStart:'2026-10-12',horizonDays:3,
  truckCapacity:[1,1,2],warehouseCapacity:1,stagingCapacity:2,
  containers:[{id:'A',sizeFt:20,releaseDay:0,unloadDays:1,dueDay:0},{id:'B',sizeFt:40,releaseDay:1,unloadDays:1,dueDay:1}]
    .map(c=>({...c,dischargeDateTime:'2026-09-29T07:00:00+09:00',dataOrigin:'synthetic'}))});

test('V5 workbench passes complete canonical candidates into search and MILP cutoff without old greedy initialization',async()=>{
  const s=scenario(),before=JSON.stringify(s);
  const result=await solveScenario(s,{timeLimitSeconds:1,presolveV4:true,fastV5:{constructorBudgetMs:200,eventSearchBudgetMs:20,maxRestarts:0}});
  assert.equal(result.modelVersion,'v5-workbench');
  assert.deepEqual(Object.keys(result.policies),['fastConstructor','eventSearch','optimized']);
  for(const policy of Object.values(result.policies)) {
    assert.equal(policy.rows.length,2);assert.equal(auditSchedule(s,policy.rows).valid,true);assert.deepEqual(independentAuditV2(s,policy),[]);
  }
  assert.ok(result.policies.eventSearch.incrementalCost<=result.policies.fastConstructor.incrementalCost);
  assert.equal(result.policies.optimized.presolveMetadata.auditedCandidateCount,2);
  assert.ok(['fastConstructor','eventSearch'].includes(result.policies.optimized.presolveMetadata.upperBoundSource));
  assert.equal(result.planningBudget.equalResearchBudget,false);assert.equal(result.planningBudget.eventSearchBudgetMs,20);
  assert.equal(result.planningBudget.milpTimeLimitSeconds,1);assert.equal(result.recommendedPolicy,'optimized');
  assert.equal(JSON.stringify(s),before);
});

test('V5 empty heuristic budgets keep null failures while the optimizer can still return a complete plan',async()=>{
  const s=scenario(),result=await solveScenario(s,{timeLimitSeconds:1,presolveV4:true,fastV5:{constructorBudgetMs:0,eventSearchBudgetMs:0}});
  for(const key of ['fastConstructor','eventSearch']) {
    assert.equal(result.policies[key].rows.length,0);assert.equal(result.policies[key].incrementalCost,null);assert.equal(result.policies[key].totalCost,null);
  }
  assert.equal(result.policies.optimized.rows.length,2);assert.equal(result.policies.optimized.presolveMetadata.auditedCandidateCount,0);
  assert.deepEqual(independentAuditV2(s,result.policies.optimized),[]);assert.equal(result.recommendedPolicy,'optimized');
});

test('V5 budget configuration is bounded and the default legacy API remains available',async()=>{
  const s=scenario();
  await assert.rejects(solveScenario(s,{fastV5:{constructorBudgetMs:-1}}),/constructorBudgetMs/);
  await assert.rejects(solveScenario(s,{fastV5:{eventSearchBudgetMs:Infinity}}),/eventSearchBudgetMs/);
  const fast=await solveScenario(s,{timeLimitSeconds:1,fastV5:{constructorBudgetMs:2000,eventSearchBudgetMs:0,maxRestarts:0}});
  assert.equal(fast.planningBudget.constructorBudgetMs,200);assert.equal(fast.policies.fastConstructor.rows.length,2);
  const legacy=await solveScenario(s,{timeLimitSeconds:1,strongSearch:false});
  assert.deepEqual(Object.keys(legacy.policies),['fifo','earliestFreeEnd','marginalCost','earliestDeadline','optimized']);
  assert.equal(legacy.planningBudget,undefined);assert.equal(legacy.policies.fastConstructor,undefined);
});

test('executed-event constraints override the V5 heuristic route and preserve locked actions',async()=>{
  const s=scenario();
  const result=await solveScenario(s,{timeLimitSeconds:1,fastV5:true,minEventDay:1,fixedEvents:{A:{pickupDay:0,unloadDay:0}}});
  assert.equal(result.modelVersion,'v4-execution');assert.deepEqual(Object.keys(result.policies),['optimized']);
  assert.equal(result.policies.optimized.rows.find(row=>row.id==='A').pickupDay,0);
  assert.equal(result.policies.fastConstructor,undefined);
});
