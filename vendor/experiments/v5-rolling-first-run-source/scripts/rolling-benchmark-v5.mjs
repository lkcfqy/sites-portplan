import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {solveOptimized} from '../src/engine.js';
import {createStablePlanner} from '../src/stable-planner-v5.js';
import {runRollingScenario,realizeCapacityEvents} from '../src/rolling-plan.js';
import {makeScenarioV2,independentAuditV2} from './benchmark-v2.mjs';

const root=new URL('../',import.meta.url),raw=await readFile(new URL('data/protocol-v5.json',root)),protocol=JSON.parse(raw);
const protocolHash=createHash('sha256').update(raw).digest('hex');
export const ROLLING_METHODS_V5=['dailyReopt','stableRetain'];
const feasible=r=>['feasible','optimal'].includes(r?.status)&&r.complete===true;
export function summarizeStableV5(cases){
  const sum=(rows,method,key)=>rows.reduce((n,c)=>n+(c.policies[method][key]??0),0);
  const stats=(rows,method,key)=>rows.reduce((n,c)=>n+(c.policies[method].plannerStats?.[key]??0),0);
  const pairs=cases.filter(c=>ROLLING_METHODS_V5.every(m=>feasible(c.policies[m]))),base=sum(pairs,'dailyReopt','totalCost'),candidate=sum(pairs,'stableRetain','totalCost');
  const oldChanges=sum(pairs,'dailyReopt','revisionCount'),newChanges=sum(pairs,'stableRetain','revisionCount');
  return {caseCount:cases.length,byMethod:Object.fromEntries(ROLLING_METHODS_V5.map(m=>[m,{caseCount:cases.length,completeCount:cases.filter(c=>feasible(c.policies[m])).length,
    failureCount:cases.filter(c=>!feasible(c.policies[m])).length,revisionCount:sum(cases,m,'revisionCount'),solverCalls:stats(cases,m,'solverCalls'),reusedPlans:stats(cases,m,'reusedPlans'),decisionCalls:stats(cases,m,'decisionCalls'),planningWallMs:stats(cases,m,'planningWallMs')}])),
    paired:{caseCount:pairs.length,dailyTotalCost:base,stableTotalCost:candidate,stableExtraCost:candidate-base,stablePremiumPct:base>0?100*(candidate-base)/base:null,
      dailyRevisionCount:oldChanges,stableRevisionCount:newChanges,changeReductionPct:oldChanges>0?100*(oldChanges-newChanges)/oldChanges:null,
      dailySolverCalls:stats(pairs,'dailyReopt','solverCalls'),stableSolverCalls:stats(pairs,'stableRetain','solverCalls'),
      stableCheaperCount:pairs.filter(c=>c.policies.stableRetain.totalCost<c.policies.dailyReopt.totalCost-1e-6).length,
      equalCostCount:pairs.filter(c=>Math.abs(c.policies.stableRetain.totalCost-c.policies.dailyReopt.totalCost)<=1e-6).length,
      stableMoreExpensiveCount:pairs.filter(c=>c.policies.stableRetain.totalCost>c.policies.dailyReopt.totalCost+1e-6).length},
    gainedCompletionCases:cases.filter(c=>feasible(c.policies.stableRetain)&&!feasible(c.policies.dailyReopt)).map(c=>c.id),lostCompletionCases:cases.filter(c=>!feasible(c.policies.stableRetain)&&feasible(c.policies.dailyReopt)).map(c=>c.id),
    initialPlansDifferCaseIds:cases.filter(c=>c.initialComparison?.decisionsEqual===false).map(c=>c.id)};
}

async function main(){
  if(protocolHash!=='7cfee99b5522236c3fd70a13b4fcbf11e2273d0c0cd3dd887465608c1f1c2109')throw new Error('Frozen V5 protocol changed.');
  const index=process.argv.indexOf('--output'),first=process.argv.includes('--record-first-run'),frozen=fileURLToPath(new URL('data/rolling-v5.json',root));
  const outputPath=resolve(index>=0?process.argv[index+1]:fileURLToPath(new URL('artifacts/rolling-v5-reproduction.json',root)));
  if(outputPath===frozen&&!first)throw new Error('Choose separate reproduction output.');
  if(first){try{await readFile(frozen);throw new Error('First-run rolling archive already exists.');}catch(error){if(error.code!=='ENOENT')throw error;}}
  const paths=['scripts/rolling-benchmark-v5.mjs','src/stable-planner-v5.js','src/rolling-plan.js','src/engine.js','src/solver-glpk.js','src/solver-presolver.js','src/execution-constraints.js','scripts/benchmark-v2.mjs','data/protocol-v2.json','data/protocol-v5.json','package.json','package-lock.json'];
  const implementationHashes={};for(const path of paths)implementationHashes[path]=createHash('sha256').update(await readFile(new URL(path,root))).digest('hex');
  if(first){const snapshot=new URL('vendor/experiments/v5-rolling-first-run-source/',root);await mkdir(snapshot,{recursive:true});for(const path of paths){const target=new URL(path,snapshot);await mkdir(dirname(fileURLToPath(target)),{recursive:true});await copyFile(new URL(path,root),target);}await writeFile(new URL('manifest.json',snapshot),JSON.stringify({protocolHash,implementationHashes},null,2)+'\n');}
  const output={schemaVersion:'portplan-stability-holdout-v5',protocolHash,protocol:protocol.rolling,implementationHashes,startedAt:new Date().toISOString(),executionState:'running',cases:[],summary:null,
    limitations:['All synthetic orders known initially, future capacity shocks and private durations unknown.','Both policies use the same observed snapshots and action-freezing rule. Retaining a feasible plan does not certify current optimality.','Internal solver time limit is 0.2 seconds per call. Policies have different call counts and total computation; no equal total CPU claim.','Stability and fee differences use only jointly completed episodes; all failed and gained/lost episodes are listed separately.']};
  await mkdir(dirname(outputPath),{recursive:true});const save=async()=>{output.summary=summarizeStableV5(output.cases);output.generatedAt=new Date().toISOString();await writeFile(outputPath,JSON.stringify(output,null,2)+'\n');};
  for(const [caseIndex,config]of protocol.rolling.cases.entries()){
    const nominalScenario=makeScenarioV2(config),events=config.shocks.map(e=>({...e,capacity:Math.max(0,nominalScenario[e.resource+'Capacity']-e.reduction)})),scenario=realizeCapacityEvents(nominalScenario,events),policies={},audits={};
    const order=caseIndex%2?['stableRetain','dailyReopt']:['dailyReopt','stableRetain'];
    for(const method of order){
      const stable=method==='stableRetain'?createStablePlanner({timeLimitSeconds:.2}):null;
      let calls=0,planningWallMs=0,latest={decisionCalls:0,solverCalls:0,reusedPlans:0,replannedDueToInvalid:0};const trace=[];
      const r=await runRollingScenario(nominalScenario,events,{timeLimitSeconds:.2,planner:async(s,o)=>{
        calls++;let candidate;const began=performance.now();
        if(stable){candidate=await stable(s,o);latest=structuredClone(candidate.plannerMetadata);}
        else{candidate=await solveOptimized(s,o);latest={decisionCalls:calls,solverCalls:calls,reusedPlans:0,replannedDueToInvalid:0,candidateSource:'daily_solver',accepted:['feasible','optimal'].includes(candidate.status)};}
        const callWallMs=performance.now()-began;planningWallMs+=callWallMs;latest.planningWallMs=planningWallMs;
        trace.push({day:o.minEventDay,...structuredClone(latest),callWallMs});return candidate;
      }});
      r.plannerStats=latest;r.plannerTrace=trace;r.policy=method;policies[method]=r;
      if(feasible(r)){audits[method]=independentAuditV2(scenario,r);if(audits[method].length)throw new Error(config.id+'/'+method+' independent audit failed');}
      console.log(`${caseIndex+1}/24 ${config.id} ${method}: ${r.status}, calls=${latest.solverCalls}, revisions=${r.revisionCount}, total=${r.totalCost}`);
    }
    const initialDecisions=m=>[...(policies[m].timeline[0]?.decisions??[])].sort((a,b)=>a.id.localeCompare(b.id));
    const initialComparison={decisionsEqual:JSON.stringify(initialDecisions('dailyReopt'))===JSON.stringify(initialDecisions('stableRetain')),interpretation:'Same optimizer and input, separate calls. Any time-limit-dependent initial difference is disclosed; subsequent policy differences cannot then be attributed only to retention.'};
    output.cases.push({...config,scenario,nominalScenario,events,policies,audits,initialComparison,methodExecutionOrder:order});await save();
  }
  output.executionState='complete';await save();console.log(JSON.stringify(output.summary,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
