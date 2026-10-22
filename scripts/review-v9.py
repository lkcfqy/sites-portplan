#!/usr/bin/env python3
"""Independent, read-only V9 candidate-acceptance and executed-path review.

No solver or JavaScript is imported. Reuses the unchanged Python V8 physical
ledger, but expands the V9 declaration and checks every copied candidate against
the current public snapshot. Recorded monotonic timestamps are consistency
evidence, not external authentication of the machine clock.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('v9_unchanged_v8_review', ROOT / 'scripts/review-v8.py')
v8 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v8)
ledger = v8.ledger
require, same, digest = v8.require, v8.same, v8.digest
METHODS = ['stableRetainV5', 'costPolishV7', 'adaptiveV8', 'adaptiveV9', 'highsV8']
PAIRS = {'v9VsV8': ('adaptiveV8', 'adaptiveV9'), 'v9VsV7': ('costPolishV7', 'adaptiveV9'),
         'v9VsV5': ('stableRetainV5', 'adaptiveV9'), 'v9VsHiGHS': ('highsV8', 'adaptiveV9'),
         'highsVsV7': ('costPolishV7', 'highsV8')}
PARAMETERS = ('feeToleranceRatio', 'maxChangedEvents', 'lookaheadDays', 'pressureGuard',
              'opportunityThresholdKRW', 'auditReserveMs')
SOURCES = {'cache', 'locked_constructor', 'recovery_polish', 'locked_milp', 'adaptive_polish'}
OUTCOMES = {'accepted', 'closed', 'rejected_late_receipt', 'rejected_status', 'rejected_copy_error',
            'rejected_late_copy', 'rejected_audit_error', 'rejected_late_audit', 'rejected_invalid',
            'rejected_selection_error', 'rejected_async_selection', 'rejected_late_selection',
            'rejected_guard', 'not_improved'}


def optional_time(value, label):
    require(value is None or ledger.finite(value) and value >= 0, label + ': invalid relative timestamp')
    return value


def independent_candidate_flags(scenario, rows, fixed, day):
    """Independent structural, physical and freeze checks, including rejection flags."""
    containers = {c['id']: c for c in scenario['containers']}
    structural = isinstance(rows, list) and len(rows) == len(containers)
    seen = set()
    if structural:
        for row in rows:
            if not isinstance(row, dict) or row.get('id') not in containers or row.get('id') in seen:
                structural = False; break
            seen.add(row['id'])
            if not all(type(row.get(key)) is int and 0 <= row[key] < scenario['horizonDays'] for key in ledger.EVENTS):
                structural = False; break
            if row['unloadDay'] + containers[row['id']]['unloadDays'] - 1 >= scenario['horizonDays']:
                structural = False; break
    if not structural:
        return False, False, None
    schedule_valid = True
    try:
        ledger.audit_dates(scenario, rows, 'independent complete candidate', {}, 0)
    except (ValueError, TypeError, KeyError, IndexError):
        schedule_valid = False
    freeze_valid = all(row[key] == fixed[row['id']][key] if key in fixed.get(row['id'], {}) else row[key] >= day
                       for row in rows for key in ledger.EVENTS)
    if schedule_valid and freeze_valid:
        return True, True, ledger.audit_dates(scenario, rows, 'independent locked candidate', fixed, day)
    return schedule_valid, freeze_valid, None


def candidate_guard(scenario, previous, rows, fixed, day, parameters, label):
    """Rebuild the adaptive cache-to-polish acceptance rule from date proofs."""
    require(previous is not None, label + ': adaptive candidate has no cached reference')
    old_rows = list(previous.values())
    before = ledger.audit_dates(scenario, old_rows, label + '/previous', fixed, day)
    after = ledger.audit_dates(scenario, rows, label + '/candidate', fixed, day)
    old_fee, new_fee = v8.fee_for_dates(scenario, old_rows), v8.fee_for_dates(scenario, rows)
    require(new_fee < old_fee - 1e-6, label + ': adaptive candidate is not strictly cheaper')
    changes = sum(row[key] != previous[row['id']][key] for row in rows for key in ledger.EVENTS
                  if key not in fixed.get(row['id'], {}))
    cap = parameters.get('maxChangedEvents')
    require(type(cap) is int and 0 <= changes <= cap, label + ': adaptive candidate change limit violated')
    tolerance = parameters.get('feeToleranceRatio')
    require(ledger.finite(tolerance) and tolerance >= 0, label + ': invalid adaptive fee tolerance')
    require(old_fee > new_fee * (1 + tolerance) + 1e-6, label + ': adaptive stability fee guard violated')
    lookahead = parameters.get('lookaheadDays')
    require(type(lookahead) is int and lookahead >= 1, label + ': invalid pressure lookahead')
    if parameters.get('pressureGuard'):
        b = v8.independent_pressure(scenario, before, day, lookahead)
        a = v8.independent_pressure(scenario, after, day, lookahead)
        for resource in ledger.RESOURCES:
            require(a[resource]['peakUtilization'] <= b[resource]['peakUtilization'] + 1e-6
                    and a[resource]['saturatedDays'] <= b[resource]['saturatedDays'],
                    label + ': adaptive candidate resource pressure guard violated')


def audit_gate(scenario, meta, decisions, fixed, previous, day, executed, label, budget=200, call_id=None):
    proof = meta.get('candidateDelivery')
    require(isinstance(proof, dict), label + ': missing V9 outer-gate proof')
    same(proof.get('schemaVersion'), 'portplan-v9-candidate-delivery-1', label + '/gate schema')
    same(proof.get('deadlineBasis'), 'outer-planner-start', label + '/clock basis')
    ledger.close(proof.get('wholeCallBudgetMs'), budget, label + '/outer budget')
    same(proof.get('minEventDay'), day, label + '/observation day')
    require(type(proof.get('callId')) is int and proof['callId'] > 0, label + ': invalid call id')
    if call_id is not None:
        same(proof['callId'], call_id, label + '/call sequence')
    same(proof.get('closed'), True, label + '/gate closure')
    events = proof.get('events')
    require(isinstance(events, list), label + ': candidate event list missing')
    accepted, best, last_observed = [], None, 0
    complete_candidates = rejected_invalid = 0
    for sequence, event in enumerate(events, 1):
        e = label + f'/candidate-{sequence}'
        require(isinstance(event, dict), e + ': malformed event')
        same(event.get('sequence'), sequence, e + '/sequence')
        require(event.get('source') in SOURCES, e + ': undeclared candidate source')
        outcome = event.get('outcome')
        require(outcome in OUTCOMES, e + ': missing/undeclared outcome')
        names = ('receivedAtMs', 'copyCompletedAtMs', 'auditCompletedAtMs', 'selectionCompletedAtMs', 'acceptedAtMs')
        times = {name: optional_time(event.get(name), e + '/' + name) for name in names}
        require(times['receivedAtMs'] is not None and times['receivedAtMs'] >= last_observed,
                e + ': candidate receipt is missing or clock moved backwards')
        present = [times[name] for name in names if times[name] is not None]
        require(present == sorted(present), e + ': receipt/copy/audit/selection ordering differs')
        last_observed = max(present)
        if outcome == 'rejected_late_receipt':
            require(times['receivedAtMs'] > budget, e + ': false late-receipt rejection')
        elif outcome != 'closed':
            require(times['receivedAtMs'] <= budget, e + ': late receipt was processed')
        if times['copyCompletedAtMs'] is not None:
            require('proposedDates' in event, e + ': copied candidate date proof omitted')
        if times['auditCompletedAtMs'] is not None:
            require(times['copyCompletedAtMs'] is not None, e + ': audit without an isolated copy')
        if times['selectionCompletedAtMs'] is not None:
            require(times['auditCompletedAtMs'] is not None, e + ': selection without a completed audit')
        stage_for_late = {'rejected_late_copy': 'copyCompletedAtMs', 'rejected_late_audit': 'auditCompletedAtMs',
                          'rejected_late_selection': 'selectionCompletedAtMs'}
        if outcome in stage_for_late:
            require(times[stage_for_late[outcome]] is not None and times[stage_for_late[outcome]] > budget,
                    e + ': false late-stage rejection')
        if outcome in ('accepted', 'rejected_guard', 'not_improved'):
            require(all(times[name] is not None and times[name] <= budget for name in names[:4]),
                    e + ': completed selection exceeds the original outer deadline')
        audited = None
        schedule_valid = freeze_valid = False
        if 'proposedDates' in event:
            schedule_valid, freeze_valid, audited = independent_candidate_flags(scenario, event['proposedDates'], fixed, day)
            if isinstance(event['proposedDates'], list) and len(event['proposedDates']) == len(scenario['containers']):
                complete_candidates += 1
        if times['auditCompletedAtMs'] is not None:
            claim = event.get('audit')
            require(isinstance(claim, dict), e + ': audit completion lacks its recorded result')
            require(type(claim.get('scheduleValid')) is bool and type(claim.get('freezeValid')) is bool,
                    e + ': audit flags must be booleans')
            same(claim['scheduleValid'], schedule_valid, e + '/independent physical validity')
            same(claim['freezeValid'], freeze_valid, e + '/independent freeze validity')
            if audited is not None:
                require(claim['scheduleValid'] and claim['freezeValid'] and claim.get('errors') == [],
                        e + ': feasible copied candidate audit is misrepresented')
                same(v8.date_map(event.get('dates', [])), v8.date_map(list(audited['byId'].values())), e + '/canonical candidate dates')
                ledger.close(event.get('incrementalCost'), v8.fee_for_dates(scenario, event['proposedDates']), e + '/candidate fee')
            else:
                require(not claim['scheduleValid'] or not claim['freezeValid'], e + ': invalid candidate marked valid')
                require(isinstance(claim.get('errors'), list) and len(claim['errors']) > 0, e + ': invalid audit has no errors')
                require(event.get('dates') is None and event.get('incrementalCost') is None,
                        e + ': invalid candidate has an apparent canonical feasible schedule')
                rejected_invalid += 1
        if outcome == 'rejected_invalid':
            require(times['auditCompletedAtMs'] is not None and audited is None, e + ': false invalid-candidate rejection')
        if outcome in ('accepted', 'rejected_guard', 'not_improved', 'rejected_late_selection'):
            require(audited is not None, e + ': selection attempted on an invalid candidate')
        selection = event.get('selection')
        if selection is not None:
            require(isinstance(selection, dict) and type(selection.get('accepted')) is bool, e + ': invalid selection record')
            if outcome in ('accepted', 'rejected_guard', 'not_improved'):
                same(selection['accepted'], outcome == 'accepted', e + '/selection outcome')
        if outcome == 'accepted':
            require(times['acceptedAtMs'] is not None and times['acceptedAtMs'] == times['selectionCompletedAtMs'],
                    e + ': acceptance was backdated or lacks completed selection')
            require(audited is not None, e + ': accepted candidate failed independent physical audit')
            fee = v8.fee_for_dates(scenario, event['dates'])
            if best is not None:
                require(fee < best['fee'] or event['source'] == 'locked_milp' and fee == best['fee'],
                        e + ': replacement candidate violates strict improvement / declared MILP fee tie rule')
            if event['source'] == 'cache':
                require(previous is not None, e + ': cache candidate has no previous plan')
                same(v8.date_map(list(audited['byId'].values())), v8.date_map(list(previous.values())), e + '/cached reference')
            if event['source'] == 'adaptive_polish':
                candidate_guard(scenario, previous, event['dates'], fixed, day, meta.get('parameters', {}), e)
            best = {'event': event, 'fee': fee, 'dates': v8.date_map(list(audited['byId'].values()))}
            accepted.append(event)
        else:
            same(times['acceptedAtMs'], None, e + '/rejected acceptance time')
    first = accepted[0]['acceptedAtMs'] if accepted else None
    selected = accepted[-1] if accepted else None
    same(proof.get('firstAcceptedAtMs'), first, label + '/first real outer acceptance')
    same(proof.get('selectedCandidateSequence'), selected['sequence'] if selected else None, label + '/selected sequence')
    same(proof.get('selectedAcceptanceAtMs'), selected['acceptedAtMs'] if selected else None, label + '/selected acceptance')
    same(meta.get('incumbentAcceptedAtMs'), selected['acceptedAtMs'] if selected else None, label + '/top-level selected acceptance')
    if selected:
        require(executed, label + ': timely accepted incumbent was discarded as a failed call')
        same(v8.date_map(decisions), best['dates'], label + '/selected physical decision binding')
    else:
        require(not executed, label + ': executed decision has no timely complete outer-gate acceptance')
    for field in ('callWallMs', 'wholeCallWallMs'):
        if field in meta:
            wall = meta[field]
            require(ledger.finite(wall) and wall >= last_observed, label + ': call wall clock predates candidate evidence')
    return {'candidateEvents': len(events), 'completeCopiedCandidates': complete_candidates,
            'acceptedCandidates': len(accepted), 'independentlyInvalidCandidates': rejected_invalid,
            'callsWithTimelyIncumbent': int(selected is not None)}


def audit_episode(nominal, events, result, label='episode', hardWallMs=5000, method=None, call_budget=200):
    checked = v8.audit_episode(nominal, events, result, label, hardWallMs)
    counts = {key: 0 for key in ('candidateEvents', 'completeCopiedCandidates', 'acceptedCandidates',
                                'independentlyInvalidCandidates', 'callsWithTimelyIncumbent')}
    if method is None:
        method = result.get('policy')
    if method != 'adaptiveV9' or not checked['historyAvailable']:
        return {**checked, 'candidateDelivery': counts}
    actual, fixed, previous = ledger.realize(nominal, events), {}, None
    for day, (entry, call) in enumerate(zip(result['timeline'], result['plannerTrace'])):
        observation, _ = ledger.observed_snapshot(nominal, actual, events, day)
        meta = v8.metadata(call)
        current = audit_gate(observation, meta, entry['decisions'], fixed, previous, day,
                             entry.get('status') == 'executed', label + f'/D{day}', call_budget, day + 1)
        for key, value in current.items():
            counts[key] += value
        if entry.get('status') == 'executed':
            previous = ledger.audit_dates(observation, entry['decisions'], label + '/selected', fixed, day)['byId']
            for event in entry['executedEvents']:
                fixed.setdefault(event['id'], {})[ledger.EVENT_FIELDS[event['event']]] = day
    return {**checked, 'candidateDelivery': counts}


def declared_cases(protocol):
    same(protocol.get('schemaVersion'), 'portplan-protocol-v9', 'Formal protocol schema')
    same(protocol['methods'], METHODS, 'Formal method registry')
    matrix = protocol['matrix']
    same(matrix, {'mechanisms': ['aged-backlog', 'new-arrivals', 'batch-release'],
                  'capacityProfiles': ['balanced', 'tight'], 'counts': [24, 50, 100], 'scenariosPerCell': 4}, 'Formal matrix')
    same([p['id'] for p in protocol['panels']], ['same-distribution', 'stress'], 'Formal panel identities')
    same([p['baseSeed'] for p in protocol['panels']], [391001, 392001], 'Unseen business seeds')
    same(protocol['algorithmRepeats'], [{'index': i + 1, 'seed': seed} for i, seed in enumerate((39011, 39023, 39039))],
         'Frozen timing/algorithm repeats')
    result = []
    for panel in protocol['panels']:
        index = 0
        for mechanism in matrix['mechanisms']:
            for capacity in matrix['capacityProfiles']:
                for count in matrix['counts']:
                    for repetition in range(1, 5):
                        pattern = panel['shockPatterns'][(repetition - 1) % len(panel['shockPatterns'])]
                        result.append({'id': f"v9-{panel['id']}-{mechanism}-{capacity}-n{count}-r{repetition}",
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
    same(index.get('schemaVersion'), 'portplan-v9-streamed-experiment', 'Formal run schema')
    same(index.get('executionState'), 'complete', 'Formal run completion')
    protocol = index['protocol']
    same(protocol['methods'], METHODS, 'Formal methods')
    require(fixture or len(index['cases']) == 144, 'Formal coverage differs from frozen 144 cases')
    snapshot = (directory / index['frozenSource']).resolve()
    frozen_path = snapshot / 'manifest.json'
    frozen = json.loads(frozen_path.read_text())
    same(frozen.get('schemaVersion'), 'portplan-v9-frozen-source', 'Frozen schema')
    same(index['protocolHash'], frozen['protocolHash'], 'Protocol binding')
    same(protocol, frozen['protocol'], 'Protocol content')
    if not fixture:
        same(frozen['scenarioMetadata'], declared_cases(protocol), 'Independent formal declaration expansion')
        require(protocol['budget']['hardWallMs'] == 5000 and protocol['budget']['cpuThreads'] == 1, 'Formal budget differs')
        old_protocol = json.loads((snapshot / 'source/data/protocol-v8.json').read_text())
        for method in ('stableRetainV5', 'costPolishV7', 'adaptiveV8', 'highsV8'):
            same(protocol['callBudgets'][method], old_protocol['callBudgets'][method], 'Unchanged baseline configuration ' + method)
        same(protocol['callBudgets']['adaptiveV9'], protocol['callBudgets']['adaptiveV8'], 'Unchanged V9 numeric parameters')
        for method in ('costPolishV7', 'adaptiveV8', 'adaptiveV9', 'highsV8'):
            same(protocol['callBudgets'][method]['timeBudgetMs'], 200, 'Prespecified daily budget ' + method)
        same(protocol['callBudgets']['stableRetainV5']['timeLimitSeconds'], .2, 'Prespecified legacy solver budget')
        require(not any(field in protocol['callBudgets']['adaptiveV9'] for field in ('onIncumbent', 'onCandidate')),
                'Formal diagnostic observers are forbidden')
    require(digest(snapshot / 'source/data/protocol-v9.json') == index['protocolHash'], 'Protocol bytes differ')
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
                    if method in ('adaptiveV8', 'adaptiveV9'):
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
                reviewed.append({'id': envelope['episodeId'], 'artifactSha256': receipt['artifact']['sha256'], **checked})
        by_panel.setdefault(case['panel'], []).append({'id': case['id'], 'units': units})
        require(digest(input_path) == case['inputArtifact']['sha256'], 'Read-only review changed scenario input')
    estimates = point_estimates(by_panel, index['summary'], fixture)
    require(fixture or counters['episodes'] == 2160, 'Formal episode coverage must be 144 x 3 x 5')
    require(digest(index_path) == index_hash, 'Read-only review changed final index')
    return {'schemaVersion': 'portplan-independent-v9-run-review', 'valid': True, 'fixture': fixture, 'readOnly': True,
            'importsJavaScript': False, 'solverRuns': 0, 'inputIndexSha256': index_hash,
            'frozenManifestSha256': digest(frozen_path), 'implementationSha256': digest(__file__),
            'unchangedV8ReviewSha256': digest(ROOT / 'scripts/review-v8.py'), 'ledgerSha256': digest(ROOT / 'scripts/review-v5.py'),
            'summary': counters, 'candidateDelivery': candidate_counts, 'pointEstimates': estimates, 'episodes': reviewed,
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
        case = record.get('case', record)
        checked = audit_episode(case['nominalScenario'], case.get('events', []), record['result'],
                                record.get('episodeId', record.get('caseId', 'episode')), record['result'].get('hardWallMs', 5000))
        require(digest(args.episode) == before, 'Read-only review changed input')
        result = {'schemaVersion': 'portplan-independent-v9-episode-review', 'valid': True, 'readOnly': True,
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
