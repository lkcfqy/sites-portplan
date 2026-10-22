import {runRollingScenario} from './rolling-plan.js';
import {createStablePlanner} from './stable-planner-v5.js';
import {solveOptimized} from './engine.js';
self.onmessage=async({data})=>{
  try{
    const stable=data.method==='stableRetain'?createStablePlanner({timeLimitSeconds:.2}):null;
    let calls=0,latest={solverCalls:0,reusedPlans:0};const trace=[];
    const result=await runRollingScenario(data.scenario,data.events,{timeLimitSeconds:.2,planner:async(s,o)=>{
      calls++;const candidate=stable?await stable(s,o):await solveOptimized(s,o);
      latest=stable?candidate.plannerMetadata:{decisionCalls:calls,solverCalls:calls,reusedPlans:0,candidateSource:'daily_solver'};
      trace.push({day:o.minEventDay,...structuredClone(latest)});return candidate;
    }});
    result.plannerStats=latest;result.plannerTrace=trace;result.policy=data.method;
    self.postMessage({id:data.id,result});
  }catch(error){self.postMessage({id:data.id,error:String(error?.message??error)});}
};
