/** PortPlan v1: official tariff parameters; explicitly synthetic order scenarios. */
export const TARIFF_VERSION = 'PNC-2026 / Maersk-KR-standard-dry / v1';
export const TARIFF_SOURCES = [
  'https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf',
  'https://www.maersk.com/local-information/asia-pacific/south-korea/import',
];
export const TARIFF_METADATA = Object.freeze({
  currency:'KRW', geography:'Busan New Port / PNC', effectiveYear:2026,
  pnc:{freeDays:4,basis:'KRW per TEU',method:'highest reached slab × all days beyond free time',slabs:[[5,7,9100],[8,9,18200],[10,14,31850],[15,null,45500]],source:TARIFF_SOURCES[0]},
  maersk:{freeDays:10,basis:'KRW per container',method:'progressive daily slabs — contract interpretation to confirm',slabs20:[[11,15,15000],[16,20,30000],[21,null,50000]],slabs40:[[11,15,30000],[16,20,50000],[21,null,90000]],source:TARIFF_SOURCES[1]},
  excludes:['VAT','negotiated free time/rates','inland carrier haulage','reefer','dangerous goods','transport prices'],
});
const DAY = 86400000;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
export const DEFAULT_TARIFF = Object.freeze({pncFreeDays:4,ddFreeDays:10,pncMultiplier:1,ddMultiplier:1,pncMode:'retroactive',ddMode:'progressive'});
export const DEFAULT_OPERATIONS = Object.freeze({returnLagDays:1,stagingUnit:'container'});
export function tariffParameters(tariff={}) { return {...DEFAULT_TARIFF,...tariff}; }
export function operationParameters(s) { return {...DEFAULT_OPERATIONS,...s.operations}; }
export function returnOffset(s,c) { return c.unloadDays-1+operationParameters(s).returnLagDays; }
export function stagingWeight(s,c) { return operationParameters(s).stagingUnit==='teu'?c.sizeFt/20:1; }
export function objectiveValue(cost, mode='joint') {
  return mode==='storageOnly'?cost.storageCost-(cost.priorStorageCost??0):mode==='ddOnly'?cost.ddCost-(cost.priorDDCost??0):cost.incrementalCost;
}
export function dateOrdinal(date) {
  if (!datePattern.test(date)) throw new Error(`Expected YYYY-MM-DD: ${date}`);
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(ms) || new Date(ms).toISOString().slice(0, 10) !== date) throw new Error(`Invalid calendar date: ${date}`);
  return ms / DAY;
}
export function addDays(date, days) { return new Date((dateOrdinal(date) + days) * DAY).toISOString().slice(0, 10); }
export function seoulDischarge(dischargeDateTime) {
  const parts=typeof dischargeDateTime==='string'&&dischargeDateTime.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|([+-])(\d{2}):(\d{2}))$/);
  if (!parts) throw new Error('dischargeDateTime requires an ISO date/time and explicit UTC offset.');
  dateOrdinal(parts[1]);
  if (Number(parts[2])>23 || Number(parts[3])>59 || Number(parts[4]||0)>59 || Number(parts[7]||0)>14 || Number(parts[8]||0)>59 || Number(parts[7])===14&&Number(parts[8])!==0) throw new Error('Invalid clock time or UTC offset in dischargeDateTime.');
  const instant = Date.parse(dischargeDateTime);
  if (!Number.isFinite(instant)) throw new Error('Invalid dischargeDateTime.');
  const local = new Date(instant + 9 * 3600000);
  return { date: local.toISOString().slice(0, 10), hour: local.getUTCHours(), minute: local.getUTCMinutes() };
}
export function storageStartDate(dischargeDateTime) {
  const local = seoulDischarge(dischargeDateTime);
  return addDays(local.date, local.hour < 8 ? 0 : 1);
}
/** Highest reached tier reprices ALL days in excess of 4 free calendar days. */
export function pncStorageCost(storageDays, sizeFt = 20, tariff = {}) {
  if (!Number.isInteger(storageDays) || storageDays < 0 || ![20,40].includes(sizeFt)) throw new Error('Invalid storageDays or sizeFt.');
  const t=tariffParameters(tariff), days=Math.max(0,storageDays-t.pncFreeDays);
  const rate=days<=3?9100:days<=5?18200:days<=10?31850:45500;
  const amount=t.pncMode==='progressive'?Math.min(3,days)*9100+Math.min(2,Math.max(0,days-3))*18200+Math.min(5,Math.max(0,days-5))*31850+Math.max(0,days-10)*45500:days*rate;
  return amount*(sizeFt/20)*t.pncMultiplier;
}
/** Progressive slab interpretation of standard combined import D&D, dry only. */
export function maerskDDCost(ddDays, sizeFt = 20, tariff = {}) {
  if (!Number.isInteger(ddDays) || ddDays < 0 || ![20,40].includes(sizeFt)) throw new Error('Invalid ddDays or sizeFt.');
  const rates = sizeFt === 20 ? [15000, 30000, 50000] : [30000, 50000, 90000];
  const t=tariffParameters(tariff),days=Math.max(0,ddDays-t.ddFreeDays);
  const amount=t.ddMode==='retroactive'?days*rates[days<=5?0:days<=10?1:2]:Math.min(5,days)*rates[0]+Math.min(5,Math.max(0,days-5))*rates[1]+Math.max(0,days-10)*rates[2];
  return amount*t.ddMultiplier;
}
export function containerCost(container, pickupDay, returnDay, horizonStart, tariff = {}) {
  const storageStart = dateOrdinal(storageStartDate(container.dischargeDateTime));
  const discharge = dateOrdinal(seoulDischarge(container.dischargeDateTime).date);
  const start = dateOrdinal(horizonStart);
  const storageDays = Math.max(0, start + pickupDay - storageStart + 1);
  const ddDays = Math.max(0, start + returnDay - discharge + 1);
  const storageCost = pncStorageCost(storageDays, container.sizeFt, tariff);
  const ddCost = maerskDDCost(ddDays, container.sizeFt, tariff);
  const priorStorageCost = pncStorageCost(Math.max(0, start - storageStart), container.sizeFt, tariff);
  const priorDDCost = maerskDDCost(Math.max(0, start - discharge), container.sizeFt, tariff);
  const sunkCost = priorStorageCost + priorDDCost;
  return { storageDays, ddDays, storageCost, ddCost, totalCost: storageCost + ddCost,
    priorStorageCost, priorDDCost, sunkCost, incrementalCost: storageCost + ddCost - sunkCost };
}
export function capacityAt(capacity, day) { return Array.isArray(capacity) ? capacity[day] : capacity; }
export function validateScenario(scenario) {
  const errors = [], warnings = [];
  if (!scenario || typeof scenario !== 'object') return { valid:false, errors:['Scenario must be an object.'], warnings };
  try { dateOrdinal(scenario.horizonStart); } catch (error) { errors.push(error.message); }
  const H = scenario.horizonDays;
  if (!Number.isInteger(H) || H < 2 || H > 31) errors.push('horizonDays must be an integer between 2 and 31.');
  if (scenario.tariff!==undefined && (!scenario.tariff || typeof scenario.tariff!=='object' || Array.isArray(scenario.tariff))) errors.push('tariff must be an object.');
  if (scenario.operations!==undefined && (!scenario.operations || typeof scenario.operations!=='object' || Array.isArray(scenario.operations))) errors.push('operations must be an object.');
  const tariff=tariffParameters(scenario.tariff), operations=operationParameters(scenario);
  for (const key of ['pncFreeDays','ddFreeDays']) if (!Number.isInteger(tariff[key]) || tariff[key]<0 || tariff[key]>365) errors.push(`${key} must be an integer from 0 to 365.`);
  for (const key of ['pncMultiplier','ddMultiplier']) if (!Number.isFinite(tariff[key]) || tariff[key]<0 || tariff[key]>100) errors.push(`${key} must be finite and between 0 and 100.`);
  for (const key of ['pncMode','ddMode']) if (!['retroactive','progressive'].includes(tariff[key])) errors.push(`${key} must be retroactive or progressive.`);
  if (![0,1].includes(operations.returnLagDays)) errors.push('returnLagDays must be 0 or 1.');
  if (!['container','teu'].includes(operations.stagingUnit)) errors.push('stagingUnit must be container or teu.');
  if (scenario.objectiveMode!==undefined && !['joint','storageOnly','ddOnly'].includes(scenario.objectiveMode)) errors.push('objectiveMode must be joint, storageOnly or ddOnly.');
  for (const key of ['truckCapacity','warehouseCapacity','stagingCapacity']) {
    const cap = scenario[key];
    if (Array.isArray(cap) ? cap.length !== H || Array.from(cap).some(x => !Number.isInteger(x) || x < 0) : !Number.isInteger(cap) || cap < 0) errors.push(`${key} must be a nonnegative integer or one integer per horizon day.`);
  }
  if (!Array.isArray(scenario.containers) || !scenario.containers.length || scenario.containers.length > 100) errors.push('Provide 1–100 containers.');
  const containers=Array.isArray(scenario.containers)?scenario.containers:[];
  const ids = new Set();
  for (const c of containers) {
    if (!c || typeof c!=='object') {errors.push('Each container must be an object.');continue;}
    if (!c.id || typeof c.id !== 'string' || ids.has(c.id)) errors.push('Container ids must be nonempty unique strings.');
    ids.add(c.id);
    if (![20,40].includes(c.sizeFt)) errors.push(`${c.id}: only 20/40-ft dry containers are supported.`);
    if (!Number.isInteger(c.releaseDay) || c.releaseDay < 0 || c.releaseDay >= H) errors.push(`${c.id}: releaseDay outside horizon.`);
    if (!Number.isInteger(c.unloadDays) || c.unloadDays < 1 || c.unloadDays >= H) errors.push(`${c.id}: unloadDays must be 1..horizonDays−1.`);
    if (!Number.isInteger(c.dueDay) || c.dueDay < 0 || c.dueDay >= H) errors.push(`${c.id}: dueDay outside horizon.`);
    if (c.releaseDay + c.unloadDays - 1 > c.dueDay) warnings.push(`${c.id}: delivery deadline cannot be met.`);
    try {
      const dischargeDay = dateOrdinal(seoulDischarge(c.dischargeDateTime).date) - dateOrdinal(scenario.horizonStart);
      if (c.releaseDay < dischargeDay) errors.push(`${c.id}: releaseDay is before vessel discharge.`);
    } catch (error) { errors.push(`${c.id}: ${error.message}`); }
    if (!['synthetic','uploaded','public-record'].includes(c.dataOrigin)) warnings.push(`${c.id}: dataOrigin is unspecified.`);
  }
  if (containers.some(c => c?.dataOrigin === 'synthetic')) warnings.push('SYNTHETIC_ORDERS: results are scenario simulation, not observed savings.');
  warnings.push('STANDARD_TARIFF_ONLY: excludes contract free-time, customs holds, reefer/DG, tax, transport prices and inland carrier haulage.');
  warnings.push(tariff.ddMode==='progressive'?'DD_PROGRESSIVE_ASSUMPTION: tier rates are accumulated progressively; confirm the applicable carrier contract before operational use.':'DD_RETROACTIVE_STRESS_ASSUMPTION: highest reached D&D rate reprices all chargeable days for sensitivity testing only.');
  if (scenario.tariff) warnings.push('TARIFF_SCENARIO_ASSUMPTIONS: overridden free time also shifts ALL slab boundaries; this research assumption is not the behavior of every negotiated free-time contract. Multipliers and billing modes are not verified contract tariffs.');
  if (operations.returnLagDays===0) warnings.push('SAME_DAY_RETURN_ASSUMPTION: intra-day trips/time windows are not modeled; same-day pickup and return use two truck movements and zero overnight staging.');
  return { valid:errors.length === 0, errors, warnings };
}
export function rowFor(s, c, p, u, r) {
  return { id:c.id, sizeFt:c.sizeFt, pickupDay:p, unloadDay:u, unloadEndDay:u+c.unloadDays-1, returnDay:r,
    pickupDate:addDays(s.horizonStart,p), unloadDate:addDays(s.horizonStart,u), returnDate:addDays(s.horizonStart,r),
    dueDay:c.dueDay, late:false, dataOrigin:c.dataOrigin, ...containerCost(c,p,r,s.horizonStart,s.tariff) };
}
export function scheduleUsage(s, rows) {
  const days = Array.from({length:s.horizonDays},(_,day) => ({day,date:addDays(s.horizonStart,day),truck:0,warehouse:0,staging:0,
    truckCapacity:capacityAt(s.truckCapacity,day),warehouseCapacity:capacityAt(s.warehouseCapacity,day),stagingCapacity:capacityAt(s.stagingCapacity,day)}));
  for (const row of rows) {
    const weight=stagingWeight(s,row);
    if (days[row.pickupDay]) days[row.pickupDay].truck++;
    if (days[row.returnDay]) days[row.returnDay].truck++;
    for (let d=row.unloadDay;d<=row.unloadEndDay;d++) if (days[d]) days[d].warehouse++;
    for (let d=row.pickupDay;d<row.returnDay;d++) if (days[d]) days[d].staging+=weight;
  }
  return days;
}
export function auditSchedule(s, rows) {
  const errors = [];
  if(!Array.isArray(rows))return {valid:false,errors:['Schedule rows must be an array.']};
  const seen = new Set();
  for (const row of rows) {
    if(!row||typeof row!=='object'){errors.push('Malformed schedule row.');continue;}
    const c = s.containers.find(c => c.id === row.id);
    if (!c || seen.has(row.id)) { errors.push(`Unknown/duplicate row ${row.id}`); continue; }
    seen.add(row.id);
    if (![row.pickupDay,row.unloadDay,row.returnDay,row.unloadEndDay].every(d=>Number.isInteger(d)&&d>=0&&d<s.horizonDays)) {errors.push(`${row.id}: noninteger or out-of-horizon day.`);continue;}
    if (row.pickupDay < c.releaseDay || row.unloadDay < row.pickupDay || row.returnDay < row.unloadDay+returnOffset(s,c) || row.returnDay >= s.horizonDays) errors.push(`${row.id}: release/precedence/horizon violated.`);
    if (row.unloadDay+c.unloadDays-1 > c.dueDay) errors.push(`${row.id}: delivery deadline violated.`);
    if (row.unloadEndDay !== row.unloadDay+c.unloadDays-1) errors.push(`${row.id}: unloadEndDay inconsistent.`);
    if (row.sizeFt!==c.sizeFt) errors.push(`${row.id}: sizeFt inconsistent with input.`);
  }
  if (seen.size !== s.containers.length) errors.push('Schedule does not cover all containers.');
  // Invalid dates must never reach occupancy loops (Infinity cannot advance).
  if(errors.length)return {valid:false,errors};
  for (const d of scheduleUsage(s,rows)) for (const key of ['truck','warehouse','staging']) if (d[key] > d[`${key}Capacity`]) errors.push(`Day ${d.day}: ${key} capacity exceeded.`);
  return {valid:errors.length===0,errors};
}
export function summarize(s, policy, rows, runtimeMs, status='feasible', extra={}) {
  const totals = Object.fromEntries(['storageCost','ddCost','totalCost','sunkCost','incrementalCost'].map(key=>[key,rows.reduce((sum,r)=>sum+r[key],0)]));
  const mode=extra.objectiveMode??s.objectiveMode??'joint';
  return { policy,status,rows,...totals,lateCount:0,runtimeMs,usage:scheduleUsage(s,rows),objectiveMode:mode,objectiveCost:rows.reduce((sum,r)=>sum+objectiveValue(r,mode),0),...extra };
}
export function bestEarliestSlot(s,c,usage) {
  const offset=returnOffset(s,c),weight=stagingWeight(s,c);
  for (let p=c.releaseDay;p<s.horizonDays;p++) {
    if (usage[p].truck >= capacityAt(s.truckCapacity,p)) continue;
    for (let u=p;u+c.unloadDays-1<=c.dueDay && u+offset<s.horizonDays;u++) {
      let warehouseOK=true;
      for (let d=u;d<u+c.unloadDays;d++) if (usage[d].warehouse>=capacityAt(s.warehouseCapacity,d)) warehouseOK=false;
      if (!warehouseOK) continue;
      for (let r=u+offset;r<s.horizonDays;r++) {
        if (usage[r].truck+1+(r===p?1:0)>capacityAt(s.truckCapacity,r)) continue;
        let stagingOK=true;
        for (let d=p;d<r;d++) if (usage[d].staging+weight>capacityAt(s.stagingCapacity,d)) stagingOK=false;
        if (stagingOK) return {p,u,r};
      }
    }
  }
  return null;
}
/** Greedy policies reserve the earliest complete feasible trip for each chosen box. */
export function solveBaseline(s, policy='fifo', options={}) {
  const start=performance.now(), rows=[], pending=[...s.containers];
  const mode=options.objectiveMode??s.objectiveMode??'joint', tariff=tariffParameters(s.tariff);
  while (pending.length) {
    const usage=scheduleUsage(s,rows);
    const candidates=pending.map(c=>({c,slot:bestEarliestSlot(s,c,usage)})).filter(v=>v.slot);
    if (!candidates.length) return { policy,status:'no_feasible_schedule_found',rows:[],partialRows:rows,totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,lateCount:null,runtimeMs:performance.now()-start,usage:[],reason:'Greedy policy could not schedule every box; this does not prove model infeasibility.' };
    const fifo=c=>Date.parse(c.dischargeDateTime);
    const freeEnd=c=>Math.min(dateOrdinal(storageStartDate(c.dischargeDateTime))+tariff.pncFreeDays-1,dateOrdinal(seoulDischarge(c.dischargeDateTime).date)+tariff.ddFreeDays-1);
    const marginal=({c,slot})=>objectiveValue(containerCost(c,slot.p+1,slot.r+1,s.horizonStart,s.tariff),mode)-objectiveValue(containerCost(c,slot.p,slot.r,s.horizonStart,s.tariff),mode);
    candidates.sort((a,b)=>policy==='earliestDeadline' ? a.c.dueDay-b.c.dueDay || fifo(a.c)-fifo(b.c) || a.c.id.localeCompare(b.c.id)
      : policy==='marginalCost' ? a.slot.p-b.slot.p || marginal(b)-marginal(a) || a.c.dueDay-b.c.dueDay || fifo(a.c)-fifo(b.c) || a.c.id.localeCompare(b.c.id)
      : policy==='earliestFreeEnd' ? freeEnd(a.c)-freeEnd(b.c) || a.c.dueDay-b.c.dueDay || fifo(a.c)-fifo(b.c) || a.c.id.localeCompare(b.c.id)
      : fifo(a.c)-fifo(b.c) || a.c.id.localeCompare(b.c.id));
    const {c,slot:{p,u,r}}=candidates[0];
    rows.push(rowFor(s,c,p,u,r)); pending.splice(pending.indexOf(c),1);
  }
  const audit=auditSchedule(s,rows);
  if (!audit.valid) throw new Error(`Internal baseline audit failed: ${audit.errors.join('; ')}`);
  return summarize(s,policy,rows,performance.now()-start,'feasible',{optimality:'heuristic',objectiveMode:mode});
}
let glpkPromise;
async function getGLPK() {
  if (!glpkPromise) glpkPromise=import('./solver-glpk.js').then(m=>m.createSolver());
  return glpkPromise;
}
export async function solveOptimized(s, options={}) {
  const {solveMILP}=await import('./solver-glpk.js');
  const glpk=await getGLPK();
  const start=performance.now();
  const result=await solveMILP(glpk,s,options);
  if (!result.decisions) return {...result,policy:'optimized',rows:[],totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,lateCount:null,runtimeMs:performance.now()-start,usage:[]};
  const rows=s.containers.map((c,i)=>rowFor(s,c,...result.decisions[i]));
  const audit=auditSchedule(s,rows);
  if (!audit.valid) throw new Error(`Internal MILP audit failed: ${audit.errors.join('; ')}`);
  return summarize(s,'optimized',rows,performance.now()-start,result.status,{optimality:result.optimality,solverStatus:result.solverStatus,solver:result.solver,modelSize:result.modelSize,objectiveMode:options.objectiveMode??s.objectiveMode??'joint',tieBreakStatus:result.tieBreakStatus,timeLimitSeconds:result.timeLimitSeconds,...(result.presolveMetadata?{presolveMetadata:result.presolveMetadata}:{}),...(result.methodVersion?{methodVersion:result.methodVersion}:{}),...(result.executionConstraints?{executionConstraints:result.executionConstraints}:{}),...(result.numericalAssurance?{numericalAssurance:result.numericalAssurance}:{})});
}
/** Product recommendation only: keep every raw policy and every solver status unchanged. */
export function selectRecommendedPolicy(s,policies,options={}) {
  const mode=options.objectiveMode??s.objectiveMode??'joint';
  const candidates=Object.entries(policies).filter(([,p])=>['optimal','feasible'].includes(p.status)&&Number.isFinite(p.totalCost)&&p.rows?.length===s.containers.length&&auditSchedule(s,p.rows).valid)
    .map(([key,p])=>({key,primary:p.rows.reduce((n,row)=>n+objectiveValue(row,mode),0),secondary:p.incrementalCost}));
  const priority=key=>key==='optimized'?0:key==='strongSearch'?1:2;
  candidates.sort((a,b)=>a.primary-b.primary||a.secondary-b.secondary||priority(a.key)-priority(b.key)||a.key.localeCompare(b.key));
  const recommendedPolicy=candidates[0]?.key??null;
  const optimizerFeasible=candidates.some(c=>c.key==='optimized');
  const fallbackUsed=recommendedPolicy!==null&&recommendedPolicy!=='optimized';
  const selectionReason=recommendedPolicy===null?'No complete audited feasible schedule was found.':recommendedPolicy==='optimized'?'The optimizer supplies the lowest-cost complete feasible schedule (optimizer preferred on ties).':!optimizerFeasible?'The optimizer returned no complete feasible schedule; recommend the best complete audited alternative.':'Another complete feasible policy has a lower objective cost than the optimizer incumbent.';
  return {recommendedPolicy,fallbackUsed,selectionReason,recommendedObjectiveMode:mode};
}
export async function solveScenario(scenario, options={}) {
  const validation=validateScenario(scenario);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  if (options.objectiveMode!==undefined && !['joint','storageOnly','ddOnly'].includes(options.objectiveMode)) throw new Error('Invalid objectiveMode.');
  const policies={};
  // Existing heuristics do not preserve executed actions; execution snapshots use
  // the locked optimizer only, never an incompatible recommendation fallback.
  if (options.fixedEvents || options.minEventDay!==undefined) {
    policies.optimized=await solveOptimized(scenario,options);
    return {scenario,policies,...selectRecommendedPolicy(scenario,policies,options),tariffVersion:TARIFF_VERSION,modelVersion:'v4-execution',warnings:validation.warnings};
  }
  for (const policy of ['fifo','earliestFreeEnd','marginalCost','earliestDeadline']) policies[policy]=solveBaseline(scenario,policy,options);
  if (options.strongSearch!==false) {
    const {solveStrongSearch}=await import('./strong-baseline.js');
    policies.strongSearch=solveStrongSearch(scenario,{...(typeof options.strongSearch==='object'?options.strongSearch:{}),objectiveMode:options.objectiveMode??scenario.objectiveMode??'joint',initialPolicies:policies});
  }
  if(options.eventSearchV4){
    const {solveEventSearch}=await import('./event-search-v4.js');
    policies.eventSearch=solveEventSearch(scenario,{...(typeof options.eventSearchV4==='object'?options.eventSearchV4:{}),initialPolicies:policies,objectiveMode:options.objectiveMode??scenario.objectiveMode??'joint'});
  }
  policies.optimized=await solveOptimized(scenario,options.presolveV4?{...options,initialPolicies:options.initialPolicies??policies}:options);
  return {scenario,policies,...selectRecommendedPolicy(scenario,policies,options),tariffVersion:TARIFF_VERSION,modelVersion:options.presolveV4?'v4':'v2',tariffParameters:tariffParameters(scenario.tariff),operations:operationParameters(scenario),warnings:validation.warnings};
}
export function makeDemoScenario(seed=42,count=12) {
  let state=(Number(seed)>>>0)||1;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const horizonStart='2026-10-12', horizonDays=14;
  return {id:`synthetic-${seed}-${count}`,name:'昌原进口提还箱 · 合成情景',seed,horizonStart,horizonDays,
    truckCapacity:4,warehouseCapacity:2,stagingCapacity:8,
    containers:Array.from({length:count},(_,i)=>{
      const age=3+Math.floor(random()*12), sizeFt=random()<.45?40:20;
      const releaseDay=random()<.25?1+Math.floor(random()*3):0;
      const unloadDays=random()<.2?2:1;
      return {id:`CW-${String(i+1).padStart(3,'0')}`,sizeFt,dischargeDateTime:`${addDays(horizonStart,-age)}T${random()<.5?'07':'10'}:00:00+09:00`,releaseDay,unloadDays,dueDay:Math.min(12,releaseDay+7+Math.floor(random()*4)),dataOrigin:'synthetic'};
    })};
}
