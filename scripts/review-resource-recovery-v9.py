#!/usr/bin/env python3
"""Read-only independent review of explicit-menu resource recovery exports.

Uses Python tariff/date/resource arithmetic, not JavaScript or solver model
coefficients. For a strictly bounded tiny instance only, enumerates every legal
complete date tuple and every eligible menu subset to check the requested
objective or menu infeasibility. Larger instances receive feasibility review,
never an independently certified minimum.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import importlib.util
import itertools
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('resource_recovery_python_ledger', ROOT / 'scripts/review-v5.py')
ledger = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ledger)
RESOURCES, EVENTS = ledger.RESOURCES, ledger.EVENTS
SAFE_INTEGER = 2 ** 53 - 1
MODES = ('procurementOnly', 'feesPlusProcurement')
MONEY = ('procurementCostKRW', 'storageCost', 'ddCost', 'totalCost', 'sunkCost', 'incrementalCost',
         'combinedIncrementalCostKRW', 'combinedTotalCostKRW', 'objectiveCostKRW')
KNOWN_FAILURES = ('infeasible', 'time_limit', 'candidate_rejected', 'solver_error')
UNKNOWN_FAILURES = ('cancelled', 'hard_time_limit', 'worker_error')
DEFAULT_MAX_STATES = 250000
HARD_MAX_STATES = 1000000


def require(condition, message):
    if not condition:
        raise ValueError(message)


def same(actual, expected, label):
    require(actual == expected, label + ': inconsistent independent reconstruction')


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def safe_integer(value, low=0):
    return type(value) is int and low <= value <= SAFE_INTEGER


def reconstruct_input(value, label):
    require(isinstance(value, dict), label + ': input must be an object')
    scenario = value.get('snapshot')
    ledger.validate_scenario(scenario, label + '/snapshot')
    require(scenario.get('objectiveMode', 'joint') == 'joint', label + ': only joint fees are supported')
    horizon = scenario['horizonDays']
    for resource in RESOURCES:
        for day in range(horizon):
            require(safe_integer(ledger.capacity(scenario, resource, day)), label + ': capacity must be a nonnegative safe integer')
    day = value.get('minEventDay', 0)
    require(type(day) is int and 0 <= day <= horizon, label + ': invalid current day')
    fixed = value.get('fixedEvents', {})
    require(isinstance(fixed, dict), label + ': fixed history must be an object')
    ids = {c['id'] for c in scenario['containers']}
    for identifier, locks in fixed.items():
        require(identifier in ids and isinstance(locks, dict), label + ': invalid locked container')
        for key, date in locks.items():
            require(key in EVENTS and type(date) is int and 0 <= date < day,
                    label + ': physical locks must be strictly before the current day')
    mode = value.get('objectiveMode', 'procurementOnly')
    require(mode in MODES, label + ': invalid requested objective')
    actions = value.get('actions')
    require(isinstance(actions, list) and len(actions) <= 64, label + ': explicit menu must contain at most 64 packages')
    eligible, excluded, action_ids = [], [], set()
    for original in actions:
        require(isinstance(original, dict), label + ': action must be an object')
        identifier = original.get('id')
        require(isinstance(identifier, str) and identifier.strip() and identifier not in action_ids,
                label + ': action ids must be nonempty unique strings')
        action_ids.add(identifier)
        require(original.get('resource') in RESOURCES, label + ': invalid package resource')
        days = original.get('days')
        require(isinstance(days, list) and 1 <= len(days) <= horizon
                and all(type(d) is int and 0 <= d < horizon for d in days) and len(set(days)) == len(days),
                label + ': package dates must be unique days within the horizon')
        require(safe_integer(original.get('units'), 1), label + ': package units must be a positive safe integer')
        require(safe_integer(original.get('priceKRW')), label + ': package price must be a nonnegative safe integer')
        require(type(original.get('authorized')) is bool, label + ': package authorization must be explicit')
        available = original.get('earliestAvailableDay')
        require(type(available) is int and 0 <= available <= horizon, label + ': package availability must be explicit')
        action = {key: original[key] for key in ('id', 'resource', 'units', 'priceKRW', 'authorized', 'earliestAvailableDay')}
        action['days'] = sorted(days)
        reasons = []
        if not action['authorized']:
            reasons.append('not_authorized')
        if any(d < day for d in days):
            reasons.append('would_change_past_capacity')
        if any(d < available for d in days):
            reasons.append('before_earliest_availability')
        if reasons:
            excluded.append({**action, 'reasons': reasons})
        else:
            eligible.append(action)
    require(safe_integer(sum(a['priceKRW'] for a in eligible)), label + ': aggregate package price exceeds safe integer range')
    for resource in RESOURCES:
        for d in range(horizon):
            total = ledger.capacity(scenario, resource, d) + sum(a['units'] for a in eligible if a['resource'] == resource and d in a['days'])
            require(safe_integer(total), label + ': aggregate capacity exceeds safe integer range')
    return {'scenario': scenario, 'day': day, 'fixed': fixed, 'mode': mode,
            'eligible': eligible, 'excluded': excluded, 'budget': value.get('timeBudgetMs', 1000)}


def capacity_with_packages(scenario, selected):
    augmented = copy.deepcopy(scenario)
    for resource in RESOURCES:
        augmented[resource + 'Capacity'] = [ledger.capacity(scenario, resource, day)
            + sum(a['units'] for a in selected if a['resource'] == resource and day in a['days'])
            for day in range(scenario['horizonDays'])]
    return augmented


def legal_dates(scenario, container, day, fixed):
    """Full event-date domains; no JS presolve or model coefficient is reused."""
    horizon = scenario['horizonDays']
    lag = scenario.get('operations', {}).get('returnLagDays', 1)
    options = []
    for p in range(horizon):
        for u in range(horizon):
            for r in range(horizon):
                end = u + container['unloadDays'] - 1
                if p < container['releaseDay'] or u < p or end > container['dueDay'] or end >= horizon or r < end + lag:
                    continue
                row = dict(zip(EVENTS, (p, u, r)))
                if not all(row[key] == fixed[key] if key in fixed else row[key] >= day for key in EVENTS):
                    continue
                options.append({'id': container['id'], **row})
    return options


def independent_usage(scenario, rows):
    usage = [[0, 0, 0] for _ in range(scenario['horizonDays'])]
    containers = {c['id']: c for c in scenario['containers']}
    for row in rows:
        c = containers[row['id']]
        p, u, r = (row[key] for key in EVENTS)
        usage[p][0] += 1
        usage[r][0] += 1
        for day in range(u, u + c['unloadDays']):
            usage[day][1] += 1
        weight = c['sizeFt'] // 20 if scenario.get('operations', {}).get('stagingUnit', 'container') == 'teu' else 1
        for day in range(p, r):
            usage[day][2] += weight
    return usage


def enumerate_tiny(context, max_states):
    scenario, eligible = context['scenario'], context['eligible']
    bounds = {'maximumContainers': 3, 'maximumHorizonDays': 8, 'maximumEligibleActions': 8,
              'maximumLeafStates': max_states, 'dateDomains': 'every legal p/u/r in the full horizon, with exact original past locks',
              'actionDomains': 'every binary subset of the complete eligible menu'}
    if len(scenario['containers']) > 3 or scenario['horizonDays'] > 8 or len(eligible) > 8:
        return {'optimalityAudited': False, 'exhaustive': False, 'reason': 'outside_explicit_tiny_dimensions', 'bounds': bounds}
    domains = [legal_dates(scenario, c, context['day'], context['fixed'].get(c['id'], {})) for c in scenario['containers']]
    combinations = math.prod(len(domain) for domain in domains)
    subsets = 2 ** len(eligible)
    leaf_bound = combinations * subsets
    details = {'bounds': bounds, 'perContainerLegalDateCounts': [len(domain) for domain in domains],
               'completeDateCombinations': combinations, 'eligibleMenuSubsets': subsets, 'leafStateBound': leaf_bound}
    if leaf_bound > max_states:
        return {'optimalityAudited': False, 'exhaustive': False, 'reason': 'predeclared_state_budget_would_be_exceeded', **details}
    capacities = []
    for mask in range(subsets):
        selected = [a for i, a in enumerate(eligible) if mask & (1 << i)]
        augmented = capacity_with_packages(scenario, selected)
        capacities.append((selected, sum(a['priceKRW'] for a in selected),
                           [[ledger.capacity(augmented, resource, day) for resource in RESOURCES]
                            for day in range(scenario['horizonDays'])]))
    boxes = {c['id']: c for c in scenario['containers']}
    visited = feasible = 0
    minima = {'procurementOnly': None, 'feesPlusProcurement': None}
    witnesses = {'procurementOnly': None, 'feesPlusProcurement': None}
    for rows_tuple in itertools.product(*domains):
        rows = list(rows_tuple)
        usage = independent_usage(scenario, rows)
        incremental = sum(ledger.reprice(scenario, boxes[row['id']], row['pickupDay'], row['returnDay'])['incrementalCost'] for row in rows)
        for selected, procurement, capacity in capacities:
            visited += 1
            require(visited <= max_states, 'Enumeration exceeded its predeclared budget; no partial optimum may be returned')
            if any(usage[day][index] > capacity[day][index] for day in range(scenario['horizonDays']) for index in range(3)):
                continue
            feasible += 1
            for mode, value in (('procurementOnly', procurement), ('feesPlusProcurement', procurement + incremental)):
                if minima[mode] is None or value < minima[mode]:
                    minima[mode] = value
                    witnesses[mode] = {'selectedActionIds': [a['id'] for a in selected], 'dates': rows,
                                       'procurementCostKRW': procurement, 'incrementalCost': incremental, 'objectiveCostKRW': value}
    same(visited, leaf_bound, 'Complete enumeration coverage')
    return {'optimalityAudited': True, 'exhaustive': True, **details, 'visitedLeafStates': visited,
            'feasibleLeafStates': feasible, 'feasibleWithinMenu': feasible > 0,
            'minimumProcurementCostKRW': minima['procurementOnly'],
            'minimumFeesPlusProcurementKRW': minima['feesPlusProcurement'], 'witnesses': witnesses,
            'scope': 'Finite explicit eligible menu and supplied current observation only; no future shocks, real quotes, dispatch or realized savings'}


def review_record(record, index, max_states):
    require(isinstance(record, dict) and isinstance(record.get('result'), dict), f'record {index}: expected input/result objects')
    label = str(record.get('name', f'record-{index}'))
    context = reconstruct_input(record.get('input'), label)
    result, scenario = record['result'], context['scenario']
    status, mode = result.get('status'), context['mode']
    require(status in ('optimal', 'feasible', *KNOWN_FAILURES, *UNKNOWN_FAILURES), label + ': unknown terminal status')
    same(result.get('counterfactual'), True, label + '/counterfactual')
    same(result.get('purchaseExecuted'), False, label + '/purchase status')
    proof = result.get('proof')
    require(isinstance(proof, dict), label + ': proof context missing')
    for field in ('minimumObjectiveProven', 'minimumProcurementProven', 'infeasibleWithinMenuProven'):
        require(type(proof.get(field)) is bool, label + ': proof flags must be explicit booleans')
    if status not in UNKNOWN_FAILURES:
        same(result.get('objectiveMode'), mode, label + '/requested objective')
        same(result.get('minEventDay'), context['day'], label + '/current observation day')
        same(result.get('eligibleActions'), context['eligible'], label + '/eligible authorized menu')
        same(result.get('excludedActions'), context['excluded'], label + '/excluded menu with reasons')
        ledger.close(result.get('wholeCallBudgetMs'), context['budget'], label + '/cooperative budget')
    if result.get('parentWallMs') is not None and status not in UNKNOWN_FAILURES:
        wall = result['parentWallMs']
        require(ledger.finite(wall) and 0 <= wall <= 5000, label + ': accepted export exceeds its parent 5000ms budget')
    selected_ids, physical = [], None
    if status in ('optimal', 'feasible'):
        require(isinstance(result.get('selectedActions'), list), label + ': selected packages missing')
        by_id = {action['id']: action for action in context['eligible']}
        selected = []
        for claimed in result['selectedActions']:
            require(isinstance(claimed, dict), label + ': malformed selected package')
            identifier = claimed.get('id')
            require(identifier in by_id and identifier not in selected_ids, label + ': unauthorized, unknown or duplicate selected package')
            selected_ids.append(identifier)
            expected = by_id[identifier]
            normalized = {key: claimed.get(key) for key in expected}
            if isinstance(normalized.get('days'), list):
                normalized['days'] = sorted(normalized['days'])
            same(normalized, expected, label + '/original package binding')
            selected.append(expected)
        augmented = capacity_with_packages(scenario, selected)
        ledger.audit_dates(augmented, result.get('rows'), label + '/physical schedule and original past locks', context['fixed'], context['day'])
        # The resource objective is distinct from the joint-fee ledger objective.
        # Changing only the audit view's objective label does not change dates,
        # prices, selected packages or any accepted output bytes.
        ledger_view = {**result, 'objectiveMode': 'joint'}
        physical = ledger.audit_schedule(augmented, ledger_view, label + '/independent fee/resource ledger')
        procurement = sum(action['priceKRW'] for action in selected)
        ledger.close(result.get('procurementCostKRW'), procurement, label + '/whole-package purchase price')
        ledger.close(result.get('combinedIncrementalCostKRW'), physical['incrementalCost'] + procurement, label + '/incremental fee plus purchase')
        ledger.close(result.get('combinedTotalCostKRW'), physical['totalCost'] + procurement, label + '/total fee plus purchase')
        objective = procurement + (physical['incrementalCost'] if mode == 'feesPlusProcurement' else 0)
        ledger.close(result.get('objectiveCostKRW'), objective, label + '/requested objective amount')
        same(proof['infeasibleWithinMenuProven'], False, label + '/feasible cannot claim infeasibility')
        same(proof['minimumObjectiveProven'], status == 'optimal', label + '/minimum objective claim')
        same(proof['minimumProcurementProven'], status == 'optimal' and mode == 'procurementOnly', label + '/minimum procurement claim scope')
        require(isinstance(result.get('audit'), dict) and result['audit'].get('valid') is True, label + ': worker final audit claim missing')
        runtime = result.get('runtimeMs')
        require(ledger.finite(runtime) and 0 <= runtime < context['budget'], label + ': accepted terminal missed cooperative deadline')
    else:
        same(result.get('rows'), [], label + '/incomplete rows')
        same(result.get('selectedActions'), [], label + '/incomplete selections')
        for field in MONEY:
            same(result.get(field), None, label + '/incomplete money ' + field)
        same(proof['minimumObjectiveProven'], False, label + '/incomplete minimum objective')
        same(proof['minimumProcurementProven'], False, label + '/incomplete minimum procurement')
        same(proof['infeasibleWithinMenuProven'], status == 'infeasible', label + '/infeasibility scope')
    enumeration = enumerate_tiny(context, max_states)
    matches = None
    if enumeration['optimalityAudited']:
        if status == 'infeasible':
            same(enumeration['feasibleWithinMenu'], False, label + '/independent complete menu infeasibility')
            matches = True
        elif status in ('optimal', 'feasible'):
            require(enumeration['feasibleWithinMenu'], label + ': claimed feasible result contradicts complete enumeration')
            minimum = enumeration['minimumProcurementCostKRW' if mode == 'procurementOnly' else 'minimumFeesPlusProcurementKRW']
            matches = abs(result['objectiveCostKRW'] - minimum) <= 1e-6
            if status == 'optimal':
                require(matches, label + ': solver minimum claim disagrees with independently enumerated full menu/date optimum')
    return {'name': label, 'valid': True, 'status': status, 'objectiveMode': mode,
            'knownContainers': len(scenario['containers']), 'horizonDays': scenario['horizonDays'], 'currentObservationDay': context['day'],
            'eligibleActionCount': len(context['eligible']), 'excludedActionCount': len(context['excluded']),
            'selectedActionIds': selected_ids, 'feasibilityAudited': physical is not None,
            'physicalFeeTotals': physical, 'optimalityAudited': enumeration['optimalityAudited'],
            'resultMatchesEnumeratedRequestedOptimum': matches, 'enumeration': enumeration,
            'scope': 'Current supplied observation, immutable past event locks and explicit authorized finite menu only. Independent minimum/infeasibility verification applies only when optimalityAudited=true. No external price validation, purchase, dispatch, future-event robustness, external clock authentication or realized-savings claim.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True, type=Path, help='One {input,result}, {name,input,result}, a list, or {records:[...]}')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--max-states', type=int, default=DEFAULT_MAX_STATES,
                        help='Predeclared full-enumeration leaf budget, at most 1000000; never accepts a partial optimum')
    args = parser.parse_args()
    require(1 <= args.max_states <= HARD_MAX_STATES, 'Enumeration budget must be between 1 and 1000000')
    before = digest(args.input)
    source = json.loads(args.input.read_text())
    records = source if isinstance(source, list) else source.get('records', [source]) if isinstance(source, dict) else None
    require(isinstance(records, list) and len(records) > 0, 'Expected at least one input/result record')
    reviews = [review_record(record, index + 1, args.max_states) for index, record in enumerate(records)]
    require(digest(args.input) == before, 'Read-only review changed the original exported JSON')
    output = {'schemaVersion': 'portplan-independent-resource-recovery-v9-review', 'valid': True, 'readOnly': True,
              'importsJavaScript': False, 'solverRuns': 0, 'inputSha256': before, 'implementationSha256': digest(__file__),
              'ledgerSha256': digest(ROOT / 'scripts/review-v5.py'), 'recordCount': len(reviews),
              'feasibilityAuditedRecordCount': sum(r['feasibilityAudited'] for r in reviews),
              'optimalityAuditedRecordCount': sum(r['optimalityAudited'] for r in reviews), 'maxEnumerationLeafStates': args.max_states,
              'records': reviews,
              'scope': 'Independent internal Python physical/tariff/menu reconstruction and bounded exhaustive tiny-instance verification. Solver-supplied minimum claims on larger instances remain unaudited; no JavaScript, solver, external certification, external clock authentication or real-world savings evidence.'}
    if args.output:
        require(not args.output.exists(), 'Refuse to overwrite a previous independent review')
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(json.dumps(output, ensure_ascii=False, allow_nan=False))


if __name__ == '__main__':
    main()
