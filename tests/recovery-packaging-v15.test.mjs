import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createSourceRecoverySpec,sourceArchiveProgram} from '../scripts/prepare-public.mjs';

test('V15 development kinds use separate five-chunk groups and all current manifest aliases',async()=>{
  const root=await mkdtemp(join(tmpdir(),'portplan-v15-package-'));
  const hosting={project_id:'YOUR_SITES_PROJECT_ID_fixture',static:{directory:'dist'},privateToken:'DO_NOT_EXPORT'};
  const agents='# 公开研究路线；最新正式V14，V15开发。\n';
  try{
    for(const name of ['.openai','public/data','public/downloads','data/evidence-v15/raw','data/archives-v15/delivery-development','data/archives-v15/browser-first'])await mkdir(join(root,name),{recursive:true});
    await writeFile(join(root,'.openai/hosting.json'),JSON.stringify(hosting));
    await writeFile(join(root,'AGENTS.md'),agents);
    await writeFile(join(root,'data/evidence-v15/raw/large.json'),'RESTORED_RAW_EXCLUDED');
    await symlink(join(root,'AGENTS.md'),join(root,'data/evidence-v15/raw/excluded-link'));
    const originals=new Map();
    for(const [kind,numbers] of [['delivery-development',[1,5,6]],['browser-first',[1,6]]]){
      const manifest=`data/archives-v15/${kind}/manifest.json`;
      originals.set(manifest,Buffer.from('{"kind":"handwritten transport fixture"}\n'));
      for(const n of numbers)originals.set(`data/archives-v15/${kind}/part-${String(n).padStart(4,'0')}.bin`,Buffer.from([15,n,0,255]));
    }
    for(const [path,raw] of originals)await writeFile(join(root,path),raw);
    const result=spawnSync('python',['-B','-c',sourceArchiveProgram(root,createSourceRecoverySpec(hosting,agents,'2026-10-17T00:00:00Z'))],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);
    const scan=spawnSync('python',['-B','-c',`from pathlib import Path
from zipfile import ZipFile
import json,hashlib
items={}
for p in sorted(Path(${JSON.stringify(root)}).joinpath('public/downloads').glob('*.zip')):
 with ZipFile(p) as z:
  for info in z.infolist():
   assert info.filename not in items
   raw=z.read(info)
   items[info.filename]={'zip':p.name,'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
print(json.dumps(items))`],{encoding:'utf8'});
    assert.equal(scan.status,0,scan.stderr);const members=JSON.parse(scan.stdout);
    for(const [path,raw] of originals){
      const kind=path.split('/')[2],match=path.match(/part-(\d+)\.bin$/),group=match?Math.floor((Number(match[1])-1)/5)+1:1;
      assert.deepEqual(members['portplan/'+path],{zip:`portplan-experiments-v15-${kind}${group===1?'':`-part${group}`}.zip`,sha256:createHash('sha256').update(raw).digest('hex'),bytes:raw.length});
    }
    assert.equal(Object.keys(members).some(x=>x.includes('evidence-v15')),false);
    let expected;
    for(let version=9;version<=15;version++){
      const manifest=JSON.parse(await readFile(join(root,`public/data/download-packages-v${version}.json`),'utf8'));
      if(expected)assert.deepEqual(manifest.packages,expected);expected=manifest.packages;
      assert.equal(manifest.schemaVersion,`portplan-v${version}-download-packages`);
    }
  }finally{await rm(root,{recursive:true,force:true});}
});

test('V15 uses the frozen atomic transport with mandatory development receipts, idempotence and conflict protection',()=>{
  const modulePath=resolve('scripts/restore-evidence-v15.py');
  const program=`from pathlib import Path
import tempfile,tarfile,io,json,hashlib,importlib.util
spec=importlib.util.spec_from_file_location('v15_fixture',${JSON.stringify(modulePath)})
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def sha(raw):return hashlib.sha256(raw).hexdigest()
def rejects(fn):
 try:fn()
 except (ValueError,FileNotFoundError):return
 raise AssertionError('Invalid transport accepted')
with tempfile.TemporaryDirectory(prefix='portplan-v15-transport-') as folder:
 root=Path(folder);archive_root='v15-fixture';raw=b'handwritten transport; no research result\\n'
 member='raw/first.json'
 compressed=root/'payload.tar.xz'
 with tarfile.open(compressed,'w:xz') as archive:
  info=tarfile.TarInfo(archive_root+'/'+member);info.size=len(raw);info.mode=0o644;archive.addfile(info,io.BytesIO(raw))
 data=compressed.read_bytes();chunk=root/'part-0001.bin';chunk.write_bytes(data)
 record={'schemaVersion':'portplan-v12-lossless-tar-chunks','kind':'development','archiveFormat':'tar.xz','compression':'xz-lzma2-preset6','archiveRoot':archive_root,'fileCount':1,'uncompressedFileBytes':len(raw),'archiveBytes':len(data),'archiveSha256':sha(data),'entrypoint':member,'entrypointSha256':sha(raw),'files':[{'path':member,'bytes':len(raw),'sha256':sha(raw)}],'chunks':[{'file':chunk.name,'bytes':len(data),'sha256':sha(data)}]}
 manifest=root/'manifest.json'
 def save(value):manifest.write_text(json.dumps(value))
 save(record);destination=root/'restored'
 fresh=m.restore(manifest,destination)
 assert fresh['atomicFreshInstall'] and fresh['singleStagedRawCopy'] and fresh['developmentOnly'] and fresh['optimizerRuns']==0
 target=destination/archive_root/member;assert target.read_bytes()==raw
 repeated=m.restore(manifest,destination);assert not repeated['atomicFreshInstall'] and not repeated['existingEvidenceReplaced']
 target.write_bytes(b'preserve this conflict');rejects(lambda:m.restore(manifest,destination));assert target.read_bytes()==b'preserve this conflict'
 changed={**record,'files':[]};save(changed);rejects(lambda:m.restore(manifest,root/'missing-receipts'));assert not (root/'missing-receipts').exists()
 save({**record,'kind':'formal'});rejects(lambda:m.restore(manifest,root/'false-formal'))
 save(record);(root/'linked-destination').symlink_to(destination,target_is_directory=True);rejects(lambda:m.restore(manifest,root/'linked-destination'))
 chunk.write_bytes(b'changed compressed bytes');rejects(lambda:m.restore(manifest,root/'changed-chunk'));assert not (root/'changed-chunk'/archive_root).exists()
print('tiny V15 development transport fixtures passed')`;
  const result=spawnSync('python',['-B','-c',program],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/tiny V15 development transport fixtures passed/);
});
