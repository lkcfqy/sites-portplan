import {auditSchedule, capacityAt, containerCost, operationParameters, returnOffset, rowFor, summarize, validateScenario} from './engine.js';
import {auditFrozenEvents} from './rolling-plan.js';
import {createCostRecoveryPlanner, polishCompletePlan} from './cost-recovery-v7.js';

const DAYS=['pickupDay','unloadDay','returnDay'], RESOURCES=['truck','warehouse','staging'];
const SUCCESS=new Set(['optimal','feasible']), CLOCK=()=>performance.now(), EPS=1e-6;
export const ADAPTIVE_V8_DEFAULTS=Object.freeze({timeBudgetMs:200, feeToleranceRatio:0.005, maxChangedEvents:6,
  lookaheadDays:2, pressureGuard:true, opportunityThresholdKRW:0, auditReserveMs:5});
const dates=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const message=error=>error instanceof Error?error.message:String(error);

function validateSettings(o) {
  if(!Number.isFinite(o.timeBudgetMs)||o.timeBudgetMs<=0)throw new Error('V8 timeBudgetMs must be positive and finite.');
  if(!Number.isFinite(o.feeToleranceRatio)||o.feeToleranceRatio<0||o.feeToleranceRatio>1)throw new Error('V8 feeToleranceRatio must be between 0 and 1.');
  if(!Number.isInteger(o.maxChangedEvents)||o.maxChangedEvents<0||o.maxChangedEvents>300)throw new Error('V8 maxChangedEvents must be an integer from 0 to 300.');
  if(!Number.isInteger(o.lookaheadDays)||o.lookaheadDays<1||o.lookaheadDays>7)throw new Error('V8 lookaheadDays must be an integer from 1 to 7.');
  if(typeof o.pressureGuard!=='boolean')throw new Error('V8 pressureGuard must be boolean.');
  if(!Number.isFinite(o.opportunityThresholdKRW)||o.opportunityThresholdKRW<0)throw new Error('V8 opportunityThresholdKRW must be nonnegative and finite.');
  if(!Number.isFinite(o.auditReserveMs)||o.auditReserveMs<0)throw new Error('V8 auditReserveMs must be nonnegative and finite.');
}

function validateInput(s,o) {
  const validation=validateScenario(s);
  if(!validation.valid)throw new Error(validation.errors.join('; '));
  if((o.objectiveMode??s.objectiveMode??'joint')!=='joint')throw new Error('V8 supports the joint fee objective only.');
  const day=o.minEventDay??0, fixed=o.fixedEvents??{}, ids=new Set(s.containers.map(c=>c.id));
  if(!Number.isInteger(day)||day<0||day>s.horizonDays)throw new Error('minEventDay must be an integer within the horizon.');
  if(!fixed||typeof fixed!=='object'||Array.isArray(fixed))throw new Error('fixedEvents must be an object keyed by container id.');
  for(const [id,locks]of Object.entries(fixed)) {
    if(!ids.has(id)||!locks||typeof locks!=='object'||Array.isArray(locks))throw new Error('Invalid fixed-event container.');
    for(const [key,d]of Object.entries(locks))if(!DAYS.includes(key)||!Number.isInteger(d)||d<0||d>=s.horizonDays||d>=day)throw new Error('Execution locks must be valid event dates strictly before minEventDay.');
  }
  for(const resource of RESOURCES)for(let d=0;d<s.horizonDays;d++)if(!Number.isInteger(capacityAt(s[`${resource}Capacity`],d))||capacityAt(s[`${resource}Capacity`],d)<0)throw new Error('Every day must have a finite nonnegative integer capacity.');
}

function auditDates(s,proposals,o) {
  const errors=[],seen=new Set(),containers=new Map(s.containers.map(c=>[c.id,c]));
  if(!Array.isArray(proposals)||proposals.length!==s.containers.length)errors.push('Require one complete proposal per known container.');
  if(Array.isArray(proposals))for(const row of proposals) {
    if(!row||typeof row!=='object'||!containers.has(row.id)||seen.has(row.id)){errors.push('Unknown, duplicate or malformed proposal.');continue;}
    seen.add(row.id);
    for(const key of DAYS)if(!Number.isInteger(row[key])||row[key]<0||row[key]>=s.horizonDays)errors.push(`${row.id}: invalid ${key}.`);
    if(Number.isInteger(row.unloadDay)&&row.unloadDay+containers.get(row.id).unloadDays-1>=s.horizonDays)errors.push(`${row.id}: unloading exceeds the horizon.`);
  }
  if(errors.length)return {valid:false,errors,rows:[]};
  const byId=new Map(proposals.map(row=>[row.id,row]));
  const rows=s.containers.map(c=>{const r=byId.get(c.id);return rowFor(s,c,r.pickupDay,r.unloadDay,r.returnDay);});
  const scheduleAudit=auditSchedule(s,rows),freezeAudit=auditFrozenEvents(rows,o.fixedEvents??{},o.minEventDay??0);
  return {valid:scheduleAudit.valid&&freezeAudit.valid,errors:[...scheduleAudit.errors,...freezeAudit.errors],rows};
}

function episodeKey(s) {
  return JSON.stringify({id:s.id??null,seed:s.seed??null,start:s.horizonStart,horizon:s.horizonDays,operations:operationParameters(s),
    containers:s.containers.map(c=>[c.id,c.sizeFt,c.dischargeDateTime,c.releaseDay,c.unloadDays,c.dueDay]).sort((a,b)=>a[0].localeCompare(b[0]))});
}

function dateChanges(before,after,o) {
  const fixed=o.fixedEvents??{},day=o.minEventDay??0;
  const comparable=Array.isArray(before)&&before.length===after.length&&before.every(row=>row&&typeof row.id==='string'&&DAYS.every(key=>Number.isInteger(row[key])))
    &&new Set(before.map(row=>row.id)).size===after.length&&after.every(row=>before.some(old=>old.id===row.id));
  if(!comparable)return {referenceAvailable:false,pendingEventCount:after.reduce((n,row)=>n+DAYS.filter(key=>!Object.hasOwn(fixed[row.id]??{},key)).length,0),
    changedEventCount:null,nearTermChangedEventCount:null,totalShiftDays:null,weightedChangedEvents:null};
  const previous=new Map(before.map(row=>[row.id,row]));
  let pendingEventCount=0,changedEventCount=0,nearTermChangedEventCount=0,totalShiftDays=0;
  for(const row of after)for(const key of DAYS)if(!Object.hasOwn(fixed[row.id]??{},key)) {
    pendingEventCount++;
    const old=previous.get(row.id)?.[key];
    if(Number.isInteger(old)&&old!==row[key]){changedEventCount++;totalShiftDays+=Math.abs(old-row[key]);if(old<=day+1)nearTermChangedEventCount++;}
  }
  return {referenceAvailable:true,pendingEventCount,changedEventCount,nearTermChangedEventCount,totalShiftDays,
    weightedChangedEvents:changedEventCount+nearTermChangedEventCount,weightRule:'Unexecuted events scheduled today/tomorrow have weight 2; all others weight 1. Diagnostic only.'};
}

function pressureProxy(candidate,day,lookaheadDays) {
  const future=candidate.usage.filter(u=>u.day>day&&u.day<=day+lookaheadDays),resources={};
  for(const resource of RESOURCES) {
    const positive=future.filter(u=>u[`${resource}Capacity`]>0);
    resources[resource]={peakUtilization:positive.length?Math.max(...positive.map(u=>u[resource]/u[`${resource}Capacity`])):0,
      saturatedDays:positive.filter(u=>u[resource]===u[`${resource}Capacity`]).length,
      minimumHeadroom:future.length?Math.min(...future.map(u=>u[`${resource}Capacity`]-u[resource])):null,
      zeroCapacityDays:future.filter(u=>u[`${resource}Capacity`]===0).length};
  }
  return {fromDay:day+1,throughDay:future.at(-1)?.day??null,lookaheadDays,resources,
    interpretation:'Deterministic utilization of supplied future capacity; not a failure probability or knowledge of future shocks. Zero-capacity days are counted, never divided by zero.'};
}

function pressureDoesNotWorsen(before,after) {
  return RESOURCES.every(r=>after.resources[r].peakUtilization<=before.resources[r].peakUtilization+EPS
    &&after.resources[r].saturatedDays<=before.resources[r].saturatedDays);
}

/** Earliest independent dates ignore ALL shared capacities. Monotone public fee
 * functions make this a relaxed lower bound, not a feasible global schedule. */
function feeOpportunity(s,candidate,o,settings,now,deadline) {
  const day=o.minEventDay??0,fixed=o.fixedEvents??{};
  let lower=0,inspectedContainers=0,nearTermOneDayFeeExposureKRW=0;
  const rows=new Map(candidate.rows.map(row=>[row.id,row]));
  for(const c of s.containers) {
    if(now()>=deadline)return {complete:false,inspectedContainers,upperBoundSavingsKRW:null,relaxedLowerBoundKRW:null,
      nearTermOneDayFeeExposureKRW:null,interpretation:'Opportunity calculation stopped at its deadline; no inferred zero opportunity.'};
    const locks=fixed[c.id]??{},p=locks.pickupDay??Math.max(c.releaseDay,day),u=locks.unloadDay??Math.max(p,day),r=locks.returnDay??Math.max(u+returnOffset(s,c),day);
    // A valid cached schedule implies these earliest dates respect its locks.
    if(p<c.releaseDay||u<p||u+c.unloadDays-1>c.dueDay||r<u+returnOffset(s,c)||r>=s.horizonDays)throw new Error('Cached locks contradict the independent date bound.');
    lower+=containerCost(c,p,r,s.horizonStart,s.tariff).incrementalCost;
    const old=rows.get(c.id);
    if(!Object.hasOwn(locks,'pickupDay')&&old.pickupDay<=day+settings.lookaheadDays)
      nearTermOneDayFeeExposureKRW+=containerCost(c,old.pickupDay+1,old.returnDay,s.horizonStart,s.tariff).storageCost-old.storageCost;
    if(!Object.hasOwn(locks,'returnDay')&&old.returnDay<=day+settings.lookaheadDays)
      nearTermOneDayFeeExposureKRW+=containerCost(c,old.pickupDay,old.returnDay+1,s.horizonStart,s.tariff).ddCost-old.ddCost;
    inspectedContainers++;
  }
  return {complete:true,inspectedContainers,baselineIncrementalKRW:candidate.incrementalCost,relaxedLowerBoundKRW:lower,
    upperBoundSavingsKRW:Math.max(0,candidate.incrementalCost-lower),nearTermOneDayFeeExposureKRW,
    interpretation:'Optimistic fee opportunity ignoring shared capacity; one-day fee exposure is not a feasible global delay counterfactual.'};
}

/** Use one factory per sequential known-order episode. Only current snapshots
 * and exact execution locks are accepted. The optional initialDates is an
 * externally supplied, audited common-prefix seed, not an initialization win. */
export function createAdaptivePlanner(configuration={}) {
  const {now:providedNow=CLOCK,solver,seedConstructor,polish=polishCompletePlan,initialDates,...raw}=configuration;
  if(typeof providedNow!=='function'||typeof polish!=='function'||solver!==undefined&&typeof solver!=='function'||seedConstructor!==undefined&&typeof seedConstructor!=='function')throw new Error('Invalid V8 callback or clock.');
  const now=()=>{const value=providedNow();if(!Number.isFinite(value))throw new Error('V8 clock must return finite milliseconds.');return value;};
  const configured=structuredClone(raw),defaultBudget=configured.timeBudgetMs??(configured.timeLimitSeconds!==undefined?configured.timeLimitSeconds*1000:200);
  const settings={...ADAPTIVE_V8_DEFAULTS,...configured,timeBudgetMs:defaultBudget};
  validateSettings(settings);
  if((settings.objectiveMode??'joint')!=='joint')throw new Error('V8 supports the joint fee objective only.');
  const recoverySettings={...configured,now,objectiveMode:'joint',retainFeasible:false,
    ...(solver?{solver}:{}),...(seedConstructor?{seedConstructor}:{})};
  for(const key of ['feeToleranceRatio','maxChangedEvents','lookaheadDays','pressureGuard','opportunityThresholdKRW','timeLimitSeconds'])delete recoverySettings[key];
  recoverySettings.timeBudgetMs=defaultBudget;
  // Validate the existing recovery/polish options before any episode begins.
  createCostRecoveryPlanner(recoverySettings);
  const suppliedInitial=initialDates===undefined?null:structuredClone(initialDates);
  let cached=null,lastKey=null,lastDay=null,initialConsumed=false,busy=false;
  const counters={decisionCalls:0,solverCalls:0,constructorCalls:0,reusedPlans:0,replannedDueToInvalid:0,polishCalls:0};
  return async function adaptivePlanner(scenario,options={}) {
    if(busy)throw new Error('A V8 factory requires sequential calls; use a new factory for each episode.');
    busy=true;
    try {
      const started=now(),s=structuredClone(scenario),o=structuredClone(options),budget=o.timeBudgetMs??(o.timeLimitSeconds!==undefined?o.timeLimitSeconds*1000:defaultBudget);
      if(!Number.isFinite(started)||!Number.isFinite(budget)||budget<=0||!Number.isFinite(started+budget))throw new Error('V8 requires a finite clock and positive whole-call budget.');
      const deadline=started+budget,workDeadline=deadline-settings.auditReserveMs;
      validateInput(s,o);o.objectiveMode='joint';
      const day=o.minEventDay??0,key=episodeKey(s),phaseWallMs={},stages={};
      counters.decisionCalls++;
      const meta={method:'v8-adaptive-stable-fee-replanning',action:'failed',strategyAction:null,decisionReason:null,reason:null,
        cacheStatus:'absent',cacheValid:false,cacheAcceptedBeforeDeadline:false,initialDatesProvided:suppliedInitial!==null,initialDatesAccepted:false,
        parameters:Object.fromEntries(Object.keys(ADAPTIVE_V8_DEFAULTS).filter(k=>k!=='timeBudgetMs').map(k=>[k,settings[k]])),
        wholeCallBudgetMs:budget,cooperativeDeadline:true,policyOptimalityClaim:false,currentSnapshotFeeNonincrease:null,
        phaseWallMs,stages,feeOpportunity:null,dateChanges:null,pressureProxy:null,selection:null};
      if(lastKey!==null&&(key!==lastKey||day<lastDay)){cached=null;meta.cacheStatus=key!==lastKey?'different_episode_reset':'backwards_day_reset';}
      lastKey=key;lastDay=day;
      let best=null,bestAcceptedAtMs=null,referenceDates=null;
      const fail=reason=>({policy:'adaptiveV8',modelVersion:'v8-adaptive-stable-fee',status:'no_feasible_schedule_found',optimality:'not_proven',reason,
        rows:[],usage:[],totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,objectiveCost:null,lateCount:null,objectiveMode:'joint'});
      const finish=(action,code,reason)=>{
        meta.action=action;meta.decisionReason=code;meta.reason=reason;
        if(best){cached={key,dates:dates(best.rows)};meta.dateChanges=dateChanges(referenceDates,best.rows,o);if(action==='retain')counters.reusedPlans++;}
        const ended=now();
        return {...(best??fail(reason)),policy:'adaptiveV8',modelVersion:'v8-adaptive-stable-fee',status:best?'feasible':'no_feasible_schedule_found',
          optimality:best?(action==='retain'?'retained_plan_not_reoptimized':'adaptive_heuristic_no_optimality_claim'):'not_proven',runtimeMs:ended-started,
          plannerMetadata:{...meta,...counters,wholeCallWallMs:ended-started,deadlineOverrunMs:Math.max(0,ended-deadline),
            incumbentAcceptedAtMs:bestAcceptedAtMs,incumbentAcceptedBeforeDeadline:bestAcceptedAtMs!==null&&bestAcceptedAtMs<=budget}};
      };
      const acceptAudit=(proposals,stage)=>{
        const audit=auditDates(s,proposals,o);stages[stage]={valid:audit.valid,errors:audit.errors};
        if(!audit.valid)return null;
        const candidate=summarize(s,'adaptiveV8',audit.rows,now()-started,'feasible',{objectiveMode:'joint',optimality:'adaptive_heuristic_no_optimality_claim',auditValid:true});
        const accepted=now();
        if(accepted>deadline){stages[stage].lateCandidateDiscarded=true;return null;}
        return {candidate,acceptedAtMs:accepted-started};
      };
      if(!initialConsumed){
        initialConsumed=true;
        if(suppliedInitial!==null){cached={key,dates:structuredClone(suppliedInitial)};meta.cacheStatus='supplied_initial_dates';}
      }
      const cacheStarted=now();
      if(cached?.key===key) {
        referenceDates=structuredClone(cached.dates);
        const audited=acceptAudit(cached.dates,'cacheAudit');
        meta.cacheValid=stages.cacheAudit.valid;meta.cacheAcceptedBeforeDeadline=Boolean(audited);
        if(audited){best=audited.candidate;bestAcceptedAtMs=audited.acceptedAtMs;meta.currentSnapshotFeeNonincrease=true;meta.initialDatesAccepted=meta.cacheStatus==='supplied_initial_dates';meta.cacheStatus=meta.initialDatesAccepted?'initial_dates_valid':'valid';}
        else {meta.cacheStatus=meta.cacheValid?'late_cache_audit':'invalid';if(!meta.cacheValid)counters.replannedDueToInvalid++;}
      }
      phaseWallMs.cacheAudit=now()-cacheStarted;
      meta.strategyAction=best?'retain':referenceDates?'rebuild':'initialize';
      if(now()>=workDeadline)return finish(best?'retain':'failed','budget_before_search',best?'Retained the complete incumbent audited within this call; no search budget remains.':'Budget expired before a complete current-snapshot incumbent was accepted.');
      if(best) {
        meta.strategyAction='retain';
        const baseline=best,baselineAccepted=bestAcceptedAtMs,opportunityStarted=now();
        meta.pressureProxy={before:pressureProxy(baseline,day,settings.lookaheadDays),after:null,guardEnabled:settings.pressureGuard};
        meta.feeOpportunity=feeOpportunity(s,baseline,o,settings,now,workDeadline);
        phaseWallMs.opportunity=now()-opportunityStarted;
        if(!meta.feeOpportunity.complete)return finish('retain','opportunity_budget_exhausted','Opportunity calculation reached its deadline; retained the audited plan.');
        if(meta.feeOpportunity.upperBoundSavingsKRW<=settings.opportunityThresholdKRW+EPS)return finish('retain','no_fee_opportunity','No optimistic fee opportunity exceeds the fixed trigger; retained the audited plan.');
        if(settings.maxChangedEvents===0)return finish('retain','date_change_budget_zero','The declared date-change budget is zero; retained the audited plan.');
        if(now()>=workDeadline)return finish('retain','budget_before_polish','No budget remains for optional polishing; retained the audited plan.');
        meta.strategyAction='polish';counters.polishCalls++;
        const polishStarted=now();let polished;
        try {
          polished=await polish(structuredClone(s),structuredClone(baseline),{...structuredClone(configured),...structuredClone(o),now,
            timeBudgetMs:Math.max(0,workDeadline-now()),deadlineMs:workDeadline});
          stages.polish={status:polished.status,metadata:polished.polishMetadata};
        } catch(error) {stages.polish={status:'polish_error',reason:message(error)};}
        phaseWallMs.polish=now()-polishStarted;
        const selectionStarted=now();
        const audited=SUCCESS.has(polished?.status)?acceptAudit(polished.rows,'polishAudit'):null;
        let reason='polish_no_complete_candidate';
        if(audited) {
          const candidate=audited.candidate,change=dateChanges(baseline.rows,candidate.rows,o),after=pressureProxy(candidate,day,settings.lookaheadDays);
          const minimum=Math.min(baseline.incrementalCost,candidate.incrementalCost),ceiling=minimum*(1+settings.feeToleranceRatio);
          meta.pressureProxy.after=after;
          meta.selection={baselineIncrementalKRW:baseline.incrementalCost,candidateIncrementalKRW:candidate.incrementalCost,
            minimumCandidateKRW:minimum,stabilityFeeCeilingKRW:ceiling,candidateDateChanges:change,
            currentFeeSavingsKRW:baseline.incrementalCost-candidate.incrementalCost};
          if(candidate.incrementalCost>=baseline.incrementalCost-EPS)reason='no_strict_fee_improvement';
          else if(change.changedEventCount>settings.maxChangedEvents)reason='date_change_limit';
          else if(settings.pressureGuard&&!pressureDoesNotWorsen(meta.pressureProxy.before,after))reason='pressure_guard';
          else if(baseline.incrementalCost<=ceiling+EPS)reason='small_savings_prefer_stability';
          else {best=candidate;bestAcceptedAtMs=audited.acceptedAtMs;reason='fee_improvement_within_change_and_pressure_guards';}
        }
        phaseWallMs.selection=now()-selectionStarted;
        // Do not accept selection work completed after the outer deadline.
        if(best!==baseline&&now()>deadline){best=baseline;bestAcceptedAtMs=baselineAccepted;reason='late_polish_selection_discarded';}
        meta.currentSnapshotFeeNonincrease=best.incrementalCost<=baseline.incrementalCost+EPS;
        return finish(best===baseline?'retain':'polish',reason,best===baseline?'Retained the audited plan after bounded fee/stability evaluation.':'Accepted a strictly cheaper current-snapshot plan within the declared date-change and pressure guards.');
      }
      meta.strategyAction=referenceDates?'rebuild':'initialize';
      const recoveryStarted=now(),remaining=deadline-now()-settings.auditReserveMs;
      if(remaining<=0)return finish('failed','budget_before_recovery','No budget remains for initialization or locked recovery.');
      let recovered;
      try {
        // V8 owns the cache. Each recovery call is fresh, so a stale private V7
        // cache cannot bypass this controller's cache audit or action selection.
        const recovery=createCostRecoveryPlanner(recoverySettings);
        recovered=await recovery(structuredClone(s),{...structuredClone(o),timeBudgetMs:remaining});
        meta.recoveryMetadata=structuredClone(recovered.plannerMetadata??{});
        for(const key of ['solverCalls','constructorCalls','polishCalls'])counters[key]+=recovered.plannerMetadata?.[key]??0;
        stages.recovery={status:recovered.status,subproblemStatus:recovered.plannerMetadata?.subproblemStatus??null};
      } catch(error) {stages.recovery={status:'recovery_error',reason:message(error)};}
      phaseWallMs.recovery=now()-recoveryStarted;
      const finalAuditStarted=now(),audited=SUCCESS.has(recovered?.status)?acceptAudit(recovered.rows,'recoveryAudit'):null;
      phaseWallMs.recoveryAudit=now()-finalAuditStarted;
      if(audited){best=audited.candidate;bestAcceptedAtMs=audited.acceptedAtMs;return finish(meta.strategyAction,meta.strategyAction==='initialize'?'initial_complete_plan':'invalid_cache_locked_recovery',meta.strategyAction==='initialize'?'Built a complete initial schedule; this is initialization, not recovery after a shared history.':'Rebuilt a complete plan under current capacities and exact execution locks.');}
      return finish('failed','no_complete_locked_plan','No complete audited plan was accepted within the cooperative budget; this is not an infeasibility certificate.');
    } finally {busy=false;}
  };
}
