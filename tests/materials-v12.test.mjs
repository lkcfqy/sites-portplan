import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

test('V12 materials reject partial/fixture/hash failures and adverse omissions; synthetic layout remains in memory',()=>{
  const modulePath=new URL('../scripts/build-defense-v12.py',import.meta.url).pathname;
  const code=`
import copy,hashlib,importlib.util,json,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('v12_materials',${JSON.stringify(modulePath)})
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

def layout_fixture():
    # TEMPLATE FIXTURE ONLY. Never passed to verified_inputs or written as formal output.
    summary={'panels':{}}
    for panel in m.PANELS:
        methods={key:{'recordedEpisodeCount':216,'completeEpisodeCount':0,'fullyCompletedScenarioCount':0,'executionHistoryUnavailableCount':216,
            'initialization':{'acceptedInitialPlanCount':0,'knownInitialFailureCount':0,'knownLaterFailureCount':0,'unknownDayZeroCount':216}} for key in m.METHODS}
        pairs={}
        for key,(before,after) in m.PAIRS.items():
            fee={'pairedScenarioCount':0,'pairedEpisodeCount':0,'baselineScenarioMeanSumKRW':0,'candidateScenarioMeanSumKRW':0,
                'weightedSavingsPct':None,'worstScenarioLossKRW':0,'baselineEpisodeSumKRW':0,'candidateEpisodeSumKRW':0,
                'scenarioWinTieLoss':{'win':0,'tie':0,'loss':0},'negativeScenarioIds':[],'negativeEpisodeIds':[],
                'uncertainty':{'weightedSavingsPct95CI':None,'meanSavings95CI':None}}
            pairs[key]={'baselineMethod':before,'candidateMethod':after,'fees':{'total':copy.deepcopy(fee),'incremental':copy.deepcopy(fee)},
                'completion':{'gainedEpisodeCount':0,'lostEpisodeCount':0,'gainedEpisodeIds':[],'lostEpisodeIds':[],
                    'uncertainty':{'meanScenarioRateGain95CI':None}},'revisions':{'baselineObservedSum':0,'candidateObservedSum':0,'pairedEpisodeCount':0}}
        common={'jointScenarioCount':0,'jointEpisodeCount':0,'byMethod':{key:{'scenarioMeanTotalCostSumKRW':None,'scenarioMeanIncrementalCostSumKRW':None,'scenarioMeanRevisionCountSum':None} for key in m.METHODS}}
        gates={'completionNonRegressionAllBaselines':False,'defaultRecommendationEligible':False,
            'nativeComparisons':{key:{'stabilityImprovementClaimAllowed':False} for key in ('highsV8','stableHiGHSV10','commitmentHiGHSV11')}}
        summary['panels'][panel]={'scenarioCount':72,'byMethod':methods,'comparisons':pairs,'jointCompletePareto':common,'observedDecisionGates':gates}
    return {'fixture':True,'summary':summary,'protocol':{'algorithmRepeats':[{}, {}, {}],'callBudgets':{'seededHiGHSV12':{'constructorBudgetMs':40}}},
        'index':{'cases':[{'id':'SYNTHETIC-TEMPLATE-'+str(i)} for i in range(144)]},'wrapper':{'episodeCount':2592,'formalIndex':{'sha256':'0'*64}},
        'hashes':{'data/review-v12.json':'1'*64,'data/bootstrap-review-v12.json':'2'*64},'development':None}

class MaterialGuards(unittest.TestCase):
    def test_slide_ci_precision_is_separate_from_unchanged_report_numbers(self):
        e=layout_fixture();pair=e['summary']['panels']['same-distribution']['comparisons']['v12VsV11']
        precise=[-0.02692939798,0.16647561234];pair['fees']['incremental']['uncertainty']['weightedSavingsPct95CI']=precise
        before=copy.deepcopy(e);slides=m.build_slides(e);slide=slides[9]
        self.assertEqual(slide['table'][1][0][4],m.ci(precise))
        self.assertEqual(m.presentation_table(slide)[1][0][4],'[-0.0269, 0.1665]')
        self.assertEqual(e,before);self.assertEqual(slide['table'][1][0][4],m.ci(precise))
        self.assertIn('보고서·JSON',m.presentation_note(slide))
        tiny=copy.deepcopy(slide);tiny['table'][1][0][4]='[-1e-09, 2e-09]'
        self.assertEqual(m.presentation_table(tiny)[1][0][4],'[-1e-09, 2e-09]')
        ko,en,_,zh,_,_=m.material_texts(e,slides)
        for report in (ko,en,zh):self.assertIn(m.ci(precise),report)
        self.assertIn('新增两费节省',zh);self.assertIn('incremental fee savings',en)
        for source in slides:
            if source['table']:self.assertGreaterEqual(m.presentation_table_layout(*source['table'])[0],16)

    def test_corrected_development_wrapper_binds_original_summary_not_itself(self):
        # Real production schemas/field names; tiny local fixture, not formal results.
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder);(root/'data').mkdir();raw_path='artifacts/seeded-v12-d0-first-development/summary.json'
            (root/raw_path).parent.mkdir(parents=True)
            raw={'schemaVersion':'portplan-v12-D0-development-summary-1','developmentOnly':True,
                'newHeldOutExperiments':False,'fullRollingCompletionClaim':False,'endpointCount':15,
                'independentBusinessScenarioCount':5,'timelyCompleteCandidateCount':15}
            (root/raw_path).write_text(json.dumps(raw));raw_hash=m.sha(root/raw_path)
            review={'schemaVersion':'portplan-independent-v12-seed-development-review','valid':True,'readOnly':True,
                'developmentOnly':True,'importsJavaScript':False,'solverRuns':0,'newHeldOutExperiments':False,
                'fullRollingCompletionClaim':False,'inputSummarySha256':raw_hash,
                'summary':{'endpointCount':15,'reusedBusinessScenarioCount':5,'timelyCompleteSeedCount':15}}
            review_path='data/development-seed-review-v12.json';(root/review_path).write_text(json.dumps(review))
            public_path='data/seeded-initial-development-v12.json'
            published={'schemaVersion':'portplan-seeded-initial-development-v12','valid':True,
                'dataRole':'predeclared-seen-V10-subset','newHeldOutExperiments':0,'endpoints':15,
                'independentBusinessScenarios':5,'timelyCompleteConstructedSeeds':15,
                'originalSummary':{'path':raw_path,'sha256':raw_hash},
                'independentReview':{'path':review_path,'sha256':m.sha(root/review_path)}}
            (root/public_path).write_text(json.dumps(published))
            self.assertNotEqual(m.sha(root/public_path),raw_hash)
            hashes={};self.assertEqual(m.verified_seed_development(root,hashes),review)
            self.assertEqual(hashes[raw_path],raw_hash);self.assertIn(public_path,hashes)
            for mutate in (lambda x:x['originalSummary'].update({'sha256':'0'*64}),
                           lambda x:x['originalSummary'].update({'path':public_path}),
                           lambda x:x['independentReview'].update({'sha256':'0'*64}),
                           lambda x:x.update({'endpoints':14})):
                changed=copy.deepcopy(published);mutate(changed);(root/public_path).write_text(json.dumps(changed))
                with self.assertRaises(ValueError):m.verified_seed_development(root,{})
            (root/public_path).write_text(json.dumps(published));(root/raw_path).write_text(json.dumps(raw)+' ')
            with self.assertRaises(ValueError):m.verified_seed_development(root,{})
            # A ZIP restore does not include root artifacts/. Use the exact archived original.
            raw_bytes=json.dumps(raw).encode();(root/raw_path).unlink()
            with self.assertRaisesRegex(ValueError,'restore-evidence-v12.py'):m.verified_seed_development(root,{})
            restored_path='data/evidence-v12/v12-seed-development/'+raw_path
            (root/restored_path).parent.mkdir(parents=True);(root/restored_path).write_bytes(raw_bytes)
            archive_dir=root/'data/archives-v12/seed-development';archive_dir.mkdir(parents=True)
            chunk=b'DEVELOPMENT ARCHIVE TRANSPORT FIXTURE ONLY';chunk_hash=hashlib.sha256(chunk).hexdigest()
            (archive_dir/'part-0001.bin').write_bytes(chunk)
            manifest={'schemaVersion':'portplan-v12-lossless-tar-chunks','kind':'development','archiveFormat':'tar.xz',
                'compression':'xz-lzma2-preset6','archiveRoot':'v12-seed-development','entrypoint':public_path,
                'entrypointSha256':m.sha(root/public_path),'fileCount':3,'files':[
                    {'path':raw_path,'bytes':len(raw_bytes),'sha256':raw_hash},
                    {'path':review_path,'bytes':(root/review_path).stat().st_size,'sha256':m.sha(root/review_path)},
                    {'path':public_path,'bytes':(root/public_path).stat().st_size,'sha256':m.sha(root/public_path)}],
                'chunks':[{'file':'part-0001.bin','bytes':len(chunk),'sha256':chunk_hash}],
                'archiveBytes':len(chunk),'archiveSha256':chunk_hash}
            manifest_path=archive_dir/'manifest.json';manifest_path.write_text(json.dumps(manifest))
            self.assertEqual(m.verified_seed_development(root,{}),review)
            for mutate in (lambda x:x['files'][0].update({'sha256':'0'*64}),
                           lambda x:x.update({'entrypointSha256':'0'*64}),
                           lambda x:x.update({'archiveSha256':'0'*64})):
                broken=copy.deepcopy(manifest);mutate(broken);manifest_path.write_text(json.dumps(broken))
                with self.assertRaises(ValueError):m.verified_seed_development(root,{})
            manifest_path.write_text(json.dumps(manifest));(root/restored_path).write_bytes(raw_bytes+b' ')
            with self.assertRaises(ValueError):m.verified_seed_development(root,{})

    def test_receipt_alone_does_not_pass_parent_lifecycle(self):
        result={key:True for key in ('endToEndCompletedWithinBudget','episodeCompletedWithinBudget','terminalReceiptAcceptedAsHistory','normalWorkerExit')}
        result.update({'exitCode':0,'exitSignal':None,'deadlineReached':False,'processGroupCleanup':{'successful':True,'verifiedProcessGroupGone':True,'verificationResult':'ESRCH','verificationError':None}})
        for field in ('wallTimeMs','endToEndWallTimeMs','processExitWallTimeMs','processCloseWallTimeMs','cleanupFinishedMs','receiptValidatedMs'):result[field]=40
        m.validate_parent_lifecycle(result)
        for mutate in (lambda x:x.update({'normalWorkerExit':False}),lambda x:x.update({'cleanupFinishedMs':5001}),lambda x:x['processGroupCleanup'].update({'verifiedProcessGroupGone':False})):
            broken=copy.deepcopy(result);mutate(broken)
            with self.assertRaises(ValueError):m.validate_parent_lifecycle(broken)

    def test_incomplete_fixture_and_bad_hash(self):
        for condition in ('partial','fixture','hash'):
            with self.subTest(condition=condition),tempfile.TemporaryDirectory() as folder:
                root=Path(folder);(root/'data').mkdir()
                release={key:True for key in ('formalExperimentComplete','independentReviewComplete','independentBootstrapReviewComplete')}
                if condition=='partial':release['formalExperimentComplete']=False
                (root/'data/v12-release.json').write_text(json.dumps(release))
                (root/'data/formal.json').write_text('{}')
                wrapper={'schemaVersion':'portplan-v12-published-results','executionState':'complete','fixture':condition=='fixture',
                    'formalIndex':{'path':'data/formal.json','sha256':'0'*64}}
                (root/'data/v12-results.json').write_text(json.dumps(wrapper))
                with self.assertRaises(ValueError):m.verified_inputs(root)
                self.assertFalse((root/'docs').exists())

    def test_all_adverse_identifiers_derived_from_receipts(self):
        e=layout_fixture();cases=[]
        for panel in m.PANELS:
            units=[]
            for n in (1,2):
                policies={key:{'complete':True,'totalCost':100,'incrementalCost':100} for key in m.METHODS}
                policies['seededHiGHSV12']={'complete':n==1,'totalCost':120 if n==1 else None,'incrementalCost':120 if n==1 else None}
                units.append({'repeatIndex':n,'policies':policies})
            case={'id':'SYNTHETIC-'+panel,'panel':panel,'repeats':units};cases.append(case)
            for key,pair in e['summary']['panels'][panel]['comparisons'].items():
                if pair['candidateMethod']=='seededHiGHSV12':
                    pair['completion'].update({'lostEpisodeCount':1,'lostEpisodeIds':[case['id']+'::repeat-2']})
                    for fee in pair['fees'].values():fee.update({'negativeScenarioIds':[case['id']],'negativeEpisodeIds':[case['id']+'::repeat-1'],'scenarioWinTieLoss':{'win':0,'tie':0,'loss':1}})
        self.assertGreater(m.validate_adverse_indices(cases,e['summary']),0)
        for mutate in (lambda x:x['panels']['stress']['comparisons']['v12VsV7']['fees']['total'].update({'negativeEpisodeIds':[]}),
                       lambda x:x['panels']['same-distribution']['comparisons']['v12VsV11']['completion'].update({'lostEpisodeIds':[]})):
            broken=copy.deepcopy(e['summary']);mutate(broken)
            with self.assertRaises(ValueError):m.validate_adverse_indices(cases,broken)
        ko,en,contribution,zh,optional,entrant=m.material_texts(e,m.build_slides(e));m.validate_report_coverage(e,ko,zh)
        with self.assertRaises(ValueError):m.validate_report_coverage(e,ko.replace('SYNTHETIC-stress','removed'),zh)

    def test_in_memory_native_pdf_ppt_and_overflow(self):
        for name in ('fitz','pptx','reportlab','fontTools'):
            if importlib.util.find_spec(name) is None:self.skipTest('Optional material dependency missing: '+name)
        if not Path('/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc').is_file():self.skipTest('Optional Noto CJK system font missing')
        e=layout_fixture();slides=m.build_slides(e);self.assertLessEqual(len(slides),20)
        pdf=m.pdf_document(slides);pptx=m.pptx_document(slides);review=m.audit_rendered(pdf,pptx,slides)
        self.assertTrue(review['valid']);self.assertEqual(review['pdfPageCount'],18);self.assertEqual(review['pptxSlideCount'],18)
        self.assertGreater(review['editableTextShapes'],0);self.assertGreaterEqual(review['minimumEditableTableFontPt'],12)
        huge=copy.deepcopy(slides);huge[0]['table']=(['A','B'],[['overflow '*500,'x'] for _ in range(30)]);huge[0]['flow']=None
        with self.assertRaises(ValueError):m.pdf_document(huge)
        with self.assertRaises(ValueError):m.pptx_document(huge)

unittest.main(verbosity=2)
`;
  const result=spawnSync('python',['-c',code],{encoding:'utf8',maxBuffer:4*1024*1024,timeout:60000});
  assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
});
