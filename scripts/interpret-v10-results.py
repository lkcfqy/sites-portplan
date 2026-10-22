#!/usr/bin/env python3
"""Posthoc read-only V10 descriptive counts. No solver or generator is run.

Authored after the preserved first run, outside its prespecified method. This
does not replace either independent physical review or bootstrap replication.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
METHODS = ('highsV8', 'stableHiGHSV10')
SOURCE_KEYS = ('scripts/highs-planner-v10.mjs', 'scripts/highs-planner-v8.mjs',
               'scripts/highs-service-v8.py', 'scripts/benchmark-v10.mjs',
               'scripts/episode-v10.worker.mjs', 'scripts/benchmark-v2.mjs',
               'src/adaptive-planner-v9.js', 'data/protocol-v10.json')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def bound(root, artifact):
    path = root / artifact['path']
    raw = path.read_bytes()
    if sha(raw) != artifact['sha256']:
        raise ValueError(f'Artifact SHA differs: {path}')
    return json.loads(raw)


def fresh():
    return {'episodes': 0, 'completeEpisodes': 0, 'calls': 0, 'solverCalls': 0,
            'workerAndNativeStartupMs': [], 'episodeParentWallMs': [], 'callWallMs': [],
            'readyAtCallStartCount': 0, 'nativeStatusCounts': Counter(), 'failureKinds': Counter(),
            'failureRecords': [], 'cacheStatusCounts': Counter(), 'decisionReasonCounts': Counter(),
            'nativeGateOutcomeCounts': Counter(), 'selectedSourceCounts': Counter(),
            'cacheAcceptedCalls': 0, 'nativeAcceptedCalls': 0, 'proposalCount': 0,
            'timelyFeeTieRetainedCalls': 0, 'feeTieWithDifferentProposalCalls': 0,
            'feeTieProposalChangedEventsSum': 0, 'strictReplacementCalls': 0,
            'costlierRetainedCalls': 0, 'lateCandidateRetainedCacheCalls': 0,
            'lateReceiptRetainedCacheCalls': 0, 'retainedCacheAfterNoIncumbentCalls': 0,
            'cacheAcceptedThenCallOver200Ms': 0, 'callsOver200Ms': 0,
            'proposalCheaperThanValidCacheCalls': 0, 'initializationAcceptedCalls': 0,
            'invalidCacheRecoveryAcceptedCalls': 0}


def descriptive(values):
    return {'count': len(values), 'mean': sum(values) / len(values) if values else None,
            'minimum': min(values) if values else None, 'maximum': max(values) if values else None}


def analyze(index_path):
    raw = index_path.read_bytes()
    index = json.loads(raw)
    if index['executionState'] != 'complete':
        raise ValueError('Complete preserved first-run index required')
    root = index_path.parent
    manifest_path = root.parent / 'manifest.json'
    manifest = json.loads(manifest_path.read_bytes())
    for key in SOURCE_KEYS:
        expected = index['implementationHashes'][key]
        if manifest['implementationHashes'][key] != expected or sha((root.parent / 'source' / key).read_bytes()) != expected:
            raise ValueError('Frozen implementation binding differs: ' + key)
    reviews = {}
    for filename in ('data/review-v10.json', 'data/bootstrap-review-v10.json'):
        path = ROOT / filename
        review_raw = path.read_bytes()
        review = json.loads(review_raw)
        if review.get('valid') is not True or review.get('inputIndexSha256') != sha(raw):
            raise ValueError('Independent review is not valid for this index: ' + filename)
        reviews[filename] = sha(review_raw)
    panels = {panel: {method: fresh() for method in METHODS} for panel in index['summary']['panels']}
    for case in index['cases']:
        for repeat in case['repeats']:
            for method in METHODS:
                counts = panels[case['panel']][method]
                receipt = repeat['policies'][method]
                record = bound(root, receipt['artifact'])
                result = record['result']
                episode_id = case['id'] + '::repeat-' + str(repeat['repeatIndex'])
                counts['episodes'] += 1
                counts['completeEpisodes'] += result.get('complete') is True
                counts['solverCalls'] += result['plannerStats']['solverCalls']
                counts['workerAndNativeStartupMs'].append(result['startupWallMs'])
                counts['episodeParentWallMs'].append(result['wallTimeMs'])
                for call in result['plannerTrace']:
                    counts['calls'] += 1
                    counts['callWallMs'].append(call['callWallMs'])
                    counts['callsOver200Ms'] += call['callWallMs'] > 200
                    counts['readyAtCallStartCount'] += call['stages'].get('readyAtCallStart') is True
                    counts['nativeStatusCounts'][call['stages'].get('native', {}).get('status', 'absent')] += 1
                    if method != 'stableHiGHSV10':
                        continue
                    proof = call['stabilitySelection']
                    reason, outcome, source = proof['decisionReason'], proof['nativeGate']['outcome'], proof['selectedSource']
                    counts['cacheStatusCounts'][proof['cacheStatus']] += 1
                    counts['decisionReasonCounts'][reason] += 1
                    counts['nativeGateOutcomeCounts'][outcome] += 1
                    counts['selectedSourceCounts'][source] += 1
                    cache_accepted = proof['cacheGate']['acceptedAtMs'] is not None
                    native_accepted = proof['nativeGate']['acceptedAtMs'] is not None
                    counts['cacheAcceptedCalls'] += cache_accepted
                    counts['nativeAcceptedCalls'] += native_accepted
                    counts['proposalCount'] += proof['proposalDates'] is not None
                    if reason == 'retain_fee_tie':
                        counts['timelyFeeTieRetainedCalls'] += 1
                        counts['feeTieWithDifferentProposalCalls'] += proof['proposalChangedEventCount'] > 0
                        counts['feeTieProposalChangedEventsSum'] += proof['proposalChangedEventCount']
                    counts['strictReplacementCalls'] += reason == 'strict_fee_replacement'
                    counts['costlierRetainedCalls'] += reason == 'retain_costlier_native'
                    if source == 'cached_incumbent':
                        counts['lateCandidateRetainedCacheCalls'] += outcome == 'late_candidate'
                        counts['lateReceiptRetainedCacheCalls'] += proof['nativeGate']['receivedAtMs'] is not None and proof['nativeGate']['receivedAtMs'] > 200
                        counts['retainedCacheAfterNoIncumbentCalls'] += outcome == 'no_incumbent'
                    counts['cacheAcceptedThenCallOver200Ms'] += cache_accepted and call['callWallMs'] > 200
                    difference = proof['nativeCostMinusCacheKRW']
                    counts['proposalCheaperThanValidCacheCalls'] += difference is not None and difference < -1e-6
                    counts['initializationAcceptedCalls'] += reason == 'initialize_native'
                    counts['invalidCacheRecoveryAcceptedCalls'] += reason == 'replace_invalid_cache'
                if not result['complete']:
                    failure, call = result['failure'], result['plannerTrace'][-1]
                    counts['failureKinds'][failure['kind']] += 1
                    proof = call.get('stabilitySelection', {})
                    counts['failureRecords'].append({'episodeId': episode_id, 'day': failure['day'], 'kind': failure['kind'],
                        'plannerStatus': failure.get('plannerStatus'), 'nativeStatus': call['stages'].get('native', {}).get('status', 'absent'),
                        'callWallMs': call['callWallMs'], 'nativeGateOutcome': proof.get('nativeGate', {}).get('outcome'),
                        'cacheStatus': proof.get('cacheStatus'), 'artifact': receipt['artifact']})
    for methods in panels.values():
        for method, counts in methods.items():
            for field in ('workerAndNativeStartupMs', 'episodeParentWallMs', 'callWallMs'):
                counts[field] = descriptive(counts[field])
            counts['failureNativeStatusCounts'] = Counter(row['nativeStatus'] for row in counts['failureRecords'])
            counts['failurePlannerStatusCounts'] = Counter(row['plannerStatus'] for row in counts['failureRecords'])
            counts['failureDayCounts'] = Counter(str(row['day']) for row in counts['failureRecords'])
            counts['failureNativeGateOutcomeCounts'] = Counter(row['nativeGateOutcome'] for row in counts['failureRecords'])
            if method == 'highsV8':
                # V8 does not emit V10 selection evidence. Do not present
                # unmeasured tie/cache diagnostics as observed zeros.
                for key in ('cacheStatusCounts', 'decisionReasonCounts', 'nativeGateOutcomeCounts', 'selectedSourceCounts',
                            'cacheAcceptedCalls', 'nativeAcceptedCalls', 'proposalCount', 'timelyFeeTieRetainedCalls',
                            'feeTieWithDifferentProposalCalls', 'feeTieProposalChangedEventsSum', 'strictReplacementCalls',
                            'costlierRetainedCalls', 'lateCandidateRetainedCacheCalls', 'lateReceiptRetainedCacheCalls',
                            'retainedCacheAfterNoIncumbentCalls', 'cacheAcceptedThenCallOver200Ms',
                            'proposalCheaperThanValidCacheCalls', 'initializationAcceptedCalls',
                            'invalidCacheRecoveryAcceptedCalls', 'failureNativeGateOutcomeCounts'):
                    del counts[key]
                counts['selectionEvidenceScope'] = 'V10 selection diagnostics are not emitted or measured for the unchanged original V8 native baseline.'
    return {'schemaVersion': 'portplan-v10-posthoc-descriptive-interpretation-1', 'readOnlyInputs': True, 'solverRuns': 0,
            'scriptSha256': sha(Path(__file__).read_bytes()), 'inputIndexSha256': sha(raw),
            'protocolSha256': index['protocolHash'], 'frozenManifestSha256': sha(manifest_path.read_bytes()),
            'frozenImplementationHashes': {key: index['implementationHashes'][key] for key in SOURCE_KEYS},
            'independentReviewSha256': reviews,
            'method': 'All 432 original-native and 432 V10 SHA-bound episodes, recorded selection proofs and timestamps only; no optimizer/generator rerun or bootstrap recomputation.',
            'panels': panels}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--index', type=Path, default=ROOT / 'artifacts/v10-frozen-first/first-run/complete.json')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    output = json.dumps(analyze(args.index.resolve()), ensure_ascii=False, indent=2) + '\n'
    if args.output:
        with args.output.open('x', encoding='utf-8') as stream:
            stream.write(output)
    else:
        print(output, end='')


if __name__ == '__main__':
    main()
