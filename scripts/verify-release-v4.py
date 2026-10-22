"""Review frozen artifacts without rerunning or replacing research outcomes."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
def read(path):return json.loads((ROOT/path).read_text())
def digest(path):return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()

def main():
    benchmark=read('data/benchmark-v4.json');rolling=read('data/rolling-v4.json');certificate=read('data/certificate-v4.json')
    assert benchmark['executionState']==rolling['executionState']=='complete'
    assert [c['id'] for c in benchmark['cases']]==[c['id'] for c in read('data/protocol-v4.json')['primaryCases']]
    assert [c['id'] for c in rolling['cases']]==[c['id'] for c in read('data/rolling-protocol-v4.json')['cases']]
    assert certificate['inputSha256']==digest('data/benchmark-v4.json')
    assert certificate['summary']['inputCaseCount']==certificate['summary']['caseCount']==18
    assert certificate['summary']['failedCaseCount']==certificate['summary']['omittedCaseCount']==0
    for item in read('data/public/v4-competition/manifest.json'):
        assert digest(item['path'])==item['sha256'],item['path']
    snapshot=read('vendor/experiments/v4-first-run-source/manifest.json')
    for path,item in snapshot['files'].items():assert digest('vendor/experiments/v4-first-run-source/'+path)==item['expectedSHA256'],path
    for path in ['docs/report-v4.zh.md','docs/submission-v4.ko.md','docs/defense-v4.ko.html','docs/defense-v4.en.md','docs/reviewer-v4.md','docs/contribution-log-v4.md']:
        assert (ROOT/path).is_file(),path
    result=subprocess.run([sys.executable,str(ROOT/'scripts/review-v4.py')],cwd=ROOT,capture_output=True,text=True)
    print(result.stdout.strip())
    if result.returncode:print(result.stderr,file=sys.stderr);return result.returncode
    tests=sorted(str(p.relative_to(ROOT)) for p in (ROOT/'tests').glob('*.test.mjs'))
    result=subprocess.run(['node','--test',*tests],cwd=ROOT,capture_output=True,text=True)
    if result.returncode:print(result.stdout);print(result.stderr,file=sys.stderr);return result.returncode
    print('\n'.join(result.stdout.strip().splitlines()[-8:]))
    print(json.dumps({'release':'PortPlan V4','frozenArtifacts':'verified','firstRunSourceSnapshot':'verified','officialEvidenceHashes':'verified','tests':'passed'},ensure_ascii=False))
    return 0

if __name__=='__main__':sys.exit(main())
