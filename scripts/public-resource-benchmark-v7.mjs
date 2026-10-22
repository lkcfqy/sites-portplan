/** Published PSPLIB J30 generic RCPSP; no port-field conversion or fee estimate. */
import {readFile, writeFile, mkdir, copyFile, access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {resolve, dirname} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {cpus, platform, release} from 'node:os';
import {parsePSPLIB, solveRCPSP, auditRCPSP} from '../src/rcpsp-v7.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FROZEN_PROTOCOL_SHA = '8c5370eaf867b167663717b97e6c895b796dbb832b84375ef61ad3a5b4bed364';
const METHODS = ['baselineSerialSGS', 'iteratedSGS'];
const runFile = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const check = (value, message) => { if (!value) throw new Error(message); };

export function unpackPSPLIB(archive) {
  const tar = gunzipSync(archive), files = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(x => x === 0)) break;
    const name = header.subarray(0, 100).toString('ascii').split('\0')[0];
    const size = parseInt(header.subarray(124, 136).toString('ascii').replace(/\0/g, '').trim(), 8);
    check(Number.isSafeInteger(size) && size >= 0 && offset + 512 + size <= tar.length, 'Invalid source tar entry');
    const type = header[156];
    if (type === 0 || type === 48) {
      check(/^j30\d+_\d+\.sm$/.test(name) && !files.has(name), 'Unexpected or duplicate source tar filename');
      files.set(name, Buffer.from(tar.subarray(offset + 512, offset + 512 + size)));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  check(files.size === 480, 'Retain exactly all 480 J30 instances');
  return files;
}

export function parseOpt(text) {
  const values = new Map();
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(\d+)\s+(\d+)\s+(\d+)\s+\d+(?:\.\d+)?\s*$/);
    if (!match) continue;
    const key = `j30${Number(match[1])}_${Number(match[2])}.sm`;
    check(!values.has(key), 'Duplicate official optimum'); values.set(key, Number(match[3]));
  }
  check(values.size === 480, 'Official optimum file must cover all 480 instances');
  return values;
}

async function sourceInputs(protocol, inputDir, allowDownload) {
  await mkdir(inputDir, {recursive: true}); const bytes = {};
  for (const [name, record] of Object.entries(protocol.sources)) {
    const path = resolve(inputDir, record.filename);
    try { bytes[name] = await readFile(path); }
    catch (error) {
      if (error.code !== 'ENOENT' || !allowDownload) throw new Error(`Missing source ${path}; run --download-only or provide the original --input-dir.`);
      // Direct published URL only; no retries, authentication, alternative hosts,
      // UA spoofing or bypass if the publisher rejects access.
      const temporary = path + '.download';
      await runFile('curl', ['--fail', '--location', '--max-time', '30', '--output', temporary, record.url]);
      bytes[name] = await readFile(temporary);
      check(hash(bytes[name]) === record.sha256 && bytes[name].length === record.bytes, 'Downloaded source snapshot differs: ' + name);
      await writeFile(path, bytes[name]);
    }
    check(hash(bytes[name]) === record.sha256 && bytes[name].length === record.bytes, 'Cached source snapshot differs: ' + name);
  }
  return bytes;
}

const finiteSummary = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b), len = sorted.length;
  return {count: len, minimum: len ? sorted[0] : null, median: len ? (sorted[Math.floor((len - 1) / 2)] + sorted[Math.floor(len / 2)]) / 2 : null,
    p95: len ? sorted[Math.ceil(len * .95) - 1] : null, maximum: len ? sorted.at(-1) : null};
};

export function summarize(cases) {
  const byMethod = {};
  for (const method of METHODS) {
    const eligible = cases.filter(c => c.policies[method].complete), all = cases.map(c => c.policies[method]);
    const gaps = eligible.map(c => c.policies[method].makespan - c.referenceOptimalMakespan);
    byMethod[method] = {caseCount: cases.length, completeCount: eligible.length, noTimelyCompleteCount: cases.length - eligible.length,
      referenceOptimalMatchCount: gaps.filter(g => g === 0).length, belowReferenceCount: gaps.filter(g => g < 0).length,
      gapTicks: finiteSummary(gaps), gapPct: finiteSummary(eligible.map((c, i) => c.referenceOptimalMakespan ? gaps[i] * 100 / c.referenceOptimalMakespan : NaN)),
      zeroReferenceCount: eligible.filter(c => c.referenceOptimalMakespan === 0).length,
      makespanSum: eligible.reduce((sum, c) => sum + c.policies[method].makespan, 0),
      wallTimeMs: finiteSummary(all.map(c => c.wallTimeMs)), deadlineOverrunCount: all.filter(c => c.deadlineOverrunMs > 0).length,
      iterations: finiteSummary(all.map(c => c.iterations)), statuses: Object.fromEntries([...new Set(all.map(c => c.status))].map(s => [s, all.filter(c => c.status === s).length]))};
  }
  const pairs = cases.filter(c => METHODS.every(m => c.policies[m].complete));
  const changes = pairs.map(c => c.policies.baselineSerialSGS.makespan - c.policies.iteratedSGS.makespan);
  const baseline = pairs.reduce((sum, c) => sum + c.policies.baselineSerialSGS.makespan, 0);
  return {caseCount: cases.length, byMethod, paired: {caseCount: pairs.length,
    missingBaselineCount: cases.filter(c => !c.policies.baselineSerialSGS.complete).length,
    missingIteratedCount: cases.filter(c => !c.policies.iteratedSGS.complete).length,
    betterCount: changes.filter(x => x > 0).length, tiedCount: changes.filter(x => x === 0).length, worseCount: changes.filter(x => x < 0).length,
    baselineMakespanSum: baseline, iteratedMakespanSum: baseline - changes.reduce((a, b) => a + b, 0),
    reductionTicks: changes.reduce((a, b) => a + b, 0), weightedReductionPct: baseline ? changes.reduce((a, b) => a + b, 0) * 100 / baseline : null,
    zeroBaselineCount: pairs.filter(c => c.policies.baselineSerialSGS.makespan === 0).length,
    worseCaseIds: pairs.filter(c => c.policies.iteratedSGS.makespan > c.policies.baselineSerialSGS.makespan).map(c => c.id)},
    auditErrors: cases.flatMap(c => METHODS.flatMap(m => c.validationErrors[m].map(e => ({id: c.id, method: m, error: e})))),
    fees: 'not_applicable', portModelEquivalent: false};
}

async function main() {
  const protocolRaw = await readFile(resolve(ROOT, 'data/protocol-public-v7.json'));
  check(hash(protocolRaw) === FROZEN_PROTOCOL_SHA, 'Frozen public-V7 protocol changed');
  const protocol = JSON.parse(protocolRaw);
  const inputArg = process.argv.indexOf('--input-dir'), outputArg = process.argv.indexOf('--output');
  const inputDir = resolve(inputArg >= 0 ? process.argv[inputArg + 1] : resolve(ROOT, 'artifacts/public-v7-inputs'));
  const source = await sourceInputs(protocol, inputDir, process.argv.includes('--download-only') || process.argv.includes('--download'));
  if (process.argv.includes('--download-only')) { console.log(JSON.stringify({state: 'downloaded_verified_sources', inputDir, sourceNames: Object.keys(source)})); return; }
  const first = process.argv.includes('--record-first-run'), frozen = resolve(ROOT, 'data/public-resource-v7.json');
  const output = resolve(outputArg >= 0 ? process.argv[outputArg + 1] : first ? frozen : resolve(ROOT, 'artifacts/public-resource-v7-reproduction.json'));
  check(output !== frozen || first, 'Never overwrite first-run evidence; use a reproduction output');
  check(!first || output === frozen, '--record-first-run must use the declared destination');
  if (first) { try { await access(frozen); throw new Error('First-run archive already exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  const implementationHashes = {};
  for (const path of protocol.implementationFiles) implementationHashes[path] = hash(await readFile(resolve(ROOT, path)));
  if (first) {
    const snapshot = resolve(ROOT, 'vendor/experiments/public-v7-first-run-source');
    for (const path of protocol.implementationFiles) { const target = resolve(snapshot, path); await mkdir(dirname(target), {recursive: true}); await copyFile(resolve(ROOT, path), target); }
    await writeFile(resolve(snapshot, 'manifest.json'), JSON.stringify({protocolHash: hash(protocolRaw), implementationHashes, capturedBeforeFirstMethodCall: true}, null, 2) + '\n');
  }
  const files = unpackPSPLIB(source.archive), references = parseOpt(source.opt.toString('utf8'));
  const merged = JSON.parse(source.merged.toString('utf8'));
  check(merged.summary.total_instances === 480 && merged.summary.num_proven_optimal === 480, 'Merged references no longer declare all optima');
  for (const entry of merged.solutions) check(references.get(`j30${entry.parameter}_${entry.instance}.sm`) === entry.optimal_makespan && entry.is_proven_optimal,
    'OPT and official merged metadata disagree');
  check(JSON.stringify(protocol.caseIds) === JSON.stringify([...files.keys()].sort((a, b) => {
    const av = a.match(/j30(\d+)_(\d+)/).slice(1).map(Number), bv = b.match(/j30(\d+)_(\d+)/).slice(1).map(Number);
    return av[0] - bv[0] || av[1] - bv[1];
  })), 'Full source panel differs from protocol order');
  const startedAt = new Date().toISOString(), cases = [];
  // Parsing/reference joins are once per input, explicitly outside warm method
  // timers; each method includes construction, search and its event-sweep audit.
  for (let i = 0; i < protocol.caseIds.length; i++) {
    const id = protocol.caseIds[i], bytes = files.get(id), instance = parsePSPLIB(bytes.toString('ascii'), id);
    const order = i % 2 ? [...METHODS].reverse() : [...METHODS], policies = {}, validationErrors = {};
    for (const method of order) {
      const callStarted = performance.now();
      try { policies[method] = solveRCPSP(instance, {...protocol.parameters, method, budgetMs: protocol.budget.perMethodWarmMs, seed: protocol.seedBase + i}); }
      catch (error) {
        const wallTimeMs = performance.now() - callStarted;
        policies[method] = {method, status: 'method_error', complete: false, starts: null, makespan: null, candidate: null,
          audit: {valid: false, errors: [String(error)], makespan: null}, iterations: null, acceptedMoves: null,
          seed: protocol.seedBase + i, wallTimeMs, budgetMs: protocol.budget.perMethodWarmMs,
          deadlineOverrunMs: Math.max(0, wallTimeMs - protocol.budget.perMethodWarmMs), fee: 'not_applicable', error: String(error)};
      }
      const wholeCallMs = performance.now() - callStarted;
      const result = policies[method];
      result.internalWallTimeMs = result.wallTimeMs;
      result.wallTimeMs = wholeCallMs;
      result.deadlineOverrunMs = Math.max(0, wholeCallMs - protocol.budget.perMethodWarmMs);
      if (wholeCallMs > protocol.budget.perMethodWarmMs && result.complete) {
        result.complete = false; result.starts = null; result.makespan = null;
        result.status = 'no_timely_complete_schedule';
        result.audit = {valid: false, errors: ['Full in-process call returned after its declared budget; candidate retained separately'], makespan: null};
      }
      validationErrors[method] = [];
      if (result.complete) {
        const audit = auditRCPSP(instance, result.starts);
        if (!audit.valid || audit.makespan !== result.makespan) validationErrors[method].push('Terminal schedule audit differs');
        if (result.makespan < references.get(id)) validationErrors[method].push('Below declared official optimum: check model/parser');
      }
    }
    cases.push({id, dataRole: 'external-published-known-generated-benchmark', sourceFileSha256: hash(bytes),
      jobIds: instance.jobIds, jobCountIncludingDummies: instance.jobIds.length, resourceCount: instance.capacities.length,
      timeUnit: instance.timeUnit, referenceOptimalMakespan: references.get(id), methodExecutionOrder: order, policies, validationErrors,
      sourceProjectFieldsRetained: instance.sourceProjectFields, sourceHorizon: instance.horizon,
      adaptation: 'none: original generic RCPSP resource/precedence model; no truck, warehouse, staging or tariff mapping'});
    if ((i + 1) % 60 === 0) console.log(JSON.stringify({processed: i + 1, total: protocol.caseIds.length}));
  }
  const report = {schemaVersion: 'portplan-public-rcpsp-v7-first-run-1', protocolHash: hash(protocolRaw), implementationHashes,
    startedAt, generatedAt: new Date().toISOString(), executionState: 'complete',
    environment: {node: process.version, platform: platform(), osRelease: release(), logicalCPUs: cpus().length,
      cpuModel: cpus()[0]?.model, timing: 'Warm in-process cooperative per-method budget; imports/parsing/download outside, all construction/search/audit inside'},
    sources: protocol.sources, sourceRedistribution: 'Original numeric files remain download-on-demand research caches, not website ZIP artifacts',
    cases, summary: summarize(cases), limitations: protocol.limitations};
  await mkdir(dirname(output), {recursive: true}); await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({state: 'complete', output, summary: report.summary}));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
