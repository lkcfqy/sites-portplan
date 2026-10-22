import {pncStorageCost,maerskDDCost} from './engine.js';

const pncSource={title:'PNC 2026 Standard Tariff',url:'https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf',page:4,localFile:'data/public/pnc_2026_standard_tariff.pdf'};
const ddSource={title:'Maersk Korea free-time / pre-DO guide',url:'https://www.maersk.com/~/media_sc9/maersk/local-information/files/asia-pacific/korea/import/freetime-pre-do-check-guideline.pdf',page:1,localFile:'data/public/v2-maersk-korea-calculator-guide.pdf'};
const ddRateSource={title:'Maersk Korea import published rate bands',url:'https://www.maersk.com/local-information/asia-pacific/south-korea/import',page:null,localFile:null};

export const PUBLIC_FEE_EXAMPLES=[
  {id:'pnc-official-20ft-day15',evidenceType:'official_worked_example',source:{...pncSource},feeType:'pncStorage',elapsedDays:15,sizeFt:20,expectedKRW:500500,
    formula:'(15 − 4) × 45,500 = 500,500',sourceInterpretation:'PDF第4页明确写出20ft进口重箱15天、超期11天按最高档45,500计费。验证回溯最高档算法，不是企业实际账单。'},
  {id:'maersk-official-40hc-3charged',evidenceType:'official_worked_example',source:{...ddSource},feeType:'maerskDD',elapsedDays:13,sizeFt:40,sizeLabel:'40 Dry High',expectedKRW:90000,
    formula:'(13 − 10) × 30,000 = 90,000',sourceInterpretation:'官方截图免期2025-12-03至12-12，12-15返空、3个收费日、90,000韩元。全部落在第一档，不能据此证明跨档逐日累加。'},
  ...[[4,20,0,'0（四天免费）'],[7,20,27300,'(7 − 4) × 9,100'],[8,20,72800,'(8 − 4) × 18,200'],[9,20,91000,'(9 − 4) × 18,200'],[10,20,191100,'(10 − 4) × 31,850'],[14,20,318500,'(14 − 4) × 31,850'],[15,40,1001000,'(15 − 4) × 45,500 × 2 TEU']].map(([elapsedDays,sizeFt,expectedKRW,formula])=>({
    id:`pnc-derived-${sizeFt}ft-day${elapsedDays}`,evidenceType:'derived_boundary_case',source:{...pncSource,page:3,secondaryPage:4},feeType:'pncStorage',elapsedDays,sizeFt,expectedKRW,formula,
    sourceInterpretation:'根据官方费率表及第4页最高档回溯规则手工推导的边界检查，不是来源中逐个刊载的算例，也不是观察到的发票。'})),
  ...[[10,20,0,'0（十天免费）'],[15,20,75000,'5 × 15,000'],[16,20,105000,'5 × 15,000 + 1 × 30,000'],[21,40,490000,'5 × 30,000 + 5 × 50,000 + 1 × 90,000']].map(([elapsedDays,sizeFt,expectedKRW,formula])=>({
    id:`maersk-derived-${sizeFt}ft-day${elapsedDays}`,evidenceType:'derived_boundary_case',source:{...ddRateSource},feeType:'maerskDD',elapsedDays,sizeFt,expectedKRW,formula,
    sourceInterpretation:'费率档来自韩国官方页面；跨档逐日累加仍为模型解释。通过只证明实现与该解释一致，不能将本推导作为独立官方跨档证据。'})),
];

/** Independently structured arithmetic, deliberately not calling engine tariff helpers. */
function referenceFee(example) {
  const n=example.elapsedDays,teu=example.sizeFt/20;
  if(example.feeType==='pncStorage'){
    if(n<=4)return 0;
    const bracket=[[5,7,9100],[8,9,18200],[10,14,31850],[15,Infinity,45500]].find(([a,b])=>n>=a&&n<=b);
    return (n-4)*bracket[2]*teu;
  }
  let amount=0;
  const rate=example.sizeFt===20?[15000,30000,50000]:[30000,50000,90000];
  for(let day=11;day<=n;day++)amount+=day<=15?rate[0]:day<=20?rate[1]:rate[2];
  return amount;
}

export function evaluatePublicExamples(cases=PUBLIC_FEE_EXAMPLES) {
  if(!Array.isArray(cases))throw new Error('Public examples must be an array.');
  const ids=new Map();for(const c of cases)if(c&&typeof c.id==='string')ids.set(c.id,(ids.get(c.id)??0)+1);
  const evaluated=cases.map((c,index)=>{
    const errors=[];
    if(!c||typeof c!=='object')return {id:`invalid-${index}`,status:'invalid',errors:['Example must be an object.'],isActualInvoice:false};
    if(typeof c.id!=='string'||!c.id||ids.get(c.id)>1)errors.push('id must be nonempty and unique.');
    if(!['official_worked_example','derived_boundary_case'].includes(c.evidenceType))errors.push('Unknown evidenceType.');
    if(!['pncStorage','maerskDD'].includes(c.feeType))errors.push('Unknown feeType.');
    if(!Number.isInteger(c.elapsedDays)||c.elapsedDays<0||c.elapsedDays>36500)errors.push('elapsedDays must be an integer from 0 to 36500.');
    if(![20,40].includes(c.sizeFt))errors.push('Only 20ft and 40ft dry examples are supported.');
    if(!Number.isFinite(c.expectedKRW)||c.expectedKRW<0)errors.push('expectedKRW must be finite and nonnegative; missing is not zero.');
    if(typeof c.source?.url!=='string'||!/^https:\/\//.test(c.source.url)||typeof c.source?.title!=='string')errors.push('A titled HTTPS source reference is required.');
    if(c.evidenceType==='official_worked_example'&&(!Number.isInteger(c.source?.page)||c.source.page<1))errors.push('Official PDF worked examples require an exact positive page number.');
    if(typeof c.formula!=='string'||typeof c.sourceInterpretation!=='string')errors.push('formula and sourceInterpretation must be explicit text.');
    if(errors.length)return {...c,status:'invalid',actualKRW:null,referenceKRW:null,errors,isActualInvoice:false};
    const actualKRW=c.feeType==='pncStorage'?pncStorageCost(c.elapsedDays,c.sizeFt):maerskDDCost(c.elapsedDays,c.sizeFt);
    const referenceKRW=referenceFee(c);
    return {...c,actualKRW,referenceKRW,status:actualKRW===c.expectedKRW&&referenceKRW===c.expectedKRW?'pass':'fail',differenceKRW:actualKRW-c.expectedKRW,
      errors:[],isActualInvoice:false,validationScope:c.evidenceType==='official_worked_example'?'agreement_with_source_worked_example':'implementation_consistency_under_stated_interpretation'};
  });
  return {summary:{total:evaluated.length,passed:evaluated.filter(c=>c.status==='pass').length,failed:evaluated.filter(c=>c.status==='fail').length,
    invalid:evaluated.filter(c=>c.status==='invalid').length,officialWorkedExamples:evaluated.filter(c=>c.evidenceType==='official_worked_example').length,
    derivedCases:evaluated.filter(c=>c.evidenceType==='derived_boundary_case').length},cases:evaluated,
    limitations:['Two official worked examples are narrow arithmetic evidence, not observed customer invoices or operational savings.',
      'Derived boundary cases are our deductions from rules, not independent official numerical examples.',
      'The Maersk official first-band example does not settle cross-band progressive versus retrospective billing.',
      'Default published research tariffs exclude contract adjustments and VAT; no claim of actual payable invoices.']};
}
