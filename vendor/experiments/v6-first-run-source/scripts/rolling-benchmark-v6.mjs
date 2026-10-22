import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fork} from 'node:child_process';
import {cpus,totalmem,platform,release} from 'node:os';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {unknownEpisodeV6} from './rolling-v6.worker.mjs';
import {auditSchedule,rowFor} from '../src/engine.js';

const root=new URL('../',import.meta.url),workerPath=fileURLToPath(new URL('./rolling-v6.worker.mjs',import.meta.url));
const FEE_FIELDS=['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost','lateCount'];
export const FROZEN_PROTOCOL_HASH_V6='6b40337ee36ff9ff10dbd22e4953932aa17900a5d12cbc3a5f75e36518660311';
export const ROLLING_METHODS_V6=['dailyReoptV4','stableRetainV5','lockedRecoveryV6','persistenceRecoveryV6'];
const EPS=1e-6;
export const isCompleteV6=result=>Boolean(result?.complete===true&&result.auditValid===true&&['feasible','optimal'].includes(result.status)
  &&result.rows?.length&&Number.isFinite(result.totalCost)&&Number.isFinite(result.incrementalCost));

/** Lazy loading allows handcrafted tests without generating any prospective seed. */
export async function loadProtocolV6() {
  const raw=await readFile(new URL('data/protocol-v6.json',root)),hash=createHash('sha256').update(raw).digest('hex');
  if(hash!==FROZEN_PROTOCOL_HASH_V6)throw new Error('Frozen V6 protocol bytes changed; do not execute an undeclared experiment.');
  const protocol=JSON.parse(raw);
  if(JSON.stringify(protocol.methods)!==JSON.stringify(ROLLING_METHODS_V6)||protocol.budget.hardWallMs!==5000||protocol.primaryCases.length!==36)throw new Error('V6 declared method/budget/matrix differs from the runner.');
  return {protocol,protocolHash:hash};
}

/** A single authoritative clock covers process launch, imports, all rolling
 * calls, terminal dual audit, and IPC. No partial progress becomes execution. */
export function runColdEpisodeV6(input,{hardWallMs=5000,workerScript=workerPath}={}) {
  if(!Number.isFinite(hardWallMs)||hardWallMs<=0)throw new Error('hardWallMs must be positive and finite.');
  return new Promise(resolveResult=>{
    const started=performance.now(),episodeId=input.episodeId??input.nominalScenario?.id,method=input.method;
    const child=fork(workerScript,[],{stdio:['ignore','ignore','pipe','ipc'],serialization:'advanced'});
    let final=null,finalReceivedMs=null,deadlineReached=false,decisionMs=null,stderr='';
    child.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-4000);});
    const timer=setTimeout(()=>{deadlineReached=true;decisionMs=performance.now()-started;child.kill('SIGKILL');},Math.max(0,hardWallMs-(performance.now()-started)));
    child.on('message',message=>{
      const elapsed=performance.now()-started;
      if(final||deadlineReached||elapsed>hardWallMs||message?.type!=='final'||message.method!==method||message.episodeId!==episodeId)return;
      const result=message.result;
      if(!result||typeof result.status!=='string'||typeof result.complete!=='boolean')return;
      if(result.complete&&(!isCompleteV6(result)||result.rows.length!==input.nominalScenario.containers.length||result.executionHistoryUnavailable===true))return;
      final=result;finalReceivedMs=elapsed;decisionMs=elapsed;clearTimeout(timer);
    });
    child.on('error',error=>{stderr+=String(error);});
    child.on('close',(code,signal)=>{
      clearTimeout(timer);const exitMs=performance.now()-started;
      if(!final&&exitMs>=hardWallMs){deadlineReached=true;decisionMs??=hardWallMs;}
      const result=final??unknownEpisodeV6(method,deadlineReached?'No audited terminal episode was delivered within the common whole-episode budget. Physical history and call counts are unavailable.':`Worker exited without a valid terminal envelope (${code}, ${signal}). ${stderr}`,deadlineReached?'hard_time_limit':'worker_error');
      if(!result.complete)for(const key of FEE_FIELDS)result[key]=null;
      resolveResult({...result,policy:method,hardWallMs,wallTimeMs:decisionMs??exitMs,processExitWallTimeMs:exitMs,
        finalReceivedMs,deadlineReached,outputDeliveredWithinBudget:Boolean(final),endToEndCompletedWithinBudget:Boolean(final),
        episodeCompletedWithinBudget:Boolean(final&&isCompleteV6(result)),exitCode:code,exitSignal:signal,stderr:stderr||null});
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
export function compareInitialPlansV6(s,policies) {
  const plans=Object.fromEntries(ROLLING_METHODS_V6.map(method=>[method,completeInitial(s,policies[method])])),pairs={};
  for(let a=0;a<ROLLING_METHODS_V6.length;a++)for(let b=a+1;b<ROLLING_METHODS_V6.length;b++) {
    const left=ROLLING_METHODS_V6[a],right=ROLLING_METHODS_V6[b],p=plans[left],q=plans[right];
    const informationEqual=Boolean(p&&q&&p.observationHash&&q.observationHash&&p.observationHash===q.observationHash);
    pairs[`${left}__${right}`]={baselineMethod:left,candidateMethod:right,evaluated:Boolean(p&&q&&informationEqual),
      informationEqual:p&&q?informationEqual:null,decisionsEqual:p&&q&&informationEqual?JSON.stringify(p.decisions)===JSON.stringify(q.decisions):null};
  }
  const eligible=ROLLING_METHODS_V6.filter(method=>plans[method]);
  return {eligibleMethods:eligible,allMethodsEligible:eligible.length===ROLLING_METHODS_V6.length,
    allEqual:eligible.length===ROLLING_METHODS_V6.length&&Object.values(pairs).every(p=>p.evaluated)?Object.values(pairs).every(p=>p.decisionsEqual):null,pairs,
    interpretation:'Only complete audited day-zero schedules under matching observed information are comparable. Empty, partial, unaudited or unavailable initial records are not equal plans.'};
}

const finiteSummary=values=>{
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),n=sorted.length;
  return {observedCount:n,sum:sorted.reduce((a,b)=>a+b,0),median:n?(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2):null,p95:n?sorted[Math.ceil(.95*n)-1]:null,max:n?sorted[n-1]:null};
};
function comparison(cases,baseline,candidate) {
  const pairs=cases.filter(c=>isCompleteV6(c.policies[baseline])&&isCompleteV6(c.policies[candidate])),sum=(method,key)=>pairs.reduce((n,c)=>n+c.policies[method][key],0);
  const baselineTotalKRW=sum(baseline,'totalCost'),candidateTotalKRW=sum(candidate,'totalCost'),baselineIncrementalKRW=sum(baseline,'incrementalCost'),candidateIncrementalKRW=sum(candidate,'incrementalCost');
  const revisions=method=>{const values=pairs.map(c=>c.policies[method].revisionCount);return values.every(Number.isFinite)?values.reduce((a,b)=>a+b,0):null;},oldChanges=revisions(baseline),newChanges=revisions(candidate);
  const stat=(method,key)=>{const v=pairs.map(c=>c.policies[method].plannerStats?.[key]);return v.every(Number.isFinite)?v.reduce((a,b)=>a+b,0):null;};
  return {baselineMethod:baseline,candidateMethod:candidate,caseCount:cases.length,pairedCaseCount:pairs.length,
    missingBaselineCount:cases.filter(c=>!isCompleteV6(c.policies[baseline])).length,missingCandidateCount:cases.filter(c=>!isCompleteV6(c.policies[candidate])).length,
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
    gainedCompletionCaseIds:cases.filter(c=>isCompleteV6(c.policies[candidate])&&!isCompleteV6(c.policies[baseline])).map(c=>c.id),
    lostCompletionCaseIds:cases.filter(c=>!isCompleteV6(c.policies[candidate])&&isCompleteV6(c.policies[baseline])).map(c=>c.id),
    gainedFromKnownFailureCaseIds:cases.filter(c=>isCompleteV6(c.policies[candidate])&&!isCompleteV6(c.policies[baseline])&&c.policies[baseline].executionHistoryUnavailable!==true).map(c=>c.id),
    gainedFromUnavailableHistoryCaseIds:cases.filter(c=>isCompleteV6(c.policies[candidate])&&c.policies[baseline].executionHistoryUnavailable===true).map(c=>c.id),
    completionComparisonInterpretation:'Differences count timely delivered complete episodes. An unavailable baseline history is not proof of physical execution failure.',
    negativeSavingsCaseIds:pairs.filter(c=>c.policies[candidate].totalCost>c.policies[baseline].totalCost+EPS).map(c=>c.id)};
}
export function summarizeRollingV6(cases) {
  const byMethod=Object.fromEntries(ROLLING_METHODS_V6.map(method=>{
    const results=cases.map(c=>c.policies[method]),known=results.filter(r=>r.executionHistoryUnavailable!==true),unknown=results.length-known.length,statuses={};
    for(const result of results)statuses[result.status]=(statuses[result.status]??0)+1;
    const observed=(getter)=>{const values=known.map(getter);return {observedSum:values.filter(Number.isFinite).reduce((a,b)=>a+b,0),knownEpisodeCount:values.filter(Number.isFinite).length,unknownEpisodeCount:results.length-values.filter(Number.isFinite).length};};
    return [method,{caseCount:results.length,completeCount:results.filter(isCompleteV6).length,failureCount:results.filter(r=>!isCompleteV6(r)).length,
      knownExecutionFailureCount:known.filter(r=>!isCompleteV6(r)).length,executionHistoryUnavailableCount:unknown,
      undeliveredEpisodeCount:results.filter(r=>!r.outputDeliveredWithinBudget).length,hardDeadlineCount:results.filter(r=>r.deadlineReached).length,
      auditFailureCount:results.filter(r=>r.status==='audit_failed').length,statuses,
      observedRevisionCount:observed(r=>r.revisionCount),
      counters:Object.fromEntries(['decisionCalls','solverCalls','constructorCalls','reusedPlans','replannedDueToInvalid','planningWallMs'].map(key=>[key,observed(r=>r.plannerStats?.[key])])),
      callWallMs:finiteSummary(known.flatMap(r=>r.plannerStats?.callWallMs??[])),wallTimeMs:finiteSummary(results.map(r=>r.wallTimeMs)),processExitWallTimeMs:finiteSummary(results.map(r=>r.processExitWallTimeMs))}];
  }));
  const comparisons={lockedVsStable:comparison(cases,'stableRetainV5','lockedRecoveryV6'),persistenceVsStable:comparison(cases,'stableRetainV5','persistenceRecoveryV6'),
    persistenceVsLocked:comparison(cases,'lockedRecoveryV6','persistenceRecoveryV6'),stableVsDaily:comparison(cases,'dailyReoptV4','stableRetainV5')};
  const equalityPairs={};
  for(const c of cases)for(const [key,pair]of Object.entries(c.initialComparison?.pairs??{})) {
    const entry=equalityPairs[key]??={evaluatedCaseCount:0,equalCaseCount:0,differentCaseCount:0,unavailableCaseCount:0};
    if(!pair.evaluated)entry.unavailableCaseCount++;else {entry.evaluatedCaseCount++;if(pair.decisionsEqual)entry.equalCaseCount++;else entry.differentCaseCount++;}
  }
  return {caseCount:cases.length,byMethod,comparisons,
    byScale:Object.fromEntries([...new Set(cases.map(c=>c.count))].map(count=>[count,{caseCount:cases.filter(c=>c.count===count).length,
      completeCounts:Object.fromEntries(ROLLING_METHODS_V6.map(method=>[method,cases.filter(c=>c.count===count&&isCompleteV6(c.policies[method])).length]))}])),
    initialEquality:{allMethodsEvaluatedCount:cases.filter(c=>c.initialComparison?.allMethodsEligible&&c.initialComparison?.allEqual!==null).length,
      allMethodsEqualCount:cases.filter(c=>c.initialComparison?.allEqual===true).length,pairs:equalityPairs},
    terminalAudit:{completeEpisodes:cases.reduce((n,c)=>n+Object.values(c.policies).filter(isCompleteV6).length,0),failedAudits:cases.reduce((n,c)=>n+Object.values(c.policies).filter(r=>r.status==='audit_failed').length,0)}};
}

export function realizeDeclaredShocksV6(nominal,shocks) {
  return shocks.map(shock=>{
    const capacity=nominal[`${shock.resource}Capacity`],base=Array.isArray(capacity)?capacity[shock.revealDay]:capacity;
    const {reductionNumerator,reductionDenominator,...event}=shock;
    if(!Number.isInteger(reductionNumerator)||reductionNumerator<0||!Number.isInteger(reductionDenominator)||reductionDenominator<=0)throw new Error('Invalid declared integer shock reduction.');
    return {...event,capacity:Math.max(0,base-Math.ceil(base*reductionNumerator/reductionDenominator))};
  });
}

export async function loadDevelopmentInputsV6(protocol) {
  const spec=protocol.developmentControls,raw=await readFile(new URL(spec.inputArchive,root));
  if(createHash('sha256').update(raw).digest('hex')!==spec.inputArchiveSha256)throw new Error('Declared V5 development archive bytes changed.');
  const previous=JSON.parse(raw),map=new Map(previous.cases.map(c=>[c.id,c]));
  if(spec.caseIds.length!==24||spec.caseIds.length!==previous.cases.length||new Set(spec.caseIds).size!==24)throw new Error('Development controls must retain every prior V5 case exactly once.');
  return spec.caseIds.map(id=>{
    const old=map.get(id);if(!old)throw new Error(`Missing declared development case ${id}.`);
    return {id:id+spec.suffix,referenceCaseId:id,dataRole:'development-control',count:old.count,mechanism:old.mechanism,capacityProfile:old.capacityProfile,repeat:old.repeat,seed:old.seed,
      nominalScenario:structuredClone(old.nominalScenario),events:structuredClone(old.events)};
  });
}

const SOURCE_PATHS=['scripts/rolling-benchmark-v6.mjs','scripts/rolling-v6.worker.mjs','scripts/benchmark-v2.mjs','src/engine.js','src/rolling-plan.js','src/stable-planner-v5.js','src/recovery-planner-v6.js','src/persistence-planner-v6.js',
  'src/solver-glpk.js','src/solver-presolver.js','src/execution-constraints.js','src/fast-constructor-v5.js','src/event-search-v4.js','src/strong-baseline.js',
  'data/protocol-v2.json','data/protocol-v5.json','data/protocol-v6.json','data/rolling-v5.json','package.json','package-lock.json'];

async function main() {
  const {protocol,protocolHash}=await loadProtocolV6();
  const outputIndex=process.argv.indexOf('--output'),first=process.argv.includes('--record-first-run'),frozen=fileURLToPath(new URL('data/rolling-v6.json',root));
  if(outputIndex>=0&&!process.argv[outputIndex+1])throw new Error('--output requires a path.');
  const outputPath=resolve(outputIndex>=0?process.argv[outputIndex+1]:first?frozen:fileURLToPath(new URL('artifacts/rolling-v6-reproduction.json',root)));
  if(outputPath===frozen&&!first)throw new Error('Preserve the V6 first-run archive; choose a reproduction output.');
  if(first&&outputPath!==frozen)throw new Error('--record-first-run must use the declared data/rolling-v6.json destination.');
  if(first){try{await readFile(frozen);throw new Error('V6 first-run archive already exists; never overwrite it.');}catch(error){if(error.code!=='ENOENT')throw error;}}
  const implementationHashes={};for(const path of SOURCE_PATHS)implementationHashes[path]=createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
  if(implementationHashes['scripts/benchmark-v2.mjs']!==protocol.generator.implementationSha256AtProtocolFreeze)throw new Error('Declared unchanged generator implementation differs.');
  // The source snapshot and all hashes precede the first prospective generation.
  if(first) {
    const snapshot=new URL('vendor/experiments/v6-first-run-source/',root);
    await mkdir(snapshot,{recursive:true});
    for(const path of SOURCE_PATHS){const target=new URL(path,snapshot);await mkdir(dirname(fileURLToPath(target)),{recursive:true});await copyFile(new URL(path,root),target);}
    await writeFile(new URL('manifest.json',snapshot),JSON.stringify({protocolHash,implementationHashes,capturedBeforePrimaryGeneration:true},null,2)+'\n');
  }
  const {makeScenarioV2}=await import('./benchmark-v2.mjs'),{realizeCapacityEvents}=await import('../src/rolling-plan.js');
  const cgroup={};for(const path of ['/sys/fs/cgroup/cpu.max','/sys/fs/cgroup/memory.max']){try{cgroup[path]=(await readFile(path,'utf8')).trim();}catch{cgroup[path]='unavailable';}}
  const output={schemaVersion:'portplan-cold-episode-recovery-v6',protocolVersion:protocol.protocolVersion,protocolHash,protocol,implementationHashes,
    startedAt:new Date().toISOString(),executionState:'running',environment:{node:process.version,platform:platform(),release:release(),hostLogicalCPUs:cpus().length,cpuModel:cpus()[0]?.model,hostMemoryBytes:totalmem(),cgroupLimits:cgroup},
    cases:[],summary:null,developmentControls:{dataRole:'development-only; not held-out or new independent samples',cases:[],summary:null},
    limitations:['Each cold complete episode has a common 5000 ms parent budget; per-call legacy solver seconds and V6 cooperative milliseconds have different semantics.',
      'A killed child without terminal output supplies no physical-history or call-count evidence; unknown counters are not zero.',
      'Only jointly completed terminal executions enter fee and revision comparisons; all unknown, failed, zero and negative outcomes remain.',
      'Orders, capacities and shock patterns are synthetic; persistence is a declared conservative forecast, not future information.']};
  await mkdir(dirname(outputPath),{recursive:true});
  const save=async()=>{output.generatedAt=new Date().toISOString();output.summary=summarizeRollingV6(output.cases);output.developmentControls.summary=summarizeRollingV6(output.developmentControls.cases);await writeFile(outputPath,JSON.stringify(output,null,2)+'\n');};
  await save();
  const runCase=async(config,index)=>{
    const nominalScenario=config.nominalScenario??makeScenarioV2(config),events=config.events??realizeDeclaredShocksV6(nominalScenario,config.shocks),policies={},audits={};
    const order=ROLLING_METHODS_V6.map((_,offset)=>ROLLING_METHODS_V6[(index+offset)%4]);
    for(const method of order) {
      const result=await runColdEpisodeV6({episodeId:config.id,nominalScenario,events,method,callBudgets:protocol.callBudgets},{hardWallMs:protocol.budget.hardWallMs});
      policies[method]=result;if(result.terminalAudit)audits[method]=result.terminalAudit;
      console.log(`${config.dataRole==='development-control'?'development':'primary'} ${config.id} ${method}: ${result.status}; complete=${result.complete}; historyUnknown=${result.executionHistoryUnavailable}; total=${result.totalCost}; calls=${result.plannerStats?.decisionCalls}`);
    }
    return {...config,nominalScenario,events,scenario:realizeCapacityEvents(nominalScenario,events),methodExecutionOrder:order,policies,audits,
      initialComparison:compareInitialPlansV6(nominalScenario,policies)};
  };
  for(const [index,config]of protocol.primaryCases.entries()){output.cases.push(await runCase({...config,dataRole:'held-out-primary'},index));await save();}
  const controls=await loadDevelopmentInputsV6(protocol);
  for(const [index,config]of controls.entries()){output.developmentControls.cases.push(await runCase(config,protocol.primaryCases.length+index));await save();}
  output.executionState='complete';await save();console.log(JSON.stringify({primary:output.summary,development:output.developmentControls.summary},null,2));
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
