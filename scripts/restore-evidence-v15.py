#!/usr/bin/env python3
"""Restore declared V15 development records; never run a planner or rewrite evidence."""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path, PurePosixPath
import re
import stat

ROOT = Path(__file__).resolve().parents[1]
CHUNK_LIMIT = 3_500_000


def require(value, message):
    if not value:
        raise ValueError(message)


def canonical(value):
    require(isinstance(value, str) and value and '\\' not in value and '\x00' not in value, 'Invalid archive path')
    path = PurePosixPath(value)
    require(path.parts and not path.is_absolute() and path.as_posix() == value and '..' not in path.parts, 'Unsafe archive path')
    return path


def regular(path):
    path = Path(path).absolute()
    current = Path(path.anchor)
    for index, component in enumerate(path.parts[1:]):
        current = current / component
        mode = current.lstat().st_mode
        require(not stat.S_ISLNK(mode), 'Manifest/chunk path cannot contain symlinks')
        require(stat.S_ISREG(mode) if index == len(path.parts) - 2 else stat.S_ISDIR(mode), 'Nonregular manifest/chunk path')
    return path


def receipt(item):
    require(type(item.get('bytes')) is int and item['bytes'] >= 0 and
            isinstance(item.get('sha256'), str) and re.fullmatch('[0-9a-f]{64}', item['sha256']), 'Invalid byte/SHA receipt')
    return item


def validate_manifest(manifest):
    manifest = regular(manifest)
    record = json.loads(manifest.read_text())
    require(record.get('schemaVersion') == 'portplan-v12-lossless-tar-chunks' and record.get('kind') == 'development' and
            record.get('archiveFormat') == 'tar.xz' and record.get('compression') == 'xz-lzma2-preset6',
            'Only the declared generic development XZ transport is accepted')
    root = canonical(record['archiveRoot'])
    require(len(root.parts) == 1 and root.name.startswith('v15-'), 'Only V15 development archive roots are accepted')
    files = record.get('files')
    require(isinstance(files, list) and files and len(files) == record.get('fileCount'), 'Complete per-file receipts are required')
    names = [canonical(receipt(item)['path']).as_posix() for item in files]
    require(len(set(names)) == len(names) and sum(item['bytes'] for item in files) == record.get('uncompressedFileBytes'),
            'Development file coverage/byte total differs')
    entry = canonical(record['entrypoint']).as_posix()
    require(entry in names and files[names.index(entry)]['sha256'] == record.get('entrypointSha256'), 'Entrypoint receipt differs')
    if 'chunkSizeLimit' in record:
        require(type(record['chunkSizeLimit']) is int and record['chunkSizeLimit'] == CHUNK_LIMIT, 'Unexpected declared chunk size ceiling')
    chunks = record.get('chunks')
    require(isinstance(chunks, list) and chunks, 'Development chunks are required')
    for index, item in enumerate(chunks, 1):
        receipt(item)
        require(item.get('file') == f'part-{index:04d}.bin' and 0 < item['bytes'] <= CHUNK_LIMIT, 'Unexpected chunk name/size')
        regular(manifest.parent / item['file'])
    require(sum(item['bytes'] for item in chunks) == record.get('archiveBytes') and
            isinstance(record.get('archiveSha256'), str) and re.fullmatch('[0-9a-f]{64}', record['archiveSha256']),
            'Combined archive declaration differs')
    return manifest


def restore(manifest, destination):
    manifest = validate_manifest(manifest)
    # Reuse the frozen, audited same-filesystem transport without modifying it.
    spec = importlib.util.spec_from_file_location('portplan_v15_atomic_transport_v14', ROOT / 'scripts/restore-evidence-v14.py')
    transport = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(transport)
    result = transport.restore(manifest, destination)
    return {**result, 'schemaVersion': 'portplan-v15-development-restoration', 'developmentOnly': True,
            'evidenceEntrypoint': result['formalIndex'], 'latestFormalStudy': 'v14', 'optimizerRuns': 0,
            'scope': 'Exact saved V15 development/source records only. The inherited formalIndex key is an entrypoint alias, not a formal-study claim. No native replay, new sample or V14 raw restoration.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--destination', type=Path, default=ROOT / 'data/evidence-v15')
    args = parser.parse_args()
    print(json.dumps(restore(args.manifest, args.destination), ensure_ascii=False))


if __name__ == '__main__':
    main()
