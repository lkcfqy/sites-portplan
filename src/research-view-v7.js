import {decodeRollingViewV6} from './research-view-v6.js';

export const ROLLING_VIEW_V7_TRANSPORT='portplan-v7-gzip-base64-case-id-v1';
export const ROLLING_VIEW_V7_SCHEMA='portplan-rolling-v7-browser-transport-1';
const SHA=/^[a-f0-9]{64}$/;
const MAX_DECODED_BYTES=128*1024*1024;
async function verifyHash(bytes,expected,label){
  if(!globalThis.crypto?.subtle)return;
  const digest=await crypto.subtle.digest('SHA-256',bytes),actual=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  if(actual!==expected)throw new Error(label+' SHA-256 mismatch');
}

/** Decompress transport, verify it, then restore original container IDs. The
 * full execution/fee projection is returned without altering its evidence. */
export async function decodeRollingViewV7(wrapper){
  if(!wrapper||wrapper.schemaVersion!==ROLLING_VIEW_V7_SCHEMA||wrapper.transportCodec!==ROLLING_VIEW_V7_TRANSPORT)throw new Error('Unsupported V7 browser transport');
  if(!SHA.test(wrapper.sourceArchiveSha256??'')||!SHA.test(wrapper.projectionSha256??'')||!SHA.test(wrapper.compressedSha256??''))throw new Error('Invalid V7 transport checksum');
  if(!Number.isSafeInteger(wrapper.decodedBytes)||wrapper.decodedBytes<=0||wrapper.decodedBytes>MAX_DECODED_BYTES)throw new Error('Invalid V7 decoded byte count');
  if(typeof wrapper.payload!=='string'||!wrapper.payload.length||wrapper.payload.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(wrapper.payload))throw new Error('Invalid V7 base64 payload');
  if(typeof DecompressionStream!=='function'||typeof atob!=='function')throw new Error('This browser does not support the V7 compressed evidence viewer');
  const compressed=Uint8Array.from(atob(wrapper.payload),ch=>ch.charCodeAt(0));
  if(compressed.byteLength!==wrapper.compressedBytes)throw new Error('V7 compressed byte count mismatch');
  await verifyHash(compressed,wrapper.compressedSha256,'Compressed projection');
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const bytes=await new Response(stream).arrayBuffer();
  if(bytes.byteLength!==wrapper.decodedBytes)throw new Error('V7 decoded byte count mismatch');
  await verifyHash(bytes,wrapper.projectionSha256,'Projection');
  const projection=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(projection.schemaVersion!=='portplan-rolling-v7-ui-projection'||projection.sourceArchiveSha256!==wrapper.sourceArchiveSha256||projection.executionState!=='complete')throw new Error('V7 projection source binding differs');
  return decodeRollingViewV6(projection);
}
