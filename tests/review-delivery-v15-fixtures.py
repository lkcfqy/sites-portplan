"""Handwritten V15 economic/deadline evidence checks; no optimizer imports."""
import copy
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[1]
def load(name,path):
    spec=importlib.util.spec_from_file_location(name,path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
m=load('v15_independent_review',ROOT/'scripts/review-delivery-v15.py')
old=load('v15_handwritten_old_guard_fixture',ROOT/'tests/review-replay-guard-v13-fixtures.py')
v12,guard=m.load_helpers(ROOT)


def delivery():
    proof={'schemaVersion':'portplan-v15-native-return-budget','wholeDeadlineAtMs':200,'nativeDeadlineAtMs':190,
        'nativeReturnTargetAtMs':190,'outerAcceptanceDeadlineAtMs':200,'nativeReturnReserveMs':10,'serviceAuditReserveMs':2,
        'nativeRequestStartedAtMs':40,'readyFinishedAtMs':50,'requestClockSampleAtMs':50,'remainingAtServiceReadyMs':140,
        'requestUnixNowMs':1000000000000,'nativeDeadlineUnixMs':1000000000140,'serializationFinishedAtMs':51,
        'preSendCheckedAtMs':52,'requestSentAtMs':52,'requestStatus':'dispatched','serviceRequestDispatched':True,
        'actualServiceResponse':True,'requestSettledAtMs':186,'requestSettlement':'service_response',
        'nativeResponseReceivedAtMs':185,'nativeReturnTargetMet':True,
        'acceptanceDeadline':'original_whole_call_deadline_not_earlier_native_target'}
    return {'timeBudgetMs':200,'wallTimeMs':205,'deliveryBudget':proof,'nativeCertificate':{'status':'optimal','hasIncumbent':True},
            'stabilitySelection':{'nativeGate':{'receivedAtMs':186}}}


def economic():
    s,meta,_,previous=old.guard_fixture()
    proof=meta['stabilitySelection'];selected=proof['proposalDates']
    proof.update(rule='strict_fee_then_lower_next_day_mandatory_warehouse_on_ties',afterDates=selected,afterFees=proof['proposalFees'],
        selectedSource='native_highs',decisionReason='strict_fee_replacement',
        changedEventCount=v12.pending_changes(proof['beforeDates'],selected,{}),
        cacheCostMinusSelectedKRW=proof['beforeFees']['objectiveCost']-proof['proposalFees']['objectiveCost'])
    proof['nativeGate'].update(outcome='strict_fee_replacement',acceptedAtMs=9)
    proof.pop('strictFeeGuard');proof['commitmentScore']=guard.empty_score();meta['candidateSource']='native_highs'
    return s,meta,selected,previous


class DeliveryReviewFixtures(unittest.TestCase):
    def test_unchanged_economics_accepts_strictly_cheaper_even_if_m_increases(self):
        s,meta,selected,previous=economic()
        self.assertEqual(m.audit_economic_selection(s,meta,selected,{},previous,0,True,v12,'fixture')['strictReplacements'],1)

    def test_unknown_outcome_cannot_hide_timely_cheaper_candidate_veto(self):
        s,meta,_,previous=economic();p=meta['stabilitySelection'];p['nativeGate'].update(acceptedAtMs=None,outcome='hidden_guard')
        p.update(selectedSource='cached_incumbent',afterDates=p['beforeDates'],afterFees=p['beforeFees'],
                 cacheCostMinusSelectedKRW=0,changedEventCount=0,decisionReason='hidden_guard');meta['candidateSource']='cached_incumbent'
        with self.assertRaises(ValueError):m.audit_economic_selection(s,meta,p['beforeDates'],{},previous,0,True,v12,'fixture')

    def test_original_guard_is_only_allowed_in_v13_negative_control(self):
        s,meta,selected,previous=old.guard_fixture()
        self.assertEqual(m.audit_live_selection(s,meta,selected,{},previous,0,True,'guardedHiGHSV13',v12,guard,'fixture')['strictGuardBlockedMIncrease'],1)
        with self.assertRaises(ValueError):m.audit_live_selection(s,meta,selected,{},previous,0,True,'timelyHiGHSV15',v12,guard,'fixture')

    def test_private_cache_import_is_always_rejected(self):
        s,meta,selected,previous=economic();meta['developmentEndpointImport']={'accepted':True}
        with self.assertRaises(ValueError):m.audit_live_selection(s,meta,selected,{},previous,0,True,'timelyHiGHSV15',v12,guard,'fixture')

    def test_same_clock_190ms_native_and_200ms_outer_deadlines(self):
        self.assertEqual(m.audit_delivery_budget(delivery(),v12,'fixture')['nativeTargetMet'],1)
        for field,value in [('nativeDeadlineAtMs',200),('nativeReturnReserveMs',0),('serviceAuditReserveMs',12),('wholeDeadlineAtMs',210)]:
            meta=delivery();meta['deliveryBudget'][field]=value
            with self.assertRaises(ValueError):m.audit_delivery_budget(meta,v12,'fixture')

    def test_ready_serialization_cannot_reset_remaining_or_unix_deadline(self):
        for field,value in [('remainingAtServiceReadyMs',150),('nativeDeadlineUnixMs',1000000000150),('readyFinishedAtMs',49)]:
            meta=delivery();meta['deliveryBudget'][field]=value
            with self.assertRaises(ValueError):m.audit_delivery_budget(meta,v12,'fixture')

    def test_pipe_send_after_native_deadline_is_rejected(self):
        meta=delivery();meta['deliveryBudget'].update(serializationFinishedAtMs=190,preSendCheckedAtMs=191,requestSentAtMs=191)
        meta['deliveryBudget'].update(nativeResponseReceivedAtMs=195,nativeReturnTargetMet=False,requestSettledAtMs=196);meta['stabilitySelection']['nativeGate']['receivedAtMs']=196
        with self.assertRaises(ValueError):m.audit_delivery_budget(meta,v12,'fixture')

    def test_actual_return_may_miss_target_without_becoming_a_new_200ms_hard_guarantee(self):
        meta=delivery();meta['deliveryBudget'].update(nativeResponseReceivedAtMs=195,nativeReturnTargetMet=False)
        meta['deliveryBudget']['requestSettledAtMs']=196;meta['stabilitySelection']['nativeGate']['receivedAtMs']=196
        self.assertEqual(m.audit_delivery_budget(meta,v12,'fixture')['nativeTargetMissed'],1)
        meta['deliveryBudget']['nativeReturnTargetMet']=True
        with self.assertRaises(ValueError):m.audit_delivery_budget(meta,v12,'fixture')

    def test_no_dispatch_cannot_claim_child_response_or_solver_work(self):
        meta=delivery();p=meta['deliveryBudget']
        p.update(requestStatus='native_return_budget_exhausted_before_ipc',serviceRequestDispatched=False,
            requestClockSampleAtMs=189,readyFinishedAtMs=189,remainingAtServiceReadyMs=1,
            requestUnixNowMs=1000000000000,nativeDeadlineUnixMs=None,serializationFinishedAtMs=None,preSendCheckedAtMs=None,requestSentAtMs=None,
            nativeResponseReceivedAtMs=None,nativeReturnTargetMet=None,actualServiceResponse=False,requestSettlement='not_dispatched',requestSettledAtMs=190)
        meta['nativeCertificate']={'status':'time_limit','hasIncumbent':False};meta['stabilitySelection']['nativeGate']['receivedAtMs']=190
        self.assertEqual(m.audit_delivery_budget(meta,v12,'fixture')['requestsSkippedBeforeDispatch'],1)
        p['nativeResponseReceivedAtMs']=195
        with self.assertRaises(ValueError):m.audit_delivery_budget(meta,v12,'fixture')

    def test_dispatched_timeout_and_error_are_unknown_returns_not_target_hits_or_misses(self):
        for status,kind in [('time_limit','hard_timeout'),('solver_error','service_error')]:
            meta=delivery();meta['wallTimeMs']=455
            meta['deliveryBudget'].update(actualServiceResponse=False,nativeResponseReceivedAtMs=None,nativeReturnTargetMet=None,
                requestSettlement=kind,requestSettledAtMs=451)
            meta['stabilitySelection']['nativeGate']['receivedAtMs']=451
            meta['nativeCertificate']={'status':status,'hasIncumbent':False,**({'hardTimeout':True} if kind=='hard_timeout' else {})}
            checked=m.audit_delivery_budget(meta,v12,'fixture')
            self.assertEqual(checked['requests'],1);self.assertEqual(checked['nativeTargetUnknown'],1)
            self.assertEqual(checked['nativeTargetMet'],0);self.assertEqual(checked['nativeTargetMissed'],0)
            meta['deliveryBudget']['nativeReturnTargetMet']=False
            with self.assertRaises(ValueError):m.audit_delivery_budget(meta,v12,'fixture')

    def test_return_and_comparison_clocks_bind_outer_receipt(self):
        meta=delivery();meta['stabilitySelection']['nativeGate']['receivedAtMs']=184
        with self.assertRaises(ValueError):m.audit_delivery_budget(meta,v12,'fixture')
        meta=delivery();meta['deliveryBudget']['serializationFinishedAtMs']=49
        with self.assertRaises(ValueError):m.audit_delivery_budget(meta,v12,'fixture')

    def test_real_old_metadata_contract_retains_all_twelve_endpoints_not_only_eight_losses(self):
        p=json.loads((ROOT/'data/protocol-development-v15.json').read_text())
        checked=m.audit_protocol(p,ROOT,ROOT,v12)
        self.assertEqual(checked['archivedEndpointCount'],12);self.assertEqual(checked['originalLossEpisodes'],8)
        self.assertEqual(sum(e['originalComplete'] for e in checked['endpoints']),4)

    def test_missing_repeat_new_seed_or_second_candidate_change_is_rejected(self):
        p=json.loads((ROOT/'data/protocol-development-v15.json').read_text())
        for mutation in [lambda q:q['endpoints'].pop(),lambda q:q['originalRepeats'][0].update(seed=79012),
                         lambda q:q['candidateChange'].update(nativeReturnReserveMs=20)]:
            altered=copy.deepcopy(p);mutation(altered)
            with self.assertRaises(ValueError):m.audit_protocol(altered,ROOT,ROOT,v12)

    def test_matched_terminal_fees_never_zero_impute_failed_branch(self):
        p=json.loads((ROOT/'data/protocol-development-v15.json').read_text());records=[]
        for job in m.expected_jobs(p['endpoints']):
            complete=not (job['method']=='timelyHiGHSV15' and job['repeatIndex']==1)
            records.append({**job,'receipt':{'complete':complete,'executionHistoryUnavailable':False,'status':'feasible' if complete else 'rolling_failed',
                'failure':None if complete else {'day':job['interventionDay']},'totalCost':100 if complete else None,
                'incrementalCost':50 if complete else None,'revisionCount':3 if complete else None}})
        summary=m.summarize(records)
        self.assertEqual(summary['runCount'],36);self.assertEqual(summary['uniqueBusinessScenarioCount'],4)
        self.assertEqual(summary['comparisons'][0]['lost'],4)
        failed=next(row for row in summary['comparisons'][0]['pairs'] if not row['jointlyCompleted'])
        self.assertIsNone(failed['totalBaselineMinusCandidateKRW']);self.assertIsNone(failed['revisionBaselineMinusCandidate'])

    def test_output_is_exclusive_and_missing_originals_never_fall_back_to_live_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'existing-review.json';path.write_text('preserve first bytes')
            r=subprocess.run(['python3','-B',str(ROOT/'scripts/review-delivery-v15.py'),'--protocol',str(ROOT/'data/protocol-development-v15.json'),'--output',str(path)],capture_output=True,text=True)
            self.assertNotEqual(r.returncode,0);self.assertEqual(path.read_text(),'preserve first bytes')
            p=json.loads((ROOT/'data/protocol-development-v15.json').read_text())
            with self.assertRaises(FileNotFoundError):m.audit_protocol(p,Path(directory),ROOT,v12)


if __name__=='__main__':unittest.main()
