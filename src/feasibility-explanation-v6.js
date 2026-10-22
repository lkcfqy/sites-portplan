import {capacityAt,operationParameters,validateScenario} from './engine.js';
import {constrainExecutionDomains} from './execution-constraints.js';

const range=(start,end)=>Array.from({length:Math.max(0,end-start+1)},(_,i)=>({day:start+i}));
const overlap=(start,end,left,right)=>Math.max(0,Math.min(end,right)-Math.max(start,left)+1);
const resourceNames={truck:'运输作业次数',warehouse:'卸货槽日',staging:'在场占用单位日'};

/** Necessary resource bounds, not a full feasibility solver.
 * For each job and interval, minimize usage over ALL admissible dates before
 * summing independent minima. A violated bound certifies infeasibility; passing
 * every bound never certifies feasibility. No costs or future events are read.
 */
export function explainFeasibility(scenario,options={}) {
  const checked=validateScenario(scenario);
  if(!checked.valid)throw new Error(checked.errors.join('; '));
  const maxWitnesses=options.maxWitnesses??6;
  if(!Number.isInteger(maxWitnesses)||maxWitnesses<1||maxWitnesses>100)throw new Error('maxWitnesses must be an integer from 1 to 100.');
  const started=performance.now(),operations=operationParameters(scenario),horizon=scenario.horizonDays;
  const events=scenario.containers.map(c=>({
    x:range(c.releaseDay,Math.min(c.dueDay-c.unloadDays+1,horizon-c.unloadDays-operations.returnLagDays)),
    y:range(c.releaseDay,Math.min(c.dueDay-c.unloadDays+1,horizon-c.unloadDays-operations.returnLagDays)),
    z:range(c.releaseDay+c.unloadDays-1+operations.returnLagDays,horizon-1),
  }));
  const constrained=constrainExecutionDomains(scenario,events,options).event;
  const domains=scenario.containers.map((c,i)=>{
    const {x,y,z}=constrained[i],admissible=[];
    for(const {day:u} of y){
      const picks=x.filter(v=>v.day<=u),returns=z.filter(v=>v.day>=u+c.unloadDays-1+operations.returnLagDays);
      if(picks.length&&returns.length)admissible.push({unload:u,pLow:picks[0].day,pHigh:picks.at(-1).day,rLow:returns[0].day,rHigh:returns.at(-1).day,tripCount:picks.length*returns.length});
    }
    return {id:c.id,duration:c.unloadDays,weight:operations.stagingUnit==='teu'?c.sizeFt/20:1,admissible,
      admissibleTripCount:admissible.reduce((sum,d)=>sum+d.tripCount,0),
      eventDomains:{pickup:x.map(v=>v.day),unload:y.map(v=>v.day),return:z.map(v=>v.day)}};
  });
  const base={method:'v6-necessary-resource-interval-bounds',scope:'Declared daily model and execution constraints; necessary bounds only, not an external operational certification',
    minEventDay:options.minEventDay??0,usesOnlySuppliedScenarioAndExecutionConstraints:true,feasible:null,optimality:'not_applicable',
    domainCounts:domains.map(d=>({id:d.id,admissibleTripCount:d.admissibleTripCount})),
    resourceUnits:{truck:'movements',warehouse:'slot-days',staging:operations.stagingUnit==='teu'?'TEU-days':'container-days'}};
  const empty=domains.filter(d=>!d.admissible.length);
  if(empty.length)return {...base,status:'proven_infeasible_necessary_condition',proofKind:'empty_event_domain',
    emptyDomainCount:empty.length,witnesses:empty.slice(0,maxWitnesses).map(d=>({kind:'empty_event_domain',id:d.id,eventDomains:d.eventDomains,
      explanation:'No pickup / unloading / return combination satisfies the calendar, hard deadline and execution locks, even before resource capacities.'})),
    intervalsChecked:0,violatedBoundCount:0,runtimeMs:performance.now()-started};
  const capacities=Object.fromEntries(['truck','warehouse','staging'].map(resource=>{
    const prefix=[0];for(let d=0;d<horizon;d++)prefix.push(prefix.at(-1)+capacityAt(scenario[resource+'Capacity'],d));return [resource,prefix];
  }));
  const witnesses=[];let intervalsChecked=0,violatedBoundCount=0;
  for(let left=0;left<horizon;left++)for(let right=left;right<horizon;right++){
    intervalsChecked++;
    const contributors={truck:[],warehouse:[],staging:[]},required={truck:0,warehouse:0,staging:0};
    for(const domain of domains){
      let truck=Infinity,warehouse=Infinity,staging=Infinity;
      for(const d of domain.admissible){
        // Conditional p/r domains are contiguous or singletons. An outside
        // date exists exactly when either endpoint lies outside the interval.
        truck=Math.min(truck,Number(d.pLow>=left&&d.pHigh<=right)+Number(d.rLow>=left&&d.rHigh<=right));
        warehouse=Math.min(warehouse,overlap(d.unload,d.unload+domain.duration-1,left,right));
        // Latest permissible pickup and earliest permissible return minimize
        // occupancy for a fixed unload day, by monotonicity of [pickup,return).
        staging=Math.min(staging,domain.weight*overlap(d.pHigh,d.rLow-1,left,right));
      }
      for(const [resource,minimum] of Object.entries({truck,warehouse,staging})){required[resource]+=minimum;if(minimum)contributors[resource].push({id:domain.id,minimumUsage:minimum});}
    }
    for(const resource of ['truck','warehouse','staging']){
      const capacity=capacities[resource][right+1]-capacities[resource][left];
      if(required[resource]<=capacity)continue;
      violatedBoundCount++;
      witnesses.push({kind:'resource_interval_lower_bound',resource,unit:resourceNames[resource],fromDay:left,toDay:right,
        minimumRequired:required[resource],availableCapacity:capacity,deficit:required[resource]-capacity,contributors:contributors[resource],
        explanation:'Sum of each container\'s minimum usage across every admissible date combination exceeds the interval capacity. Increasing algorithm runtime cannot remove this contradiction.'});
    }
  }
  witnesses.sort((a,b)=>b.deficit-a.deficit||(a.toDay-a.fromDay)-(b.toDay-b.fromDay)||a.fromDay-b.fromDay||a.resource.localeCompare(b.resource));
  return {...base,status:witnesses.length?'proven_infeasible_necessary_condition':'not_proven_infeasible',
    proofKind:witnesses.length?'resource_interval_lower_bound':null,witnesses:witnesses.slice(0,maxWitnesses),violatedBoundCount,intervalsChecked,
    conclusion:witnesses.length?'At least one necessary condition is violated.':'No necessary bound was violated; feasibility and recovery remain unresolved without a complete audited plan or solver proof.',
    runtimeMs:performance.now()-started};
}
