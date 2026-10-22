// Lossless case-local ID dictionary for the browser projection. The full archive
// remains unchanged; decoding happens before rendering or execution export.
const CODEC='case-local-container-index-v1';
function transform(value,ids,encode){
  if(Array.isArray(value))return value.map(item=>transform(item,ids,encode));
  if(value===null||typeof value!=='object')return value;
  if(encode&&Object.hasOwn(value,'containerIndex'))throw new Error('Reserved containerIndex collision');
  const output={};
  for(const [key,item]of Object.entries(value)){
    if(encode&&key==='id'&&ids.has(item)){
      output.containerIndex=ids.get(item);
    }else if(!encode&&key==='containerIndex'){
      if(Object.hasOwn(value,'id')||!Number.isInteger(item)||item<0||item>=ids.length)throw new Error('Invalid container index');
      output.id=ids[item];
    }else Object.defineProperty(output,key,{value:transform(item,ids,encode),enumerable:true,writable:true,configurable:true});
  }
  return output;
}
function mapCases(view,encode){
  const cases=items=>items.map(c=>{
    const ids=c.nominalScenario.containers.map(box=>box.id);
    if(!ids.every(id=>typeof id==='string'&&id.length>0))throw new Error('Container dictionary has invalid IDs');
    if(new Set(ids).size!==ids.length)throw new Error('Container dictionary has duplicate IDs');
    return {...c,policies:transform(c.policies,encode?new Map(ids.map((id,i)=>[id,i])):ids,encode)};
  });
  return {...view,cases:cases(view.cases),developmentControls:{...view.developmentControls,cases:cases(view.developmentControls.cases)}};
}
export function encodeRollingViewV6(view){
  if(view.containerIdEncoding)throw new Error('View already encoded');
  return {...mapCases(view,true),containerIdEncoding:CODEC};
}
export function decodeRollingViewV6(view){
  if(!view.containerIdEncoding)return view;
  if(view.containerIdEncoding!==CODEC)throw new Error('Unsupported container ID encoding');
  const decoded=mapCases(view,false);delete decoded.containerIdEncoding;return decoded;
}
