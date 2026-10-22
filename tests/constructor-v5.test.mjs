import test from 'node:test';
import assert from 'node:assert/strict';
import {solveFastConstructor} from '../src/fast-constructor-v5.js';
import {auditSchedule} from '../src/engine.js';
import {independentAuditV2} from '../scripts/benchmark-v2.mjs';

const container=(id,extra={})=>({id,sizeFt:20,releaseDay:0,unloadDays:1,dueDay:1,dischargeDateTime:'2026-10-12T07:00:00+09:00',dataOrigin:'synthetic',...extra});
const scenario=(extra={})=>({horizonStart:'2026-10-12',horizonDays:3,truckCapacity:4,warehouseCapacity:2,stagingCapacity:4,containers:[container('one')],...extra});
const check=(s,r)=>{assert.equal(r.status,'feasible');assert.equal(r.auditValid,true);assert.equal(r.rows.length,s.containers.length);assert.equal(auditSchedule(s,r.rows).valid,true);assert.deepEqual(independentAuditV2(s,r),[]);assert.equal(r.optimality,'heuristic');};
const noComplete=r=>{assert.equal(r.status,'no_feasible_schedule_found');assert.deepEqual(r.rows,[]);for(const key of ['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost'])assert.equal(r[key],null);};

test('constructor reserves two truck movements for same-day trips with zero overnight staging',()=>{
  const s=scenario({truckCapacity:[1,2,0],warehouseCapacity:1,stagingCapacity:0,operations:{returnLagDays:0,stagingUnit:'container'}});
  const r=solveFastConstructor(s,{maxRestarts:0});check(s,r);
  assert.deepEqual(r.rows.map(row=>[row.pickupDay,row.unloadDay,row.returnDay]),[[1,1,1]]);
  assert.equal(r.usage[1].truck,2);assert.ok(r.usage.every(day=>day.staging===0));
  noComplete(solveFastConstructor({...s,truckCapacity:[1,1,0]},{maxRestarts:0}));
});

test('individually feasible TEU trips cannot become an invalid complete aggregate plan',()=>{
  const s=scenario({truckCapacity:4,warehouseCapacity:2,stagingCapacity:2,operations:{returnLagDays:1,stagingUnit:'teu'},
    containers:[container('forty',{sizeFt:40,dueDay:0}),container('twenty',{dueDay:0})]});
  noComplete(solveFastConstructor(s,{maxRestarts:3}));
  const target={...s,stagingCapacity:3},r=solveFastConstructor(target,{maxRestarts:3});check(target,r);
  assert.equal(r.usage[0].staging,3);assert.equal(r.usage[1].staging,0);
});

test('constructor checks time-varying warehouse intervals and excludes return day from staging',()=>{
  const s=scenario({horizonDays:6,truckCapacity:[1,1,0,1,0,1],warehouseCapacity:[0,1,1,0,1,1],stagingCapacity:[0,1,1,0,1,1],
    containers:[container('two-days',{unloadDays:2,dueDay:4})]});
  const r=solveFastConstructor(s,{maxRestarts:0});check(s,r);
  assert.deepEqual(r.rows.map(row=>[row.pickupDay,row.unloadDay,row.returnDay]),[[1,1,3]]);
  assert.equal(r.usage[2].warehouse,1);assert.equal(r.usage[2].staging,1);assert.equal(r.usage[3].staging,0);
  noComplete(solveFastConstructor({...s,warehouseCapacity:[0,1,0,0,1,1]},{maxRestarts:0}));
});

test('bounded repair moves a previously selected return without leaving stale resource reservations',()=>{
  const s=scenario({truckCapacity:[1,1,2],warehouseCapacity:1,stagingCapacity:2,
    containers:[container('A',{dueDay:0}),container('B',{releaseDay:1,dueDay:1})]});
  const r=solveFastConstructor(s,{maxRestarts:0});check(s,r);
  assert.deepEqual(r.rows.map(row=>[row.pickupDay,row.unloadDay,row.returnDay]),[[0,0,2],[1,1,2]]);
  assert.equal(r.usage[2].truck,2);assert.equal(r.usage[1].staging,2);assert.ok(r.constructorMetadata.repairAttempts>0);
  assert.ok(r.usage.every(day=>day.truck>=0&&day.warehouse>=0&&day.staging>=0));
});

test('incumbent callbacks are complete audited snapshots and cannot mutate retained state',()=>{
  const s=scenario({containers:[container('aged',{dischargeDateTime:'2026-09-27T07:00:00+09:00'})]});
  let callbacks=0;
  const r=solveFastConstructor(s,{maxRestarts:3,onIncumbent:snapshot=>{
    check(s,snapshot);callbacks++;
    snapshot.rows[0].pickupDay=Infinity;snapshot.usage[0].truck=-999;
    snapshot.constructorMetadata.sortOrder.fill('corrupted');snapshot.constructorMetadata.attempts[0].order='corrupted';
    snapshot.auditErrors.push('invented');throw new Error('observer failure');
  }});
  check(s,r);assert.ok(callbacks>0);assert.deepEqual(r.auditErrors,[]);
  assert.equal(r.constructorMetadata.attemptCount,4);assert.deepEqual(r.constructorMetadata.sortOrder,['deadline','release','feeJump','domainSize','seededRandom']);
  assert.equal(r.constructorMetadata.attempts[0].order,'deadline');assert.equal(r.constructorMetadata.callbackErrors.length,callbacks);
});

test('expired budgets and bounded failed repairs never price partial schedules',()=>{
  const s=scenario();
  noComplete(solveFastConstructor(s,{deadlineMs:performance.now()-1}));
  noComplete(solveFastConstructor(s,{timeBudgetMs:0}));
  assert.throws(()=>solveFastConstructor(s,{deadlineMs:Infinity}),/finite deadline/);
  assert.throws(()=>solveFastConstructor(s,{maxRestarts:-1}),/maxRestarts/);
  assert.throws(()=>solveFastConstructor(s,{objectiveMode:'fake'}),/objectiveMode/);
  assert.throws(()=>solveFastConstructor(s,{fixedEvents:{}}),/executed-event locks/);
  assert.throws(()=>solveFastConstructor({...s,containers:[container('bad',{releaseDay:Infinity})]}),/releaseDay/);
});

test('100-container construction returns canonical fees for all supported objective modes',()=>{
  const s=scenario({horizonDays:4,truckCapacity:200,warehouseCapacity:100,stagingCapacity:200,
    tariff:{pncFreeDays:0,ddFreeDays:0,pncMultiplier:.5,ddMultiplier:1.1,pncMode:'progressive',ddMode:'retroactive'},
    containers:Array.from({length:100},(_,index)=>container(`C${index}`,{sizeFt:index%2?40:20,dueDay:2}))});
  const before=JSON.stringify(s);
  for(const objectiveMode of ['joint','storageOnly','ddOnly']) {
    const r=solveFastConstructor(s,{timeBudgetMs:1000,maxRestarts:0,objectiveMode,seed:17});check(s,r);
    assert.ok(r.totalCost>0);assert.ok(Number.isFinite(r.objectiveCost));
  }
  assert.equal(JSON.stringify(s),before);
});
