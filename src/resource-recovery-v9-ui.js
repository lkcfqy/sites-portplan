import './resource-recovery-v9.css';
import {addDays} from './engine.js';
import {RESOURCE_RECOVERY_HARD_WALL_MS_V9, RESOURCE_RECOVERY_SCOPE_V9,
  auditResourceRecoveryResultV9, makeResourceRecoveryFixtureV9, prepareResourceRecoveryInputV9,
  resourceRecoveryStatusV9} from './resource-recovery-v9.worker.js';

const COPY={
  zh:{title:'资源不足时，先算清补救代价',subtitle:'在明确的资源菜单、日期与价格假设下，寻找完整提箱、卸货和还空方案。',
    scope:'这是当前观察快照的反事实建议。不会执行采购、派车或合同变更；也不保证未来未公告变化下可执行。',
    emptyMenu:'真实资源菜单默认留空。请只填写自己已经核实的报价、可用时间与授权；页面不会提供真实供应商或虚构权限。',
    current:'使用工作台当前订单',rescue:'教学：可补救',impossible:'教学：菜单内无解',example:'两个教学例子使用刻意构造的合成订单、合成价格和假设授权，不代表企业报价、总体成绩或真实节省。',
    scenario:'当前已观察订单与容量 · JSON',actions:'可考虑的资源动作菜单 · JSON',context:'当前日期与此前已执行锁 · JSON',
    contextHint:'minEventDay 从 0 起；fixedEvents 只记录严格早于当前日的真实既往动作，日期字段为 pickupDay / unloadDay / returnDay。不要粘贴未公告的未来冲击。',
    actionHint:'每个动作是一次全有或全无的资源包：id、resource、days（生效日期数组）、units（每日增量）、priceKRW（整包总价）、earliestAvailableDay（最早可获得日）、authorized（授权假设）。每包最多选一次。',
    objective:'本次优化目标',procurement:'仅最小采购费',combined:'最小新增两费 + 采购费',
    procurementNote:'仅采购费目标可能选择两费更高的日期；合计目标同时考虑新增堆存费、D&D 与采购费。已发生两费属于沉没费用，不随采购选择变化。',
    validate:'检查输入',run:'计算补救建议',stop:'停止',exportInput:'导出当前输入',exportResult:'导出本次结果',
    budget:'在独立后台线程计算；求解合作式预算 1 秒，父页面从线程启动到接收及独立终态审核限时 5 秒。超时没有完整可信结果，金额为 null。',
    awaiting:'载入教学例子，或填写自己的快照与资源菜单，再运行。',loaded:'已载入；请核实输入后重新运行。',valid:'输入检查通过。',invalid:'输入检查未通过：',
    noScenario:'工作台没有可载入的订单。',running:'正在计算并审核补救方案…',stale:'输入已修改。下方是上一次输入的结果，不能作为当前输入的建议。',
    cancelled:'已停止；没有取得本次可信终态。',timeout:'5 秒内未完成接收及终态审核；本次结果未知。',workerError:'未取得可信终态：',
    menu:'本次输入的资源菜单',noActions:'动作菜单为空，不会假设额外资源、真实报价或采购权限。',
    action:'动作',resource:'资源',dates:'容量生效日期',quantity:'每日增量',price:'整项采购费 / ₩',available:'可获得日',authorized:'假设已授权',selected:'选中',excluded:'排除原因',
    yes:'是',no:'否',truck:'运输箱次',warehouse:'卸货槽',staging:'在场占用单位',
    result:'本次反事实补救结果',optimalProcurement:'已证明菜单内最小采购费',optimalCombined:'已证明菜单内最小“新增两费 + 采购费”',
    feasible:'完整可行建议；尚未证明目标最小',infeasible:'已证明当前菜单与约束下无完整方案',unknown:'未取得完整可信方案；不能证明无解',
    provenNote:'“最小”仅指求解器对本次有限动作菜单与日级模型的证明。父页面另行重算容量、执行锁与费用，不独立重做最优性证明。',
    notProven:'仅找到可行候选或未取得完整候选，不可称为最小资源补救。',
    counterfactual:'以下只是建议，未执行任何资源购买。',procurementFee:'采购费 / ₩',incrementalFee:'新增堆存费 + D&D / ₩',totalFee:'含已发生部分的总两费 / ₩',
    combinedIncremental:'采购费 + 新增两费 / ₩',combinedTotal:'采购费 + 总两费 / ₩',incomplete:'没有经独立审核的完整计划，所有完整金额保持 null。',
    selectedActions:'建议选择的动作',excludedActions:'未考虑的动作与原因',noSelected:'未选择额外资源。',noExcluded:'没有记录被排除的动作。',
    plan:'已审核的完整日期建议',id:'箱号',pickup:'提箱',unload:'开始卸货',return:'还空',parentWall:'父页面墙钟 / ms',
    rawInput:'本次实际计算的输入与范围',rawResult:'本次原始结果与证明信息',exportError:'请先运行一次计算。',
    custom:'用户输入 / 未核验',synthetic:'合成教学假设',model:'当前观察快照；已知订单；日级模型；没有未来路径保证。',
    edited:'编辑后的输入标记为未核验；在编辑器中写 authorized:true 只是本地假设，不会获得实际采购权限。',
  },
  ko:{title:'자원이 부족하면 복구 비용부터 계산합니다',subtitle:'명시한 자원 메뉴·날짜·가격 가정 아래 반출·적출·공컨테이너 반납의 완전 계획을 찾습니다.',
    scope:'현재 관측 스냅샷에 대한 반사실 권고입니다. 구매·배차·계약 변경을 실행하지 않으며, 아직 공지되지 않은 미래 변화에서 실행 가능함을 보장하지 않습니다.',
    emptyMenu:'실제 자원 메뉴의 기본값은 비어 있습니다. 직접 확인한 견적·가용 시점·권한만 입력하세요. 실제 공급업체나 가상의 권한을 제공하지 않습니다.',
    current:'작업대 현재 주문 가져오기',rescue:'학습: 복구 가능',impossible:'학습: 메뉴 내 불가능',example:'두 예시는 의도적으로 만든 합성 주문·가격·권한 가정을 사용하며 기업 견적·전체 성과·실현 절감액이 아닙니다.',
    scenario:'현재 관측 주문과 용량 · JSON',actions:'검토할 자원 행동 메뉴 · JSON',context:'현재 날짜와 이전 실행 잠금 · JSON',
    contextHint:'minEventDay는 0부터 시작합니다. fixedEvents에는 현재 날짜보다 엄격히 이른 실제 과거 행동만 pickupDay / unloadDay / returnDay로 기록하세요. 미공지 미래 충격은 붙여 넣지 마세요.',
    actionHint:'각 행동은 전량 선택 또는 미선택하는 자원 묶음입니다: id, resource, days(적용 날짜 배열), units(일별 증분), priceKRW(전체 묶음 가격), earliestAvailableDay(최초 가용일), authorized(권한 가정). 묶음은 한 번만 선택합니다.',
    objective:'이번 최적화 목표',procurement:'구매비만 최소화',combined:'추가요금 + 구매비 최소화',
    procurementNote:'구매비만 최소화하면 날짜별 요금이 더 높을 수 있습니다. 합계 목표는 추가 장치료·D&D와 구매비를 고려합니다. 이미 발생한 요금은 매몰비용으로 구매 선택에 따라 변하지 않습니다.',
    validate:'입력 검사',run:'복구 권고 계산',stop:'중지',exportInput:'현재 입력 내보내기',exportResult:'이번 결과 내보내기',
    budget:'독립 Worker에서 계산합니다. 협력식 풀이 예산은 1초이며, 부모 페이지는 시작부터 수신·독립 최종 검사까지 5초를 적용합니다. 기한을 넘으면 신뢰할 완전 결과가 없고 금액은 null입니다.',
    awaiting:'학습 예시를 불러오거나 자신의 스냅샷·자원 메뉴를 입력한 뒤 실행하세요.',loaded:'불러왔습니다. 입력을 확인하고 다시 실행하세요.',valid:'입력 검사를 통과했습니다.',invalid:'입력 검사 실패: ',
    noScenario:'작업대에 가져올 주문이 없습니다.',running:'복구 계획을 계산하고 검사 중…',stale:'입력이 변경되었습니다. 아래 결과는 이전 입력에 대한 것으로 현재 입력의 권고가 아닙니다.',
    cancelled:'중지하여 이번 신뢰할 최종 결과가 없습니다.',timeout:'5초 안에 수신과 최종 검사를 완료하지 못해 이번 결과는 미확정입니다.',workerError:'신뢰할 최종 결과 미확보: ',
    menu:'이번 입력의 자원 메뉴',noActions:'메뉴가 비어 있어 추가 자원·실제 견적·구매 권한을 가정하지 않습니다.',
    action:'행동',resource:'자원',dates:'증분 적용 날짜',quantity:'일별 증분',price:'전체 구매비 / ₩',available:'가용일',authorized:'권한 가정',selected:'선택',excluded:'제외 사유',
    yes:'예',no:'아니요',truck:'운송 작업 횟수',warehouse:'적출 슬롯',staging:'체류 점유 단위',
    result:'이번 반사실 복구 결과',optimalProcurement:'메뉴 내 최소 구매비 증명',optimalCombined:'메뉴 내 최소 추가요금 + 구매비 증명',
    feasible:'완전한 실행 가능 권고 · 목표 최솟값 미증명',infeasible:'현재 메뉴·제약에서 완전 계획 불가능 증명',unknown:'신뢰할 완전 계획 미확보 · 불가능 증명 아님',
    provenNote:'최소는 이번 유한 행동 메뉴와 일 단위 모형에 대한 solver 증명만 뜻합니다. 부모 페이지는 용량·실행 잠금·요금을 다시 계산하며 최적성 증명을 독립적으로 재풀이하지는 않습니다.',
    notProven:'실행 가능 후보만 찾았거나 완전 후보가 없어 최소 자원 복구라고 부를 수 없습니다.',
    counterfactual:'아래는 권고이며 어떤 자원 구매도 실행하지 않았습니다.',procurementFee:'구매비 / ₩',incrementalFee:'추가 장치료 + D&D / ₩',totalFee:'이미 발생한 부분 포함 총요금 / ₩',
    combinedIncremental:'구매비 + 추가요금 / ₩',combinedTotal:'구매비 + 총요금 / ₩',incomplete:'독립 검사를 통과한 완전 계획이 없어 모든 완전 금액은 null로 유지합니다.',
    selectedActions:'선택 권고 행동',excludedActions:'제외 행동과 사유',noSelected:'추가 자원을 선택하지 않았습니다.',noExcluded:'기록된 제외 행동이 없습니다.',
    plan:'검사된 완전 날짜 권고',id:'컨테이너',pickup:'반출',unload:'적출 시작',return:'반납',parentWall:'부모 페이지 경과 / ms',
    rawInput:'실제 계산한 이번 입력과 범위',rawResult:'이번 원결과와 증명 정보',exportError:'먼저 한 번 계산하세요.',
    custom:'사용자 입력 / 미검증',synthetic:'합성 학습 가정',model:'현재 관측 스냅샷·알려진 주문·일 단위 모형이며 미래 전체 경로 보장은 없습니다.',
    edited:'편집 입력은 미검증으로 표시합니다. authorized:true 입력은 로컬 가정일 뿐 실제 구매 권한을 얻는 것이 아닙니다.',
  },
};
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
const json=value=>JSON.stringify(value,null,2);
function button(text,action,primary=false){const e=node('button','button'+(primary?' primary':''),text);e.type='button';e.addEventListener('click',action);return e;}
function table(headers,rows){const wrap=node('div','resource-recovery-v9-table-wrap'),t=node('table','data-table'),head=node('thead'),tr=node('tr'),body=node('tbody');for(const text of headers)tr.append(node('th','',text));head.append(tr);for(const values of rows){const row=node('tr');for(const value of values)row.append(node('td','',value??'—'));body.append(row);}t.append(head,body);wrap.append(t);return wrap;}
function details(title,value){const e=node('details','resource-recovery-v9-raw');e.append(node('summary','',title),node('pre','',json(value)));return e;}
function download(name,value){const url=URL.createObjectURL(new Blob([json(value)],{type:'application/json'})),a=node('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}

export function mountResourceRecoveryV9UI(container,{getScenario}={}){
  let language='zh',origin='synthetic-fixture',objectiveMode='procurementOnly',snapshotText='',actionsText='[]',contextText=json({minEventDay:0,fixedEvents:{}});
  let notice='',noticeError=false,busy=false,destroyed=false,generation=0,active=null,draftRevision=0,runRevision=-1,runInput=null,result=null;
  const initial=makeResourceRecoveryFixtureV9('rescue');snapshotText=json(initial.snapshot);
  try{const current=getScenario?.();if(current){snapshotText=json(prepareResourceRecoveryInputV9({snapshot:current,actions:[],minEventDay:0,fixedEvents:{},objectiveMode}).snapshot);origin='user-custom-unverified';}}catch{/* A malformed workbench is reported only when the user chooses to import it. */}
  container.classList.add('resource-recovery-v9');
  const t=()=>COPY[language];
  const number=value=>Number.isFinite(value)?new Intl.NumberFormat(language==='ko'?'ko-KR':'zh-CN',{maximumFractionDigits:2}).format(value):'null';
  const day=value=>Number.isInteger(value)?`D+${value}`:'—';
  const date=value=>runInput&&Number.isInteger(value)?`${day(value)} · ${addDays(runInput.snapshot.horizonStart,value)}`:day(value);
  function setNotice(text,error=false){notice=text;noticeError=error;}
  function parse(){if(snapshotText.length>1024*1024||actionsText.length>256*1024||contextText.length>128*1024)throw new Error('Input JSON exceeds the editor size limit.');const context=JSON.parse(contextText);if(!context||typeof context!=='object'||Array.isArray(context))throw new Error('The current date and locks context must be an object.');return prepareResourceRecoveryInputV9({snapshot:JSON.parse(snapshotText),actions:JSON.parse(actionsText),minEventDay:context.minEventDay,fixedEvents:context.fixedEvents,objectiveMode,inputOrigin:origin});}
  function invalidate(){draftRevision++;origin='user-custom-unverified';const stale=container.querySelector('[data-recovery-stale]');if(stale)stale.hidden=!runInput||runRevision===draftRevision;}
  function fixture(kind){stop();const input=makeResourceRecoveryFixtureV9(kind);snapshotText=json(input.snapshot);actionsText=json(input.actions);contextText=json({minEventDay:input.minEventDay,fixedEvents:input.fixedEvents});origin=input.inputOrigin;draftRevision++;setNotice(t().loaded);render();}
  function loadCurrent(){stop();try{const current=getScenario?.();if(!current)throw new Error(t().noScenario);const input=prepareResourceRecoveryInputV9({snapshot:current,actions:[],minEventDay:0,fixedEvents:{},objectiveMode});snapshotText=json(input.snapshot);actionsText='[]';contextText=json({minEventDay:0,fixedEvents:{}});origin='user-custom-unverified';draftRevision++;setNotice(t().loaded);}catch(error){setNotice(t().invalid+error.message,true);}render();}
  function check(){try{parse();setNotice(t().valid);}catch(error){setNotice(t().invalid+error.message,true);}render();}
  function unknown(status,reason,parentWallMs){return {status,rows:[],selectedActions:[],excludedActions:[],procurementCostKRW:null,storageCost:null,ddCost:null,sunkCost:null,incrementalCost:null,totalCost:null,objectiveCostKRW:null,combinedIncrementalCostKRW:null,combinedTotalCostKRW:null,audit:{valid:false,errors:[reason]},proof:{minimumProcurementProven:false,minimumObjectiveProven:false,infeasibleWithinMenuProven:false},counterfactual:true,purchaseExecuted:false,scope:RESOURCE_RECOVERY_SCOPE_V9,parentWallMs,reason};}
  function stop(){if(!busy)return;active?.cancel();generation++;busy=false;setNotice(t().cancelled);render();}
  async function run(){let input;try{input=parse();}catch(error){setNotice(t().invalid+error.message,true);render();return;}const token=++generation;runInput=input;runRevision=draftRevision;result=null;busy=true;setNotice('');render();const started=performance.now();
    const terminal=await new Promise(resolve=>{let worker,timer,finished=false;function finish(value){if(finished)return;finished=true;clearTimeout(timer);worker?.terminate();active=null;resolve(value);}active={cancel:()=>{const value=unknown('cancelled',t().cancelled,performance.now()-started);result=value;finish(value);}};
      try{worker=new Worker(new URL('./resource-recovery-v9.worker.js',import.meta.url),{type:'module'});timer=setTimeout(()=>finish(unknown('hard_time_limit',t().timeout,performance.now()-started)),RESOURCE_RECOVERY_HARD_WALL_MS_V9);
        worker.onmessage=({data:message})=>{if(finished||token!==generation||message.id!==token)return;const elapsed=()=>performance.now()-started;if(elapsed()>RESOURCE_RECOVERY_HARD_WALL_MS_V9){finish(unknown('hard_time_limit',t().timeout,elapsed()));return;}if(message.error){finish(unknown('worker_error',t().workerError+message.error,elapsed()));return;}try{const audit=auditResourceRecoveryResultV9(input,message.result);if(!audit.valid)throw new Error(audit.errors.join('; '));const wall=elapsed();finish(wall>RESOURCE_RECOVERY_HARD_WALL_MS_V9?unknown('hard_time_limit',t().timeout,wall):{...message.result,parentWallMs:wall,parentTerminalAudit:audit});}catch(error){finish(unknown('worker_error',t().workerError+error.message,elapsed()));}};
        worker.onerror=event=>finish(unknown('worker_error',t().workerError+(event.message??''),performance.now()-started));worker.postMessage({id:token,input:structuredClone(input)});
      }catch(error){finish(unknown('worker_error',t().workerError+error.message,performance.now()-started));}
    });if(token!==generation||destroyed)return;result=terminal;busy=false;render();
  }
  function exportInput(){try{download('portplan-resource-recovery-v9-input.json',{...parse(),parentHardWallMs:RESOURCE_RECOVERY_HARD_WALL_MS_V9});}catch(error){setNotice(t().invalid+error.message,true);render();}}
  function exportResult(){if(!runInput||!result){setNotice(t().exportError,true);render();return;}download('portplan-resource-recovery-v9-result.json',{schemaVersion:'portplan-resource-recovery-v9-local-result',createdAt:new Date().toISOString(),input:runInput,result,currentInputMatchesRun:runRevision===draftRevision,scope:RESOURCE_RECOVERY_SCOPE_V9,parentHardWallMs:RESOURCE_RECOVERY_HARD_WALL_MS_V9,purchaseExecuted:false});}
  function reasonName(reason){return ({zh:{not_authorized:'没有授权假设',would_change_past_capacity:'涉及已过去日期，不能追改容量',before_earliest_availability:'生效日早于最早可获得日'},ko:{not_authorized:'권한 가정 없음',would_change_past_capacity:'과거 날짜의 용량을 소급 변경할 수 없음',before_earliest_availability:'최초 가용일보다 이른 적용 날짜'}}[language][reason]??reason);}
  function reasonsText(action){return action.reasons?.map(reasonName).join('；')??action.reason??'—';}
  function menuTable(actions,excluded=[]){const reasons=new Map(excluded.map(action=>[action.id,reasonsText(action)]));return table([t().action,t().resource,t().dates,t().quantity,t().price,t().available,t().authorized,t().excluded],actions.map(action=>[action.id,t()[action.resource]??action.resource,action.days?.map(day).join(', '),number(action.units),number(action.priceKRW),day(action.earliestAvailableDay),action.authorized?t().yes:t().no,reasons.get(action.id)??'—']));}
  function render(){if(destroyed)return;const c=t();container.lang=language==='ko'?'ko':'zh-CN';container.replaceChildren();const heading=node('div','page-heading'),titles=node('div'),tools=node('div','heading-tools');titles.append(node('div','eyebrow','RESOURCE RECOVERY / V9'),node('h1','',c.title),node('p','',c.subtitle));for(const [code,label]of [['zh','中文'],['ko','한국어']]){const b=button(label,()=>{language=code;render();});b.setAttribute('aria-pressed',String(language===code));tools.append(b);}heading.append(titles,tools);container.append(heading,node('div','notice',c.scope),node('div','notice warning',c.emptyMenu));
    const toolbar=node('div','heading-tools resource-recovery-v9-toolbar');for(const [label,action]of [[c.current,loadCurrent],[c.rescue,()=>fixture('rescue')],[c.impossible,()=>fixture('impossible')]]){const b=button(label,action);b.disabled=busy;toolbar.append(b);}container.append(toolbar,node('p','resource-recovery-v9-note',c.example));
    const setup=node('div','card reading-card'),editors=node('div','resource-recovery-v9-editors');for(const [label,value,field]of [[c.scenario,snapshotText,'snapshot'],[c.actions,actionsText,'actions'],[c.context,contextText,'context']]){const wrap=node('label','field'+(field==='context'?' resource-recovery-v9-context':''),label),editor=node('textarea','resource-recovery-v9-json');editor.value=value;editor.rows=field==='context'?5:15;editor.spellcheck=false;editor.disabled=busy;editor.setAttribute('aria-label',label);editor.addEventListener('input',()=>{if(field==='snapshot')snapshotText=editor.value;else if(field==='actions')actionsText=editor.value;else contextText=editor.value;invalidate();});wrap.append(editor);editors.append(wrap);}setup.append(editors,node('p','resource-recovery-v9-note',c.contextHint),node('p','resource-recovery-v9-note',c.actionHint),node('p','resource-recovery-v9-note',c.edited));container.append(setup);
    const controls=node('div','card reading-card resource-recovery-v9-controls'),label=node('label','field',c.objective),select=node('select');select.setAttribute('aria-label',c.objective);select.disabled=busy;for(const [value,text]of [['procurementOnly',c.procurement],['feesPlusProcurement',c.combined]]){const option=node('option','',text);option.value=value;select.append(option);}select.value=objectiveMode;select.addEventListener('change',()=>{objectiveMode=select.value;invalidate();});label.append(select);controls.append(label);const buttons=node('div','heading-tools');for(const [text,action,primary]of [[c.validate,check,false],[c.run,run,true],[c.exportInput,exportInput,false]]){const b=button(text,action,primary);b.disabled=busy;buttons.append(b);}const stopButton=button(c.stop,stop);stopButton.disabled=!busy;buttons.append(stopButton);const exportButton=button(c.exportResult,exportResult);exportButton.disabled=!result||busy;buttons.append(exportButton);controls.append(buttons);container.append(controls,node('p','resource-recovery-v9-note',c.procurementNote),node('p','resource-recovery-v9-note',c.budget));
    if(notice){const message=node('div','notice'+(noticeError?' warning':''),notice);message.setAttribute('role','status');container.append(message);}if(busy){const message=node('div','notice',c.running);message.setAttribute('role','status');container.append(message);}const stale=node('div','notice warning',c.stale);stale.dataset.recoveryStale='true';stale.hidden=!runInput||runRevision===draftRevision;container.append(stale);
    if(!runInput){container.append(node('div','resource-recovery-v9-empty',c.awaiting));return;}const strip=node('div','context-strip');strip.append(node('span','pill',runInput.inputOrigin==='synthetic-fixture'?c.synthetic:c.custom),node('span','',`${date(runInput.minEventDay)} · KST`));container.append(strip,node('p','resource-recovery-v9-note',c.model));const menu=node('article','card reading-card resource-recovery-v9-result');menu.append(node('h2','card-title',c.menu));if(runInput.actions.length)menu.append(menuTable(runInput.actions,result?.excludedActions??[]));else menu.append(node('p','',c.noActions));container.append(menu);if(!result)return;
    const card=node('article','card reading-card resource-recovery-v9-result'),status=resourceRecoveryStatusV9(result),title=status==='optimal'?(runInput.objectiveMode==='procurementOnly'?c.optimalProcurement:c.optimalCombined):status==='feasible'?c.feasible:status==='infeasible'?c.infeasible:status==='cancelled'?c.cancelled:c.unknown;card.append(node('h2','card-title',c.result),node('div','notice'+(['optimal','feasible'].includes(status)?'':' warning'),title),node('p','resource-recovery-v9-note',status==='optimal'?c.provenNote:c.notProven),node('p','resource-recovery-v9-note',c.counterfactual));
    const amounts=node('div','resource-recovery-v9-amounts');for(const [label,key]of [[c.procurementFee,'procurementCostKRW'],[c.incrementalFee,'incrementalCost'],[c.totalFee,'totalCost'],[c.combinedIncremental,'combinedIncrementalCostKRW'],[c.combinedTotal,'combinedTotalCostKRW']]){const amount=node('div','resource-recovery-v9-amount');amount.append(node('span','',label),node('strong','',number(result[key])));amounts.append(amount);}card.append(amounts);if(!['optimal','feasible'].includes(status))card.append(node('p','resource-recovery-v9-note',c.incomplete));card.append(node('p','resource-recovery-v9-note',`${c.parentWall}: ${number(result.parentWallMs)}`));
    card.append(node('h3','',c.selectedActions));if(result.selectedActions?.length)card.append(menuTable(result.selectedActions));else card.append(node('p','',c.noSelected));card.append(node('h3','',c.excludedActions));if(result.excludedActions?.length)card.append(table([c.action,c.excluded],result.excludedActions.map(action=>[action.id,reasonsText(action)])));else card.append(node('p','',c.noExcluded));
    if(['optimal','feasible'].includes(status)){card.append(node('h3','',c.plan),table([c.id,c.pickup,c.unload,c.return],result.rows.map(row=>[row.id,date(row.pickupDay),date(row.unloadDay),date(row.returnDay)])));}if(result.reason)card.append(node('p','resource-recovery-v9-note',result.reason));card.append(details(c.rawResult,result));container.append(card,details(c.rawInput,runInput));
  }
  render();return {stop,destroy(){if(destroyed)return;stop();destroyed=true;generation++;active?.cancel();container.replaceChildren();}};
}
