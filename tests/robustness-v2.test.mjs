import test from 'node:test';
import assert from 'node:assert/strict';
import {auditOperations,applyDisruption,makeStressScenario} from '../scripts/robustness-v2.mjs';

test('stress auditor uses actual processing duration and preserves both same-day transport events',()=>{
  const s={horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,operations:{returnLagDays:0},containers:[{id:'A',releaseDay:0,unloadDays:1,dueDay:2,sizeFt:40}]};
  const rows=[{id:'A',pickupDay:0,unloadDay:0,unloadEndDay:0,returnDay:0}];
  assert.equal(auditOperations(s,rows).valid,true);
  assert.equal(auditOperations({...s,truckCapacity:1},rows).counts.truck,1);
  const longer=structuredClone(s);longer.containers[0].unloadDays=2;
  assert.equal(auditOperations(longer,rows).counts.sequence,1);
  assert.equal(auditOperations({...s,operations:{returnLagDays:1}},rows).counts.sequence,1);
  const held=[{...rows[0],returnDay:1}];
  assert.equal(auditOperations({...s,operations:{stagingUnit:'teu',returnLagDays:0}},held).counts.staging,1);
});

test('fixed disruptions are deterministic and do not mutate initial input',()=>{
  const s=makeStressScenario(29001),before=JSON.stringify(s),d=applyDisruption(s,'both');
  assert.equal(JSON.stringify(s),before);assert.deepEqual(s,makeStressScenario(29001));
  assert.equal(d.truckCapacity[2],6);assert.equal(d.truckCapacity[3],4);assert.equal(d.truckCapacity[6],6);
  assert.equal(d.containers[0].unloadDays,s.containers[0].unloadDays+1);
  assert.equal(d.containers[1].unloadDays,s.containers[1].unloadDays);
});
