import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { makeDemoScenario, solveBaseline, validateScenario, seoulDischarge } from '../src/engine.js';
import { independentlyAudit, comparePolicies, summarizeCases } from '../scripts/benchmark.mjs';

test('independent audit detects fee corruption, duplicate/missing boxes, bad precedence and capacity overflow', () => {
  const scenario=makeDemoScenario(11,8), schedule=solveBaseline(scenario,'fifo');
  assert.deepEqual(independentlyAudit(scenario,schedule),[]);
  const badMoney=structuredClone(schedule);badMoney.rows[0].storageCost+=1;
  assert.ok(independentlyAudit(scenario,badMoney).some(s=>s.includes('storageCost')));
  const missing=structuredClone(schedule);missing.rows.pop();
  assert.ok(independentlyAudit(scenario,missing).length);
  const duplicate=structuredClone(schedule);duplicate.rows[1]=structuredClone(duplicate.rows[0]);
  assert.ok(independentlyAudit(scenario,duplicate).some(s=>s.includes('duplicate')));
  const badSequence=structuredClone(schedule);badSequence.rows[0].returnDay=badSequence.rows[0].unloadDay;
  assert.ok(independentlyAudit(scenario,badSequence).some(s=>s.includes('sequence')));
  assert.ok(independentlyAudit({...scenario,truckCapacity:0},schedule).some(s=>s.includes('truckCapacity')));
  assert.ok(independentlyAudit({...scenario,warehouseCapacity:0},schedule).some(s=>s.includes('warehouseCapacity')));
  assert.ok(independentlyAudit({...scenario,stagingCapacity:0},schedule).some(s=>s.includes('stagingCapacity')));
  const lateScenario=structuredClone(scenario);lateScenario.containers.forEach(c=>c.dueDay=-1);
  assert.ok(independentlyAudit(lateScenario,schedule).some(s=>s.includes('deadline')));
});

test('comparison preserves zero denominator, worse optimizer, failed heuristics and no incumbent', () => {
  const feasible=cost=>({status:'feasible',rows:[{}],incrementalCost:cost,totalCost:cost+10,runtimeMs:1});
  const failed={status:'no_feasible_schedule_found',rows:[],incrementalCost:null,totalCost:null,runtimeMs:1};
  let results={fifo:feasible(0),earliestFreeEnd:failed,marginalCost:failed,optimized:feasible(0)};
  assert.equal(comparePolicies(results).incrementalSavingsPct,null);
  let summary=summarizeCases([{policies:results,comparison:comparePolicies(results),audits:{}}]);
  assert.equal(summary.zeroBaselineCount,1);assert.equal(summary.weightedIncrementalSavingsPct,null);
  results={fifo:feasible(10),earliestFreeEnd:feasible(20),marginalCost:failed,optimized:feasible(12)};
  assert.equal(comparePolicies(results).incrementalSavingsKRW,-2);
  summary=summarizeCases([{policies:results,comparison:comparePolicies(results),audits:{}}]);
  assert.equal(summary.negativeSavingsCount,1);assert.equal(summary.weightedIncrementalSavingsPct,-20);
  results={fifo:failed,earliestFreeEnd:failed,marginalCost:failed,optimized:feasible(12)};
  assert.equal(comparePolicies(results).paired,false);assert.equal(comparePolicies(results).bestBaseline,null);
  results={fifo:feasible(10),earliestFreeEnd:failed,marginalCost:failed,optimized:{...failed,status:'time_limit'}};
  assert.equal(comparePolicies(results).paired,false);
});

test('archived benchmark is complete, all feasible outputs pass independent recalculation, percentages reconcile', async () => {
  const benchmark=JSON.parse(await readFile(new URL('../data/benchmark.json',import.meta.url),'utf8'));
  assert.equal(benchmark.cases.length,24);
  assert.deepEqual(benchmark.protocol.seeds,[11,29,47,83]);
  assert.deepEqual(benchmark.protocol.counts,[8,16]);
  assert.equal(new Set(benchmark.cases.map(c=>c.id)).size,24);
  let baseSum=0,optSum=0,pairedCount=0,checked=0;
  for(const scenario of benchmark.cases) {
    for(const result of Object.values(scenario.policies)) if(result.rows.length) {
      assert.deepEqual(independentlyAudit(scenario.scenario,result),[]);checked++;
    }
    const available=['fifo','earliestFreeEnd','marginalCost'].map(key=>scenario.policies[key]).filter(r=>r.rows.length&&Number.isFinite(r.incrementalCost));
    if(available.length&&scenario.policies.optimized.rows.length) {
      baseSum+=Math.min(...available.map(r=>r.incrementalCost));optSum+=scenario.policies.optimized.incrementalCost;pairedCount++;
    }
    assert.ok(scenario.scenario.containers.every(c=>c.dataOrigin==='synthetic'));
  }
  assert.equal(benchmark.summary.pairedCaseCount,pairedCount);
  assert.equal(benchmark.summary.baselineIncrementalKRW,baseSum);
  assert.equal(benchmark.summary.optimizedIncrementalKRW,optSum);
  assert.equal(benchmark.summary.incrementalSavingsKRW,baseSum-optSum);
  assert.equal(benchmark.summary.weightedIncrementalSavingsPct,100*(baseSum-optSum)/baseSum);
  assert.equal(benchmark.summary.independentAudit.checkedFeasibleSchedules,checked);
  assert.equal(benchmark.infeasibleControl.policies.optimized.status,'infeasible');
  assert.equal(benchmark.infeasibleControl.policies.optimized.totalCost,null);
  for(const key of ['fifo','earliestFreeEnd','marginalCost']) assert.equal(benchmark.infeasibleControl.policies[key].status,'no_feasible_schedule_found');
});

test('malformed imported orders and invalid calendar dates are rejected cleanly', () => {
  const base=makeDemoScenario(11,8);
  for(const containers of [{},null,[null],[1],['box']]) assert.equal(validateScenario({...base,containers}).valid,false);
  assert.throws(()=>seoulDischarge('2026-02-30T10:00:00+09:00'));
  assert.throws(()=>seoulDischarge('2026-10-12T24:00:00+09:00'));
  assert.equal(validateScenario({...base,containers:[base.containers[0],base.containers[0]]}).valid,false);
});
