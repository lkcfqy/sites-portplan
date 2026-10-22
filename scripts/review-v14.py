#!/usr/bin/env python3
"""Independent, read-only V14 input, physical, fee and native-selection audit.

Standard-library Python only. Formal review loads hash-bound Python ledgers from
the restored run's frozen source; no JavaScript, optimizer, old raw archive or
prospective order generation is imported or executed. Bootstrap is separate.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
import math
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
METHODS = ['costPolishV7', 'adaptiveV9', 'highsV8', 'stableHiGHSV10', 'commitmentHiGHSV11', 'seededHiGHSV12', 'guardedHiGHSV13']
GUARDED = METHODS[-1]
PAIRS = {'v13VsV12': ('seededHiGHSV12', GUARDED), 'v13VsV11': ('commitmentHiGHSV11', GUARDED),
         'v13VsV10': ('stableHiGHSV10', GUARDED), 'v13VsV9': ('adaptiveV9', GUARDED),
         'v13VsHiGHS': ('highsV8', GUARDED), 'v13VsV7': ('costPolishV7', GUARDED)}
PAIRS.update({'v12VsV11': ('commitmentHiGHSV11', 'seededHiGHSV12'), 'v12VsV10': ('stableHiGHSV10', 'seededHiGHSV12'),
    'v12VsV9': ('adaptiveV9', 'seededHiGHSV12'), 'v12VsHiGHS': ('highsV8', 'seededHiGHSV12'),
    'v12VsV7': ('costPolishV7', 'seededHiGHSV12'), 'v11VsV10': ('stableHiGHSV10', 'commitmentHiGHSV11'),
    'v10VsHiGHS': ('highsV8', 'stableHiGHSV10'), 'highsVsV7': ('costPolishV7', 'highsV8')})
HELPERS = ['scripts/review-v12.py', 'scripts/review-v10.py', 'scripts/review-v9.py',
           'scripts/review-v8.py', 'scripts/review-v5.py', 'scripts/review-replay-guard-v13.py']
GUARD_FIELDS = ('strictGuardAttempts', 'strictGuardAccepted', 'strictGuardBlockedMIncrease', 'strictGuardIncompleteOrError', 'strictGuardLate')


def require(condition, message):
    if not condition: raise ValueError(message)


def same(actual, expected, label):
    require(actual == expected, label + ': inconsistent independent reconstruction')


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''): h.update(block)
    return h.hexdigest()


def read_json(path):
    def reject(value): raise ValueError('Nonfinite JSON constant ' + value)
    return json.loads(Path(path).read_text(encoding='utf-8'), parse_constant=reject)


def safe_path(base, name, label='artifact'):
    require(isinstance(name, str) and name and not Path(name).is_absolute() and '..' not in Path(name).parts,
            label + ': unsafe relative path')
    result = (base / name).resolve()
    require(result.is_relative_to(base.resolve()), label + ': path escapes declared root')
    return result


def load_helpers(source_root):
    def load(name, relative):
        spec = importlib.util.spec_from_file_location(name, safe_path(source_root, relative))
        module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
        return module
    v12 = load('v14_frozen_independent_v12', 'scripts/review-v12.py')
    guard = load('v14_frozen_independent_v13_guard', 'scripts/review-replay-guard-v13.py')
    return v12, guard


def walk_seeds(value, found, key=''):
    if isinstance(value, dict):
        for start, count in (('baseSeed', 'scenarioCount'), ('seedBase', 'caseCount')):
            if type(value.get(start)) is int and type(value.get(count)) is int:
                require(0 <= value[count] <= 100000, 'Historical metadata range is invalid')
                found.update(range(value[start], value[start] + value[count]))
        for name, item in value.items(): walk_seeds(item, found, name)
    elif isinstance(value, list):
        for item in value: walk_seeds(item, found, key)
    elif type(value) is int and 'seed' in key.lower(): found.add(value)


def declared_cases(protocol):
    same(protocol.get('schemaVersion'), 'portplan-protocol-v14', 'Formal V14 protocol schema')
    same(protocol.get('methods'), METHODS, 'Formal seven-method registry')
    same(protocol.get('analysis', {}).get('comparisons'), {k: list(v) for k, v in PAIRS.items()}, 'Formal comparison registry')
    same(protocol.get('matrix'), {'mechanisms': ['aged-backlog', 'new-arrivals', 'batch-release'],
         'capacityProfiles': ['balanced', 'tight'], 'counts': [24, 50, 100], 'scenariosPerCell': 4}, 'Formal matrix')
    same([p['id'] for p in protocol['panels']], ['same-distribution', 'stress'], 'Formal panel identities')
    same([p['baseSeed'] for p in protocol['panels']], [791001, 792001], 'Predeclared new business seed ranges')
    require(len(protocol.get('algorithmRepeats', [])) == 3, 'Exactly three clock repetitions required')
    same([r['index'] for r in protocol['algorithmRepeats']], [1, 2, 3], 'Clock repetition indices')
    clock_seeds = [r['seed'] for r in protocol['algorithmRepeats']]
    same(clock_seeds, [79011, 79023, 79039], 'Predeclared new clock seeds')
    require(len(set(clock_seeds)) == 3 and all(type(s) is int for s in clock_seeds), 'Distinct declared clock seeds required')
    result = []
    for panel in protocol['panels']:
        require(type(panel['baseSeed']) is int and panel['scenarioCount'] == 72, 'Formal panel seed/count')
        index = 0
        for mechanism in protocol['matrix']['mechanisms']:
            for capacity in protocol['matrix']['capacityProfiles']:
                for count in protocol['matrix']['counts']:
                    for repetition in range(1, 5):
                        pattern = panel['shockPatterns'][(repetition - 1) % len(panel['shockPatterns'])]
                        result.append({'id': f"v14-{panel['id']}-{mechanism}-{capacity}-n{count}-r{repetition}",
                            'panel': panel['id'], 'dataRole': 'held-out', 'mechanism': mechanism, 'capacityProfile': capacity,
                            'count': count, 'scenarioRepeat': repetition, 'seed': panel['baseSeed'] + index,
                            'shockPattern': pattern['name'], 'shocks': pattern['shocks']})
                        index += 1
        same(index, 72, 'Independent matrix expansion')
    business_seeds = {c['seed'] for c in result}
    require(len(result) == len(business_seeds) == 144 and not business_seeds.intersection(clock_seeds), '144 unique business seeds disjoint from clock seeds required')
    return result


def audit_historical_seeds(protocol, source_root):
    metadata = protocol.get('historicalSeedExclusions', {})
    require(isinstance(metadata.get('sources'), list) and metadata['sources'], 'Missing historical metadata bindings')
    found, paths = set(), set()
    for ref in metadata['sources']:
        name = ref.get('path')
        require(isinstance(name, str) and name.startswith('data/') and name != 'data/protocol-v14.json' and name not in paths,
                'Historical source must be a distinct old data metadata file')
        paths.add(name); path = safe_path(source_root, name, 'Historical metadata')
        same(digest(path), ref.get('sha256'), 'Historical metadata SHA ' + name)
        walk_seeds(read_json(path), found)
    same(metadata.get('excludedSeeds'), sorted(found), 'Independent historical seed reconstruction')
    current = {c['seed'] for c in declared_cases(protocol)} | {r['seed'] for r in protocol['algorithmRepeats']}
    require(not current.intersection(found), 'V14 seeds overlap previous declared seeds')
    return {'metadataSourceCount': len(paths), 'excludedSeedCount': len(found), 'overlappingV14Seeds': 0,
            'scope': 'Only hash-bound prior declaration metadata is read; no old episode raw archive is required.'}


def audit_protocol(protocol, source_root, v12, require_authorized=False):
    metadata = declared_cases(protocol)
    same(protocol['budget']['hardWallMs'], 5000, 'Five-second cold parent budget')
    same(protocol['budget']['cpuThreads'], 1, 'Single native thread')
    same(protocol['budget'].get('parentAcceptance'), v12.PARENT_ACCEPTANCE, 'Strict cold parent lifecycle contract')
    same(protocol.get('rollout'), {'startDay': 0, 'initialization': 'natural', 'forcedEndpointImports': False, 'freshBusinessScenarios': 144}, 'Natural full-D0 rollout')
    initialization = protocol.get('initialization', {})
    for key, value in (('mode', 'natural-from-day-zero'), ('freshPlannerPerEpisode', True), ('emptyExecutionHistoryAtD0', True),
                       ('forcedEndpointImports', False), ('developmentEndpointImport', False), ('formalReceiptDevelopmentEndpointImport', 'null-or-absent')):
        same(initialization.get(key), value, 'Natural initialization ' + key)
    sampling = protocol.get('sampling', {})
    for key, value in (('freshBusinessScenarios', True), ('businessScenarioCount', 144), ('scenarioCountPerPanel', 72),
                       ('clockRepetitionsPerScenario', 3), ('methodCount', 7), ('plannedEpisodes', 3024),
                       ('prospectiveInputGenerationBeforeFrozenRootAuthorization', False), ('businessScenarioReplacementAllowed', False),
                       ('repeatOrMethodFailureReplacementAllowed', False), ('timingRepetitionsAreIndependentBusinessSamples', False)):
        same(sampling.get(key), value, 'Fixed sampling rule ' + key)
    bindings = protocol.get('frozenAlgorithmBindings')
    require(isinstance(bindings, dict) and len(bindings) == 25, 'All 25 unchanged runtime bindings required')
    same(bindings.get('scripts/highs-planner-v13.mjs'), 'ec8df3da2d6d8dd28d5b6a0147a03f8c6dc113f5af3b2f185936c8d12f98b5bb', 'Unchanged guarded V13 source anchor')
    for name, sha in bindings.items(): same(digest(safe_path(source_root, name)), sha, 'Unchanged declared algorithm SHA ' + name)
    previous = read_json(source_root / 'data/protocol-v12.json')
    for panel, old in zip(protocol['panels'], previous['panels']): same(panel['shockPatterns'], old['shockPatterns'], 'Unchanged V12 shock catalog')
    same(protocol['analysis'].get('bootstrap'), {**previous['analysis']['bootstrap'], 'seed': 800001}, 'Fixed V14 scenario-cluster bootstrap declaration')
    for method in METHODS[:-1]: same(protocol['callBudgets'][method], previous['callBudgets'][method], 'Unchanged baseline parameters ' + method)
    same(protocol['callBudgets'][GUARDED], previous['callBudgets']['seededHiGHSV12'], 'Unchanged guarded V13 numeric parameters')
    for method in METHODS:
        same(protocol['callBudgets'][method]['timeBudgetMs'], 200, 'Common daily cooperative budget ' + method)
        require(not any(k in protocol['callBudgets'][method] for k in ('onIncumbent', 'onCandidate', 'enableDevelopmentEndpointImport')),
                'No diagnostic observer or development import configuration in formal protocol')
    if require_authorized:
        same(protocol.get('executionAuthorization', {}).get('status'), 'ready-for-source-freeze', 'Explicit finalized protocol authorization')
    return {'valid': True, 'caseCount': len(metadata), 'plannedEpisodes': 144 * 3 * 7,
            'methods': METHODS, 'historicalSeedExclusions': audit_historical_seeds(protocol, source_root)}


def audit_episode(nominal, events, result, label, method, v12, guard, budget=200):
    checked = v12.audit_episode(nominal, events, result, label, 5000, method, budget)
    counts = {**v12.empty_native_counts(), **{k: 0 for k in GUARD_FIELDS}}
    if method != GUARDED or not checked['historyAvailable']:
        return {**checked, 'guardedSelection': counts}
    for field in ('replayEndpointImportReceipt', 'replayEndpointImportBinding', 'replayPrefixChecks', 'replayIdentity', 'replayScope'):
        require(field not in result, label + ': formal natural D0 result contains forced-replay evidence ' + field)
    actual, fixed, previous = v12.ledger.realize(nominal, events), {}, None
    solver_calls = 0
    for day, (entry, call) in enumerate(zip(result['timeline'], result['plannerTrace'])):
        scenario, _ = v12.ledger.observed_snapshot(nominal, actual, events, day)
        meta = v12.v8.metadata(call)
        same(meta.get('developmentEndpointImport'), None, label + '/no development import')
        require(call.get('phase') not in ('archived_prefix', 'forced_endpoint'), label + ': formal prefix was forced')
        same(meta.get('decisionCalls'), day + 1, label + '/natural D0 decision count')
        current = meta.get('solverCalls')
        require(type(current) is int and current >= solver_calls and current - solver_calls in (0, 1), label + ': native request counter')
        solver_calls = current
        certificate = meta.get('nativeCertificate')
        if isinstance(certificate, dict): same(certificate.get('solverThreads'), 1, label + '/native single thread')
        audited = guard.audit_guard_selection(scenario, meta, entry['decisions'], fixed, previous, day,
            entry.get('status') == 'executed', label + f'/D{day}', budget)
        for key, value in audited.items(): counts[key] += value
        for field, counter in (('strictReplacementCount', 'strictReplacements'), ('tieRetainedCount', 'feeTiesRetained'),
                               ('commitmentReplacementCount', 'commitmentReplacements'), ('constructorCalls', 'constructorCalls'),
                               ('acceptedConstructorReceipts', 'acceptedConstructorReceipts')):
            same(meta.get(field), counts[counter], label + '/natural cumulative ' + field)
        if entry.get('status') == 'executed':
            previous = {row['id']: row for row in entry['decisions']}
            for event in entry['executedEvents']: fixed.setdefault(event['id'], {})[v12.ledger.EVENT_FIELDS[event['event']]] = day
    return {**checked, 'guardedSelection': counts, 'actualNativeRequests': solver_calls}


def audit_natural_receipt(result, configuration, v12, label):
    if result.get('executionHistoryUnavailable') is True:
        return {'knownStartup': False, 'knownNaturalCalls': None, 'dailyCooperativeOverruns': None}
    same(result.get('studyVersion'), 'v14', label + '/study version')
    same(result.get('naturalFullD0'), True, label + '/natural full-D0 receipt')
    same(result.get('developmentEndpointImportEnabled'), False, label + '/development import disabled')
    same(result.get('perCallBudget', {}).get('configuration'), configuration, label + '/actual configured call budget')
    startup = result.get('startupWallMs')
    require(v12.ledger.finite(startup) and 0 <= startup <= result['finalReceivedMs'], label + ': invalid charged startup wall')
    calls = result.get('plannerTrace')
    require(isinstance(calls, list) and calls, label + ': missing natural D0 trace')
    walls = [call.get('callWallMs') for call in calls]
    require(all(v12.ledger.finite(w) and w >= 0 for w in walls), label + ': invalid natural call wall')
    stats = result.get('plannerStats', {})
    same(stats.get('decisionCalls'), len(calls), label + '/all natural call count')
    same(stats.get('callWallMs'), walls, label + '/natural call clocks')
    v12.ledger.close(stats.get('planningWallMs'), sum(walls), label + '/planning wall aggregate')
    v12.ledger.close(stats.get('maxCallWallMs'), max(walls), label + '/maximum natural call wall')
    require(startup + sum(walls) <= result['finalReceivedMs'] + 1e-6, label + ': startup/planning work excluded from cold parent clock')
    for call in calls:
        meta = v12.v8.metadata(call)
        same(meta.get('developmentEndpointImport'), None, label + '/no development import receipt')
    return {'knownStartup': True, 'knownNaturalCalls': len(calls), 'dailyCooperativeOverruns': sum(w > configuration['timeBudgetMs'] for w in walls)}


def point_estimates(by_panel, producer_summary, v12, fixture=False):
    # Reuse the unchanged independently implemented arithmetic with an isolated
    # function-global dictionary. No old module constants or raw files mutate.
    import types
    environment = {**v12.point_estimates.__globals__, 'METHODS': METHODS, 'PAIRS': PAIRS}
    independent = types.FunctionType(v12.point_estimates.__code__, environment)
    return independent(by_panel, producer_summary, fixture)


def statistical_unit(result):
    """Keep only independently checked values required by point estimates.

    Full accepted histories are audited one raw file at a time; holding all
    3024 full proof trees would needlessly require gigabytes of memory.
    """
    first = (result.get('timeline') or [None])[0]
    trace = (result.get('plannerTrace') or [None])[0]
    return {key: result.get(key) for key in ('complete', 'totalCost', 'incrementalCost', 'revisionCount', 'executionHistoryUnavailable', 'failure')} | {
        'timeline': [{key: first.get(key) for key in ('day', 'status', 'audit', 'observationHash')}] if first else [],
        'plannerTrace': [{'callWallMs': trace.get('callWallMs')}] if trace else []}


def check_artifact(directory, ref, label):
    path = safe_path(directory, ref['path'], label)
    same(digest(path), ref['sha256'], label + '/SHA256')
    return path, read_json(path)


def audit_git_bindings(frozen, source_root):
    """Verify the copied subset's Git blob bytes without Git or a live checkout.

    Commit/tree identifiers are recorded provenance, not remote authentication
    or proof that this copied runtime subset is a complete repository tree.
    """
    form = frozen.get('gitObjectFormat')
    require(form in ('sha1', 'sha256'), 'Declared Git object format is missing')
    length = 40 if form == 'sha1' else 64
    for field in ('sourceGitCommit', 'sourceGitTree'):
        value = frozen.get(field)
        require(isinstance(value, str) and len(value) == length and all(c in '0123456789abcdef' for c in value), 'Malformed recorded ' + field)
    same(frozen.get('sourceCommitVerified'), True, 'Producer source-commit verification receipt')
    blobs = frozen.get('committedBlobHashes')
    require(isinstance(blobs, dict) and set(blobs) == set(frozen['implementationHashes']), 'Git blob/source inventory coverage differs')
    for name, expected in blobs.items():
        data = safe_path(source_root, name, 'Committed source').read_bytes()
        blob = hashlib.new(form, b'blob ' + str(len(data)).encode('ascii') + b'\0' + data).hexdigest()
        same(expected, blob, 'Independent Git blob ' + name)
    return {'sourceGitCommit': frozen['sourceGitCommit'], 'sourceGitTree': frozen['sourceGitTree'],
            'gitObjectFormat': form, 'copiedBlobCount': len(blobs), 'allCopiedBlobsMatchRecordedCommitInventory': True,
            'scope': 'Copied runtime/protocol blob bytes independently rebuilt without Git; recorded commit/tree provenance is not externally authenticated or a complete-repository-tree claim.'}


def audit_execution_bindings(index, frozen, snapshot, directory, manifest_sha):
    """Hash-bind the first-run marker and root-observed source push receipt."""
    same(index.get('manifestSha256'), manifest_sha, 'Index/original frozen manifest bytes')
    push_ref = frozen.get('sourcePushReceipt')
    require(isinstance(push_ref, dict), 'Missing root-observed pre-run source push receipt')
    same(push_ref.get('path'), 'source-push-receipt.json', 'Fixed source push receipt path')
    push_path = safe_path(snapshot, push_ref['path'], 'Source push receipt')
    same(digest(push_path), push_ref.get('sha256'), 'Root source push receipt SHA')
    push = read_json(push_path)
    same(push_ref.get('record'), push, 'Manifest/full root source push receipt')
    for key, value in (('schemaVersion', 'portplan-v14-root-verified-source-push'), ('sourceGitCommit', frozen['sourceGitCommit']),
                       ('remoteName', 'origin'), ('branch', 'main'), ('observedRemoteCommit', frozen['sourceGitCommit']),
                       ('verification', 'git push then authenticated git ls-remote exact branch; root observation, not external attestation')):
        same(push.get(key), value, 'Root-observed source push ' + key)
    stamp = push.get('verifiedAt'); require(isinstance(stamp, str), 'Source push verification time missing')
    try: verified = datetime.fromisoformat(stamp.replace('Z', '+00:00'))
    except ValueError as error: raise ValueError('Invalid root push verification UTC time') from error
    require(verified.tzinfo is not None and verified.utcoffset() == timezone.utc.utcoffset(verified), 'Source push verification time must be UTC')
    reference = index.get('executionStartArtifact')
    require(isinstance(reference, dict) and isinstance(reference.get('path'), str) and not Path(reference['path']).is_absolute(), 'Portable first-run marker reference missing')
    marker_path = (directory / reference['path']).resolve()
    same(marker_path, (snapshot / 'execution-start.json').resolve(), 'Unique frozen-directory execution marker')
    same(digest(marker_path), reference.get('sha256'), 'First-run marker SHA')
    marker = read_json(marker_path)
    for key, value in (('schemaVersion', 'portplan-v14-first-run-execution-start'), ('rootAuthorized', True),
                       ('manifestSha256', manifest_sha), ('protocolHash', index['protocolHash']),
                       ('sourceGitCommit', frozen['sourceGitCommit']), ('sourcePushReceiptSha256', push_ref['sha256']), ('plannedEpisodeCount', 3024)):
        same(marker.get(key), value, 'First-run marker ' + key)
    target = marker.get('outputRelativeToFrozen')
    require(isinstance(target, str) and target and not Path(target).is_absolute(), 'Marker requires portable output target')
    same((snapshot / target).resolve(), directory, 'One frozen-source marker names this exact output')
    return {'executionStartSha256': reference['sha256'], 'sourcePushReceiptSha256': push_ref['sha256'],
            'rootObservedPushedCommit': push['observedRemoteCommit'],
            'scope': 'Recorded WX first-run marker, source bytes and root push observation are internally bound; no remote lookup, solver invocation, external attestation or proof against deliberately forged historical receipts.'}


def review_run(directory, fixture=False):
    directory = directory.resolve(); index_path = directory / 'complete.json'; index_sha = digest(index_path)
    index = read_json(index_path)
    same(index.get('schemaVersion'), 'portplan-v14-streamed-experiment', 'Formal completed run schema')
    same(index.get('executionState'), 'complete', 'Formal run must be complete')
    relative = index.get('frozenSource')
    require(isinstance(relative, str) and not Path(relative).is_absolute(), 'Portable relative frozenSource is required')
    snapshot = (directory / relative).resolve()
    require(snapshot.is_relative_to(directory.parent), 'Frozen source escapes restored run bundle')
    frozen_path = snapshot / 'manifest.json'; frozen_sha = digest(frozen_path); frozen = read_json(frozen_path)
    same(frozen.get('schemaVersion'), 'portplan-v14-frozen-source', 'Frozen source schema')
    same(index.get('implementationHashes'), frozen.get('implementationHashes'), 'Source commitment map')
    source_root = snapshot / 'source'
    hashes = frozen.get('implementationHashes'); require(isinstance(hashes, dict) and hashes, 'Missing source commitments')
    for name, sha in hashes.items(): same(digest(safe_path(source_root, name, 'Frozen source')), sha, 'Frozen source SHA ' + name)
    git_bindings = audit_git_bindings(frozen, source_root)
    for name in [*HELPERS, 'scripts/review-v14.py', 'data/protocol-v14.json', 'data/protocol-v12.json', 'data/protocol-v2.json']:
        require(name in hashes, 'Unbound independent runtime dependency ' + name)
    if not fixture:
        for name in ('scripts/benchmark-v14.mjs', 'scripts/episode-v14.worker.mjs', *frozen['protocol'].get('frozenAlgorithmBindings', {})):
            require(name in hashes, 'Unbound declared runtime ' + name)
    same(hashes['scripts/review-v14.py'], digest(__file__), 'Review implementation frozen before first run')
    protocol = read_json(source_root / 'data/protocol-v14.json')
    same(digest(source_root / 'data/protocol-v14.json'), index.get('protocolHash'), 'Original protocol bytes')
    same(frozen.get('protocolHash'), index['protocolHash'], 'Manifest protocol SHA')
    same(index.get('protocol'), protocol, 'Index protocol content')
    same(frozen.get('protocol'), protocol, 'Frozen protocol content')
    execution_bindings = audit_execution_bindings(index, frozen, snapshot, directory, frozen_sha)
    for field in ('sourceGitCommit', 'sourceGitTree', 'gitObjectFormat', 'committedBlobHashes'):
        same(index.get(field), frozen[field], 'Index/manifest source provenance ' + field)
    same(frozen.get('generatedProspectiveInputs'), False, 'No prospective inputs before freeze')
    same(index.get('rootAuthorized'), True, 'Separate explicit runtime authorization')
    same(index.get('studyMethod'), GUARDED, 'Prespecified candidate')
    same(index.get('initialization'), protocol['initialization'], 'Actual natural initialization declaration')
    marker = read_json(directory / 'run.json')
    for field in ('schemaVersion', 'protocolHash', 'frozenSource', 'implementationHashes', 'sourceGitCommit',
                  'sourceGitTree', 'gitObjectFormat', 'committedBlobHashes', 'rootAuthorized', 'studyMethod', 'initialization', 'protocol'):
        same(marker.get(field), index[field], 'First-run authorization marker ' + field)
    same(marker.get('executionState'), 'running', 'Immutable marker precedes results')
    same(marker.get('cases'), [], 'First-run marker precedes input generation')
    same(marker.get('summary'), None, 'First-run marker precedes analysis')
    v12, guard = load_helpers(source_root)
    contract = audit_protocol(protocol, source_root, v12, require_authorized=not fixture)
    expected = declared_cases(protocol)
    if not fixture:
        same(frozen.get('scenarioMetadata'), expected, 'Independent 144-case declaration expansion')
        require(len(index.get('cases', [])) == 144, 'All 144 new cases required')
    else: require(isinstance(frozen.get('scenarioMetadata'), list) and frozen['scenarioMetadata'], 'Fixture metadata missing')
    generator_protocol = read_json(source_root / 'data/protocol-v2.json')
    counters = {'episodes': 0, 'completeEpisodes': 0, 'historyUnavailable': 0, 'acceptedPlans': 0, 'physicalEvents': 0, 'polishEndpoints': 0}
    candidate = {key: 0 for key in ('candidateEvents', 'completeCopiedCandidates', 'acceptedCandidates', 'independentlyInvalidCandidates', 'callsWithTimelyIncumbent')}
    native, guarded, parent = v12.empty_native_counts(), {**v12.empty_native_counts(), **{k: 0 for k in GUARD_FIELDS}}, {}
    natural_counts = {'knownStartupEpisodes': 0, 'unknownStartupEpisodes': 0, 'knownNaturalCalls': 0, 'dailyCooperativeOverruns': 0}
    seen_cases, seen_inputs, seen_episodes, by_panel, reviewed = set(), set(), set(), {}, []
    fingerprints, duplicates = {}, []
    same(len(index['cases']), len(frozen['scenarioMetadata']), 'Case/metadata coverage')
    for scenario_index, case in enumerate(index['cases']):
        require(case['id'] not in seen_cases, 'Duplicate business case'); seen_cases.add(case['id'])
        config = frozen['scenarioMetadata'][scenario_index]
        for key, value in config.items(): same(case.get(key), value, 'Declared case metadata ' + key)
        input_path, source = check_artifact(directory, case['inputArtifact'], 'Full scenario input')
        require(input_path not in seen_inputs, 'Reused scenario input path'); seen_inputs.add(input_path)
        same(source.get('config'), config, 'Input declared config')
        nominal, events = source['nominalScenario'], source['events']
        if not fixture:
            order_list = [{k: value for k, value in row.items() if k != 'id'} for row in nominal['containers']]
            fingerprint = hashlib.sha256(json.dumps(order_list, ensure_ascii=False, separators=(',', ':'), allow_nan=False).encode('utf-8')).hexdigest()
            same(case.get('orderFingerprint'), fingerprint, 'Independent complete order-list fingerprint')
            if fingerprint in fingerprints: duplicates.append({'id': case['id'], 'duplicateOf': fingerprints[fingerprint], 'sha256': fingerprint})
            else: fingerprints[fingerprint] = case['id']
        if not fixture:
            same(nominal, v12.ledger.generated_scenario(config, generator_protocol), 'Independent declared synthetic input reconstruction')
            expected_events = []
            for shock in config['shocks']:
                cap = v12.ledger.capacity(nominal, shock['resource'], shock['revealDay'])
                item = {k: v for k, v in shock.items() if k not in ('reductionNumerator', 'reductionDenominator')}
                item['capacity'] = max(0, cap - math.ceil(cap * shock['reductionNumerator'] / shock['reductionDenominator']))
                expected_events.append(item)
            same(events, expected_events, 'Independent private simulator shock reconstruction')
        same(len(case['repeats']), 3, 'Three prespecified clock repetitions')
        units = {method: [] for method in METHODS}
        for ri, repeat in enumerate(case['repeats']):
            same(repeat['repeatIndex'], ri + 1, 'Repeat order')
            same(repeat['algorithmSeed'], protocol['algorithmRepeats'][ri]['seed'], 'Declared clock seed')
            same(set(repeat['policies']), set(METHODS), 'All seven methods once per clock repeat')
            same(repeat['methodExecutionOrder'], [METHODS[(scenario_index + ri + i) % 7] for i in range(7)], 'Prespecified method rotation')
            for method in METHODS:
                receipt = repeat['policies'][method]; raw_path, envelope = check_artifact(directory, receipt['artifact'], 'Full episode')
                require(raw_path not in seen_episodes, 'Raw episode reused across cells'); seen_episodes.add(raw_path)
                same(receipt.get('scalarReceipt'), True, 'Scalar receipt declaration')
                for key, value in (('scenarioId', case['id']), ('caseId', case['id']), ('panel', case['panel']),
                                   ('method', method), ('repeatIndex', ri + 1), ('algorithmSeed', repeat['algorithmSeed'])):
                    same(envelope.get(key), value, 'Raw/index identity ' + key)
                label = f"{case['id']}--a{ri + 1}--{method}"
                same(envelope.get('episodeId'), label, 'Canonical episode identity')
                result = envelope['result']; same(result.get('policy'), method, 'Raw method identity')
                if not result.get('executionHistoryUnavailable'):
                    same(result.get('algorithmSeed'), repeat['algorithmSeed'], 'Accepted result clock seed')
                    same(result.get('repeatIndex'), ri + 1, 'Accepted result repeat')
                    if method == 'adaptiveV9':
                        for call in result['plannerTrace']:
                            meta = v12.v8.metadata(call)
                            same(meta.get('wholeCallBudgetMs'), 200, 'Adaptive cooperative call budget')
                            for field in v12.PARAMETERS:
                                same(meta.get('parameters', {}).get(field), protocol['callBudgets'][method][field], 'Frozen adaptive parameter ' + field)
                lifecycle = v12.audit_formal_parent_receipt(receipt, result, 5000, label)
                natural = audit_natural_receipt(result, protocol['callBudgets'][method], v12, label)
                checked = audit_episode(nominal, events, result, label, method, v12, guard)
                natural_counts['knownStartupEpisodes'] += natural['knownStartup']; natural_counts['unknownStartupEpisodes'] += not natural['knownStartup']
                if natural['knownStartup']:
                    natural_counts['knownNaturalCalls'] += natural['knownNaturalCalls']; natural_counts['dailyCooperativeOverruns'] += natural['dailyCooperativeOverruns']
                for key, value in lifecycle.items(): parent[key] = parent.get(key, 0) + value
                units[method].append(statistical_unit(result))
                counters['episodes'] += 1; counters['completeEpisodes'] += checked['complete']
                counters['historyUnavailable'] += not checked['historyAvailable']; counters['acceptedPlans'] += checked['acceptedPlans']
                counters['physicalEvents'] += checked['executedEvents']; counters['polishEndpoints'] += checked.get('polishEndpoints', 0)
                for key, value in checked['candidateDelivery'].items(): candidate[key] += value
                for key, value in checked['nativeStabilitySelection'].items(): native[key] += value
                for key, value in checked['guardedSelection'].items(): guarded[key] += value
                reviewed.append({'id': label, 'artifactSha256': receipt['artifact']['sha256'], 'parentLifecycle': lifecycle, 'naturalReceipt': natural, **checked})
        by_panel.setdefault(case['panel'], []).append({'id': case['id'], 'units': units})
    estimates = point_estimates(by_panel, index['summary'], v12, fixture)
    if not fixture: same(index.get('duplicateOrderLists'), duplicates, 'All duplicate order lists disclosed and retained without resampling')
    require(fixture or counters['episodes'] == 3024, 'Complete formal coverage must be 144 x 3 x 7')
    same(digest(index_path), index_sha, 'Read-only index unchanged'); same(digest(frozen_path), frozen_sha, 'Read-only manifest unchanged')
    return {'schemaVersion': 'portplan-independent-v14-run-review', 'valid': True, 'fixture': fixture, 'readOnly': True,
        'importsJavaScript': False, 'solverRuns': 0, 'inputIndexSha256': index_sha, 'protocolSha256': index['protocolHash'],
        'frozenManifestSha256': frozen_sha, 'implementationSha256': digest(__file__), 'independentHelperSha256': {name: hashes[name] for name in HELPERS},
        'sourceProvenance': git_bindings, 'firstRunBindings': execution_bindings, 'contract': contract, 'summary': counters,
        'parentLifecycle': parent, 'naturalExecution': natural_counts, 'candidateDelivery': candidate,
        'nativeStabilitySelection': native, 'guardedSelection': guarded, 'pointEstimates': estimates, 'episodes': reviewed,
        'scope': 'Independent Python review of all declared inputs and accepted physical paths, causal public observations, locks/resources/tariffs, null failed fees and unknown history, copied constructor/candidate gates, complete broad-domain M and atomic guarded native selection from natural D0, cold startup/final receipt/normal exit/ESRCH cleanup/end-to-end five-second eligibility, and pair-specific descriptive point estimates. No development endpoint import, forced historical prefix, old raw archive, optimizer rerun or JavaScript import. Recorded clock/OS receipts are not externally authenticated. Bootstrap/Pareto/default gates are audited separately; physical valid does not imply default gate passed, future recovery, real business savings or competition rank.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument('--run', type=Path); source.add_argument('--protocol', type=Path)
    source.add_argument('--episode', type=Path, help='Handwritten fixture episode only; requires --fixture')
    parser.add_argument('--fixture', action='store_true', help='Handwritten artifact-I/O tests only; never a formal result')
    parser.add_argument('--output', type=Path); args = parser.parse_args()
    require(not args.output or not args.output.exists(), 'Refuse to overwrite an independent review')
    if args.run: result = review_run(args.run, args.fixture)
    elif args.episode:
        require(args.fixture, 'Single-episode mode is only a handwritten fixture, never formal acceptance')
        v12, guard = load_helpers(ROOT); record = read_json(args.episode); before = digest(args.episode)
        checked = audit_episode(record['nominalScenario'], record.get('events', []), record['result'], 'handwritten-fixture', record['result']['policy'], v12, guard)
        same(digest(args.episode), before, 'Read-only fixture unchanged')
        result = {'schemaVersion': 'portplan-independent-v14-handwritten-fixture-review', 'valid': True, 'fixture': True,
                  'readOnly': True, 'importsJavaScript': False, 'solverRuns': 0, 'checked': checked}
    else:
        v12, _ = load_helpers(ROOT)
        result = {'schemaVersion': 'portplan-independent-v14-contract-review', 'readOnly': True, 'solverRuns': 0, 'importsJavaScript': False,
                  'protocolSha256': digest(args.protocol), 'implementationSha256': digest(__file__), **audit_protocol(read_json(args.protocol), ROOT, v12)}
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        with args.output.open('x', encoding='utf-8') as stream: stream.write(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k != 'episodes'}, ensure_ascii=False, allow_nan=False))


if __name__ == '__main__': main()
