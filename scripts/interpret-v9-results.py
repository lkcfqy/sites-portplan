#!/usr/bin/env python3
"""Post-run descriptive counts only: read bound V9 artifacts, never solve.

This script is authored after the first run. It is not the prospective protocol,
an independent physical auditor, or a source of new optimizer evaluations.
"""
import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def sha(data):
    return hashlib.sha256(data).hexdigest()


def bound(root, artifact):
    path = root / artifact['path']
    raw = path.read_bytes()
    if sha(raw) != artifact['sha256']:
        raise ValueError(f'Artifact SHA differs: {path}')
    return json.loads(raw)


def fresh():
    return {'episodes': 0, 'completeEpisodes': 0, 'calls': 0, 'callsWithAcceptedIncumbent': 0,
            'timelyIncumbentThenCallOver200Ms': 0, 'recoveryTimelyIncumbentThenCallOver200Ms': 0,
            'timelyIncumbentThenOver200MsCompleteEpisodes': [], 'timelyIncumbentThenOver200MsFailedEpisodes': [],
            'actionCounts': Counter(), 'acceptedSourceCounts': Counter(), 'selectedSourceCounts': Counter(),
            'candidateOutcomeCounts': Counter(), 'strictReplacementSourceCounts': Counter(),
            'adaptivePolishCalls': 0, 'adaptivePolishAcceptedCalls': 0,
            'recoveryPolishInvocations': 0, 'recoveryPolishAcceptedCandidates': 0,
            'polishInternalAcceptedMoves': 0, 'failureKinds': Counter(), 'failureDayCounts': Counter(),
            'failedCallMILPStatus': Counter(), 'failedCallConstructorDeadlineReached': 0,
            'failedCallLateValidAuditCandidates': 0, 'failedCallLateReceiptCandidates': 0,
            'failureRecords': []}


def analyze(index_path):
    raw = index_path.read_bytes()
    index = json.loads(raw)
    if index['executionState'] != 'complete':
        raise ValueError('A complete immutable first-run index is required')
    root = index_path.parent
    panels = {name: fresh() for name in index['summary']['panels']}
    for case in index['cases']:
        counts = panels[case['panel']]
        for repeat in case['repeats']:
            receipt = repeat['policies']['adaptiveV9']
            record = bound(root, receipt['artifact'])
            result = record['result']
            episode_id = case['id'] + '::repeat-' + str(repeat['repeatIndex'])
            counts['episodes'] += 1
            counts['completeEpisodes'] += result.get('complete') is True
            late_calls = 0
            for call in result['plannerTrace']:
                counts['calls'] += 1
                action = call['action']
                counts['actionCounts'][action] += 1
                gate = call['candidateDelivery']
                accepted = [event for event in gate['events'] if event['outcome'] == 'accepted']
                if accepted:
                    counts['callsWithAcceptedIncumbent'] += 1
                    counts['selectedSourceCounts'][accepted[-1]['source']] += 1
                if accepted and call['callWallMs'] > 200:
                    late_calls += 1
                    counts['timelyIncumbentThenCallOver200Ms'] += 1
                    if action in ('initialize', 'rebuild'):
                        counts['recoveryTimelyIncumbentThenCallOver200Ms'] += 1
                previous_fee = None
                for event in gate['events']:
                    counts['candidateOutcomeCounts'][event['outcome']] += 1
                    if event['outcome'] == 'accepted':
                        counts['acceptedSourceCounts'][event['source']] += 1
                        if previous_fee is not None and event['incrementalCost'] < previous_fee:
                            counts['strictReplacementSourceCounts'][event['source']] += 1
                        previous_fee = event['incrementalCost']
                counts['adaptivePolishCalls'] += call.get('strategyAction') == 'polish'
                counts['adaptivePolishAcceptedCalls'] += action == 'polish'
                counts['recoveryPolishInvocations'] += call.get('stages', {}).get('recovery_polish', {}).get('status') not in (None, 'budget_skipped')
                counts['recoveryPolishAcceptedCandidates'] += sum(event['source'] == 'recovery_polish' for event in accepted)
                for proof in (call.get('stages', {}).get('polish', {}).get('metadata'), call.get('recoveryMetadata', {}).get('polishMetadata')):
                    if isinstance(proof, dict):
                        counts['polishInternalAcceptedMoves'] += proof.get('acceptedMoves', 0)
            if late_calls:
                field = 'timelyIncumbentThenOver200MsCompleteEpisodes' if result['complete'] else 'timelyIncumbentThenOver200MsFailedEpisodes'
                counts[field].append(episode_id)
            if not result['complete']:
                failure = result['failure']
                last = result['plannerTrace'][-1]
                stages = last.get('stages', {})
                events = last['candidateDelivery']['events']
                counts['failureKinds'][failure['kind']] += 1
                counts['failureDayCounts'][str(failure['day'])] += 1
                counts['failedCallMILPStatus'][stages.get('locked_milp', {}).get('status', 'absent')] += 1
                counts['failedCallConstructorDeadlineReached'] += stages.get('locked_constructor', {}).get('constructorMetadata', {}).get('deadlineReached') is True
                counts['failedCallLateValidAuditCandidates'] += sum(event['outcome'] in ('rejected_late_audit', 'rejected_late_selection')
                    and event.get('audit', {}).get('scheduleValid') and event.get('audit', {}).get('freezeValid') for event in events)
                counts['failedCallLateReceiptCandidates'] += sum(event['outcome'] == 'rejected_late_receipt' for event in events)
                counts['failureRecords'].append({'episodeId': episode_id, 'day': failure['day'], 'kind': failure['kind'],
                    'strategyAction': last['strategyAction'], 'milpStatus': stages.get('locked_milp', {}).get('status', 'absent'),
                    'callWallMs': last['callWallMs'], 'constructorFirstIncumbentMs': stages.get('locked_constructor', {}).get('constructorMetadata', {}).get('firstIncumbentMs'),
                    'artifact': receipt['artifact']})
    return {'schemaVersion': 'portplan-v9-posthoc-descriptive-interpretation-1', 'readOnlyInputs': True, 'solverRuns': 0,
            'scriptSha256': sha(Path(__file__).read_bytes()), 'inputIndexSha256': sha(raw), 'protocolSha256': index['protocolHash'],
            'frozenManifestSha256': sha((root.parent / 'manifest.json').read_bytes()),
            'method': 'All 432 bound adaptiveV9 episode artifacts; per-call candidate counts from full gate events, with no optimizer rerun or bootstrap recomputation.',
            'panels': panels}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--index', type=Path, default=ROOT / 'artifacts/v9-frozen-first/first-run/complete.json')
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
