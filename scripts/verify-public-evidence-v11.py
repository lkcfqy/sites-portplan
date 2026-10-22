"""Offline recalculation/binding of existing public evidence; never runs a solver.

Standard library plus Node for the existing narrow fee-example arithmetic.
No raw vehicle identifiers, network, producer imports, or historical writes.
"""
import argparse
import ast
import collections
import csv
import datetime as dt
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import random
import re
import statistics
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent
MODELS = ['global_median', 'hour_median', 'weekday_hour_median']


def require(condition, message):
    if not condition:
        raise ValueError(message)


def finite_tree(value, label='JSON'):
    if isinstance(value, float):
        require(math.isfinite(value), label + ': nonfinite number')
    elif isinstance(value, dict):
        for key, item in value.items():
            finite_tree(item, label + '/' + str(key))
    elif isinstance(value, list):
        for index, item in enumerate(value):
            finite_tree(item, label + '/' + str(index))
    return value


def parse_json(raw, label='JSON'):
    def bad_constant(value):
        raise ValueError(label + ': nonfinite JSON constant ' + value)
    def unique_object(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, label + ': duplicate JSON key ' + key)
            result[key] = value
        return result
    return finite_tree(json.loads(raw, parse_constant=bad_constant, object_pairs_hook=unique_object), label)


def digest_bytes(raw):
    return hashlib.sha256(raw).hexdigest()


def safe_path(base, relative):
    require(isinstance(relative, str) and relative and '\\' not in relative,
            'Artifact path must be a nonempty POSIX relative path')
    part = PurePosixPath(relative)
    require(not part.is_absolute() and '..' not in part.parts,
            'Artifact path traversal/absolute path forbidden: ' + relative)
    root = Path(base).resolve()
    resolved = (root / relative).resolve()
    require(resolved.is_relative_to(root), 'Artifact symlink escapes root: ' + relative)
    return resolved


def close(actual, expected, label, tolerance=1e-10):
    require(type(actual) in (int, float) and type(expected) in (int, float)
            and math.isfinite(actual) and math.isfinite(expected), label + ': finite numbers required')
    require(math.isclose(actual, expected, rel_tol=1e-12, abs_tol=tolerance),
            f'{label}: recomputed {actual!r}, archived {expected!r}')


class Evidence:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.sources = {}

    def path(self, relative):
        return safe_path(self.root, relative)

    def raw(self, relative):
        path = self.path(relative)
        require(path.is_file(), 'Missing required local evidence: ' + relative)
        raw = path.read_bytes()
        self.sources[relative] = {'path': relative, 'bytes': len(raw), 'sha256': digest_bytes(raw)}
        return raw

    def load(self, relative):
        return parse_json(self.raw(relative), relative)

    def bind(self, relative, expected):
        require(isinstance(expected, str) and re.fullmatch(r'[0-9a-f]{64}', expected),
                'Missing/invalid SHA256 for ' + relative)
        raw = self.raw(relative)
        require(digest_bytes(raw) == expected, 'SHA256 differs: ' + relative)
        return raw

    def bind_historical_source(self, relative, expected, frozen_root=None):
        # Only source changes may use a declared frozen reference. Data artifacts
        # are never silently substituted or regenerated.
        path = self.path(relative)
        if path.is_file() and digest_bytes(self.raw(relative)) == expected:
            return {'recordedPath': relative, 'verifiedPath': relative, 'liveDiffers': False}
        require(frozen_root is not None and relative.startswith(('src/', 'scripts/', 'tests/')),
                'Missing/changed evidence has no permitted frozen source reference: ' + relative)
        frozen = str(PurePosixPath(frozen_root) / relative)
        self.bind(frozen, expected)
        return {'recordedPath': relative, 'verifiedPath': frozen, 'liveDiffers': True}


def floor_quantile(values, fraction):
    ordered = sorted(values)
    require(bool(ordered), 'Cannot take quantile of empty observations')
    return ordered[int((len(ordered) - 1) * fraction)]


def gate_recalculation(evidence):
    archive = evidence.load('data/public-gate-validation-v3.json')
    protocol_raw = evidence.bind('data/public-gate-protocol-v3.json', archive['protocolSha256'])
    protocol = parse_json(protocol_raw)
    require(archive['protocol'] == protocol, 'Gate embedded protocol differs')
    require(protocol['candidates'] == MODELS, 'Unexpected gate candidate declaration')
    require(type(protocol['minimumGroupTrainingCount']) is int and protocol['minimumGroupTrainingCount'] > 0,
            'Invalid gate group threshold')
    require(archive['source']['sha256'] == protocol['sourceSha256'], 'Recorded original gate-source hash differs')
    evidence.bind('data/public/v3-gate-visits-deidentified.csv', archive['source']['cleanedSha256'])
    visits = []
    seen_lines = set()
    with evidence.path('data/public/v3-gate-visits-deidentified.csv').open(encoding='utf-8', newline='') as handle:
        reader = csv.DictReader(handle)
        require(reader.fieldnames == ['source_line', 'entry_local', 'elapsed_minutes'],
                'Deidentified gate columns differ or contain extra identifiers')
        for index, row in enumerate(reader, 2):
            require(None not in row and all(row.get(key) is not None for key in reader.fieldnames),
                    f'Malformed gate CSV row {index}')
            require(re.fullmatch(r'[0-9]+', row['source_line']) is not None, 'Invalid gate source-line identity')
            source_line = int(row['source_line'])
            require(source_line >= 2 and source_line not in seen_lines, 'Duplicate/invalid gate source-line identity')
            seen_lines.add(source_line)
            stamp = dt.datetime.strptime(row['entry_local'], '%Y-%m-%d %H:%M')
            require(dt.date(2026, 1, 1) <= stamp.date() <= dt.date(2026, 6, 30), 'Gate entry outside declared H1 period')
            elapsed = float(row['elapsed_minutes'])
            require(math.isfinite(elapsed) and elapsed >= 0, 'Invalid/nonfinite gate elapsed minutes')
            visits.append((stamp, elapsed, source_line))
    require(visits and visits == sorted(visits, key=lambda row: (row[0], row[2])), 'Gate ordering differs')
    split = protocol['split']
    periods = {
        'train': [row for row in visits if row[0].date().isoformat() <= split['trainEnd']],
        'validation': [row for row in visits if split['validationStart'] <= row[0].date().isoformat() <= split['validationEnd']],
        'test': [row for row in visits if split['testStart'] <= row[0].date().isoformat() <= split['testEnd']],
    }
    require(all(periods.values()) and sum(map(len, periods.values())) == len(visits), 'Gate split missing/overlapping observations')
    counts = {'records': len(visits), **{name + 'Count': len(rows) for name, rows in periods.items()}}
    for key, value in counts.items():
        require(archive['summary'][key] == value, 'Gate ' + key + ' differs')
    for name, rows in periods.items():
        expected = {'visits': len(rows), 'observedDates': len({row[0].date() for row in rows}),
                    'firstEntry': rows[0][0].isoformat(), 'lastEntry': rows[-1][0].isoformat()}
        require(archive['periods'][name] == expected, 'Gate period metadata differs: ' + name)
    global_median = statistics.median(row[1] for row in periods['train'])
    candidates = []
    predictions = {}
    for name in MODELS:
        buckets = collections.defaultdict(list)
        for stamp, value, _ in periods['train']:
            key = stamp.hour if name == 'hour_median' else (stamp.weekday(), stamp.hour)
            buckets[key].append(value)
        medians = {key: statistics.median(values) for key, values in buckets.items()
                   if len(values) >= protocol['minimumGroupTrainingCount']}
        def predict(stamp):
            key = stamp.hour if name == 'hour_median' else (stamp.weekday(), stamp.hour)
            return global_median if name == 'global_median' else medians.get(key, global_median)
        recomputed = {'model': name, 'learnedGroups': 0 if name == 'global_median' else len(medians)}
        predictions[name] = [predict(stamp) for stamp, _, _ in periods['test']]
        for period in ['validation', 'test']:
            grouped = collections.defaultdict(list)
            errors = []
            for stamp, value, _ in periods[period]:
                error = abs(predict(stamp) - value)
                errors.append(error)
                grouped[stamp.date().isoformat()].append(error)
            recomputed[period] = {'count': len(errors), 'mae': statistics.mean(errors),
                'medianAbsoluteError': statistics.median(errors), 'p90AbsoluteError': floor_quantile(errors, .9),
                'byDate': [{'date': date, 'visits': len(values), 'mae': statistics.mean(values)}
                           for date, values in sorted(grouped.items())]}
        archived = archive['candidates'][len(candidates)]
        require(archived['model'] == name and archived['learnedGroups'] == recomputed['learnedGroups'], 'Gate model/group order differs')
        for period in ['validation', 'test']:
            require(archived[period]['count'] == recomputed[period]['count'], 'Gate metric count differs')
            for metric in ['mae', 'medianAbsoluteError', 'p90AbsoluteError']:
                close(recomputed[period][metric], archived[period][metric], name + '/' + period + '/' + metric)
            require(len(archived[period]['byDate']) == len(recomputed[period]['byDate']), 'Gate date denominator differs')
            for actual, saved in zip(recomputed[period]['byDate'], archived[period]['byDate']):
                require(actual['date'] == saved['date'] and actual['visits'] == saved['visits'], 'Gate daily identity/count differs')
                close(actual['mae'], saved['mae'], name + '/' + period + '/' + actual['date'])
        candidates.append(recomputed)
    selected_index = min(range(3), key=lambda i: (candidates[i]['validation']['mae'], i))
    chosen, baseline = candidates[selected_index]['test'], candidates[0]['test']
    summary = archive['summary']
    require(candidates[selected_index]['model'] == summary['selectedModel'], 'Gate validation-only model selection differs')
    require(summary['selectionPeriod'] == 'May 2026 validation only', 'Gate selection period differs')
    for actual, key in [(chosen['mae'], 'testMAE'), (baseline['mae'], 'baselineMAE'),
                        (chosen['medianAbsoluteError'], 'testMedianAbsoluteError'), (chosen['p90AbsoluteError'], 'testP90AbsoluteError')]:
        close(actual, summary[key], 'Gate summary/' + key)
    improvement = 100 * (baseline['mae'] - chosen['mae']) / baseline['mae']
    close(improvement, summary['maeImprovementPct'], 'Gate weighted MAE improvement')
    daily_delta = [left['mae'] - right['mae'] for left, right in zip(baseline['byDate'], chosen['byDate'])]
    require(summary['observedTestDates'] == len(daily_delta), 'Gate observed-date denominator differs')
    close(statistics.mean(daily_delta), summary['equalDateMeanMAEImprovementMinutes'], 'Gate equal-date improvement')
    boot = protocol['dailyBootstrap']
    require(boot['unit'] == 'observed test date' and boot['interval'] == .95
            and type(boot['resamples']) is int and 0 < boot['resamples'] <= 100000 and type(boot['seed']) is int,
            'Invalid gate daily bootstrap declaration')
    rng = random.Random(boot['seed'])
    samples = [statistics.mean(rng.choices(daily_delta, k=len(daily_delta))) for _ in range(boot['resamples'])]
    interval = [floor_quantile(samples, .025), floor_quantile(samples, .975)]
    for actual, saved in zip(interval, summary['dailyBootstrap95IntervalMinutes']):
        close(actual, saved, 'Gate daily-bootstrap endpoint')
    require(len(summary['dailyBootstrap95IntervalMinutes']) == 2, 'Gate bootstrap interval malformed')
    examples = periods['test'][::max(1, len(periods['test']) // 40)][:40]
    require(len(examples) == len(archive['testExamples']), 'Gate displayed examples missing')
    selected_name = candidates[selected_index]['model']
    for row, saved in zip(examples, archive['testExamples']):
        stamp, elapsed, _ = row
        require(saved['entryLocal'] == stamp.isoformat(), 'Gate example timestamp differs')
        close(elapsed, saved['observedMinutes'], 'Gate example target')
        index = periods['test'].index(row)
        close(predictions[selected_name][index], saved['predictionMinutes'], 'Gate example prediction')
        close(global_median, saved['baselineMinutes'], 'Gate example baseline')
    return {'counts': counts, 'selectedModel': selected_name, 'globalTrainingMedianMinutes': global_median,
            'candidates': candidates, 'dailyBootstrap95IntervalMinutes': interval,
            'visitWeightedMAEImprovementPct': improvement,
            'scope': 'Independent recalculation from identifier-free entry times/elapsed labels, including tails and observed-date bootstrap; not a raw identifier-bearing CSV audit or operational savings.'}


def fee_examples(evidence):
    module = evidence.path('src/public-fee-validation.js')
    evidence.raw('src/public-fee-validation.js')
    evidence.raw('src/engine.js')
    code = 'const {evaluatePublicExamples}=await import(' + json.dumps(module.as_uri()) + ');process.stdout.write(JSON.stringify(evaluatePublicExamples()));'
    completed = subprocess.run(['node', '--input-type=module', '-e', code], cwd=evidence.root,
                               capture_output=True, text=True, timeout=30, check=False)
    require(completed.returncode == 0, 'Node fee example execution failed: ' + completed.stderr[-2000:])
    result = parse_json(completed.stdout, 'Node fee examples')
    require(result['summary'] == {'total': 13, 'passed': 13, 'failed': 0, 'invalid': 0, 'officialWorkedExamples': 2, 'derivedCases': 11},
            'Expected exactly 2 official and 11 derived passing arithmetic examples')
    require(len(result['cases']) == 13 and len({c['id'] for c in result['cases']}) == 13, 'Fee example identities differ')
    registry = evidence.load('data/source_registry.json')
    snapshot_paths = {s.get('snapshot', {}).get('path'): s['snapshot'] for s in registry['sources'] if s.get('snapshot')}
    local_sources = []
    for case in result['cases']:
        require(case['status'] == 'pass' and case['isActualInvoice'] is False, 'Fee case incorrectly classified')
        require(case['evidenceType'] in ['official_worked_example', 'derived_boundary_case'], 'Fee evidence category differs')
        close(case['actualKRW'], case['expectedKRW'], 'Fee example/' + case['id'], 0)
        if case['source'].get('localFile') and case['source']['localFile'] not in local_sources:
            path = case['source']['localFile']
            if path in snapshot_paths:
                evidence.bind(path, snapshot_paths[path]['sha256'])
            else:
                evidence.raw(path)
            local_sources.append(path)
    return {'summary': result['summary'], 'cases': result['cases'], 'localSourceFiles': local_sources,
            'scope': 'Execution of the existing product arithmetic and its referenceFee helper; two official narrow worked examples plus eleven own deductions. This is not an independent reimplementation of all fee evidence or invoice verification.',
            'limitations': result['limitations']}


def plos_bindings(evidence):
    report = evidence.load('data/external-reproduction-v3.json')
    protocol = parse_json(evidence.bind('data/public-reproduction-protocol-v3.json', report['protocolSHA256']))
    require(report['protocol'] == protocol and report['executionState'] == 'complete', 'PLOS protocol/execution binding differs')
    evidence.bind_historical_source('scripts/reproduce-public-v3.py', report['scriptSHA256'])
    source = protocol['source']
    raw = evidence.bind('data/public/v2-external-plos-code.zip', source['archiveSHA256'])
    import io
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        names = archive.namelist()
        require(len(names) == len(set(names)), 'PLOS ZIP duplicate members')
        prefix = 'S1 file/Code/'
        require(prefix + 'distance2' not in names, 'PLOS missing-distance2 premise changed')
        main = archive.read(prefix + 'Main.py')
        require(digest_bytes(main) == source['originalMainSHA256'], 'PLOS original Main.py SHA differs')
        functions = [n for n in ast.parse(main.decode('utf-8-sig')).body if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))]
        require([n.name for n in functions] == source['algorithmFunctions'], 'PLOS function list differs')
        ast_sha = digest_bytes(ast.dump(ast.Module(body=functions, type_ignores=[]), include_attributes=False).encode())
        require(ast_sha == source['functionASTSHA256'], 'PLOS function AST SHA differs')
        for name, expected in source['inputSHA256'].items():
            require(re.fullmatch(r'[A-Za-z0-9_]+', name) is not None, 'Unsafe PLOS member input name')
            require(digest_bytes(archive.read(prefix + name)) == expected, 'PLOS input SHA differs: ' + name)
    runs = report['runs']
    require(len(runs) == len(protocol['runs']) == 12, 'PLOS must retain all twelve declared results')
    statuses = collections.Counter()
    for run, declared in zip(runs, protocol['runs']):
        for key in ['track', 'variant', 'seed', 'distance2Alias']:
            require(run[key] == declared[key], 'PLOS run declaration mismatch: ' + key)
        require(run['source'] == source and run['parameters'] == protocol['variants'][run['variant']], 'PLOS run source/parameter binding differs')
        require(run['ants'] == protocol['budget']['ants'] and run['iterations'] == protocol['budget']['iterations'], 'PLOS reduced-budget binding differs')
        if run['track'] == 'original-files':
            require(run['status'] == 'implementation_error' and run['errorType'] == 'FileNotFoundError'
                    and 'distance2' in run['error'] and run['reportedCost'] is None and run['audit'] is None,
                    'PLOS original failure must remain explicit')
        else:
            require(run['status'] == 'completed_reported_cost_unverified' and run['audit']['status'] == 'reported_cost_unverified'
                    and run['audit']['constraintsStatus'] == 'violations_detected' and run['audit']['errors'],
                    'PLOS alias hypothesis must remain unverified with issues')
        statuses[run['status']] += 1
    summary = report['summary']
    require(summary['runCount'] == 12 and summary['completedCount'] == 6 and summary['errorCount'] == 6 and summary['timeoutCount'] == 0
            and summary['independentlyCostVerifiedCount'] == 0 and summary['fullBenchmarkReproduction'] is False
            and summary['comparedWithPortPlan'] is False, 'PLOS summary boundary differs')
    for track in ['original-files', 'explicit-distance-alias-hypothesis']:
        rows = [r for r in runs if r['track'] == track]
        expected = {'runCount': len(rows), 'completedCount': sum(r['status'].startswith('completed_') for r in rows),
                    'errorCount': sum(r['status'] == 'implementation_error' for r in rows), 'timeoutCount': 0,
                    'checkedOutputWithIssuesCount': sum(bool(r.get('audit', {}).get('errors')) for r in rows if r.get('audit'))}
        require(summary['byTrack'][track] == expected, 'PLOS track summary differs')
    return {'runCount': 12, 'statuses': dict(statuses), 'functionASTSha256': ast_sha,
            'independentlyCostVerifiedCount': 0, 'scope': 'Read-only ZIP/AST/protocol/result-status integrity. Does not rerun the paper algorithm or reconstruct reported route costs.'}


def psplib_bindings(evidence):
    review = evidence.load('data/public-resource-review-v7.json')
    require(review['valid'] is True and review['readOnly'] is True and review['fixture'] is False and review['solverRuns'] == 0 and review['errors'] == [],
            'PSPLIB saved audit must be a successful nonfixture read-only audit')
    frozen = 'vendor/experiments/public-v7-first-run-source'
    bindings = [evidence.bind_historical_source(path, expected, frozen) for path, expected in review['inputHashes'].items()]
    report = evidence.load('data/public-resource-v7.json')
    protocol = evidence.load('data/protocol-public-v7.json')
    manifest = evidence.load(frozen + '/manifest.json')
    catalog = evidence.load('data/public/v7-validation/manifest.json')
    evidence.bind(catalog['independentReviewArtifact']['path'], catalog['independentReviewArtifact']['sha256'])
    evidence.bind(catalog['firstRunArchive']['path'], catalog['firstRunArchive']['sha256'])
    require(report['executionState'] == 'complete' and report['protocolHash'] == digest_bytes(evidence.raw('data/protocol-public-v7.json')),
            'PSPLIB report protocol binding differs')
    require(manifest == {'protocolHash': report['protocolHash'], 'implementationHashes': report['implementationHashes'], 'capturedBeforeFirstMethodCall': True},
            'PSPLIB source snapshot manifest differs')
    for path, expected in manifest['implementationHashes'].items():
        evidence.bind(str(PurePosixPath(frozen) / path), expected)
    require(review['recomputedSummary'] == report['summary'], 'PSPLIB saved recomputed summary differs')
    binding = review['runtimeBinding']
    require(binding['reportStartedAt'] == report['startedAt'] and binding['reportGeneratedAt'] == report['generatedAt']
            and binding['reportedEnvironment'] == report['environment'] and binding['capturedBeforeFirstMethodCall'] is True,
            'PSPLIB saved runtime binding differs')
    cases = {c['id']: c for c in report['cases']}
    require(len(cases) == len(report['cases']) == len(review['resourceLedgers']) == 480, 'PSPLIB case/ledger coverage differs')
    seen = set()
    for ledger in review['resourceLedgers']:
        require(ledger['id'] in cases and ledger['id'] not in seen, 'PSPLIB duplicate/unknown ledger identity')
        seen.add(ledger['id'])
        case = cases[ledger['id']]
        require(set(ledger['methods']) == set(case['policies']) == {'baselineSerialSGS', 'iteratedSGS'}, 'PSPLIB ledger method coverage differs')
        for method, saved in ledger['methods'].items():
            row = case['policies'][method]
            require(saved['valid'] is True and saved['candidateValid'] is True and saved['errors'] == [], 'PSPLIB ledger reports errors')
            require(saved['makespan'] == row['makespan'] and len(saved['resourcePeaks']) == len(saved['resourceTickTotals']) == 4,
                    'PSPLIB resource ledger/makespan differs')
            require(saved['timelyEligible'] == row['complete'] and row['candidate']['makespan'] == saved['makespan']
                    and row['candidate']['audit']['valid'] == saved['candidateValid'], 'PSPLIB candidate/eligibility binding differs')
            require(all(type(v) is int and v >= 0 for v in saved['resourcePeaks'] + saved['resourceTickTotals']), 'PSPLIB ledger resources malformed')
            close(saved['wholeCallMs'], row['wallTimeMs'], 'PSPLIB external clock')
            close(saved['internalMs'], row['internalWallTimeMs'], 'PSPLIB internal clock')
    for name, source in review['originalCacheHashes'].items():
        require(source['sha256'] == report['sources'][name]['sha256'] == protocol['sources'][name]['sha256'],
                'PSPLIB original cache hash declarations differ')
    return {'caseCount': 480, 'methodResults': 960, 'boundInputFileCount': len(bindings), 'historicalSourceBindings': bindings,
            'scope': 'Read-only binding of existing independent audit, 480 saved resource ledgers and frozen results. Original numeric PSPLIB caches are not required, downloaded, or freshly parsed; no fresh resource-feasibility/optimal-reference audit is claimed.'}


def v10_bindings(evidence):
    published = evidence.load('data/v10-results.json')
    index_path = published['formalIndex']['path']
    index = parse_json(evidence.bind(index_path, published['formalIndex']['sha256']))
    review = evidence.load('data/review-v10.json')
    bootstrap = evidence.load('data/bootstrap-review-v10.json')
    frozen = str(PurePosixPath(index_path).parent.parent)
    manifest_path = frozen + '/manifest.json'
    manifest_raw = evidence.bind(manifest_path, published['frozenManifestSha256'])
    manifest = parse_json(manifest_raw)
    index_sha = published['formalIndex']['sha256']
    for saved in [review, bootstrap]:
        require(saved['valid'] is True and saved['readOnly'] is True and saved['solverRuns'] == 0
                and saved['inputIndexSha256'] == index_sha and saved['frozenManifestSha256'] == digest_bytes(manifest_raw),
                'V10 saved review/index/manifest binding differs')
    require(index['executionState'] == published['executionState'] == 'complete', 'V10 run incomplete')
    require(index['protocol'] == published['protocol'] == manifest['protocol'], 'V10 embedded protocols differ')
    protocol_raw = evidence.bind(frozen + '/source/data/protocol-v10.json', manifest['protocolHash'])
    require(parse_json(protocol_raw) == manifest['protocol'] and index['protocolHash'] == manifest['protocolHash'], 'V10 frozen protocol binding differs')
    require(index['implementationHashes'] == manifest['implementationHashes'] and len(manifest['implementationHashes']) == 135,
            'V10 frozen implementation manifest coverage differs')
    changed_live = []
    for relative, expected in manifest['implementationHashes'].items():
        evidence.bind(str(PurePosixPath(frozen) / 'source' / relative), expected)
        live = evidence.path(relative)
        if not live.is_file() or digest_bytes(live.read_bytes()) != expected:
            changed_live.append(relative)
    require(published['summary'] == index['summary'], 'V10 public summary differs from first formal index')
    require(len(index['cases']) == published['scenarioCount'] == bootstrap['businessScenarioCount'] == 144, 'V10 business-scenario count differs')
    require([ {k:v for k,v in c.items() if k not in ['inputArtifact','orderFingerprint','repeats']} for c in index['cases']] == manifest['scenarioMetadata'],
            'V10 saved scenario metadata differs from frozen declaration')
    method_names = set(manifest['protocol']['methods'])
    require(len(method_names) == 5 and len(manifest['protocol']['algorithmRepeats']) == 3, 'V10 methods/repeats differ')
    artifacts = set()
    episode_count = 0
    run_dir = str(PurePosixPath(index_path).parent)
    for case in index['cases']:
        require(len(case['repeats']) == 3, 'V10 missing repeat')
        refs = [case['inputArtifact']]
        for repetition, declared in zip(case['repeats'], manifest['protocol']['algorithmRepeats']):
            require(repetition['algorithmSeed'] == declared['seed'] and set(repetition['policies']) == method_names, 'V10 repeat seed/method coverage differs')
            refs.extend(receipt['artifact'] for receipt in repetition['policies'].values())
            episode_count += len(repetition['policies'])
        for ref in refs:
            # Validate separately relative to run root, then use a root-relative
            # canonical path; never allow a manifest to read outside its run.
            path = safe_path(evidence.path(run_dir), ref['path'])
            rel = path.relative_to(evidence.root).as_posix()
            require(rel not in artifacts, 'V10 duplicate artifact reference')
            artifacts.add(rel)
            evidence.bind(rel, ref['sha256'])
    require(episode_count == published['episodeCount'] == bootstrap['episodeCount'] == review['summary']['episodes'] == 2160,
            'V10 episode count differs')
    frozen_source = frozen + '/source'
    source_bindings = []
    for path, field in [('scripts/review-v10.py','implementationSha256'), ('scripts/review-v9.py','unchangedV9ReviewSha256'),
                        ('scripts/review-v8.py','unchangedV8ReviewSha256'), ('scripts/review-v5.py','ledgerSha256')]:
        source_bindings.append(evidence.bind_historical_source(path, review[field], frozen_source))
    source_bindings.append(evidence.bind_historical_source('scripts/review-bootstrap-v10.py', bootstrap['implementationSha256'], frozen_source))
    return {'scenarioCount': 144, 'episodeCount': episode_count, 'frozenSourceFileCount': 135, 'artifactHashesVerified': len(artifacts),
            'liveFilesDifferingFromFrozen': changed_live, 'reviewSourceBindings': source_bindings,
            'scope': 'Integrity binding of first formal index, saved two reviews, all input/episode artifact bytes, embedded protocol and 135 frozen source files. Changed current development files do not replace the frozen version. No new solver, full physical audit, or bootstrap rerun is performed here.'}


def verify(root=ROOT):
    evidence = Evidence(root)
    checks = []
    for name, kind, function in [
        ('public_gate_calendar_holdout', 'independent_recalculation', gate_recalculation),
        ('public_fee_examples', 'existing_product_arithmetic', fee_examples),
        ('plos_original_and_result_bindings', 'read_only_integrity_binding', plos_bindings),
        ('psplib_saved_audit_and_resource_ledgers', 'read_only_integrity_binding', psplib_bindings),
        ('v10_formal_and_frozen_source_chain', 'read_only_integrity_binding', v10_bindings),
    ]:
        try:
            details = function(evidence)
            checks.append({'id': name, 'kind': kind, 'status': 'pass', 'scope': details['scope'], 'details': details})
        except (ValueError, KeyError, TypeError, IndexError, OverflowError, OSError, csv.Error, zipfile.BadZipFile, SyntaxError, subprocess.SubprocessError, ZeroDivisionError) as error:
            checks.append({'id': name, 'kind': kind, 'status': 'fail',
                'scope': 'Checker integrity/recalculation failure; this does not reclassify the underlying recorded research result.', 'error': str(error)})
    failed = [c['id'] for c in checks if c['status'] != 'pass']
    details = {c['id']: c['details'] for c in checks if c['status'] == 'pass'}
    fee_summary = details.get('public_fee_examples', {}).get('summary', {})
    gate = details.get('public_gate_calendar_holdout', {})
    selected = next((c for c in gate.get('candidates', []) if c['model'] == gate.get('selectedModel')), {})
    baseline = next((c for c in gate.get('candidates', []) if c['model'] == 'global_median'), {})
    return {'schemaVersion': 'portplan-public-evidence-readiness-v11', 'generatedAt': dt.datetime.now(dt.timezone.utc).isoformat(),
            'valid': not failed, 'readOnlyHistoricalInputs': True, 'solverRuns': 0, 'networkRequests': 0,
            'requiresIdentifierBearingGateCSV': False, 'requiresPrivateBusinessData': False,
            'summary': {'checkCount': len(checks), 'passedCount': len(checks)-len(failed), 'failedCount': len(failed), 'failedCheckIds': failed,
                        'passedCheckCount': len(checks)-len(failed), 'failedCheckCount': len(failed),
                        'feeOfficialWorkedExamples': fee_summary.get('officialWorkedExamples'),
                        'feeDerivedBoundaryCases': fee_summary.get('derivedCases'),
                        'gateRecords': gate.get('counts', {}).get('records'), 'gateTestRecords': gate.get('counts', {}).get('testCount'),
                        'gateSelectedModel': gate.get('selectedModel'), 'gateTestMAE': selected.get('test', {}).get('mae'),
                        'gateBaselineMAE': baseline.get('test', {}).get('mae'),
                        'classification': 'Offline recalculation and saved-evidence integrity; internal tooling, not third-party certification or operational validation'},
            'checks': checks, 'sources': sorted(evidence.sources.values(), key=lambda item: item['path']),
            'limitations': [
                'Raw identifier-bearing gate records are not read; their original published SHA is retained as a declaration. Source-to-deidentified transformation and publisher provenance are not newly authenticated.',
                'Gate date-block bootstrap is retrospective and does not establish independent vehicles, field deployment, capacity gains, or monetary savings.',
                'Fee arithmetic executes existing product code. Two official worked examples and eleven own deductions do not provide independent full tariff/contract/invoice evidence; Maersk cross-band billing remains a stated interpretation.',
                'PLOS twelve saved outcomes are hash/status-bound, not rerun. Six original-input failures and six unverified repaired-input costs remain failures/unverified evidence, not successful original-paper reproduction.',
                'PSPLIB numeric research caches are not fetched. Only saved audit input hashes, resource-ledger fields and result bindings are checked; new raw-instance feasibility/optimal-reference reconstruction is outside this checker.',
                'V10 artifact/source hashes bind existing internal audits and synthetic results. This checker does not rerun all physical execution calculations or the scenario bootstrap; saved clocks are not externally authenticated.',
                'Other evidence such as the grain-port SQLite association ledger, browser interactions, new competitor research and competition eligibility is not revalidated by this script.',
                'No claim of third-party certification, real enterprise savings, operational readiness, novelty, or competition rank follows from a passing report.'
            ]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='data/public-evidence-readiness-v11.json', help='New JSON output, relative to project root; existing files are never overwritten')
    args = parser.parse_args()
    try:
        output = safe_path(ROOT, args.output)
        require(output.suffix == '.json' and not output.exists(), 'Choose a new .json output path; existing history/report will not be overwritten')
        report = verify()
        output.parent.mkdir(parents=True, exist_ok=True)
        with output.open('x', encoding='utf-8') as handle:
            json.dump(report, handle, ensure_ascii=False, indent=2, allow_nan=False)
            handle.write('\n')
        print(json.dumps({'output': str(output.relative_to(ROOT)), 'valid': report['valid'], **report['summary']}, ensure_ascii=False))
        return 0 if report['valid'] else 1
    except (ValueError, OSError) as error:
        print(str(error), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
