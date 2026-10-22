import {capacityAt,containerCost,operationParameters,returnOffset,validateScenario} from './engine.js';
import {polishCompletePlan} from './cost-recovery-v7.js';
import {createCandidateDeliveryGateV9} from './candidate-delivery-v9.js';
import {solveLockedConstructorV9,solveDeadlineMILPV9} from './locked-recovery-v9.js';

const DAYS=['pickupDay','unloadDay','returnDay'], RESOURCES=['truck','warehouse','staging'];
const SUCCESS=new Set(['optimal','feasible']), CLOCK=()=>performance.now(), EPS=1e-6;
export const ADAPTIVE_V9_DEFAULTS=Object.freeze({timeBudgetMs:200, feeToleranceRatio:0.005, maxChangedEvents:6,
  lookaheadDays:2, pressureGuard:true, opportunityThresholdKRW:0, auditReserveMs:5});
const dates=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const message=error=>error instanceof Error?error.message:String(error);

function validateSettings(o) {
  if(!Number.isFinite(o.timeBudgetMs)||o.timeBudgetMs<=0)throw new Error('V9 timeBudgetMs must be positive and finite.');
  if(!Number.isFinite(o.feeToleranceRatio)||o.feeToleranceRatio<0||o.feeToleranceRatio>1)throw new Error('V9 feeToleranceRatio must be between 0 and 1.');
  if(!Number.isInteger(o.maxChangedEvents)||o.maxChangedEvents<0||o.maxChangedEvents>300)throw new Error('V9 maxChangedEvents must be an integer from 0 to 300.');
  if(!Number.isInteger(o.lookaheadDays)||o.lookaheadDays<1||o.lookaheadDays>7)throw new Error('V9 lookaheadDays must be an integer from 1 to 7.');
  if(typeof o.pressureGuard!=='boolean')throw new Error('V9 pressureGuard must be boolean.');
  if(!Number.isFinite(o.opportunityThresholdKRW)||o.opportunityThresholdKRW<0)throw new Error('V9 opportunityThresholdKRW must be nonnegative and finite.');
  if(!Number.isFinite(o.auditReserveMs)||o.auditReserveMs<0)throw new Error('V9 auditReserveMs must be nonnegative and finite.');
}

function validateInput(s,o) {
  const validation=validateScenario(s);
  if(!validation.valid)throw new Error(validation.errors.join('; '));
  if((o.objectiveMode??s.objectiveMode??'joint')!=='joint')throw new Error('V9 supports the joint fee objective only.');
  const day=o.minEventDay??0, fixed=o.fixedEvents??{}, ids=new Set(s.containers.map(c=>c.id));
  if(!Number.isInteger(day)||day<0||day>s.horizonDays)throw new Error('minEventDay must be an integer within the horizon.');
  if(!fixed||typeof fixed!=='object'||Array.isArray(fixed))throw new Error('fixedEvents must be an object keyed by container id.');
  for(const [id,locks]of Object.entries(fixed)) {
    if(!ids.has(id)||!locks||typeof locks!=='object'||Array.isArray(locks))throw new Error('Invalid fixed-event container.');
    for(const [key,d]of Object.entries(locks))if(!DAYS.includes(key)||!Number.isInteger(d)||d<0||d>=s.horizonDays||d>=day)throw new Error('Execution locks must be valid event dates strictly before minEventDay.');
  }
  for(const resource of RESOURCES)for(let d=0;d<s.horizonDays;d++)if(!Number.isInteger(capacityAt(s[`${resource}Capacity`],d))||capacityAt(s[`${resource}Capacity`],d)<0)throw new Error('Every day must have a finite nonnegative integer capacity.');
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


/** One factory per sequential episode. Recovery is owned here so complete
 * construction candidates reach this outer controller before optional work. */
export function createAdaptivePlannerV9(configuration={}) {
  const {now:providedNow=CLOCK,solver=solveDeadlineMILPV9,seedConstructor=solveLockedConstructorV9,
    polish=polishCompletePlan,initialDates,onIncumbent,...raw}=configuration;
  if(typeof providedNow!=='function'||typeof polish!=='function'||typeof solver!=='function'||typeof seedConstructor!=='function'
    ||onIncumbent!==undefined&&typeof onIncumbent!=='function')throw new Error('Invalid V9 callback or clock.');
  const now=()=>{const value=providedNow();if(!Number.isFinite(value))throw new Error('V9 clock must return finite milliseconds.');return value;};
  const configured=structuredClone(raw),defaultBudget=configured.timeBudgetMs??(configured.timeLimitSeconds!==undefined?configured.timeLimitSeconds*1000:200);
  const settings={...ADAPTIVE_V9_DEFAULTS,...configured,timeBudgetMs:defaultBudget};
  validateSettings(settings);
  if((settings.objectiveMode??'joint')!=='joint')throw new Error('V9 supports the joint fee objective only.');
  const constructorShare=configured.constructorShare??0.4,maxRestarts=configured.maxRestarts??15;
  if(!Number.isFinite(constructorShare)||constructorShare<0||constructorShare>1||!Number.isInteger(maxRestarts)||maxRestarts<0||maxRestarts>128)throw new Error('Invalid V9 recovery budget.');
  for(const [key,lo,hi,def]of [['maxPasses',0,4,2],['maxPairs',0,128,32],['candidateCap',4,32,12],['maxPairChecks',0,4096,384],['maxSingleTargets',0,100,16]]) {
    const value=configured[key]??def;if(!Number.isInteger(value)||value<lo||value>hi)throw new Error('Invalid V9 cost-polish '+key+'.');
  }
  const suppliedInitial=initialDates===undefined?null:structuredClone(initialDates);
  let cached=null,lastKey=null,lastDay=null,initialConsumed=false,busy=false;
  const counters={decisionCalls:0,solverCalls:0,constructorCalls:0,reusedPlans:0,replannedDueToInvalid:0,polishCalls:0};
  return async function adaptivePlannerV9(scenario,options={}) {
    if(busy)throw new Error('A V9 factory requires sequential calls; use a new factory for each episode.');
    busy=true;
    try {
      const started=now(),s=structuredClone(scenario),o=structuredClone(options),budget=o.timeBudgetMs??(o.timeLimitSeconds!==undefined?o.timeLimitSeconds*1000:defaultBudget);
      if(!Number.isFinite(budget)||budget<=0||!Number.isFinite(started+budget))throw new Error('V9 requires a positive finite whole-call budget.');
      const deadline=started+budget,workDeadline=deadline-settings.auditReserveMs;
      validateInput(s,o);o.objectiveMode='joint';
      const day=o.minEventDay??0,key=episodeKey(s),phaseWallMs={},stages={};
      counters.decisionCalls++;
      const gate=createCandidateDeliveryGateV9({scenario:s,options:o,started,deadlineMs:deadline,now,callId:counters.decisionCalls,onIncumbent});
      const meta={method:'v9-adaptive-timely-candidate-delivery',action:'failed',strategyAction:null,decisionReason:null,reason:null,
        cacheStatus:'absent',cacheValid:false,cacheAcceptedBeforeDeadline:false,initialDatesProvided:suppliedInitial!==null,initialDatesAccepted:false,
        parameters:Object.fromEntries(Object.keys(ADAPTIVE_V9_DEFAULTS).filter(k=>k!=='timeBudgetMs').map(k=>[k,settings[k]])),
        wholeCallBudgetMs:budget,cooperativeDeadline:true,policyOptimalityClaim:false,currentSnapshotFeeNonincrease:null,
        phaseWallMs,stages,feeOpportunity:null,dateChanges:null,pressureProxy:null,selection:null};
      if(lastKey!==null&&(key!==lastKey||day<lastDay)){cached=null;meta.cacheStatus=key!==lastKey?'different_episode_reset':'backwards_day_reset';}
      lastKey=key;lastDay=day;
      let best=null,bestAcceptedAtMs=null,referenceDates=null,bestSource=null;
      const fail=reason=>({policy:'adaptiveV9',modelVersion:'v9-adaptive-timely-delivery',status:'no_feasible_schedule_found',optimality:'not_proven',reason,
        rows:[],usage:[],totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,objectiveCost:null,lateCount:null,objectiveMode:'joint'});
      const offer=(candidate,source,select)=>{
        const receipt=gate.offer(candidate,source,select?{select}:{});
        if(receipt.accepted){best=gate.best();bestAcceptedAtMs=receipt.event.acceptedAtMs;bestSource=source;}
        return receipt;
      };
      const finish=(action,code,reason)=>{
        meta.action=action;meta.decisionReason=code;meta.reason=reason;
        if(best){cached={key,dates:dates(best.rows)};meta.dateChanges=dateChanges(referenceDates,best.rows,o);if(action==='retain')counters.reusedPlans++;}
        const candidateDelivery=gate.close(),ended=now();
        return {...(best??fail(reason)),policy:'adaptiveV9',modelVersion:'v9-adaptive-timely-delivery',status:best?'feasible':'no_feasible_schedule_found',
          optimality:best?(action==='retain'?'retained_plan_not_reoptimized':'adaptive_candidate_delivery_no_optimality_claim'):'not_proven',runtimeMs:ended-started,
          plannerMetadata:{...meta,...counters,candidateSource:bestSource,candidateDelivery,wholeCallWallMs:ended-started,deadlineOverrunMs:Math.max(0,ended-deadline),
            incumbentAcceptedAtMs:bestAcceptedAtMs,incumbentAcceptedBeforeDeadline:bestAcceptedAtMs!==null&&bestAcceptedAtMs<=budget}};
      };
      if(!initialConsumed){initialConsumed=true;if(suppliedInitial!==null){cached={key,dates:structuredClone(suppliedInitial)};meta.cacheStatus='supplied_initial_dates';}}
      const cacheStarted=now();
      if(cached?.key===key) {
        referenceDates=structuredClone(cached.dates);
        const receipt=offer({status:'feasible',rows:cached.dates},'cache',()=>true);
        const audit=receipt.event.audit;
        stages.cacheAudit={valid:audit?.scheduleValid===true&&audit?.freezeValid===true,errors:audit?.errors??[],
          ...(receipt.event.outcome.startsWith('rejected_late')?{lateCandidateDiscarded:true}:{})};
        meta.cacheValid=stages.cacheAudit.valid;meta.cacheAcceptedBeforeDeadline=receipt.accepted;
        if(receipt.accepted){meta.currentSnapshotFeeNonincrease=true;meta.initialDatesAccepted=meta.cacheStatus==='supplied_initial_dates';meta.cacheStatus=meta.initialDatesAccepted?'initial_dates_valid':'valid';}
        else {meta.cacheStatus=meta.cacheValid?'late_cache_audit':'invalid';if(!meta.cacheValid)counters.replannedDueToInvalid++;}
      }
      phaseWallMs.cacheAudit=now()-cacheStarted;
      meta.strategyAction=best?'retain':referenceDates?'rebuild':'initialize';
      if(now()>=workDeadline)return finish(best?'retain':'failed','budget_before_search',best?'Retained the complete incumbent audited within this call; no search budget remains.':'Budget expired before a complete current-snapshot incumbent was accepted.');
      if(best) {
        const baseline=best,baselineAccepted=bestAcceptedAtMs,opportunityStarted=now();
        meta.pressureProxy={before:pressureProxy(baseline,day,settings.lookaheadDays),after:null,guardEnabled:settings.pressureGuard};
        meta.feeOpportunity=feeOpportunity(s,baseline,o,settings,now,workDeadline);
        phaseWallMs.opportunity=now()-opportunityStarted;
        if(!meta.feeOpportunity.complete)return finish('retain','opportunity_budget_exhausted','Opportunity calculation reached its deadline; retained the audited plan.');
        if(meta.feeOpportunity.upperBoundSavingsKRW<=settings.opportunityThresholdKRW+EPS)return finish('retain','no_fee_opportunity','No optimistic fee opportunity exceeds the fixed trigger; retained the audited plan.');
        if(settings.maxChangedEvents===0)return finish('retain','date_change_budget_zero','The declared date-change budget is zero; retained the audited plan.');
        if(now()>=workDeadline)return finish('retain','budget_before_polish','No budget remains for optional polishing; retained the audited plan.');
        meta.strategyAction='polish';counters.polishCalls++;
        const polishStarted=now();let polished,reason='polish_no_complete_candidate';
        try {
          polished=await polish(structuredClone(s),structuredClone(baseline),{...structuredClone(configured),...structuredClone(o),now,
            timeBudgetMs:Math.max(0,workDeadline-now()),deadlineMs:workDeadline});
          stages.polish={status:polished.status,metadata:polished.polishMetadata};
        }catch(error){stages.polish={status:'polish_error',reason:message(error)};}
        phaseWallMs.polish=now()-polishStarted;
        const selectionStarted=now();
        if(SUCCESS.has(polished?.status)) {
          const receipt=offer(polished,'adaptive_polish',(_previous,candidate)=>{
            const change=dateChanges(baseline.rows,candidate.rows,o),after=pressureProxy(candidate,day,settings.lookaheadDays);
            const minimum=Math.min(baseline.incrementalCost,candidate.incrementalCost),ceiling=minimum*(1+settings.feeToleranceRatio);
            meta.pressureProxy.after=after;
            meta.selection={baselineIncrementalKRW:baseline.incrementalCost,candidateIncrementalKRW:candidate.incrementalCost,
              minimumCandidateKRW:minimum,stabilityFeeCeilingKRW:ceiling,candidateDateChanges:change,currentFeeSavingsKRW:baseline.incrementalCost-candidate.incrementalCost};
            if(candidate.incrementalCost>=baseline.incrementalCost-EPS)reason='no_strict_fee_improvement';
            else if(change.changedEventCount>settings.maxChangedEvents)reason='date_change_limit';
            else if(settings.pressureGuard&&!pressureDoesNotWorsen(meta.pressureProxy.before,after))reason='pressure_guard';
            else if(baseline.incrementalCost<=ceiling+EPS)reason='small_savings_prefer_stability';
            else reason='fee_improvement_within_change_and_pressure_guards';
            return {accepted:reason==='fee_improvement_within_change_and_pressure_guards',reason:reason==='fee_improvement_within_change_and_pressure_guards'?'improvement':'guard',decisionReason:reason};
          });
          stages.polishAudit={valid:receipt.event.audit?.scheduleValid===true&&receipt.event.audit?.freezeValid===true,errors:receipt.event.audit?.errors??[],
            ...(receipt.event.outcome.startsWith('rejected_late')?{lateCandidateDiscarded:true}:{})};
          if(!receipt.accepted&&receipt.event.outcome.startsWith('rejected_late'))reason='late_polish_candidate_discarded';
        }
        phaseWallMs.selection=now()-selectionStarted;
        // The gate performs the final selection deadline check before retaining.
        meta.currentSnapshotFeeNonincrease=best.incrementalCost<=baseline.incrementalCost+EPS;
        return finish(bestAcceptedAtMs===baselineAccepted&&bestSource==='cache'?'retain':'polish',reason,
          bestSource==='cache'?'Retained the audited plan after bounded fee/stability evaluation.':'Accepted a strictly cheaper current-snapshot plan within the declared date-change and pressure guards.');
      }
      meta.strategyAction=referenceDates?'rebuild':'initialize';
      const recoveryStarted=now(),constructionDeadline=Math.min(workDeadline,started+budget*constructorShare);
      const recoverySelect=source=>(previous,candidate)=>!previous||candidate.incrementalCost<previous.incrementalCost
        ||candidate.incrementalCost===previous.incrementalCost&&source==='locked_milp';
      let constructed=null,constructorReceiptCount=0,recoveryPolish=null;
      if(now()<constructionDeadline) {
        counters.constructorCalls++;const stageStarted=now();
        try {
          const onCandidate=candidate=>{constructorReceiptCount++;return offer(candidate,'locked_constructor',recoverySelect('locked_constructor')).accepted;};
          constructed=await seedConstructor(structuredClone(s),{...structuredClone(configured),...structuredClone(o),maxRestarts,deadlineMs:constructionDeadline,
            timeBudgetMs:Math.max(0,constructionDeadline-now()),now,onCandidate});
          stages.locked_constructor={status:constructed?.status??'missing_result',wallTimeMs:now()-stageStarted,
            constructorMetadata:structuredClone(constructed?.constructorMetadata??{}),synchronousCandidateReceipts:constructorReceiptCount};
          // Also receive the returned result. Injection callbacks need not emit;
          // its arrival is measured now and never backdated to internal claims.
          if(SUCCESS.has(constructed?.status))offer(constructed,'locked_constructor',recoverySelect('locked_constructor'));
        }catch(error){stages.locked_constructor={status:'constructor_error',reason:message(error),wallTimeMs:now()-stageStarted,synchronousCandidateReceipts:constructorReceiptCount};}
      }else stages.locked_constructor={status:'budget_skipped'};
      if(best&&now()<constructionDeadline) {
        counters.polishCalls++;const stageStarted=now(),seed=structuredClone(best);
        try {
          recoveryPolish=await polish(structuredClone(s),seed,{...structuredClone(configured),...structuredClone(o),now,
            deadlineMs:constructionDeadline,timeBudgetMs:Math.max(0,constructionDeadline-now())});
          stages.recovery_polish={status:recoveryPolish?.status,wallTimeMs:now()-stageStarted};
          if(SUCCESS.has(recoveryPolish?.status))offer(recoveryPolish,'recovery_polish',recoverySelect('recovery_polish'));
        }catch(error){stages.recovery_polish={status:'polish_error',reason:message(error),wallTimeMs:now()-stageStarted};}
      }else stages.recovery_polish={status:'budget_skipped'};
      if(now()+settings.auditReserveMs<deadline) {
        counters.solverCalls++;const stageStarted=now(),remaining=deadline-now()-settings.auditReserveMs;
        try {
          const candidate=await solver(structuredClone(s),{...structuredClone(configured),...structuredClone(o),timeLimitSeconds:remaining/1000},
            {deadlineMs:deadline,now,auditReserveMs:settings.auditReserveMs});
          stages.locked_milp={status:candidate?.status??'missing_result',requestedTimeLimitMs:remaining,wallTimeMs:now()-stageStarted,
            nativeBudgetMetadata:structuredClone(candidate?.nativeBudgetMetadata??{}),solverStatus:candidate?.solverStatus??null,
            solverOptimality:candidate?.optimality??null,modelSize:structuredClone(candidate?.modelSize??null),reason:candidate?.reason};
          if(SUCCESS.has(candidate?.status))offer(candidate,'locked_milp',recoverySelect('locked_milp'));
          if(best&&candidate?.status==='infeasible')stages.locked_milp.infeasibilityContradictsAuditedIncumbent=true;
        }catch(error){stages.locked_milp={status:'solver_error',reason:message(error),requestedTimeLimitMs:remaining,wallTimeMs:now()-stageStarted};}
      }else stages.locked_milp={status:'budget_skipped'};
      phaseWallMs.recovery=now()-recoveryStarted;
      meta.recoveryMetadata={method:'v9-owned-construction-polish-milp',candidateSource:bestSource,
        constructorShare,maxRestarts,auditReserveMs:settings.auditReserveMs,policyOptimalityClaim:false,
        ...(recoveryPolish?.polishMetadata?{polishMetadata:structuredClone(recoveryPolish.polishMetadata)}:{})};
      stages.recovery={status:best?'feasible':'no_feasible_schedule_found',subproblemStatus:stages.locked_milp.status};
      if(best)return finish(meta.strategyAction,meta.strategyAction==='initialize'?'initial_timely_complete_plan':'invalid_cache_timely_locked_recovery',
        meta.strategyAction==='initialize'?'Built and independently accepted a complete initial candidate before the outer deadline.':'Rebuilt and independently accepted a complete locked candidate before the outer deadline; later optional work cannot erase it.');
      return finish('failed','no_complete_locked_plan','No complete audited plan was accepted within the cooperative budget; this is not an infeasibility certificate.');
    }finally{busy=false;}
  };
}

