"""Restore a missing frozen archive from lossless Git chunks; never replace evidence."""
from pathlib import Path
import hashlib
import json
import re
import tempfile

ROOT=Path(__file__).resolve().parents[1]
RAW_SHA='a8b0d67f7ff5fbf3b27fe260ab8d9d17be331a9942df37704d8d8365546000c6'
RAW_BYTES=118230496
def file_sha(path):
    digest=hashlib.sha256()
    with path.open('rb')as stream:
        while block:=stream.read(1024*1024):digest.update(block)
    return digest.hexdigest()
def ensure_evidence(root=ROOT):
    root=Path(root);directory=root/'data/archives-v7/rolling-v7';target=root/'data/rolling-v7.json'
    manifest=json.loads((directory/'manifest.json').read_text())
    assert manifest['artifact']=='data/rolling-v7.json' and manifest['sha256']==RAW_SHA and manifest['bytes']==RAW_BYTES,'Frozen archive declaration changed'
    parts=manifest['parts'];count=(RAW_BYTES+3999999)//4000000
    assert len(parts)==count and len({p['file']for p in parts})==count,'Unexpected chunk coverage'
    exists=target.exists()
    if exists:assert target.stat().st_size==RAW_BYTES and file_sha(target)==RAW_SHA,'Existing evidence differs; refusing replacement'
    temporary=None;output=None;combined=hashlib.sha256();size=0
    try:
        if not exists:
            output=tempfile.NamedTemporaryFile(dir=target.parent,prefix='.rolling-v7-restore-',delete=False);temporary=Path(output.name)
        for index,part in enumerate(parts,1):
            assert re.fullmatch(r'part-\d{3}\.bin',part['file']) and part['file']==f'part-{index:03d}.bin','Invalid chunk path/order'
            path=directory/part['file'];assert path.stat().st_size==part['bytes'] and 0<part['bytes']<=4000000,'Invalid chunk size'
            digest=hashlib.sha256()
            with path.open('rb')as stream:
                while block:=stream.read(1024*1024):
                    digest.update(block);combined.update(block);size+=len(block)
                    if output:output.write(block)
            assert digest.hexdigest()==part['sha256'],'Chunk checksum differs: '+part['file']
        assert size==RAW_BYTES and combined.hexdigest()==RAW_SHA,'Recombined archive differs'
        if output:
            output.close();output=None;temporary.replace(target);temporary=None
        return {'restored':not exists,'archiveSha256':RAW_SHA,'partsVerified':len(parts),'existingEvidenceReplaced':False}
    finally:
        if output:output.close()
        if temporary:temporary.unlink(missing_ok=True)
if __name__=='__main__':print(json.dumps(ensure_evidence()))
