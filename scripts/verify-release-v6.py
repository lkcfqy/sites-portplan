"""Read-only release checks. Never regenerate or replace frozen experiments."""
from pathlib import Path
import hashlib
import importlib.util
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
def module(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/f'{name}.py')
    value=importlib.util.module_from_spec(spec);sys.modules[name]=value;spec.loader.exec_module(value);return value
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):return json.loads(path.read_text())
def main():
    module('restore-evidence-v6').ensure_evidence(ROOT)
    subprocess.run(['node','scripts/build-view-v6.mjs','--ensure'],cwd=ROOT,check=True)
    frozen={**module('verify-release-v5').FROZEN,
      'data/protocol-v6.json':'6b40337ee36ff9ff10dbd22e4953932aa17900a5d12cbc3a5f75e36518660311',
      'data/rolling-v6.json':'695f7a62aeccd645bbd1374899fc21afe6caad1549bfbc7fa2d25e1ed62552a4',
      'data/failure-diagnosis-v6.json':'57f9a34ed16a20c9fab115c0666b8c826d1c77bbe0d2a660a777d7ef0c2c419d',
      'data/feasibility-witnesses-v6.json':'2a5f76e5c8df79c889b0840d3a901fa68579d247978156bf0e40fe875aafbc94',
      'data/feasibility-review-v6.json':'eae5e16cda332f6935598b2812e7e0d58cf87182b3a3eeeeb3ef475b640ee5a0',
      'data/public-orders-audit-v6.json':'57f011bc3f16d083ef4063a26735da526a142d0a20f1ff57e187653af28604f5',
      'data/public-sources-v6.json':'22f9fdf51a1977c48549d6dd4d952509a9ece91fa1e1c187206d3bcb9b585a7b'}
    for name,expected in frozen.items():assert sha(ROOT/name)==expected,name
    snapshot=ROOT/'vendor/experiments/v6-first-run-source'
    for name,expected in read(snapshot/'manifest.json')['implementationHashes'].items():
        assert sha(snapshot/name)==expected,name
        if name not in ('package.json','package-lock.json'):assert sha(ROOT/name)==expected,name
    diagnosis=read(ROOT/'data/failure-diagnosis-v6.json');assert diagnosis['valid']
    for name,expected in diagnosis['inputHashes'].items():assert sha(ROOT/name)==expected,name
    for name,expected in diagnosis['implementationHashes'].items():assert sha(ROOT/name)==expected,name
    sourceRoot=ROOT/'data/public/v6-data-sources'
    manifest=read(sourceRoot/'manifest.json')
    assert sha(sourceRoot/'manifest.json')==frozen['data/public-sources-v6.json']
    for entry in manifest['inventory']:
        assert sha(sourceRoot/entry['path'])==entry['sha256'],entry['path']
    old=module('review-v5').review(ROOT);assert old['valid'],old
    rolling=module('review-rolling-v6').review(ROOT);assert rolling['valid'],rolling
    stored=read(ROOT/'data/rolling-review-v6.json');assert stored['valid']
    bootstrap=stored.pop('cliEvidenceBootstrap',{})
    assert bootstrap['existingEvidenceReplaced'] is False
    assert type(bootstrap['canonicalArchiveRestoredBeforeReadOnlyReview']) is bool
    assert bootstrap['transportManifestSha256']==sha(ROOT/'data/archives-v6/rolling-v6/manifest.json')
    assert bootstrap['restoreImplementationSha256']==sha(ROOT/'scripts/restore-evidence-v6.py')
    assert bootstrap['canonicalSha256']==frozen['data/rolling-v6.json'] and bootstrap['transportPartCount']==29
    for item in (rolling,stored):item['summary'].pop('wallSeconds',None)
    assert rolling==stored,'Stored rolling review differs from independent recomputation'
    cuts=module('review-feasibility-v6').review(ROOT);assert cuts['valid'],cuts
    public=module('audit-public-orders-v6').audit(sourceRoot/'california-freight-47-derived')
    assert public['summary']['failedCheckCount']==0,public['failures']
    assert public['summary']==read(ROOT/'data/public-orders-audit-v6.json')['summary']
    # Decode and deep-compare the actual published projection without rewriting it.
    verifyProjection="""import {readFile} from 'node:fs/promises';import {isDeepStrictEqual} from 'node:util';import {decodeRollingViewV6} from './src/research-view-v6.js';
const raw=JSON.parse(await readFile('data/rolling-v6.json')),view=decodeRollingViewV6(JSON.parse(await readFile('data/rolling-v6-view.json')));
for(const [a,b]of [[raw.cases,view.cases],[raw.developmentControls.cases,view.developmentControls.cases]]){
 if(a.length!==b.length)throw new Error('Case count changed');for(let i=0;i<a.length;i++)for(const [method,result]of Object.entries(b[i].policies))for(const [key,value]of Object.entries(result)){
 if(key==='plannerStats'||key==='plannerTrace')continue;if(!isDeepStrictEqual(a[i].policies[method][key],value))throw new Error('Projection differs: '+key);}}
if(!isDeepStrictEqual(raw.summary,view.summary)||!isDeepStrictEqual(raw.developmentControls.summary,view.developmentControls.summary))throw new Error('Summary differs');"""
    subprocess.run(['node','--input-type=module','-e',verifyProjection],cwd=ROOT,check=True)
    for name in ['report-v6.zh.md','submission-v6.ko.md','defense-v6.ko.html','defense-v6.ko.pdf','defense-v6.en.md','contribution-log-v6.md','results-redteam-v6.md','rolling-review-v6.md']:
        assert (ROOT/'docs'/name).is_file(),name
    tests=sorted(str(path.relative_to(ROOT))for path in(ROOT/'tests').glob('*.test.mjs'))
    result=subprocess.run(['node','--test',*tests],cwd=ROOT,capture_output=True,text=True)
    if result.returncode:
        print(result.stdout);print(result.stderr,file=sys.stderr);return result.returncode
    print('\n'.join(result.stdout.strip().splitlines()[-8:]))
    print(json.dumps({'release':'PortPlan V6','frozenEvidenceVerified':len(frozen),'readonlyIndependentReviews':'passed','projection':'lossless published fields','tests':'passed','researchRerun':False},ensure_ascii=False))
    return 0
if __name__=='__main__':sys.exit(main())
