import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {explainFeasibility} from '../src/feasibility-explanation-v6.js';
const root=resolve(import.meta.dirname,'..'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const eventFields={pickup:'pickupDay',unloadStart:'unloadDay',return:'returnDay'};

export function observedFailureInput(c,result){
  const scenario=structuredClone(c.nominalScenario),day=result.failure.day,fixedEvents=Object.create(null);
  for(const resource of ['truck','warehouse','staging']){const key=resource+'Capacity',base=scenario[key];scenario[key]=Array.from({length:scenario.horizonDays},(_,d)=>Array.isArray(base)?base[d]:base);}
  for(const entry of result.timeline){
    if(entry.day>day)continue;
    for(const observation of entry.observedEvents)scenario[observation.resource+'Capacity'][entry.day]=observation.capacity;
    for(const event of entry.executedEvents){if(event.day>=day)throw new Error('Failure timeline unexpectedly executes the failure day.');(fixedEvents[event.id]??=Object.create(null))[eventFields[event.event]]=event.day;}
  }
  // V5 did not announce future durations. Reconstruct the exact information
  // supplied at failure using observations, never the private realized arrays.
  if(c.events.some(event=>event.announcedDuration!==undefined))throw new Error('This V5 archive adapter does not support announced future durations.');
  return {scenario,options:{fixedEvents,minEventDay:day},informationScope:'nominal future; observed current/past capacities; executed history only'};
}

export async function buildFeasibilityReport(){
  const raw=await readFile(resolve(root,'data/rolling-v5.json')),archive=JSON.parse(raw),cases=[];
  for(const c of archive.cases){
    const nominal=explainFeasibility(c.nominalScenario),failures={};
    for(const [method,result]of Object.entries(c.policies))if(!result.complete){
      const input=observedFailureInput(c,result);
      failures[method]={day:result.failure.day,input,explanation:explainFeasibility(input.scenario,input.options)};
    }
    cases.push({id:c.id,nominal,failures});
  }
  const failed=cases.flatMap(c=>Object.values(c.failures));
  return {schemaVersion:'portplan-necessary-feasibility-witnesses-v6',generatedAt:new Date().toISOString(),
    retrospective:true,inputArchiveSha256:sha(raw),implementationSha256:sha(await readFile(resolve(root,'src/feasibility-explanation-v6.js'))),
    scope:'Explain all fixed V5 cases without rerunning online methods. Necessary-condition proofs only; no positive feasibility, operational guarantee or new-seed performance claim.',
    summary:{caseCount:cases.length,nominalNecessaryInfeasibilityCount:cases.filter(c=>c.nominal.status==='proven_infeasible_necessary_condition').length,
      failedMethodEpisodeCount:failed.length,failedEpisodeNecessaryInfeasibilityCount:failed.filter(f=>f.explanation.status==='proven_infeasible_necessary_condition').length,
      unresolvedFailedEpisodeCount:failed.filter(f=>f.explanation.status!=='proven_infeasible_necessary_condition').length},cases};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const args=process.argv.slice(2),i=args.indexOf('--output'),output=resolve(i>=0?args[i+1]:resolve(root,'artifacts/feasibility-v6-reproduction.json'));
  const report=await buildFeasibilityReport();await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({output,...report.summary}));
}
