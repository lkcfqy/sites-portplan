import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {NATIVE_DIAGNOSTIC_DECLARATION,reconstructNativeDiagnosticSnapshot} from '../scripts/compare-native-v12.mjs';

const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
const hash=value=>'sha256:'+createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
const nominal={id:'manual-causal-snapshot',horizonStart:'2026-10-12',horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,
  containers:[{id:'A',sizeFt:20,dischargeDateTime:'2026-10-12T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:2,dataOrigin:'synthetic'}]};
const observed=(day,truck,warehouse,announcements=[])=>[{resource:'truck',capacity:truck,day,announcements:announcements.filter(a=>a.resource==='truck')},{resource:'warehouse',capacity:warehouse,day,announcements:announcements.filter(a=>a.resource==='warehouse')},{resource:'staging',capacity:1,day,announcements:[]}];

test('snapshot reconstructs observed past and explicit public future duration, never private restoration',()=>{
  const observations=observed(1,2,0,[{id:'public-warehouse',resource:'warehouse',revealDay:1,capacity:0,announcedDuration:2}]);
  const expected={...structuredClone(nominal),truckCapacity:[1,2,2,2],warehouseCapacity:[1,0,0,1],stagingCapacity:[1,1,1,1]};
  const fixedEvents={A:{pickupDay:0}},timeline=[{day:0,observedEvents:observed(0,1,1,[{id:'private-truck',resource:'truck',revealDay:0,capacity:1}]),executedEvents:[{id:'A',event:'pickup',day:0}]},
    {day:1,observedEvents:observations,executedEvents:[],observationHash:hash({scenario:expected,observedEvents:observations,fixedEvents,minEventDay:1})}];
  const result=reconstructNativeDiagnosticSnapshot(nominal,{timeline},1);
  assert.deepEqual(result.snapshot,expected);assert.deepEqual(result.fixedEvents,fixedEvents);
  assert.equal(result.snapshot.truckCapacity[2],2);assert.equal(result.snapshot.warehouseCapacity[2],0);
  assert.equal(result.pastPhysicalEvents.length,1);assert.equal(nominal.truckCapacity,2);
});

test('an input that cannot bind the original observation hash is refused',()=>{
  const timeline=[{day:0,observedEvents:observed(0,2,1),executedEvents:[],observationHash:'sha256:forged'}];
  assert.throws(()=>reconstructNativeDiagnosticSnapshot(nominal,{timeline},0),/differs from.*archived/);
});

test('the fixed diagnostic includes both tiers and both methods without real-time or heldout claims',()=>{
  assert.deepEqual(NATIVE_DIAGNOSTIC_DECLARATION.methods,['cpsatV12','highsV8']);
  assert.deepEqual(NATIVE_DIAGNOSTIC_DECLARATION.dailyBudgetsMs,[200,2000]);
  assert.equal(NATIVE_DIAGNOSTIC_DECLARATION.parentColdHardWallMs,5000);
  assert.equal(NATIVE_DIAGNOSTIC_DECLARATION.newHeldOutScenarios,0);
  assert.match(NATIVE_DIAGNOSTIC_DECLARATION.scope,/2000ms.*offline diagnosis/);
});
