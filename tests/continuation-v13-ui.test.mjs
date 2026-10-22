import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fetchBoundContinuationReport, validateContinuationV13} from '../src/continuation-v13-ui.js';

function fixture() {
  return [{schemaVersion:'portplan-continuation-v13',formalIndexSha256:'141ac68b0627e74ffa41f881078d9d73304263240e858d148c64e91562217646',fullChampionshipPlanComplete:false,defaultRecommendationEligible:false,enterpriseRecordsRequired:false,browserAcceptance:{status:'passed'},algorithmDevelopment:{status:'implemented_pending_first_controlled_run'}},
    {schemaVersion:'portplan-published-browser-acceptance-v13',valid:true,fixture:false,actualBrowser:true,browser:{engine:'Chromium'},totalChecks:49,passedChecks:49,openProductIssues:0,unresolvedHarnessIssues:0,entrantUnderstandingCertified:false,nativeFormalExperiment:false,cases:Array.from({length:49},(_,i)=>({id:'case-'+i,group:'shape-fixture-only',status:'passed',checklistRow:i%10+1}))}];
}

test('current acceptance admits actual complete browser coverage and rejects incomplete or expanded claims',()=>{
  assert.equal(validateContinuationV13(...fixture()),true);
  for (const mutate of [a=>a[0].formalIndexSha256='0'.repeat(64),a=>a[0].fullChampionshipPlanComplete=true,a=>a[0].defaultRecommendationEligible=true,a=>a[0].enterpriseRecordsRequired=true,a=>a[1].fixture=true,a=>a[1].actualBrowser=false,a=>a[1].passedChecks=48,a=>a[1].openProductIssues=1,a=>a[1].unresolvedHarnessIssues=1,a=>a[1].entrantUnderstandingCertified=true,a=>a[1].nativeFormalExperiment=true,a=>a[1].cases.pop(),a=>a[1].cases[1].id=a[1].cases[0].id,a=>a[1].cases.forEach(item=>item.checklistRow=1)]) {
    const values=fixture();mutate(values);assert.throws(()=>validateContinuationV13(...values));
  }
});

test('controlled development cannot fill incomplete coverage or omit failures and needs the same read-only review',()=>{
  const [status,browser]=fixture();status.algorithmDevelopment.status='reviewed_seen_controlled_experiment';
  const development={schemaVersion:'portplan-v13-controlled-development',executionState:'complete',businessCases:2,timingRepeats:3,plannedRuns:12,recordedRuns:12,freshHeldOutBusinessCases:0,forcedEndpoints:true,inputIndexSha256:'a'.repeat(64),defaultRecommendationEligible:false,fullChampionshipPlanComplete:false,byBranch:{seed:{complete:0,failed:6,unknown:0},native:{complete:0,failed:6,unknown:0}}};
  const review={schemaVersion:'portplan-independent-guard-replay-review-v13',valid:true,readOnly:true,importsJavaScript:false,solverRuns:0,inputIndexSha256:development.inputIndexSha256};
  assert.equal(validateContinuationV13(status,browser,development,review),true);
  for (const mutate of [a=>a[2].recordedRuns=11,a=>a[2].freshHeldOutBusinessCases=1,a=>a[2].forcedEndpoints=false,a=>a[2].byBranch.seed.failed=5,a=>a[2].byBranch.native.unknown=-1,a=>a[3].inputIndexSha256='b'.repeat(64),a=>a[3].solverRuns=1,a=>a[3].valid=false,a=>a[3].importsJavaScript=true,a=>{delete a[2].inputIndexSha256;delete a[3].inputIndexSha256;}]) {
    const values=structuredClone([status,browser,development,review]);mutate(values);assert.throws(()=>validateContinuationV13(...values));
  }
});

test('current proof is read only from allowed same-site reports and verified against original bytes',async()=>{
  const bytes=new TextEncoder().encode('{"valid":true}\n'),reference={path:'/data/browser-acceptance-v13.json',sha256:createHash('sha256').update(bytes).digest('hex')};
  const fetcher=async()=>({ok:true,arrayBuffer:async()=>bytes.buffer});
  assert.deepEqual(await fetchBoundContinuationReport(reference,fetcher),{valid:true});
  await assert.rejects(fetchBoundContinuationReport({...reference,path:'https://example.com/proof.json'},fetcher));
  await assert.rejects(fetchBoundContinuationReport({...reference,sha256:'0'.repeat(64)},fetcher));
  await assert.rejects(fetchBoundContinuationReport(reference,async()=>({ok:false,status:404})));
});
