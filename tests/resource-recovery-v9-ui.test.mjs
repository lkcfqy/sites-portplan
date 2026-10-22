import test from 'node:test';
import assert from 'node:assert/strict';
import {Worker} from 'node:worker_threads';
import {registerHooks} from 'node:module';
import {RESOURCE_RECOVERY_HARD_WALL_MS_V9,auditResourceRecoveryResultV9,
  makeResourceRecoveryFixtureV9,prepareResourceRecoveryInputV9,resourceRecoveryStatusV9,
  runResourceRecoveryV9} from '../src/resource-recovery-v9.worker.js';

test('recovery editor boundary allowlists observed inputs and requires explicit prices, timing and authorization',()=>{
  const input=makeResourceRecoveryFixtureV9();input.snapshot.hiddenFutureEvents=[{duration:8}];input.snapshot.containers[0].futureAvailability=7;input.actions[0].providerVerified=true;
  const original=structuredClone(input),prepared=prepareResourceRecoveryInputV9(input);
  assert.deepEqual(input,original);assert.equal(prepared.snapshot.hiddenFutureEvents,undefined);assert.equal(prepared.snapshot.containers[0].futureAvailability,undefined);assert.equal(prepared.actions[0].providerVerified,undefined);
  assert.deepEqual(prepared.normalization.ignoredSnapshotFields,['hiddenFutureEvents']);assert.equal(prepared.timeBudgetMs,1000);
  assert.equal(prepareResourceRecoveryInputV9({...input,inputOrigin:'supplier-verified'}).inputOrigin,'user-custom-unverified');
  assert.equal(prepareResourceRecoveryInputV9({...input,inputOrigin:'supplier-verified'}).snapshot.containers[0].dataOrigin,'uploaded');
  for(const [field,value]of [['authorized',undefined],['earliestAvailableDay',undefined],['priceKRW',undefined],['priceKRW',-1],['priceKRW',1.5],['units',0],['days',[1,1]]]){
    const broken=structuredClone(input);broken.actions[0][field]=value;assert.throws(()=>prepareResourceRecoveryInputV9(broken),new RegExp(field));
  }
  assert.throws(()=>prepareResourceRecoveryInputV9({...input,fixedEvents:{'TEACHING-01':{pickupDay:1}}}),/strictly before/);
  assert.throws(()=>prepareResourceRecoveryInputV9({...input,actions:undefined}),/explicit array/);
  assert.doesNotThrow(()=>prepareResourceRecoveryInputV9({...input,actions:[]}));
});

test('both actual teaching modes independently audit a priced full plan and expose excluded assumptions',async()=>{
  for(const objectiveMode of ['procurementOnly','feesPlusProcurement']){
    const input={...makeResourceRecoveryFixtureV9('rescue'),objectiveMode},result=await runResourceRecoveryV9(input);
    assert.equal(result.status,'optimal');assert.equal(result.terminalAudit.valid,true);assert.equal(result.counterfactual,true);assert.equal(result.purchaseExecuted,false);
    assert.equal(result.rows[0].pickupDay,0);assert.equal(result.rows[0].unloadDay,1);assert.equal(result.procurementCostKRW,30000);
    assert.deepEqual(result.selectedActions.map(action=>action.id),['SYNTHETIC-warehouse-one-day']);
    assert.equal(result.combinedIncrementalCostKRW,result.incrementalCost+30000);assert.equal(result.combinedTotalCostKRW,result.totalCost+30000);
    assert.equal(result.proof.minimumProcurementProven,objectiveMode==='procurementOnly');assert.equal(result.proof.minimumObjectiveProven,true);
    assert.deepEqual(result.excludedActions.map(action=>action.reasons),[['not_authorized'],['before_earliest_availability'],['would_change_past_capacity']]);
    assert.equal(auditResourceRecoveryResultV9(input,result).valid,true);assert.equal(resourceRecoveryStatusV9(result),'optimal');
    assert.equal(result.terminalAudit.optimalityIndependentlyRecomputed,false);
  }
});

test('menu infeasibility is scoped and incomplete amounts remain null rather than becoming zero',async()=>{
  for(const input of [makeResourceRecoveryFixtureV9('impossible'),{...makeResourceRecoveryFixtureV9('rescue'),actions:[]}]){
    const result=await runResourceRecoveryV9(input);assert.equal(resourceRecoveryStatusV9(result),'infeasible');assert.equal(result.rows.length,0);assert.equal(result.selectedActions.length,0);
    for(const field of ['procurementCostKRW','totalCost','incrementalCost','combinedIncrementalCostKRW','combinedTotalCostKRW'])assert.equal(result[field],null);
    assert.equal(result.proof.minimumObjectiveProven,false);assert.equal(result.proof.infeasibleWithinMenuProven,true);
    const tampered=structuredClone(result);tampered.procurementCostKRW=0;assert.equal(auditResourceRecoveryResultV9(input,tampered).valid,false);
  }
});

test('parent rejects forged price, permission, capacity, past locks, fee and unsupported minimum claims',async()=>{
  const input=makeResourceRecoveryFixtureV9(),result=await runResourceRecoveryV9(input);
  for(const mutate of [
    value=>value.selectedActions[0].priceKRW=1,
    value=>value.selectedActions[0].authorized=false,
    value=>value.selectedActions[0].days=[2],
    value=>value.selectedActions.push(structuredClone(value.selectedActions[0])),
    value=>value.rows[0].pickupDay=1,
    value=>value.rows[0].returnDay=Infinity,
    value=>value.totalCost++,
    value=>value.combinedIncrementalCostKRW++,
    value=>value.objectiveMode='feesPlusProcurement',
    value=>value.excludedActions[0].reasons=[],
    value=>value.purchaseExecuted=true,
    value=>value.proof.minimumObjectiveProven=false,
    value=>value.status='feasible',
  ]){const tampered=structuredClone(result);mutate(tampered);assert.equal(auditResourceRecoveryResultV9(input,tampered).valid,false);}
  const noAudit=structuredClone(result);noAudit.audit.valid=false;assert.equal(resourceRecoveryStatusV9(noAudit),'unknown');
  assert.equal(resourceRecoveryStatusV9({status:'time_limit',proof:{minimumObjectiveProven:true}}),'unknown');
  assert.equal(resourceRecoveryStatusV9({status:'cancelled'}),'cancelled');
});

test('a fresh worker returns a full audited teaching suggestion within the same parent hard boundary',async()=>{
  const input=prepareResourceRecoveryInputV9(makeResourceRecoveryFixtureV9()),moduleURL=new URL('../src/resource-recovery-v9.worker.js',import.meta.url).href;
  const source=`import {parentPort,workerData} from 'node:worker_threads';import {runResourceRecoveryV9} from ${JSON.stringify(moduleURL)};try{parentPort.postMessage({result:await runResourceRecoveryV9(workerData)});}catch(error){parentPort.postMessage({error:error.message});}`;
  const started=performance.now();const result=await new Promise((resolve,reject)=>{const worker=new Worker(new URL('data:text/javascript,'+encodeURIComponent(source)),{workerData:input});let finished=false;const timer=setTimeout(()=>finish(new Error('Parent hard deadline elapsed.')),RESOURCE_RECOVERY_HARD_WALL_MS_V9);function finish(error,value){if(finished)return;finished=true;clearTimeout(timer);void worker.terminate();if(error)reject(error);else resolve(value);}worker.once('error',error=>finish(error));worker.once('message',message=>{if(message.error){finish(new Error(message.error));return;}const audit=auditResourceRecoveryResultV9(input,message.result);if(!audit.valid){finish(new Error(audit.errors.join('; ')));return;}if(performance.now()-started>RESOURCE_RECOVERY_HARD_WALL_MS_V9){finish(new Error('Parent audit exceeded hard deadline.'));return;}finish(null,message.result);});});
  assert.equal(result.status,'optimal');assert.equal(result.terminalAudit.valid,true);assert.equal(result.browserRecovery.source,'custom_local_counterfactual_not_frozen_research');
});

test('UI cancellation discards late replies and editing keeps the prior suggestion visibly stale',async()=>{
  // A small DOM adapter tests lifecycle wiring only; this is not browser/rendering acceptance.
  class Element{
    constructor(tag){this.tagName=tag;this.children=[];this.listeners={};this.dataset={};this.attributes={};this.classList={add(){}};this.textContent='';this.disabled=false;}
    append(...values){this.children.push(...values);}replaceChildren(...values){this.children=[...values];}
    setAttribute(key,value){this.attributes[key]=value;}addEventListener(name,callback){(this.listeners[name]??=[]).push(callback);}
    trigger(name){if(this.disabled&&name==='click')return;for(const callback of this.listeners[name]??[])callback({target:this});}
    all(){return [this,...this.children.filter(value=>value instanceof Element).flatMap(value=>value.all())];}
    querySelector(selector){return this.all().find(value=>selector==='[data-recovery-stale]'&&value.dataset.recoveryStale);}
  }
  const hooks=registerHooks({load(url,context,next){if(url.endsWith('/resource-recovery-v9.css'))return {format:'module',source:'',shortCircuit:true};return next(url,context);}});
  const originalDocument=globalThis.document,originalWorker=globalThis.Worker,workers=[];
  globalThis.document={createElement:tag=>new Element(tag)};
  globalThis.Worker=class{constructor(){workers.push(this);this.terminated=false;}postMessage(message){this.input=message;}terminate(){this.terminated=true;}};
  let mounted;
  try{
    const {mountResourceRecoveryV9UI}=await import('../src/resource-recovery-v9-ui.js');
    const container=new Element('section');mounted=mountResourceRecoveryV9UI(container,{getScenario:()=>makeResourceRecoveryFixtureV9().snapshot});
    const button=text=>container.all().find(value=>value.tagName==='button'&&value.textContent===text);
    const texts=()=>container.all().map(value=>value.textContent).join(' ');
    assert.equal(container.all().find(value=>value.tagName==='textarea'&&value.attributes['aria-label']==='可考虑的资源动作菜单 · JSON').value,'[]');
    button('教学：可补救').trigger('click');button('计算补救建议').trigger('click');assert.equal(workers.length,1);
    const first=workers[0];button('停止').trigger('click');assert.equal(first.terminated,true);assert.match(texts(),/已停止/);
    first.onmessage({data:{id:first.input.id,result:{status:'optimal'}}});await new Promise(resolve=>setImmediate(resolve));assert.match(texts(),/已停止/);
    button('计算补救建议').trigger('click');const second=workers[1],result=await runResourceRecoveryV9(second.input.input);
    second.onmessage({data:{id:second.input.id,result}});await new Promise(resolve=>setImmediate(resolve));assert.equal(second.terminated,true);assert.match(texts(),/已证明菜单内最小采购费/);
    const menu=container.all().find(value=>value.tagName==='textarea'&&value.attributes['aria-label']==='可考虑的资源动作菜单 · JSON');const changed=JSON.parse(menu.value);changed[0].priceKRW=90000;menu.value=JSON.stringify(changed);menu.trigger('input');
    assert.equal(container.querySelector('[data-recovery-stale]').hidden,false);
    button('한국어').trigger('click');assert.equal(container.lang,'ko');assert.match(texts(),/입력이 변경되었습니다/);
    mounted.destroy();assert.equal(container.children.length,0);
  }finally{mounted?.destroy();hooks.deregister();if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;if(originalWorker===undefined)delete globalThis.Worker;else globalThis.Worker=originalWorker;}
});
