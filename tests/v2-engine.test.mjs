import test from 'node:test';
import assert from 'node:assert/strict';
import {pncStorageCost,maerskDDCost,containerCost,solveScenario,solveOptimized,makeDemoScenario,validateScenario,auditSchedule,rowFor,summarize,selectRecommendedPolicy} from '../src/engine.js';
import {solveStrongSearch} from '../src/strong-baseline.js';

const tiny=(containers=[{}],extra={})=>({id:'v2-oracle',horizonStart:'2026-10-12',horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:2,containers:containers.map((c,i)=>({id:`T${i}`,sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:2,dataOrigin:'synthetic',...c})),...extra});

function independentOracle(s,mode='joint') {
  const tariff={pncFreeDays:4,ddFreeDays:10,pncMultiplier:1,ddMultiplier:1,pncMode:'retroactive',ddMode:'progressive',...s.tariff};
  const operations={returnLagDays:1,stagingUnit:'container',...s.operations};
  const fee=(c,p,r)=>{
    const base=Date.parse(s.horizonStart+'T00:00:00Z')/86400000;
    const local=new Date(Date.parse(c.dischargeDateTime)+9*3600000);
    const discharged=Date.parse(local.toISOString().slice(0,10)+'T00:00:00Z')/86400000;
    const storageDays=Math.max(0,base+p-discharged+(local.getUTCHours()<8?1:0)-tariff.pncFreeDays);
    const ddDays=Math.max(0,base+r-discharged+1-tariff.ddFreeDays);
    const pncRate=d=>d<=3?9100:d<=5?18200:d<=10?31850:45500;
    const ddRate=d=>c.sizeFt===20?(d<=5?15000:d<=10?30000:50000):(d<=5?30000:d<=10?50000:90000);
    let storage=0,dd=0;
    for(let day=1;day<=storageDays;day++)storage+=pncRate(tariff.pncMode==='retroactive'?storageDays:day);
    for(let day=1;day<=ddDays;day++)dd+=ddRate(tariff.ddMode==='retroactive'?ddDays:day);
    storage*=c.sizeFt/20*tariff.pncMultiplier;dd*=tariff.ddMultiplier;
    return {primary:mode==='storageOnly'?storage:mode==='ddOnly'?dd:storage+dd,total:storage+dd};
  };
  const choices=s.containers.map(c=>{
    const a=[];
    for(let p=c.releaseDay;p<s.horizonDays;p++)for(let u=p;u+c.unloadDays-1<=c.dueDay;u++)for(let r=u+c.unloadDays-1+operations.returnLagDays;r<s.horizonDays;r++)a.push([p,u,r]);
    return a;
  });
  let best={primary:Infinity,total:Infinity};
  const cap=(v,d)=>Array.isArray(v)?v[d]:v;
  function visit(i,rows) {
    if(i<s.containers.length){for(const choice of choices[i])visit(i+1,[...rows,choice]);return;}
    for(let d=0;d<s.horizonDays;d++){
      let truck=0,warehouse=0,staging=0;
      rows.forEach(([p,u,r],k)=>{truck+=(p===d)+(r===d);warehouse+=u<=d&&d<u+s.containers[k].unloadDays;staging+=(p<=d&&d<r)?(operations.stagingUnit==='teu'?s.containers[k].sizeFt/20:1):0;});
      if(truck>cap(s.truckCapacity,d)||warehouse>cap(s.warehouseCapacity,d)||staging>cap(s.stagingCapacity,d))return;
    }
    const cost=rows.reduce((sum,[p,u,r],k)=>{const f=fee(s.containers[k],p,r);return{primary:sum.primary+f.primary,total:sum.total+f.total};},{primary:0,total:0});
    if(cost.primary<best.primary-1e-7||Math.abs(cost.primary-best.primary)<1e-7&&cost.total<best.total)best=cost;
  }
  visit(0,[]);return best;
}

test('tariff sensitivity modes, shifted free time and multipliers use explicit arithmetic',()=>{
  assert.equal(pncStorageCost(15,20,{pncMode:'progressive'}),268450);
  assert.equal(pncStorageCost(8,40,{pncFreeDays:6,pncMultiplier:1.5}),54600);
  assert.equal(maerskDDCost(16,20,{ddMode:'retroactive'}),180000);
  assert.equal(maerskDDCost(14,40,{ddFreeDays:12,ddMultiplier:.5}),30000);
  const c=tiny().containers[0],cost=containerCost(c,0,2,'2026-10-12',{pncMultiplier:.5,ddMultiplier:2});
  assert.equal(cost.totalCost,cost.incrementalCost+cost.sunkCost);
  assert.equal(cost.storageCost,pncStorageCost(cost.storageDays,20)*.5);
});
test('same-day return uses two truck movements and zero overnight staging, consistent in every policy',async()=>{
  const s=tiny([{sizeFt:40,dueDay:0}],{horizonDays:2,stagingCapacity:0,operations:{returnLagDays:0,stagingUnit:'teu'}});
  const r=await solveScenario(s,{strongSearch:{restartCount:2,iterations:4}});
  for(const p of Object.values(r.policies)){assert.equal(p.rows.length,1);assert.equal(p.rows[0].returnDay,0);assert.equal(p.usage[0].truck,2);assert.equal(p.usage[0].staging,0);assert.equal(p.usage[0].warehouse,1);}
  assert.equal((await solveOptimized({...s,truckCapacity:1})).status,'infeasible');
  assert.equal((await solveOptimized({...s,operations:{returnLagDays:1}})).status,'infeasible');
});
test('generalized MILP and lexicographic ablations match independent exhaustive oracle',async()=>{
  const cases=[
    tiny([{}, {sizeFt:40}],{tariff:{pncMode:'progressive',ddMode:'retroactive',pncFreeDays:6,ddFreeDays:12}}),
    tiny([{unloadDays:2},{sizeFt:40,releaseDay:1}],{operations:{returnLagDays:0,stagingUnit:'teu'},stagingCapacity:2}),
    tiny([{sizeFt:40}],{stagingCapacity:1,operations:{stagingUnit:'teu'}}),
    tiny([{},{}],{tariff:{pncMultiplier:0,ddMultiplier:1.5},truckCapacity:[2,1,1,2]}),
  ];
  for(const s of cases)for(const mode of ['joint','storageOnly','ddOnly']){
    const expected=independentOracle(s,mode),actual=await solveOptimized(s,{objectiveMode:mode,timeLimitSeconds:2});
    if(expected.total===Infinity){assert.equal(actual.status,'infeasible');continue;}
    assert.equal(actual.status,'optimal');assert.ok(Math.abs(actual.totalCost-expected.total)<1e-5,`${mode}: ${actual.totalCost} != ${expected.total}`);
    assert.equal(auditSchedule(s,actual.rows).valid,true);
    if(mode!=='joint')assert.equal(actual.tieBreakStatus,'optimal');
  }
});
test('strong search is seed deterministic, complete and at least as good as supplied feasible baselines',async()=>{
  const s=makeDemoScenario(42,12),r=await solveScenario(s,{timeLimitSeconds:2});
  const a=r.policies.strongSearch,b=solveStrongSearch(s,{seed:42,restartCount:12,iterations:80});
  assert.deepEqual(a.rows,b.rows);assert.equal(a.incrementalCost,b.incrementalCost);
  assert.equal(a.searchMetadata.evaluations,92);assert.equal(a.searchMetadata.relocateAttempts,40);assert.equal(a.searchMetadata.swapAttempts,40);
  for(const key of ['fifo','earliestFreeEnd','marginalCost','earliestDeadline'])if(r.policies[key].rows.length)assert.ok(a.incrementalCost<=r.policies[key].incrementalCost);
  assert.ok(a.incrementalCost<r.policies.marginalCost.incrementalCost);
  assert.ok(r.policies.optimized.incrementalCost<=a.incrementalCost);
});
test('invalid sensitivity inputs are rejected and hypothesis warnings are explicit',()=>{
  const s=tiny();
  for(const tariff of [{pncFreeDays:-1},{ddFreeDays:1.5},{pncMultiplier:Infinity},{ddMultiplier:-1},{pncMode:'unknown'},null])assert.equal(validateScenario({...s,tariff}).valid,false);
  for(const operations of [{returnLagDays:2},{stagingUnit:'tonnes'},null])assert.equal(validateScenario({...s,operations}).valid,false);
  const v=validateScenario({...s,tariff:{ddFreeDays:21}});assert.equal(v.valid,true);assert.ok(v.warnings.some(w=>w.includes('shifts ALL slab boundaries')));
});
test('recommendation preserves feasible fallback after optimizer timeout and respects objective/tie priorities',()=>{
  const s=tiny(),c=s.containers[0];
  const earlyPickup=summarize(s,'fifo',[rowFor(s,c,0,0,3)],0);
  const earlyReturn=summarize(s,'strongSearch',[rowFor(s,c,1,1,2)],0);
  const timeout={status:'time_limit',rows:[],totalCost:null,incrementalCost:null};
  const policies={fifo:earlyPickup,strongSearch:earlyReturn,optimized:timeout};
  const rec=selectRecommendedPolicy(s,policies,{objectiveMode:'ddOnly'});
  assert.equal(rec.recommendedPolicy,'strongSearch');assert.equal(rec.fallbackUsed,true);assert.match(rec.selectionReason,/no complete feasible/);
  assert.equal(selectRecommendedPolicy(s,policies,{objectiveMode:'storageOnly'}).recommendedPolicy,'fifo');
  const tied={...policies,optimized:{...earlyReturn,policy:'optimized',status:'feasible'}};
  assert.equal(selectRecommendedPolicy(s,tied,{objectiveMode:'ddOnly'}).recommendedPolicy,'optimized');
  assert.equal(selectRecommendedPolicy(s,{optimized:timeout}).recommendedPolicy,null);
  assert.equal(policies.optimized.status,'time_limit');assert.equal(policies.optimized.totalCost,null);
});
