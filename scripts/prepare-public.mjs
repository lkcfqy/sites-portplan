import { mkdir, cp, readdir, stat, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {GZIP_EVIDENCE_FILES} from '../src/evidence-paths-v12.js';

const root = resolve(import.meta.dirname, '..');
const historicalPolicyRecordsSha256='371bbb3e4f5ed501bb3382533c15b0a52d94c6d87a7c6c36b50eef4cb58fd805';

/** Only non-secret Site identity and static output location travel with the ZIP. */
export function createSourceRecoverySpec(hosting, instructions, generatedAt=new Date().toISOString()) {
  if (!hosting || typeof hosting.project_id!=='string' || !hosting.project_id.trim()) throw new Error('A saved Sites project_id is required for recovery.');
  const directory=hosting.static?.directory;
  if (!['dist','dist/client','out','build','.output/public'].includes(directory)) throw new Error('A supported static output directory is required for recovery.');
  if (typeof instructions!=='string' || !instructions.trim()) throw new Error('The current AGENTS.md must be included in the source backup.');
  const safeHosting={project_id:hosting.project_id,static:{directory}};
  const hostingText=JSON.stringify(safeHosting,null,2)+'\n';
  const sha256=text=>createHash('sha256').update(text).digest('hex');
  return {hostingText,manifest:{schemaVersion:'portplan-source-recovery-v11',generatedAt,archiveRoot:'portplan/',
    instructions:{path:'AGENTS.md',sha256:sha256(instructions)},
    hosting:{path:'.openai/hosting.json',sha256:sha256(hostingText),projectId:safeHosting.project_id,staticDirectory:directory,scope:'Site identity and static directory only; no credentials or private runtime settings.'},
    deploymentCredentialsIncluded:false,gitHistoryIncluded:false,
    dependencyRule:'Install Node.js and Python on the new machine, then run npm ci. node_modules, caches, environment variables and credentials do not migrate.',
    startupCommands:['npm ci','npm run build','npm run dev'],
    researchEvidenceRule:'Download every package listed in the matching download-packages manifest and extract to one shared parent directory. Frozen research archives and their original hashes remain unchanged.'}};
}

export async function preparePublic() {
const preflight=spawnSync('python',['-c',sourceArchivePreflightProgram(root,{includeRecoveryInputs:true,requireHistoricalPolicy:true})],{encoding:'utf8'});
if(preflight.status!==0)throw new Error(preflight.stderr||'Source backup path preflight failed.');
const recoveryInputs=JSON.parse(preflight.stdout);
const recovery=createSourceRecoverySpec(recoveryInputs.hosting,recoveryInputs.instructions);
for (const revision of ['v6','v7']) {
  const restore=spawnSync('python',[resolve(root,`scripts/restore-evidence-${revision}.py`)],{encoding:'utf8'});
  if(restore.status!==0)throw new Error(restore.stderr||'Frozen evidence restoration failed');
  const projection=spawnSync('node',[resolve(root,`scripts/build-view-${revision}.mjs`),'--ensure'],{encoding:'utf8'});
  if(projection.status!==0)throw new Error(projection.stderr||'Browser evidence verification failed');
}
const packageInfo = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
await rm(resolve(root, 'public'), { recursive: true, force: true });
await mkdir(resolve(root, 'public/data'), { recursive: true });
await mkdir(resolve(root, 'public/downloads'), { recursive: true });
const gzipEvidence = GZIP_EVIDENCE_FILES;
for (const name of await readdir(resolve(root, 'data'))) {
  if (name.endsWith('.json') && !['rolling-v6.json','rolling-certificates-v6.json','rolling-v7.json',...gzipEvidence].includes(name)) await cp(resolve(root, 'data', name), resolve(root, 'public/data', name));
}
const staticTransports = [];
for (const name of gzipEvidence) {
  const original = await readFile(resolve(root, 'data', name));
  const compressed = gzipSync(original, { level: 9 });
  await writeFile(resolve(root, 'public/data', name+'.gz'), compressed);
  staticTransports.push({source:'data/'+name,url:'/data/'+name+'.gz',encoding:'gzip',
    originalBytes:original.length,originalSha256:createHash('sha256').update(original).digest('hex'),
    transportBytes:compressed.length,transportSha256:createHash('sha256').update(compressed).digest('hex')});
}
await writeFile(resolve(root,'public/data/static-transports-v10.json'),JSON.stringify({
  schemaVersion:'portplan-static-lossless-transports-v10',transports:staticTransports,
  scope:'Lossless static transfer only. Decompressed bytes equal the original JSON; original files remain in source/experiment ZIPs.'},null,2)+'\n');
await writeFile(resolve(root,'public/data/static-transports-v12.json'),JSON.stringify({
  schemaVersion:'portplan-static-lossless-transports-v12',transports:staticTransports,
  scope:'Lossless transport aliases for historical evidence. Source originals, formal hashes and all historical outcomes remain unchanged.'},null,2)+'\n');
for (const name of ['pilot-container-fields-v9.csv','pilot-orders-and-baseline-v10.csv','pilot-resources-and-quotes-v10.csv','pilot-fees-and-feedback-v10.csv','pilot-entrant-rehearsal-v10.csv']) {
  await cp(resolve(root, 'data', name), resolve(root, 'public/data', name));
}
const sourceData = resolve(root, 'data/public');
for (const name of await readdir(sourceData)) {
  const p = resolve(sourceData, name);
  const info = await stat(p);
  if (info.isFile() && info.size < 2_000_000 && /\.(json|csv|pdf|png|txt)$/.test(name)) {
    await mkdir(resolve(root, 'public/data/public'), { recursive: true });
    await cp(p, resolve(root, 'public/data/public', name));
  }
}
await cp(resolve(sourceData, 'ygpa_gate_statistics.json'), resolve(root, 'public/data/ygpa_gate_statistics.json'));
for (const name of await readdir(resolve(root, 'docs'))) {
  if (/\.(md|json|pdf|pptx|txt)$/.test(name) || /^defense-v\d+(?:\.[a-z]+)?\.html$/.test(name)) await cp(resolve(root, 'docs', name), resolve(root, 'public/downloads', name));
}
const metadata = {
  name: 'PortPlan', version: packageInfo.version, researchVersion: '15.0.0-development', candidateMethod: 'timelyHiGHSV15',
  latestFormalResearchVersion: '14.0.0', researchScope: 'Seen V14 endpoint development replay; not new business samples or natural full-D0 formal validation.', generatedAt: new Date().toISOString(),
  purpose: 'LogisticSolver competition research prototype',
  scenarioEvidence: 'Synthetic orders; official public tariff benchmark; separate public gate-record context',
  timezone: 'Asia/Seoul',
};
await writeFile(resolve(root, 'public/data/build.json'), JSON.stringify(metadata, null, 2));
const result = spawnSync('python', ['-c', sourceArchiveProgram(root,recovery,{requireHistoricalPolicy:true})], { encoding: 'utf8' });
if (result.status !== 0) throw new Error(result.stderr || 'Source archive failed');
console.log('Prepared reviewed data, documentation, and reproducible source archive.');
}

/** Export the real packer so small fixtures can check recovery without a build. */
function sourceArchivePathGuards(rootPath,{requireHistoricalPolicy=false}={}) {
return `
from pathlib import Path
from contextlib import contextmanager
import os,stat,time,shutil,json,hashlib,subprocess
root=Path(${JSON.stringify(rootPath)})
if stat.S_ISLNK(root.lstat().st_mode):
 raise RuntimeError('Symbolic project roots are not allowed for source recovery.')
if not stat.S_ISDIR(root.lstat().st_mode):
 raise RuntimeError('Source recovery root must be a directory.')
root=root.resolve(strict=True)
skip={'node_modules','dist','.git','.openai','.cache','artifacts','__pycache__','evidence-v8','evidence-v9','evidence-v10','evidence-v11','evidence-v12','evidence-v13','evidence-v14','evidence-v15','.venv','.venvs','venv','.venv-cpsat'}
def checked(path,required=True):
 try: info=path.lstat()
 except FileNotFoundError:
  if not required: return None
  raise RuntimeError('Missing recovery input: '+str(path.relative_to(root)))
 if stat.S_ISLNK(info.st_mode):
  raise RuntimeError('Symbolic links are not allowed in recovery paths: '+str(path.relative_to(root)))
 try: path.resolve(strict=True).relative_to(root)
 except (ValueError,RuntimeError):
  raise RuntimeError('Recovery path resolves outside the project: '+str(path.relative_to(root)))
 if not (stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode)):
  raise RuntimeError('Recovery paths must be regular files or directories: '+str(path.relative_to(root)))
 return info
def checked_file(path):
 info=checked(path)
 if not stat.S_ISREG(info.st_mode):
  raise RuntimeError('Recovery input must be a regular file: '+str(path.relative_to(root)))
 return info
def source_candidates(folder):
 paths=[]
 for path in sorted(folder.iterdir()):
  info=checked(path)
  rel=path.relative_to(root)
  if rel.parts[0]=='public' or rel.as_posix()=='source-recovery.json' or any(part in skip for part in rel.parts) or path.name.startswith('.env'):
   continue
  if stat.S_ISDIR(info.st_mode): paths.extend(source_candidates(path))
  else: paths.append(path)
 return paths
def check_output_tree(folder):
 info=checked(folder,required=False)
 if info is None: return
 if not stat.S_ISDIR(info.st_mode):
  raise RuntimeError('Recovery output must be a directory: '+str(folder.relative_to(root)))
 for path in sorted(folder.iterdir()):
  info=checked(path)
  if stat.S_ISDIR(info.st_mode): check_output_tree(path)
def preflight():
 checked(root)
 checked(root/'.openai')
 checked_file(root/'.openai/hosting.json')
 checked_file(root/'AGENTS.md')
 paths=source_candidates(root)
 check_output_tree(root/'public')
 return sorted(paths)
@contextmanager
def checked_reader(path):
 expected=checked_file(path)
 descriptor=os.open(path,os.O_RDONLY|getattr(os,'O_BINARY',0)|getattr(os,'O_NOFOLLOW',0))
 with os.fdopen(descriptor,'rb') as handle:
  actual=os.fstat(handle.fileno())
  if not stat.S_ISREG(actual.st_mode) or (actual.st_dev,actual.st_ino)!=(expected.st_dev,expected.st_ino):
   raise RuntimeError('Recovery input changed during safe opening: '+str(path.relative_to(root)))
  checked_file(path)
  yield handle,actual
def read_checked(path):
 with checked_reader(path) as (handle,info): return handle.read()
def canonical_bytes(value): return json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf-8')
def file_binding(path):
 with checked_reader(path) as (handle,info):
  digest=hashlib.sha256()
  for block in iter(lambda:handle.read(1024*1024),b''):digest.update(block)
 return {'bytes':info.st_size,'sha256':digest.hexdigest()}
def historical_transport(paths):
 policy_path=root/'data/historical-transport-policy-v14.json'
 if checked(policy_path,required=False) is None:
  if ${requireHistoricalPolicy?'True':'False'}:raise RuntimeError('V14 historical transport policy is required; no implicit omission is allowed.')
  return None
 policy_raw=read_checked(policy_path)
 policy=json.loads(policy_raw)
 records=policy.get('omittedFiles')
 if (policy.get('schemaVersion')!='portplan-historical-transport-policy-v14' or not isinstance(records,list)
     or len(records)!=22 or hashlib.sha256(canonical_bytes(records)).hexdigest()!=${JSON.stringify(historicalPolicyRecordsSha256)}
     or policy.get('omittedRecordsSha256')!=${JSON.stringify(historicalPolicyRecordsSha256)}
     or policy.get('omittedFileCount')!=22 or policy.get('omittedFileBytes')!=73513198):
  raise RuntimeError('Historical policy must contain exactly the fixed 22 V8/V9 binary byte/SHA receipts.')
 primary=policy.get('primaryRecovery',{})
 secondary=policy.get('secondaryRecord',{})
 if (primary.get('commit')!='f99d252180d87ef616278ca8e14e17b496480fb4'
     or primary.get('kind')!='authorized-private-sites-source-git'
     or primary.get('projectId')!='YOUR_SITES_PROJECT_ID'
     or secondary.get('savedVersionId')!='YOUR_SITES_PROJECT_ID~appgver_387ea040c75481918d2412f31941b8d7'
     or secondary.get('liveSiteUrlIsImmutableHistoricalDownload') is not False
     or json.loads(read_checked(root/'.openai/hosting.json')).get('project_id')!=primary['projectId']):
  raise RuntimeError('Historical recovery must retain the fixed authorized Git source and private saved-version identity.')
 omission={item['path']:item for item in records}
 current={p.relative_to(root).as_posix():p for p in paths}
 missing=[]
 for name,item in omission.items():
  if name in current:
   if file_binding(current[name])!={key:item[key] for key in ('bytes','sha256')}:
    raise RuntimeError('Historical binary differs from fixed receipt; refusing omission: '+name)
  else:missing.append(name)
 inherited=None
 prior=root/'source-recovery.json'
 if checked(prior,required=False) is not None:
  previous=json.loads(read_checked(prior))
  previous_policy=previous.get('historicalOmissions',{})
  coverage=previous.get('sourceCoverage',{})
  if previous_policy.get('policySha256')==hashlib.sha256(policy_raw).hexdigest() and previous_policy.get('omittedRecordsSha256')==policy['omittedRecordsSha256']:
   required=coverage.get('files')
   if (previous.get('archiveRoot')!='portplan/' or not isinstance(required,list) or not required
       or coverage.get('inventorySha256')!=hashlib.sha256(canonical_bytes(required)).hexdigest()):
    raise RuntimeError('Recovered retained-source inventory is missing or inconsistent.')
   if any(not isinstance(item,dict) or set(item)!=set(('path','bytes','sha256')) or type(item.get('bytes')) is not int or item['bytes']<0
          or not isinstance(item.get('sha256'),str) or len(item['sha256'])!=64 or any(c not in '0123456789abcdef' for c in item['sha256']) for item in required):
    raise RuntimeError('Recovered retained-source inventory has invalid byte/SHA receipts.')
   names=[item.get('path') for item in required]
   if len(names)!=len(set(names)) or any(not isinstance(name,str) or name not in current or name in omission for name in names):
    raise RuntimeError('A retained source file is missing; only the exact 22 historical binaries may be absent.')
   if 'data/historical-transport-policy-v14.json' not in names or 'AGENTS.md' not in names:
    raise RuntimeError('Recovered source coverage omits its policy or current instructions.')
   inherited=coverage
 if inherited is None:
  if missing:raise RuntimeError('Historical binaries absent without a current-bundle source coverage receipt; restore the declared Git source or all retained ZIPs.')
  for name,item in omission.items():
   verified=subprocess.run(['git','-C',str(root),'cat-file','blob',primary['commit']+':'+name],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
   if (verified.returncode!=0 or len(verified.stdout)!=item['bytes'] or hashlib.sha256(verified.stdout).hexdigest()!=item['sha256']):
    raise RuntimeError('Complete-source first omission requires the fixed Git commit bytes: '+name)
 return {'policy':policy,'omitted':omission,'mode':'retained-bundle-recovery' if inherited is not None else 'complete-source-and-fixed-git-verified',
         'descriptor':{'scope':'current-source-and-retained-evidence; exactly 22 historical binary chunks require separate authorized recovery',
          'policyPath':'data/historical-transport-policy-v14.json','policyUrl':'/data/historical-transport-policy-v14.json',
          'policyBytes':len(policy_raw),'policySha256':hashlib.sha256(policy_raw).hexdigest(),
          'omittedFileCount':22,'omittedFileBytes':73513198,'omittedRecordsSha256':policy['omittedRecordsSha256'],
          'omittedFiles':records,'primaryRecovery':primary,'secondaryRecord':secondary,'recoveryGuide':'/downloads/recovery-v14.zh.md'}}
def archive_checked(archive,path,name):
 from zipfile import ZipInfo
 with checked_reader(path) as (source,info):
  stamp=time.localtime(info.st_mtime)[:6]
  if stamp[0]<1980: stamp=(1980,1,1,0,0,0)
  if stamp[0]>2107: stamp=(2107,12,31,23,59,58)
  entry=ZipInfo(str(name),stamp)
  entry.create_system=3
  entry.external_attr=info.st_mode<<16
  entry.file_size=info.st_size
  entry.compress_type=archive.compression
  entry._compresslevel=archive.compresslevel
  with archive.open(entry,'w') as target: shutil.copyfileobj(source,target,1024*1024)
candidates=preflight()
historical=historical_transport(candidates)
if historical is not None:candidates=[p for p in candidates if p.relative_to(root).as_posix() not in historical['omitted']]
`;
}

export function sourceArchivePreflightProgram(rootPath,{includeRecoveryInputs=false,requireHistoricalPolicy=false}={}) {
  return sourceArchivePathGuards(rootPath,{requireHistoricalPolicy})+(includeRecoveryInputs?"\nimport json\nprint(json.dumps({'hosting':json.loads(read_checked(root/'.openai/hosting.json')),'instructions':read_checked(root/'AGENTS.md').decode('utf-8')}))\n":"\nprint('Source recovery path preflight passed.')\n");
}

export function sourceArchiveProgram(rootPath,recoverySpec,{requireHistoricalPolicy=false}={}) {
return sourceArchivePathGuards(rootPath,{requireHistoricalPolicy})+`
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib,json
recovery=json.loads(${JSON.stringify(JSON.stringify(recoverySpec.manifest))})
hosting_bytes=${JSON.stringify(recoverySpec.hostingText)}.encode('utf-8')
agents_bytes=read_checked(root/'AGENTS.md')
if hashlib.sha256(agents_bytes).hexdigest()!=recovery['instructions']['sha256']:
 raise RuntimeError('AGENTS.md changed during packaging; restart with the latest instructions.')
original_hosting=json.loads(read_checked(root/'.openai/hosting.json'))
safe_hosting={'project_id':original_hosting['project_id'],'static':{'directory':original_hosting['static']['directory']}}
if json.loads(hosting_bytes)!=safe_hosting or hashlib.sha256(hosting_bytes).hexdigest()!=recovery['hosting']['sha256']:
 raise RuntimeError('Sites project identity changed during packaging; do not create a mismatched recovery ZIP.')
coverage=[{'path':p.relative_to(root).as_posix(),**file_binding(p)} for p in candidates] if historical is not None else None
if historical is not None:
 recovery['historicalOmissions']=historical['descriptor']
 recovery['sourceCoverage']={'files':coverage,'inventorySha256':hashlib.sha256(canonical_bytes(coverage)).hexdigest(),
  'scope':'Every retained source path is required on clean bundle recovery. Hashes record this packaging snapshot; subsequent retained-source edits are recorded by the next packaging.',
  'verificationBasis':historical['mode']}
 recovery['researchEvidenceRule']='Current ZIPs restore retained source/evidence only. Exactly 22 listed V8/V9 historical binary chunks require the fixed authorized Git source; consult historical-transport-policy-v14.json and recovery-v14.zh.md. ZIPs contain no Git history.'
recovery_bytes=(json.dumps(recovery,ensure_ascii=False,indent=2)+'\\n').encode('utf-8')
archives={
 'source':ZipFile(root/'public/downloads/portplan-source.zip','w',ZIP_DEFLATED,compresslevel=9),
 'solverSource':ZipFile(root/'public/downloads/portplan-solver-source.zip','w',ZIP_DEFLATED,compresslevel=9),
 'experiments':ZipFile(root/'public/downloads/portplan-experiments-v6.zip','w',ZIP_DEFLATED,compresslevel=9),
 'experimentsV7':ZipFile(root/'public/downloads/portplan-experiments-v7.zip','w',ZIP_DEFLATED,compresslevel=9),
 'experimentsV8':ZipFile(root/'public/downloads/portplan-experiments-v8.zip','w',ZIP_DEFLATED,compresslevel=6),
 'experimentsV8Part2':ZipFile(root/'public/downloads/portplan-experiments-v8-part2.zip','w',ZIP_DEFLATED,compresslevel=6),
 'inputs':ZipFile(root/'public/downloads/portplan-public-inputs-v6.zip','w',ZIP_DEFLATED,compresslevel=9),
}
counts=dict.fromkeys(archives,0)
try:
 archives['source'].writestr('portplan/.openai/hosting.json',hosting_bytes)
 archives['source'].writestr('portplan/source-recovery.json',recovery_bytes)
 counts['source']+=2
 for p in candidates:
  rel=p.relative_to(root)
  if p.is_file() and rel.parts[0] != 'public' and rel.as_posix()!='source-recovery.json' and not any(x in skip for x in rel.parts) and not p.name.startswith('.env'):
   name=rel.as_posix()
   group='inputs' if name.startswith(('data/public/v6-data-sources/','data/public/v7-external-methods/','data/public/v7-validation/')) else 'experiments' if name.startswith('data/archives-v6/') or name in {'data/rolling-v6.json','data/rolling-certificates-v6.json'} else 'experimentsV7' if name.startswith('data/archives-v7/') or name in {'data/rolling-v7.json','data/rolling-v7-view.json','data/public-resource-v7.json'} else 'experimentsV8' if name.startswith('data/archives-v8/') else 'source'
   if name.startswith('vendor/source/'):
    group='solverSource'
   if name.startswith('data/archives-v8/formal/part-') and int(p.stem.split('-')[1]) >= 5:
    group='experimentsV8Part2'
   if name.startswith(('data/archives-v9/','data/archives-v10/','data/archives-v11/','data/archives-v12/','data/archives-v13/','data/archives-v14/','data/archives-v15/')):
    revision=rel.parts[1].removeprefix('archives-')
    shard=(int(p.stem.split('-')[1])-1)//5+1 if p.name.startswith('part-') and p.suffix=='.bin' else 1
    kind=rel.parts[2] if revision in ('v14','v15') and len(rel.parts)>3 else None
    if kind is not None:
     if not kind or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in kind) or kind.startswith('-') or kind.endswith('-'):
      raise RuntimeError('Archive kind must be a safe lowercase filename component: '+str(rel))
     group='experiments'+revision.upper()+':'+kind+':'+str(shard)
    else:
     group='experiments'+revision.upper()+'Part'+str(shard)
    if group not in archives:
     suffix='-'+kind if kind is not None and kind!='formal' else ''
     filename='portplan-experiments-'+revision+suffix+('' if shard==1 else '-part'+str(shard))+'.zip'
     if any(Path(output.filename).name==filename for output in archives.values()):
      raise RuntimeError('Archive kind/ordinal would create a duplicate ZIP filename: '+filename)
     archives[group]=ZipFile(root/'public/downloads'/filename,'w',ZIP_DEFLATED,compresslevel=6)
     counts[group]=0
   maximum=250_000_000 if group in {'experiments','experimentsV7','experimentsV8'} else 50_000_000
   if checked_file(p).st_size >= maximum:
    raise RuntimeError('Source file too large to silently omit: '+str(rel))
   archive_checked(archives[group],p,Path('portplan')/rel)
   counts[group]+=1
finally:
 for archive in archives.values():archive.close()
with checked_reader(root/'public/downloads/portplan-source.zip') as (source_handle,source_info), ZipFile(source_handle) as source_zip:
 names=source_zip.namelist()
 if len(names)!=len(set(names)):
  raise RuntimeError('Duplicate source ZIP entries would make recovery ambiguous.')
 if source_zip.read('portplan/AGENTS.md')!=agents_bytes or source_zip.read('portplan/.openai/hosting.json')!=hosting_bytes:
  raise RuntimeError('The source ZIP did not preserve current instructions and safe Sites identity.')
 if any(name.startswith('portplan/.openai/') and name!='portplan/.openai/hosting.json' for name in names):
  raise RuntimeError('Unexpected private Sites runtime state in the source ZIP.')
if historical is not None:
 expected={item['path']:{key:item[key] for key in ('bytes','sha256')} for item in coverage}
 expected['.openai/hosting.json']={'bytes':len(hosting_bytes),'sha256':hashlib.sha256(hosting_bytes).hexdigest()}
 expected['source-recovery.json']={'bytes':len(recovery_bytes),'sha256':hashlib.sha256(recovery_bytes).hexdigest()}
 seen=set()
 for output in archives.values():
  with ZipFile(output.filename) as archive:
   for item in archive.infolist():
    name=Path(item.filename)
    relative=Path(*name.parts[1:]).as_posix()
    if name.parts[0]!='portplan' or relative not in expected or relative in seen:
     raise RuntimeError('Current ZIP source coverage is incomplete, duplicated or outside the explicit policy.')
    raw=archive.read(item)
    if {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest()}!=expected[relative]:
     raise RuntimeError('Retained source changed during packaging: '+relative)
    seen.add(relative)
 if seen!=set(expected):raise RuntimeError('A non-omitted retained source file is missing from all ZIPs.')
 for item in coverage:
  if file_binding(root/item['path'])!={key:item[key] for key in ('bytes','sha256')}:
   raise RuntimeError('Retained source changed after archive writing: '+item['path'])
(root/'public/data/source-recovery-v11.json').write_bytes(recovery_bytes)
for p in (root/'public').rglob('*'):
 if stat.S_ISREG(checked(p).st_mode) and p.stat().st_size > 26_214_400:
  raise RuntimeError('Static hosting single-file limit exceeded; split the transport package: '+str(p.relative_to(root)))
packages=[]
for key,archive in archives.items():
 p=Path(archive.filename)
 packages.append({'id':key,'file':p.name,'url':'/downloads/'+p.name,'bytes':p.stat().st_size,
                  'sha256':hashlib.sha256(read_checked(p)).hexdigest(),'fileCount':counts[key]})
for revision in ('v9','v10','v11','v12','v13','v14','v15'):
 (root/('public/data/download-packages-'+revision+'.json')).write_text(json.dumps({'schemaVersion':'portplan-'+revision+'-download-packages',
  'recoveryRule':'Download every listed package and extract to one shared parent directory; all use portplan/ as their root.',
  'packages':packages,'sourceRecovery':recovery,**({'scope':'current-source-and-retained-evidence-not-complete-historical-archives','historicalOmissions':historical['descriptor']} if historical is not None else {})},ensure_ascii=False,indent=2)+'\\n')
print('Lossless source/experiment/public-input coverage:',counts)
`;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await preparePublic();
