import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { solveBaseline, solveOptimized, validateScenario } from '../src/engine.js';

export const PROTOCOL_SHA256='78df5813a7cffe35ef51461c88649d2461e8676fb489c047e66830190c7a70f8';
const protocolBytes=await readFile(new URL('../data/protocol-v2.json',import.meta.url));
export const protocolV2=JSON.parse(protocolBytes);
export const POLICY_NAMES=['fifo','earliestFreeEnd','marginalCost','earliestDeadline','strongSearch','optimized'];
const DAY_MS=86400000, EPS=1e-6;
const sensitivityCaveat='Changes to free days translate all tier boundaries in this research model. This is a hypothetical stress assumption, not a verified carrier contract extension rule; some carrier terms retain original calendar-tier boundaries.';
const dateAt=(start,offset)=>new Date(Date.parse(`${start}T00:00:00Z`)+offset*DAY_MS).toISOString().slice(0,10);

/** Frozen, independently seeded synthetic generator. No real order records. */
export function makeScenarioV2(config) {
  let state=Number(config.seed)>>>0;
  const draw=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const n=config.count, start=protocolV2.horizon.start;
  const capacities=config.capacityProfile==='balanced'?[Math.ceil(n/4),Math.ceil(n/5),Math.ceil(n/2)]:[Math.ceil(n/6),Math.ceil(n/8),Math.ceil(n/4)];
  const containers=Array.from({length:n},(_,index)=>{
    const sizeFt=draw()<.45?40:20, durationDraw=draw(), unloadDays=durationDraw<.70?1:durationDraw<.95?2:3;
    let releaseDay,dischargeDay,slack;
    if(config.mechanism==='aged-backlog') {dischargeDay=-(3+Math.floor(draw()*14));releaseDay=Math.floor(draw()*4);slack=3+Math.floor(draw()*5);}
    else if(config.mechanism==='new-arrivals') {releaseDay=Math.floor(draw()*9);dischargeDay=releaseDay-(draw()<.75?0:1);slack=2+Math.floor(draw()*4);}
    else if(config.mechanism==='batch-release') {releaseDay=[0,4,7][Math.floor(draw()*3)];dischargeDay=releaseDay-(2+Math.floor(draw()*5));slack=2+Math.floor(draw()*4);}
    else throw new Error(`Unknown mechanism ${config.mechanism}`);
    const hour=draw()<.5?'07':'10';
    return {id:`${config.id}-C${String(index+1).padStart(3,'0')}`,sizeFt,unloadDays,releaseDay,
      dischargeDateTime:`${dateAt(start,dischargeDay)}T${hour}:00:00+09:00`,dueDay:Math.min(12,releaseDay+unloadDays-1+slack),dataOrigin:'synthetic'};
  });
  return {id:config.id,name:`V2 ${config.mechanism} / ${config.capacityProfile} / ${n}`,seed:config.seed,
    horizonStart:start,horizonDays:protocolV2.horizon.days,truckCapacity:capacities[0],warehouseCapacity:capacities[1],stagingCapacity:capacities[2],
    tariff:{...protocolV2.defaultTariff},operations:{...protocolV2.defaultOperations},containers};
}

/** Internal independent implementation: no engine pricing/date/capacity helpers. */
export function independentCostsV2(s,c,row) {
  const t={...protocolV2.defaultTariff,...s.tariff};
  const horizon=Date.parse(`${s.horizonStart}T00:00:00Z`)/DAY_MS;
  const local=new Date(Date.parse(c.dischargeDateTime)+9*3600000);
  const discharge=Math.floor(local.valueOf()/DAY_MS),storageStart=discharge+(local.getUTCHours()>=8?1:0);
  const storageDays=Math.max(0,horizon+row.pickupDay-storageStart+1),ddDays=Math.max(0,horizon+row.returnDay-discharge+1);
  function charge(totalDays,freeDays,ends,rates,mode,multiplier) {
    const chargeable=Math.max(0,totalDays-freeDays);
    if(mode==='retroactive') return chargeable*rates[ends.findIndex(end=>chargeable<=end)]*multiplier;
    let result=0;for(let day=1;day<=chargeable;day++) result+=rates[ends.findIndex(end=>day<=end)];
    return result*multiplier;
  }
  const storage=days=>charge(days,t.pncFreeDays,[3,5,10,Infinity],[9100,18200,31850,45500],t.pncMode,t.pncMultiplier*c.sizeFt/20);
  const dd=days=>charge(days,t.ddFreeDays,[5,10,Infinity],c.sizeFt===20?[15000,30000,50000]:[30000,50000,90000],t.ddMode,t.ddMultiplier);
  const storageCost=storage(storageDays),ddCost=dd(ddDays),priorStorageCost=storage(Math.max(0,horizon-storageStart)),priorDDCost=dd(Math.max(0,horizon-discharge));
  return {storageDays,ddDays,storageCost,ddCost,priorStorageCost,priorDDCost,totalCost:storageCost+ddCost,sunkCost:priorStorageCost+priorDDCost,
    incrementalCost:storageCost+ddCost-priorStorageCost-priorDDCost};
}

export function independentAuditV2(s,result) {
  const errors=[],rows=result.rows;
  if(!Array.isArray(rows)||rows.length!==s.containers.length) return ['Missing scheduled containers'];
  const byId=new Map(s.containers.map(c=>[c.id,c])),seen=new Set();
  const usage=Array.from({length:s.horizonDays},()=>[0,0,0]);
  const totals={storageCost:0,ddCost:0,totalCost:0,sunkCost:0,incrementalCost:0};
  const operations={...protocolV2.defaultOperations,...s.operations};
  for(const row of rows) {
    const c=byId.get(row.id);
    if(!c||seen.has(row.id)) {errors.push(`Unknown/duplicate ${row.id}`);continue;}
    seen.add(row.id);const p=row.pickupDay,u=row.unloadDay,r=row.returnDay;
    if(![p,u,r].every(day=>Number.isInteger(day)&&day>=0&&day<s.horizonDays)) {errors.push(`${row.id}: invalid calendar index`);continue;}
    if(p<c.releaseDay||u<p||r<u+c.unloadDays-1+operations.returnLagDays) errors.push(`${c.id}: precedence`);
    if(u+c.unloadDays-1>c.dueDay) errors.push(`${c.id}: deadline`);
    if(row.unloadEndDay!==u+c.unloadDays-1) errors.push(`${c.id}: unloadEndDay`);
    usage[p][0]++;usage[r][0]++;
    for(let day=u;day<u+c.unloadDays;day++) {if(usage[day])usage[day][1]++;else errors.push(`${c.id}: unload outside horizon`);}
    for(let day=p;day<r;day++) usage[day][2]+=operations.stagingUnit==='teu'?c.sizeFt/20:1;
    const costs=independentCostsV2(s,c,row);
    for(const [key,value] of Object.entries(costs)) if(!Number.isFinite(row[key])||Math.abs(row[key]-value)>EPS) errors.push(`${c.id}: ${key} expected ${value}, received ${row[key]}`);
    for(const key of Object.keys(totals))totals[key]+=costs[key];
  }
  if(seen.size!==s.containers.length) errors.push('Container coverage mismatch');
  for(let day=0;day<s.horizonDays;day++) for(const [index,key] of ['truckCapacity','warehouseCapacity','stagingCapacity'].entries()) {
    const cap=Array.isArray(s[key])?s[key][day]:s[key];if(usage[day][index]>cap)errors.push(`Day ${day}: ${key}`);
  }
  for(const [key,value] of Object.entries(totals))if(!Number.isFinite(result[key])||Math.abs(result[key]-value)>EPS)errors.push(`Total ${key} mismatch`);
  return errors;
}

export function repriceV2(s,result,tariff={}) {
  const target={...s,tariff:{...protocolV2.defaultTariff,...tariff}};
  const totals={storageCost:0,ddCost:0,totalCost:0,sunkCost:0,incrementalCost:0};
  for(const row of result.rows) {
    const c=s.containers.find(c=>c.id===row.id);const costs=independentCostsV2(target,c,row);
    for(const key of Object.keys(totals))totals[key]+=costs[key];
  }
  return totals;
}
export function isFeasibleV2(result) {
  return Boolean(result&&result.auditValid!==false&&['feasible','optimal','time_limit'].includes(result.status)&&result.rows?.length&&Number.isFinite(result.totalCost));
}

export function compareV2(results,baselineNames=POLICY_NAMES.filter(key=>key!=='optimized')) {
  const eligible=baselineNames.filter(key=>isFeasibleV2(results[key])).sort((a,b)=>results[a].incrementalCost-results[b].incrementalCost||POLICY_NAMES.indexOf(a)-POLICY_NAMES.indexOf(b));
  const bestBaseline=eligible[0]??null;
  if(!bestBaseline||!isFeasibleV2(results.optimized))return {bestBaseline,paired:false,incrementalSavingsKRW:null,incrementalSavingsPct:null,totalSavingsPct:null};
  const base=results[bestBaseline],opt=results.optimized;
  return {bestBaseline,paired:true,baselineIncrementalKRW:base.incrementalCost,optimizedIncrementalKRW:opt.incrementalCost,
    incrementalSavingsKRW:base.incrementalCost-opt.incrementalCost,incrementalSavingsPct:base.incrementalCost===0?null:100*(base.incrementalCost-opt.incrementalCost)/base.incrementalCost,
    baselineTotalKRW:base.totalCost,optimizedTotalKRW:opt.totalCost,totalSavingsPct:base.totalCost===0?null:100*(base.totalCost-opt.totalCost)/base.totalCost};
}
function pairedSummary(cases,baselineNames) {
  const comparisons=cases.map(c=>compareV2(c.policies,baselineNames)),paired=comparisons.filter(c=>c.paired);
  const sum=key=>paired.reduce((n,c)=>n+c[key],0);
  const baselineIncrementalKRW=sum('baselineIncrementalKRW'),optimizedIncrementalKRW=sum('optimizedIncrementalKRW');
  const baselineTotalKRW=sum('baselineTotalKRW'),optimizedTotalKRW=sum('optimizedTotalKRW');
  return {caseCount:cases.length,pairedCaseCount:paired.length,noFeasibleBaselineCount:comparisons.filter(c=>!c.bestBaseline).length,
    noFeasibleOptimizedCount:cases.filter(c=>!isFeasibleV2(c.policies.optimized)).length,zeroBaselineCount:paired.filter(c=>c.baselineIncrementalKRW===0).length,
    positiveSavingsCount:paired.filter(c=>c.incrementalSavingsKRW>EPS).length,tiedCount:paired.filter(c=>Math.abs(c.incrementalSavingsKRW)<=EPS).length,
    negativeSavingsCount:paired.filter(c=>c.incrementalSavingsKRW< -EPS).length,baselineIncrementalKRW,optimizedIncrementalKRW,incrementalSavingsKRW:baselineIncrementalKRW-optimizedIncrementalKRW,
    weightedIncrementalSavingsPct:baselineIncrementalKRW===0?null:100*(baselineIncrementalKRW-optimizedIncrementalKRW)/baselineIncrementalKRW,
    baselineTotalKRW,optimizedTotalKRW,weightedTotalSavingsPct:baselineTotalKRW===0?null:100*(baselineTotalKRW-optimizedTotalKRW)/baselineTotalKRW,
    worstLossKRW:Math.max(0,...paired.map(c=>-c.incrementalSavingsKRW))};
}
function timingSummary(values) {
  const sorted=[...values].sort((a,b)=>a-b),n=sorted.length;
  return {sum:sorted.reduce((a,b)=>a+b,0),median:n?(n%2?sorted[(n-1)/2]:(sorted[n/2-1]+sorted[n/2])/2):null,p95:n?sorted[Math.ceil(.95*n)-1]:null,max:n?sorted[n-1]:null};
}
export function summarizeV2(cases) {
  const byPolicy=Object.fromEntries(POLICY_NAMES.map(policy=>{
    const results=cases.map(c=>c.policies[policy]),statuses={};for(const r of results)statuses[r.status]=(statuses[r.status]??0)+1;
    const feasibleCount=results.filter(isFeasibleV2).length;
    return [policy,{caseCount:results.length,feasibleCount,feasibleRate:results.length?feasibleCount/results.length:null,statuses,
      provenOptimalCount:results.filter(r=>r.status==='optimal'&&isFeasibleV2(r)).length,auditFailureCount:results.filter(r=>r.auditValid===false).length,
      wallTimeMs:timingSummary(results.map(r=>r.wallTimeMs??r.runtimeMs??0)),engineRuntimeMs:timingSummary(results.map(r=>r.runtimeMs??0))}];
  }));
  return {...pairedSummary(cases),againstStrongSearch:pairedSummary(cases,['strongSearch']),byPolicy,
    independentAudit:{checkedFeasibleSchedules:cases.reduce((n,c)=>n+Object.keys(c.audits).length,0),failedSchedules:cases.reduce((n,c)=>n+Object.values(c.audits).filter(a=>a.length).length,0)},
    byMechanism:Object.fromEntries([...new Set(cases.map(c=>c.mechanism))].map(key=>[key,pairedSummary(cases.filter(c=>c.mechanism===key))])),
    byCapacity:Object.fromEntries([...new Set(cases.map(c=>c.capacityProfile))].map(key=>[key,pairedSummary(cases.filter(c=>c.capacityProfile===key))]))};
}

async function runPolicies(s,{objectiveMode='joint'}={}) {
  const validation=validateScenario(s);if(!validation.valid)throw new Error(validation.errors.join('; '));
  const {solveStrongSearch}=await import('../src/strong-baseline.js');
  const policies={},audits={};
  for(const policy of POLICY_NAMES) {
    const started=performance.now();
    try {
      if(policy==='optimized')policies[policy]=await solveOptimized(s,{timeLimitSeconds:protocolV2.budgets.milpTimeLimitSeconds,objectiveMode});
      else if(policy==='strongSearch')policies[policy]=solveStrongSearch(s,{...protocolV2.budgets.strongSearch,seed:s.seed,objectiveMode});
      else policies[policy]=solveBaseline(s,policy,{objectiveMode});
    } catch(error) {
      policies[policy]={policy,status:'error',rows:[],totalCost:null,incrementalCost:null,runtimeMs:performance.now()-started,reason:String(error.stack??error)};
    }
    policies[policy].wallTimeMs=performance.now()-started;
    if(isFeasibleV2(policies[policy])) {
      audits[policy]=independentAuditV2(s,policies[policy]);policies[policy].auditValid=audits[policy].length===0;
    }
  }
  const comparison=compareV2(policies);
  return {policies,audits,comparison,bestBaseline:comparison.bestBaseline,warnings:validation.warnings};
}

function changedFraction(reference,candidate) {
  if(!isFeasibleV2(reference)||!isFeasibleV2(candidate))return null;
  const byId=new Map(reference.rows.map(r=>[r.id,r]));let changed=0;
  for(const row of candidate.rows) {const other=byId.get(row.id);if(!other||['pickupDay','unloadDay','returnDay'].some(k=>row[k]!==other[k]))changed++;}
  return changed/candidate.rows.length;
}
export function sensitivitySummary(cases) {
  return protocolV2.sensitivityVariants.map(variant=>{
    const rows=cases.filter(c=>c.variant===variant.id),paired=rows.filter(c=>Number.isFinite(c.referenceEvaluation?.deltaVsDefaultKRW));
    const referenceExtraCostKRW=paired.reduce((n,c)=>n+c.referenceEvaluation.deltaVsDefaultKRW,0),denominator=paired.reduce((n,c)=>n+c.referenceEvaluation.defaultTotalCost,0);
    const strictPaired=paired.filter(c=>c.referenceEvaluation.strictAblationInterpretation);
    const strictReferenceExtraCostKRW=strictPaired.reduce((n,c)=>n+c.referenceEvaluation.deltaVsDefaultKRW,0),strictDenominator=strictPaired.reduce((n,c)=>n+c.referenceEvaluation.defaultTotalCost,0);
    const tieBreakStatuses={};for(const c of rows){const status=c.policies.optimized.tieBreakStatus??'not_applicable';tieBreakStatuses[status]=(tieBreakStatuses[status]??0)+1;}
    return {variant:variant.id,label:variant.label,kind:variant.kind,assumptionNote:variant.id==='freeTimeExtended'?sensitivityCaveat:variant.kind==='research-reference'?'Official standard values with disclosed Korean D&D progressive interpretation.':'Hypothetical or deliberately misspecified research variant, not asserted official.',caseCount:rows.length,pairedReferenceCount:paired.length,referenceExtraCostKRW,
      weightedReferenceExtraCostPct:denominator===0?null:100*referenceExtraCostKRW/denominator,
      strictPairedReferenceCount:strictPaired.length,strictReferenceExtraCostKRW,strictWeightedReferenceExtraCostPct:strictDenominator===0?null:100*strictReferenceExtraCostKRW/strictDenominator,
      unresolvedTieBreakCount:variant.kind==='objective-ablation'?paired.length-strictPaired.length:0,
      interpretation:variant.kind==='objective-ablation'?'All-pair values describe returned schedules. Only the strict subset with completed lexicographic tie-breaking supports an objective-contribution comparison.':'Assumption mismatch repricing under the research reference; not evidence that hypothetical tariff parameters are wrong for a real contract.',
      changedScheduleFraction:paired.length?paired.reduce((n,c)=>n+c.referenceEvaluation.changedContainerFraction,0)/paired.length:null,
      feasibleCount:rows.filter(c=>isFeasibleV2(c.policies.optimized)).length,tieBreakStatuses,
      worstReferenceExtraCostKRW:paired.length?Math.max(...paired.map(c=>c.referenceEvaluation.deltaVsDefaultKRW)):null};
  });
}

async function main() {
  const hash=createHash('sha256').update(protocolBytes).digest('hex');
  if(hash!==PROTOCOL_SHA256)throw new Error('Frozen protocol hash mismatch; do not silently change the protocol.');
  const sourceHash=createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex');
  const output={protocolVersion:protocolV2.protocolVersion,protocolHash:hash,benchmarkScriptHash:sourceHash,startedAt:new Date().toISOString(),generatedAt:null,
    executionState:'running',dataLabel:protocolV2.dataBoundary,assumptionNotes:[sensitivityCaveat,'All strongSearch calls include their own initial-policy construction time; MILP wall time includes first lazy initialization. Fixed search attempts and solver seconds are not equal CPU budgets.'],cases:[],scaleControls:{cases:[]},sensitivity:{cases:[]},summary:null};
  const save=async()=>{output.generatedAt=new Date().toISOString();output.summary=summarizeV2(output.cases);output.scaleControls.summary=summarizeV2(output.scaleControls.cases);output.sensitivity.summary=sensitivitySummary(output.sensitivity.cases);await writeFile(new URL('../data/benchmark-v2.json',import.meta.url),JSON.stringify(output,null,2)+'\n');};
  for(const config of protocolV2.primaryCases) {
    const scenario=makeScenarioV2(config),result=await runPolicies(scenario);output.cases.push({...config,scenario,...result});
    console.log(`main ${output.cases.length}/48 ${config.id}: ${result.policies.optimized.status}; strong=${result.policies.strongSearch.status}; delta=${result.comparison.incrementalSavingsKRW}`);
    if(output.cases.length%4===0)await save();
  }
  for(const config of protocolV2.scaleControls) {
    const scenario=makeScenarioV2(config),result=await runPolicies(scenario);output.scaleControls.cases.push({...config,scenario,...result});
    console.log(`scale ${output.scaleControls.cases.length}/4 ${config.id}: ${result.policies.optimized.status}; strong=${result.policies.strongSearch.status}`);
    await save();
  }
  for(const config of protocolV2.sensitivityBases) {
    const base=makeScenarioV2(config);let reference;
    for(const variant of protocolV2.sensitivityVariants) {
      const scenario=structuredClone(base);scenario.tariff={...protocolV2.defaultTariff,...variant.tariff};
      const result=await runPolicies(scenario,{objectiveMode:variant.objectiveMode}),optimized=result.policies.optimized;
      if(variant.id==='default')reference=optimized;
      let referenceEvaluation=null;
      if(isFeasibleV2(optimized)) {
        const repriced=repriceV2(scenario,optimized),referenceFeasible=isFeasibleV2(reference);
        referenceEvaluation={definition:'Schedule generated under variant assumptions, repriced at default joint research tariff. Difference is an assumption/ablation loss, not achieved business savings. Schedule changes can include equal-cost ties.',...repriced,
          defaultTotalCost:referenceFeasible?reference.totalCost:null,deltaVsDefaultKRW:referenceFeasible?repriced.totalCost-reference.totalCost:null,
          deltaVsDefaultPct:referenceFeasible&&reference.totalCost!==0?100*(repriced.totalCost-reference.totalCost)/reference.totalCost:null,changedContainerFraction:changedFraction(reference,optimized),
          tieBreakStatus:optimized.tieBreakStatus??'not_applicable',strictAblationInterpretation:variant.kind!=='objective-ablation'||optimized.tieBreakStatus==='optimal'};
      }
      output.sensitivity.cases.push({...config,id:`${config.id}--${variant.id}`,baselineScenarioId:config.id,variant:variant.id,variantLabel:variant.label,kind:variant.kind,assumptionNote:variant.id==='freeTimeExtended'?sensitivityCaveat:variant.kind,objectiveMode:variant.objectiveMode,scenario,...result,referenceEvaluation});
      console.log(`sensitivity ${output.sensitivity.cases.length}/56 ${config.id}/${variant.id}: ${optimized.status}; extra=${referenceEvaluation?.deltaVsDefaultKRW}`);
    }
    await save();
  }
  output.executionState='complete';await save();
  console.log(JSON.stringify(output.summary,null,2));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
