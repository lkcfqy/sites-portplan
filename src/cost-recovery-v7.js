import {auditSchedule, capacityAt, containerCost, returnOffset, rowFor, stagingWeight, summarize, validateScenario} from './engine.js';
import {auditFrozenEvents} from './rolling-plan.js';
import {createRecoveryPlanner, solveLockedConstructor} from './recovery-planner-v6.js';

const DAYS=['pickupDay', 'unloadDay', 'returnDay'];
const CLOCK=()=>performance.now();
const DEFAULTS=Object.freeze({maxPasses:2, maxPairs:32, candidateCap:12, maxPairChecks:384, maxSingleTargets:16});
export const COST_RECOVERY_DEFAULTS=Object.freeze({timeBudgetMs:200,constructorShare:0.4,auditReserveMs:5,maxRestarts:15,retainFeasible:true,...DEFAULTS});
const dates=rows=>rows.map(row=>({id:row.id,pickupDay:row.pickupDay,unloadDay:row.unloadDay,returnDay:row.returnDay}));
const errorText=error=>error instanceof Error?error.message:String(error);
const trip=row=>({p:row.pickupDay,u:row.unloadDay,r:row.returnDay});
const tripKey=t=>`${t.p}:${t.u}:${t.r}`;

function parameters(options) {
  const out=Object.fromEntries(Object.keys(DEFAULTS).map(key=>[key,options[key]??DEFAULTS[key]]));
  for(const [key,hi]of [['maxPasses',4],['maxPairs',128],['candidateCap',32],['maxPairChecks',4096],['maxSingleTargets',100]]) {
    if(!Number.isInteger(out[key])||out[key]<0||out[key]>hi||key==='candidateCap'&&out[key]<4)throw new Error(`Invalid cost-polish ${key}.`);
  }
  return out;
}

function validate(s,options) {
  const validation=validateScenario(s);
  if(!validation.valid)throw new Error(validation.errors.join('; '));
  if((options.objectiveMode??s.objectiveMode??'joint')!=='joint')throw new Error('V7 cost polishing supports the joint fee objective only.');
  const day=options.minEventDay??0,fixed=options.fixedEvents??{},ids=new Set(s.containers.map(c=>c.id));
  if(!Number.isInteger(day)||day<0||day>s.horizonDays)throw new Error('minEventDay must be an integer within the horizon.');
  if(!fixed||typeof fixed!=='object'||Array.isArray(fixed))throw new Error('fixedEvents must be an object keyed by container id.');
  for(const [id,locks]of Object.entries(fixed)) {
    if(!ids.has(id)||!locks||typeof locks!=='object'||Array.isArray(locks))throw new Error('Invalid fixed-event container.');
    for(const [key,d]of Object.entries(locks))if(!DAYS.includes(key)||!Number.isInteger(d)||d<0||d>=s.horizonDays)throw new Error('Invalid fixed event date.');
  }
  for(const resource of ['truck','warehouse','staging'])for(let d=0;d<s.horizonDays;d++)if(!Number.isInteger(capacityAt(s[`${resource}Capacity`],d))||capacityAt(s[`${resource}Capacity`],d)<0)throw new Error('Every day must have a finite nonnegative integer capacity.');
}

function canonicalAudit(s,proposals,options) {
  const seen=new Set(),map=new Map(s.containers.map(c=>[c.id,c])),errors=[];
  if(!Array.isArray(proposals)||proposals.length!==s.containers.length)errors.push('Require one complete date proposal per known container.');
  if(Array.isArray(proposals))for(const row of proposals) {
    if(!row||!map.has(row.id)||seen.has(row.id)){errors.push('Unknown, duplicate or malformed date proposal.');continue;}
    seen.add(row.id);
    for(const key of DAYS)if(!Number.isInteger(row[key])||row[key]<0||row[key]>=s.horizonDays)errors.push(`${row.id}: ${key} must be an integer within the horizon.`);
    if(Number.isInteger(row.unloadDay)&&row.unloadDay+map.get(row.id).unloadDays-1>=s.horizonDays)errors.push(`${row.id}: unloading extends beyond the horizon.`);
  }
  if(errors.length)return {valid:false,errors,rows:[]};
  const byId=new Map(proposals.map(row=>[row.id,row]));
  const rows=s.containers.map(c=>{const row=byId.get(c.id);return rowFor(s,c,row.pickupDay,row.unloadDay,row.returnDay);});
  const scheduleAudit=auditSchedule(s,rows),freezeAudit=auditFrozenEvents(rows,options.fixedEvents??{},options.minEventDay??0);
  return {valid:scheduleAudit.valid&&freezeAudit.valid,errors:[...scheduleAudit.errors,...freezeAudit.errors],scheduleAudit,freezeAudit,rows};
}
const auditProof=audit=>({valid:audit.valid,errors:[...audit.errors],...(audit.scheduleAudit?{scheduleAudit:audit.scheduleAudit,freezeAudit:audit.freezeAudit}:{})});

/** Polish only a complete current-snapshot seed. Preserve it throughout search;
 * accept a move only after complete repricing, both audits, and strict joint fee
 * decrease. Expiration disables improvements; it never returns a partial plan.
 */
export function polishCompletePlan(scenario,seedCandidate,options={}) {
  const now=options.now??CLOCK;
  if(typeof now!=='function')throw new Error('now must be a function.');
  const started=now(),s=structuredClone(scenario),seed=structuredClone(seedCandidate),{now:ignoredClock,...dataOptions}=options,o=structuredClone(dataOptions);
  const deadline=o.deadlineMs??started+(o.timeBudgetMs??80),params=parameters(o);
  if(!Number.isFinite(deadline))throw new Error('Cost polishing requires a finite deadline.');
  validate(s,o);
  const expired=()=>now()>=deadline,metadata={method:'strict joint-fee complete-plan relocation and paired reinsertion',parameters:params,attempted:false,strictDecreaseOnly:true,sameSnapshotAndLocks:true,
    acceptedMoves:0,singleMovesExamined:0,pairMovesExamined:0,pairCombinationChecks:0,feasibleCandidatesAudited:0,equalCostMovesSkipped:0,capacityRejected:0,lateImprovementsDiscarded:0,acceptedMoveHistory:[]};
  const missing=reason=>({policy:'costPolishV7',status:'no_feasible_schedule_found',optimality:'not_proven',reason,rows:[],usage:[],totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,objectiveCost:null,lateCount:null,objectiveMode:'joint',runtimeMs:now()-started,
    polishMetadata:{...metadata,seedAccepted:false,jointNonincrease:null,wallTimeMs:now()-started,deadlineOverrunMs:Math.max(0,now()-deadline)}});
  if(!['optimal','feasible'].includes(seed?.status))return missing('The incoming seed is not a complete feasible candidate; no infeasibility proof is claimed.');
  const seedAudit=canonicalAudit(s,seed.rows,o);
  metadata.seedAudit=auditProof(seedAudit);
  if(!seedAudit.valid)return missing('The seed failed current-snapshot schedule or execution-lock audit.');
  let best=summarize(s,'costPolishV7',seedAudit.rows,now()-started,'feasible',{objectiveMode:'joint',optimality:'cost_polish_heuristic_no_optimality_claim'});
  const seedCost=best.incrementalCost,seedDates=dates(best.rows);
  metadata.seedAccepted=true;metadata.seedIncrementalCost=seedCost;metadata.seedObjectiveCost=best.objectiveCost;
  let finalAudit=seedAudit;
  const finish=()=>{
    if(best.incrementalCost>seedCost)throw new Error('Internal joint-fee nonincrease invariant violated.');
    return {...best,runtimeMs:now()-started,polishMetadata:{...metadata,finalIncrementalCost:best.incrementalCost,finalObjectiveCost:best.objectiveCost,jointNonincrease:best.incrementalCost<=seedCost,finalAudit:auditProof(finalAudit),
      beforeDates:seedDates,afterDates:dates(best.rows),wallTimeMs:now()-started,deadlineReached:expired(),deadlineOverrunMs:Math.max(0,now()-deadline)}};
  };
  if(expired()||params.maxPasses===0)return finish();
  metadata.attempted=true;
  const H=s.horizonDays,N=s.containers.length,day=o.minEventDay??0,fixed=o.fixedEvents??{};
  const caps=Object.fromEntries(['truck','warehouse','staging'].map(k=>[k,Array.from({length:H},(_,d)=>capacityAt(s[`${k}Capacity`],d))]));
  const locks=s.containers.map(c=>Object.hasOwn(fixed,c.id)?fixed[c.id]:{}),offsets=s.containers.map(c=>returnOffset(s,c)),weights=s.containers.map(c=>stagingWeight(s,c)),prices=new Map();
  const valid=(i,t)=>{
    const c=s.containers[i];
    if(![t.p,t.u,t.r].every(d=>Number.isInteger(d)&&d>=0&&d<H)||t.p<c.releaseDay||t.u<t.p||t.u+c.unloadDays-1>c.dueDay||t.r<t.u+offsets[i])return false;
    return DAYS.every((key,j)=>Object.hasOwn(locks[i],key)?locks[i][key]===[t.p,t.u,t.r][j]:[t.p,t.u,t.r][j]>=day);
  };
  const price=i=>{
    if(prices.has(i))return prices.get(i);
    const storage=[],dd=[];
    for(let d=0;d<H;d++) {
      if(expired())return null;
      const fee=containerCost(s.containers[i],d,d,s.horizonStart,s.tariff);storage[d]=fee.storageCost-fee.priorStorageCost;dd[d]=fee.ddCost-fee.priorDDCost;
    }
    const value={storage,dd};prices.set(i,value);return value;
  };
  const fee=(i,t)=>{const p=price(i);return p?p.storage[t.p]+p.dd[t.r]:Infinity;};
  const apply=(usage,i,t,sign)=>{
    usage.truck[t.p]+=sign;usage.truck[t.r]+=sign;
    for(let d=t.u;d<t.u+s.containers[i].unloadDays;d++)usage.warehouse[d]+=sign;
    for(let d=t.p;d<t.r;d++)usage.staging[d]+=sign*weights[i];
  };
  const without=removed=>{
    const usage={truck:new Int16Array(H),warehouse:new Int16Array(H),staging:new Int16Array(H)};
    for(let i=0;i<N;i++){if(expired())return null;if(!removed.has(i))apply(usage,i,trip(best.rows[i]),1);}
    return usage;
  };
  const fits=(usage,i,t)=>{
    if(expired())return false;
    if(usage.truck[t.p]+1+(t.p===t.r?1:0)>caps.truck[t.p]||usage.truck[t.r]+1+(t.p===t.r?1:0)>caps.truck[t.r])return false;
    for(let d=t.u;d<t.u+s.containers[i].unloadDays;d++)if(expired()||usage.warehouse[d]+1>caps.warehouse[d])return false;
    for(let d=t.p;d<t.r;d++)if(expired()||usage.staging[d]+weights[i]>caps.staging[d])return false;
    return true;
  };
  const propose=i=>{
    const old=trip(best.rows[i]),proposals=new Map(),oldFee=best.rows[i].incrementalCost;
    const add=t=>{if(!expired()&&valid(i,t))proposals.set(tripKey(t),{...t,cost:fee(i,t)});};
    add(old);
    for(let d=day;d<H&&!expired();d++){add({...old,p:d});add({...old,u:d});add({...old,r:d});}
    for(let u=Math.max(old.p,day);u<H&&!expired();u++)for(let r=Math.max(day,u+offsets[i]);r<=Math.min(H-1,old.r+2)&&!expired();r++)add({...old,u,r});
    for(const delta of [-3,-2,-1,1,2,3])add({p:Object.hasOwn(locks[i],'pickupDay')?old.p:old.p+delta,u:Object.hasOwn(locks[i],'unloadDay')?old.u:old.u+delta,r:Object.hasOwn(locks[i],'returnDay')?old.r:old.r+delta});
    const all=[...proposals.values()].sort((a,b)=>a.cost-b.cost||a.r-b.r||a.p-b.p||a.u-b.u);
    const ordered=[proposals.get(tripKey(old)),...all.filter(t=>t.cost<oldFee).slice(0,6),...all.filter(t=>t.cost>oldFee).slice(0,3),...all.filter(t=>t.cost===oldFee&&tripKey(t)!==tripKey(old)).slice(0,2)];
    return [...new Map(ordered.filter(Boolean).map(t=>[tripKey(t),t])).values()].slice(0,params.candidateCap);
  };
  const accept=(changes,type)=>{
    if(expired())return false;
    const proposals=dates(best.rows);
    for(const [i,t]of changes)proposals[i]={id:s.containers[i].id,pickupDay:t.p,unloadDay:t.u,returnDay:t.r};
    const audit=canonicalAudit(s,proposals,o);
    if(!audit.valid)return false;
    metadata.feasibleCandidatesAudited++;
    const candidate=summarize(s,'costPolishV7',audit.rows,now()-started,'feasible',{objectiveMode:'joint',optimality:'cost_polish_heuristic_no_optimality_claim'});
    if(expired()){metadata.lateImprovementsDiscarded++;return false;}
    if(candidate.incrementalCost===best.incrementalCost){metadata.equalCostMovesSkipped++;return false;}
    if(candidate.incrementalCost>=best.incrementalCost)return false;
    metadata.acceptedMoveHistory.push({type,beforeIncrementalCost:best.incrementalCost,afterIncrementalCost:candidate.incrementalCost,changedIds:changes.map(([i])=>s.containers[i].id)});
    metadata.acceptedMoves++;best=candidate;finalAudit=audit;return true;
  };
  for(let pass=0;pass<params.maxPasses&&!expired();pass++) {
    const before=metadata.acceptedMoves;
    const order=Array.from({length:N},(_,i)=>i).sort((a,b)=>best.rows[b].incrementalCost-best.rows[a].incrementalCost||s.containers[a].id.localeCompare(s.containers[b].id));
    for(const i of order.slice(0,params.maxSingleTargets)) {
      if(expired())break;
      const usage=without(new Set([i]));if(!usage)break;
      for(const t of propose(i).sort((a,b)=>a.cost-b.cost)) {
        if(expired())break;metadata.singleMovesExamined++;
        if(t.cost>=best.rows[i].incrementalCost){if(t.cost===best.rows[i].incrementalCost)metadata.equalCostMovesSkipped++;continue;}
        if(!fits(usage,i,t)){metadata.capacityRejected++;continue;}
        if(accept([[i,t]],'single-relocation'))break;
      }
    }
    const pairs=[],seen=new Set();
    for(const a of order.slice(0,params.maxSingleTargets))for(const b of order) {
      if(expired())break;
      if(a===b)continue;const key=[a,b].sort((x,y)=>x-y).join(':');if(seen.has(key))continue;
      const ta=trip(best.rows[a]),tb=trip(best.rows[b]);
      if(tb.p>=ta.p&&tb.r>=ta.r)continue;
      seen.add(key);
      const swapValid=valid(a,tb)&&valid(b,ta),gain=swapValid?best.rows[a].incrementalCost+best.rows[b].incrementalCost-fee(a,tb)-fee(b,ta):0;
      pairs.push({a,b,gain,priority:best.rows[a].incrementalCost});
    }
    pairs.sort((a,b)=>b.gain-a.gain||b.priority-a.priority||a.a-b.a||a.b-b.b);
    for(const {a,b}of pairs.slice(0,params.maxPairs)) {
      if(expired())break;metadata.pairMovesExamined++;
      const usage=without(new Set([a,b]));if(!usage)break;
      const oldA=trip(best.rows[a]),oldB=trip(best.rows[b]),pairFee=best.rows[a].incrementalCost+best.rows[b].incrementalCost;
      let improved=false;
      const combinations=[[oldB,oldA]];
      for(const field of ['p','u','r'])combinations.push([{...oldA,[field]:oldB[field]},{...oldB,[field]:oldA[field]}]);
      const tryPair=(ta,tb,type)=>{
        if(expired()||!valid(a,ta)||!valid(b,tb))return false;
        const cost=fee(a,ta)+fee(b,tb);
        if(cost>=pairFee){if(cost===pairFee)metadata.equalCostMovesSkipped++;return false;}
        if(!fits(usage,a,ta)){metadata.capacityRejected++;return false;}
        apply(usage,a,ta,1);
        let ok;
        try{ok=fits(usage,b,tb);}finally{apply(usage,a,ta,-1);}
        if(!ok){metadata.capacityRejected++;return false;}
        return accept([[a,ta],[b,tb]],type);
      };
      for(const [ta,tb]of combinations)if(tryPair(ta,tb,'pair-date-swap')){improved=true;break;}
      if(improved)continue;
      const aa=propose(a),bb=propose(b);
      for(const ta of aa){
        if(expired()||metadata.pairCombinationChecks>=params.maxPairChecks)break;
        for(const tb of bb){
          if(expired()||metadata.pairCombinationChecks>=params.maxPairChecks)break;
          metadata.pairCombinationChecks++;
          if(tryPair(ta,tb,'pair-reinsertion')){improved=true;break;}
        }
        if(improved)break;
      }
    }
    if(metadata.acceptedMoves===before)break;
  }
  return finish();
}

/** V6 keeps the original whole-call deadline and seed constructor allocation.
 * Seed gets the entire constructor deadline; polish uses only time left after
 * that bounded constructor returns. Valid cached dates are retained by default.
 */
export function createCostRecoveryPlanner(configuration={}) {
  const {seedConstructor=solveLockedConstructor,now=CLOCK,...dataConfiguration}=configuration;
  if(typeof seedConstructor!=='function'||typeof now!=='function')throw new Error('Invalid V7 callback or clock.');
  if((dataConfiguration.objectiveMode??'joint')!=='joint')throw new Error('V7 supports joint fees only.');
  const params=parameters(dataConfiguration),baseConfiguration={...dataConfiguration};
  for(const key of Object.keys(DEFAULTS))delete baseConfiguration[key];
  const defaultBudget=baseConfiguration.timeBudgetMs??200;
  let lastPolish=null,polishCalls=0,acceptedMoves=0;
  const constructor=async(s,options)=>{
    const {now:clock=CLOCK,...data}=options,snapshot=structuredClone(s),dataCopy=structuredClone(data);
    const seed=structuredClone(await seedConstructor(structuredClone(snapshot),{...structuredClone(dataCopy),now:clock}));
    const polished=polishCompletePlan(snapshot,seed,{...dataCopy,...params,now:clock});
    lastPolish=polished.polishMetadata;polishCalls++;acceptedMoves+=lastPolish.acceptedMoves;
    return {...polished,constructorMetadata:{...(seed?.constructorMetadata??{}),method:'V7 locked complete seed + strict joint-fee polishing',costPolish:lastPolish}};
  };
  const base=createRecoveryPlanner({...baseConfiguration,now,constructor,objectiveMode:'joint'});
  return async function costRecoveryPlanner(scenario,options={}) {
    const started=now(),snapshot=structuredClone(scenario),forwarded=structuredClone(options),budget=forwarded.timeBudgetMs??(forwarded.timeLimitSeconds!==undefined?forwarded.timeLimitSeconds*1000:defaultBudget);
    if(!Number.isFinite(budget)||budget<=0)throw new Error('The V7 whole-call budget must be positive and finite.');
    if((forwarded.objectiveMode??snapshot.objectiveMode??'joint')!=='joint')throw new Error('V7 supports joint fees only.');
    const remaining=budget-(now()-started);lastPolish=null;
    if(remaining<=0)return {policy:'costPolishV7',modelVersion:'v7-cost-recovery',status:'no_feasible_schedule_found',optimality:'not_proven',rows:[],usage:[],totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,objectiveCost:null,lateCount:null,reason:'Whole-call budget consumed before V6 recovery planning.',plannerMetadata:{method:'v7-cost-recovery',wholeCallBudgetMs:budget,wholeCallWallMs:now()-started,polishCalls,acceptedCostMoves:acceptedMoves}};
    forwarded.timeBudgetMs=remaining;
    const result=await base(snapshot,forwarded),originalStatus=result.status,proof=lastPolish;
    if(proof?.seedAccepted&&['optimal','feasible'].includes(result.status)&&result.incrementalCost>proof.seedIncrementalCost)throw new Error('Selected final candidate violates the same-snapshot complete seed fee guard.');
    return {...result,policy:'costPolishV7',modelVersion:'v7-cost-recovery',
      status:['optimal','feasible'].includes(originalStatus)?'feasible':originalStatus==='infeasible'?'no_feasible_schedule_found':originalStatus,
      optimality:result.plannerMetadata?.candidateSource==='retained_plan'?'retained_plan_not_reoptimized':['optimal','feasible'].includes(originalStatus)?'cost_recovery_heuristic_no_optimality_claim':'not_proven',
      ...(originalStatus==='infeasible'?{reason:'No complete schedule returned by recovery; the recorded subproblem infeasibility is not promoted to a V7 proof.'}:{}),
      plannerMetadata:{...result.plannerMetadata,method:'v7-cost-recovery',wholeCallBudgetMs:budget,wholeCallWallMs:now()-started,deadlineOverrunMs:Math.max(0,now()-started-budget),polishCalls,acceptedCostMoves:acceptedMoves,
        subproblemStatus:originalStatus,policyOptimalityClaim:false,...(proof?{polishMetadata:proof}:{}),
        finalVsAuditedSeedNonincrease:proof?.seedAccepted&&['optimal','feasible'].includes(originalStatus)?result.incrementalCost<=proof.seedIncrementalCost:null},runtimeMs:now()-started};
  };
}
