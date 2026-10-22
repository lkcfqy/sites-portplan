import test from 'node:test';
import assert from 'node:assert/strict';
import {PUBLIC_FEE_EXAMPLES,evaluatePublicExamples} from '../src/public-fee-validation.js';

test('two source worked examples agree with engine and independent arithmetic without claiming invoice evidence',()=>{
  const r=evaluatePublicExamples(PUBLIC_FEE_EXAMPLES.filter(c=>c.evidenceType==='official_worked_example'));
  assert.equal(r.summary.total,2);assert.equal(r.summary.passed,2);assert.equal(r.summary.officialWorkedExamples,2);
  assert.deepEqual(r.cases.map(c=>c.expectedKRW),[500500,90000]);
  assert.deepEqual(r.cases.map(c=>c.source.page),[4,1]);
  assert.ok(r.cases.every(c=>c.isActualInvoice===false));
  assert.match(r.cases[1].sourceInterpretation,/不能据此证明跨档/);
});
test('derived tariff boundaries are separately labeled and a changed expected amount actually fails',()=>{
  const r=evaluatePublicExamples();assert.equal(r.summary.failed,0);assert.equal(r.summary.invalid,0);assert.ok(r.summary.derivedCases>0);
  const day14=r.cases.find(c=>c.id==='pnc-derived-20ft-day14');assert.equal(day14.actualKRW,318500);
  assert.equal(r.cases[0].actualKRW-day14.actualKRW,182000);
  const bad={...PUBLIC_FEE_EXAMPLES[0],expectedKRW:500501};
  assert.equal(evaluatePublicExamples([bad]).cases[0].status,'fail');
});
test('missing expected amount, duplicate ids and absent source provenance cannot produce a pass',()=>{
  const c=PUBLIC_FEE_EXAMPLES[0];
  for(const item of [{...c,expectedKRW:undefined},{...c,source:{...c.source,page:null}},{...c,elapsedDays:-1},{...c,evidenceType:'actual_invoice'}])assert.equal(evaluatePublicExamples([item]).cases[0].status,'invalid');
  assert.equal(evaluatePublicExamples([c,c]).summary.invalid,2);
});
