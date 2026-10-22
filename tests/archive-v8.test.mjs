import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm,symlink,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const ROOT=new URL('../',import.meta.url),INDEX='{"fixture":true,"evidence":"unchanged"}\n',
  member=(name,data=INDEX,type='file')=>({name,type,data:Buffer.from(data).toString('base64')});
const regular=()=>[member('tiny-v8/results.json'),member('tiny-v8/source/protocol.json','{"fixture":true}\n'),
  member('tiny-v8/raw.bin',Buffer.from([0,1,2,128,255]))];
const BUILD=String.raw`
import base64,hashlib,io,json,sys,tarfile
from pathlib import Path
directory=Path(sys.argv[1]);directory.mkdir(parents=True,exist_ok=True)
request=json.load(sys.stdin);members=request['members'];payload=io.BytesIO()
with tarfile.open(fileobj=payload,mode='w:gz') as archive:
 for source in members:
  info=tarfile.TarInfo(source['name']);data=base64.b64decode(source['data'])
  if source['type']=='symlink':info.type=tarfile.SYMTYPE;info.linkname='/outside-fixture'
  elif source['type']=='hardlink':info.type=tarfile.LNKTYPE;info.linkname='tiny-v8/results.json'
  else:info.size=len(data)
  archive.addfile(info,io.BytesIO(data) if info.isfile() else None)
data=payload.getvalue();chunks=[]
for offset in range(0,len(data),31):
 block=data[offset:offset+31];name='part-%04d.bin'%(len(chunks)+1);(directory/name).write_bytes(block)
 chunks.append(dict(file=name,bytes=len(block),sha256=hashlib.sha256(block).hexdigest()))
record=dict(schemaVersion='portplan-v8-lossless-tar-chunks',kind='development',archiveFormat='tar.gz',archiveRoot='tiny-v8',
 fileCount=len(members),uncompressedFileBytes=sum(len(base64.b64decode(m['data'])) for m in members if m['type']=='file'),
 archiveBytes=len(data),archiveSha256=hashlib.sha256(data).hexdigest(),entrypoint='results.json',
 entrypointSha256=hashlib.sha256(base64.b64decode(members[0]['data'])).hexdigest(),chunks=chunks)
(directory/'manifest.json').write_text(json.dumps(record))
`;
async function fixture(members=regular()) {
  const directory=await mkdtemp(join(tmpdir(),'portplan-v8-archive-test-')),archive=join(directory,'chunks'),destination=join(directory,'restored');
  const built=spawnSync('python3',['-c',BUILD,archive],{input:JSON.stringify({members}),encoding:'utf8'});
  assert.equal(built.status,0,built.stderr);
  return {directory,archive,destination,manifest:join(archive,'manifest.json'),clean:()=>rm(directory,{recursive:true,force:true})};
}
const restore=f=>spawnSync('python3',['scripts/restore-evidence-v8.py','--manifest',f.manifest,'--destination',f.destination],{cwd:ROOT,encoding:'utf8'});
async function absent(path){try{await access(path);return false;}catch(error){if(error.code==='ENOENT')return true;throw error;}}

test('restore reconstructs exact text/binary bytes and repeating it preserves existing evidence',async()=>{
  const f=await fixture();
  try {
    const first=restore(f);assert.equal(first.status,0,first.stderr);
    assert.equal(await readFile(join(f.destination,'tiny-v8/results.json'),'utf8'),INDEX);
    assert.deepEqual(await readFile(join(f.destination,'tiny-v8/raw.bin')),Buffer.from([0,1,2,128,255]));
    const second=restore(f);assert.equal(second.status,0,second.stderr);
    assert.equal(JSON.parse(second.stdout).existingEvidenceReplaced,false);
  }finally {await f.clean();}
});

test('existing byte mismatch rejects the entire restore without replacement or filling missing files',async()=>{
  const f=await fixture();
  try {
    assert.equal(restore(f).status,0);const existing=join(f.destination,'tiny-v8/results.json'),missing=join(f.destination,'tiny-v8/raw.bin');
    await writeFile(existing,'do not replace');await rm(missing);
    const result=restore(f);assert.notEqual(result.status,0);assert.match(result.stderr,/Existing evidence differs/);
    assert.equal(await readFile(existing,'utf8'),'do not replace');assert.equal(await absent(missing),true);
  }finally {await f.clean();}
});

test('a changed chunk is rejected before any evidence is copied',async()=>{
  const f=await fixture();
  try {
    const declaration=JSON.parse(await readFile(f.manifest,'utf8')),path=join(f.archive,declaration.chunks[0].file),bytes=await readFile(path);
    bytes[0]^=1;await writeFile(path,bytes);
    const result=restore(f);assert.notEqual(result.status,0);assert.match(result.stderr,/changed evidence chunk/);
    assert.equal(await absent(join(f.destination,'tiny-v8')),true);
  }finally {await f.clean();}
});

test('unsafe tar paths, duplicate targets and link members are rejected',async()=>{
  const variants=[member('../outside.txt','escaped'),member('tiny-v8/results.json'),member('tiny-v8/./results.json'),
    member('tiny-v8//results.json'),member('tiny-v8/link','', 'symlink'),member('tiny-v8/hard','', 'hardlink')];
  for(const extra of variants) {
    const f=await fixture([...regular(),extra]);
    try {
      const result=restore(f);assert.notEqual(result.status,0,`Unsafe member accepted: ${extra.name} (${extra.type})`);
      assert.match(result.stderr,/unsafe archive member|Duplicate|duplicate|noncanonical|normalized/i);
      assert.equal(await absent(join(f.destination,'tiny-v8')),true);
    }finally {await f.clean();}
  }
});

test('an existing destination symlink cannot redirect restored evidence outside its root',async()=>{
  const f=await fixture();
  try {
    const outside=join(f.directory,'outside');await mkdir(outside);await mkdir(join(f.destination,'tiny-v8'),{recursive:true});
    await symlink(outside,join(f.destination,'tiny-v8/source'));
    const result=restore(f);assert.notEqual(result.status,0);assert.match(result.stderr,/symlink escapes/);
    assert.equal(await absent(join(outside,'protocol.json')),true);assert.equal(await absent(join(f.destination,'tiny-v8/results.json')),true);
  }finally {await f.clean();}
});

test('entrypoint path/hash validation finishes before any destination evidence is copied',async()=>{
  for(const change of [{entrypoint:'../outside.json'},{entrypointSha256:'0'.repeat(64)}]) {
    const f=await fixture();
    try {
      const declaration=JSON.parse(await readFile(f.manifest,'utf8'));await writeFile(f.manifest,JSON.stringify({...declaration,...change}));
      const result=restore(f);assert.notEqual(result.status,0);assert.match(result.stderr,/entrypoint/);
      assert.equal(await absent(join(f.destination,'tiny-v8')),true,'Invalid declaration must not leave apparent restored evidence.');
    }finally {await f.clean();}
  }
});

test('the real development packager round trips tiny completed evidence into chunked restore',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'portplan-v8-package-test-'));
  try {
    const source=join(directory,'tiny-development'),archive=join(directory,'archive');await mkdir(source);
    const index=JSON.stringify({executionState:'complete',dataRole:'development_only',implementationHashes:{},taskCount:1,
      results:[{fixture:true}],protocolHash:'fixture-protocol'});
    await writeFile(join(source,'results.json'),index);await writeFile(join(source,'protocol.json'),'{"fixture":true}');
    await writeFile(join(source,'audit.json'),JSON.stringify({valid:true,resultSHA256:createHash('sha256').update(index).digest('hex')}));
    const packaged=spawnSync('python3',['-c',String.raw`
import importlib.util,sys
from pathlib import Path
spec=importlib.util.spec_from_file_location('fixture_packager',sys.argv[1]);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
m.ROOT=Path(sys.argv[2]);m.CHUNK_BYTES=64
sys.argv=['archive-fixture','--development',sys.argv[3],'--destination',sys.argv[4]];m.main()
`,new URL('../scripts/archive-evidence-v8.py',import.meta.url).pathname,directory,source,archive],{cwd:ROOT,encoding:'utf8'});
    assert.equal(packaged.status,0,packaged.stderr);const record=JSON.parse(await readFile(join(archive,'manifest.json'),'utf8'));
    assert.ok(record.chunks.length>1);assert.equal(record.fileCount,3);assert.equal(record.kind,'development');
    const destination=join(directory,'restored'),restored=restore({manifest:join(archive,'manifest.json'),destination});
    assert.equal(restored.status,0,restored.stderr);assert.equal(await readFile(join(destination,'tiny-development/results.json'),'utf8'),index);
  }finally {await rm(directory,{recursive:true,force:true});}
});
