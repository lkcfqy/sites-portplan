import {capacityAt,rowFor,solveOptimized,summarize,auditSchedule} from './engine.js';

export function makeConservativeScenario(s,{extraUnloadDays=1,reserveTruckMovements=2}={}) {
  if (![extraUnloadDays,reserveTruckMovements].every(v=>Number.isInteger(v)&&v>=0)) throw new Error('Buffer amounts must be nonnegative integers.');
  const out=structuredClone(s);
  out.id=`${s.id}-conservative-${extraUnloadDays}-${reserveTruckMovements}`;
  out.truckCapacity=Array.from({length:s.horizonDays},(_,d)=>Math.max(0,capacityAt(s.truckCapacity,d)-reserveTruckMovements));
  out.containers.forEach(c=>{c.unloadDays+=extraUnloadDays;});
  return out;
}

/** Keep ALL planned event dates; recompute end dates/fees using the audited actual scenario. */
export function remapPlanToScenario(s,rows) {
  const byId=new Map(rows.map(row=>[row.id,row]));
  if (byId.size!==rows.length || rows.length!==s.containers.length) throw new Error('Require one complete unique row for each container.');
  return s.containers.map(c=>{
    const row=byId.get(c.id);
    if (!row) throw new Error(`Missing planned container ${c.id}`);
    return rowFor(s,c,row.pickupDay,row.unloadDay,row.returnDay);
  });
}

export async function solveConservativePlan(s,options={}) {
  const extraUnloadDays=options.extraUnloadDays??1,reserveTruckMovements=options.reserveTruckMovements??2;
  const worstCaseScenario=makeConservativeScenario(s,{extraUnloadDays,reserveTruckMovements});
  const worstCaseResult=await solveOptimized(worstCaseScenario,{timeLimitSeconds:options.timeLimitSeconds??2,objectiveMode:'joint'});
  const assumptions={extraUnloadDaysForEveryContainer:extraUnloadDays,truckMovementsReservedEveryDay:reserveTruckMovements,
    scope:'Static day-level bounded duration/capacity uncertainty; fixed event dates, no online updates; release/deadline/other capacities unchanged.'};
  if (!['optimal','feasible'].includes(worstCaseResult.status)||worstCaseResult.rows.length!==s.containers.length) return {worstCaseScenario,worstCaseResult,nominalResult:null,assumptions};
  const rows=remapPlanToScenario(s,worstCaseResult.rows),audit=auditSchedule(s,rows);
  if (!audit.valid) throw new Error(`Conservative-to-nominal mapping failed: ${audit.errors.join('; ')}`);
  const nominalResult=summarize(s,'conservativeBuffer',rows,worstCaseResult.runtimeMs,'feasible',{
    optimality:'conservative_feasible_not_nominal_optimal',worstCaseOptimality:worstCaseResult.optimality,objectiveMode:'joint'});
  return {worstCaseScenario,worstCaseResult,nominalResult,assumptions};
}
