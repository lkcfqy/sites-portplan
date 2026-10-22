import test from 'node:test';
import assert from 'node:assert/strict';
import {solveOptimized,rowFor,auditSchedule} from '../src/engine.js';
test('tiny noninteger tariff objective never becomes an exact optimum or strict lexicographic certificate',async()=>{
  const s={horizonStart:'2026-10-12',horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,tariff:{pncMultiplier:1e-12,ddMultiplier:1},containers:[
    {id:'A',sizeFt:20,dischargeDateTime:'2026-10-04T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:2,dataOrigin:'synthetic'},
    {id:'B',sizeFt:40,dischargeDateTime:'2026-09-27T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:2,dataOrigin:'synthetic'},
  ]};
  for(const lexicographic of [true,false]){
    const result=await solveOptimized(s,{objectiveMode:'storageOnly',lexicographic,timeLimitSeconds:1});
    assert.equal(result.status,'feasible');
    assert.equal(result.optimality,'solver_optimal_with_numeric_tolerance');
    assert.notEqual(result.tieBreakStatus,'optimal');
    assert.equal(result.numericalAssurance.primarySafeInteger,false);
    assert.ok(auditSchedule(s,result.rows).valid);
  }
  assert.ok(auditSchedule(s,[rowFor(s,s.containers[0],0,0,1),rowFor(s,s.containers[1],1,1,2)]).valid);
});
