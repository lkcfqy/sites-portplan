import {validateScenario} from './engine.js';

const FIELDS=['pickupDay','unloadDay','returnDay'];
const RESOURCES=['truck','warehouse','staging'];
const nowDefault=()=>performance.now();

/** A necessary single-box lower bound after TODAY's candidate actions, not a
 * feasibility certificate, disruption forecast or optimal recovery guarantee.
 * The scenario must be the public observation; no event/duration list is read.
 */
export function scoreCommitmentSlackV11(scenario,rows,options={}) {
  const now=options.now??nowDefault;
  if(typeof now!=='function')throw new Error('Scoring clock must be a function.');
  const started=now(),deadline=options.deadlineMs??Infinity;
  if(typeof deadline!=='number'||Number.isNaN(deadline))throw new Error('Scoring deadline must be a number.');
  const today=options.minEventDay??0,tomorrow=today+1;
  const output={method:'v11-next-day-mandatory-warehouse-lower-bound',status:'time_limit',complete:false,
    today,tomorrow,shadowMinEventDay:tomorrow,mandatoryWarehouseTomorrow:null,mandatoryWarehouseLoad:null,
    scoreScope:'sum of independent single-container necessary warehouse occupancy after executing today; no joint feasibility or future recovery claim',
    usesUnannouncedFutureEvents:false,publicCapacities:null,shadowFixedEvents:null,
    candidateDates:null,containers:[],legalTripCount:0,scoringWallMs:null};
  const finish=(status,extra={})=>({...output,...extra,status,complete:status==='complete',scoringWallMs:now()-started});
  const expired=()=>now()>=deadline;
  if(expired())return finish('time_limit');
  const validation=validateScenario(scenario);
  if(!validation.valid)throw new Error(validation.errors.join('; '));
  const H=scenario.horizonDays,lag=scenario.operations?.returnLagDays??1,unit=scenario.operations?.stagingUnit??'container';
  if(!Number.isInteger(today)||today<0||today>=H)throw new Error('Scoring day must be inside the horizon.');
  if(!Number.isInteger(lag)||![0,1].includes(lag)||!['container','teu'].includes(unit))throw new Error('Invalid operation semantics.');
  const fixed=options.fixedEvents??{};
  if(!fixed||typeof fixed!=='object'||Array.isArray(fixed))throw new Error('Execution locks must be an object.');
  const containers=new Map(scenario.containers.map(c=>[c.id,c])),byId=new Map();
  const publicCapacities={};
  for(const resource of RESOURCES){
    publicCapacities[resource]=Array.from({length:H},(_,d)=>Array.isArray(scenario[resource+'Capacity'])?scenario[resource+'Capacity'][d]:scenario[resource+'Capacity']);
    if(publicCapacities[resource].some(x=>!Number.isInteger(x)||x<0))throw new Error('Every public capacity must be a nonnegative integer.');
  }
  output.publicCapacities=publicCapacities;
  if(expired())return finish('time_limit');
  const shadow=Object.create(null);
  for(const [id,locks]of Object.entries(fixed)){
    if(!containers.has(id)||!locks||typeof locks!=='object'||Array.isArray(locks))throw new Error('Unknown/malformed execution lock.');
    Object.defineProperty(shadow,id,{value:{},enumerable:true,writable:true,configurable:true});
    for(const [field,day]of Object.entries(locks)){
      if(!FIELDS.includes(field)||!Number.isInteger(day)||day<0||day>=today)throw new Error('Executed locks must precede today.');
      shadow[id][field]=day;
    }
  }
  if(!Array.isArray(rows)||rows.length!==containers.size)throw new Error('Scoring requires a complete candidate for every known order.');
  const usage=Array.from({length:H},()=>({truck:0,warehouse:0,staging:0}));
  for(const row of rows){
    if(expired())return finish('time_limit');
    if(!row||!containers.has(row.id)||byId.has(row.id))throw new Error('Unknown/duplicate/malformed candidate row.');
    const c=containers.get(row.id),p=row.pickupDay,u=row.unloadDay,r=row.returnDay,end=u+c.unloadDays-1;
    const originalLocks=Object.hasOwn(fixed,c.id)?fixed[c.id]:{};
    if(![p,u,r].every(d=>Number.isInteger(d)&&d>=0&&d<H)||p<c.releaseDay||u<p||end>c.dueDay||end>=H||r<end+lag)throw new Error(`${c.id}: illegal pickup/unload/return dates.`);
    if(row.unloadEndDay!==undefined&&row.unloadEndDay!==end)throw new Error(`${c.id}: unloadEndDay mismatch.`);
    if(row.sizeFt!==undefined&&row.sizeFt!==c.sizeFt)throw new Error(`${c.id}: candidate sizeFt mismatch.`);
    for(const field of FIELDS){
      if(Object.hasOwn(originalLocks,field)){
        if(row[field]!==originalLocks[field])throw new Error(`${c.id}: candidate changed executed ${field}.`);
      }else if(row[field]<today)throw new Error(`${c.id}: unexecuted event lies in the past.`);
      if(row[field]===today){
        if(!Object.hasOwn(shadow,c.id))Object.defineProperty(shadow,c.id,{value:{},enumerable:true,writable:true,configurable:true});
        shadow[c.id][field]=today;
      }
    }
    usage[p].truck++;usage[r].truck++;
    for(let d=u;d<=end;d++)usage[d].warehouse++;
    const weight=unit==='teu'?c.sizeFt/20:1;
    for(let d=p;d<r;d++)usage[d].staging+=weight;
    byId.set(c.id,{id:c.id,pickupDay:p,unloadDay:u,returnDay:r});
  }
  for(let d=0;d<H;d++)for(const resource of RESOURCES)if(usage[d][resource]>publicCapacities[resource][d])throw new Error(`Day ${d}: candidate ${resource} capacity exceeded.`);
  // Serialize an own-property proof object; the working dictionary has no
  // prototype, so constructor/__proto__/toString never access global objects.
  output.shadowFixedEvents=Object.fromEntries(Object.entries(shadow).map(([id,locks])=>[id,{...locks}]));
  output.candidateDates=scenario.containers.map(c=>({...byId.get(c.id)}));
  if(expired())return finish('time_limit');
  let mandatory=0;
  for(const c of scenario.containers){
    if(expired())return finish('time_limit');
    const locks=Object.hasOwn(shadow,c.id)?shadow[c.id]:{},offset=c.unloadDays-1+lag,latest=Math.min(c.dueDay-c.unloadDays+1,H-1-offset);
    const legalDates=(field,lo,hi)=>Object.hasOwn(locks,field)?[locks[field]].filter(d=>d>=lo&&d<=hi):Array.from({length:Math.max(0,hi-Math.max(lo,tomorrow)+1)},(_,i)=>Math.max(lo,tomorrow)+i);
    const pickups=legalDates('pickupDay',c.releaseDay,latest),unloads=legalDates('unloadDay',c.releaseDay,latest),returns=legalDates('returnDay',c.releaseDay+offset,H-1);
    const weight=unit==='teu'?c.sizeFt/20:1,warehouseFits=Array(H).fill(false),stagingFits=Array.from({length:H},()=>Array(H).fill(false));
    for(let u=0;u+c.unloadDays<=H;u++)warehouseFits[u]=Array.from({length:c.unloadDays},(_,j)=>u+j).every(d=>publicCapacities.warehouse[d]>=1);
    for(let p=0;p<H;p++){
      stagingFits[p][p]=true;let fits=true;
      for(let r=p+1;r<H;r++){fits&&=publicCapacities.staging[r-1]>=weight;stagingFits[p][r]=fits;}
    }
    let legalTripCount=0,avoidsTomorrow=0,occupiesTomorrow=0,avoidanceWitness=null;
    for(const p of pickups)for(const u of unloads){
      if(expired())return finish('time_limit');
      if(u<p||!warehouseFits[u])continue;
      for(const r of returns){
        if(expired())return finish('time_limit');
        if(r<u+offset||publicCapacities.truck[p]<1+Number(p===r)||publicCapacities.truck[r]<1+Number(p===r)||!stagingFits[p][r])continue;
        legalTripCount++;
        if(u<=tomorrow&&tomorrow<u+c.unloadDays)occupiesTomorrow++;
        else {avoidsTomorrow++;avoidanceWitness??={pickupDay:p,unloadDay:u,returnDay:r};}
      }
    }
    // A fully audited input candidate must itself remain a witness after its
    // today actions are frozen. Empty domains indicate an implementation/input
    // error and can never be converted to zero required load.
    if(legalTripCount===0)throw new Error(`${c.id}: no legal single-container trip after today's shadow locks.`);
    const required=avoidsTomorrow===0?1:0;
    mandatory+=required;output.legalTripCount+=legalTripCount;
    output.containers.push({id:c.id,sizeFt:c.sizeFt,unloadDays:c.unloadDays,dueDay:c.dueDay,
      stagingWeight:weight,shadowLocks:{...locks},legalTripCount,occupiesTomorrowCount:occupiesTomorrow,
      avoidsTomorrowCount:avoidsTomorrow,avoidanceWitness,mandatoryWarehouseTomorrow:required});
  }
  if(expired())return finish('time_limit');
  return finish('complete',{mandatoryWarehouseTomorrow:mandatory,mandatoryWarehouseLoad:mandatory,
    publicWarehouseCapacityTomorrow:tomorrow<H?publicCapacities.warehouse[tomorrow]:null,
    tomorrowInsideHorizon:tomorrow<H});
}
