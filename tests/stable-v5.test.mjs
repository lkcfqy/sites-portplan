import test from 'node:test';
import assert from 'node:assert/strict';
import {auditSchedule, rowFor, solveOptimized, summarize} from '../src/engine.js';
import {runRollingScenario} from '../src/rolling-plan.js';
import {createStablePlanner} from '../src/stable-planner-v5.js';

const tiny = (extra={}) => ({
  id:'v5-stability-test', horizonStart:'2026-10-13', horizonDays:6,
  truckCapacity:2, warehouseCapacity:1, stagingCapacity:1,
  containers:[{id:'T0', sizeFt:20, dischargeDateTime:'2026-09-29T07:00:00+09:00', releaseDay:0, unloadDays:1, dueDay:4, dataOrigin:'synthetic'}],
  ...extra,
});
const planned = (scenario, p=1, u=1, r=3, extra={}) => ({
  ...summarize(scenario, 'test_solver', [rowFor(scenario, scenario.containers[0], p, u, r)], 0, 'optimal', {optimality:'proven_optimal', solverStatus:5, tieBreakStatus:'optimal'}),
  ...extra,
});
const constraints = (minEventDay=0, fixedEvents={}) => ({minEventDay, fixedEvents, objectiveMode:'joint', timeLimitSeconds:0.2});

test('no-shock rolling executes one solver plan without discretionary revisions', async () => {
  const solverCalls = [], outputs = [];
  const stable = createStablePlanner({solver:(scenario, options) => {
    solverCalls.push({scenario:structuredClone(scenario), options:structuredClone(options)});
    return planned(scenario);
  }});
  const result = await runRollingScenario(tiny(), [], {planner:async (scenario, options) => {
    const output = await stable(scenario, options); outputs.push(output); return output;
  }});
  assert.equal(result.complete, true);
  assert.equal(result.revisionCount, 0);
  assert.equal(solverCalls.length, 1);
  assert.equal(outputs[0].plannerMetadata.candidateSource, 'solver_initial');
  const last = outputs.at(-1);
  assert.equal(last.plannerMetadata.solverCalls, 1);
  assert.equal(last.plannerMetadata.reusedPlans, 3);
  assert.equal(last.plannerMetadata.replannedDueToInvalid, 0);
  assert.equal(last.plannerMetadata.decisionCalls, 4);
  for (const output of outputs.slice(1)) {
    assert.equal(output.status, 'feasible');
    assert.equal(output.optimality, 'retained_plan_not_reoptimized');
    assert.equal(output.solverStatus, null);
    assert.equal(output.tieBreakStatus, 'not_reoptimized');
    assert.equal(output.plannerMetadata.cacheAudit.valid, true);
  }
});

test('a capacity observation that does not invalidate dates is retained without another solve', async () => {
  let calls = 0;
  const stable = createStablePlanner({solver:scenario => { calls++; return planned(scenario); }});
  const result = await runRollingScenario(tiny(), [{revealDay:2, resource:'truck', capacity:0}], {planner:stable});
  assert.equal(result.complete, true);
  assert.equal(result.revisionCount, 0);
  assert.equal(calls, 1);
  assert.equal(result.timeline[2].observedEvents[0].capacity, 0);
});

test('capacity restoration can make a cheaper plan available, but retention makes no current-optimal claim', async () => {
  let calls = 0;
  const nominal = tiny({truckCapacity:[2, 0, 2, 2, 2, 2]});
  const stable = createStablePlanner({solver:scenario => { calls++; return planned(scenario, 2, 2, 3); }});
  await stable(nominal, constraints());
  const observed = structuredClone(nominal); observed.truckCapacity[1] = 2;
  const retained = await stable(observed, constraints(1));
  const cheaper = planned(observed, 1, 1, 2);
  assert.equal(auditSchedule(observed, cheaper.rows).valid, true);
  assert.ok(retained.totalCost > cheaper.totalCost);
  assert.equal(retained.rows[0].pickupDay, 2);
  assert.equal(retained.status, 'feasible');
  assert.equal(retained.optimality, 'retained_plan_not_reoptimized');
  assert.equal(calls, 1);
});

test('a newly observed capacity closure invalidates pending dates and triggers an audited replan', async () => {
  const calls = [], stable = createStablePlanner({solver:(scenario, options) => {
    calls.push({scenario:structuredClone(scenario), options:structuredClone(options)});
    return calls.length===1 ? planned(scenario, 2, 2, 4) : planned(scenario, 3, 3, 4);
  }});
  const nominal = tiny();
  await stable(nominal, constraints());
  const observed = {...nominal, truckCapacity:[2, 2, 0, 2, 2, 2]};
  const result = await stable(observed, constraints(2));
  assert.equal(result.status, 'optimal');
  assert.equal(result.rows[0].pickupDay, 3);
  assert.equal(result.plannerMetadata.solverCalls, 2);
  assert.equal(result.plannerMetadata.replannedDueToInvalid, 1);
  assert.equal(result.plannerMetadata.candidateSource, 'solver_replan');
  assert.equal(result.plannerMetadata.cacheAudit.valid, false);
  assert.match(result.plannerMetadata.cacheInvalidationReasons.join('; '), /Day 2: truck capacity exceeded/);
  assert.deepEqual(calls[1].scenario, observed);
  assert.deepEqual(calls[1].options, constraints(2));
});

test('changed execution locks invalidate cached dates and are passed intact to the next solver', async () => {
  const calls = [], stable = createStablePlanner({solver:(scenario, options) => {
    calls.push(structuredClone(options));
    return planned(scenario, options.fixedEvents.T0?.pickupDay ?? 0, 2, 3);
  }});
  await stable(tiny(), constraints());
  const options = constraints(1, {T0:{pickupDay:1}});
  const result = await stable(tiny(), options);
  assert.equal(result.rows[0].pickupDay, 1);
  assert.equal(result.plannerMetadata.candidateSource, 'solver_replan');
  assert.match(result.plannerMetadata.cacheInvalidationReasons.join('; '), /frozen pickupDay changed/);
  assert.deepEqual(calls[1], options);
});

test('missing history cannot turn a cached past event into an executed event', async () => {
  let calls = 0;
  const stable = createStablePlanner({solver:(scenario, options) => { calls++; return planned(scenario, options.minEventDay, 2, 3); }});
  await stable(tiny(), constraints());
  const result = await stable(tiny(), constraints(1));
  assert.equal(calls, 2);
  assert.equal(result.rows[0].pickupDay, 1);
  assert.match(result.plannerMetadata.cacheInvalidationReasons.join('; '), /unexecuted pickupDay must be at least day 1/);
});

test('all costs are reconstructed from dates on initial and retained plans', async () => {
  let calls = 0;
  const stable = createStablePlanner({solver:scenario => {
    calls++;
    const result = planned(scenario);
    for (const key of ['totalCost', 'storageCost', 'ddCost', 'sunkCost', 'incrementalCost', 'objectiveCost']) result[key] = -1;
    for (const key of ['totalCost', 'storageCost', 'ddCost', 'sunkCost', 'incrementalCost']) result.rows[0][key] = -1;
    return result;
  }});
  const nominal = tiny(), first = await stable(nominal, constraints());
  const expected = rowFor(nominal, nominal.containers[0], 1, 1, 3);
  assert.equal(first.totalCost, expected.totalCost);
  assert.equal(first.rows[0].storageCost, expected.storageCost);
  const repriced = {...nominal, tariff:{pncMultiplier:2, ddMultiplier:0.5}};
  const retained = await stable(repriced, constraints(1));
  const newExpected = rowFor(repriced, repriced.containers[0], 1, 1, 3);
  assert.equal(retained.totalCost, newExpected.totalCost);
  assert.equal(retained.rows[0].incrementalCost, newExpected.incrementalCost);
  assert.notEqual(retained.totalCost, first.totalCost);
  assert.equal(calls, 1);
});

test('caller mutation of a previous result cannot alter cached dates or counters', async () => {
  const stable = createStablePlanner({solver:scenario => planned(scenario)});
  const first = await stable(tiny(), constraints());
  first.rows[0].pickupDay = 5;
  first.rows[0].unloadDay = 5;
  first.rows[0].returnDay = 5;
  first.totalCost = 0;
  first.plannerMetadata.solverCalls = 999;
  const retained = await stable(tiny(), constraints(1));
  assert.equal(retained.rows[0].pickupDay, 1);
  assert.equal(retained.rows[0].returnDay, 3);
  assert.equal(retained.plannerMetadata.solverCalls, 1);
  assert.ok(retained.totalCost > 0);
});

test('a solver cannot mutate input capacity or execution locks to pass the original audit', async () => {
  const nominal = tiny({truckCapacity:[2, 2, 0, 2, 2, 2]}), before = structuredClone(nominal);
  const options = constraints(1, {T0:{pickupDay:0}}), optionsBefore = structuredClone(options);
  const stable = createStablePlanner({solver:(scenario, locks) => {
    scenario.truckCapacity[2] = 100;
    delete locks.fixedEvents.T0;
    return planned(scenario, 2, 2, 4);
  }});
  const rejected = await stable(nominal, options);
  assert.equal(rejected.status, 'candidate_rejected');
  assert.equal(rejected.candidateAudit.scheduleAudit.valid, false);
  assert.equal(rejected.candidateAudit.freezeAudit.valid, false);
  assert.equal(rejected.totalCost, null);
  assert.deepEqual(nominal, before);
  assert.deepEqual(options, optionsBefore);
});

test('failed replanning never reports or reuses an invalid cached complete plan', async () => {
  let calls = 0;
  const stable = createStablePlanner({solver:scenario => ++calls===1 ? planned(scenario, 2, 2, 4) : {status:'time_limit', rows:[], totalCost:0, reason:'No incumbent.'}});
  await stable(tiny(), constraints());
  const observed = tiny({truckCapacity:[2, 2, 0, 2, 2, 2]});
  for (let attempt=0; attempt<2; attempt++) {
    const failed = await stable(observed, constraints(2));
    assert.equal(failed.status, 'time_limit');
    assert.equal(failed.plannerMetadata.accepted, false);
    assert.equal(failed.plannerMetadata.reusedPlans, 0);
    assert.equal(failed.plannerMetadata.replannedDueToInvalid, attempt+1);
    assert.deepEqual(failed.rows, []);
    for (const key of ['totalCost', 'incrementalCost', 'storageCost', 'ddCost', 'sunkCost', 'objectiveCost', 'lateCount']) assert.equal(failed[key], null);
  }
  assert.equal(calls, 3);
});

test('started unloading stays locked and a closure below its ongoing occupancy returns failure', async () => {
  const nominal = tiny({containers:[{...tiny().containers[0], unloadDays:3}]}), calls = [];
  const stable = createStablePlanner({solver:async (scenario, options) => {
    calls.push(structuredClone(options));
    return calls.length===1 ? planned(scenario, 0, 0, 3) : solveOptimized(scenario, options);
  }});
  await stable(nominal, constraints());
  const observed = {...nominal, warehouseCapacity:[1, 0, 1, 1, 1, 1]};
  const failed = await stable(observed, constraints(1, {T0:{pickupDay:0, unloadDay:0}}));
  assert.equal(failed.status, 'infeasible');
  assert.equal(failed.totalCost, null);
  assert.equal(failed.plannerMetadata.replannedDueToInvalid, 1);
  assert.deepEqual(calls[1].fixedEvents, {T0:{pickupDay:0, unloadDay:0}});
});

test('unrevealed future shock changes do not change early stable inputs or decisions', async () => {
  const nominal = tiny(), callsA = [], callsB = [];
  const build = calls => createStablePlanner({solver:(scenario, options) => {
    calls.push({scenario:structuredClone(scenario), options:structuredClone(options)});
    return planned(scenario, 1, 1, 4);
  }});
  const a = await runRollingScenario(nominal, [{id:'future-A', revealDay:3, resource:'truck', capacity:0}], {planner:build(callsA)});
  const b = await runRollingScenario(nominal, [{id:'future-B', revealDay:3, resource:'warehouse', capacity:0, duration:2}], {planner:build(callsB)});
  assert.deepEqual(callsA, callsB);
  assert.equal(callsA.length, 1);
  assert.deepEqual(a.timeline.slice(0, 3), b.timeline.slice(0, 3));
  assert.equal(JSON.stringify(callsA).includes('future-'), false);
  assert.equal(a.complete, true);
  assert.equal(b.complete, true);
});

test('partial, duplicate, unknown and unsafe solver rows never populate the cache', async () => {
  const nominal = tiny();
  for (const badRows of [
    [], [null], [rowFor(nominal, nominal.containers[0], 1, 1, 3), rowFor(nominal, nominal.containers[0], 1, 1, 3)],
    [{...rowFor(nominal, nominal.containers[0], 1, 1, 3), id:'unknown'}],
    [{...rowFor(nominal, nominal.containers[0], 1, 1, 3), unloadDay:-Infinity, unloadEndDay:-Infinity}],
    [{...rowFor(nominal, nominal.containers[0], 1, 1, 3), returnDay:10**10}],
  ]) {
    let calls = 0;
    const stable = createStablePlanner({solver:() => { calls++; return {status:'feasible', rows:badRows}; }});
    const first = await stable(nominal, constraints()), second = await stable(nominal, constraints());
    assert.equal(first.status, 'candidate_rejected');
    assert.equal(second.plannerMetadata.candidateSource, 'solver_initial');
    assert.equal(second.plannerMetadata.reusedPlans, 0);
    assert.equal(calls, 2);
  }
});

test('solver date getters are snapshotted once before auditing and caching', async () => {
  let reads = 0;
  const stable = createStablePlanner({solver:scenario => {
    const result = planned(scenario);
    Object.defineProperty(result.rows[0], 'pickupDay', {enumerable:true, get:() => ++reads===1 ? 1 : 5});
    return result;
  }});
  const first = await stable(tiny(), constraints()), retained = await stable(tiny(), constraints(1));
  assert.equal(first.rows[0].pickupDay, 1);
  assert.equal(retained.rows[0].pickupDay, 1);
  assert.equal(reads, 1);
});

test('invalid execution options and sparse capacity snapshots reject before a solver call', async () => {
  let calls = 0;
  const stable = createStablePlanner({solver:scenario => { calls++; return planned(scenario); }});
  for (const patch of [
    {minEventDay:NaN}, {minEventDay:'1'}, {minEventDay:-1}, {minEventDay:7},
    {fixedEvents:[]}, {fixedEvents:{unknown:{pickupDay:0}}}, {fixedEvents:{T0:{unexpected:0}}}, {fixedEvents:{T0:{pickupDay:Infinity}}},
    {objectiveMode:'bogus'}, {timeLimitSeconds:0},
  ]) await assert.rejects(stable(tiny(), {...constraints(), ...patch}));
  await assert.rejects(stable(tiny({truckCapacity:new Array(6)}), constraints()));
  assert.equal(calls, 0);
  assert.throws(() => createStablePlanner({solver:1}));
  assert.throws(() => createStablePlanner({timeLimitSeconds:-1}));
});

test('solver exceptions become failure results with solver-call metadata', async () => {
  const stable = createStablePlanner({solver:() => { throw null; }});
  const failed = await stable(tiny(), constraints());
  assert.equal(failed.status, 'planner_error');
  assert.equal(failed.reason, 'null');
  assert.equal(failed.totalCost, null);
  assert.equal(failed.plannerMetadata.solverCalls, 1);
  assert.equal(failed.plannerMetadata.candidateSource, 'solver_initial');
});

test('new known-order episodes and a backwards clock cannot accidentally retain a prior episode', async () => {
  let calls = 0;
  const stable = createStablePlanner({solver:scenario => { calls++; return planned(scenario); }});
  await stable(tiny(), constraints());
  await stable(tiny(), constraints(1));
  const replay = await stable(tiny(), constraints());
  assert.equal(replay.plannerMetadata.candidateSource, 'solver_replan');
  assert.match(replay.plannerMetadata.cacheInvalidationReasons.join('; '), /moved backwards/);
  const newEpisode = await stable(tiny({id:'another-episode'}), constraints());
  assert.equal(newEpisode.plannerMetadata.candidateSource, 'solver_replan');
  assert.match(newEpisode.plannerMetadata.cacheInvalidationReasons.join('; '), /different known-order episode/);
  assert.equal(calls, 3);
});

test('factory defaults and per-call injected solvers preserve the caller execution constraints', async () => {
  let received;
  const stable = createStablePlanner({timeLimitSeconds:0.15, presolveV4:true, solver:() => { throw new Error('Wrong solver.'); }});
  const output = await stable(tiny(), {minEventDay:1, fixedEvents:{}, solver:(scenario, options) => {
    received = structuredClone(options); return planned(scenario);
  }});
  assert.equal(output.status, 'optimal');
  assert.deepEqual(received, {presolveV4:true, minEventDay:1, fixedEvents:{}, timeLimitSeconds:0.15, objectiveMode:'joint'});
});

test('default GLPK integration retains a complete audited plan on the next execution day', async () => {
  const stable = createStablePlanner({timeLimitSeconds:0.2});
  const first = await stable(tiny(), constraints());
  assert.ok(['optimal', 'feasible'].includes(first.status));
  const fixed = {};
  for (const key of ['pickupDay', 'unloadDay', 'returnDay']) if (first.rows[0][key]===0) (fixed.T0 ??= {})[key] = 0;
  const retained = await stable(tiny(), constraints(1, fixed));
  assert.equal(retained.status, 'feasible');
  assert.equal(retained.optimality, 'retained_plan_not_reoptimized');
  assert.equal(retained.plannerMetadata.solverCalls, 1);
  assert.equal(auditSchedule(tiny(), retained.rows).valid, true);
});
