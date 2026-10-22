import hashlib,importlib.util,io,json,lzma,subprocess,sys,tarfile,tempfile,unittest
from pathlib import Path
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('restore_v14',Path(__file__).resolve().parents[1]/'scripts/restore-evidence-v14.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
def sha(raw):return hashlib.sha256(raw).hexdigest()
class RestoreTests(unittest.TestCase):
    def setUp(self):self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name)
    def tearDown(self):self.tmp.cleanup()
    def manifest(self,bad_member=None,bad_receipt=False):
        files={'first-run/complete.json':b'{"executionState":"complete"}\n','source/one.py':b'print("retained source")\n'}
        stream=io.BytesIO()
        with tarfile.open(fileobj=stream,mode='w') as t:
            for name,raw in files.items():
                i=tarfile.TarInfo(bad_member if bad_member and name=='source/one.py' else 'proof-root/'+name);i.size=len(raw);t.addfile(i,io.BytesIO(raw))
        raw=lzma.compress(stream.getvalue());part=self.root/'part-0001.bin';part.write_bytes(raw)
        entries=[{'path':n,'bytes':len(b),'sha256':sha(b)} for n,b in files.items()]
        if bad_receipt:entries[0]['sha256']='0'*64
        record={'schemaVersion':'portplan-v12-lossless-tar-chunks','archiveFormat':'tar.xz','compression':'xz-lzma2-preset6','archiveRoot':'proof-root','fileCount':len(files),'uncompressedFileBytes':sum(map(len,files.values())),'archiveBytes':len(raw),'archiveSha256':sha(raw),'entrypoint':'first-run/complete.json','entrypointSha256':sha(files['first-run/complete.json']),'chunks':[{'file':part.name,'bytes':len(raw),'sha256':sha(raw)}],'files':entries}
        p=self.root/'manifest.json';p.write_text(json.dumps(record));return p,files
    def test_fresh_atomic_and_identical_idempotent(self):
        p,files=self.manifest();dest=self.root/'out';r=module.restore(p,dest);self.assertTrue(r['atomicFreshInstall']);self.assertTrue(r['singleStagedRawCopy'])
        for n,b in files.items():self.assertEqual((dest/'proof-root'/n).read_bytes(),b)
        self.assertFalse(module.restore(p,dest)['atomicFreshInstall']);self.assertFalse(list(dest.glob('.portplan-v14-stage-*')))
    def test_existing_changed_bytes_preserved(self):
        p,_=self.manifest();dest=self.root/'out';module.restore(p,dest);target=dest/'proof-root/source/one.py';target.write_bytes(b'changed')
        with self.assertRaisesRegex(ValueError,'refusing replacement'):module.restore(p,dest)
        self.assertEqual(target.read_bytes(),b'changed')
    def test_wrong_complete_inventory_rejected_before_install(self):
        p,_=self.manifest(bad_receipt=True);dest=self.root/'out'
        with self.assertRaisesRegex(ValueError,'Staged file SHA'):module.restore(p,dest)
        self.assertFalse((dest/'proof-root').exists())
    def test_unsafe_member_rejected(self):
        p,_=self.manifest(bad_member='proof-root/../escape');dest=self.root/'out'
        with self.assertRaisesRegex(ValueError,'unsafe archive member'):module.restore(p,dest)
        self.assertFalse((dest/'escape').exists());self.assertFalse((dest/'proof-root').exists())
    def test_existing_symlink_and_extra_file_rejected(self):
        p,_=self.manifest();dest=self.root/'out';module.restore(p,dest);(dest/'proof-root/extra').write_bytes(b'unexpected')
        with self.assertRaisesRegex(ValueError,'coverage differs'):module.restore(p,dest)
        (dest/'proof-root/extra').unlink();(dest/'proof-root/source/one.py').unlink();(dest/'proof-root/source/one.py').symlink_to(p)
        with self.assertRaisesRegex(ValueError,'Unsafe existing evidence'):module.restore(p,dest)
    def test_destination_component_and_cli_symlinks_rejected(self):
        p,_=self.manifest();outside=self.root/'outside';outside.mkdir();alias=self.root/'alias';alias.symlink_to(outside,target_is_directory=True)
        for dest in (alias,alias/'new-child'):
            with self.assertRaisesRegex(ValueError,'components cannot be symlinks'):module.restore(p,dest)
            result=subprocess.run([sys.executable,'-B',str(Path(module.__file__)),'--manifest',str(p),'--destination',str(dest)],capture_output=True,text=True)
            self.assertNotEqual(result.returncode,0);self.assertIn('components cannot be symlinks',result.stderr)
        self.assertEqual(list(outside.iterdir()),[])
if __name__=='__main__':unittest.main()
