import test from 'node:test';
import assert from 'node:assert/strict';
import {METHODS_V12,validateResearchV12Evidence,validateResearchV12Packages,mountResearchV12UI} from '../src/research-v12-ui.js';

function fixture(){
  // Shape fixture only, never written as a result or passed to the material publisher.
  const pairs={v12VsV11:['commitmentHiGHSV11','seededHiGHSV12'],v12VsV10:['stableHiGHSV10','seededHiGHSV12'],v12VsV9:['adaptiveV9','seededHiGHSV12'],v12VsHiGHS:['highsV8','seededHiGHSV12'],v12VsV7:['costPolishV7','seededHiGHSV12'],v11VsV10:['stableHiGHSV10','commitmentHiGHSV11'],v10VsHiGHS:['highsV8','stableHiGHSV10'],highsVsV7:['costPolishV7','highsV8']};
  const init={knownDayZeroCount:0,acceptedInitialPlanCount:0,knownInitialFailureCount:0,knownLaterFailureCount:0,unknownDayZeroCount:216};
  const wrapper={schemaVersion:'portplan-v12-published-results',executionState:'complete',scenarioCount:144,episodeCount:2592,formalIndex:{sha256:'0'.repeat(64)},protocol:{methods:[...METHODS_V12]},summary:{inferentialState:'complete-scenario-cluster-bootstrap',panels:{}}};
  const review={schemaVersion:'portplan-independent-v12-run-review',valid:true,fixture:false,readOnly:true,importsJavaScript:false,solverRuns:0,summary:{episodes:2592},inputIndexSha256:'0'.repeat(64),frozenManifestSha256:'1'.repeat(64),pointEstimates:{}};
  const stats={schemaVersion:'portplan-independent-v12-bootstrap-review',valid:true,fixture:false,readOnly:true,importsJavaScript:false,solverRuns:0,episodeCount:2592,businessScenarioCount:144,inputIndexSha256:'0'.repeat(64),frozenManifestSha256:'1'.repeat(64),panels:{}};
  for(const panel of ['same-distribution','stress']){
    const p={scenarioCount:72,byMethod:{},comparisons:{}},q={byMethod:{},comparisons:{}},b={byMethod:{},comparisons:{}};
    for(const method of METHODS_V12){p.byMethod[method]={recordedEpisodeCount:216,completeEpisodeCount:0,initialization:{...init}};q.byMethod[method]={completeEpisodeCount:0};b.byMethod[method]={completeEpisodeCount:0,initialization:Object.fromEntries(Object.entries(init).reverse())};}
    for(const [key,[before,after]]of Object.entries(pairs)){p.comparisons[key]={baselineMethod:before,candidateMethod:after,completion:{lostEpisodeCount:0,lostEpisodeIds:[]},fees:{}};q.comparisons[key]={lostEpisodes:0,fees:{}};b.comparisons[key]={fees:{}};for(const field of ['total','incremental']){p.comparisons[key].fees[field]={pairedScenarioCount:0,pairedEpisodeCount:0,weightedSavingsPct:null,negativeScenarioIds:[],negativeEpisodeIds:[],uncertainty:{weightedSavingsPct95CI:null}};q.comparisons[key].fees[field]={pairedScenarios:0,pairedEpisodes:0,baselineScenarioMeanSumKRW:0,candidateScenarioMeanSumKRW:0,scenarioWinTieLoss:{loss:0}};b.comparisons[key].fees[field]={pairedScenarioCount:0,pairedEpisodeCount:0,weightedSavingsPct95CI:null};}}
    wrapper.summary.panels[panel]=p;review.pointEstimates[panel]=q;stats.panels[panel]=b;
  }
  return [wrapper,review,stats];
}

test('V12 UI admits complete bound shape and rejects fixtures, altered fees, missing losses and wrong hashes',()=>{
  assert.equal(validateResearchV12Evidence(...fixture()),true);
  for(const mutate of [
    a=>a[1].fixture=true,a=>a[0].episodeCount=2160,a=>a[2].inputIndexSha256='2'.repeat(64),
    a=>delete a[0].summary.panels.stress.byMethod.seededHiGHSV12,
    a=>a[0].summary.panels.stress.comparisons.v12VsV7.fees.total.negativeScenarioIds=null,
    a=>a[0].summary.panels.stress.comparisons.v12VsV7.completion.lostEpisodeCount=1,
    a=>a[0].summary.panels.stress.comparisons.v12VsV7.fees.total.weightedSavingsPct=90,
  ]){const input=fixture();mutate(input);assert.throws(()=>validateResearchV12Evidence(...input));}
});

function packagesFixture(count=2){return {schemaVersion:'portplan-v12-download-packages',sourceRecovery:{archiveRoot:'portplan/'},packages:Array.from({length:count},(_,i)=>({file:`portplan-fixture-${i}.zip`,url:`/downloads/portplan-fixture-${i}.zip`,bytes:1000+i,sha256:String(i).repeat(64)}))};}

test('recovery manifest rejects incomplete metadata, duplicate packages and unsafe download targets',()=>{
  const good=packagesFixture();assert.equal(validateResearchV12Packages(good),good.packages);
  for(const mutate of [m=>m.packages=[],m=>m.sourceRecovery.archiveRoot='other/',m=>m.packages[0].url='https://example.com/file.zip',m=>m.packages[0].file='../secret.zip',m=>m.packages[0].bytes=null,m=>m.packages[0].sha256='unknown',m=>m.packages.push({...m.packages[0]})]){const changed=structuredClone(good);mutate(changed);assert.throws(()=>validateResearchV12Packages(changed));}
});

test('recovery lists every current ZIP and exact metadata independently of the formal-results gate',async()=>{
  // DOM wiring only; this does not claim real-browser or ZIP-content acceptance.
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.style={};this.listeners={};this.textContent='';}
    append(...values){this.children.push(...values);}replaceChildren(...values){this.children=[...values];}
    setAttribute(){}addEventListener(event,callback){this.listeners[event]=callback;}
    all(){return [this,...this.children.flatMap(child=>child.all())];}
  }
  const originalDocument=globalThis.document,originalFetch=globalThis.fetch,requests=[];let manifest=packagesFixture(),releaseMissing=false;
  globalThis.document={createElement:tag=>new Element(tag)};
  globalThis.fetch=async path=>{requests.push(path);return {ok:path==='/data/download-packages-v12.json'||path==='/data/v12-release.json'&&!releaseMissing,status:404,json:async()=>structuredClone(path==='/data/download-packages-v12.json'?manifest:{formalExperimentComplete:true,independentReviewComplete:false,independentBootstrapReviewComplete:false})};};
  try{
    const container=new Element('section');mountResearchV12UI(container);await new Promise(resolve=>setImmediate(resolve));
    const texts=()=>container.all().map(element=>element.textContent).join(' '),downloadLinks=()=>container.all().filter(element=>element.tagName==='a'&&element.href?.endsWith('.zip'));
    assert.equal(downloadLinks().length,manifest.packages.length);
    for(const p of manifest.packages){assert.equal(downloadLinks().find(a=>a.href===p.url).textContent,p.file);assert.ok(texts().includes(p.bytes.toLocaleString('zh-CN')+' bytes'));assert.ok(texts().includes(p.sha256));}
    assert.match(texts(),/同一父目录.*portplan\//);assert.match(texts(),/不在浏览器运行该求解器/);assert.match(texts(),/不使用开发结果填充正式成绩/);assert.equal(requests.includes('/data/v12-results.json'),false);
    const refresh=container.all().find(element=>element.tagName==='button');
    manifest=packagesFixture(3);releaseMissing=true;await refresh.listeners.click();
    assert.equal(downloadLinks().length,3);assert.match(texts(),/清单列出 3 个 ZIP/);assert.match(texts(),/V12 证据尚不可展示/);
    manifest.packages[1].sha256='bad';await refresh.listeners.click();
    assert.equal(downloadLinks().length,0);assert.match(texts(),/全部恢复包清单暂不可用/);assert.ok(container.all().some(element=>element.href==='/data/download-packages-v12.json'));
  }finally{if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;globalThis.fetch=originalFetch;}
});
