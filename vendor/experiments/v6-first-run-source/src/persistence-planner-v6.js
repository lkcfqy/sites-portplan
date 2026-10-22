import {capacityAt,validateScenario} from './engine.js';
import {createRecoveryPlanner} from './recovery-planner-v6.js';

/** A declared conservative forecast, not a revelation of future capacity. */
export function persistenceForecast(scenario,options={},persistenceDays=1){
  const validation=validateScenario(scenario);
  if(!validation.valid)throw new Error(validation.errors.join('; '));
  const today=options.minEventDay??0;
  if(!Number.isInteger(today)||today<0||today>=scenario.horizonDays)throw new Error('Forecast decision day must be within the horizon.');
  if(!Number.isInteger(persistenceDays)||persistenceDays<0||persistenceDays>7)throw new Error('persistenceDays must be an integer from 0 to 7.');
  const forecast=structuredClone(scenario),changes=[];
  for(const resource of ['truck','warehouse','staging']){
    const key=resource+'Capacity',current=capacityAt(scenario[key],today);
    forecast[key]=Array.from({length:scenario.horizonDays},(_,d)=>capacityAt(scenario[key],d));
    for(let day=today+1;day<Math.min(scenario.horizonDays,today+persistenceDays+1);day++){
      const nominal=forecast[key][day],predicted=Math.min(nominal,current);
      if(predicted!==nominal){forecast[key][day]=predicted;changes.push({resource,day,suppliedForecastCapacity:nominal,assumedCapacity:predicted});}
    }
  }
  return {scenario:forecast,changes,assumption:'Future capacity for the next declared days is capped at today\'s observed capacity. This can be too conservative and is not knowledge of shock duration.'};
}

export function createPersistencePlanner(config={}){
  const persistenceDays=config.persistenceDays??1,timeBudgetMs=config.timeBudgetMs??200;
  const underlying=config.planner??createRecoveryPlanner(config);
  if(typeof underlying!=='function')throw new Error('planner must be a function.');
  if(!Number.isFinite(timeBudgetMs)||timeBudgetMs<=0)throw new Error('timeBudgetMs must be positive and finite.');
  return async(scenario,options={})=>{
    const started=performance.now(),budget=options.timeBudgetMs??(options.timeLimitSeconds!==undefined?options.timeLimitSeconds*1000:timeBudgetMs);
    if(!Number.isFinite(budget)||budget<=0)throw new Error('The whole-call time budget must be positive and finite.');
    const forecast=persistenceForecast(scenario,options,persistenceDays),clonedOptions=structuredClone(options),forecastWallMs=performance.now()-started,remaining=budget-forecastWallMs;
    const result=remaining>0?await underlying(forecast.scenario,{...clonedOptions,timeBudgetMs:remaining}):{
      status:'no_feasible_schedule_found',complete:false,rows:[],usage:[],totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,objectiveCost:null,lateCount:null,
      objectiveMode:options.objectiveMode??scenario.objectiveMode??'joint',reason:'The declared call budget was consumed before recovery planning.'};
    return {...result,policy:'persistenceRecoveryV6',
      ...(result.status==='optimal'||result.status==='feasible'?{status:'feasible',optimality:'feasible_under_declared_forecast_not_nominal_optimality_proof'}:{}),
      ...(result.status==='infeasible'?{status:'no_feasible_schedule_found',optimality:'not_proven',reason:'The conservative forecast subproblem is infeasible; this does not prove the supplied nominal observation is infeasible.'}:{}),
      plannerMetadata:{...result.plannerMetadata,forecastPolicy:'current-capacity-persistence',persistenceDays,forecastChanges:forecast.changes,
        forecastAssumption:forecast.assumption,forecastWallMs,wholeCallBudgetMs:budget,wholeCallWallMs:performance.now()-started,
        forecastSubproblemStatus:result.status,nominalOptimalityClaim:false,nominalInfeasibilityClaim:false}};
  };
}
