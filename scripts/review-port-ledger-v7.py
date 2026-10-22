#!/usr/bin/env python3
"""Independent read-only native port SQLite window/occurrence review; no solver.

SQL LEAD builds assignment windows. Typed tables are UNION ALL row occurrences;
DISTINCT event-object memberships associate trucks, never event-ID substrings.
"""
import argparse
import collections
import datetime as dt
import hashlib
import json
import math
from pathlib import Path
import re
import sqlite3
import statistics

ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATH = 'data/public/v6-data-sources/port-bulk-ocel-22019684/CargoPickup_IoT.sqlite'
SOURCE_SHA = 'edcb515fddc502db99a2122cf8d69b951d00269644aa46f6d550a43bb017075f'
REPORT_SHA = '2e0d2f31587b2455f85388092ef3fcc7fd94e9d11644613d42eb78c6beb9362b'
STAGES = ('Enterport', 'LoadTruck', 'WeighLoadedTruck', 'ExitPort')
EXCEPTIONS = ('FailtoWeigh', 'FailtoLoad', 'DetainAtPort')
COMPARE_KEYS = ('summary', 'recordedClockSpans', 'integrityChecks', 'typeCounts',
                'invalidTimestampOccurrenceKeys', 'unlinkedOccurrenceKeys',
                'multiTruckOccurrenceKeys', 'visits', 'unmatchedCoreOccurrences')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def native_clock(value):
    try:
        parsed = dt.datetime.fromisoformat(value)
        if parsed.tzinfo is not None:
            return None
        return parsed.isoformat(timespec='microseconds')
    except (TypeError, ValueError):
        return None


def identifier(value):
    require(isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9_]+', value), 'Invalid SQL mapped table identifier')
    return '"'+value+'"'


def literal(value):
    require(isinstance(value, str), 'Invalid SQL mapped type')
    return "'"+value.replace("'", "''")+"'"


def distribution(values):
    values = sorted(values)
    n = len(values)
    return {'count':n, 'minimum':values[0] if n else None, 'median':statistics.median(values) if n else None,
            'mean':statistics.mean(values) if n else None, 'p95':values[math.ceil(n*.95)-1] if n else None,
            'maximum':values[-1] if n else None}


def reconstruct_connection(connection):
    """Independent native SQL reconstruction; suitable for in-memory fixtures."""
    connection.row_factory = sqlite3.Row
    connection.execute('PRAGMA query_only=ON')
    connection.create_function('native_clock', 1, native_clock, deterministic=True)
    maps = list(connection.execute('SELECT rowid,ocel_type,ocel_type_map FROM event_map_type ORDER BY rowid'))
    require(maps and len({row['ocel_type_map'] for row in maps}) == len(maps), 'Duplicate/missing typed table mapping')
    union = []
    for order, row in enumerate(maps):
        name, kind = row['ocel_type_map'], row['ocel_type']
        table = 'event_'+name
        union.append(f'SELECT rowid AS occurrenceRow,ocel_id AS eventId,ocel_time AS recordedTime,{literal(kind)} AS type,{literal(name)} AS typeMap,{literal(table)} AS sourceTable,{order} AS mapOrder FROM {identifier(table)}')
    # Association identity is relational. Qualifiers do not multiply membership.
    # Typed objects must have exactly one distinct type; mixed types are excluded.
    base = '''WITH typed AS ('''+ ' UNION ALL '.join(union) + '''),
      object_types AS (SELECT ocel_id AS id,COUNT(DISTINCT ocel_type) AS typeCount,MIN(ocel_type) AS type FROM object GROUP BY ocel_id),
      members AS (SELECT DISTINCT ocel_event_id AS eventId,ocel_object_id AS objectId FROM event_object),
      truck_members AS (SELECT m.eventId,m.objectId AS truckId FROM members m JOIN object_types o ON o.id=m.objectId WHERE o.typeCount=1 AND o.type='Truck'),
      member_counts AS (SELECT eventId,COUNT(*) AS memberCount FROM members GROUP BY eventId),
      truck_counts AS (SELECT eventId,COUNT(*) AS truckCount,MIN(truckId) AS truckId FROM truck_members GROUP BY eventId),
      linked AS (SELECT t.*,native_clock(t.recordedTime) AS eventClock,COALESCE(m.memberCount,0) AS memberCount,
                     COALESCE(k.truckCount,0) AS truckCount,k.truckId FROM typed t
                LEFT JOIN member_counts m ON m.eventId=t.eventId LEFT JOIN truck_counts k ON k.eventId=t.eventId),
      assignment_base AS (SELECT rowid AS assignmentRow,ocel_source_id AS truckId,ocel_target_id AS pickupPlanId,
                          ocel_time AS assignedAt,native_clock(ocel_time) AS assignmentClock FROM object_object
                          WHERE ocel_qualifier='Assigned truck for pickup plan'),
      windows AS (SELECT a.*,LEAD(assignedAt) OVER (PARTITION BY truckId ORDER BY assignmentClock,assignmentRow) AS nextAssignedAt,
                  LEAD(assignmentClock) OVER (PARTITION BY truckId ORDER BY assignmentClock,assignmentRow) AS nextClock,
                  COUNT(*) OVER (PARTITION BY truckId,assignmentClock) AS coincidentAssignments FROM assignment_base a)
    '''
    invalid_edges = connection.execute(base+'''SELECT COUNT(*) FROM assignment_base a
      LEFT JOIN object_types source ON source.id=a.truckId LEFT JOIN object_types target ON target.id=a.pickupPlanId
      WHERE a.assignmentClock IS NULL OR source.typeCount IS NOT 1 OR source.type IS NOT 'Truck'
      OR target.typeCount IS NOT 1 OR target.type IS NOT 'Pickup Plan' ''').fetchone()[0]
    require(invalid_edges == 0, 'Invalid native typed assignment or naive recorded clock')
    membership = collections.defaultdict(list)
    for row in connection.execute(base+'SELECT eventId,truckId FROM truck_members ORDER BY eventId,truckId'):
        membership[row['eventId']].append(row['truckId'])
    all_rows = list(connection.execute(base+'SELECT * FROM linked ORDER BY mapOrder,occurrenceRow'))
    occurrence = {}
    type_counts = {row['ocel_type_map']:0 for row in maps}
    invalid_times, unlinked, multi_truck = [], [], []
    for row in all_rows:
        key = row['sourceTable']+'/'+str(row['occurrenceRow'])
        record = {'occurrenceKey':key, 'eventId':row['eventId'], 'type':row['type'], 'typeMap':row['typeMap'],
                  'recordedTime':row['recordedTime'], 'truckIds':membership[row['eventId']], 'timestampParsed':row['eventClock'] is not None}
        require(key not in occurrence, 'Typed source row occurrence reused')
        occurrence[key] = record
        type_counts[row['typeMap']] += 1
        if row['eventClock'] is None:
            invalid_times.append(key)
        if row['memberCount'] == 0:
            unlinked.append(key)
        if row['truckCount'] > 1:
            multi_truck.append(key)
    visits = []
    by_assignment = {}
    for row in connection.execute(base+'SELECT * FROM windows ORDER BY truckId,assignmentClock,assignmentRow'):
        visit = {'visitId':'assignment/'+str(row['assignmentRow']), 'assignmentRow':row['assignmentRow'],
                 'truckId':row['truckId'], 'pickupPlanId':row['pickupPlanId'], 'assignedAt':row['assignedAt'],
                 'nextAssignedAt':row['nextAssignedAt'], 'assignmentAmbiguous':row['coincidentAssignments'] > 1,
                 'stages':{name:[] for name in STAGES}, 'exceptions':[]}
        visits.append(visit)
        by_assignment[row['assignmentRow']] = visit
    selected_types = ','.join(literal(name) for name in STAGES+EXCEPTIONS)
    associated = connection.execute(base+f'''SELECT e.sourceTable,e.occurrenceRow,e.typeMap,w.assignmentRow FROM linked e
      LEFT JOIN windows w ON e.truckCount=1 AND e.truckId=w.truckId AND e.eventClock>=w.assignmentClock
        AND (w.nextClock IS NULL OR e.eventClock<w.nextClock) AND w.coincidentAssignments=1
      WHERE e.typeMap IN ({selected_types}) ORDER BY e.mapOrder,e.occurrenceRow''')
    unmatched = []
    associated_count = 0
    seen_core = set()
    for row in associated:
        key = row['sourceTable']+'/'+str(row['occurrenceRow'])
        require(key not in seen_core, 'SQL window join multiplied source occurrence')
        seen_core.add(key)
        record = occurrence[key]
        if row['assignmentRow'] is None:
            unmatched.append(record)
        else:
            visit = by_assignment[row['assignmentRow']]
            if row['typeMap'] in STAGES:
                visit['stages'][row['typeMap']].append(record)
            else:
                visit['exceptions'].append(record)
            associated_count += 1
    gate_spans, load_spans = [], []
    for visit in visits:
        visit['missingStages'] = [name for name in STAGES if not visit['stages'][name]]
        visit['multipleStages'] = [name for name in STAGES if len(visit['stages'][name]) > 1]
        visit['recordedGateSpanSeconds'] = None
        visit['recordedLoadToWeighSpanSeconds'] = None
        if visit['assignmentAmbiguous'] or visit['multipleStages']:
            category = 'ambiguous_observation'
        elif visit['missingStages']:
            category = 'incomplete_observation'
        else:
            clocks = [dt.datetime.fromisoformat(visit['stages'][name][0]['recordedTime']) for name in STAGES]
            if any(a > b for a,b in zip(clocks,clocks[1:])):
                category = 'observed_clock_reversal'
            else:
                category = 'complete_ordered_observation'
                visit['recordedGateSpanSeconds'] = (clocks[3]-clocks[0]).total_seconds()
                visit['recordedLoadToWeighSpanSeconds'] = (clocks[2]-clocks[1]).total_seconds()
                gate_spans.append(visit['recordedGateSpanSeconds'])
                load_spans.append(visit['recordedLoadToWeighSpanSeconds'])
        visit['category'] = category
    def scalar(sql):
        return connection.execute(base+sql).fetchone()[0]
    global_rows = scalar('SELECT COUNT(*) FROM event')
    distinct_ids = scalar('SELECT COUNT(*) FROM (SELECT DISTINCT ocel_id FROM event)')
    raw_links = scalar('SELECT COUNT(*) FROM event_object')
    unique_links = scalar('SELECT COUNT(*) FROM (SELECT DISTINCT ocel_event_id,ocel_object_id,ocel_qualifier FROM event_object)')
    raw_join = scalar('SELECT COUNT(*) FROM typed t JOIN event e ON e.ocel_id=t.eventId JOIN event_object m ON m.ocel_event_id=t.eventId')
    unique_join = scalar('SELECT COUNT(*) FROM typed t JOIN event e ON e.ocel_id=t.eventId JOIN members m ON m.eventId=t.eventId')
    conflicts = scalar('SELECT COUNT(*) FROM (SELECT eventId FROM typed GROUP BY eventId HAVING COUNT(*)>1 AND COUNT(DISTINCT recordedTime)>1)')
    global_multiset = [tuple(row) for row in connection.execute('SELECT ocel_id,ocel_type,COUNT(*) FROM event GROUP BY ocel_id,ocel_type ORDER BY ocel_id,ocel_type')]
    typed_multiset = [tuple(row) for row in connection.execute(base+'SELECT eventId,type,COUNT(*) FROM typed GROUP BY eventId,type ORDER BY eventId,type')]
    dangling = scalar('''SELECT COUNT(*) FROM event_object m WHERE NOT EXISTS(SELECT 1 FROM event e WHERE e.ocel_id=m.ocel_event_id)
                         OR NOT EXISTS(SELECT 1 FROM object o WHERE o.ocel_id=m.ocel_object_id)''')
    truck_count = scalar("SELECT COUNT(*) FROM object_types WHERE typeCount=1 AND type='Truck'")
    core_count = scalar(f'SELECT COUNT(*) FROM typed WHERE typeMap IN ({selected_types})')
    return {'summary':{'globalEventRows':global_rows, 'distinctGlobalEventIds':distinct_ids,
                'duplicateGlobalEventIdExtraRows':global_rows-distinct_ids, 'nativeTypedOccurrences':len(occurrence),
                'sourceEventObjectRows':raw_links, 'duplicateEventObjectExtraRows':raw_links-unique_links,
                'conflictingTypedTimestampIds':conflicts, 'naiveRawJoinRows':raw_join, 'joinRowsWithUniqueMembership':unique_join,
                'invalidTimestampOccurrences':len(invalid_times), 'unlinkedEventOccurrences':len(unlinked),
                'multiTruckEventOccurrences':len(multi_truck), 'truckObjects':truck_count, 'assignmentVisits':len(visits),
                'visitCategories':dict(collections.Counter(visit['category'] for visit in visits)),
                'coreAndExceptionOccurrences':core_count, 'associatedCoreAndExceptionOccurrences':associated_count,
                'unmatchedCoreAndExceptionOccurrences':len(unmatched), 'solverRuns':0, 'feeEstimates':0, 'syntheticBusinessFieldsAdded':0},
            'recordedClockSpans':{'gateSpanSeconds':distribution(gate_spans), 'loadToWeighSpanSeconds':distribution(load_spans)},
            'integrityChecks':{'typedAndGlobalEventMultiplicityMatch':global_multiset == typed_multiset,
                'danglingEventObjectReferences':dangling, 'allCoreOccurrencesAccountedFor':core_count == associated_count+len(unmatched)},
            'typeCounts':type_counts, 'invalidTimestampOccurrenceKeys':invalid_times, 'unlinkedOccurrenceKeys':unlinked,
            'multiTruckOccurrenceKeys':multi_truck, 'visits':visits, 'unmatchedCoreOccurrences':unmatched}


def compare_values(expected, actual, path):
    if isinstance(expected, dict):
        if not isinstance(actual, dict) or set(actual) != set(expected):
            return [path+': object keys differ']
        return [error for key in expected for error in compare_values(expected[key],actual[key],path+'.'+key)]
    if isinstance(expected, list):
        if not isinstance(actual,list) or len(actual) != len(expected):
            return [path+': complete list coverage/order differs']
        return [error for i,value in enumerate(expected) for error in compare_values(value,actual[i],f'{path}[{i}]')]
    if isinstance(expected,(int,float)) and not isinstance(expected,bool):
        if not isinstance(actual,(int,float)) or isinstance(actual,bool) or not math.isfinite(actual) or not math.isclose(expected,actual,rel_tol=1e-12,abs_tol=1e-9):
            return [path+': numeric value differs']
        return []
    return [] if type(expected) == type(actual) and expected == actual else [path+': exact value differs']


def compare_ledger(rebuilt, reported):
    return [error for key in COMPARE_KEYS for error in compare_values(rebuilt[key],reported.get(key),key)]


def review_connection(connection, reported):
    rebuilt = reconstruct_connection(connection)
    errors = compare_ledger(rebuilt,reported)
    return {'valid':not errors, 'errors':errors, 'recomputed':rebuilt}


def review():
    input_hashes = {}
    def bound(relative, expected=None):
        raw = (ROOT/relative).read_bytes()
        digest = sha(raw)
        require(expected is None or digest == expected, 'SHA mismatch: '+relative)
        input_hashes[relative] = digest
        return raw
    bound(SOURCE_PATH,SOURCE_SHA)
    report = json.loads(bound('data/port-ledger-v7.json',REPORT_SHA))
    manifest = json.loads(bound('data/public/v6-data-sources/manifest.json'))
    acquired = [entry for entry in manifest['inventory'] if entry['path'] == 'port-bulk-ocel-22019684/CargoPickup_IoT.sqlite']
    require(len(acquired) == 1 and acquired[0]['sha256'] == SOURCE_SHA, 'Acquisition inventory binding differs')
    bound('scripts/audit-port-ledger-v7.py',report['implementationSha256'])
    bound('scripts/review-port-ledger-v7.py')
    if (ROOT/'tests/port-ledger-review-v7.test.mjs').exists():
        bound('tests/port-ledger-review-v7.test.mjs')
    require(report['valid'] is True and report['fixture'] is False, 'Actual ledger must be valid and non-fixture')
    require(report['source']['file'] == SOURCE_PATH and report['source']['sha256'] == SOURCE_SHA and report['source']['license'] == 'CC BY 4.0'
            and report['source']['url'] == 'https://zenodo.org/records/22019684', 'Source/classification binding differs')
    with sqlite3.connect((ROOT/SOURCE_PATH).resolve().as_uri()+'?mode=ro',uri=True) as connection:
        before = connection.total_changes
        result = review_connection(connection,report)
        require(connection.total_changes == before == 0, 'Source database was mutated')
        sqlite_version = connection.execute('SELECT sqlite_version()').fetchone()[0]
    rebuilt, errors = result['recomputed'], result['errors']
    if rebuilt['integrityChecks'] != {'typedAndGlobalEventMultiplicityMatch':True,'danglingEventObjectReferences':0,'allCoreOccurrencesAccountedFor':True}:
        errors.append('Original source accounting integrity check failed')
    counts = rebuilt['summary']
    require(counts['assignmentVisits'] == 489 and counts['nativeTypedOccurrences'] == 6989, 'Actual full-panel size differs')
    visit_reviews = [{'visitId':visit['visitId'], 'valid':not compare_values(visit,report['visits'][index],f'visits[{index}]'),
                     'category':visit['category'], 'stageCounts':{name:len(visit['stages'][name]) for name in STAGES},
                     'exceptionCount':len(visit['exceptions'])} for index,visit in enumerate(rebuilt['visits'])]
    return {'schemaVersion':'portplan-native-port-ledger-independent-sql-review-v7-1', 'valid':not errors,
            'readOnly':True, 'fixture':False, 'solverRuns':0, 'generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
            'inputHashes':input_hashes, 'sourceSqliteSha256':SOURCE_SHA, 'reviewer':'Python stdlib SQLite; no producer import, event-ID parsing, optimizer or fee inference',
            'associationMethod':'SQL LEAD assignment windows partitioned by typed Truck and ordered by naive assigned timestamp/rowid; UNION ALL typed table/rowid occurrences; DISTINCT event-object membership',
            'sqliteVersion':sqlite_version, 'errors':errors, 'recomputedSummary':counts, 'recomputedClockSpans':rebuilt['recordedClockSpans'],
            'recomputedIntegrityChecks':rebuilt['integrityChecks'], 'recomputedTypeCounts':rebuilt['typeCounts'],
            'reviewCounts':{'assignmentVisitsCompared':len(rebuilt['visits']), 'allTypedOccurrencesCounted':counts['nativeTypedOccurrences'],
                'coreAndExceptionOccurrencesCompared':counts['coreAndExceptionOccurrences'], 'unmatchedOccurrencesCompared':counts['unmatchedCoreAndExceptionOccurrences'],
                'invalidTimestampOccurrencesCompared':counts['invalidTimestampOccurrences'], 'sourceDatabaseChanges':0},
            'visitReviews':visit_reviews,
            'limitations':['Retrospective full-history assignment windows are not an online planner information set.',
                'Original timestamps are naive; timezone and cross-system clock calibration remain unknown.',
                'Spans are differences of recorded clocks, not verified physical loading start/end service duration.',
                'Missing observations are not automatically physical failure, unfinished orders or recoverable schedules.',
                'Publisher-described field collection is not independently authenticated; no container lifecycle, resource capacity or fee fields inferred.']}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=ROOT/'data/port-ledger-review-v7.json')
    args = parser.parse_args()
    try:
        result = review()
    except (ValueError,KeyError,OSError,sqlite3.Error,json.JSONDecodeError) as error:
        result = {'schemaVersion':'portplan-native-port-ledger-independent-sql-review-v7-1','valid':False,'readOnly':True,'fixture':False,'solverRuns':0,'errors':[str(error)]}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n',encoding='utf-8')
    print(json.dumps({key:result[key] for key in ['valid','readOnly','fixture','solverRuns','errors']},ensure_ascii=False))
    if not result['valid']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
