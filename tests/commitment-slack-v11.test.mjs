import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreCommitmentSlackV11} from '../src/commitment-slack-v11.js';

const box=(id,extra={})=>({id,sizeFt:20,dischargeDateTime:'2026-10-13T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:4,dataOrigin:'synthetic',...extra});
const scene=(extra={})=>({id:'v11-handwritten',horizonStart:'2026-10-13',horizonDays:6,truckCapacity:6,warehouseCapacity:3,stagingCapacity:6,containers:[box('A')],...extra});
const row=(id,p,u,r)=>({id,pickupDay:p,unloadDay:u,returnDay:r});
const score=(s,rows,options={})=>scoreCommitmentSlackV11(s,rows,{minEventDay:0,fixedEvents:{},...options});

test('today shadow commitments distinguish a necessary tomorrow deadline from avoidable future unloading',()=>{
  const s=scene({containers:[box('A',{dueDay:1}),box('B',{unloadDays:2,dueDay:4})]});
  const cache=score(s,[row('A',1,1,2),row('B',0,0,2)]),proposal=score(s,[row('A',1,1,2),row('B',2,2,4)]);
  assert.equal(cache.complete,true);assert.equal(cache.mandatoryWarehouseTomorrow,2);
  assert.equal(proposal.complete,true);assert.equal(proposal.mandatoryWarehouseTomorrow,1);
  assert.deepEqual(cache.shadowFixedEvents,{B:{pickupDay:0,unloadDay:0}});
  assert.deepEqual(proposal.shadowFixedEvents,{});assert.equal(proposal.shadowMinEventDay,1);
  assert.equal(proposal.containers.find(c=>c.id==='B').mandatoryWarehouseTomorrow,0);
  assert.ok(proposal.containers.find(c=>c.id==='B').avoidanceWitness);
});

test('load sums every box, so postponing one while committing another does not create fake improvement',()=>{
  const s=scene({containers:[box('A',{dueDay:1}),box('B',{unloadDays:2}),box('C',{unloadDays:2})]});
  const a=score(s,[row('A',1,1,2),row('B',0,0,2),row('C',2,2,4)]);
  const b=score(s,[row('A',1,1,2),row('B',2,2,4),row('C',0,0,2)]);
  assert.equal(a.mandatoryWarehouseTomorrow,2);assert.equal(b.mandatoryWarehouseTomorrow,2);
  assert.equal(b.containers.length,3);
});

test('started historical unloading cannot disappear and must occupy every remaining completion day',()=>{
  const s=scene({containers:[box('A',{unloadDays:3})]});
  const fixed={A:{pickupDay:0,unloadDay:0}};
  const result=score(s,[row('A',0,0,3)],{minEventDay:1,fixedEvents:fixed});
  assert.equal(result.tomorrow,2);assert.equal(result.mandatoryWarehouseTomorrow,1);
  assert.equal(result.containers[0].occupiesTomorrowCount,result.containers[0].legalTripCount);
  assert.throws(()=>score(s,[row('A',0,2,5)],{minEventDay:1,fixedEvents:fixed}),/changed executed/);
});

test('today pickup and return enter shadow locks while tomorrow future actions stay unfixed',()=>{
  const s=scene({containers:[box('A'),box('B')]});
  const result=score(s,[row('A',0,0,2),row('B',0,0,1)]);
  assert.deepEqual(result.shadowFixedEvents,{A:{pickupDay:0,unloadDay:0},B:{pickupDay:0,unloadDay:0}});
  assert.equal(Object.hasOwn(result.shadowFixedEvents.B,'returnDay'),false);
  const after=score(s,[row('A',0,0,2),row('B',0,0,1)],{minEventDay:1,fixedEvents:{A:{pickupDay:0,unloadDay:0},B:{pickupDay:0,unloadDay:0}}});
  assert.equal(after.shadowFixedEvents.B.returnDay,1);
  assert.equal(Object.hasOwn(after.shadowFixedEvents.A,'returnDay'),false);
});

test('40ft staging uses TEU, same-day return is half-open, and both moves remain counted',()=>{
  const same=scene({stagingCapacity:0,truckCapacity:2,warehouseCapacity:1,operations:{returnLagDays:0,stagingUnit:'teu'},containers:[box('A',{sizeFt:40})]});
  const result=score(same,[row('A',0,0,0)]);assert.equal(result.mandatoryWarehouseTomorrow,0);
  assert.equal(result.containers[0].stagingWeight,2);assert.deepEqual(result.shadowFixedEvents.A,{pickupDay:0,unloadDay:0,returnDay:0});
  assert.throws(()=>score({...same,truckCapacity:1},[row('A',0,0,0)]),/truck capacity/);
  assert.throws(()=>score({...same,operations:{returnLagDays:1,stagingUnit:'teu'},stagingCapacity:1},[row('A',0,0,1)]),/staging capacity/);
});

test('a single-box domain respects public transport and staging closures without seeing unannounced shocks',()=>{
  const s=scene({containers:[box('A',{releaseDay:1,dueDay:3})],truckCapacity:[2,1,0,2,2,2],warehouseCapacity:[1,1,0,0,0,0],stagingCapacity:1});
  const result=score(s,[row('A',1,1,3)]);
  assert.equal(result.mandatoryWarehouseTomorrow,1);
  const changed=score({...s,events:[{revealDay:1,warehouseCapacity:0,duration:99}],actualScenario:{warehouseCapacity:0}},[row('A',1,1,3)]);
  assert.deepEqual(changed.publicCapacities,result.publicCapacities);assert.equal(changed.mandatoryWarehouseTomorrow,result.mandatoryWarehouseTomorrow);
  assert.equal(changed.usesUnannouncedFutureEvents,false);
});

test('all completed boxes and tomorrow beyond the horizon have zero forced warehouse without deleting history',()=>{
  const s=scene({operations:{returnLagDays:0}}),fixed={A:{pickupDay:0,unloadDay:0,returnDay:0}};
  const result=score(s,[row('A',0,0,0)],{minEventDay:5,fixedEvents:fixed});
  assert.equal(result.complete,true);assert.equal(result.mandatoryWarehouseTomorrow,0);
  assert.equal(result.tomorrowInsideHorizon,false);assert.equal(result.publicWarehouseCapacityTomorrow,null);
  assert.deepEqual(result.shadowFixedEvents,fixed);assert.equal(result.containers[0].legalTripCount,1);
});

test('due days are unload completion deadlines and return lag changes legal tail dates',()=>{
  const s=scene({containers:[box('A',{releaseDay:1,unloadDays:2,dueDay:2})]});
  const result=score(s,[row('A',1,1,3)]);
  assert.equal(result.mandatoryWarehouseTomorrow,1);
  assert.ok(result.containers[0].legalTripCount>0);
  assert.throws(()=>score(s,[row('A',1,2,4)]),/illegal/);
  assert.throws(()=>score(s,[row('A',1,1,2)]),/illegal/);
  const lag0=score({...s,operations:{returnLagDays:0}},[row('A',1,1,2)]);
  assert.equal(lag0.complete,true);
});

test('expired and partially completed scores remain incomplete with null M',()=>{
  const s=scene({containers:[box('A'),box('B',{unloadDays:2})]}),rows=[row('A',1,1,2),row('B',2,2,4)];
  const expired=score(s,rows,{now:()=>10,deadlineMs:10});assert.equal(expired.complete,false);assert.equal(expired.mandatoryWarehouseTomorrow,null);
  let tick=0;const partial=score(s,rows,{now:()=>tick++,deadlineMs:30});
  assert.equal(partial.complete,false);assert.equal(partial.status,'time_limit');assert.equal(partial.mandatoryWarehouseTomorrow,null);
  assert.equal(partial.mandatoryWarehouseLoad,null);
});

test('inputs and returned candidate/shadow/capacity traces cannot mutate each other',()=>{
  const s=scene(),rows=[row('A',0,0,2)],fixed={},before=structuredClone({s,rows,fixed});
  const result=score(s,rows,{fixedEvents:fixed});
  assert.deepEqual({s,rows,fixed},before);
  result.shadowFixedEvents.A.pickupDay=5;result.candidateDates[0].pickupDay=5;result.publicCapacities.truck[0]=999;
  assert.deepEqual({s,rows,fixed},before);
  rows[0].pickupDay=4;assert.equal(result.containers[0].shadowLocks.pickupDay,0);
});

test('malformed/missing/duplicate dates, future locks and unit errors reject instead of inventing M',()=>{
  for(const rows of [[],[null],[row('unknown',0,0,1)],[row('A',0,Infinity,1)],[row('A',0,0,99)]])assert.throws(()=>score(scene(),rows));
  assert.throws(()=>score(scene(),[row('A',0,0,1)],{minEventDay:1,fixedEvents:{A:{pickupDay:1}}}),/precede/);
  assert.throws(()=>score(scene(),[row('A',0,0,1)],{minEventDay:1,fixedEvents:{A:{pickupDay:0}}}),/unexecuted event/);
  assert.throws(()=>score(scene({operations:{stagingUnit:'ton'}}),[row('A',0,0,1)]));
  assert.throws(()=>score(scene({truckCapacity:new Array(6)}),[row('A',0,0,1)]));
});

test('valid container ids matching object property names keep their own shadow history',()=>{
  for(const id of ['__proto__','constructor','toString']){
    const s=scene({containers:[box(id,{unloadDays:2})]});
    const result=score(s,[row(id,0,0,2)]);
    assert.equal(Object.hasOwn(result.shadowFixedEvents,id),true);
    assert.deepEqual(result.shadowFixedEvents[id],{pickupDay:0,unloadDay:0});
    assert.equal(result.mandatoryWarehouseTomorrow,1);assert.equal(result.containers[0].id,id);
    assert.equal(Object.getPrototypeOf(result.shadowFixedEvents),Object.prototype);
  }
});

test('prototype-name ids stay independent across consecutive calls and never write global objects',()=>{
  const globalObjects=[Object,Object.prototype,Object.prototype.toString];
  const before=globalObjects.map(value=>Object.getOwnPropertyDescriptors(value));
  for(const id of ['constructor','__proto__','toString']){
    const s=scene({containers:[box(id,{unloadDays:2})]}),first=score(s,[row(id,0,0,2)]);
    assert.equal(first.mandatoryWarehouseTomorrow,1);
    const second=score(s,[row(id,2,2,4)]);
    assert.equal(second.mandatoryWarehouseTomorrow,0);
    assert.deepEqual(second.shadowFixedEvents,{});
    assert.equal(second.containers[0].shadowLocks.pickupDay,undefined);
    first.shadowFixedEvents[id].pickupDay=5;
    const third=score(s,[row(id,2,2,4)]);
    assert.equal(third.mandatoryWarehouseTomorrow,0);assert.deepEqual(third.shadowFixedEvents,{});
  }
  globalObjects.forEach((value,index)=>assert.deepEqual(Object.getOwnPropertyDescriptors(value),before[index]));
});

test('inherited container locks and inherited event fields never become execution history',()=>{
  for(const id of ['A','constructor','__proto__','toString']){
    const s=scene({containers:[box(id,{unloadDays:2})]});
    const inherited=Object.create(Object.fromEntries([[id,{pickupDay:0,unloadDay:0}]]));
    const result=score(s,[row(id,2,2,4)],{minEventDay:1,fixedEvents:inherited});
    assert.equal(result.complete,true);assert.deepEqual(result.shadowFixedEvents,{});assert.equal(result.mandatoryWarehouseTomorrow,0);
    assert.throws(()=>score(s,[row(id,0,0,2)],{minEventDay:1,fixedEvents:inherited}),/unexecuted event/);
    const inheritedEvents=Object.fromEntries([[id,Object.create({pickupDay:0,unloadDay:0})]]);
    const again=score(s,[row(id,2,2,4)],{minEventDay:1,fixedEvents:inheritedEvents});
    assert.equal(again.complete,true);assert.deepEqual(again.shadowFixedEvents,Object.fromEntries([[id,{}]]));
    assert.throws(()=>score(s,[row(id,0,0,2)],{minEventDay:1,fixedEvents:inheritedEvents}),/unexecuted event/);
  }
});
