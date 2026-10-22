import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {METHODS_V14,EVIDENCE_PATHS_V14,CANDIDATE_PAIRS_V14,validateResearchV14Evidence,readBoundResearchV14,mountResearchV14UI} from '../src/research-v14-ui.js';

// Schema fixtures only: no data/ files, public results or experiment outputs are written.
const secondary={v12VsV11:['commitmentHiGHSV11','seededHiGHSV12'],v12VsV10:['stableHiGHSV10','seededHiGHSV12'],v12VsV9:['adaptiveV9','seededHiGHSV12'],v12VsHiGHS:['highsV8','seededHiGHSV12'],v12VsV7:['costPolishV7','seededHiGHSV12'],v11VsV10:['stableHiGHSV10','commitmentHiGHSV11'],v10VsHiGHS:['highsV8','stableHiGHSV10'],highsVsV7:['costPolishV7','highsV8']};
function shape(){
  const protocol={schemaVersion:'portplan-protocol-v14',methods:[...METHODS_V14],rollout:{startDay:0,initialization:'natural',forcedEndpointImports:false,freshBusinessScenarios:144},budget:{hardWallMs:5000,parentAcceptance:{normalWorkerExitRequired:true,confirmedProcessGroupGoneRequired:true,processGroupVerificationResult:'ESRCH',cleanupWithinHardWallRequired:true,endToEndWithinHardWallRequired:true,timelyFinalAloneIsCompletion:false}},callBudgets:Object.fromEntries(METHODS_V14.map(key=>[key,{timeBudgetMs:200}])),analysis:{candidateMethod:'guardedHiGHSV13',comparisons:{...Object.fromEntries(Object.entries(CANDIDATE_PAIRS_V14).map(([key,baseline])=>[key,[baseline,'guardedHiGHSV13']])),...secondary},comparisonGroups:{primary:Object.keys(CANDIDATE_PAIRS_V14),secondary:Object.keys(secondary)},defaultGateDefinition:{candidateMethod:'guardedHiGHSV13',completePanelRequired:true,scenariosPerPanel:72,repeatsPerScenario:3,allMethodsPerRepeatRequired:true,comparators:METHODS_V14.slice(0,6),maximumMatchingRepeatCompletionLossesPerComparator:0,allowNetGainsToOffsetLosses:false,feeOrRevisionConditionInDefaultGate:false}}};
  const result={schemaVersion:'portplan-v14-published-results',executionState:'complete',fixture:false,scenarioCount:144,episodeCount:3024,formalIndex:{sha256:'1'.repeat(64)},protocol,summary:{inferentialState:'complete-scenario-cluster-bootstrap',panels:{}}};
  const review={schemaVersion:'portplan-independent-v14-run-review',valid:true,fixture:false,readOnly:true,importsJavaScript:false,solverRuns:0,inputIndexSha256:'1'.repeat(64),frozenManifestSha256:'2'.repeat(64),protocolSha256:'3'.repeat(64),summary:{episodes:3024},pointEstimates:{}};
  const stats={schemaVersion:'portplan-independent-v14-bootstrap-review',valid:true,fixture:false,readOnly:true,importsJavaScript:false,solverRuns:0,inputIndexSha256:'1'.repeat(64),frozenManifestSha256:'2'.repeat(64),protocolSha256:'3'.repeat(64),episodeCount:3024,businessScenarioCount:144,panels:{}};
  const release={schemaVersion:'portplan-v14-release',candidateMethod:'guardedHiGHSV13',formalExperimentComplete:true,independentReviewComplete:true,independentBootstrapReviewComplete:true,evidence:{protocol:{path:EVIDENCE_PATHS_V14.protocol,sha256:'3'.repeat(64)}}};
  for(const panel of ['same-distribution','stress']){
    const p={scenarioCount:72,byMethod:{},comparisons:{}},r={byMethod:{},comparisons:{}},s={byMethod:{},comparisons:{}};
    for(const method of METHODS_V14){const item={recordedEpisodeCount:216,completeEpisodeCount:0,fullyCompletedScenarioCount:0,anyCompletedScenarioCount:0,initialization:{knownDayZeroCount:0,acceptedInitialPlanCount:0,knownInitialFailureCount:0,knownLaterFailureCount:0,unknownDayZeroCount:216}};p.byMethod[method]=item;r.byMethod[method]=structuredClone(item);s.byMethod[method]=structuredClone(item);}
    for(const [name,[baseline,candidate]]of Object.entries(protocol.analysis.comparisons)){
      const pair={baselineMethod:baseline,candidateMethod:candidate,completion:{gainedEpisodeCount:0,lostEpisodeCount:0,gainedEpisodeIds:[],lostEpisodeIds:[],uncertainty:{meanScenarioRateGain95CI:null}},revisions:{pairedEpisodeCount:0,baselineObservedSum:null,candidateObservedSum:null},fees:{}};
      const physical={gainedEpisodes:0,lostEpisodes:0,revisions:[null,null],fees:{}},statistical={completionRateGain95CI:null,fees:{}};
      for(const key of ['total','incremental']){
        const wins={win:0,tie:0,loss:0};pair.fees[key]={pairedScenarioCount:0,pairedEpisodeCount:0,baselineScenarioMeanSumKRW:0,candidateScenarioMeanSumKRW:0,weightedSavingsPct:null,scenarioWinTieLoss:wins,negativeScenarioIds:[],negativeEpisodeIds:[],uncertainty:{weightedSavingsPct95CI:null}};
        physical.fees[key]={pairedScenarios:0,pairedEpisodes:0,baselineScenarioMeanSumKRW:0,candidateScenarioMeanSumKRW:0,scenarioWinTieLoss:structuredClone(wins)};
        statistical.fees[key]={pairedScenarioCount:0,pairedEpisodeCount:0,weightedSavingsPct95CI:null};
      }
      p.comparisons[name]=pair;r.comparisons[name]=physical;s.comparisons[name]=statistical;
    }
    p.comparisons.v13VsV12.completion.lostEpisodeCount=1;p.comparisons.v13VsV12.completion.lostEpisodeIds=['SYNTHETIC-LOSS::repeat-1'];r.comparisons.v13VsV12.lostEpisodes=1;
    p.observedDecisionGates={assessmentState:'complete-panel',defaultRecommendationEligible:false};s.observedDecisionGates=structuredClone(p.observedDecisionGates);
    p.jointCompletePareto={jointScenarioCount:0,jointEpisodeCount:0,byMethod:Object.fromEntries(METHODS_V14.map(key=>[key,{scenarioMeanTotalCostSumKRW:null,scenarioMeanIncrementalCostSumKRW:null,scenarioMeanRevisionCountSum:null}]))};s.jointCompletePareto=structuredClone(p.jointCompletePareto);
    result.summary.panels[panel]=p;review.pointEstimates[panel]=r;stats.panels[panel]=s;
  }
  return {result,review,stats,protocol,release};
}
const validate=e=>validateResearchV14Evidence(e.result,e.review,e.stats,e.protocol,e.release);
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
const hash=value=>createHash('sha256').update(value).digest('hex');

test('V14 rejects partial/fixture/forced-import/method/count/denominator/CI and gate claims; a failed gate remains displayable',()=>{
  assert.equal(validate(shape()),true);
  const zeroLoss=shape();for(const panel of ['same-distribution','stress']){const p=zeroLoss.result.summary.panels[panel];p.comparisons.v13VsV12.completion.lostEpisodeCount=0;p.comparisons.v13VsV12.completion.lostEpisodeIds=[];zeroLoss.review.pointEstimates[panel].comparisons.v13VsV12.lostEpisodes=0;p.observedDecisionGates.defaultRecommendationEligible=true;zeroLoss.stats.panels[panel].observedDecisionGates.defaultRecommendationEligible=true;}assert.equal(validate(zeroLoss),true);
  zeroLoss.result.summary.panels.stress.observedDecisionGates.defaultRecommendationEligible=false;zeroLoss.stats.panels.stress.observedDecisionGates.defaultRecommendationEligible=false;assert.throws(()=>validate(zeroLoss),/零完成损失/);
  const changes=[
    e=>e.release.independentReviewComplete=false,e=>e.result.fixture=true,e=>e.stats.fixture=true,
    e=>e.result.episodeCount=2592,e=>e.protocol.rollout.forcedEndpointImports=true,
    e=>e.protocol.rollout.startDay=5,e=>e.protocol.methods[6]='newV14Policy',e=>e.protocol.analysis.defaultGateDefinition.feeOrRevisionConditionInDefaultGate=true,e=>delete e.protocol.analysis.comparisons.v12VsV7,
    e=>e.review.inputIndexSha256='4'.repeat(64),e=>e.stats.frozenManifestSha256='5'.repeat(64),e=>e.review.protocolSha256='6'.repeat(64),
    e=>delete e.result.summary.panels.stress.byMethod.guardedHiGHSV13,
    e=>e.result.summary.panels.stress.comparisons.v13VsV12.fees.total.pairedEpisodeCount=1,
    e=>e.result.summary.panels.stress.comparisons.v13VsV12.revisions.pairedEpisodeCount=1,
    e=>e.result.summary.panels.stress.comparisons.v13VsV10.fees.incremental.negativeEpisodeIds=null,
    e=>e.result.summary.panels.stress.comparisons.v13VsHiGHS.fees.total.weightedSavingsPct=0,
    e=>e.result.summary.panels.stress.comparisons.v13VsV7.fees.total.uncertainty.weightedSavingsPct95CI=[-1,1],
    e=>{const p=e.result.summary.panels.stress,q=p.comparisons.v13VsV12;p.observedDecisionGates.defaultRecommendationEligible=true;e.stats.panels.stress.observedDecisionGates.defaultRecommendationEligible=true;q.completion.lostEpisodeCount=1;q.completion.lostEpisodeIds=['SYNTHETIC-LOSS::repeat-1'];e.review.pointEstimates.stress.comparisons.v13VsV12.lostEpisodes=1;},
  ];
  for(const change of changes){const e=shape();change(e);assert.throws(()=>validate(e));}
});

test('only four prescribed paths are fetched and every original-byte SHA is checked, including harmless whitespace changes',async()=>{
  const body=bytes({testOnly:true}),ref={path:EVIDENCE_PATHS_V14.results,sha256:hash(body)},request=async()=>({ok:true,arrayBuffer:async()=>body.buffer});
  assert.deepEqual(await readBoundResearchV14('results',ref,{request,crypto:webcrypto}),{testOnly:true});
  for(const path of ['https://example.com/result.json','/data/v12-results.json','/data/../v14-results.json'])await assert.rejects(readBoundResearchV14('results',{...ref,path},{request:()=>assert.fail('unsafe path fetched'),crypto:webcrypto}));
  await assert.rejects(readBoundResearchV14('results',{...ref,sha256:'0'.repeat(64)},{request,crypto:webcrypto}),/SHA/);
  await assert.rejects(readBoundResearchV14('results',ref,{request:async()=>({ok:true,arrayBuffer:async()=>new TextEncoder().encode(JSON.stringify({testOnly:true})+' ').buffer}),crypto:webcrypto}),/SHA/);
});

class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.listeners={};this.textContent='';}
  append(...values){this.children.push(...values);}replaceChildren(...values){this.children=[...values];}addEventListener(key,callback){this.listeners[key]=callback;}
  all(){return [this,...this.children.flatMap(child=>child.all())];}
}

test('pending never fetches partial scores; ready SHA-bound failed-gate evidence displays actual nulls and all adverse details',async()=>{
  // DOM wiring fixture, not actual browser acceptance or a published experiment.
  const original=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
  try{
    const e=shape(),bodies={},requests=[];
    for(const [role,value]of Object.entries({results:e.result,review:e.review,statistics:e.stats,protocol:e.protocol})){bodies[EVIDENCE_PATHS_V14[role]]=bytes(value);}
    const protocolHash=hash(bodies[EVIDENCE_PATHS_V14.protocol]);e.review.protocolSha256=protocolHash;e.stats.protocolSha256=protocolHash;
    bodies[EVIDENCE_PATHS_V14.review]=bytes(e.review);bodies[EVIDENCE_PATHS_V14.statistics]=bytes(e.stats);
    e.release.evidence=Object.fromEntries(Object.entries(EVIDENCE_PATHS_V14).map(([role,path])=>[role,{path,sha256:hash(bodies[path])}]));
    let complete=false;
    const request=async path=>{requests.push(path);return path==='/data/v14-release.json'?{ok:true,json:async()=>({...e.release,formalExperimentComplete:complete})}:{ok:true,arrayBuffer:async()=>bodies[path].buffer};};
    const container=new Element('section'),mounted=mountResearchV14UI(container,{request,crypto:webcrypto});await mounted.ready;
    assert.deepEqual(requests,['/data/v14-release.json']);assert.ok(container.all().some(node=>node.dataset.v14Pending));assert.equal(container.all().some(node=>node.dataset.v14Ready),false);
    complete=true;await mounted.refresh();assert.equal(container.all().filter(node=>node.dataset.v14Ready).length,1);assert.equal(container.all().filter(node=>node.dataset.v14Gate==='failed').length,2);
    assert.equal(container.all().filter(node=>node.dataset.v14Adverse).length,2);assert.match(container.all().map(node=>node.textContent).join(' '),/默认替换必要门槛：未通过/);
    bodies[EVIDENCE_PATHS_V14.review]=new TextEncoder().encode('{}');await mounted.refresh();assert.equal(container.all().some(node=>node.dataset.v14Ready),false);assert.ok(container.all().some(node=>node.dataset.v14Pending));
    mounted.destroy();assert.equal(container.children.length,0);
  }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});
