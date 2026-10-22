#!/usr/bin/env python3
"""Archive the completed, independently reviewed V10 first run without rerunning it."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import tarfile

ROOT = Path(__file__).resolve().parents[1]
CHUNK_BYTES = 3_500_000


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(part)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--frozen', type=Path, required=True)
    parser.add_argument('--destination', type=Path, default=ROOT / 'data/archives-v10/formal')
    parser.add_argument('--review', type=Path, default=ROOT / 'data/review-v10.json')
    parser.add_argument('--bootstrap-review', type=Path, default=ROOT / 'data/bootstrap-review-v10.json')
    args = parser.parse_args()
    frozen, destination = args.frozen.resolve(), args.destination.resolve()
    if destination.exists():
        raise ValueError('Refuse to overwrite an existing V10 archive')
    manifest_path, index_path = frozen / 'manifest.json', frozen / 'first-run/complete.json'
    manifest, index = json.loads(manifest_path.read_text()), json.loads(index_path.read_text())
    index_sha = digest(index_path)
    if index['executionState'] != 'complete' or len(index['cases']) != 144:
        raise ValueError('Only the completed 144-case first run can be archived')
    if manifest['protocolHash'] != index['protocolHash'] or manifest['protocol'] != index['protocol']:
        raise ValueError('Frozen protocol binding differs')
    methods = set(index['protocol']['methods'])
    episodes = 0
    for case in index['cases']:
        if len(case['repeats']) != 3:
            raise ValueError('Missing declared repeat')
        artifacts = [case['inputArtifact']]
        for repeat in case['repeats']:
            if set(repeat['policies']) != methods:
                raise ValueError('Per-repeat method coverage differs')
            artifacts.extend(receipt['artifact'] for receipt in repeat['policies'].values())
            episodes += len(repeat['policies'])
        for artifact in artifacts:
            path = (frozen / 'first-run' / artifact['path']).resolve()
            if not path.is_relative_to(frozen / 'first-run') or digest(path) != artifact['sha256']:
                raise ValueError('Changed or escaping raw artifact')
    if episodes != 2160:
        raise ValueError('Expected all 2160 method records')
    for name, expected in manifest['implementationHashes'].items():
        path = (frozen / 'source' / name).resolve()
        if not path.is_relative_to(frozen / 'source') or digest(path) != expected:
            raise ValueError('Frozen source changed: ' + name)
    reviews = {}
    for label, path in [('physical', args.review), ('bootstrap', args.bootstrap_review)]:
        record = json.loads(path.read_text())
        if record.get('valid') is not True or record.get('fixture') or record['inputIndexSha256'] != index_sha:
            raise ValueError('Missing or unbound independent ' + label + ' review')
        reviews[label] = digest(path)
    scratch = ROOT / 'artifacts/v10-formal-archive-payload.tar.gz'
    if scratch.exists():
        raise ValueError('Preserve the existing immutable transport payload')
    files = sorted(p for p in frozen.rglob('*') if p.is_file())
    if any(p.is_symlink() or not p.resolve().is_relative_to(frozen) for p in files):
        raise ValueError('Escaping source symlink')
    with tarfile.open(scratch, 'w:gz', compresslevel=6) as archive:
        for path in files:
            archive.add(path, arcname=Path(frozen.name) / path.relative_to(frozen), recursive=False)
    destination.mkdir(parents=True, exist_ok=False)
    chunks = []
    with scratch.open('rb') as stream:
        number = 0
        while block := stream.read(CHUNK_BYTES):
            number += 1
            name = f'part-{number:04d}.bin'
            (destination / name).write_bytes(block)
            chunks.append({'file': name, 'bytes': len(block), 'sha256': hashlib.sha256(block).hexdigest()})
    record = {'schemaVersion': 'portplan-v10-lossless-tar-chunks', 'kind': 'formal',
              'createdAt': datetime.now(timezone.utc).isoformat(), 'archiveFormat': 'tar.gz',
              'archiveRoot': frozen.name, 'chunkSizeLimit': CHUNK_BYTES, 'fileCount': len(files),
              'uncompressedFileBytes': sum(p.stat().st_size for p in files),
              'archiveBytes': scratch.stat().st_size, 'archiveSha256': digest(scratch),
              'frozenManifestSha256': digest(manifest_path), 'entrypoint': 'first-run/complete.json',
              'entrypointSha256': index_sha, 'formalIndexSha256': index_sha,
              'protocolHash': index['protocolHash'], 'scenarioCount': 144, 'episodeCount': episodes,
              'independentReviewSha256': reviews, 'chunks': chunks}
    (destination / 'manifest.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in record.items() if k != 'chunks'}))


if __name__ == '__main__':
    main()
