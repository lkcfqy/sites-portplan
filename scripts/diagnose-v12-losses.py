#!/usr/bin/env python3
"""Read-only loss-union diagnosis; standard library, no solver or policy rerun."""
import argparse
import collections
import copy
from datetime import datetime, timezone
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EXPECTED = '141ac68b0627e74ffa41f881078d9d73304263240e858d148c64e91562217646'
METHOD = 'seededHiGHSV12'
FIELDS = ('pickupDay', 'unloadDay', 'returnDay')
EVENT_FIELDS = {'pickup': 'pickupDay', 'unloadStart': 'unloadDay', 'return': 'returnDay'}
RESOURCES = ('truck', 'warehouse', 'staging')
spec = importlib.util.spec_from_file_location('v12_loss_independent_ledger', ROOT / 'scripts/review-v5.py')
ledger = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ledger)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(',', ':'), allow_nan=False)


def value_hash(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def require(condition, reason):
    if not condition:
        raise ValueError(reason)


def public_snapshot(nominal, timeline, day):
    """No private event list, future actual capacity, or duration is accepted."""
    scenario = ledger.expanded(nominal)
    fixed, physical = {}, []
    for entry in timeline:
        if entry['day'] > day:
            break
        for observation in entry['observedEvents']:
            resource = observation['resource']
            for announcement in observation.get('announcements', []):
                if 'announcedDuration' in announcement:
                    for date in range(announcement['revealDay'], min(scenario['horizonDays'], announcement['revealDay'] + announcement['announcedDuration'])):
                        scenario[resource + 'Capacity'][date] = announcement['capacity']
            scenario[resource + 'Capacity'][entry['day']] = observation['capacity']
        if entry['day'] < day:
            require(entry['status'] == 'executed', 'History before failure must be executed')
            for event in entry['executedEvents']:
                field = EVENT_FIELDS[event['event']]
                locks = fixed.setdefault(event['id'], {})
                require(field not in locks and event['day'] == entry['day'], 'Duplicate or mistimed physical event')
                locks[field] = event['day']
                physical.append(copy.deepcopy(event))
    return scenario, fixed, physical


def necessary_conditions(scenario, fixed, day):
    """Calendar/lock relaxation; no joint resource allocation is solved."""
    horizon = scenario['horizonDays']
    lag = scenario.get('operations', {}).get('returnLagDays', 1)
    unit = scenario.get('operations', {}).get('stagingUnit', 'container')
    details, empty = [], []
    for container in scenario['containers']:
        identifier = container['id']
        locks = fixed.get(identifier, {})
        length = container['unloadDays']
        weight = container['sizeFt'] / 20 if unit == 'teu' else 1
        def dates(field):
            return [locks[field]] if field in locks else range(day, horizon)
        starts, trips = set(), 0
        current = {'truck': float('inf'), 'warehouse': float('inf'), 'staging': float('inf')}
        for pickup in dates('pickupDay'):
            if not (0 <= pickup < horizon and pickup >= container['releaseDay']):
                continue
            for unload in dates('unloadDay'):
                end = unload + length - 1
                if not (pickup <= unload <= end < horizon and end <= container['dueDay']):
                    continue
                for returned in dates('returnDay'):
                    if not (end + lag <= returned < horizon):
                        continue
                    trips += 1
                    starts.add(unload)
                    current['truck'] = min(current['truck'], int(pickup == day) + int(returned == day))
                    current['warehouse'] = min(current['warehouse'], int(unload <= day <= end))
                    current['staging'] = min(current['staging'], weight * int(pickup <= day < returned))
        item = {'id': identifier, 'releaseDay': container['releaseDay'], 'dueDay': container['dueDay'],
                'unloadDays': length, 'actualExecutedLocks': copy.deepcopy(locks),
                'admissibleTripCount': trips, 'admissibleUnloadDays': sorted(starts),
                'minimumCurrentDayLoad': current if trips else None}
        details.append(item)
        if not trips:
            empty.append(identifier)
    violations = []
    if empty:
        violations.append({'type': 'empty_individual_calendar_domain', 'containerIds': empty})
    else:
        for resource in RESOURCES:
            minimum = sum(item['minimumCurrentDayLoad'][resource] for item in details)
            supplied = ledger.capacity(scenario, resource, day)
            if minimum > supplied:
                violations.append({'type': 'current_day_resource_lower_bound', 'resource': resource, 'day': day,
                    'minimumRequired': minimum, 'suppliedCapacity': supplied,
                    'contributors': [{'id': item['id'], 'minimum': item['minimumCurrentDayLoad'][resource]}
                        for item in details if item['minimumCurrentDayLoad'][resource] > 0]})
        # Interval energy is stronger than adding daywise compulsory parts:
        # each box must put this much continuous unloading somewhere in [a,b].
        for start in range(day, horizon):
            for end in range(start, horizon):
                components = []
                for item in details:
                    minimum = min(max(0, min(unload + item['unloadDays'] - 1, end) - max(unload, start) + 1)
                                  for unload in item['admissibleUnloadDays'])
                    if minimum:
                        components.append({'id': item['id'], 'minimumWarehouseDays': minimum})
                required = sum(component['minimumWarehouseDays'] for component in components)
                supplied = sum(ledger.capacity(scenario, 'warehouse', date) for date in range(start, end + 1))
                if required > supplied:
                    violations.append({'type': 'warehouse_interval_energy_lower_bound', 'startDay': start, 'endDay': end,
                        'minimumRequiredWarehouseDays': required, 'suppliedWarehouseDays': supplied, 'contributors': components})
    return {'status': 'proven_infeasible_by_necessary_condition' if violations else 'not_proven_by_this_relaxation',
        'proofScope': 'Only this failure-day public snapshot and its exact executed locks. Not D0 infeasibility or realized-future clairvoyance.',
        'relaxation': 'Exact dates/releases/continuous unloading/deadlines/lag/horizon/locks; ignore all shared resource allocation when forming each individual domain.',
        'inputPublicSnapshotSha256': value_hash(scenario), 'inputFixedEventsSha256': value_hash(fixed),
        'violations': violations, 'individualDomains': details}


def diagnose(directory):
    directory = directory.resolve()
    index_path = directory / 'complete.json'
    require(digest(index_path) == EXPECTED, 'Only the unchanged first formal V12 index is allowed')
    index = json.loads(index_path.read_text())
    source_bindings = {str(index_path.relative_to(ROOT)): EXPECTED,
        'scripts/review-v5.py': digest(ROOT / 'scripts/review-v5.py'),
        'scripts/diagnose-v12-losses.py': digest(Path(__file__)), 'AGENTS.md': digest(ROOT / 'AGENTS.md')}
    def bound(artifact):
        path = directory / artifact['path']
        require(path.resolve().is_relative_to(directory) and digest(path) == artifact['sha256'], 'Changed or unsafe raw artifact')
        source_bindings[str(path.relative_to(ROOT))] = artifact['sha256']
        return json.loads(path.read_text())
    cases = {case['id']: case for case in index['cases']}
    losses = collections.defaultdict(list)
    comparisons = {}
    for panel, summary in index['summary']['panels'].items():
        comparisons[panel] = {}
        for name, comparison in summary['comparisons'].items():
            if name.startswith('v12Vs'):
                comparisons[panel][name] = copy.deepcopy(comparison)
                for identifier in comparison['completion']['lostEpisodeIds']:
                    losses[identifier].append(comparison['baselineMethod'])
    episodes = []
    for identifier in sorted(losses):
        case_id, repeat_text = identifier.split('::repeat-')
        repeat_index = int(repeat_text)
        case = cases[case_id]
        repeat = next(item for item in case['repeats'] if item['repeatIndex'] == repeat_index)
        raw_input = bound(case['inputArtifact'])
        scalar = repeat['policies'][METHOD]
        result = bound(scalar['artifact'])['result']
        require(result['complete'] is False and not result['executionHistoryUnavailable'], 'Loss must preserve a known failure history')
        day = result['failure']['day']
        snapshot, fixed, physical = public_snapshot(raw_input['nominalScenario'], result['timeline'], day)
        entry = result['timeline'][day]
        observed_hash = ledger.checksum({'scenario': snapshot, 'observedEvents': entry['observedEvents'],
            'fixedEvents': fixed, 'minEventDay': day}, entry['observationHash'])
        require(observed_hash == entry['observationHash'], 'Reconstructed public observation differs')
        trace = result['plannerTrace'][-1]
        require(trace['day'] == day, 'Failure trace day differs')
        selection = trace['stabilitySelection']
        for resource in RESOURCES:
            require(selection['publicCapacities'][resource] == snapshot[resource + 'Capacity'], 'Native input public capacities differ')
        native = trace['nativeCertificate']
        gate = selection['nativeGate']
        classification = ('initial_late_native_incumbent' if native['hasIncumbent'] else 'initial_no_native_incumbent') if day == 0 else (
            'later_timely_native_infeasible' if native['provenInfeasible'] and gate['receivedAtMs'] <= 200 else 'later_other_failure')
        witnesses, baselines = [], []
        # Late constructor receipts are witnesses only after an independent
        # current-snapshot date/physical audit, never accepted retroactively.
        for event in selection['constructorDelivery']['events']:
            dates = event.get('proposedDates')
            if not dates:
                continue
            try:
                ledger.audit_dates(snapshot, dates, 'Late constructor existence witness', fixed, day)
                witnesses.append({'source': 'unaccepted_constructor_receipt', 'sequence': event['sequence'],
                    'outcome': event['outcome'], 'receivedAtMs': event['receivedAtMs'],
                    'auditFinishedAtMs': event['auditFinishedAtMs'], 'datesSha256': value_hash(dates),
                    'timelyAccepted': False, 'scope': 'Existence witness only; does not rewrite the original failed delivery.'})
            except (ValueError, TypeError, KeyError) as error:
                witnesses.append({'source': 'constructor_receipt', 'independentWitnessRejected': str(error)})
        for method in losses[identifier]:
            baseline_scalar = repeat['policies'][method]
            require(baseline_scalar['complete'] is True, 'Reported completion loss baseline did not complete')
            baseline = bound(baseline_scalar['artifact'])['result']
            baseline_physical = [event for record in baseline['timeline'] if record['day'] < day for event in record['executedEvents']]
            prefix_matches = canonical(baseline_physical) == canonical(physical)
            first_difference = next((date for date in range(day) if canonical(baseline['timeline'][date]['executedEvents']) != canonical(result['timeline'][date]['executedEvents'])), None)
            baseline_record = {'method': method, 'complete': True, 'rawArtifact': copy.deepcopy(baseline_scalar['artifact']),
                'prefixMatchesBeforeV12Failure': prefix_matches, 'firstPhysicalDivergenceDay': first_difference,
                'baselinePrefixSha256': value_hash(baseline_physical), 'v12PrefixSha256': value_hash(physical)}
            candidate = baseline['timeline'][min(day, len(baseline['timeline']) - 1)]['decisions']
            try:
                ledger.audit_dates(snapshot, candidate, method + ' candidate under V12 failure locks', fixed, day)
                baseline_record['candidatePassesV12FailureSnapshotAndLocks'] = True
                witnesses.append({'source': method, 'datesSha256': value_hash(candidate), 'samePhysicalPrefix': prefix_matches,
                    'scope': 'Candidate independently passes this current snapshot and exact locks; baseline success alone is not the proof.'})
            except (ValueError, TypeError, KeyError) as error:
                baseline_record['candidatePassesV12FailureSnapshotAndLocks'] = False
                baseline_record['candidateRejection'] = str(error)
            baselines.append(baseline_record)
        proof = necessary_conditions(snapshot, fixed, day)
        valid_witnesses = [w for w in witnesses if 'independentWitnessRejected' not in w]
        require(not (valid_witnesses and proof['violations']), 'Feasibility witness contradicts independent necessary-condition proof')
        episodes.append({'episodeId': identifier, 'caseId': case_id, 'panel': case['panel'], 'repeatIndex': repeat_index,
            'algorithmSeed': repeat['algorithmSeed'], 'lostToMethods': losses[identifier],
            'inputArtifact': copy.deepcopy(case['inputArtifact']), 'v12RawArtifact': copy.deepcopy(scalar['artifact']),
            'originalFailure': copy.deepcopy(result['failure']), 'failureDay': day, 'classification': classification,
            'wholeCallWallMs': trace['callWallMs'], 'wholeCallBudgetMs': trace['timeBudgetMs'],
            'parentHardWallMs': result['hardWallMs'], 'parentWallTimeMs': result['wallTimeMs'], 'parentDeadlineReached': result['deadlineReached'],
            'nativeStatus': native['status'], 'nativeSolverStatus': native['solverStatus'], 'nativeHasIncumbent': native['hasIncumbent'],
            'nativeProvenInfeasible': native['provenInfeasible'], 'nativeGate': copy.deepcopy(gate),
            'cacheStatus': selection['cacheStatus'], 'cacheValid': selection['cacheValid'],
            'constructorDelivery': copy.deepcopy(selection['constructorDelivery']), 'quickConstructorStage': copy.deepcopy(trace['stages'].get('quickConstructor')),
            'failurePublicScenario': snapshot, 'failurePublicScenarioSha256': value_hash(snapshot),
            'failureObservedEvents': copy.deepcopy(entry['observedEvents']), 'originalObservationHash': entry['observationHash'],
            'observationHashVerified': True, 'actualExecutedFixedEvents': fixed, 'fixedEventsSha256': value_hash(fixed),
            'physicalPrefixSha256': value_hash(physical), 'physicalEventCountBeforeFailure': len(physical),
            'necessaryConditionReview': proof, 'independentlyAuditedExistenceWitnesses': witnesses, 'baselineComparisons': baselines,
            'informationBoundary': 'Proof receives only nominal known orders, archived observations/explicit announcements through this failure day, and actually executed earlier events; no future actual event/duration list.'})
    summaries = {}
    for panel in ('same-distribution', 'stress'):
        rows = [row for row in episodes if row['panel'] == panel]
        summaries[panel] = {'lossUnionEpisodeCount': len(rows), 'uniqueBusinessScenarioCount': len({row['caseId'] for row in rows}),
            'failureClasses': dict(collections.Counter(row['classification'] for row in rows)),
            'independentNecessaryContradictionCount': sum(bool(row['necessaryConditionReview']['violations']) for row in rows),
            'independentFeasibleWitnessCount': sum(any('independentWitnessRejected' not in witness for witness in row['independentlyAuditedExistenceWitnesses']) for row in rows),
            'notProvenByNecessaryRelaxationCount': sum(not row['necessaryConditionReview']['violations'] for row in rows)}
    reviews = {}
    for name in ('data/review-v12.json', 'data/bootstrap-review-v12.json'):
        path = ROOT / name
        review = json.loads(path.read_text())
        require(review['valid'] is True, 'Formal review is not valid')
        source_bindings[name] = digest(path)
        reviews[name] = {'path': name, 'sha256': digest(path), 'valid': True}
    require(digest(index_path) == EXPECTED, 'Original formal index changed during read-only diagnosis')
    return {'schemaVersion': 'portplan-v12-first-formal-readonly-loss-diagnosis', 'valid': True,
        'generatedAt': datetime.now(timezone.utc).isoformat(), 'originalIndexSha256': EXPECTED,
        'newSolverRuns': 0, 'newHeldOutExperiments': 0, 'algorithmChanges': 0,
        'sourceBindings': source_bindings, 'formalReviews': reviews,
        'diagnosticImplementationSource': Path(__file__).read_text(), 'diagnosticImplementationSha256': digest(Path(__file__)),
        'scope': 'Posthoc diagnosis of the complete first formal loss union against five baselines. Newly seen results are diagnostic/development information; no rerun, revised score, future-knowledge recovery or natural-policy causal claim.',
        'lossUnionEpisodeCount': len(episodes), 'uniqueBusinessScenarioCount': len({row['caseId'] for row in episodes}),
        'summaryByPanel': summaries, 'allV12PairwiseComparisons': comparisons, 'episodes': episodes,
        'defaultRecommendationEligible': False,
        'interpretation': ['Completion net gains cannot cancel any recorded baseline-complete/V12-failed pair.',
            'Necessary-condition contradictions certify only the given public snapshot and physical prefix; passing the relaxation does not prove feasibility.',
            'A solver infeasible flag is reported separately from the independent no-solver contradiction.',
            'Matched fee and revision comparisons retain their own jointly complete denominators; failed paths have no completed fee receipt.',
            'No issue in this diagnosis has been fixed or retested by this artifact.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    require(not args.output.exists(), 'Preserve prior diagnosis; output must be new')
    result = diagnose(args.run)
    with args.output.open('x') as stream:
        json.dump(result, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write('\n')
    print(json.dumps({'output': str(args.output), 'lossUnionEpisodeCount': result['lossUnionEpisodeCount'],
        'uniqueBusinessScenarioCount': result['uniqueBusinessScenarioCount'], 'summaryByPanel': result['summaryByPanel']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
