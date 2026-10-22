import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

const FEE_FIELDS=['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost','lateCount'];
export const CALL_COUNTERS_V7=['decisionCalls','solverCalls','constructorCalls','reusedPlans','replannedDueToInvalid','planningWallMs'];
const FEASIBLE=new Set(['feasible','optimal']);
const DATE_PROOFS=new Set(['beforeDates','afterDates']);
const DEBUG_KEYS=new Set(['model','modelObject','lp','subjectTo','binaries','vars','selectedTrips','eventDomains']);
export const DEFAULT_FACTORIES_V7={
  dailyReoptV4:{module:'src/engine.js',export:'solveOptimized',kind:'function'},
  stableRetainV5:{module:'src/stable-planner-v5.js',export:'createStablePlanner',kind:'factory'},
  lockedRecoveryV6:{module:'src/recovery-planner-v6.js',export:'createRecoveryPlanner',kind:'factory'},
  costPolishV7:{module:'src/cost-recovery-v7.js',export:'createCostRecoveryPlanner',kind:'factory'},
  graspBaselineV7:{module:'src/grasp-planner-v7.js',export:'createGraspPlanner',kind:'factory'},
};
const hash=value=>{try{return createHash('sha256').update(JSON.stringify(value)).digest('hex');}catch{return null;}};

/** Compress only planner diagnostics, never physical history or date proofs. */
export function compactPlannerMetadataV7(input,omissions={}) {
  for(const key of ['rows','debugObjects','arrayElements','stringCharacters','circularReferences'])omissions[key]??=0;
  const ancestors=new Set();
  function compact(value,key='') {
    if(value===null||value===undefined||typeof value==='number'||typeof value==='boolean')return value;
    if(typeof value==='string') {
      if(value.length<=8192)return value;
      omissions.stringCharacters+=value.length;
      return {omittedStringCharacters:value.length,sha256:hash(value),prefix:value.slice(0,256)};
    }
    if(typeof value!=='object')return String(value);
    if(ancestors.has(value)){omissions.circularReferences++;return {omittedCircularReference:true};}
    if(DATE_PROOFS.has(key)) {
      if(!Array.isArray(value))throw new Error(`${key} date proof must be an array.`);
      return value.map(row=>({id:row.id,pickupDay:row.pickupDay,unloadDay:row.unloadDay,returnDay:row.returnDay}));
    }
    if((key==='rows'||key==='cachedRows')&&Array.isArray(value)) {
      omissions.rows+=value.length;
      const dates=value.map(row=>row&&typeof row==='object'?{id:row.id,pickupDay:row.pickupDay,unloadDay:row.unloadDay,returnDay:row.returnDay}:row);
      return {omittedDuplicateRows:value.length,dateSHA256:hash(dates),pricingRowsNotArchived:true};
    }
    if(DEBUG_KEYS.has(key)||ArrayBuffer.isView(value)) {
      omissions.debugObjects++;
      ancestors.add(value);
      const evidence=typeof value==='object'&&!Array.isArray(value)&&!ArrayBuffer.isView(value)&&key!=='vars'?
        Object.fromEntries(Object.entries(value).filter(([name,item])=>/audit|bound|status|source|time|clock/i.test(name)||item===null||typeof item!=='object')
          .map(([name,item])=>[name,compact(item,name)])):{};
      ancestors.delete(value);const sha256=hash(value);
      return {omittedDebugValue:true,valueType:Array.isArray(value)?'array':ArrayBuffer.isView(value)?value.constructor.name:'object',
        elementCount:Array.isArray(value)||ArrayBuffer.isView(value)?value.length:Object.keys(value).length,sha256,
        ...(sha256===null?{hashUnavailableReason:'not JSON-serializable'}:{}),evidence};
    }
    if(Array.isArray(value)&&value.length>128&&key!=='errors'&&key!=='auditErrors') {
      omissions.arrayElements+=value.length;
      return {omittedArrayElements:value.length,sha256:hash(value)};
    }
    ancestors.add(value);
    const result=Array.isArray(value)?value.map(item=>compact(item,key)):
      Object.fromEntries(Object.entries(value).map(([name,item])=>[name,compact(item,name)]));
    ancestors.delete(value);return result;
  }
  const result=compact(input??{});
  // The method deliberately references the same proof at two paths. Keep its
  // complete canonical copy at the top-level trace, with an explicit stage ref.
  if(result.polishMetadata&&result.stages?.locked_constructor?.constructorMetadata?.costPolish) {
    const proof=result.stages.locked_constructor.constructorMetadata.costPolish;
    result.stages.locked_constructor.constructorMetadata.costPolish={
      metadataRef:'plannerTrace[this_call].polishMetadata',attempted:proof.attempted,
      seedAccepted:proof.seedAccepted,
      seedIncrementalCost:proof.seedIncrementalCost,finalIncrementalCost:proof.finalIncrementalCost,
      jointNonincrease:proof.jointNonincrease,acceptedMoves:proof.acceptedMoves,
    };
  }
  return result;
}

export function unknownEpisodeV7(method,reason,status='worker_error') {
  return {policy:method,status,complete:false,optimality:'not_proven',auditValid:false,executionHistoryUnavailable:true,
    rows:[],usage:[],timeline:[],executedEvents:[],revisionCount:null,finalState:null,failure:{kind:'execution_history_unavailable',reason},
    ...Object.fromEntries(FEE_FIELDS.map(key=>[key,null])),plannerTrace:[],plannerStats:Object.fromEntries(CALL_COUNTERS_V7.map(key=>[key,null])),telemetryOmissions:null};
}

export async function createEpisodePlannerV7(method,configuration,registry=DEFAULT_FACTORIES_V7) {
  const definition=registry[method];
  if(!definition||!/^src\/[A-Za-z0-9_/-]+\.js$/.test(definition.module)||definition.module.split('/').includes('..'))throw new Error('Invalid declared planner factory.');
  const module=await import(new URL('../'+definition.module,import.meta.url));
  const exported=module[definition.export];if(typeof exported!=='function')throw new Error(`Missing planner export ${definition.export}.`);
  if(definition.kind==='function')return (snapshot,options)=>exported(snapshot,{...configuration,...options});
  if(definition.kind!=='factory')throw new Error('Declared planner kind must be function or factory.');
  const planner=exported(configuration);if(typeof planner!=='function')throw new Error('Planner factory did not return a callable planner.');
  return planner;
}

/** The simulator owns future shocks; each fresh factory sees only its snapshots. */
export async function runEpisodeV7(input) {
  const {nominalScenario,events,method}=input,configuration=input.callBudgets?.[method];
  if(!configuration)throw new Error('Missing frozen method call configuration.');
  const [{auditSchedule},{runRollingScenario,realizeCapacityEvents},{independentAuditV2}]=await Promise.all([
    import('../src/engine.js'),import('../src/rolling-plan.js'),import('./benchmark-v2.mjs'),
  ]);
  const planner=await createEpisodePlannerV7(method,configuration,input.methodFactories??DEFAULT_FACTORIES_V7);
  const legacy=method==='dailyReoptV4'||method==='stableRetainV5';
  const trace=[],callWallMs=[],omissions={};
  let calls=0,planningWallMs=0,latest={};
  const result=await runRollingScenario(nominalScenario,events,{timeLimitSeconds:configuration.timeLimitSeconds??.2,objectiveMode:'joint',planner:async(snapshot,options)=>{
    calls++;const began=performance.now();let candidate,error,metadata;
    try {
      candidate=await planner(snapshot,{...options,...(!legacy?{timeBudgetMs:configuration.timeBudgetMs}:{})});
      metadata=method==='dailyReoptV4'?{decisionCalls:calls,solverCalls:calls,constructorCalls:0,reusedPlans:0,replannedDueToInvalid:0,
        candidateSource:'daily_solver',accepted:FEASIBLE.has(candidate?.status)}:candidate?.plannerMetadata??{};
      latest={...Object.fromEntries(Object.entries(metadata).filter(([,value])=>value===null||['number','boolean','string'].includes(typeof value))),
        decisionCalls:calls,solverCalls:metadata.solverCalls??null,constructorCalls:method==='stableRetainV5'?0:metadata.constructorCalls??null,
        reusedPlans:metadata.reusedPlans??null,replannedDueToInvalid:metadata.replannedDueToInvalid??null,candidateSource:metadata.candidateSource??null};
      return candidate;
    } catch(thrown) {
      error=String(thrown.message??thrown);metadata={candidateSource:'planner_exception',accepted:false};
      latest={decisionCalls:calls,solverCalls:method==='dailyReoptV4'?calls:null,constructorCalls:legacy?0:null,
        reusedPlans:method==='dailyReoptV4'?0:null,replannedDueToInvalid:method==='dailyReoptV4'?0:null,candidateSource:'planner_exception'};
      throw thrown;
    } finally {
      const compact=compactPlannerMetadataV7(metadata,omissions);
      const elapsed=performance.now()-began;callWallMs.push(elapsed);planningWallMs+=elapsed;
      trace.push({day:options.minEventDay,...compact,...latest,callWallMs:elapsed,plannerStatus:candidate?.status??'planner_error',...(error?{error}:{})});
    }
  }});
  result.policy=method;result.plannerTrace=trace;
  // Full latest metadata used to duplicate all cached fee rows a second time.
  result.plannerStats={...latest,decisionCalls:calls,planningWallMs,callWallMs,maxCallWallMs:Math.max(0,...callWallMs)};
  result.executionHistoryUnavailable=false;
  result.telemetryOmissions={...omissions,policy:'Planner debug/cache pricing rows and large model arrays summarized; complete physical timeline/state/audits and polish before/after date proofs retained.'};
  result.perCallBudget={configuration,interpretation:legacy?'legacy optimizer-internal seconds; setup/audit extra':'cooperative whole-call milliseconds; not a hard per-call timer'};
  if(result.complete===true&&FEASIBLE.has(result.status)) {
    let engineAudit,independentErrors;
    try {
      const actual=realizeCapacityEvents(nominalScenario,events);
      engineAudit=auditSchedule(actual,result.rows);independentErrors=independentAuditV2(actual,result);
    } catch(error) {engineAudit={valid:false,errors:[String(error.message??error)]};independentErrors=[];}
    result.terminalAudit={engine:engineAudit,independentErrors};result.auditErrors=[...engineAudit.errors,...independentErrors];
    result.auditValid=result.auditErrors.length===0;
    if(!result.auditValid) {
      result.status='audit_failed';result.complete=false;result.rows=[];result.usage=[];
      for(const key of FEE_FIELDS)result[key]=null;
      result.failure={kind:'terminal_audit_failed',reason:'Complete execution failed the terminal dual audit.',errors:result.auditErrors};
    }
  } else {
    result.auditValid=false;result.rows=[];
    for(const key of FEE_FIELDS)result[key]=null;
  }
  return result;
}

async function workerMain() {
  const input=await new Promise(resolveInput=>process.once('message',resolveInput));
  let result;
  try{result=await runEpisodeV7(input);}catch(error){result=unknownEpisodeV7(input.method,String(error.stack??error));}
  await new Promise(resolveSend=>process.send({type:'final',episodeId:input.episodeId??input.nominalScenario?.id,method:input.method,result},resolveSend));
  process.disconnect();
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await workerMain();
