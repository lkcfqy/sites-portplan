#!/usr/bin/env python3
"""Restore exact V14 evidence through verified same-filesystem staging without reruns."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
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
    if not record['archiveRoot'] or record['archiveRoot'] in ('.','..') or Path(record['archiveRoot']).name != record['archiveRoot']:
        raise ValueError('Invalid archive root')
    # Inspect lexical components before canonicalizing: resolve() at the CLI
    # boundary would erase exactly the symlink the guard must reject.
    lexical=Path(destination)
    if not lexical.is_absolute():lexical=Path.cwd()/lexical
    current=Path(lexical.anchor)
    for component in lexical.parts[1:]:
        current=current/component
        if current.is_symlink():raise ValueError('Destination components cannot be symlinks')
    destination=current.resolve()
    destination.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.portplan-v14-stage-',dir=destination) as temporary:
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
        declared_files=record.get('files')
        if declared_files is not None:
            if not isinstance(declared_files,list) or len(declared_files)!=record['fileCount']:
                raise ValueError('Invalid complete file receipt inventory')
            by_name={item['path']:item for item in declared_files}
            if len(by_name)!=len(declared_files):raise ValueError('Duplicate file receipt')
            actual={str(path.relative_to(staged/record['archiveRoot'])):path for path in (staged/record['archiveRoot']).rglob('*') if path.is_file()}
            if set(actual)!=set(by_name):raise ValueError('Complete file receipt coverage differs')
            for name,path in actual.items():
                if path.stat().st_size!=by_name[name]['bytes'] or digest(path)!=by_name[name]['sha256']:
                    raise ValueError('Staged file SHA or size differs: '+name)
        replaced=False
        staged_root=staged/record['archiveRoot'];target_root=destination/record['archiveRoot']
        if target_root.is_symlink():raise ValueError('Target evidence root cannot be a symlink')
        if target_root.exists():
            staged_paths={p.relative_to(staged_root).as_posix():p for p in staged_root.rglob('*') if p.is_file()}
            target_paths={}
            for path in target_root.rglob('*'):
                if path.is_symlink() or not path.resolve().is_relative_to(target_root.resolve()):
                    raise ValueError('Unsafe existing evidence path')
                if path.is_file():target_paths[path.relative_to(target_root).as_posix()]=path
            if set(staged_paths)!=set(target_paths):raise ValueError('Existing evidence file coverage differs; refusing replacement')
            for name,path in staged_paths.items():
                if digest(path)!=digest(target_paths[name]):raise ValueError('Existing evidence differs; refusing replacement: '+name)
            atomic_install=False
        else:
            # The temporary staging directory lives inside destination, so this
            # rename needs only one full raw copy and cannot cross filesystems.
            os.rename(staged_root,target_root);atomic_install=True
        index=target_root/entry
        if digest(index)!=record['entrypointSha256']:raise ValueError('Restored evidence entrypoint SHA differs')
    return {'restored': True, 'archiveSha256': record['archiveSha256'], 'fileCount': record['fileCount'],
            'existingEvidenceReplaced': replaced, 'atomicFreshInstall':atomic_install, 'singleStagedRawCopy':True, 'formalIndex': str(index)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path, default=ROOT / 'data/archives-v14/formal/manifest.json')
    parser.add_argument('--destination', type=Path, default=ROOT / 'data/evidence-v14')
    args = parser.parse_args()
    if not args.manifest.exists():
        raise ValueError('V14 archive not yet available; no fabricated or rerun evidence was created')
    print(json.dumps(restore(args.manifest.resolve(), args.destination), ensure_ascii=False))


if __name__ == '__main__':
    main()

