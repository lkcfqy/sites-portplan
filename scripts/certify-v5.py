#!/usr/bin/env python3
"""Bind the independently implemented V4 certifier to V5 main and budget-control archives."""
import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, default=ROOT/'data/benchmark-v5.json')
    parser.add_argument('--input', type=Path, default=ROOT/'artifacts/certificate-input-v5-reproduction.json')
    parser.add_argument('--output', type=Path, default=ROOT/'artifacts/certificate-v5-reproduction.json')
    parser.add_argument('--time-limit', type=float, default=2)
    parser.add_argument('--record-first-run', action='store_true')
    args = parser.parse_args()
    archive, input_path, output = (p.resolve() for p in (args.archive, args.input, args.output))
    frozen = {ROOT/'data/certificate-input-v5.json', ROOT/'data/certificate-v5.json'}
    if (input_path in frozen or output in frozen) and not args.record_first_run:
        parser.error('Frozen first-run paths require --record-first-run; use artifacts/ for reproduction')
    if input_path == output or archive in (input_path, output):
        parser.error('Archive, input and output must be different files')
    if input_path.exists() or output.exists():
        parser.error('Refusing to replace an existing certificate input or outcome')
    data = json.loads(archive.read_text())
    if data.get('executionState') != 'complete':
        parser.error('Both main and control archives must be complete')
    primary, controls = data['cases'], data['scaleControls']['cases']
    assert len(primary) == 36 and len(controls) == 6
    payload = {
        'schemaVersion': 'portplan-certificate-input-v5',
        'originArchiveSha256': digest(archive),
        'protocolSha256': digest(ROOT/'data/protocol-v5.json'),
        'primaryCaseIds': [c['id'] for c in primary],
        'scaleControlCaseIds': [c['id'] for c in controls],
        'scope': '36 primary instances plus 6 repeated-input budget controls; not 42 independent scenarios',
        'cases': primary + controls,
    }
    input_path.parent.mkdir(parents=True, exist_ok=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    input_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
    temporary = output.with_suffix(output.suffix+'.incomplete')
    if temporary.exists():
        parser.error('An incomplete outcome exists; inspect it before starting another run')
    command = [sys.executable, str(ROOT/'scripts/certify-v4.py'), '--input', str(input_path),
               '--output', str(temporary), '--max-cases', '42', '--time-limit', str(args.time_limit)]
    result = subprocess.run(command, cwd=ROOT)
    if not temporary.exists():
        return result.returncode or 1
    certificate = json.loads(temporary.read_text())
    certificate['evidenceBindings'] = {
        'originArchiveSha256': payload['originArchiveSha256'],
        'protocolSha256': payload['protocolSha256'],
        'primaryCaseIds': payload['primaryCaseIds'],
        'scaleControlCaseIds': payload['scaleControlCaseIds'],
        'independentPrimaryScenarioCount': 36,
        'repeatedInputBudgetControlCount': 6,
        'implementationSha256': digest(ROOT/'scripts/certify-v4.py'),
        'wrapperSha256': digest(Path(__file__)),
        'scope': payload['scope'],
    }
    output.write_text(json.dumps(certificate, ensure_ascii=False, indent=2, allow_nan=False)+'\n')
    temporary.unlink()
    return result.returncode

if __name__ == '__main__':
    sys.exit(main())
