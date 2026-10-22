#!/usr/bin/env python3
"""Necessary interval-capacity bounds on all seven saved V15 failure endpoints.

Standard library only; no solver, JS, planner, new input or frozen-evidence writes.
Single-box domains ignore every resource capacity and are therefore supersets
of the projections of a joint feasible continuation. Passing is not feasibility.
"""
from __future__ import annotations
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

sys.dont_write_bytecode = True
FIELDS = ('pickupDay','unloadDay','returnDay')
RESOURCES = ('truck','warehouse','staging')
METHOD = 'timelyHiGHSV15'
INDEX_SHA = 'b996dcf846c0e00ba3f89da453176af8f4a4302061e8dd2f27b7d4966196eaee'


def require(condition, message):
    if not condition: raise ValueError(message)


def canonical(value):
    return json.dumps(value,sort_keys=True,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()


def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def value_hash(value): return hashlib.sha256(canonical(value)).hexdigest()
def read(path): return json.loads(Path(path).read_text(),parse_constant=lambda v: (_ for _ in ()).throw(ValueError(v)))


def safe(base, name):
    require(isinstance(name,str) and name and not Path(name).is_absolute() and '..' not in Path(name).parts,'Unsafe artifact path')
    result=(base/name).resolve();require(result.is_relative_to(base.resolve()),'Artifact escaped root');return result


def operations(s): return {'returnLagDays':1,'stagingUnit':'container',**s.get('operations',{})}


def legal_triples(s, box, fixed, today):
    """Complete temporal domain; capacity values and any cached plan are unused."""
    H=s['horizonDays'];lag=operations(s)['returnLagDays'];locks=fixed.get(box['id'],{})
    def days(field): return [locks[field]] if field in locks else range(today,H)
    output=[]
    for p in days('pickupDay'):
        if p<box['releaseDay']:continue
        for u in days('unloadDay'):
            end=u+box['unloadDays']-1
            if u<p or end>box['dueDay'] or end>=H:continue
            for r in days('returnDay'):
                if r>=end+lag:output.append((p,u,r))
    return output


def interval_usage(box, triple, operation, a, b):
    p,u,r=triple
    truck=int(a<=p<=b)+int(a<=r<=b)
    warehouse=max(0,min(u+box['unloadDays']-1,b)-max(u,a)+1)
    weight=box['sizeFt']//20 if operation['stagingUnit']=='teu' else 1
    staging=weight*max(0,min(r,b+1)-max(p,a))
    return truck,warehouse,staging


def diagnose(s, fixed, today, ledger):
    ledger.validate_scenario(s,'public snapshot')
    H=s['horizonDays'];op=operations(s);ids={c['id'] for c in s['containers']}
    require(type(today) is int and 0<=today<=H,'Invalid current day')
    require(isinstance(fixed,dict) and set(fixed)<=ids,'Unknown executed container')
    for identifier,locks in fixed.items():
        require(isinstance(locks,dict),'Malformed locks')
        require(all(k in FIELDS and type(d) is int and 0<=d<today for k,d in locks.items()),'Execution locks must be strictly in the past')
    domains=[];crosschecks=0
    for box in s['containers']:
        trips=legal_triples(s,box,fixed,today);domains.append((box,trips))
        # Reuse the frozen independent ledger's exact daily physical semantics.
        # Inflate capacities only for this usage crosscheck: no trip is removed.
        for trip in dict.fromkeys([trips[0],trips[-1]] if trips else []):
            relaxed=copy.deepcopy(s);relaxed['containers']=[copy.deepcopy(box)]
            for resource in RESOURCES:relaxed[resource+'Capacity']=[1000000]*H
            row={'id':box['id'],**dict(zip(FIELDS,trip))}
            usage=ledger.audit_dates(relaxed,[row],'single-box usage crosscheck',{box['id']:fixed.get(box['id'],{})},today)['usage']
            require(usage==[list(interval_usage(box,trip,op,d,d)) for d in range(H)],'Independent frozen ledger usage differs')
            crosschecks+=1
    stats=[{'id':box['id'],'legalTripCount':len(trips),'domainSha256':value_hash(trips),'relaxedWitness':dict(zip(FIELDS,trips[0])) if trips else None} for box,trips in domains]
    empty=[box['id'] for box,trips in domains if not trips]
    if empty:return {'status':'single_box_domain_empty','emptyDomainIds':empty,'domainStats':stats,'usageCrosschecks':crosschecks,'checks':[],'violations':[],'strongestCertificate':None}
    checks=[];violations=[]
    for a in range(today,H):
        for b in range(a,H):
            minima=[];witnesses=[]
            for box,trips in domains:
                quantities=[interval_usage(box,trip,op,a,b) for trip in trips]
                minimum=[min(q[i] for q in quantities) for i in range(3)]
                minima.append(minimum)
                witnesses.append([trips[next(k for k,q in enumerate(quantities) if q[i]==minimum[i])] for i in range(3)])
            for i,resource in enumerate(RESOURCES):
                lower=sum(m[i] for m in minima)
                capacity=sum(ledger.capacity(s,resource,d) for d in range(a,b+1))
                item={'resource':resource,'firstDay':a,'lastDay':b,'necessaryDemand':lower,'publicCapacitySum':capacity,'deficit':lower-capacity,'violated':lower>capacity}
                checks.append(item)
                if item['violated']:
                    contributors=[]
                    for k,(box,trips) in enumerate(domains):
                        if minima[k][i]:contributors.append({'id':box['id'],'minimumIntervalDemand':minima[k][i],'minimizingRelaxedTrip':dict(zip(FIELDS,witnesses[k][i])),'legalTripCount':len(trips)})
                    violations.append({**item,'contributors':contributors})
    strongest=min(violations,key=lambda v:(-v['deficit'],v['lastDay']-v['firstDay'],v['firstDay'],RESOURCES.index(v['resource']))) if violations else None
    return {'status':'necessary_capacity_violated' if violations else 'not_explained','emptyDomainIds':[],
            'domainStats':stats,'usageCrosschecks':crosschecks,'checks':checks,'violations':violations,'strongestCertificate':strongest}


def self_tests(ledger):
    box=lambda name,**extra:{'id':name,'sizeFt':20,'releaseDay':0,'unloadDays':1,'dueDay':1,'dischargeDateTime':'2026-10-13T07:00:00+09:00',**extra}
    scene=lambda boxes,**extra:{'id':'HANDWRITTEN-BOUND-FIXTURE','horizonStart':'2026-10-13','horizonDays':3,'truckCapacity':20,'warehouseCapacity':20,'stagingCapacity':20,'containers':boxes,**extra}
    passed=[]
    s=scene([box('A')]);d=diagnose(s,{},0,ledger);require(d['status']=='not_explained','Feasible fixture falsely rejected');require((0,0,2) in legal_triples(s,s['containers'][0],{},0),'Return incorrectly restricted by unload due day');passed.append('known-legal continuation and return-after-unload-deadline')
    s=scene([box('A'),box('B'),box('C')],warehouseCapacity=[1,1,20]);d=diagnose(s,{},0,ledger)
    require(any(v['resource']=='warehouse' and v['firstDay']==0 and v['lastDay']==1 and v['necessaryDemand']==3 and v['publicCapacitySum']==2 for v in d['violations']),'Interval energy 3>2 missing')
    require(not any(v['resource']=='warehouse' and v['firstDay']==v['lastDay'] for v in d['violations']),'Daily minimum fixture should be inconclusive');passed.append('warehouse-interval-certificate-beyond-per-day-minima')
    s=scene([box('A')],truckCapacity=[0,1,0]);d=diagnose(s,{},0,ledger);require(any(v['resource']=='truck' and v['necessaryDemand']==2 and v['publicCapacitySum']==1 for v in d['violations']),'Truck interval energy missing');passed.append('pickup-and-return-both-counted')
    s=scene([box('A',sizeFt=40,unloadDays=2,dueDay=2)],horizonDays=4,operations={'returnLagDays':1,'stagingUnit':'teu'},stagingCapacity=[20,1,20,20]);d=diagnose(s,{'A':{'pickupDay':0,'unloadDay':0}},1,ledger)
    require(any(v['resource']=='staging' and v['firstDay']==1 and v['lastDay']==1 and v['necessaryDemand']==2 for v in d['violations']),'TEU ongoing occupancy missing');passed.append('teu-staging-with-past-execution-locks')
    s=scene([box('A',unloadDays=3,dueDay=2)],horizonDays=4,warehouseCapacity=[20,20,0,20]);d=diagnose(s,{'A':{'pickupDay':0,'unloadDay':0}},2,ledger)
    require(d['domainStats'][0]['legalTripCount']==1 and any(v['resource']=='warehouse' and v['firstDay']==2 and v['necessaryDemand']==1 for v in d['violations']),'Past unload start wrongly removed');passed.append('locked-ongoing-unload-crosses-current-day')
    s=scene([box('A',dueDay=0)],operations={'returnLagDays':0,'stagingUnit':'teu'});trip=(0,0,0);require(trip in legal_triples(s,s['containers'][0],{},0),'Same-day zero-lag legal trip removed');require(interval_usage(s['containers'][0],trip,operations(s),0,0)==(2,1,0),'Same-day resources wrong');diagnose(s,{},0,ledger);passed.append('zero-lag-same-day-two-trucks-zero-staging')
    s=scene([box('A',dueDay=0)]);require(diagnose(s,{},1,ledger)['status']=='single_box_domain_empty','Unexecuted past dates allowed');passed.append('pending-events-cannot-be-backdated')
    try:diagnose(scene([box('A')]),{'A':{'pickupDay':1}},1,ledger)
    except ValueError:passed.append('future-execution-lock-rejected')
    else:raise ValueError('Future lock accepted')
    return {'valid':True,'handwrittenFixtures':len(passed),'passed':passed,'optimizerRuns':0,'fixtureResultsAreResearchEvidence':False}


def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--project-root',type=Path,default=Path(__file__).resolve().parents[1]);parser.add_argument('--run',default='artifacts/v15-seen-delivery-first');parser.add_argument('--output',type=Path);parser.add_argument('--self-test-only',action='store_true');args=parser.parse_args(argv)
    project=args.project_root.resolve();run=safe(project,args.run);index_path=run/'complete.json';declaration_path=run/'declaration.json'
    require(sha(index_path)==INDEX_SHA,'Not the unchanged first V15 index');index=read(index_path);declaration=read(declaration_path)
    require(index.get('executionState')=='complete' and index['declarationSha256']==sha(declaration_path),'First-run declaration mismatch')
    ledger_path=run/'source/scripts/review-v5.py';require(sha(ledger_path)==declaration['implementationHashes']['scripts/review-v5.py'],'Frozen independent physical ledger SHA mismatch')
    spec=importlib.util.spec_from_file_location('v15_capacity_frozen_ledger',ledger_path);ledger=importlib.util.module_from_spec(spec);spec.loader.exec_module(ledger)
    tests=self_tests(ledger)
    if args.self_test_only:print(json.dumps(tests));return
    require(args.output is not None,'Explicit new output path required')
    review_path=project/'data/review-delivery-v15.json';review=read(review_path);require(review.get('valid') is True and review.get('inputIndexSha256')==INDEX_SHA,'Matching independent V15 review required')
    endpoints={e['endpointId']:e for e in declaration['protocol']['endpoints']}
    failures=[r for r in index['records'] if r['method']==METHOD and r['receipt']['complete'] is False]
    require(len(failures)==7,'Must retain exactly all seven first V15 failures')
    records=[];contexts={};source_refs=[]
    for record in failures:
        path=safe(run,record['artifact']['path']);require(sha(path)==record['artifact']['sha256'],'Raw failure SHA changed');raw=read(path);result=raw['result'];day=result['failure']['day'];require(day==record['interventionDay'],'This bounded diagnostic expects failure at the declared first intervention')
        trace=next(t for t in result['plannerTrace'] if t['day']==day);s=trace['publicSnapshot'];fixed=trace['fixedEvents'];endpoint=endpoints[record['endpointId']]
        require(s==endpoint['publicSnapshot'] and fixed==endpoint['fixedEvents'],'Actual public input differs from declaration')
        require(value_hash(s)==endpoint['publicSnapshotSha256'] and value_hash(fixed)==endpoint['fixedEventsSha256'],'Public snapshot/locks hash differs')
        original_ref=record['sourceEpisodeArtifact'];original_path=safe(run/'original',original_ref['path']);require(sha(original_path)==original_ref['sha256'],'Original physical prefix bytes changed');original=read(original_path)['result'];prefix=[];locks={}
        for entry in original['timeline'][:day]:
            require(entry['status']=='executed','Original prefix was not executed');prefix.append({k:entry[k] for k in declaration['protocol']['prefixProjectionKeys']})
            for event in entry['executedEvents']:
                key=ledger.EVENT_FIELDS[event['event']];require(key not in locks.get(event['id'],{}),'Repeated executed action');locks.setdefault(event['id'],{})[key]=event['day']
        require(locks==fixed and value_hash(prefix)==endpoint['prefixProjectionSha256'],'Original prefix/actual lock reconstruction differs')
        observed=original['timeline'][day]['observedEvents'];hashed={'scenario':s,'observedEvents':observed,'fixedEvents':fixed,'minEventDay':day}
        require(ledger.checksum(hashed,endpoint['originalObservationHash'])==endpoint['originalObservationHash'],'Public observation checksum differs')
        context_hash=value_hash({'publicSnapshot':s,'fixedEvents':fixed,'minEventDay':day})
        if context_hash not in contexts:contexts[context_hash]={'contextSha256':context_hash,'minEventDay':day,'publicSnapshot':s,'fixedEvents':fixed,**diagnose(s,fixed,day,ledger)}
        cert=contexts[context_hash];records.append({'endpointId':record['endpointId'],'caseId':record['caseId'],'repeatIndex':record['repeatIndex'],'method':METHOD,'failureDay':day,'rawArtifact':{'path':str(path.relative_to(project)),'sha256':sha(path)},'originalEpisodeArtifact':original_ref,'originalPrefixProjectionSha256':endpoint['prefixProjectionSha256'],'publicSnapshotSha256':endpoint['publicSnapshotSha256'],'fixedEventsSha256':endpoint['fixedEventsSha256'],'originalObservationHash':endpoint['originalObservationHash'],'contextSha256':context_hash,'status':cert['status'],'strongestCertificate':cert['strongestCertificate'],'nativeStatus':trace['metadata']['nativeCertificate']['status'],'scope':'Current public model and this already-executed fixed prefix only; no whole-business, future-oracle or repair claim.'})
    counts={status:sum(r['status']==status for r in records) for status in ['necessary_capacity_violated','single_box_domain_empty','not_explained']}
    require(sha(index_path)==INDEX_SHA,'Read-only index changed')
    output={'schemaVersion':'portplan-v15-necessary-interval-capacity-diagnosis','executionState':'complete','solverRuns':0,'importsJavaScript':False,'newBusinessCases':0,'newFormalRuns':0,'firstIndex':{'path':str(index_path.relative_to(project)),'sha256':INDEX_SHA},'firstDeclaration':{'path':str(declaration_path.relative_to(project)),'sha256':sha(declaration_path)},'independentPhysicalReview':{'path':str(review_path.relative_to(project)),'sha256':sha(review_path),'valid':True},'frozenUsageLedger':{'path':str(ledger_path.relative_to(project)),'sha256':sha(ledger_path)},'diagnosticScriptSha256':sha(__file__),'handwrittenTests':tests,'coverage':{'failedV15Episodes':7,'independentBusinessCases':len({r['caseId'] for r in records}),'distinctPublicContexts':len(contexts),'statusCounts':counts},'method':{'domains':'Every integer single-box temporal triple obeying release, precedence, unloading completion deadline, return lag, horizon, exact past locks and pending-event current-day floor. All resource capacities ignored in domain enumeration: joint feasible projections are a subset. No cached-plan slots or private future events enter the domain.','lowerBound':'For every current/future closed day interval and each resource, minimize each box interval usage over its entire temporal domain, sum minima, compare strictly against summed public capacity. Different minima can have different trips; minimizing witnesses do not form a joint feasible plan.','usage':'Frozen independent Python review-v5.audit_dates: pickup+return each one truck, unloading [u,u+L), staging [p,r) with container or TEU weight. Full interval energy minimized before summation, not sum of daily minima.','certificateScope':'A strict capacity violation or empty single-box temporal domain is a necessary-condition contradiction for this public snapshot and this fixed execution prefix only. No violation means not_explained, not feasible, recoverable or business-wide infeasible.','repetitions':'All seven failed repeats retained. Identical public contexts may share an exact calculation without changing episode counts or creating independent samples.'},'records':records,'contexts':list(contexts.values()),'limitations':['Post-first-run seen-input diagnostic, not a new holdout or algorithm improvement.','Does not rerun HiGHS, alter budget/algorithm/results or evaluate alternative earlier physical prefixes.','Future unannounced capacities and shock durations are not read into the interval calculation.','Earlier decisions might have avoided a bad prefix; this analysis does not prove which decision caused it or how to repair it.']}
    with args.output.open('x') as stream:json.dump(output,stream,ensure_ascii=False,indent=2);stream.write('\n')
    print(json.dumps({'valid':True,'output':str(args.output),'coverage':output['coverage'],'scriptSha256':output['diagnosticScriptSha256'],'outputSha256':sha(args.output)}))


if __name__=='__main__':main()
