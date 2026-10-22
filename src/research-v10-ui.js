import {mountResearchV9UI} from './research-v9-ui.js';

const names={stableRetainV5:'V5 稳定保留',costPolishV7:'V7 费用修整',adaptiveV9:'V9 及时候选',highsV8:'原生 HiGHS',stableHiGHSV10:'V10 原生同费保留'};
const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
const fmt=n=>Number.isFinite(n)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:3}).format(n):'—';
const notice=(text,warning=false)=>node('div','notice'+(warning?' warning':''),text);
function link(text,path){const a=node('a','button small',text);a.href=path;a.download=path.split('/').pop();return a;}
function table(title,headers,rows){const card=node('article','card schedule-section'),head=node('div','card-header'),wrap=node('div','table-wrap'),t=node('table','data-table'),thead=node('thead'),tr=node('tr'),body=node('tbody');head.append(node('h2','card-title',title));headers.forEach(h=>tr.append(node('th','',h)));thead.append(tr);rows.forEach(row=>{const r=node('tr');row.forEach(v=>r.append(node('td','',v)));body.append(r);});t.append(thead,body);wrap.append(t);card.append(head,wrap);return card;}

export function mountResearchV10UI(container){
  const heading=node('div','page-heading'),copy=node('div'),content=node('div'),refresh=node('button','button','刷新已保存结果');
  const title=node('h1','','省费与改期：原生同费保留');title.id='research-v9-title';
  copy.append(node('div','eyebrow','V10 / NATIVE SOLVER & PLAN STABILITY'),title,node('p','','当前计划有效时，只接受费用严格更低的新方案；相同费用保留原日期。用新的冻结实验检查覆盖、两费与改期的取舍。'));heading.append(copy,refresh);container.replaceChildren(heading,content);let busy=false;
  async function json(path){const r=await fetch(path);if(!r.ok)throw new Error(path+' HTTP '+r.status);return r.json();}
  async function load(){if(busy)return;busy=true;refresh.disabled=true;content.replaceChildren(notice('正在读取正式结果与独立复核…'));
    try{
      const release=await json('/data/v10-release.json');
      content.replaceChildren(notice('研究原型：公开标准费率、合成订单、日级模型。原生求解在离线 Python/CPU 环境运行；网页展示保存的研究记录，执行模拟仍提供浏览器内 V7/V9 等方法。',true));
      const route=node('article','card reading-card');route.append(node('h2','','当前主路线：公开证据与可复现研究'),node('p','','以可核验公开资料、公开费率、公开基准及明确标注的仿真继续开发。企业实单、私人报价、联系人和试点属于可选增强，不作为这条路线的前置条件。'));
      const routeLinks=node('div','heading-tools research-links');for(const [label,path]of [['公开证据与准备状态','/data/public-evidence-readiness-v11.json'],['公开资料研究路线','/downloads/public-evidence-route-v11.zh.md'],['换电脑恢复开发','/downloads/recovery-guide.zh.md']])routeLinks.append(link(label,path));route.append(routeLinks);content.append(route);
      try{
        const evidence=await json('/data/public-evidence-readiness-v11.json'),s=evidence.summary;
        if(evidence.valid!==true||!s||!Array.isArray(evidence.checks)||s.failedCheckCount!==0)throw new Error('保存的复算报告未通过');
        content.append(table('V11 公开证据复算 · 已保存记录',['检查范围','实际覆盖','解释'],[
          ['离线检查',`${s.passedCheckCount} / ${s.checkCount} 项通过`,'内部复算与原档绑定，不是第三方认证'],
          ['费用算例',`${s.feeOfficialWorkedExamples} 个官方例 + ${s.feeDerivedBoundaryCases} 个推导例`,'推导检查不计为官方业务案例'],
          ['公开闸口观测',`${fmt(s.gateRecords)} 条 · 测试 ${fmt(s.gateTestRecords)} 条`,'固定时间分段，独立重算三种中位数基准'],
          ['6月 MAE',`${fmt(s.gateTestMAE)} / ${fmt(s.gateBaselineMAE)} 分钟`,'小时模型 / 全局中位数；不转换为两费节省'],
          ['PLOS / PSPLIB / V10','原件、保存审核与冻结证据链','保留失败与未验证项；本检查不重新求解']
        ]));
      }catch(error){content.append(notice('公开证据复算摘要暂不可读：'+error.message+'。V10 正式成绩仍按原始结果展示。',true));}
      const status=node('article','card reading-card');status.append(node('h2','','本轮证据状态'),node('p','',release.notes));status.append(node('p','',`正式实验：${release.formalExperimentComplete?'完成':'未完成'}；物理与费用复核：${release.independentReviewComplete?'完成':'未完成'}；统计复核：${release.independentBootstrapReviewComplete?'完成':'未完成'}。`));content.append(status);
      content.append(notice('方法范围：一次原生 MILP；保留原有过去执行锁、资源与费用审计。相同费用不替换有效缓存；更便宜的方案仍可能改动很多日期。这不证明全局最少改期，也没有把改期次数任意换算成韩元。'));
      if(release.formalExperimentComplete&&release.independentReviewComplete&&release.independentBootstrapReviewComplete){
        const result=await json('/data/v10-results.json');
        for(const [panel,s]of Object.entries(result.summary.panels)){
          const label=panel==='stress'?'压力扰动 · 新订单种子':'同生成机制 · 新订单种子';
          content.append(table(label,['方法','完整运行 / 全部','全部重复均完成的场景','审计错误 / 历史未知'],Object.entries(s.byMethod).map(([m,v])=>[names[m]??m,`${v.completeEpisodeCount} / ${v.recordedEpisodeCount}`,`${v.fullyCompletedScenarioCount} / ${s.scenarioCount}`,`${v.auditFailureCount} / ${v.executionHistoryUnavailableCount}`])));
          content.append(table('同场景配对比较 · '+label,['候选 / 基线','完成增 / 损','费用场景 / 次数','总两费节省','新增两费节省','总两费节省95%区间','改期事件 · 基线→候选'],Object.values(s.comparisons).map(p=>{const f=p.fees.total,ci=f.uncertainty?.weightedSavingsPct95CI;return[`${names[p.candidateMethod]} / ${names[p.baselineMethod]}`,`${p.completion.gainedEpisodeCount} / ${p.completion.lostEpisodeCount}`,`${f.pairedScenarioCount} / ${f.pairedEpisodeCount}`,f.weightedSavingsPct===null?'无分母':fmt(f.weightedSavingsPct)+'%',p.fees.incremental.weightedSavingsPct===null?'无分母':fmt(p.fees.incremental.weightedSavingsPct)+'%',ci?ci.map(fmt).join(' ~ ')+'%':'无区间',`${fmt(p.revisions.baselineObservedSum)}→${fmt(p.revisions.candidateObservedSum)}`];})));
          const common=s.allMethodCommonComplete;
          if(common){content.append(table(`五法共同完成集合 · ${common.scenarioCount} 场景 / ${common.episodeCount} 匹配运行`,['方法','场景均值总两费之和 · KRW','场景均值新增两费之和 · KRW','原始改期事件数'],Object.entries(common.byMethod).map(([m,v])=>[names[m]??m,fmt(v.totalScenarioMeanSumKRW),fmt(v.incrementalScenarioMeanSumKRW),fmt(v.revisionObservedSum)])));}
        }
        content.append(notice('每面板72个业务场景，每方法三次预固定重复。所有失败费用为 null。费用只在同场景同重复双方完成时配对、先场景内平均；区间条件于这个共同完成集合。正节省率表示候选更便宜，负数表示更贵。不同配对分母不能横向排名；五法共同集合也只代表该条件集合。',true));
      }
      const development=node('article','card reading-card');development.append(node('h2','','V11 开发方案（非正式成绩）'),node('p','','同费候选的“明日最低必需仓位”原型另行进行开发测试与离线复核，尚无新的正式留出成绩；不覆盖上方 V10 首次实验。'));
      const developmentLinks=node('div','heading-tools research-links');for(const [label,path]of [['V11 下一轮方法说明','/downloads/next-iteration-v11.zh.md'],['开发方案只读 Python 复核','/data/commitment-slack-review-v11.json'],['归档端点与模拟服务集成检查','/data/commitment-slack-integration-v11.json'],['公开证据答辩练习','/downloads/defense-drill-v11.zh.md']])developmentLinks.append(link(label,path));development.append(developmentLinks);content.append(development);
      const reports=node('div','heading-tools research-links');for(const [label,path]of [['中文报告','/downloads/report-v10.zh.md'],['正式结果','/data/v10-results.json'],['物理与选择复核','/data/review-v10.json'],['统计区间复核','/data/bootstrap-review-v10.json'],['韩文PDF','/downloads/defense-v10.ko.pdf'],['可编辑韩文PPT','/downloads/defense-v10.ko.pptx'],['同费保留与轨迹解释','/downloads/v10-result-interpretation.zh.md'],['V10压力损失逐例诊断','/downloads/v10-loss-diagnosis.zh.md'],['V9损失逐例诊断','/downloads/v9-loss-diagnosis.zh.md'],['浏览器验收记录','/downloads/browser-acceptance-v10.zh.md'],['下一步验收门槛','/downloads/next-validation-v9.zh.md']])reports.append(link(label,path));content.append(reports);
      content.append(notice(`浏览器真实操作：${release.browserInteractionValidation==='completed'?'已完成且有记录':'尚未完成'}；本人答辩实练：${release.entrantDefenseValidation==='completed'?'已完成且有记录':'尚未完成'}。企业试点为可选项：${release.externalBusinessValidation==='completed'?'已有明确记录':'尚无企业实测收益声明'}，不影响公开资料路线继续推进。研究结果及准备材料不代表报名、提交或名次保证。`,true));
      const acceptance=node('div','heading-tools research-links');for(const [label,path]of [['验收交接与可选试点','/downloads/acceptance-handoff-v10.zh.md'],['当前验收状态','/data/championship-acceptance-v10.json'],['可选试点空表：订单与人工基准','/data/pilot-orders-and-baseline-v10.csv'],['可选试点空表：资源报价与交付','/data/pilot-resources-and-quotes-v10.csv'],['可选试点空表：费用与反馈','/data/pilot-fees-and-feedback-v10.csv'],['空表：本人演练','/data/pilot-entrant-rehearsal-v10.csv']])acceptance.append(link(label,path));content.append(acceptance);
      const packages=await json('/data/download-packages-v10.json'),downloads=node('div','heading-tools research-links');content.append(notice('完整复现请下载清单中的全部分包，解压到同一父目录。所有首次原档、失败和冻结源码保留；重新实验使用新输出目录。'));
      for(const p of packages.packages)downloads.append(link(`${p.file} · ${fmt(p.bytes/1048576)} MiB`,p.url));content.append(downloads,link('全部下载包与SHA','/data/download-packages-v10.json'),link('跨电脑恢复及备份说明','/downloads/recovery-guide.zh.md'),link('源码恢复元信息','/data/source-recovery-v11.json'));
      const old=node('details','card reading-card'),summary=node('summary','','展开 V9 原研究页面与补救教学复核'),body=node('div');old.append(summary,body);old.addEventListener('toggle',()=>{if(old.open&&!body.childNodes.length){mountResearchV9UI(body);const title=body.querySelector('h1');if(title)title.id='research-v9-archive-title';}});content.append(old);
    }catch(error){content.replaceChildren(notice('验证资料暂不可读：'+error.message+'。未使用预计成绩替代结果。',true));}finally{refresh.disabled=false;busy=false;}}
  refresh.addEventListener('click',load);load();
}
