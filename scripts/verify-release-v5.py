"""Read-only release verification; never rerun or replace frozen experiments."""
from pathlib import Path
import hashlib
import json
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
FROZEN = {
    'data/protocol-v5.json': '7cfee99b5522236c3fd70a13b4fcbf11e2273d0c0cd3dd887465608c1f1c2109',
    'data/benchmark-v5.json': 'd04e704749b8b93449aaa6ce8270959a52c4d9eefdb21926e37c7ff694ee754e',
    'data/rolling-v5.json': '482f6f8df7f0d46cf7d8b0356961c1aaf787f5e9f1566db7e18ce7c1afa23592',
    'data/certificate-input-v5.json': '2da426c32bf0eebb501c8ed97af2c51a1f63e4b549415faf9fc750335e372639',
    'data/certificate-v5.json': '70744bf584ba3a6709a24b02b90428f4f55217eb07adf9dcfc7fe5c88e6021fb',
    'data/benchmark-v4.json': '96f7cd638535391ba78c191c7d4d9681746d799360234c3818d4a123862de3af',
    'data/rolling-v4.json': '0f7aa70153dc39035527660ca6ed3c464da580a9bd87aa1f1c3ec0c307c67aa3',
    'data/certificate-v4.json': 'dd77a4ed9c694ad0f857237c08601170b81354b35e17a36859904f0d8dd5d999',
}

def main():
    for path, expected in FROZEN.items():
        assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest() == expected, path
    result = subprocess.run([sys.executable, 'scripts/review-v5.py'], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        print(result.stdout); print(result.stderr, file=sys.stderr)
        return result.returncode
    review = json.loads(result.stdout)
    assert review['valid'], review
    print(json.dumps({'readonlyIndependentReview': 'passed', 'frozenV4AndV5Hashes': 'verified'}, ensure_ascii=False))
    for path in ['docs/report-v5.zh.md', 'docs/submission-v5.ko.md', 'docs/defense-v5.ko.html',
                 'docs/defense-v5.ko.pdf', 'docs/defense-v5.en.md', 'docs/reviewer-v5.md',
                 'docs/contribution-log-v5.md', 'docs/results-redteam-v5.md']:
        assert (ROOT/path).is_file(), path
    tests = sorted(str(p.relative_to(ROOT)) for p in (ROOT/'tests').glob('*.test.mjs'))
    result = subprocess.run(['node', '--test', *tests], cwd=ROOT, capture_output=True, text=True)
    if result.returncode:
        print(result.stdout); print(result.stderr, file=sys.stderr)
        return result.returncode
    print('\n'.join(result.stdout.strip().splitlines()[-8:]))
    print(json.dumps({'release': 'PortPlan V5', 'tests': 'passed', 'researchRerun': False}, ensure_ascii=False))
    return 0

if __name__ == '__main__':
    sys.exit(main())
