/** Transport aliases only. Original JSON bytes remain in source/evidence ZIPs. */
export const GZIP_EVIDENCE_FILES=Object.freeze([
  'rolling-v6-view.json','benchmark-v2.json',
  'rolling-v5.json','benchmark-v5.json','certificate-input-v5.json','certificate-v5.json',
  'rolling-v4.json','public-resource-v7.json','rolling-v7-view.json',
  'benchmark-v4.json','certificate-v4.json','benchmark.json','robustness-v2.json',
]);
const compressed=new Set(GZIP_EVIDENCE_FILES);
export function evidenceTransportPath(path){
  if(typeof path!=='string')return path;
  const match=/^\/data\/([^/?#]+\.json)([?#].*)?$/.exec(path);
  return match&&compressed.has(match[1])?`/data/${match[1]}.gz${match[2]??''}`:path;
}
