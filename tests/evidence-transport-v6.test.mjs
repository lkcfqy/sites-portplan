import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const run=spawnSync('python',['-'],{encoding:'utf8',input:`
import hashlib,importlib.util,json,tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('restore','scripts/restore-evidence-v6.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
payload=b'0123456789'*400001;m.RAW_BYTES=len(payload);m.RAW_SHA=hashlib.sha256(payload).hexdigest()
with tempfile.TemporaryDirectory()as tmp:
 root=Path(tmp);directory=root/'data/archives-v6/rolling-v6';directory.mkdir(parents=True);parts=[]
 for i,start in enumerate(range(0,len(payload),4000000),1):
  block=payload[start:start+4000000];name=f'part-{i:03d}.bin';(directory/name).write_bytes(block);parts.append({'file':name,'bytes':len(block),'sha256':hashlib.sha256(block).hexdigest()})
 manifest={'artifact':'data/rolling-v6.json','bytes':len(payload),'sha256':m.RAW_SHA,'parts':parts};(directory/'manifest.json').write_text(json.dumps(manifest))
 first=m.ensure_evidence(root);target=root/'data/rolling-v6.json';assert target.read_bytes()==payload
 again=m.ensure_evidence(root);assert again['restored']is False
 target.write_bytes(b'corrupt existing')
 try:m.ensure_evidence(root);raise RuntimeError('Corrupt existing was accepted')
 except AssertionError:pass
 assert target.read_bytes()==b'corrupt existing';target.unlink()
 (directory/'part-001.bin').write_bytes(b'X'*4000000)
 try:m.ensure_evidence(root);raise RuntimeError('Corrupt chunk was accepted')
 except AssertionError:pass
 assert not target.exists()and not list((root/'data').glob('.rolling-v6-restore-*'))
 print(json.dumps({'first':first,'second':again,'corruptionRejectedWithoutReplacement':True,'partialRestoreCleaned':True}))
`});
test('lossless transport restores across a chunk boundary and validates existing evidence',()=>{
  assert.equal(run.status,0,run.stderr);const result=JSON.parse(run.stdout);assert.equal(result.first.restored,true);assert.equal(result.first.partsVerified,2);assert.equal(result.second.restored,false);
});
test('corrupt original or transport fails without replacing originals or leaving partial evidence',()=>{
  assert.equal(run.status,0,run.stderr);const result=JSON.parse(run.stdout);assert.equal(result.corruptionRejectedWithoutReplacement,true);assert.equal(result.partialRestoreCleaned,true);
});
