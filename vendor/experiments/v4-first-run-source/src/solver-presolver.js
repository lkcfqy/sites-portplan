import {auditSchedule,capacityAt,containerCost,returnOffset,stagingWeight} from './engine.js';

const KINDS=['x','y','z'];
const countEvents=event=>event.reduce((sum,e)=>sum+KINDS.reduce((n,k)=>n+e[k].length,0),0);

/**
 * Safe event-domain reduction for the time-indexed model.
 *
 * Every complete feasible schedule contains a separately feasible trip for each
 * container. Its objective is therefore >= sum(minimum separate-trip costs).
 * Conditional minima give the same bound with one event fixed. An audited
 * schedule supplies an upper bound; only events whose conditional lower bound
 * EXCEEDS that bound are removed. This retains every global optimum, including
 * every primary optimum needed by the lexicographic secondary solve.
 *
 * This is a bound/cutoff, not a GLPK warm start. It cannot ensure a MILP incumbent.
 */
export function presolveEventDomains(s,event,options={}) {
  const started=performance.now(),mode=options.objectiveMode??s.objectiveMode??'joint';
  const originalBinaries=countEvents(event);
  // Rolling-horizon locks are handled by their own model builder. Until their
  // interactions are separately verified, do not apply this optional reducer.
  if (options.fixedEvents!==undefined || options.minEventDay!==undefined) return {
    event,metadata:{enabled:false,reason:'rolling_event_constraints_not_supported',originalBinaries,retainedBinaries:originalBinaries,wallTimeMs:performance.now()-started},
  };
  const candidates=[],rejectedCandidates=[];
  for (const [key,candidate] of Object.entries(options.initialPolicies??{})) {
    if (!Array.isArray(candidate?.rows) || candidate.rows.length!==s.containers.length
      || candidate.rows.some(row=>!row || !['pickupDay','unloadDay','unloadEndDay','returnDay'].every(k=>Number.isInteger(row[k])&&row[k]>=0&&row[k]<s.horizonDays))
      || !auditSchedule(s,candidate.rows).valid) {rejectedCandidates.push(key);continue;}
    const rows=new Map(candidate.rows.map(row=>[row.id,row]));
    if(s.containers.some((c,i)=>{
      const row=rows.get(c.id);return KINDS.some((k,j)=>!event[i][k].some(v=>v.day===row[['pickupDay','unloadDay','returnDay'][j]]));
    })) {rejectedCandidates.push(key);continue;}
    const costs=s.containers.map(c=>{
      const row=rows.get(c.id),cost=containerCost(c,row.pickupDay,row.returnDay,s.horizonStart,s.tariff);
      const storage=cost.storageCost-cost.priorStorageCost,dd=cost.ddCost-cost.priorDDCost;
      return mode==='storageOnly'?storage:mode==='ddOnly'?dd:storage+dd;
    });
    if (costs.some(value=>!Number.isFinite(value))) {rejectedCandidates.push(key);continue;}
    candidates.push({key,rows,costs,objective:costs.reduce((sum,value)=>sum+value,0)});
  }
  candidates.sort((a,b)=>a.objective-b.objective||a.key.localeCompare(b.key));
  const incumbent=candidates[0]??null;
  const cutoff=incumbent?.objective??null;
  // Conservative tolerance protects cutoff and pruning at fractional tariff
  // multipliers. It is never used to declare the lower bound attained.
  const tolerance=1e-7+Math.abs(cutoff??0)*1e-9;
  const domains=event.map((e,i)=>{
    const c=s.containers[i],offset=returnOffset(s,c),weight=stagingWeight(s,c);
    const minima=Object.fromEntries(KINDS.map(k=>[k,new Map(e[k].map(v=>[v.day,Infinity]))]));
    const pickupCosts=new Map(e.x.map(v=>{
      const cost=containerCost(c,v.day,c.releaseDay+offset,s.horizonStart,s.tariff);
      return [v.day,mode==='ddOnly'?0:cost.storageCost-cost.priorStorageCost];
    }));
    const returnCosts=new Map(e.z.map(v=>{
      const cost=containerCost(c,c.releaseDay,v.day,s.horizonStart,s.tariff);
      return [v.day,mode==='storageOnly'?0:cost.ddCost-cost.priorDDCost];
    }));
    const unloadPossible=new Map(e.y.map(v=>{
      let possible=true;
      for(let d=v.day;d<v.day+c.unloadDays;d++) if(capacityAt(s.warehouseCapacity,d)<1)possible=false;
      return [v.day,possible];
    }));
    let minimum=Infinity,feasibleTrips=0;
    let exactIntegerArithmetic=[...pickupCosts.values(),...returnCosts.values()].every(Number.isSafeInteger);
    for(const x of e.x) {
      if(capacityAt(s.truckCapacity,x.day)<1)continue;
      for(const y of e.y) {
        if(y.day<x.day || !unloadPossible.get(y.day))continue;
        for(const z of e.z) {
          if(z.day<y.day+offset || capacityAt(s.truckCapacity,z.day)<1+(z.day===x.day?1:0))continue;
          let stagingPossible=true;
          for(let d=x.day;d<z.day;d++)if(capacityAt(s.stagingCapacity,d)<weight){stagingPossible=false;break;}
          if(!stagingPossible)continue;
          const value=pickupCosts.get(x.day)+returnCosts.get(z.day);
          exactIntegerArithmetic=exactIntegerArithmetic&&Number.isSafeInteger(value);
          feasibleTrips++;minimum=Math.min(minimum,value);
          for(const [k,v] of [['x',x],['y',y],['z',z]])minima[k].set(v.day,Math.min(minima[k].get(v.day),value));
        }
      }
    }
    return {minimum,minima,feasibleTrips,exactIntegerArithmetic};
  });
  const infeasibleContainerIds=domains.flatMap((d,i)=>Number.isFinite(d.minimum)?[]:[s.containers[i].id]);
  const lowerBound=infeasibleContainerIds.length?null:domains.reduce((sum,d)=>sum+d.minimum,0);
  let unsupportedEventsRemoved=0,boundEventsRemoved=0;
  const reduced=event.map((e,i)=>Object.fromEntries(KINDS.map(k=>[k,e[k].filter(v=>{
    const conditional=domains[i].minima[k].get(v.day);
    if(!Number.isFinite(conditional)){unsupportedEventsRemoved++;return false;}
    if(cutoff!==null && lowerBound!==null && conditional+lowerBound-domains[i].minimum>cutoff+tolerance){boundEventsRemoved++;return false;}
    return true;
  })])));
  // Prove attainment per container with exact safe-integer arithmetic. A
  // fractional binary64 sum can hide an arbitrarily small difference, even
  // when its rounded value equals the bound; it receives no exact certificate.
  // Cutoff tolerance must never become an optimality tolerance.
  const exactBoundCertificateEligible=Boolean(incumbent && lowerBound!==null && Number.isSafeInteger(lowerBound)
    && Number.isSafeInteger(cutoff) && domains.every(d=>d.exactIntegerArithmetic));
  const certificate=exactBoundCertificateEligible && incumbent.costs.every((value,i)=>value===domains[i].minimum) ? {
    type:'independent_container_lower_bound_attained',sourcePolicy:incumbent.key,
    objective:cutoff,lowerBound,decisions:s.containers.map(c=>{
      const row=incumbent.rows.get(c.id);return [row.pickupDay,row.unloadDay,row.returnDay];
    }),
  }:null;
  return {event:reduced,cutoff,cutoffTolerance:tolerance,certificate,metadata:{
    enabled:true,algorithm:'separate-trip conditional lower bounds with audited feasible cutoff',objectiveMode:mode,
    originalBinaries,retainedBinaries:countEvents(reduced),unsupportedEventsRemoved,boundEventsRemoved,
    singletonEventDomains:reduced.reduce((sum,e)=>sum+KINDS.filter(k=>e[k].length===1).length,0),
    independentLowerBound:lowerBound,feasibleUpperBound:cutoff,cutoffTolerance:tolerance,upperBoundSource:incumbent?.key??null,
    auditedCandidateCount:candidates.length,rejectedCandidates,infeasibleContainerIds,
    independentlyFeasibleTrips:domains.reduce((sum,d)=>sum+d.feasibleTrips,0),
    certificate:certificate?{type:certificate.type,sourcePolicy:certificate.sourcePolicy,objective:cutoff,lowerBound}:null,
    exactBoundCertificateEligible,certificateArithmetic:certificate?'safe_integer_objective_coefficients_and_sums':null,
    preservesPrimaryOptimalSet:true,isWarmStart:false,wallTimeMs:performance.now()-started,
  }};
}
