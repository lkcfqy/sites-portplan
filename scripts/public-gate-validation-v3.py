"""Calendar holdout for real, public gate observations; standard library only.

python scripts/public-gate-validation-v3.py --raw /path/to/official.csv
Without --raw, downloads the fixed official public file and checks its hash.
Vehicle identifiers are never copied into model inputs or outputs.
"""
import argparse,collections,csv,datetime as dt,hashlib,io,json,random,statistics,urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
URL='https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=FILE_000000003681505&fileDetailSn=1&insertDataPrcus=N'

def quantile(values,q):
    if not values:return None
    v=sorted(values);return v[min(len(v)-1,max(0,int((len(v)-1)*q)))]

def load_visits(raw):
    visits=[];blank=invalid=0
    for line,row in enumerate(csv.DictReader(io.StringIO(raw.decode('cp949'))),2):
        if not any(row.values()):blank+=1;continue
        try:
            start=dt.datetime.strptime(row['진입일시'],'%Y-%m-%d %H:%M')
            end=dt.datetime.strptime(row['진출일시'],'%Y-%m-%d %H:%M')
            y=(end-start).total_seconds()/60
            if y<0:raise ValueError('negative elapsed time')
        except (ValueError,KeyError):invalid+=1;continue
        visits.append({'sourceLine':line,'entry':start,'date':start.date().isoformat(),'hour':start.hour,'weekday':start.weekday(),'target':y})
    visits.sort(key=lambda r:(r['entry'],r['sourceLine']))
    return visits,{'allBlankRows':blank,'invalidDatetimeRows':invalid}

def fit_model(train,kind,min_count):
    if not train:raise ValueError('No training records')
    global_value=statistics.median(r['target'] for r in train)
    groups=collections.defaultdict(list)
    for r in train:
        key=r['hour'] if kind=='hour_median' else (r['weekday'],r['hour'])
        groups[key].append(r['target'])
    medians={k:statistics.median(v) for k,v in groups.items() if len(v)>=min_count}
    return {'kind':kind,'globalMedian':global_value,'groups':medians,'groupCounts':{k:len(v) for k,v in groups.items()}}

def predict(model,row):
    if model['kind']=='global_median':return model['globalMedian']
    key=row['hour'] if model['kind']=='hour_median' else (row['weekday'],row['hour'])
    return model['groups'].get(key,model['globalMedian'])

def metrics(model,rows):
    if not rows:return {'count':0,'mae':None,'medianAbsoluteError':None,'p90AbsoluteError':None,'byDate':[]}
    errors=[abs(predict(model,r)-r['target']) for r in rows]
    grouped=collections.defaultdict(list)
    for r,e in zip(rows,errors):grouped[r['date']].append(e)
    return {'count':len(rows),'mae':statistics.mean(errors),'medianAbsoluteError':statistics.median(errors),
      'p90AbsoluteError':quantile(errors,.9),'byDate':[{'date':k,'visits':len(v),'mae':statistics.mean(v)} for k,v in sorted(grouped.items())]}

def main(raw_path=None):
    protocol_bytes=(ROOT/'data/public-gate-protocol-v3.json').read_bytes();protocol=json.loads(protocol_bytes)
    raw=Path(raw_path).read_bytes() if raw_path else urllib.request.urlopen(URL,timeout=60).read()
    digest=hashlib.sha256(raw).hexdigest()
    if digest!=protocol['sourceSha256']:raise ValueError('Public source hash changed; review the new version before fitting.')
    rows,quality=load_visits(raw);p=protocol['split']
    train=[r for r in rows if r['date']<=p['trainEnd']]
    validation=[r for r in rows if p['validationStart']<=r['date']<=p['validationEnd']]
    test=[r for r in rows if p['testStart']<=r['date']<=p['testEnd']]
    if not validation or not test:raise ValueError('Empty validation/test period; no performance claim possible.')
    models=[fit_model(train,k,protocol['minimumGroupTrainingCount']) for k in protocol['candidates']]
    validation_metrics=[metrics(m,validation) for m in models]
    selected_index=min(range(len(models)),key=lambda i:(validation_metrics[i]['mae'],i))
    selected=models[selected_index]
    candidates=[{'model':m['kind'],'learnedGroups':len(m['groups']) if m['kind']!='global_median' else 0,
      'validation':v,'test':metrics(m,test)} for m,v in zip(models,validation_metrics)]
    chosen=candidates[selected_index]['test'];baseline=candidates[0]['test']
    daily_base={r['date']:r['mae'] for r in baseline['byDate']}
    daily_delta=[daily_base[r['date']]-r['mae'] for r in chosen['byDate']]
    rng=random.Random(protocol['dailyBootstrap']['seed'])
    boot=[statistics.mean(rng.choices(daily_delta,k=len(daily_delta))) for _ in range(protocol['dailyBootstrap']['resamples'])]
    summary={'sourceType':'public_observed_gate_visits','records':len(rows),'trainCount':len(train),'validationCount':len(validation),'testCount':len(test),
      'selectedModel':selected['kind'],'selectionPeriod':'May 2026 validation only','testMAE':chosen['mae'],'baselineMAE':baseline['mae'],
      'maeImprovementPct':100*(baseline['mae']-chosen['mae'])/baseline['mae'] if baseline['mae'] else None,
      'testMedianAbsoluteError':chosen['medianAbsoluteError'],'testP90AbsoluteError':chosen['p90AbsoluteError'],
      'observedTestDates':len(daily_delta),'equalDateMeanMAEImprovementMinutes':statistics.mean(daily_delta),
      'dailyBootstrap95IntervalMinutes':[quantile(boot,.025),quantile(boot,.975)]}
    feature_path=ROOT/'data/public/v3-gate-visits-deidentified.csv'
    with feature_path.open('w',encoding='utf-8',newline='') as f:
        w=csv.writer(f);w.writerow(['source_line','entry_local','elapsed_minutes'])
        for r in rows:w.writerow([r['sourceLine'],r['entry'].strftime('%Y-%m-%d %H:%M'),int(r['target'])])
    limitations=['These are observed Gwangyang gate visits, not PNC containers, truck routes or warehouse processing records.',
      'Missing dates are not imputed as zero activity. Features contain only entry hour/weekday, not future exits or whole-day counts.',
      'Repeated vehicles cannot be separated; date-block intervals are retrospective uncertainty diagnostics, not deployment guarantees.',
      'Training remains fixed at January-April; May chooses a declared model; June labels are used for evaluation only.',
      'Duration prediction accuracy cannot be translated into savings, appointment capacity or PNC operational validity.']
    output={'version':3,'studyStatus':protocol['studyStatus'],'generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),
      'source':{'url':URL,'catalogUrl':'https://www.data.go.kr/data/15059682/fileData.do','sha256':digest,'cleanedSha256':hashlib.sha256(feature_path.read_bytes()).hexdigest(),
        'timezone':'Asia/Seoul inferred','grain':'one public vehicle terminal visit'},
      'protocolSha256':hashlib.sha256(protocol_bytes).hexdigest(),'protocol':protocol,'quality':quality,'summary':summary,'candidates':candidates,
      'periods':{key:{'visits':len(v),'observedDates':len({r['date'] for r in v}),'firstEntry':v[0]['entry'].isoformat(),'lastEntry':v[-1]['entry'].isoformat()} for key,v in [('train',train),('validation',validation),('test',test)]},
      'testExamples':[{'entryLocal':r['entry'].isoformat(),'observedMinutes':r['target'],'predictionMinutes':predict(selected,r),'baselineMinutes':predict(models[0],r)} for r in test[::max(1,len(test)//40)][:40]],
      'limitations':limitations}
    (ROOT/'data/public-gate-validation-v3.json').write_text(json.dumps(output,ensure_ascii=False,indent=2)+'\n')
    md=f'''# 真实公开闸口记录的时间留出验证

本模块不需要企业提供资料。原始数据来自光阳港西部码头公开车辆进出记录，共{len(rows):,}条可解析观测；不是PNC箱级订单。目标是进入至离开闸口的场内停留分钟数。

## 冻结方法与结果

协议SHA-256：`{output['protocolSha256']}`。本研究是在已读公开汇总统计后设计的回顾性验证；候选方法在拟合前固定。1–4月训练（{len(train):,}条）、5月选模（{len(validation):,}条）、6月测试（{len(test):,}条）。不随机打散时间，不使用测试期退出信息或全天流量作为输入特征。模型只使用进入时已知的小时和星期。

选中的方法是`{selected['kind']}`。6月平均绝对误差为**{chosen['mae']:.2f}分钟**；固定训练期全局中位数基准为{baseline['mae']:.2f}分钟。误差降低{summary['maeImprovementPct']:.2f}%；负数也按原样保留。

| 预先声明的方法 | 5月MAE（选模） | 6月MAE（评估） |
|---|---:|---:|
'''+ '\n'.join(f"| {c['model']} | {c['validation']['mae']:.3f} | {c['test']['mae']:.3f} |" for c in candidates)+f'''

6月中位绝对误差{chosen['medianAbsoluteError']:.2f}分钟，P90绝对误差{chosen['p90AbsoluteError']:.2f}分钟。观察到{len(daily_delta)}个测试日期；逐日等权的MAE改善均值{statistics.mean(daily_delta):.3f}分钟，日期区组bootstrap95%区间[{summary['dailyBootstrap95IntervalMinutes'][0]:.3f}, {summary['dailyBootstrap95IntervalMinutes'][1]:.3f}]。这个等权日期指标与全部记录加权主指标的分母不同。

## 能支持的结论

这是一项真实公开观测上的后续月份误差验证，能检查公开数据支持的场内停留估计。对外报告必须同时呈现很小或为负的改善、缺失日期及尾部误差。模型未在现场部署，无法据此推断PNC费用、运输能力、仓库效率或节省收益。

所有车辆标识在建模和交付数据中删除。无稳定车辆ID，不能做车辆独立分组；表面重复记录保持原样。数据中缺失的日期不按零流量处理，韩国时间是位置推断而非CSV显式说明。

## 复现

`python scripts/public-gate-validation-v3.py --raw /path/to/official.csv`。省略`--raw`会从官方公开网址获取固定版本并校验SHA-256。完整无标识派生记录位于`data/public/v3-gate-visits-deidentified.csv`，候选指标和测试样例位于`data/public-gate-validation-v3.json`。
'''
    (ROOT/'docs/public-gate-validation-v3.md').write_text(md)
    print(json.dumps(summary,ensure_ascii=False,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--raw');args=parser.parse_args();main(args.raw)
