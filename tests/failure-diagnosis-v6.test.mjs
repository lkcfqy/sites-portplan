import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const script=fileURLToPath(new URL('../scripts/diagnose-failures-v6.py',import.meta.url));
const clone=value=>structuredClone(value);
const tiny=(patch={})=>({horizonStart:'2026-10-12',horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,
  containers:[{id:'T',sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:2}],...patch});
async function diagnose(cases,args=[]){
  const directory=await mkdtemp(join(tmpdir(),'portplan-lock-diagnosis-v6-'));
  try{
    const input=join(directory,'fixtures.json');await writeFile(input,JSON.stringify({cases}));
    const process=spawnSync('python',[script,'--fixture-input',input,'--time-limit','1',...args],{encoding:'utf8',timeout:15000});
    assert.equal(process.error,undefined,process.error?.message);assert.equal(process.stderr,'');
    return {status:process.status,report:JSON.parse(process.stdout)};
  }finally{await rm(directory,{recursive:true,force:true});}
}

test('independent locked model fixes historical events exactly and bounds all unexecuted events',async()=>{
  const scenario=tiny();
  const {status,report}=await diagnose([
    {id:'initial',scenario},
    {id:'picked-and-unloaded',scenario,fixedEvents:{T:{pickupDay:0,unloadDay:0}},minEventDay:1},
    {id:'picked-only',scenario,fixedEvents:{T:{pickupDay:0}},minEventDay:1},
    {id:'nothing-executed',scenario,minEventDay:2},
  ]);
  assert.equal(status,0,report.error);
  const proofs=Object.fromEntries(report.models.map(model=>[model.id,model.certificate]));
  assert.equal(proofs.initial.objectiveCost,61850);
  assert.equal(proofs['picked-and-unloaded'].objectiveCost,61850);
  assert.equal(proofs['picked-and-unloaded'].rows[0].pickupDay,0);
  assert.equal(proofs['picked-and-unloaded'].rows[0].unloadDay,0);
  assert.equal(proofs['picked-only'].objectiveCost,91850);
  assert.equal(proofs['picked-only'].rows[0].pickupDay,0);
  assert.ok(proofs['picked-only'].rows[0].unloadDay>=1);
  assert.equal(proofs['nothing-executed'].objectiveCost,349350);
  assert.ok(['pickupDay','unloadDay','returnDay'].every(key=>proofs['nothing-executed'].rows[0][key]>=2));
  for(const proof of Object.values(proofs)){
    assert.equal(proof.incumbentAudit.valid,true);assert.equal(proof.incumbentAudit.locksChecked,true);
    assert.equal(proof.solverThreads,1);assert.equal(proof.solverStatus,0);assert.equal(proof.relativeGap,0);
  }
});
test('ongoing unloading cannot disappear after a warehouse shock even when the full hindsight order set is feasible',async()=>{
  const scenario=tiny({horizonDays:5,warehouseCapacity:[1,0,1,1,1],containers:[{...tiny().containers[0],unloadDays:2,dueDay:3}]});
  const {status,report}=await diagnose([
    {id:'hindsight',scenario},
    {id:'already-unloading',scenario,fixedEvents:{T:{pickupDay:0,unloadDay:0}},minEventDay:1},
  ]);
  assert.equal(status,0,report.error);
  const [global,locked]=report.models.map(model=>model.certificate);
  assert.equal(global.hasIncumbent,true);assert.equal(global.objectiveCost,151850);
  assert.equal(locked.provenInfeasible,true);assert.equal(locked.solverStatus,2);
  assert.equal(locked.proofType,'HiGHS_model_infeasible');assert.ok(locked.modelSize.lockedLegalColumns>0);
  assert.equal(locked.objectiveCost,null);assert.equal(locked.lowerBound,null);
  assert.deepEqual(locked.rows,[]);
});
test('empty locked trip domains have explicit analytic evidence and null objective rather than fake zero fees',async()=>{
  const scenario=tiny({horizonDays:3,containers:[{...tiny().containers[0],dueDay:0}]});
  const {status,report}=await diagnose([{id:'missed-deadline',scenario,minEventDay:1}]);
  assert.equal(status,0,report.error);
  const proof=report.models[0].certificate;
  assert.equal(proof.provenInfeasible,true);assert.equal(proof.solverStatus,null);
  assert.equal(proof.proofType,'empty_legal_locked_trip_domain');
  assert.deepEqual(proof.infeasibilityEvidence.emptyDomainContainerIds,['T']);
  assert.equal(proof.objectiveCost,null);assert.equal(proof.lowerBound,null);
});
test('future pseudo-history, malformed locks and unknown boxes reject before native solving',async()=>{
  for(const patch of [
    {fixedEvents:{T:{pickupDay:1}},minEventDay:1},
    {fixedEvents:{unknown:{pickupDay:0}},minEventDay:1},
    {fixedEvents:{T:{unexpected:0}},minEventDay:1},
    {fixedEvents:[],minEventDay:1},
    {fixedEvents:{T:{pickupDay:false}},minEventDay:1},
    {minEventDay:1.5},
  ]){
    const {status,report}=await diagnose([{id:'bad-history',scenario:tiny(),...clone(patch)}]);
    assert.equal(status,1);assert.equal(report.valid,false);
  }
});
test('an extremely small native budget is unresolved and never called infeasible without proof',async()=>{
  const scenario=tiny({horizonDays:14,truckCapacity:3,warehouseCapacity:2,stagingCapacity:6,
    containers:Array.from({length:12},(_,index)=>({...tiny().containers[0],id:`C${index}`,dueDay:10}))});
  const {status,report}=await diagnose([{id:'tiny-budget',scenario}],['--time-limit','0.000001']);
  assert.equal(status,0,report.error);
  const proof=report.models[0].certificate;
  assert.equal(proof.status,'time_limit');assert.equal(proof.provenInfeasible,false);
  assert.equal(proof.hasIncumbent,false);assert.equal(proof.certificateStatus,'no_certificate');
  assert.equal(proof.objectiveCost,null);assert.deepEqual(proof.rows,[]);
});
