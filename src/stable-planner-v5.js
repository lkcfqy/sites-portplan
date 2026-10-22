import {auditSchedule, capacityAt, operationParameters, rowFor, solveOptimized, summarize, validateScenario} from './engine.js';
import {auditFrozenEvents} from './rolling-plan.js';

const EVENT_DAYS = ['pickupDay', 'unloadDay', 'returnDay'];
const FEASIBLE = new Set(['feasible', 'optimal']);
const SOLVER_FIELDS = ['solver', 'solverStatus', 'modelSize', 'tieBreakStatus', 'timeLimitSeconds', 'presolveMetadata', 'methodVersion', 'executionConstraints'];

function validateOptions(scenario, options) {
  const day = options.minEventDay ?? 0, fixed = options.fixedEvents ?? {};
  if (!Number.isInteger(day) || day < 0 || day > scenario.horizonDays) throw new Error('minEventDay must be an integer within the horizon.');
  if (!fixed || typeof fixed !== 'object' || Array.isArray(fixed)) throw new Error('fixedEvents must be an object keyed by container id.');
  const ids = new Set(scenario.containers.map(container => container.id));
  for (const [id, locks] of Object.entries(fixed)) {
    if (!ids.has(id) || !locks || typeof locks !== 'object' || Array.isArray(locks)) throw new Error('Invalid execution lock container.');
    for (const [key, date] of Object.entries(locks)) if (!EVENT_DAYS.includes(key) || !Number.isInteger(date) || date < 0 || date >= scenario.horizonDays) throw new Error('Invalid fixed event date.');
  }
  if (!Number.isFinite(options.timeLimitSeconds) || options.timeLimitSeconds <= 0) throw new Error('timeLimitSeconds must be positive and finite.');
  if (!['joint', 'storageOnly', 'ddOnly'].includes(options.objectiveMode)) throw new Error('Invalid objectiveMode.');
}

function validateSnapshot(scenario) {
  const validation = validateScenario(scenario);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  // Array.some in the legacy validator skips holes. Inspect every actual day.
  for (const resource of ['truck', 'warehouse', 'staging']) for (let day=0; day<scenario.horizonDays; day++) {
    const capacity = capacityAt(scenario[`${resource}Capacity`], day);
    if (!Number.isInteger(capacity) || capacity < 0) throw new Error(`${resource}Capacity must supply a nonnegative integer on every horizon day.`);
  }
}

function auditRows(scenario, rows, options) {
  const errors = [];
  if (!Array.isArray(rows) || rows.length !== scenario.containers.length) errors.push('Candidate must cover every known container.');
  if (Array.isArray(rows)) for (const row of rows) {
    if (!row || typeof row !== 'object') { errors.push('Candidate contains a malformed row.'); continue; }
    for (const key of [...EVENT_DAYS, 'unloadEndDay']) if (!Number.isInteger(row[key]) || row[key] < 0 || row[key] >= scenario.horizonDays) errors.push(`${row.id}: ${key} must be a finite integer within the horizon.`);
  }
  let scheduleAudit;
  // Bound date ranges before the existing audit computes daily usage.
  if (errors.length) scheduleAudit = {valid:false, errors};
  else try { scheduleAudit = auditSchedule(scenario, rows); }
  catch (error) { scheduleAudit = {valid:false, errors:[error instanceof Error ? error.message : String(error)]}; }
  const freezeAudit = auditFrozenEvents(rows, options.fixedEvents ?? {}, options.minEventDay ?? 0);
  return {valid:scheduleAudit.valid && freezeAudit.valid, scheduleAudit, freezeAudit};
}

function canonicalRows(scenario, dates) {
  const byId = new Map(dates.map(row => [row.id, row]));
  if (byId.size !== dates.length || byId.size !== scenario.containers.length) throw new Error('Cached dates do not cover the known containers exactly once.');
  return scenario.containers.map(container => {
    const row = byId.get(container.id);
    if (!row) throw new Error(`${container.id}: cached event dates are missing.`);
    for (const key of EVENT_DAYS) if (!Number.isInteger(row[key]) || row[key] < 0 || row[key] >= scenario.horizonDays) throw new Error(`${container.id}: ${key} is outside the current horizon.`);
    return rowFor(scenario, container, row.pickupDay, row.unloadDay, row.returnDay);
  });
}

function episodeKey(scenario) {
  // Capacity forecasts and tariff prices deliberately do not identify a new
  // episode: those can change while a retained date plan stays feasible.
  const containers = scenario.containers.map(container => [container.id, container.sizeFt, container.dischargeDateTime, container.releaseDay, container.unloadDays, container.dueDay]).sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify({id:scenario.id ?? null, horizonStart:scenario.horizonStart, horizonDays:scenario.horizonDays, operations:operationParameters(scenario), containers});
}

/** Retain feasible dates; solve only initially or when the current snapshot
 * invalidates the cached complete plan. Make one factory instance per episode.
 * Inputs are the same causal snapshots as the V4 rolling planner, never shocks.
 * Configuration and individual calls may inject a solver callback for testing.
 */
export function createStablePlanner(configuration={}) {
  const {solver:defaultSolver=solveOptimized, timeLimitSeconds:defaultLimit=0.2, ...defaultsInput} = configuration;
  if (typeof defaultSolver !== 'function') throw new Error('solver must be a function.');
  if (!Number.isFinite(defaultLimit) || defaultLimit <= 0) throw new Error('timeLimitSeconds must be positive and finite.');
  const defaults = structuredClone(defaultsInput);
  const counters = {decisionCalls:0, solverCalls:0, reusedPlans:0, replannedDueToInvalid:0};
  let cached = null, lastDecisionDay = null;

  return async function stablePlanner(scenario, callOptions={}) {
    const started = performance.now(), snapshot = structuredClone(scenario);
    const {solver:callSolver, ...dataOptions} = callOptions;
    const solver = callSolver ?? defaultSolver;
    if (typeof solver !== 'function') throw new Error('solver must be a function.');
    const options = {...structuredClone(defaults), ...structuredClone(dataOptions)};
    options.timeLimitSeconds ??= defaultLimit;
    options.objectiveMode ??= snapshot.objectiveMode ?? 'joint';
    validateSnapshot(snapshot);
    validateOptions(snapshot, options);
    counters.decisionCalls++;
    const day = options.minEventDay ?? 0, key = episodeKey(snapshot);
    const hadCache = cached !== null;
    let cacheAudit = null, cacheInvalidationReasons = [];

    const metadata = (candidateSource, accepted, extra={}) => ({
      method:'v5-retain-feasible', ...counters, candidateSource, accepted,
      cacheStatus:hadCache ? cacheInvalidationReasons.length ? 'invalid' : 'valid' : 'absent',
      cacheInvalidationReasons:[...cacheInvalidationReasons], ...(cacheAudit ? {cacheAudit} : {}), ...extra,
    });

    const failed = (status, reason, candidateSource, extra={}) => ({
      policy:'stableRetainV5', modelVersion:'v5-retain-feasible', status, optimality:'not_proven', reason,
      rows:[], totalCost:null, incrementalCost:null, storageCost:null, ddCost:null, sunkCost:null, objectiveCost:null, lateCount:null,
      usage:[], runtimeMs:performance.now()-started, objectiveMode:options.objectiveMode,
      plannerMetadata:metadata(candidateSource, false), ...extra,
    });

    if (cached) {
      if (cached.episodeKey !== key) cacheInvalidationReasons.push('Cached plan belongs to a different known-order episode.');
      if (lastDecisionDay !== null && day < lastDecisionDay) cacheInvalidationReasons.push('Decision day moved backwards; start a fresh planning episode.');
      if (!cacheInvalidationReasons.length) {
        let rows;
        try { rows = canonicalRows(snapshot, cached.dates); }
        catch (error) { cacheInvalidationReasons.push(error instanceof Error ? error.message : String(error)); }
        if (rows) {
          cacheAudit = auditRows(snapshot, rows, options);
          if (cacheAudit.valid) {
            counters.reusedPlans++;
            lastDecisionDay = day;
            return summarize(snapshot, 'stableRetainV5', rows, performance.now()-started, 'feasible', {
              modelVersion:'v5-retain-feasible', optimality:'retained_plan_not_reoptimized', objectiveMode:options.objectiveMode,
              solver:'Not invoked; retained previously audited event dates.', solverStatus:null, tieBreakStatus:'not_reoptimized',
              timeLimitSeconds:options.timeLimitSeconds, plannerMetadata:metadata('retained_plan', true),
            });
          }
          cacheInvalidationReasons.push(...cacheAudit.scheduleAudit.errors, ...cacheAudit.freezeAudit.errors);
        }
      }
      counters.replannedDueToInvalid++;
    }

    const candidateSource = hadCache ? 'solver_replan' : 'solver_initial';
    counters.solverCalls++;
    lastDecisionDay = day;
    let candidate;
    try { candidate = structuredClone(await solver(structuredClone(snapshot), structuredClone(options))); }
    catch (error) { return failed('planner_error', error instanceof Error ? error.message : String(error), candidateSource); }
    const solverFields = Object.fromEntries(SOLVER_FIELDS.filter(field => candidate && Object.hasOwn(candidate, field)).map(field => [field, candidate[field]]));
    if (!FEASIBLE.has(candidate?.status)) return failed(typeof candidate?.status === 'string' ? candidate.status : 'no_complete_plan', typeof candidate?.reason === 'string' ? candidate.reason : 'Solver did not return a complete feasible candidate.', candidateSource, solverFields);
    const candidateAudit = auditRows(snapshot, candidate.rows, options);
    if (!candidateAudit.valid) return failed('candidate_rejected', 'Solver candidate failed schedule or frozen-event audit.', candidateSource, {...solverFields, candidateAudit});
    const rows = canonicalRows(snapshot, candidate.rows);
    cached = {episodeKey:key, dates:rows.map(row => ({id:row.id, pickupDay:row.pickupDay, unloadDay:row.unloadDay, returnDay:row.returnDay}))};
    return summarize(snapshot, 'stableRetainV5', rows, performance.now()-started, candidate.status, {
      ...solverFields, modelVersion:'v5-retain-feasible', optimality:candidate.optimality ?? (candidate.status === 'optimal' ? 'solver_reported_optimal' : 'feasible_incumbent_only'),
      objectiveMode:options.objectiveMode, plannerMetadata:metadata(candidateSource, true), candidateAudit,
    });
  };
}
