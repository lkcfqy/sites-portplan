"""Fetch missing PSPLIB research-use originals; verify frozen hashes, never replace."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import tempfile
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PROTOCOL_SHA = '8c5370eaf867b167663717b97e6c895b796dbb832b84375ef61ad3a5b4bed364'

def ensure_inputs(directory=Path('/tmp/portplan-v7-psplib')):
    directory = Path(directory)
    raw = (ROOT/'data/protocol-public-v7.json').read_bytes()
    assert hashlib.sha256(raw).hexdigest() == PROTOCOL_SHA, 'Frozen public protocol changed'
    protocol = json.loads(raw)
    directory.mkdir(parents=True, exist_ok=True)
    verified = []
    for source in protocol['sources'].values():
        assert Path(source['filename']).name == source['filename']
        target = directory/source['filename']
        fetched = False
        if not target.exists():
            request = urllib.request.Request(source['url'], headers={'User-Agent':'PortPlan/7 research-reproduction'})
            with urllib.request.urlopen(request, timeout=45) as response:
                content = response.read(source['bytes']+1)
            assert len(content) == source['bytes'] and hashlib.sha256(content).hexdigest() == source['sha256'], 'Downloaded source differs: '+source['filename']
            with tempfile.NamedTemporaryFile(dir=directory, prefix='.verified-public-v7-', delete=False) as output:
                temporary = Path(output.name)
                output.write(content)
            try:
                # Exclusive creation also protects another caller's cache.
                os.link(temporary, target)
                fetched = True
            finally:
                temporary.unlink(missing_ok=True)
        content = target.read_bytes()
        assert len(content) == source['bytes'] and hashlib.sha256(content).hexdigest() == source['sha256'], 'Existing source differs; refusing replacement: '+source['filename']
        verified.append({'filename':source['filename'], 'sha256':source['sha256'], 'fetched':fetched})
    return {'cache':str(directory), 'verified':verified, 'researchUseAuthority':protocol['researchUseAuthority']['url'], 'rawSourcesRedistributed':False}

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-dir', type=Path, default=Path('/tmp/portplan-v7-psplib'))
    print(json.dumps(ensure_inputs(parser.parse_args().input_dir)))
