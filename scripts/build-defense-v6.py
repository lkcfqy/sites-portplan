#!/usr/bin/env python3
"""Build 18-page Korean V6 drafts from complete, hash-bound actual archives.

Never invokes a solver or browser, modifies source evidence, or fills pending data.
--require-results is accepted explicitly; complete evidence is always required.
Authorship/eligibility/registration are not established by this build.
"""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
from html import escape
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
METHODS = ('dailyReoptV4', 'stableRetainV5', 'lockedRecoveryV6', 'persistenceRecoveryV6')
LABELS = dict(zip(METHODS, ('매일 MILP', '유효 계획 유지', '실행 잠금 복구', '1일 보수 예측 + 복구')))
OFFICIAL = 'https://anchor.changwon.ac.kr/main/menu?gc=Program&do=sinform&spod=s1&program_id=VKoDUNlZwONq&psin_id=VKoDUNlMqh4n'
PNC = 'https://www.pncport.com/resources/homepage/kor/data/2026_PNC_Standard_Tariff.pdf'
TRANSPORT_KO = 'Git 전송용으로 V6 원본 112,117,733바이트를 순서 있는 29개 분할본(각 최대 4,000,000바이트, 마지막은 더 작음)과 `data/archives-v6/rolling-v6/manifest.json`에 저장한다. `npm run build`와 `npm run verify:v6`는 복원기를 호출해 각 조각과 전체 SHA-256을 검사하고 누락된 원본만 복원한다. Git clone이나 npm ci 자체는 복원을 실행하지 않으며 다른 직접 실행 전에 `python scripts/restore-evidence-v6.py`를 쓸 수 있다. 웹사이트의 기존 세 ZIP을 합치면 완전 원본·웹뷰·분할본·manifest가 모두 있고 같은 portplan/ 루트로 풀면 된다. 기존 원본은 대체하지 않으며 이는 무손실 전송 변경일 뿐 실험·프로토콜·최초 소스나 원본 SHA를 바꾸지 않는다.'
TRANSPORT_EN = 'For Git transport, the 112,117,733-byte V6 archive is stored as 29 ordered chunks of at most 4,000,000 bytes (the last is smaller), with data/archives-v6/rolling-v6/manifest.json. npm run build and npm run verify:v6 invoke the restorer, verify each chunk and the complete SHA-256, and restore only a missing original. Git clone and npm ci do not perform restoration; before other direct scripts, run python scripts/restore-evidence-v6.py. The same three website ZIPs collectively include the complete original, web view, chunks and manifest under portplan/. Existing originals are never replaced. This lossless transport change does not alter experiments, protocol, first-run source or the original SHA.'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path):
    full = ROOT / path
    if not full.is_file():
        raise ValueError('Required actual evidence is missing: ' + path)
    raw = full.read_bytes()
    return json.loads(raw), hashlib.sha256(raw).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def same(a, b):
    return abs(a - b) <= 1e-6 if finite(a) and finite(b) else a == b


def complete(result):
    return result.get('complete') is True and result.get('auditValid') is True and result.get('episodeCompletedWithinBudget') is True and \
        result.get('status') in ('feasible', 'optimal') and result.get('executionHistoryUnavailable') is not True


def n(value):
    return '미확인' if value is None else f'{value:,}'


def won(value):
    return 'null' if value is None else ('−' if value < 0 else '') + f'₩{abs(value):,.0f}'


def pct(value, places=2):
    return '미정(0 분모)' if value is None else f'{value:.{places}f}%'


def table(headers, rows):
    return '<table><thead><tr>' + ''.join('<th>' + escape(str(x)) + '</th>' for x in headers) + '</tr></thead><tbody>' + ''.join('<tr>' + ''.join('<td>' + escape(str(x)) + '</td>' for x in row) + '</tr>' for row in rows) + '</tbody></table>'


def mt(headers, rows):
    return '\n'.join(['| ' + ' | '.join(headers) + ' |', '| ' + ' | '.join('---' for _ in headers) + ' |'] + ['| ' + ' | '.join(str(x).replace('|', '/') for x in row) + ' |' for row in rows])


def ul(items):
    return '<ul>' + ''.join('<li>' + str(x) + '</li>' for x in items) + '</ul>'


def two(left, right):
    return '<div class="two"><div>' + left + '</div><div>' + right + '</div></div>'


def box(text):
    return '<div class="callout">' + text + '</div>'


def cards(items):
    return '<div class="cards">' + ''.join('<article><strong>' + escape(str(a)) + '</strong><p>' + escape(b) + '</p></article>' for a, b in items) + '</div>'


def paired(cases, baseline, candidate):
    pairs = [(c['id'], c['policies'][baseline], c['policies'][candidate]) for c in cases
             if complete(c['policies'][baseline]) and complete(c['policies'][candidate])]
    total_base = sum(a['totalCost'] for _, a, _ in pairs)
    total_candidate = sum(b['totalCost'] for _, _, b in pairs)
    incremental_base = sum(a['incrementalCost'] for _, a, _ in pairs)
    incremental_candidate = sum(b['incrementalCost'] for _, _, b in pairs)
    delta = [a['totalCost'] - b['totalCost'] for _, a, b in pairs]
    rb = sum(a['revisionCount'] for _, a, _ in pairs)
    rc = sum(b['revisionCount'] for _, _, b in pairs)
    result = {'baselineMethod': baseline, 'candidateMethod': candidate, 'caseCount': len(cases), 'pairedCaseCount': len(pairs),
        'missingBaselineCount': sum(not complete(c['policies'][baseline]) for c in cases),
        'missingCandidateCount': sum(not complete(c['policies'][candidate]) for c in cases),
        'baselineTotalKRW': total_base, 'candidateTotalKRW': total_candidate,
        'totalSavingsKRW': total_base - total_candidate,
        'weightedTotalSavingsPct': (total_base - total_candidate) * 100 / total_base if total_base else None,
        'baselineIncrementalKRW': incremental_base, 'candidateIncrementalKRW': incremental_candidate,
        'incrementalSavingsKRW': incremental_base - incremental_candidate,
        'weightedIncrementalSavingsPct': (incremental_base - incremental_candidate) * 100 / incremental_base if incremental_base else None,
        'zeroBaselineTotalCount': sum(a['totalCost'] == 0 for _, a, _ in pairs),
        'zeroBaselineIncrementalCount': sum(a['incrementalCost'] == 0 for _, a, _ in pairs),
        'positiveSavingsCount': sum(d > 1e-6 for d in delta), 'tiedCount': sum(abs(d) <= 1e-6 for d in delta),
        'negativeSavingsCount': sum(d < -1e-6 for d in delta), 'worstLossKRW': max([0] + [-d for d in delta]),
        'baselineRevisionCount': rb, 'candidateRevisionCount': rc,
        'revisionReductionPct': (rb - rc) * 100 / rb if rb else None,
        'gainedCompletionCaseIds': [c['id'] for c in cases if not complete(c['policies'][baseline]) and complete(c['policies'][candidate])],
        'lostCompletionCaseIds': [c['id'] for c in cases if complete(c['policies'][baseline]) and not complete(c['policies'][candidate])],
        'negativeSavingsCaseIds': [identifier for (identifier, _, _), d in zip(pairs, delta) if d < -1e-6]}
    for counter in ('solverCalls', 'decisionCalls'):
        result['baseline' + counter[0].upper() + counter[1:]] = sum(a['plannerStats'][counter] for _, a, _ in pairs)
        result['candidate' + counter[0].upper() + counter[1:]] = sum(b['plannerStats'][counter] for _, _, b in pairs)
    return result


def validate_panel(cases, summary, label):
    require(summary['caseCount'] == len(cases), label + ' case count mismatch')
    require(set(summary['byMethod']) == set(METHODS), label + ' summary method panel mismatch')
    for case in cases:
        require(set(case['policies']) == set(METHODS), label + ' incomplete method coverage: ' + case['id'])
        require(sorted(case['methodExecutionOrder']) == sorted(METHODS), 'Missing execution-order method: ' + case['id'])
        for method in METHODS:
            result = case['policies'][method]
            require(result.get('complete') in (True, False), 'Unknown completion state: ' + case['id'])
            if result['complete']:
                require(complete(result) and len(result['rows']) == case['count'] and
                        finite(result.get('totalCost')) and finite(result.get('incrementalCost')),
                        'Complete flag without timely full audited result: ' + case['id'])
                require(result['terminalAudit']['engine']['valid'] is True and not result['terminalAudit']['independentErrors'],
                        'Terminal audit failed: ' + case['id'])
            else:
                require(result.get('totalCost') is None and result.get('incrementalCost') is None,
                        'Failed execution has manufactured complete costs: ' + case['id'])
            if result.get('executionHistoryUnavailable') is True:
                require(result.get('revisionCount') is None and all(result.get('plannerStats', {}).get(k) is None for k in
                        ('decisionCalls', 'solverCalls', 'constructorCalls', 'reusedPlans', 'replannedDueToInvalid', 'planningWallMs')),
                        'Unavailable history/counters were filled as zero: ' + case['id'])
    for method in METHODS:
        item = summary['byMethod'][method]
        results = [c['policies'][method] for c in cases]
        require(item['caseCount'] == len(cases), label + ' method case count mismatch')
        require(item['completeCount'] == sum(complete(x) for x in results), label + ' completion summary mismatch')
        require(item['failureCount'] == len(cases) - item['completeCount'], label + ' failure summary mismatch')
        require(item['statuses'] == dict(Counter(x['status'] for x in results)), label + ' status summary mismatch')
        required_counts = {'knownExecutionFailureCount': sum(x.get('executionHistoryUnavailable') is not True and not complete(x) for x in results),
                           'executionHistoryUnavailableCount': sum(x.get('executionHistoryUnavailable') is True for x in results),
                           'undeliveredEpisodeCount': sum(not x.get('outputDeliveredWithinBudget') for x in results),
                           'hardDeadlineCount': sum(bool(x.get('deadlineReached')) for x in results),
                           'auditFailureCount': sum(x.get('status') == 'audit_failed' for x in results)}
        require(all(item[k] == value for k, value in required_counts.items()), label + ' failure/deadline count mismatch')
        for counter, aggregate in item['counters'].items():
            values = [x.get('plannerStats', {}).get(counter) for x in results]
            known = [v for v in values if finite(v)]
            require(same(aggregate['observedSum'], sum(known)) and aggregate['knownEpisodeCount'] == len(known) and
                    aggregate['unknownEpisodeCount'] == len(results) - len(known), label + ' counter mismatch: ' + counter)
        values = [x.get('revisionCount') for x in results]
        known = [v for v in values if finite(v)]
        revisions = item['observedRevisionCount']
        require(same(revisions['observedSum'], sum(known)) and revisions['knownEpisodeCount'] == len(known) and
                revisions['unknownEpisodeCount'] == len(results) - len(known), label + ' revision summary mismatch')
    for key, recorded in summary['comparisons'].items():
        calculated = paired(cases, recorded['baselineMethod'], recorded['candidateMethod'])
        for field, value in calculated.items():
            require(same(value, recorded[field]), label + ' paired summary mismatch: ' + key + '/' + field)
    for scale, segment in summary['byScale'].items():
        selected = [c for c in cases if c['count'] == int(scale)]
        require(segment['caseCount'] == len(selected), label + ' scale case count mismatch')
        require(segment['completeCounts'] == {m: sum(complete(c['policies'][m]) for c in selected) for m in METHODS},
                label + ' scale completion mismatch')
    for key, counts in summary['initialEquality']['pairs'].items():
        values = [c['initialComparison']['pairs'][key] for c in cases]
        evaluated = [x for x in values if x['evaluated']]
        expected = {'evaluatedCaseCount': len(evaluated), 'equalCaseCount': sum(x['decisionsEqual'] is True for x in evaluated),
                    'differentCaseCount': sum(x['decisionsEqual'] is False for x in evaluated), 'unavailableCaseCount': len(cases) - len(evaluated)}
        require(counts == expected, label + ' initial equality mismatch: ' + key)
    require(summary['terminalAudit']['completeEpisodes'] == sum(complete(c['policies'][m]) for c in cases for m in METHODS),
            label + ' complete terminal audit count mismatch')
    require(summary['terminalAudit']['failedAudits'] == sum(c['policies'][m].get('status') == 'audit_failed' for c in cases for m in METHODS),
            label + ' failed audit count mismatch')


def evidence():
    paths = ['data/protocol-v6.json', 'data/rolling-v6.json', 'data/failure-diagnosis-v6.json',
             'data/feasibility-witnesses-v6.json', 'data/feasibility-review-v6.json',
             'data/public-orders-audit-v6.json', 'data/public-sources-v6.json', 'data/rolling-v5.json',
             'data/benchmark-v5.json', 'data/public/v5-rules/manifest.json',
             'vendor/experiments/v6-first-run-source/manifest.json']
    values, hashes = {}, {}
    for path in paths:
        values[path], hashes[path] = load(path)
    protocol, rolling = values[paths[0]], values[paths[1]]
    require(rolling['executionState'] == 'complete', 'Formal V6 archive is not complete; no prefilled output allowed.')
    require(rolling['protocolHash'] == hashes[paths[0]] and rolling['protocol'] == protocol, 'Protocol bytes/content mismatch')
    require(tuple(protocol['methods']) == METHODS, 'Unexpected frozen V6 method panel')
    primary = rolling['cases']; development = rolling['developmentControls']['cases']
    require([c['id'] for c in primary] == [c['id'] for c in protocol['primaryCases']], 'Primary frozen coverage/order mismatch')
    for case, fixed in zip(primary, protocol['primaryCases']):
        require(all(case[k] == v for k, v in fixed.items() if k != 'shockPattern'), 'Primary frozen field mismatch: ' + case['id'])
        require(case['dataRole'] == 'held-out-primary', 'Primary is mislabeled as held out')
    definition = protocol['developmentControls']
    require(hashes['data/rolling-v5.json'] == definition['inputArchiveSha256'], 'Development source hash mismatch')
    require([c['id'] for c in development] == [x + definition['suffix'] for x in definition['caseIds']], 'Development frozen coverage/order mismatch')
    old = {c['id']: c for c in values['data/rolling-v5.json']['cases']}
    for case, original in zip(development, definition['caseIds']):
        require(case['nominalScenario'] == old[original]['nominalScenario'] and case['events'] == old[original]['events'],
                'Development input changed: ' + original)
    validate_panel(primary, rolling['summary'], 'primary')
    validate_panel(development, rolling['developmentControls']['summary'], 'development')
    snapshot = values[paths[-1]]
    require(snapshot.get('capturedBeforePrimaryGeneration') is True and snapshot['protocolHash'] == hashes[paths[0]],
            'Missing prior source snapshot binding')
    require(snapshot['implementationHashes'] == rolling['implementationHashes'], 'Archive/source snapshot implementation binding mismatch')
    for path, expected in snapshot['implementationHashes'].items():
        frozen = ROOT / 'vendor/experiments/v6-first-run-source' / path
        require(frozen.is_file() and digest(frozen) == expected, 'Frozen implementation bytes mismatch: ' + path)
    for name in ('data/failure-diagnosis-v6.json', 'data/feasibility-review-v6.json'):
        item = values[name]
        require(item.get('valid') is True, 'Offline review is not valid: ' + name)
        for path, expected in item['inputHashes'].items():
            require((ROOT / path).is_file() and digest(ROOT / path) == expected, 'Offline input byte binding mismatch: ' + path)
    witnesses = values['data/feasibility-witnesses-v6.json']
    require(witnesses['inputArchiveSha256'] == hashes['data/rolling-v5.json'], 'Necessary-cut input binding mismatch')
    require([c['id'] for c in witnesses['cases']] == list(old), 'Necessary-cut case panel mismatch')
    review = values['data/feasibility-review-v6.json']
    require(review['summary']['failedEpisodeNecessaryInfeasibilityCount'] == witnesses['summary']['failedEpisodeNecessaryInfeasibilityCount'] and
            review['summary']['unresolvedFailedEpisodeCount'] == witnesses['summary']['unresolvedFailedEpisodeCount'], 'Necessary-cut review disagrees')
    source_audit = values['data/public-orders-audit-v6.json']
    require(not source_audit['failures'] and source_audit['summary']['failedCheckCount'] == 0 and
            all(c['status'] == 'pass' for c in source_audit['checks']), 'Public input audit contains failed checks')
    require(source_audit['summary']['checkCount'] == len(source_audit['checks']), 'Public check-count mismatch')
    for artifact in source_audit['source']['artifacts']:
        require(digest(ROOT / artifact['path']) == artifact['sha256'] == artifact['expectedSha256'], 'Public source byte binding mismatch')
    require(digest(ROOT / source_audit['reproducibility']['script']) == source_audit['reproducibility']['scriptSha256'], 'Public audit code binding mismatch')
    customers = source_audit['directDepotNecessaryInformation']['customers']
    require(len(customers) == source_audit['schema']['customerCount'] and all(c['shiftStartMinutes'] is None and
            c['arrivalWindowReachableAtShiftStart'] is None for c in customers), 'Missing shift start was converted into reachability')
    sources = values['data/public-sources-v6.json']
    for artifact in sources['inventory']:
        require(digest(ROOT / 'data/public/v6-data-sources' / artifact['path']) == artifact['sha256'], 'Downloaded source inventory binding mismatch: ' + artifact['path'])
    for record in values['data/public/v5-rules/manifest.json']['records']:
        require(digest(ROOT / record['path']) == record['sha256'], 'Official rule snapshot mismatch')
    return values, hashes


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--require-results', action='store_true', help='Explicit guard; complete evidence is required even without this flag.')
    args = parser.parse_args()
    values, hashes = evidence()  # All guards precede every output mutation.
    r = values['data/rolling-v6.json']; p = values['data/protocol-v6.json']
    s = r['summary']; ds = r['developmentControls']['summary']
    diagnosis = values['data/failure-diagnosis-v6.json']; cuts = values['data/feasibility-witnesses-v6.json']
    review = values['data/feasibility-review-v6.json']; audit = values['data/public-orders-audit-v6.json']
    sources = values['data/public-sources-v6.json']; v5 = values['data/benchmark-v5.json']
    locked = s['comparisons']['lockedVsStable']; forecast = s['comparisons']['persistenceVsLocked']
    stable = s['comparisons']['stableVsDaily']; devlocked = ds['comparisons']['lockedVsStable']; devforecast = ds['comparisons']['persistenceVsLocked']
    generated = datetime.now(timezone.utc).isoformat(timespec='seconds')
    main_count = s['caseCount']; dev_count = ds['caseCount']
    coverage_headers = ['정책', '완료 / 전체', '실패', 'solver 호출', '날짜 변경']
    def coverage(summary):
        return [[LABELS[m], f"{summary['byMethod'][m]['completeCount']} / {summary['caseCount']}", summary['byMethod'][m]['failureCount'],
                 n(summary['byMethod'][m]['counters']['solverCalls']['observedSum']), n(summary['byMethod'][m]['observedRevisionCount']['observedSum'])] for m in METHODS]
    main_rows = coverage(s); dev_rows = coverage(ds)
    scale_rows = [[scale + '상자', item['caseCount']] + [item['completeCounts'][m] for m in METHODS] for scale, item in s['byScale'].items()]
    def comparison_rows(item):
        return [['완전 쌍 / 누락 기준·후보', f"{item['pairedCaseCount']} / {item['missingBaselineCount']} · {item['missingCandidateCount']}"],
                ['후보 낮음 / 같음 / 높음', f"{item['positiveSavingsCount']} / {item['tiedCount']} / {item['negativeSavingsCount']}"],
                ['후보 총요금 증가 / 기준 분모', won(-item['totalSavingsKRW']) + ' / ' + won(item['baselineTotalKRW'])],
                ['총요금 증가율 / 추가요금 증가율', pct(-item['weightedTotalSavingsPct']) + ' / ' + pct(-item['weightedIncrementalSavingsPct'])],
                ['날짜 변경 (같은 쌍)', f"{item['baselineRevisionCount']} → {item['candidateRevisionCount']}"],
                ['최악의 요금 증가', won(item['worstLossKRW'])]]
    categories = Counter()
    for case in diagnosis['cases']:
        labels = {item['category'] for item in case['methods'].values() if item['category'] != 'complete_no_failure'}
        require(len(labels) <= 1, 'Offline case categories differ across methods')
        categories.update(labels)
    diag_rows = [['명목 시작부터 불가능', categories['nominal_infeasible_from_start'], diagnosis['summary']['failureCategoriesByEpisode']['nominal_infeasible_from_start']],
                 ['actual 전 경로도 불가능', categories['actual_hindsight_infeasible_and_locked_prefix_infeasible'], diagnosis['summary']['failureCategoriesByEpisode']['actual_hindsight_infeasible_and_locked_prefix_infeasible']],
                 ['전 경로 가능 / 실행 prefix 불가능', categories['executed_prefix_unrecoverable_despite_hindsight_feasible'], diagnosis['summary']['failureCategoriesByEpisode']['executed_prefix_unrecoverable_despite_hindsight_feasible']]]
    runtime_rows = [[LABELS[m], f"{s['byMethod'][m]['wallTimeMs']['median']:.1f}", f"{s['byMethod'][m]['wallTimeMs']['p95']:.1f}",
                     f"{s['byMethod'][m]['callWallMs']['max']:.1f}", s['byMethod'][m]['hardDeadlineCount']] for m in METHODS]
    eq = s['initialEquality']['pairs']['stableRetainV5__lockedRecoveryV6']
    gained = [c for c in r['cases'] if c['id'] in locked['gainedCompletionCaseIds']]
    gained_initial_no_plan = [c for c in gained if c['policies']['stableRetainV5'].get('failure', {}).get('day') == 0 and
                             not c['initialComparison']['pairs']['stableRetainV5__lockedRecoveryV6']['evaluated']]
    gained_later = [c for c in gained if c not in gained_initial_no_plan]
    gained_later_different_initial = [c for c in gained_later if c['initialComparison']['pairs']['stableRetainV5__lockedRecoveryV6']['decisionsEqual'] is False]
    gain_scope = f"추가 완주 {len(gained)}개 중 {len(gained_initial_no_plan)}개는 기준 D0 무후보, {len(gained_later_different_initial)}개는 초기 날짜가 다른 후속 경로입니다. 동일 prefix의 복구만으로 귀속하지 않습니다."
    schema = audit['schema']; zero = audit['matrices']['travelTime']; proof = review['summary']
    slides = []
    def slide(kicker, title, body, notes, footer='V6 원자료·프로토콜·실패 보존 / 생성 주문, 실제 기업 효과 미검증'):
        slides.append({'kicker': kicker, 'title': title, 'body': body, 'notes': notes, 'footer': footer})

    slide('01 / PORTPLAN V6', '실행을 잠그고 복구하면<br>완주가 늘지만 비용도 늡니다.',
          cards([(f"{s['byMethod']['lockedRecoveryV6']['completeCount']}/{main_count}", '새 seed · 실행 잠금 복구 완료'),
                 (f"{s['byMethod']['stableRetainV5']['completeCount']}/{main_count}", '같은 입력 · 유효 계획 유지 완료'),
                 ('+' + pct(-locked['weightedTotalSavingsPct']), f"완료 {locked['pairedCaseCount']}쌍의 총요금 증가")]) +
          '<p>공개 한국 요율을 고려한 반출·적출·공컨테이너 반납 연구 원형</p>' + box('완주·요금·변경을 함께 판단합니다. 관측한 결과를 모든 항만의 회복률이나 실제 절감액으로 바꾸지 않습니다.'),
          f"Lead with the tradeoff. On {main_count} frozen new-seed synthetic inputs, locked recovery completed {s['byMethod']['lockedRecoveryV6']['completeCount']} versus stable retention {s['byMethod']['stableRetainV5']['completeCount']}. In their {locked['pairedCaseCount']} jointly completed pairs, recovery cost {won(-locked['totalSavingsKRW'])} more. This is not real port deployment evidence.")
    slide('02 / BUSINESS PROBLEM', '하루의 연기가<br>182,000원을 더 만들 수 있습니다.',
          two('<h2>제안 사용자</h2>' + ul(['알려진 수입 건화물 상자 목록을 조정하는 계획 담당자', '반출·반납은 같은 운송 자원을 공유', '연속 적출과 대기 공간이 다른 상자의 날짜와 결합']),
              table(['20′ PNC 예시', '보관료'], [['14일', '₩318,500'], ['15일', '₩500,500'], ['하루 차이', '+₩182,000']])) +
          box('최고 도달 단가를 유료 일수 전체에 소급합니다. 이 차이는 공식 요율 산식 예시이며 최적화 절감이나 실제 청구서가 아닙니다.'),
          'The proposed user coordinates known import dry containers, shared haulage and warehouse work. The 2026 PNC standard tariff retroactively applies the reached rate to all chargeable days. The 15-day official example is 500,500 KRW; 14 days yields 318,500. This local charge difference is not a measured business saving.', 'PNC 2026 Standard Tariff pp.3–4 / 20′ 예시, 실제 계약·청구서 검증 아님')
    slide('03 / DAILY MODEL', '세 사건과 실제 이력을<br>하나의 일별 계획에 넣습니다.',
          '<div class="flow">반출 p <span>→</span>연속 적출 u…u+L−1 <span>→</span>공상자 반납 r</div>' + two(
              ul(['방출 가능일·화물 기한·반납 지연·전체 종료일', '반출/반납 각각 운송 1회, 같은 날이면 2회', '적출 슬롯과 [p,r) 대기 슬롯 / TEU 지원']),
              ul(['이미 실행한 p/u/r 날짜는 정확히 고정', '미실행 사건은 오늘보다 과거로 보내지 않음', '이미 시작한 연속 적출의 나머지 점유 유지'])) +
          box('주문은 처음부터 모두 알려집니다. 미공개 미래 용량·실제 충격 지속기간은 planner에 전달하지 않습니다.'),
          'Every candidate contains all three event dates for every box. Maintain release, delivery, continuous work, return lag, horizon and daily resources. Past execution is immutable, ongoing unloading keeps its remaining occupancy. All orders are known initially; there is no new-order module or oracle future-capacity access.')
    slide('04 / EVIDENCE LAYERS', '서로 다른 증거를<br>섞어서 실제 효과로 부르지 않습니다.',
          table(['층', '현재 확인', '확인하지 않은 것'], [['공개 요율', 'PNC 원문·산례 / Maersk 해석 명시', '모든 단건 계약·실제 발행 청구서'],
            ['합성 연구', f"새 {main_count} 입력 + 개발 {dev_count} 대조", '기업의 시간상/외부 표본 검증'],
            ['독립 구현', '비용·이력·필요 조건·native 상태', '외부 기관 인증·현실 회복 보장'],
            ['공개 입력', f"{schema['customerCount']} 고객 CSV/행렬 직접 감사", 'PNC 원주문·관측된 컨테이너 생애주기']]) +
          box('한국 Maersk 구간 간 누적 산식은 밝혀 둔 모델 해석입니다. 현재 계약과 일치한다고 확정하지 않습니다.'),
          'Public tariffs support declared charge mechanics, not all contracts. Synthetic episodes test the declared scheduling model. Independent implementations check code/model consistency. Public freight CSV audit checks source-backed ingest quality. None substitutes for actual container orders, realized savings or third-party certification.')
    slide('05 / RETROSPECTIVE FAILURE', f"V5의 {diagnosis['summary']['rollingFailedCaseCount']}개 실패를<br>" + ' · '.join(str(x[1]) for x in diag_rows) + '로 나눴습니다.',
          table(['실패가 불가능한 범위', '사례', 'episode'], diag_rows) +
          '<p class="small">명목 시작 / actual 전 경로 / 실패일 관측 + 실행 잠금 모델을 별도 구분합니다.</p>' +
          box(f"{diagnosis['summary']['uniqueDiagnosticModelCount']}개 중복 제거 모델, HiGHS 각 최대 10초의 추가 오프라인 진단입니다. 현재 prefix 불가능을 원래 명목 입력 불가능으로 확대하지 않습니다."),
          f"Retrospective V5 diagnosis covers eight failed cases and sixteen method episodes. Categories are {diag_rows[0][1]} initially nominal-infeasible, {diag_rows[1][1]} infeasible even with the actual future, and {diag_rows[2][1]} with a feasible hindsight path but irrecoverable executed prefixes. Twenty-nine unique models used additional up-to-ten-second native budgets, outside online evaluation.")
    slide('06 / NECESSARY CUTS', f"값싼 불가능 설명은<br>{cuts['summary']['failedEpisodeNecessaryInfeasibilityCount']} / {cuts['summary']['failedMethodEpisodeCount']}만 증명합니다.",
          two(table(['실패일 witness', '최소 / 용량'], [['적출 D+1…D+9', '28 > 27 슬롯일'], ['운송 D+8…D+13', '24 > 22 작업']]),
              cards([(f"{cuts['summary']['failedEpisodeNecessaryInfeasibilityCount']}/{cuts['summary']['failedMethodEpisodeCount']}", '필요조건으로 불가능 증명'),
                     (str(cuts['summary']['unresolvedFailedEpisodeCount']), '위반 미발견 → unknown')])) +
          '<div class="formula">Lₖ(I) = Σᵢ min[t ∈ Tᵢ] aᵢₖ(t,I) &gt; Σ[d ∈ I] Cₖ(d)</div>' +
          '<p class="small">Python 별도 전체 trip 열거로 ' + n(proof['legalTripDomainsEnumerated']) + ' trip, ' + n(proof['intervalsChecked']) + ' 구간, ' + n(proof['publishedWitnessesChecked']) + ' witness를 재검산했습니다.</p>' +
          box('필요조건 통과는 가능·복구·최적의 증거가 아닙니다. 자원 간 결합을 놓칠 수 있습니다.'),
          'For each box, minimize resource use over all individually legal locked trips, then sum these minima over an interval. Demand above interval capacity proves infeasibility. Cuts prove only four of the sixteen old failed episodes; twelve remain unknown. Independent Python enumerates trips without importing JS or invoking a solver. No contradiction is not a feasibility certificate.')
    slide('07 / LOCKED RECOVERY', '현재 잠금 안에서 완전 후보를 만들고,<br>남은 예산으로 비교합니다.',
          '<div class="flow">캐시 검산 <span>→</span>잠금 trip 구성·repair <span>→</span>남은 예산 MILP <span>→</span>완전 후보 선택</div>' +
          two(ul(['현재도 유효한 날짜는 재가격 후 유지', '실행 잠금 도메인·증분 자원·제한 rollback', '부분 구성은 성공/0원 후보가 아님']),
              ul(['전체 호출 협력식 200ms', '구성 최대 40%, 검산용 5ms 확보', '15회 재시작 + 첫 시도 / 정해 둔 seed'])) +
          box('원래 불가능한 조건이나 이미 회복 불가능한 과거를 지우지 않습니다. 보존 계획·구성 후보는 현재 최적을 보장하지 않습니다.'),
          'Recovery adds a separate execution-lock-aware trip constructor, incremental resources, bounded rollback and fixed restarts. Cached valid dates are retained and repriced. Construction and MILP share a cooperative 200ms call budget; this is not a hard 200ms interruption. It can improve earlier choices/search coverage, but cannot undo physical history or create missing capacity.')
    slide('08 / TESTABLE FORECAST', '오늘의 저용량을 하루 더 가정하면<br>오히려 실패할 수 있습니다.',
          '<div class="formula">예측 C(d+1) = min(기존 예측 C(d+1), 오늘 관측 C(d))</div>' +
          two(ul(['과거·오늘은 유지, 내일만 보수적으로 낮춤', '실제 장애 지속기간을 보지 않음', '새 seed 전에 persistenceDays=1 고정']),
              ul(['같은 잠금 복구·캐시·검산 사용', '명목 미래가 가능해도 보수 모형은 불가능할 수 있음', '그 상태는 no_feasible_schedule_found로 공개'])) +
          box('forecastSubproblemStatus를 보존합니다. 보수 자모형 infeasible/optimal을 명목 관측모형의 불가능/최적으로 승격하지 않습니다.'),
          'The one-day forecast is a falsifiable conservative assumption, not knowledge of private shock duration. It caps tomorrow at today observed capacity while preserving history/current day. A conservative subproblem can be infeasible when the nominal observed model is feasible; retain forecastSubproblemStatus and do not claim nominal infeasibility or optimality.')
    slide('09 / FROZEN PROTOCOL', f"새 {main_count}개와 기존 {dev_count}개를<br>분리해 {(main_count + dev_count) * len(METHODS)} episode를 보존했습니다.",
          table(['항목', '고정 정의'], [['새 주 평가', f"{main_count}개 / 3기전 × 2용량 × 24·50·100상자 × 2seed"],
             ['새 seed', f"{min(c['seed'] for c in r['cases'])}…{max(c['seed'] for c in r['cases'])} / source snapshot 먼저 고정"],
             ['개발 대조', f"기존 V5 {dev_count}개, 모든 주 평가 후 별도 실행"],
             ['공통 강제 예산', f"cold 전체 episode {p['budget']['hardWallMs']:,}ms / import·모든 호출·검산·IPC"]]) +
          box('같은 합성 생성기에서 새 seed를 검증했습니다. 실제 업체/기간 외부 검증, 외부 사전등록 또는 동일한 호출별 강제 예산이 아닙니다.'),
          'The prospective local freeze precedes generation/inspection of seeds 81001–81036. All 36 primary and all 24 development controls ran four policies, 240 cold episodes total. Source snapshots are hash-bound. Primary runs precede controls; no parameter or seed changes after first primary run. Common fairness is the parent-enforced full-episode 5000ms, not identical per-call semantics.')
    slide('10 / PRIMARY COMPLETION', '완주는 ' + ' · '.join(str(s['byMethod'][m]['completeCount']) for m in METHODS) + ',<br>100상자에서는 ' + ' · '.join(str(s['byScale']['100']['completeCounts'][m]) for m in METHODS) + '입니다.',
          table(coverage_headers, main_rows) + table(['규모', '사례', '매일', '유지', '복구', '1일 예측'], scale_rows) +
          '<p class="small">모든 실패가 분모에 있습니다. 날짜 변경은 아직 실행하지 않은 사건 날짜의 변경 횟수이며 실제 인건비가 아닙니다.</p>',
          f"Read all methods and scales together. Completion counts are {[s['byMethod'][m]['completeCount'] for m in METHODS]} on {main_count} primary cases. The full panel retains failures, and incomplete terminal fees are null. These are experiment counts, not estimated real-world success probabilities.")
    slide('11 / RECOVERY PRICE', '완료가 늘어난 대가로<br>요금과 변경도 증가했습니다.',
          two(table(['복구 vs 유지', '같은 완전 쌍'], comparison_rows(locked)),
              '<h2>분모와 누락도 공개합니다</h2>' + ul([f"추가요금 기준 {won(locked['baselineIncrementalKRW'])}",
                   f"기준 0원 쌍 {locked['zeroBaselineTotalCount']}개 / 사례별 % 미생성",
                   f"추가 완주 {len(locked['gainedCompletionCaseIds'])}개, 완주 손실 {len(locked['lostCompletionCaseIds'])}개",
                   f"초기 날짜 비교 {eq['equalCaseCount']} 동일 / {eq['differentCaseCount']} 다름 / {eq['unavailableCaseCount']} 미평가"])) +
          box(gain_scope),
          f"Locked recovery gains {len(locked['gainedCompletionCaseIds'])} completions and loses none versus retention, but in {locked['pairedCaseCount']} common complete pairs it is never cheaper: {locked['positiveSavingsCount']} cheaper, {locked['tiedCount']} tied, {locked['negativeSavingsCount']} dearer. Total base is {won(locked['baselineTotalKRW'])}; incremental base {won(locked['baselineIncrementalKRW'])}. Costs increase {pct(-locked['weightedTotalSavingsPct'])} total and {pct(-locked['weightedIncrementalSavingsPct'])} incremental. Revisions rise {locked['baselineRevisionCount']}→{locked['candidateRevisionCount']}. Of the six gains, {len(gained_initial_no_plan)} are initial-search coverage where retention has no day-zero plan; {len(gained_later_different_initial)} is a later successful path with different initial dates. Do not call this the recovery of six identical executed prefixes.")
    slide('12 / NEGATIVE RESULT', '1일 보수 예측은<br>복구보다 완주도 비용도 불리했습니다.',
          two(table(['1일 예측 vs 복구', '같은 완전 쌍'], comparison_rows(forecast)),
              '<h2>주 평가에서 남긴 반례</h2>' + ul([f"추가 완주 {len(forecast['gainedCompletionCaseIds'])} / 잃은 완주 {len(forecast['lostCompletionCaseIds'])}",
                  f"추가요금 기준 {won(forecast['baselineIncrementalKRW'])}",
                  f"총·추가요금 0원 기준 {forecast['zeroBaselineTotalCount']} / {forecast['zeroBaselineIncrementalCount']}쌍",
                  '1일 예측을 일반적인 강건 개선으로 권하지 않음'])) +
          box('성공한 사례만 고르지 않습니다. 비용 증가·완주 손실·forecast 모형 상태를 공개한 채 가설을 기각합니다.'),
          f"The preregistered local one-day assumption underperforms plain recovery on this panel: it gains zero and loses {len(forecast['lostCompletionCaseIds'])} completions, while the {forecast['pairedCaseCount']} joint completions cost {won(-forecast['totalSavingsKRW'])} more. Cheaper/tied/dearer are {forecast['positiveSavingsCount']}/{forecast['tiedCount']}/{forecast['negativeSavingsCount']}, so even the negative aggregate contains favorable cases. Keep them all; do not retune persistence using primary or post-primary development results.")
    slide('13 / RUNTIME & FAIRNESS', '전체 episode에는 공통 한도,<br>각 호출은 다른 예산 의미입니다.',
          table(['정책', 'episode 중앙 ms', 'p95 ms', '호출 최대 ms', '강제 종료'], runtime_rows) +
          '<p>V4/V5: solver 내부 0.2초 / V6: 구성·모델·검산 포함 협력식 200ms</p>' +
          box(f"공통 {p['budget']['hardWallMs']:,}ms episode 내 완료 결과만 인정합니다. 호출 수·실측 시간이 다르므로 동일 총 CPU나 호출 절대 200ms를 주장하지 않습니다."),
          'The cold-episode timer includes imports, all sequential decisions, audits and final IPC. Native binding preparation and stop-check overhead can overrun a cooperative call deadline, recorded in actual call wall time. Method callback counts are not individual native GLPK solve counts. Unknown physical histories/counters after killed children must remain unknown, not zero; this archive reports no hard timeouts.')
    slide('14 / DEVELOPMENT CONTROLS', f"기존 개발 {dev_count}개는<br>새 검증과 합치지 않습니다.",
          table(coverage_headers, dev_rows) + two(
              '<p>복구 vs 유지: 완전 ' + str(devlocked['pairedCaseCount']) + '쌍, 요금 차이 ' + won(-devlocked['totalSavingsKRW']) + ', 날짜 ' + str(devlocked['baselineRevisionCount']) + '→' + str(devlocked['candidateRevisionCount']) + '.</p>',
              '<p>1일 예측 vs 복구: 완주 ' + str(len(devforecast['lostCompletionCaseIds'])) + '개 손실, 완전 ' + str(devforecast['pairedCaseCount']) + '쌍 총요금 +' + won(-devforecast['totalSavingsKRW']) + '.</p>') +
          box('이 입력은 V5 결과를 보고 개발에 사용했습니다. 새로운 독립 표본이 아니며 이번 결과로 주 평가 정책이나 파라미터를 다시 고르지 않습니다.'),
          f"Development controls rerun all {dev_count} old V5 inputs after the primary panel. Counts are {[ds['byMethod'][m]['completeCount'] for m in METHODS]}; recovery provides no completion gain here. Keep the identical-fee recovery result and worse persistence result separate. The control panel is not a second held-out set or a basis for selecting a new tuned policy.")
    slide('15 / PUBLIC INPUT AUDIT', '공개 CSV를 재검산했지만<br>PNC 실주문을 얻었다고 하지 않습니다.',
          cards([(str(schema['customerCount']), f"Delivery {schema['typeCounts']['Delivery']} / Pickup {schema['typeCounts']['Pickup']} + depot"),
                 (str(audit['summary']['passedCheckCount']), '독립 구조 검사 통과'),
                 (str(audit['summary']['unknownSemanticFieldCount']), '의미·업무 필드 미확인')]) +
          table(['확인', '보존한 한계'], [['48×48 · lbs / min / m / sec', '행 ID 없음: 파일 순서 매핑은 구조상 일치'],
             [f"0 유향 arc {zero['offDiagonalZeroCount']} / 비대칭 {zero['asymmetricUnorderedPairCount']}쌍", '좌표 없음: 같은 장소라고 단정하지 않음'],
             ['저자 generated / ORS 행렬 / MIT 라이선스', '원필드 실측 보존·release·shift·차량 용량·요율 없음']]) +
          box(f"{schema['customerCount']}개의 직접 depot-to-customer 도착 판정은 shift start가 없어 null입니다. Arr를 release로 바꾸거나 요율/용량을 만들지 않았습니다."),
          f"The MIT-licensed author repository is a generated instance based on historical California freight, not an MIT university dataset or PNC orders. Independently verify {schema['customerCount']} customers, depot, units, matrix shapes/direction/zeros and source hashes. {audit['summary']['passedCheckCount']} checks pass with {audit['summary']['unknownSemanticFieldCount']} semantic gaps. A missing shift start keeps all {schema['customerCount']} arrival-window tests null. This is source-backed input quality evidence, no route optimization or port-fee performance.")
    slide('16 / CONTRIBUTION BOUNDARY', '새 알고리즘 이름보다<br>검증 가능한 결합과 경계를 제시합니다.',
          two('<h2>이번 응용 기여</h2>' + ul(['한국 요율과 완전 반출·적출·반납 상태', '실행 잠금 복구·필요조건 witness·독립 재검산', '새 입력 전체와 실패/음성 결과의 보존', '실제·파생·합성·접근 실패를 구분한 원자료']),
              '<h2>선례와 미구현</h2>' + ul(['MILP·rolling drayage·ALNS·캐시·repair는 선례', '경로·기사·예약·새 주문·추가 운력 조달 미구현', '단건 계약·세금·실현 작업비 미검증', '첫 알고리즘·기업 배치·세계 최고 주장 없음'])) +
          box('V5 단기 후보 30/36도 보편적 최저요금이 아닙니다. 기존 탐색 대비 4개 손실, 기본 MILP와 완전 쌍에서는 더 비쌌습니다.'),
          'There is direct prior art in demurrage/detention, rolling drayage, MILP, ALNS and pickup/return matching. Claim an inspectable application and evidence chain, not a first algorithm. V5 historical fastEvent coverage is separate from V6: thirty of thirty-six candidates, four fee losses versus event search, and higher paired costs versus raw MILP. Public logistics originals are components with licenses, not matched operational port fee data.')
    slide('17 / REPRODUCE & DEMO', '세 ZIP을 같은 폴더에 합치고,<br>기록에서 실행과 실패를 따라갑니다.',
          table(['다운로드', '내용'], [['① portplan-source.zip', '소스·이전 증거·문서·최초 source snapshot'],
              ['② portplan-experiments-v6.zip', 'V6 전체 원기록·프로토콜·별도 개발 결과'],
              ['③ portplan-public-inputs-v6.zip', '공개 원자료·라이선스·SHA·취득 실패 기록']]) +
          '<div class="flow">요율 산례 <span>→</span>실행 잠금/장애 공개 <span>→</span>전체 주 평가 <span>→</span>실패와 source 감사</div>' +
          box('모두 portplan/ 루트로 같은 부모 폴더에 풀어 합칩니다. 재실행은 새 경로에 기록하고 최초 성적을 덮어쓰지 않습니다.'),
          'All three archives use a common portplan/ root and must be extracted into the same parent directory. Source alone is not the complete V6 evidence package. The webpage uses a projection of the 107MiB archive; the experiment ZIP carries full stage histories. In a short demo show the declared fee mechanism, history locks, causal reveal, full panel and adverse evidence. A chosen playback is an illustration, never a representative cost statistic.')
    slide('18 / AUTHORSHIP & RULES', '조사·구현·자료는 AI가 수행했고,<br>본인 확인과 당해 자격은 미확인입니다.',
          two('<h2>공식 확인</h2>' + ul(['2026.11.6 18:00 자료 마감', '보고서·데이터/코드 일체, 발표 ≤20쪽', '재학생(대학원 포함) / 팀 최대 4명', '정원 40명은 총정원, 잔여 좌석 아님']),
              '<h2>아직 미확인</h2>' + ul(['사용자 재학·신청·본인 이해/검증', 'solo·AI·영어·2026 창작 서약', '공식 배점·발표 시간', '2025 직접 창작·대리 작성 금지는 역사 근거'])) +
          box('이번 V6 연구·개발·시각자료 전체는 AI가 작성했습니다. 사용자 자체 개발이나 자격 충족을 대신 인정하지 않으며 등록·연락·서명하지 않았습니다.'),
          'These are AI-created drafts, not an authorship declaration. The deadline is printed without a separate timezone label; KST is the local-university interpretation. Current student eligibility, up-to-four team membership and a twenty-page slide ceiling are public. Solo, AI interpretation, English, scoring and the 2026 pledge remain unresolved. The historical 2025 pledge required direct creation and prohibited proxy writing/presentation; do not sign it for the user. In checked 2025 recruitment tables 최우수 was highest listed; do not import the new 2026 대상 ranking into 2025.', '2026 공식 페이지 / 2026-10-13 공개 확인 / 18쪽 초안, 참가·작성자 승인 아님')
    require(len(slides) == 18 and len(slides) <= 20, 'Official slide ceiling exceeded')

    # Standalone CSS: copied by value from the previous design, never executes V5.
    css = '\n*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:#e7ecee;color:#16353f;font-family:"Noto Sans CJK KR","Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",Arial,sans-serif;font-size:25px;line-height:1.45;word-break:keep-all}.slide{width:1280px;height:720px;position:relative;margin:24px auto;padding:40px 62px 63px;background:#fbfcfa;box-shadow:0 10px 30px #18313c16;break-after:page;overflow:hidden}.slide:first-of-type{background:#123941;color:#f6faf6}.kicker{font-size:15px;letter-spacing:1.6px;font-weight:700;color:#288377}h1{font-size:43px;line-height:1.22;letter-spacing:-1.4px;margin:13px 0 24px;font-weight:800}.slide:first-of-type h1{font-size:57px}.slide:first-of-type .kicker{color:#8bd9c3}.hero{font-size:44px;font-weight:800;margin:34px 0 24px}.hero span{font-size:25px;font-weight:500}.small{font-size:18px;color:#536d72;margin:15px 0}.slide:first-of-type .small{color:#c1dcd8}.pills{display:flex;gap:13px;margin:25px 0}.pills span{padding:9px 16px;border:1px solid #659b91;border-radius:25px;font-size:20px}.two{display:grid;grid-template-columns:1fr 1fr;gap:34px}.two p,.two li{font-size:23px}p{margin:12px 0}h2{font-size:25px;color:#217f70;margin:8px 0 14px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin:7px 0 24px}.cards article{background:#e7f1ec;border-top:4px solid #3b9a82;padding:19px 20px}.cards strong{font-size:39px;letter-spacing:-1.2px;color:#157462}.cards p{font-size:20px;margin-bottom:0}.callout{border-left:5px solid #d49d36;background:#f6f0dc;padding:12px 17px;font-size:20px;margin:19px 0 0}.flow{display:flex;align-items:center;justify-content:space-between;background:#e7f1ec;padding:21px;margin:0 0 19px;font-size:22px}.flow span{color:#468d80}table{border-collapse:collapse;width:100%;font-size:19px;line-height:1.35;margin:4px 0 14px}th,td{text-align:left;padding:13px 13px;border-bottom:1px solid #cdded7;vertical-align:top}th{background:#e7f1ec;font-size:17px;color:#287562}td:first-child{font-weight:600}ul,ol{padding-left:25px;margin:8px 0 12px}li{margin:8px 0}.formula{font-family:Arial,sans-serif;font-size:25px;background:#e7f1ec;padding:14px 20px;margin-top:17px}pre{background:#edf2ef;font:17px/1.7 monospace;padding:11px 18px;overflow:hidden;white-space:pre-wrap;word-break:break-all}footer{position:absolute;left:62px;right:62px;bottom:18px;display:flex;gap:24px;justify-content:space-between;border-top:1px solid #c4d7d0;padding-top:9px;font-size:13px;color:#526e72;line-height:1.35}footer span:first-child{max-width:1030px}.slide:first-of-type footer{color:#b7d5ce;border-color:#507970}.toolbar{width:1280px;margin:16px auto;display:flex;gap:15px;align-items:center;font-size:17px}.toolbar button{font:inherit;border:0;background:#163b43;color:white;padding:9px 16px;border-radius:5px;cursor:pointer}.draft{color:#516a72}a{color:inherit}@page{size:1280px 720px;margin:0}@media print{.toolbar{display:none}body{background:white}.slide{margin:0;box-shadow:none;print-color-adjust:exact;-webkit-print-color-adjust:exact}.slide:last-of-type{break-after:auto}}@media screen and (max-width:1280px){body{min-width:1280px}}\n\n.slide h1{font-size:46px;line-height:1.17;margin-bottom:22px}.slide:first-of-type h1{font-size:56px}.slide h2{font-size:25px}.body{font-size:20px;line-height:1.45}.body table{font-size:17px;line-height:1.32}.body th{font-size:15px}.body th,.body td{padding:9px 10px}.body .small{font-size:17px}.body .callout{font-size:18px;padding:10px 15px;margin-top:14px}.body .cards article{padding:15px 17px}.body .cards strong{font-size:36px}.body .cards p{font-size:18px}.two .cards{grid-template-columns:repeat(2,1fr)}.body .flow{font-size:20px;padding:17px}.body li{margin:7px 0}.body .formula{font-size:23px}.body p{margin-top:8px;margin-bottom:12px}\n'
    css += "\n.body .cards article,.body .callout{color:#16353f}\n"
    sections = [f'<section class="slide" id="slide-{i}" aria-label="{i}. {escape(sl["title"].replace("<br>", " "))}"><div class="kicker">{sl["kicker"]}</div><h1>{sl["title"]}</h1><div class="body">{sl["body"]}</div><footer><span>{escape(sl["footer"])}</span><span>PORTPLAN V6 / {i:02d}</span></footer></section>' for i, sl in enumerate(slides, 1)]
    html = '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PortPlan V6 · Korean research draft</title><style>' + css + '</style></head><body><nav class="toolbar"><button onclick="window.print()">PDF 인쇄</button><span>18쪽 · 실제 원자료 기반 AI 작성 초안 · 본인 확인 미완료</span></nav>' + '\n'.join(sections) + '</body></html>'
    provenance = mt(['실제 입력', 'SHA-256'], [[path, '`' + h + '`'] for path, h in hashes.items()])
    comp_headers = ['비교 (후보−기준)', '쌍', '후보 낮음/동일/높음', '총요금 증가', '총 분모', '추가 분모', '총 증가율', '추가 증가율', '0원 총/추가']
    def comp_row(label, item):
        return [label, item['pairedCaseCount'], f"{item['positiveSavingsCount']}/{item['tiedCount']}/{item['negativeSavingsCount']}", won(-item['totalSavingsKRW']),
                won(item['baselineTotalKRW']), won(item['baselineIncrementalKRW']), pct(-item['weightedTotalSavingsPct'], 6), pct(-item['weightedIncrementalSavingsPct'], 6),
                f"{item['zeroBaselineTotalCount']}/{item['zeroBaselineIncrementalCount']}"]
    comp_rows = [comp_row(LABELS[item['candidateMethod']] + ' − ' + LABELS[item['baselineMethod']], item) for item in s['comparisons'].values()]
    dev_comp_rows = [comp_row(LABELS[item['candidateMethod']] + ' − ' + LABELS[item['baselineMethod']], item) for item in ds['comparisons'].values()]
    notes = ['# PortPlan V6 — English understanding notes', '', f'Generated {generated}. This is an AI-created Korean research draft, not approval of entrant authorship, registration, eligibility or English delivery.', '']
    korean = ['# PortPlan V6 연구 보고서 초안', '', f'생성 {generated}. 발표 18쪽. 실제 완결된 원자료와 해시를 검사한 AI 작성 연구 초안이며 참가·본인 창작 확인 서류가 아니다.', '',
              '## 초록', '', f"새 합성 입력 {main_count}개에서 일별 MILP, 유효 계획 유지, 실행 잠금 복구, 1일 보수 예측 복구의 완주 수는 각각 " + '·'.join(str(s['byMethod'][m]['completeCount']) for m in METHODS) +
              f"였다. 잠금 복구는 유지 대비 {len(locked['gainedCompletionCaseIds'])}개의 추가 완주를 얻었지만, 완전 {locked['pairedCaseCount']}쌍에서 총요금 {won(-locked['totalSavingsKRW'])}와 날짜 변경이 늘었다. 1일 예측은 복구 대비 {len(forecast['lostCompletionCaseIds'])}개의 완주를 잃고 완전 {forecast['pairedCaseCount']}쌍에서 {won(-forecast['totalSavingsKRW'])} 더 비쌌다. 완주 차이를 절감액으로 바꾸지 않으며 24개 개발 입력은 별도 보고한다.", '']
    for i, sl in enumerate(slides, 1):
        notes += [f"## {i:02d}. {sl['title'].replace('<br>', ' ')}", '', sl['notes'], '']
    korean += ['## 업무 문제와 공개 요율', '', f"[PNC 공식 2026 PDF]({PNC})의 소급 방식으로 20피트 14일 318,500원, 15일 500,500원의 차이는 182,000원이다. 공개 표준 요율 산례이며 실제 invoice/최적화 절감은 아니다. 한국 Maersk 구간 누적은 명시한 모델 해석이며 단건 계약과 일치함을 확인하지 않았다. 날짜 목표는 공동 추가요금(수명 전체 요금에서 계획 전 발생분을 뺀 값)이고 경로·기사·예약·새 주문·실현 작업비·세금은 미구현이다.", '',
        '## 방법과 프로토콜', '', f"원자료 protocolVersion `{p['protocolVersion']}`. 모든 주문은 초기 알려지고 미래 충격과 지속기간은 비공개다. 현재 이력과 진행 중 적출은 정확히 보존한다. 잠금 복구는 유효 캐시를 재가격·검산하고 무효/초기 시 잠금 trip 구성/제한 repair 후 남은 예산 MILP와 완전 후보를 비교한다. 200ms는 협력식 함수 한도이며 호출 최대벽시계가 넘을 수 있다. 1일 예측은 내일의 용량을 오늘 관측과 명목 예측의 최소로 낮추는 가정이다. 보수 자모형의 infeasible/optimal은 명목 모형의 불가능/최적으로 승격하지 않는다.", '',
        f"공통 cold episode 강제 한도는 {p['budget']['hardWallMs']:,}ms이며 import, 모든 호출, 모델·검산, 완전 결과 IPC를 포함한다. 기존 정책의 내부 solver 0.2초와 새 정책의 함수 전체 200ms 의미는 다르다. 동일 총 CPU/동일 강제 호출 한도가 아니다. 새 seed 범위와 source snapshot은 최초 생성 전에 로컬 고정했으나 외부 사전등록이 아니다. 모든 주 평가 후 개발 대조를 실행했고 이번 결과로 정책이나 예측일수를 수정하지 않았다.", '',
        '## 새 주 평가 — 전체 분모', '', mt(coverage_headers, main_rows), '', mt(['상자수', '사례', '매일', '유지', '잠금복구', '1일예측'], scale_rows), '',
        '## 새 주 평가 — 완전 쌍의 요금', '', mt(comp_headers, comp_rows), '',
        '요금 증가 = 후보−기준. 기록의 savings 필드는 반대로 기준−후보다. 분모가 0이면 %는 null이고 0원 쌍을 삭제하지 않는다. 비용은 모두 두 정책이 끝까지 완료한 동일 사례에만 비교하며 실패 비용은 null이다. 각 비교의 쌍은 다르다.', '',
        mt(['비교', '기준/후보 누락', '날짜 변경 기준→후보', '최악 증가', '얻은/잃은 완주'], [[key, f"{item['missingBaselineCount']}/{item['missingCandidateCount']}", f"{item['baselineRevisionCount']}→{item['candidateRevisionCount']}", won(item['worstLossKRW']), f"{len(item['gainedCompletionCaseIds'])}/{len(item['lostCompletionCaseIds'])}"] for key, item in s['comparisons'].items()]), '',
        '날짜 변경은 미실행 p/u/r 날짜의 변경 횟수이고 인건비·개별 상자 수·actual 변경 수가 아니다. Initial equality는 완전 검산된 시작 계획만 비교하며 빈 기록은 동등 계획이 아니다.', '',
        gain_scope, '',
        mt(['추가 완주 사례', '기준 무후보 시점', '초기 날짜 비교', '해석'], [[c['id'], c['policies']['stableRetainV5']['failure']['day'],
            str(c['initialComparison']['pairs']['stableRetainV5__lockedRecoveryV6']['decisionsEqual']),
            '초기 검색 완전 후보 확보' if c in gained_initial_no_plan else '다른 초기 계획의 후속 성공; 같은 prefix 인과효과 아님'] for c in gained]), '',
        mt(['시작 비교', '평가', '동일', '다름', '미평가'], [[key, item['evaluatedCaseCount'], item['equalCaseCount'], item['differentCaseCount'], item['unavailableCaseCount']] for key, item in s['initialEquality']['pairs'].items()]), '',
        '## 전체 실행의 계산 기록', '', mt(['정책', 'episode 중앙 ms', 'p95 ms', '호출 최대 ms', '강제 종료'], runtime_rows), '',
        f"새 주 평가 완전 terminal audit {s['terminalAudit']['completeEpisodes']}개, 기록된 audit 실패 {s['terminalAudit']['failedAudits']}개. 알려진 physical execution 실패와 결과 전달 불가/이력 미확보는 구분한다. 실제 종료가 늦어도 기록된 IPC 수신 시점을 기준으로 강제 한도 내 완주를 판정한다. solverCalls는 callback 횟수이며 내부 두 단계 원생 GLPK 호출 횟수와 같다고 하지 않는다.", '',
        '## 24개 개발 대조 — 별도 분모', '', mt(coverage_headers, dev_rows), '', mt(comp_headers, dev_comp_rows), '',
        'V5 입력은 방법 개발에 사용되었다. 새 독립 표본이나 추가 검증 24개로 합치지 않는다. 개발 성적을 보고 새 주 평가 정책을 고르거나 seed/파라미터를 교체하지 않는다.', '',
        '## 기존 V5 실패의 오프라인 진단', '', mt(['범위', '사례', 'episode'], diag_rows), '',
        f"{diagnosis['summary']['uniqueDiagnosticModelCount']}개 중복 제거 모델의 추가 HiGHS 진단은 {diagnosis['method']['timeLimitSecondsPerUniqueModel']}초/모델이다. solverStatus=2 또는 분석적 공집합만 불가능으로 인정하며 timeout/no incumbent를 불가능으로 바꾸지 않는다. 현재 잠긴 prefix의 불가능은 초기 명목 모델이나 실제 사업의 영구 불가능을 뜻하지 않는다. 한 사례는 actual 전 경로가 가능하지만 과거 실행 후 연속이 불가능했다. 이 범위는 기존 V5에만 적용하며 V6 새 실패에 동일 native 증명이 있다고 주장하지 않는다.", '',
        '## 필요조건 witness와 independent review', '', f"기존 16 실패 episode 가운데 {cuts['summary']['failedEpisodeNecessaryInfeasibilityCount']}개만 필요조건으로 증명하며 {cuts['summary']['unresolvedFailedEpisodeCount']}개는 unknown이다. D+1…9 적출 최소 28>27, D+8…13 운송 24>22가 두 종류 witness다. {proof['explanationInputsChecked']} 입력, {n(proof['legalTripDomainsEnumerated'])} 합법 trip, {n(proof['intervalsChecked'])} 구간, {proof['publishedWitnessesChecked']} witness를 별도 Python이 JS/solver 없이 검사했다. 자원별 독립 최소값은 결합 충돌을 놓칠 수 있으므로 위반 없음은 가능을 뜻하지 않는다.", '',
        '## 실제 공개 입력과 source 감사', '', f"저자 MIT 라이선스 California 연구 인스턴스: 고객 {schema['customerCount']}개(Delivery {schema['typeCounts']['Delivery']}, Pickup {schema['typeCounts']['Pickup']})와 depot, 양 행렬 48×48. 독립 구조 검사 {audit['summary']['passedCheckCount']}개 통과, 의미 공백 {audit['summary']['unknownSemanticFieldCount']}개. MIT는 라이선스이며 MIT 기관 데이터로 표시하지 않는다. 저자는 역사 기반 generated라고 설명하고 행렬은 ORS 생성 추정이다. 실제 실측 그대로인 필드 목록은 미공개다. 파일 순서 row i→ID i는 구조상 일치지만 저자의 명시 row label이 없다. 각 행렬 비대각 0 유향 arc {zero['offDiagonalZeroCount']}개와 비대칭 무향 pair {zero['asymmetricUnorderedPairCount']}개를 보존했고 원인/좌표는 미확인이다. shift start가 없어 직접 도착 판정 {schema['customerCount']}개 모두 null이다. Arr를 release로 바꾸거나 운력·요율·port event를 생성하지 않았다.", '',
        mt(['자료', '실제/파생의 근거', '라이선스 / 범위'], [[f"[{x['id']}]({x['landingUrl']})" if x.get('landingUrl') else x['id'], x.get('sourceType', '별도 catalogue'), x.get('license', '미확인')] for x in sources['sources']]), '',
        '현재 완전 PortPlan shipment-core dataset은 확보하지 못했다. Amazon practice는 CC BY-NC 4.0, Pharma 자료는 CC BY 4.0, 벌크 항만 OCEL은 컨테이너 아닌 별도 이벤트 구성요소다. Dryad 원 ZIP과 일부 원청자료는 접근 실패/미확보로 남기고 GitHub digest와 바꾸지 않는다. 어떤 세계적 데이터 부재도 주장하지 않는다. 개별 source 원자료·다운로드/실패·LICENSE는 공개입력 ZIP에 있다.', '',
        '## 선례·제한·다음 검증', '', 'MILP, rolling drayage, ALNS, 캐시, repair와 상용 반출/반납 matching은 선례가 있다. 기여는 공개 한국 요율과 실행 상태, 짧은 예산 완전 후보, 잠금 복구/필요조건 및 내부 독립 감사의 확인 가능한 결합이다. 최초, 일반 우월, 실현 절감, 세계 최고나 입상 확률을 주장하지 않는다. 동일 생성기 새 seed는 기업·시간상 외부 검증이 아니며 한정된 충격 종류와 모든 주문 초기 공개라는 조건을 유지한다.', '',
        'V5 역사 비교: fastEvent는 1초 36개 중 30개, 기존 event 27개, raw MILP 24개 후보. event 완전 27쌍에 4개 비용 손실이 있고 raw 대비 더 비쌌다. V5 정적 6개 무후보 중 1개 native 불가능/5개 추가 예산 가능이었으며 V6 완료 성적에 합산하지 않는다. 새로운 방법의 7개 실패를 전부 모델 불가능으로 해석하지 않는다. 추가 운력·기한 협상·실주문/개별 계약·예약/경로·실제 업무비는 별도 데이터와 개입 모델이 필요하다.', '',
        '## 공식 상태와 실제 작성 기여', '', f"[2026 공식 페이지]({OFFICIAL})는 11월6일18:00 마감, 보고서·데이터/코드 일체, 발표≤20쪽, 창원대 재학생(대학원 포함), 최대4인 팀과 총정원40명을 명시한다. 페이지에 별도 시각대 라벨은 없고 KST는 현지 해석이다. 2026-10-13 공개 재확인에서 실질 변경은 찾지 못했다. 사용자 등록·재학, solo, AI, 영어, 점수 가중치·발표 시간, 2026 창작 서약은 미확인이다. 2025 서약의 직접 창작/대리 작성 금지와 2026 적용 여부를 구별한다. 확인한 2025 모집상 최우수는 당시 최고 열거 상이고 2026 대상 순위를 소급하지 않는다. 최종 2025 전체 수상표는 미확보다.", '',
        'V6 조사·개발·계산 실행·감사·보고서·발표 자료는 AI가 수행했다. 사용자 본인의 개발, 검증 또는 이해 완료는 확인되지 않았다. 등록, 외부 연락, 대리 서명/발표를 하지 않았다. 본 보고서는 작성자 자격 충족을 주장하는 서약이 아니다.', '',
        '## 전체 주 평가 사례 — 누락을 지우지 않는 표', '', mt(['사례', '상자수'] + [LABELS[m] for m in METHODS], [[c['id'], c['count']] + [(won(c['policies'][m]['totalCost']) + ' / complete') if complete(c['policies'][m]) else 'null / ' + c['policies'][m]['status'] for m in METHODS] for c in r['cases']]), '',
        '## 전체 개발 대조 사례 — 별도 표', '', mt(['사례', '상자수'] + [LABELS[m] for m in METHODS], [[c['id'], c['count']] + [(won(c['policies'][m]['totalCost']) + ' / complete') if complete(c['policies'][m]) else 'null / ' + c['policies'][m]['status'] for m in METHODS] for c in r['developmentControls']['cases']]), '',
        '## 모든 비용 음성 사례 ID와 완료 변경', '']
    for key, item in s['comparisons'].items():
        korean += ['### ' + key, '', '후보 더 비싼 사례: ' + ', '.join('`' + x + '`' for x in item['negativeSavingsCaseIds']) + '.', '',
                   '추가 완주: ' + (', '.join('`' + x + '`' for x in item['gainedCompletionCaseIds']) or '없음') + '.', '',
                   '잃은 완주: ' + (', '.join('`' + x + '`' for x in item['lostCompletionCaseIds']) or '없음') + '.', '']
    korean += ['## 재현과 전달', '', '세 ZIP은 모두 portplan/ 아래로 압축되어 같은 부모 디렉터리에 풀어 합쳐야 전체 자료가 된다. portplan-source.zip은 소스/기존 증거, portplan-experiments-v6.zip은 전체 V6 실험, portplan-public-inputs-v6.zip은 공개 원자료/라이선스다. 웹 projection은 전체 로그의 대체 원본이 아니다. 아래 재실행은 새 파일에 쓰고 first-run 원본을 덮어쓰지 않는다.', '',
        '```sh', 'npm ci --prefix vendor/experiments/v6-first-run-source',
        'node vendor/experiments/v6-first-run-source/scripts/rolling-benchmark-v6.mjs --output artifacts/repro-rolling-v6.json',
        'python scripts/audit-public-orders-v6.py --output artifacts/repro-public-audit-v6.json --report artifacts/repro-public-audit-v6.md',
        'python scripts/build-defense-v6.py --require-results', '```', '',
        '실제 성적은 frozen source snapshot을 사용해 재현하고 한도 결과는 기기/부하에 따라 달라질 수 있다. 현재 소스와 최초 실행 해시의 차이는 공개해도 최초 증거를 다시 이름 붙이지 않는다. PDF와 화면 가독성 확인은 별도 최종 산출이며 본 스크립트는 브라우저나 실험을 실행하지 않는다.', '', TRANSPORT_KO, '', '## 출처 바이트', '', provenance, '']
    notes += ['## Full paired denominators', '', mt(comp_headers, comp_rows), '', TRANSPORT_EN, '', '## Hash-bound actual inputs', '', provenance, '',
              'Extract all three evidence ZIPs into the same parent directory. Do not sign personal authorship or repeat proxy-written notes as proof of the entrant’s understanding. The draft is an inspectable research deliverable; official AI eligibility and personal authorship remain unresolved.', '']
    contribution = ['# PortPlan V6 실제 기여 기록', '', f'생성 {generated}. 이 문서는 AI 자체 수행 기록이며 사용자 본인 창작·검증·참가 자격 확인서가 아니다.', '',
        '| 작업 | 실제 수행 주체 | 근거 / 범위 |', '|---|---|---|',
        '| 공개 규칙·선례·자료 조사 | AI | 원문·다운로드·SHA·접근 실패를 보존; 연락/등록 없음 |',
        '| 실행 잠금 복구·1일 예측·필요조건 구현 | AI | 소스와 최초 실행 snapshot, 고정 synthetic fixture 검증 |',
        '| 기존 실패 native 진단·독립 Python 감사 | AI | 별도 구현/추가 오프라인 예산; 외부 기관 인증 아님 |',
        '| 새 고정 36입력과 개발24×4정책 실행 | AI | 최초 프로토콜·전체240episode와 음성 결과 |',
        '| 실제 공개 입력 CSV·행렬 독립 감사 | AI |39 checks/11 gaps; 원실측/PNC 주문으로 승격하지 않음 |',
        '| 웹·자료·韓文 발표·영문 이해 노트 작성 | AI |18쪽 초안; PDF/화면 최종 검토 별도 |',
        '| 사용자 본인의 직접 구현·검증·이해 완료 | 확인되지 않음 |자체 개발이나 검토 완료라고 대리 기재하지 않음 |', '',
        '기반 라이브러리 GLPK/HiGHS/SciPy 및 기존 연구, 공개 요율, 데이터 저작권·라이선스는 원 소유자에 귀속한다. 이 기록은 AI 수행을 사용자 개인 기여로 옮기지 않는다. 2025 창작 서약의 직접 창작 및 대리 작성/발표 금지와 2026의 확인되지 않은 적용·AI 해석을 구분한다. 참가 신청·연락·대리 서명/발표는 하지 않았다.', '',
        '새 주 평가를 본 뒤 파라미터·seed를 교체하거나 개발24로 새 방법을 재선택하지 않았다. 비용 음성·미완료·0원·unknown을 제외하지 않은 자료를 유지한다. 본인의 검토/수정이 실제로 생기면 범위와 날짜·증거를 따로 기록해야 하며 자동으로 완료 표시하지 않는다.', '',
        TRANSPORT_KO, '', '## 이번 자료 생성 입력', '', provenance, '']
    outputs = {'docs/defense-v6.ko.html': html, 'docs/submission-v6.ko.md': '\n'.join(korean),
               'docs/defense-v6.en.md': '\n'.join(notes), 'docs/contribution-log-v6.md': '\n'.join(contribution)}
    for path, text in outputs.items():
        (ROOT / path).write_text(text, encoding='utf-8')
    print(json.dumps({'state': 'complete_actual_evidence_draft', 'pages': len(slides), 'primaryCases': main_count,
                      'developmentControls': dev_count, 'episodes': (main_count + dev_count) * len(METHODS),
                      'rollingSha256': hashes['data/rolling-v6.json'], 'outputs': list(outputs)}, ensure_ascii=False))


if __name__ == '__main__':
    main()
