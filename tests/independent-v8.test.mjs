import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {runRollingScenario} from '../src/rolling-plan.js';
import {rowFor,summarize} from '../src/engine.js';

const scenario=()=>({id:'independent-v8-handwritten',horizonStart:'2026-10-15',horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,
  containers:[{id:'A',sizeFt:20,releaseDay:0,unloadDays:1,dueDay:2,dischargeDateTime:'2026-09-30T07:00:00+09:00',dataOrigin:'synthetic'}]});

async function fixture(){
  const nominalScenario=scenario(),trace=[];
  const result=await runRollingScenario(nominalScenario,[],{planner:async(s,o)=>{
    trace.push({day:o.minEventDay,callWallMs:0,action:o.minEventDay?'retain':'initialize'});
    return summarize(s,'fixture',[rowFor(s,s.containers[0],0,0,1)],0,'feasible');
  }});
  return {nominalScenario,events:[],result:{...result,auditValid:true,plannerTrace:trace,hardWallMs:5000,wallTimeMs:100,outputDeliveredWithinBudget:true,executionHistoryUnavailable:false,finalReceivedMs:90,receiptValidatedMs:100}};
}

async function review(record){
  const dir=await mkdtemp(join(tmpdir(),'portplan-independent-v8-'));
  try{
    const file=join(dir,'episode.json');await writeFile(file,JSON.stringify(record));
    return spawnSync('python3',['scripts/review-v8.py','--episode',file],{cwd:new URL('../',import.meta.url),encoding:'utf8'});
  }finally{await rm(dir,{recursive:true,force:true});}
}

test('independent Python reconstructs a complete causal lifecycle and all fees',async()=>{
  const output=await review(await fixture());assert.equal(output.status,0,output.stderr);
  const d=JSON.parse(output.stdout);assert.equal(d.valid,true);assert.equal(d.checked.executedEvents,3);assert.equal(d.checked.complete,true);
});

test('independent review rejects final fee tampering and omitted executed events',async()=>{
  const fee=await fixture();fee.result.totalCost+=1;assert.notEqual((await review(fee)).status,0);
  const history=await fixture();history.result.timeline[1].executedEvents=[];assert.notEqual((await review(history)).status,0);
});

test('independent review rejects altered observations and changes to locked history',async()=>{
  const observation=await fixture();observation.result.timeline[1].observedEvents[0].capacity=99;assert.notEqual((await review(observation)).status,0);
  const past=await fixture();past.result.timeline[1].decisions[0].pickupDay=1;assert.notEqual((await review(past)).status,0);
});

test('unknown histories preserve null fees and revision counts',async()=>{
  const r=await fixture();r.result={complete:false,executionHistoryUnavailable:true,status:'hard_time_limit',rows:[],timeline:[],executedEvents:[],revisionCount:null,
    hardWallMs:5000,wallTimeMs:5000,totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,objectiveCost:null,lateCount:null};
  assert.equal((await review(r)).status,0);r.result.totalCost=0;assert.notEqual((await review(r)).status,0);
});
