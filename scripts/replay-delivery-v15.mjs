#!/usr/bin/env node
/** Prespecified seen-input delivery development. Import/inspect/declaration
 * never launches a planner, generator or native optimizer. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {reconstructNativeDiagnosticSnapshot} from './compare-native-v12.mjs';
import {FIXED_CALL_BUDGETS_V12,FIXED_PARENT_ACCEPTANCE_V12,assertNewOutputV12,compactEpisodeReceiptV12,isCompleteV12} from './benchmark-v12.mjs';
import {canonicalJSONV15,evidenceHashV15,prefixProjectionV15,METHODS_DELIVERY_V15} from './replay-delivery-v15.worker.mjs';
import {REPLAY_PREFIX_KEYS_V13} from './replay-guard-v13.worker.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url)),PROTOCOL='data/protocol-development-v15.json';
const execFileAsync=promisify(execFile);
const INDEX={path:'artifacts/v14-frozen-first/first-run/complete.json',sha256:'a0081a725e21a019c783bffe5b3c0e8aedf8f8b29903564fa04fa1ee53a2fcb9'};
const DIAGNOSIS={path:'data/diagnosis-v14.json',sha256:'0c7fd07ae6c4f3943c7a2fddee0d42ba9fd5b785e1dff23ca0be348f1cb1d522'};
export const CASE_DAYS_DELIVERY_V15=Object.freeze([
  Object.freeze({caseId:'v14-stress-aged-backlog-balanced-n50-r2',interventionDay:6}),
  Object.freeze({caseId:'v14-stress-new-arrivals-tight-n100-r3',interventionDay:6}),
  Object.freeze({caseId:'v14-stress-new-arrivals-tight-n100-r4',interventionDay:3}),
  Object.freeze({caseId:'v14-stress-new-arrivals-tight-n50-r1',interventionDay:7}),
]);
export const CALL_BUDGETS_DELIVERY_V15=Object.freeze(Object.fromEntries(METHODS_DELIVERY_V15.map(method=>[method,{
  ...structuredClone(FIXED_CALL_BUDGETS_V12.seededHiGHSV12),...(method==='timelyHiGHSV15'?{nativeReturnReserveMs:10}:{})}])));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const jsonBytes=value=>JSON.stringify(value,null,2)+'\n';
export function safeEvidencePathV15(name){
  assert.equal(typeof name,'string');assert.ok(name.length&&!path.isAbsolute(name)&&!name.includes('\\')&&!name.includes('\0'),'Unsafe bound evidence path.');
  assert.ok(name.split('/').every(part=>part&&part!=='.'&&part!=='..'));return name;
}
async function readBound(root,name,expected){
  safeEvidencePathV15(name);assert.match(expected,/^[a-f0-9]{64}$/);
  const target=await fs.realpath(path.resolve(root,name)),base=await fs.realpath(root);assert.ok(target.startsWith(base+path.sep),'Bound evidence escaped its root.');
  const bytes=await fs.readFile(target);assert.equal(sha(bytes),expected,'Changed bound evidence: '+name);return bytes;
}

export function jobsForDeliveryV15(endpoints){
  const jobs=[];
  for(const repeatIndex of [1,2,3])for(let offset=0;offset<4;offset++){
    const caseIndex=(offset+repeatIndex-1)%4,definition=CASE_DAYS_DELIVERY_V15[caseIndex],item=endpoints.find(row=>row.caseId===definition.caseId&&row.repeatIndex===repeatIndex);
    assert.ok(item);const first=(caseIndex+repeatIndex-1)%3;
    for(let methodOffset=0;methodOffset<3;methodOffset++){
      const method=METHODS_DELIVERY_V15[(first+methodOffset)%3];
      jobs.push({jobId:`v15-seen-${item.caseId}--a${repeatIndex}--${method}`,caseId:item.caseId,repeatIndex,algorithmSeed:item.algorithmSeed,
        interventionDay:item.interventionDay,method,endpointId:item.endpointId});
    }
  }
  return jobs;
}

export async function buildDeliveryProtocolV15(){
  const index=JSON.parse(await readBound(ROOT,INDEX.path,INDEX.sha256)),diagnosis=JSON.parse(await readBound(ROOT,DIAGNOSIS.path,DIAGNOSIS.sha256));
  assert.deepEqual([...new Set(diagnosis.lossEpisodes.map(row=>row.caseId))].sort(),CASE_DAYS_DELIVERY_V15.map(row=>row.caseId).sort());
  const sourceBindings={[INDEX.path]:INDEX.sha256,[DIAGNOSIS.path]:DIAGNOSIS.sha256},endpoints=[];
  const base=path.posix.dirname(INDEX.path);
  for(const definition of CASE_DAYS_DELIVERY_V15){
    const c=index.cases.find(row=>row.id===definition.caseId);assert.ok(c);
    const inputRef={path:base+'/'+c.inputArtifact.path,sha256:c.inputArtifact.sha256},input=JSON.parse(await readBound(ROOT,inputRef.path,inputRef.sha256));
    sourceBindings[inputRef.path]=inputRef.sha256;
    for(const repeatIndex of [1,2,3]){
      const repeat=c.repeats.find(row=>row.repeatIndex===repeatIndex),artifact=repeat.policies.guardedHiGHSV13.artifact;
      const episodeRef={path:base+'/'+artifact.path,sha256:artifact.sha256},original=JSON.parse(await readBound(ROOT,episodeRef.path,episodeRef.sha256));
      sourceBindings[episodeRef.path]=episodeRef.sha256;assert.equal(original.method,'guardedHiGHSV13');assert.equal(original.repeatIndex,repeatIndex);
      assert.equal(original.algorithmSeed,[79011,79023,79039][repeatIndex-1]);
      const day=definition.interventionDay,observed=reconstructNativeDiagnosticSnapshot(input.nominalScenario,original.result,day),trace=original.result.plannerTrace.find(row=>row.day===day);
      const prefixProjectionSha256=evidenceHashV15(prefixProjectionV15(original.result.timeline,day));
      endpoints.push({...definition,endpointId:definition.caseId+'::repeat-'+repeatIndex,repeatIndex,algorithmSeed:original.algorithmSeed,
        sourceInputArtifact:inputRef,sourceEpisodeArtifact:episodeRef,prefixDays:Array.from({length:day},(_,i)=>i),prefixProjectionSha256,
        publicSnapshot:observed.snapshot,publicSnapshotSha256:evidenceHashV15(observed.snapshot),fixedEvents:observed.fixedEvents,fixedEventsSha256:evidenceHashV15(observed.fixedEvents),
        originalObservationHash:observed.observationHash,originalInterventionStatus:trace.plannerStatus,originalInterventionCacheStatus:trace.stabilitySelection.cacheStatus,
        originalComplete:original.result.complete===true,originalLossEpisode:diagnosis.lossEpisodes.some(row=>row.caseId===definition.caseId&&row.repeatIndex===repeatIndex)});
    }
  }
  const protocol={schemaVersion:'portplan-v15-seen-cold-cache-delivery-development-protocol',dataRole:'seen-synthetic-controlled-cold-cache-development',
    selectionRule:'All four V14 completion-loss business cases, every original repeat 1/2/3, with each repeat own archived V13 prefix. No original status, cost or prefix equivalence filtering.',
    originalIndex:INDEX,originalDiagnosis:DIAGNOSIS,caseDays:CASE_DAYS_DELIVERY_V15,methods:METHODS_DELIVERY_V15,
    originalRepeats:[{index:1,seed:79011},{index:2,seed:79023},{index:3,seed:79039}],
    uniqueBusinessScenarioCount:4,archivedEndpointCount:12,branchRunCount:36,newHeldOutExperiments:0,newOrderGeneration:0,newAlgorithmSeeds:0,ciComputed:false,
    prefixSourceMethod:'guardedHiGHSV13',prefixProjectionKeys:[...REPLAY_PREFIX_KEYS_V13],historicalCacheImported:false,
    intervention:'Replay each original physical prefix, then run a fresh cold-cache planner from the fixed intervention day through the natural rolling suffix. No endpoint is forced at or after intervention.',
    coldCacheLimitation:'All methods lack historical private planner cache equally. This is not natural D0 timing, not a faithful historical V13 timing reproduction and not evidence that invalid-cache audit work is unchanged. Repeats are clock/algorithm repeats, not new business samples.',
    optimizerBoundary:'Factories receive fixed configuration and original algorithm seed only; real decisions receive current public snapshot and strictly past execution locks only. Simulator alone owns events and future realizations.',
    budget:{dailyBudgetMs:200,parentHardWallMs:5000,nativeThreads:1,nativeRandomSeed:0,parentAcceptance:structuredClone(FIXED_PARENT_ACCEPTANCE_V12)},
    callBudgets:structuredClone(CALL_BUDGETS_DELIVERY_V15),candidateChange:{method:'timelyHiGHSV15',nativeReturnReserveMs:10,wholeCallMs:200,nativeTargetMs:190,serviceAuditReserveMs:2,
      interpretation:'Only the native absolute request/return target is shortened by a fixed 10ms. Full-copy/audit/selection acceptance remains subject to original 200ms; native190 is a target, not a hard guarantee.'},
    runOrdering:'Repeat 1/2/3 outer loop; rotate case first by repeat−1, then rotate the three method first by caseIndex+repeat−1. Adjacent methods share exactly one bound archived endpoint; all jobs run serially and exactly once.',
    analysis:{primaryComparison:['seededHiGHSV12','timelyHiGHSV15'],negativeControl:['guardedHiGHSV13','timelyHiGHSV15'],
      report:'Per endpoint/method complete/failed/unknown, first-call delivery gates, every later call, actual wall times and parent lifecycle. Terminal fee and revisions only for matching jointly complete endpoint pairs; failed fees stay null. No confidence intervals or generic rank/ROI claim.'},
    executionAuthorization:{protocolGrantsSolverRun:false,noSolverDuringDeclare:true,explicitRunFlagRequired:true,requiresCommittedSource:true,requiresPushedSource:true,
      requiresRootExplicitRunAuthorization:true,retriesOrResumeAllowed:false,parameterRetuningAllowed:false,naturalD0ExpansionAllowed:false},sourceBindings,endpoints,jobs:jobsForDeliveryV15(endpoints)};
  return validateDeliveryProtocolV15(protocol);
}

export function validateDeliveryProtocolV15(protocol){
  canonicalJSONV15(protocol);assert.equal(protocol.schemaVersion,'portplan-v15-seen-cold-cache-delivery-development-protocol');
  assert.deepEqual(protocol.originalIndex,INDEX);assert.deepEqual(protocol.originalDiagnosis,DIAGNOSIS);assert.deepEqual(protocol.caseDays,CASE_DAYS_DELIVERY_V15);
  assert.deepEqual(protocol.methods,METHODS_DELIVERY_V15);assert.deepEqual(protocol.originalRepeats,[{index:1,seed:79011},{index:2,seed:79023},{index:3,seed:79039}]);
  assert.equal(protocol.uniqueBusinessScenarioCount,4);assert.equal(protocol.archivedEndpointCount,12);assert.equal(protocol.branchRunCount,36);
  for(const key of ['newHeldOutExperiments','newOrderGeneration','newAlgorithmSeeds'])assert.equal(protocol[key],0);
  assert.equal(protocol.ciComputed,false);assert.equal(protocol.historicalCacheImported,false);assert.equal(protocol.prefixSourceMethod,'guardedHiGHSV13');
  assert.deepEqual(protocol.prefixProjectionKeys,[...REPLAY_PREFIX_KEYS_V13]);
  assert.deepEqual(protocol.budget,{dailyBudgetMs:200,parentHardWallMs:5000,nativeThreads:1,nativeRandomSeed:0,parentAcceptance:FIXED_PARENT_ACCEPTANCE_V12});
  assert.deepEqual(protocol.callBudgets,CALL_BUDGETS_DELIVERY_V15);assert.equal(protocol.candidateChange.nativeReturnReserveMs,10);
  assert.equal(protocol.candidateChange.wholeCallMs,200);assert.equal(protocol.candidateChange.nativeTargetMs,190);assert.equal(protocol.candidateChange.serviceAuditReserveMs,2);
  assert.deepEqual(protocol.executionAuthorization,{protocolGrantsSolverRun:false,noSolverDuringDeclare:true,explicitRunFlagRequired:true,requiresCommittedSource:true,requiresPushedSource:true,
    requiresRootExplicitRunAuthorization:true,retriesOrResumeAllowed:false,parameterRetuningAllowed:false,naturalD0ExpansionAllowed:false});
  const expected=CASE_DAYS_DELIVERY_V15.flatMap(row=>[1,2,3].map(repeatIndex=>({...row,repeatIndex})));
  assert.equal(protocol.endpoints.length,12);
  for(const [i,item]of protocol.endpoints.entries()){
    for(const key of ['caseId','interventionDay','repeatIndex'])assert.equal(item[key],expected[i][key]);
    assert.equal(item.algorithmSeed,[79011,79023,79039][item.repeatIndex-1]);assert.equal(item.endpointId,item.caseId+'::repeat-'+item.repeatIndex);
    assert.deepEqual(item.prefixDays,Array.from({length:item.interventionDay},(_,d)=>d));assert.match(item.prefixProjectionSha256,/^[a-f0-9]{64}$/);
    assert.equal(evidenceHashV15(item.publicSnapshot),item.publicSnapshotSha256);assert.equal(evidenceHashV15(item.fixedEvents),item.fixedEventsSha256);
    for(const ref of [item.sourceInputArtifact,item.sourceEpisodeArtifact])assert.equal(protocol.sourceBindings[ref.path],ref.sha256);
  }
  for(const [name,digest]of Object.entries(protocol.sourceBindings)){safeEvidencePathV15(name);assert.match(digest,/^[a-f0-9]{64}$/);}
  assert.equal(Object.keys(protocol.sourceBindings).length,18);assert.equal(protocol.sourceBindings[INDEX.path],INDEX.sha256);assert.equal(protocol.sourceBindings[DIAGNOSIS.path],DIAGNOSIS.sha256);
  assert.deepEqual(protocol.jobs,jobsForDeliveryV15(protocol.endpoints));return protocol;
}

export async function verifyDeliverySourcesV15(protocol,{sourceRoot=ROOT}={}){
  validateDeliveryProtocolV15(protocol);const originals=new Map();
  for(const [name,digest]of Object.entries(protocol.sourceBindings))originals.set(name,await readBound(sourceRoot,name,digest));
  const index=JSON.parse(originals.get(INDEX.path)),diagnosis=JSON.parse(originals.get(DIAGNOSIS.path));
  assert.deepEqual([...new Set(diagnosis.lossEpisodes.map(row=>row.caseId))].sort(),CASE_DAYS_DELIVERY_V15.map(row=>row.caseId).sort());
  for(const item of protocol.endpoints){
    const input=JSON.parse(originals.get(item.sourceInputArtifact.path)),episode=JSON.parse(originals.get(item.sourceEpisodeArtifact.path));
    assert.equal(input.nominalScenario.id,item.caseId);assert.equal(input.config.id,item.caseId);assert.equal(episode.caseId,item.caseId);assert.equal(episode.method,'guardedHiGHSV13');
    assert.equal(episode.repeatIndex,item.repeatIndex);assert.equal(episode.algorithmSeed,item.algorithmSeed);
    const c=index.cases.find(row=>row.id===item.caseId),repeat=c.repeats.find(row=>row.repeatIndex===item.repeatIndex);
    assert.equal(c.inputArtifact.sha256,item.sourceInputArtifact.sha256);assert.equal(repeat.policies.guardedHiGHSV13.artifact.sha256,item.sourceEpisodeArtifact.sha256);
    const observed=reconstructNativeDiagnosticSnapshot(input.nominalScenario,episode.result,item.interventionDay);
    assert.deepEqual(observed.snapshot,item.publicSnapshot);assert.deepEqual(observed.fixedEvents,item.fixedEvents);assert.equal(observed.observationHash,item.originalObservationHash);
    assert.equal(evidenceHashV15(prefixProjectionV15(episode.result.timeline,item.interventionDay)),item.prefixProjectionSha256);
    const trace=episode.result.plannerTrace.find(row=>row.day===item.interventionDay);
    assert.equal(trace.plannerStatus,item.originalInterventionStatus);assert.equal(trace.stabilitySelection.cacheStatus,item.originalInterventionCacheStatus);
    assert.equal(episode.result.complete===true,item.originalComplete);
    assert.equal(diagnosis.lossEpisodes.some(row=>row.caseId===item.caseId&&row.repeatIndex===item.repeatIndex),item.originalLossEpisode);
  }
  return {verifiedSourceCount:originals.size,uniqueBusinessScenarioCount:4,archivedEndpointCount:12,plannedRuns:36,historicalCacheImported:false,newHeldOutExperiments:0,newOrderGeneration:0,optimizerCalls:0};
}

async function sourceInventory(){
  const names=['AGENTS.md','package.json','package-lock.json',PROTOCOL,'data/protocol-v2.json','data/protocol-v12.json'];
  for(const name of await fs.readdir(ROOT))if(/^requirements[^/]*\.txt$/.test(name))names.push(name);
  const collect=async directory=>{for(const entry of await fs.readdir(path.join(ROOT,directory),{withFileTypes:true})){
    const name=directory+'/'+entry.name;if(entry.isDirectory())await collect(name);else if(/\.(js|mjs|py)$/.test(entry.name))names.push(name);
  }};
  for(const directory of ['src','scripts','tests'])await collect(directory);return [...new Set(names)].sort();
}
async function hashRuntimeSources(){const hashes={};for(const name of await sourceInventory())hashes[name]=sha(await fs.readFile(path.join(ROOT,name)));return hashes;}
async function verifyRuntime(root,hashes){for(const [name,digest]of Object.entries(hashes))await readBound(root,name,digest);}
function artifactOutput(directory){const output=path.resolve(directory);assert.ok(output.startsWith(path.join(ROOT,'artifacts')+path.sep),'Output must be a new directory inside artifacts/.');return output;}
async function gitText(args){const result=await execFileAsync('git',args,{cwd:ROOT,encoding:'utf8'});return result.stdout.trim();}
async function assertPushedSourceCommit(commit){
  assert.match(commit,/^[a-f0-9]{40}$/,'Root must supply the exact pushed preregistration commit.');
  assert.equal(await gitText(['rev-parse','HEAD']),commit,'HEAD differs from root declared preregistration commit.');
  assert.equal(await gitText(['status','--porcelain','--untracked-files=all']),'','Commit every implementation/protocol/review change before declaration.');
  assert.equal(await gitText(['rev-parse','refs/remotes/origin/main']),commit,'Local tracked origin/main does not match preregistration HEAD. Root must separately authenticate the remote backup.');
}

export async function declareDeliveryReplayV15(directory,{sourceCommit}={}){
  await assertPushedSourceCommit(sourceCommit);
  const output=artifactOutput(directory);await assertNewOutputV12(output);
  const protocolBytes=await fs.readFile(path.join(ROOT,PROTOCOL)),protocol=validateDeliveryProtocolV15(JSON.parse(protocolBytes));
  const sourceVerification=await verifyDeliverySourcesV15(protocol),implementationHashes=await hashRuntimeSources();
  assert.ok(implementationHashes['scripts/review-delivery-v15.py'],'Independent review implementation must be frozen before declaration.');
  await fs.mkdir(path.dirname(output),{recursive:true});await fs.mkdir(output,{recursive:false});
  for(const [name,digest]of Object.entries(implementationHashes)){
    const bytes=await readBound(ROOT,name,digest),target=path.join(output,'source',name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes,{flag:'wx'});
  }
  for(const [name,digest]of Object.entries(protocol.sourceBindings)){
    const bytes=await readBound(ROOT,name,digest),target=path.join(output,'original',name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes,{flag:'wx'});
  }
  await verifyRuntime(path.join(output,'source'),implementationHashes);await verifyRuntime(ROOT,implementationHashes);await assertPushedSourceCommit(sourceCommit);
  const declaration={schemaVersion:'portplan-v15-cold-cache-delivery-declaration',executionState:'declared',declaredAt:new Date().toISOString(),
    protocolPath:PROTOCOL,protocolSha256:sha(protocolBytes),protocol,rootAuthorized:false,sourceCommit,implementationHashes,sourceBindings:protocol.sourceBindings,
    jobs:protocol.jobs,sourceVerification,newHeldOutExperiments:0,newGeneratedSeeds:0,ciComputed:false,historicalCacheImported:false,
    scope:protocol.coldCacheLimitation,declarationCommit:'WX declaration after exact source/original SHA verification. Partial directories cannot execute, resume or be reused.'};
  await fs.writeFile(path.join(output,'declaration.json'),jsonBytes(declaration),{flag:'wx'});return declaration;
}

export function summarizeDeliveryReplayV15(records){
  const byMethod=Object.fromEntries(METHODS_DELIVERY_V15.map(method=>{
    const rows=records.filter(row=>row.method===method);return [method,{runCount:rows.length,completeWithinBudgetCount:rows.filter(row=>isCompleteV12(row.receipt)).length,
      unknownHistoryCount:rows.filter(row=>row.receipt.executionHistoryUnavailable===true).length,
      outcomes:rows.map(row=>({jobId:row.jobId,endpointId:row.endpointId,caseId:row.caseId,repeatIndex:row.repeatIndex,interventionDay:row.interventionDay,status:row.receipt.status,
        complete:isCompleteV12(row.receipt),failureDay:row.receipt.failure?.day??null,totalCost:row.receipt.totalCost,incrementalCost:row.receipt.incrementalCost,revisionCount:row.receipt.revisionCount}))}];
  }));
  const comparisons=[];
  for(const baseline of ['seededHiGHSV12','guardedHiGHSV13']){
    const pairs=[];
    for(const definition of CASE_DAYS_DELIVERY_V15)for(const repeatIndex of [1,2,3]){
      const b=records.find(row=>row.caseId===definition.caseId&&row.repeatIndex===repeatIndex&&row.method===baseline),a=records.find(row=>row.caseId===definition.caseId&&row.repeatIndex===repeatIndex&&row.method==='timelyHiGHSV15');
      if(!a||!b)continue;
      const bc=isCompleteV12(b.receipt),ac=isCompleteV12(a.receipt),joint=bc&&ac;
      pairs.push({endpointId:definition.caseId+'::repeat-'+repeatIndex,caseId:definition.caseId,repeatIndex,baselineComplete:bc,candidateComplete:ac,jointlyCompleted:joint,
        totalBaselineMinusCandidateKRW:joint?b.receipt.totalCost-a.receipt.totalCost:null,incrementalBaselineMinusCandidateKRW:joint?b.receipt.incrementalCost-a.receipt.incrementalCost:null,
        revisionBaselineMinusCandidate:joint&&Number.isFinite(b.receipt.revisionCount)&&Number.isFinite(a.receipt.revisionCount)?b.receipt.revisionCount-a.receipt.revisionCount:null});
    }
    comparisons.push({baselineMethod:baseline,candidateMethod:'timelyHiGHSV15',endpointPairCount:pairs.length,jointlyCompletedEndpointPairCount:pairs.filter(row=>row.jointlyCompleted).length,
      gained:pairs.filter(row=>!row.baselineComplete&&row.candidateComplete).length,lost:pairs.filter(row=>row.baselineComplete&&!row.candidateComplete).length,pairs});
  }
  return {runCount:records.length,uniqueBusinessScenarioCount:4,archivedEndpointCount:12,byMethod,comparisons,ciComputed:false,newHeldOutExperiments:0,historicalCacheImported:false,
    scope:'Descriptive cold-cache seen-endpoint continuation only; 36 branches are not 36 business samples. Terminal fee/revision comparisons require matching joint completion. No natural D0, holdout, research-CI or default-policy claim.'};
}

export async function runDeclaredDeliveryReplayV15(directory,{rootAuthorized=false,sourceCommit}={}){
  assert.equal(rootAuthorized,true,'Root must separately authorize one isolated native runtime window.');await assertPushedSourceCommit(sourceCommit);
  const output=artifactOutput(directory),declarationBytes=await fs.readFile(path.join(output,'declaration.json')),declaration=JSON.parse(declarationBytes);
  assert.equal(declaration.schemaVersion,'portplan-v15-cold-cache-delivery-declaration');assert.equal(declaration.executionState,'declared');assert.equal(declaration.sourceCommit,sourceCommit);
  validateDeliveryProtocolV15(declaration.protocol);assert.deepEqual(declaration.jobs,declaration.protocol.jobs);assert.deepEqual(declaration.sourceBindings,declaration.protocol.sourceBindings);
  assert.equal(declaration.protocolSha256,declaration.implementationHashes[PROTOCOL]);
  assert.deepEqual(await hashRuntimeSources(),declaration.implementationHashes,'Live sources changed after declaration.');await verifyRuntime(path.join(output,'source'),declaration.implementationHashes);
  const frozenProtocolBytes=await readBound(path.join(output,'source'),PROTOCOL,declaration.protocolSha256);
  assert.deepEqual(declaration.protocol,validateDeliveryProtocolV15(JSON.parse(frozenProtocolBytes)),'Embedded declaration differs from frozen protocol bytes.');
  await verifyDeliverySourcesV15(declaration.protocol);await verifyDeliverySourcesV15(declaration.protocol,{sourceRoot:path.join(output,'original')});
  await fs.writeFile(path.join(output,'execution-start.json'),jsonBytes({rootAuthorized:true,startedAt:new Date().toISOString(),sourceCommit,
    declarationSha256:sha(declarationBytes),protocolSha256:declaration.protocolSha256,runtimeImplementationHashes:declaration.implementationHashes,
    sourceConsistency:{live:true,frozen:true,originals:true},plannedJobCount:36}),{flag:'wx'});
  await fs.mkdir(path.join(output,'episodes'),{recursive:false});await fs.writeFile(path.join(output,'episodes.ndjson'),'',{flag:'wx'});
  const {runColdEpisodeV12}=await import(pathToFileURL(path.join(output,'source/scripts/benchmark-v12.mjs')).href),records=[];
  for(const [index,job]of declaration.jobs.entries()){
    const number=String(index+1).padStart(2,'0'),item=declaration.protocol.endpoints.find(row=>row.endpointId===job.endpointId);
    const originalInput=JSON.parse(await readBound(path.join(output,'original'),item.sourceInputArtifact.path,item.sourceInputArtifact.sha256));
    const originalEpisode=JSON.parse(await readBound(path.join(output,'original'),item.sourceEpisodeArtifact.path,item.sourceEpisodeArtifact.sha256));
    const journalName=`journal-${number}.ndjson`,journalPath=path.join(output,journalName);await fs.writeFile(journalPath,'',{flag:'wx'});
    const identity={...job,episodeId:job.jobId,sourceInputArtifact:item.sourceInputArtifact,sourceEpisodeArtifact:item.sourceEpisodeArtifact};
    const result=await runColdEpisodeV12({...identity,nominalScenario:originalInput.nominalScenario,events:originalInput.events,originalResult:originalEpisode.result,
      caseDefinition:item,dailyBudgetMs:200,plannerConfiguration:declaration.protocol.callBudgets[job.method],journalPath,outputDirectory:output},
      {hardWallMs:5000,workerScript:path.join(output,'source/scripts/replay-delivery-v15.worker.mjs')});
    const name=`episodes/episode-${number}.json`,bytes=jsonBytes({...identity,result});await fs.writeFile(path.join(output,name),bytes,{flag:'wx'});
    const artifact={path:name,sha256:sha(bytes)},journalBytes=await fs.readFile(journalPath),receipt=compactEpisodeReceiptV12(result,artifact);
    const record={...identity,artifact,journal:{path:journalName,sha256:sha(journalBytes)},receipt};records.push(record);
    await fs.appendFile(path.join(output,'episodes.ndjson'),JSON.stringify(record)+'\n');
    await fs.writeFile(path.join(output,`checkpoint-${number}.json`),jsonBytes({executionState:'running',protocolSha256:declaration.protocolSha256,completedJobCount:records.length,records,summary:summarizeDeliveryReplayV15(records)}),{flag:'wx'});
    console.log(JSON.stringify({index:index+1,total:36,jobId:job.jobId,status:result.status,complete:isCompleteV12(result),historyUnknown:result.executionHistoryUnavailable,failureDay:result.failure?.day??null}));
  }
  await verifyRuntime(ROOT,declaration.implementationHashes);await verifyRuntime(path.join(output,'source'),declaration.implementationHashes);
  await verifyDeliverySourcesV15(declaration.protocol);await verifyDeliverySourcesV15(declaration.protocol,{sourceRoot:path.join(output,'original')});await assertPushedSourceCommit(sourceCommit);
  const complete={schemaVersion:'portplan-v15-cold-cache-delivery-results',executionState:'complete',completedAt:new Date().toISOString(),sourceCommit,
    declarationSha256:sha(declarationBytes),protocolSha256:declaration.protocolSha256,implementationHashes:declaration.implementationHashes,sourceBindings:declaration.sourceBindings,
    sourceConsistency:{before:true,after:true},newHeldOutExperiments:0,newGeneratedSeeds:0,ciComputed:false,historicalCacheImported:false,records,summary:summarizeDeliveryReplayV15(records)};
  await fs.writeFile(path.join(output,'complete.json'),jsonBytes(complete),{flag:'wx'});return complete;
}

async function main(){
  const args=process.argv.slice(2),value=name=>{const index=args.indexOf(name);assert.ok(index>=0&&args[index+1]&&!args[index+1].startsWith('--'),'Missing '+name);return args[index+1];};
  if(args.includes('--write-protocol')){const protocol=await buildDeliveryProtocolV15();await fs.writeFile(path.join(ROOT,PROTOCOL),jsonBytes(protocol),{flag:'wx'});console.log(JSON.stringify({protocolPath:PROTOCOL,archivedEndpointCount:12,plannedRuns:36,optimizerCalls:0}));return;}
  if(args.includes('--inspect')){const protocol=validateDeliveryProtocolV15(JSON.parse(await fs.readFile(path.join(ROOT,PROTOCOL))));console.log(JSON.stringify(await verifyDeliverySourcesV15(protocol),null,2));return;}
  if(args.includes('--declare')){const result=await declareDeliveryReplayV15(path.resolve(ROOT,value('--output')),{sourceCommit:value('--source-commit')});console.log(JSON.stringify({executionState:result.executionState,protocolSha256:result.protocolSha256,sourceCommit:result.sourceCommit,plannedRuns:result.jobs.length,optimizerCalls:0}));return;}
  if(args.includes('--run')){const result=await runDeclaredDeliveryReplayV15(path.resolve(ROOT,value('--declared')),{rootAuthorized:args.includes('--root-authorized'),sourceCommit:value('--source-commit')});console.log(JSON.stringify({executionState:result.executionState,summary:result.summary},null,2));return;}
  throw new Error('Use --write-protocol, --inspect, --declare --output artifacts/NEW --source-commit PUSHED_SHA, or --run --declared artifacts/PATH --source-commit PUSHED_SHA --root-authorized. No implicit optimizer, generation, resume or retry.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
