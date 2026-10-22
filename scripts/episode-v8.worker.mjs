import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {compactPlannerMetadataV7,unknownEpisodeV7} from './rolling-v7.worker.mjs';

const FEASIBLE=new Set(['feasible','optimal']);
const FEE_FIELDS=['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost','lateCount'];
/** This is an allow-list, not an input-controlled module loader. */
export const METHOD_REGISTRY_V8=Object.freeze({
  stableRetainV5:Object.freeze({module:'src/stable-planner-v5.js',export:'createStablePlanner'}),
  lockedRecoveryV6:Object.freeze({module:'src/recovery-planner-v6.js',export:'createRecoveryPlanner'}),
  costPolishV7:Object.freeze({module:'src/cost-recovery-v7.js',export:'createCostRecoveryPlanner'}),
  adaptiveV8:Object.freeze({module:'src/adaptive-planner-v8.js',export:'createAdaptivePlanner'}),
  highsV8:Object.freeze({module:'scripts/highs-planner-v8.mjs',export:'createHiGHSPlanner'}),
});
export const METHODS_V8=Object.freeze(Object.keys(METHOD_REGISTRY_V8));
export const unknownEpisodeV8=unknownEpisodeV7;

/** Debug compaction must never shorten an adaptive decision explanation/proof.
 * Preserve those canonical fields verbatim before compacting duplicated cache/LP
 * diagnostics. Physical timeline, observations and execution dates bypass this.
 */
export function compactPlannerMetadataV8(metadata={},omissions={}) {
  const result=compactPlannerMetadataV7(metadata,omissions);
  for(const [key,value] of Object.entries(metadata)) {
    if(/adaptive|decision|explanation|reason|beforeDates|afterDates|feeOpportunity|pressureProxy|phaseWallMs|cacheStatus|dateChanges|selection/i.test(key)&&value&&typeof value==='object')result[key]=structuredClone(value);
  }
  return result;
}

export async function createEpisodePlannerV8(method,configuration) {
  if(!Object.hasOwn(METHOD_REGISTRY_V8,method))throw new Error('Unknown V8 method; only the fixed method registry is allowed.');
  const definition=METHOD_REGISTRY_V8[method],module=await import(new URL('../'+definition.module,import.meta.url));
  const factory=module[definition.export];
  if(typeof factory!=='function')throw new Error(`Missing allowed planner export ${definition.export}.`);
  const planner=await factory(configuration);
  if(typeof planner!=='function')throw new Error('Planner factory must return a callable planner.');
  return planner;
}

/** The simulator owns future events. Factories receive only fixed configuration;
 * each call gets only the current public snapshot and execution constraints. */
export async function runEpisodeV8(input) {
  const {method,nominalScenario,events}=input,configuration=input.callBudgets?.[method];
  if(!Object.hasOwn(METHOD_REGISTRY_V8,method)||!configuration)throw new Error('Missing allowed method/call-budget configuration.');
  if(input.methodFactories!==undefined)throw new Error('Input-controlled planner registries are forbidden.');
  if(!Number.isInteger(input.algorithmSeed))throw new Error('Each V8 episode requires its predeclared algorithm seed.');
  const startupStarted=performance.now();
  const [{auditSchedule},{runRollingScenario,realizeCapacityEvents},{independentAuditV2}]=await Promise.all([
    import('../src/engine.js'),import('../src/rolling-plan.js'),import('./benchmark-v2.mjs'),
  ]);
  const planner=await createEpisodePlannerV8(method,{...configuration,seed:input.algorithmSeed});
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
        candidate=await planner(snapshot,{...options,seed:input.algorithmSeed,...(method!=='stableRetainV5'?{timeBudgetMs:configuration.timeBudgetMs??200}:{})});
        metadata=candidate?.plannerMetadata??{};
        latest={...Object.fromEntries(Object.entries(metadata).filter(([,value])=>value===null||['number','boolean','string'].includes(typeof value))),
          decisionCalls:calls,solverCalls:metadata.solverCalls??null,constructorCalls:method==='stableRetainV5'?0:metadata.constructorCalls??null,
          reusedPlans:metadata.reusedPlans??null,replannedDueToInvalid:metadata.replannedDueToInvalid??null,candidateSource:metadata.candidateSource??null};
        return candidate;
      }catch(thrown){
        error=String(thrown.message??thrown);metadata={candidateSource:'planner_exception',accepted:false};
        latest={decisionCalls:calls,solverCalls:null,constructorCalls:null,reusedPlans:null,replannedDueToInvalid:null,candidateSource:'planner_exception'};
        throw thrown;
      }finally{
        const compact=compactPlannerMetadataV8(metadata,omissions),elapsed=performance.now()-began;
        callWallMs.push(elapsed);planningWallMs+=elapsed;
        trace.push({day:options.minEventDay,...compact,...latest,callWallMs:elapsed,plannerStatus:candidate?.status??'planner_error',...(error?{error}:{})});
      }
    }});
    result.policy=method;result.algorithmSeed=input.algorithmSeed;result.repeatIndex=input.repeatIndex;
    result.plannerTrace=trace;result.plannerStats={...latest,decisionCalls:calls,planningWallMs,callWallMs,maxCallWallMs:Math.max(0,...callWallMs)};
    result.executionHistoryUnavailable=false;result.startupWallMs=startupWallMs;
    result.telemetryOmissions={...omissions,policy:'Only duplicate cache prices and debug/model arrays compacted; adaptive decisions, date proofs and physical history retained.'};
    result.perCallBudget={configuration,interpretation:method==='stableRetainV5'?'legacy solver-internal seconds; setup/audit extra':'cooperative whole-call milliseconds; native IPC/model/audit included; initialization separately charged to parent episode'};
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
  try{result=await runEpisodeV8(input);}catch(error){result=unknownEpisodeV8(input.method,String(error.stack??error));}
  await new Promise(resolveSend=>process.send({type:'final',episodeId:input.episodeId??input.nominalScenario?.id,method:input.method,result},resolveSend));
  process.disconnect();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await workerMain();
