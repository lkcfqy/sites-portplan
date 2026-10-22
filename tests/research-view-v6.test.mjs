import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeRollingViewV6,decodeRollingViewV6} from '../src/research-view-v6.js';
const fixture=()=>({cases:[{nominalScenario:{containers:[{id:'long-case-C001'},{id:'long-case-C002'}]},policies:{method:{rows:[{id:'long-case-C002',pickupDay:2}],timeline:[{observedEvents:[{id:'shock-truck'}],executedEvents:[{id:'long-case-C001',day:0,event:'pickup'}]}],totalCost:123}}}],developmentControls:{cases:[]}});
test('ID dictionary losslessly preserves decisions, events, fees and non-container IDs',()=>{
  const original=fixture(),encoded=encodeRollingViewV6(original);
  assert.equal(encoded.cases[0].policies.method.rows[0].containerIndex,1);
  assert.equal(encoded.cases[0].policies.method.timeline[0].observedEvents[0].id,'shock-truck');
  assert.deepEqual(decodeRollingViewV6(JSON.parse(JSON.stringify(encoded))),original);
  assert.deepEqual(fixture(),original);
});
test('unknown codec and invalid or conflicting indices are rejected',()=>{
  assert.throws(()=>decodeRollingViewV6({...fixture(),containerIdEncoding:'unknown'}));
  for(const index of [-1,2,0.5,null]){const v=encodeRollingViewV6(fixture());v.cases[0].policies.method.rows[0].containerIndex=index;assert.throws(()=>decodeRollingViewV6(v));}
  const v=encodeRollingViewV6(fixture());v.cases[0].policies.method.rows[0].id='other';assert.throws(()=>decodeRollingViewV6(v));
});
test('reserved key collision and duplicate dictionaries are rejected; old plain view is accepted',()=>{
  const v=fixture();v.cases[0].policies.method.rows[0].containerIndex=4;assert.throws(()=>encodeRollingViewV6(v));
  const dup=fixture();dup.cases[0].nominalScenario.containers[1].id='long-case-C001';assert.throws(()=>encodeRollingViewV6(dup));
  const plain=fixture();assert.equal(decodeRollingViewV6(plain),plain);
});
test('reserved index on any object is rejected and literal prototype keys are preserved',()=>{
  const v=fixture();v.cases[0].policies.method.extra={containerIndex:0};assert.throws(()=>encodeRollingViewV6(v));
  const special=fixture();special.cases[0].policies.method.fixedEvents=JSON.parse('{"__proto__":{"pickupDay":0}}');
  assert.deepEqual(decodeRollingViewV6(encodeRollingViewV6(special)),special);
  const broken=encodeRollingViewV6(fixture());delete broken.cases[0].nominalScenario.containers[0].id;assert.throws(()=>decodeRollingViewV6(broken));
});
