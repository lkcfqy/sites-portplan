import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {auditSchedule,rowFor} from '../src/engine.js';
import {auditFrozenEvents} from '../src/rolling-plan.js';
import {createStableHiGHSPlannerV10} from '../scripts/highs-planner-v10.mjs';

const FIELDS=['pickupDay','unloadDay','returnDay'];
const COSTS=['storageCost','ddCost','totalCost','sunkCost','incrementalCost'];
const fixturePath=fileURLToPath(new URL('./fixtures/highs-v8-service.py',import.meta.url));
const tiny=(extra={})=>({id:'v10-native-handwritten',horizonStart:'2026-10-13',horizonDays:6,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,
  containers:[{id:'A',sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:4,dataOrigin:'synthetic'}],...extra});
const freeTiny=(extra={})=>tiny({containers:[{...tiny().containers[0],dischargeDateTime:'2026-10-13T07:00:00+09:00'}],...extra});
const dates=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const opts=(extra={})=>({timeBudgetMs:2000,minEventDay:0,fixedEvents:{},objectiveMode:'joint',...extra});
const reply=(s,trips,extra={})=>{
  const rows=s.containers.map((c,index)=>rowFor(s,c,...trips[index]));
  const independentCosts=Object.fromEntries(COSTS.map(key=>[key,rows.reduce((n,row)=>n+row[key],0)]));
  return {status:'optimal',solverStatus:0,hasIncumbent:true,provenOptimal:true,rows:dates(rows),objectiveCost:independentCosts.incrementalCost,independentCosts,...extra};
};
const withReply=(s,trips,extra={})=>({...s,nativeFixture:{reply:reply(s,trips),...extra}});
async function using(configuration,callback){const planner=createStableHiGHSPlannerV10(configuration);try{await planner.ready();return await callback(planner);}finally{await planner.close();}}
const proof=result=>result.plannerMetadata.stabilitySelection;

test('fee ties retain the current complete dates and expose the rejected date-change proposal',async()=>{
  await using({servicePath:fixturePath},async planner=>{
    const s=freeTiny(),first=await planner(withReply(s,[[0,0,1]]),opts()),second=await planner(withReply(s,[[1,1,2]]),opts());
    assert.equal(first.plannerMetadata.candidateSource,'native_highs');assert.equal(second.plannerMetadata.candidateSource,'cached_incumbent');
    assert.equal(second.status,'feasible');assert.equal(second.optimality,'retained_audited_incumbent_not_reoptimized');
    assert.deepEqual(dates(second.rows),dates(first.rows));assert.deepEqual(proof(second).beforeDates,dates(first.rows));assert.deepEqual(proof(second).afterDates,dates(second.rows));
    assert.deepEqual(proof(second).proposalDates,[{id:'A',pickupDay:1,unloadDay:1,returnDay:2}]);
    assert.equal(proof(second).cacheValid,true);assert.equal(proof(second).nativeCostMinusCacheKRW,0);
    assert.equal(proof(second).changedEventCount,0);assert.equal(proof(second).proposalChangedEventCount,3);
    assert.equal(proof(second).decisionReason,'retain_fee_tie');assert.equal(second.plannerMetadata.tieRetainedCount,1);
    assert.equal(second.plannerMetadata.strictReplacementCount,0);assert.equal(proof(second).nativeGate.acceptedAtMs,null);
    assert.equal(proof(second).nativeGate.outcome,'retain_fee_tie');assert.equal(second.plannerMetadata.nativeCertificate.provenOptimal,true);
  });
});

test('only a strictly cheaper timely native proposal replaces valid cache; costlier proposals retain it',async()=>{
  await using({servicePath:fixturePath},async planner=>{
    const s=tiny(),first=await planner(withReply(s,[[3,3,4]]),opts()),cheaper=await planner(withReply(s,[[2,2,3]]),opts());
    assert.ok(cheaper.incrementalCost<first.incrementalCost);assert.equal(proof(cheaper).decisionReason,'strict_fee_replacement');
    assert.equal(proof(cheaper).changedEventCount,3);assert.equal(cheaper.plannerMetadata.strictReplacementCount,1);
    assert.equal(proof(cheaper).nativeCostMinusCacheKRW,cheaper.incrementalCost-first.incrementalCost);
    assert.equal(proof(cheaper).cacheCostMinusSelectedKRW,first.incrementalCost-cheaper.incrementalCost);
    assert.ok(proof(cheaper).nativeGate.acceptedAtMs<=2000);
    const expensive=await planner(withReply(s,[[4,4,5]]),opts());
    assert.deepEqual(dates(expensive.rows),dates(cheaper.rows));assert.equal(proof(expensive).decisionReason,'retain_costlier_native');
    assert.ok(proof(expensive).nativeCostMinusCacheKRW>0);assert.equal(proof(expensive).changedEventCount,0);
    assert.equal(expensive.plannerMetadata.strictReplacementCount,1);assert.equal(expensive.plannerMetadata.tieRetainedCount,0);
    assert.equal(proof(expensive).nativeGate.acceptedAtMs,null);
  });
});

test('the fixed 1e-6 KRW rule retains sub-epsilon improvement and accepts a larger strict decrease',async()=>{
  for(const [multiplier,expected]of [[1e-12,'retain_fee_tie'],[1e-10,'strict_fee_replacement']]){
    await using({servicePath:fixturePath},async planner=>{
      // The synthetic service permits fractional fixtures only to exercise the
      // adapter boundary. The real unchanged Python service refuses fractional
      // integer-KRW objectives; this is not a native performance experiment.
      const s=tiny({tariff:{pncMultiplier:multiplier,ddMultiplier:0}});
      await planner(withReply(s,[[3,3,4]]),opts());
      const result=await planner(withReply(s,[[2,2,3]]),opts());
      assert.equal(proof(result).decisionReason,expected);assert.equal(proof(result).feeEpsilonKRW,1e-6);
      if(expected==='retain_fee_tie')assert.ok(-proof(result).nativeCostMinusCacheKRW<=1e-6);
      else assert.ok(-proof(result).nativeCostMinusCacheKRW>1e-6);
    });
  }
});

test('a valid cache is repriced against current tariffs before any fee comparison',async()=>{
  await using({servicePath:fixturePath},async planner=>{
    const s=tiny(),first=await planner(withReply(s,[[0,0,1]]),opts());
    assert.ok(first.incrementalCost>0);
    const updated={...s,tariff:{pncMultiplier:0,ddMultiplier:0}},retained=await planner(withReply(updated,[[1,1,2]]),opts());
    assert.equal(retained.incrementalCost,0);assert.equal(proof(retained).beforeFees.incrementalCost,0);
    assert.equal(proof(retained).proposalFees.incrementalCost,0);assert.equal(proof(retained).nativeCostMinusCacheKRW,0);
    assert.deepEqual(dates(retained.rows),dates(first.rows));assert.equal(proof(retained).decisionReason,'retain_fee_tie');
  });
});

test('a currently invalid cache gives no stability veto to a timely legal native recovery',async()=>{
  await using({servicePath:fixturePath},async planner=>{
    const s=freeTiny(),first=await planner(withReply(s,[[0,0,1]]),opts());
    const observed={...s,truckCapacity:[0,2,2,2,2,2]},recovered=await planner(withReply(observed,[[1,1,2]]),opts());
    assert.equal(recovered.status,'optimal');assert.equal(proof(recovered).cacheStatus,'invalid');assert.equal(proof(recovered).cacheValid,false);
    assert.deepEqual(proof(recovered).beforeDates,dates(first.rows));assert.equal(proof(recovered).decisionReason,'replace_invalid_cache');
    assert.equal(proof(recovered).changedEventCount,null);assert.equal(proof(recovered).nativeCostMinusCacheKRW,null);
    assert.equal(recovered.plannerMetadata.strictReplacementCount,0);assert.equal(auditSchedule(observed,recovered.rows).valid,true);
  });
});

test('an invalid or forged-price native proposal cannot replace a valid cached plan',async()=>{
  await using({servicePath:fixturePath},async planner=>{
    const s=freeTiny();await planner(withReply(s,[[0,0,2]]),opts());
    const invalid=await planner(withReply(s,[[1,1,2]]),opts({minEventDay:1,fixedEvents:{A:{pickupDay:0,unloadDay:0}}}));
    assert.equal(invalid.plannerMetadata.candidateSource,'cached_incumbent');assert.equal(proof(invalid).nativeGate.outcome,'audit_failed');
    assert.deepEqual(proof(invalid).proposalDates,[{id:'A',pickupDay:1,unloadDay:1,returnDay:2}]);
    assert.equal(proof(invalid).nativeGate.acceptedAtMs,null);assert.equal(invalid.rows[0].pickupDay,0);
    const forged={...s,nativeFixture:{reply:reply(s,[[0,0,1]],{objectiveCost:-1})}},kept=await planner(forged,opts());
    assert.equal(proof(kept).nativeGate.outcome,'fee_mismatch');assert.equal(kept.plannerMetadata.stages.native.independentCostsMatch,false);
    assert.equal(kept.rows[0].returnDay,2);assert.equal(kept.plannerMetadata.strictReplacementCount,0);
  });
});

test('deadline gate includes complete native selection proof construction, preserving the timely cache',async()=>{
  let calls=0,overrun=false;
  await using({servicePath:fixturePath,now:()=>{calls++;return overrun&&calls>=17?201:0;}},async planner=>{
    const s=tiny(),first=await planner(withReply(s,[[3,3,4]]),opts({timeBudgetMs:200}));
    calls=0;overrun=true;
    const late=await planner(withReply(s,[[2,2,3]]),opts({timeBudgetMs:200}));
    assert.deepEqual(dates(late.rows),dates(first.rows));assert.equal(late.plannerMetadata.candidateSource,'cached_incumbent');
    assert.equal(proof(late).cacheGate.acceptedAtMs,0);assert.equal(proof(late).nativeGate.acceptedAtMs,null);
    assert.equal(proof(late).nativeGate.outcome,'late_candidate');assert.equal(late.plannerMetadata.stages.native.lateCandidateDiscarded,true);
    assert.equal(late.plannerMetadata.strictReplacementCount,0);assert.equal(proof(late).changedEventCount,0);
  });
});

test('late first native proposal is rejected with null fees and its raw solver certificate retained',async()=>{
  let calls=0;
  await using({servicePath:fixturePath,now:()=>++calls>=12?201:0},async planner=>{
    const s=tiny(),late=await planner(withReply(s,[[0,0,1]]),opts({timeBudgetMs:200}));
    assert.equal(late.status,'time_limit');assert.deepEqual(late.rows,[]);assert.equal(late.totalCost,null);assert.equal(late.objectiveCost,null);
    assert.equal(late.plannerMetadata.nativeCertificate.provenOptimal,true);assert.equal(proof(late).nativeGate.acceptedAtMs,null);
    assert.equal(proof(late).afterDates,null);assert.equal(proof(late).changedEventCount,null);
  });
});

test('copying consumes the same whole-call allowance before startup and no zero-fee success is invented',async()=>{
  let clock=0;const s=tiny(),containers=s.containers;
  Object.defineProperty(s,'containers',{enumerable:true,get:()=>{clock=210;return containers;}});
  const planner=createStableHiGHSPlannerV10({now:()=>clock,timeBudgetMs:200});
  try{
    const result=await planner(s);assert.equal(result.status,'time_limit');assert.equal(result.incrementalCost,null);
    assert.equal(result.plannerMetadata.solverCalls,0);assert.equal(result.plannerMetadata.startupWallMs,null);
    assert.equal(proof(result).cacheStatus,'absent');assert.equal(proof(result).afterDates,null);
  }finally{await planner.close();}
});

test('mutating delivered rows or proofs cannot rewrite the next cached before endpoint',async()=>{
  await using({servicePath:fixturePath},async planner=>{
    const s=freeTiny(),first=await planner(withReply(s,[[0,0,1]]),opts());
    first.rows[0].pickupDay=5;proof(first).afterDates[0].pickupDay=5;
    const second=await planner(withReply(s,[[1,1,2]]),opts());
    assert.equal(proof(second).beforeDates[0].pickupDay,0);assert.equal(second.rows[0].pickupDay,0);
  });
});

test('real native successful plans and ongoing TEU unloading retain complete physical and fee audits',async()=>{
  await using({},async planner=>{
    const first=tiny(),a=await planner(first,opts()),b=await planner(first,opts());
    assert.equal(a.status,'optimal');assert.equal(auditSchedule(first,a.rows).valid,true);
    assert.deepEqual(dates(b.rows),dates(a.rows));assert.equal(proof(b).decisionReason,'retain_fee_tie');
    assert.equal(b.plannerMetadata.nativeCertificate.incumbentAudit.valid,true);assert.equal(b.plannerMetadata.stages.native.independentCostsMatch,true);
    assert.equal(b.plannerMetadata.nativeCertificate.solverThreads,1);
    const s=tiny({operations:{stagingUnit:'teu'},stagingCapacity:2,containers:[{...first.containers[0],sizeFt:40,unloadDays:3}]}),o=opts({minEventDay:2,fixedEvents:{A:{pickupDay:0,unloadDay:0}}}),ongoing=await planner(s,o);
    assert.equal(auditSchedule(s,ongoing.rows).valid,true);assert.equal(auditFrozenEvents(ongoing.rows,o.fixedEvents,2).valid,true);
    assert.equal(ongoing.usage[2].warehouse,1);assert.equal(ongoing.usage[2].staging,2);
    assert.equal(proof(ongoing).cacheStatus,'different_episode');assert.equal(proof(ongoing).beforeDates,null);
  });
});

test('readiness remains one process and close/configuration behavior matches the old native interface',async()=>{
  const planner=createStableHiGHSPlannerV10({servicePath:fixturePath});
  try{
    const a=await planner.ready(),b=await planner.ready();assert.equal(a.pid,b.pid);assert.equal(a.startupWallMs,b.startupWallMs);
    await assert.rejects(planner(tiny(),opts({minEventDay:1,fixedEvents:{A:{pickupDay:1}}})),/strictly before/);
    await assert.rejects(planner(tiny(),opts({objectiveMode:'ddOnly'})),/joint/);
  }finally{await planner.close();await planner.close();}
  await assert.rejects(planner(tiny(),opts()),/closed/);
  assert.throws(()=>createStableHiGHSPlannerV10({timeBudgetMs:0}));
});
