#!/usr/bin/env python3
"""Independent read-only V10 physical, native cache selection and tariff review.

The unchanged V9 reviewer supplies causal physical ledgers and the unchanged V9
candidate-delivery audit. V10 native selection is checked separately from full
original date proofs; no JavaScript, native solver, or model coefficients run.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('v10_unchanged_v9_review', ROOT / 'scripts/review-v9.py')
v9 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v9)
v8, ledger = v9.v8, v9.ledger
require, same, digest = v9.require, v9.same, v9.digest
METHODS = ['stableRetainV5', 'costPolishV7', 'adaptiveV9', 'highsV8', 'stableHiGHSV10']
PAIRS = {'v10VsHiGHS': ('highsV8', 'stableHiGHSV10'), 'v10VsV9': ('adaptiveV9', 'stableHiGHSV10'),
         'v10VsV7': ('costPolishV7', 'stableHiGHSV10'), 'v10VsV5': ('stableRetainV5', 'stableHiGHSV10'),
         'highsVsV7': ('costPolishV7', 'highsV8')}
PARAMETERS = v9.PARAMETERS
FEE_FIELDS = ('storageCost', 'ddCost', 'totalCost', 'sunkCost', 'incrementalCost', 'objectiveCost')


def reprice_dates(scenario, rows):
    require(isinstance(rows, list) and len(rows) == len(scenario['containers']), 'Complete fee endpoint missing')
    boxes = {c['id']: c for c in scenario['containers']}
    require(len({row['id'] for row in rows}) == len(boxes) and {row['id'] for row in rows} == set(boxes),
            'Complete fee endpoint has incorrect container coverage')
    totals = {field: 0 for field in FEE_FIELDS}
    for row in rows:
        costs = ledger.reprice(scenario, boxes[row['id']], row['pickupDay'], row['returnDay'])
        for field in FEE_FIELDS[:-1]:
            totals[field] += costs[field]
    totals['objectiveCost'] = totals['incrementalCost']
    return totals


def endpoint_fees(scenario, rows, claimed, label, allow_absent=False):
    if rows is None:
        same(claimed, None, label + '/absent fee endpoint')
        return None
    if claimed is None and allow_absent:
        return None
    totals = reprice_dates(scenario, rows)
    require(isinstance(claimed, dict), label + ': complete endpoint lacks current-snapshot fee proof')
    for field in FEE_FIELDS:
        ledger.close(claimed.get(field), totals[field], label + '/' + field)
    return totals


def pending_changes(before, after, fixed):
    if before is None or after is None:
        return None
    by_id = {row['id']: row for row in before}
    return sum(row[key] != by_id[row['id']][key] for row in after for key in ledger.EVENTS
               if key not in fixed.get(row['id'], {}))


def audit_native_endpoint_flags(scenario, rows, claimed, fixed, day, label):
    require(isinstance(claimed, dict), label + ': recorded date audit omitted')
    ids = {c['id'] for c in scenario['containers']}
    structural = (isinstance(rows, list) and len(rows) == len(ids)
                  and all(isinstance(row, dict) and row.get('id') in ids for row in rows)
                  and len({row['id'] for row in rows}) == len(ids)
                  and all(type(row.get(field)) is int and 0 <= row[field] < scenario['horizonDays'] for row in rows for field in ledger.EVENTS))
    physical = structural and ledger.feasible_dates(scenario, rows, {}, 0)
    frozen = structural and all(row[field] == fixed[row['id']][field] if field in fixed.get(row['id'], {}) else row[field] >= day
                                for row in rows for field in ledger.EVENTS)
    same(claimed.get('valid'), physical and frozen, label + '/combined independent validity')
    if structural:
        same(claimed.get('scheduleAudit', {}).get('valid'), physical, label + '/independent physical validity')
        same(claimed.get('freezeAudit', {}).get('valid'), frozen, label + '/independent past-lock validity')


def audit_native_selection(scenario, meta, decisions, fixed, previous, day, executed, label, budget=200):
    proof = meta.get('stabilitySelection')
    require(isinstance(proof, dict), label + ': missing V10 native stability selection proof')
    same(proof.get('rule'), 'strict_fee_replacement_retain_ties', label + '/selection rule')
    ledger.close(proof.get('feeEpsilonKRW'), 1e-6, label + '/frozen fee epsilon')
    ledger.close(meta.get('timeBudgetMs'), budget, label + '/whole-call budget')
    before, proposal, after = (proof.get(key) for key in ('beforeDates', 'proposalDates', 'afterDates'))
    if previous is None:
        same(before, None, label + '/first-call cache')
    else:
        require(isinstance(before, list), label + ': previous complete dates omitted')
        same(v8.date_map(before), v8.date_map(list(previous.values())), label + '/original cached date binding')
    cache_gate = proof.get('cacheGate', {})
    cache_audited = cache_gate.get('auditFinishedAtMs') is not None
    cache_valid = before is not None and cache_audited and ledger.feasible_dates(scenario, before, fixed, day)
    proposal_valid = proposal is not None and ledger.feasible_dates(scenario, proposal, fixed, day)
    before_fees = endpoint_fees(scenario, before, proof.get('beforeFees'), label + '/before', not cache_audited)
    proposal_fees = endpoint_fees(scenario, proposal, proof.get('proposalFees'), label + '/proposal', not proposal_valid)
    after_fees = endpoint_fees(scenario, after, proof.get('afterFees'), label + '/selected')
    require(type(proof.get('cacheValid')) is bool, label + ': cache validity must be boolean')
    same(proof['cacheValid'], cache_valid, label + '/independent cache validity')
    if cache_audited:
        audit_native_endpoint_flags(scenario, before, meta.get('stages', {}).get('cacheAudit'), fixed, day, label + '/cached endpoint audit')
    if proposal is not None and proof.get('nativeGate', {}).get('auditFinishedAtMs') is not None:
        audit_native_endpoint_flags(scenario, proposal, meta.get('stages', {}).get('native', {}).get('audit'), fixed, day,
                                    label + '/native endpoint audit')
    gates = {}
    for name, fields in (('cacheGate', ('auditFinishedAtMs', 'selectionFinishedAtMs', 'acceptedAtMs')),
                         ('nativeGate', ('receivedAtMs', 'copiedAtMs', 'auditFinishedAtMs', 'feesMatchedAtMs',
                                         'selectionFinishedAtMs', 'acceptedAtMs'))):
        gate = proof.get(name)
        require(isinstance(gate, dict), label + ': missing ' + name)
        values = [v9.optional_time(gate.get(field), label + '/' + name + '/' + field) for field in fields]
        present = [value for value in values if value is not None]
        require(present == sorted(present), label + ': native/cache copy-audit-selection chronology differs')
        if values[-1] is not None:
            require(all(value is not None and value <= budget for value in values),
                    label + ': V10 candidate was first accepted after the whole-call deadline')
            require(values[-1] >= values[-2], label + ': acceptance backdated before complete selection')
        gates[name] = gate
        for wall_name in ('wallTimeMs', 'wholeCallWallMs', 'callWallMs'):
            if wall_name in meta and present:
                require(ledger.finite(meta[wall_name]) and meta[wall_name] >= max(present),
                        label + ': planner wall clock predates recorded native selection')
    cache_accepted = gates['cacheGate'].get('acceptedAtMs') is not None
    native_accepted = gates['nativeGate'].get('acceptedAtMs') is not None
    if cache_accepted:
        require(cache_valid, label + ': invalid cached schedule passed the acceptance gate')
    if native_accepted:
        require(proposal_valid, label + ': invalid native proposal passed the acceptance gate')
        if cache_accepted:
            require(proposal_fees['incrementalCost'] < before_fees['incrementalCost'] - 1e-6,
                    label + ': native replaced a valid cache without strict fee improvement; fee ties must retain')
    native = meta.get('nativeCertificate')
    native_stage = meta.get('stages', {}).get('native', {})
    if proposal is not None:
        require(isinstance(native, dict) and native.get('hasIncumbent') is True, label + ': proposed dates lack a complete native certificate')
        if proposal_valid and gates['nativeGate'].get('feesMatchedAtMs') is not None:
            costs = native.get('independentCosts', {})
            matches = native.get('objectiveCost') == proposal_fees['objectiveCost'] and all(costs.get(field) == proposal_fees[field] for field in FEE_FIELDS[:-1])
            same(native_stage.get('independentCostsMatch'), matches, label + '/native certificate independent-fee reconciliation')
            if native_accepted:
                require(matches, label + ': native candidate accepted despite a fee-certificate mismatch')
    if cache_accepted and gates['nativeGate'].get('receivedAtMs') is not None:
        require(gates['nativeGate']['receivedAtMs'] >= gates['cacheGate']['acceptedAtMs'], label + ': native receipt predates completed cache gate')
    selected = proof.get('selectedSource')
    require(selected in ('cached_incumbent', 'native_highs', 'no_complete_plan'), label + ': undeclared native selected source')
    same(meta.get('candidateSource'), selected, label + '/selected source binding')
    if selected == 'native_highs':
        require(native_accepted, label + ': selected native schedule has no timely complete acceptance')
        same(v8.date_map(after), v8.date_map(proposal), label + '/selected native dates')
    elif selected == 'cached_incumbent':
        require(cache_accepted and not native_accepted, label + ': selected cache lacks timely acceptance or discards accepted native')
        same(v8.date_map(after), v8.date_map(before), label + '/retained fee tie / costlier native dates')
    else:
        require(not cache_accepted and not native_accepted, label + ': timely complete native/cache incumbent discarded')
        same(after, None, label + '/failed selected dates')
    reason, outcome = proof.get('decisionReason'), gates['nativeGate'].get('outcome')
    if native_accepted:
        expected_reason = 'strict_fee_replacement' if cache_accepted else 'replace_invalid_cache' if proof.get('cacheStatus') == 'invalid' else 'initialize_native'
        same(reason, expected_reason, label + '/native decision reason')
        same(outcome, expected_reason, label + '/native gate outcome')
    elif selected == 'cached_incumbent' and outcome in ('retain_fee_tie', 'retain_costlier_native'):
        require(proposal_valid and proposal_fees is not None and gates['nativeGate'].get('selectionFinishedAtMs') is not None,
                label + ': native tie/costlier decision lacks a valid completely audited proposal')
        require(gates['nativeGate']['selectionFinishedAtMs'] <= budget, label + ': tie/costlier selection completed after deadline')
        difference = proposal_fees['incrementalCost'] - before_fees['incrementalCost']
        expected_reason = 'retain_fee_tie' if abs(difference) <= 1e-6 else 'retain_costlier_native'
        require(difference >= -1e-6, label + ': timely strictly cheaper native plan incorrectly retained the cache')
        same(reason, expected_reason, label + '/retained decision reason')
        same(outcome, expected_reason, label + '/retained gate outcome')
    same(executed, selected != 'no_complete_plan', label + '/actual execution acceptance')
    if executed:
        same(v8.date_map(decisions), v8.date_map(after), label + '/actual decision endpoint')
        ledger.audit_dates(scenario, after, label + '/selected full physical audit', fixed, day)
    if cache_valid and proposal_valid and before_fees is not None and proposal_fees is not None:
        ledger.close(proof.get('nativeCostMinusCacheKRW'), proposal_fees['incrementalCost'] - before_fees['incrementalCost'],
                     label + '/native minus cache fee')
    else:
        same(proof.get('nativeCostMinusCacheKRW'), None, label + '/unavailable native/cache comparison')
    if cache_valid and before_fees is not None and after_fees is not None:
        ledger.close(proof.get('cacheCostMinusSelectedKRW'), before_fees['incrementalCost'] - after_fees['incrementalCost'],
                     label + '/cache minus selected fee')
    else:
        same(proof.get('cacheCostMinusSelectedKRW'), None, label + '/unavailable selected fee comparison')
    same(proof.get('changedEventCount'), pending_changes(before, after, fixed) if cache_valid else None, label + '/selected pending-event changes')
    same(proof.get('proposalChangedEventCount'), pending_changes(before, proposal, fixed) if cache_valid and proposal_valid else None,
         label + '/proposed pending-event changes')
    return {'calls': 1, 'cacheAcceptedCalls': int(cache_accepted), 'nativeAcceptedCalls': int(native_accepted),
            'retainedCacheCalls': int(selected == 'cached_incumbent'), 'completeNativeProposals': int(proposal is not None),
            'strictReplacements': int(cache_accepted and native_accepted),
            'feeTiesRetained': int(selected == 'cached_incumbent' and outcome == 'retain_fee_tie')}


def audit_episode(nominal, events, result, label='episode', hardWallMs=5000, method=None, call_budget=200):
    checked = v9.audit_episode(nominal, events, result, label, hardWallMs, method, call_budget)
    counts = {field: 0 for field in ('calls', 'cacheAcceptedCalls', 'nativeAcceptedCalls', 'retainedCacheCalls',
                                    'completeNativeProposals', 'strictReplacements', 'feeTiesRetained')}
    method = method or result.get('policy')
    if method == 'stableHiGHSV10' and checked['historyAvailable']:
        actual, fixed, previous = ledger.realize(nominal, events), {}, None
        for day, (entry, call) in enumerate(zip(result['timeline'], result['plannerTrace'])):
            observation, _ = ledger.observed_snapshot(nominal, actual, events, day)
            audited = audit_native_selection(observation, v8.metadata(call), entry['decisions'], fixed, previous,
                                              day, entry.get('status') == 'executed', label + f'/D{day}', call_budget)
            for field, value in audited.items():
                counts[field] += value
            same(v8.metadata(call).get('strictReplacementCount'), counts['strictReplacements'], label + '/cumulative strict replacement counter')
            same(v8.metadata(call).get('tieRetainedCount'), counts['feeTiesRetained'], label + '/cumulative retained-tie counter')
            if entry.get('status') == 'executed':
                previous = {row['id']: row for row in entry['decisions']}
                for event in entry['executedEvents']:
                    fixed.setdefault(event['id'], {})[ledger.EVENT_FIELDS[event['event']]] = day
    return {**checked, 'nativeStabilitySelection': counts}


def declared_cases(protocol):
    same(protocol.get('schemaVersion'), 'portplan-protocol-v10', 'Formal protocol schema')
    same(protocol['methods'], METHODS, 'Formal method registry')
    matrix = protocol['matrix']
    same(matrix, {'mechanisms': ['aged-backlog', 'new-arrivals', 'batch-release'],
                  'capacityProfiles': ['balanced', 'tight'], 'counts': [24, 50, 100], 'scenariosPerCell': 4}, 'Formal matrix')
    same([p['id'] for p in protocol['panels']], ['same-distribution', 'stress'], 'Formal panel identities')
    same([p['baseSeed'] for p in protocol['panels']], [491001, 492001], 'Unseen business seeds')
    same(protocol['algorithmRepeats'], [{'index': i + 1, 'seed': seed} for i, seed in enumerate((49011, 49023, 49039))],
         'Frozen timing/algorithm repeats')
    result = []
    for panel in protocol['panels']:
        index = 0
        for mechanism in matrix['mechanisms']:
            for capacity in matrix['capacityProfiles']:
                for count in matrix['counts']:
                    for repetition in range(1, 5):
                        pattern = panel['shockPatterns'][(repetition - 1) % len(panel['shockPatterns'])]
                        result.append({'id': f"v10-{panel['id']}-{mechanism}-{capacity}-n{count}-r{repetition}",
                                       'panel': panel['id'], 'dataRole': 'held-out', 'mechanism': mechanism,
                                       'capacityProfile': capacity, 'count': count, 'scenarioRepeat': repetition,
                                       'seed': panel['baseSeed'] + index, 'shockPattern': pattern['name'], 'shocks': pattern['shocks']})
                        index += 1
        require(index == panel['scenarioCount'] == 72, 'Formal panel count differs')
    return result


def point_estimates(by_panel, producer_summary, fixture):
    output = {}
    for panel, cases in by_panel.items():
        require(fixture or len(cases) == 72, 'Panel coverage changed')
        producer = producer_summary['panels'][panel]
        result = {'byMethod': {}, 'comparisons': {}}
        for method in METHODS:
            units = [r for case in cases for r in case['units'][method]]
            expected = {'recordedEpisodeCount': len(units), 'completeEpisodeCount': sum(r['complete'] for r in units),
                        'fullyCompletedScenarioCount': sum(all(r['complete'] for r in c['units'][method]) for c in cases),
                        'anyCompletedScenarioCount': sum(any(r['complete'] for r in c['units'][method]) for c in cases)}
            for field, value in expected.items():
                same(producer['byMethod'][method][field], value, panel + '/' + method + '/' + field)
            result['byMethod'][method] = expected
        for name, (baseline, candidate) in PAIRS.items():
            gained = lost = paired = before_changes = after_changes = 0
            pairs = []
            for case in cases:
                matched = []
                for b, a in zip(case['units'][baseline], case['units'][candidate]):
                    gained += a['complete'] and not b['complete']
                    lost += b['complete'] and not a['complete']
                    if a['complete'] and b['complete']:
                        matched.append((b, a)); paired += 1
                        before_changes += b['revisionCount']; after_changes += a['revisionCount']
                if matched:
                    pairs.append({field: (sum(b[field] for b, _ in matched) / len(matched),
                                          sum(a[field] for _, a in matched) / len(matched)) for field in ('totalCost', 'incrementalCost')})
            p = producer['comparisons'][name]
            same(p['completion']['gainedEpisodeCount'], gained, panel + '/completion gained')
            same(p['completion']['lostEpisodeCount'], lost, panel + '/completion lost')
            same(p['revisions']['baselineObservedSum'], before_changes, panel + '/baseline revisions')
            same(p['revisions']['candidateObservedSum'], after_changes, panel + '/candidate revisions')
            fees = {}
            for field, key in (('totalCost', 'total'), ('incrementalCost', 'incremental')):
                before, after = sum(p[field][0] for p in pairs), sum(p[field][1] for p in pairs)
                counts = {'win': sum(b - a > 1e-6 for b, a in (p[field] for p in pairs)),
                          'tie': sum(abs(b - a) <= 1e-6 for b, a in (p[field] for p in pairs)),
                          'loss': sum(a - b > 1e-6 for b, a in (p[field] for p in pairs))}
                fee = p['fees'][key]
                same(fee['pairedScenarioCount'], len(pairs), panel + '/paired scenarios')
                same(fee['pairedEpisodeCount'], paired, panel + '/paired episodes')
                same(fee['scenarioWinTieLoss'], counts, panel + '/scenario win/tie/loss')
                ledger.close(fee['baselineScenarioMeanSumKRW'], before, panel + '/baseline fee')
                ledger.close(fee['candidateScenarioMeanSumKRW'], after, panel + '/candidate fee')
                if before:
                    ledger.close(fee['weightedSavingsPct'], 100 * (before - after) / before, panel + '/fee percentage')
                else:
                    same(fee['weightedSavingsPct'], None, panel + '/zero denominator')
                fees[key] = {'pairedScenarios': len(pairs), 'pairedEpisodes': paired,
                             'baselineScenarioMeanSumKRW': before, 'candidateScenarioMeanSumKRW': after, 'scenarioWinTieLoss': counts}
            result['comparisons'][name] = {'gainedEpisodes': gained, 'lostEpisodes': lost, 'fees': fees,
                                            'revisions': [before_changes, after_changes]}
        output[panel] = result
    return output


def review_run(directory, fixture=False):
    directory = directory.resolve()
    index_path = directory / 'complete.json'
    index_hash = digest(index_path)
    index = json.loads(index_path.read_text())
    same(index.get('schemaVersion'), 'portplan-v10-streamed-experiment', 'Formal run schema')
    same(index.get('executionState'), 'complete', 'Formal run completion')
    protocol = index['protocol']
    same(protocol['methods'], METHODS, 'Formal methods')
    require(fixture or len(index['cases']) == 144, 'Formal coverage differs from frozen 144 cases')
    snapshot = (directory / index['frozenSource']).resolve()
    frozen_path = snapshot / 'manifest.json'
    frozen = json.loads(frozen_path.read_text())
    same(frozen.get('schemaVersion'), 'portplan-v10-frozen-source', 'Frozen schema')
    same(index['protocolHash'], frozen['protocolHash'], 'Protocol binding')
    same(protocol, frozen['protocol'], 'Protocol content')
    if not fixture:
        same(frozen['scenarioMetadata'], declared_cases(protocol), 'Independent formal declaration expansion')
        require(protocol['budget']['hardWallMs'] == 5000 and protocol['budget']['cpuThreads'] == 1, 'Formal budget differs')
        old_protocol = json.loads((snapshot / 'source/data/protocol-v9.json').read_text())
        for method in ('stableRetainV5', 'costPolishV7', 'adaptiveV9', 'highsV8'):
            same(protocol['callBudgets'][method], old_protocol['callBudgets'][method], 'Unchanged baseline configuration ' + method)
        same(protocol['callBudgets']['stableHiGHSV10'], protocol['callBudgets']['highsV8'], 'Unchanged native numeric parameters')
        for method in ('costPolishV7', 'adaptiveV9', 'highsV8', 'stableHiGHSV10'):
            same(protocol['callBudgets'][method]['timeBudgetMs'], 200, 'Prespecified daily budget ' + method)
        same(protocol['callBudgets']['stableRetainV5']['timeLimitSeconds'], .2, 'Prespecified legacy solver budget')
        require(not any(field in protocol['callBudgets']['adaptiveV9'] for field in ('onIncumbent', 'onCandidate')),
                'Formal diagnostic observers are forbidden')
    require(digest(snapshot / 'source/data/protocol-v10.json') == index['protocolHash'], 'Protocol bytes differ')
    same(index['implementationHashes'], frozen['implementationHashes'], 'Implementation commitments')
    for path, expected in frozen['implementationHashes'].items():
        source = (snapshot / 'source' / path).resolve()
        require(source.is_relative_to((snapshot / 'source').resolve()), 'Implementation path escapes snapshot')
        require(digest(source) == expected, 'Frozen implementation changed: ' + path)
    generator_protocol = json.loads((snapshot / 'source/data/protocol-v2.json').read_text())
    counters = {'episodes': 0, 'completeEpisodes': 0, 'historyUnavailable': 0, 'acceptedPlans': 0,
                'physicalEvents': 0, 'polishEndpoints': 0}
    candidate_counts = {key: 0 for key in ('candidateEvents', 'completeCopiedCandidates', 'acceptedCandidates',
                                         'independentlyInvalidCandidates', 'callsWithTimelyIncumbent')}
    native_counts = {field: 0 for field in ('calls', 'cacheAcceptedCalls', 'nativeAcceptedCalls', 'retainedCacheCalls',
                                          'completeNativeProposals', 'strictReplacements', 'feeTiesRetained')}
    by_panel, reviewed = {}, []
    require(len(index['cases']) == len(frozen['scenarioMetadata']), 'Frozen/run case count differs')
    seen_ids = set()
    for scenario_index, case in enumerate(index['cases']):
        require(case['id'] not in seen_ids, 'Duplicate case id'); seen_ids.add(case['id'])
        config = frozen['scenarioMetadata'][scenario_index]
        for field, value in config.items():
            same(case.get(field), value, 'Case/frozen declaration ' + field)
        input_path, source = v8.checked_artifact(directory, case['inputArtifact'])
        same(source['config'], config, 'Declared scenario config')
        nominal, events = source['nominalScenario'], source['events']
        same(nominal, ledger.generated_scenario(config, generator_protocol), 'Independent synthetic input reconstruction')
        expected_events = []
        for shock in config['shocks']:
            cap = ledger.capacity(nominal, shock['resource'], shock['revealDay'])
            event = {k: v for k, v in shock.items() if k not in ('reductionNumerator', 'reductionDenominator')}
            event['capacity'] = max(0, cap - math.ceil(cap * shock['reductionNumerator'] / shock['reductionDenominator']))
            expected_events.append(event)
        same(events, expected_events, 'Independent declared shock reconstruction')
        require(len(case['repeats']) == 3, 'Missing timing/algorithm repeat')
        units = {method: [] for method in METHODS}
        for ri, repetition in enumerate(case['repeats']):
            same(repetition['repeatIndex'], ri + 1, 'Repeat ordering')
            same(repetition['algorithmSeed'], protocol['algorithmRepeats'][ri]['seed'], 'Repeat seed')
            same(set(repetition['policies']), set(METHODS), 'Missing/extra method')
            same(repetition['methodExecutionOrder'], [METHODS[(scenario_index + ri + i) % 5] for i in range(5)], 'Method rotation')
            for method in METHODS:
                receipt = repetition['policies'][method]
                _, envelope = v8.checked_artifact(directory, receipt['artifact'])
                for key, value in (('caseId', case['id']), ('method', method), ('panel', case['panel']),
                                   ('repeatIndex', ri + 1), ('algorithmSeed', repetition['algorithmSeed'])):
                    same(envelope.get(key), value, 'Episode binding ' + key)
                same(envelope.get('episodeId'), f"{case['id']}--a{ri + 1}--{method}", 'Canonical episode identity')
                result = envelope['result']
                same(result['policy'], method, 'Result method identity')
                configuration = protocol['callBudgets'][method]
                if not result.get('executionHistoryUnavailable'):
                    same(result['algorithmSeed'], repetition['algorithmSeed'], 'Result seed')
                    same(result['repeatIndex'], ri + 1, 'Result repeat')
                    if method == 'adaptiveV9':
                        for call in result['plannerTrace']:
                            meta = v8.metadata(call)
                            require(meta.get('action') in ('initialize', 'retain', 'polish', 'rebuild', 'failed'), 'Missing adaptive action')
                            same(meta.get('wholeCallBudgetMs'), configuration['timeBudgetMs'], 'Frozen adaptive call budget')
                            for field in PARAMETERS:
                                require(field in configuration, 'Unfrozen adaptive parameter: ' + field)
                                same(meta.get('parameters', {}).get(field), configuration[field], 'Frozen adaptive parameter ' + field)
                for field in ('complete', 'status', 'auditValid', 'totalCost', 'incrementalCost', 'revisionCount', 'wallTimeMs'):
                    same(receipt.get(field), result.get(field), 'Scalar/full receipt ' + field)
                same(receipt.get('terminalRowCount'), len(result['rows']), 'Terminal row count')
                checked = audit_episode(nominal, events, result, envelope['episodeId'], protocol['budget']['hardWallMs'],
                                        method, configuration.get('timeBudgetMs', 200))
                units[method].append(result)
                counters['episodes'] += 1; counters['completeEpisodes'] += checked['complete']
                counters['historyUnavailable'] += not checked['historyAvailable']; counters['acceptedPlans'] += checked['acceptedPlans']
                counters['physicalEvents'] += checked['executedEvents']; counters['polishEndpoints'] += checked.get('polishEndpoints', 0)
                for key, value in checked['candidateDelivery'].items():
                    candidate_counts[key] += value
                for key, value in checked['nativeStabilitySelection'].items():
                    native_counts[key] += value
                reviewed.append({'id': envelope['episodeId'], 'artifactSha256': receipt['artifact']['sha256'], **checked})
        by_panel.setdefault(case['panel'], []).append({'id': case['id'], 'units': units})
        require(digest(input_path) == case['inputArtifact']['sha256'], 'Read-only review changed scenario input')
    estimates = point_estimates(by_panel, index['summary'], fixture)
    require(fixture or counters['episodes'] == 2160, 'Formal episode coverage must be 144 x 3 x 5')
    require(digest(index_path) == index_hash, 'Read-only review changed final index')
    return {'schemaVersion': 'portplan-independent-v10-run-review', 'valid': True, 'fixture': fixture, 'readOnly': True,
            'importsJavaScript': False, 'solverRuns': 0, 'inputIndexSha256': index_hash,
            'frozenManifestSha256': digest(frozen_path), 'implementationSha256': digest(__file__),
            'unchangedV9ReviewSha256': digest(ROOT / 'scripts/review-v9.py'),
            'unchangedV8ReviewSha256': digest(ROOT / 'scripts/review-v8.py'), 'ledgerSha256': digest(ROOT / 'scripts/review-v5.py'),
            'summary': counters, 'candidateDelivery': candidate_counts, 'nativeStabilitySelection': native_counts,
            'pointEstimates': estimates, 'episodes': reviewed,
            'scope': 'Internal independent input, causal execution, fee/resource, complete copied candidate, recorded outer timestamp/selection consistency and point-estimate review; clock timestamps are not externally authenticated; bootstrap independently reviewed separately; no optimality or third-party certification'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--episode', type=Path)
    source.add_argument('--run', type=Path)
    parser.add_argument('--fixture', action='store_true', help='Handwritten artifact-I/O tests only; not a formal result')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.run:
        result = review_run(args.run, args.fixture)
    else:
        before = digest(args.episode)
        record = json.loads(args.episode.read_text())
        case = record.get('case', record.get('input', record))
        checked = audit_episode(case['nominalScenario'], case.get('events', []), record['result'],
                                record.get('episodeId', record.get('caseId', 'episode')), record['result'].get('hardWallMs', 5000))
        require(digest(args.episode) == before, 'Read-only review changed input')
        result = {'schemaVersion': 'portplan-independent-v10-episode-review', 'valid': True, 'readOnly': True,
                  'importsJavaScript': False, 'solverRuns': 0, 'inputSha256': before, 'implementationSha256': digest(__file__),
                  'unchangedV8ReviewSha256': digest(ROOT / 'scripts/review-v8.py'), 'ledgerSha256': digest(ROOT / 'scripts/review-v5.py'),
                  'checked': checked, 'scope': 'Internal physical reconstruction and recorded candidate timestamp/selection consistency; no external clock authentication'}
    if args.output:
        require(not args.output.exists(), 'Refuse to replace a previous review')
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(json.dumps({key: value for key, value in result.items() if key != 'episodes'}, ensure_ascii=False, allow_nan=False))


if __name__ == '__main__':
    main()
