#!/usr/bin/env python3
"""Package a completed immutable V8 frozen source/run into SHA-bound Git chunks."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import shutil
import tarfile

ROOT = Path(__file__).resolve().parents[1]
CHUNK_BYTES = 3_500_000


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--frozen', type=Path)
    source.add_argument('--development', type=Path)
    parser.add_argument('--destination', type=Path)
    args = parser.parse_args()
    kind = 'development' if args.development else 'formal'
    frozen = (args.development or args.frozen).resolve()
    destination = (args.destination or ROOT / 'data/archives-v8' / kind).resolve()
    if destination.exists():
        raise ValueError('Refuse to overwrite a previous archived run')
    if kind == 'formal':
        manifest_path, index_path = frozen / 'manifest.json', frozen / 'first-run/complete.json'
        manifest, index = json.loads(manifest_path.read_text()), json.loads(index_path.read_text())
        if index['executionState'] != 'complete' or len(index['cases']) != 144:
            raise ValueError('Only a completed all-case V8 run may be archived')
        if manifest['protocolHash'] != index['protocolHash']:
            raise ValueError('Run protocol is not the frozen protocol')
        for case in index['cases']:
            artifact = case['inputArtifact']
            if digest(frozen / 'first-run' / artifact['path']) != artifact['sha256']:
                raise ValueError('Input artifact changed')
            for repeat in case['repeats']:
                for receipt in repeat['policies'].values():
                    artifact = receipt['artifact']
                    if digest(frozen / 'first-run' / artifact['path']) != artifact['sha256']:
                        raise ValueError('Episode artifact changed')
        scenario_count = 144
        episode_count = sum(len(r['policies']) for c in index['cases'] for r in c['repeats'])
    else:
        manifest_path, index_path = frozen / 'protocol.json', frozen / 'results.json'
        index = json.loads(index_path.read_text())
        review = json.loads((frozen / 'audit.json').read_text())
        if index['executionState'] != 'complete' or index['dataRole'] != 'development_only' or not review['valid'] or review['resultSHA256'] != digest(index_path):
            raise ValueError('Development result/review binding differs')
        for name, expected in index['implementationHashes'].items():
            original = (ROOT / name).resolve()
            if not original.is_relative_to(ROOT) or digest(original) != expected:
                raise ValueError('Development implementation bytes no longer match: ' + name)
            target = frozen / 'source' / name
            if target.exists() and digest(target) != expected:
                raise ValueError('Existing saved development source differs')
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists():
                shutil.copyfile(original, target)
        scenario_count, episode_count = index['taskCount'], len(index['results'])
    scratch = ROOT / f'artifacts/v8-{kind}-archive-payload.tar.gz'
    if scratch.exists():
        raise ValueError('Payload already exists; preserve previous archive')
    files = sorted(p for p in frozen.rglob('*') if p.is_file())
    if any(p.is_symlink() or not p.resolve().is_relative_to(frozen) for p in files):
        raise ValueError('Archive contains an escaping file/symlink')
    scratch.parent.mkdir(parents=True, exist_ok=True)
    with tarfile.open(scratch, 'w:gz', compresslevel=6) as archive:
        for path in files:
            archive.add(path, arcname=Path(frozen.name) / path.relative_to(frozen), recursive=False)
    destination.mkdir(parents=True, exist_ok=False)
    chunks = []
    with scratch.open('rb') as stream:
        for number in range(1, 100000):
            block = stream.read(CHUNK_BYTES)
            if not block:
                break
            name = f'part-{number:04d}.bin'
            path = destination / name
            path.write_bytes(block)
            chunks.append({'file': name, 'bytes': len(block), 'sha256': hashlib.sha256(block).hexdigest()})
    record = {'schemaVersion': 'portplan-v8-lossless-tar-chunks', 'kind': kind, 'createdAt': datetime.now(timezone.utc).isoformat(),
              'archiveFormat': 'tar.gz', 'archiveRoot': frozen.name, 'chunkSizeLimit': CHUNK_BYTES,
              'fileCount': len(files), 'uncompressedFileBytes': sum(p.stat().st_size for p in files),
              'archiveBytes': scratch.stat().st_size, 'archiveSha256': digest(scratch),
              'frozenManifestSha256': digest(manifest_path), 'entrypoint': str(index_path.relative_to(frozen)),
              'entrypointSha256': digest(index_path), 'formalIndexSha256': digest(index_path) if kind == 'formal' else None,
              'protocolHash': index['protocolHash'], 'scenarioCount': scenario_count,
              'episodeCount': episode_count, 'chunks': chunks}
    (destination / 'manifest.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in record.items() if k != 'chunks'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
