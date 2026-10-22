import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('V15 independent economic/receipt/deadline Python fixtures require no solver',()=>{
  const checked=spawnSync('python3',['-B','tests/review-delivery-v15-fixtures.py','-v'],{cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:30000});
  assert.equal(checked.status,0,checked.stdout+'\n'+checked.stderr);assert.match(checked.stderr,/Ran \d+ tests/);
});
