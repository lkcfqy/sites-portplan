#!/usr/bin/env python3
"""Independently reconstruct V14 scenario-cluster bootstrap confidence intervals.

Reads a finished run and SHA-bound full episode files. It never imports or runs
JavaScript, generates prospective inputs, solves schedules, or changes evidence.
Run the separate physical/tariff audit as well: this audit checks statistics,
receipt eligibility and artifact bindings, not the truth of recorded execution.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path

METHODS = tuple(['costPolishV7', 'adaptiveV9', 'highsV8', 'stableHiGHSV10', 'commitmentHiGHSV11', 'seededHiGHSV12', 'guardedHiGHSV13'])
PAIRS = {'v13VsV12': ('seededHiGHSV12', 'guardedHiGHSV13'),
         'v13VsV11': ('commitmentHiGHSV11', 'guardedHiGHSV13'),
         'v13VsV10': ('stableHiGHSV10', 'guardedHiGHSV13'),
         'v13VsV9': ('adaptiveV9', 'guardedHiGHSV13'),
         'v13VsHiGHS': ('highsV8', 'guardedHiGHSV13'),
         'v13VsV7': ('costPolishV7', 'guardedHiGHSV13'),
         'v12VsV11': ('commitmentHiGHSV11', 'seededHiGHSV12'),
         'v12VsV10': ('stableHiGHSV10', 'seededHiGHSV12'),
         'v12VsV9': ('adaptiveV9', 'seededHiGHSV12'),
         'v12VsHiGHS': ('highsV8', 'seededHiGHSV12'),
         'v12VsV7': ('costPolishV7', 'seededHiGHSV12'),
         'v11VsV10': ('stableHiGHSV10', 'commitmentHiGHSV11'),
         'v10VsHiGHS': ('highsV8', 'stableHiGHSV10'),
         'highsVsV7': ('costPolishV7', 'highsV8')}
PRIMARY_PAIRS = tuple(list(PAIRS)[:6])
HISTORICAL_SOURCES = (
    'data/benchmark-v4.json', 'data/benchmark.json', 'data/conservative-protocol-v2.json',
    'data/mechanism-protocol-v8.json', 'data/protocol-development-v13.json', 'data/protocol-public-v7.json',
    'data/protocol-v10.json', 'data/protocol-v12.json', 'data/protocol-v2.json', 'data/protocol-v4.json',
    'data/protocol-v5.json', 'data/protocol-v6.json', 'data/protocol-v7.json', 'data/protocol-v8.json',
    'data/protocol-v9.json', 'data/public-gate-protocol-v3.json', 'data/public-reproduction-protocol-v3.json',
    'data/robustness-protocol-v2.json', 'data/rolling-protocol-v4.json')

FEES = ('totalCost', 'incrementalCost', 'storageCost', 'ddCost', 'sunkCost', 'objectiveCost', 'lateCount')
PARENT_RECEIPT_FIELDS = ('hardWallMs', 'actualCutoffMs', 'processExitWallTimeMs', 'processCloseWallTimeMs',
                         'cleanupFinishedMs', 'endToEndWallTimeMs', 'normalWorkerExit', 'exitCode', 'exitSignal',
                         'processGroupCleanup', 'deadlineReached', 'terminalReceiptWithinBudget',
                         'terminalReceiptAcceptedAsHistory', 'endToEndCompletedWithinBudget',
                         'unacceptedTerminalReceipts')
RECEIPT_FIELDS = (*FEES, 'policy', 'status', 'complete', 'auditValid', 'executionHistoryUnavailable',
                  'episodeCompletedWithinBudget', 'outputDeliveredWithinBudget', 'wallTimeMs',
                  'finalReceivedMs', 'receiptValidatedMs', 'revisionCount', 'initializationEvidence', *PARENT_RECEIPT_FIELDS)
PARENT_ACCEPTANCE = {'normalWorkerExitRequired': True, 'confirmedProcessGroupGoneRequired': True,
                     'processGroupVerificationResult': 'ESRCH', 'cleanupWithinHardWallRequired': True,
                     'endToEndWithinHardWallRequired': True, 'timelyFinalAloneIsCompletion': False}


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def read_json(path):
    def reject_constant(value):
        raise ValueError(f'Nonfinite JSON constant {value} in {path}')
    def reject_duplicates(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, f'Duplicate JSON key {key!r} in {path}')
            result[key] = value
        return result
    return json.loads(Path(path).read_text(encoding='utf-8'), parse_constant=reject_constant,
                      object_pairs_hook=reject_duplicates)


def finite(value):
    return type(value) in (int, float) and math.isfinite(value)


def same(actual, expected, label):
    require(type(actual) is type(expected) and actual == expected, f'{label}: differs from independent reconstruction')


def numeric(actual, expected, label, tolerance=1e-6):
    if expected is None:
        require(actual is None, f'{label}: empty/zero-denominator estimate must be null')
    elif isinstance(expected, list):
        require(isinstance(actual, list) and len(actual) == len(expected), f'{label}: malformed interval')
        for index, value in enumerate(expected):
            numeric(actual[index], value, f'{label}[{index}]', tolerance)
    else:
        require(finite(actual) and abs(actual - expected) <= tolerance,
                f'{label}: expected {expected}, received {actual}')


def ordered_sum(values):
    # Binary64 addition in source order avoids Python-version-dependent sum
    # compensation, and makes roundoff differences inspectable at 1e-6 KRW.
    result = 0.0
    for value in values:
        result += value
    return result


def mean(values):
    return ordered_sum(values) / len(values) if values else None


def percentile(sorted_values, probability):
    if not sorted_values:
        return None
    position = (len(sorted_values) - 1) * probability
    lower = math.floor(position)
    upper = math.ceil(position)
    return sorted_values[lower] + (sorted_values[upper] - sorted_values[lower]) * (position - lower)


def cluster_bootstrap(units, seed, draws):
    """Resample whole scenario pairs, retaining their matching-repeat means.

    The prescribed 32-bit LCG supplies one scenario index per draw position.
    Exact integer arithmetic for the index is equivalent to floor(U * N) here
    because N <= 72 and state * N is exactly representable by binary64.
    """
    size = len(units)
    if not size:
        return {'scenarioCount': 0, 'draws': draws, 'meanSavings95CI': None, 'weightedSavingsPct95CI': None}
    state = seed & 0xffffffff
    differences, percentages = [], []
    for _ in range(draws):
        baseline = candidate = 0.0
        for _ in range(size):
            state = (1664525 * state + 1013904223) & 0xffffffff
            before, after = units[(state * size) // 4294967296]
            baseline += before
            candidate += after
        differences.append((baseline - candidate) / size)
        if baseline != 0:
            percentages.append(100 * (baseline - candidate) / baseline)
    differences.sort()
    percentages.sort()
    return {'scenarioCount': size, 'draws': draws,
            'meanSavings95CI': [percentile(differences, .025), percentile(differences, .975)],
            'weightedSavingsPct95CI': [percentile(percentages, .025), percentile(percentages, .975)] if percentages else None}


def audit_parent_lifecycle(result, hard_wall_ms, label='episode'):
    """Formal parent gate only; old development/audit_episode contracts stay intact.

    Reconstruct acceptance from the recorded clocks, exit and group verification,
    independently of the producer's completion/cleanup booleans. These are an
    internally checked receipt, not external authentication of a historical OS.
    """
    prefix = label + '/parent lifecycle'
    for field in (*PARENT_RECEIPT_FIELDS, 'wallTimeMs', 'finalReceivedMs', 'receiptValidatedMs',
                  'episodeCompletedWithinBudget', 'outputDeliveredWithinBudget'):
        require(field in result, prefix + ': missing ' + field)
    same(result['hardWallMs'], hard_wall_ms, prefix + '/hard budget')
    def clock(value, name, nullable=False):
        require(nullable and value is None or finite(value) and value >= 0,
                prefix + ': invalid clock ' + name)
        return value
    wall = clock(result['wallTimeMs'], 'wallTimeMs')
    same(result['endToEndWallTimeMs'], wall, prefix + '/end-to-end clock')
    exit_ms = clock(result['processExitWallTimeMs'], 'processExitWallTimeMs', True)
    close_ms = clock(result['processCloseWallTimeMs'], 'processCloseWallTimeMs', True)
    require(exit_ms is None or close_ms is None or exit_ms <= close_ms, prefix + ': close precedes exit')
    cleanup = result['processGroupCleanup']
    require(isinstance(cleanup, dict), prefix + ': missing process-group cleanup')
    same(cleanup.get('mode'), 'posix-process-group', prefix + '/process-group mode')
    same(cleanup.get('attempted'), True, prefix + '/cleanup attempted')
    start = clock(cleanup.get('startedAtMs'), 'cleanup startedAtMs')
    finish = clock(cleanup.get('finishedAtMs'), 'cleanup finishedAtMs')
    require(start <= finish <= wall and (close_ms is None or close_ms <= finish),
            prefix + ': cleanup/close/end-to-end chronology')
    same(result['cleanupFinishedMs'], finish, prefix + '/cleanup finished binding')
    attempts = cleanup.get('attempts')
    require(isinstance(attempts, list) and attempts, prefix + ': cleanup attempts missing')
    last = 0
    for attempt in attempts:
        require(isinstance(attempt, dict), prefix + ': malformed cleanup attempt')
        at = clock(attempt.get('atMs'), 'cleanup attempt atMs')
        require(last <= at <= finish, prefix + ': cleanup attempt chronology')
        require(isinstance(attempt.get('reason'), str) and attempt['reason'], prefix + ': missing cleanup reason')
        same(attempt.get('signal'), 'SIGKILL', prefix + '/cleanup signal')
        require(type(attempt.get('attempted')) is bool, prefix + ': missing cleanup attempt state')
        require(type(attempt.get('sent')) is bool, prefix + ': missing cleanup signal outcome')
        require('error' not in attempt or attempt['error'] is None or isinstance(attempt['error'], str),
                prefix + ': malformed cleanup signal error')
        last = at
    same(cleanup.get('killSignalSent'), any(attempt['sent'] for attempt in attempts), prefix + '/cleanup signal aggregate')
    require('verificationResult' in cleanup and 'verificationAtMs' in cleanup and 'verificationError' in cleanup,
            prefix + ': missing process-group verification receipt')
    require(cleanup.get('verificationError') is None or isinstance(cleanup['verificationError'], str),
            prefix + ': invalid group verification error')
    verification_at = clock(cleanup['verificationAtMs'], 'group verificationAtMs', True)
    require(verification_at is None or max(start, last) <= verification_at <= finish,
            prefix + ': group verification chronology')
    require(cleanup['verificationResult'] in (None, 'ESRCH'), prefix + ': invalid group verification result')
    cleanup_ok = (cleanup['verificationResult'] == 'ESRCH' and verification_at is not None
                  and cleanup['verificationError'] is None)
    same(cleanup.get('verifiedProcessGroupGone'), cleanup_ok, prefix + '/independent ESRCH group verification')
    same(cleanup.get('successful'), cleanup_ok, prefix + '/independent cleanup success')
    code, signal = result['exitCode'], result['exitSignal']
    require(code is None or type(code) is int, prefix + ': invalid exit code')
    require(signal is None or isinstance(signal, str), prefix + ': invalid exit signal')
    normal = type(code) is int and code == 0 and signal is None and exit_ms is not None and close_ms is not None
    same(result['normalWorkerExit'], normal, prefix + '/normal worker exit')
    received = clock(result['finalReceivedMs'], 'finalReceivedMs', True)
    validated = clock(result['receiptValidatedMs'], 'receiptValidatedMs', True)
    require((received is None) == (validated is None), prefix + ': incomplete terminal timing pair')
    require(received is None or received <= validated <= wall, prefix + ': terminal receipt/audit chronology')
    timely = received is not None and received <= validated <= hard_wall_ms
    same(result['terminalReceiptWithinBudget'], timely, prefix + '/timely terminal receipt')
    same(result['outputDeliveredWithinBudget'], timely, prefix + '/timely final is separate from lifecycle')
    cutoff = clock(result['actualCutoffMs'], 'actualCutoffMs', True)
    require(cutoff is None or cutoff <= wall, prefix + ': parent cutoff after completion')
    same(result['deadlineReached'], cutoff is not None or wall > hard_wall_ms, prefix + '/deadline observation')
    accepted = (timely and normal and cleanup_ok and finish <= hard_wall_ms and wall <= hard_wall_ms
                and result['deadlineReached'] is False)
    same(result['terminalReceiptAcceptedAsHistory'], accepted, prefix + '/accepted history')
    same(result['endToEndCompletedWithinBudget'], accepted, prefix + '/end-to-end eligibility')
    complete = (result.get('complete') is True and result.get('auditValid') is True
                and result.get('status') in ('feasible', 'optimal') and isinstance(result.get('rows'), list)
                and len(result['rows']) > 0 and all(finite(result.get(k)) for k in FEES))
    same(result['episodeCompletedWithinBudget'], accepted and complete, prefix + '/complete episode eligibility')
    require(result.get('complete') is not True or accepted and complete,
            prefix + ': physical completion cannot bypass exit, cleanup or parent deadline')
    if not result.get('complete'):
        require(result.get('rows') == [] and all(result.get(k) is None for k in FEES),
                prefix + ': failed complete fees must remain null')
    raw = result['unacceptedTerminalReceipts']
    require(isinstance(raw, list), prefix + ': missing unaccepted raw terminal evidence')
    for terminal in raw:
        require(isinstance(terminal, dict) and isinstance(terminal.get('reason'), str)
                and isinstance(terminal.get('message'), dict) and terminal['message'].get('type') == 'final',
                prefix + ': malformed preserved raw terminal')
        at = clock(terminal.get('parentReceivedMs'), 'raw terminal receipt')
        require(at <= wall, prefix + ': raw terminal received after end-to-end completion')
    if timely and not accepted:
        require(result.get('executionHistoryUnavailable') is True, prefix + ': rejected lifecycle became known history')
        reason = ('terminal_lifecycle_exceeded_parent_deadline' if result['deadlineReached'] else
                  'worker_exit_not_clean' if not normal else 'process_group_cleanup_unverified')
        preserved = [terminal for terminal in raw if terminal.get('parentReceivedMs') == received
                     and terminal.get('receiptValidatedMs') == validated
                     and terminal.get('reason') == reason and terminal['message'].get('method') == result.get('policy')
                     and terminal['message'].get('episodeId') == label
                     and isinstance(terminal['message'].get('result'), dict)]
        require(preserved, prefix + ': lifecycle-rejected timely final lost its raw terminal')
        for terminal in preserved:
            original = terminal['message']['result']
            if original.get('complete') is True:
                require(isinstance(original.get('rows'), list) and original['rows']
                        and all(finite(original.get(k)) for k in FEES),
                        prefix + ': raw complete terminal was erased or repriced as failure')
    return {'terminalReceiptWithinBudget': timely, 'normalWorkerExit': normal,
            'processGroupGone': cleanup_ok, 'cleanupWithinBudget': finish <= hard_wall_ms,
            'endToEndWithinBudget': wall <= hard_wall_ms, 'acceptedHistory': accepted,
            'completeEpisode': accepted and complete}


def complete_from_full(result, row_count, hard_wall_ms):
    complete = (result.get('complete') is True and result.get('auditValid') is True
                and result.get('episodeCompletedWithinBudget') is True
                and result.get('status') in ('feasible', 'optimal') and row_count > 0
                and finite(result.get('totalCost')) and finite(result.get('incrementalCost')))
    if complete:
        require(result.get('executionHistoryUnavailable') is False, 'Complete episode has unavailable history')
        require(result.get('outputDeliveredWithinBudget') is True, 'Complete episode lacks timely delivery')
        for name in ('wallTimeMs', 'finalReceivedMs', 'receiptValidatedMs'):
            require(finite(result.get(name)) and 0 <= result[name] <= hard_wall_ms,
                    'Invalid complete episode parent clock: ' + name)
    else:
        require(result.get('complete') is False, 'Claimed completion has invalid eligibility evidence')
        require(row_count == 0 and all(result.get(key) is None for key in FEES),
                'Incomplete fees/rows must remain null/empty')
    return complete


def audit_formal_parent_receipt(receipt, result, hard_wall_ms, label='episode'):
    """Bind formal compact metadata to its SHA-bound full parent record."""
    for field in PARENT_RECEIPT_FIELDS:
        require(field in receipt and field in result, label + ': missing formal scalar/full parent field ' + field)
    for field in RECEIPT_FIELDS:
        same(receipt.get(field), result.get(field), label + '/scalar/full receipt ' + field)
    same(receipt.get('terminalRowCount'), len(result['rows']), label + '/terminal row count')
    return audit_parent_lifecycle(result, hard_wall_ms, label)


def artifact_path(directory, artifact):
    require(isinstance(artifact, dict) and isinstance(artifact.get('path'), str), 'Missing episode artifact')
    path = (directory / artifact['path']).resolve()
    require(path.is_relative_to(directory), 'Episode artifact escapes the run directory')
    require(sha256(path) == artifact.get('sha256'), 'Episode artifact SHA differs: ' + artifact['path'])
    return path


def load_units(directory, index, frozen):
    protocol = index['protocol']
    same(protocol['methods'], list(METHODS), 'Method registry')
    same(protocol['budget']['hardWallMs'], 5000, 'Prespecified cold parent budget')
    same(protocol['budget'].get('parentAcceptance'), PARENT_ACCEPTANCE, 'Prespecified formal parent acceptance')
    declarations = frozen['scenarioMetadata']
    require(len(declarations) == len(index['cases']) == 144, 'Expected 144 distinct business scenarios')
    seeds = protocol['algorithmRepeats']
    same(seeds, [{'index': 1, 'seed': 79011}, {'index': 2, 'seed': 79023}, {'index': 3, 'seed': 79039}],
         'Prespecified three timing repetitions')
    seen_ids, seen_artifacts, panels = set(), set(), {}
    count = 0
    for position, (case, declared) in enumerate(zip(index['cases'], declarations)):
        require(case['id'] not in seen_ids, 'Repeated business scenario id')
        seen_ids.add(case['id'])
        for name, value in declared.items():
            same(case[name], value, 'Frozen case declaration: ' + name)
        require(len(case['repeats']) == 3, 'Missing matching algorithm/timing repeat')
        units = {method: [] for method in METHODS}
        for repetition_index, repetition in enumerate(case['repeats']):
            same(repetition['repeatIndex'], repetition_index + 1, 'Repeat index')
            same(repetition['algorithmSeed'], seeds[repetition_index]['seed'], 'Declared algorithm/timing seed')
            same(set(repetition['policies']), set(METHODS), 'Per-repeat method coverage')
            rotation = [METHODS[(position + repetition_index + offset) % len(METHODS)] for offset in range(len(METHODS))]
            same(repetition['methodExecutionOrder'], rotation, 'Declared execution rotation')
            for method in METHODS:
                receipt = repetition['policies'][method]
                require(receipt.get('scalarReceipt') is True, 'Missing lightweight receipt declaration')
                path = artifact_path(directory, receipt['artifact'])
                require(path not in seen_artifacts, 'Episode artifact reused across independent method/repeat identities')
                seen_artifacts.add(path)
                envelope = read_json(path)
                same(envelope['caseId'], case['id'], 'Episode case identity')
                same(envelope['scenarioId'], case['id'], 'Episode scenario identity')
                same(envelope['panel'], case['panel'], 'Episode panel identity')
                same(envelope['method'], method, 'Episode method identity')
                same(envelope['repeatIndex'], repetition_index + 1, 'Episode repeat identity')
                same(envelope['algorithmSeed'], repetition['algorithmSeed'], 'Episode seed identity')
                expected_id = f"{case['id']}--a{repetition_index + 1}--{method}"
                same(envelope['episodeId'], expected_id, 'Episode identifier')
                result = envelope['result']
                require(isinstance(result.get('rows'), list), 'Missing full terminal row declaration')
                same(result['policy'], method, 'Result policy identity')
                if not result.get('executionHistoryUnavailable'):
                    same(result['algorithmSeed'], repetition['algorithmSeed'], 'Result seed identity')
                    same(result['repeatIndex'], repetition_index + 1, 'Result repeat identity')
                same(result['hardWallMs'], protocol['budget']['hardWallMs'], 'Hard episode budget')
                audit_formal_parent_receipt(receipt, result, protocol['budget']['hardWallMs'], expected_id)
                eligible = complete_from_full(result, len(result['rows']), protocol['budget']['hardWallMs'])
                units[method].append({'complete': eligible, 'totalCost': result['totalCost'],
                                      'incrementalCost': result['incrementalCost'], 'revisionCount': result.get('revisionCount'),
                                      'executionHistoryUnavailable': result.get('executionHistoryUnavailable'),
                                      'initializationEvidence': result.get('initializationEvidence')})
                count += 1
        panels.setdefault(case['panel'], []).append({'id': case['id'], 'units': units})
    same(list(panels), [panel['id'] for panel in protocol['panels']], 'Separate panel ordering')
    require(all(len(cases) == 72 for cases in panels.values()) and count == 3024, 'Incomplete panel/episode coverage')
    return panels, count


def compare_tree(actual, expected, label):
    if isinstance(expected, dict):
        require(isinstance(actual, dict), label + ': expected a dictionary')
        for field, value in expected.items():
            require(field in actual, label + ': missing independently checked field ' + field)
            compare_tree(actual[field], value, label + '/' + field)
    elif isinstance(expected, list):
        require(isinstance(actual, list) and len(actual) == len(expected), label + ': list coverage differs')
        for index, value in enumerate(expected):
            compare_tree(actual[index], value, label + f'/{index}')
    elif type(expected) in (int, float):
        numeric(actual, expected, label)
    else:
        same(actual, expected, label)


def joint_complete_pareto(cases):
    scenarios, joint = [], []
    for case in cases:
        matches = [{method: case['units'][method][index] for method in METHODS} for index in range(3)
                   if all(case['units'][method][index]['complete'] for method in METHODS)]
        if not matches:
            continue
        joint.extend(matches)
        means = {}
        for method in METHODS:
            revisions = [row[method]['revisionCount'] for row in matches]
            means[method] = {'totalCost': mean([row[method]['totalCost'] for row in matches]),
                             'incrementalCost': mean([row[method]['incrementalCost'] for row in matches]),
                             'revisionCount': mean(revisions) if all(finite(v) for v in revisions) else None}
        scenarios.append({'scenarioId': case['id'], 'pairedRepeatCount': len(matches), 'byMethod': means})
    by_method = {}
    for method in METHODS:
        revisions = [row[method]['revisionCount'] for row in joint]
        scenario_revisions = [row['byMethod'][method]['revisionCount'] for row in scenarios]
        by_method[method] = {'scenarioCount': len(scenarios), 'jointEpisodeCount': len(joint),
            'scenarioMeanTotalCostSumKRW': ordered_sum([row['byMethod'][method]['totalCost'] for row in scenarios]) if scenarios else None,
            'scenarioMeanIncrementalCostSumKRW': ordered_sum([row['byMethod'][method]['incrementalCost'] for row in scenarios]) if scenarios else None,
            'scenarioMeanRevisionCountSum': ordered_sum(scenario_revisions) if scenarios and all(finite(v) for v in scenario_revisions) else None,
            'episodeTotalCostSumKRW': ordered_sum([row[method]['totalCost'] for row in joint]) if joint else None,
            'episodeIncrementalCostSumKRW': ordered_sum([row[method]['incrementalCost'] for row in joint]) if joint else None,
            'episodeRevisionCountSum': ordered_sum(revisions) if joint and all(finite(v) for v in revisions) else None,
            'knownRevisionEpisodeCount': sum(finite(v) for v in revisions),
            'unknownRevisionEpisodeCount': sum(not finite(v) for v in revisions),
            'fullSampleCompleteEpisodeCount': sum(row['complete'] for case in cases for row in case['units'][method]),
            'fullSampleEpisodeCount': 3 * len(cases)}
    frontiers = {}
    for name, cost in (('totalAndRevisions', 'scenarioMeanTotalCostSumKRW'),
                       ('incrementalAndRevisions', 'scenarioMeanIncrementalCostSumKRW')):
        coordinates = {method: (by_method[method][cost], by_method[method]['scenarioMeanRevisionCountSum']) for method in METHODS}
        def known(method):
            return all(finite(v) for v in coordinates[method])
        def dominates(a, b):
            if not known(a) or not known(b):
                return False
            aa, bb = coordinates[a], coordinates[b]
            return all(x <= y + 1e-6 for x, y in zip(aa, bb)) and any(x < y - 1e-6 for x, y in zip(aa, bb))
        frontiers[name] = [{'method': method, 'dominates': [other for other in METHODS if other != method and dominates(method, other)],
                            'dominatedBy': [other for other in METHODS if other != method and dominates(other, method)],
                            'pareto': not any(dominates(other, method) for other in METHODS if other != method) if known(method) else None}
                           for method in METHODS]
    return {'jointScenarioCount': len(scenarios), 'jointEpisodeCount': len(joint),
            'eligibility': 'all-seven-matching-complete-repeats', 'byMethod': by_method, 'frontiers': frontiers, 'scenarios': scenarios,
            'scope': 'Conditional all-seven jointly completed matching repeats; average within scenario then equal scenario weight. No revision-to-KRW conversion. This table never overrides full-sample completion losses or establishes universal dominance.'}


def conditional_fee_claim(interval):
    if interval is None:
        return 'unavailable'
    if interval[0] > 0:
        return 'conditional_savings_interval_positive'
    if interval[1] < 0:
        return 'conditional_deterioration_interval_negative'
    return 'no_stable_advantage'


def decision_gates(cases, independent_comparisons):
    candidate = 'guardedHiGHSV13'
    baseline_keys = {'seededHiGHSV12': 'v13VsV12', 'commitmentHiGHSV11': 'v13VsV11',
                     'stableHiGHSV10': 'v13VsV10', 'adaptiveV9': 'v13VsV9',
                     'highsV8': 'v13VsHiGHS', 'costPolishV7': 'v13VsV7'}
    losses, gains = {}, {}
    native = {}
    complete_panel = len(cases) == 72 and all(all(len(case['units'][method]) == 3 for method in METHODS) for case in cases)
    for method, key in baseline_keys.items():
        all_pairs = [(b, a) for case in cases for b, a in zip(case['units'][method], case['units'][candidate])]
        losses[method] = sum(b['complete'] and not a['complete'] for b, a in all_pairs)
        gains[method] = sum(a['complete'] and not b['complete'] for b, a in all_pairs)
        if method not in ('seededHiGHSV12', 'commitmentHiGHSV11', 'stableHiGHSV10', 'highsV8'):
            continue
        matched = [(b, a) for b, a in all_pairs if b['complete'] and a['complete']]
        known = [(b, a) for b, a in matched if finite(b['revisionCount']) and finite(a['revisionCount'])]
        delta = ordered_sum([a['revisionCount'] - b['revisionCount'] for b, a in known]) if known and len(known) == len(matched) else None
        strict = delta is not None and delta < 0
        fees = independent_comparisons[key]['fees']
        total = fees['total']['weightedSavingsPct95CI']
        incremental = fees['incremental']['weightedSavingsPct95CI']
        no_deterioration = total is not None and incremental is not None and total[1] >= 0 and incremental[1] >= 0
        native[method] = {'lostEpisodeCount': losses[method], 'revisionPairedEpisodeCount': len(known),
            'revisionDelta': delta, 'strictRevisionReduction': strict,
            'incrementalFeeClaim': conditional_fee_claim(incremental), 'totalFeeClaim': conditional_fee_claim(total),
            'noRobustFeeDeterioration': no_deterioration,
            'stabilityImprovementClaimAllowed': complete_panel and losses[method] == 0 and strict and no_deterioration}
    no_loss = all(v == 0 for v in losses.values())
    return {'candidateMethod': candidate, 'assessmentState': 'complete-panel' if complete_panel else 'partial-panel',
            'completionLossCountsByBaseline': losses, 'completionGainCountsByBaseline': gains,
            'completionNonRegressionAllBaselines': no_loss, 'defaultRecommendationEligible': complete_panel and no_loss,
            'nativeComparisons': native,
            'scope': 'Observed necessary gates against the six included comparators only. Any full-sample completion loss blocks default eligibility; net gains and conditional fees/Pareto position do not offset losses. Native stability claims use each exact native paired set; zero-inclusive fee intervals do not prove stable savings. No claim against omitted V5 or universal/production recommendation.'}


def pair_observations(cases, baseline, candidate):
    """Keep matching repetitions together, then give each business case one weight.

    Revision observations retain this pair's joint-complete episode set, never
    the seven-way common subset. Unknown revisions remain unknown for gates.
    """
    fee_units = {field: [] for field in ('totalCost', 'incrementalCost')}
    completion_units, matched_episode_count = [], 0
    matched_pairs, scenario_pairs, gains, losses, known_gains, unknown_gains = [], [], [], [], [], []
    for case in cases:
        before_units, after_units = case['units'][baseline], case['units'][candidate]
        require(len(before_units) == len(after_units) == 3, 'Pair requires exactly three matching timing repeats')
        matched, rate_changes = [], []
        for repeat_index, (before, after) in enumerate(zip(before_units, after_units)):
            pair_id = case['id'] + '::repeat-' + str(repeat_index + 1)
            b, a = before['complete'], after['complete']
            require(type(b) is bool and type(a) is bool, 'Pair completion eligibility must be boolean')
            if b and a:
                require(all(finite(row[field]) for row in (before, after) for field in fee_units),
                        'A jointly completed fee observation must be finite')
            if a and not b:
                gains.append(pair_id)
                (unknown_gains if before.get('executionHistoryUnavailable') is True else known_gains).append(pair_id)
            if b and not a: losses.append(pair_id)
            rate_changes.append(int(a) - int(b))
            if b and a:
                matched.append((before, after))
                matched_pairs.append((pair_id, before, after))
        # Zero baseline and negative candidate encode the mean completion
        # gain as a savings statistic without resampling individual repeats.
        completion_units.append((0.0, -mean(rate_changes)))
        if matched:
            matched_episode_count += len(matched)
            scenario_pairs.append({'scenarioId': case['id'], 'pairedRepeatCount': len(matched),
                'totalSavingsKRW': mean([b['totalCost'] for b, a in matched]) - mean([a['totalCost'] for b, a in matched]),
                'incrementalSavingsKRW': mean([b['incrementalCost'] for b, a in matched]) - mean([a['incrementalCost'] for b, a in matched])})
            for field in fee_units:
                fee_units[field].append((mean([b[field] for b, _ in matched]),
                                         mean([a[field] for _, a in matched])))
    return {'feeUnits': fee_units, 'completionUnits': completion_units,
            'matchedEpisodeCount': matched_episode_count, 'matchedPairs': matched_pairs,
            'scenarioPairs': scenario_pairs, 'gainIds': gains, 'lossIds': losses,
            'knownGainIds': known_gains, 'unknownGainIds': unknown_gains}


def compare_panel(cases, recorded, seed, draws, label):
    output = {'scenarioCount': len(cases), 'byMethod': {}, 'comparisons': {}}
    for method in METHODS:
        rates = [mean([int(r['complete']) for r in case['units'][method]]) for case in cases]
        expected = {'recordedEpisodeCount': len(cases) * 3,
                    'completeEpisodeCount': sum(r['complete'] for case in cases for r in case['units'][method]),
                    'fullyCompletedScenarioCount': sum(all(r['complete'] for r in case['units'][method]) for case in cases),
                    'anyCompletedScenarioCount': sum(any(r['complete'] for r in case['units'][method]) for case in cases),
                    'meanScenarioCompletionRate': mean(rates)}
        for field, value in expected.items():
            numeric(recorded['byMethod'][method][field], value, f'{label}/{method}/{field}', 1e-12)
        init = [r.get('initializationEvidence') for case in cases for r in case['units'][method]]
        require(all(isinstance(r, dict) for r in init), label + '/missing D0 evidence')
        expected['initialization'] = {'knownDayZeroCount': sum(r.get('initialPlanAccepted') is not None for r in init),
            'acceptedInitialPlanCount': sum(r.get('initialPlanAccepted') is True for r in init),
            'knownInitialFailureCount': sum(r.get('failurePhase') == 'initialization' for r in init),
            'knownLaterFailureCount': sum(r.get('failurePhase') == 'after_initialization' for r in init),
            'unknownDayZeroCount': sum(r.get('initialPlanAccepted') is None for r in init)}
        compare_tree(recorded['byMethod'][method]['initialization'], expected['initialization'], label + '/' + method + '/initialization')
        output['byMethod'][method] = expected
    for pair_name, (baseline, candidate) in PAIRS.items():
        point = recorded['comparisons'][pair_name]
        observations = pair_observations(cases, baseline, candidate)
        fee_units = observations['feeUnits']
        completion_units = observations['completionUnits']
        matched_episode_count = observations['matchedEpisodeCount']
        matched_pairs, scenario_pairs = observations['matchedPairs'], observations['scenarioPairs']
        gains, losses = observations['gainIds'], observations['lossIds']
        known_gains, unknown_gains = observations['knownGainIds'], observations['unknownGainIds']
        gained, lost = len(gains), len(losses)
        for field, value in (('gainedEpisodeIds', gains), ('lostEpisodeIds', losses), ('gainedFromKnownFailureEpisodeIds', known_gains), ('gainedFromUnknownHistoryEpisodeIds', unknown_gains)):
            same(point['completion'].get(field), value, label + '/' + pair_name + '/' + field)
        same(point.get('baselineMethod'), baseline, label + '/baseline identity')
        same(point.get('candidateMethod'), candidate, label + '/candidate identity')
        numeric(point.get('scenarioCount'), len(cases), label + '/pair scenario coverage', 0)
        numeric(point.get('episodePairCount'), 3 * len(cases), label + '/pair episode coverage', 0)
        compare_tree(point.get('pairedScenarios'), scenario_pairs, label + '/matched scenario means')
        revisions = [(b, a) for _, b, a in matched_pairs if finite(b['revisionCount']) and finite(a['revisionCount'])]
        compare_tree(point.get('revisions'), {'pairedEpisodeCount': len(revisions),
            'baselineObservedSum': ordered_sum([b['revisionCount'] for b, a in revisions]),
            'candidateObservedSum': ordered_sum([a['revisionCount'] for b, a in revisions])}, label + '/pairwise revision proof')
        numeric(point['completion']['gainedEpisodeCount'], gained, label + '/completion gains', 0)
        numeric(point['completion']['lostEpisodeCount'], lost, label + '/completion losses', 0)
        numeric(point['completion']['meanScenarioRateGain'], -mean([u[1] for u in completion_units]),
                label + '/mean completion rate gain', 1e-12)
        completion = cluster_bootstrap(completion_units, seed, draws)
        numeric(point['completion']['uncertainty']['meanScenarioRateGain95CI'], completion['meanSavings95CI'],
                f'{label}/{pair_name}/completion interval', 1e-12)
        fees = {}
        for key, field in (('total', 'totalCost'), ('incremental', 'incrementalCost')):
            units = fee_units[field]
            expected = cluster_bootstrap(units, seed, draws)
            source = point['fees'][key]
            numeric(source['pairedScenarioCount'], len(units), label + '/paired scenario count', 0)
            numeric(source['pairedEpisodeCount'], matched_episode_count, label + '/paired episode count', 0)
            before = ordered_sum([b for b, _ in units])
            after = ordered_sum([a for _, a in units])
            numeric(source['baselineScenarioMeanSumKRW'], before, label + '/baseline scenario mean sum')
            numeric(source['candidateScenarioMeanSumKRW'], after, label + '/candidate scenario mean sum')
            raw_before = [b[field] for _, b, a in matched_pairs]
            raw_after = [a[field] for _, b, a in matched_pairs]
            compare_tree(source, {'scenarioWeightedSavingsKRW': before - after,
                'weightedSavingsPct': 100 * (before - after) / before if before else None,
                'baselineEpisodeSumKRW': ordered_sum(raw_before), 'candidateEpisodeSumKRW': ordered_sum(raw_after),
                'zeroBaselineScenarioCount': sum(b == 0 for b, a in units),
                'zeroBaselineEpisodeCount': sum(b == 0 for b in raw_before),
                'worstScenarioLossKRW': max([0] + [a - b for b, a in units]),
                'negativeScenarioIds': [scenario_pairs[i]['scenarioId'] for i, (b, a) in enumerate(units) if a - b > 1e-6],
                'negativeEpisodeIds': [pid for pid, b, a in matched_pairs if a[field] - b[field] > 1e-6],
                'scenarioWinTieLoss': {'win': sum(b - a > 1e-6 for b, a in units),
                    'tie': sum(abs(b - a) <= 1e-6 for b, a in units), 'loss': sum(a - b > 1e-6 for b, a in units)}}, label + '/' + pair_name + '/' + key + '/full conditional fee statistics')
            uncertainty = source['uncertainty']
            same(uncertainty['unit'], 'scenario', label + '/bootstrap sampling unit')
            numeric(uncertainty['scenarioCount'], expected['scenarioCount'], label + '/bootstrap denominator', 0)
            numeric(uncertainty['draws'], draws, label + '/bootstrap draws', 0)
            numeric(uncertainty['meanSavings95CI'], expected['meanSavings95CI'],
                    f'{label}/{pair_name}/{key}/mean fee interval')
            numeric(uncertainty['weightedSavingsPct95CI'], expected['weightedSavingsPct95CI'],
                    f'{label}/{pair_name}/{key}/percentage interval', 1e-9)
            fees[key] = {'pairedScenarioCount': len(units), 'pairedEpisodeCount': matched_episode_count, **expected}
        output['comparisons'][pair_name] = {'completionRateGain95CI': completion['meanSavings95CI'], 'fees': fees}
    output['jointCompletePareto'] = joint_complete_pareto(cases)
    compare_tree(recorded['jointCompletePareto'], output['jointCompletePareto'], label + '/common-seven-method Pareto')
    common = output['jointCompletePareto']
    output['allMethodCommonComplete'] = {'scenarioCount': common['jointScenarioCount'], 'episodeCount': common['jointEpisodeCount'],
        'byMethod': {method: {'totalScenarioMeanSumKRW': row['scenarioMeanTotalCostSumKRW'],
                              'incrementalScenarioMeanSumKRW': row['scenarioMeanIncrementalCostSumKRW'],
                              'revisionObservedSum': row['episodeRevisionCountSum']} for method, row in common['byMethod'].items()},
        'scope': common['scope'] + ' Thin-table revisionObservedSum is the raw matched-episode count; frontier revision axis uses scenarioMeanRevisionCountSum instead.'}
    compare_tree(recorded['allMethodCommonComplete'], output['allMethodCommonComplete'], label + '/common-seven-method thin table')
    output['observedDecisionGates'] = decision_gates(cases, output['comparisons'])
    compare_tree(recorded['observedDecisionGates'], output['observedDecisionGates'], label + '/observed decision gates')
    if 'nativeComparison' in recorded['observedDecisionGates']:
        compare_tree(recorded['observedDecisionGates']['nativeComparison'], output['observedDecisionGates']['nativeComparisons']['highsV8'], label + '/native alias consistency')
    return output


def audit_historical_seeds(protocol, source_root):
    """Reconstruct exclusions from SHA-bound old declarations, not new orders."""
    declaration = protocol.get('historicalSeedExclusions')
    require(isinstance(declaration, dict) and isinstance(declaration.get('sources'), list) and declaration['sources'], 'Missing historical seed source commitments')
    same([item.get('path') for item in declaration['sources']], list(HISTORICAL_SOURCES),
         'Prespecified complete historical metadata coverage')
    found, paths = set(), set()
    def walk(value, key=''):
        if isinstance(value, dict):
            for start, count in (('baseSeed', 'scenarioCount'), ('seedBase', 'caseCount')):
                if type(value.get(start)) is int and type(value.get(count)) is int:
                    require(0 <= value[count] <= 100000, 'Invalid historical declaration range')
                    found.update(range(value[start], value[start] + value[count]))
            for name, item in value.items(): walk(item, name)
        elif isinstance(value, list):
            for item in value: walk(item, key)
        elif type(value) is int and 'seed' in key.lower(): found.add(value)
    for source in declaration['sources']:
        name = source.get('path')
        require(isinstance(name, str) and name.startswith('data/') and not Path(name).is_absolute() and '..' not in Path(name).parts
                and name != 'data/protocol-v14.json' and name not in paths, 'Invalid/duplicate historical seed declaration path')
        paths.add(name)
        path = (source_root / name).resolve()
        require(path.is_relative_to(source_root.resolve()), 'Historical source path escapes frozen source')
        require(sha256(path) == source.get('sha256'), 'Historical seed source SHA differs: ' + name)
        walk(read_json(path))
    same(declaration.get('excludedSeeds'), sorted(found), 'Independent historical seed exclusion reconstruction')
    same(len(found), 1316, 'Prespecified conservative historical seed union size')
    business = set(range(791001, 791073)) | set(range(792001, 792073))
    require(not (found & (business | {79011, 79023, 79039})), 'V14 declared seeds overlap historical declarations')
    return {'metadataSourceCount': len(paths), 'excludedSeedCount': len(found), 'overlappingV14Seeds': 0}


def audit_first_run_binding(directory, index, frozen, frozen_path, manifest_hash):
    """Bind the run to its one WX first-run marker, rather than just a new output.

    This validates the recorded fixed marker and bytes. It does not authenticate
    the wall-clock timestamp or a remote Git host from a copied receipt.
    """
    same(index.get('manifestSha256'), manifest_hash, 'Original frozen manifest SHA')
    for field in ('sourceGitCommit', 'sourceGitTree', 'gitObjectFormat', 'committedBlobHashes', 'sourcePushReceipt'):
        same(index.get(field), frozen.get(field), 'Index/frozen provenance ' + field)
    push = frozen.get('sourcePushReceipt')
    require(isinstance(push, dict) and push.get('path') == 'source-push-receipt.json',
            'Fixed source push receipt path required')
    push_path = (frozen_path.parent / push['path']).resolve()
    require(push_path.is_relative_to(frozen_path.parent), 'Source push receipt escapes snapshot')
    same(sha256(push_path), push.get('sha256'), 'Root-observed source push receipt SHA')
    push_record = read_json(push_path)
    same(push_record, push.get('record'), 'Root-observed source push receipt bytes/content binding')
    for field, value in {'schemaVersion': 'portplan-v14-root-verified-source-push',
                         'sourceGitCommit': frozen['sourceGitCommit'], 'observedRemoteCommit': frozen['sourceGitCommit'],
                         'remoteName': 'origin', 'branch': 'main',
                         'verification': 'git push then authenticated git ls-remote exact branch; root observation, not external attestation'}.items():
        same(push_record.get(field), value, 'Root source push receipt ' + field)
    reference = index.get('executionStartArtifact')
    require(isinstance(reference, dict) and isinstance(reference.get('path'), str)
            and not Path(reference['path']).is_absolute(), 'Missing portable first-run marker binding')
    marker_path = (directory / reference['path']).resolve()
    same(marker_path, (frozen_path.parent / 'execution-start.json').resolve(), 'Fixed first-run marker location')
    same(sha256(marker_path), reference.get('sha256'), 'First-run marker SHA')
    marker = read_json(marker_path)
    for field, value in {'schemaVersion': 'portplan-v14-first-run-execution-start', 'rootAuthorized': True,
                         'manifestSha256': manifest_hash, 'protocolHash': index['protocolHash'],
                         'sourceGitCommit': frozen['sourceGitCommit'], 'sourcePushReceiptSha256': push['sha256'],
                         'plannedEpisodeCount': 3024}.items():
        same(marker.get(field), value, 'First-run marker ' + field)
    relative = marker.get('outputRelativeToFrozen')
    require(isinstance(relative, str) and not Path(relative).is_absolute(), 'Portable declared first-run output required')
    same((frozen_path.parent / relative).resolve(), directory, 'First-run marker exact output binding')
    return {'manifestSha256': manifest_hash, 'executionStartSha256': reference['sha256'],
            'rootObservedPushReceiptSha256': push['sha256'],
            'plannedEpisodeCount': 3024, 'fixedMarkerAndOutputBinding': True}


def review_run(directory):
    directory = directory.resolve()
    index_path = directory / 'complete.json'
    index_hash = sha256(index_path)
    index = read_json(index_path)
    require(index.get('executionState') == 'complete' and not index.get('fixture'), 'Requires a completed formal run')
    frozen_relative = index.get('frozenSource')
    require(isinstance(frozen_relative, str) and not Path(frozen_relative).is_absolute(),
            'Portable relative frozenSource is required')
    frozen_path = (directory / frozen_relative / 'manifest.json').resolve()
    require(frozen_path.parent.is_relative_to(directory.parent), 'Frozen source escapes restored run bundle')
    manifest_hash = sha256(frozen_path)
    frozen = read_json(frozen_path)
    first_run_binding = audit_first_run_binding(directory, index, frozen, frozen_path, manifest_hash)
    same(index['protocolHash'], frozen['protocolHash'], 'Frozen protocol hash binding')
    same(index['protocol'], frozen['protocol'], 'Frozen protocol declaration')
    require(sha256(frozen_path.parent / 'source/data/protocol-v14.json') == index['protocolHash'],
            'Frozen original protocol bytes differ')
    same(index.get('schemaVersion'), 'portplan-v14-streamed-experiment', 'Formal run schema')
    same(frozen.get('schemaVersion'), 'portplan-v14-frozen-source', 'Frozen manifest schema')
    same(index['implementationHashes'], frozen['implementationHashes'], 'Implementation commitments')
    require(sha256(__file__) == frozen['implementationHashes'].get('scripts/review-bootstrap-v14.py'),
            'Executing bootstrap auditor differs from its frozen source commitment')
    same(index['protocol']['analysis']['comparisons'], {k: list(v) for k, v in PAIRS.items()}, 'Prespecified comparison registry')
    same(index['protocol']['analysis']['candidateMethod'], 'guardedHiGHSV13', 'Natural-D0 candidate identity')
    groups = index['protocol']['analysis']['comparisonGroups']
    same(groups['primary'], list(PRIMARY_PAIRS), 'Prespecified primary comparison group')
    same(groups['secondary'], list(PAIRS)[6:], 'Prespecified secondary comparison group')
    same(index['protocol']['analysis']['nativeStabilityComparators'],
         ['seededHiGHSV12', 'commitmentHiGHSV11', 'stableHiGHSV10', 'highsV8'],
         'Prespecified native stability comparators')
    compare_tree(index['protocol']['analysis']['defaultGateDefinition'],
                 {'candidateMethod': 'guardedHiGHSV13', 'completePanelRequired': True,
                  'scenariosPerPanel': 72, 'repeatsPerScenario': 3, 'allMethodsPerRepeatRequired': True,
                  'comparators': list(METHODS[:-1]), 'maximumMatchingRepeatCompletionLossesPerComparator': 0,
                  'allowNetGainsToOffsetLosses': False, 'feeOrRevisionConditionInDefaultGate': False},
                 'Prespecified unchanged completion-only default gate')
    for name, expected in frozen['implementationHashes'].items():
        path = (frozen_path.parent / 'source' / name).resolve()
        require(path.is_relative_to((frozen_path.parent / 'source').resolve()), 'Frozen implementation path escapes snapshot')
        require(sha256(path) == expected, 'Frozen implementation SHA differs: ' + name)
    require(index['protocol'].get('executionAuthorization', {}).get('status') == 'ready-for-source-freeze', 'Protocol is not formally authorized')
    configuration = index['protocol']['analysis']['bootstrap']
    require(type(configuration.get('seed')) is int and type(configuration.get('draws')) is int,
            'Invalid declared bootstrap seed/draws')
    require(configuration['seed'] == 800001 and configuration['draws'] == 2000, 'V14 prescribed bootstrap differs')
    historical_seed_review = audit_historical_seeds(index['protocol'], frozen_path.parent / 'source')
    panels, count = load_units(directory, index, frozen)
    checked = {name: compare_panel(cases, index['summary']['panels'][name],
                                  configuration['seed'], configuration['draws'], name)
               for name, cases in panels.items()}
    require(sha256(index_path) == index_hash, 'Read-only review changed the run index')
    require(sha256(frozen_path) == manifest_hash, 'Frozen manifest changed during review')
    return {'schemaVersion': 'portplan-independent-v14-bootstrap-review', 'valid': True,
            'fixture': False, 'readOnly': True, 'importsJavaScript': False, 'solverRuns': 0,
            'protocolSha256': index['protocolHash'],
            'inputIndexSha256': index_hash, 'frozenManifestSha256': manifest_hash,
            'firstRunBinding': first_run_binding,
            'implementationSha256': sha256(__file__), 'episodeCount': count,
            'businessScenarioCount': 144, 'historicalSeedExclusions': historical_seed_review, 'panels': checked,
            'procedure': {'samplingUnit': 'whole business scenario', 'draws': 2000, 'seed': 800001,
                          'PRNG': '32-bit LCG: (1664525 * state + 1013904223) mod 2^32',
                          'interval': '2.5th and 97.5th percentiles with linear interpolation',
                          'repeatHandling': 'Average only matching jointly complete repeats within each fee scenario; keep all repeats in completion rates',
                          'comparisonGroups': {'primary': list(PRIMARY_PAIRS), 'secondary': list(PAIRS)[6:]},
                          'multiplicity': 'Unadjusted descriptive marginal intervals; no familywise or simultaneous superiority claim.',
                          'tolerances': {'feeKRW': 1e-6, 'percentagePoints': 1e-9, 'completionRate': 1e-12}},
            'scope': 'Independent formal parent final/normal exit/ESRCH group cleanup/end-to-end receipt eligibility, artifact binding, scenario aggregation and prescribed bootstrap interval reproduction. Does not audit physical execution/tariffs, establish optimality, remove completion-selection bias, or provide third-party certification. Recorded clocks and OS verification receipts are not externally authenticated.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', type=Path, required=True)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.output:
        require(not args.output.exists(), 'Refuse to overwrite an existing bootstrap audit')
    result = review_run(args.run)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('x', encoding='utf-8') as stream:
            stream.write(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(json.dumps({key: value for key, value in result.items() if key != 'panels'}, ensure_ascii=False, allow_nan=False))


if __name__ == '__main__':
    main()

