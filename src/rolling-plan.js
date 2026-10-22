import {auditSchedule, capacityAt, rowFor, scheduleUsage, solveOptimized, summarize, validateScenario} from './engine.js';

const RESOURCES = ['truck', 'warehouse', 'staging'];
const EVENT_DAYS = ['pickupDay', 'unloadDay', 'returnDay'];
const EVENT_NAMES = {pickupDay:'pickup', unloadDay:'unloadStart', returnDay:'return'};
const SUCCESS_STATUSES = new Set(['optimal', 'feasible']);

/** Events set a resource's capacity, starting at revealDay (never retroactively).
 * duration is private ground truth. Only an explicit announcedDuration is known
 * in advance; when supplied it must describe the actual complete duration.
 * Overlapping shocks use the latest revelation, then input order as a tie break.
 */
export function normalizeCapacityEvents(scenario, events=[]) {
  if (!Array.isArray(events)) throw new Error('Capacity events must be an array.');
  const ids = new Set();
  return events.map((event, index) => {
    if (!event || typeof event !== 'object') throw new Error(`Capacity event ${index} must be an object.`);
    const id = event.id ?? `shock-${index}`;
    const resource = typeof event.resource === 'string' ? event.resource.replace(/Capacity$/, '') : event.resource;
    const revealDay = event.revealDay;
    const duration = event.duration ?? event.announcedDuration ?? 1;
    if (typeof id !== 'string' || !id || ids.has(id)) throw new Error('Capacity event ids must be nonempty and unique.');
    ids.add(id);
    if (!RESOURCES.includes(resource)) throw new Error(`${id}: resource must be truck, warehouse or staging.`);
    if (!Number.isInteger(revealDay) || revealDay < 0 || revealDay >= scenario.horizonDays) throw new Error(`${id}: revealDay is outside the horizon.`);
    if (event.startDay !== undefined && event.startDay !== revealDay) throw new Error(`${id}: capacity effects must start exactly on revealDay.`);
    if (!Number.isInteger(event.capacity) || event.capacity < 0) throw new Error(`${id}: capacity must be a nonnegative integer.`);
    if (!Number.isInteger(duration) || duration < 1) throw new Error(`${id}: duration must be a positive integer.`);
    if (event.announcedDuration !== undefined && event.announcedDuration !== duration) throw new Error(`${id}: announcedDuration must equal the actual duration.`);
    return {id, resource, revealDay, capacity:event.capacity, duration, ...(event.announcedDuration !== undefined ? {announcedDuration:event.announcedDuration} : {}), index};
  }).sort((a, b) => a.revealDay - b.revealDay || a.index - b.index);
}

function expandedNominal(scenario) {
  const result = structuredClone(scenario);
  for (const resource of RESOURCES) {
    const capacities = Array.from({length:scenario.horizonDays}, (_, day) => capacityAt(scenario[`${resource}Capacity`], day));
    if (capacities.some(capacity => !Number.isInteger(capacity) || capacity < 0)) throw new Error(`${resource}Capacity must supply a nonnegative integer on every horizon day.`);
    result[`${resource}Capacity`] = capacities;
  }
  return result;
}

function applyEvent(scenario, event) {
  for (let day=event.revealDay; day<Math.min(scenario.horizonDays, event.revealDay+event.duration); day++) scenario[`${event.resource}Capacity`][day] = event.capacity;
}

/** This full-realization scenario is for execution/auditing, never planner input. */
export function realizeCapacityEvents(nominal, events=[]) {
  const actual = expandedNominal(nominal);
  for (const event of normalizeCapacityEvents(nominal, events)) applyEvent(actual, event);
  return actual;
}

function observedScenario(nominal, actual, events, day) {
  const observed = expandedNominal(nominal);
  // Public duration is the sole permission to change an unobserved future day.
  for (const event of events) if (event.revealDay <= day && event.announcedDuration !== undefined) applyEvent(observed, event);
  for (const resource of RESOURCES) for (let past=0; past<=day; past++) observed[`${resource}Capacity`][past] = actual[`${resource}Capacity`][past];
  return observed;
}

function dailyObservations(actual, events, day) {
  return RESOURCES.map(resource => ({
    kind:'day_start_capacity', day, resource, capacity:actual[`${resource}Capacity`][day],
    activeShockIds:events.filter(event => event.resource === resource && event.revealDay <= day && day < event.revealDay+event.duration).map(event => event.id),
    announcements:events.filter(event => event.resource === resource && event.revealDay === day).map(event => ({
      id:event.id, revealDay:day, resource:event.resource, capacity:event.capacity,
      ...(event.announcedDuration !== undefined ? {announcedDuration:event.announcedDuration} : {}),
    })),
  }));
}

function stableJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableJSON).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => `${JSON.stringify(key)}:${stableJSON(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

async function observationHash(value) {
  const input = stableJSON(value);
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  // Non-secure browser previews can lack WebCrypto. Label the weaker checksum.
  let hash = 2166136261;
  for (let index=0; index<input.length; index++) hash = Math.imul(hash ^ input.charCodeAt(index), 16777619);
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

/** Frozen dates represent physical history. An unexecuted event cannot be put
 * into the past, even if an otherwise complete schedule passes the static audit.
 */
export function auditFrozenEvents(rows, fixedEvents={}, minEventDay=0) {
  const errors = [];
  if (!Array.isArray(rows)) return {valid:false, errors:['Candidate rows must be an array.']};
  const byId = new Map(rows.filter(row => row && typeof row === 'object').map(row => [row.id, row]));
  for (const row of rows) {
    if (!row || typeof row !== 'object') { errors.push('Candidate contains a malformed row.'); continue; }
    const fixed = fixedEvents[row.id] ?? {};
    for (const key of EVENT_DAYS) {
      if (Object.hasOwn(fixed, key)) {
        if (row[key] !== fixed[key]) errors.push(`${row.id}: frozen ${key} changed from ${fixed[key]} to ${row[key]}.`);
      } else if (!Number.isInteger(row[key]) || row[key] < minEventDay) errors.push(`${row.id}: unexecuted ${key} must be at least day ${minEventDay}.`);
    }
  }
  for (const id of Object.keys(fixedEvents)) if (!byId.has(id)) errors.push(`${id}: frozen history missing from candidate.`);
  return {valid:errors.length === 0, errors};
}

const decisionRows = rows => rows.filter(row => row && typeof row === 'object').map(row => ({id:row.id, pickupDay:row.pickupDay, unloadDay:row.unloadDay, returnDay:row.returnDay}));

function stateAfterDay(scenario, fixedEvents, day) {
  return scenario.containers.map(container => {
    const fixed = fixedEvents[container.id] ?? {};
    let phase = 'not_picked_up';
    if (fixed.pickupDay !== undefined) phase = 'staged';
    if (fixed.unloadDay !== undefined) phase = day < fixed.unloadDay+container.unloadDays-1 ? 'unloading' : 'awaiting_return';
    if (fixed.returnDay !== undefined) phase = 'returned';
    return {id:container.id, phase, ...fixed};
  });
}

function candidateAudits(scenario, rows, fixedEvents, day) {
  const shapeErrors = [];
  if (!Array.isArray(rows)) shapeErrors.push('Candidate rows must be an array.');
  else for (const row of rows) {
    if (!row || typeof row !== 'object') { shapeErrors.push('Candidate contains a malformed row.'); continue; }
    for (const key of [...EVENT_DAYS, 'unloadEndDay']) if (!Number.isInteger(row[key]) || row[key] < 0 || row[key] >= scenario.horizonDays) shapeErrors.push(`${row.id}: ${key} must be a finite integer within the horizon.`);
  }
  let scheduleAudit;
  // The legacy audit still computes usage after finding invalid dates. Bound
  // dates first, preventing Infinity or enormous ranges from hanging its loops.
  if (shapeErrors.length) scheduleAudit = {valid:false, errors:shapeErrors};
  else try { scheduleAudit = auditSchedule(scenario, rows); }
  catch (error) { scheduleAudit = {valid:false, errors:[`Malformed candidate: ${error instanceof Error ? error.message : String(error)}`]}; }
  const freezeAudit = auditFrozenEvents(rows, fixedEvents, day);
  return {scheduleAudit, freezeAudit, valid:scheduleAudit.valid && freezeAudit.valid};
}

/** Causal, day-start rolling replanning for known synthetic orders.
 * All day-t event choices execute atomically under the engine's daily model:
 * pickup and return each use one truck movement; unloading occupies both end
 * days; staging is [pickup, return). No additional intra-day ordering is assumed.
 * planner receives only a cloned observation scenario and cloned constraints.
 * The realized future, private duration and unrevealed event list are withheld.
 */
export async function runRollingScenario(nominal, events=[], options={}) {
  const validation = validateScenario(nominal);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  const planner = options.planner ?? solveOptimized;
  if (typeof planner !== 'function') throw new Error('planner must be a function.');
  const timeLimitSeconds = options.timeLimitSeconds ?? 0.2;
  if (!Number.isFinite(timeLimitSeconds) || timeLimitSeconds <= 0) throw new Error('timeLimitSeconds must be positive and finite.');
  const objectiveMode = options.objectiveMode ?? nominal.objectiveMode ?? 'joint';
  if (!['joint', 'storageOnly', 'ddOnly'].includes(objectiveMode)) throw new Error('Invalid objectiveMode.');
  const source = structuredClone(nominal), normalized = normalizeCapacityEvents(source, events);
  const actual = expandedNominal(source);
  for (const event of normalized) applyEvent(actual, event);
  const fixedEvents = Object.create(null), timeline = [];
  let previousDecisions = null, revisionCount = 0;
  const started = performance.now();
  const base = {
    policy:'rollingReplan', modelVersion:'v4-causal-rolling', timeLimitSeconds,
    assumptions:{ordersKnownAtStart:true, informationTiming:'day_start', unseenFutureCapacity:'nominal', execution:'engine_daily_atomic', revisionCountUnit:'pending_event_date_changes'},
    warnings:validation.warnings,
  };

  function failed(day, kind, reason, detail={}) {
    return {...base, status:'rolling_failed', optimality:'not_proven', complete:false,
      rows:[], totalCost:null, incrementalCost:null, storageCost:null, ddCost:null, sunkCost:null, objectiveCost:null, lateCount:null,
      runtimeMs:performance.now()-started, revisionCount, timeline, executedEvents:timeline.flatMap(entry => entry.executedEvents),
      finalState:timeline.at(-1)?.state ?? stateAfterDay(source, fixedEvents, day-1), failure:{day, kind, reason, ...detail}, usage:[],
    };
  }

  for (let day=0; day<source.horizonDays; day++) {
    const observation = observedScenario(source, actual, normalized, day);
    const observedEvents = dailyObservations(actual, normalized, day);
    const plannerOptions = {timeLimitSeconds, objectiveMode, fixedEvents:structuredClone(fixedEvents), minEventDay:day};
    // Hash only the information available to this decision, never actual future.
    const hash = await observationHash({scenario:observation, observedEvents, fixedEvents, minEventDay:day});
    const entry = {day, observedEvents, observationHash:hash, decisions:[], executedEvents:[], revisionCount, status:'planning', state:stateAfterDay(source, fixedEvents, day-1)};
    timeline.push(entry);
    let candidate;
    try { candidate = structuredClone(await planner(structuredClone(observation), structuredClone(plannerOptions))); }
    catch (error) {
      entry.status = 'planner_error';
      return failed(day, 'planner_error', error instanceof Error ? error.message : String(error));
    }
    entry.plannerStatus = candidate?.status ?? 'missing_result';
    if (!SUCCESS_STATUSES.has(candidate?.status) || !Array.isArray(candidate?.rows) || candidate.rows.length !== source.containers.length) {
      entry.status = 'planning_failed';
      if (Array.isArray(candidate?.rows)) entry.decisions = decisionRows(candidate.rows.filter(row => row && typeof row === 'object'));
      return failed(day, 'no_complete_plan', candidate?.reason ?? 'Planner did not return a complete feasible schedule.', {plannerStatus:entry.plannerStatus});
    }
    entry.decisions = decisionRows(candidate.rows);
    const audit = candidateAudits(observation, candidate.rows, fixedEvents, day);
    entry.audit = audit;
    if (!audit.valid) {
      entry.status = 'candidate_rejected';
      return failed(day, 'candidate_rejected', 'Candidate failed schedule or frozen-event audit.', {errors:[...audit.scheduleAudit.errors, ...audit.freezeAudit.errors]});
    }
    const rows = source.containers.map(container => {
      const row = candidate.rows.find(candidateRow => candidateRow.id === container.id);
      return rowFor(source, container, row.pickupDay, row.unloadDay, row.returnDay);
    });
    // Independently check today's realized resources before executing anything.
    const usage = scheduleUsage(actual, rows)[day];
    const executionErrors = RESOURCES.filter(resource => usage[resource] > usage[`${resource}Capacity`]).map(resource => `Day ${day}: realized ${resource} capacity exceeded.`);
    if (executionErrors.length) {
      entry.status = 'execution_rejected';
      return failed(day, 'execution_rejected', 'Current-day execution violates realized capacity.', {errors:executionErrors});
    }
    const priorById = new Map((previousDecisions ?? []).map(row => [row.id, row]));
    const revisions = [];
    if (previousDecisions) for (const row of rows) for (const key of EVENT_DAYS) {
      if (!Object.hasOwn(fixedEvents[row.id] ?? {}, key) && priorById.get(row.id)?.[key] !== row[key]) revisions.push({id:row.id, event:EVENT_NAMES[key], previousDay:priorById.get(row.id)?.[key], newDay:row[key]});
    }
    revisionCount += revisions.length;
    entry.revisions = revisions;
    entry.revisionCount = revisionCount;
    for (const row of rows) for (const key of EVENT_DAYS) if (row[key] === day) {
      const fixed = fixedEvents[row.id] ??= {};
      fixed[key] = day;
      entry.executedEvents.push({id:row.id, event:EVENT_NAMES[key], day});
    }
    entry.status = 'executed';
    entry.state = stateAfterDay(source, fixedEvents, day);
    previousDecisions = decisionRows(rows);
    if (source.containers.every(container => fixedEvents[container.id]?.returnDay !== undefined)) {
      const executedRows = source.containers.map(container => {
        const fixed = fixedEvents[container.id];
        return rowFor(source, container, fixed.pickupDay, fixed.unloadDay, fixed.returnDay);
      });
      const finalAudit = candidateAudits(actual, executedRows, fixedEvents, day+1);
      if (!finalAudit.valid) return failed(day, 'final_audit_failed', 'Complete execution failed its final realization audit.', {errors:[...finalAudit.scheduleAudit.errors, ...finalAudit.freezeAudit.errors]});
      return {...summarize(actual, base.policy, executedRows, performance.now()-started, 'feasible', {objectiveMode:plannerOptions.objectiveMode}),
        ...base, complete:true, optimality:'rolling_feasible_not_global_optimum', revisionCount, timeline,
        usage:scheduleUsage(actual, executedRows).slice(0, day+1), executionThroughDay:day,
        executedEvents:timeline.flatMap(record => record.executedEvents), finalState:entry.state, finalAudit, failure:null,
      };
    }
  }
  return failed(source.horizonDays-1, 'horizon_exhausted', 'Not all required events completed within the horizon.');
}
