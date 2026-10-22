import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const run=spawnSync('python',['-'],{encoding:'utf8',input:`
import importlib.util,json,sqlite3
spec=importlib.util.spec_from_file_location('audit','scripts/audit-port-ledger-v7.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
def fixture():
 c=sqlite3.connect(':memory:');c.executescript('create table object(ocel_id text,ocel_type text);create table event(ocel_id text,ocel_type text);create table event_object(ocel_event_id text,ocel_object_id text,ocel_qualifier text);create table event_map_type(ocel_type text,ocel_type_map text);create table object_object(ocel_source_id text,ocel_target_id text,ocel_qualifier text,ocel_time text);')
 c.executemany('insert into object values(?,?)',[('vehicle-random','Truck'),('order#A','Pickup Plan'),('order#B','Pickup Plan')])
 for name in m.STAGES:
  c.execute('insert into event_map_type values(?,?)',(name,name));c.execute('create table event_'+name+'(ocel_id text,ocel_time text)')
 for order,time in [('order#A','2024-01-01 00:00:00'),('order#B','2024-01-02 00:00:00')]:c.execute('insert into object_object values(?,?,?,?)',('vehicle-random',order,'Assigned truck for pickup plan',time))
 def event(stage,identifier,time):
  c.execute('insert into event_'+stage+' values(?,?)',(identifier,time));c.execute('insert into event values(?,?)',(identifier,stage));c.execute('insert into event_object values(?,?,?)',(identifier,'vehicle-random','native member'))
 event('Enterport','opaque-reused','2024-01-01 00:01:00');event('LoadTruck','opaque-load','2024-01-01 00:02:00');event('WeighLoadedTruck','opaque-weigh','2024-01-01 00:03:00');event('ExitPort','opaque-exit','2024-01-01 00:04:00');event('Enterport','opaque-reused','2024-01-02 00:01:00')
 return c,event
c,event=fixture();base=m.audit_connection(c)
assert base['summary']['visitCategories']=={'complete_ordered_observation':1,'incomplete_observation':1}
assert base['visits'][0]['pickupPlanId']=='order#A'and base['visits'][1]['pickupPlanId']=='order#B'
assert base['summary']['naiveRawJoinRows']>base['summary']['nativeTypedOccurrences']
assert len({row['occurrenceKey']for v in base['visits']for rows in v['stages'].values()for row in rows})==5
assert base['recordedClockSpans']['gateSpanSeconds']['median']==180
c,event=fixture();c.execute('update event_WeighLoadedTruck set ocel_time=?',('2024-01-01 00:01:30',));reverse=m.audit_connection(c);assert reverse['summary']['visitCategories']['observed_clock_reversal']==1;assert reverse['recordedClockSpans']['gateSpanSeconds']['count']==0
c,event=fixture();event('LoadTruck','opaque-second','2024-01-01 00:02:10');ambiguous=m.audit_connection(c);assert ambiguous['summary']['visitCategories']['ambiguous_observation']==1
c,event=fixture();event('ExitPort','orphan','2023-12-31 23:59:00');unknown=m.audit_connection(c);assert unknown['summary']['unmatchedCoreAndExceptionOccurrences']==1
print(json.dumps({'base':base['summary'],'reversed':reverse['summary']['visitCategories'],'multiple':ambiguous['summary']['visitCategories'],'unmatched':unknown['summary']['unmatchedCoreAndExceptionOccurrences'],'integrity':base['integrityChecks']}))
`});
test('native assignment windows preserve repeated opaque event IDs without inferring plan names',()=>{assert.equal(run.status,0,run.stderr);const r=JSON.parse(run.stdout);assert.equal(r.base.assignmentVisits,2);assert.equal(r.base.duplicateGlobalEventIdExtraRows,1);assert.equal(r.integrity.typedAndGlobalEventMultiplicityMatch,true);assert.equal(r.integrity.allCoreOccurrencesAccountedFor,true);});
test('inversions, multiple stages and unmatched observations remain explicit and excluded from complete spans',()=>{assert.equal(run.status,0,run.stderr);const r=JSON.parse(run.stdout);assert.equal(r.reversed.observed_clock_reversal,1);assert.equal(r.multiple.ambiguous_observation,1);assert.equal(r.unmatched,1);});
