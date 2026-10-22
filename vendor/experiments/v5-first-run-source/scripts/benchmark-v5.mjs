import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {cpus} from 'node:os';
import {runIsolatedV4,isFeasibleV4,compareMethodsV4} from './benchmark-v4.mjs';

const script=fileURLToPath(import.meta.url),root=new URL('../',import.meta.url);
export const METHODS_V5=['rawMILP','v4EventSearch','fastEvent'];
const bytes=await readFile(new URL('data/protocol-v5.json',root));
export const protocolV5=JSON.parse(bytes);
export const protocolHashV5=createHash('sha256').update(bytes).digest('hex');
export const FROZEN_PROTOCOL_HASH_V5='7cfee99b5522236c3fd70a13b4fcbf11e2273d0c0cd3dd887465608c1f1c2109';
const failure=(method,status,reason)=>({policy:method,status,reason,rows:[],usage:[],totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,objectiveCost:null,lateCount:null,optimality:'not_proven',auditValid:false,incumbentSource:null});
const median=values=>{const a=[...values].sort((x,y)=>x-y),n=a.length;return n?(n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2):null;};
const timing=values=>{const a=values.filter(Number.isFinite).sort((x,y)=>x-y);return {median:median(a),p95:a.length?a[Math.ceil(.95*a.length)-1]:null,max:a.length?a.at(-1):null};};

export function summarizeV5(cases){
  const byPolicy=Object.fromEntries(METHODS_V5.map(m=>{
    const values=cases.map(c=>c.policies[m]);
    return [m,{caseCount:values.length,feasibleCount:values.filter(isFeasibleV4).length,
      provenOptimalCount:values.filter(r=>isFeasibleV4(r)&&r.optimality==='proven_optimal'&&r.endToEndCompletedWithinBudget).length,
      hardDeadlineCount:values.filter(r=>r.deadlineReached).length,retainedCheckpointCount:values.filter(r=>r.retainedCheckpoint).length,
      medianWallMs:median(values.map(r=>r.wallTimeMs)),wallTimeMs:timing(values.map(r=>r.wallTimeMs)),processExitWallTimeMs:timing(values.map(r=>r.processExitWallTimeMs))}];
  }));
  const compare=(base,candidate)=>{
    const rows=cases.map(c=>compareMethodsV4(c.policies,base,candidate)).filter(c=>c.paired);
    const sum=key=>rows.reduce((n,c)=>n+c[key],0),denominator=sum('baselineIncrementalKRW'),delta=sum('incrementalSavingsKRW');
    return {baselineMethod:base,candidateMethod:candidate,pairedCaseCount:rows.length,
      baselineIncrementalKRW:denominator,candidateIncrementalKRW:sum('candidateIncrementalKRW'),incrementalSavingsKRW:delta,
      weightedIncrementalSavingsPct:denominator>0?100*delta/denominator:null,baselineTotalKRW:sum('baselineTotalKRW'),candidateTotalKRW:sum('candidateTotalKRW'),
      positiveSavingsCount:rows.filter(c=>c.incrementalSavingsKRW>1e-6).length,tiedCount:rows.filter(c=>Math.abs(c.incrementalSavingsKRW)<=1e-6).length,
      negativeSavingsCount:rows.filter(c=>c.incrementalSavingsKRW< -1e-6).length,zeroBaselineCount:rows.filter(c=>c.baselineIncrementalKRW===0).length,
      missingBaselineCount:cases.filter(c=>!isFeasibleV4(c.policies[base])).length,missingCandidateCount:cases.filter(c=>!isFeasibleV4(c.policies[candidate])).length,
      worstLossKRW:Math.max(0,...rows.map(c=>-c.incrementalSavingsKRW))};
  };
  return {caseCount:cases.length,byPolicy,comparisons:{fastVsV4:compare('v4EventSearch','fastEvent'),fastVsRaw:compare('rawMILP','fastEvent'),v4VsRaw:compare('rawMILP','v4EventSearch')},
    byScale:Object.fromEntries([16,50,100].map(count=>[count,{caseCount:cases.filter(c=>c.count===count).length,
      feasibleCounts:Object.fromEntries(METHODS_V5.map(m=>[m,cases.filter(c=>c.count===count&&isFeasibleV4(c.policies[m])).length]))}])),
    completeSchedulesAudited:cases.reduce((n,c)=>n+Object.values(c.policies).filter(isFeasibleV4).length,0)};
}

async function worker(method){
  const input=await new Promise(resolveInput=>process.once('message',resolveInput));
  const phaseStarted=performance.now();
  const deadline=performance.now()+input.deadlineEpochMs-Date.now()-20,s=input.scenario;
  const [{solveOptimized,auditSchedule},{independentAuditV2}]=await Promise.all([import('../src/engine.js'),import('./benchmark-v2.mjs')]);
  let incumbent=null,constructorAttempt=null;
  const expired=()=>performance.now()>=deadline;
  const audit=(result,source)=>{
    if(result.rows?.length!==s.containers.length)return {...result,auditValid:false,incumbentSource:null};
    const errors=[...auditSchedule(s,result.rows).errors,...independentAuditV2(s,result)];
    return errors.length?{...failure(method,'audit_failed',errors.join('; ')),auditErrors:errors}:{...result,auditValid:true,auditErrors:[],incumbentSource:source};
  };
  const checkpoint=(result,source)=>{
    if(expired())return;const r=audit(result,source);
    if(!isFeasibleV4(r)||expired())return;
    if(constructorAttempt)r.constructorAttempt=structuredClone(constructorAttempt);
    if(!incumbent||r.objectiveCost<incumbent.objectiveCost-1e-6||Math.abs(r.objectiveCost-incumbent.objectiveCost)<=1e-6&&r.incrementalCost<incumbent.incrementalCost-1e-6){incumbent=r;process.send?.({type:'checkpoint',result:r});}
  };
  try{
    if(method==='rawMILP'){
      const result=await solveOptimized(s,{presolveV4:false,timeLimitSeconds:Math.max(.001,(deadline-performance.now())/1000)});
      process.send?.({type:'final',result:audit(result,result.rows?.length?'raw-glpk':'none')});
    }else{
      const {solveEventSearch}=await import('../src/event-search-v4.js');
      let initialPolicies;
      if(method==='fastEvent'){
        const {solveFastConstructor}=await import('../src/fast-constructor-v5.js');
        const fast=solveFastConstructor(s,{deadlineMs:Math.min(deadline,phaseStarted+200),seed:s.seed,maxRestarts:16,onIncumbent:r=>checkpoint(r,'fast-constructor')});
        constructorAttempt={phaseBudgetMs:200,phaseWallMs:performance.now()-phaseStarted,metadata:fast.constructorMetadata};
        checkpoint(fast,'fast-constructor');
        initialPolicies=isFeasibleV4(fast)?{fast}:{};
      }else if(method!=='v4EventSearch')throw new Error('Unknown V5 method');
      const result=solveEventSearch(s,{deadlineMs:deadline,seed:s.seed,...(initialPolicies?{initialPolicies}:{}),onIncumbent:r=>checkpoint(r,method==='fastEvent'?'fast-event-search':r.incumbentSource)});
      const candidate=audit(result,method==='fastEvent'?'fast-event-search':result.incumbentSource);
      const best=isFeasibleV4(candidate)&&(!incumbent||candidate.objectiveCost<=incumbent.objectiveCost+1e-6)?candidate:incumbent??candidate;
      if(constructorAttempt)best.constructorAttempt=constructorAttempt;
      process.send?.({type:'final',result:best});
    }
  }catch(error){process.send?.({type:'final',result:incumbent?{...incumbent,optimality:'heuristic',workerFailure:String(error)}:failure(method,'worker_error',String(error))});}
  process.disconnect();
}

async function main(){
  if(protocolHashV5!==FROZEN_PROTOCOL_HASH_V5)throw new Error('Frozen V5 protocol hash differs.');
  const outputIndex=process.argv.indexOf('--output'),first=process.argv.includes('--record-first-run');
  const outputPath=resolve(outputIndex>=0?process.argv[outputIndex+1]:fileURLToPath(new URL('artifacts/benchmark-v5-reproduction.json',root)));
  const frozen=fileURLToPath(new URL('data/benchmark-v5.json',root));
  if(outputPath===frozen&&!first)throw new Error('Use a separate output; first-run archives are protected.');
  if(first){try{await readFile(frozen);throw new Error('First-run archive already exists.');}catch(error){if(error.code!=='ENOENT')throw error;}}
  const {makeScenarioV2,independentAuditV2}=await import('./benchmark-v2.mjs');
  const paths=['scripts/benchmark-v5.mjs','scripts/benchmark-v4.mjs','scripts/benchmark-v2.mjs','src/fast-constructor-v5.js','src/event-search-v4.js','src/engine.js','src/solver-glpk.js','src/solver-presolver.js','src/strong-baseline.js','src/execution-constraints.js','data/protocol-v2.json','data/protocol-v4.json','data/protocol-v5.json','package.json','package-lock.json'];
  const implementationHashes={};for(const path of paths)implementationHashes[path]=createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
  if(first){
    const snapshot=new URL('vendor/experiments/v5-first-run-source/',root);await mkdir(snapshot,{recursive:true});
    for(const path of paths){const target=new URL(path,snapshot);await mkdir(dirname(fileURLToPath(target)),{recursive:true});await copyFile(new URL(path,root),target);}
    await writeFile(new URL('manifest.json',snapshot),JSON.stringify({createdAt:new Date().toISOString(),protocolHash:protocolHashV5,implementationHashes},null,2)+'\n');
  }
  await mkdir(dirname(outputPath),{recursive:true});
  const cgroup={};for(const p of ['/sys/fs/cgroup/cpu.max','/sys/fs/cgroup/memory.max']){try{cgroup[p]=(await readFile(p,'utf8')).trim();}catch{cgroup[p]='unavailable';}}
  const output={schemaVersion:'portplan-static-holdout-v5',protocolHash:protocolHashV5,protocol:protocolV5,implementationHashes,startedAt:new Date().toISOString(),executionState:'running',environment:{node:process.version,logicalCPUs:cpus().length,cgroup},cases:[],summary:null,scaleControls:{cases:[],summary:null}};
  const save=async()=>{output.summary=summarizeV5(output.cases);output.scaleControls.summary=summarizeV5(output.scaleControls.cases);output.generatedAt=new Date().toISOString();await writeFile(outputPath,JSON.stringify(output,null,2)+'\n');};
  await save();
  for(const [index,config]of protocolV5.primaryCases.entries()){
    const scenario=makeScenarioV2(config),policies={},audits={},order=METHODS_V5.map((_,i)=>METHODS_V5[(index+i)%METHODS_V5.length]);
    for(const method of order){
      const r=await runIsolatedV4(scenario,method,{hardWallMs:1000,workerScript:script,workerFlag:'--v5-worker'});
      if(isFeasibleV4(r)){audits[method]=independentAuditV2(scenario,r);if(audits[method].length)throw new Error(config.id+'/'+method+' independent audit failed');}
      policies[method]=r;console.log(`${index+1}/36 ${config.id} ${method}: ${r.status}, cost=${r.incrementalCost}, source=${r.incumbentSource}`);
    }
    output.cases.push({...config,scenario,policies,audits,methodExecutionOrder:order});await save();
  }
  for(const [index,config]of (protocolV5.optionalScaleControl?.cases??[]).entries()){
    const sourceConfig=protocolV5.primaryCases.find(c=>c.id===config.referenceCaseId);
    if(!sourceConfig)throw new Error('Missing scale-control reference case.');
    const scenario=makeScenarioV2(sourceConfig),policies={},audits={},order=METHODS_V5.map((_,i)=>METHODS_V5[(index+i)%METHODS_V5.length]);
    for(const method of order){const r=await runIsolatedV4(scenario,method,{hardWallMs:3000,workerScript:script,workerFlag:'--v5-worker'});if(isFeasibleV4(r)){audits[method]=independentAuditV2(scenario,r);if(audits[method].length)throw new Error(config.id+'/'+method+' audit failed');}policies[method]=r;console.log(`scale ${index+1}/6 ${config.id} ${method}: ${r.status}, cost=${r.incrementalCost}`);}
    output.scaleControls.cases.push({...config,scenario,policies,audits,methodExecutionOrder:order});await save();
  }
  output.executionState='complete';await save();console.log(JSON.stringify(output.summary,null,2));
}
if(process.argv.includes('--v5-worker'))await worker(process.argv[process.argv.indexOf('--v5-worker')+1]);
else if(process.argv[1]&&resolve(process.argv[1])===script)await main();
