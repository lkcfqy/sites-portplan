import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Independent handwritten PSPLIB-style instance. Jobs 2 and 3 each require
// R1 for two ticks, so they cannot overlap. Job 4 follows both for one tick;
// dummy jobs 1 and 5 have zero duration. No producer module or solver is used.
const SM = `************************************************************************
projects                      :  1
jobs (incl. supersource/sink ) :  5
horizon                       :  10
RESOURCES
  - renewable                 :  4   R
  - nonrenewable              :  0   N
  - doubly constrained        :  0   D
************************************************************************
PROJECT INFORMATION:
pronr.  #jobs rel.date duedate tardcost  MPM-Time
    1      3        0      10        0         3
************************************************************************
PRECEDENCE RELATIONS:
jobnr. #modes #successors successors
    1      1           2     2     3
    2      1           1     4
    3      1           1     4
    4      1           1     5
    5      1           0
************************************************************************
REQUESTS/DURATIONS:
jobnr. mode duration  R 1  R 2  R 3  R 4
------------------------------------------------------------------------
    1    1        0    0    0    0    0
    2    1        2    1    1    0    0
    3    1        2    1    0    1    0
    4    1        1    0    0    0    1
    5    1        0    0    0    0    0
************************************************************************
RESOURCEAVAILABILITIES:
  R 1  R 2  R 3  R 4
    1    1    1    1
************************************************************************
`;
const JOB_IDS = [1, 2, 3, 4, 5];
const STARTS = [0, 0, 2, 4, 5];
const REVIEWER = fileURLToPath(new URL('../scripts/review-public-resource-v7.py', import.meta.url));
const PYTHON = `
import importlib.util
import json
import sys

spec = importlib.util.spec_from_file_location("independent_public_resource_review_fixture", sys.argv[1])
reviewer = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = reviewer
spec.loader.exec_module(reviewer)
payload = json.load(sys.stdin)
model = reviewer.parse_sm(payload["sm"], filename="handwritten-review-fixture.sm")
operation = payload["operation"]
if operation == "parse":
    result = model
elif operation == "starts":
    result = reviewer.audit_starts(model, payload["job_ids"], payload["starts"], payload.get("reported_makespan"))
elif operation == "policy":
    result = reviewer.audit_policy(model, payload["job_ids"], payload["record"], payload["reference"],
        budget_ms=100, max_iterations=256, expected_seed=payload.get("expected_seed"))
elif operation == "summary":
    cases = payload["cases"]
    audits = {case["id"]: {method: reviewer.audit_policy(model, payload["job_ids"], record,
        case["referenceOptimalMakespan"], budget_ms=100, max_iterations=256, expected_seed=97001)
        for method, record in case["policies"].items()} for case in cases}
    result = {"audits": audits, "summary": reviewer.summarize_independent(cases, audits)}
else:
    raise ValueError("Unknown fixture operation")
print(json.dumps(result, allow_nan=False))
`;

function check(operation, extra={}) {
  const result = spawnSync('python3', ['-c', PYTHON, REVIEWER], {
    input: JSON.stringify({sm:SM, operation, job_ids:JOB_IDS, ...extra}),
    encoding:'utf8', timeout:10_000, maxBuffer:1024*1024,
  });
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}
function reject(result, code, policy=false) {
  assert.equal(result.valid, false, JSON.stringify(result));
  if (policy) assert.equal(result.eligible, false, JSON.stringify(result));
  assert.ok(result.errors.some(error => String(error).includes(code)), JSON.stringify(result.errors));
}
function record(method='baselineSerialSGS') {
  const audit = () => ({valid:true, errors:[], makespan:5});
  return {
    method, status:'feasible', complete:true, starts:[...STARTS], makespan:5,
    candidate:{starts:[...STARTS], makespan:5, audit:audit()}, audit:audit(),
    priority:[0, 1, 2, 3, 4], iterations:method==='baselineSerialSGS'?0:256,
    acceptedMoves:0, seed:97001, wallTimeMs:1, internalWallTimeMs:0.9,
    budgetMs:100, cooperativeBudget:true, deadlineOverrunMs:0,
    optimality:'not_proven', objective:'makespan in source ticks', fee:'not_applicable',
  };
}
function policy(value=record(), extra={}) {
  return check('policy', {record:value, reference:5, expected_seed:97001, ...extra});
}
function lateRecord() {
  return {
    ...record('iteratedSGS'), wallTimeMs:101, internalWallTimeMs:99,
    deadlineOverrunMs:1, complete:false, status:'no_timely_complete_schedule',
    starts:null, makespan:null,
    audit:{valid:false, errors:['Full in-process call returned after its declared budget; candidate retained separately'], makespan:null},
  };
}

test('independent Python parser preserves source IDs, four resources and project fields', () => {
  const model = check('parse');
  assert.deepEqual(model.job_ids, JOB_IDS);
  assert.deepEqual(model.durations, [0, 2, 2, 1, 0]);
  assert.deepEqual(model.demands, [[0,0,0,0], [1,1,0,0], [1,0,1,0], [0,0,0,1], [0,0,0,0]]);
  assert.deepEqual(model.capacities, [1, 1, 1, 1]);
  assert.deepEqual(model.successors, [[2,3], [4], [4], [5], []]);
  assert.equal(model.horizon, 10);
  assert.deepEqual(model.project, {projectId:1, realJobs:3, projectRelease:0, projectDue:10, tardinessCost:0, mpmTime:3});
});

test('independent resource audit reproduces handwritten peaks, tick totals and makespan', () => {
  const result = check('starts', {starts:STARTS, reported_makespan:5});
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
  assert.equal(result.makespan, 5);
  assert.deepEqual(result.resourcePeaks, [1, 1, 1, 1]);
  assert.deepEqual(result.resourceTickTotals, [4, 2, 2, 1]);
});

test('duplicate source IDs and incomplete coverage cannot pass as complete schedules', () => {
  reject(check('starts', {job_ids:[1,2,2,4,5], starts:STARTS}), 'job_ids');
  reject(check('starts', {job_ids:[1,2,3,4], starts:[0,0,2,4]}), 'coverage');
  reject(check('starts', {job_ids:JOB_IDS, starts:[0,0,2,4]}), 'coverage');
});

test('every precedence edge is audited including the zero-duration final job', () => {
  // Job 4 starts before job 3 ends, despite all renewable capacities fitting.
  reject(check('starts', {starts:[0,0,2,3,4]}), 'precedence');
  // Dummy sink 5 must follow the end of job 4 even though the sink is free.
  reject(check('starts', {starts:[0,0,2,4,4]}), 'precedence');
});

test('renewable overlap is rejected independently of valid precedence', () => {
  // Both parallel jobs start at zero, satisfying the DAG but consuming 2 R1.
  reject(check('starts', {starts:[0,0,0,2,3]}), 'resource');
});

test('reported makespan is recomputed rather than trusted', () => {
  reject(check('starts', {starts:STARTS, reported_makespan:4}), 'makespan');
  reject(check('starts', {starts:STARTS, reported_makespan:6}), 'makespan');
});

test('baseline and bounded iterated records are eligible only after independent audits', () => {
  for (const method of ['baselineSerialSGS', 'iteratedSGS']) {
    const result = policy(record(method));
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.equal(result.eligible, true);
    assert.equal(result.schedule.valid, true);
    assert.equal(result.candidateAudit.valid, true);
    assert.equal(result.schedule.makespan, 5);
  }
});

test('feasible schedule below the supplied official reference is flagged', () => {
  reject(policy(record(), {reference:6}), 'reference', true);
});

test('counterfeit valid audit flags cannot conceal a resource-infeasible candidate', () => {
  const value = record();
  value.starts = [0,0,0,2,3]; value.makespan = 3;
  value.candidate.starts = [...value.starts]; value.candidate.makespan = 3;
  value.audit.makespan = 3; value.candidate.audit.makespan = 3;
  reject(policy(value), 'resource', true);
});

test('whole-call wall clock and budget declarations cannot make late output eligible', () => {
  for (const patch of [{wallTimeMs:101}, {wallTimeMs:101, internalWallTimeMs:101}, {budgetMs:101}, {deadlineOverrunMs:1}]) {
    reject(policy({...record(), ...patch}), 'clock', true);
  }
});

test('bounded iteration claims are checked for baseline and iterated methods', () => {
  reject(policy({...record('iteratedSGS'), iterations:257}), 'iterations', true);
  reject(policy({...record('iteratedSGS'), iterations:-1}), 'iterations', true);
  reject(policy({...record('iteratedSGS'), iterations:1.5}), 'iterations', true);
  reject(policy({...record(), iterations:1}), 'iterations', true);
});

test('heuristic records cannot claim certified optimality', () => {
  reject(policy({...record(), optimality:'proven_optimal'}), 'optimality', true);
  reject(policy({...record(), status:'optimal'}), 'status', true);
});

test('complete and nested candidate objectives cannot be omitted as null', () => {
  reject(policy({...record(), makespan:null}), 'makespan', true);
  const nested = record(); nested.candidate.makespan = null;
  reject(policy(nested), 'makespan', true);
  const both = record(); both.makespan = null; both.candidate.makespan = null;
  reject(policy(both), 'makespan', true);
});

test('duplicate or non-topological priority and an incorrect frozen seed are rejected', () => {
  reject(policy({...record(), priority:[0,1,1,3,4]}), 'priority', true);
  reject(policy({...record('iteratedSGS'), priority:[0,3,1,2,4]}), 'priority', true);
  reject(policy({...record(), seed:97002}), 'seed', true);
});

test('honestly declared late output keeps its physically valid candidate without becoming eligible', () => {
  const result = policy(lateRecord());
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.deepEqual(result.errors, []);
  assert.equal(result.eligible, false);
  assert.equal(result.schedule, null);
  assert.equal(result.candidateAudit.valid, true);
  assert.equal(result.candidateAudit.makespan, 5);
  assert.deepEqual(result.candidateAudit.resourceTickTotals, [4,2,2,1]);
});

test('independent summary keeps missing pair denominators and adverse eligible outcomes', () => {
  const worse = record('iteratedSGS');
  worse.starts = [0,0,2,5,6]; worse.makespan = 6;
  worse.candidate = {starts:[...worse.starts], makespan:6, audit:{valid:true, errors:[], makespan:6}};
  worse.audit = {valid:true, errors:[], makespan:6};
  const fixtureCase = (id, iterated) => ({id, referenceOptimalMakespan:5,
    policies:{baselineSerialSGS:record(), iteratedSGS:iterated},
    validationErrors:{baselineSerialSGS:[], iteratedSGS:[]}});
  const result = check('summary', {cases:[fixtureCase('handwritten-tie', record('iteratedSGS')),
    fixtureCase('handwritten-adverse', worse), fixtureCase('handwritten-late', lateRecord())]});
  for (const audits of Object.values(result.audits)) for (const audit of Object.values(audits)) {
    assert.equal(audit.valid, true, JSON.stringify(audit.errors));
  }
  const summary = result.summary;
  assert.equal(summary.caseCount, 3);
  assert.equal(summary.byMethod.baselineSerialSGS.completeCount, 3);
  assert.equal(summary.byMethod.iteratedSGS.completeCount, 2);
  assert.equal(summary.byMethod.iteratedSGS.noTimelyCompleteCount, 1);
  assert.equal(summary.paired.caseCount, 2);
  assert.equal(summary.paired.missingBaselineCount, 0);
  assert.equal(summary.paired.missingIteratedCount, 1);
  assert.equal(summary.paired.betterCount, 0);
  assert.equal(summary.paired.tiedCount, 1);
  assert.equal(summary.paired.worseCount, 1);
  assert.equal(summary.paired.baselineMakespanSum, 10);
  assert.equal(summary.paired.iteratedMakespanSum, 11);
  assert.equal(summary.paired.reductionTicks, -1);
  assert.equal(summary.paired.weightedReductionPct, -10);
  assert.deepEqual(summary.paired.worseCaseIds, ['handwritten-adverse']);
  assert.equal(summary.fees, 'not_applicable');
});
