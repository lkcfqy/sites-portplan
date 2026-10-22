"""Verify the three downloadable packages preserve every distributable source file."""
from pathlib import Path
from zipfile import ZipFile
import hashlib
import json

ROOT=Path(__file__).resolve().parents[1]
SKIP={'node_modules','dist','.git','.openai','.cache','artifacts','__pycache__'}
PACKAGES=['portplan-source.zip','portplan-experiments-v6.zip','portplan-public-inputs-v6.zip']
def sha(data):return hashlib.sha256(data).hexdigest()
def main():
    files={path.relative_to(ROOT).as_posix():path for path in ROOT.rglob('*')
       if path.is_file() and path.relative_to(ROOT).parts[0]!='public'
       and not any(part in SKIP for part in path.relative_to(ROOT).parts) and not path.name.startswith('.env')}
    seen=set();receipt=[]
    for name in PACKAGES:
        archive=ROOT/'dist/downloads'/name
        assert archive.stat().st_size<25*1024*1024, f'Individual download exceeds asset limit: {name}'
        with ZipFile(archive)as zip:
            assert zip.testzip() is None,name
            members=zip.namelist();assert len(set(members))==len(members),name
            for member in members:
                assert member.startswith('portplan/') and '..' not in Path(member).parts,member
                relative=member.removeprefix('portplan/')
                assert relative in files and relative not in seen,relative
                assert sha(zip.read(member))==sha(files[relative].read_bytes()),f'Package differs from source: {relative}'
                seen.add(relative)
            receipt.append({'package':name,'bytes':archive.stat().st_size,'fileCount':len(members),'sha256':sha(archive.read_bytes())})
    assert seen==set(files),{'missing':sorted(set(files)-seen),'unexpected':sorted(seen-set(files))}
    excluded={'rolling-v6.json','rolling-certificates-v6.json'}
    for path in(ROOT/'data').glob('*.json'):
        target=ROOT/'dist/data'/path.name
        if path.name in excluded:assert not target.exists(),path.name
        else:assert target.read_bytes()==path.read_bytes(),path.name
    for path in(ROOT/'docs').iterdir():
        if path.suffix in {'.md','.json','.pdf','.txt'} or (path.name.startswith('defense-v')and path.suffix=='.html'):
            assert(ROOT/'dist/downloads'/path.name).read_bytes()==path.read_bytes(),path.name
    for path in(ROOT/'dist').rglob('*'):
        if path.is_file():assert path.stat().st_size<25*1024*1024,path
    print(json.dumps({'packages':receipt,'allDistributableFiles':len(files),'sourceByteCoverage':'complete','directEvidenceBytes':'identical','originalV6Archive':'lossless experiment package','maximumAssetBytes':max(p.stat().st_size for p in(ROOT/'dist').rglob('*')if p.is_file())},ensure_ascii=False))
if __name__=='__main__':main()
