#!/usr/bin/env node
/** Prespecified archived-prefix development replay. Never a new holdout. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {runColdEpisodeV10,isCompleteV10} from './benchmark-v10.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
const ARCHIVE='data/evidence-v10/v10-frozen-first/first-run';
const CASE='v10-stress-new-arrivals-tight-n24-r3';
const INDEX_SHA='33d07f60afb4b4248682badc631512a54070cca22fd106c7dd5062d4669bf9c2';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const DECLARATION=Object.freeze({
  caseId:CASE,interventionDay:4,prefixDays:[0,1,2,3],
  repeats:[{index:1,seed:49011},{index:2,seed:49023},{index:3,seed:49039}],
  branches:['retain_cache','lower_m_candidate'],dailyBudgetMs:200,parentHardWallMs:5000,
  branchOrder:'a1 cache then proposal; a2 proposal then cache; a3 cache then proposal',
  initialization:'Separate fresh native service per branch; ready and offline endpoint import are recorded separately and charged to its five-second parent clock.',
  intervention:'Replay original complete D0-D3 decisions/actions; force one archived D4 endpoint, import its audited dates into a replay-only V11 cache, then apply unchanged V11 native selection from D5.',
  scope:'Seen-case conditional suffix intervention under the synthetic daily model. No natural full-D0 policy counterfactual, prospective validation, new seed or formal benchmark claim.',
  optimizer:'Real independent Python/HiGHS service from D5; one request per native decision, one solver thread, original cooperative 200ms budget. No wider diagnostic allowance or retry.'});

export function verifyReplayPlannerCopy(base,copied){
  const marker='// Base SHA-256: '+sha(base)+'\n';assert.ok(copied.includes(marker),'Replay planner base hash differs.');
  const start=copied.indexOf("import {auditSchedule"),blockStart=copied.indexOf('  // BEGIN REPLAY-ONLY ENDPOINT IMPORT.'),blockEnd=copied.indexOf('  // END REPLAY-ONLY ENDPOINT IMPORT.');
  assert.ok(start>=0&&blockStart>start&&blockEnd>blockStart);
  const after=blockEnd+'  // END REPLAY-ONLY ENDPOINT IMPORT.\n\n'.length;
  assert.equal(copied.slice(start,blockStart)+copied.slice(after),base,'Replay copy changed behavior outside the endpoint-import block.');
  return {baseSha256:sha(base),copySha256:sha(copied),onlyDifference:'Marked offline endpoint-import block and explanatory header.',exactBaseLogicMatch:true};
}

export async function runControlledReplay(output,{supersedes=null}={}){
  const base=await fs.readFile(path.join(ROOT,'scripts/highs-planner-v11.mjs'),'utf8');
  const copy=await fs.readFile(path.join(ROOT,'scripts/replay-commitment-v11.planner.mjs'),'utf8');
  const copyProof=verifyReplayPlannerCopy(base,copy);
  const indexName=ARCHIVE+'/complete.json',indexBytes=await fs.readFile(path.join(ROOT,indexName));assert.equal(sha(indexBytes),INDEX_SHA);
  const reviewName='data/commitment-slack-review-v11.json',reviewBytes=await fs.readFile(path.join(ROOT,reviewName)),review=JSON.parse(reviewBytes);
  assert.equal(review.valid,true);assert.equal(review.inputIndexSha256,INDEX_SHA);
  const protocolName='data/protocol-v10.json',protocolBytes=await fs.readFile(path.join(ROOT,protocolName)),protocol=JSON.parse(protocolBytes);
  const configuration=protocol.callBudgets.stableHiGHSV10;assert.equal(configuration.timeBudgetMs,200);
  const sourceNames=['scripts/replay-commitment-v11.mjs','scripts/replay-commitment-v11.worker.mjs','scripts/replay-commitment-v11.planner.mjs',
    'scripts/highs-planner-v11.mjs','src/commitment-slack-v11.js','src/engine.js','src/rolling-plan.js',
    'scripts/highs-service-v8.py','scripts/certify-v4.py','scripts/benchmark-v2.mjs','data/protocol-v2.json',
    'scripts/benchmark-v10.mjs','scripts/episode-v10.worker.mjs','scripts/rolling-benchmark-v7.mjs','scripts/rolling-v7.worker.mjs',
    'scripts/review-replay-commitment-v11.py','scripts/review-v5.py'];
  const implementationHashes={};for(const name of sourceNames)implementationHashes[name]=sha(await fs.readFile(path.join(ROOT,name)));
  const sourceBindings={[indexName]:sha(indexBytes),[reviewName]:sha(reviewBytes),[protocolName]:sha(protocolBytes)};
  let priorEvidence=null;
  if(supersedes){
    const absolute=path.resolve(ROOT,supersedes),relative=path.relative(ROOT,absolute);
    assert.ok(!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative));
    const bytes=await fs.readFile(absolute),prior=JSON.parse(bytes);
    assert.equal(prior.schemaVersion,'portplan-commitment-replay-v11-development-v1');
    assert.equal(prior.summary.nativeRequests,0,'Only the known pre-native harness failure is superseded here.');
    sourceBindings[relative]=sha(bytes);
    priorEvidence={evidenceRef:{path:relative,sha256:sha(bytes)},originalPreserved:true,
      reason:'Correct five-field independent fee-ledger mapping: joint objective is incrementalCost; avoid masking a D4 replay error with a post-execution assertion.',
      interpretation:'Earlier attempt failed inside the harness before any native optimization request. It is retained as a development error, not an algorithm success/failure or a discarded performance observation.'};
  }
  const inputName=ARCHIVE+'/inputs/'+CASE+'.json',inputBytes=await fs.readFile(path.join(ROOT,inputName)),sourceInput=JSON.parse(inputBytes);
  assert.equal(sha(inputBytes),review.sourceBindings[inputName]);sourceBindings[inputName]=sha(inputBytes);
  const jobs=[];
  for(const repeat of DECLARATION.repeats){
    const episodeName=ARCHIVE+'/episodes/'+CASE+'--a'+repeat.index+'--stableHiGHSV10.json';
    const bytes=await fs.readFile(path.join(ROOT,episodeName));assert.equal(sha(bytes),review.sourceBindings[episodeName]);sourceBindings[episodeName]=sha(bytes);
    const original=JSON.parse(bytes);assert.equal(original.algorithmSeed,repeat.seed);
    const endpointReview=review.day4EndpointReviews.find(r=>r.repeatIndex===repeat.index);assert.ok(endpointReview);assert.equal(endpointReview.publicScenario.containers.length,24);
    const order=repeat.index%2?[...DECLARATION.branches]:[...DECLARATION.branches].reverse();
    for(const branch of order)jobs.push({episodeId:`${CASE}--a${repeat.index}--${branch}`,caseId:CASE,repeatIndex:repeat.index,algorithmSeed:repeat.seed,branch,
      sourceInputArtifact:{path:inputName,sha256:sha(inputBytes)},sourceEpisodeArtifact:{path:episodeName,sha256:sha(bytes)},originalResult:original.result,endpointReview});
  }
  // Atomic exclusive directory creation precedes all optimizer calls. Existing
  // development results, formal artifacts and reports cannot be overwritten.
  await fs.mkdir(output);
  const state={schemaVersion:'portplan-commitment-replay-v11-development-v1',dataRole:'seen-v10-controlled-prefix-development',
    startedAt:new Date().toISOString(),executionState:'declared',declaration:{...structuredClone(DECLARATION),...(priorEvidence?{supersedes:priorEvidence}:{})},replayPlannerCopyProof:copyProof,
    originalIndexSha256:INDEX_SHA,implementationHashes,sourceBindings,newHeldOutExperiments:0,newGeneratedSeeds:0,
    records:[],scope:DECLARATION.scope};
  await fs.writeFile(path.join(output,'declaration.json'),JSON.stringify({...state,jobs:jobs.map(({originalResult,endpointReview,...job})=>job)},null,2)+'\n',{flag:'wx'});
  for(const name of sourceNames){const target=path.join(output,'source',name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.copyFile(path.join(ROOT,name),target,fs.constants.COPYFILE_EXCL);}
  state.executionState='running';
  for(const [index,job]of jobs.entries()){
    const number=String(index+1).padStart(3,'0'),journalName=`decision-journal-${number}.jsonl`,journalPath=path.join(output,journalName);
    await fs.writeFile(journalPath,'',{flag:'wx'});
    const {originalResult,endpointReview,...identity}=job;
    const result=await runColdEpisodeV10({...identity,method:'controlledReplayV11',nominalScenario:sourceInput.nominalScenario,events:sourceInput.events,
      originalResult,endpointReview,dailyBudgetMs:DECLARATION.dailyBudgetMs,plannerConfiguration:configuration,journalPath},
      {hardWallMs:DECLARATION.parentHardWallMs,workerScript:path.join(ROOT,'scripts/replay-commitment-v11.worker.mjs')});
    const artifactName=`episode-${number}.json`,bytes=JSON.stringify({...identity,result},null,2)+'\n';
    await fs.writeFile(path.join(output,artifactName),bytes,{flag:'wx'});
    const journalBytes=await fs.readFile(journalPath);
    state.records.push({...identity,artifact:{path:artifactName,sha256:sha(bytes)},journal:{path:journalName,sha256:sha(journalBytes),
      scope:'Uncompacted candidate/input diagnostics; only the accepted final simulator timeline is authoritative physical execution.'},
      completeWithinBudget:isCompleteV10(result)&&result.episodeCompletedWithinBudget===true,physicalComplete:result.complete===true,
      status:result.status,failure:result.failure??null,totalCost:result.totalCost??null,incrementalCost:result.incrementalCost??null,
      revisionCount:result.revisionCount??null,nativeRequests:result.plannerStats?.actualNativeRequests??null,
      parentWallMs:result.wallTimeMs,parentDeadlineReached:result.deadlineReached});
    console.log(JSON.stringify({index:index+1,total:jobs.length,branch:job.branch,repeatIndex:job.repeatIndex,status:result.status,
      completeWithinBudget:state.records.at(-1).completeWithinBudget,failureDay:result.failure?.day??null,nativeRequests:state.records.at(-1).nativeRequests}));
  }
  for(const [name,digest]of Object.entries({...implementationHashes,...sourceBindings}))assert.equal(sha(await fs.readFile(path.join(ROOT,name))),digest,'Source changed during controlled replay: '+name);
  state.completedAt=new Date().toISOString();state.executionState='complete';
  state.summary={episodeCount:state.records.length,uniqueBusinessScenarioCount:1,algorithmTimingRepeats:3,
    newHeldOutExperiments:0,nativeRequests:state.records.reduce((n,r)=>n+(r.nativeRequests??0),0),
    branches:Object.fromEntries(DECLARATION.branches.map(branch=>{const rows=state.records.filter(r=>r.branch===branch);return [branch,
      {episodes:rows.length,completeWithinBudget:rows.filter(r=>r.completeWithinBudget).length,
        failureDays:rows.map(r=>r.failure?.day??null),incrementalCosts:rows.map(r=>r.incrementalCost),revisionCounts:rows.map(r=>r.revisionCount)}];})),
    conclusionScope:'Observed suffix outcomes under one explicit archived intervention; not full-D0 V11 performance, a new holdout, an average causal effect, or a contest ranking guarantee.'};
  await fs.writeFile(path.join(output,'complete.json'),JSON.stringify(state,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify(state.summary));return state;
}

async function main(){
  const args=process.argv.slice(2);assert.ok([3,5].includes(args.length));assert.equal(args[0],'--run');assert.equal(args[1],'--output');
  if(args.length===5)assert.equal(args[3],'--supersedes');
  await runControlledReplay(path.resolve(ROOT,args[2]),{supersedes:args[4]??null});
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
