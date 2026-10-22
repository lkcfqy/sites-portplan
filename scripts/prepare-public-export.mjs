// Public source export adapter. Does not rerun experiments or restore omitted archives.
import { mkdir, readdir, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { GZIP_EVIDENCE_FILES } from '../src/evidence-paths-v12.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const aliases=new Set(GZIP_EVIDENCE_FILES);
export async function restoreJson(){
 async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){
  const p=resolve(dir,e.name);if(e.isDirectory())await walk(p);
  else if(e.name.endsWith('.json.gz'))await writeFile(p.slice(0,-3),gunzipSync(await readFile(p)));
 }}
 await walk(resolve(root,'data'));
}
export async function prepare(){
 const target=resolve(root,'public');await rm(target,{recursive:true,force:true});
 await mkdir(resolve(target,'data'),{recursive:true});await mkdir(resolve(target,'downloads'),{recursive:true});
 const entries=await readdir(resolve(root,'data'));
 for(const file of entries){
  if(!file.endsWith('.json')&&!file.endsWith('.json.gz')&&!file.endsWith('.csv'))continue;
  const name=file.endsWith('.gz')?file.slice(0,-3):file;
  if(file.endsWith('.json')&&entries.includes(file+'.gz'))continue;
  const raw=await readFile(resolve(root,'data',file));const plain=file.endsWith('.gz')?gunzipSync(raw):raw;
  await writeFile(resolve(target,'data',name+(aliases.has(name)?'.gz':'')),aliases.has(name)?gzipSync(plain,{level:9}):plain);
 }
 await cp(resolve(root,'data/public'),resolve(target,'data/public'),{recursive:true});
 for(const file of await readdir(resolve(root,'docs'))){
  if(/\.(md|txt|json|html|pdf|pptx)$/.test(file))await cp(resolve(root,'docs',file),resolve(target,'downloads',file));
 }
 await cp(resolve(root,'data/public/ygpa_gate_statistics.json'),resolve(target,'data/ygpa_gate_statistics.json'));
 const pack=spawnSync('python',['scripts/package-public-export.py'],{cwd:root,encoding:'utf8'});
 if(pack.status!==0)throw new Error(pack.stderr||'Source export packaging failed');
 console.log(pack.stdout.trim());
 await writeFile(resolve(target,'data/public-source-export.json'),JSON.stringify({sourceVersion:16,sourceCommit:'1643a384034c2439066818ab3259aec4ab63432a',exportDate:'2026-10-22',scope:'Source export, not complete hosted evidence/download archive. See README and PUBLIC_EXPORT_OMISSIONS.json.'},null,2));
 console.log('Prepared retained public source assets; omitted historical downloads are not regenerated.');
}
if(process.argv.includes('--restore-json'))await restoreJson();else await prepare();
