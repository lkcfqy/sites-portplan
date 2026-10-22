import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createCommitmentHiGHSPlannerV11} from '../scripts/replay-commitment-v11.planner.mjs';
import {DECLARATION,verifyReplayPlannerCopy} from '../scripts/replay-commitment-v11.mjs';
import {assertArchivedFees,originalLocksBeforeDay,reconstructReplayEndpoint} from '../scripts/replay-commitment-v11.worker.mjs';

function scenario(id='A'){
  return {id:'replay-tiny',horizonStart:'2026-10-12',horizonDays:6,truckCapacity:4,warehouseCapacity:2,stagingCapacity:3,
    tariff:{pncFreeDays:4,ddFreeDays:10,pncMultiplier:1,ddMultiplier:1,pncMode:'retroactive',ddMode:'progressive'},
    operations:{returnLagDays:1,stagingUnit:'container'},containers:[{id,sizeFt:20,unloadDays:1,releaseDay:0,dueDay:4,dischargeDateTime:'2026-10-12T07:00:00+09:00',dataOrigin:'synthetic'}]};
}
const endpoint=id=>[{id,pickupDay:0,unloadDay:2,returnDay:3}];
const options=id=>({minEventDay:1,fixedEvents:{[id]:{pickupDay:0}},timeBudgetMs:200,objectiveMode:'joint'});

test('replay copy preserves every base planner byte outside the marked import block',async()=>{
  const base=await fs.readFile(new URL('../scripts/highs-planner-v11.mjs',import.meta.url),'utf8');
  const copy=await fs.readFile(new URL('../scripts/replay-commitment-v11.planner.mjs',import.meta.url),'utf8');
  assert.equal(verifyReplayPlannerCopy(base,copy).exactBaseLogicMatch,true);
  assert.throws(()=>verifyReplayPlannerCopy(base,copy.replace('FEE_EPSILON_KRW=1e-6','FEE_EPSILON_KRW=2e-6')));
  assert.deepEqual(DECLARATION.repeats.map(r=>r.seed),[49011,49023,49039]);
  assert.equal(DECLARATION.dailyBudgetMs,200);assert.equal(DECLARATION.parentHardWallMs,5000);
});

test('offline import validates and clones an endpoint without launching a solver',async()=>{
  const p=createCommitmentHiGHSPlannerV11(),s=scenario(),rows=endpoint('A'),o=options('A');
  try{
    const receipt=p.importReplayEndpoint(s,rows,o);
    assert.equal(receipt.optimizerCalls,0);assert.equal(receipt.decisionCalls,0);assert.equal(receipt.fees.objectiveCost,0);
    assert.equal(receipt.audit.valid,true);rows[0].unloadDay=4;o.fixedEvents.A.pickupDay=1;s.containers[0].dueDay=1;
    assert.equal(receipt.rows[0].unloadDay,2);assert.equal(receipt.audit.rows[0].pickupDay,0);
    assert.throws(()=>p.importReplayEndpoint(scenario(),endpoint('A'),options('A')),/once/);
  }finally{await p.close();}
});

test('failed import cannot write cache or consume the single successful import',async()=>{
  const p=createCommitmentHiGHSPlannerV11();
  try{
    assert.throws(()=>p.importReplayEndpoint(scenario(),endpoint('A'),{minEventDay:1,fixedEvents:{}}),/unexecuted/);
    assert.throws(()=>p.importReplayEndpoint(scenario(),[{id:'A',pickupDay:0,unloadDay:5,returnDay:5}],options('A')),/rejected/);
    assert.equal(p.importReplayEndpoint(scenario(),endpoint('A'),options('A')).audit.valid,true);
  }finally{await p.close();}
});

test('import after a decision or after close is forbidden even with no solver request',async()=>{
  const p=createCommitmentHiGHSPlannerV11();
  await p(scenario(),{...options('A'),timeBudgetMs:0.000001});
  assert.throws(()=>p.importReplayEndpoint(scenario(),endpoint('A'),options('A')),/once/);
  await p.close();
  const closed=createCommitmentHiGHSPlannerV11();await closed.close();
  assert.throws(()=>closed.importReplayEndpoint(scenario(),endpoint('A'),options('A')),/once/);
});

test('first real adapter decision reaudits imported cache and counts only its own request',async()=>{
  const s=scenario(),o=options('A');s.nativeFixture={reply:{status:'time_limit',hasIncumbent:false,rows:[],solverStatus:1}};
  const p=createCommitmentHiGHSPlannerV11({servicePath:fileURLToPath(new URL('./fixtures/highs-v8-service.py',import.meta.url))});
  try{
    await p.ready();p.importReplayEndpoint(s,endpoint('A'),o);
    const got=await p(s,{...o,timeBudgetMs:500});
    assert.equal(got.status,'feasible');assert.equal(got.rows[0].unloadDay,2);
    assert.equal(got.plannerMetadata.decisionCalls,1);assert.equal(got.plannerMetadata.solverCalls,1);
    assert.equal(got.plannerMetadata.stabilitySelection.cacheValid,true);
    const invalid=await p(s,{...o,minEventDay:2,fixedEvents:{A:{pickupDay:1}},timeBudgetMs:500});
    assert.equal(invalid.rows.length,0);assert.equal(invalid.plannerMetadata.stabilitySelection.cacheValid,false);
  }finally{await p.close();}
});

test('special box ids remain own execution locks during import and reconstruction',async()=>{
  for(const id of ['__proto__','constructor','toString']){
    const p=createCommitmentHiGHSPlannerV11();
    try{assert.equal(p.importReplayEndpoint(scenario(id),endpoint(id),options(id)).rows[0].id,id);}
    finally{await p.close();}
    assert.equal(reconstructReplayEndpoint(scenario(id),endpoint(id),options(id).fixedEvents,1).rows[0].pickupDay,0);
  }
  assert.equal(Object.hasOwn(Object.prototype,'pickupDay'),false);
});

test('original locks contain only actual pre-day actions, not dates still planned',()=>{
  const original={timeline:[{day:0,executedEvents:[{id:'A',event:'pickup',day:0}]},
    {day:1,executedEvents:[{id:'A',event:'unloadStart',day:1}]},{day:2,executedEvents:[{id:'A',event:'return',day:2}]}]};
  assert.deepEqual(originalLocksBeforeDay(original,1),{A:{pickupDay:0}});
  assert.deepEqual(originalLocksBeforeDay(original,2),{A:{pickupDay:0,unloadDay:1}});
  assert.throws(()=>reconstructReplayEndpoint(scenario(),endpoint('A'),{A:{pickupDay:1}},2));
});

test('independent five-field ledger maps joint objective to incremental cost',()=>{
  const candidate={storageCost:3,ddCost:2,totalCost:5,sunkCost:1,incrementalCost:4,objectiveCost:4};
  const ledger={storageCost:3,ddCost:2,totalCost:5,sunkCost:1,incrementalCost:4};
  assert.doesNotThrow(()=>assertArchivedFees(candidate,ledger));
  assert.doesNotThrow(()=>assertArchivedFees(candidate,{...ledger,objectiveCost:4}));
  assert.throws(()=>assertArchivedFees({...candidate,objectiveCost:0},ledger));
});

test('all six complete archived D4 endpoints match independent ledger fees',async()=>{
  const review=JSON.parse(await fs.readFile(new URL('../data/commitment-slack-review-v11.json',import.meta.url),'utf8'));
  for(const r of review.day4EndpointReviews)for(const label of ['cache','proposal']){
    const candidate=reconstructReplayEndpoint(r.publicScenario,r.scores[label].endpointDates,r.originalFixedEvents,r.day);
    assert.equal(candidate.rows.length,24);assertArchivedFees(candidate,r.scores[label].independentFees);
  }
});
