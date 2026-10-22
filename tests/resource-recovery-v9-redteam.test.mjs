import test from 'node:test';
import assert from 'node:assert/strict';
import {solveResourceRecovery,auditResourceRecovery} from '../src/resource-recovery-v9.js';

const tiny=(extra={})=>({id:'handwritten-resource-redteam-v9',horizonStart:'2026-10-12',horizonDays:3,
  truckCapacity:[1,1,0],warehouseCapacity:[1,0,0],stagingCapacity:[1,0,0],
  containers:[{id:'A',sizeFt:20,dischargeDateTime:'2026-10-10T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:0,dataOrigin:'synthetic'}],...extra});
const pack=(id,resource,days,units=1,priceKRW=0,extra={})=>({id,resource,days,units,priceKRW,authorized:true,earliestAvailableDay:0,...extra});
const opts=(actions=[],extra={})=>({actions,timeBudgetMs:3000,...extra});

test('the final acceptance clock cannot certify an optimum after output selection crosses the budget',async()=>{
  const s=tiny();await solveResourceRecovery(s,opts()); // Keep native initialization out of the boundary fixture.
  const descriptor=Object.getOwnPropertyDescriptor(performance,'now');let calls=0;
  try {
    // First eight checks complete on time; assembling the terminal output takes
    // the ninth clock reading past the deadline. This is not a speed benchmark.
    Object.defineProperty(performance,'now',{configurable:true,value:()=>++calls>=9?1001:0});
    const result=await solveResourceRecovery(s,opts([],{timeBudgetMs:1000}));
    assert.equal(result.status,'time_limit');assert.deepEqual(result.rows,[]);
    assert.equal(result.procurementCostKRW,null);assert.equal(result.totalCost,null);
    assert.equal(result.proof.minimumObjectiveProven,false);assert.equal(result.proof.minimumProcurementProven,false);
  }finally{if(descriptor)Object.defineProperty(performance,'now',descriptor);else delete performance.now;}
});

for(const [label,boundary,scenario] of [
  ['empty-domain',5,()=>tiny({containers:[{...tiny().containers[0],unloadDays:2,dueDay:0}]})],
  ['native-infeasible',7,()=>tiny({warehouseCapacity:0})],
])test(`the ${label} proof cannot escape the final whole-call acceptance deadline`,async()=>{
  await solveResourceRecovery(tiny(),opts());
  const descriptor=Object.getOwnPropertyDescriptor(performance,'now');let calls=0;
  try{
    Object.defineProperty(performance,'now',{configurable:true,value:()=>++calls>=boundary?1001:0});
    const result=await solveResourceRecovery(scenario(),opts([],{timeBudgetMs:1000}));
    assert.equal(result.status,'time_limit');assert.equal(result.proof.infeasibleWithinMenuProven,false);
    assert.equal(result.procurementCostKRW,null);assert.deepEqual(result.rows,[]);
  }finally{if(descriptor)Object.defineProperty(performance,'now',descriptor);else delete performance.now;}
});

test('prospective packages cannot repair an already violated continuous-unloading resource day',async()=>{
  const s=tiny({horizonDays:5,truckCapacity:[1,0,0,1,0],warehouseCapacity:[1,0,0,0,0],stagingCapacity:[2,2,2,0,0],
    operations:{stagingUnit:'teu'},containers:[{...tiny().containers[0],sizeFt:40,unloadDays:3,dueDay:2}]});
  const actions=[pack('future-only','warehouse',[2],99,1,{earliestAvailableDay:2}),pack('past-and-future','warehouse',[1,2],99,0)];
  const result=await solveResourceRecovery(s,opts(actions,{minEventDay:2,fixedEvents:{A:{pickupDay:0,unloadDay:0}}}));
  assert.equal(result.status,'infeasible');assert.equal(result.proof.infeasibleWithinMenuProven,true);
  assert.equal(result.procurementCostKRW,null);assert.deepEqual(result.selectedActions,[]);
  assert.deepEqual(result.excludedActions.map(action=>action.id),['past-and-future']);
});

test('an indivisible package records every disqualifier and is never partially salvaged',async()=>{
  const s=tiny({horizonDays:4,truckCapacity:1,warehouseCapacity:0,stagingCapacity:1,containers:[{...tiny().containers[0],dueDay:2}]});
  const actions=[pack('excluded-bundle','warehouse',[0,1,2],5,0,{authorized:false,earliestAvailableDay:2})];
  const result=await solveResourceRecovery(s,opts(actions,{minEventDay:1}));
  assert.equal(result.status,'infeasible');assert.deepEqual(result.eligibleActions,[]);
  assert.deepEqual(result.excludedActions[0].reasons,['not_authorized','would_change_past_capacity','before_earliest_availability']);
  assert.deepEqual(result.selectedActions,[]);
});

test('safe individual numbers do not bypass aggregate menu or purchased-capacity integer safety',async()=>{
  const s=tiny(),max=Number.MAX_SAFE_INTEGER;
  await assert.rejects(solveResourceRecovery(s,opts([pack('first','truck',[0],1,max),pack('second','warehouse',[0],1,1)])),/sum.*prices.*safe integer/);
  await assert.rejects(solveResourceRecovery(s,opts([pack('overflow','truck',[0],max,0)])),/capacity.*safe integer/);
  await assert.rejects(solveResourceRecovery({...s,truckCapacity:max+1},opts()),/safe integer/);
});

test('a zero-price redundant action can tie either objective, so optimality never proves an irredundant action set',async()=>{
  const s=tiny(),extra=pack('optional-extra-slot','warehouse',[0],1,0);
  for(const objectiveMode of ['procurementOnly','feesPlusProcurement']){
    const o=opts([extra],{objectiveMode}),result=await solveResourceRecovery(s,o);
    assert.equal(result.status,'optimal');assert.equal(result.procurementCostKRW,0);
    const withRedundantAction={...structuredClone(result),selectedActions:[extra]};
    const checked=auditResourceRecovery(s,o,withRedundantAction);
    assert.equal(checked.valid,true);assert.equal(checked.optimalityAudited,false);
    assert.equal(result.proof.minimumProcurementProven,objectiveMode==='procurementOnly');
    assert.equal(result.proof.minimumActionCountProven,undefined);
  }
});

test('separate progressive storage and retroactive detention are repriced before a combined objective proof',async()=>{
  const s=tiny({horizonDays:4,truckCapacity:[1,0,1,0],warehouseCapacity:[1,0,0,0],stagingCapacity:[1,1,0,0],
    tariff:{pncMode:'progressive',ddMode:'retroactive'},
    containers:[{...tiny().containers[0],dischargeDateTime:'2026-09-28T22:00:00Z'}]});
  const o=opts([],{objectiveMode:'feesPlusProcurement'}),result=await solveResourceRecovery(s,o);
  assert.equal(result.status,'optimal');assert.equal(result.rows[0].returnDay,2);
  assert.equal(result.storageCost,222950);assert.equal(result.ddCost,180000);
  assert.equal(result.sunkCost,236100);assert.equal(result.incrementalCost,166850);
  assert.equal(result.objectiveCostKRW,166850);assert.equal(result.combinedTotalCostKRW,402950);
  assert.equal(result.proof.minimumProcurementProven,false);assert.equal(auditResourceRecovery(s,o,result).valid,true);
  const relabeled={...structuredClone(result),objectiveMode:'procurementOnly'};
  assert.match(auditResourceRecovery(s,o,relabeled).errors.join(';'),/objective/);
});
