/** Fixed reused V10 full-path development replay. Never generates new orders,
 * freezes a prospective protocol, computes research CIs, or retries a run. */
import {readFile,writeFile,mkdir,copyFile,access,appendFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve,join,dirname,relative} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {cpus,platform,release} from 'node:os';
import {METHOD_REGISTRY_V12,METHODS_V12} from './episode-v12.worker.mjs';
import {validateProtocolV12,executionOrderV12,initializationEvidenceV12} from './benchmark-v12.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const OLD_INDEX='data/evidence-v10/v10-frozen-first/first-run/complete.json';
const OLD_INDEX_SHA='33d07f60afb4b4248682badc631512a54070cca22fd106c7dd5062d4669bf9c2';
const D0_MANIFEST='artifacts/development-seeded-v12-inputs.json';
const D0_MANIFEST_SHA='0dc504ec9c05cf6296f82e5e4662f81fbd28f0c332fd1e2d78e53dfe525dc57b';
const ALGORITHM_SEED=49011;
const hash=raw=>createHash('sha256').update(raw).digest('hex');
const requireValue=(value,message)=>{if(!value)throw new Error(message);};
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:null;

function safePath(base,path){
  requireValue(typeof path==='string'&&path&&!path.includes('\\')&&!path.split('/').includes('..'),'Unsafe relative artifact path.');
  const target=resolve(base,path),prefix=resolve(base)+'/';
  requireValue(target.startsWith(prefix),'Artifact path escapes its declared root.');return target;
}
async function newPath(path){
  try{await access(path);}catch(error){if(error.code==='ENOENT')return;throw error;}
  throw new Error('Preserve the existing development declaration/run; choose a new directory.');
}
async function checkedBytes(path,expected){
  const raw=await readFile(path);requireValue(hash(raw)===expected,'Changed hash-bound old evidence: '+path);return raw;
}

/** Selection uses old index metadata only, never generated or future orders. */
export function selectDevelopmentCasesV12(index,d0Manifest){
  requireValue(index.executionState==='complete'&&index.cases.length===144,'Expected complete old V10 144-case index.');
  const representatives=index.cases.filter(c=>['same-distribution','stress'].includes(c.panel)&&c.scenarioRepeat===1);
  requireValue(representatives.length===36,'Expected 36 fixed scenarioRepeat=1 representatives.');
  for(const panel of ['same-distribution','stress'])for(const mechanism of ['aged-backlog','new-arrivals','batch-release'])
    for(const capacity of ['balanced','tight'])for(const count of [24,50,100])
      requireValue(representatives.filter(c=>c.panel===panel&&c.mechanism===mechanism&&c.capacityProfile===capacity&&c.count===count).length===1,'Representative stratum is missing/duplicated.');
  requireValue(d0Manifest.endpointCount===15&&d0Manifest.uniqueBusinessScenarioCount===5&&d0Manifest.records.length===15,
    'Expected the predeclared fifteen old D0 endpoints/five scenarios.');
  const d0Ids=new Set(d0Manifest.records.map(record=>record.caseId));
  requireValue(d0Ids.size===5,'D0 independent scenario count differs.');
  for(const id of d0Ids){
    const records=d0Manifest.records.filter(record=>record.caseId===id);
    requireValue(records.length===3&&JSON.stringify(records.map(record=>record.algorithmSeed).sort((a,b)=>a-b))===JSON.stringify([49011,49023,49039]),'Old D0 timing-repeat coverage differs.');
    requireValue(records.every(record=>record.minEventDay===0&&Object.keys(record.fixedEvents).length===0),'D0 input contains later execution state.');
  }
  const selectedIds=new Set([...representatives.map(c=>c.id),...d0Ids]);
  const cases=index.cases.filter(c=>selectedIds.has(c.id)).map(c=>{
    const original=c.repeats.find(r=>r.repeatIndex===1&&r.algorithmSeed===ALGORITHM_SEED);
    requireValue(original,'Missing prescribed old seed49011 repeat.');
    return {...c,developmentSelection:{representative:c.scenarioRepeat===1,oldD0Failure:d0Ids.has(c.id)},
      originalRepeatIndex:1,algorithmSeed:ALGORITHM_SEED};
  });
  requireValue(cases.length===41&&new Set(cases.map(c=>c.id)).size===41,'Expected deduplicated 41 old scenarios; no fallback or replacement is allowed.');
  return cases;
}

export function validateDevelopmentDeclarationV12(declaration,index,d0Manifest,protocol){
  requireValue(declaration.schemaVersion==='portplan-v12-fixed-old-fullpath-development-declaration'&&declaration.newHeldOutExperiments===false
    &&declaration.newOrderGeneration===0&&declaration.ciComputed===false&&declaration.scenarioCount===41&&declaration.episodeCount===246
    &&declaration.algorithmSeed===ALGORITHM_SEED&&declaration.repeatCount===1&&JSON.stringify(declaration.methods)===JSON.stringify(METHODS_V12),
    'Unexpected development declaration.');
  requireValue(declaration.oldIndex.path===OLD_INDEX&&declaration.oldIndex.sha256===OLD_INDEX_SHA
    &&declaration.oldD0Manifest.path===D0_MANIFEST&&declaration.oldD0Manifest.sha256===D0_MANIFEST_SHA,'Development source identities must remain fixed.');
  requireValue(JSON.stringify(declaration.budget)===JSON.stringify({hardWallMs:5000,dailyCallBudgetMs:200,cpuThreads:1})
    &&JSON.stringify(declaration.callBudgets)===JSON.stringify(protocol.callBudgets),'Development budgets/configuration changed after declaration.');
  const expected=selectDevelopmentCasesV12(index,d0Manifest);
  requireValue(declaration.cases.length===expected.length,'Development selection count differs.');
  for(const [index,c]of declaration.cases.entries()){
    const original=expected[index];
    for(const key of ['id','panel','mechanism','capacityProfile','count','scenarioRepeat','seed','originalRepeatIndex','algorithmSeed'])
      requireValue(c[key]===original[key],'Development selection/order metadata differs: '+key);
    requireValue(c.inputArtifact.path===`inputs/${c.id}.json`&&c.inputArtifact.sha256===original.inputArtifact.sha256
      &&c.sourceInputArtifact.path===`data/evidence-v10/v10-frozen-first/first-run/${original.inputArtifact.path}`
      &&c.sourceInputArtifact.sha256===original.inputArtifact.sha256,'Development old input references differ.');
    requireValue(JSON.stringify(c.methodExecutionOrder)===JSON.stringify(executionOrderV12(index,0)),'Development cyclic method order changed.');
    requireValue(JSON.stringify(c.developmentSelection)===JSON.stringify(original.developmentSelection),'Development selection roles differ.');
  }
  return declaration;
}

/** Runtime dependency closure, not UI/material source. All worker methods and
 * the Python service/independent pricing helper are explicit roots. */
export async function developmentRuntimeSourcesV12(){
  const pending=['scripts/development-v12.mjs','scripts/benchmark-v12.mjs','scripts/episode-v12.worker.mjs',
    'scripts/highs-service-v8.py','scripts/certify-v4.py',...Object.values(METHOD_REGISTRY_V12).map(def=>def.module)];
  const seen=new Set();
  while(pending.length){
    const path=pending.pop();if(seen.has(path))continue;
    requireValue(/^(src|scripts)\/[A-Za-z0-9_./-]+\.(?:js|mjs|py)$/.test(path)&&!path.split('/').includes('..'),'Unsafe runtime source dependency.');
    seen.add(path);const text=await readFile(join(ROOT,path),'utf8');
    for(const match of text.matchAll(/['"]((?:\.\.?\/)[^'"\n]+\.(?:js|mjs|py))['"]/g)){
      const dependency=relative(ROOT,resolve(dirname(join(ROOT,path)),match[1])).split('\\').join('/');
      requireValue(!dependency.startsWith('../'),'Runtime import escapes project root.');pending.push(dependency);
    }
  }
  return [...new Set([...seen,'package.json','package-lock.json','data/protocol-v2.json','data/protocol-v12.json'])].sort();
}

async function environment(){
  const limits={};for(const path of ['/sys/fs/cgroup/cpu.max','/sys/fs/cgroup/memory.max'])try{limits[path]=(await readFile(path,'utf8')).trim();}catch{limits[path]='unavailable';}
  return {node:process.version,platform:platform(),osRelease:release(),cpuModel:cpus()[0]?.model,logicalHostCPUs:cpus().length,cgroupLimits:limits,
    nativeThreads:1,timingScope:'Cold 5000ms parent episode; native startup/all daily 200ms calls/cleanup/IPC/parent receipt audit included.'};
}

export async function declareDevelopmentV12(destination){
  const output=resolve(destination);await newPath(output);
  const indexBytes=await checkedBytes(join(ROOT,OLD_INDEX),OLD_INDEX_SHA),index=JSON.parse(indexBytes);
  const d0Bytes=await checkedBytes(join(ROOT,D0_MANIFEST),D0_MANIFEST_SHA),d0Manifest=JSON.parse(d0Bytes);
  requireValue(d0Manifest.inputIndexSha256===OLD_INDEX_SHA,'Old D0 manifest refers to a different formal index.');
  const protocolBytes=await readFile(join(ROOT,'data/protocol-v12.json')),protocol=validateProtocolV12(JSON.parse(protocolBytes));
  requireValue(protocol.executionAuthorization.status==='draft-development-not-ready','This development replay must not authorize a prospective freeze.');
  const selected=selectDevelopmentCasesV12(index,d0Manifest),oldRoot=dirname(join(ROOT,OLD_INDEX));
  const cases=[];
  for(const [scenarioIndex,c]of selected.entries()){
    const raw=await checkedBytes(safePath(oldRoot,c.inputArtifact.path),c.inputArtifact.sha256),input=JSON.parse(raw);
    requireValue(input.config.id===c.id&&input.nominalScenario.id===c.id&&Array.isArray(input.events),'Old complete input identity differs.');
    for(const endpoint of d0Manifest.records.filter(record=>record.caseId===c.id)){
      requireValue(endpoint.inputSha256===c.inputArtifact.sha256,'D0 input hash differs from old case.');
      await checkedBytes(safePath(ROOT,endpoint.episodePath),endpoint.episodeSha256);
    }
    cases.push({id:c.id,panel:c.panel,mechanism:c.mechanism,capacityProfile:c.capacityProfile,count:c.count,scenarioRepeat:c.scenarioRepeat,
      seed:c.seed,developmentSelection:c.developmentSelection,originalRepeatIndex:1,algorithmSeed:ALGORITHM_SEED,
      sourceInputArtifact:{path:relative(ROOT,safePath(oldRoot,c.inputArtifact.path)).split('\\').join('/'),sha256:c.inputArtifact.sha256},
      inputArtifact:{path:`inputs/${c.id}.json`,sha256:c.inputArtifact.sha256},methodExecutionOrder:executionOrderV12(scenarioIndex,0)});
  }
  const implementationHashes={};for(const path of await developmentRuntimeSourcesV12())implementationHashes[path]=hash(await readFile(join(ROOT,path)));
  const declaration={schemaVersion:'portplan-v12-fixed-old-fullpath-development-declaration',declaredAt:new Date().toISOString(),
    dataRole:'old-input-development-only',newHeldOutExperiments:false,newOrderGeneration:0,ciComputed:false,parametersChangedAfterDeclaration:false,
    selectionRule:'Both V10 panels: all 3 mechanisms x 2 capacities x 3 scales with scenarioRepeat=1 (36), union all five distinct cases from the predeclared 15 old D0 endpoints; retain original index order and deduplicate (41). No filtering by this run outcomes.',
    oldIndex:{path:OLD_INDEX,sha256:OLD_INDEX_SHA},oldD0Manifest:{path:D0_MANIFEST,sha256:D0_MANIFEST_SHA},
    scenarioCount:41,methods:[...METHODS_V12],episodeCount:41*METHODS_V12.length,algorithmSeed:ALGORITHM_SEED,repeatCount:1,
    budget:{hardWallMs:5000,dailyCallBudgetMs:200,cpuThreads:1},protocolSha256:hash(protocolBytes),callBudgets:protocol.callBudgets,
    implementationHashes,environment:await environment(),cases,
    limitations:['All inputs/outcomes were already seen and partly motivated this implementation; no new research CI or unbiased generalization claim.',
      'Exactly one old repeat seed49011 per case/method. V12/native repetition is deterministic/timing-sensitive, not an independent stochastic sample.',
      'Full-path plans and execution prefixes differ between methods; this does not isolate a shared-prefix recovery effect.',
      'All failures, fees=null, rejected raw terminal receipts and complete physical/native/constructor proofs remain in standalone episode files.',
      'No budget/40ms-constructor/5ms-reserve/maxRestarts3 changes or retries after this selection declaration.']};
  await mkdir(dirname(output),{recursive:true});await mkdir(output,{recursive:false});
  // The declaration is the first evidence file, before snapshots or any solve.
  await writeFile(join(output,'declaration.json'),JSON.stringify(declaration,null,2)+'\n',{flag:'wx'});
  for(const path of Object.keys(implementationHashes)){
    const target=safePath(join(output,'source'),path);await mkdir(dirname(target),{recursive:true});await copyFile(join(ROOT,path),target);
    requireValue(hash(await readFile(target))===implementationHashes[path],'Source changed while copying development snapshot: '+path);
  }
  await mkdir(join(output,'inputs'));await mkdir(join(output,'episodes'));
  for(const c of cases){
    const raw=await checkedBytes(safePath(ROOT,c.sourceInputArtifact.path),c.sourceInputArtifact.sha256);
    await writeFile(safePath(output,c.inputArtifact.path),raw,{flag:'wx'});
  }
  return declaration;
}

async function verifySources(declaration,directory){
  const differences=[];
  for(const [path,expected]of Object.entries(declaration.implementationHashes)){
    if(hash(await readFile(safePath(ROOT,path)))!==expected)differences.push('live:'+path);
    if(hash(await readFile(safePath(join(directory,'source'),path)))!==expected)differences.push('snapshot:'+path);
  }
  requireValue(!differences.length,'Development sources changed; preserve raw evidence and do not call this a stable implementation: '+differences.join(', '));
}

function summary(records,methods){
  const panels={};
  for(const panel of ['same-distribution','stress']){
    const rows=records.filter(r=>r.panel===panel),byMethod={};
    for(const method of methods){
      const results=rows.filter(r=>r.method===method),times=results.map(r=>r.wallTimeMs).filter(Number.isFinite);
      byMethod[method]={recordedEpisodeCount:results.length,completeCount:results.filter(r=>r.complete).length,
        knownD0FailureCount:results.filter(r=>r.initializationEvidence.failurePhase==='initialization').length,
        knownLaterFailureCount:results.filter(r=>r.initializationEvidence.failurePhase==='after_initialization').length,
        unknownHistoryCount:results.filter(r=>r.executionHistoryUnavailable).length,
        initialPlanAcceptedCount:results.filter(r=>r.initializationEvidence.initialPlanAccepted===true).length,
        rejectedTerminalCount:results.reduce((n,r)=>n+r.rejectedTerminalCount,0),
        wallTimeMs:{mean:mean(times),max:times.length?Math.max(...times):null}};
    }
    panels[panel]={scenarioCount:new Set(rows.map(r=>r.scenarioId)).size,byMethod};
  }
  return {panels,ciComputed:false,scope:'Implementation/budget/physical-output development coverage only. No new holdout, new research interval, pooled leaderboard or parameter selection.'};
}

export async function runDeclaredDevelopmentV12(directory){
  const output=resolve(directory),declarationBytes=await readFile(join(output,'declaration.json')),declaration=JSON.parse(declarationBytes);
  const index=JSON.parse(await checkedBytes(join(ROOT,OLD_INDEX),OLD_INDEX_SHA));
  const d0Manifest=JSON.parse(await checkedBytes(join(ROOT,D0_MANIFEST),D0_MANIFEST_SHA));
  const protocolBytes=await readFile(join(ROOT,'data/protocol-v12.json')),protocol=validateProtocolV12(JSON.parse(protocolBytes));
  validateDevelopmentDeclarationV12(declaration,index,d0Manifest,protocol);
  requireValue(hash(protocolBytes)===declaration.protocolSha256,'Development protocol bytes changed.');
  requireValue(JSON.stringify(Object.keys(declaration.implementationHashes).sort())===JSON.stringify(await developmentRuntimeSourcesV12()),'Runtime snapshot source coverage changed.');
  await verifySources(declaration,output);
  await newPath(join(output,'start.json'));
  const driver=await import(pathToFileURL(join(output,'source/scripts/benchmark-v12.mjs')).href);
  const worker=join(output,'source/scripts/episode-v12.worker.mjs');
  const state={schemaVersion:'portplan-v12-reused-fullpath-development',dataRole:'old-input-development-only',newHeldOutExperiments:false,
    ciComputed:false,declarationSha256:hash(declarationBytes),startedAt:new Date().toISOString(),executionState:'running',records:[],summary:null};
  await writeFile(join(output,'start.json'),JSON.stringify(state,null,2)+'\n',{flag:'wx'});
  await writeFile(join(output,'episodes.ndjson'),'',{flag:'wx'});
  for(const c of declaration.cases){
    const raw=await checkedBytes(safePath(output,c.inputArtifact.path),c.inputArtifact.sha256),oldInput=JSON.parse(raw);
    for(const method of c.methodExecutionOrder){
      const episodeId=`v12-development-${c.id}--a1--${method}`;
      const result=await driver.runColdEpisodeV12({episodeId,nominalScenario:oldInput.nominalScenario,events:oldInput.events,method,
        algorithmSeed:ALGORITHM_SEED,repeatIndex:1,callBudgets:declaration.callBudgets},{hardWallMs:5000,workerScript:worker});
      const path=`episodes/${episodeId}.json`,bytes=JSON.stringify({episodeId,caseId:c.id,scenarioId:c.id,panel:c.panel,method,
        repeatIndex:1,algorithmSeed:ALGORITHM_SEED,inputArtifact:c.inputArtifact,dataRole:'old-input-development-only',result},null,2)+'\n';
      await writeFile(safePath(output,path),bytes,{flag:'wx'});
      const record={scenarioId:c.id,panel:c.panel,method,complete:driver.isCompleteV12(result),status:result.status,
        totalCost:result.totalCost,incrementalCost:result.incrementalCost,revisionCount:result.revisionCount,wallTimeMs:result.wallTimeMs,
        executionHistoryUnavailable:result.executionHistoryUnavailable,rejectedTerminalCount:result.rejectedTerminalCount,
        initializationEvidence:result.initializationEvidence??initializationEvidenceV12(result),
        sourceInputSha256:c.inputArtifact.sha256,artifact:{path,sha256:hash(bytes)}};
      state.records.push(record);await appendFile(join(output,'episodes.ndjson'),JSON.stringify(record)+'\n');
      state.summary=summary(state.records,declaration.methods);
      await writeFile(join(output,'checkpoint.json'),JSON.stringify(state,null,2)+'\n');
      console.log(`${state.records.length}/246 ${c.id} ${method}: ${result.status}; complete=${record.complete}; fee=${result.totalCost}`);
    }
  }
  try{await verifySources(declaration,output);state.sourceConsistency={before:true,after:true};state.executionState='complete';}
  catch(error){state.sourceConsistency={before:true,after:false,error:String(error.message??error)};state.executionState='source_changed';}
  state.completedAt=new Date().toISOString();state.summary=summary(state.records,declaration.methods);
  await writeFile(join(output,'complete.json'),JSON.stringify(state,null,2)+'\n',{flag:'wx'});
  requireValue(state.executionState==='complete',state.sourceConsistency.error);
  return {output,executionState:state.executionState,summary:state.summary};
}

function option(args,key){const index=args.indexOf(key);if(index<0)return null;const value=args[index+1];requireValue(value&&!value.startsWith('--'),key+' requires a value.');return value;}
async function main(){
  const args=process.argv.slice(2);
  if(args.includes('--declare')){
    const path=option(args,'--output');requireValue(path,'--declare requires --output NEW_DIRECTORY.');
    const declaration=await declareDevelopmentV12(resolve(ROOT,path));
    console.log(JSON.stringify({output:resolve(ROOT,path),scenarioCount:declaration.scenarioCount,episodeCount:declaration.episodeCount,newSolverCalls:0,newOrderGeneration:0},null,2));return;
  }
  if(args.includes('--run')){
    const path=option(args,'--declared');requireValue(path,'--run requires --declared EXISTING_DECLARATION_DIRECTORY.');
    console.log(JSON.stringify(await runDeclaredDevelopmentV12(resolve(ROOT,path)),null,2));return;
  }
  throw new Error('Choose --declare --output NEW_DIRECTORY (zero solver calls), then --run --declared DIRECTORY. No implicit run/resume or prospective orders.');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
