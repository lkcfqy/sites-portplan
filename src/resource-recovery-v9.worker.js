import {capacityAt,validateScenario} from './engine.js';
import {auditResourceRecovery,solveResourceRecovery} from './resource-recovery-v9.js';

export const RESOURCE_RECOVERY_HARD_WALL_MS_V9=5000;
export const RESOURCE_RECOVERY_SCOPE_V9='Counterfactual current-observation recovery with an explicit finite resource menu; no purchasing, dispatch or realized-savings claim.';
const RESOURCES=['truck','warehouse','staging'],EVENTS=['pickupDay','unloadDay','returnDay'];
const FEES=['procurementCostKRW','storageCost','ddCost','totalCost','sunkCost','incrementalCost','combinedIncrementalCostKRW','combinedTotalCostKRW','objectiveCostKRW'];
const MODES=['procurementOnly','feesPlusProcurement'];
const pick=(value,fields)=>Object.fromEntries(fields.filter(key=>Object.hasOwn(value,key)).map(key=>[key,value[key]]));

/** These packages, prices and authorizations are teaching assumptions only. */
export function makeResourceRecoveryFixtureV9(kind='rescue'){
  if(!['rescue','impossible'].includes(kind))throw new Error('Unknown resource recovery demonstration.');
  const snapshot={id:'v9-resource-teaching-'+kind,horizonStart:'2026-10-16',horizonDays:4,truckCapacity:2,warehouseCapacity:0,stagingCapacity:1,objectiveMode:'joint',containers:[
    {id:'TEACHING-01',sizeFt:20,dischargeDateTime:'2026-10-01T07:00:00+09:00',releaseDay:0,unloadDays:1,dueDay:1,dataOrigin:'synthetic'},
  ]};
  const actions=[
    {id:'SYNTHETIC-warehouse-one-day',resource:'warehouse',days:[1],units:1,priceKRW:30000,authorized:kind==='rescue',earliestAvailableDay:1},
    {id:'SYNTHETIC-warehouse-larger-package',resource:'warehouse',days:[1],units:2,priceKRW:50000,authorized:kind==='rescue',earliestAvailableDay:1},
    {id:'SYNTHETIC-not-authorized',resource:'warehouse',days:[1],units:1,priceKRW:1000,authorized:false,earliestAvailableDay:1},
    {id:'SYNTHETIC-arrives-too-late',resource:'warehouse',days:[1],units:1,priceKRW:500,authorized:true,earliestAvailableDay:2},
    {id:'SYNTHETIC-would-change-past',resource:'warehouse',days:[0],units:1,priceKRW:500,authorized:true,earliestAvailableDay:0},
    {id:'SYNTHETIC-after-delivery-deadline',resource:'warehouse',days:[2],units:1,priceKRW:10000,authorized:true,earliestAvailableDay:1},
  ];
  return {snapshot,actions,minEventDay:1,fixedEvents:{'TEACHING-01':{pickupDay:0}},objectiveMode:'procurementOnly',inputOrigin:'synthetic-fixture',fixture:kind,scope:'Intentionally constructed synthetic teaching example, not a benchmark, real quotation or actual authorization.'};
}

/** Allowlist the observed daily model and explicit menu at both worker boundaries. */
export function prepareResourceRecoveryInputV9(value){
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Resource recovery input must be an object.');
  const original=structuredClone(value.snapshot);
  const fields=['id','seed','horizonStart','horizonDays','truckCapacity','warehouseCapacity','stagingCapacity','objectiveMode','tariff','operations','containers'];
  if(!original||typeof original!=='object'||Array.isArray(original))throw new Error('snapshot must be an object.');
  const snapshot=pick(original,fields),normalization={supportedDailyModelFieldsOnly:true,ignoredSnapshotFields:Object.keys(original).filter(key=>!fields.includes(key))};
  if(Array.isArray(original.containers))snapshot.containers=original.containers.map(container=>container&&typeof container==='object'?pick(container,['id','sizeFt','dischargeDateTime','releaseDay','unloadDays','dueDay','dataOrigin']):container);
  if(snapshot.tariff&&typeof snapshot.tariff==='object'&&!Array.isArray(snapshot.tariff))snapshot.tariff=pick(snapshot.tariff,['pncFreeDays','ddFreeDays','pncMultiplier','ddMultiplier','pncMode','ddMode']);
  if(snapshot.operations&&typeof snapshot.operations==='object'&&!Array.isArray(snapshot.operations))snapshot.operations=pick(snapshot.operations,['returnLagDays','stagingUnit']);
  const validation=validateScenario(snapshot);if(!validation.valid)throw new Error(validation.errors.join('; '));
  if((snapshot.objectiveMode??'joint')!=='joint')throw new Error('Resource recovery supports the joint storage and D&D model only.');
  snapshot.objectiveMode='joint';
  for(const resource of RESOURCES)for(let day=0;day<snapshot.horizonDays;day++)if(!Number.isSafeInteger(capacityAt(snapshot[resource+'Capacity'],day)))throw new Error(resource+' capacity must be a safe integer on every day.');
  const minEventDay=value.minEventDay??0,fixedEvents=structuredClone(value.fixedEvents??{}),objectiveMode=value.objectiveMode??'procurementOnly';
  if(!Number.isInteger(minEventDay)||minEventDay<0||minEventDay>snapshot.horizonDays)throw new Error('minEventDay must be within the planning horizon.');
  if(!fixedEvents||typeof fixedEvents!=='object'||Array.isArray(fixedEvents))throw new Error('fixedEvents must be an object keyed by known container id.');
  const ids=new Set(snapshot.containers.map(container=>container.id));for(const [id,locks]of Object.entries(fixedEvents)){if(!ids.has(id)||!locks||typeof locks!=='object'||Array.isArray(locks))throw new Error('Invalid physical execution lock container.');for(const [event,day]of Object.entries(locks))if(!EVENTS.includes(event)||!Number.isInteger(day)||day<0||day>=minEventDay)throw new Error('Physical execution locks must be strictly before minEventDay.');}
  if(!MODES.includes(objectiveMode))throw new Error('objectiveMode must be procurementOnly or feesPlusProcurement.');
  if(!Array.isArray(value.actions)||value.actions.length>64)throw new Error('actions must be an explicit array of at most 64 packages.');
  const actionIds=new Set(),actions=value.actions.map(originalAction=>{
    if(!originalAction||typeof originalAction!=='object'||Array.isArray(originalAction))throw new Error('Each resource action must be an object.');
    const action=structuredClone(pick(originalAction,['id','resource','days','units','priceKRW','authorized','earliestAvailableDay']));
    if(typeof action.id!=='string'||!action.id.trim()||actionIds.has(action.id))throw new Error('Action ids must be nonempty unique strings.');actionIds.add(action.id);
    if(!RESOURCES.includes(action.resource))throw new Error(action.id+': resource must be truck, warehouse or staging.');
    if(!Array.isArray(action.days)||!action.days.length||action.days.length>snapshot.horizonDays||Array.from(action.days).some(day=>!Number.isInteger(day)||day<0||day>=snapshot.horizonDays)||new Set(action.days).size!==action.days.length)throw new Error(action.id+': days must be unique integers within the horizon.');
    action.days.sort((a,b)=>a-b);
    if(!Number.isSafeInteger(action.units)||action.units<=0)throw new Error(action.id+': units must be a positive safe integer.');
    if(!Number.isSafeInteger(action.priceKRW)||action.priceKRW<0)throw new Error(action.id+': priceKRW must be a nonnegative safe integer for the whole package.');
    if(typeof action.authorized!=='boolean')throw new Error(action.id+': authorized must be explicitly true or false.');
    if(!Number.isInteger(action.earliestAvailableDay)||action.earliestAvailableDay<0||action.earliestAvailableDay>snapshot.horizonDays)throw new Error(action.id+': earliestAvailableDay must be within or immediately after the horizon.');
    return action;
  });
  const inputOrigin=value.inputOrigin==='synthetic-fixture'?'synthetic-fixture':'user-custom-unverified';
  const eligible=actions.filter(action=>action.authorized&&action.days.every(day=>day>=minEventDay&&day>=action.earliestAvailableDay));
  if(!Number.isSafeInteger(eligible.reduce((sum,action)=>sum+action.priceKRW,0)))throw new Error('The sum of eligible package prices must be a safe integer.');
  for(const resource of RESOURCES)for(let day=0;day<snapshot.horizonDays;day++)if(!Number.isSafeInteger(eligible.filter(action=>action.resource===resource&&action.days.includes(day)).reduce((sum,action)=>sum+action.units,capacityAt(snapshot[resource+'Capacity'],day))))throw new Error('The total eligible capacity must remain a safe integer.');
  for(const container of snapshot.containers)container.dataOrigin=inputOrigin==='synthetic-fixture'?'synthetic':'uploaded';
  return {schemaVersion:'portplan-resource-recovery-v9-local-input',snapshot,actions,minEventDay,fixedEvents,objectiveMode,timeBudgetMs:1000,auditReserveMs:5,inputOrigin,scope:RESOURCE_RECOVERY_SCOPE_V9,normalization};
}

const optionsFor=input=>({actions:input.actions,minEventDay:input.minEventDay,fixedEvents:input.fixedEvents,objectiveMode:input.objectiveMode,timeBudgetMs:1000,auditReserveMs:5});
const excludedFor=input=>input.actions.flatMap(action=>{const reasons=[];if(!action.authorized)reasons.push('not_authorized');if(action.days.some(day=>day<input.minEventDay))reasons.push('would_change_past_capacity');if(action.days.some(day=>day<action.earliestAvailableDay))reasons.push('before_earliest_availability');return reasons.length?[{...action,reasons}]:[];});

/** Parent performs this separately using its original input, never worker-supplied capacities. */
export function auditResourceRecoveryResultV9(value,result){
  let input;try{input=prepareResourceRecoveryInputV9(value);}catch(error){return {valid:false,errors:[error.message]};}
  const errors=[];if(!result||typeof result!=='object')return {valid:false,errors:['Missing recovery terminal result.']};
  if(result.counterfactual!==true||result.purchaseExecuted!==false)errors.push('Recovery must remain a counterfactual recommendation with no purchase executed.');
  if(result.objectiveMode!==input.objectiveMode||result.minEventDay!==input.minEventDay)errors.push('Terminal optimization context differs from the original input.');
  const claimedExcluded=result.excludedActions,expectedExcluded=excludedFor(input);if(!Array.isArray(claimedExcluded)||claimedExcluded.length!==expectedExcluded.length||expectedExcluded.some((expected,index)=>{const claimed=claimedExcluded?.[index];return !claimed||['id','resource','units','priceKRW','authorized','earliestAvailableDay'].some(key=>claimed[key]!==expected[key])||JSON.stringify(claimed.days)!==JSON.stringify(expected.days)||JSON.stringify(claimed.reasons)!==JSON.stringify(expected.reasons);}))errors.push('Excluded package details or reasons differ from the explicit input.');
  const success=['optimal','feasible'].includes(result.status);
  if(success){const audit=auditResourceRecovery(input.snapshot,optionsFor(input),result);errors.push(...audit.errors);if(result.audit?.valid!==true)errors.push('Worker did not certify its own final candidate.');
    if(result.status==='optimal'&&(result.proof?.minimumObjectiveProven!==true||input.objectiveMode==='procurementOnly'&&result.proof?.minimumProcurementProven!==true))errors.push('An optimal label needs the declared objective proof.');
    if(input.objectiveMode==='feesPlusProcurement'&&result.proof?.minimumProcurementProven===true)errors.push('The combined objective does not establish a minimum procurement-only cost.');
    if(result.proof?.infeasibleWithinMenuProven===true)errors.push('A complete feasible recommendation cannot also claim menu infeasibility.');
    if(result.status!=='optimal'&&(result.proof?.minimumObjectiveProven===true||result.proof?.minimumProcurementProven===true))errors.push('A feasible-only candidate cannot claim a minimum.');
    return {valid:errors.length===0,errors,recomputed:audit,optimalityIndependentlyRecomputed:false,scope:'Independent parent action-menu, capacity, execution-lock and fee audit; solver optimality proof is retained but not independently re-solved.'};
  }
  if(!['infeasible','time_limit','candidate_rejected','solver_error'].includes(result.status))errors.push('Unknown solver terminal status.');
  if(!Array.isArray(result.rows)||result.rows.length||!Array.isArray(result.selectedActions)||result.selectedActions.length)errors.push('An incomplete recommendation must not expose accepted rows or purchases.');
  for(const field of FEES)if(result[field]!==null)errors.push('Incomplete recommendation must preserve null '+field+'.');
  if(result.proof?.minimumProcurementProven===true||result.proof?.minimumObjectiveProven===true)errors.push('Incomplete recommendations cannot claim an objective minimum.');
  if(result.status==='infeasible'&&result.proof?.infeasibleWithinMenuProven!==true)errors.push('Menu infeasibility requires an explicit scoped proof.');
  return {valid:errors.length===0,errors,optimalityIndependentlyRecomputed:false,scope:'Incomplete terminal shape, provenance and null-money checks; infeasibility proof is solver supplied.'};
}

export function resourceRecoveryStatusV9(result){
  if(result?.status==='cancelled')return 'cancelled';
  if(['optimal','feasible'].includes(result?.status)&&result?.audit?.valid===true)return result.status;
  if(result?.status==='infeasible'&&result?.proof?.infeasibleWithinMenuProven===true)return 'infeasible';
  return 'unknown';
}

export async function runResourceRecoveryV9(value,{solver=solveResourceRecovery}={}){
  const started=performance.now(),input=prepareResourceRecoveryInputV9(value);
  const result=await solver(input.snapshot,optionsFor(input));
  const output={...result,scope:RESOURCE_RECOVERY_SCOPE_V9,browserRecovery:{workerWallMs:performance.now()-started,parentHardWallMs:RESOURCE_RECOVERY_HARD_WALL_MS_V9,source:'custom_local_counterfactual_not_frozen_research',purchaseExecuted:false}};
  const terminalAudit=auditResourceRecoveryResultV9(input,output);if(!terminalAudit.valid)throw new Error('Recovery terminal audit failed: '+terminalAudit.errors.join('; '));
  return {...output,terminalAudit};
}

if(typeof self!=='undefined'&&typeof document==='undefined'&&typeof self.postMessage==='function')self.onmessage=async({data})=>{const {id,input}=data??{};try{self.postMessage({id,result:await runResourceRecoveryV9(input)});}catch(error){self.postMessage({id,error:String(error?.message??error)});}};
