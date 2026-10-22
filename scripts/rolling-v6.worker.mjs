import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

const FEE_FIELDS=['totalCost','incrementalCost','storageCost','ddCost','sunkCost','objectiveCost','lateCount'];
const COUNTERS=['decisionCalls','solverCalls','constructorCalls','reusedPlans','replannedDueToInvalid','planningWallMs'];
const FEASIBLE=new Set(['feasible','optimal']);

export function unknownEpisodeV6(method,reason,status='worker_error') {
  return {policy:method,status,complete:false,optimality:'not_proven',auditValid:false,executionHistoryUnavailable:true,
    rows:[],usage:[],timeline:[],executedEvents:[],revisionCount:null,finalState:null,failure:{kind:'execution_history_unavailable',reason},
    ...Object.fromEntries(FEE_FIELDS.map(key=>[key,null])),plannerTrace:[],plannerStats:Object.fromEntries(COUNTERS.map(key=>[key,null]))};
}

/** Factory receives only causal snapshots supplied by the unchanged rolling core. */
export async function runEpisodeV6(input) {
  const {nominalScenario,events,method}=input;
  const configuration=input.callBudgets?.[method]??{timeLimitSeconds:.2,...(method.endsWith('V6')?{timeBudgetMs:200}:{})};
  const oldLimit=configuration.timeLimitSeconds??.2,recoveryBudget=configuration.timeBudgetMs??200;
  const [{solveOptimized,auditSchedule},{runRollingScenario,realizeCapacityEvents},{independentAuditV2}]=await Promise.all([
    import('../src/engine.js'),import('../src/rolling-plan.js'),import('./benchmark-v2.mjs'),
  ]);
  let planner;
  if(method==='dailyReoptV4')planner=(s,o)=>solveOptimized(s,{...o,timeLimitSeconds:oldLimit});
  else if(method==='stableRetainV5') {
    const {createStablePlanner}=await import('../src/stable-planner-v5.js');
    planner=createStablePlanner(configuration);
  } else if(method==='lockedRecoveryV6') {
    const {createRecoveryPlanner}=await import('../src/recovery-planner-v6.js');
    planner=createRecoveryPlanner(configuration);
  } else if(method==='persistenceRecoveryV6') {
    const {createPersistencePlanner}=await import('../src/persistence-planner-v6.js');
    planner=createPersistencePlanner(configuration);
  } else throw new Error(`Unknown V6 rolling method: ${method}`);
  const trace=[],callWallMs=[];
  let calls=0,planningWallMs=0,latest={decisionCalls:0,solverCalls:0,constructorCalls:0,reusedPlans:0,replannedDueToInvalid:0};
  const result=await runRollingScenario(nominalScenario,events,{timeLimitSeconds:oldLimit,objectiveMode:'joint',planner:async(snapshot,options)=>{
    calls++;const began=performance.now();let candidate,error;
    try {
      candidate=await planner(snapshot,{...options,...(method.endsWith('V6')?{timeBudgetMs:recoveryBudget}:{})});
      if(method==='dailyReoptV4')latest={decisionCalls:calls,solverCalls:calls,constructorCalls:0,reusedPlans:0,replannedDueToInvalid:0,
        candidateSource:'daily_solver',accepted:FEASIBLE.has(candidate?.status)};
      else {
        const metadata=candidate?.plannerMetadata;
        latest={...structuredClone(metadata??{}),decisionCalls:calls,
          constructorCalls:method==='stableRetainV5'?0:metadata?.constructorCalls??null,
          solverCalls:metadata?.solverCalls??null,reusedPlans:metadata?.reusedPlans??null,replannedDueToInvalid:metadata?.replannedDueToInvalid??null};
      }
      return candidate;
    } catch(thrown) {
      error=String(thrown.message??thrown);
      latest={decisionCalls:calls,solverCalls:method==='dailyReoptV4'?calls:null,constructorCalls:method.endsWith('V6')?null:0,
        reusedPlans:method==='dailyReoptV4'?0:null,replannedDueToInvalid:method==='dailyReoptV4'?0:null,candidateSource:'planner_exception',accepted:false};
      throw thrown;
    } finally {
      const elapsed=performance.now()-began;callWallMs.push(elapsed);planningWallMs+=elapsed;
      trace.push({day:options.minEventDay,...structuredClone(latest),callWallMs:elapsed,plannerStatus:candidate?.status??'planner_error',...(error?{error}:{})});
    }
  }});
  result.policy=method;result.plannerTrace=trace;
  result.plannerStats={...latest,decisionCalls:calls,planningWallMs,callWallMs,maxCallWallMs:Math.max(0,...callWallMs)};
  result.executionHistoryUnavailable=false;
  result.perCallBudget={legacySolverSeconds:oldLimit,recoveryBudgetMs:method.endsWith('V6')?recoveryBudget:null,
    interpretation:method.endsWith('V6')?'cooperative total-call budget, not a parent hard timer':'solver-internal time limit; initialization/model/audit extra, not a total-call hard timer'};
  if(result.complete===true&&FEASIBLE.has(result.status)) {
    let engineAudit,independentErrors;
    try {
      const actual=realizeCapacityEvents(nominalScenario,events);
      engineAudit=auditSchedule(actual,result.rows);independentErrors=independentAuditV2(actual,result);
    } catch(error) {engineAudit={valid:false,errors:[String(error.message??error)]};independentErrors=[];}
    result.terminalAudit={engine:engineAudit,independentErrors};
    result.auditErrors=[...engineAudit.errors,...independentErrors];result.auditValid=result.auditErrors.length===0;
    if(!result.auditValid) {
      result.status='audit_failed';result.complete=false;result.rows=[];result.usage=[];
      for(const key of FEE_FIELDS)result[key]=null;
      result.failure={kind:'terminal_audit_failed',reason:'Delivered complete execution failed terminal engine or independent fee/resource audit.',errors:result.auditErrors};
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
  try {result=await runEpisodeV6(input);}
  catch(error) {result=unknownEpisodeV6(input.method,String(error.stack??error));}
  await new Promise(resolveSend=>process.send({type:'final',episodeId:input.episodeId??input.nominalScenario?.id,method:input.method,result},resolveSend));
  process.disconnect();
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await workerMain();
