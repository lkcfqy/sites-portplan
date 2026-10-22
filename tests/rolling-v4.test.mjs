import test from 'node:test';
import assert from 'node:assert/strict';
import {auditSchedule, capacityAt, rowFor, returnOffset, summarize} from '../src/engine.js';
import {auditFrozenEvents, normalizeCapacityEvents, realizeCapacityEvents, runRollingScenario} from '../src/rolling-plan.js';

const tiny = (extra={}) => ({
  id:'v4-causal-test', horizonStart:'2026-10-12', horizonDays:6,
  truckCapacity:2, warehouseCapacity:1, stagingCapacity:1,
  containers:[{id:'T0', sizeFt:20, dischargeDateTime:'2026-09-29T07:00:00+09:00', releaseDay:0, unloadDays:1, dueDay:4, dataOrigin:'synthetic'}],
  ...extra,
});

const planned = (scenario, p, u, r, extra={}) => ({...summarize(scenario, 'test_planner', [rowFor(scenario, scenario.containers[0], p, u, r)], 0, 'feasible'), ...extra});

function oneContainerPlanner(calls, {pickupDay=2, returnDay=4}={}) {
  return (scenario, options) => {
    calls.push({scenario:structuredClone(scenario), options:structuredClone(options)});
    const container = scenario.containers[0], fixed = options.fixedEvents[container.id] ?? {};
    let p = fixed.pickupDay ?? Math.max(pickupDay, options.minEventDay);
    while (fixed.pickupDay === undefined && p<scenario.horizonDays && capacityAt(scenario.truckCapacity, p)<1) p++;
    const u = fixed.unloadDay ?? Math.max(p, options.minEventDay);
    let r = fixed.returnDay ?? Math.max(returnDay, u+returnOffset(scenario, container), options.minEventDay);
    while (fixed.returnDay === undefined && r<scenario.horizonDays && capacityAt(scenario.truckCapacity, r)<1+(p===r)) r++;
    if (r>=scenario.horizonDays) return {status:'infeasible', rows:[], reason:'No return date.'};
    return planned(scenario, p, u, r);
  };
}

test('future shocks and private duration are withheld from every planner call', async () => {
  const nominal = tiny(), original = structuredClone(nominal), calls = [];
  const events = [
    {id:'hidden-truck', revealDay:3, resource:'truck', capacity:0, duration:2},
    {id:'future-warehouse', revealDay:5, resource:'warehouse', capacity:1},
  ];
  const actual = realizeCapacityEvents(nominal, events);
  const result = await runRollingScenario(nominal, events, {planner:oneContainerPlanner(calls), timeLimitSeconds:0.15});
  assert.equal(result.complete, true);
  assert.equal(result.rows[0].returnDay, 5);
  assert.equal(calls.length, 6);
  for (const [day, call] of calls.entries()) {
    assert.equal(call.options.minEventDay, day);
    assert.equal(call.options.timeLimitSeconds, 0.15);
    assert.deepEqual(Object.keys(call.options).sort(), ['fixedEvents', 'minEventDay', 'objectiveMode', 'timeLimitSeconds']);
    for (const resource of ['truck', 'warehouse', 'staging']) for (let d=0; d<nominal.horizonDays; d++) {
      assert.equal(call.scenario[`${resource}Capacity`][d], d<=day ? actual[`${resource}Capacity`][d] : capacityAt(nominal[`${resource}Capacity`], d));
    }
    assert.equal(JSON.stringify(call).includes('hidden-truck'), false);
    assert.equal(JSON.stringify(call).includes('future-warehouse'), false);
    assert.equal(JSON.stringify(call).includes('duration'), false);
    for (const [id, fixed] of Object.entries(call.options.fixedEvents)) for (const [key, executedDay] of Object.entries(fixed)) {
      assert.ok(executedDay<day);
      assert.equal(result.rows.find(row => row.id===id)[key], executedDay);
    }
  }
  assert.deepEqual(nominal, original);
  assert.equal(auditSchedule(actual, result.rows).valid, true);
  assert.equal(result.totalCost, rowFor(nominal, nominal.containers[0], 2, 2, 5).totalCost);
  assert.equal(result.optimality, 'rolling_feasible_not_global_optimum');
  assert.equal(result.timeline[0].observedEvents.some(event => event.activeShockIds.length), false);
  assert.equal(JSON.stringify(result.timeline.slice(0, 3)).includes('hidden-truck'), false);
  assert.equal(JSON.stringify(result.timeline).includes('"duration"'), false);
  assert.match(result.timeline[0].observationHash, /^(sha256:[a-f0-9]{64}|fnv1a32:[a-f0-9]{8})$/);
});

test('two different hidden durations have identical observations at the initial revelation', async () => {
  const nominal = tiny(), callsA = [], callsB = [];
  const a = await runRollingScenario(nominal, [{id:'same-shock', revealDay:0, resource:'truck', capacity:1, duration:1}], {planner:oneContainerPlanner(callsA)});
  const b = await runRollingScenario(nominal, [{id:'same-shock', revealDay:0, resource:'truck', capacity:1, duration:3}], {planner:oneContainerPlanner(callsB)});
  assert.deepEqual(callsA[0], callsB[0]);
  assert.deepEqual(a.timeline[0], b.timeline[0]);
  assert.equal(callsA[0].scenario.truckCapacity[1], nominal.truckCapacity);
});

test('changing an unrevealed future realization leaves early decisions and observation hashes identical', async () => {
  const nominal = tiny(), callsA = [], callsB = [];
  const a = await runRollingScenario(nominal, [{id:'A', revealDay:3, resource:'truck', capacity:0}], {planner:oneContainerPlanner(callsA)});
  const b = await runRollingScenario(nominal, [{id:'B', revealDay:3, resource:'warehouse', capacity:0, duration:2}], {planner:oneContainerPlanner(callsB)});
  assert.deepEqual(callsA.slice(0, 3), callsB.slice(0, 3));
  assert.deepEqual(a.timeline.slice(0, 3), b.timeline.slice(0, 3));
  assert.equal(a.complete, true);
  assert.equal(b.complete, true);
});

test('a completed causal result does not disclose later unobserved actual capacities', async () => {
  const nominal = tiny(), calls = [];
  const result = await runRollingScenario(nominal, [{id:'after-completion', revealDay:5, resource:'truck', capacity:0}], {planner:oneContainerPlanner(calls, {pickupDay:0, returnDay:1})});
  assert.equal(result.complete, true);
  assert.equal(result.executionThroughDay, 1);
  assert.equal(result.usage.length, 2);
  assert.equal(JSON.stringify(result).includes('after-completion'), false);
});

test('an announced duration changes known future capacity only after its reveal day', async () => {
  const nominal = tiny(), calls = [];
  const event = {id:'announced-closure', revealDay:1, resource:'truckCapacity', capacity:0, announcedDuration:2};
  const result = await runRollingScenario(nominal, [event], {planner:oneContainerPlanner(calls, {pickupDay:1, returnDay:4})});
  assert.equal(result.complete, true);
  assert.deepEqual(calls[0].scenario.truckCapacity, [2, 2, 2, 2, 2, 2]);
  assert.deepEqual(calls[1].scenario.truckCapacity, [2, 0, 0, 2, 2, 2]);
  assert.equal(result.rows[0].pickupDay, 3);
  assert.equal(result.timeline[1].observedEvents[0].announcements[0].announcedDuration, 2);
});

test('a planner that changes an executed pickup is rejected despite passing the static audit', async () => {
  const calls = [], result = await runRollingScenario(tiny(), [], {planner:(scenario, options) => {
    calls.push(structuredClone(options));
    return options.minEventDay===0 ? planned(scenario, 0, 1, 3) : planned(scenario, 1, 1, 3);
  }});
  assert.equal(result.status, 'rolling_failed');
  assert.equal(result.failure.day, 1);
  assert.equal(result.failure.kind, 'candidate_rejected');
  assert.equal(result.timeline[1].audit.scheduleAudit.valid, true);
  assert.equal(result.timeline[1].audit.freezeAudit.valid, false);
  assert.match(result.failure.errors.join('; '), /frozen pickupDay changed/);
  assert.deepEqual(calls[1].fixedEvents, {T0:{pickupDay:0}});
  assert.deepEqual(result.executedEvents, [{id:'T0', event:'pickup', day:0}]);
  assert.equal(result.totalCost, null);
  assert.deepEqual(result.rows, []);
});

test('an unexecuted event cannot be moved into the past', async () => {
  const result = await runRollingScenario(tiny(), [], {planner:(scenario, options) => options.minEventDay===0 ? planned(scenario, 0, 2, 3) : planned(scenario, 0, 0, 3)});
  assert.equal(result.failure.day, 1);
  assert.equal(result.timeline[1].audit.scheduleAudit.valid, true);
  assert.match(result.failure.errors.join('; '), /unexecuted unloadDay must be at least day 1/);
  assert.deepEqual(result.executedEvents, [{id:'T0', event:'pickup', day:0}]);
});

test('frozen pickup, unloading and return dates are audited independently', () => {
  const rows = [{id:'A', pickupDay:0, unloadDay:1, returnDay:3}];
  assert.equal(auditFrozenEvents(rows, {A:{pickupDay:0, unloadDay:1}}, 2).valid, true);
  for (const key of ['pickupDay', 'unloadDay', 'returnDay']) {
    const fixed = {A:{pickupDay:0, unloadDay:1, returnDay:3}};
    const changed = [{...rows[0], [key]:rows[0][key]+1}];
    assert.equal(auditFrozenEvents(changed, fixed, 4).valid, false);
  }
  assert.equal(auditFrozenEvents([], {A:{pickupDay:0}}, 1).valid, false);
});

test('started unloading cannot be restarted to evade a current warehouse closure', async () => {
  const nominal = tiny({containers:[{...tiny().containers[0], unloadDays:3}]}), calls = [];
  const result = await runRollingScenario(nominal, [{revealDay:1, resource:'warehouse', capacity:0}], {planner:(scenario, options) => {
    calls.push(structuredClone(options));
    return options.minEventDay===0 ? planned(scenario, 0, 0, 3) : planned(scenario, 0, 2, 5);
  }});
  assert.equal(result.failure.day, 1);
  assert.equal(result.timeline[1].audit.scheduleAudit.valid, true);
  assert.match(result.failure.errors.join('; '), /frozen unloadDay changed/);
  assert.deepEqual(calls[1].fixedEvents, {T0:{pickupDay:0, unloadDay:0}});
  assert.equal(result.finalState[0].phase, 'unloading');
  assert.equal(result.executedEvents.filter(event => event.event==='unloadStart').length, 1);
});

test('planner mutation cannot raise real capacity or remove frozen history', async () => {
  const nominal = tiny({containers:[{...tiny().containers[0], unloadDays:3}]}), before = structuredClone(nominal);
  const events = [{revealDay:1, resource:'warehouse', capacity:0}], eventsBefore = structuredClone(events);
  const result = await runRollingScenario(nominal, events, {planner:(scenario, options) => {
    if (options.minEventDay===1) {
      scenario.warehouseCapacity[1] = 100;
      delete options.fixedEvents.T0;
      options.minEventDay = 0;
    }
    return planned(scenario, 0, 0, 3);
  }});
  assert.equal(result.status, 'rolling_failed');
  assert.match(result.failure.errors.join('; '), /Day 1: warehouse capacity exceeded/);
  assert.equal(result.timeline[1].audit.freezeAudit.valid, true);
  assert.deepEqual(nominal, before);
  assert.deepEqual(events, eventsBefore);
  assert.equal(realizeCapacityEvents(nominal, events).warehouseCapacity[1], 0);
});

test('partial or timed-out planning preserves execution history without reporting partial savings', async () => {
  const result = await runRollingScenario(tiny(), [], {planner:(scenario, options) => options.minEventDay===0
    ? planned(scenario, 0, 2, 3)
    : {status:'time_limit', rows:[], partialRows:[rowFor(scenario, scenario.containers[0], 0, 2, 3)], totalCost:1, reason:'No audited incumbent.'}});
  assert.equal(result.failure.kind, 'no_complete_plan');
  assert.equal(result.failure.plannerStatus, 'time_limit');
  assert.equal(result.timeline.length, 2);
  assert.equal(result.timeline[1].executedEvents.length, 0);
  assert.equal(result.finalState[0].phase, 'staged');
  for (const key of ['totalCost', 'incrementalCost', 'storageCost', 'ddCost', 'sunkCost', 'objectiveCost', 'lateCount']) assert.equal(result[key], null);
  assert.equal(result.complete, false);
});

test('revision counts measure changed pending event dates, and fees come from complete executed dates', async () => {
  const nominal = tiny(), calls = [];
  const result = await runRollingScenario(nominal, [{revealDay:1, resource:'truck', capacity:0}], {planner:oneContainerPlanner(calls, {pickupDay:1, returnDay:3})});
  assert.equal(result.complete, true);
  assert.equal(result.revisionCount, 2);
  assert.deepEqual(result.timeline[1].revisions.map(revision => revision.event), ['pickup', 'unloadStart']);
  assert.equal(result.rows[0].pickupDay, 2);
  assert.equal(result.rows[0].returnDay, 3);
  assert.equal(result.totalCost, rowFor(nominal, nominal.containers[0], 2, 2, 3).totalCost);
  assert.equal(result.finalAudit.valid, true);
});

test('same-day pickup, unload and return retain original daily truck and staging semantics', async () => {
  const nominal = tiny({horizonDays:2, stagingCapacity:0, operations:{returnLagDays:0}, containers:[{...tiny().containers[0], dueDay:0}]});
  const result = await runRollingScenario(nominal, [], {planner:scenario => planned(scenario, 0, 0, 0, {totalCost:999})});
  assert.equal(result.complete, true);
  assert.equal(result.timeline.length, 1);
  assert.deepEqual(result.executedEvents.map(event => event.event), ['pickup', 'unloadStart', 'return']);
  assert.equal(result.usage[0].truck, 2);
  assert.equal(result.usage[0].warehouse, 1);
  assert.equal(result.usage[0].staging, 0);
  assert.equal(result.totalCost, rowFor(nominal, nominal.containers[0], 0, 0, 0).totalCost);
});

test('invalid shock protocols reject retroactive effects, impossible durations and ambiguous announcements', () => {
  const scenario = tiny();
  for (const event of [
    {revealDay:1, startDay:0, resource:'truck', capacity:0},
    {revealDay:1, resource:'truck', capacity:-1},
    {revealDay:1, resource:'truck', capacity:0, duration:0},
    {revealDay:1, resource:'truck', capacity:0, duration:3, announcedDuration:2},
    {revealDay:-1, resource:'truck', capacity:0},
    {revealDay:1, resource:'not_a_resource', capacity:0},
  ]) assert.throws(() => normalizeCapacityEvents(scenario, [event]));
  assert.throws(() => normalizeCapacityEvents(scenario, [{id:'duplicate', revealDay:0, resource:'truck', capacity:0}, {id:'duplicate', revealDay:1, resource:'truck', capacity:0}]));
});

test('a planner exception or malformed complete row records failure rather than executing actions', async () => {
  const exception = await runRollingScenario(tiny(), [], {planner:() => { throw new Error('Unavailable solver.'); }});
  assert.equal(exception.failure.kind, 'planner_error');
  assert.equal(exception.executedEvents.length, 0);
  const malformed = await runRollingScenario(tiny(), [], {planner:() => ({status:'feasible', rows:[null]})});
  assert.equal(malformed.failure.kind, 'candidate_rejected');
  assert.equal(malformed.executedEvents.length, 0);
});

test('non-Error planner throws preserve a structured rolling failure', async () => {
  for (const thrown of [null, undefined, 'Unavailable solver.']) {
    const result = await runRollingScenario(tiny(), [], {planner:() => { throw thrown; }});
    assert.equal(result.failure.kind, 'planner_error');
    assert.equal(result.failure.reason, String(thrown));
    assert.equal(result.totalCost, null);
    assert.equal(result.executedEvents.length, 0);
  }
});

test('invalid or unbounded candidate date ranges reject before legacy usage loops', async () => {
  for (const patch of [{unloadDay:-Infinity, unloadEndDay:-Infinity}, {pickupDay:NaN}, {returnDay:10**10}, {unloadEndDay:Infinity}, {unloadDay:0.5}]) {
    const result = await runRollingScenario(tiny(), [], {planner:scenario => ({status:'feasible', rows:[{...rowFor(scenario, scenario.containers[0], 0, 0, 1), ...patch}]})});
    assert.equal(result.failure.kind, 'candidate_rejected');
    assert.match(result.failure.errors.join('; '), /finite integer within the horizon/);
    assert.equal(result.executedEvents.length, 0);
  }
});

test('invalid objective and solver budgets reject before invoking the planner', async () => {
  let calls = 0;
  for (const options of [{objectiveMode:'bogus'}, {timeLimitSeconds:0}, {timeLimitSeconds:-1}, {timeLimitSeconds:Infinity}]) {
    await assert.rejects(runRollingScenario(tiny(), [], {...options, planner:() => { calls++; }}));
  }
  assert.equal(calls, 0);
});

test('sparse resource capacity arrays cannot bypass per-day capacity validation', async () => {
  let calls = 0;
  for (const resource of ['truck', 'warehouse', 'staging']) {
    const nominal = tiny({[`${resource}Capacity`]:new Array(6)});
    await assert.rejects(runRollingScenario(nominal, [], {planner:() => { calls++; }}), /Capacity must (supply|be) a nonnegative integer/);
    assert.throws(() => realizeCapacityEvents(nominal, []), /Capacity must supply a nonnegative integer/);
  }
  assert.equal(calls, 0);
});

test('candidate rows are snapshotted once before all audits and execution', async () => {
  let getterReads = 0;
  const result = await runRollingScenario(tiny(), [], {planner:(scenario, options) => {
    const candidate = planned(scenario, 0, 2, 3);
    if (options.minEventDay===1) Object.defineProperty(candidate.rows[0], 'pickupDay', {enumerable:true, get:() => ++getterReads===1 ? 0 : 1});
    return candidate;
  }});
  assert.equal(result.complete, true);
  assert.equal(getterReads, 1);
  assert.equal(result.rows[0].pickupDay, 0);
  assert.deepEqual(result.executedEvents.filter(event => event.event==='pickup'), [{id:'T0', event:'pickup', day:0}]);
});

test('default MILP planner can execute a complete audited rolling schedule', async () => {
  const result = await runRollingScenario(tiny(), [], {timeLimitSeconds:0.2});
  assert.equal(result.complete, true);
  assert.equal(result.rows.length, 1);
  assert.equal(result.finalAudit.valid, true);
  assert.equal(result.finalState[0].phase, 'returned');
});
