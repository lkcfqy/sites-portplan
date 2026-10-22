import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const script=fileURLToPath(new URL('../scripts/review-v5.py',import.meta.url));
const methods=['rawMILP','v4EventSearch','fastEvent'],rollingMethods=['dailyReopt','stableRetain'];
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const clone=value=>structuredClone(value);
const stable=value=>Array.isArray(value)?`[${value.map(stable).join(',')}]`:value&&typeof value==='object'?`{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`:JSON.stringify(value);
const checksum=value=>'sha256:'+hash(stable(value));
const tariff={pncFreeDays:4,ddFreeDays:10,pncMultiplier:1,ddMultiplier:1,pncMode:'retroactive',ddMode:'progressive'};
const operations={returnLagDays:1,stagingUnit:'container'};
// Hand-built fixtures only. No JS pricing, planning, generator, or solver import.
const container={id:'fixture-box',sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:2,dataOrigin:'synthetic'};
const row={id:container.id,sizeFt:20,pickupDay:0,unloadDay:0,unloadEndDay:0,returnDay:1,
  storageDays:14,ddDays:15,storageCost:318500,ddCost:75000,priorStorageCost:286650,priorDDCost:45000,
  totalCost:393500,sunkCost:331650,incrementalCost:61850};
const money={storageCost:318500,ddCost:75000,totalCost:393500,sunkCost:331650,incrementalCost:61850,objectiveCost:61850};
const scenario={id:'fixture-main',seed:1,horizonStart:'2026-10-12',horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,tariff,operations,containers:[container]};
function staticPolicy(method,budget=1000){
  return {policy:method,status:method==='rawMILP'?'optimal':'feasible',optimality:method==='rawMILP'?'proven_optimal':'heuristic',solverStatus:method==='rawMILP'?5:null,
    rows:[clone(row)],...money,objectiveMode:'joint',auditValid:true,hardWallMs:budget,wallTimeMs:10,processExitWallTimeMs:11,
    endToEndCompletedWithinBudget:true,deadlineReached:false,retainedCheckpoint:false,finalReceivedMs:10,checkpointReceivedMs:null,incumbentSource:'fixture'};
}
function paired(base,candidate){
  return {baselineMethod:base,candidateMethod:candidate,pairedCaseCount:1,baselineIncrementalKRW:61850,candidateIncrementalKRW:61850,
    incrementalSavingsKRW:0,weightedIncrementalSavingsPct:0,baselineTotalKRW:393500,candidateTotalKRW:393500,
    positiveSavingsCount:0,tiedCount:1,negativeSavingsCount:0,zeroBaselineCount:0,missingBaselineCount:0,missingCandidateCount:0,worstLossKRW:0};
}
function staticSummary(){
  const zero={caseCount:0,feasibleCounts:Object.fromEntries(methods.map(method=>[method,0]))};
  return {caseCount:1,byPolicy:Object.fromEntries(methods.map(method=>[method,{caseCount:1,feasibleCount:1,provenOptimalCount:method==='rawMILP'?1:0,
    hardDeadlineCount:0,retainedCheckpointCount:0,medianWallMs:10,wallTimeMs:{median:10,p95:10,max:10},processExitWallTimeMs:{median:11,p95:11,max:11}}])),
    comparisons:{fastVsV4:paired('v4EventSearch','fastEvent'),fastVsRaw:paired('rawMILP','fastEvent'),v4VsRaw:paired('rawMILP','v4EventSearch')},
    byScale:{16:clone(zero),50:clone(zero),100:clone(zero),1:{caseCount:1,feasibleCounts:Object.fromEntries(methods.map(method=>[method,1]))}},completeSchedulesAudited:3};
}
const decisions=[{id:container.id,pickupDay:0,unloadDay:0,returnDay:1}];
function observations(day){
  return ['truck','warehouse','staging'].map(resource=>({kind:'day_start_capacity',day,resource,capacity:scenario[resource+'Capacity'],activeShockIds:[],announcements:[]}));
}
function rollingPolicy(nominal,method,{failed=false}={}){
  const timeline=[],trace=[],fixed={};
  for(let day=0;day<(failed?1:2);day++){
    const observed=clone(nominal);
    for(const resource of ['truck','warehouse','staging'])observed[resource+'Capacity']=Array(4).fill(nominal[resource+'Capacity']);
    const observedEvents=observations(day),state=[{id:container.id,phase:day===0?'awaiting_return':'returned',pickupDay:0,unloadDay:0,...(day===1?{returnDay:1}:{})}];
    const executed=day===0?[{id:container.id,event:'pickup',day:0},{id:container.id,event:'unloadStart',day:0}]:[{id:container.id,event:'return',day:1}];
    timeline.push({day,observedEvents,observationHash:checksum({scenario:observed,observedEvents,fixedEvents:clone(fixed),minEventDay:day}),
      decisions:failed?[]:clone(decisions),executedEvents:failed?[]:executed,revisionCount:0,status:failed?'planning_failed':'executed',
      plannerStatus:failed?'time_limit':'feasible',...(failed?{}:{revisions:[]}),state:failed?[{id:container.id,phase:'not_picked_up'}]:state});
    trace.push({day,decisionCalls:day+1,solverCalls:method==='dailyReopt'?day+1:1,reusedPlans:method==='dailyReopt'?0:day,replannedDueToInvalid:0,
      candidateSource:method==='dailyReopt'?'daily_solver':day===0?'solver_initial':'retained_plan',accepted:!failed,callWallMs:.5,planningWallMs:(day+1)*.5});
    if(!failed){fixed[container.id]={pickupDay:0,unloadDay:0,...(day===1?{returnDay:1}:{})};}
  }
  const latest=clone(trace.at(-1));delete latest.day;delete latest.callWallMs;
  return {policy:method,status:failed?'rolling_failed':'feasible',complete:!failed,rows:failed?[]:[clone(row)],
    ...Object.fromEntries(Object.entries(money).map(([key,value])=>[key,failed?null:value])),objectiveMode:'joint',timeLimitSeconds:.2,runtimeMs:3,
    revisionCount:0,timeline,executedEvents:timeline.flatMap(entry=>entry.executedEvents),finalState:clone(timeline.at(-1).state),
    failure:failed?{day:0,kind:'no_complete_plan',reason:'Handcrafted honest timeout'}:null,...(failed?{}:{executionThroughDay:1}),plannerStats:latest,plannerTrace:trace};
}
function rollingSummary({failed=false}={}){
  return {caseCount:1,byMethod:Object.fromEntries(rollingMethods.map(method=>[method,{caseCount:1,completeCount:failed?0:1,failureCount:failed?1:0,revisionCount:0,
    solverCalls:failed?1:method==='dailyReopt'?2:1,reusedPlans:failed?0:method==='dailyReopt'?0:1,decisionCalls:failed?1:2,planningWallMs:failed?.5:1}])),
    paired:{caseCount:failed?0:1,dailyTotalCost:failed?0:393500,stableTotalCost:failed?0:393500,stableExtraCost:0,stablePremiumPct:failed?null:0,
      dailyRevisionCount:0,stableRevisionCount:0,changeReductionPct:null,dailySolverCalls:failed?0:2,stableSolverCalls:failed?0:1,
      stableCheaperCount:0,equalCostCount:failed?0:1,stableMoreExpensiveCount:0},gainedCompletionCases:[],lostCompletionCases:[],initialPlansDifferCaseIds:[]};
}
function fixture({failed=false}={}){
  const config={id:'fixture-main',count:1,seed:1},control={id:'fixture-control3000',count:1,seed:1,referenceCaseId:config.id};
  const rollingConfig={id:'fixture-rolling',count:1,seed:2,shocks:[{id:'private-future',resource:'truck',revealDay:2,duration:2,reduction:2}]};
  const protocol={methods,primaryCases:[config],horizon:{start:'2026-10-12',days:4},defaultTariff:tariff,defaultOperations:operations,budget:{hardWallMs:1000},
    optionalScaleControl:{hardWallMs:3000,cases:[control]},rolling:{methods:rollingMethods,timeLimitSeconds:.2,cases:[rollingConfig]}};
  const protocolBytes=JSON.stringify(protocol,null,2)+'\n',protocolHash=hash(protocolBytes),source='// Hand-built audit fixture, never an experiment.\n';
  const implementationHashes={'src/fixture.js':hash(source)};
  const primary={...config,scenario:clone(scenario),policies:Object.fromEntries(methods.map(method=>[method,staticPolicy(method)])),methodExecutionOrder:methods};
  const scale={...control,scenario:clone(scenario),policies:Object.fromEntries(methods.map(method=>[method,staticPolicy(method,3000)])),methodExecutionOrder:methods};
  const benchmark={executionState:'complete',protocolHash,protocol,implementationHashes,cases:[primary],summary:staticSummary(),scaleControls:{cases:[scale],summary:staticSummary()}};
  const nominal={...clone(scenario),id:rollingConfig.id,seed:2},actual=clone(nominal);
  for(const resource of ['truck','warehouse','staging'])actual[resource+'Capacity']=Array(4).fill(nominal[resource+'Capacity']);
  actual.truckCapacity=[2,2,0,0];
  const rollingCase={...rollingConfig,nominalScenario:nominal,scenario:actual,events:[{...rollingConfig.shocks[0],capacity:0}],
    policies:Object.fromEntries(rollingMethods.map(method=>[method,rollingPolicy(nominal,method,{failed})])),methodExecutionOrder:rollingMethods,
    initialComparison:{decisionsEqual:true,interpretation:'Hand-built matching initial decisions'}};
  const rolling={executionState:'complete',protocolHash,protocol:protocol.rolling,implementationHashes,cases:[rollingCase],summary:rollingSummary({failed})};
  return {protocolBytes,protocolHash,benchmark,rolling,source};
}
async function runFixture(patch=()=>{},options={}){
  const root=await mkdtemp(join(tmpdir(),'portplan-review-v5-'));
  try{
    const files=fixture(options);patch(files);
    await mkdir(join(root,'data'),{recursive:true});await mkdir(join(root,'src'),{recursive:true});
    await writeFile(join(root,'src','fixture.js'),files.source);
    await writeFile(join(root,'data','protocol-v5.json'),files.protocolBytes);
    await writeFile(join(root,'data','benchmark-v5.json'),JSON.stringify(files.benchmark));
    await writeFile(join(root,'data','rolling-v5.json'),JSON.stringify(files.rolling));
    for(const name of ['v5-first-run-source','v5-rolling-first-run-source']){
      const snapshot=join(root,'vendor','experiments',name);await mkdir(join(snapshot,'src'),{recursive:true});
      await writeFile(join(snapshot,'src','fixture.js'),files.snapshotSource??files.source);
      await writeFile(join(snapshot,'manifest.json'),JSON.stringify({implementationHashes:{'src/fixture.js':hash(files.source)}}));
    }
    if(files.native){
      await mkdir(join(root,'scripts'),{recursive:true});
      for(const name of ['certify-v4.py','certify-v5.py'])await writeFile(join(root,'scripts',name),files.source);
      const originArchiveSha256=files.nativeWrongOrigin?'0'.repeat(64):hash(await readFile(join(root,'data','benchmark-v5.json')));
      const cases=[...files.benchmark.cases,...files.benchmark.scaleControls.cases].map(({id,scenario,policies})=>({id,scenario:clone(scenario),policies:clone(policies)}));
      if(files.nativeOmitControl)cases.pop();
      if(files.nativeChangedInput)cases[0].scenario.truckCapacity=3;
      const primaryCaseIds=files.benchmark.cases.map(caseData=>caseData.id),scaleControlCaseIds=files.benchmark.scaleControls.cases.map(caseData=>caseData.id);
      const inputBytes=JSON.stringify({originArchiveSha256,protocolSha256:files.protocolHash,primaryCaseIds,scaleControlCaseIds,cases});
      const certificate={inputSha256:files.nativeWrongInputHash?'0'.repeat(64):hash(inputBytes),originArchiveSha256,
        evidenceBindings:{originArchiveSha256,protocolSha256:files.protocolHash,primaryCaseIds,scaleControlCaseIds,independentPrimaryScenarioCount:1,repeatedInputBudgetControlCount:1,
          implementationSha256:hash(files.source),wrapperSha256:files.nativeWrongImplementationHash?'0'.repeat(64):hash(files.source)},
        summary:{inputCaseCount:cases.length,caseCount:cases.length,passedCaseCount:cases.length,failedCaseCount:0,omittedCaseCount:0,
          auditedCandidateCount:cases.length*3,provenOptimalCount:0,provenInfeasibleCount:0,noCertificateCount:cases.length,solverOptimalWithNumericToleranceCount:0},
        cases:cases.map(source=>({id:source.id,valid:true,errors:[],policyAudits:Object.fromEntries(methods.map(method=>[method,{valid:true,errors:[],audited:true,independentCosts:clone(money)}])),
          certificates:{joint:{provenOptimal:false,solverOptimal:false,hasIncumbent:false,numericalAssurance:{primarySafeInteger:true},certificateStatus:'no_certificate'}}}))};
      await writeFile(join(root,'data','certificate-input-v5.json'),inputBytes);
      await writeFile(join(root,'data','certificate-v5.json'),JSON.stringify(certificate));
    }
    if(files.removeRolling)await rm(join(root,'data','rolling-v5.json'));
    const before=await readFile(join(root,'data','benchmark-v5.json'));
    const process=spawnSync('python',[script,'--root',root,'--fixture','--expected-protocol-hash',files.protocolHash],{encoding:'utf8',timeout:10000});
    assert.equal(process.error,undefined,process.error?.message);
    assert.equal(process.stderr,'',process.stderr);
    assert.ok([0,1].includes(process.status),process.stdout);
    assert.deepEqual(await readFile(join(root,'data','benchmark-v5.json')),before,'Reviewer mutated the archive');
    return {status:process.status,report:JSON.parse(process.stdout)};
  }finally{await rm(root,{recursive:true,force:true});}
}

test('stdlib second implementation reviews handcrafted fees, causal history, retention and same-input controls read-only',async()=>{
  const {status,report}=await runFixture();
  assert.equal(status,0,report.error);assert.equal(report.valid,true);assert.equal(report.fixture,true);
  assert.equal(report.readOnly,true);assert.equal(report.solverRuns,0);assert.equal(report.importsMainImplementation,false);
  assert.equal(report.summary.primaryCompleteSchedulesRepriced,3);assert.equal(report.summary.controlCompleteSchedulesRepriced,3);
  assert.equal(report.summary.rollingCompleteSchedulesRepriced,2);assert.equal(report.summary.rollingTimelineEntriesChecked,4);
  assert.equal(report.summary.scaleControlsAreAdditionalIndependentSamples,false);
  assert.equal(report.rollingAudits[0].methods.dailyReopt.solverCalls,2);assert.equal(report.rollingAudits[0].methods.stableRetain.reusedPlans,1);
  assert.equal(report.rollingRecomputedComparison.baselineIncrementalKRW,61850);
  assert.equal(report.nativeVerification.status,'not_provided');
});
test('required results missing or incomplete fail explicitly without producing a successful review',async()=>{
  let outcome=await runFixture(files=>{files.removeRolling=true;});
  assert.equal(outcome.status,1);assert.match(outcome.report.error,/Missing required archived evidence/);
  outcome=await runFixture(files=>{files.benchmark.executionState='running';});
  assert.equal(outcome.status,1);assert.match(outcome.report.error,/Unfinished V5 archive/);
});
test('changed per-box costs and a failed plan priced as zero are rejected',async()=>{
  let outcome=await runFixture(files=>{files.benchmark.cases[0].policies.fastEvent.rows[0].storageCost+=1;});
  assert.equal(outcome.status,1);assert.match(outcome.report.error,/fixture-box\/storageCost/);
  outcome=await runFixture(files=>{files.rolling.cases[0].policies.stableRetain.totalCost=0;},{failed:true});
  assert.equal(outcome.status,1);assert.match(outcome.report.error,/null fees/);
});
test('control input identity and denominator summary corruption are rejected',async()=>{
  let outcome=await runFixture(files=>{files.benchmark.scaleControls.cases[0].scenario.truckCapacity=3;});
  assert.equal(outcome.status,1);assert.match(outcome.report.error,/identical reference input/);
  outcome=await runFixture(files=>{files.benchmark.summary.comparisons.fastVsRaw.pairedCaseCount=2;});
  assert.equal(outcome.status,1);assert.match(outcome.report.error,/pairedCaseCount/);
  outcome=await runFixture(files=>{delete files.benchmark.summary.comparisons.fastVsRaw;});
  assert.equal(outcome.status,1);assert.match(outcome.report.error,/pairwise comparison omitted/);
});
test('a future realization cannot replace the information available to the planner',async()=>{
  const outcome=await runFixture(files=>{
    const episode=files.rolling.cases[0],entry=episode.policies.stableRetain.timeline[0];
    entry.observationHash=checksum({scenario:episode.scenario,observedEvents:entry.observedEvents,fixedEvents:{},minEventDay:0});
  });
  assert.equal(outcome.status,1);assert.match(outcome.report.error,/causal observation hash mismatch/);
});
test('executed dates cannot move and stable retention cannot invent a fresh solver call',async()=>{
  let outcome=await runFixture(files=>{files.rolling.cases[0].policies.stableRetain.timeline[1].decisions[0].pickupDay=1;files.rolling.cases[0].policies.stableRetain.timeline[1].decisions[0].unloadDay=1;files.rolling.cases[0].policies.stableRetain.timeline[1].decisions[0].returnDay=2;});
  assert.equal(outcome.status,1);assert.match(outcome.report.error,/changed executed pickupDay/);
  outcome=await runFixture(files=>{files.rolling.cases[0].policies.stableRetain.plannerStats.solverCalls=2;});
  assert.equal(outcome.status,1);assert.match(outcome.report.error,/solverCalls mismatch/);
  outcome=await runFixture(files=>{files.rolling.cases[0].policies.stableRetain.plannerTrace[1].candidateSource='solver_replan';});
  assert.equal(outcome.status,1);assert.match(outcome.report.error,/stable trigger violated/);
});
test('late optimum proofs, wrong frozen protocol hashes and changed source snapshots fail binding checks',async()=>{
  let outcome=await runFixture(files=>{files.benchmark.cases[0].policies.rawMILP.finalReceivedMs=1001;});
  assert.equal(outcome.status,1);assert.match(outcome.report.error,/late final result/);
  outcome=await runFixture(files=>{files.benchmark.protocolHash='0'.repeat(64);});
  assert.equal(outcome.status,1);assert.match(outcome.report.error,/protocol hash mismatch/);
  outcome=await runFixture(files=>{files.snapshotSource='// tampered source\n';});
  assert.equal(outcome.status,1);assert.match(outcome.report.error,/Source snapshot mismatch/);
});
test('honest failed rolling episodes retain history and null complete fees without creating a paired denominator',async()=>{
  const {status,report}=await runFixture(()=>{},{failed:true});
  assert.equal(status,0,report.error);assert.equal(report.summary.rollingCompleteSchedulesRepriced,0);
  assert.equal(report.summary.rollingTimelineEntriesChecked,2);assert.equal(report.rollingRecomputedComparison.pairedCaseCount,0);
  assert.equal(report.rollingRecomputedComparison.weightedIncrementalSavingsPct,null);
});
test('optional native verification binds both flattened input and the original archive, including repeated controls',async()=>{
  let outcome=await runFixture(files=>{files.native=true;});
  assert.equal(outcome.status,0,outcome.report.error);
  assert.equal(outcome.report.nativeVerification.status,'bound_and_consistent');
  assert.equal(outcome.report.nativeVerification.primaryCaseCount,1);
  assert.equal(outcome.report.nativeVerification.sameInputControlCaseCount,1);
  assert.equal(outcome.report.nativeVerification.controlsAreAdditionalIndependentSamples,false);
  for(const key of ['nativeWrongOrigin','nativeChangedInput','nativeOmitControl','nativeWrongInputHash','nativeWrongImplementationHash']){
    outcome=await runFixture(files=>{files.native=true;files[key]=true;});
    assert.equal(outcome.status,1,key+' unexpectedly passed');
    assert.match(outcome.report.error,/Native|native/);
  }
});
