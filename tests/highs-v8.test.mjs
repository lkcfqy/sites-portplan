import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {auditSchedule, rowFor} from '../src/engine.js';
import {auditFrozenEvents, runRollingScenario} from '../src/rolling-plan.js';
import {createHiGHSPlanner} from '../scripts/highs-planner-v8.mjs';

const tiny=(extra={})=>({id:'v8-native-handwritten',horizonStart:'2026-10-13',horizonDays:6,
  truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,
  containers:[{id:'A',sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:4,dataOrigin:'synthetic'}],...extra});
const opts=(minEventDay=0,fixedEvents={})=>({minEventDay,fixedEvents,objectiveMode:'joint',timeBudgetMs:2000});
async function using(configuration,callback) {
  const planner=createHiGHSPlanner(configuration);
  try {await planner.ready();return await callback(planner);}
  finally {await planner.close();}
}

// Independent exhaustive date tuples and direct resource counting. This oracle
// has no cumulative event inequalities and is small enough to prove its minimum.
function oracle(s,options={}) {
  const H=s.horizonDays,minimum=options.minEventDay??0,fixed=options.fixedEvents??{},lag=s.operations?.returnLagDays??1;
  const capacity=(value,day)=>Array.isArray(value)?value[day]:value;
  const domains=s.containers.map(c=>{
    const domain=[];
    for (let p=c.releaseDay;p<H;p++) for (let u=p;u+c.unloadDays-1<=c.dueDay && u<H;u++) for (let r=u+c.unloadDays-1+lag;r<H;r++) {
      const dates={pickupDay:p,unloadDay:u,returnDay:r};
      if (Object.entries(dates).some(([field,day])=>Object.hasOwn(fixed[c.id]??{},field)?fixed[c.id][field]!==day:day<minimum)) continue;
      domain.push(rowFor(s,c,p,u,r));
    }
    return domain;
  });
  let best=null;
  function visit(index,rows,cost) {
    if (index===domains.length) {if (best===null || cost<best) best=cost;return;}
    for (const row of domains[index]) {
      const combined=[...rows,row];let feasible=true;
      for (let day=0;day<H;day++) {
        const moves=combined.reduce((sum,r)=>sum+Number(r.pickupDay===day)+Number(r.returnDay===day),0);
        const unloading=combined.filter(r=>r.unloadDay<=day && day<=r.unloadEndDay).length;
        const staged=combined.reduce((sum,r)=>sum+(r.pickupDay<=day && day<r.returnDay?(s.operations?.stagingUnit==='teu'?r.sizeFt/20:1):0),0);
        if (moves>capacity(s.truckCapacity,day) || unloading>capacity(s.warehouseCapacity,day) || staged>capacity(s.stagingCapacity,day)) {feasible=false;break;}
      }
      if (feasible) visit(index+1,combined,cost+row.incrementalCost);
    }
  }
  visit(0,[],0);return best;
}

function verify(s,o,result) {
  assert.equal(auditSchedule(s,result.rows).valid,true);
  assert.equal(auditFrozenEvents(result.rows,o.fixedEvents??{},o.minEventDay??0).valid,true);
  assert.equal(result.plannerMetadata.stages.native.independentCostsMatch,true);
  assert.equal(result.plannerMetadata.nativeCertificate.incumbentAudit.valid,true);
  assert.equal(result.plannerMetadata.nativeCertificate.solverThreads,1);
  assert.equal(result.plannerMetadata.nativeCertificate.numericalAssurance.roundsFees,false);
}

test('native event MILP matches exhaustive tiny tuple optimum including mixed containers and closures',async()=>{
  await using({},async planner=>{
    const base=tiny().containers[0];
    const cases=[
      [tiny(),opts()],
      [tiny(),opts(2)],
      [tiny(),opts(2,{A:{pickupDay:0}})],
      [tiny({truckCapacity:[2,0,2,2,2,2]}),opts()],
      [tiny({warehouseCapacity:0}),opts()],
      [tiny({stagingCapacity:0,operations:{returnLagDays:0}}),opts()],
      [tiny({stagingCapacity:0,truckCapacity:1,operations:{returnLagDays:0}}),opts()],
      [tiny({containers:[{...base,unloadDays:3}]}),opts(2,{A:{pickupDay:0,unloadDay:0}})],
      [tiny({horizonDays:5,truckCapacity:2,warehouseCapacity:1,stagingCapacity:3,operations:{stagingUnit:'teu'},
        containers:[{...base,dueDay:3},{...base,id:'B',sizeFt:40,unloadDays:2,dueDay:3}]}),opts()],
      [tiny({horizonDays:5,truckCapacity:[2,1,0,2,2],warehouseCapacity:[1,1,1,1,0],stagingCapacity:2,
        containers:[{...base,dueDay:3},{...base,id:'B',releaseDay:1,dueDay:3}]}),opts()],
    ];
    for (const [s,o] of cases) {
      const expected=oracle(s,o),result=await planner(s,o);
      if (expected===null) {assert.equal(result.status,'infeasible');assert.equal(result.objectiveCost,null);assert.equal(result.plannerMetadata.nativeCertificate.provenInfeasible,true);}
      else {assert.equal(result.status,'optimal');assert.equal(result.objectiveCost,expected);verify(s,o,result);assert.equal(result.plannerMetadata.nativeCertificate.lowerBound,expected);}
    }
  });
});

test('executed pickups, ongoing unloading tails and completed historical trips stay exact',async()=>{
  await using({},async planner=>{
    const base=tiny().containers[0],s=tiny({truckCapacity:3,warehouseCapacity:2,stagingCapacity:3,operations:{stagingUnit:'teu'},
      containers:[{...base,id:'A',sizeFt:40,unloadDays:3},{...base,id:'B'},{...base,id:'C'}]});
    const o=opts(2,{A:{pickupDay:0,unloadDay:0},C:{pickupDay:0,unloadDay:0,returnDay:1}});
    const result=await planner(s,o);verify(s,o,result);
    const byId=new Map(result.rows.map(r=>[r.id,r]));
    assert.equal(result.usage[1].staging,2);
    assert.equal(result.usage[2].warehouse,2);
    assert.deepEqual(FIELDS.map(field=>byId.get('C')[field]),[0,0,1]);
    assert.ok(byId.get('A').returnDay>=3);
    assert.ok(FIELDS.every(field=>byId.get('B')[field]>=2));
  });
});
const FIELDS=['pickupDay','unloadDay','returnDay'];

test('ongoing unloading cannot disappear when the next observed day has zero slots',async()=>{
  await using({},async planner=>{
    const s=tiny({warehouseCapacity:[1,0,1,1,1,1],containers:[{...tiny().containers[0],unloadDays:3}]});
    const result=await planner(s,opts(1,{A:{pickupDay:0,unloadDay:0}}));
    assert.equal(result.status,'infeasible');assert.equal(result.objectiveCost,null);
    assert.equal(result.plannerMetadata.nativeCertificate.solverStatus,2);
    assert.equal(result.plannerMetadata.nativeCertificate.provenInfeasible,true);
  });
});

test('40-ft uses two TEU and pickup/return on the same day use two movements but zero staging',async()=>{
  await using({},async planner=>{
    const base=tiny().containers[0];
    const insufficient=tiny({stagingCapacity:1,operations:{stagingUnit:'teu'},containers:[{...base,sizeFt:40}]});
    const fail=await planner(insufficient,opts());assert.equal(fail.status,'infeasible');
    const same=tiny({stagingCapacity:0,operations:{stagingUnit:'teu',returnLagDays:0},containers:[{...base,sizeFt:40}]});
    const result=await planner(same,opts());verify(same,opts(),result);
    assert.deepEqual(FIELDS.map(field=>result.rows[0][field]),[0,0,0]);
    assert.equal(result.usage[0].truck,2);assert.equal(result.usage[0].staging,0);
    const failSame=await planner({...same,truckCapacity:1},opts());assert.equal(failSame.status,'infeasible');
  });
});

test('empty legal execution domain is a scoped proof, not a zero-cost plan',async()=>{
  await using({},async planner=>{
    const s=tiny({containers:[{...tiny().containers[0],releaseDay:3,dueDay:2}]});
    const result=await planner(s,opts());assert.equal(result.status,'infeasible');
    assert.equal(result.plannerMetadata.nativeCertificate.proofType,'empty_legal_event_domain');
    for (const key of ['totalCost','incrementalCost','objectiveCost']) assert.equal(result[key],null);
    assert.deepEqual(result.rows,[]);
  });
});

test('ready waits for SciPy once, reuses one process, and close is idempotent',async()=>{
  const planner=createHiGHSPlanner();
  const first=await planner.ready(),second=await planner.ready();
  assert.equal(first.pid,second.pid);assert.equal(first.startupWallMs,second.startupWallMs);
  assert.ok(first.startupWallMs>0);assert.ok(first.serviceInitializationMs>0);assert.ok(first.scipyVersion);
  const a=await planner(tiny(),opts()),b=await planner(tiny(),opts());
  assert.equal(a.plannerMetadata.nativeService.pid,first.pid);assert.equal(b.plannerMetadata.nativeService.pid,first.pid);
  assert.equal(b.plannerMetadata.decisionCalls,2);
  assert.equal(a.plannerMetadata.readyCalledBeforeDecision,true);
  await planner.close();await planner.close();await assert.rejects(planner(tiny(),opts()),/closed/);
});

test('input copying consumes the call budget before startup or IPC',async()=>{
  let clock=0;const s=tiny(),containers=s.containers;
  Object.defineProperty(s,'containers',{enumerable:true,get:()=>{clock=210;return containers;}});
  const planner=createHiGHSPlanner({now:()=>clock,timeBudgetMs:200});
  try {
    const result=await planner(s);
    assert.equal(result.status,'time_limit');assert.equal(result.objectiveCost,null);
    assert.equal(result.plannerMetadata.solverCalls,0);assert.equal(result.plannerMetadata.startupWallMs,null);
    assert.equal(result.plannerMetadata.deadlineOverrunMs,10);
  } finally {await planner.close();}
});

test('expired native budget remains unresolved and never becomes infeasible',async()=>{
  await using({retainCacheFallback:false},async planner=>{
    const result=await planner(tiny(),{...opts(),timeBudgetMs:0.001});
    assert.equal(result.status,'time_limit');assert.equal(result.totalCost,null);assert.deepEqual(result.rows,[]);
    assert.equal(result.plannerMetadata.nativeCertificate?.provenInfeasible??false,false);
  });
});

test('fractional KRW objectives are refused without silently rounding prices',async()=>{
  await using({},async planner=>{
    const result=await planner(tiny({tariff:{pncMultiplier:0.1234567}}),opts());
    assert.equal(result.status,'solver_error');assert.equal(result.totalCost,null);
    assert.match(result.plannerMetadata.nativeCertificate.reason,/integer-KRW/);
  });
});

const fixturePath=fileURLToPath(new URL('./fixtures/highs-v8-service.py',import.meta.url));
const freeTiny=(nativeFixture)=>tiny({containers:[{...tiny().containers[0],dischargeDateTime:'2026-10-13T07:00:00+09:00'}],nativeFixture});
const fixtureReply=(row={id:'A',pickupDay:0,unloadDay:0,returnDay:1})=>({status:'optimal',solverStatus:0,hasIncumbent:true,provenOptimal:true,rows:[row],objectiveCost:0,independentCosts:{storageCost:0,ddCost:0,totalCost:0,sunkCost:0,incrementalCost:0}});

test('a late native incumbent is discarded and wall overrun is exposed',async()=>{
  await using({servicePath:fixturePath,auditReserveMs:0},async planner=>{
    const result=await planner(freeTiny({delayMs:40,reply:fixtureReply()}),{timeBudgetMs:15});
    assert.equal(result.status,'time_limit');assert.equal(result.objectiveCost,null);
    assert.equal(result.plannerMetadata.stages.native.lateCandidateDiscarded,true);
    assert.ok(result.plannerMetadata.deadlineOverrunMs>0);
    assert.equal(result.plannerMetadata.nativeCertificate.provenOptimal,true);
  });
});

test('invalid dates, changed execution locks and forged fee totals cannot become accepted incumbents',async()=>{
  await using({servicePath:fixturePath,retainCacheFallback:false},async planner=>{
    for (const [reply,o] of [
      [fixtureReply({id:'A',pickupDay:0,unloadDay:Infinity,returnDay:1}),{}],
      [fixtureReply({id:'A',pickupDay:1,unloadDay:1,returnDay:2}),{minEventDay:1,fixedEvents:{A:{pickupDay:0}}}],
      [{...fixtureReply(),objectiveCost:-1},{}],
    ]) {
      const result=await planner(freeTiny({reply}),{...o,timeBudgetMs:200});
      assert.equal(result.rows.length,0);assert.equal(result.totalCost,null);assert.equal(result.status,'audit_failed');
    }
  });
});

test('an audited cached incumbent survives a later timeout and is repriced under the current observation',async()=>{
  await using({servicePath:fixturePath,auditReserveMs:0},async planner=>{
    const s=freeTiny({reply:fixtureReply()}),first=await planner(s,{timeBudgetMs:100});
    assert.equal(first.status,'optimal');
    const changed={...s,nativeFixture:{delayMs:40,reply:{status:'time_limit',solverStatus:1,hasIncumbent:false,rows:[]}}};
    const retained=await planner(changed,{timeBudgetMs:15});
    assert.equal(retained.status,'feasible');assert.equal(retained.plannerMetadata.candidateSource,'cached_incumbent');
    assert.equal(retained.optimality,'retained_audited_incumbent_not_reoptimized');
    assert.equal(retained.plannerMetadata.nativeCertificate.status,'time_limit');
  });
});

test('native hung IPC is bounded by disclosed grace and close leaves no pending call',async()=>{
  await using({servicePath:fixturePath,auditReserveMs:0,hardOverrunGraceMs:5},async planner=>{
    const result=await planner(freeTiny({delayMs:500,reply:fixtureReply()}),{timeBudgetMs:15});
    assert.equal(result.status,'time_limit');assert.equal(result.plannerMetadata.hardTimeout,true);
    assert.equal(result.rows.length,0);assert.ok(result.runtimeMs<300);
  });
});

test('one sequential rolling episode respects physical history and never promotes its policy to global optimum',async()=>{
  await using({},async planner=>{
    const s=tiny(),result=await runRollingScenario(s,[],{planner,timeLimitSeconds:0.2});
    assert.equal(result.complete,true);assert.equal(result.status,'feasible');
    assert.equal(result.optimality,'rolling_feasible_not_global_optimum');
    assert.equal(result.finalAudit.valid,true);
  });
});

test('invalid budgets, future execution locks and unsupported objectives reject before IPC',async()=>{
  for (const configuration of [{timeBudgetMs:0},{auditReserveMs:-1},{initializationTimeoutMs:0},{hardOverrunGraceMs:-1}]) assert.throws(()=>createHiGHSPlanner(configuration));
  const planner=createHiGHSPlanner();
  try {
    await assert.rejects(planner(tiny(),{timeBudgetMs:-1}));
    await assert.rejects(planner(tiny(),{objectiveMode:'ddOnly'}),/joint/);
    await assert.rejects(planner(tiny(),opts(1,{A:{pickupDay:1}})),/strictly before/);
    await assert.rejects(planner(tiny(),opts(1,{unknown:{pickupDay:0}})),/Unknown/);
    await assert.rejects(planner.ready({timeoutMs:0}));
  } finally {await planner.close();}
});
