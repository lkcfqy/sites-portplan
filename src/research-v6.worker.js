const METHODS=['dailyReoptV4','stableRetainV5','lockedRecoveryV6','persistenceRecoveryV6'];

// Each browser replay owns a new worker and a fresh planner cache. The simulator
// alone receives the private shock path; planners receive its causal snapshots.
self.onmessage=async({data})=>{
  const {id,method,scenario,events,callBudgets}=data;
  try {
    if(!METHODS.includes(method)||!callBudgets?.[method])throw new Error('未知策略或缺少冻结调用预算。');
    const started=performance.now(),config=structuredClone(callBudgets[method]);
    const {runRollingScenario}=await import('./rolling-plan.js');
    let planner;
    if(method==='dailyReoptV4'){
      const {solveOptimized}=await import('./engine.js');
      planner=solveOptimized;
    }else if(method==='stableRetainV5'){
      const {createStablePlanner}=await import('./stable-planner-v5.js');
      planner=createStablePlanner(config);
    }else if(method==='lockedRecoveryV6'){
      const {createRecoveryPlanner}=await import('./recovery-planner-v6.js');
      planner=createRecoveryPlanner(config);
    }else{
      const {createPersistencePlanner}=await import('./persistence-planner-v6.js');
      planner=createPersistencePlanner(config);
    }
    const trace=[],callWallMs=[];let decisionCalls=0,planningWallMs=0,latest={decisionCalls:0,solverCalls:0,constructorCalls:0,reusedPlans:0,replannedDueToInvalid:0};
    const result=await runRollingScenario(scenario,events,{
      timeLimitSeconds:config.timeLimitSeconds,objectiveMode:'joint',
      planner:async(snapshot,options)=>{
        const callStarted=performance.now();decisionCalls++;let candidate,error;
        try{
          candidate=await planner(snapshot,{...options,...(method.endsWith('V6')?{timeBudgetMs:config.timeBudgetMs}:{})});
          latest=candidate.plannerMetadata?{...candidate.plannerMetadata,decisionCalls,constructorCalls:method==='stableRetainV5'?0:candidate.plannerMetadata.constructorCalls??null}:{decisionCalls,solverCalls:decisionCalls,constructorCalls:0,reusedPlans:0,replannedDueToInvalid:0,candidateSource:'daily_solver'};
          return candidate;
        }catch(thrown){error=String(thrown?.message??thrown);latest={decisionCalls,solverCalls:method==='dailyReoptV4'?decisionCalls:null,constructorCalls:method.endsWith('V6')?null:0,reusedPlans:null,replannedDueToInvalid:null,candidateSource:'planner_exception'};throw thrown;}
        finally{const elapsed=performance.now()-callStarted;callWallMs.push(elapsed);planningWallMs+=elapsed;trace.push({day:options.minEventDay,...structuredClone(latest),callWallMs:elapsed,plannerStatus:candidate?.status??'planner_error',...(error?{error}:{})});}
      },
    });
    result.policy=method;result.plannerStats={...structuredClone(latest),decisionCalls,planningWallMs,callWallMs,maxCallWallMs:Math.max(0,...callWallMs)};result.plannerTrace=trace;result.executionHistoryUnavailable=false;
    result.browserReplay={callBudget:config,workerWallMs:performance.now()-started,scope:'Browser replay; not the archived cold-process held-out experiment.'};
    self.postMessage({id,result});
  }catch(error){self.postMessage({id,error:error instanceof Error?error.message:String(error)});}
};
