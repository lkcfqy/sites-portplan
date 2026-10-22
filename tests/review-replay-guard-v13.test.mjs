import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('V13 independent Python guard/import/coverage fixtures reject forged evidence without any optimizer',()=>{
  const checked=spawnSync('python3',['tests/review-replay-guard-v13-fixtures.py','-v'],{
    cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:30000});
  assert.equal(checked.status,0,checked.stdout+'\n'+checked.stderr);
  assert.match(checked.stderr,/Ran 19 tests/);
});
