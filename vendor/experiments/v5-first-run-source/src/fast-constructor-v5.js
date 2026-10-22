import {auditSchedule,capacityAt,containerCost,objectiveValue,returnOffset,rowFor,stagingWeight,summarize,validateScenario} from './engine.js';

/**
 * Bounded feasible constructor. Date domains and separable day prices are built
 * once; each attempt sorts containers once and updates resource arrays in place.
 * The result is an audited heuristic incumbent, never an optimality certificate.
 */
export function solveFastConstructor(s,options={}) {
  const started=performance.now(),mode=options.objectiveMode??s?.objectiveMode??'joint';
  const timeBudget=options.timeBudgetMs??1000,deadline=options.deadlineMs??started+timeBudget;
  const maxRestarts=options.maxRestarts??15;
  if(!Number.isFinite(deadline)||!Number.isFinite(timeBudget)||timeBudget<0)throw new Error('Fast constructor requires a finite deadline and nonnegative finite timeBudgetMs.');
  if(!Number.isInteger(maxRestarts)||maxRestarts<0||maxRestarts>128)throw new Error('Fast constructor maxRestarts must be an integer from 0 to 128.');
  if(!['joint','storageOnly','ddOnly'].includes(mode))throw new Error('Invalid fast constructor objectiveMode.');
  if(options.onIncumbent!==undefined&&typeof options.onIncumbent!=='function')throw new Error('onIncumbent must be a function.');
  if(options.fixedEvents!==undefined||options.minEventDay!==undefined)throw new Error('Fast constructor does not support executed-event locks.');
  const expired=()=>performance.now()>=deadline;
  const seed=(Number(options.seed??s?.seed??42)>>>0)||1;
  let state=seed;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const metadata={algorithm:'cached separable trip prices + one-sort incremental construction + bounded rollback repair',seed,maxRestarts,
    sortOrder:['deadline','release','feeJump','domainSize','seededRandom'],attemptCount:0,randomRestartCount:0,
    tripCandidates:0,dayPriceEvaluations:0,capacityChecks:0,repairAttempts:0,repairCandidateChecks:0,
    completeAuditedCandidates:0,improvements:0,firstIncumbentMs:null,preparationMs:null,
    maxPlacedBeforeFailure:0,attempts:[],callbackErrors:[],deadlineChecksInsideCandidateLoops:true};
  let best=null,bestPrimary=Infinity,bestSecondary=Infinity;
  const noResult=()=>({policy:'fastConstructor',status:'no_feasible_schedule_found',rows:[],usage:[],
    totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,lateCount:null,objectiveCost:null,
    objectiveMode:mode,optimality:'heuristic',auditValid:false,incumbentSource:null,runtimeMs:performance.now()-started,
    reason:expired()?'No complete audited incumbent found before the deadline; this is not an infeasibility proof.':'All bounded construction attempts failed; this is not an infeasibility proof.',
    constructorMetadata:{...metadata,sortOrder:[...metadata.sortOrder],attempts:metadata.attempts.map(a=>({...a})),callbackErrors:[...metadata.callbackErrors],deadlineReached:expired(),wallTimeMs:performance.now()-started}});
  const output=()=>best?{...best,rows:best.rows.map(row=>({...row})),usage:best.usage.map(day=>({...day})),auditErrors:[...best.auditErrors],runtimeMs:performance.now()-started,
    constructorMetadata:{...metadata,sortOrder:[...metadata.sortOrder],attempts:metadata.attempts.map(a=>({...a})),callbackErrors:[...metadata.callbackErrors],deadlineReached:expired(),wallTimeMs:performance.now()-started}}:noResult();
  if(expired())return noResult();
  const validation=validateScenario(s);
  if(!validation.valid)throw new Error(validation.errors.join('; '));
  if(expired())return noResult();
  const H=s.horizonDays,N=s.containers.length;
  const truckCap=Array.from({length:H},(_,d)=>capacityAt(s.truckCapacity,d));
  const warehouseCap=Array.from({length:H},(_,d)=>capacityAt(s.warehouseCapacity,d));
  const stagingCap=Array.from({length:H},(_,d)=>capacityAt(s.stagingCapacity,d));
  const warehouseBlocked=Array(H+1).fill(0);
  for(let d=0;d<H;d++) {if(expired())return noResult();warehouseBlocked[d+1]=warehouseBlocked[d]+(warehouseCap[d]<1?1:0);}
  const domains=[];
  for(let index=0;index<N;index++) {
    if(expired())return noResult();
    const c=s.containers[index],offset=returnOffset(s,c),weight=stagingWeight(s,c);
    const storage=Array(H),dd=Array(H),stagingBlocked=Array(H+1).fill(0);
    // Storage depends only on p and D&D only on r. One evaluation per day
    // supplies both arrays; no date parsing occurs inside trip scans.
    for(let d=0;d<H;d++) {
      if(expired())return noResult();
      const cost=containerCost(c,d,d,s.horizonStart,s.tariff);metadata.dayPriceEvaluations++;
      storage[d]=cost.storageCost-cost.priorStorageCost;dd[d]=cost.ddCost-cost.priorDDCost;
      stagingBlocked[d+1]=stagingBlocked[d]+(stagingCap[d]<weight?1:0);
    }
    const latestStart=Math.min(c.dueDay-c.unloadDays+1,H-offset-1),trips=[];
    for(let p=c.releaseDay;p<=latestStart;p++) {
      if(expired())return noResult();
      if(truckCap[p]<1)continue;
      for(let u=p;u<=latestStart;u++) {
        if(expired())return noResult();
        if(warehouseBlocked[u+c.unloadDays]-warehouseBlocked[u])continue;
        for(let r=u+offset;r<H;r++) {
          if(expired())return noResult();
          if(truckCap[r]<1+(r===p?1:0)||stagingBlocked[r]-stagingBlocked[p])continue;
          const full=storage[p]+dd[r],primary=mode==='storageOnly'?storage[p]:mode==='ddOnly'?dd[r]:full;
          trips.push({p,u,r,primary,full});metadata.tripCandidates++;
        }
      }
    }
    trips.sort((a,b)=>a.primary-b.primary||a.full-b.full||(a.r-a.p)-(b.r-b.p)||a.r-b.r||a.p-b.p||a.u-b.u);
    if(expired())return noResult();
    const first=trips[0];
    const storageJump=first&&first.p+1<H?storage[first.p+1]-storage[first.p]:0;
    const ddJump=first&&first.r+1<H?dd[first.r+1]-dd[first.r]:0;
    const feeJump=mode==='storageOnly'?storageJump:mode==='ddOnly'?ddJump:storageJump+ddJump;
    domains.push({index,c,weight,offset,latestStart,trips,feeJump});
    // Empty separate-trip domain proves this constructor cannot finish, but the
    // public heuristic API deliberately does not issue an infeasibility proof.
    if(!trips.length) {metadata.preparationMs=performance.now()-started;return noResult();}
  }
  metadata.preparationMs=performance.now()-started;
  const emptyUsage=()=>({truck:new Int16Array(H),warehouse:new Int16Array(H),staging:new Int16Array(H)});
  const fits=(usage,domain,trip)=>{
    metadata.capacityChecks++;
    if(expired())return false;
    if(usage.truck[trip.p]+1+(trip.p===trip.r?1:0)>truckCap[trip.p]
      ||usage.truck[trip.r]+1+(trip.p===trip.r?1:0)>truckCap[trip.r])return false;
    for(let d=trip.u;d<trip.u+domain.c.unloadDays;d++) {if(expired()||usage.warehouse[d]+1>warehouseCap[d])return false;}
    for(let d=trip.p;d<trip.r;d++) {if(expired()||usage.staging[d]+domain.weight>stagingCap[d])return false;}
    return true;
  };
  const apply=(usage,domain,trip,sign)=>{
    if(expired())return false;
    usage.truck[trip.p]+=sign;usage.truck[trip.r]+=sign;
    for(let d=trip.u;d<trip.u+domain.c.unloadDays;d++) {if(expired())return false;usage.warehouse[d]+=sign;}
    for(let d=trip.p;d<trip.r;d++) {if(expired())return false;usage.staging[d]+=sign*domain.weight;}
    return true;
  };
  const fixedSort=(kind)=>{
    const compare=(a,b)=>kind==='release'?a.c.releaseDay-b.c.releaseDay||a.latestStart-b.latestStart||a.trips.length-b.trips.length
      :kind==='feeJump'?b.feeJump-a.feeJump||a.latestStart-b.latestStart||a.trips.length-b.trips.length
      :kind==='domainSize'?a.trips.length-b.trips.length||a.latestStart-b.latestStart||a.c.releaseDay-b.c.releaseDay
      :a.latestStart-b.latestStart||a.c.releaseDay-b.c.releaseDay||a.trips.length-b.trips.length;
    return [...domains].sort((a,b)=>compare(a,b)||a.c.id.localeCompare(b.c.id));
  };
  const construct=(order,explore)=>{
    const usage=emptyUsage(),selected=Array(N).fill(null),placed=[];
    const choose=(domain)=>{
      const candidates=[];
      for(const trip of domain.trips) {
        if(expired())return null;
        if(fits(usage,domain,trip)) {
          candidates.push(trip);
          if(!explore||candidates.length>=3)break;
        }
      }
      return candidates.length?candidates[explore&&random()<.2?Math.floor(random()*candidates.length):0]:null;
    };
    const repair=(failed)=>{
      metadata.repairAttempts++;
      const group=[failed];
      for(let removed=0;removed<3&&placed.length;removed++) {
        if(expired())return false;
        const old=placed.pop();
        if(!apply(usage,old.domain,old.trip,-1))return false;
        selected[old.domain.index]=null;group.push(old.domain);
      }
      group.sort((a,b)=>a.trips.length-b.trips.length||a.latestStart-b.latestStart||a.c.id.localeCompare(b.c.id));
      let checks=0;
      const chosen=[];
      const visit=(depth)=>{
        if(expired())return false;
        if(depth===group.length)return true;
        const domain=group[depth];
        for(const trip of domain.trips) {
          if(expired()||checks>=128)return false;
          checks++;metadata.repairCandidateChecks++;
          if(!fits(usage,domain,trip))continue;
          if(!apply(usage,domain,trip,1))return false;
          chosen[depth]={domain,trip};
          if(visit(depth+1))return true;
          if(!apply(usage,domain,trip,-1))return false;
        }
        return false;
      };
      if(!visit(0))return false;
      for(const item of chosen) {if(expired())return false;selected[item.domain.index]=item.trip;placed.push(item);}
      return true;
    };
    for(const domain of order) {
      if(expired())return null;
      const trip=choose(domain);
      if(trip) {
        if(!apply(usage,domain,trip,1))return null;
        selected[domain.index]=trip;placed.push({domain,trip});
      } else {
        metadata.maxPlacedBeforeFailure=Math.max(metadata.maxPlacedBeforeFailure,placed.length);
        if(!repair(domain))return null;
      }
    }
    return selected.every(Boolean)?selected:null;
  };
  const accept=(selected,source)=>{
    if(expired())return false;
    const rows=[];
    for(let index=0;index<N;index++) {
      if(expired())return false;
      const trip=selected[index];
      rows.push(rowFor(s,s.containers[index],trip.p,trip.u,trip.r));
    }
    const audit=auditSchedule(s,rows);
    if(!audit.valid)throw new Error(`Fast-constructor audit failed: ${audit.errors.join('; ')}`);
    if(expired())return false;
    const result=summarize(s,'fastConstructor',rows,performance.now()-started,'feasible',{
      optimality:'heuristic',objectiveMode:mode,auditValid:true,auditErrors:[],incumbentSource:`fast-constructor-${source}`,
    });
    if(expired())return false;
    metadata.completeAuditedCandidates++;
    const primary=rows.reduce((n,row)=>n+objectiveValue(row,mode),0),secondary=result.incrementalCost;
    if(primary<bestPrimary-1e-7||Math.abs(primary-bestPrimary)<=1e-7&&secondary<bestSecondary-1e-7) {
      best=result;bestPrimary=primary;bestSecondary=secondary;metadata.improvements++;
      metadata.firstIncumbentMs??=performance.now()-started;
      metadata.attempts.at(-1).accepted=true;
      if(options.onIncumbent&&!expired()) {
        try {options.onIncumbent(output());} catch(error) {metadata.callbackErrors.push(String(error));}
      }
      return true;
    }
    return false;
  };
  for(let attempt=0;attempt<=maxRestarts;attempt++) {
    if(expired())break;
    const kind=attempt<4?metadata.sortOrder[attempt]:'seededRandom';
    let order;
    if(kind==='seededRandom') {
      metadata.randomRestartCount++;
      order=domains.map(domain=>({domain,key:random()})).sort((a,b)=>a.key-b.key).map(a=>a.domain);
    } else order=fixedSort(kind);
    if(expired())break;
    metadata.attemptCount++;
    const selected=construct(order,kind==='seededRandom');
    metadata.attempts.push({order:kind,complete:Boolean(selected),accepted:false});
    if(selected)metadata.attempts.at(-1).accepted=accept(selected,kind);
  }
  return output();
}
