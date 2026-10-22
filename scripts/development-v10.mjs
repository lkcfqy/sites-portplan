#!/usr/bin/env node
/** Reused V9 inputs only. This development replay is not a new holdout. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {runColdEpisodeV10,isCompleteV10} from './benchmark-v10.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2),oi=args.indexOf('--output');
if(!args.includes('--run')||oi<0||!args[oi+1])throw Error('Usage: node scripts/development-v10.mjs --run --output NEW_DIRECTORY');
const output=path.resolve(root,args[oi+1]);
try{await fs.access(output);throw Error('Preserve the existing development replay; use a new directory.');}catch(e){if(e.code!=='ENOENT')throw e;}
const oldRoot=path.join(root,'data/evidence-v9/v9-frozen-first/first-run'),indexBytes=await fs.readFile(path.join(oldRoot,'complete.json'));
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
const index=JSON.parse(indexBytes),protocolBytes=await fs.readFile(path.join(root,'data/protocol-v10.json')),protocol=JSON.parse(protocolBytes);
if(digest(indexBytes)!=='83d165a965e421af0ebc0b399f426eab3ae48eddc4a564374a6074f9edad7204')throw Error('Old development source index changed.');
const methods=['highsV8','stableHiGHSV10','adaptiveV9'],cases=[];
for(const panel of ['same-distribution','stress']){
 const eligible=index.cases.filter(c=>c.panel===panel&&c.scenarioRepeat===1);
 cases.push(...eligible.filter((_,i)=>i%2===0));
}
if(cases.length!==18)throw Error('Expected deterministic eighteen-case reused subset.');
const sources=['scripts/development-v10.mjs','scripts/episode-v10.worker.mjs','scripts/highs-planner-v10.mjs','scripts/highs-planner-v8.mjs','scripts/highs-service-v8.py','src/adaptive-planner-v9.js','src/candidate-delivery-v9.js','src/locked-recovery-v9.js','src/engine.js','src/rolling-plan.js'];
const implementationHashes={};for(const name of sources)implementationHashes[name]=digest(await fs.readFile(path.join(root,name)));
await fs.mkdir(output,{recursive:true});
const state={schemaVersion:'portplan-v10-reused-development',fixture:false,dataRole:'reused-development-not-new-validation',
 selectionRule:'Within each old V9 panel, scenarioRepeat=1, then indices 0,2,4,... in original declaration order; nine per panel, eighteen total.',
 scope:'Seen V9 scenarios, one prescribed old repeat seed39011, three methods; no new order generation or research interval.',
 originalIndexSha256:digest(indexBytes),protocolSha256:digest(protocolBytes),implementationHashes,startedAt:new Date().toISOString(),executionState:'running',records:[]};
await fs.writeFile(path.join(output,'declaration.json'),JSON.stringify({...state,caseIds:cases.map(c=>c.id)},null,2)+'\n',{flag:'wx'});
for(const [i,c]of cases.entries()){
 const inputBytes=await fs.readFile(path.join(oldRoot,c.inputArtifact.path));if(digest(inputBytes)!==c.inputArtifact.sha256)throw Error('Changed old input artifact.');
 const source=JSON.parse(inputBytes),methodsInOrder=methods.map((_,j)=>methods[(i+j)%methods.length]);
 for(const method of methodsInOrder){
  const input={method,episodeId:`v10-dev-${c.id}-${method}`,nominalScenario:source.nominalScenario,events:source.events,
   algorithmSeed:39011,repeatIndex:1,callBudgets:protocol.callBudgets};
  const result=await runColdEpisodeV10(input,{hardWallMs:5000});
  const name=`episode-${String(state.records.length+1).padStart(3,'0')}.json`;
  const bytes=JSON.stringify({input,result},null,2)+'\n';await fs.writeFile(path.join(output,name),bytes,{flag:'wx'});
  state.records.push({scenarioId:c.id,panel:c.panel,method,inputSha256:digest(inputBytes),artifact:{path:name,sha256:digest(bytes)},complete:isCompleteV10(result),status:result.status,totalCost:result.totalCost,incrementalCost:result.incrementalCost,revisionCount:result.revisionCount});
  await fs.writeFile(path.join(output,'checkpoint.json'),JSON.stringify(state,null,2)+'\n');
  console.log(`${state.records.length}/54 ${method} ${c.id} ${result.status} complete=${isCompleteV10(result)}`);
 }
}
for(const [name,hash]of Object.entries(implementationHashes))if(digest(await fs.readFile(path.join(root,name)))!==hash)throw Error('Development source changed during replay; retain raw but do not treat it as stable: '+name);
state.completedAt=new Date().toISOString();state.executionState='complete';state.summary={};
for(const panel of ['same-distribution','stress']){
 const records=state.records.filter(r=>r.panel===panel),s={completeByMethod:{},pairedNativeVsV10:{scenarioCount:0,nativeFees:0,v10Fees:0,nativeRevisions:0,v10Revisions:0}};
 for(const method of methods)s.completeByMethod[method]=records.filter(r=>r.method===method&&r.complete).length;
 for(const c of cases.filter(c=>c.panel===panel)){
  const b=records.find(r=>r.scenarioId===c.id&&r.method==='highsV8'),a=records.find(r=>r.scenarioId===c.id&&r.method==='stableHiGHSV10');
  if(b.complete&&a.complete){const p=s.pairedNativeVsV10;p.scenarioCount++;p.nativeFees+=b.incrementalCost;p.v10Fees+=a.incrementalCost;p.nativeRevisions+=b.revisionCount;p.v10Revisions+=a.revisionCount;}
 }
 state.summary[panel]=s;
}
await fs.writeFile(path.join(output,'complete.json'),JSON.stringify(state,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(state.summary));
