"""Independent audit of the public calendar-holdout archive.
Does not import the fitting script or its metrics/prediction helpers.
"""
import collections,csv,datetime as dt,hashlib,json,statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent

def median(values):
    v=sorted(values);n=len(v)
    return v[n//2] if n%2 else (v[n//2-1]+v[n//2])/2

def audit():
    output=json.loads((ROOT/'data/public-gate-validation-v3.json').read_text())
    data_path=ROOT/'data/public/v3-gate-visits-deidentified.csv'
    rows=[]
    with data_path.open(encoding='utf-8',newline='') as f:
        for row in csv.DictReader(f):
            stamp=dt.datetime.strptime(row['entry_local'],'%Y-%m-%d %H:%M')
            rows.append((stamp,float(row['elapsed_minutes'])))
    training=[r for r in rows if r[0].date()<=dt.date(2026,4,30)]
    validation=[r for r in rows if dt.date(2026,5,1)<=r[0].date()<=dt.date(2026,5,31)]
    testing=[r for r in rows if dt.date(2026,6,1)<=r[0].date()<=dt.date(2026,6,30)]
    errors=[]
    def check(ok,text):
        if not ok:errors.append(text)
    check(len(training)+len(validation)+len(testing)==len(rows),'Calendar periods do not cover every record')
    check(hashlib.sha256(data_path.read_bytes()).hexdigest()==output['source']['cleanedSha256'],'Derived input hash differs')
    check(hashlib.sha256((ROOT/'data/public-gate-protocol-v3.json').read_bytes()).hexdigest()==output['protocolSha256'],'Protocol bytes differ')
    counts={'records':len(rows),'trainCount':len(training),'validationCount':len(validation),'testCount':len(testing)}
    for k,n in counts.items():check(n==output['summary'][k],k+' count differs')
    global_median=median([y for _,y in training]);candidates=[]
    for name in ['global_median','hour_median','weekday_hour_median']:
        groups=collections.defaultdict(list)
        for stamp,y in training:
            key=stamp.hour if name=='hour_median' else (stamp.weekday(),stamp.hour)
            groups[key].append(y)
        means={k:median(v) for k,v in groups.items() if len(v)>=100}
        def prediction(stamp):
            if name=='global_median':return global_median
            return means.get(stamp.hour if name=='hour_median' else (stamp.weekday(),stamp.hour),global_median)
        vm=statistics.mean(abs(prediction(stamp)-y) for stamp,y in validation)
        test_errors=[abs(prediction(stamp)-y) for stamp,y in testing]
        tm=statistics.mean(test_errors)
        archived=next(c for c in output['candidates'] if c['model']==name)
        check(abs(vm-archived['validation']['mae'])<1e-10,name+' validation MAE differs')
        check(abs(tm-archived['test']['mae'])<1e-10,name+' test MAE differs')
        check(abs(median(test_errors)-archived['test']['medianAbsoluteError'])<1e-10,name+' median error differs')
        sorted_errors=sorted(test_errors);p90=sorted_errors[int((len(sorted_errors)-1)*.9)]
        check(abs(p90-archived['test']['p90AbsoluteError'])<1e-10,name+' P90 error differs')
        candidates.append({'name':name,'validationMAE':vm,'testMAE':tm})
    selected=min(range(len(candidates)),key=lambda i:(candidates[i]['validationMAE'],i))
    check(candidates[selected]['name']==output['summary']['selectedModel'],'Model selection was not validation-only')
    check(abs(candidates[selected]['testMAE']-output['summary']['testMAE'])<1e-10,'Selected test MAE differs')
    improvement=100*(candidates[0]['testMAE']-candidates[selected]['testMAE'])/candidates[0]['testMAE']
    check(abs(improvement-output['summary']['maeImprovementPct'])<1e-10,'MAE improvement denominator differs')
    result={'status':'pass' if not errors else 'fail','counts':counts,'independentCandidates':candidates,'errors':errors,
      'limitations':['Independent recalculation of archived features/labels; not field deployment or invoice verification.',
        'Raw source hash is recorded by the fitting stage; this audit verifies the distributed identifier-free derivative and protocol.']}
    (ROOT/'data/public-gate-audit-v3.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
    if errors:raise SystemExit(1)

if __name__=='__main__':audit()
