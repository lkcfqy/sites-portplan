import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const certifier=fileURLToPath(new URL('../scripts/certify-v4.py',import.meta.url));
const clone=value=>structuredClone(value);
async function certify(cases,args=[]) {
  const directory=await mkdtemp(join(tmpdir(),'portplan-certificate-v4-'));
  const input=join(directory,'input.json'),output=join(directory,'certificate.json');
  try {
    await writeFile(input,JSON.stringify({cases}));
    const result=spawnSync('python',[certifier,'--input',input,'--output',output,...args],{encoding:'utf8',timeout:30000});
    assert.equal(result.error,undefined,result.error?.message);
    assert.ok([0,1].includes(result.status),result.stderr||result.stdout);
    return {status:result.status,report:JSON.parse(await readFile(output,'utf8'))};
  } finally { await rm(directory,{recursive:true,force:true}); }
}

// All numerical values below are handwritten; no JS engine/model import.
function row(c,p,u,r,costs) {
  const [storageDays,ddDays,storageCost,ddCost,priorStorageCost,priorDDCost]=costs;
  return {id:c.id,sizeFt:c.sizeFt,pickupDay:p,unloadDay:u,unloadEndDay:u+c.unloadDays-1,returnDay:r,
    storageDays,ddDays,storageCost,ddCost,priorStorageCost,priorDDCost,
    totalCost:storageCost+ddCost,sunkCost:priorStorageCost+priorDDCost,
    incrementalCost:storageCost+ddCost-priorStorageCost-priorDDCost};
}
function policy(rows,objectiveMode='joint',status='optimal') {
  const totals=Object.fromEntries(['storageCost','ddCost','totalCost','sunkCost','incrementalCost'].map(key=>[key,rows.reduce((sum,r)=>sum+r[key],0)]));
  const objectiveCost=rows.reduce((sum,r)=>sum+(objectiveMode==='storageOnly'?r.storageCost-r.priorStorageCost:objectiveMode==='ddOnly'?r.ddCost-r.priorDDCost:r.incrementalCost),0);
  return {status,rows,...totals,objectiveMode,objectiveCost};
}
function pairedCase() {
  const containers=[20,40].map(sizeFt=>({id:`box-${sizeFt}`,sizeFt,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:0}));
  const scenario={horizonStart:'2026-10-12',horizonDays:3,truckCapacity:[2,2,0],warehouseCapacity:[2,0,0],stagingCapacity:[3,0,0],operations:{returnLagDays:1,stagingUnit:'teu'},containers};
  // Pickup: 14 storage days; return: 15 D&D days. Prior accrual: 13 days.
  const rows=[row(containers[0],0,0,1,[14,15,318500,75000,286650,45000]),
              row(containers[1],0,0,1,[14,15,637000,150000,573300,90000])];
  return {id:'forced-paired-size',scenario,policies:{optimized:policy(rows)}};
}
function clockCase() {
  const containers=[
    {id:'before-eight',sizeFt:20,dischargeDateTime:'2026-10-05T22:00:00Z',releaseDay:0,unloadDays:1,dueDay:0},
    {id:'at-eight',sizeFt:40,dischargeDateTime:'2026-10-03T23:00:00Z',releaseDay:0,unloadDays:1,dueDay:0},
  ];
  const scenario={horizonStart:'2026-10-12',horizonDays:2,truckCapacity:[4,0],warehouseCapacity:[2,0],stagingCapacity:0,operations:{returnLagDays:0,stagingUnit:'teu'},containers};
  // Seoul 07:00 begins storage that day; 08:00 begins the following day.
  const rows=[row(containers[0],0,0,0,[7,7,27300,0,18200,0]),
              row(containers[1],0,0,0,[8,9,145600,0,54600,0])];
  return {id:'seoul-cutoff-and-same-day',scenario,policies:{optimized:policy(rows)}};
}
function overrideCase() {
  const container={id:'override-40',sizeFt:40,dischargeDateTime:'2026-09-29T10:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:0};
  const scenario={horizonStart:'2026-10-12',horizonDays:3,truckCapacity:[1,1,0],warehouseCapacity:1,stagingCapacity:2,operations:{stagingUnit:'teu'},
    tariff:{pncFreeDays:6,ddFreeDays:8,pncMultiplier:1.5,ddMultiplier:.5,pncMode:'progressive',ddMode:'retroactive'},containers:[container]};
  // Progressive PNC: (3*9100+2*18200+2*31850)*2*1.5 = 382200.
  // Retroactive D&D: 7*50000*.5 = 175000; prior D&D is 5*30000*.5.
  const rows=[row(container,0,0,1,[13,15,382200,175000,286650,75000])];
  return {id:'declared-tariff-overrides',scenario,policies:{joint:policy(rows),storage:policy(rows,'storageOnly'),dd:policy(rows,'ddOnly')}};
}

test('independent trip certificate matches hand-calculated 20/40 sizes, capacities, tariff modes and all objectives',async()=>{
  const {status,report}=await certify([pairedCase(),clockCase(),overrideCase()]);
  assert.equal(status,0);
  assert.equal(report.summary.failedCaseCount,0);
  assert.equal(report.summary.provenOptimalCount,5);
  assert.equal(report.implementation.independentOfJavaScriptEngine,true);
  assert.equal(report.implementation.thirdPartyCertification,false);
  const [paired,clock,overrides]=report.cases;
  assert.equal(paired.certificates.joint.objectiveCost,185550);
  assert.equal(paired.certificates.joint.lowerBound,185550);
  assert.equal(paired.policyAudits.optimized.usage[0].staging,3);
  assert.equal(clock.certificates.joint.objectiveCost,100100);
  assert.equal(clock.policyAudits.optimized.usage[0].truck,4);
  assert.equal(clock.policyAudits.optimized.usage[0].staging,0);
  assert.equal(overrides.certificates.joint.objectiveCost,195550);
  assert.equal(overrides.certificates.storageOnly.objectiveCost,95550);
  assert.equal(overrides.certificates.ddOnly.objectiveCost,100000);
  assert.equal(overrides.certificates.joint.relativeGap,0);
  assert.ok(overrides.certificates.joint.wallSeconds>=overrides.certificates.joint.solverWallSeconds);
});

test('per-container tampering is rejected even when equal and opposite errors preserve aggregate costs',async()=>{
  const altered=pairedCase(),rows=altered.policies.optimized.rows;
  rows[0].storageCost+=9100; rows[1].storageCost-=9100;
  const {status,report}=await certify([altered]);
  assert.equal(status,1);
  assert.equal(report.summary.failedCaseCount,1);
  assert.match(report.cases[0].errors.join(';'),/box-20: storageCost/);
  assert.match(report.cases[0].errors.join(';'),/box-40: storageCost/);
});

test('capacity and precedence tampering are independently rejected; failure costs cannot be zero',async()=>{
  const capacity=pairedCase();capacity.id='teu-capacity';capacity.scenario.stagingCapacity=[2,0,0];
  const precedence=pairedCase();precedence.id='early-return';precedence.policies.optimized.rows[0].returnDay=0;
  const failed=clockCase();failed.id='false-zero';failed.policies={optimized:{status:'time_limit',rows:[],totalCost:0,incrementalCost:0}};
  const {status,report}=await certify([capacity,precedence,failed]);
  assert.equal(status,1);
  assert.equal(report.summary.failedCaseCount,3);
  assert.match(report.cases[0].errors.join(';'),/staging capacity exceeded/);
  assert.equal(report.cases[0].certificates.joint.certificateStatus,'proven_infeasible');
  assert.match(report.cases[1].errors.join(';'),/precedence violated/);
  assert.match(report.cases[2].errors.join(';'),/failed plan has no cost/);
});

test('honest infeasibility and timeout results retain null costs; sampled omissions are disclosed',async()=>{
  const infeasible=pairedCase();infeasible.id='honest-infeasible';infeasible.scenario.containers[0].releaseDay=1;
  infeasible.policies={optimized:{status:'infeasible',rows:[],totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null}};
  const timeout=clockCase();timeout.id='honest-timeout';timeout.policies={optimized:{status:'time_limit',rows:[],totalCost:null,incrementalCost:null}};
  const {status,report}=await certify([infeasible,timeout,pairedCase()],['--max-cases','2']);
  assert.equal(status,0);
  assert.equal(report.summary.inputCaseCount,3);
  assert.equal(report.summary.caseCount,2);
  assert.equal(report.summary.omittedCaseCount,1);
  assert.equal(report.summary.provenInfeasibleCount,1);
  assert.equal(report.cases[0].certificates.joint.objectiveCost,null);
  assert.equal(report.cases[0].certificates.joint.lowerBound,null);
  assert.equal(report.cases[1].policyAudits.optimized.objectiveCost,null);
  assert.equal(report.cases[1].policyAudits.optimized.audited,false);
});

test('an incorrect optimality claim fails while the same valid heuristic plan is allowed',async()=>{
  const container={id:'later',sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:2};
  const scenario={horizonStart:'2026-10-12',horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,containers:[container]};
  // Delayed pickup crosses the PNC retroactive jump: 11*45500 = 500500.
  const rows=[row(container,1,1,2,[15,16,500500,105000,286650,45000])];
  const inaccurate={id:'incorrect-optimal',scenario,policies:{optimized:policy(rows)}};
  const honest=clone(inaccurate);honest.id='honest-heuristic';honest.policies.optimized.status='feasible';
  const {status,report}=await certify([inaccurate,honest]);
  assert.equal(status,1);
  assert.match(report.cases[0].errors.join(';'),/differs from independent optimum/);
  assert.equal(report.cases[0].certificates.joint.objectiveCost,61850);
  assert.equal(report.cases[1].valid,true);
  assert.equal(report.cases[1].policyAudits.optimized.certificateComparison.status,'bounds_consistent');
});

test('a tiny HiGHS budget reports absence of a certificate without inventing an incumbent',async()=>{
  const scenario={horizonStart:'2026-10-12',horizonDays:14,truckCapacity:3,warehouseCapacity:2,stagingCapacity:6,
    containers:Array.from({length:12},(_,i)=>({id:`limit-${i}`,sizeFt:i%2?40:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:10}))};
  const {status,report}=await certify([{id:'tiny-budget',scenario,policies:{optimized:{status:'time_limit',rows:[],totalCost:null,incrementalCost:null}}}],['--time-limit','0.000001']);
  assert.equal(status,0);
  const certificate=report.cases[0].certificates.joint;
  assert.equal(certificate.status,'time_limit');
  assert.equal(certificate.certificateStatus,'no_certificate');
  assert.equal(certificate.objectiveCost,null);
  assert.equal(certificate.hasIncumbent,false);
  assert.equal(certificate.provenOptimal,false);
  assert.deepEqual(certificate.rows,[]);
  assert.equal(report.summary.noCertificateCount,1);
});

test('malformed scenario data returns a failed report instead of entering the solver',async()=>{
  const malformed=pairedCase();malformed.scenario.tariff={ddFreeDays:1.5};malformed.scenario.containers[0].id='box-40';
  const {status,report}=await certify([malformed]);
  assert.equal(status,1);
  assert.match(report.cases[0].errors.join(';'),/ddFreeDays/);
  assert.match(report.cases[0].errors.join(';'),/unique/);
  assert.deepEqual(report.cases[0].certificates,{});
});

test('tiny floating-point objectives expose numerical tolerance instead of falsely verifying exact optimality',async()=>{
  const containers=[
    {id:'A20',sizeFt:20,dischargeDateTime:'2026-10-04T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:2},
    {id:'B40',sizeFt:40,dischargeDateTime:'2026-09-27T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:2},
  ];
  const scenario={horizonStart:'2026-10-12',horizonDays:4,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,
    tariff:{pncMultiplier:1e-12,ddMultiplier:1},objectiveMode:'storageOnly',containers};
  // Delaying A20 gives primary 2.093e-7, worse than the reversed order's 2.002e-7.
  // The difference is smaller than ordinary solver feasibility tolerances.
  const rows=[row(containers[0],1,1,2,[10,11,191100e-12,15000,72800e-12,0]),
              row(containers[1],0,0,1,[16,17,1092000e-12,250000,1001000e-12,150000])];
  const {status,report}=await certify([{id:'tiny-floating-primary',scenario,policies:{claimed:policy(rows,'storageOnly')}}]);
  assert.equal(status,0);
  const certificate=report.cases[0].certificates.storageOnly;
  assert.equal(certificate.numericalAssurance.primarySafeInteger,false);
  assert.equal(certificate.provenOptimal,false);
  assert.equal(certificate.solverOptimal,true);
  assert.equal(certificate.certificateStatus,'solver_optimal_with_numeric_tolerance');
  assert.equal(report.cases[0].policyAudits.claimed.certificateComparison.status,'bounds_consistent_with_numeric_tolerance');
  assert.equal(report.summary.provenOptimalCount,0);
  assert.equal(report.summary.solverOptimalWithNumericToleranceCount,1);
  assert.equal(certificate.numericalAssurance.boundComparisonTolerance.absolute,1e-6);
});
