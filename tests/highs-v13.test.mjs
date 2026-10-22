import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {rowFor,auditSchedule} from '../src/engine.js';
import {auditFrozenEvents} from '../src/rolling-plan.js';
import {createGuardedCommitmentHiGHSPlannerV13} from '../scripts/highs-planner-v13.mjs';

const fixturePath=fileURLToPath(new URL('./fixtures/highs-v8-service.py',import.meta.url));
const fields=['pickupDay','unloadDay','returnDay'],costs=['storageCost','ddCost','totalCost','sunkCost','incrementalCost'];
const box=(id,extra={})=>({id,sizeFt:20,unloadDays:1,releaseDay:0,dueDay:4,dischargeDateTime:'2026-09-29T07:00:00+09:00',dataOrigin:'synthetic',...extra});
const scene=(extra={})=>({id:'v13-handwritten',horizonStart:'2026-10-13',horizonDays:6,truckCapacity:6,warehouseCapacity:3,stagingCapacity:6,containers:[box('A')],...extra});
const options=(extra={})=>({timeBudgetMs:200,minEventDay:0,fixedEvents:{},objectiveMode:'joint',...extra});
const dates=rows=>rows.map(r=>Object.fromEntries(['id',...fields].map(k=>[k,r[k]])));
const resultFor=(s,trips)=>{
  const rows=s.containers.map((c,i)=>rowFor(s,c,...trips[i])),independentCosts=Object.fromEntries(costs.map(k=>[k,rows.reduce((n,r)=>n+r[k],0)]));
  return {status:'optimal',solverStatus:0,hasIncumbent:true,provenOptimal:true,rows:dates(rows),objectiveCost:independentCosts.incrementalCost,independentCosts};
};
const withReply=(s,trips,extra={})=>({...s,nativeFixture:{reply:resultFor(s,trips),...extra}});
const emptyReply={status:'time_limit',solverStatus:1,hasIncumbent:false,rows:[]};
const proof=r=>r.plannerMetadata.stabilitySelection;
const guard=r=>proof(r).strictFeeGuard;
async function using(config,fn){
  // This suite NEVER launches the real native service or a benchmark.
  const planner=createGuardedCommitmentHiGHSPlannerV13({constructorBudgetMs:0,servicePath:fixturePath,...config});
  try{await planner.ready();return await fn(planner);}finally{await planner.close();}
}
const verify=(s,r,o={})=>{assert.equal(auditSchedule(s,r.rows).valid,true);assert.equal(auditFrozenEvents(r.rows,o.fixedEvents??{},o.minEventDay??0).valid,true);};
const freeBox=(id,extra={})=>box(id,{dischargeDateTime:'2026-10-13T07:00:00+09:00',...extra});

test('strictly cheaper proposal with equal mandatory load is accepted after both complete scores',async()=>{
  await using({},async p=>{
    const s=scene(),first=await p(withReply(s,[[2,2,3]]),options()),next=await p(withReply(s,[[0,0,1]]),options());
    assert.ok(next.objectiveCost<first.objectiveCost);assert.equal(guard(next).incumbentM,0);assert.equal(guard(next).proposalM,0);
    assert.equal(guard(next).complete,true);assert.equal(guard(next).timely,true);assert.equal(guard(next).decision,'accepted');
    assert.equal(guard(next).reason,'no_mandatory_load_increase');assert.equal(proof(next).decisionReason,'strict_fee_replacement_no_m_increase');
    assert.deepEqual(guard(next).incumbentDates,dates(first.rows));assert.deepEqual(guard(next).proposalDates,dates(next.rows));
    assert.equal(guard(next).incumbentFees.objectiveCost,first.objectiveCost);assert.equal(guard(next).proposalFees.objectiveCost,next.objectiveCost);
    assert.equal(guard(next).selectedM,0);assert.ok(guard(next).acceptedAtMs<=200);assert.equal(next.plannerMetadata.strictReplacementCount,1);verify(s,next);
  });
});

test('strictly cheaper lower-M proposal is accepted without mistaking necessary load for safety',async()=>{
  await using({},async p=>{
    const s=scene({containers:[box('A',{unloadDays:2}),freeBox('B',{unloadDays:2}),freeBox('C',{unloadDays:2})]});
    const before=[[2,2,4],[0,0,2],[0,0,2]],after=[[0,0,2],[2,2,4],[2,2,4]];
    const first=await p(withReply(s,before),options()),next=await p(withReply(s,after),options());
    assert.ok(next.objectiveCost<first.objectiveCost);assert.equal(guard(next).incumbentM,2);assert.equal(guard(next).proposalM,1);
    assert.equal(guard(next).decision,'accepted');assert.equal(guard(next).selectedM,1);assert.deepEqual(dates(next.rows),proof(next).proposalDates);
    assert.equal(proof(next).commitmentScore.cache.containers.length,3);assert.equal(proof(next).commitmentScore.proposal.containers.length,3);
    assert.match(proof(next).commitmentScore.proposal.scoreScope,/no joint feasibility or future recovery claim/);
  });
});

test('strictly cheaper proposal increasing mandatory load retains the timely cache and full rejected proof',async()=>{
  await using({},async p=>{
    const s=scene({containers:[box('A',{unloadDays:2})]}),first=await p(withReply(s,[[2,2,4]]),options()),next=await p(withReply(s,[[0,0,2]]),options());
    assert.ok(proof(next).proposalFees.objectiveCost<first.objectiveCost);assert.equal(guard(next).incumbentM,0);assert.equal(guard(next).proposalM,1);
    assert.equal(guard(next).decision,'retained_incumbent');assert.equal(guard(next).reason,'mandatory_load_increase');assert.equal(guard(next).eligible,false);
    assert.deepEqual(dates(next.rows),dates(first.rows));assert.equal(guard(next).selectedM,0);assert.equal(next.plannerMetadata.strictReplacementCount,0);
    assert.equal(proof(next).decisionReason,'retain_cheaper_native_mandatory_load_increase');assert.ok(guard(next).rejectedAtMs<=200);
    assert.equal(proof(next).nativeGate.acceptedAtMs,null);assert.deepEqual(proof(next).afterDates,dates(first.rows));
  });
});

test('fee ties retain their original strict M decrease rule and costlier proposals skip the guard',async()=>{
  await using({},async p=>{
    const s=scene({containers:[freeBox('A',{unloadDays:2})]}),first=await p(withReply(s,[[0,0,2]]),options()),lower=await p(withReply(s,[[2,2,4]]),options());
    assert.equal(first.objectiveCost,lower.objectiveCost);assert.equal(proof(lower).decisionReason,'equal_fee_lower_mandatory_warehouse');
    assert.equal(guard(lower).attempted,false);assert.equal(lower.plannerMetadata.commitmentReplacementCount,1);
    const tie=await p(withReply(s,[[3,3,5]]),options());assert.equal(proof(tie).commitmentScore.beforeM,0);assert.equal(proof(tie).commitmentScore.proposalM,0);
    assert.deepEqual(dates(tie.rows),dates(lower.rows));assert.equal(proof(tie).decisionReason,'retain_fee_tie_no_lower_mandatory_warehouse');
  });
  await using({},async p=>{
    const s=scene();await p(withReply(s,[[0,0,1]]),options());const costlier=await p(withReply(s,[[3,3,4]]),options());
    assert.equal(proof(costlier).decisionReason,'retain_costlier_native');assert.equal(guard(costlier).attempted,false);
  });
});

test('no incumbent accepts a timely audited native candidate without a nonexistent baseline guard',async()=>{
  await using({},async p=>{
    const s=scene({containers:[box('A',{unloadDays:2})]}),r=await p(withReply(s,[[0,0,2]]),options());
    assert.equal(r.status,'optimal');assert.equal(proof(r).decisionReason,'initialize_native');assert.equal(guard(r).attempted,false);assert.equal(guard(r).incumbentM,null);verify(s,r);
  });
});

test('constructor incumbent receives the same strict-fee M protection as a cached incumbent',async()=>{
  const seed=(s,o)=>{const r={status:'feasible',rows:[rowFor(s,s.containers[0],2,2,4)]};o.onCandidate(r);return r;};
  await using({constructorBudgetMs:40,seedConstructor:seed},async p=>{
    const s=scene({containers:[box('A',{unloadDays:2})]}),r=await p(withReply(s,[[0,0,2]]),options());
    assert.equal(r.plannerMetadata.candidateSource,'quick_constructor');assert.equal(guard(r).incumbentSource,'quick_constructor');
    assert.equal(guard(r).reason,'mandatory_load_increase');assert.equal(r.rows[0].unloadDay,2);assert.equal(r.plannerMetadata.acceptedConstructorReceipts,1);
  });
});

test('incomplete strict-fee scoring retains cache, null scores and acceptance counters',async()=>{
  let enabled=false,clock=0;
  const now=()=>{if(enabled&&new Error().stack.includes('commitment-slack-v11.js'))clock=201;return clock;};
  await using({now},async p=>{
    const s=scene(),first=await p(withReply(s,[[2,2,3]]),options());enabled=true;
    const r=await p(withReply(s,[[0,0,1]]),options());
    assert.equal(guard(r).complete,false);assert.equal(guard(r).decision,'retained_incumbent');assert.equal(guard(r).reason,'late_selection');
    assert.equal(guard(r).incumbentM,null);assert.equal(guard(r).proposalM,null);assert.equal(guard(r).acceptedAtMs,null);
    assert.deepEqual(dates(r.rows),dates(first.rows));assert.equal(r.plannerMetadata.strictReplacementCount,0);
    assert.equal(proof(r).selectedSource,'cached_incumbent');assert.equal(proof(r).changedEventCount,0);
  });
});

test('scoring errors retain cache and expose an explicit error without pretending M is zero',async()=>{
  let enabled=false;
  const now=()=>{if(enabled&&new Error().stack.includes('commitment-slack-v11.js'))throw new Error('fixture scoring failure');return 0;};
  await using({now},async p=>{
    const s=scene(),first=await p(withReply(s,[[2,2,3]]),options());enabled=true;
    const r=await p(withReply(s,[[0,0,1]]),options());
    assert.equal(guard(r).decision,'retained_incumbent');assert.equal(guard(r).reason,'scoring_error');assert.match(guard(r).error,/fixture scoring failure/);
    assert.equal(guard(r).complete,false);assert.equal(guard(r).selectedM,null);assert.deepEqual(dates(r.rows),dates(first.rows));assert.equal(r.plannerMetadata.strictReplacementCount,0);
  });
});

test('a proposal scoring error after the incumbent score preserves the known incumbent M',async()=>{
  let enabled=false,finished=0;
  const now=()=>{
    if(enabled){const stack=new Error().stack;if(stack.includes('at finish ')&&stack.includes('commitment-slack-v11.js'))finished++;
      else if(finished>0&&stack.includes('commitment-slack-v11.js'))throw new Error('proposal-only score failure');}
    return 0;
  };
  await using({now},async p=>{
    const s=scene(),first=await p(withReply(s,[[2,2,3]]),options());enabled=true;const r=await p(withReply(s,[[0,0,1]]),options());
    assert.equal(guard(r).incumbentM,0);assert.equal(guard(r).proposalM,null);assert.equal(guard(r).selectedM,0);
    assert.equal(guard(r).reason,'scoring_error');assert.deepEqual(dates(r.rows),dates(first.rows));
  });
});

test('both complete lower-M scores finishing after the deadline never change the selected endpoint',async()=>{
  let enabled=false,clock=0,finished=0;
  const now=()=>{if(enabled){const stack=new Error().stack;if(stack.includes('at finish ')&&stack.includes('commitment-slack-v11.js')){finished++;return 0;}if(finished>=2)clock=201;}return clock;};
  await using({now},async p=>{
    const s=scene(),first=await p(withReply(s,[[2,2,3]]),options());enabled=true;const r=await p(withReply(s,[[0,0,1]]),options());
    assert.equal(guard(r).complete,true);assert.equal(guard(r).timely,false);assert.equal(guard(r).reason,'late_selection');assert.equal(guard(r).decision,'retained_incumbent');
    assert.equal(guard(r).selectedM,guard(r).incumbentM);assert.equal(proof(r).commitmentScore.selectedM,guard(r).incumbentM);
    assert.deepEqual(dates(r.rows),dates(first.rows));assert.equal(r.plannerMetadata.strictReplacementCount,0);assert.equal(proof(r).nativeGate.outcome,'late_candidate');
    assert.equal(guard(r).rejectedAtMs,201);assert.equal(guard(r).acceptedAtMs,null);
  });
});

test('current invalid cache does not veto a timely legal native recovery and constructor lifecycle stays unchanged',async()=>{
  let constructorCalls=0;
  await using({constructorBudgetMs:40,seedConstructor:()=>{constructorCalls++;return {status:'time_limit',rows:[]};}},async p=>{
    const s=scene(),first=await p(withReply(s,[[0,0,1]]),options());
    assert.equal(constructorCalls,1);await p(withReply(s,[[0,0,1]]),options());assert.equal(constructorCalls,1);
    const observed={...s,truckCapacity:[0,6,6,6,6,6]},recovered=await p(withReply(observed,[[1,1,2]]),options());
    assert.equal(constructorCalls,2);assert.equal(proof(recovered).cacheValid,false);assert.equal(proof(recovered).decisionReason,'replace_invalid_cache');
    assert.equal(guard(recovered).attempted,false);verify(observed,recovered);
  });
});

test('future payloads, forged fees and illegal locked dates cannot enter the guard as accepted candidates',async()=>{
  await using({},async p=>{
    const s=scene();await assert.rejects(p({...s,events:[]},options()),/future-event/);await assert.rejects(p(s,options({actualScenario:{}})),/future-event/);
    const first=await p(withReply(s,[[0,0,2]]),options());
    const forged={...s,nativeFixture:{reply:{...resultFor(s,[[0,0,1]]),objectiveCost:-1}}},r=await p(forged,options());
    assert.deepEqual(dates(r.rows),dates(first.rows));assert.equal(proof(r).nativeGate.outcome,'fee_mismatch');assert.equal(guard(r).attempted,false);
    const locked=await p(withReply(s,[[1,1,2]]),options({minEventDay:1,fixedEvents:{A:{pickupDay:0,unloadDay:0}}}));
    assert.equal(proof(locked).nativeGate.outcome,'audit_failed');assert.equal(guard(locked).attempted,false);
  });
});

test('prototype-name ids and inherited locks cannot pollute guarded scoring across calls',async()=>{
  const watched=[Object,Object.prototype,Object.prototype.toString],before=watched.map(v=>Object.getOwnPropertyDescriptors(v));
  for(const id of ['constructor','__proto__','toString'])await using({},async p=>{
    const s=scene({containers:[box(id,{unloadDays:2})]}),first=await p(withReply(s,[[2,2,4]]),options()),r=await p(withReply(s,[[0,0,2]]),options());
    assert.equal(guard(r).reason,'mandatory_load_increase');assert.deepEqual(dates(r.rows),dates(first.rows));
    const repeat=await p(withReply(s,[[2,2,4]]),options());assert.equal(proof(repeat).commitmentScore.beforeM,0);
  });
  watched.forEach((v,i)=>assert.deepEqual(Object.getOwnPropertyDescriptors(v),before[i]));
});

test('cold readiness/close and hard-grace metadata retain the inherited process contract without a native solve',async()=>{
  const p=createGuardedCommitmentHiGHSPlannerV13({servicePath:fixturePath,constructorBudgetMs:0});
  const a=await p.ready(),b=await p.ready();assert.equal(a.pid,b.pid);assert.equal(a.fixture,true);
  const r=await p({...scene(),nativeFixture:{reply:emptyReply}},options());assert.equal(r.status,'time_limit');assert.equal(r.totalCost,null);
  assert.equal(r.plannerMetadata.hardOverrunGraceMs,250);assert.equal(proof(r).constructorDelivery.budgetMs,0);
  await p.close();await p.close();await assert.rejects(p(scene(),options()),/closed/);
});

const importedScene=()=>scene({horizonDays:8,containers:[box('A',{dueDay:6})]});
const importDates=[{id:'A',pickupDay:5,unloadDay:5,returnDay:6}];
const deadline=()=>performance.now()+200;

test('development import defaults to disabled and never primes the native service',async()=>{
  const p=createGuardedCommitmentHiGHSPlannerV13({servicePath:fixturePath,constructorBudgetMs:0});
  try{assert.throws(()=>p.importDevelopmentEndpoint(importedScene(),importDates,{minEventDay:5,deadlineMs:deadline()}),/disabled/);}
  finally{await p.close();}
});

test('explicit one-shot endpoint import fully audits prices and preserves exact cache into D6',async()=>{
  await using({enableDevelopmentEndpointImport:true},async p=>{
    const s=importedScene(),source=structuredClone(importDates),before=structuredClone(s);
    const receipt=p.importDevelopmentEndpoint(s,[{...source[0],totalCost:-999}],{minEventDay:5,fixedEvents:{},deadlineMs:deadline()});
    assert.equal(receipt.accepted,true);assert.equal(receipt.claimsNativeDiscovery,false);assert.equal(receipt.claimsPhysicalExecution,false);
    assert.equal(receipt.decisionCalls,0);assert.equal(receipt.solverCalls,0);assert.equal(receipt.audit.valid,true);assert.ok(receipt.fees.totalCost>0);
    assert.ok(receipt.receivedAtMs<=receipt.copiedAtMs);assert.ok(receipt.copiedAtMs<=receipt.validatedAtMs);assert.ok(receipt.validatedAtMs<=receipt.auditFinishedAtMs);
    assert.ok(receipt.auditFinishedAtMs<=receipt.proofFinishedAtMs);assert.ok(receipt.proofFinishedAtMs<=receipt.acceptedAtMs);
    assert.ok(receipt.startedAtMs+receipt.acceptedAtMs<=receipt.deadlineMs);assert.deepEqual(s,before);assert.deepEqual(importDates,source);
    receipt.canonicalDates[0].pickupDay=0;receipt.snapshot.truckCapacity=0;receipt.fixedEvents.A={pickupDay:0};
    const d6options=options({minEventDay:6,fixedEvents:{A:{pickupDay:5,unloadDay:5}}});
    const r=await p({...s,nativeFixture:{reply:emptyReply}},d6options);
    assert.equal(r.plannerMetadata.candidateSource,'cached_incumbent');assert.equal(r.plannerMetadata.decisionCalls,1);assert.equal(r.plannerMetadata.constructorCalls,0);
    assert.equal(proof(r).cacheStatus,'valid');assert.deepEqual(dates(r.rows),source);assert.equal(r.plannerMetadata.developmentEndpointImport.canonicalDates[0].pickupDay,5);
    verify(s,r,d6options);assert.throws(()=>p.importDevelopmentEndpoint(s,source,{minEventDay:5,deadlineMs:deadline()}),/one-shot/);
  });
});

test('failed development import consumes its one attempt and cannot contaminate a later normal call',async()=>{
  await using({enableDevelopmentEndpointImport:true},async p=>{
    const s=importedScene(),bad=p.importDevelopmentEndpoint(s,[{id:'A',pickupDay:0,unloadDay:0,returnDay:1}],{minEventDay:5,deadlineMs:deadline()});
    assert.equal(bad.accepted,false);assert.equal(bad.status,'audit_failed');assert.equal(bad.acceptedAtMs,null);
    assert.throws(()=>p.importDevelopmentEndpoint(s,importDates,{minEventDay:5,deadlineMs:deadline()}),/one-shot/);
    const r=await p({...s,nativeFixture:{reply:emptyReply}},options({minEventDay:5}));
    assert.equal(r.rows.length,0);assert.equal(r.plannerMetadata.developmentEndpointImport,null);assert.equal(proof(r).cacheStatus,'absent');
  });
});

test('late import copy and final atomic commit leave no cache or accepted receipt',async()=>{
  let clock=0;
  await using({enableDevelopmentEndpointImport:true,now:()=>clock},async p=>{
    const s=importedScene(),containers=s.containers;
    Object.defineProperty(s,'containers',{enumerable:true,get:()=>{clock=201;return containers;}});
    const receipt=p.importDevelopmentEndpoint(s,importDates,{minEventDay:5,deadlineMs:200});
    assert.equal(receipt.accepted,false);assert.equal(receipt.status,'late_copy');assert.equal(receipt.acceptedAtMs,null);
    const normal=importedScene(),r=await p({...normal,nativeFixture:{reply:emptyReply}},options({minEventDay:5}));
    assert.equal(r.rows.length,0);assert.equal(proof(r).cacheStatus,'absent');
  });
  let ticks=0;
  await using({enableDevelopmentEndpointImport:true,now:()=>++ticks>=7?201:0},async p=>{
    const receipt=p.importDevelopmentEndpoint(importedScene(),importDates,{minEventDay:5,deadlineMs:200});
    assert.equal(receipt.status,'late_commit');assert.equal(receipt.accepted,false);assert.equal(receipt.proofFinishedAtMs,0);assert.equal(receipt.rejectedAtMs,201);
    const r=await p({...importedScene(),nativeFixture:{reply:emptyReply}},options({minEventDay:5}));
    assert.equal(r.rows.length,0);assert.equal(r.plannerMetadata.developmentEndpointImport,null);
  });
});

test('development import rejects prior decisions, changed clocks, private future payload and changed execution locks',async()=>{
  await using({enableDevelopmentEndpointImport:true},async p=>{
    await p({...scene(),nativeFixture:{reply:emptyReply}},options());
    assert.throws(()=>p.importDevelopmentEndpoint(importedScene(),importDates,{minEventDay:5,deadlineMs:deadline()}),/before any decision/);
  });
  await using({enableDevelopmentEndpointImport:true},async p=>{
    assert.throws(()=>p.importDevelopmentEndpoint(importedScene(),importDates,{minEventDay:5,deadlineMs:deadline(),now:()=>0}),/different clock/);
    const bad=p.importDevelopmentEndpoint({...importedScene(),futureEvents:[]},importDates,{minEventDay:5,deadlineMs:deadline()});
    assert.equal(bad.accepted,false);assert.equal(bad.status,'import_error');assert.match(bad.error,/future-event/);
  });
  await using({enableDevelopmentEndpointImport:true},async p=>{
    const bad=p.importDevelopmentEndpoint(importedScene(),importDates,{minEventDay:5,fixedEvents:{A:{pickupDay:4}},deadlineMs:deadline()});
    assert.equal(bad.status,'audit_failed');assert.equal(bad.accepted,false);
  });
});

test('special ids and inherited locks remain isolated in imported history and returned proof copies',async()=>{
  for(const id of ['constructor','__proto__','toString'])await using({enableDevelopmentEndpointImport:true},async p=>{
    const s=scene({horizonDays:8,containers:[box(id,{dueDay:6})]}),endpoint=[{id,pickupDay:5,unloadDay:5,returnDay:6}];
    const inherited=Object.create(Object.fromEntries([[id,{pickupDay:0}]]));
    const receipt=p.importDevelopmentEndpoint(s,endpoint,{minEventDay:5,fixedEvents:inherited,deadlineMs:deadline()});
    assert.equal(receipt.accepted,true);assert.deepEqual(receipt.fixedEvents,{});
    const fixed=Object.fromEntries([[id,{pickupDay:5,unloadDay:5}]]),r=await p({...s,nativeFixture:{reply:emptyReply}},options({minEventDay:6,fixedEvents:fixed}));
    assert.equal(r.plannerMetadata.candidateSource,'cached_incumbent');verify(s,r,{minEventDay:6,fixedEvents:fixed});
    r.plannerMetadata.developmentEndpointImport.canonicalDates[0].pickupDay=0;
    const again=await p({...s,nativeFixture:{reply:emptyReply}},options({minEventDay:6,fixedEvents:fixed}));
    assert.equal(again.plannerMetadata.developmentEndpointImport.canonicalDates[0].pickupDay,5);
  });
});
