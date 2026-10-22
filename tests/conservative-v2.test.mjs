import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDemoScenario} from '../src/engine.js';
import {makeConservativeScenario,solveConservativePlan,remapPlanToScenario} from '../src/conservative-plan.js';
import {auditOperations} from '../scripts/robustness-v2.mjs';

test('buffer applies to every box and every horizon day without mutating nominal inputs',()=>{
  const s=makeDemoScenario(42,8),snapshot=structuredClone(s);s.truckCapacity=[1,2,3,4,5,6,7,8,9,10,11,12,13,14];
  const worst=makeConservativeScenario(s);
  assert.deepEqual(worst.truckCapacity,[0,0,1,2,3,4,5,6,7,8,9,10,11,12]);
  worst.containers.forEach((c,i)=>assert.equal(c.unloadDays,s.containers[i].unloadDays+1));
  assert.deepEqual(s.containers,snapshot.containers);
});
test('complete buffer plan passes independent audits over varied subsets within the uncertainty envelope',async()=>{
  const s=makeDemoScenario(42,6);s.truckCapacity=6;s.warehouseCapacity=4;s.stagingCapacity=8;
  const r=await solveConservativePlan(s,{timeLimitSeconds:2});
  assert.ok(r.nominalResult);assert.equal(auditOperations(r.worstCaseScenario,r.worstCaseResult.rows).valid,true);
  assert.equal(r.nominalResult.totalCost,r.worstCaseResult.totalCost);
  for(let mask=0;mask<64;mask++){
    const actual=structuredClone(s);
    actual.containers.forEach((c,i)=>{if(mask&(1<<i))c.unloadDays++;});
    actual.truckCapacity=Array.from({length:s.horizonDays},(_,d)=>6-(mask+d)%3);
    const audit=auditOperations(actual,r.nominalResult.rows);assert.equal(audit.valid,true,JSON.stringify(audit.errors));
  }
  const mapped=remapPlanToScenario(s,r.worstCaseResult.rows);
  mapped.forEach((row,i)=>assert.equal(row.unloadEndDay,row.unloadDay+s.containers[i].unloadDays-1));
});
test('no complete conservative plan is returned for a mathematically infeasible buffer',async()=>{
  const s=makeDemoScenario(42,1);s.truckCapacity=2;
  const r=await solveConservativePlan(s,{timeLimitSeconds:1});
  assert.equal(r.worstCaseResult.status,'infeasible');assert.equal(r.nominalResult,null);
  assert.equal(r.worstCaseResult.totalCost,null);
});
