#!/usr/bin/env python3
"""Create V5 contest drafts from complete, hash-bound archived result JSON.

Missing experiments create explicit pending materials. --require-results refuses
pending inputs; it does not assert authorship, registration, or contest approval.
Never runs an experiment or edits a first-run archive or V4 artifact.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
from html import escape
import json
import math
from pathlib import Path
from statistics import median
import sys

ROOT = Path(__file__).resolve().parents[1]
METHODS = ('rawMILP', 'v4EventSearch', 'fastEvent')
ROLLING = ('dailyReopt', 'stableRetain')
LABELS = {'rawMILP': '기본 MILP', 'v4EventSearch': 'V4 직접 날짜 탐색',
          'fastEvent': 'V5 빠른 구성 + 날짜 탐색', 'dailyReopt': '매일 재최적화',
          'stableRetain': '유효 계획 유지'}


def load(filename):
    p = ROOT / 'data' / filename
    if not p.exists():
        return None, None
    raw = p.read_bytes()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def finite(v):
    return isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v)


def feasible(r):
    return bool(r and r.get('auditValid') is True and r.get('rows') and
                finite(r.get('incrementalCost')) and finite(r.get('totalCost')))


def completed(r):
    return bool(r and r.get('complete') is True and r.get('rows') and finite(r.get('totalCost')))


def num(v):
    return '—' if v is None else f'{v:,}'


def money(v):
    return '—' if v is None else ('−' if v < 0 else '') + f'₩{abs(v):,.0f}'


def pct(v, digits=2):
    return '—' if v is None else f'{v:.{digits}f}%'


def table(headers, rows):
    return '<table><thead><tr>' + ''.join('<th>' + escape(str(c)) + '</th>' for c in headers) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join('<td>' + escape(str(c)) + '</td>' for c in row) + '</tr>' for row in rows) + '</tbody></table>'


def mdtable(headers, rows):
    return '\n'.join(['| ' + ' | '.join(headers) + ' |', '| ' + ' | '.join('---' for _ in headers) + ' |'] + ['| ' + ' | '.join(str(c).replace('|', '/') for c in row) + ' |' for row in rows])


def cards(items):
    return '<div class="cards">' + ''.join('<article><strong>' + escape(str(a)) + '</strong><p>' + escape(b) + '</p></article>' for a, b in items) + '</div>'


def bullets(items):
    return '<ul>' + ''.join('<li>' + i + '</li>' for i in items) + '</ul>'


def two(a, b):
    return '<div class="two"><div>' + a + '</div><div>' + b + '</div></div>'


def box(t):
    return '<div class="callout">' + t + '</div>'


def paired_static(cases, baseline, candidate):
    paired = [(c['policies'][baseline], c['policies'][candidate]) for c in cases
              if feasible(c['policies'][baseline]) and feasible(c['policies'][candidate])]
    delta = [a['incrementalCost'] - b['incrementalCost'] for a, b in paired]
    denom = sum(a['incrementalCost'] for a, _ in paired)
    return {'pairedCaseCount': len(paired), 'positiveSavingsCount': sum(d > 1e-6 for d in delta),
            'tiedCount': sum(abs(d) <= 1e-6 for d in delta), 'negativeSavingsCount': sum(d < -1e-6 for d in delta),
            'incrementalSavingsKRW': sum(delta), 'weightedIncrementalSavingsPct': 100 * sum(delta) / denom if denom else None,
            'zeroBaselineCount': sum(a['incrementalCost'] == 0 for a, _ in paired),
            'missingBaselineCount': sum(not feasible(c['policies'][baseline]) for c in cases),
            'missingCandidateCount': sum(not feasible(c['policies'][candidate]) for c in cases),
            'worstLossKRW': max([0] + [-d for d in delta])}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--require-results', action='store_true')
    args = parser.parse_args(argv)
    protocol, phash = load('protocol-v5.json')
    rprotocol = protocol.get('rolling') if protocol else None
    rphash = phash  # Both experiments bind the same frozen protocol bytes.
    benchmark, bhash = load('benchmark-v5.json')
    rolling, rhash = load('rolling-v5.json')
    certificate_input, cihash = load('certificate-input-v5.json')
    certificate, chash = load('certificate-v5.json')
    br = bool(benchmark and benchmark.get('executionState') == 'complete')
    rr = bool(rolling and rolling.get('executionState') == 'complete')
    cr = bool(certificate and certificate.get('summary'))
    if br:
        if not protocol or benchmark.get('protocolHash') != phash:
            raise ValueError('Static archive protocol hash mismatch.')
        if [c['id'] for c in benchmark['cases']] != [c['id'] for c in protocol['primaryCases']]:
            raise ValueError('Static archive differs from complete frozen panel/order.')
        if any(set(c['policies']) != set(METHODS) for c in benchmark['cases']):
            raise ValueError('Static panel must retain each declared method.')
        for method in METHODS:
            if sum(feasible(c['policies'][method]) for c in benchmark['cases']) != benchmark['summary']['byPolicy'][method]['feasibleCount']:
                raise ValueError('Static availability summary contradicts archived candidates.')
        if [c['id'] for c in benchmark.get('scaleControls', {}).get('cases', [])] != [c['id'] for c in protocol.get('optionalScaleControl', {}).get('cases', [])]:
            raise ValueError('Optional scale-control panel differs from declared protocol.')
    if rr:
        if not rprotocol or rolling.get('protocolHash') != rphash:
            raise ValueError('Rolling archive protocol hash mismatch.')
        if [c['id'] for c in rolling['cases']] != [c['id'] for c in rprotocol['cases']]:
            raise ValueError('Rolling archive differs from complete frozen panel/order.')
        if any(set(c['policies']) != set(ROLLING) for c in rolling['cases']):
            raise ValueError('Rolling panel must retain both declared methods.')
        for method in ROLLING:
            item = rolling['summary']['byMethod'][method]
            for field in ('completeCount', 'solverCalls', 'reusedPlans', 'revisionCount'):
                value = item.get(field)
                if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                    raise ValueError('Rolling summary must expose recorded nonnegative ' + field)
            if sum(completed(c['policies'][method]) for c in rolling['cases']) != item['completeCount']:
                raise ValueError('Rolling completeness summary contradicts archived executions.')
            for field in ('solverCalls', 'reusedPlans'):
                if sum(c['policies'][method].get('plannerStats', {}).get(field, 0) for c in rolling['cases']) != item[field]:
                    raise ValueError('Rolling planner counters contradict archived policy traces.')
            if sum(c['policies'][method].get('revisionCount', 0) for c in rolling['cases']) != item['revisionCount']:
                raise ValueError('Rolling revision summary contradicts archived executions.')
    if cr:
        if not br or not certificate_input or certificate.get('inputSha256') != cihash or certificate_input.get('originArchiveSha256') != bhash:
            raise ValueError('Native certificate input/hash is not bound to the complete original static archive.')
        bindings = certificate.get('evidenceBindings', {})
        if bindings.get('originArchiveSha256') != bhash or bindings.get('protocolSha256') != phash:
            raise ValueError('Certificate evidence bindings do not match the source archive and protocol.')
        expected_cases = benchmark['cases'] + benchmark.get('scaleControls', {}).get('cases', [])
        if [c['id'] for c in certificate_input['cases']] != [c['id'] for c in expected_cases]:
            raise ValueError('Flattened certificate input must retain primary and scale-control cases in order.')
        ids = [c['id'] for c in certificate['cases']]
        if ids != [c['id'] for c in certificate_input['cases'][:len(ids)]]:
            raise ValueError('Certificate case subset must be the declared input-order prefix.')
    if args.require_results and not (br and rr and cr):
        raise ValueError('Final build requires completed static, rolling, and native certificate archives.')

    n = len(protocol['primaryCases']) if protocol else 36
    rn = len(rprotocol['cases']) if rprotocol else 24
    state = 'V5 저장 결과 기반 연구자료 초안' if br and rr and cr else 'V5 실험 전 구조 초안 · 결과 확정 대기'
    generated = datetime.now(timezone.utc).isoformat(timespec='seconds')
    bs = benchmark['summary'] if br else {}
    rs = rolling['summary'] if rr else {}
    cs = certificate['summary'] if cr else {}
    static_headers = ['방법', '완전 검산 / 전체', '최적 증명', '강제 한도', '보존 후보']
    static_rows = []
    time_rows = []
    for method in METHODS:
        item = bs.get('byPolicy', {}).get(method, {})
        static_rows.append([LABELS[method], f"{num(item.get('feasibleCount'))} / {n}", num(item.get('provenOptimalCount')), num(item.get('hardDeadlineCount')), num(item.get('retainedCheckpointCount'))])
        times = [c['policies'][method]['wallTimeMs'] for c in benchmark['cases'] if finite(c['policies'][method].get('wallTimeMs'))] if br else []
        time_rows.append([LABELS[method], f'{median(times):.2f} ms' if times else '—'])
    comparisons = {}
    pair_rows = []
    pair_detail_rows = []
    for baseline, key in [('v4EventSearch', 'fastVsV4'), ('rawMILP', 'fastVsRaw')]:
        item = paired_static(benchmark['cases'], baseline, 'fastEvent') if br else {}
        if br:
            recorded = bs['comparisons'][key]
            for field in ['pairedCaseCount', 'positiveSavingsCount', 'tiedCount', 'negativeSavingsCount', 'incrementalSavingsKRW', 'zeroBaselineCount']:
                if abs(item[field] - recorded[field]) > 1e-6:
                    raise ValueError('Paired static summary contradicts archived costs: ' + field)
        comparisons[key] = item
        pair_rows.append([LABELS[baseline], num(item.get('pairedCaseCount')),
            ' / '.join(num(item.get(k)) for k in ['positiveSavingsCount', 'tiedCount', 'negativeSavingsCount']),
            money(item.get('incrementalSavingsKRW')), pct(item.get('weightedIncrementalSavingsPct'))])
        pair_detail_rows.append([LABELS[baseline], num(item.get('zeroBaselineCount')), num(item.get('missingBaselineCount')), num(item.get('missingCandidateCount')), money(item.get('worstLossKRW'))])
    pair_headers = ['V5 후보의 기준', '완전 쌍', '낮음 / 같음 / 높음', '기준−V5 합계', '가중 차이']
    rolling_headers = ['정책', '완전 실행 / 전체', 'solver 호출', '계획 재사용', '날짜 변경']
    rolling_rows = []
    for method in ROLLING:
        item = rs.get('byMethod', {}).get(method, {})
        rolling_rows.append([LABELS[method], f"{num(item.get('completeCount'))} / {rn}", num(item.get('solverCalls')), num(item.get('reusedPlans')), num(item.get('revisionCount'))])
    rpair = [(c['policies']['dailyReopt'], c['policies']['stableRetain']) for c in rolling['cases'] if completed(c['policies']['dailyReopt']) and completed(c['policies']['stableRetain'])] if rr else []
    if rr:
        rdelta = [a['totalCost'] - b['totalCost'] for a, b in rpair]
        rdenom = sum(a['totalCost'] for a, _ in rpair)
        changes_delta = sum(a.get('revisionCount', 0) - b.get('revisionCount', 0) for a, b in rpair)
        rtrade = [len(rpair), sum(d > 1e-6 for d in rdelta), sum(abs(d) <= 1e-6 for d in rdelta), sum(d < -1e-6 for d in rdelta), sum(rdelta), 100 * sum(rdelta) / rdenom if rdenom else None, changes_delta]
        expected = rs['paired']
        if len(rpair) != expected['caseCount'] or abs(sum(rdelta) + expected['stableExtraCost']) > 1e-6:
            raise ValueError('Rolling paired fee summary contradicts archived executions.')
        if changes_delta != expected['dailyRevisionCount'] - expected['stableRevisionCount']:
            raise ValueError('Rolling paired revision summary contradicts archived executions.')
        initial_differ_ids = [c['id'] for c in rolling['cases'] if c.get('initialComparison', {}).get('decisionsEqual') is False]
        if initial_differ_ids != rs['initialPlansDifferCaseIds']:
            raise ValueError('Initial-plan comparison summary contradicts archived traces.')
        incremental_base = sum(a['incrementalCost'] for a, _ in rpair)
        incremental_stable = sum(b['incrementalCost'] for _, b in rpair)
        premium = incremental_stable - incremental_base
        incremental_premium_pct = 100 * premium / incremental_base if incremental_base else None
        total_base = sum(a['totalCost'] for a, _ in rpair)
        total_premium_pct = 100 * premium / total_base if total_base else None
        paired_change_base = sum(a['revisionCount'] for a, _ in rpair)
        paired_change_stable = sum(b['revisionCount'] for _, b in rpair)
        change_reduction_pct = 100 * (paired_change_base - paired_change_stable) / paired_change_base if paired_change_base else None
    else:
        rtrade = [None] * 7
        initial_differ_ids = None
        incremental_base = incremental_stable = premium = incremental_premium_pct = total_base = total_premium_pct = None
        paired_change_base = paired_change_stable = change_reduction_pct = None
    trade_rows = [[num(rtrade[0]), ' / '.join(num(v) for v in rtrade[1:4]), money(rtrade[4]), pct(rtrade[5], 6), num(paired_change_base) + ' → ' + num(paired_change_stable)]]
    trade_headers = ['완전 쌍', '유지 비용 낮음 / 같음 / 높음', '매일−유지 비용', '총비용 가중 차이', '날짜변경 매일→유지']
    cert_statuses = Counter(c.get('certificateStatus') for case in certificate['cases'] for c in case.get('certificates', {}).values()) if cr else Counter()
    cert_rows = [
        ['검토 기록 (입력 재사용 포함)', f"{num(cs.get('caseCount'))} / {num(cs.get('inputCaseCount'))}"],
        ['검산 후보 / 오류 사례', f"{num(cs.get('auditedCandidateCount'))} / {num(cs.get('failedCaseCount'))}"],
        ['최적 증명 / 불가능 증명', f"{num(cs.get('provenOptimalCount'))} / {num(cs.get('provenInfeasibleCount'))}"],
        ['미증명 후보 / 허용오차 최적', f"{num(cert_statuses['feasible_with_bound'] + cert_statuses['feasible_only']) if cr else '—'} / {num(cs.get('solverOptimalWithNumericToleranceCount'))}"],
        ['증명 없음 / 제외 사례', f"{num(cs.get('noCertificateCount'))} / {num(cs.get('omittedCaseCount'))}"],
    ]
    failures = Counter((m, r['status']) for c in benchmark['cases'] for m, r in c['policies'].items() if not feasible(r)) if br else Counter()
    failure_rows = [[LABELS[m], status, count] for (m, status), count in sorted(failures.items())] or [['전체', '완전 후보 실패 없음' if br else '결과 확정 대기', 0 if br else '—']]
    all_static = [[c['id']] + [(money(c['policies'][m]['incrementalCost']) if feasible(c['policies'][m]) else 'null') + ' / ' + c['policies'][m]['status'] for m in METHODS] for c in benchmark['cases']] if br else [['고정 패널 실험 전', '—', '—', '—']]
    all_rolling = [[c['id']] + [('완료 ' + money(c['policies'][m]['totalCost'])) if completed(c['policies'][m]) else ('실패일 ' + str((c['policies'][m].get('failure') or {}).get('day', '—')) + ' / ' + str((c['policies'][m].get('failure') or {}).get('kind', c['policies'][m]['status']))) for m in ROLLING] + [('동일' if c['initialComparison']['decisionsEqual'] else '다름')] for c in rolling['cases']] if rr else [['고정 패널 실험 전', '—', '—', '—']]
    scale_rows = [[c['id'], c.get('referenceCaseId', '—')] + [(money(c['policies'][m]['incrementalCost']) if feasible(c['policies'][m]) else 'null') + ' / ' + c['policies'][m]['status'] for m in METHODS] for c in benchmark.get('scaleControls', {}).get('cases', [])] if br else [['보충 패널 실험 전', '—', '—', '—', '—']]
    initial_note = ('초기 계획 비교 결과 확정 대기.' if initial_differ_ids is None else
                    f'초기 날짜가 다른 경로: {len(initial_differ_ids)} / {rn}. 해당 경로의 차이를 유지 정책만의 효과로 귀속하지 않습니다.')
    denominator_note = ('안정성 비용 분모 확정 대기.' if not rr else
                        f"날짜 변경 감소 {pct(change_reduction_pct)}. 유지 비용 증가 {money(premium)}: 총비용 {pct(total_premium_pct, 6)} / 추가비용 {pct(incremental_premium_pct, 6)}. 같은 완전 쌍의 다른 분모입니다.")
    scale_n = len(protocol.get('optionalScaleControl', {}).get('cases', [])) if protocol else 6

    slides = []
    def slide(kicker, title, body, footer, notes):
        slides.append(dict(kicker=kicker, title=title, body=body, footer=footer, notes=notes))

    slide('LOGISTICSOLVER 2026 · PUBLIC EVIDENCE', '한정 예산에서 완전 후보를 늘리고,<br>유효 계획의 변경을 줄입니다.' if br and rr else '완전 후보 구성과<br>유효 계획 유지의 가치를 검증합니다.',
        '<p class="hero">PortPlan V5<br><span>공개 요율·한정 계산 시간·실행 이력을 고려한 일별 일정계획</span></p><div class="pills"><span>빠른 완전 후보</span><span>생성 메커니즘 내 새 seed</span><span>유효 날짜 유지</span></div>' + f'<p class="small">{escape(state)} · 이 제목은 연구 방향이며 결과 수치로 적용 범위를 확인합니다.</p>',
        '연구자료 초안 · 실제 기업 절감·제출자 자격·수상 가능성 확인 아님',
        'V5 investigates two changes: obtaining a complete candidate within a limited budget, and retaining an existing executable date plan while it remains valid. The complete archived panel supports the final headline only within its synthetic scope. Final-return latency is not claimed lower: both searches may use the full budget. These are research drafts, not customer savings or contest eligibility attestations.')
    slide('01 / QUESTION', '계산 속도와 계획 안정성을<br>각각 검증합니다.',
        two('<h2>정적 계산</h2>' + bullets(['한도 전에 완전 후보가 전달되는가?', '더 강한 V4 날짜 탐색보다 유효한가?', '후보 수와 비용의 손실을 모두 남기는가?']), '<h2>실행 중 계획</h2>' + bullets(['유효한 계획을 유지해 변경을 줄이는가?', '장애 후 이력을 지키며 끝까지 실행하는가?', '변경 감소에 더 많은 요금을 내는가?'])) + box('두 실험은 다른 정책·예산입니다. 정적 1초 결과와 여러 날의 실행 결과를 한 숫자로 합치지 않습니다.'),
        '일별 모델 · 알려진 초기 주문 · 미래 용량 장애는 공개 전 비공개',
        'The static and rolling questions are separate. A faster candidate may have a higher cost. A stable policy may reduce changes but miss a cheaper currently feasible schedule or fail after an unforeseen shock. These are explicit tradeoffs, not assumptions of superiority.')
    slide('02 / FEE JUMP', '한 날의 연기가<br>182,000원을 더 만들 수 있습니다.',
        cards([('₩318,500', '20′ 14일: (14−4) × 31,850'), ('₩500,500', '20′ 15일: (15−4) × 45,500'), ('+₩182,000', '공개 요율에서 계산한 차이')]) + '<p>PNC의 최고 도달 단가는 모든 유료 일수에 소급 적용됩니다. 구간별 누적 함수로 바꾸면 다른 일정이 선호될 수 있습니다.</p><p class="small">4일 무료 · 20′ 1 TEU / 40′ 2 TEU · 양하 08:00 경계. 15일 금액은 공식 PDF 산례와 일치합니다.</p>' + box('이것은 요율 메커니즘 예시입니다. 실제 고객 청구나 V5 최적화의 절감액으로 계산하지 않습니다.'),
        'PNC 2026 Standard Tariff pp.3–4 · VAT/개별 계약 제외',
        'The published PNC retrospective rule produces a 182,000 won increase from fourteen to fifteen storage days for a twenty-foot dry box. The fifteen-day number matches an official example; the difference is derived arithmetic. Neither is a V5 optimization outcome or an observed customer invoice.')
    slide('03 / SOURCES', '공개 규칙과 생성 주문의<br>증거 범위를 지킵니다.',
        table(['층', '실제 근거', '주장 범위'], [['요율', 'PNC·Maersk Korea 공식 자료', '명시한 계산 규칙과 해석'], ['실제 관측', '광양 차량 게이트 시각', '별도 기간 오차 검증'], ['V5 주문/장애', '사전 고정 생성 설정', '같은 일별 모형의 정책 비교'], ['참가 규칙', '10월13일 공식 재확인', '새 AI/1인/평가 조건 확인 없음']]) + box('Maersk Korea 구간 간 일일 누적은 미확정 모델 해석입니다. 실제 게이트 방문을 PNC 주문이나 기업 절감 검증으로 바꾸지 않습니다.'),
        'source-audit.md · rules-update-v5.md · 원자료 URL/획득 시각/해시 보존',
        'Tariff rules, real gate-duration observations, and generated lifecycle orders support different claims. Korea-specific cross-band D&D accumulation remains a disclosed interpretation. The October 13 rules update found no new official AI, solo-team, or scoring condition; silence is not permission.')
    slide('04 / LIFECYCLE', '반출·적출·반납을<br>모두 완료한 계획만 계산합니다.',
        '<div class="flow"><b>반출 p</b><span>→</span><b>적출 u</b><span>→</span><b>공컨테이너 반납 r</b></div>' + two('<h2>작업과 기한</h2>' + bullets(['방출 가능일 ≤ p ≤ u', '연속 적출 종료 ≤ 화물 기한', '적출 이후 반납·전체 기간 내 완료']), '<h2>같이 쓰는 자원</h2>' + bullets(['반출·반납 각 운송 1회', '연속 적출일의 창고 슬롯', '[p,r) 기간의 대기 슬롯'])) + '<p class="formula">min Σ (PNC 보관료 + D&amp;D − 계획 전 고정 발생액)</p>' + '<p class="small">부분 일정 비용은 null입니다. 하루 내 운행 순서, 도로 경로와 예약은 구현 범위 밖입니다.</p>',
        'src/engine.js · 기존 일별 목표와 제약 유지',
        'V5 changes construction and execution policy, not the daily lifecycle objective. Complete audited plans account for all pickups, consecutive unloading operations, and returns. Subtracting a fixed prior fee base does not change the preferred schedule. Partial plans have null cost, not zero cost.')
    slide('05 / V4 TO V5', 'V4에서 확인한 약점으로 개발하고,<br>새 seed에서 다시 비교합니다.',
        two('<h2>V4는 개발 근거</h2><p>전처리 결합의 공정한 예산 비교는 직접 날짜 탐색보다 더 높은 합산 요금을 보였습니다.</p><p>이를 숨기거나 V4 최저 사례를 대표 성과로 선택하지 않습니다.</p>', '<h2>V5는 새 생성 seed</h2><p>정적 36개, 별도 실행 24개 새 경로에서 고정 정책을 평가합니다.</p><p>같은 합성 생성 메커니즘 안의 seed 분리입니다.</p>') + box('외부 기업 주문·실제 운영 기간·다른 생성 분포의 일반화 검증은 아닙니다. V4 결과와 V5 결과의 분모를 섞지 않습니다.'),
        'V4 개발 집합 → V5 새 seed 고정 패널 · 결과를 본 뒤 사례 교체 금지',
        'V4 is development evidence: its negative results motivated the implementation change. V5 uses new fixed seeds within the same synthetic generator. This is a generator-internal holdout, not external company validation, a temporal business holdout, or proof of generalization to new distributions.')
    slide('06 / FASTER CONSTRUCTION', '날짜 비용을 한 번 계산하고,<br>자원 점유를 증분 갱신합니다.',
        two('<h2>새로운 구현</h2>' + bullets(['상자별 반출·반납 날짜 비용 배열 캐시', '정렬은 구성 시도마다 한 번', '운송·창고·대기 배열의 추가/제거', '제한된 rollback repair와 재시작']), '<h2>fastEvent 전체 정책</h2><p>콜드 시작 총 <b>1,000ms</b> 안에서 구성에 최대 200ms를 쓰고, 남은 시간에 V4 직접 날짜 이웃 탐색을 실행합니다.</p><p>검산 후보만 종료 전에 전달·보존합니다.</p>') + box('일반적인 캐시·증분 구성·이웃 탐색의 응용입니다. 날짜 비용 준비와 초기 구성도 예산에 포함하며 전역 최적은 주장하지 않습니다.'),
        'fast-constructor-v5.js · event-search-v4.js · 초기구성은 실행 이력 locks 미지원',
        'The constructor caches separable pickup and return date prices, sorts once per construction attempt, and updates resource arrays in place. Limited rollback repair and seeded restarts seek a complete candidate. fastEvent spends at most 200 milliseconds on construction and uses the remainder of the same cold one-second budget for V4 event-date search. This static constructor does not support executed-event locks.')
    slide('07 / RETAIN VALID DATES', '오늘도 유효하면 유지하고,<br>무효일 때만 다시 풉니다.',
        '<div class="flow"><b>현재 snapshot</b><span>→</span><b>기존 날짜 검산</b><span>→</span><b>유지 / 재계획</b></div>' + two('<h2>유지 조건</h2>' + bullets(['현재 알려진 주문을 모두 포함', '현재 관측 자원 제약 통과', '실행한 날짜와 미실행 날짜 경계 통과']), '<h2>유지할 때의 의미</h2>' + bullets(['solver를 호출하지 않음', '현재 요율로 비용은 다시 계산', '날짜가 유효해도 현재 최적은 아님'])) + box('비용이 더 낮은 현재 해가 있어도 유지할 수 있습니다. 변경 감소와 추가 비용의 교환을 결과에 같이 표시합니다.'),
        'stable-planner-v5.js · 에피소드별 캐시 · 상태: retained_plan_not_reoptimized',
        'stableRetain audits cached dates against the current causal snapshot and immutable executed events. It reuses them only if all known orders, resources, and date boundaries remain valid. It recomputes costs under current tariffs without claiming current optimality. It invokes the solver initially or when the cached plan is invalid. Lower disruption can come at a fee premium.')
    slide('08 / STATIC PROTOCOL', '세 정책의 초기화·계산·검산을<br>같은 강제 한도에 넣습니다.',
        cards([(str(n), '새 seed 정적 패널'), ('16 / 50 / 100', '적체·신규·일괄 방출 × 두 용량'), ('1,000ms', '부모 wall clock 강제 종료')]) + '<p>기본 MILP, V4 직접 날짜 탐색, V5 fastEvent를 순서 회전·한 번에 하나씩 실행합니다. 코드/GLPK 로딩, 구성, 이웃 탐색, 검산과 결과 수신까지 포함합니다.</p><p class="small">한도 전 완전 후보는 유지 가능하지만 종료된 solve의 최적 증명은 인정하지 않습니다. 종료 전달 오버헤드는 따로 기록합니다.</p>',
        'protocol-v5.json · 3초 보충 패널은 1초 주 결과와 분리 · first-run 코드 보존',
        'Three methods share a parent-enforced one-second cold budget. All setup, candidate construction, search, audit, and result delivery count. The complete fixed panel remains intact. Received checkpoints can survive termination without preserving a killed solve proof. Source snapshots and hashes support reproducibility, not external preregistration.')
    slide('09 / STATIC AVAILABILITY', '완전 후보 수와 최적 증명을<br>별도로 확인합니다.', table(static_headers, static_rows) + box('보존 후보는 검산된 실행 가능 해입니다. 기본 MILP 실패를 수학적 불가능으로 바꾸지 않고, V5 후보를 최적 해로 부르지 않습니다.') + '<p class="small">누락·실패를 남긴 뒤 완전 쌍의 비용을 비교합니다. 최종 반환 지연이 더 짧다는 주장은 하지 않습니다.</p>',
        'benchmark-v5.json → summary.byPolicy · 모든 선언 사례/정책 유지',
        'Availability and proof are separate. A timeout checkpoint can be a complete feasible plan; a solver without an incumbent has no complete-plan fee. fastEvent is heuristic. Read missing outcomes together with paired cost results rather than treating a low paired cost as high execution coverage.')
    slide('10 / STATIC PAIRED COST', '더 강한 기준과의 비용 차이를<br>승리·동률·손실 모두로 읽습니다.', table(pair_headers, pair_rows) + '<p class="small">가중 차이 = Σ(기준 추가비용−V5 추가비용) / Σ기준 추가비용. 음수면 V5가 더 비쌉니다. 각 행의 완전 쌍은 다를 수 있습니다.</p>' + box('0원 기준에는 사례별 백분율을 만들지 않습니다. 누락 쌍과 최악 손실은 보고서와 원자료에서 함께 공개합니다.'),
        'benchmark-v5.json · 새 생성 seed 내 조건부 비교 · 실제 고객 절감률 아님',
        'Compare fastEvent with both V4 event search and raw MILP. Each row is conditional on both policies finishing. The weighted percentage uses incremental modeled fees, and negative differences mean V5 costs more. Retain all zero-cost denominators, missing pairs, and losses. Different paired panels cannot be compared as a common population estimate.')
    slide('11 / STABLE EXECUTION', '안정성은 완료·호출·변경을<br>같이 보고 판단합니다.', table(rolling_headers, rolling_rows) + box('같은 하루 시작 관측·실행 고정 규칙, solve 내부 한도 0.2초입니다. 호출 수가 다르므로 총 계산 동예산 비교가 아닙니다.') + '<p class="small">모든 주문은 처음부터 알려지고 미래 장애 기간은 공개 전 미지입니다. 미공개 용량은 명목 예측입니다.</p>',
        'rolling-v5.json · 별도 새 24경로 · 하루 시작에 관측',
        'The two execution policies receive the same day-start causal information and frozen history. Report complete episodes, solver calls, reused plans, and changes to unexecuted event dates. Their number of solves differs, so this is not an equal-total-computation comparison. Initially known orders and unrevealed synthetic capacity durations define the scope.')
    slide('12 / STABILITY PRICE', '변경이 줄어도 비용이 늘면<br>그 대가를 그대로 표시합니다.', table(trade_headers, trade_rows) + '<p class="small">' + escape(denominator_note) + '</p><p class="small">' + escape(initial_note) + '</p>' + box('날짜 변경은 미실행 사건 날짜의 변경 횟수입니다. 실제 작업비나 현재 최적성 보장이 아니며 실패도 보존합니다.'),
        '매일−유지 총 생애주기 비용 · 추가비용 분모와 혼용 금지',
        'The stability table uses total lifecycle fees, a different denominator from the static incremental-fee comparison. A positive date-change difference means daily reoptimization changed more pending event dates. Changes are not a measured labor cost. Separate initial solves may produce different date plans under time limits: those cases cannot attribute all later differences to retention alone. The retained plan can be more expensive or fail; those outcomes stay visible.')
    slide('13 / INDEPENDENCE', '별도 Python 모델로 검산하고,<br>증명 범위를 한정합니다.', two(table(['독립 확인', '기록'], cert_rows), '<h2>독립 trip-column 모형</h2>' + bullets(['JS 요금 함수·MILP 계수 미사용', '완전 사건 날짜와 모든 용량 검토', 'HiGHS 후보·하한과 상태 모순 검사', '비정수는 수치 허용오차 상태 분리'])) + box('내부 독립 구현이며 외부 인증이 아닙니다. 추가 HiGHS 예산은 정적 1초 비교 밖이고 rolling 이력 전체 증명이 아닙니다.'),
        f'certificate-v5.json · {n}개 주 seed + {scale_n}개 동일 입력 3초 제어; 독립 {n + scale_n}개 아님',
        'Python reconstructs tariff arithmetic and a trip-column model independently of the JavaScript implementation. The native solver uses extra two-second-per-objective time outside the static comparison. The certificate covers 36 primary seeds and six repeated-input three-second controls, not 42 independent scenarios. Numeric-tolerance optimal status is distinct from the declared safe-integer proof. The certificate validates static model candidates, not the entire rolling history or actual contract invoices.')
    slide('14 / FAILURES & SCOPE', '실패를 보존하고,<br>검증한 응용만 주장합니다.', two('<h2>남기는 결과</h2>' + bullets(['완전 후보 없음과 원래 실패 상태', 'negative 비용 차이와 0원 분모', '실행 실패일·불변 과거 작업', 'V4 개발 음성 결과와 V5 전체 패널']), '<h2>기여의 경계</h2>' + bullets(['캐시·증분 구성·rolling은 기존 기법', '공개 한국 요율과 실행 상태의 결합', '경로·예약·새 주문·세금 미구현', '기업 배치·실현 절감·최초 주장 없음'])) + box('강한 내부 비교와 원문 검산은 검증 가능한 연구 기여입니다. 같은 생성기 새 seed를 실제 항만 운영의 검증으로 바꾸지 않습니다.'),
        'prior-art-v2.md · research-roadmap-v4.md · 전체 결과와 검토 깊이 공개',
        'Caching, incremental resource updates, neighborhood search, and rolling retention are established ideas. The contribution is the inspectable application to specific public fees and execution state with stronger comparisons. Retain failures, unfavorable costs, and previous development negatives. No deployment, external operational validation, firstness, or victory probability is claimed.')
    slide('15 / SUBMISSION STATUS', '자료와 시연은 준비하고,<br>본인 기여를 꾸미지 않습니다.', two('<h2>준비물</h2>' + bullets(['원문·해시·프로토콜·first-run 코드', '모든 입력/결과·실패·독립 검산', '완전 계획→장애 공개→유지/재계획', '보고서와 16쪽 발표·이해용 영문 노트']), '<h2>실제 작성 상태</h2>' + bullets(['본회차 조사·개발·자료는 AI가 수행', '사용자 본인 검증/자체 기여 미확인', '1인·영어·AI·당해 서약 공개 미확인', '11월6일18:00 자료·발표 ≤20쪽'])) + box('이 초안은 참가 완료나 작성자 승인 기록이 아닙니다. 2025 직접 창작·대리 작성 금지 서약은 역사 근거이며 2026 적용은 미확인입니다.'),
        'rules-update-v5.md · contribution-log-v5.md · 본인 확인 전 연구자료',
        'Most work this round was autonomously performed by AI. The materials do not state that the entrant personally implemented or verified it. The October 13 official update found no new solo, English, AI, or scoring clarification. The 2025 direct-creation pledge is historical evidence, not a confirmed 2026 AI policy. Provide reviewable drafts without signing, registering, or falsely claiming personal work.')

    if len(slides) != 16:
        raise ValueError('Deck must contain exactly 16 pages.')
    # Self-contained, no font CDN or browser installation required.
    css = '\n*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#e7ecee;color:#16353f;font-family:"Noto Sans CJK KR","Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",Arial,sans-serif;font-size:25px;line-height:1.45;word-break:keep-all}.slide{width:1280px;height:720px;position:relative;margin:24px auto;padding:40px 62px 63px;background:#fbfcfa;box-shadow:0 10px 30px #18313c16;break-after:page;overflow:hidden}.slide:first-of-type{background:#123941;color:#f6faf6}.kicker{font-size:15px;letter-spacing:1.6px;font-weight:700;color:#288377}h1{font-size:43px;line-height:1.22;letter-spacing:-1.4px;margin:13px 0 24px;font-weight:800}.slide:first-of-type h1{font-size:57px}.slide:first-of-type .kicker{color:#8bd9c3}.hero{font-size:44px;font-weight:800;margin:34px 0 24px}.hero span{font-size:25px;font-weight:500}.small{font-size:18px;color:#536d72;margin:15px 0}.slide:first-of-type .small{color:#c1dcd8}.pills{display:flex;gap:13px;margin:25px 0}.pills span{padding:9px 16px;border:1px solid #659b91;border-radius:25px;font-size:20px}.two{display:grid;grid-template-columns:1fr 1fr;gap:34px}.two p,.two li{font-size:23px}p{margin:12px 0}h2{font-size:25px;color:#217f70;margin:8px 0 14px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin:7px 0 24px}.cards article{background:#e7f1ec;border-top:4px solid #3b9a82;padding:19px 20px}.cards strong{font-size:39px;letter-spacing:-1.2px;color:#157462}.cards p{font-size:20px;margin-bottom:0}.callout{border-left:5px solid #d49d36;background:#f6f0dc;padding:12px 17px;font-size:20px;margin:19px 0 0}.flow{display:flex;align-items:center;justify-content:space-between;background:#e7f1ec;padding:21px;margin:0 0 19px;font-size:22px}.flow span{color:#468d80}table{border-collapse:collapse;width:100%;font-size:19px;line-height:1.35;margin:4px 0 14px}th,td{text-align:left;padding:13px 13px;border-bottom:1px solid #cdded7;vertical-align:top}th{background:#e7f1ec;font-size:17px;color:#287562}td:first-child{font-weight:600}ul,ol{padding-left:25px;margin:8px 0 12px}li{margin:8px 0}.formula{font-family:Arial,sans-serif;font-size:25px;background:#e7f1ec;padding:14px 20px;margin-top:17px}pre{background:#edf2ef;font:17px/1.7 monospace;padding:11px 18px;overflow:hidden;white-space:pre-wrap;word-break:break-all}footer{position:absolute;left:62px;right:62px;bottom:18px;display:flex;gap:24px;justify-content:space-between;border-top:1px solid #c4d7d0;padding-top:9px;font-size:13px;color:#526e72;line-height:1.35}footer span:first-child{max-width:1030px}.slide:first-of-type footer{color:#b7d5ce;border-color:#507970}.toolbar{width:1280px;margin:16px auto;display:flex;gap:15px;align-items:center;font-size:17px}.toolbar button{font:inherit;border:0;background:#163b43;color:white;padding:9px 16px;border-radius:5px;cursor:pointer}.draft{color:#516a72}a{color:inherit}@page{size:1280px 720px;margin:0}@media print{.toolbar{display:none}body{background:white}.slide{margin:0;box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact}.slide:last-of-type{break-after:auto}}@media screen and (max-width:1280px){body{min-width:1280px}}\n'
    sections = []
    for i, s in enumerate(slides, 1):
        sections.append(f'<section class="slide" id="slide-{i}" aria-label="{i}. {escape(s["title"].replace("<br>", " "))}"><div class="kicker">{s["kicker"]}</div><h1>{s["title"]}</h1><div class="body">{s["body"]}</div><footer><span>{escape(s["footer"])}</span><span>PORTPLAN V5 / {i:02d}</span></footer></section>')
    html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PortPlan V5 · Korean research draft</title><style>' + css + '</style></head><body><nav class="toolbar"><button onclick="window.print()">PDF 인쇄</button><span class="draft">' + escape(state) + ' · 16쪽 · 본인 확인 미완료</span></nav>' + '\n'.join(sections) + '<script>document.addEventListener("keydown",e=>{if(["ArrowRight","PageDown"].includes(e.key)){e.preventDefault();window.scrollBy({top:744,behavior:"smooth"});}if(["ArrowLeft","PageUp"].includes(e.key)){e.preventDefault();window.scrollBy({top:-744,behavior:"smooth"});}});</script></body></html>'
    (ROOT / 'docs/defense-v5.ko.html').write_text(html)

    hashes = [('protocol-v5.json', phash), ('benchmark-v5.json', bhash), ('rolling-v5.json', rhash), ('certificate-input-v5.json', cihash), ('certificate-v5.json', chash)]
    provenance = mdtable(['원자료', 'SHA-256'], [[p, '`' + (h or 'pending') + '`'] for p, h in hashes])
    notes = ['# PortPlan V5 — English understanding notes for the Korean research draft', '', f'Generated {generated}. State: {state}. Research drafts do not establish entrant authorship, registration, or permission for English delivery.', '']
    for i, s in enumerate(slides, 1):
        notes += [f'## {i:02d}. {s["title"].replace("<br>", " ")}', '', s['notes'], '']
    notes += ['## Reading the static results', '', mdtable(static_headers, static_rows), '', mdtable(pair_headers, pair_rows), '',
              'Positive static differences use baseline incremental modeled fees minus V5 incremental fees. The rolling tradeoff instead uses total lifecycle fees. A null or zero denominator does not become a percentage.', '',
              '## Reading the execution results', '', mdtable(rolling_headers, rolling_rows), '', mdtable(trade_headers, trade_rows), '',
              'The fixed V5 seeds are new but their generator is shared with the V4 development panel. No external company data or temporal business holdout is implied. Stable retention is not a current optimality proof.', '',
              denominator_note, '', initial_note, '',
              '## Archive binding', '', provenance, '',
              '## Reproduction', '', 'Run `node scripts/benchmark-v5.mjs --output artifacts/benchmark-v5-reproduction.json` to create a separate result. Use `python scripts/certify-v5.py --archive artifacts/benchmark-v5-reproduction.json` to flatten and certify all 36 primary plus six repeated-input controls into separate artifacts. Do not overwrite protected first-run data. `python scripts/build-defense-v5.py --require-results` binds these submission drafts to the named archived JSON, certificate input, and evidence bindings.', '']
    (ROOT / 'docs/defense-v5.en.md').write_text('\n'.join(notes))
    results_para = 'V5 실험은 아직 완료되지 않아 성과 수치를 제시하지 않는다.'
    if br:
        p = comparisons['fastVsV4']
        results_para = f"새 생성 seed {n}개에서 완전 후보는 기본 MILP {bs['byPolicy']['rawMILP']['feasibleCount']}개, V4 직접 날짜 탐색 {bs['byPolicy']['v4EventSearch']['feasibleCount']}개, V5 fastEvent {bs['byPolicy']['fastEvent']['feasibleCount']}개였다. V4와 V5 모두 완료한 {p['pairedCaseCount']}개 쌍에서 기준−V5 추가비용 합은 {money(p['incrementalSavingsKRW'])}, 가중 차이는 {pct(p['weightedIncrementalSavingsPct'])}이고 낮음/같음/높음은 {p['positiveSavingsCount']}/{p['tiedCount']}/{p['negativeSavingsCount']}개다."
    if rr:
        results_para += f" 별도 {rn}개 실행 경로에서 매일 재최적화 {rs['byMethod']['dailyReopt']['completeCount']}개, 유효 계획 유지 {rs['byMethod']['stableRetain']['completeCount']}개가 완료했다. 두 정책 모두 완료한 {rtrade[0]}개 쌍의 날짜 변경은 {paired_change_base}→{paired_change_stable}회({pct(change_reduction_pct)} 감소), 유지 비용 증가는 {money(premium)}였다. 총비용 분모 {money(total_base)}에서는 {pct(total_premium_pct, 6)}, 추가비용 분모 {money(incremental_base)}에서는 {pct(incremental_premium_pct, 6)}다. 전체 {rn}경로 solver 호출은 {rs['byMethod']['dailyReopt']['solverCalls']}→{rs['byMethod']['stableRetain']['solverCalls']}이나 호출 수가 달라 총 계산 동예산으로 해석하지 않는다."
    report = f'''# 공개 단계요율 아래의 빠른 완전 후보 구성과 유효 실행계획 유지

**PortPlan V5 한글 연구보고서 초안** · {state} · 생성 {generated}

본 자료의 조사·코드·실험 준비·설명 초안은 AI가 자율 수행했다. 제출자 본인이 직접 개발·검증한 것이라고 표시하지 않는다. 참가 자격, 등록 및 생성형 AI 조건의 확인 기록도 아니다.

## 초록

PortPlan V5는 PNC 소급형 보관료와 명시한 Maersk Korea 해석을 고려한 일별 반출·적출·공컨테이너 반납 계획에서 빠른 완전 후보와 안정적인 실행 날짜의 가치를 연구한다. 반출·반납 날짜 비용 캐시와 증분 자원 배열로 구성하고, 정적 총 1,000ms 중 최대 200ms 구성 후 V4 날짜 탐색을 실행한다. 별도 안정 정책은 현재 snapshot과 실행 이력에 유효한 날짜를 유지하고 처음 또는 무효일 때만 다시 푼다. {results_para} 같은 생성 메커니즘의 새 seed 비교이지 외부 기업·실제 업무 기간 검증은 아니며 실제 고객 절감이나 최초 알고리즘을 주장하지 않는다.

## 1. 문제와 변경 동기

반출과 반납은 운송을 공유하고 연속 적출 및 대기 공간이 계획을 결합한다. PNC 최고 도달 단가의 소급 적용은 하루의 연기가 큰 차이를 만들 수 있다. 20′ 14일 318,500원, 15일 500,500원의 차이는 182,000원이며 15일 금액은 [PNC 공식 PDF](https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf) 산례와 일치한다. 이것은 규칙 예시이지 V5 성과나 실제 청구서가 아니다.

V4 개발 실험은 전처리 결합이 강한 직접 날짜 탐색보다 비용상 우세하지 않음을 보였다. V5는 완전 후보 구성 비용과 불필요한 날짜 변경을 줄이는 두 질문으로 이어진다. V4 음성 결과를 지우거나 V4/V5 패널을 합쳐 성과를 산출하지 않는다.

## 2. 자료, 모형과 범위

PNC 공개 요율·무료기간·08:00 경계는 공식 자료에 근거한다. 한국 Maersk 구간 간 일일 누적은 밝혀 둔 모델 해석으로 현행 계약 확정 산식이라고 표시하지 않는다. 차량 게이트 시간은 실제 관측의 별도 오차 검증이고 PNC 주문이나 반납 생애주기가 아니다. V5 주문, 용량, 장애는 생성 설정이다.

모형은 각 상자의 반출 p, 적출 시작 u, 반납 r을 모두 선택한다. 방출 가능일·화물 기한·연속 적출·반납 지연·전체 기간 종료를 지키며, 반출/반납 각 운송 1회, 적출 중 창고 슬롯, [p,r) 대기 슬롯을 쓴다. 목표는 Σ(PNC+D&D−계획 전 고정 발생액)다. 고정 발생액 차감은 최적 날짜를 바꾸지 않는다. 완전 검산 후보만 비용을 갖고 부분 결과는 null이다. 경로·기사 운행·예약·새 주문·세금·개별 계약은 구현하지 않는다.

## 3. V4 개발집합과 V5 새 seed의 관계

V4 결과를 보고 방법을 개발했으므로 V4는 독립 테스트로 제시하지 않는다. V5 정적 패널은 새 고정 36 seed, 안정 실행은 별도 새 고정 24 경로다. 같은 기존 합성 생성 메커니즘을 사용한다. 따라서 생성기 내부 seed 분리이며 외부 기업 자료, 시간상 업무 holdout 또는 다른 분포의 일반화 검증이 아니다. 프로토콜은 결과 전에 고정하고 전체 사례와 실패를 유지한다. 내부 해시와 저장 순서는 외부 사전등록을 의미하지 않는다.

## 4. 정적 방법과 계산 예산

`solveFastConstructor`는 상자마다 날짜 요금 배열을 계산해 trip 반복 중 날짜 파싱을 피한다. 구성 시도마다 한 번 정렬하고 운송/창고/대기 배열을 증분 갱신하며 한정 rollback repair와 재시작을 사용한다. 완전 일정이 주 엔진 검산을 통과할 때만 후보가 된다. 날짜비용 준비·구성도 예산 안이다. 기존 캐시, 자원 증분 업데이트 및 이웃 탐색 기법의 응용이지 새로운 일반 최적화 패러다임이 아니다.

fastEvent는 콜드 시작 1,000ms 전체 예산 안에서 초기 구성 최대 200ms, 그 뒤 남은 시간에 V4 직접 날짜 탐색을 쓴다. 기본 MILP와 V4 날짜 탐색을 같은 부모 강제 한도로 비교하며 로딩·초기 해·검산·IPC 수신을 포함한다. 순서를 회전하고 한 번에 한 방법만 실행한다. 한도 전 받은 검산 후보만 보존하고 종료된 solve의 증명은 유지하지 않는다. 이 정적 구성기는 실행 lock을 지원하지 않으며 안정 정책의 초기 solver를 대체했다고 주장하지 않는다.

{mdtable(static_headers, static_rows)}

끝까지 받은 부모 wall time의 통상 중앙값(짝수 건수는 중앙 두 값 평균):

{mdtable(['방법', 'wall time 중앙값'], time_rows)}

{mdtable(pair_headers, pair_rows)}

가중 차이는 Σ(기준 추가비용−V5 추가비용)/Σ기준 추가비용이다. 완전 쌍 집합이 행마다 다를 수 있으며, 음수는 V5가 더 비쌈을 뜻한다. 추가비용의 분모를 전체 생애주기 비용으로 바꾸어 표기하지 않는다.

{mdtable(['기준', '0원 기준 쌍', '기준 누락', 'V5 누락', 'V5 최악 손실'], pair_detail_rows)}

### 별도 3초 보충 패널

선언한 보충 패널은 주 패널의 100개 상자 주문을 재사용하고 같은 세 정책에 3초를 준다. 새로운 독립 입력이나 1초 주 성과에 합산하지 않는다. 실행 시간 확대의 참고이며 1초 실패를 사후 삭제하는 구실이 아니다.

{mdtable(['보충 사례', '원래 주 사례', *[LABELS[m] for m in METHODS]], scale_rows)}

## 5. 실행 이력과 유효 계획 유지

매일 정책은 모든 초기 주문과 오늘까지의 관측 용량, 고정 실행 이력만 받는다. 공개 전 실제 미래 장애 및 기간은 숨기고 미래 용량은 명목 예측한다. 반출·적출 시작·반납 이력은 바꾸지 않는다. 시작한 연속 작업의 점유도 유지한다. 후보를 검산한 뒤 오늘 사건만 실행한다. 동일 관측 과거에 다른 미공개 미래를 주는 prefix 검사는 계속 적용한다.

stableRetain은 각 에피소드에 저장한 완전 날짜 계획을 현재 snapshot과 고정 사건/최소 사건 날짜에 재검산한다. 비용도 현재 요율로 다시 계산한다. 아직 유효하면 solver를 호출하지 않고 `retained_plan_not_reoptimized`를 기록한다. 처음이거나 무효면 기존 optimizer를 호출한다. 현재 더 낮은 비용 해가 있어도 유지할 수 있으므로 현재 최적 또는 무료 안정성으로 설명하지 않는다.

{mdtable(rolling_headers, rolling_rows)}

각 solve 내부 한도는 0.2초이고 초기화·모형 작성·검산을 포함한 엄격한 에피소드 전체 wall 한도가 아니다. 두 정책은 동일 관측과 이력 의미를 공유하나 solver 호출 횟수가 달라 총 CPU 동예산 비교가 아니다. 결과는 현재 고정 용량 장애와 알려진 초기 주문에 제한된다. 변경 횟수는 미실행 사건 날짜 변경이며 측정한 실제 작업비가 아니다.

{initial_note}

동일 optimizer와 입력이라도 두 초기 solve는 별도 호출이다. 시간 한도와 동률 선택에 따른 초기 날짜 차이를 숨기지 않는다. 초기 계획이 다르면 이후 비용/변경 차이 전체가 날짜 유지 규칙의 인과 효과라고 주장하지 않는다.

{mdtable(trade_headers, trade_rows)}

위 비용 차이는 모두 완료한 경로의 **총 생애주기 비용**으로 정적 추가비용과 다른 분모다. 실패 경로를 저비용 완료로 처리하지 않는다. 날짜 변경 감소와 비용 증가/완료 실패를 동시에 공개한다.

{denominator_note}

{mdtable(['동일 완전 쌍의 분모', '매일 기준액', '유지 추가액', '유지 증가율'], [['총 생애주기 비용', money(total_base), money(premium), pct(total_premium_pct, 6)], ['추가비용', money(incremental_base), money(premium), pct(incremental_premium_pct, 6)]])}

## 6. 독립 검산과 증명

Python/HiGHS는 JS 비용 함수·모형 계수를 가져오지 않고 날짜, 요율, 자원을 다시 계산하고 별도 trip-column 모형을 구축한다. 후보, 하한 및 최적 상태의 모순을 찾는다. 안전 정수 목표의 선언 증명 상태와 비정수 수치 허용오차 solver-optimal 상태를 구분한다. 내부 독립 구현이지 외부 인증·실제 계약 검증은 아니다. 추가 HiGHS 예산은 1초 정적 정책 비교 밖이다. 정적 증명은 rolling 이력 전체의 수학적 인증이 아니다.

{mdtable(['독립 확인', '결과'], cert_rows)}

검토 대상은 **{n}개 독립 생성 주 seed + {scale_n}개 주 입력 재사용 3초 제어**다. {n + scale_n}개 독립 주문 사례라고 하지 않는다. `certificate-input-v5.json`이 42개 기록을 평탄화하며 원래 archive 해시를 보존하고, 결과의 `inputSha256`과 `evidenceBindings`가 그 파일과 원 archive 및 프로토콜을 연결한다. 추가 2초/목표의 native 계산은 1초 정책 성공 건수에 합치지 않는다.

일부만 검토했다면 입력 순서 앞 N개임을 명시하고 제외 사례의 최적성은 주장하지 않는다. 미증명 유계 후보와 증명 없음은 실패와 별개다. 자세한 수치 의미는 `certificate-method-v4.md`를 참조한다.

## 7. 전체 결과와 실패

완전 정적 후보 없는 원래 상태를 유지한다.

{mdtable(['방법', '실패 상태', '사례 수'], failure_rows)}

전체 고정 정적 패널(칸: 추가비용 / 원래 상태):

{mdtable(['사례', *[LABELS[m] for m in METHODS]], all_static)}

`hard_time_limit`이라도 한도 전 검산 후보가 보존되면 비용은 유효할 수 있다. 이는 후보 실행 가능성이고 종료된 GLPK의 최적 증명이나 성공으로 바꾸지 않는다. null은 0원이 아니다.

전체 실행 경로(실패일은 0부터 시작):

{mdtable(['경로', *[LABELS[m] for m in ROLLING], '초기 날짜 비교'], all_rolling)}

유리한 사례만 선택하거나 실패 후 새 seed로 대체하지 않는다. 저장 실행 기록에 이미 수행한 사건은 남아 있고 사후 날짜 변경으로 지워지지 않는다.

## 8. 선례, 저자와 공식 규칙

적출/반납/D&D 연구, rolling drayage, ALNS, 증분 자원 구성과 상용 반출/반납 예약 매칭에는 선례가 있다. 읽기 깊이와 한계는 `prior-art-v2.md`, `research-roadmap-v4.md`에 있다. 공개 한국 요율과 실행 상태, 강한 예산 비교, 실패 보존 및 독립 검산을 결합한 확인 가능한 응용을 주장한다. 최초·세계 최고·PNC 배치·실현 기업 절감·1위 확률은 주장하지 않는다.

본회차 조사·개발·초안은 AI가 자율 수행했다. 사용자 본인이 작성하거나 실험 재현, 원문 검증, 발표 습득을 완료했는지는 확인되지 않았다. `contribution-log-v5.md`는 실제 AI 및 오픈소스 기여를 구분하며 이를 본인 독창적 성과로 대신 기재하지 않는다.

[2026 공식 페이지](https://anchor.changwon.ac.kr/main/menu?gc=Program&do=sinform&spod=s1&program_id=VKoDUNlZwONq&psin_id=VKoDUNlMqh4n)는 11월 6일 18:00 자료 마감, 11월 13일 1차심사, 11월 20일 발표, 보고서 및 전 데이터/코드, 발표자료 ≤20쪽을 명시한다. 10월13일 재확인에서 페이지와 포스터는 동일했고 AI, 당해 창작 서약, 단독 팀, 영어, 점수표에 새 공개 설명은 없었다. 정원 40명은 총 정원이지 남은 자리 수가 아니다. 2025 직접 창작·대리 작성 금지 서약은 역사 근거이고 2026 적용/AI 해석은 미확인이다. 이 자료는 가입·등록·작성자 승인 기록이 아니다.

## 9. 재현과 파일 연결

```bash
node scripts/benchmark-v5.mjs --output artifacts/benchmark-v5-reproduction.json
node scripts/rolling-benchmark-v5.mjs --output artifacts/rolling-v5-reproduction.json
python scripts/certify-v5.py --archive artifacts/benchmark-v5-reproduction.json
python scripts/build-defense-v5.py --require-results
```

원래 first-run archive를 덮어쓰지 않는다. 다시 실행한 결과는 계산 부하에 따라 달라질 수 있으며 원래 수치와 혼합하지 않는다. 이 생성기는 명명된 저장 V5 데이터에만 연결되고 실험을 실행하지 않는다. 아래 해시는 생성일이 아닌 실제 파일 바이트를 식별한다.

{provenance}

16쪽 HTML: `docs/defense-v5.ko.html`. 이해용 영문: `docs/defense-v5.en.md`. V4 파일은 보존한다. 발표 자격 및 본인 기여를 확인하기 전 연구자료 초안으로 유지한다.
'''
    (ROOT / 'docs/submission-v5.ko.md').write_text(report)
    print(json.dumps({'slides': 16, 'state': state, 'benchmarkReady': br, 'rollingReady': rr, 'certificateReady': cr,
                      'generatedAt': generated, 'sourceHashes': dict(hashes)}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, TypeError, KeyError) as error:
        print('Build refused: ' + str(error), file=sys.stderr)
        raise SystemExit(2)
