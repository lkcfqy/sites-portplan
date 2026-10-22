import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {METHODS_V15,EVIDENCE_PATHS_V15,validateResearchV15Evidence,readBoundResearchV15,mountResearchV15UI} from '../src/research-v15-ui.js';

const rawProtocol=await readFile(new URL('../data/protocol-development-v15.json',import.meta.url));
const hash=value=>createHash('sha256').update(value).digest('hex');
const bytes=value=>new TextEncoder().encode(JSON.stringify(value));
const scope='Descriptive cold-cache seen-endpoint continuation only; 36 branches are not 36 business samples. Terminal fee/revision comparisons require matching joint completion. No natural D0, holdout, research-CI or default-policy claim.';
function fixture(){
  const protocol=JSON.parse(rawProtocol),protocolSha256=hash(rawProtocol),sourceCommit='a'.repeat(40),declarationSha256='b'.repeat(64);
  const records=protocol.jobs.map((job,index)=>{
    // This is a handwritten UI fixture, never research results or timings.
    const complete=(job.caseId.endsWith('n100-r4')&&job.method!=='guardedHiGHSV13')||(job.caseId.endsWith('n50-r1')&&job.repeatIndex===1&&job.method==='seededHiGHSV12');
    const artifact={path:'episodes/fixture-'+index+'.json',bytes:17,sha256:(index+1).toString(16).padStart(64,'0')};
    const receipt={policy:job.method,status:complete?'feasible':'no_feasible_schedule_found',complete,auditValid:complete,executionHistoryUnavailable:false,
      scalarReceipt:true,terminalRowCount:complete?50:0,artifact,revisionCount:complete?3:null,failure:complete?null:{day:job.interventionDay},
      totalCost:complete?(job.method==='timelyHiGHSV15'?120:100):null,incrementalCost:complete?40:null,storageCost:complete?50:null,ddCost:complete?50:null,sunkCost:complete?60:null,objectiveCost:complete?40:null,lateCount:complete?0:null,
      terminalReceiptAcceptedAsHistory:true,endToEndCompletedWithinBudget:true,episodeCompletedWithinBudget:true,outputDeliveredWithinBudget:true,terminalReceiptWithinBudget:true,normalWorkerExit:true,
      deadlineReached:false,exitCode:0,exitSignal:null,hardWallMs:5000,wallTimeMs:1000,endToEndWallTimeMs:1000,receiptValidatedMs:999,
      processGroupCleanup:{successful:true,verifiedProcessGroupGone:true,verificationResult:'ESRCH',finishedAtMs:998}};
    return {...job,artifact,receipt};
  });
  const byMethod=Object.fromEntries(METHODS_V15.map(method=>{const rows=records.filter(row=>row.method===method);return [method,{runCount:12,completeWithinBudgetCount:rows.filter(row=>row.receipt.complete).length,unknownHistoryCount:0,outcomes:rows.map(row=>({jobId:row.jobId,endpointId:row.endpointId,caseId:row.caseId,repeatIndex:row.repeatIndex,interventionDay:row.interventionDay,status:row.receipt.status,complete:row.receipt.complete,failureDay:row.receipt.failure?.day??null,totalCost:row.receipt.totalCost,incrementalCost:row.receipt.incrementalCost,revisionCount:row.receipt.revisionCount}))}];}));
  const comparisons=METHODS_V15.slice(0,2).map(baselineMethod=>{const pairs=protocol.endpoints.map(endpoint=>{const b=records.find(row=>row.endpointId===endpoint.endpointId&&row.method===baselineMethod).receipt,a=records.find(row=>row.endpointId===endpoint.endpointId&&row.method==='timelyHiGHSV15').receipt,joint=b.complete&&a.complete;return {endpointId:endpoint.endpointId,caseId:endpoint.caseId,repeatIndex:endpoint.repeatIndex,baselineComplete:b.complete,candidateComplete:a.complete,jointlyCompleted:joint,totalBaselineMinusCandidateKRW:joint?b.totalCost-a.totalCost:null,incrementalBaselineMinusCandidateKRW:joint?b.incrementalCost-a.incrementalCost:null,revisionBaselineMinusCandidate:joint?b.revisionCount-a.revisionCount:null};});return {baselineMethod,candidateMethod:'timelyHiGHSV15',endpointPairCount:12,jointlyCompletedEndpointPairCount:pairs.filter(row=>row.jointlyCompleted).length,gained:pairs.filter(row=>!row.baselineComplete&&row.candidateComplete).length,lost:pairs.filter(row=>row.baselineComplete&&!row.candidateComplete).length,pairs};});
  const summary={runCount:36,uniqueBusinessScenarioCount:4,archivedEndpointCount:12,byMethod,comparisons,ciComputed:false,newHeldOutExperiments:0,historicalCacheImported:false,scope};
  const implementationSha256='d'.repeat(64);
  const result={schemaVersion:'portplan-v15-cold-cache-delivery-results',executionState:'complete',sourceCommit,declarationSha256,protocolSha256,sourceBindings:protocol.sourceBindings,implementationHashes:{'data/protocol-development-v15.json':protocolSha256,'scripts/review-delivery-v15.py':implementationSha256},sourceConsistency:{before:true,after:true},newHeldOutExperiments:0,newGeneratedSeeds:0,ciComputed:false,historicalCacheImported:false,records,summary};
  const review={schemaVersion:'portplan-independent-delivery-review-v15',valid:true,readOnly:true,solverRuns:0,importsJavaScript:false,inputIndexSha256:'c'.repeat(64),implementationSha256,sourceCommit,declarationSha256,protocolSha256,coverage:{episodes:36,completeEpisodes:records.filter(row=>row.receipt.complete).length,historyUnavailable:0},summary:structuredClone(summary),episodes:records.map(row=>({jobId:row.jobId,artifactSha256:row.artifact.sha256,complete:row.receipt.complete,historyAvailable:true}))};
  const release={schemaVersion:'portplan-v15-development-release',candidateMethod:'timelyHiGHSV15',developmentExperimentComplete:true,independentReviewComplete:true,fullChampionshipPlanComplete:false,defaultRecommendationEligible:false,formalExperiment:false,latestFormalStudy:'v14',evidence:{results:{path:EVIDENCE_PATHS_V15.results,sha256:review.inputIndexSha256},protocol:{path:EVIDENCE_PATHS_V15.protocol,sha256:protocolSha256}}};
  return {result,review,protocol,release};
}
const validate=e=>validateResearchV15Evidence(e.result,e.review,e.protocol,e.release);
test('all 36 branches and 24 endpoint pairs remain displayable including completion losses, negative fees and nulls',()=>{
  const e=fixture();assert.equal(validate(e),true);assert.equal(e.result.summary.byMethod.timelyHiGHSV15.completeWithinBudgetCount,3);
  assert.equal(e.result.summary.comparisons[0].lost,1);assert.equal(e.result.summary.comparisons[0].pairs.some(row=>row.totalBaselineMinusCandidateKRW<0),true);
  assert.equal(e.result.summary.comparisons[1].jointlyCompletedEndpointPairCount,0);assert.equal(e.result.summary.comparisons[1].pairs.every(row=>row.totalBaselineMinusCandidateKRW===null),true);
});
test('fails closed for forged completeness, selected prefixes, altered budgets, scope, independent bindings or omitted adverse pairs',()=>{
  const changes=[
    e=>e.release.formalExperiment=true,e=>e.release.fullChampionshipPlanComplete=true,e=>e.release.defaultRecommendationEligible=true,e=>e.release.latestFormalStudy='v15',e=>e.release.independentReviewComplete=false,
    e=>e.result.fixture=true,e=>e.review.fixture=true,e=>e.review.solverRuns=1,e=>e.review.importsJavaScript=true,e=>e.review.inputIndexSha256='d'.repeat(64),e=>e.review.sourceCommit='d'.repeat(40),e=>e.review.declarationSha256='d'.repeat(64),e=>e.review.protocolSha256='d'.repeat(64),e=>delete e.review.implementationSha256,e=>e.review.implementationSha256='e'.repeat(64),e=>delete e.result.implementationHashes['scripts/review-delivery-v15.py'],
    e=>e.protocol.caseDays.pop(),e=>e.protocol.endpoints.pop(),e=>e.protocol.endpoints[0].algorithmSeed++,e=>e.protocol.budget.dailyBudgetMs=210,e=>e.protocol.callBudgets.timelyHiGHSV15.nativeReturnReserveMs=11,e=>e.protocol.candidateChange.nativeTargetMs=200,e=>e.result.newGeneratedSeeds=1,e=>e.result.ciComputed=true,e=>e.result.historicalCacheImported=true,e=>e.result.sourceConsistency.after=false,
    e=>e.result.records.pop(),e=>e.review.episodes.pop(),e=>e.result.records[0].method='timelyHiGHSV15',e=>e.result.records[0].receipt.totalCost=0,e=>e.result.records[0].receipt.incrementalCost=0,e=>e.result.records[0].receipt.complete=true,
    e=>e.result.records.find(row=>row.receipt.complete).receipt.processGroupCleanup.verifiedProcessGroupGone=false,e=>e.result.records.find(row=>row.receipt.complete).receipt.endToEndWallTimeMs=5001,e=>e.result.records.find(row=>row.receipt.complete).receipt.normalWorkerExit=false,
    e=>e.result.summary.comparisons[0].pairs.pop(),e=>{for(const s of [e.result.summary,e.review.summary])s.comparisons[0].lost=0;},e=>{for(const s of [e.result.summary,e.review.summary])s.comparisons[0].pairs.find(row=>row.totalBaselineMinusCandidateKRW<0).totalBaselineMinusCandidateKRW=0;},
    e=>{for(const s of [e.result.summary,e.review.summary])s.byMethod.timelyHiGHSV15.completeWithinBudgetCount=12;},
  ];
  for(const change of changes){const e=fixture();change(e);assert.throws(()=>validate(e));}
});
test('only prescribed same-origin evidence paths and exact original bytes are accepted',async()=>{
  const body=bytes({testFixtureOnly:true}),reference={path:EVIDENCE_PATHS_V15.results,bytes:body.byteLength,sha256:hash(body)},request=async()=>({ok:true,arrayBuffer:async()=>body.buffer});
  assert.deepEqual(await readBoundResearchV15('results',reference,{request,crypto:webcrypto}),{testFixtureOnly:true});
  for(const path of ['https://example.com/a.json','/data/delivery-v15-first-index.json?x=1','/data/../delivery-v15-first-index.json','/data/v14-results.json'])await assert.rejects(readBoundResearchV15('results',{...reference,path},{request:()=>assert.fail('unsafe path requested'),crypto:webcrypto}));
  await assert.rejects(readBoundResearchV15('results',{...reference,sha256:'0'.repeat(64)},{request,crypto:webcrypto}),/SHA/);
  await assert.rejects(readBoundResearchV15('results',{...reference,bytes:body.byteLength+1},{request,crypto:webcrypto}),/字节/);
  const altered=new TextEncoder().encode('{"testFixtureOnly":true }');await assert.rejects(readBoundResearchV15('results',{...reference,bytes:altered.byteLength},{request:async()=>({ok:true,arrayBuffer:async()=>altered.buffer}),crypto:webcrypto}),/SHA/);
});
test('published original V15 first-run bytes and pure Python review pass the same browser-facing checks without native calls',async()=>{
  const release=JSON.parse(await readFile(new URL('../data/v15-development-release.json',import.meta.url)));
  const request=async path=>{assert.ok(Object.values(EVIDENCE_PATHS_V15).includes(path));const body=await readFile(new URL('..'+path,import.meta.url));return {ok:true,arrayBuffer:async()=>body.buffer.slice(body.byteOffset,body.byteOffset+body.byteLength)};};
  const [result,review,protocol]=await Promise.all(Object.keys(EVIDENCE_PATHS_V15).map(role=>readBoundResearchV15(role,release.evidence[role],{request,crypto:webcrypto})));
  assert.equal(release.evidence.results.sha256,'b996dcf846c0e00ba3f89da453176af8f4a4302061e8dd2f27b7d4966196eaee');
  assert.equal(release.evidence.review.sha256,'588c5e5f9beb549765a746a311a70d5fc22d23d4947cbd45ab349900b0985cf5');
  assert.equal(validateResearchV15Evidence(result,review,protocol,release),true);
  assert.deepEqual(METHODS_V15.map(method=>result.summary.byMethod[method].completeWithinBudgetCount),[5,5,5]);
  assert.deepEqual(result.summary.comparisons.map(pair=>[pair.gained,pair.lost,pair.jointlyCompletedEndpointPairCount]),[[0,0,5],[0,0,5]]);
  assert.equal(result.records.filter(row=>!row.receipt.complete).length,21);
  assert.ok(result.records.filter(row=>!row.receipt.complete).every(row=>row.receipt.totalCost===null&&row.receipt.incrementalCost===null));
  assert.equal(review.solverRuns,0);assert.equal(review.importsJavaScript,false);
});
class Element{
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.style={};this.listeners={};this.textContent='';}
  append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}addEventListener(key,fn){this.listeners[key]=fn;}all(){return [this,...this.children.flatMap(child=>child.all())];}
}
test('pending fetches no partial scores; complete evidence displays all failures and detects subsequent byte tampering',async()=>{
  const original=globalThis.document;globalThis.document={createElement:tag=>new Element(tag)};
  try{
    const e=fixture(),bodies={},requests=[];bodies[EVIDENCE_PATHS_V15.protocol]=rawProtocol;
    bodies[EVIDENCE_PATHS_V15.results]=bytes(e.result);e.review.inputIndexSha256=hash(bodies[EVIDENCE_PATHS_V15.results]);bodies[EVIDENCE_PATHS_V15.review]=bytes(e.review);
    e.release.evidence=Object.fromEntries(Object.entries(EVIDENCE_PATHS_V15).map(([role,path])=>[role,{path,bytes:bodies[path].byteLength,sha256:hash(bodies[path])}]));
    let complete=false;const request=async path=>{requests.push(path);return path==='/data/v15-development-release.json'?{ok:true,json:async()=>({...e.release,developmentExperimentComplete:complete})}:{ok:true,arrayBuffer:async()=>bodies[path].buffer.slice(bodies[path].byteOffset,bodies[path].byteOffset+bodies[path].byteLength)};};
    const container=new Element('section'),mounted=mountResearchV15UI(container,{request,crypto:webcrypto});await mounted.ready;
    assert.deepEqual(requests,['/data/v15-development-release.json']);assert.ok(container.all().some(node=>node.dataset.v15Pending));assert.equal(container.all().some(node=>node.dataset.v15Ready),false);
    complete=true;await mounted.refresh();assert.equal(container.all().filter(node=>node.dataset.v15Ready).length,1);assert.equal(container.all().filter(node=>node.dataset.v15Adverse).length,1);
    const text=container.all().map(node=>node.textContent).join(' ');assert.match(text,/失败 D6/);assert.match(text,/总两费 null/);assert.match(text,/"lost": 1/);assert.match(text,/"totalBaselineMinusCandidateKRW": -20/);assert.match(text,/"jointlyCompletedEndpointPairCount": 0/);assert.match(text,/完整冲冠计划完成/);
    bodies[EVIDENCE_PATHS_V15.review]=bytes({});await mounted.refresh();assert.equal(container.all().some(node=>node.dataset.v15Ready),false);assert.ok(container.all().some(node=>node.dataset.v15Pending));
    mounted.destroy();assert.equal(container.children.length,0);
  }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});
