import {containerCost} from './engine.js';

/** A tariff exposure, not a reoptimized or necessarily feasible alternative. */
export function pickupFeeExposures(s,rows){
  const boxes=new Map(s.containers.map(c=>[c.id,c]));
  return rows.map(row=>{
    const c=boxes.get(row.id);if(!c)throw new Error('Unknown container in explanation.');
    const current=containerCost(c,row.pickupDay,row.returnDay,s.horizonStart,s.tariff);
    const delayed=containerCost(c,row.pickupDay+1,row.returnDay,s.horizonStart,s.tariff);
    return {id:c.id,pickupDay:row.pickupDay,storageDays:current.storageDays,currentStorageCost:current.storageCost,
      nextDayStorageCost:delayed.storageCost,oneDayStorageExposure:delayed.storageCost-current.storageCost,
      interpretation:'Holding this container one more day at the terminal changes only its storage charge; resource feasibility and other containers are not reoptimized.'};
  }).sort((a,b)=>b.oneDayStorageExposure-a.oneDayStorageExposure||a.id.localeCompare(b.id));
}

export function executionTasks(s,rows){
  const boxes=new Map(s.containers.map(c=>[c.id,c])),tasks=[];
  for(const row of rows){
    const c=boxes.get(row.id);if(!c)throw new Error('Unknown container in execution export.');
    tasks.push({day:row.pickupDay,event:'pickup',id:row.id,sizeFt:c.sizeFt,resource:'truck',units:1});
    for(let day=row.unloadDay;day<row.unloadDay+c.unloadDays;day++)tasks.push({day,event:'unload',id:row.id,sizeFt:c.sizeFt,resource:'warehouse',units:1});
    tasks.push({day:row.returnDay,event:'empty_return',id:row.id,sizeFt:c.sizeFt,resource:'truck',units:1});
  }
  return tasks.sort((a,b)=>a.day-b.day||a.event.localeCompare(b.event)||a.id.localeCompare(b.id));
}
