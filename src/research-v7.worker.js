const METHODS=['dailyReoptV4','stableRetainV5','lockedRecoveryV6','costPolishV7','graspBaselineV7'];
const DATE_PROOFS=new Set(['beforeDates','afterDates']);
const DEBUG=new Set(['model','modelObject','lp','subjectTo','binaries','vars','selectedTrips','eventDomains']);
function compact(value,key=''){
  if(!value||typeof value!=='object')return value;
  if((key==='rows'||key==='cachedRows')&&Array.isArray(value))return {omittedDuplicatePricingRows:value.length};
  if(DEBUG.has(key)||ArrayBuffer.isView(value))return {omittedBrowserDebugValue:true};
  if(Array.isArray(value)&&value.length>128&&!DATE_PROOFS.has(key)&&key!=='errors'&&key!=='auditErrors')return {omittedBrowserTelemetryElements:value.length};
  return Array.isArray(value)?value.map(item=>compact(item,key)):Object.fromEntries(Object.entries(value).map(([name,item])=>[name,compact(item,name)]));
}
// A browser replay has its own cache and wall clock; it never overwrites the
// official cold-process evidence. The simulator owns the private shock path.
self.onmessage=async({data})=>{
  const {id,method,scenario,events,callBudgets}=data;
  try{
    if(!METHODS.includes(method)||!callBudgets?.[method])throw new Error('未知策略或缺少冻结预算。');
    const started=performance.now(),configuration=structuredClone(callBudgets[method]),legacy=method==='dailyReoptV4'||method==='stableRetainV5';
    const {runRollingScenario}=await import('./rolling-plan.js');let planner;
    if(method==='dailyReoptV4'){const {solveOptimized}=await import('./engine.js');planner=(snapshot,options)=>solveOptimized(snapshot,{...configuration,...options});}
    else if(method==='stableRetainV5'){const {createStablePlanner}=await import('./stable-planner-v5.js');planner=createStablePlanner(configuration);}
    else if(method==='lockedRecoveryV6'){const {createRecoveryPlanner}=await import('./recovery-planner-v6.js');planner=createRecoveryPlanner(configuration);}
    else if(method==='costPolishV7'){const {createCostRecoveryPlanner}=await import('./cost-recovery-v7.js');planner=createCostRecoveryPlanner(configuration);}
    else{const {createGraspPlanner}=await import('./grasp-planner-v7.js');planner=createGraspPlanner(configuration);}
    const trace=[],callWallMs=[];let calls=0,planningWallMs=0,latest={};
    const result=await runRollingScenario(scenario,events,{timeLimitSeconds:configuration.timeLimitSeconds??.2,objectiveMode:'joint',planner:async(snapshot,options)=>{
      calls++;const began=performance.now();let candidate,error,metadata;
      try{
        candidate=await planner(snapshot,{...options,...(!legacy?{timeBudgetMs:configuration.timeBudgetMs}:{})});
        metadata=method==='dailyReoptV4'?{decisionCalls:calls,solverCalls:calls,constructorCalls:0,reusedPlans:0,replannedDueToInvalid:0,candidateSource:'daily_solver'}:candidate.plannerMetadata??{};
        latest={...Object.fromEntries(Object.entries(metadata).filter(([,value])=>value===null||['string','number','boolean'].includes(typeof value))),decisionCalls:calls,solverCalls:metadata.solverCalls??null,constructorCalls:method==='stableRetainV5'?0:metadata.constructorCalls??null,reusedPlans:metadata.reusedPlans??null,replannedDueToInvalid:metadata.replannedDueToInvalid??null};return candidate;
      }catch(thrown){error=String(thrown?.message??thrown);metadata={candidateSource:'planner_exception'};latest={decisionCalls:calls,solverCalls:method==='dailyReoptV4'?calls:null,constructorCalls:legacy?0:null,reusedPlans:null,replannedDueToInvalid:null,candidateSource:'planner_exception'};throw thrown;}
      finally{const telemetry=compact(metadata??{}),elapsed=performance.now()-began;planningWallMs+=elapsed;callWallMs.push(elapsed);trace.push({day:options.minEventDay,...telemetry,...latest,callWallMs:elapsed,plannerStatus:candidate?.status??'planner_error',...(error?{error}:{})});}
    }});
    result.policy=method;result.plannerTrace=trace;result.plannerStats={...latest,decisionCalls:calls,planningWallMs,callWallMs,maxCallWallMs:Math.max(0,...callWallMs)};result.executionHistoryUnavailable=false;
    result.browserReplay={configuration,workerWallMs:performance.now()-started,scope:'Local browser replay, separate from archived cold-process experiment; duplicate planner debug pricing rows omitted, physical timeline preserved.'};self.postMessage({id,result});
  }catch(error){self.postMessage({id,error:String(error?.message??error)});}
};
