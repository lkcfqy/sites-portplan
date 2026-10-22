#!/usr/bin/env python3
"""Independent reused-input V12 full-path development review; no solver or JS.

A separate adapter preserves the strict 144x3x6 formal declaration. This audits
41 old inputs x one old seed x six methods, with no new orders or confidence
intervals. It uses the same independent physical/fee/acceptance reconstruction.
"""
from __future__ import annotations
import argparse
import importlib.util
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('independent_v12',ROOT/'scripts/review-v12.py')
v12=importlib.util.module_from_spec(spec)
spec.loader.exec_module(v12)
ledger,require,same,digest=v12.ledger,v12.require,v12.same,v12.digest
METHODS=v12.METHODS
OLD_INDEX='data/evidence-v10/v10-frozen-first/first-run/complete.json'
OLD_SHA='33d07f60afb4b4248682badc631512a54070cca22fd106c7dd5062d4669bf9c2'
D0_MANIFEST='artifacts/development-seeded-v12-inputs.json'
D0_SHA='0dc504ec9c05cf6296f82e5e4662f81fbd28f0c332fd1e2d78e53dfe525dc57b'


def read_bound(base,artifact,label):
    path=v12.safe_path(base,artifact['path'],label)
    same(digest(path),artifact['sha256'],label+'/SHA256')
    return path,ledger.read_json(path)


def declaration_inputs(directory,declaration):
    same(declaration.get('schemaVersion'),'portplan-v12-fixed-old-fullpath-development-declaration','Declaration schema')
    for key,value in (('dataRole','old-input-development-only'),('newHeldOutExperiments',False),('newOrderGeneration',0),
                      ('ciComputed',False),('parametersChangedAfterDeclaration',False),('scenarioCount',41),('episodeCount',246),
                      ('algorithmSeed',49011),('repeatCount',1),('methods',METHODS)):
        same(declaration.get(key),value,'Fixed declaration '+key)
    same(declaration.get('budget'),{'hardWallMs':5000,'dailyCallBudgetMs':200,'cpuThreads':1},'Unchanged budgets')
    same(declaration.get('oldIndex'),{'path':OLD_INDEX,'sha256':OLD_SHA},'Old index anchor')
    same(declaration.get('oldD0Manifest'),{'path':D0_MANIFEST,'sha256':D0_SHA},'Old D0 manifest anchor')
    _,old=read_bound(ROOT,declaration['oldIndex'],'Original frozen V10 index')
    _,d0=read_bound(ROOT,declaration['oldD0Manifest'],'Old D0 manifest')
    require(old.get('executionState')=='complete' and len(old.get('cases',[]))==144,'Old index coverage differs')
    require(d0.get('endpointCount')==15 and len(d0.get('records',[]))==15,'Old D0 endpoint coverage differs')
    d0_ids={r['caseId'] for r in d0['records']}
    require(len(d0_ids)==5,'Old D0 scenario coverage differs')
    representatives=[c for c in old['cases'] if c['scenarioRepeat']==1]
    require(len(representatives)==36,'Representative count differs')
    for panel in ('same-distribution','stress'):
        for mechanism in ('aged-backlog','new-arrivals','batch-release'):
            for capacity in ('balanced','tight'):
                for count in (24,50,100):
                    require(sum(c['panel']==panel and c['mechanism']==mechanism and c['capacityProfile']==capacity and c['count']==count for c in representatives)==1,
                            'Representative stratum missing/duplicated')
    selected={c['id'] for c in representatives}|d0_ids
    expected=[c for c in old['cases'] if c['id'] in selected]
    require(len(expected)==len(declaration['cases'])==41,'Selection is not exactly the preregistered 41-case union')
    snapshots={}
    for position,(case,original) in enumerate(zip(declaration['cases'],expected)):
        for key in ('id','panel','mechanism','capacityProfile','count','scenarioRepeat','seed'):
            same(case.get(key),original[key],'Original metadata/order '+key)
        same(case.get('originalRepeatIndex'),1,'Original repeat')
        same(case.get('algorithmSeed'),49011,'Original algorithm seed')
        require(any(r['repeatIndex']==1 and r['algorithmSeed']==49011 for r in original['repeats']),'Old seed49011 repeat missing')
        same(case.get('developmentSelection'),{'representative':original['scenarioRepeat']==1,'oldD0Failure':original['id'] in d0_ids},'Selection roles')
        same(case.get('methodExecutionOrder'),[METHODS[(position+offset)%len(METHODS)] for offset in range(len(METHODS))],'Cyclic order')
        same(case.get('sourceInputArtifact'),{'path':'data/evidence-v10/v10-frozen-first/first-run/'+original['inputArtifact']['path'],'sha256':original['inputArtifact']['sha256']},'Original artifact')
        same(case.get('inputArtifact'),{'path':'inputs/'+case['id']+'.json','sha256':original['inputArtifact']['sha256']},'Copied artifact')
        _,source=read_bound(ROOT,case['sourceInputArtifact'],'Original input')
        _,copied=read_bound(directory,case['inputArtifact'],'Byte-identical copied input')
        same(copied,source,'Copied original contents')
        ledger.validate_scenario(copied['nominalScenario'],'Development nominal input')
        snapshots[case['id']]=copied
    return snapshots


def independent_summary(rows):
    panels={}
    for panel in ('same-distribution','stress'):
        by_method={}
        for method in METHODS:
            results=[r for r in rows if r['panel']==panel and r['method']==method]
            times=[r['wallTimeMs'] for r in results if ledger.finite(r['wallTimeMs'])]
            init=[r['initializationEvidence'] for r in results]
            by_method[method]={'recordedEpisodeCount':len(results),'completeCount':sum(r['complete'] for r in results),
                'knownD0FailureCount':sum(r['failurePhase']=='initialization' for r in init),
                'knownLaterFailureCount':sum(r['failurePhase']=='after_initialization' for r in init),
                'unknownHistoryCount':sum(r['executionHistoryUnavailable'] is True for r in results),
                'initialPlanAcceptedCount':sum(r['initialPlanAccepted'] is True for r in init),
                'rejectedTerminalCount':sum(r['rejectedTerminalCount'] for r in results),
                'wallTimeMs':{'mean':sum(times)/len(times) if times else None,'max':max(times) if times else None}}
        panels[panel]={'scenarioCount':len({r['scenarioId'] for r in rows if r['panel']==panel}),'byMethod':by_method}
    return {'panels':panels,'ciComputed':False,'scope':'Implementation/budget/physical-output development coverage only. No new holdout, new research interval, pooled leaderboard or parameter selection.'}


def pairwise_development(rows):
    by_id={(r['scenarioId'],r['method']):r for r in rows}
    output={}
    for panel in ('same-distribution','stress'):
        ids=list(dict.fromkeys(r['scenarioId'] for r in rows if r['panel']==panel))
        comparisons={}
        for method in METHODS[:-1]:
            pairs=[(sid,by_id[(sid,method)],by_id[(sid,'seededHiGHSV12')]) for sid in ids]
            common=[(sid,b,a) for sid,b,a in pairs if b['complete'] and a['complete']]
            comparisons[method]={'completeGainedScenarioIds':[sid for sid,b,a in pairs if a['complete'] and not b['complete']],
                'completeLostScenarioIds':[sid for sid,b,a in pairs if b['complete'] and not a['complete']],
                'pairwiseJointCompleteScenarioIds':[sid for sid,_,_ in common],
                'pairedTotalFeeDifferenceKRW':sum(b['totalCost']-a['totalCost'] for _,b,a in common) if common else None,
                'pairedIncrementalFeeDifferenceKRW':sum(b['incrementalCost']-a['incrementalCost'] for _,b,a in common) if common else None,
                'pairedRevisionDifference':sum(a['revisionCount']-b['revisionCount'] for _,b,a in common)
                    if common and all(ledger.finite(b['revisionCount']) and ledger.finite(a['revisionCount']) for _,b,a in common) else None}
        output[panel]={'reusedScenarioCount':len(ids),'comparisonsToV12':comparisons}
    return output


def review(directory):
    directory=directory.resolve()
    index_path,declaration_path=directory/'complete.json',directory/'declaration.json'
    index_sha,declaration_sha=digest(index_path),digest(declaration_path)
    index,declaration=ledger.read_json(index_path),ledger.read_json(declaration_path)
    same(index.get('schemaVersion'),'portplan-v12-reused-fullpath-development','Completed development schema')
    same(index.get('executionState'),'complete','Requires completed development')
    for key,value in (('dataRole','old-input-development-only'),('newHeldOutExperiments',False),('ciComputed',False)):
        same(index.get(key),value,'Index '+key)
    same(index.get('declarationSha256'),declaration_sha,'Pre-run declaration binding')
    same(index.get('sourceConsistency'),{'before':True,'after':True},'Producer pre/post source consistency')
    start=ledger.read_json(directory/'start.json')
    same(start.get('declarationSha256'),declaration_sha,'Pre-run start declaration binding')
    require(start.get('executionState')=='running' and start.get('records')==[] and start.get('summary') is None,'Pre-run start was not empty')
    snapshots=declaration_inputs(directory,declaration)
    require(isinstance(declaration.get('implementationHashes'),dict) and declaration['implementationHashes'],'Missing frozen runtime sources')
    for name,expected in declaration['implementationHashes'].items():
        path=v12.safe_path(directory/'source',name,'Archived implementation')
        same(digest(path),expected,'Frozen development implementation '+name)
    protocol_path=directory/'source/data/protocol-v12.json'
    same(digest(protocol_path),declaration['protocolSha256'],'Development protocol bytes')
    protocol=ledger.read_json(protocol_path)
    same(declaration['callBudgets'],protocol['callBudgets'],'Declared numeric method parameters')
    for method in METHODS:
        same(declaration['callBudgets'][method]['timeBudgetMs'],200,'Whole-call allowance '+method)
    same({key:declaration['callBudgets']['seededHiGHSV12'][key] for key in ('constructorBudgetMs','constructorAuditReserveMs','maxRestarts')},
         {'constructorBudgetMs':40,'constructorAuditReserveMs':5,'maxRestarts':3},'Prespecified seed parameters')
    require(len(index.get('records',[]))==246,'All 246 records must remain included')
    expected_order=[(c,method) for c in declaration['cases'] for method in c['methodExecutionOrder']]
    counts={'episodes':0,'completeEpisodes':0,'unknownHistoryEpisodes':0,'acceptedPlans':0,'physicalEvents':0}
    native,episodes,checked_rows,artifacts=v12.empty_native_counts(),[],[],set()
    per_method={method:{'wholeCallOverrunCount':0,'knownCallCount':0,'maxWholeCallWallMs':None,'nativeSelection':v12.empty_native_counts()} for method in METHODS}
    for receipt,(case,method) in zip(index['records'],expected_order):
        for key,value in (('scenarioId',case['id']),('panel',case['panel']),('method',method),('sourceInputSha256',case['inputArtifact']['sha256'])):
            same(receipt.get(key),value,'Record binding '+key)
        path,envelope=read_bound(directory,receipt['artifact'],'Full development episode')
        require(path not in artifacts,'Duplicate full episode artifact');artifacts.add(path)
        expected_id='v12-development-'+case['id']+'--a1--'+method
        for key,value in (('episodeId',expected_id),('caseId',case['id']),('scenarioId',case['id']),('panel',case['panel']),
                          ('method',method),('repeatIndex',1),('algorithmSeed',49011),('dataRole','old-input-development-only'),('inputArtifact',case['inputArtifact'])):
            same(envelope.get(key),value,'Full episode identity '+key)
        result=envelope['result']
        same(result.get('policy'),method,'Full episode policy')
        same(result.get('hardWallMs'),5000,'Cold parent budget')
        if not result.get('executionHistoryUnavailable'):
            same(result.get('algorithmSeed'),49011,'Old algorithm seed')
            same(result.get('repeatIndex'),1,'Old repeat')
        source=snapshots[case['id']]
        checked=v12.audit_episode(source['nominalScenario'],source['events'],result,expected_id,5000,method,200)
        for key in ('complete','status','totalCost','incrementalCost','revisionCount','wallTimeMs','executionHistoryUnavailable','rejectedTerminalCount'):
            same(receipt.get(key),result.get(key),'Record/full receipt '+key)
        same(receipt['complete'],checked['complete'],'Independently eligible completion')
        same(receipt.get('initializationEvidence'),checked['initializationEvidence'],'D0 versus later failure classification')
        counts['episodes']+=1;counts['completeEpisodes']+=checked['complete'];counts['unknownHistoryEpisodes']+=not checked['historyAvailable']
        counts['acceptedPlans']+=checked['acceptedPlans'];counts['physicalEvents']+=checked['executedEvents']
        for key,value in checked['nativeStabilitySelection'].items():
            native[key]+=value;per_method[method]['nativeSelection'][key]+=value
        for call in result.get('plannerTrace') or []:
            wall=call.get('callWallMs')
            if ledger.finite(wall):
                timing=per_method[method];timing['knownCallCount']+=1;timing['wholeCallOverrunCount']+=wall>200
                timing['maxWholeCallWallMs']=max(timing['maxWholeCallWallMs'] or 0,wall)
        checked_rows.append({**receipt,'complete':checked['complete'],'initializationEvidence':checked['initializationEvidence']})
        episodes.append({'episodeId':expected_id,'artifactSha256':receipt['artifact']['sha256'],**checked})
    expected_summary=independent_summary(checked_rows)
    same(index.get('summary'),expected_summary,'Independently reconstructed development summary')
    same(digest(index_path),index_sha,'Read-only index unchanged')
    same(digest(declaration_path),declaration_sha,'Read-only declaration unchanged')
    return {'schemaVersion':'portplan-independent-v12-reused-fullpath-development-review','valid':True,'readOnly':True,
        'developmentOnly':True,'newHeldOutExperiments':False,'ciComputed':False,'solverRuns':0,'importsJavaScript':False,
        'inputIndexSha256':index_sha,'declarationSha256':declaration_sha,'implementationSha256':digest(__file__),
        'v12PhysicalReviewerSha256':digest(ROOT/'scripts/review-v12.py'),
        'unchangedLedgerReviewSha256':{str(p):digest(ROOT/p) for p in ('scripts/review-v10.py','scripts/review-v9.py','scripts/review-v8.py','scripts/review-v5.py')},
        'oldIndexSha256':OLD_SHA,'oldD0ManifestSha256':D0_SHA,'frozenRuntimeSources':declaration['implementationHashes'],
        'summary':counts,'independentPanelSummary':expected_summary,'nativeSelection':native,'perMethodTimingAndSelection':per_method,
        'pairwiseDevelopment':pairwise_development(checked_rows),'episodes':episodes,
        'scope':'Independent Python physical/fees/locks/public-snapshot/native-commitment/constructor-delivery review of all 246 preregistered reused-input full paths. Same 41 known scenarios, one old algorithm seed each, six methods. Independent summary and loss/gain identities; no bootstrap or new holdout. Timely incumbent acceptance can coexist with cooperative whole-call overruns, which remain explicit. Recorded timestamps/source-consistency claims are not external clock/process authentication. Full paths differ between methods and cannot isolate a shared-prefix mechanism. This review does not establish formal default eligibility, unseen generalization, policy optimality, future recovery or enterprise benefit.'}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run',type=Path,required=True)
    parser.add_argument('--output',type=Path)
    args=parser.parse_args()
    if args.output:require(not args.output.exists(),'Refuse to replace an earlier development review')
    result=review(args.run)
    if args.output:
        args.output.parent.mkdir(parents=True,exist_ok=True)
        with args.output.open('x',encoding='utf-8') as stream:stream.write(json.dumps(result,ensure_ascii=False,indent=2,allow_nan=False)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ('episodes','frozenRuntimeSources')},ensure_ascii=False,allow_nan=False))


if __name__=='__main__':main()
