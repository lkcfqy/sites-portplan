import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const script=fileURLToPath(new URL('../scripts/diagnose-failures-v8.py',import.meta.url));
function python(body){
  const setup=`import importlib.util,copy,json\nfrom pathlib import Path\ns=importlib.util.spec_from_file_location('diagnosis_v8',${JSON.stringify(script)})\nm=importlib.util.module_from_spec(s)\ns.loader.exec_module(m)\n`;
  const result=spawnSync('python',['-c',setup+body],{cwd:root,encoding:'utf8',timeout:30000});
  assert.equal(result.error,undefined,result.error?.message);
  assert.equal(result.status,0,result.stderr||result.stdout);
  return result;
}
const fixture=`scenario={'horizonStart':'2026-10-12','horizonDays':5,'truckCapacity':2,'warehouseCapacity':1,'stagingCapacity':1,'containers':[{'id':'T','sizeFt':20,'dischargeDateTime':'2026-09-29T07:00:00+09:00','releaseDay':0,'unloadDays':2,'dueDay':3}]}\n`;

test('diagnostic cache canonicalises scalar capacities without merging different execution histories',()=>{
  python(fixture+`
a=m.model_identity(scenario)
b=m.model_identity(m.ledger.expanded(scenario))
assert a == b and m.identity_hash(a) == m.identity_hash(b)
c=m.model_identity(scenario,{'T':{'pickupDay':0}},1)
assert m.identity_hash(c) != m.identity_hash(a)
d=copy.deepcopy(a);d['scenario']['warehouseCapacity'][3]=0
assert m.identity_hash(d) != m.identity_hash(a)
`);
});

test('only unknown feasibility escalates and exhausting both budgets stays unknown',()=>{
  python(fixture+`
identity=m.model_identity(scenario)
calls=[]
def unknown(*args):
    calls.append(args[-1])
    return {'status':'time_limit','hasIncumbent':False,'provenInfeasible':False,'rows':[],'objectiveCost':None}
result=m.solve_escalating(identity,10,60,solver=unknown)
assert calls == [10,60] and result['feasibility']=='unknown'
assert result['certificate']['objectiveCost'] is None and result['certificate']['rows']==[]
calls=[]
def feasible(*args):
    calls.append(args[-1])
    return {'status':'time_limit','hasIncumbent':True,'provenInfeasible':False}
result=m.solve_escalating(identity,10,60,solver=feasible)
assert calls == [10] and result['feasibility']=='feasible'
calls=[]
def infeasible(*args):
    calls.append(args[-1])
    return {'status':'infeasible','hasIncumbent':False,'provenInfeasible':True}
result=m.solve_escalating(identity,10,60,solver=infeasible)
assert calls == [10] and result['feasibility']=='infeasible'
`);
});

test('hindsight can be feasible while the exact ongoing-unloading prefix is unrecoverable',()=>{
  python(fixture+`
actual=copy.deepcopy(scenario);actual['warehouseCapacity']=[1,0,1,1,1]
nominal=m.native.solve_locked(scenario,time_limit=1)
global_actual=m.native.solve_locked(actual,time_limit=1)
observed=m.native.solve_locked(actual,{'T':{'pickupDay':0,'unloadDay':0}},1,1)
assert nominal['hasIncumbent'] and global_actual['hasIncumbent']
assert observed['provenInfeasible'] and not observed['hasIncumbent']
assert observed['rows']==[] and observed['objectiveCost'] is None
assert m.classify(nominal,observed,global_actual,observed)=='observed_prefix_infeasible_hindsight_from_start_feasible'
`);
});

test('V7 failure reconstruction binds all nine identities and the D3/D7 executed prefixes to original hashes',()=>{
  python(`
_,_,_,protocol,cases=m.load_frozen(Path('.'))
snapshots={case['id']:m.reconstruct(case,protocol) for case in cases}
assert len(snapshots)==9
assert sum(s['minEventDay']==0 for s in snapshots.values())==7
assert snapshots['v7-aged-backlog-tight-n24-r2']['executedEventCount']==43
assert snapshots['v7-new-arrivals-tight-n50-r2']['executedEventCount']==17
assert all(s['originalObservationHashVerified'] for s in snapshots.values())
case=copy.deepcopy(next(c for c in cases if c['id']=='v7-new-arrivals-tight-n50-r2'))
case['policies']['costPolishV7']['timeline'][-1]['observationHash']='sha256:'+'0'*64
try:
    m.reconstruct(case,protocol)
except ValueError:
    pass
else:
    raise AssertionError('forged causal observation checksum accepted')
`);
});

test('saved production evidence verifies without solving and rejects a changed model, row or input hash',()=>{
  python(`
path=Path('data/failure-diagnosis-v8.json')
report=json.loads(path.read_text())
assert m.verify_saved(Path('.'),path)['solverRuns']==0
changed=copy.deepcopy(report)
key=next(iter(changed['models']))
changed['models'][key]['identity']['scenario']['truckCapacity'][0]+=1
try:
    m.verify_models(changed)
except ValueError:
    pass
else:
    raise AssertionError('changed diagnostic model accepted')
changed=copy.deepcopy(report)
model=next(model for model in changed['models'].values() if model['certificate']['hasIncumbent'])
for proof in (model['certificate'],model['attempts'][-1]):
    proof['rows'][0]['returnDay']=99
try:
    m.verify_models(changed)
except (ValueError,IndexError):
    pass
else:
    raise AssertionError('invalid diagnostic dates accepted')
assert report['method']['originalAlgorithmExtraBudgetReplay']=='not_tested'
assert report['onlinePolicyReruns']==report['newHeldOutExperiments']==0
assert report['summary']['failureCaseCount']==9
import tempfile
changed=copy.deepcopy(report)
changed['inputHashes']['data/rolling-v7.json']='0'*64
with tempfile.TemporaryDirectory() as directory:
    forged=Path(directory)/'forged.json'
    forged.write_text(json.dumps(changed))
    try:
        m.verify_saved(Path('.'),forged)
    except ValueError:
        pass
    else:
        raise AssertionError('changed source archive binding accepted')
`);
});

test('the diagnostic CLI refuses to overwrite immutable evidence before it starts solving',()=>{
  const result=spawnSync('python',[script,'--output','data/rolling-v7.json'],{cwd:root,encoding:'utf8',timeout:10000});
  assert.equal(result.error,undefined,result.error?.message);
  assert.equal(result.status,1);
  const report=JSON.parse(result.stdout);
  assert.equal(report.valid,false);
  assert.match(report.error,/Refusing to overwrite/);
  assert.equal(result.stderr,'');
});
