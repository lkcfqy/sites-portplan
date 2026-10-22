import test from 'node:test';
import assert from 'node:assert/strict';
import {persistenceForecast,createPersistencePlanner} from '../src/persistence-planner-v6.js';
const scenario=()=>({id:'persistence-fixture',horizonStart:'2026-10-12',horizonDays:5,truckCapacity:[4,2,4,4,4],warehouseCapacity:2,stagingCapacity:3,
  containers:[{id:'A',sizeFt:20,dischargeDateTime:'2026-10-10T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:3}]});
test('persistence changes only the next declared forecast day, leaving history and current capacity intact',()=>{
  const s=scenario(),before=JSON.stringify(s),r=persistenceForecast(s,{minEventDay:1},1);
  assert.deepEqual(r.scenario.truckCapacity,[4,2,2,4,4]);assert.deepEqual(r.changes,[{resource:'truck',day:2,suppliedForecastCapacity:4,assumedCapacity:2}]);assert.equal(JSON.stringify(s),before);
});
test('persistence never increases a supplied future capacity, and zero days disables the assumption',()=>{
  const s=scenario();s.truckCapacity=[4,2,1,4,4];assert.deepEqual(persistenceForecast(s,{minEventDay:1},1).scenario.truckCapacity,s.truckCapacity);
  assert.deepEqual(persistenceForecast(s,{minEventDay:1},0).changes,[]);
});
test('whole-call budget includes forecasting and does not upgrade forecast optimality to the original model',async()=>{
  let input,received;
  const planner=createPersistencePlanner({planner:async(s,o)=>{input=s;received=o;return {status:'optimal',rows:[{id:'A'}],plannerMetadata:{solverCalls:1}};}}),s=scenario();
  const r=await planner(s,{minEventDay:1,timeLimitSeconds:.2,fixedEvents:{A:{pickupDay:0}}});
  assert.deepEqual(input.truckCapacity,[4,2,2,4,4]);assert.ok(received.timeBudgetMs>0&&received.timeBudgetMs<200);assert.deepEqual(received.fixedEvents,{A:{pickupDay:0}});
  assert.equal(r.status,'feasible');assert.equal(r.plannerMetadata.forecastSubproblemStatus,'optimal');assert.equal(r.plannerMetadata.nominalOptimalityClaim,false);assert.equal(r.plannerMetadata.wholeCallBudgetMs,200);
  input.containers[0].id='MUTATED';assert.equal(s.containers[0].id,'A');
});
test('a conservative forecast failure remains a failure, without relaxing capacity or hiding null fees',async()=>{
  const p=createPersistencePlanner({planner:async()=>({status:'infeasible',rows:[],totalCost:null,incrementalCost:null})});const r=await p(scenario(),{minEventDay:1});
  assert.equal(r.status,'no_feasible_schedule_found');assert.equal(r.totalCost,null);assert.equal(r.plannerMetadata.forecastSubproblemStatus,'infeasible');assert.equal(r.plannerMetadata.nominalOptimalityClaim,false);assert.equal(r.plannerMetadata.nominalInfeasibilityClaim,false);assert.match(r.reason,/does not prove/);
});
test('invalid day, persistence range and budgets are rejected',async()=>{
  assert.throws(()=>persistenceForecast(scenario(),{minEventDay:5}),/decision day/);assert.throws(()=>persistenceForecast(scenario(),{},8),/persistenceDays/);
  await assert.rejects(createPersistencePlanner()(scenario(),{timeBudgetMs:0}),/budget/);
});
