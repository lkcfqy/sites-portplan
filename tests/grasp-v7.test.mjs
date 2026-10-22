import test from 'node:test';
import assert from 'node:assert/strict';
import {createGraspPlanner,solveGraspScenario,GRASP_V7_DEFAULTS} from '../src/grasp-planner-v7.js';
import {auditSchedule,rowFor} from '../src/engine.js';
import {auditFrozenEvents,runRollingScenario} from '../src/rolling-plan.js';

const order=(id,extra={})=>({id,sizeFt:20,dischargeDateTime:'2026-09-20T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:3,dataOrigin:'synthetic',...extra});
const scenario=(containers=[order('A')],extra={})=>({id:'v7-handcrafted',seed:1545,horizonStart:'2026-10-12',horizonDays:5,truckCapacity:2,warehouseCapacity:1,stagingCapacity:2,containers,...extra});
const fixedClock=()=>0;
const dates=result=>result.rows.map(r=>[r.id,r.pickupDay,r.unloadDay,r.returnDay]);

// Small independent daily constraint/fee enumerator. No GRASP candidate,
// production resource audit or production fee helper is used in the oracle.
function oracle(s,options={}){
  const H=s.horizonDays,lag=s.operations?.returnLagDays??1,min=options.minEventDay??0,fixed=options.fixedEvents??{},cap=(key,d)=>Array.isArray(s[key])?s[key][d]:s[key],domains=[];
  const fee=(c,p,r)=>{
    const local=new Date(Date.parse(c.dischargeDateTime)+9*3600000),discharge=Math.floor(local.valueOf()/86400000),horizon=Date.parse(s.horizonStart+'T00:00:00Z')/86400000,storageStart=discharge+(local.getUTCHours()>=8?1:0);
    const pnc=day=>{const count=Math.max(0,day-storageStart+1-4),rate=count<=3?9100:count<=5?18200:count<=10?31850:45500;return count*rate*c.sizeFt/20;};
    const dd=day=>{const count=Math.max(0,day-discharge+1-10),rates=c.sizeFt===20?[15000,30000,50000]:[30000,50000,90000];return Math.min(count,5)*rates[0]+Math.min(Math.max(0,count-5),5)*rates[1]+Math.max(0,count-10)*rates[2];};
    return pnc(horizon+p)+dd(horizon+r)-pnc(horizon-1)-dd(horizon-1);
  };
  for(const c of s.containers){const trips=[];for(let p=0;p<H;p++)for(let u=p;u<H;u++)for(let r=u+c.unloadDays-1+lag;r<H;r++){
    if(p<c.releaseDay||u+c.unloadDays-1>c.dueDay)continue;const days={pickupDay:p,unloadDay:u,returnDay:r},locks=fixed[c.id]??{};if(Object.entries(days).some(([key,value])=>Object.hasOwn(locks,key)?value!==locks[key]:value<min))continue;trips.push({c,p,u,r,cost:fee(c,p,r)});
  }domains.push(trips);}
  let best=Infinity;
  function visit(i,selected){if(i<domains.length){for(const trip of domains[i])visit(i+1,[...selected,trip]);return;}for(let d=0;d<H;d++){
    const truck=selected.reduce((n,t)=>n+Number(t.p===d)+Number(t.r===d),0),warehouse=selected.filter(t=>t.u<=d&&d<t.u+t.c.unloadDays).length,staging=selected.reduce((n,t)=>n+(t.p<=d&&d<t.r?(s.operations?.stagingUnit==='teu'?t.c.sizeFt/20:1):0),0);
    if(truck>cap('truckCapacity',d)||warehouse>cap('warehouseCapacity',d)||staging>cap('stagingCapacity',d))return;
  }best=Math.min(best,selected.reduce((n,t)=>n+t.cost,0));}
  visit(0,[]);return best;
}
function valid(s,r,o={}){assert.equal(r.status,'feasible');assert.equal(r.rows.length,s.containers.length);assert.equal(auditSchedule(s,r.rows).valid,true);assert.equal(auditFrozenEvents(r.rows,o.fixedEvents??{},o.minEventDay??0).valid,true);assert.equal(r.plannerMetadata.globalOptimalityClaim,false);assert.equal(r.plannerMetadata.localOptimalityClaim,false);}

test('source-adapted parameters are explicit; seed, value-RCL and bounded search repeat on a small fixture',async()=>{
  assert.equal(GRASP_V7_DEFAULTS.alpha,.25);assert.equal(GRASP_V7_DEFAULTS.timeBudgetMs,200);assert.equal(GRASP_V7_DEFAULTS.maxRestarts,127);assert.throws(()=>createGraspPlanner({maxRestarts:129}),/maxRestarts/);
  const s=scenario(),o={now:fixedClock,maxRestarts:2};const a=await solveGraspScenario(s,o),b=await solveGraspScenario(s,o);valid(s,a);assert.deepEqual(dates(a),dates(b));assert.equal(a.totalCost,b.totalCost);assert.equal(a.plannerMetadata.searchStats.attemptCount,3);assert.ok(a.plannerMetadata.searchStats.rclSelections>0);assert.equal(a.plannerMetadata.solverCalls,0);
});

test('a pair exchange escapes a resource-blocked single-move trap and matches an independent tiny oracle',async()=>{
  const s=scenario([order('A',{dueDay:2}),order('B',{dueDay:2,dischargeDateTime:'2026-10-12T07:00:00+09:00'})],{horizonDays:4,truckCapacity:[1,1,1,1],warehouseCapacity:[1,0,1,0],stagingCapacity:1});
  // Seed 1545 selects the expensive A at D2 and free B at D0. Neither
  // container can move earlier alone. A joint exchange releases the bottleneck.
  const o={now:fixedClock,alpha:1,resourceImpactWeight:0,maxRestarts:0,maxLocalPasses:3,pairCandidateLimit:12,maxPairChecks:256};
  const without=await solveGraspScenario(s,{...o,maxLocalPasses:0}),withSearch=await solveGraspScenario(s,o);valid(s,without);valid(s,withSearch);assert.ok(withSearch.plannerMetadata.searchStats.pairImprovements>0);assert.ok(withSearch.incrementalCost<without.incrementalCost);assert.equal(withSearch.incrementalCost,oracle(s));
});

test('exact past locks and an ongoing unload remain occupied; a capacity conflict returns no partial fees',async()=>{
  const s=scenario([order('A',{unloadDays:3,dueDay:3})]),options={minEventDay:2,fixedEvents:{A:{pickupDay:0,unloadDay:0}}};
  const r=await solveGraspScenario(s,{...options,now:fixedClock,maxRestarts:0});valid(s,r,options);assert.equal(r.rows[0].pickupDay,0);assert.equal(r.rows[0].unloadDay,0);assert.ok(r.rows[0].returnDay>=3);assert.equal(r.incrementalCost,oracle(s,options));
  const conflict=structuredClone(s);conflict.warehouseCapacity=[1,1,0,1,1];const bad=await solveGraspScenario(conflict,{...options,now:fixedClock});assert.equal(bad.status,'no_feasible_schedule_found');assert.deepEqual(bad.rows,[]);assert.equal(bad.totalCost,null);assert.equal(bad.objectiveCost,null);assert.equal(bad.optimality,'not_proven');
});

test('same-day pickup and return consume two movements; TEU staging is not silently reduced',async()=>{
  const s=scenario([order('A',{sizeFt:40,dueDay:0})],{horizonDays:3,truckCapacity:2,stagingCapacity:0,operations:{returnLagDays:0,stagingUnit:'teu'}});
  const r=await solveGraspScenario(s,{now:fixedClock,maxRestarts:0});valid(s,r);assert.equal(r.rows[0].pickupDay,0);assert.equal(r.rows[0].returnDay,0);assert.equal(r.usage[0].truck,2);assert.equal(r.incrementalCost,oracle(s));
  const singleMove={...s,truckCapacity:1};const failed=await solveGraspScenario(singleMove,{now:fixedClock});assert.equal(failed.totalCost,null);assert.equal(failed.status,'no_feasible_schedule_found');
  const retainedBox=scenario([order('A',{sizeFt:40})],{stagingCapacity:1,operations:{returnLagDays:1,stagingUnit:'teu'}});assert.equal((await solveGraspScenario(retainedBox,{now:fixedClock})).totalCost,null);
});

test('valid cached dates are repriced and isolated from mutated inputs and earlier results',async()=>{
  const s=scenario(),planner=createGraspPlanner({now:fixedClock,maxRestarts:0,alpha:0,resourceImpactWeight:0});const initial=await planner(s);valid(s,initial);const originalDates=dates(initial);
  initial.rows[0].pickupDay=999;initial.rows[0].totalCost=-1;
  const next=structuredClone(s);next.tariff={pncMultiplier:2,ddMultiplier:3};const repriced=await planner(next);valid(next,repriced);assert.deepEqual(dates(repriced),originalDates);assert.equal(repriced.plannerMetadata.candidateSource,'retained_plan');assert.equal(repriced.plannerMetadata.reusedPlans,1);assert.equal(repriced.plannerMetadata.constructorCalls,1);
  const row=repriced.rows[0],expected=rowFor(next,next.containers[0],row.pickupDay,row.unloadDay,row.returnDay);assert.equal(row.totalCost,expected.totalCost);assert.notEqual(repriced.totalCost,initial.totalCost);next.containers[0].id='mutated';assert.equal((await planner(s)).rows[0].id,'A');
  const cachedFallback=await planner(s,{retainFeasible:false,auditReserveMs:200});valid(s,cachedFallback);assert.equal(cachedFallback.plannerMetadata.candidateSource,'cached_incumbent');assert.equal(cachedFallback.plannerMetadata.searchStats.attemptCount,0);assert.equal(cachedFallback.optimality,'retained_plan_not_reoptimized');
});

test('collective construction failure is not an infeasibility certificate; tiny whole-call budget cannot accept late work',async()=>{
  const s=scenario([order('A',{dueDay:0}),order('B',{dueDay:0})]);const failed=await solveGraspScenario(s,{now:fixedClock,maxRestarts:2});assert.equal(failed.status,'no_feasible_schedule_found');assert.deepEqual(failed.rows,[]);assert.equal(failed.incrementalCost,null);assert.equal(failed.optimality,'not_proven');
  let tick=0;const expired=await solveGraspScenario(scenario(),{now:()=>++tick,timeBudgetMs:1,auditReserveMs:0});assert.deepEqual(expired.rows,[]);assert.equal(expired.totalCost,null);assert.equal(expired.plannerMetadata.searchStats.auditedCandidates,0);
});

test('factory and call budget selectors have explicit precedence and never add separate phase budgets',async()=>{
  const s=scenario(),factorySeconds=createGraspPlanner({now:fixedClock,timeLimitSeconds:.001,maxRestarts:0});
  const tiny=await factorySeconds(s);assert.equal(tiny.plannerMetadata.timeBudgetMs,1);assert.equal(tiny.totalCost,null);
  const callMs=await factorySeconds(s,{timeBudgetMs:200});valid(s,callMs);assert.equal(callMs.plannerMetadata.timeBudgetMs,200);
  const factoryMs=createGraspPlanner({now:fixedClock,timeBudgetMs:200,timeLimitSeconds:.001,maxRestarts:0});assert.equal((await factoryMs(s)).plannerMetadata.timeBudgetMs,200);assert.equal((await factoryMs(s,{timeLimitSeconds:.001})).plannerMetadata.timeBudgetMs,1);
  assert.throws(()=>createGraspPlanner({timeLimitSeconds:-1}),/timeBudgetMs/);
});

test('illegal locks, backwards episodes and sparse capacity arrays cannot produce false retained feasibility',async()=>{
  await assert.rejects(()=>solveGraspScenario(scenario(),{fixedEvents:{missing:{pickupDay:0}}}),/lock/);await assert.rejects(()=>solveGraspScenario(scenario(),{fixedEvents:{A:{pickupDay:Infinity}}}),/fixed event/);
  const sparse=scenario();sparse.truckCapacity=Array(5);await assert.rejects(()=>solveGraspScenario(sparse),/capacity|nonnegative/i);
  const planner=createGraspPlanner({now:fixedClock,maxRestarts:0}),s=scenario();await planner(s,{minEventDay:1});const back=await planner(s,{minEventDay:0});assert.notEqual(back.plannerMetadata.candidateSource,'retained_plan');assert.equal(back.plannerMetadata.replannedDueToInvalid,1);
});

test('two private future durations with the same observations have identical GRASP prefixes',async()=>{
  const s=scenario([order('A',{unloadDays:3,dueDay:3})]),factory=()=>createGraspPlanner({now:fixedClock,maxRestarts:0,alpha:0,resourceImpactWeight:0}),short=[{resource:'truck',revealDay:2,duration:1,capacity:0}],long=[{resource:'truck',revealDay:2,duration:2,capacity:0}];
  const a=await runRollingScenario(s,short,{planner:factory(),timeLimitSeconds:.2}),b=await runRollingScenario(s,long,{planner:factory(),timeLimitSeconds:.2});
  const prefix=r=>r.timeline.filter(e=>e.day<=2).map(e=>({day:e.day,observationHash:e.observationHash,decisions:e.decisions,executedEvents:e.executedEvents}));assert.deepEqual(prefix(a),prefix(b));assert.equal(prefix(a).length,3);
});
