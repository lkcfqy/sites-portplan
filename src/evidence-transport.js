import {evidenceTransportPath} from './evidence-paths-v12.js';
export {evidenceTransportPath} from './evidence-paths-v12.js';

/** Read plain JSON or gzip bytes, including responses already decoded by HTTP.
 * The magic bytes, rather than the URL or response headers, decide whether a
 * second decoding step is needed. Original evidence is never transformed. */
export async function fetchEvidenceJson(path,{fetcher=globalThis.fetch,Decompressor=globalThis.DecompressionStream}={}) {
  if(typeof fetcher!=='function')throw new Error('当前环境无法读取证据文件（fetch 不可用）。请下载源码/实验 ZIP 离线查看原 JSON。');
  const response=await fetcher(evidenceTransportPath(path));
  if(!response.ok)throw new Error(`读取证据失败：HTTP ${response.status} (${path})`);
  const buffer=await response.arrayBuffer(),bytes=new Uint8Array(buffer);
  if(bytes.length<2||bytes[0]!==0x1f||bytes[1]!==0x8b)return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(typeof Decompressor!=='function')throw new Error('当前浏览器不支持 gzip 证据解压。请使用支持 DecompressionStream 的浏览器，或下载源码/实验 ZIP 离线查看原 JSON。');
  try{
    const decoded=new Blob([buffer]).stream().pipeThrough(new Decompressor('gzip'));
    return await new Response(decoded).json();
  }catch(error){
    throw new Error(`gzip 证据解压或 JSON 解析失败 (${path})：${error instanceof Error?error.message:String(error)}`,{cause:error});
  }
}
