import {readFile,writeFile,mkdir,copyFile,access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fork} from 'node:child_process';
import {cpus,totalmem,platform,release} from 'node:os';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {unknownEpisodeV7,DEFAULT_FACTORIES_V7} from './rolling-v7.worker.mjs';
import {auditSchedule,rowFor} from '../src/engine.js';
import {realizeCapacityEvents} from '../src/rolling-plan.js';
import {independentAuditV2} from './benchmark-v2.mjs';

const root=new URL('../',import.meta.url),workerPath=fileURLToPath(new URL('./rolling-v7.worker.mjs',import.meta.url));
const FEE_FIELDS=['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost','lateCount'];
export const FROZEN_PROTOCOL_HASH_V7='bb70fa6938ffbb162347142cbb2788f9ece00ac695a8b8ed5a647cd08aedb96f';
export const ROLLING_METHODS_V7=['dailyReoptV4','stableRetainV5','lockedRecoveryV6','costPolishV7','graspBaselineV7'];
const EPS=1e-6;
export const isCompleteV7=result=>Boolean(result?.complete===true&&result.auditValid===true&&['feasible','optimal'].includes(result.status)
  &&result.rows?.length&&Number.isFinite(result.totalCost)&&Number.isFinite(result.incrementalCost));

/** Lazy loading allows handcrafted tests without generating any prospective seed. */
export async function loadProtocolV7() {
  if(!/^[a-f0-9]{64}$/.test(FROZEN_PROTOCOL_HASH_V7))throw new Error('V7 protocol has not been frozen; prospective execution is disabled.');
  const raw=await readFile(new URL('data/protocol-v7.json',root)),hash=createHash('sha256').update(raw).digest('hex');
  if(hash!==FROZEN_PROTOCOL_HASH_V7)throw new Error('Frozen V7 protocol bytes changed; do not execute an undeclared experiment.');
  const protocol=JSON.parse(raw);
  if(JSON.stringify(protocol.methods)!==JSON.stringify(ROLLING_METHODS_V7)||protocol.budget.hardWallMs!==5000||!protocol.primaryCases.length)throw new Error('V7 declared method/budget/matrix differs from the runner.');
  return {protocol,protocolHash:hash};
}

/** A static complete plan is insufficient: every final event must be present
 * exactly once in the physical timeline and match the repriced terminal rows. */
export function validateCompleteReceiptV7(input,result) {
  try{return validateReceipt(input,result);}
  catch(error){return [`Malformed complete execution receipt: ${String(error.message??error)}`];}
}
function validateReceipt(input,result) {
  const errors=[];
  if(!isCompleteV7(result)||!Array.isArray(result.rows)||result.rows.length!==input.nominalScenario.containers.length||result.executionHistoryUnavailable===true)return ['Missing complete canonical terminal result.'];
  if(result.terminalAudit?.engine?.valid!==true||!Array.isArray(result.terminalAudit?.engine?.errors)||result.terminalAudit.engine.errors.length||!Array.isArray(result.terminalAudit?.independentErrors)||result.terminalAudit.independentErrors.length)errors.push('Missing successful terminal dual-audit evidence.');
  const timeline=result.timeline,history=new Map(),ids=new Set(input.nominalScenario.containers.map(c=>c.id));
  if(!Array.isArray(timeline)||!timeline.length||timeline.length>input.nominalScenario.horizonDays)return [...errors,'Missing or out-of-range complete physical timeline.'];
  const eventField={pickup:'pickupDay',unloadStart:'unloadDay',return:'returnDay'},flattened=[];
  for(const [index,entry]of timeline.entries()) {
    if(entry.day!==index||entry.status!=='executed'||entry.audit?.scheduleAudit?.valid!==true||entry.audit?.freezeAudit?.valid!==true)errors.push(`Day ${index}: missing executed and audited snapshot.`);
    if(!Array.isArray(entry.executedEvents)){errors.push(`Day ${index}: missing executed-event list.`);continue;}
    for(const event of entry.executedEvents) {
      if(!ids.has(event.id)||!Object.hasOwn(eventField,event.event)||event.day!==entry.day){errors.push(`Day ${index}: invalid physical event.`);continue;}
      const key=event.id+'\0'+event.event;
      if(history.has(key))errors.push(`Duplicate physical event ${event.id} ${event.event}.`);
      history.set(key,event.day);flattened.push(event);
    }
  }
  if(history.size!==ids.size*3)errors.push('Not every known container has three executed actions.');
  for(const row of result.rows)for(const [event,key]of Object.entries(eventField))if(history.get(row.id+'\0'+event)!==row[key])errors.push(`${row.id}: terminal ${key} differs from physical history.`);
  if(JSON.stringify(flattened)!==JSON.stringify(result.executedEvents))errors.push('Flattened timeline differs from delivered executedEvents.');
  if(result.executionThroughDay!==timeline.at(-1).day)errors.push('Terminal executionThroughDay differs from the timeline.');
  try {
    const actual=realizeCapacityEvents(input.nominalScenario,input.events);
    errors.push(...auditSchedule(actual,result.rows).errors,...independentAuditV2(actual,result));
  }catch(error){errors.push(String(error.message??error));}
  return errors;
}

/** A single authoritative clock covers process launch, imports, all rolling
 * calls, terminal dual audit, and IPC. No partial progress becomes execution. */
export function runColdEpisodeV7(input,{hardWallMs=5000,workerScript=workerPath}={}) {
  if(!Number.isFinite(hardWallMs)||hardWallMs<=0)throw new Error('hardWallMs must be positive and finite.');
  return new Promise(resolveResult=>{
    const started=performance.now(),episodeId=input.episodeId??input.nominalScenario?.id,method=input.method;
    const child=fork(workerScript,[],{stdio:['ignore','ignore','pipe','ipc'],serialization:'advanced'});
    let final=null,finalReceivedMs=null,receiptValidatedMs=null,deadlineReached=false,decisionMs=null,stderr='',rejectedTerminalCount=0,rejectedTerminalErrors=[];
    child.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-4000);});
    const timer=setTimeout(()=>{deadlineReached=true;decisionMs=performance.now()-started;child.kill('SIGKILL');},Math.max(0,hardWallMs-(performance.now()-started)));
    child.on('message',message=>{
      const elapsed=performance.now()-started;
      if(final||deadlineReached||elapsed>hardWallMs||message?.type!=='final'||message.method!==method||message.episodeId!==episodeId)return;
      const result=message.result;
      if(!result||typeof result.status!=='string'||typeof result.complete!=='boolean')return;
      if(result.complete) {
        const errors=validateCompleteReceiptV7(input,result);
        if(errors.length){rejectedTerminalCount++;rejectedTerminalErrors=errors.slice(0,20);return;}
      }
      const validated=performance.now()-started;
      if(validated>hardWallMs)return;
      final=result;finalReceivedMs=elapsed;receiptValidatedMs=validated;decisionMs=validated;clearTimeout(timer);
    });
    child.on('error',error=>{stderr+=String(error);});
    child.on('close',(code,signal)=>{
      clearTimeout(timer);const exitMs=performance.now()-started;
      if(!final&&exitMs>=hardWallMs){deadlineReached=true;decisionMs??=hardWallMs;}
      const result=final??unknownEpisodeV7(method,deadlineReached?'No audited terminal episode was delivered within the common whole-episode budget. Physical history and call counts are unavailable.':`Worker exited without a valid terminal envelope (${code}, ${signal}). ${stderr}`,deadlineReached?'hard_time_limit':'worker_error');
      if(!result.complete){result.rows=[];result.usage=[];for(const key of FEE_FIELDS)result[key]=null;}
      resolveResult({...result,policy:method,hardWallMs,wallTimeMs:decisionMs??exitMs,processExitWallTimeMs:exitMs,
        finalReceivedMs,receiptValidatedMs,rejectedTerminalCount,rejectedTerminalErrors,deadlineReached,outputDeliveredWithinBudget:Boolean(final),endToEndCompletedWithinBudget:Boolean(final),
        episodeCompletedWithinBudget:Boolean(final&&isCompleteV7(result)),exitCode:code,exitSignal:signal,stderr:stderr||null});
    });
    child.send({...input,episodeId});
  });
}

function completeInitial(s,result) {
  const entry=result?.timeline?.[0];
  if(!entry||entry.day!==0||entry.status!=='executed'||entry.audit?.scheduleAudit?.valid!==true||entry.audit?.freezeAudit?.valid!==true
    ||!Array.isArray(entry.decisions)||entry.decisions.length!==s.containers.length)return null;
  const expected=new Set(s.containers.map(c=>c.id)),seen=new Set();
  for(const row of entry.decisions) {
    if(!row||!expected.has(row.id)||seen.has(row.id)||!['pickupDay','unloadDay','returnDay'].every(key=>Number.isInteger(row[key])&&row[key]>=0&&row[key]<s.horizonDays))return null;
    const c=s.containers.find(c=>c.id===row.id),lag=s.operations?.returnLagDays??1;
    if(row.pickupDay<c.releaseDay||row.unloadDay<row.pickupDay||row.returnDay<row.unloadDay+c.unloadDays-1+lag||row.unloadDay+c.unloadDays-1>c.dueDay)return null;
    seen.add(row.id);
  }
  if(seen.size!==expected.size)return null;
  const observed=structuredClone(s);
  for(const observation of entry.observedEvents??[]) {
    if(!['truck','warehouse','staging'].includes(observation.resource)||!Number.isInteger(observation.capacity)||observation.capacity<0)return null;
    const key=observation.resource+'Capacity';
    observed[key]=Array.from({length:s.horizonDays},(_,d)=>d===0?observation.capacity:Array.isArray(s[key])?s[key][d]:s[key]);
  }
  const byId=new Map(entry.decisions.map(row=>[row.id,row]));
  const canonical=s.containers.map(c=>{const row=byId.get(c.id);return rowFor(observed,c,row.pickupDay,row.unloadDay,row.returnDay);});
  if(!auditSchedule(observed,canonical).valid)return null;
  return {decisions:[...entry.decisions].sort((a,b)=>a.id.localeCompare(b.id)).map(r=>({id:r.id,pickupDay:r.pickupDay,unloadDay:r.unloadDay,returnDay:r.returnDay})),observationHash:entry.observationHash??null};
}
export function compareInitialPlansV7(s,policies) {
  const plans=Object.fromEntries(ROLLING_METHODS_V7.map(method=>[method,completeInitial(s,policies[method])])),pairs={};
  for(let a=0;a<ROLLING_METHODS_V7.length;a++)for(let b=a+1;b<ROLLING_METHODS_V7.length;b++) {
    const left=ROLLING_METHODS_V7[a],right=ROLLING_METHODS_V7[b],p=plans[left],q=plans[right];
    const informationEqual=Boolean(p&&q&&p.observationHash&&q.observationHash&&p.observationHash===q.observationHash);
    pairs[`${left}__${right}`]={baselineMethod:left,candidateMethod:right,evaluated:Boolean(p&&q&&informationEqual),
      informationEqual:p&&q?informationEqual:null,decisionsEqual:p&&q&&informationEqual?JSON.stringify(p.decisions)===JSON.stringify(q.decisions):null};
  }
  const eligible=ROLLING_METHODS_V7.filter(method=>plans[method]);
  return {eligibleMethods:eligible,allMethodsEligible:eligible.length===ROLLING_METHODS_V7.length,
    allEqual:eligible.length===ROLLING_METHODS_V7.length&&Object.values(pairs).every(p=>p.evaluated)?Object.values(pairs).every(p=>p.decisionsEqual):null,pairs,
    interpretation:'Only complete audited day-zero schedules under matching observed information are comparable. Empty, partial, unaudited or unavailable initial records are not equal plans.'};
}

const finiteSummary=values=>{
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),n=sorted.length;
  return {observedCount:n,sum:sorted.reduce((a,b)=>a+b,0),median:n?(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2):null,p95:n?sorted[Math.ceil(.95*n)-1]:null,max:n?sorted[n-1]:null};
};
function comparison(cases,baseline,candidate) {
  const pairs=cases.filter(c=>isCompleteV7(c.policies[baseline])&&isCompleteV7(c.policies[candidate])),sum=(method,key)=>pairs.reduce((n,c)=>n+c.policies[method][key],0);
  const baselineTotalKRW=sum(baseline,'totalCost'),candidateTotalKRW=sum(candidate,'totalCost'),baselineIncrementalKRW=sum(baseline,'incrementalCost'),candidateIncrementalKRW=sum(candidate,'incrementalCost');
  const revisions=method=>{const values=pairs.map(c=>c.policies[method].revisionCount);return values.every(Number.isFinite)?values.reduce((a,b)=>a+b,0):null;},oldChanges=revisions(baseline),newChanges=revisions(candidate);
  const stat=(method,key)=>{const v=pairs.map(c=>c.policies[method].plannerStats?.[key]);return v.every(Number.isFinite)?v.reduce((a,b)=>a+b,0):null;};
  return {baselineMethod:baseline,candidateMethod:candidate,caseCount:cases.length,pairedCaseCount:pairs.length,
    missingBaselineCount:cases.filter(c=>!isCompleteV7(c.policies[baseline])).length,missingCandidateCount:cases.filter(c=>!isCompleteV7(c.policies[candidate])).length,
    baselineTotalKRW,candidateTotalKRW,totalSavingsKRW:baselineTotalKRW-candidateTotalKRW,weightedTotalSavingsPct:baselineTotalKRW===0?null:100*(baselineTotalKRW-candidateTotalKRW)/baselineTotalKRW,
    baselineIncrementalKRW,candidateIncrementalKRW,incrementalSavingsKRW:baselineIncrementalKRW-candidateIncrementalKRW,
    weightedIncrementalSavingsPct:baselineIncrementalKRW===0?null:100*(baselineIncrementalKRW-candidateIncrementalKRW)/baselineIncrementalKRW,
    zeroBaselineTotalCount:pairs.filter(c=>c.policies[baseline].totalCost===0).length,zeroBaselineIncrementalCount:pairs.filter(c=>c.policies[baseline].incrementalCost===0).length,
    positiveSavingsCount:pairs.filter(c=>c.policies[baseline].totalCost-c.policies[candidate].totalCost>EPS).length,
    tiedCount:pairs.filter(c=>Math.abs(c.policies[baseline].totalCost-c.policies[candidate].totalCost)<=EPS).length,
    negativeSavingsCount:pairs.filter(c=>c.policies[baseline].totalCost-c.policies[candidate].totalCost< -EPS).length,
    worstLossKRW:Math.max(0,...pairs.map(c=>c.policies[candidate].totalCost-c.policies[baseline].totalCost)),
    baselineRevisionCount:oldChanges,candidateRevisionCount:newChanges,revisionReductionPct:oldChanges===0||oldChanges===null||newChanges===null?null:100*(oldChanges-newChanges)/oldChanges,
    baselineSolverCalls:stat(baseline,'solverCalls'),candidateSolverCalls:stat(candidate,'solverCalls'),
    baselineDecisionCalls:stat(baseline,'decisionCalls'),candidateDecisionCalls:stat(candidate,'decisionCalls'),
    gainedCompletionCaseIds:cases.filter(c=>isCompleteV7(c.policies[candidate])&&!isCompleteV7(c.policies[baseline])).map(c=>c.id),
    lostCompletionCaseIds:cases.filter(c=>!isCompleteV7(c.policies[candidate])&&isCompleteV7(c.policies[baseline])).map(c=>c.id),
    gainedFromKnownFailureCaseIds:cases.filter(c=>isCompleteV7(c.policies[candidate])&&!isCompleteV7(c.policies[baseline])&&c.policies[baseline].executionHistoryUnavailable!==true).map(c=>c.id),
    gainedFromUnavailableHistoryCaseIds:cases.filter(c=>isCompleteV7(c.policies[candidate])&&c.policies[baseline].executionHistoryUnavailable===true).map(c=>c.id),
    completionComparisonInterpretation:'Differences count timely delivered complete episodes. An unavailable baseline history is not proof of physical execution failure.',
    negativeSavingsCaseIds:pairs.filter(c=>c.policies[candidate].totalCost>c.policies[baseline].totalCost+EPS).map(c=>c.id)};
}
export function summarizeRollingV7(cases) {
  const byMethod=Object.fromEntries(ROLLING_METHODS_V7.map(method=>{
    const results=cases.map(c=>c.policies[method]),known=results.filter(r=>r.executionHistoryUnavailable!==true),unknown=results.length-known.length,statuses={};
    for(const result of results)statuses[result.status]=(statuses[result.status]??0)+1;
    const observed=(getter)=>{const values=known.map(getter);return {observedSum:values.filter(Number.isFinite).reduce((a,b)=>a+b,0),knownEpisodeCount:values.filter(Number.isFinite).length,unknownEpisodeCount:results.length-values.filter(Number.isFinite).length};};
    return [method,{caseCount:results.length,completeCount:results.filter(isCompleteV7).length,failureCount:results.filter(r=>!isCompleteV7(r)).length,
      knownExecutionFailureCount:known.filter(r=>!isCompleteV7(r)).length,executionHistoryUnavailableCount:unknown,
      undeliveredEpisodeCount:results.filter(r=>!r.outputDeliveredWithinBudget).length,hardDeadlineCount:results.filter(r=>r.deadlineReached).length,
      auditFailureCount:results.filter(r=>r.status==='audit_failed').length,statuses,
      observedRevisionCount:observed(r=>r.revisionCount),
      counters:Object.fromEntries(['decisionCalls','solverCalls','constructorCalls','reusedPlans','replannedDueToInvalid','planningWallMs'].map(key=>[key,observed(r=>r.plannerStats?.[key])])),
      callWallMs:finiteSummary(known.flatMap(r=>r.plannerStats?.callWallMs??[])),wallTimeMs:finiteSummary(results.map(r=>r.wallTimeMs)),processExitWallTimeMs:finiteSummary(results.map(r=>r.processExitWallTimeMs))}];
  }));
  const comparisons={polishVsLocked:comparison(cases,'lockedRecoveryV6','costPolishV7'),polishVsStable:comparison(cases,'stableRetainV5','costPolishV7'),
    graspVsLocked:comparison(cases,'lockedRecoveryV6','graspBaselineV7'),polishVsGrasp:comparison(cases,'graspBaselineV7','costPolishV7'),
    lockedVsStable:comparison(cases,'stableRetainV5','lockedRecoveryV6'),stableVsDaily:comparison(cases,'dailyReoptV4','stableRetainV5')};
  const equalityPairs={};
  for(const c of cases)for(const [key,pair]of Object.entries(c.initialComparison?.pairs??{})) {
    const entry=equalityPairs[key]??={evaluatedCaseCount:0,equalCaseCount:0,differentCaseCount:0,unavailableCaseCount:0};
    if(!pair.evaluated)entry.unavailableCaseCount++;else {entry.evaluatedCaseCount++;if(pair.decisionsEqual)entry.equalCaseCount++;else entry.differentCaseCount++;}
  }
  return {caseCount:cases.length,byMethod,comparisons,
    byScale:Object.fromEntries([...new Set(cases.map(c=>c.count))].map(count=>[count,{caseCount:cases.filter(c=>c.count===count).length,
      completeCounts:Object.fromEntries(ROLLING_METHODS_V7.map(method=>[method,cases.filter(c=>c.count===count&&isCompleteV7(c.policies[method])).length]))}])),
    initialEquality:{allMethodsEvaluatedCount:cases.filter(c=>c.initialComparison?.allMethodsEligible&&c.initialComparison?.allEqual!==null).length,
      allMethodsEqualCount:cases.filter(c=>c.initialComparison?.allEqual===true).length,pairs:equalityPairs},
    terminalAudit:{completeEpisodes:cases.reduce((n,c)=>n+Object.values(c.policies).filter(isCompleteV7).length,0),failedAudits:cases.reduce((n,c)=>n+Object.values(c.policies).filter(r=>r.status==='audit_failed').length,0)}};
}

export function realizeDeclaredShocksV7(nominal,shocks) {
  return shocks.map(shock=>{
    const capacity=nominal[`${shock.resource}Capacity`],base=Array.isArray(capacity)?capacity[shock.revealDay]:capacity;
    const {reductionNumerator,reductionDenominator,...event}=shock;
    if(!Number.isInteger(reductionNumerator)||reductionNumerator<0||!Number.isInteger(reductionDenominator)||reductionDenominator<=0)throw new Error('Invalid declared integer shock reduction.');
    return {...event,capacity:Math.max(0,base-Math.ceil(base*reductionNumerator/reductionDenominator))};
  });
}

export async function loadDevelopmentInputsV7(protocol) {
  const spec=protocol.developmentControls;
  if(!spec)return [];
  if(spec.bundlePath) {
    let bytes;
    try{bytes=await readFile(new URL(spec.bundlePath,root));}catch(error){if(error.code!=='ENOENT')throw error;}
    if(bytes) {
      const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8'));
      const declaration=manifest.developmentInputBundle;
      if(declaration?.path!==spec.bundlePath||createHash('sha256').update(bytes).digest('hex')!==declaration.sha256)throw new Error('Frozen development input bundle differs from its snapshot manifest.');
      return validateDevelopmentBundleV7(protocol,JSON.parse(bytes));
    }
  }
  const sources=spec.sources??[spec],controls=[],allIds=new Set();
  for(const source of sources) {
    const raw=await readFile(new URL(source.inputArchive,root));
    if(createHash('sha256').update(raw).digest('hex')!==source.inputArchiveSha256)throw new Error('Declared old development archive bytes changed.');
    const previous=JSON.parse(raw),map=new Map(previous.cases.map(c=>[c.id,c]));
    if(!Array.isArray(source.caseIds)||new Set(source.caseIds).size!==source.caseIds.length)throw new Error('Development case selection must be explicit and unique.');
    for(const id of source.caseIds) {
      const old=map.get(id);if(!old)throw new Error(`Missing declared development case ${id}.`);
      const outputId=id+(source.suffix??spec.suffix??'--development-control');
      if(allIds.has(outputId))throw new Error('Repeated development input reference.');allIds.add(outputId);
      controls.push({id:outputId,referenceCaseId:id,referenceArchive:source.inputArchive,referenceArchiveSha256:source.inputArchiveSha256,
        dataRole:'development-control',count:old.count,mechanism:old.mechanism,capacityProfile:old.capacityProfile,repeat:old.repeat,seed:old.seed,
        referenceConfig:Object.fromEntries(Object.entries(old).filter(([key])=>!['nominalScenario','events','scenario','policies','audits','initialComparison','methodExecutionOrder'].includes(key))),
        nominalScenario:structuredClone(old.nominalScenario),events:structuredClone(old.events)});
    }
  }
  return controls;
}

export function developmentBundleV7(protocol,controls) {
  const spec=protocol.developmentControls,sources=spec.sources??[spec];
  return {schemaVersion:'portplan-v7-frozen-development-inputs',protocolHash:FROZEN_PROTOCOL_HASH_V7,
    sourceArchives:sources.map(source=>({path:source.inputArchive,sha256:source.inputArchiveSha256})),
    interpretation:'Only exact prior nominal scenarios, shocks and configuration; results and duplicated old stage logs are not bundled. These inputs informed development and are not new held-out samples.',
    cases:structuredClone(controls)};
}

export function validateDevelopmentBundleV7(protocol,bundle) {
  const spec=protocol.developmentControls,sources=spec.sources??[spec],expected=[];
  for(const source of sources)for(const id of source.caseIds)expected.push({id:id+(source.suffix??spec.suffix??'--development-control'),referenceCaseId:id,referenceArchive:source.inputArchive,referenceArchiveSha256:source.inputArchiveSha256});
  if(bundle.protocolHash!==FROZEN_PROTOCOL_HASH_V7||bundle.schemaVersion!=='portplan-v7-frozen-development-inputs'||bundle.cases.length!==expected.length)throw new Error('Frozen development bundle schema/protocol/case count differs.');
  if(JSON.stringify(bundle.sourceArchives)!==JSON.stringify(sources.map(source=>({path:source.inputArchive,sha256:source.inputArchiveSha256}))))throw new Error('Frozen bundle source archive references differ.');
  for(const [index,record]of bundle.cases.entries()) {
    for(const [key,value]of Object.entries(expected[index]))if(record[key]!==value)throw new Error('Frozen development bundle case references differ.');
    if(record.dataRole!=='development-control'||!record.nominalScenario||!Array.isArray(record.events))throw new Error('Incomplete bundled development input.');
  }
  return structuredClone(bundle.cases);
}

export async function assertNewOutputV7(path) {
  try{await access(path);}catch(error){if(error.code==='ENOENT')return;throw error;}
  throw new Error('Output already exists; preserve it and choose a new reproduction path.');
}

const SOURCE_PATHS=['scripts/rolling-benchmark-v7.mjs','scripts/rolling-v7.worker.mjs','scripts/benchmark-v2.mjs','src/engine.js','src/rolling-plan.js','src/stable-planner-v5.js','src/recovery-planner-v6.js','src/cost-recovery-v7.js','src/grasp-planner-v7.js',
  'src/solver-glpk.js','src/solver-presolver.js','src/execution-constraints.js','src/fast-constructor-v5.js','src/event-search-v4.js','src/strong-baseline.js',
  'data/protocol-v2.json','data/protocol-v7.json','package.json','package-lock.json'];

async function main() {
  const {protocol,protocolHash}=await loadProtocolV7();
  const outputIndex=process.argv.indexOf('--output'),first=process.argv.includes('--record-first-run'),frozen=fileURLToPath(new URL('data/rolling-v7.json',root));
  if(outputIndex>=0&&!process.argv[outputIndex+1])throw new Error('--output requires a path.');
  const outputPath=resolve(outputIndex>=0?process.argv[outputIndex+1]:first?frozen:fileURLToPath(new URL('artifacts/rolling-v7-reproduction.json',root)));
  if(outputPath===frozen&&!first)throw new Error('Preserve the V7 first-run archive; choose a reproduction output.');
  if(first&&outputPath!==frozen)throw new Error('--record-first-run must use the declared data/rolling-v7.json destination.');
  await assertNewOutputV7(outputPath);
  const sourcePaths=[...new Set([...SOURCE_PATHS,...(protocol.runtimeSourcePaths??[]),...Object.values(protocol.methodFactories??DEFAULT_FACTORIES_V7).map(definition=>definition.module)])];
  const implementationHashes={};for(const path of sourcePaths)implementationHashes[path]=createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
  if(implementationHashes['scripts/benchmark-v2.mjs']!==protocol.generator.implementationSha256AtProtocolFreeze)throw new Error('Declared unchanged generator implementation differs.');
  const controls=await loadDevelopmentInputsV7(protocol);
  const bundle=protocol.developmentControls?developmentBundleV7(protocol,controls):null;
  const bundleBytes=bundle?Buffer.from(JSON.stringify(bundle,null,2)+'\n'):null;
  const developmentInputBundle=bundle?{path:protocol.developmentControls.bundlePath??'data/development-inputs-v7.json',
    sha256:createHash('sha256').update(bundleBytes).digest('hex'),referenceArchives:bundle.sourceArchives,caseCount:controls.length}:null;
  // The source snapshot and all hashes precede the first prospective generation.
  if(first) {
    const snapshot=new URL('vendor/experiments/v7-first-run-source/',root);
    await mkdir(new URL('../',snapshot),{recursive:true});await mkdir(snapshot,{recursive:false});
    for(const path of sourcePaths){const target=new URL(path,snapshot);await mkdir(dirname(fileURLToPath(target)),{recursive:true});await copyFile(new URL(path,root),target);}
    if(bundleBytes) {
      const target=new URL(developmentInputBundle.path,snapshot);await mkdir(dirname(fileURLToPath(target)),{recursive:true});await writeFile(target,bundleBytes,{flag:'wx'});
    }
    await writeFile(new URL('manifest.json',snapshot),JSON.stringify({protocolHash,implementationHashes,developmentInputBundle,capturedBeforePrimaryGeneration:true},null,2)+'\n');
  }
  const {makeScenarioV2}=await import('./benchmark-v2.mjs');
  const cgroup={};for(const path of ['/sys/fs/cgroup/cpu.max','/sys/fs/cgroup/memory.max']){try{cgroup[path]=(await readFile(path,'utf8')).trim();}catch{cgroup[path]='unavailable';}}
  const output={schemaVersion:'portplan-cold-episode-cost-polish-v7-compact-telemetry',protocolVersion:protocol.protocolVersion,protocolHash,protocol,implementationHashes,developmentInputBundle,
    startedAt:new Date().toISOString(),executionState:'running',environment:{node:process.version,platform:platform(),release:release(),hostLogicalCPUs:cpus().length,cpuModel:cpus()[0]?.model,hostMemoryBytes:totalmem(),cgroupLimits:cgroup},
    cases:[],summary:null,developmentControls:{dataRole:'development-only; not held-out or new independent samples',cases:[],summary:null},
    limitations:['Each cold complete episode has a common 5000 ms parent budget; per-call legacy solver seconds and V7 cooperative milliseconds have different semantics.',
      'A killed child without terminal output supplies no physical-history or call-count evidence; unknown counters are not zero.',
      'Only jointly completed terminal executions enter fee and revision comparisons; all unknown, failed, zero and negative outcomes remain.',
      'Orders, capacities and shock patterns are synthetic; an external classical GRASP adaptation is not a published same-problem reproduction or an optimality certificate.',
      'Physical timelines/state/date choices and terminal rows/audits are complete; duplicated cache pricing rows and LP/model debug arrays are summarized in planner diagnostics. Polish before/after date proofs remain complete.']};
  await mkdir(dirname(outputPath),{recursive:true});
  let initialSave=true;
  const save=async()=>{output.generatedAt=new Date().toISOString();output.summary=summarizeRollingV7(output.cases);output.developmentControls.summary=summarizeRollingV7(output.developmentControls.cases);await writeFile(outputPath,JSON.stringify(output,null,2)+'\n',initialSave?{flag:'wx'}:undefined);initialSave=false;};
  await save();
  const runCase=async(config,index)=>{
    const nominalScenario=config.nominalScenario??makeScenarioV2(config),events=config.events??realizeDeclaredShocksV7(nominalScenario,config.shocks),policies={},audits={};
    const order=ROLLING_METHODS_V7.map((_,offset)=>ROLLING_METHODS_V7[(index+offset)%ROLLING_METHODS_V7.length]);
    for(const method of order) {
      const result=await runColdEpisodeV7({episodeId:config.id,nominalScenario,events,method,callBudgets:protocol.callBudgets,methodFactories:protocol.methodFactories??DEFAULT_FACTORIES_V7},{hardWallMs:protocol.budget.hardWallMs});
      policies[method]=result;if(result.terminalAudit)audits[method]=result.terminalAudit;
      console.log(`${config.dataRole==='development-control'?'development':'primary'} ${config.id} ${method}: ${result.status}; complete=${result.complete}; historyUnknown=${result.executionHistoryUnavailable}; total=${result.totalCost}; calls=${result.plannerStats?.decisionCalls}`);
    }
    return {...config,nominalScenario,events,scenario:realizeCapacityEvents(nominalScenario,events),methodExecutionOrder:order,policies,audits,
      initialComparison:compareInitialPlansV7(nominalScenario,policies)};
  };
  for(const [index,config]of protocol.primaryCases.entries()){output.cases.push(await runCase({...config,dataRole:'held-out-primary'},index));await save();}
  for(const [index,config]of controls.entries()){output.developmentControls.cases.push(await runCase(config,protocol.primaryCases.length+index));await save();}
  output.executionState='complete';await save();console.log(JSON.stringify({primary:output.summary,development:output.developmentControls.summary},null,2));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
