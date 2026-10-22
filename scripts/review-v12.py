#!/usr/bin/env python3
"""Read-only independent V12 physical, fee, commitment and delivery review.

Only independently implemented Python ledgers/reconstruction are imported.
No JS, native optimization, prospective input generation, or evidence mutation.
Complete score proofs use broad single-container legal domains, never the native
MILP's narrowed domains or a subset of the producer's enumerated trips.
"""
from __future__ import annotations
import argparse
import copy
import importlib.util
import json
import math
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('v12_unchanged_v10_review', ROOT / 'scripts/review-v10.py')
v10 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v10)
v9, v8, ledger = v10.v9, v10.v8, v10.ledger
require, same, digest = v10.require, v10.same, v10.digest
reprice_dates, endpoint_fees, pending_changes = v10.reprice_dates, v10.endpoint_fees, v10.pending_changes
FEE_FIELDS = v10.FEE_FIELDS
PARENT_RECEIPT_FIELDS = ('hardWallMs', 'actualCutoffMs', 'processExitWallTimeMs', 'processCloseWallTimeMs',
                         'cleanupFinishedMs', 'endToEndWallTimeMs', 'normalWorkerExit', 'exitCode', 'exitSignal',
                         'processGroupCleanup', 'deadlineReached', 'terminalReceiptWithinBudget',
                         'terminalReceiptAcceptedAsHistory', 'endToEndCompletedWithinBudget',
                         'unacceptedTerminalReceipts')
RECEIPT_FIELDS = (*FEE_FIELDS, 'lateCount', 'policy', 'status', 'complete', 'auditValid', 'executionHistoryUnavailable',
                  'episodeCompletedWithinBudget', 'outputDeliveredWithinBudget', 'wallTimeMs',
                  'finalReceivedMs', 'receiptValidatedMs', 'revisionCount', 'initializationEvidence', *PARENT_RECEIPT_FIELDS)
METHODS = ['costPolishV7', 'adaptiveV9', 'highsV8', 'stableHiGHSV10', 'commitmentHiGHSV11', 'seededHiGHSV12']
PAIRS = {'v12VsV11': ('commitmentHiGHSV11', 'seededHiGHSV12'),
         'v12VsV10': ('stableHiGHSV10', 'seededHiGHSV12'),
         'v12VsV9': ('adaptiveV9', 'seededHiGHSV12'),
         'v12VsHiGHS': ('highsV8', 'seededHiGHSV12'),
         'v12VsV7': ('costPolishV7', 'seededHiGHSV12'),
         'v11VsV10': ('stableHiGHSV10', 'commitmentHiGHSV11'),
         'v10VsHiGHS': ('highsV8', 'stableHiGHSV10'),
         'highsVsV7': ('costPolishV7', 'highsV8')}
PARAMETERS = v9.PARAMETERS
PARENT_ACCEPTANCE = {'normalWorkerExitRequired': True, 'confirmedProcessGroupGoneRequired': True,
                     'processGroupVerificationResult': 'ESRCH', 'cleanupWithinHardWallRequired': True,
                     'endToEndWithinHardWallRequired': True, 'timelyFinalAloneIsCompletion': False}

NATIVE_FIELDS = ('calls', 'cacheAcceptedCalls', 'nativeAcceptedCalls', 'retainedCacheCalls',
                 'completeNativeProposals', 'strictReplacements', 'feeTiesRetained',
                 'commitmentReplacements', 'completeCommitmentScores', 'incompleteCommitmentScores',
                 'constructorCalls', 'constructorEvents', 'acceptedConstructorReceipts',
                 'constructorSeededCalls', 'retainedConstructorCalls')


def empty_native_counts():
    return {key: 0 for key in NATIVE_FIELDS}


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
        require(nullable and value is None or ledger.finite(value) and value >= 0,
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
                and len(result['rows']) > 0 and all(ledger.finite(result.get(k)) for k in (*FEE_FIELDS, 'lateCount')))
    same(result['episodeCompletedWithinBudget'], accepted and complete, prefix + '/complete episode eligibility')
    require(result.get('complete') is not True or accepted and complete,
            prefix + ': physical completion cannot bypass exit, cleanup or parent deadline')
    if not result.get('complete'):
        require(result.get('rows') == [] and all(result.get(k) is None for k in (*FEE_FIELDS, 'lateCount')),
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
                        and all(ledger.finite(original.get(k)) for k in (*FEE_FIELDS, 'lateCount')),
                        prefix + ': raw complete terminal was erased or repriced as failure')
    return {'terminalReceiptWithinBudget': timely, 'normalWorkerExit': normal,
            'processGroupGone': cleanup_ok, 'cleanupWithinBudget': finish <= hard_wall_ms,
            'endToEndWithinBudget': wall <= hard_wall_ms, 'acceptedHistory': accepted,
            'completeEpisode': accepted and complete}


def audit_formal_parent_receipt(receipt, result, hard_wall_ms, label='episode'):
    """Bind formal compact metadata to its SHA-bound full parent record."""
    for field in PARENT_RECEIPT_FIELDS:
        require(field in receipt and field in result, label + ': missing formal scalar/full parent field ' + field)
    for field in RECEIPT_FIELDS:
        same(receipt.get(field), result.get(field), label + '/scalar/full receipt ' + field)
    same(receipt.get('terminalRowCount'), len(result['rows']), label + '/terminal row count')
    return audit_parent_lifecycle(result, hard_wall_ms, label)


def public_capacities(scenario):
    return {r: [ledger.capacity(scenario, r, d) for d in range(scenario['horizonDays'])] for r in ledger.RESOURCES}


def independent_commitment(scenario, rows, fixed, today):
    """Full independent single-box broad domains, including individual capacities.

    No other box's planned occupancy is subtracted: doing that would turn a
    necessary lower bound into a cache-dependent heuristic. All public days are
    enumerated; no native candidate slots, MILP coefficients or future events.
    """
    ledger.audit_dates(scenario, rows, 'commitment candidate', fixed, today)
    H, tomorrow = scenario['horizonDays'], today + 1
    operations = {**ledger.OPERATIONS, **scenario.get('operations', {})}
    lag, unit = operations['returnLagDays'], operations['stagingUnit']
    capacities = public_capacities(scenario)
    by_id = {row['id']: row for row in rows}
    shadow = copy.deepcopy(fixed)
    for row in rows:
        for field in ledger.EVENTS:
            if row[field] == today:
                shadow.setdefault(row['id'], {})[field] = today
    containers = []
    for c in scenario['containers']:
        locks = shadow.get(c['id'], {})
        offset = c['unloadDays'] - 1 + lag
        latest = min(c['dueDay'] - c['unloadDays'] + 1, H - 1 - offset)
        def domain(field, low, high):
            return [locks[field]] if field in locks and low <= locks[field] <= high else ([] if field in locks else list(range(max(low, tomorrow), high + 1)))
        pickups = domain('pickupDay', c['releaseDay'], latest)
        unloads = domain('unloadDay', c['releaseDay'], latest)
        returns = domain('returnDay', c['releaseDay'] + offset, H - 1)
        weight = c['sizeFt'] / 20 if unit == 'teu' else 1
        # Independent legal trip enumeration with capacity interval tests.
        legal = occupied = avoided = 0
        witness = None
        warehouse_fits = {u: all(capacities['warehouse'][d] >= 1 for d in range(u, u + c['unloadDays'])) for u in unloads}
        staging_fits = {(p, r): all(capacities['staging'][d] >= weight for d in range(p, r)) for p in pickups for r in returns if r >= p}
        for p in pickups:
            for u in unloads:
                if u < p or not warehouse_fits[u]:
                    continue
                for r in returns:
                    if r < u + offset or capacities['truck'][p] < 1 + int(p == r) or capacities['truck'][r] < 1 + int(p == r) or not staging_fits[(p, r)]:
                        continue
                    legal += 1
                    if u <= tomorrow < u + c['unloadDays']:
                        occupied += 1
                    else:
                        avoided += 1
                        if witness is None:
                            witness = {'pickupDay': p, 'unloadDay': u, 'returnDay': r}
        require(legal > 0, 'Audited candidate has empty independent commitment domain')
        containers.append({'id': c['id'], 'sizeFt': c['sizeFt'], 'unloadDays': c['unloadDays'], 'dueDay': c['dueDay'],
                           'stagingWeight': weight, 'shadowLocks': locks, 'legalTripCount': legal,
                           'occupiesTomorrowCount': occupied, 'avoidsTomorrowCount': avoided,
                           'avoidanceWitness': witness, 'mandatoryWarehouseTomorrow': int(avoided == 0)})
    return {'method': 'v11-next-day-mandatory-warehouse-lower-bound', 'today': today, 'tomorrow': tomorrow,
            'shadowMinEventDay': tomorrow, 'usesUnannouncedFutureEvents': False,
            'scoreScope': 'sum of independent single-container necessary warehouse occupancy after executing today; no joint feasibility or future recovery claim',
            'publicCapacities': capacities, 'shadowFixedEvents': shadow,
            'candidateDates': [{k: by_id[c['id']][k] for k in ('id', *ledger.EVENTS)} for c in scenario['containers']],
            'containers': containers, 'legalTripCount': sum(c['legalTripCount'] for c in containers),
            'mandatoryWarehouseTomorrow': sum(c['mandatoryWarehouseTomorrow'] for c in containers),
            'mandatoryWarehouseLoad': sum(c['mandatoryWarehouseTomorrow'] for c in containers),
            'publicWarehouseCapacityTomorrow': capacities['warehouse'][tomorrow] if tomorrow < H else None,
            'tomorrowInsideHorizon': tomorrow < H}


def audit_commitment(scenario, rows, fixed, day, proof, label):
    require(isinstance(proof, dict), label + ': missing commitment score')
    require(type(proof.get('complete')) is bool, label + ': missing score completeness')
    expected = independent_commitment(scenario, rows, fixed, day)
    same(proof.get('method'), expected['method'], label + '/method')
    for key in ('today', 'tomorrow', 'shadowMinEventDay', 'usesUnannouncedFutureEvents', 'scoreScope'):
        same(proof.get(key), expected[key], label + '/' + key)
    v9.optional_time(proof.get('scoringWallMs'), label + '/scoring wall')
    require(proof.get('scoringWallMs') is not None, label + ': missing scoring wall')
    if proof['complete']:
        same(proof.get('status'), 'complete', label + '/status')
        for key, value in expected.items():
            same(proof.get(key), value, label + '/' + key)
        return expected['mandatoryWarehouseTomorrow']
    same(proof.get('status'), 'time_limit', label + '/partial status')
    for key in ('mandatoryWarehouseTomorrow', 'mandatoryWarehouseLoad'):
        same(proof.get(key), None, label + ': partial score cannot become zero/' + key)
    completed = proof.get('containers')
    require(isinstance(completed, list) and len(completed) <= len(expected['containers']), label + ': invalid partial proof coverage')
    same(completed, expected['containers'][:len(completed)], label + '/independently completed container prefix')
    same(proof.get('legalTripCount'), sum(c['legalTripCount'] for c in completed), label + '/partial legal-trip count')
    for key in ('publicCapacities', 'shadowFixedEvents', 'candidateDates'):
        if proof.get(key) is not None:
            same(proof[key], expected[key], label + '/partial ' + key)
    return None


def gate_times(gate, fields, budget, meta, label):
    require(isinstance(gate, dict), label + ': missing gate')
    values = [v9.optional_time(gate.get(field), label + '/' + field) for field in fields]
    present = [v for v in values if v is not None]
    require(present == sorted(present), label + ': receipt/copy/audit/selection chronology differs')
    if gate.get('acceptedAtMs') is not None:
        require(all(v is not None and v <= budget for v in values), label + ': candidate accepted after deadline or before a completed gate')
    for field in ('wallTimeMs', 'wholeCallWallMs', 'callWallMs'):
        if field in meta and present:
            require(ledger.finite(meta[field]) and meta[field] >= max(present), label + ': wall clock predates delivery gate')
    return gate.get('acceptedAtMs') is not None


def audit_constructor(scenario, proof, meta, fixed, day, cache_accepted, label, budget):
    delivery = proof.get('constructorDelivery')
    require(isinstance(delivery, dict), label + ': missing constructor delivery proof')
    for key, expected in (('budgetMs', 40), ('auditReserveMs', 5), ('maxRestarts', 3), ('returnedResultUsedAsReceipt', False)):
        same(delivery.get(key), expected, label + '/' + key)
    require(isinstance(delivery.get('events'), list), label + ': missing constructor receipts')
    deadline = min(40, budget - 5)
    if cache_accepted:
        same(delivery.get('deadlineAtMs'), None, label + '/skipped constructor deadline')
        same(delivery['events'], [], label + '/cached incumbent skips constructor')
        same(meta.get('stages', {}).get('quickConstructor', {}).get('status'), 'valid_cache_skip', label + '/constructor skipped')
    else:
        ledger.close(delivery.get('deadlineAtMs'), deadline, label + '/construction deadline')
    accepted, incumbent = [], None
    for index, event in enumerate(delivery['events']):
        same(event.get('sequence'), index + 1, label + '/receipt sequence')
        same(event.get('source'), 'quick_constructor', label + '/receipt source')
        fields = ('receivedAtMs', 'copiedAtMs', 'auditFinishedAtMs', 'selectionFinishedAtMs', 'acceptedAtMs')
        was_accepted = gate_times(event, fields, deadline, meta, label + f'/receipt{index+1}')
        require(event.get('receivedAtMs') is not None, label + ': receipt timestamp missing')
        proposed = event.get('proposedDates')
        valid = proposed is not None and ledger.feasible_dates(scenario, proposed, fixed, day)
        if event.get('auditFinishedAtMs') is not None:
            require(event.get('copiedAtMs') is not None, label + ': audit without complete copy')
            same(event.get('audit', {}).get('valid'), valid, label + '/independent constructor physical/lock validity')
        if event.get('dates') is not None:
            require(valid, label + ': invalid constructor canonical endpoint')
            same(v8.date_map(event['dates']), v8.date_map(proposed), label + '/complete copied dates binding')
            endpoint_fees(scenario, event['dates'], event.get('fees'), label + '/constructor fee')
        else:
            same(event.get('fees'), None, label + '/absent constructor fees')
        outcome = event.get('outcome')
        rejected_at = v9.optional_time(event.get('rejectedAtMs'), label + '/constructor rejection time')
        if rejected_at is not None:
            present = [event[k] for k in fields if event.get(k) is not None]
            require(not was_accepted and rejected_at >= max(present) and meta.get('wallTimeMs', 0) >= rejected_at, label + ': constructor rejection chronology differs')
        require(outcome in ('accepted', 'not_improved', 'construction_phase_closed', 'late_receipt', 'invalid_status', 'late_copy',
                            'invalid_candidate', 'late_audit', 'late_selection', 'candidate_error'), label + ': unknown constructor outcome')
        if was_accepted:
            same(outcome, 'accepted', label + '/accepted outcome')
            require(valid and event.get('dates') is not None and event.get('fees') is not None, label + ': accepted incomplete/invalid constructor')
            require(incumbent is None or event['fees']['objectiveCost'] < incumbent['fees']['objectiveCost'] - 1e-6,
                    label + ': accepted constructor lacks strict incumbent improvement')
            incumbent = {'source': 'quick_constructor', 'dates': event['dates'], 'fees': event['fees'], 'acceptedAtMs': event['acceptedAtMs']}
            accepted.append(event)
        else:
            require(outcome != 'accepted', label + ': accepted outcome lacks acceptance timestamp')
            if outcome == 'late_receipt': require(event['receivedAtMs'] > deadline, label + '/false late receipt')
            if outcome == 'late_copy': require(event.get('copiedAtMs') is not None and event['copiedAtMs'] > deadline, label + '/false late copy')
            if outcome == 'late_audit': require(valid and event.get('auditFinishedAtMs') is not None and event['auditFinishedAtMs'] > deadline, label + '/false late audit')
            if outcome == 'invalid_candidate': require(not valid and event.get('auditFinishedAtMs') is not None, label + '/false invalid candidate')
            if outcome == 'late_selection': require(event.get('rejectedAtMs') is not None and event['rejectedAtMs'] > deadline, label + '/false late selection')
            if outcome == 'not_improved':
                require(incumbent is not None and event.get('fees') is not None and event.get('selectionFinishedAtMs') is not None
                        and event['selectionFinishedAtMs'] <= deadline and event['fees']['objectiveCost'] >= incumbent['fees']['objectiveCost'] - 1e-6,
                        label + ': rejected a timely strictly better constructor')
    same(delivery.get('firstAcceptedAtMs'), accepted[0]['acceptedAtMs'] if accepted else None, label + '/first accepted constructor receipt')
    same(delivery.get('selectedAcceptanceAtMs'), accepted[-1]['acceptedAtMs'] if accepted else None, label + '/selected constructor receipt')
    stage = meta.get('stages', {}).get('quickConstructor', {})
    if 'returnedCandidateAccepted' in stage:
        same(stage['returnedCandidateAccepted'], False, label + '/returned candidate must not synthesize receipt')
        same(stage.get('acceptedReceiptCount'), len(accepted), label + '/constructor accepted count')
    return incumbent, len(accepted), len(delivery['events']), int(stage.get('status') not in ('valid_cache_skip', 'budget_skipped'))


def audit_commitment_selection(scenario, meta, decisions, fixed, previous, day, executed, label, budget=200, seeded=False):
    proof = meta.get('stabilitySelection')
    require(isinstance(proof, dict), label + ': missing native selection proof')
    same(proof.get('rule'), 'strict_fee_then_lower_next_day_mandatory_warehouse_on_ties', label + '/selection rule')
    ledger.close(proof.get('feeEpsilonKRW'), 1e-6, label + '/fee epsilon')
    ledger.close(meta.get('timeBudgetMs'), budget, label + '/whole-call budget')
    same(proof.get('publicCapacities'), public_capacities(scenario), label + '/public capacities only')
    before, proposal, after = (proof.get(key) for key in ('beforeDates', 'proposalDates', 'afterDates'))
    same(v8.date_map(before) if before is not None else None,
         v8.date_map(list(previous.values())) if previous is not None else None, label + '/original cached full dates')
    cache_gate, native_gate = proof.get('cacheGate'), proof.get('nativeGate')
    cache_accepted = gate_times(cache_gate, ('auditFinishedAtMs', 'selectionFinishedAtMs', 'acceptedAtMs'), budget, meta, label + '/cache')
    native_accepted = gate_times(native_gate, ('receivedAtMs', 'copiedAtMs', 'auditFinishedAtMs', 'feesMatchedAtMs', 'selectionFinishedAtMs', 'acceptedAtMs'), budget, meta, label + '/native')
    cache_audited = cache_gate.get('auditFinishedAtMs') is not None
    cache_valid = before is not None and cache_audited and ledger.feasible_dates(scenario, before, fixed, day)
    proposal_valid = proposal is not None and ledger.feasible_dates(scenario, proposal, fixed, day)
    require(type(proof.get('cacheValid')) is bool, label + ': missing cache validity')
    same(proof['cacheValid'], cache_valid, label + '/independent cache validity')
    before_fees = endpoint_fees(scenario, before, proof.get('beforeFees'), label + '/before', not cache_audited)
    proposal_fees = endpoint_fees(scenario, proposal, proof.get('proposalFees'), label + '/proposal', not proposal_valid)
    after_fees = endpoint_fees(scenario, after, proof.get('afterFees'), label + '/selected')
    if cache_audited:
        v10.audit_native_endpoint_flags(scenario, before, meta.get('stages', {}).get('cacheAudit'), fixed, day, label + '/cache flags')
    if proposal is not None and native_gate.get('auditFinishedAtMs') is not None:
        v10.audit_native_endpoint_flags(scenario, proposal, meta.get('stages', {}).get('native', {}).get('audit'), fixed, day, label + '/native flags')
    require(not cache_accepted or cache_valid, label + ': invalid cached plan accepted')
    incumbent = {'source': 'cached_incumbent', 'dates': before, 'fees': before_fees, 'acceptedAtMs': cache_gate['acceptedAtMs']} if cache_accepted else None
    accepted_seeds = event_count = constructor_calls = 0
    if seeded:
        constructor, accepted_seeds, event_count, constructor_calls = audit_constructor(scenario, proof, meta, fixed, day, cache_accepted, label + '/constructor', budget)
        if constructor is not None: incumbent = constructor
        same(proof.get('preNativeIncumbent'), incumbent, label + '/pre-native incumbent complete dates/fees/time')
    if incumbent and native_gate.get('receivedAtMs') is not None:
        require(native_gate['receivedAtMs'] >= incumbent['acceptedAtMs'], label + ': native receipt predates timely incumbent')
    if proposal is not None:
        native = meta.get('nativeCertificate')
        require(isinstance(native, dict) and native.get('hasIncumbent') is True, label + ': native proposal lacks complete certificate')
        if proposal_valid and native_gate.get('feesMatchedAtMs') is not None:
            matches = native.get('objectiveCost') == proposal_fees['objectiveCost'] and all(native.get('independentCosts', {}).get(k) == proposal_fees[k] for k in FEE_FIELDS[:-1])
            same(meta.get('stages', {}).get('native', {}).get('independentCostsMatch'), matches, label + '/native fee reconciliation')
            require(not native_accepted or matches, label + ': accepted forged native fees')
    difference = proposal_fees['objectiveCost'] - incumbent['fees']['objectiveCost'] if incumbent and proposal_valid and proposal_fees else None
    if seeded:
        ledger.close(proof.get('nativeCostMinusIncumbentKRW'), difference, label + '/native minus pre-native incumbent') if difference is not None else same(proof.get('nativeCostMinusIncumbentKRW'), None, label + '/absent incumbent comparison')
    scoring = proof.get('commitmentScore')
    require(isinstance(scoring, dict) and type(scoring.get('attempted')) is bool, label + ': missing score selection proof')
    before_m = proposal_m = None
    if scoring['attempted']:
        require(incumbent is not None and difference is not None and abs(difference) <= 1e-6, label + ': commitment scoring outside valid fee tie')
        before_m = audit_commitment(scenario, incumbent['dates'], fixed, day, scoring.get('cache'), label + '/incumbent M')
        if scoring.get('proposal') is not None:
            proposal_m = audit_commitment(scenario, proposal, fixed, day, scoring['proposal'], label + '/proposal M')
        complete = before_m is not None and proposal_m is not None
        same(scoring.get('complete'), complete, label + '/score completeness')
        same(scoring.get('beforeM'), before_m, label + '/before M')
        same(scoring.get('proposalM'), proposal_m, label + '/proposal M scalar')
        start = v9.optional_time(scoring.get('startedAtMs'), label + '/score start')
        finish = v9.optional_time(scoring.get('finishedAtMs'), label + '/score finish')
        require(start is not None and finish is not None and start <= finish and native_gate.get('feesMatchedAtMs') is not None
                and start >= native_gate['feesMatchedAtMs'], label + ': scoring chronology differs')
        same(scoring.get('timely'), finish <= budget, label + '/score timely')
        require(meta.get('wallTimeMs', 0) >= finish, label + ': scoring exceeds recorded call wall')
        if native_gate.get('selectionFinishedAtMs') is not None:
            require(native_gate['selectionFinishedAtMs'] >= finish, label + ': selection precedes score finish')
    else:
        for key in ('cache', 'proposal', 'beforeM', 'proposalM', 'selectedM', 'startedAtMs', 'finishedAtMs', 'timely'):
            same(scoring.get(key), None, label + '/unattempted score ' + key)
        same(scoring.get('complete'), False, label + '/unattempted completeness')
    lower_m = (scoring.get('complete') is True and scoring.get('timely') is True and proposal_m < before_m)
    strict = difference is not None and difference < -1e-6
    if native_accepted:
        require(proposal_valid, label + ': accepted invalid native proposal')
        require(incumbent is None or strict or lower_m, label + ': equal-fee replacement lacks complete timely strictly lower independent M')
    outcome = native_gate.get('outcome')
    rejected_at = v9.optional_time(native_gate.get('rejectedAtMs'), label + '/native rejection time')
    if rejected_at is not None:
        require(not native_accepted and outcome == 'late_candidate' and rejected_at > budget
                and native_gate.get('selectionFinishedAtMs') is not None and rejected_at >= native_gate['selectionFinishedAtMs']
                and meta.get('wallTimeMs', 0) >= rejected_at, label + ': native late-rejection chronology differs')
    if seeded and outcome == 'late_candidate': require(rejected_at is not None, label + ': missing native deadline rejection timestamp')
    native_selected = native_accepted
    selected = proof.get('selectedSource')
    require(selected in ('native_highs', 'cached_incumbent', 'quick_constructor', 'no_complete_plan'), label + ': unknown selected source')
    expected_source = 'native_highs' if native_selected else incumbent['source'] if incumbent else 'no_complete_plan'
    same(selected, expected_source, label + '/timely incumbent retained')
    same(meta.get('candidateSource'), selected, label + '/selected source')
    expected_dates = proposal if native_selected else incumbent['dates'] if incumbent else None
    same(v8.date_map(after) if after is not None else None, v8.date_map(expected_dates) if expected_dates is not None else None,
         label + '/selected complete dates')
    if native_selected:
        expected_reason = 'strict_fee_replacement' if strict else 'equal_fee_lower_mandatory_warehouse' if lower_m else 'replace_invalid_cache' if proof.get('cacheStatus') == 'invalid' else 'initialize_native'
        same(proof.get('decisionReason'), expected_reason, label + '/native reason')
        same(outcome, expected_reason, label + '/native outcome')
    elif outcome in ('retain_costlier_native', 'retain_fee_tie_incomplete_commitment_score', 'retain_fee_tie_no_lower_mandatory_warehouse'):
        require(incumbent is not None and proposal_valid and difference is not None and native_gate.get('selectionFinishedAtMs') is not None
                and native_gate['selectionFinishedAtMs'] <= budget, label + ': retained comparison incomplete or late')
        require(not strict and not lower_m, label + ': discarded timely better native proposal')
        expected_reason = 'retain_costlier_native' if difference > 1e-6 else 'retain_fee_tie_incomplete_commitment_score' if scoring['attempted'] and not scoring['complete'] else 'retain_fee_tie_no_lower_mandatory_warehouse'
        same(outcome, expected_reason, label + '/retained outcome')
        same(proof.get('decisionReason'), expected_reason, label + '/retained reason')
    if scoring['attempted']:
        expected_selected_m = proposal_m if native_selected and lower_m else before_m
        same(scoring.get('selectedM'), expected_selected_m, label + '/selected M')
    same(executed, selected != 'no_complete_plan', label + '/actual accepted execution')
    if executed:
        same(v8.date_map(decisions), v8.date_map(after), label + '/actual full selected dates')
        ledger.audit_dates(scenario, after, label + '/selected physical audit', fixed, day)
    cache_difference = proposal_fees['incrementalCost'] - before_fees['incrementalCost'] if cache_valid and proposal_valid and before_fees and proposal_fees else None
    if cache_difference is not None: ledger.close(proof.get('nativeCostMinusCacheKRW'), cache_difference, label + '/native minus original cache')
    else: same(proof.get('nativeCostMinusCacheKRW'), None, label + '/absent original cache comparison')
    if cache_valid and before_fees and after_fees: ledger.close(proof.get('cacheCostMinusSelectedKRW'), before_fees['incrementalCost'] - after_fees['incrementalCost'], label + '/cache minus selected')
    else: same(proof.get('cacheCostMinusSelectedKRW'), None, label + '/absent selected cache comparison')
    same(proof.get('changedEventCount'), pending_changes(before, after, fixed) if cache_valid else None, label + '/selected pending date changes')
    same(proof.get('proposalChangedEventCount'), pending_changes(before, proposal, fixed) if cache_valid and proposal_valid else None, label + '/native pending date changes')
    counts = empty_native_counts()
    counts.update(calls=1, cacheAcceptedCalls=int(cache_accepted), nativeAcceptedCalls=int(native_selected),
                  retainedCacheCalls=int(selected == 'cached_incumbent'), completeNativeProposals=int(proposal is not None),
                  strictReplacements=int(native_selected and strict),
                  feeTiesRetained=int(outcome in ('retain_fee_tie_incomplete_commitment_score', 'retain_fee_tie_no_lower_mandatory_warehouse')),
                  commitmentReplacements=int(native_selected and lower_m), completeCommitmentScores=int(scoring['complete']),
                  incompleteCommitmentScores=int(scoring['attempted'] and not scoring['complete']),
                  constructorCalls=constructor_calls, constructorEvents=event_count, acceptedConstructorReceipts=accepted_seeds,
                  constructorSeededCalls=int(incumbent is not None and incumbent['source'] == 'quick_constructor'),
                  retainedConstructorCalls=int(selected == 'quick_constructor'))
    return counts


def initialization_evidence(result):
    timeline = result.get('timeline') or []
    first = timeline[0] if timeline else None
    unavailable = result.get('executionHistoryUnavailable') is True
    observed = not unavailable and isinstance(first, dict) and first.get('day') == 0
    accepted = (first.get('status') == 'executed' and first.get('audit', {}).get('scheduleAudit', {}).get('valid') is True
                and first.get('audit', {}).get('freezeAudit', {}).get('valid') is True) if observed else None
    failure_day = result.get('failure', {}).get('day') if isinstance(result.get('failure'), dict) and not unavailable else None
    if type(failure_day) is not int: failure_day = None
    phase = None if result.get('complete') is True else 'history_unavailable' if unavailable else 'initialization' if failure_day == 0 else 'after_initialization' if failure_day is not None and failure_day > 0 else 'unclassified_known_failure'
    traces = result.get('plannerTrace') or []
    wall = traces[0].get('callWallMs') if observed and traces else None
    return {'initialPlanAccepted': accepted, 'dayZeroObservationHash': first.get('observationHash') if observed else None,
            'dayZeroCallWallMs': wall if ledger.finite(wall) else None, 'failureDay': failure_day, 'failurePhase': phase,
            'scope': 'D0 accepted physical plan and later failure separated; no unavailable history is converted to zero calls or an initial physical failure.'}


def audit_episode(nominal, events, result, label='episode', hardWallMs=5000, method=None, call_budget=200):
    method = method or result.get('policy')
    checked = v10.audit_episode(nominal, events, result, label, hardWallMs, method, call_budget)
    counts = empty_native_counts()
    for key, value in checked['nativeStabilitySelection'].items(): counts[key] = value
    if method in ('commitmentHiGHSV11', 'seededHiGHSV12') and checked['historyAvailable']:
        actual, fixed, previous = ledger.realize(nominal, events), {}, None
        for day, (entry, call) in enumerate(zip(result['timeline'], result['plannerTrace'])):
            observation, _ = ledger.observed_snapshot(nominal, actual, events, day)
            meta = v8.metadata(call)
            audited = audit_commitment_selection(observation, meta, entry['decisions'], fixed, previous, day,
                                                 entry.get('status') == 'executed', label + f'/D{day}', call_budget,
                                                 seeded=method == 'seededHiGHSV12')
            for key, value in audited.items(): counts[key] += value
            for field, counter in (('strictReplacementCount', 'strictReplacements'), ('tieRetainedCount', 'feeTiesRetained'),
                                   ('commitmentReplacementCount', 'commitmentReplacements')):
                same(meta.get(field), counts[counter], label + '/cumulative ' + field)
            if method == 'seededHiGHSV12':
                for field in ('constructorCalls', 'acceptedConstructorReceipts'):
                    same(meta.get(field), counts[field], label + '/cumulative ' + field)
            if entry.get('status') == 'executed':
                previous = {row['id']: row for row in entry['decisions']}
                for event in entry['executedEvents']:
                    fixed.setdefault(event['id'], {})[ledger.EVENT_FIELDS[event['event']]] = day
    initialization = initialization_evidence(result)
    if 'initializationEvidence' in result:
        same(result['initializationEvidence'], initialization, label + '/D0 initialization classification')
    return {**checked, 'nativeStabilitySelection': counts, 'initializationEvidence': initialization}


def audit_historical_seeds(protocol, source_root):
    """Reconstruct exclusions from SHA-bound old declarations, not new orders."""
    declaration = protocol.get('historicalSeedExclusions')
    require(isinstance(declaration, dict) and isinstance(declaration.get('sources'), list) and declaration['sources'], 'Missing historical seed source commitments')
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
                and name != 'data/protocol-v12.json' and name not in paths, 'Invalid/duplicate historical seed declaration path')
        paths.add(name)
        path = (source_root / name).resolve()
        require(path.is_relative_to(source_root.resolve()), 'Historical source path escapes frozen source')
        require(digest(path) == source.get('sha256'), 'Historical seed source SHA differs: ' + name)
        walk(ledger.read_json(path))
    same(declaration.get('excludedSeeds'), sorted(found), 'Independent historical seed exclusion reconstruction')
    business = set(range(691001, 691073)) | set(range(692001, 692073))
    require(not (found & (business | {69011, 69023, 69039})), 'V12 declared seeds overlap historical declarations')
    return {'metadataSourceCount': len(paths), 'excludedSeedCount': len(found), 'overlappingV12Seeds': 0}


def declared_cases(protocol):
    same(protocol.get('schemaVersion'), 'portplan-protocol-v12', 'Formal protocol schema')
    same(protocol['methods'], METHODS, 'Formal method registry')
    same(protocol['analysis']['comparisons'], {k: list(v) for k, v in PAIRS.items()}, 'Frozen comparison registry')
    matrix = protocol['matrix']
    same(matrix, {'mechanisms': ['aged-backlog', 'new-arrivals', 'batch-release'],
                  'capacityProfiles': ['balanced', 'tight'], 'counts': [24, 50, 100], 'scenariosPerCell': 4}, 'Formal matrix')
    same([p['id'] for p in protocol['panels']], ['same-distribution', 'stress'], 'Formal panel identities')
    same([p['baseSeed'] for p in protocol['panels']], [691001, 692001], 'Unseen business seeds')
    same(protocol['algorithmRepeats'], [{'index': i + 1, 'seed': seed} for i, seed in enumerate((69011, 69023, 69039))],
         'Frozen timing/algorithm repeats')
    result = []
    for panel in protocol['panels']:
        index = 0
        for mechanism in matrix['mechanisms']:
            for capacity in matrix['capacityProfiles']:
                for count in matrix['counts']:
                    for repetition in range(1, 5):
                        pattern = panel['shockPatterns'][(repetition - 1) % len(panel['shockPatterns'])]
                        result.append({'id': f"v12-{panel['id']}-{mechanism}-{capacity}-n{count}-r{repetition}",
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
            init = [initialization_evidence(row) for row in units]
            expected['initialization'] = {'knownDayZeroCount': sum(r['initialPlanAccepted'] is not None for r in init),
                'acceptedInitialPlanCount': sum(r['initialPlanAccepted'] is True for r in init),
                'knownInitialFailureCount': sum(r['failurePhase'] == 'initialization' for r in init),
                'knownLaterFailureCount': sum(r['failurePhase'] == 'after_initialization' for r in init),
                'unknownDayZeroCount': sum(r['initialPlanAccepted'] is None for r in init)}
            same(producer['byMethod'][method]['initialization'], expected['initialization'], panel + '/initialization coverage')
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
    index = ledger.read_json(index_path)
    same(index.get('schemaVersion'), 'portplan-v12-streamed-experiment', 'Formal run schema')
    same(index.get('executionState'), 'complete', 'Formal run completion')
    protocol = index['protocol']
    same(protocol['methods'], METHODS, 'Formal methods')
    require(fixture or len(index['cases']) == 144, 'Formal coverage differs from frozen 144 cases')
    snapshot = (directory / index['frozenSource']).resolve()
    frozen_path = snapshot / 'manifest.json'
    frozen = ledger.read_json(frozen_path)
    same(frozen.get('schemaVersion'), 'portplan-v12-frozen-source', 'Frozen schema')
    same(index['protocolHash'], frozen['protocolHash'], 'Protocol binding')
    same(protocol, frozen['protocol'], 'Protocol content')
    if not fixture:
        same(frozen['scenarioMetadata'], declared_cases(protocol), 'Independent formal declaration expansion')
        require(protocol['budget']['hardWallMs'] == 5000 and protocol['budget']['cpuThreads'] == 1, 'Formal budget differs')
        same(protocol['budget'].get('parentAcceptance'), PARENT_ACCEPTANCE, 'Prespecified formal parent acceptance')
        old_protocol = json.loads((snapshot / 'source/data/protocol-v10.json').read_text())
        for method in ('costPolishV7', 'adaptiveV9', 'highsV8', 'stableHiGHSV10'):
            same(protocol['callBudgets'][method], old_protocol['callBudgets'][method], 'Unchanged baseline configuration ' + method)
        same(protocol['callBudgets']['commitmentHiGHSV11'], protocol['callBudgets']['highsV8'], 'Unchanged V11 native numeric parameters')
        expected_v12 = {**protocol['callBudgets']['highsV8'], 'constructorBudgetMs': 40, 'constructorAuditReserveMs': 5, 'maxRestarts': 3}
        same(protocol['callBudgets']['seededHiGHSV12'], expected_v12, 'Prespecified V12 constructor/native parameters')
        for method in METHODS:
            same(protocol['callBudgets'][method]['timeBudgetMs'], 200, 'Prespecified daily budget ' + method)
        status = protocol.get('executionAuthorization', {}).get('status', '')
        require(status == 'ready-for-source-freeze', 'Formal run lacks finalized execution authorization')
        require(not any(field in protocol['callBudgets']['adaptiveV9'] for field in ('onIncumbent', 'onCandidate')),
                'Formal diagnostic observers are forbidden')
    require(digest(snapshot / 'source/data/protocol-v12.json') == index['protocolHash'], 'Protocol bytes differ')
    same(index['implementationHashes'], frozen['implementationHashes'], 'Implementation commitments')
    for path, expected in frozen['implementationHashes'].items():
        source = (snapshot / 'source' / path).resolve()
        require(source.is_relative_to((snapshot / 'source').resolve()), 'Implementation path escapes snapshot')
        require(digest(source) == expected, 'Frozen implementation changed: ' + path)
    for name in ('scripts/review-v10.py', 'scripts/review-v9.py', 'scripts/review-v8.py', 'scripts/review-v5.py'):
        require(name in frozen['implementationHashes'], 'Unbound independent ledger dependency ' + name)
        require(digest(ROOT / name) == frozen['implementationHashes'][name], 'Current independent ledger differs from frozen dependency ' + name)
    historical_seed_review = audit_historical_seeds(protocol, snapshot / 'source') if not fixture else None
    generator_protocol = json.loads((snapshot / 'source/data/protocol-v2.json').read_text())
    counters = {'episodes': 0, 'completeEpisodes': 0, 'historyUnavailable': 0, 'acceptedPlans': 0,
                'physicalEvents': 0, 'polishEndpoints': 0}
    candidate_counts = {key: 0 for key in ('candidateEvents', 'completeCopiedCandidates', 'acceptedCandidates',
                                         'independentlyInvalidCandidates', 'callsWithTimelyIncumbent')}
    native_counts = empty_native_counts()
    parent_counts = {key: 0 for key in ('terminalReceiptWithinBudget', 'normalWorkerExit', 'processGroupGone',
                                        'cleanupWithinBudget', 'endToEndWithinBudget', 'acceptedHistory', 'completeEpisode')}
    by_panel, reviewed = {}, []
    require(len(index['cases']) == len(frozen['scenarioMetadata']), 'Frozen/run case count differs')
    seen_ids, seen_inputs, seen_episodes = set(), set(), set()
    for scenario_index, case in enumerate(index['cases']):
        require(case['id'] not in seen_ids, 'Duplicate case id'); seen_ids.add(case['id'])
        config = frozen['scenarioMetadata'][scenario_index]
        for field, value in config.items():
            same(case.get(field), value, 'Case/frozen declaration ' + field)
        input_path, source = v8.checked_artifact(directory, case['inputArtifact'])
        require(input_path not in seen_inputs, 'Scenario input artifact reused'); seen_inputs.add(input_path)
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
            same(repetition['methodExecutionOrder'], [METHODS[(scenario_index + ri + i) % len(METHODS)] for i in range(len(METHODS))], 'Method rotation')
            for method in METHODS:
                receipt = repetition['policies'][method]
                episode_path, envelope = v8.checked_artifact(directory, receipt['artifact'])
                require(episode_path not in seen_episodes, 'Episode artifact reused'); seen_episodes.add(episode_path)
                same(envelope.get('scenarioId'), case['id'], 'Episode scenario identity')
                same(receipt.get('scalarReceipt'), True, 'Scalar receipt declaration')
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
                same(result.get('hardWallMs'), protocol['budget']['hardWallMs'], 'Result hard budget')
                parent = audit_formal_parent_receipt(receipt, result, protocol['budget']['hardWallMs'], envelope['episodeId'])
                checked = audit_episode(nominal, events, result, envelope['episodeId'], protocol['budget']['hardWallMs'],
                                        method, configuration.get('timeBudgetMs', 200))
                for key, value in parent.items(): parent_counts[key] += value
                units[method].append(result)
                counters['episodes'] += 1; counters['completeEpisodes'] += checked['complete']
                counters['historyUnavailable'] += not checked['historyAvailable']; counters['acceptedPlans'] += checked['acceptedPlans']
                counters['physicalEvents'] += checked['executedEvents']; counters['polishEndpoints'] += checked.get('polishEndpoints', 0)
                for key, value in checked['candidateDelivery'].items():
                    candidate_counts[key] += value
                for key, value in checked['nativeStabilitySelection'].items():
                    native_counts[key] += value
                reviewed.append({'id': envelope['episodeId'], 'artifactSha256': receipt['artifact']['sha256'],
                                 'parentLifecycle': parent, **checked})
        by_panel.setdefault(case['panel'], []).append({'id': case['id'], 'units': units})
        require(digest(input_path) == case['inputArtifact']['sha256'], 'Read-only review changed scenario input')
    estimates = point_estimates(by_panel, index['summary'], fixture)
    require(fixture or counters['episodes'] == 2592, 'Formal episode coverage must be 144 x 3 x 6')
    require(digest(index_path) == index_hash, 'Read-only review changed final index')
    return {'schemaVersion': 'portplan-independent-v12-run-review', 'valid': True, 'fixture': fixture, 'readOnly': True,
            'importsJavaScript': False, 'solverRuns': 0, 'inputIndexSha256': index_hash,
            'frozenManifestSha256': digest(frozen_path), 'implementationSha256': digest(__file__),
            'unchangedV10ReviewSha256': digest(ROOT / 'scripts/review-v10.py'),
            'unchangedV9ReviewSha256': digest(ROOT / 'scripts/review-v9.py'),
            'unchangedV8ReviewSha256': digest(ROOT / 'scripts/review-v8.py'), 'ledgerSha256': digest(ROOT / 'scripts/review-v5.py'),
            'historicalSeedExclusions': historical_seed_review,
            'summary': counters, 'parentLifecycle': parent_counts,
            'candidateDelivery': candidate_counts, 'nativeStabilitySelection': native_counts,
            'pointEstimates': estimates, 'episodes': reviewed,
            'scope': 'Independent Python input, causal execution/locks/resources/tariffs, formal parent final/normal exit/ESRCH group cleanup/end-to-end eligibility, V9 copied-candidate delivery, V10 strict selection, V11/V12 necessary warehouse-score capacity-filtered broad domains, V12 constructor receipt and native incumbent selection, and point estimates. Unaccepted raw terminals are preserved and bound, not attributed as accepted physical execution or reaudited as full physical histories. Recorded clocks and OS verification receipts are not externally authenticated; bootstrap audited separately. No optimality, future recovery, enterprise benefit or third-party certification.'}


def safe_path(base, relative, label):
    require(isinstance(relative, str) and relative and not Path(relative).is_absolute() and '..' not in Path(relative).parts,
            label + ': unsafe relative path')
    path = (base / relative).resolve()
    require(path.is_relative_to(base.resolve()), label + ': path escapes root')
    return path


def review_development(directory):
    """Audit existing declared D0 endpoints; this never reruns the planner."""
    directory = directory.resolve()
    declaration_path, summary_path = directory / 'declaration.json', directory / 'summary.json'
    declaration_sha, summary_sha = digest(declaration_path), digest(summary_path)
    declaration, summary = ledger.read_json(declaration_path), ledger.read_json(summary_path)
    same(declaration.get('schemaVersion'), 'portplan-v12-D0-development-declaration-1', 'Development declaration schema')
    same(summary.get('schemaVersion'), 'portplan-v12-D0-development-summary-1', 'Development summary schema')
    for obj in (declaration, summary):
        same(obj.get('newHeldOutExperiments'), False, 'Development must remain old observed inputs')
    same(declaration.get('parametersChangedAfterDeclaration'), False, 'No post-declaration parameter changes')
    same(summary.get('developmentOnly'), True, 'Development role')
    same(summary.get('fullRollingCompletionClaim'), False, 'No full rolling completion claim')
    same(declaration.get('callBudgetMs'), 200, 'Development whole-call budget')
    same(declaration.get('wholeEndpointSafetyCutoffMs'), 5000, 'Development safety cutoff')
    same(declaration.get('coldReadyBeforeEachEndpoint'), True, 'Cold endpoint native readiness')
    same(declaration.get('readyChargedToRecordedEndpointWall'), True, 'Cold startup accounting')
    expected_configuration = {'timeBudgetMs': 200, 'constructorBudgetMs': 40, 'constructorAuditReserveMs': 5, 'maxRestarts': 3,
                              'auditReserveMs': 2, 'hardOverrunGraceMs': 250, 'initializationTimeoutMs': 10000, 'retainCacheFallback': True}
    same(declaration.get('configuration'), expected_configuration, 'Fixed development parameters')
    same(summary.get('sourceBindings'), declaration.get('sourceBindings'), 'Development source commitments')
    require(isinstance(declaration.get('sourceBindings'), dict) and declaration['sourceBindings'], 'Missing frozen development source')
    for name, expected in declaration['sourceBindings'].items():
        path = safe_path(directory / 'source', name, 'Frozen development implementation')
        same(digest(path), expected, 'Frozen development source SHA ' + name)
    manifest_path = safe_path(ROOT, declaration['manifestPath'], 'Input manifest')
    manifest_sha = digest(manifest_path)
    same(manifest_sha, declaration['manifestSha256'], 'Declared input manifest SHA')
    same(manifest_sha, summary['manifestSha256'], 'Summary input manifest SHA')
    manifest = ledger.read_json(manifest_path)
    same(manifest.get('schemaVersion'), 'portplan-v12-fixed-old-D0-development-inputs-1', 'Old-input manifest schema')
    same(manifest.get('newSolverCalls'), 0, 'Input manifest must be zero-solve')
    same(manifest.get('newHeldOutExperiments'), False, 'Input manifest development role')
    same(manifest.get('fixedConfiguration'), expected_configuration, 'Manifest parameter commitment')
    same(declaration.get('records'), manifest.get('records'), 'Exact preregistered endpoint list')
    old_index = ROOT / 'data/evidence-v10/v10-frozen-first/first-run/complete.json'
    same(manifest.get('inputIndexSha256'), '33d07f60afb4b4248682badc631512a54070cca22fd106c7dd5062d4669bf9c2', 'Published V10 anchor')
    same(digest(old_index), manifest['inputIndexSha256'], 'Published V10 original index SHA')
    source_review = safe_path(ROOT, manifest['sourceReviewPath'], 'Source independent review')
    same(digest(source_review), manifest['sourceReviewSha256'], 'Source independent review SHA')
    reviewed_source = ledger.read_json(source_review)
    require(reviewed_source.get('valid') is True, 'Source independent review is not valid')
    expected_loss_d0 = {(r['caseId'], r['repeatIndex']) for r in reviewed_source['v10VsV7LossEpisodes'] if r.get('failureDay') == 0 and r.get('baselineComplete') is True}
    same({(r['caseId'], r['repeatIndex']) for r in declaration['records']}, expected_loss_d0, 'Exact previously identified D0 losses against completing V7')
    original = ledger.read_json(old_index)
    expected_old = {}
    for case in original['cases']:
        for repeat in case['repeats']:
            receipt = repeat['policies']['stableHiGHSV10']
            if receipt.get('complete') is False and receipt.get('executionHistoryUnavailable') is not True and (receipt.get('failure') or {}).get('day') == 0:
                expected_old[(case['id'], repeat['repeatIndex'])] = (case, repeat, receipt)
    require(len(declaration['records']) == len(summary['results']) == 15, 'All fifteen predeclared old D0 loss endpoints must remain included')
    require(len({r['caseId'] for r in declaration['records']}) == 5, 'Development has five reused business inputs')
    same(declaration.get('caseOrder'), [{k: r[k] for k in ('caseId', 'repeatIndex', 'algorithmSeed', 'inputSha256', 'episodeSha256')} for r in declaration['records']], 'Declared execution order')
    counts, endpoints, seen, grouped = empty_native_counts(), [], set(), {}
    call_walls, accept_walls, startup_walls, endpoint_walls = [], [], [], []
    for position, (binding, receipt) in enumerate(zip(declaration['records'], summary['results'])):
        identity = (binding['caseId'], binding['repeatIndex'])
        require(identity in expected_old and identity not in seen, 'Missing/duplicate/undeclared old failure endpoint')
        seen.add(identity)
        case, repeat, old_receipt = expected_old[identity]
        same(binding['algorithmSeed'], {1: 49011, 2: 49023, 3: 49039}[binding['repeatIndex']], 'Old repeat seed')
        same(binding['algorithmSeed'], repeat['algorithmSeed'], 'Original repeat binding')
        input_path = safe_path(ROOT, binding['inputPath'], 'Old input')
        old_episode_path = safe_path(ROOT, binding['episodePath'], 'Old episode')
        same(digest(input_path), binding['inputSha256'], 'Original input SHA')
        same(digest(old_episode_path), binding['episodeSha256'], 'Original episode SHA')
        same(binding['inputSha256'], case['inputArtifact']['sha256'], 'Original index input SHA')
        same(binding['episodeSha256'], old_receipt['artifact']['sha256'], 'Original index episode SHA')
        old_case, old_episode = ledger.read_json(input_path), ledger.read_json(old_episode_path)
        nominal, events = old_case['nominalScenario'], old_case['events']
        actual = ledger.realize(nominal, events)
        snapshot, observations = ledger.observed_snapshot(nominal, actual, events, 0)
        old_trace = old_episode['result']['plannerTrace'][0]
        old_selection = v8.metadata(old_trace)['stabilitySelection']
        same(old_episode['result']['failure']['day'], 0, 'Original physical failure boundary')
        same(old_selection.get('afterDates'), None, 'Original D0 had no accepted complete candidate')
        endpoint_path = safe_path(directory, receipt['path'], 'Development endpoint')
        same(digest(endpoint_path), receipt['sha256'], 'Development endpoint SHA')
        endpoint = ledger.read_json(endpoint_path)
        same(endpoint.get('schemaVersion'), 'portplan-v12-D0-development-endpoint-1', 'Endpoint schema')
        same(endpoint.get('index'), position + 1, 'Endpoint execution order')
        same(endpoint.get('binding'), binding, 'Endpoint exact old-input binding')
        same(endpoint.get('publicScenario'), snapshot, 'Independent causal D0 public snapshot')
        hashed = {'scenario': snapshot, 'observedEvents': observations, 'fixedEvents': {}, 'minEventDay': 0}
        checksum = ledger.checksum(hashed, endpoint.get('observationHash'))
        same(checksum, endpoint['observationHash'], 'Independently reconstructed D0 observation SHA')
        same(checksum, binding['originalObservationHash'], 'Original D0 observation binding')
        same(checksum, old_episode['result']['timeline'][0]['observationHash'], 'Original recorded D0 hash')
        same(endpoint.get('options'), {'minEventDay': 0, 'fixedEvents': {}, 'objectiveMode': 'joint', 'timeBudgetMs': 200, 'seed': binding['algorithmSeed']}, 'Endpoint public options')
        same(endpoint.get('error'), None, 'Endpoint runner error')
        same(endpoint.get('cutoffReached'), False, 'Endpoint safety deadline')
        result, startup = endpoint['result'], endpoint['startup']
        same(result.get('policy'), 'seededHiGHSV12', 'Endpoint method')
        require(result.get('status') in ('feasible', 'optimal'), 'Endpoint lacks complete feasible incumbent')
        totals = ledger.audit_schedule(snapshot, result, 'Development full current plan')
        require(totals is not None, 'Endpoint has no complete dates')
        ledger.audit_dates(snapshot, result['rows'], 'Development original physical locks', {}, 0)
        same(endpoint.get('audit', {}).get('schedule', {}).get('valid'), True, 'Recorded endpoint schedule audit')
        same(endpoint.get('audit', {}).get('locks', {}).get('valid'), True, 'Recorded endpoint lock audit')
        meta = v8.metadata(result)
        checked = audit_commitment_selection(snapshot, meta, result['rows'], {}, None, 0, True, binding['caseId'] + '/D0', 200, seeded=True)
        for key, value in checked.items(): counts[key] += value
        same(meta.get('constructorCalls'), checked['constructorCalls'], 'D0 cumulative constructor calls')
        same(meta.get('acceptedConstructorReceipts'), checked['acceptedConstructorReceipts'], 'D0 cumulative accepted receipt count')
        for key, field in (('strictReplacementCount', 'strictReplacements'), ('tieRetainedCount', 'feeTiesRetained'), ('commitmentReplacementCount', 'commitmentReplacements')):
            same(meta.get(key), checked[field], 'D0 cumulative native selection counter')
        accepted = meta['stabilitySelection']['constructorDelivery']['firstAcceptedAtMs']
        require(accepted is not None and accepted <= 40, 'D0 complete seed was not timely')
        require(startup.get('solverThreads') == 1 and ledger.finite(startup.get('startupWallMs')), 'Missing cold single-thread native readiness')
        require(ledger.finite(endpoint.get('wholeEndpointWallMs')) and endpoint['wholeEndpointWallMs'] >= startup['startupWallMs'] + result['runtimeMs']
                and endpoint['wholeEndpointWallMs'] <= 5000, 'Cold readiness/whole endpoint timing inconsistent')
        expected_receipt = {'caseId': binding['caseId'], 'repeatIndex': binding['repeatIndex'], 'algorithmSeed': binding['algorithmSeed'],
            'status': result['status'], 'timelyCompleteCandidate': True, 'candidateSource': meta['candidateSource'],
            'startupMs': startup['startupWallMs'], 'callWallMs': result['runtimeMs'], 'deadlineOverrunMs': meta['deadlineOverrunMs'],
            'constructorAcceptedCount': checked['acceptedConstructorReceipts'], 'firstConstructorAcceptanceMs': accepted,
            'objectiveCost': result['objectiveCost'], 'nativeStatus': meta['nativeCertificate']['status'],
            'nativeHasIncumbent': meta['nativeCertificate']['hasIncumbent'], 'nativeOutcome': meta['stabilitySelection']['nativeGate']['outcome'],
            'wholeEndpointWallMs': endpoint['wholeEndpointWallMs'], 'error': None}
        for key, value in expected_receipt.items(): same(receipt.get(key), value, 'Summary/full endpoint ' + key)
        call_walls.append(result['runtimeMs']); accept_walls.append(accepted); startup_walls.append(startup['startupWallMs']); endpoint_walls.append(endpoint['wholeEndpointWallMs'])
        group = grouped.setdefault(binding['caseId'], {'repeatCount': 0, 'completeCandidateCount': 0, 'constructorSeedCount': 0})
        group['repeatCount'] += 1; group['completeCandidateCount'] += 1; group['constructorSeedCount'] += int(checked['acceptedConstructorReceipts'] > 0)
        endpoints.append({'caseId': binding['caseId'], 'repeatIndex': binding['repeatIndex'], 'algorithmSeed': binding['algorithmSeed'],
            'artifactSha256': receipt['sha256'], 'observationHash': checksum, 'independentFees': totals,
            'seedAcceptedAtMs': accepted, 'wholeCallReturnMs': result['runtimeMs'], 'wholeCallReturnExceededCooperativeBudget': result['runtimeMs'] > 200,
            'nativeOutcome': meta['stabilitySelection']['nativeGate']['outcome'], 'selection': checked})
    same(grouped, summary.get('grouped'), 'All five scenario/repeat groups')
    for key, value in (('independentBusinessScenarioCount', 5), ('timingRepeatCountPerScenario', 3), ('endpointCount', 15),
                       ('timelyCompleteCandidateCount', 15), ('constructorSeedEndpointCount', 15)):
        same(summary.get(key), value, 'Development independent summary ' + key)
    same(digest(declaration_path), declaration_sha, 'Read-only declaration unchanged')
    same(digest(summary_path), summary_sha, 'Read-only summary unchanged')
    return {'schemaVersion': 'portplan-independent-v12-seed-development-review', 'valid': True, 'readOnly': True,
            'developmentOnly': True, 'newHeldOutExperiments': False, 'fullRollingCompletionClaim': False,
            'importsJavaScript': False, 'solverRuns': 0, 'implementationSha256': digest(__file__),
            'inputSummarySha256': summary_sha, 'declarationSha256': declaration_sha, 'inputManifestSha256': manifest_sha,
            'originalV10IndexSha256': manifest['inputIndexSha256'], 'frozenDevelopmentSources': declaration['sourceBindings'],
            'summary': {'endpointCount': 15, 'reusedBusinessScenarioCount': 5, 'timelyCompleteSeedCount': 15,
                'allPublishedKnownV10D0Failures': len(expected_old), 'selectionScope': 'Exactly fifteen preregistered D0 losses against completing V7, not all published D0 failures',
                'wholeCallReturnOverrunCount': sum(w > 200 for w in call_walls),
                'wholeCallReturnRangeMs': [min(call_walls), max(call_walls)],
                'wholeCallReturnOverrunRangeMs': [max(0, min(call_walls) - 200), max(0, max(call_walls) - 200)],
                'firstCompleteSeedAcceptanceRangeMs': [min(accept_walls), max(accept_walls)],
                'coldStartupRangeMs': [min(startup_walls), max(startup_walls)],
                'coldWholeEndpointRangeMs': [min(endpoint_walls), max(endpoint_walls)]},
            'nativeSelection': counts, 'endpoints': endpoints,
            'scope': 'Independent Python reconstruction of fifteen preregistered D0 endpoints on five reused published V10 failure inputs, complete dates/resources/locks/tariffs, public snapshot and SHA bindings, constructor callback receipt/copy/audit/selection deadlines, and retention against late/absent native proposals. The immediate producer gates were JavaScript; this later Python review is independent. Timely seed acceptance does not mean the function returned by 200ms. All actual call overruns remain explicit. No unseen holdout, full rolling success, optimality, future recovery guarantee, enterprise benefit or external clock authentication.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--episode', type=Path)
    source.add_argument('--run', type=Path)
    source.add_argument('--development', type=Path, help='Read-only review of already recorded old-input D0 endpoints')
    parser.add_argument('--fixture', action='store_true', help='Handwritten artifact-I/O tests only; not a formal result')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.development:
        require(not args.fixture, 'Development evidence is not a handwritten fixture')
        result = review_development(args.development)
    elif args.run:
        result = review_run(args.run, args.fixture)
    else:
        before = digest(args.episode)
        record = ledger.read_json(args.episode)
        case = record.get('case', record.get('input', record))
        checked = audit_episode(case['nominalScenario'], case.get('events', []), record['result'],
                                record.get('episodeId', record.get('caseId', 'episode')), record['result'].get('hardWallMs', 5000))
        require(digest(args.episode) == before, 'Read-only review changed input')
        result = {'schemaVersion': 'portplan-independent-v12-episode-review', 'valid': True, 'readOnly': True,
                  'importsJavaScript': False, 'solverRuns': 0, 'inputSha256': before, 'implementationSha256': digest(__file__),
                  'unchangedV8ReviewSha256': digest(ROOT / 'scripts/review-v8.py'), 'ledgerSha256': digest(ROOT / 'scripts/review-v5.py'),
                  'checked': checked, 'scope': 'Internal physical reconstruction and recorded candidate timestamp/selection consistency; no external clock authentication'}
    if args.output:
        require(not args.output.exists(), 'Refuse to replace a previous review')
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(json.dumps({key: value for key, value in result.items() if key not in ('episodes', 'endpoints')}, ensure_ascii=False, allow_nan=False))


if __name__ == '__main__':
    main()
