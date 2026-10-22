import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {solveConservativePlan} from '../src/conservative-plan.js';
import {makeStressScenario,applyDisruption,auditOperations} from './robustness-v2.mjs';

const root=new URL('../',import.meta.url);
const feasible=r=>r&&['optimal','feasible'].includes(r.status)&&r.rows?.length>0&&Number.isFinite(r.totalCost);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const pct=(premium,denominator)=>denominator>0?premium/denominator*100:null;

export async function runConservative(){
  const protocolBytes=await readFile(new URL('data/conservative-protocol-v2.json',root));
  const baselineBytes=await readFile(new URL('data/robustness-v2.json',root));
  const protocol=JSON.parse(protocolBytes),baseline=JSON.parse(baselineBytes),cases=[];
  const startedAt=new Date().toISOString();
  for(const seed of protocol.seeds){
    const scenario=makeStressScenario(seed),original=baseline.cases.find(c=>c.seed===seed);
    if(!original||JSON.stringify(scenario)!==JSON.stringify(original.scenario))throw new Error(`Seed ${seed} baseline scenario changed; frozen study cannot silently substitute.`);
    const planned=await solveConservativePlan(scenario,{extraUnloadDays:protocol.bufferRule.extraUnloadDaysForEVERYContainer,
      reserveTruckMovements:protocol.bufferRule.truckMovementsReservedOnEVERYHorizonDay,timeLimitSeconds:protocol.solverTimeLimitSeconds});
    const initialAudit=feasible(original.initialPlan)?auditOperations(scenario,original.initialPlan.rows):null;
    const worstCaseAudit=feasible(planned.worstCaseResult)?auditOperations(planned.worstCaseScenario,planned.worstCaseResult.rows):null;
    const nominalAudit=feasible(planned.nominalResult)?auditOperations(scenario,planned.nominalResult.rows):null;
    for(const audit of [initialAudit,worstCaseAudit,nominalAudit])if(audit&&!audit.valid)throw new Error(`Seed ${seed} independent audit failed: ${JSON.stringify(audit.errors)}`);
    const disturbances=protocol.fixedDisruptions.map(name=>{
      const actual=applyDisruption(scenario,name);
      return {name,originalAudit:feasible(original.initialPlan)?auditOperations(actual,original.initialPlan.rows):null,
        conservativeAudit:feasible(planned.nominalResult)?auditOperations(actual,planned.nominalResult.rows):null};
    });
    // Monotone capacity/duration envelope: every concrete fixed disturbance must pass if worst-case plan exists.
    if(disturbances.some(d=>d.conservativeAudit&&!d.conservativeAudit.valid))throw new Error(`Seed ${seed}: claimed buffer envelope failed.`);
    const paired=feasible(original.initialPlan)&&feasible(planned.nominalResult);
    const cost=paired?{
      originalTotal:original.initialPlan.totalCost,conservativeTotal:planned.nominalResult.totalCost,
      originalIncremental:original.initialPlan.incrementalCost,conservativeIncremental:planned.nominalResult.incrementalCost,
      totalPremium:planned.nominalResult.totalCost-original.initialPlan.totalCost,
      incrementalPremium:planned.nominalResult.incrementalCost-original.initialPlan.incrementalCost,
      totalPremiumPct:pct(planned.nominalResult.totalCost-original.initialPlan.totalCost,original.initialPlan.totalCost),
      incrementalPremiumPct:pct(planned.nominalResult.incrementalCost-original.initialPlan.incrementalCost,original.initialPlan.incrementalCost),
    }:null;
    cases.push({seed,id:scenario.id,scenario,originalPlan:original.initialPlan,initialAudit,...planned,worstCaseAudit,nominalAudit,disturbances,cost});
    console.log(`conservative ${cases.length}/${protocol.seeds.length}: ${planned.worstCaseResult.status}, premium=${cost?.totalPremium??'NA'}`);
  }
  const paired=cases.filter(c=>c.cost),ds=cases.flatMap(c=>c.disturbances);
  const totalOriginal=paired.reduce((n,c)=>n+c.cost.originalTotal,0),incrementalOriginal=paired.reduce((n,c)=>n+c.cost.originalIncremental,0);
  const totalPremium=paired.reduce((n,c)=>n+c.cost.totalPremium,0),incrementalPremium=paired.reduce((n,c)=>n+c.cost.incrementalPremium,0);
  const summary={cases:cases.length,originalFeasible:cases.filter(c=>c.initialAudit?.valid).length,
    conservativeFeasible:cases.filter(c=>c.nominalAudit?.valid).length,conservativeOptimal:cases.filter(c=>c.worstCaseResult.status==='optimal').length,
    conservativeStatuses:Object.fromEntries([...new Set(cases.map(c=>c.worstCaseResult.status))].map(status=>[status,cases.filter(c=>c.worstCaseResult.status===status).length])),
    pairedCostCases:paired.length,totalOriginal,totalPremium,totalPremiumPct:pct(totalPremium,totalOriginal),incrementalOriginal,incrementalPremium,incrementalPremiumPct:pct(incrementalPremium,incrementalOriginal),
    originalDisturbanceAudits:ds.filter(d=>d.originalAudit).length,originalInvalid:ds.filter(d=>d.originalAudit&&!d.originalAudit.valid).length,
    conservativeDisturbanceAudits:ds.filter(d=>d.conservativeAudit).length,conservativeInvalid:ds.filter(d=>d.conservativeAudit&&!d.conservativeAudit.valid).length,
    independentAuditCount:cases.reduce((n,c)=>n+Number(!!c.initialAudit)+Number(!!c.worstCaseAudit)+Number(!!c.nominalAudit)+c.disturbances.filter(d=>d.originalAudit).length+c.disturbances.filter(d=>d.conservativeAudit).length,0)};
  const output={version:2,studyStatus:protocol.studyStatus,startedAt,generatedAt:new Date().toISOString(),protocolSha256:hash(protocolBytes),baselineArtifactSha256:hash(baselineBytes),protocol,summary,cases};
  await writeFile(new URL('data/conservative-v2.json',root),JSON.stringify(output,null,2)+'\n');
  const percent=v=>v===null?'NA':v.toFixed(2)+'%';
  const md=`# V2 保守缓冲计划：探索性成本与可行性权衡\n\n**在观察静态原计划18次固定扰动检查中16次失效之后设计的探索性实验。** 不是主48案例预注册实验的一部分，不能解释成独立确认性发现或随机失效率。协议先于本实验运行冻结；SHA-256：\`${output.protocolSha256}\`。原计划读取已有运营压力数据，不重选。\n\n## 固定规则\n\n相同6个root种子，所有箱卸货时长加1天，整个周期每天运输能力预留2箱次，其他输入保持。没有先看具体故障日期或受影响箱再选择缓冲。2秒MILP预算/例；计划事件日期一旦选定，在名义、最坏情况和三种扰动检查中保持不变。\n\n## 结果\n\n${summary.conservativeFeasible}/${summary.cases}个保守计划完整可行，其中${summary.conservativeOptimal}个证明在保守模型下最优。状态分布：${JSON.stringify(summary.conservativeStatuses)}。未找到保守计划的案例仍保留。\n\n| Seed | 保守模型状态 | 完整两费额外成本（KRW） | 相对原完整两费 | 相对原增量费用 |\n|---|---|---:|---:|---:|\n${cases.map(c=>`| ${c.seed} | ${c.worstCaseResult.status} | ${c.cost?.totalPremium??'NA'} | ${percent(c.cost?.totalPremiumPct??null)} | ${percent(c.cost?.incrementalPremiumPct??null)} |`).join('\n')}\n\n在${summary.pairedCostCases}个双方完整可行的配对案例中，额外费用合计${summary.totalPremium.toLocaleString('en-US')}韩元，相对原完整两费合计${summary.totalOriginal.toLocaleString('en-US')}韩元为**${percent(summary.totalPremiumPct)}**；相对原规划期增量费用合计${summary.incrementalOriginal.toLocaleString('en-US')}韩元为${percent(summary.incrementalPremiumPct)}。这是合成订单、公开标准费率下的模型成本，不是观察到的实际成本，也不包括运输/人力等其他成本。两种百分比的分母不同。\n\n原排程在${summary.originalDisturbanceAudits}次固定扰动检查中${summary.originalInvalid}次失效；找到的保守排程在${summary.conservativeDisturbanceAudits}次同类检查中${summary.conservativeInvalid}次失效。三次检查复用同一场景，**不按独立随机样本计算失败率**。共${summary.independentAuditCount}次检查由另行实现的auditOperations复算实际卸货末日和全部操作约束，不依赖保存的unloadEndDay。\n\n## 可保证的范围\n\n若保守计划完整可行，且每箱实际卸货时长介于名义值与名义+1天之间、每一天实际运输能力不低于max(0,名义−2)，其他输入不变，则固定计划在这套静态日粒度约束中可行。这来自单调包含关系：任何范围内实际装卸占用区间都不长于规划的最坏区间，实际运输容量不低于规划容量，提/卸开始/还箱日期不变。仍需业务核实费用合同、日内路线与时窗。\n\n**不是线上滚动调度，不覆盖到港/放行延误、两天以上装卸延误、更多运力损失、仓库或场地容量变化。** 不保证真实业务或范围外扰动。保守模型不可行或超时时，没有可保证的计划；这也是必须展示的代价。\n\n运行\`node scripts/conservative-v2.mjs\`复现。冻结协议见\`data/conservative-protocol-v2.json\`，完整事件日期、审计、失败和费用见\`data/conservative-v2.json\`。\n`;
  await writeFile(new URL('docs/conservative-v2.md',root),md);
  return output;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify((await runConservative()).summary,null,2));
