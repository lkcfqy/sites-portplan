import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const load = `import importlib.util, copy, json, tempfile\nfrom pathlib import Path\ns = importlib.util.spec_from_file_location('stats', 'scripts/review-bootstrap-v14.py')\nm = importlib.util.module_from_spec(s); s.loader.exec_module(m)\n`;
const fixture = `
def unit(ok=True, cost=100, revisions=2):
    return dict(complete=ok, totalCost=cost if ok else None, incrementalCost=cost if ok else None,
                revisionCount=revisions if ok else None, executionHistoryUnavailable=False)
def case(name):
    return dict(id=name, units={method: [unit() for _ in range(3)] for method in m.METHODS})
candidate='guardedHiGHSV13'
`;
function python(code) {
  const result = spawnSync('python3', ['-c', load + fixture + code], {
    cwd: new URL('../', import.meta.url), encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('three timing repetitions remain inside one business-scenario bootstrap unit', () => {
  python(`
a,b=case('A'),case('B')
a['units'][candidate]=[unit(cost=90) for _ in range(3)]
b['units'][candidate]=[unit(cost=130),unit(False),unit(False)]
o=m.pair_observations([a,b], 'seededHiGHSV12', candidate)
assert o['matchedEpisodeCount']==4
assert o['feeUnits']['totalCost']==[(100.0,90.0),(100.0,130.0)]
assert [x['pairedRepeatCount'] for x in o['scenarioPairs']]==[3,1]
# Equal business weights yield -10 KRW; treating four matched clocks as four
# independent businesses yields 0, a substantively different estimand.
assert m.mean([before-after for before,after in o['feeUnits']['totalCost']])==-10
assert m.ordered_sum([before['totalCost']-after['totalCost'] for _,before,after in o['matchedPairs']])==0
ci=m.cluster_bootstrap(o['feeUnits']['totalCost'],800001,2000)
# With two equal-weight cases the bootstrap support is {-30,-10,10}.
assert ci['scenarioCount']==2 and ci['meanSavings95CI']==[-30.0,10.0]
assert len(o['completionUnits'])==2
assert abs(o['completionUnits'][1][1]-2/3)<1e-15
`);
});

test('each comparison retains its own joint-complete fee and revision denominator', () => {
  python(`
a=case('pair-specific')
a['units'][candidate]=[unit(cost=90,revisions=1) for _ in range(3)]
a['units']['seededHiGHSV12']=[unit(revisions=9),unit(False),unit(False)]
a['units']['highsV8']=[unit(revisions=3),unit(revisions=4),unit(False)]
a['units']['costPolishV7']=[unit(False) for _ in range(3)]
x=m.pair_observations([a],'seededHiGHSV12',candidate)
y=m.pair_observations([a],'highsV8',candidate)
assert x['matchedEpisodeCount']==1 and y['matchedEpisodeCount']==2
assert m.ordered_sum([b['revisionCount'] for _,b,c in x['matchedPairs']])==9
assert m.ordered_sum([b['revisionCount'] for _,b,c in y['matchedPairs']])==7
joint=m.joint_complete_pareto([a])
assert joint['jointScenarioCount']==joint['jointEpisodeCount']==0
assert joint['byMethod'][candidate]['scenarioMeanTotalCostSumKRW'] is None
assert all(row['pareto'] is None for row in joint['frontiers']['totalAndRevisions'])
# Absence from the seven-way descriptive set cannot erase either pair.
assert x['matchedEpisodeCount']==1 and y['matchedEpisodeCount']==2
`);
});

test('one observed loss blocks the default gate even with a compensating gain and positive fee intervals', () => {
  python(`
cases=[case(str(i)) for i in range(72)]
for c in cases:
    c['units'][candidate]=[unit(cost=90,revisions=1) for _ in range(3)]
comparisons={key:{'fees':{fee:{'weightedSavingsPct95CI':[5,15]} for fee in ('total','incremental')}} for key in m.PAIRS}
cases[0]['units'][candidate][0]=unit(False)
cases[1]['units']['seededHiGHSV12'][0]=unit(False)
g=m.decision_gates(cases,comparisons)
assert g['completionLossCountsByBaseline']['seededHiGHSV12']==1
assert g['completionGainCountsByBaseline']['seededHiGHSV12']==1
assert g['defaultRecommendationEligible'] is False
assert g['completionNonRegressionAllBaselines'] is False
assert len(g['completionLossCountsByBaseline'])==6
assert set(g['nativeComparisons'])=={'seededHiGHSV12','commitmentHiGHSV11','stableHiGHSV10','highsV8'}
assert g['nativeComparisons']['seededHiGHSV12']['stabilityImprovementClaimAllowed'] is False
`);
});

test('unknown matched revisions block stability claims while leaving completion eligibility separate', () => {
  python(`
cases=[case(str(i)) for i in range(72)]
for c in cases:
    c['units'][candidate]=[unit(cost=90,revisions=1) for _ in range(3)]
cases[0]['units'][candidate][0]['revisionCount']=None
comparisons={key:{'fees':{fee:{'weightedSavingsPct95CI':[-2,12]} for fee in ('total','incremental')}} for key in m.PAIRS}
g=m.decision_gates(cases,comparisons)
assert g['defaultRecommendationEligible'] is True
v=g['nativeComparisons']['seededHiGHSV12']
assert v['revisionPairedEpisodeCount']==215 and v['revisionDelta'] is None
assert v['strictRevisionReduction'] is False and v['stabilityImprovementClaimAllowed'] is False
assert v['incrementalFeeClaim']=='no_stable_advantage'
assert m.decision_gates(cases[:71],comparisons)['defaultRecommendationEligible'] is False
`);
});

test('zero denominators, no matches and unknown Pareto axes remain unavailable', () => {
  python(`
zero=m.cluster_bootstrap([(0,0)],800001,2000)
assert zero['meanSavings95CI']==[0,0] and zero['weightedSavingsPct95CI'] is None
empty=m.cluster_bootstrap([],800001,2000)
assert empty['scenarioCount']==0 and empty['meanSavings95CI'] is None
a=case('unknown-axis');a['units'][candidate][0]['revisionCount']=None
p=m.joint_complete_pareto([a])
assert p['byMethod'][candidate]['unknownRevisionEpisodeCount']==1
assert p['byMethod'][candidate]['scenarioMeanRevisionCountSum'] is None
assert next(row for row in p['frontiers']['totalAndRevisions'] if row['method']==candidate)['pareto'] is None
`);
});

test('malformed repeats, forged completed fees and duplicate JSON keys are rejected', () => {
  python(`
def rejects(fn):
    try: fn()
    except ValueError: return
    raise AssertionError('expected rejection')
a=case('bad');a['units'][candidate].pop()
rejects(lambda:m.pair_observations([a],'seededHiGHSV12',candidate))
a=case('bad');a['units'][candidate][0]['totalCost']=None
rejects(lambda:m.pair_observations([a],'seededHiGHSV12',candidate))
with tempfile.TemporaryDirectory() as d:
    p=Path(d)/'duplicate.json';p.write_text('{"complete":false,"complete":true}')
    rejects(lambda:m.read_json(p))
`);
});

test('output is first-write-only before even reading a run', () => {
  python(`
import subprocess,sys
with tempfile.TemporaryDirectory() as d:
    p=Path(d)/'review.json';p.write_bytes(b'existing-evidence')
    r=subprocess.run([sys.executable,'scripts/review-bootstrap-v14.py','--run',d,'--output',str(p)],capture_output=True,text=True)
    assert r.returncode!=0 and 'Refuse to overwrite' in r.stderr
    assert p.read_bytes()==b'existing-evidence'
`);
});

test('first-run marker binds its one output, original manifest and push bytes before accepting any statistics', () => {
  python(`
def rejects(fn):
    try: fn()
    except ValueError: return
    raise AssertionError('expected rejection')
with tempfile.TemporaryDirectory() as d:
    frozen=Path(d)/'frozen';run=Path(d)/'run';frozen.mkdir();run.mkdir()
    push=dict(schemaVersion='portplan-v14-root-verified-source-push',sourceGitCommit='c'*40,
              observedRemoteCommit='c'*40,remoteName='origin',branch='main',verifiedAt='2026-10-17T00:00:00Z',
              verification='git push then authenticated git ls-remote exact branch; root observation, not external attestation')
    (frozen/'source-push-receipt.json').write_text(json.dumps(push))
    pushref=dict(path='source-push-receipt.json',sha256=m.sha256(frozen/'source-push-receipt.json'),record=push)
    manifest=dict(sourceGitCommit='c'*40,sourceGitTree='d'*40,gitObjectFormat='sha1',committedBlobHashes={},sourcePushReceipt=pushref)
    index=dict(manifest,manifestSha256='a'*64,protocolHash='b'*64)
    marker=dict(schemaVersion='portplan-v14-first-run-execution-start',rootAuthorized=True,manifestSha256='a'*64,
                protocolHash='b'*64,sourceGitCommit='c'*40,sourcePushReceiptSha256=pushref['sha256'],
                plannedEpisodeCount=3024,outputRelativeToFrozen='../run')
    def bind():
        (frozen/'execution-start.json').write_text(json.dumps(marker))
        index['executionStartArtifact']=dict(path='../frozen/execution-start.json',sha256=m.sha256(frozen/'execution-start.json'))
    def audit(): return m.audit_first_run_binding(run,index,manifest,frozen/'manifest.json','a'*64)
    bind();assert audit()['fixedMarkerAndOutputBinding'] is True
    for key,value in [('rootAuthorized',False),('manifestSha256','e'*64),('plannedEpisodeCount',2592),
                      ('sourcePushReceiptSha256','f'*64),('outputRelativeToFrozen','../different-run')]:
        original=marker[key];marker[key]=value;bind();rejects(audit);marker[key]=original
    bind();(frozen/'source-push-receipt.json').write_text('{}');rejects(audit)
`);
});
