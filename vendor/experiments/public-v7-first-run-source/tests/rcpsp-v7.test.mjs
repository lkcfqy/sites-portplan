import test from 'node:test';
import assert from 'node:assert/strict';
import {parsePSPLIB, auditRCPSP, serialSGS, segmentRepair, solveRCPSP} from '../src/rcpsp-v7.js';
import {unpackPSPLIB, parseOpt, summarize} from '../scripts/public-resource-benchmark-v7.mjs';
import {gzipSync} from 'node:zlib';

const fixture = (release = 0) => `
jobs (incl. supersource/sink ): 4
horizon : 20
RESOURCES
 - renewable : 2 R
 - nonrenewable : 0 N
 - doubly constrained : 0 D
PROJECT INFORMATION:
pronr. #jobs rel.date duedate tardcost MPM-Time
1 2 ${release} 1 7 3
PRECEDENCE RELATIONS:
jobnr. #modes #successors successors
1 1 2 2 3
2 1 1 4
3 1 1 4
4 1 0
REQUESTS/DURATIONS:
jobnr. mode duration R1 R2
1 1 0 0 0
2 1 3 2 1
3 1 2 2 0
4 1 0 0 0
RESOURCEAVAILABILITIES:
R1 R2
3 1
`;

test('source ID mapping, source release and ignored project due are explicit', () => {
  const s = parsePSPLIB(fixture(5), 'hand');
  assert.deepEqual(s.jobIds, [1, 2, 3, 4]);
  assert.equal(s.projectRelease, 5); assert.equal(s.sourceProjectFields.projectDue, 1);
  const starts = serialSGS(s); assert.deepEqual(starts, [5, 5, 8, 10]);
  assert.equal(auditRCPSP(s, starts).makespan, 10); // Due=1 is not a hard deadline.
  assert.equal(s.fee, 'not_applicable');
});

test('event sweep rejects overlap, precedence and partial schedules', () => {
  const s = parsePSPLIB(fixture());
  assert.equal(auditRCPSP(s, [0, 0, 0, 3]).valid, false);
  assert.equal(auditRCPSP(s, [0, 0, 3, 4]).valid, false);
  assert.equal(auditRCPSP(s, [0, 0, 3]).valid, false);
  assert.equal(auditRCPSP(s, [0, 0, 3, 5]).valid, true);
});

test('half-open occupancy releases resources at job completion; zero dummies consume none', () => {
  const s = parsePSPLIB(fixture());
  const r = auditRCPSP(s, [0, 0, 3, 5]);
  assert.deepEqual(r, {valid: true, errors: [], makespan: 5});
});

test('two resource dimensions independently constrain serial SGS', () => {
  const s = parsePSPLIB(fixture().replace('3 1\n', '4 1\n').replace('3 1 2 2 0', '3 1 2 2 1'));
  assert.deepEqual(serialSGS(s), [0, 0, 3, 5]); // R1 alone would allow parallel work.
});

test('invalid dimensions, modes, or cyclic graphs are refused', () => {
  assert.throws(() => parsePSPLIB(fixture().replace('2 1 3 2 1', '2 2 3 2 1')));
  assert.throws(() => parsePSPLIB(fixture().replace('2 1 3 2 1', '2 1 3 2')));
  assert.throws(() => parsePSPLIB(fixture().replace('3 1 1 4', '3 1 1 1')), /cycle/);
  assert.throws(() => parsePSPLIB(fixture().replace('- nonrenewable : 0', '- nonrenewable : 1')));
});

test('serial SGS does not accept a priority violating precedence', () => {
  assert.throws(() => serialSGS(parsePSPLIB(fixture()), [1, 0, 2, 3]), /precedence/);
});

test('segment repair preserves a full legal topological order through both insertion endpoints', () => {
  const s = parsePSPLIB(fixture());
  for (const value of [0, .499, .999999]) {
    const order = segmentRepair(s, s.topological, () => value, 2);
    const starts = serialSGS(s, order); assert.equal(auditRCPSP(s, starts).valid, true);
    assert.equal(new Set(order).size, 4);
  }
});

test('repair respects a remaining transitive descendant when direct successors are removed', () => {
  const chain = fixture().replace('): 4', '): 5').replace('1 2 0 1 7 3', '1 3 0 1 7 3')
    .replace('1 1 2 2 3\n2 1 1 4\n3 1 1 4\n4 1 0', '1 1 1 2\n2 1 1 3\n3 1 1 4\n4 1 1 5\n5 1 0')
    .replace('4 1 0 0 0', '4 1 1 1 0\n5 1 0 0 0');
  const s = parsePSPLIB(chain); const values = [0, .999999, .999999];
  const order = segmentRepair(s, s.topological, () => values.shift(), 2);
  assert.deepEqual(order, [0, 1, 2, 3, 4]);
  assert.equal(auditRCPSP(s, serialSGS(s, order)).valid, true);
});

test('fixed seed and iteration cap reproduce results without using reference optimum', () => {
  const s = parsePSPLIB(fixture());
  const options = {method: 'iteratedSGS', now: () => 0, maxIterations: 12, seed: 42};
  const a = solveRCPSP(s, options), b = solveRCPSP(s, options);
  assert.deepEqual(a, b); assert.equal(a.iterations, 12); assert.equal(a.audit.valid, true);
  assert.equal(a.makespan, 5); assert.equal(a.optimality, 'not_proven');
});

test('exhausted or late cooperative budget never becomes a timely complete result', () => {
  const s = parsePSPLIB(fixture()); let tick = 0;
  const r = solveRCPSP(s, {budgetMs: 1, auditReserveMs: 0, now: () => tick++});
  assert.equal(r.complete, false); assert.equal(r.makespan, null); assert.equal(r.starts, null);
  assert.equal(r.fee, 'not_applicable');
});

test('serial SGS matches independent exhaustive optimum on a small two-resource fixture', () => {
  const s = parsePSPLIB(fixture()); let optimum = Infinity;
  for (let a = 0; a <= 5; a++) for (let b = 0; b <= 5; b++) {
    const end = Math.max(a + 3, b + 2);
    // Independently check constant demands at integer ticks, without SGS or sweep.
    let valid = true;
    for (let t = 0; t < end; t++) {
      const r1 = (a <= t && t < a + 3 ? 2 : 0) + (b <= t && t < b + 2 ? 2 : 0);
      if (r1 > 3) valid = false;
    }
    if (valid) optimum = Math.min(optimum, end);
  }
  assert.equal(optimum, 5); assert.equal(auditRCPSP(s, serialSGS(s)).makespan, optimum);
});

test('official reference parser requires exactly 480 unique canonical records', () => {
  const rows = [];
  for (let p = 1; p <= 48; p++) for (let i = 1; i <= 10; i++) rows.push(`${p} ${i} 5 0.30`);
  assert.equal(parseOpt(rows.join('\n')).size, 480);
  assert.throws(() => parseOpt(rows.slice(1).join('\n')), /480/);
  assert.throws(() => parseOpt([...rows, rows[0]].join('\n')), /Duplicate/);
  assert.throws(() => unpackPSPLIB(gzipSync(Buffer.alloc(1024))), /480/);
});

test('summary retains missing, adverse and zero-reference cases without invented percentages', () => {
  const result = (makespan, complete = true) => ({complete, makespan, wallTimeMs: 1, iterations: 0, deadlineOverrunMs: 0, status: complete ? 'feasible' : 'no_timely_complete_schedule'});
  const c = (id, ref, a, b) => ({id, referenceOptimalMakespan: ref, policies: {baselineSerialSGS: a, iteratedSGS: b}, validationErrors: {baselineSerialSGS: [], iteratedSGS: []}});
  const s = summarize([c('worse', 2, result(3), result(4)), c('zero', 0, result(0), result(0)), c('missing', 2, result(null, false), result(2))]);
  assert.equal(s.caseCount, 3); assert.equal(s.paired.caseCount, 2);
  assert.equal(s.paired.missingBaselineCount, 1); assert.equal(s.paired.worseCount, 1);
  assert.deepEqual(s.paired.worseCaseIds, ['worse']); assert.equal(s.paired.zeroBaselineCount, 1);
  assert.equal(s.byMethod.baselineSerialSGS.zeroReferenceCount, 1);
  assert.equal(s.byMethod.baselineSerialSGS.gapPct.count, 1);
  assert.equal(s.fees, 'not_applicable'); assert.equal(s.portModelEquivalent, false);
});
