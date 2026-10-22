/** Seen-input controlled continuation. Offline endpoints are interventions,
 * never claims that V13 discovered a candidate or reached this prefix. */
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname,basename} from 'node:path';
import {auditSchedule,rowFor,summarize,validateScenario} from '../src/engine.js';
import {auditFrozenEvents,realizeCapacityEvents,runRollingScenario} from '../src/rolling-plan.js';
import {independentAuditV2} from './benchmark-v2.mjs';
import {unknownEpisodeV12} from './episode-v12.worker.mjs';
import {createGuardedCommitmentHiGHSPlannerV13} from './highs-planner-v13.mjs';

export const REPLAY_PREFIX_KEYS_V13=Object.freeze(['day','observedEvents','observationHash','decisions','executedEvents','state','revisions','revisionCount']);
export const REPLAY_FEES_V13=Object.freeze(['storageCost','ddCost','totalCost','sunkCost','incrementalCost','objectiveCost']);
const EVENT_FIELDS={pickup:'pickupDay',unloadStart:'unloadDay',return:'returnDay'};
const datesOf=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const feesOf=result=>Object.fromEntries(REPLAY_FEES_V13.map(key=>[key,result[key]]));
export function canonicalJSONV13(value){
  if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
  if(typeof value==='number'){assert.ok(Number.isFinite(value),'Non-finite evidence number.');return JSON.stringify(value);}
  if(Array.isArray(value))return '['+value.map(canonicalJSONV13).join(',')+']';
  assert.ok(value&&typeof value==='object','Evidence must contain only finite JSON values.');
  return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonicalJSONV13(value[key])).join(',')+'}';
}
export const evidenceHashV13=value=>createHash('sha256').update(canonicalJSONV13(value)).digest('hex');
export const prefixProjectionV13=timeline=>timeline.filter(entry=>entry.day<5).map(entry=>Object.fromEntries(REPLAY_PREFIX_KEYS_V13.map(key=>[key,entry[key]])));
export function originalLocksBeforeDayV13(original,day){
  const locks=Object.create(null);
  for(const entry of original.timeline.filter(entry=>entry.day<day))for(const event of entry.executedEvents){
    assert.ok(Object.hasOwn(EVENT_FIELDS,event.event),'Unknown archived physical event.');
    assert.equal(event.day,entry.day,'Archived action day differs.');
    if(!Object.hasOwn(locks,event.id))Object.defineProperty(locks,event.id,{value:Object.create(null),enumerable:true});
    const field=EVENT_FIELDS[event.event];assert.ok(!Object.hasOwn(locks[event.id],field),'Duplicate archived physical action.');locks[event.id][field]=event.day;
  }
  return JSON.parse(JSON.stringify(locks));
}
export function reconstructReplayEndpointV13(snapshot,endpoint,fixedEvents,day,expectedFees){
  const validation=validateScenario(snapshot);assert.equal(validation.valid,true,validation.errors.join('; '));
  assert.ok(Array.isArray(endpoint));assert.equal(endpoint.length,snapshot.containers.length);
  const byId=new Map();
  for(const row of endpoint){
    assert.ok(row&&typeof row.id==='string'&&!byId.has(row.id),'Unknown/duplicate endpoint identity.');
    for(const key of ['pickupDay','unloadDay','returnDay'])assert.ok(Number.isInteger(row[key])&&row[key]>=0&&row[key]<snapshot.horizonDays,'Endpoint date outside horizon.');
    byId.set(row.id,row);
  }
  const rows=snapshot.containers.map(c=>{const row=byId.get(c.id);assert.ok(row,'Endpoint missing known order.');return rowFor(snapshot,c,row.pickupDay,row.unloadDay,row.returnDay);});
  const candidate=summarize(snapshot,'controlledGuardReplayV13',rows,0,'feasible',{objectiveMode:'joint'});
  const scheduleAudit=auditSchedule(snapshot,rows),freezeAudit=auditFrozenEvents(rows,fixedEvents,day),independentErrors=independentAuditV2(snapshot,candidate);
  assert.equal(scheduleAudit.valid,true,scheduleAudit.errors.join('; '));assert.equal(freezeAudit.valid,true,freezeAudit.errors.join('; '));
  assert.deepEqual(independentErrors,[],'Endpoint independent fee/capacity audit failed.');
  if(expectedFees)for(const key of REPLAY_FEES_V13){
    const expected=key==='objectiveCost'?(expectedFees.objectiveCost??expectedFees.incrementalCost):expectedFees[key];
    assert.ok(Number.isFinite(expected),'Missing/non-finite archived endpoint fee.');assert.equal(candidate[key],expected,'Archived '+key+' differs.');
  }
  return {...candidate,endpointAudit:{scheduleAudit,freezeAudit,independentErrors},endpointDates:datesOf(rows)};
}

export function assertReplayInputV13(input){
  assert.equal(input.method,'controlledGuardReplayV13');assert.equal(input.algorithmSeed,69011);
  assert.ok(['forced_seed','forced_native'].includes(input.branch));assert.equal(input.endpointKey,input.branch==='forced_seed'?'seed':'native');
  assert.ok([1,2,3].includes(input.timingRepeatIndex));assert.equal(input.dailyBudgetMs,200);
  const config=input.plannerConfiguration;assert.ok(config);assert.equal(config.timeBudgetMs,200);assert.equal(config.constructorBudgetMs,40);
  assert.equal(config.constructorAuditReserveMs,5);assert.equal(config.maxRestarts,3);
  assert.equal(input.caseDefinition.caseId,input.caseId);assert.equal(input.caseDefinition.originalObservationHash,input.originalResult.timeline[5].observationHash);
  assert.equal(evidenceHashV13(prefixProjectionV13(input.originalResult.timeline)),input.caseDefinition.prefixProjectionSha256);
  const identity=input.caseDefinition.identity;
  for(const [key,value]of Object.entries({publicSnapshotSha256:input.caseDefinition.publicSnapshot,fixedEventsSha256:input.caseDefinition.fixedEvents,
    seedDatesSha256:input.caseDefinition.endpoints.seed.dates,nativeDatesSha256:input.caseDefinition.endpoints.native.dates}))assert.equal(evidenceHashV13(value),identity[key],key+' differs.');
  assert.equal(identity.prefixProjectionSha256,input.caseDefinition.prefixProjectionSha256);
}

/** The optional factory is an in-process handwritten-test seam only. It is
 * never read from IPC input and cannot select an arbitrary worker module. */
export async function runReplayGuardBranchV13(input,{plannerFactory=createGuardedCommitmentHiGHSPlannerV13}={}){
  assertReplayInputV13(input);
  const {nominalScenario,events,originalResult,caseDefinition,algorithmSeed,branch,timingRepeatIndex}=input;
  if(input.journalPath){assert.equal(dirname(resolve(input.journalPath)),resolve(input.outputDirectory));assert.match(basename(input.journalPath),/^journal-\d{2}\.ndjson$/);}
  const trace=[],journal=async value=>{if(input.journalPath)await fs.appendFile(input.journalPath,JSON.stringify(value)+'\n');};
  const planner=plannerFactory({...input.plannerConfiguration,seed:algorithmSeed,enableDevelopmentEndpointImport:true});
  let importReceipt=null,importBinding=null,startupWallMs=null,result,previousSolverCalls=0;
  try{
    const startup=performance.now();await planner.ready();startupWallMs=performance.now()-startup;
    await journal({type:'ready',startupWallMs,scope:'Native startup is charged to the common five-second cold parent clock.'});
    result=await runRollingScenario(nominalScenario,events,{timeLimitSeconds:.2,objectiveMode:'joint',planner:async(snapshot,options)=>{
      const started=performance.now(),day=options.minEventDay,deadline=started+200;
      const record={day,phase:day<5?'archived_prefix':day===5?'forced_endpoint':'guarded_v13_continuation',
        publicSnapshot:structuredClone(snapshot),fixedEvents:structuredClone(options.fixedEvents),dailyBudgetMs:200,
        nativePolicyDecision:day>=6,actualNativeRequests:0,forcedStepStartedAtMs:day===5?started:null,forcedStepDeadlineMs:day===5?deadline:null};
      let candidate;
      try{
        if(day<=5){
          assert.deepEqual(options.fixedEvents,originalLocksBeforeDayV13(originalResult,day),'Archived physical prefix locks changed.');
          const endpoint=day<5?originalResult.timeline[day].decisions:caseDefinition.endpoints[input.endpointKey].dates;
          const expectedFees=day<5?originalResult.plannerTrace[day].stabilitySelection.afterFees:caseDefinition.endpoints[input.endpointKey].fees;
          if(day===5){assert.deepEqual(snapshot,caseDefinition.publicSnapshot);assert.deepEqual(options.fixedEvents,caseDefinition.fixedEvents);}
          candidate=reconstructReplayEndpointV13(snapshot,endpoint,options.fixedEvents,day,expectedFees);
          if(day===5){
            importReceipt=planner.importDevelopmentEndpoint(snapshot,endpoint,{fixedEvents:options.fixedEvents,minEventDay:5,objectiveMode:'joint',deadlineMs:deadline});
            record.offlineImportReceipt=structuredClone(importReceipt);
            importBinding=Object.fromEntries([['snapshotSha256','snapshot'],['sourceDatesSha256','sourceDates'],['fixedEventsSha256','fixedEvents'],
              ['canonicalDatesSha256','canonicalDates'],['feesSha256','fees']].map(([hashKey,valueKey])=>[hashKey,importReceipt[valueKey]===null?null:evidenceHashV13(importReceipt[valueKey])]));
            record.offlineImportBinding=structuredClone(importBinding);
            if(importReceipt.accepted){
              assert.equal(importReceipt.status,'accepted');assert.equal(importReceipt.audit?.valid,true);
              assert.equal(importReceipt.decisionCalls,0);assert.equal(importReceipt.solverCalls,0);assert.equal(importReceipt.claimsNativeDiscovery,false);
              assert.equal(importReceipt.claimsPhysicalExecution,false);assert.deepEqual(importReceipt.canonicalDates,datesOf(candidate.rows));
              assert.deepEqual(importReceipt.snapshot,snapshot);assert.deepEqual(importReceipt.sourceDates,endpoint);assert.deepEqual(importReceipt.fixedEvents,options.fixedEvents);
              assert.equal(importReceipt.minEventDay,5);
              assert.deepEqual(importReceipt.fees,feesOf(candidate));
              assert.ok(Number.isFinite(importReceipt.startedAtMs)&&importReceipt.startedAtMs>=started);
              assert.ok(Number.isFinite(importReceipt.acceptedAtMs)&&importReceipt.acceptedAtMs>=0);
              assert.ok(importReceipt.startedAtMs+importReceipt.acceptedAtMs<=deadline,'Endpoint import accepted after the forced-step deadline.');
            }else candidate={status:String(importReceipt.status).startsWith('late')?'time_limit':'audit_failed',rows:[],
              reason:'Offline endpoint import rejected: '+importReceipt.status+(importReceipt.error?' ('+importReceipt.error+')':'')};
          }
          candidate.plannerMetadata={method:'forced_archived_endpoint',phase:record.phase,optimizerCalls:0,claimsNativeDiscovery:false,
            claimsNaturalV13Prefix:false,endpointKey:day===5?input.endpointKey:null};
        }else{
          // Only these freshly cloned public inputs cross the policy boundary.
          candidate=await planner(snapshot,{...options,seed:algorithmSeed,timeBudgetMs:200});
          const cumulative=candidate?.plannerMetadata?.solverCalls;
          if(Number.isInteger(cumulative)){record.actualNativeRequests=cumulative-previousSolverCalls;previousSolverCalls=cumulative;assert.ok([0,1].includes(record.actualNativeRequests));}
          else record.actualNativeRequests=null;
        }
        record.plannerStatus=candidate?.status??'missing_result';record.selectedDates=Array.isArray(candidate?.rows)?datesOf(candidate.rows):[];
        record.fees=candidate?.rows?.length===snapshot.containers.length?feesOf(candidate):null;record.metadata=structuredClone(candidate?.plannerMetadata??{});
      }catch(error){record.error=String(error.stack??error);record.plannerStatus='replay_error';if(day>=6)record.actualNativeRequests=null;}
      record.callWallMs=performance.now()-started;
      // Retain every call before the next physical execution; a killed worker
      // may leave journal diagnostics but never an accepted execution history.
      trace.push(record);await journal({type:'decision_receipt',...record,scope:'Candidate diagnostics only; accepted final simulator history establishes execution.'});
      if(record.error)throw new Error(record.error);
      if(day<=5){record.forcedStepAcceptanceWallMs=performance.now()-started;record.forcedStepTimely=record.forcedStepAcceptanceWallMs<=200;
        if(!record.forcedStepTimely)return {status:'time_limit',rows:[],reason:'Forced prefix/endpoint audit, import and receipt work exceeded the common 200ms deadline.'};}
      return candidate;
    }});
    const prefixChecks=[];
    for(let day=0;day<Math.min(5,result.timeline.length);day++){
      const expected=originalResult.timeline[day],actual=result.timeline[day];
      if(actual.status!=='executed')break;
      const projection=entry=>Object.fromEntries(REPLAY_PREFIX_KEYS_V13.map(key=>[key,entry[key]]));
      assert.deepEqual(projection(actual),projection(expected),'Original physical prefix changed on D'+day);
      prefixChecks.push({day,exactProjectedMatch:true,sha256:evidenceHashV13(projection(actual)),keys:[...REPLAY_PREFIX_KEYS_V13]});
    }
    const reachedD5=result.timeline.some(entry=>entry.day===5);
    if(reachedD5){assert.equal(prefixChecks.length,5);assert.equal(result.timeline[5].observationHash,caseDefinition.originalObservationHash);
      assert.deepEqual(result.timeline[5].observedEvents,originalResult.timeline[5].observedEvents);}
    result.policy='controlledGuardReplayV13';result.plannerTrace=trace;result.replayPrefixChecks=prefixChecks;result.replayEndpointImportReceipt=importReceipt;result.replayEndpointImportBinding=importBinding;
    result.startupWallMs=startupWallMs;result.algorithmSeed=algorithmSeed;result.timingRepeatIndex=timingRepeatIndex;result.branch=branch;result.executionHistoryUnavailable=false;
    result.replayIdentity={caseId:input.caseId,interventionDay:5,prefixProjectionSha256:caseDefinition.prefixProjectionSha256,
      publicSnapshotSha256:caseDefinition.identity.publicSnapshotSha256,fixedEventsSha256:caseDefinition.identity.fixedEventsSha256,
      forcedEndpointDatesSha256:caseDefinition.endpoints[input.endpointKey].datesSha256};
    result.replayScope='Seen synthetic input. Forced original D0-D4 physical history and archived D5 endpoint, explicitly imported before guarded V13 continuation from D6. No native discovery, natural full-D0 policy, new business sample, held-out validation or universal causal claim.';
    result.plannerStats={nativeDecisionCalls:trace.filter(row=>row.nativePolicyDecision).length,actualNativeRequests:trace.some(row=>row.actualNativeRequests===null)?null:trace.reduce((sum,row)=>sum+row.actualNativeRequests,0),
      archivedReplayCalls:trace.filter(row=>!row.nativePolicyDecision).length,decisionCalls:trace.length,importAccepted:importReceipt?.accepted??false};
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
  try{result=await runReplayGuardBranchV13(input);}
  catch(error){result=unknownEpisodeV12('controlledGuardReplayV13',String(error.stack??error),'replay_error');}
  await new Promise(done=>process.send({type:'final',episodeId:input.episodeId,method:input.method,result},done));process.disconnect();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
