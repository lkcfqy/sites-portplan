#!/usr/bin/env python3
"""Build an 18-page Korean V7 draft only from complete, independently checked archives.

Reads evidence and writes four new V7 documents. Never runs a solver, browser,
benchmark, download or earlier material generator; never changes frozen evidence.
All completeness, protocol, source and review guards run before output writes.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
from html import escape
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_SHA = 'bb70fa6938ffbb162347142cbb2788f9ece00ac695a8b8ed5a647cd08aedb96f'
PUBLIC_PROTOCOL_SHA = '8c5370eaf867b167663717b97e6c895b796dbb832b84375ef61ad3a5b4bed364'
ROLLING_SHA = 'a8b0d67f7ff5fbf3b27fe260ab8d9d17be331a9942df37704d8d8365546000c6'
PUBLIC_SHA = '8006575658f320ba0db851af8e6f0251ac9935bb8d72790bf0b9f405594d4dd6'
METHODS = ('dailyReoptV4', 'stableRetainV5', 'lockedRecoveryV6', 'costPolishV7', 'graspBaselineV7')
LABELS = dict(zip(METHODS, ('매일 MILP', '유효 계획 유지', 'V6 잠금 복구', 'V7 비용 다듬기', 'GRASP 적응 기준선')))
PUBLIC_METHODS = ('baselineSerialSGS', 'iteratedSGS')
COMPARISONS = {
    'polishVsLocked': ('lockedRecoveryV6', 'costPolishV7'),
    'polishVsStable': ('stableRetainV5', 'costPolishV7'),
    'graspVsLocked': ('lockedRecoveryV6', 'graspBaselineV7'),
    'polishVsGrasp': ('graspBaselineV7', 'costPolishV7'),
    'lockedVsStable': ('stableRetainV5', 'lockedRecoveryV6'),
    'stableVsDaily': ('dailyReoptV4', 'stableRetainV5'),
}
OFFICIAL = 'https://anchor.changwon.ac.kr/main/menu?gc=Program&do=sinform&spod=s1&program_id=VKoDUNlZwONq&psin_id=VKoDUNlMqh4n'
PNC = 'https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf'
ZIP_NAMES = ('portplan-source.zip', 'portplan-experiments-v6.zip', 'portplan-experiments-v7.zip', 'portplan-public-inputs-v6.zip')
EPS = 1e-6


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def safe_path(relative):
    path = Path(relative)
    require(not path.is_absolute() and '..' not in path.parts, 'Invalid relative evidence path: ' + str(relative))
    return ROOT / path


def load(relative, hashes):
    path = safe_path(relative)
    require(path.is_file(), 'Required completed evidence is missing: ' + relative)
    raw = path.read_bytes()
    hashes[relative] = hashlib.sha256(raw).hexdigest()
    return json.loads(raw)


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def compare(actual, expected, label):
    if finite(actual) and finite(expected):
        require(abs(actual - expected) <= EPS, 'Evidence differs: ' + label)
    elif isinstance(expected, dict):
        require(isinstance(actual, dict) and set(actual) == set(expected), 'Evidence fields differ: ' + label)
        for key, value in expected.items():
            compare(actual[key], value, label + '/' + key)
    elif isinstance(expected, list):
        require(isinstance(actual, list) and len(actual) == len(expected), 'Evidence list differs: ' + label)
        for index, value in enumerate(expected):
            compare(actual[index], value, label + '/' + str(index))
    else:
        require(actual == expected, 'Evidence differs: ' + label)


def complete(result):
    return (result.get('complete') is True and result.get('auditValid') is True
            and result.get('status') in ('feasible', 'optimal') and bool(result.get('rows'))
            and finite(result.get('totalCost')) and finite(result.get('incrementalCost')))


def paired(cases, baseline, candidate):
    pairs = [case for case in cases if complete(case['policies'][baseline]) and complete(case['policies'][candidate])]
    total = lambda method, field: sum(case['policies'][method][field] for case in pairs)
    def optional_sum(method, field, stats=False):
        values = [(case['policies'][method].get('plannerStats', {}) if stats else case['policies'][method]).get(field) for case in pairs]
        return sum(values) if all(finite(value) for value in values) else None
    tb, tc = total(baseline, 'totalCost'), total(candidate, 'totalCost')
    ib, ic = total(baseline, 'incrementalCost'), total(candidate, 'incrementalCost')
    rb, rc = optional_sum(baseline, 'revisionCount'), optional_sum(candidate, 'revisionCount')
    deltas = [case['policies'][baseline]['totalCost'] - case['policies'][candidate]['totalCost'] for case in pairs]
    gained = [case for case in cases if not complete(case['policies'][baseline]) and complete(case['policies'][candidate])]
    result = {'baselineMethod': baseline, 'candidateMethod': candidate, 'caseCount': len(cases), 'pairedCaseCount': len(pairs),
        'missingBaselineCount': sum(not complete(case['policies'][baseline]) for case in cases),
        'missingCandidateCount': sum(not complete(case['policies'][candidate]) for case in cases),
        'baselineTotalKRW': tb, 'candidateTotalKRW': tc, 'totalSavingsKRW': tb - tc,
        'weightedTotalSavingsPct': 100 * (tb - tc) / tb if tb else None,
        'baselineIncrementalKRW': ib, 'candidateIncrementalKRW': ic, 'incrementalSavingsKRW': ib - ic,
        'weightedIncrementalSavingsPct': 100 * (ib - ic) / ib if ib else None,
        'zeroBaselineTotalCount': sum(case['policies'][baseline]['totalCost'] == 0 for case in pairs),
        'zeroBaselineIncrementalCount': sum(case['policies'][baseline]['incrementalCost'] == 0 for case in pairs),
        'positiveSavingsCount': sum(value > EPS for value in deltas), 'tiedCount': sum(abs(value) <= EPS for value in deltas),
        'negativeSavingsCount': sum(value < -EPS for value in deltas), 'worstLossKRW': max([0] + [-value for value in deltas]),
        'baselineRevisionCount': rb, 'candidateRevisionCount': rc,
        'revisionReductionPct': 100 * (rb - rc) / rb if rb not in (None, 0) and rc is not None else None,
        'baselineSolverCalls': optional_sum(baseline, 'solverCalls', True), 'candidateSolverCalls': optional_sum(candidate, 'solverCalls', True),
        'baselineDecisionCalls': optional_sum(baseline, 'decisionCalls', True), 'candidateDecisionCalls': optional_sum(candidate, 'decisionCalls', True),
        'gainedCompletionCaseIds': [case['id'] for case in gained],
        'lostCompletionCaseIds': [case['id'] for case in cases if complete(case['policies'][baseline]) and not complete(case['policies'][candidate])],
        'gainedFromKnownFailureCaseIds': [case['id'] for case in gained if case['policies'][baseline].get('executionHistoryUnavailable') is not True],
        'gainedFromUnavailableHistoryCaseIds': [case['id'] for case in gained if case['policies'][baseline].get('executionHistoryUnavailable') is True],
        'negativeSavingsCaseIds': [case['id'] for case, value in zip(pairs, deltas) if value < -EPS]}
    return result


def check_panel(cases, summary, label):
    require(len(cases) == summary['caseCount'] == 36, label + ': full 36-case panel required')
    require(set(summary['byMethod']) == set(METHODS), label + ': five-method summary required')
    require(set(summary['comparisons']) == set(COMPARISONS), label + ': all six comparisons required')
    for case in cases:
        require(set(case['policies']) == set(METHODS), label + ': omitted policy: ' + case['id'])
        require(sorted(case['methodExecutionOrder']) == sorted(METHODS), label + ': method order missing')
        for result in case['policies'].values():
            require(isinstance(result.get('complete'), bool), label + ': missing completion flag')
            if result['complete']:
                require(complete(result) and len(result['rows']) == case['count'] and result.get('executionHistoryUnavailable') is not True,
                        label + ': partial/unknown result labeled complete')
                require(result.get('episodeCompletedWithinBudget') is True and result.get('outputDeliveredWithinBudget') is True
                        and result.get('endToEndCompletedWithinBudget') is True and result.get('deadlineReached') is False
                        and finite(result.get('receiptValidatedMs')) and result['receiptValidatedMs'] <= 5000,
                        label + ': completion escaped the parent deadline')
                require(result['terminalAudit']['engine']['valid'] is True and not result['terminalAudit']['independentErrors'],
                        label + ': complete terminal audit missing')
            else:
                require(result.get('totalCost') is None and result.get('incrementalCost') is None and result.get('rows') == [],
                        label + ': incomplete full costs/rows must remain unavailable')
            if result.get('executionHistoryUnavailable') is True:
                require(result.get('revisionCount') is None and all(result.get('plannerStats', {}).get(key) is None for key in
                        ('decisionCalls', 'solverCalls', 'constructorCalls', 'reusedPlans', 'replannedDueToInvalid', 'planningWallMs')),
                        label + ': unknown history cannot become zero counters')
    for method in METHODS:
        item, results = summary['byMethod'][method], [case['policies'][method] for case in cases]
        expected = {'caseCount': len(cases), 'completeCount': sum(complete(result) for result in results),
                    'failureCount': sum(not complete(result) for result in results),
                    'executionHistoryUnavailableCount': sum(result.get('executionHistoryUnavailable') is True for result in results),
                    'knownExecutionFailureCount': sum(not complete(result) and result.get('executionHistoryUnavailable') is not True for result in results),
                    'hardDeadlineCount': sum(bool(result.get('deadlineReached')) for result in results),
                    'statuses': dict(Counter(result['status'] for result in results))}
        for key, value in expected.items():
            compare(item[key], value, label + '/' + method + '/' + key)
    for key, methods in COMPARISONS.items():
        expected = paired(cases, *methods)
        for field, value in expected.items():
            compare(summary['comparisons'][key][field], value, label + '/' + key + '/' + field)
    require(set(summary['byScale']) == {'24', '50', '100'}, label + ': missing scale segment')
    for scale, item in summary['byScale'].items():
        selected = [case for case in cases if case['count'] == int(scale)]
        compare(item, {'caseCount': len(selected), 'completeCounts': {method: sum(complete(case['policies'][method]) for case in selected) for method in METHODS}}, label + '/scale/' + scale)
    require(len(summary['initialEquality']['pairs']) == 10, label + ': all initial pairs required')
    for key, counts in summary['initialEquality']['pairs'].items():
        values = [case['initialComparison']['pairs'][key] for case in cases]
        expected = {'evaluatedCaseCount': sum(value['evaluated'] for value in values),
                    'equalCaseCount': sum(value['evaluated'] and value['decisionsEqual'] is True for value in values),
                    'differentCaseCount': sum(value['evaluated'] and value['decisionsEqual'] is False for value in values),
                    'unavailableCaseCount': sum(not value['evaluated'] for value in values)}
        compare(counts, expected, label + '/initial/' + key)


def check_snapshot(relative, archive, protocol_hash, flag, hashes):
    snapshot = load(relative + '/manifest.json', hashes)
    require(snapshot.get(flag) is True and snapshot['protocolHash'] == protocol_hash, 'Snapshot was not captured before the declared run')
    compare(snapshot['implementationHashes'], archive['implementationHashes'], 'Snapshot/source archive binding')
    for path, expected in snapshot['implementationHashes'].items():
        file = safe_path(relative + '/' + path)
        require(file.is_file() and digest(file) == expected, 'Frozen source byte mismatch: ' + path)
    return snapshot


def check_review(relative, target, hashes):
    review = load(relative, hashes)
    require(review.get('valid') is True and review.get('fixture') is not True, 'Current complete independent review is required: ' + relative)
    inputs = review.get('inputHashes')
    require(isinstance(inputs, dict) and inputs.get(target) == hashes[target], 'Review is not bound to current archive: ' + relative)
    for path, expected in inputs.items():
        file = safe_path(path)
        require(file.is_file() and digest(file) == expected, 'Review input bytes changed: ' + path)
    return review


def summary(values):
    ordered = sorted(value for value in values if finite(value))
    count = len(ordered)
    return {'count': count, 'sum': sum(ordered), 'mean': sum(ordered) / count if count else None,
            'median': (ordered[count // 2] if count % 2 else (ordered[count // 2 - 1] + ordered[count // 2]) / 2) if count else None,
            'p95': ordered[math.ceil(.95 * count) - 1] if count else None, 'max': ordered[-1] if count else None,
            'minimum': ordered[0] if count else None, 'maximum': ordered[-1] if count else None}


def check_public(protocol, report):
    require(report['executionState'] == 'complete' and report['protocolHash'] == PUBLIC_PROTOCOL_SHA, 'Public RCPSP experiment is not complete/bound')
    compare(report['sources'], protocol['sources'], 'Original public input declarations')
    require(tuple(protocol['methods']) == PUBLIC_METHODS and protocol['budget']['perMethodWarmMs'] == 100, 'Public method/budget changed')
    cases = report['cases']
    compare([case['id'] for case in cases], protocol['caseIds'], 'Full 480 public coverage/order')
    require(len(cases) == 480 and report['summary']['caseCount'] == 480, 'All 480 public instances required')
    require(set(report['summary']['byMethod']) == set(PUBLIC_METHODS) and not report['summary']['auditErrors'], 'Public summary incomplete/invalid')
    for case in cases:
        require(set(case['policies']) == set(PUBLIC_METHODS) and case['jobCountIncludingDummies'] == 32 and case['resourceCount'] == 4,
                'Original public job/resource panel changed')
        for method in PUBLIC_METHODS:
            result = case['policies'][method]
            require(isinstance(result.get('complete'), bool) and not case['validationErrors'][method], 'Public terminal validation differs')
            if result['complete']:
                require(result['audit']['valid'] is True and len(result['starts']) == 32 and finite(result['makespan'])
                        and result['makespan'] >= case['referenceOptimalMakespan'] and result['wallTimeMs'] <= 100,
                        'Public complete schedule violates bounds/budget')
            else:
                require(result.get('makespan') is None and result.get('starts') is None, 'Late/failed public result has a complete objective')
    for method in PUBLIC_METHODS:
        selected = [case for case in cases if case['policies'][method]['complete']]
        gaps = [case['policies'][method]['makespan'] - case['referenceOptimalMakespan'] for case in selected]
        item = report['summary']['byMethod'][method]
        expected = {'caseCount': 480, 'completeCount': len(selected), 'noTimelyCompleteCount': 480 - len(selected),
                    'referenceOptimalMatchCount': sum(gap == 0 for gap in gaps), 'belowReferenceCount': sum(gap < 0 for gap in gaps),
                    'makespanSum': sum(case['policies'][method]['makespan'] for case in selected)}
        for field, value in expected.items():
            compare(item[field], value, 'Public summary/' + method + '/' + field)
        for field in ('gapTicks', 'gapPct'):
            values = gaps if field == 'gapTicks' else [gap * 100 / case['referenceOptimalMakespan'] for case, gap in zip(selected, gaps) if case['referenceOptimalMakespan']]
            # Producer's finite summary shape is part of the fixed archive schema.
            recomputed = summary(values)
            for key, value in item[field].items():
                compare(value, recomputed[key], 'Public gap/' + method + '/' + field + '/' + key)
    pairs = [case for case in cases if all(case['policies'][method]['complete'] for method in PUBLIC_METHODS)]
    changes = [case['policies']['baselineSerialSGS']['makespan'] - case['policies']['iteratedSGS']['makespan'] for case in pairs]
    baseline = sum(case['policies']['baselineSerialSGS']['makespan'] for case in pairs)
    expected = {'caseCount': len(pairs), 'missingBaselineCount': sum(not case['policies']['baselineSerialSGS']['complete'] for case in cases),
                'missingIteratedCount': sum(not case['policies']['iteratedSGS']['complete'] for case in cases),
                'betterCount': sum(value > 0 for value in changes), 'tiedCount': sum(value == 0 for value in changes), 'worseCount': sum(value < 0 for value in changes),
                'baselineMakespanSum': baseline, 'iteratedMakespanSum': baseline - sum(changes), 'reductionTicks': sum(changes),
                'weightedReductionPct': 100 * sum(changes) / baseline if baseline else None,
                'zeroBaselineCount': sum(case['policies']['baselineSerialSGS']['makespan'] == 0 for case in pairs),
                'worseCaseIds': [case['id'] for case in pairs if case['policies']['iteratedSGS']['makespan'] > case['policies']['baselineSerialSGS']['makespan']]}
    compare(report['summary']['paired'], expected, 'Public paired outcomes')


def evidence():
    hashes = {}
    protocol = load('data/protocol-v7.json', hashes)
    public_protocol = load('data/protocol-public-v7.json', hashes)
    require(hashes['data/protocol-v7.json'] == PROTOCOL_SHA and hashes['data/protocol-public-v7.json'] == PUBLIC_PROTOCOL_SHA, 'Frozen protocol bytes changed')
    require(tuple(protocol['methods']) == METHODS and protocol['budget']['hardWallMs'] == 5000, 'Synthetic frozen method/clock changed')
    rolling = load('data/rolling-v7.json', hashes)
    require(hashes['data/rolling-v7.json'] == ROLLING_SHA and rolling['executionState'] == 'complete' and rolling['protocolHash'] == PROTOCOL_SHA, 'Formal V7 archive is incomplete or differs from its first-run bytes; no pending or fabricated scores allowed')
    compare(rolling['protocol'], protocol, 'Embedded synthetic protocol')
    primary, controls = rolling['cases'], rolling['developmentControls']['cases']
    compare([case['id'] for case in primary], [case['id'] for case in protocol['primaryCases']], 'Prospective frozen case order')
    require(len(primary) == len(controls) == 36, 'Complete primary/development coverage required')
    for case, fixed in zip(primary, protocol['primaryCases']):
        require(case['dataRole'] == 'held-out-primary', 'Primary data role changed')
        require(set(fixed).issubset(case), 'Primary frozen metadata omitted')
        for key, value in fixed.items():
            compare(case[key], value, case['id'] + '/fixed/' + key)
    check_panel(primary, rolling['summary'], 'primary')
    check_panel(controls, rolling['developmentControls']['summary'], 'development')
    snapshot = check_snapshot('vendor/experiments/v7-first-run-source', rolling, PROTOCOL_SHA, 'capturedBeforePrimaryGeneration', hashes)
    declaration = snapshot['developmentInputBundle']
    compare(rolling['developmentInputBundle'], declaration, 'Development archive/snapshot declaration')
    spec = protocol['developmentControls']
    require(declaration['path'] == spec['bundlePath'], 'Development bundle path differs')
    bundle_relative = 'vendor/experiments/v7-first-run-source/' + declaration['path']
    bundle = load(bundle_relative, hashes)
    require(hashes[bundle_relative] == declaration['sha256'], 'Frozen development input-only bundle bytes changed')
    if safe_path(declaration['path']).is_file():
        require(digest(safe_path(declaration['path'])) == declaration['sha256'], 'Optional working development bundle differs from frozen original')
    require(bundle['protocolHash'] == PROTOCOL_SHA, 'Development bundle protocol differs')
    compare([case['id'] for case in controls], [identifier + spec['suffix'] for identifier in spec['caseIds']], 'All old development case IDs')
    for case, original in zip(controls, bundle['cases']):
        for key in ('id', 'referenceCaseId', 'referenceArchive', 'referenceArchiveSha256', 'nominalScenario', 'events'):
            compare(case[key], original[key], 'Development exact input/' + key)
    public = load('data/public-resource-v7.json', hashes)
    require(hashes['data/public-resource-v7.json'] == PUBLIC_SHA, 'Public first-run archive bytes differ')
    check_public(public_protocol, public)
    check_snapshot('vendor/experiments/public-v7-first-run-source', public, PUBLIC_PROTOCOL_SHA, 'capturedBeforeFirstMethodCall', hashes)
    ledger = load('data/port-ledger-v7.json', hashes)
    require(ledger.get('valid') is True and ledger.get('fixture') is False, 'Actual native public ledger audit required')
    ls = ledger['summary']
    require(ls['nativeTypedOccurrences'] == ls['globalEventRows'] == 6989 and ls['duplicateGlobalEventIdExtraRows'] == 39
            and ls['assignmentVisits'] == 489 and ls['visitCategories'] == {'complete_ordered_observation': 454, 'incomplete_observation': 35}
            and ls['solverRuns'] == ls['feeEstimates'] == ls['syntheticBusinessFieldsAdded'] == 0, 'Native public ledger scope/counts differ')
    source = ledger['source']
    require(digest(safe_path(source['file'])) == source['sha256'], 'Native public SQLite source changed')
    hashes[source['file']] = source['sha256']
    reviews = [check_review('data/rolling-review-v7.json', 'data/rolling-v7.json', hashes),
               check_review('data/public-resource-review-v7.json', 'data/public-resource-v7.json', hashes),
               check_review('data/port-ledger-review-v7.json', 'data/port-ledger-v7.json', hashes)]
    compare(reviews[0]['primaryRecomputedSummary'], rolling['summary'], 'Independent rolling primary summary')
    compare(reviews[0]['developmentRecomputedSummary'], rolling['developmentControls']['summary'], 'Independent rolling development summary')
    methods = load('data/public/v7-external-methods/manifest.json', hashes)
    for item in methods['artifacts']:
        require(digest(safe_path('data/public/v7-external-methods/' + item['path'])) == item['sha256'], 'Licensed reference source bytes changed')
    load('data/public/v7-validation/manifest.json', hashes)
    return protocol, rolling, public_protocol, public, ledger, reviews, hashes


def num(value):
    return 'unknown' if value is None else f'{value:,.1f}' if isinstance(value, float) else f'{value:,}'


def money(value):
    return 'null' if value is None else ('−' if value < 0 else '') + f'₩{abs(value):,.0f}'


def percent(value, digits=2):
    return 'null (0/unknown 분모)' if value is None else f'{value:.{digits}f}%'


def fee_delta(item):
    return -item['totalSavingsKRW']


def delta_pct(item, field):
    value = item[field]
    return percent(-value if value is not None else None)


def table(headers, rows):
    return '<table><thead><tr>' + ''.join('<th>' + escape(str(value)) + '</th>' for value in headers) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join('<td>' + escape(str(value)) + '</td>' for value in row) + '</tr>' for row in rows) + '</tbody></table>'


def mt(headers, rows):
    return '\n'.join(['| ' + ' | '.join(headers) + ' |', '| ' + ' | '.join('---' for _ in headers) + ' |'] + ['| ' + ' | '.join(str(value).replace('|', '/') for value in row) + ' |' for row in rows])


def ul(items):
    return '<ul>' + ''.join('<li>' + item + '</li>' for item in items) + '</ul>'


def box(text):
    return '<div class="callout">' + text + '</div>'


def two(left, right):
    return '<div class="two"><div>' + left + '</div><div>' + right + '</div></div>'


def coverage(summary):
    return [[LABELS[method], f"{summary['byMethod'][method]['completeCount']} / 36", summary['byMethod'][method]['knownExecutionFailureCount'],
             summary['byMethod'][method]['executionHistoryUnavailableCount'], num(summary['byMethod'][method]['counters']['solverCalls']['observedSum'])] for method in METHODS]


def fee_rows(summary, compact=False):
    rows = []
    for key, item in summary['comparisons'].items():
        counts = f"{item['positiveSavingsCount']}/{item['tiedCount']}/{item['negativeSavingsCount']}"
        if compact:
            rows.append([key, item['pairedCaseCount'], counts, money(fee_delta(item)), delta_pct(item, 'weightedTotalSavingsPct'), delta_pct(item, 'weightedIncrementalSavingsPct')])
        else:
            rows.append([key, item['pairedCaseCount'], counts, money(fee_delta(item)), money(item['baselineTotalKRW']), money(item['baselineIncrementalKRW']),
                         delta_pct(item, 'weightedTotalSavingsPct'), delta_pct(item, 'weightedIncrementalSavingsPct'), f"{item['zeroBaselineTotalCount']}/{item['zeroBaselineIncrementalCount']}"])
    return rows


def initial_rows(summary):
    return [[key, value['evaluatedCaseCount'], value['equalCaseCount'], value['differentCaseCount'], value['unavailableCaseCount']] for key, value in summary['initialEquality']['pairs'].items()]


def runtime_rows(summary):
    return [[LABELS[method], num(summary['byMethod'][method]['wallTimeMs']['median']), num(summary['byMethod'][method]['wallTimeMs']['p95']),
             num(summary['byMethod'][method]['callWallMs']['max']), summary['byMethod'][method]['hardDeadlineCount']] for method in METHODS]


def outcome_rows(summary):
    return [[key, f"{value['missingBaselineCount']}/{value['missingCandidateCount']}", money(value['worstLossKRW']),
             f"{len(value['gainedCompletionCaseIds'])}/{len(value['lostCompletionCaseIds'])}", f"{value['baselineRevisionCount']}→{value['candidateRevisionCount']}"] for key, value in summary['comparisons'].items()]


def prefix_info(case, baseline, candidate):
    left, right = case['policies'][baseline], case['policies'][candidate]
    if left.get('executionHistoryUnavailable') is True or right.get('executionHistoryUnavailable') is True:
        return None
    fields = ('decisions', 'executedEvents', 'state', 'observationHash')
    common = -1
    for a, b in zip(left['timeline'], right['timeline']):
        if not all(key in a and key in b for key in fields) or a['day'] != b['day']:
            return None
        if all(a[key] == b[key] for key in fields):
            common = a['day']
        else:
            return {'commonThroughDay': common, 'firstDifferenceDay': a['day'],
                    'firstDifferenceObservationEqual': a['observationHash'] == b['observationHash']}
    return {'commonThroughDay': common, 'firstDifferenceDay': None, 'firstDifferenceObservationEqual': None}


def scope_rows(cases, baseline, candidate):
    key = '__'.join(sorted((baseline, candidate), key=METHODS.index))
    rows = []
    for case in cases:
        if not complete(case['policies'][baseline]) and complete(case['policies'][candidate]):
            result = case['policies'][baseline]
            initial = case['initialComparison']['pairs'][key]
            if result.get('executionHistoryUnavailable') is True:
                scope = '기준 이력 미확보: 실제 실패/실행 없음 판단 불가'
            elif result.get('failure', {}).get('day') == 0:
                scope = '기준 D0 무후보: 초기 완전 계획 확보'
            elif initial['evaluated'] and initial['decisionsEqual'] is False:
                scope = '초기 날짜 다름: 같은 실행 prefix 효과 아님'
            elif initial['evaluated'] and initial['decisionsEqual'] is True:
                if result.get('failure', {}).get('kind') == 'no_complete_plan':
                    prefix = prefix_info(case, baseline, candidate)
                    if prefix and prefix['firstDifferenceDay'] is not None:
                        scope = f"D+0…{prefix['commonThroughDay']} 같은 날짜·물리 이력·state·관측; D+{prefix['firstDifferenceDay']} 분기 후 기준 D+{result['failure']['day']} 완전 계획 미확보. 실패일 같은 prefix 회복·불가능 증명은 아님"
                    else:
                        scope = f"초기 날짜·정보 동일; 기준 D+{result['failure']['day']} 완전 잠금 후보 미확보. 이후 같은 prefix 효과·불가능 증명은 아님"
                else:
                    scope = '초기 날짜·정보 동일: 이후 분기까지 같은 이력인지 별도 검토'
            else:
                scope = '초기 비교 불가: 동일 이력 효과 미확인'
            rows.append([case['id'], result.get('failure', {}).get('day'), initial['decisionsEqual'], scope])
    return rows


CSS = '''
*{box-sizing:border-box}body{margin:0;background:#e7ecee;color:#153b43;font-family:"Noto Sans CJK KR","Noto Sans KR","Malgun Gothic",Arial,sans-serif;word-break:keep-all}.slide{width:1280px;height:720px;position:relative;margin:24px auto;padding:38px 58px 62px;background:#fbfcfa;box-shadow:0 10px 30px #18313c16;break-after:page;overflow:hidden}.slide:first-of-type{background:#123941;color:#f6faf6}.kicker{font-size:15px;letter-spacing:1.5px;font-weight:700;color:#207b6c}.slide:first-of-type .kicker{color:#8bd9c3}h1{font-size:45px;line-height:1.18;letter-spacing:-1.2px;margin:13px 0 23px}.slide:first-of-type h1{font-size:55px}h2{font-size:24px;color:#207b6c;margin:8px 0 12px}.body{font-size:22px;line-height:1.42}.body p{margin:10px 0 16px}.two{display:grid;grid-template-columns:1fr 1fr;gap:30px}.two li{font-size:22px}ul{padding-left:24px;margin:10px 0}li{margin:9px 0}.callout{border-left:5px solid #c99535;background:#f6f0dc;color:#153b43;padding:12px 16px;font-size:19px;margin-top:16px}.formula{background:#e7f1ec;color:#153b43;padding:17px;font-family:Arial,sans-serif;font-size:25px}.small{font-size:18px;color:#5a7378}.slide:first-of-type .small{color:#c1dcd8}table{border-collapse:collapse;width:100%;font-size:18px;line-height:1.3;margin:5px 0 15px}th,td{text-align:left;padding:11px 10px;border-bottom:1px solid #cdded7;vertical-align:top}th{background:#e7f1ec;color:#287562;font-size:16px}td:first-child{font-weight:600}.dense table{font-size:16px}.dense th,.dense td{padding:8px}.pills{display:flex;gap:15px;margin:25px 0}.pills span{padding:9px 17px;border:1px solid #659b91;border-radius:25px;font-size:21px}footer{position:absolute;left:58px;right:58px;bottom:18px;display:flex;gap:20px;justify-content:space-between;border-top:1px solid #c4d7d0;padding-top:9px;font-size:13px;color:#526e72;line-height:1.3}footer span:first-child{max-width:1030px}.slide:first-of-type footer{color:#b7d5ce;border-color:#507970}.toolbar{width:1280px;margin:16px auto;font-size:17px}.toolbar button{font:inherit;border:0;background:#163b43;color:white;padding:9px 16px;border-radius:5px;margin-right:16px}a{color:inherit}@page{size:1280px 720px;margin:0}@media print{.toolbar{display:none}body{background:white}.slide{margin:0;box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact}.slide:last-of-type{break-after:auto}}@media screen and (max-width:1280px){body{min-width:1280px}}
'''


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--require-results', action='store_true', help='Complete actual evidence is always required; explicit release intent')
    parser.parse_args()
    protocol, rolling, public_protocol, public, ledger, reviews, hashes = evidence()
    generated = datetime.now(timezone.utc).isoformat(timespec='seconds')
    s, ds, ps, ls = rolling['summary'], rolling['developmentControls']['summary'], public['summary'], ledger['summary']
    primary, controls = rolling['cases'], rolling['developmentControls']['cases']
    polish = s['comparisons']['polishVsLocked']
    stable_cost = s['comparisons']['polishVsStable']
    grasp = s['comparisons']['polishVsGrasp']
    pair_public = ps['paired']
    slides = []
    def slide(kicker, title, body, notes, footer='공개 근거·합성 범위·실패를 함께 보존 / AI 작성 초안'):
        slides.append({'kicker': kicker, 'title': title, 'body': body, 'notes': notes, 'footer': footer})

    slide('01 / PORTPLAN V7', '완주한 계획의 비용을 다듬고,<br>외부 방법·공개 원자료로 따로 검증합니다.',
          '<div class="pills"><span>새 합성 36 × 5정책</span><span>공개 RCPSP 480</span><span>실제 기록 감사</span></div>' +
          '<p>실행 이력을 잠근 날짜 계획 · 공개 요율 · 짧은 계산 예산</p>' + box(f"V6 대비 완전 {polish['pairedCaseCount']}쌍: 총요금 Δ {money(fee_delta(polish))}, 추가요금 Δ {delta_pct(polish, 'weightedIncrementalSavingsPct')}. 합성 모형 결과이며 실현 사업 절감액이 아닙니다."),
          f"V7 adds same-snapshot fee-directed polishing and a source-adapted classical GRASP baseline. New synthetic coverage is shown separately from 36 old development inputs, 480 known generated RCPSP cases, and a native grain-port event audit. Against V6, {polish['pairedCaseCount']} complete pairs have a total fee delta of {money(fee_delta(polish))}; this is a model comparison, not realized savings.")
    slide('02 / FEE MECHANISM', '하루 차이가 요금 구간을 바꿉니다.',
          '<div class="formula">20ft · 14일 ₩318,500 → 15일 ₩500,500<br>공개 PNC 소급 산례 차이: ₩182,000</div>' +
          two('<h2>결정</h2>' + ul(['언제 반출할지', '창고 적출을 언제 시작할지', '언제 공컨테이너를 반납할지']),
              '<h2>함께 지킬 제약</h2>' + ul(['반출·반납의 일별 운송 횟수', '창고 적출의 연속 점유', '반출→반납의 staging 점유'])) +
          box('공개 표준 요율 산례입니다. 실제 invoice, 개별 계약, 세금·작업비·경로비가 모두 검증된 것은 아닙니다.'),
          'The official 2026 PNC table creates a retroactive tariff cliff: this illustrative 20ft example differs by KRW182,000. Joint date planning includes storage and demurrage/detention model charges. Carrier terms are explicit model interpretations; private contracts and realized invoices are unavailable.', '2026 PNC 공식 요율 PDF / 계산 산례, 최적화 절감 사례 아님')
    slide('03 / EXECUTION MODEL', '이미 한 행동을 미래 계획이<br>다시 쓰지 않도록 고정합니다.',
          '<div class="formula">pickup p → unload start u → return r<br>운송: p/r endpoint · warehouse: 연속 적출 · staging: [p,r)</div>' +
          two('<h2>현재 의사결정 정보</h2>' + ul(['모든 주문은 처음부터 알려짐', '당일까지 관측된 용량과 실행 이력', '미래는 명목 용량만 사용']),
              '<h2>보존할 이력</h2>' + ul(['실행된 반출·적출 시작·반납', '진행 중인 적출의 연속 점유', '미실행 날짜만 새 후보로 이동'])) +
          box('충격의 미래 발생·지속기간은 planner API에 주지 않습니다. 신규 주문이 매일 들어오는 실증 모델은 아닙니다.'),
          'Actions already executed and ongoing unloading occupancy are immutable. The simulator alone holds private shock duration. Orders are known at episode start; the new-arrivals generator label concerns release dates, not later information arrival. An incomplete static plan is not successful physical execution.')
    slide('04 / COST POLISH', 'V6 복구 후보가 일찍 완성되면,<br>남은 구성 시간에서 비용을 다듬습니다.',
          ul(['같은 V6 초기 구성 phase와 남은 MILP 예산 유지', '현재 snapshot의 완전 잠금 후보만 개선 대상으로 사용', '단일·쌍 날짜 이동 후 요금과 자원을 다시 검산', '현재 joint fee가 엄격히 낮은 이동만 수락', '유효한 기존 캐시는 그대로 유지']) +
          box('같은 현재 snapshot에서 비증가를 검사합니다. 미래 실제 episode의 총비용·완주·안정성 우월을 보장하지 않습니다.'),
          'Polishing occurs inside the original approximately80ms constructor phase only if a complete locked seed arrives early. Fixed bounds include two passes, bounded single targets and pair checks. Independent review reprices before/after dates at the same current snapshot and verifies locks. This endpoint property is not a dominance guarantee along unknown future shocks.')
    slide('05 / EXTERNAL METHOD', '고전 GRASP를 같은 PortPlan 모델에<br>명시적으로 적응했습니다.',
          '<div class="formula">RCL = {e : g(e) ≤ gmin + α(gmax−gmin)}<br>α=0.25 · 자원 영향 가중 0.15 · 다중 구성 + 국소 개선</div>' +
          ul(['현재 합법 날짜 trip의 비용·자원 점수로 RCL 구성', '무작위 구성과 제한 first-improvement 단일/쌍 이동', '최대 128 구성 시도, MILP 없이 완전 후보만 보존', 'Resende–Ribeiro 공개 보고서 및 MIT 참고 코드 귀속']) +
          box('문헌의 고전 framework를 적응한 기준선입니다. 원 항만 논문 재현·원 ALNS·SOTA·최초 방법이 아닙니다.'),
          'Classical GRASP is a mature multistart construction/local-search framework. Date triples, composite fee/resource score, locks and neighborhoods are our problem adaptation. The final 128-attempt cap followed an old small development probe before prospective generation; no new-seed result informed it. The archived MIT TSP reference uses the opposite alpha convention, so PortPlan follows the disclosed classical formula.', 'docs/external-methods-v7.md · docs/grasp-adaptation-v7.md · 고정 프로토콜')
    slide('06 / FROZEN PROTOCOL', '새 36입력과 기존 36입력을<br>분리한 5정책 실험입니다.',
          table(['패널', '입력', '방법/예산', '해석'], [['주 평가', '새 seed 91001…91036', '5정책 · cold episode 5,000ms', '3기전×2용량×3규모×2반복'], ['개발 대조', '기존 V6 전체 36개 동일 입력', '같은 5정책 · 동일 부모 한도', '새 holdout·독립 표본 아님'], ['외부 RCPSP', '원 PSPLIB j30 480개', '2방법 · warm 100ms', '별도 공개 생성 benchmark']]) +
          box('최초 입력 생성 전 로컬 protocol/source snapshot 고정. 외부 사전등록이 아니며 결과를 보고 seed나 정책을 바꾸지 않습니다.'),
          'All 180 new episodes precede all 180 old development episodes. One cold child runs at a time, with rotating five-method order. The hard 5000ms parent clock includes imports, every decision, child audit, IPC receipt and parent terminal validation. The PSPLIB clock is warm and in-process and cannot be pooled with this one.')
    slide('07 / PRIMARY COVERAGE', '먼저 전체 36개에서<br>완주와 이력 미확보를 확인합니다.',
          table(['정책', '완주/전체', '알려진 실패', '이력 미확보', '관측 solver 호출'], coverage(s)) +
          box(f"완전 terminal {s['terminalAudit']['completeEpisodes']}개 · 기록된 audit 실패 {s['terminalAudit']['failedAudits']}개. 미완료 요금은 null입니다."),
          'Coverage is evaluated before fees. A killed or undelivered child has unavailable physical history and null calls/revisions, not zero events or demonstrated operational failure. All five methods and every primary case remain in the archive. SolverCalls counts planner callbacks and is not necessarily the number of native lexicographic solver passes.')
    slide('08 / PRIMARY FEES', '완전한 같은 사례의 쌍에서만<br>비용을 비교합니다.',
          '<div class="dense">' + table(['후보 대 기준', '쌍', '낮음/동일/높음', '총요금 Δ', '총 Δ%', '추가 Δ%'], fee_rows(s, True)) + '</div>' +
          box('Δ = 후보−기준. %는 해당 쌍의 기준 합계로 나눕니다. 총요금과 추가요금의 분모가 다르며 0원 분모는 null입니다.'),
          'These are weighted paired deltas, not averages of case percentages and not all-case totals. Each comparison has its own jointly completed denominator. Full KRW total/incremental baselines, zero counts, missing cases and negative case IDs are printed in the Korean report and raw evidence. Positive delta means the candidate is more expensive.')
    slide('09 / ADVERSE OUTCOMES', '낮은 현재 비용이<br>전체 경로 우월을 뜻하지는 않습니다.',
          '<div class="dense">' + table(['비교', '기준/후보 누락', '최악 요금 증가', '얻은/잃은 완주', '날짜 변경'], outcome_rows(s)) + '</div>' +
          box(f"V7 vs 유지: 추가요금 Δ {delta_pct(stable_cost, 'weightedIncrementalSavingsPct')}, 더 비싼 쌍 {stable_cost['negativeSavingsCount']}개, 잃은 완주 {len(stable_cost['lostCompletionCaseIds'])}개. 모든 악화 사례 ID를 보고합니다."),
          'All adverse cases and completion losses remain visible, including a comparison that has only a small or zero paired denominator. Date revisions count changes in unexecuted event dates, not distinct containers, labor cost or physical rescheduling. A same-snapshot nonincrease proof does not prove lower full-path fees.')
    gained_scope = scope_rows(primary, 'lockedRecoveryV6', 'costPolishV7')
    initial = s['initialEquality']['pairs']['lockedRecoveryV6__costPolishV7']
    gain_cases = [case for case in primary if case['id'] in polish['gainedCompletionCaseIds']]
    require(len(gain_cases) == 1 and gain_cases[0]['id'] == 'v7-new-arrivals-tight-n50-r1', 'Frozen sole V7/V6 gain differs')
    compare(prefix_info(gain_cases[0], 'lockedRecoveryV6', 'costPolishV7'),
            {'commonThroughDay': 1, 'firstDifferenceDay': 2, 'firstDifferenceObservationEqual': True}, 'Sole gain causal timeline boundary')
    slide('10 / INITIAL HISTORY', '초기 계획과 정보가 같았는지<br>완주 차이의 범위를 함께 봅니다.',
          table(['V6 ↔ V7 시작 비교', '평가', '같음', '다름', '미평가'], [['완전·검산·관측 hash 일치', initial['evaluatedCaseCount'], initial['equalCaseCount'], initial['differentCaseCount'], initial['unavailableCaseCount']]]) +
          ul([f"V7 추가 완주 {len(polish['gainedCompletionCaseIds'])}개 / 잃은 완주 {len(polish['lostCompletionCaseIds'])}개", '유일한 증가: tight / new-arrivals / 50상자 / r1', 'D0·D1 같은 날짜·실행·state → D2 실행 경로 분기', 'D3 V6 완전 잠금 계획 미확보, V7은 최종 완주']) +
          box('D3의 동일 실행 prefix를 구한 사례나 불가능 증명이 아닙니다. 빈·부분·미검산 초기 계획은 같은 계획으로 세지 않습니다.'),
          'Initial comparisons require complete audited day-zero schedules and matching observation hashes. The sole primary V7-over-V6 gain is new-arrivals-tight-n50-r1: D0/D1 dates, physical events, state and observation hashes match. They diverge on D2 even under the same observation hash; V6 reports no_complete_plan on D3 while V7 completes. It is not a rescue of the same D3 executed prefix or an infeasibility proof. The five methods have no all-equal initial case.')
    slide('11 / CLOCKS', '공통 강제 한도는 episode 5초입니다.<br>호출별 의미와 실제 시간도 공개합니다.',
          table(['정책', 'episode 중앙 ms', 'p95 ms', '호출 최대 ms', '강제 한도 기록'], runtime_rows(s)) +
          box('V4/V5: solver 내부 0.2초. V6/V7/GRASP: 함수 전체 협력식 200ms. 동일한 강제 호출 한도나 동일 총 CPU라는 주장은 하지 않습니다.'),
          'Only the full cold episode has a common parent-enforced hard budget. Whole-call 200ms targets are cooperative and may overrun; late candidate handling and actual call maxima are preserved. Terminal output is accepted only after parent validation within 5000ms. Process-exit overhead is separately recorded and is not relabeled as timely terminal validation.')
    slide('12 / DEVELOPMENT COVERAGE', '개발에 쓰인 기존 V6 36개는<br>별도의 분모로 유지합니다.',
          table(['정책', '완주/전체', '알려진 실패', '이력 미확보', '관측 solver 호출'], coverage(ds)) +
          box('같은 명목 주문·충격·기존 ID를 frozen input-only bundle로 유지합니다. 주 평가 36개와 합쳐 새 72개 holdout이라고 하지 않습니다.'),
          'All 36 prior V6 inputs are development controls. The compact bundle contains exact original input configurations, nominal scenarios and private simulator shocks, not old result copies. Its hash and original archive reference are bound before primary generation and independently reconstructed. Timing outcomes can differ even on the same inputs.')
    slide('13 / DEVELOPMENT FEES', '개발 대조의 비용 결과도<br>주 평가와 같은 방식으로 남깁니다.',
          '<div class="dense">' + table(['후보 대 기준', '쌍', '낮음/동일/높음', '총요금 Δ', '총 Δ%', '추가 Δ%'], fee_rows(ds, True)) + '</div>' +
          box('이 표는 개발 대조입니다. 음성 결과·0원·미완료를 제외하지 않고 새 주 평가의 성적으로 합산하지 않습니다.'),
          'Development paired fees use the same jointly completed rules, explicit baselines, missing and zero counts. All adverse IDs are in the report. These known inputs cannot establish out-of-sample business performance or select a method after observing the new primary panel.')
    slide('14 / ORIGINAL PUBLIC MODEL', 'PSPLIB 원 RCPSP 정의 그대로<br>공개 자원 배분 부분을 검증합니다.',
          two('<h2>그대로 보존</h2>' + ul(['480개 · 각각 30활동 + 2 dummy', '4개 renewable 자원·원 duration/demand', 'finish-to-start precedence · abstract ticks', '공식 OPT와 merged reference 교차 확인']),
              '<h2>새로 만들지 않음</h2>' + ul(['컨테이너 p/u/r 또는 운송 fleet', '가짜 release·실측 service·port 요금', '가변 staging과 실행 lock의 완전 대응', '기관·실항만·SOTA 인증 주장'])) +
          box('공식 research-use를 확인했습니다. 재분배 라이선스는 미확인이라 원 수치 파일은 ZIP에 넣지 않고 공식 URL·세 SHA로 다운로드 재현합니다.'),
          'PSPLIB J30 comprises publicly known ProGen-generated project instances, not real logistics orders or a new blind holdout. Project due fields are retained but ignored by the original makespan objective; they are not port hard deadlines. Numeric input redistribution is not established; archives stay in download-on-demand caches.')
    public_gap_mean = {method: summary([100 * (case['policies'][method]['makespan'] - case['referenceOptimalMakespan']) / case['referenceOptimalMakespan']
                                      for case in public['cases'] if case['policies'][method]['complete'] and case['referenceOptimalMakespan']])['mean'] for method in PUBLIC_METHODS}
    public_rows = [[method, f"{ps['byMethod'][method]['completeCount']}/480", ps['byMethod'][method]['referenceOptimalMatchCount'],
                    num(public_gap_mean[method]), num(ps['byMethod'][method]['gapPct']['maximum']), ps['byMethod'][method]['deadlineOverrunCount']] for method in PUBLIC_METHODS]
    slide('15 / PUBLIC RESOURCE RESULTS', '공식 최적 makespan 값과<br>우리 방법의 gap을 따로 공개합니다.',
          table(['원 RCPSP 방법', '제때 완전', 'reference 일치', '평균 gap%', '최대 gap%', '100ms 초과'], public_rows) +
          box(f"완전 {pair_public['caseCount']}쌍 · 개선/동일/악화 {pair_public['betterCount']}/{pair_public['tiedCount']}/{pair_public['worseCount']} · 기준 makespan 합 대비 감소 {percent(pair_public['weightedReductionPct'])}. 비용 단위는 없습니다."),
          'The baseline is one stable topological serial SGS pass. IteratedSGS adds at most 256 segment removal/random insertion moves, removes 8 positive-duration jobs and accepts makespan ties. It is inspired by a licensed ALNS example, without adaptive weights/mobile/non-peak/double justification/full ALNS. Warm 100ms includes construction/search/in-method audit; imports/parsing and a post-call evaluator check are outside. Official optima are scoring references, not timed solver baselines.')
    slide('16 / NATIVE PORT LEDGER', '실제 공개 벌크항만 기록은<br>event ID를 넘어 occurrence로 감사했습니다.',
          table(['원 기록', '확인 수', '해석'], [['native event occurrence', f"{ls['nativeTypedOccurrences']:,}", '39개 ID 재사용도 원 행 그대로 보존'], ['assignment 관측 visit', ls['assignmentVisits'], '454 ordered / 35 incomplete'], ['row-ID 단순 join', ls['naiveRawJoinRows'], '중복 association과 충돌 timestamp를 별도 표시'], ['solver / fee / 추가 사업필드', '0 / 0 / 0', '최적화 실험이 아닌 회고적 기록 감사']]) +
          box('중국 곡물·silo pickup 로그입니다. clock span은 적출 service·용량·요금이 아닙니다. 출처의 현장 수집 설명을 독립 인증하지 않았습니다.'),
          'The CC BY 4.0 SQLite log is publisher-described as field-collected grain-port data. Native table/rowid occurrences preserve 6,989 rows, including 39 reused IDs with conflicting timestamps. Assignment windows associate 489 truck visits; 454 are ordered observations and 35 incomplete. These are retrospective windows, not an online information set. Naive timestamps have unknown timezone/calibration; load-to-weigh spans are not measured unload durations.')
    slide('17 / EVIDENCE BOUNDARY', '서로 다른 검증을<br>하나의 실항만 절감 주장으로 합치지 않습니다.',
          table(['증거', '직접 검증하는 것', '아직 검증하지 않은 것'], [['새 합성 36 × 5', '잠금 날짜·모형 요금·전체 실행', '실주문·개별 계약·실현 비용'], ['원 공개 RCPSP 480 × 2', 'precedence·고정 renewable 자원·makespan', '전체 PortPlan fee/staging/rolling 모델'], ['실제 벌크 event ledger', '원 행 identity·association·clock order', '컨테이너 lifecycle·service·용량·fees']]) +
          box('세 별도 Python/SQL 복산은 내부 독립 구현 감사입니다. 외부 전문가 심사·기관 인증·최적성 재증명·입상 확률이 아닙니다.'),
          'Independent here means separate implementations and source arithmetic within this project. It is not external expert review, operational provenance authentication or an optimality certificate. No directly compatible complete real PNC order/release/service/resource/fee history was acquired. This bounded source finding does not claim no such dataset exists worldwide.')
    slide('18 / DELIVERY & CONTRIBUTION', '18쪽 자료·전체 원본·기여 기록을<br>같은 재현 가능한 묶음으로 전달합니다.',
          '<div class="dense">' + table(['ZIP', '역할'], [[ZIP_NAMES[0], '소스·문서·고정 최초 실행 source·라이선스'], [ZIP_NAMES[1], '기존 V6 완전 증거'], [ZIP_NAMES[2], 'V7 전체 원본·공개 검증 결과·projection'], [ZIP_NAMES[3], 'V6 공개 원자료 + V7 허가된 방법/source 원件']]) + '</div>' +
          ul(['같은 portplan/ 루트로 풀기 · first-run 원본 보존', '2026 공식 발표 한도 ≤20쪽; 이 자료는 18쪽 초안', '조사·구현·계산·자료는 AI 수행, 사용자 직접 기여 미확인']) +
          box('참가·AI 허용·본인 창작·이해·자격은 대신 확인하지 않습니다. 등록·연락·대리 서명·발표를 수행하지 않았습니다.'),
          'Extract all four archives into the same parent directory under portplan/. Replay from frozen source into new output paths; deadline outcomes may vary by host/load. The official 2026 page states a ≤20-slide ceiling and a Nov 6 18:00 deadline. Eligibility, registration, AI interpretation and entrant understanding are not established here. The contribution log records AI work without transferring it to the user.')

    require(len(slides) == 18 and len(slides) <= 20, 'Slide ceiling exceeded')
    sections = [f'<section class="slide" id="slide-{i}" aria-label="{i}. {escape(item["title"].replace("<br>", " "))}"><div class="kicker">{item["kicker"]}</div><h1>{item["title"]}</h1><div class="body">{item["body"]}</div><footer><span>{escape(item["footer"])}</span><span>PORTPLAN V7 / {i:02d}</span></footer></section>' for i, item in enumerate(slides, 1)]
    html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PortPlan V7 · Korean research draft</title><style>' + CSS + '</style></head><body><nav class="toolbar"><button onclick="window.print()">PDF 인쇄</button><span>18쪽 · 실제 완결 자료 기반 AI 작성 초안 · 본인 확인 미완료</span></nav>' + '\n'.join(sections) + '</body></html>'
    provenance = mt(['입력 / Evidence input', 'SHA-256'], [[path, '`' + value + '`'] for path, value in hashes.items()])
    headings = ['정책', '완주/전체', '알려진 실패', '이력 미확보', '관측 solver 호출']
    fee_headers = ['비교: 후보−기준', '완전 쌍', '낮음/동일/높음', '총요금 Δ', '기준 총 분모', '기준 추가 분모', '총 Δ%', '추가 Δ%', '0원 총/추가']
    report = ['# PortPlan V7 연구 보고서 초안', '', f'생성 {generated}. 완결된 원자료·독립 복산·해시를 검사한 AI 작성 초안. 발표 18쪽이며 참가/본인 창작 서약이 아니다.', '',
              '## 초록', '', f"새 합성36개에서 다섯 정책의 완주는 " + ' / '.join(LABELS[method] + ' ' + str(s['byMethod'][method]['completeCount']) + '/36' for method in METHODS) +
              f"이다. V7 비용 다듬기는 V6와 완전 {polish['pairedCaseCount']}쌍에서 총요금 Δ={money(fee_delta(polish))}, 추가요금 Δ={delta_pct(polish, 'weightedIncrementalSavingsPct')}, 기준 총 분모 {money(polish['baselineTotalKRW'])}, 추가 분모 {money(polish['baselineIncrementalKRW'])}이다. 유지 정책과 완전 {stable_cost['pairedCaseCount']}쌍에서는 추가요금 Δ={delta_pct(stable_cost, 'weightedIncrementalSavingsPct')}이며 더 비싼 {stable_cost['negativeSavingsCount']}쌍과 {len(stable_cost['lostCompletionCaseIds'])}개 완주 손실이 있다. GRASP와 완전 {grasp['pairedCaseCount']}쌍 결과 및 모든 악화·누락도 보고한다. 공개 RCPSP 480개와 벌크항만 ledger는 별도 검증이며 실항만 절감으로 합산하지 않는다.", '',
              '## 모델·방법·예산', '', '공개 한국 표준 요율과 p/u/r 날짜, 운송 endpoint, 창고 연속 적출, [p,r) staging 모델이다. 과거 실행과 진행 중 적출을 고정한다. 모든 주문은 초기 알려지고 미래 shock/duration은 비공개다. 경로·예약·기사·개별 계약·세금·신규 주문 공개 과정·실제 작업비는 이 실험의 검증 범위 밖이다.', '',
              f'PNC 20ft의 14일 318,500원→15일 500,500원 차이 182,000원은 [공식 요율]({PNC}) 산례이며 invoice나 실현 절감이 아니다. 추가요금은 전체 요금에서 계획 전 발생분을 뺀 모형 목표다.', '',
              'costPolish는 V6의 완전 구성 후보가 원 phase 안에 일찍 도착하면, 남은 시간에 현재 joint fee를 엄격히 낮추는 이동만 수락한다. 유효 cache는 유지한다. 같은 snapshot의 endpoint 검산이 미래 전체 경로의 우월을 보장하지 않는다. GRASP는 α=0.25, 자원 가중 0.15, 최대 128개 구성, 제한 단일·쌍 개선, MILP 없는 고전 framework 적응이다. 최종 시도 수는 기존 작은 개발 probe에서 미사용 예산을 보고 prospective 생성 전에 고정했다. 원 논문이나 SOTA 재현이 아니다.', '',
              f"protocolVersion `{protocol['protocolVersion']}`. 새 seed 91001…91036과 기존 V6 개발 입력 36개, 각 5정책이다. 최초 source와 로컬 protocol을 새 입력 생성 전에 고정했으며 외부 사전등록은 아니다. cold 부모 5,000ms는 import·호출·감사·IPC·부모 terminal 검산을 포함한다. V4/V5 solver 내부 0.2초와 V6/V7/GRASP whole-call 협력식 200ms는 의미가 다르며 동일 CPU나 강제 호출 지연을 주장하지 않는다.", '',
              '## 새 주 평가 — 전체 분모', '', mt(headings, coverage(s)), '',
              mt(['상자수', '사례'] + [LABELS[method] for method in METHODS], [[scale, item['caseCount']] + [item['completeCounts'][method] for method in METHODS] for scale, item in s['byScale'].items()]), '',
              '## 새 주 평가 — 완전 쌍의 비용', '', mt(fee_headers, fee_rows(s)), '',
              'Δ=후보−기준이며 원 archive savings는 기준−후보다. %는 해당 쌍의 기준 합계를 분모로 한 가중 변화다. 각 비교의 쌍은 다르고, 0원 %는 null, 미완료 전체 요금은 null이다. 모든 0원·악화·누락을 유지한다.', '',
              mt(['비교', '기준/후보누락', '최악증가', '얻은/잃은완주', '날짜변경기준→후보'], outcome_rows(s)), '',
              '## 초기 계획·회복 효과 범위', '', mt(['시작비교', '평가', '동일', '다름', '미평가'], initial_rows(s)), '',
              '완전·검산된 D0 계획과 observation hash가 같을 때만 비교한다. 빈 기록·부분·미확보 계획은 같음이 아니다. 초기 날짜가 달랐다면 동일 executed prefix의 회복 효과로 보지 않는다. 이력 미확보는 실행 없음이나 실무 실패의 증거가 아니다.', '',
              mt(['V7vsV6 추가완주 사례', '기준실패day', '초기날짜같음', '해석'], gained_scope) if gained_scope else 'V7vsV6 추가완주 사례 없음.', '',
              '## 시간·호출·감사', '', mt(['정책', 'episode중앙ms', 'p95ms', '최대callms', 'harddeadline기록'], runtime_rows(s)), '',
              f"새 완전 terminal {s['terminalAudit']['completeEpisodes']}개, audit 실패 {s['terminalAudit']['failedAudits']}개. 강제 kill·미전달 episode의 physical history·counters·revisions는 unknown이며 0으로 채우지 않는다. 부모 검산까지 5,000ms 안에 끝난 완전 결과만 완주다. process-exit 시간은 별도다.", '',
              '## 기존36 개발대조 — 별도분모', '', mt(headings, coverage(ds)), '', mt(fee_headers, fee_rows(ds)), '',
              mt(['비교', '기준/후보누락', '최악증가', '얻은/잃은완주', '날짜변경기준→후보'], outcome_rows(ds)), '',
              '기존 입력은 개발에 사용되었으며 새 36개와 합쳐 72개 holdout이라고 하지 않는다. frozen input-only bundle은 명목 주문·shock·원 ID 및 기존 전체 archive SHA에 묶였다. 기존 결과를 복사해 새 정책 성적처럼 쓰지 않는다.', '',
              '## 원 PSPLIB 공개 RCPSP — 별도 실험', '', f"protocol `{public_protocol['protocolVersion']}`. 알려진 ProGen 생성 j30 전체 480개다. 30활동+2dummy, 4 renewable 자원, 원 duration/demand/precedence/release/horizon 및 abstract ticks를 유지한다. due/tardiness 필드는 보존하되 원 makespan 목표에 hard due를 추가하지 않는다. 공식 OPT/merged를 평가에만 쓰고 search에 전달하지 않는다.", '',
              'baselineSerialSGS는 stable topological 순서의 한 번 구성이다. iteratedSGS는 최대 256 segment removal/random insertion, 8 positive-duration jobs, tie 허용 hill climbing의 문헌 참고 subset이다. adaptive weights/mobile/non-peak/right-left justify/full ALNS는 없다. 두 방법의 warm 100ms는 구성·검색·in-method audit·return을 포함하고 import/parsing/download와 post-call 평가 재검산을 제외한다. hard 부모 call timer나 cold 동일 비교가 아니다. 두 방법은 같은 최대 한도이며 실제 소비 시간은 다르다.', '',
              mt(['방법', '제때완전/480', '공식값일치', '평균gap%', '최대gap%', '100ms초과'], public_rows), '',
              f"완전 {pair_public['caseCount']}쌍, 개선/동일/악화 {pair_public['betterCount']}/{pair_public['tiedCount']}/{pair_public['worseCount']}이다. 기준 makespan 합 {pair_public['baselineMakespanSum']}, 후보 합 {pair_public['iteratedMakespanSum']}, 감소 {percent(pair_public['weightedReductionPct'])}. gap %의 평균은 완전 결과의 개별 reference gap % 산술평균이다. 공식 최적값은 timed solver baseline이 아니며 각 schedule의 feasibility는 별도 Python이 감사했다.", '',
              '원 수치 자료는 연구 평가 사용 조건만 확인하여 website ZIP에 재분배하지 않는다. 공식 3 URL/SHA로 download-on-demand 재현한다. 공개 원 RCPSP는 컨테이너 fee/staging/rolling 전체 모형의 외부 검증이나 실주문이 아니다.', '',
              mt(['원 공개 파일', 'URL', 'SHA-256'], [[item['filename'], item['url'], '`' + item['sha256'] + '`'] for item in public_protocol['sources'].values()]), '',
              '## 실제 공개 곡물항만 ledger — 성능 실험 아님', '', f"CC BY 4.0 원 SQLite: {ls['nativeTypedOccurrences']:,} typed occurrences, {ls['duplicateGlobalEventIdExtraRows']} reused IDs, {ls['assignmentVisits']} assignment visits={ls['visitCategories']['complete_ordered_observation']} ordered+{ls['visitCategories']['incomplete_observation']} incomplete. table/rowid identity와 original timestamps를 보존하며 edge 중복은 별도 보고한다. naive join {ls['naiveRawJoinRows']}행. solver/fee/추가 사업 필드=0/0/0이다.", '',
              'Truck assignment→다음 assignment의 회고 창으로 event-object membership을 감사했다. 이는 온라인 정보 집합이 아니다. timezone/clock calibration은 미확인이다. gate 또는 load-to-weigh clock span은 적출 service가 아니다. 실측 resource capacity/fee/empty return/container lifecycle이 없고, 출처의 현장 수집 설명을 독립 인증하지 않았다. 원 source의 39 ID 충돌을 DISTINCT로 삭제하지 않는다.', '',
              '[공개 원자료](https://zenodo.org/records/22019684) 및 내부 독립 SQL 복산은 진위 인증이나 외부 전문가 심사가 아니다. 기존 V6 원 7MB source를 재사용하며 새 실제 PNC 실험으로 세지 않는다.', '',
              '## 모두 유지한 주 평가 사례', '', mt(['사례', '규모'] + [LABELS[method] for method in METHODS], [[case['id'], case['count']] + [money(case['policies'][method]['totalCost']) + ' / ' + case['policies'][method]['status'] for method in METHODS] for case in primary]), '',
              '## 모두 유지한 개발 사례', '', mt(['사례', '규모'] + [LABELS[method] for method in METHODS], [[case['id'], case['count']] + [money(case['policies'][method]['totalCost']) + ' / ' + case['policies'][method]['status'] for method in METHODS] for case in controls]), '']
    for panel_name, panel in [('새주평가', s), ('기존개발', ds)]:
        report += ['## ' + panel_name + ' 모든 비용 악화·완주변경 ID', '']
        for key, item in panel['comparisons'].items():
            report += ['### ' + key, '', '요금악화: ' + (', '.join('`' + value + '`' for value in item['negativeSavingsCaseIds']) or '없음') + '.', '',
                       '얻은완주: ' + (', '.join('`' + value + '`' for value in item['gainedCompletionCaseIds']) or '없음') + '.', '',
                       '잃은완주: ' + (', '.join('`' + value + '`' for value in item['lostCompletionCaseIds']) or '없음') + '.', '']
    report += ['## 근거·전달·작성기여', '', '[방법출처](external-methods-v7.md), [비용방법](cost-method-v7.md), [GRASP적응](grasp-adaptation-v7.md), [공개검증](public-validation-v7.md), [전체중문보고서](report-v7.zh.md), [실제기여](contribution-log-v7.md). 별도Python/SQL복산은내부독립구현이며기관인증/solver최적성재증명/세계최고/입상확률이아니다.', '',
               '공통 portplan/ 루트로 네 ZIP을 같은 부모 폴더에 풀어 합친다: ' + ', '.join('`' + name + '`' for name in ZIP_NAMES) + '. public-inputs-v6 이름은 V7 허가된 reference까지 포함하는 기존 전달 alias다. projection은 원본 대체가 아니다. 최초 실행 원본을 덮어쓰지 않으며 V6 자료를 그대로 보존한다.', '',
               '```sh', 'npm ci --prefix vendor/experiments/v7-first-run-source', 'node vendor/experiments/v7-first-run-source/scripts/rolling-benchmark-v7.mjs --output artifacts/repro-rolling-v7.json',
               'node vendor/experiments/public-v7-first-run-source/scripts/public-resource-benchmark-v7.mjs --download --input-dir artifacts/public-v7-inputs --output artifacts/repro-public-resource-v7.json',
               'python scripts/build-defense-v7.py --require-results', '```', '',
               '공개 RCPSP 재현은 공식 입력 SHA와 최초 source hash가 맞는 frozen 버전에서 실행한다. 한도 성적은 장비·부하에 따라 달라질 수 있다. 이 generator는 실험·브라우저·PDF 렌더를 실행하지 않는다.', '',
               f'[2026 공식 페이지]({OFFICIAL})의 발표 ≤20쪽 조건에 맞춘 18쪽 초안이다. 사용자 직접 구현·검증·이해·재학·참가 및 AI 허용은 확인되지 않았으며 대신 서약하지 않는다. 조사·개발·계산·자료 작성은 AI가 수행했다. 역사적 2025 직접 창작·대리 작성 금지 서약과 확인되지 않은 2026 적용을 구분한다. 외부 연락·등록·대리 서명·발표를 하지 않았다.', '',
               '## 이번 생성에 사용한 원본 SHA', '', provenance, '']
    english = ['# PortPlan V7 — English understanding notes', '', f'Generated {generated};18-page Korean AI-created draft from complete checked archives, not entrant understanding/authorship approval.', '']
    for index, item in enumerate(slides, 1):
        english += [f'## {index:02d}. ' + item['kicker'], '', item['notes'], '']
    english += ['## Exact paired monetary denominators — primary', '', mt(fee_headers, fee_rows(s)), '',
                '## Exact paired monetary denominators — development', '', mt(fee_headers, fee_rows(ds)), '',
                'Fee delta means candidate minus baseline. Each comparison includes only jointly completed same-case episodes. Total and incremental baseline sums are different; zero denominators stay null. All negative IDs and coverage changes are listed in the Korean submission and immutable archives.', '',
                '## Frozen evidence bytes', '', provenance, '',
                'The four ZIPs share portplan/. The public-inputs-v6 alias includes licensedV7 method references and the nativeV6 source, while PSPLIB numeric files remain official download-on-demand inputs. The source-adapted GRASP and subset iteratedSGS do not establish paper reproduction or SOTA. No real PNC saving, first-place likelihood, external authentication or personal entrant contribution is asserted.', '']
    contribution = ['# PortPlan V7 실제 기여 기록', '', f'생성 {generated}. AI 자체 수행 기록이며 사용자 본인 창작·검증·이해·참가자격 확인서가 아니다.', '',
                    mt(['작업', '실제 수행 주체', '확인 범위'], [['공개 GRASP/SGS/ALNS 및 라이선스 조사', 'AI', '실제 원문/코드·고정commit·허가원件·접근한계'], ['V7 비용다듬기 및 GRASP 적응 구현', 'AI', '최초 실행source와 frozen protocol; 방법의 새로움 미주장'],
                       ['새36×5 및 기존개발36×5 실행', 'AI', '전체360episode, null/0원/악화/unknown 보존'], ['원공개RCPSP480×2 실행과 별도Python검산', 'AI', 'warm100ms·원모델·공식reference; fullALNS/SOTA아님'],
                       ['실제벌크항만 occurrence/assignment/clock 감사', 'AI', '6,989occurrences/489visits; 별도SQL복산·0solver/0fee'], ['18쪽韓文자료·영문노트·보고서 작성', 'AI', '완결원자료 guard후생성; PDF/화면검토는별도'],
                       ['사용자 직접개발·검증·이해·참가/서약', '미확인', 'AI수행을사용자개인기여로옮기지않음']]), '',
                    '원 연구·GLPK/HiGHS/SciPy·MIT ALNS/TSP·Apache OR-Tools·공개 자료의 저작권은 원 소유자에게 귀속하며 개별 원 notice를 유지한다. 2025 직접 창작·대리 작성/발표 금지 근거를 2026 규정으로 확정하지 않고 AI 허용이나 참가 자격도 대신 인정하지 않는다. 등록·외부 연락·대리 서명·발표를 수행하지 않았다.', '',
                    '새 주 평가를 본 뒤 seed·사례·파라미터를 교체하지 않았다. 최종 GRASP 시도 수 설정에 사용한 이전 개발 probe는 고정 protocol에 공개되어 있다. 기존 V6 자료와 최초 결과는 그대로 유지한다. 이후 실제 사용자 수정·검증이 있다면 날짜·범위·증거를 별도 기록하고 자동 완료 표시하지 않는다.', '',
                    '## 자료 생성의 실제 입력', '', provenance, '']
    outputs = {'docs/defense-v7.ko.html': html, 'docs/submission-v7.ko.md': '\n'.join(report),
               'docs/defense-v7.en.md': '\n'.join(english), 'docs/contribution-log-v7.md': '\n'.join(contribution)}
    # Every evidence guard and all draft construction succeeded before writes.
    for path, text in outputs.items():
        safe_path(path).write_text(text, encoding='utf-8')
    print(json.dumps({'state': 'complete_actual_checked_evidence_draft', 'pages': len(slides), 'primaryCases': len(primary),
                      'developmentCases': len(controls), 'syntheticEpisodes': (len(primary) + len(controls)) * len(METHODS),
                      'publicCases': len(public['cases']), 'nativeEventOccurrences': ls['nativeTypedOccurrences'],
                      'rollingSha256': hashes['data/rolling-v7.json'], 'outputs': list(outputs)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
