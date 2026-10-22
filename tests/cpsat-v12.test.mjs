import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createCPSATPlanner} from '../scripts/cpsat-planner-v12.mjs';

const tiny=(extra={})=>({id:'cpsat-v12-handwritten',horizonStart:'2026-10-12',horizonDays:5,truckCapacity:2,warehouseCapacity:1,stagingCapacity:1,
  containers:[{id:'A',sizeFt:20,dischargeDateTime:'2026-09-29T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:3,dataOrigin:'synthetic'}],...extra});
const opts=(extra={})=>({timeBudgetMs:2000,minEventDay:0,fixedEvents:{},objectiveMode:'joint',...extra});
async function using(configuration,callback){const p=createCPSATPlanner(configuration);try{await p.ready();return await callback(p);}finally{await p.close();}}

// Independent full tuple enumeration and direct daily ledger. No JS engine,
// old certifier, native model builder or CP-SAT formulation is imported here.
function physical(s,rows,o={}){
  const use=Array.from({length:s.horizonDays},()=>({truck:0,warehouse:0,staging:0}));
  const lag=s.operations?.returnLagDays??1;
  if(rows.length!==s.containers.length)return false;
  for(let i=0;i<rows.length;i++){
    const c=s.containers[i],{p,u,r}=rows[i],end=u+c.unloadDays-1,locks=o.fixedEvents?.[c.id]??{};
    if(![p,u,r].every(d=>Number.isInteger(d)&&d>=0&&d<s.horizonDays)||p<c.releaseDay||u<p||end>c.dueDay||r<end+lag)return false;
    for(const [key,d]of Object.entries({pickupDay:p,unloadDay:u,returnDay:r}))if(Object.hasOwn(locks,key)?d!==locks[key]:d<(o.minEventDay??0))return false;
    use[p].truck++;use[r].truck++;
    for(let d=u;d<=end;d++)use[d].warehouse++;
    for(let d=p;d<r;d++)use[d].staging+=s.operations?.stagingUnit==='teu'?c.sizeFt/20:1;
  }
  return use.every((v,d)=>Object.entries(v).every(([k,n])=>n<=(Array.isArray(s[k+'Capacity'])?s[k+'Capacity'][d]:s[k+'Capacity'])));
}
function handwrittenFee(s,c,p,r){
  const local=new Date(Date.parse(c.dischargeDateTime)+9*3600000),day=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate())/86400000,start=Date.parse(s.horizonStart+'T00:00:00Z')/86400000;
  const age=start-day,storageAge=age-Number(local.getUTCHours()>=8),t={pncFreeDays:4,ddFreeDays:10,pncMultiplier:1,ddMultiplier:1,pncMode:'retroactive',ddMode:'progressive',...s.tariff};
  const storage=days=>{const n=Math.max(0,days-t.pncFreeDays);return(c.sizeFt/20)*t.pncMultiplier*(t.pncMode==='retroactive'?n*(n<=3?9100:n<=5?18200:n<=10?31850:45500):Math.min(n,3)*9100+Math.min(Math.max(n-3,0),2)*18200+Math.min(Math.max(n-5,0),5)*31850+Math.max(n-10,0)*45500);};
  const dd=days=>{const n=Math.max(0,days-t.ddFreeDays),rates=c.sizeFt===20?[15000,30000,50000]:[30000,50000,90000];return t.ddMultiplier*(t.ddMode==='retroactive'?n*rates[n<=5?0:n<=10?1:2]:Math.min(n,5)*rates[0]+Math.min(Math.max(n-5,0),5)*rates[1]+Math.max(n-10,0)*rates[2]);};
  return storage(Math.max(0,storageAge+p+1))+dd(Math.max(0,age+r+1))-storage(Math.max(0,storageAge))-dd(Math.max(0,age));
}
function oracle(s,o={}){
  const domains=s.containers.map(c=>{const out=[];for(let p=c.releaseDay;p<s.horizonDays;p++)for(let u=p;u+c.unloadDays-1<=c.dueDay;u++)for(let r=u+c.unloadDays-1+(s.operations?.returnLagDays??1);r<s.horizonDays;r++)out.push({p,u,r});return out;});
  let minimum=null;
  function visit(rows){if(rows.length<domains.length){for(const row of domains[rows.length])visit([...rows,row]);return;}if(physical(s,rows,o)){const fee=rows.reduce((n,row,i)=>n+handwrittenFee(s,s.containers[i],row.p,row.r),0);if(minimum===null||fee<minimum)minimum=fee;}}
  visit([]);return minimum;
}

test('independent CP interval model agrees with complete tiny tuple oracle, including closures and physical past',async()=>{
  await using({retainCacheFallback:false},async planner=>{
    const base=tiny().containers[0],cases=[
      [tiny(),opts()],
      [tiny(),opts({minEventDay:2})],
      [tiny(),opts({minEventDay:2,fixedEvents:{A:{pickupDay:0}}})],
      [tiny({truckCapacity:[1,0,1,1,1]}),opts()],
      [tiny({warehouseCapacity:[0,1,0,1,0]}),opts()],
      [tiny({stagingCapacity:0}),opts()],
      [tiny({warehouseCapacity:0}),opts()],
      [tiny({stagingCapacity:0,operations:{returnLagDays:0}}),opts()],
      [tiny({stagingCapacity:0,truckCapacity:1,operations:{returnLagDays:0}}),opts()],
      [tiny({containers:[{...base,unloadDays:3}]}),opts({minEventDay:2,fixedEvents:{A:{pickupDay:0,unloadDay:0}}})],
      [tiny({warehouseCapacity:[1,0,1,1,1],containers:[{...base,unloadDays:3}]}),opts({minEventDay:2,fixedEvents:{A:{pickupDay:0,unloadDay:0}}})],
      [tiny({stagingCapacity:3,operations:{stagingUnit:'teu'},containers:[{...base,id:'A'},{...base,id:'B',sizeFt:40,unloadDays:2}]}),opts()],
      [tiny({truckCapacity:[1,2,0,2,2],warehouseCapacity:[1,1,1,1,0],stagingCapacity:2,containers:[{...base,id:'A'},{...base,id:'B',releaseDay:1}]}),opts()],
      [tiny({horizonDays:3,containers:[{...base,unloadDays:2,dueDay:1}]}),opts()],
      [tiny({horizonDays:3,containers:[{...base,unloadDays:2,dueDay:1}],operations:{returnLagDays:0}}),opts()],
      [tiny({containers:[{...base,releaseDay:3,dueDay:2}]}),opts()],
      [tiny(),opts({minEventDay:5,fixedEvents:{A:{pickupDay:0,unloadDay:0,returnDay:1}}})],
    ];
    for(const[s,o]of cases){const expected=oracle(s,o),result=await planner(s,o),native=result.plannerMetadata.nativeCertificate;
      if(expected===null){assert.equal(result.status,'infeasible',JSON.stringify({s,o,native}));assert.equal(result.totalCost,null);assert.equal(native.provenInfeasible,true);}
      else{assert.equal(result.status,'optimal',JSON.stringify(native));assert.equal(result.objectiveCost,expected);assert.equal(native.lowerBound,expected);assert.equal(native.relativeGap,0);assert.equal(native.incumbentAudit.valid,true);assert.equal(result.plannerMetadata.stages.native.independentCostsMatch,true);assert.equal(physical(s,result.rows.map(row=>({p:row.pickupDay,u:row.unloadDay,r:row.returnDay})),o),true);}
      assert.equal(native.solverThreads,1);assert.equal(native.solverSeed,0);assert.match(native.formulation,/interval/);
    }
  });
});

test('forced 20/40-ft fee totals, sunk/incremental boundary and TEU equal handwritten amounts',async()=>{
  await using({retainCacheFallback:false},async planner=>{
    const containers=[20,40].map(sizeFt=>({...tiny().containers[0],id:'box-'+sizeFt,sizeFt,dueDay:0}));
    const s=tiny({horizonDays:3,truckCapacity:[2,2,0],warehouseCapacity:[2,0,0],stagingCapacity:[3,0,0],operations:{stagingUnit:'teu'},containers});
    const result=await planner(s,opts());assert.equal(result.status,'optimal');
    assert.equal(result.storageCost,955500);assert.equal(result.ddCost,225000);assert.equal(result.totalCost,1180500);assert.equal(result.sunkCost,994950);assert.equal(result.incrementalCost,185550);
    assert.equal(result.usage[0].staging,3);assert.equal(result.usage[0].truck,2);assert.equal(result.usage[1].truck,2);
  });
});

test('Seoul 08:00 storage cutoff and same-day two truck movements are exact',async()=>{
  await using({retainCacheFallback:false},async planner=>{
    const containers=[{...tiny().containers[0],id:'before-eight',dischargeDateTime:'2026-10-05T22:00:00Z',dueDay:0},{...tiny().containers[0],id:'at-eight',sizeFt:40,dischargeDateTime:'2026-10-03T23:00:00Z',dueDay:0}];
    const s=tiny({horizonDays:2,truckCapacity:[4,0],warehouseCapacity:[2,0],stagingCapacity:0,operations:{returnLagDays:0,stagingUnit:'teu'},containers});
    const result=await planner(s,opts());assert.equal(result.status,'optimal');assert.equal(result.incrementalCost,100100);
    assert.deepEqual(result.rows.map(row=>[row.storageCost,row.priorStorageCost]),[[27300,18200],[145600,54600]]);
    assert.equal(result.usage[0].truck,4);assert.equal(result.usage[0].staging,0);
  });
});

test('declared progressive PNC and retroactive D&D stress modes are not silently replaced',async()=>{
  await using({retainCacheFallback:false},async planner=>{
    const c={...tiny().containers[0],sizeFt:40,dueDay:0,dischargeDateTime:'2026-09-29T10:00:00+09:00'};
    const s=tiny({horizonDays:3,truckCapacity:[1,1,0],warehouseCapacity:1,stagingCapacity:2,operations:{stagingUnit:'teu'},tariff:{pncFreeDays:6,ddFreeDays:8,pncMultiplier:1.5,ddMultiplier:.5,pncMode:'progressive',ddMode:'retroactive'},containers:[c]});
    const result=await planner(s,opts());assert.equal(result.status,'optimal');assert.equal(result.storageCost,382200);assert.equal(result.ddCost,175000);assert.equal(result.incrementalCost,195550);
  });
});

test('fractional fees are refused without rounding; unknown and expired calls do not claim infeasibility',async()=>{
  await using({retainCacheFallback:false},async planner=>{
    const fractional=await planner(tiny({tariff:{pncMultiplier:0.1234567}}),opts());
    assert.equal(fractional.status,'solver_error');assert.equal(fractional.totalCost,null);assert.match(fractional.plannerMetadata.nativeCertificate.reason,/integer-KRW/);
    const expired=await planner(tiny(),opts({timeBudgetMs:0.000001}));
    assert.equal(expired.status,'time_limit');assert.equal(expired.totalCost,null);assert.equal(expired.plannerMetadata.nativeCertificate?.provenInfeasible??false,false);
  });
  const fixture=fileURLToPath(new URL('./fixtures/highs-v8-service.py',import.meta.url));
  await using({servicePath:fixture,pythonExecutable:'python3',retainCacheFallback:false},async planner=>{
    const s={...tiny(),nativeFixture:{reply:{status:'time_limit',solverStatus:0,solverMessage:'UNKNOWN',hasIncumbent:false,provenOptimal:false,provenInfeasible:false,rows:[]}}};
    const unknown=await planner(s,opts());assert.equal(unknown.status,'time_limit');assert.equal(unknown.objectiveCost,null);assert.equal(unknown.plannerMetadata.nativeCertificate.solverMessage,'UNKNOWN');
  });
});

test('readiness reports isolated OR-Tools, startup is measured, and close is idempotent',async()=>{
  const planner=createCPSATPlanner();
  const first=await planner.ready(),second=await planner.ready();
  assert.equal(first.ortoolsVersion,'9.15.6755');assert.equal(first.pid,second.pid);assert.ok(first.startupWallMs>0);assert.ok(first.serviceInitializationMs>0);
  assert.equal(first.solverThreads,1);assert.equal(first.solverSeed,0);assert.equal(first.scipyVersion,undefined);
  await planner.close();await planner.close();await assert.rejects(planner(tiny(),opts()),/closed/);
});

test('late native bounds, complete optimal candidates and infeasibility proofs remain discarded telemetry only',()=>{
  const python=process.env.PORTPLAN_CPSAT_PYTHON??'/workspace/.venvs/portplan-cpsat/bin/python';
  const probe=fileURLToPath(new URL('./fixtures/cpsat-v12-deadline.py',import.meta.url));
  const result=spawnSync(python,[probe],{encoding:'utf8',timeout:10000});
  assert.equal(result.status,0,result.stderr||result.stdout);const report=JSON.parse(result.stdout);
  assert.equal(report.valid,true);assert.equal(report.solverSearchCalls,0);assert.equal(report.cases.length,3);
});
