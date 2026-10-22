import test from 'node:test';
import assert from 'node:assert/strict';
import {auditSchedule,rowFor,summarize} from '../src/engine.js';
import {auditFrozenEvents,runRollingScenario} from '../src/rolling-plan.js';
import {ADAPTIVE_V9_DEFAULTS,createAdaptivePlannerV9} from '../src/adaptive-planner-v9.js';
import {ADAPTIVE_V8_DEFAULTS} from '../src/adaptive-planner-v8.js';

test('V9 retains every prespecified V8 guard and daily-budget default without tuning',()=>{
  assert.deepEqual(ADAPTIVE_V9_DEFAULTS,ADAPTIVE_V8_DEFAULTS);
});

const tiny=(extra={})=>({id:'v9-handwritten',horizonStart:'2026-10-13',horizonDays:6,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,
  containers:[{id:'A',sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:4,dataOrigin:'synthetic'}],...extra});
const pair=(extra={})=>tiny({horizonDays:4,containers:[
  {...tiny().containers[0],id:'A',dischargeDateTime:'2026-10-10T07:00:00+09:00',dueDay:3},
  {...tiny().containers[0],id:'B',dischargeDateTime:'2026-10-06T07:00:00+09:00',dueDay:3},
],...extra});
const candidate=(s,trips=[[2,2,4]])=>summarize(s,'fixture',s.containers.map((c,i)=>rowFor(s,c,...trips[i])),0,'feasible');
const dateRows=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const initial=(s,trips)=>dateRows(candidate(s,trips).rows);
const noMILP=()=>({status:'time_limit',rows:[],reason:'Fixture has no MILP incumbent.'});
const opts=(minEventDay=0,fixedEvents={})=>({timeBudgetMs:200,minEventDay,fixedEvents,objectiveMode:'joint'});

// Independent tiny oracle: no engine tariff, usage, audit or optimization helper.
// These handwritten fixtures use default tariffs and explicit 07:00 Seoul days.
function oracle(s) {
  const H=s.horizonDays,ordinal=date=>Date.parse(date+'T00:00:00Z')/86400000;
  const storage=(days,size)=>{const excess=Math.max(0,days-4);return excess*(excess<=3?9100:excess<=5?18200:excess<=10?31850:45500)*(size/20);};
  const dd=(days,size)=>{const excess=Math.max(0,days-10),rates=size===20?[15000,30000,50000]:[30000,50000,90000];return Math.min(excess,5)*rates[0]+Math.min(Math.max(excess-5,0),5)*rates[1]+Math.max(excess-10,0)*rates[2];};
  const price=(c,p,r)=>{const age=ordinal(s.horizonStart)-ordinal(c.dischargeDateTime.slice(0,10));return storage(age+p+1,c.sizeFt)+dd(age+r+1,c.sizeFt);};
  const domains=s.containers.map(c=>{
    const out=[];
    for(let p=c.releaseDay;p<H;p++)for(let u=p;u+c.unloadDays-1<=c.dueDay;u++)for(let r=u+c.unloadDays;r<H;r++)out.push([p,u,r]);
    return out;
  });
  let minimum=Infinity,feasibleCount=0;
  function visit(chosen) {
    if(chosen.length<s.containers.length){for(const t of domains[chosen.length])visit([...chosen,t]);return;}
    for(let d=0;d<H;d++) {
      const cap=k=>Array.isArray(s[k])?s[k][d]:s[k];
      let moves=0,unloading=0,staging=0;
      chosen.forEach(([p,u,r],i)=>{moves+=Number(p===d)+Number(r===d);unloading+=Number(u<=d&&d<u+s.containers[i].unloadDays);staging+=Number(p<=d&&d<r);});
      if(moves>cap('truckCapacity')||unloading>cap('warehouseCapacity')||staging>cap('stagingCapacity'))return;
    }
    feasibleCount++;minimum=Math.min(minimum,chosen.reduce((n,[p,u,r],i)=>n+price(s.containers[i],p,r),0));
  }
  visit([]);return {minimum,feasibleCount};
}

test('shared-prefix pair polishing matches an independent complete-domain tiny oracle',async()=>{
  const s=pair(),reference=initial(s,[[0,0,1],[1,1,2]]),expected=oracle(s);
  assert.equal(expected.minimum,81900);assert.ok(expected.feasibleCount>1);
  const result=await createAdaptivePlannerV9({initialDates:reference,now:()=>0,solver:noMILP})(s,opts());
  assert.equal(result.status,'feasible');assert.equal(result.totalCost,expected.minimum);
  assert.equal(result.plannerMetadata.action,'polish');assert.equal(result.plannerMetadata.initialDatesAccepted,true);
  assert.equal(result.plannerMetadata.constructorCalls,0);assert.equal(result.plannerMetadata.solverCalls,0);
  assert.equal(result.plannerMetadata.dateChanges.changedEventCount,6);
  assert.equal(result.plannerMetadata.currentSnapshotFeeNonincrease,true);
  assert.equal(result.plannerMetadata.stages.polish.metadata.seedAccepted,true);
  assert.ok(result.plannerMetadata.feeOpportunity.relaxedLowerBoundKRW<=result.incrementalCost);
  assert.equal(auditSchedule(s,result.rows).valid,true);
});

test('zero-fee opportunity retains without construction, MILP or optional polishing',async()=>{
  const s=pair({tariff:{pncMultiplier:0,ddMultiplier:0}}),reference=initial(s,[[0,0,1],[1,1,2]]);
  const forbidden=()=>{throw new Error('No expensive stage should run.');};
  const result=await createAdaptivePlannerV9({initialDates:reference,now:()=>0,seedConstructor:forbidden,solver:forbidden,polish:forbidden})(s,opts());
  assert.equal(result.totalCost,0);assert.equal(result.plannerMetadata.action,'retain');
  assert.equal(result.plannerMetadata.decisionReason,'no_fee_opportunity');
  assert.equal(result.plannerMetadata.polishCalls,0);assert.equal(result.plannerMetadata.reusedPlans,1);
  assert.deepEqual(dateRows(result.rows),reference);
});

test('declared fee tolerance and date-change cap each reject a genuine cheaper candidate',async()=>{
  const s=pair(),reference=initial(s,[[0,0,1],[1,1,2]]);
  for(const [configuration,reason]of [[{feeToleranceRatio:.2},'small_savings_prefer_stability'],[{maxChangedEvents:5},'date_change_limit']]) {
    const result=await createAdaptivePlannerV9({initialDates:reference,now:()=>0,...configuration})(s,opts());
    assert.equal(result.plannerMetadata.action,'retain');assert.equal(result.plannerMetadata.decisionReason,reason);
    assert.ok(result.plannerMetadata.selection.currentFeeSavingsKRW>0);
    assert.equal(result.plannerMetadata.dateChanges.changedEventCount,0);
    assert.deepEqual(dateRows(result.rows),reference);
  }
});

test('forecast-pressure guard exposes a cost/stability tradeoff rather than a probability guarantee',async()=>{
  const s=tiny(),reference=initial(s,[[3,3,4]]),build=pressureGuard=>createAdaptivePlannerV9({initialDates:reference,now:()=>0,pressureGuard});
  const guarded=await build(true)(s,opts()),unguarded=await build(false)(s,opts());
  assert.equal(guarded.plannerMetadata.decisionReason,'pressure_guard');
  assert.equal(guarded.plannerMetadata.action,'retain');assert.equal(unguarded.plannerMetadata.action,'polish');
  assert.ok(unguarded.incrementalCost<guarded.incrementalCost);
  assert.match(guarded.plannerMetadata.pressureProxy.before.interpretation,/not a failure probability/);
  assert.ok(guarded.plannerMetadata.pressureProxy.after.resources.truck.peakUtilization>guarded.plannerMetadata.pressureProxy.before.resources.truck.peakUtilization);
});

test('zero future capacities are counted without NaN or infinite pressure ratios',async()=>{
  const s=tiny({truckCapacity:[2,2,0,0,2,2]}),reference=initial(s,[[0,0,1]]);
  const result=await createAdaptivePlannerV9({initialDates:reference,now:()=>0})(s,opts());
  const pressure=result.plannerMetadata.pressureProxy.before.resources.truck;
  assert.equal(pressure.zeroCapacityDays,1);assert.ok(Number.isFinite(pressure.peakUtilization));
  assert.equal(result.plannerMetadata.action,'retain');
});

test('ongoing unloading and executed dates remain fixed while only the pending return is polished',async()=>{
  const s=tiny({containers:[{...tiny().containers[0],unloadDays:3}]}),reference=initial(s,[[0,0,5]]),fixed={A:{pickupDay:0,unloadDay:0}};
  const result=await createAdaptivePlannerV9({initialDates:reference,now:()=>0,pressureGuard:false})(s,opts(2,fixed));
  assert.equal(result.plannerMetadata.action,'polish');
  assert.equal(result.rows[0].pickupDay,0);assert.equal(result.rows[0].unloadDay,0);assert.equal(result.rows[0].returnDay,3);
  assert.equal(result.usage[2].warehouse,1);assert.equal(result.usage[2].staging,1);
  assert.equal(result.plannerMetadata.dateChanges.pendingEventCount,1);
  assert.equal(result.plannerMetadata.dateChanges.changedEventCount,1);
  assert.equal(auditFrozenEvents(result.rows,fixed,2).valid,true);
});

test('newly invalid cached return triggers a distinct locked rebuild without rewriting physical history',async()=>{
  const s=tiny(),reference=initial(s,[[0,0,3]]),seen=[];
  const planner=createAdaptivePlannerV9({initialDates:reference,now:()=>0,maxChangedEvents:0,maxPasses:0,solver:noMILP,
    seedConstructor:(snapshot,o)=>{seen.push({s:structuredClone(snapshot),fixed:structuredClone(o.fixedEvents)});return candidate(snapshot,[[0,0,4]]);}});
  const first=await planner(s,opts());assert.equal(first.plannerMetadata.action,'retain');
  const observed={...s,truckCapacity:[2,2,2,0,2,2]},fixed={A:{pickupDay:0,unloadDay:0}};
  const result=await planner(observed,opts(3,fixed));
  assert.equal(result.plannerMetadata.action,'rebuild');assert.equal(result.plannerMetadata.cacheValid,false);
  assert.equal(result.plannerMetadata.currentSnapshotFeeNonincrease,null);
  assert.equal(result.plannerMetadata.dateChanges.changedEventCount,1);
  assert.equal(result.rows[0].returnDay,4);assert.equal(result.plannerMetadata.replannedDueToInvalid,1);
  assert.deepEqual(seen[0].fixed,fixed);assert.equal(auditFrozenEvents(result.rows,fixed,3).valid,true);
});

test('late optional polishing cannot replace the incumbent already audited before the deadline',async()=>{
  let clock=0;
  const s=pair(),reference=initial(s,[[0,0,1],[1,1,2]]);
  const planner=createAdaptivePlannerV9({initialDates:reference,now:()=>clock,polish:snapshot=>{clock=250;return candidate(snapshot,[[1,1,2],[0,0,1]]);}});
  const result=await planner(s,{...opts(),timeBudgetMs:100});
  assert.equal(result.plannerMetadata.action,'retain');assert.equal(result.plannerMetadata.stages.polishAudit.lateCandidateDiscarded,true);
  assert.equal(result.plannerMetadata.incumbentAcceptedAtMs,0);assert.equal(result.plannerMetadata.incumbentAcceptedBeforeDeadline,true);
  assert.equal(result.plannerMetadata.deadlineOverrunMs,150);assert.deepEqual(dateRows(result.rows),reference);
});

test('input copying and the first current-snapshot audit must fit the whole-call budget',async()=>{
  let clock=0,calls=0;
  const s=pair(),options=opts();Object.defineProperty(options,'copiedField',{enumerable:true,get:()=>{clock=210;return true;}});
  const result=await createAdaptivePlannerV9({initialDates:initial(s,[[0,0,1],[1,1,2]]),now:()=>clock,seedConstructor:()=>{calls++;return noMILP();}})(s,options);
  assert.equal(result.status,'no_feasible_schedule_found');assert.equal(result.totalCost,null);assert.deepEqual(result.rows,[]);
  assert.equal(result.plannerMetadata.incumbentAcceptedBeforeDeadline,false);assert.equal(calls,0);
});

test('malicious optional polish is repriced and audited against the pristine snapshot and locks',async()=>{
  const s=tiny({containers:[{...tiny().containers[0],unloadDays:3}]}),reference=initial(s,[[0,0,5]]),fixed={A:{pickupDay:0,unloadDay:0}},options=opts(2,fixed),before=structuredClone(options);
  const planner=createAdaptivePlannerV9({initialDates:reference,now:()=>0,pressureGuard:false,polish:(snapshot,seed,o)=>{
    delete o.fixedEvents.A;snapshot.warehouseCapacity=99;
    const invalid=candidate(snapshot,[[2,2,5]]);invalid.incrementalCost=-1;invalid.rows.forEach(row=>{row.totalCost=-1;});return invalid;
  }});
  const result=await planner(s,options);
  assert.equal(result.plannerMetadata.action,'retain');assert.equal(result.plannerMetadata.stages.polishAudit.valid,false);
  assert.deepEqual(dateRows(result.rows),reference);assert.deepEqual(options,before);assert.equal(s.warehouseCapacity,1);
});

test('invalid initialization and solver claims never become V9 optimality or infeasibility certificates',async()=>{
  const s=tiny({truckCapacity:[2,0,2,2,2,2]}),options=opts(1,{A:{pickupDay:0}}),before=structuredClone(options);
  const planner=createAdaptivePlannerV9({now:()=>0,seedConstructor:(snapshot,o)=>{snapshot.truckCapacity[1]=99;delete o.fixedEvents.A;return candidate(snapshot,[[1,1,2]]);},
    solver:()=>({status:'infeasible',rows:[],optimality:'proven_infeasible'})});
  const result=await planner(s,options);
  assert.equal(result.plannerMetadata.strategyAction,'initialize');assert.equal(result.plannerMetadata.action,'failed');
  assert.equal(result.status,'no_feasible_schedule_found');assert.equal(result.optimality,'not_proven');
  assert.equal(result.totalCost,null);assert.deepEqual(result.rows,[]);assert.deepEqual(options,before);
});

test('cached dates are repriced and isolated from mutable factory inputs, prior outputs and new tariffs',async()=>{
  const s=pair(),reference=initial(s,[[0,0,1],[1,1,2]]),expected=structuredClone(reference);
  const planner=createAdaptivePlannerV9({initialDates:reference,now:()=>0,maxChangedEvents:0});
  reference[0].pickupDay=99;
  const first=await planner(s,opts());assert.deepEqual(dateRows(first.rows),expected);first.rows[0].returnDay=99;
  const second=await planner({...s,tariff:{pncMultiplier:0,ddMultiplier:0}},opts());
  assert.deepEqual(dateRows(second.rows),expected);assert.equal(second.totalCost,0);
  second.plannerMetadata.parameters.maxChangedEvents=99;
  assert.equal((await planner(s,opts())).plannerMetadata.parameters.maxChangedEvents,0);
});

test('different episodes and backwards decision days cannot reuse a stale factory cache',async()=>{
  let constructions=0;
  const s=tiny(),planner=createAdaptivePlannerV9({now:()=>0,maxPasses:0,maxChangedEvents:0,solver:noMILP,
    seedConstructor:snapshot=>{constructions++;return candidate(snapshot,[[1,1,2]]);}});
  const first=await planner(s,opts());assert.equal(first.plannerMetadata.action,'initialize');
  assert.equal(first.plannerMetadata.dateChanges.referenceAvailable,false);assert.equal(first.plannerMetadata.dateChanges.changedEventCount,null);
  const next={...s,id:'another-episode'};
  const second=await planner(next,opts());assert.equal(second.plannerMetadata.action,'initialize');assert.equal(constructions,2);
  await planner(next,opts(1));assert.equal(constructions,2);
  const rewound=await planner(next,opts(0));assert.equal(rewound.plannerMetadata.action,'initialize');assert.equal(constructions,3);
  assert.equal(rewound.plannerMetadata.cacheStatus,'backwards_day_reset');
});

test('a malformed supplied seed has no invented zero date-change reference after successful initialization',async()=>{
  const s=tiny(),planner=createAdaptivePlannerV9({initialDates:[null],now:()=>0,maxPasses:0,seedConstructor:snapshot=>candidate(snapshot,[[0,0,1]]),solver:noMILP});
  const result=await planner(s,opts());
  assert.equal(result.status,'feasible');assert.equal(result.plannerMetadata.initialDatesAccepted,false);
  assert.equal(result.plannerMetadata.dateChanges.referenceAvailable,false);assert.equal(result.plannerMetadata.dateChanges.changedEventCount,null);
});

test('unrevealed future shocks leave identical decision prefixes and never reach adaptive callbacks',async()=>{
  const s=tiny(),logsA=[],logsB=[];
  const build=log=>createAdaptivePlannerV9({now:()=>0,maxPasses:0,opportunityThresholdKRW:1e12,solver:noMILP,seedConstructor:(snapshot,o)=>{
    const {now,onCandidate,...data}=o;log.push({scenario:structuredClone(snapshot),options:structuredClone(data)});return candidate(snapshot,[[1,1,4]]);
  }});
  const a=await runRollingScenario(s,[{id:'private-A',resource:'truck',revealDay:3,capacity:0,duration:1}],{planner:build(logsA)});
  const b=await runRollingScenario(s,[{id:'private-B',resource:'warehouse',revealDay:3,capacity:0,duration:2}],{planner:build(logsB)});
  assert.deepEqual(logsA,logsB);assert.deepEqual(a.timeline.slice(0,3),b.timeline.slice(0,3));
  assert.equal(JSON.stringify(logsA).includes('private-'),false);assert.equal(a.complete,true);assert.equal(b.complete,true);
});

test('snapshot/getter modes are read once; budgets have explicit call-before-factory precedence',async()=>{
  let reads=0;
  const s=tiny();Object.defineProperty(s,'objectiveMode',{enumerable:true,get:()=>++reads===1?'joint':'ddOnly'});
  const planner=createAdaptivePlannerV9({now:()=>0,timeLimitSeconds:.1,maxPasses:0,solver:noMILP,seedConstructor:snapshot=>candidate(snapshot,[[0,0,1]])});
  const result=await planner(s,{timeBudgetMs:70,timeLimitSeconds:.02});
  assert.equal(reads,1);assert.equal(result.objectiveMode,'joint');assert.equal(result.plannerMetadata.wholeCallBudgetMs,70);
  const next=await planner({...tiny(),id:'seconds-call'},{timeLimitSeconds:.04});
  assert.equal(next.plannerMetadata.wholeCallBudgetMs,40);
});

test('one factory forbids overlapping calls instead of sharing partially updated episode state',async()=>{
  let enter,release;
  const entered=new Promise(resolve=>{enter=resolve;}),s=tiny();
  const planner=createAdaptivePlannerV9({now:()=>0,maxPasses:0,solver:noMILP,seedConstructor:snapshot=>{enter();return new Promise(resolve=>{release=()=>resolve(candidate(snapshot,[[0,0,1]]));});}});
  const pending=planner(s,opts());await entered;
  await assert.rejects(planner(s,opts()),/sequential calls/);release();
  assert.equal((await pending).status,'feasible');
});

test('illegal settings, sparse resources, malformed locks and non-joint objectives reject early',async()=>{
  assert.ok(Object.isFrozen(ADAPTIVE_V9_DEFAULTS));
  for(const configuration of [{timeBudgetMs:0},{feeToleranceRatio:2},{maxChangedEvents:301},{lookaheadDays:0},{pressureGuard:1},
    {opportunityThresholdKRW:NaN},{auditReserveMs:-1},{solver:3},{polish:3},{objectiveMode:'ddOnly'},{maxPairs:-1}])assert.throws(()=>createAdaptivePlannerV9(configuration));
  const planner=createAdaptivePlannerV9();
  await assert.rejects(planner(tiny({truckCapacity:new Array(6)}),opts()));
  await assert.rejects(planner(tiny(),opts(0,{A:{bogus:0}})));
  await assert.rejects(planner(tiny(),{...opts(),objectiveMode:'storageOnly'}));
  await assert.rejects(planner(tiny(),{...opts(),timeBudgetMs:Infinity}));
});

test('execution history rejects today and future dates, including every lock at day zero',async()=>{
  const s=tiny(),reference=initial(s,[[0,0,1]]);
  const planner=createAdaptivePlannerV9({initialDates:reference,now:()=>0});
  for(const [day,fixed]of [[0,{A:{pickupDay:0}}],[1,{A:{returnDay:1}}],[1,{A:{returnDay:4}}]])
    await assert.rejects(planner(s,opts(day,fixed)),/strictly before minEventDay/);
  assert.equal((await planner(s,opts())).status,'feasible');
});

test('default owned V9 constructor/GLPK integration returns audited initialization without a performance claim',async()=>{
  const s=tiny(),result=await createAdaptivePlannerV9()(s,opts());
  assert.equal(result.status,'feasible');assert.equal(result.plannerMetadata.action,'initialize');
  assert.equal(result.plannerMetadata.policyOptimalityClaim,false);assert.equal(auditSchedule(s,result.rows).valid,true);
  assert.equal(result.plannerMetadata.incumbentAcceptedBeforeDeadline,true);
});

