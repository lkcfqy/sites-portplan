import {auditSchedule, rowFor, summarize, validateScenario} from '../src/engine.js';
import {scoreCommitmentSlackV11} from '../src/commitment-slack-v11.js';
import {solveLockedConstructorV9} from '../src/locked-recovery-v9.js';
import {auditFrozenEvents} from '../src/rolling-plan.js';

const FIELDS=['pickupDay', 'unloadDay', 'returnDay'];
const COSTS=['storageCost', 'ddCost', 'totalCost', 'sunkCost', 'incrementalCost'];
const defaultNow=()=>performance.now();
const FEE_EPSILON_KRW=1e-6;
const datesOf=rows=>rows.map(row=>Object.fromEntries(['id',...FIELDS].map(field=>[field,row[field]])));
const feesOf=result=>Object.fromEntries([...COSTS,'objectiveCost'].map(field=>[field,result[field]]));
const changedEvents=(before,after)=>{
  const byId=new Map(before.map(row=>[row.id,row]));
  return after.reduce((sum,row)=>sum+FIELDS.filter(field=>row[field]!==byId.get(row.id)?.[field]).length,0);
};

function validateInput(s, options) {
  for(const value of [s,options])for(const key of ['events','futureEvents','actualScenario','realizedScenario','unrevealedEvents'])if(Object.hasOwn(value,key))throw new Error('V12 accepts public observations and execution locks, never private future-event payloads.');
  const validation=validateScenario(s);
  if (!validation.valid) throw new Error(validation.errors.join('; '));
  const minimum=options.minEventDay??0, fixed=options.fixedEvents??{};
  if (!Number.isInteger(minimum) || minimum<0 || minimum>s.horizonDays) throw new Error('minEventDay must be an integer within the horizon.');
  if (!fixed || typeof fixed!=='object' || Array.isArray(fixed)) throw new Error('fixedEvents must be an object.');
  const ids=new Set(s.containers.map(c=>c.id));
  for (const [id, locks] of Object.entries(fixed)) {
    if (!ids.has(id) || !locks || typeof locks!=='object' || Array.isArray(locks)) throw new Error('Unknown or malformed execution lock container.');
    for (const [field, day] of Object.entries(locks)) if (!FIELDS.includes(field) || !Number.isInteger(day) || day<0 || day>=minimum) throw new Error('Executed event locks must be strictly before minEventDay.');
  }
  if ((options.objectiveMode??s.objectiveMode??'joint')!=='joint') throw new Error('The frozen native HiGHS baseline supports joint incremental fees only.');
}

function audited(s, dates, options) {
  const errors=[], byId=new Map();
  if (!Array.isArray(dates) || dates.length!==s.containers.length) return {valid:false, errors:['Require one complete row per known order.'], rows:[]};
  for (const row of dates) {
    if (!row || !s.containers.some(c=>c.id===row.id) || byId.has(row.id)) { errors.push('Unknown, duplicate or malformed candidate row.'); continue; }
    byId.set(row.id, row);
    for (const field of FIELDS) if (!Number.isInteger(row[field]) || row[field]<0 || row[field]>=s.horizonDays) errors.push(`${row.id}: event date outside horizon.`);
  }
  if (errors.length) return {valid:false, errors, rows:[]};
  const rows=s.containers.map(c=>{ const row=byId.get(c.id); return rowFor(s,c,row.pickupDay,row.unloadDay,row.returnDay); });
  const scheduleAudit=auditSchedule(s,rows), freezeAudit=auditFrozenEvents(rows,options.fixedEvents??{},options.minEventDay??0);
  return {valid:scheduleAudit.valid && freezeAudit.valid, errors:[...scheduleAudit.errors,...freezeAudit.errors], rows, scheduleAudit, freezeAudit};
}

function failure(status, reason) {
  return {policy:'seededHiGHSV12', modelVersion:'v12-seeded-native-commitment-slack', status, reason, optimality:'not_proven', rows:[], usage:[],
    totalCost:null, incrementalCost:null, storageCost:null, ddCost:null, sunkCost:null, objectiveCost:null, lateCount:null, objectiveMode:'joint'};
}

/** One native process per sequential episode. Importing this Node-only module
 * does not launch Python. ready() may be used before the first decision; its
 * measured startup must then be charged to the common episode budget.
 */
export function createSeededCommitmentHiGHSPlannerV12(configuration={}) {
  const {timeBudgetMs:defaultBudget=200, auditReserveMs=2, initializationTimeoutMs=10000,
    hardOverrunGraceMs=250, pythonExecutable='python3', servicePath=null,
    retainCacheFallback=true, now=defaultNow, seedConstructor=solveLockedConstructorV9, constructorBudgetMs=40, constructorAuditReserveMs=5, maxRestarts=3, ...defaultsInput}=configuration;
  for (const [key,value] of Object.entries({defaultBudget,initializationTimeoutMs})) if (!Number.isFinite(value) || value<=0) throw new Error(`${key} must be positive and finite.`);
  for (const [key,value] of Object.entries({auditReserveMs,hardOverrunGraceMs})) if (!Number.isFinite(value) || value<0) throw new Error(`${key} must be nonnegative and finite.`);
  if (typeof now!=='function' || typeof retainCacheFallback!=='boolean' || typeof pythonExecutable!=='string' || !pythonExecutable) throw new Error('Invalid native planner configuration.');
  if(typeof seedConstructor!=='function'||!Number.isFinite(constructorBudgetMs)||constructorBudgetMs<0||!Number.isFinite(constructorAuditReserveMs)||constructorAuditReserveMs<0||!Number.isInteger(maxRestarts)||maxRestarts<0||maxRestarts>128)throw new Error('Invalid V12 constructor configuration.');
  const defaults=structuredClone(defaultsInput), pending=new Map();
  let child=null, reader=null, readiness=null, readinessInfo=null, closed=false, busy=false, nextId=1, cached=null, cacheKey=null;
  let stderr='', startupStarted=null, startupWallMs=null, calls=0, solverCalls=0, strictReplacementCount=0, tieRetainedCount=0, commitmentReplacementCount=0, constructorCalls=0, acceptedConstructorReceipts=0, lastEpisodeKey=null, lastDay=null;

  function rejectPending(error) {
    for (const item of pending.values()) item.reject(error);
    pending.clear();
  }

  function ensureService(timeoutMs=initializationTimeoutMs) {
    if (closed) return Promise.reject(new Error('Native planner is closed.'));
    if (readiness) return readiness;
    startupStarted=performance.now();
    readiness=(async()=>{
      // Node builtins never enter the browser dependency graph; this module is
      // only imported by the offline/worker experiment registry.
      const [{spawn},{createInterface},{fileURLToPath}]=await Promise.all([import('node:child_process'),import('node:readline'),import('node:url')]);
      if (closed) throw new Error('Native planner was closed during startup.');
      return await new Promise((resolve,reject)=>{
        let settled=false;
        const finishReady=(error,info)=>{
          if (settled) return;
          settled=true; clearTimeout(timer);
          if (error) reject(error);
          else { startupWallMs=performance.now()-startupStarted; readinessInfo={...info,startupWallMs}; resolve(readinessInfo); }
        };
        const timer=setTimeout(()=>{ finishReady(new Error('Python/HiGHS readiness timeout.')); child?.kill('SIGKILL'); },timeoutMs);
        child=spawn(pythonExecutable,['-u',servicePath??fileURLToPath(new URL('./highs-service-v8.py',import.meta.url))],{
          stdio:['pipe','pipe','pipe'],env:{...process.env,OMP_NUM_THREADS:'1',OPENBLAS_NUM_THREADS:'1',MKL_NUM_THREADS:'1'},
        });
        child.stderr.on('data',chunk=>{ stderr=(stderr+chunk.toString()).slice(-4000); });
        child.stdin.on('error',error=>{ finishReady(error); rejectPending(error); });
        reader=createInterface({input:child.stdout});
        reader.on('line',line=>{
          let message;
          try { message=JSON.parse(line); }
          catch { const error=new Error('Native service emitted malformed JSON.'); finishReady(error); rejectPending(error); child.kill('SIGKILL'); return; }
          if (message.type==='ready') finishReady(null,message);
          else if (message.type==='result' && pending.has(message.id)) {
            const item=pending.get(message.id); pending.delete(message.id); item.resolve(message.result);
          }
        });
        child.on('error',error=>{ finishReady(error); rejectPending(error); });
        child.on('exit',(code,signal)=>{
          const error=new Error(`Native service exited (${signal??code}).${stderr?' '+stderr:''}`);
          finishReady(error); rejectPending(error); reader?.close();
        });
      });
    })();
    return readiness;
  }

  async function requestService(s,options,deadline) {
    await ensureService();
    const remaining=deadline-now();
    if (remaining<=auditReserveMs) return {status:'time_limit',reason:'Call budget exhausted before IPC/native solve.',rows:[],hasIncumbent:false,solverStatus:null,solverTimeLimitMs:0};
    const id=nextId++;
    const request={id,scenario:s,fixedEvents:options.fixedEvents??{},minEventDay:options.minEventDay??0,
      objectiveMode:'joint',auditReserveMs,deadlineUnixMs:Date.now()+remaining};
    // Serialization, pipe delivery and Python JSON parsing occur after the
    // absolute deadline has been fixed, so none receives a fresh allowance.
    const encoded=JSON.stringify(request)+'\n';
    if (now()>=deadline) return {status:'time_limit',reason:'Call budget exhausted during input serialization.',rows:[],hasIncumbent:false,solverStatus:null,solverTimeLimitMs:0};
    solverCalls++;
    return await new Promise((resolve,reject)=>{
      pending.set(id,{resolve,reject});
      child.stdin.write(encoded,error=>{
        if (error && pending.has(id)) { pending.delete(id); reject(error); }
      });
    });
  }

  async function planner(scenario,callOptions={}) {
    if (closed) throw new Error('Native planner is closed.');
    if (busy) throw new Error('One native planner accepts sequential calls from one episode only.');
    const started=now(),s=structuredClone(scenario),options={...structuredClone(defaults),...structuredClone(callOptions)};
    const budget=options.timeBudgetMs??(options.timeLimitSeconds!==undefined?options.timeLimitSeconds*1000:defaultBudget);
    if (!Number.isFinite(budget) || budget<=0) throw new Error('timeBudgetMs must be positive and finite.');
    validateInput(s,options);
    busy=true; calls++;
    const deadline=started+budget,stages={},minimum=options.minEventDay??0;
    // Changes in capacities and tariffs are intentionally absent: a cached plan
    // is always repriced and reaudited against the entire CURRENT snapshot.
    const episodeKey=JSON.stringify({horizonStart:s.horizonStart,horizonDays:s.horizonDays,operations:s.operations??{},
      id:s.id??null,seed:s.seed??null,containers:s.containers.map(c=>[c.id,c.sizeFt,c.releaseDay,c.unloadDays,c.dueDay,c.dischargeDateTime])});
    const episodeResetReason=lastEpisodeKey!==null&&(episodeKey!==lastEpisodeKey||minimum<lastDay)?episodeKey!==lastEpisodeKey?'different_episode_reset':'backwards_day_reset':null;
    if(episodeResetReason){cached=null;cacheKey=null;}
    lastEpisodeKey=episodeKey;lastDay=minimum;
    let best=null,source='no_complete_plan',native=null,timer=null,hardTimeout=false,rejectedCandidate=false;
    const selection={rule:'strict_fee_then_lower_next_day_mandatory_warehouse_on_ties',feeEpsilonKRW:FEE_EPSILON_KRW,
      cacheStatus:cached?cacheKey!==episodeKey?'different_episode':!retainCacheFallback?'fallback_disabled':'deadline_expired':episodeResetReason??'absent',cacheValid:false,episodeResetReason,
      beforeDates:cached&&cacheKey===episodeKey?structuredClone(cached):null,beforeFees:null,
      proposalDates:null,proposalFees:null,afterDates:null,afterFees:null,
      nativeCostMinusCacheKRW:null,cacheCostMinusSelectedKRW:null,changedEventCount:null,proposalChangedEventCount:null,
      decisionReason:'no_valid_candidate',selectedSource:source,
      preNativeIncumbent:null,
      constructorDelivery:{budgetMs:constructorBudgetMs,auditReserveMs:constructorAuditReserveMs,maxRestarts,deadlineAtMs:null,events:[],firstAcceptedAtMs:null,selectedAcceptanceAtMs:null,returnedResultUsedAsReceipt:false},
      commitmentScore:{attempted:false,complete:false,cache:null,proposal:null,beforeM:null,proposalM:null,selectedM:null,startedAtMs:null,finishedAtMs:null,timely:null,skipReason:'no_valid_fee_tie',error:null},
      publicCapacities:Object.fromEntries(['truck','warehouse','staging'].map(resource=>[resource,Array.from({length:s.horizonDays},(_,d)=>Array.isArray(s[resource+'Capacity'])?s[resource+'Capacity'][d]:s[resource+'Capacity'])])),
      cacheGate:{auditFinishedAtMs:null,selectionFinishedAtMs:null,acceptedAtMs:null},
      nativeGate:{receivedAtMs:null,copiedAtMs:null,auditFinishedAtMs:null,feesMatchedAtMs:null,selectionFinishedAtMs:null,acceptedAtMs:null,outcome:'not_requested'}};
    const metadata=()=>({method:'v12-seeded-native-commitment-slack',decisionCalls:calls,solverCalls,candidateSource:source,
      timeBudgetMs:budget,wallTimeMs:now()-started,deadlineOverrunMs:Math.max(0,now()-deadline),cooperativeDeadline:true,
      hardOverrunGraceMs,hardTimeout,solverThreads:1,retainCacheFallback,stages,
      strictReplacementCount,tieRetainedCount,commitmentReplacementCount,constructorCalls,acceptedConstructorReceipts,stabilitySelection:selection,
      startupWallMs,readyCalledBeforeDecision:stages.readyAtCallStart,
      nativeService:readinessInfo,nativeCertificate:native,
      budgetScope:'clone + validation + cache audit + 40ms-capped constructor including synchronous receipt/audit/selection + lazy startup if needed + serialization/IPC + Python model/solve/audit + JS audit + complete commitment scoring/selection',
      optimalityScope:'current observed deterministic model only; never rolling policy optimum'});
    try {
      stages.readyAtCallStart=Boolean(readinessInfo);
      if (cached && cacheKey===episodeKey && retainCacheFallback && now()<deadline) {
        const checked=audited(s,cached,options);
        selection.cacheGate.auditFinishedAtMs=now()-started;
        selection.cacheValid=checked.valid;selection.cacheStatus=checked.valid?'valid':'invalid';
        stages.cacheAudit={...checked,rows:undefined};
        if(checked.rows.length===s.containers.length)selection.beforeFees=feesOf(summarize(s,'seededHiGHSV12',checked.rows,0,'feasible',{objectiveMode:'joint'}));
        if (checked.valid) {
          const candidate=summarize(s,'seededHiGHSV12',checked.rows,now()-started,'feasible',{objectiveMode:'joint',optimality:'retained_audited_incumbent_not_reoptimized'});
          const cacheSelection={afterDates:datesOf(candidate.rows),afterFees:feesOf(candidate),cacheCostMinusSelectedKRW:0,changedEventCount:0,decisionReason:'retain_without_timely_valid_native',selectedSource:'cached_incumbent'};
          selection.cacheGate.selectionFinishedAtMs=now()-started;
          const acceptedAt=now();
          if (acceptedAt<=deadline) {
            best=candidate; source='cached_incumbent';Object.assign(selection,cacheSelection);
            selection.cacheGate.acceptedAtMs=acceptedAt-started;
          }
        }
      }
      if(!best){
        const constructionDeadline=Math.min(started+constructorBudgetMs,deadline-constructorAuditReserveMs);
        const delivery=selection.constructorDelivery;delivery.deadlineAtMs=constructionDeadline-started;
        if(now()<constructionDeadline){
          constructorCalls++;const constructionStarted=now();let constructionOpen=true;
          const onCandidate=candidate=>{
            const event={sequence:delivery.events.length+1,source:'quick_constructor',receivedAtMs:now()-started,copiedAtMs:null,auditFinishedAtMs:null,selectionFinishedAtMs:null,acceptedAtMs:null,proposedDates:null,dates:null,fees:null,outcome:null,audit:null};
            delivery.events.push(event);
            const reject=(outcome,rejectedAt=now())=>{event.outcome=outcome;event.rejectedAtMs=rejectedAt-started;return false;};
            if(!constructionOpen)return reject('construction_phase_closed');
            if(started+event.receivedAtMs>constructionDeadline)return reject('late_receipt');
            if(!['feasible','optimal'].includes(candidate?.status))return reject('invalid_status');
            let copy,checked;
            try{
              copy=structuredClone(candidate);
              event.proposedDates=Array.isArray(copy.rows)?copy.rows.map(row=>row&&typeof row==='object'?Object.fromEntries(['id',...FIELDS].map(field=>[field,row[field]])):row):null;
              event.copiedAtMs=now()-started;
              if(started+event.copiedAtMs>constructionDeadline)return reject('late_copy');
              checked=audited(s,copy.rows,options);event.audit={valid:checked.valid,errors:[...checked.errors]};
              event.auditFinishedAtMs=now()-started;
              if(!checked.valid)return reject('invalid_candidate');
              if(started+event.auditFinishedAtMs>constructionDeadline)return reject('late_audit');
              const canonical=summarize(s,'seededHiGHSV12',checked.rows,now()-started,'feasible',{objectiveMode:'joint',optimality:'timely_constructed_incumbent_not_optimal'});
              event.dates=datesOf(canonical.rows);event.fees=feesOf(canonical);
              const selected=!best||canonical.objectiveCost<best.objectiveCost-FEE_EPSILON_KRW;
              const proposedSelection={afterDates:datesOf((selected?canonical:best).rows),afterFees:feesOf(selected?canonical:best),
                changedEventCount:selection.cacheValid?changedEvents(selection.beforeDates,datesOf((selected?canonical:best).rows)):null,
                cacheCostMinusSelectedKRW:selection.cacheValid&&selection.beforeFees?selection.beforeFees.objectiveCost-(selected?canonical:best).objectiveCost:null,
                selectedSource:selected?'quick_constructor':source,decisionReason:selected?'timely_complete_constructor':'retain_better_constructor_incumbent'};
              event.selectionFinishedAtMs=now()-started;
              const acceptedAt=now();
              if(acceptedAt>constructionDeadline)return reject('late_selection',acceptedAt);
              if(!selected)return reject('not_improved');
              best=canonical;source='quick_constructor';Object.assign(selection,proposedSelection);
              event.acceptedAtMs=acceptedAt-started;event.outcome='accepted';
              delivery.firstAcceptedAtMs??=event.acceptedAtMs;delivery.selectedAcceptanceAtMs=event.acceptedAtMs;acceptedConstructorReceipts++;
              return true;
            }catch(error){event.error=error instanceof Error?error.message:String(error);return reject('candidate_error');}
          };
          try{
            const constructed=await seedConstructor(structuredClone(s),{...structuredClone(options),maxRestarts,objectiveMode:'joint',deadlineMs:constructionDeadline,timeBudgetMs:Math.max(0,constructionDeadline-now()),now,onCandidate});
            // Only actual synchronous callback receipts are eligible. A returned
            // duplicate or self-reported first-incumbent time cannot backdate
            // outer delivery or create a previously unreceived seed.
            stages.quickConstructor={status:constructed?.status??'missing_result',wallTimeMs:now()-constructionStarted,
              constructorMetadata:structuredClone(constructed?.constructorMetadata??{}),returnedCompleteCandidate:constructed?.rows?.length===s.containers.length,
              returnedCandidateAccepted:false,acceptedReceiptCount:delivery.events.filter(e=>e.outcome==='accepted').length};
          }catch(error){stages.quickConstructor={status:'constructor_error',reason:error instanceof Error?error.message:String(error),wallTimeMs:now()-constructionStarted};}
          finally{constructionOpen=false;}
        }else stages.quickConstructor={status:'budget_skipped'};
      }else stages.quickConstructor={status:'valid_cache_skip'};
      if(best)selection.preNativeIncumbent={source,dates:datesOf(best.rows),fees:feesOf(best),
        acceptedAtMs:source==='quick_constructor'?selection.constructorDelivery.selectedAcceptanceAtMs:selection.cacheGate.acceptedAtMs};
      if (now()+auditReserveMs<deadline) {
        const timeout=new Promise(resolve=>{
          timer=setTimeout(()=>{
            hardTimeout=true; child?.kill('SIGKILL');
            resolve({status:'time_limit',reason:'Native call exceeded the whole-call deadline plus declared hard overrun grace.',rows:[],hasIncumbent:false,solverStatus:null,hardTimeout:true});
          },Math.max(1,deadline-now()+hardOverrunGraceMs));
        });
        try { native=await Promise.race([requestService(s,options,deadline),timeout]); }
        catch (error) { native={status:'solver_error',reason:error instanceof Error?error.message:String(error),rows:[],hasIncumbent:false,solverStatus:null}; }
        finally { clearTimeout(timer); }
        selection.nativeGate.receivedAtMs=now()-started;
        selection.nativeGate.outcome='no_incumbent';
        stages.native={status:native.status,solverStatus:native.solverStatus??null,hasIncumbent:Boolean(native.hasIncumbent)};
        if (native.hasIncumbent) {
          const proposal=structuredClone(native.rows);
          selection.proposalDates=Array.isArray(proposal)?proposal.map(row=>row&&typeof row==='object'?Object.fromEntries(['id',...FIELDS].map(field=>[field,row[field]])):row):null;
          selection.nativeGate.copiedAtMs=now()-started;
          const checked=audited(s,proposal,options);
          selection.nativeGate.auditFinishedAtMs=now()-started;
          stages.native.audit={...checked,rows:undefined};
          if(checked.rows.length===s.containers.length)selection.proposalFees=feesOf(summarize(s,'seededHiGHSV12',checked.rows,0,'feasible',{objectiveMode:'joint'}));
          if (!checked.valid) {rejectedCandidate=true;selection.nativeGate.outcome='audit_failed';}
          if (checked.valid) {
            const result=summarize(s,'seededHiGHSV12',checked.rows,now()-started,native.provenOptimal?'optimal':'feasible',{
              objectiveMode:'joint',optimality:native.provenOptimal?'current_observed_model_optimal_with_solver_tolerances':'current_observed_model_feasible_incumbent',
            });
            selection.proposalFees=feesOf(result);
            if(selection.preNativeIncumbent){selection.nativeCostMinusIncumbentKRW=result.objectiveCost-selection.preNativeIncumbent.fees.objectiveCost;}
            if(selection.cacheValid&&selection.beforeFees){
              selection.nativeCostMinusCacheKRW=result.objectiveCost-selection.beforeFees.objectiveCost;
              selection.proposalChangedEventCount=changedEvents(selection.beforeDates,selection.proposalDates);
            }
            // Both languages independently recompute fees from dates. Python
            // costs never overwrite the product engine's canonical row prices.
            const costMatch=result.objectiveCost===native.objectiveCost && COSTS.every(key=>result[key]===native.independentCosts?.[key]);
            stages.native.independentCostsMatch=costMatch;
            selection.nativeGate.feesMatchedAtMs=now()-started;
            if (!costMatch) {rejectedCandidate=true;selection.nativeGate.outcome='fee_mismatch';}
            if (checked.valid && costMatch) {
              const hasCurrentCache=Boolean(best);
              const difference=hasCurrentCache?result.objectiveCost-best.objectiveCost:null;
              const strictReplacement=hasCurrentCache&&difference < -FEE_EPSILON_KRW;
              selection.feeRelation=!hasCurrentCache?'no_current_cache':strictReplacement?'lower':Math.abs(difference)<=FEE_EPSILON_KRW?'equal':'higher';
              const feeTie=hasCurrentCache&&Math.abs(difference)<=FEE_EPSILON_KRW;
              let lowerCommitment=false;
              if(feeTie&&now()<deadline){
                const scoring=selection.commitmentScore;scoring.attempted=true;scoring.skipReason=null;scoring.startedAtMs=now()-started;
                try{
                  scoring.cache=scoreCommitmentSlackV11(s,best.rows,{...options,deadlineMs:deadline,now});
                  if(scoring.cache.complete&&now()<deadline)scoring.proposal=scoreCommitmentSlackV11(s,result.rows,{...options,deadlineMs:deadline,now});
                  scoring.complete=Boolean(scoring.cache.complete&&scoring.proposal?.complete);
                  scoring.beforeM=scoring.cache.complete?scoring.cache.mandatoryWarehouseTomorrow:null;
                  scoring.proposalM=scoring.proposal?.complete?scoring.proposal.mandatoryWarehouseTomorrow:null;
                  lowerCommitment=scoring.complete&&scoring.proposalM<scoring.beforeM;
                  scoring.selectedM=scoring.cache.complete?scoring.beforeM:null;
                }catch(error){scoring.error=error instanceof Error?error.message:String(error);}
                scoring.finishedAtMs=now()-started;scoring.timely=scoring.finishedAtMs<=budget;
                // Full score and final selection must both finish before the
                // original shared V12 call deadline; a partial M is never zero.
                if(now()>deadline)lowerCommitment=false;
              }
              const nativeSelected=!hasCurrentCache||strictReplacement||lowerCommitment;
              const decisionReason=nativeSelected?strictReplacement?'strict_fee_replacement':lowerCommitment?'equal_fee_lower_mandatory_warehouse':selection.cacheStatus==='invalid'?'replace_invalid_cache':'initialize_native':feeTie?selection.commitmentScore.attempted&&!selection.commitmentScore.complete?'retain_fee_tie_incomplete_commitment_score':'retain_fee_tie_no_lower_mandatory_warehouse':'retain_costlier_native';
              const proposedSelection={afterDates:datesOf((nativeSelected?result:best).rows),afterFees:feesOf(nativeSelected?result:best),
                cacheCostMinusSelectedKRW:selection.cacheValid&&selection.beforeFees?selection.beforeFees.objectiveCost-(nativeSelected?result:best).objectiveCost:null,
                changedEventCount:selection.cacheValid?changedEvents(selection.beforeDates,datesOf((nativeSelected?result:best).rows)):null,
                decisionReason,selectedSource:nativeSelected?'native_highs':source};
              selection.nativeGate.selectionFinishedAtMs=now()-started;
              const acceptedAt=now();
              if (acceptedAt<=deadline) {
                Object.assign(selection,proposedSelection);
                selection.nativeGate.outcome=decisionReason;
                if(nativeSelected){best=result;source='native_highs';selection.nativeGate.acceptedAtMs=acceptedAt-started;}
                if(selection.commitmentScore.complete)selection.commitmentScore.selectedM=lowerCommitment?selection.commitmentScore.proposalM:selection.commitmentScore.beforeM;
                if(strictReplacement)strictReplacementCount++;
                else if(lowerCommitment)commitmentReplacementCount++;
                else if(feeTie)tieRetainedCount++;
              }else {stages.native.lateCandidateDiscarded=true;selection.nativeGate.outcome='late_candidate';selection.nativeGate.rejectedAtMs=acceptedAt-started;}
            }
          }
        }
        if (native.provenInfeasible && best) stages.native.infeasibilityContradictsAuditedIncumbent=true;
      } else stages.native={status:'budget_skipped',reason:'No time remains after input/cached-candidate work.'};
      if (best) {
        cached=best.rows.map(row=>Object.fromEntries(['id',...FIELDS].map(field=>[field,row[field]]))); cacheKey=episodeKey;
        return {...best,modelVersion:'v12-seeded-native-commitment-slack',runtimeMs:now()-started,plannerMetadata:metadata(),
          solver:'HiGHS via scipy.optimize.milp',solverStatus:native?.solverStatus??null,
          executionConstraints:{minEventDay:minimum,lockedEventCount:Object.values(options.fixedEvents??{}).reduce((sum,locks)=>sum+Object.keys(locks).length,0)}};
      }
      const late=now()>deadline || hardTimeout;
      const status=late?'time_limit':rejectedCandidate?'audit_failed':native?.provenInfeasible?'infeasible':native?.status==='solver_error'?'solver_error':'time_limit';
      const reason=late?'No complete candidate passed both audits within the whole-call budget.':rejectedCandidate?'Native incumbent rejected by independent dates, execution-lock or fee reconciliation audit.':native?.reason??'Whole-call budget consumed before native planning.';
      return {...failure(status,reason),runtimeMs:now()-started,plannerMetadata:metadata(),solverStatus:native?.solverStatus??null};
    } finally { busy=false; clearTimeout(timer); }
  }

  planner.ready=async({timeoutMs=initializationTimeoutMs}={})=>{
    if (!Number.isFinite(timeoutMs) || timeoutMs<=0) throw new Error('Readiness timeout must be positive and finite.');
    return await ensureService(timeoutMs);
  };
  planner.close=async()=>{
    if (closed) return;
    closed=true;
    rejectPending(new Error('Native planner was closed.'));
    reader?.close();
    if (child && child.exitCode===null && child.signalCode===null) {
      child.stdin.end(); child.kill('SIGTERM');
      await new Promise(resolve=>{
        const timer=setTimeout(()=>{child.kill('SIGKILL');resolve();},500);
        child.once('exit',()=>{clearTimeout(timer);resolve();});
      });
    }
  };
  return planner;
}
