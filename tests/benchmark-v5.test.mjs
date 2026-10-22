import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {protocolV5,FROZEN_PROTOCOL_HASH_V5,summarizeV5} from '../scripts/benchmark-v5.mjs';
import {runIsolatedV4} from '../scripts/benchmark-v4.mjs';
import {makeDemoScenario} from '../src/engine.js';
import {fileURLToPath} from 'node:url';
import {summarizeStableV5} from '../scripts/rolling-benchmark-v5.mjs';

test('prospective V5 protocol retains new seed coverage and unfiltered repeated controls',async()=>{
  const raw=await readFile(new URL('../data/protocol-v5.json',import.meta.url));assert.equal(createHash('sha256').update(raw).digest('hex'),FROZEN_PROTOCOL_HASH_V5);
  assert.equal(protocolV5.primaryCases.length,36);assert.equal(new Set(protocolV5.primaryCases.map(c=>c.seed)).size,36);
  assert.equal(protocolV5.rolling.cases.length,24);assert.equal(protocolV5.optionalScaleControl.cases.length,6);
  assert.ok(protocolV5.primaryCases.every(c=>c.seed>=61001&&c.seed<=61036));
  assert.ok(protocolV5.optionalScaleControl.cases.every(c=>protocolV5.primaryCases.some(r=>r.id===c.referenceCaseId&&r.count===100)));
});
test('V5 summaries preserve missing pairs, loss amounts, zero denominators and honest timing',()=>{
  const r=cost=>({status:'feasible',auditValid:true,rows:[{}],totalCost:cost+100,incrementalCost:cost,wallTimeMs:20,processExitWallTimeMs:21});
  const cases=[{count:100,policies:{rawMILP:r(10),v4EventSearch:r(12),fastEvent:r(20)}},{count:100,policies:{rawMILP:r(0),v4EventSearch:r(0),fastEvent:r(0)}}];
  let s=summarizeV5(cases);assert.equal(s.comparisons.fastVsV4.incrementalSavingsKRW,-8);assert.equal(s.comparisons.fastVsV4.negativeSavingsCount,1);assert.equal(s.comparisons.fastVsV4.zeroBaselineCount,1);
  cases[0].policies.fastEvent={rows:[],incrementalCost:null,totalCost:null,wallTimeMs:1000,processExitWallTimeMs:1001};s=summarizeV5(cases);assert.equal(s.comparisons.fastVsV4.pairedCaseCount,1);assert.equal(s.comparisons.fastVsV4.weightedIncrementalSavingsPct,null);assert.equal(s.byPolicy.fastEvent.wallTimeMs.median,510);
});
test('stability comparison excludes failed episode costs and keeps stability premiums',()=>{
  const r=(cost,changes,solves)=>({status:'feasible',complete:true,totalCost:cost,revisionCount:changes,plannerStats:{solverCalls:solves,reusedPlans:4-solves,decisionCalls:4,planningWallMs:10}});
  const s=summarizeStableV5([{id:'pair',policies:{dailyReopt:r(100,20,4),stableRetain:r(120,2,1)}},{id:'loss',policies:{dailyReopt:r(10,1,4),stableRetain:{status:'rolling_failed',rows:[],totalCost:null,revisionCount:0,plannerStats:{solverCalls:1,reusedPlans:0,decisionCalls:1,planningWallMs:1}}}}]);
  assert.equal(s.paired.caseCount,1);assert.equal(s.paired.stablePremiumPct,20);assert.equal(s.paired.changeReductionPct,90);assert.deepEqual(s.lostCompletionCases,['loss']);assert.equal(s.byMethod.stableRetain.failureCount,1);
});
test('fastEvent cold child checkpoint is independently audited inside a real parent deadline',async()=>{
  const r=await runIsolatedV4(makeDemoScenario(49999,4),'fastEvent',{hardWallMs:1000,workerScript:fileURLToPath(new URL('../scripts/benchmark-v5.mjs',import.meta.url)),workerFlag:'--v5-worker'});
  assert.equal(r.auditValid,true);assert.equal(r.rows.length,4);assert.equal(r.optimality,'heuristic');assert.ok(r.finalReceivedMs<=1000);assert.equal(r.constructorAttempt.phaseBudgetMs,200);
});
