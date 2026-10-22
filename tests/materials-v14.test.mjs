import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('V14 material gates reject partial, imported, mismatched and adverse-omitted evidence; fixture layout stays in memory',()=>{
  const modulePath=new URL('../scripts/build-defense-v14.py',import.meta.url).pathname;
  const code=String.raw`
import copy,hashlib,importlib.util,json,subprocess,sys,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('v14_materials',${JSON.stringify(modulePath)})
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def fixture():
    # Explicit layout fixture only; never passed as accepted formal inputs.
    summary={'panels':{}}
    for panel in m.PANELS:
        methods={name:{'recordedEpisodeCount':216,'completeEpisodeCount':0,
            'initialization':{'acceptedInitialPlanCount':0,'knownInitialFailureCount':0,'knownLaterFailureCount':0,'unknownDayZeroCount':216}} for name in m.METHODS}
        pairs={}
        for name,(baseline,candidate) in m.PAIRS.items():
            fee={'pairedScenarioCount':0,'pairedEpisodeCount':0,'baselineScenarioMeanSumKRW':0,'candidateScenarioMeanSumKRW':0,
                'baselineEpisodeSumKRW':0,'candidateEpisodeSumKRW':0,'weightedSavingsPct':None,'worstScenarioLossKRW':0,
                'scenarioWinTieLoss':{'win':0,'tie':0,'loss':0},'negativeScenarioIds':[],'negativeEpisodeIds':[],
                'uncertainty':{'weightedSavingsPct95CI':None,'meanSavings95CI':None}}
            pairs[name]={'baselineMethod':baseline,'candidateMethod':candidate,'fees':{'total':copy.deepcopy(fee),'incremental':copy.deepcopy(fee)},
                'completion':{'gainedEpisodeCount':0,'lostEpisodeCount':0,'gainedEpisodeIds':[],'lostEpisodeIds':[],
                    'uncertainty':{'meanScenarioRateGain95CI':None}},'revisions':{'baselineObservedSum':0,'candidateObservedSum':0,'pairedEpisodeCount':0}}
        common={'jointScenarioCount':0,'jointEpisodeCount':0,'byMethod':{name:{'scenarioMeanTotalCostSumKRW':None,
            'scenarioMeanIncrementalCostSumKRW':None,'scenarioMeanRevisionCountSum':None} for name in m.METHODS}}
        gates={'defaultRecommendationEligible':False,'completionLossCountsByBaseline':{name:0 for name in m.METHODS[:-1]},
            'nativeComparisons':{name:{'stabilityImprovementClaimAllowed':False} for name in ('seededHiGHSV12','commitmentHiGHSV11','stableHiGHSV10','highsV8')}}
        summary['panels'][panel]={'scenarioCount':72,'byMethod':methods,'comparisons':pairs,'jointCompletePareto':common,'observedDecisionGates':gates}
    return {'fixture':True,'summary':summary,'index':{'cases':[]},'wrapper':{'formalIndex':{'sha256':'0'*64}},
        'hashes':{'data/review-v14.json':'1'*64,'data/bootstrap-review-v14.json':'2'*64},'adverseIdentifierOccurrences':0}

def tiny_adverse():
    e=fixture();cases=[]
    for panel in m.PANELS:
        identifier='TEMPLATE-'+panel
        policies={name:{'complete':True,'totalCost':100,'incrementalCost':50,'revisionCount':2} for name in m.METHODS}
        policies['guardedHiGHSV13'].update({'totalCost':110,'incrementalCost':60,'revisionCount':3})
        cases.append({'id':identifier,'panel':panel,'repeats':[{'repeatIndex':1,'policies':policies}]})
        for name in m.PRIMARY_PAIRS:
            pair=e['summary']['panels'][panel]['comparisons'][name]
            for kind in ('total','incremental'):
                pair['fees'][kind].update({'negativeScenarioIds':[identifier],'negativeEpisodeIds':[identifier+'::repeat-1'],
                    'scenarioWinTieLoss':{'win':0,'tie':0,'loss':1}})
    e['index']['cases']=cases
    return e

class MaterialGates(unittest.TestCase):
    def test_pending_real_data_cannot_generate(self):
        release={'schemaVersion':'portplan-v14-release','formalExperimentComplete':True,'independentReviewComplete':True,'independentBootstrapReviewComplete':True}
        wrapper={'schemaVersion':'portplan-v14-published-results','executionState':'complete','fixture':False,'scenarioCount':144,'episodeCount':3024}
        m.validate_publication_header(release,wrapper)
        for field in ('formalExperimentComplete','independentReviewComplete','independentBootstrapReviewComplete'):
            changed=copy.deepcopy(release);changed[field]=False
            with self.assertRaises(ValueError):m.validate_publication_header(changed,wrapper)
        for change in ({'fixture':True},{'executionState':'running'},{'scenarioCount':143},{'episodeCount':3023}):
            with self.assertRaises(ValueError):m.validate_publication_header(release,{**wrapper,**change})
        with self.assertRaises(ValueError):m.main(['--generate'])

    def test_reviews_bind_exact_index_and_manifest_and_cannot_be_fixtures(self):
        review={'schemaVersion':'portplan-independent-v14-run-review','valid':True,'fixture':False,'readOnly':True,
            'importsJavaScript':False,'solverRuns':0,'inputIndexSha256':'1'*64,'frozenManifestSha256':'2'*64}
        m.validate_review_binding(review,review['schemaVersion'],'1'*64,'2'*64)
        for change in ({'valid':False},{'fixture':True},{'readOnly':False},{'importsJavaScript':True},{'solverRuns':True},
                       {'solverRuns':1},{'inputIndexSha256':'3'*64},{'frozenManifestSha256':'4'*64}):
            with self.assertRaises(ValueError):m.validate_review_binding({**review,**change},review['schemaVersion'],'1'*64,'2'*64)

    def test_natural_d0_and_completion_gate_cannot_be_relabelled(self):
        protocol=json.loads((m.ROOT/'data/protocol-v14.json').read_text())
        index={'rootAuthorized':True,'studyMethod':'guardedHiGHSV13','initialization':protocol['initialization']}
        m.validate_natural_contract(protocol,index)
        for mutation in (lambda p:p['rollout'].update({'startDay':5}),
                         lambda p:p['initialization'].update({'developmentEndpointImport':True}),
                         lambda p:p['analysis']['comparisonGroups'].update({'primary':[]}),
                         lambda p:p['analysis']['defaultGateDefinition'].update({'feeOrRevisionConditionInDefaultGate':True}),
                         lambda p:p['analysis']['bootstrap'].update({'draws':1999}),
                         lambda p:p['callBudgets']['guardedHiGHSV13'].update({'enableDevelopmentEndpointImport':False})):
            changed=copy.deepcopy(protocol);mutation(changed)
            with self.assertRaises(ValueError):m.validate_natural_contract(changed,{**index,'initialization':changed['initialization']})
        with self.assertRaises(ValueError):m.validate_natural_contract(protocol,{**index,'rootAuthorized':False})

    def test_git_blob_inventory_and_material_generator_must_be_frozen(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);frozen=root/'frozen';source=frozen/'source';source.mkdir(parents=True)
            names=['scripts/build-defense-v14.py','scripts/review-v14.py','scripts/review-bootstrap-v14.py','data/protocol-v14.json']
            bindings={};blobs={}
            for name in names:
                raw=Path(m.__file__).read_bytes() if name==names[0] else b'FROZEN METADATA FIXTURE ONLY'
                path=source/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(raw)
                bindings[name]=hashlib.sha256(raw).hexdigest();blobs[name]=hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()
            manifest={'schemaVersion':'portplan-v14-frozen-source','generatedProspectiveInputs':False,'protocolHash':'1'*64,'protocol':{},
                'sourceGitCommit':'2'*40,'sourceGitTree':'3'*40,'sourceCommitVerified':True,'gitObjectFormat':'sha1',
                'committedBlobHashes':blobs,'implementationHashes':bindings}
            index={key:manifest[key] for key in ('protocolHash','protocol','sourceGitCommit','sourceGitTree','gitObjectFormat','committedBlobHashes','implementationHashes')}
            m.validate_frozen_binding(root,index,manifest,frozen,{})
            broken=copy.deepcopy(manifest);broken['sourceCommitVerified']=False
            with self.assertRaises(ValueError):m.validate_frozen_binding(root,index,broken,frozen,{})
            (source/names[1]).write_bytes(b'changed after freeze')
            with self.assertRaises(ValueError):m.validate_frozen_binding(root,index,manifest,frozen,{})

    def test_all_negative_memberships_are_rederived_from_receipts(self):
        e=tiny_adverse()
        self.assertEqual(m.validate_adverse_indices(e['index']['cases'],e['summary']),48)
        pair=e['summary']['panels']['same-distribution']['comparisons']['v13VsV12']
        pair['fees']['total']['negativeEpisodeIds']=[]
        with self.assertRaises(ValueError):m.validate_adverse_indices(e['index']['cases'],e['summary'])
        e=tiny_adverse();pair=e['summary']['panels']['same-distribution']['comparisons']['v13VsV12']
        pair['completion'].update({'lostEpisodeCount':1,'lostEpisodeIds':['invented']})
        with self.assertRaises(ValueError):m.validate_adverse_indices(e['index']['cases'],e['summary'])

    def test_reports_keep_signed_precision_and_every_fee_revision_id(self):
        e=tiny_adverse();pair=e['summary']['panels']['same-distribution']['comparisons']['v13VsV12']
        precise=[-0.02692939798,0.16647561234];pair['fees']['incremental']['uncertainty']['weightedSavingsPct95CI']=precise
        before=copy.deepcopy(e);slides=m.build_slides(e);texts=m.material_texts(e,slides)
        self.assertEqual(e,before);self.assertEqual(len(slides),18)
        self.assertTrue(m.validate_report_coverage(e,texts))
        for key in ('ko','zh'):
            self.assertIn(m.ci(precise),texts[key]);self.assertIn('TEMPLATE-same-distribution::repeat-1',texts[key])
            self.assertIn('revisionWorseEpisodeIds',texts[key]);self.assertIn('secondary',texts[key])
        changed=copy.deepcopy(texts);changed['ko']=changed['ko'].replace('TEMPLATE-same-distribution::repeat-1','DROPPED')
        with self.assertRaises(ValueError):m.validate_report_coverage(e,changed)
        self.assertEqual(m.ci([-1e-12,2e-12]),'[-1e-12, 2e-12]')

    def test_schema_only_does_not_claim_results_or_write(self):
        before={str(p) for p in (m.ROOT/'docs').glob('*v14*')}
        result=subprocess.run([sys.executable,m.__file__,'--schema-only'],check=True,capture_output=True,text=True)
        value=json.loads(result.stdout);self.assertEqual(value['writes'],0);self.assertEqual(value['plannedEpisodes'],3024)
        self.assertEqual(value['candidateMethod'],'guardedHiGHSV13');self.assertNotIn('completeEpisodeCount',value)
        self.assertEqual(before,{str(p) for p in (m.ROOT/'docs').glob('*v14*')})

    def test_editable_eighteen_page_layout_fixture_is_in_memory_only(self):
        e=fixture()
        for panel in m.PANELS:
            for pair in e['summary']['panels'][panel]['comparisons'].values():
                for fee in pair['fees'].values():fee['uncertainty']['weightedSavingsPct95CI']=[-0.01130543734,12.354613757]
        slides=m.build_slides(e)
        for source in slides:
            if source['table'] and '총요금 95% CI' in source['table'][0]:
                self.assertEqual(m.presentation_table(source)[1][0][2],'[-0.0113, 12.3546]')
                self.assertIn('-0.01130543734',source['table'][1][0][2])
        pdf=m.pdf_document(slides);pptx=m.pptx_document(slides);audit=m.audit_rendered(pdf,pptx,slides)
        self.assertTrue(audit['valid']);self.assertEqual(audit['pdfPageCount'],18);self.assertEqual(audit['pptxSlideCount'],18)
        self.assertGreaterEqual(audit['minimumEditableTableFontPt'],12)
        self.assertFalse(audit['entrantUnderstandingCertified'])
        self.assertIn('PORTPLAN V14',m.html_document(slides));self.assertNotIn('PORTPLAN V12',m.html_document(slides))

unittest.main(argv=['materials-v14-fixtures'],verbosity=2)
`;
  const result=spawnSync('python3',['-'],{input:code,encoding:'utf8',maxBuffer:4*1024*1024});
  assert.equal(result.status,0,result.stderr||result.stdout);
});
