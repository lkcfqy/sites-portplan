"""Production-browser release checks; never rewrite or rerun experiment archives.

The one local browser replay is UI verification, exported with its local scope.
Run only after the release preview has been built and started by its owner.
"""
import asyncio
import json
import os
import re
from pathlib import Path
from urllib.parse import urlparse

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'artifacts/browser-v6'
BASE = os.environ.get('PORTPLAN_QA_BASE', 'http://127.0.0.1:5174').rstrip('/')
INTERACTIONS_ONLY = os.environ.get('PORTPLAN_QA_INTERACTIONS_ONLY') == '1'
RESEARCH_FILES = {
    'failure-diagnosis-v6.json', 'feasibility-witnesses-v6.json',
    'feasibility-review-v6.json', 'rolling-v6-view.json', 'rolling-v6.json',
    'protocol-v6.json', 'public-orders-audit-v6.json', 'public-sources-v6.json',
    'benchmark-v4.json', 'rolling-v4.json', 'certificate-v4.json',
    'benchmark-v5.json', 'rolling-v5.json', 'certificate-v5.json',
}
METHODS = ['dailyReoptV4', 'stableRetainV5', 'lockedRecoveryV6', 'persistenceRecoveryV6']


def assert_decoded_ids(record, expected):
    """Compare public model input and every replay reference with original IDs."""
    assert record['caseId'] == expected['id'], (record['caseId'], expected['id'])
    nominal = record['nominalScenario']
    assert nominal['containers'] == expected['nominalScenario']['containers']
    for key in ['horizonStart', 'horizonDays', 'truckCapacity', 'warehouseCapacity',
                'stagingCapacity', 'tariff', 'operations']:
        assert nominal[key] == expected['nominalScenario'][key], key
    assert record['events'] == expected['events']
    ids = {c['id'] for c in nominal['containers']}
    assert ids and all(isinstance(value, str) for value in ids)
    result = record['result']
    references = list(result.get('rows') or []) + list(result.get('executedEvents') or [])
    for entry in result.get('timeline') or []:
        for key in ['decisions', 'executedEvents', 'revisions', 'state']:
            references.extend(entry.get(key) or [])
    for row in references:
        assert row.get('id') in ids, ('undecoded or unknown ID', row)
    if result.get('complete'):
        assert len(result['rows']) == len(ids)
        assert {row['id'] for row in result['rows']} == ids
    else:
        assert result.get('totalCost') is None and result.get('incrementalCost') is None
    return len(ids), len(references)


async def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    results, errors, failed_responses, research_requests = {}, [], [], []
    # Read immutable truth to verify projection/export fidelity, without calling
    # any generator, scientific runner, solver, or archive writer.
    with (ROOT / 'data/rolling-v6.json').open() as stream:
        raw = json.load(stream)
    assert raw['executionState'] == 'complete'
    assert [raw['summary']['byMethod'][m]['completeCount'] for m in METHODS] == [21, 23, 29, 27]
    assert [raw['developmentControls']['summary']['byMethod'][m]['completeCount'] for m in METHODS] == [16, 16, 16, 12]
    easy_index = next(i for i, c in enumerate(raw['cases'])
                      if c['mechanism'] == 'new-arrivals' and c['count'] == 24
                      and c['policies']['lockedRecoveryV6']['complete'])

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(
            executable_path=os.environ.get('PORTPLAN_CHROMIUM_PATH', '/usr/bin/chromium'),
            headless=True, args=['--no-sandbox'])
        page = await browser.new_page(viewport={'width': 1440, 'height': 1000})
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.on('response', lambda response: failed_responses.append(
            {'url': response.url, 'status': response.status}) if response.status >= 400 else None)
        page.on('request', lambda request: research_requests.append(request.url)
                if urlparse(request.url).path.split('/')[-1] in RESEARCH_FILES else None)

        async def click(name, scope=None):
            await (scope or page).get_by_role('button', name=name, exact=True).click()

        async def table(scope, title):
            heading = scope.get_by_role('heading', name=title, exact=True)
            await heading.wait_for(timeout=30000)
            return heading.locator('xpath=ancestor::article[1]').locator('table')

        async def export_json(name, filename):
            async with page.expect_download() as event:
                await click(name)
            download = await event.value
            await download.save_as(str(OUTPUT / filename))
            return json.loads((OUTPUT / filename).read_text())

        async def no_overflow(label):
            dimensions = await page.evaluate(
                '({viewport:innerWidth,html:document.documentElement.scrollWidth,body:document.body.scrollWidth})')
            assert dimensions['html'] <= dimensions['viewport'] + 1, (label, dimensions)
            assert dimensions['body'] <= dimensions['viewport'] + 1, (label, dimensions)
            return dimensions

        async def ready_recovery():
            await page.get_by_role('button', name='按冻结预算本机重跑', exact=True).wait_for()
            assert await page.get_by_role('button', name='按冻结预算本机重跑', exact=True).is_enabled()
            assert not await page.get_by_role('button', name='停止 V6', exact=True).is_enabled()

        async def start_then(action):
            # Same event-loop turn removes timing dependence on a very fast
            # worker result when verifying cancellation.
            script = '''() => {
              const root=document.querySelector('.v6-content');
              const button=text=>[...root.querySelectorAll('button')].find(b=>b.textContent===text);
              button('按冻结预算本机重跑').click();
              ACTION
            }'''.replace('ACTION', action)
            await page.evaluate(script)

        try:
            response = await page.goto(BASE, wait_until='domcontentloaded')
            assert response.status == 200
            await page.locator('#run').filter(has_text='重新运行').wait_for(timeout=30000)
            assert await page.locator('#setting-mode').input_value() == 'v5'
            assert (await page.locator('#metric-count').inner_text()).startswith('12')
            assert await page.locator('#policy-select option').count() == 3
            assert not research_requests, research_requests
            results['defaultV5Complete12AndLazyResearch'] = True

            # A deterministic impossible input exercises the workbench's new
            # necessary-condition explanation. This is not an experiment run.
            await page.locator('#setting-limit').select_option('2')
            await page.locator('#setting-truck').fill('0')
            await page.locator('#setting-truck').dispatch_event('change')
            await page.locator('#run').click()
            await page.locator('#run').filter(has_text='重新运行').wait_for(timeout=30000)
            proof = page.locator('#feasibility-reasons')
            await proof.wait_for(state='visible')
            proof_text = await proof.inner_text()
            assert '必要条件已经矛盾' in proof_text and ('至少需要' in proof_text or '没有合法日期组合' in proof_text)
            results['workbenchNecessaryFailureExplanation'] = proof_text
            await page.locator('#reset').click()
            await page.locator('#run').click()
            await page.locator('#run').filter(has_text='重新运行').wait_for(timeout=30000)
            assert (await page.locator('#metric-count').inner_text()).startswith('12')
            assert not research_requests, research_requests

            await click('决策与证据 · V6')
            content = page.locator('.v6-content')
            classification = await table(content, '全部旧案例的分类')
            assert await classification.locator('tbody tr').count() == 24
            await content.get_by_text('独立枚举审核通过：', exact=False).wait_for(timeout=30000)
            text = await content.inner_text()
            assert '3 个案例名义初始即不可行' in text
            assert '4 个实际容量全路径即使全知也不可行' in text
            assert '1 个全知可行但已执行前缀不可恢复' in text
            assert not any('/rolling-v6' in url or 'rolling-v5.json' in url for url in research_requests)
            diagnosis = await export_json('导出当前诊断与解释', 'diagnosis-export.json')
            assert diagnosis['case']['id'].startswith('v5-rolling-') and diagnosis['models']
            assert 'not a new online score' in diagnosis['scope']
            results['diagnosis24AndThreeFourOne'] = True
            await page.screenshot(path=str(OUTPUT / 'diagnosis-desktop.png'), full_page=True)

            await click('恢复留出')
            executions = await table(content, '完整执行与预算损失')
            actual_counts = await executions.locator('tbody tr td:nth-child(2)').all_inner_texts()
            assert actual_counts == ['21 / 36', '23 / 36', '29 / 36', '27 / 36'], actual_counts
            pairs = await table(content, '共同完成路径的费用与稳定性')
            locked = await pairs.locator('tbody tr').filter(has_text='V6 执行锁恢复 对 V5 保留可行计划').inner_text()
            assert '-12.26%' in locked, locked
            text = await content.inner_text()
            assert '不能称相同每调用硬预算' in text
            assert '空、部分、未经审计或缺失的初始记录没有被算作相同计划' in text
            equality = raw['summary']['initialEquality']
            assert f"四方法均有可比较完整首日方案 {equality['allMethodsEvaluatedCount']} 例" in text
            assert f"全部日期相同 {equality['allMethodsEqualCount']} 例" in text
            all_rows = await table(content, '全部案例与方法')
            assert await all_rows.locator('tbody tr').count() == 144
            assert BASE + '/data/rolling-v6-view.json' in research_requests
            assert BASE + '/data/rolling-v6.json' not in research_requests
            archived = await export_json('导出 V6 执行记录', 'heldout-archive-export.json')
            id_count, references = assert_decoded_ids(archived, raw['cases'][0])
            assert archived['replayScope'] == 'Archived experiment'
            results['recovery36CountsNegativeCostAndInitialScope'] = {'counts': actual_counts, 'negativePair': locked}
            results['decodedHeldoutExportIDs'] = {'containers': id_count, 'references': references}

            slider = page.get_by_role('slider', name='V6 执行时点', exact=True)
            await click('后一天', content)
            assert await slider.input_value() == '1'
            await slider.focus()
            await slider.press('ArrowRight')
            assert await slider.input_value() == '2'
            assert await slider.evaluate('(node)=>node===document.activeElement')
            assert 'D+undefined' not in await content.inner_text()
            results['dayReplayAndKeyboardFocus'] = True
            await page.screenshot(path=str(OUTPUT / 'recovery-desktop.png'), full_page=True)

            await page.get_by_role('combobox', name='V6 证据分组', exact=True).select_option('development')
            executions = await table(content, '完整执行与预算损失')
            development_counts = await executions.locator('tbody tr td:nth-child(2)').all_inner_texts()
            assert development_counts == ['16 / 24', '16 / 24', '16 / 24', '12 / 24'], development_counts
            all_rows = await table(content, '全部案例与方法')
            assert await all_rows.locator('tbody tr').count() == 96
            development = await export_json('导出 V6 执行记录', 'development-archive-export.json')
            assert development['dataRole'] == 'development'
            assert_decoded_ids(development, raw['developmentControls']['cases'][0])
            assert '不加入新留出分母' in await content.inner_text()
            results['development24CountsAndDecodedIDs'] = development_counts

            await page.get_by_role('combobox', name='V6 证据分组', exact=True).select_option('heldout')
            await page.get_by_role('combobox', name='V6 恢复案例', exact=True).select_option(str(easy_index))
            await page.get_by_role('combobox', name='V6 恢复策略', exact=True).select_option('lockedRecoveryV6')
            await click('按冻结预算本机重跑')
            await content.get_by_text('本机重跑：', exact=False).wait_for(timeout=15000)
            await ready_recovery()
            live = await export_json('导出 V6 执行记录', 'live-replay-export.json')
            assert_decoded_ids(live, raw['cases'][easy_index])
            assert live['replayScope'].startswith('Local browser')
            if live['result'].get('complete'):
                assert live['result']['browserReplay']['parentWallMs'] <= 5000
            else:
                assert live['result']['totalCost'] is None and live['result']['incrementalCost'] is None
            results['liveReplayContract'] = {'case': live['caseId'], 'status': live['result']['status'], 'complete': live['result'].get('complete')}

            await start_then("button('停止 V6').click();")
            await ready_recovery()
            results['stopCancels'] = True
            await start_then("const s=root.querySelector('select[aria-label=\"V6 恢复案例\"]');s.value='1';s.dispatchEvent(new Event('change',{bubbles:true}));")
            await ready_recovery()
            assert await page.get_by_role('combobox', name='V6 恢复案例', exact=True).input_value() == '1'
            results['scenarioChangeCancels'] = True
            await start_then("document.querySelector('.research-nav-button[data-mode=public]').click();")
            await click('恢复留出')
            await ready_recovery()
            results['subviewChangeCancels'] = True
            await start_then("document.querySelector('.nav-button[data-tab=planner]').click();")
            await click('决策与证据 · V6')
            await ready_recovery()
            results['topNavigationCancels'] = True
            await start_then("[...document.querySelectorAll('button')].find(b=>b.textContent==='V5–V4 留档').click();")
            await click('V6 最新研究')
            await ready_recovery()
            results['versionChangeCancels'] = True

            await click('公开输入')
            unknowns = await table(content, '未补齐的业务与语义字段')
            assert await unknowns.locator('tbody tr').count() == 11
            text = await content.inner_text()
            assert '47 客户' in text and '39 / 39' in text and '语义未知 11' in text
            assert '业务求解与费用' in text and '0 / 0' in text
            assert '不能称真实 PNC 订单' in text
            results['publicInput47Customers39Checks11UnknownZeroSolver'] = True

            await click('V6 资料')
            await content.get_by_text('完整复现请同时下载下面三个包', exact=False).wait_for()
            hrefs = await page.locator('#panel-research-v6 a').evaluate_all(
                '(nodes)=>nodes.filter(n=>n.getClientRects().length).map(n=>n.href)')
            local_links = sorted({href for href in hrefs if href.startswith(BASE + '/')})
            expected_zips = {'portplan-source.zip', 'portplan-experiments-v6.zip', 'portplan-public-inputs-v6.zip'}
            assert expected_zips <= {urlparse(href).path.split('/')[-1] for href in local_links}
            pdfs = [href for href in local_links if href.endswith('.pdf') and 'v6' in href.split('/')[-1]]
            assert pdfs, ('V6 presentation PDF link missing', local_links)
            if INTERACTIONS_ONLY:
                results['materialDeliveryChecks'] = {'status': 'SKIPPED; release delivery remains unverified', 'links': local_links}
            else:
                checked = []
                for href in local_links:
                    reply = await page.request.head(href)
                    assert reply.ok, (href, reply.status)
                    assert int(reply.headers.get('content-length', '0')) > 0, (href, reply.headers)
                    checked.append({'url': href, 'status': reply.status, 'bytes': reply.headers.get('content-length')})
                for href in pdfs:
                    reply = await page.request.get(href)
                    assert reply.ok and (await reply.body()).startswith(b'%PDF-'), href
                results['materialLinksThreeZIPsAndV6PDF'] = checked

            await click('V5–V4 留档')
            v5 = page.locator('.v5-content')
            await v5.get_by_text('16 / 24', exact=True).first.wait_for(timeout=30000)
            assert '73.59%' in await v5.inner_text()
            await click('短预算留出')
            v5_table = await table(v5, '全部主场景与方法')
            assert await v5_table.locator('tbody tr').count() == 108
            results['V5ArchivePreserved'] = True
            await click('V4 原始留档')
            await click('同预算对照')
            await page.get_by_role('heading', name='费用比较：同一配对集合', exact=True).wait_for(timeout=30000)
            assert '3.84%' in await page.locator('#panel-research-v6').inner_text()
            results['V4ArchivePreserved'] = True

            await page.set_viewport_size({'width': 390, 'height': 844})
            mobile = {}
            for name in ['滚动执行', '同预算对照', '独立核验', '参赛资料']:
                await click(name)
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
            await page.screenshot(path=str(OUTPUT / 'v6-mobile.png'), full_page=True)
            await click('排程工作台')
            mobile['workbench'] = await no_overflow('workbench')
            nav_rects = await page.locator('.nav-button').evaluate_all(
                'nodes=>nodes.map(n=>({top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom}))')
            assert len({round(rect['top']) for rect in nav_rects}) == 1, nav_rects
            results['mobile390NoOverflowAndOneRowNav'] = mobile
            await page.screenshot(path=str(OUTPUT / 'workbench-mobile.png'), full_page=True)

            assert not errors and not failed_responses, (errors, failed_responses)
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
            results['failedResponses'] = failed_responses
            results['researchRequests'] = research_requests
            results['validationScope'] = 'INTERACTIONS ONLY; material downloads skipped, not a release pass' if INTERACTIONS_ONLY else 'Complete browser release checks including all local material delivery'
            report_name = 'browser-qa-interactions.json' if INTERACTIONS_ONLY else 'browser-qa.json'
            (OUTPUT / report_name).write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
            print(json.dumps(results, ensure_ascii=False, indent=2), flush=True)
            await browser.close()


if __name__ == '__main__':
    asyncio.run(main())
