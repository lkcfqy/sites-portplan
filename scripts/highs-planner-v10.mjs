import {auditSchedule, rowFor, summarize, validateScenario} from '../src/engine.js';
import {auditFrozenEvents} from '../src/rolling-plan.js';

const FIELDS=['pickupDay', 'unloadDay', 'returnDay'];
const COSTS=['storageCost', 'ddCost', 'totalCost', 'sunkCost', 'incrementalCost'];
const defaultNow=()=>performance.now();
const FEE_EPSILON_KRW=1e-6;
const datesOf=rows=>rows.map(row=>Object.fromEntries(['id',...FIELDS].map(field=>[field,row[field]])));
const feesOf=result=>Object.fromEntries([...COSTS,'objectiveCost'].map(field=>[field,result[field]]));
const changedEvents=(before,after)=>{
  const byId=new Map(before.map(row=>[row.id,row]));
  return after.reduce((sum,row)=>sum+FIELDS.filter(field=>row[field]!==byId.get(row.id)?.[field]).length,0);
};

function validateInput(s, options) {
  const validation=validateScenario(s);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  const minimum=options.minEventDay??0, fixed=options.fixedEvents??{};
  if (!Number.isInteger(minimum) || minimum<0 || minimum>s.horizonDays) throw new Error('minEventDay must be an integer within the horizon.');
  if (!fixed || typeof fixed!=='object' || Array.isArray(fixed)) throw new Error('fixedEvents must be an object.');
  const ids=new Set(s.containers.map(c=>c.id));
  for (const [id, locks] of Object.entries(fixed)) {
    if (!ids.has(id) || !locks || typeof locks!=='object' || Array.isArray(locks)) throw new Error('Unknown or malformed execution lock container.');
    for (const [field, day] of Object.entries(locks)) if (!FIELDS.includes(field) || !Number.isInteger(day) || day<0 || day>=minimum) throw new Error('Executed event locks must be strictly before minEventDay.');
  }
  if ((options.objectiveMode??s.objectiveMode??'joint')!=='joint') throw new Error('The frozen native HiGHS baseline supports joint incremental fees only.');
}

function audited(s, dates, options) {
  const errors=[], byId=new Map();
  if (!Array.isArray(dates) || dates.length!==s.containers.length) return {valid:false, errors:['Require one complete row per known order.'], rows:[]};
  for (const row of dates) {
    if (!row || !s.containers.some(c=>c.id===row.id) || byId.has(row.id)) { errors.push('Unknown, duplicate or malformed candidate row.'); continue; }
    byId.set(row.id, row);
    for (const field of FIELDS) if (!Number.isInteger(row[field]) || row[field]<0 || row[field]>=s.horizonDays) errors.push(`${row.id}: event date outside horizon.`);
  }
  if (errors.length) return {valid:false, errors, rows:[]};
  const rows=s.containers.map(c=>{ const row=byId.get(c.id); return rowFor(s,c,row.pickupDay,row.unloadDay,row.returnDay); });
  const scheduleAudit=auditSchedule(s,rows), freezeAudit=auditFrozenEvents(rows,options.fixedEvents??{},options.minEventDay??0);
  return {valid:scheduleAudit.valid && freezeAudit.valid, errors:[...scheduleAudit.errors,...freezeAudit.errors], rows, scheduleAudit, freezeAudit};
}

function failure(status, reason) {
  return {policy:'nativeStableHiGHSV10', modelVersion:'v10-native-strict-fee-stability', status, reason, optimality:'not_proven', rows:[], usage:[],
    totalCost:null, incrementalCost:null, storageCost:null, ddCost:null, sunkCost:null, objectiveCost:null, lateCount:null, objectiveMode:'joint'};
}

/** One native process per sequential episode. Importing this Node-only module
 * does not launch Python. ready() may be used before the first decision; its
 * measured startup must then be charged to the common episode budget.
 */
export function createStableHiGHSPlannerV10(configuration={}) {
  const {timeBudgetMs:defaultBudget=200, auditReserveMs=2, initializationTimeoutMs=10000,
    hardOverrunGraceMs=250, pythonExecutable='python3', servicePath=null,
    retainCacheFallback=true, now=defaultNow, ...defaultsInput}=configuration;
  for (const [key,value] of Object.entries({defaultBudget,initializationTimeoutMs})) if (!Number.isFinite(value) || value<=0) throw new Error(`${key} must be positive and finite.`);
  for (const [key,value] of Object.entries({auditReserveMs,hardOverrunGraceMs})) if (!Number.isFinite(value) || value<0) throw new Error(`${key} must be nonnegative and finite.`);
  if (typeof now!=='function' || typeof retainCacheFallback!=='boolean' || typeof pythonExecutable!=='string' || !pythonExecutable) throw new Error('Invalid native planner configuration.');
  const defaults=structuredClone(defaultsInput), pending=new Map();
  let child=null, reader=null, readiness=null, readinessInfo=null, closed=false, busy=false, nextId=1, cached=null, cacheKey=null;
  let stderr='', startupStarted=null, startupWallMs=null, calls=0, solverCalls=0, strictReplacementCount=0, tieRetainedCount=0;

  function rejectPending(error) {
    for (const item of pending.values()) item.reject(error);
    pending.clear();
  }

  function ensureService(timeoutMs=initializationTimeoutMs) {
    if (closed) return Promise.reject(new Error('Native planner is closed.'));
    if (readiness) return readiness;
    startupStarted=performance.now();
    readiness=(async()=>{
      // Node builtins never enter the browser dependency graph; this module is
      // only imported by the offline/worker experiment registry.
      const [{spawn},{createInterface},{fileURLToPath}]=await Promise.all([import('node:child_process'),import('node:readline'),import('node:url')]);
      if (closed) throw new Error('Native planner was closed during startup.');
      return await new Promise((resolve,reject)=>{
        let settled=false;
        const finishReady=(error,info)=>{
          if (settled) return;
          settled=true; clearTimeout(timer);
          if (error) reject(error);
          else { startupWallMs=performance.now()-startupStarted; readinessInfo={...info,startupWallMs}; resolve(readinessInfo); }
        };
        const timer=setTimeout(()=>{ finishReady(new Error('Python/HiGHS readiness timeout.')); child?.kill('SIGKILL'); },timeoutMs);
        child=spawn(pythonExecutable,['-u',servicePath??fileURLToPath(new URL('./highs-service-v8.py',import.meta.url))],{
          stdio:['pipe','pipe','pipe'],env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1'},
        });
        child.stderr.on('data',chunk=>{ stderr=(stderr+chunk.toString()).slice(-4000); });
        child.stdin.on('error',error=>{ finishReady(error); rejectPending(error); });
        reader=createInterface({input:child.stdout});
        reader.on('line',line=>{
          let message;
          try { message=JSON.parse(line); }
          catch { const error=new Error('Native service emitted malformed JSON.'); finishReady(error); rejectPending(error); child.kill('SIGKILL'); return; }
          if (message.type==='ready') finishReady(null,message);
          else if (message.type==='result' && pending.has(message.id)) {
            const item=pending.get(message.id); pending.delete(message.id); item.resolve(message.result);
          }
        });
        child.on('error',error=>{ finishReady(error); rejectPending(error); });
        child.on('exit',(code,signal)=>{
          const error=new Error(`Native service exited (${signal??code}).${stderr?' '+stderr:''}`);
          finishReady(error); rejectPending(error); reader?.close();
        });
      });
    })();
    return readiness;
  }

  async function requestService(s,options,deadline) {
    await ensureService();
    const remaining=deadline-now();
    if (remaining<=auditReserveMs) return {status:'time_limit',reason:'Call budget exhausted before IPC/native solve.',rows:[],hasIncumbent:false,solverStatus:null,solverTimeLimitMs:0};
    const id=nextId++;
    const request={id,scenario:s,fixedEvents:options.fixedEvents??{},minEventDay:options.minEventDay??0,
      objectiveMode:'joint',auditReserveMs,deadlineUnixMs:Date.now()+remaining};
    // Serialization, pipe delivery and Python JSON parsing occur after the
    // absolute deadline has been fixed, so none receives a fresh allowance.
    const encoded=JSON.stringify(request)+'\n';
    if (now()>=deadline) return {status:'time_limit',reason:'Call budget exhausted during input serialization.',rows:[],hasIncumbent:false,solverStatus:null,solverTimeLimitMs:0};
    solverCalls++;
    return await new Promise((resolve,reject)=>{
      pending.set(id,{resolve,reject});
      child.stdin.write(encoded,error=>{
        if (error && pending.has(id)) { pending.delete(id); reject(error); }
      });
    });
  }

  async function planner(scenario,callOptions={}) {
    if (closed) throw new Error('Native planner is closed.');
    if (busy) throw new Error('One native planner accepts sequential calls from one episode only.');
    const started=now(),s=structuredClone(scenario),options={...structuredClone(defaults),...structuredClone(callOptions)};
    const budget=options.timeBudgetMs??(options.timeLimitSeconds!==undefined?options.timeLimitSeconds*1000:defaultBudget);
    if (!Number.isFinite(budget) || budget<=0) throw new Error('timeBudgetMs must be positive and finite.');
    validateInput(s,options);
    busy=true; calls++;
    const deadline=started+budget,stages={},minimum=options.minEventDay??0;
    // Changes in capacities and tariffs are intentionally absent: a cached plan
    // is always repriced and reaudited against the entire CURRENT snapshot.
    const episodeKey=JSON.stringify({horizonStart:s.horizonStart,horizonDays:s.horizonDays,operations:s.operations??{},
      containers:s.containers.map(c=>[c.id,c.sizeFt,c.releaseDay,c.unloadDays,c.dueDay,c.dischargeDateTime])});
    let best=null,source='no_complete_plan',native=null,timer=null,hardTimeout=false,rejectedCandidate=false;
    const selection={rule:'strict_fee_replacement_retain_ties',feeEpsilonKRW:FEE_EPSILON_KRW,
      cacheStatus:cached?cacheKey!==episodeKey?'different_episode':!retainCacheFallback?'fallback_disabled':'deadline_expired':'absent',cacheValid:false,
      beforeDates:cached&&cacheKey===episodeKey?structuredClone(cached):null,beforeFees:null,
      proposalDates:null,proposalFees:null,afterDates:null,afterFees:null,
      nativeCostMinusCacheKRW:null,cacheCostMinusSelectedKRW:null,changedEventCount:null,proposalChangedEventCount:null,
      decisionReason:'no_valid_candidate',selectedSource:source,
      cacheGate:{auditFinishedAtMs:null,selectionFinishedAtMs:null,acceptedAtMs:null},
      nativeGate:{receivedAtMs:null,copiedAtMs:null,auditFinishedAtMs:null,feesMatchedAtMs:null,selectionFinishedAtMs:null,acceptedAtMs:null,outcome:'not_requested'}};
    const metadata=()=>({method:'v10-native-strict-fee-stability',decisionCalls:calls,solverCalls,candidateSource:source,
      timeBudgetMs:budget,wallTimeMs:now()-started,deadlineOverrunMs:Math.max(0,now()-deadline),cooperativeDeadline:true,
      hardOverrunGraceMs,hardTimeout,solverThreads:1,retainCacheFallback,stages,
      strictReplacementCount,tieRetainedCount,stabilitySelection:selection,
      startupWallMs,readyCalledBeforeDecision:stages.readyAtCallStart,
      nativeService:readinessInfo,nativeCertificate:native,
      budgetScope:'clone + validation + cache audit + lazy startup if needed + serialization/IPC + Python model/solve/audit + JS audit',
      optimalityScope:'current observed deterministic model only; never rolling policy optimum'});
    try {
      stages.readyAtCallStart=Boolean(readinessInfo);
      if (cached && cacheKey===episodeKey && retainCacheFallback && now()<deadline) {
        const checked=audited(s,cached,options);
        selection.cacheGate.auditFinishedAtMs=now()-started;
        selection.cacheValid=checked.valid;selection.cacheStatus=checked.valid?'valid':'invalid';
        stages.cacheAudit={...checked,rows:undefined};
        if(checked.rows.length===s.containers.length)selection.beforeFees=feesOf(summarize(s,'nativeStableHiGHSV10',checked.rows,0,'feasible',{objectiveMode:'joint'}));
        if (checked.valid) {
          const candidate=summarize(s,'nativeStableHiGHSV10',checked.rows,now()-started,'feasible',{objectiveMode:'joint',optimality:'retained_audited_incumbent_not_reoptimized'});
          const cacheSelection={afterDates:datesOf(candidate.rows),afterFees:feesOf(candidate),cacheCostMinusSelectedKRW:0,changedEventCount:0,decisionReason:'retain_without_timely_valid_native',selectedSource:'cached_incumbent'};
          selection.cacheGate.selectionFinishedAtMs=now()-started;
          const acceptedAt=now();
          if (acceptedAt<=deadline) {
            best=candidate; source='cached_incumbent';Object.assign(selection,cacheSelection);
            selection.cacheGate.acceptedAtMs=acceptedAt-started;
          }
        }
      }
      if (now()+auditReserveMs<deadline) {
        const timeout=new Promise(resolve=>{
          timer=setTimeout(()=>{
            hardTimeout=true; child?.kill('SIGKILL');
            resolve({status:'time_limit',reason:'Native call exceeded the whole-call deadline plus declared hard overrun grace.',rows:[],hasIncumbent:false,solverStatus:null,hardTimeout:true});
          },Math.max(1,deadline-now()+hardOverrunGraceMs));
        });
        try { native=await Promise.race([requestService(s,options,deadline),timeout]); }
        catch (error) { native={status:'solver_error',reason:error instanceof Error?error.message:String(error),rows:[],hasIncumbent:false,solverStatus:null}; }
        finally { clearTimeout(timer); }
        selection.nativeGate.receivedAtMs=now()-started;
        selection.nativeGate.outcome='no_incumbent';
        stages.native={status:native.status,solverStatus:native.solverStatus??null,hasIncumbent:Boolean(native.hasIncumbent)};
        if (native.hasIncumbent) {
          const proposal=structuredClone(native.rows);
          selection.proposalDates=Array.isArray(proposal)?proposal.map(row=>row&&typeof row==='object'?Object.fromEntries(['id',...FIELDS].map(field=>[field,row[field]])):row):null;
          selection.nativeGate.copiedAtMs=now()-started;
          const checked=audited(s,proposal,options);
          selection.nativeGate.auditFinishedAtMs=now()-started;
          stages.native.audit={...checked,rows:undefined};
          if(checked.rows.length===s.containers.length)selection.proposalFees=feesOf(summarize(s,'nativeStableHiGHSV10',checked.rows,0,'feasible',{objectiveMode:'joint'}));
          if (!checked.valid) {rejectedCandidate=true;selection.nativeGate.outcome='audit_failed';}
          if (checked.valid) {
            const result=summarize(s,'nativeStableHiGHSV10',checked.rows,now()-started,native.provenOptimal?'optimal':'feasible',{
              objectiveMode:'joint',optimality:native.provenOptimal?'current_observed_model_optimal_with_solver_tolerances':'current_observed_model_feasible_incumbent',
            });
            selection.proposalFees=feesOf(result);
            if(selection.cacheValid&&selection.beforeFees){
              selection.nativeCostMinusCacheKRW=result.objectiveCost-selection.beforeFees.objectiveCost;
              selection.proposalChangedEventCount=changedEvents(selection.beforeDates,selection.proposalDates);
            }
            // Both languages independently recompute fees from dates. Python
            // costs never overwrite the product engine's canonical row prices.
            const costMatch=result.objectiveCost===native.objectiveCost && COSTS.every(key=>result[key]===native.independentCosts?.[key]);
            stages.native.independentCostsMatch=costMatch;
            selection.nativeGate.feesMatchedAtMs=now()-started;
            if (!costMatch) {rejectedCandidate=true;selection.nativeGate.outcome='fee_mismatch';}
            if (checked.valid && costMatch) {
              const hasCurrentCache=best&&source==='cached_incumbent';
              const difference=hasCurrentCache?result.objectiveCost-best.objectiveCost:null;
              const strictReplacement=hasCurrentCache&&difference < -FEE_EPSILON_KRW;
              const nativeSelected=!hasCurrentCache||strictReplacement;
              const decisionReason=nativeSelected?strictReplacement?'strict_fee_replacement':selection.cacheStatus==='invalid'?'replace_invalid_cache':'initialize_native':Math.abs(difference)<=FEE_EPSILON_KRW?'retain_fee_tie':'retain_costlier_native';
              const proposedSelection={afterDates:datesOf((nativeSelected?result:best).rows),afterFees:feesOf(nativeSelected?result:best),
                cacheCostMinusSelectedKRW:selection.cacheValid&&selection.beforeFees?selection.beforeFees.objectiveCost-(nativeSelected?result:best).objectiveCost:null,
                changedEventCount:selection.cacheValid?changedEvents(selection.beforeDates,datesOf((nativeSelected?result:best).rows)):null,
                decisionReason,selectedSource:nativeSelected?'native_highs':'cached_incumbent'};
              selection.nativeGate.selectionFinishedAtMs=now()-started;
              const acceptedAt=now();
              if (acceptedAt<=deadline) {
                Object.assign(selection,proposedSelection);
                selection.nativeGate.outcome=decisionReason;
                if(nativeSelected){best=result;source='native_highs';selection.nativeGate.acceptedAtMs=acceptedAt-started;}
                if(strictReplacement)strictReplacementCount++;
                else if(hasCurrentCache&&Math.abs(difference)<=FEE_EPSILON_KRW)tieRetainedCount++;
              }else {stages.native.lateCandidateDiscarded=true;selection.nativeGate.outcome='late_candidate';}
            }
          }
        }
        if (native.provenInfeasible && best) stages.native.infeasibilityContradictsAuditedIncumbent=true;
      } else stages.native={status:'budget_skipped',reason:'No time remains after input/cached-candidate work.'};
      if (best) {
        cached=best.rows.map(row=>Object.fromEntries(['id',...FIELDS].map(field=>[field,row[field]]))); cacheKey=episodeKey;
        return {...best,modelVersion:'v10-native-strict-fee-stability',runtimeMs:now()-started,plannerMetadata:metadata(),
          solver:'HiGHS via scipy.optimize.milp',solverStatus:native?.solverStatus??null,
          executionConstraints:{minEventDay:minimum,lockedEventCount:Object.values(options.fixedEvents??{}).reduce((sum,locks)=>sum+Object.keys(locks).length,0)}};
      }
      const late=now()>deadline || hardTimeout;
      const status=late?'time_limit':rejectedCandidate?'audit_failed':native?.provenInfeasible?'infeasible':native?.status==='solver_error'?'solver_error':'time_limit';
      const reason=late?'No complete candidate passed both audits within the whole-call budget.':rejectedCandidate?'Native incumbent rejected by independent dates, execution-lock or fee reconciliation audit.':native?.reason??'Whole-call budget consumed before native planning.';
      return {...failure(status,reason),runtimeMs:now()-started,plannerMetadata:metadata(),solverStatus:native?.solverStatus??null};
    } finally { busy=false; clearTimeout(timer); }
  }

  planner.ready=async({timeoutMs=initializationTimeoutMs}={})=>{
    if (!Number.isFinite(timeoutMs) || timeoutMs<=0) throw new Error('Readiness timeout must be positive and finite.');
    return await ensureService(timeoutMs);
  };
  planner.close=async()=>{
    if (closed) return;
    closed=true;
    rejectPending(new Error('Native planner was closed.'));
    reader?.close();
    if (child && child.exitCode===null && child.signalCode===null) {
      child.stdin.end(); child.kill('SIGTERM');
      await new Promise(resolve=>{
        const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},500);
        child.once('exit',()=>{clearTimeout(timer);resolve();});
      });
    }
  };
  return planner;
}
