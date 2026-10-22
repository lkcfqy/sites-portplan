import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {fetchEvidenceJson,evidenceTransportPath} from '../src/evidence-transport.js';
import {GZIP_EVIDENCE_FILES} from '../src/evidence-paths-v12.js';

const document={version:10,note:'完整证据与失败均保留',values:[0,null,false]};
const json=JSON.stringify(document);
const response=(bytes,options={})=>async()=>new Response(bytes,options);

test('historical aliases preserve query/fragment and never rewrite unrelated or external requests',()=>{
  for(const name of GZIP_EVIDENCE_FILES){
    assert.equal(evidenceTransportPath('/data/'+name),'/data/'+name+'.gz');
    assert.equal(evidenceTransportPath('/data/'+name+'?v=12#raw'),'/data/'+name+'.gz?v=12#raw');
    assert.equal(evidenceTransportPath('/data/'+name+'.gz'),'/data/'+name+'.gz');
    assert.equal(evidenceTransportPath('https://elsewhere.example/data/'+name),'https://elsewhere.example/data/'+name);
  }
  assert.equal(evidenceTransportPath('/data/v10-results.json'),'/data/v10-results.json');
  const request=new Request('https://example.com/data/benchmark-v5.json');assert.equal(evidenceTransportPath(request),request);
});

test('logical historical paths fetch the lossless gzip transport and parse the same evidence',async()=>{
  let requested;
  const result=await fetchEvidenceJson('/data/benchmark-v5.json',{fetcher:async path=>{requested=path;return new Response(gzipSync(json));}});
  assert.equal(requested,'/data/benchmark-v5.json.gz');assert.deepEqual(result,document);
});

test('gzip bytes decode through DecompressionStream and preserve JSON values',async()=>{
  let pathSeen;
  const value=await fetchEvidenceJson('/data/evidence.json.gz',{fetcher:async path=>{pathSeen=path;return new Response(gzipSync(json));}});
  assert.equal(pathSeen,'/data/evidence.json.gz');assert.deepEqual(value,document);
});

test('HTTP-decoded plain JSON never gets decompressed twice despite URL and encoding header',async()=>{
  let decompressions=0;
  class ForbiddenDecompressor{constructor(){decompressions++;throw new Error('Plain bytes must not be decompressed.');}}
  const value=await fetchEvidenceJson('/data/evidence.json.gz',{fetcher:response(json,{headers:{'content-encoding':'gzip'}}),Decompressor:ForbiddenDecompressor});
  assert.deepEqual(value,document);assert.equal(decompressions,0);
});

test('plain JSON remains readable without gzip support, including a UTF-8 BOM',async()=>{
  const value=await fetchEvidenceJson('/data/plain.json',{fetcher:response('\ufeff'+json),Decompressor:null});
  assert.deepEqual(value,document);
});

test('HTTP failure rejects before consuming or parsing its body',async()=>{
  let bodyRead=false;
  await assert.rejects(fetchEvidenceJson('/missing.json.gz',{fetcher:async()=>({ok:false,status:404,arrayBuffer:async()=>{bodyRead=true;return new ArrayBuffer(0);}})}),/HTTP 404/);
  assert.equal(bodyRead,false);
});

test('corrupt gzip, invalid decompressed JSON and invalid plain JSON never appear successful',async()=>{
  await assert.rejects(fetchEvidenceJson('/bad.gz',{fetcher:response(Uint8Array.from([0x1f,0x8b,0,0,0,0,0,0]))}),/gzip/);
  await assert.rejects(fetchEvidenceJson('/bad-json.gz',{fetcher:response(gzipSync('not JSON'))}),/gzip.*JSON/);
  await assert.rejects(fetchEvidenceJson('/plain.json',{fetcher:response('not JSON')}),SyntaxError);
  const corrupted=Buffer.from(gzipSync(json));corrupted[corrupted.length-8]^=0xff;
  await assert.rejects(fetchEvidenceJson('/bad-crc.gz',{fetcher:response(corrupted)}),/gzip/);
});

test('a real gzip file without DecompressionStream gives browser and offline recovery guidance',async()=>{
  await assert.rejects(fetchEvidenceJson('/data/evidence.json.gz',{fetcher:response(gzipSync(json)),Decompressor:null}),error=>/DecompressionStream/.test(error.message)&&/浏览器/.test(error.message)&&/ZIP.*原 JSON/.test(error.message));
  await assert.rejects(fetchEvidenceJson('/data/evidence.json.gz',{fetcher:null}),/fetch.*ZIP/);
});
