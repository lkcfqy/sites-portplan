import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const FEES=['storageCost','ddCost','totalCost','sunkCost','incrementalCost','objectiveCost','lateCount'];
const AUDITS=['review-v12','review-bootstrap-v12'];
function record(){
  return {policy:'seededHiGHSV12',status:'feasible',complete:true,auditValid:true,executionHistoryUnavailable:false,
    rows:[{id:'handwritten-A',pickupDay:0,unloadDay:0,returnDay:1}],usage:[],timeline:[],executedEvents:[],
    revisionCount:0,initializationEvidence:null,...Object.fromEntries(FEES.map(k=>[k,k==='lateCount'?0:100])),
    hardWallMs:5000,wallTimeMs:35,endToEndWallTimeMs:35,actualCutoffMs:null,
    processExitWallTimeMs:30,processCloseWallTimeMs:31,cleanupFinishedMs:34,
    finalReceivedMs:10,receiptValidatedMs:20,normalWorkerExit:true,exitCode:0,exitSignal:null,deadlineReached:false,
    terminalReceiptWithinBudget:true,outputDeliveredWithinBudget:true,terminalReceiptAcceptedAsHistory:true,
    endToEndCompletedWithinBudget:true,episodeCompletedWithinBudget:true,unacceptedTerminalReceipts:[],
    processGroupCleanup:{mode:'posix-process-group',attempted:true,killSignalSent:false,
      attempts:[{reason:'normal_terminal_cleanup',atMs:32.1,attempted:true,signal:'SIGKILL',sent:false,error:'ESRCH'}],
      startedAtMs:32,finishedAtMs:34,verifiedProcessGroupGone:true,verificationResult:'ESRCH',verificationAtMs:33,
      verificationError:null,successful:true}};
}
function rejectedLifecycle(r=record(),reason='terminal_lifecycle_exceeded_parent_deadline'){
  const original=structuredClone(r);
  r.unacceptedTerminalReceipts=[{parentReceivedMs:r.finalReceivedMs,receiptValidatedMs:r.receiptValidatedMs,reason,errors:[],
    message:{type:'final',method:r.policy,episodeId:'handwritten-only',result:original}}];
  Object.assign(r,{status:'hard_time_limit',complete:false,auditValid:false,executionHistoryUnavailable:true,
    rows:[],usage:[],timeline:[],executedEvents:[],revisionCount:null,
    terminalReceiptAcceptedAsHistory:false,endToEndCompletedWithinBudget:false,episodeCompletedWithinBudget:false,
    ...Object.fromEntries(FEES.map(k=>[k,null]))});
  return r;
}
function check(result,{receiptMutator,code='',audits=AUDITS}={}){
  const indent=source=>source.split('\n').map(line=>' '+line).join('\n');
  const output=spawnSync('python3',['-c',`
import importlib.util,json,sys,copy
d=json.load(sys.stdin)
for name in ${JSON.stringify(audits)}:
 spec=importlib.util.spec_from_file_location(name,'scripts/'+name+'.py')
 m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
 r=copy.deepcopy(d)
 receipt={k:copy.deepcopy(r.get(k)) for k in m.RECEIPT_FIELDS}
 receipt['terminalRowCount']=len(r['rows'])
${indent(receiptMutator??'')}
 checked=m.audit_formal_parent_receipt(receipt,r,5000,'handwritten-only')
${indent(code)}
 print(json.dumps({'audit':name,**checked}))
`],{cwd:new URL('../',import.meta.url),encoding:'utf8',input:JSON.stringify(result)});
  return output;
}
function accepts(r,options){const checked=check(r,options);assert.equal(checked.status,0,checked.stderr);return checked.stdout.trim().split('\n').map(JSON.parse);}
function rejects(r,pattern,options){for(const name of AUDITS){const checked=check(r,{...options,audits:[name]});
  assert.notEqual(checked.status,0,name+': '+checked.stdout);assert.match(checked.stderr,pattern);}}

test('both formal audits independently accept clean timely lifecycle and the exact 5000ms boundary',()=>{
  assert.ok(accepts(record()).every(r=>r.completeEpisode&&r.acceptedHistory));
  const boundary=record();boundary.processGroupCleanup.finishedAtMs=5000;boundary.cleanupFinishedMs=5000;
  boundary.wallTimeMs=boundary.endToEndWallTimeMs=5000;
  assert.ok(accepts(boundary).every(r=>r.completeEpisode));
});

test('timely failed physical execution can have accepted host history without a completion or fee claim',()=>{
  const r=record();Object.assign(r,{status:'rolling_failed',complete:false,auditValid:false,rows:[],episodeCompletedWithinBudget:false,
    ...Object.fromEntries(FEES.map(k=>[k,null]))});
  assert.ok(accepts(r).every(x=>x.acceptedHistory&&!x.completeEpisode));
});

test('a timely final cannot hide exit failure, a signal, or absent worker exit/close observations',()=>{
  const nonzero=record();nonzero.exitCode=7;nonzero.normalWorkerExit=false;
  rejects(nonzero,/accepted history|physical completion/);
  const signaled=record();signaled.exitCode=null;signaled.exitSignal='SIGKILL';signaled.normalWorkerExit=false;
  rejects(signaled,/accepted history|physical completion/);
  const missing=record();missing.processExitWallTimeMs=null;missing.normalWorkerExit=false;
  rejects(missing,/accepted history|physical completion/);
  const forged=record();forged.exitCode=1;
  rejects(forged,/normal worker exit/);
});

test('ESRCH confirmation and chronology reconstruct cleanup success instead of trusting producer booleans',()=>{
  const absent=record();absent.processGroupCleanup.verificationResult=null;
  rejects(absent,/ESRCH group verification/);
  const error=record();error.processGroupCleanup.verificationError='EPERM';
  rejects(error,/ESRCH group verification/);
  const forged=record();forged.processGroupCleanup.successful=false;
  rejects(forged,/independent cleanup success/);
  const lateProof=record();lateProof.processGroupCleanup.verificationAtMs=36;
  rejects(lateProof,/verification chronology/);
  const beforeLastKill=record();beforeLastKill.processGroupCleanup.verificationAtMs=32.05;
  rejects(beforeLastKill,/verification chronology/);
  const earlyClose=record();earlyClose.processCloseWallTimeMs=29;
  rejects(earlyClose,/close precedes exit/);
});

test('cleanup after the parent limit fails even when final receipt and worker exit were timely',()=>{
  const r=record();r.processGroupCleanup.finishedAtMs=5001;r.cleanupFinishedMs=5001;
  r.wallTimeMs=r.endToEndWallTimeMs=5002;r.deadlineReached=true;
  rejects(r,/accepted history|complete episode eligibility/);
  const failed=rejectedLifecycle(r);
  const checked=accepts(failed);assert.ok(checked.every(x=>x.terminalReceiptWithinBudget&&!x.acceptedHistory&&!x.cleanupWithinBudget));
  assert.equal(failed.totalCost,null);assert.equal(failed.unacceptedTerminalReceipts[0].message.result.totalCost,100);
});

test('post-cleanup parent work is included in the end-to-end cutoff even if cleanup finished in time',()=>{
  const r=record();r.wallTimeMs=r.endToEndWallTimeMs=5000.1;r.deadlineReached=true;
  rejects(r,/accepted history|complete episode eligibility/);
  const failed=rejectedLifecycle(r);
  assert.ok(accepts(failed).every(x=>x.cleanupWithinBudget&&!x.endToEndWithinBudget&&!x.completeEpisode));
  const hidden=structuredClone(failed);hidden.deadlineReached=false;
  rejects(hidden,/deadline observation/);
});

test('late lifecycle keeps the complete raw terminal while top-level failure rows and fees stay empty/null',()=>{
  const r=rejectedLifecycle(record(),'worker_exit_not_clean');r.exitCode=3;r.normalWorkerExit=false;
  assert.ok(accepts(r).every(x=>x.terminalReceiptWithinBudget&&!x.normalWorkerExit&&!x.acceptedHistory));
  const lost=structuredClone(r);lost.unacceptedTerminalReceipts=[];
  rejects(lost,/lost its raw terminal/);
  const erased=structuredClone(r);erased.unacceptedTerminalReceipts[0].message.result.totalCost=null;
  rejects(erased,/raw complete terminal was erased/);
  const identity=structuredClone(r);identity.unacceptedTerminalReceipts[0].message.episodeId='another-episode';
  rejects(identity,/lost its raw terminal/);
  const forgedFee=structuredClone(r);forgedFee.totalCost=0;
  rejects(forgedFee,/failed complete fees must remain null/);
});

test('deadline kill attempts may precede final cleanup, and failed spawn observations remain failures',()=>{
  const r=rejectedLifecycle();r.actualCutoffMs=5000;r.deadlineReached=true;
  r.processExitWallTimeMs=5001;r.processCloseWallTimeMs=5002;r.processGroupCleanup.startedAtMs=5003;
  r.processGroupCleanup.attempts=[{reason:'hard_deadline_signal',atMs:5000,attempted:true,signal:'SIGKILL',sent:true,error:null},
    {reason:'hard_deadline_final_cleanup',atMs:5003.1,attempted:true,signal:'SIGKILL',sent:false,error:'ESRCH'}];
  r.processGroupCleanup.killSignalSent=true;r.processGroupCleanup.verificationAtMs=5004;
  r.processGroupCleanup.finishedAtMs=r.cleanupFinishedMs=5005;r.wallTimeMs=r.endToEndWallTimeMs=5006;
  r.exitCode=null;r.exitSignal='SIGKILL';r.normalWorkerExit=false;
  assert.ok(accepts(r).every(x=>!x.completeEpisode));
  const missing=record();missing.processExitWallTimeMs=null;missing.processCloseWallTimeMs=null;
  missing.exitCode=null;missing.normalWorkerExit=false;
  const failed=rejectedLifecycle(missing,'worker_exit_not_clean');
  assert.ok(accepts(failed).every(x=>!x.acceptedHistory));
});

test('every new parent field, nested cleanup receipt and raw rejected terminal is required and compact/full bound',()=>{
  accepts(record(),{code:`
for field in m.PARENT_RECEIPT_FIELDS:
 bad=copy.deepcopy(receipt)
 del bad[field]
 try: m.audit_formal_parent_receipt(bad,r,5000,'missing-'+field)
 except ValueError: pass
 else: raise AssertionError('missing compact field accepted: '+field)
 bad=copy.deepcopy(receipt)
 value=bad[field]
 bad[field]=not value if type(value) is bool else value+1 if type(value) in (int,float) else 'tampered'
 try: m.audit_formal_parent_receipt(bad,r,5000,'forged-'+field)
 except ValueError: pass
 else: raise AssertionError('forged compact field accepted: '+field)
`});
  const absent=record();delete absent.endToEndWallTimeMs;
  rejects(absent,/missing formal scalar\/full parent field/);
});
