#!/usr/bin/env python3
"""Render the source-bound 18-page Korean V6 deck and check print/PDF layout.

Reads the completed archive and generated HTML. Never runs an experiment or
changes their bytes. An invalid candidate PDF stays in artifacts, not docs.
"""
from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re

import fitz
from playwright.async_api import async_playwright
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'artifacts/defense-v6'
EXPECTED_PAGES = 18
SOURCE_SHA256 = '695f7a62aeccd645bbd1374899fc21afe6caad1549bfbc7fa2d25e1ed62552a4'
PREVIEW_PAGES = (1, 5, 6, 10, 11, 12, 15, 18)

LAYOUT_JS = r'''items => items.map((slide, i) => {
  const rect=slide.getBoundingClientRect(), body=slide.querySelector('.body'), footer=slide.querySelector('footer');
  if(!body||!footer)throw new Error(`Slide ${i+1} is missing .body or footer`);
  const b=body.getBoundingClientRect(), f=footer.getBoundingClientRect();
  const visible=[body,...body.querySelectorAll('*')].filter(el=>{
    const css=getComputedStyle(el), r=el.getBoundingClientRect();
    return css.display!=='none'&&css.visibility!=='hidden'&&r.width>0&&r.height>0;
  }).map(el=>({tag:el.tagName, ...(() => {const r=el.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom}})()}));
  const contentBottom=Math.max(b.bottom,...visible.map(el=>el.bottom));
  const outside=visible.filter(el=>el.left<rect.left-0.5||el.right>rect.right+0.5||el.bottom>rect.bottom+0.5);
  return {page:i+1,id:slide.id,slideWidth:rect.width,slideHeight:rect.height,
    bodyBottom:b.bottom-rect.top,contentBottom:contentBottom-rect.top,
    footerTop:f.top-rect.top,footerBottom:f.bottom-rect.top,
    footerFontPx:parseFloat(getComputedStyle(footer).fontSize),
    clearance:f.top-contentBottom,overlap:contentBottom>f.top-6,
    footerOutside:f.bottom>rect.bottom+0.5,clipped:outside.length>0,outsideElements:outside,
    footerText:footer.innerText,bodyText:body.innerText};
})'''

CONTRAST_JS = r'''items => items.map(el => {
  const rgba=value=>{const n=value.match(/[\d.]+/g).map(Number);return [n[0],n[1],n[2],n.length===4?n[3]:1]};
  let background=el, bg=rgba(getComputedStyle(background).backgroundColor);
  while(bg[3]===0&&background.parentElement){background=background.parentElement;bg=rgba(getComputedStyle(background).backgroundColor)}
  const fg=rgba(getComputedStyle(el).color);
  const light=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const a=light(fg),b=light(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  return {slide:el.closest('.slide').id,tag:el.className||el.tagName,text:el.innerText,ratio,passes:ratio>=4.5};
})'''


def compact(text):
    return re.sub(r'\s+', '', text)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_evidence():
    archive = ROOT / 'data/rolling-v6.json'
    raw = archive.read_bytes()
    actual = hashlib.sha256(raw).hexdigest()
    if actual != SOURCE_SHA256:
        raise ValueError(f'V6 first-run archive hash mismatch: {actual}')
    record = json.loads(raw)
    summary = record['summary']
    if record['executionState'] != 'complete' or summary['caseCount'] != 36:
        raise ValueError('Require the complete unfiltered 36-case V6 archive.')
    locked = summary['comparisons']['lockedVsStable']
    if (summary['byMethod']['lockedRecoveryV6']['completeCount'],
            summary['byMethod']['stableRetainV5']['completeCount']) != (29, 23):
        raise ValueError('Completion figures disagree with the archived deck scope.')
    if f"{-locked['weightedIncrementalSavingsPct']:.2f}" != '12.26':
        raise ValueError('Paired incremental fee increase disagrees with the deck.')
    gain_ids = set(locked['gainedCompletionCaseIds'])
    gained = [case for case in record['cases'] if case['id'] in gain_ids]
    comparison_key = 'stableRetainV5__lockedRecoveryV6'
    no_initial = [case['id'] for case in gained if 'stableRetainV5' not in case['initialComparison']['eligibleMethods']]
    different = [case['id'] for case in gained if case['initialComparison']['pairs'][comparison_key]['decisionsEqual'] is False]
    if len(gained) != 6 or len(no_initial) != 5 or len(different) != 1:
        raise ValueError('Six gained completions must retain the five-no-initial/one-different-initial qualification.')
    return {'sourceArchiveSha256':actual, 'primaryCases':36,
            'lockedCompleteCount':29, 'stableCompleteCount':23,
            'pairedIncrementalIncreasePct':12.26,
            'gainedCompletionCount':6, 'baselineInitialUnavailableCaseIds':no_initial,
            'differentInitialCaseIds':different}


def require_layout(layout, media):
    if len(layout) != EXPECTED_PAGES:
        raise ValueError(f'{media}: expected 18 slides, found {len(layout)}')
    if [row['id'] for row in layout] != [f'slide-{i}' for i in range(1, 19)]:
        raise ValueError(f'{media}: slide IDs/order do not match the 18-page deck')
    failures = [row for row in layout if row['overlap'] or row['clipped'] or row['footerOutside']]
    if failures:
        raise ValueError(f'{media}: body/footer overlap or clipped content on pages {[row["page"] for row in failures]}')


def required_figures(texts):
    cover, diagnosis, costs = (compact(texts[index-1]) for index in (1, 5, 11))
    checks = {
        'completion29of36': '29/36' in cover,
        'completion23of36': '23/36' in cover,
        'incrementalFeeIncrease12_26Pct': '12.26%' in costs,
        'diagnosisThreeFourOne': '3·4·1' in diagnosis,
        'fiveBaselineNoInitialPlans': '5개는기준D0무후보' in costs,
        'oneDifferentInitialPlan': '1개는초기날짜가다른' in costs,
    }
    if not all(checks.values()):
        raise ValueError(f'Key figure or denominator qualification missing: {checks}')
    return checks


def check_pdf_geometry(path, print_layout):
    result = []
    with fitz.open(path) as document:
        for i, page in enumerate(document):
            layout = print_layout[i]
            scale = page.rect.height / layout['slideHeight']
            footer_top = layout['footerTop'] * scale
            footer_font = layout['footerFontPx'] * scale
            spans = [span for block in page.get_text('dict')['blocks'] if 'lines' in block
                     for line in block['lines'] for span in line['spans'] if span['text'].strip()]
            # Deck body/heading/table text is larger than footer text. Low-size
            # spans above the footer remain body text as an additional guard.
            body = [span for span in spans if span['size'] > footer_font+0.5 or span['bbox'][1] < footer_top-1]
            overlapping = [span for span in body if span['bbox'][3] > footer_top+0.5]
            outside = [span for span in spans if span['bbox'][0] < -0.5 or span['bbox'][2] > page.rect.width+0.5 or span['bbox'][3] > page.rect.height+0.5]
            footer_present = f'PORTPLANV6/{i+1:02d}' in compact(page.get_text())
            row = {'page':i+1, 'widthPt':page.rect.width, 'heightPt':page.rect.height,
                   'footerTopPt':footer_top, 'bodyTextBottomPt':max((span['bbox'][3] for span in body), default=0),
                   'overlap':bool(overlapping), 'textOutsidePage':bool(outside), 'footerPresent':footer_present,
                   'problemText':[span['text'] for span in overlapping+outside]}
            result.append(row)
            if i+1 in PREVIEW_PAGES:
                page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False).save(OUTPUT / f'pdf-page-{i+1}.png')
    failures = [row for row in result if row['overlap'] or row['textOutsidePage'] or not row['footerPresent']]
    if failures:
        raise ValueError(f'PDF geometry/footer check failed: {failures}')
    return result


async def render(args):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    evidence = read_evidence()
    html_path = ROOT / 'docs/defense-v6.ko.html'
    html_hash = digest(html_path)
    receipt = {'status':'running', 'generatedAt':datetime.now(timezone.utc).isoformat(timespec='seconds'),
               'url':args.url, 'htmlSha256':html_hash, 'evidence':evidence, 'pageCount':EXPECTED_PAGES}
    try:
        async with async_playwright() as playwright:
            browser = await playwright.chromium.launch(executable_path=args.chromium, headless=True, args=['--no-sandbox'])
            try:
                page = await browser.new_page(viewport={'width':1360, 'height':860})
                errors = []
                page.on('pageerror', lambda error: errors.append(str(error)))
                response = await page.goto(args.url, wait_until='networkidle', timeout=30000)
                if response is None or not response.ok:
                    raise ValueError(f'Deck URL did not return successfully: {None if response is None else response.status}')
                await page.evaluate('document.fonts.ready')
                receipt['screenLayout'] = await page.locator('.slide').evaluate_all(LAYOUT_JS)
                require_layout(receipt['screenLayout'], 'screen')
                receipt['lightContainerContrast'] = await page.locator('.cards p,.callout').evaluate_all(CONTRAST_JS)
                if any(not item['passes'] for item in receipt['lightContainerContrast']):
                    raise ValueError('Body text in a light card or callout has insufficient contrast.')
                receipt['htmlFigureChecks'] = required_figures(await page.locator('.slide').all_inner_texts())
                await page.emulate_media(media='print')
                await page.evaluate('document.fonts.ready')
                receipt['printLayout'] = await page.locator('.slide').evaluate_all(LAYOUT_JS)
                require_layout(receipt['printLayout'], 'print')
                for number in PREVIEW_PAGES:
                    await page.locator(f'#slide-{number}').screenshot(path=str(OUTPUT / f'slide-{number}.png'))
                candidate = OUTPUT / 'candidate-defense-v6.ko.pdf'
                await page.pdf(path=str(candidate), print_background=True, prefer_css_page_size=True)
                reader = PdfReader(candidate)
                if len(reader.pages) != EXPECTED_PAGES:
                    raise ValueError(f'PDF page count is {len(reader.pages)}, expected 18')
                receipt['pdfFigureChecks'] = required_figures([item.extract_text() or '' for item in reader.pages])
                receipt['pdfLayout'] = check_pdf_geometry(candidate, receipt['printLayout'])
                if errors:
                    raise ValueError(f'Browser page errors: {errors}')
                if digest(html_path) != html_hash or digest(ROOT / 'data/rolling-v6.json') != SOURCE_SHA256:
                    raise ValueError('Source HTML or immutable archive changed during rendering.')
                pdf = ROOT / 'docs/defense-v6.ko.pdf'
                candidate.replace(pdf)
                receipt.update(status='passed', bodyFooterOverlap=False, clippedContent=False,
                               pdfBytes=pdf.stat().st_size, pdfSha256=digest(pdf),
                               pdfPath=str(pdf), browserPageErrors=errors)
            finally:
                await browser.close()
    except Exception as error:
        receipt.update(status='failed', error=str(error))
        raise
    finally:
        (OUTPUT / 'pdf-qa.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({key:receipt[key] for key in ('status', 'pageCount', 'bodyFooterOverlap', 'clippedContent', 'pdfBytes', 'pdfSha256', 'pdfPath')}, ensure_ascii=False))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', default=os.environ.get('PORTPLAN_DEFENSE_URL', 'http://127.0.0.1:5173/docs/defense-v6.ko.html'))
    parser.add_argument('--chromium', default=os.environ.get('PORTPLAN_CHROMIUM_PATH', '/usr/bin/chromium'))
    asyncio.run(render(parser.parse_args()))


if __name__ == '__main__':
    main()
