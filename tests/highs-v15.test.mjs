import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {auditSchedule,rowFor} from '../src/engine.js';
import {auditFrozenEvents} from '../src/rolling-plan.js';
import {scoreCommitmentSlackV11} from '../src/commitment-slack-v11.js';
import {createTimelySeededHiGHSPlannerV15,NATIVE_RETURN_RESERVE_MS_V15} from '../scripts/highs-planner-v15.mjs';

// Every child in this suite is a handwritten JSON wire fixture. No SciPy,
// HiGHS, real optimization, experiment generation or benchmark is launched.
const fixturePath=fileURLToPath(new URL('./fixtures/highs-v15-service.py',import.meta.url));
const COSTS=['storageCost','ddCost','totalCost','sunkCost','incrementalCost'];
const scene=(extra={})=>({id:'v15-handwritten',horizonStart:'2026-10-13',horizonDays:6,truckCapacity:4,warehouseCapacity:2,stagingCapacity:4,
  containers:[{id:'A',sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:4,dataOrigin:'synthetic'}],...extra});
const freeScene=(extra={})=>scene({containers:[{...scene().containers[0],dischargeDateTime:'2026-10-13T07:00:00+09:00'}],...extra});
const options=(extra={})=>({timeBudgetMs:200,minEventDay:0,fixedEvents:{},objectiveMode:'joint',...extra});
const dates=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const reply=(s,trips,extra={})=>{
  const rows=s.containers.map((c,i)=>rowFor(s,c,...trips[i]));
  const independentCosts=Object.fromEntries(COSTS.map(key=>[key,rows.reduce((sum,row)=>sum+row[key],0)]));
  return {status:'optimal',solverStatus:0,hasIncumbent:true,provenOptimal:true,provenInfeasible:false,rows:dates(rows),
    objectiveCost:independentCosts.incrementalCost,independentCosts,...extra};
};
const withReply=(s,trips,extra={})=>({...s,nativeFixture:{reply:reply(s,trips,extra)}});
const proof=result=>result.plannerMetadata.stabilitySelection;
const delivery=result=>result.plannerMetadata.deliveryBudget;
async function using(config,fn){
  const planner=createTimelySeededHiGHSPlannerV15({constructorBudgetMs:0,servicePath:fixturePath,...config});
  try{await planner.ready();return await fn(planner);}finally{await planner.close();}
}

/** Drive the injected monotonic clock at named wire stages rather than sleep.
 * The Date.now hook marks the existing Unix sample: the next mono reads are
 * request sample, serialization complete, pre-send, then native receipt.
 * Handwritten fixture clocks are never evidence of real native performance. */
async function usingWireClock(initial,fn){
  const originalDateNow=Date.now;let active=false,reads=0,settings={arrival:0,sampleJump:0,serializationAt:null,...initial};
  Date.now=()=>{active=true;reads=0;return 1_000_000;};
  const now=()=>{
    if(!active)return 0;
    reads++;
    if(settings.serializationAt!==null&&reads>=2)return settings.serializationAt;
    return reads<=3?settings.sampleJump:settings.arrival;
  };
  const arm=next=>{active=false;reads=0;settings={arrival:0,sampleJump:0,serializationAt:null,...next};};
  try{return await fn({now,arm});}finally{Date.now=originalDateNow;}
}

test('fixed 10ms is subtracted from the original deadline and is visible on the actual wire',async()=>{
  await usingWireClock({},async({now})=>using({now},async planner=>{
    const r=await planner(withReply(scene(),[[0,0,1]]),options()),b=delivery(r);
    assert.equal(NATIVE_RETURN_RESERVE_MS_V15,10);assert.equal(b.wholeDeadlineAtMs,200);
    assert.equal(b.outerAcceptanceDeadlineAtMs,200);assert.equal(b.nativeDeadlineAtMs,190);assert.equal(b.nativeReturnTargetAtMs,190);
    assert.equal(b.nativeReturnReserveMs,10);assert.equal(b.serviceAuditReserveMs,2);
    assert.equal(b.remainingAtServiceReadyMs,190-b.requestClockSampleAtMs);
    assert.equal(b.nativeDeadlineUnixMs,b.requestUnixNowMs+b.remainingAtServiceReadyMs);
    assert.equal(r.plannerMetadata.nativeCertificate.fixtureRequest.deadlineUnixMs,b.nativeDeadlineUnixMs);
    assert.equal(r.plannerMetadata.nativeCertificate.fixtureRequest.auditReserveMs,2);
    assert.equal(b.serviceRequestDispatched,true);assert.equal(b.requestStatus,'dispatched');
    assert.equal(b.actualServiceResponse,true);assert.equal(b.requestSettlement,'service_response');
    assert.equal(b.requestSettledAtMs,proof(r).nativeGate.receivedAtMs);
    assert.equal(b.nativeResponseReceivedAtMs,proof(r).nativeGate.receivedAtMs);
    assert.equal(r.plannerMetadata.hardOverrunGraceMs,250);assert.equal(auditSchedule(scene(),r.rows).valid,true);
  }));
  for(const value of [0,5,20,NaN,Infinity])assert.throws(()=>createTimelySeededHiGHSPlannerV15({nativeReturnReserveMs:value}),/fixes/);
});

test('preemption between Unix and monotonic samples only shortens the native allowance',async()=>{
  await usingWireClock({sampleJump:20,arrival:20},async({now})=>using({now},async planner=>{
    const r=await planner(withReply(scene(),[[0,0,1]]),options()),b=delivery(r);
    assert.equal(b.requestClockSampleAtMs,20);assert.equal(b.remainingAtServiceReadyMs,170);
    assert.equal(b.nativeDeadlineUnixMs,1_000_170);assert.equal(b.requestSentAtMs,20);
    assert.equal(proof(r).nativeGate.acceptedAtMs,20);
  }));
});

test('a response past the 190ms return target may still be accepted after full audit by the original 200ms gate',async()=>{
  await usingWireClock({arrival:195},async({now})=>using({now},async planner=>{
    const r=await planner(withReply(scene(),[[0,0,1]],{deadlineOverrunMs:5}),options());
    assert.equal(r.status,'optimal');assert.equal(delivery(r).nativeResponseReceivedAtMs,195);
    assert.equal(delivery(r).nativeReturnTargetMet,false);assert.equal(proof(r).nativeGate.auditFinishedAtMs,195);
    assert.equal(proof(r).nativeGate.acceptedAtMs,195);assert.equal(r.plannerMetadata.nativeCertificate.deadlineOverrunMs,5);
    assert.equal(proof(r).decisionReason,'initialize_native');
  }));
});

test('a first response audited after 200ms stays rejected with null fees and full late evidence',async()=>{
  await usingWireClock({arrival:205},async({now})=>using({now},async planner=>{
    const r=await planner(withReply(scene(),[[0,0,1]]),options());
    assert.equal(r.status,'time_limit');assert.deepEqual(r.rows,[]);assert.equal(r.totalCost,null);assert.equal(r.incrementalCost,null);
    assert.equal(proof(r).nativeGate.acceptedAtMs,null);assert.equal(proof(r).nativeGate.outcome,'late_candidate');
    assert.equal(proof(r).nativeGate.rejectedAtMs,205);assert.equal(r.plannerMetadata.nativeCertificate.hasIncumbent,true);
    assert.equal(delivery(r).nativeReturnTargetMet,false);assert.equal(r.plannerMetadata.stages.native.lateCandidateDiscarded,true);
  }));
});

test('a late cheaper response cannot overwrite the already timely audited cache',async()=>{
  await usingWireClock({},async({now,arm})=>using({now},async planner=>{
    const s=scene(),first=await planner(withReply(s,[[3,3,4]]),options());arm({arrival:205});
    const r=await planner(withReply(s,[[0,0,1]]),options());
    assert.deepEqual(dates(r.rows),dates(first.rows));assert.equal(r.plannerMetadata.candidateSource,'cached_incumbent');
    assert.equal(proof(r).cacheGate.acceptedAtMs,0);assert.equal(proof(r).nativeGate.acceptedAtMs,null);
    assert.equal(proof(r).nativeGate.outcome,'late_candidate');assert.equal(r.plannerMetadata.strictReplacementCount,0);
  }));
});

test('serialization crossing the earlier target sends no request and retains the valid incumbent',async()=>{
  await usingWireClock({},async({now,arm})=>using({now},async planner=>{
    const s=scene(),first=await planner(withReply(s,[[3,3,4]]),options());arm({serializationAt:191});
    const r=await planner(withReply(s,[[0,0,1]]),options()),b=delivery(r);
    assert.equal(b.requestStatus,'native_return_budget_exhausted_during_serialization');assert.equal(b.serializationFinishedAtMs,191);
    assert.equal(b.serviceRequestDispatched,false);assert.equal(b.requestSentAtMs,null);assert.equal(b.nativeResponseReceivedAtMs,null);
    assert.equal(b.actualServiceResponse,false);assert.equal(b.nativeReturnTargetMet,null);assert.equal(r.plannerMetadata.solverCalls,1);
    assert.deepEqual(dates(r.rows),dates(first.rows));assert.equal(proof(r).cacheGate.acceptedAtMs,0);
  }));
});

test('actual child exit and malformed packets settle errors without inventing a native response',async()=>{
  for(const mode of ['exit','malformed'])await using({now:()=>0},async planner=>{
    const s=scene(),r=await planner({...s,nativeFixture:{mode,reply:reply(s,[[0,0,1]])}},options()),b=delivery(r);
    assert.equal(r.status,'solver_error');assert.equal(b.serviceRequestDispatched,true);
    assert.equal(b.actualServiceResponse,false);assert.equal(b.nativeResponseReceivedAtMs,null);assert.equal(b.nativeReturnTargetMet,null);
    assert.equal(b.requestSettlement,'service_error');assert.equal(b.requestSettledAtMs,proof(r).nativeGate.receivedAtMs);
    assert.equal(r.plannerMetadata.nativeCertificate.hasIncumbent,false);assert.equal(r.plannerMetadata.stages.native.status,'solver_error');
    assert.equal(r.totalCost,null);assert.equal(proof(r).nativeGate.acceptedAtMs,null);
  });
});

test('a real hard-timeout of the handwritten service has no actual native packet or target result',async()=>{
  // Deliberately smaller fixture clock only. No experiment budget is changed.
  await using({now:()=>0,hardOverrunGraceMs:0},async planner=>{
    const s=scene(),r=await planner({...s,nativeFixture:{mode:'never',reply:reply(s,[[0,0,1]])}},options({timeBudgetMs:40})),b=delivery(r);
    assert.equal(r.status,'time_limit');assert.equal(r.plannerMetadata.hardTimeout,true);
    assert.equal(b.wholeDeadlineAtMs,40);assert.equal(b.nativeReturnTargetAtMs,30);
    assert.equal(b.serviceRequestDispatched,true);assert.equal(b.actualServiceResponse,false);
    assert.equal(b.nativeResponseReceivedAtMs,null);assert.equal(b.nativeReturnTargetMet,null);
    assert.equal(b.requestSettlement,'hard_timeout');assert.equal(b.requestSettledAtMs,proof(r).nativeGate.receivedAtMs);
    assert.equal(r.plannerMetadata.nativeCertificate.hasIncumbent,false);assert.equal(r.plannerMetadata.nativeCertificate.hardTimeout,true);
    assert.equal(r.totalCost,null);assert.equal(proof(r).nativeGate.acceptedAtMs,null);
    const sealed=structuredClone(b);
    // Drain the killed fixture's exit/close and pending rejection after the
    // planner has delivered its proof. This is not a new optimization run.
    await planner.close();await new Promise(resolve=>setTimeout(resolve,20));
    assert.deepEqual(delivery(r),sealed);assert.equal(delivery(r).actualServiceResponse,false);
    assert.equal(delivery(r).requestSettlement,'hard_timeout');assert.equal(delivery(r).nativeResponseReceivedAtMs,null);
  });
});

test('strict fee improvement keeps V12 economics even when the necessary tomorrow load increases',async()=>{
  await using({now:()=>0},async planner=>{
    const s=scene({containers:[{...scene().containers[0],unloadDays:2}]}),first=await planner(withReply(s,[[2,2,4]]),options());
    const r=await planner(withReply(s,[[0,0,2]]),options());
    const before=scoreCommitmentSlackV11(s,first.rows,{minEventDay:0,fixedEvents:{},now:()=>0,deadlineMs:200});
    const after=scoreCommitmentSlackV11(s,r.rows,{minEventDay:0,fixedEvents:{},now:()=>0,deadlineMs:200});
    assert.equal(before.mandatoryWarehouseTomorrow,0);assert.equal(after.mandatoryWarehouseTomorrow,1);
    assert.ok(r.incrementalCost<first.incrementalCost);assert.equal(proof(r).decisionReason,'strict_fee_replacement');
    assert.equal(proof(r).commitmentScore.attempted,false);assert.equal(Object.hasOwn(proof(r),'strictFeeGuard'),false);
  });
});

test('V12 equal-fee lower-M selection and unchanged constructor synchronous delivery still apply',async()=>{
  await using({now:()=>0},async planner=>{
    const s=freeScene({containers:[{...freeScene().containers[0],unloadDays:2}]}),first=await planner(withReply(s,[[0,0,2]]),options());
    const r=await planner(withReply(s,[[2,2,4]]),options());
    assert.equal(first.objectiveCost,r.objectiveCost);assert.equal(proof(r).decisionReason,'equal_fee_lower_mandatory_warehouse');
    assert.equal(proof(r).commitmentScore.beforeM,1);assert.equal(proof(r).commitmentScore.proposalM,0);
    assert.equal(r.plannerMetadata.commitmentReplacementCount,1);
  });
  const seedConstructor=(s,o)=>{const candidate={status:'feasible',rows:[rowFor(s,s.containers[0],2,2,4)]};o.onCandidate(candidate);return candidate;};
  await using({now:()=>0,constructorBudgetMs:40,seedConstructor},async planner=>{
    const s=scene({containers:[{...scene().containers[0],unloadDays:2}]}),r=await planner(withReply(s,[[0,0,2]]),options());
    assert.equal(proof(r).constructorDelivery.budgetMs,40);assert.equal(proof(r).constructorDelivery.auditReserveMs,5);
    assert.equal(proof(r).constructorDelivery.maxRestarts,3);assert.equal(proof(r).constructorDelivery.events[0].outcome,'accepted');
    assert.equal(proof(r).constructorDelivery.returnedResultUsedAsReceipt,false);assert.equal(proof(r).preNativeIncumbent.source,'quick_constructor');
    assert.equal(proof(r).decisionReason,'strict_fee_replacement');assert.equal(r.plannerMetadata.strictReplacementCount,1);
  });
});

test('executed locks, forged fees and private future payloads cannot bypass audits',async()=>{
  await using({now:()=>0},async planner=>{
    const s=freeScene(),first=await planner(withReply(s,[[0,0,2]]),options());
    const locked=options({minEventDay:1,fixedEvents:{A:{pickupDay:0,unloadDay:0}}});
    const invalid=await planner(withReply(s,[[1,1,2]]),locked);
    assert.deepEqual(dates(invalid.rows),dates(first.rows));assert.equal(proof(invalid).nativeGate.outcome,'audit_failed');
    assert.equal(auditFrozenEvents(invalid.rows,locked.fixedEvents,1).valid,true);
    const forged=await planner(withReply(s,[[0,0,1]],{objectiveCost:-1}),locked);
    assert.equal(proof(forged).nativeGate.outcome,'fee_mismatch');assert.deepEqual(dates(forged.rows),dates(first.rows));
    await assert.rejects(planner({...s,futureEvents:[]},options()),/private future/);
    await assert.rejects(planner(s,options({events:[]})),/private future/);
    await assert.rejects(planner(s,options({minEventDay:1,fixedEvents:{A:{pickupDay:1}}})),/strictly before/);
    await assert.rejects(planner(s,options({nativeReturnReserveMs:10})),/call override/);
  });
});

test('delivered proof mutation and separate factories cannot rewrite cached dates',async()=>{
  await using({now:()=>0},async planner=>{
    const s=freeScene(),first=await planner(withReply(s,[[0,0,1]]),options());
    first.rows[0].pickupDay=5;proof(first).afterDates[0].pickupDay=5;
    const next=await planner(withReply(s,[[1,1,2]]),options());
    assert.equal(proof(next).beforeDates[0].pickupDay,0);assert.equal(next.rows[0].pickupDay,0);
    await using({now:()=>0},async other=>{
      const fresh=await other(withReply(s,[[1,1,2]]),options());
      assert.equal(proof(fresh).beforeDates,null);assert.equal(fresh.rows[0].pickupDay,1);
    });
  });
});

test('the V12 backbone and native Python service remain byte-identical to their frozen versions',()=>{
  const hash=path=>createHash('sha256').update(readFileSync(new URL(path,import.meta.url))).digest('hex');
  assert.equal(hash('../scripts/highs-planner-v12.mjs'),'aa7a320e1916f6c157b2eed7ebad7eb2ad06c83bc6cea6743e1e45ca5e3285e4');
  assert.equal(hash('../scripts/highs-service-v8.py'),'2e216ce22c820d1aa718b9ba6511ee661dd588504f3f0e6def2b77ce98eedb02');
});
