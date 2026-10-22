import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createSourceRecoverySpec,sourceArchivePreflightProgram,sourceArchiveProgram} from '../scripts/prepare-public.mjs';

const sha256=value=>createHash('sha256').update(value).digest('hex');
const hosting={project_id:'YOUR_SITES_PROJECT_ID_opaque_id',static:{directory:'dist',privateSetting:'DO_NOT_EXPORT'},runtimeToken:'DO_NOT_EXPORT'};
const instructions='# 当前项目约定\n公开资料是主路线；企业试点可选，不反复索要。\n';
const generatedAt='2026-10-16T00:00:00.000Z';
async function fixture(){const directory=await mkdtemp(join(tmpdir(),'portplan-recovery-v11-'));for(const path of ['.openai','public/data','public/downloads','data/archives-v10/formal','data/archives-v11/replay','data/archives-v12/formal','.venv-cpsat/lib'])await mkdir(join(directory,path),{recursive:true});await Promise.all([
  writeFile(join(directory,'AGENTS.md'),instructions),writeFile(join(directory,'.openai/hosting.json'),JSON.stringify(hosting)),
  writeFile(join(directory,'.openai/private-runtime.json'),'DO_NOT_EXPORT'),writeFile(join(directory,'.env.local'),'DO_NOT_EXPORT'),
  writeFile(join(directory,'package.json'),'{}\n'),writeFile(join(directory,'package-lock.json'),'{}\n'),
  writeFile(join(directory,'source-recovery.json'),'old recovery metadata must not shadow the new manifest'),
  writeFile(join(directory,'data/archives-v10/formal/part-0001.bin'),Buffer.from([0,1,2,255])),
  writeFile(join(directory,'data/archives-v11/replay/part-0001.bin'),Buffer.from([11,0,255])),
  writeFile(join(directory,'data/archives-v12/formal/part-0001.bin'),Buffer.from([12,0,255])),
  writeFile(join(directory,'.venv-cpsat/lib/local-runtime.txt'),'DO_NOT_EXPORT'),
]);return directory;}

test('recovery configuration preserves opaque Site identity while exporting only safe static fields',()=>{
  const spec=createSourceRecoverySpec(hosting,instructions,generatedAt);
  assert.deepEqual(JSON.parse(spec.hostingText),{project_id:hosting.project_id,static:{directory:'dist'}});
  assert.equal(JSON.stringify(spec).includes('DO_NOT_EXPORT'),false);
  assert.equal(spec.manifest.instructions.sha256,sha256(instructions));assert.equal(spec.manifest.hosting.sha256,sha256(spec.hostingText));
  assert.equal(spec.manifest.gitHistoryIncluded,false);assert.equal(spec.manifest.deploymentCredentialsIncluded,false);
  assert.throws(()=>createSourceRecoverySpec({static:{directory:'dist'}},instructions),/project_id/);
  assert.throws(()=>createSourceRecoverySpec({...hosting,static:{directory:'../private'}},instructions),/static output/);
  assert.throws(()=>createSourceRecoverySpec(hosting,''),/AGENTS/);
});

test('the real packer includes current instructions and safe hosting, preserves raw evidence, and excludes runtime secrets',async()=>{
  const directory=await fixture();try{
    const spec=createSourceRecoverySpec(hosting,instructions,generatedAt),packed=spawnSync('python',['-c',sourceArchiveProgram(directory,spec)],{encoding:'utf8'});
    assert.equal(packed.status,0,packed.stderr);
    const inspect=spawnSync('python',['-c',`from pathlib import Path
from zipfile import ZipFile
import json
root=Path(${JSON.stringify(directory)})
with ZipFile(root/'public/downloads/portplan-source.zip') as archive:
 names=archive.namelist()
 source={'names':names,'instructions':archive.read('portplan/AGENTS.md').decode(),'hosting':json.loads(archive.read('portplan/.openai/hosting.json')),'recovery':json.loads(archive.read('portplan/source-recovery.json'))}
with ZipFile(root/'public/downloads/portplan-experiments-v10.zip') as archive:
 source['evidenceHex']=archive.read('portplan/data/archives-v10/formal/part-0001.bin').hex()
for revision,subdir in [('v11','replay'),('v12','formal')]:
 with ZipFile(root/f'public/downloads/portplan-experiments-{revision}.zip') as archive:
  source[revision]=archive.read(f'portplan/data/archives-{revision}/{subdir}/part-0001.bin').hex()
print(json.dumps(source,ensure_ascii=False))`],{encoding:'utf8'});
    assert.equal(inspect.status,0,inspect.stderr);const source=JSON.parse(inspect.stdout);
    assert.equal(source.instructions,instructions);assert.deepEqual(source.hosting,{project_id:hosting.project_id,static:{directory:'dist'}});
    assert.deepEqual(source.names.filter(name=>name.startsWith('portplan/.openai/')),['portplan/.openai/hosting.json']);
    assert.equal(source.names.some(name=>name.includes('.env')||name.includes('.venv-cpsat')),false);assert.equal(source.names.filter(name=>name==='portplan/source-recovery.json').length,1);
    assert.deepEqual(source.recovery,spec.manifest);assert.equal(source.evidenceHex,'000102ff');assert.equal(source.v11,'0b00ff');assert.equal(source.v12,'0c00ff');
    const saved=JSON.parse(await readFile(join(directory,'public/data/source-recovery-v11.json'),'utf8'));assert.deepEqual(saved,spec.manifest);
    for(const revision of ['v9','v10','v11','v12']){const manifest=JSON.parse(await readFile(join(directory,`public/data/download-packages-${revision}.json`),'utf8'));assert.deepEqual(manifest.sourceRecovery,spec.manifest);for(const entry of manifest.packages){const raw=await readFile(join(directory,'public/downloads',entry.file));assert.equal(raw.length,entry.bytes);assert.equal(sha256(raw),entry.sha256);}}
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('packaging refuses a stale AGENTS snapshot instead of silently exporting an earlier agreement',async()=>{
  const directory=await fixture();try{const spec=createSourceRecoverySpec(hosting,instructions,generatedAt);await writeFile(join(directory,'AGENTS.md'),instructions+'新的明确约定\n');const result=spawnSync('python',['-c',sourceArchiveProgram(directory,spec)],{encoding:'utf8'});assert.notEqual(result.status,0);assert.match(result.stderr,/AGENTS.md changed during packaging/);}finally{await rm(directory,{recursive:true,force:true});}
});

test('preflight rejects linked inputs or outputs before reading recovery content or opening any ZIP',async t=>{
  const cases=[
    ['ordinary external file',async(root,outside)=>symlink(join(outside,'fake-private.txt'),join(root,'innocent-notes.txt'))],
    ['ordinary link to excluded env',async(root)=>symlink(join(root,'.env.local'),join(root,'innocent-notes.txt'))],
    ['ordinary link to excluded hosting state',async(root)=>symlink(join(root,'.openai/private-runtime.json'),join(root,'innocent-notes.json'))],
    ['external directory',async(root,outside)=>symlink(outside,join(root,'copied-docs'),'dir')],
    ['AGENTS file',async(root,outside)=>{await rm(join(root,'AGENTS.md'));await symlink(join(outside,'fake-private.txt'),join(root,'AGENTS.md'));}],
    ['hosting file',async(root,outside)=>{await rm(join(root,'.openai/hosting.json'));await symlink(join(outside,'fake-private.txt'),join(root,'.openai/hosting.json'));}],
    ['hosting parent directory',async(root,outside)=>{await rm(join(root,'.openai'),{recursive:true});await symlink(outside,join(root,'.openai'),'dir');}],
    ['existing output ZIP',async(root,outside)=>symlink(join(outside,'fake-private.txt'),join(root,'public/downloads/portplan-source.zip'))],
    ['public output directory',async(root,outside)=>{await rm(join(root,'public'),{recursive:true});await symlink(outside,join(root,'public'),'dir');}],
    ['stale metadata name',async(root,outside)=>{await rm(join(root,'source-recovery.json'));await symlink(join(outside,'fake-private.txt'),join(root,'source-recovery.json'));}],
    ['dangling file link',async(root,outside)=>symlink(join(outside,'missing-file'),join(root,'innocent-notes.txt'))],
  ];
  for(const [label,arrange]of cases)await t.test(label,async()=>{
    const root=await fixture(),outside=await mkdtemp(join(tmpdir(),'portplan-fake-private-v11-')),fake='TEST_FIXTURE_ONLY_NOT_A_REAL_SECRET';
    try{
      await writeFile(join(outside,'fake-private.txt'),fake);await arrange(root,outside);
      const preflight=spawnSync('python',['-c',sourceArchivePreflightProgram(root,{includeRecoveryInputs:true})],{encoding:'utf8'});
      assert.notEqual(preflight.status,0);assert.match(preflight.stderr,/Symbolic/);assert.equal(preflight.stdout.includes(fake),false);
      const result=spawnSync('python',['-c',sourceArchiveProgram(root,createSourceRecoverySpec(hosting,instructions,generatedAt))],{encoding:'utf8'});
      assert.notEqual(result.status,0);assert.match(result.stderr,/Symbolic/);assert.equal(result.stdout.includes(fake),false);
      assert.equal(await readFile(join(outside,'fake-private.txt'),'utf8'),fake,'Preflight must not truncate an external output-link target.');
      if(label!=='public output directory'){const written=(await readdir(join(root,'public/downloads'))).filter(name=>name.endsWith('.zip'));assert.deepEqual(written,label==='existing output ZIP'?['portplan-source.zip']:[]);}
    }finally{await rm(root,{recursive:true,force:true});await rm(outside,{recursive:true,force:true});}
  });
});

test('a linked project root is refused while excluded npm tool links remain outside the backup',async()=>{
  const root=await fixture(),parent=await mkdtemp(join(tmpdir(),'portplan-root-alias-v11-'));
  try{
    const alias=join(parent,'linked-project');await symlink(root,alias,'dir');
    const rejected=spawnSync('python',['-c',sourceArchivePreflightProgram(alias)],{encoding:'utf8'});assert.notEqual(rejected.status,0);assert.match(rejected.stderr,/Symbolic project roots/);
    await mkdir(join(root,'node_modules/.bin'),{recursive:true});await symlink(join(root,'.env.local'),join(root,'node_modules/.bin/excluded-tool'));
    const checked=spawnSync('python',['-c',sourceArchivePreflightProgram(root,{includeRecoveryInputs:true})],{encoding:'utf8'});assert.equal(checked.status,0,checked.stderr);const inputs=JSON.parse(checked.stdout);assert.equal(inputs.instructions,instructions);assert.deepEqual(inputs.hosting,hosting);
    const packed=spawnSync('python',['-c',sourceArchiveProgram(root,createSourceRecoverySpec(hosting,instructions,generatedAt))],{encoding:'utf8'});assert.equal(packed.status,0,packed.stderr);
  }finally{await rm(root,{recursive:true,force:true});await rm(parent,{recursive:true,force:true});}
});
