import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditSchedule, rowFor, summarize} from '../src/engine.js';
import {auditFrozenEvents, runRollingScenario} from '../src/rolling-plan.js';
import {createRecoveryPlanner, solveLockedConstructor} from '../src/recovery-planner-v6.js';

const tiny = (extra={}) => ({
  id:'v6-handwritten-fixture', horizonStart:'2026-10-13', horizonDays:6,
  truckCapacity:2, warehouseCapacity:1, stagingCapacity:1,
  containers:[{id:'A', sizeFt:20, dischargeDateTime:'2026-09-29T07:00:00+09:00', releaseDay:0, unloadDays:1, dueDay:4, dataOrigin:'synthetic'}],
  ...extra,
});
const options = (minEventDay=0, fixedEvents={}) => ({minEventDay, fixedEvents, objectiveMode:'joint', timeLimitSeconds:0.2});
const planned = (s, p=1, u=1, r=3, extra={}) => ({...summarize(s, 'fixture', [rowFor(s, s.containers[0], p, u, r)], 0, 'feasible', {optimality:'fixture_not_a_proof'}), ...extra});
const timeout = () => ({status:'time_limit', rows:[], reason:'Fixture has no MILP incumbent.'});

test('locked constructor preserves completed and started events and charges their full resource tails', () => {
  const base=tiny().containers[0], s=tiny({truckCapacity:3, warehouseCapacity:2, stagingCapacity:3, operations:{stagingUnit:'teu'}, containers:[
    {...base, id:'A', sizeFt:40, unloadDays:3}, {...base, id:'B'}, {...base, id:'C'},
  ]});
  const fixed={A:{pickupDay:0, unloadDay:0}, C:{pickupDay:0, unloadDay:0, returnDay:1}};
  const result=solveLockedConstructor(s, {...options(2, fixed), timeBudgetMs:80});
  assert.equal(result.status, 'feasible');
  assert.equal(result.optimality, 'locked_constructor_heuristic');
  assert.equal(auditSchedule(s, result.rows).valid, true);
  assert.equal(auditFrozenEvents(result.rows, fixed, 2).valid, true);
  const byId=new Map(result.rows.map(row => [row.id, row]));
  assert.equal(byId.get('A').pickupDay, 0);
  assert.equal(byId.get('A').unloadDay, 0);
  assert.ok(byId.get('A').returnDay>=3);
  assert.deepEqual(['pickupDay', 'unloadDay', 'returnDay'].map(key => byId.get('C')[key]), [0, 0, 1]);
  assert.ok(['pickupDay', 'unloadDay', 'returnDay'].every(key => byId.get('B')[key]>=2));
  assert.equal(result.usage[1].staging, 2);
  assert.ok(result.usage[2].warehouse>=1);
  assert.equal(result.constructorMetadata.completeAuditedCandidates>0, true);
});

test('a locked unloading interval cannot disappear or restart under a current closure', () => {
  const s=tiny({warehouseCapacity:[1, 0, 1, 1, 1, 1], containers:[{...tiny().containers[0], unloadDays:3}]});
  const result=solveLockedConstructor(s, {...options(1, {A:{pickupDay:0, unloadDay:0}}), timeBudgetMs:80});
  assert.equal(result.status, 'no_feasible_schedule_found');
  assert.equal(result.totalCost, null);
  assert.deepEqual(result.rows, []);
  assert.match(result.reason, /not an infeasibility proof/);
});

test('a fixed pickup continues staging until a physically allowed return', () => {
  const s=tiny({stagingCapacity:[1, 1, 0, 1, 1, 1], containers:[{...tiny().containers[0], unloadDays:3}]});
  const result=solveLockedConstructor(s, {...options(2, {A:{pickupDay:0, unloadDay:0}}), timeBudgetMs:80});
  assert.equal(result.status, 'no_feasible_schedule_found');
  assert.equal(result.totalCost, null);
});

test('same-day operations use two trucks and zero staging even with absolute historical locks', () => {
  const s=tiny({operations:{returnLagDays:0}, stagingCapacity:0});
  const fresh=solveLockedConstructor(s, {...options(2), timeBudgetMs:80});
  assert.equal(fresh.status, 'feasible');
  assert.equal(fresh.rows[0].pickupDay, 2);
  assert.equal(fresh.rows[0].returnDay, 2);
  assert.equal(fresh.usage[2].truck, 2);
  assert.equal(fresh.usage[2].staging, 0);
  const historical=solveLockedConstructor(s, {...options(2, {A:{pickupDay:0, unloadDay:0, returnDay:0}}), timeBudgetMs:80});
  assert.equal(historical.status, 'feasible');
  assert.equal(historical.rows[0].pickupDay, 0);
  const impossible=solveLockedConstructor({...s, truckCapacity:1}, {...options(2), timeBudgetMs:80});
  assert.equal(impossible.rows.length, 0);
});

test('every constructor result satisfies independently enumerated tiny locked feasibility', () => {
  // Enumerate dates separately; the test does not assume the heuristic optimal.
  function oracle(s, o) {
    const c=s.containers[0], fixed=o.fixedEvents.A ?? {}, cap=(value, d)=>Array.isArray(value)?value[d]:value;
    for (let p=c.releaseDay; p<s.horizonDays; p++) for (let u=p; u+c.unloadDays-1<=c.dueDay; u++) for (let r=u+c.unloadDays; r<s.horizonDays; r++) {
      const dates={pickupDay:p, unloadDay:u, returnDay:r};
      if (Object.entries(dates).some(([key, d]) => Object.hasOwn(fixed, key)?fixed[key]!==d:d<o.minEventDay)) continue;
      let feasible=true;
      for (let d=0; d<s.horizonDays; d++) if ((p===d)+(r===d)>cap(s.truckCapacity, d) || Number(u<=d && d<u+c.unloadDays)>cap(s.warehouseCapacity, d) || Number(p<=d && d<r)>cap(s.stagingCapacity, d)) feasible=false;
      if (feasible) return true;
    }
    return false;
  }
  const cases=[
    [tiny(), options(2)],
    [tiny(), options(2, {A:{pickupDay:0}})],
    [tiny({truckCapacity:[2, 2, 0, 2, 2, 2]}), options(2)],
    [tiny({warehouseCapacity:0}), options(1)],
    [tiny({containers:[{...tiny().containers[0], unloadDays:3}]}), options(2, {A:{pickupDay:0, unloadDay:0}})],
  ];
  for (const [s, o] of cases) {
    const expected=oracle(s, o), result=solveLockedConstructor(s, {...o, timeBudgetMs:80});
    assert.equal(result.rows.length>0, expected);
    if (expected) { assert.equal(auditSchedule(s, result.rows).valid, true); assert.equal(auditFrozenEvents(result.rows, o.fixedEvents, o.minEventDay).valid, true); }
  }
});

test('bounded rollback repairs a greedy conflict without removing an already-started unloading tail', () => {
  const base=tiny().containers[0], s=tiny({horizonDays:5, containers:[
    {...base, id:'A', unloadDays:3, dischargeDateTime:'2026-10-01T07:00:00+09:00'},
    {...base, id:'B', dischargeDateTime:'2026-09-10T07:00:00+09:00'},
  ]});
  const fixed={A:{pickupDay:0, unloadDay:0}};
  // The high-fee ordering tries B on day 2 before accounting for A's ongoing
  // warehouse/staging occupancy. Rollback must restore A and move B to day 3.
  const result=solveLockedConstructor(s, {...options(2, fixed), timeBudgetMs:80, maxRestarts:3});
  assert.equal(result.status, 'feasible');
  assert.ok(result.constructorMetadata.repairAttempts>=1);
  assert.ok(result.constructorMetadata.repairChecks>=1);
  assert.equal(auditSchedule(s, result.rows).valid, true);
  assert.equal(auditFrozenEvents(result.rows, fixed, 2).valid, true);
  assert.deepEqual(result.rows.map(row => [row.id, row.pickupDay, row.unloadDay, row.returnDay]), [['A', 0, 0, 3], ['B', 3, 3, 4]]);
  assert.equal(result.usage[2].warehouse, 1);
  assert.equal(result.usage[2].staging, 1);
});

test('constructor incumbent remains usable when the shared-budget MILP has no incumbent', async () => {
  const planner=createRecoveryPlanner({solver:timeout});
  const result=await planner(tiny(), options());
  assert.equal(result.status, 'feasible');
  assert.equal(result.optimality, 'locked_constructor_heuristic');
  assert.equal(result.plannerMetadata.candidateSource, 'locked_constructor');
  assert.equal(result.plannerMetadata.solverCalls, 1);
  assert.equal(result.plannerMetadata.constructorCalls, 1);
  assert.equal(result.plannerMetadata.stages.locked_milp.status, 'time_limit');
  assert.equal(auditSchedule(tiny(), result.rows).valid, true);
});

test('construction and MILP share one total deadline rather than independent 200ms allowances', async () => {
  let clock=100, observed;
  const planner=createRecoveryPlanner({now:()=>clock, constructor:(s, o) => {
    assert.equal(o.deadlineMs, 180);
    clock+=60;
    return planned(s);
  }, solver:(s, o, context) => {
    observed={options:structuredClone(o), deadline:context.deadlineMs};
    clock+=20;
    return timeout();
  }});
  const result=await planner(tiny(), options());
  assert.equal(observed.deadline, 300);
  assert.equal(observed.options.timeLimitSeconds, 0.135);
  assert.deepEqual(observed.options.fixedEvents, {});
  assert.equal(result.plannerMetadata.wallTimeMs, 80);
  assert.equal(result.plannerMetadata.deadlineOverrunMs, 0);
});

test('a MILP candidate finishing after the shared deadline is discarded and overrun is disclosed', async () => {
  let clock=0;
  const planner=createRecoveryPlanner({now:()=>clock, constructor:s => { clock=20; return planned(s); }, solver:s => {
    clock=205; return planned(s, 0, 0, 1, {status:'optimal', optimality:'proven_optimal'});
  }});
  const result=await planner(tiny(), options());
  assert.equal(result.rows[0].pickupDay, 1);
  assert.equal(result.status, 'feasible');
  assert.equal(result.plannerMetadata.candidateSource, 'locked_constructor');
  assert.equal(result.plannerMetadata.stages.locked_milp.lateCandidateDiscarded, true);
  assert.equal(result.plannerMetadata.deadlineOverrunMs, 5);
});

test('a late constructor cannot create a valid result when nothing was accepted within budget', async () => {
  let clock=0, solverCalls=0;
  const planner=createRecoveryPlanner({now:()=>clock, constructor:s => { clock=210; return planned(s); }, solver:() => { solverCalls++; return timeout(); }});
  const result=await planner(tiny(), options());
  assert.equal(result.status, 'no_feasible_schedule_found');
  assert.equal(result.totalCost, null);
  assert.equal(result.plannerMetadata.stages.locked_constructor.lateCandidateDiscarded, true);
  assert.equal(solverCalls, 0);
});

test('candidate aggregation that crosses the deadline is rejected even after a successful date audit', async () => {
  const ticks=[0, 0, 0, 0, 195, 195, 195, 205];
  const planner=createRecoveryPlanner({now:()=>ticks.length?ticks.shift():205, constructor:s => planned(s), solver:timeout});
  const result=await planner(tiny(), options());
  assert.equal(result.status, 'no_feasible_schedule_found');
  assert.equal(result.totalCost, null);
  assert.equal(result.plannerMetadata.stages.locked_constructor.audit.valid, true);
  assert.equal(result.plannerMetadata.stages.locked_constructor.lateCandidateDiscarded, true);
  assert.equal(result.plannerMetadata.deadlineOverrunMs, 5);
});

test('snapshot copying consumes the same call budget and cannot reset the deadline after validation', async () => {
  let clock=0, calls=0;
  const s=tiny(), containers=s.containers;
  Object.defineProperty(s, 'containers', {enumerable:true, get:() => { clock=210; return containers; }});
  const planner=createRecoveryPlanner({now:()=>clock, constructor:() => { calls++; return timeout(); }, solver:() => { calls++; return timeout(); }});
  const result=await planner(s, options());
  assert.equal(result.totalCost, null);
  assert.equal(calls, 0);
  assert.equal(result.plannerMetadata.stages.locked_constructor.status, 'budget_skipped');
  assert.equal(result.plannerMetadata.stages.locked_milp.status, 'budget_skipped');
  assert.equal(result.plannerMetadata.deadlineOverrunMs, 10);
});

test('a valid cached plan is repriced and retained without another constructor or solver call', async () => {
  let constructorCalls=0, solverCalls=0;
  const planner=createRecoveryPlanner({constructor:s => { constructorCalls++; return planned(s); }, solver:() => { solverCalls++; return timeout(); }});
  const first=await planner(tiny(), options());
  const repriced=tiny({tariff:{pncMultiplier:2}});
  const retained=await planner(repriced, options(1));
  assert.equal(constructorCalls, 1);
  assert.equal(solverCalls, 1);
  assert.equal(retained.status, 'feasible');
  assert.equal(retained.optimality, 'retained_plan_not_reoptimized');
  assert.equal(retained.plannerMetadata.candidateSource, 'retained_plan');
  assert.equal(retained.plannerMetadata.reusedPlans, 1);
  assert.equal(retained.totalCost, rowFor(repriced, repriced.containers[0], 1, 1, 3).totalCost);
  assert.notEqual(first.totalCost, retained.totalCost);
});

test('daily-search ablation keeps the audited cache as fallback while using the same deadline', async () => {
  let calls=0;
  const planner=createRecoveryPlanner({retainFeasible:false, constructor:s => ++calls===1?planned(s):{status:'no_feasible_schedule_found', rows:[]}, solver:timeout});
  await planner(tiny(), options());
  const result=await planner(tiny(), options(1));
  assert.equal(result.status, 'feasible');
  assert.equal(result.plannerMetadata.candidateSource, 'cached_incumbent');
  assert.equal(result.optimality, 'retained_plan_not_reoptimized');
  assert.equal(result.plannerMetadata.constructorCalls, 2);
  assert.equal(result.plannerMetadata.solverCalls, 2);
  assert.equal(result.plannerMetadata.reusedPlans, 0);
});

test('frozen-event mismatch triggers recovery and neither callback can remove the original locks', async () => {
  let calls=0;
  const malicious=(s, o) => { delete o.fixedEvents.A; return planned(s, 1, 2, 3); };
  const planner=createRecoveryPlanner({constructor:(s, o) => ++calls===1?planned(s, 0, 2, 3):malicious(s, o), solver:timeout});
  await planner(tiny(), options());
  const original=options(1, {A:{pickupDay:2}}), before=structuredClone(original);
  const result=await planner(tiny(), original);
  assert.equal(result.status, 'no_feasible_schedule_found');
  assert.equal(result.totalCost, null);
  assert.equal(result.plannerMetadata.replannedDueToInvalid, 1);
  assert.equal(result.plannerMetadata.stages.locked_constructor.audit.valid, false);
  assert.match(result.plannerMetadata.stages.locked_constructor.audit.errors.join('; '), /frozen pickupDay changed/);
  assert.deepEqual(original, before);
});

test('callbacks cannot raise real capacity and counterfeit prices never survive date reconstruction', async () => {
  const bad=tiny({truckCapacity:[2, 0, 2, 2, 2, 2]}), before=structuredClone(bad);
  const planner=createRecoveryPlanner({constructor:(s, o) => { s.truckCapacity[1]=100; return planned(s); }, solver:timeout});
  const rejected=await planner(bad, options(1));
  assert.equal(rejected.totalCost, null);
  assert.equal(rejected.plannerMetadata.stages.locked_constructor.audit.valid, false);
  assert.deepEqual(bad, before);
  const safe=createRecoveryPlanner({constructor:s => {
    const result=planned(s); result.totalCost=-1; result.rows[0].totalCost=-1; return result;
  }, solver:timeout});
  const accepted=await safe(tiny(), options());
  accepted.rows[0].pickupDay=5;
  const retained=await safe(tiny(), options(1));
  assert.equal(retained.rows[0].pickupDay, 1);
  assert.equal(retained.totalCost, rowFor(tiny(), tiny().containers[0], 1, 1, 3).totalCost);
});

test('the best complete audited candidate is selected, and a MILP tie can preserve its current-model proof', async () => {
  const improved=createRecoveryPlanner({constructor:s => planned(s), solver:s => planned(s, 0, 0, 1, {status:'optimal', optimality:'proven_optimal'})});
  const a=await improved(tiny(), options());
  assert.equal(a.plannerMetadata.candidateSource, 'locked_milp');
  assert.equal(a.status, 'optimal');
  assert.equal(a.rows[0].pickupDay, 0);
  const tied=createRecoveryPlanner({constructor:s => planned(s), solver:s => planned(s, 1, 1, 3, {status:'optimal', optimality:'proven_optimal'})});
  const b=await tied(tiny(), options());
  assert.equal(b.plannerMetadata.candidateSource, 'locked_milp');
  assert.equal(b.status, 'optimal');
});

test('a contradictory solver infeasibility report does not erase an audited constructor incumbent', async () => {
  const planner=createRecoveryPlanner({constructor:s => planned(s), solver:() => ({status:'infeasible', optimality:'proven_infeasible', rows:[]})});
  const result=await planner(tiny(), options());
  assert.equal(result.status, 'feasible');
  assert.equal(result.plannerMetadata.stages.locked_milp.infeasibilityContradictsAuditedIncumbent, true);
});

test('physical infeasibility from ongoing occupancy returns null costs rather than a false recovery', async () => {
  const nominal=tiny({containers:[{...tiny().containers[0], unloadDays:3}]});
  const planner=createRecoveryPlanner();
  const result=await planner({...nominal, warehouseCapacity:[1, 0, 1, 1, 1, 1]}, options(1, {A:{pickupDay:0, unloadDay:0}}));
  assert.equal(result.status, 'infeasible');
  assert.equal(result.optimality, 'solver_reported_infeasible');
  assert.equal(result.totalCost, null);
  assert.deepEqual(result.rows, []);
});

test('unknown future shocks do not enter constructor/solver inputs or change the shared early prefix', async () => {
  function build(log) {
    return createRecoveryPlanner({now:()=>0, constructor:(s, o) => {
      const {now, ...data}=o; log.push({scenario:structuredClone(s), options:structuredClone(data)}); return planned(s, 1, 1, 4);
    }, solver:timeout});
  }
  const aCalls=[], bCalls=[];
  const a=await runRollingScenario(tiny(), [{id:'future-a', revealDay:3, resource:'truck', capacity:0}], {planner:build(aCalls)});
  const b=await runRollingScenario(tiny(), [{id:'future-b', revealDay:3, resource:'warehouse', capacity:0, duration:2}], {planner:build(bCalls)});
  assert.deepEqual(aCalls, bCalls);
  assert.equal(aCalls.length, 1);
  assert.deepEqual(a.timeline.slice(0, 3), b.timeline.slice(0, 3));
  assert.equal(JSON.stringify(aCalls).includes('future-'), false);
  assert.equal(a.complete, true);
  assert.equal(b.complete, true);
});

test('bad candidate dates and duplicate orders reject before usage loops without becoming partial successes', async () => {
  for (const rows of [[null], [], [{id:'A', pickupDay:0, unloadDay:-Infinity, returnDay:2}], [{id:'A', pickupDay:0, unloadDay:0, returnDay:10**10}], [{id:'unknown', pickupDay:0, unloadDay:0, returnDay:2}]]) {
    const planner=createRecoveryPlanner({constructor:() => ({status:'feasible', rows}), solver:timeout});
    const result=await planner(tiny(), options());
    assert.equal(result.totalCost, null);
    assert.deepEqual(result.rows, []);
    assert.equal(result.plannerMetadata.stages.locked_constructor.audit.valid, false);
  }
});

test('constructor and solver errors are recorded independently and cannot manufacture successful fees', async () => {
  const planner=createRecoveryPlanner({constructor:() => { throw null; }, solver:() => { throw new Error('Unavailable fixture solver.'); }});
  const result=await planner(tiny(), options());
  assert.equal(result.totalCost, null);
  assert.equal(result.plannerMetadata.stages.locked_constructor.status, 'constructor_error');
  assert.equal(result.plannerMetadata.stages.locked_constructor.reason, 'null');
  assert.equal(result.plannerMetadata.stages.locked_milp.status, 'solver_error');
});

test('invalid locks, sparse capacities and budget configuration reject before recovery begins', async () => {
  let calls=0;
  const planner=createRecoveryPlanner({constructor:() => { calls++; return timeout(); }, solver:timeout});
  for (const o of [{...options(), minEventDay:NaN}, {...options(), fixedEvents:{A:{notAnEvent:0}}}, {...options(), timeLimitSeconds:0}, {...options(), timeBudgetMs:-1}]) await assert.rejects(planner(tiny(), o));
  await assert.rejects(planner(tiny({stagingCapacity:new Array(6)}), options()));
  assert.equal(calls, 0);
  for (const configuration of [{timeBudgetMs:0}, {constructorShare:2}, {maxRestarts:-1}, {auditReserveMs:NaN}]) assert.throws(() => createRecoveryPlanner(configuration));
});

test('installed GLPK binding has integer millisecond granularity, not a one-second floor', async () => {
  const js=await readFile(new URL('../node_modules/glpk.js/src/glpk.js', import.meta.url), 'utf8');
  const c=await readFile(new URL('../node_modules/glpk.js/src/glpk.js.c', import.meta.url), 'utf8');
  assert.match(js, /opt_\.tmlim\s*\*\s*1000/);
  assert.match(c, /solve_mip\([^)]*int tm_lim/);
  assert.match(c, /parm\.tm_lim\s*=\s*tm_lim/);
});

test('default GLPK shares the remaining fractional-second limit and emits a complete audited candidate', async () => {
  const planner=createRecoveryPlanner({timeBudgetMs:200});
  const result=await planner(tiny(), options());
  assert.ok(['feasible', 'optimal'].includes(result.status));
  assert.equal(auditSchedule(tiny(), result.rows).valid, true);
  assert.equal(auditFrozenEvents(result.rows, {}, 0).valid, true);
  const limits=result.plannerMetadata.stages.locked_milp.nativeBudgetMetadata.nativeLimitsMs;
  assert.ok(limits.length>=1);
  assert.ok(limits.every(limit => Number.isInteger(limit) && limit>0 && limit<=200));
  assert.equal(result.plannerMetadata.timeBudgetMs, 200);
});
