import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, readdir, rm, chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createSourceRecoverySpec, sourceArchivePreflightProgram, sourceArchiveProgram} from '../scripts/prepare-public.mjs';

const sha = raw => createHash('sha256').update(raw).digest('hex');
const policyName = 'data/historical-transport-policy-v14.json';
const policyRaw = await readFile(new URL('../data/historical-transport-policy-v14.json', import.meta.url));
const policy = JSON.parse(policyRaw);
const hosting = {project_id: policy.primaryRecovery.projectId, static: {directory: 'dist'}, runtimeToken: 'FIXTURE_PRIVATE_ONLY'};
const instructions = '# 当前约定\n公开资料路线，当前包不是完整历史归档。\n';
const spec = () => createSourceRecoverySpec(hosting, instructions, '2026-10-17T07:00:00.000Z');
const canonical = files => JSON.stringify(files.map(x => ({bytes: x.bytes, path: x.path, sha256: x.sha256})));

async function fixture({inherited = true} = {}) {
  const parent = await mkdtemp(join(tmpdir(), 'portplan-v14-policy-'));
  const root = join(parent, 'project');
  const raw = new Map([
    ['AGENTS.md', Buffer.from(instructions)],
    ['package.json', Buffer.from('{}\n')],
    ['package-lock.json', Buffer.from('{}\n')],
    ['src/retained.txt', Buffer.from('ordinary retained source\n')],
    ['data/archives-v8/formal/manifest.json', Buffer.from('{"metadata":"retained V8 hash manifest"}\n')],
    ['data/archives-v9/formal/manifest.json', Buffer.from('{"metadata":"retained V9 hash manifest"}\n')],
    ['data/archives-v14/formal/manifest.json', Buffer.from('{"kind":"fixture, not formal results"}\n')],
    ['data/archives-v14/formal/part-0001.bin', Buffer.from([14, 1, 0, 255])],
    ['data/archives-v14/formal/part-0006.bin', Buffer.from([14, 6, 0, 255])],
    ['data/archives-v14/browser-first/manifest.json', Buffer.from('{"kind":"browser-first fixture"}\n')],
    ['data/archives-v14/browser-first/part-0001.bin', Buffer.from([14, 1, 1, 255])],
    ['data/archives-v14/browser-first/part-0006.bin', Buffer.from([14, 6, 1, 255])],
    ['data/archives-v14/browser-final/manifest.json', Buffer.from('{"kind":"browser-final fixture"}\n')],
    ['data/archives-v14/browser-final/part-0001.bin', Buffer.from([14, 1, 2, 255])],
    [policyName, policyRaw],
  ]);
  await mkdir(join(root, '.openai'), {recursive: true});
  await mkdir(join(root, 'public/data'), {recursive: true});
  await mkdir(join(root, 'public/downloads'), {recursive: true});
  await writeFile(join(root, '.openai/hosting.json'), JSON.stringify(hosting));
  await writeFile(join(root, '.openai/private.json'), 'FIXTURE_PRIVATE_ONLY');
  await writeFile(join(root, '.env.local'), 'FIXTURE_PRIVATE_ONLY');
  await mkdir(join(root, 'data/evidence-v14/frozen'), {recursive: true});
  await writeFile(join(root, 'data/evidence-v14/frozen/raw.json'), 'RESTORED_RAW_NOT_SOURCE');
  for (const [name, bytes] of raw) {
    await mkdir(join(root, name.split('/').slice(0, -1).join('/')), {recursive: true});
    await writeFile(join(root, name), bytes);
  }
  if (inherited) {
    const files = [...raw].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
      .map(([path, bytes]) => ({path, bytes: bytes.length, sha256: sha(bytes)}));
    const previous = {...spec().manifest,
      historicalOmissions: {policySha256: sha(policyRaw), omittedRecordsSha256: policy.omittedRecordsSha256},
      sourceCoverage: {files, inventorySha256: sha(canonical(files))},
    };
    await writeFile(join(root, 'source-recovery.json'), JSON.stringify(previous));
  }
  // A clean current bundle has neither Git metadata nor credentials. If the
  // packer accidentally invokes Git, this mock exits unsuccessfully and leaves
  // a marker outside the source tree.
  const tools = join(parent, 'tools'); await mkdir(tools);
  const marker = join(parent, 'git-was-called');
  await writeFile(join(tools, 'git'), '#!/bin/sh\nprintf called > "$PORTPLAN_TEST_GIT_MARKER"\nexit 71\n');
  await chmod(join(tools, 'git'), 0o755);
  const env = {...process.env, PATH: tools + ':' + process.env.PATH, PORTPLAN_TEST_GIT_MARKER: marker};
  return {parent, root, raw, env, marker};
}

function run(root, env, {preflight = false} = {}) {
  const code = preflight ? sourceArchivePreflightProgram(root, {requireHistoricalPolicy: true})
    : sourceArchiveProgram(root, spec(), {requireHistoricalPolicy: true});
  return spawnSync('python', ['-c', code], {encoding: 'utf8', env});
}

function inspect(root) {
  const result = spawnSync('python', ['-c', `from pathlib import Path
from zipfile import ZipFile
import hashlib,json
root=Path(${JSON.stringify(root)})
members={};source=None
for path in sorted((root/'public/downloads').glob('*.zip')):
 with ZipFile(path) as archive:
  for info in archive.infolist():
   if info.filename in members:raise ValueError('Duplicate across ZIPs')
   raw=archive.read(info)
   members[info.filename]={'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'zip':path.name}
   if info.filename=='portplan/source-recovery.json':source=json.loads(raw)
print(json.dumps({'members':members,'recovery':source}))`], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('the policy fixes exactly 22 historical binary receipts and an authorized immutable Git source', () => {
  assert.equal(policy.omittedFiles.length, 22);
  assert.equal(new Set(policy.omittedFiles.map(x => x.path)).size, 22);
  assert.equal(policy.omittedFiles.reduce((sum, x) => sum + x.bytes, 0), 73513198);
  assert.equal(sha(canonical(policy.omittedFiles)), policy.omittedRecordsSha256);
  assert.equal(policy.primaryRecovery.commit, 'f99d252180d87ef616278ca8e14e17b496480fb4');
  assert.equal(policy.primaryRecovery.requiresAuthorizedRepositoryAccess, true);
  assert.equal(policy.secondaryRecord.liveSiteUrlIsImmutableHistoricalDownload, false);
});

test('an exactly scoped current-bundle recovery repackages without historical bins, Git, or credentials', async () => {
  const f = await fixture();
  try {
    const preflight = run(f.root, f.env, {preflight: true});
    assert.equal(preflight.status, 0, preflight.stderr);
    const result = run(f.root, f.env);
    assert.equal(result.status, 0, result.stderr);
    assert.equal((await readdir(f.parent)).includes('git-was-called'), false);
    const {members, recovery} = inspect(f.root);
    for (const [name, bytes] of f.raw) {
      assert.deepEqual({bytes: members['portplan/' + name]?.bytes, sha256: members['portplan/' + name]?.sha256},
        {bytes: bytes.length, sha256: sha(bytes)}, name);
    }
    for (const item of policy.omittedFiles) assert.equal(members['portplan/' + item.path], undefined);
    assert.equal(Object.keys(members).some(name => name.includes('evidence-v14') || name.includes('.env') || name.includes('private.json')), false);
    assert.equal(recovery.sourceCoverage.verificationBasis, 'retained-bundle-recovery');
    assert.equal(recovery.gitHistoryIncluded, false);
    assert.equal(recovery.deploymentCredentialsIncluded, false);
    assert.equal(recovery.historicalOmissions.omittedFileCount, 22);
    assert.equal(sha(canonical(recovery.sourceCoverage.files)), recovery.sourceCoverage.inventorySha256);
    assert.equal(members['portplan/data/archives-v14/formal/part-0001.bin'].zip, 'portplan-experiments-v14.zip');
    assert.equal(members['portplan/data/archives-v14/formal/part-0006.bin'].zip, 'portplan-experiments-v14-part2.zip');
    assert.equal(members['portplan/data/archives-v14/browser-first/part-0001.bin'].zip, 'portplan-experiments-v14-browser-first.zip');
    assert.equal(members['portplan/data/archives-v14/browser-first/part-0006.bin'].zip, 'portplan-experiments-v14-browser-first-part2.zip');
    assert.equal(members['portplan/data/archives-v14/browser-final/part-0001.bin'].zip, 'portplan-experiments-v14-browser-final.zip');
    assert.equal(members['portplan/data/archives-v14/browser-first/manifest.json'].zip, 'portplan-experiments-v14-browser-first.zip');
    let packages;
    for (const revision of ['v9', 'v10', 'v11', 'v12', 'v13', 'v14']) {
      const current = JSON.parse(await readFile(join(f.root, `public/data/download-packages-${revision}.json`), 'utf8'));
      assert.equal(current.schemaVersion, `portplan-${revision}-download-packages`);
      assert.equal(current.scope, 'current-source-and-retained-evidence-not-complete-historical-archives');
      assert.deepEqual(current.historicalOmissions.omittedFiles, policy.omittedFiles);
      assert.deepEqual(current.sourceRecovery, recovery);
      if (packages) assert.deepEqual(current.packages, packages);
      packages = current.packages;
      for (const p of packages) {
        const bytes = await readFile(join(f.root, 'public/downloads', p.file));
        assert.equal(bytes.length, p.bytes); assert.equal(sha(bytes), p.sha256);
      }
    }
    // A second clean extraction consumes the actual newly emitted receipt,
    // rather than the fixture's initial minimal recovery metadata.
    const recovered = join(f.parent, 'second'); await mkdir(recovered);
    const extract = spawnSync('python', ['-c', `from pathlib import Path
from zipfile import ZipFile
root=Path(${JSON.stringify(f.root)})
for path in sorted((root/'public/downloads').glob('*.zip')):
 with ZipFile(path) as archive:archive.extractall(${JSON.stringify(recovered)})`], {encoding: 'utf8'});
    assert.equal(extract.status, 0, extract.stderr);
    const second = join(recovered, 'portplan');
    await mkdir(join(second, 'public/data'), {recursive: true});
    await mkdir(join(second, 'public/downloads'), {recursive: true});
    const repack = run(second, f.env);
    assert.equal(repack.status, 0, repack.stderr);
    assert.deepEqual(inspect(second).recovery.historicalOmissions, recovery.historicalOmissions);
  } finally {await rm(f.parent, {recursive: true, force: true});}
});

test('unlisted missing retained files, changed historical receipts, and missing recovery proof fail before any ZIP opens', async t => {
  const cases = [
    ['missing ordinary retained source', async f => rm(join(f.root, 'src/retained.txt')), /retained source file is missing/],
    ['missing retained historical JSON', async f => rm(join(f.root, 'data/archives-v8/formal/manifest.json')), /retained source file is missing/],
    ['missing policy', async f => rm(join(f.root, policyName)), /policy is required/],
    ['missing source coverage receipt', async f => rm(join(f.root, 'source-recovery.json')), /without a current-bundle source coverage receipt/],
    ['corrupt source coverage receipt', async f => {const p=join(f.root, 'source-recovery.json'),o=JSON.parse(await readFile(p));o.sourceCoverage.inventorySha256='0'.repeat(64);await writeFile(p,JSON.stringify(o));}, /inventory is missing or inconsistent/],
    ['additional policy omission', async f => {const o=structuredClone(policy);o.omittedFiles.push({path:'src/retained.txt',bytes:1,sha256:'0'.repeat(64)});await writeFile(join(f.root,policyName),JSON.stringify(o));}, /exactly the fixed 22/],
    ['changed listed digest', async f => {const o=structuredClone(policy);o.omittedFiles[0].sha256='0'.repeat(64);await writeFile(join(f.root,policyName),JSON.stringify(o));}, /exactly the fixed 22/],
    ['changed fixed Git source', async f => {const o=structuredClone(policy);o.primaryRecovery.commit='1'.repeat(40);await writeFile(join(f.root,policyName),JSON.stringify(o));}, /fixed authorized Git source/],
    ['present historical binary conflicts', async f => {const path=join(f.root,policy.omittedFiles[0].path);await mkdir(join(path,'..'),{recursive:true});await writeFile(path,Buffer.from([0]));}, /Historical binary differs/],
  ];
  for (const [name, arrange, message] of cases) await t.test(name, async () => {
    const f = await fixture();
    try {
      await arrange(f);
      const result = run(f.root, f.env);
      assert.notEqual(result.status, 0); assert.match(result.stderr, message);
      assert.deepEqual(await readdir(join(f.root, 'public/downloads')), []);
      assert.equal(result.stdout.includes('FIXTURE_PRIVATE_ONLY'), false);
    } finally {await rm(f.parent, {recursive: true, force: true});}
  });
});

test('a policy alone cannot authorize missing historical files in an unproven bare directory', async () => {
  const f = await fixture({inherited: false});
  try {
    const result = run(f.root, f.env);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /without a current-bundle source coverage receipt/);
    assert.deepEqual(await readdir(join(f.root, 'public/downloads')), []);
  } finally {await rm(f.parent, {recursive: true, force: true});}
});

test('editing an existing retained source file records the new snapshot without requiring historical Git objects', async () => {
  const f = await fixture();
  try {
    const updated = Buffer.from('authorized new contents in an existing source path\n');
    await writeFile(join(f.root, 'src/retained.txt'), updated);
    const result = run(f.root, f.env);
    assert.equal(result.status, 0, result.stderr);
    assert.equal((await readdir(f.parent)).includes('git-was-called'), false);
    const packed = inspect(f.root);
    assert.equal(packed.members['portplan/src/retained.txt'].sha256, sha(updated));
    assert.equal(packed.recovery.sourceCoverage.files.find(x => x.path === 'src/retained.txt').sha256, sha(updated));
  } finally {await rm(f.parent, {recursive: true, force: true});}
});
