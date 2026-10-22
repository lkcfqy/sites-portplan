import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {rowFor,summarize} from '../src/engine.js';
import {runRollingScenario} from '../src/rolling-plan.js';
import {enumerateCasesV8} from '../scripts/benchmark-v8.mjs';

// Handwritten one-box histories exercise the Python acceptance audit itself;
// they are neither prospective scenarios nor optimization performance evidence.
const scenario=()=>({id:'review-guard-handwritten',horizonStart:'2026-10-15',horizonDays:7,
  truckCapacity:4,warehouseCapacity:2,stagingCapacity:2,
  containers:[{id:'A',sizeFt:20,releaseDay:0,unloadDays:1,dueDay:5,
    dischargeDateTime:'2026-09-30T07:00:00+09:00',dataOrigin:'synthetic'}]});
const dates=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
function pressure(candidate,day=1) {
  const resources={};
  for(const resource of ['truck','warehouse','staging']) {
    const days=candidate.usage.filter(u=>u.day>day&&u.day<=day+2);
    resources[resource]={peakUtilization:Math.max(...days.map(d=>d[resource]/d[resource+'Capacity'])),
      saturatedDays:days.filter(d=>d[resource]===d[resource+'Capacity']).length,
      minimumHeadroom:Math.min(...days.map(d=>d[resource+'Capacity']-d[resource])),zeroCapacityDays:0};
  }
  return {resources};
}
async function fixture({before=[2,2,4],after=[1,1,2],pressureGuard=true}={}) {
  const s=scenario(),trace=[],previous=summarize(s,'fixture',[rowFor(s,s.containers[0],...before)],0),
    improved=summarize(s,'fixture',[rowFor(s,s.containers[0],...after)],0);
  const proof={seedAccepted:true,beforeDates:dates(previous.rows),afterDates:dates(improved.rows),
    seedIncrementalCost:previous.incrementalCost,finalIncrementalCost:improved.incrementalCost};
  const result=await runRollingScenario(s,[],{planner:async(observed,o)=>{
    const candidate=o.minEventDay===0?previous:improved;
    trace.push({day:o.minEventDay,action:o.minEventDay===0?'initialize':o.minEventDay===1?'polish':'retain',
      ...(o.minEventDay===1?{parameters:{maxChangedEvents:6,feeToleranceRatio:.005,lookaheadDays:2,pressureGuard},
        dateChanges:{changedEventCount:3},pressureProxy:{before:pressure(previous),after:pressure(improved)},
        stages:{polish:{metadata:structuredClone(proof)}}}:{}),callWallMs:0});
    return candidate;
  }});
  assert.equal(result.complete,true);
  return {nominalScenario:s,events:[],result:{...result,auditValid:true,plannerTrace:trace,hardWallMs:5000,
    wallTimeMs:100,finalReceivedMs:90,receiptValidatedMs:100,outputDeliveredWithinBudget:true,executionHistoryUnavailable:false}};
}
async function review(record) {
  const directory=await mkdtemp(join(tmpdir(),'portplan-review-guards-'));
  try {
    const file=join(directory,'episode.json');await writeFile(file,JSON.stringify(record));
    return spawnSync('python3',['scripts/review-v8.py','--episode',file],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  }finally {await rm(directory,{recursive:true,force:true});}
}

test('Python accepts a causal from-empty-history strict-fee polish with its exact nested proof',async()=>{
  const result=await review(await fixture());assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).checked.polishEndpoints,1);
});

test('Python rejects a forged fee in the actual nested V8 polishing proof',async()=>{
  const record=await fixture();record.result.plannerTrace[1].stages.polish.metadata.finalIncrementalCost++;
  const result=await review(record);assert.notEqual(result.status,0);
  assert.match(result.stderr,/polished fee/);
});

test('Python rejects accepted polish beyond the declared pending-date change cap',async()=>{
  const record=await fixture();record.result.plannerTrace[1].parameters.maxChangedEvents=2;
  const result=await review(record);assert.notEqual(result.status,0);
  assert.match(result.stderr,/change limit/);
});

test('Python independently detects worsening pressure even when recorded proxy values are truthful',async()=>{
  const record=await fixture({before:[4,4,5],after:[1,1,3],pressureGuard:false});
  assert.equal((await review(record)).status,0);
  record.result.plannerTrace[1].parameters.pressureGuard=true;
  const result=await review(record);assert.notEqual(result.status,0);
  assert.match(result.stderr,/pressure guard/);
});

test('Python binds a nested accepted polishing proof to the actual before/after decision endpoints',async()=>{
  const record=await fixture(),s=record.nominalScenario;
  const unrelated=summarize(s,'unrelated',[rowFor(s,s.containers[0],3,3,5)],0);
  const proof=record.result.plannerTrace[1].stages.polish.metadata;
  proof.beforeDates=dates(unrelated.rows);proof.seedIncrementalCost=unrelated.incrementalCost;
  const result=await review(record);assert.notEqual(result.status,0,'A valid but unrelated seed must not certify the accepted transition.');
});

test('Python requires accepted adaptive polishing evidence rather than silently accepting a deleted proof',async()=>{
  const record=await fixture();delete record.result.plannerTrace[1].stages.polish.metadata;
  const result=await review(record);assert.notEqual(result.status,0,'Accepted adaptive polish is missing its canonical date proof.');
});

test('adaptive action labels cannot bypass guards or describe executed work as failed',async()=>{
  for(const action of ['initialize','rebuild','failed']) {
    const record=await fixture();record.result.plannerTrace[1].action=action;
    const result=await review(record);
    assert.notEqual(result.status,0,`A valid retained reference cannot be relabelled ${action}.`);
  }
});

test('run review follows separately archived input artifacts and rejects SHA/path substitution before reading any prospective input',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'portplan-review-run-binding-')),
    run=join(directory,'run'),frozen=join(directory,'frozen'),hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  try {
    await mkdir(join(frozen,'source/data'),{recursive:true});await mkdir(join(run,'inputs'),{recursive:true});
    const protocolBytes=await readFile(new URL('../data/protocol-v8.json',import.meta.url)),protocol=JSON.parse(protocolBytes),
      generatorBytes=await readFile(new URL('../data/protocol-v2.json',import.meta.url)),metadata=enumerateCasesV8(protocol),
      implementationHashes={'data/protocol-v8.json':hash(protocolBytes),'data/protocol-v2.json':hash(generatorBytes)};
    await writeFile(join(frozen,'source/data/protocol-v8.json'),protocolBytes);
    await writeFile(join(frozen,'source/data/protocol-v2.json'),generatorBytes);
    await writeFile(join(frozen,'manifest.json'),JSON.stringify({schemaVersion:'portplan-v8-frozen-source',
      protocolHash:hash(protocolBytes),protocol,implementationHashes,scenarioMetadata:metadata}));
    // Only declarations are enumerated. This is a manually supplied invalid
    // artifact: no V8 generator inputs, planner, freeze command or solver runs.
    await writeFile(join(run,'inputs/handwritten-invalid.json'),JSON.stringify({nominalScenario:scenario(),events:[]}));
    const index={executionState:'complete',protocolHash:hash(protocolBytes),protocol,frozenSource:'../frozen',implementationHashes,
      cases:metadata.map(config=>({...config,inputArtifact:{path:'inputs/handwritten-invalid.json',sha256:'0'.repeat(64)}}))};
    const check=async()=>{await writeFile(join(run,'complete.json'),JSON.stringify(index));return spawnSync('python3',
      ['scripts/review-v8.py','--run',run],{cwd:new URL('../',import.meta.url),encoding:'utf8'});};
    const mismatched=await check();assert.notEqual(mismatched.status,0);assert.match(mismatched.stderr,/Artifact SHA differs/);
    index.cases[0].inputArtifact.path='../frozen/manifest.json';
    const escaped=await check();assert.notEqual(escaped.status,0);assert.match(escaped.stderr,/Artifact escapes run directory/);
  }finally {await rm(directory,{recursive:true,force:true});}
});
