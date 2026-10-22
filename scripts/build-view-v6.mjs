import {readFile,writeFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {encodeRollingViewV6,decodeRollingViewV6} from '../src/research-view-v6.js';

const root=resolve(import.meta.dirname,'..');
const pick=(object,keys)=>Object.fromEntries(keys.filter(key=>object&&Object.hasOwn(object,key)).map(key=>[key,object[key]]));
const resultKeys=['terminalAudit','objectiveMode','policy','modelVersion','status','complete','optimality','auditValid','auditErrors','executionHistoryUnavailable','rows','usage','timeline','executedEvents','finalState','finalAudit','failure','revisionCount','runtimeMs','executionThroughDay','assumptions','warnings','totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost','lateCount','timeLimitSeconds','perCallBudget','hardWallMs','wallTimeMs','processExitWallTimeMs','finalReceivedMs','deadlineReached','outputDeliveredWithinBudget','endToEndCompletedWithinBudget','episodeCompletedWithinBudget','exitCode','exitSignal'];
const statKeys=['candidateSource','decisionCalls','solverCalls','constructorCalls','reusedPlans','replannedDueToInvalid','planningWallMs','callWallMs','maxCallWallMs'];
const traceKeys=['day','method','candidateSource','accepted','decisionCalls','solverCalls','constructorCalls','reusedPlans','replannedDueToInvalid','forecastPolicy','forecastChanges','forecastAssumption','persistenceDays','forecastSubproblemStatus','nominalOptimalityClaim','nominalInfeasibilityClaim','wholeCallBudgetMs','wholeCallWallMs','deadlineOverrunMs','callWallMs','plannerStatus','error'];
function projectResult(result){return {...pick(result,resultKeys),plannerStats:pick(result.plannerStats,statKeys),plannerTrace:(result.plannerTrace??[]).map(row=>pick(row,traceKeys))};}
function projectCase(c){return {...c,policies:Object.fromEntries(Object.entries(c.policies).map(([method,result])=>[method,projectResult(result)]))};}
export async function buildViewV6(){
  const raw=await readFile(resolve(root,'data/rolling-v6.json')),record=JSON.parse(raw),sourceArchiveSha256=createHash('sha256').update(raw).digest('hex');
  if(record.executionState!=='complete'||record.cases.length!==36||record.developmentControls.cases.length!==24)throw new Error('A complete unfiltered primary/development archive is required.');
  const view={...record,schemaVersion:'portplan-rolling-v6-ui-projection',artifactRole:'Lossless decision/execution/fee fields, reduced solver telemetry for browser viewing; original full archive is in portplan-experiments-v6.zip',sourceArchiveSha256,
    omittedTelemetry:'Solver stage/model debug, full incumbent cache audits, internal search counters and stderr. All method records, summaries, dates, states, observations, execution/audit/error results, fees and paired denominators remain.',
    cases:record.cases.map(projectCase),developmentControls:{...record.developmentControls,cases:record.developmentControls.cases.map(projectCase)}};
  for(const [source,projected]of [[record.cases,view.cases],[record.developmentControls.cases,view.developmentControls.cases]])for(let i=0;i<source.length;i++)for(const method of record.protocol.methods){
    const a=source[i].policies[method],b=projected[i].policies[method];
    for(const key of ['rows','timeline','executedEvents','totalCost','incrementalCost','revisionCount','status','complete'])if(JSON.stringify(a[key])!==JSON.stringify(b[key]))throw new Error('Projection changed an execution/fee field: '+key);
  }
  const compact=encodeRollingViewV6(view),decoded=decodeRollingViewV6(compact);
  if(!isDeepStrictEqual(view,decoded))throw new Error('Container dictionary roundtrip changed the projection');
  const encoded=JSON.stringify(compact)+'\n',output=resolve(root,'data/rolling-v6-view.json');await writeFile(output,encoded);
  console.log(JSON.stringify({output,sourceArchiveSha256,sourceBytes:raw.byteLength,viewBytes:Buffer.byteLength(encoded),primaryCases:view.cases.length,developmentCases:view.developmentControls.cases.length,allExecutionAndFeeFieldsVerified:true}));
  return view;
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(import.meta.filename)){
  const manifest=JSON.parse(await readFile(resolve(root,'data/archives-v6/rolling-v6/manifest.json'))),path=resolve(root,'data/rolling-v6-view.json');
  let exists=true;try{await access(path);}catch{exists=false;}
  if(!process.argv.includes('--ensure')||!exists)await buildViewV6();
  const bytes=await readFile(path);
  if(bytes.byteLength!==manifest.derivedBrowserView.bytes||createHash('sha256').update(bytes).digest('hex')!==manifest.derivedBrowserView.sha256)throw new Error('Browser projection differs from frozen transport manifest');
}
