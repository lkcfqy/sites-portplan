import './execution-v8.css';
import {addDays, rowFor, scheduleUsage} from './engine.js';
import {EXECUTION_HARD_WALL_MS_V8, EXECUTION_METHODS_V8, EXECUTION_SCOPE_V8,
  auditExecutionResultV8, executionInputChangesV8, executionStatusV8,
  makeExecutionFixtureV8, prepareExecutionInputV8} from './execution-v8.worker.js';

const COPY={
  zh:{title:'把自己的订单放进滚动模拟', subtitle:'比较已知订单在逐日容量变化下的提箱、卸货和还空安排。',
    scope:'本页是日级情景模拟。所有订单预先已知；未来未公告的容量变化只属于模拟器，不提供给规划器。结果不是现场派车或企业实测节省。',
    loadCurrent:'使用工作台当前订单', success:'10 箱成功演示', failure:'10 箱中断演示', setup:'情景与假设',
    setupNote:'编辑订单、名义容量和模拟事件；调整后重新运行。模拟器可读取整条事件路径，规划器每天只获得当时已知的信息。',
    orders:'订单与名义容量 · JSON', events:'模拟容量事件 · JSON', eventHint:'resource：truck / warehouse / staging；revealDay 从 0 起；duration 为模拟器私有持续期。仅真实已公告的持续期填写 announcedDuration，并与 duration 相同。',
    first:'策略 A', second:'策略 B', none:'不比较', delivery:'V9 及时候选交付（实验）', adaptive:'V8 条件式决策（实验）', polish:'V7 费用打磨恢复', stable:'V5 保留可行计划',
    assessment:'首次正式实验中，V8 的完成覆盖低于 V7 与稳定保留；本页默认比较 V7 和稳定保留。V8 保留为实验选项，完整成绩见“V8 方法与验证”。',
    validate:'检查输入', run:'运行滚动模拟', stop:'停止', exportInput:'导出本次输入', exportResult:'导出模拟结果',
    budget:'每策略在独立后台线程顺序运行；父页面从线程启动到接收和终态审核限时 5 秒。V8/V7 每调用为合作式 200 ms，V5 为内部求解器 0.2 秒；不代表相同内部时钟或相同 CPU。',
    awaiting:'选择或编辑情景，再运行。本页是自定义本地模拟，运行不计为冻结研究成绩。',
    loaded:'已载入；请检查输入后运行。', valid:'输入检查通过。', invalid:'输入检查未通过：', running:'正在运行',
    originFixture:'演示合成订单', originCustom:'自定义输入 / 未核验', containers:'箱', days:'天', source:'输入范围',
    stale:'输入已经修改。下方保留的是上一次运行的结果；重新运行后才对应当前输入。',
    changes:'相对上次运行的输入变化', noChanges:'与上次运行的订单和容量事件相同。', firstInput:'首次运行；没有前一输入可以比较。',
    path:'字段', before:'修改前', after:'修改后', result:'同一输入下的策略结果', method:'策略', state:'状态', returned:'已还空 / 全部',
    total:'完整执行总两费 / ₩', incremental:'完整执行新增两费 / ₩', revisions:'待执行日期变更', parentWall:'父页面墙钟 / ms',
    complete:'完整执行 · 可行，未证全程最优', noPlan:'未找到完整延续 · 不能据此证明无解',
    infeasible:'当前观察与执行锁下，必要条件已证明矛盾', unknown:'硬截止或执行器错误 · 执行历史未知', cancelled:'已停止 · 执行历史未知',
    noPair:'至少一个策略未完整执行，不比较完整路径费用；失败费用保持 null。',
    paired:'仅此同输入且双方完整的模拟：A − B 总两费', notResearch:'仅是本次本地模拟，不是总体成绩或真实节省。',
    day:'模拟日期', earlier:'前一天', later:'后一天', today:'当日信息与动作', noDay:'此策略在这一天没有执行记录。',
    finished:'此策略已在较早日期结束；没有补造后续动作。', known:'当天已观察容量', resource:'资源', capacity:'当天可用', announced:'当天公告',
    truck:'运输箱次', warehouse:'卸货槽', staging:'在场占用单位', durationUnknown:'未来持续期未公告', durationKnown:'已公告持续天数',
    priorLocks:'进入今天之前的已执行锁', action:'动作', actionDay:'执行日', id:'箱号', pickup:'提箱', unloadStart:'开始卸货', return:'还空',
    noLocks:'此前没有已执行动作。', recommendations:'当天通过审计的建议 / 模拟执行', noActions:'今天没有新动作；进行中的卸货与在场占用仍按原计划连续计入。',
    noAccepted:'当天没有通过完整审核的方案。已有历史保留；候选不计为成功执行。',
    reason:'规划器为何这样处理', initialize:'先构造并审计完整初始计划。', retain:'既有计划在当前信息与执行锁下仍有效，保留日期。',
    polishAction:'在有效完整候选上检查费用机会，只有通过审计的改进才可接受。', rebuild:'旧计划失效，按当前容量和已执行锁重建剩余计划。', failedAction:'本次没有得到可接受的完整延续。请区分预算缺口与已证明矛盾。',
    feesToday:'当天完整计划的费用预测', forecastNote:'当前观察和名义未来下的模型预测，不是最终实付或完整路径节省。',
    revisionsToday:'今天调整的未执行日期', noRevisions:'今天没有记录未执行日期调整。', oldDay:'原计划日', newDay:'当前计划日',
    fullPlan:'当天完整日期计划', pickupDay:'提箱日', unloadDay:'卸货开始日', returnDay:'还空日',
    proof:'失败必要条件检查', proofNone:'必要条件没有发现矛盾；仍不能证明可行。可修改明确的容量/交期假设后重新运行。',
    raw:'当前日期的原始记录与规划器解释', inputRaw:'本次运行的完整输入与比较范围', exportError:'请先完成一次运行。',
    cancelledReason:'用户停止，父页面没有取得终态。', timeout:'5 秒内未取得并通过审核的终态，执行历史未知。',
    error:'模拟未取得可信终态：', sameMethods:'请选择不同的策略进行比较。', noScenario:'工作台没有可用的情景。',
    exampleNote:'两个演示是刻意构造的教学情景，不代表总体完成率。中断演示在 D+2 公告仓库关闭至规划期末；修改事件容量后可比较明确的补救假设。',
    modifiedInput:'用户编辑后的情景均标记为未核验输入。', exportScope:'自定义浏览器日级情景模拟；无现场动作确认、无实际合同费用或企业节省声明。',
  },
  ko:{title:'내 주문으로 일별 실행을 시뮬레이션합니다', subtitle:'알려진 주문에 대해 용량 변화에 따른 반출·적출·공컨테이너 반납 계획을 비교합니다.',
    scope:'일 단위 시나리오 시뮬레이션입니다. 모든 주문은 처음부터 알려져 있으며, 아직 발표되지 않은 미래 용량 충격은 시뮬레이터만 압니다. 현장 배차나 실현 절감액이 아닙니다.',
    loadCurrent:'작업대의 현재 주문 가져오기', success:'10개 완주 예시', failure:'10개 중단 예시', setup:'시나리오와 가정',
    setupNote:'주문·명목 용량·모의 충격을 편집한 뒤 다시 실행합니다. 시뮬레이터는 전체 충격 경로를 알지만 계획기는 당일 알려진 정보만 받습니다.',
    orders:'주문과 명목 용량 · JSON', events:'모의 용량 충격 · JSON', eventHint:'resource: truck / warehouse / staging; revealDay는 0부터 시작합니다. duration은 시뮬레이터만 아는 실제 지속기간입니다. 사전에 공지된 경우에만 같은 값의 announcedDuration을 입력합니다.',
    first:'정책 A', second:'정책 B', none:'비교 안 함', delivery:'V9 적시 후보 전달 (실험)', adaptive:'V8 조건부 의사결정 (실험)', polish:'V7 비용 다듬기 복구', stable:'V5 유효 계획 유지',
    assessment:'첫 공식 실험에서 V8의 완주 범위는 V7과 유효 계획 유지보다 낮았습니다. 기본 비교는 V7과 유지 정책이며, V8은 실험 선택지로 남깁니다. 전체 결과는 V8 방법·검증에서 확인하세요.',
    validate:'입력 검사', run:'일별 시뮬레이션 실행', stop:'중지', exportInput:'이번 입력 내보내기', exportResult:'시뮬레이션 결과 내보내기',
    budget:'정책별 독립 Worker를 순차 실행합니다. 부모 페이지는 시작부터 수신·최종 검사까지 5초를 적용합니다. V8/V7 호출은 협력식 200ms, V5는 내부 solver 0.2초로 내부 시계나 총 CPU가 같다는 뜻은 아닙니다.',
    awaiting:'시나리오를 선택하거나 편집한 뒤 실행하세요. 이번 사용자 로컬 시뮬레이션은 동결 연구 성과에 포함되지 않습니다.',
    loaded:'불러왔습니다. 입력을 확인한 뒤 실행하세요.', valid:'입력 검사를 통과했습니다.', invalid:'입력 검사 실패: ', running:'실행 중',
    originFixture:'합성 시연 주문', originCustom:'사용자 입력 / 미검증', containers:'컨테이너', days:'일', source:'입력 범위',
    stale:'입력이 변경되었습니다. 아래는 이전 실행 결과이며 다시 실행해야 현재 입력을 반영합니다.',
    changes:'직전 실행 대비 입력 변경', noChanges:'직전 실행과 주문·용량 충격이 같습니다.', firstInput:'첫 실행으로 비교할 이전 입력이 없습니다.',
    path:'필드', before:'변경 전', after:'변경 후', result:'같은 입력의 정책 비교', method:'정책', state:'상태', returned:'반납 완료 / 전체',
    total:'완주 총요금 / ₩', incremental:'완주 추가요금 / ₩', revisions:'미실행 날짜 변경', parentWall:'부모 페이지 경과 / ms',
    complete:'완전 실행 · 실행 가능, 전체 최적 미증명', noPlan:'완전 연속 계획 미확보 · 불가능 증명 아님',
    infeasible:'현재 관측·실행 잠금의 필요조건 모순 증명', unknown:'강제 기한/실행기 오류 · 실행 이력 미확보', cancelled:'중지됨 · 실행 이력 미확보',
    noPair:'하나 이상의 정책이 미완료여서 전체 경로 요금을 비교하지 않습니다. 실패 요금은 null입니다.',
    paired:'이번 같은 입력의 두 완주 경로만 비교: A − B 총요금', notResearch:'이번 로컬 시뮬레이션이며 전체 성과나 실현 절감액이 아닙니다.',
    day:'모의 날짜', earlier:'이전 날', later:'다음 날', today:'당일 정보와 행동', noDay:'이 날짜의 실행 기록이 없습니다.',
    finished:'이 정책은 앞선 날짜에 종료되었습니다. 이후 행동을 새로 만들지 않습니다.', known:'당일 관측 용량', resource:'자원', capacity:'당일 가용량', announced:'당일 공지',
    truck:'운송 작업 횟수', warehouse:'적출 슬롯', staging:'체류 점유 단위', durationUnknown:'미래 지속기간 미공지', durationKnown:'공지된 지속일',
    priorLocks:'오늘 진입 전 실행 잠금', action:'행동', actionDay:'실행일', id:'컨테이너', pickup:'반출', unloadStart:'적출 시작', return:'공컨테이너 반납',
    noLocks:'이전에 실행한 행동이 없습니다.', recommendations:'당일 검사 통과 권고 / 모의 실행', noActions:'오늘 새 행동은 없습니다. 진행 중 적출과 체류 점유는 원래 계획대로 계속 계산합니다.',
    noAccepted:'당일 전체 계획이 검사를 통과하지 못했습니다. 기존 이력은 보존되며 후보를 실행 성공으로 세지 않습니다.',
    reason:'이 결정을 내린 이유', initialize:'완전한 초기 계획을 구성하고 검사합니다.', retain:'기존 계획이 현재 정보와 잠금에서 유효하여 날짜를 유지합니다.',
    polishAction:'유효한 완전 후보의 비용 기회를 검사하고, 검사를 통과한 개선만 수락합니다.', rebuild:'기존 계획이 무효하여 현재 용량과 실행 잠금으로 남은 계획을 재구성합니다.', failedAction:'수락할 완전 연속 계획을 얻지 못했습니다. 예산 부족과 증명된 모순을 구분해야 합니다.',
    feesToday:'당일 완전 계획의 요금 예측', forecastNote:'현재 관측과 미래 명목 용량의 모형 예측이며 최종 실결제나 전체 경로 절감액이 아닙니다.',
    revisionsToday:'오늘 변경한 미실행 날짜', noRevisions:'오늘 기록된 미실행 날짜 변경이 없습니다.', oldDay:'이전 계획일', newDay:'현재 계획일',
    fullPlan:'당일 전체 날짜 계획', pickupDay:'반출일', unloadDay:'적출 시작일', returnDay:'반납일',
    proof:'실패 필요조건 검사', proofNone:'필요조건 모순을 발견하지 못했지만 실행 가능성을 증명하지도 않습니다. 명시한 용량·납기 가정을 수정하여 다시 실행할 수 있습니다.',
    raw:'당일 원기록과 계획기 설명', inputRaw:'이번 전체 입력과 비교 범위', exportError:'먼저 한 번 실행하세요.',
    cancelledReason:'사용자가 중지하여 부모 페이지가 최종 기록을 받지 못했습니다.', timeout:'5초 안에 최종 기록의 수신과 검사를 완료하지 못해 실행 이력이 미확보 상태입니다.',
    error:'신뢰할 최종 기록 미확보: ', sameMethods:'비교할 서로 다른 정책을 선택하세요.', noScenario:'작업대에 사용 가능한 시나리오가 없습니다.',
    exampleNote:'두 예시는 의도적으로 만든 학습용이며 전체 완주율을 대표하지 않습니다. 중단 예시는 D+2에 계획기간 말까지 창고 폐쇄를 공지합니다. 충격 용량을 수정하여 명시적 복구 가정을 비교할 수 있습니다.',
    modifiedInput:'사용자가 편집한 시나리오는 미검증 입력으로 표시됩니다.', exportScope:'사용자 브라우저 일 단위 시뮬레이션; 현장 행동 확인·실제 계약 요금·기업 실현 절감 주장이 아닙니다.',
  },
};
const DECISION_REASONS={
  zh:{initial_timely_complete_plan:'完整初始方案已在期限内验算并保留，后续可选优化晚结束不会抹掉它。',invalid_cache_timely_locked_recovery:'旧计划失效后，在过去动作锁下及时验算并保留了完整恢复方案。',late_polish_candidate_discarded:'改进方案交付或审核过晚，保留先前已及时验算的方案。',initial_complete_plan:'完整初始计划已通过审核；这是初始化，不是冲击后恢复。',invalid_cache_locked_recovery:'旧计划不再满足当前约束；在既有执行锁下重建了完整计划。',
    no_fee_opportunity:'宽松费用机会检查未超过触发阈值，保留有效计划。',small_savings_prefer_stability:'候选省费处于预设容忍范围内，优先保留原日期。',
    date_change_limit:'候选改变的待执行日期超过预设上限，保留原计划。',pressure_guard:'候选没有通过短期资源压力保护，保留原计划；该指标不保证未来安全。',
    fee_improvement_within_change_and_pressure_guards:'候选在当前快照严格省费，且通过改期数量和短期压力保护。',no_strict_fee_improvement:'没有找到严格省费且通过审核的候选，保留原计划。',
    date_change_budget_zero:'预设改期额度为零，保留原计划。',no_complete_locked_plan:'预算内未接受完整锁定计划；这本身不是不可行证明。',
    polish_no_complete_candidate:'可选费用搜索没有交付完整可接受的候选，保留已有计划。',late_polish_selection_discarded:'改进选择晚于预算，舍弃改进并保留已审核计划。',
    opportunity_budget_exhausted:'费用机会检查耗尽剩余预算，保留已审核计划。',budget_before_search:'可选搜索前预算已耗尽；是否有完整计划以状态为准。',
    budget_before_polish:'没有剩余预算进行可选费用打磨，保留已审核计划。',budget_before_recovery:'初始化或恢复前没有剩余预算，未取得完整延续。'},
  ko:{initial_timely_complete_plan:'완전 초기 후보를 기한 내 검사하고 보존했습니다. 이후 선택적 최적화가 늦어져도 이 후보는 사라지지 않습니다.',invalid_cache_timely_locked_recovery:'기존 계획이 무효해진 뒤 과거 실행 잠금 아래 완전 복구 후보를 제때 검사하고 보존했습니다.',late_polish_candidate_discarded:'개선 후보의 전달 또는 검사가 늦어 먼저 제때 검사한 계획을 유지했습니다.',initial_complete_plan:'완전한 초기 계획이 검사를 통과했습니다. 충격 이후 복구가 아닌 초기화입니다.',invalid_cache_locked_recovery:'기존 계획이 현재 제약을 위반하여 실행 잠금 아래 완전 계획을 재구성했습니다.',
    no_fee_opportunity:'완화된 비용 기회가 고정 기준을 넘지 않아 유효 계획을 유지했습니다.',small_savings_prefer_stability:'후보 절감이 미리 정한 허용 범위 안이므로 기존 날짜의 안정성을 우선했습니다.',
    date_change_limit:'후보의 미실행 날짜 변경 수가 상한을 넘어 기존 계획을 유지했습니다.',pressure_guard:'후보가 단기 자원 압력 검사를 통과하지 못했습니다. 이 지표는 미래 안전을 보장하지 않습니다.',
    fee_improvement_within_change_and_pressure_guards:'현재 관측에서 엄격히 저렴하며 변경 수와 단기 압력 검사를 통과한 후보를 수락했습니다.',no_strict_fee_improvement:'엄격히 저렴하고 검사를 통과한 후보가 없어 기존 계획을 유지했습니다.',
    date_change_budget_zero:'선언한 날짜 변경 한도가 0이므로 기존 계획을 유지했습니다.',no_complete_locked_plan:'예산 내 완전 잠금 계획을 수락하지 못했습니다. 그 자체가 불가능 증명은 아닙니다.',
    polish_no_complete_candidate:'선택적 비용 탐색이 수락 가능한 완전 후보를 반환하지 않아 기존 계획을 유지했습니다.',late_polish_selection_discarded:'개선 선택이 기한을 넘어 개선을 버리고 검사된 기존 계획을 유지했습니다.',
    opportunity_budget_exhausted:'비용 기회 검사가 남은 예산을 소진하여 검사된 계획을 유지했습니다.',budget_before_search:'선택 탐색 전에 예산이 소진되었습니다. 완전 계획 여부는 상태를 확인하세요.',
    budget_before_polish:'선택적 비용 개선 예산이 없어 검사된 계획을 유지했습니다.',budget_before_recovery:'초기화·복구 예산이 남지 않아 완전 연속 계획을 얻지 못했습니다.'},
};
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node;};
const json=value=>JSON.stringify(value,null,2);
const D=day=>Number.isInteger(day)?'D+'+day:'—';
function button(label,action,primary=false){const node=el('button','button'+(primary?' primary':''),label);node.type='button';node.addEventListener('click',action);return node;}
function download(name,value){const url=URL.createObjectURL(new Blob([json(value)],{type:'application/json'})),a=el('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function gridTable(headers,rows){const wrap=el('div','execution-v8-table-wrap'),table=el('table','data-table'),head=el('thead'),tr=el('tr'),body=el('tbody');for(const text of headers)tr.append(el('th','',text));head.append(tr);for(const values of rows){const row=el('tr');for(const value of values)row.append(el('td','',value??'—'));body.append(row);}table.append(head,body);wrap.append(table);return wrap;}
function rawDetails(title,value){const details=el('details','execution-v8-raw');details.append(el('summary','',title),el('pre','',json(value)));return details;}

export function mountExecutionV8UI(container,{getScenario}={}) {
  let language='zh', source='synthetic-fixture', scenarioText='', eventsText='', notice='', noticeError=false;
  let first='costPolishV7', second='stableRetainV5', busy=false, active=null, generation=0, destroyed=false;
  let day=0, draftRevision=0, runRevision=-1, runInput=null, previousInput=null, runHadPrevious=false, changes=[], results={}, runMethods=[], runningMethod=null;
  const initial=makeExecutionFixtureV8();scenarioText=json(initial.scenario);eventsText=json(initial.events);
  container.classList.add('execution-v8');
  const t=()=>COPY[language];
  const methodName=method=>({adaptiveV9:t().delivery,adaptiveV8:t().adaptive,costPolishV7:t().polish,stableRetainV5:t().stable}[method]??method);
  const number=value=>Number.isFinite(value)?new Intl.NumberFormat(language==='ko'?'ko-KR':'zh-CN',{maximumFractionDigits:2}).format(value):'—';
  const money=value=>Number.isFinite(value)?new Intl.NumberFormat(language==='ko'?'ko-KR':'zh-CN',{maximumFractionDigits:0}).format(value):'null';
  const stateName=result=>({complete:t().complete,no_complete_plan:t().noPlan,proven_snapshot_infeasible:t().infeasible,unknown:t().unknown,cancelled:t().cancelled}[executionStatusV8(result)]);

  function parseInput(){
    if (scenarioText.length>1024*1024 || eventsText.length>128*1024) throw new Error('Input JSON exceeds the simulation editor size limit.');
    return prepareExecutionInputV8({scenario:JSON.parse(scenarioText),events:JSON.parse(eventsText),inputOrigin:source});
  }
  function setNotice(text,error=false){notice=text;noticeError=error;}
  function fixture(kind){const input=makeExecutionFixtureV8(kind);source=input.inputOrigin;scenarioText=json(input.scenario);eventsText=json(input.events);draftRevision++;setNotice(t().loaded);render();}
  function loadCurrent(){try{const scenario=getScenario?.();if(!scenario)throw new Error(t().noScenario);const input=prepareExecutionInputV8({scenario,events:[],inputOrigin:'user-custom-unverified'});source=input.inputOrigin;scenarioText=json(input.scenario);eventsText='[]';draftRevision++;setNotice(t().loaded);}catch(error){setNotice(t().invalid+error.message,true);}render();}
  function checked(){try{parseInput();setNotice(t().valid);}catch(error){setNotice(t().invalid+error.message,true);}render();}
  function unknown(status,reason,parentWallMs){return {policy:runningMethod,status,complete:false,executionHistoryUnavailable:true,
    rows:[],timeline:[],executedEvents:[],totalCost:null,incrementalCost:null,storageCost:null,ddCost:null,sunkCost:null,objectiveCost:null,
    revisionCount:null,plannerStats:null,failure:{reason},scope:EXECUTION_SCOPE_V8,parentWallMs};}
  function stop(){if(!busy)return;active?.cancel();generation++;busy=false;runningMethod=null;if(runInput)previousInput=structuredClone(runInput);setNotice(t().cancelled);render();}

  async function episode(input,method,token){
    runningMethod=method;render();
    const started=performance.now();
    return new Promise(resolve=>{
      let worker,timer,finished=false;
      function finish(result){if(finished)return;finished=true;clearTimeout(timer);worker?.terminate();active=null;resolve(result);}
      active={cancel:()=>{const result=unknown('cancelled',t().cancelledReason,performance.now()-started);result.policy=method;results[method]=result;finish(result);}};
      try{
        worker=new Worker(new URL('./execution-v8.worker.js',import.meta.url),{type:'module'});
        timer=setTimeout(()=>finish({...unknown('hard_time_limit',t().timeout,performance.now()-started),policy:method}),EXECUTION_HARD_WALL_MS_V8);
        worker.onmessage=({data:message})=>{
          if(finished || token!==generation || message.id!==token)return;
          if(performance.now()-started>EXECUTION_HARD_WALL_MS_V8){finish({...unknown('hard_time_limit',t().timeout,performance.now()-started),policy:method});return;}
          if(message.error){finish({...unknown('worker_error',t().error+message.error,performance.now()-started),policy:method});return;}
          try{
            const result=message.result,audit=auditExecutionResultV8(input,result);
            if(!audit.valid)throw new Error(audit.errors.join('; '));
            const elapsed=performance.now()-started;
            finish(elapsed>EXECUTION_HARD_WALL_MS_V8?{...unknown('hard_time_limit',t().timeout,elapsed),policy:method}:{...result,parentWallMs:elapsed,parentTerminalAudit:audit});
          }catch(error){finish({...unknown('worker_error',t().error+error.message,performance.now()-started),policy:method});}
        };
        worker.onerror=event=>finish({...unknown('worker_error',t().error+(event.message??''),performance.now()-started),policy:method});
        worker.postMessage({id:token,...structuredClone(input),method});
      }catch(error){finish({...unknown('worker_error',t().error+error.message,performance.now()-started),policy:method});}
    });
  }
  async function run(){
    let input;
    try{input=parseInput();if(second&&first===second)throw new Error(t().sameMethods);}catch(error){setNotice(t().invalid+error.message,true);render();return;}
    const token=++generation;runHadPrevious=Boolean(previousInput);changes=executionInputChangesV8(previousInput,input);runInput=input;runRevision=draftRevision;runMethods=[first,...(second?[second]:[])];
    results={};busy=true;day=0;setNotice('');
    for(const method of runMethods){
      const result=await episode(input,method,token);
      if(token!==generation || destroyed)return;
      results[method]=result;render();
    }
    previousInput=structuredClone(input);busy=false;runningMethod=null;render();
  }
  function exportInput(){try{const input=parseInput();download('portplan-v8-custom-input.json',{...input,methods:[first,...(second?[second]:[])],parentHardWallMs:EXECUTION_HARD_WALL_MS_V8});}catch(error){setNotice(t().invalid+error.message,true);render();}}
  function exportResults(){if(!runInput){setNotice(t().exportError,true);render();return;}download('portplan-v8-custom-results.json',{
    schemaVersion:'portplan-custom-execution-v8-result',scope:EXECUTION_SCOPE_V8,displayScope:t().exportScope,
    createdAt:new Date().toISOString(),input:runInput,inputChangesFromPreviousRun:changes,methods:runMethods,results,
    executionStatus:busy?'in_progress':runMethods.every(method=>results[method])?'finished':'interrupted',parentHardWallMs:EXECUTION_HARD_WALL_MS_V8,
    budgetScope:'Each method runs sequentially in its own browser worker. Parent wall includes startup, receipt and parent terminal audit. No same-CPU or frozen-research claim.',
  });}

  function labelSelect(text,options,value,change){const field=el('label','field',text),select=el('select');select.setAttribute('aria-label',text);select.disabled=busy;for(const [key,name]of options){const option=el('option','',name);option.value=key;select.append(option);}select.value=value;select.addEventListener('change',()=>change(select.value));field.append(select);return field;}
  function render(){
    if(destroyed)return;
    const c=t();container.lang=language==='ko'?'ko':'zh-CN';container.replaceChildren();
    const heading=el('div','page-heading'),titles=el('div'),tools=el('div','heading-tools');titles.append(el('div','eyebrow','CUSTOM EXECUTION / V8'),el('h1','',c.title),el('p','',c.subtitle));
    for(const [code,name]of [['zh','中文'],['ko','한국어']]){const b=button(name,()=>{language=code;render();});b.setAttribute('aria-pressed',String(language===code));tools.append(b);}heading.append(titles,tools);container.append(heading,el('div','notice',c.scope),el('div','notice warning',c.assessment));
    const toolbar=el('div','heading-tools execution-v8-toolbar');for(const [text,action]of [[c.loadCurrent,loadCurrent],[c.success,()=>fixture('success')],[c.failure,()=>fixture('failure')]]){const b=button(text,action);b.disabled=busy;toolbar.append(b);}container.append(toolbar,el('p','execution-v8-note',c.exampleNote));
    const setup=el('details','card reading-card execution-v8-setup');setup.open=!runInput;setup.append(el('summary','',c.setup),el('p','',c.setupNote));
    const editors=el('div','execution-v8-editors');
    for(const [name,value,isScenario]of [[c.orders,scenarioText,true],[c.events,eventsText,false]]){const field=el('label','field',name),editor=el('textarea','execution-v8-json');editor.value=value;editor.spellcheck=false;editor.rows=isScenario?16:10;editor.disabled=busy;editor.setAttribute('aria-label',name);editor.addEventListener('input',()=>{if(isScenario)scenarioText=editor.value;else eventsText=editor.value;source='user-custom-unverified';draftRevision++;const stale=container.querySelector('[data-stale-notice]');if(stale)stale.hidden=false;});field.append(editor);editors.append(field);}
    setup.append(editors,el('p','execution-v8-note',c.eventHint),el('p','execution-v8-note',c.modifiedInput));container.append(setup);
    const controls=el('div','card reading-card execution-v8-controls'),options=EXECUTION_METHODS_V8.map(m=>[m,methodName(m)]);
    controls.append(labelSelect(c.first,options,first,value=>{first=value;}),labelSelect(c.second,[['',c.none],...options],second,value=>{second=value;}));
    const actions=el('div','heading-tools');for(const [name,action,primary]of [[c.validate,checked,false],[c.run,run,true],[c.exportInput,exportInput,false]]){const b=button(name,action,primary);b.disabled=busy;actions.append(b);}const stopButton=button(c.stop,stop);stopButton.disabled=!busy;actions.append(stopButton);const exportButton=button(c.exportResult,exportResults);exportButton.disabled=!runInput||busy;actions.append(exportButton);controls.append(actions);container.append(controls,el('p','execution-v8-note',c.budget));
    if(notice){const message=el('div','notice'+(noticeError?' warning':''),notice);message.setAttribute('role','status');container.append(message);}
    if(busy){const progress=el('div','notice',c.running+' · '+methodName(runningMethod));progress.setAttribute('role','status');container.append(progress);}
    const stale=el('div','notice warning',c.stale);stale.dataset.staleNotice='true';stale.hidden=!runInput||runRevision===draftRevision;container.append(stale);
    if(!runInput){container.append(el('div','execution-v8-empty',c.awaiting));return;}
    const context=el('div','context-strip');context.append(el('span','pill',runInput.inputOrigin==='synthetic-fixture'?c.originFixture:c.originCustom),el('span','',`${runInput.scenario.containers.length} ${c.containers} · ${runInput.scenario.horizonDays} ${c.days} · KST`));container.append(context);
    const changed=el('details','card reading-card execution-v8-setup');changed.append(el('summary','',c.changes));if(changes.length)changed.append(gridTable([c.path,c.before,c.after],changes.map(change=>[change.path,short(change.before),short(change.after)])));else changed.append(el('p','',runHadPrevious?c.noChanges:c.firstInput));container.append(changed);
    if(!Object.keys(results).length)return;
    const summary=el('article','card reading-card');summary.append(el('h2','card-title',c.result));summary.append(gridTable([c.method,c.state,c.returned,c.total,c.incremental,c.revisions,c.parentWall],runMethods.filter(method=>results[method]).map(method=>{const p=results[method],returned=p.finalState?.filter(state=>state.phase==='returned').length??(p.complete?runInput.scenario.containers.length:null);return [methodName(method),stateName(p),returned===null?'—':`${returned} / ${runInput.scenario.containers.length}`,money(p.totalCost),money(p.incrementalCost),number(p.revisionCount),number(p.parentWallMs)];})));
    const a=results[runMethods[0]],b=results[runMethods[1]];if(a&&b)summary.append(el('p','execution-v8-note',a.complete&&b.complete?`${c.paired} ${number(a.totalCost-b.totalCost)} ₩。 ${c.notResearch}`:c.noPair));container.append(summary);
    const maxDay=Math.max(0,...Object.values(results).flatMap(p=>(p.timeline??[]).map(entry=>entry.day)));day=Math.min(day,maxDay);
    const dayControls=el('div','card reading-card execution-v8-day-controls'),previous=button(c.earlier,()=>{day--;render();}),next=button(c.later,()=>{day++;render();}),slider=el('input');slider.type='range';slider.min=0;slider.max=maxDay;slider.step=1;slider.value=day;slider.setAttribute('aria-label',c.day);slider.addEventListener('input',()=>{day=Number(slider.value);render();container.querySelector('input[type="range"]')?.focus();});previous.disabled=day===0;next.disabled=day===maxDay;dayControls.append(el('strong','',`${c.day} ${D(day)} · ${addDays(runInput.scenario.horizonStart,day)}`),previous,slider,next);container.append(dayControls);
    const columns=el('div','execution-v8-results');for(const method of runMethods)if(results[method])columns.append(dailyCard(method,results[method]));container.append(columns,rawDetails(c.inputRaw,{...runInput,methods:runMethods}));
  }
  function short(value){const text=JSON.stringify(value);return text?.length>160?text.slice(0,157)+'…':text;}
  function dailyCard(method,result){
    const c=t(),card=el('article','card reading-card execution-v8-daily');card.append(el('h2','card-title',methodName(method)),el('p','execution-v8-state',stateName(result)));
    const entry=result.timeline?.find(value=>value.day===day);
    if(!entry){card.append(el('p','',result.timeline?.length?c.finished:c.noDay));if(result.failure?.reason)card.append(el('p','execution-v8-note',result.failure.reason));return card;}
    const trace=result.plannerTrace?.find(value=>value.day===day),action=trace?.action??(entry.status==='planning_failed'?'failed':trace?.candidateSource==='retained_plan'?'retain':trace?.candidateSource?.includes('replan')?'rebuild':day===0?'initialize':'rebuild');
    card.append(el('h3','',c.reason),el('p','',({initialize:c.initialize,retain:c.retain,polish:c.polishAction,rebuild:c.rebuild,failed:c.failedAction}[action]??c.rebuild)));
    const decisionReason=DECISION_REASONS[language][trace?.decisionReason];if(decisionReason)card.append(el('p','execution-v8-note',decisionReason));
    card.append(el('h3','',c.known),gridTable([c.resource,c.capacity,c.announced],(entry.observedEvents??[]).map(observation=>[
      c[observation.resource]??observation.resource,number(observation.capacity),
      knownAnnouncements(result,observation).map(announcement=>announcement.announcedDuration!==undefined?`${c.durationKnown}: ${announcement.announcedDuration}`:c.durationUnknown).join('；')||'—',
    ])));
    const prior=result.timeline.filter(value=>value.day<day).flatMap(value=>value.executedEvents??[]);card.append(el('h3','',c.priorLocks));
    if(prior.length)card.append(gridTable([c.id,c.action,c.actionDay],prior.map(event=>[event.id,c[event.event]??event.event,D(event.day)])));else card.append(el('p','execution-v8-note',c.noLocks));
    const accepted=entry.audit?.valid===true&&entry.decisions?.length===runInput.scenario.containers.length;
    card.append(el('h3','',c.recommendations));
    if(!accepted)card.append(el('div','notice warning',c.noAccepted));
    else{
      const today=entry.executedEvents??[];if(today.length)card.append(gridTable([c.id,c.action,c.actionDay],today.map(event=>[event.id,c[event.event]??event.event,D(event.day)])));else card.append(el('p','execution-v8-note',c.noActions));
      const dates=new Map(entry.decisions.map(row=>[row.id,row]));
      try{const rows=runInput.scenario.containers.map(container=>{const d=dates.get(container.id);return rowFor(runInput.scenario,container,d.pickupDay,d.unloadDay,d.returnDay);}),usage=scheduleUsage(runInput.scenario,rows)[day];card.append(gridTable([c.resource,'使用 / 사용',c.capacity],(entry.observedEvents??[]).map(observation=>[c[observation.resource]??observation.resource,number(usage[observation.resource]),number(observation.capacity)])));card.append(el('h3','',c.feesToday),el('p','execution-v8-amount',number(rows.reduce((sum,row)=>sum+row.totalCost,0))+' ₩'),el('p','execution-v8-note',c.forecastNote));}catch{card.append(el('p','execution-v8-note',c.noAccepted));}
      const plan=el('details','execution-v8-raw');plan.append(el('summary','',c.fullPlan),gridTable([c.id,c.pickupDay,c.unloadDay,c.returnDay],entry.decisions.map(row=>[row.id,D(row.pickupDay),D(row.unloadDay),D(row.returnDay)])));card.append(plan);
    }
    card.append(el('h3','',c.revisionsToday));if(entry.revisions?.length)card.append(gridTable([c.id,c.action,c.oldDay,c.newDay],entry.revisions.map(change=>[change.id,c[change.event]??change.event,D(change.previousDay),D(change.newDay)])));else card.append(el('p','execution-v8-note',c.noRevisions));
    const proof=trace?.failureProof??(result.failure?.day===day?result.failureProof:null);if(proof){card.append(el('h3','',c.proof));if(proof.status==='proven_infeasible_necessary_condition')card.append(el('div','notice warning',c.infeasible),rawDetails(c.proof,proof));else card.append(el('p','execution-v8-note',c.proofNone));}
    card.append(rawDetails(c.raw,{entry,planner:trace??null}));return card;
  }
  function knownAnnouncements(result,observation){
    const publicAnnouncements=(result.timeline??[]).filter(entry=>entry.day<=day).flatMap(entry=>(entry.observedEvents??[])
      .filter(value=>value.resource===observation.resource).flatMap(value=>value.announcements??[]));
    return publicAnnouncements.filter(announcement=>announcement.revealDay===day ||
      announcement.announcedDuration!==undefined&&day<announcement.revealDay+announcement.announcedDuration ||
      (observation.activeShockIds??[]).includes(announcement.id));
  }
  const observer=new MutationObserver(()=>{if(container.closest('[hidden]')&&busy)stop();});
  for(let node=container;node;node=node.parentElement)observer.observe(node,{attributes:true,attributeFilter:['hidden']});
  render();
  return {stop,destroy(){if(destroyed)return;stop();destroyed=true;observer.disconnect();container.replaceChildren();}};
}
