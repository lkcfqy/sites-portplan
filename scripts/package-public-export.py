"""Package only this inspected public-source checkout, never its Git history or runtime data."""
from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
import hashlib,json,gzip
root=Path(__file__).resolve().parents[1]
out=root/'public/downloads';out.mkdir(parents=True,exist_ok=True)
skip={'.git','node_modules','public','dist','.cache','__pycache__','.venv','venv'}
groups={k:[] for k in ['source','evidence','experiments-v6','experiments-v7','public-inputs-v6','solver-source']}
compressed=set(json.loads((root/'PUBLIC_EXPORT_OMISSIONS.json').read_text())['losslessly_compressed_json'])
for p in sorted(root.rglob('*')):
 rel=p.relative_to(root)
 if any(part in skip for part in rel.parts) or not p.is_file():continue
 if p.is_symlink():raise RuntimeError('Refusing symlink')
 if p.name.startswith('.env') and p.name!='.env.example':raise RuntimeError('Refusing environment file')
 f=rel.as_posix()
 if f in compressed:continue # avoid duplicated restored JSON
 if f.startswith('data/rolling-v6.json'):group='experiments-v6'
 elif f.startswith('data/rolling-v7.json'):group='experiments-v7'
 elif f.startswith('data/public/'):group='public-inputs-v6'
 elif f.startswith('vendor/source/'):group='solver-source'
 elif f.startswith('data/'):group='evidence'
 else:group='source'
 groups[group].append((p,f))
packages=[]
for group,files in groups.items():
 target=out/f'portplan-{group}.zip'
 with ZipFile(target,'w',ZIP_DEFLATED,compresslevel=6) as z:
  for p,f in files:z.write(p,'portplan/'+f)
 b=target.read_bytes();packages.append({'id':group,'file':target.name,'url':'/downloads/'+target.name,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'fileCount':len(files)})
recovery={'schemaVersion':'portplan-source-recovery-v11','archiveRoot':'portplan/','generatedAt':'2026-10-22','exportNote':'Sanitized v16 source snapshot, not all historical evidence. See PUBLIC_EXPORT_OMISSIONS.json.','startupCommands':['npm ci','npm run data:restore','npm run build','npm run dev'],'deploymentCredentialsIncluded':False,'gitHistoryIncluded':False}
(root/'public/data/source-recovery-v11.json').write_text(json.dumps(recovery,ensure_ascii=False,indent=2)+'\n')
for v in range(9,16):
 (root/f'public/data/download-packages-v{v}.json').write_text(json.dumps({'schemaVersion':f'portplan-v{v}-download-packages','recoveryRule':'Download all listed current-export packages into one parent; each uses portplan/. Run npm run data:restore for losslessly compressed results.','packages':packages,'sourceRecovery':recovery,'scope':'sanitized-current-source-export-not-all-historical-evidence'},ensure_ascii=False,indent=2)+'\n')
print(json.dumps({'sourceExportPackages':len(packages),'bytes':sum(p['bytes'] for p in packages)}))
