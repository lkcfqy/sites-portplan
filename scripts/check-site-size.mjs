#!/usr/bin/env node
/** Check both observed Sites limits against the complete final Vite output. */
import {readdir,stat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';

const root=resolve(import.meta.dirname,'..'),directory=resolve(root,'dist');
const perFileLimit=25*1024*1024,expandedLimit=256*1024*1024;
let fileCount=0,assetBytes=0,paddedTarBytes=10240;
async function walk(folder){
  for(const entry of await readdir(folder,{withFileTypes:true})){
    const path=resolve(folder,entry.name);
    if(entry.isDirectory()){paddedTarBytes+=512;await walk(path);}
    else if(entry.isFile()){
      const {size}=await stat(path);if(size>perFileLimit)throw Error('Sites 25 MiB single-file limit exceeded: '+relative(root,path));
      fileCount++;assetBytes+=size;paddedTarBytes+=512+512*Math.ceil(size/512);
    }else throw Error('Unexpected non-regular deployment asset: '+relative(root,path));
  }
}
await walk(directory);
const hostingBytes=(await stat(resolve(root,'.openai/hosting.json'))).size;
paddedTarBytes+=1024+512*Math.ceil(hostingBytes/512);
if(paddedTarBytes>expandedLimit)throw Error(`Sites 256 MiB expanded-archive limit exceeded: estimated ${paddedTarBytes} bytes`);
console.log(JSON.stringify({valid:true,fileCount,assetBytes,estimatedExpandedTarBytes:paddedTarBytes,expandedLimit,perFileLimit}));
