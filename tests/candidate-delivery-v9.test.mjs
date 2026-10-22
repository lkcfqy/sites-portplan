import test from 'node:test';
import assert from 'node:assert/strict';
import {rowFor,summarize,auditSchedule} from '../src/engine.js';
import {createCandidateDeliveryGateV9} from '../src/candidate-delivery-v9.js';
import {createAdaptivePlannerV9} from '../src/adaptive-planner-v9.js';
import {solveLockedConstructorV9} from '../src/locked-recovery-v9.js';

const tiny=(extra={})=>({id:'v9-delivery-handwritten',horizonStart:'2026-10-13',horizonDays:6,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,
  containers:[{id:'A',sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:4,dataOrigin:'synthetic'}],...extra});
const candidate=(s,trip=[2,2,4])=>summarize(s,'fixture',s.containers.map(c=>rowFor(s,c,...trip)),0,'feasible');
const dates=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const options={minEventDay:0,fixedEvents:{},objectiveMode:'joint',timeBudgetMs:200};
const noMILP=()=>({status:'time_limit',rows:[]});

test('first timely outer receipt survives a cheaper MILP returned after 200ms',async()=>{
  let clock=0;
  const s=tiny(),expected=dates(candidate(s).rows);
  const result=await createAdaptivePlannerV9({now:()=>clock,maxPasses:0,
    seedConstructor:(snapshot,o)=>{clock=11;o.onCandidate(candidate(snapshot));clock=79;return candidate(snapshot);},
    solver:snapshot=>{clock=219;return candidate(snapshot,[0,0,1]);}})(s,options);
  assert.equal(result.status,'feasible');assert.deepEqual(dates(result.rows),expected);
  assert.equal(result.plannerMetadata.incumbentAcceptedAtMs,11);
  assert.equal(result.plannerMetadata.deadlineOverrunMs,19);
  const delivery=result.plannerMetadata.candidateDelivery;
  assert.equal(delivery.events[0].source,'locked_constructor');assert.equal(delivery.events[0].acceptedAtMs,11);
  assert.equal(delivery.events.at(-1).outcome,'rejected_late_receipt');assert.equal(delivery.selectedCandidateSequence,1);assert.equal(delivery.closed,true);
});

test('an internal firstIncumbentMs claim cannot backdate a late actual candidate',async()=>{
  let clock=0;const s=tiny();
  const result=await createAdaptivePlannerV9({now:()=>clock,maxPasses:0,solver:noMILP,
    seedConstructor:snapshot=>{clock=219;return {...candidate(snapshot),constructorMetadata:{firstIncumbentMs:1}};}})(s,options);
  assert.equal(result.status,'no_feasible_schedule_found');assert.equal(result.totalCost,null);
  const event=result.plannerMetadata.candidateDelivery.events[0];
  assert.equal(event.receivedAtMs,219);assert.equal(event.outcome,'rejected_late_receipt');assert.equal(event.acceptedAtMs,null);
});

test('a callback that first runs after the deadline is rejected even with a forged early timestamp',async()=>{
  let clock=0;const s=tiny();
  const result=await createAdaptivePlannerV9({now:()=>clock,maxPasses:0,solver:noMILP,
    seedConstructor:(snapshot,o)=>{clock=205;o.onCandidate({...candidate(snapshot),constructorMetadata:{firstIncumbentMs:0}});return noMILP();}})(s,options);
  assert.equal(result.status,'no_feasible_schedule_found');assert.equal(result.plannerMetadata.candidateDelivery.events[0].outcome,'rejected_late_receipt');
});

test('optional constructor work or solver exceptions cannot erase a timely independent incumbent',async()=>{
  let clock=0;const s=tiny();
  const result=await createAdaptivePlannerV9({now:()=>clock,maxPasses:0,
    seedConstructor:(snapshot,o)=>{clock=20;o.onCandidate(candidate(snapshot));throw new Error('optional restart fixture');},
    solver:()=>{clock=220;throw new Error('late solve fixture');}})(s,options);
  assert.equal(result.status,'feasible');assert.equal(result.plannerMetadata.incumbentAcceptedAtMs,20);
  assert.equal(result.plannerMetadata.stages.locked_constructor.status,'constructor_error');assert.equal(result.plannerMetadata.stages.locked_milp.status,'solver_error');
});

test('isolated delivery survives later mutation of the constructor candidate and snapshot',async()=>{
  const s=tiny(),before=structuredClone(s);let proposal;
  const result=await createAdaptivePlannerV9({now:()=>0,maxPasses:0,solver:noMILP,
    seedConstructor:(snapshot,o)=>{proposal=candidate(snapshot);o.onCandidate(proposal);proposal.rows[0].returnDay=99;snapshot.truckCapacity=99;return noMILP();}})(s,options);
  assert.equal(result.rows[0].returnDay,4);assert.equal(auditSchedule(s,result.rows).valid,true);assert.deepEqual(s,before);
  const event=result.plannerMetadata.candidateDelivery.events[0];assert.equal(event.dates[0].returnDay,4);
});

test('copy time is charged to the outer deadline and late copying cannot create a first incumbent',()=>{
  let clock=0;const s=tiny(),plain=candidate(s),proposal={status:'feasible'};
  Object.defineProperty(proposal,'rows',{enumerable:true,get(){clock=201;return plain.rows;}});
  const gate=createCandidateDeliveryGateV9({scenario:s,options,started:0,deadlineMs:200,now:()=>clock});
  const receipt=gate.offer(proposal,'locked_constructor');
  assert.equal(receipt.accepted,false);assert.equal(receipt.event.receivedAtMs,0);assert.equal(receipt.event.copyCompletedAtMs,201);
  assert.equal(receipt.event.outcome,'rejected_late_copy');assert.deepEqual(receipt.event.proposedDates,dates(plain.rows));assert.equal(gate.best(),null);
});

test('a physically valid candidate whose outer audit completes late is not accepted',()=>{
  const s=tiny(),ticks=[10,11,12,201];let tick=0;
  const gate=createCandidateDeliveryGateV9({scenario:s,options,started:0,deadlineMs:200,now:()=>ticks[tick++]??201});
  const receipt=gate.offer(candidate(s),'locked_constructor');
  assert.equal(receipt.event.audit.scheduleValid,true);assert.equal(receipt.event.audit.freezeValid,true);
  assert.equal(receipt.event.auditCompletedAtMs,201);assert.equal(receipt.event.outcome,'rejected_late_audit');assert.equal(gate.best(),null);
});

test('policy selection time is charged and a late guarded improvement preserves the accepted baseline',()=>{
  let clock=0;const s=tiny(),gate=createCandidateDeliveryGateV9({scenario:s,options,started:0,deadlineMs:200,now:()=>clock});
  assert.equal(gate.offer(candidate(s),'cache').accepted,true);
  const receipt=gate.offer(candidate(s,[0,0,1]),'adaptive_polish',{select:()=>{clock=201;return true;}});
  assert.equal(receipt.event.outcome,'rejected_late_selection');assert.equal(gate.best().rows[0].returnDay,4);
  assert.equal(gate.metadata().selectedCandidateSequence,1);
});

test('independent canonical prices replace forged negative costs and preserve joint-fee nonincrease',()=>{
  const s=tiny(),gate=createCandidateDeliveryGateV9({scenario:s,options,started:0,deadlineMs:200,now:()=>0});
  const first=candidate(s,[0,0,1]);first.totalCost=-1;first.incrementalCost=-1;first.rows[0].totalCost=-1;
  gate.offer(first,'locked_constructor');const expected=gate.best().incrementalCost;
  const worse=candidate(s,[2,2,4]);worse.incrementalCost=-100000;
  assert.equal(gate.offer(worse,'recovery_polish').accepted,false);assert.equal(gate.best().incrementalCost,expected);assert.ok(expected>0);
});

test('all received invalid proposals retain dates for independent rejection review',()=>{
  const s=tiny(),gate=createCandidateDeliveryGateV9({scenario:s,options,started:0,deadlineMs:200,now:()=>0});
  for(const rows of [[{id:'A',pickupDay:0,unloadDay:0,returnDay:0}],[null],[{id:'unknown',pickupDay:0,unloadDay:0,returnDay:1}]]) {
    const receipt=gate.offer({status:'feasible',rows},'locked_constructor');assert.equal(receipt.accepted,false);assert.deepEqual(receipt.event.proposedDates,rows);
  }
  assert.equal(gate.best(),null);
});

test('current history and ongoing unloading capacity are audited before callback acceptance',()=>{
  const s=tiny({warehouseCapacity:[1,1,0,1,1,1],containers:[{...tiny().containers[0],unloadDays:3}]}),o={...options,minEventDay:2,fixedEvents:{A:{pickupDay:0,unloadDay:0}}};
  const gate=createCandidateDeliveryGateV9({scenario:s,options:o,started:0,deadlineMs:200,now:()=>0});
  const ongoing=gate.offer(candidate(s,[0,0,4]),'locked_constructor');assert.equal(ongoing.event.audit.scheduleValid,false);assert.equal(ongoing.accepted,false);
  const rewritten=gate.offer(candidate(s,[2,2,5]),'locked_milp');assert.equal(rewritten.event.audit.freezeValid,false);assert.equal(rewritten.accepted,false);
});

test('gate closes permanently and diagnostic observers cannot reject or mutate an accepted incumbent',()=>{
  const s=tiny(),gate=createCandidateDeliveryGateV9({scenario:s,options,started:0,deadlineMs:200,now:()=>0,
    onIncumbent:proposal=>{proposal.rows[0].returnDay=99;throw new Error('diagnostic observer');}});
  const receipt=gate.offer(candidate(s),'locked_constructor');assert.equal(receipt.accepted,true);assert.equal(gate.best().rows[0].returnDay,4);
  assert.equal(receipt.event.observerError,'diagnostic observer');gate.close();
  assert.equal(gate.offer(candidate(s,[0,0,1]),'locked_milp').event.outcome,'closed');assert.equal(gate.best().rows[0].returnDay,4);
});

test('owned constructor emits complete incumbents before its final return without changing its search defaults',()=>{
  const s=tiny(),received=[];let returned=false;
  const result=solveLockedConstructorV9(s,{...options,deadlineMs:80,maxRestarts:15,now:()=>0,
    onCandidate:proposal=>{assert.equal(returned,false);assert.equal(auditSchedule(s,proposal.rows).valid,true);received.push(dates(proposal.rows));}});
  returned=true;assert.equal(result.status,'feasible');assert.ok(received.length>0);assert.equal(result.constructorMetadata.maxRestarts,15);
  assert.deepEqual(received.at(-1),dates(result.rows));
});

test('a late optional recovery polish is discarded while its earlier complete seed remains usable',async()=>{
  let clock=0;const s=tiny();
  const result=await createAdaptivePlannerV9({now:()=>clock,solver:noMILP,
    seedConstructor:(snapshot,o)=>{clock=10;o.onCandidate(candidate(snapshot));return candidate(snapshot);},
    polish:snapshot=>{clock=220;return candidate(snapshot,[0,0,1]);}})(s,options);
  assert.equal(result.status,'feasible');assert.equal(result.rows[0].returnDay,4);assert.equal(result.plannerMetadata.incumbentAcceptedAtMs,10);
  assert.equal(result.plannerMetadata.candidateDelivery.events.at(-1).source,'recovery_polish');
  assert.equal(result.plannerMetadata.candidateDelivery.events.at(-1).outcome,'rejected_late_receipt');
});
