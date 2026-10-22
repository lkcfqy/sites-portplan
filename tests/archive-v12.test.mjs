import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

test('XZ chunk recovery retains exact files, is idempotent and rejects mutation or escaping members',()=>{
  const script=fileURLToPath(new URL('../scripts/restore-evidence-v12.py',import.meta.url));
  const program=String.raw`
import hashlib,importlib.util,io,json,tarfile,tempfile
from pathlib import Path
spec=importlib.util.spec_from_file_location('restore_v12',${JSON.stringify(script)})
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
sha=lambda b:hashlib.sha256(b).hexdigest()
with tempfile.TemporaryDirectory() as tmp:
 root=Path(tmp);chunks=root/'chunks';chunks.mkdir();destination=root/'restored'
 files={'first-run/complete.json':b'{"complete":true,"negativeFees":null}\n','source/original.bin':bytes(range(256))*31}
 def pack(member_override=None):
  archive=io.BytesIO()
  with tarfile.open(fileobj=archive,mode='w:xz',preset=6) as tar:
   for name,raw in files.items():
    info=tarfile.TarInfo(member_override if member_override and name.endswith('.bin') else 'tiny-frozen/'+name)
    info.size=len(raw);tar.addfile(info,io.BytesIO(raw))
  raw=archive.getvalue();items=[]
  for i,start in enumerate(range(0,len(raw),117)):
   name=f'part-{i+1:04d}.bin';block=raw[start:start+117];(chunks/name).write_bytes(block)
   items.append({'file':name,'bytes':len(block),'sha256':sha(block)})
  record={'schemaVersion':'portplan-v12-lossless-tar-chunks','archiveFormat':'tar.xz','compression':'xz-lzma2-preset6',
   'archiveRoot':'tiny-frozen','fileCount':len(files),'uncompressedFileBytes':sum(map(len,files.values())),
   'archiveBytes':len(raw),'archiveSha256':sha(raw),'chunks':items,'entrypoint':'first-run/complete.json',
   'entrypointSha256':sha(files['first-run/complete.json'])}
  manifest=chunks/'manifest.json';manifest.write_text(json.dumps(record));return manifest
 manifest=pack();first=module.restore(manifest,destination);second=module.restore(manifest,destination)
 assert first['restored'] and second['restored'] and second['existingEvidenceReplaced'] is False
 for name,raw in files.items():assert (destination/'tiny-frozen'/name).read_bytes()==raw
 (destination/'tiny-frozen/source/original.bin').write_bytes(b'changed existing evidence')
 try:module.restore(manifest,destination);raise AssertionError('accepted changed target')
 except ValueError as e:assert 'Existing evidence differs' in str(e)
 manifest=pack();part=chunks/'part-0001.bin';part.write_bytes(part.read_bytes()+b'bad')
 try:module.restore(manifest,root/'corrupt-output');raise AssertionError('accepted corrupt chunk')
 except ValueError as e:assert 'Missing or changed' in str(e)
 manifest=pack('../outside-fixture.bin')
 try:module.restore(manifest,root/'unsafe-output');raise AssertionError('accepted escaping member')
 except ValueError as e:assert 'unsafe archive member' in str(e)
 assert not (root/'outside-fixture.bin').exists()
 print('exact / idempotent / corruption / escaping checks passed')
`;
  const result=spawnSync('python',['-c',program],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
