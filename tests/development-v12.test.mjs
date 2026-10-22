import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {selectDevelopmentCasesV12,developmentRuntimeSourcesV12,declareDevelopmentV12,
  validateDevelopmentDeclarationV12,runDeclaredDevelopmentV12} from '../scripts/development-v12.mjs';

async function inputs(){return Promise.all(['data/evidence-v10/v10-frozen-first/first-run/complete.json',
  'artifacts/development-seeded-v12-inputs.json','data/protocol-v12.json'].map(async path=>JSON.parse(await readFile(new URL('../'+path,import.meta.url),'utf8'))));}

test('fixed reused selection is exactly 36 representatives plus five D0 cases and cannot silently lose a stratum',async()=>{
  const [index,d0]=await inputs(),selected=selectDevelopmentCasesV12(index,d0);
  assert.equal(selected.length,41);assert.equal(selected.filter(c=>c.panel==='same-distribution').length,22);
  assert.equal(selected.filter(c=>c.panel==='stress').length,19);assert.equal(selected.filter(c=>c.developmentSelection.representative).length,36);
  assert.equal(selected.filter(c=>c.developmentSelection.oldD0Failure).length,5);assert.ok(selected.every(c=>c.algorithmSeed===49011));
  const corrupt=structuredClone(index);corrupt.cases.find(c=>c.scenarioRepeat===1).scenarioRepeat=2;
  assert.throws(()=>selectDevelopmentCasesV12(corrupt,d0),/36 fixed/);
  const missing=structuredClone(d0);missing.records.pop();assert.throws(()=>selectDevelopmentCasesV12(index,missing),/fifteen/);
});

test('runtime snapshot covers every native/constructor dependency without including unrelated UI/material code',async()=>{
  const paths=await developmentRuntimeSourcesV12();
  for(const path of ['scripts/development-v12.mjs','scripts/benchmark-v12.mjs','scripts/episode-v12.worker.mjs',
    'scripts/highs-planner-v11.mjs','scripts/highs-planner-v12.mjs','scripts/highs-service-v8.py','scripts/certify-v4.py',
    'src/locked-recovery-v9.js','src/commitment-slack-v11.js','src/solver-glpk.js','data/protocol-v2.json','data/protocol-v12.json'])assert.ok(paths.includes(path),path);
  assert.equal(paths.includes('src/main.js'),false);assert.equal(new Set(paths).size,paths.length);
});

test('declaration preserves old bytes, rejects budget/order/source edits, refuses overwrite or implicit restart before any solver runs',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'v12-declaration-only-'));
  try{
    const output=join(dir,'declared'),declaration=await declareDevelopmentV12(output),[index,d0,protocol]=await inputs();
    assert.equal(declaration.episodeCount,246);assert.equal(declaration.newOrderGeneration,0);assert.equal(declaration.ciComputed,false);
    assert.equal(validateDevelopmentDeclarationV12(declaration,index,d0,protocol),declaration);
    const c=declaration.cases[0];assert.deepEqual(await readFile(join(output,c.inputArtifact.path)),await readFile(new URL('../'+c.sourceInputArtifact.path,import.meta.url)));
    const budget=structuredClone(declaration);budget.callBudgets.seededHiGHSV12.constructorBudgetMs=80;
    assert.throws(()=>validateDevelopmentDeclarationV12(budget,index,d0,protocol),/budgets/);
    const order=structuredClone(declaration);order.cases[0].methodExecutionOrder.reverse();
    assert.throws(()=>validateDevelopmentDeclarationV12(order,index,d0,protocol),/cyclic/);
    const refs=structuredClone(declaration);refs.cases[0].sourceInputArtifact.path='../outside';
    assert.throws(()=>validateDevelopmentDeclarationV12(refs,index,d0,protocol),/input references/);
    await assert.rejects(declareDevelopmentV12(output),/Preserve the existing/);
    await writeFile(join(output,'start.json'),'existing first run marker',{flag:'wx'});
    await assert.rejects(runDeclaredDevelopmentV12(output),/Preserve the existing/);
    assert.equal(await readFile(join(output,'start.json'),'utf8'),'existing first run marker');
  }finally{await rm(dir,{recursive:true,force:true});}
});
