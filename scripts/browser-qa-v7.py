"""Production V7 browser release checks; no experiment generation or archive writes.

Run only after the release owner has built and started its preview. The sole
local algorithm replay is clearly exported as browser UI validation. The large
rolling archive is never fetched; expected exports come from its audited view.
"""
import asyncio
import base64
import gzip
import hashlib
import io
import json
import math
import os
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from playwright.async_api import async_playwright
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'artifacts/browser-v7'
BASE = os.environ.get('PORTPLAN_QA_BASE', 'http://127.0.0.1:5174').rstrip('/')
INTERACTIONS_ONLY = os.environ.get('PORTPLAN_QA_INTERACTIONS_ONLY') == '1'
METHODS = ['dailyReoptV4', 'stableRetainV5', 'lockedRecoveryV6', 'costPolishV7', 'graspBaselineV7']
RESEARCH_FILES = {
    'rolling-v7-view.json', 'rolling-v7.json', 'protocol-v7.json',
    'public-resource-v7.json', 'protocol-public-v7.json', 'port-ledger-v7.json',
    'rolling-review-v7.json', 'public-resource-review-v7.json', 'port-ledger-review-v7.json',
    'failure-diagnosis-v6.json', 'feasibility-witnesses-v6.json',
    'feasibility-review-v6.json', 'rolling-v6-view.json', 'rolling-v6.json',
    'protocol-v6.json', 'public-orders-audit-v6.json', 'public-sources-v6.json',
    'benchmark-v4.json', 'rolling-v4.json', 'certificate-v4.json',
    'benchmark-v5.json', 'rolling-v5.json', 'certificate-v5.json',
}


def file_sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def load_verified_view(path):
    wrapper_bytes = path.read_bytes()
    wrapper = json.loads(wrapper_bytes)
    assert wrapper['schemaVersion'] == 'portplan-rolling-v7-browser-transport-1'
    assert wrapper['transportCodec'] == 'portplan-v7-gzip-base64-case-id-v1'
    compressed = base64.b64decode(wrapper['payload'], validate=True)
    assert len(compressed) == wrapper['compressedBytes']
    assert hashlib.sha256(compressed).hexdigest() == wrapper['compressedSha256']
    decoded = gzip.decompress(compressed)
    assert 0 < len(decoded) == wrapper['decodedBytes'] <= 128 * 1024 * 1024
    assert hashlib.sha256(decoded).hexdigest() == wrapper['projectionSha256']
    projection = json.loads(decoded)
    assert projection['schemaVersion'] == 'portplan-rolling-v7-ui-projection'
    assert projection['sourceArchiveSha256'] == wrapper['sourceArchiveSha256']
    return projection, {key: wrapper[key] for key in [
        'transportCodec', 'sourceArchiveSha256', 'compressedBytes', 'compressedSha256',
        'decodedBytes', 'projectionSha256']} | {
            'wrapperBytes': len(wrapper_bytes), 'wrapperSha256': hashlib.sha256(wrapper_bytes).hexdigest()}


def assert_recomputed_summary(actual, expected, path='summary'):
    # Python and JavaScript may sum archived millisecond floats in a different
    # order. Counts, IDs, schema and list order remain exact; the tolerance is
    # substantially below any recorded millisecond or currency display unit.
    if isinstance(actual, dict) and isinstance(expected, dict):
        assert actual.keys() == expected.keys(), path
        for key in actual:
            assert_recomputed_summary(actual[key], expected[key], path + '/' + key)
    elif isinstance(actual, list) and isinstance(expected, list):
        assert len(actual) == len(expected), path
        for index, (left, right) in enumerate(zip(actual, expected)):
            assert_recomputed_summary(left, right, path + '/' + str(index))
    elif isinstance(actual, float) or isinstance(expected, float):
        assert isinstance(actual, (int, float)) and isinstance(expected, (int, float)), path
        assert math.isclose(actual, expected, rel_tol=0, abs_tol=1e-8), (path, actual, expected)
    else:
        assert actual == expected, (path, actual, expected)


def decode_case(case, encoded):
    if not encoded:
        return case
    ids = [row['id'] for row in case['nominalScenario']['containers']]

    def decode(value):
        if isinstance(value, list):
            return [decode(item) for item in value]
        if not isinstance(value, dict):
            return value
        if 'containerIndex' in value:
            index = value['containerIndex']
            assert 'id' not in value and isinstance(index, int) and 0 <= index < len(ids)
        return {('id' if key == 'containerIndex' else key):
                (ids[item] if key == 'containerIndex' else decode(item))
                for key, item in value.items()}

    return {**case, 'policies': decode(case['policies'])}


def assert_execution_export(record, expected, method, archived=True):
    assert record['caseId'] == expected['id']
    assert record['method'] == method
    assert record['nominalScenario'] == expected['nominalScenario']
    assert record['events'] == expected['events']
    ids = {row['id'] for row in expected['nominalScenario']['containers']}
    assert ids and all(isinstance(value, str) for value in ids)
    result = record['result']
    references = list(result.get('rows') or []) + list(result.get('executedEvents') or [])
    references += result.get('finalState') or []
    proofs = 0
    for entry in result.get('timeline') or []:
        for key in ['decisions', 'executedEvents', 'revisions', 'state']:
            references += entry.get(key) or []
    for trace in result.get('plannerTrace') or []:
        proof = trace.get('polishMetadata')
        if proof and proof.get('seedAccepted'):
            proofs += 1
            assert isinstance(proof.get('beforeDates'), list)
            assert isinstance(proof.get('afterDates'), list)
            assert {row['id'] for row in proof['beforeDates']} == ids
            assert {row['id'] for row in proof['afterDates']} == ids
            assert len(proof['beforeDates']) == len(proof['afterDates']) == len(ids)
            assert proof['jointNonincrease'] is True
            assert proof['finalIncrementalCost'] <= proof['seedIncrementalCost']
            references += proof['beforeDates'] + proof['afterDates']
    for row in references:
        assert row['id'] in ids, ('unknown or undecoded ID', row)
        assert 'containerIndex' not in row
        for key in ['pickupDay', 'unloadDay', 'returnDay']:
            if key in row:
                assert isinstance(row[key], int) and 0 <= row[key] < expected['nominalScenario']['horizonDays']
    if result.get('complete'):
        assert {row['id'] for row in result['rows']} == ids
        assert len(result['rows']) == len(ids)
    else:
        assert result.get('totalCost') is None and result.get('incrementalCost') is None
    if archived:
        assert record['scope'] == 'Archived complete experiment'
        assert result == expected['policies'][method], (expected['id'], method, 'export differs from decoded view')
    else:
        assert record['scope'].startswith('Local browser replay')
    return {'containers': len(ids), 'references': len(references), 'polishProofs': proofs}


def first_four_bytes(url):
    # The preview may ignore Range; reading four bytes and closing still avoids
    # downloading a complete experiment ZIP simply to inspect its signature.
    with urlopen(Request(url, headers={'Range': 'bytes=0-3'}), timeout=30) as reply:
        return reply.read(4)


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    view_path = ROOT / 'data/rolling-v7-view.json'
    view, transport = load_verified_view(view_path)
    assert view['executionState'] == 'complete'
    encoding = view.get('containerIdEncoding')
    assert encoding in [None, 'case-local-container-index-v1']
    primary = [decode_case(case, encoding) for case in view['cases']]
    development = [decode_case(case, encoding) for case in view['developmentControls']['cases']]
    view['cases'] = primary
    view['developmentControls']['cases'] = development
    assert len(primary) == len(development) == 36
    assert view['sourceArchiveSha256'] == file_sha256(ROOT / 'data/rolling-v7.json')
    rolling_review = json.loads((ROOT / 'data/rolling-review-v7.json').read_text())
    assert rolling_review['valid'] is True
    assert_recomputed_summary(view['summary'], rolling_review['primaryRecomputedSummary'])
    assert_recomputed_summary(view['developmentControls']['summary'], rolling_review['developmentRecomputedSummary'])
    assert [view['summary']['byMethod'][method]['completeCount'] for method in METHODS] == [20, 21, 26, 27, 17]
    assert [view['developmentControls']['summary']['byMethod'][method]['completeCount'] for method in METHODS] == [20, 21, 29, 29, 17]
    resource = json.loads((ROOT / 'data/public-resource-v7.json').read_text())
    ledger = json.loads((ROOT / 'data/port-ledger-v7.json').read_text())
    easy_index = next(index for index, case in enumerate(primary)
                      if case['mechanism'] == 'new-arrivals' and case['count'] == 24
                      and case['policies']['costPolishV7']['complete'])
    results, errors, console_errors, failed_responses, research_requests, forbidden_requests = {}, [], [], [], [], []

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            executable_path=os.environ.get('PORTPLAN_CHROMIUM_PATH', '/usr/bin/chromium'),
            headless=True, args=['--no-sandbox'])
        page = await browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
        page.on('response', lambda response: failed_responses.append({'url': response.url, 'status': response.status})
                if response.status >= 400 else None)

        def record_request(request):
            name = urlparse(request.url).path.split('/')[-1]
            if name in RESEARCH_FILES:
                research_requests.append(request.url)
            if name in {'rolling-v7.json', 'rolling-v6.json'}:
                forbidden_requests.append(request.url)

        page.on('request', record_request)

        async def click(name, scope=None):
            await (scope or page).get_by_role('button', name=name, exact=True).click()

        async def table(scope, title):
            heading = scope.get_by_role('heading', name=title, exact=True)
            await heading.wait_for(timeout=30000)
            return heading.locator('xpath=ancestor::article[1]').locator('table')

        async def export_json(name, filename, scope=None):
            target = OUTPUT / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            async with page.expect_download() as event:
                await click(name, scope)
            download = await event.value
            await download.save_as(str(target))
            return json.loads(target.read_text())

        async def no_overflow(label):
            dimensions = await page.evaluate(
                '({viewport:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth})')
            assert dimensions['html'] <= dimensions['viewport'] + 1, (label, dimensions)
            assert dimensions['body'] <= dimensions['viewport'] + 1, (label, dimensions)
            return dimensions

        async def ready_fees():
            run = page.get_by_role('button', name='本机按冻结配置重跑', exact=True)
            await run.wait_for()
            assert await run.is_enabled()
            assert not await page.get_by_role('button', name='停止 V7', exact=True).is_enabled()

        async def choose_fee(index, method):
            await page.evaluate('''({index,method})=>{
                const root=document.querySelector('.v7-content');
                const c=root.querySelector('select[aria-label="V7 收费案例"]');
                const m=root.querySelector('select[aria-label="V7 收费方法"]');
                c.value=String(index);m.value=method;
                c.dispatchEvent(new Event('change',{bubbles:true}));
            }''', {'index': index, 'method': method})
            assert await page.get_by_role('combobox', name='V7 收费案例', exact=True).input_value() == str(index)
            assert await page.get_by_role('combobox', name='V7 收费方法', exact=True).input_value() == method

        async def start_then(action):
            # Starting and cancelling within one event-loop turn avoids races
            # with a fast replay and does not add scientific workload.
            await page.evaluate('''() => {
                const root=document.querySelector('.v7-content');
                const button=text=>[...root.querySelectorAll('button')].find(b=>b.textContent===text);
                button('本机按冻结配置重跑').click();
                ACTION
            }'''.replace('ACTION', action))

        try:
            response = await page.goto(BASE, wait_until='domcontentloaded')
            assert response.status == 200
            await page.locator('#run').filter(has_text='重新运行').wait_for(timeout=30000)
            assert await page.locator('#setting-mode').input_value() == 'v5'
            assert (await page.locator('#metric-count').inner_text()).startswith('12')
            assert await page.locator('#policy-select option').count() == 3
            assert not research_requests, research_requests
            results['defaultV5Complete12AndLazyResearch'] = True
            await page.locator('#setting-limit').select_option('2')
            await page.locator('#setting-truck').fill('0')
            await page.locator('#setting-truck').dispatch_event('change')
            await page.locator('#run').click()
            await page.locator('#run').filter(has_text='重新运行').wait_for(timeout=30000)
            explanation = await page.locator('#feasibility-reasons').inner_text()
            assert '必要条件已经矛盾' in explanation
            results['workbenchNecessaryFailureExplanation'] = explanation
            await page.locator('#reset').click()
            await page.locator('#run').click()
            await page.locator('#run').filter(has_text='重新运行').wait_for(timeout=30000)
            assert (await page.locator('#metric-count').inner_text()).startswith('12')
            assert not research_requests

            await click('决策与证据 · V7')
            content = page.locator('.v7-content')
            executions = await table(content, '完整执行与预算损失')
            counts = await executions.locator('tbody tr td:nth-child(2)').all_inner_texts()
            assert counts == ['20 / 36', '21 / 36', '26 / 36', '27 / 36', '17 / 36'], counts
            pairs = await table(content, '共同完成路径的费用与变动')
            locked_pair = await pairs.locator('tbody tr').filter(has_text='V7 收费打磨恢复 对 V6 执行锁恢复').inner_text()
            stable_pair = await pairs.locator('tbody tr').filter(has_text='V7 收费打磨恢复 对 V5 保留计划').inner_text()
            assert '6.33%' in locked_pair and '-6.33%' not in locked_pair
            assert '-6.35%' in stable_pair and '0 / 15 / 5' in stable_pair
            text = await content.inner_text()
            assert '负数表示候选更贵' in text and '新增 7 个完整交付、损失 1 个' in text
            assert '6.35%' in text and '空、部分、未经审计或缺失' in text
            assert '每调用语义不同' in text and '5,000 ms' in text
            all_cases = await table(content, '全部场景与方法')
            assert await all_cases.locator('tbody tr').count() == 180
            assert BASE + '/data/rolling-v7-view.json' in research_requests
            assert not any('rolling-v6' in url or 'benchmark-v5' in url for url in research_requests)
            results['primary36CountsCostsAndNegativeEvidence'] = {'counts': counts, 'vsLocked': locked_pair, 'vsStable': stable_pair}
            await page.screenshot(path=str(OUTPUT / 'fees-desktop.png'), full_page=True)

            await choose_fee(easy_index, 'costPolishV7')
            slider = page.get_by_role('slider', name='V7 执行时点', exact=True)
            await click('后一天', content)
            assert await slider.input_value() == '1'
            await slider.focus()
            await slider.press('ArrowRight')
            assert await slider.input_value() == '2'
            assert await slider.evaluate('(node)=>node===document.activeElement')
            assert 'D+undefined' not in await content.inner_text()
            results['keyboardSliderAndDayReplay'] = True

            export_totals = {'records': 0, 'references': 0, 'polishProofs': 0, 'complete': 0, 'failed': 0}
            for role, cases, expected_counts in [
                    ('heldout', primary, ['20 / 36', '21 / 36', '26 / 36', '27 / 36', '17 / 36']),
                    ('development', development, ['20 / 36', '21 / 36', '29 / 36', '29 / 36', '17 / 36'])]:
                await page.get_by_role('combobox', name='V7 证据分组', exact=True).select_option(role)
                executions = await table(content, '完整执行与预算损失')
                assert await executions.locator('tbody tr td:nth-child(2)').all_inner_texts() == expected_counts
                assert await page.get_by_role('combobox', name='V7 收费案例', exact=True).locator('option').count() == 36
                assert await page.get_by_role('combobox', name='V7 收费方法', exact=True).locator('option').count() == 5
                if role == 'development':
                    assert '旧 V6 开发控制，不加入新留出分母' in await content.inner_text()
                for index, case in enumerate(cases):
                    for method in METHODS:
                        await choose_fee(index, method)
                        exported = await export_json('导出当前执行', f'exports/{role}/{index:02d}-{method}.json', content)
                        assert exported['dataRole'] == role
                        checked = assert_execution_export(exported, case, method)
                        export_totals['records'] += 1
                        export_totals['references'] += checked['references']
                        export_totals['polishProofs'] += checked['polishProofs']
                        export_totals['complete' if exported['result']['complete'] else 'failed'] += 1
                    if (index + 1) % 12 == 0:
                        print(f'V7 QA exports {role} {index + 1}/36, total {export_totals["records"]}', flush=True)
                results[role + 'AllCasesFiveMethodsDecodedExports'] = True
            assert export_totals['records'] == 360 and export_totals['complete'] == 227
            assert export_totals['polishProofs'] == rolling_review['summary']['polishBeforeAfterAudited']
            results['all360ExportChecks'] = export_totals

            await page.get_by_role('combobox', name='V7 证据分组', exact=True).select_option('heldout')
            await choose_fee(easy_index, 'costPolishV7')
            await click('本机按冻结配置重跑', content)
            await content.get_by_text('本机：', exact=False).wait_for(timeout=15000)
            await ready_fees()
            live = await export_json('导出当前执行', 'live-cost-replay.json', content)
            assert_execution_export(live, primary[easy_index], 'costPolishV7', archived=False)
            assert live['result']['complete'] is True, live['result'].get('failure')
            assert live['result']['browserReplay']['parentWallMs'] <= 5000
            results['live24CostReplay'] = {'case': live['caseId'], 'status': live['result']['status'], 'complete': True}

            await start_then("button('停止 V7').click();")
            await ready_fees()
            results['stopCancels'] = True
            await start_then("const s=root.querySelector('select[aria-label=\"V7 收费案例\"]');s.value='1';s.dispatchEvent(new Event('change',{bubbles:true}));")
            await ready_fees()
            assert await page.get_by_role('combobox', name='V7 收费案例', exact=True).input_value() == '1'
            results['scenarioChangeCancels'] = True
            await start_then("const s=root.querySelector('select[aria-label=\"V7 收费方法\"]');s.value='graspBaselineV7';s.dispatchEvent(new Event('change',{bubbles:true}));")
            await ready_fees()
            results['methodChangeCancels'] = True
            await start_then("document.querySelector('.v7-content select[aria-label=\"V7 证据分组\"]').value='development';document.querySelector('.v7-content select[aria-label=\"V7 证据分组\"]').dispatchEvent(new Event('change',{bubbles:true}));")
            await ready_fees()
            results['roleChangeCancels'] = True
            await start_then("document.querySelector('.research-nav-button[data-mode=resource]').click();")
            await click('收费恢复')
            await ready_fees()
            results['subviewChangeCancels'] = True
            await start_then("document.querySelector('.nav-button[data-tab=planner]').click();")
            await click('决策与证据 · V7')
            await ready_fees()
            results['topNavigationCancels'] = True
            await start_then("[...document.querySelectorAll('button')].find(b=>b.textContent==='V6–V4 留档').click();")
            await click('V7 最新研究')
            await ready_fees()
            results['archiveSwitchCancels'] = True

            await click('公开资源验证')
            scores = await table(content, '原模型成绩与官方参考差距')
            assert await scores.locator('tbody tr td:nth-child(2)').all_inner_texts() == ['480 / 480', '480 / 480']
            assert await scores.locator('tbody tr td:nth-child(4)').all_inner_texts() == ['172', '353']
            text = await content.inner_text()
            assert '307 / 173 / 0' in text and '8.26%' in text and 'warm in-process 100 ms' in text
            assert '不是现场订单' in text and '没有收费估计' in text
            resource_table = await table(content, '全部 480 原实例与两方法')
            assert await resource_table.locator('tbody tr').count() == 480
            resource_cells = await resource_table.locator('tbody tr').evaluate_all(
                '(rows)=>rows.map(r=>[...r.cells].map(c=>c.textContent))')
            assert resource_cells == [[case['id'], str(case['referenceOptimalMakespan']),
                                       str(case['policies']['baselineSerialSGS']['makespan']), '及时完整',
                                       str(case['policies']['iteratedSGS']['makespan']), '及时完整']
                                      for case in resource['cases']]
            assert await page.get_by_role('combobox', name='V7 资源实例', exact=True).locator('option').count() == 480
            for index in [0, 479]:
                for method in ['baselineSerialSGS', 'iteratedSGS']:
                    await page.get_by_role('combobox', name='V7 资源实例', exact=True).select_option(str(index))
                    await page.get_by_role('combobox', name='V7 资源方法', exact=True).select_option(method)
                    exported = await export_json('导出当前原模型结果', f'public-resource-{index}-{method}.json', content)
                    assert exported['case'] == resource['cases'][index] and exported['selectedMethod'] == method
                    policy = exported['case']['policies'][method]
                    assert policy['complete'] and policy['audit']['valid'] and policy['audit']['errors'] == []
                    starts = await table(content, '原实例实际作业开始向量')
                    cells = await starts.locator('tbody tr').evaluate_all('(rows)=>rows.map(r=>[...r.cells].map(c=>c.textContent))')
                    assert cells == [[str(job), str(start)] for job, start in zip(exported['case']['jobIds'], policy['starts'])]
            results['public480Reference172353And307173ZeroStartsAudits'] = True
            await page.screenshot(path=str(OUTPUT / 'resource-desktop.png'), full_page=True)

            await click('公开港口日志')
            windows = await table(content, '全部窗口与缺失/异常')
            assert await windows.locator('tbody tr').count() == 489
            assert await windows.locator('tbody tr td:first-child').all_inner_texts() == [v['visitId'] for v in ledger['visits']]
            text = await content.inner_text()
            assert '454 四阶段完整有序' in text and '35 缺失保留' in text
            assert '不是集装箱订单' in text and '下次分配时间不是在线可预知信息' in text
            visits = {visit['visitId']: visit for visit in ledger['visits']}
            for filter_name, expected_count in [('all', 489), ('complete', 454), ('incomplete', 35),
                                                ('exceptions', sum(bool(v['exceptions']) for v in ledger['visits']))]:
                await page.get_by_role('combobox', name='V7 港口窗口范围', exact=True).select_option(filter_name)
                selector = page.get_by_role('combobox', name='V7 港口观察窗口', exact=True)
                assert await selector.locator('option').count() == expected_count
                exported = await export_json('导出当前窗口证据', f'ledger-{filter_name}.json', content)
                assert exported['visit'] == visits[await selector.input_value()]
                if filter_name == 'incomplete':
                    assert exported['visit']['missingStages']
                    core = await table(content, '四个核心阶段的原始实际记录')
                    assert '缺失' in await core.inner_text() and 'null' in await core.inner_text()
                if filter_name == 'exceptions':
                    exceptions = await table(content, '窗口内全部原生异常')
                    assert await exceptions.locator('tbody tr').count() == len(exported['visit']['exceptions']) > 0
            results['native48945435FiltersMissingAndExceptions'] = True
            await page.screenshot(path=str(OUTPUT / 'ledger-desktop.png'), full_page=True)

            await click('V7 资料')
            await content.get_by_text('完整复现请取四个包', exact=False).wait_for()
            hrefs = await page.locator('#panel-research-v7 a').evaluate_all(
                '(nodes)=>nodes.filter(n=>n.getClientRects().length).map(n=>n.href)')
            local_links = sorted({href for href in hrefs if href.startswith(BASE + '/')})
            names = {urlparse(href).path.split('/')[-1] for href in local_links}
            zip_names = {'portplan-source.zip', 'portplan-experiments-v6.zip', 'portplan-experiments-v7.zip', 'portplan-public-inputs-v6.zip'}
            assert zip_names <= names
            assert {'defense-v7.ko.pdf', 'rolling-review-v7.json', 'rolling-review-v7.md',
                    'public-resource-review-v7.json', 'public-resource-review-v7.md',
                    'port-ledger-review-v7.json', 'port-ledger-review-v7.md', 'results-redteam-v7.md'} <= names
            if INTERACTIONS_ONLY:
                results['materialDeliveryChecks'] = {'status': 'SKIPPED; no complete release pass', 'links': local_links}
            else:
                checked = []
                for href in local_links:
                    reply = await page.request.head(href)
                    assert reply.ok and int(reply.headers.get('content-length', '0')) > 0, (href, reply.status, reply.headers)
                    checked.append({'url': href, 'status': reply.status, 'bytes': int(reply.headers['content-length'])})
                    if urlparse(href).path.split('/')[-1] in zip_names:
                        assert await asyncio.to_thread(first_four_bytes, href) == b'PK\x03\x04'
                pdf_url = next(href for href in local_links if href.endswith('/defense-v7.ko.pdf'))
                reply = await page.request.get(pdf_url)
                body = await reply.body()
                assert reply.ok and body.startswith(b'%PDF-')
                assert len(PdfReader(io.BytesIO(body)).pages) == 18
                results['materialsFourZIPs18PagePDFAndReviews'] = checked

            await click('V6–V4 留档')
            v6 = page.locator('.v6-content')
            classification = await table(v6, '全部旧案例的分类')
            assert await classification.locator('tbody tr').count() == 24
            await click('恢复留出')
            v6_execution = await table(v6, '完整执行与预算损失')
            assert await v6_execution.locator('tbody tr td:nth-child(2)').all_inner_texts() == ['21 / 36', '23 / 36', '29 / 36', '27 / 36']
            results['V6ArchivePreserved'] = True
            await click('V5–V4 留档')
            v5 = page.locator('.v5-content')
            await v5.get_by_text('16 / 24', exact=True).first.wait_for(timeout=30000)
            assert '73.59%' in await v5.inner_text()
            await click('短预算留出')
            assert await (await table(v5, '全部主场景与方法')).locator('tbody tr').count() == 108
            results['V5ArchivePreserved'] = True
            await click('V4 原始留档')
            await click('同预算对照')
            await page.get_by_role('heading', name='费用比较：同一配对集合', exact=True).wait_for(timeout=30000)
            assert '3.84%' in await page.locator('#panel-research-v7').inner_text()
            results['V4ArchivePreserved'] = True

            await page.set_viewport_size({'width': 390, 'height': 844})
            mobile = {}
            for name in ['滚动执行', '同预算对照', '独立核验', '参赛资料']:
                await click(name)
                if name == '独立核验':
                    await page.get_by_role('heading', name='独立解与界', exact=True).wait_for(timeout=30000)
                mobile['V4/' + name] = await no_overflow('V4/' + name)
            await click('V5 留出与稳定性')
            for name in ['稳定执行', '短预算留出', '独立核验', 'V5 参赛资料']:
                await click(name)
                if name == '独立核验':
                    await v5.get_by_role('heading', name='独立主目标与界', exact=True).wait_for(timeout=30000)
                mobile['V5/' + name] = await no_overflow('V5/' + name)
            await click('V6 最新研究')
            for name in ['失败诊断', '恢复留出', '公开输入', 'V6 资料']:
                await click(name)
                mobile['V6/' + name] = await no_overflow('V6/' + name)
            await click('V7 最新研究')
            for name in ['收费恢复', '公开资源验证', '公开港口日志', 'V7 资料']:
                await click(name)
                mobile['V7/' + name] = await no_overflow('V7/' + name)
            await page.screenshot(path=str(OUTPUT / 'v7-mobile.png'), full_page=True)
            await click('收费恢复')
            await page.get_by_role('combobox', name='V7 证据分组', exact=True).select_option('heldout')
            await choose_fee(easy_index, 'costPolishV7')
            slider = page.get_by_role('slider', name='V7 执行时点', exact=True)
            await slider.focus()
            await slider.press('ArrowRight')
            assert await slider.input_value() == '1'
            assert await slider.evaluate('(node)=>node===document.activeElement')
            mobile['V7/mobileKeyboardSlider'] = await no_overflow('mobile keyboard slider')
            await click('排程工作台')
            mobile['workbench'] = await no_overflow('workbench')
            nav_rects = await page.locator('.nav-button').evaluate_all(
                'nodes=>nodes.map(n=>({top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom}))')
            assert len({round(rect['top']) for rect in nav_rects}) == 1, nav_rects
            results['mobile390NoOverflowAndOneRowNav'] = mobile
            await page.screenshot(path=str(OUTPUT / 'workbench-mobile.png'), full_page=True)
            assert not errors and not console_errors and not failed_responses and not forbidden_requests, (
                errors, console_errors, failed_responses, forbidden_requests)
            results['passed'] = True
            results['completeReleasePass'] = not INTERACTIONS_ONLY
        except Exception as error:
            results['passed'] = False
            results['failure'] = repr(error)
            await page.screenshot(path=str(OUTPUT / 'failure.png'), full_page=True)
            (OUTPUT / 'failure-page.txt').write_text(await page.locator('body').inner_text())
            raise
        finally:
            results['pageErrors'] = errors
            results['consoleErrors'] = console_errors
            results['failedResponses'] = failed_responses
            results['researchRequests'] = research_requests
            results['forbiddenLargeRawRequests'] = forbidden_requests
            results['validatedViewSourceSHA256'] = view['sourceArchiveSha256']
            results['validatedBrowserTransport'] = transport
            results['validationScope'] = 'INTERACTIONS ONLY; material delivery unverified' if INTERACTIONS_ONLY else 'Complete V7 production browser release checks'
            report_name = 'browser-qa-interactions.json' if INTERACTIONS_ONLY else 'browser-qa.json'
            (OUTPUT / report_name).write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
            print(json.dumps(results, ensure_ascii=False, indent=2), flush=True)
            await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
