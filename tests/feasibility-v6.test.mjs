import test from 'node:test';
import assert from 'node:assert/strict';
import {explainFeasibility} from '../src/feasibility-explanation-v6.js';

function scenario(containers,extra={}){return {horizonStart:'2026-10-12',horizonDays:5,truckCapacity:10,warehouseCapacity:10,stagingCapacity:10,
  containers:containers.map((c,i)=>({id:String(i),sizeFt:20,dischargeDateTime:'2026-10-10T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:3,...c})),...extra};}
function allTrips(s,c,locks={},today=0){const out=[];for(let p=c.releaseDay;p<s.horizonDays;p++)for(let u=p;u<s.horizonDays;u++)for(let r=u+c.unloadDays-1+(s.operations?.returnLagDays??1);r<s.horizonDays;r++){
  if(u+c.unloadDays-1>c.dueDay)continue;
  if(Object.entries({pickupDay:p,unloadDay:u,returnDay:r}).some(([key,day])=>Object.hasOwn(locks,key)?day!==locks[key]:day<today))continue;
  out.push({p,u,r});
}return out;}

test('passing necessary bounds never claims a feasible or optimal plan',()=>{
  const r=explainFeasibility(scenario([{}]));assert.equal(r.status,'not_proven_infeasible');assert.equal(r.feasible,null);assert.equal(r.optimality,'not_applicable');assert.equal(r.intervalsChecked,15);
});
test('pickup and return both count when lag-zero forces two movements in one day',()=>{
  const s=scenario([{dueDay:0}],{truckCapacity:[1,10,10,10,10],operations:{returnLagDays:0}});
  const r=explainFeasibility(s,{fixedEvents:{0:{pickupDay:0,unloadDay:0,returnDay:0}}});
  const w=r.witnesses.find(w=>w.resource==='truck'&&w.fromDay===0&&w.toDay===0);assert.ok(w);assert.equal(w.minimumRequired,2);assert.equal(w.availableCapacity,1);
});
test('mandatory workload interval catches conflict even without a mandatory single day',()=>{
  const s=scenario([{unloadDays:2,dueDay:2},{unloadDays:2,dueDay:2}],{warehouseCapacity:1});
  const r=explainFeasibility(s);assert.equal(r.status,'proven_infeasible_necessary_condition');
  const w=r.witnesses.find(w=>w.resource==='warehouse'&&w.fromDay===0&&w.toDay===2);assert.ok(w);assert.equal(w.minimumRequired,4);assert.equal(w.availableCapacity,3);
});
test('ongoing unloading and TEU occupancy retain physical history after a shock',()=>{
  const s=scenario([{sizeFt:40,unloadDays:3,dueDay:3}],{warehouseCapacity:[1,0,1,1,1],stagingCapacity:[2,1,2,2,2],operations:{stagingUnit:'teu'}});
  const r=explainFeasibility(s,{fixedEvents:{0:{pickupDay:0,unloadDay:0}},minEventDay:1});
  assert.equal(r.status,'proven_infeasible_necessary_condition');
  assert.ok(r.witnesses.some(w=>w.resource==='warehouse'&&w.fromDay===1&&w.toDay===1&&w.deficit===1));
  assert.ok(r.witnesses.some(w=>w.resource==='staging'&&w.fromDay===1&&w.toDay===1&&w.deficit===1));
});
test('execution deadline miss is an empty domain, not a capacity remedy',()=>{
  const s=scenario([{dueDay:0}]);const r=explainFeasibility(s,{minEventDay:1});assert.equal(r.proofKind,'empty_event_domain');assert.equal(r.emptyDomainCount,1);assert.equal(r.intervalsChecked,0);
});
test('returned jobs remain compatible with a decision day after their history',()=>{
  const s=scenario([{}]);const r=explainFeasibility(s,{fixedEvents:{0:{pickupDay:0,unloadDay:0,returnDay:1}},minEventDay:5});assert.equal(r.status,'not_proven_infeasible');assert.equal(r.domainCounts[0].admissibleTripCount,1);
});
test('each reported bound agrees with a separate exhaustive date-domain calculation',()=>{
  for(let seed=1;seed<=12;seed++){
    const s=scenario([{unloadDays:1+seed%2,dueDay:2+seed%2},{sizeFt:40,releaseDay:seed%2,dueDay:3}],{
      truckCapacity:[seed%3,1,1,1,1],warehouseCapacity:seed%2,stagingCapacity:seed%3,operations:{returnLagDays:seed%2,stagingUnit:seed%2?'teu':'container'}});
    const r=explainFeasibility(s,{maxWitnesses:100});for(const w of r.witnesses){if(w.kind!=='resource_interval_lower_bound')continue;
      let total=0;for(const c of s.containers){const values=allTrips(s,c).map(({p,u,r})=>{let usage=0;for(let d=w.fromDay;d<=w.toDay;d++)usage+=w.resource==='truck'?Number(p===d)+Number(r===d):w.resource==='warehouse'?Number(u<=d&&d<u+c.unloadDays):Number(p<=d&&d<r)*(s.operations.stagingUnit==='teu'?c.sizeFt/20:1);return usage;});total+=Math.min(...values);}
      assert.equal(w.minimumRequired,total);assert.ok(total>w.availableCapacity);
    }
  }
});
test('invalid locks and explanation budget settings are rejected',()=>{
  const s=scenario([{}]);assert.throws(()=>explainFeasibility(s,{fixedEvents:{unknown:{pickupDay:0}}}),/execution lock/);assert.throws(()=>explainFeasibility(s,{maxWitnesses:0}),/maxWitnesses/);
});
