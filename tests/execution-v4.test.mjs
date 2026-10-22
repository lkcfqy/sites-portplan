import test from 'node:test';
import assert from 'node:assert/strict';
import {makeDemoScenario,solveOptimized,auditSchedule} from '../src/engine.js';
import {constrainExecutionDomains} from '../src/execution-constraints.js';

test('execution restrictions keep fixed past events and exclude all other past events',()=>{
  const s=makeDemoScenario(42,1),events=[Object.fromEntries(['x','y','z'].map(k=>[k,[0,1,2,3].map(day=>({name:k+day,day}))]))];
  const next=constrainExecutionDomains(s,events,{minEventDay:2,fixedEvents:{[s.containers[0].id]:{pickupDay:0}}});
  assert.deepEqual(next.event[0].x.map(v=>v.day),[0]);
  assert.deepEqual(next.event[0].y.map(v=>v.day),[2,3]);
  assert.equal(next.metadata.lockedEvents,1);
  assert.throws(()=>constrainExecutionDomains(s,events,{fixedEvents:{unknown:{pickupDay:0}}}));
  assert.throws(()=>constrainExecutionDomains(s,events,{minEventDay:-1}));
  assert.throws(()=>constrainExecutionDomains(s,events,{fixedEvents:{[s.containers[0].id]:{pickupDay:NaN}}}));
});

test('actual optimizer preserves begun multi-day unloading and cannot invent past starts',async()=>{
  const s=makeDemoScenario(42,1);
  Object.assign(s.containers[0],{releaseDay:0,unloadDays:3,dueDay:8});
  const result=await solveOptimized(s,{minEventDay:2,fixedEvents:{[s.containers[0].id]:{pickupDay:0,unloadDay:0}},timeLimitSeconds:1});
  assert.ok(['optimal','feasible'].includes(result.status));
  assert.equal(result.rows[0].pickupDay,0);
  assert.equal(result.rows[0].unloadDay,0);
  assert.equal(result.rows[0].unloadEndDay,2);
  assert.ok(result.rows[0].returnDay>=3);
  assert.ok(auditSchedule(s,result.rows).valid);
  const future=await solveOptimized(s,{minEventDay:4,timeLimitSeconds:1});
  assert.ok(future.rows.every(r=>r.pickupDay>=4&&r.unloadDay>=4&&r.returnDay>=4));
});
