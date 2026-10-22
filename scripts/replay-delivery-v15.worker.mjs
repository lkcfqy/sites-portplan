/** Seen-input cold-cache slice. Archived prefix decisions are forced physical
 * replay, never newly discovered native candidates or a natural D0 policy. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,basename} from 'node:path';
import {auditSchedule} from '../src/engine.js';
import {realizeCapacityEvents,runRollingScenario} from '../src/rolling-plan.js';
import {independentAuditV2} from './benchmark-v2.mjs';
import {unknownEpisodeV12} from './episode-v12.worker.mjs';
import {canonicalJSONV13,evidenceHashV13,REPLAY_PREFIX_KEYS_V13,REPLAY_FEES_V13,originalLocksBeforeDayV13,reconstructReplayEndpointV13} from './replay-guard-v13.worker.mjs';

export {canonicalJSONV13 as canonicalJSONV15,evidenceHashV13 as evidenceHashV15};
export const METHODS_DELIVERY_V15=Object.freeze(['seededHiGHSV12','guardedHiGHSV13','timelyHiGHSV15']);
export const METHOD_REGISTRY_DELIVERY_V15=Object.freeze({
  seededHiGHSV12:Object.freeze({module:'./highs-planner-v12.mjs',factory:'createSeededCommitmentHiGHSPlannerV12'}),
  guardedHiGHSV13:Object.freeze({module:'./highs-planner-v13.mjs',factory:'createGuardedCommitmentHiGHSPlannerV13'}),
  timelyHiGHSV15:Object.freeze({module:'./highs-planner-v15.mjs',factory:'createTimelySeededHiGHSPlannerV15'}),
});
const datesOf=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const feesOf=result=>Object.fromEntries(REPLAY_FEES_V13.map(key=>[key,result[key]]));
export const prefixProjectionV15=(timeline,day)=>timeline.filter(entry=>entry.day<day).map(entry=>Object.fromEntries(REPLAY_PREFIX_KEYS_V13.map(key=>[key,entry[key]])));

export async function createDeliveryPlannerV15(method,configuration){
  assert.ok(Object.hasOwn(METHOD_REGISTRY_DELIVERY_V15,method),'Only the three frozen methods are allowed.');
  for(const key of ['enableDevelopmentEndpointImport','servicePath','pythonExecutable','seedConstructor','now','onIncumbent'])assert.ok(!Object.hasOwn(configuration,key),'Forbidden injected planner configuration: '+key);
  const def=METHOD_REGISTRY_DELIVERY_V15[method],module=await import(new URL(def.module,import.meta.url));
  return module[def.factory](configuration);
}

export function assertDeliveryReplayInputV15(input){
  assert.ok(METHODS_DELIVERY_V15.includes(input.method));
  assert.ok([1,2,3].includes(input.repeatIndex));assert.equal(input.algorithmSeed,[79011,79023,79039][input.repeatIndex-1]);
  assert.equal(input.dailyBudgetMs,200);assert.equal(input.caseDefinition.caseId,input.caseId);
  assert.equal(input.caseDefinition.repeatIndex,input.repeatIndex);assert.equal(input.caseDefinition.algorithmSeed,input.algorithmSeed);
  const item=input.caseDefinition,day=item.interventionDay;
  assert.equal(evidenceHashV13(prefixProjectionV15(input.originalResult.timeline,day)),item.prefixProjectionSha256);
  assert.equal(evidenceHashV13(item.publicSnapshot),item.publicSnapshotSha256);assert.equal(evidenceHashV13(item.fixedEvents),item.fixedEventsSha256);
  assert.equal(input.originalResult.timeline[day].observationHash,item.originalObservationHash);
  assert.equal(input.plannerConfiguration.timeBudgetMs,200);assert.equal(input.plannerConfiguration.auditReserveMs,2);
  assert.equal(input.plannerConfiguration.constructorBudgetMs,40);assert.equal(input.plannerConfiguration.constructorAuditReserveMs,5);assert.equal(input.plannerConfiguration.maxRestarts,3);
  assert.equal(input.plannerConfiguration.retainCacheFallback,true);
  if(input.method==='timelyHiGHSV15')assert.equal(input.plannerConfiguration.nativeReturnReserveMs,10);
  else assert.ok(!Object.hasOwn(input.plannerConfiguration,'nativeReturnReserveMs'));
}

/** Factory injection exists only for direct handwritten fixtures, never IPC. */
export async function runDeliveryReplayV15(input,{plannerFactoryForTest}={}){
  assertDeliveryReplayInputV15(input);
  const {method,nominalScenario,events,originalResult,caseDefinition,algorithmSeed}=input,interventionDay=caseDefinition.interventionDay;
  if(input.journalPath){assert.equal(dirname(resolve(input.journalPath)),resolve(input.outputDirectory));assert.match(basename(input.journalPath),/^journal-\d{2}\.ndjson$/);}
  const trace=[],journal=async record=>{if(input.journalPath)await fs.appendFile(input.journalPath,JSON.stringify(record)+'\n');};
  const startupStarted=performance.now();
  const planner=plannerFactoryForTest?await plannerFactoryForTest({...input.plannerConfiguration,seed:algorithmSeed}):await createDeliveryPlannerV15(method,{...input.plannerConfiguration,seed:algorithmSeed});
  let startupWallMs=null,result,previousSolverCalls=0,actualDecisionCalls=0;
  try{
    await planner.ready();startupWallMs=performance.now()-startupStarted;
    await journal({type:'ready',method,startupWallMs,scope:'Factory/import/native-ready and all replay work count against the same cold five-second parent clock.'});
    result=await runRollingScenario(nominalScenario,events,{timeLimitSeconds:.2,objectiveMode:'joint',planner:async(snapshot,options)=>{
      const started=performance.now(),day=options.minEventDay,forced=day<interventionDay;
      const record={day,phase:forced?'archived_prefix':day===interventionDay?'cold_cache_intervention':'natural_suffix',
        publicSnapshot:structuredClone(snapshot),fixedEvents:structuredClone(options.fixedEvents),dailyBudgetMs:200,
        nativePolicyDecision:!forced,actualNativeRequests:0,claimsNativeDiscovery:false,claimsNaturalFullD0:false,
        historicalCacheImported:false,firstActualPlannerCall:day===interventionDay};
      let candidate;
      try{
        if(forced){
          assert.deepEqual(options.fixedEvents,originalLocksBeforeDayV13(originalResult,day),'Forced physical locks changed.');
          const originalEntry=originalResult.timeline.find(row=>row.day===day),originalTrace=originalResult.plannerTrace.find(row=>row.day===day);
          assert.equal(originalEntry.status,'executed');
          candidate=reconstructReplayEndpointV13(snapshot,originalEntry.decisions,options.fixedEvents,day,originalTrace.stabilitySelection.afterFees);
          record.archivedDecisionDatesSha256=evidenceHashV13(originalEntry.decisions);
          candidate.plannerMetadata={method:'archived_prefix_replay_v15',phase:record.phase,optimizerCalls:0,decisionCalls:0,solverCalls:0,
            claimsNativeDiscovery:false,claimsNaturalFullD0:false,historicalCacheImported:false};
        }else{
          if(day===interventionDay){
            assert.deepEqual(snapshot,caseDefinition.publicSnapshot,'Intervention public snapshot differs.');
            assert.deepEqual(options.fixedEvents,caseDefinition.fixedEvents,'Intervention physical locks differ.');
          }
          actualDecisionCalls++;
          // Only fresh public observations and past physical locks cross this
          // boundary. The factory never receives the replay/source definition.
          candidate=await planner(snapshot,{...options,seed:algorithmSeed,timeBudgetMs:200});
          const metadata=candidate?.plannerMetadata??{};
          record.metadata=structuredClone(metadata);
          record.nativeReturnedIncumbent=metadata.nativeCertificate?.hasIncumbent===true;
          record.selectedSource=metadata.candidateSource??null;
          record.claimsNativeDiscovery=record.nativeReturnedIncumbent;
          assert.equal(metadata.developmentEndpointImport??null,null,'No historical cache imports are allowed.');
          const cumulative=metadata.solverCalls;
          if(Number.isInteger(cumulative)){record.actualNativeRequests=cumulative-previousSolverCalls;previousSolverCalls=cumulative;assert.ok([0,1].includes(record.actualNativeRequests));}
          else record.actualNativeRequests=null;
        }
        record.plannerStatus=candidate?.status??'missing_result';record.selectedDates=Array.isArray(candidate?.rows)?datesOf(candidate.rows):[];
        record.fees=candidate?.rows?.length===snapshot.containers.length?feesOf(candidate):null;
        record.metadata=structuredClone(candidate?.plannerMetadata??{});
      }catch(error){record.error=String(error.stack??error);record.plannerStatus='replay_error';if(!forced)record.actualNativeRequests=null;}
      record.callWallMs=performance.now()-started;
      trace.push(record);await journal({type:'decision_receipt',...record,scope:'Candidate diagnostic only; accepted terminal simulator history establishes physical execution.'});
      if(record.error)throw new Error(record.error);
      if(forced){record.forcedStepAcceptanceWallMs=performance.now()-started;record.forcedStepTimely=record.forcedStepAcceptanceWallMs<=200;
        if(!record.forcedStepTimely)return {status:'time_limit',rows:[],reason:'Archived-prefix reconstruction, audit and receipt work exceeded the unchanged 200ms cooperative limit.'};}
      return candidate;
    }});
    const prefixChecks=[];
    for(let day=0;day<Math.min(interventionDay,result.timeline.length);day++){
      const expected=originalResult.timeline.find(row=>row.day===day),actual=result.timeline.find(row=>row.day===day);
      if(actual.status!=='executed')break;
      const projection=entry=>Object.fromEntries(REPLAY_PREFIX_KEYS_V13.map(key=>[key,entry[key]]));
      assert.deepEqual(projection(actual),projection(expected),'Archived physical prefix changed on D'+day);
      prefixChecks.push({day,exactProjectedMatch:true,sha256:evidenceHashV13(projection(actual)),keys:[...REPLAY_PREFIX_KEYS_V13]});
    }
    const endpoint=result.timeline.find(row=>row.day===interventionDay);
    if(endpoint){assert.equal(prefixChecks.length,interventionDay);assert.equal(endpoint.observationHash,caseDefinition.originalObservationHash);assert.deepEqual(endpoint.observedEvents,originalResult.timeline.find(row=>row.day===interventionDay).observedEvents);}
    result.policy=method;result.studyVersion='v15-seen-cold-cache-development';result.plannerTrace=trace;result.replayPrefixChecks=prefixChecks;
    result.startupWallMs=startupWallMs;result.algorithmSeed=algorithmSeed;result.repeatIndex=input.repeatIndex;result.executionHistoryUnavailable=false;
    result.historicalCacheImported=false;result.naturalFullD0=false;result.replayIdentity={caseId:input.caseId,repeatIndex:input.repeatIndex,interventionDay,
      prefixProjectionSha256:caseDefinition.prefixProjectionSha256,publicSnapshotSha256:caseDefinition.publicSnapshotSha256,fixedEventsSha256:caseDefinition.fixedEventsSha256,
      originalObservationHash:caseDefinition.originalObservationHash};
    result.replayScope='Seen synthetic cold-cache slice. Forced original V13 repeat-specific physical prefix, no historical planner cache import, first real policy call at the fixed intervention day, then natural rolling suffix. Not new business samples, held-out validation, natural full-D0 policy timing or historical V13 reproduction.';
    result.plannerStats={actualDecisionCalls,nativeDecisionCalls:actualDecisionCalls,solverCalls:trace.some(row=>row.actualNativeRequests===null)?null:trace.reduce((sum,row)=>sum+row.actualNativeRequests,0),
      archivedReplayCalls:trace.filter(row=>!row.nativePolicyDecision).length,decisionCalls:trace.length,callWallMs:trace.map(row=>row.callWallMs),maxCallWallMs:Math.max(0,...trace.map(row=>row.callWallMs)),historicalCacheImported:false};
    if(result.complete){
      const actual=realizeCapacityEvents(nominalScenario,events),engine=auditSchedule(actual,result.rows),independentErrors=independentAuditV2(actual,result);
      result.terminalAudit={engine,independentErrors};result.auditErrors=[...engine.errors,...independentErrors];result.auditValid=result.auditErrors.length===0;
      if(!result.auditValid){result.complete=false;result.status='audit_failed';result.failure={kind:'terminal_audit_failed',errors:result.auditErrors};}
    }else result.auditValid=false;
    if(!result.complete){result.rows=[];result.usage=[];for(const key of [...REPLAY_FEES_V13,'lateCount'])result[key]=null;}
    return result;
  }finally{await planner.close();}
}

async function main(){
  const input=await new Promise(done=>process.once('message',done));let result;
  try{result=await runDeliveryReplayV15(input);}catch(error){result=unknownEpisodeV12(input.method,String(error.stack??error),'replay_error');}
  await new Promise(done=>process.send({type:'final',episodeId:input.episodeId,method:input.method,result},done));process.disconnect();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
