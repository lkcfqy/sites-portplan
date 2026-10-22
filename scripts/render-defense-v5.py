"""Render the generated 16-page deck locally and check content/footer overlap."""
import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright
from pypdf import PdfReader
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'artifacts/defense-v5'
OUTPUT.mkdir(parents=True,exist_ok=True)
async def main():
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('PORTPLAN_CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1360,'height':860})
  await page.goto(os.environ.get('PORTPLAN_DEFENSE_URL','http://127.0.0.1:5173/docs/defense-v5.ko.html'),wait_until='networkidle')
  await page.evaluate('document.fonts.ready')
  layout=await page.locator('.slide').evaluate_all('items=>items.map((s,i)=>{let b=s.querySelector(".body").getBoundingClientRect(),f=s.querySelector("footer").getBoundingClientRect();return {page:i+1,bodyBottom:b.bottom-s.getBoundingClientRect().top,footerTop:f.top-s.getBoundingClientRect().top,overlap:b.bottom>f.top-6}})')
  assert len(layout)==16
  assert not [x for x in layout if x['overlap']],layout
  for number in [1,7,10,13,14]:
   await page.locator(f'#slide-{number}').screenshot(path=str(OUTPUT/f'slide-{number}.png'))
  await page.emulate_media(media='print')
  pdf=ROOT/'docs/defense-v5.ko.pdf'
  await page.pdf(path=str(pdf),print_background=True,prefer_css_page_size=True)
  reader=PdfReader(pdf);assert len(reader.pages)==16
  text='\n'.join(x.extract_text() or '' for x in reader.pages)
  assert '3,200' in text and '621' in text and '164' in text
  receipt={'pageCount':16,'bodyFooterOverlap':False,'pdfBytes':Path(pdf).stat().st_size,'layout':layout}
  (OUTPUT/'pdf-qa.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n')
  print(json.dumps(receipt,ensure_ascii=False))
  await browser.close()
asyncio.run(main())
