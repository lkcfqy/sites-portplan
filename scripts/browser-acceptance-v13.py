#!/usr/bin/env python3
"""Actual Chromium QA of the V12 UI and V8/V9 browser simulation/resource UI.

The filename avoids an existing runner; this is NOT a V13 native-method test.
Uses the already installed Python Playwright and /usr/bin/chromium, localhost
only, no installation and no native HiGHS benchmark. Every output directory is
new; failures are retained and independent cases continue without silent rerun.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
import traceback
from urllib.parse import urlsplit
import zipfile

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
NAV = ['planner','research-v12','research-v9','resource-v9','execution-v8','research-v8','rates','experiments','sources','public-validation','research-v7']
MONEY = ['procurementCostKRW','storageCost','ddCost','sunkCost','incrementalCost','totalCost','combinedIncrementalCostKRW','combinedTotalCostKRW','objectiveCostKRW']
TINY = {'id':'browser-qa-synthetic','name':'Browser QA synthetic','seed':42,'horizonStart':'2026-10-12','horizonDays':4,'truckCapacity':2,'warehouseCapacity':1,'stagingCapacity':1,'containers':[{'id':'QA-001','sizeFt':20,'dischargeDateTime':'2026-10-12T07:00:00+09:00','releaseDay':0,'unloadDays':1,'dueDay':2,'dataOrigin':'synthetic'}]}


def sha(data): return hashlib.sha256(data).hexdigest()
def require(value, message):
    if not value: raise AssertionError(message)


class QA:
    def __init__(self, args):
        self.args=args;self.output=args.output.resolve();self.output.mkdir(parents=True,exist_ok=False)
        self.results=[];self.events=(self.output/'events.jsonl').open('x',encoding='utf8');self.fault=None;self.case=None;self.download_index=0
        self.started=datetime.now(timezone.utc).isoformat();self.commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
        harness=Path(__file__).read_bytes();self.harness_sha=sha(harness);(self.output/'harness-source.py').write_bytes(harness)
        files=[]
        for path in sorted((ROOT/'dist').rglob('*')):
            if path.is_file(): files.append({'path':str(path.relative_to(ROOT/'dist')),'bytes':path.stat().st_size,'sha256':sha(path.read_bytes())})
        self.static={'files':files,'inventorySha256':sha(json.dumps(files,sort_keys=True).encode())}
        (self.output/'static-inputs.json').write_text(json.dumps(self.static,indent=2)+'\n')

    def log(self,kind,**values):
        entry={'timeUTC':datetime.now(timezone.utc).isoformat(),'case':self.case['id'] if self.case else None,'kind':kind,**values}
        self.events.write(json.dumps(entry,ensure_ascii=False)+'\n');self.events.flush()

    def route(self, route):
        parsed=urlsplit(route.request.url)
        if parsed.scheme in ('data','blob'): return route.continue_()
        if parsed.hostname not in ('127.0.0.1','localhost') or parsed.port!=self.args.port:
            self.log('external_request_blocked',url=route.request.url);return route.abort()
        if self.fault and self.fault['worker'] in parsed.path and parsed.path.endswith('.js'):
            mode=self.fault['mode'];self.log('controlled_worker_fault',mode=mode,path=parsed.path)
            source='self.onmessage=e=>{};' if mode=='hang' else 'self.onmessage=e=>setTimeout(()=>self.postMessage({id:e.data.id,error:"CONTROLLED_LATE_MESSAGE"}),750);'
            return route.fulfill(status=200,content_type='application/javascript',body=source)
        route.continue_()

    def screenshot(self,page,suffix='screen'):
        path=self.case_dir/(suffix+'.png');page.screenshot(path=str(path),full_page=False)
        self.case.setdefault('screenshots',[]).append(str(path.relative_to(self.output)));return path

    def nav(self,page,key):
        page.locator(f'.nav-button[data-tab="{key}"]').click()
        expect(page.locator('#panel-'+key)).to_be_visible()

    def btn(self,page,panel,text): return page.locator('#panel-'+panel).get_by_role('button',name=text,exact=True)

    def export(self,page,button,label):
        with page.expect_download(timeout=10000) as pending: button.click()
        download=pending.value;self.download_index+=1
        path=self.case_dir/(f'{self.download_index:02d}-'+download.suggested_filename);download.save_as(str(path))
        data=path.read_bytes();record={'label':label,'file':str(path.relative_to(self.output)),'bytes':len(data),'sha256':sha(data)}
        self.case.setdefault('downloads',[]).append(record);self.log('download',**record)
        return json.loads(data) if download.suggested_filename.endswith('.json') else data

    def run_case(self,name,row,fn,width=1440,height=1000):
        if self.args.only and not re.search(self.args.only,name):return
        index=len(self.results)+1;self.case={'id':f'{index:02d}-{name}','checklistRow':row,'viewport':{'width':width,'height':height},'steps':[]}
        self.case_dir=self.output/self.case['id'];self.case_dir.mkdir();self.fault=None
        page=self.context.new_page()
        page.set_viewport_size({'width':width,'height':height});page.set_default_timeout(4500)
        errors=[];page.on('pageerror',lambda error:(errors.append(str(error)),self.log('pageerror',message=str(error))))
        page.on('console',lambda message:self.log('console',level=message.type,text=message.text))
        page.on('requestfailed',lambda request:self.log('requestfailed',url=request.url,failure=request.failure))
        started=time.monotonic()
        try:
            page.goto(self.args.base+'/#research-v12',wait_until='domcontentloaded',timeout=20000)
            expect(page.locator('.nav-button')).to_have_count(11)
            fn(page)
            require(not errors,'Uncaught page errors: '+json.dumps(errors))
            self.case['status']='passed'
        except AssertionError as error:
            self.case.update(status='product_assertion_failed',error=str(error));self.log('product_failure',message=str(error))
        except Exception as error:
            self.case.update(status='harness_or_unresolved_interaction_failure',error=str(error),traceback=traceback.format_exc());self.log('harness_failure',message=str(error))
        finally:
            self.case['elapsedSeconds']=time.monotonic()-started
            try:self.screenshot(page)
            except Exception as error:self.case['screenshotError']=str(error)
            self.case['actualURL']=page.url;self.case['pageErrors']=errors
            (self.case_dir/'result.json').write_text(json.dumps(self.case,ensure_ascii=False,indent=2)+'\n')
            self.results.append(self.case);print(json.dumps({'case':self.case['id'],'status':self.case['status'],'error':self.case.get('error'),'elapsed':round(self.case['elapsedSeconds'],2)},ensure_ascii=False),flush=True)
            self.fault=None;page.close();self.case=None

    def step(self,text):self.case['steps'].append(text);self.log('step',description=text)

    def layout(self,page):
        value=page.evaluate('''()=>({width:innerWidth,body:document.body.scrollWidth,html:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1&&getComputedStyle(e).position!=='fixed'}).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,right:e.getBoundingClientRect().right})),scrollableTables:[...document.querySelectorAll('table')].filter(t=>{let p=t.parentElement;return p&&p.scrollWidth>p.clientWidth}).length})''')
        self.case.setdefault('layout',[]).append(value)
        require(value['body']<=value['width']+1 and value['html']<=value['width']+1,'Page body horizontally overflows: '+json.dumps(value,ensure_ascii=False))

    def wait_idle(self,page,panel): expect(self.btn(page,panel,'运行滚动模拟' if panel=='execution-v8' else '计算补救建议')).to_be_enabled(timeout=15000)

    def execution(self,page,kind='success'):
        self.nav(page,'execution-v8');self.btn(page,'execution-v8','10 箱成功演示' if kind=='success' else '10 箱中断演示').click()
        self.btn(page,'execution-v8','运行滚动模拟').click();self.wait_idle(page,'execution-v8')
        return self.export(page,self.btn(page,'execution-v8','导出模拟结果'),'execution-'+kind)

    def resource(self,page,kind='rescue',mode='procurementOnly'):
        self.nav(page,'resource-v9');self.btn(page,'resource-v9','教学：可补救' if kind=='rescue' else '教学：菜单内无解').click()
        page.locator('#panel-resource-v9 select').select_option(mode)
        self.btn(page,'resource-v9','计算补救建议').click();self.wait_idle(page,'resource-v9')
        return self.export(page,self.btn(page,'resource-v9','导出本次结果'),'resource-'+kind+'-'+mode)

    def tab_to(self,page,selector):
        for _ in range(160):
            page.keyboard.press('Tab')
            if page.evaluate('(s)=>document.activeElement?.matches(s)',selector):
                observed=page.evaluate('''()=>({tag:document.activeElement.tagName,name:document.activeElement.getAttribute('aria-label')||document.activeElement.textContent,focusVisible:document.activeElement.matches(':focus-visible'),outline:getComputedStyle(document.activeElement).outlineStyle,outlineWidth:getComputedStyle(document.activeElement).outlineWidth,boxShadow:getComputedStyle(document.activeElement).boxShadow})''')
                self.case.setdefault('keyboardFocus',[]).append(observed)
                require(observed['focusVisible'] and (observed['outline']!='none' and observed['outlineWidth']!='0px' or observed['boxShadow']!='none'),'Keyboard focus not visibly outlined: '+json.dumps(observed))
                return
        raise AssertionError('Cannot reach an enabled visible control with Tab: '+selector)

    def execute(self):
        with sync_playwright() as playwright:
            browser=playwright.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox','--disable-dev-shm-usage'])
            self.browser_version=browser.version;self.context=browser.new_context(accept_downloads=True,locale='zh-CN',timezone_id='Asia/Seoul')
            self.context.route('**/*',self.route)
            self.context.add_init_script('''(()=>{const Original=window.Worker;window.__qaWorkers=[];window.Worker=class extends Original{constructor(...args){super(...args);this.__qa={url:String(args[0]),createdAt:performance.now(),terminated:false};window.__qaWorkers.push(this.__qa);}terminate(){this.__qa.terminated=true;this.__qa.terminatedAt=performance.now();return super.terminate();}}})()''')
            self.cases()
            self.context.close();browser.close()
        grouped={str(row):[case['status'] for case in self.results if case['checklistRow']==row] for row in range(1,11)}
        complete=bool(self.results) and all(case['status']=='passed' for case in self.results)
        record={'schemaVersion':'portplan-real-chromium-ui-acceptance-v12-first','valid':complete,'fullChecklistRowsCovered':all(bool(v) for v in grouped.values()),'selectionRegex':self.args.only,'harnessSha256':self.harness_sha,'startedAtUTC':self.started,'completedAtUTC':datetime.now(timezone.utc).isoformat(),'browser':{'executable':'/usr/bin/chromium','version':self.browser_version,'engine':'Chromium','automation':'existing Python Playwright, real browser; no fake DOM'},'sourceCommit':self.commit,'staticInventorySha256':self.static['inventorySha256'],'testedScope':'V12 research presentation plus workbench and V8/V9 browser execution/resource simulations; NOT a V13 native-method experiment','base':self.args.base,'checklistRef':'docs/browser-acceptance-v10.zh.md','checklistRows':grouped,'cases':self.results,'productAssertionFailures':sum(c['status']=='product_assertion_failed' for c in self.results),'harnessOrUnresolvedFailures':sum(c['status']=='harness_or_unresolved_interaction_failure' for c in self.results),'controlledFaultScope':'Only localhost Worker HTTP response substitution with inert or scheduled-late-error scripts; not a natural solver timeout or formal research result.','workerInstrumentation':'Records only real Worker creation/termination; does not provide solver candidates or change parent clocks.','nativeSolverRuns':0,'entrantUnderstandingCertified':False,'realBusinessRecordsRequired':False,'externalSitesVisited':False}
        (self.output/'summary.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n');self.events.close()
        print(json.dumps({'valid':complete,'cases':len(self.results),'productFailures':record['productAssertionFailures'],'harnessFailures':record['harnessOrUnresolvedFailures'],'summary':str(self.output/'summary.json')}),flush=True)
        return 0 if complete else 1

    def cases(self):
        for width in (1440,390):
            for key in NAV:
                def navigation(page,key=key):
                    self.step('Click actual navigation '+key+'; check unique visible panel, active state, title, no page horizontal overflow')
                    self.nav(page,key);expect(page.locator('.nav-button[aria-current="page"]')).to_have_count(1)
                    require(page.locator('.tab-panel:visible').count()==1,'More than one visible page')
                    expect(page.locator('#panel-'+key+' h1').first).to_be_visible();page.wait_for_timeout(150);self.layout(page)
                self.run_case('navigation-'+key+'-'+str(width),1 if width==1440 else 2,navigation,width)
        for panel in ('execution-v8','resource-v9'):
            for width in (1440,390):
                def language(page,panel=panel):
                    self.step('Switch actual supported content zh→ko→zh; check editor labels, title and narrow layout')
                    self.nav(page,panel);self.btn(page,panel,'한국어').click();expect(page.locator('#panel-'+panel)).to_have_attribute('lang','ko')
                    expect(page.locator('#panel-'+panel+' textarea').first).to_have_attribute('aria-label',re.compile('[가-힣]'))
                    self.layout(page);self.screenshot(page,'korean');self.btn(page,panel,'中文').click();expect(page.locator('#panel-'+panel)).to_have_attribute('lang','zh-CN')
                self.run_case('language-'+panel+'-'+str(width),2,language,width)
        for panel,worker in (('execution-v8','execution-v8.worker'),('resource-v9','resource-recovery-v9.worker')):
            def keyboard(page,panel=panel,worker=worker):
                self.step('Use Tab to JSON editor, select, primary run, enabled stop; actual keyboard activation with controlled inert Worker')
                self.nav(page,panel)
                if panel=='resource-v9':self.btn(page,panel,'教学：可补救').click()
                self.tab_to(page,'#panel-'+panel+' textarea');page.keyboard.press('End');page.keyboard.type(' ')
                self.tab_to(page,'#panel-'+panel+' select')
                self.tab_to(page,'#panel-'+panel+' button.primary');self.fault={'worker':worker,'mode':'hang'};page.keyboard.press('Enter')
                self.tab_to(page,'#panel-'+panel+' button:not(:disabled):not(.primary)')
                # Stop is the only enabled control button while busy, apart from language.
                stop=self.btn(page,panel,'停止');self.tab_to(page,'#panel-'+panel+' button:not(:disabled)') if False else None
                for _ in range(160):
                    if page.evaluate('(e)=>document.activeElement===e',stop.element_handle()):break
                    page.keyboard.press('Tab')
                require(page.evaluate('(e)=>document.activeElement===e',stop.element_handle()),'Keyboard cannot reach Stop')
                page.keyboard.press('Space');require('已停止' in page.locator('#panel-'+panel).inner_text(),'Keyboard stop did not cancel')
            self.run_case('keyboard-'+panel,3,keyboard)

        def import_workbench(page):
            self.step('Import tiny synthetic JSON, run workbench, export CSV and full scenario; no real business input')
            page.locator('#file-input').set_input_files({'name':'qa-valid.json','mimeType':'application/json','buffer':json.dumps(TINY).encode()})
            expect(page.locator('#run-notice')).to_contain_text('导入成功');page.locator('#run').click();expect(page.locator('#run')).to_be_enabled(timeout=20000)
            require(page.locator('#schedule-content table').count()>0,'Valid JSON workbench produced no schedule')
            self.export(page,page.locator('#export-plan'),'workbench-schedule')
            self.nav(page,'sources');exported=self.export(page,page.locator('#download-scenario'),'workbench-input')
            require(exported['metadata']['timeZone']=='Asia/Seoul' and all(c['dataOrigin']=='uploaded' for c in exported['scenario']['containers']),'Workbench input provenance/timezone export mismatch')
            csv='id,sizeFt,dischargeDateTime,releaseDay,unloadDays,dueDay\nQA-CSV-001,20,2026-10-12T07:00:00+09:00,0,1,2\n'
            page.locator('#file-input').set_input_files({'name':'qa-valid.csv','mimeType':'text/csv','buffer':csv.encode()});expect(page.locator('#run-notice')).to_contain_text('导入成功')
            page.locator('#run').click();expect(page.locator('#run')).to_be_enabled(timeout=20000);require(page.locator('#schedule-content').inner_text().find('QA-CSV-001')>=0,'Valid CSV not used in schedule')
            page.locator('#setting-trucks').fill('3') if page.locator('#setting-trucks').count() else page.locator('#orders-editor summary').click()
        self.run_case('workbench-valid-json-csv-export',5,import_workbench)

        for kind in ('duplicate-id','missing-timezone'):
            def invalid_import(page,kind=kind):
                self.step('Import deliberately invalid synthetic JSON: '+kind)
                value=json.loads(json.dumps(TINY))
                if kind=='duplicate-id':value['containers'].append(dict(value['containers'][0]))
                else:value['containers'][0]['dischargeDateTime']='2026-10-12T07:00:00'
                page.locator('#file-input').set_input_files({'name':kind+'.json','mimeType':'application/json','buffer':json.dumps(value).encode()})
                expect(page.locator('#run-notice')).to_contain_text('导入失败');text=page.locator('#run-notice').inner_text()
                require(('unique' in text) if kind=='duplicate-id' else ('offset' in text),'Invalid import not rejected with specific reason')
            self.run_case('workbench-invalid-'+kind,5,invalid_import)

        def execution_success(page):
            self.step('Run both real browser strategies on ten-container success fixture; verify exported complete actions, fees, terminal audits')
            result=self.execution(page)
            require(result['executionStatus']=='finished' and all(r['complete'] and r['parentTerminalAudit']['valid'] for r in result['results'].values()),'Success fixture failed complete parent audit')
            require(all(len(r['rows'])==10 and len(r['executedEvents'])==30 for r in result['results'].values()),'Success execution ledger incomplete')
            inp=self.export(page,self.btn(page,'execution-v8','导出本次输入'),'execution-input');require(inp['parentHardWallMs']==5000 and len(inp['scenario']['containers'])==10,'Execution input export mismatch')
            page.locator('#panel-execution-v8 details').first.evaluate('(e)=>e.open=true');editor=page.locator('#panel-execution-v8 textarea').first;editor.fill(editor.input_value()+' ')
            expect(page.locator('[data-stale-notice]')).to_be_visible()
        self.run_case('execution-success-export-stale',4,execution_success)

        def execution_failure(page):
            self.step('Run announced warehouse-closure teaching fixture; failed full-path amounts remain null')
            result=self.execution(page,'failure');require(all(not r['complete'] and r['totalCost'] is None and r['incrementalCost'] is None for r in result['results'].values()),'Interrupted fixture incorrectly reports completion/zero money')
        self.run_case('execution-failure-teaching',4,execution_failure)

        for mode in ('procurementOnly','feesPlusProcurement'):
            def rescue(page,mode=mode):
                self.step('Check default real menu empty, load synthetic rescue, solve '+mode+', export original inputs/result and exclusion facts')
                self.nav(page,'resource-v9');require(page.locator('#panel-resource-v9 textarea').nth(1).input_value()=='[]','Real resource menu is not empty by default')
                result=self.resource(page,mode=mode);r=result['result'];require(r['status'] in ('optimal','feasible') and r['parentTerminalAudit']['valid'],'Rescue lacks a complete parent-audited result')
                require(r['purchaseExecuted'] is False and r['counterfactual'] is True and r['procurementCostKRW']==30000,'Synthetic resource price/provenance mismatch')
                require(r['combinedIncrementalCostKRW']==r['procurementCostKRW']+r['incrementalCost'] and r['combinedTotalCostKRW']==r['procurementCostKRW']+r['totalCost'],'Resource combined fees do not add up')
                reasons={reason for action in r['excludedActions'] for reason in action['reasons']};require({'not_authorized','would_change_past_capacity','before_earliest_availability'}<=reasons,'Excluded permission/date facts missing')
                inp=self.export(page,self.btn(page,'resource-v9','导出当前输入'),'resource-input');require(inp['objectiveMode']==mode and inp['parentHardWallMs']==5000,'Resource exported mode/budget mismatch')
                editor=page.locator('#panel-resource-v9 textarea').nth(1);editor.fill(editor.input_value()+' ');expect(page.locator('[data-recovery-stale]')).to_be_visible()
                stale=self.export(page,self.btn(page,'resource-v9','导出本次结果'),'resource-stale-result');require(stale['currentInputMatchesRun'] is False,'Edited resource result not explicitly stale')
            self.run_case('resource-rescue-'+mode,7,rescue)

        for kind in ('impossible','empty','invalid-action'):
            def no_resource(page,kind=kind):
                self.step('Exercise explicit resource '+kind+' without adding real/menu resources')
                self.nav(page,'resource-v9');self.btn(page,'resource-v9','教学：菜单内无解' if kind=='impossible' else '教学：可补救').click()
                editor=page.locator('#panel-resource-v9 textarea').nth(1)
                if kind=='empty':editor.fill('[]')
                if kind=='invalid-action':
                    actions=json.loads(editor.input_value());del actions[0]['authorized'];editor.fill(json.dumps(actions));self.btn(page,'resource-v9','检查输入').click();require('authorized' in page.locator('#panel-resource-v9 [role="status"]').inner_text(),'Incomplete action authorization not rejected');return
                self.btn(page,'resource-v9','计算补救建议').click();self.wait_idle(page,'resource-v9');result=self.export(page,self.btn(page,'resource-v9','导出本次结果'),'resource-'+kind)['result']
                require(result['status']=='infeasible' and result['rows']==[] and all(result.get(key) is None for key in MONEY),'Impossible/empty menu manufactured accepted plan or complete amounts')
            self.run_case('resource-'+kind,8,no_resource)

        for panel,worker in (('execution-v8','execution-v8.worker'),('resource-v9','resource-recovery-v9.worker')):
            for action in ('hard-timeout','stop-rerun','navigation-cancel'):
                def controlled(page,panel=panel,worker=worker,action=action):
                    self.step('Controlled HTTP Worker fault injection: '+action+'; this is not natural solver timing or a formal experiment')
                    self.nav(page,panel)
                    self.btn(page,panel,'10 箱成功演示' if panel=='execution-v8' else '教学：可补救').click()
                    if panel=='execution-v8':page.locator('#panel-execution-v8 select').nth(1).select_option('')
                    self.fault={'worker':worker,'mode':'hang' if action=='hard-timeout' else 'late-error'}
                    self.btn(page,panel,'运行滚动模拟' if panel=='execution-v8' else '计算补救建议').click()
                    if action=='hard-timeout':self.wait_idle(page,panel)
                    elif action=='stop-rerun':self.btn(page,panel,'停止').click();page.wait_for_timeout(900)
                    else:self.nav(page,'research-v12');page.wait_for_timeout(900);self.nav(page,panel)
                    require('CONTROLLED_LATE_MESSAGE' not in page.locator('#panel-'+panel).inner_text(),'Late worker reply overwrote cancelled UI')
                    exported=self.export(page,self.btn(page,panel,'导出模拟结果' if panel=='execution-v8' else '导出本次结果'),'controlled-'+action)
                    values=list(exported['results'].values()) if panel=='execution-v8' else [exported['result']]
                    for r in values:
                        require(r['totalCost'] is None and r['incrementalCost'] is None,'Unknown/cancelled complete money is not null')
                        require(r['status']==('hard_time_limit' if action=='hard-timeout' else 'cancelled'),'Wrong controlled terminal status')
                        if action=='hard-timeout':require(4900<=r['parentWallMs']<8000,'5s parent deadline not observed')
                    workers=page.evaluate('window.__qaWorkers');self.case['realWorkerObservations']=workers;require(workers and all(w['terminated'] for w in workers),'Parent did not terminate actual Worker')
                    if action=='stop-rerun':
                        self.fault=None;self.btn(page,panel,'运行滚动模拟' if panel=='execution-v8' else '计算补救建议').click();self.wait_idle(page,panel)
                        again=self.export(page,self.btn(page,panel,'导出模拟结果' if panel=='execution-v8' else '导出本次结果'),'normal-rerun')
                        require(all(v['complete'] for v in again['results'].values()) if panel=='execution-v8' else again['result']['status'] in ('optimal','feasible'),'Normal rerun after Stop failed')
                self.run_case('controlled-'+panel+'-'+action,9 if action=='hard-timeout' else 6,controlled)

        def material_downloads(page):
            self.step('Use actual rendered V12 links to download Korean PDF, editable PPT and source ZIP; compare exact local dist bytes/SHA')
            self.nav(page,'research-v12');expect(page.locator('#panel-research-v12 a[href="/downloads/portplan-source.zip"]')).to_be_visible(timeout=10000)
            manifest=json.loads((ROOT/'dist/data/download-packages-v12.json').read_text())
            for path in ('/downloads/defense-v12.ko.pdf','/downloads/defense-v12.ko.pptx','/downloads/report-v12.zh.md','/downloads/portplan-source.zip'):
                body=self.export(page,page.locator('#panel-research-v12 a[href="'+path+'"]').first,path)
                require(body==(ROOT/'dist'/path.lstrip('/')).read_bytes(),'Browser download bytes differ: '+path)
                if path.endswith('.pdf'):
                    import fitz
                    require(len(fitz.open(stream=body,filetype='pdf'))==18,'Downloaded PDF page count differs')
                if path.endswith('.pptx'):
                    from io import BytesIO
                    with zipfile.ZipFile(BytesIO(body)) as z:require(len([n for n in z.namelist() if re.fullmatch(r'ppt/slides/slide\d+\.xml',n)])==18,'Downloaded editable PPT page count differs')
                if path.endswith('source.zip'):
                    package=next(p for p in manifest['packages'] if p['id']=='source');require(sha(body)==package['sha256'],'Browser sourceZIP SHA differs from complete package manifest')
        self.run_case('browser-material-downloads',10,material_downloads)

        for panel in ('execution-v8','resource-v9'):
            def result_narrow(page,panel=panel):
                self.step('Run actual teaching success at390px; check Korean result, body containment and real table horizontal scrolling')
                exported=self.execution(page) if panel=='execution-v8' else self.resource(page,mode='feesPlusProcurement')
                self.btn(page,panel,'한국어').click();self.layout(page)
                selector='#panel-'+panel+' .'+('execution-v8-table-wrap' if panel=='execution-v8' else 'resource-recovery-v9-table-wrap')
                table=page.locator(selector).first;table.scroll_into_view_if_needed()
                value=table.evaluate('''e=>{e.scrollLeft=e.scrollWidth;return {clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,scrollLeft:e.scrollLeft,overflowX:getComputedStyle(e).overflowX}}''')
                self.case['resultTableScroll']=value
                require(value['scrollWidth']>value['clientWidth'] and value['scrollLeft']>0 and value['overflowX'] in ('auto','scroll'),'Result table cannot scroll within narrow container')
                if panel=='resource-v9':
                    r=exported['result'];require(r['totalCost']-r['incrementalCost']==r['sunkCost'],'Resource sunk fee is not separated')
                    require(r['proof']['minimumObjectiveProven'] is True and '최소' in page.locator('#panel-resource-v9').inner_text(),'Combined minimum proof and Korean label disagree')
            self.run_case('supplement-result-table-'+panel+'-390',2,result_narrow,390)

        def workbench_stale(page):
            self.step('Run tiny imported workbench; change actual truck setting; old schedule/export invalidated')
            page.locator('#file-input').set_input_files({'name':'qa-stale.json','mimeType':'application/json','buffer':json.dumps(TINY).encode()})
            expect(page.locator('#run-notice')).to_contain_text('导入成功');page.locator('#run').click();expect(page.locator('#run')).to_be_enabled(timeout=20000)
            expect(page.locator('#export-plan')).to_be_enabled();page.locator('#setting-truck').fill('3');page.locator('#setting-truck').press('Tab')
            expect(page.locator('#run-notice')).to_contain_text('输入已修改');expect(page.locator('#export-plan')).to_be_disabled()
            require(page.locator('#schedule-content table').count()==0,'Old workbench schedule remains accepted after input change')
        self.run_case('supplement-workbench-stale',6,workbench_stale)

        def invalid_offset(page):
            self.step('CSV import with explicit but impossible +15:00 UTC offset must fail')
            text='id,sizeFt,dischargeDateTime,releaseDay,unloadDays,dueDay\nQA-OFFSET,20,2026-10-12T07:00:00+15:00,0,1,2\n'
            page.locator('#file-input').set_input_files({'name':'qa-invalid-offset.csv','mimeType':'text/csv','buffer':text.encode()})
            expect(page.locator('#run-notice')).to_contain_text('导入失败');require('UTC offset' in page.locator('#run-notice').inner_text(),'Explicit invalid UTC offset not clearly rejected')
        self.run_case('supplement-explicit-invalid-utc-offset',5,invalid_offset)


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path,required=True);parser.add_argument('--base',default='http://127.0.0.1:4173');parser.add_argument('--only',help='Explicit focused selection; does not replace any earlier run');args=parser.parse_args()
    parsed=urlsplit(args.base);require(parsed.scheme=='http' and parsed.hostname in ('localhost','127.0.0.1') and parsed.port is not None and not parsed.username and not parsed.password,'Only explicit localhost preview is allowed');args.port=parsed.port
    qa=QA(args);raise SystemExit(qa.execute())


if __name__=='__main__':main()
