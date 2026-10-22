#!/usr/bin/env python3
"""Independent read-only review of the seen V13 controlled-prefix replay.

Standard-library Python only. Reuses frozen independent physical/fee/parent
ledgers, never imports JavaScript or a native optimizer. The protocol-only mode
checks archived reference equivalence and the fixed 12-job contract without
running any replay. Actual first-run evidence must be supplied separately.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('unchanged_v12_review',ROOT/'scripts/review-v12.py')
v12=importlib.util.module_from_spec(spec);spec.loader.exec_module(v12)
v10,v8,ledger=v12.v10,v12.v8,v12.ledger
require,same,digest=v12.require,v12.same,v12.digest
CASE_IDS=['v12-stress-batch-release-tight-n100-r2','v12-stress-batch-release-tight-n50-r3']
BRANCHES=['forced_seed','forced_native']
PREFIX_KEYS=['day','observedEvents','observationHash','decisions','executedEvents','state','revisions','revisionCount']
INDEX_PATH='artifacts/v12-frozen-first/first-run/complete.json'
INDEX_SHA='141ac68b0627e74ffa41f881078d9d73304263240e858d148c64e91562217646'
PROTOCOL_SCHEMA='portplan-v13-seen-controlled-prefix-development-protocol'
GUARD_RULE='strict_fee_requires_no_m_increase_ties_require_lower_m'


def safe(base,name):
    require(isinstance(name,str) and name and not Path(name).is_absolute() and '..' not in Path(name).parts,'Unsafe evidence path')
    path=(base/name).resolve();require(path.is_relative_to(base.resolve()),'Evidence path escapes root');return path


def value_sha(value):
    return hashlib.sha256(ledger.stable_json(value).encode('utf-8')).hexdigest()


def read_bound(base,reference,label):
    path=safe(base,reference['path']);same(digest(path),reference['sha256'],label+'/SHA256');return ledger.read_json(path)


def original_path(reference,source_root=None):
    # An actual run is reviewed from its own immutable original/ bundle. Never
    # silently substitute a file from the current machine's old artifacts.
    base=source_root if source_root is not None else ROOT
    path=safe(base,reference['path']);same(digest(path),reference['sha256'],'Original archived artifact/SHA256');return path


def read_original(reference,source_root=None):
    return ledger.read_json(original_path(reference,source_root))


def dates(rows):
    return [{key:r[key] for key in ('id',*ledger.EVENTS)} for r in rows]


def prefix(timeline,through_day=5):
    return [{key:entry[key] for key in PREFIX_KEYS} for entry in timeline if entry['day']<through_day]


def fixed_before(result,day):
    fixed={}
    for entry in result['timeline'][:day]:
        require(entry['status']=='executed','Original prefix contains prior failure')
        for event in entry['executedEvents']:
            field=ledger.EVENT_FIELDS[event['event']]
            require(field not in fixed.get(event['id'],{}),'Repeated original physical event')
            fixed.setdefault(event['id'],{})[field]=event['day']
    return fixed


def observation_at(source,result,day):
    nominal,events=source['nominalScenario'],source['events']
    observed,events_today=ledger.observed_snapshot(nominal,ledger.realize(nominal,events),events,day)
    fixed=fixed_before(result,day)
    hashed={'scenario':observed,'observedEvents':events_today,'fixedEvents':fixed,'minEventDay':day}
    same('sha256:'+value_sha(hashed),result['timeline'][day]['observationHash'],'Independent original public observation')
    return observed,fixed


def original_endpoint_identity(source,envelope,day=5):
    result=envelope['result'];observed,fixed=observation_at(source,result,day)
    selection=v8.metadata(result['plannerTrace'][day])['stabilitySelection']
    seed=(selection.get('preNativeIncumbent') or {}).get('dates');native=selection.get('proposalDates')
    identity={'publicSnapshotSha256':value_sha(observed),'fixedEventsSha256':value_sha(fixed),
        'prefixProjectionSha256':value_sha(prefix(result['timeline'],day)),
        'seedDatesSha256':value_sha(seed) if seed is not None else None,
        'nativeDatesSha256':value_sha(native) if native is not None else None}
    return identity,observed,fixed,selection,seed,native


def expected_jobs(protocol):
    jobs=[]
    for repeat in (1,2,3):
        order=CASE_IDS if repeat%2 else CASE_IDS[::-1]
        for case_id in order:
            case_index=CASE_IDS.index(case_id)
            branches=BRANCHES if (repeat+case_index)%2==0 else BRANCHES[::-1]
            for branch in branches:
                jobs.append({'jobId':f'v13-seen-{case_id}--clock-{repeat}--{branch}','caseId':case_id,
                    'timingRepeatIndex':repeat,'algorithmSeed':69011,'branch':branch,
                    'endpointKey':'seed' if branch=='forced_seed' else 'native','canonicalOriginalRepeatIndex':1})
    return jobs


def audit_protocol(protocol,source_root=None):
    same(protocol.get('schemaVersion'),PROTOCOL_SCHEMA,'Protocol schema')
    for key,value in (('dataRole','seen-v12-fixed-prefix-development-intervention'),('newHeldOutExperiments',0),('newOrderGeneration',0),
        ('newAlgorithmSeeds',0),('ciComputed',False),('uniqueBusinessScenarioCount',2),('originalEligibleEpisodeReferences',6),
        ('branchRunCount',12),('branches',BRANCHES),('timingRepeatIndices',[1,2,3]),('algorithmSeed',69011),('interventionDay',5),
        ('prefixDays',[0,1,2,3,4]),('prefixProjectionKeys',PREFIX_KEYS),('dailyBudgetMs',200),('parentHardWallMs',5000),
        ('nativeThreads',1),('nativeRandomSeed',0)):
        same(protocol.get(key),value,'Fixed replay declaration '+key)
    same([c['caseId'] for c in protocol['cases']],CASE_IDS,'Two canonical seen cases')
    same(protocol.get('jobs'),expected_jobs(protocol),'Independent full 12-job order')
    same(protocol.get('parentAcceptance'),v12.PARENT_ACCEPTANCE,'Unchanged strict cold parent contract')
    source_bindings=protocol.get('sourceBindings');require(isinstance(source_bindings,dict) and source_bindings,'Missing original/source bindings')
    same(source_bindings.get(INDEX_PATH),INDEX_SHA,'Published first V12 index anchor')
    for name,sha in source_bindings.items():original_path({'path':name,'sha256':sha},source_root)
    index=read_original({'path':INDEX_PATH,'sha256':INDEX_SHA},source_root)
    cases={c['id']:c for c in index['cases']};reviewed=[];all_references=[]
    for case in protocol['cases']:
        case_id=case['caseId'];declared=cases[case_id]
        same(case['canonicalOriginalRepeatIndex'],1,'Canonical original repeat is minimum')
        same(case['originalAlgorithmSeed'],69011,'Original canonical algorithm seed')
        same(case['sourceInputArtifact'],{'path':'artifacts/v12-frozen-first/first-run/'+declared['inputArtifact']['path'],'sha256':declared['inputArtifact']['sha256']},'Original input anchored to full index')
        source=read_original(case['sourceInputArtifact'],source_root)
        references=case.get('originalEquivalentReferences');require(isinstance(references,list) and len(references)==3,'All three equivalent original raw files required')
        first_identity=None
        for ri,reference in enumerate(references):
            repeat=declared['repeats'][ri];receipt=repeat['policies']['seededHiGHSV12']
            same(reference['repeatIndex'],ri+1,'Original repeat coverage')
            same(reference['algorithmSeed'],[69011,69023,69039][ri],'Original seed coverage')
            same({'path':reference['path'],'sha256':reference['sha256']},{'path':'artifacts/v12-frozen-first/first-run/'+receipt['artifact']['path'],'sha256':receipt['artifact']['sha256']},'Equivalent original raw identity')
            envelope=read_original(reference,source_root)
            same(envelope.get('caseId'),case_id,'Original raw case');same(envelope.get('repeatIndex'),ri+1,'Original raw repeat')
            identity,observed,fixed,selection,seed,native=original_endpoint_identity(source,envelope)
            same(reference['identity'],identity,'Independently rebuilt original endpoint identity')
            if first_identity is None:first_identity=identity
            same(identity,first_identity,'All source endpoints/prefixes genuinely equivalent')
            require(seed is not None and native is not None,'Eligible endpoint is incomplete')
            seed_fees=v12.reprice_dates(observed,seed);native_fees=v12.reprice_dates(observed,native)
            for key,rows in (('seed',seed),('native',native)):ledger.audit_dates(observed,rows,'Original '+key+' endpoint',fixed,5)
            require(native_fees['objectiveCost']<seed_fees['objectiveCost']-1e-6,'Eligible native is not strictly cheaper')
            seed_m=v12.independent_commitment(observed,seed,fixed,5)['mandatoryWarehouseTomorrow']
            native_m=v12.independent_commitment(observed,native,fixed,5)['mandatoryWarehouseTomorrow']
            require(native_m>seed_m,'Eligible native does not increase independently calculated M')
            pre=selection['preNativeIncumbent'];require(pre.get('acceptedAtMs') is not None and pre['acceptedAtMs']<=200,'Original seed not timely')
            require(selection['nativeGate'].get('acceptedAtMs') is not None and selection['nativeGate']['acceptedAtMs']<=200,'Original native not timely')
            same(selection['decisionReason'],'strict_fee_replacement','Original intervention trigger')
            same(v8.date_map(selection['afterDates']),v8.date_map(native),'Original actually selected native endpoint')
            all_references.append({'path':reference['path'],'sha256':reference['sha256'],'identity':identity})
            if ri==0:
                same(case['publicSnapshot'],observed,'Canonical public snapshot')
                same(case['fixedEvents'],fixed,'Canonical executed locks')
                same(case['identity'],identity,'Canonical identity')
                same(case['prefixProjectionSha256'],identity['prefixProjectionSha256'],'Canonical prefix SHA')
                same(case['originalObservationHash'],envelope['result']['timeline'][5]['observationHash'],'Canonical public observation SHA')
                same(case['canonicalSourceEpisodeArtifact'],{'path':reference['path'],'sha256':reference['sha256']},'Minimum original raw canonicalization')
                for key,rows,fees,m in (('seed',seed,seed_fees,seed_m),('native',native,native_fees,native_m)):
                    endpoint=case['endpoints'][key];same(endpoint['dates'],rows,'Canonical '+key+' full dates')
                    same(endpoint['datesSha256'],value_sha(rows),'Canonical '+key+' dates SHA')
                    v12.endpoint_fees(observed,rows,endpoint['fees'],'Canonical '+key+' fees')
                    same(endpoint['mandatoryWarehouseTomorrow'],m,'Canonical independent '+key+' M')
                    same(endpoint['fullContainerCount'],len(observed['containers']),'Canonical full coverage')
                ledger.close(case['nativeCurrentIncrementalFeeSavingsKRW'],seed_fees['objectiveCost']-native_fees['objectiveCost'],'Canonical fee difference')
        same(case.get('originalReferencesEquivalent'),True,'Equivalence declaration')
        reviewed.append({'caseId':case_id,'originalRawReferences':3,'seedM':case['endpoints']['seed']['mandatoryWarehouseTomorrow'],
            'nativeM':case['endpoints']['native']['mandatoryWarehouseTomorrow'],'identity':first_identity})
    screening=screen_original_loss_endpoints(index,protocol,source_root)
    controls=audit_negative_controls(protocol,index,source_root)
    return {'valid':True,'screening':screening,'negativeControls':controls,'uniqueBusinessScenarioCount':2,'originalRawReferenceCount':len(all_references),'plannedRuns':12,
        'newOrders':0,'solverRuns':0,'cases':reviewed,'auditSourceBindings':{r['path']:r['sha256'] for r in all_references}}


def empty_score():
    return {'attempted':False,'complete':False,'cache':None,'proposal':None,'beforeM':None,'proposalM':None,'selectedM':None,
            'startedAtMs':None,'finishedAtMs':None,'timely':None,'skipReason':'bridge_strict_guard_independently_audited','error':None}


def audit_guard_selection(scenario,meta,decisions,fixed,previous,day,executed,label='guard',budget=200):
    """Audit V13, then reuse unchanged V12's physical/fee/receipt plumbing.

    Only the legacy rule spelling and already independently audited STRICT-score
    branch are translated in a deep copy. The original proof is never mutated.
    The V13 guard itself is recomputed here, not delegated to the V12 policy.
    """
    proof=meta.get('stabilitySelection');require(isinstance(proof,dict),'Missing V13 selection proof')
    same(proof.get('rule'),GUARD_RULE,label+'/V13 rule')
    guard=proof.get('strictFeeGuard');require(isinstance(guard,dict),label+': missing strict-fee guard')
    for flag in ('attempted','complete','eligible'):require(type(guard.get(flag)) is bool,label+': missing boolean guard '+flag)
    pre=proof.get('preNativeIncumbent');proposal=proof.get('proposalDates');native_gate=proof.get('nativeGate',{})
    proposal_valid=proposal is not None and ledger.feasible_dates(scenario,proposal,fixed,day)
    proposed_fees=v12.reprice_dates(scenario,proposal) if proposal_valid else None
    difference=proposed_fees['objectiveCost']-pre['fees']['objectiveCost'] if pre and proposed_fees else None
    comparable=(difference is not None and native_gate.get('feesMatchedAtMs') is not None
                and meta.get('stages',{}).get('native',{}).get('independentCostsMatch') is True)
    strict=comparable and difference < -1e-6
    same(guard.get('attempted'),strict,label+'/strict attempt trigger')
    bridge=copy.deepcopy(meta);translated=bridge['stabilitySelection']
    translated['rule']='strict_fee_then_lower_next_day_mandatory_warehouse_on_ties'
    extra={'strictGuardAttempts':int(strict),'strictGuardAccepted':0,'strictGuardBlockedMIncrease':0,
           'strictGuardIncompleteOrError':0,'strictGuardLate':0}
    if strict:
        same(guard.get('incumbentSource'),pre['source'],label+'/guard incumbent source')
        same(guard.get('incumbentDates'),pre['dates'],label+'/guard incumbent dates')
        same(guard.get('incumbentFees'),pre['fees'],label+'/guard incumbent fees')
        same(guard.get('proposalDates'),proposal,label+'/guard proposal dates')
        same(guard.get('proposalFees'),proof['proposalFees'],label+'/guard proposal fees')
        scoring=proof.get('commitmentScore');require(isinstance(scoring,dict),label+': missing strict M score')
        require(type(scoring.get('attempted')) is bool and type(scoring.get('complete')) is bool,label+': missing boolean score flags')
        before_m=after_m=None
        if scoring.get('attempted'):
            if scoring.get('cache') is not None:before_m=v12.audit_commitment(scenario,pre['dates'],fixed,day,scoring['cache'],label+'/strict incumbent M')
            else:require(isinstance(scoring.get('error'),str) and scoring['error'],label+': absent strict score has no error')
            if scoring.get('proposal') is not None:after_m=v12.audit_commitment(scenario,proposal,fixed,day,scoring['proposal'],label+'/strict proposal M')
            start=v12.v9.optional_time(scoring.get('startedAtMs'),label+'/M start');finish=v12.v9.optional_time(scoring.get('finishedAtMs'),label+'/M finish')
            require(start is not None and finish is not None and native_gate['feesMatchedAtMs']<=start<=finish<=meta['wallTimeMs'],label+': strict score chronology')
            same(scoring.get('timely'),finish<=budget,label+'/strict score timely')
        else:
            for key in ('cache','proposal','beforeM','proposalM','selectedM','startedAtMs','finishedAtMs','timely'):same(scoring.get(key),None,label+'/unattempted strict score '+key)
        complete=before_m is not None and after_m is not None and not scoring.get('error')
        same(scoring.get('complete'),complete,label+'/strict complete scores')
        same(scoring.get('beforeM'),before_m,label+'/strict before scalar');same(scoring.get('proposalM'),after_m,label+'/strict proposal scalar')
        for key,value in (('complete',complete),('timely',scoring.get('timely')),('incumbentM',before_m),('proposalM',after_m),
                          ('scoringStartedAtMs',scoring.get('startedAtMs')),('scoringFinishedAtMs',scoring.get('finishedAtMs')),('error',scoring.get('error'))):
            same(guard.get(key),value,label+'/strict guard '+key)
        compared=v12.v9.optional_time(guard.get('comparisonFinishedAtMs'),label+'/guard comparison')
        same(compared,native_gate.get('selectionFinishedAtMs'),label+'/atomic comparison clock')
        require(compared is not None and (scoring.get('finishedAtMs') is None or compared>=scoring['finishedAtMs']),label+': comparison precedes score')
        late=native_gate.get('outcome')=='late_candidate'
        native_accepted=native_gate.get('acceptedAtMs') is not None
        eligible=complete and scoring.get('timely') is True and after_m<=before_m and not late
        same(guard.get('eligible'),eligible,label+'/independent strict eligibility')
        same(native_accepted,eligible,label+'/strict atomic acceptance')
        reason=('late_selection' if late else 'scoring_error' if scoring.get('error') else 'incomplete_score' if not complete
                else 'late_score' if scoring.get('timely') is not True else 'mandatory_load_increase' if after_m>before_m else 'no_mandatory_load_increase')
        same(guard.get('reason'),reason,label+'/strict reason')
        same(guard.get('decision'),'accepted' if eligible else 'retained_incumbent',label+'/strict decision')
        same(guard.get('acceptedAtMs'),native_gate.get('acceptedAtMs') if eligible else None,label+'/strict acceptance clock')
        if not eligible:
            rejected=v12.v9.optional_time(guard.get('rejectedAtMs'),label+'/strict rejection clock')
            require(rejected is not None and rejected>=compared and rejected<=meta['wallTimeMs'],label+': missing/backdated strict rejection')
            require(rejected>budget if late else rejected<=budget,label+': strict rejection deadline differs')
        else:same(guard.get('rejectedAtMs'),None,label+'/accepted strict rejection clock')
        selected_m=after_m if eligible else before_m
        same(scoring.get('selectedM'),selected_m,label+'/selected score remains incumbent until commit')
        same(guard.get('selectedM'),selected_m,label+'/strict selected M')
        if eligible:
            same(proof.get('decisionReason'),'strict_fee_replacement_no_m_increase',label+'/strict accepted reason')
            translated['decisionReason']='strict_fee_replacement';translated['nativeGate']['outcome']='strict_fee_replacement'
        else:
            if not late:same(proof.get('decisionReason'),'retain_cheaper_native_'+reason,label+'/blocked cheaper reason')
            if not late:translated['nativeGate']['outcome']='independently_checked_v13_guard_retention'
        translated['commitmentScore']=empty_score()
        extra.update(strictGuardAccepted=int(eligible),strictGuardBlockedMIncrease=int(reason=='mandatory_load_increase'),
                     strictGuardIncompleteOrError=int(reason in ('incomplete_score','scoring_error')),strictGuardLate=int(reason in ('late_score','late_selection')))
    else:
        for key in ('incumbentSource','incumbentDates','incumbentFees','proposalDates','proposalFees','incumbentM','proposalM','selectedM',
                    'scoringStartedAtMs','scoringFinishedAtMs','comparisonFinishedAtMs','acceptedAtMs','rejectedAtMs','error','timely'):
            same(guard.get(key),None,label+'/inactive strict '+key)
        for key,value in (('complete',False),('eligible',False),('decision','not_applicable'),('reason','no_strict_fee_decrease')):same(guard.get(key),value,label+'/inactive strict '+key)
    checked=v12.audit_commitment_selection(scenario,bridge,decisions,fixed,previous,day,executed,label,budget,seeded=True)
    if strict:
        checked['completeCommitmentScores']+=int(proof['commitmentScore']['complete'])
        checked['incompleteCommitmentScores']+=int(proof['commitmentScore']['attempted'] and not proof['commitmentScore']['complete'])
    return {**checked,**extra}


def index_source(case):
    return {'path':'artifacts/v12-frozen-first/first-run/'+case['inputArtifact']['path'],'sha256':case['inputArtifact']['sha256']}


def index_episode(receipt):
    return {'path':'artifacts/v12-frozen-first/first-run/'+receipt['artifact']['path'],'sha256':receipt['artifact']['sha256']}


def screen_original_loss_endpoints(index,protocol,source_root):
    """Read all old pressure losses; no filtering on new replay outcomes."""
    eligible=[];union=[];bindings={}
    for case in index['cases']:
        if case['panel']!='stress':continue
        source=None
        for repeat in case['repeats']:
            receipt=repeat['policies']['seededHiGHSV12']
            if receipt['complete'] or not any(v['complete'] for method,v in repeat['policies'].items() if method!='seededHiGHSV12'):continue
            union.append((case['id'],repeat['repeatIndex']))
            ref=index_episode(receipt);envelope=read_original(ref,source_root);bindings[ref['path']]=ref['sha256']
            timeline=envelope['result'].get('timeline',[])
            if len(timeline)<=5 or timeline[5].get('status')!='executed':continue
            if source is None:
                ref_input=index_source(case);source=read_original(ref_input,source_root);bindings[ref_input['path']]=ref_input['sha256']
            identity,observed,fixed,selection,seed,native=original_endpoint_identity(source,envelope)
            if seed is None or native is None or selection.get('decisionReason')!='strict_fee_replacement':continue
            if selection.get('nativeGate',{}).get('acceptedAtMs') is None or selection['nativeGate']['acceptedAtMs']>200:continue
            before=v12.reprice_dates(observed,seed);after=v12.reprice_dates(observed,native)
            if after['objectiveCost']>=before['objectiveCost']-1e-6:continue
            before_m=v12.independent_commitment(observed,seed,fixed,5)['mandatoryWarehouseTomorrow']
            after_m=v12.independent_commitment(observed,native,fixed,5)['mandatoryWarehouseTomorrow']
            if after_m>before_m:eligible.append((case['id'],repeat['repeatIndex']))
    require(len(union)==14 and len({sid for sid,_ in union})==5,'Original pressure loss-union changed')
    expected=[(c['caseId'],r['repeatIndex']) for c in protocol['cases'] for r in c['originalEquivalentReferences']]
    same(sorted(eligible),sorted(expected),'All eligible original endpoints retained; no selected omissions')
    return {'oldPressureLossEpisodeCount':len(union),'oldPressureLossBusinessCases':5,'eligibleOriginalEpisodeCount':len(eligible),
        'eligibleUniqueBusinessCases':2,'reviewPrerequisite':'Restore complete original V12 evidence archive for independent offline screening; this data never enters new planner inputs.',
        'auditSourceBindings':bindings}


def audit_negative_controls(protocol,index,source_root):
    controls=protocol.get('negativeControls');require(isinstance(controls,list) and len(controls)==4,'Four static negative controls required')
    same([(c.get('caseId'),c.get('day')) for c in controls],[('v12-stress-aged-backlog-balanced-n50-r3',5),
        ('v12-stress-batch-release-tight-n100-r3',5),('v12-stress-aged-backlog-balanced-n100-r2',5),
        ('v12-same-distribution-new-arrivals-tight-n24-r3',3)],'All four distinct prespecified static controls')
    outputs=[];cases={c['id']:c for c in index['cases']}
    for control in controls:
        declared=cases[control['caseId']]
        same(control['sourceInputArtifact'],index_source(declared),'Negative control input anchored to original index')
        same(control['sourceEpisodeArtifact'],index_episode(declared['repeats'][0]['policies']['seededHiGHSV12']),'Negative control original canonical raw')
        source=read_original(control['sourceInputArtifact'],source_root);envelope=read_original(control['sourceEpisodeArtifact'],source_root)
        day=control['day'];identity,observed,fixed,selection,seed,native=original_endpoint_identity(source,envelope,day)
        same(control['identity'],identity,'Negative control endpoint identity')
        native_m=v12.independent_commitment(observed,native,fixed,day)['mandatoryWarehouseTomorrow']
        seed_m=v12.independent_commitment(observed,seed,fixed,day)['mandatoryWarehouseTomorrow'] if seed is not None else None
        same(control['seedM'],seed_m,'Negative-control seed M');same(control['nativeM'],native_m,'Negative-control native M')
        require(control.get('staticOnly') is True and control.get('plannedOptimizerRuns')==0,'Negative controls may not add optimizer runs')
        before=v12.reprice_dates(observed,seed)['objectiveCost'] if seed is not None else None
        after=v12.reprice_dates(observed,native)['objectiveCost']
        effect=('no_audited_incumbent_so_native_first_solution_not_blocked' if seed is None else
                'existing_equal_fee_rule_already_kept_lower_M_but_original_next_day_failed' if abs(after-before)<=1e-6 else
                'strictly_cheaper_native_has_lower_M_so_guard_does_not_block' if native_m<seed_m else
                'strictly_cheaper_native_has_equal_M_so_guard_does_not_block')
        same(control['expectedLocalGuardEffect'],effect,'Independent static negative-control classification')
        outputs.append({'caseId':control['caseId'],'day':day,'seedM':seed_m,'nativeM':native_m,'expectedLocalGuardEffect':effect,'optimizerRuns':0})
    return outputs


def audit_import(receipt,scenario,endpoint,fixed,record,executed,label):
    require(isinstance(receipt,dict),label+': missing forced development import receipt')
    for key,value in (('schemaVersion','portplan-v13-development-endpoint-import-1'),('developmentOnly',True),
        ('claimsNativeDiscovery',False),('claimsPhysicalExecution',False),('decisionCalls',0),('solverCalls',0),('receivedAtMs',0)):
        same(receipt.get(key),value,label+'/import '+key)
    started=record.get('forcedStepStartedAtMs');deadline=record.get('forcedStepDeadlineMs')
    require(ledger.finite(started) and ledger.finite(deadline) and deadline==started+200,label+': forced-step common deadline reset')
    require(ledger.finite(receipt.get('startedAtMs')) and receipt['startedAtMs']>=started,label+': import starts outside forced step')
    same(receipt.get('deadlineMs'),deadline,label+'/same absolute forced-step deadline')
    same(receipt.get('snapshot'),scenario,label+'/import public snapshot')
    same(receipt.get('sourceDates'),endpoint,label+'/import exact archived endpoint')
    same(receipt.get('fixedEvents'),fixed,label+'/import physical locks')
    same(receipt.get('minEventDay'),5,label+'/import intervention day')
    binding={hash_key:value_sha(receipt.get(value_key)) if receipt.get(value_key) is not None else None
        for hash_key,value_key in (('snapshotSha256','snapshot'),('sourceDatesSha256','sourceDates'),('fixedEventsSha256','fixedEvents'),
                                  ('canonicalDatesSha256','canonicalDates'),('feesSha256','fees'))}
    same(record.get('offlineImportBinding'),binding,label+'/independent import five-field SHA binding')
    accepted=receipt.get('accepted');require(type(accepted) is bool,label+': import accepted flag missing')
    times=[v12.v9.optional_time(receipt.get(k),label+'/import '+k) for k in ('receivedAtMs','copiedAtMs','validatedAtMs','auditFinishedAtMs','proofFinishedAtMs','acceptedAtMs')]
    present=[v for v in times if v is not None];require(present==sorted(present),label+': import clone/audit/proof/commit order')
    if accepted:
        same(receipt.get('status'),'accepted',label+'/import status');same(receipt.get('error'),None,label+'/import error')
        require(all(v is not None for v in times) and receipt['startedAtMs']+times[-1]<=deadline,label+': late/incomplete import commit')
        same(receipt.get('audit',{}).get('valid'),True,label+'/import physical audit')
        same(receipt.get('canonicalDates'),endpoint,label+'/import canonical endpoint')
        ledger.audit_dates(scenario,endpoint,label+'/independent forced endpoint',fixed,5)
        v12.endpoint_fees(scenario,endpoint,receipt.get('fees'),label+'/import independent prices')
    else:
        same(receipt.get('acceptedAtMs'),None,label+'/rejected import has no commit')
        require(not executed,label+': rejected import cannot execute D5')
    if executed:
        require(accepted and record.get('forcedStepTimely') is True and ledger.finite(record.get('forcedStepAcceptanceWallMs')) and record['forcedStepAcceptanceWallMs']<=200 and record['callWallMs']<=record['forcedStepAcceptanceWallMs'],label+': forced execution after failed/late step')
    return int(accepted)


def audit_replay_episode(source,original,case,result,job,label):
    checked=v12.audit_episode(source['nominalScenario'],source['events'],result,label,5000,'controlledGuardReplayV13',200)
    counts=v12.empty_native_counts();counts.update({k:0 for k in ('strictGuardAttempts','strictGuardAccepted','strictGuardBlockedMIncrease','strictGuardIncompleteOrError','strictGuardLate')})
    if not checked['historyAvailable']:return {**checked,'guardSelection':counts,'forcedImportAccepted':None}
    same(result.get('branch'),job['branch'],label+'/actual branch');same(result.get('timingRepeatIndex'),job['timingRepeatIndex'],label+'/actual clock repeat')
    same(result.get('algorithmSeed'),69011,label+'/old seed fixed')
    timeline,trace=result['timeline'],result['plannerTrace'];fixed={};previous=None;imported=None;import_accepted=0;natural_calls=0;requests=0
    nominal,events=source['nominalScenario'],source['events'];actual=ledger.realize(nominal,events)
    for day,(entry,record) in enumerate(zip(timeline,trace)):
        scenario,_=ledger.observed_snapshot(nominal,actual,events,day)
        same(record.get('publicSnapshot'),scenario,label+f'/D{day}/only current public snapshot')
        same(record.get('fixedEvents'),fixed,label+f'/D{day}/current physical locks')
        same(record.get('dailyBudgetMs'),200,label+'/daily budget')
        require(ledger.finite(record.get('callWallMs')) and record['callWallMs']>=0,label+': missing call wall')
        executed=entry.get('status')=='executed'
        expected_phase='archived_prefix' if day<5 else 'forced_endpoint' if day==5 else 'guarded_v13_continuation'
        same(record.get('phase'),expected_phase,label+'/phase');same(record.get('nativePolicyDecision'),day>=6,label+'/natural-call attribution')
        if day<=5:
            same(record.get('actualNativeRequests'),0,label+'/forced step cannot solve')
            meta=v8.metadata(record);same(meta.get('method'),'forced_archived_endpoint',label+'/forced metadata')
            for field,value in (('optimizerCalls',0),('claimsNativeDiscovery',False),('claimsNaturalV13Prefix',False)):same(meta.get(field),value,label+'/forced '+field)
            endpoint=dates(original['result']['timeline'][day]['decisions']) if day<5 else case['endpoints'][job['endpointKey']]['dates']
            if executed:
                require(record.get('forcedStepTimely') is True and ledger.finite(record.get('forcedStepAcceptanceWallMs')) and record['forcedStepAcceptanceWallMs']<=200 and record['callWallMs']<=record['forcedStepAcceptanceWallMs'],label+': forced prefix exceeded daily allowance')
                same(dates(entry['decisions']),endpoint,label+'/forced exact full dates')
                if day<5:same({k:entry[k] for k in PREFIX_KEYS},{k:original['result']['timeline'][day][k] for k in PREFIX_KEYS},label+'/all eight original prefix fields')
            if day==5:
                same(scenario,case['publicSnapshot'],label+'/same D5 public input');same(fixed,case['fixedEvents'],label+'/same D5 locks')
                imported=record.get('offlineImportReceipt')
                import_accepted=audit_import(imported,scenario,endpoint,fixed,record,executed,label+'/D5')
                same(result.get('replayEndpointImportReceipt'),imported,label+'/final import receipt binding')
                same(result.get('replayEndpointImportBinding'),record.get('offlineImportBinding'),label+'/final import five-field SHA binding')
        else:
            natural_calls+=1;meta=v8.metadata(record)
            same(meta.get('developmentEndpointImport'),imported,label+'/import proof immutable across natural calls')
            require(import_accepted==1,label+': natural policy continued without accepted D5 cache')
            audited=audit_guard_selection(scenario,meta,entry['decisions'],fixed,previous,day,executed,label+f'/D{day}')
            for key,value in audited.items():counts[key]+=value
            for field,counter in (('strictReplacementCount','strictReplacements'),('tieRetainedCount','feeTiesRetained'),
                                  ('commitmentReplacementCount','commitmentReplacements'),('constructorCalls','constructorCalls'),('acceptedConstructorReceipts','acceptedConstructorReceipts')):
                same(meta.get(field),counts[counter],label+'/natural cumulative '+field)
            same(meta.get('decisionCalls'),natural_calls,label+'/forced prefix not counted as natural calls')
            current=meta.get('solverCalls');require(type(current) is int and current>=requests and current-requests in (0,1),label+': native request counter')
            same(record.get('actualNativeRequests'),current-requests,label+'/actual request attribution');requests=current
        if executed:
            same(record.get('selectedDates'),dates(entry['decisions']),label+'/selected receipt full dates')
            v12.endpoint_fees(scenario,entry['decisions'],record.get('fees'),label+'/current selected plan independent prices')
            previous={row['id']:row for row in entry['decisions']}
            for event in entry['executedEvents']:fixed.setdefault(event['id'],{})[ledger.EVENT_FIELDS[event['event']]]=day
    stats=result.get('plannerStats',{})
    for key,value in (('nativeDecisionCalls',natural_calls),('actualNativeRequests',requests),('archivedReplayCalls',len(trace)-natural_calls),('decisionCalls',len(trace)),('importAccepted',bool(import_accepted))):same(stats.get(key),value,label+'/replay counters '+key)
    prefix_checks=[]
    for entry in timeline[:5]:
        if entry.get('status')!='executed':break
        prefix_checks.append({'day':entry['day'],'exactProjectedMatch':True,'sha256':value_sha({k:entry[k] for k in PREFIX_KEYS}),'keys':PREFIX_KEYS})
    same(result.get('replayPrefixChecks'),prefix_checks,label+'/every executed prefix projection receipt')
    if len(timeline)>5:
        same(value_sha(prefix(timeline)),case['prefixProjectionSha256'],label+'/full original prefix identity')
        same(result.get('replayIdentity'),{'caseId':job['caseId'],'interventionDay':5,'prefixProjectionSha256':case['prefixProjectionSha256'],
            'publicSnapshotSha256':case['identity']['publicSnapshotSha256'],'fixedEventsSha256':case['identity']['fixedEventsSha256'],
            'forcedEndpointDatesSha256':case['endpoints'][job['endpointKey']]['datesSha256']},label+'/result replay identity')
    return {**checked,'guardSelection':counts,'forcedImportAccepted':import_accepted,'naturalCalls':natural_calls,'actualNativeRequests':requests}


def summarize(records):
    branches={}
    for branch in BRANCHES:
        rows=[r for r in records if r['branch']==branch]
        branches[branch]={'runCount':len(rows),'completeWithinBudgetCount':sum(r['receipt']['complete'] for r in rows),
            'unknownHistoryCount':sum(r['receipt']['executionHistoryUnavailable'] for r in rows),
            'statuses':[{'jobId':r['jobId'],'status':r['receipt']['status'],'failureDay':(r['receipt'].get('failure') or {}).get('day'),
                'totalCost':r['receipt']['totalCost'],'incrementalCost':r['receipt']['incrementalCost'],'revisionCount':r['receipt']['revisionCount']} for r in rows]}
    pairs=[]
    for case_id in CASE_IDS:
        for repeat in (1,2,3):
            a=next(r['receipt'] for r in records if r['caseId']==case_id and r['timingRepeatIndex']==repeat and r['branch']=='forced_seed')
            b=next(r['receipt'] for r in records if r['caseId']==case_id and r['timingRepeatIndex']==repeat and r['branch']=='forced_native')
            joint=a['complete'] and b['complete']
            pairs.append({'caseId':case_id,'timingRepeatIndex':repeat,'seedComplete':a['complete'],'nativeComplete':b['complete'],'jointlyCompleted':joint,
                'totalSeedMinusNativeKRW':a['totalCost']-b['totalCost'] if joint else None,'incrementalSeedMinusNativeKRW':a['incrementalCost']-b['incrementalCost'] if joint else None,
                'revisionSeedMinusNative':a['revisionCount']-b['revisionCount'] if joint and ledger.finite(a['revisionCount']) and ledger.finite(b['revisionCount']) else None})
    return {'runCount':len(records),'uniqueBusinessScenarioCount':2,'timingRepeatsPerBranch':3,'branches':branches,'pairs':pairs,
        'jointlyCompletedTimingPairCount':sum(r['jointlyCompleted'] for r in pairs),'ciComputed':False,'newHeldOutExperiments':0,
        'scope':'Descriptive paired seen-case branch outcomes only. Fees and revisions require joint completion of the matching timing pair; no new research CI, full-D0 runtime or policy claim.'}


def review_run(directory):
    global v12,v10,v8,ledger,require,same,digest
    directory=directory.resolve();index_path=directory/'complete.json';declaration_path=directory/'declaration.json'
    index_sha=digest(index_path);declaration_sha=digest(declaration_path);index=ledger.read_json(index_path);declaration=ledger.read_json(declaration_path)
    frozen_source=directory/'source'
    same(declaration['implementationHashes'].get('scripts/review-replay-guard-v13.py'),digest(__file__),'This independent reviewer matches declared source')
    for name,sha in declaration['implementationHashes'].items():same(digest(safe(frozen_source,name)),sha,'Frozen runtime '+name)
    # Import Python ledgers only from this run's checked frozen source. A source
    # ZIP can therefore audit the restored archive without any live old code.
    frozen_spec=importlib.util.spec_from_file_location('frozen_independent_v12_review',safe(frozen_source,'scripts/review-v12.py'))
    frozen_v12=importlib.util.module_from_spec(frozen_spec);frozen_spec.loader.exec_module(frozen_v12)
    v12=frozen_v12;v10,v8,ledger=v12.v10,v12.v8,v12.ledger
    require,same,digest=v12.require,v12.same,v12.digest
    same(index.get('schemaVersion'),'portplan-v13-controlled-replay-results','Completed replay schema');same(index.get('executionState'),'complete','Requires complete first replay')
    same(declaration.get('schemaVersion'),'portplan-v13-controlled-replay-declaration','Replay declaration schema');same(declaration.get('executionState'),'declared','Immutable pre-run declaration')
    same(index.get('declarationSha256'),declaration_sha,'Pre-run declaration SHA')
    protocol=declaration['protocol'];same(declaration.get('jobs'),protocol['jobs'],'Prespecified jobs')
    same(index.get('protocolSha256'),declaration['protocolSha256'],'Protocol SHA')
    same(index.get('implementationHashes'),declaration['implementationHashes'],'Runtime source commitments')
    same(index.get('sourceBindings'),protocol['sourceBindings'],'Original source commitments')
    same(declaration.get('sourceBindings'),protocol['sourceBindings'],'Declared original source commitments')
    same(declaration.get('rootAuthorized'),False,'Declaration cannot grant runtime authorization')
    same(declaration.get('plannerConfiguration'),ledger.read_json(frozen_source/'data/protocol-v12.json')['callBudgets']['seededHiGHSV12'],'Unchanged seeded V12 call parameters')
    same(index.get('sourceConsistency'),{'before':True,'after':True},'Producer before/after source checks')
    for key,value in (('newHeldOutExperiments',0),('newGeneratedSeeds',0),('ciComputed',False)):same(index.get(key),value,'No new sample '+key)
    for module in (v12,v12.v10,v12.v9,v12.v8,ledger):
        name=str(Path(module.__file__).resolve().relative_to(frozen_source))
        same(declaration['implementationHashes'].get(name),digest(module.__file__),'Independent ledger matches declared source '+name)
    same(digest(directory/'source'/declaration['protocolPath']),declaration['protocolSha256'],'Original protocol bytes')
    same(ledger.read_json(directory/'source'/declaration['protocolPath']),protocol,'Original protocol content')
    contract=audit_protocol(protocol,directory/'original')
    start=ledger.read_json(directory/'execution-start.json')
    for key,value in (('rootAuthorized',True),('declarationSha256',declaration_sha),('protocolSha256',declaration['protocolSha256']),('plannedJobCount',12)):
        same(start.get(key),value,'Separate first-run authorization '+key)
    same(start.get('runtimeImplementationHashes'),declaration['implementationHashes'],'Authorized frozen runtime source')
    same(start.get('sourceConsistency'),{'live':True,'frozen':True,'originals':True},'First-run source checks')
    records=index.get('records');require(isinstance(records,list) and len(records)==12,'All twelve first-run records required')
    by_case={c['caseId']:c for c in protocol['cases']};reviewed=[];seen=set();parent={};counts={}
    for position,(record,job) in enumerate(zip(records,protocol['jobs'])):
        for key,value in job.items():same(record.get(key),value,'Exact job coverage/order '+key)
        case=by_case[job['caseId']]
        envelope=read_bound(directory,record['artifact'],'Full replay result')
        identity={**job,'episodeId':job['jobId'],'method':'controlledGuardReplayV13','sourceInputArtifact':case['sourceInputArtifact'],
                  'canonicalSourceEpisodeArtifact':case['canonicalSourceEpisodeArtifact']}
        for key,value in identity.items():same(envelope.get(key),value,'Raw job identity '+key)
        require(record['artifact']['path'] not in seen,'Reused raw result across jobs');seen.add(record['artifact']['path'])
        result=envelope['result'];same(result.get('policy'),'controlledGuardReplayV13','Actual replay policy')
        life=v12.audit_formal_parent_receipt(record['receipt'],result,5000,job['jobId'])
        for key,value in life.items():parent[key]=parent.get(key,0)+value
        source=read_original(case['sourceInputArtifact'],directory/'original');original=read_original(case['canonicalSourceEpisodeArtifact'],directory/'original')
        checked=audit_replay_episode(source,original,case,result,job,job['jobId'])
        same(record['receipt']['complete'],checked['complete'],'Independent complete branch eligibility')
        journal_path=safe(directory,record['journal']['path']);same(digest(journal_path),record['journal']['sha256'],'Uncompressed per-call journal SHA')
        journal=[json.loads(line) for line in journal_path.read_text().splitlines() if line.strip()]
        require(all(r.get('type') in ('ready','decision_receipt') for r in journal),'Unknown journal event')
        if checked['historyAvailable']:
            journal_calls=[r for r in journal if r['type']=='decision_receipt']
            same(len(journal_calls),len(result['plannerTrace']),'Every accepted-history call journaled')
            for a,b in zip(journal_calls,result['plannerTrace']):same({k:v for k,v in a.items() if k not in ('type','scope','forcedStepTimely','forcedStepAcceptanceWallMs')},{k:v for k,v in b.items() if k not in ('forcedStepTimely','forcedStepAcceptanceWallMs')},'Per-call journal/terminal trace binding')
        for key,value in checked['guardSelection'].items():counts[key]=counts.get(key,0)+value
        reviewed.append({'jobId':job['jobId'],'artifactSha256':record['artifact']['sha256'],**checked})
    independent=summarize(records);same(index.get('summary'),independent,'Independent branch summary and matched-clock denominators')
    same(digest(index_path),index_sha,'Read-only index unchanged');same(digest(declaration_path),declaration_sha,'Read-only declaration unchanged')
    return {'schemaVersion':'portplan-independent-guard-replay-review-v13','valid':True,'readOnly':True,'solverRuns':0,'importsJavaScript':False,
        'inputIndexSha256':index_sha,'declarationSha256':declaration_sha,'protocolSha256':declaration['protocolSha256'],
        'implementationSha256':digest(__file__),'independentV12ReviewerSha256':digest(v12.__file__),
        'contract':contract,'runCount':12,'uniqueBusinessScenarioCount':2,'originalEquivalentReferences':6,'newHeldOutExperiments':0,'ciComputed':False,
        'summary':independent,'parentLifecycle':parent,'guardSelection':counts,'episodes':reviewed,
        'scope':'Twelve cold clock runs of two already-seen original V12 endpoint pairs, with original D0-D4 prefix and explicit D5 intervention then V13 from D6. Source references/equivalence, current observations, exact physical actions/locks/resources/fees, complete strict-M guard and timely atomic receipt selection, failures/null fees and cold parent lifecycle independently reviewed in standard Python. Three timing repetitions do not add business cases; no solver rerun, new formal sample, confidence interval, full-D0 policy, general recovery, real business savings or champion claim. Recorded clocks and cleanup receipts are not externally authenticated.'}


def main():
    parser=argparse.ArgumentParser(description=__doc__);source=parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--protocol',type=Path,help='Read-only source contract check, no replay result required');source.add_argument('--run',type=Path)
    parser.add_argument('--output',type=Path);args=parser.parse_args()
    if args.output:require(not args.output.exists(),'Refuse to overwrite any previous independent review')
    result=review_run(args.run) if args.run else {'schemaVersion':'portplan-independent-guard-replay-contract-v13','readOnly':True,'solverRuns':0,'importsJavaScript':False,
        'protocolSha256':digest(args.protocol),'implementationSha256':digest(__file__),**audit_protocol(ledger.read_json(args.protocol))}
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        with args.output.open('x',encoding='utf-8') as stream:stream.write(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ('episodes','contract')},ensure_ascii=False,allow_nan=False))


if __name__=='__main__':main()
