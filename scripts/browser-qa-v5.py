"""Local release browser checks; does not rerun frozen experiments or publish."""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'artifacts/browser-v5'
OUTPUT.mkdir(parents=True,exist_ok=True)
BASE=os.environ.get('PORTPLAN_QA_BASE','http://127.0.0.1:5174')
async def main():
 results={};errors=[];bad=[];researchRequests=[]
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('PORTPLAN_CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1440,'height':1000})
  page.on('request',lambda request:researchRequests.append(request.url) if '/data/' in request.url and request.url.split('/')[-1] in {'benchmark-v4.json','rolling-v4.json','certificate-v4.json','benchmark-v5.json','rolling-v5.json','certificate-v5.json'} else None)
  page.on('pageerror',lambda error:errors.append(str(error)))
  page.on('response',lambda response:bad.append({'url':response.url,'status':response.status}) if response.status>=400 else None)
  response=await page.goto(BASE,wait_until='domcontentloaded');assert response.status==200
  await page.locator('#run').filter(has_text='重新运行').wait_for(timeout=30000)
  assert await page.locator('#setting-mode').input_value()=='v5'
  assert (await page.locator('#metric-count').inner_text()).startswith('12')
  assert await page.locator('#policy-select option').count()==3
  results['defaultV5Complete']=True
  assert not researchRequests,researchRequests
  results['initialResearchArchivesDeferred']=True
  await page.get_by_role('button',name='决策与证据 · V5',exact=True).click()
  content=page.locator('.v5-content');await content.get_by_text('16 / 24',exact=True).first.wait_for()
  assert researchRequests==[BASE+'/data/rolling-v5.json'],researchRequests
  results['evidenceLoadedPerView']=True
  text=await content.inner_text();assert '73.59%' in text and '0.007454%' in text and '0.012746%' in text
  assert 'D+undefined' not in text and 'NaN' not in text
  await page.screenshot(path=str(OUTPUT/'desktop.png'),full_page=True)
  await page.get_by_role('button',name='后一天',exact=True).click();assert 'D+1' in await content.inner_text()
  slider=page.get_by_role('slider',name='V5 执行时点',exact=True);await slider.focus();await slider.press('ArrowRight')
  assert await slider.input_value()=='2';assert await slider.evaluate('(x)=>x===document.activeElement')
  assert 'D+undefined' not in await content.inner_text()
  results['dayReplayAndKeyboardSlider']=True
  await page.get_by_role('button',name='按当前策略重跑',exact=True).click()
  await content.get_by_text('V5 本机重跑：',exact=False).wait_for(timeout=30000)
  assert '保留计划' in await content.inner_text()
  results['liveStableReplay']=await content.locator('.notice').nth(1).inner_text()
  async with page.expect_download() as event:
   await page.get_by_role('button',name='导出 V5 执行记录',exact=True).click()
  d=await event.value;path=await d.path();record=json.loads(Path(path).read_text())
  assert record['result']['complete'] and record['result']['plannerStats']['reusedPlans']>0 and record['result']['plannerTrace']
  results['liveExecutionExport']=True
  await page.evaluate('()=>{const bs=[...document.querySelectorAll(".v5-content button")];bs.find(x=>x.textContent==="按当前策略重跑").click();[...document.querySelectorAll(".v5-content button")].find(x=>x.textContent==="停止 V5").click()}')
  assert await page.get_by_role('button',name='按当前策略重跑',exact=True).is_enabled()
  results['cancelVerified']=True
  await page.evaluate('()=>{[...document.querySelectorAll(".v5-content button")].find(x=>x.textContent==="按当前策略重跑").click();const s=document.querySelector(".v5-content select");s.value="1";s.dispatchEvent(new Event("change",{bubbles:true}))}')
  assert await page.get_by_role('button',name='按当前策略重跑',exact=True).is_enabled()
  results['scenarioChangeCancels']=True
  await page.evaluate('()=>{[...document.querySelectorAll(".v5-content button")].find(x=>x.textContent==="按当前策略重跑").click();document.querySelector(".research-nav-button[data-mode=holdout]").click()}')
  await page.get_by_role('button',name='稳定执行',exact=True).click()
  assert await page.get_by_role('button',name='按当前策略重跑',exact=True).is_enabled()
  results['subviewChangeCancels']=True
  await page.get_by_role('button',name='短预算留出',exact=True).click()
  await content.get_by_text('费用比较的配对与负结果',exact=True).wait_for()
  text=await content.inner_text();assert '4.06%' in text and '-7.54%' in text and '10 / 12' in text
  assert await content.locator('table').last.locator('tbody tr').count()==108
  results['heldoutMethodRows']=108
  await page.get_by_role('button',name='独立核验',exact=True).click()
  await content.get_by_text('独立主目标与界',exact=True).wait_for()
  assert await content.locator('table tbody tr').count()==42
  results['nativeCertificateRows']=42
  await page.get_by_role('button',name='V5 参赛资料',exact=True).click()
  for href in await content.locator('a').evaluate_all('(links)=>links.map(a=>a.href)'):
   reply=await page.request.get(href);assert reply.ok,f'{href}: {reply.status}'
  results['materialDownloads']=await content.locator('a').count()
  await page.get_by_role('button',name='V4 原始留档',exact=True).click()
  await page.get_by_role('button',name='同预算对照',exact=True).click()
  archive=page.locator('#panel-research-v5 > div').last
  await archive.get_by_text('费用比较：同一配对集合',exact=True).wait_for()
  assert '3.84%' in await archive.inner_text()
  results['V4ArchivePreserved']=True
  await page.set_viewport_size({'width':390,'height':844})
  for archive_mode in ['滚动执行','同预算对照','独立核验','参赛资料']:
   await page.get_by_role('button',name=archive_mode,exact=True).click()
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),{'mode':archive_mode,'dimensions':await page.evaluate('({w:innerWidth,scroll:document.documentElement.scrollWidth})')}
  results['allV4ArchiveModesNoMobileOverflow']=True
  await page.get_by_role('button',name='V5 留出与稳定性',exact=True).click()
  for name in ['稳定执行','短预算留出','独立核验','V5 参赛资料']:
   await page.get_by_role('button',name=name,exact=True).click()
   assert await page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),name
  rects=await page.locator('.nav-button').evaluate_all('items=>items.map(x=>({top:x.getBoundingClientRect().top,bottom:x.getBoundingClientRect().bottom}))')
  assert len({round(x['top']) for x in rects})==1 and max(x['bottom'] for x in rects)<=844
  results['mobileNoOverflowAndOneRowNavigation']=True
  await page.screenshot(path=str(OUTPUT/'mobile.png'),full_page=True)
  results['pageErrors']=errors;results['failedResponses']=bad;assert not errors and not bad,(errors,bad)
  (OUTPUT/'browser-qa.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n');print(json.dumps(results,ensure_ascii=False,indent=2))
  await browser.close()
asyncio.run(main())
