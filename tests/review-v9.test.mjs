import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {rowFor,summarize} from '../src/engine.js';
import {runRollingScenario} from '../src/rolling-plan.js';

// All dates and timestamps below are explicitly handwritten audit fixtures.
// No prospective V9 input generation or optimizer call is performed here.
const scenario=()=>({id:'v9-review-handwritten',horizonStart:'2026-10-15',horizonDays:7,
  truckCapacity:4,warehouseCapacity:2,stagingCapacity:2,
  containers:[{id:'A',sizeFt:20,releaseDay:0,unloadDays:1,dueDay:5,
    dischargeDateTime:'2026-09-30T07:00:00+09:00',dataOrigin:'synthetic'}]});
const dates=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const parameters={feeToleranceRatio:.005,maxChangedEvents:6,lookaheadDays:2,pressureGuard:true,
  opportunityThresholdKRW:0,auditReserveMs:5};
function event(candidate,sequence=1,source='locked_constructor') {
  return {sequence,source,receivedAtMs:1,copyCompletedAtMs:2,auditCompletedAtMs:3,
    selectionCompletedAtMs:4,acceptedAtMs:4,outcome:'accepted',proposedDates:dates(candidate.rows),
    dates:dates(candidate.rows),incrementalCost:candidate.incrementalCost,
    audit:{scheduleValid:true,freezeValid:true,errors:[]}};
}
function gate(candidate,day) {
  return {schemaVersion:'portplan-v9-candidate-delivery-1',deadlineBasis:'outer-planner-start',callId:day+1,
    minEventDay:day,wholeCallBudgetMs:200,firstAcceptedAtMs:4,selectedAcceptanceAtMs:4,
    selectedCandidateSequence:1,closed:true,events:[event(candidate,1,day?'cache':'locked_constructor')]};
}
async function fixture() {
  const s=scenario(),trace=[],candidate=summarize(s,'fixture',[rowFor(s,s.containers[0],2,2,3)],0),
    result=await runRollingScenario(s,[],{planner:async(observed,o)=>{
      trace.push({day:o.minEventDay,action:o.minEventDay?'retain':'initialize',parameters:structuredClone(parameters),
        wholeCallBudgetMs:200,incumbentAcceptedAtMs:4,candidateDelivery:gate(candidate,o.minEventDay),callWallMs:8});
      return candidate;
    }});
  assert.equal(result.complete,true);
  return {nominalScenario:s,events:[],result:{...result,policy:'adaptiveV9',auditValid:true,plannerTrace:trace,
    hardWallMs:5000,wallTimeMs:100,outputDeliveredWithinBudget:true,executionHistoryUnavailable:false,
    finalReceivedMs:90,receiptValidatedMs:100}};
}
async function review(record) {
  const directory=await mkdtemp(join(tmpdir(),'portplan-review-v9-'));
  try {
    const file=join(directory,'episode.json');await writeFile(file,JSON.stringify(record));
    return spawnSync('python3',['scripts/review-v9.py','--episode',file],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  }finally {await rm(directory,{recursive:true,force:true});}
}
const first=record=>record.result.plannerTrace[0];
const firstEvent=record=>first(record).candidateDelivery.events[0];
async function rejects(mutator,pattern) {
  const record=await fixture();mutator(record);const checked=await review(record);
  assert.notEqual(checked.status,0,checked.stdout);if(pattern)assert.match(checked.stderr,pattern);
}

test('V9 independent audit accepts complete candidate proof bound to causal physical decisions',async()=>{
  const checked=await review(await fixture());assert.equal(checked.status,0,checked.stderr);
  const output=JSON.parse(checked.stdout);assert.equal(output.solverRuns,0);
  assert.equal(output.checked.candidateDelivery.acceptedCandidates,4);
});

test('timely complete incumbent remains valid after optional work extends the call past 200 ms',async()=>{
  const record=await fixture();first(record).callWallMs=400;
  const checked=await review(record);assert.equal(checked.status,0,checked.stderr);
});

test('late first outer acceptance cannot be rescued by forged internal first-incumbent metadata',async()=>{
  await rejects(record=>{
    const m=first(record),e=firstEvent(record);m.firstIncumbentMs=1;m.callWallMs=500;
    e.selectionCompletedAtMs=201;e.acceptedAtMs=201;m.incumbentAcceptedAtMs=201;
    m.candidateDelivery.firstAcceptedAtMs=201;m.candidateDelivery.selectedAcceptanceAtMs=201;
  },/outer deadline/);
});

test('candidate copy and physical audit must precede outer acceptance',async()=>{
  await rejects(record=>{firstEvent(record).auditCompletedAtMs=5;},/ordering/);
  await rejects(record=>{firstEvent(record).copyCompletedAtMs=null;},/copy/);
  await rejects(record=>{firstEvent(record).acceptedAtMs=3;},/ordering|backdated/);
});

test('selected sequence, timestamps and exact executed dates cannot be substituted',async()=>{
  await rejects(record=>{first(record).candidateDelivery.selectedCandidateSequence=2;},/selected sequence/);
  await rejects(record=>{first(record).candidateDelivery.firstAcceptedAtMs=0;},/first real/);
  await rejects(record=>{first(record).incumbentAcceptedAtMs=0;},/top-level/);
  await rejects(record=>{firstEvent(record).dates[0].returnDay=4;},/canonical candidate/);
});

test('Python reprices every complete copied candidate and rejects forged metadata fees',async()=>{
  await rejects(record=>{firstEvent(record).incrementalCost++;},/candidate fee/);
});

test('candidate date proof independently enforces continuous unloading, TEU and executed locks',async()=>{
  await rejects(record=>{firstEvent(record).proposedDates[0].unloadDay=4;},/invalid candidate|canonical candidate|physical validity/);
  await rejects(record=>{record.nominalScenario.stagingCapacity=1;record.nominalScenario.containers[0].sizeFt=40;},/observations|staging/);
  await rejects(record=>{
    const e=record.result.plannerTrace[3].candidateDelivery.events[0];
    e.proposedDates[0].pickupDay=1;e.dates[0].pickupDay=1;
  },/invalid candidate|freeze validity/);
});

test('invalid complete copied candidate is independently reconstructed and remains rejected',async()=>{
  const record=await fixture(),m=first(record),bad=event(summarize(record.nominalScenario,'fixture',
    [rowFor(record.nominalScenario,record.nominalScenario.containers[0],2,2,3)],0),2,'locked_milp');
  bad.receivedAtMs=5;bad.copyCompletedAtMs=6;bad.auditCompletedAtMs=7;
  bad.selectionCompletedAtMs=null;bad.acceptedAtMs=null;bad.outcome='rejected_invalid';
  bad.proposedDates[0].returnDay=1;bad.dates=null;bad.incrementalCost=null;
  bad.audit={scheduleValid:false,freezeValid:true,errors:['precedence violation']};m.candidateDelivery.events.push(bad);
  const checked=await review(record);assert.equal(checked.status,0,checked.stderr);
  assert.equal(JSON.parse(checked.stdout).checked.candidateDelivery.independentlyInvalidCandidates,1);
});

test('rejection metadata cannot falsely label a feasible complete candidate invalid',async()=>{
  await rejects(record=>{
    const e=firstEvent(record);e.outcome='rejected_invalid';e.selectionCompletedAtMs=null;e.acceptedAtMs=null;
    e.audit={scheduleValid:false,freezeValid:true,errors:['fabricated invalidity']};
  },/misrepresented|physical validity/);
});

test('all copied candidate date proofs are retained, including candidates discarded for lateness',async()=>{
  await rejects(record=>{delete firstEvent(record).proposedDates;},/proof omitted/);
});

test('a late second proposal does not displace the last timely complete incumbent',async()=>{
  const record=await fixture(),m=first(record);
  m.callWallMs=250;m.candidateDelivery.events.push({sequence:2,source:'locked_milp',receivedAtMs:201,
    copyCompletedAtMs:null,auditCompletedAtMs:null,selectionCompletedAtMs:null,acceptedAtMs:null,
    outcome:'rejected_late_receipt',dates:null,incrementalCost:null,audit:null});
  const checked=await review(record);assert.equal(checked.status,0,checked.stderr);
});

test('declared MILP equal-fee replacement is accepted while constructor equal-fee replacement is rejected',async()=>{
  const record=await fixture(),m=first(record),tie=structuredClone(firstEvent(record));
  Object.assign(tie,{sequence:2,source:'locked_milp',receivedAtMs:5,copyCompletedAtMs:6,auditCompletedAtMs:7,
    selectionCompletedAtMs:8,acceptedAtMs:8});m.callWallMs=10;
  m.candidateDelivery.events.push(tie);m.candidateDelivery.selectedCandidateSequence=2;
  m.candidateDelivery.selectedAcceptanceAtMs=8;m.incumbentAcceptedAtMs=8;
  const accepted=await review(record);assert.equal(accepted.status,0,accepted.stderr);
  tie.source='locked_constructor';const rejected=await review(record);assert.notEqual(rejected.status,0);
  assert.match(rejected.stderr,/declared MILP fee tie rule/);
});

test('schedule and execution-lock validity flags are checked separately for rejected candidates',async()=>{
  const record=await fixture(),m=record.result.plannerTrace[3],bad=structuredClone(m.candidateDelivery.events[0]);
  Object.assign(bad,{sequence:2,source:'locked_milp',receivedAtMs:5,copyCompletedAtMs:6,auditCompletedAtMs:7,
    selectionCompletedAtMs:null,acceptedAtMs:null,outcome:'rejected_invalid',dates:null,incrementalCost:null,
    audit:{scheduleValid:true,freezeValid:false,errors:['pickup changed']}});
  bad.proposedDates[0].pickupDay=1;m.candidateDelivery.events.push(bad);
  const accepted=await review(record);assert.equal(accepted.status,0,accepted.stderr);
  bad.audit.scheduleValid=false;const rejected=await review(record);assert.notEqual(rejected.status,0);
  assert.match(rejected.stderr,/physical validity/);
});

test('closed gate, declared source, call identity and candidate monotonic order are required',async()=>{
  await rejects(record=>{first(record).candidateDelivery.closed=false;},/closure/);
  await rejects(record=>{firstEvent(record).source='untrusted_worker_first_incumbent';},/undeclared candidate/);
  await rejects(record=>{first(record).candidateDelivery.callId=2;},/call sequence/);
  await rejects(record=>{firstEvent(record).sequence=2;},/sequence/);
});

test('an executed decision cannot bypass the outer proof using old internal timing claims',async()=>{
  await rejects(record=>{delete first(record).candidateDelivery;first(record).firstIncumbentMs=1;},/outer-gate proof/);
});

test('parent cold wall budget remains binding even when the daily incumbent was timely',async()=>{
  await rejects(record=>{record.result.wallTimeMs=5001;},/parent budget/);
});

test('prospective declaration is expanded from metadata only and rejects seed reuse',async()=>{
  const code="import importlib.util,json; s=importlib.util.spec_from_file_location('review','scripts/review-v9.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); p=json.load(open('data/protocol-v9.json')); x=m.declared_cases(p); assert len(x)==144; assert len(set(v['seed'] for v in x))==144; p['panels'][1]['baseSeed']=391001; m.declared_cases(p)";
  // This validates only configuration expansion, never generates an order list.
  const checked=spawnSync('python3',['-c',code],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  assert.notEqual(checked.status,0);assert.match(checked.stderr,/Unseen business seeds/);
});

test('formal artifact reader refuses a SHA substitution before any prospective scenario is read',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'portplan-v9-binding-')),run=join(directory,'run'),frozen=join(directory,'frozen'),
    hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  try {
    await mkdir(join(frozen,'source/data'),{recursive:true});await mkdir(join(run,'inputs'),{recursive:true});
    const protocolBytes=await readFile(new URL('../data/protocol-v9.json',import.meta.url)),protocol=JSON.parse(protocolBytes),
      generatorBytes=await readFile(new URL('../data/protocol-v2.json',import.meta.url)),config={id:'handwritten-fixture',panel:'same-distribution'},
      hashes={'data/protocol-v9.json':hash(protocolBytes),'data/protocol-v2.json':hash(generatorBytes)};
    await writeFile(join(frozen,'source/data/protocol-v9.json'),protocolBytes);
    await writeFile(join(frozen,'source/data/protocol-v2.json'),generatorBytes);
    await writeFile(join(frozen,'manifest.json'),JSON.stringify({schemaVersion:'portplan-v9-frozen-source',protocolHash:hash(protocolBytes),
      protocol,implementationHashes:hashes,scenarioMetadata:[config]}));
    await writeFile(join(run,'inputs/handwritten.json'),JSON.stringify({nominalScenario:scenario(),events:[]}));
    const index={schemaVersion:'portplan-v9-streamed-experiment',executionState:'complete',protocolHash:hash(protocolBytes),protocol,
      frozenSource:'../frozen',implementationHashes:hashes,cases:[{...config,inputArtifact:{path:'inputs/handwritten.json',sha256:'0'.repeat(64)}}]};
    await writeFile(join(run,'complete.json'),JSON.stringify(index));
    const checked=spawnSync('python3',['scripts/review-v9.py','--run',run,'--fixture'],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
    assert.notEqual(checked.status,0);assert.match(checked.stderr,/Artifact SHA differs/);
  }finally {await rm(directory,{recursive:true,force:true});}
});
