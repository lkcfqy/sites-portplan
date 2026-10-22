import {auditSchedule, containerCost, validateScenario} from './engine.js';
import {normalizeCapacityEvents, realizeCapacityEvents, runRollingScenario} from './rolling-plan.js';
import {explainFeasibility} from './feasibility-explanation-v6.js';

export const EXECUTION_METHODS_V8 = Object.freeze(['adaptiveV9', 'adaptiveV8', 'costPolishV7', 'stableRetainV5']);
export const EXECUTION_HARD_WALL_MS_V8 = 5000;
export const EXECUTION_SCOPE_V8 = 'Custom browser scenario simulation; known orders, causal daily capacity observations, no operational deployment or realized savings.';
const FEE_FIELDS = ['totalCost', 'incrementalCost', 'storageCost', 'ddCost', 'sunkCost', 'objectiveCost'];
const EVENT_KEYS = {pickup:'pickupDay', unloadStart:'unloadDay', return:'returnDay'};
const CONFIGURATIONS = {
  adaptiveV9:{timeBudgetMs:200},
  adaptiveV8:{timeBudgetMs:200},
  costPolishV7:{timeBudgetMs:200, constructorShare:0.4, auditReserveMs:5, maxRestarts:15, retainFeasible:true},
  stableRetainV5:{timeLimitSeconds:0.2},
};

/** Small, intentionally illustrative fixtures, never a new research panel. */
export function makeExecutionFixtureV8(kind='success') {
  if (!['success', 'failure'].includes(kind)) throw new Error('Unknown demonstration fixture.');
  const scenario = {
    id:'v8-illustrative-ten-containers-'+kind, seed:81015, horizonStart:'2026-10-15', horizonDays:14,
    truckCapacity:4, warehouseCapacity:3, stagingCapacity:6, objectiveMode:'joint',
    containers:Array.from({length:10}, (_, i) => ({
      id:'DEMO-'+String(i+1).padStart(2, '0'), sizeFt:i%3===0?40:20,
      dischargeDateTime:`2026-10-${String(2+i).padStart(2, '0')}T07:00:00+09:00`,
      releaseDay:Math.floor(i/4), unloadDays:i%3===0?2:1, dueDay:9+Math.floor(i/4), dataOrigin:'synthetic',
    })),
  };
  const events = kind==='failure'
    ? [{id:'announced-warehouse-closure', resource:'warehouse', revealDay:2, capacity:0, duration:12, announcedDuration:12}]
    : [{id:'one-day-truck-reduction', resource:'truck', revealDay:2, capacity:2, duration:1}];
  return {scenario, events, inputOrigin:'synthetic-fixture', fixture:kind,
    scope:'Illustrative synthetic ten-container example, not a benchmark or representative business sample.'};
}

/** Validate and clone at both the page/worker boundary; source labels are not authentication. */
export function prepareExecutionInputV8(value) {
  if (!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Simulation input must be an object.');
  const original = structuredClone(value.scenario), events = structuredClone(value.events??[]);
  const checked = validateScenario(original);
  if (!checked.valid) throw new Error(checked.errors.join('; '));
  // Do not carry a pasted experiment's private event fields into planner snapshots.
  const fields=['id','seed','horizonStart','horizonDays','truckCapacity','warehouseCapacity','stagingCapacity','objectiveMode','tariff','operations','containers'];
  const pick=(object,keys)=>Object.fromEntries(keys.filter(key=>Object.hasOwn(object,key)).map(key=>[key,object[key]]));
  const scenario=pick(original,fields),ignoredInputFields=Object.keys(original).filter(key=>!fields.includes(key));
  scenario.containers=original.containers.map(container=>pick(container,['id','sizeFt','dischargeDateTime','releaseDay','unloadDays','dueDay','dataOrigin']));
  if(scenario.tariff)scenario.tariff=pick(scenario.tariff,['pncFreeDays','ddFreeDays','pncMultiplier','ddMultiplier','pncMode','ddMode']);
  if(scenario.operations)scenario.operations=pick(scenario.operations,['returnLagDays','stagingUnit']);
  if ((scenario.objectiveMode??'joint')!=='joint') throw new Error('This simulation supports the joint storage and D&D objective only.');
  if (!Array.isArray(events) || events.length>128) throw new Error('Provide at most 128 capacity events.');
  const normalized = normalizeCapacityEvents(scenario, events).map(({index, ...event}) => event);
  const inputOrigin = value.inputOrigin==='synthetic-fixture'?'synthetic-fixture':'user-custom-unverified';
  scenario.objectiveMode='joint';
  for (const container of scenario.containers) container.dataOrigin=inputOrigin==='synthetic-fixture'?'synthetic':'uploaded';
  return {schemaVersion:'portplan-custom-execution-v8-input', scenario, events:normalized, inputOrigin, scope:EXECUTION_SCOPE_V8,
    normalization:{supportedDailyModelFieldsOnly:true,ignoredScenarioFields:ignoredInputFields}};
}

export function executionInputChangesV8(previous, current) {
  if (!previous) return [];
  const changes=[];
  function walk(before, after, path) {
    if (JSON.stringify(before)===JSON.stringify(after)) return;
    const a=before!==null&&typeof before==='object', b=after!==null&&typeof after==='object';
    if (a&&b&&Array.isArray(before)===Array.isArray(after)) {
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) walk(before[key], after[key], path+'.'+key);
    } else changes.push({path, before:before??null, after:after??null});
  }
  walk(previous.scenario, current.scenario, 'scenario'); walk(previous.events, current.events, 'events');
  return changes;
}

export function executionStatusV8(result) {
  if (result?.complete) return 'complete';
  if (result?.executionHistoryUnavailable) return result.status==='cancelled'?'cancelled':'unknown';
  if (result?.failureProof?.status==='proven_infeasible_necessary_condition') return 'proven_snapshot_infeasible';
  return 'no_complete_plan';
}

/** Terminal checks are repeated by the page before its parent deadline expires. */
export function auditExecutionResultV8(input, result) {
  const errors=[];
  if (!result || typeof result!=='object') return {valid:false, errors:['Missing terminal result.']};
  if (!result.complete) {
    for (const field of FEE_FIELDS) if (result[field]!==null) errors.push('Incomplete execution must retain null '+field+'.');
    return {valid:errors.length===0, errors};
  }
  const scenario=realizeCapacityEvents(input.scenario, input.events);
  const rows=result.rows;
  if (!Array.isArray(rows) || rows.length!==scenario.containers.length) return {valid:false, errors:['Terminal plan does not cover every container.']};
  for(const row of rows){
    if(!row||typeof row!=='object')errors.push('Malformed terminal row.');
    else for(const key of ['pickupDay','unloadDay','unloadEndDay','returnDay'])if(!Number.isInteger(row[key])||row[key]<0||row[key]>=scenario.horizonDays)errors.push('Invalid terminal event date '+key+'.');
  }
  if(errors.length)return {valid:false,errors};
  const audit=auditSchedule(scenario, rows); errors.push(...audit.errors);
  const totals={totalCost:0, incrementalCost:0, storageCost:0, ddCost:0, sunkCost:0};
  const containers=new Map(scenario.containers.map(c=>[c.id,c]));
  for (const row of rows) {
    const container=containers.get(row?.id);
    if (!container) continue;
    try {
      const fee=containerCost(container, row.pickupDay, row.returnDay, scenario.horizonStart, scenario.tariff);
      for (const key of Object.keys(totals)) totals[key]+=fee[key];
      for (const key of Object.keys(totals)) if (!Number.isFinite(row[key]) || Math.abs(row[key]-fee[key])>0.000001) errors.push(row.id+': row fee mismatch '+key+'.');
    } catch (error) { errors.push(String(error.message??error)); }
  }
  for (const [key, amount] of Object.entries(totals)) if (!Number.isFinite(result[key]) || Math.abs(result[key]-amount)>0.000001) errors.push('Terminal fee mismatch '+key+'.');
  if (!Number.isFinite(result.objectiveCost) || Math.abs(result.objectiveCost-totals.incrementalCost)>0.000001) errors.push('Terminal joint objective mismatch.');
  const dates=new Map(rows.map(row=>[row.id,row])), seen=new Set();
  const ledger=(result.timeline??[]).flatMap(entry=>(entry.executedEvents??[]).map(event=>({...event, recordedDay:entry.day})));
  for (const event of ledger) {
    const key=EVENT_KEYS[event.event], identity=event.id+'|'+event.event, row=dates.get(event.id);
    if (!key || !row || seen.has(identity) || row[key]!==event.day || event.day!==event.recordedDay) errors.push('Terminal physical ledger mismatch '+identity+'.');
    seen.add(identity);
  }
  if (seen.size!==scenario.containers.length*3 || ledger.length!==scenario.containers.length*3) errors.push('Terminal physical ledger is incomplete or duplicated.');
  return {valid:errors.length===0, errors, recomputedFees:totals, scope:'Daily-model terminal schedule, repricing and recorded action consistency; not an operational certification.'};
}

async function plannerFor(method) {
  if (method==='adaptiveV9') return (await import('./adaptive-planner-v9.js')).createAdaptivePlannerV9;
  if (method==='adaptiveV8') return (await import('./adaptive-planner-v8.js')).createAdaptivePlanner;
  if (method==='costPolishV7') return (await import('./cost-recovery-v7.js')).createCostRecoveryPlanner;
  return (await import('./stable-planner-v5.js')).createStablePlanner;
}

const DEBUG_KEYS=new Set(['model', 'modelObject', 'lp', 'subjectTo', 'binaries', 'vars', 'selectedTrips', 'eventDomains']);
function safeMetadata(value, depth=0) {
  if (value===null || ['string','number','boolean'].includes(typeof value)) return value;
  if (!value || typeof value!=='object' || depth>7) return null;
  if (ArrayBuffer.isView(value)) return {omittedDebugBuffer:true};
  if (Array.isArray(value)) return value.length>200?{omittedDiagnosticArrayItems:value.length}:value.map(v=>safeMetadata(v,depth+1));
  return Object.fromEntries(Object.entries(value).filter(([key])=>!DEBUG_KEYS.has(key)).map(([key,v])=>[key,safeMetadata(v,depth+1)]));
}

/** The simulator owns events. The planner callback receives snapshots/locks only. */
export async function runExecutionEpisodeV8(value, options={}) {
  const started=performance.now(), input=prepareExecutionInputV8(value), method=value.method;
  if (!EXECUTION_METHODS_V8.includes(method)) throw new Error('Unknown custom execution method.');
  const configuration=structuredClone(CONFIGURATIONS[method]);
  const factory=options.plannerFactory??await plannerFor(method), planner=factory(configuration);
  if (typeof planner!=='function') throw new Error('Planner factory must return a function.');
  const trace=[];
  let failureProof=null;
  const result=await runRollingScenario(input.scenario, input.events, {
    timeLimitSeconds:0.2, objectiveMode:'joint',
    planner:async(snapshot, constraints)=>{
      const began=performance.now(); let candidate;
      try {
        candidate=await planner(snapshot,{...constraints,...(method==='stableRetainV5'?{}:{timeBudgetMs:200})});
        if (!['optimal','feasible'].includes(candidate?.status) || candidate?.rows?.length!==snapshot.containers.length) failureProof=explainFeasibility(snapshot,constraints);
        return candidate;
      } finally {
        const metadata=safeMetadata(candidate?.plannerMetadata??{});
        trace.push({day:constraints.minEventDay, plannerStatus:candidate?.status??'planner_error',
          callWallMs:performance.now()-began, ...metadata,
          ...(failureProof?{failureProof}:{}),
        });
      }
    },
  });
  const output={...result, policy:method, plannerTrace:trace, failureProof,
    executionHistoryUnavailable:false, scope:EXECUTION_SCOPE_V8,
    browserSimulation:{workerWallMs:performance.now()-started, configuration,
      budgetSemantics:method==='stableRetainV5'?'0.2s internal solver limit; cache checks and wrapper are additional.':'200ms cooperative whole planner call; not an absolute call interruption.',
      hardParentWallMs:EXECUTION_HARD_WALL_MS_V8, source:'custom_local_simulation_not_frozen_research',
      metadataOmissions:'Large diagnostic buffers/arrays and model trees omitted; physical timeline and final pricing rows retained.'},
  };
  output.terminalAudit=auditExecutionResultV8(input,output);
  if (!output.terminalAudit.valid) throw new Error('Terminal simulation audit failed: '+output.terminalAudit.errors.join('; '));
  return output;
}

if (typeof self!=='undefined' && typeof document==='undefined' && typeof self.postMessage==='function') {
  self.onmessage=async({data})=>{
    const {id,...input}=data??{};
    try { self.postMessage({id, result:await runExecutionEpisodeV8(input)}); }
    catch (error) { self.postMessage({id, error:String(error?.message??error)}); }
  };
}
