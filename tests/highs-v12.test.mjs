import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {auditSchedule,rowFor} from '../src/engine.js';
import {auditFrozenEvents} from '../src/rolling-plan.js';
import {createSeededCommitmentHiGHSPlannerV12} from '../scripts/highs-planner-v12.mjs';

const FIELDS=['pickupDay','unloadDay','returnDay'];
const COSTS=['storageCost','ddCost','totalCost','sunkCost','incrementalCost'];
const fixturePath=fileURLToPath(new URL('./fixtures/highs-v8-service.py',import.meta.url));
const tiny=(extra={})=>({id:'v12-native-handwritten',horizonStart:'2026-10-13',horizonDays:6,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,
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
async function using(configuration,callback){const planner=createSeededCommitmentHiGHSPlannerV12({constructorBudgetMs:0,...configuration});try{await planner.ready();return await callback(planner);}finally{await planner.close();}}
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
    assert.equal(proof(second).decisionReason,'retain_fee_tie_no_lower_mandatory_warehouse');assert.equal(second.plannerMetadata.tieRetainedCount,1);
    assert.equal(second.plannerMetadata.strictReplacementCount,0);assert.equal(proof(second).nativeGate.acceptedAtMs,null);
    assert.equal(proof(second).nativeGate.outcome,'retain_fee_tie_no_lower_mandatory_warehouse');assert.equal(second.plannerMetadata.nativeCertificate.provenOptimal,true);
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
  for(const [multiplier,expected]of [[1e-12,'retain_fee_tie_no_lower_mandatory_warehouse'],[1e-10,'strict_fee_replacement']]){
    await using({servicePath:fixturePath},async planner=>{
      // The synthetic service permits fractional fixtures only to exercise the
      // adapter boundary. The real unchanged Python service refuses fractional
      // integer-KRW objectives; this is not a native performance experiment.
      const s=tiny({tariff:{pncMultiplier:multiplier,ddMultiplier:0}});
      await planner(withReply(s,[[3,3,4]]),opts());
      const result=await planner(withReply(s,[[2,2,3]]),opts());
      assert.equal(proof(result).decisionReason,expected);assert.equal(proof(result).feeEpsilonKRW,1e-6);
      if(expected==='retain_fee_tie_no_lower_mandatory_warehouse')assert.ok(-proof(result).nativeCostMinusCacheKRW<=1e-6);
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
    assert.deepEqual(dates(retained.rows),dates(first.rows));assert.equal(proof(retained).decisionReason,'retain_fee_tie_no_lower_mandatory_warehouse');
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
    const forged={...s,nativeFixture:{reply:reply(s,[[0,0,1]],{objectiveCost:-1})}},kept=await planner(forged,opts({minEventDay:1,fixedEvents:{A:{pickupDay:0,unloadDay:0}}}));
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
  const planner=createSeededCommitmentHiGHSPlannerV12({now:()=>clock,timeBudgetMs:200});
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
    assert.deepEqual(dates(b.rows),dates(a.rows));assert.equal(proof(b).decisionReason,'retain_fee_tie_no_lower_mandatory_warehouse');
    assert.equal(b.plannerMetadata.nativeCertificate.incumbentAudit.valid,true);assert.equal(b.plannerMetadata.stages.native.independentCostsMatch,true);
    assert.equal(b.plannerMetadata.nativeCertificate.solverThreads,1);
    const s=tiny({operations:{stagingUnit:'teu'},stagingCapacity:2,containers:[{...first.containers[0],sizeFt:40,unloadDays:3}]}),o=opts({minEventDay:2,fixedEvents:{A:{pickupDay:0,unloadDay:0}}}),ongoing=await planner(s,o);
    assert.equal(auditSchedule(s,ongoing.rows).valid,true);assert.equal(auditFrozenEvents(ongoing.rows,o.fixedEvents,2).valid,true);
    assert.equal(ongoing.usage[2].warehouse,1);assert.equal(ongoing.usage[2].staging,2);
    assert.equal(proof(ongoing).cacheStatus,'different_episode_reset');assert.equal(proof(ongoing).beforeDates,null);
  });
});

test('readiness remains one process and close/configuration behavior matches the old native interface',async()=>{
  const planner=createSeededCommitmentHiGHSPlannerV12({servicePath:fixturePath});
  try{
    const a=await planner.ready(),b=await planner.ready();assert.equal(a.pid,b.pid);assert.equal(a.startupWallMs,b.startupWallMs);
    await assert.rejects(planner(tiny(),opts({minEventDay:1,fixedEvents:{A:{pickupDay:1}}})),/strictly before/);
    await assert.rejects(planner(tiny(),opts({objectiveMode:'ddOnly'})),/joint/);
  }finally{await planner.close();await planner.close();}
  await assert.rejects(planner(tiny(),opts()),/closed/);
  assert.throws(()=>createSeededCommitmentHiGHSPlannerV12({timeBudgetMs:0}));
});

const commitmentScene=()=>freeTiny({truckCapacity:6,warehouseCapacity:3,stagingCapacity:6,
  containers:[{...freeTiny().containers[0],id:'A',dueDay:1},{...freeTiny().containers[0],id:'B',unloadDays:2,dueDay:4}]});
const committedTrips=[[1,1,2],[0,0,2]],lessCommittedTrips=[[1,1,2],[2,2,4]];

test('equal fees permit replacement only after complete timely all-box mandatory-load reduction',async()=>{
  await using({servicePath:fixturePath},async planner=>{
    const s=commitmentScene(),first=await planner(withReply(s,committedTrips),opts());
    const second=await planner(withReply(s,lessCommittedTrips),opts()),selection=proof(second),scoring=selection.commitmentScore;
    assert.equal(first.objectiveCost,0);assert.equal(second.objectiveCost,0);
    assert.equal(selection.feeRelation,'equal');assert.equal(selection.decisionReason,'equal_fee_lower_mandatory_warehouse');
    assert.equal(selection.selectedSource,'native_highs');assert.deepEqual(dates(second.rows),selection.proposalDates);
    assert.equal(scoring.complete,true);assert.equal(scoring.timely,true);assert.equal(scoring.beforeM,2);assert.equal(scoring.proposalM,1);assert.equal(scoring.selectedM,1);
    assert.equal(scoring.cache.containers.length,2);assert.equal(scoring.proposal.containers.length,2);
    assert.equal(selection.publicCapacities.warehouse[1],3);
    assert.equal(second.plannerMetadata.commitmentReplacementCount,1);assert.equal(second.plannerMetadata.strictReplacementCount,0);assert.equal(second.plannerMetadata.tieRetainedCount,0);
    assert.ok(selection.nativeGate.acceptedAtMs<=2000);
  });
});

test('moving tomorrow commitment to another box cannot win a fee tie',async()=>{
  await using({servicePath:fixturePath},async planner=>{
    const base=freeTiny().containers[0],s=freeTiny({truckCapacity:6,warehouseCapacity:3,stagingCapacity:6,
      containers:[{...base,id:'A',dueDay:1},{...base,id:'B',unloadDays:2},{...base,id:'C',unloadDays:2}]});
    const first=await planner(withReply(s,[[1,1,2],[0,0,2],[2,2,4]]),opts());
    const second=await planner(withReply(s,[[1,1,2],[2,2,4],[0,0,2]]),opts());
    assert.equal(proof(second).commitmentScore.beforeM,2);assert.equal(proof(second).commitmentScore.proposalM,2);
    assert.deepEqual(dates(second.rows),dates(first.rows));assert.equal(second.plannerMetadata.commitmentReplacementCount,0);
    assert.equal(proof(second).decisionReason,'retain_fee_tie_no_lower_mandatory_warehouse');
  });
});

test('strictly lower and higher fees keep V10 priorities without using M as a veto',async()=>{
  await using({servicePath:fixturePath},async planner=>{
    const s={...commitmentScene(),containers:commitmentScene().containers.map(c=>({...c,dischargeDateTime:'2026-09-29T07:00:00+09:00'}))};
    const first=await planner(withReply(s,lessCommittedTrips),opts());
    const cheaper=await planner(withReply(s,committedTrips),opts());
    assert.ok(cheaper.objectiveCost<first.objectiveCost);assert.equal(proof(cheaper).feeRelation,'lower');
    assert.equal(proof(cheaper).decisionReason,'strict_fee_replacement');assert.equal(proof(cheaper).commitmentScore.attempted,false);
    assert.equal(proof(cheaper).commitmentScore.beforeM,null);assert.deepEqual(dates(cheaper.rows),proof(cheaper).proposalDates);
    const costlier=await planner(withReply(s,lessCommittedTrips),opts());
    assert.equal(proof(costlier).feeRelation,'higher');assert.equal(proof(costlier).decisionReason,'retain_costlier_native');
    assert.equal(proof(costlier).commitmentScore.attempted,false);assert.deepEqual(dates(costlier.rows),dates(cheaper.rows));
  });
});

test('an incomplete commitment score leaves timely audited cache and its counters intact',async()=>{
  let expireScoring=false;
  let clock=0;
  // Advancing from the helper must persist into the final planner gate.
  const clockNow=()=>{if(expireScoring&&new Error().stack.includes('commitment-slack-v11.js'))clock=201;return clock;};
  await using({servicePath:fixturePath,now:clockNow},async planner=>{
    const s=commitmentScene(),first=await planner(withReply(s,committedTrips),opts({timeBudgetMs:200}));
    expireScoring=true;
    const retained=await planner(withReply(s,lessCommittedTrips),opts({timeBudgetMs:200})),selection=proof(retained);
    assert.deepEqual(dates(retained.rows),dates(first.rows));assert.equal(retained.status,'feasible');
    assert.equal(selection.commitmentScore.complete,false);assert.equal(selection.commitmentScore.beforeM,null);
    assert.equal(selection.commitmentScore.selectedM,null);assert.equal(selection.nativeGate.acceptedAtMs,null);
    assert.equal(retained.plannerMetadata.commitmentReplacementCount,0);assert.equal(retained.plannerMetadata.tieRetainedCount,0);
    assert.equal(selection.changedEventCount,0);assert.equal(selection.selectedSource,'cached_incumbent');
  });
});

test('completed lower-M proposal scored after deadline never changes selectedM, cache or counters',async()=>{
  let enable=false,clock=0,finished=0;
  const now=()=>{
    if(enable){
      const stack=new Error().stack;
      if(stack.includes('at finish ')&&stack.includes('commitment-slack-v11.js')){finished++;return 0;}
      if(finished>=2)clock=201;
    }
    return clock;
  };
  await using({servicePath:fixturePath,now},async planner=>{
    const s=commitmentScene(),first=await planner(withReply(s,committedTrips),opts({timeBudgetMs:200}));
    enable=true;
    const retained=await planner(withReply(s,lessCommittedTrips),opts({timeBudgetMs:200})),selection=proof(retained),scoring=selection.commitmentScore;
    assert.equal(scoring.complete,true);assert.equal(scoring.beforeM,2);assert.equal(scoring.proposalM,1);assert.equal(scoring.timely,false);
    assert.deepEqual(dates(retained.rows),dates(first.rows));assert.equal(scoring.selectedM,2);
    assert.equal(selection.nativeGate.outcome,'late_candidate');assert.equal(selection.nativeGate.acceptedAtMs,null);
    assert.equal(selection.selectedSource,'cached_incumbent');assert.equal(selection.changedEventCount,0);
    assert.equal(retained.plannerMetadata.commitmentReplacementCount,0);assert.equal(retained.plannerMetadata.strictReplacementCount,0);assert.equal(retained.plannerMetadata.tieRetainedCount,0);
  });
});

test('prototype-name box ids remain isolated through consecutive planner tie scores',async()=>{
  const watched=[Object,Object.prototype,Object.prototype.toString],before=watched.map(value=>Object.getOwnPropertyDescriptors(value));
  for(const id of ['constructor','__proto__','toString']){
    await using({servicePath:fixturePath},async planner=>{
      const s=freeTiny({containers:[{...freeTiny().containers[0],id,unloadDays:2}]});
      const first=await planner(withReply(s,[[0,0,2]]),opts());
      const second=await planner(withReply(s,[[2,2,4]]),opts());
      assert.equal(first.status,'optimal');assert.equal(second.status,'optimal');
      assert.equal(proof(second).commitmentScore.beforeM,1);assert.equal(proof(second).commitmentScore.proposalM,0);
      assert.equal(proof(second).decisionReason,'equal_fee_lower_mandatory_warehouse');
      const third=await planner(withReply(s,[[2,2,4]]),opts());
      assert.equal(proof(third).commitmentScore.beforeM,0);assert.equal(proof(third).commitmentScore.proposalM,0);
      assert.equal(proof(third).decisionReason,'retain_fee_tie_no_lower_mandatory_warehouse');
    });
  }
  watched.forEach((value,index)=>assert.deepEqual(Object.getOwnPropertyDescriptors(value),before[index]));
});

const noNativeReply={status:'time_limit',solverStatus:1,hasIncumbent:false,rows:[]};
const constructorFor=trips=>(s,o)=>{
  const candidate={status:'feasible',rows:s.containers.map((c,i)=>rowFor(s,c,...trips[i]))};
  o.onCandidate(candidate);return candidate;
};
const noNative=s=>({...s,nativeFixture:{reply:noNativeReply}});
const seededProof=result=>proof(result).constructorDelivery;

test('timely synchronous complete constructor survives a native timeout and has an auditable receipt',async()=>{
  await using({servicePath:fixturePath,constructorBudgetMs:40,seedConstructor:constructorFor([[0,0,1]])},async planner=>{
    const s=tiny(),result=await planner(noNative(s),opts({timeBudgetMs:200})),receipt=seededProof(result).events[0];
    assert.equal(result.status,'feasible');assert.equal(result.policy,'seededHiGHSV12');assert.equal(result.plannerMetadata.candidateSource,'quick_constructor');
    assert.equal(receipt.outcome,'accepted');assert.ok(receipt.receivedAtMs<=receipt.copiedAtMs);assert.ok(receipt.copiedAtMs<=receipt.auditFinishedAtMs);
    assert.ok(receipt.auditFinishedAtMs<=receipt.selectionFinishedAtMs);assert.ok(receipt.selectionFinishedAtMs<=receipt.acceptedAtMs);assert.ok(receipt.acceptedAtMs<=40);
    assert.deepEqual(receipt.dates,dates(result.rows));assert.equal(receipt.fees.incrementalCost,result.incrementalCost);
    assert.equal(proof(result).preNativeIncumbent.source,'quick_constructor');assert.deepEqual(proof(result).preNativeIncumbent.dates,dates(result.rows));
    assert.equal(seededProof(result).returnedResultUsedAsReceipt,false);assert.equal(result.plannerMetadata.acceptedConstructorReceipts,1);
  });
});

test('costlier native cannot overwrite a constructor incumbent when cacheValid is false',async()=>{
  await using({servicePath:fixturePath,constructorBudgetMs:40,seedConstructor:constructorFor([[0,0,1]])},async planner=>{
    const s=tiny(),result=await planner(withReply(s,[[3,3,4]]),opts({timeBudgetMs:200}));
    assert.equal(proof(result).cacheValid,false);assert.equal(proof(result).decisionReason,'retain_costlier_native');
    assert.equal(result.rows[0].pickupDay,0);assert.equal(result.plannerMetadata.candidateSource,'quick_constructor');
    assert.ok(proof(result).nativeCostMinusIncumbentKRW>0);assert.equal(result.plannerMetadata.strictReplacementCount,0);
  });
});

test('native strict fee improvement and equal-fee lower M compare against the seeded incumbent',async()=>{
  await using({servicePath:fixturePath,constructorBudgetMs:40,seedConstructor:constructorFor([[3,3,4]])},async planner=>{
    const s=tiny(),result=await planner(withReply(s,[[0,0,1]]),opts({timeBudgetMs:200}));
    assert.equal(proof(result).decisionReason,'strict_fee_replacement');assert.equal(result.plannerMetadata.candidateSource,'native_highs');
    assert.ok(proof(result).nativeCostMinusIncumbentKRW<0);
  });
  await using({servicePath:fixturePath,constructorBudgetMs:40,seedConstructor:constructorFor(committedTrips)},async planner=>{
    const s=commitmentScene(),result=await planner(withReply(s,lessCommittedTrips),opts({timeBudgetMs:200}));
    assert.equal(proof(result).cacheValid,false);assert.equal(proof(result).decisionReason,'equal_fee_lower_mandatory_warehouse');
    assert.equal(proof(result).commitmentScore.beforeM,2);assert.equal(proof(result).commitmentScore.proposalM,1);assert.equal(result.plannerMetadata.commitmentReplacementCount,1);
  });
});

test('a constructor return without an actual callback receipt never becomes a backdated seed',async()=>{
  await using({servicePath:fixturePath,constructorBudgetMs:40,seedConstructor:(s,o)=>({status:'feasible',rows:[rowFor(s,s.containers[0],0,0,1)],constructorMetadata:{firstIncumbentMs:0}})},async planner=>{
    const result=await planner(noNative(tiny()),opts({timeBudgetMs:200}));
    assert.equal(result.rows.length,0);assert.equal(result.totalCost,null);assert.equal(seededProof(result).events.length,0);
    assert.equal(result.plannerMetadata.stages.quickConstructor.returnedCompleteCandidate,true);assert.equal(result.plannerMetadata.stages.quickConstructor.returnedCandidateAccepted,false);
  });
});

test('shared deadline includes constructor and native gets only the remainder, never a fresh 200ms',async()=>{
  let clock=0;
  await using({constructorBudgetMs:40,now:()=>clock,seedConstructor:(s,o)=>{
    assert.equal(o.deadlineMs,40);assert.equal(o.timeBudgetMs,40);clock=25;o.onCandidate({status:'feasible',rows:[rowFor(s,s.containers[0],0,0,1)]});clock=40;
    return {status:'feasible',rows:[rowFor(s,s.containers[0],0,0,1)]};
  }},async planner=>{
    const result=await planner(noNative(tiny()),opts({timeBudgetMs:200}));
    assert.equal(result.plannerMetadata.wallTimeMs,40);assert.equal(seededProof(result).firstAcceptedAtMs,25);
    // requestService records the same outer deadline after construction. The
    // real independent service exposes actual model/solve remaining separately.
    assert.equal(seededProof(result).deadlineAtMs,40);assert.equal(proof(result).preNativeIncumbent.acceptedAtMs,25);
    assert.equal(result.plannerMetadata.solverCalls,1);
    assert.ok(result.plannerMetadata.nativeCertificate.remainingBudgetAtReceiptMs<=161);
    assert.ok(result.plannerMetadata.nativeCertificate.solverTimeLimitMs<=158);
  });
});

test('constructor callback copy and acceptance must fit its own cap within the total call allowance',async()=>{
  let clock=0;
  await using({servicePath:fixturePath,constructorBudgetMs:40,now:()=>clock,seedConstructor:(s,o)=>{
    clock=35;const candidate={status:'feasible'};
    Object.defineProperty(candidate,'rows',{enumerable:true,get:()=>{clock=41;return [rowFor(s,s.containers[0],0,0,1)];}});
    o.onCandidate(candidate);return {status:'feasible',rows:[rowFor(s,s.containers[0],0,0,1)],constructorMetadata:{firstIncumbentMs:1}};
  }},async planner=>{
    const result=await planner(noNative(tiny()),opts({timeBudgetMs:200}));
    assert.equal(result.rows.length,0);assert.equal(seededProof(result).events[0].outcome,'late_copy');
    assert.equal(seededProof(result).firstAcceptedAtMs,null);assert.equal(result.plannerMetadata.acceptedConstructorReceipts,0);
  });
});

test('optional constructor overrun cannot erase a seed already fully accepted before its deadline',async()=>{
  let clock=0;
  await using({servicePath:fixturePath,constructorBudgetMs:40,now:()=>clock,seedConstructor:(s,o)=>{
    clock=10;o.onCandidate({status:'feasible',rows:[rowFor(s,s.containers[0],0,0,1)]});clock=210;
    return {status:'time_limit',rows:[]};
  }},async planner=>{
    const result=await planner(noNative(tiny()),opts({timeBudgetMs:200}));
    assert.equal(result.status,'feasible');assert.equal(result.rows[0].pickupDay,0);assert.equal(seededProof(result).firstAcceptedAtMs,10);
    assert.equal(result.plannerMetadata.solverCalls,0);assert.equal(result.plannerMetadata.deadlineOverrunMs,10);assert.equal(result.plannerMetadata.stages.native.status,'budget_skipped');
  });
});

test('late native result leaves the prior complete seeded dates and fees untouched',async()=>{
  await using({servicePath:fixturePath,constructorBudgetMs:40,seedConstructor:constructorFor([[0,0,1]])},async planner=>{
    const s=tiny(),result=await planner({...s,nativeFixture:{delayMs:60,reply:reply(s,[[1,1,2]])}},opts({timeBudgetMs:45}));
    assert.equal(result.status,'feasible');assert.equal(result.plannerMetadata.candidateSource,'quick_constructor');
    assert.equal(result.rows[0].pickupDay,0);assert.equal(proof(result).nativeGate.outcome,'late_candidate');
    assert.equal(result.plannerMetadata.stages.native.lateCandidateDiscarded,true);assert.ok(result.plannerMetadata.deadlineOverrunMs>0);
  });
});

test('constructor input mutations and forged fees cannot alter public capacities, history or canonical price',async()=>{
  await using({servicePath:fixturePath,constructorBudgetMs:40,seedConstructor:(s,o)=>{
    s.truckCapacity[0]=999;delete o.fixedEvents.A;
    const forged={status:'feasible',rows:[{id:'A',pickupDay:0,unloadDay:0,returnDay:1,totalCost:-1,incrementalCost:-1}]};o.onCandidate(forged);return forged;
  }},async planner=>{
    const s=tiny({truckCapacity:[0,2,2,2,2,2]}),before=structuredClone(s),result=await planner(noNative(s),opts({timeBudgetMs:200}));
    assert.equal(result.rows.length,0);assert.equal(seededProof(result).events[0].outcome,'invalid_candidate');assert.deepEqual(s,before);
  });
  await using({servicePath:fixturePath,constructorBudgetMs:40,seedConstructor:(s,o)=>{const c={status:'feasible',rows:[{id:'A',pickupDay:0,unloadDay:0,returnDay:1,totalCost:-1,incrementalCost:-1}]};o.onCandidate(c);return c;}},async planner=>{
    const s=tiny(),result=await planner(noNative(s),opts({timeBudgetMs:200}));assert.ok(result.incrementalCost>0);assert.equal(result.incrementalCost,rowFor(s,s.containers[0],0,0,1).incrementalCost);
  });
});

test('valid cache skips construction; an invalid current cache can receive a separately audited recovery seed',async()=>{
  let calls=0;
  await using({servicePath:fixturePath,constructorBudgetMs:40,seedConstructor:(s,o)=>{calls++;return constructorFor([[calls===1?0:1,calls===1?0:1,calls===1?1:2]])(s,o);}},async planner=>{
    const s=tiny(),first=await planner(noNative(s),opts({timeBudgetMs:200}));
    const kept=await planner(noNative(s),opts({timeBudgetMs:200}));assert.equal(calls,1);assert.equal(kept.plannerMetadata.stages.quickConstructor.status,'valid_cache_skip');
    const updated={...s,truckCapacity:[0,2,2,2,2,2]},recovered=await planner(noNative(updated),opts({timeBudgetMs:200}));
    assert.equal(calls,2);assert.equal(recovered.status,'feasible');assert.equal(recovered.rows[0].pickupDay,1);assert.equal(proof(recovered).cacheValid,false);
  });
});

test('constructor phase ignores late asynchronous callbacks after it has returned',async()=>{
  let delayed;
  await using({servicePath:fixturePath,constructorBudgetMs:40,seedConstructor:(s,o)=>{
    delayed=()=>o.onCandidate({status:'feasible',rows:[rowFor(s,s.containers[0],0,0,1)]});
    return {status:'time_limit',rows:[]};
  }},async planner=>{
    const result=await planner(noNative(tiny()),opts({timeBudgetMs:200}));
    assert.equal(result.rows.length,0);assert.equal(delayed(),false);
    assert.equal(result.plannerMetadata.acceptedConstructorReceipts,0);
  });
});

test('prototype-name ids remain isolated in constructor receipts and preserve strict execution locks',async()=>{
  const globals=[Object,Object.prototype,Object.prototype.toString],before=globals.map(value=>Object.getOwnPropertyDescriptors(value));
  for(const id of ['constructor','__proto__','toString']){
    await using({servicePath:fixturePath,constructorBudgetMs:40,seedConstructor:constructorFor([[0,0,3]])},async planner=>{
      const s=tiny({stagingCapacity:2,operations:{stagingUnit:'teu'},containers:[{...tiny().containers[0],id,sizeFt:40,unloadDays:3}]}),fixed=Object.fromEntries([[id,{pickupDay:0,unloadDay:0}]]);
      const result=await planner(noNative(s),opts({timeBudgetMs:200,minEventDay:1,fixedEvents:fixed}));
      assert.equal(result.status,'feasible');assert.equal(result.usage[1].warehouse,1);assert.equal(result.usage[1].staging,2);assert.equal(result.rows[0].returnDay,3);
      assert.equal(seededProof(result).events[0].outcome,'accepted');
    });
  }
  globals.forEach((value,i)=>assert.deepEqual(Object.getOwnPropertyDescriptors(value),before[i]));
});

test('actual deterministic V9 construction works through timely receipt with native disabled by failure',async()=>{
  await using({servicePath:fixturePath,constructorBudgetMs:40},async planner=>{
    const s=tiny(),result=await planner(noNative(s),opts({timeBudgetMs:200}));
    assert.equal(result.status,'feasible');assert.equal(result.plannerMetadata.candidateSource,'quick_constructor');assert.ok(seededProof(result).events.some(e=>e.outcome==='accepted'));
    assert.equal(auditSchedule(s,result.rows).valid,true);assert.equal(result.plannerMetadata.stages.quickConstructor.constructorMetadata.maxRestarts,3);
  });
});

test('private future-event payloads reject before construction and invalid constructor configuration rejects',async()=>{
  const planner=createSeededCommitmentHiGHSPlannerV12({constructorBudgetMs:40,seedConstructor:()=>{throw new Error('must not run');}});
  try{
    await assert.rejects(planner({...tiny(),events:[]},opts()),/private future-event/);
    await assert.rejects(planner(tiny(),opts({futureEvents:[]})),/private future-event/);
  }finally{await planner.close();}
  for(const settings of [{constructorBudgetMs:-1},{constructorAuditReserveMs:-1},{maxRestarts:129},{seedConstructor:null}])assert.throws(()=>createSeededCommitmentHiGHSPlannerV12(settings));
});
