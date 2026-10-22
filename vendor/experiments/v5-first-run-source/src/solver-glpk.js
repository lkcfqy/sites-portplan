import {capacityAt,containerCost,returnOffset,stagingWeight} from './engine.js';
import {presolveEventDomains} from './solver-presolver.js';
import {constrainExecutionDomains} from './execution-constraints.js';

export async function createSolver() {
  if (typeof process !== 'undefined' && process.versions?.node) {
    const nodeEntry='glpk.js/node';
    const {default:GLPK}=await import(/* @vite-ignore */ nodeEntry);
    return GLPK();
  }
  const {default:GLPK}=await import('glpk.js');
  return GLPK();
}

/** Time-indexed MILP: pickup x, unloading-start y and return z binary events. */
export function buildMILP(glpk,s,options={}) {
  const H=s.horizonDays, variables=[], costs=[], fullCosts=[], constraints=[];
  const mode=options.objectiveMode??s.objectiveMode??'joint';
  let event=s.containers.map((c,i)=>{
    const offset=returnOffset(s,c);
    const events={x:[],y:[],z:[]};
    for (let d=0;d<H;d++) {
      if (d>=c.releaseDay && d<=Math.min(c.dueDay-c.unloadDays+1,H-offset-1)) events.x.push({name:`x_${i}_${d}`,day:d});
      if (d>=c.releaseDay && d<=Math.min(c.dueDay-c.unloadDays+1,H-offset-1)) events.y.push({name:`y_${i}_${d}`,day:d});
      if (d>=c.releaseDay+offset) events.z.push({name:`z_${i}_${d}`,day:d});
    }
    return events;
  });
  const execution=constrainExecutionDomains(s,event,options);
  event=execution.event;
  const presolved=options.presolveV4===true?presolveEventDomains(s,event,{...options,objectiveMode:mode}):null;
  if(presolved)event=presolved.event;
  for(let i=0;i<s.containers.length;i++) {
    const c=s.containers[i],offset=returnOffset(s,c),events=event[i];
    for (const kind of ['x','y','z']) for (const v of events[kind]) {
      variables.push(v.name);
      const cost=containerCost(c,kind==='x'?v.day:c.releaseDay,kind==='z'?v.day:c.releaseDay+offset,s.horizonStart,s.tariff);
      // Every container chooses exactly one x and z; subtracting prior accrual is a constant.
      const coef=kind==='x'?cost.storageCost-cost.priorStorageCost:kind==='z'?cost.ddCost-cost.priorDDCost:0;
      fullCosts.push({name:v.name,coef});
      costs.push({name:v.name,coef:(mode==='storageOnly'&&kind==='z'||mode==='ddOnly'&&kind==='x')?0:coef});
    }
  }
  const fixed=(name,vars,value)=>constraints.push({name,vars,bnds:{type:glpk.GLP_FX,lb:value,ub:value}});
  const upper=(name,vars,value)=>constraints.push({name,vars,bnds:{type:glpk.GLP_UP,lb:0,ub:value}});
  const terms=(events,predicate,coef=1)=>events.filter(predicate).map(v=>({name:v.name,coef}));
  for (let i=0;i<s.containers.length;i++) {
    const c=s.containers[i],e=event[i];
    for (const kind of ['x','y','z']) fixed(`once_${kind}_${i}`,terms(e[kind],()=>true),1);
    for (let d=0;d<H;d++) {
      // A completion prefix cannot get ahead of its prerequisite prefix.
      upper(`pickup_before_unload_${i}_${d}`,[...terms(e.y,v=>v.day<=d),...terms(e.x,v=>v.day<=d,-1)],0);
      upper(`unload_before_return_${i}_${d}`,[...terms(e.z,v=>v.day<=d),...terms(e.y,v=>v.day<=d-returnOffset(s,c),-1)],0);
    }
  }
  for (let d=0;d<H;d++) {
    upper(`truck_${d}`,event.flatMap(e=>[...terms(e.x,v=>v.day===d),...terms(e.z,v=>v.day===d)]),capacityAt(s.truckCapacity,d));
    upper(`warehouse_${d}`,event.flatMap((e,i)=>terms(e.y,v=>v.day<=d && v.day+s.containers[i].unloadDays>d)),capacityAt(s.warehouseCapacity,d));
    upper(`staging_${d}`,event.flatMap((e,i)=>[...terms(e.x,v=>v.day<=d,stagingWeight(s,s.containers[i])),...terms(e.z,v=>v.day<=d,-stagingWeight(s,s.containers[i]))]),capacityAt(s.stagingCapacity,d));
  }
  if(presolved?.cutoff!==null && presolved?.cutoff!==undefined)upper('audited_feasible_objective_cutoff',costs,presolved.cutoff+presolved.cutoffTolerance);
  return {model:{name:execution.metadata?'PortPlan_v4_locked_execution':presolved?.metadata.enabled?'PortPlan_v4_safe_presolve':'PortPlan_v2',objective:{direction:glpk.GLP_MIN,name:'incremental_krw',vars:costs},subjectTo:constraints,binaries:variables},event,fullCosts,mode,presolveMetadata:presolved?.metadata,certificate:presolved?.certificate,executionConstraints:execution.metadata};
}

export async function solveMILP(glpk,s,options={}) {
  const {model,event,fullCosts,mode,presolveMetadata,certificate,executionConstraints}=buildMILP(glpk,s,options);
  const modelSize={binaries:model.binaries.length,constraints:model.subjectTo.length};
  const method={...(presolveMetadata?{presolveMetadata,methodVersion:presolveMetadata.enabled?'v4-safe-presolve':'v4-presolve-disabled'}:{}),...(executionConstraints?{executionConstraints,methodVersion:'v4-locked-execution'}:{})};
  // Empty event domains are a mathematical infeasibility proof, before GLPK.
  if (event.some(e=>['x','y','z'].some(k=>e[k].length===0))) return {...method,status:'infeasible',optimality:'proven_infeasible',reason:presolveMetadata?.infeasibleContainerIds?.length?'At least one container has no separately feasible trip under the stated event domains and individual resource capacities.':'At least one container has no event dates satisfying release, delivery and return horizon.',modelSize};
  if(certificate && (mode==='joint'||options.lexicographic===false)) return {
    ...method,methodVersion:'v4-independent-bound-certificate',status:'optimal',optimality:'proven_optimal',
    solver:'PortPlan independent container lower-bound certificate; GLPK not invoked',solverStatus:null,
    modelSize,objectiveMode:mode,tieBreakStatus:mode==='joint'?'not_applicable':'disabled',
    timeLimitSeconds:options.timeLimitSeconds??15,decisions:certificate.decisions,
  };
  const budget=options.timeLimitSeconds??15,solveStart=performance.now();
  const integerObjective=vars=>vars.every(v=>Number.isSafeInteger(v.coef))&&Number.isSafeInteger(vars.reduce((sum,v)=>sum+Math.abs(v.coef),0));
  const primaryInteger=integerObjective(model.objective.vars),secondaryInteger=integerObjective(fullCosts);
  const numericalAssurance={primarySafeInteger:primaryInteger,secondarySafeInteger:secondaryInteger,interpretation:primaryInteger?'Solver optimality for the stated integer-valued research objective.':'Non-integer objective: floating-point solver tolerances do not certify exact optimum or lexicographic equality.'};
  let raw=await glpk.solve(model,{msglev:glpk.GLP_MSG_OFF,presol:true,tmlim:budget,mipgap:0});
  const primaryStatus=raw.result.status;
  let tieBreakStatus=mode==='joint'?'not_applicable':options.lexicographic===false?'disabled':!primaryInteger?'numeric_primary_not_certified':primaryStatus!==glpk.GLP_OPT?'primary_not_proven':'not_run_budget';
  if (mode!=='joint' && options.lexicographic!==false && primaryStatus===glpk.GLP_OPT && primaryInteger) {
    const remaining=budget-(performance.now()-solveStart)/1000;
    if (remaining>.01) {
      const primary=Math.round(raw.result.z);
      const secondaryModel={...model,objective:{...model.objective,vars:fullCosts},subjectTo:[...model.subjectTo,{name:'fix_primary_optimum',vars:model.objective.vars,bnds:{type:glpk.GLP_FX,lb:primary,ub:primary}}]};
      const secondary=await glpk.solve(secondaryModel,{msglev:glpk.GLP_MSG_OFF,presol:true,tmlim:remaining,mipgap:0});
      if ([glpk.GLP_OPT,glpk.GLP_FEAS].includes(secondary.result.status)) {raw=secondary;tieBreakStatus=secondary.result.status===glpk.GLP_OPT&&secondaryInteger?'optimal':'feasible_only';}
      else tieBreakStatus='no_secondary_incumbent';
    }
  }
  const status=primaryStatus;
  const base={...method,numericalAssurance,solver:`GLPK ${glpk.version} via glpk.js 5.0.0`,solverStatus:status,modelSize,objectiveMode:mode,tieBreakStatus,timeLimitSeconds:budget};
  if (status===glpk.GLP_NOFEAS) return {...base,status:'infeasible',optimality:'proven_infeasible',reason:'GLPK proved that the stated constraints have no feasible schedule.'};
  if (![glpk.GLP_OPT,glpk.GLP_FEAS].includes(status)) return {...base,status:'time_limit',optimality:'not_proven',reason:'No feasible incumbent returned within the solver budget; this is not an infeasibility proof.'};
  const decisions=event.map(e=>['x','y','z'].map(k=>{
    const active=e[k].filter(v=>raw.result.vars[v.name]>.5);
    if (active.length!==1) throw new Error('Solver returned an invalid event assignment.');
    return active[0].day;
  }));
  return {...base,status:status===glpk.GLP_OPT&&primaryInteger?'optimal':'feasible',optimality:status===glpk.GLP_OPT?(primaryInteger?'proven_optimal':'solver_optimal_with_numeric_tolerance'):'feasible_incumbent_only',decisions};
}
