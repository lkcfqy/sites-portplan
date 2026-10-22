"""Handwritten independent-review fixtures; no optimizer or JavaScript import."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('review_guard', ROOT / 'scripts/review-replay-guard-v13.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)


def scene():
    return {'id': 'handwritten-v13-review', 'horizonStart': '2026-10-13', 'horizonDays': 9,
            'truckCapacity': 4, 'warehouseCapacity': 2, 'stagingCapacity': 2,
            'containers': [{'id': 'A', 'sizeFt': 20, 'releaseDay': 0, 'unloadDays': 2,
                            'dueDay': 7, 'dischargeDateTime': '2026-09-01T07:00:00+09:00'}]}


def rows(pickup, unload, returned):
    return [{'id': 'A', 'pickupDay': pickup, 'unloadDay': unload, 'returnDay': returned}]


def valid_audit():
    return {'valid': True, 'errors': [], 'scheduleAudit': {'valid': True, 'errors': []},
            'freezeAudit': {'valid': True, 'errors': []}}


def score(scenario, dates):
    return {**m.v12.independent_commitment(scenario, dates, {}, 0),
            'complete': True, 'status': 'complete', 'scoringWallMs': .1}


def guard_fixture(mode='blocked'):
    s = scene()
    before = rows(5, 5, 7) if mode == 'accepted' else rows(3, 3, 5)
    proposed = rows(3, 3, 5) if mode == 'accepted' else rows(0, 0, 2)
    fees_before, fees_proposed = (m.v12.reprice_dates(s, r) for r in (before, proposed))
    a, b = score(s, before), score(s, proposed)
    before_m, proposal_m = (r['mandatoryWarehouseTomorrow'] for r in (a, b))
    accepted = mode == 'accepted'
    reason = 'no_mandatory_load_increase' if accepted else 'mandatory_load_increase'
    selected = proposed if accepted else before
    fees_selected = fees_proposed if accepted else fees_before
    proof = {
        'rule': m.GUARD_RULE, 'feeEpsilonKRW': 1e-6, 'cacheStatus': 'valid', 'cacheValid': True,
        'beforeDates': before, 'beforeFees': fees_before, 'proposalDates': proposed, 'proposalFees': fees_proposed,
        'afterDates': selected, 'afterFees': fees_selected,
        'nativeCostMinusCacheKRW': fees_proposed['objectiveCost'] - fees_before['objectiveCost'],
        'nativeCostMinusIncumbentKRW': fees_proposed['objectiveCost'] - fees_before['objectiveCost'],
        'cacheCostMinusSelectedKRW': fees_before['objectiveCost'] - fees_selected['objectiveCost'],
        'changedEventCount': m.v12.pending_changes(before, selected, {}),
        'proposalChangedEventCount': m.v12.pending_changes(before, proposed, {}),
        'decisionReason': 'strict_fee_replacement_no_m_increase' if accepted else 'retain_cheaper_native_' + reason,
        'selectedSource': 'native_highs' if accepted else 'cached_incumbent',
        'publicCapacities': m.v12.public_capacities(s),
        'cacheGate': {'auditFinishedAtMs': 1, 'selectionFinishedAtMs': 1.2, 'acceptedAtMs': 1.4},
        'constructorDelivery': {'budgetMs': 40, 'auditReserveMs': 5, 'maxRestarts': 3, 'deadlineAtMs': None,
                                'events': [], 'firstAcceptedAtMs': None, 'selectedAcceptanceAtMs': None,
                                'returnedResultUsedAsReceipt': False},
        'preNativeIncumbent': {'source': 'cached_incumbent', 'dates': before, 'fees': fees_before, 'acceptedAtMs': 1.4},
        'nativeGate': {'receivedAtMs': 2, 'copiedAtMs': 3, 'auditFinishedAtMs': 4, 'feesMatchedAtMs': 5,
                       'selectionFinishedAtMs': 8, 'acceptedAtMs': 9 if accepted else None,
                       'outcome': 'strict_fee_replacement_no_m_increase' if accepted else 'retain_cheaper_native_' + reason},
        'commitmentScore': {'attempted': True, 'complete': True, 'cache': a, 'proposal': b,
                            'beforeM': before_m, 'proposalM': proposal_m,
                            'selectedM': proposal_m if accepted else before_m,
                            'startedAtMs': 6, 'finishedAtMs': 7, 'timely': True, 'skipReason': None, 'error': None},
        'strictFeeGuard': {'attempted': True, 'complete': True, 'timely': True, 'eligible': accepted,
                           'decision': 'accepted' if accepted else 'retained_incumbent', 'reason': reason,
                           'incumbentSource': 'cached_incumbent', 'incumbentDates': before, 'incumbentFees': fees_before,
                           'proposalDates': proposed, 'proposalFees': fees_proposed,
                           'incumbentM': before_m, 'proposalM': proposal_m,
                           'selectedM': proposal_m if accepted else before_m,
                           'scoringStartedAtMs': 6, 'scoringFinishedAtMs': 7, 'comparisonFinishedAtMs': 8,
                           'acceptedAtMs': 9 if accepted else None, 'rejectedAtMs': None if accepted else 9, 'error': None}}
    meta = {'timeBudgetMs': 200, 'wallTimeMs': 15, 'candidateSource': proof['selectedSource'],
            'stabilitySelection': proof, 'nativeCertificate': {'hasIncumbent': True,
            'objectiveCost': fees_proposed['objectiveCost'], 'independentCosts': fees_proposed},
            'stages': {'cacheAudit': valid_audit(), 'quickConstructor': {'status': 'valid_cache_skip'},
                       'native': {'status': 'optimal', 'audit': valid_audit(), 'independentCostsMatch': True}}}
    return s, meta, selected, {r['id']: r for r in before}


def check_guard(fixture):
    s, meta, selected, previous = fixture
    return m.audit_guard_selection(s, meta, selected, {}, previous, 0, True)


def import_fixture():
    s, endpoint = scene(), rows(5, 5, 7)
    receipt = {'schemaVersion': 'portplan-v13-development-endpoint-import-1', 'developmentOnly': True,
               'accepted': True, 'status': 'accepted', 'claimsNativeDiscovery': False, 'claimsPhysicalExecution': False,
               'decisionCalls': 0, 'solverCalls': 0, 'startedAtMs': 110, 'deadlineMs': 300,
               'receivedAtMs': 0, 'copiedAtMs': 1, 'validatedAtMs': 2, 'auditFinishedAtMs': 3,
               'proofFinishedAtMs': 4, 'acceptedAtMs': 5, 'rejectedAtMs': None,
               'snapshot': s, 'sourceDates': endpoint, 'fixedEvents': {}, 'minEventDay': 5,
               'canonicalDates': endpoint, 'fees': m.v12.reprice_dates(s, endpoint),
               'audit': {'valid': True, 'errors': []}, 'error': None}
    record = {'forcedStepStartedAtMs': 100, 'forcedStepDeadlineMs': 300,
              'forcedStepAcceptanceWallMs': 21, 'forcedStepTimely': True, 'callWallMs': 20}
    bind_import(receipt, record)
    return receipt, s, endpoint, {}, record, True, 'handwritten-import'


def bind_import(receipt, record):
    record['offlineImportBinding'] = {key: None if receipt[field] is None else m.value_sha(receipt[field])
        for key, field in [('snapshotSha256', 'snapshot'), ('sourceDatesSha256', 'sourceDates'),
                           ('fixedEventsSha256', 'fixedEvents'), ('canonicalDatesSha256', 'canonicalDates'), ('feesSha256', 'fees')]}


class GuardReviewTests(unittest.TestCase):
    def rejects_guard(self, change, mode='blocked'):
        f = guard_fixture(mode)
        change(f)
        with self.assertRaises((ValueError, KeyError, TypeError)):
            check_guard(f)

    def test_cheaper_m_increase_is_retained_with_full_dates(self):
        f = guard_fixture()
        original = copy.deepcopy(f)
        checked = check_guard(f)
        self.assertEqual(checked['strictGuardBlockedMIncrease'], 1)
        self.assertEqual(checked['strictReplacements'], 0)
        self.assertEqual(f, original, 'Legacy bridge must never mutate raw metadata')

    def test_cheaper_nonincreasing_m_can_be_accepted(self):
        checked = check_guard(guard_fixture('accepted'))
        self.assertEqual(checked['strictGuardAccepted'], 1)
        self.assertEqual(checked['strictReplacements'], 1)

    def test_forged_wide_legal_domain_or_m_scalar_is_rejected(self):
        self.rejects_guard(lambda f: f[1]['stabilitySelection']['commitmentScore']['proposal']['containers'][0].update(legalTripCount=0))
        self.rejects_guard(lambda f: f[1]['stabilitySelection']['strictFeeGuard'].update(proposalM=0))

    def test_cheaper_candidate_cannot_bypass_guard(self):
        self.rejects_guard(lambda f: f[1]['stabilitySelection']['strictFeeGuard'].update(attempted=False))
        self.rejects_guard(lambda f: f[1]['stabilitySelection']['strictFeeGuard'].update(eligible=True))
        self.rejects_guard(lambda f: f[1]['stabilitySelection'].update(selectedSource='native_highs'))

    def test_complete_proof_cannot_be_claimed_by_non_boolean(self):
        self.rejects_guard(lambda f: f[1]['stabilitySelection']['strictFeeGuard'].update(complete=1))
        self.rejects_guard(lambda f: f[1]['stabilitySelection']['commitmentScore'].update(attempted=1))

    def test_incomplete_proposal_cannot_be_zero_imputed(self):
        self.rejects_guard(lambda f: f[1]['stabilitySelection']['commitmentScore']['proposal'].update(
            complete=False, status='time_limit', mandatoryWarehouseTomorrow=0, mandatoryWarehouseLoad=0))

    def test_genuine_partial_proposal_retains_incumbent(self):
        f = guard_fixture(); p = f[1]['stabilitySelection']; scoring = p['commitmentScore']; guard = p['strictFeeGuard']
        scoring['proposal'].update(complete=False, status='time_limit', mandatoryWarehouseTomorrow=None,
                                   mandatoryWarehouseLoad=None, containers=[], legalTripCount=0)
        scoring.update(complete=False, proposalM=None)
        guard.update(complete=False, proposalM=None, reason='incomplete_score')
        p['decisionReason'] = p['nativeGate']['outcome'] = 'retain_cheaper_native_incomplete_score'
        self.assertEqual(check_guard(f)['strictGuardIncompleteOrError'], 1)

    def test_late_atomic_selection_keeps_timely_incumbent(self):
        f = guard_fixture(); p = f[1]['stabilitySelection']; f[1]['wallTimeMs'] = 220
        p['nativeGate'].update(selectionFinishedAtMs=201, rejectedAtMs=202, outcome='late_candidate')
        p['strictFeeGuard'].update(comparisonFinishedAtMs=201, rejectedAtMs=202, reason='late_selection')
        p['decisionReason'] = 'retain_without_timely_valid_native'
        self.assertEqual(check_guard(f)['strictGuardLate'], 1)

    def test_accepted_native_requires_final_deadline_and_matching_fees(self):
        self.rejects_guard(lambda f: f[1]['stabilitySelection']['nativeGate'].update(acceptedAtMs=201), 'accepted')
        self.rejects_guard(lambda f: f[1]['nativeCertificate'].update(objectiveCost=0), 'accepted')

    def test_current_shadow_locks_and_public_capacity_cannot_be_forged(self):
        self.rejects_guard(lambda f: f[1]['stabilitySelection']['commitmentScore']['proposal']['publicCapacities']['warehouse'].__setitem__(1, 0))
        self.rejects_guard(lambda f: f[1]['stabilitySelection']['commitmentScore']['cache'].update(shadowFixedEvents={'A': {'pickupDay': 0}}))

    def test_import_accepts_only_exact_current_endpoint_and_shared_clock(self):
        self.assertEqual(m.audit_import(*import_fixture()), 1)

    def test_import_cannot_reset_deadline_or_commit_late(self):
        for field, value in [('deadlineMs', 310), ('startedAtMs', 296), ('proofFinishedAtMs', 6)]:
            f = import_fixture(); f[0][field] = value
            with self.assertRaises(ValueError): m.audit_import(*f)

    def test_import_complete_copy_hashes_are_independently_bound(self):
        f = import_fixture(); f[4]['offlineImportBinding']['feesSha256'] = '0' * 64
        with self.assertRaises(ValueError): m.audit_import(*f)
        f = import_fixture(); f[0]['canonicalDates'] = rows(6, 6, 8); bind_import(f[0], f[4])
        with self.assertRaises(ValueError): m.audit_import(*f)

    def test_import_cannot_claim_natural_discovery_or_prior_solver_calls(self):
        for field, value in [('claimsNativeDiscovery', True), ('claimsPhysicalExecution', True), ('solverCalls', 1), ('decisionCalls', 1)]:
            f = import_fixture(); f[0][field] = value
            with self.assertRaises(ValueError): m.audit_import(*f)

    def test_rejected_import_preserves_null_hashes_and_cannot_execute(self):
        f = list(import_fixture()); f[0].update(accepted=False, status='late_import', acceptedAtMs=None,
            canonicalDates=None, fees=None, error='deadline'); f[5] = False; bind_import(f[0], f[4])
        self.assertEqual(m.audit_import(*f), 0)
        self.assertIsNone(f[4]['offlineImportBinding']['feesSha256'])
        f[5] = True
        with self.assertRaises(ValueError): m.audit_import(*f)

    def test_post_journal_forced_acceptance_must_still_be_timely(self):
        for field, value in [('forcedStepAcceptanceWallMs', 201), ('forcedStepTimely', False), ('callWallMs', 22)]:
            f = import_fixture(); f[4][field] = value
            with self.assertRaises(ValueError): m.audit_import(*f)

    def test_task_matrix_is_fixed_before_any_source_or_solver_work(self):
        p = json.loads((ROOT / 'data/protocol-development-v13.json').read_text())
        self.assertEqual(len(m.expected_jobs(p)), 12)
        for change in [lambda q: q['jobs'].pop(), lambda q: q['jobs'].__setitem__(1, q['jobs'][0]),
                       lambda q: q.update(algorithmSeed=69023), lambda q: q.update(newHeldOutExperiments=12)]:
            q = copy.deepcopy(p); change(q)
            with self.assertRaises(ValueError): m.audit_protocol(q)

    def test_summary_never_imputes_failed_fee_and_uses_matched_clock_pairs(self):
        records = []
        for job in m.expected_jobs({}):
            complete = not (job['caseId'] == m.CASE_IDS[0] and job['timingRepeatIndex'] == 2 and job['branch'] == 'forced_native')
            cost = 100 if job['branch'] == 'forced_seed' else 80
            records.append({**job, 'receipt': {'complete': complete, 'executionHistoryUnavailable': False,
                'status': 'complete' if complete else 'failed', 'failure': None if complete else {'day': 6},
                'totalCost': cost if complete else None, 'incrementalCost': cost if complete else None,
                'revisionCount': 3 if complete else None}})
        checked = m.summarize(records)
        self.assertEqual(checked['jointlyCompletedTimingPairCount'], 5)
        failed_pair = next(p for p in checked['pairs'] if not p['jointlyCompleted'])
        self.assertIsNone(failed_pair['totalSeedMinusNativeKRW'])
        self.assertIsNone(failed_pair['revisionSeedMinusNative'])
        self.assertEqual(checked['uniqueBusinessScenarioCount'], 2)
        self.assertFalse(checked['ciComputed'])

    def test_paths_and_canonical_hashes_preserve_array_order(self):
        for path in ['../outside', '/etc/passwd', 'data/../../outside']:
            with self.assertRaises(ValueError): m.safe(ROOT, path)
        self.assertEqual(m.value_sha({'b': 2, 'a': 1}), m.value_sha({'a': 1, 'b': 2}))
        self.assertNotEqual(m.value_sha([1, 2]), m.value_sha([2, 1]))


if __name__ == '__main__':
    unittest.main()
