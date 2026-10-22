import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {canonicalSeed,reconstructSnapshot,selectTasks,makeProtocol,buildJobs,createMethod,executeJob,hash,METHODS,loadFrozenProtocol} from '../scripts/mechanism-v8.mjs';

function fixture({shock=false}={}){
  const nominal={id:'hand-built',seed:19,horizonStart:'2026-10-12',horizonDays:5,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,
    containers:[{id:'T',sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:2,dueDay:3}]};
  const previous=[{id:'T',pickupDay:0,unloadDay:0,returnDay:2}],fixed={T:{pickupDay:0,unloadDay:0}},scenario=structuredClone(nominal);
  for(const resource of ['truck','warehouse','staging'])scenario[resource+'Capacity']=Array(5).fill(nominal[resource+'Capacity']);
  const observations=day=>['truck','warehouse','staging'].map(resource=>({kind:'day_start_capacity',day,resource,
    capacity:shock&&day===1&&resource==='warehouse'?0:nominal[resource+'Capacity'],activeShockIds:[],
    announcements:shock&&day===1&&resource==='warehouse'?[{id:'W',resource,revealDay:1,capacity:0}]:[]}));
  const first={day:0,observedEvents:observations(0),status:'executed',decisions:previous,
    executedEvents:[{id:'T',event:'pickup',day:0},{id:'T',event:'unloadStart',day:0}]};
  first.observationHash=hash({scenario,observedEvents:first.observedEvents,fixedEvents:{},minEventDay:0});
  if(shock)scenario.warehouseCapacity[1]=0;
  const second={day:1,observedEvents:observations(1),status:shock?'planning_failed':'executed',decisions:previous,executedEvents:[]};
  second.observationHash=hash({scenario,observedEvents:second.observedEvents,fixedEvents:fixed,minEventDay:1});
  return {id:'hand-built',nominalScenario:nominal,policies:{costPolishV7:{timeline:[first,second]}}};
}
function task(){const source=fixture(),snapshot=reconstructSnapshot(source,1);return {...snapshot,taskId:'fixture',sourceCaseId:source.id,sourceSeed:19,panel:'stratified-mechanism'};}

test('same-prefix reconstruction fixes executed work, withholds private future, and detects a changed causal hash',()=>{
  const source=fixture({shock:true}),snapshot=reconstructSnapshot(source,1);
  assert.equal(snapshot.executedEventCount,2);
  assert.deepEqual(snapshot.fixedEvents,{T:{pickupDay:0,unloadDay:0}});
  assert.equal(snapshot.previousValidNow,false);
  assert.deepEqual(snapshot.scenario.warehouseCapacity,[1,0,1,1,1]);
  source.scenario={warehouseCapacity:[0,0,0,0,0]};source.events=[{duration:99,capacity:0,revealDay:2}];
  assert.equal(reconstructSnapshot(source,1).snapshotHash,snapshot.snapshotHash);
  source.policies.costPolishV7.timeline[1].observationHash='sha256:'+'0'.repeat(64);
  assert.throws(()=>reconstructSnapshot(source,1),/SHA-256 mismatch/);
});

test('fixed retain, fixed polish, rebuild and adaptive use the same dates without a fictitious V7 cache injection',async()=>{
  const input=task(),seed=1103,options={fixedEvents:input.fixedEvents,minEventDay:1,timeBudgetMs:200,seed};
  const common=canonicalSeed(input.scenario,input.previousDates,input.fixedEvents,1).candidate;
  let recoveryCalls=0,polishCalls=0,adaptiveInitial=null;
  const dependencies={now:()=>0,createV7:()=>async()=>{recoveryCalls++;return structuredClone(common);},
    polish:(s,p)=>{polishCalls++;assert.deepEqual(p.rows,common.rows);return p;},
    createAdaptive:config=>{adaptiveInitial=config.initialDates;return async()=>structuredClone(common);}};
  const retained=await createMethod('retainOrRecoverV7',input,seed,dependencies)(input.scenario,options);
  assert.equal(retained.mechanismAction,'retain');assert.equal(recoveryCalls,0);
  await createMethod('alwaysPolishOrRecoverV7',input,seed,dependencies)(input.scenario,options);
  assert.equal(polishCalls,1);assert.equal(recoveryCalls,0);
  await createMethod('alwaysRebuildV7',input,seed,dependencies)(input.scenario,options);
  assert.equal(recoveryCalls,1);
  await createMethod('adaptiveV8',input,seed,dependencies)(input.scenario,options);
  assert.deepEqual(adaptiveInitial,input.previousDates);assert.notEqual(adaptiveInitial,input.previousDates);
});

test('invalid common dates invoke fresh recovery and cannot silently drop ongoing unloading',async()=>{
  const input={...task(),...reconstructSnapshot(fixture({shock:true}),1)};
  let called=0;
  const dependencies={now:()=>0,createV7:()=>async(s,o)=>{called++;assert.deepEqual(o.fixedEvents,input.fixedEvents);
    return {status:'no_feasible_schedule_found',rows:[],totalCost:null,incrementalCost:null};}};
  for(const method of ['retainOrRecoverV7','alwaysPolishOrRecoverV7']){
    const result=await createMethod(method,input,1103,dependencies)(input.scenario,{fixedEvents:input.fixedEvents,minEventDay:1,timeBudgetMs:200});
    assert.equal(result.status,'no_feasible_schedule_found');assert.equal(result.totalCost,null);
  }
  assert.equal(called,2);
});

test('late complete receipts retain raw evidence but have null accepted costs and no success count',async()=>{
  const input=task(),candidate=canonicalSeed(input.scenario,input.previousDates,input.fixedEvents,1).candidate;
  let clock=0;
  const result=await executeJob(input,{taskId:input.taskId,method:'alwaysRebuildV7',budgetMs:200,seed:1103,probe:false,panel:input.panel},
    {now:()=>clock,createV7:()=>async()=>{clock=201;return candidate;}});
  assert.equal(result.status,'late_complete_snapshot');assert.equal(result.completeSnapshot,false);
  assert.equal(result.totalCost,null);assert.equal(result.incrementalCost,null);assert.deepEqual(result.rows,[]);
  assert.equal(result.rawReturnedResult.rows.length,1);assert.equal(result.audit.valid,true);
});

test('frozen selection has six 2+2 strata, distinct prefixes, all four misses and only declared extra budgets',async()=>{
  const archive=JSON.parse(await readFile(new URL('../data/rolling-v7.json',import.meta.url),'utf8'));
  const diagnosis=JSON.parse(await readFile(new URL('../data/failure-diagnosis-v8.json',import.meta.url),'utf8'));
  const selected=selectTasks(archive,diagnosis),protocol=makeProtocol({archive,diagnosis,inputHashes:{}}),jobs=buildJobs(protocol,selected);
  assert.equal(selected.length,28);assert.equal(new Set(selected.map(t=>t.snapshotHash)).size,28);
  const main=selected.filter(t=>t.panel==='stratified-mechanism');
  assert.equal(main.length,24);
  for(const mechanism of ['aged-backlog','new-arrivals','batch-release'])for(const profile of ['balanced','tight']){
    const rows=main.filter(t=>t.mechanism===mechanism&&t.capacityProfile===profile);
    assert.equal(rows.filter(t=>t.snapshotKind==='ordinary').length,2);
    assert.equal(rows.filter(t=>t.snapshotKind==='capacity-announcement').length,2);
  }
  const tight=main.filter(t=>t.mechanism==='aged-backlog'&&t.capacityProfile==='tight'&&t.snapshotKind==='capacity-announcement');
  assert.deepEqual(tight.map(t=>t.executedEventCount),[43,44]);
  assert.deepEqual(tight.map(t=>t.sourceMethod),['costPolishV7','dailyReoptV4']);
  const misses=selected.filter(t=>t.panel==='observed-feasible-misses');
  assert.equal(misses.length,4);assert.equal(misses.filter(t=>t.previousDates===null).length,3);
  assert.equal(misses.find(t=>t.sourceDay===3).executedEventCount,17);
  assert.equal(jobs.length,392);
  assert.equal(jobs.filter(j=>j.probe).length,8);
  assert.ok(jobs.filter(j=>j.budgetMs===1000).every(j=>j.panel!=='stratified-mechanism'));
  for(const input of misses){
    const probe=jobs.filter(j=>j.probe&&j.taskId===input.taskId);
    assert.deepEqual(probe.map(j=>j.budgetMs),[200,1000]);assert.ok(probe.every(j=>j.seed===input.sourceSeed));
  }
  assert.deepEqual(protocol.methods,METHODS);
});

test('the concrete frozen selection reconstructs without solving and an existing result directory cannot be reused',async()=>{
  const loaded=await loadFrozenProtocol(fileURLToPath(new URL('../data/mechanism-protocol-v8.json',import.meta.url)));
  assert.equal(loaded.tasks.length,28);
  assert.equal(loaded.protocolHash,'01571193568db7e11ef7e32aa844f9ca2679b3b625ff99bc1cf3bce83f2737cc');
  const root=fileURLToPath(new URL('..',import.meta.url)),script=fileURLToPath(new URL('../scripts/mechanism-v8.mjs',import.meta.url));
  const artifactRoot=fileURLToPath(new URL('../artifacts/',import.meta.url));
  await mkdir(artifactRoot,{recursive:true});
  const directory=await mkdtemp(artifactRoot+'mechanism-no-overwrite-test-'),sentinel=directory+'/preserved.txt';
  try{
    await writeFile(sentinel,'preserved evidence');
    const process=spawnSync('node',[script,'--run','--output-dir',directory],{cwd:root,encoding:'utf8',timeout:15000});
    assert.equal(process.error,undefined,process.error?.message);assert.equal(process.status,1);
    assert.match(process.stderr,/EEXIST/);assert.equal(await readFile(sentinel,'utf8'),'preserved evidence');
  }finally{await rm(directory,{recursive:true,force:true});}
});
