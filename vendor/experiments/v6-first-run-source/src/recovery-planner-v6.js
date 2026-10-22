import {auditSchedule, capacityAt, containerCost, objectiveValue, operationParameters, returnOffset, rowFor, stagingWeight, summarize, validateScenario} from './engine.js';
import {auditFrozenEvents} from './rolling-plan.js';
import {createSolver, solveMILP} from './solver-glpk.js';

const EVENT_DAYS = ['pickupDay', 'unloadDay', 'returnDay'];
const FEASIBLE = new Set(['optimal', 'feasible']);
const nowDefault = () => performance.now();
let glpkPromise;

function validateInput(s, options) {
  const validation = validateScenario(s);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  const day = options.minEventDay ?? 0, fixed = options.fixedEvents ?? {};
  if (!Number.isInteger(day) || day < 0 || day > s.horizonDays) throw new Error('minEventDay must be an integer within the horizon.');
  if (!fixed || typeof fixed !== 'object' || Array.isArray(fixed)) throw new Error('fixedEvents must be an object keyed by container id.');
  const ids = new Set(s.containers.map(c => c.id));
  for (const [id, locks] of Object.entries(fixed)) {
    if (!ids.has(id) || !locks || typeof locks !== 'object' || Array.isArray(locks)) throw new Error('Invalid execution lock container.');
    for (const [key, date] of Object.entries(locks)) if (!EVENT_DAYS.includes(key) || !Number.isInteger(date) || date < 0 || date >= s.horizonDays) throw new Error('Invalid fixed event date.');
  }
  if (!['joint', 'storageOnly', 'ddOnly'].includes(options.objectiveMode ?? s.objectiveMode ?? 'joint')) throw new Error('Invalid objectiveMode.');
  for (const resource of ['truck', 'warehouse', 'staging']) for (let d=0; d<s.horizonDays; d++) if (!Number.isInteger(capacityAt(s[`${resource}Capacity`], d)) || capacityAt(s[`${resource}Capacity`], d) < 0) throw new Error(`${resource}Capacity must supply a nonnegative integer every day.`);
}

function auditedRows(s, inputRows, options) {
  const errors = [], ids = new Set(), map = new Map(s.containers.map(c => [c.id, c]));
  if (!Array.isArray(inputRows) || inputRows.length !== s.containers.length) errors.push('Require a complete candidate for all known orders.');
  if (Array.isArray(inputRows)) for (const row of inputRows) {
    if (!row || !map.has(row.id) || ids.has(row.id)) { errors.push('Unknown, duplicate or malformed candidate row.'); continue; }
    ids.add(row.id);
    for (const key of EVENT_DAYS) if (!Number.isInteger(row[key]) || row[key] < 0 || row[key] >= s.horizonDays) errors.push(`${row.id}: ${key} must be a finite integer within the horizon.`);
    // Even canonical dates can yield an out-of-range unload end. Reject before
    // the legacy usage audit loops over dates.
    if (Number.isInteger(row.unloadDay) && row.unloadDay+map.get(row.id).unloadDays-1 >= s.horizonDays) errors.push(`${row.id}: unloading extends beyond the horizon.`);
  }
  if (errors.length) return {valid:false, errors, rows:[]};
  const byId = new Map(inputRows.map(row => [row.id, row]));
  const rows = s.containers.map(c => { const row=byId.get(c.id); return rowFor(s, c, row.pickupDay, row.unloadDay, row.returnDay); });
  const scheduleAudit = auditSchedule(s, rows), freezeAudit = auditFrozenEvents(rows, options.fixedEvents ?? {}, options.minEventDay ?? 0);
  return {valid:scheduleAudit.valid && freezeAudit.valid, errors:[...scheduleAudit.errors, ...freezeAudit.errors], scheduleAudit, freezeAudit, rows};
}

function emptyResult(s, mode, reason, status='no_feasible_schedule_found') {
  return {policy:'lockedRecoveryV6', status, optimality:'not_proven', rows:[], usage:[], totalCost:null, incrementalCost:null, storageCost:null, ddCost:null, sunkCost:null, objectiveCost:null, lateCount:null, objectiveMode:mode, reason};
}

/** Independent constructor: every trip domain respects execution locks.
 * It accounts for complete daily truck, unloading and staging usage, including
 * historical events and the future tail of an already-started unloading task.
 */
export function solveLockedConstructor(s, options={}) {
  const now = options.now ?? nowDefault, started = now(), mode = options.objectiveMode ?? s.objectiveMode ?? 'joint';
  const deadline = options.deadlineMs ?? started+(options.timeBudgetMs ?? 80), maxRestarts = options.maxRestarts ?? 15;
  if (typeof now !== 'function' || !Number.isFinite(deadline)) throw new Error('Constructor requires a clock and finite deadline.');
  if (!Number.isInteger(maxRestarts) || maxRestarts < 0 || maxRestarts > 128) throw new Error('maxRestarts must be an integer from 0 to 128.');
  validateInput(s, options);
  const expired = () => now() >= deadline, H=s.horizonDays, N=s.containers.length, day=options.minEventDay ?? 0, fixed=options.fixedEvents ?? {};
  const capacities = Object.fromEntries(['truck', 'warehouse', 'staging'].map(resource => [resource, Array.from({length:H}, (_, d) => capacityAt(s[`${resource}Capacity`], d))]));
  const inputSeed=(Number(options.seed ?? s.seed ?? 42) >>> 0)||1;
  const metadata = {method:'locked trip domains + incremental usage + bounded rollback repair + event relocation', seed:inputSeed, maxRestarts, orderRules:['domainSize', 'deadline', 'started', 'highFee', 'seededRandom'], attemptCount:0, tripCandidates:0, capacityChecks:0, repairAttempts:0, repairChecks:0, relocationChecks:0, completeAuditedCandidates:0, firstIncumbentMs:null, improvements:0, deadlineChecksInsideCandidateLoops:true};
  let seed=inputSeed, best=null;
  const random = () => { seed=(Math.imul(seed, 1664525)+1013904223) >>> 0; return seed/4294967296; };
  const output = () => ({...(best ?? emptyResult(s, mode, 'No complete locked schedule found in bounded construction; this is not an infeasibility proof.')), runtimeMs:now()-started, constructorMetadata:{...metadata, deadlineReached:expired(), wallTimeMs:now()-started}});
  if (expired()) return output();
  const emptyUsage = () => ({truck:new Int16Array(H), warehouse:new Int16Array(H), staging:new Int16Array(H)});
  const fits = (usage, domain, trip) => {
    metadata.capacityChecks++;
    if (expired() || usage.truck[trip.p]+1+(trip.p===trip.r?1:0)>capacities.truck[trip.p] || usage.truck[trip.r]+1+(trip.p===trip.r?1:0)>capacities.truck[trip.r]) return false;
    for (let d=trip.u; d<trip.u+domain.c.unloadDays; d++) if (expired() || usage.warehouse[d]+1>capacities.warehouse[d]) return false;
    for (let d=trip.p; d<trip.r; d++) if (expired() || usage.staging[d]+domain.weight>capacities.staging[d]) return false;
    return true;
  };
  // Each mutation is bounded by H<=31 and completes atomically, even if the
  // deadline passes inside it. No partly rolled-back usage is accepted.
  const apply = (usage, domain, trip, sign) => {
    usage.truck[trip.p]+=sign; usage.truck[trip.r]+=sign;
    for (let d=trip.u; d<trip.u+domain.c.unloadDays; d++) usage.warehouse[d]+=sign;
    for (let d=trip.p; d<trip.r; d++) usage.staging[d]+=sign*domain.weight;
  };
  const domains=[];
  for (let index=0; index<N; index++) {
    if (expired()) return output();
    const c=s.containers[index], locks=Object.hasOwn(fixed, c.id)?fixed[c.id]:{}, offset=returnOffset(s, c), latest=Math.min(c.dueDay-c.unloadDays+1, H-offset-1);
    const domain={index, c, weight:stagingWeight(s, c), locks:Object.keys(locks).length, latest, trips:[]}, storage=[], dd=[];
    for (let d=0; d<H; d++) {
      if (expired()) return output();
      const fee=containerCost(c, d, d, s.horizonStart, s.tariff); storage[d]=fee.storageCost-fee.priorStorageCost; dd[d]=fee.ddCost-fee.priorDDCost;
    }
    const values = (field, lo, hi) => Object.hasOwn(locks, field) ? [locks[field]].filter(value => value>=lo && value<=hi) : Array.from({length:Math.max(0, hi-Math.max(lo, day)+1)}, (_, i) => Math.max(lo, day)+i);
    const single=emptyUsage();
    for (const p of values('pickupDay', c.releaseDay, latest)) for (const u of values('unloadDay', p, latest)) for (const r of values('returnDay', u+offset, H-1)) {
      if (expired()) return output();
      const trip={p, u, r, full:storage[p]+dd[r], primary:mode==='storageOnly'?storage[p]:mode==='ddOnly'?dd[r]:storage[p]+dd[r]};
      if (fits(single, domain, trip)) { domain.trips.push(trip); metadata.tripCandidates++; }
    }
    domain.trips.sort((a, b) => a.primary-b.primary || a.full-b.full || (a.r-a.p)-(b.r-b.p) || a.r-b.r || a.p-b.p || a.u-b.u);
    domains.push(domain);
    if (!domain.trips.length) return output();
  }
  const accept = selected => {
    if (expired() || selected.some(trip => !trip)) return false;
    const proposals=selected.map((trip, i) => ({id:s.containers[i].id, pickupDay:trip.p, unloadDay:trip.u, returnDay:trip.r})), audit=auditedRows(s, proposals, options);
    if (!audit.valid) throw new Error(`Locked constructor audit failed: ${audit.errors.join('; ')}`);
    if (expired()) return false;
    const result=summarize(s, 'lockedRecoveryV6', audit.rows, now()-started, 'feasible', {objectiveMode:mode, optimality:'locked_constructor_heuristic', auditValid:true, incumbentSource:'locked_constructor'});
    if (expired()) return false;
    metadata.completeAuditedCandidates++;
    if (!best || result.objectiveCost<best.objectiveCost || result.objectiveCost===best.objectiveCost && result.incrementalCost<best.incrementalCost) {
      best=result; metadata.improvements++; metadata.firstIncumbentMs ??= now()-started; return true;
    }
    return false;
  };
  const construct = (order, explore) => {
    const usage=emptyUsage(), selected=Array(N).fill(null), placed=[];
    for (const domain of order) {
      if (expired()) return null;
      const candidates=[];
      for (const trip of domain.trips) if (fits(usage, domain, trip)) { candidates.push(trip); if (!explore || candidates.length>=3) break; }
      if (candidates.length) {
        const trip=candidates[explore && random()<0.2?Math.floor(random()*candidates.length):0];
        apply(usage, domain, trip, 1); selected[domain.index]=trip; placed.push({domain, trip}); continue;
      }
      metadata.repairAttempts++;
      const group=[domain];
      for (let removed=0; removed<3 && placed.length; removed++) { const old=placed.pop(); apply(usage, old.domain, old.trip, -1); selected[old.domain.index]=null; group.push(old.domain); }
      group.sort((a, b) => a.trips.length-b.trips.length || b.locks-a.locks || a.latest-b.latest);
      let checks=0;
      const chosen=[];
      const visit = depth => {
        if (expired() || checks>=128) return false;
        if (depth===group.length) return true;
        const target=group[depth];
        for (const trip of target.trips) {
          if (expired() || checks>=128) return false;
          checks++; metadata.repairChecks++;
          if (!fits(usage, target, trip)) continue;
          apply(usage, target, trip, 1); chosen[depth]={domain:target, trip};
          if (visit(depth+1)) return true;
          apply(usage, target, trip, -1);
        }
        return false;
      };
      if (!visit(0)) return null;
      for (const item of chosen) { selected[item.domain.index]=item.trip; placed.push(item); }
    }
    return selected;
  };
  for (let attempt=0; attempt<=maxRestarts && !expired(); attempt++) {
    const draws=new Map(domains.map(domain => [domain.index, random()]));
    const compare=attempt===0?(a, b)=>a.trips.length-b.trips.length || b.locks-a.locks || a.latest-b.latest
      :attempt===1?(a, b)=>a.latest-b.latest || b.locks-a.locks || a.trips.length-b.trips.length
      :attempt===2?(a, b)=>b.locks-a.locks || a.c.releaseDay-b.c.releaseDay || a.latest-b.latest
      :attempt===3?(a, b)=>b.trips[0].primary-a.trips[0].primary || a.trips.length-b.trips.length
      :(a, b)=>draws.get(a.index)-draws.get(b.index);
    metadata.attemptCount++;
    const selected=construct([...domains].sort((a, b) => compare(a, b) || a.c.id.localeCompare(b.c.id)), attempt>=4);
    if (selected) accept(selected);
  }
  // A small direct-date relocation pass improves the already feasible result;
  // its domain restrictions keep every executed event fixed.
  if (best && !expired()) {
    const selected=best.rows.map(row => domains.find(domain => domain.c.id===row.id).trips.find(trip => trip.p===row.pickupDay && trip.u===row.unloadDay && trip.r===row.returnDay));
    const usage=emptyUsage(); selected.forEach((trip, i) => apply(usage, domains[i], trip, 1));
    for (const domain of domains) {
      if (expired()) break;
      const old=selected[domain.index]; apply(usage, domain, old, -1);
      let replacement=old;
      for (const trip of domain.trips) {
        if (expired()) break;
        metadata.relocationChecks++;
        if (trip.primary>old.primary || trip.primary===old.primary && trip.full>=old.full) break;
        if (fits(usage, domain, trip)) { replacement=trip; break; }
      }
      selected[domain.index]=replacement; apply(usage, domain, replacement, 1);
    }
    accept(selected);
  }
  return output();
}

/** GLPK receives a fresh remaining limit after model construction and before
 * each native solve, including a lexicographic second solve. GLPK's binding
 * converts seconds*1000 to an integer millisecond tm_lim; it has no 1s floor.
 */
async function solveDeadlineMILP(s, options, context) {
  const {deadlineMs, now, auditReserveMs}=context, initStarted=now();
  glpkPromise ??= createSolver();
  const glpk=await glpkPromise, nativeLimitsMs=[];
  let skippedNativeCalls=0;
  const bounded={...glpk, solve:(model, nativeOptions) => {
    const remaining=Math.floor(deadlineMs-now()-auditReserveMs);
    if (remaining<1) { skippedNativeCalls++; return {result:{status:glpk.GLP_UNDEF, vars:{}, z:null}}; }
    const limit=Math.min(remaining, Math.floor(nativeOptions.tmlim*1000));
    nativeLimitsMs.push(limit);
    return glpk.solve(model, {...nativeOptions, tmlim:limit/1000});
  }};
  const initializationMs=now()-initStarted;
  if (now()+auditReserveMs>=deadlineMs) return {...emptyResult(s, options.objectiveMode, 'No time remains after GLPK initialization.', 'time_limit'), nativeBudgetMetadata:{initializationMs, nativeLimitsMs, skippedNativeCalls}};
  const raw=await solveMILP(bounded, s, {...options, timeLimitSeconds:(deadlineMs-now()-auditReserveMs)/1000});
  const nativeBudgetMetadata={initializationMs, nativeLimitsMs, skippedNativeCalls};
  if (!raw.decisions) return {...raw, ...emptyResult(s, options.objectiveMode, raw.reason, raw.status), optimality:raw.optimality, nativeBudgetMetadata};
  const rows=s.containers.map((c, i) => rowFor(s, c, ...raw.decisions[i]));
  return {...raw, rows, nativeBudgetMetadata};
}

function episodeKey(s) {
  return JSON.stringify({id:s.id ?? null, horizonStart:s.horizonStart, horizonDays:s.horizonDays, operations:operationParameters(s), containers:s.containers.map(c => [c.id, c.sizeFt, c.dischargeDateTime, c.releaseDay, c.unloadDays, c.dueDay]).sort((a, b) => a[0].localeCompare(b[0]))});
}

/** One instance per sequential, known-order rolling episode. Shared cooperative
 * deadline includes snapshot/audits/construction/GLPK initialization/model work;
 * module import occurs before this callable API exists. It is not a hard timer.
 */
export function createRecoveryPlanner(configuration={}) {
  const {timeBudgetMs:defaultBudget=200, constructorShare=0.4, auditReserveMs=5, maxRestarts=15, retainFeasible=true, constructor:configuredConstructor, solver=solveDeadlineMILP, now=nowDefault, ...defaultsInput}=configuration;
  // Ordinary objects inherit Object.prototype.constructor; it is not an
  // injected construction callback unless the configuration owns this field.
  const construct=Object.hasOwn(configuration, 'constructor')?configuredConstructor:solveLockedConstructor;
  if (!Number.isFinite(defaultBudget) || defaultBudget<=0 || !Number.isFinite(constructorShare) || constructorShare<0 || constructorShare>1 || !Number.isFinite(auditReserveMs) || auditReserveMs<0) throw new Error('Invalid recovery budget.');
  if (!Number.isInteger(maxRestarts) || maxRestarts<0 || maxRestarts>128) throw new Error('maxRestarts must be an integer from 0 to 128.');
  if (typeof construct!=='function' || typeof solver!=='function' || typeof now!=='function' || typeof retainFeasible!=='boolean') throw new Error('Invalid recovery callback or retainFeasible option.');
  const defaults=structuredClone(defaultsInput), counters={decisionCalls:0, solverCalls:0, constructorCalls:0, reusedPlans:0, replannedDueToInvalid:0};
  let cached=null, lastDay=null;
  return async function recoveryPlanner(scenario, callOptions={}) {
    const started=now(), s=structuredClone(scenario), options={...structuredClone(defaults), ...structuredClone(callOptions)};
    const budget=options.timeBudgetMs ?? (options.timeLimitSeconds!==undefined?options.timeLimitSeconds*1000:defaultBudget);
    if (!Number.isFinite(budget) || budget<=0) throw new Error('timeBudgetMs must be positive and finite.');
    options.objectiveMode ??= s.objectiveMode ?? 'joint';
    validateInput(s, options);
    counters.decisionCalls++;
    const deadline=started+budget, key=episodeKey(s), day=options.minEventDay ?? 0, hadCache=Boolean(cached), stages={};
    const metadata = source => ({method:'v6-locked-recovery', ...counters, candidateSource:source, timeBudgetMs:budget, wallTimeMs:now()-started, deadlineOverrunMs:Math.max(0, now()-deadline), cooperativeDeadline:true, retainFeasible, stages});
    const failed = (status, reason) => ({...emptyResult(s, options.objectiveMode, reason, status), runtimeMs:now()-started, modelVersion:'v6-locked-recovery', plannerMetadata:metadata('no_complete_plan')});
    let best=null, bestSource=null;
    if (cached) {
      stages.cacheAudit=cached.key===key && (lastDay===null || day>=lastDay)?auditedRows(s, cached.dates, options):{valid:false, errors:['Different episode or backwards decision day.'], rows:[]};
      if (stages.cacheAudit.valid && retainFeasible && now()+auditReserveMs<deadline) {
        const retained=summarize(s, 'lockedRecoveryV6', stages.cacheAudit.rows, now()-started, 'feasible', {objectiveMode:options.objectiveMode, optimality:'retained_plan_not_reoptimized', modelVersion:'v6-locked-recovery', solverStatus:null});
        if (now()<=deadline) {
          counters.reusedPlans++; lastDay=day;
          return {...retained, runtimeMs:now()-started, plannerMetadata:metadata('retained_plan')};
        }
        stages.cacheAudit.lateCandidateDiscarded=true;
      }
      if (!stages.cacheAudit.valid) counters.replannedDueToInvalid++;
      else if (now()<=deadline) {
        const incumbent=summarize(s, 'lockedRecoveryV6', stages.cacheAudit.rows, now()-started, 'feasible', {objectiveMode:options.objectiveMode, optimality:'retained_plan_not_reoptimized'});
        if (now()<=deadline) { best=incumbent; bestSource='cached_incumbent'; }
        else stages.cacheAudit.lateCandidateDiscarded=true;
      }
    }
    lastDay=day;
    const consider = (candidate, source) => {
      if (!FEASIBLE.has(candidate?.status)) return false;
      if (now()>deadline) { stages[source].lateCandidateDiscarded=true; return false; }
      const audit=auditedRows(s, candidate.rows, options);
      stages[source].audit={...audit, rows:undefined};
      if (!audit.valid || now()>deadline) { if (now()>deadline) stages[source].lateCandidateDiscarded=true; return false; }
      const status=source==='locked_constructor'?'feasible':candidate.status;
      const result=summarize(s, 'lockedRecoveryV6', audit.rows, now()-started, status, {objectiveMode:options.objectiveMode, optimality:source==='locked_constructor'?'locked_constructor_heuristic':candidate.optimality ?? 'feasible_incumbent_only'});
      if (now()>deadline) { stages[source].lateCandidateDiscarded=true; return false; }
      if (!best || result.objectiveCost<best.objectiveCost || result.objectiveCost===best.objectiveCost && (result.incrementalCost<best.incrementalCost || result.incrementalCost===best.incrementalCost && source==='locked_milp')) { best=result; bestSource=source; return true; }
      return false;
    };
    const constructionDeadline=Math.min(deadline-auditReserveMs, started+budget*constructorShare);
    if (now()<constructionDeadline) {
      counters.constructorCalls++;
      const stageStarted=now();
      stages.locked_constructor={status:'running'};
      try {
        const candidate=structuredClone(await construct(structuredClone(s), {...structuredClone(options), maxRestarts, deadlineMs:constructionDeadline, timeBudgetMs:Math.max(0, constructionDeadline-now()), now}));
        stages.locked_constructor={status:candidate?.status ?? 'missing_result', wallTimeMs:now()-stageStarted, constructorMetadata:candidate?.constructorMetadata};
        consider(candidate, 'locked_constructor');
      } catch (error) { stages.locked_constructor={status:'constructor_error', reason:error instanceof Error?error.message:String(error), wallTimeMs:now()-stageStarted}; }
    } else stages.locked_constructor={status:'budget_skipped'};
    if (now()+auditReserveMs<deadline) {
      counters.solverCalls++;
      const stageStarted=now(), remaining=deadline-now()-auditReserveMs;
      stages.locked_milp={status:'running', requestedTimeLimitMs:remaining};
      try {
        const candidate=structuredClone(await solver(structuredClone(s), {...structuredClone(options), timeLimitSeconds:remaining/1000}, {deadlineMs:deadline, now, auditReserveMs}));
        stages.locked_milp={status:candidate?.status ?? 'missing_result', requestedTimeLimitMs:remaining, wallTimeMs:now()-stageStarted, nativeBudgetMetadata:candidate?.nativeBudgetMetadata, solverStatus:candidate?.solverStatus, solverOptimality:candidate?.optimality, modelSize:candidate?.modelSize, reason:typeof candidate?.reason==='string'?candidate.reason:undefined};
        consider(candidate, 'locked_milp');
        if (best && candidate?.status==='infeasible') stages.locked_milp.infeasibilityContradictsAuditedIncumbent=true;
      } catch (error) { stages.locked_milp={status:'solver_error', reason:error instanceof Error?error.message:String(error), requestedTimeLimitMs:remaining, wallTimeMs:now()-stageStarted}; }
    } else stages.locked_milp={status:'budget_skipped'};
    if (!best) {
      const proven=stages.locked_milp.status==='infeasible' && now()<=deadline;
      const result=failed(proven?'infeasible':'no_feasible_schedule_found', proven?'Locked MILP reports the current observed model infeasible.':'No complete audited locked schedule found within the cooperative budget; this is not an infeasibility proof.');
      if (proven) result.optimality='solver_reported_infeasible';
      return result;
    }
    cached={key, dates:best.rows.map(row => ({id:row.id, pickupDay:row.pickupDay, unloadDay:row.unloadDay, returnDay:row.returnDay}))};
    return {...best, runtimeMs:now()-started, modelVersion:'v6-locked-recovery', plannerMetadata:metadata(bestSource), executionConstraints:{minEventDay:day, lockedEvents:Object.values(options.fixedEvents ?? {}).reduce((n, locks) => n+Object.keys(locks).length, 0)}, ...(hadCache?{planPreviouslyCached:true}:{})};
  };
}
