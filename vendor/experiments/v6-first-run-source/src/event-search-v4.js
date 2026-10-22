import {auditSchedule,capacityAt,containerCost,objectiveValue,returnOffset,rowFor,solveBaseline,stagingWeight,summarize} from './engine.js';

/**
 * An anytime heuristic over actual (p,u,r) dates. A move can delay pickup,
 * advance return, or change unloading dates without an earliest decoder.
 * Partial repairs are discarded and never receive a valid fee total.
 */
export function solveEventSearch(s,options={}) {
  const started=performance.now(),mode=options.objectiveMode??s.objectiveMode??'joint';
  const deadline=options.deadlineMs??started+(options.timeBudgetMs??1000);
  if(!Number.isFinite(deadline))throw new Error('Event search requires a finite deadline.');
  let state=(Number(options.seed??s.seed??42)>>>0)||1;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const expired=()=>performance.now()>=deadline;
  const H=s.horizonDays,containers=s.containers,map=new Map(containers.map(c=>[c.id,c]));
  const truckCap=Array.from({length:H},(_,d)=>capacityAt(s.truckCapacity,d));
  const warehouseCap=Array.from({length:H},(_,d)=>capacityAt(s.warehouseCapacity,d));
  const stagingCap=Array.from({length:H},(_,d)=>capacityAt(s.stagingCapacity,d));
  const metadata={algorithm:'direct event-date relocation + bounded randomized destroy/repair',seed:state,
    relocations:0,destroyRepairAttempts:0,fullRestartAttempts:0,tripCandidates:0,capacityChecks:0,
    completeAuditedCandidates:0,improvements:0,initialPolicyCount:0,deadlineChecksInsideCandidateLoops:true};
  let bestRows=null,bestScore=Infinity,bestFull=Infinity,bestSource=null;
  const scores=rows=>({primary:rows.reduce((n,r)=>n+objectiveValue(r,mode),0),full:rows.reduce((n,r)=>n+r.incrementalCost,0)});
  const better=(score,full)=>score<bestScore-1e-7||Math.abs(score-bestScore)<1e-7&&full<bestFull-1e-7;
  const output=()=>bestRows?summarize(s,'eventSearch',bestRows,performance.now()-started,'feasible',{
    optimality:'heuristic',objectiveMode:mode,incumbentSource:bestSource,
    searchMetadata:{...metadata,wallTimeMs:performance.now()-started,deadlineReached:expired()},
  }):{policy:'eventSearch',status:'no_feasible_schedule_found',optimality:'heuristic',rows:[],usage:[],
    totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,lateCount:null,objectiveCost:null,
    objectiveMode:mode,runtimeMs:performance.now()-started,reason:'No complete audited schedule found before deadline; this is not an infeasibility proof.',
    searchMetadata:{...metadata,wallTimeMs:performance.now()-started,deadlineReached:expired()}};
  const accept=(rows,source)=>{
    if(expired()||rows?.length!==containers.length)return false;
    // External incumbents are date proposals, never trusted fee records.
    // Preflight before audit/row construction prevents malformed date loops.
    const seen=new Set(),canonical=[];
    for(const row of rows) {
      if(expired()||!row||!map.has(row.id)||seen.has(row.id)
        ||!['pickupDay','unloadDay','returnDay'].every(key=>Number.isInteger(row[key])&&row[key]>=0&&row[key]<H))return false;
      seen.add(row.id);
      canonical.push(rowFor(s,map.get(row.id),row.pickupDay,row.unloadDay,row.returnDay));
    }
    const audit=auditSchedule(s,canonical);
    if(!audit.valid)return false;
    metadata.completeAuditedCandidates++;
    const {primary,full}=scores(canonical);
    if(!better(primary,full))return false;
    bestRows=canonical;bestScore=primary;bestFull=full;bestSource=source;metadata.improvements++;
    if(options.onIncumbent&&!expired())options.onIncumbent(output());
    return true;
  };
  const initial=options.initialPolicies??{};
  if(options.initialPolicies) {
    for(const [key,result]of Object.entries(initial)) {
      if(expired())break;metadata.initialPolicyCount++;accept(result.rows,key);
    }
  } else {
    for(const key of ['fifo','earliestFreeEnd','marginalCost','earliestDeadline']) {
      if(expired())break;
      const result=solveBaseline(s,key,{objectiveMode:mode});metadata.initialPolicyCount++;accept(result.rows,key);
    }
  }
  const emptyUsage=()=>({truck:Array(H).fill(0),warehouse:Array(H).fill(0),staging:Array(H).fill(0)});
  const apply=(usage,c,trip,sign)=>{
    usage.truck[trip.p]+=sign;usage.truck[trip.r]+=sign;
    for(let d=trip.u;d<trip.u+c.unloadDays;d++)usage.warehouse[d]+=sign;
    for(let d=trip.p;d<trip.r;d++)usage.staging[d]+=sign*stagingWeight(s,c);
  };
  const fits=(usage,c,trip)=>{
    metadata.capacityChecks++;
    if(expired())return false;
    if(usage.truck[trip.p]+1+(trip.p===trip.r?1:0)>truckCap[trip.p]||usage.truck[trip.r]+1+(trip.p===trip.r?1:0)>truckCap[trip.r])return false;
    for(let d=trip.u;d<trip.u+c.unloadDays;d++) {if(expired()||usage.warehouse[d]+1>warehouseCap[d])return false;}
    const weight=stagingWeight(s,c);
    for(let d=trip.p;d<trip.r;d++) {if(expired()||usage.staging[d]+weight>stagingCap[d])return false;}
    return true;
  };
  const toTrip=row=>({p:row.pickupDay,u:row.unloadDay,r:row.returnDay,primary:objectiveValue(row,mode),full:row.incrementalCost});
  const domains=new Map();
  for(const c of containers) {
    if(expired())break;
    const domain=[],cache=new Map(),usage=emptyUsage(),offset=returnOffset(s,c);
    for(let p=c.releaseDay;p<H&&!expired();p++)for(let u=p;u+c.unloadDays-1<=c.dueDay&&u+offset<H&&!expired();u++)for(let r=u+offset;r<H&&!expired();r++) {
      const trip={p,u,r};
      if(!fits(usage,c,trip))continue;
      const key=`${p}:${r}`;
      if(!cache.has(key))cache.set(key,containerCost(c,p,r,s.horizonStart,s.tariff));
      const cost=cache.get(key);trip.primary=objectiveValue(cost,mode);trip.full=cost.incrementalCost;
      domain.push(trip);metadata.tripCandidates++;
    }
    domain.sort((a,b)=>a.primary-b.primary||a.full-b.full||(a.r-a.p)-(b.r-b.p)||a.r-b.r||a.p-b.p||a.u-b.u);
    domains.set(c.id,domain);
  }
  if(domains.size!==containers.length||expired())return output();
  const makeRows=trips=>containers.map(c=>{const t=trips.get(c.id);return rowFor(s,c,t.p,t.u,t.r);});
  const pick=(usage,c,explore)=>{
    const candidates=[];
    for(const trip of domains.get(c.id)) {
      if(expired())return null;
      if(fits(usage,c,trip)) {
        candidates.push(trip);
        if(!explore||candidates.length>=3)break;
      }
    }
    if(!candidates.length)return null;
    // Mostly best cost, occasionally one of the first three feasible dates.
    return candidates[explore&&random()<.25?Math.floor(random()*candidates.length):0];
  };
  const repair=(base,removed,explore)=>{
    const usage=emptyUsage(),trips=new Map();
    for(const [id,trip]of base) {if(expired())return null;trips.set(id,trip);apply(usage,map.get(id),trip,1);}
    const order=removed.map(id=>({c:map.get(id),draw:random()}));
    order.sort((a,b)=>explore?a.draw-b.draw:a.c.dueDay-a.c.unloadDays-(b.c.dueDay-b.c.unloadDays)||domains.get(a.c.id).length-domains.get(b.c.id).length);
    for(const {c}of order) {
      if(expired())return null;
      const trip=pick(usage,c,explore);
      if(!trip)return null;
      trips.set(c.id,trip);apply(usage,c,trip,1);
    }
    return trips;
  };
  let current=bestRows?new Map(bestRows.map(r=>[r.id,toTrip(r)])):null,iteration=0;
  while(!expired()) {
    iteration++;
    if(!current||iteration%24===0) {
      metadata.fullRestartAttempts++;
      const fresh=repair(new Map(),containers.map(c=>c.id),iteration%2===0);
      if(fresh) {const rows=makeRows(fresh);accept(rows,'direct-event-restart');current=fresh;}
      continue;
    }
    if(iteration%3===0) {
      const c=containers[Math.floor(random()*containers.length)],old=current.get(c.id),usage=emptyUsage();
      for(const [id,trip]of current) {if(expired())break;if(id!==c.id)apply(usage,map.get(id),trip,1);}
      metadata.relocations++;
      const trip=pick(usage,c,false);
      if(trip&&(trip.primary<old.primary-1e-7||Math.abs(trip.primary-old.primary)<1e-7&&trip.full<=old.full+1e-7)) {
        current.set(c.id,trip);accept(makeRows(current),'direct-event-relocation');
      }
    } else {
      metadata.destroyRepairAttempts++;
      const shuffled=containers.map(c=>({id:c.id,draw:random()})).sort((a,b)=>a.draw-b.draw);
      const count=Math.min(containers.length,2+Math.floor(random()*5)),removed=shuffled.slice(0,count).map(c=>c.id);
      const base=new Map([...current].filter(([id])=>!removed.includes(id)));
      const repaired=repair(base,removed,true);
      if(!repaired)continue;
      const rows=makeRows(repaired),score=scores(rows),old=scores(makeRows(current));
      accept(rows,'direct-event-destroy-repair');
      // Small uphill moves allow escaping local minima; best incumbent is kept.
      if(score.primary<=old.primary+Math.max(1,.005*bestScore)&&score.full<=old.full+Math.max(1,.005*bestFull))current=repaired;
      else if(iteration%12===0&&bestRows)current=new Map(bestRows.map(r=>[r.id,toTrip(r)]));
    }
  }
  return output();
}
