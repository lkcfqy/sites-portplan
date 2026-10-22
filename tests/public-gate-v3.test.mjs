import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';

test('public observed duration archive independently reproduces chronological selection and held-out errors',async()=>{
  const run=spawnSync('python',['scripts/review-public-gate-v3.py'],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  assert.equal(run.status,0,run.stderr||run.stdout);
  const result=JSON.parse(run.stdout);
  assert.equal(result.status,'pass');assert.deepEqual(result.errors,[]);
  assert.equal(result.counts.records,58171);
  assert.equal(result.counts.trainCount+result.counts.validationCount+result.counts.testCount,result.counts.records);
  const output=JSON.parse(await readFile(new URL('../data/public-gate-validation-v3.json',import.meta.url)));
  assert.equal(output.summary.sourceType,'public_observed_gate_visits');
  assert.ok(output.limitations.some(x=>x.includes('not PNC')));
  assert.ok(output.protocol.featuresKnownAtEntry.every(x=>!x.includes('exit')));
});
