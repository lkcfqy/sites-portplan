#!/usr/bin/env python3
"""Read-only, posthoc development diagnosis of three immutable V9 loss episodes.

No online policy is rerun. Optional 2000 ms native calls use only reconstructed
current observations and the exact physical prefix. They are not new validation.
"""
from __future__ import annotations

import argparse
import copy
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import select
import subprocess
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = 'portplan-v9-loss-diagnosis-v1'
METHOD = 'adaptiveV9'
BUDGET_MS = 2000
TARGETS = (
    ('v9-stress-new-arrivals-tight-n50-r4', 2, 'adaptiveV8'),
    ('v9-stress-new-arrivals-tight-n50-r4', 3, 'adaptiveV8'),
    ('v9-stress-new-arrivals-tight-n50-r4', 3, 'costPolishV7'),
    ('v9-stress-batch-release-tight-n50-r1', 2, 'costPolishV7'),
)
RELEVANT = (
    'src/adaptive-planner-v9.js', 'src/candidate-delivery-v9.js',
    'src/locked-recovery-v9.js', 'src/adaptive-planner-v8.js',
    'src/cost-recovery-v7.js', 'src/solver-glpk.js',
    'scripts/highs-service-v8.py', 'scripts/certify-v4.py',
    'scripts/review-v5.py', 'scripts/review-v9.py', 'scripts/review-v8.py',
)


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


review = load_module('v9_loss_independent_review', ROOT / 'scripts/review-v9.py')
ledger = review.ledger
require = review.require


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'), allow_nan=False)


def sha_bytes(value):
    return hashlib.sha256(value).hexdigest()


def sha_value(value):
    return sha_bytes(canonical(value).encode())


def digest(path):
    return sha_bytes(Path(path).read_bytes())


def read(path):
    return json.loads(Path(path).read_text())


def source_binding(path):
    path = Path(path).resolve()
    return {'path': str(path.relative_to(ROOT)), 'sha256': digest(path)}


def checked(directory, artifact):
    path = (directory / artifact['path']).resolve()
    require(path.is_relative_to(directory.resolve()), 'Artifact path escapes the formal run')
    require(digest(path) == artifact['sha256'], 'Original artifact SHA differs: ' + artifact['path'])
    return path, read(path)


def dates(rows):
    return sorted(({key: row[key] for key in ('id', *ledger.EVENTS)} for row in rows), key=lambda row: row['id'])


def reconstruct(nominal, events, result):
    day = result['failure']['day']
    require(not result['complete'] and not result['executionHistoryUnavailable'], 'Expected known failed execution')
    fixed = {}
    for entry in result['timeline'][:day]:
        require(entry['status'] == 'executed', 'A failure prefix cannot skip an execution day')
        for event in entry['executedEvents']:
            fixed.setdefault(event['id'], {})[ledger.EVENT_FIELDS[event['event']]] = event['day']
    actual = ledger.realize(nominal, events)
    scenario, observations = ledger.observed_snapshot(nominal, actual, events, day)
    require(result['timeline'][day]['observedEvents'] == observations, 'Reconstructed day observations differ')
    hashed = {'scenario': scenario, 'observedEvents': observations, 'fixedEvents': fixed, 'minEventDay': day}
    recorded = result['timeline'][day]['observationHash']
    require(ledger.checksum(hashed, recorded) == recorded, 'Original public-observation hash differs')
    identity = {'scenario': scenario, 'fixedEvents': fixed, 'minEventDay': day, 'objectiveMode': 'joint'}
    return {'scenario': scenario, 'observedEvents': observations, 'fixedEvents': fixed,
            'minEventDay': day, 'originalObservationHash': recorded,
            'observationHashIndependentlyVerified': True, 'physicalLockCount': sum(map(len, fixed.values())),
            'usesOnlyPublicInformationAvailableAtFailureDay': True, 'modelIdentityHash': sha_value(identity)}


def audit_dates_and_fees(scenario, rows, fixed, day, label):
    audited = ledger.audit_dates(scenario, rows, label, fixed, day)
    boxes = {c['id']: c for c in scenario['containers']}
    fees = [dict(id=row['id'], **ledger.reprice(scenario, boxes[row['id']], row['pickupDay'], row['returnDay'])) for row in rows]
    for row, rebuilt in zip(rows, fees):
        if any(key in row for key in ledger.TOTAL_KEYS):
            for key, value in rebuilt.items():
                if key != 'id':
                    ledger.close(row.get(key), value, label + '/independent row ' + key)
        if 'sizeFt' in row:
            require(row['sizeFt'] == boxes[row['id']]['sizeFt'], label + ': native size differs')
        if 'unloadEndDay' in row:
            require(row['unloadEndDay'] == row['unloadDay'] + boxes[row['id']]['unloadDays'] - 1, label + ': native unloading interval differs')
    return {'valid': True, 'dateCount': len(rows), 'datesSha256': sha_value(dates(rows)),
            'totals': {key: sum(row[key] for row in fees) for key in ledger.TOTAL_KEYS},
            'usage': audited['usage'], 'rowFees': fees,
            'scope': 'independent Python dates, fees, continuous unloading, staging, resource and exact past-lock audit'}


def optional_audit(snapshot, rows, label):
    if not isinstance(rows, list):
        return {'available': False, 'valid': None, 'reason': 'No complete dates were retained at this original receipt'}
    try:
        return {'available': True, **audit_dates_and_fees(snapshot['scenario'], rows, snapshot['fixedEvents'], snapshot['minEventDay'], label)}
    except (ValueError, KeyError, TypeError, IndexError) as error:
        return {'available': True, 'valid': False, 'reason': str(error)}


def divergence(candidate, baseline, failure_day):
    first, first_execution = None, None
    for day in range(min(len(candidate['timeline']), len(baseline['timeline']))):
        a, b = candidate['timeline'][day], baseline['timeline'][day]
        if day < failure_day and a['executedEvents'] != b['executedEvents'] and first_execution is None:
            first_execution = day
        if first is None and a['status'] == b['status'] == 'executed' and dates(a['decisions']) != dates(b['decisions']):
            ad, bd = dates(a['decisions']), dates(b['decisions'])
            amap, bmap = {r['id']: r for r in ad}, {r['id']: r for r in bd}
            first = {'day': day, 'candidateDates': ad, 'baselineDates': bd,
                     'candidateDatesSha256': sha_value(ad), 'baselineDatesSha256': sha_value(bd),
                     'changedContainerCount': sum(amap[i] != bmap[i] for i in amap),
                     'changedEventCount': sum(amap[i][key] != bmap[i][key] for i in amap for key in ledger.EVENTS),
                     'physicalEventsEqualThroughPreviousDay': all(candidate['timeline'][d]['executedEvents'] == baseline['timeline'][d]['executedEvents'] for d in range(day))}
    return {'firstDivergentAcceptedDates': first, 'firstDivergentPhysicalExecutionDayBeforeFailure': first_execution,
            'physicalPrefixesEqualAtCandidateFailure': first_execution is None,
            'interpretation': 'A different initial or prior accepted plan prevents treating whole-path completion differences as a controlled same-prefix recovery experiment.'}


def receipt_evidence(snapshot, trace):
    proof = copy.deepcopy(trace['candidateDelivery'])
    audits = []
    for event in proof['events']:
        rows = event.get('dates') if isinstance(event.get('dates'), list) else event.get('proposedDates')
        audited = optional_audit(snapshot, rows, 'original receipt ' + str(event['sequence']))
        if audited.get('valid') and event.get('incrementalCost') is not None:
            ledger.close(event['incrementalCost'], audited['totals']['incrementalCost'], 'Original gate fee repricing')
        audits.append({'sequence': event['sequence'], 'source': event['source'], 'outcome': event['outcome'],
                       'independentCandidateAudit': audited})
    outcomes = [event['outcome'] for event in proof['events']]
    if 'rejected_late_selection' in outcomes and any(a['independentCandidateAudit'].get('valid') for a in audits):
        mechanism = 'independently_valid_candidate_rejected_at_final_selection_deadline'
        excluded = ['current_public_snapshot_plus_original_prefix_is_mathematically_infeasible',
                    'all_original_candidates_have_invalid_dates_resources_or_locks',
                    'original_accepted_candidate_fee_cannot_be_independently_reconstructed']
        unknown = ['An earlier identical solve or another recovery policy would complete the full future episode',
                   'The complete V9 path would finish under actual future capacities if this late plan were accepted']
    elif 'rejected_late_receipt' in outcomes:
        mechanism = 'milp_return_arrived_after_outer_deadline_without_retained_candidate_dates'
        excluded = ['cache_was_feasible_but_arbitrarily_discarded',
                    'constructor_reported_a_complete_audited_candidate_that_gate_discarded',
                    'parent_whole_episode_5000ms_timeout']
        unknown = ['Original late MILP candidate dates and independent physical/fee validity were not retained',
                   'Whether a different earlier MILP allocation would return a valid candidate within 200ms',
                   'Whether the original failure-day observed model is feasible before the separate offline check']
    else:
        mechanism, excluded, unknown = 'unclassified_retained_receipt_mechanism', [], ['Requires further evidence']
    return {'originalCandidateDelivery': proof, 'originalReceiptIndependentAudits': audits,
            'mechanism': mechanism, 'excludedAlternativeExplanations': excluded, 'stillUnknown': unknown,
            'originalConstructor': copy.deepcopy(trace['stages'].get('locked_constructor')),
            'originalMILP': copy.deepcopy(trace['stages'].get('locked_milp')),
            'originalCacheAudit': copy.deepcopy(trace['stages'].get('cacheAudit')),
            'outerCallWallMs': trace.get('wholeCallWallMs'), 'workerCallWallMs': trace.get('callWallMs'),
            'originalBudgetMs': trace['wholeCallBudgetMs'],
            'gateClockEvidenceScope': 'Recorded original monotonic timestamps, internally consistent; not externally authenticated clocks'}


class NativeService:
    def __init__(self, script):
        self.script = script
        self.artifacts = ROOT / 'artifacts/v9-loss-diagnosis-first'
        self.artifacts.mkdir(parents=True, exist_ok=False)
        environment = {**os.environ, **{name: '1' for name in ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'NUMEXPR_NUM_THREADS')}}
        began = time.perf_counter()
        self.process = subprocess.Popen([sys.executable, str(script)], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                        stderr=subprocess.PIPE, env=environment, start_new_session=True)
        self.ready_wire = self.line(15)
        with (self.artifacts / 'ready.jsonl').open('x') as stream:
            stream.write(self.ready_wire)
        self.ready = json.loads(self.ready_wire)
        require(self.ready.get('type') == 'ready', 'Native service failed readiness')
        self.startup_ms = 1000 * (time.perf_counter() - began)

    def line(self, timeout):
        require(bool(select.select([self.process.stdout], [], [], timeout)[0]), 'Offline native service response timeout')
        line = self.process.stdout.readline()
        require(bool(line), 'Offline native service closed without a response')
        return line.decode()

    def solve(self, identity):
        started = time.perf_counter()
        request = {'id': sha_value(identity), **copy.deepcopy(identity), 'auditReserveMs': 2,
                   'deadlineUnixMs': time.time() * 1000 + BUDGET_MS}
        request_wire = json.dumps(request, ensure_ascii=False, allow_nan=False, separators=(',', ':')) + '\n'
        with (self.artifacts / (request['id'] + '-request.jsonl')).open('x') as stream:
            stream.write(request_wire)
        self.process.stdin.write(request_wire.encode()); self.process.stdin.flush()
        result_wire = self.line(8)
        with (self.artifacts / (request['id'] + '-response.jsonl')).open('x') as stream:
            stream.write(result_wire)
        envelope = json.loads(result_wire)
        elapsed = 1000 * (time.perf_counter() - started)
        require(envelope.get('type') == 'result' and envelope.get('id') == request['id'], 'Native response identity differs')
        result = envelope['result']
        checked = optional_audit({'scenario': identity['scenario'], 'fixedEvents': identity['fixedEvents'],
                                  'minEventDay': identity['minEventDay']}, result.get('rows') if result.get('hasIncumbent') else None, 'offline native')
        if result.get('hasIncumbent'):
            require(checked.get('valid'), 'Native incumbent failed second independent ledger audit')
            ledger.close(result['objectiveCost'], checked['totals']['incrementalCost'], 'Native objective independent repricing')
            if result.get('independentCosts'):
                for field in ledger.TOTAL_KEYS:
                    ledger.close(result['independentCosts'][field], checked['totals'][field], 'Native total ' + field)
        feasible = 'feasible' if checked.get('valid') else 'infeasible' if result.get('provenInfeasible') else 'unknown'
        if elapsed > BUDGET_MS and feasible == 'infeasible':
            feasible = 'unknown'
        return {'identity': identity, 'modelIdentityHash': sha_value(identity), 'declaredCallBudgetMs': BUDGET_MS,
                'budgetScope': 'additional posthoc development-only native call; never original 200ms performance',
                'parentCallElapsedMs': elapsed, 'receivedWithinDiagnosticBudget': elapsed <= BUDGET_MS,
                'rawRequestWire': request_wire, 'rawRequestWireSha256': sha_bytes(request_wire.encode()),
                'rawResponseWire': result_wire, 'rawResponseWireSha256': sha_bytes(result_wire.encode()),
                'rawRequestArtifact': source_binding(self.artifacts / (request['id'] + '-request.jsonl')),
                'rawResponseArtifact': source_binding(self.artifacts / (request['id'] + '-response.jsonl')),
                'rawResult': result, 'independentLedgerAudit': checked, 'feasibility': feasible,
                'proofInterpretation': 'An audited incumbent establishes this observed-prefix model has a feasible schedule. Only timely native infeasible status establishes infeasibility. A timeout without an incumbent remains unknown. No online-policy or full-future completion inference.'}

    def close(self):
        if self.process.poll() is None:
            self.process.stdin.close()
            try:
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                os.killpg(self.process.pid, 9); self.process.wait(timeout=3)
        self.stderr = self.process.stderr.read().decode()


def diagnose(offline_native=False):
    wrapper_path = ROOT / 'data/v9-results.json'
    wrapper = read(wrapper_path)
    run_path = ROOT / wrapper['formalIndex']['path']
    require(digest(run_path) == wrapper['formalIndex']['sha256'], 'Published formal index hash differs')
    index = read(run_path); run = run_path.parent
    require(index['executionState'] == 'complete', 'V9 formal first run is incomplete')
    frozen = (run / index['frozenSource']).resolve()
    manifest_path = frozen / 'manifest.json'; manifest = read(manifest_path)
    require(digest(manifest_path) == wrapper['frozenManifestSha256'], 'Frozen source manifest differs')
    require(index['protocolHash'] == manifest['protocolHash'], 'Original protocol commitment differs')
    relevant = {}
    for filename in RELEVANT:
        path = frozen / 'source' / filename
        require(digest(path) == manifest['implementationHashes'][filename], 'Frozen source changed: ' + filename)
        relevant[filename] = digest(path)
    sources = {str(wrapper_path.relative_to(ROOT)): digest(wrapper_path),
               str(run_path.relative_to(ROOT)): digest(run_path),
               str(manifest_path.relative_to(ROOT)): digest(manifest_path)}
    for filename in ('data/review-v9.json', 'data/bootstrap-review-v9.json'):
        validation = read(ROOT / filename)
        require(validation['valid'] and validation['inputIndexSha256'] == digest(run_path), 'Prior independent review is not bound to this formal run')
        sources[filename] = digest(ROOT / filename)
    expected = {'v9VsV7': {(case, a) for case, a, base in TARGETS if base == 'costPolishV7'},
                'v9VsV8': {(case, a) for case, a, base in TARGETS if base == 'adaptiveV8'}}
    for comparison, wanted in expected.items():
        ids = {f'{case}::repeat-{a}' for case, a in wanted}
        require(set(index['summary']['panels']['stress']['comparisons'][comparison]['completion']['lostEpisodeIds']) == ids,
                'The target completion-loss set differs: ' + comparison)
    cases = {case['id']: case for case in index['cases']}
    episodes, comparisons = {}, []
    for case_id, repetition, baseline in TARGETS:
        case = cases[case_id]
        input_path, source = checked(run, case['inputArtifact']); sources[str(input_path.relative_to(ROOT))] = digest(input_path)
        repeat = case['repeats'][repetition - 1]
        loaded = {}
        for method in (METHOD, baseline):
            artifact_path, envelope = checked(run, repeat['policies'][method]['artifact'])
            require(envelope['caseId'] == case_id and envelope['repeatIndex'] == repetition and envelope['method'] == method, 'Episode envelope identity differs')
            require(envelope['algorithmSeed'] == repeat['algorithmSeed'], 'Original algorithm seed differs')
            sources[str(artifact_path.relative_to(ROOT))] = digest(artifact_path)
            result = envelope['result']
            checked_episode = review.audit_episode(source['nominalScenario'], source['events'], result,
                                                   envelope['episodeId'], 5000, method=method, call_budget=200)
            loaded[method] = (artifact_path, envelope, checked_episode)
        vp, ve, audit = loaded[METHOD]; bp, be, ba = loaded[baseline]
        v, b = ve['result'], be['result']
        require(not v['complete'] and b['complete'], 'Expected candidate completion loss')
        snapshot = reconstruct(source['nominalScenario'], source['events'], v)
        key = ve['episodeId']
        if key not in episodes:
            trace = v['plannerTrace'][snapshot['minEventDay']]
            episodes[key] = {'episodeId': key, 'caseId': case_id, 'repeatIndex': repetition,
                             'algorithmSeed': repeat['algorithmSeed'], 'dataRole': 'posthoc_development_diagnosis_not_new_validation',
                             'originalEpisode': source_binding(vp), 'originalInput': source_binding(input_path),
                             'originalFailure': v['failure'], 'originalEpisodeWallMs': v['wallTimeMs'],
                             'originalIndependentEpisodeAudit': audit, 'failureSnapshot': snapshot,
                             'evidence': receipt_evidence(snapshot, trace)}
        baseline_rows = b['timeline'][snapshot['minEventDay']]['decisions']
        comparisons.append({'id': key + '::vs-' + baseline, 'candidateEpisodeId': key, 'baselineMethod': baseline,
                            'baselineEpisode': source_binding(bp), 'baselineOriginalComplete': True,
                            'baselineIndependentEpisodeAudit': ba, **divergence(v, b, snapshot['minEventDay']),
                            'baselineFailureDayPlanOnCandidateSnapshot': optional_audit(snapshot, baseline_rows, 'baseline on V9 snapshot')})
    models, service = {}, None
    if offline_native:
        service = NativeService(frozen / 'source/scripts/highs-service-v8.py')
        try:
            for episode in episodes.values():
                snapshot = episode['failureSnapshot']
                identity = {key: snapshot[key] for key in ('scenario', 'fixedEvents', 'minEventDay')}
                identity['objectiveMode'] = 'joint'
                key = snapshot['modelIdentityHash']
                if key not in models:
                    print(json.dumps({'posthocModel': len(models) + 1, 'day': snapshot['minEventDay'], 'budgetMs': BUDGET_MS}), file=sys.stderr, flush=True)
                    models[key] = service.solve(identity)
        finally:
            service.close()
    for path, expected_hash in sources.items():
        require(digest(ROOT / path) == expected_hash, 'Diagnosis altered a source artifact: ' + path)
    implementation = {filename: digest(ROOT / filename) for filename in (
        'scripts/diagnose-v9-losses.py', 'scripts/review-v9.py', 'scripts/review-v8.py', 'scripts/review-v5.py')}
    return {'schemaVersion': SCHEMA, 'valid': True, 'generatedAt': datetime.now(timezone.utc).isoformat(),
            'readOnlyOriginalEvidence': True, 'onlinePolicyReruns': 0, 'newHeldOutExperiments': 0,
            'actualHindsightModels': 0, 'sources': sources, 'implementationHashes': implementation,
            'frozenRelevantImplementationHashes': relevant,
            'summary': {'comparisonLossCount': len(comparisons), 'uniqueFailureEpisodeCount': len(episodes),
                        'failureDays': [episode['failureSnapshot']['minEventDay'] for episode in episodes.values()],
                        'mechanisms': {key: sum(e['evidence']['mechanism'] == key for e in episodes.values()) for key in sorted({e['evidence']['mechanism'] for e in episodes.values()})}},
            'comparisonLosses': comparisons, 'episodes': episodes, 'offlineModels': models,
            'offlineNative': {'performed': offline_native, 'uniqueCallCount': len(models), 'requestedEpisodeCount': len(episodes) if offline_native else 0,
                              'declaredCallBudgetMs': BUDGET_MS, 'startupParentWallMs': service.startup_ms if service else None,
                              'rawReadyWire': service.ready_wire if service else None, 'stderr': service.stderr if service else None,
                              'source': source_binding(frozen / 'source/scripts/highs-service-v8.py'),
                              'scope': 'additional offline current-observation-plus-fixed-prefix diagnosis only; no policy reruns, no future realization supplied'},
            'limits': ['Recorded timestamps are internal evidence, not independent authentication of real time.',
                       'Two late-receipt original plans had no retained date proof; a feasible solver label cannot reconstruct them.',
                       'Posthoc feasible model evidence does not prove the original candidate valid or that V9 would finish all future days.',
                       'Different earlier accepted plans and physical prefixes prevent causal attribution of a whole-path loss to recovery alone.',
                       'No original 200ms result, seed, budget, method or first-run archive was changed.']}


def verify(report):
    require(report['schemaVersion'] == SCHEMA and report['valid'], 'Unsupported diagnosis report')
    fresh = diagnose(False)
    for key in ('sources', 'implementationHashes', 'frozenRelevantImplementationHashes', 'summary', 'comparisonLosses', 'episodes'):
        require(report[key] == fresh[key], 'Read-only diagnostic reconstruction differs: ' + key)
    identities = {}
    for episode in report['episodes'].values():
        snapshot = episode['failureSnapshot']
        identity = {key: snapshot[key] for key in ('scenario', 'fixedEvents', 'minEventDay')}
        identity['objectiveMode'] = 'joint'; identities[sha_value(identity)] = identity
    require(report['offlineNative']['uniqueCallCount'] == len(report['offlineModels']) <= 3, 'Offline call count differs')
    for key, model in report['offlineModels'].items():
        require(key in identities and model['identity'] == identities[key], 'Offline model was not the original observed prefix')
        require(sha_value(model['identity']) == model['modelIdentityHash'] == key, 'Offline model hash differs')
        require(model['declaredCallBudgetMs'] == BUDGET_MS, 'Offline budget changed')
        for name in ('Request', 'Response'):
            wire = model['raw' + name + 'Wire']
            require(sha_bytes(wire.encode()) == model['raw' + name + 'WireSha256'], 'Raw native wire hash differs')
        require(json.loads(model['rawResponseWire'])['result'] == model['rawResult'], 'Native raw result differs')
        raw = model['rawResult']
        if raw.get('hasIncumbent'):
            checked = audit_dates_and_fees(model['identity']['scenario'], raw['rows'], model['identity']['fixedEvents'],
                                          model['identity']['minEventDay'], 'verify native')
            require(checked == {k: v for k, v in model['independentLedgerAudit'].items() if k != 'available'}, 'Native independent audit reconstruction differs')
            require(model['feasibility'] == 'feasible', 'Audited native feasibility differs')
            ledger.close(raw['objectiveCost'], checked['totals']['incrementalCost'], 'Verify native objective')
        elif model['feasibility'] == 'infeasible':
            require(raw.get('provenInfeasible') and model['receivedWithinDiagnosticBudget'], 'Unsupported offline infeasibility claim')
        else:
            require(model['feasibility'] == 'unknown', 'A timeout without a candidate must remain unknown')
    return {'valid': True, 'sourceArtifactsUnchanged': True, 'newSolverCalls': 0,
            'comparisonLosses': len(report['comparisonLosses']), 'uniqueFailureEpisodes': len(report['episodes']),
            'offlineModelsRechecked': len(report['offlineModels'])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--output', type=Path)
    source.add_argument('--verify', type=Path)
    parser.add_argument('--offline-native', action='store_true', help='Explicitly run at most three additional 2000ms posthoc native current-prefix calls')
    args = parser.parse_args()
    if args.verify:
        require(not args.offline_native, 'Verification never launches a solver')
        print(json.dumps(verify(read(args.verify)), ensure_ascii=False))
        return
    require(not args.output.exists(), 'Refuse to overwrite an earlier diagnosis')
    report = diagnose(args.offline_native)
    verify(report)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x') as stream:
        json.dump(report, stream, ensure_ascii=False, indent=2, allow_nan=False); stream.write('\n')
    print(json.dumps({'output': str(args.output), 'summary': report['summary'], 'offlineNativeCalls': len(report['offlineModels']),
                      'offlineFeasibility': {key: value['feasibility'] for key, value in report['offlineModels'].items()}}, ensure_ascii=False))


if __name__ == '__main__':
    main()

