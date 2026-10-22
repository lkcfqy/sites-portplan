#!/usr/bin/env node
/** Archived endpoint integration only: no real optimizer or whole-path replay. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {scoreCommitmentSlackV11} from '../src/commitment-slack-v11.js';
import {createCommitmentHiGHSPlannerV11} from './highs-planner-v11.mjs';
import {rowFor, auditSchedule} from '../src/engine.js';
import {auditFrozenEvents} from '../src/rolling-plan.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const args=process.argv.slice(2),at=args.indexOf('--output');
if(at<0||!args[at+1]||args.length!==2)throw Error('Usage: node scripts/check-commitment-v11.mjs --output NEW_JSON_PATH');
const output=path.resolve(root,args[at+1]);
try{await fs.access(output);throw Error('Preserve the previous integration receipt; choose a new output path.');}catch(e){if(e.code!=='ENOENT')throw e;}
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sourceNames=['scripts/check-commitment-v11.mjs','src/commitment-slack-v11.js','scripts/highs-planner-v11.mjs',
 'src/engine.js','src/rolling-plan.js','tests/fixtures/highs-v8-service.py','data/commitment-slack-review-v11.json'];
const sourceHashes={};for(const name of sourceNames)sourceHashes[name]=sha(await fs.readFile(path.join(root,name)));
const review=JSON.parse(await fs.readFile(path.join(root,'data/commitment-slack-review-v11.json'),'utf8'));
assert.equal(review.valid,true);assert.equal(review.newSolverCalls,0);assert.equal(review.newHeldOutExperiments,0);
assert.equal(sha(review.calculationImplementationSource),review.calculationImplementationSha256);
assert.equal(review.inputIndexSha256,'33d07f60afb4b4248682badc631512a54070cca22fd106c7dd5062d4669bf9c2');
assert.equal(review.day4EndpointReviews.length,3);
const dates=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const feeFields=['storageCost','ddCost','totalCost','sunkCost','incrementalCost'];
const receipt={schemaVersion:'portplan-commitment-slack-integration-v11',valid:true,generatedAt:new Date().toISOString(),
 dataRole:'seen-v10-archived-endpoint-development',sourceHashes,newOptimizerCalls:0,newHeldOutExperiments:0,
 wholePathPolicyReplays:0,mockServiceCalls:0,endpointScoreCount:0,containerScores:0,records:[],
 scope:'Compare JavaScript necessary-load scores and per-box domain counts with independent Python on six saved endpoints, then exercise V11 adapter selection using the explicit synthetic response service. No native HiGHS optimization, timing benchmark, prospective validation or whole-path completion claim.',
 domainDifference:'The original Python calendar-only relaxation and its separately enumerated single-box public-capacity relaxation are both retained. JavaScript matches the latter on these endpoints; none of the domains enforces joint shared-resource feasibility.'};
for(const endpoint of review.day4EndpointReviews){
 const s=endpoint.publicScenario,options={minEventDay:endpoint.day,fixedEvents:endpoint.originalFixedEvents,objectiveMode:'joint',timeBudgetMs:2000};
 assert.equal(s.containers.length,24);assert.equal(endpoint.informationBoundary.privateEventListPassed,false);
 const record={caseId:endpoint.caseId,repeatIndex:endpoint.repeatIndex,observationHash:endpoint.originalObservationHash,
  publicScenarioSha256:endpoint.publicScenarioSha256,independentPython:{},javascript:{},adapter:null};
 for(const label of ['cache','proposal']){
  const source=endpoint.scores[label],score=scoreCommitmentSlackV11(s,source.endpointDates,options);
  assert.equal(score.complete,true);assert.equal(score.containers.length,24);
  assert.equal(score.mandatoryWarehouseTomorrow,source.mandatoryWarehouse);
  assert.equal(score.publicWarehouseCapacityTomorrow,source.suppliedCapacity);
  assert.deepEqual(score.shadowFixedEvents,source.shadowFixedEvents);
  const expected=new Map(source.individualDomains.map(c=>[c.id,c.minimumWarehouseAtTarget]));
  for(const c of score.containers)assert.equal(c.mandatoryWarehouseTomorrow,expected.get(c.id));
  const independentCapacity=endpoint.singleBoxCapacityReview[label];
  assert.equal(independentCapacity.complete,true);
  assert.equal(score.legalTripCount,independentCapacity.legalTripCount);
  const independentDomains=new Map(independentCapacity.containers.map(c=>[c.id,c]));
  for(const c of score.containers)for(const field of ['legalTripCount','occupiesTomorrowCount','avoidsTomorrowCount','mandatoryWarehouseTomorrow']){
    assert.equal(c[field],independentDomains.get(c.id)?.[field],`${label}/${c.id}/${field}`);
  }
  record.independentPython[label]={mandatoryWarehouse:source.mandatoryWarehouse,capacity:source.suppliedCapacity,fees:source.independentFees};
  record.javascript[label]=score;receipt.endpointScoreCount++;receipt.containerScores+=score.containers.length;
 }
 const mockReply=label=>{
  const byId=new Map(endpoint.scores[label].endpointDates.map(r=>[r.id,r]));
  const rows=s.containers.map(c=>{const r=byId.get(c.id);return rowFor(s,c,r.pickupDay,r.unloadDay,r.returnDay);});
  assert.equal(auditSchedule(s,rows).valid,true);assert.equal(auditFrozenEvents(rows,options.fixedEvents,options.minEventDay).valid,true);
  const independentCosts=Object.fromEntries(feeFields.map(key=>[key,rows.reduce((sum,r)=>sum+r[key],0)]));
  for(const key of feeFields)assert.equal(independentCosts[key],endpoint.scores[label].independentFees[key]);
  return {status:'feasible',solverStatus:1,hasIncumbent:true,provenOptimal:false,rows:dates(rows),
   objectiveCost:independentCosts.incrementalCost,independentCosts,fixture:true};
 };
 const planner=createCommitmentHiGHSPlannerV11({servicePath:path.join(root,'tests/fixtures/highs-v8-service.py')});
 try{
  await planner.ready();
  const first=await planner({...s,nativeFixture:{reply:mockReply('cache')}},options);
  assert.deepEqual(dates(first.rows),endpoint.scores.cache.endpointDates);
  const selected=await planner({...s,nativeFixture:{reply:mockReply('proposal')}},options);
  receipt.mockServiceCalls+=2;
  const selection=selected.plannerMetadata.stabilitySelection;
  assert.equal(selection.decisionReason,'equal_fee_lower_mandatory_warehouse');
  assert.equal(selection.commitmentScore.beforeM,2);assert.equal(selection.commitmentScore.proposalM,1);
  assert.equal(selection.commitmentScore.selectedM,1);assert.equal(selected.plannerMetadata.commitmentReplacementCount,1);
  assert.equal(selected.plannerMetadata.strictReplacementCount,0);
  assert.deepEqual(dates(selected.rows),endpoint.scores.proposal.endpointDates);
  assert.equal(selected.objectiveCost,first.objectiveCost);
  record.adapter={decisionReason:selection.decisionReason,beforeM:2,proposalM:1,selectedM:1,
   initialFees:first.objectiveCost,selectedFees:selected.objectiveCost,changedEventCount:selection.changedEventCount,
   acceptedAtMs:selection.nativeGate.acceptedAtMs,callBudgetMs:options.timeBudgetMs,
   timeScope:'Synthetic response-service integration only; these values are not real native performance measurements.'};
 }finally{await planner.close();}
 receipt.records.push(record);
}
for(const [name,digest]of Object.entries(sourceHashes))assert.equal(sha(await fs.readFile(path.join(root,name))),digest,'Source changed during integration: '+name);
await fs.mkdir(path.dirname(output),{recursive:true});
await fs.writeFile(output,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({valid:true,output:path.relative(root,output),endpointScores:receipt.endpointScoreCount,
 containerScores:receipt.containerScores,mockServiceCalls:receipt.mockServiceCalls,newOptimizerCalls:0,newHeldOutExperiments:0,wholePathPolicyReplays:0}));
