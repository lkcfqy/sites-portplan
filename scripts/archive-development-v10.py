#!/usr/bin/env python3
"""Preserve every reused-development receipt after its independent review."""
import argparse
import hashlib
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parents[1]
def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', type=Path, required=True)
    parser.add_argument('--review', type=Path, required=True)
    args = parser.parse_args()
    directory = args.run.resolve()
    index_path = directory / 'complete.json'
    index, review = json.loads(index_path.read_text()), json.loads(args.review.read_text())
    assert index['executionState'] == 'complete' and index['dataRole'] == 'reused-development-not-new-validation'
    assert len(index['records']) == 54
    assert review['valid'] is True and review['inputIndexSha256'] == digest(index_path)
    for r in index['records']:
        p = (directory / r['artifact']['path']).resolve()
        assert p.is_relative_to(directory) and digest(p) == r['artifact']['sha256']
    for name, expected in index['implementationHashes'].items():
        p = (directory / 'source' / name).resolve()
        assert p.is_relative_to(directory / 'source') and digest(p) == expected
    destination = ROOT / 'data/archives-v10/development'
    assert not destination.exists(), 'Preserve the existing development archive'
    payload = ROOT / 'artifacts/v10-development-payload.tar.gz'
    assert not payload.exists(), 'Preserve the existing transport payload'
    files = sorted(p for p in directory.rglob('*') if p.is_file())
    assert all(not p.is_symlink() and p.resolve().is_relative_to(directory) for p in files)
    with tarfile.open(payload, 'w:gz', compresslevel=6) as archive:
        for p in files:
            archive.add(p, arcname=Path(directory.name) / p.relative_to(directory), recursive=False)
    destination.mkdir(parents=True, exist_ok=False)
    chunks = []
    with payload.open('rb') as stream:
        while block := stream.read(3500000):
            name = f'part-{len(chunks)+1:04d}.bin'
            (destination / name).write_bytes(block)
            chunks.append({'file': name, 'bytes': len(block), 'sha256': hashlib.sha256(block).hexdigest()})
    record = {'schemaVersion': 'portplan-v10-lossless-tar-chunks', 'kind': 'reused-development-not-new-validation',
        'archiveFormat': 'tar.gz', 'archiveRoot': directory.name, 'entrypoint': 'complete.json',
        'entrypointSha256': digest(index_path), 'archiveBytes': payload.stat().st_size,
        'archiveSha256': digest(payload), 'fileCount': len(files),
        'uncompressedFileBytes': sum(p.stat().st_size for p in files), 'scenarioCount': 18,
        'episodeCount': 54, 'reviewSha256': digest(args.review), 'chunks': chunks}
    (destination / 'manifest.json').write_text(json.dumps(record, indent=2) + '\n')
    print(json.dumps({'archiveBytes': record['archiveBytes'], 'chunks': len(chunks), 'role': record['kind']}))

if __name__ == '__main__':
    main()
