import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {createSeededCommitmentHiGHSPlannerV12} from './highs-planner-v12.mjs';
import {auditSchedule} from '../src/engine.js';
import {auditFrozenEvents} from '../src/rolling-plan.js';

const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const stable=value=>Array.isArray(value)?`[${value.map(stable).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`:JSON.stringify(value);
const root=resolve(new URL('../',import.meta.url).pathname);
const output=process.argv[2]??'artifacts/seeded-v12-d0-first-development';
const manifestPath='artifacts/development-seeded-v12-inputs.json';
const manifestBytes=await readFile(resolve(root,manifestPath)),manifest=JSON.parse(manifestBytes);
if(manifest.endpointCount!==15||manifest.uniqueBusinessScenarioCount!==5||manifest.newSolverCalls!==0)throw new Error('Unexpected predeclared development matrix.');
await mkdir(resolve(root,output)); // no recursive: refuse an existing run directory
await mkdir(resolve(root,output,'source'));
await mkdir(resolve(root,output,'endpoints'));
const sourcePaths=['scripts/development-seeded-v12.mjs','scripts/highs-planner-v12.mjs','src/locked-recovery-v9.js','src/commitment-slack-v11.js','scripts/highs-service-v8.py','scripts/certify-v4.py','src/engine.js','src/rolling-plan.js','src/solver-glpk.js','tests/highs-v12.test.mjs'];
const sourceBindings={};
for(const path of sourcePaths){
  const bytes=await readFile(resolve(root,path));sourceBindings[path]=hash(bytes);
  await mkdir(dirname(resolve(root,output,'source',path)),{recursive:true});
  await writeFile(resolve(root,output,'source',path),bytes,{flag:'wx'});
}
const declaration={schemaVersion:'portplan-v12-D0-development-declaration-1',declaredAt:new Date().toISOString(),scope:'All fixed published V10 D0 failures only; five old business scenarios with three timing repeats each, no prospective holdout or full-path completion result',newHeldOutExperiments:false,parametersChangedAfterDeclaration:false,manifestPath,manifestSha256:hash(manifestBytes),sourceBindings,configuration:manifest.fixedConfiguration,caseOrder:manifest.records.map(r=>({caseId:r.caseId,repeatIndex:r.repeatIndex,algorithmSeed:r.algorithmSeed,inputSha256:r.inputSha256,episodeSha256:r.episodeSha256})),coldReadyBeforeEachEndpoint:true,readyChargedToRecordedEndpointWall:true,callBudgetMs:200,wholeEndpointSafetyCutoffMs:5000,nativeRandomSeed:0,constructorOrdering:'maxRestarts3 => four deterministic orders; repeats are timing repetitions',records:manifest.records};
await writeFile(resolve(root,output,'declaration.json'),JSON.stringify(declaration,null,2)+'\n',{flag:'wx'});
const results=[];
for(const [index,binding]of manifest.records.entries()){
  const inputBytes=await readFile(resolve(root,binding.inputPath)),episodeBytes=await readFile(resolve(root,binding.episodePath));
  if(hash(inputBytes)!==binding.inputSha256||hash(episodeBytes)!==binding.episodeSha256)throw new Error('Published input or original episode SHA mismatch.');
  const input=JSON.parse(inputBytes),original=JSON.parse(episodeBytes),entry=original.result.timeline[0];
  if(original.result.failure?.day!==0||entry.day!==0)throw new Error('Only declared D0 endpoints are allowed.');
  const scenario=structuredClone(input.nominalScenario);
  for(const resource of ['truck','warehouse','staging']){
    const key=resource+'Capacity';scenario[key]=Array.from({length:scenario.horizonDays},(_,d)=>Array.isArray(scenario[key])?scenario[key][d]:scenario[key]);
  }
  // Only announced durations can affect a future observation. Never inspect
  // input.events, actualScenario or private realization/duration fields.
  for(const observation of entry.observedEvents){
    const key=observation.resource+'Capacity';
    for(const announcement of observation.announcements??[])if(announcement.announcedDuration!==undefined){
      for(let d=announcement.revealDay;d<Math.min(scenario.horizonDays,announcement.revealDay+announcement.announcedDuration);d++)scenario[key][d]=announcement.capacity;
    }
    scenario[key][observation.day]=observation.capacity;
  }
  const observationPayload={scenario,observedEvents:entry.observedEvents,fixedEvents:{},minEventDay:0};
  const observationHash='sha256:'+hash(stable(observationPayload));
  if(observationHash!==binding.originalObservationHash)throw new Error('Public D0 snapshot does not match the archived causal observation hash.');
  const planner=createSeededCommitmentHiGHSPlannerV12({...manifest.fixedConfiguration,seed:binding.algorithmSeed});
  const began=performance.now();let timer,cutoff=false,ready=null,result=null,error=null;
  try{
    timer=setTimeout(()=>{cutoff=true;void planner.close();},5000);
    ready=await planner.ready();
    result=await planner(scenario,{timeBudgetMs:200,objectiveMode:'joint',fixedEvents:{},minEventDay:0,seed:binding.algorithmSeed});
  }catch(e){error=e instanceof Error?e.message:String(e);}
  finally{clearTimeout(timer);await planner.close();}
  const wallMs=performance.now()-began;
  const audit=result?.rows?.length?{schedule:auditSchedule(scenario,result.rows),locks:auditFrozenEvents(result.rows,{},0)}:null;
  const record={schemaVersion:'portplan-v12-D0-development-endpoint-1',index:index+1,binding,observationHash,publicScenario:scenario,options:{minEventDay:0,fixedEvents:{},objectiveMode:'joint',timeBudgetMs:200,seed:binding.algorithmSeed},startup:ready,wholeEndpointWallMs:wallMs,cutoffReached:cutoff,error,audit,result};
  const path=`endpoints/${String(index+1).padStart(2,'0')}--${binding.caseId}--a${binding.repeatIndex}.json`;
  await writeFile(resolve(root,output,path),JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  const m=result?.plannerMetadata,s=m?.stabilitySelection;
  const summary={path,sha256:hash(await readFile(resolve(root,output,path))),caseId:binding.caseId,repeatIndex:binding.repeatIndex,algorithmSeed:binding.algorithmSeed,status:result?.status??'probe_error',timelyCompleteCandidate:Boolean(result?.rows?.length===scenario.containers.length&&audit?.schedule.valid&&audit?.locks.valid),candidateSource:m?.candidateSource??null,startupMs:ready?.startupWallMs??null,callWallMs:result?.runtimeMs??null,deadlineOverrunMs:m?.deadlineOverrunMs??null,constructorAcceptedCount:s?.constructorDelivery.events.filter(e=>e.outcome==='accepted').length??0,firstConstructorAcceptanceMs:s?.constructorDelivery.firstAcceptedAtMs??null,objectiveCost:result?.objectiveCost??null,nativeStatus:m?.nativeCertificate?.status??null,nativeHasIncumbent:m?.nativeCertificate?.hasIncumbent??null,nativeOutcome:s?.nativeGate.outcome??null,wholeEndpointWallMs:wallMs,error};
  results.push(summary);console.log(JSON.stringify(summary));
}
const grouped=Object.fromEntries([...new Set(results.map(r=>r.caseId))].map(id=>[id,{repeatCount:results.filter(r=>r.caseId===id).length,completeCandidateCount:results.filter(r=>r.caseId===id&&r.timelyCompleteCandidate).length,constructorSeedCount:results.filter(r=>r.caseId===id&&r.constructorAcceptedCount>0).length}]));
const summary={schemaVersion:'portplan-v12-D0-development-summary-1',completedAt:new Date().toISOString(),developmentOnly:true,newHeldOutExperiments:false,independentBusinessScenarioCount:5,timingRepeatCountPerScenario:3,endpointCount:15,timelyCompleteCandidateCount:results.filter(r=>r.timelyCompleteCandidate).length,constructorSeedEndpointCount:results.filter(r=>r.constructorAcceptedCount>0).length,fullRollingCompletionClaim:false,sourceBindings,manifestSha256:hash(manifestBytes),results,grouped};
for(const [path,expected]of Object.entries(sourceBindings))if(hash(await readFile(resolve(root,path)))!==expected)throw new Error('Source changed during declared probe: '+path);
await writeFile(resolve(root,output,'summary.json'),JSON.stringify(summary,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,complete:summary.timelyCompleteCandidateCount,total:15,constructorSeedEndpoints:summary.constructorSeedEndpointCount,grouped}));
