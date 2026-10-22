#!/usr/bin/env node
/** Prespecified old-input single-snapshot diagnostic, never a policy rerun. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fork} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {auditSchedule,rowFor,summarize} from '../src/engine.js';
import {auditFrozenEvents} from '../src/rolling-plan.js';
import {createHiGHSPlanner} from './highs-planner-v8.mjs';
import {createCPSATPlanner} from './cpsat-planner-v12.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const SELF=fileURLToPath(import.meta.url);
const REVIEW='data/commitment-slack-review-v11.json';
const ARCHIVE='data/evidence-v10/v10-frozen-first/first-run';
const INDEX_SHA='33d07f60afb4b4248682badc631512a54070cca22fd106c7dd5062d4669bf9c2';
const REVIEW_SHA='fb37b8ea5c2cf738ad73548a93f1f65cc541bf7c111be59f76bd88fb023ee27b';
const SOURCE_NAMES=['scripts/compare-native-v12.mjs','scripts/cpsat-planner-v12.mjs','scripts/cpsat-service-v12.py',
  'scripts/highs-planner-v8.mjs','scripts/highs-service-v8.py','scripts/certify-v4.py','src/engine.js','src/rolling-plan.js',
  'package.json','package-lock.json','requirements-research-v4.txt','requirements-cpsat-v12.txt','AGENTS.md'];
const COSTS=['storageCost','ddCost','totalCost','sunkCost','incrementalCost','objectiveCost'];
const EVENTS={pickup:'pickupDay',unloadStart:'unloadDay',return:'returnDay'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const stableJSON=value=>Array.isArray(value)?'['+value.map(stableJSON).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>JSON.stringify(key)+':'+stableJSON(value[key])).join(',')+'}':JSON.stringify(value);
const jsonBytes=value=>JSON.stringify(value,null,2)+'\n';
const nullResult=(status,reason)=>({status,reason,rows:[],usage:[],...Object.fromEntries([...COSTS,'lateCount'].map(key=>[key,null]))});

export const NATIVE_DIAGNOSTIC_DECLARATION=Object.freeze({
  schemaVersion:'portplan-native-snapshot-diagnostic-v12',selectionSource:REVIEW,
  selectionRule:'All v10VsV7LossEpisodes with repeatIndex=1, exactly once per case; 5 D0 and 4 later failures expected. No status/cost filtering.',
  methods:['cpsatV12','highsV8'],dailyBudgetsMs:[200,2000],parentColdHardWallMs:5000,
  solverThreads:1,solverSeed:0,repeatIndex:1,newGeneratedOrders:0,newHeldOutScenarios:0,
  ordering:'For snapshot index i: budget order [200,2000] if i even else [2000,200]; within each budget slot j, [CP-SAT,HiGHS] if (i+j) even else reversed. Run serially with a fresh process/service per task.',
  cacheRule:'Fresh factory without imported incumbent; retainCacheFallback=true matches old native configuration but cannot supply a previous snapshot plan.',
  budgetRule:'Cold fork/import, ready, one current-snapshot call, both-language audits, cleanup, terminal IPC and parent audit share five seconds; the 200/2000ms call budget starts at the planner invocation.',
  scope:'Seen-input deterministic single-snapshot comparison with exact archived physical prefix. The 2000ms tier is offline diagnosis, not a real-time leaderboard, full episode outcome, or new formal performance sample.',
  independentPythonReview:'Not yet performed by this runner; native and parent JavaScript audits are internal checks only.'});

function jobsFor(snapshots){
  const jobs=[];
  for(const [i,snapshot]of snapshots.entries())for(const [j,budget]of (i%2?[2000,200]:[200,2000]).entries())for(const method of (i+j)%2?['highsV8','cpsatV12']:['cpsatV12','highsV8'])jobs.push({id:snapshot.id+'--'+method+'--'+budget+'ms',snapshotIndex:i,method,dailyBudgetMs:budget,parentHardWallMs:5000});
  return jobs;
}

function selectedLosses(review){
  assert.equal(review.valid,true);assert.equal(review.inputIndexSha256,INDEX_SHA);
  const selected=review.v10VsV7LossEpisodes.filter(row=>row.repeatIndex===1);
  assert.equal(selected.length,9);assert.equal(new Set(selected.map(row=>row.caseId)).size,9);
  assert.equal(selected.filter(row=>row.failureDay===0).length,5);assert.equal(selected.filter(row=>row.failureDay>0).length,4);
  return selected;
}

/** Use only actual observations and public announcements, never private events. */
export function reconstructNativeDiagnosticSnapshot(nominal,result,day){
  const snapshot=structuredClone(nominal),fixedEvents={},pastPhysicalEvents=[];
  for(const resource of ['truck','warehouse','staging']){const key=resource+'Capacity';snapshot[key]=Array.from({length:snapshot.horizonDays},(_,d)=>Array.isArray(nominal[key])?nominal[key][d]:nominal[key]);}
  const entries=result.timeline.filter(entry=>entry.day<=day);
  const failureEntry=entries.find(entry=>entry.day===day);assert.ok(failureEntry,'Original failed day is missing.');
  // Explicit public durations alone may alter future nominal days.
  for(const entry of entries)for(const observation of entry.observedEvents??[])for(const announcement of observation.announcements??[]){
    if(announcement.announcedDuration===undefined)continue;
    assert.ok(Number.isInteger(announcement.announcedDuration)&&announcement.announcedDuration>0);
    assert.ok(announcement.revealDay<=entry.day&&['truck','warehouse','staging'].includes(announcement.resource));
    for(let d=announcement.revealDay;d<Math.min(snapshot.horizonDays,announcement.revealDay+announcement.announcedDuration);d++)snapshot[announcement.resource+'Capacity'][d]=announcement.capacity;
  }
  for(const entry of entries){
    for(const observation of entry.observedEvents??[]){assert.ok(['truck','warehouse','staging'].includes(observation.resource));snapshot[observation.resource+'Capacity'][entry.day]=observation.capacity;}
    if(entry.day<day)for(const event of entry.executedEvents??[]){
      assert.ok(Object.hasOwn(EVENTS,event.event));assert.equal(event.day,entry.day);
      if(!Object.hasOwn(fixedEvents,event.id))Object.defineProperty(fixedEvents,event.id,{value:{},enumerable:true});
      const field=EVENTS[event.event];assert.ok(!Object.hasOwn(fixedEvents[event.id],field),'Repeated past physical event.');fixedEvents[event.id][field]=event.day;pastPhysicalEvents.push(structuredClone(event));
    }
  }
  const observedEvents=structuredClone(failureEntry.observedEvents);
  const observationHash='sha256:'+sha(stableJSON({scenario:snapshot,observedEvents,fixedEvents,minEventDay:day}));
  assert.equal(observationHash,failureEntry.observationHash,'Reconstructed current observation differs from the actual archived planner input.');
  return {snapshot,fixedEvents,pastPhysicalEvents,observedEvents,observationHash,
    snapshotSha256:sha(stableJSON(snapshot)),fixedEventsSha256:sha(stableJSON(fixedEvents))};
}

function parentAudit(snapshot,options,result){
  const errors=[];
  if(!['optimal','feasible'].includes(result?.status)){
    if(result?.rows?.length)errors.push('Failed result has accepted rows.');
    for(const key of COSTS)if(result?.[key]!==null)errors.push('Failed result amount is not null: '+key);
    return {valid:errors.length===0,errors,completeCandidate:false,scope:'Failure-shape checks only; no independent infeasibility certification.'};
  }
  let canonical;
  try{
    assert.equal(result.rows.length,snapshot.containers.length);
    const byId=new Map(result.rows.map(row=>[row.id,row]));assert.equal(byId.size,snapshot.containers.length);
    const rows=snapshot.containers.map(c=>{const row=byId.get(c.id);assert.ok(row);return rowFor(snapshot,c,row.pickupDay,row.unloadDay,row.returnDay);});
    const schedule=auditSchedule(snapshot,rows),past=auditFrozenEvents(rows,options.fixedEvents,options.minEventDay);
    errors.push(...schedule.errors,...past.errors);canonical=summarize(snapshot,'parent_snapshot_audit',rows,0,'feasible',{objectiveMode:'joint'});
    for(const key of COSTS)if(canonical[key]!==result[key])errors.push('Parent fee mismatch: '+key);
    for(const row of result.rows){const expected=rows.find(value=>value.id===row.id);for(const key of ['sizeFt','unloadEndDay',...COSTS.filter(key=>key!=='objectiveCost')])if(row[key]!==expected[key])errors.push(row.id+': '+key+' differs.');}
  }catch(error){errors.push(String(error.message??error));}
  return {valid:errors.length===0,errors,completeCandidate:errors.length===0,
    costs:canonical?Object.fromEntries(COSTS.map(key=>[key,canonical[key]])):null,
    scope:'Parent JavaScript current-snapshot resource/history/fee check; separate independent Python review is still required.'};
}

export async function declareNativeDiagnostic(output){
  const reviewBytes=await fs.readFile(path.join(ROOT,REVIEW)),review=JSON.parse(reviewBytes),indexPath=ARCHIVE+'/complete.json',indexBytes=await fs.readFile(path.join(ROOT,indexPath)),index=JSON.parse(indexBytes);
  assert.equal(sha(reviewBytes),REVIEW_SHA);assert.equal(sha(indexBytes),INDEX_SHA);
  const selected=selectedLosses(review);
  const sources=await Promise.all(SOURCE_NAMES.map(async name=>({name,bytes:await fs.readFile(path.join(ROOT,name))})));
  const sourceBindings={[REVIEW]:sha(reviewBytes),[indexPath]:sha(indexBytes)},snapshots=[];
  for(const loss of selected){
    const item=index.cases.find(row=>row.id===loss.caseId);assert.ok(item);const repetition=item.repeats.find(row=>row.repeatIndex===1);assert.ok(repetition);
    const inputName=ARCHIVE+'/'+item.inputArtifact.path,episodeArtifact=repetition.policies.stableHiGHSV10.artifact,episodeName=ARCHIVE+'/'+episodeArtifact.path;
    const inputBytes=await fs.readFile(path.join(ROOT,inputName)),episodeBytes=await fs.readFile(path.join(ROOT,episodeName));
    assert.equal(sha(inputBytes),item.inputArtifact.sha256);assert.equal(sha(episodeBytes),episodeArtifact.sha256);assert.equal(sha(episodeBytes),review.sourceBindings[episodeName]);
    const originalInput=JSON.parse(inputBytes),episode=JSON.parse(episodeBytes);assert.equal(episode.repeatIndex,1);assert.equal(episode.caseId,loss.caseId);assert.equal(episode.result.failure.day,loss.failureDay);assert.equal(episode.result.complete,false);assert.equal(repetition.policies.costPolishV7.complete,true);
    const reconstructed=reconstructNativeDiagnosticSnapshot(originalInput.nominalScenario,episode.result,loss.failureDay);
    if(loss.currentObservedScenarioSha256)assert.equal(reconstructed.snapshotSha256,loss.currentObservedScenarioSha256);
    if(loss.currentPhysicalLocksSha256)assert.equal(reconstructed.fixedEventsSha256,loss.currentPhysicalLocksSha256);
    sourceBindings[inputName]=sha(inputBytes);sourceBindings[episodeName]=sha(episodeBytes);
    snapshots.push({id:loss.caseId+'--failure-d'+loss.failureDay,caseId:loss.caseId,panel:loss.panel,repeatIndex:1,day:loss.failureDay,
      ...reconstructed,originalLossRecord:structuredClone(loss),sourceInputArtifact:{path:inputName,sha256:sha(inputBytes)},sourceEpisodeArtifact:{path:episodeName,sha256:sha(episodeBytes)},
      originalInputBytes:inputBytes,originalEpisodeBytes:episodeBytes});
  }
  // No optimizer has been created. Exclusive creation precedes declaration,
  // source snapshot and every possible later cold worker.
  await fs.mkdir(output);
  const implementationHashes=Object.fromEntries(sources.map(({name,bytes})=>[name,sha(bytes)]));
  const declaration={...structuredClone(NATIVE_DIAGNOSTIC_DECLARATION),executionState:'declared',declaredAt:new Date().toISOString(),sourceBindings,implementationHashes,snapshots:[],jobs:[]};
  for(const {name,bytes}of sources){const destination=path.join(output,'source',name);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,bytes,{flag:'wx'});}
  await fs.mkdir(path.join(output,'original'));await fs.mkdir(path.join(output,'snapshots'));await fs.mkdir(path.join(output,'records'));
  await fs.writeFile(path.join(output,'original','commitment-slack-review-v11.json'),reviewBytes,{flag:'wx'});await fs.writeFile(path.join(output,'original','complete-v10.json'),indexBytes,{flag:'wx'});
  for(const [i,full]of snapshots.entries()){
    const {originalInputBytes,originalEpisodeBytes,...snapshot}=full,number=String(i+1).padStart(2,'0'),snapshotPath=`snapshots/${number}.json`,bytes=jsonBytes(snapshot);
    await fs.writeFile(path.join(output,snapshotPath),bytes,{flag:'wx'});
    await fs.writeFile(path.join(output,'original',number+'-input.json'),originalInputBytes,{flag:'wx'});await fs.writeFile(path.join(output,'original',number+'-episode.json'),originalEpisodeBytes,{flag:'wx'});
    declaration.snapshots.push({id:snapshot.id,caseId:snapshot.caseId,day:snapshot.day,repeatIndex:1,artifact:{path:snapshotPath,sha256:sha(bytes)}});
  }
  declaration.jobs=jobsFor(declaration.snapshots);
  assert.equal(declaration.jobs.length,36);
  await fs.writeFile(path.join(output,'declaration.json'),jsonBytes(declaration),{flag:'wx'});
  return declaration;
}

async function coldSnapshot(job,input,workerScript){
  const started=performance.now(),deadline=started+job.parentHardWallMs;
  const receipts=[];let child,terminal=null,parentCheck=null,stderr='',timedOut=false,actualCutoffMs=null,receiptAtMs=null,checkedAtMs=null,exitAtMs=null,cleanup=null;
  return await new Promise(resolve=>{
    let finished=false,finishing=false,timer;const cleanupAttempts=[];
    const killGroup=reason=>{const attempt={reason,atMs:performance.now()-started,attempted:Boolean(child?.pid),signal:'SIGKILL',detachedProcessGroup:true};try{process.kill(-child.pid,'SIGKILL');attempt.sent=true;}catch(error){attempt.sent=false;attempt.error=error.code??String(error);}try{child?.kill('SIGKILL');}catch{}cleanupAttempts.push(attempt);};
    const finish=async(code,signal)=>{
      if(finished||finishing)return;finishing=true;
      if(exitAtMs===null)exitAtMs=performance.now()-started;
      killGroup(timedOut?'hard_deadline_final_cleanup':'normal_terminal_cleanup');
      let groupGone=false,verificationError=null;
      for(let attempt=0;attempt<10;attempt++){
        try{process.kill(-child.pid,0);}catch(error){if(error.code==='ESRCH')groupGone=true;else verificationError=error.code??String(error);break;}
        await new Promise(done=>setTimeout(done,5));
      }
      cleanup={attempted:true,attempts:cleanupAttempts,verifiedProcessGroupGone:groupGone,verificationError,finishedAtMs:performance.now()-started};
      const cleanExit=code===0&&signal===null&&terminal?.cleanupSuccess===true&&terminal?.error===null&&groupGone;
      const hardDeadlineReached=timedOut||cleanup.finishedAtMs>job.parentHardWallMs;
      const endToEndWithinBudget=!hardDeadlineReached&&cleanExit&&terminal!==null&&parentCheck?.valid===true&&checkedAtMs<=job.parentHardWallMs;
      const result=endToEndWithinBudget?terminal.result:nullResult(hardDeadlineReached?'hard_time_limit':'worker_error',hardDeadlineReached?'Cold five-second parent deadline reached.':'No timely valid terminal receipt and clean process exit.');
      finished=true;clearTimeout(timer);
      resolve({result,acceptedPlanWithinBudget:endToEndWithinBudget&&parentCheck.completeCandidate,
        parentTerminalWithinBudget:endToEndWithinBudget,parentAudit:parentCheck,unacceptedTerminal:!endToEndWithinBudget?terminal:null,
        startupReceipts:receipts,rawTerminal:terminal,hardDeadlineReached,deadlineTimerFired:timedOut,actualCutoffMs,
        parentWallMs:performance.now()-started,terminalReceivedAtMs:receiptAtMs,parentAuditFinishedAtMs:checkedAtMs,processExitWallMs:exitAtMs,
        processGroupCleanup:cleanup,exitCode:code,exitSignal:signal,stderr});
    };
    try{child=fork(workerScript,['--worker'],{detached:true,stdio:['ignore','ignore','pipe','ipc'],env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1'}});}
    catch(error){stderr=String(error.stack??error);finish(null,null);return;}
    child.stderr.on('data',chunk=>{stderr=(stderr+chunk.toString()).slice(-16000);});
    child.on('message',message=>{
      if(message.id!==job.id)return;
      const atMs=performance.now()-started;
      if(message.type==='terminal'&&terminal===null){terminal=message;receiptAtMs=atMs;parentCheck=parentAudit(input.snapshot,{minEventDay:input.day,fixedEvents:input.fixedEvents},message.result);checkedAtMs=performance.now()-started;}
      else receipts.push({receivedAtMs:atMs,message});
    });
    child.on('error',error=>{stderr+='\n'+String(error.stack??error);});
    child.once('exit',()=>{exitAtMs=performance.now()-started;});
    child.once('close',finish);
    timer=setTimeout(()=>{timedOut=true;actualCutoffMs=performance.now()-started;killGroup('hard_deadline_signal');setTimeout(()=>finish(child.exitCode,child.signalCode??'SIGKILL'),250).unref();},Math.max(1,deadline-performance.now()));
    child.send({id:job.id,method:job.method,dailyBudgetMs:job.dailyBudgetMs,parentHardWallMs:job.parentHardWallMs,
      snapshot:input.snapshot,fixedEvents:input.fixedEvents,minEventDay:input.day});
  });
}

export async function runNativeDiagnostic(directory,{summaryPath=null}={}){
  const declarationBytes=await fs.readFile(path.join(directory,'declaration.json')),declaration=JSON.parse(declarationBytes);
  assert.equal(declaration.executionState,'declared');
  for(const [key,value]of Object.entries(NATIVE_DIAGNOSTIC_DECLARATION))assert.deepEqual(declaration[key],value,'Fixed diagnostic declaration changed: '+key);
  assert.deepEqual(Object.keys(declaration.implementationHashes).sort(),[...SOURCE_NAMES].sort(),'Declared source inventory changed.');
  assert.equal(sha(await fs.readFile(SELF)),declaration.implementationHashes['scripts/compare-native-v12.mjs'],'Use the exact declared runner.');
  for(const [name,digest]of Object.entries(declaration.implementationHashes))assert.equal(sha(await fs.readFile(path.join(directory,'source',name))),digest,'Frozen source bytes changed.');
  const originalReviewBytes=await fs.readFile(path.join(directory,'original','commitment-slack-review-v11.json')),originalIndexBytes=await fs.readFile(path.join(directory,'original','complete-v10.json'));
  assert.equal(sha(originalReviewBytes),REVIEW_SHA);assert.equal(sha(originalIndexBytes),INDEX_SHA);
  const originalReview=JSON.parse(originalReviewBytes),originalIndex=JSON.parse(originalIndexBytes),selected=selectedLosses(originalReview),snapshots=[],bindings={[REVIEW]:REVIEW_SHA,[ARCHIVE+'/complete.json']:INDEX_SHA};
  assert.equal(declaration.snapshots.length,selected.length);
  for(const [i,loss]of selected.entries()){
    const number=String(i+1).padStart(2,'0'),item=originalIndex.cases.find(row=>row.id===loss.caseId),repeat=item.repeats.find(row=>row.repeatIndex===1),episodeRef=repeat.policies.stableHiGHSV10.artifact;
    const inputBytes=await fs.readFile(path.join(directory,'original',number+'-input.json')),episodeBytes=await fs.readFile(path.join(directory,'original',number+'-episode.json'));
    assert.equal(sha(inputBytes),item.inputArtifact.sha256);assert.equal(sha(episodeBytes),episodeRef.sha256);
    const inputName=ARCHIVE+'/'+item.inputArtifact.path,episodeName=ARCHIVE+'/'+episodeRef.path;
    assert.equal(sha(episodeBytes),originalReview.sourceBindings[episodeName]);bindings[inputName]=sha(inputBytes);bindings[episodeName]=sha(episodeBytes);
    const originalInput=JSON.parse(inputBytes),episode=JSON.parse(episodeBytes);assert.equal(episode.caseId,loss.caseId);assert.equal(episode.repeatIndex,1);assert.equal(episode.result.failure.day,loss.failureDay);assert.equal(episode.result.complete,false);assert.equal(repeat.policies.costPolishV7.complete,true);
    const reconstructed=reconstructNativeDiagnosticSnapshot(originalInput.nominalScenario,episode.result,loss.failureDay);
    if(loss.currentObservedScenarioSha256)assert.equal(reconstructed.snapshotSha256,loss.currentObservedScenarioSha256);
    if(loss.currentPhysicalLocksSha256)assert.equal(reconstructed.fixedEventsSha256,loss.currentPhysicalLocksSha256);
    const expected={id:loss.caseId+'--failure-d'+loss.failureDay,caseId:loss.caseId,panel:loss.panel,repeatIndex:1,day:loss.failureDay,...reconstructed,
      originalLossRecord:structuredClone(loss),sourceInputArtifact:{path:inputName,sha256:sha(inputBytes)},sourceEpisodeArtifact:{path:episodeName,sha256:sha(episodeBytes)}};
    const entry=declaration.snapshots[i];assert.equal(entry.artifact.path,`snapshots/${number}.json`);const bytes=await fs.readFile(path.join(directory,entry.artifact.path));assert.equal(sha(bytes),entry.artifact.sha256);
    const snapshot=JSON.parse(bytes);assert.deepEqual(snapshot,expected,'Retained snapshot differs from original input/episode.');
    assert.deepEqual(entry,{id:expected.id,caseId:expected.caseId,day:expected.day,repeatIndex:1,artifact:{path:`snapshots/${number}.json`,sha256:sha(bytes)}});
    snapshots.push(snapshot);
  }
  assert.deepEqual(declaration.sourceBindings,bindings,'Original artifact bindings changed.');
  assert.deepEqual(declaration.jobs,jobsFor(snapshots),'Fixed 36 task combinations or order changed.');
  await fs.writeFile(path.join(directory,'execution-start.json'),jsonBytes({startedAt:new Date().toISOString(),declarationSha256:sha(declarationBytes),executionState:'running'}),{flag:'wx'});
  const records=[],workerScript=path.join(directory,'source','scripts','compare-native-v12.mjs');
  for(const [i,job]of declaration.jobs.entries()){
    const input=snapshots[job.snapshotIndex],record={...job,caseId:input.caseId,day:input.day,repeatIndex:1,
      inputArtifact:declaration.snapshots[job.snapshotIndex].artifact,...await coldSnapshot(job,input,workerScript)};
    const artifactPath=`records/${String(i+1).padStart(3,'0')}.json`,bytes=jsonBytes(record);await fs.writeFile(path.join(directory,artifactPath),bytes,{flag:'wx'});
    records.push({id:record.id,caseId:record.caseId,day:record.day,method:record.method,dailyBudgetMs:record.dailyBudgetMs,
      artifact:{path:artifactPath,sha256:sha(bytes)},status:record.result.status,acceptedPlanWithinBudget:record.acceptedPlanWithinBudget,
      objectiveCost:record.result.objectiveCost??null,
      lowerBound:record.acceptedPlanWithinBudget?(record.result.plannerMetadata?.nativeCertificate?.lowerBound??null):null,
      nativeRawLowerBound:record.rawTerminal?.result?.plannerMetadata?.nativeCertificate?.lowerBound??null,
      provenOptimal:record.acceptedPlanWithinBudget&&record.result.status==='optimal',parentWallMs:record.parentWallMs,hardDeadlineReached:record.hardDeadlineReached});
    await fs.writeFile(path.join(directory,`checkpoint-${String(i+1).padStart(3,'0')}.json`),jsonBytes({completedTasks:records.length,records}),{flag:'wx'});
    console.log(JSON.stringify(records.at(-1)));
  }
  const summary={schemaVersion:'portplan-native-diagnostic-v12-summary',executionState:'complete',completedAt:new Date().toISOString(),
    dataRole:'seen-v10-failed-snapshot-diagnostic',declarationSha256:sha(declarationBytes),scenarioCount:snapshots.length,snapshotCount:snapshots.length,taskCount:records.length,
    newGeneratedOrders:0,newHeldOutScenarios:0,parentHardWallMs:5000,independentPythonReviewComplete:false,
    byMethodAndBudget:Object.fromEntries([200,2000].flatMap(budget=>['cpsatV12','highsV8'].map(method=>{const rows=records.filter(row=>row.dailyBudgetMs===budget&&row.method===method);return[`${method}-${budget}ms`,{tasks:rows.length,acceptedPlans:rows.filter(row=>row.acceptedPlanWithinBudget).length,
      provenOptimal:rows.filter(row=>row.provenOptimal).length,statusCounts:rows.reduce((counts,row)=>(counts[row.status]=(counts[row.status]??0)+1,counts),{})}];}))),
    records,scope:NATIVE_DIAGNOSTIC_DECLARATION.scope,independentReviewScope:NATIVE_DIAGNOSTIC_DECLARATION.independentPythonReview};
  await fs.writeFile(path.join(directory,'complete.json'),jsonBytes({...summary,declaration}),{flag:'wx'});
  if(summaryPath)await fs.writeFile(summaryPath,jsonBytes({...summary,rawEvidenceDirectory:path.relative(ROOT,directory)}),{flag:'wx'});
  return summary;
}

async function workerMain(){
  const input=await new Promise(resolve=>process.once('message',resolve));let result,ready=null,error=null,cleanupWallMs=null,cleanupSuccess=false,callWallMs=null,planner;
  const started=performance.now();const send=value=>new Promise((resolve,reject)=>process.send({id:input.id,...value},e=>e?reject(e):resolve()));
  try{
    const factory=input.method==='cpsatV12'?createCPSATPlanner:input.method==='highsV8'?createHiGHSPlanner:null;assert.ok(factory);
    planner=factory({timeBudgetMs:input.dailyBudgetMs,auditReserveMs:2,hardOverrunGraceMs:250,retainCacheFallback:true});
    const readyStarted=performance.now();ready=await planner.ready({timeoutMs:input.parentHardWallMs});await send({type:'ready',ready,startupWallMs:performance.now()-readyStarted,workerElapsedMs:performance.now()-started});
    const callStarted=performance.now();result=await planner(input.snapshot,{timeBudgetMs:input.dailyBudgetMs,minEventDay:input.minEventDay,fixedEvents:input.fixedEvents,objectiveMode:'joint'});callWallMs=performance.now()-callStarted;
    await send({type:'planner_result_before_cleanup',result,callWallMs,workerElapsedMs:performance.now()-started});
  }catch(thrown){error=String(thrown.stack??thrown);result=nullResult('worker_error',error);}
  finally{if(planner){const closing=performance.now();try{await planner.close();cleanupSuccess=true;}catch(thrown){error=(error??'')+'\n'+String(thrown.stack??thrown);}cleanupWallMs=performance.now()-closing;}}
  await send({type:'terminal',result,ready,callWallMs,cleanupWallMs,cleanupSuccess,error,workerElapsedMs:performance.now()-started,scope:'Single current-observation planning call only; no physical execution or future policy rollout.'});process.disconnect();
}

async function main(){
  const args=process.argv.slice(2);
  if(args[0]==='--worker'){await workerMain();return;}
  if(args[0]==='--declare'&&args[1]==='--output'&&args.length===3){const declaration=await declareNativeDiagnostic(path.resolve(ROOT,args[2]));console.log(JSON.stringify({executionState:'declared',snapshots:declaration.snapshots.length,tasks:declaration.jobs.length,optimizerCalls:0}));return;}
  if(args[0]==='--run'&&args[1]==='--directory'&&[3,5].includes(args.length)){if(args.length===5)assert.equal(args[3],'--summary');const result=await runNativeDiagnostic(path.resolve(ROOT,args[2]),{summaryPath:args[4]?path.resolve(ROOT,args[4]):null});console.log(JSON.stringify(result.byMethodAndBudget));return;}
  throw new Error('Use --declare --output NEW_DIRECTORY, then --run --directory DIRECTORY [--summary NEW_JSON]. Existing output paths are never overwritten.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===SELF)await main();
