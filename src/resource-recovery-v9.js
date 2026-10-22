import {capacityAt, rowFor, summarize, validateScenario} from './engine.js';
import {buildMILP, createSolver} from './solver-glpk.js';

const RESOURCES = ['truck', 'warehouse', 'staging'];
const EVENTS = ['pickupDay', 'unloadDay', 'returnDay'];
const MODES = ['procurementOnly', 'feesPlusProcurement'];
const MAX_ACTIONS = 64;
const clock = () => performance.now();
let solverPromise;

function validateInput(snapshot, options) {
  const validation = validateScenario(snapshot);
  if (!validation.valid) throw new Error(validation.errors.join('\n'));
  for (const resource of RESOURCES) for (let day=0; day<snapshot.horizonDays; day++) {
    if (!Number.isSafeInteger(capacityAt(snapshot[`${resource}Capacity`], day))) throw new Error(`${resource} capacity must be a safe integer on every horizon day.`);
  }
  const day = options.minEventDay ?? 0;
  if (!Number.isInteger(day) || day < 0 || day > snapshot.horizonDays) throw new Error('minEventDay must be an integer within the horizon.');
  const fixed = options.fixedEvents ?? {};
  if (!fixed || typeof fixed !== 'object' || Array.isArray(fixed)) throw new Error('fixedEvents must be an object.');
  const ids = new Set(snapshot.containers.map(container => container.id));
  for (const [id, locks] of Object.entries(fixed)) {
    if (!ids.has(id) || !locks || typeof locks !== 'object' || Array.isArray(locks)) throw new Error('Invalid physical execution lock container.');
    for (const [event, value] of Object.entries(locks)) {
      if (!EVENTS.includes(event) || !Number.isInteger(value) || value < 0 || value >= day) throw new Error('Physical execution locks must name events strictly before minEventDay.');
    }
  }
  const mode = options.objectiveMode ?? 'procurementOnly';
  if (!MODES.includes(mode)) throw new Error('objectiveMode must be procurementOnly or feesPlusProcurement.');
  const budget = options.timeBudgetMs ?? 1000;
  if (!Number.isFinite(budget) || budget <= 0) throw new Error('timeBudgetMs must be positive and finite.');
  const reserve = options.auditReserveMs ?? 5;
  if (!Number.isFinite(reserve) || reserve < 0) throw new Error('auditReserveMs must be nonnegative and finite.');
  const actions = options.actions;
  if (!Array.isArray(actions) || actions.length > MAX_ACTIONS) throw new Error(`actions must be an explicit array of at most ${MAX_ACTIONS} packages.`);
  const actionIds = new Set(), eligible = [], excluded = [];
  for (const action of actions) {
    if (!action || typeof action !== 'object' || Array.isArray(action) || typeof action.id !== 'string' || !action.id.trim() || actionIds.has(action.id)) throw new Error('Action ids must be nonempty unique strings.');
    actionIds.add(action.id);
    if (!RESOURCES.includes(action.resource)) throw new Error(`${action.id}: invalid resource.`);
    if (!Array.isArray(action.days) || !action.days.length || action.days.length > snapshot.horizonDays || Array.from(action.days).some(d => !Number.isInteger(d) || d < 0 || d >= snapshot.horizonDays) || new Set(action.days).size !== action.days.length) throw new Error(`${action.id}: days must be distinct integers within the horizon.`);
    if (!Number.isSafeInteger(action.units) || action.units <= 0) throw new Error(`${action.id}: units must be a positive safe integer.`);
    if (!Number.isSafeInteger(action.priceKRW) || action.priceKRW < 0) throw new Error(`${action.id}: priceKRW must be a nonnegative safe integer for the whole package.`);
    if (typeof action.authorized !== 'boolean') throw new Error(`${action.id}: authorized must be explicitly true or false.`);
    if (!Number.isInteger(action.earliestAvailableDay) || action.earliestAvailableDay < 0 || action.earliestAvailableDay > snapshot.horizonDays) throw new Error(`${action.id}: earliestAvailableDay must be an explicit integer within or immediately after the horizon.`);
    const copy = {id:action.id, resource:action.resource, days:[...action.days].sort((a,b) => a-b), units:action.units, priceKRW:action.priceKRW, authorized:action.authorized, earliestAvailableDay:action.earliestAvailableDay};
    const reasons = [];
    if (!copy.authorized) reasons.push('not_authorized');
    if (copy.days.some(d => d < day)) reasons.push('would_change_past_capacity');
    if (copy.days.some(d => d < copy.earliestAvailableDay)) reasons.push('before_earliest_availability');
    if (reasons.length) excluded.push({...copy, reasons});
    else eligible.push(copy);
  }
  if (!Number.isSafeInteger(eligible.reduce((n, action) => n + action.priceKRW, 0))) throw new Error('The sum of eligible package prices must be a safe integer.');
  for (const resource of RESOURCES) for (let d=0; d<snapshot.horizonDays; d++) {
    const capacity = eligible.filter(action => action.resource === resource && action.days.includes(d)).reduce((n, action) => n + action.units, capacityAt(snapshot[`${resource}Capacity`], d));
    if (!Number.isSafeInteger(capacity)) throw new Error('The capacity with every eligible package must remain a safe integer.');
  }
  return {day, fixed, mode, budget, reserve, eligible, excluded};
}

// Deliberately separate arithmetic from engine rowFor / scheduleUsage / audits.
function feeFor(snapshot, container, pickup, returned) {
  const tariff = {pncFreeDays:4, ddFreeDays:10, pncMultiplier:1, ddMultiplier:1, pncMode:'retroactive', ddMode:'progressive', ...snapshot.tariff};
  const instant = Date.parse(container.dischargeDateTime), local = new Date(instant + 9*3600000);
  const discharge = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) / 86400000;
  const storageStart = discharge + Number(local.getUTCHours() >= 8);
  const start = Date.parse(`${snapshot.horizonStart}T00:00:00Z`) / 86400000;
  const storage = days => {
    const n = Math.max(0, days-tariff.pncFreeDays), rates=[9100,18200,31850,45500];
    const raw = tariff.pncMode === 'retroactive' ? n*rates[n<=3?0:n<=5?1:n<=10?2:3] : Math.min(n,3)*rates[0]+Math.min(Math.max(n-3,0),2)*rates[1]+Math.min(Math.max(n-5,0),5)*rates[2]+Math.max(n-10,0)*rates[3];
    return raw*(container.sizeFt/20)*tariff.pncMultiplier;
  };
  const detention = days => {
    const n=Math.max(0,days-tariff.ddFreeDays), rates=container.sizeFt===20?[15000,30000,50000]:[30000,50000,90000];
    const raw=tariff.ddMode==='retroactive'?n*rates[n<=5?0:n<=10?1:2]:Math.min(n,5)*rates[0]+Math.min(Math.max(n-5,0),5)*rates[1]+Math.max(n-10,0)*rates[2];
    return raw*tariff.ddMultiplier;
  };
  const storageDays=Math.max(0,start+pickup-storageStart+1), ddDays=Math.max(0,start+returned-discharge+1);
  const storageCost=storage(storageDays), ddCost=detention(ddDays), priorStorageCost=storage(Math.max(0,start-storageStart)), priorDDCost=detention(Math.max(0,start-discharge));
  const totalCost=storageCost+ddCost, sunkCost=priorStorageCost+priorDDCost;
  return {storageDays, ddDays, storageCost, ddCost, priorStorageCost, priorDDCost, totalCost, sunkCost, incrementalCost:totalCost-sunkCost};
}

const sameAmount = (actual, expected) => Number.isFinite(actual) && Math.abs(actual-expected) <= 1e-6+32*Number.EPSILON*Math.max(1,Math.abs(expected));

/** Independently rebuild purchased capacity, physical occupancy, locks and both
 * fees. This audits feasibility, not the solver's optimality assertion. */
export function auditResourceRecovery(snapshot, options, result) {
  let input;
  try { input=validateInput(snapshot, options); }
  catch (error) { return {valid:false, errors:[error instanceof Error?error.message:String(error)]}; }
  const errors=[], H=snapshot.horizonDays, selected=[], seenActions=new Set();
  if (result?.objectiveMode!==input.mode) errors.push('Declared objective differs from the original requested objective.');
  if (result?.counterfactual!==true || result?.purchaseExecuted!==false) errors.push('The result must identify an unexecuted counterfactual recommendation.');
  const eligible=new Map(input.eligible.map(action => [action.id,action]));
  if (!Array.isArray(result?.selectedActions)) errors.push('Selected action list is missing.');
  else for (const claimed of result.selectedActions) {
    const action=eligible.get(claimed?.id);
    if (!action || seenActions.has(claimed.id)) { errors.push('Selected package is unknown, ineligible or duplicated.'); continue; }
    seenActions.add(action.id); selected.push(action);
    if (['resource','units','priceKRW','authorized','earliestAvailableDay'].some(key=>claimed[key]!==action[key]) || !Array.isArray(claimed.days) || claimed.days.length!==action.days.length || [...claimed.days].sort((a,b)=>a-b).some((day,index)=>day!==action.days[index])) errors.push(`${action.id}: selected action details differ from the explicit menu.`);
  }
  const procurementCostKRW=selected.reduce((n,action)=>n+action.priceKRW,0);
  const usage=Array.from({length:H},(_,day)=>({day,truck:0,warehouse:0,staging:0,...Object.fromEntries(RESOURCES.map(resource=>[`${resource}Capacity`,capacityAt(snapshot[`${resource}Capacity`],day)]))}));
  for (const action of selected) for (const day of action.days) usage[day][`${action.resource}Capacity`]+=action.units;
  const totals={storageCost:0,ddCost:0,totalCost:0,sunkCost:0,incrementalCost:0};
  const seenRows=new Set(), byId=new Map(snapshot.containers.map(container=>[container.id,container]));
  if (!Array.isArray(result?.rows) || result.rows.length !== snapshot.containers.length) errors.push('Rows must cover every known container exactly once.');
  for (const row of Array.isArray(result?.rows)?result.rows:[]) {
    const container=byId.get(row?.id);
    if (!container || seenRows.has(row.id)) { errors.push('Unknown or duplicate schedule row.'); continue; }
    seenRows.add(row.id);
    if (![...EVENTS,'unloadEndDay'].every(key=>Number.isInteger(row[key])&&row[key]>=0&&row[key]<H)) { errors.push(`${row.id}: event dates must be integers within the horizon.`); continue; }
    const p=row.pickupDay,u=row.unloadDay,r=row.returnDay, end=u+container.unloadDays-1;
    const lag=snapshot.operations?.returnLagDays??1;
    if (row.sizeFt!==container.sizeFt || row.unloadEndDay!==end || p<container.releaseDay || u<p || end>container.dueDay || r<end+lag) errors.push(`${row.id}: size, release, continuous unloading, deadline or precedence violated.`);
    const locks=Object.hasOwn(input.fixed,row.id)?input.fixed[row.id]:{};
    for (const event of EVENTS) {
      if (Object.hasOwn(locks,event)?row[event]!==locks[event]:row[event]<input.day) errors.push(`${row.id}: executed history or pending event floor violated.`);
    }
    usage[p].truck++; usage[r].truck++;
    for (let d=u;d<=end&&d<H;d++) usage[d].warehouse++;
    const weight=snapshot.operations?.stagingUnit==='teu'?container.sizeFt/20:1;
    for (let d=p;d<r;d++) usage[d].staging+=weight;
    const fees=feeFor(snapshot,container,p,r);
    for (const [field,value] of Object.entries(fees)) if (!sameAmount(row[field],value)) errors.push(`${row.id}: ${field} differs from independent repricing.`);
    for (const field of Object.keys(totals)) totals[field]+=fees[field];
  }
  if (seenRows.size !== snapshot.containers.length) errors.push('Schedule does not cover all known container ids.');
  for (const day of usage) for (const resource of RESOURCES) if (day[resource]>day[`${resource}Capacity`]) errors.push(`Day ${day.day}: ${resource} capacity exceeded.`);
  for (const [field,value] of Object.entries({...totals,procurementCostKRW,combinedIncrementalCostKRW:totals.incrementalCost+procurementCostKRW,combinedTotalCostKRW:totals.totalCost+procurementCostKRW,objectiveCostKRW:procurementCostKRW+(input.mode==='feesPlusProcurement'?totals.incrementalCost:0)})) if (!sameAmount(result?.[field],value)) errors.push(`${field} differs from independent recomputation.`);
  return {valid:errors.length===0,errors,procurementCostKRW,...totals,usage,selectedActionIds:selected.map(action=>action.id),scope:'current_observation_and_explicit_eligible_menu_only',optimalityAudited:false};
}

function buildRecoveryModel(glpk, snapshot, input) {
  // Original-capacity presolve could remove dates that a purchased package can
  // make feasible; keep the original event domain and exact execution locks.
  const built=buildMILP(glpk,snapshot,{minEventDay:input.day,fixedEvents:input.fixed,objectiveMode:'joint',presolveV4:false});
  const actionVariables=input.eligible.map((action,index)=>({name:`rescue_action_${index}`,action}));
  for (const {name,action} of actionVariables) {
    built.model.binaries.push(name);
    for (const day of action.days) {
      const constraint=built.model.subjectTo.find(row=>row.name===`${action.resource}_${day}`);
      constraint.vars.push({name,coef:-action.units});
    }
  }
  built.model.name='PortPlan_v9_explicit_resource_recovery';
  built.model.objective={direction:glpk.GLP_MIN,name:input.mode==='procurementOnly'?'explicit_package_krw':'incremental_fees_plus_package_krw',vars:[...(input.mode==='feesPlusProcurement'?built.fullCosts:[]),...actionVariables.map(({name,action})=>({name,coef:action.priceKRW}))]};
  const coefficients=built.model.objective.vars;
  const objectiveSafeInteger=coefficients.every(term=>Number.isSafeInteger(term.coef))&&Number.isSafeInteger(coefficients.reduce((n,term)=>n+Math.abs(term.coef),0));
  return {...built,actionVariables,objectiveSafeInteger};
}

/** A counterfactual recommendation. Packages are never purchased or dispatched.
 * Its cooperative wall budget includes initialization/model/solve/audit; callers
 * requiring hard cancellation must run this function in their own worker. */
export async function solveResourceRecovery(scenario, options={}) {
  const started=clock(), snapshot=structuredClone(scenario), copied=structuredClone(options);
  const input=validateInput(snapshot,copied), deadline=started+input.budget;
  const metadata={modelVersion:'v9-explicit-resource-recovery',counterfactual:true,purchaseExecuted:false,objectiveMode:input.mode,minEventDay:input.day,wholeCallBudgetMs:input.budget,eligibleActions:input.eligible,excludedActions:input.excluded,informationRule:'Only this supplied current observation, physical past locks and explicit action menu are used. Unknown future outcomes are not modeled.',scope:'current_observation_and_explicit_eligible_menu_only'};
  const proof=(extra={})=>({minimumProcurementProven:false,minimumObjectiveProven:false,infeasibleWithinMenuProven:false,scope:metadata.scope,independentFeasibilityAudit:false,...extra});
  const empty=(status,reason,extra={})=>({...metadata,status,reason,rows:[],selectedActions:[],procurementCostKRW:null,storageCost:null,ddCost:null,totalCost:null,sunkCost:null,incrementalCost:null,combinedIncrementalCostKRW:null,combinedTotalCostKRW:null,objectiveCostKRW:null,usage:[],optimality:'not_proven',proof:proof(),runtimeMs:clock()-started,...extra});
  const acceptTerminal=(terminal,context={})=>{
    // The complete plan/proof object already exists at this point. Both a
    // feasible plan and a no-feasible-menu certificate require timely receipt.
    const acceptedAt=clock();
    if (acceptedAt>=deadline) return empty('time_limit','Final objective selection and terminal output construction exceeded the whole-call deadline; no late plan or proof is accepted.',{...context,lateCandidateDiscarded:true});
    terminal.runtimeMs=acceptedAt-started;
    return terminal;
  };
  const expired=()=>clock()>=deadline;
  if (expired()) return empty('time_limit','No time remains after copying and validating the current observation and menu.');
  let glpk,built;
  try {
    solverPromise??=createSolver(); glpk=await solverPromise;
    if (expired()) return empty('time_limit','No time remains after solver initialization.');
    built=buildRecoveryModel(glpk,snapshot,input);
  } catch (error) { return empty('solver_error',error instanceof Error?error.message:String(error)); }
  if (expired()) return empty('time_limit','No time remains after model construction.');
  const modelSize={binaries:built.model.binaries.length,constraints:built.model.subjectTo.length,eligiblePackages:input.eligible.length};
  if (built.event.some(event=>['x','y','z'].some(kind=>event[kind].length===0))) return acceptTerminal(empty('infeasible','Release/deadline/horizon or physical event locks leave an empty event domain; no menu package changes those requirements.',{modelSize,optimality:'proven_infeasible_within_menu',proof:proof({infeasibleWithinMenuProven:true,source:'empty_event_domain'})}),{modelSize});
  const nativeLimitMs=Math.floor(deadline-clock()-input.reserve);
  if (nativeLimitMs<1) return empty('time_limit','No solver time remains after reserving the final independent audit.',{modelSize});
  let raw;
  try { raw=await glpk.solve(built.model,{msglev:glpk.GLP_MSG_OFF,presol:true,tmlim:nativeLimitMs/1000,mipgap:0}); }
  catch (error) { return empty('solver_error',error instanceof Error?error.message:String(error),{modelSize,nativeLimitMs}); }
  const backend={solver:`GLPK ${glpk.version} via glpk.js 5.0.0`,solverStatus:raw?.result?.status,modelSize,nativeLimitMs,objectiveSafeInteger:built.objectiveSafeInteger};
  if (expired()) return empty('time_limit','Solver response arrived after the whole-call budget; no late plan or optimum is accepted.',{...backend,lateCandidateDiscarded:true});
  if (raw?.result?.status===glpk.GLP_NOFEAS) return acceptTerminal(empty('infeasible','GLPK proved no feasible plan within this current snapshot and eligible finite action menu.',{...backend,optimality:'proven_infeasible_within_menu',proof:proof({infeasibleWithinMenuProven:true,source:'solver_infeasibility'})}),backend);
  if (![glpk.GLP_OPT,glpk.GLP_FEAS].includes(raw?.result?.status)) return empty('time_limit','No complete feasible incumbent was returned within the solver limit; menu infeasibility is not established.',backend);
  let selectedActions,rows;
  try {
    const values=raw.result.vars;
    for (const name of built.model.binaries) if (!Number.isFinite(values[name]) || Math.abs(values[name]-Math.round(values[name]))>1e-6 || values[name]<-1e-6 || values[name]>1+1e-6) throw new Error('Nonbinary or missing solver assignment.');
    selectedActions=built.actionVariables.filter(({name})=>values[name]>.5).map(({action})=>action);
    rows=snapshot.containers.map((container,index)=>{
      const dates=['x','y','z'].map(kind=>{
        const active=built.event[index][kind].filter(variable=>values[variable.name]>.5);
        if (active.length!==1) throw new Error('Solver assignment does not choose exactly one date per event.');
        return active[0].day;
      });
      return rowFor(snapshot,container,...dates);
    });
  } catch (error) { return empty('candidate_rejected',error instanceof Error?error.message:String(error),backend); }
  const capacities=Object.fromEntries(RESOURCES.map(resource=>[`${resource}Capacity`,Array.from({length:snapshot.horizonDays},(_,day)=>selectedActions.filter(action=>action.resource===resource&&action.days.includes(day)).reduce((n,action)=>n+action.units,capacityAt(snapshot[`${resource}Capacity`],day)))]));
  const procurementCostKRW=selectedActions.reduce((n,action)=>n+action.priceKRW,0);
  const plan=summarize({...snapshot,...capacities},'resourceRecoveryV9',rows,clock()-started,'feasible');
  const candidate={...metadata,...plan,...backend,objectiveMode:input.mode,selectedActions,procurementCostKRW,combinedIncrementalCostKRW:plan.incrementalCost+procurementCostKRW,combinedTotalCostKRW:plan.totalCost+procurementCostKRW,objectiveCostKRW:procurementCostKRW+(input.mode==='feesPlusProcurement'?plan.incrementalCost:0)};
  const audit=auditResourceRecovery(snapshot,copied,candidate);
  if (!audit.valid) return empty('candidate_rejected','The complete candidate failed independent action, physical-history, capacity or fee auditing.',{...backend,audit});
  if (expired()) return empty('time_limit','Final independent auditing completed after the whole-call deadline; the candidate is not accepted.',{...backend,audit,lateCandidateDiscarded:true});
  if (!sameAmount(raw.result.z,candidate.objectiveCostKRW)) return empty('candidate_rejected','The solver objective disagrees with independently reconstructed package and fee amounts.',{...backend,audit});
  const proven=raw.result.status===glpk.GLP_OPT&&built.objectiveSafeInteger;
  // Finish objective selection and the complete success/proof object before the
  // final gate. An audit-time check alone cannot accept work done after it.
  const accepted={...candidate,status:proven?'optimal':'feasible',optimality:proven?'minimum_proven_within_menu':raw.result.status===glpk.GLP_OPT?'solver_optimal_with_numeric_tolerance':'feasible_incumbent_only',reason:proven?'A complete audited plan minimizes the declared objective within the supplied snapshot and eligible finite menu.':'A complete audited plan is available; the declared minimum is not established.',audit,usage:audit.usage,proof:proof({minimumObjectiveProven:proven,minimumProcurementProven:proven&&input.mode==='procurementOnly',independentFeasibilityAudit:true,source:'glpk_mip_status_and_safe_integer_objective',solverStatus:raw.result.status,objectiveSafeInteger:built.objectiveSafeInteger,objectiveCostKRW:candidate.objectiveCostKRW}),runtimeMs:null};
  return acceptTerminal(accepted,{...backend,audit});
}
