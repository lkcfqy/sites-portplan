#!/usr/bin/env python3
"""Build source-bound Korean contest materials; no predicted numerical results.

Run with --require-results for the final research build. This validates frozen
panel completeness and input hashes, but never attests entrant eligibility.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
from html import escape
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
METHODS = ("permutation", "eventSearch", "rawMILP", "presolveMILP")
LABELS = {
    "permutation": "순열 탐색", "eventSearch": "직접 날짜 탐색",
    "rawMILP": "기본 MILP", "presolveMILP": "검증 후보 + 전처리 MILP",
    "static": "원계획 유지", "staticPlan": "원계획 유지",
    "rolling": "인과적 일별 재계획", "rollingReplan": "인과적 일별 재계획",
    "clairvoyant": "사후 전체정보 재계획", "oracle": "사후 전체정보 재계획",
    "hindsight": "사후 전체정보 참고",
}
SOURCES = {
    "pnc": "https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf",
    "contest": "https://anchor.changwon.ac.kr/main/menu?gc=Program&do=sinform&spod=s1&program_id=VKoDUNlZwONq&psin_id=VKoDUNlMqh4n",
    "maersk": "https://www.maersk.com/local-information/asia-pacific/south-korea/import",
}


def load(name):
    path = ROOT / "data" / name
    if not path.exists():
        return None, None
    raw = path.read_bytes()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def integer(value):
    return "—" if value is None else f"{value:,}"


def money(value):
    return "—" if value is None else ('−' if value < 0 else '') + f"₩{abs(value):,.0f}"


def pct(value):
    return "—" if value is None else f"{value:.2f}%"


def label(key):
    return LABELS.get(key, key)


def table(headers, rows):
    return '<table><thead><tr>' + ''.join(f'<th>{escape(str(v))}</th>' for v in headers) + '</tr></thead><tbody>' + ''.join(
        '<tr>' + ''.join(f'<td>{escape(str(v))}</td>' for v in row) + '</tr>' for row in rows) + '</tbody></table>'


def mdtable(headers, rows):
    return '\n'.join(['| ' + ' | '.join(headers) + ' |', '| ' + ' | '.join('---' for _ in headers) + ' |'] +
                     ['| ' + ' | '.join(str(v).replace('|', '/') for v in row) + ' |' for row in rows])


def cards(items):
    return '<div class="cards">' + ''.join(f'<article><strong>{escape(str(v))}</strong><p>{escape(t)}</p></article>' for v, t in items) + '</div>'


def callout(text):
    return '<div class="callout">' + text + '</div>'


def bullet(items):
    return '<ul>' + ''.join(f'<li>{v}</li>' for v in items) + '</ul>'


def two(left, right):
    return '<div class="two"><div>' + left + '</div><div>' + right + '</div></div>'


def ready(payload):
    return bool(payload and payload.get('executionState') == 'complete')


def feasible(policy):
    # A hard-time-limit checkpoint is feasible, even though the solve did not
    # complete. Keep availability and optimality separate as the runner does.
    return bool(policy and policy.get('rows') and policy.get('incrementalCost') is not None and
                policy.get('totalCost') is not None and policy.get('auditValid') is True)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--require-results', action='store_true')
    args = parser.parse_args(argv)
    protocol, protocol_hash = load('protocol-v4.json')
    benchmark, benchmark_hash = load('benchmark-v4.json')
    rolling, rolling_hash = load('rolling-v4.json')
    rolling_protocol, rolling_protocol_hash = load('rolling-protocol-v4.json')
    certificate, certificate_hash = load('certificate-v4.json')
    if not protocol:
        raise ValueError('Frozen data/protocol-v4.json is required.')
    bready = ready(benchmark)
    rready = ready(rolling)
    cready = bool(certificate and certificate.get('summary'))
    if bready:
        if benchmark.get('protocolHash') != protocol_hash:
            raise ValueError('Benchmark protocol hash does not match current frozen bytes.')
        frozen_ids = [c['id'] for c in protocol['primaryCases']]
        if [c['id'] for c in benchmark['cases']] != frozen_ids:
            raise ValueError('Benchmark cases differ from frozen full panel/order.')
        if any(set(c['policies']) != set(METHODS) for c in benchmark['cases']):
            raise ValueError('Each frozen case must retain all four methods.')
        for method in METHODS:
            count = sum(feasible(c['policies'][method]) for c in benchmark['cases'])
            if count != benchmark['summary']['byPolicy'][method]['feasibleCount']:
                raise ValueError('Benchmark availability summary does not match archived rows.')
    if rready:
        if not rolling_protocol or rolling.get('protocolHash') != rolling_protocol_hash:
            raise ValueError('Rolling protocol hash does not match frozen bytes.')
        if [c['id'] for c in rolling['cases']] != [c['id'] for c in rolling_protocol['cases']]:
            raise ValueError('Rolling result does not contain the full frozen panel.')
    if cready and bready and certificate.get('inputSha256') != benchmark_hash:
        raise ValueError('Certificate is not bound to the current benchmark bytes.')
    if args.require_results and not (bready and rready and cready):
        raise ValueError('Final build requires complete benchmark-v4, rolling-v4 and certificate-v4 inputs.')
    completed = bready and rready and cready
    state = 'V4 결과 파일 기반 연구자료 초안' if completed else 'V4 구조 초안 · 실험 결과 확정 대기'
    generated = datetime.now(timezone.utc).isoformat(timespec='seconds')
    bsummary = benchmark.get('summary', {}) if bready else {}
    rsummary = rolling.get('summary', {}) if rready else {}
    csummary = certificate.get('summary', {}) if cready else {}
    bounded_count = (sum(c.get('certificateStatus') in ('feasible_with_bound', 'feasible_only')
        for case in certificate.get('cases', []) for c in case.get('certificates', {}).values()) if cready else None)
    ncases = len(protocol['primaryCases'])
    budget_ms = protocol['budget']['hardWallMs']

    benchmark_rows = []
    for method in METHODS:
        item = bsummary.get('byPolicy', {}).get(method, {})
        benchmark_rows.append([label(method), f"{integer(item.get('feasibleCount'))} / {ncases}",
            integer(item.get('provenOptimalCount')), integer(item.get('hardDeadlineCount')),
            integer(item.get('retainedCheckpointCount'))])
    comparison_keys = ['presolveVsPermutation', 'presolveVsEventSearch', 'presolveVsRawMILP', 'eventVsPermutation']
    pair_rows = []
    for key in comparison_keys:
        c = bsummary.get('comparisons', {}).get(key)
        if not c:
            continue
        pair_rows.append([label(c['candidateMethod']) + ' / ' + label(c['baselineMethod']),
            integer(c['pairedCaseCount']), f"{c['positiveSavingsCount']} / {c['tiedCount']} / {c['negativeSavingsCount']}",
            money(c['incrementalSavingsKRW']), pct(c['weightedIncrementalSavingsPct'])])
    pair_headers = ['비교: 후보 / 기준', '완전 쌍', '낮음 / 같음 / 높음', '기준−후보 합계', '가중 차이']
    if not pair_rows:
        pair_rows = [['실험 완료 후 원자료에서 생성', '—', '—', '—', '—']]
    cert_rows = [
        ['독립 검토 사례', f"{integer(csummary.get('caseCount'))} / {integer(csummary.get('inputCaseCount'))}"],
        ['후보 일정 비용·제약 검토', integer(csummary.get('auditedCandidateCount'))],
        ['검토 오류 사례', integer(csummary.get('failedCaseCount'))],
        ['독립 최적 증명 / 불가능 증명', integer(csummary.get('provenOptimalCount')) + ' / ' + integer(csummary.get('provenInfeasibleCount'))],
        ['미증명 후보 / 허용오차 최적', integer(bounded_count) + ' / ' + integer(csummary.get('solverOptimalWithNumericToleranceCount'))],
        ['증명 없음 / 제외 사례', integer(csummary.get('noCertificateCount')) + ' / ' + integer(csummary.get('omittedCaseCount'))],
    ]

    # Rolling schema is an explicitly recorded summary, never an invented run.
    rolling_rows = []
    for key, item in rsummary.get('byMethod', {}).items():
        rolling_rows.append([label(key), integer(item.get('completeCount', item.get('feasibleCount'))),
                             integer(item.get('caseCount', rsummary.get('caseCount'))),
                             integer(item.get('failureCount')), integer(item.get('changes'))])
    if not rolling_rows:
        rolling_rows = [['실험 완료 후 원자료에서 생성', '—', '—', '—', '—']]
    roll_headers = ['정책', '완전 실행', '전체', '실패', '미실행 날짜 변경']
    rolling_paired = ('완전 실행 결과 확정 대기.' if not rready else
        f"원계획·일별 재계획이 모두 끝난 {rsummary['pairedCount']}개 쌍의 최종 비용 차이: {money(rsummary['pairedDifference'])}. "
        f"원계획 실패에서 재계획이 완료한 경로: {len(rsummary['recoveredCases'])}개.")
    rolling_failure_rows = []
    if rready:
        for case in rolling['cases']:
            for method, result in case['policies'].items():
                if not result.get('complete', False):
                    failure = result.get('failure') or {}
                    rolling_failure_rows.append([case['id'], label(method), failure.get('day', '—'),
                                                 failure.get('kind', result.get('status', 'unknown'))])
    if not rolling_failure_rows:
        rolling_failure_rows = [['전체', '—', '—', '실패 없음' if rready else '결과 확정 대기']]

    failure_counts = Counter()
    if bready:
        for case in benchmark['cases']:
            for method, result in case['policies'].items():
                if not feasible(result):
                    failure_counts[(label(method), result.get('status', 'missing'))] += 1
    failure_rows = [[method, status, count] for (method, status), count in sorted(failure_counts.items())]
    if not failure_rows:
        failure_rows = [['전 방법', '미완료 결과 없음' if bready else '결과 확정 대기', '0' if bready else '—']]
    # All groups stay in the report; slide aggregates each policy to fit the page.
    fail_by_method = {method: sum(count for (name, _), count in failure_counts.items() if name == label(method)) for method in METHODS}
    failure_slide_rows = [[label(method), integer(fail_by_method[method]) if bready else '—',
                           ', '.join(f'{status}:{count}' for (name, status), count in failure_counts.items() if name == label(method)) or ('없음' if bready else '확정 대기')]
                          for method in METHODS]
    all_case_rows = []
    if bready:
        for case in benchmark['cases']:
            row = [case['id']]
            for method in METHODS:
                result = case['policies'][method]
                row.append((money(result['incrementalCost']) + ' / ' + result['status']) if feasible(result)
                           else 'null / ' + result['status'])
            all_case_rows.append(row)
    if not all_case_rows:
        all_case_rows = [['전체 고정 패널 결과 대기', '—', '—', '—', '—']]

    slides = []
    def slide(kicker, title, body, footer, notes):
        slides.append({'kicker': kicker, 'title': title, 'body': body, 'footer': footer, 'notes': notes})

    slide('LOGISTICSOLVER 2026 · PUBLIC EVIDENCE', '요금이 급등하기 전에,<br>실행 가능한 순서를 정합니다.',
        '<p class="hero">PortPlan<br><span>수입 컨테이너 반출·적출·공컨테이너 반납 통합 일정계획</span></p>' +
        '<div class="pills"><span>공개 요율</span><span>이력 고정 재계획</span><span>동일 계산 예산</span><span>독립 검산</span></div>' +
        f'<p class="small">{escape(state)} · 실제 기업 절감률이나 수상 가능성을 주장하지 않습니다.</p>',
        '공개자료 기반 일별 모델 · 제출자 자격 및 본인 기여 확인 전 연구자료',
        'PortPlan is a public-evidence daily planning prototype. The work links exact published fee rules, feasible lifecycle plans, and execution-aware replanning. This is a research draft: it does not promise a first-place result or realized customer savings.')

    slide('01 / DECISION', '오늘의 반출 결정이<br>다른 상자의 반납도 바꿉니다.',
        two('<h2>실무적 충돌</h2>' + bullet(['요금 단계가 바뀌면 하루의 비용이 크게 증가', '반출과 공컨테이너 반납이 같은 운송 능력을 사용', '적출 중인 상자는 창고와 대기 공간을 점유']),
            '<h2>검증할 질문</h2>' + bullet(['제한된 시간에 완전한 일정을 찾는가?', '진행한 작업을 유지하며 장애 후 재계획하는가?', '조건부 비용 차이와 실패를 재현할 수 있는가?'])) +
        callout('가정: 일반 20′/40′ 드라이 컨테이너 · 확정 주문 · 일별 용량 · 유한 계획기간'),
        '일별 작업 모형; 도로 경로·실시간 예약·세금·개별 계약은 범위 밖',
        'Pickup and return share transport capacity; unloading and staging create further interactions. We ask whether a complete schedule is available under limited computation, whether executed actions survive replanning, and which modeled cost differences can be reproduced. This is a daily model, not a route or appointment system.')

    slide('02 / FEE MECHANISM', '14일에서 15일로 넘어갈 때<br>하루 비용은 182,000원입니다.',
        cards([('₩318,500', '14일: (14−4) × 31,850'), ('₩500,500', '15일: (15−4) × 45,500'), ('+₩182,000', '하루 연기의 모델 비용 차이')]) +
        '<p>PNC 공개 요율은 <b>도달한 최고 단계의 단가를 모든 유료 일수에 소급 적용</b>합니다. 매일 단계별 단가를 합산하면 이 결정 경계가 달라집니다.</p>' +
        '<p class="small">20′ = 1 TEU · 40′ = 2 TEU. 양하가 08:00 전이면 당일부터, 08:00 이후면 다음 날부터 계산합니다.</p>' +
        callout('15일 금액은 공식 PDF의 산례와 일치합니다. 14→15일 차이는 공개 규칙에서 계산한 예시이며 실제 청구서가 아닙니다.'),
        'PNC 2026 Standard Tariff pp. 3–4 · 2026-01-01 효력 · VAT/개별 계약 제외',
        'For a twenty-foot box, fourteen storage days cost 318,500 won and fifteen cost 500,500 won. The 182,000 won increase arises because the highest rate applies retrospectively to all chargeable days. The fifteen-day amount matches the official worked example; the difference is our calculation, not an observed invoice.')

    slide('03 / EVIDENCE', '규칙, 관측, 생성 주문을<br>서로 다른 증거로 다룹니다.',
        table(['증거', '확인한 내용', '확인하지 못한 내용'], [
            ['PNC 공개 PDF', '요율·4일 무료·08:00 경계', '화주 조회 페이지의 구요율 충돌'],
            ['Maersk Korea', '공개 구간 요율·기산/종료일', '한국의 구간 간 누적 계산 산례'],
            ['공개 차량 게이트 기록', '진입/진출 시간·별도 오차 검증', 'PNC 주문·계약·반납 생애주기'],
            ['V4 생성 실험', '같은 입력의 정책 비교', '현실 고객 대표성·실현 절감'],
        ]) + callout('Maersk 단계별 일일 누적은 공개적으로 밝힌 모델 해석입니다. 계약상 확정 산식이라고 표시하지 않습니다.'),
        'source-audit.md · rules-status-v2.md · public-gate-validation-v3.md',
        'Each source supports a different claim. Official tariffs support narrow billing rules; public gate observations validate a separate duration component; synthetic orders compare planning policies. Korea-specific cross-band D&D accumulation remains a disclosed interpretation. None of these records establishes realized PNC customer savings.')

    slide('04 / MODEL', '반출부터 반납까지<br>모든 작업을 끝내야 유효합니다.',
        '<div class="flow"><b>반출 p</b><span>→</span><b>적출 시작 u</b><span>→</span><b>공컨테이너 반납 r</b></div>' +
        two('<h2>작업 순서와 기한</h2>' + bullet(['통관/방출 가능일 ≤ p ≤ u', '적출 종료 ≤ 화물 인도 기한', '적출 종료 및 명시된 지연 ≤ r < 계획 종료']),
            '<h2>하루 자원 사용</h2>' + bullet(['반출·반납 각각 운송 1회', '적출 기간 창고 슬롯 1개', '반출일부터 반납 전일까지 대기 슬롯'])) +
        '<p class="formula">min Σ (PNC 보관료 + D&amp;D − 계획 전 고정 발생액)</p>' +
        '<p class="small">고정 발생액 차감은 일정의 최적 순서를 바꾸지 않습니다. 모든 상자를 검산한 완전 일정만 비용 비교에 들어갑니다.</p>',
        'src/engine.js · src/solver-glpk.js · 일별 원자적 작업, 하루 내 이동 순서 제외',
        'The objective subtracts a fixed pre-horizon fee base; this does not alter the optimizer. Pickup and return consume one movement each, unloading occupies consecutive daily slots, and staging lasts from pickup until the return day, excluding that return day. Partial schedules have null costs and never count as success.')

    slide('05 / METHODS', '날짜를 직접 바꾸고,<br>검증한 후보는 보존합니다.',
        two('<h2>더 강한 직접 날짜 탐색</h2><p>순열의 가장 빠른 해독 결과만 바꾸는 대신, 상자별 <b>(p, u, r)</b> 날짜와 소규모 삭제·재삽입을 탐색합니다.</p><p>완전 일정이 검산될 때만 후보를 갱신합니다.</p>',
            '<h2>안전한 선택지 축소</h2><p>상자별 독립 최소비용 합은 하한입니다. 한 사건을 고정한 하한이 검증 후보의 비용보다 크면 그 날짜를 제거합니다.</p><p>정확한 정수 하한 달성은 별도 수학적 증명으로 표시합니다.</p>') +
        callout('검증 후보 + 전처리 MILP는 합성 정책입니다. 후보 반환을 GLPK 성공이나 MIP warm start로 바꾸어 표기하지 않습니다.'),
        'event-search-v4.js · solver-presolver.js · 기존 LNS/정수계획 기법의 응용',
        'Direct search explores actual event dates and bounded destroy/repair neighborhoods. Safe preprocessing uses separately feasible trip minima and an audited upper bound. It removes a date only if its conditional lower bound exceeds that upper bound. A retained heuristic is not a GLPK solution, and a cutoff is not a MIP warm start. Exact integer lower-bound attainment is a separately labeled proof.')

    slide('06 / CAUSAL ROLLING', '미래 장애를 알려주지 않고<br>오늘의 작업만 실행합니다.',
        '<div class="flow"><b>오늘 용량 관측</b><span>→</span><b>이력 고정</b><span>→</span><b>검산·오늘 실행</b><span>→</span><b>기록</b></div>' +
        two('<h2>변경할 수 없는 사실</h2>' + bullet(['실제로 반출한 날짜', '이미 시작한 연속 적출 작업', '이미 반납한 날짜와 최종 작업 기록']),
            '<h2>계획자가 받는 정보</h2>' + bullet(['시작 시 알려진 전체 생성 주문', '오늘까지 관측·공고된 용량', '미공개 미래 용량은 명목 예측'])) +
        callout('같은 관측 과거에서 미공개 미래만 바꾼 prefix 검사로 정보 누출을 확인합니다. 전체정보 사후 해는 온라인 성과와 분리합니다.'),
        'src/rolling-plan.js · 하루 시작 관측 · 전체 고정 horizon · 미래 실제 경로 비공개',
        'All orders are known at the beginning. Only future capacity shocks are withheld. At each day start, the planner receives observed capacity and immutable executed events; unrevealed future capacity remains nominal. It audits a full remaining plan but executes only today. A clairvoyant re-solve is a separate reference, not an online policy.')

    slide('07 / FROZEN BUDGET', '초기화부터 검산까지<br>네 방법에 같은 시간 한도를 둡니다.',
        cards([(str(ncases), '3 발생 메커니즘 × 2 용량 × 3 규모'), ('16 / 50 / 100', '각 셀 고정 새 seed 1개'), (f'{budget_ms} ms', '부모 프로세스의 강제 wall budget')]) +
        '<p>프로세스 생성, 코드/GLPK 로딩, 초기 해, 전처리, 모델 구성, 계산, 검산, 결과 수신을 모두 포함합니다. 한 번에 한 방법만 실행하고 방법 순서를 회전합니다.</p>' +
        '<p class="small">한도 전에 받은 검산 후보만 유지합니다. 강제 종료 후 최적 증명은 인정하지 않습니다. 종료 전달 오버헤드는 별도 기록합니다.</p>',
        f'data/protocol-v4.json · SHA-256 {protocol_hash[:20]}… · 내부 사전 고정, 외부 사전등록 아님',
        f'The frozen panel contains {ncases} synthetic stress cells and all four methods receive a {budget_ms} millisecond parent-enforced budget. Startup, initial policies, solver loading, preprocessing, model construction, audit, and IPC delivery all count. Only an audited checkpoint delivered before the deadline survives a kill; no interrupted optimality proof is retained. Host load and exit-delivery overhead remain visible.')

    slide('08 / AVAILABILITY RESULTS', '비용보다 먼저<br>완전 일정이 있는지 확인합니다.',
        table(['방법', '완전 검산 / 전체', '최적 증명', '강제 한도', '보존 후보'], benchmark_rows) +
        callout('완전 일정이 없는 결과의 비용은 null입니다. 후보 보존은 실행 가능성 확보이며 전역 최적 증명이 아닙니다.') +
        '<p class="small">네 방법의 결과를 각각 공개합니다. 사례마다 최저 방법을 사후 선택해 단일 알고리즘의 성능으로 바꾸지 않습니다.</p>',
        'benchmark-v4.json → summary.byPolicy · 모든 고정 사례와 실패 유지',
        'Read each method separately. Complete audited schedules, completed optimality proofs, hard deadline terminations, and retained checkpoints measure different things. A candidate preserved before a kill can be feasible without proving optimal. We do not present a hindsight best-of-methods selection as the performance of a single algorithm.')

    slide('09 / PAIRED COSTS', '전처리 결합은 이 패널에서<br>직접 날짜 탐색보다 비쌌습니다.' if bready and bsummary['comparisons']['presolveVsEventSearch']['incrementalSavingsKRW'] < 0 else '양쪽이 모두 완료한 경우만<br>동일한 비용으로 비교합니다.',
        table(pair_headers, pair_rows) +
        '<p class="small">가중 차이 = Σ(기준 추가비용−후보 추가비용) / Σ기준 추가비용. 각 행은 서로 다른 완전 쌍 집합입니다. 음수면 후보가 더 비쌉니다.</p>' +
        callout('0원 기준은 백분율을 만들지 않습니다. 완전 쌍 밖의 실패를 빼서 방법의 실행 가능성이 좋아진 것처럼 해석하지 않습니다.'),
        'benchmark-v4.json → summary.comparisons · 조건부 모델 결과, 실제 기업 절감률 아님',
        'Each row uses only cases in which both policies produced complete audited schedules. Its denominator is the sum of baseline incremental charges, not total lifecycle charges. Negative differences mean the candidate costs more; zero denominators remain undefined. Feasibility and missing pairs must be read alongside the cost table. No customer-population estimate follows from one seed per stress cell.')

    slide('10 / INDEPENDENT CHECK', '같은 코드를 두 번 호출하지 않고<br>비용과 모델을 다시 구성합니다.',
        two(table(['확인 항목', '기록'], cert_rows),
            '<h2>Python / HiGHS 독립 구현</h2>' + bullet(['JavaScript 요금 함수·계수 미사용', '완전 (p, u, r) trip 선택 모형', '공개 요율을 일별 합산으로 재계산', '후보·하한·최적 상태의 모순 검사'])) +
        callout('프로젝트 내부의 독립 구현입니다. 외부 인증이 아니며 별도 HiGHS 예산은 1초 비교 실험에 들어가지 않습니다.'),
        'certificate-method-v4.md · 비정수 요율의 solver-optimal은 수치 허용오차 상태로 별도 표시',
        'Python builds a separate trip-column model and computes fees without importing JavaScript coefficients or functions. It checks candidate costs and capacities and compares them with HiGHS bounds and audited incumbents. Safe-integer objectives support the declared exact proof status; noninteger tariff variants retain a numerical-tolerance solver-optimal status, not provenOptimal. This is internal implementation independence, not third-party certification. Its additional solver time is separate from the one-second comparison and it does not certify the full rolling history.')

    slide('11 / ROLLING RESULTS', '장애 대응은 전체 실행과<br>변경 비용을 함께 보고합니다.',
        table(roll_headers, rolling_rows) +
        f'<p>{escape(rolling_paired)}</p>' +
        callout('각 solve 0.2초, 정책별 호출 수는 다릅니다. 총 계산 동예산 비교가 아닙니다. 미래 전체정보 참고 해는 온라인 정책과 분리합니다.'),
        'rolling-v4.json · 고정 용량 장애 · 모든 주문은 시작 때 알려짐',
        'The rolling experiment reports complete executions, failure days, and revisions to unexecuted event dates. Costs are paired only after both policies complete all required lifecycle events. The per-solve GLPK limit is 0.2 seconds; rolling makes more planning calls and has no equal-total-computation claim. The rolling budget and information setting are separate from the static one-second challenge. Known orders and synthetic capacity shocks delimit the conclusion.')

    slide('12 / FAILURES', '실패와 비용 증가가<br>방법의 적용 범위를 보여줍니다.',
        table(['정적 방법', '완전 일정 없음', '원래 상태별 기록'], failure_slide_rows) +
        two('<p><b>한도 내 후보 없음</b><br>시간 안에 찾지 못함입니다. 수학적 불가능 증거가 아닙니다.</p>',
            '<p><b>실행 중 실패</b><br>이미 진행한 이력을 되돌릴 수 없습니다. 사후 가능한 해가 온라인 성공을 보장하지 않습니다.</p>') +
        '<p class="small">전체 사례별 상태·원인·비용은 원자료에 유지합니다. 최고 절감 사례를 대표 성과로 선택하지 않습니다.</p>',
        'benchmark-v4.json · rolling-v4.json · 부분 일정/미완료 결과는 비용 null',
        'Failures remain in the denominator and raw artifacts. A hard timeout without an incumbent is different from mathematical infeasibility. Replanning cannot undo physical history, and a feasible hindsight schedule does not imply online success. The deck does not select the best saving case as representative.')

    slide('13 / CONTRIBUTION BOUNDARY', '새로 검증한 결합을 설명하고<br>기존 연구를 인정합니다.',
        two('<h2>기존 선례</h2>' + bullet(['Jeong et al.: 적출·반납·D&D', '동적 drayage의 rolling horizon', 'LNS/ALNS와 MILP 전처리', '상용 반출/반납 예약 자동 매칭']),
            '<h2>이번 구현의 검증 대상</h2>' + bullet(['PNC 소급 단계요율의 정확한 반영', '일별 실행 이력 고정과 정보 차단', '직접 날짜 탐색의 강한 내부 비교', '전체 실패 기록과 독립 검산'])) +
        callout('알고리즘 최초·세계 최고·실제 PNC 배치·기업 절감 검증은 주장하지 않습니다. 도로 경로, 예약, 새 주문, 계약 세금은 후속 범위입니다.'),
        'prior-art-v2.md · research-roadmap-v4.md · 문헌별 실제 읽기 깊이 공개',
        'Joint lifecycle planning, uncertain D&D, rolling horizons, and neighborhood search all have direct precedents. The proposed contribution is an inspectable application of specific public Korean rules, daily execution state, equal-budget stress comparisons, and independent recalculation. We do not claim algorithmic firstness, market leadership, deployment, or verified enterprise savings.')

    slide('14 / REVIEWABLE DELIVERY', '한 번의 시연을<br>코드와 원자료로 다시 확인합니다.',
        two('<h2>현장 시연</h2><ol><li>공식 산례 재계산</li><li>생성 주문과 자원 충돌 확인</li><li>일정 생성·검산 및 작업표 내보내기</li><li>장애 공개 → 이력 고정 재계획</li></ol>',
            '<h2>제출 자료</h2>' + bullet(['보고서·데이터·코드·프로토콜', '원문 URL·수집일·SHA-256', '실패 상태와 모든 비교 사례', 'GLPK/HiGHS·오픈소스·AI 기여 기록'])) +
        '<pre>node scripts/benchmark-v4.mjs\npython scripts/certify-v4.py --input /…/data/benchmark-v4.json --max-cases 18\npython scripts/build-defense-v4.py --require-results</pre>',
        '재실행은 장비 부하에 따라 한도 내 결과가 달라질 수 있음; 저장 원자료와 실행 설정 별도 보존',
        'Demonstrate one complete cycle: verify a tariff example, inspect synthetic inputs, produce an audited plan, then reveal a capacity shock and replan with executed events locked. Provide the report, full inputs and outputs, frozen protocol, source hashes, dependencies, and contribution records. Runtime limits make re-execution device-dependent; archived results remain inspectable.')

    slide('15 / AUTHORSHIP & RULES', '연구자료는 준비하되<br>제출 자격과 기여를 꾸미지 않습니다.',
        two('<h2>당해 공식 공고</h2>' + bullet(['2026-11-06 18:00 자료 마감', '11-13 1차 심사 · 11-20 발표', '보고서·데이터/코드 전부 · 발표 ≤20쪽', '대상 1팀 / 경남도지사상']),
            '<h2>정직한 작성 상태</h2>' + bullet(['이번 구현·조사·초안은 AI가 자율 수행', '본인의 검증·자체 연구 기여는 확인되지 않음', '1인 팀·영어·AI 조건은 공개 확인 미완료', '2025 본인 창작·대리 작성 금지 서약은 역사 근거'])) +
        callout('이 자료는 참가 완료·작성자 자격 승인·본인 검증 완료를 의미하지 않습니다. 공식 당해 규정과 실제 기여를 확인해 제출해야 합니다.'),
        'competition-research-v4.md · contribution-log-v4.md · 당해 규칙 미확인 항목 유지',
        'The public 2026 notice sets the material deadline and a twenty-page maximum. Solo eligibility, English presentation, and AI conditions are unresolved. Most work in this round was carried out autonomously by AI. We do not claim that the entrant personally implemented or validated it. A historical 2025 pledge requires direct creation and prohibits proxy writing; its 2026 applicability and AI interpretation remain unverified. This research draft does not attest eligibility or completed registration.')

    assert len(slides) == 16
    css = '''
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#e7ecee;color:#16353f;font-family:"Noto Sans CJK KR","Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",Arial,sans-serif;font-size:25px;line-height:1.45;word-break:keep-all}.slide{width:1280px;height:720px;position:relative;margin:24px auto;padding:40px 62px 63px;background:#fbfcfa;box-shadow:0 10px 30px #18313c16;break-after:page;overflow:hidden}.slide:first-of-type{background:#123941;color:#f6faf6}.kicker{font-size:15px;letter-spacing:1.6px;font-weight:700;color:#288377}h1{font-size:43px;line-height:1.22;letter-spacing:-1.4px;margin:13px 0 24px;font-weight:800}.slide:first-of-type h1{font-size:57px}.slide:first-of-type .kicker{color:#8bd9c3}.hero{font-size:44px;font-weight:800;margin:34px 0 24px}.hero span{font-size:25px;font-weight:500}.small{font-size:18px;color:#536d72;margin:15px 0}.slide:first-of-type .small{color:#c1dcd8}.pills{display:flex;gap:13px;margin:25px 0}.pills span{padding:9px 16px;border:1px solid #659b91;border-radius:25px;font-size:20px}.two{display:grid;grid-template-columns:1fr 1fr;gap:34px}.two p,.two li{font-size:23px}p{margin:12px 0}h2{font-size:25px;color:#217f70;margin:8px 0 14px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin:7px 0 24px}.cards article{background:#e7f1ec;border-top:4px solid #3b9a82;padding:19px 20px}.cards strong{font-size:39px;letter-spacing:-1.2px;color:#157462}.cards p{font-size:20px;margin-bottom:0}.callout{border-left:5px solid #d49d36;background:#f6f0dc;padding:12px 17px;font-size:20px;margin:19px 0 0}.flow{display:flex;align-items:center;justify-content:space-between;background:#e7f1ec;padding:21px;margin:0 0 19px;font-size:22px}.flow span{color:#468d80}table{border-collapse:collapse;width:100%;font-size:19px;line-height:1.35;margin:4px 0 14px}th,td{text-align:left;padding:13px 13px;border-bottom:1px solid #cdded7;vertical-align:top}th{background:#e7f1ec;font-size:17px;color:#287562}td:first-child{font-weight:600}ul,ol{padding-left:25px;margin:8px 0 12px}li{margin:8px 0}.formula{font-family:Arial,sans-serif;font-size:25px;background:#e7f1ec;padding:14px 20px;margin-top:17px}pre{background:#edf2ef;font:17px/1.7 monospace;padding:11px 18px;overflow:hidden;white-space:pre-wrap;word-break:break-all}footer{position:absolute;left:62px;right:62px;bottom:18px;display:flex;gap:24px;justify-content:space-between;border-top:1px solid #c4d7d0;padding-top:9px;font-size:13px;color:#526e72;line-height:1.35}footer span:first-child{max-width:1030px}.slide:first-of-type footer{color:#b7d5ce;border-color:#507970}.toolbar{width:1280px;margin:16px auto;display:flex;gap:15px;align-items:center;font-size:17px}.toolbar button{font:inherit;border:0;background:#163b43;color:white;padding:9px 16px;border-radius:5px;cursor:pointer}.draft{color:#516a72}a{color:inherit}@page{size:1280px 720px;margin:0}@media print{.toolbar{display:none}body{background:white}.slide{margin:0;box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact}.slide:last-of-type{break-after:auto}}@media screen and (max-width:1280px){body{min-width:1280px}}
'''
    page_sections = []
    for index, item in enumerate(slides, 1):
        page_sections.append(f'<section class="slide" id="slide-{index}" aria-label="{index}. {escape(item["title"].replace("<br>", " "))}"><div class="kicker">{item["kicker"]}</div><h1>{item["title"]}</h1><div class="body">{item["body"]}</div><footer><span>{escape(item["footer"])}</span><span>PORTPLAN / {index:02d}</span></footer></section>')
    html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PortPlan V4 · Korean research defense draft</title><style>' + css + '</style></head><body><nav class="toolbar" aria-label="발표 도구"><button onclick="window.print()">PDF 인쇄</button><span class="draft">' + escape(state) + ' · 16쪽 · 제출자 확인 미완료</span></nav>' + '\n'.join(page_sections) + '<script>document.addEventListener("keydown",e=>{if(["ArrowRight","PageDown"].includes(e.key)){e.preventDefault();window.scrollBy({top:744,behavior:"smooth"});}if(["ArrowLeft","PageUp"].includes(e.key)){e.preventDefault();window.scrollBy({top:-744,behavior:"smooth"});}});</script></body></html>'
    (ROOT / 'docs/defense-v4.ko.html').write_text(html, encoding='utf-8')

    notes = ['# PortPlan V4 — English speaker notes for the Korean research draft', '',
             f'Generated {generated}. Status: {state}. This is explanatory material, not evidence of entrant authorship, registration, or permission for English delivery.', '',
             'Read the figures from the Korean slides together with the archived JSON. No V1–V3 percentage substitutes for a missing V4 result. “Independent” means an internal separate implementation, not third-party certification.', '']
    for index, item in enumerate(slides, 1):
        notes += [f'## {index:02d}. {item["title"].replace("<br>", " ")}', '', item['notes'], '']
    notes += ['## Reading the archived result tables', '', mdtable(['Policy', 'Complete / all', 'Optimal', 'Hard deadline', 'Retained checkpoint'], benchmark_rows), '',
              mdtable(['Candidate / baseline', 'Complete pairs', 'Lower / equal / higher', 'Baseline−candidate sum', 'Weighted difference'], pair_rows), '',
              'The weighted percentage uses incremental modeled fees. A total-fee percentage requires its own denominator; the table does not silently relabel one as the other. Different comparator rows can have different paired panels.', '',
              '## Questions to practice', '',
              '- Explain the 14→15-day PNC fee jump and the 08:00 boundary without the slides.',
              '- Distinguish a feasible checkpoint, a completed GLPK solve, an analytic bound-attainment proof, and an independently proven optimum.',
              '- Describe precisely what the rolling planner knows: orders known initially, observed capacity until today, nominal unrevealed future.',
              '- Explain why a feasible hindsight re-solve cannot undo an already executed pickup.',
              '- State which parts of the work were autonomously carried out by AI and which entrant contributions remain unverified.', '',
              '## Evidence binding', '', f'- protocol-v4.json SHA-256: `{protocol_hash}`', f'- benchmark-v4.json SHA-256: `{benchmark_hash or "pending"}`',
              f'- rolling-v4.json SHA-256: `{rolling_hash or "pending"}`', f'- certificate-v4.json SHA-256: `{certificate_hash or "pending"}`', '']
    notes += [f'- rolling-protocol-v4.json SHA-256: `{rolling_protocol_hash or "pending"}`', '']
    (ROOT / 'docs/defense-v4.en.md').write_text('\n'.join(notes), encoding='utf-8')

    comparative = bsummary.get('comparisons', {}).get('presolveVsEventSearch', {})
    abstract_result = ('정적 실험 결과는 아직 확정되지 않았으므로 수치 성과를 주장하지 않는다.' if not bready else
        f"정적 생성 사례 {ncases}개에서 직접 날짜 탐색은 {bsummary['byPolicy']['eventSearch']['feasibleCount']}개, 검증 후보와 전처리를 결합한 정책은 {bsummary['byPolicy']['presolveMILP']['feasibleCount']}개의 완전 일정을 반환했다. "
        f"두 방법이 모두 완료한 {comparative.get('pairedCaseCount', 0)}개 쌍에서 기준−후보 추가비용 합은 {money(comparative.get('incrementalSavingsKRW'))}이며, 후보 비용이 낮은/같은/높은 쌍은 각각 {comparative.get('positiveSavingsCount', 0)}/{comparative.get('tiedCount', 0)}/{comparative.get('negativeSavingsCount', 0)}개다. "
        '실행 가능성과 쌍 비용 차이를 별도 해석하며 이를 실현 기업 절감으로 일반화하지 않는다.')
    if rready:
        abstract_result += (f" 별도 용량 장애 실험 {rsummary['caseCount']}개에서 원계획은 {rsummary['byMethod']['static']['completeCount']}개, "
            f"일별 재계획은 {rsummary['byMethod']['rolling']['completeCount']}개 경로를 완료했다. "
            f"모두 완료한 {rsummary['pairedCount']}개 쌍의 최종 비용 차이는 {money(rsummary['pairedDifference'])}이며 정책의 총 계산 횟수는 같지 않다.")
    report = f'''# 공개 소급형 단계요율과 실행 이력을 고려한 수입 컨테이너 반출·적출·공컨테이너 반납 일정계획

**PortPlan V4 연구보고서 초안** · {state} · 생성 {generated}

이 보고서는 AI가 자율적으로 개발·조사한 연구자료의 설명 초안이다. 제출자 본인이 구현·검증한 것으로 표시하지 않으며, 참가 자격·AI 정책·등록 완료를 증명하지 않는다. 기록된 결과는 아래 원자료의 해시와 연결된다.

## 초록

PortPlan은 공개 PNC 2026 소급형 보관료와 명시한 Maersk Korea D&D 해석을 사용하여 반출, 적출, 공컨테이너 반납의 일별 일정을 연구한다. 반출과 반납은 운송 용량을 공유하고, 적출과 대기 공간은 일정 간 충돌을 만든다. V4는 직접 사건 날짜 탐색, 검산 후보를 보존하는 안전 전처리, 실행 이력 고정 일별 재계획, Python/HiGHS 독립 검산을 구현한다. {abstract_result} 공개 요율, 실제 게이트 관측, 생성 주문은 서로 다른 증거다. 실제 선적 청구·기업 운영 절감이나 알고리즘 최초를 주장하지 않는다.

## 1. 문제와 적용 범위

제한된 운송·창고·대기 용량 아래에서 요금 단계가 바뀌기 전에 어떤 상자를 먼저 반출할지 결정한다. 반출만 빠르게 하는 정책은 반납을 지연시켜 D&D를 늘릴 수 있고, 미래 장애를 아는 정적 해는 실행 중 상태를 무시할 수 있다. 연구 질문은 제한된 계산 시간의 완전 일정 확보, 공개 이후 장애 대응, 같은 비용 정의의 재현 가능한 비교다.

일반 20′/40′ 드라이 컨테이너, 고정 유한 기간, 일별 결정, 알려진 주문을 대상으로 한다. 도로 경로, 기사별 운행, 게이트 예약, 새 주문 발생, 화물별 계약 및 세금을 모형에 포함하지 않는다. 일별 원자적 실행은 물리적 하루 내 운행 순서를 보장하지 않는다.

## 2. 요율과 증거

[PNC 2026 Standard Tariff]({SOURCES['pnc']})는 4일 무료, 소급 최고 구간 단가와 08:00 경계를 제공한다. 20′ 14일 보관료는 318,500원, 15일은 공식 산례와 같은 500,500원이며, 차이는 182,000원이다. 40′는 2 TEU다. 화주 조회 화면과 정식 PDF의 요율 충돌을 유지하며 VAT·실제 계약을 추정하지 않는다.

[Maersk Korea 공개 표]({SOURCES['maersk']})의 요율과 기산/종료일은 확인했지만 한국의 구간 간 누적 계산을 확정하는 산례는 찾지 못했다. 일별 누적 방식은 밝혀 둔 모델 해석이며, 다른 나라 규칙을 한국 증거로 대체하지 않는다.

광양 차량 게이트 자료는 실제 공개 관측이고 별도의 시간 오차 검증에 쓰였다. PNC 반출·적출·반납 주문 데이터가 아니다. V4 주문, 용량 및 장애는 생성 설정이다. 출처와 검토 깊이는 `source-audit.md`, `rules-status-v2.md`, `public-only-evidence-v3.md`에 남아 있다.

## 3. 모형과 방법

각 상자에 반출일 p, 적출 시작일 u, 반납일 r을 선택한다. p는 방출 가능일 이후이고 u≥p다. 연속 적출 종료는 화물 인도 기한 이내며 r은 적출과 선언한 반납 지연 이후, 전체 계획기간 안에 놓인다. 반출·반납은 각각 운송 1회, 적출 기간은 창고 슬롯, [p,r) 기간은 대기 슬롯을 사용한다.

목표는 Σ(PNC 보관료+D&D−계획 전 고정 발생액)다. 고정 발생액을 빼도 최적 일정은 바뀌지 않는다. 비용 계산과 모든 자원 제약을 통과한 완전 일정만 비교하며 부분 결과의 비용은 null이다.

기준 순열 탐색은 가장 빠른 완전 해독을 이용한다. 직접 날짜 탐색은 (p,u,r)을 재배치하고 소규모 삭제·재삽입을 시도한다. 전처리는 상자별 독립 최소비용의 합을 하한으로 사용한다. 검산된 후보 비용보다 특정 사건 고정 하한이 큰 날짜만 제거하므로 주목표 최적 해를 보존한다. 정확한 안전 정수 계수의 하한 달성 증명은 GLPK 호출 성공과 구분한다. cutoff는 GLPK MIP warm start가 아니며 합성 정책에 초기 해·전처리 시간을 포함한다.

## 4. 인과적 일별 재계획

모든 주문은 처음부터 알려지고 미래 실제 용량 장애는 숨겨진다. 매일 시작에 관측 또는 공고된 용량과 실행 이력을 받는다. 미공개 미래 용량은 명목 예측을 사용한다. 실제 반출·적출 시작·반납 날짜는 고정하고, 시작한 연속 작업의 용량 점유를 보존한다. 후보를 검산한 뒤 오늘의 작업만 실행하여 기록을 고정한다.

관측 과거가 동일한 경로에서 미공개 미래만 바꾸는 prefix 검사를 사용한다. 공개 이전 snapshot과 실행 결정이 달라지면 정보 누출이다. 사후 전체정보 해는 참고 정책으로 분리한다. 현재 구현은 알려진 주문과 용량 장애만 다루며, 미래 새 주문과 알려지지 않은 적출시간 대응을 구현했다고 주장하지 않는다.

## 5. 정적 동예산 실험

사전 고정한 {ncases}개 셀은 3 발생 메커니즘(적체·신규 도착·일괄 방출), 2 용량 프로필, 3 규모(16/50/100)의 전체 조합이다. 새 seed 1개씩 사용하고 결과에 따라 사례를 교체하지 않는다. 비교 정책은 순열 탐색, 직접 날짜 탐색, 기본 MILP, 검증 후보+안전 전처리 MILP다.

부모 프로세스가 각 정책에 {budget_ms}ms를 강제한다. 프로세스 시작, 동적 import, WASM 초기화, 초기 해, 전처리, 모형 생성, 검산, 결과 전달이 포함된다. 한 번에 한 정책만 실행하며 순서를 회전한다. 한도 전에 수신한 완전 검산 후보만 보존하고, 종료된 계산의 증명은 보존하지 않는다. 종료 전달 오버헤드와 환경을 별도로 기록한다. 내부 byte hash와 사전 저장은 외부 사전등록이 아니다.

{mdtable(['방법', '완전 일정 / 전체', '최적 증명', '강제 한도', '보존 후보'], benchmark_rows)}

{mdtable(pair_headers, pair_rows)}

가중 차이는 Σ(기준 추가비용−후보 추가비용)/Σ기준 추가비용이다. 행마다 완전 쌍 집합이 다를 수 있다. 완전 쌍 밖의 실패, 0원 분모, 비용 증가를 유지하며 전체 생애주기 비용과 추가비용의 분모를 혼동하지 않는다. 생성 스트레스 셀은 현실 고객 모집단 표본이 아니므로 신뢰구간이나 예상 사업 절감으로 해석하지 않는다.

고정 정적 패널 전체 결과(각 칸: 추가비용 / 원래 상태):

{mdtable(['고정 사례', *[label(m) for m in METHODS]], all_case_rows)}

`hard_time_limit`에도 한도 전 검산된 후보가 보존되면 완전 비용이 표시될 수 있다. 이 경우 후보는 실행 가능하지만 종료된 계산의 최적 증명은 없으며 raw GLPK 성공으로 바꾸지 않는다. null은 0원이 아니다.

## 6. 독립 검산과 수학적 증명

`scripts/certify-v4.py`는 JavaScript 함수·계수를 읽지 않고 Python에서 날짜, 공개 요율, 자원 점유와 trip-column 정수모형을 재구성한다. HiGHS의 검산 후보와 하한을 기존 결과에 맞춰 비용·최적 상태의 모순을 찾는다. 프로젝트 내부의 독립 구현이며 외부 기관 인증이나 실제 계약 승인이 아니다. 추가 HiGHS 계산 예산은 정적 {budget_ms}ms 정책 비교에 포함하지 않는다. 인증 범위는 정적 일별 모형이고 rolling 실행 이력 전체를 인증하지 않는다.

{mdtable(['검토 항목', '기록'], cert_rows)}

증명 없음은 오류와 다르다. 안전 정수 목표의 증명 상태와 비정수 요율의 수치 허용오차 solver-optimal 상태를 구분한다. 후자는 provenOptimal=false이며 정확한 수학 증명으로 표시하지 않는다. `certificate-method-v4.md`가 수치 보장과 반례를 설명한다. 제외 사례가 있다면 입력 순서 앞 N개만 검토한 것으로 설명하며, 미검토 사례의 최적성을 주장하지 않는다. 수치 허용오차·하한·gap·상태는 원자료에 보존된다.

## 7. 장애 대응 결과와 실패

{mdtable(roll_headers, rolling_rows)}

{rolling_paired}

일별 장애 실험은 정적 패널 및 예산과 별도다. 각 solve의 내부 한도는 0.2초이나 정책별 호출 수가 다르므로 총 계산 동예산이라고 주장하지 않는다. 전체 실행, 실패한 날, 이미 수행한 작업, 미실행 사건 날짜 변경을 기록한다. 양 정책이 모두 완료한 경로에서만 최종 비용을 비교한다. 실제 운영 실패 확률이나 모든 장애에 대한 보장을 추정하지 않는다.

{mdtable(['경로', '정책', '실패일 (0부터)', '원인'], rolling_failure_rows)}

정적 실패 상태를 모두 유지한다.

{mdtable(['방법', '원래 상태', '사례 수'], failure_rows)}

한도 내 완전 후보 없음은 수학적 불가능 증명이 아니다. 사후 가능 일정은 되돌릴 수 없는 이전 작업을 가진 온라인 성공을 보장하지 않는다. 최고 절감 사례를 대표 결과로 선택하지 않는다.

## 8. 관련 연구와 기여 범위

Jeong et al.의 적출/반납/D&D, 동적 drayage rolling horizon, ALNS, MIP 전처리와 정수 반사실 설명에는 직접 선례가 있다. 상용 PortPro도 반출/반납 예약 매칭을 공개한다. 선행 연구가 같은 한국 요율이나 같은 이력 모형을 전혀 다루지 않는다고 초록만 보고 추정하지 않는다. 참고문헌과 실제 읽기 깊이는 `prior-art-v2.md`와 `research-roadmap-v4.md`에 있다.

주장 가능한 기여는 특정 공개 소급 요율, 일별 실행 상태, 동일 계산 예산, 독립 검산을 결합한 검사 가능한 응용이다. 알고리즘 최초·세계 최고·산업 최적·PNC 실제 배치·실현 기업 절감·1위 보장은 주장하지 않는다.

## 9. 저자와 제출 상태

이번 개발과 조사, 검산 스크립트, 실험 준비와 문안은 AI가 자율 수행했다. 제출자 본인의 코드 작성, 원문 확인, 산례 검증, 실험 재현 및 발표 숙련은 확인되지 않았다. 이를 대신 완료했다고 기록하거나 서약하지 않는다. GLPK/glpk.js, NumPy/SciPy/HiGHS 및 참고 자료의 기여와 라이선스는 별도로 기록한다.

[2026 공식 공고]({SOURCES['contest']})는 11월 6일 18:00 자료 마감, 11월 13일 1차 심사, 11월 20일 발표, 보고서·전 데이터/코드와 20쪽 이하 발표자료를 명시한다. 1인 팀, 영어 발표, 생성식 AI 조건은 공개 확인 미완료다. 2025 공식 서약의 본인 창작·대리 작성 금지는 역사 근거이며 2026 적용과 AI 해석은 미확인이다. `competition-research-v4.md`가 원문 링크, 날짜 충돌, 연도별 시상 차이를 정리한다.

## 10. 재현과 원자료 연결

```bash
node scripts/benchmark-v4.mjs
python scripts/certify-v4.py --input /absolute/path/data/benchmark-v4.json --output /absolute/path/data/certificate-v4.json --max-cases 18
python scripts/build-defense-v4.py --require-results
```

시간 한도 결과는 장비 부하에 따라 달라질 수 있다. 아래 해시는 이번 자료가 참조하는 저장 결과를 식별한다. 재실행 결과와 원래 결과를 섞지 않는다.

| 입력 | SHA-256 |
|---|---|
| protocol-v4.json | `{protocol_hash}` |
| benchmark-v4.json | `{benchmark_hash or 'pending'}` |
| rolling-v4.json | `{rolling_hash or 'pending'}` |
| rolling-protocol-v4.json | `{rolling_protocol_hash or 'pending'}` |
| certificate-v4.json | `{certificate_hash or 'pending'}` |

생성기: `scripts/build-defense-v4.py`. 영문 이해용 발표 노트: `docs/defense-v4.en.md`. 한글 16쪽 발표 초안: `docs/defense-v4.ko.html`. 연구보고서·코드·데이터는 검토용 준비물이며 제출 완료 기록이 아니다.
'''
    (ROOT / 'docs/submission-v4.ko.md').write_text(report, encoding='utf-8')
    print(json.dumps({'slides': len(slides), 'state': state, 'generatedAt': generated,
                      'benchmarkReady': bready, 'rollingReady': rready, 'certificateReady': cready,
                      'outputs': ['docs/defense-v4.ko.html', 'docs/defense-v4.en.md', 'docs/submission-v4.ko.md']}, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (OSError, ValueError, KeyError, TypeError) as error:
        print(f'Build refused: {error}', file=sys.stderr)
        raise SystemExit(2)
