import test from 'node:test';
import assert from 'node:assert/strict';
import {createSolver,buildMILP,solveMILP} from '../src/solver-glpk.js';
import {auditSchedule,rowFor} from '../src/engine.js';
import {presolveEventDomains} from '../src/solver-presolver.js';

const tiny=(containers=[{}],extra={})=>({id:'v4-oracle',horizonStart:'2026-10-12',horizonDays:4,
  truckCapacity:2,warehouseCapacity:1,stagingCapacity:2,
  containers:containers.map((c,i)=>({id:`V${i}`,sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',
    releaseDay:0,unloadDays:1,dueDay:2,dataOrigin:'synthetic',...c})),...extra});

/** Independent day-by-day fee sums, trip enumeration and resource checking. */
function oracle(s,mode='joint') {
  const t={pncFreeDays:4,ddFreeDays:10,pncMultiplier:1,ddMultiplier:1,pncMode:'retroactive',ddMode:'progressive',...s.tariff};
  const op={returnLagDays:1,stagingUnit:'container',...s.operations},cap=(v,d)=>Array.isArray(v)?v[d]:v;
  const costs=(c,[p,u,r])=>{
    const start=Date.parse(s.horizonStart+'T00:00:00Z')/86400000;
    const local=new Date(Date.parse(c.dischargeDateTime)+9*3600000),discharge=Math.floor(local.valueOf()/86400000);
    const storageStart=discharge+(local.getUTCHours()>=8?1:0);
    const charge=(days,free,mode,rates,multiplier)=>{
      const excess=Math.max(0,days-free),rate=d=>rates[d<=3?0:d<=5?1:d<=10?2:3];
      let amount=0;for(let d=1;d<=excess;d++)amount+=rate(mode==='retroactive'?excess:d);return amount*multiplier;
    };
    const storage=day=>charge(Math.max(0,start+day-storageStart+1),t.pncFreeDays,t.pncMode,[9100,18200,31850,45500],c.sizeFt/20*t.pncMultiplier);
    const dd=day=>{
      const excess=Math.max(0,start+day-discharge+1-t.ddFreeDays),rates=c.sizeFt===20?[15000,30000,50000]:[30000,50000,90000];
      let amount=0;for(let d=1;d<=excess;d++){const k=t.ddMode==='retroactive'?excess:d;amount+=rates[k<=5?0:k<=10?1:2];}return amount*t.ddMultiplier;
    };
    const storageInc=storage(p)-storage(-1),ddInc=dd(r)-dd(-1);
    return {primary:mode==='storageOnly'?storageInc:mode==='ddOnly'?ddInc:storageInc+ddInc,total:storageInc+ddInc};
  };
  const choices=s.containers.map(c=>{
    const a=[];for(let p=c.releaseDay;p<s.horizonDays;p++)for(let u=p;u+c.unloadDays-1<=c.dueDay;u++)
      for(let r=u+c.unloadDays-1+op.returnLagDays;r<s.horizonDays;r++)a.push([p,u,r]);return a;
  });
  const schedules=[];
  function visit(i,decisions) {
    if(i<s.containers.length){for(const trip of choices[i])visit(i+1,[...decisions,trip]);return;}
    for(let d=0;d<s.horizonDays;d++) {
      let truck=0,warehouse=0,staging=0;
      decisions.forEach(([p,u,r],j)=>{truck+=(p===d)+(r===d);warehouse+=u<=d&&d<u+s.containers[j].unloadDays;
        staging+=(p<=d&&d<r)?(op.stagingUnit==='teu'?s.containers[j].sizeFt/20:1):0;});
      if(truck>cap(s.truckCapacity,d)||warehouse>cap(s.warehouseCapacity,d)||staging>cap(s.stagingCapacity,d))return;
    }
    const total=decisions.reduce((sum,row,j)=>{const cost=costs(s.containers[j],row);return {primary:sum.primary+cost.primary,total:sum.total+cost.total};},{primary:0,total:0});
    schedules.push({decisions,...total});
  }
  visit(0,[]);schedules.sort((a,b)=>a.primary-b.primary||a.total-b.total);return schedules;
}
const candidate=(s,decisions)=>({status:'feasible',rows:s.containers.map((c,i)=>rowFor(s,c,...decisions[i]))});

test('V4 cutoff preserves all feasible schedules up to the audited bound and every lexicographic optimum',async()=>{
  const glpk=await createSolver();
  const cases=[
    tiny([{}, {sizeFt:40}]),
    tiny([{unloadDays:2},{releaseDay:1}],{horizonDays:5,truckCapacity:[2,1,2,1,2],stagingCapacity:1}),
    tiny([{sizeFt:40},{}],{operations:{returnLagDays:0,stagingUnit:'teu'},stagingCapacity:2}),
    tiny([{}],{operations:{returnLagDays:0},stagingCapacity:0,truckCapacity:[0,2,2,0]}),
    tiny([{},{}],{tariff:{pncMode:'progressive',ddMode:'retroactive',pncMultiplier:.7,ddMultiplier:1.5}}),
    tiny([{},{}],{tariff:{pncMultiplier:0,ddMultiplier:0}}),
    tiny([{sizeFt:40}],{operations:{stagingUnit:'teu'},stagingCapacity:1}),
  ];
  for(const s of cases)for(const mode of ['joint','storageOnly','ddOnly']) {
    const expected=oracle(s,mode),baseline=expected.length?candidate(s,expected.at(-1).decisions):null;
    const options={presolveV4:true,objectiveMode:mode,timeLimitSeconds:2,initialPolicies:baseline?{oracleBaseline:baseline}:{}};
    const built=buildMILP(glpk,s,options),actual=await solveMILP(glpk,s,options);
    if(!expected.length){assert.equal(actual.status,'infeasible');continue;}
    for(const schedule of expected.filter(x=>x.primary<=baseline.rows.reduce((sum,row)=>sum+(mode==='storageOnly'?row.storageCost-row.priorStorageCost:mode==='ddOnly'?row.ddCost-row.priorDDCost:row.incrementalCost),0)+1e-6)) {
      schedule.decisions.forEach((trip,i)=>trip.forEach((day,k)=>assert.ok(built.event[i][['x','y','z'][k]].some(v=>v.day===day),'a feasible schedule at/below cutoff lost an event')));
    }
    assert.equal(actual.status,'optimal');
    const match=expected.find(x=>JSON.stringify(x.decisions)===JSON.stringify(actual.decisions));assert.ok(match);
    assert.ok(Math.abs(match.primary-expected[0].primary)<1e-6);
    assert.ok(Math.abs(match.total-expected[0].total)<1e-6);
    assert.equal(auditSchedule(s,candidate(s,actual.decisions).rows).valid,true);
  }
});

test('safe reductions remove unsupported event days and expensive conditional events without a warm-start claim',async()=>{
  const glpk=await createSolver(),s=tiny([{}],{truckCapacity:[2,0,2,2],warehouseCapacity:[1,0,1,1]});
  const base=buildMILP(glpk,s),prepared=presolveEventDomains(s,base.event,{initialPolicies:{best:candidate(s,[[0,0,2]])}});
  assert.ok(prepared.metadata.unsupportedEventsRemoved>0);assert.ok(prepared.metadata.boundEventsRemoved>0);
  assert.ok(prepared.metadata.retainedBinaries<prepared.metadata.originalBinaries);assert.equal(prepared.metadata.isWarmStart,false);
  assert.equal(prepared.metadata.upperBoundSource,'best');
  assert.equal(prepared.event[0].x.some(v=>v.day===1),false);
});

test('baseline costs are recalculated; invalid, partial and malformed baselines cannot create a cutoff',async()=>{
  const glpk=await createSolver(),s=tiny(),base=buildMILP(glpk,s),valid=candidate(s,[[1,1,2]]);
  for(const row of valid.rows)for(const key of ['storageCost','ddCost','incrementalCost','totalCost'])row[key]=-1e30;
  const invalid=candidate(s,[[0,0,0]]);
  const result=presolveEventDomains(s,base.event,{initialPolicies:{valid,invalid,partial:{rows:[]},malformed:{rows:{}},nullRow:{rows:[null]}}});
  assert.equal(result.metadata.auditedCandidateCount,1);assert.equal(result.metadata.upperBoundSource,'valid');
  assert.equal(result.metadata.feasibleUpperBound,candidate(s,[[1,1,2]]).rows[0].incrementalCost);
  assert.deepEqual(result.metadata.rejectedCandidates,['invalid','partial','malformed','nullRow']);
  const empty=presolveEventDomains(s,base.event,{initialPolicies:{invalid}});
  assert.equal(empty.cutoff,null);assert.equal(empty.metadata.boundEventsRemoved,0);
  const restricted=base.event.map(e=>({...e,x:e.x.filter(v=>v.day===2)}));
  const outsideDomain=presolveEventDomains(s,restricted,{initialPolicies:{valid}});
  assert.equal(outsideDomain.cutoff,null);assert.deepEqual(outsideDomain.metadata.rejectedCandidates,['valid']);
});

test('lower-bound certificate proves a feasible zero-fee 100-container schedule without inventing a GLPK incumbent',async()=>{
  const glpk=await createSolver();
  const s=tiny(Array.from({length:100},()=>({dueDay:2,dischargeDateTime:'2026-10-12T07:00:00+09:00'})),
    {truckCapacity:100,warehouseCapacity:100,stagingCapacity:100});
  const result=await solveMILP({...glpk,solve:()=>{throw new Error('GLPK must not be invoked for a complete exact certificate');}},s,
    {presolveV4:true,timeLimitSeconds:2,initialPolicies:{zeroFee:candidate(s,s.containers.map(()=>[0,0,1]))}});
  assert.equal(result.status,'optimal');assert.equal(result.optimality,'proven_optimal');assert.equal(result.solverStatus,null);
  assert.equal(result.methodVersion,'v4-independent-bound-certificate');assert.match(result.solver,/GLPK not invoked/);
  assert.equal(result.presolveMetadata.certificate.objective,0);assert.equal(result.presolveMetadata.certificate.lowerBound,0);
  assert.equal(result.decisions.length,100);
});

test('a near-equal bound is not an optimality certificate and a timeout stays a timeout',async()=>{
  const glpk=await createSolver(),s=tiny([{}],{tariff:{pncMultiplier:1e-14,ddMultiplier:0}});
  const result=await solveMILP({...glpk,solve:()=>({result:{status:glpk.GLP_UNDEF}})},s,
    {presolveV4:true,initialPolicies:{slightlyWorse:candidate(s,[[1,1,2]])}});
  assert.equal(result.presolveMetadata.certificate,null);assert.equal(result.status,'time_limit');
  assert.equal(result.optimality,'not_proven');assert.equal(result.decisions,undefined);
});

test('fractional cost arithmetic is not issued an exact bound certificate even at the separate minimum',async()=>{
  const glpk=await createSolver(),s=tiny([{}],{tariff:{pncMultiplier:1e-8,ddMultiplier:0}});
  const result=await solveMILP({...glpk,solve:()=>({result:{status:glpk.GLP_UNDEF}})},s,
    {presolveV4:true,initialPolicies:{minimum:candidate(s,[[0,0,1]])}});
  assert.equal(result.presolveMetadata.exactBoundCertificateEligible,false);
  assert.equal(result.presolveMetadata.certificate,null);assert.equal(result.status,'time_limit');
});

test('primary certificate does not skip a required secondary solve',async()=>{
  const glpk=await createSolver(),s=tiny([{}],{tariff:{pncMultiplier:0}}),expected=oracle(s,'storageOnly');
  let calls=0;const traced={...glpk,solve:(...args)=>{calls++;return glpk.solve(...args);}};
  const result=await solveMILP(traced,s,{presolveV4:true,objectiveMode:'storageOnly',timeLimitSeconds:2,
    initialPolicies:{lateReturn:candidate(s,[[0,0,3]])}});
  assert.equal(calls,2);assert.equal(result.tieBreakStatus,'optimal');
  assert.deepEqual(result.decisions,expected[0].decisions);
});

test('V4 stays opt-in and disables its reducer explicitly for rolling event constraints',async()=>{
  const glpk=await createSolver(),s=tiny(),original=buildMILP(glpk,s);
  assert.equal(original.presolveMetadata,undefined);assert.equal(original.model.name,'PortPlan_v2');
  assert.equal(original.model.subjectTo.some(row=>row.name==='audited_feasible_objective_cutoff'),false);
  for(const locks of [{fixedEvents:{}},{minEventDay:1}]) {
    const actual=buildMILP(glpk,s,{presolveV4:true,...locks});
    assert.equal(actual.presolveMetadata.enabled,false);assert.equal(actual.presolveMetadata.reason,'rolling_event_constraints_not_supported');
  }
});
