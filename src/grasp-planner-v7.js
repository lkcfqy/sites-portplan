import {auditSchedule,capacityAt,containerCost,operationParameters,returnOffset,rowFor,stagingWeight,summarize,validateScenario} from './engine.js';
import {auditFrozenEvents} from './rolling-plan.js';

const EVENTS=['pickupDay','unloadDay','returnDay'],RESOURCES=['truck','warehouse','staging'],EPS=1e-6;
const clock=()=>performance.now();

// Problem-specific choices fixed before any V7 prospective experiment. This is
// classical GRASP adapted to the declared daily model, not a paper reproduction.
export const GRASP_V7_DEFAULTS=Object.freeze({timeBudgetMs:200,alpha:0.25,resourceImpactWeight:0.15,maxRestarts:127,maxLocalPasses:3,pairCandidateLimit:12,maxPairChecks:256,auditReserveMs:5,retainFeasible:true});

function validate(s,o){
  const v=validateScenario(s);if(!v.valid)throw new Error(v.errors.join('; '));
  const day=o.minEventDay??0,fixed=o.fixedEvents??{};
  if(!Number.isInteger(day)||day<0||day>s.horizonDays)throw new Error('minEventDay must be an integer within the horizon.');
  if(!fixed||typeof fixed!=='object'||Array.isArray(fixed))throw new Error('fixedEvents must be an object keyed by known container id.');
  const ids=new Set(s.containers.map(c=>c.id));
  for(const [id,locks]of Object.entries(fixed)){
    if(!ids.has(id)||!locks||typeof locks!=='object'||Array.isArray(locks))throw new Error('Unknown or invalid execution-lock container.');
    for(const [key,value]of Object.entries(locks))if(!EVENTS.includes(key)||!Number.isInteger(value)||value<0||value>=s.horizonDays)throw new Error('Invalid fixed event date.');
  }
  for(const resource of RESOURCES)for(let d=0;d<s.horizonDays;d++)if(!Number.isInteger(capacityAt(s[resource+'Capacity'],d))||capacityAt(s[resource+'Capacity'],d)<0)throw new Error('Every daily capacity must be a nonnegative integer.');
  if(!['joint','storageOnly','ddOnly'].includes(o.objectiveMode))throw new Error('Unknown objectiveMode.');
}
function validateSettings(o){
  for(const key of ['alpha','resourceImpactWeight'])if(!Number.isFinite(o[key])||o[key]<0||o[key]>1)throw new Error(`${key} must be between 0 and 1.`);
  for(const [key,min,max]of [['maxRestarts',0,128],['maxLocalPasses',0,8],['pairCandidateLimit',1,64],['maxPairChecks',0,4096]])if(!Number.isInteger(o[key])||o[key]<min||o[key]>max)throw new Error(`Invalid ${key}.`);
  if(!Number.isFinite(o.auditReserveMs)||o.auditReserveMs<0||typeof o.retainFeasible!=='boolean')throw new Error('Invalid audit reserve or retention policy.');
}
function empty(mode,reason){return {policy:'graspV7',modelVersion:'v7-source-adapted-classical-grasp',status:'no_feasible_schedule_found',optimality:'not_proven',reason,rows:[],usage:[],totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,objectiveCost:null,lateCount:null,objectiveMode:mode};}
function canonicalAudit(s,dates,o){
  if(!Array.isArray(dates)||dates.length!==s.containers.length)return {valid:false,errors:['Candidate must cover all known orders.'],rows:[]};
  const byId=new Map(),known=new Set(s.containers.map(c=>c.id));
  for(const row of dates){
    if(!row||!known.has(row.id)||byId.has(row.id)||EVENTS.some(key=>!Number.isInteger(row[key])||row[key]<0||row[key]>=s.horizonDays))return {valid:false,errors:['Malformed, duplicate or out-of-range candidate dates.'],rows:[]};
    byId.set(row.id,row);
  }
  const rows=s.containers.map(c=>{const r=byId.get(c.id);return rowFor(s,c,r.pickupDay,r.unloadDay,r.returnDay);});
  if(rows.some(r=>r.unloadEndDay>=s.horizonDays))return {valid:false,errors:['Unloading extends beyond the horizon.'],rows:[]};
  const schedule=auditSchedule(s,rows),frozen=auditFrozenEvents(rows,o.fixedEvents??{},o.minEventDay??0);
  return {valid:schedule.valid&&frozen.valid,errors:[...schedule.errors,...frozen.errors],rows};
}
function keyFor(s){return JSON.stringify({id:s.id??null,start:s.horizonStart,horizon:s.horizonDays,operations:operationParameters(s),orders:s.containers.map(c=>[c.id,c.sizeFt,c.dischargeDateTime,c.releaseDay,c.unloadDays,c.dueDay]).sort((a,b)=>a[0].localeCompare(b[0]))});}
const datesOf=rows=>rows.map(r=>({id:r.id,pickupDay:r.pickupDay,unloadDay:r.unloadDay,returnDay:r.returnDay}));
const improves=(a,b)=>a.primary<b.primary-EPS||Math.abs(a.primary-b.primary)<=EPS&&a.full<b.full-EPS;

/** One fresh factory per causal known-order episode. Only supplied snapshots and
 * executed-event locks are read. No future-shock list or realized future API. */
export function createGraspPlanner(configuration={}){
  const {now=clock,...inputSettings}=configuration;if(typeof now!=='function')throw new Error('now must be a clock function.');
  const configuredBudget=Object.hasOwn(inputSettings,'timeBudgetMs')?inputSettings.timeBudgetMs:Object.hasOwn(inputSettings,'timeLimitSeconds')?inputSettings.timeLimitSeconds*1000:GRASP_V7_DEFAULTS.timeBudgetMs;
  const defaults={...GRASP_V7_DEFAULTS,...structuredClone(inputSettings),timeBudgetMs:configuredBudget};validateSettings(defaults);
  if(!Number.isFinite(defaults.timeBudgetMs)||defaults.timeBudgetMs<=0)throw new Error('timeBudgetMs must be positive and finite.');
  let cached=null,lastDay=null;
  const counters={decisionCalls:0,solverCalls:0,constructorCalls:0,reusedPlans:0,replannedDueToInvalid:0};
  return async function graspPlanner(scenario,callOptions={}){
    const started=now(),s=structuredClone(scenario),o={...structuredClone(defaults),...structuredClone(callOptions)};
    // The legacy seconds field also means the whole call here; it does not
    // create a second budget for construction or local search.
    const budget=callOptions.timeBudgetMs??(callOptions.timeLimitSeconds!==undefined?callOptions.timeLimitSeconds*1000:defaults.timeBudgetMs);
    if(!Number.isFinite(budget)||budget<=0)throw new Error('The whole-call budget must be positive and finite.');
    o.objectiveMode??=s.objectiveMode??'joint';validate(s,o);validateSettings(o);counters.decisionCalls++;
    const deadline=started+budget,searchDeadline=deadline-o.auditReserveMs,day=o.minEventDay??0,episodeKey=keyFor(s),hadCache=Boolean(cached);
    const expired=()=>now()>=searchDeadline;
    const seed=(Number(o.seed??s.seed??42)>>>0)||1;
    let rng=(seed^Math.imul(day,2654435761))>>>0;
    const random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
    const shuffled=values=>{const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;};
    const stats={alpha:o.alpha,resourceImpactWeight:o.resourceImpactWeight,seed,randomRule:'LCG, seed XOR decisionDay*2654435761; Fisher-Yates container order',maxRestarts:o.maxRestarts,maxLocalPasses:o.maxLocalPasses,pairCandidateLimit:o.pairCandidateLimit,maxPairChecks:o.maxPairChecks,attemptCount:0,completedConstructions:0,tripDomainsEnumerated:0,feasibleInsertionChecks:0,rclSelections:0,singleChecks:0,singleImprovements:0,pairChecks:0,pairImprovements:0,auditedCandidates:0,firstIncumbentMs:null,lateCandidateDiscarded:0,cacheStatus:hadCache?'unexamined':'absent'};
    let best=null,bestSource='no_complete_plan',failureReason='GRASP did not find a complete audited schedule in the declared budget; this is not an infeasibility proof.';
    const metadata=()=>({method:'v7-source-adapted-classical-grasp',source:'Resende and Ribeiro, GRASP: Greedy Randomized Adaptive Search Procedures, revised December 2010, sections 2.2/2.4/3',...counters,candidateSource:bestSource,timeBudgetMs:budget,wallTimeMs:now()-started,deadlineOverrunMs:Math.max(0,now()-deadline),cooperativeDeadline:true,retainFeasible:o.retainFeasible,searchStats:{...stats},globalOptimalityClaim:false,localOptimalityClaim:false});
    const finish=()=>({...best??empty(o.objectiveMode,failureReason),runtimeMs:now()-started,plannerMetadata:metadata()});
    const accept=(dates,source)=>{
      if(now()>=deadline){stats.lateCandidateDiscarded++;return false;}
      const audit=canonicalAudit(s,dates,o);if(!audit.valid)return false;
      if(now()>=deadline){stats.lateCandidateDiscarded++;return false;}
      const result=summarize(s,'graspV7',audit.rows,now()-started,'feasible',{modelVersion:'v7-source-adapted-classical-grasp',objectiveMode:o.objectiveMode,optimality:['retained_plan','cached_incumbent'].includes(source)?'retained_plan_not_reoptimized':'source_adapted_grasp_heuristic',auditValid:true,solverStatus:null});
      const acceptedAt=now();if(acceptedAt>=deadline){stats.lateCandidateDiscarded++;return false;}
      stats.auditedCandidates++;
      if(!best||improves({primary:result.objectiveCost,full:result.incrementalCost},{primary:best.objectiveCost,full:best.incrementalCost})){best=result;bestSource=source;stats.firstIncumbentMs??=acceptedAt-started;return true;}return false;
    };
    if(cached){
      if(cached.key===episodeKey&&(lastDay===null||day>=lastDay)){
        const audit=canonicalAudit(s,cached.dates,o);stats.cacheStatus=audit.valid?'valid':'invalid';
        if(audit.valid&&accept(cached.dates,o.retainFeasible?'retained_plan':'cached_incumbent')){
          if(o.retainFeasible){counters.reusedPlans++;lastDay=day;return finish();}
        }else if(!audit.valid)counters.replannedDueToInvalid++;
      }else{stats.cacheStatus='different_episode_or_backwards_day';counters.replannedDueToInvalid++;cached=null;}
    }
    lastDay=day;if(expired())return finish();counters.constructorCalls++;
    const H=s.horizonDays,N=s.containers.length,locks=o.fixedEvents??{},capacities=Object.fromEntries(RESOURCES.map(resource=>[resource,Array.from({length:H},(_,d)=>capacityAt(s[resource+'Capacity'],d))]));
    const emptyUsage=()=>({truck:new Int32Array(H),warehouse:new Int32Array(H),staging:new Int32Array(H)});
    const apply=(usage,domain,trip,sign)=>{usage.truck[trip.p]+=sign;usage.truck[trip.r]+=sign;for(let d=trip.u;d<trip.u+domain.c.unloadDays;d++)usage.warehouse[d]+=sign;for(let d=trip.p;d<trip.r;d++)usage.staging[d]+=sign*domain.weight;};
    const fits=(usage,domain,trip)=>{
      stats.feasibleInsertionChecks++;
      if(expired())return false;
      if(trip.p===trip.r){if(usage.truck[trip.p]+2>capacities.truck[trip.p])return false;}
      else if(usage.truck[trip.p]+1>capacities.truck[trip.p]||usage.truck[trip.r]+1>capacities.truck[trip.r])return false;
      for(let d=trip.u;d<trip.u+domain.c.unloadDays;d++)if(expired()||usage.warehouse[d]+1>capacities.warehouse[d])return false;
      for(let d=trip.p;d<trip.r;d++)if(expired()||usage.staging[d]+domain.weight>capacities.staging[d])return false;return true;
    };
    const impact=(usage,domain,trip)=>{
      let value=trip.p===trip.r?2/(capacities.truck[trip.p]-usage.truck[trip.p]):1/(capacities.truck[trip.p]-usage.truck[trip.p])+1/(capacities.truck[trip.r]-usage.truck[trip.r]);
      for(let d=trip.u;d<trip.u+domain.c.unloadDays;d++)value+=1/(capacities.warehouse[d]-usage.warehouse[d]);
      for(let d=trip.p;d<trip.r;d++)value+=domain.weight/(capacities.staging[d]-usage.staging[d]);return value;
    };
    const domains=[];
    for(let index=0;index<N;index++){
      if(expired())return finish();const c=s.containers[index],fixed=Object.hasOwn(locks,c.id)?locks[c.id]:{},offset=returnOffset(s,c),latest=Math.min(c.dueDay-c.unloadDays+1,H-offset-1),domain={index,c,weight:stagingWeight(s,c),fixedCount:Object.keys(fixed).length,latest,trips:[]},storage=[],dd=[];
      for(let d=0;d<H;d++){if(expired())return finish();const cost=containerCost(c,d,d,s.horizonStart,s.tariff);storage[d]=cost.storageCost-cost.priorStorageCost;dd[d]=cost.ddCost-cost.priorDDCost;}
      const range=(key,lo,hi)=>Object.hasOwn(fixed,key)?[fixed[key]].filter(d=>d>=lo&&d<=hi):Array.from({length:Math.max(0,hi-Math.max(lo,day)+1)},(_,i)=>Math.max(lo,day)+i);
      const usage=emptyUsage();
      for(const p of range('pickupDay',c.releaseDay,latest))for(const u of range('unloadDay',p,latest))for(const r of range('returnDay',u+offset,H-1)){
        if(expired())return finish();stats.tripDomainsEnumerated++;const trip={p,u,r,full:storage[p]+dd[r],primary:o.objectiveMode==='storageOnly'?storage[p]:o.objectiveMode==='ddOnly'?dd[r]:storage[p]+dd[r]};if(fits(usage,domain,trip))domain.trips.push(trip);
      }
      domain.trips.sort((a,b)=>a.primary-b.primary||a.full-b.full||a.p-b.p||a.u-b.u||a.r-b.r);domains.push(domain);
      if(!domain.trips.length){failureReason='A container has no individually resource-feasible locked trip in the supplied observation; GRASP returns no complete schedule and supplies no solver certificate.';return finish();}
    }
    const selectedDates=selected=>selected.map((trip,i)=>({id:domains[i].c.id,pickupDay:trip.p,unloadDay:trip.u,returnDay:trip.r}));
    function construct(order){
      const usage=emptyUsage(),selected=Array(N).fill(null);
      for(const domain of order){
        if(expired())return null;const candidates=[];let costMin=Infinity,costMax=-Infinity,impactMin=Infinity,impactMax=-Infinity;
        for(const trip of domain.trips){if(expired())return null;if(!fits(usage,domain,trip))continue;const pressure=impact(usage,domain,trip);candidates.push({trip,pressure});costMin=Math.min(costMin,trip.primary);costMax=Math.max(costMax,trip.primary);impactMin=Math.min(impactMin,pressure);impactMax=Math.max(impactMax,pressure);}
        if(!candidates.length)return null;let min=Infinity,max=-Infinity;
        for(const candidate of candidates){if(expired())return null;const feePart=costMax>costMin?(candidate.trip.primary-costMin)/(costMax-costMin):0,resourcePart=impactMax>impactMin?(candidate.pressure-impactMin)/(impactMax-impactMin):0;candidate.score=(1-o.resourceImpactWeight)*feePart+o.resourceImpactWeight*resourcePart;min=Math.min(min,candidate.score);max=Math.max(max,candidate.score);}
        const threshold=min+o.alpha*(max-min),rcl=candidates.filter(candidate=>candidate.score<=threshold+Number.EPSILON*8);if(expired())return null;
        const trip=rcl[Math.floor(random()*rcl.length)].trip;stats.rclSelections++;selected[domain.index]=trip;apply(usage,domain,trip,1);
      }
      return {selected,usage};
    }
    function improveLocal(state){
      const {selected,usage}=state;
      for(let pass=0;pass<o.maxLocalPasses&&!expired();pass++){
        let improved=false;const order=shuffled(domains);
        for(const domain of order){
          if(expired())break;const old=selected[domain.index];apply(usage,domain,old,-1);let replacement=old;
          for(const trip of domain.trips){if(expired())break;stats.singleChecks++;if(!improves(trip,old))continue;if(fits(usage,domain,trip)){replacement=trip;break;}}
          selected[domain.index]=replacement;apply(usage,domain,replacement,1);
          if(replacement!==old){stats.singleImprovements++;improved=true;accept(selectedDates(selected),'grasp_single_move');}
        }
        for(let a=0;a<order.length&&!expired()&&stats.pairChecks<o.maxPairChecks;a++)for(let b=a+1;b<order.length&&!expired()&&stats.pairChecks<o.maxPairChecks;b++){
          const left=order[a],right=order[b],oldLeft=selected[left.index],oldRight=selected[right.index],oldPair={primary:oldLeft.primary+oldRight.primary,full:oldLeft.full+oldRight.full};
          if(oldPair.primary<=EPS&&oldPair.full<=EPS)continue;
          apply(usage,left,oldLeft,-1);apply(usage,right,oldRight,-1);let chosen=null;
          const leftCandidates=left.trips.filter(t=>t.primary<=oldPair.primary+EPS).slice(0,o.pairCandidateLimit),rightCandidates=right.trips.filter(t=>t.primary<=oldPair.primary+EPS).slice(0,o.pairCandidateLimit);
          if(!leftCandidates.includes(oldLeft))leftCandidates.push(oldLeft);if(!rightCandidates.includes(oldRight))rightCandidates.push(oldRight);
          for(const lt of leftCandidates){
            if(expired()||stats.pairChecks>=o.maxPairChecks)break;if(!fits(usage,left,lt))continue;apply(usage,left,lt,1);
            for(const rt of rightCandidates){if(expired()||stats.pairChecks>=o.maxPairChecks)break;stats.pairChecks++;if(improves({primary:lt.primary+rt.primary,full:lt.full+rt.full},oldPair)&&fits(usage,right,rt)){chosen={lt,rt};break;}}
            apply(usage,left,lt,-1);if(chosen)break;
          }
          selected[left.index]=chosen?.lt??oldLeft;selected[right.index]=chosen?.rt??oldRight;apply(usage,left,selected[left.index],1);apply(usage,right,selected[right.index],1);
          if(chosen){stats.pairImprovements++;improved=true;accept(selectedDates(selected),'grasp_pair_move');}
        }
        if(!improved)break;
      }
    }
    for(let attempt=0;attempt<=o.maxRestarts&&!expired();attempt++){
      const order=attempt===0?[...domains].sort((a,b)=>a.trips.length-b.trips.length||a.latest-b.latest||b.fixedCount-a.fixedCount||a.c.id.localeCompare(b.c.id)):shuffled(domains);stats.attemptCount++;
      const state=construct(order);if(!state)continue;stats.completedConstructions++;accept(selectedDates(state.selected),'grasp_construction');if(!expired())improveLocal(state);
    }
    if(best)cached={key:episodeKey,dates:datesOf(best.rows)};
    return finish();
  };
}

/** Stateless convenience entry point; rolling work should retain one factory. */
export async function solveGraspScenario(scenario,options={}){const {now,...dataOptions}=options;return createGraspPlanner({...dataOptions,...(now?{now}:{})})(scenario,dataOptions);}
