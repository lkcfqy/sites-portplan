#!/usr/bin/env python3
"""Losslessly retain explicitly listed development records; never solve or rerun."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import tarfile

ROOT=Path(__file__).resolve().parents[1]
CHUNK_BYTES=3_500_000

def digest(path):
    h=hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''):h.update(block)
    return h.hexdigest()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--paths-file',type=Path,required=True)
    parser.add_argument('--destination',type=Path,required=True)
    parser.add_argument('--archive-root',required=True)
    parser.add_argument('--entrypoint',required=True)
    args=parser.parse_args()
    if Path(args.archive_root).name!=args.archive_root or not args.archive_root or args.archive_root in ('.','..'):
        raise ValueError('Archive root must be a simple directory name')
    destination=args.destination.resolve()
    if destination.exists():raise ValueError('Preserve existing development archive; use a new destination')
    names=json.loads(args.paths_file.read_text())
    if not isinstance(names,list) or not names or len(set(names))!=len(names):raise ValueError('Require unique explicit relative paths')
    records=[]
    for name in sorted(names):
        rel=Path(name)
        if rel.is_absolute() or '..' in rel.parts or name!=rel.as_posix():raise ValueError('Unsafe source path')
        path=ROOT/rel
        if not path.is_file() or not path.resolve().is_relative_to(ROOT) or any(parent.is_symlink() for parent in [path,*path.parents] if parent!=ROOT.parent):
            raise ValueError('Missing or linked source file: '+name)
        if any(part in ('.git','.openai','node_modules','.venv','.venvs') or part.startswith('.env') for part in rel.parts):
            raise ValueError('Runtime/private settings are not development evidence')
        records.append({'path':name,'bytes':path.stat().st_size,'sha256':digest(path)})
    if args.entrypoint not in names:raise ValueError('Entrypoint must be among the preserved files')
    scratch=ROOT/'artifacts'/(args.archive_root+'-payload.tar.xz')
    scratch.parent.mkdir(parents=True,exist_ok=True)
    if scratch.exists():raise ValueError('Preserve prior transport payload')
    with tarfile.open(scratch,'w:xz',preset=6) as archive:
        for record in records:archive.add(ROOT/record['path'],arcname=Path(args.archive_root)/record['path'],recursive=False)
    for record in records:
        if digest(ROOT/record['path'])!=record['sha256']:raise ValueError('Source changed during archival')
    destination.mkdir(parents=True,exist_ok=False)
    chunks=[]
    with scratch.open('rb') as stream:
        while block:=stream.read(CHUNK_BYTES):
            name=f'part-{len(chunks)+1:04d}.bin';(destination/name).write_bytes(block)
            chunks.append({'file':name,'bytes':len(block),'sha256':hashlib.sha256(block).hexdigest()})
    entry=next(record for record in records if record['path']==args.entrypoint)
    result={'schemaVersion':'portplan-v12-lossless-tar-chunks','kind':'development','createdAt':datetime.now(timezone.utc).isoformat(),
        'archiveFormat':'tar.xz','compression':'xz-lzma2-preset6','archiveRoot':args.archive_root,'fileCount':len(records),
        'uncompressedFileBytes':sum(record['bytes'] for record in records),'archiveBytes':scratch.stat().st_size,
        'archiveSha256':digest(scratch),'entrypoint':args.entrypoint,'entrypointSha256':entry['sha256'],'files':records,'chunks':chunks,
        'scope':'Exact development/source/failed-attempt transport only; no new samples, optimizer calls, formal validation or revised outcomes.'}
    (destination/'manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in result.items() if k not in ('files','chunks')}))

if __name__=='__main__':main()
