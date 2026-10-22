import {auditSchedule,bestEarliestSlot,rowFor,scheduleUsage,solveBaseline,summarize,objectiveValue} from './engine.js';

/** Deterministic permutation search with complete greedy decoding and hard-constraint audit. */
export function solveStrongSearch(s, options={}) {
  const started=performance.now(),seed=(Number(options.seed??s.seed??42)>>>0)||1;
  const restartCount=options.restartCount??12,iterations=options.iterations??80;
  if (!Number.isInteger(restartCount)||restartCount<0||restartCount>128||!Number.isInteger(iterations)||iterations<0||iterations>5000) throw new Error('strongSearch restartCount must be 0..128 and iterations 0..5000.');
  const mode=options.objectiveMode??s.objectiveMode??'joint';
  let state=seed;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const map=new Map(s.containers.map(c=>[c.id,c]));
  const initial=options.initialPolicies??Object.fromEntries(['fifo','earliestFreeEnd','marginalCost','earliestDeadline'].map(k=>[k,solveBaseline(s,k,{objectiveMode:mode})]));
  const score=rows=>rows.reduce((sum,row)=>sum+objectiveValue(row,mode),0);
  const total=rows=>rows.reduce((sum,row)=>sum+row.incrementalCost,0);
  let bestRows=null,bestOrder=null,bestScore=Infinity,bestFull=Infinity;
  let evaluations=0,feasibleEvaluations=0,improvements=0,relocateAttempts=0,swapAttempts=0;
  const accept=(rows,order)=>{
    if (!rows) return;
    feasibleEvaluations++;
    const value=score(rows),full=total(rows);
    if (value<bestScore-1e-7 || Math.abs(value-bestScore)<1e-7&&full<bestFull-1e-7) {
      bestRows=rows;bestOrder=[...order];bestScore=value;bestFull=full;improvements++;
    }
  };
  for (const candidate of Object.values(initial)) if(candidate.rows?.length===s.containers.length && auditSchedule(s,candidate.rows).valid) accept(candidate.rows,candidate.rows.map(r=>r.id));
  const decode=order=>{
    evaluations++;
    const rows=[];
    for(const id of order) {
      const c=map.get(id),slot=bestEarliestSlot(s,c,scheduleUsage(s,rows));
      if (!slot) return null;
      rows.push(rowFor(s,c,slot.p,slot.u,slot.r));
    }
    const audit=auditSchedule(s,rows);
    if (!audit.valid) throw new Error(`Strong-search audit failed: ${audit.errors.join('; ')}`);
    return rows;
  };
  const all=s.containers.map(c=>c.id);
  for(let restart=0;restart<restartCount;restart++) {
    const order=[...all];
    for(let i=order.length-1;i>0;i--) {const j=Math.floor(random()*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    accept(decode(order),order);
  }
  for(let iteration=0;iteration<iterations;iteration++) {
    const order=[...(bestOrder??all)];
    const i=Math.floor(random()*order.length),j=Math.floor(random()*order.length);
    if(iteration%2===0) {const [item]=order.splice(i,1);order.splice(j,0,item);relocateAttempts++;}
    else {[order[i],order[j]]=[order[j],order[i]];swapAttempts++;}
    accept(decode(order),order);
  }
  const searchMetadata={algorithm:'deterministic multi-start greedy + permutation relocate/swap descent',seed,restartCount,iterations,
    evaluations,feasibleEvaluations,improvements,relocateAttempts,swapAttempts,initialPolicyCount:Object.keys(initial).length,
    budgetType:'fixed attempted candidates, not matched wall-clock time',includesInitialPolicyRuntime:!options.initialPolicies,wallTimeMs:performance.now()-started};
  if (!bestRows) return {policy:'strongSearch',status:'no_feasible_schedule_found',rows:[],totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,lateCount:null,objectiveCost:null,objectiveMode:mode,runtimeMs:searchMetadata.wallTimeMs,usage:[],optimality:'heuristic',searchMetadata,reason:'All fixed-budget starts and moves failed to construct a complete feasible schedule; not an infeasibility proof.'};
  return summarize(s,'strongSearch',bestRows,searchMetadata.wallTimeMs,'feasible',{optimality:'heuristic',objectiveMode:mode,searchMetadata});
}
