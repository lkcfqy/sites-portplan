import {readFile,writeFile,mkdir,access,readdir,copyFile,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fork} from 'node:child_process';
import {cpus,totalmem,platform,release,arch} from 'node:os';
import {resolve,dirname,relative,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {METHODS_V8,unknownEpisodeV8} from './episode-v8.worker.mjs';
import {isCompleteV7,validateCompleteReceiptV7,realizeDeclaredShocksV7} from './rolling-benchmark-v7.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const WORKER=fileURLToPath(new URL('./episode-v8.worker.mjs',import.meta.url));
const FEE_FIELDS=['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost','lateCount'];
const EPS=1e-6;
export const isCompleteV8=result=>result?.scalarReceipt===true?
  Boolean(result.complete===true&&result.auditValid===true&&result.episodeCompletedWithinBudget===true&&['feasible','optimal'].includes(result.status)
    &&result.terminalRowCount>0&&result.artifact?.path&&Number.isFinite(result.totalCost)&&Number.isFinite(result.incrementalCost)):isCompleteV7(result);
export const validateCompleteReceiptV8=validateCompleteReceiptV7;
export {METHODS_V8};
export const sha256=value=>createHash('sha256').update(value).digest('hex');

/** Parent clock includes process launch/imports, native ready, all decisions,
 * dual audits, child cleanup, terminal IPC and this parent's receipt validation.
 * Detached POSIX process groups contain Python as well as the Node worker. */
export function runColdEpisodeV8(input,{hardWallMs=5000,workerScript=WORKER}={}){
  if(!Number.isFinite(hardWallMs)||hardWallMs<=0)throw new Error('hardWallMs must be positive and finite.');
  return new Promise(resolveResult=>{
    const started=performance.now(),episodeId=input.episodeId??input.nominalScenario?.id,method=input.method;
    const grouped=process.platform!=='win32';
    const child=fork(workerScript,[],{stdio:['ignore','ignore','pipe','ipc'],serialization:'advanced',detached:grouped,
      env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1',NUMEXPR_NUM_THREADS:'1'}});
    let final=null,finalReceivedMs=null,receiptValidatedMs=null,actualCutoffMs=null,deadlineReached=false,stderr='',rejectedTerminalCount=0,rejectedTerminalErrors=[];
    let killSignalSent=false;
    const killGroup=()=>{
      try{if(grouped&&child.pid)process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');killSignalSent=true;}
      catch(error){if(error.code!=='ESRCH')stderr=(stderr+' '+String(error)).slice(-4000);}
    };
    child.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-4000);});
    const timer=setTimeout(()=>{actualCutoffMs=performance.now()-started;if(!final)deadlineReached=true;killGroup();},Math.max(0,hardWallMs-(performance.now()-started)));
    child.on('message',message=>{
      const elapsed=performance.now()-started;
      if(final||deadlineReached||elapsed>hardWallMs||message?.type!=='final'||message.method!==method||message.episodeId!==episodeId)return;
      const result=message.result;
      if(!result||typeof result.status!=='string'||typeof result.complete!=='boolean')return;
      if(result.complete){
        const errors=validateCompleteReceiptV8(input,result);
        if(errors.length){rejectedTerminalCount++;rejectedTerminalErrors=errors.slice(0,20);return;}
      }
      const validated=performance.now()-started;
      if(validated>hardWallMs)return;
      final=result;finalReceivedMs=elapsed;receiptValidatedMs=validated;
    });
    child.on('error',error=>{stderr=(stderr+' '+String(error)).slice(-4000);});
    child.on('close',(code,signal)=>{
      clearTimeout(timer);killGroup();const exitMs=performance.now()-started;
      if(!final&&exitMs>=hardWallMs)deadlineReached=true;
      const result=final??unknownEpisodeV8(method,deadlineReached?'No audited terminal receipt was delivered and parent-validated within the common whole-episode budget. History/counters are unavailable.':`Worker exited without a valid terminal receipt (${code}, ${signal}). ${stderr}`,deadlineReached?'hard_time_limit':'worker_error');
      if(!result.complete){result.rows=[];result.usage=[];for(const key of FEE_FIELDS)result[key]=null;}
      resolveResult({...result,policy:method,hardWallMs,wallTimeMs:receiptValidatedMs??actualCutoffMs??exitMs,actualCutoffMs,processExitWallTimeMs:exitMs,
        finalReceivedMs,receiptValidatedMs,rejectedTerminalCount,rejectedTerminalErrors,deadlineReached,outputDeliveredWithinBudget:Boolean(final),
        episodeCompletedWithinBudget:Boolean(final&&isCompleteV8(result)),endToEndCompletedWithinBudget:Boolean(final),
        processGroupCleanup:{mode:grouped?'posix-process-group':'worker-only',killSignalSent},exitCode:code,exitSignal:signal,stderr:stderr||null});
    });
    child.send({...input,episodeId},error=>{if(error){stderr=(stderr+' '+String(error)).slice(-4000);killGroup();}});
  });
}

export async function assertNewOutputV8(path){
  try{await access(path);}catch(error){if(error.code==='ENOENT')return;throw error;}
  throw new Error('Output already exists; preserve the first run and choose a new path.');
}

/** Pure metadata expansion; never invokes the synthetic order generator. */
export function enumerateCasesV8(protocol){
  const cases=[],ids=new Set(),seeds=new Set();
  for(const panel of protocol.panels){
    let index=0;
    for(const mechanism of protocol.matrix.mechanisms)for(const capacityProfile of protocol.matrix.capacityProfiles)
      for(const count of protocol.matrix.counts)for(let repeat=1;repeat<=protocol.matrix.scenariosPerCell;repeat++){
        const pattern=panel.shockPatterns[(repeat-1)%panel.shockPatterns.length];
        const config={id:`v8-${panel.id}-${mechanism}-${capacityProfile}-n${count}-r${repeat}`,panel:panel.id,dataRole:'held-out',
          mechanism,capacityProfile,count,scenarioRepeat:repeat,seed:panel.baseSeed+index++,shockPattern:pattern.name,shocks:structuredClone(pattern.shocks)};
        if(ids.has(config.id)||seeds.has(config.seed))throw new Error('V8 scenario identifiers and generator seeds must be unique across panels.');
        ids.add(config.id);seeds.add(config.seed);cases.push(config);
      }
    if(index!==panel.scenarioCount)throw new Error('Declared panel scenario count differs from its matrix.');
  }
  return cases;
}

export function validateProtocolV8(protocol){
  if(protocol.schemaVersion!=='portplan-protocol-v8'||JSON.stringify(protocol.methods)!==JSON.stringify(METHODS_V8))throw new Error('Protocol must declare the five fixed allowed methods.');
  if(protocol.budget.hardWallMs!==5000||protocol.budget.cpuThreads!==1)throw new Error('V8 common budget must be 5000ms with one native thread.');
  if(protocol.algorithmRepeats.length!==3||new Set(protocol.algorithmRepeats.map(r=>r.seed)).size!==3)throw new Error('Exactly three predeclared repeat seeds are required.');
  for(const method of METHODS_V8)if(!protocol.callBudgets[method])throw new Error(`Missing call budget for ${method}.`);
  const cases=enumerateCasesV8(protocol);
  if(cases.length!==144||protocol.panels.length!==2||protocol.panels.some(p=>p.scenarioCount!==72))throw new Error('V8 needs two separate panels of 72 scenarios.');
  for(const c of cases)for(const shock of c.shocks)if(Object.hasOwn(shock,'announcedDuration'))throw new Error('Stress tests must not disclose private recovery duration.');
  return protocol;
}

export function executionOrderV8(scenarioIndex,repeatIndex){
  const start=(scenarioIndex+repeatIndex)%METHODS_V8.length;
  return METHODS_V8.map((_,offset)=>METHODS_V8[(start+offset)%METHODS_V8.length]);
}

const mean=values=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:null;
const sum=values=>values.reduce((total,value)=>total+value,0);
const classification=value=>value>EPS?'win':value< -EPS?'loss':'tie';
function quantile(sorted,p){if(!sorted.length)return null;const x=(sorted.length-1)*p,low=Math.floor(x);return sorted[low]+(sorted[Math.ceil(x)]-sorted[low])*(x-low);}
/** Cluster bootstrap: each draw resamples whole business scenarios, retaining
 * every predeclared repeat together. Three runs are not three new scenarios. */
export function pairedBootstrapV8(units,{seed=700001,draws=2000}={}){
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
      const b=repetition.policies[baseline],a=repetition.policies[candidate],bc=isCompleteV8(b),ac=isCompleteV8(a);
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
      uncertainty:pairedBootstrapV8(units.map(u=>u[name]),bootstrap)};
  }
  const revisions=allPairs.filter(p=>Number.isFinite(p.baseline.revisionCount)&&Number.isFinite(p.candidate.revisionCount));
  return {baselineMethod:baseline,candidateMethod:candidate,scenarioCount:cases.length,episodePairCount:sum(cases.map(c=>c.repeats.length)),
    completion:{gainedEpisodeCount:gained,lostEpisodeCount:lost,gainedEpisodeIds:gainIds,lostEpisodeIds:lossIds,
      gainedFromKnownFailureEpisodeIds:knownFailureGainIds,gainedFromUnknownHistoryEpisodeIds:unknownHistoryGainIds,
      meanScenarioRateGain:mean(completionUnits.map(u=>u.candidate)),
      uncertainty:{unit:'scenario completion-rate difference',
        meanScenarioRateGain95CI:pairedBootstrapV8(completionUnits.map(u=>({baseline:0,candidate:-u.candidate})),bootstrap).meanSavings95CI},
      interpretation:'Timely complete audited receipts; an unavailable history is not proof of physical execution failure.'},
    fees,revisions:{pairedEpisodeCount:revisions.length,baselineObservedSum:sum(revisions.map(p=>p.baseline.revisionCount)),candidateObservedSum:sum(revisions.map(p=>p.candidate.revisionCount))},
    pairedScenarios:units.map(u=>({scenarioId:u.scenarioId,pairedRepeatCount:u.pairedRepeatCount,totalSavingsKRW:u.total.baseline-u.total.candidate,
      incrementalSavingsKRW:u.incremental.baseline-u.incremental.candidate})),
    interpretation:'Each scenario has equal weight after averaging matching jointly completed repeats. Each comparison has its own eligibility set; do not rank methods across denominators.'};
}

export function summarizePanelV8(cases,{bootstrap={}}={}){
  const byMethod={};
  for(const method of METHODS_V8){
    const results=cases.flatMap(c=>c.repeats.map(r=>r.policies[method])).filter(Boolean),statuses={};for(const r of results)statuses[r.status]=(statuses[r.status]??0)+1;
    const values=key=>results.map(r=>r[key]).filter(Number.isFinite);
    byMethod[method]={scenarioCount:cases.length,recordedEpisodeCount:results.length,completeEpisodeCount:results.filter(isCompleteV8).length,
      fullyCompletedScenarioCount:cases.filter(c=>c.repeats.length===3&&c.repeats.every(r=>isCompleteV8(r.policies[method]))).length,
      anyCompletedScenarioCount:cases.filter(c=>c.repeats.some(r=>isCompleteV8(r.policies[method]))).length,
      meanScenarioCompletionRate:mean(cases.map(c=>mean(c.repeats.map(r=>Number(isCompleteV8(r.policies[method])))))),
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
  return {scenarioCount:cases.length,byMethod,comparisons:{
    adaptiveVsV7:compareMethods(cases,'costPolishV7','adaptiveV8',bootstrap),
    adaptiveVsV5:compareMethods(cases,'stableRetainV5','adaptiveV8',bootstrap),
    adaptiveVsV6:compareMethods(cases,'lockedRecoveryV6','adaptiveV8',bootstrap),
    adaptiveVsHiGHS:compareMethods(cases,'highsV8','adaptiveV8',bootstrap),
    highsVsV7:compareMethods(cases,'costPolishV7','highsV8',bootstrap)}};
}

export function summarizeExperimentV8(cases,options={}){
  return {statisticalUnit:'scenario',recordedScenarioCount:cases.length,
    panels:Object.fromEntries([...new Set(cases.map(c=>c.panel))].map(panel=>[panel,summarizePanelV8(cases.filter(c=>c.panel===panel),options)])),
    interpretation:'Panels remain separate. All three repeats are retained; repeated seeds/timing runs do not increase the number of business scenarios. No pooled leaderboard.'};
}

async function environmentV8(){
  const cgroup={};for(const path of ['/sys/fs/cgroup/cpu.max','/sys/fs/cgroup/memory.max'])try{cgroup[path]=(await readFile(path,'utf8')).trim();}catch{cgroup[path]='unavailable';}
  return {node:process.version,platform:platform(),release:release(),arch:arch(),hostLogicalCPUs:cpus().length,cpuModel:cpus()[0]?.model,
    hostMemoryBytes:totalmem(),cgroupLimits:cgroup,nativeThreadEnvironment:{OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1',NUMEXPR_NUM_THREADS:'1'}};
}
async function sourcePathsV8(){
  const paths=['package.json','package-lock.json','data/protocol-v2.json','data/protocol-v8.json'];
  async function collect(dir){for(const item of await readdir(join(ROOT,dir),{withFileTypes:true})){
    const path=join(dir,item.name);if(item.isDirectory())await collect(path);else if(/\.(?:js|mjs|py)$/.test(item.name))paths.push(path);
  }}
  await collect('src');await collect('scripts');return paths.sort();
}
async function hashSourcesV8(){const hashes={};for(const path of await sourcePathsV8())hashes[path]=sha256(await readFile(join(ROOT,path)));return hashes;}

/** Freeze is deliberately separate from run. It creates no prospective orders. */
export async function freezeExperimentV8(destination){
  const target=resolve(destination);await assertNewOutputV8(target);
  const protocolBytes=await readFile(join(ROOT,'data/protocol-v8.json')),protocol=validateProtocolV8(JSON.parse(protocolBytes));
  // Every factory must exist before freeze; an incomplete implementation cannot
  // accidentally create a nominally frozen, unusable experiment.
  for(const path of ['src/adaptive-planner-v8.js','scripts/highs-planner-v8.mjs'])await access(join(ROOT,path));
  const implementationHashes=await hashSourcesV8();
  if(implementationHashes['scripts/benchmark-v2.mjs']!==protocol.generator.implementationSHA256)throw new Error('Unchanged generator implementation differs from protocol.');
  const manifest={schemaVersion:'portplan-v8-frozen-source',frozenAt:new Date().toISOString(),protocolHash:sha256(protocolBytes),protocol,
    implementationHashes,scenarioMetadata:enumerateCasesV8(protocol),generatedProspectiveInputs:false,environment:await environmentV8()};
  await mkdir(dirname(target),{recursive:true});await mkdir(target,{recursive:false});
  for(const path of Object.keys(implementationHashes)){const destination=join(target,'source',path);await mkdir(dirname(destination),{recursive:true});await copyFile(join(ROOT,path),destination);}
  await writeFile(join(target,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  return manifest;
}

export async function loadFrozenExperimentV8(directory){
  const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
  if(manifest.schemaVersion!=='portplan-v8-frozen-source')throw new Error('Not a V8 frozen source manifest.');
  validateProtocolV8(manifest.protocol);
  if(JSON.stringify(await hashSourcesV8())!==JSON.stringify(manifest.implementationHashes))throw new Error('Live source differs from frozen hashes; no prospective execution is permitted.');
  const protocolBytes=await readFile(join(ROOT,'data/protocol-v8.json'));
  if(sha256(protocolBytes)!==manifest.protocolHash)throw new Error('Frozen protocol bytes changed.');
  for(const [path,expected]of Object.entries(manifest.implementationHashes))if(sha256(await readFile(join(directory,'source',path)))!==expected)throw new Error(`Frozen source snapshot changed: ${path}`);
  if(JSON.stringify(enumerateCasesV8(manifest.protocol))!==JSON.stringify(manifest.scenarioMetadata))throw new Error('Frozen scenario declarations changed.');
  return manifest;
}

/** Only scalar/counter receipts stay in memory. Full histories, all dates,
 * observations, proofs and failures are separately append-only episode files. */
export function compactEpisodeReceiptV8(result,artifact){
  const keys=['policy','status','complete','auditValid','executionHistoryUnavailable','revisionCount','failure','startupWallMs',
    'hardWallMs','wallTimeMs','actualCutoffMs','processExitWallTimeMs','finalReceivedMs','receiptValidatedMs','rejectedTerminalCount','rejectedTerminalErrors',
    'deadlineReached','outputDeliveredWithinBudget','episodeCompletedWithinBudget','endToEndCompletedWithinBudget','exitCode','exitSignal',...FEE_FIELDS];
  return {...Object.fromEntries(keys.filter(key=>Object.hasOwn(result,key)).map(key=>[key,result[key]])),
    plannerStats:result.plannerStats?Object.fromEntries(Object.entries(result.plannerStats).filter(([,value])=>value===null||typeof value!=='object')):null,
    scalarReceipt:true,terminalRowCount:result.rows?.length??0,artifact};
}

export async function runFrozenExperimentV8(frozenDirectory,outputDirectory){
  const frozen=resolve(frozenDirectory),manifest=await loadFrozenExperimentV8(frozen),protocol=manifest.protocol;
  const output=resolve(outputDirectory??join(frozen,'first-run'));await assertNewOutputV8(output);
  // Formal inputs are first generated below, after frozen hashes and output
  // exclusivity have passed. Importing the module is not input generation.
  const {makeScenarioV2}=await import('./benchmark-v2.mjs');
  await mkdir(dirname(output),{recursive:true});await mkdir(output,{recursive:false});await mkdir(join(output,'inputs'));await mkdir(join(output,'episodes'));
  const state={schemaVersion:'portplan-v8-streamed-experiment',protocolHash:manifest.protocolHash,frozenSource:relative(output,frozen),
    implementationHashes:manifest.implementationHashes,protocol,startedAt:new Date().toISOString(),environment:await environmentV8(),
    executionState:'running',cases:[],summary:null,limitations:protocol.analysisRules};
  await writeFile(join(output,'run.json'),JSON.stringify(state,null,2)+'\n',{flag:'wx'});
  await writeFile(join(output,'episodes.ndjson'),'',{flag:'wx'});
  const allOrderFingerprints=new Map(),duplicateOrderLists=[];
  const save=async()=>{state.updatedAt=new Date().toISOString();
    const inferential=state.executionState==='complete';
    state.summary={...summarizeExperimentV8(state.cases,{bootstrap:inferential?protocol.analysis.bootstrap:{...protocol.analysis.bootstrap,draws:0}}),
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
      const order=executionOrderV8(scenarioIndex,repeatIndex),record={repeatIndex:repeatIndex+1,algorithmSeed:repeat.seed,methodExecutionOrder:order,policies:{}};
      c.repeats.push(record);
      for(const method of order){
        const episodeId=`${config.id}--a${repeatIndex+1}--${method}`;
        const result=await runColdEpisodeV8({episodeId,nominalScenario,events,method,algorithmSeed:repeat.seed,repeatIndex:repeatIndex+1,callBudgets:protocol.callBudgets},
          {hardWallMs:protocol.budget.hardWallMs,workerScript:join(frozen,'source/scripts/episode-v8.worker.mjs')});
        const resultBytes=JSON.stringify({episodeId,caseId:config.id,scenarioId:config.id,panel:config.panel,repeat:repeatIndex+1,repeatIndex:repeatIndex+1,algorithmSeed:repeat.seed,method,result},null,2)+'\n';
        const path=`episodes/${episodeId}.json`,artifact={path,sha256:sha256(resultBytes)};
        await writeFile(join(output,path),resultBytes,{flag:'wx'});
        const receipt=compactEpisodeReceiptV8(result,artifact);record.policies[method]=receipt;
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
    const protocol=validateProtocolV8(JSON.parse(await readFile(join(ROOT,'data/protocol-v8.json'),'utf8')));
    console.log(JSON.stringify({state:'draft-not-run',caseMetadata:enumerateCasesV8(protocol),episodeCount:144*3*5},null,2));return;
  }
  if(args.includes('--freeze')){
    const output=option(args,'--output')??join(ROOT,'artifacts',`v8-frozen-${new Date().toISOString().replace(/[:.]/g,'-')}`);
    const manifest=await freezeExperimentV8(output);console.log(JSON.stringify({frozenDirectory:resolve(output),protocolHash:manifest.protocolHash,generatedInputs:false},null,2));return;
  }
  if(args.includes('--run')){
    const frozen=option(args,'--frozen');if(!frozen)throw new Error('--run requires --frozen PATH. Freeze and review source/protocol before prospective execution.');
    console.log(JSON.stringify(await runFrozenExperimentV8(frozen,option(args,'--output')),null,2));return;
  }
  throw new Error('Choose --inspect (metadata only), --freeze [--output PATH], or --run --frozen PATH [--output NEW_PATH]. No holdout inputs were generated.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
