/** Generic single-mode RCPSP; abstract source time units, never port orders/fees.
 * Independent JavaScript implementation inspired by the serial SGS, segment
 * removal and random insertion in N-Wouda/ALNS's RCPSP example, fixed commit
 * 5ef1fd1171e6be49c947cd3e56e485509b9c1d64. It omits adaptive operator selection,
 * mobile/non-peak removal, right/left justification and the original 5000 loop.
 * Original MIT notice: data/public/v7-external-methods/alns/LICENSE.md
 * Copyright (c) 2019 Niels Wouda and contributors. The original notice and
 * permission must accompany substantial copies of the example; preserved here
 * as an attributed inspiration, not a claim of a complete ALNS reproduction.
 * SGS reference: Fleszar & Hindi (2004), EJOR 155(2), 402–413, Figure 1.
 */
const integer = value => Number.isSafeInteger(value) && value >= 0;
const numericRows = text => text.split(/\r?\n/).map(line => line.trim().split(/\s+/)).filter(tokens => tokens.length && tokens.every(x => /^-?\d+$/.test(x))).map(tokens => tokens.map(Number));
const assert = (condition, message) => { if (!condition) throw new Error(message); };

export function parsePSPLIB(text, id = 'external-instance') {
  const section = name => { const index = text.indexOf(name); assert(index >= 0, `Missing ${name}`); return index; };
  const p = section('PRECEDENCE RELATIONS:'), q = section('REQUESTS/DURATIONS:'), r = section('RESOURCEAVAILABILITIES:');
  assert(p < q && q < r, 'Section order differs');
  const count = Number(text.match(/jobs\s*\(incl[^\n]*\)\s*:\s*(\d+)/i)?.[1]);
  const renewable = Number(text.match(/-\s*renewable\s*:\s*(\d+)/i)?.[1]);
  const nonrenewable = Number(text.match(/-\s*nonrenewable\s*:\s*(\d+)/i)?.[1]);
  const doubly = Number(text.match(/-\s*doubly constrained\s*:\s*(\d+)/i)?.[1]);
  const horizon = Number(text.match(/horizon\s*:\s*(\d+)/i)?.[1]);
  assert(integer(count) && count >= 2 && integer(renewable) && renewable > 0 && nonrenewable === 0 && doubly === 0,
    'Only declared single-mode renewable-resource problems are supported');
  assert(integer(horizon) && horizon > 0, 'Missing/invalid source horizon');
  const precedence = numericRows(text.slice(p, q));
  const requests = numericRows(text.slice(q, r));
  const capacities = numericRows(text.slice(r))[0];
  assert(capacities?.length === renewable && capacities.every(x => integer(x) && x > 0), 'Invalid source capacities');
  assert(precedence.length === count && requests.length === count, 'Job row count mismatch');
  const jobs = new Map();
  for (const row of requests) {
    const [jobId, mode, duration, ...demand] = row;
    assert(integer(jobId) && jobId >= 1 && !jobs.has(jobId) && mode === 1 && integer(duration), 'Invalid/duplicate request or mode');
    assert(demand.length === renewable && demand.every((x, k) => integer(x) && x <= capacities[k]), 'Invalid source demand');
    jobs.set(jobId, {id: jobId, duration, demand, successors: []});
  }
  const seen = new Set();
  for (const [jobId, modes, successorCount, ...successors] of precedence) {
    assert(jobs.has(jobId) && !seen.has(jobId) && modes === 1 && successorCount === successors.length &&
      successors.every(s => jobs.has(s) && s !== jobId) && new Set(successors).size === successors.length, 'Invalid precedence row');
    jobs.get(jobId).successors = successors; seen.add(jobId);
  }
  const jobIds = [...jobs.keys()].sort((a, b) => a - b), index = new Map(jobIds.map((x, i) => [x, i]));
  const duration = jobIds.map(x => jobs.get(x).duration), demand = jobIds.map(x => [...jobs.get(x).demand]);
  const successors = jobIds.map(x => jobs.get(x).successors.map(s => index.get(s))), predecessors = jobIds.map(() => []);
  successors.forEach((next, j) => next.forEach(s => predecessors[s].push(j)));
  const indegree = predecessors.map(x => x.length), ready = indegree.flatMap((x, j) => x === 0 ? [j] : []), topological = [];
  while (ready.length) {
    ready.sort((a, b) => jobIds[a] - jobIds[b]); const j = ready.shift(); topological.push(j);
    for (const s of successors[j]) if (--indegree[s] === 0) ready.push(s);
  }
  assert(topological.length === count, 'Precedence graph contains a cycle');
  const allPredecessors = Array.from({length: count}, () => new Set()), allSuccessors = Array.from({length: count}, () => new Set());
  for (const j of topological) for (const p of predecessors[j]) {
    allPredecessors[j].add(p); for (const ancestor of allPredecessors[p]) allPredecessors[j].add(ancestor);
  }
  for (const j of [...topological].reverse()) for (const s of successors[j]) {
    allSuccessors[j].add(s); for (const descendant of allSuccessors[s]) allSuccessors[j].add(descendant);
  }
  const projectStart = section('PROJECT INFORMATION:');
  const projectRows = numericRows(text.slice(projectStart, p));
  assert(projectRows.length === 1 && projectRows[0].length === 6 && integer(projectRows[0][2]), 'Single project information is required');
  const [projectId, realJobs, projectRelease, projectDue, tardinessCost, mpmTime] = projectRows[0];
  assert(realJobs === count - 2, 'Dummy/source job count differs');
  const earliestFinish = Array(count).fill(projectRelease);
  for (const j of topological) earliestFinish[j] = Math.max(projectRelease, ...predecessors[j].map(p => earliestFinish[p])) + duration[j];
  const criticalPathBound = Math.max(...earliestFinish);
  const workBound = Math.max(...capacities.map((c, k) => projectRelease + Math.ceil(duration.reduce((sum, d, j) => sum + d * demand[j][k], 0) / c)));
  return {id, jobIds, duration, demand, capacities, successors, predecessors, topological, horizon, projectRelease,
    allPredecessors: allPredecessors.map(x => [...x]), allSuccessors: allSuccessors.map(x => [...x]),
    lowerBound: Math.max(criticalPathBound, workBound), criticalPathBound, resourceWorkBound: workBound,
    sourceProjectFields: {projectId, realJobs, projectRelease, projectDue, tardinessCost, mpmTime},
    ignoredStandardRCPSPFields: ['projectDue', 'tardinessCost'], timeUnit: 'abstract source problem ticks', fee: 'not_applicable'};
}

export function auditRCPSP(instance, starts) {
  const errors = [], count = instance.jobIds.length;
  if (!Array.isArray(starts) || starts.length !== count || starts.some(x => !integer(x))) return {valid: false, errors: ['Incomplete or invalid integer start vector'], makespan: null};
  for (let j = 0; j < count; j++) {
    if (starts[j] < instance.projectRelease || starts[j] + instance.duration[j] > instance.horizon) errors.push(`Release/horizon job ${instance.jobIds[j]}`);
    for (const p of instance.predecessors[j]) if (starts[j] < starts[p] + instance.duration[p]) errors.push(`Precedence ${instance.jobIds[p]}->${instance.jobIds[j]}`);
  }
  // Event sweep is independent of SGS's tick occupancy placement loops.
  for (let k = 0; k < instance.capacities.length; k++) {
    const changes = new Map();
    for (let j = 0; j < count; j++) if (instance.duration[j] > 0) {
      changes.set(starts[j], (changes.get(starts[j]) ?? 0) + instance.demand[j][k]);
      const end = starts[j] + instance.duration[j]; changes.set(end, (changes.get(end) ?? 0) - instance.demand[j][k]);
    }
    let usage = 0;
    for (const time of [...changes.keys()].sort((a, b) => a - b)) {
      usage += changes.get(time);
      if (usage < 0 || usage > instance.capacities[k]) errors.push(`Resource ${k + 1} at ${time}: ${usage}>${instance.capacities[k]}`);
    }
  }
  return {valid: errors.length === 0, errors, makespan: Math.max(...starts.map((s, j) => s + instance.duration[j]))};
}

export function serialSGS(instance, priority = instance.topological, {deadline = Infinity, now = () => performance.now()} = {}) {
  const n = instance.jobIds.length;
  assert(priority.length === n && new Set(priority).size === n && priority.every(x => integer(x) && x < n), 'Priority must be a complete job permutation');
  const rank = Array(n); priority.forEach((j, i) => rank[j] = i);
  assert(instance.predecessors.every((ps, j) => ps.every(p => rank[p] < rank[j])), 'Priority must respect precedence');
  const starts = Array(n).fill(null), usage = instance.capacities.map(() => new Int32Array(instance.horizon));
  for (const j of priority) {
    if (now() >= deadline) return null;
    const earliest = Math.max(instance.projectRelease, ...instance.predecessors[j].map(p => starts[p] + instance.duration[p]));
    const d = instance.duration[j]; let selected = null;
    if (d === 0) selected = earliest <= instance.horizon ? earliest : null;
    for (let t = earliest; selected === null && t + d <= instance.horizon; t++) {
      if ((t & 15) === 0 && now() >= deadline) return null;
      let fits = true;
      for (let day = t; fits && day < t + d; day++) for (let k = 0; k < usage.length; k++)
        if (usage[k][day] + instance.demand[j][k] > instance.capacities[k]) { fits = false; break; }
      if (fits) selected = t;
    }
    if (selected === null) return null;
    starts[j] = selected;
    for (let day = selected; day < selected + d; day++) for (let k = 0; k < usage.length; k++) usage[k][day] += instance.demand[j][k];
  }
  return starts;
}

function rng(seed) { let state = seed >>> 0; return () => { state = (Math.imul(1664525, state) + 1013904223) >>> 0; return state / 4294967296; }; }
export function segmentRepair(instance, priority, random, removeCount = 8) {
  // Zero-duration dummies are protected. Removed jobs are reinserted in their
  // original topological order, so every removed predecessor is already present.
  const eligible = priority.filter(j => instance.duration[j] > 0);
  if (!eligible.length) return [...priority];
  const size = Math.min(removeCount, eligible.length), offset = Math.floor(random() * (eligible.length - size + 1));
  const removed = eligible.slice(offset, offset + size), removedSet = new Set(removed), result = priority.filter(j => !removedSet.has(j));
  for (const j of removed) {
    const positions = new Map(result.map((x, i) => [x, i]));
    // Transitive descendants still in the partial order must also constrain
    // insertion when a direct successor is temporarily removed. Otherwise a
    // later repair can have an empty interval or put an ancestor after its sink.
    const left = Math.max(-1, ...instance.allPredecessors[j].filter(p => positions.has(p)).map(p => positions.get(p))) + 1;
    const right = Math.min(result.length, ...instance.allSuccessors[j].filter(s => positions.has(s)).map(s => positions.get(s)));
    assert(left <= right, 'Repair insertion interval is empty');
    result.splice(left + Math.floor(random() * (right - left + 1)), 0, j);
  }
  return result;
}

export function solveRCPSP(instance, {method = 'baselineSerialSGS', budgetMs = 100, seed = 97001, maxIterations = 256, removeCount = 8, auditReserveMs = 2, now = () => performance.now()} = {}) {
  assert(['baselineSerialSGS', 'iteratedSGS'].includes(method) && Number.isFinite(budgetMs) && budgetMs > 0, 'Invalid method/budget');
  assert(integer(seed) && integer(maxIterations) && integer(removeCount) && removeCount > 0 && Number.isFinite(auditReserveMs) && auditReserveMs >= 0, 'Invalid fixed search parameters');
  const started = now(), deadline = started + budgetMs, searchDeadline = deadline - auditReserveMs;
  let priority = [...instance.topological], best = serialSGS(instance, priority, {deadline: searchDeadline, now}), accepted = 0, iterations = 0;
  let bestAudit = best ? auditRCPSP(instance, best) : null;
  if (bestAudit?.valid !== true || now() >= deadline) { best = null; bestAudit = null; }
  const random = rng(seed);
  if (method === 'iteratedSGS' && best) for (; iterations < maxIterations && now() < searchDeadline; iterations++) {
    const candidatePriority = segmentRepair(instance, priority, random, removeCount);
    const candidate = serialSGS(instance, candidatePriority, {deadline: searchDeadline, now});
    if (!candidate) break;
    const checked = auditRCPSP(instance, candidate);
    if (now() >= deadline) break;
    assert(checked.valid, 'SGS candidate failed independent event-sweep audit');
    if (checked.makespan <= bestAudit.makespan) { best = candidate; bestAudit = checked; priority = candidatePriority; accepted++; }
  }
  const elapsed = now() - started, withinBudget = elapsed <= budgetMs;
  return {method, status: best && withinBudget ? 'feasible' : 'no_timely_complete_schedule', complete: Boolean(best && withinBudget),
    starts: best && withinBudget ? best : null, makespan: best && withinBudget ? bestAudit.makespan : null,
    candidate: best ? {starts: best, makespan: bestAudit.makespan, audit: bestAudit} : null,
    audit: best && withinBudget ? bestAudit : {valid: false, errors: ['No timely complete candidate'], makespan: null},
    priority: best ? priority : null, iterations, acceptedMoves: accepted, seed, wallTimeMs: elapsed,
    budgetMs, cooperativeBudget: true, deadlineOverrunMs: Math.max(0, elapsed - budgetMs),
    optimality: 'not_proven', objective: 'makespan in source ticks', fee: 'not_applicable'};
}
