import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, readdir, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createSourceRecoverySpec, sourceArchivePreflightProgram, sourceArchiveProgram} from '../scripts/prepare-public.mjs';

const sha256 = value => createHash('sha256').update(value).digest('hex');
const hosting = {project_id: 'YOUR_SITES_PROJECT_ID_fixture_original', static: {directory: 'dist'}, privateRuntime: 'FIXTURE_DO_NOT_EXPORT'};
const instructions = '# 当前约定\n公开资料路线；V13仅为开发，不改V12正式研究。\n';
const recovery = () => createSourceRecoverySpec(hosting, instructions, '2026-10-17T00:00:00.000Z');

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'portplan-packaging-v13-'));
  const originals = new Map();
  for (const path of ['.openai', 'public/data', 'public/downloads', 'data/archives-v13/replay', 'data/archives-v13/browser', 'data/evidence-v13/frozen/source']) {
    await mkdir(join(root, path), {recursive: true});
  }
  await Promise.all([
    writeFile(join(root, 'AGENTS.md'), instructions),
    writeFile(join(root, '.openai/hosting.json'), JSON.stringify(hosting)),
    writeFile(join(root, '.openai/private-runtime.json'), 'FIXTURE_DO_NOT_EXPORT'),
    writeFile(join(root, '.env.local'), 'FIXTURE_DO_NOT_EXPORT'),
    writeFile(join(root, 'package.json'), '{}\n'),
    writeFile(join(root, 'data/archives-v13/replay/manifest.json'), '{"kind":"development"}\n'),
    writeFile(join(root, 'data/archives-v13/browser/manifest.json'), '{"kind":"browser-evidence"}\n'),
    writeFile(join(root, 'data/evidence-v13/frozen/observations.json'), 'RESTORED_RAW_MUST_NOT_ENTER_ZIP'),
  ]);
  // This nested tool link must never be traversed inside an excluded restored
  // evidence tree; real archive inputs remain subject to the strict preflight.
  await symlink(join(root, '.env.local'), join(root, 'data/evidence-v13/frozen/source/excluded-link'));
  for (let number = 1; number <= 11; number++) {
    const path = `data/archives-v13/replay/part-${String(number).padStart(4, '0')}.bin`;
    const raw = Buffer.from([13, number, 0, 255, 128, number]);
    originals.set(path, raw);
    await writeFile(join(root, path), raw);
  }
  const browser = 'data/archives-v13/browser/part-0001.bin';
  originals.set(browser, Buffer.from([13, 99, 0, 255]));
  await writeFile(join(root, browser), originals.get(browser));
  for (const revision of ['v9', 'v10', 'v11', 'v12']) {
    await mkdir(join(root, `data/archives-${revision}/old`), {recursive: true});
    const path = `data/archives-${revision}/old/part-0001.bin`;
    const raw = Buffer.from([Number(revision.slice(1)), 0, 255]);
    originals.set(path, raw);
    await writeFile(join(root, path), raw);
  }
  return {root, originals};
}

function inspectPackages(root) {
  const result = spawnSync('python', ['-c', `from pathlib import Path
from zipfile import ZipFile
import hashlib,json
root=Path(${JSON.stringify(root)})
result={}
for path in sorted((root/'public/downloads').glob('*.zip')):
 with ZipFile(path) as archive:
  result[path.name]={}
  for info in archive.infolist():
   data=archive.read(info)
   if info.filename in result[path.name]: raise ValueError('Duplicate member')
   result[path.name][info.filename]={'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
print(json.dumps(result))`], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('V13 development archives preserve all bytes across five-index ZIP groups and every legacy download alias', async () => {
  const {root, originals} = await fixture();
  try {
    const preflight = spawnSync('python', ['-c', sourceArchivePreflightProgram(root, {includeRecoveryInputs: true})], {encoding: 'utf8'});
    assert.equal(preflight.status, 0, preflight.stderr);
    const packed = spawnSync('python', ['-c', sourceArchiveProgram(root, recovery())], {encoding: 'utf8'});
    assert.equal(packed.status, 0, packed.stderr);
    const archives = inspectPackages(root);
    const v13Names = Object.keys(archives).filter(name => name.startsWith('portplan-experiments-v13'));
    assert.deepEqual(v13Names, ['portplan-experiments-v13-part2.zip', 'portplan-experiments-v13-part3.zip', 'portplan-experiments-v13.zip']);
    const seen = new Set();
    for (const [relative, raw] of originals) {
      const revision = relative.split('/')[1].slice('archives-'.length);
      const number = Number(relative.match(/part-(\d+)\.bin$/)[1]);
      const shard = Math.floor((number - 1) / 5) + 1;
      const zip = `portplan-experiments-${revision}${shard === 1 ? '' : `-part${shard}`}.zip`;
      const member = `portplan/${relative}`;
      assert.deepEqual(archives[zip][member], {bytes: raw.length, sha256: sha256(raw)}, relative);
      seen.add(member);
    }
    for (const [directory, contents] of [['replay', '{"kind":"development"}\n'], ['browser', '{"kind":"browser-evidence"}\n']]) {
      const raw = Buffer.from(contents);
      assert.deepEqual(archives['portplan-experiments-v13.zip'][`portplan/data/archives-v13/${directory}/manifest.json`],
        {bytes: raw.length, sha256: sha256(raw)}, 'Archive manifests must accompany their raw chunks in the base ZIP.');
    }
    const allMembers = Object.values(archives).flatMap(entries => Object.keys(entries));
    assert.equal(new Set(allMembers).size, allMembers.length, 'Every source path must occur only once across the package set.');
    assert.deepEqual(new Set(allMembers.filter(name => name.endsWith('.bin'))), seen);
    assert.equal(allMembers.some(name => name.includes('/evidence-v13/') || name.includes('.env') || name.includes('private-runtime')), false);
    assert.equal(Object.keys(archives['portplan-source.zip']).some(name => name.startsWith('portplan/data/archives-v13/')), false);
    const sourceMetadata = JSON.parse(await readFile(join(root, 'public/data/source-recovery-v11.json'), 'utf8'));
    assert.deepEqual(sourceMetadata, recovery().manifest);
    let canonicalPackages;
    for (const revision of ['v9', 'v10', 'v11', 'v12', 'v13']) {
      const manifest = JSON.parse(await readFile(join(root, `public/data/download-packages-${revision}.json`), 'utf8'));
      assert.equal(manifest.schemaVersion, `portplan-${revision}-download-packages`);
      assert.deepEqual(manifest.sourceRecovery, sourceMetadata);
      if (canonicalPackages) assert.deepEqual(manifest.packages, canonicalPackages);
      else canonicalPackages = manifest.packages;
      assert.deepEqual(manifest.packages.filter(item => item.id.startsWith('experimentsV13')).map(item => item.id), ['experimentsV13Part1', 'experimentsV13Part2', 'experimentsV13Part3']);
      for (const item of manifest.packages) {
        const raw = await readFile(join(root, 'public/downloads', item.file));
        assert.equal(item.url, `/downloads/${item.file}`);
        assert.equal(item.bytes, raw.length);
        assert.equal(item.sha256, sha256(raw));
        assert.equal(item.fileCount, Object.keys(archives[item.file]).length);
      }
    }
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('a V13 archive input link is rejected before opening any output ZIP', async () => {
  const {root} = await fixture();
  try {
    const chunk = join(root, 'data/archives-v13/replay/part-0006.bin');
    await rm(chunk);
    await symlink(join(root, '.env.local'), chunk);
    for (const program of [sourceArchivePreflightProgram(root), sourceArchiveProgram(root, recovery())]) {
      const result = spawnSync('python', ['-c', program], {encoding: 'utf8'});
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /Symbolic links/);
      assert.equal(result.stdout.includes('FIXTURE_DO_NOT_EXPORT'), false);
    }
    assert.deepEqual(await readdir(join(root, 'public/downloads')), []);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
