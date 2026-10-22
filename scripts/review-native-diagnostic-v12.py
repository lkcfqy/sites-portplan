#!/usr/bin/env python3
"""Read-only independent Python audit of nine seen V10 snapshot diagnostics.

Does not import JS/native models, call optimization, generate orders or certify
native optimality. Rebuilds public snapshots/physical prefixes and all supplied
complete plan resources/locks/fees, then checks recorded delivery/cleanup and
isolates unavailable or late native bounds from accepted-plan statistics.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('unchanged_v10_review',ROOT/'scripts/review-v10.py')
v10=importlib.util.module_from_spec(spec);spec.loader.exec_module(v10)
ledger,v8,require,same,digest=v10.ledger,v10.v8,v10.require,v10.same,v10.digest
METHODS=('cpsatV12','highsV8')
COSTS=(*v10.FEE_FIELDS,'lateCount')
INDEX_SHA='33d07f60afb4b4248682badc631512a54070cca22fd106c7dd5062d4669bf9c2'
REVIEW_SHA='fb37b8ea5c2cf738ad73548a93f1f65cc541bf7c111be59f76bd88fb023ee27b'
SOURCE_NAMES=('scripts/compare-native-v12.mjs','scripts/cpsat-planner-v12.mjs','scripts/cpsat-service-v12.py',
 'scripts/highs-planner-v8.mjs','scripts/highs-service-v8.py','scripts/certify-v4.py','src/engine.js','src/rolling-plan.js',
 'package.json','package-lock.json','requirements-research-v4.txt','requirements-cpsat-v12.txt','AGENTS.md')


def safe(base,name):
    require(isinstance(name,str) and name and not Path(name).is_absolute() and '..' not in Path(name).parts,'Unsafe artifact path')
    path=(base/name).resolve();require(path.is_relative_to(base.resolve()),'Artifact escapes root');return path


def bound(base,artifact,label):
    path=safe(base,artifact['path']);same(digest(path),artifact['sha256'],label+'/SHA');return ledger.read_json(path)


def value_sha(value):
    return hashlib.sha256(ledger.stable_json(value).encode()).hexdigest()


def time(value,label):
    require(ledger.finite(value) and value>=0,label+': missing/nonfinite/negative time');return value


def prefix_necessary_load(scenario,fixed,day):
    """Necessary occupancy using all broad temporal trips, no joint solver."""
    H=scenario['horizonDays'];lag={**ledger.OPERATIONS,**scenario.get('operations',{})}['returnLagDays']
    contributors=[];empty=[]
    for c in scenario['containers']:
        locks=fixed.get(c['id'],{});offset=c['unloadDays']-1+lag
        latest=min(c['dueDay']-c['unloadDays']+1,H-1-offset)
        def domain(key,lo,hi):
            return [locks[key]] if key in locks and lo<=locks[key]<=hi else ([] if key in locks else range(max(lo,day),hi+1))
        trips=0;avoids=False
        for p in domain('pickupDay',c['releaseDay'],latest):
            for u in domain('unloadDay',c['releaseDay'],latest):
                if u<p:continue
                for r in domain('returnDay',c['releaseDay']+offset,H-1):
                    if r<u+offset:continue
                    trips+=1
                    if not u<=day<u+c['unloadDays']:avoids=True
        if not trips:empty.append(c['id'])
        elif not avoids:contributors.append(c['id'])
    capacity=ledger.capacity(scenario,'warehouse',day)
    return {'day':day,'mandatoryWarehouseLowerBound':len(contributors),'publicWarehouseCapacity':capacity,
        'contributors':contributors,'emptyIndividualTemporalDomains':empty,
        'independentlyProvesThisFixedPrefixInfeasible':bool(empty) or len(contributors)>capacity,
        'scope':'Necessary temporal-domain warehouse occupancy under this exact already-executed prefix only; no counterfactual policy or whole original scenario impossibility claim.'}


def audit_snapshot(directory,declared,loss,original_case,old_episode,index):
    snapshot=bound(directory,declared['artifact'],'Snapshot')
    nominal,events=original_case['nominalScenario'],original_case['events'];day=loss['failureDay']
    result=old_episode['result']
    same(result.get('complete'),False,'Original failure must remain failed')
    same(result.get('failure',{}).get('day'),day,'Original failure day')
    # This unchanged auditor independently rebuilds every original accepted
    # physical prefix, selected date fee, capacity and executed lock.
    checked=v10.audit_episode(nominal,events,result,'original/'+loss['caseId'],5000,'stableHiGHSV10',200)
    actual=ledger.realize(nominal,events);observed,observations=ledger.observed_snapshot(nominal,actual,events,day)
    fixed={};past=[]
    for entry in result['timeline'][:day]:
        require(entry['status']=='executed','Prefix contains a failed/unexecuted prior day')
        for event in entry['executedEvents']:
            field=ledger.EVENT_FIELDS[event['event']]
            require(field not in fixed.get(event['id'],{}),'Repeated historical event')
            fixed.setdefault(event['id'],{})[field]=event['day'];past.append(event)
    checksum='sha256:'+value_sha({'scenario':observed,'observedEvents':observations,'fixedEvents':fixed,'minEventDay':day})
    expected={'id':loss['caseId']+'--failure-d'+str(day),'caseId':loss['caseId'],'panel':loss['panel'],'repeatIndex':1,'day':day,
        'snapshot':observed,'fixedEvents':fixed,'pastPhysicalEvents':past,'observedEvents':observations,'observationHash':checksum,
        'snapshotSha256':value_sha(observed),'fixedEventsSha256':value_sha(fixed),'originalLossRecord':loss,
        'sourceInputArtifact':snapshot.get('sourceInputArtifact'),'sourceEpisodeArtifact':snapshot.get('sourceEpisodeArtifact')}
    same(snapshot,expected,'Complete independently reconstructed snapshot')
    same(checksum,result['timeline'][day]['observationHash'],'Original actual planner observation SHA')
    same({k:declared[k] for k in ('id','caseId','day','repeatIndex')},{k:expected[k] for k in ('id','caseId','day','repeatIndex')},'Snapshot metadata')
    return snapshot,{'caseId':loss['caseId'],'day':day,'snapshotSha256':expected['snapshotSha256'],'fixedEventsSha256':expected['fixedEventsSha256'],
        'physicalPrefixEvents':len(past),'originalPhysicalReview':checked,'prefixNecessaryWarehouse':prefix_necessary_load(observed,fixed,day)}


def audit_native(scenario,fixed,day,result,method,budget,label):
    meta=v8.metadata(result);native=meta.get('nativeCertificate');require(isinstance(native,dict),label+': missing native raw certificate')
    same(meta.get('timeBudgetMs'),budget,label+'/whole call allowance')
    same(meta.get('decisionCalls'),1,label+'/fresh factory decision count')
    same(meta.get('solverCalls'),1,label+'/one native call')
    same(meta.get('solverThreads'),1,label+'/single thread')
    same(meta.get('readyCalledBeforeDecision'),True,label+'/cold ready recorded')
    same(native.get('solverThreads'),1,label+'/native single thread')
    schema='portplan-native-cpsat-v12' if method=='cpsatV12' else 'portplan-native-highs-v8'
    same(native.get('schemaVersion'),schema,label+'/native schema')
    for key in ('hasIncumbent','provenOptimal','provenInfeasible'):require(type(native.get(key)) is bool,label+': nonboolean native '+key)
    require(not(native['provenOptimal'] and native['provenInfeasible']),label+': incompatible native claims')
    for key in ('modelWallMs','solverWallMs','independentAuditWallMs','serviceWallMs','solverTimeLimitMs','remainingBudgetAtReceiptMs'):
        time(native.get(key),label+'/'+key)
    require(native['remainingBudgetAtReceiptMs']<=budget and native['solverTimeLimitMs']<=native['remainingBudgetAtReceiptMs'],label+': native receives extra daily allowance')
    for key in ('lowerBound','relativeGap'):
        require(native.get(key) is None or ledger.finite(native[key]),label+': nonfinite/nonnumeric native '+key)
    same(native.get('objectiveMode','joint'),'joint',label+'/native objective mode')
    stage=meta.get('stages',{}).get('native',{})
    same(stage.get('hasIncumbent'),native['hasIncumbent'],label+'/adapter native-incumbent binding')
    native_fees=None
    if native['hasIncumbent']:
        dates_audit=ledger.audit_dates(scenario,native.get('rows'),label+'/raw native full physical/locks',fixed,day)
        native_fees=v10.reprice_dates(scenario,native['rows'])
        ledger.close(native.get('objectiveCost'),native_fees['objectiveCost'],label+'/raw native objective')
        for key in v10.FEE_FIELDS[:-1]:ledger.close(native.get('independentCosts',{}).get(key),native_fees[key],label+'/raw native '+key)
        v10.audit_native_endpoint_flags(scenario,native['rows'],stage.get('audit'),fixed,day,label+'/JS native audit flags')
        same(stage.get('independentCostsMatch'),True,label+'/independent price matching')
        incumbent=native.get('incumbentAudit');require(isinstance(incumbent,dict) and incumbent.get('valid') is True,label+': missing native audit')
        ledger.close(incumbent.get('objectiveCost'),native_fees['objectiveCost'],label+'/native audit objective')
        for key in v10.FEE_FIELDS[:-1]:ledger.close(incumbent.get('independentCosts',{}).get(key),native_fees[key],label+'/native audit '+key)
        if 'usage' in incumbent:
            require(len(incumbent['usage'])==scenario['horizonDays'],label+': native usage coverage differs')
            for d,row in enumerate(incumbent['usage']):
                for i,resource in enumerate(ledger.RESOURCES):ledger.close(row.get(resource),dates_audit['usage'][d][i],label+'/native usage '+resource)
        if native.get('lowerBound') is not None:
            require(ledger.finite(native['lowerBound']) and native['lowerBound']<=native_fees['objectiveCost']+1e-6,label+': native lower bound above its own incumbent')
    else:
        same(native.get('rows'),[],label+'/no native incumbent rows')
        same(native.get('objectiveCost'),None,label+'/no incumbent objective')
        same(native.get('independentCosts'),None,label+'/no incumbent prices')
        same(native.get('provenOptimal'),False,label+'/no incumbent cannot be optimal')
    if native['provenOptimal']:
        require(native['hasIncumbent'] and native.get('status')=='optimal',label+': invalid native optimum shape')
        ledger.close(native.get('lowerBound'),native_fees['objectiveCost'],label+'/native optimal bound equality')
    if native['provenInfeasible']:
        require(not native['hasIncumbent'] and native.get('status')=='infeasible',label+': invalid native infeasibility shape')
    if method=='cpsatV12':
        same(native.get('solverSeed'),0,label+'/CP-SAT seed')
        require(native.get('solverStatus') in (0,2,3,4),label+': unexpected CP-SAT solver status')
        if native['solverStatus']==0:
            require(not native['hasIncumbent'] and not native['provenInfeasible'] and native.get('lowerBound') is None,label+': UNKNOWN promoted to proof/bound')
        if native['solverStatus']==3:same(native['provenInfeasible'],True,label+'/CP infeasible flag')
        if native['solverStatus']==4:same(native['provenOptimal'],True,label+'/CP optimal flag')
        assurance=native.get('numericalAssurance',{})
        for key,value in (('primarySafeInteger',True),('roundsFees',False),('integerArithmeticModel',True),('objectiveLimitKRW',9007199254740991)):
            same(assurance.get(key),value,label+'/CP integer scope '+key)
        if native['hasIncumbent']:
            require(type(native.get('exactIntegerObjective')) is int and abs(native['exactIntegerObjective'])<=9007199254740991,label+': unsafe/noninteger CP objective')
            same(native['exactIntegerObjective'],native_fees['objectiveCost'],label+'/exact independent CP objective')
    accepted=result.get('status') in ('optimal','feasible')
    same(meta.get('retainCacheFallback'),True,label+'/frozen cache configuration')
    same(meta.get('candidateSource'),('native_cpsat' if method=='cpsatV12' else 'native_highs') if accepted else 'no_complete_plan',label+'/fresh factory selected source')
    require('cacheAudit' not in meta.get('stages',{}),label+': fresh snapshot unexpectedly imports cached plan')
    if result.get('status')=='infeasible':same(native['provenInfeasible'],True,label+'/adapter infeasibility must have native proof flag')
    if accepted:
        same(result['status'],'optimal' if native['provenOptimal'] else 'feasible',label+'/adapter optimality must match native certificate')
        ledger.audit_dates(scenario,result['rows'],label+'/accepted physical/locks',fixed,day)
        ledger.audit_schedule(scenario,result,label+'/accepted complete row prices')
        same(v8.date_map(result['rows']),v8.date_map(native['rows']),label+'/no imported cache or changed native dates')
        require(native['hasIncumbent'],label+': accepted without native incumbent')
        if method=='cpsatV12':
            gate=stage.get('acceptance',{});accepted_at=time(gate.get('acceptedAtMs'),label+'/CP accepted time')
            require(accepted_at<=budget and accepted_at<=meta['wallTimeMs'],label+': late CP candidate accepted')
            same(v8.date_map(gate.get('acceptedDates')),v8.date_map(result['rows']),label+'/CP acceptance dates')
            ledger.close(gate.get('objectiveCost'),result['objectiveCost'],label+'/CP acceptance cost')
        else:
            require(meta['wallTimeMs']<=budget,label+': native HiGHS complete return after allowance without an explicit earlier acceptance proof')
    else:
        same(result.get('rows'),[],label+'/failed plan rows')
        require(all(result.get(key) is None for key in COSTS),label+': failed plan fees must be null')
        if method=='cpsatV12':require('acceptance' not in stage,label+': failed CP output retains accepted gate')
    return {'accepted':accepted,'nativeHasIncumbent':native['hasIncumbent'],'rawNativeFees':native_fees,
        'nativeRawLowerBound':native.get('lowerBound'),'reportedNativeOptimal':native['provenOptimal'],
        'reportedNativeInfeasible':native['provenInfeasible'],'wholeCallReturnOverrun':time(meta.get('wallTimeMs'),label+'/call wall')>budget}


def audit_record(snapshot,record,receipt):
    label=record['id'];result=record['result'];terminal=record.get('rawTerminal')
    require(isinstance(terminal,dict),label+': missing raw terminal')
    same(terminal.get('id'),label,label+'/terminal identity');same(terminal.get('type'),'terminal',label+'/terminal type')
    same(terminal.get('result'),result,label+'/raw terminal accepted-result binding')
    same(terminal.get('cleanupSuccess'),True,label+'/worker native cleanup');same(terminal.get('error'),None,label+'/worker error')
    same(record.get('exitCode'),0,label+'/clean exit');same(record.get('exitSignal'),None,label+'/clean signal')
    cleanup=record.get('processGroupCleanup');require(isinstance(cleanup,dict),label+': missing group cleanup')
    same(cleanup.get('attempted'),True,label+'/group cleanup attempted');same(cleanup.get('verifiedProcessGroupGone'),True,label+'/group must be gone')
    same(cleanup.get('verificationError'),None,label+'/group verification error')
    stamps=[time(record.get(k),label+'/'+k) for k in ('terminalReceivedAtMs','parentAuditFinishedAtMs','processExitWallMs')]
    stamps += [time(cleanup.get('finishedAtMs'),label+'/cleanup finish'),time(record.get('parentWallMs'),label+'/parent finish')]
    require(stamps==sorted(stamps) and stamps[-1]<=5000,label+': exit/audit/cleanup chronology or hard deadline fails')
    attempts=cleanup.get('attempts');require(isinstance(attempts,list) and attempts,label+': no cleanup attempts')
    for attempt in attempts:
        same(attempt.get('signal'),'SIGKILL',label+'/cleanup signal');same(attempt.get('detachedProcessGroup'),True,label+'/separate group')
        require(stamps[2]<=time(attempt.get('atMs'),label+'/cleanup attempt')<=stamps[3],label+': cleanup attempt outside exit-to-finish')
    for key,value in (('parentTerminalWithinBudget',True),('hardDeadlineReached',False),('deadlineTimerFired',False),('actualCutoffMs',None),('unacceptedTerminal',None)):
        same(record.get(key),value,label+'/parent '+key)
    messages=record.get('startupReceipts');require(isinstance(messages,list) and len(messages)==2,label+': expected ready and pre-cleanup receipts')
    same([x['message']['type'] for x in messages],['ready','planner_result_before_cleanup'],label+'/receipt order')
    require(0<=messages[0]['receivedAtMs']<=messages[1]['receivedAtMs']<=stamps[0],label+': startup/planner/terminal chronology')
    for message in messages:same(message['message'].get('id'),label,label+'/startup receipt identity')
    same(messages[1]['message'].get('result'),result,label+'/pre-cleanup raw plan binding')
    same(terminal.get('ready'),messages[0]['message'].get('ready'),label+'/service ready identity')
    native_ready=terminal['ready'];same(native_ready.get('solverThreads'),1,label+'/single ready thread')
    same(native_ready.get('schemaVersion'),'portplan-native-cpsat-v12' if record['method']=='cpsatV12' else 'portplan-native-highs-v8',label+'/native ready schema')
    same(v8.metadata(result).get('nativeService'),native_ready,label+'/ready service binding')
    if record['method']=='cpsatV12':same(native_ready.get('solverSeed'),0,label+'/ready CP-SAT seed')
    require(type(native_ready.get('pid')) is int and native_ready['pid']>0,label+': missing native process id')
    call=time(terminal.get('callWallMs'),label+'/worker call wall');cleanup_wall=time(terminal.get('cleanupWallMs'),label+'/worker cleanup wall')
    require(time(terminal.get('workerElapsedMs'),label+'/worker wall')>=call+cleanup_wall,label+': worker wall omits call/cleanup')
    require(terminal['workerElapsedMs']<=stamps[0],label+': worker chronology exceeds parent receipt')
    checked=audit_native(snapshot['snapshot'],snapshot['fixedEvents'],snapshot['day'],result,record['method'],record['dailyBudgetMs'],label)
    same(record.get('acceptedPlanWithinBudget'),checked['accepted'],label+'/accepted current complete plan')
    audit=record.get('parentAudit',{});same(audit.get('valid'),True,label+'/parent physical audit')
    same(audit.get('completeCandidate'),checked['accepted'],label+'/parent completeness')
    if checked['accepted']:
        for key,value in v10.reprice_dates(snapshot['snapshot'],result['rows']).items():ledger.close(audit.get('costs',{}).get(key),value,label+'/parent costs '+key)
    expected={key:record[key] for key in ('id','caseId','day','method','dailyBudgetMs','acceptedPlanWithinBudget','parentWallMs','hardDeadlineReached')}
    expected.update(status=result['status'],objectiveCost=result.get('objectiveCost'),
        lowerBound=checked['nativeRawLowerBound'] if checked['accepted'] else None,nativeRawLowerBound=checked['nativeRawLowerBound'],
        provenOptimal=checked['accepted'] and result['status']=='optimal')
    for key,value in expected.items():same(receipt.get(key),value,label+'/published scalar '+key)
    return {**checked,'id':label,'parentExitAndCleanupWithinBudget':True,'nativePid':native_ready['pid']}


def review(directory,summary_path):
    directory=directory.resolve();summary_path=summary_path.resolve()
    declaration_path=directory/'declaration.json';index_path=directory/'complete.json'
    originals={p:digest(p) for p in (declaration_path,index_path,summary_path)}
    declaration=ledger.read_json(declaration_path);index=ledger.read_json(index_path);published=ledger.read_json(summary_path)
    same(declaration.get('schemaVersion'),'portplan-native-snapshot-diagnostic-v12','Declaration schema')
    for key,value in (('methods',list(METHODS)),('dailyBudgetsMs',[200,2000]),('parentColdHardWallMs',5000),('solverThreads',1),('solverSeed',0),('repeatIndex',1),('newGeneratedOrders',0),('newHeldOutScenarios',0),('executionState','declared')):
        same(declaration.get(key),value,'Fixed declaration '+key)
    same(set(declaration['implementationHashes']),set(SOURCE_NAMES),'Complete implementation inventory')
    for name,sha in declaration['implementationHashes'].items():same(digest(safe(directory/'source',name)),sha,'Archived source '+name)
    source=ledger.read_json(directory/'original/commitment-slack-review-v11.json');old=ledger.read_json(directory/'original/complete-v10.json')
    same(digest(directory/'original/commitment-slack-review-v11.json'),REVIEW_SHA,'Published selection-review anchor')
    same(digest(directory/'original/complete-v10.json'),INDEX_SHA,'Published V10 index anchor')
    require(source.get('valid') is True and source.get('inputIndexSha256')==INDEX_SHA,'Invalid old selection source')
    losses=[r for r in source['v10VsV7LossEpisodes'] if r['repeatIndex']==1]
    require(len(losses)==len(declaration['snapshots'])==9 and len({x['caseId'] for x in losses})==9,'Expected exactly all nine distinct old failures')
    require(sum(x['failureDay']==0 for x in losses)==5,'Expected five D0/four prefix failures')
    bindings={'data/commitment-slack-review-v11.json':REVIEW_SHA,'data/evidence-v10/v10-frozen-first/first-run/complete.json':INDEX_SHA}
    snapshots=[];snapshot_reviews=[]
    for i,(declared,loss) in enumerate(zip(declaration['snapshots'],losses)):
        original_case=next(c for c in old['cases'] if c['id']==loss['caseId']);repeat=original_case['repeats'][0]
        same(repeat['repeatIndex'],1,'Old first repeat');same(repeat['policies']['costPolishV7']['complete'],True,'V7 completing loss comparator')
        input_sha=original_case['inputArtifact']['sha256'];episode_sha=repeat['policies']['stableHiGHSV10']['artifact']['sha256']
        ip=directory/'original'/f'{i+1:02d}-input.json';ep=directory/'original'/f'{i+1:02d}-episode.json'
        same(digest(ip),input_sha,'Original nominal input SHA');same(digest(ep),episode_sha,'Original prefix episode SHA')
        snapshot,checked=audit_snapshot(directory,declared,loss,ledger.read_json(ip),ledger.read_json(ep),i)
        same(snapshot['sourceInputArtifact'],{'path':'data/evidence-v10/v10-frozen-first/first-run/'+original_case['inputArtifact']['path'],'sha256':input_sha},'Original input reference')
        same(snapshot['sourceEpisodeArtifact'],{'path':'data/evidence-v10/v10-frozen-first/first-run/'+repeat['policies']['stableHiGHSV10']['artifact']['path'],'sha256':episode_sha},'Original episode reference')
        for key in ('sourceInputArtifact','sourceEpisodeArtifact'):bindings[snapshot[key]['path']]=snapshot[key]['sha256']
        snapshots.append(snapshot);snapshot_reviews.append(checked)
    same(declaration['sourceBindings'],bindings,'Complete old source bindings')
    jobs=[]
    for i,snapshot in enumerate(snapshots):
        for j,budget in enumerate([2000,200] if i%2 else [200,2000]):
            for method in (['highsV8','cpsatV12'] if (i+j)%2 else ['cpsatV12','highsV8']):
                jobs.append({'id':snapshot['id']+'--'+method+'--'+str(budget)+'ms','snapshotIndex':i,'method':method,'dailyBudgetMs':budget,'parentHardWallMs':5000})
    same(declaration['jobs'],jobs,'Complete independent 9x2x2 matrix and execution order')
    same(index.get('declaration'),declaration,'Full declaration in completed index')
    for key,value in (('schemaVersion','portplan-native-diagnostic-v12-summary'),('executionState','complete'),('declarationSha256',originals[declaration_path]),('scenarioCount',9),('snapshotCount',9),('taskCount',36),('newGeneratedOrders',0),('newHeldOutScenarios',0),('parentHardWallMs',5000)):
        same(index.get(key),value,'Completed index '+key)
    for key,value in index.items():
        if key!='declaration':same(published.get(key),value,'Published/full summary '+key)
    same(published.get('rawEvidenceDirectory'),str(directory.relative_to(ROOT)),'Published raw directory')
    start=ledger.read_json(directory/'execution-start.json');same(start.get('declarationSha256'),originals[declaration_path],'Pre-execution declaration binding')
    same(start.get('executionState'),'running','Pre-execution state')
    require(len(index.get('records',[]))==36,'All 36 task records required')
    reviewed=[];pids=set();groups={}
    for i,(job,receipt) in enumerate(zip(jobs,index['records'])):
        record=bound(directory,receipt['artifact'],'Raw task')
        for key,value in job.items():same(record.get(key),value,'Raw task declared '+key)
        snapshot=snapshots[job['snapshotIndex']]
        for key,value in (('caseId',snapshot['caseId']),('day',snapshot['day']),('repeatIndex',1),('inputArtifact',declaration['snapshots'][job['snapshotIndex']]['artifact'])):same(record.get(key),value,'Raw task snapshot '+key)
        checked=audit_record(snapshot,record,receipt)
        require(checked['nativePid'] not in pids,'Native process reused across independent fresh tasks');pids.add(checked['nativePid'])
        reviewed.append({'artifactSha256':receipt['artifact']['sha256'],**checked})
        group=groups.setdefault(job['method']+'-'+str(job['dailyBudgetMs'])+'ms',{'tasks':0,'acceptedPlans':0,'provenOptimal':0,'statusCounts':{}})
        group['tasks']+=1;group['acceptedPlans']+=checked['accepted'];group['provenOptimal']+=checked['accepted'] and record['result']['status']=='optimal'
        status=record['result']['status'];group['statusCounts'][status]=group['statusCounts'].get(status,0)+1
    same(index['byMethodAndBudget'],groups,'Independent 36-record aggregate')
    prefixes=[r['prefixNecessaryWarehouse'] for r in snapshot_reviews if r['day']>0]
    require(len(prefixes)==4 and all(r['independentlyProvesThisFixedPrefixInfeasible'] for r in prefixes),'Four fixed-prefix necessary diagnoses did not reconstruct')
    for path,sha in originals.items():same(digest(path),sha,'Read-only original unchanged')
    return {'schemaVersion':'portplan-independent-native-diagnostic-review-v12','valid':True,'readOnly':True,'importsJavaScript':False,'solverRuns':0,
        'inputIndexSha256':originals[index_path],'publishedSummarySha256':originals[summary_path],'declarationSha256':originals[declaration_path],
        'implementationSha256':digest(__file__),'independentPhysicsReviewerSha256':digest(ROOT/'scripts/review-v10.py'),'ledgerSha256':digest(ROOT/'scripts/review-v5.py'),
        'snapshotCount':9,'taskCount':36,'seenD0FailureSnapshots':5,'seenExecutedPrefixFailureSnapshots':4,'newHeldOutScenarios':0,'newGeneratedOrders':0,
        'byMethodAndBudget':groups,'snapshots':snapshot_reviews,'records':reviewed,'currentPrefixNecessaryInfeasibility':prefixes,
        'recordedNativeOptimalityProvedIndependently':False,
        'scope':'Nine already-seen V10 failed snapshots, four methods/budget combinations each, not a fresh sample or policy rollout. Full old prefix, public observations, locks, all raw/accepted complete-date resources and fees, recorded timely acceptance, cold clean exit/group cleanup, native schemas and accepted-versus-raw bound isolation independently reconstructed in Python. CP-SAT and HiGHS reports of optimality/native lower bounds are consistency-checked, not independently solved or third-party certified. Four necessary warehouse contradictions prove only the exact fixed executed prefixes; they do not prove the original unconstrained scenarios or other policies impossible. 2000ms is offline diagnosis, not the 200ms default budget. No CI, pooled ranking, enterprise gain or default replacement claim. Recorded clocks and process-cleanup logs are not externally authenticated.'}


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--run',type=Path,required=True);parser.add_argument('--summary',type=Path,required=True);parser.add_argument('--output',type=Path);parser.add_argument('--supersedes-review',type=Path,help='Bind a preserved earlier audit; never replace it')
    args=parser.parse_args()
    if args.output:require(not args.output.exists(),'Refuse to overwrite an earlier diagnostic review')
    result=review(args.run,args.summary)
    if args.supersedes_review:
        previous=ledger.read_json(args.supersedes_review)
        require(previous.get('valid') is True and previous.get('schemaVersion')==result['schemaVersion'],'Previous review has wrong schema/validity')
        for key in ('inputIndexSha256','publishedSummarySha256','declarationSha256'):
            same(previous.get(key),result[key],'Superseded review must cover the identical original evidence '+key)
        result['supersedesReview']={'path':str(args.supersedes_review),'sha256':digest(args.supersedes_review),'implementationSha256':previous['implementationSha256']}
        result['supplementScope']='Additional finite-or-null raw native bounds, no adapter promotion of a merely feasible/UNKNOWN native result to optimal/infeasible, and final schema negative fixtures. Original diagnostic inputs/results and first audit/archive remain unchanged.'
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        with args.output.open('x',encoding='utf-8') as stream:stream.write(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ('records','snapshots','currentPrefixNecessaryInfeasibility')},ensure_ascii=False,allow_nan=False))


if __name__=='__main__':main()
