import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Handwritten in-memory source rows only. No producer imports, real publisher
// assets, scheduling model or solver are used by these reviewer fixtures.
const REVIEWER=fileURLToPath(new URL('../scripts/review-port-ledger-v7.py',import.meta.url));
const PYTHON=`
import copy
import importlib.util
import json
import sqlite3
import sys
spec=importlib.util.spec_from_file_location("independent_port_ledger_fixture",sys.argv[1])
m=importlib.util.module_from_spec(spec)
sys.modules[spec.name]=m
spec.loader.exec_module(m)
p=json.load(sys.stdin)
c=sqlite3.connect(":memory:")
c.executescript("""
create table object(ocel_id text,ocel_type text);
create table event(ocel_id text,ocel_type text);
create table event_object(ocel_event_id text,ocel_object_id text,ocel_qualifier text);
create table object_object(ocel_source_id text,ocel_target_id text,ocel_qualifier text,ocel_time text);
create table event_map_type(ocel_type text,ocel_type_map text);
""")
stages=["Enterport","LoadTruck","WeighLoadedTruck","ExitPort","FailtoLoad"]
for stage in stages:
    c.execute("insert into event_map_type values(?,?)",(stage,stage))
    c.execute("create table event_"+stage+"(ocel_id text,ocel_time text)")
c.executemany("insert into object values(?,?)",[("opaque:vehicle","Truck"),("unrelated:A","Pickup Plan"),("different:B","Pickup Plan")])
c.executemany("insert into object_object values(?,?,?,?)",[("opaque:vehicle","unrelated:A","Assigned truck for pickup plan","2024-01-01 00:00:00"),("opaque:vehicle","different:B","Assigned truck for pickup plan","2024-01-02 00:00:00")])
events=[("Enterport","opaque:repeat","2024-01-01 00:01:00"),("LoadTruck","opaque:load","2024-01-01 00:02:00"),("WeighLoadedTruck","opaque:scale","2024-01-01 00:03:00"),("ExitPort","opaque:exit","2024-01-01 00:04:00"),("Enterport","opaque:repeat","2024-01-02 00:01:00"),("FailtoLoad","opaque:abort","2024-01-02 00:02:00")]
for stage,event_id,clock in events:
    c.execute("insert into event_"+stage+" values(?,?)",(event_id,clock))
    c.execute("insert into event values(?,?)",(event_id,stage))
    c.execute("insert into event_object values(?,?,?)",(event_id,"opaque:vehicle","native membership"))
# The repeated event already has two identical membership edges; preserve a
# third source edge and report its join inflation without tripling occurrences.
c.execute("insert into event_object values(?,?,?)",("opaque:repeat","opaque:vehicle","native membership"))
for statement,params in p.get("setup",[]):
    c.execute(statement,params)
rebuilt=m.reconstruct_connection(c)
if p.get("operation","rebuild")=="compare":
    reported=copy.deepcopy(rebuilt)
    for edit in p.get("edits",[]):
        parent=reported
        for key in edit["path"][:-1]:
            parent=parent[key]
        key=edit["path"][-1]
        if edit.get("kind")=="delete":
            del parent[key]
        else:
            parent[key]=edit["value"]
    output={"errors":m.compare_ledger(rebuilt,reported)}
else:
    output=rebuilt
print(json.dumps(output,allow_nan=False))
`;
function check(extra={}){
  const result=spawnSync('python3',['-c',PYTHON,REVIEWER],{input:JSON.stringify(extra),encoding:'utf8',timeout:10_000,maxBuffer:1024*1024});
  assert.equal(result.error,undefined,result.error?.message);
  assert.equal(result.status,0,result.stderr||result.stdout);
  return JSON.parse(result.stdout);
}
const associated=rebuilt=>rebuilt.visits.flatMap(visit=>[...Object.values(visit.stages).flat(),...visit.exceptions]);

test('independent reconstruction retains typed row identity across reused opaque IDs and native windows',()=>{
  const r=check(),s=r.summary;
  assert.equal(s.globalEventRows,6);
  assert.equal(s.distinctGlobalEventIds,5);
  assert.equal(s.duplicateGlobalEventIdExtraRows,1);
  assert.equal(s.nativeTypedOccurrences,6);
  assert.equal(s.assignmentVisits,2);
  assert.equal(s.coreAndExceptionOccurrences,6);
  assert.equal(s.associatedCoreAndExceptionOccurrences,6);
  assert.equal(s.unmatchedCoreAndExceptionOccurrences,0);
  assert.deepEqual(s.visitCategories,{complete_ordered_observation:1,incomplete_observation:1});
  assert.deepEqual(r.visits.map(v=>v.pickupPlanId),['unrelated:A','different:B']);
  const enters=r.visits.map(v=>v.stages.Enterport[0]);
  assert.equal(enters[0].eventId,enters[1].eventId);
  assert.deepEqual(enters.map(e=>e.occurrenceKey),['event_Enterport/1','event_Enterport/2']);
  assert.equal(new Set(associated(r).map(e=>e.occurrenceKey)).size,6);
  assert.deepEqual(r.typeCounts,{Enterport:2,LoadTruck:1,WeighLoadedTruck:1,ExitPort:1,FailtoLoad:1});
  assert.equal(r.integrityChecks.typedAndGlobalEventMultiplicityMatch,true);
  assert.equal(r.integrityChecks.allCoreOccurrencesAccountedFor,true);
});

test('duplicate identical membership edges expose raw join inflation without inflating observations',()=>{
  const r=check();
  assert.equal(r.summary.sourceEventObjectRows,7);
  assert.equal(r.summary.duplicateEventObjectExtraRows,2);
  assert.equal(r.summary.naiveRawJoinRows,16);
  assert.equal(r.summary.joinRowsWithUniqueMembership,8);
  assert.equal(associated(r).length,6);
  assert.equal(r.summary.conflictingTypedTimestampIds,1);
});

test('recorded spans include only complete ordered observations and retain missing stages',()=>{
  const r=check();
  assert.equal(r.visits[0].recordedGateSpanSeconds,180);
  assert.equal(r.visits[0].recordedLoadToWeighSpanSeconds,60);
  assert.equal(r.recordedClockSpans.gateSpanSeconds.count,1);
  assert.equal(r.recordedClockSpans.gateSpanSeconds.median,180);
  assert.equal(r.recordedClockSpans.loadToWeighSpanSeconds.median,60);
  assert.deepEqual(r.visits[1].missingStages,['LoadTruck','WeighLoadedTruck','ExitPort']);
  assert.equal(r.visits[1].recordedGateSpanSeconds,null);
  assert.equal(r.visits[1].exceptions[0].occurrenceKey,'event_FailtoLoad/1');
});

test('an occurrence exactly at the next assignment boundary belongs to the latter window',()=>{
  const r=check({setup:[['update event_Enterport set ocel_time=? where rowid=2',['2024-01-02 00:00:00']]]});
  assert.deepEqual(r.visits.map(v=>v.stages.Enterport.map(e=>e.occurrenceKey)),[['event_Enterport/1'],['event_Enterport/2']]);
  assert.equal(r.visits[1].stages.Enterport[0].recordedTime,r.visits[1].assignedAt);
  assert.equal(r.summary.unmatchedCoreAndExceptionOccurrences,0);
});

test('equal-time duplicate assignments remain ambiguous and their occurrences stay unmatched',()=>{
  const r=check({setup:[['insert into object values(?,?)',['opaque:C','Pickup Plan']],
    ['insert into object_object values(?,?,?,?)',['opaque:vehicle','opaque:C','Assigned truck for pickup plan','2024-01-02 00:00:00']]]});
  assert.equal(r.summary.assignmentVisits,3);
  assert.equal(r.summary.visitCategories.ambiguous_observation,2);
  assert.equal(r.summary.visitCategories.complete_ordered_observation,1);
  assert.ok(r.visits.slice(1).every(v=>v.assignmentAmbiguous));
  assert.equal(r.summary.unmatchedCoreAndExceptionOccurrences,2);
  assert.deepEqual(r.unmatchedCoreOccurrences.map(e=>e.occurrenceKey).sort(),['event_Enterport/2','event_FailtoLoad/1']);
});

test('unparseable typed timestamps are preserved and explicitly unmatched',()=>{
  const r=check({setup:[['insert into event_ExitPort values(?,?)',['opaque:bad-clock','not-a-clock']],
    ['insert into event values(?,?)',['opaque:bad-clock','ExitPort']],
    ['insert into event_object values(?,?,?)',['opaque:bad-clock','opaque:vehicle','native membership']]]});
  assert.equal(r.summary.nativeTypedOccurrences,7);
  assert.deepEqual(r.invalidTimestampOccurrenceKeys,['event_ExitPort/2']);
  const occurrence=r.unmatchedCoreOccurrences.find(e=>e.occurrenceKey==='event_ExitPort/2');
  assert.equal(occurrence.recordedTime,'not-a-clock');
  assert.equal(occurrence.timestampParsed,false);
  assert.equal(r.integrityChecks.allCoreOccurrencesAccountedFor,true);
});

test('comparison accepts an unchanged independent fixture and rejects altered native evidence',()=>{
  assert.deepEqual(check({operation:'compare'}).errors,[]);
  const edits=[
    {path:['visits',0,'stages','Enterport',0,'recordedTime'],value:'2024-01-01 00:01:01'},
    {kind:'delete',path:['visits',1,'stages','Enterport',0]},
    {path:['visits',0,'pickupPlanId'],value:'inferred-from-event-text'},
    {path:['visits',0,'stages','Enterport',0,'truckIds'],value:['unrelated:truck']},
    {path:['visits',0,'category'],value:'incomplete_observation'},
    {path:['visits',0,'recordedGateSpanSeconds'],value:181},
    {path:['recordedClockSpans','gateSpanSeconds','median'],value:181},
    {path:['summary','nativeTypedOccurrences'],value:5},
  ];
  for(const edit of edits)assert.ok(check({operation:'compare',edits:[edit]}).errors.length>0,JSON.stringify(edit));
});
