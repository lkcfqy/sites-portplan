#!/usr/bin/env python3
"""Bounded execution of the publicly supplied PLOS code; original functions stay unchanged."""
from __future__ import annotations
import argparse
import ast
import contextlib
import hashlib
import io
import json
import math
import os
from pathlib import Path
import platform
import random
import signal
import subprocess
import sys
import tempfile
import time
import traceback
import zipfile

ROOT=Path(__file__).resolve().parents[1]
ARCHIVE=ROOT/'data/public/v2-external-plos-code.zip'
PREFIX='S1 file/Code/'
PROTOCOL=ROOT/'data/public-reproduction-protocol-v3.json'
OUTPUT=ROOT/'data/external-reproduction-v3.json'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def read_source():
    with zipfile.ZipFile(ARCHIVE) as archive:
        return archive.read(PREFIX+'Main.py'), {name:archive.read(PREFIX+name) for name in ['demand2','distance','time_list2']}

def load_original():
    import numpy as np
    source,inputs=read_source()
    tree=ast.parse(source.decode('utf-8-sig'),filename='PLOS-S1-original-Main.py')
    functions=[node for node in tree.body if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef))]
    main=next(node for node in tree.body if isinstance(node,ast.If))
    globals_={'__name__':'public_plos_reproduction','np':np,'math':math,'random':random}
    defaults={}
    for node in main.body:
        if isinstance(node,ast.Assign) and len(node.targets)==1 and isinstance(node.targets[0],ast.Name):
            try:defaults[node.targets[0].id]=ast.literal_eval(node.value)
            except (ValueError,TypeError):pass
    globals_.update(defaults)
    # Function ASTs are reused verbatim. GUI imports/style and __main__ execution are omitted.
    exec(compile(ast.Module(body=functions,type_ignores=[]),'PLOS-S1-original-Main.py','exec'),globals_)
    return globals_,defaults,inputs,{'originalMainSHA256':digest(source),'archiveSHA256':digest(ARCHIVE.read_bytes()),
        'functionASTSHA256':digest(ast.dump(ast.Module(body=functions,type_ignores=[]),include_attributes=False).encode()),
        'algorithmFunctions':[node.name for node in functions],
        'adapterChanges':['Execute all original function definitions unchanged through AST.','Do not execute __main__ or GUI imports/style/show.','Supply literal __main__ constants as globals.','Seed Python random and numpy.'],
        'inputSHA256':{name:digest(data) for name,data in inputs.items()}}

def parameters(defaults,variant):
    result={key:defaults[key] for key in ['evaporation_rate','Q','docks','yards','customer','t1','t2','t3','v_load','v_empty','e','e_time','l','l_time','C_load','C_empty','C_idle','slot_limit','prices','w','c1','c2']}
    result=json.loads(json.dumps(result))
    if variant=='paper':
        result['t1']=3.5;result['t3']=2.5;result['slot_limit'][1][8]=37
    elif variant!='code':raise ValueError('Unknown parameter variant')
    return result

def jsonable(value):
    if hasattr(value,'tolist'):return value.tolist()
    if isinstance(value,dict):return {key:jsonable(v) for key,v in value.items()}
    if isinstance(value,(list,tuple)):return [jsonable(v) for v in value]
    if isinstance(value,float) and not math.isfinite(value):return None
    return value

def independent_audit(best,params,input_files):
    """Audit output contracts without calling any of the original algorithm functions."""
    lines=input_files['demand2'].decode().splitlines()
    expected=[[int(x) for x in lines[i].split()[2:]] for i in [1,2]]
    time_tokens=input_files['time_list2'].decode().splitlines()[1].split()[2:]
    windows=[tuple(float(v) for v in token.strip('()').split(',')) for token in time_tokens]
    matrix=[[float(x) for x in line.split()[1:]] for line in input_files['distance'].decode().splitlines()[1:]]
    routes=best['path'];times=best['total_node_time_list'];errors=[];unverified=[]
    demand_counts=[[0]*6,[0]*6];loaded_arrivals=[0]*12;all_terminal_arrivals=[0]*12
    inferred_loaded=[];ambiguous=[];window_errors=[]
    if len(routes)!=len(times):errors.append('Route and timestamp-list counts differ')
    for route_index,(route,clock) in enumerate(zip(routes,times)):
        if len(route)!=len(clock):errors.append(f'Route {route_index}: node/time length mismatch')
        if any(node not in range(1,8) for node in route):errors.append(f'Route {route_index}: unknown node')
        if any(not math.isfinite(t) or t<0 or t>1440 for t in clock):errors.append(f'Route {route_index}: timestamp outside modeled 24 hours')
        if any(b<a for a,b in zip(clock,clock[1:])):errors.append(f'Route {route_index}: timestamps decrease')
        for edge,((a,b),(ta,tb)) in enumerate(zip(zip(route,route[1:]),zip(clock,clock[1:]))):
            if b==1 and 0<=tb<=1440:all_terminal_arrivals[min(11,int(tb//120))]+=1
            if (a==1)==(b==1):continue
            distance=matrix[a-1][b-1]
            service=params['t1']/2+params['t3']/2+(params['t2'] if b==1 else 0)
            delta=tb-ta
            options=[]
            for state,speed in [('loaded',params['v_load']),('empty',params['v_empty'])]:
                wait=delta-distance*60/speed-service
                if wait>=-1e-6 and abs(wait/120-round(wait/120))<1e-6:options.append(state)
            if len(options)!=1:
                ambiguous.append({'route':route_index,'edge':edge,'from':a,'to':b,'deltaMinutes':delta,'candidateStates':options});continue
            if options[0]=='loaded':
                yard=(a if b==1 else b)-2;direction=0 if b==1 else 1
                demand_counts[direction][yard]+=1;inferred_loaded.append({'route':route_index,'edge':edge,'direction':direction,'yard':yard+2,'arrivalMinute':tb})
                if b==1 and 0<=tb<=1440:
                    loaded_arrivals[min(11,int(tb//120))]+=1
                    low,high=windows[yard]
                    if not low-params['e_time']-1e-6<=tb<=high+params['l_time']+1e-6:window_errors.append({'route':route_index,'edge':edge,'yard':yard+2,'arrival':tb,'allowed':[low-params['e_time'],high+params['l_time']]})
    if ambiguous:unverified.append('Some arc load states cannot be uniquely inferred from returned routes and timestamps.')
    unverified.append('Returned routes do not label loaded versus empty moves; travel-time classification below is diagnostic only and cannot certify directional task completion or time windows.')
    reported_slots=best.get('time_list',[])
    reported_slots=reported_slots[1] if len(reported_slots)>1 else []
    capacity_violations=[{'slot':i+1,'reportedArrivals':reported_slots[i],'capacity':cap} for i,cap in enumerate(params['slot_limit'][1]) if len(reported_slots)==12 and reported_slots[i]>cap]
    if capacity_violations:errors.append('At least one terminal appointment slot exceeds its stated maximum.')
    if len(reported_slots)!=12:errors.append('Returned terminal slot vector does not have twelve entries.')
    if len(reported_slots)==12 and abs(sum(reported_slots)-sum(expected[0]))>1e-6:errors.append('Reported terminal delivery count does not equal the 296 source delivery tasks.')
    unverified.append('Reported cost has not been independently reconstructed across all original empty-reposition, waiting, penalty and fixed-vehicle branches.')
    return {'status':'reported_cost_unverified','constraintsStatus':'violations_detected' if errors else 'checked_subset_passed',
        'errors':errors,'limitations':unverified,'expectedDirectionalTasks':expected,'expectedTaskTotal':sum(map(sum,expected)),
        'directionalTaskCompletionStatus':'unverified_from_unlabeled_routes','timeWindowComplianceStatus':'unverified_from_unlabeled_routes',
        'inferredDirectionalTasks':demand_counts,'inferredLoadedTaskTotal':sum(map(sum,demand_counts)),
        'reportedSlotArrivals':reported_slots,'inferredLoadedSlotArrivals':loaded_arrivals,'allTerminalArrivals':all_terminal_arrivals,
        'reportedTerminalDeliveryTotal':sum(reported_slots),'capacityViolations':capacity_violations,'tentativeWindowDiagnostics':window_errors,'ambiguousEdges':ambiguous,
        'routeCount':len(routes),'scope':'Internal independent reconstruction; load states inferred from travel-time residue allowing 120-minute wait increments. Not a full independent cost certificate.'}

def child(variant,seed,ants,iterations,alias_distance=False):
    import numpy as np
    started=time.perf_counter();globals_,defaults,inputs,source=load_original();params=parameters(defaults,variant)
    globals_.update(params);random.seed(seed);np.random.seed(seed)
    record={'variant':variant,'seed':seed,'ants':ants,'iterations':iterations,'distance2Alias':alias_distance,'parameters':params,'source':source,
        'environment':{'python':sys.version,'numpy':np.__version__,'platform':platform.platform(),'machine':platform.machine()},
        'status':'running','reportedCost':None,'audit':None}
    with tempfile.TemporaryDirectory(prefix='portplan-plos-v3-') as temp:
        for name,content in inputs.items():(Path(temp)/name).write_bytes(content)
        if alias_distance:(Path(temp)/'distance2').write_bytes(inputs['distance'])
        previous=os.getcwd();os.chdir(temp)
        stdout=io.StringIO()
        try:
            args=[ants,iterations]+[params[key] for key in ['evaporation_rate','Q','docks','yards','customer','t1','t2','t3','v_load','v_empty','e','e_time','l','l_time','C_load','C_empty','C_idle','slot_limit']]
            with contextlib.redirect_stdout(stdout):result=globals_['solve_vrptw'](*args)
            best,history,average,global_best,load_rates=jsonable(result)
            record.update(status='completed_reported_cost_unverified',reportedCost=best['total_cost'],best=best,bestCostByIteration=history,
                reportedAverage=average,reportedGlobalBest=global_best,reportedLoadRates=load_rates,audit=independent_audit(best,params,inputs))
        except BaseException as error:
            record.update(status='implementation_error',errorType=type(error).__name__,error=str(error),traceback=traceback.format_exc())
        finally:
            os.chdir(previous)
    record['capturedStdout']=stdout.getvalue()[:8000];record['wallSeconds']=time.perf_counter()-started
    return record

def run_bounded(variant,seed,ants,iterations,timeout,alias_distance=False):
    command=[sys.executable,str(Path(__file__).resolve()),'--child','--variant',variant,'--seed',str(seed),'--ants',str(ants),'--iterations',str(iterations)]
    if alias_distance:command.append('--alias-distance2')
    started=time.perf_counter()
    try:
        completed=subprocess.run(command,capture_output=True,text=True,timeout=timeout,check=False)
        if completed.returncode!=0:return {'variant':variant,'seed':seed,'ants':ants,'iterations':iterations,'status':'process_error','returnCode':completed.returncode,'stderr':completed.stderr[-8000:],'wallSeconds':time.perf_counter()-started}
        record=json.loads(completed.stdout);record['processWallSeconds']=time.perf_counter()-started;record['stderr']=completed.stderr[-8000:]
        return record
    except subprocess.TimeoutExpired:
        return {'variant':variant,'seed':seed,'ants':ants,'iterations':iterations,'status':'timeout','reportedCost':None,'wallSeconds':time.perf_counter()-started,'timeoutSeconds':timeout,'distance2Alias':alias_distance}

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--child',action='store_true');parser.add_argument('--probe',action='store_true');parser.add_argument('--variant',choices=['code','paper'],default='code');parser.add_argument('--seed',type=int,default=31001);parser.add_argument('--ants',type=int,default=1);parser.add_argument('--iterations',type=int,default=1);parser.add_argument('--timeout',type=int,default=30);parser.add_argument('--alias-distance2',action='store_true');args=parser.parse_args()
    if args.child:print(json.dumps(jsonable(child(args.variant,args.seed,args.ants,args.iterations,args.alias_distance2)),ensure_ascii=False,allow_nan=False));return
    if args.probe:print(json.dumps(run_bounded(args.variant,args.seed,args.ants,args.iterations,args.timeout,args.alias_distance2),ensure_ascii=False,indent=2,allow_nan=False));return
    if not PROTOCOL.exists():raise SystemExit('Freeze data/public-reproduction-protocol-v3.json before the matrix run.')
    protocol_bytes=PROTOCOL.read_bytes();protocol=json.loads(protocol_bytes)
    import numpy as np
    output={'version':'v3','protocolSHA256':digest(protocol_bytes),'protocol':protocol,'scriptSHA256':digest(Path(__file__).read_bytes()),
        'environment':{'python':sys.version,'numpy':np.__version__,'platform':platform.platform(),'machine':platform.machine()},'executionState':'running','runs':[]}
    for entry in protocol['runs']:
        record=run_bounded(entry['variant'],entry['seed'],protocol['budget']['ants'],protocol['budget']['iterations'],protocol['budget']['timeoutSeconds'],entry.get('distance2Alias',False))
        record['track']=entry['track'];record['id']=f"{entry['track']}-{entry['variant']}-{entry['seed']}"
        output['runs'].append(record);OUTPUT.write_text(json.dumps(jsonable(output),ensure_ascii=False,indent=2,allow_nan=False)+'\n')
        print(f"{len(output['runs'])}/{len(protocol['runs'])} {entry['variant']} seed{entry['seed']}: {record['status']}",flush=True)
    output['executionState']='complete';output['summary']={'runCount':len(output['runs']),'completedCount':sum(r['status']=='completed_reported_cost_unverified' for r in output['runs']),'errorCount':sum(r['status'] in ['implementation_error','process_error'] for r in output['runs']),'timeoutCount':sum(r['status']=='timeout' for r in output['runs']),
        'independentlyCostVerifiedCount':0,'fullBenchmarkReproduction':False,'comparedWithPortPlan':False,
        'byTrack':{track:{'runCount':sum(r['track']==track for r in output['runs']),
                         'completedCount':sum(r['track']==track and r['status']=='completed_reported_cost_unverified' for r in output['runs']),
                         'errorCount':sum(r['track']==track and r['status'] in ['implementation_error','process_error'] for r in output['runs']),
                         'timeoutCount':sum(r['track']==track and r['status']=='timeout' for r in output['runs']),
                         'checkedOutputWithIssuesCount':sum(r['track']==track and bool(r.get('audit',{}).get('errors')) for r in output['runs'] if r.get('audit'))}
                   for track in ['original-files','explicit-distance-alias-hypothesis']}}
    OUTPUT.write_text(json.dumps(jsonable(output),ensure_ascii=False,indent=2,allow_nan=False)+'\n')

if __name__=='__main__':main()
