import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const setup=String.raw`
import importlib.util,copy
s=importlib.util.spec_from_file_location('r','scripts/review-native-diagnostic-v12.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def fixture():
 scene={'id':'handwritten-cp-review','horizonStart':'2026-10-13','horizonDays':4,'truckCapacity':2,'warehouseCapacity':1,'stagingCapacity':1,'containers':[{'id':'A','sizeFt':20,'releaseDay':0,'unloadDays':1,'dueDay':2,'dischargeDateTime':'2026-10-13T07:00:00+09:00'}]}
 dates=[{'id':'A','pickupDay':0,'unloadDay':0,'returnDay':1}]
 row={**dates[0],**m.ledger.reprice(scene,scene['containers'][0],0,1),'unloadEndDay':0,'sizeFt':20}
 fees=m.v10.reprice_dates(scene,dates);five={k:v for k,v in fees.items() if k!='objectiveCost'}
 native={'schemaVersion':'portplan-native-cpsat-v12','status':'optimal','solverStatus':4,'solverThreads':1,'solverSeed':0,'hasIncumbent':True,'provenOptimal':True,'provenInfeasible':False,'rows':dates,'objectiveCost':0,'lowerBound':0,'exactIntegerObjective':0,'independentCosts':five,'incumbentAudit':{'valid':True,'objectiveCost':0,'independentCosts':five},'numericalAssurance':{'primarySafeInteger':True,'roundsFees':False,'integerArithmeticModel':True,'objectiveLimitKRW':9007199254740991},'modelWallMs':1,'solverWallMs':2,'independentAuditWallMs':1,'serviceWallMs':4,'solverTimeLimitMs':190,'remainingBudgetAtReceiptMs':198}
 audit={'valid':True,'errors':[],'scheduleAudit':{'valid':True,'errors':[]},'freezeAudit':{'valid':True,'errors':[]}}
 ready={'schemaVersion':'portplan-native-cpsat-v12','solverThreads':1,'solverSeed':0,'pid':12345}
 stage={'hasIncumbent':True,'audit':audit,'independentCostsMatch':True,'acceptance':{'acceptedDates':copy.deepcopy(dates),'objectiveCost':0,'acceptedAtMs':9}}
 meta={'timeBudgetMs':200,'decisionCalls':1,'solverCalls':1,'solverThreads':1,'readyCalledBeforeDecision':True,'nativeCertificate':native,'stages':{'native':stage},'wallTimeMs':10,'retainCacheFallback':True,'candidateSource':'native_cpsat','nativeService':ready}
 result={'status':'optimal','rows':[row],**fees,'lateCount':0,'plannerMetadata':meta}
 terminal={'id':'handwritten','type':'terminal','result':result,'cleanupSuccess':True,'error':None,'ready':ready,'callWallMs':10,'cleanupWallMs':2,'workerElapsedMs':80}
 record={'id':'handwritten','caseId':scene['id'],'day':0,'method':'cpsatV12','dailyBudgetMs':200,'result':result,'rawTerminal':terminal,'acceptedPlanWithinBudget':True,'exitCode':0,'exitSignal':None,'processGroupCleanup':{'attempted':True,'verifiedProcessGroupGone':True,'verificationError':None,'finishedAtMs':115,'attempts':[{'signal':'SIGKILL','detachedProcessGroup':True,'atMs':112}]},'terminalReceivedAtMs':100,'parentAuditFinishedAtMs':102,'processExitWallMs':110,'parentWallMs':120,'parentTerminalWithinBudget':True,'hardDeadlineReached':False,'deadlineTimerFired':False,'actualCutoffMs':None,'unacceptedTerminal':None,'startupReceipts':[{'receivedAtMs':20,'message':{'id':'handwritten','type':'ready','ready':ready}},{'receivedAtMs':90,'message':{'id':'handwritten','type':'planner_result_before_cleanup','result':result}}],'parentAudit':{'valid':True,'completeCandidate':True,'costs':fees}}
 receipt={k:record[k] for k in ('id','caseId','day','method','dailyBudgetMs','acceptedPlanWithinBudget','parentWallMs','hardDeadlineReached')};receipt.update(status='optimal',objectiveCost=0,lowerBound=0,nativeRawLowerBound=0,provenOptimal=True)
 return {'snapshot':scene,'fixedEvents':{},'day':0},record,receipt

def reject(fn,fragment):
 try:fn()
 except ValueError as e:assert fragment in str(e),str(e)
 else:raise AssertionError('mutated evidence was accepted')
`;
function python(code){const r=spawnSync('python3',['-c',setup+code],{cwd:new URL('../',import.meta.url),encoding:'utf8'});assert.equal(r.status,0,r.stderr);}

test('independent CP diagnostic accepts a complete zero-fee integer plan and clean cold lifecycle',()=>{
  python(`s,r,p=fixture();x=m.audit_record(s,r,p);assert x['accepted'] and x['rawNativeFees']['objectiveCost']==0`);
});

test('CP accepted dates, resource fees and explicit daily acceptance cutoff cannot be forged',()=>{
  python(`s,r,p=fixture();r['result']['plannerMetadata']['stages']['native']['acceptance']['acceptedAtMs']=201
reject(lambda:m.audit_record(s,r,p),'late CP candidate')
s,r,p=fixture();r['result']['plannerMetadata']['stages']['native']['acceptance']['acceptedDates'][0]['returnDay']=2
reject(lambda:m.audit_record(s,r,p),'CP acceptance dates')
s,r,p=fixture();r['result']['plannerMetadata']['nativeCertificate']['independentCosts']['incrementalCost']=1
reject(lambda:m.audit_record(s,r,p),'raw native incrementalCost')`);
});

test('native ready schema, clean exit, confirmed group removal and cleanup cutoff all bind',()=>{
  python(`s,r,p=fixture();r['exitCode']=1;reject(lambda:m.audit_record(s,r,p),'clean exit')
s,r,p=fixture();r['exitSignal']='SIGTERM';reject(lambda:m.audit_record(s,r,p),'clean signal')
s,r,p=fixture();r['processGroupCleanup']['verifiedProcessGroupGone']=False;reject(lambda:m.audit_record(s,r,p),'group must be gone')
s,r,p=fixture();r['processGroupCleanup']['finishedAtMs']=5001;r['parentWallMs']=5002;reject(lambda:m.audit_record(s,r,p),'hard deadline')
s,r,p=fixture();r['rawTerminal']['ready']['solverSeed']=1;reject(lambda:m.audit_record(s,r,p),'ready CP-SAT seed')`);
});

test('CP UNKNOWN cannot become an optimality or lower-bound claim',()=>{
  python(`s,r,p=fixture();n=r['result']['plannerMetadata']['nativeCertificate'];n.update(status='time_limit',solverStatus=0,hasIncumbent=False,provenOptimal=False,rows=[],objectiveCost=None,independentCosts=None,lowerBound=0);r['result']['plannerMetadata']['stages']['native']['hasIncumbent']=False
reject(lambda:m.audit_native(s['snapshot'],{},0,r['result'],'cpsatV12',200,'unknown'),'UNKNOWN promoted')`);
});

test('late native certificate stays raw; unavailable accepted fees and bounds remain null',()=>{
  python(`s,r,p=fixture();meta=r['result']['plannerMetadata'];meta['candidateSource']='no_complete_plan';meta['wallTimeMs']=210;del meta['stages']['native']['acceptance']
r['result']['status']='time_limit';r['result']['rows']=[]
for k in m.COSTS:r['result'][k]=None
r.update(acceptedPlanWithinBudget=False,parentWallMs=320,terminalReceivedAtMs=300,parentAuditFinishedAtMs=302,processExitWallMs=310)
r['processGroupCleanup']['finishedAtMs']=315;r['processGroupCleanup']['attempts'][0]['atMs']=312;r['startupReceipts'][1]['receivedAtMs']=290
r['rawTerminal'].update(callWallMs=211,workerElapsedMs=280);r['parentAudit']['completeCandidate']=False
p.update(status='time_limit',acceptedPlanWithinBudget=False,parentWallMs=320,objectiveCost=None,lowerBound=None,provenOptimal=False)
x=m.audit_record(s,r,p);assert not x['accepted'] and x['nativeRawLowerBound']==0
p['lowerBound']=0;reject(lambda:m.audit_record(s,r,p),'published scalar lowerBound')
p['lowerBound']=None;r['result']['totalCost']=0;reject(lambda:m.audit_record(s,r,p),'fees must be null')`);
});

test('necessary infeasibility diagnosis is restricted to the actual fixed prefix',()=>{
  python(`s,r,p=fixture();scene=s['snapshot'];scene['horizonDays']=5;scene['containers'][0]['unloadDays']=2;scene['containers'][0]['dueDay']=3;scene['warehouseCapacity']=0
x=m.prefix_necessary_load(scene,{'A':{'pickupDay':0,'unloadDay':0}},1)
assert x['mandatoryWarehouseLowerBound']==1 and x['independentlyProvesThisFixedPrefixInfeasible']
x=m.prefix_necessary_load(scene,{},1)
assert x['mandatoryWarehouseLowerBound']==0 and not x['independentlyProvesThisFixedPrefixInfeasible']`);
});


test('adapter cannot promote merely feasible native output to optimal or serialize a nonnumeric bound',()=>{
  python(`s,r,p=fixture();n=r['result']['plannerMetadata']['nativeCertificate'];n.update(status='feasible',solverStatus=2,provenOptimal=False)
reject(lambda:m.audit_record(s,r,p),'adapter optimality')
s,r,p=fixture();r['result']['plannerMetadata']['nativeCertificate']['lowerBound']='unavailable'
reject(lambda:m.audit_record(s,r,p),'nonnumeric native lowerBound')`);
});
