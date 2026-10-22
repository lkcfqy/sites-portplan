const EVENT_FIELDS = {x:'pickupDay',y:'unloadDay',z:'returnDay'};

/** Restrict original domains; no executed event can be reassigned. */
export function constrainExecutionDomains(s,event,options={}) {
  if(options.fixedEvents===undefined && options.minEventDay===undefined)return {event,metadata:null};
  const earliest=options.minEventDay??0;
  if(!Number.isInteger(earliest)||earliest<0||earliest>s.horizonDays)throw new Error('minEventDay must be an integer within the horizon.');
  const fixed=options.fixedEvents??{};
  if(!fixed || typeof fixed!=='object' || Array.isArray(fixed))throw new Error('fixedEvents must be an object keyed by container id.');
  const ids=new Set(s.containers.map(c=>c.id));
  for(const [id,locks] of Object.entries(fixed)){
    if(!ids.has(id)||!locks||typeof locks!=='object'||Array.isArray(locks))throw new Error('Invalid execution lock container.');
    for(const [key,day] of Object.entries(locks))if(!Object.values(EVENT_FIELDS).includes(key)||!Number.isInteger(day)||day<0||day>=s.horizonDays)throw new Error('Invalid fixed event date.');
  }
  let lockedEvents=0;
  const constrained=event.map((domains,i)=>Object.fromEntries(Object.entries(EVENT_FIELDS).map(([kind,field])=>{
    const locks=Object.hasOwn(fixed,s.containers[i].id)?fixed[s.containers[i].id]:{};
    const isFixed=Object.hasOwn(locks,field);
    if(isFixed)lockedEvents++;
    return [kind,domains[kind].filter(v=>isFixed?v.day===locks[field]:v.day>=earliest)];
  })));
  return {event:constrained,metadata:{minEventDay:earliest,lockedEvents,informationRule:'Executed event dates are fixed; remaining events cannot occur before the decision day.'}};
}
