"""Audit native public grain-port events without creating container orders or fees."""
from pathlib import Path
from collections import Counter,defaultdict
from datetime import datetime
from bisect import bisect_right
import argparse,hashlib,json,re,sqlite3,statistics

ROOT=Path(__file__).resolve().parents[1]
INPUT=ROOT/'data/public/v6-data-sources/port-bulk-ocel-22019684/CargoPickup_IoT.sqlite'
STAGES=('Enterport','LoadTruck','WeighLoadedTruck','ExitPort')
EXCEPTIONS=('FailtoWeigh','FailtoLoad','DetainAtPort')
def quoted(value):return '"'+value.replace('"','""')+'"'
def timestamp(value):
    try:
        result=datetime.fromisoformat(value)
        return result if result.tzinfo is None else None
    except (TypeError,ValueError):return None
def distribution(values):
    values=sorted(values);n=len(values)
    return {'count':n,'minimum':values[0]if n else None,'median':statistics.median(values)if n else None,
        'mean':statistics.mean(values)if n else None,'p95':values[max(0,(95*n+99)//100-1)]if n else None,'maximum':values[-1]if n else None}
def audit_connection(connection):
    connection.row_factory=sqlite3.Row
    objects=defaultdict(set)
    for row in connection.execute('select ocel_id,ocel_type from object'):objects[row['ocel_id']].add(row['ocel_type'])
    links=defaultdict(set);raw_links=[]
    for row in connection.execute('select ocel_event_id,ocel_object_id,ocel_qualifier from event_object'):
        triple=tuple(row);raw_links.append(triple);links[row['ocel_event_id']].add(row['ocel_object_id'])
    global_rows=[tuple(row)for row in connection.execute('select ocel_id,ocel_type from event')]
    global_ids=Counter(row[0]for row in global_rows)
    mapping=[tuple(row)for row in connection.execute('select ocel_type,ocel_type_map from event_map_type')]
    occurrences=[];type_counts={};invalid_times=[];missing_links=[];ambiguous_trucks=[]
    for kind,name in mapping:
        if not re.fullmatch(r'[A-Za-z0-9_]+',name):raise ValueError('Invalid mapped table name')
        table='event_'+name;rows=list(connection.execute('select rowid,ocel_id,ocel_time from '+quoted(table)));type_counts[name]=len(rows)
        for row in rows:
            identifier=row['ocel_id'];time=timestamp(row['ocel_time']);associated=links.get(identifier,set())
            trucks=sorted(identifier for identifier in associated if objects.get(identifier)=={'Truck'})
            record={'occurrenceKey':table+'/'+str(row['rowid']),'eventId':identifier,'type':kind,'typeMap':name,'recordedTime':row['ocel_time'],
                'truckIds':trucks,'timestampParsed':time is not None}
            occurrences.append(record)
            if time is None:invalid_times.append(record['occurrenceKey'])
            if not associated:missing_links.append(record['occurrenceKey'])
            if len(trucks)>1:ambiguous_trucks.append(record['occurrenceKey'])
    assignments=defaultdict(list)
    for row in connection.execute('select rowid,* from object_object where ocel_qualifier=?',('Assigned truck for pickup plan',)):
        if objects.get(row['ocel_source_id'])!={'Truck'}or objects.get(row['ocel_target_id'])!={'Pickup Plan'}:raise ValueError('Invalid typed assignment edge')
        time=timestamp(row['ocel_time'])
        if time is None:raise ValueError('Invalid assignment clock')
        assignments[row['ocel_source_id']].append({'visitId':'assignment/'+str(row['rowid']),'assignmentRow':row['rowid'],'truckId':row['ocel_source_id'],
            'pickupPlanId':row['ocel_target_id'],'assignedAt':row['ocel_time']})
    starts={}
    for truck,visits in assignments.items():
        visits.sort(key=lambda v:(timestamp(v['assignedAt']),v['assignmentRow']));starts[truck]=[timestamp(v['assignedAt'])for v in visits]
        repeated=Counter(starts[truck])
        for index,visit in enumerate(visits):
            visit['nextAssignedAt']=visits[index+1]['assignedAt']if index+1<len(visits)else None
            visit['assignmentAmbiguous']=repeated[timestamp(visit['assignedAt'])]>1;visit['stages']={name:[]for name in STAGES};visit['exceptions']=[]
    unmatched=[]
    for record in occurrences:
        if record['typeMap']not in STAGES+EXCEPTIONS:continue
        time=timestamp(record['recordedTime']);trucks=record['truckIds']
        index=bisect_right(starts.get(trucks[0],[]),time)-1 if time is not None and len(trucks)==1 else -1
        if index<0:unmatched.append(record);continue
        visit=assignments[trucks[0]][index]
        if visit['assignmentAmbiguous']:unmatched.append(record);continue
        if record['typeMap']in STAGES:visit['stages'][record['typeMap']].append(record)
        else:visit['exceptions'].append(record)
    visits=[];elapsed=[];load_to_weigh=[]
    for truck,items in sorted(assignments.items()):
        for visit in items:
            counts={name:len(visit['stages'][name])for name in STAGES};missing=[name for name,count in counts.items()if count==0];multiple=[name for name,count in counts.items()if count>1]
            visit['missingStages']=missing;visit['multipleStages']=multiple;visit['recordedGateSpanSeconds']=None;visit['recordedLoadToWeighSpanSeconds']=None
            if visit['assignmentAmbiguous']or multiple:category='ambiguous_observation'
            elif missing:category='incomplete_observation'
            else:
                times=[timestamp(visit['stages'][name][0]['recordedTime'])for name in STAGES]
                if any(a>b for a,b in zip(times,times[1:])):category='observed_clock_reversal'
                else:
                    category='complete_ordered_observation';visit['recordedGateSpanSeconds']=(times[-1]-times[0]).total_seconds();elapsed.append(visit['recordedGateSpanSeconds'])
                    visit['recordedLoadToWeighSpanSeconds']=(times[2]-times[1]).total_seconds();load_to_weigh.append(visit['recordedLoadToWeighSpanSeconds'])
            visit['category']=category;visits.append(visit)
    native_ids=Counter(row['eventId']for row in occurrences)
    core=[row for row in occurrences if row['typeMap']in STAGES+EXCEPTIONS]
    native_join_count=sum(global_ids[row['eventId']]*len(links.get(row['eventId'],()))for row in occurrences)
    link_counts=Counter(event for event,_,_ in raw_links)
    raw_link_join_count=sum(global_ids[row['eventId']]*link_counts[row['eventId']]for row in occurrences)
    integrity={'typedAndGlobalEventMultiplicityMatch':Counter(global_rows)==Counter((row['eventId'],row['type'])for row in occurrences),
        'danglingEventObjectReferences':sum(event not in global_ids or obj not in objects for event,obj,_ in raw_links),
        'allCoreOccurrencesAccountedFor':len(core)==sum(sum(len(events)for events in visit['stages'].values())+len(visit['exceptions'])for visit in visits)+len(unmatched)}
    return {'schemaVersion':'portplan-public-grain-port-ledger-audit-v7','valid':True,'auditRole':'Retrospective native event identity, association and recorded-clock audit; no scheduling performance experiment',
        'identityRule':'Preserve every typed SQLite row as table/rowid occurrence; use unique event-object membership for association, reporting duplicate source edges separately. Do not silently deduplicate event occurrences or infer plan IDs from event-ID text.',
        'visitRule':'Truck->pickup-plan Assigned edge opens an observed window ending at the next assignment of the same truck. Event-object membership and recorded timestamps associate stages. This retrospective window is not an online decision information set.',
        'clockRule':'Original naive recorded timestamps retained; timezone and cross-system clock calibration unknown. Differences are recorded-clock spans, not measured loading service durations.',
        'missingBusinessFields':['container lifecycle','port fee contract','resource capacities','matched pickup and empty return','observed loading start/end service duration','clock timezone'],
        'summary':{'globalEventRows':len(global_rows),'distinctGlobalEventIds':len(global_ids),'duplicateGlobalEventIdExtraRows':sum(n-1 for n in global_ids.values()),
            'nativeTypedOccurrences':len(occurrences),'sourceEventObjectRows':len(raw_links),'duplicateEventObjectExtraRows':len(raw_links)-len(set(raw_links)),
            'conflictingTypedTimestampIds':sum(len({row['recordedTime']for row in occurrences if row['eventId']==identifier})>1 for identifier,count in native_ids.items()if count>1),
            'naiveRawJoinRows':raw_link_join_count,'joinRowsWithUniqueMembership':native_join_count,'invalidTimestampOccurrences':len(invalid_times),
            'unlinkedEventOccurrences':len(missing_links),'multiTruckEventOccurrences':len(ambiguous_trucks),'truckObjects':sum(types=={'Truck'}for types in objects.values()),
            'assignmentVisits':len(visits),'visitCategories':dict(Counter(visit['category']for visit in visits)),
            'coreAndExceptionOccurrences':len(core),'associatedCoreAndExceptionOccurrences':sum(sum(len(events)for events in visit['stages'].values())+len(visit['exceptions'])for visit in visits),
            'unmatchedCoreAndExceptionOccurrences':len(unmatched),'solverRuns':0,'feeEstimates':0,'syntheticBusinessFieldsAdded':0},
        'recordedClockSpans':{'gateSpanSeconds':distribution(elapsed),'loadToWeighSpanSeconds':distribution(load_to_weigh)},
        'integrityChecks':integrity,'typeCounts':type_counts,'invalidTimestampOccurrenceKeys':invalid_times,'unlinkedOccurrenceKeys':missing_links,'multiTruckOccurrenceKeys':ambiguous_trucks,
        'visits':visits,'unmatchedCoreOccurrences':unmatched}
def audit_file(path,fixture=False):
    raw_sha=hashlib.sha256(path.read_bytes()).hexdigest()
    if not fixture:
        # Pin the existing original by its saved acquisition manifest.
        manifest=json.loads((ROOT/'data/public/v6-data-sources/manifest.json').read_text())
        item=next(x for x in manifest['inventory']if x['path']=='port-bulk-ocel-22019684/CargoPickup_IoT.sqlite')
        if raw_sha!=item['sha256']:raise ValueError('Original public SQLite checksum differs')
    with sqlite3.connect('file:'+str(path.resolve())+'?mode=ro',uri=True)as connection:report=audit_connection(connection)
    report['fixture']=fixture;report['source']={'file':str(path.relative_to(ROOT))if ROOT in path.parents else str(path),'sha256':raw_sha,'license':'CC BY 4.0'if not fixture else 'fixture',
        'url':'https://zenodo.org/records/22019684','sourceClassification':'Publisher-described field-collected grain-port pickup log; provenance not independently authenticated; not container orders'}
    report['implementationSha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest();return report
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--input',type=Path,default=INPUT);parser.add_argument('--fixture',action='store_true');parser.add_argument('--output',type=Path);args=parser.parse_args()
    result=audit_file(args.input,args.fixture)
    if args.output:args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    else:print(json.dumps(result,ensure_ascii=False,allow_nan=False))
    print(json.dumps({'valid':result['valid'],'summary':result['summary']},ensure_ascii=False))if args.output else None
if __name__=='__main__':main()
