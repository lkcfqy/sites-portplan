import test from 'node:test';
import assert from 'node:assert/strict';
import {auditResourceRecovery,solveResourceRecovery} from '../src/resource-recovery-v9.js';

const tiny=(extra={})=>({id:'handwritten-resource-recovery-v9',horizonStart:'2026-10-12',horizonDays:3,
  truckCapacity:[1,1,0],warehouseCapacity:[1,0,0],stagingCapacity:[1,0,0],
  containers:[{id:'A',sizeFt:20,dischargeDateTime:'2026-10-10T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:0,dataOrigin:'synthetic'}],...extra});
const pack=(id,resource,days,units,priceKRW,extra={})=>({id,resource,days,units,priceKRW,authorized:true,earliestAvailableDay:0,...extra});
const options=(actions=[],extra={})=>({actions,timeBudgetMs:3000,...extra});

// Separate complete-domain oracle, with no imported engine/model helpers.
// This checks only procurement minimization for small hand-written fixtures.
function oracle(s,actions,day=0,locks={}) {
  const eligible=actions.filter(a=>a.authorized&&a.days.every(d=>d>=day&&d>=a.earliestAvailableDay));
  const H=s.horizonDays, lag=s.operations?.returnLagDays??1;
  let minimum=Infinity, feasibleSubsets=0;
  for (let mask=0;mask<2**eligible.length;mask++) {
    const selected=eligible.filter((_,index)=>mask&(1<<index));
    const capacities=Object.fromEntries(['truck','warehouse','staging'].map(k=>[k,Array.from({length:H},(_,d)=>(Array.isArray(s[`${k}Capacity`])?s[`${k}Capacity`][d]:s[`${k}Capacity`])+selected.filter(a=>a.resource===k&&a.days.includes(d)).reduce((n,a)=>n+a.units,0))]));
    const usage={truck:Array(H).fill(0),warehouse:Array(H).fill(0),staging:Array(H).fill(0)};
    function visit(index) {
      if(index===s.containers.length)return true;
      const c=s.containers[index],fixed=locks[c.id]??{};
      for(let p=c.releaseDay;p<H;p++)for(let u=p;u+c.unloadDays-1<=c.dueDay;u++)for(let r=u+c.unloadDays-1+lag;r<H;r++) {
        const dates={pickupDay:p,unloadDay:u,returnDay:r};
        if(Object.entries(dates).some(([k,v])=>Object.hasOwn(fixed,k)?v!==fixed[k]:v<day))continue;
        const use={truck:Array(H).fill(0),warehouse:Array(H).fill(0),staging:Array(H).fill(0)};
        use.truck[p]++;use.truck[r]++;
        for(let d=u;d<u+c.unloadDays;d++)use.warehouse[d]++;
        for(let d=p;d<r;d++)use.staging[d]+=s.operations?.stagingUnit==='teu'?c.sizeFt/20:1;
        if(Object.keys(use).some(k=>use[k].some((v,d)=>v+usage[k][d]>capacities[k][d])))continue;
        for(const k of Object.keys(use))for(let d=0;d<H;d++)usage[k][d]+=use[k][d];
        if(visit(index+1))return true;
        for(const k of Object.keys(use))for(let d=0;d<H;d++)usage[k][d]-=use[k][d];
      }
      return false;
    }
    if(visit(0)){feasibleSubsets++;minimum=Math.min(minimum,selected.reduce((n,a)=>n+a.priceKRW,0));}
  }
  return {minimum,feasibleSubsets};
}

test('no purchase needed: empty explicit menu has a zero procurement minimum, not zero forecast fees',async()=>{
  const s=tiny(),o=options(),before=structuredClone(s),result=await solveResourceRecovery(s,o);
  assert.equal(result.status,'optimal');assert.equal(result.procurementCostKRW,0);assert.deepEqual(result.selectedActions,[]);
  assert.equal(result.proof.minimumProcurementProven,true);assert.equal(result.audit.valid,true);
  assert.equal(result.counterfactual,true);assert.equal(result.purchaseExecuted,false);assert.deepEqual(s,before);
  const older=await solveResourceRecovery(tiny({containers:[{...s.containers[0],dischargeDateTime:'2026-09-29T07:00:00+09:00'}]}),o);
  assert.equal(older.procurementCostKRW,0);assert.equal(older.storageCost,318500);assert.equal(older.ddCost,75000);
  assert.equal(older.incrementalCost,61850);assert.equal(older.combinedTotalCostKRW,393500);
});

test('complete-domain tiny oracle agrees with minimum indivisible multi-resource packages',async()=>{
  const s=tiny({truckCapacity:0,warehouseCapacity:0,stagingCapacity:0});
  const actions=[pack('truck-whole','truck',[0,1],1,5),pack('truck-first','truck',[0],1,2),pack('truck-second','truck',[1],1,4),pack('warehouse','warehouse',[0],1,3),pack('staging','staging',[0],1,2)];
  const expected=oracle(s,actions),result=await solveResourceRecovery(s,options(actions));
  assert.equal(expected.minimum,10);assert.ok(expected.feasibleSubsets>1);assert.equal(result.status,'optimal');
  assert.equal(result.procurementCostKRW,expected.minimum);assert.deepEqual(new Set(result.selectedActions.map(a=>a.id)),new Set(['truck-whole','warehouse','staging']));
  assert.equal(result.audit.valid,true);assert.equal(result.proof.minimumProcurementProven,true);
});

test('shared-capacity multi-container package selection agrees with complete enumeration',async()=>{
  const s=tiny({horizonDays:4,truckCapacity:[1,1,1,1],warehouseCapacity:1,stagingCapacity:2,containers:[{...tiny().containers[0],id:'A',dueDay:1},{...tiny().containers[0],id:'B',sizeFt:40,dueDay:1}],operations:{stagingUnit:'teu'}});
  const actions=[pack('both-early-moves','truck',[0,1],1,7),pack('extra-early-truck','truck',[0],1,3),pack('warehouse-overlap','warehouse',[0,1],1,4),pack('teu-overlap','staging',[0,1,2],1,2)];
  const expected=oracle(s,actions),result=await solveResourceRecovery(s,options(actions));
  assert.equal(expected.minimum,2);assert.equal(result.procurementCostKRW,expected.minimum);
  assert.equal(result.status,'optimal');assert.equal(result.rows.length,2);assert.equal(result.audit.valid,true);
});

test('zero-priced package can be required, while unavailable and unauthorized packages are explicitly excluded',async()=>{
  const s=tiny({stagingCapacity:0}),actions=[pack('free','staging',[0],1,0),pack('no-authority','staging',[0],99,0,{authorized:false}),pack('too-late','staging',[0],99,0,{earliestAvailableDay:1})];
  const result=await solveResourceRecovery(s,options(actions));
  assert.equal(result.status,'optimal');assert.equal(result.procurementCostKRW,0);assert.equal(result.selectedActions[0].id,'free');
  assert.deepEqual(result.excludedActions.map(a=>[a.id,a.reasons]),[['no-authority',['not_authorized']],['too-late',['before_earliest_availability']]]);
  const noMenu=await solveResourceRecovery(s,options(actions.slice(1)));
  assert.equal(noMenu.status,'infeasible');assert.equal(noMenu.proof.infeasibleWithinMenuProven,true);
  for(const field of ['totalCost','procurementCostKRW','combinedIncrementalCostKRW'])assert.equal(noMenu[field],null);
});

test('ongoing continuous unloading is rescued prospectively without editing physical past',async()=>{
  const s=tiny({horizonDays:5,truckCapacity:[1,0,0,1,0],warehouseCapacity:[1,1,0,0,0],stagingCapacity:[2,2,2,0,0],operations:{stagingUnit:'teu'},containers:[{...tiny().containers[0],sizeFt:40,unloadDays:3,dueDay:2}]});
  const actions=[pack('third-unload-day','warehouse',[2],1,70,{earliestAvailableDay:2}),pack('retroactive','warehouse',[1,2],1,1)];
  const o=options(actions,{minEventDay:2,fixedEvents:{A:{pickupDay:0,unloadDay:0}}}),result=await solveResourceRecovery(s,o);
  assert.equal(result.status,'optimal');assert.equal(result.procurementCostKRW,oracle(s,actions,2,o.fixedEvents).minimum);
  assert.equal(result.procurementCostKRW,70);assert.equal(result.rows[0].pickupDay,0);assert.equal(result.rows[0].unloadDay,0);assert.equal(result.rows[0].returnDay,3);
  assert.equal(result.usage[2].warehouse,1);assert.equal(result.usage[2].staging,2);assert.equal(result.usage[1].warehouseCapacity,1);
  assert.deepEqual(result.excludedActions[0].reasons,['would_change_past_capacity']);
});

test('TEU staging counts 40-foot units and same-day return still consumes two truck moves',async()=>{
  const c={...tiny().containers[0],sizeFt:40},s=tiny({containers:[c],operations:{stagingUnit:'teu'}});
  const result=await solveResourceRecovery(s,options([pack('extra-teu','staging',[0],1,9)]));
  assert.equal(result.procurementCostKRW,9);assert.equal(result.usage[0].staging,2);assert.equal(result.usage[0].stagingCapacity,2);
  const sameDay=tiny({truckCapacity:[1,0,0],stagingCapacity:0,containers:[c],operations:{returnLagDays:0,stagingUnit:'teu'}});
  const rescued=await solveResourceRecovery(sameDay,options([pack('second-movement','truck',[0],1,4)]));
  assert.equal(rescued.status,'optimal');assert.equal(rescued.procurementCostKRW,4);assert.equal(rescued.rows[0].returnDay,0);
  assert.equal(rescued.usage[0].truck,2);assert.equal(rescued.usage[0].staging,0);
});

test('optional total objective is declared separately from procurement-only minimum',async()=>{
  const s=tiny({horizonDays:4,truckCapacity:[0,1,1,0],warehouseCapacity:1,stagingCapacity:1,containers:[{...tiny().containers[0],dueDay:2,dischargeDateTime:'2026-10-06T07:00:00+09:00'}]});
  const actions=[pack('earlier-pickup','truck',[0],1,1000)];
  const procurement=await solveResourceRecovery(s,options(actions));
  const combined=await solveResourceRecovery(s,options(actions,{objectiveMode:'feesPlusProcurement'}));
  assert.equal(procurement.procurementCostKRW,0);assert.equal(combined.procurementCostKRW,1000);
  assert.ok(combined.combinedIncrementalCostKRW<procurement.combinedIncrementalCostKRW);
  assert.equal(combined.objectiveCostKRW,combined.combinedIncrementalCostKRW);assert.equal(combined.proof.minimumObjectiveProven,true);
  assert.equal(combined.proof.minimumProcurementProven,false);assert.equal(combined.objectiveMode,'feesPlusProcurement');
});

test('a fractional fee objective does not upgrade numerical solver optimum to a strict minimum',async()=>{
  const s=tiny({tariff:{pncMultiplier:0.1234567},containers:[{...tiny().containers[0],dischargeDateTime:'2026-09-29T07:00:00+09:00'}]});
  const result=await solveResourceRecovery(s,options([],{objectiveMode:'feesPlusProcurement'}));
  assert.equal(result.status,'feasible');assert.equal(result.audit.valid,true);assert.equal(result.objectiveSafeInteger,false);
  assert.equal(result.proof.minimumObjectiveProven,false);assert.equal(result.optimality,'solver_optimal_with_numeric_tolerance');
});

test('deadline without an incumbent stays unknown and amounts stay null',async()=>{
  const result=await solveResourceRecovery(tiny(),options([],{timeBudgetMs:0.000001}));
  assert.equal(result.status,'time_limit');assert.equal(result.procurementCostKRW,null);assert.equal(result.totalCost,null);
  assert.equal(result.proof.minimumProcurementProven,false);assert.equal(result.proof.infeasibleWithinMenuProven,false);assert.deepEqual(result.rows,[]);
});

test('independent audit rejects changed menu facts, missing purchases, retrospective dates and balanced fee tampering',async()=>{
  const s=tiny({stagingCapacity:0}),o=options([pack('staging','staging',[0],1,20)]),valid=await solveResourceRecovery(s,o);
  assert.equal(auditResourceRecovery(s,o,valid).valid,true);
  const changed=structuredClone(valid);changed.selectedActions[0].priceKRW=0;
  assert.equal(auditResourceRecovery(s,o,changed).valid,false);
  const removed=structuredClone(valid);removed.selectedActions=[];removed.procurementCostKRW=0;
  assert.match(auditResourceRecovery(s,o,removed).errors.join(';'),/staging capacity/);
  const fees=structuredClone(valid);fees.rows[0].storageCost+=1;fees.rows[0].ddCost-=1;
  assert.match(auditResourceRecovery(s,o,fees).errors.join(';'),/independent repricing/);
  const objective=structuredClone(valid);objective.objectiveCostKRW=0;
  assert.match(auditResourceRecovery(s,o,objective).errors.join(';'),/objectiveCostKRW/);
  const executionClaim=structuredClone(valid);executionClaim.purchaseExecuted=true;
  assert.match(auditResourceRecovery(s,o,executionClaim).errors.join(';'),/unexecuted/);
  const ongoing=tiny({horizonDays:4,truckCapacity:1,warehouseCapacity:1,stagingCapacity:1,containers:[{...tiny().containers[0],dueDay:2}]});
  const locks=options([],{minEventDay:1,fixedEvents:{A:{pickupDay:0,unloadDay:0}}}),plan=await solveResourceRecovery(ongoing,locks),altered=structuredClone(plan);
  altered.rows[0].pickupDay=1;
  assert.match(auditResourceRecovery(ongoing,locks,altered).errors.join(';'),/history/);
});

test('missing prices, permissions, availability, unsafe menus and future execution locks are rejected',async()=>{
  const s=tiny(),action=pack('A','truck',[0],1,1);
  for(const key of ['priceKRW','authorized','earliestAvailableDay']) {
    const incomplete={...action};delete incomplete[key];
    await assert.rejects(solveResourceRecovery(s,options([incomplete])),new RegExp(key));
  }
  await assert.rejects(solveResourceRecovery(s,options([{...action,units:0}])),/units/);
  await assert.rejects(solveResourceRecovery(s,options([{...action,days:[0,0]}])),/days/);
  await assert.rejects(solveResourceRecovery(s,options([action,{...action}])),/unique/);
  await assert.rejects(solveResourceRecovery(s,options([{...action,priceKRW:0.5}])),/priceKRW/);
  await assert.rejects(solveResourceRecovery(s,options([],{minEventDay:1,fixedEvents:{A:{pickupDay:1}}})),/strictly before/);
  await assert.rejects(solveResourceRecovery(s,{timeBudgetMs:1000}),/explicit array/);
});
