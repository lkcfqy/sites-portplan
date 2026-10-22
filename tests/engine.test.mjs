import test from 'node:test';
import assert from 'node:assert/strict';
import {pncStorageCost,maerskDDCost,storageStartDate,containerCost,addDays,validateScenario,auditSchedule,makeDemoScenario,solveScenario,solveOptimized} from '../src/engine.js';

test('PNC highest tier reprices every chargeable day at each boundary',()=>{
  const independent=[[0,0],[4,0],[5,9100],[7,27300],[8,72800],[9,91000],[10,191100],[14,318500],[15,500500]];
  for (const [days,krw] of independent) { assert.equal(pncStorageCost(days,20),krw);assert.equal(pncStorageCost(days,40),krw*2); }
  assert.equal(pncStorageCost(15)-pncStorageCost(14),182000);
  assert.throws(()=>pncStorageCost(-1));assert.throws(()=>pncStorageCost(4,45));
});
test('Maersk progressive interpretation handles each slab boundary',()=>{
  for (const [d,a,b] of [[10,0,0],[11,15000,30000],[15,75000,150000],[16,105000,200000],[20,225000,400000],[21,275000,490000]]) {
    assert.equal(maerskDDCost(d,20),a);assert.equal(maerskDDCost(d,40),b);
  }
});
test('Seoul 08:00 storage cutoff and calendar-inclusive D&D',()=>{
  assert.equal(storageStartDate('2026-10-01T07:59:59+09:00'),'2026-10-01');
  assert.equal(storageStartDate('2026-10-01T08:00:00+09:00'),'2026-10-02');
  assert.equal(storageStartDate('2026-09-30T23:00:00Z'),'2026-10-02');
  const c={sizeFt:20,dischargeDateTime:'2026-10-01T08:00:00+09:00'};
  const cost=containerCost(c,0,2,'2026-10-05');
  assert.equal(cost.storageDays,4);assert.equal(cost.ddDays,7);assert.equal(cost.totalCost,0);
  assert.equal(addDays('2028-02-28',1),'2028-02-29');
});

const tiny=(containers,extra={})=>({id:'oracle',horizonStart:'2026-10-12',horizonDays:5,truckCapacity:2,warehouseCapacity:1,stagingCapacity:2,containers:containers.map((c,i)=>({id:`O${i}`,sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:3,dataOrigin:'synthetic',...c})),...extra});
/** Independent exhaustive enumeration: no engine feasibility or costing helper. */
function exhaustive(s) {
  const H=s.horizonDays,choices=s.containers.map(c=>{
    const rows=[];
    for(let p=c.releaseDay;p<H;p++) for(let u=p;u<H;u++) for(let r=u+c.unloadDays;r<H;r++) if(u+c.unloadDays-1<=c.dueDay) rows.push([p,u,r]);
    return rows;
  });
  let best=Infinity;
  const cap=(v,d)=>Array.isArray(v)?v[d]:v;
  const independentCost=(c,[p,u,r])=>{
    const horizon=Date.parse(s.horizonStart+'T00:00:00Z')/86400000;
    const local=new Date(Date.parse(c.dischargeDateTime)+9*3600000);
    const discharge=Date.parse(local.toISOString().slice(0,10)+'T00:00:00Z')/86400000;
    const age=horizon+p-discharge+(local.getUTCHours()<8?1:0);
    const excess=Math.max(0,age-4);
    const rate=age<=4?0:age<8?9100:age<10?18200:age<15?31850:45500;
    let total=excess*rate*c.sizeFt/20;
    const dd=horizon+r-discharge+1;
    for(let day=11;day<=dd;day++) total+=c.sizeFt===20?(day<=15?15000:day<=20?30000:50000):(day<=15?30000:day<=20?50000:90000);
    return total;
  };
  function search(i,combo) {
    if(i===s.containers.length) {
      for(let day=0;day<H;day++) {
        let truck=0,warehouse=0,staging=0;
        combo.forEach(([p,u,r],k)=>{truck+=(p===day)+(r===day);warehouse+=u<=day&&day<u+s.containers[k].unloadDays;staging+=p<=day&&day<r;});
        if(truck>cap(s.truckCapacity,day)||warehouse>cap(s.warehouseCapacity,day)||staging>cap(s.stagingCapacity,day))return;
      }
      best=Math.min(best,combo.reduce((sum,row,k)=>sum+independentCost(s.containers[k],row),0));return;
    }
    for(const choice of choices[i]) search(i+1,[...combo,choice]);
  }
  search(0,[]);return best;
}
test('MILP matches independent exhaustive oracle with releases, sizes, staging and multi-day unloads',async()=>{
  const cases=[
    tiny([{}, {sizeFt:40,dischargeDateTime:'2026-10-05T10:00:00+09:00'}]),
    tiny([{unloadDays:2},{releaseDay:1,dueDay:3}]),
    tiny([{},{sizeFt:40},{releaseDay:1}],{horizonDays:6,truckCapacity:[2,1,2,1,2,2],warehouseCapacity:1,stagingCapacity:1}),
    tiny([{},{sizeFt:40}],{truckCapacity:1}),
  ];
  for(const s of cases) {
    const expected=exhaustive(s), result=await solveOptimized(s,{timeLimitSeconds:10});
    if(expected===Infinity) assert.equal(result.status,'infeasible');
    else { assert.equal(result.status,'optimal');assert.equal(result.totalCost,expected);assert.equal(auditSchedule(s,result.rows).valid,true);assert.equal(result.totalCost,result.sunkCost+result.incrementalCost); }
  }
});
test('capacity infeasibility and impossible deadline are not reported as feasible',async()=>{
  for(const s of [tiny([{},{}],{truckCapacity:0}),tiny([{releaseDay:2,unloadDays:2,dueDay:2}])]) {
    const r=await solveScenario(s,{timeLimitSeconds:5});assert.equal(r.policies.optimized.status,'infeasible');assert.equal(r.policies.optimized.totalCost,null);
    for(const key of ['fifo','earliestFreeEnd','marginalCost']) assert.equal(r.policies[key].status,'no_feasible_schedule_found');
  }
});
test('synthetic seed reproducibility, validation and feasible-policy audit',async()=>{
  assert.deepEqual(makeDemoScenario(42),makeDemoScenario(42));
  const s=makeDemoScenario(42,8);assert.equal(validateScenario(s).valid,true);
  const invalid={...s,containers:[{...s.containers[0],releaseDay:-1}]};assert.equal(validateScenario(invalid).valid,false);
  const r=await solveScenario(s,{timeLimitSeconds:10});
  assert.equal(r.policies.optimized.status,'optimal');
  for(const policy of Object.values(r.policies)) if(policy.rows.length) {assert.equal(auditSchedule(s,policy.rows).valid,true);assert.ok(r.policies.optimized.incrementalCost<=policy.incrementalCost);}
});
test('malformed uploads return validation errors, including normalized-overflow dates',()=>{
  const s=makeDemoScenario(42,1);
  for(const containers of [{},'invalid',null,[null],[7]]) assert.equal(validateScenario({...s,containers}).valid,false);
  for(const date of ['2026-02-30T07:00:00+09:00','2026-10-01T24:00:00+09:00','2026-10-01T07:60:00+09:00','2026-10-01T07:00:00','2026-10-01T07:00:00+14:30']) {
    assert.equal(validateScenario({...s,containers:[{...s.containers[0],dischargeDateTime:date}]}).valid,false,date);
  }
  assert.equal(validateScenario({...s,horizonStart:'2026-02-30'}).valid,false);
});
