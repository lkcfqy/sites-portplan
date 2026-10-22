import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {auditSchedule,rowFor,summarize} from '../src/engine.js';
import {auditFrozenEvents,realizeCapacityEvents,runRollingScenario} from '../src/rolling-plan.js';
import {independentAuditV2} from './benchmark-v2.mjs';
import {createCommitmentHiGHSPlannerV11} from './replay-commitment-v11.planner.mjs';

const FIELDS=['pickupDay','unloadDay','returnDay'];
const FEES=['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost'];
const EVENT_FIELDS={pickup:'pickupDay',unloadStart:'unloadDay',return:'returnDay'};
export const REPLAY_PREFIX_KEYS=Object.freeze(['day','observedEvents','observationHash','decisions','executedEvents','state','revisions','revisionCount']);
const sha=value=>createHash('sha256').update(value).digest('hex');
const dates=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const fees=result=>Object.fromEntries(FEES.map(key=>[key,result[key]]));
const projection=entry=>Object.fromEntries(REPLAY_PREFIX_KEYS.map(key=>[key,entry[key]]));
export function assertArchivedFees(candidate,expected){
  // The independent Python ledger stores five fee fields; its joint objective
  // is incrementalCost. Original planner receipts additionally store the alias.
  for(const key of FEES)assert.equal(candidate[key],key==='objectiveCost'?(expected.objectiveCost??expected.incrementalCost):expected[key],`Archived endpoint ${key} differs.`);
}
export function originalLocksBeforeDay(original,day){
  const locks=Object.create(null);
  for(const entry of original.timeline.filter(entry=>entry.day<day))for(const event of entry.executedEvents){
    assert.ok(Object.hasOwn(EVENT_FIELDS,event.event));
    if(!Object.hasOwn(locks,event.id))Object.defineProperty(locks,event.id,{value:{},enumerable:true});
    const field=EVENT_FIELDS[event.event];assert.ok(!Object.hasOwn(locks[event.id],field));locks[event.id][field]=event.day;
  }
  return JSON.parse(JSON.stringify(locks));
}
export function reconstructReplayEndpoint(snapshot,endpoint,fixedEvents,day){
  assert.equal(endpoint.length,snapshot.containers.length);
  const byId=new Map(endpoint.map(row=>[row.id,row]));assert.equal(byId.size,endpoint.length);
  const rows=snapshot.containers.map(c=>{const r=byId.get(c.id);assert.ok(r);return rowFor(snapshot,c,r.pickupDay,r.unloadDay,r.returnDay);});
  const scheduleAudit=auditSchedule(snapshot,rows),freezeAudit=auditFrozenEvents(rows,fixedEvents,day);
  assert.equal(scheduleAudit.valid,true,scheduleAudit.errors.join('; '));assert.equal(freezeAudit.valid,true,freezeAudit.errors.join('; '));
  return {...summarize(snapshot,'controlledHistoricalEndpoint',rows,0,'feasible',{objectiveMode:'joint'}),
    endpointAudit:{scheduleAudit,freezeAudit},endpointDates:dates(rows)};
}

/** Fixed archived prefix and explicit D4 intervention, not a natural-policy run. */
export async function runReplayBranch(input){
  const {nominalScenario,events,originalResult,endpointReview,branch,algorithmSeed,repeatIndex,journalPath}=input;
  assert.ok(['retain_cache','lower_m_candidate'].includes(branch));
  assert.equal(nominalScenario.containers.length,24);assert.equal(endpointReview.day,4);
  const budget=input.dailyBudgetMs;assert.equal(budget,200);
  const planner=createCommitmentHiGHSPlannerV11({...input.plannerConfiguration,seed:algorithmSeed,timeBudgetMs:budget});
  const trace=[];let importReceipt=null,startupWallMs=null,result,previousNativeRequests=0;
  const journal=async value=>{if(journalPath)await fs.appendFile(journalPath,JSON.stringify(value)+'\n');};
  try{
    const startup=performance.now();await planner.ready();startupWallMs=performance.now()-startup;
    await journal({type:'ready',startupWallMs,scope:'Included in parent five-second branch clock.'});
    result=await runRollingScenario(nominalScenario,events,{timeLimitSeconds:budget/1000,objectiveMode:'joint',planner:async(snapshot,options)=>{
      const day=options.minEventDay,started=performance.now();let candidate,error;
      const record={day,phase:day<4?'archived_prefix':day===4?'forced_endpoint':'native_v11_continuation',
        publicSnapshot:structuredClone(snapshot),fixedEvents:structuredClone(options.fixedEvents),
        dailyBudgetMs:budget,nativePolicyDecision:day>=5,nativeRequests:0};
      try{
        if(day<=4){
          assert.deepEqual(options.fixedEvents,originalLocksBeforeDay(originalResult,day));
          const endpoint=day<4?originalResult.timeline[day].decisions:endpointReview.scores[branch==='retain_cache'?'cache':'proposal'].endpointDates;
          if(day===4){
            assert.deepEqual(snapshot,endpointReview.publicScenario);
            assert.deepEqual(options.fixedEvents,endpointReview.originalFixedEvents);
          }
          candidate=reconstructReplayEndpoint(snapshot,endpoint,options.fixedEvents,day);
          const expected=day<4?originalResult.plannerTrace[day].stabilitySelection.afterFees:
            endpointReview.scores[branch==='retain_cache'?'cache':'proposal'].independentFees;
          assertArchivedFees(candidate,expected);
          if(day===4){
            importReceipt=planner.importReplayEndpoint(snapshot,candidate.rows,{...options,timeBudgetMs:budget});
            assert.equal(importReceipt.optimizerCalls,0);assert.equal(importReceipt.decisionCalls,0);
            record.offlineImportReceipt=structuredClone(importReceipt);
          }
          candidate.runtimeMs=performance.now()-started;
          candidate.plannerMetadata={method:'explicit_archived_endpoint_replay',optimizerCalls:0,day,
            phase:record.phase,source:'seen_V10_archive',decisionRule:'forced_not_natural_V11_choice'};
          if(candidate.runtimeMs>budget)candidate={status:'time_limit',complete:false,rows:[],reason:'Forced endpoint audit/import exceeded declared daily budget.'};
        }else candidate=await planner(snapshot,{...options,seed:algorithmSeed,timeBudgetMs:budget});
        record.plannerStatus=candidate.status;record.selectedDates=Array.isArray(candidate.rows)?dates(candidate.rows):[];
        record.fees=candidate.rows?.length===snapshot.containers.length?fees(candidate):null;
        record.metadata=structuredClone(candidate.plannerMetadata??{});
        if(day>=5){
          const cumulative=record.metadata.solverCalls??previousNativeRequests;
          record.nativeRequests=cumulative-previousNativeRequests;previousNativeRequests=cumulative;
          assert.ok([0,1].includes(record.nativeRequests),'At most one real native request is allowed per decision.');
        }
        return candidate;
      }catch(thrown){error=String(thrown.stack??thrown);record.error=error;throw thrown;}
      finally{
        record.callWallMs=performance.now()-started;trace.push(record);
        await journal({type:'decision_receipt',...record,
          interpretation:'Candidate/input receipt; physical execution is authoritative only in the accepted final simulator timeline.'});
      }
    }});
    const prefixChecks=[];
    for(let day=0;day<4;day++){
      const expected=JSON.stringify(projection(originalResult.timeline[day])),actual=JSON.stringify(projection(result.timeline[day]));
      assert.equal(actual,expected,`Archived physical prefix changed on D${day}.`);
      prefixChecks.push({day,exactProjectedJsonMatch:true,sha256:sha(actual),keys:[...REPLAY_PREFIX_KEYS]});
    }
    assert.equal(result.timeline[4].observationHash,originalResult.timeline[4].observationHash);
    assert.deepEqual(result.timeline[4].observedEvents,originalResult.timeline[4].observedEvents);
    if(branch==='retain_cache'&&result.timeline[4].status==='executed')assert.equal(JSON.stringify(projection(result.timeline[4])),JSON.stringify(projection(originalResult.timeline[4])));
    result.replayPrefixChecks=prefixChecks;result.d4OriginalObservationHash=originalResult.timeline[4].observationHash;
    result.plannerTrace=trace;result.replayEndpointImportReceipt=importReceipt;result.startupWallMs=startupWallMs;
    result.algorithmSeed=algorithmSeed;result.repeatIndex=repeatIndex;result.executionHistoryUnavailable=false;
    result.replayScope='Fixed original D0-D3 decisions/actions, explicit archived D4 endpoint intervention, then the same seeded-cache V11 policy; not a natural full-D0 policy or a new holdout.';
    result.plannerStats={nativeDecisionCalls:trace.filter(r=>r.nativePolicyDecision).length,
      actualNativeRequests:trace.reduce((sum,r)=>sum+r.nativeRequests,0),
      archivedReplayCalls:trace.filter(r=>!r.nativePolicyDecision).length,
      nativeCallWallMs:trace.filter(r=>r.nativePolicyDecision).map(r=>r.callWallMs)};
    if(result.complete){
      const actual=realizeCapacityEvents(nominalScenario,events),engine=auditSchedule(actual,result.rows),independentErrors=independentAuditV2(actual,result);
      result.terminalAudit={engine,independentErrors};result.auditErrors=[...engine.errors,...independentErrors];result.auditValid=result.auditErrors.length===0;
      if(!result.auditValid){result.complete=false;result.status='audit_failed';result.failure={kind:'terminal_audit_failed',errors:result.auditErrors};}
    }else result.auditValid=false;
    if(!result.complete){result.rows=[];result.usage=[];for(const key of [...FEES,'lateCount'])result[key]=null;}
    return result;
  }finally{await planner.close();}
}

async function main(){
  const input=await new Promise(resolveInput=>process.once('message',resolveInput));let result;
  try{result=await runReplayBranch(input);}
  catch(error){result={status:'replay_error',complete:false,rows:[],timeline:[],executedEvents:[],executionHistoryUnavailable:true,
    failure:{kind:'replay_error',reason:String(error.stack??error)},auditValid:false};}
  await new Promise(resolveSend=>process.send({type:'final',episodeId:input.episodeId,method:input.method,result},resolveSend));process.disconnect();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
