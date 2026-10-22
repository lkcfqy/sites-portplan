const node=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=String(text);return e;};
const fmt=n=>Number.isFinite(n)?new Intl.NumberFormat('zh-CN',{maximumFractionDigits:3}).format(n):'—';
const names={stableRetainV5:'V5 稳定保留',costPolishV7:'V7 费用修整',adaptiveV8:'V8 自适应（原版）',adaptiveV9:'V9 及时候选交付',highsV8:'原生 HiGHS'};
function table(title,headers,rows){const card=node('article','card schedule-section'),head=node('div','card-header');head.append(node('h2','card-title',title));card.append(head);const wrap=node('div','table-wrap'),t=node('table','data-table'),thead=node('thead'),tr=node('tr');headers.forEach(h=>tr.append(node('th','',h)));thead.append(tr);const body=node('tbody');rows.forEach(row=>{const tr=node('tr');row.forEach(value=>tr.append(node('td','',value??'—')));body.append(tr);});t.append(thead,body);wrap.append(t);card.append(wrap);return card;}
function link(label,path){const a=node('a','button small',label);a.href=path;a.download=path.split('/').pop();return a;}
const notice=(text,warning=false)=>node('div','notice'+(warning?' warning':''),text);

export function mountResearchV9UI(container){
  const heading=node('div','page-heading'),copy=node('div'),content=node('div'),refresh=node('button','button','刷新验证状态');
  copy.append(node('div','eyebrow','V9 / TIMELY CANDIDATES & EXPLICIT RECOVERY'),node('h1','','候选及时交付与明示资源补救'),node('p','','先保留及时验算的完整方案，再评估后续改进；业务补救只使用明确给定的价格、资源和权限。'));
  copy.querySelector('h1').id='research-v9-title';heading.append(copy,refresh);container.replaceChildren(heading,content);let loading=false;
  async function json(path){const r=await fetch(path);if(!r.ok)throw new Error('HTTP '+r.status);return r.json();}
  async function load(){if(loading)return;loading=true;refresh.disabled=true;content.replaceChildren(notice('正在读取已保存的结果与独立审核…'));
    try{
      const release=await json('/data/v9-release.json');
      content.replaceChildren(notice('研究原型：公开费率、合成订单、日级资源模型。原生对照、内部独立核验与情景采购建议不等于现场运行或真实企业收益。',true));
      content.append(notice('当前开发采用公开资料与可复现研究路线；企业实单、报价、联系人及试点是可选增强，不作为继续研发的条件。以下 V9 成绩与原始分母保留。'));
      const currentRoute=node('div','heading-tools research-links');for(const [label,path]of [['当前公开证据包','/data/public-evidence-readiness-v11.json'],['公开资料路线说明','/downloads/public-evidence-route-v11.zh.md'],['换电脑恢复开发','/downloads/recovery-guide.zh.md']])currentRoute.append(link(label,path));content.append(currentRoute);
      const state=node('article','card reading-card');state.append(node('h2','','V9 历史交付记录'),node('p','',release.notes));
      state.append(node('p','',`正式实验：${release.formalExperimentComplete?'已完成':'尚未完成'}；物理与费用审核：${release.independentReviewComplete?'已完成':'尚未完成'}；统计区间复算：${release.independentBootstrapReviewComplete?'已完成':'尚未完成'}。`));content.append(state);
      content.append(table('V8 首次负结果仍保留',['面板','原 V8 完整次数','当时 V7 完整次数','结论'],[['同分布旧留出','80 / 216','156 / 216','可行候选晚交付导致覆盖回归'],['旧压力面板','48 / 216','89 / 216','旧结果不覆盖；不与新场景合并分母']]));
      content.append(notice('V9 在内层首次形成完整候选时同步交给外层复制、重计价、资源及执行锁审核。只有外层期限内完成审核和选择的候选可保留；晚出现或晚审核的方案不追认。已及时保留的方案不被晚结束的可选优化抹掉。'));
      const methods=node('div','heading-tools research-links');for(const [label,path]of [['V9 方法说明','/downloads/adaptive-method-v9.md'],['资源补救的菜单与证明范围','/downloads/resource-recovery-v9.md'],['预固定实验协议','/downloads/experiment-protocol-v9.md'],['本轮实施记录','/downloads/v9-progress.zh.md']])methods.append(link(label,path));content.append(methods);
      if(release.formalExperimentComplete){
        const r=await json('/data/v9-results.json');
        for(const [panel,s]of Object.entries(r.summary.panels)){
          content.append(table(panel==='same-distribution'?'同生成机制 · 新订单种子':'压力扰动 · 新订单种子',['方法','完整次数 / 运行数','三次均完整的场景','至少一次完整','硬截止 / 历史未知'],Object.entries(s.byMethod).map(([m,v])=>[names[m]??m,`${v.completeEpisodeCount} / ${v.recordedEpisodeCount}`,`${v.fullyCompletedScenarioCount} / ${v.scenarioCount}`,`${v.anyCompletedScenarioCount} / ${v.scenarioCount}`,`${v.hardDeadlineCount} / ${v.executionHistoryUnavailableCount}`])));
          content.append(table('完成与费用取舍 · '+panel,['候选 / 基准','完整次数增 / 损','配对场景 / 运行','总两费节省','新增费节省','总两费节省95%区间','费用更低 / 同 / 更高 · 场景数'],Object.values(s.comparisons).map(p=>{const f=p.fees.total,ci=f.uncertainty?.weightedSavingsPct95CI;return[`${names[p.candidateMethod]} / ${names[p.baselineMethod]}`,`${p.completion.gainedEpisodeCount} / ${p.completion.lostEpisodeCount}`,`${f.pairedScenarioCount} / ${f.pairedEpisodeCount}`,f.weightedSavingsPct===null?'无分母':fmt(f.weightedSavingsPct)+'%',p.fees.incremental.weightedSavingsPct===null?'无分母':fmt(p.fees.incremental.weightedSavingsPct)+'%',ci?ci.map(fmt).join(' ~ ')+'%':'—',`${f.scenarioWinTieLoss.win} / ${f.scenarioWinTieLoss.tie} / ${f.scenarioWinTieLoss.loss}`];})));
        }
        content.append(notice('每面板72个业务场景、每方法三次预固定重复。216次运行不是216个独立业务场景；费用只在同场景同重复双方完整时配对，先场景内平均再等权。区间条件于共同完成集合，不能消除选择偏差。不同配对集合不能横向排名；所有失败费用为null。',true));
        const reports=node('div','heading-tools research-links');for(const [label,path]of [['中文完整报告','/downloads/report-v9.zh.md'],['候选轨迹与退步解释','/downloads/v9-result-interpretation.zh.md'],['独立物理复核','/data/review-v9.json'],['独立区间复核','/data/bootstrap-review-v9.json'],['正式结果索引','/data/v9-results.json'],['韩文 PDF','/downloads/defense-v9.ko.pdf'],['可编辑韩文 PPT','/downloads/defense-v9.ko.pptx'],['韩文报告','/downloads/submission-v9.ko.md']])reports.append(link(label,path));content.append(reports);
      }
      content.append(notice('资源补救仅在用户明确输入的授权动作菜单内比较采购费，或比较新增两费加采购费。它只对当前观察、名义未来及真实过去锁成立；菜单未覆盖的车辆、报价和未来冲击不在证明范围内。建议不会执行购买。',true));
      content.append(notice('资源补救另有 1 箱、两种教学菜单 × 两种目标的原始记录与 Python 有限枚举复核；不计入正式实验的 144 个场景，也不代表真实采购验证。'));
      const recoveryLinks=node('div','heading-tools research-links');for(const [label,path]of [['资源补救原始输入与结果','/data/resource-validation-v9.json'],['Python 有限枚举复核','/data/resource-review-v9.json'],['资源教学验证说明','/downloads/resource-validation-v9.zh.md'],['下一步验收清单','/downloads/next-validation-v9.zh.md']])recoveryLinks.append(link(label,path));content.append(recoveryLinks);
      content.append(notice(`浏览器交互验收：${release.browserInteractionValidation==='completed'?'已有明确记录':'尚未完成'}；本人答辩验收：${release.entrantDefenseValidation==='completed'?'已有明确记录':'尚未完成'}。企业验证是可选项：${release.externalBusinessValidation==='completed'?'已有明确记录':'尚无企业实测收益声明'}。当前公开资料路线不以取得企业资料为前置条件。`));
      const packages=await json('/data/download-packages-v9.json'),downloads=node('div','heading-tools research-links');content.append(notice('完整复现请下载清单中的全部包，并解压到同一父目录。求解器源码单列，实验按平台单文件限制分包，全部原始SHA分块保持完整。'));
      for(const p of packages.packages)downloads.append(link(`${p.file} · ${fmt(p.bytes/1048576)} MiB`,p.url));content.append(downloads,link('下载包与SHA清单','/data/download-packages-v9.json'));
    }catch(error){content.replaceChildren(notice('验证资料暂时无法读取：'+error.message+'。没有用预计成绩填充。',true));}finally{loading=false;refresh.disabled=false;}}
  refresh.addEventListener('click',load);load();
}
