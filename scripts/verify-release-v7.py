"""Recheck immutable evidence, independent ledgers and tests. No experiment reruns."""
from pathlib import Path
import argparse
import copy
import hashlib
import importlib.util
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
FROZEN={
    'data/rolling-v7.json':'a8b0d67f7ff5fbf3b27fe260ab8d9d17be331a9942df37704d8d8365546000c6',
    'data/protocol-v7.json':'bb70fa6938ffbb162347142cbb2788f9ece00ac695a8b8ed5a647cd08aedb96f',
    'data/public-resource-v7.json':'8006575658f320ba0db851af8e6f0251ac9935bb8d72790bf0b9f405594d4dd6',
    'data/protocol-public-v7.json':'8c5370eaf867b167663717b97e6c895b796dbb832b84375ef61ad3a5b4bed364',
}
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):return json.loads(path.read_text())
def module(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'scripts'/f'{name}.py')
    value=importlib.util.module_from_spec(spec);sys.modules[name]=value;spec.loader.exec_module(value);return value
def normalized(review):
    value=copy.deepcopy(review)
    value.pop('generatedAt',None);value.pop('cliEvidenceBootstrap',None)
    if 'summary' in value:value['summary'].pop('wallSeconds',None)
    return value
def stored_review(filename, fresh):
    stored=read(ROOT/'data'/filename)
    assert stored['valid'] is True and stored['readOnly'] is True and stored['fixture'] is False and stored['solverRuns']==0,filename
    for path,expected in stored['inputHashes'].items():assert sha(ROOT/path)==expected,path
    assert fresh['valid'] is True, fresh.get('errors')
    assert normalized(stored)==normalized(fresh),'Stored review differs from independent recomputation: '+filename
    return stored
def main(input_dir):
    module('restore-evidence-v6').ensure_evidence(ROOT)
    module('restore-evidence-v7').ensure_evidence(ROOT)
    subprocess.run(['node','scripts/build-view-v7.mjs','--ensure'],cwd=ROOT,check=True)
    for path,expected in FROZEN.items():assert sha(ROOT/path)==expected,path
    for snapshot in ['v7-first-run-source','public-v7-first-run-source']:
        directory=ROOT/'vendor/experiments'/snapshot
        manifest=read(directory/'manifest.json')
        for path,expected in manifest['implementationHashes'].items():
            assert sha(directory/path)==expected,path
            assert sha(ROOT/path)==expected,path
    rolling=stored_review('rolling-review-v7.json',module('review-rolling-v7').review(ROOT))
    bootstrap=rolling['cliEvidenceBootstrap']
    assert bootstrap['existingEvidenceReplaced'] is False
    assert type(bootstrap['canonicalArchiveRestoredBeforeReadOnlyReview']) is bool
    assert bootstrap['transportManifestSha256']==sha(ROOT/'data/archives-v7/rolling-v7/manifest.json')
    assert bootstrap['restoreImplementationSha256']==sha(ROOT/'scripts/restore-evidence-v7.py')
    assert bootstrap['canonicalSha256']==FROZEN['data/rolling-v7.json'] and bootstrap['transportPartCount']==30
    module('fetch-public-v7').ensure_inputs(input_dir)
    stored_review('public-resource-review-v7.json',module('review-public-resource-v7').review(input_dir))
    stored_review('port-ledger-review-v7.json',module('review-port-ledger-v7').review())
    for name in ['report-v7.zh.md','results-redteam-v7.md','submission-v7.ko.md','defense-v7.ko.html','defense-v7.ko.pdf','defense-v7.en.md','contribution-log-v7.md']:
        assert (ROOT/'docs'/name).is_file(),name
    # V6 verification preserves older evidence and runs the full current test suite once.
    result=module('verify-release-v6').main()
    assert result==0,'Historical evidence or current tests failed'
    print(json.dumps({'release':'PortPlan V7','firstRunArchives':'immutable','threeIndependentLedgers':'passed','sourceSnapshots':'identical','historicalEvidence':'passed','tests':'passed','formalExperimentsRerun':False}))
    return 0
if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-dir',type=Path,default=Path('/tmp/portplan-v7-psplib'))
    sys.exit(main(parser.parse_args().input_dir))
