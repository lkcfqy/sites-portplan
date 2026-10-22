import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { PROTOCOL_SHA256,protocolV2,makeScenarioV2,independentCostsV2,independentAuditV2,compareV2,summarizeV2,sensitivitySummary,isFeasibleV2 } from '../scripts/benchmark-v2.mjs';

test('V2 frozen protocol hash, unique scenario streams and declared matrix are preserved',async()=>{
  const bytes=await readFile(new URL('../data/protocol-v2.json',import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),PROTOCOL_SHA256);
  assert.equal(protocolV2.primaryCases.length,48);
  assert.equal(new Set(protocolV2.primaryCases.map(c=>c.seed)).size,48);
  const fingerprints=protocolV2.primaryCases.map(config=>{
    const first=makeScenarioV2(config),second=makeScenarioV2(config);
    assert.deepEqual(first,second);assert.equal(first.containers.length,config.count);
    assert.ok(first.containers.every(c=>c.dataOrigin==='synthetic'&&c.releaseDay>=0&&c.dueDay<=12));
    return JSON.stringify(first.containers.map(({id,...rest})=>rest));
  });
  assert.equal(new Set(fingerprints).size,48);
  assert.ok(protocolV2.primaryCases.every(c=>![11,29,47,83].includes(c.seed)));
  for(const mechanism of ['aged-backlog','new-arrivals','batch-release'])for(const capacityProfile of ['balanced','tight'])for(const count of [16,50])
    assert.equal(protocolV2.primaryCases.filter(c=>c.mechanism===mechanism&&c.capacityProfile===capacityProfile&&c.count===count).length,4);
});

test('independent V2 calculator has correct tariff boundaries, alternate modes and shifted-free-day assumptions',()=>{
  const c={id:'one',sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:3,dataOrigin:'synthetic'};
  const s={horizonStart:'2026-10-12',tariff:{}};
  const costs=independentCostsV2(s,c,{pickupDay:0,returnDay:1});
  assert.equal(costs.storageDays,14);assert.equal(costs.storageCost,318500);
  assert.equal(costs.ddDays,15);assert.equal(costs.ddCost,75000);
  // Sep 29 through Oct 11 inclusive is 13 days: 9×31,850 storage + 3×15,000 D&D.
  assert.equal(costs.sunkCost,331650);assert.equal(costs.incrementalCost,61850);
  assert.equal(independentCostsV2(s,c,{pickupDay:1,returnDay:2}).storageCost,500500);
  assert.equal(independentCostsV2({...s,tariff:{pncMode:'progressive'}},c,{pickupDay:0,returnDay:1}).storageCost,222950);
  assert.equal(independentCostsV2({...s,tariff:{ddMode:'retroactive'}},c,{pickupDay:1,returnDay:2}).ddCost,180000);
  assert.equal(independentCostsV2({...s,tariff:{pncFreeDays:6,ddFreeDays:14}},c,{pickupDay:0,returnDay:1}).storageCost,254800);
  assert.equal(independentCostsV2({...s,tariff:{pncFreeDays:6,ddFreeDays:14}},c,{pickupDay:0,returnDay:1}).ddCost,15000);
});

test('independent V2 audit respects same-day double movements, TEU staging and rejects falsified fees',()=>{
  const c={id:'one',sizeFt:40,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:2,dataOrigin:'synthetic'};
  const s={horizonStart:'2026-10-12',horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:0,operations:{returnLagDays:0,stagingUnit:'teu'},containers:[c]};
  const row={id:c.id,pickupDay:0,unloadDay:0,unloadEndDay:0,returnDay:0,...independentCostsV2(s,c,{pickupDay:0,returnDay:0})};
  const result={rows:[row],...Object.fromEntries(['storageCost','ddCost','totalCost','sunkCost','incrementalCost'].map(k=>[k,row[k]]))};
  assert.deepEqual(independentAuditV2(s,result),[]);
  assert.ok(independentAuditV2({...s,truckCapacity:1},result).some(e=>e.includes('truckCapacity')));
  assert.ok(independentAuditV2({...s,operations:{returnLagDays:1}},result).some(e=>e.includes('precedence')));
  const next={...row,returnDay:1,...independentCostsV2(s,c,{pickupDay:0,returnDay:1})};
  const nextResult={rows:[next],...Object.fromEntries(['storageCost','ddCost','totalCost','sunkCost','incrementalCost'].map(k=>[k,next[k]]))};
  assert.ok(independentAuditV2({...s,stagingCapacity:1},nextResult).some(e=>e.includes('stagingCapacity')));
  assert.deepEqual(independentAuditV2({...s,stagingCapacity:2},nextResult),[]);
  assert.ok(independentAuditV2(s,{...result,rows:[{...row,ddCost:row.ddCost+1}]}).some(e=>e.includes('ddCost')));
});

test('V2 strong baseline zero advantage, negative savings and missing incumbents remain explicit',()=>{
  const feasible=n=>({status:'feasible',rows:[{}],incrementalCost:n,totalCost:n+100,runtimeMs:2,wallTimeMs:3});
  const failed={status:'no_feasible_schedule_found',rows:[],incrementalCost:null,totalCost:null,wallTimeMs:1};
  const policies={fifo:feasible(20),earliestFreeEnd:feasible(20),marginalCost:feasible(15),earliestDeadline:feasible(14),strongSearch:feasible(10),optimized:feasible(10)};
  assert.equal(compareV2(policies).bestBaseline,'strongSearch');assert.equal(compareV2(policies).incrementalSavingsKRW,0);
  let summary=summarizeV2([{policies,audits:{},mechanism:'test',capacityProfile:'test'}]);
  assert.equal(summary.tiedCount,1);assert.equal(summary.againstStrongSearch.tiedCount,1);
  policies.optimized=feasible(12);assert.equal(compareV2(policies).incrementalSavingsKRW,-2);
  policies.strongSearch=feasible(0);policies.optimized=feasible(0);assert.equal(compareV2(policies).incrementalSavingsPct,null);
  policies.optimized={...failed,status:'time_limit'};assert.equal(compareV2(policies).paired,false);
});

test('completed V2 archive retains every frozen case and all feasible schedules pass independent repricing',async()=>{
  const b=JSON.parse(await readFile(new URL('../data/benchmark-v2.json',import.meta.url),'utf8'));
  assert.equal(b.executionState,'complete');assert.equal(b.protocolHash,PROTOCOL_SHA256);
  assert.deepEqual(b.cases.map(c=>c.id),protocolV2.primaryCases.map(c=>c.id));
  assert.equal(b.scaleControls.cases.length,4);assert.equal(b.sensitivity.cases.length,56);
  for(const group of [b.cases,b.scaleControls.cases,b.sensitivity.cases])for(const c of group)for(const r of Object.values(c.policies)) {
    assert.ok(Number.isFinite(r.wallTimeMs)&&r.wallTimeMs>=0);
    if(isFeasibleV2(r))assert.deepEqual(independentAuditV2(c.scenario,r),[]);
  }
  const recomputed=summarizeV2(b.cases);
  for(const key of ['caseCount','pairedCaseCount','baselineIncrementalKRW','optimizedIncrementalKRW','incrementalSavingsKRW','weightedIncrementalSavingsPct','weightedTotalSavingsPct','positiveSavingsCount','tiedCount','negativeSavingsCount'])assert.equal(b.summary[key],recomputed[key]);
  assert.deepEqual(b.sensitivity.summary,sensitivitySummary(b.sensitivity.cases));
  if(b.postprocessing) {
    const rawCases=JSON.stringify({cases:b.cases,scaleCases:b.scaleControls.cases,sensitivityCases:b.sensitivity.cases});
    assert.equal(createHash('sha256').update(rawCases).digest('hex'),b.postprocessing.rawCaseCollectionsSHA256);
  }
  for(const c of b.sensitivity.cases)if(c.referenceEvaluation?.strictAblationInterpretation&&c.kind==='objective-ablation')assert.equal(c.policies.optimized.tieBreakStatus,'optimal');
});
