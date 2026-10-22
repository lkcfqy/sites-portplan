#!/usr/bin/env node
/** Synthetic teaching checks only: no new research scenarios or business quotes. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {makeResourceRecoveryFixtureV9,prepareResourceRecoveryInputV9,runResourceRecoveryV9} from '../src/resource-recovery-v9.worker.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
if(args.length!==0&&(args.length!==2||args[0]!=='--output'))throw new Error('Usage: node scripts/validate-resource-recovery-v9.mjs [--output NEW_FILE]');
const output=path.resolve(root,args[1]??'artifacts/resource-validation-v9-reproduction.json');
if(fs.existsSync(output))throw new Error('Preserve the existing teaching receipts; choose a new output path.');
const files=['src/resource-recovery-v9.js','src/resource-recovery-v9.worker.js','src/engine.js','src/solver-glpk.js','scripts/validate-resource-recovery-v9.mjs'];
const implementationHashes=Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]));
const records=[];
for(const fixture of ['rescue','impossible'])for(const objectiveMode of ['procurementOnly','feesPlusProcurement']){
  const raw=makeResourceRecoveryFixtureV9(fixture);raw.objectiveMode=objectiveMode;
  const input=prepareResourceRecoveryInputV9(raw),result=await runResourceRecoveryV9(input);
  records.push({name:`${fixture}-${objectiveMode}`,fixture,input,result});
}
const data={schemaVersion:'portplan-v9-resource-teaching-validation',generatedAt:new Date().toISOString(),fixture:true,
  scope:'Four intentionally constructed synthetic teaching records, not new formal scenarios, real quotes, permissions or enterprise validation.',
  implementationHashes,records};
fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(data,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,fixture:true,records:records.map(r=>({name:r.name,status:r.result.status,procurementCostKRW:r.result.procurementCostKRW,objectiveCostKRW:r.result.objectiveCostKRW}))}));
