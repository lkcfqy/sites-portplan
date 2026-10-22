#!/usr/bin/env python3
"""Independently reconstruct V10 scenario-cluster bootstrap confidence intervals.

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

METHODS = ('stableRetainV5', 'costPolishV7', 'adaptiveV9', 'highsV8', 'stableHiGHSV10')
PAIRS = {
    'v10VsHiGHS': ('highsV8', 'stableHiGHSV10'),
    'v10VsV9': ('adaptiveV9', 'stableHiGHSV10'),
    'v10VsV7': ('costPolishV7', 'stableHiGHSV10'),
    'v10VsV5': ('stableRetainV5', 'stableHiGHSV10'),
    'highsVsV7': ('costPolishV7', 'highsV8'),
}

FEES = ('totalCost', 'incrementalCost', 'storageCost', 'ddCost', 'sunkCost', 'objectiveCost', 'lateCount')
RECEIPT_FIELDS = (*FEES, 'policy', 'status', 'complete', 'auditValid', 'executionHistoryUnavailable',
                  'episodeCompletedWithinBudget', 'outputDeliveredWithinBudget', 'wallTimeMs',
                  'finalReceivedMs', 'receiptValidatedMs', 'revisionCount')


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
    return json.loads(Path(path).read_text(encoding='utf-8'), parse_constant=reject_constant)


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


def artifact_path(directory, artifact):
    require(isinstance(artifact, dict) and isinstance(artifact.get('path'), str), 'Missing episode artifact')
    path = (directory / artifact['path']).resolve()
    require(path.is_relative_to(directory), 'Episode artifact escapes the run directory')
    require(sha256(path) == artifact.get('sha256'), 'Episode artifact SHA differs: ' + artifact['path'])
    return path


def load_units(directory, index, frozen):
    protocol = index['protocol']
    same(protocol['methods'], list(METHODS), 'Method registry')
    declarations = frozen['scenarioMetadata']
    require(len(declarations) == len(index['cases']) == 144, 'Expected 144 distinct business scenarios')
    seeds = protocol['algorithmRepeats']
    require(len(seeds) == 3 and len({item['seed'] for item in seeds}) == 3, 'Expected three declared repeats')
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
                for name in RECEIPT_FIELDS:
                    same(receipt.get(name), result.get(name), 'Scalar/full receipt field: ' + name)
                same(receipt['terminalRowCount'], len(result['rows']), 'Scalar/full terminal row count')
                same(result['policy'], method, 'Result policy identity')
                if not result.get('executionHistoryUnavailable'):
                    same(result['algorithmSeed'], repetition['algorithmSeed'], 'Result seed identity')
                    same(result['repeatIndex'], repetition_index + 1, 'Result repeat identity')
                same(result['hardWallMs'], protocol['budget']['hardWallMs'], 'Hard episode budget')
                eligible = complete_from_full(result, len(result['rows']), protocol['budget']['hardWallMs'])
                units[method].append({'complete': eligible, 'totalCost': result['totalCost'],
                                      'incrementalCost': result['incrementalCost'], 'revisionCount': result.get('revisionCount')})
                count += 1
        panels.setdefault(case['panel'], []).append({'id': case['id'], 'units': units})
    same(list(panels), [panel['id'] for panel in protocol['panels']], 'Separate panel ordering')
    require(all(len(cases) == 72 for cases in panels.values()) and count == 2160, 'Incomplete panel/episode coverage')
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
            'eligibility': 'all-five-matching-complete-repeats', 'byMethod': by_method, 'frontiers': frontiers, 'scenarios': scenarios,
            'scope': 'Conditional all-five jointly completed matching repeats; average within scenario then equal scenario weight. No revision-to-KRW conversion. This table never overrides full-sample completion losses or establishes universal dominance.'}


def conditional_fee_claim(interval):
    if interval is None:
        return 'unavailable'
    if interval[0] > 0:
        return 'conditional_savings_interval_positive'
    if interval[1] < 0:
        return 'conditional_deterioration_interval_negative'
    return 'no_stable_advantage'


def decision_gates(cases, independent_comparisons):
    candidate = 'stableHiGHSV10'
    baseline_keys = {'highsV8': 'v10VsHiGHS', 'adaptiveV9': 'v10VsV9', 'costPolishV7': 'v10VsV7', 'stableRetainV5': 'v10VsV5'}
    losses = {method: sum(before['complete'] and not after['complete'] for case in cases
                          for before, after in zip(case['units'][method], case['units'][candidate])) for method in baseline_keys}
    matched = [(before, after) for case in cases for before, after in zip(case['units']['highsV8'], case['units'][candidate])
               if before['complete'] and after['complete']]
    known = [(before, after) for before, after in matched if finite(before['revisionCount']) and finite(after['revisionCount'])]
    delta = ordered_sum([a['revisionCount'] - b['revisionCount'] for b, a in known]) if known and len(known) == len(matched) else None
    strict = delta is not None and delta < 0
    fees = independent_comparisons['v10VsHiGHS']['fees']
    total = fees['total']['weightedSavingsPct95CI']
    incremental = fees['incremental']['weightedSavingsPct95CI']
    no_deterioration = total is not None and incremental is not None and total[1] >= 0 and incremental[1] >= 0
    no_loss = all(value == 0 for value in losses.values())
    complete_panel = len(cases) == 72 and all(all(len(case['units'][method]) == 3 for method in METHODS) for case in cases)
    return {'candidateMethod': candidate, 'completionLossCountsByBaseline': losses,
            'assessmentState': 'complete-panel' if complete_panel else 'partial-panel',
            'completionNonRegressionAllBaselines': no_loss, 'defaultRecommendationEligible': complete_panel and no_loss,
            'nativeComparison': {'lostEpisodeCount': losses['highsV8'], 'revisionPairedEpisodeCount': len(known),
                'revisionDelta': delta, 'strictRevisionReduction': strict,
                'incrementalFeeClaim': conditional_fee_claim(incremental), 'totalFeeClaim': conditional_fee_claim(total),
                'noRobustFeeDeterioration': no_deterioration,
                'stabilityImprovementClaimAllowed': complete_panel and losses['highsV8'] == 0 and strict and no_deterioration},
            'scope': 'Observed necessary gates only. Any full-sample completion loss against an old baseline prevents default eligibility. A fee interval containing zero gives no stable fee advantage; stability is conditional on the exact native paired set. No production or universal non-regression claim.'}


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
        output['byMethod'][method] = expected
    for pair_name, (baseline, candidate) in PAIRS.items():
        point = recorded['comparisons'][pair_name]
        fee_units = {field: [] for field in ('totalCost', 'incrementalCost')}
        completion_units, matched_episode_count = [], 0
        gained = lost = 0
        for case in cases:
            matched, rate_changes = [], []
            for before, after in zip(case['units'][baseline], case['units'][candidate]):
                b, a = before['complete'], after['complete']
                gained += a and not b
                lost += b and not a
                rate_changes.append(int(a) - int(b))
                if b and a:
                    matched.append((before, after))
            # Zero baseline and negative candidate encode the mean completion
            # gain as a savings statistic without resampling individual repeats.
            completion_units.append((0.0, -mean(rate_changes)))
            if matched:
                matched_episode_count += len(matched)
                for field in fee_units:
                    fee_units[field].append((mean([b[field] for b, _ in matched]),
                                             mean([a[field] for _, a in matched])))
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
    compare_tree(recorded['jointCompletePareto'], output['jointCompletePareto'], label + '/common-five-method Pareto')
    common = output['jointCompletePareto']
    output['allMethodCommonComplete'] = {'scenarioCount': common['jointScenarioCount'], 'episodeCount': common['jointEpisodeCount'],
        'byMethod': {method: {'totalScenarioMeanSumKRW': row['scenarioMeanTotalCostSumKRW'],
                              'incrementalScenarioMeanSumKRW': row['scenarioMeanIncrementalCostSumKRW'],
                              'revisionObservedSum': row['episodeRevisionCountSum']} for method, row in common['byMethod'].items()},
        'scope': common['scope'] + ' Thin-table revisionObservedSum is the raw matched-episode count; frontier revision axis uses scenarioMeanRevisionCountSum instead.'}
    compare_tree(recorded['allMethodCommonComplete'], output['allMethodCommonComplete'], label + '/common-five-method thin table')
    output['observedDecisionGates'] = decision_gates(cases, output['comparisons'])
    compare_tree(recorded['observedDecisionGates'], output['observedDecisionGates'], label + '/observed decision gates')
    return output


def review_run(directory):
    directory = directory.resolve()
    index_path = directory / 'complete.json'
    index_hash = sha256(index_path)
    index = read_json(index_path)
    require(index.get('executionState') == 'complete' and not index.get('fixture'), 'Requires a completed formal run')
    frozen_path = (directory / index['frozenSource'] / 'manifest.json').resolve()
    frozen = read_json(frozen_path)
    same(index['protocolHash'], frozen['protocolHash'], 'Frozen protocol hash binding')
    same(index['protocol'], frozen['protocol'], 'Frozen protocol declaration')
    require(sha256(frozen_path.parent / 'source/data/protocol-v10.json') == index['protocolHash'],
            'Frozen original protocol bytes differ')
    configuration = index['protocol']['analysis']['bootstrap']
    require(type(configuration.get('seed')) is int and type(configuration.get('draws')) is int,
            'Invalid declared bootstrap seed/draws')
    require(configuration['seed'] == 700001 and configuration['draws'] == 2000, 'V10 prescribed bootstrap differs')
    panels, count = load_units(directory, index, frozen)
    checked = {name: compare_panel(cases, index['summary']['panels'][name],
                                  configuration['seed'], configuration['draws'], name)
               for name, cases in panels.items()}
    require(sha256(index_path) == index_hash, 'Read-only review changed the run index')
    return {'schemaVersion': 'portplan-independent-v10-bootstrap-review', 'valid': True,
            'readOnly': True, 'importsJavaScript': False, 'solverRuns': 0,
            'inputIndexSha256': index_hash, 'frozenManifestSha256': sha256(frozen_path),
            'implementationSha256': sha256(__file__), 'episodeCount': count,
            'businessScenarioCount': 144, 'panels': checked,
            'procedure': {'samplingUnit': 'whole business scenario', 'draws': 2000, 'seed': 700001,
                          'PRNG': '32-bit LCG: (1664525 * state + 1013904223) mod 2^32',
                          'interval': '2.5th and 97.5th percentiles with linear interpolation',
                          'repeatHandling': 'Average only matching jointly complete repeats within each fee scenario; keep all repeats in completion rates',
                          'tolerances': {'feeKRW': 1e-6, 'percentagePoints': 1e-9, 'completionRate': 1e-12}},
            'scope': 'Independent receipt eligibility, artifact binding, scenario aggregation and prescribed bootstrap interval reproduction. Does not audit physical execution/tariffs, establish optimality, remove completion-selection bias, or provide third-party certification.'}


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

