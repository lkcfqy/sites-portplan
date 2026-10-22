import {readFile,writeFile,mkdir,access,readdir,copyFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fork} from 'node:child_process';
import {cpus,totalmem,platform,release,arch} from 'node:os';
import {resolve,dirname,relative,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {METHODS_V12,unknownEpisodeV12} from './episode-v12.worker.mjs';
import {isCompleteV7,validateCompleteReceiptV7,realizeDeclaredShocksV7} from './rolling-benchmark-v7.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const WORKER=fileURLToPath(new URL('./episode-v12.worker.mjs',import.meta.url));
const FEE_FIELDS=['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost','lateCount'];
const EPS=1e-6;
const acceptedLifecycleV12=result=>Boolean(result?.terminalReceiptAcceptedAsHistory===true&&result.endToEndCompletedWithinBudget===true
  &&result.episodeCompletedWithinBudget===true&&result.outputDeliveredWithinBudget===true&&result.terminalReceiptWithinBudget===true
  &&result.deadlineReached===false&&result.normalWorkerExit===true&&result.exitCode===0&&result.exitSignal===null
  &&result.processGroupCleanup?.successful===true&&result.processGroupCleanup.verifiedProcessGroupGone===true
  &&result.processGroupCleanup.verificationResult==='ESRCH'&&Number.isFinite(result.hardWallMs)
  &&[result.wallTimeMs,result.endToEndWallTimeMs,result.receiptValidatedMs,result.processGroupCleanup.finishedAtMs].every(value=>Number.isFinite(value)&&value<=result.hardWallMs));
export const isCompleteV12=result=>acceptedLifecycleV12(result)&&(result?.scalarReceipt===true?
  Boolean(result.complete===true&&result.auditValid===true&&['feasible','optimal'].includes(result.status)
    &&result.terminalRowCount>0&&result.artifact?.path&&Number.isFinite(result.totalCost)&&Number.isFinite(result.incrementalCost)):isCompleteV7(result));
export const validateCompleteReceiptV12=validateCompleteReceiptV7;
export {METHODS_V12};
export const sha256=value=>createHash('sha256').update(value).digest('hex');

/** Parent clock includes process launch/imports, native ready, all decisions,
 * dual audits, child cleanup, terminal IPC and this parent's receipt validation.
 * Detached POSIX process groups contain Python as well as the Node worker. */
export function runColdEpisodeV12(input,{hardWallMs=5000,workerScript=WORKER}={}){
  if(!Number.isFinite(hardWallMs)||hardWallMs<=0)throw new Error('hardWallMs must be positive and finite.');
  return new Promise(resolveResult=>{
    const started=performance.now(),episodeId=input.episodeId??input.nominalScenario?.id,method=input.method;
    const grouped=process.platform!=='win32';
    let child,final=null,finalMessage=null,finalReceivedMs=null,receiptValidatedMs=null,actualCutoffMs=null,deadlineReached=false,stderr='',rejectedTerminalCount=0,rejectedTerminalErrors=[];
    let processExitWallTimeMs=null,processCloseWallTimeMs=null,finished=false,finishing=false,timer,fallbackTimer;
    const unacceptedTerminalReceipts=[];
    const cleanupAttempts=[];let killSignalSent=false;
    const killGroup=reason=>{
      const attempt={reason,atMs:performance.now()-started,attempted:Boolean(child?.pid),signal:'SIGKILL',sent:false,error:null};
      try{if(grouped&&child?.pid)process.kill(-child.pid,'SIGKILL');else if(child?.pid)child.kill('SIGKILL');else throw Object.assign(new Error('No worker pid.'),{code:'NO_PID'});attempt.sent=true;killSignalSent=true;}
      catch(error){attempt.error=error.code??String(error);if(error.code!=='ESRCH')stderr=(stderr+' '+String(error)).slice(-4000);}
      cleanupAttempts.push(attempt);
    };
    const keepRejected=(message,receivedMs,reason,errors=[],validatedMs=null)=>unacceptedTerminalReceipts.push({parentReceivedMs:receivedMs,
      receiptValidatedMs:validatedMs,reason,errors:structuredClone(errors),message:structuredClone(message),
      interpretation:'Unaccepted raw terminal evidence; not an accepted physical execution history or a complete fee receipt.'});
    const finish=async(code,signal)=>{
      if(finished||finishing)return;finishing=true;
      const cleanupStartedMs=performance.now()-started;
      killGroup(deadlineReached?'hard_deadline_final_cleanup':'normal_terminal_cleanup');
      let groupGone=false,verificationError=null,verificationResult=null,verificationAtMs=null;
      if(!grouped||!child?.pid)verificationError=grouped?'NO_PID':'PROCESS_GROUP_VERIFICATION_UNSUPPORTED';
      else for(let attempt=0;attempt<10;attempt++){
        try{process.kill(-child.pid,0);}
        catch(error){verificationAtMs=performance.now()-started;if(error.code==='ESRCH'){groupGone=true;verificationResult='ESRCH';}else verificationError=error.code??String(error);break;}
        await new Promise(done=>setTimeout(done,5));
      }
      if(!groupGone&&verificationError===null)verificationError='PROCESS_GROUP_STILL_EXISTS';
      const processGroupCleanup={mode:grouped?'posix-process-group':'worker-only',attempted:true,killSignalSent,attempts:cleanupAttempts,
        startedAtMs:cleanupStartedMs,finishedAtMs:performance.now()-started,verifiedProcessGroupGone:groupGone,verificationResult,verificationAtMs,
        verificationError,successful:groupGone&&verificationResult==='ESRCH'&&verificationError===null};
      const normalWorkerExit=code===0&&signal===null&&processExitWallTimeMs!==null&&processCloseWallTimeMs!==null;
      // Copy/normalize provisional history before taking the final host-gate
      // timestamp. No worker-owned completion flag authorizes acceptance.
      let result=final?structuredClone(final):null;
      if(result&&!result.complete){result.rows=[];result.usage=[];for(const key of FEE_FIELDS)result[key]=null;}
      let initializationEvidence=initializationEvidenceV12(result);
      let wallTimeMs=performance.now()-started;
      if(wallTimeMs>hardWallMs)deadlineReached=true;
      const accepted=Boolean(final&&!deadlineReached&&normalWorkerExit&&processGroupCleanup.successful&&wallTimeMs<=hardWallMs);
      if(!accepted){
        const reason=deadlineReached?'terminal_lifecycle_exceeded_parent_deadline':!normalWorkerExit?'worker_exit_not_clean':'process_group_cleanup_unverified';
        if(final)keepRejected(finalMessage,finalReceivedMs,reason,[],receiptValidatedMs);
        result=unknownEpisodeV12(method,deadlineReached?
          'The whole cold episode, normal worker exit and verified process-group cleanup did not finish within the common parent budget. History/counters are unavailable.':
          `No valid terminal receipt with normal worker exit and verified process-group cleanup (${code}, ${signal}). ${stderr}`,deadlineReached?'hard_time_limit':'worker_error');
        initializationEvidence=initializationEvidenceV12(result);
        // Failed output still reports its actual elapsed time, including raw
        // receipt retention; an unknown cutoff is never capped at the budget.
        wallTimeMs=performance.now()-started;
        if(wallTimeMs>hardWallMs)deadlineReached=true;
      }
      finished=true;clearTimeout(timer);clearTimeout(fallbackTimer);
      resolveResult({...result,policy:method,initializationEvidence,hardWallMs,wallTimeMs,endToEndWallTimeMs:wallTimeMs,actualCutoffMs,
        processExitWallTimeMs,processCloseWallTimeMs,cleanupFinishedMs:processGroupCleanup.finishedAtMs,finalReceivedMs,receiptValidatedMs,
        rejectedTerminalCount,rejectedTerminalErrors,unacceptedTerminalReceipts,deadlineReached,normalWorkerExit,
        terminalReceiptWithinBudget:Boolean(final),outputDeliveredWithinBudget:Boolean(final),terminalReceiptAcceptedAsHistory:accepted,
        episodeCompletedWithinBudget:accepted&&isCompleteV7(result),endToEndCompletedWithinBudget:accepted,
        processGroupCleanup,exitCode:code,exitSignal:signal,stderr:stderr||null});
    };
    try{child=fork(workerScript,[],{stdio:['ignore','ignore','pipe','ipc'],serialization:'advanced',detached:grouped,
      env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1',NUMEXPR_NUM_THREADS:'1'}});}
    catch(error){stderr=String(error.stack??error);void finish(null,null);return;}
    child.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-4000);});
    const reachDeadline=()=>{
      // Node may round timer delays down: do not hard-kill before the boundary.
      const elapsed=performance.now()-started;
      if(elapsed<hardWallMs){timer=setTimeout(reachDeadline,Math.max(1,Math.ceil(hardWallMs-elapsed)));return;}
      actualCutoffMs=elapsed;deadlineReached=true;killGroup('hard_deadline_signal');
      fallbackTimer=setTimeout(()=>void finish(child.exitCode,child.signalCode??null),250);
    };
    timer=setTimeout(reachDeadline,Math.max(1,Math.ceil(hardWallMs-(performance.now()-started))));
    child.on('message',message=>{
      if(finishing||finished)return;
      const elapsed=performance.now()-started;
      if(message?.type!=='final')return;
      const reject=(reason,errors=[],validatedMs=null)=>keepRejected(message,elapsed,reason,errors,validatedMs);
      if(message.method!==method||message.episodeId!==episodeId){reject('terminal_identity_mismatch');return;}
      if(final){reject('duplicate_terminal_receipt');return;}
      if(deadlineReached||elapsed>hardWallMs){reject('terminal_received_after_parent_deadline');return;}
      const result=message.result;
      if(!result||typeof result.status!=='string'||typeof result.complete!=='boolean'){reject('malformed_terminal_receipt');return;}
      if(result.complete){
        const errors=validateCompleteReceiptV12(input,result);
        if(errors.length){rejectedTerminalCount++;rejectedTerminalErrors=errors.slice(0,20);reject('terminal_audit_rejected',errors,performance.now()-started);return;}
      }
      const validated=performance.now()-started;
      if(validated>hardWallMs){reject('terminal_audit_completed_after_parent_deadline',[],validated);return;}
      final=result;finalMessage=message;finalReceivedMs=elapsed;receiptValidatedMs=validated;
    });
    child.on('error',error=>{stderr=(stderr+' '+String(error)).slice(-4000);});
    child.once('exit',()=>{processExitWallTimeMs=performance.now()-started;});
    child.once('close',(code,signal)=>{processCloseWallTimeMs=performance.now()-started;void finish(code,signal);});
    child.send({...input,episodeId},error=>{if(error){stderr=(stderr+' '+String(error)).slice(-4000);killGroup('ipc_send_failed');}});
  });
}

export async function assertNewOutputV12(path){
  try{await access(path);}catch(error){if(error.code==='ENOENT')return;throw error;}
  throw new Error('Output already exists; preserve the first run and choose a new path.');
}

/** Pure metadata expansion; never invokes the synthetic order generator. */
export function enumerateCasesV12(protocol){
  const cases=[],ids=new Set(),seeds=new Set();
  for(const panel of protocol.panels){
    let index=0;
    for(const mechanism of protocol.matrix.mechanisms)for(const capacityProfile of protocol.matrix.capacityProfiles)
      for(const count of protocol.matrix.counts)for(let repeat=1;repeat<=protocol.matrix.scenariosPerCell;repeat++){
        const pattern=panel.shockPatterns[(repeat-1)%panel.shockPatterns.length];
        const config={id:`v12-${panel.id}-${mechanism}-${capacityProfile}-n${count}-r${repeat}`,panel:panel.id,dataRole:'held-out',
          mechanism,capacityProfile,count,scenarioRepeat:repeat,seed:panel.baseSeed+index++,shockPattern:pattern.name,shocks:structuredClone(pattern.shocks)};
        if(ids.has(config.id)||seeds.has(config.seed))throw new Error('V12 scenario identifiers and generator seeds must be unique across panels.');
        ids.add(config.id);seeds.add(config.seed);cases.push(config);
      }
    if(index!==panel.scenarioCount)throw new Error('Declared panel scenario count differs from its matrix.');
  }
  return cases;
}

export const FIXED_CALL_BUDGETS_V12={"costPolishV7":{"timeLimitSeconds":0.2,"timeBudgetMs":200,"constructorShare":0.4,"auditReserveMs":5,"maxRestarts":15,"retainFeasible":true,"maxPasses":2,"maxPairs":32,"candidateCap":12,"maxPairChecks":384,"maxSingleTargets":16},"adaptiveV9":{"timeLimitSeconds":0.2,"timeBudgetMs":200,"constructorShare":0.4,"auditReserveMs":5,"maxRestarts":15,"retainFeasible":true,"maxPasses":2,"maxPairs":32,"candidateCap":12,"maxPairChecks":384,"maxSingleTargets":16,"feeToleranceRatio":0.005,"maxChangedEvents":6,"lookaheadDays":2,"pressureGuard":true,"opportunityThresholdKRW":0},"highsV8":{"timeBudgetMs":200,"timeLimitSeconds":0.2,"objectiveMode":"joint","auditReserveMs":2,"hardOverrunGraceMs":250,"initializationTimeoutMs":10000,"retainCacheFallback":true},"stableHiGHSV10":{"timeBudgetMs":200,"timeLimitSeconds":0.2,"objectiveMode":"joint","auditReserveMs":2,"hardOverrunGraceMs":250,"initializationTimeoutMs":10000,"retainCacheFallback":true},"commitmentHiGHSV11":{"timeBudgetMs":200,"timeLimitSeconds":0.2,"objectiveMode":"joint","auditReserveMs":2,"hardOverrunGraceMs":250,"initializationTimeoutMs":10000,"retainCacheFallback":true},"seededHiGHSV12":{"timeBudgetMs":200,"timeLimitSeconds":0.2,"objectiveMode":"joint","auditReserveMs":2,"hardOverrunGraceMs":250,"initializationTimeoutMs":10000,"retainCacheFallback":true,"constructorBudgetMs":40,"constructorAuditReserveMs":5,"maxRestarts":3}};
export const FIXED_MATRIX_V12={"mechanisms":["aged-backlog","new-arrivals","batch-release"],"capacityProfiles":["balanced","tight"],"counts":[24,50,100],"scenariosPerCell":4};
export const FIXED_COMPARISONS_V12={"v12VsV11":["commitmentHiGHSV11","seededHiGHSV12"],"v12VsV10":["stableHiGHSV10","seededHiGHSV12"],"v12VsV9":["adaptiveV9","seededHiGHSV12"],"v12VsHiGHS":["highsV8","seededHiGHSV12"],"v12VsV7":["costPolishV7","seededHiGHSV12"],"v11VsV10":["stableHiGHSV10","commitmentHiGHSV11"],"v10VsHiGHS":["highsV8","stableHiGHSV10"],"highsVsV7":["costPolishV7","highsV8"]};
export const FIXED_PARENT_ACCEPTANCE_V12={normalWorkerExitRequired:true,confirmedProcessGroupGoneRequired:true,processGroupVerificationResult:'ESRCH',cleanupWithinHardWallRequired:true,endToEndWithinHardWallRequired:true,timelyFinalAloneIsCompletion:false};
const FIXED_REPEATS_V12=[{index:1,seed:69011},{index:2,seed:69023},{index:3,seed:69039}];
const canonicalJSONV12=value=>JSON.stringify(value&&typeof value==='object'?Array.isArray(value)?value.map(v=>JSON.parse(canonicalJSONV12(v))):Object.fromEntries(Object.keys(value).sort().map(k=>[k,JSON.parse(canonicalJSONV12(value[k]))])):value);
export function collectDeclaredSeedsV12(value,key='',seeds=new Set()){
  if(value&&typeof value==='object'&&!Array.isArray(value)){
    if(Number.isInteger(value.baseSeed)&&Number.isInteger(value.scenarioCount))for(let i=0;i<value.scenarioCount;i++)seeds.add(value.baseSeed+i);
    if(Number.isInteger(value.seedBase)&&Number.isInteger(value.caseCount))for(let i=0;i<value.caseCount;i++)seeds.add(value.seedBase+i);
    for(const [name,item]of Object.entries(value))collectDeclaredSeedsV12(item,name,seeds);
  }else if(Array.isArray(value))for(const item of value)collectDeclaredSeedsV12(item,key,seeds);
  else if(Number.isInteger(value)&&/seed/i.test(key))seeds.add(value);
  return seeds;
}
export async function verifyHistoricalSeedExclusionsV12(protocol){
  const declared=protocol.historicalSeedExclusions,seeds=new Set(),seen=new Set();
  if(!Array.isArray(declared?.sources)||!declared.sources.length)throw new Error('Missing historical protocol seed bindings.');
  for(const source of declared.sources){
    if(!(source.path==='data/benchmark.json'||/^data\/[A-Za-z0-9_-]*protocol[A-Za-z0-9_-]*\.json$/.test(source.path))||source.path==='data/protocol-v12.json'||seen.has(source.path))throw new Error('Unsafe/duplicate historical protocol reference.');
    seen.add(source.path);const raw=await readFile(join(ROOT,source.path));
    if(sha256(raw)!==source.sha256)throw new Error('Historical protocol hash differs: '+source.path);
    for(const seed of collectDeclaredSeedsV12(JSON.parse(raw)))seeds.add(seed);
  }
  if(canonicalJSONV12([...seeds].sort((a,b)=>a-b))!==canonicalJSONV12(declared.excludedSeeds))throw new Error('Historical seed exclusion declaration differs.');
  return {protocolCount:[...seen].filter(path=>path.includes('protocol')).length,metadataSourceCount:seen.size,excludedSeedCount:seeds.size};
}
export function validateProtocolV12(protocol){
  if(protocol.schemaVersion!=='portplan-protocol-v12'||canonicalJSONV12(protocol.methods)!==canonicalJSONV12(METHODS_V12))throw new Error('Protocol must declare the six fixed allowed methods.');
  if(!['draft-development-not-ready','ready-for-source-freeze'].includes(protocol.executionAuthorization?.status))throw new Error('Explicit draft/development-ready state required.');
  if(protocol.budget.hardWallMs!==5000||protocol.budget.cpuThreads!==1)throw new Error('V12 retains the 5000ms parent budget and one native thread.');
  if(canonicalJSONV12(protocol.budget.parentAcceptance)!==canonicalJSONV12(FIXED_PARENT_ACCEPTANCE_V12))throw new Error('V12 requires normal worker exit and ESRCH-confirmed process-group cleanup within the same hard budget.');
  if(canonicalJSONV12(protocol.algorithmRepeats)!==canonicalJSONV12(FIXED_REPEATS_V12))throw new Error('V12 repeat seeds must remain 69011/69023/69039.');
  for(const method of METHODS_V12){
    const budget=protocol.callBudgets?.[method];
    if(!budget||budget.timeLimitSeconds!==.2||budget.timeBudgetMs!==200)throw new Error('All V12 methods retain the fixed 200ms daily budgets.');
    if(Object.hasOwn(budget,'onIncumbent'))throw new Error('Formal diagnostic observers are forbidden.');
  }
  if(canonicalJSONV12(protocol.callBudgets)!==canonicalJSONV12(FIXED_CALL_BUDGETS_V12))throw new Error('Baseline budgets and declared V12 parameters must remain unchanged.');
  if(canonicalJSONV12(protocol.matrix)!==canonicalJSONV12(FIXED_MATRIX_V12))throw new Error('V12 retains the fixed 144-case matrix.');
  if(canonicalJSONV12(protocol.analysis.comparisons)!==canonicalJSONV12(FIXED_COMPARISONS_V12))throw new Error('V12 comparison pairs are prespecified.');
  if(protocol.panels[0]?.id!=='same-distribution'||protocol.panels[0]?.baseSeed!==691001||protocol.panels[1]?.id!=='stress'||protocol.panels[1]?.baseSeed!==692001)throw new Error('V12 unseen business seed commitments must remain 691001/692001.');
  if(protocol.nativeSelectionRule?.fixedNumericalEpsilon!==1e-6)throw new Error('Native numerical epsilon remains fixed.');
  if(protocol.analysis.bootstrap.seed!==700001||protocol.analysis.bootstrap.draws!==2000)throw new Error('V12 bootstrap remains fixed at 2000 draws, seed 700001.');
  const cases=enumerateCasesV12(protocol),excluded=protocol.historicalSeedExclusions?.excludedSeeds;
  if(!Array.isArray(excluded)||new Set(excluded).size!==excluded.length||!excluded.every(Number.isInteger))throw new Error('Explicit unique historical seed exclusions required.');
  if(cases.some(c=>excluded.includes(c.seed))||protocol.algorithmRepeats.some(r=>excluded.includes(r.seed)))throw new Error('V12 commitments overlap prior declared seeds.');
  if(cases.length!==144||protocol.panels.length!==2||protocol.panels.some(panel=>panel.scenarioCount!==72))throw new Error('V12 requires two separate 72-scenario panels.');
  for(const c of cases)for(const shock of c.shocks)if(Object.hasOwn(shock,'announcedDuration'))throw new Error('No private future recovery duration may be announced.');
  return protocol;
}
export function assertReadyForFreezeV12(protocol){
  if(protocol.executionAuthorization?.status!=='ready-for-source-freeze')throw new Error('V12 is still draft: root must finish development/review and finalize the declaration before freeze or prospective execution.');
}

export function executionOrderV12(scenarioIndex,repeatIndex){
  const start=(scenarioIndex+repeatIndex)%METHODS_V12.length;
  return METHODS_V12.map((_,offset)=>METHODS_V12[(start+offset)%METHODS_V12.length]);
}

const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const sum=values=>values.reduce((total,value)=>total+value,0);
const classification=value=>value>EPS?'win':value< -EPS?'loss':'tie';
function quantile(sorted,p){if(!sorted.length)return null;const x=(sorted.length-1)*p,low=Math.floor(x);return sorted[low]+(sorted[Math.ceil(x)]-sorted[low])*(x-low);}
/** Cluster bootstrap: each draw resamples whole business scenarios, retaining
 * every predeclared repeat together. Three runs are not three new scenarios. */
export function pairedBootstrapV12(units,{seed=700001,draws=2000}={}){
  if(!units.length)return {unit:'scenario',scenarioCount:0,draws,meanSavings95CI:null,weightedSavingsPct95CI:null};
  let state=seed>>>0;const draw=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const means=[],percentages=[];
  for(let d=0;d<draws;d++){
    let b=0,c=0;
    for(let i=0;i<units.length;i++){const u=units[Math.floor(draw()*units.length)];b+=u.baseline;c+=u.candidate;}
    means.push((b-c)/units.length);if(b!==0)percentages.push(100*(b-c)/b);
  }
  means.sort((a,b)=>a-b);percentages.sort((a,b)=>a-b);
  return {unit:'scenario',scenarioCount:units.length,draws,meanSavings95CI:[quantile(means,.025),quantile(means,.975)],
    weightedSavingsPct95CI:percentages.length?[quantile(percentages,.025),quantile(percentages,.975)]:null,
    interpretation:'Percentile scenario-cluster bootstrap; conditional fee sample is the pairwise jointly completed set, not a missing-at-random estimate.'};
}

function compareMethods(cases,baseline,candidate,bootstrap){
  const units=[],allPairs=[],completionUnits=[];let gained=0,lost=0;
  const gainIds=[],lossIds=[],knownFailureGainIds=[],unknownHistoryGainIds=[];
  for(const c of cases){
    const repeatPairs=[],differences=[];
    for(const repetition of c.repeats){
      const b=repetition.policies[baseline],a=repetition.policies[candidate],bc=isCompleteV12(b),ac=isCompleteV12(a);
      differences.push(Number(ac)-Number(bc));
      const pairId=`${c.id}::repeat-${repetition.repeatIndex}`;
      if(ac&&!bc){gained++;gainIds.push(pairId);(b?.executionHistoryUnavailable?unknownHistoryGainIds:knownFailureGainIds).push(pairId);}
      if(bc&&!ac){lost++;lossIds.push(pairId);}
      if(bc&&ac){const pair={scenarioId:c.id,pairId,baseline:b,candidate:a};repeatPairs.push(pair);allPairs.push(pair);}
    }
    completionUnits.push({baseline:0,candidate:mean(differences)});
    if(repeatPairs.length){
      units.push({scenarioId:c.id,pairedRepeatCount:repeatPairs.length,
        total:{baseline:mean(repeatPairs.map(p=>p.baseline.totalCost)),candidate:mean(repeatPairs.map(p=>p.candidate.totalCost))},
        incremental:{baseline:mean(repeatPairs.map(p=>p.baseline.incrementalCost)),candidate:mean(repeatPairs.map(p=>p.candidate.incrementalCost))}});
    }
  }
  const fees={};
  for(const [name,key]of [['total','totalCost'],['incremental','incrementalCost']]){
    const b=sum(units.map(u=>u[name].baseline)),a=sum(units.map(u=>u[name].candidate));
    const counts={win:0,tie:0,loss:0};for(const u of units)counts[classification(u[name].baseline-u[name].candidate)]++;
    fees[name]={pairedScenarioCount:units.length,pairedEpisodeCount:allPairs.length,baselineScenarioMeanSumKRW:b,candidateScenarioMeanSumKRW:a,
      scenarioWeightedSavingsKRW:b-a,weightedSavingsPct:b===0?null:100*(b-a)/b,scenarioWinTieLoss:counts,
      baselineEpisodeSumKRW:sum(allPairs.map(p=>p.baseline[key])),candidateEpisodeSumKRW:sum(allPairs.map(p=>p.candidate[key])),
      zeroBaselineScenarioCount:units.filter(u=>u[name].baseline===0).length,zeroBaselineEpisodeCount:allPairs.filter(p=>p.baseline[key]===0).length,
      worstScenarioLossKRW:Math.max(0,...units.map(u=>u[name].candidate-u[name].baseline)),
      negativeScenarioIds:units.filter(u=>u[name].candidate-u[name].baseline>EPS).map(u=>u.scenarioId),
      negativeEpisodeIds:allPairs.filter(p=>p.candidate[key]-p.baseline[key]>EPS).map(p=>p.pairId),
      uncertainty:pairedBootstrapV12(units.map(u=>u[name]),bootstrap)};
  }
  const revisions=allPairs.filter(p=>Number.isFinite(p.baseline.revisionCount)&&Number.isFinite(p.candidate.revisionCount));
  return {baselineMethod:baseline,candidateMethod:candidate,scenarioCount:cases.length,episodePairCount:sum(cases.map(c=>c.repeats.length)),
    completion:{gainedEpisodeCount:gained,lostEpisodeCount:lost,gainedEpisodeIds:gainIds,lostEpisodeIds:lossIds,
      gainedFromKnownFailureEpisodeIds:knownFailureGainIds,gainedFromUnknownHistoryEpisodeIds:unknownHistoryGainIds,
      meanScenarioRateGain:mean(completionUnits.map(u=>u.candidate)),
      uncertainty:{unit:'scenario completion-rate difference',
        meanScenarioRateGain95CI:pairedBootstrapV12(completionUnits.map(u=>({baseline:0,candidate:-u.candidate})),bootstrap).meanSavings95CI},
      interpretation:'Timely complete audited receipts; an unavailable history is not proof of physical execution failure.'},
    fees,revisions:{pairedEpisodeCount:revisions.length,baselineObservedSum:sum(revisions.map(p=>p.baseline.revisionCount)),candidateObservedSum:sum(revisions.map(p=>p.candidate.revisionCount))},
    pairedScenarios:units.map(u=>({scenarioId:u.scenarioId,pairedRepeatCount:u.pairedRepeatCount,totalSavingsKRW:u.total.baseline-u.total.candidate,
      incrementalSavingsKRW:u.incremental.baseline-u.incremental.candidate})),
    interpretation:'Each scenario has equal weight after averaging matching jointly completed repeats. Each comparison has its own eligibility set; do not rank methods across denominators.'};
}

/** One eligibility set for all six methods. Do not mix these denominators
 * with pairwise tables or convert event revisions into invented fee weights. */
export function jointCompleteParetoV12(cases,fullSampleByMethod={}){
  const scenarios=[],allPairs=[];
  for(const c of cases){
    const repeats=c.repeats.filter(r=>METHODS_V12.every(method=>isCompleteV12(r.policies[method])));
    if(!repeats.length)continue;
    allPairs.push(...repeats);
    scenarios.push({scenarioId:c.id,pairedRepeatCount:repeats.length,byMethod:Object.fromEntries(METHODS_V12.map(method=>{
      const values=repeats.map(r=>r.policies[method]),known=values.every(r=>Number.isFinite(r.revisionCount));
      return [method,{totalCost:mean(values.map(r=>r.totalCost)),incrementalCost:mean(values.map(r=>r.incrementalCost)),
        revisionCount:known?mean(values.map(r=>r.revisionCount)):null}];
    }))});
  }
  const byMethod=Object.fromEntries(METHODS_V12.map(method=>{
    const values=allPairs.map(r=>r.policies[method]),known=values.filter(r=>Number.isFinite(r.revisionCount)),has=scenarios.length>0,allKnown=has&&known.length===values.length;
    return [method,{scenarioCount:scenarios.length,jointEpisodeCount:allPairs.length,
      scenarioMeanTotalCostSumKRW:has?sum(scenarios.map(s=>s.byMethod[method].totalCost)):null,
      scenarioMeanIncrementalCostSumKRW:has?sum(scenarios.map(s=>s.byMethod[method].incrementalCost)):null,
      scenarioMeanRevisionCountSum:allKnown?sum(scenarios.map(s=>s.byMethod[method].revisionCount)):null,
      episodeTotalCostSumKRW:has?sum(values.map(r=>r.totalCost)):null,episodeIncrementalCostSumKRW:has?sum(values.map(r=>r.incrementalCost)):null,
      episodeRevisionCountSum:allKnown?sum(known.map(r=>r.revisionCount)):null,knownRevisionEpisodeCount:known.length,unknownRevisionEpisodeCount:values.length-known.length,
      fullSampleCompleteEpisodeCount:fullSampleByMethod[method]?.completeEpisodeCount??cases.reduce((n,c)=>n+c.repeats.filter(r=>isCompleteV12(r.policies[method])).length,0),
      fullSampleEpisodeCount:fullSampleByMethod[method]?.recordedEpisodeCount??cases.reduce((n,c)=>n+c.repeats.filter(r=>r.policies[method]).length,0)}];
  }));
  const frontier=feeKey=>METHODS_V12.map(method=>{
    const current=byMethod[method],comparable=scenarios.length>0&&Number.isFinite(current[feeKey])&&Number.isFinite(current.scenarioMeanRevisionCountSum);
    const dominates=(left,right)=>Number.isFinite(left[feeKey])&&Number.isFinite(left.scenarioMeanRevisionCountSum)
      &&Number.isFinite(right[feeKey])&&Number.isFinite(right.scenarioMeanRevisionCountSum)
      &&left[feeKey]<=right[feeKey]+EPS&&left.scenarioMeanRevisionCountSum<=right.scenarioMeanRevisionCountSum+EPS
      &&(left[feeKey]<right[feeKey]-EPS||left.scenarioMeanRevisionCountSum<right.scenarioMeanRevisionCountSum-EPS);
    const worse=comparable?METHODS_V12.filter(other=>other!==method&&dominates(current,byMethod[other])):[];
    const better=comparable?METHODS_V12.filter(other=>other!==method&&dominates(byMethod[other],current)):[];
    return {method,dominates:worse,dominatedBy:better,pareto:comparable?better.length===0:null};
  });
  return {jointScenarioCount:scenarios.length,jointEpisodeCount:allPairs.length,eligibility:'all-six-matching-complete-repeats',byMethod,
    frontiers:{totalAndRevisions:frontier('scenarioMeanTotalCostSumKRW'),incrementalAndRevisions:frontier('scenarioMeanIncrementalCostSumKRW')},scenarios,
    scope:'Conditional all-six jointly completed matching repeats; average within scenario then equal scenario weight. No revision-to-KRW conversion. This table never overrides full-sample completion losses or establishes universal dominance.'};
}

/** Prespecified necessary observation gates, never a production recommendation. */
export function observedDecisionGatesV12(comparisons,{completePanel=false}={}){
  const names={commitmentHiGHSV11:'v12VsV11',stableHiGHSV10:'v12VsV10',adaptiveV9:'v12VsV9',highsV8:'v12VsHiGHS',costPolishV7:'v12VsV7'};
  const completionLossCountsByBaseline=Object.fromEntries(Object.entries(names).map(([method,key])=>[method,comparisons[key].completion.lostEpisodeCount]));
  const completionGainCountsByBaseline=Object.fromEntries(Object.entries(names).map(([method,key])=>[method,comparisons[key].completion.gainedEpisodeCount]));
  const completionNonRegressionAllBaselines=Object.values(completionLossCountsByBaseline).every(count=>count===0);
  const nativeComparisons={};
  for(const method of ['commitmentHiGHSV11','stableHiGHSV10','highsV8']){
    const pair=comparisons[names[method]],revision=pair.revisions,feeCount=pair.fees.incremental.pairedEpisodeCount;
    const known=feeCount>0&&revision.pairedEpisodeCount===feeCount;
    const revisionDelta=known?revision.candidateObservedSum-revision.baselineObservedSum:null;
    const claim=fee=>{const ci=fee.uncertainty.weightedSavingsPct95CI;return !ci||ci.some(v=>!Number.isFinite(v))?'unavailable':ci[0]>0?'conditional_savings_interval_positive':ci[1]<0?'conditional_deterioration_interval_negative':'no_stable_advantage';};
    const incrementalFeeClaim=claim(pair.fees.incremental),totalFeeClaim=claim(pair.fees.total);
    const noRobustFeeDeterioration=[incrementalFeeClaim,totalFeeClaim].every(value=>value!=='unavailable'&&value!=='conditional_deterioration_interval_negative');
    const strictRevisionReduction=known&&revisionDelta<0;
    nativeComparisons[method]={lostEpisodeCount:pair.completion.lostEpisodeCount,revisionPairedEpisodeCount:revision.pairedEpisodeCount,
      revisionDelta,strictRevisionReduction,incrementalFeeClaim,totalFeeClaim,noRobustFeeDeterioration,
      stabilityImprovementClaimAllowed:completePanel&&pair.completion.lostEpisodeCount===0&&strictRevisionReduction&&noRobustFeeDeterioration};
  }
  return {candidateMethod:'seededHiGHSV12',assessmentState:completePanel?'complete-panel':'partial-panel',completionLossCountsByBaseline,
    completionGainCountsByBaseline,completionNonRegressionAllBaselines,defaultRecommendationEligible:completePanel&&completionNonRegressionAllBaselines,
    nativeComparison:nativeComparisons.highsV8,nativeComparisons,
    scope:'Observed necessary gates against the five included comparators only. Any full-sample completion loss blocks default eligibility; net gains and conditional fees/Pareto position do not offset losses. Native stability claims use each exact native paired set; zero-inclusive fee intervals do not prove stable savings. No claim against omitted V5 or universal/production recommendation.'};
}

export function summarizePanelV12(cases,{bootstrap={}}={}){
  const byMethod={};
  for(const method of METHODS_V12){
    const results=cases.flatMap(c=>c.repeats.map(r=>r.policies[method])).filter(Boolean),statuses={};for(const r of results)statuses[r.status]=(statuses[r.status]??0)+1;
    const values=key=>results.map(r=>r[key]).filter(Number.isFinite);
    const initialization=results.map(result=>result.initializationEvidence??initializationEvidenceV12(result));
    byMethod[method]={scenarioCount:cases.length,recordedEpisodeCount:results.length,completeEpisodeCount:results.filter(isCompleteV12).length,
      initialization:{knownDayZeroCount:initialization.filter(entry=>entry.initialPlanAccepted!==null).length,
        acceptedInitialPlanCount:initialization.filter(entry=>entry.initialPlanAccepted===true).length,
        knownInitialFailureCount:initialization.filter(entry=>entry.failurePhase==='initialization').length,
        knownLaterFailureCount:initialization.filter(entry=>entry.failurePhase==='after_initialization').length,
        unknownDayZeroCount:initialization.filter(entry=>entry.initialPlanAccepted===null).length},
      fullyCompletedScenarioCount:cases.filter(c=>c.repeats.length===3&&c.repeats.every(r=>isCompleteV12(r.policies[method]))).length,
      anyCompletedScenarioCount:cases.filter(c=>c.repeats.some(r=>isCompleteV12(r.policies[method]))).length,
      meanScenarioCompletionRate:mean(cases.map(c=>mean(c.repeats.map(r=>Number(isCompleteV12(r.policies[method])))))),
      executionHistoryUnavailableCount:results.filter(r=>r.executionHistoryUnavailable===true).length,
      auditFailureCount:results.filter(r=>r.status==='audit_failed'||r.rejectedTerminalCount>0).length,
      hardDeadlineCount:results.filter(r=>r.deadlineReached).length,statuses,
      wallTimeMs:{observedCount:values('wallTimeMs').length,mean:mean(values('wallTimeMs')),max:values('wallTimeMs').length?Math.max(...values('wallTimeMs')):null},
      revisionCount:{knownEpisodeCount:values('revisionCount').length,unknownEpisodeCount:results.length-values('revisionCount').length,observedSum:sum(values('revisionCount'))},
      counters:Object.fromEntries(['decisionCalls','solverCalls','constructorCalls','reusedPlans','planningWallMs'].map(key=>{
        const known=results.map(r=>r.plannerStats?.[key]).filter(Number.isFinite);
        return [key,{knownEpisodeCount:known.length,unknownEpisodeCount:results.length-known.length,observedSum:sum(known)}];
      }))};
  }
  const comparisons=Object.fromEntries(Object.entries(FIXED_COMPARISONS_V12).map(([key,[baseline,candidate]])=>[key,compareMethods(cases,baseline,candidate,bootstrap)]));
  const jointCompletePareto=jointCompleteParetoV12(cases,byMethod);
  const allMethodCommonComplete={scenarioCount:jointCompletePareto.jointScenarioCount,episodeCount:jointCompletePareto.jointEpisodeCount,
    byMethod:Object.fromEntries(METHODS_V12.map(method=>{const row=jointCompletePareto.byMethod[method];return [method,{
      totalScenarioMeanSumKRW:row.scenarioMeanTotalCostSumKRW,incrementalScenarioMeanSumKRW:row.scenarioMeanIncrementalCostSumKRW,
      revisionObservedSum:row.episodeRevisionCountSum}];})),scope:jointCompletePareto.scope+' Thin-table revisionObservedSum is the raw matched-episode count; frontier revision axis uses scenarioMeanRevisionCountSum instead.'};
  const completePanel=cases.length===72&&cases.every(c=>c.repeats.length===3&&c.repeats.every(r=>METHODS_V12.every(method=>r.policies[method])));
  return {scenarioCount:cases.length,byMethod,comparisons,jointCompletePareto,allMethodCommonComplete,
    observedDecisionGates:observedDecisionGatesV12(comparisons,{completePanel})};
}

export function summarizeExperimentV12(cases,options={}){
  return {statisticalUnit:'scenario',recordedScenarioCount:cases.length,
    panels:Object.fromEntries([...new Set(cases.map(c=>c.panel))].map(panel=>[panel,summarizePanelV12(cases.filter(c=>c.panel===panel),options)])),
    interpretation:'Panels remain separate. All three repeats are retained; repeated seeds/timing runs do not increase the number of business scenarios. No pooled leaderboard.'};
}

async function environmentV12(){
  const cgroup={};for(const path of ['/sys/fs/cgroup/cpu.max','/sys/fs/cgroup/memory.max'])try{cgroup[path]=(await readFile(path,'utf8')).trim();}catch{cgroup[path]='unavailable';}
  return {node:process.version,platform:platform(),release:release(),arch:arch(),hostLogicalCPUs:cpus().length,cpuModel:cpus()[0]?.model,
    hostMemoryBytes:totalmem(),cgroupLimits:cgroup,nativeThreadEnvironment:{OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1',NUMEXPR_NUM_THREADS:'1'}};
}
async function sourcePathsV12(){
  const paths=['package.json','package-lock.json','requirements-research-v4.txt','requirements-cpsat-v12.txt','requirements-materials-v8.txt','requirements-materials-v12.txt',
    'requirements-public-v3.txt','requirements-browser-v5.txt','data/protocol-v2.json','data/protocol-v8.json','data/protocol-v9.json','data/protocol-v10.json','data/protocol-v12.json'];
  async function collect(dir){for(const item of await readdir(join(ROOT,dir),{withFileTypes:true})){
    const path=join(dir,item.name);if(item.isDirectory())await collect(path);else if(/\.(?:js|mjs|py)$/.test(item.name))paths.push(path);
  }}
  const protocol=JSON.parse(await readFile(join(ROOT,'data/protocol-v12.json'),'utf8'));
  for(const source of protocol.historicalSeedExclusions.sources)paths.push(source.path);
  await collect('src');await collect('scripts');return [...new Set(paths)].sort();
}
async function hashSourcesV12(){const hashes={};for(const path of await sourcePathsV12())hashes[path]=sha256(await readFile(join(ROOT,path)));return hashes;}

/** Freeze is deliberately separate from run. It creates no prospective orders. */
export async function freezeExperimentV12(destination,{rejectionTestProtocolPath}={}){
  const target=resolve(destination);await assertNewOutputV12(target);
  const protocolBytes=await readFile(rejectionTestProtocolPath??join(ROOT,'data/protocol-v12.json')),protocol=validateProtocolV12(JSON.parse(protocolBytes));
  assertReadyForFreezeV12(protocol);
  // This rejection-only fixture hook cannot authorize a real freeze, even if
  // its temporary protocol says ready. CLI always uses the actual root file.
  if(rejectionTestProtocolPath!==undefined)throw new Error('Rejection-only test protocol cannot authorize a real source freeze.');
  await verifyHistoricalSeedExclusionsV12(protocol);
  // Every factory must exist before freeze; an incomplete implementation cannot
  // accidentally create a nominally frozen, unusable experiment.
  for(const path of ['src/adaptive-planner-v9.js','scripts/highs-planner-v8.mjs','scripts/highs-planner-v10.mjs','scripts/highs-planner-v11.mjs','scripts/highs-planner-v12.mjs'])await access(join(ROOT,path));
  const implementationHashes=await hashSourcesV12();
  if(implementationHashes['scripts/benchmark-v2.mjs']!==protocol.generator.implementationSHA256)throw new Error('Unchanged generator implementation differs from protocol.');
  const manifest={schemaVersion:'portplan-v12-frozen-source',frozenAt:new Date().toISOString(),protocolHash:sha256(protocolBytes),protocol,
    implementationHashes,scenarioMetadata:enumerateCasesV12(protocol),generatedProspectiveInputs:false,environment:await environmentV12()};
  await mkdir(dirname(target),{recursive:true});await mkdir(target,{recursive:false});
  for(const path of Object.keys(implementationHashes)){const destination=join(target,'source',path);await mkdir(dirname(destination),{recursive:true});await copyFile(join(ROOT,path),destination);}
  await writeFile(join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return manifest;
}

export async function loadFrozenExperimentV12(directory){
  const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
  if(manifest.schemaVersion!=='portplan-v12-frozen-source')throw new Error('Not a V12 frozen source manifest.');
  validateProtocolV12(manifest.protocol);assertReadyForFreezeV12(manifest.protocol);await verifyHistoricalSeedExclusionsV12(manifest.protocol);
  if(JSON.stringify(await hashSourcesV12())!==JSON.stringify(manifest.implementationHashes))throw new Error('Live source differs from frozen hashes; no prospective execution is permitted.');
  const protocolBytes=await readFile(join(ROOT,'data/protocol-v12.json'));
  if(sha256(protocolBytes)!==manifest.protocolHash)throw new Error('Frozen protocol bytes changed.');
  for(const [path,expected]of Object.entries(manifest.implementationHashes))if(sha256(await readFile(join(directory,'source',path)))!==expected)throw new Error(`Frozen source snapshot changed: ${path}`);
  if(JSON.stringify(enumerateCasesV12(manifest.protocol))!==JSON.stringify(manifest.scenarioMetadata))throw new Error('Frozen scenario declarations changed.');
  return manifest;
}

/** Report initialization separately without manufacturing a D0 failure when
 * a killed process supplied no accepted physical-history receipt. */
export function initializationEvidenceV12(result){
  const first=result?.timeline?.[0],unavailable=result?.executionHistoryUnavailable===true;
  const observed=Boolean(!unavailable&&first&&first.day===0);
  const initialPlanAccepted=observed?Boolean(first.status==='executed'&&first.audit?.scheduleAudit?.valid===true&&first.audit?.freezeAudit?.valid===true):null;
  const failureDay=!unavailable&&Number.isInteger(result?.failure?.day)?result.failure.day:null;
  return {initialPlanAccepted,dayZeroObservationHash:observed?first.observationHash??null:null,
    dayZeroCallWallMs:observed&&Number.isFinite(result?.plannerTrace?.[0]?.callWallMs)?result.plannerTrace[0].callWallMs:null,
    failureDay,failurePhase:result?.complete===true?null:unavailable?'history_unavailable':failureDay===0?'initialization':failureDay>0?'after_initialization':'unclassified_known_failure',
    scope:'D0 accepted physical plan and later failure separated; no unavailable history is converted to zero calls or an initial physical failure.'};
}

/** Only scalar/counter receipts stay in memory. Full histories, all dates,
 * observations, proofs and failures are separately append-only episode files. */
export function compactEpisodeReceiptV12(result,artifact){
  const keys=['policy','status','complete','auditValid','executionHistoryUnavailable','revisionCount','failure','startupWallMs',
    'hardWallMs','wallTimeMs','endToEndWallTimeMs','actualCutoffMs','processExitWallTimeMs','processCloseWallTimeMs','cleanupFinishedMs','finalReceivedMs','receiptValidatedMs','rejectedTerminalCount','rejectedTerminalErrors','initializationEvidence',
    'deadlineReached','normalWorkerExit','terminalReceiptWithinBudget','outputDeliveredWithinBudget','terminalReceiptAcceptedAsHistory','episodeCompletedWithinBudget','endToEndCompletedWithinBudget',
    'processGroupCleanup','unacceptedTerminalReceipts','exitCode','exitSignal',...FEE_FIELDS];
  return {...Object.fromEntries(keys.filter(key=>Object.hasOwn(result,key)).map(key=>[key,result[key]])),
    plannerStats:result.plannerStats?Object.fromEntries(Object.entries(result.plannerStats).filter(([,value])=>value===null||typeof value!=='object')):null,
    scalarReceipt:true,terminalRowCount:result.rows?.length??0,artifact};
}

export async function runFrozenExperimentV12(frozenDirectory,outputDirectory){
  const frozen=resolve(frozenDirectory),manifest=await loadFrozenExperimentV12(frozen),protocol=manifest.protocol;
  const output=resolve(outputDirectory??join(frozen,'first-run'));await assertNewOutputV12(output);
  // Formal inputs are first generated below, after frozen hashes and output
  // exclusivity have passed. Importing the module is not input generation.
  const {makeScenarioV2}=await import(pathToFileURL(join(frozen,'source/scripts/benchmark-v2.mjs')).href);
  await mkdir(dirname(output),{recursive:true});await mkdir(output,{recursive:false});await mkdir(join(output,'inputs'));await mkdir(join(output,'episodes'));
  const state={schemaVersion:'portplan-v12-streamed-experiment',protocolHash:manifest.protocolHash,frozenSource:relative(output,frozen),
    implementationHashes:manifest.implementationHashes,protocol,startedAt:new Date().toISOString(),environment:await environmentV12(),
    executionState:'running',cases:[],summary:null,limitations:protocol.analysisRules};
  await writeFile(join(output,'run.json'),JSON.stringify(state,null,2)+'\n',{flag:'wx'});
  await writeFile(join(output,'episodes.ndjson'),'',{flag:'wx'});
  const allOrderFingerprints=new Map(),duplicateOrderLists=[];
  const save=async()=>{state.updatedAt=new Date().toISOString();
    const inferential=state.executionState==='complete';
    state.summary={...summarizeExperimentV12(state.cases,{bootstrap:inferential?protocol.analysis.bootstrap:{...protocol.analysis.bootstrap,draws:0}}),
      inferentialState:inferential?'complete-scenario-cluster-bootstrap':'pending-until-complete-run'};
    const next=join(output,'run.checkpoint.json');await writeFile(next,JSON.stringify(state,null,2)+'\n');};
  for(const [scenarioIndex,config]of manifest.scenarioMetadata.entries()){
    const nominalScenario=makeScenarioV2(config),events=realizeDeclaredShocksV7(nominalScenario,config.shocks);
    const fingerprint=sha256(JSON.stringify(nominalScenario.containers.map(({id,...row})=>row)));
    if(allOrderFingerprints.has(fingerprint))duplicateOrderLists.push({id:config.id,duplicateOf:allOrderFingerprints.get(fingerprint),sha256:fingerprint});
    else allOrderFingerprints.set(fingerprint,config.id);
    const bytes=JSON.stringify({config,nominalScenario,events},null,2)+'\n',inputPath=`inputs/${config.id}.json`;
    await writeFile(join(output,inputPath),bytes,{flag:'wx'});
    const c={...config,inputArtifact:{path:inputPath,sha256:sha256(bytes)},orderFingerprint:fingerprint,repeats:[]};state.cases.push(c);
    for(const [repeatIndex,repeat]of protocol.algorithmRepeats.entries()){
      const order=executionOrderV12(scenarioIndex,repeatIndex),record={repeatIndex:repeatIndex+1,algorithmSeed:repeat.seed,methodExecutionOrder:order,policies:{}};
      c.repeats.push(record);
      for(const method of order){
        const episodeId=`${config.id}--a${repeatIndex+1}--${method}`;
        const result=await runColdEpisodeV12({episodeId,nominalScenario,events,method,algorithmSeed:repeat.seed,repeatIndex:repeatIndex+1,callBudgets:protocol.callBudgets},
          {hardWallMs:protocol.budget.hardWallMs,workerScript:join(frozen,'source/scripts/episode-v12.worker.mjs')});
        const resultBytes=JSON.stringify({episodeId,caseId:config.id,scenarioId:config.id,panel:config.panel,repeat:repeatIndex+1,repeatIndex:repeatIndex+1,algorithmSeed:repeat.seed,method,result},null,2)+'\n';
        const path=`episodes/${episodeId}.json`,artifact={path,sha256:sha256(resultBytes)};
        await writeFile(join(output,path),resultBytes,{flag:'wx'});
        const receipt=compactEpisodeReceiptV12(result,artifact);record.policies[method]=receipt;
        await appendFile(join(output,'episodes.ndjson'),JSON.stringify({episodeId,scenarioId:config.id,panel:config.panel,repeatIndex:repeatIndex+1,algorithmSeed:repeat.seed,method,receipt})+'\n');
        console.log(`${config.panel} ${episodeId}: ${result.status}; complete=${result.complete}; historyUnknown=${result.executionHistoryUnavailable}; total=${result.totalCost}`);
      }
      await save();
    }
  }
  state.duplicateOrderLists=duplicateOrderLists;state.executionState='complete';await save();
  await writeFile(join(output,'complete.json'),JSON.stringify({...state,completedAt:new Date().toISOString()},null,2)+'\n',{flag:'wx'});
  return {output,summary:state.summary};
}

function option(args,name){const index=args.indexOf(name);if(index<0)return null;const value=args[index+1];if(!value||value.startsWith('--'))throw new Error(`${name} requires a value.`);return value;}
async function main(){
  const args=process.argv.slice(2);
  if(args.includes('--inspect')){
    const protocol=validateProtocolV12(JSON.parse(await readFile(join(ROOT,'data/protocol-v12.json'),'utf8')));
    console.log(JSON.stringify({state:'declaration-only-no-inputs-generated',caseMetadata:enumerateCasesV12(protocol),episodeCount:144*3*6},null,2));return;
  }
  if(args.includes('--freeze')){
    const output=option(args,'--output')??join(ROOT,'artifacts',`v12-frozen-${new Date().toISOString().replace(/[:.]/g,'-')}`);
    const manifest=await freezeExperimentV12(output);console.log(JSON.stringify({frozenDirectory:resolve(output),protocolHash:manifest.protocolHash,generatedInputs:false},null,2));return;
  }
  if(args.includes('--run')){
    const frozen=option(args,'--frozen');if(!frozen)throw new Error('--run requires --frozen PATH. Freeze and review source/protocol before prospective execution.');
    console.log(JSON.stringify(await runFrozenExperimentV12(frozen,option(args,'--output')),null,2));return;
  }
  throw new Error('Choose --inspect (metadata only), --freeze [--output PATH], or --run --frozen PATH [--output NEW_PATH]. No holdout inputs were generated.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();


