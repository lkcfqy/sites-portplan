#!/usr/bin/env python3
"""Read-only integrity checks for the finite V12 public-source coverage manifest.

No source downloads, identifier-bearing originals, numerical caches, solvers,
fitting, SQL association rebuilds or fee calculations are performed.
"""
import argparse
import hashlib
import json
import sys
from pathlib import Path


def check(manifest_path, root):
    manifest = json.loads(manifest_path.read_text())
    errors = []
    checked = {}
    original_count = 0
    # Read the saved receipts themselves; do not merely compare two literal
    # hashes supplied by this newly written coverage manifest.
    receipt_hashes = {}
    original_receipts = {}
    def saved(path):
        return json.loads((root / path).read_text())
    for source in saved('data/source_registry.json')['sources']:
        for key in ['snapshot', 'catalog_snapshot']:
            artifact = source.get(key, {})
            if artifact.get('path') and artifact.get('sha256'):
                receipt_hashes[artifact['path']] = artifact['sha256']
        if source['id'] == 'ygpa_gate_2026h1':
            original_receipts['ygpa_west_2026h1.csv'] = source['snapshot']
    receipt_hashes['data/public/v3-gate-visits-deidentified.csv'] = saved('data/public-gate-validation-v3.json')['source']['cleanedSha256']
    for artifact in saved('data/public/v7-validation/manifest.json')['records']:
        receipt_hashes['data/public/v7-validation/' + artifact['filename']] = artifact['sha256']
        if artifact['filename'] in {'j30.sm.tgz', 'j30.opt', 'j30-merged.json'}:
            original_receipts[artifact['filename']] = artifact
    for artifact in saved('data/public/v2-external-manifest.json')['files']:
        receipt_hashes[artifact['path']] = artifact['sha256']
    bulk = next(source for source in saved('data/public/v6-data-sources/manifest.json')['sources'] if source['id'] == 'port-bulk-ocel-22019684')['artifactDownloads'][0]
    receipt_hashes['data/public/v6-data-sources/' + bulk['file']] = bulk['sha256']
    for artifact in saved('data/public-orders-audit-v6.json')['source']['artifacts']:
        receipt_hashes[artifact['path']] = artifact['expectedSha256']
    for artifact in saved('data/public/v2-research-source-manifest.json')['files']:
        receipt_hashes[artifact['path']] = artifact['sha256']
    expected_ids = {
        'ygpa_gate_2026h1', 'psplib_j30', 'plos_constructed_container_2025',
        'bulkport_ocel_22019684', 'bet_freight_47_generated',
        'pnc_2026_storage', 'maersk_korea_combined_dd',
    }
    sources = manifest.get('sources', [])
    ids = [source.get('id') for source in sources]
    if len(ids) != len(expected_ids) or set(ids) != expected_ids:
        errors.append('The declared seven-source inventory changed or contains duplicates.')
    for source in sources:
        label = source.get('id', '?')
        for key in ['title', 'sourceType', 'landingUrl', 'citation', 'license',
                    'artifacts', 'fields', 'missingFields', 'supportedQuestions',
                    'supportedEvidence', 'unsupportedClaims', 'audits']:
            if not source.get(key):
                errors.append(f'{label}: missing {key}')
        if source.get('directPortPlanLifecycleDataset') is not False:
            errors.append(f'{label}: unsupported direct real lifecycle claim')
        for field in source.get('fields', []):
            for key in ['sourceFields', 'units', 'provenance', 'portPlanRelevance']:
                if not field.get(key):
                    errors.append(f'{label}: field lacks {key}')
        for artifact in source.get('artifacts', []) + source.get('audits', []):
            relative = artifact.get('path', '')
            path = (root / relative).resolve()
            if not relative or not path.is_relative_to(root):
                errors.append(f'{label}: non-repository bound path: {relative}')
                continue
            try:
                data = path.read_bytes()
            except OSError as exc:
                errors.append(f'{relative}: {exc}')
                continue
            actual = hashlib.sha256(data).hexdigest()
            if actual != artifact.get('sha256') or len(data) != artifact.get('bytes'):
                errors.append(f'{relative}: bytes/SHA differ from coverage binding')
            expected = artifact.get('expectedSha256')
            if expected is not None and (expected != actual or expected != receipt_hashes.get(relative)
                                         or not artifact.get('expectedHashSource')):
                errors.append(f'{relative}: historical receipt binding mismatch')
            if artifact.get('verification') not in {
                'new_byte_binding_only', 'sha256_matches_saved_receipt',
            }:
                errors.append(f'{relative}: unknown verification scope')
            if artifact.get('verification') == 'sha256_matches_saved_receipt' and expected is None:
                errors.append(f'{relative}: receipt match without expected SHA')
            prior = checked.get(relative)
            if prior and prior != actual:
                errors.append(f'{relative}: conflicting repeated bindings')
            checked[relative] = actual
        for original in source.get('originalArtifacts', []):
            original_count += 1
            if original.get('path') is not None or original.get('verification') != 'historical_receipt_only_not_read_in_v12':
                errors.append(f'{label}: historical-only original scope changed')
            if original.get('redistributed') is not False:
                errors.append(f'{label}: forbidden original redistribution claim')
            if len(original.get('sha256', '')) != 64 or not original.get('url'):
                errors.append(f'{label}: incomplete original receipt')
            prior = original_receipts.get(original.get('filename'), {})
            if not prior or any(original.get(key) != prior.get(key) for key in ['sha256', 'bytes', 'url']):
                errors.append(f'{label}: historical-only original differs from saved receipt')
            if original.get('recordedCachePath') != prior.get('raw_cache_path', prior.get('forensicPath')):
                errors.append(f'{label}: historical original cache-path declaration mismatch')
    receipt_paths = [artifact.get('path') for artifact in manifest.get('receiptBindings', [])]
    expected_receipts = {
        'data/source_registry.json', 'data/public-gate-validation-v3.json',
        'data/public/v7-validation/manifest.json', 'data/public/v2-external-manifest.json',
        'data/public/v6-data-sources/manifest.json', 'data/public-orders-audit-v6.json',
        'data/public/v2-research-source-manifest.json',
    }
    if len(receipt_paths) != len(expected_receipts) or set(receipt_paths) != expected_receipts:
        errors.append('The fixed seven saved-receipt bindings changed or contain duplicates')
    for artifact in manifest.get('receiptBindings', []):
        relative = artifact.get('path', '')
        path = (root / relative).resolve()
        if not relative or not path.is_relative_to(root):
            errors.append(f'Invalid receipt path: {relative}')
            continue
        data = path.read_bytes()
        actual = hashlib.sha256(data).hexdigest()
        if actual != artifact.get('sha256') or len(data) != artifact.get('bytes'):
            errors.append(f'{relative}: saved receipt bytes/SHA differ from coverage binding')
        checked[relative] = actual
    if manifest.get('schemaVersion') != 'portplan-public-source-field-coverage-v12':
        errors.append('Unexpected schemaVersion')
    for key in ['networkRequests', 'solverRuns', 'newExperiments']:
        if manifest.get(key) != 0:
            errors.append(f'{key}: expected zero for this integrity-only audit')
    for key in ['requiresPrivateBusinessData', 'requiresIdentifierBearingGateCSV']:
        if manifest.get(key) is not False:
            errors.append(f'{key}: public-only scope changed')
    summary = manifest.get('summary', {})
    if summary.get('sourceCount') != len(sources):
        errors.append('Incorrect source count')
    if summary.get('uniqueLocallyHashedArtifacts') != len(checked):
        errors.append('Incorrect unique hashed artifact count')
    receipt_count = len({a['path'] for s in sources for a in s.get('artifacts', []) + s.get('audits', [])
                         if a.get('verification') == 'sha256_matches_saved_receipt'})
    if summary.get('uniqueArtifactsMatchingHistoricalReceipts') != receipt_count:
        errors.append('Incorrect receipt-matched artifact count')
    if summary.get('historicalOriginalBindingsNotRead') != original_count:
        errors.append('Incorrect historical-only original count')
    gate = next((s for s in sources if s.get('id') == 'ygpa_gate_2026h1'), {})
    historical_gate = json.loads((root / 'data/public-gate-validation-v3.json').read_text())['summary']
    v11 = json.loads((root / 'data/public-evidence-readiness-v11.json').read_text())
    evidence = gate.get('supportedEvidence', {})
    for actual_key, saved_key in [
        ('selectedTestMAEMinutes', 'testMAE'), ('baselineTestMAEMinutes', 'baselineMAE'),
        ('visitWeightedMAEImprovementPct', 'maeImprovementPct'),
        ('equalObservedDateMeanMAEImprovementMinutes', 'equalDateMeanMAEImprovementMinutes'),
        ('observedDateBootstrap95IntervalMinutes', 'dailyBootstrap95IntervalMinutes'),
    ]:
        if evidence.get(actual_key) != historical_gate[saved_key]:
            errors.append(f'Gate metric differs from saved result: {actual_key}')
    if not v11.get('valid') or v11['summary']['gateTestMAE'] != evidence.get('selectedTestMAEMinutes'):
        errors.append('Gate V11 independent-recalculation binding mismatch')
    gate_counts = {'records': 58171, 'trainCount': 41039, 'validationCount': 7980, 'testCount': 9152}
    if any(historical_gate.get(k) != v for k, v in gate_counts.items()):
        errors.append('Unexpected saved gate split counts')
    if evidence.get('test', {}).get('records') != 9152 or evidence.get('test', {}).get('observedDates') != 21:
        errors.append('Coverage test denominator differs from saved gate result')
    return dict(
        valid=not errors, readOnly=True, networkRequests=0, solverRuns=0, newExperiments=0,
        scope='Finite manifest fields, current local file SHA/bytes, and saved gate metric bindings only; not a source-authenticity, license legal, physics, optimizer, fitting, invoice or operational audit.',
        sourceCount=len(sources), uniqueLocallyHashedArtifacts=len(checked),
        uniqueArtifactsMatchingHistoricalReceipts=receipt_count,
        historicalOriginalBindingsNotRead=original_count,
        errors=errors,
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    path = args.manifest or root / 'data/public-source-field-coverage-v12.json'
    try:
        result = check(path, root)
    except (OSError, ValueError, KeyError, TypeError) as exc:
        result = dict(valid=False, readOnly=True, networkRequests=0, solverRuns=0,
                      errors=[f'{type(exc).__name__}: {exc}'])
    print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
    return 0 if result['valid'] else 1


if __name__ == '__main__':
    sys.exit(main())
