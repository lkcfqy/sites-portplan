import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fork} from 'node:child_process';
import {cpus,totalmem,platform,release} from 'node:os';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

export const PROTOCOL_SHA256_V4='cfda2b5cdf2bd5806a9fdbc0b380eea7e03cccfe04e51e01528365d0230acfc1';
const bytes=await readFile(new URL('../data/protocol-v4.json',import.meta.url));
export const protocolV4=JSON.parse(bytes);
export const METHOD_NAMES_V4=protocolV4.methods;
const EPS=1e-6,script=fileURLToPath(import.meta.url);

export const isFeasibleV4=result=>Boolean(result?.auditValid===true&&result.rows?.length&&Number.isFinite(result.incrementalCost)&&Number.isFinite(result.totalCost));
const failure=(policy,status,reason)=>({policy,status,reason,rows:[],usage:[],totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,objectiveCost:null,lateCount:null,optimality:'not_proven',auditValid:false,incumbentSource:null});

/** No completed outcome is accepted once the parent clock exceeds hard wall. */
export function runIsolatedV4(scenario,method,{hardWallMs=protocolV4.budget.hardWallMs,workerScript=script}={}) {
  return new Promise(resolveResult=>{
    const started=performance.now(),startedAt=new Date().toISOString();
    const child=fork(workerScript,['--v4-worker',method],{stdio:['ignore','ignore','pipe','ipc'],serialization:'advanced'});
    let checkpoint=null,final=null,finalReceivedMs=null,deadlineReached=false,decisionMs=null,stderr='';
    child.stderr.on('data',chunk=>{stderr=(stderr+String(chunk)).slice(-4000);});
    const timer=setTimeout(()=>{
      deadlineReached=true;decisionMs=performance.now()-started;child.kill('SIGKILL');
    },Math.max(0,hardWallMs-(performance.now()-started)));
    child.on('message',message=>{
      const receivedMs=performance.now()-started;
      if(receivedMs>hardWallMs)return;
      if(message.type==='checkpoint'&&isFeasibleV4(message.result)) {
        if(!checkpoint||message.result.objectiveCost<checkpoint.result.objectiveCost-EPS||Math.abs(message.result.objectiveCost-checkpoint.result.objectiveCost)<=EPS&&message.result.incrementalCost<checkpoint.result.incrementalCost-EPS)checkpoint={result:message.result,receivedMs};
      } else if(message.type==='final') {
        final=message.result;finalReceivedMs=receivedMs;decisionMs=receivedMs;clearTimeout(timer);
      }
    });
    child.on('error',error=>{stderr+=String(error);});
    child.on('close',(code,signal)=>{
      clearTimeout(timer);
      const exitMs=performance.now()-started;
      if(!final&&exitMs>=hardWallMs) {deadlineReached=true;decisionMs??=hardWallMs;}
      let result;
      if(final)result=final;
      else if(checkpoint)result={...checkpoint.result,status:'hard_time_limit',optimality:'feasible_incumbent_only',
        solverStatus:null,tieBreakStatus:'not_proven_before_deadline',retainedCheckpoint:true,
        reason:'Parent hard wall stopped the process; retained only a complete independently audited incumbent delivered before deadline. No solve proof is retained.'};
      else result=failure(method,deadlineReached?'hard_time_limit':'worker_error',deadlineReached?'No complete audited incumbent was delivered within end-to-end budget; this is not an infeasibility proof.':`Worker exited without a final result (${code}, ${signal}): ${stderr}`);
      result={...result,policy:method,wallTimeMs:decisionMs??exitMs,processExitWallTimeMs:exitMs,
        hardWallMs,deadlineReached,endToEndCompletedWithinBudget:Boolean(final),startedAt,
        finalReceivedMs,checkpointReceivedMs:checkpoint?.receivedMs??null,exitCode:code,exitSignal:signal,
        retainedCheckpoint:!final&&Boolean(checkpoint),stderr:stderr||null};
      resolveResult(result);
    });
    child.send({scenario,deadlineEpochMs:Date.now()+Math.max(0,hardWallMs-(performance.now()-started)),hardWallMs});
  });
}

export function compareMethodsV4(policies,baselineMethod,candidateMethod) {
  const baseline=policies[baselineMethod],candidate=policies[candidateMethod];
  if(!isFeasibleV4(baseline)||!isFeasibleV4(candidate))return {baselineMethod,candidateMethod,paired:false,incrementalSavingsKRW:null,incrementalSavingsPct:null,totalSavingsPct:null};
  const delta=baseline.incrementalCost-candidate.incrementalCost;
  return {baselineMethod,candidateMethod,paired:true,baselineIncrementalKRW:baseline.incrementalCost,candidateIncrementalKRW:candidate.incrementalCost,
    baselineTotalKRW:baseline.totalCost,candidateTotalKRW:candidate.totalCost,incrementalSavingsKRW:delta,
    incrementalSavingsPct:baseline.incrementalCost===0?null:100*delta/baseline.incrementalCost,
    totalSavingsPct:baseline.totalCost===0?null:100*(baseline.totalCost-candidate.totalCost)/baseline.totalCost};
}
function pairedSummary(cases,baseline,candidate) {
  const comparisons=cases.map(c=>compareMethodsV4(c.policies,baseline,candidate)),paired=comparisons.filter(c=>c.paired);
  const sum=key=>paired.reduce((n,r)=>n+r[key],0),denominator=sum('baselineIncrementalKRW'),delta=sum('incrementalSavingsKRW');
  return {baselineMethod:baseline,candidateMethod:candidate,caseCount:cases.length,pairedCaseCount:paired.length,
    missingBaselineCount:cases.filter(c=>!isFeasibleV4(c.policies[baseline])).length,missingCandidateCount:cases.filter(c=>!isFeasibleV4(c.policies[candidate])).length,
    positiveSavingsCount:paired.filter(c=>c.incrementalSavingsKRW>EPS).length,tiedCount:paired.filter(c=>Math.abs(c.incrementalSavingsKRW)<=EPS).length,
    negativeSavingsCount:paired.filter(c=>c.incrementalSavingsKRW< -EPS).length,zeroBaselineCount:paired.filter(c=>c.baselineIncrementalKRW===0).length,
    baselineIncrementalKRW:denominator,candidateIncrementalKRW:sum('candidateIncrementalKRW'),incrementalSavingsKRW:delta,
    weightedIncrementalSavingsPct:denominator===0?null:100*delta/denominator,
    baselineTotalKRW:sum('baselineTotalKRW'),candidateTotalKRW:sum('candidateTotalKRW'),
    worstLossKRW:Math.max(0,...paired.map(c=>-c.incrementalSavingsKRW))};
}
const timing=values=>{
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b),n=sorted.length;
  return {median:n?(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2):null,p95:n?sorted[Math.ceil(.95*n)-1]:null,max:n?sorted[n-1]:null};
};
export function summarizeV4(cases) {
  const byPolicy=Object.fromEntries(METHOD_NAMES_V4.map(method=>{
    const results=cases.map(c=>c.policies[method]),statuses={},sources={};
    for(const r of results) {statuses[r.status]=(statuses[r.status]??0)+1;const source=r.incumbentSource??'none';sources[source]=(sources[source]??0)+1;}
    return [method,{caseCount:results.length,feasibleCount:results.filter(isFeasibleV4).length,
      provenOptimalCount:results.filter(r=>isFeasibleV4(r)&&r.optimality==='proven_optimal'&&r.endToEndCompletedWithinBudget).length,
      completedWithinBudgetCount:results.filter(r=>r.endToEndCompletedWithinBudget).length,hardDeadlineCount:results.filter(r=>r.deadlineReached).length,
      retainedCheckpointCount:results.filter(r=>r.retainedCheckpoint).length,auditFailureCount:results.filter(r=>r.auditErrors?.length).length,
      statuses,incumbentSources:sources,wallTimeMs:timing(results.map(r=>r.wallTimeMs)),processExitWallTimeMs:timing(results.map(r=>r.processExitWallTimeMs))}];
  }));
  const comparisons={eventVsPermutation:pairedSummary(cases,'permutation','eventSearch'),presolveVsPermutation:pairedSummary(cases,'permutation','presolveMILP'),
    presolveVsEventSearch:pairedSummary(cases,'eventSearch','presolveMILP'),presolveVsRawMILP:pairedSummary(cases,'rawMILP','presolveMILP'),rawMILPVsEventSearch:pairedSummary(cases,'eventSearch','rawMILP')};
  return {caseCount:cases.length,byPolicy,comparisons,
    byScale:Object.fromEntries([...new Set(cases.map(c=>c.count))].map(n=>[n,{caseCount:cases.filter(c=>c.count===n).length,
      feasibleCounts:Object.fromEntries(METHOD_NAMES_V4.map(k=>[k,cases.filter(c=>c.count===n&&isFeasibleV4(c.policies[k])).length]))}])),
    audit:{completeSchedulesChecked:cases.reduce((n,c)=>n+Object.values(c.policies).filter(isFeasibleV4).length,0),
      failedSchedules:cases.reduce((n,c)=>n+Object.values(c.policies).filter(r=>r.auditErrors?.length).length,0)}};
}

async function worker(method) {
  const input=await new Promise(res=>process.once('message',res));
  const started=performance.now(),deadline=performance.now()+input.deadlineEpochMs-Date.now()-protocolV4.budget.childCooperativeReserveMs,s=input.scenario;
  const expired=()=>performance.now()>=deadline;
  const [{solveBaseline,solveOptimized,auditSchedule},{independentAuditV2}]=await Promise.all([
    import('../src/engine.js'),import('./benchmark-v2.mjs'),
  ]);
  const send=(type,result)=>process.send?.({type,result});
  const audited=(result,source)=>{
    if(result.rows?.length!==s.containers.length)return {...result,auditValid:false,incumbentSource:null};
    const errors=[...auditSchedule(s,result.rows).errors,...independentAuditV2(s,result)];
    if(errors.length)return {...failure(method,'audit_failed',errors.join('; ')),auditErrors:errors};
    return {...result,auditValid:true,auditErrors:[],incumbentSource:source};
  };
  let incumbent=null;
  const checkpoint=(result,source)=>{
    if(expired())return;
    const candidate=audited(result,source);
    if(!isFeasibleV4(candidate)||expired())return;
    if(!incumbent||candidate.objectiveCost<incumbent.objectiveCost-EPS||Math.abs(candidate.objectiveCost-incumbent.objectiveCost)<=EPS&&candidate.incrementalCost<incumbent.incrementalCost-EPS) {
      incumbent=candidate;send('checkpoint',candidate);
    }
  };
  try {
    if(method==='rawMILP') {
      const result=await solveOptimized(s,{presolveV4:false,timeLimitSeconds:Math.max(.001,(deadline-performance.now())/1000)});
      send('final',audited(result,result.rows?.length?'raw-glpk':'none'));
    } else if(method==='eventSearch') {
      const {solveEventSearch}=await import('../src/event-search-v4.js');
      const result=solveEventSearch(s,{deadlineMs:deadline,seed:s.seed,onIncumbent:r=>checkpoint(r,r.incumbentSource)});
      send('final',audited(result,result.incumbentSource));
    } else {
      const {solveStrongSearch}=await import('../src/strong-baseline.js');
      const initial={};
      for(const key of ['fifo','earliestFreeEnd','marginalCost','earliestDeadline']) {
        if(expired())break;
        initial[key]=solveBaseline(s,key);checkpoint(initial[key],`initial-${key}`);
      }
      if(method==='permutation') {
        let round=0;
        while(!expired()) {
          const result=solveStrongSearch(s,{seed:(s.seed+round++)>>>0,restartCount:1,iterations:4,initialPolicies:incumbent?{incumbent}:initial});
          checkpoint(result,'permutation-search');
        }
        send('final',incumbent?{...incumbent,searchMetadata:{...incumbent.searchMetadata,batches:round},runtimeMs:performance.now()-started}:failure(method,'no_feasible_schedule_found','No complete audited permutation incumbent found; not an infeasibility proof.'));
      } else if(method==='presolveMILP') {
        if(!expired()) {
          initial.strongSearch=solveStrongSearch(s,{seed:s.seed,restartCount:1,iterations:4,initialPolicies:initial});
          checkpoint(initial.strongSearch,'initial-permutation-search');
        }
        if(expired())send('final',incumbent?{...incumbent,status:'feasible',optimality:'heuristic',solverOutcome:'not_started_before_cooperative_deadline',compositeFallbackUsed:true}:failure(method,'no_feasible_schedule_found','Preprocessing initialization consumed budget before solver start.'));
        else {
          const raw=await solveOptimized(s,{presolveV4:true,initialPolicies:initial,timeLimitSeconds:Math.max(.001,(deadline-performance.now())/1000)});
          const source=raw.methodVersion==='v4-independent-bound-certificate'?'independent-lower-bound-certificate':'presolved-glpk';
          const result=audited(raw,source);
          if(isFeasibleV4(result)&&(!incumbent||result.objectiveCost<=incumbent.objectiveCost+EPS))send('final',{...result,compositeFallbackUsed:false,solverOutcome:raw.status});
          else send('final',incumbent?{...incumbent,status:'feasible',optimality:'heuristic',compositeFallbackUsed:true,solverOutcome:raw.status,
            solverAttempt:{status:raw.status,optimality:raw.optimality,solverStatus:raw.solverStatus??null,modelSize:raw.modelSize,presolveMetadata:raw.presolveMetadata,reason:raw.reason}}:result);
        }
      } else throw new Error(`Unknown V4 method ${method}`);
    }
  } catch(error) {
    send('final',incumbent?{...incumbent,compositeFallbackUsed:method==='presolveMILP',workerFailure:String(error.stack??error)}:failure(method,'error',String(error.stack??error)));
  }
  process.disconnect();
}

async function main() {
  const hash=createHash('sha256').update(bytes).digest('hex');
  if(hash!==PROTOCOL_SHA256_V4)throw new Error('Frozen V4 protocol hash differs; do not run undeclared protocol.');
  const {makeScenarioV2,independentAuditV2}=await import('./benchmark-v2.mjs');
  const implementationHashes={};
  for(const path of ['scripts/benchmark-v4.mjs','scripts/benchmark-v2.mjs','src/event-search-v4.js','src/strong-baseline.js','src/engine.js','src/solver-glpk.js','src/solver-presolver.js','data/protocol-v2.json']) {
    implementationHashes[path]=createHash('sha256').update(await readFile(new URL(`../${path}`,import.meta.url))).digest('hex');
  }
  const cgroup={};
  for(const path of ['/sys/fs/cgroup/cpu.max','/sys/fs/cgroup/memory.max']) {
    try {cgroup[path]=(await readFile(path,'utf8')).trim();} catch {cgroup[path]='unavailable';}
  }
  const output={version:'v4-equal-end-to-end-exploratory',protocolVersion:protocolV4.protocolVersion,protocolHash:hash,
    startedAt:new Date().toISOString(),generatedAt:null,executionState:'running',dataLabel:protocolV4.dataBoundary,
    implementationHashes,
    environment:{node:process.version,platform:platform(),release:release(),hostLogicalCPUs:cpus().length,cpuModel:cpus()[0]?.model,hostMemoryBytes:totalmem(),cgroupLimits:cgroup},
    cases:[],summary:null,limitations:['18 synthetic full-factorial stress cells; one seed per cell, no population inference.','Child process and all algorithm setup/audit are inside the same 1000 ms parent wall budget. Process exit overhead is reported separately.','Checkpoint fallback has independent feasibility/fee audit but no GLPK optimality proof.','All failures, zero costs and negative paired savings are retained.']};
  const save=async()=>{output.generatedAt=new Date().toISOString();output.summary=summarizeV4(output.cases);await writeFile(new URL('../data/benchmark-v4.json',import.meta.url),JSON.stringify(output,null,2)+'\n');};
  await save();
  for(let index=0;index<protocolV4.primaryCases.length;index++) {
    const config=protocolV4.primaryCases[index],scenario=makeScenarioV2(config),policies={},audits={};
    const order=METHOD_NAMES_V4.map((_,offset)=>METHOD_NAMES_V4[(index+offset)%METHOD_NAMES_V4.length]);
    for(const method of order) {
      const result=await runIsolatedV4(scenario,method);
      if(isFeasibleV4(result)) {
        const errors=independentAuditV2(scenario,result);audits[method]=errors;
        if(errors.length) {result.auditValid=false;result.auditErrors=errors;result.status='audit_failed';}
      }
      policies[method]=result;
      console.log(`${index+1}/${protocolV4.primaryCases.length} ${config.id} ${method}: ${result.status}; source=${result.incumbentSource}; cost=${result.incrementalCost}; completed=${result.endToEndCompletedWithinBudget}`);
    }
    output.cases.push({...config,scenario,methodExecutionOrder:order,policies,audits});await save();
  }
  output.executionState='complete';await save();console.log(JSON.stringify(output.summary,null,2));
}

if(process.argv.includes('--v4-worker'))await worker(process.argv[process.argv.indexOf('--v4-worker')+1]);
else if(process.argv[1]&&resolve(process.argv[1])===script)await main();
