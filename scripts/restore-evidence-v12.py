#!/usr/bin/env python3
"""Restore exact V12 evidence from verified chunks without rerunning experiments."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import shutil
import tarfile
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def restore(manifest_path, destination):
    record = json.loads(manifest_path.read_text())
    if record['schemaVersion'] != 'portplan-v12-lossless-tar-chunks':
        raise ValueError('Unsupported archive declaration')
    if record.get('archiveFormat') != 'tar.xz' or record.get('compression') != 'xz-lzma2-preset6':
        raise ValueError('V12 requires its declared lossless XZ transport')
    if not record['archiveRoot'] or Path(record['archiveRoot']).name != record['archiveRoot']:
        raise ValueError('Invalid archive root')
    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='portplan-v12-restore-') as temporary:
        temporary = Path(temporary)
        compressed = temporary / 'evidence.tar.xz'
        with compressed.open('wb') as output:
            for item in record['chunks']:
                if Path(item['file']).name != item['file']:
                    raise ValueError('Invalid chunk name')
                path = manifest_path.parent / item['file']
                if path.stat().st_size != item['bytes'] or digest(path) != item['sha256']:
                    raise ValueError('Missing or changed evidence chunk: ' + item['file'])
                with path.open('rb') as stream:
                    shutil.copyfileobj(stream, output)
        if compressed.stat().st_size != record['archiveBytes'] or digest(compressed) != record['archiveSha256']:
            raise ValueError('Combined evidence archive SHA differs')
        staged = temporary / 'staged'
        staged.mkdir()
        with tarfile.open(compressed, 'r:xz') as archive:
            members = archive.getmembers()
            if len(members) != record['fileCount']:
                raise ValueError('Archive member count differs')
            seen = set()
            for member in members:
                path = Path(member.name)
                canonical = path.as_posix()
                if member.name != canonical or canonical in seen or member.issym() or member.islnk() or not member.isfile() or path.is_absolute() or '..' in path.parts or path.parts[0] != record['archiveRoot']:
                    raise ValueError('Unsupported or unsafe archive member')
                seen.add(canonical)
            if sum(m.size for m in members) != record['uncompressedFileBytes']:
                raise ValueError('Uncompressed evidence size differs')
            archive.extractall(staged, filter='data')
        entry = Path(record['entrypoint'])
        if entry.is_absolute() or '..' in entry.parts:
            raise ValueError('Invalid evidence entrypoint')
        staged_index = staged / record['archiveRoot'] / entry
        if digest(staged_index) != record['entrypointSha256']:
            raise ValueError('Staged evidence entrypoint SHA differs')
        replaced = False
        for path in staged.rglob('*'):
            if not path.is_file():
                continue
            target = destination / path.relative_to(staged)
            if not target.resolve().is_relative_to(destination.resolve()):
                raise ValueError('Existing destination symlink escapes evidence root')
            if target.exists() and digest(target) != digest(path):
                raise ValueError('Existing evidence differs; refusing replacement: ' + str(target))
        for path in staged.rglob('*'):
            if path.is_file():
                target = destination / path.relative_to(staged)
                if not target.exists():
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.copyfile(path, target)
        index = destination / record['archiveRoot'] / entry
        if digest(index) != record['entrypointSha256']:
            raise ValueError('Restored evidence entrypoint SHA differs')
    return {'restored': True, 'archiveSha256': record['archiveSha256'], 'fileCount': record['fileCount'],
            'existingEvidenceReplaced': replaced, 'formalIndex': str(index)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=ROOT / 'data/archives-v12/formal/manifest.json')
    parser.add_argument('--destination', type=Path, default=ROOT / 'data/evidence-v12')
    args = parser.parse_args()
    if not args.manifest.exists():
        raise ValueError('V12 archive not yet available; no fabricated or rerun evidence was created')
    print(json.dumps(restore(args.manifest.resolve(), args.destination.resolve()), ensure_ascii=False))


if __name__ == '__main__':
    main()

