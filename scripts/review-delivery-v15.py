#!/usr/bin/env python3
"""Independent read-only Python review of seen V15 cold-cache interventions.

No JavaScript or optimizer is imported. The four cases and their three archived
clock repeats remain seen development inputs, never fresh research samples.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
METHODS = ['seededHiGHSV12', 'guardedHiGHSV13', 'timelyHiGHSV15']
CASE_DAYS = {'v14-stress-aged-backlog-balanced-n50-r2': 6,
             'v14-stress-new-arrivals-tight-n100-r3': 6,
             'v14-stress-new-arrivals-tight-n100-r4': 3,
             'v14-stress-new-arrivals-tight-n50-r1': 7}
PREFIX_KEYS = ['day','observedEvents','observationHash','decisions','executedEvents','state','revisions','revisionCount']
ORIGINAL_INDEX_SHA = 'a0081a725e21a019c783bffe5b3c0e8aedf8f8b29903564fa04fa1ee53a2fcb9'


def require(condition, message):
    if not condition: raise ValueError(message)


def same(actual, expected, label):
    require(actual == expected, label + ': inconsistent independent reconstruction')


def digest(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):h.update(block)
    return h.hexdigest()


def read_json(path):
    def reject(value):raise ValueError('Nonfinite JSON '+value)
    return json.loads(Path(path).read_text(encoding='utf-8'),parse_constant=reject)


def safe_path(base,name):
    require(isinstance(name,str) and name and not Path(name).is_absolute() and '..' not in Path(name).parts,'Unsafe evidence path')
    path=(base/name).resolve();require(path.is_relative_to(base.resolve()),'Evidence path escapes bundle');return path


def load_helpers(source_root):
    def load(name,path):
        spec=importlib.util.spec_from_file_location(name,safe_path(source_root,path))
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
    return load('v15_independent_v12','scripts/review-v12.py'),load('v15_independent_v13_guard','scripts/review-replay-guard-v13.py')


def dates(rows,ledger):
    return [{key:r[key] for key in ('id',*ledger.EVENTS)} for r in rows]


def original_endpoint(source,original,day,v12):
    """Rebuild only current public information; no old private cache is read."""
    ledger=v12.ledger;result=original['result'];fixed={};prefix=[]
    require(len(result.get('timeline',[]))>day,'Original endpoint day was not observed')
    for expected,entry in enumerate(result['timeline'][:day]):
        same(entry.get('day'),expected,'Original prefix day')
        same(entry.get('status'),'executed','Every forced original prefix day physically executed')
        prefix.append({k:entry[k] for k in PREFIX_KEYS})
        for event in entry['executedEvents']:
            field=ledger.EVENT_FIELDS[event['event']]
            require(field not in fixed.get(event['id'],{}),'Repeated original physical action')
            fixed.setdefault(event['id'],{})[field]=event['day']
    nominal,events=source['nominalScenario'],source['events']
    current,announcements=ledger.observed_snapshot(nominal,ledger.realize(nominal,events),events,day)
    value={'scenario':current,'observedEvents':announcements,'fixedEvents':fixed,'minEventDay':day}
    checksum=ledger.checksum(value,result['timeline'][day]['observationHash'])
    same(checksum,result['timeline'][day]['observationHash'],'Independent public endpoint hash')
    return {'publicSnapshot':current,'fixedEvents':fixed,'prefixProjection':prefix,'observationHash':checksum}


def audit_economic_selection(scenario,meta,selected,fixed,previous,day,executed,v12,label):
    """Original V12 economics, including unchanged complete-M fee ties.

    A strictly cheaper valid native endpoint with a completed timely atomic
    comparison cannot be silently discarded by an unreported V13-style veto.
    """
    checked=v12.audit_commitment_selection(scenario,meta,selected,fixed,previous,day,executed,label,200,seeded=True)
    proof=meta['stabilitySelection'];gate=proof['nativeGate'];pre=proof.get('preNativeIncumbent');proposal=proof.get('proposalDates')
    if proposal is not None and v12.ledger.feasible_dates(scenario,proposal,fixed,day) and gate.get('feesMatchedAtMs') is not None:
        fee=v12.reprice_dates(scenario,proposal)['objectiveCost']
        strict=pre is not None and fee<pre['fees']['objectiveCost']-1e-6
        complete_comparison=gate.get('selectionFinishedAtMs') is not None and gate['selectionFinishedAtMs']<=200 and gate.get('outcome')!='late_candidate'
        if (strict or pre is None) and complete_comparison and meta.get('stages',{}).get('native',{}).get('independentCostsMatch') is True:
            require(gate.get('acceptedAtMs') is not None and gate['acceptedAtMs']<=200,label+': timely economic incumbent discarded')
    strict_guard=proof.get('strictFeeGuard')
    require(strict_guard is None or strict_guard.get('attempted') is False,label+': economic backbone acquired a strict-fee M veto')
    return checked


def audit_live_selection(scenario,meta,selected,fixed,previous,day,executed,method,v12,guard,label):
    same(meta.get('developmentEndpointImport'),None,label+'/no private cache import')
    if method=='guardedHiGHSV13':
        return guard.audit_guard_selection(scenario,meta,selected,fixed,previous,day,executed,label,200)
    require(method in ('seededHiGHSV12','timelyHiGHSV15'),'Undeclared development method')
    return audit_economic_selection(scenario,meta,selected,fixed,previous,day,executed,v12,label)


def audit_delivery_budget(meta,v12,label):
    proof=meta.get('deliveryBudget');require(isinstance(proof,dict),label+': missing V15 return-budget receipt')
    for key,value in (('schemaVersion','portplan-v15-native-return-budget'),('wholeDeadlineAtMs',200),('nativeDeadlineAtMs',190),
        ('nativeReturnTargetAtMs',190),('outerAcceptanceDeadlineAtMs',200),('nativeReturnReserveMs',10),('serviceAuditReserveMs',2),
        ('acceptanceDeadline','original_whole_call_deadline_not_earlier_native_target')):
        same(proof.get(key),value,label+'/delivery '+key)
    same(meta.get('timeBudgetMs'),200,label+'/whole cooperative budget')
    wall=meta.get('wallTimeMs');require(v12.ledger.finite(wall) and wall>=0,label+': missing whole-call clock')
    elapsed=('nativeRequestStartedAtMs','readyFinishedAtMs','requestClockSampleAtMs','serializationFinishedAtMs','preSendCheckedAtMs','requestSentAtMs','requestSettledAtMs','nativeResponseReceivedAtMs')
    for key in elapsed:
        at=v12.v9.optional_time(proof.get(key),label+'/'+key)
        require(at is None or at<=wall,label+': delivery clock exceeds whole call')
    status=proof.get('requestStatus');dispatched=proof.get('serviceRequestDispatched')
    require(type(dispatched) is bool,label+': missing actual native dispatch flag')
    actual_response=proof.get('actualServiceResponse');require(type(actual_response) is bool,label+': missing actual service packet flag')
    allowed={'not_requested','native_return_budget_exhausted_before_request','native_return_budget_exhausted_before_ipc',
             'native_return_budget_exhausted_during_serialization','native_return_budget_exhausted_before_send','dispatched'}
    require(status in allowed,label+': unknown request budget state')
    same(dispatched,status=='dispatched',label+'/actual dispatch state')
    if status in ('not_requested','native_return_budget_exhausted_before_request'):
        for key in (*elapsed,'remainingAtServiceReadyMs','requestUnixNowMs','nativeDeadlineUnixMs','nativeReturnTargetMet','requestSettlement'):
            same(proof.get(key),None,label+'/unrequested '+key)
        same(actual_response,False,label+'/no service response without a request')
        same(meta['stabilitySelection']['nativeGate'].get('receivedAtMs'),None,label+'/unrequested native receipt')
        return {'requests':0,'nativeTargetMet':0,'nativeTargetMissed':0,'nativeTargetUnknown':0,'requestsSkippedBeforeDispatch':1}
    started,sample=proof.get('nativeRequestStartedAtMs'),proof.get('requestClockSampleAtMs')
    require(started is not None and sample is not None and started<=sample,label+': service-ready chronology')
    same(proof.get('readyFinishedAtMs'),sample,label+'/same remaining-budget clock sample')
    remaining=190-sample
    v12.ledger.close(proof.get('remainingAtServiceReadyMs'),remaining,label+'/earlier native remaining budget')
    if status=='native_return_budget_exhausted_before_ipc':
        require(remaining<=2,label+': false pre-IPC exhausted budget')
        require(type(proof.get('requestUnixNowMs')) is int and proof['requestUnixNowMs']>0,label+': missing conservative pre-IPC wall sample')
        for key in ('nativeDeadlineUnixMs','serializationFinishedAtMs','preSendCheckedAtMs','requestSentAtMs'):
            same(proof.get(key),None,label+'/pre-IPC '+key)
    else:
        require(remaining>2,label+': native sent without original service audit reserve')
        unix=proof.get('requestUnixNowMs');deadline=proof.get('nativeDeadlineUnixMs')
        require(type(unix) is int and unix>0 and v12.ledger.finite(deadline),label+': missing original absolute native deadline')
        require(abs(deadline-unix-remaining)<=.002,label+': native Unix deadline received a fresh/extra allowance')
        serialized=proof.get('serializationFinishedAtMs')
        require(serialized is not None and serialized>=sample,label+': serialization before original budget clock')
        if status=='native_return_budget_exhausted_during_serialization':
            require(serialized>=190,label+': false serialization exhaustion')
            same(proof.get('preSendCheckedAtMs'),None,label+'/serialization exhaustion before send check')
            same(proof.get('requestSentAtMs'),None,label+'/serialization exhaustion never sent')
        else:
            checked=proof.get('preSendCheckedAtMs')
            require(checked is not None and checked>=serialized,label+': final send check chronology')
            if status=='native_return_budget_exhausted_before_send':
                require(checked>=190,label+': false pre-send exhaustion')
                same(proof.get('requestSentAtMs'),None,label+'/late send was not dispatched')
            else:
                require(checked<190,label+': native IPC dispatched after earlier return deadline')
                same(proof.get('requestSentAtMs'),checked,label+'/same atomic send check')
    response=proof.get('nativeResponseReceivedAtMs')
    settled=proof.get('requestSettledAtMs')
    require(settled is not None,label+': missing native request settlement clock')
    same(settled,meta['stabilitySelection']['nativeGate'].get('receivedAtMs'),label+'/request settlement is not proof of service return')
    if actual_response:
        require(dispatched and response is not None and proof['requestSentAtMs']<=response<=settled,label+': real response chronology/dispatch differs')
        same(proof.get('requestSettlement'),'service_response',label+'/actual service packet settlement')
        same(proof.get('nativeReturnTargetMet'),response<=190,label+'/observed earlier return target')
    else:
        same(response,None,label+'/no synthetic child response')
        same(proof.get('nativeReturnTargetMet'),None,label+'/unobserved return target stays null')
        certificate=meta.get('nativeCertificate') or {}
        same(bool(certificate.get('hasIncumbent')),False,label+'/no synthetic native incumbent')
        same(meta['stabilitySelection'].get('proposalDates'),None,label+'/no complete native proposal without actual response')
        expected_settlement=('hard_timeout' if certificate.get('hardTimeout') else 'service_error' if certificate.get('status')=='solver_error'
                             else 'synthetic_without_service_response' if dispatched else 'not_dispatched')
        same(proof.get('requestSettlement'),expected_settlement,label+'/synthetic settlement type')
        if dispatched:
            require(expected_settlement in ('hard_timeout','service_error'),label+': unexplained dispatched request without real result')
            require(settled>=proof['requestSentAtMs'],label+': settlement predates dispatch')
    return {'requests':int(dispatched),'nativeTargetMet':int(actual_response and response<=190),
            'nativeTargetMissed':int(actual_response and response>190),'nativeTargetUnknown':int(dispatched and not actual_response),
            'requestsSkippedBeforeDispatch':int(not dispatched)}


def value_sha(value,v12):return hashlib.sha256(v12.ledger.stable_json(value).encode('utf-8')).hexdigest()


def read_bound(base,ref):
    path=safe_path(base,ref['path']);same(digest(path),ref['sha256'],'Bound artifact SHA '+ref['path']);return read_json(path)


def expected_jobs(endpoints):
    jobs=[];case_ids=list(CASE_DAYS)
    for repeat in (1,2,3):
        for offset in range(4):
            ci=(offset+repeat-1)%4;case_id=case_ids[ci];item=next(e for e in endpoints if e['caseId']==case_id and e['repeatIndex']==repeat)
            for mi in range(3):
                method=METHODS[(ci+repeat-1+mi)%3]
                jobs.append({'jobId':f'v15-seen-{case_id}--a{repeat}--{method}','caseId':case_id,'repeatIndex':repeat,
                    'algorithmSeed':[79011,79023,79039][repeat-1],'interventionDay':CASE_DAYS[case_id],'method':method,'endpointId':item['endpointId']})
    return jobs


def audit_protocol(protocol,original_root,source_root,v12):
    same(protocol.get('schemaVersion'),'portplan-v15-seen-cold-cache-delivery-development-protocol','Seen development protocol schema')
    for key,value in (('methods',METHODS),('caseDays',[{'caseId':k,'interventionDay':v} for k,v in CASE_DAYS.items()]),
        ('uniqueBusinessScenarioCount',4),('archivedEndpointCount',12),('branchRunCount',36),('newHeldOutExperiments',0),('newOrderGeneration',0),
        ('newAlgorithmSeeds',0),('ciComputed',False),('prefixSourceMethod','guardedHiGHSV13'),('prefixProjectionKeys',PREFIX_KEYS),('historicalCacheImported',False),
        ('originalRepeats',[{'index':i+1,'seed':s} for i,s in enumerate((79011,79023,79039))])):
        same(protocol.get(key),value,'Fixed development contract '+key)
    same(protocol.get('budget'),{'dailyBudgetMs':200,'parentHardWallMs':5000,'nativeThreads':1,'nativeRandomSeed':0,'parentAcceptance':v12.PARENT_ACCEPTANCE},'Unchanged cold budget')
    for key,value in (('method','timelyHiGHSV15'),('nativeReturnReserveMs',10),('wholeCallMs',200),('nativeTargetMs',190),('serviceAuditReserveMs',2)):
        same(protocol.get('candidateChange',{}).get(key),value,'Single prespecified candidate change '+key)
    old=read_json(source_root/'data/protocol-v12.json')['callBudgets']['seededHiGHSV12']
    for method in METHODS:same(protocol['callBudgets'][method],{**old,**({'nativeReturnReserveMs':10} if method==METHODS[-1] else {})},'Only fixed reserve changes '+method)
    same(protocol.get('executionAuthorization'),{'protocolGrantsSolverRun':False,'noSolverDuringDeclare':True,'explicitRunFlagRequired':True,
        'requiresCommittedSource':True,'requiresPushedSource':True,'requiresRootExplicitRunAuthorization':True,'retriesOrResumeAllowed':False,
        'parameterRetuningAllowed':False,'naturalD0ExpansionAllowed':False},'One declared controlled run only')
    bindings=protocol.get('sourceBindings');require(isinstance(bindings,dict) and len(bindings)==18,'All 18 original source bindings required')
    for name,sha in bindings.items():same(digest(safe_path(original_root,name)),sha,'Original source SHA '+name)
    same(protocol['originalIndex'],{'path':'artifacts/v14-frozen-first/first-run/complete.json','sha256':ORIGINAL_INDEX_SHA},'Published V14 first index')
    same(protocol['originalDiagnosis'],{'path':'data/diagnosis-v14.json','sha256':'0c7fd07ae6c4f3943c7a2fddee0d42ba9fd5b785e1dff23ca0be348f1cb1d522'},'Published first loss diagnosis')
    index=read_bound(original_root,protocol['originalIndex']);diagnosis=read_bound(original_root,protocol['originalDiagnosis'])
    for name,sha in index['protocol']['frozenAlgorithmBindings'].items():
        same(digest(safe_path(source_root,name)),sha,'Unchanged frozen baseline/runtime SHA '+name)
    for name in ('scripts/review-v12.py','scripts/review-v10.py','scripts/review-v9.py','scripts/review-v8.py','scripts/review-v5.py'):
        same(digest(safe_path(source_root,name)),index['implementationHashes'][name],'Unchanged independent Python ledger SHA '+name)
    losses={(c['id'],rep['repeatIndex']) for c in index['cases'] for rep in c['repeats'] if not rep['policies']['guardedHiGHSV13']['complete']
            and any(receipt['complete'] for method,receipt in rep['policies'].items() if method!='guardedHiGHSV13')}
    same({sid for sid,_ in losses},set(CASE_DAYS),'All four loss-union business cases retained')
    same({(r['caseId'],r['repeatIndex']) for r in diagnosis['lossEpisodes']},losses,'Diagnosis full loss coverage')
    endpoints=protocol.get('endpoints');require(isinstance(endpoints,list) and len(endpoints)==12,'All twelve archived endpoints required')
    expected=[(sid,ri) for sid in CASE_DAYS for ri in (1,2,3)];reviewed=[]
    for item,(sid,ri) in zip(endpoints,expected):
        for key,value in (('caseId',sid),('repeatIndex',ri),('algorithmSeed',[79011,79023,79039][ri-1]),('interventionDay',CASE_DAYS[sid]),
                          ('endpointId',f'{sid}::repeat-{ri}'),('prefixDays',list(range(CASE_DAYS[sid])))):
            same(item.get(key),value,'Exact original endpoint '+key)
        case=next(c for c in index['cases'] if c['id']==sid);rep=case['repeats'][ri-1]
        base='artifacts/v14-frozen-first/first-run/'
        same(item['sourceInputArtifact'],{'path':base+case['inputArtifact']['path'],'sha256':case['inputArtifact']['sha256']},'Original index input reference')
        ref=rep['policies']['guardedHiGHSV13']['artifact']
        same(item['sourceEpisodeArtifact'],{'path':base+ref['path'],'sha256':ref['sha256']},'Original repeat-specific V13 raw reference')
        for ref in (item['sourceInputArtifact'],item['sourceEpisodeArtifact']):same(bindings.get(ref['path']),ref['sha256'],'Declared copied original reference')
        source=read_bound(original_root,item['sourceInputArtifact']);original=read_bound(original_root,item['sourceEpisodeArtifact'])
        same(original['caseId'],sid,'Original raw case');same(original['repeatIndex'],ri,'Original raw repeat');same(original['algorithmSeed'],item['algorithmSeed'],'Original raw seed')
        rebuilt=original_endpoint(source,original,item['interventionDay'],v12)
        for key in ('publicSnapshot','fixedEvents'):same(item[key],rebuilt[key],'Independent current public '+key);same(item[key+'Sha256'],value_sha(rebuilt[key],v12),'Independent '+key+' SHA')
        same(item['prefixProjectionSha256'],value_sha(rebuilt['prefixProjection'],v12),'All original prefix fields SHA')
        same(item['originalObservationHash'],rebuilt['observationHash'],'Original public observation hash')
        trace=original['result']['plannerTrace'][item['interventionDay']]
        same(item['originalInterventionStatus'],trace['plannerStatus'],'Original boundary status')
        same(item['originalInterventionCacheStatus'],trace['stabilitySelection']['cacheStatus'],'Original boundary cache status')
        same(item['originalComplete'],original['result']['complete'],'Original success retained')
        same(item['originalLossEpisode'],(sid,ri) in losses,'Losses and successful source repeats all retained')
        reviewed.append({'endpointId':item['endpointId'],'originalComplete':item['originalComplete'],'originalLossEpisode':item['originalLossEpisode']})
    same(protocol.get('jobs'),expected_jobs(endpoints),'Independent full 36-job rotation without selection')
    return {'valid':True,'archivedSources':18,'uniqueBusinessScenarioCount':4,'archivedEndpointCount':12,'plannedRuns':36,
            'originalLossEpisodes':len(losses),'newHeldOutExperiments':0,'ciComputed':False,'endpoints':reviewed}


def audit_episode(source,original,item,result,method,v12,guard,label):
    checked=v12.audit_episode(source['nominalScenario'],source['events'],result,label,5000,'controlledDeliveryReplayV15',200)
    counts={**v12.empty_native_counts(),**{k:0 for k in ('strictGuardAttempts','strictGuardAccepted','strictGuardBlockedMIncrease','strictGuardIncompleteOrError','strictGuardLate')}}
    delivery={k:0 for k in ('requests','nativeTargetMet','nativeTargetMissed','nativeTargetUnknown','requestsSkippedBeforeDispatch')}
    if not checked['historyAvailable']:return {**checked,'nativeSelection':counts,'deliveryBudget':delivery,'actualDecisionCalls':None,'actualNativeRequests':None}
    day0=item['interventionDay'];same(result.get('historicalCacheImported'),False,label+'/no historical private cache')
    same(result.get('naturalFullD0'),False,label+'/not natural D0')
    same(result.get('studyVersion'),'v15-seen-cold-cache-development',label+'/development label')
    fixed={};previous=None;calls=requests=0;prefix_checks=[];first=None;overruns=0
    nominal,events=source['nominalScenario'],source['events'];actual=v12.ledger.realize(nominal,events)
    for day,(entry,record) in enumerate(zip(result['timeline'],result['plannerTrace'])):
        current,_=v12.ledger.observed_snapshot(nominal,actual,events,day);executed=entry['status']=='executed';forced=day<day0
        for key,value in (('publicSnapshot',current),('fixedEvents',fixed),('dailyBudgetMs',200),('nativePolicyDecision',not forced),
            ('historicalCacheImported',False),('claimsNaturalFullD0',False),('firstActualPlannerCall',day==day0)):
            same(record.get(key),value,label+f'/D{day}/'+key)
        same(record.get('phase'),'archived_prefix' if forced else 'cold_cache_intervention' if day==day0 else 'natural_suffix',label+'/phase')
        require(v12.ledger.finite(record.get('callWallMs')) and record['callWallMs']>=0,label+': missing real call wall');overruns+=record['callWallMs']>200
        meta=v12.v8.metadata(record)
        if forced:
            same(record.get('actualNativeRequests'),0,label+'/forced prefix never solves')
            same(record.get('claimsNativeDiscovery'),False,label+'/forced dates not a native discovery')
            same(record.get('archivedDecisionDatesSha256'),value_sha(original['result']['timeline'][day]['decisions'],v12),label+'/forced full archived dates SHA')
            for key,value in (('method','archived_prefix_replay_v15'),('optimizerCalls',0),('decisionCalls',0),('solverCalls',0),('historicalCacheImported',False),('claimsNativeDiscovery',False)):
                same(meta.get(key),value,label+'/forced '+key)
            if executed:
                require(record.get('forcedStepTimely') is True and v12.ledger.finite(record.get('forcedStepAcceptanceWallMs')) and record['callWallMs']<=record['forcedStepAcceptanceWallMs']<=200,label+': late forced prefix executed')
                projection={k:entry[k] for k in PREFIX_KEYS};same(projection,{k:original['result']['timeline'][day][k] for k in PREFIX_KEYS},label+'/all eight original prefix fields')
                prefix_checks.append({'day':day,'exactProjectedMatch':True,'sha256':value_sha(projection,v12),'keys':PREFIX_KEYS})
        else:
            calls+=1;same(meta.get('decisionCalls'),calls,label+'/only real policy calls counted')
            returned=meta.get('nativeCertificate',{}).get('hasIncumbent') is True if isinstance(meta.get('nativeCertificate'),dict) else False
            same(record.get('nativeReturnedIncumbent'),returned,label+'/native returned incumbent binding')
            same(record.get('claimsNativeDiscovery'),returned,label+'/discovery requires a returned native incumbent')
            same(record.get('selectedSource'),meta.get('candidateSource'),label+'/actual selected source binding')
            if day==day0:
                same(current,item['publicSnapshot'],label+'/same intervention public input');same(fixed,item['fixedEvents'],label+'/same intervention physical locks')
                same(entry['observationHash'],item['originalObservationHash'],label+'/same endpoint observation')
                proof=meta.get('stabilitySelection',{});same(proof.get('cacheStatus'),'absent',label+'/fresh cold-cache intervention')
                same(proof.get('beforeDates'),None,label+'/no imported previous dates');same(proof.get('cacheValid'),False,label+'/no imported valid cache')
            audited=audit_live_selection(current,meta,entry['decisions'],fixed,previous,day,executed,method,v12,guard,label+f'/D{day}')
            for key,value in audited.items():counts[key]+=value
            if method==METHODS[-1]:
                receipt=audit_delivery_budget(meta,v12,label+f'/D{day}')
                for key,value in receipt.items():delivery[key]+=value
            for field,counter in (('strictReplacementCount','strictReplacements'),('tieRetainedCount','feeTiesRetained'),('commitmentReplacementCount','commitmentReplacements'),('constructorCalls','constructorCalls'),('acceptedConstructorReceipts','acceptedConstructorReceipts')):
                same(meta.get(field),counts[counter],label+'/real cumulative '+field)
            cumulative=meta.get('solverCalls');require(type(cumulative) is int and requests<=cumulative<=requests+1,label+': actual solver counter')
            same(record.get('actualNativeRequests'),cumulative-requests,label+'/dispatch attribution')
            if method==METHODS[-1]:same(cumulative-requests,int(meta['deliveryBudget']['serviceRequestDispatched']),label+'/actual request budget counter')
            requests=cumulative
            if first is None:first={'day':day,'status':record.get('plannerStatus'),'executed':executed,'callWallMs':record['callWallMs'],
                'selectedSource':meta['stabilitySelection']['selectedSource'],'nativeGate':meta['stabilitySelection']['nativeGate'],
                'constructorDelivery':meta['stabilitySelection']['constructorDelivery'],'deliveryBudget':meta.get('deliveryBudget')}
        if executed:
            same(record.get('selectedDates'),dates(entry['decisions'],v12.ledger),label+'/full selected dates')
            v12.endpoint_fees(current,entry['decisions'],record.get('fees'),label+'/independent complete current fees')
            if not forced:previous={row['id']:row for row in entry['decisions']}
            for event in entry['executedEvents']:fixed.setdefault(event['id'],{})[v12.ledger.EVENT_FIELDS[event['event']]]=day
    same(result.get('replayPrefixChecks'),prefix_checks,label+'/all forced prefix receipts')
    expected_identity={k:item[k] for k in ('caseId','repeatIndex','interventionDay','prefixProjectionSha256','publicSnapshotSha256','fixedEventsSha256','originalObservationHash')}
    same(result.get('replayIdentity'),expected_identity,label+'/repeat-specific replay identity')
    stats=result.get('plannerStats',{})
    for key,value in (('actualDecisionCalls',calls),('nativeDecisionCalls',calls),('solverCalls',requests),('archivedReplayCalls',len(result['plannerTrace'])-calls),('decisionCalls',len(result['plannerTrace'])),('historicalCacheImported',False)):
        same(stats.get(key),value,label+'/all replay statistics '+key)
    same(stats.get('callWallMs'),[r['callWallMs'] for r in result['plannerTrace']],label+'/call clocks')
    v12.ledger.close(stats.get('maxCallWallMs'),max(stats['callWallMs']),label+'/maximum call clock')
    startup=result.get('startupWallMs');require(v12.ledger.finite(startup) and 0<=startup<=result['finalReceivedMs'],label+': cold startup not charged')
    require(startup+sum(stats['callWallMs'])<=result['finalReceivedMs']+1e-6,label+': replay/startup/real calls excluded from parent clock')
    return {**checked,'nativeSelection':counts,'deliveryBudget':delivery,'actualDecisionCalls':calls,'actualNativeRequests':requests,
        'firstLiveCall':first,'cooperativeCallOverruns':overruns}


def summarize(records):
    by_method={}
    for method in METHODS:
        rows=[r for r in records if r['method']==method]
        by_method[method]={'runCount':len(rows),'completeWithinBudgetCount':sum(r['receipt']['complete'] for r in rows),
            'unknownHistoryCount':sum(r['receipt']['executionHistoryUnavailable'] for r in rows),
            'outcomes':[{'jobId':r['jobId'],'endpointId':r['endpointId'],'caseId':r['caseId'],'repeatIndex':r['repeatIndex'],
                'interventionDay':r['interventionDay'],'status':r['receipt']['status'],'complete':r['receipt']['complete'],
                'failureDay':(r['receipt'].get('failure') or {}).get('day'),'totalCost':r['receipt']['totalCost'],
                'incrementalCost':r['receipt']['incrementalCost'],'revisionCount':r['receipt']['revisionCount']} for r in rows]}
    comparisons=[]
    for baseline in METHODS[:2]:
        pairs=[]
        for sid in CASE_DAYS:
            for repeat in (1,2,3):
                b=next(r['receipt'] for r in records if r['caseId']==sid and r['repeatIndex']==repeat and r['method']==baseline)
                a=next(r['receipt'] for r in records if r['caseId']==sid and r['repeatIndex']==repeat and r['method']==METHODS[-1])
                joint=b['complete'] and a['complete']
                pairs.append({'endpointId':f'{sid}::repeat-{repeat}','caseId':sid,'repeatIndex':repeat,'baselineComplete':b['complete'],
                    'candidateComplete':a['complete'],'jointlyCompleted':joint,'totalBaselineMinusCandidateKRW':b['totalCost']-a['totalCost'] if joint else None,
                    'incrementalBaselineMinusCandidateKRW':b['incrementalCost']-a['incrementalCost'] if joint else None,
                    'revisionBaselineMinusCandidate':b['revisionCount']-a['revisionCount'] if joint and b['revisionCount'] is not None and a['revisionCount'] is not None else None})
        comparisons.append({'baselineMethod':baseline,'candidateMethod':METHODS[-1],'endpointPairCount':12,
            'jointlyCompletedEndpointPairCount':sum(r['jointlyCompleted'] for r in pairs),'gained':sum(not r['baselineComplete'] and r['candidateComplete'] for r in pairs),
            'lost':sum(r['baselineComplete'] and not r['candidateComplete'] for r in pairs),'pairs':pairs})
    return {'runCount':len(records),'uniqueBusinessScenarioCount':4,'archivedEndpointCount':12,'byMethod':by_method,'comparisons':comparisons,
        'ciComputed':False,'newHeldOutExperiments':0,'historicalCacheImported':False,
        'scope':'Descriptive cold-cache seen-endpoint continuation only; 36 branches are not 36 business samples. Terminal fee/revision comparisons require matching joint completion. No natural D0, holdout, research-CI or default-policy claim.'}


def review_run(directory):
    directory=directory.resolve();index_path=directory/'complete.json';decl_path=directory/'declaration.json'
    index_sha,decl_sha=digest(index_path),digest(decl_path);index,declaration=read_json(index_path),read_json(decl_path)
    same(index.get('schemaVersion'),'portplan-v15-cold-cache-delivery-results','Complete development results schema')
    same(index.get('executionState'),'complete','Requires all first-run records')
    same(declaration.get('schemaVersion'),'portplan-v15-cold-cache-delivery-declaration','Predeclared source schema')
    same(declaration.get('executionState'),'declared','Immutable declaration state');same(declaration.get('rootAuthorized'),False,'Declaration grants no solver run')
    same(index.get('declarationSha256'),decl_sha,'Complete index binds original declaration')
    for key in ('implementationHashes','protocolSha256','sourceBindings','sourceCommit'):same(index.get(key),declaration.get(key),'Frozen declaration/index '+key)
    same(index.get('sourceConsistency'),{'before':True,'after':True},'Frozen source before/after checks')
    for key,value in (('newHeldOutExperiments',0),('newGeneratedSeeds',0),('ciComputed',False),('historicalCacheImported',False)):
        same(index.get(key),value,'Bounded development scope '+key);same(declaration.get(key),value,'Declared development scope '+key)
    commit=declaration.get('sourceCommit');require(isinstance(commit,str) and len(commit)==40 and all(c in '0123456789abcdef' for c in commit),'Malformed declared preregistration commit')
    source_root=directory/'source';hashes=declaration.get('implementationHashes');require(isinstance(hashes,dict) and hashes,'Missing frozen source hashes')
    for name,sha in hashes.items():same(digest(safe_path(source_root,name)),sha,'Frozen implementation SHA '+name)
    for name in ('scripts/review-delivery-v15.py','scripts/review-v12.py','scripts/review-v10.py','scripts/review-v9.py','scripts/review-v8.py','scripts/review-v5.py',
                 'scripts/review-replay-guard-v13.py','scripts/highs-planner-v12.mjs','scripts/highs-planner-v13.mjs','scripts/highs-planner-v15.mjs',
                 'scripts/replay-delivery-v15.mjs','scripts/replay-delivery-v15.worker.mjs','data/protocol-v12.json','data/protocol-development-v15.json'):
        require(name in hashes,'Unbound declared runtime dependency '+name)
    same(hashes['scripts/review-delivery-v15.py'],digest(__file__),'This reviewer frozen before first run')
    proto_path=safe_path(source_root,declaration['protocolPath']);same(digest(proto_path),declaration['protocolSha256'],'Original frozen protocol bytes')
    protocol=read_json(proto_path);same(declaration.get('protocol'),protocol,'Embedded declaration/actual frozen protocol content')
    same(declaration.get('sourceBindings'),protocol['sourceBindings'],'Declared original subset bindings')
    same(declaration.get('jobs'),protocol['jobs'],'Declared fixed job order')
    v12,guard=load_helpers(source_root);contract=audit_protocol(protocol,directory/'original',source_root,v12)
    start=read_json(directory/'execution-start.json')
    for key,value in (('rootAuthorized',True),('sourceCommit',commit),('declarationSha256',decl_sha),('protocolSha256',declaration['protocolSha256']),
        ('runtimeImplementationHashes',hashes),('sourceConsistency',{'live':True,'frozen':True,'originals':True}),('plannedJobCount',36)):
        same(start.get(key),value,'Separate first-run runtime authorization '+key)
    records=index.get('records');require(isinstance(records,list) and len(records)==36,'Every first36 branch must be retained')
    endpoints={e['endpointId']:e for e in protocol['endpoints']};seen=set();seen_journals=set();parents={};reviewed=[];totals={'episodes':0,'completeEpisodes':0,'historyUnavailable':0,'acceptedPlans':0,'physicalEvents':0}
    for record,job in zip(records,expected_jobs(protocol['endpoints'])):
        for key,value in job.items():same(record.get(key),value,'Exact declared job coverage/order '+key)
        require(record['artifact']['path'] not in seen,'Raw evidence reused across jobs');seen.add(record['artifact']['path'])
        envelope=read_bound(directory,record['artifact']);item=endpoints[job['endpointId']]
        identity={**job,'episodeId':job['jobId'],'sourceInputArtifact':item['sourceInputArtifact'],'sourceEpisodeArtifact':item['sourceEpisodeArtifact']}
        for key,value in identity.items():same(envelope.get(key),value,'Raw original/branch binding '+key);same(record.get(key),value,'Scalar original/branch binding '+key)
        result=envelope['result'];same(result.get('policy'),job['method'],'Actual branch method')
        parent=v12.audit_formal_parent_receipt(record['receipt'],result,5000,job['jobId'])
        for key,value in parent.items():parents[key]=parents.get(key,0)+value
        source=read_bound(directory/'original',item['sourceInputArtifact']);original=read_bound(directory/'original',item['sourceEpisodeArtifact'])
        checked=audit_episode(source,original,item,result,job['method'],v12,guard,job['jobId'])
        journal_path=safe_path(directory,record['journal']['path']);same(digest(journal_path),record['journal']['sha256'],'Uncompressed call journal SHA')
        require(journal_path not in seen_journals,'Call journal path reused across branches');seen_journals.add(journal_path)
        journal=[json.loads(line) for line in journal_path.read_text().splitlines() if line.strip()]
        require(all(row.get('type') in ('ready','decision_receipt') for row in journal),'Unrecognized journal record')
        if checked['historyAvailable']:
            calls=[row for row in journal if row['type']=='decision_receipt'];same(len(calls),len(result['plannerTrace']),'Every call journaled')
            excluded=('type','scope','forcedStepAcceptanceWallMs','forcedStepTimely')
            for logged,actual in zip(calls,result['plannerTrace']):same({k:v for k,v in logged.items() if k not in excluded},{k:v for k,v in actual.items() if k not in excluded},'Full journal/terminal receipt binding')
        totals['episodes']+=1;totals['completeEpisodes']+=checked['complete'];totals['historyUnavailable']+=not checked['historyAvailable']
        totals['acceptedPlans']+=checked['acceptedPlans'];totals['physicalEvents']+=checked['executedEvents']
        reviewed.append({'jobId':job['jobId'],'artifactSha256':record['artifact']['sha256'],'parentLifecycle':parent,**checked})
    independent=summarize(records);same(index.get('summary'),independent,'Independent complete paired descriptive summary')
    same(digest(index_path),index_sha,'Read-only original index unchanged');same(digest(decl_path),decl_sha,'Read-only declaration unchanged')
    return {'schemaVersion':'portplan-independent-delivery-review-v15','valid':True,'readOnly':True,'solverRuns':0,'importsJavaScript':False,
        'inputIndexSha256':index_sha,'declarationSha256':decl_sha,'protocolSha256':declaration['protocolSha256'],'implementationSha256':digest(__file__),
        'sourceCommit':commit,'contract':contract,'coverage':totals,'parentLifecycle':parents,'summary':independent,'episodes':reviewed,
        'scope':'Internal standard-Python review of all 36 prespecified cold-cache seen-input branches, twelve repeat-specific original V13 prefixes, public observations, physical execution/locks/resources/fees, original economic/tie or negative-control M selection, fixed V15 190ms target inside unchanged 200ms atomic acceptance and 5s cold parent lifecycle. Full late candidates remain diagnostic, failed complete fees null; no private cache import or forced intervention candidate. Four known cases, no new orders/holdout, confidence interval, natural-D0 result, default-policy improvement or business ROI. Recorded clocks/source commit observations are not externally authenticated.'}


def main():
    parser=argparse.ArgumentParser(description=__doc__);choice=parser.add_mutually_exclusive_group(required=True)
    choice.add_argument('--protocol',type=Path);choice.add_argument('--run',type=Path);parser.add_argument('--output',type=Path);args=parser.parse_args()
    require(not args.output or not args.output.exists(),'Refuse to overwrite any independent first review')
    if args.run:result=review_run(args.run)
    else:
        v12,_=load_helpers(ROOT);result={'schemaVersion':'portplan-independent-delivery-contract-v15','readOnly':True,'solverRuns':0,'importsJavaScript':False,
            'protocolSha256':digest(args.protocol),'implementationSha256':digest(__file__),**audit_protocol(read_json(args.protocol),ROOT,ROOT,v12)}
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        with args.output.open('x',encoding='utf-8') as stream:stream.write(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k!='episodes'},ensure_ascii=False,allow_nan=False))


if __name__=='__main__':main()
