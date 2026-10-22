import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const script=fileURLToPath(new URL('../scripts/review-feasibility-v6.py',import.meta.url));
const clone=value=>structuredClone(value);
const tiny=(patch={})=>({horizonStart:'2026-10-12',horizonDays:3,truckCapacity:10,warehouseCapacity:10,stagingCapacity:10,
  containers:[{id:'T',sizeFt:20,dischargeDateTime:'2026-10-10T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:2}],...patch});
function explanation({trips,minimum=0,status='proven_infeasible_necessary_condition',proofKind='resource_interval_lower_bound',intervals,violations,witnesses,teu=false,...extra}){
  return {method:'v6-necessary-resource-interval-bounds',feasible:null,optimality:'not_applicable',usesOnlySuppliedScenarioAndExecutionConstraints:true,
    minEventDay:minimum,domainCounts:[{id:'T',admissibleTripCount:trips}],resourceUnits:{truck:'movements',warehouse:'slot-days',staging:teu?'TEU-days':'container-days'},
    status,proofKind,intervalsChecked:intervals,violatedBoundCount:violations,witnesses,...extra};
}
function witness(resource,fromDay,toDay,minimumRequired,availableCapacity){
  return {kind:'resource_interval_lower_bound',resource,fromDay,toDay,minimumRequired,availableCapacity,deficit:minimumRequired-availableCapacity,
    contributors:[{id:'T',minimumUsage:minimumRequired}]};
}
function sameDay(){
  return {id:'same-day',scenario:tiny({horizonDays:2,truckCapacity:[1,10],stagingCapacity:0,operations:{returnLagDays:0},containers:[{...tiny().containers[0],dueDay:0}]}),
    options:{fixedEvents:{T:{pickupDay:0,unloadDay:0,returnDay:0}}},
    explanation:explanation({trips:1,intervals:3,violations:1,witnesses:[witness('truck',0,0,2,1)]})};
}
function ongoing(){
  return {id:'ongoing-teu',scenario:tiny({horizonDays:5,warehouseCapacity:[1,0,1,1,1],stagingCapacity:[2,1,2,2,2],operations:{stagingUnit:'teu'},
    containers:[{...tiny().containers[0],sizeFt:40,unloadDays:3,dueDay:3}]}),options:{fixedEvents:{T:{pickupDay:0,unloadDay:0}},minEventDay:1},
    explanation:explanation({trips:2,minimum:1,intervals:15,violations:8,teu:true,witnesses:[
      witness('staging',1,1,2,1),witness('warehouse',1,1,1,0),
      witness('staging',0,1,4,3),witness('warehouse',0,1,2,1),
      witness('staging',1,2,4,3),witness('warehouse',1,2,2,1),
    ]})};
}
function empty(){
  return {id:'empty',scenario:tiny({containers:[{...tiny().containers[0],dueDay:0}]}),options:{minEventDay:1},
    explanation:explanation({trips:0,minimum:1,proofKind:'empty_event_domain',emptyDomainCount:1,intervals:0,violations:0,
      witnesses:[{kind:'empty_event_domain',id:'T',eventDomains:{pickup:[],unload:[],return:[1,2]}}]})};
}
function inconclusive(){
  return {id:'unknown-is-not-feasible',scenario:tiny({truckCapacity:1,warehouseCapacity:1,stagingCapacity:1,operations:{returnLagDays:0,stagingUnit:'teu'},containers:[{...tiny().containers[0],sizeFt:40}]}),
    options:{},explanation:explanation({trips:10,status:'not_proven_infeasible',proofKind:null,intervals:6,violations:0,witnesses:[],teu:true})};
}
async function review(cases){
  const directory=await mkdtemp(join(tmpdir(),'portplan-necessary-review-v6-'));
  try{
    const input=join(directory,'fixture.json');await writeFile(input,JSON.stringify({cases}));
    const process=spawnSync('python',[script,'--fixture-input',input],{encoding:'utf8',timeout:10000});
    assert.equal(process.error,undefined,process.error?.message);assert.equal(process.stderr,'');
    return {status:process.status,report:JSON.parse(process.stdout)};
  }finally{await rm(directory,{recursive:true,force:true});}
}

test('independent enumeration verifies same-day double movements, locked ongoing TEU occupancy and empty event domains',async()=>{
  const {status,report}=await review([sameDay(),ongoing(),empty()]);
  assert.equal(status,0,report.error);assert.equal(report.solverRuns,0);assert.equal(report.importsJavaScript,false);
  assert.deepEqual(report.cases.map(c=>c.audit.publishedWitnessesChecked),[1,6,1]);
  assert.equal(report.cases[0].audit.witnesses[0].minimumRequired,2);
  assert.equal(report.cases[1].audit.witnesses[0].minimumRequired,2);
  assert.equal(report.cases[2].audit.tripCount,0);
});
test('passing all necessary bounds remains unknown even in a hand-built infeasible resource interaction',async()=>{
  const fixture=inconclusive();
  // Same-day p=r exceeds truck=1; any p<r puts two TEU on staging=1.
  // Independent resource minima choose different triples and miss this conflict.
  for(let p=0;p<3;p++)for(let u=p;u<3;u++)for(let r=u;r<3;r++)assert.ok(p===r?2>fixture.scenario.truckCapacity:2>fixture.scenario.stagingCapacity);
  const {status,report}=await review([fixture]);
  assert.equal(status,0,report.error);assert.equal(report.cases[0].audit.status,'not_proven_infeasible');
  assert.equal(report.cases[0].audit.provesFeasibility,false);assert.equal(report.cases[0].audit.provesInfeasibility,false);
  const changed=clone(fixture);changed.explanation.feasible=true;
  const rejected=await review([changed]);assert.equal(rejected.status,1);assert.match(rejected.report.error,/improperly claim/);
});
test('tampered interval bounds, contribution weights and boolean counts are rejected',async()=>{
  for(const edit of [
    fixture=>{fixture.explanation.witnesses[0].minimumRequired=1;},
    fixture=>{fixture.explanation.witnesses[0].availableCapacity=2;},
    fixture=>{fixture.explanation.witnesses[0].contributors[0].minimumUsage=1;},
    fixture=>{fixture.explanation.violatedBoundCount=true;},
    fixture=>{fixture.explanation.witnesses=[];},
  ]){
    const fixture=sameDay();edit(fixture);const {status,report}=await review([fixture]);assert.equal(status,1);assert.equal(report.valid,false);
  }
});
test('wrong empty-domain projections and executing unknown boxes cannot be certified',async()=>{
  const fixture=empty();fixture.explanation.witnesses[0].eventDomains.return=[];
  let outcome=await review([fixture]);assert.equal(outcome.status,1);assert.match(outcome.report.error,/eventDomains mismatch/);
  const unknown=sameDay();unknown.options.fixedEvents.unknown={pickupDay:0};
  outcome=await review([unknown]);assert.equal(outcome.status,1);assert.match(outcome.report.error,/Unknown\/malformed lock/);
});
