import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('V14 lossless restoration installs one staged raw copy and rejects changed, unsafe or incomplete evidence',()=>{
  const r=spawnSync('python',['-B','tests/archive-v14-fixtures.py'],{encoding:'utf8'});
  assert.equal(r.status,0,r.stdout+r.stderr);
});
