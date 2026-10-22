import test from 'node:test';
import assert from 'node:assert/strict';
import {auditSchedule,rowFor,summarize} from '../src/engine.js';
import {auditFrozenEvents,runRollingScenario} from '../src/rolling-plan.js';
import {createCostRecoveryPlanner,polishCompletePlan} from '../src/cost-recovery-v7.js';

const tiny=(extra={})=>({id:'v7-handwritten',horizonStart:'2026-10-13',horizonDays:6,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,
  containers:[{id:'A',sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:4,dataOrigin:'synthetic'}],...extra});
const pair=(extra={})=>tiny({horizonDays:4,containers:[
  {...tiny().containers[0],id:'A',dischargeDateTime:'2026-10-10T07:00:00+09:00',dueDay:3},
  {...tiny().containers[0],id:'B',dischargeDateTime:'2026-10-06T07:00:00+09:00',dueDay:3},
],...extra});
const candidate=(s,trips=[[2,2,4]])=>summarize(s,'fixture',s.containers.map((c,i)=>rowFor(s,c,...trips[i])),0,'feasible');
const opts=(minEventDay=0,fixedEvents={})=>({objectiveMode:'joint',minEventDay,fixedEvents,timeBudgetMs:80});
const noMILP=()=>({status:'time_limit',rows:[],reason:'Fixture has no MILP incumbent.'});
const eventDates=rows=>rows.map(r=>({id:r.id,pickupDay:r.pickupDay,unloadDay:r.unloadDay,returnDay:r.returnDay}));

test('two-box cooperation crosses a resource barrier and reduces 91,000 to 81,900 KRW',()=>{
  const s=pair(),seed=candidate(s,[[0,0,1],[1,1,2]]),result=polishCompletePlan(s,seed,opts());
  assert.equal(seed.totalCost,91000);
  assert.equal(result.totalCost,81900);
  assert.equal(result.status,'feasible');
  assert.equal(result.polishMetadata.seedIncrementalCost,63700);
  assert.equal(result.polishMetadata.finalIncrementalCost,54600);
  assert.equal(result.polishMetadata.jointNonincrease,true);
  assert.ok(result.polishMetadata.acceptedMoveHistory.some(move=>move.type.startsWith('pair')));
  assert.deepEqual(eventDates(result.rows),[{id:'A',pickupDay:1,unloadDay:1,returnDay:2},{id:'B',pickupDay:0,unloadDay:0,returnDay:1}]);
  assert.equal(auditSchedule(s,result.rows).valid,true);
});

test('an executed pickup prevents the profitable swap rather than being rewritten',()=>{
  const s=pair(),seed=candidate(s,[[0,0,1],[1,1,2]]),fixed={A:{pickupDay:0}};
  const result=polishCompletePlan(s,seed,opts(0,fixed));
  assert.deepEqual(eventDates(result.rows),eventDates(seed.rows));
  assert.equal(result.incrementalCost,63700);
  assert.equal(auditFrozenEvents(result.rows,fixed,0).valid,true);
});

test('TEU capacity can reject the cheaper exchange while preserving the complete seed',()=>{
  const s=pair({operations:{stagingUnit:'teu'},stagingCapacity:[1,2,2,2],containers:[pair().containers[0],{...pair().containers[1],sizeFt:40}]}),seed=candidate(s,[[0,0,1],[1,1,2]]);
  const result=polishCompletePlan(s,seed,opts());
  assert.equal(auditSchedule(s,seed.rows).valid,true);
  assert.deepEqual(eventDates(result.rows),eventDates(seed.rows));
  assert.equal(result.incrementalCost,seed.incrementalCost);
  assert.ok(result.polishMetadata.capacityRejected>0);
});

test('single-date improvement and repeated passes keep strict whole-plan fee monotonicity',()=>{
  const s=tiny(),seed=candidate(s),result=polishCompletePlan(s,seed,opts());
  assert.ok(result.incrementalCost<seed.incrementalCost);
  assert.ok(result.polishMetadata.acceptedMoves>0);
  for(const move of result.polishMetadata.acceptedMoveHistory)assert.ok(move.afterIncrementalCost<move.beforeIncrementalCost);
  assert.equal(result.rows[0].pickupDay,0);
  assert.equal(result.rows[0].returnDay,1);
  assert.equal(auditSchedule(s,result.rows).valid,true);
});

test('equal prices do not change dates during polishing',()=>{
  const s=pair({tariff:{pncMultiplier:0,ddMultiplier:0}}),seed=candidate(s,[[0,0,1],[1,1,2]]),result=polishCompletePlan(s,seed,opts());
  assert.deepEqual(eventDates(result.rows),eventDates(seed.rows));
  assert.equal(result.incrementalCost,0);
  assert.equal(result.polishMetadata.acceptedMoves,0);
  assert.equal(result.polishMetadata.strictDecreaseOnly,true);
});

test('before/after date proofs independently reproduce the same-snapshot fee decrease',()=>{
  const s=pair(),result=polishCompletePlan(s,candidate(s,[[0,0,1],[1,1,2]]),opts()),proof=result.polishMetadata;
  const reprice=rows=>rows.reduce((sum,row)=>{const c=s.containers.find(c=>c.id===row.id);return sum+rowFor(s,c,row.pickupDay,row.unloadDay,row.returnDay).incrementalCost;},0);
  assert.equal(proof.attempted,true);
  assert.equal(reprice(proof.beforeDates),proof.seedIncrementalCost);
  assert.equal(reprice(proof.afterDates),proof.finalIncrementalCost);
  assert.equal(proof.seedAudit.valid,true);
  assert.equal(proof.finalAudit.valid,true);
  for(const row of [...proof.beforeDates,...proof.afterDates])assert.deepEqual(Object.keys(row).sort(),['id','pickupDay','returnDay','unloadDay']);
});

test('fake seed fees are ignored and returned dates cannot mutate the seed',()=>{
  const s=pair(),seed=candidate(s,[[0,0,1],[1,1,2]]),seedBefore=structuredClone(seed),scenarioBefore=structuredClone(s);
  seed.totalCost=-1;seed.incrementalCost=-1;seed.rows.forEach(r=>{r.totalCost=-1;r.incrementalCost=-1;});
  const tamperedBefore=structuredClone(seed),result=polishCompletePlan(s,seed,opts());
  assert.equal(result.polishMetadata.seedIncrementalCost,seedBefore.incrementalCost);
  assert.equal(result.incrementalCost,54600);
  result.rows[0].pickupDay=3;
  assert.deepEqual(seed,tamperedBefore);
  assert.deepEqual(s,scenarioBefore);
});

test('started unloading and pending event floors survive return-cost polishing',()=>{
  const s=tiny({containers:[{...tiny().containers[0],unloadDays:3}]}),seed=candidate(s,[[0,0,5]]),fixed={A:{pickupDay:0,unloadDay:0}};
  const result=polishCompletePlan(s,seed,opts(2,fixed));
  assert.equal(result.rows[0].pickupDay,0);
  assert.equal(result.rows[0].unloadDay,0);
  assert.equal(result.rows[0].returnDay,3);
  assert.equal(result.usage[2].warehouse,1);
  assert.equal(result.usage[2].staging,1);
  assert.equal(auditFrozenEvents(result.rows,fixed,2).valid,true);
  const rejected=polishCompletePlan({...s,warehouseCapacity:[1,1,0,1,1,1]},seed,opts(2,fixed));
  assert.equal(rejected.totalCost,null);
  assert.equal(rejected.polishMetadata.seedAccepted,false);
});

test('expired or interrupted polishing preserves the current audited seed, never a partial move',()=>{
  const s=pair(),seed=candidate(s,[[0,0,1],[1,1,2]]);
  const expired=polishCompletePlan(s,seed,{...opts(),now:()=>100,deadlineMs:99});
  assert.deepEqual(eventDates(expired.rows),eventDates(seed.rows));
  assert.equal(expired.polishMetadata.attempted,false);
  assert.deepEqual(expired.polishMetadata.beforeDates,eventDates(seed.rows));
  assert.deepEqual(expired.polishMetadata.afterDates,eventDates(seed.rows));
  const disabled=polishCompletePlan(s,seed,{...opts(),maxPasses:0});
  assert.equal(disabled.polishMetadata.seedAccepted,true);
  assert.equal(disabled.polishMetadata.attempted,false);
  assert.deepEqual(disabled.polishMetadata.beforeDates,eventDates(seed.rows));
  assert.deepEqual(disabled.polishMetadata.afterDates,eventDates(seed.rows));
  assert.equal(disabled.polishMetadata.seedIncrementalCost,seed.incrementalCost);
  assert.equal(disabled.polishMetadata.finalAudit.valid,true);
  let clock=0;
  const interrupted=polishCompletePlan(s,seed,{...opts(),now:()=>++clock,deadlineMs:22});
  assert.ok(interrupted.incrementalCost<=seed.incrementalCost);
  assert.equal(auditSchedule(s,interrupted.rows).valid,true);
  assert.equal(interrupted.polishMetadata.jointNonincrease,true);
});

test('unsafe, partial or falsely feasible seeds cannot acquire a successful fee total',()=>{
  const s=pair(),good=candidate(s,[[0,0,1],[1,1,2]]);
  for(const seed of [{status:'time_limit',rows:good.rows},{status:'feasible',rows:[]},{status:'feasible',rows:[null,null]},
    {...good,rows:[good.rows[0],good.rows[0]]},{...good,rows:[{...good.rows[0],unloadDay:-Infinity},good.rows[1]]},
    {...good,rows:[{...good.rows[0],returnDay:10**10},good.rows[1]]}]){
    const result=polishCompletePlan(s,seed,opts());
    assert.equal(result.status,'no_feasible_schedule_found');
    assert.equal(result.totalCost,null);
    assert.deepEqual(result.rows,[]);
  }
});

test('factory uses the full original seed deadline and exposes phase proofs in recorded constructor metadata',async()=>{
  let clock=0,received;
  const s=pair(),planner=createCostRecoveryPlanner({now:()=>clock,seedConstructor:(snapshot,o)=>{
    assert.equal(o.deadlineMs,80);clock=30;return candidate(snapshot,[[0,0,1],[1,1,2]]);
  },solver:(snapshot,o,context)=>{received={o:structuredClone(o),deadline:context.deadlineMs};return noMILP();}});
  const result=await planner(s,{...opts(),timeBudgetMs:200});
  assert.equal(received.deadline,200);
  assert.equal(received.o.timeLimitSeconds,0.165);
  assert.equal(result.incrementalCost,54600);
  assert.equal(result.policy,'costPolishV7');
  assert.equal(result.status,'feasible');
  assert.equal(result.plannerMetadata.wholeCallBudgetMs,200);
  assert.equal(result.plannerMetadata.finalVsAuditedSeedNonincrease,true);
  const proof=result.plannerMetadata.polishMetadata;
  assert.deepEqual(result.plannerMetadata.stages.locked_constructor.constructorMetadata.costPolish,proof);
  assert.equal(proof.beforeDates.length,2);
  assert.equal(proof.afterDates.length,2);
});

test('final MILP selection cannot erase the separate seed-to-polish before/after proof',async()=>{
  const planner=createCostRecoveryPlanner({maxPasses:1,seedConstructor:s=>candidate(s),solver:s=>({...candidate(s,[[0,0,1]]),status:'optimal',optimality:'proven_optimal'})});
  const result=await planner(tiny(),{...opts(),timeBudgetMs:200});
  assert.equal(result.status,'feasible');
  assert.equal(result.plannerMetadata.subproblemStatus,'optimal');
  assert.equal(result.plannerMetadata.policyOptimalityClaim,false);
  assert.equal(result.rows[0].returnDay,1);
  assert.equal(result.plannerMetadata.polishMetadata.beforeDates[0].returnDay,4);
  assert.equal(result.plannerMetadata.polishMetadata.afterDates[0].returnDay,2);
  assert.ok(result.incrementalCost<result.plannerMetadata.polishMetadata.finalIncrementalCost);
});

test('valid cached dates are retained without more constructor, polishing, or solver calls',async()=>{
  let calls=0;
  const planner=createCostRecoveryPlanner({seedConstructor:s=>{calls++;return candidate(s);},solver:noMILP});
  const first=await planner(tiny(),{...opts(),timeBudgetMs:200});
  const fixed={A:{pickupDay:first.rows[0].pickupDay,unloadDay:first.rows[0].unloadDay}};
  const retained=await planner(tiny(),{...opts(1,fixed),timeBudgetMs:200});
  assert.equal(calls,1);
  assert.deepEqual(eventDates(retained.rows),eventDates(first.rows));
  assert.equal(retained.optimality,'retained_plan_not_reoptimized');
  assert.equal(retained.plannerMetadata.polishCalls,1);
  assert.equal(retained.plannerMetadata.reusedPlans,1);
  assert.equal(retained.plannerMetadata.polishMetadata,undefined);
});

test('seed callback cannot loosen original capacity or delete execution locks',async()=>{
  const s=tiny({truckCapacity:[0,2,2,2,2,2]}),original=structuredClone(s),o={...opts(1,{A:{pickupDay:2}}),timeBudgetMs:200},before=structuredClone(o);
  const planner=createCostRecoveryPlanner({seedConstructor:(snapshot,locks)=>{
    snapshot.truckCapacity[0]=99;delete locks.fixedEvents.A;return candidate(snapshot,[[0,0,1]]);
  },solver:noMILP});
  const result=await planner(s,o);
  assert.equal(result.totalCost,null);
  assert.equal(result.plannerMetadata.polishMetadata.seedAccepted,false);
  assert.deepEqual(s,original);assert.deepEqual(o,before);
});

test('factory never promotes an unproved infeasibility or current-subproblem optimum',async()=>{
  const planner=createCostRecoveryPlanner({seedConstructor:()=>({status:'infeasible',rows:[]}),solver:()=>({status:'infeasible',rows:[],optimality:'proven_infeasible'})});
  const result=await planner(tiny(),{...opts(),timeBudgetMs:200});
  assert.equal(result.status,'no_feasible_schedule_found');
  assert.equal(result.optimality,'not_proven');
  assert.equal(result.plannerMetadata.subproblemStatus,'infeasible');
  assert.equal(result.totalCost,null);
});

test('unknown future paths never reach V7 and leave its early decisions identical',async()=>{
  function build(log){return createCostRecoveryPlanner({now:()=>0,seedConstructor:(s,o)=>{const {now,...data}=o;log.push({scenario:structuredClone(s),options:structuredClone(data)});return candidate(s,[[1,1,4]]);},solver:noMILP});}
  const logsA=[],logsB=[],a=await runRollingScenario(tiny(),[{id:'future-A',revealDay:3,resource:'truck',capacity:0}],{planner:build(logsA)}),
    b=await runRollingScenario(tiny(),[{id:'future-B',revealDay:3,resource:'warehouse',capacity:0,duration:2}],{planner:build(logsB)});
  assert.deepEqual(logsA,logsB);assert.deepEqual(a.timeline.slice(0,3),b.timeline.slice(0,3));
  assert.equal(JSON.stringify(logsA).includes('future-'),false);
  assert.equal(a.complete,true);assert.equal(b.complete,true);
});

test('options copying is charged before the V6 remaining-budget call',async()=>{
  let clock=0,calls=0;
  const o={...opts(),timeBudgetMs:200};Object.defineProperty(o,'extra',{enumerable:true,get:()=>{clock=210;return 'fixture';}});
  const planner=createCostRecoveryPlanner({now:()=>clock,seedConstructor:()=>{calls++;return noMILP();},solver:noMILP});
  const result=await planner(tiny(),o);
  assert.equal(result.totalCost,null);assert.equal(calls,0);
  assert.equal(result.plannerMetadata.wholeCallBudgetMs,200);
  assert.equal(result.plannerMetadata.wholeCallWallMs,210);
});

test('joint guard and planning use a single snapshot even when input getters change later reads',async()=>{
  for(const target of ['scenario','options']){
    let reads=0,solverMode;
    const s=tiny(),o={...opts(),timeBudgetMs:200};
    Object.defineProperty(target==='scenario'?s:o,'objectiveMode',{enumerable:true,get:()=>++reads===1?'joint':'ddOnly'});
    const planner=createCostRecoveryPlanner({seedConstructor:noMILP,solver:(snapshot,received)=>{
      solverMode=received.objectiveMode;return candidate(snapshot,[[0,0,1]]);
    }});
    const result=await planner(s,o);
    assert.equal(reads,1);
    assert.equal(solverMode,'joint');
    assert.equal(result.objectiveMode,'joint');
    assert.equal(result.status,'feasible');
  }
});

test('joint-only input, invalid parameters, malformed locks and sparse capacities reject early',async()=>{
  assert.throws(()=>polishCompletePlan(tiny(),candidate(tiny()),{...opts(),objectiveMode:'ddOnly'}));
  assert.throws(()=>polishCompletePlan(tiny(),candidate(tiny()),{...opts(),minEventDay:NaN}));
  assert.throws(()=>polishCompletePlan(tiny(),candidate(tiny()),{...opts(),fixedEvents:{A:{other:0}}}));
  assert.throws(()=>polishCompletePlan(tiny({truckCapacity:new Array(6)}),candidate(tiny()),opts()));
  for(const configuration of [{maxPairs:-1},{maxPasses:5},{candidateCap:1},{maxPairChecks:5000},{maxSingleTargets:101}])assert.throws(()=>createCostRecoveryPlanner(configuration));
  await assert.rejects(createCostRecoveryPlanner()(tiny(),{...opts(),objectiveMode:'storageOnly'}));
});

test('default V6/GLPK integration returns a complete audited heuristic without an optimistic label',async()=>{
  const result=await createCostRecoveryPlanner()(tiny(),{...opts(),timeBudgetMs:200});
  assert.equal(result.status,'feasible');
  assert.equal(auditSchedule(tiny(),result.rows).valid,true);
  assert.equal(auditFrozenEvents(result.rows,{},0).valid,true);
  assert.equal(result.plannerMetadata.policyOptimalityClaim,false);
  assert.ok(result.plannerMetadata.wholeCallWallMs>=0);
});
