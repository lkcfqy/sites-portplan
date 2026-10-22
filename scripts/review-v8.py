#!/usr/bin/env python3
"""Read-only independent review of V8 physical histories and tariff arithmetic.

Uses the Python date/fee/resource ledger, never JavaScript model coefficients.
Does not solve or establish optimality; a successful audit is internal evidence.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('v8_independent_ledger', ROOT / 'scripts/review-v5.py')
ledger = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ledger)
TOTALS = (*ledger.TOTAL_KEYS, 'objectiveCost', 'lateCount')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def same(actual, expected, label):
    require(actual == expected, label + ': inconsistent independent reconstruction')


def metadata(trace):
    return trace.get('plannerMetadata', trace.get('metadata', trace))


def fee_for_dates(scenario, rows):
    boxes = {c['id']: c for c in scenario['containers']}
    return sum(ledger.reprice(scenario, boxes[r['id']], r['pickupDay'], r['returnDay'])['incrementalCost'] for r in rows)


def date_map(rows):
    return {row['id']: {key: row[key] for key in ledger.EVENTS} for row in rows}


def audit_polish_proof(scenario, proof, fixed, day, label):
    if not isinstance(proof, dict) or not proof.get('seedAccepted'):
        return 0
    before, after = proof.get('beforeDates'), proof.get('afterDates')
    ledger.audit_dates(scenario, before, label + '/before', fixed, day)
    ledger.audit_dates(scenario, after, label + '/after', fixed, day)
    b, a = fee_for_dates(scenario, before), fee_for_dates(scenario, after)
    require(a <= b + 1e-6, label + ': same-snapshot polishing increased joint fee')
    ledger.close(proof.get('seedIncrementalCost'), b, label + '/seed fee')
    ledger.close(proof.get('finalIncrementalCost'), a, label + '/polished fee')
    return 1


def independent_pressure(scenario, audited, day, lookahead):
    days = list(range(day + 1, min(scenario['horizonDays'], day + lookahead + 1)))
    result = {}
    for index, resource in enumerate(ledger.RESOURCES):
        positive = [d for d in days if ledger.capacity(scenario, resource, d) > 0]
        result[resource] = {
            'peakUtilization': max((audited['usage'][d][index] / ledger.capacity(scenario, resource, d) for d in positive), default=0),
            'saturatedDays': sum(audited['usage'][d][index] == ledger.capacity(scenario, resource, d) for d in positive),
            'minimumHeadroom': min((ledger.capacity(scenario, resource, d) - audited['usage'][d][index] for d in days), default=None),
            'zeroCapacityDays': sum(ledger.capacity(scenario, resource, d) == 0 for d in days)}
    return result


def audit_episode(nominal, events, result, label='episode', hardWallMs=5000):
    ledger.validate_scenario(nominal, label)
    actual = ledger.realize(nominal, events)
    require(type(result.get('complete')) is bool, label + ': completion must be boolean')
    complete = result['complete']
    unknown = result.get('executionHistoryUnavailable') is True
    require(result.get('hardWallMs') == hardWallMs, label + ': hard budget differs')
    wall = result.get('wallTimeMs')
    require(ledger.finite(wall) and wall >= 0, label + ': missing parent wall clock')
    if not complete:
        require(result.get('rows') == [] and all(result.get(k) is None for k in TOTALS),
                label + ': partial/failed output must have null complete fees')
    if unknown:
        require(not complete and result.get('timeline') == [] and result.get('executedEvents') == [],
                label + ': unknown physical history cannot contain apparent execution')
        require(result.get('revisionCount') is None, label + ': unknown revisions converted to zero')
        return {'complete': False, 'historyAvailable': False, 'acceptedPlans': 0,
                'timelineEntries': 0, 'executedEvents': 0, 'revisions': None, 'pricedRows': 0}
    require(result.get('outputDeliveredWithinBudget') is True and wall <= hardWallMs,
            label + ': known terminal history must be accepted within the parent budget')
    for name in ('finalReceivedMs', 'receiptValidatedMs'):
        if name in result:
            require(ledger.finite(result[name]) and 0 <= result[name] <= hardWallMs,
                    label + ': invalid ' + name)
    if result.get('receiptValidatedMs') is not None and result.get('finalReceivedMs') is not None:
        require(result['finalReceivedMs'] <= result['receiptValidatedMs'], label + ': audit precedes receipt')
    timeline, trace = result.get('timeline'), result.get('plannerTrace')
    require(isinstance(timeline, list) and 1 <= len(timeline) <= nominal['horizonDays'], label + ': timeline missing')
    require(isinstance(trace, list) and len(trace) == len(timeline), label + ': planner trace incomplete')
    fixed, previous, flattened = {}, None, []
    revisions = accepted = polish_proofs = 0
    actions = {}
    for day, (entry, call) in enumerate(zip(timeline, trace)):
        same(entry.get('day'), day, label + '/day')
        same(call.get('day'), day, label + '/trace day')
        observation, observations = ledger.observed_snapshot(nominal, actual, events, day)
        same(entry.get('observedEvents'), observations, label + f'/D{day}/observations')
        hashed = {'scenario': observation, 'observedEvents': observations, 'fixedEvents': fixed, 'minEventDay': day}
        require(ledger.checksum(hashed, entry.get('observationHash', '')) == entry.get('observationHash'),
                label + f'/D{day}: causal observation hash differs')
        meta = metadata(call)
        require(isinstance(meta, dict), label + ': invalid planner metadata')
        action = meta.get('action')
        if action:
            require(action in ('initialize', 'retain', 'polish', 'rebuild', 'failed'), label + ': undeclared V8 action')
            actions[action] = actions.get(action, 0) + 1
        decisions, executed = entry.get('decisions'), entry.get('executedEvents')
        require(isinstance(decisions, list) and isinstance(executed, list), label + ': malformed physical ledger')
        if entry.get('status') == 'executed':
            audited = ledger.audit_dates(observation, decisions, label + f'/D{day}', fixed, day)
            if action:
                cached_valid = previous is not None and ledger.feasible_dates(observation, list(previous.values()), fixed, day)
                require(action != 'failed', label + ': failed action cannot execute a plan')
                if action == 'initialize':
                    require(previous is None, label + ': initialization mislabeled an existing-history decision')
                elif action == 'rebuild':
                    require(previous is not None and not cached_valid, label + ': rebuild requires an invalid previous plan')
                else:
                    require(cached_valid, label + ': retain/polish requires a valid previous plan')
            if action == 'retain':
                require(previous is not None, label + ': retained without a previous plan')
                same(audited['byId'], previous, label + f'/D{day}/retained dates')
            expected = [{'id': row['id'], 'event': ledger.EVENT_NAMES[key], 'day': day}
                        for row in decisions for key in ledger.EVENTS if row[key] == day]
            same(executed, expected, label + f'/D{day}/physical actions')
            changes = [{'id': row['id'], 'event': ledger.EVENT_NAMES[key],
                        'previousDay': previous[row['id']][key], 'newDay': row[key]}
                       for row in decisions for key in ledger.EVENTS
                       if previous is not None and key not in fixed.get(row['id'], {})
                       and previous[row['id']][key] != row[key]]
            same(entry.get('revisions'), changes, label + f'/D{day}/changes')
            revisions += len(changes)
            proof_paths = [('direct', meta.get('polishMetadata')),
                           ('cached', meta.get('stages', {}).get('polish', {}).get('metadata')),
                           ('recovery', meta.get('recoveryMetadata', {}).get('polishMetadata'))]
            for proof_name, proof in proof_paths:
                polish_proofs += audit_polish_proof(observation, proof, fixed, day, label + '/' + proof_name)
            if action == 'polish':
                require(previous is not None, label + ': adaptive polishing has no reference plan')
                accepted_proof = meta.get('stages', {}).get('polish', {}).get('metadata')
                require(isinstance(accepted_proof, dict) and accepted_proof.get('seedAccepted') is True,
                        label + ': accepted adaptive polish lacks its complete endpoint proof')
                same(date_map(accepted_proof['beforeDates']), date_map(list(previous.values())),
                     label + '/accepted polish reference binding')
                same(date_map(accepted_proof['afterDates']), date_map(decisions),
                     label + '/accepted polish result binding')
                old = ledger.audit_dates(observation, list(previous.values()), label + '/adaptive previous', fixed, day)
                baseline_fee, candidate_fee = fee_for_dates(observation, list(previous.values())), fee_for_dates(observation, decisions)
                require(candidate_fee < baseline_fee - 1e-6, label + ': adaptive polish is not strictly cheaper')
                parameters = meta.get('parameters', {})
                require(type(parameters.get('maxChangedEvents')) is int and len(changes) <= parameters['maxChangedEvents'],
                        label + ': adaptive change limit violated')
                same(meta.get('dateChanges', {}).get('changedEventCount'), len(changes), label + '/adaptive change metadata')
                tolerance = parameters.get('feeToleranceRatio')
                require(ledger.finite(tolerance) and tolerance >= 0, label + ': invalid declared fee tolerance')
                require(baseline_fee > candidate_fee * (1 + tolerance) + 1e-6,
                        label + ': adaptive small-savings stability rule violated')
                proxy = meta.get('pressureProxy', {})
                before = independent_pressure(observation, old, day, parameters['lookaheadDays'])
                after = independent_pressure(observation, audited, day, parameters['lookaheadDays'])
                for resource in ledger.RESOURCES:
                    for field in ('peakUtilization', 'saturatedDays', 'minimumHeadroom', 'zeroCapacityDays'):
                        for side, values in (('before', before), ('after', after)):
                            recorded = proxy.get(side, {}).get('resources', {}).get(resource, {}).get(field)
                            expected = values[resource][field]
                            if expected is None:
                                same(recorded, None, label + '/adaptive pressure')
                            else:
                                ledger.close(recorded, expected, label + '/adaptive pressure')
                    if parameters.get('pressureGuard'):
                        require(after[resource]['peakUtilization'] <= before[resource]['peakUtilization'] + 1e-6
                                and after[resource]['saturatedDays'] <= before[resource]['saturatedDays'],
                                label + ': adaptive resource pressure guard violated')
            for event in executed:
                field = ledger.EVENT_FIELDS[event['event']]
                require(field not in fixed.get(event['id'], {}), label + ': repeated physical action')
                fixed.setdefault(event['id'], {})[field] = day
            previous = audited['byId']
            accepted += 1
        else:
            require(day == len(timeline) - 1 and not executed,
                    label + ': failed planning executed actions or continued')
        same(entry.get('revisionCount'), revisions, label + f'/D{day}/cumulative changes')
        same(entry.get('state'), ledger.execution_state(nominal, fixed, day if entry.get('status') == 'executed' else day - 1),
             label + f'/D{day}/state')
        flattened.extend(executed)
    same(result.get('executedEvents'), flattened, label + '/all physical actions')
    same(result.get('revisionCount'), revisions, label + '/all changes')
    same(result.get('finalState'), timeline[-1]['state'], label + '/final state')
    if complete:
        require(result.get('status') in ('feasible', 'optimal') and result.get('auditValid') is True,
                label + ': false complete status')
        require(len(flattened) == 3 * len(nominal['containers']), label + ': missing lifecycle actions')
        ledger.audit_schedule(actual, result, label + '/independent final fees and resources')
        for row in result['rows']:
            require(all(row[k] == fixed.get(row['id'], {}).get(k) for k in ledger.EVENTS),
                    label + ': final rows differ from actual execution')
    return {'complete': complete, 'historyAvailable': True, 'timelineEntries': len(timeline),
            'acceptedPlans': accepted, 'executedEvents': len(flattened), 'revisions': revisions,
            'pricedRows': len(result['rows']) if complete else 0, 'polishEndpoints': polish_proofs,
            'adaptiveActions': actions, 'totalCost': result.get('totalCost'),
            'incrementalCost': result.get('incrementalCost')}


def audit_record(record):
    case = record.get('case', record)
    return audit_episode(case['nominalScenario'], case.get('events', []), record['result'],
                         record.get('episodeId', record.get('caseId', case.get('id', 'episode'))),
                         record.get('hardWallMs', record['result'].get('hardWallMs', 5000)))


def checked_artifact(directory, artifact):
    path = (directory / artifact['path']).resolve()
    require(path.is_relative_to(directory.resolve()), 'Artifact escapes run directory')
    require(digest(path) == artifact['sha256'], 'Artifact SHA differs: ' + artifact['path'])
    return path, json.loads(path.read_text())


def declared_cases(protocol):
    require(protocol['methods'] == ['stableRetainV5', 'lockedRecoveryV6', 'costPolishV7', 'adaptiveV8', 'highsV8'],
            'Formal method registry differs')
    matrix = protocol['matrix']
    same(matrix, {'mechanisms': ['aged-backlog', 'new-arrivals', 'batch-release'],
                  'capacityProfiles': ['balanced', 'tight'], 'counts': [24, 50, 100], 'scenariosPerCell': 4},
         'Formal matrix')
    same([p['id'] for p in protocol['panels']], ['same-distribution', 'stress'], 'Formal panel identities')
    require(len(protocol['algorithmRepeats']) == 3 and len({r['seed'] for r in protocol['algorithmRepeats']}) == 3,
            'Formal repeats missing or duplicated')
    result, seeds = [], set()
    for panel in protocol['panels']:
        index = 0
        for mechanism in matrix['mechanisms']:
            for capacity in matrix['capacityProfiles']:
                for count in matrix['counts']:
                    for repetition in range(1, 5):
                        pattern = panel['shockPatterns'][(repetition - 1) % len(panel['shockPatterns'])]
                        seed = panel['baseSeed'] + index
                        require(seed not in seeds, 'Formal generator seed reused')
                        seeds.add(seed)
                        result.append({'id': f"v8-{panel['id']}-{mechanism}-{capacity}-n{count}-r{repetition}",
                                       'panel': panel['id'], 'dataRole': 'held-out', 'mechanism': mechanism,
                                       'capacityProfile': capacity, 'count': count, 'scenarioRepeat': repetition,
                                       'seed': seed, 'shockPattern': pattern['name'], 'shocks': pattern['shocks']})
                        index += 1
        require(index == panel['scenarioCount'] == 72, 'Formal panel count differs')
    return result


def review_run(directory, fixture=False):
    directory = directory.resolve()
    index_path = directory / 'complete.json'
    index_hash = digest(index_path)
    index = json.loads(index_path.read_text())
    require(index.get('executionState') == 'complete', 'Formal run is not complete')
    protocol = index['protocol']
    methods = protocol['methods']
    require(fixture or len(index['cases']) == 144 and len(methods) == 5, 'Formal coverage differs from frozen 144 x 5')
    snapshot = (directory / index['frozenSource']).resolve()
    frozen_path = snapshot / 'manifest.json'
    frozen = json.loads(frozen_path.read_text())
    same(index['protocolHash'], frozen['protocolHash'], 'Protocol binding')
    same(protocol, frozen['protocol'], 'Protocol content')
    if not fixture:
        same(frozen['scenarioMetadata'], declared_cases(protocol), 'Independent formal declaration expansion')
        require(protocol['budget']['hardWallMs'] == 5000 and protocol['budget']['cpuThreads'] == 1,
                'Formal budget/thread declaration differs')
    require(digest(snapshot / 'source/data/protocol-v8.json') == index['protocolHash'], 'Protocol original bytes differ')
    same(index['implementationHashes'], frozen['implementationHashes'], 'Implementation commitments')
    for path, expected in frozen['implementationHashes'].items():
        require(digest(snapshot / 'source' / path) == expected, 'Frozen implementation changed: ' + path)
    generator_protocol = json.loads((snapshot / 'source/data/protocol-v2.json').read_text())
    by_panel = {}
    counters = {'episodes': 0, 'completeEpisodes': 0, 'historyUnavailable': 0, 'acceptedPlans': 0,
                'physicalEvents': 0, 'polishEndpoints': 0}
    reviewed = []
    for scenario_index, case in enumerate(index['cases']):
        require(case['id'] == frozen['scenarioMetadata'][scenario_index]['id'], 'Scenario ordering/identity differs')
        for field, value in frozen['scenarioMetadata'][scenario_index].items():
            same(case.get(field), value, 'Case/frozen declaration ' + field)
        input_path, source = checked_artifact(directory, case['inputArtifact'])
        same(source['config'], frozen['scenarioMetadata'][scenario_index], 'Declared scenario config')
        nominal, events = source['nominalScenario'], source['events']
        same(nominal, ledger.generated_scenario(source['config'], generator_protocol), 'Independent synthetic input reconstruction')
        expected_events = []
        for shock in source['config']['shocks']:
            cap = ledger.capacity(nominal, shock['resource'], shock['revealDay'])
            event = {k: v for k, v in shock.items() if k not in ('reductionNumerator', 'reductionDenominator')}
            event['capacity'] = max(0, cap - math.ceil(cap * shock['reductionNumerator'] / shock['reductionDenominator']))
            expected_events.append(event)
        same(events, expected_events, 'Independent declared shock reconstruction')
        require(len(case['repeats']) == 3, 'Missing algorithm/timing repeat')
        units = {method: [] for method in methods}
        for repeat_index, repetition in enumerate(case['repeats']):
            require(repetition['repeatIndex'] == repeat_index + 1, 'Reordered/missing repeat')
            same(repetition['algorithmSeed'], protocol['algorithmRepeats'][repeat_index]['seed'], 'Repeat seed')
            same(set(repetition['policies']), set(methods), 'Missing/extra method')
            expected_order = [methods[(scenario_index + repeat_index + i) % len(methods)] for i in range(len(methods))]
            same(repetition['methodExecutionOrder'], expected_order, 'Method rotation')
            for method in methods:
                receipt = repetition['policies'][method]
                path, envelope = checked_artifact(directory, receipt['artifact'])
                same(envelope['caseId'], case['id'], 'Episode case id')
                same(envelope['method'], method, 'Episode method')
                same(envelope['panel'], case['panel'], 'Episode panel')
                same(envelope['repeatIndex'], repeat_index + 1, 'Episode repeat')
                same(envelope['algorithmSeed'], repetition['algorithmSeed'], 'Episode declared seed')
                result = envelope['result']
                same(result['policy'], method, 'Result policy identity')
                if not result.get('executionHistoryUnavailable'):
                    same(result['algorithmSeed'], repetition['algorithmSeed'], 'Result declared seed')
                    same(result['repeatIndex'], repeat_index + 1, 'Result repeat')
                    if method == 'adaptiveV8':
                        configuration = protocol['callBudgets'][method]
                        for call in result['plannerTrace']:
                            meta = metadata(call)
                            require(meta.get('action') in ('initialize', 'retain', 'polish', 'rebuild', 'failed'),
                                    'Adaptive action missing from complete trace')
                            same(meta.get('wholeCallBudgetMs'), configuration['timeBudgetMs'], 'Adaptive frozen call budget')
                            for field in ('feeToleranceRatio', 'maxChangedEvents', 'lookaheadDays', 'pressureGuard',
                                          'opportunityThresholdKRW', 'auditReserveMs'):
                                require(field in configuration, 'Adaptive parameter not explicitly frozen: ' + field)
                                same(meta.get('parameters', {}).get(field), configuration[field], 'Adaptive frozen parameter ' + field)
                for field in ('complete', 'status', 'auditValid', 'totalCost', 'incrementalCost', 'revisionCount', 'wallTimeMs'):
                    same(receipt.get(field), result.get(field), 'Scalar/full receipt ' + field)
                same(receipt.get('terminalRowCount'), len(result['rows']), 'Terminal row count')
                checked = audit_episode(nominal, events, result, envelope['episodeId'], protocol['budget']['hardWallMs'])
                units[method].append(result)
                counters['episodes'] += 1
                counters['completeEpisodes'] += checked['complete']
                counters['historyUnavailable'] += not checked['historyAvailable']
                counters['acceptedPlans'] += checked['acceptedPlans']
                counters['physicalEvents'] += checked['executedEvents']
                counters['polishEndpoints'] += checked.get('polishEndpoints', 0)
                reviewed.append({'id': envelope['episodeId'], 'artifactSha256': receipt['artifact']['sha256'], **checked})
        by_panel.setdefault(case['panel'], []).append({'id': case['id'], 'units': units})
        require(digest(input_path) == case['inputArtifact']['sha256'], 'Review changed scenario input')
    point_estimates = {}
    pairs = {'adaptiveVsV7': ('costPolishV7', 'adaptiveV8'), 'adaptiveVsV5': ('stableRetainV5', 'adaptiveV8'),
             'adaptiveVsV6': ('lockedRecoveryV6', 'adaptiveV8'), 'adaptiveVsHiGHS': ('highsV8', 'adaptiveV8'),
             'highsVsV7': ('costPolishV7', 'highsV8')}
    for panel, cases in by_panel.items():
        require(fixture or len(cases) == 72, 'Panel coverage changed')
        producer = index['summary']['panels'][panel]
        output = {'byMethod': {}, 'comparisons': {}}
        for method in methods:
            all_results = [r for c in cases for r in c['units'][method]]
            expected = {'recordedEpisodeCount': len(all_results), 'completeEpisodeCount': sum(r['complete'] for r in all_results),
                        'fullyCompletedScenarioCount': sum(all(r['complete'] for r in c['units'][method]) for c in cases),
                        'anyCompletedScenarioCount': sum(any(r['complete'] for r in c['units'][method]) for c in cases)}
            for field, value in expected.items():
                same(producer['byMethod'][method][field], value, panel + '/' + method + '/' + field)
            output['byMethod'][method] = expected
        for pair_name, (baseline, candidate) in pairs.items():
            gained = lost = 0
            scenario_pairs = []
            revisions_before = revisions_after = 0
            paired_episodes = 0
            for c in cases:
                matched = []
                for b, a in zip(c['units'][baseline], c['units'][candidate]):
                    gained += a['complete'] and not b['complete']
                    lost += b['complete'] and not a['complete']
                    if b['complete'] and a['complete']:
                        matched.append((b, a))
                        paired_episodes += 1
                        revisions_before += b['revisionCount']
                        revisions_after += a['revisionCount']
                if matched:
                    scenario_pairs.append({field: (sum(b[field] for b, _ in matched) / len(matched),
                                                   sum(a[field] for _, a in matched) / len(matched))
                                           for field in ('totalCost', 'incrementalCost')})
            p = producer['comparisons'][pair_name]
            same(p['completion']['gainedEpisodeCount'], gained, panel + '/gained')
            same(p['completion']['lostEpisodeCount'], lost, panel + '/lost')
            same(p['revisions']['baselineObservedSum'], revisions_before, panel + '/baseline revisions')
            same(p['revisions']['candidateObservedSum'], revisions_after, panel + '/candidate revisions')
            fees = {}
            for field, key in (('totalCost', 'total'), ('incrementalCost', 'incremental')):
                before = sum(row[field][0] for row in scenario_pairs)
                after = sum(row[field][1] for row in scenario_pairs)
                counts = {'win': sum(b - a > 1e-6 for b, a in (row[field] for row in scenario_pairs)),
                          'tie': sum(abs(b - a) <= 1e-6 for b, a in (row[field] for row in scenario_pairs)),
                          'loss': sum(a - b > 1e-6 for b, a in (row[field] for row in scenario_pairs))}
                f = p['fees'][key]
                same(f['pairedScenarioCount'], len(scenario_pairs), panel + '/paired scenarios')
                same(f['pairedEpisodeCount'], paired_episodes, panel + '/paired episodes')
                same(f['scenarioWinTieLoss'], counts, panel + '/win tie loss')
                ledger.close(f['baselineScenarioMeanSumKRW'], before, panel + '/baseline fee')
                ledger.close(f['candidateScenarioMeanSumKRW'], after, panel + '/candidate fee')
                if before:
                    ledger.close(f['weightedSavingsPct'], 100 * (before - after) / before, panel + '/fee percentage')
                else:
                    same(f['weightedSavingsPct'], None, panel + '/zero denominator')
                fees[key] = {'pairedScenarios': len(scenario_pairs), 'pairedEpisodes': paired_episodes,
                             'baselineScenarioMeanSumKRW': before, 'candidateScenarioMeanSumKRW': after,
                             'scenarioWinTieLoss': counts}
            output['comparisons'][pair_name] = {'gainedEpisodes': gained, 'lostEpisodes': lost, 'fees': fees,
                                                'revisions': [revisions_before, revisions_after]}
        point_estimates[panel] = output
    require(fixture or counters['episodes'] == 2160, 'Formal episode coverage must be 144 x 3 x 5')
    require(digest(index_path) == index_hash, 'Read-only review changed final index')
    return {'schemaVersion': 'portplan-independent-v8-run-review', 'valid': True, 'fixture': fixture, 'readOnly': True,
            'importsJavaScript': False, 'solverRuns': 0, 'inputIndexSha256': index_hash,
            'frozenManifestSha256': digest(frozen_path), 'implementationSha256': digest(__file__),
            'ledgerSha256': digest(ROOT / 'scripts/review-v5.py'), 'summary': counters,
            'pointEstimates': point_estimates, 'episodes': reviewed,
            'scope': 'Internal independent input generation, causal execution, tariff/resource reconstruction, adaptive acceptance guards and point-estimate review; bootstrap intervals not independently recalculated; no third-party certification or optimality proof'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--episode', type=Path)
    source.add_argument('--run', type=Path)
    parser.add_argument('--fixture', action='store_true', help='Handcrafted artifact-I/O tests only; never a formal result')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.run:
        result = review_run(args.run, fixture=args.fixture)
    else:
        before = digest(args.episode)
        record = json.loads(args.episode.read_text())
        checked = audit_record(record)
        require(before == digest(args.episode), 'read-only review changed input')
        result = {'schemaVersion': 'portplan-independent-v8-episode-review', 'valid': True,
                  'importsJavaScript': False, 'solverRuns': 0, 'inputSha256': before,
                  'implementationSha256': digest(__file__), 'ledgerSha256': digest(ROOT / 'scripts/review-v5.py'),
                  'scope': 'Internal independent causal physical ledger and fee/resource reconstruction; no optimality or external certification',
                  'checked': checked}
    if args.output:
        require(not args.output.exists(), 'Refuse to replace a previous review')
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(json.dumps({k:v for k,v in result.items() if k != 'episodes'}, ensure_ascii=False, allow_nan=False))


if __name__ == '__main__':
    main()
