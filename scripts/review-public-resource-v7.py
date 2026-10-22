#!/usr/bin/env python3
"""Read-only independent PSPLIB J30 result review; stdlib, no solver or JS import.

Original numeric sources are read from a research cache in memory and are never
copied into the review. Public functions also support small negative fixtures.
"""
import argparse
import collections
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import re
import tarfile

ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_SHA = '8c5370eaf867b167663717b97e6c895b796dbb832b84375ef61ad3a5b4bed364'
REPORT_SHA = '8006575658f320ba0db851af8e6f0251ac9935bb8d72790bf0b9f405594d4dd6'
METHODS = ['baselineSerialSGS', 'iteratedSGS']
SNAPSHOT = 'vendor/experiments/public-v7-first-run-source'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def integer(value):
    return isinstance(value, int) and not isinstance(value, bool) and 0 <= value <= 9007199254740991


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def numeric_lines(text):
    for line in text.splitlines():
        if re.fullmatch(r'\s*\d+(?:\s+\d+)*\s*', line):
            yield [int(token) for token in line.split()]


def parse_sm(text, filename='fixture.sm'):
    """Parse original single-mode, four-renewable PSPLIB syntax independently."""
    def scalar(pattern, label):
        match = re.search(pattern, text, re.I | re.M)
        require(match is not None, f'parse: missing {label}')
        return int(match.group(1))
    count = scalar(r'^jobs\s*\(incl[^\n]*\)\s*:\s*(\d+)', 'job count')
    horizon = scalar(r'^horizon\s*:\s*(\d+)', 'horizon')
    require(scalar(r'^projects\s*:\s*(\d+)', 'projects') == 1, 'parse: require single project')
    require(scalar(r'^\s*-\s*renewable\s*:\s*(\d+)', 'renewable') == 4, 'parse: require original four renewable resources')
    require(scalar(r'^\s*-\s*nonrenewable\s*:\s*(\d+)', 'nonrenewable') == 0, 'parse: nonrenewable resources unsupported')
    require(scalar(r'^\s*-\s*doubly constrained\s*:\s*(\d+)', 'doubly constrained') == 0, 'parse: doubly constrained resources unsupported')
    require(2 <= count <= 1000 and 0 < horizon <= 100000, 'parse: invalid source dimensions')
    labels = ['PROJECT INFORMATION:', 'PRECEDENCE RELATIONS:', 'REQUESTS/DURATIONS:', 'RESOURCEAVAILABILITIES:']
    positions = [text.find(label) for label in labels]
    require(all(pos >= 0 for pos in positions) and positions == sorted(set(positions)), 'parse: section order')
    segments = [text[positions[i]:positions[i+1]] for i in range(3)] + [text[positions[3]:]]
    project_rows, precedence_rows, request_rows, capacity_rows = [list(numeric_lines(part)) for part in segments]
    require(len(project_rows) == 1 and len(project_rows[0]) == 6, 'parse: single project row required')
    project = dict(zip(['projectId', 'realJobs', 'projectRelease', 'projectDue', 'tardinessCost', 'mpmTime'], project_rows[0]))
    require(project['realJobs'] == count-2 and project['projectRelease'] == 0, 'parse: source dummy count/release differs')
    require(len(capacity_rows) == 1 and len(capacity_rows[0]) == 4 and all(x > 0 for x in capacity_rows[0]), 'parse: original capacities')
    capacities = capacity_rows[0]
    require(len(precedence_rows) == count and len(request_rows) == count, 'parse: full source job coverage')
    jobs = {}
    for row in request_rows:
        require(len(row) == 7, 'parse: duration/demand columns')
        job_id, mode, duration, *demand = row
        require(job_id not in jobs and mode == 1 and 1 <= job_id <= count, 'parse: duplicate job_ids or non-single mode')
        require(duration <= horizon and all(0 <= demand[k] <= capacities[k] for k in range(4)), 'parse: invalid duration/demand')
        jobs[job_id] = {'duration': duration, 'demand': demand}
    ids = list(range(1, count+1))
    require(sorted(jobs) == ids, 'parse: job_ids must retain complete original numbering')
    successors = {}
    for row in precedence_rows:
        require(len(row) >= 3, 'parse: precedence columns')
        job_id, modes, size, *next_ids = row
        require(job_id in jobs and job_id not in successors and modes == 1 and size == len(next_ids), 'parse: precedence coverage/mode')
        require(len(set(next_ids)) == len(next_ids) and all(x in jobs and x != job_id for x in next_ids), 'parse: invalid precedence edge')
        successors[job_id] = next_ids
    indegree = {job_id: 0 for job_id in ids}
    for next_ids in successors.values():
        for nxt in next_ids:
            indegree[nxt] += 1
    require(indegree[1] == 0 and not successors[count], 'parse: source/sink dummies')
    ready = sorted(job_id for job_id in ids if indegree[job_id] == 0)
    topological = []
    while ready:
        job_id = ready.pop(0)
        topological.append(job_id)
        for nxt in successors[job_id]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                ready.append(nxt)
                ready.sort()
    require(len(topological) == count, 'parse: cyclic precedence')
    for job_id in [1, count]:
        require(jobs[job_id]['duration'] == 0 and jobs[job_id]['demand'] == [0]*4, 'parse: dummies must have zero duration/demand')
    return {'id': filename, 'job_ids': ids, 'durations': [jobs[x]['duration'] for x in ids],
            'demands': [jobs[x]['demand'] for x in ids], 'successors': [successors[x] for x in ids],
            'capacities': capacities, 'horizon': horizon, 'project': project, 'topological': topological}


def parse_opt(text):
    references = {}
    for line in text.splitlines():
        match = re.fullmatch(r'\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s*', line)
        if match:
            parameter, instance, makespan = map(int, match.groups()[:3])
            key = f'j30{parameter}_{instance}.sm'
            require(key not in references, 'reference: duplicate official OPT entry')
            references[key] = makespan
    return references


def audit_starts(model, job_ids, starts, reported_makespan=None):
    errors = []
    empty = {'valid': False, 'errors': errors, 'makespan': None, 'resourcePeaks': None, 'resourceTickTotals': None}
    if not isinstance(job_ids, list) or any(not integer(x) for x in job_ids) or len(set(job_ids)) != len(job_ids):
        errors.append('job_ids: invalid or duplicate source identifiers')
        return empty
    if set(job_ids) != set(model['job_ids']) or len(job_ids) != len(model['job_ids']):
        errors.append('coverage: one start for every original job is required')
        return empty
    if not isinstance(starts, list) or len(starts) != len(job_ids) or any(not integer(x) for x in starts):
        errors.append('coverage: incomplete or invalid integer start vector')
        return empty
    start = dict(zip(job_ids, starts))
    duration = dict(zip(model['job_ids'], model['durations']))
    end = {j: start[j]+duration[j] for j in model['job_ids']}
    release, horizon = model['project']['projectRelease'], model['horizon']
    for j, successors in zip(model['job_ids'], model['successors']):
        if start[j] < release or end[j] > horizon:
            errors.append(f'horizon: job {j} release/finish')
        for nxt in successors:
            if end[j] > start[nxt]:
                errors.append(f'precedence: {j}->{nxt}')
    makespan = max(end.values())
    if start[model['job_ids'][0]] != release or start[model['job_ids'][-1]] != makespan:
        errors.append('dummies: source at release and zero-duration sink at makespan required')
    if reported_makespan is not None and (not integer(reported_makespan) or reported_makespan != makespan):
        errors.append('makespan: reported value differs from complete activity finishes')
    peaks, totals = [], []
    # Independent tick difference arrays; no SGS occupancy or producer sweep.
    for k, capacity in enumerate(model['capacities']):
        changes = [0]*(horizon+1)
        expected_work = 0
        for i, j in enumerate(model['job_ids']):
            demand = model['demands'][i][k]
            expected_work += demand*duration[j]
            if duration[j] and 0 <= start[j] <= end[j] <= horizon:
                changes[start[j]] += demand
                changes[end[j]] -= demand
        usage = peak = work = 0
        violated = False
        for tick in range(horizon):
            usage += changes[tick]
            peak = max(peak, usage)
            work += usage
            if usage < 0 or usage > capacity:
                violated = True
        usage += changes[horizon]
        if violated:
            errors.append(f'resource: R{k+1} exceeds original capacity')
        if usage != 0 or work != expected_work:
            errors.append(f'resource: R{k+1} nonpreemptive work ledger differs')
        peaks.append(peak)
        totals.append(work)
    return {'valid': not errors, 'errors': errors, 'makespan': makespan, 'resourcePeaks': peaks, 'resourceTickTotals': totals}


def audit_policy(model, job_ids, record, reference, budget_ms=100, max_iterations=256, expected_seed=None):
    """Audit saved result/candidate and independently derive timing eligibility."""
    errors = []
    schedule = None
    candidate_audit = None
    if not isinstance(record, dict):
        return {'valid': False, 'errors': ['coverage: missing method result'], 'eligible': False, 'schedule': None, 'candidateAudit': None}
    method = record.get('method')
    if method not in METHODS:
        errors.append('method: unsupported method key')
    if record.get('optimality') != 'not_proven':
        errors.append('optimality: heuristic must not claim a proven optimum')
    if record.get('status') == 'optimal':
        errors.append('optimality: heuristic status must not be optimal')
    if record.get('objective') != 'makespan in source ticks' or record.get('fee') != 'not_applicable':
        errors.append('objective: original RCPSP makespan only; no fee')
    if record.get('budgetMs') != budget_ms or record.get('cooperativeBudget') is not True:
        errors.append('clock: declared warm cooperative budget differs')
    outer, inner = record.get('wallTimeMs'), record.get('internalWallTimeMs')
    clocks_ok = finite(outer) and finite(inner) and 0 <= inner <= outer+1e-7
    if not clocks_ok:
        errors.append('clock: require finite nonnegative inner clock within outer clock')
    overrun = max(0, outer-budget_ms) if finite(outer) else None
    if not finite(record.get('deadlineOverrunMs')) or overrun is None or not math.isclose(record['deadlineOverrunMs'], overrun, rel_tol=1e-12, abs_tol=1e-7):
        errors.append('clock: overrun does not equal external whole-call overrun')
    timely = clocks_ok and outer <= budget_ms and inner <= budget_ms
    iterations, accepted = record.get('iterations'), record.get('acceptedMoves')
    if not integer(iterations) or iterations > max_iterations or method == METHODS[0] and iterations != 0:
        errors.append('iterations: outside frozen method limit')
    if not integer(accepted) or not integer(iterations) or accepted > iterations or method == METHODS[0] and accepted != 0:
        errors.append('iterations: accepted move counter inconsistent')
    if not integer(record.get('seed')) or expected_seed is not None and record.get('seed') != expected_seed:
        errors.append('seed: does not match frozen canonical case seed')
    candidate = record.get('candidate')
    if candidate is not None:
        if not isinstance(candidate, dict):
            errors.append('coverage: malformed nested candidate')
        else:
            if not integer(candidate.get('makespan')):
                errors.append('makespan: candidate must report a finite integer objective')
            candidate_audit = audit_starts(model, job_ids, candidate.get('starts'), candidate.get('makespan'))
            errors.extend('candidate.'+x for x in candidate_audit['errors'])
            expected_audit = {'valid': candidate_audit['valid'], 'errors': candidate_audit['errors'], 'makespan': candidate_audit['makespan']}
            if candidate.get('audit') != expected_audit:
                errors.append('audit: nested candidate reported audit/errors differ')
            if candidate_audit['makespan'] is not None and candidate_audit['makespan'] < reference:
                errors.append('reference: candidate below official known optimum')
            priority = record.get('priority')
            n = len(model['job_ids'])
            if not isinstance(priority, list) or any(not integer(x) for x in priority) or sorted(priority) != list(range(n)):
                errors.append('priority: require complete original job permutation')
            else:
                positions = {model['job_ids'][index]: rank for rank, index in enumerate(priority)}
                if any(positions[j] >= positions[nxt] for j, nxts in zip(model['job_ids'], model['successors']) for nxt in nxts):
                    errors.append('priority: precedence mismatch')
                if method == METHODS[0] and [model['job_ids'][i] for i in priority] != model['topological']:
                    errors.append('priority: baseline differs from stable source-ID Kahn order')
    eligible = timely and candidate_audit is not None and candidate_audit['valid']
    if record.get('complete') is not eligible:
        errors.append('clock: complete flag differs from valid timely full candidate eligibility')
    if record.get('complete') is True:
        if not integer(record.get('makespan')):
            errors.append('makespan: complete result must report a finite integer objective')
        schedule = audit_starts(model, job_ids, record.get('starts'), record.get('makespan'))
        errors.extend(schedule['errors'])
        if not timely:
            errors.append('clock: late call cannot be a complete successful schedule')
        if not candidate or record.get('starts') != candidate.get('starts') or record.get('makespan') != candidate.get('makespan'):
            errors.append('coverage: final result and nested candidate differ')
        expected_audit = {'valid': schedule['valid'], 'errors': schedule['errors'], 'makespan': schedule['makespan']}
        if record.get('audit') != expected_audit:
            errors.append('audit: reported terminal audit/errors differ')
        if record.get('status') != 'feasible':
            errors.append('status: timely complete heuristic must be feasible')
        if schedule['makespan'] is not None and schedule['makespan'] < reference:
            errors.append('reference: final makespan below official known optimum')
    else:
        if record.get('starts') is not None or record.get('makespan') is not None:
            errors.append('coverage: incomplete result must have null successful schedule')
        if record.get('status') not in ['no_timely_complete_schedule', 'method_error']:
            errors.append('status: invalid missing-schedule state')
        expected_errors = ['Full in-process call returned after its declared budget; candidate retained separately'] if finite(outer) and outer > budget_ms and candidate is not None else ['No timely complete candidate']
        if record.get('status') == 'method_error':
            expected_errors = [record.get('error')]
        if record.get('audit') != {'valid': False, 'errors': expected_errors, 'makespan': None}:
            errors.append('audit: missing-schedule audit/errors differ')
    return {'valid': not errors, 'errors': errors, 'eligible': eligible and not errors, 'schedule': schedule, 'candidateAudit': candidate_audit}


def distribution(values):
    values = sorted(value for value in values if finite(value))
    n = len(values)
    return {'count': n, 'minimum': values[0] if n else None,
            'median': (values[(n-1)//2]+values[n//2])/2 if n else None,
            'p95': values[math.ceil(n*.95)-1] if n else None, 'maximum': values[-1] if n else None}


def summarize_independent(cases, audits):
    by_method = {}
    for method in METHODS:
        good = [c for c in cases if audits[c['id']][method]['eligible']]
        all_records = [c['policies'][method] for c in cases]
        gaps = [audits[c['id']][method]['candidateAudit']['makespan']-c['referenceOptimalMakespan'] for c in good]
        by_method[method] = {'caseCount': len(cases), 'completeCount': len(good), 'noTimelyCompleteCount': len(cases)-len(good),
            'referenceOptimalMatchCount': sum(g == 0 for g in gaps), 'belowReferenceCount': sum(g < 0 for g in gaps),
            'gapTicks': distribution(gaps), 'gapPct': distribution([g*100/c['referenceOptimalMakespan'] for c,g in zip(good,gaps) if c['referenceOptimalMakespan']]),
            'zeroReferenceCount': sum(c['referenceOptimalMakespan'] == 0 for c in good),
            'makespanSum': sum(audits[c['id']][method]['candidateAudit']['makespan'] for c in good),
            'wallTimeMs': distribution([r['wallTimeMs'] for r in all_records]),
            'deadlineOverrunCount': sum(r['wallTimeMs'] > r['budgetMs'] for r in all_records),
            'iterations': distribution([r['iterations'] for r in all_records]), 'statuses': dict(collections.Counter(r['status'] for r in all_records))}
    pairs = [c for c in cases if all(audits[c['id']][m]['eligible'] for m in METHODS)]
    base = [audits[c['id']][METHODS[0]]['candidateAudit']['makespan'] for c in pairs]
    other = [audits[c['id']][METHODS[1]]['candidateAudit']['makespan'] for c in pairs]
    changes = [a-b for a,b in zip(base,other)]
    errors = [{'id': c['id'], 'method': m, 'error': e} for c in cases for m in METHODS for e in c['validationErrors'][m]]
    return {'caseCount': len(cases), 'byMethod': by_method, 'paired': {'caseCount': len(pairs),
        'missingBaselineCount': len(cases)-by_method[METHODS[0]]['completeCount'], 'missingIteratedCount': len(cases)-by_method[METHODS[1]]['completeCount'],
        'betterCount': sum(x > 0 for x in changes), 'tiedCount': sum(x == 0 for x in changes), 'worseCount': sum(x < 0 for x in changes),
        'baselineMakespanSum': sum(base), 'iteratedMakespanSum': sum(other), 'reductionTicks': sum(changes),
        'weightedReductionPct': sum(changes)*100/sum(base) if sum(base) else None, 'zeroBaselineCount': sum(x == 0 for x in base),
        'worseCaseIds': [c['id'] for c,a,b in zip(pairs,base,other) if b > a]}, 'auditErrors': errors,
        'fees': 'not_applicable', 'portModelEquivalent': False}


def differences(actual, expected, path='summary'):
    errors = []
    if isinstance(expected, dict):
        if not isinstance(actual, dict) or set(actual) != set(expected):
            return [path+': object keys differ']
        for key in expected:
            errors.extend(differences(actual[key], expected[key], path+'.'+key))
    elif isinstance(expected, list):
        if not isinstance(actual, list) or len(actual) != len(expected):
            return [path+': list coverage differs']
        for i, value in enumerate(expected):
            errors.extend(differences(actual[i], value, f'{path}[{i}]'))
    elif finite(expected):
        if not finite(actual) or not math.isclose(actual, expected, rel_tol=1e-12, abs_tol=1e-9):
            errors.append(path+': numeric value differs')
    elif type(actual) != type(expected) or actual != expected:
        errors.append(path+': value differs')
    return errors


def review(input_dir):
    input_hashes = {}
    def bound(relative, expected=None):
        path = ROOT/relative
        raw = path.read_bytes()
        digest = sha(raw)
        require(expected is None or digest == expected, f'hash: frozen input changed: {relative}')
        input_hashes[relative] = digest
        return raw
    protocol = json.loads(bound('data/protocol-public-v7.json', PROTOCOL_SHA))
    report = json.loads(bound('data/public-resource-v7.json', REPORT_SHA))
    require(report['protocolHash'] == PROTOCOL_SHA, 'hash: report protocol binding differs')
    require(protocol['methods'] == METHODS and protocol['parameters'] == {'maxIterations':256, 'removeCount':8, 'auditReserveMs':2}, 'settings: frozen method definitions differ')
    require(protocol['budget']['perMethodWarmMs'] == 100 and protocol['seedBase'] == 97001, 'settings: budget/seed differs')
    expected_ids = [f'j30{parameter}_{instance}.sm' for parameter in range(1,49) for instance in range(1,11)]
    require(protocol['caseCount'] == 480 and protocol['caseIds'] == expected_ids, 'coverage: canonical complete public panel')
    require(report['executionState'] == 'complete' and report['sources'] == protocol['sources'] and report['limitations'] == protocol['limitations'], 'provenance: report source/scope mismatch')
    require(set(report['implementationHashes']) == set(protocol['implementationFiles']), 'hash: implementation path coverage differs')
    for path, digest in report['implementationHashes'].items():
        require(not Path(path).is_absolute() and '..' not in Path(path).parts, 'hash: non-relative implementation path')
        bound(path, digest)
        bound(SNAPSHOT+'/'+path, digest)
    manifest = json.loads(bound(SNAPSHOT+'/manifest.json'))
    require(manifest == {'protocolHash':PROTOCOL_SHA, 'implementationHashes':report['implementationHashes'], 'capturedBeforeFirstMethodCall':True}, 'hash: pre-run snapshot manifest differs')
    bound('scripts/review-public-resource-v7.py')
    if (ROOT/'tests/public-resource-review-v7.test.mjs').exists():
        bound('tests/public-resource-review-v7.test.mjs')
    environment = report['environment']
    require(environment['node'] == 'v24.19.0' and environment['platform'] == 'linux' and integer(environment['logicalCPUs']) and environment['logicalCPUs'] > 0, 'runtime: recorded environment differs')
    require(environment['timing'] == 'Warm in-process cooperative per-method budget; imports/parsing/download outside, all construction/search/audit inside', 'runtime: timing scope differs')
    timestamps = [dt.datetime.fromisoformat(value.replace('Z','+00:00')) for value in [protocol['createdAt'], report['startedAt'], report['generatedAt']]]
    require(timestamps == sorted(timestamps), 'runtime: protocol/run chronology differs')
    sources, cache_hashes = {}, {}
    for key, source in protocol['sources'].items():
        require(Path(source['filename']).name == source['filename'] and source['redistributionLicenseEstablished'] is False, 'source: cache basename/license scope differs')
        raw = (input_dir/source['filename']).read_bytes()
        require(len(raw) == source['bytes'] and sha(raw) == source['sha256'], 'source: original cache hash/size differs: '+key)
        sources[key] = raw
        cache_hashes[key] = {'filename':source['filename'], 'bytes':len(raw), 'sha256':sha(raw), 'url':source['url']}
    files = {}
    import io
    with tarfile.open(fileobj=io.BytesIO(sources['archive']), mode='r:gz') as archive:
        for member in archive.getmembers():
            require(member.isfile() and re.fullmatch(r'j30\d+_\d+\.sm', member.name) and member.name not in files, 'source: unexpected/duplicate archive member')
            files[member.name] = archive.extractfile(member).read()
    require(set(files) == set(expected_ids), 'coverage: original archive all 480 cases')
    references = parse_opt(sources['opt'].decode('ascii'))
    require(set(references) == set(expected_ids), 'reference: original OPT full coverage')
    merged = json.loads(sources['merged'])
    require(merged['instance_set'] == 'j30' and merged['summary'] == {'total_instances':480,'num_proven_optimal':480,'num_unproven':0,'is_fully_optimal_set':True}, 'reference: merged official set summary differs')
    joined = {}
    for entry in merged['solutions']:
        name = f"j30{entry['parameter']}_{entry['instance']}.sm"
        require(name not in joined and name in references and entry['is_proven_optimal'] is True and entry['optimal_makespan'] == references[name] and entry['optimal_makespan_file'] == references[name], 'reference: original OPT/merged join differs')
        joined[name] = entry['optimal_makespan']
    require(set(joined) == set(expected_ids), 'reference: merged join coverage')
    cases = report['cases']
    require(isinstance(cases,list) and [c['id'] for c in cases] == expected_ids, 'coverage: result case IDs/order/duplicates')
    all_errors, audits, ledgers = [], {}, []
    for index, case in enumerate(cases):
        name = case['id']
        model = parse_sm(files[name].decode('ascii'), name)
        expected = {'jobIds':model['job_ids'], 'jobCountIncludingDummies':32, 'resourceCount':4, 'sourceHorizon':model['horizon'],
            'sourceProjectFieldsRetained':model['project'], 'referenceOptimalMakespan':references[name],
            'sourceFileSha256':sha(files[name]), 'methodExecutionOrder':METHODS if index%2 == 0 else METHODS[::-1],
            'dataRole':'external-published-known-generated-benchmark', 'timeUnit':'abstract source problem ticks',
            'adaptation':'none: original generic RCPSP resource/precedence model; no truck, warehouse, staging or tariff mapping'}
        for key,value in expected.items():
            if case.get(key) != value:
                all_errors.append(f'{name}.{key}: original source/protocol mismatch')
        require(set(case['policies']) == set(METHODS) and set(case['validationErrors']) == set(METHODS), 'coverage: both policies required')
        audits[name] = {}
        methods_ledger = {}
        for method in METHODS:
            result = case['policies'][method]
            if result.get('method') != method:
                all_errors.append(f'{name}.{method}: method key mismatch')
            audit = audit_policy(model, case['jobIds'], result, references[name], expected_seed=protocol['seedBase']+index)
            audits[name][method] = audit
            all_errors.extend(f'{name}.{method}: {e}' for e in audit['errors'])
            expected_errors = []
            if result.get('complete'):
                if audit['schedule'] is None or not audit['schedule']['valid'] or audit['schedule']['makespan'] != result.get('makespan'):
                    expected_errors.append('Terminal schedule audit differs')
                if audit['schedule'] and audit['schedule']['makespan'] is not None and audit['schedule']['makespan'] < references[name]:
                    expected_errors.append('Below declared official optimum: check model/parser')
            if case['validationErrors'][method] != expected_errors:
                all_errors.append(f'{name}.{method}: reported evaluator errors differ')
            physical = audit['candidateAudit']
            methods_ledger[method] = {'valid':audit['valid'], 'timelyEligible':audit['eligible'],
                'candidateValid':physical['valid'] if physical else None, 'makespan':physical['makespan'] if physical else None,
                'resourcePeaks':physical['resourcePeaks'] if physical else None, 'resourceTickTotals':physical['resourceTickTotals'] if physical else None,
                'wholeCallMs':result['wallTimeMs'], 'internalMs':result['internalWallTimeMs'], 'errors':audit['errors']}
        ledgers.append({'id':name, 'methods':methods_ledger})
    summary = summarize_independent(cases, audits)
    all_errors.extend(differences(report['summary'], summary))
    return {'schemaVersion':'portplan-public-resource-independent-review-v7-1', 'valid':not all_errors,
        'readOnly':True, 'fixture':False, 'solverRuns':0, 'generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
        'inputHashes':input_hashes, 'originalCacheHashes':cache_hashes, 'errors':all_errors,
        'reviewCounts':{'caseCount':480, 'methodResults':960, 'nestedCandidates':sum(audits[c['id']][m]['candidateAudit'] is not None for c in cases for m in METHODS),
            'officialReferencesJoined':len(joined), 'originalJobsPerCase':32, 'originalRenewableResources':4},
        'recomputedSummary':summary, 'resourceLedgers':ledgers,
        'runtimeBinding':{'reportStartedAt':report['startedAt'], 'reportGeneratedAt':report['generatedAt'], 'reportedEnvironment':environment,
            'sourceSnapshotManifest':SNAPSHOT+'/manifest.json', 'capturedBeforeFirstMethodCall':True,
            'clockEvidence':'Hash-bound saved internal and external warm-call clocks, independently checked for consistency and eligibility; no new profiler or solver execution.'},
        'licenseScope':{'researchUseAuthority':protocol['researchUseAuthority'], 'rawSourcesCopied':False, 'rawRedistributionLicenseEstablished':False},
        'limitations':['All 480 PSPLIB J30 instances are publicly known generated benchmarks, not a new private holdout or real orders.',
            'Original project due/tardiness fields are retained source metadata, not RCPSP hard deadlines.',
            'Generic precedence and four continuous renewable-resource intervals do not validate port pickup/return endpoints, staging or fees.',
            'Saved clocks and counters cannot independently prove CPU isolation, unseen intermediate iterations or real-time interruption.',
            'No monetary savings, full ALNS reproduction, SOTA or competition-rank claim.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-dir', type=Path, default=Path('/tmp/portplan-v7-psplib'), help='Original hash-verified research cache; never copied')
    parser.add_argument('--output', type=Path, default=ROOT/'data/public-resource-review-v7.json')
    args = parser.parse_args()
    try:
        result = review(args.input_dir)
    except (ValueError, KeyError, OSError, json.JSONDecodeError, tarfile.TarError) as error:
        result = {'schemaVersion':'portplan-public-resource-independent-review-v7-1', 'valid':False, 'readOnly':True, 'fixture':False, 'solverRuns':0, 'errors':[str(error)]}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    print(json.dumps({key:result[key] for key in ['valid','readOnly','fixture','solverRuns','errors']}, ensure_ascii=False))
    if not result['valid']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
