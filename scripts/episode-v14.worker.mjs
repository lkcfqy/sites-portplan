import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {compactPlannerMetadataV12,unknownEpisodeV12,METHOD_REGISTRY_V12} from './episode-v12.worker.mjs';

const FEASIBLE=new Set(['feasible','optimal']);
const FEE_FIELDS=['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost','lateCount'];
/** This is an allow-list, not an input-controlled module loader. */
export const METHOD_REGISTRY_V14=Object.freeze({...METHOD_REGISTRY_V12,
  guardedHiGHSV13:Object.freeze({module:'scripts/highs-planner-v13.mjs',export:'createGuardedCommitmentHiGHSPlannerV13'}),
});
export const METHODS_V14=Object.freeze(Object.keys(METHOD_REGISTRY_V14));
export const unknownEpisodeV14=unknownEpisodeV12;

/** Keep every constructor/native/strict-fee guard proof and record that the
 * development import remained unused during natural full-D0 execution. */
export function compactPlannerMetadataV14(metadata={},omissions={}){
  const result=compactPlannerMetadataV12(metadata,omissions);
  if(Object.hasOwn(metadata,'developmentEndpointImport'))result.developmentEndpointImport=structuredClone(metadata.developmentEndpointImport);
  return result;
}

export async function createEpisodePlannerV14(method,configuration) {
  if(!Object.hasOwn(METHOD_REGISTRY_V14,method))throw new Error('Unknown V14 method; only the fixed method registry is allowed.');
  for(const key of ['enableDevelopmentEndpointImport','servicePath','pythonExecutable','seedConstructor','now','onIncumbent'])if(Object.hasOwn(configuration,key))throw new Error('Formal V14 forbids development/diagnostic planner configuration: '+key);
  const definition=METHOD_REGISTRY_V14[method],module=await import(new URL('../'+definition.module,import.meta.url));
  const factory=module[definition.export];
  if(typeof factory!=='function')throw new Error(`Missing allowed planner export ${definition.export}.`);
  const planner=await factory(configuration);
  if(typeof planner!=='function')throw new Error('Planner factory must return a callable planner.');
  return planner;
}

/** The simulator owns future events. Factories receive only fixed configuration;
 * each call gets only the current public snapshot and execution constraints. */
export async function runEpisodeV14(input,{plannerFactoryForTest}={}) {
  const {method,nominalScenario,events}=input,configuration=input.callBudgets?.[method];
  if(!Object.hasOwn(METHOD_REGISTRY_V14,method)||!configuration)throw new Error('Missing allowed method/call-budget configuration.');
  for(const key of ['originalResult','caseDefinition','endpointReview','endpointDates','developmentEndpoint','forcedPrefix','replayPrefix','replayEndpoint','forcedEndpoint','importDevelopmentEndpoint','plannerFactoryForTest'])if(Object.hasOwn(input,key))throw new Error('V14 natural full-D0 episodes reject historical replay, injected factories or forced endpoint payloads.');
  if(input.methodFactories!==undefined)throw new Error('Input-controlled planner registries are forbidden.');
  if(Object.hasOwn(configuration,'onIncumbent'))throw new Error('Formal V14 episodes forbid diagnostic observers or IPC acknowledgements.');
  if(!Number.isInteger(input.algorithmSeed))throw new Error('Each V14 episode requires its predeclared algorithm seed.');
  const startupStarted=performance.now();
  const [{auditSchedule},{runRollingScenario,realizeCapacityEvents},{independentAuditV2}]=await Promise.all([
    import('../src/engine.js'),import('../src/rolling-plan.js'),import('./benchmark-v2.mjs'),
  ]);
  // This direct-call-only seam supports handwritten causal fixtures. IPC input
  // cannot select a factory, service path, import hook or module.
  const planner=plannerFactoryForTest?await plannerFactoryForTest({...configuration,seed:input.algorithmSeed}):await createEpisodePlannerV14(method,{...configuration,seed:input.algorithmSeed});
  const trace=[],callWallMs=[],omissions={};
  let calls=0,planningWallMs=0,latest={},startupWallMs=null,result;
  try {
    // Native Python/SciPy startup is NOT free: the parent hard clock is already
    // running. It is separately visible and is outside the per-decision budget.
    if(typeof planner.ready==='function')await planner.ready();
    startupWallMs=performance.now()-startupStarted;
    result=await runRollingScenario(nominalScenario,events,{timeLimitSeconds:configuration.timeLimitSeconds??.2,objectiveMode:'joint',planner:async(snapshot,options)=>{
      calls++;const began=performance.now();let candidate,error,metadata;
      try {
        candidate=await planner(snapshot,{...options,seed:input.algorithmSeed,timeBudgetMs:configuration.timeBudgetMs??200});
        metadata=candidate?.plannerMetadata??{};
        if(metadata.developmentEndpointImport!==undefined&&metadata.developmentEndpointImport!==null)throw new Error('Development endpoint import cannot appear in a natural V14 episode.');
        latest={...Object.fromEntries(Object.entries(metadata).filter(([,value])=>value===null||['number','boolean','string'].includes(typeof value))),
          decisionCalls:calls,solverCalls:metadata.solverCalls??null,constructorCalls:metadata.constructorCalls??null,
          reusedPlans:metadata.reusedPlans??null,replannedDueToInvalid:metadata.replannedDueToInvalid??null,candidateSource:metadata.candidateSource??null};
        return candidate;
      }catch(thrown){
        error=String(thrown.message??thrown);metadata={...(metadata??{}),candidateSource:'planner_exception',accepted:false};
        latest={decisionCalls:calls,solverCalls:null,constructorCalls:null,reusedPlans:null,replannedDueToInvalid:null,candidateSource:'planner_exception'};
        throw thrown;
      }finally{
        const compact=compactPlannerMetadataV14(metadata,omissions),elapsed=performance.now()-began;
        callWallMs.push(elapsed);planningWallMs+=elapsed;
        trace.push({day:options.minEventDay,...compact,...latest,callWallMs:elapsed,plannerStatus:candidate?.status??'planner_error',...(error?{error}:{})});
      }
    }});
    result.policy=method;result.studyVersion='v14';result.naturalFullD0=true;result.developmentEndpointImportEnabled=false;result.algorithmSeed=input.algorithmSeed;result.repeatIndex=input.repeatIndex;
    result.plannerTrace=trace;result.plannerStats={...latest,decisionCalls:calls,planningWallMs,callWallMs,maxCallWallMs:Math.max(0,...callWallMs)};
    result.executionHistoryUnavailable=false;result.startupWallMs=startupWallMs;
    result.telemetryOmissions={...omissions,policy:'Only duplicate cache prices and debug/model arrays compacted; adaptive decisions, complete candidateDelivery receipts/date proofs and physical history retained.'};
    result.perCallBudget={configuration,interpretation:'cooperative whole-call milliseconds; constructor/native IPC/model/scoring/audit included; initialization separately charged to parent episode'};
    if(result.complete===true&&FEASIBLE.has(result.status)){
      let engineAudit,independentErrors;
      try{const actual=realizeCapacityEvents(nominalScenario,events);engineAudit=auditSchedule(actual,result.rows);independentErrors=independentAuditV2(actual,result);}
      catch(error){engineAudit={valid:false,errors:[String(error.message??error)]};independentErrors=[];}
      result.terminalAudit={engine:engineAudit,independentErrors};result.auditErrors=[...engineAudit.errors,...independentErrors];result.auditValid=result.auditErrors.length===0;
      if(!result.auditValid){result.status='audit_failed';result.complete=false;result.failure={kind:'terminal_audit_failed',reason:'Complete execution failed terminal dual audit.',errors:result.auditErrors};}
    }else result.auditValid=false;
    if(!result.complete){result.rows=[];result.usage=[];for(const key of FEE_FIELDS)result[key]=null;}
    return result;
  }finally{
    // The parent also kills the whole process group on a deadline or exit. A
    // successful terminal receipt is sent only after native cleanup completes.
    if(typeof planner.close==='function')await planner.close();
  }
}

async function workerMain(){
  const input=await new Promise(resolveInput=>process.once('message',resolveInput));let result;
  try{result=await runEpisodeV14(input);}catch(error){result=unknownEpisodeV14(input.method,String(error.stack??error));}
  await new Promise(resolveSend=>process.send({type:'final',episodeId:input.episodeId??input.nominalScenario?.id,method:input.method,result},resolveSend));
  process.disconnect();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await workerMain();


