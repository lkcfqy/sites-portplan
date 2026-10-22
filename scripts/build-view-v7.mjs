import {readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import {isDeepStrictEqual} from 'node:util';
import {encodeRollingViewV6,decodeRollingViewV6} from '../src/research-view-v6.js';
import {ROLLING_VIEW_V7_TRANSPORT,ROLLING_VIEW_V7_SCHEMA,decodeRollingViewV7} from '../src/research-view-v7.js';

const ROOT=resolve(import.meta.dirname,'..');
export const SOURCE_ARCHIVE_V7_SHA256='a8b0d67f7ff5fbf3b27fe260ab8d9d17be331a9942df37704d8d8365546000c6';
export const SOURCE_ARCHIVE_V7_BYTES=118230496;
export const MAX_BROWSER_VIEW_V7_BYTES=25*1024*1024;
const METHODS=['dailyReoptV4','stableRetainV5','lockedRecoveryV6','costPolishV7','graspBaselineV7'];
const OMIT_RESULT=new Set(['stderr']);
const OMIT_TRACE=new Set(['stages','cacheAudit']);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const jsonBytes=value=>value===undefined?0:Buffer.byteLength(JSON.stringify(value));
const assertEqual=(a,b,label)=>{if(!isDeepStrictEqual(a,b))throw new Error('Projection changed '+label);};
function without(object,keys){return Object.fromEntries(Object.entries(object??{}).filter(([key])=>!keys.has(key)));}

/** Keep every physical/result field and all scalar/search/proof diagnostics;
 * only stderr, solver-stage trees and duplicate full cache audits are removed. */
export function projectRollingRecordV7(record,sourceArchiveSha256){
  if(record?.executionState!=='complete'||!Array.isArray(record.cases)||!Array.isArray(record.developmentControls?.cases)||!Array.isArray(record.protocol?.methods))throw new Error('Complete primary and development evidence is required');
  const omissionCounts={stderrFields:0,stderrMinifiedBytes:0,solverStageTrees:0,solverStageMinifiedBytes:0,duplicateCacheAudits:0,duplicateCacheAuditMinifiedBytes:0};
  const projectResult=result=>{
    if(Object.hasOwn(result,'stderr')){omissionCounts.stderrFields++;omissionCounts.stderrMinifiedBytes+=jsonBytes(result.stderr);}
    return {...without(result,OMIT_RESULT),plannerTrace:(result.plannerTrace??[]).map(entry=>{
      if(Object.hasOwn(entry,'stages')){omissionCounts.solverStageTrees++;omissionCounts.solverStageMinifiedBytes+=jsonBytes(entry.stages);}
      if(Object.hasOwn(entry,'cacheAudit')){omissionCounts.duplicateCacheAudits++;omissionCounts.duplicateCacheAuditMinifiedBytes+=jsonBytes(entry.cacheAudit);}
      return without(entry,OMIT_TRACE);
    })};
  };
  const projectCase=c=>({...c,policies:Object.fromEntries(Object.entries(c.policies).map(([method,result])=>[method,projectResult(result)]))});
  return {...record,schemaVersion:'portplan-rolling-v7-ui-projection',artifactRole:'Complete decision/execution/fee/audit and polish-date evidence with reduced duplicate solver telemetry; full original archive remains in portplan-experiments-v7.zip',sourceArchiveSha256,
    omittedTelemetry:'Only result.stderr and plannerTrace.stages/cacheAudit. All cases, method records, summaries, rows, physical timeline/state/actions/observations/audits, execution errors, fees, clocks, counters, searchStats and complete polishMetadata beforeDates/afterDates remain unchanged.',
    cases:record.cases.map(projectCase),developmentControls:{...record.developmentControls,cases:record.developmentControls.cases.map(projectCase)},browserProjectionOmissions:omissionCounts};
}

/** Regress every retained property, not just a subset of date/cost columns. */
export function assertProjectionV7(record,view){
  const topOmissions=new Set(['schemaVersion','cases','developmentControls']);
  for(const [key,value]of Object.entries(record))if(!topOmissions.has(key))assertEqual(value,view[key],'top-level '+key);
  for(const [key,value]of Object.entries(record.developmentControls))if(key!=='cases')assertEqual(value,view.developmentControls[key],'development metadata '+key);
  for(const [role,original,projected]of [['primary',record.cases,view.cases],['development',record.developmentControls.cases,view.developmentControls.cases]]){
    assertEqual(original.length,projected.length,role+' case count');
    for(let i=0;i<original.length;i++){
      const a=original[i],b=projected[i];for(const [key,value]of Object.entries(a))if(key!=='policies')assertEqual(value,b[key],role+'/'+i+'/'+key);
      assertEqual(Object.keys(a.policies),Object.keys(b.policies),role+'/'+i+' method records');
      for(const method of Object.keys(a.policies)){
        const p=a.policies[method],q=b.policies[method];
        for(const [key,value]of Object.entries(p))if(!OMIT_RESULT.has(key)&&key!=='plannerTrace')assertEqual(value,q[key],role+'/'+i+'/'+method+'/'+key);
        assertEqual(p.plannerTrace?.length??0,q.plannerTrace?.length??0,'trace count');
        for(let t=0;t<(p.plannerTrace?.length??0);t++)for(const [key,value]of Object.entries(p.plannerTrace[t]))if(!OMIT_TRACE.has(key))assertEqual(value,q.plannerTrace[t][key],role+'/'+i+'/'+method+'/trace/'+t+'/'+key);
      }
    }
  }
}

export function packBrowserViewV7(view){
  const encoded=encodeRollingViewV6(view);assertEqual(decodeRollingViewV6(encoded),view,'ID dictionary roundtrip');
  const projectionBytes=Buffer.from(JSON.stringify(encoded)),compressed=gzipSync(projectionBytes,{level:9});
  assertEqual(decodeRollingViewV6(JSON.parse(gunzipSync(compressed).toString('utf8'))),view,'gzip/JSON/ID roundtrip');
  const wrapper={schemaVersion:ROLLING_VIEW_V7_SCHEMA,transportCodec:ROLLING_VIEW_V7_TRANSPORT,artifactRole:'Lossless gzip/base64 transport of a complete browser execution projection; decode before reading any score or original container ID',sourceArchiveSha256:view.sourceArchiveSha256,
    projectionSha256:hash(projectionBytes),decodedBytes:projectionBytes.length,compressedSha256:hash(compressed),compressedBytes:compressed.length,
    compression:'gzip, level 9; base64 JSON payload',omissions:view.omittedTelemetry,omissionCounts:view.browserProjectionOmissions,payload:compressed.toString('base64')};
  const bytes=Buffer.from(JSON.stringify(wrapper)+'\n');if(bytes.length>=MAX_BROWSER_VIEW_V7_BYTES)throw new Error('V7 single browser asset must remain below 25 MiB');return {wrapper,bytes,projectionBytes,encoded};
}

export function verifyFrozenViewV7(bytes,manifest){
  const expected=manifest?.derivedBrowserView;if(!expected||expected.artifact!=='data/rolling-v7-view.json'||!Number.isSafeInteger(expected.bytes)||!/^[a-f0-9]{64}$/.test(expected.sha256??'')||!/^[a-f0-9]{64}$/.test(manifest.sourceArchiveSha256??''))throw new Error('Missing frozen browser transport binding');
  if(bytes.length>=MAX_BROWSER_VIEW_V7_BYTES||bytes.length!==expected.bytes||hash(bytes)!==expected.sha256)throw new Error('Browser projection differs from frozen transport manifest');
  if(JSON.parse(bytes).sourceArchiveSha256!==manifest.sourceArchiveSha256)throw new Error('Browser projection source differs from frozen transport manifest');
}
async function readOptional(path){try{return await readFile(path);}catch(error){if(error.code==='ENOENT')return null;throw error;}}

export async function buildViewV7({manifest=null}={}){
  const source=await readFile(resolve(ROOT,'data/rolling-v7.json')),sourceArchiveSha256=hash(source),record=JSON.parse(source);
  if(source.length!==SOURCE_ARCHIVE_V7_BYTES||sourceArchiveSha256!==SOURCE_ARCHIVE_V7_SHA256)throw new Error('First-run V7 source archive changed');
  if(record.executionState!=='complete'||record.cases.length!==36||record.developmentControls.cases.length!==36||!isDeepStrictEqual(record.protocol.methods,METHODS))throw new Error('Complete unfiltered 36+36 five-method evidence is required');
  for(const c of [...record.cases,...record.developmentControls.cases])if(!isDeepStrictEqual([...Object.keys(c.policies)].sort(),[...METHODS].sort()))throw new Error('A case lost a declared method record');
  if(manifest&&manifest.sourceArchiveSha256!==sourceArchiveSha256)throw new Error('Frozen transport source binding differs');
  const view=projectRollingRecordV7(record,sourceArchiveSha256);assertProjectionV7(record,view);const packed=packBrowserViewV7(view);
  assertEqual(await decodeRollingViewV7(packed.wrapper),view,'browser DecompressionStream/byte/hash/ID roundtrip');
  if(manifest)verifyFrozenViewV7(packed.bytes,manifest);
  const output=resolve(ROOT,'data/rolling-v7-view.json');await writeFile(output,packed.bytes);
  const result={output,sourceBytes:source.length,sourceArchiveSha256,viewBytes:packed.bytes.length,viewSha256:hash(packed.bytes),projectionSha256:packed.wrapper.projectionSha256,decodedBytes:packed.wrapper.decodedBytes,compressedBytes:packed.wrapper.compressedBytes,primaryCases:36,developmentCases:36,methods:METHODS.length,
    allRetainedFieldsAndBrowserRoundtripVerified:true,omissions:view.browserProjectionOmissions};console.log(JSON.stringify(result));return result;
}

if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  const manifestBytes=await readOptional(resolve(ROOT,'data/archives-v7/rolling-v7/view-manifest.json')),manifest=manifestBytes?JSON.parse(manifestBytes):null,path=resolve(ROOT,'data/rolling-v7-view.json');
  if(process.argv.includes('--ensure')&&manifest){const existing=await readOptional(path);if(existing){if(manifest.sourceArchiveSha256!==SOURCE_ARCHIVE_V7_SHA256)throw new Error('Frozen V7 source binding differs');verifyFrozenViewV7(existing,manifest);console.log(JSON.stringify({output:path,viewBytes:existing.length,viewSha256:hash(existing),verifiedExisting:true}));}else await buildViewV7({manifest});}
  else await buildViewV7({manifest});
}
