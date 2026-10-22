#!/usr/bin/env python3
"""Render the source-bound 18-page Korean V7 deck and check print/PDF layout.

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
import unicodedata

import fitz
from playwright.async_api import async_playwright
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'artifacts/defense-v7'
EXPECTED_PAGES = 18
SOURCE_SHA256 = 'a8b0d67f7ff5fbf3b27fe260ab8d9d17be331a9942df37704d8d8365546000c6'
PREVIEW_PAGES = (1, 7, 8, 9, 10, 13, 15, 16, 18)

LAYOUT_JS = r'''items => items.map((slide, i) => {
  const rect=slide.getBoundingClientRect(), body=slide.querySelector('.body'), footer=slide.querySelector('footer');
  if(!body||!footer)throw new Error(`Slide ${i+1} is missing .body or footer`);
  const b=body.getBoundingClientRect(), f=footer.getBoundingClientRect();
  const visible=[...slide.querySelectorAll('.kicker,h1,.body,.body *')].filter(el=>{
    const css=getComputedStyle(el), r=el.getBoundingClientRect();
    return css.display!=='none'&&css.visibility!=='hidden'&&r.width>0&&r.height>0;
  }).map(el=>({tag:el.tagName, ...(() => {const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})()}));
  const contentBottom=Math.max(b.bottom,...visible.map(el=>el.bottom));
  const outside=visible.filter(el=>el.left<rect.left-0.5||el.right>rect.right+0.5||el.top<rect.top-0.5||el.bottom>rect.bottom+0.5);
  return {page:i+1,id:slide.id,slideWidth:rect.width,slideHeight:rect.height,
    bodyBottom:b.bottom-rect.top,contentBottom:contentBottom-rect.top,
    footerTop:f.top-rect.top,footerBottom:f.bottom-rect.top,
    footerFontPx:parseFloat(getComputedStyle(footer).fontSize),
    clearance:f.top-contentBottom,overlap:contentBottom>f.top-6,
    footerOutside:f.bottom>rect.bottom+0.5||f.left<rect.left-0.5||f.right>rect.right+0.5,clipped:outside.length>0,outsideElements:outside,
    footerText:footer.innerText,bodyText:body.innerText};
})'''

CONTRAST_JS = r'''items => items.filter(el=>{
  const css=getComputedStyle(el),r=el.getBoundingClientRect();
  return css.display!=='none'&&css.visibility!=='hidden'&&r.width>0&&r.height>0&&[...el.childNodes].some(n=>n.nodeType===Node.TEXT_NODE&&n.textContent.trim());
}).map(el => {
  const rgba=value=>{const n=value.match(/[\d.]+/g).map(Number);return [n[0],n[1],n[2],n.length===4?n[3]:1]};
  let background=el, bg=rgba(getComputedStyle(background).backgroundColor);
  while(bg[3]===0&&background.parentElement){background=background.parentElement;bg=rgba(getComputedStyle(background).backgroundColor)}
  const fg=rgba(getComputedStyle(el).color);
  const light=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
  const a=light(fg),b=light(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  const css=getComputedStyle(el),size=parseFloat(css.fontSize),large=size>=24||(size>=18.667&&parseInt(css.fontWeight)>=700),threshold=large?3:4.5;
  return {slide:el.closest('.slide').id,tag:el.className||el.tagName,text:el.innerText,fontPx:size,threshold,ratio,passes:ratio>=threshold};
})'''

FONTS_JS = r'''items => items.map(slide=>{
 const body=slide.querySelector('.body'),text=body.innerText,hangul=(text.match(/[\uac00-\ud7af]/g)||[]).length;
 const css=getComputedStyle(body),visible=getComputedStyle(slide).opacity!=='0'&&css.visibility!=='hidden'&&css.display!=='none';
 return {page:parseInt(slide.id.split('-')[1]),fontFamily:css.fontFamily,bodyFontPx:parseFloat(css.fontSize),hangulCharacters:hangul,
  visible,notoFontAvailable:document.fonts.check('22px "Noto Sans CJK KR"','한글완주비용')};
})'''


def compact(text):
    # PDF extraction can retain a typographic fi ligature in "prefix".
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', text))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_evidence():
    frozen = {'data/rolling-v7.json': SOURCE_SHA256,
              'data/public-resource-v7.json': '8006575658f320ba0db851af8e6f0251ac9935bb8d72790bf0b9f405594d4dd6',
              'data/port-ledger-v7.json': '2e0d2f31587b2455f85388092ef3fcc7fd94e9d11644613d42eb78c6beb9362b'}
    records = {}
    for name, expected in frozen.items():
        raw = (ROOT / name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != expected:
            raise ValueError('Frozen V7 evidence bytes differ: ' + name)
        records[name] = json.loads(raw)
    rolling, public, native = (records[name] for name in frozen)
    if rolling['executionState'] != 'complete' or len(rolling['cases']) != 36 or len(rolling['developmentControls']['cases']) != 36:
        raise ValueError('Require complete unfiltered 36+36 V7 episodes.')
    expected_counts = [20, 21, 26, 27, 17]
    methods = ['dailyReoptV4', 'stableRetainV5', 'lockedRecoveryV6', 'costPolishV7', 'graspBaselineV7']
    if [rolling['summary']['byMethod'][method]['completeCount'] for method in methods] != expected_counts:
        raise ValueError('Primary coverage differs from final source-bound figures.')
    pair = rolling['summary']['comparisons']['polishVsLocked']
    adverse = rolling['summary']['comparisons']['polishVsStable']
    if (pair['pairedCaseCount'], pair['totalSavingsKRW'], pair['positiveSavingsCount'], pair['tiedCount'], pair['negativeSavingsCount']) != (26, 8711850, 8, 18, 0):
        raise ValueError('Primary V7/V6 paired fee figures differ.')
    if (adverse['pairedCaseCount'], adverse['negativeSavingsCount'], len(adverse['lostCompletionCaseIds'])) != (20, 5, 1):
        raise ValueError('Required adverse V7/stable result differs.')
    if public['executionState'] != 'complete' or len(public['cases']) != 480:
        raise ValueError('Public RCPSP must retain all 480 instances.')
    ps, ns = public['summary'], native['summary']
    if [ps['byMethod'][method]['referenceOptimalMatchCount'] for method in ('baselineSerialSGS', 'iteratedSGS')] != [172, 353]:
        raise ValueError('Public reference-match figures differ.')
    if (ps['paired']['betterCount'], ps['paired']['tiedCount'], ps['paired']['worseCount']) != (307, 173, 0):
        raise ValueError('Public paired outcomes differ.')
    if native['valid'] is not True or (ns['nativeTypedOccurrences'], ns['assignmentVisits'], ns['visitCategories']['complete_ordered_observation'], ns['visitCategories']['incomplete_observation']) != (6989, 489, 454, 35):
        raise ValueError('Native occurrence audit figures differ.')
    review_hashes = {}
    for review_name, target in (('rolling-review-v7', 'data/rolling-v7.json'), ('public-resource-review-v7', 'data/public-resource-v7.json'), ('port-ledger-review-v7', 'data/port-ledger-v7.json')):
        path = ROOT / ('data/' + review_name + '.json')
        review = json.loads(path.read_text())
        if review.get('valid') is not True or review.get('fixture') is True or review['inputHashes'].get(target) != frozen[target]:
            raise ValueError('Final evidence lacks a current successful independent review: ' + review_name)
        review_hashes[str(path.relative_to(ROOT))] = digest(path)
    return {'inputHashes': frozen, 'reviewHashesAtRendering': review_hashes, 'primaryCases': 36, 'developmentCases': 36,
            'syntheticEpisodes': 360, 'primaryCompletionCounts': dict(zip(methods, expected_counts)),
            'pairedIncrementalSavingsPct': pair['weightedIncrementalSavingsPct'], 'pairedTotalSavingsPct': pair['weightedTotalSavingsPct'],
            'pairedStableIncrementalIncreasePct': -adverse['weightedIncrementalSavingsPct'], 'publicCases': 480,
            'publicReferenceMatches': [172, 353], 'publicBetterTieWorse': [307, 173, 0], 'nativeOccurrencesVisitsOrderedIncomplete': [6989, 489, 454, 35]}


def require_layout(layout, media):
    if len(layout) != EXPECTED_PAGES:
        raise ValueError(f'{media}: expected 18 slides, found {len(layout)}')
    if [row['id'] for row in layout] != [f'slide-{i}' for i in range(1, 19)]:
        raise ValueError(f'{media}: slide IDs/order do not match the 18-page deck')
    failures = [row for row in layout if row['overlap'] or row['clipped'] or row['footerOutside']]
    if failures:
        raise ValueError(f'{media}: body/footer overlap or clipped content on pages {[row["page"] for row in failures]}')


def required_figures(texts):
    t = {index: compact(value) for index, value in enumerate(texts, 1)}
    checks = {
        'cover26PairsAndNegativeFee': '26쌍' in t[1] and '−₩8,711,850' in t[1] and '-6.33%' in t[1],
        'pnc20ftRetroactiveIllustration': all(value in t[2] for value in ('20ft', '₩318,500', '₩500,500', '₩182,000', '표준요율산례')),
        'primaryAllFiveCoverage': all(str(value) + '/36' in t[7] for value in (20, 21, 26, 27, 17)),
        'pairedFee26Decrease6_33Total3_77': 'polishVsLocked26' in t[8] and '-6.33%' in t[8] and '-3.77%' in t[8] and '8/18/0' in t[8],
        'stable20PairsIncrease6_35': 'polishVsStable20' in t[8] and '6.35%' in t[8],
        'adverseFiveHigherOneLost': '6.35%' in t[9] and '더비싼쌍5개' in t[9] and '잃은완주1개' in t[9],
        'causalD0D1D2D3AndNotSamePrefixRescue': all(value in t[10] for value in ('D0·D1', 'D2', 'D3', '불가능증명')) and '동일실행prefix' in t[10],
        'developmentAdverse26_800': '₩26,800' in t[13] or '9/19/1' in t[13],
        'publicOriginal480Model': '480' in t[14] and '4개renewable' in t[14],
        'public172And353Matches': '172' in t[15] and '353' in t[15] and '480/480' in t[15],
        'public307_173_0And8_26': '307/173/0' in t[15] and '8.26%' in t[15],
        'native6989_489_454_35AndNoFee': all(value in t[16] for value in ('6,989', '489', '454ordered/35incomplete', '0/0/0', '39개')),
        'threeEvidenceScopesNotExternalCertificate': '내부독립구현' in t[17] and '최적성재증명' in t[17],
        'page18CeilingAIContributionAndUnconfirmedUser': '≤20쪽' in t[18] and '18쪽초안' in t[18] and 'AI수행' in t[18] and '사용자직접기여미확인' in t[18]
            and '대리서명' in t[18] and '참가·AI허용' in t[18],
    }
    if not all(checks.values()):
        raise ValueError('Key source figure or scope qualification missing: ' + str(checks))
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
            outside = [span for span in spans if span['bbox'][0] < -0.5 or span['bbox'][1] < -0.5 or span['bbox'][2] > page.rect.width+0.5 or span['bbox'][3] > page.rect.height+0.5]
            footer_present = f'PORTPLANV7/{i+1:02d}' in compact(page.get_text())
            hangul = re.findall(r'[\uac00-\ud7af]', page.get_text())
            invalid_glyphs = [span['text'] for span in spans if '\ufffd' in span['text'] or '\x00' in span['text']]
            names = set()
            for font in page.get_fonts():
                if font[3]:
                    names.add(font[3])
                # Chromium/Skia can embed CJK outlines as named Type3 glyph
                # procedures while leaving BaseFont empty. Their descriptor
                # still identifies the actual Noto family; check it too.
                descriptor_type, descriptor = document.xref_get_key(font[0], 'FontDescriptor')
                if descriptor_type == 'xref':
                    descriptor_xref = int(descriptor.split()[0])
                    for key in ('FontName', 'FontFamily'):
                        kind, value = document.xref_get_key(descriptor_xref, key)
                        if kind in ('name', 'string'):
                            names.add(value.lstrip('/'))
            pdf_fonts = sorted(names)
            cjk_font_present = any(re.search(r'Noto.*(?:CJK|KR)|Malgun', name, re.I) for name in pdf_fonts)
            row = {'page':i+1, 'widthPt':page.rect.width, 'heightPt':page.rect.height,
                   'footerTopPt':footer_top, 'bodyTextBottomPt':max((span['bbox'][3] for span in body), default=0),
                   'overlap':bool(overlapping), 'textOutsidePage':bool(outside), 'footerPresent':footer_present,
                   'hangulCharacters':len(hangul), 'invalidGlyphText':invalid_glyphs,
                   'pdfFonts':pdf_fonts, 'cjkFontPresent':cjk_font_present,
                   'problemText':[span['text'] for span in overlapping+outside]}
            result.append(row)
            if i+1 in PREVIEW_PAGES:
                page.get_pixmap(matrix=fitz.Matrix(1.25, 1.25), alpha=False).save(OUTPUT / f'pdf-page-{i+1}.png')
    failures = [row for row in result if row['overlap'] or row['textOutsidePage'] or not row['footerPresent'] or row['hangulCharacters'] < 30 or row['invalidGlyphText'] or not row['cjkFontPresent']]
    if failures:
        raise ValueError(f'PDF geometry/footer check failed: {failures}')
    return result


async def render(args):
    OUTPUT.mkdir(parents=True, exist_ok=True)
    evidence = read_evidence()
    html_path = ROOT / 'docs/defense-v7.ko.html'
    html_hash = digest(html_path)
    receipt = {'status':'running', 'generatedAt':datetime.now(timezone.utc).isoformat(timespec='seconds'),
               'url':args.url, 'htmlSha256':html_hash, 'rendererImplementationSha256':digest(Path(__file__)), 'evidence':evidence, 'pageCount':EXPECTED_PAGES}
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
                receipt['loadedHtmlResponseSha256'] = hashlib.sha256(await response.body()).hexdigest()
                if receipt['loadedHtmlResponseSha256'] != html_hash:
                    raise ValueError('Loaded URL bytes differ from final source HTML; use an unmodified static HTTP response.')
                receipt['chromiumVersion'] = browser.version
                await page.evaluate('document.fonts.ready')
                receipt['screenLayout'] = await page.locator('.slide').evaluate_all(LAYOUT_JS)
                for number in PREVIEW_PAGES:
                    await page.locator(f'#slide-{number}').screenshot(path=str(OUTPUT / f'screen-slide-{number}.png'))
                require_layout(receipt['screenLayout'], 'screen')
                receipt['textContrast'] = await page.locator('.slide *').evaluate_all(CONTRAST_JS)
                if any(not item['passes'] for item in receipt['textContrast']):
                    raise ValueError('Visible text has insufficient contrast: ' + str([{'slide':item['slide'], 'tag':item['tag'], 'ratio':item['ratio'], 'required':item['threshold']} for item in receipt['textContrast'] if not item['passes']]))
                receipt['koreanFonts'] = await page.locator('.slide').evaluate_all(FONTS_JS)
                if any(not item['visible'] or not item['notoFontAvailable'] or item['hangulCharacters'] < 30 for item in receipt['koreanFonts']):
                    raise ValueError('Korean body/font visibility check failed.')
                receipt['externalFigures'] = {'images': await page.locator('.slide img').count(), 'svg': await page.locator('.slide svg').count(), 'canvas': await page.locator('.slide canvas').count(),
                    'interpretation':'Current final material contains tables and CSS formulas; image/SVG/scientific chart figure count is zero.'}
                if any(receipt['externalFigures'][key] for key in ('images', 'svg', 'canvas')):
                    raise ValueError('Unexpected image/scientific chart requires a separate source/render check.')
                receipt['htmlFigureChecks'] = required_figures(await page.locator('.slide').all_inner_texts())
                await page.emulate_media(media='print')
                await page.evaluate('document.fonts.ready')
                receipt['printLayout'] = await page.locator('.slide').evaluate_all(LAYOUT_JS)
                require_layout(receipt['printLayout'], 'print')
                for number in PREVIEW_PAGES:
                    await page.locator(f'#slide-{number}').screenshot(path=str(OUTPUT / f'slide-{number}.png'))
                candidate = OUTPUT / 'candidate-defense-v7.ko.pdf'
                await page.pdf(path=str(candidate), print_background=True, prefer_css_page_size=True)
                reader = PdfReader(candidate)
                if len(reader.pages) != EXPECTED_PAGES:
                    raise ValueError(f'PDF page count is {len(reader.pages)}, expected 18')
                receipt['pdfFigureChecks'] = required_figures([item.extract_text() or '' for item in reader.pages])
                receipt['pdfLayout'] = check_pdf_geometry(candidate, receipt['printLayout'])
                if errors:
                    raise ValueError(f'Browser page errors: {errors}')
                if digest(html_path) != html_hash or any(digest(ROOT / path) != expected for path, expected in evidence['inputHashes'].items()):
                    raise ValueError('Source HTML or immutable evidence changed during rendering.')
                pdf = ROOT / 'docs/defense-v7.ko.pdf'
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
    parser.add_argument('--url', default=os.environ.get('PORTPLAN_DEFENSE_URL', 'http://127.0.0.1:5179/docs/defense-v7.ko.html'))
    parser.add_argument('--chromium', default=os.environ.get('PORTPLAN_CHROMIUM_PATH', '/usr/bin/chromium'))
    asyncio.run(render(parser.parse_args()))


if __name__ == '__main__':
    main()
