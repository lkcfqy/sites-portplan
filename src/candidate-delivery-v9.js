import {auditSchedule,rowFor,summarize} from './engine.js';
import {auditFrozenEvents} from './rolling-plan.js';

const DAYS=['pickupDay','unloadDay','returnDay'];
const FEASIBLE=new Set(['feasible','optimal']);
const dateRows=rows=>rows.map(({id,pickupDay,unloadDay,returnDay})=>({id,pickupDay,unloadDay,returnDay}));
const errorText=error=>error instanceof Error?error.message:String(error);

/** Reconstruct prices and continuous resource usage from dates alone. A proposal
 * never supplies trusted fees, capacities, execution locks or audit claims. */
export function auditCandidateDatesV9(s,proposals,options={}) {
  const errors=[],seen=new Set(),containers=new Map(s.containers.map(c=>[c.id,c]));
  if(!Array.isArray(proposals)||proposals.length!==s.containers.length)errors.push('Require one complete proposal per known container.');
  if(Array.isArray(proposals))for(const row of proposals) {
    if(!row||typeof row!=='object'||!containers.has(row.id)||seen.has(row.id)){errors.push('Unknown, duplicate or malformed proposal.');continue;}
    seen.add(row.id);
    for(const key of DAYS)if(!Number.isInteger(row[key])||row[key]<0||row[key]>=s.horizonDays)errors.push(`${row.id}: invalid ${key}.`);
    if(Number.isInteger(row.unloadDay)&&row.unloadDay+containers.get(row.id).unloadDays-1>=s.horizonDays)errors.push(`${row.id}: unloading exceeds the horizon.`);
  }
  if(errors.length)return {valid:false,errors,rows:[],scheduleValid:false,freezeValid:false};
  const byId=new Map(proposals.map(row=>[row.id,row]));
  const rows=s.containers.map(c=>{const r=byId.get(c.id);return rowFor(s,c,r.pickupDay,r.unloadDay,r.returnDay);});
  const schedule=auditSchedule(s,rows),freeze=auditFrozenEvents(rows,options.fixedEvents??{},options.minEventDay??0);
  return {valid:schedule.valid&&freeze.valid,errors:[...schedule.errors,...freeze.errors],rows,scheduleValid:schedule.valid,freezeValid:freeze.valid};
}

/** Synchronous receipt at the outer controller. All copying, repricing, physical
 * audit and selection must finish within this controller's original deadline.
 * A later result cannot backdate its arrival using internal timing metadata. */
export function createCandidateDeliveryGateV9({scenario,options={},started,deadlineMs,now=()=>performance.now(),callId=1,onIncumbent}={}) {
  if(typeof now!=='function'||!Number.isFinite(started)||!Number.isFinite(deadlineMs)||deadlineMs<=started)throw new Error('V9 gate requires a finite outer start and deadline.');
  if(onIncumbent!==undefined&&typeof onIncumbent!=='function')throw new Error('V9 onIncumbent must be a diagnostic observer function.');
  const s=structuredClone(scenario),o=structuredClone(options),events=[];
  let best=null,selectedSequence=null,selectedAcceptanceAtMs=null,firstAcceptedAtMs=null,closed=false;
  const time=()=>{const value=now();if(!Number.isFinite(value))throw new Error('V9 clock must return finite milliseconds.');return value;};
  const metadata=()=>({schemaVersion:'portplan-v9-candidate-delivery-1',deadlineBasis:'outer-planner-start',callId,minEventDay:o.minEventDay??0,
    wholeCallBudgetMs:deadlineMs-started,firstAcceptedAtMs,selectedAcceptanceAtMs,selectedCandidateSequence:selectedSequence,
    closed,events:structuredClone(events),interpretation:'Acceptance requires actual synchronous receipt, isolated copy, current-snapshot physical/lock audit, repricing and selection completed by the outer deadline. Internal first-incumbent claims are not receipt evidence.'});
  function offer(candidate,source,{select}={}) {
    const received=time(),event={sequence:events.length+1,source,receivedAtMs:received-started,copyCompletedAtMs:null,auditCompletedAtMs:null,
      selectionCompletedAtMs:null,acceptedAtMs:null,outcome:null,proposedDates:null,dates:null,incrementalCost:null,audit:null};
    events.push(event);
    const reject=outcome=>{event.outcome=outcome;return {accepted:false,event:structuredClone(event)};};
    if(closed)return reject('closed');
    if(received>deadlineMs)return reject('rejected_late_receipt');
    if(!FEASIBLE.has(candidate?.status))return reject('rejected_status');
    let copy;
    try{copy=structuredClone(candidate);event.proposedDates=Array.isArray(copy.rows)?copy.rows.map(row=>row&&typeof row==='object'?Object.fromEntries(['id',...DAYS].filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]])):row):copy.rows??null;}
    catch(error){event.error=errorText(error);return reject('rejected_copy_error');}
    event.copyCompletedAtMs=time()-started;
    if(started+event.copyCompletedAtMs>deadlineMs)return reject('rejected_late_copy');
    let audit,canonical;
    try {
      audit=auditCandidateDatesV9(s,copy.rows,o);
      event.audit={scheduleValid:audit.scheduleValid,freezeValid:audit.freezeValid,errors:[...audit.errors]};
      if(audit.valid)canonical=summarize(s,'adaptiveV9',audit.rows,time()-started,'feasible',{objectiveMode:'joint',optimality:'adaptive_candidate_delivery_no_optimality_claim',auditValid:true});
    }catch(error){event.error=errorText(error);return reject('rejected_audit_error');}
    event.auditCompletedAtMs=time()-started;
    if(canonical){event.dates=dateRows(canonical.rows);event.incrementalCost=canonical.incrementalCost;}
    if(started+event.auditCompletedAtMs>deadlineMs)return reject('rejected_late_audit');
    if(!audit.valid)return reject('rejected_invalid');
    let selection;
    try{selection=select?select(best?structuredClone(best):null,structuredClone(canonical)):!best||canonical.incrementalCost<best.incrementalCost;}
    catch(error){event.error=errorText(error);return reject('rejected_selection_error');}
    if(selection&&typeof selection.then==='function')return reject('rejected_async_selection');
    const accepted=typeof selection==='object'?selection.accepted===true:selection===true;
    if(selection&&typeof selection==='object')event.selection=structuredClone(selection);
    event.selectionCompletedAtMs=time()-started;
    if(started+event.selectionCompletedAtMs>deadlineMs)return reject('rejected_late_selection');
    if(!accepted)return reject(event.selection?.reason==='guard'?'rejected_guard':'not_improved');
    event.acceptedAtMs=event.selectionCompletedAtMs;event.outcome='accepted';
    best=canonical;selectedSequence=event.sequence;selectedAcceptanceAtMs=event.acceptedAtMs;firstAcceptedAtMs??=event.acceptedAtMs;
    // This observer is optional diagnostics, never an acknowledgement or part
    // of the acceptance rule. Official experiments do not enable it.
    if(onIncumbent)try {
      const result=onIncumbent(structuredClone(best),structuredClone({...event,callId,minEventDay:o.minEventDay??0}));
      if(result&&typeof result.then==='function'){event.observerAsyncIgnored=true;Promise.resolve(result).catch(()=>{});}
    }catch(error){event.observerError=errorText(error);}
    return {accepted:true,event:structuredClone(event)};
  }
  return Object.freeze({offer,best:()=>best?structuredClone(best):null,metadata,close:()=>{closed=true;return metadata();}});
}
