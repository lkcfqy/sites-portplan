"""Portable V14 reviewer and hostile-evidence fixtures, no optimizer imports."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module); return module
m = load('v14_review_fixture', ROOT/'scripts/review-v14.py')
prior = load('handwritten_guard_fixtures', ROOT/'tests/review-replay-guard-v13-fixtures.py')
v12, guard = m.load_helpers(ROOT)


def protocol_fixture():
    p = json.loads((ROOT/'data/protocol-v14.json').read_text())
    p.update(schemaVersion='portplan-protocol-v14', methods=list(m.METHODS))
    p['analysis']['comparisons'] = {k:list(v) for k,v in m.PAIRS.items()}
    p['panels'][0]['baseSeed'], p['panels'][1]['baseSeed'] = 791001, 792001
    p['algorithmRepeats'] = [{'index':i+1,'seed':s} for i,s in enumerate([79011,79023,79039])]
    p['callBudgets'][m.GUARDED] = copy.deepcopy(p['callBudgets']['seededHiGHSV12'])
    found = set(); m.walk_seeds(json.loads((ROOT/'data/protocol-v12.json').read_text()),found)
    p['historicalSeedExclusions'] = {'sources':[{'path':'data/protocol-v12.json','sha256':m.digest(ROOT/'data/protocol-v12.json')}],
                                   'excludedSeeds':sorted(found)}
    return p


def unknown_result(method):
    result = {'policy':method,'status':'hard_timeout','complete':False,'auditValid':False,'executionHistoryUnavailable':True,
        'rows':[],'usage':[],'timeline':[],'plannerTrace':[],'executedEvents':[],'revisionCount':None,
        'hardWallMs':5000,'actualCutoffMs':5000,'processExitWallTimeMs':5005,'processCloseWallTimeMs':5006,
        'cleanupFinishedMs':5100,'endToEndWallTimeMs':5100,'wallTimeMs':5100,'normalWorkerExit':False,'exitCode':None,'exitSignal':'SIGKILL',
        'deadlineReached':True,'terminalReceiptWithinBudget':False,'terminalReceiptAcceptedAsHistory':False,'endToEndCompletedWithinBudget':False,
        'episodeCompletedWithinBudget':False,'outputDeliveredWithinBudget':False,'finalReceivedMs':None,'receiptValidatedMs':None,
        'unacceptedTerminalReceipts':[], 'processGroupCleanup':{'mode':'posix-process-group','attempted':True,'startedAtMs':5006,'finishedAtMs':5100,
        'attempts':[{'reason':'hard_deadline_final_cleanup','atMs':5006,'signal':'SIGKILL','attempted':True,'sent':True}],
        'killSignalSent':True,'verificationResult':'ESRCH','verificationAtMs':5099,'verificationError':None,
        'verifiedProcessGroupGone':True,'successful':True}}
    result.update({k:None for k in (*v12.FEE_FIELDS,'lateCount')})
    result['initializationEvidence'] = v12.initialization_evidence(result)
    return result


def write_json(path, value):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')


def io_fixture(root):
    bundle = root/'portable-bundle'; run = bundle/'first-run'; frozen_source = bundle/'source'
    p = protocol_fixture()
    for name in [*m.HELPERS,'scripts/review-v14.py','data/protocol-v12.json','data/protocol-v2.json']:
        target = frozen_source/name; target.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(ROOT/name,target)
    write_json(frozen_source/'data/protocol-v14.json',p)
    for name in p['frozenAlgorithmBindings']:
        target = frozen_source/name; target.parent.mkdir(parents=True,exist_ok=True); shutil.copyfile(ROOT/name,target)
    names = sorted(set([*m.HELPERS,'scripts/review-v14.py','data/protocol-v12.json','data/protocol-v2.json','data/protocol-v14.json',*p['frozenAlgorithmBindings']]))
    hashes = {name:m.digest(frozen_source/name) for name in names}
    config = {'id':'handwritten-v14-I-O','panel':'same-distribution'}
    frozen = {'schemaVersion':'portplan-v14-frozen-source','protocol':p,'protocolHash':hashes['data/protocol-v14.json'],
              'implementationHashes':hashes,'scenarioMetadata':[config],'sourceGitCommit':'1'*40,'sourceGitTree':'2'*40,
              'sourceCommitVerified':True,'gitObjectFormat':'sha1','committedBlobHashes':{},'generatedProspectiveInputs':False}
    for name in names:
        data=(frozen_source/name).read_bytes();frozen['committedBlobHashes'][name]=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest()
    push={'schemaVersion':'portplan-v14-root-verified-source-push','sourceGitCommit':frozen['sourceGitCommit'],
          'remoteName':'origin','branch':'main','observedRemoteCommit':frozen['sourceGitCommit'],'verifiedAt':'2026-10-17T00:00:00Z',
          'verification':'git push then authenticated git ls-remote exact branch; root observation, not external attestation'}
    write_json(bundle/'source-push-receipt.json',push)
    frozen['sourcePushReceipt']={'path':'source-push-receipt.json','sha256':m.digest(bundle/'source-push-receipt.json'),'record':push}
    write_json(bundle/'manifest.json',frozen)
    source={'config':config,'nominalScenario':prior.scene(),'events':[]};input_path=run/'inputs/handwritten.json';write_json(input_path,source)
    case={**config,'inputArtifact':{'path':'inputs/handwritten.json','sha256':m.digest(input_path)},'repeats':[]}
    for ri in range(3):
        policies={}
        for method in m.METHODS:
            result=unknown_result(method);episode_id=f"{config['id']}--a{ri+1}--{method}";name=f'episodes/{method}-{ri+1}.json'
            envelope={'scenarioId':config['id'],'caseId':config['id'],'panel':config['panel'],'method':method,'repeatIndex':ri+1,
                      'algorithmSeed':p['algorithmRepeats'][ri]['seed'],'episodeId':episode_id,'result':result}
            write_json(run/name,envelope)
            policies[method]={**result,'scalarReceipt':True,'terminalRowCount':0,'artifact':{'path':name,'sha256':m.digest(run/name)}}
        case['repeats'].append({'repeatIndex':ri+1,'algorithmSeed':p['algorithmRepeats'][ri]['seed'],'policies':policies,
                               'methodExecutionOrder':[m.METHODS[(ri+i)%7] for i in range(7)]})
    method_summary={method:{'recordedEpisodeCount':3,'completeEpisodeCount':0,'fullyCompletedScenarioCount':0,'anyCompletedScenarioCount':0,
        'initialization':{'knownDayZeroCount':0,'acceptedInitialPlanCount':0,'knownInitialFailureCount':0,'knownLaterFailureCount':0,'unknownDayZeroCount':3}} for method in m.METHODS}
    comparison={name:{'completion':{'gainedEpisodeCount':0,'lostEpisodeCount':0},'revisions':{'baselineObservedSum':0,'candidateObservedSum':0},
        'fees':{key:{'pairedScenarioCount':0,'pairedEpisodeCount':0,'scenarioWinTieLoss':{'win':0,'tie':0,'loss':0},
                    'baselineScenarioMeanSumKRW':0,'candidateScenarioMeanSumKRW':0,'weightedSavingsPct':None} for key in ['total','incremental']}} for name in m.PAIRS}
    index={'schemaVersion':'portplan-v14-streamed-experiment','executionState':'complete','protocol':p,'protocolHash':frozen['protocolHash'],
           'implementationHashes':hashes,'frozenSource':'..','cases':[case],
           'summary':{'panels':{'same-distribution':{'byMethod':method_summary,'comparisons':comparison}}}}
    index.update({field:frozen[field] for field in ('sourceGitCommit','sourceGitTree','gitObjectFormat','committedBlobHashes')})
    index.update(rootAuthorized=True,studyMethod=m.GUARDED,initialization=p['initialization'])
    index['manifestSha256']=m.digest(bundle/'manifest.json')
    marker={'schemaVersion':'portplan-v14-first-run-execution-start','rootAuthorized':True,'manifestSha256':index['manifestSha256'],
            'protocolHash':frozen['protocolHash'],'sourceGitCommit':frozen['sourceGitCommit'],
            'sourcePushReceiptSha256':frozen['sourcePushReceipt']['sha256'],'plannedEpisodeCount':3024,'outputRelativeToFrozen':'first-run'}
    write_json(bundle/'execution-start.json',marker)
    index['executionStartArtifact']={'path':'../execution-start.json','sha256':m.digest(bundle/'execution-start.json')}
    write_json(run/'run.json',{**index,'executionState':'running','cases':[],'summary':None})
    write_json(run/'complete.json',index)
    return run,index,frozen


class V14ReviewFixtures(unittest.TestCase):
    def test_declaration_expands_all_new_metadata_without_generating_orders(self):
        p=protocol_fixture();cases=m.declared_cases(p)
        self.assertEqual(len(cases),144);self.assertEqual(cases[0]['seed'],791001);self.assertEqual(cases[72]['seed'],792001)
        self.assertEqual(len({c['seed'] for c in cases}),144)
        self.assertTrue(m.audit_protocol(p,ROOT,v12)['valid'])

    def test_natural_startup_calls_and_cooperative_overrun_are_separate_from_parent_deadline(self):
        configuration={'timeBudgetMs':200}
        r={'studyVersion':'v14','naturalFullD0':True,'developmentEndpointImportEnabled':False,
           'perCallBudget':{'configuration':configuration},'startupWallMs':10,'finalReceivedMs':300,
           'plannerTrace':[{'callWallMs':201,'developmentEndpointImport':None}],
           'plannerStats':{'decisionCalls':1,'callWallMs':[201],'planningWallMs':201,'maxCallWallMs':201}}
        checked=m.audit_natural_receipt(r,configuration,v12,'fixture')
        self.assertEqual(checked['dailyCooperativeOverruns'],1)
        for mutation in [lambda q:q.update(startupWallMs=301),lambda q:q['plannerStats'].update(planningWallMs=0),
                         lambda q:q['perCallBudget']['configuration'].update(timeBudgetMs=1000)]:
            q=copy.deepcopy(r);mutation(q)
            with self.assertRaises(ValueError):m.audit_natural_receipt(q,configuration,v12,'fixture')

    def test_compact_statistics_preserve_unknown_initial_and_later_failure_classification(self):
        for r in [unknown_result(m.GUARDED),
                  {'complete':False,'timeline':[{'day':0,'status':'planning_failed','observationHash':'x'}],
                   'plannerTrace':[{'callWallMs':1}],'failure':{'day':0}},
                  {'complete':False,'timeline':[{'day':0,'status':'executed','observationHash':'x','audit':prior.valid_audit()}],
                   'plannerTrace':[{'callWallMs':1}],'failure':{'day':6}}]:
            self.assertEqual(v12.initialization_evidence(r),v12.initialization_evidence(m.statistical_unit(r)))

    def test_old_seed_missing_method_or_wrong_clock_matrix_is_rejected(self):
        for mutation in [lambda p:p['panels'][0].update(baseSeed=691001),lambda p:p['algorithmRepeats'][0].update(seed=69011),
                         lambda p:p['methods'].pop(),lambda p:p['analysis']['comparisons'].pop('v13VsV12')]:
            p=protocol_fixture();mutation(p)
            with self.assertRaises(ValueError):m.declared_cases(p)

    def test_natural_budget_and_import_configuration_are_fixed(self):
        for mutation in [lambda p:p['callBudgets'][m.GUARDED].update(timeBudgetMs=1000),
                         lambda p:p['callBudgets'][m.GUARDED].update(enableDevelopmentEndpointImport=True),
                         lambda p:p['budget']['parentAcceptance'].update(timelyFinalAloneIsCompletion=True)]:
            p=protocol_fixture();mutation(p)
            with self.assertRaises(ValueError):m.audit_protocol(p,ROOT,v12)

    def test_partial_or_forged_historical_metadata_is_rejected(self):
        p=protocol_fixture();p['historicalSeedExclusions']['excludedSeeds'].pop()
        with self.assertRaises(ValueError):m.audit_historical_seeds(p,ROOT)
        p=protocol_fixture();p['historicalSeedExclusions']['sources'][0]['sha256']='0'*64
        with self.assertRaises(ValueError):m.audit_historical_seeds(p,ROOT)

    def test_frozen_python_helpers_resolve_inside_restored_bundle_without_live_raw(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            for name in m.HELPERS:
                target=root/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(ROOT/name,target)
            frozen_v12,frozen_guard=m.load_helpers(root)
            self.assertEqual(frozen_v12.ROOT,root);self.assertEqual(frozen_guard.ROOT,root)
            f=prior.guard_fixture('accepted');s,meta,selected,previous=f
            self.assertEqual(frozen_guard.audit_guard_selection(s,meta,selected,{},previous,0,True)['strictGuardAccepted'],1)

    def test_strict_guard_m_domain_price_and_deadline_cannot_be_bypassed(self):
        s,meta,selected,previous=prior.guard_fixture()
        self.assertEqual(guard.audit_guard_selection(s,meta,selected,{},previous,0,True)['strictGuardBlockedMIncrease'],1)
        for mutation in [lambda p:p['strictFeeGuard'].update(eligible=True),
                         lambda p:p['commitmentScore']['proposal']['containers'][0].update(legalTripCount=0)]:
            altered=copy.deepcopy(meta);mutation(altered['stabilitySelection'])
            with self.assertRaises(ValueError):guard.audit_guard_selection(s,altered,selected,{},previous,0,True)

    def test_portable_complete_io_retains_every_unknown_result_and_null_fee(self):
        with tempfile.TemporaryDirectory() as directory:
            run,_,_=io_fixture(Path(directory));review=m.review_run(run,fixture=True)
            self.assertTrue(review['valid']);self.assertTrue(review['fixture']);self.assertEqual(review['solverRuns'],0)
            self.assertEqual(review['summary']['episodes'],21);self.assertEqual(review['summary']['historyUnavailable'],21)
            self.assertEqual(review['summary']['completeEpisodes'],0);self.assertEqual(review['guardedSelection']['calls'],0)
            self.assertEqual(review['parentLifecycle']['acceptedHistory'],0)

    def test_compact_parent_fields_and_failed_fees_bind_full_raw(self):
        for field,value in [('exitSignal',None),('totalCost',0),('cleanupFinishedMs',1)]:
            with tempfile.TemporaryDirectory() as directory:
                run,index,_=io_fixture(Path(directory));index['cases'][0]['repeats'][0]['policies'][m.METHODS[0]][field]=value
                write_json(run/'complete.json',index)
                with self.assertRaises(ValueError):m.review_run(run,fixture=True)

    def test_one_method_omitted_or_raw_reused_fails_complete_matrix(self):
        with tempfile.TemporaryDirectory() as directory:
            run,index,_=io_fixture(Path(directory));index['cases'][0]['repeats'][0]['policies'].pop(m.GUARDED);write_json(run/'complete.json',index)
            with self.assertRaises(ValueError):m.review_run(run,fixture=True)
        with tempfile.TemporaryDirectory() as directory:
            run,index,_=io_fixture(Path(directory));a=index['cases'][0]['repeats'][0]['policies'];a[m.GUARDED]['artifact']=a[m.METHODS[0]]['artifact'];write_json(run/'complete.json',index)
            with self.assertRaises(ValueError):m.review_run(run,fixture=True)

    def test_git_blob_hashes_are_recomputed_without_git(self):
        with tempfile.TemporaryDirectory() as directory:
            run,_,frozen=io_fixture(Path(directory));source=run.parent/'source'
            self.assertGreater(m.audit_git_bindings(frozen,source)['copiedBlobCount'],0)
            frozen['committedBlobHashes']['scripts/review-v14.py']='0'*40
            with self.assertRaises(ValueError):m.audit_git_bindings(frozen,source)

    def test_first_run_marker_and_push_receipt_cannot_name_another_output_or_commit(self):
        for mutate in [lambda q:q.update(outputRelativeToFrozen='second-run'),lambda q:q.update(plannedEpisodeCount=21),
                       lambda q:q.update(sourcePushReceiptSha256='0'*64)]:
            with tempfile.TemporaryDirectory() as directory:
                run,index,frozen=io_fixture(Path(directory));path=run.parent/'execution-start.json';marker=m.read_json(path);mutate(marker);write_json(path,marker)
                index['executionStartArtifact']['sha256']=m.digest(path)
                with self.assertRaises(ValueError):m.audit_execution_bindings(index,frozen,run.parent,run,index['manifestSha256'])
        with tempfile.TemporaryDirectory() as directory:
            run,index,frozen=io_fixture(Path(directory));frozen['sourcePushReceipt']['record']['observedRemoteCommit']='0'*40
            with self.assertRaises(ValueError):m.audit_execution_bindings(index,frozen,run.parent,run,index['manifestSha256'])

    def test_source_tampering_and_paths_escape_never_fall_back_to_live_files(self):
        with tempfile.TemporaryDirectory() as directory:
            run,_,_=io_fixture(Path(directory));(run.parent/'source/scripts/review-v5.py').write_text('tampered')
            with self.assertRaises(ValueError):m.review_run(run,fixture=True)
        with self.assertRaises(ValueError):m.safe_path(ROOT,'../outside')
        with self.assertRaises(ValueError):m.safe_path(ROOT,'/etc/passwd')

    def test_all_three_timing_repeats_remain_separate_from_business_units(self):
        with tempfile.TemporaryDirectory() as directory:
            run,index,_=io_fixture(Path(directory));panel=index['summary']['panels']['same-distribution']
            panel['comparisons']['v13VsV12']['fees']['total']['pairedEpisodeCount']=3;write_json(run/'complete.json',index)
            with self.assertRaises(ValueError):m.review_run(run,fixture=True)


if __name__=='__main__':unittest.main()
