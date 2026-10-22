import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { makeDemoScenario, solveScenario, TARIFF_VERSION } from '../src/engine.js';

export const protocol = Object.freeze({
  version: 'portplan-v1-fixed-24', seeds: [11, 29, 47, 83], counts: [8, 16],
  profiles: ['ample', 'typical', 'tight'], solverTimeLimitSeconds: 2,
  horizonStart: '2026-10-12', horizonDays: 14,
  dataLabel: '公开收费参数 + 合成订单；情景模拟，不是实际业务节省',
  objective: 'incrementalCost = totalCost − sunkCost',
  comparison: 'paired best feasible baseline, all predeclared cases retained',
  percentage: '100 × sum(baselineIncremental − optimizedIncremental) / sum(baselineIncremental)',
  constraints: 'same full-horizon information; hard unloading deadline; daily movement, unloading and staging limits',
});
const policies = ['fifo', 'earliestFreeEnd', 'marginalCost', 'optimized'];
const dayMs = 86400000;
const ordinal = value => Date.parse(`${value}T00:00:00Z`) / dayMs;

// Deliberately independent of the engine's tariff, date, usage and audit helpers.
export function independentlyAudit(s, result) {
  const errors = [];
  if (!Array.isArray(result.rows) || result.rows.length !== s.containers.length) return ['Missing scheduled containers'];
  const usage = Array.from({ length: s.horizonDays }, () => [0, 0, 0]);
  const seen = new Set(), totals = {storageCost:0, ddCost:0, totalCost:0, sunkCost:0, incrementalCost:0};
  const storage = (days, size) => {
    const bands = [[4,0],[7,9100],[9,18200],[14,31850],[Infinity,45500]];
    return Math.max(0,days-4) * bands.find(([last]) => days <= last)[1] * (size === 20 ? 1 : 2);
  };
  const dd = (days, size) => {
    let total = 0;
    for (let day = 11; day <= days; day++) total += size === 20 ? (day <= 15 ? 15000 : day <= 20 ? 30000 : 50000) : (day <= 15 ? 30000 : day <= 20 ? 50000 : 90000);
    return total;
  };
  for (const row of result.rows) {
    const c = s.containers.find(item => item.id === row.id);
    if (!c || seen.has(row.id)) {errors.push(`Unknown or duplicate id ${row.id}`); continue;}
    seen.add(row.id);
    const p=row.pickupDay,u=row.unloadDay,r=row.returnDay;
    if (![p,u,r].every(d=>Number.isInteger(d)&&d>=0&&d<s.horizonDays)) {errors.push(`${c.id}: day out of bounds`); continue;}
    if (p < c.releaseDay || u < p || r <= u+c.unloadDays-1) errors.push(`${c.id}: release/sequence`);
    if (u+c.unloadDays-1 > c.dueDay) errors.push(`${c.id}: deadline`);
    if (row.unloadEndDay !== u+c.unloadDays-1) errors.push(`${c.id}: unloadEndDay`);
    usage[p][0]++; usage[r][0]++;
    for(let day=u;day<u+c.unloadDays;day++) {if(usage[day]) usage[day][1]++; else errors.push(`${c.id}: unload outside horizon`);}
    for(let day=p;day<r;day++) usage[day][2]++;
    const local = new Date(Date.parse(c.dischargeDateTime) + 9*3600000);
    const dischargeDay = Math.floor(local.valueOf()/dayMs);
    const storageStart = dischargeDay + (local.getUTCHours() >= 8 ? 1 : 0);
    const start=ordinal(s.horizonStart);
    const storageDays=Math.max(0,start+p-storageStart+1), ddDays=Math.max(0,start+r-dischargeDay+1);
    const expected={storageCost:storage(storageDays,c.sizeFt),ddCost:dd(ddDays,c.sizeFt)};
    expected.totalCost=expected.storageCost+expected.ddCost;
    expected.sunkCost=storage(Math.max(0,start-storageStart),c.sizeFt)+dd(Math.max(0,start-dischargeDay),c.sizeFt);
    expected.incrementalCost=expected.totalCost-expected.sunkCost;
    for (const key of Object.keys(totals)) {
      if(row[key]!==expected[key]) errors.push(`${c.id}: ${key} expected ${expected[key]}, got ${row[key]}`);
      totals[key]+=expected[key];
    }
    if(row.storageDays!==storageDays || row.ddDays!==ddDays) errors.push(`${c.id}: charged calendar-day count`);
  }
  for(let day=0;day<s.horizonDays;day++) for(const [i,key] of ['truckCapacity','warehouseCapacity','stagingCapacity'].entries()) {
    const cap=Array.isArray(s[key])?s[key][day]:s[key];
    if(usage[day][i]>cap) errors.push(`Day ${day}: ${key}`);
  }
  for (const key of Object.keys(totals)) if (totals[key]!==result[key]) errors.push(`Total ${key} mismatch`);
  return errors;
}
export const isFeasible = result => Boolean(result && ['feasible','optimal','time_limit'].includes(result.status) && Number.isFinite(result.incrementalCost) && result.rows?.length);

export function comparePolicies(results) {
  const eligible = policies.filter(key=>key!=='optimized'&&isFeasible(results[key]));
  eligible.sort((a,b)=>results[a].incrementalCost-results[b].incrementalCost || policies.indexOf(a)-policies.indexOf(b));
  const bestBaseline = eligible[0] || null;
  if(!bestBaseline || !isFeasible(results.optimized)) return {bestBaseline,paired:false,incrementalSavingsKRW:null,incrementalSavingsPct:null};
  const base=results[bestBaseline], opt=results.optimized;
  return {bestBaseline,paired:true,baselineIncrementalKRW:base.incrementalCost,optimizedIncrementalKRW:opt.incrementalCost,
    incrementalSavingsKRW:base.incrementalCost-opt.incrementalCost,
    incrementalSavingsPct:base.incrementalCost===0?null:100*(base.incrementalCost-opt.incrementalCost)/base.incrementalCost,
    baselineTotalKRW:base.totalCost,optimizedTotalKRW:opt.totalCost,
    totalSavingsPct:base.totalCost===0?null:100*(base.totalCost-opt.totalCost)/base.totalCost};
}
export function summarizeCases(cases) {
  const paired=cases.filter(c=>c.comparison.paired);
  const sum=key=>paired.reduce((acc,c)=>acc+c.comparison[key],0);
  const baselineIncrementalKRW=sum('baselineIncrementalKRW'), optimizedIncrementalKRW=sum('optimizedIncrementalKRW');
  const baselineTotalKRW=sum('baselineTotalKRW'), optimizedTotalKRW=sum('optimizedTotalKRW');
  const byPolicy=Object.fromEntries(policies.map(policy=>{
    const results=cases.map(c=>c.policies[policy]);
    const feasible=results.filter(isFeasible);
    const statuses={}; for(const result of results) statuses[result.status]=(statuses[result.status]||0)+1;
    return [policy,{caseCount:results.length,feasibleCount:feasible.length,feasibleRate:feasible.length/results.length,statuses,
      totalRuntimeMs:results.reduce((acc,r)=>acc+r.runtimeMs,0),
      medianRuntimeMs:[...results].sort((a,b)=>a.runtimeMs-b.runtimeMs)[Math.floor(results.length/2)]?.runtimeMs || 0}];
  }));
  return {caseCount:cases.length,pairedCaseCount:paired.length,
    noFeasibleBaselineCount:cases.filter(c=>!c.comparison.bestBaseline).length,
    noFeasibleOptimizedCount:cases.filter(c=>!isFeasible(c.policies.optimized)).length,
    zeroBaselineCount:paired.filter(c=>c.comparison.baselineIncrementalKRW===0).length,
    positiveSavingsCount:paired.filter(c=>c.comparison.incrementalSavingsKRW>0).length,
    tiedCount:paired.filter(c=>c.comparison.incrementalSavingsKRW===0).length,
    negativeSavingsCount:paired.filter(c=>c.comparison.incrementalSavingsKRW<0).length,
    baselineIncrementalKRW,optimizedIncrementalKRW,incrementalSavingsKRW:baselineIncrementalKRW-optimizedIncrementalKRW,
    weightedIncrementalSavingsPct:baselineIncrementalKRW===0?null:100*(baselineIncrementalKRW-optimizedIncrementalKRW)/baselineIncrementalKRW,
    baselineTotalKRW,optimizedTotalKRW,weightedTotalSavingsPct:baselineTotalKRW===0?null:100*(baselineTotalKRW-optimizedTotalKRW)/baselineTotalKRW,
    byPolicy,independentAudit:{checkedFeasibleSchedules:cases.reduce((n,c)=>n+Object.keys(c.audits).length,0),
      failedSchedules:cases.reduce((n,c)=>n+Object.values(c.audits).filter(a=>a.length).length,0)}};
}

async function main() {
  const startedAt=new Date().toISOString(), cases=[];
  for(const count of protocol.counts) for(const profile of protocol.profiles) for(const seed of protocol.seeds) {
    const scenario=makeDemoScenario(seed,count), round=Math.ceil;
    [scenario.truckCapacity,scenario.warehouseCapacity,scenario.stagingCapacity]=profile==='ample'?[round(count/2),round(count/3),count]:profile==='typical'?[round(count/3),round(count/5),round(count/2)]:[round(count/4),round(count/8),round(count/4)];
    scenario.id=`${profile}-n${count}-seed${seed}`;
    const result=await solveScenario(scenario,{timeLimitSeconds:protocol.solverTimeLimitSeconds});
    const audits=Object.fromEntries(policies.filter(p=>isFeasible(result.policies[p])).map(p=>[p,independentlyAudit(scenario,result.policies[p])]));
    for(const [policy,errors] of Object.entries(audits)) if(errors.length) throw new Error(`${scenario.id} ${policy}: ${errors.join('; ')}`);
    const comparison=comparePolicies(result.policies);
    cases.push({id:scenario.id,profile,seed,count,scenario,policies:result.policies,bestBaseline:comparison.bestBaseline,comparison,audits});
    console.log(`${cases.length}/24 ${scenario.id}: ${result.policies.optimized.status}, paired=${comparison.paired}, delta=${comparison.incrementalSavingsKRW}`);
  }
  const controlScenario=makeDemoScenario(11,8); controlScenario.id='infeasible-zero-trucks';controlScenario.truckCapacity=0;
  const controlResult=await solveScenario(controlScenario,{timeLimitSeconds:protocol.solverTimeLimitSeconds});
  const infeasibleControl={id:controlScenario.id,description:'Zero truck movements make any nonempty schedule impossible; excluded from savings denominators.',scenario:controlScenario,policies:controlResult.policies};
  if(isFeasible(controlResult.policies.optimized)) throw new Error('Infeasible control returned a feasible result');
  const output={startedAt,generatedAt:new Date().toISOString(),tariffVersion:TARIFF_VERSION,protocol,summary:summarizeCases(cases),cases,infeasibleControl};
  await writeFile(new URL('../data/benchmark.json',import.meta.url),JSON.stringify(output,null,2)+'\n');
  console.log(JSON.stringify(output.summary,null,2));
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) await main();
