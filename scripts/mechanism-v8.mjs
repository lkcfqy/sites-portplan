import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {cpus,platform,release} from 'node:os';
import {auditSchedule,capacityAt,rowFor,summarize} from '../src/engine.js';
import {auditFrozenEvents} from '../src/rolling-plan.js';
import {independentAuditV2} from './benchmark-v2.mjs';
import {createCostRecoveryPlanner as createFrozenV7,polishCompletePlan as frozenPolish} from '../vendor/experiments/v7-first-run-source/src/cost-recovery-v7.js';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const EVENTS=['pickupDay','unloadDay','returnDay'],FIELDS={pickup:'pickupDay',unloadStart:'unloadDay',return:'returnDay'};
const RESOURCES=['truck','warehouse','staging'],GOOD=new Set(['optimal','feasible']);
export const METHODS=Object.freeze(['retainOrRecoverV7','alwaysPolishOrRecoverV7','alwaysRebuildV7','adaptiveV8']);
export const ALGORITHM_SEEDS=Object.freeze([1103,2207,3301]);
export const INPUT_HASHES=Object.freeze({
  'data/rolling-v7.json':'a8b0d67f7ff5fbf3b27fe260ab8d9d17be331a9942df37704d8d8365546000c6',
  'data/protocol-v7.json':'bb70fa6938ffbb162347142cbb2788f9ece00ac695a8b8ed5a647cd08aedb96f',
});
export const MISS_IDS=Object.freeze(['v7-aged-backlog-tight-n50-r1','v7-aged-backlog-tight-n100-r1',
  'v7-new-arrivals-tight-n50-r2','v7-new-arrivals-tight-n100-r2']);
const require=(condition,message)=>{if(!condition)throw new Error(message);};
export const stable=value=>Array.isArray(value)?`[${value.map(stable).join(',')}]`:value&&typeof value==='object'
  ?`{${Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`:JSON.stringify(value);
const bytesHash=value=>createHash('sha256').update(value).digest('hex');
export const hash=value=>'sha256:'+bytesHash(stable(value));
const dates=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const clone=value=>structuredClone(value);
const noPlan=reason=>({status:'no_feasible_schedule_found',rows:[],totalCost:null,incrementalCost:null,storageCost:null,
  ddCost:null,sunkCost:null,objectiveCost:null,lateCount:null,reason});

export function canonicalSeed(scenario,previousDates,fixedEvents={},minEventDay=0){
  const errors=[],containers=new Map(scenario.containers.map(c=>[c.id,c])),seen=new Set();
  if(!Array.isArray(previousDates)||previousDates.length!==containers.size)return {valid:false,errors:['Missing complete date reference.'],candidate:null};
  for(const row of previousDates){
    if(!row||!containers.has(row.id)||seen.has(row.id)){errors.push('Unknown, duplicate or malformed reference row.');continue;}
    seen.add(row.id);
    if(!EVENTS.every(key=>Number.isInteger(row[key])&&row[key]>=0&&row[key]<scenario.horizonDays)
      ||!Number.isInteger(row.unloadDay)||row.unloadDay+containers.get(row.id).unloadDays>scenario.horizonDays)errors.push(`${row.id}: out-of-horizon event.`);
  }
  if(errors.length)return {valid:false,errors,candidate:null};
  const byId=new Map(previousDates.map(row=>[row.id,row]));
  const rows=scenario.containers.map(c=>{const d=byId.get(c.id);return rowFor(scenario,c,d.pickupDay,d.unloadDay,d.returnDay);});
  const candidate=summarize(scenario,'common_snapshot_seed',rows,0,'feasible',{objectiveMode:'joint'});
  const audit=auditCandidate(scenario,candidate,fixedEvents,minEventDay);
  return {...audit,candidate:audit.valid?candidate:null};
}

export function auditCandidate(scenario,candidate,fixedEvents={},minEventDay=0){
  if(!GOOD.has(candidate?.status)||!Array.isArray(candidate.rows)||candidate.rows.length!==scenario.containers.length)
    return {valid:false,errors:['No complete feasible candidate.']};
  const shape=canonicalShape(scenario,candidate.rows);
  if(shape.length)return {valid:false,errors:shape};
  const schedule=auditSchedule(scenario,candidate.rows),freeze=auditFrozenEvents(candidate.rows,fixedEvents,minEventDay),independent=independentAuditV2(scenario,candidate);
  const errors=[...schedule.errors,...freeze.errors,...independent];
  return {valid:errors.length===0,errors,scheduleAudit:schedule,freezeAudit:freeze,independentErrors:independent};
}
function canonicalShape(scenario,rows){
  const ids=new Map(scenario.containers.map(c=>[c.id,c])),seen=new Set(),errors=[];
  for(const row of rows){
    if(!row||!ids.has(row.id)||seen.has(row.id)){errors.push('Unknown/duplicate candidate row.');continue;}
    seen.add(row.id);
    if(!EVENTS.every(key=>Number.isInteger(row[key])&&row[key]>=0&&row[key]<scenario.horizonDays)
      ||row.unloadDay+ids.get(row.id).unloadDays>scenario.horizonDays)errors.push(`${row.id}: invalid candidate event day.`);
  }
  return errors;
}

/** Reconstruct only information actually recorded through this decision day.
 * Private future capacities/events are neither copied nor passed to policies. */
export function reconstructSnapshot(caseRecord,day,sourceMethod='costPolishV7'){
  const timeline=caseRecord.policies[sourceMethod].timeline,nominal=caseRecord.nominalScenario;
  require(Number.isInteger(day)&&day>=0&&day<timeline.length,'Requested decision day is absent from original path.');
  const scenario=clone(nominal),fixedEvents={};
  for(const resource of RESOURCES)scenario[resource+'Capacity']=Array.from({length:nominal.horizonDays},(_,d)=>capacityAt(nominal[resource+'Capacity'],d));
  let previousDates=null,observedEvents=null,originalObservationHash=null;
  for(let d=0;d<=day;d++){
    const entry=timeline[d];
    require(entry.day===d&&Array.isArray(entry.observedEvents)&&entry.observedEvents.length===3,'Nonconsecutive or missing original observations.');
    const observedResources=new Set();
    for(const observation of entry.observedEvents){
      require(observation.day===d&&RESOURCES.includes(observation.resource)&&!observedResources.has(observation.resource)
        &&Number.isInteger(observation.capacity)&&observation.capacity>=0,'Malformed daily capacity observation.');
      require(!(observation.announcements??[]).some(event=>event.announcedDuration!==undefined),'V7 mechanism protocol expects private, unannounced duration.');
      observedResources.add(observation.resource);scenario[observation.resource+'Capacity'][d]=observation.capacity;
    }
    const payload={scenario,observedEvents:entry.observedEvents,fixedEvents,minEventDay:d};
    require(hash(payload)===entry.observationHash,'Original snapshot observation/execution-prefix SHA-256 mismatch.');
    if(d===day){observedEvents=clone(entry.observedEvents);originalObservationHash=entry.observationHash;break;}
    require(entry.status==='executed','A failed original day cannot precede another snapshot.');
    const prior=canonicalSeed(scenario,entry.decisions,fixedEvents,d);
    require(prior.valid,'Previous complete plan failed original-day independent audit: '+prior.errors.join('; '));
    previousDates=dates(entry.decisions);
    const byId=new Map(previousDates.map(row=>[row.id,row]));
    for(const event of entry.executedEvents){
      const key=FIELDS[event.event];
      require(key&&byId.has(event.id)&&event.day===d&&byId.get(event.id)[key]===d,'Original executed event does not match accepted dates.');
      require(!Object.hasOwn(fixedEvents[event.id]??{},key),'Repeated original physical event.');
      (fixedEvents[event.id]??={})[key]=d;
    }
  }
  const body={scenario,observedEvents,fixedEvents,minEventDay:day,previousDates};
  const previousAudit=canonicalSeed(scenario,previousDates,fixedEvents,day);
  return {...body,originalObservationHash,originalObservationHashVerified:true,snapshotHash:hash(body),
    executedEventCount:Object.values(fixedEvents).reduce((n,locks)=>n+Object.keys(locks).length,0),
    previousReferenceAvailable:previousDates!==null,previousValidNow:previousAudit.valid,
    previousCurrentErrors:previousAudit.errors,previousCurrentTotalCost:previousAudit.valid?previousAudit.candidate.totalCost:null,
    previousCurrentIncrementalCost:previousAudit.valid?previousAudit.candidate.incrementalCost:null};
}

/** Six strata, two ordinary and two announced-capacity snapshots each. Source
 * policy fallback supplies a distinct prefix when only one V7 path survives. */
export function selectTasks(archive,diagnosis){
  const tasks=[];
  for(const mechanism of ['aged-backlog','new-arrivals','batch-release'])for(const capacityProfile of ['balanced','tight']){
    const cases=archive.cases.filter(c=>c.mechanism===mechanism&&c.capacityProfile===capacityProfile)
      .sort((a,b)=>a.repeat-b.repeat||a.count-b.count||a.id.localeCompare(b.id));
    const chosen=new Set();let stratumRank=0;
    const append=(source,sourceMethod,day,snapshotKind,selectionRound)=>{
      const snapshot=reconstructSnapshot(source,day,sourceMethod);
      require(snapshot.previousReferenceAvailable,'Mechanism selection requires a previous full date reference.');
      if(chosen.has(snapshot.snapshotHash))return false;
      chosen.add(snapshot.snapshotHash);stratumRank++;
      tasks.push({taskId:`mechanism-${mechanism}-${capacityProfile}-${stratumRank}`,panel:'stratified-mechanism',snapshotKind,
        sourceCaseId:source.id,sourceMethod,sourceDay:day,mechanism,capacityProfile,count:source.count,sourceSeed:source.seed,
        stratumRank,selectionRound,budgetsMs:[200],...snapshot});return true;
    };
    const ordinary=cases.map(c=>({source:c,days:c.policies.costPolishV7.timeline.filter(entry=>entry.day>=1
      &&!entry.observedEvents.some(o=>(o.announcements??[]).length)).map(entry=>entry.day)})).filter(c=>c.days.length);
    let selected=0;
    for(let round=0;selected<2;round++){
      let advanced=false;
      for(const item of ordinary){
        if(item.days.length<=round)continue;
        advanced=true;
        if(append(item.source,'costPolishV7',item.days[round],'ordinary',round+1))selected++;
        if(selected===2)break;
      }
      require(advanced,'Fewer than two ordinary snapshots in stratum '+mechanism+'/'+capacityProfile);
    }
    // Continue the scale rotation from the third source case for shock tasks.
    const rotated=[...cases.slice(2),...cases.slice(0,2)];selected=0;
    for(const sourceMethod of ['costPolishV7','lockedRecoveryV6','stableRetainV5','dailyReoptV4']){
      for(const source of rotated){
        const entry=source.policies[sourceMethod].timeline.find(e=>e.day>=1&&e.observedEvents.some(o=>(o.announcements??[]).length));
        if(entry&&append(source,sourceMethod,entry.day,'capacity-announcement',1))selected++;
        if(selected===2)break;
      }
      if(selected===2)break;
    }
    require(selected===2,'Fewer than two distinct announced-capacity snapshots in stratum '+mechanism+'/'+capacityProfile);
  }
  const observedFeasible=diagnosis.cases.filter(c=>diagnosis.models[c.layers.observedExecutedPrefix].feasibility==='feasible');
  require(JSON.stringify(observedFeasible.map(c=>c.id))===JSON.stringify(MISS_IDS),'G0 four observed-prefix misses changed.');
  for(const record of observedFeasible){
    const source=archive.cases.find(c=>c.id===record.id),day=record.failureSnapshot.minEventDay,snapshot=reconstructSnapshot(source,day);
    require(snapshot.originalObservationHash===record.failureSnapshot.originalObservationHash,'G0 miss prefix binding differs.');
    require(snapshot.executedEventCount===record.failureSnapshot.executedEventCount,'G0 miss execution count differs.');
    tasks.push({taskId:'miss-'+source.id,panel:'observed-feasible-misses',sourceCaseId:source.id,sourceMethod:'costPolishV7',sourceDay:day,
      mechanism:source.mechanism,capacityProfile:source.capacityProfile,count:source.count,sourceSeed:source.seed,
      budgetsMs:[200,1000],initializationProbe:day===0,diagnosisLayerHash:record.layers.observedExecutedPrefix,...snapshot});
  }
  require(tasks.length===28&&new Set(tasks.map(t=>t.taskId)).size===28,'Mechanism protocol requires 24 plus four tasks.');
  return tasks;
}

async function readSources(root=ROOT){
  const names=[...Object.keys(INPUT_HASHES),'data/failure-diagnosis-v8.json'],sources={},inputHashes={};
  for(const name of names){const raw=await readFile(resolve(root,name));inputHashes[name]=bytesHash(raw);sources[name]=JSON.parse(raw);}
  for(const [name,expected]of Object.entries(INPUT_HASHES))require(inputHashes[name]===expected,'Immutable source SHA-256 mismatch: '+name);
  require(sources['data/failure-diagnosis-v8.json'].valid&&sources['data/failure-diagnosis-v8.json'].onlinePolicyReruns===0,'Invalid G0 diagnosis.');
  return {archive:sources['data/rolling-v7.json'],diagnosis:sources['data/failure-diagnosis-v8.json'],inputHashes};
}

export function makeProtocol(sources){
  const tasks=selectTasks(sources.archive,sources.diagnosis);
  return {schemaVersion:'portplan-v8-development-mechanism-protocol',protocolVersion:'v8-dev-same-prefix-warm-01',
    createdAt:new Date().toISOString(),stateAtSelectionFreeze:'Snapshots selected before executing any V8 mechanism outcomes; adaptive runtime may still be under development.',
    inputHashes:sources.inputHashes,dataRole:'Previously inspected V7 development data; not new holdout or business observations.',
    selectionRule:'Six mechanism x capacity strata, two ordinary and two capacity-announcement snapshots each. Sort cases by repeat, size, ID. Ordinary: V7 earliest day>=1 with prior complete accepted dates and no new announcement; round-robin subsequent ordinary days if fewer cases. Announcement: rotate sorted cases from index two, use each V7 path first observed announcement day. If fewer than two distinct snapshots, try V6, stable-retain, daily-reopt source paths in that order and discard exact snapshotHash duplicates. Add all four G0 observed-prefix-feasible misses, including D3 original 17 locks. No V8 outcome participates.',
    methods:[...METHODS],algorithmSeeds:[...ALGORITHM_SEEDS],
    budget:{kind:'warm-snapshot-cooperative-whole-call',stratifiedMs:[200],missesMs:[200,1000],receiptAuditReserveMs:5,
      importsAndModuleWarmupTimed:false,factoryCreationTimed:false,inputCloneAndMethodAuditsTimed:true,finalReceiptAuditTimed:true,
      interpretation:'Imported modules and one separate hand-built GLPK warmup are outside timing. Each isolated task uses a fresh factory; clone, current-snapshot audit, method work and final receipt audit share the advertised call deadline. Overruns are recorded and late complete receipts are not counted as timely success. No hard interruption is claimed.'},
    baselineDefinitions:{retainOrRecoverV7:'Reprice and audit the supplied previous full dates; keep if currently valid, otherwise call a fresh frozen V7 factory with remaining budget.',
      alwaysPolishOrRecoverV7:'Reprice and audit supplied previous dates; if valid, always invoke frozen V7 polishing within the remaining call budget; otherwise fresh frozen V7 recovery.',
      alwaysRebuildV7:'Ignore the previous date seed and invoke a fresh frozen V7 factory. No private V7 cache injection.',
      adaptiveV8:'New adaptive factory with configuration.initialDates equal to the same previous dates, or absent at D0.'},
    originalSeedBudgetProbe:{enabled:true,taskPanel:'observed-feasible-misses',method:'alwaysRebuildV7',seed:'original nominalScenario.seed per task',budgetsMs:[200,1000],
      source:'vendor/experiments/v7-first-run-source/src/cost-recovery-v7.js',
      scope:'Actual same-frozen-code, original-seed fresh-factory budget calls. At D0 this is original initialization; at D3 private historical V7 cache is unavailable, so this is not an exact replay of archived internal cache state.'},
    methodOrder:'Within each task, budget and seed, rotate four methods by (taskIndex+budgetIndex+seedIndex) modulo four. All runs sequential.',
    acceptance:'Complete candidate independently repriced and resource/lock audited; accepted only if final receipt audit finishes within advertised budget. Failure/late fees stay null in accepted metrics; complete returned raw dates and diagnostics remain archived.',
    metrics:['timely complete snapshot results','all failures/late returns/audit rejection','same-snapshot total and incremental fee on paired timely successes',
      'pending event date changes versus common previous dates','today/tomorrow changes','total absolute date displacement','whole-call wall time and overrun','method action/reason'],
    statisticalUnit:'Development snapshot, clustered within source case. Three algorithm seeds and repeated days are not independent logistics cases. No significance or out-of-sample superiority claim.',
    scope:'Snapshot forecast/model fees are neither terminal episode fees nor realized savings. D0 probes have no previous plan and do not measure stability decisions. Actual future capacities and G0 hindsight witnesses never enter method inputs.',
    taskCount:tasks.length,distinctSourceCaseCount:new Set(tasks.map(t=>t.sourceCaseId)).size,
    selectedTaskCounts:{ordinary:tasks.filter(t=>t.snapshotKind==='ordinary').length,
      capacityAnnouncement:tasks.filter(t=>t.snapshotKind==='capacity-announcement').length,
      previousValid:tasks.filter(t=>t.previousValidNow).length,
      previousInvalid:tasks.filter(t=>t.previousReferenceAvailable&&!t.previousValidNow).length,
      noPreviousInitialization:tasks.filter(t=>!t.previousReferenceAvailable).length},
    selections:tasks.map(({scenario,observedEvents,fixedEvents,previousDates,...record})=>({...record,previousDateHash:previousDates===null?null:hash(previousDates)}))};
}

export async function loadFrozenProtocol(path,root=ROOT){
  const raw=await readFile(path),protocol=JSON.parse(raw),sources=await readSources(root),rebuilt=makeProtocol(sources);
  require(protocol.schemaVersion===rebuilt.schemaVersion,'Wrong mechanism protocol schema.');
  require(stable({...protocol,createdAt:null})===stable({...rebuilt,createdAt:null}),'Frozen mechanism selection or settings differ from reconstruction.');
  return {protocol,protocolHash:bytesHash(raw),sources,tasks:selectTasks(sources.archive,sources.diagnosis)};
}

export function buildJobs(protocol,tasks){
  const jobs=[];
  tasks.forEach((task,taskIndex)=>task.budgetsMs.forEach((budgetMs,budgetIndex)=>protocol.algorithmSeeds.forEach((seed,seedIndex)=>{
    const rotation=(taskIndex+budgetIndex+seedIndex)%METHODS.length;
    for(let offset=0;offset<METHODS.length;offset++)jobs.push({taskId:task.taskId,method:METHODS[(rotation+offset)%METHODS.length],budgetMs,seed,panel:task.panel,probe:false});
  })));
  if(protocol.originalSeedBudgetProbe.enabled)for(const task of tasks.filter(t=>t.panel===protocol.originalSeedBudgetProbe.taskPanel))
    for(const budgetMs of protocol.originalSeedBudgetProbe.budgetsMs)jobs.push({taskId:task.taskId,method:'alwaysRebuildV7',budgetMs,seed:task.sourceSeed,panel:'original-seed-budget-probe',probe:true});
  return jobs;
}

export function changeMetrics(previousDates,rows,fixedEvents,minEventDay){
  if(previousDates===null)return {referenceAvailable:false,changedEventCount:null,nearTermChangedEventCount:null,totalShiftDays:null};
  const before=new Map(previousDates.map(row=>[row.id,row]));
  let changedEventCount=0,nearTermChangedEventCount=0,totalShiftDays=0,pendingEventCount=0;
  for(const row of rows)for(const key of EVENTS)if(!Object.hasOwn(fixedEvents[row.id]??{},key)){
    pendingEventCount++;const old=before.get(row.id)[key];
    if(old!==row[key]){changedEventCount++;totalShiftDays+=Math.abs(old-row[key]);if(old<=minEventDay+1)nearTermChangedEventCount++;}
  }
  return {referenceAvailable:true,pendingEventCount,changedEventCount,nearTermChangedEventCount,totalShiftDays};
}

export function createMethod(method,task,seed,{createV7=createFrozenV7,polish=frozenPolish,createAdaptive,now=()=>performance.now()}={}){
  require(METHODS.includes(method),'Unknown mechanism method.');
  const config={seed,timeBudgetMs:200,objectiveMode:'joint'};
  if(method==='adaptiveV8'){
    require(typeof createAdaptive==='function','Adaptive factory is required.');
    const planner=createAdaptive({...config,...(task.previousDates===null?{}:{initialDates:clone(task.previousDates)})});
    return async(scenario,options)=>planner(scenario,options);
  }
  const recover=createV7(config);
  return async(scenario,options)=>{
    const started=now(),deadline=started+options.timeBudgetMs,reserve=5;
    const seedAudit=method==='alwaysRebuildV7'?null:canonicalSeed(scenario,task.previousDates,options.fixedEvents,options.minEventDay);
    if(seedAudit?.valid){
      if(method==='retainOrRecoverV7')return {...seedAudit.candidate,mechanismAction:'retain',mechanismReason:'common previous plan currently valid'};
      const remaining=deadline-now()-reserve;
      if(remaining<=0)return {...seedAudit.candidate,mechanismAction:'retain',mechanismReason:'valid incumbent; no optional polish budget'};
      const result=await polish(scenario,seedAudit.candidate,{...options,now,timeBudgetMs:remaining,deadlineMs:deadline-reserve});
      return {...result,mechanismAction:'polish',mechanismReason:'fixed polishing policy; no adaptive trigger'};
    }
    const remaining=deadline-now()-reserve;
    if(remaining<=0)return {...noPlan('Common seed audit consumed the recovery budget.'),mechanismAction:'failed'};
    const result=await recover(scenario,{...options,timeBudgetMs:remaining,seed});
    return {...result,mechanismAction:task.previousDates===null?'initialize':'rebuild',mechanismReason:'fresh frozen V7; no injected private cache'};
  };
}

export async function executeJob(task,job,dependencies={}){
  const now=dependencies.now??(()=>performance.now()),method=createMethod(job.method,task,job.seed,dependencies),started=now();
  const scenario=clone(task.scenario),options={fixedEvents:clone(task.fixedEvents),minEventDay:task.minEventDay,
    objectiveMode:'joint',seed:job.seed,timeBudgetMs:Math.max(0.000001,job.budgetMs-(now()-started)-5)};
  const inputHash=hash({scenario,fixedEvents:options.fixedEvents,minEventDay:options.minEventDay,previousDates:task.previousDates});
  let returned,exception=null;
  try{returned=await method(scenario,options);}catch(error){exception=String(error.stack??error);returned=noPlan(exception);}
  const methodReturnedMs=now()-started,audit=GOOD.has(returned?.status)?auditCandidate(task.scenario,returned,task.fixedEvents,task.minEventDay):{valid:false,errors:['Method returned no complete feasible candidate.']};
  const ended=now(),wallTimeMs=ended-started,acceptedWithinBudget=audit.valid&&wallTimeMs<=job.budgetMs;
  const outcome={...job,inputHash,snapshotHash:task.snapshotHash,sourceCaseId:task.sourceCaseId,minEventDay:task.minEventDay,
    sourceExecutedEventCount:task.executedEventCount,previousReferenceAvailable:task.previousDates!==null,
    previousValidNow:task.previousValidNow,returnedStatus:returned?.status??'missing_result',
    status:acceptedWithinBudget?'timely_complete_snapshot':audit.valid?'late_complete_snapshot':GOOD.has(returned?.status)?'candidate_audit_rejected':'no_complete_snapshot',
    completeSnapshot:acceptedWithinBudget,acceptedWithinBudget,returnedCompleteAudited:audit.valid,
    totalCost:acceptedWithinBudget?returned.totalCost:null,incrementalCost:acceptedWithinBudget?returned.incrementalCost:null,
    rows:acceptedWithinBudget?dates(returned.rows):[],changes:acceptedWithinBudget?changeMetrics(task.previousDates,returned.rows,task.fixedEvents,task.minEventDay):null,
    methodReturnedMs,wallTimeMs,deadlineOverrunMs:Math.max(0,wallTimeMs-job.budgetMs),exception,audit,
    action:returned?.plannerMetadata?.action??returned?.mechanismAction??null,
    reason:returned?.plannerMetadata?.decisionReason??returned?.mechanismReason??returned?.reason??null,
    rawReturnedResult:returned};
  require(inputHash===hash({scenario:task.scenario,fixedEvents:task.fixedEvents,minEventDay:task.minEventDay,previousDates:task.previousDates}),
    'Method input differs from the common frozen snapshot.');
  return outcome;
}

export function summarizeResults(results){
  const normal=results.filter(r=>!r.probe),panels={};
  for(const panel of ['stratified-mechanism','observed-feasible-misses'])for(const budgetMs of [200,1000]){
    const group=normal.filter(r=>r.panel===panel&&r.budgetMs===budgetMs);if(!group.length)continue;
    const methods=Object.fromEntries(METHODS.map(method=>{
      const rows=group.filter(r=>r.method===method),success=rows.filter(r=>r.completeSnapshot);
      return [method,{taskSeedRunCount:rows.length,uniqueSnapshotCount:new Set(rows.map(r=>r.taskId)).size,
        timelyCompleteCount:success.length,failedOrLateCount:rows.length-success.length,
        lateCompleteCount:rows.filter(r=>r.status==='late_complete_snapshot').length,auditRejectedCount:rows.filter(r=>r.status==='candidate_audit_rejected').length,
        statuses:countBy(rows,'status'),actions:countBy(rows,'action'),changedEventCountOnTimelyResults:success.reduce((n,r)=>n+(r.changes?.changedEventCount??0),0),
        referenceAvailableCount:success.filter(r=>r.changes?.referenceAvailable).length,wallTimeMs:numericSummary(rows.map(r=>r.wallTimeMs))}];
    }));
    const pairs={};
    for(const baseline of METHODS.filter(m=>m!=='adaptiveV8')){
      const left=new Map(group.filter(r=>r.method===baseline).map(r=>[r.taskId+'|'+r.seed,r])),right=group.filter(r=>r.method==='adaptiveV8'),joint=[];
      let gained=0,lost=0;
      for(const candidate of right){const old=left.get(candidate.taskId+'|'+candidate.seed);require(old,'Missing paired baseline result.');
        if(candidate.completeSnapshot&&!old.completeSnapshot)gained++;
        if(!candidate.completeSnapshot&&old.completeSnapshot)lost++;
        if(candidate.completeSnapshot&&old.completeSnapshot)joint.push({old,candidate});}
      pairs[baseline]={allPairedRuns:right.length,jointTimelyRunCount:joint.length,gainedTimely:gained,lostTimely:lost,
        lowerFeeCount:joint.filter(p=>p.candidate.totalCost<p.old.totalCost).length,equalFeeCount:joint.filter(p=>p.candidate.totalCost===p.old.totalCost).length,
        higherFeeCount:joint.filter(p=>p.candidate.totalCost>p.old.totalCost).length,
        snapshotTotalFeeDifferenceKRW:joint.reduce((n,p)=>n+p.candidate.totalCost-p.old.totalCost,0),
        snapshotIncrementalFeeDifferenceKRW:joint.reduce((n,p)=>n+p.candidate.incrementalCost-p.old.incrementalCost,0),
        baselineChangedEvents:joint.reduce((n,p)=>n+(p.old.changes?.changedEventCount??0),0),
        adaptiveChangedEvents:joint.reduce((n,p)=>n+(p.candidate.changes?.changedEventCount??0),0),
        negativeCaseIds:joint.filter(p=>p.candidate.totalCost>p.old.totalCost).map(p=>({taskId:p.candidate.taskId,seed:p.candidate.seed,
          extraSnapshotFeeKRW:p.candidate.totalCost-p.old.totalCost})),
        scope:'Repeated same-snapshot model amounts, not additive realized business savings or terminal episode fees.'};
    }
    panels[panel+'-'+budgetMs+'ms']={methods,adaptiveVs:pairs};
  }
  const probes=results.filter(r=>r.probe),originalSeedBudgetPairs=[];
  for(const taskId of new Set(probes.map(r=>r.taskId))){
    const a=probes.find(r=>r.taskId===taskId&&r.budgetMs===200),b=probes.find(r=>r.taskId===taskId&&r.budgetMs===1000);
    originalSeedBudgetPairs.push({taskId,seed:a.seed,day:a.minEventDay,originalExecutedEventCount:a.sourceExecutedEventCount,
      at200ms:a.status,at1000ms:b.status,foundOnlyWith1000ms:!a.completeSnapshot&&b.completeSnapshot,
      totalFeeAt200ms:a.totalCost,totalFeeAt1000ms:b.totalCost,scope:'Frozen V7 same-snapshot fresh factories, private old cache not restored.'});
  }
  return {resultCount:results.length,panelSummaries:panels,originalSeedBudgetPairs,
    independentUnitWarning:'Snapshots share source cases; three algorithm seeds are repeated runs, not independent logistics cases.'};
}
const countBy=(rows,key)=>rows.reduce((out,row)=>{const k=String(row[key]);out[k]=(out[k]??0)+1;return out;},{});
function numericSummary(values){const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;return {count:n,
  median:n?(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2):null,p95:n?sorted[Math.ceil(.95*n)-1]:null,max:n?sorted[n-1]:null};}

async function runtimeHashes(root=ROOT){
  const names=['scripts/mechanism-v8.mjs','src/adaptive-planner-v8.js','src/cost-recovery-v7.js','src/recovery-planner-v6.js',
    'src/engine.js','src/rolling-plan.js','src/solver-glpk.js','src/execution-constraints.js','src/solver-presolver.js','scripts/benchmark-v2.mjs','package-lock.json'];
  const manifest=JSON.parse(await readFile(resolve(root,'vendor/experiments/v7-first-run-source/manifest.json'),'utf8'));
  for(const [name,expected]of Object.entries(manifest.implementationHashes??{}))if(name.startsWith('src/')){
    const path='vendor/experiments/v7-first-run-source/'+name;
    require(bytesHash(await readFile(resolve(root,path)))===expected,'Frozen V7 source changed: '+name);names.push(path);
  }
  return Object.fromEntries(await Promise.all([...new Set(names)].map(async name=>[name,bytesHash(await readFile(resolve(root,name)))])));
}

async function warmModules(createAdaptive){
  const {createCostRecoveryPlanner:createCurrentV7}=await import('../src/cost-recovery-v7.js');
  const fixture={id:'mechanism-module-warmup-only',horizonStart:'2026-10-12',horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,
    containers:[{id:'W',sizeFt:20,dischargeDateTime:'2026-10-12T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:2}]};
  const started=performance.now();
  for(const make of [createFrozenV7,createCurrentV7]){
    const result=await make({constructorShare:0,timeBudgetMs:200})(clone(fixture),{timeBudgetMs:200});
    require(auditCandidate(fixture,result).valid,'Hand-built module warmup did not produce an audited result.');
  }
  require(typeof createAdaptive==='function','Missing adaptive factory.');
  return {outsideTiming:true,handBuiltFixture:fixture,wallTimeMs:performance.now()-started,
    scope:'Separate factories initialize each recovery module GLPK promise. Warmup does not initialize any measured task cache.'};
}

async function run(protocolPath,outputDirectory){
  const loaded=await loadFrozenProtocol(protocolPath),codeBefore=await runtimeHashes();
  require(resolve(outputDirectory).startsWith(resolve(ROOT,'artifacts')+'/'),'Mechanism results must use a new artifacts/ directory.');
  await mkdir(resolve(ROOT,'artifacts'),{recursive:true});
  await mkdir(outputDirectory,{recursive:false});
  const {createAdaptivePlanner}=await import('../src/adaptive-planner-v8.js');
  const warmup=await warmModules(createAdaptivePlanner),jobs=buildJobs(loaded.protocol,loaded.tasks),byId=new Map(loaded.tasks.map(t=>[t.taskId,t]));
  const report={schemaVersion:'portplan-v8-development-mechanism-results',executionState:'running',dataRole:'development_only',
    startedAt:new Date().toISOString(),protocolPath:resolve(protocolPath),protocolHash:loaded.protocolHash,inputHashes:loaded.protocol.inputHashes,
    implementationHashes:codeBefore,environment:{node:process.version,platform:platform(),release:release(),cpu:cpus()[0]?.model,logicalCpuCount:cpus().length,sequential:true},
    warmup,taskCount:loaded.tasks.length,taskInputs:loaded.tasks,plannedJobCount:jobs.length,results:[],summary:null};
  const path=resolve(outputDirectory,'results.json');
  await writeFile(resolve(outputDirectory,'protocol.json'),await readFile(protocolPath),{flag:'wx'});
  await writeFile(path,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  for(const [index,job]of jobs.entries()){
    report.results.push(await executeJob(byId.get(job.taskId),job,{createAdaptive:createAdaptivePlanner}));
    if((index+1)%12===0||index===jobs.length-1)process.stderr.write(JSON.stringify({completed:index+1,total:jobs.length,task:job.taskId})+'\n');
  }
  require(stable(await runtimeHashes())===stable(codeBefore),'Runtime changed during the mechanism experiment; keep unfinished artifact and rerun in a new directory.');
  const after=await readSources();require(stable(after.inputHashes)===stable(loaded.protocol.inputHashes),'Frozen source archive changed during execution.');
  report.executionState='complete';report.finishedAt=new Date().toISOString();report.summary=summarizeResults(report.results);
  await writeFile(path,JSON.stringify(report,null,2)+'\n');
  process.stdout.write(JSON.stringify({valid:true,output:path,taskCount:report.taskCount,resultCount:report.results.length,summary:report.summary})+'\n');
}

function protocolDocument(protocol){
  const lines=['# V8 开发数据：同前缀机制与预算实验','',
    '**状态：已冻结任务选择，尚未运行。** 所有任务来自已经检查过的旧 V7 数据，属于开发诊断，不能作为新留出成绩。',
    '',`已预声明 ${protocol.taskCount} 个任务，来自 ${protocol.distinctSourceCaseCount} 个原案例。三种订单机制 × 两种容量松紧形成六层，每层两个普通日与两个容量公告日 snapshot，共 24 个；另纳入 G0 全部四个当时观察下可行的漏解。`,
    '',protocol.selectionRule,'',
    '四策略取得同一个当时观察、同一执行锁、同一最早未执行日和同一份上一完整计划日期。固定保留和固定抛光直接重计价／审核上一计划；需要恢复时调用冻结 V7 新工厂。固定重建直接使用冻结 V7 新工厂；自适应方法通过 initialDates 获得相同参考。没有伪造 V7 私有缓存注入。',
    '',`三个算法随机种子固定为 ${protocol.algorithmSeeds.join('、')}，全部保存。24 个机制任务使用 200ms；四漏解使用 200/1000ms。另对四漏解实际运行冻结 V7 原始 scenario.seed 的 200/1000ms 配对，共 ${buildJobs(protocol,protocol.selections).length} 次调用。`,
    '', '导入、工厂创建和独立手工小例的 GLPK 初始化在计时之外。输入克隆、方法内重计价／审计、构造／修整／求解及最终独立回执审核计入调用预算。预算为合作式截止；记录真实超时，迟到完整结果不计及时成功，也不声称硬中断。不同于 V7 整条路径 5 秒冷 episode，不可混合比较。',
    '', '三个 D0 漏解没有上一完整计划，previousDates=null，属于初始化与预算探针；不能计为稳定性选择。D3 漏解则精确保留原 17 个执行动作和前日完整日期。原 V7 私有缓存状态不可注入，D3 预算探针只称同冻结源码／原种子／原 snapshot 的 fresh-factory 调用，不称精确重放原内部缓存状态。',
    '',`实际选样分母：普通日 ${protocol.selectedTaskCounts.ordinary}、容量公告日 ${protocol.selectedTaskCounts.capacityAnnouncement}；当前上一计划合法 ${protocol.selectedTaskCounts.previousValid}、当前已失效 ${protocol.selectedTaskCounts.previousInvalid}、无上一计划的 D0 初始化 ${protocol.selectedTaskCounts.noPreviousInitialization}。`,
    '', 'aged-backlog/tight 只有一个 V7 案例到达公告日；V6 与稳定保留的公告输入与它完全相同，按预声明来源优先级去重后使用每日重算的另一条原始历史。两条输入分别有 43 与 44 个原动作锁，来源方法保留在下表，不当作独立现实业务样本。',
    '', '| 类型 / 来源方法 | 原案例 | 日 | 箱数 | 原动作锁 | 当前上一计划可行 | 输入 hash |','| --- | --- | ---: | ---: | ---: | --- | --- |'];
  for(const t of protocol.selections)lines.push(`| ${t.snapshotKind??t.panel} / ${t.sourceMethod} | ${t.sourceCaseId} | D${t.sourceDay} | ${t.count} | ${t.executedEventCount} | ${t.previousValidNow?'是':t.previousReferenceAvailable?'否':'无上一计划'} | \`${t.snapshotHash}\` |`);
  lines.push('','源档 SHA-256：','');for(const [name,sha]of Object.entries(protocol.inputHashes))lines.push(`- \`${name}\`：\`${sha}\``);
  lines.push('','计时运行须等自适应源码稳定，并与其他计时实验错开：','','```bash','node scripts/mechanism-v8.mjs --run --output-dir artifacts/mechanism-v8-first','```','',
    '所有差、失败、迟到、审计拒绝与完整返回的原始日期均保留。费用仅在相同 task／seed／budget 的双方及时完整结果之间比较；失败费用为 null。未执行日期变化、今天／明天改期与总位移相对共同上一计划统计。多个日期可能来自同一案例，三个种子也只是重复运行，不能扩充为独立物流样本。snapshot 费用是当时模型预测，不是最终执行费用或实际节省；不作显著性、泛化或夺冠推断。','');
  return lines.join('\n');
}

async function main(){
  const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);return i<0?null:args[i+1];};
  const protocolPath=resolve(value('--protocol')??resolve(ROOT,'data/mechanism-protocol-v8.json'));
  if(args.includes('--freeze')){
    const sources=await readSources(),protocol=makeProtocol(sources),documentPath=resolve(ROOT,'docs/mechanism-v8.md');
    for(const target of [protocolPath,documentPath]){try{await access(target);throw new Error('Refusing to overwrite frozen selection/document: '+target);}catch(error){if(error.code!=='ENOENT')throw error;}}
    await writeFile(protocolPath,JSON.stringify(protocol,null,2)+'\n',{flag:'wx'});
    await writeFile(documentPath,protocolDocument(protocol),{flag:'wx'});
    process.stdout.write(JSON.stringify({valid:true,protocol:protocolPath,taskCount:protocol.taskCount,distinctSourceCaseCount:protocol.distinctSourceCaseCount,
      plannedCallCount:buildJobs(protocol,protocol.selections).length,protocolSHA256:bytesHash(await readFile(protocolPath))})+'\n');
  }else if(args.includes('--run')){
    const output=value('--output-dir');require(output,'--run requires an explicit new --output-dir under artifacts/.');
    await run(protocolPath,resolve(output));
  }else if(args.includes('--verify-selection')){
    const loaded=await loadFrozenProtocol(protocolPath);process.stdout.write(JSON.stringify({valid:true,taskCount:loaded.tasks.length,protocolSHA256:loaded.protocolHash,solverCalls:0})+'\n');
  }else throw new Error('Use --freeze, --verify-selection, or --run --output-dir artifacts/<new-directory>.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{process.stderr.write(String(error.stack??error)+'\n');process.exitCode=1;});
