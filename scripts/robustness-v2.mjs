import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {solveOptimized} from '../src/engine.js';

const root=new URL('../',import.meta.url);
const isoDay=(start,offset)=>new Date(Date.parse(start+'T00:00:00Z')+offset*86400000).toISOString().slice(0,10);
const feasible=r=>r&&['optimal','feasible'].includes(r.status)&&Number.isFinite(r.totalCost)&&r.rows?.length>0;

export function makeStressScenario(seed){
  let state=seed>>>0;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
  const horizonStart='2026-10-12',future=seed%2===0;
  return {id:`stress-v2-${seed}`,name:'运营假设压力测试 · 合成订单',seed,horizonStart,horizonDays:14,
    truckCapacity:6,warehouseCapacity:4,stagingCapacity:8,
    containers:Array.from({length:16},(_,i)=>{
      const dischargeDay=future?Math.floor(random()*6):-3-Math.floor(random()*12);
      const releaseDay=Math.max(0,dischargeDay)+(random()<.3?1:0);
      return {id:`ST-${String(i+1).padStart(3,'0')}`,sizeFt:random()<.5?20:40,
        dischargeDateTime:isoDay(horizonStart,dischargeDay)+(random()<.5?'T07:00:00+09:00':'T10:00:00+09:00'),
        releaseDay,unloadDays:random()<.2?2:1,dueDay:Math.min(12,releaseDay+5+Math.floor(random()*4)),dataOrigin:'synthetic'};
    })};
}

// Separate implementation: does not call engine scheduleUsage/auditSchedule.
export function auditOperations(s,rows){
  const errors=[],counts={coverage:0,dates:0,release:0,sequence:0,deadline:0,truck:0,warehouse:0,staging:0};
  const add=(kind,text)=>{counts[kind]++;errors.push({kind,text});};
  const H=s.horizonDays,usage=Array.from({length:H},()=>({truck:0,warehouse:0,staging:0})),seen=new Set();
  const lag=s.operations?.returnLagDays??1,teu=s.operations?.stagingUnit==='teu';
  for(const r of rows||[]){
    const c=s.containers.find(c=>c.id===r.id);
    if(!c||seen.has(r.id)){add('coverage',`Unknown or duplicate ${r.id}`);continue;}
    seen.add(r.id);const p=r.pickupDay,u=r.unloadDay,v=r.returnDay,end=u+c.unloadDays-1;
    if(![p,u,v].every(d=>Number.isInteger(d)&&d>=0&&d<H)){add('dates',`${r.id}: outside horizon`);continue;}
    if(p<c.releaseDay)add('release',`${r.id}: before release`);
    if(u<p||v<end+lag)add('sequence',`${r.id}: actual processing not complete before return`);
    if(end>c.dueDay)add('deadline',`${r.id}: unload deadline missed`);
    usage[p].truck++;usage[v].truck++;
    for(let d=u;d<=end;d++){if(usage[d])usage[d].warehouse++;else add('dates',`${r.id}: unloading beyond horizon`);}
    for(let d=p;d<v;d++)usage[d].staging+=teu?c.sizeFt/20:1;
  }
  if(seen.size!==s.containers.length)add('coverage',`Missing ${s.containers.length-seen.size} containers`);
  for(let d=0;d<H;d++)for(const key of ['truck','warehouse','staging']){
    const cap=Array.isArray(s[key+'Capacity'])?s[key+'Capacity'][d]:s[key+'Capacity'];
    if(usage[d][key]>cap)add(key,`Day ${d}: ${usage[d][key]} > ${cap}`);
  }
  return {valid:errors.length===0,counts,errors,usage};
}

export function applyDisruption(s,name){
  const out=structuredClone(s);out.id=s.id+'-'+name;
  if(name==='transport-minus-2-on-days-3-5'||name==='both')out.truckCapacity=Array.from({length:s.horizonDays},(_,d)=>Math.max(0,(Array.isArray(s.truckCapacity)?s.truckCapacity[d]:s.truckCapacity)-([3,4,5].includes(d)?2:0)));
  if(name==='unload-plus-1-every-fourth-box'||name==='both')out.containers.forEach((c,i)=>{if(i%4===0)c.unloadDays++;});
  return out;
}

async function checkedSolve(s,limit){
  const result=await solveOptimized(s,{timeLimitSeconds:limit});
  const audit=feasible(result)?auditOperations(s,result.rows):null;
  if(audit&&!audit.valid)throw new Error(`${s.id}: independent operations check failed ${JSON.stringify(audit.errors)}`);
  return {result,audit};
}

export async function runRobustness(){
  const bytes=await readFile(new URL('data/robustness-protocol-v2.json',root));
  const protocol=JSON.parse(bytes),protocolSha256=createHash('sha256').update(bytes).digest('hex');
  const startedAt=new Date().toISOString(),cases=[];
  for(const seed of protocol.seeds){
    const scenario=makeStressScenario(seed),variants=[];
    for(const [id,lag,unit] of [['next-day-container-default',1,'container'],['same-day-container',0,'container'],['next-day-TEU',1,'teu'],['same-day-TEU',0,'teu']]){
      const s={...structuredClone(scenario),operations:{returnLagDays:lag,stagingUnit:unit}};
      const checked=await checkedSolve(s,protocol.solverTimeLimitSeconds);
      variants.push({id,scenario:s,...checked});
    }
    const initialPlan=variants[0].result,disruptions=[];
    for(const name of protocol.fixedDisruptions){
      const shocked=applyDisruption(scenario,name);
      const initialAudit=feasible(initialPlan)?auditOperations(shocked,initialPlan.rows):null;
      const hindsight=await checkedSolve(shocked,protocol.solverTimeLimitSeconds);
      disruptions.push({name,scenario:shocked,initialAudit,hindsight,
        interpretation:'Reoptimization knows every realized disruption from time zero; it is a hindsight diagnostic, not online recovery. No savings claimed against an infeasible initial schedule.'});
    }
    cases.push({id:scenario.id,seed,mechanism:seed%2?'backlog':'new-arrivals',scenario,variants,initialPlan,disruptions});
    console.log(`stress ${cases.length}/${protocol.seeds.length}: ${scenario.id}, initial=${initialPlan.status}`);
  }
  const all=cases.flatMap(c=>c.disruptions),checked=all.filter(d=>d.initialAudit);
  const summary={baseCases:cases.length,operationalVariants:cases.reduce((n,c)=>n+c.variants.length,0),
    initialFeasiblePlans:cases.filter(c=>feasible(c.initialPlan)).length,
    disruptionCases:all.length,initialPlansAudited:checked.length,
    originalPlanInvalidCount:checked.filter(d=>!d.initialAudit.valid).length,
    hindsightFeasibleCount:all.filter(d=>feasible(d.hindsight.result)).length,
    hindsightOptimalCount:all.filter(d=>d.hindsight.result.status==='optimal').length,
    independentAuditedSchedules:cases.reduce((n,c)=>n+c.variants.filter(v=>v.audit).length+c.disruptions.filter(d=>d.hindsight.audit).length,0),
    byDisruption:Object.fromEntries(protocol.fixedDisruptions.map(name=>{const ds=all.filter(d=>d.name===name);return [name,{cases:ds.length,initialAudited:ds.filter(d=>d.initialAudit).length,initialInvalid:ds.filter(d=>d.initialAudit&&!d.initialAudit.valid).length,hindsightFeasible:ds.filter(d=>feasible(d.hindsight.result)).length}];}))};
  const output={version:2,startedAt,generatedAt:new Date().toISOString(),protocolSha256,protocol,summary,cases};
  await writeFile(new URL('data/robustness-v2.json',root),JSON.stringify(output,null,2)+'\n');
  const md=`# V2 运营假设与扰动压力测试\n\n协议 SHA-256：\`${protocolSha256}\`。公开费率驱动的合成订单研究，不是企业实测。\n\n固定 ${summary.baseCases} 个独立种子，每个比较4种还空/箱位假设，共 ${summary.operationalVariants} 个配对配置。相同基础订单的变体相关，不按独立样本推断。\n\n## 既定计划经不起所有扰动\n\n${summary.initialFeasiblePlans} 个初始计划可行。针对固定三类扰动，共检查 ${summary.initialPlansAudited} 次原计划，其中 **${summary.originalPlanInvalidCount} 次失去可行性**。扰动为第3–5日每日运输额度减2、每第4箱卸货增加1天，以及两者同时发生。按真实处理时长重新检查，记录运输/仓库超容量、时序及期限，不用旧的unloadEndDay掩盖延误。\n\n| 扰动 | 检查原计划 | 原计划失效 | 事后全信息重算可行 |\n|---|---:|---:|---:|\n${Object.entries(summary.byDisruption).map(([k,v])=>`| ${k} | ${v.initialAudited} | ${v.initialInvalid} | ${v.hindsightFeasible} |`).join('\n')}\n\n所有扰动从规划开始即已知的重算中，${summary.hindsightFeasibleCount}/${summary.disruptionCases} 找到可行解，${summary.hindsightOptimalCount} 返回模型最优状态。**这只是事后全信息诊断；没有冻结已执行动作，也不是在线滚动策略，不能当成上线后的恢复成功率。** 原计划若已不可行，不与其收费计算所谓节省。\n\n${summary.independentAuditedSchedules} 份新求得的完整排程通过另行实现的约束检查。费用公式的独立交叉核验见主基准实验。\n\n## 作业假设口径\n\n同日还空允许最后卸货日返空，运输提/还各消耗1箱次；箱位仍是跨日留存库存，p≤d<r。因此同日提卸还不占跨日箱位，未模拟日内临时场地。TEU模式使40ft占2库存位，不等于实际场站堆叠模型。各方案均为待业务确认的压力假设。\n\n## 可复现与结论\n\n运行 \`node scripts/robustness-v2.mjs\`，所有固定场景、原排程、变体及失败均保存在 \`data/robustness-v2.json\`。结果表明静态模型可行不等于遇到扰动后仍能执行；真正在线滚动、已执行任务冻结和部分已知信息实验仍是提交前工作。\n`;
  await writeFile(new URL('docs/robustness-v2.md',root),md);
  return output;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify((await runRobustness()).summary,null,2));
