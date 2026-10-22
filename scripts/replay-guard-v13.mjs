#!/usr/bin/env node
/** Twelve prespecified seen-case suffix runs. Declaration never starts native
 * code; execution additionally requires the root's isolated runtime window. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {reconstructNativeDiagnosticSnapshot} from './compare-native-v12.mjs';
import {FIXED_CALL_BUDGETS_V12,FIXED_PARENT_ACCEPTANCE_V12,assertNewOutputV12,compactEpisodeReceiptV12,isCompleteV12} from './benchmark-v12.mjs';
import {canonicalJSONV13,evidenceHashV13,prefixProjectionV13,REPLAY_PREFIX_KEYS_V13,reconstructReplayEndpointV13} from './replay-guard-v13.worker.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const PROTOCOL='data/protocol-development-v13.json';
const CASE_IDS=['v12-stress-batch-release-tight-n100-r2','v12-stress-batch-release-tight-n50-r3'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const jsonBytes=value=>JSON.stringify(value,null,2)+'\n';
export function safeEvidencePathV13(name){
  assert.equal(typeof name,'string');assert.ok(name.length>0&&!path.isAbsolute(name)&&!name.includes('\\')&&!name.includes('\0'),'Unsafe evidence path.');
  assert.ok(name.split('/').every(part=>part&&part!=='.'&&part!=='..'),'Unsafe evidence path.');return name;
}
async function readBound(root,name,expected){
  safeEvidencePathV13(name);assert.match(expected,/^[a-f0-9]{64}$/,'Invalid evidence SHA.');
  const target=path.resolve(root,name),actual=await fs.realpath(target),base=await fs.realpath(root);
  assert.ok(actual.startsWith(base+path.sep),'Evidence symlink escaped its declared root.');
  const bytes=await fs.readFile(actual);assert.equal(sha(bytes),expected,'Changed bound evidence: '+name);return bytes;
}
export function jobsForV13(cases){
  const jobs=[];
  for(const timingRepeatIndex of [1,2,3]){
    const order=timingRepeatIndex%2?[0,1]:[1,0];
    for(const index of order){
      const caseId=cases[index].caseId,first=(index+timingRepeatIndex-1)%2===0?'forced_native':'forced_seed';
      for(const branch of [first,first==='forced_native'?'forced_seed':'forced_native'])jobs.push({
        jobId:`v13-seen-${caseId}--clock-${timingRepeatIndex}--${branch}`,caseId,timingRepeatIndex,algorithmSeed:69011,branch,
        endpointKey:branch==='forced_seed'?'seed':'native',canonicalOriginalRepeatIndex:1});
    }
  }
  return jobs;
}
export function validateReplayProtocolV13(protocol){
  canonicalJSONV13(protocol);
  assert.equal(protocol.schemaVersion,'portplan-v13-seen-controlled-prefix-development-protocol');
  assert.deepEqual(protocol.cases.map(row=>row.caseId),CASE_IDS);assert.deepEqual(protocol.branches,['forced_seed','forced_native']);
  assert.deepEqual(protocol.timingRepeatIndices,[1,2,3]);assert.equal(protocol.algorithmSeed,69011);
  assert.equal(protocol.interventionDay,5);assert.deepEqual(protocol.prefixDays,[0,1,2,3,4]);assert.deepEqual(protocol.prefixProjectionKeys,[...REPLAY_PREFIX_KEYS_V13]);
  assert.equal(protocol.dailyBudgetMs,200);assert.equal(protocol.parentHardWallMs,5000);assert.equal(protocol.nativeThreads,1);assert.equal(protocol.nativeRandomSeed,0);
  assert.equal(protocol.uniqueBusinessScenarioCount,2);assert.equal(protocol.branchRunCount,12);assert.equal(protocol.newHeldOutExperiments,0);
  assert.equal(protocol.newOrderGeneration,0);assert.equal(protocol.newAlgorithmSeeds,0);assert.equal(protocol.ciComputed,false);
  assert.deepEqual(protocol.parentAcceptance,FIXED_PARENT_ACCEPTANCE_V12);assert.deepEqual(protocol.jobs,jobsForV13(protocol.cases));
  assert.equal(protocol.executionAuthorization.protocolGrantsSolverRun,false);assert.equal(protocol.executionAuthorization.noSolverDuringDeclare,true);
  assert.equal(protocol.executionAuthorization.explicitRunFlagRequired,true);
  assert.equal(protocol.negativeControls.length,4);assert.ok(protocol.negativeControls.every(row=>row.staticOnly===true&&row.plannedOptimizerRuns===0));
  for(const [name,digest]of Object.entries(protocol.sourceBindings)){safeEvidencePathV13(name);assert.match(digest,/^[a-f0-9]{64}$/);}
  for(const item of protocol.cases){
    assert.equal(item.canonicalOriginalRepeatIndex,1);assert.equal(item.originalAlgorithmSeed,69011);
    assert.deepEqual(item.originalEquivalentReferences.map(ref=>ref.repeatIndex),[1,2,3]);
    assert.deepEqual(item.originalEquivalentReferences.map(ref=>ref.algorithmSeed),[69011,69023,69039]);
    for(const ref of [item.sourceInputArtifact,item.canonicalSourceEpisodeArtifact,...item.originalEquivalentReferences])assert.equal(protocol.sourceBindings[ref.path],ref.sha256);
    assert.equal(evidenceHashV13(item.publicSnapshot),item.identity.publicSnapshotSha256);assert.equal(evidenceHashV13(item.fixedEvents),item.identity.fixedEventsSha256);
    assert.equal(item.prefixProjectionSha256,item.identity.prefixProjectionSha256);
    for(const key of ['seed','native']){assert.equal(evidenceHashV13(item.endpoints[key].dates),item.endpoints[key].datesSha256);assert.equal(item.endpoints[key].datesSha256,item.identity[key+'DatesSha256']);}
    for(const ref of item.originalEquivalentReferences)assert.deepEqual(ref.identity,item.identity);
  }
  return protocol;
}

/** Bind every embedded protocol field, including explanatory hypotheses, to
 * the exact frozen bytes before writing any first-run authorization marker. */
export function assertFrozenProtocolBindingV13(declaration,frozenProtocolBytes){
  assert.equal(sha(frozenProtocolBytes),declaration.protocolSha256,'Frozen protocol bytes differ from the declaration SHA.');
  const frozenProtocol=validateReplayProtocolV13(JSON.parse(frozenProtocolBytes));
  assert.deepEqual(declaration.protocol,frozenProtocol,'Embedded declaration protocol differs from its bound frozen protocol.');
  return frozenProtocol;
}

/** Read-only source reconstruction, no optimizer calls or new order generator. */
export async function verifyReplaySourcesV13(protocol,{sourceRoot=ROOT}={}){
  validateReplayProtocolV13(protocol);const originals=new Map();
  for(const [name,digest]of Object.entries(protocol.sourceBindings))originals.set(name,await readBound(sourceRoot,name,digest));
  for(const item of protocol.cases){
    const sourceInput=JSON.parse(originals.get(item.sourceInputArtifact.path)),nominal=sourceInput.nominalScenario;
    assert.equal(nominal.id,item.caseId);assert.equal(sourceInput.config.id,item.caseId);
    for(const ref of item.originalEquivalentReferences){
      const original=JSON.parse(originals.get(ref.path));assert.equal(original.caseId,item.caseId);assert.equal(original.repeatIndex,ref.repeatIndex);assert.equal(original.algorithmSeed,ref.algorithmSeed);
      assert.equal(evidenceHashV13(prefixProjectionV13(original.result.timeline)),item.prefixProjectionSha256);
      const observed=reconstructNativeDiagnosticSnapshot(nominal,original.result,5);
      assert.deepEqual(observed.snapshot,item.publicSnapshot);assert.deepEqual(observed.fixedEvents,item.fixedEvents);assert.equal(observed.observationHash,item.originalObservationHash);
      const selection=original.result.plannerTrace.find(row=>row.day===5).stabilitySelection;
      assert.deepEqual(selection.preNativeIncumbent.dates,item.endpoints.seed.dates);assert.deepEqual(selection.proposalDates,item.endpoints.native.dates);
      for(const key of ['seed','native'])reconstructReplayEndpointV13(observed.snapshot,item.endpoints[key].dates,observed.fixedEvents,5,item.endpoints[key].fees);
    }
  }
  return {verifiedSourceCount:originals.size,uniqueBusinessScenarioCount:2,equivalentOriginalEpisodeReferences:6,
    staticNegativeControls:4,staticControlScope:'Hash-bound archived controls; this harness does not assert new optimizer outcomes or independently prove their local-guard predictions.',
    plannedRuns:12,newHeldOutExperiments:0,newOrderGeneration:0,optimizerCalls:0};
}

async function sourceInventory(){
  const names=['AGENTS.md','package.json','package-lock.json',PROTOCOL,'data/protocol-v2.json','data/protocol-v12.json'];
  for(const name of await fs.readdir(ROOT))if(/^requirements[^/]*\.txt$/.test(name))names.push(name);
  const collect=async directory=>{for(const entry of await fs.readdir(path.join(ROOT,directory),{withFileTypes:true})){
    const name=directory+'/'+entry.name;if(entry.isDirectory())await collect(name);else if(/\.(js|mjs|py)$/.test(entry.name))names.push(name);
  }};
  await collect('src');await collect('scripts');return [...new Set(names)].sort();
}
async function hashRuntimeSources(){const hashes={};for(const name of await sourceInventory())hashes[name]=sha(await fs.readFile(path.join(ROOT,name)));return hashes;}
async function verifyRuntime(root,hashes){for(const [name,digest]of Object.entries(hashes))await readBound(root,name,digest);}
function artifactOutput(directory){
  const target=path.resolve(directory),base=path.join(ROOT,'artifacts');assert.ok(target.startsWith(base+path.sep),'V13 development output must be a new directory inside artifacts/.');return target;
}

export async function declareReplayV13(directory){
  const output=artifactOutput(directory);await assertNewOutputV12(output);
  const protocolBytes=await fs.readFile(path.join(ROOT,PROTOCOL)),protocol=validateReplayProtocolV13(JSON.parse(protocolBytes));
  const sourceVerification=await verifyReplaySourcesV13(protocol),implementationHashes=await hashRuntimeSources();
  await fs.mkdir(path.dirname(output),{recursive:true});await fs.mkdir(output,{recursive:false});
  for(const [name,digest]of Object.entries(implementationHashes)){
    const bytes=await readBound(ROOT,name,digest),target=path.join(output,'source',name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes,{flag:'wx'});
  }
  for(const [name,digest]of Object.entries(protocol.sourceBindings)){
    const bytes=await readBound(ROOT,name,digest),target=path.join(output,'original',name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes,{flag:'wx'});
  }
  await verifyRuntime(path.join(output,'source'),implementationHashes);await verifyRuntime(ROOT,implementationHashes);
  const declaration={schemaVersion:'portplan-v13-controlled-replay-declaration',executionState:'declared',declaredAt:new Date().toISOString(),
    dataRole:protocol.dataRole,protocolSha256:sha(protocolBytes),protocolPath:PROTOCOL,protocol,rootAuthorized:false,
    implementationHashes,sourceBindings:protocol.sourceBindings,jobs:protocol.jobs,sourceVerification,
    plannerConfiguration:structuredClone(FIXED_CALL_BUDGETS_V12.seededHiGHSV12),newHeldOutExperiments:0,newGeneratedSeeds:0,ciComputed:false,
    scope:'Two seen business cases; archived D0-D4 prefix and D5 interventions, then shared guarded V13 continuation. Three clock repeats do not add business samples.',
    declarationCommit:'Declaration written WX after all source/original copies and SHA checks; a partial directory cannot execute or be reused.'};
  await fs.writeFile(path.join(output,'declaration.json'),jsonBytes(declaration),{flag:'wx'});return declaration;
}

export function summarizeReplayV13(records){
  const branches=Object.fromEntries(['forced_seed','forced_native'].map(branch=>{const rows=records.filter(row=>row.branch===branch);return [branch,
    {runCount:rows.length,completeWithinBudgetCount:rows.filter(row=>isCompleteV12(row.receipt)).length,
      unknownHistoryCount:rows.filter(row=>row.receipt.executionHistoryUnavailable).length,
      statuses:rows.map(row=>({jobId:row.jobId,status:row.receipt.status,failureDay:row.receipt.failure?.day??null,
        totalCost:row.receipt.totalCost,incrementalCost:row.receipt.incrementalCost,revisionCount:row.receipt.revisionCount}))}];}));
  const pairs=[];
  for(const caseId of CASE_IDS)for(const timingRepeatIndex of [1,2,3]){
    const seed=records.find(row=>row.caseId===caseId&&row.timingRepeatIndex===timingRepeatIndex&&row.branch==='forced_seed');
    const native=records.find(row=>row.caseId===caseId&&row.timingRepeatIndex===timingRepeatIndex&&row.branch==='forced_native');
    if(!seed||!native)continue;
    const jointlyCompleted=isCompleteV12(seed.receipt)&&isCompleteV12(native.receipt);
    pairs.push({caseId,timingRepeatIndex,seedComplete:isCompleteV12(seed.receipt),nativeComplete:isCompleteV12(native.receipt),jointlyCompleted,
      totalSeedMinusNativeKRW:jointlyCompleted?seed.receipt.totalCost-native.receipt.totalCost:null,
      incrementalSeedMinusNativeKRW:jointlyCompleted?seed.receipt.incrementalCost-native.receipt.incrementalCost:null,
      revisionSeedMinusNative:jointlyCompleted&&Number.isFinite(seed.receipt.revisionCount)&&Number.isFinite(native.receipt.revisionCount)?seed.receipt.revisionCount-native.receipt.revisionCount:null});
  }
  return {runCount:records.length,uniqueBusinessScenarioCount:2,timingRepeatsPerBranch:3,branches,pairs,
    jointlyCompletedTimingPairCount:pairs.filter(row=>row.jointlyCompleted).length,ciComputed:false,newHeldOutExperiments:0,
    scope:'Descriptive paired seen-case branch outcomes only. Fees and revisions require joint completion of the matching timing pair; no new research CI, full-D0 runtime or policy claim.'};
}

export async function runDeclaredReplayV13(directory,{rootAuthorized=false}={}){
  assert.equal(rootAuthorized,true,'Root must separately authorize the isolated first-run runtime window; this static protocol grants no solver run.');
  const output=artifactOutput(directory),declarationBytes=await fs.readFile(path.join(output,'declaration.json')),declaration=JSON.parse(declarationBytes);
  assert.equal(declaration.schemaVersion,'portplan-v13-controlled-replay-declaration');assert.equal(declaration.executionState,'declared');
  validateReplayProtocolV13(declaration.protocol);assert.equal(declaration.protocolSha256,declaration.implementationHashes[PROTOCOL]);
  assert.deepEqual(declaration.jobs,declaration.protocol.jobs);assert.deepEqual(declaration.sourceBindings,declaration.protocol.sourceBindings);
  assert.deepEqual(declaration.plannerConfiguration,FIXED_CALL_BUDGETS_V12.seededHiGHSV12);
  assert.deepEqual(await hashRuntimeSources(),declaration.implementationHashes,'Live runtime source changed after declaration.');
  await verifyRuntime(path.join(output,'source'),declaration.implementationHashes);
  const frozenProtocolBytes=await readBound(path.join(output,'source'),PROTOCOL,declaration.protocolSha256);
  assertFrozenProtocolBindingV13(declaration,frozenProtocolBytes);
  await verifyReplaySourcesV13(declaration.protocol);
  await verifyReplaySourcesV13(declaration.protocol,{sourceRoot:path.join(output,'original')});
  // This exclusive marker is the first-run authorization record. It cannot
  // silently resume, replace or extend a failed/partial first attempt.
  await fs.writeFile(path.join(output,'execution-start.json'),jsonBytes({rootAuthorized:true,startedAt:new Date().toISOString(),
    declarationSha256:sha(declarationBytes),protocolSha256:declaration.protocolSha256,runtimeImplementationHashes:declaration.implementationHashes,
    sourceConsistency:{live:true,frozen:true,originals:true},plannedJobCount:12}),{flag:'wx'});
  await fs.mkdir(path.join(output,'episodes'),{recursive:false});await fs.writeFile(path.join(output,'episodes.ndjson'),'',{flag:'wx'});
  const {runColdEpisodeV12}=await import(pathToFileURL(path.join(output,'source/scripts/benchmark-v12.mjs')).href),records=[];
  for(const [index,job]of declaration.jobs.entries()){
    const number=String(index+1).padStart(2,'0'),item=declaration.protocol.cases.find(row=>row.caseId===job.caseId);
    const sourceInput=JSON.parse(await readBound(path.join(output,'original'),item.sourceInputArtifact.path,item.sourceInputArtifact.sha256));
    const originalEpisode=JSON.parse(await readBound(path.join(output,'original'),item.canonicalSourceEpisodeArtifact.path,item.canonicalSourceEpisodeArtifact.sha256));
    const journalName=`journal-${number}.ndjson`,journalPath=path.join(output,journalName);await fs.writeFile(journalPath,'',{flag:'wx'});
    const identity={...job,episodeId:job.jobId,method:'controlledGuardReplayV13',sourceInputArtifact:item.sourceInputArtifact,canonicalSourceEpisodeArtifact:item.canonicalSourceEpisodeArtifact};
    const result=await runColdEpisodeV12({...identity,nominalScenario:sourceInput.nominalScenario,events:sourceInput.events,originalResult:originalEpisode.result,
      caseDefinition:item,dailyBudgetMs:200,plannerConfiguration:declaration.plannerConfiguration,journalPath,outputDirectory:output},
      {hardWallMs:5000,workerScript:path.join(output,'source/scripts/replay-guard-v13.worker.mjs')});
    const name=`episodes/episode-${number}.json`,bytes=jsonBytes({...identity,result});await fs.writeFile(path.join(output,name),bytes,{flag:'wx'});
    const artifact={path:name,sha256:sha(bytes)},journalBytes=await fs.readFile(journalPath),receipt=compactEpisodeReceiptV12(result,artifact);
    const record={...identity,artifact,journal:{path:journalName,sha256:sha(journalBytes)},receipt};records.push(record);
    await fs.appendFile(path.join(output,'episodes.ndjson'),JSON.stringify(record)+'\n');
    await fs.writeFile(path.join(output,`checkpoint-${number}.json`),jsonBytes({executionState:'running',protocolSha256:declaration.protocolSha256,
      completedJobCount:records.length,records,summary:summarizeReplayV13(records)}),{flag:'wx'});
    console.log(JSON.stringify({index:index+1,total:12,jobId:job.jobId,status:result.status,complete:isCompleteV12(result),historyUnknown:result.executionHistoryUnavailable,failureDay:result.failure?.day??null}));
  }
  await verifyRuntime(ROOT,declaration.implementationHashes);await verifyRuntime(path.join(output,'source'),declaration.implementationHashes);
  await verifyReplaySourcesV13(declaration.protocol);
  await verifyReplaySourcesV13(declaration.protocol,{sourceRoot:path.join(output,'original')});
  const complete={schemaVersion:'portplan-v13-controlled-replay-results',executionState:'complete',completedAt:new Date().toISOString(),
    declarationSha256:sha(declarationBytes),protocolSha256:declaration.protocolSha256,implementationHashes:declaration.implementationHashes,sourceBindings:declaration.sourceBindings,
    sourceConsistency:{before:true,after:true},newHeldOutExperiments:0,newGeneratedSeeds:0,ciComputed:false,records,summary:summarizeReplayV13(records)};
  await fs.writeFile(path.join(output,'complete.json'),jsonBytes(complete),{flag:'wx'});return complete;
}

async function main(){
  const args=process.argv.slice(2),value=name=>{const index=args.indexOf(name);assert.ok(index>=0&&args[index+1]&&!args[index+1].startsWith('--'),'Missing '+name);return args[index+1];};
  if(args.includes('--inspect')){const protocol=validateReplayProtocolV13(JSON.parse(await fs.readFile(path.join(ROOT,PROTOCOL))));console.log(JSON.stringify(await verifyReplaySourcesV13(protocol),null,2));return;}
  if(args.includes('--declare')){console.log(JSON.stringify(await declareReplayV13(path.resolve(ROOT,value('--output'))),null,2));return;}
  if(args.includes('--run')){console.log(JSON.stringify(await runDeclaredReplayV13(path.resolve(ROOT,value('--declared')),{rootAuthorized:args.includes('--root-authorized')}),null,2));return;}
  throw new Error('Use --inspect (read-only), --declare --output artifacts/NEW_PATH, or root-authorized --run --declared artifacts/PATH --root-authorized. No implicit solve, resume or retry.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
