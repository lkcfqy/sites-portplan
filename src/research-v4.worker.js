import {runRollingScenario} from './rolling-plan.js';
self.onmessage=async({data})=>{
  try{
    const result=await runRollingScenario(data.scenario,data.events,{timeLimitSeconds:data.timeLimitSeconds??0.3});
    self.postMessage({id:data.id,result});
  }catch(error){self.postMessage({id:data.id,error:String(error?.message??error)});}
};
