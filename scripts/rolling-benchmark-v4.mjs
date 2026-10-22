import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {solveOptimized} from '../src/engine.js';
import {makeScenarioV2,independentAuditV2} from './benchmark-v2.mjs';
import {runRollingScenario,realizeCapacityEvents} from '../src/rolling-plan.js';

const protocolURL=new URL('../data/rolling-protocol-v4.json',import.meta.url);
export function summarizeRolling(cases){
  const methods=['static','rolling','hindsight'];
  const byMethod=Object.fromEntries(methods.map(method=>[method,{
    caseCount:cases.length,completeCount:cases.filter(c=>c.policies[method].status==='feasible'||c.policies[method].status==='optimal').length,
    failureCount:cases.filter(c=>!['feasible','optimal'].includes(c.policies[method].status)).length,
    changes:cases.reduce((sum,c)=>sum+(c.policies[method].revisionCount??0),0),
  }]));
  const pairs=cases.filter(c=>['static','rolling'].every(m=>['feasible','optimal'].includes(c.policies[m].status)));
  const base=pairs.reduce((n,c)=>n+c.policies.static.totalCost,0),cost=pairs.reduce((n,c)=>n+c.policies.rolling.totalCost,0);
  return {caseCount:cases.length,byMethod,pairedCount:pairs.length,pairedStaticTotalCost:base,pairedRollingTotalCost:cost,pairedDifference:base-cost,
    pairedSavingPct:base>0?100*(base-cost)/base:null,
    recoveredCases:cases.filter(c=>!['feasible','optimal'].includes(c.policies.static.status)&&c.policies.rolling.status==='feasible').map(c=>c.id),
    rollingLossCases:cases.filter(c=>c.policies.static.status==='feasible'&&c.policies.rolling.status!=='feasible').map(c=>c.id)};
}
async function main(){
  const outputIndex=process.argv.indexOf('--output');
  if(outputIndex>=0&&!process.argv[outputIndex+1])throw new Error('--output requires a path.');
  const outputPath=resolve(outputIndex>=0?process.argv[outputIndex+1]:fileURLToPath(new URL('../artifacts/rolling-v4-reproduction.json',import.meta.url)));
  if(outputPath===fileURLToPath(new URL('../data/rolling-v4.json',import.meta.url)))throw new Error('Preserve the first-run archive; choose another reproduction output.');
  await mkdir(dirname(outputPath),{recursive:true});
  const raw=await readFile(protocolURL),protocol=JSON.parse(raw),protocolHash=createHash('sha256').update(raw).digest('hex');
  const implementationHashes={};for(const path of ['scripts/rolling-benchmark-v4.mjs','src/rolling-plan.js','src/engine.js','src/execution-constraints.js','src/solver-glpk.js'])implementationHashes[path]=createHash('sha256').update(await readFile(new URL('../'+path,import.meta.url))).digest('hex');
  const output={schemaVersion:'portplan-causal-rolling-v4',protocol,protocolHash,implementationHashes,startedAt:new Date().toISOString(),executionState:'running',cases:[],summary:null,
    boundaries:['All orders and resource shocks are synthetic; this is a daily execution simulation, not a deployed port trial.','Static and rolling share the same day-start observations, freeze rules, initial known orders and per-call optimizer time limit. Rolling has more replanning calls; no equal total CPU claim.','Hindsight sees all future shocks and is a reference only. Failure has null complete-plan cost.']};
  for(const config of protocol.cases){
    const nominalScenario=makeScenarioV2(config),events=config.shocks.map(e=>({...e,capacity:Math.max(0,nominalScenario[e.resource+'Capacity']-e.reduction)})),scenario=realizeCapacityEvents(nominalScenario,events);
    let initial;
    const staticResult=await runRollingScenario(nominalScenario,events,{timeLimitSeconds:protocol.timeLimitSeconds,planner:async(s,options)=>{
      if(!initial)initial=await solveOptimized(s,options);
      return structuredClone(initial);
    }});
    staticResult.policy='staticPlanExecution';
    const rolling=await runRollingScenario(nominalScenario,events,{timeLimitSeconds:protocol.timeLimitSeconds});
    const hindsight=await solveOptimized(scenario,{timeLimitSeconds:protocol.timeLimitSeconds});
    const policies={static:staticResult,rolling,hindsight},audits={};
    for(const [method,result] of Object.entries(policies))if(['optimal','feasible'].includes(result.status)){
      audits[method]=independentAuditV2(scenario,result);
      if(audits[method].length)throw new Error(`${config.id}/${method}: ${audits[method].join('; ')}`);
    }
    output.cases.push({...config,nominalScenario,events,scenario,policies,audits});
    output.summary=summarizeRolling(output.cases);output.generatedAt=new Date().toISOString();
    await writeFile(outputPath,JSON.stringify(output,null,2)+'\n');
    console.log(`${output.cases.length}/${protocol.cases.length} ${config.id}: static=${staticResult.status}, rolling=${rolling.status}, hindsight=${hindsight.status}`);
  }
  output.executionState='complete';output.summary=summarizeRolling(output.cases);output.generatedAt=new Date().toISOString();
  await writeFile(outputPath,JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output.summary,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
