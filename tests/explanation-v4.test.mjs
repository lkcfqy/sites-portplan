import test from 'node:test';
import assert from 'node:assert/strict';
import {pickupFeeExposures,executionTasks} from '../src/decision-explanation.js';
test('tariff exposure shows exact 2026 PNC jumps without representing a global scheduling effect',()=>{
  const s={horizonStart:'2026-10-12',containers:[{id:'one',sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',unloadDays:2}]};
  const [r]=pickupFeeExposures(s,[{id:'one',pickupDay:0,unloadDay:0,returnDay:3}]);
  assert.equal(r.storageDays,14);assert.equal(r.currentStorageCost,318500);assert.equal(r.oneDayStorageExposure,182000);
  assert.match(r.interpretation,/not reoptimized/);
  assert.equal(executionTasks(s,[{id:'one',pickupDay:0,unloadDay:0,returnDay:3}]).length,4);
});
