import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const frozenHash='cc909a901e5d340e6bd3f84fc6855eaf188cec129e1cfe44480b7de87be34430';

test('public reproduction protocol retains both parameter variants, tracks, fixed seeds and reduced budget',async()=>{
  const raw=await readFile(new URL('../data/public-reproduction-protocol-v3.json',import.meta.url));
  assert.equal(createHash('sha256').update(raw).digest('hex'),frozenHash);
  const p=JSON.parse(raw);assert.equal(p.runs.length,12);assert.deepEqual(p.seeds,[31001,31002,31003]);
  assert.equal(p.budget.ants,10);assert.equal(p.budget.iterations,4);assert.equal(p.budget.timeoutSeconds,30);
  assert.equal(p.variants.code.t1,3);assert.equal(p.variants.paper.t1,3.5);
  assert.equal(p.variants.code.t3,6);assert.equal(p.variants.paper.t3,2.5);
  assert.equal(p.variants.code.slot_limit[1][8],47);assert.equal(p.variants.paper.slot_limit[1][8],37);
});

test('original archive remains unchanged, all algorithm functions retain their AST and checker catches definite defects',()=>{
  const result=execFileSync('python',['-'],{cwd:new URL('..',import.meta.url),input:`
import importlib.util,json,zipfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('public_reproduction','scripts/reproduce-public-v3.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
_,defaults,inputs,source=m.load_original()
protocol=json.loads(Path('data/public-reproduction-protocol-v3.json').read_text())
assert source==protocol['source']
with zipfile.ZipFile(m.ARCHIVE) as archive:
 assert not any(name.endswith('/distance2') for name in archive.namelist())
params=m.parameters(defaults,'code')
fake={'path':[[5,1]],'total_node_time_list':[[0]],'time_list':[[0]*12,[42]+[0]*11]}
audit=m.independent_audit(fake,params,inputs)
assert audit['status']=='reported_cost_unverified'
assert any('length mismatch' in message for message in audit['errors'])
assert audit['capacityViolations'][0]['slot']==1
assert audit['directionalTaskCompletionStatus']=='unverified_from_unlabeled_routes'
assert audit['timeWindowComplianceStatus']=='unverified_from_unlabeled_routes'
assert audit['expectedTaskTotal']==592
assert any('296' in message for message in audit['errors'])
print('passed')
`,encoding:'utf8'});
  assert.equal(result.trim(),'passed');
});

test('public reproduction archive retains every run and never converts unverified costs to a PortPlan comparison',async()=>{
  const r=JSON.parse(await readFile(new URL('../data/external-reproduction-v3.json',import.meta.url)));
  assert.equal(r.executionState,'complete');assert.equal(r.protocolSHA256,frozenHash);assert.equal(r.runs.length,12);
  assert.equal(r.summary.independentlyCostVerifiedCount,0);assert.equal(r.summary.fullBenchmarkReproduction,false);assert.equal(r.summary.comparedWithPortPlan,false);
  assert.equal(new Set(r.runs.map(run=>run.id)).size,12);
  for(const run of r.runs) {
    assert.ok(Number.isFinite(run.wallSeconds)&&run.wallSeconds>=0);
    if(run.track==='original-files')assert.equal(run.distance2Alias,false);
    if(run.status==='completed_reported_cost_unverified') {
      assert.equal(run.audit.status,'reported_cost_unverified');assert.equal(run.bestCostByIteration.length,4);
      assert.ok(Number.isFinite(run.reportedCost));
    } else assert.equal(run.reportedCost??null,null);
  }
});
