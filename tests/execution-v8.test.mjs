import test from 'node:test';
import assert from 'node:assert/strict';
import {capacityAt, rowFor, summarize, validateScenario} from '../src/engine.js';
import {auditExecutionResultV8, executionInputChangesV8, executionStatusV8,
  makeExecutionFixtureV8, prepareExecutionInputV8, runExecutionEpisodeV8} from '../src/execution-v8.worker.js';

function tiny(){return {id:'custom-causal-test',horizonStart:'2026-10-15',horizonDays:7,
  truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,
  containers:[{id:'A',sizeFt:20,dischargeDateTime:'2026-10-01T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:5,dataOrigin:'synthetic'}]};}
function factory(calls){return ()=>async(scenario,options)=>{
  calls.push(structuredClone({scenario,options}));
  const container=scenario.containers[0],fixed=options.fixedEvents.A??{};
  const p=fixed.pickupDay??Math.max(0,options.minEventDay),u=fixed.unloadDay??p;
  let r=fixed.returnDay??Math.max(4,u+1,options.minEventDay);
  while(r<scenario.horizonDays&&capacityAt(scenario.truckCapacity,r)<1)r++;
  if(r>=scenario.horizonDays)return {status:'no_feasible_schedule_found',rows:[]};
  return summarize(scenario,'injected',[rowFor(scenario,container,p,u,r)],0,'feasible',{
    plannerMetadata:{action:options.minEventDay===0?'initialize':'retain',decisionReason:'fixture',
      feeOpportunity:{opportunityKRW:20},model:{debug:true}},
  });
};}

test('custom simulation validates, clones, strips undeclared private fields and never certifies user provenance',()=>{
  const input={scenario:tiny(),events:[{id:'private',resource:'truck',revealDay:3,capacity:0,duration:2}]};
  input.scenario.hiddenEvents=structuredClone(input.events);input.scenario.containers[0].privateDuration=2;
  input.scenario.containers[0].dataOrigin='public-record';
  const original=structuredClone(input),prepared=prepareExecutionInputV8(input);
  assert.deepEqual(input,original);assert.equal(prepared.scenario.containers[0].dataOrigin,'uploaded');
  assert.equal(prepared.scenario.hiddenEvents,undefined);assert.equal(prepared.scenario.containers[0].privateDuration,undefined);
  assert.deepEqual(prepared.normalization.ignoredScenarioFields,['hiddenEvents']);
  prepared.events[0].duration=1;assert.equal(input.events[0].duration,2);
  assert.throws(()=>prepareExecutionInputV8({...input,events:[{...input.events[0],announcedDuration:1}]}),/announcedDuration/);
  assert.throws(()=>prepareExecutionInputV8({...input,events:[{...input.events[0],revealDay:-1}]}),/revealDay/);
  assert.throws(()=>prepareExecutionInputV8({...input,scenario:{...input.scenario,objectiveMode:'storageOnly'}}),/joint/);
  assert.throws(()=>prepareExecutionInputV8({...input,events:Array(129).fill({})}),/128/);
});

test('worker wrapper preserves identical known prefixes for different hidden durations and carries action explanations',async()=>{
  const callsA=[],callsB=[],scenario=tiny(),event={id:'hidden-duration',resource:'truck',revealDay:3,capacity:0};
  const a=await runExecutionEpisodeV8({scenario,events:[{...event,duration:1}],method:'adaptiveV8'},{plannerFactory:factory(callsA)});
  const b=await runExecutionEpisodeV8({scenario,events:[{...event,duration:2}],method:'adaptiveV8'},{plannerFactory:factory(callsB)});
  assert.equal(a.complete,true);assert.equal(b.complete,true);assert.equal(a.rows[0].returnDay,4);assert.equal(b.rows[0].returnDay,5);
  assert.deepEqual(callsA.slice(0,4),callsB.slice(0,4));
  for(const call of [...callsA,...callsB]){
    assert.equal(JSON.stringify(call).includes('hidden-duration'),false);
    assert.equal(JSON.stringify(call).includes('"duration"'),false);
    assert.deepEqual(Object.keys(call.options).sort(),['fixedEvents','minEventDay','objectiveMode','timeBudgetMs','timeLimitSeconds']);
  }
  assert.equal(a.plannerTrace[0].action,'initialize');assert.equal(a.plannerTrace[1].action,'retain');
  assert.deepEqual(a.plannerTrace[0].feeOpportunity,{opportunityKRW:20});assert.equal(a.plannerTrace[0].model,undefined);
  assert.equal(a.terminalAudit.valid,true);assert.equal(a.parentWallMs,undefined);
  assert.equal(executionStatusV8(a),'complete');
});

test('parent terminal audit rejects forged money, omitted physical actions and unsafe dates',async()=>{
  const input=prepareExecutionInputV8({scenario:tiny(),events:[]});
  const result=await runExecutionEpisodeV8({...input,method:'adaptiveV8'},{plannerFactory:factory([])});
  assert.equal(auditExecutionResultV8(input,result).valid,true);
  for(const mutate of [
    value=>value.totalCost++,value=>value.rows[0].storageCost++,
    value=>value.timeline[0].executedEvents.pop(),value=>value.rows[0].unloadEndDay=Infinity,
    value=>value.objectiveCost=0,
  ]){const broken=structuredClone(result);mutate(broken);assert.equal(auditExecutionResultV8(input,broken).valid,false);}
  const missing={complete:false,totalCost:0,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,objectiveCost:null};
  assert.equal(auditExecutionResultV8(input,missing).valid,false);
});

test('illustrative complete and interrupted fixtures work across all four actual planner factories',async()=>{
  for(const kind of ['success','failure']){
    const fixture=makeExecutionFixtureV8(kind),original=structuredClone(fixture);
    assert.equal(validateScenario(fixture.scenario).valid,true);assert.equal(fixture.scenario.containers.length,10);
    for(const method of ['adaptiveV9','adaptiveV8','costPolishV7','stableRetainV5']){
      const result=await runExecutionEpisodeV8({...fixture,method});
      assert.equal(result.terminalAudit.valid,true);assert.equal(result.executionHistoryUnavailable,false);
      assert.match(result.scope,/simulation/);assert.equal(result.browserSimulation.source,'custom_local_simulation_not_frozen_research');
      if(kind==='success'){
        assert.equal(result.complete,true,method);assert.equal(result.executedEvents.length,30);
        assert.ok(Number.isFinite(result.totalCost));assert.equal(result.finalAudit.valid,true);
      }else{
        assert.equal(result.complete,false,method);assert.equal(result.failure.day,2);
        assert.equal(result.failureProof.status,'proven_infeasible_necessary_condition');
        assert.equal(result.failureProof.minEventDay,2);
        assert.equal(executionStatusV8(result),'proven_snapshot_infeasible');
        for(const key of ['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost'])assert.equal(result[key],null);
        assert.ok(result.timeline.slice(0,2).some(entry=>entry.executedEvents.length));
      }
    }
    assert.deepEqual(fixture,original);
  }
});

test('input differences identify declared intervention changes rather than attributing them to the method',()=>{
  const before=prepareExecutionInputV8(makeExecutionFixtureV8('failure')),after=structuredClone(before);
  after.events[0].capacity=2;after.scenario.truckCapacity=6;
  assert.deepEqual(executionInputChangesV8(before,after),[
    {path:'scenario.truckCapacity',before:4,after:6},
    {path:'events.0.capacity',before:0,after:2},
  ]);
  assert.deepEqual(executionInputChangesV8(null,after),[]);assert.deepEqual(executionInputChangesV8(before,structuredClone(before)),[]);
});

test('an unfounded solver failure remains unknown feasibility; timeout and cancellation have unavailable history',async()=>{
  const result=await runExecutionEpisodeV8({scenario:tiny(),events:[],method:'adaptiveV8'},
    {plannerFactory:()=>async()=>({status:'infeasible',rows:[],reason:'Unverified injected solver status.'})});
  assert.equal(result.complete,false);assert.equal(result.failureProof.status,'not_proven_infeasible');
  assert.equal(executionStatusV8(result),'no_complete_plan');
  assert.equal(executionStatusV8({complete:false,status:'hard_time_limit',executionHistoryUnavailable:true}),'unknown');
  assert.equal(executionStatusV8({complete:false,status:'cancelled',executionHistoryUnavailable:true}),'cancelled');
});
