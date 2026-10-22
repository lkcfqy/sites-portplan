import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
function python(body){
  const preamble=`import sys,importlib.util,json,tempfile,shutil,hashlib\nfrom pathlib import Path\nsys.dont_write_bytecode=True\nroot=Path(${JSON.stringify(root)})\nspec=importlib.util.spec_from_file_location('evidence11',root/'scripts/verify-public-evidence-v11.py')\nm=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\n`;
  const result=spawnSync('python3',['-c',preamble+body],{cwd:root,encoding:'utf8',timeout:30000,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
  assert.equal(result.status,0,result.stderr||result.stdout||String(result.error));
  return result.stdout;
}
const copyGate=`for name in ['data/public-gate-validation-v3.json','data/public-gate-protocol-v3.json','data/public/v3-gate-visits-deidentified.csv']:\n    destination=fixture/name;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(root/name,destination)\n`;

test('identifier-free gate data alone reproduces selection, tails, date counts and bootstrap without raw identifiers',()=>{
  const result=python(`with tempfile.TemporaryDirectory() as temporary:\n fixture=Path(temporary)\n ${copyGate.replaceAll('\n','\n ')}\n result=m.gate_recalculation(m.Evidence(fixture))\n assert result['counts']=={'records':58171,'trainCount':41039,'validationCount':7980,'testCount':9152}\n assert result['selectedModel']=='hour_median'\n assert result['dailyBootstrap95IntervalMinutes']==[0.3024015758736723,1.2936972394539736]\n assert result['candidates'][1]['test']['p90AbsoluteError']==35\n print('ok')\n`);
  assert.match(result,/ok/);
});

test('checker rejects changed tail metrics and bootstrap endpoints rather than trusting saved summaries',()=>{
  python(`with tempfile.TemporaryDirectory() as temporary:\n fixture=Path(temporary)\n ${copyGate.replaceAll('\n','\n ')}\n path=fixture/'data/public-gate-validation-v3.json'\n archive=json.loads(path.read_text())\n archive['candidates'][1]['test']['p90AbsoluteError']+=1\n path.write_text(json.dumps(archive))\n try:m.gate_recalculation(m.Evidence(fixture))\n except ValueError as error:assert 'p90AbsoluteError' in str(error),str(error)\n else:raise AssertionError('tampered tail accepted')\n archive['candidates'][1]['test']['p90AbsoluteError']-=1\n archive['summary']['dailyBootstrap95IntervalMinutes'][1]+=.25\n path.write_text(json.dumps(archive))\n try:m.gate_recalculation(m.Evidence(fixture))\n except ValueError as error:assert 'bootstrap endpoint' in str(error),str(error)\n else:raise AssertionError('tampered bootstrap accepted')\n`);
});

test('nonfinite derived target is rejected even after its declared CSV hash is updated',()=>{
  python(`with tempfile.TemporaryDirectory() as temporary:\n fixture=Path(temporary)\n ${copyGate.replaceAll('\n','\n ')}\n path=fixture/'data/public/v3-gate-visits-deidentified.csv'\n raw=path.read_bytes().replace(b'2026-01-01 09:20,63',b'2026-01-01 09:20,NaN',1)\n path.write_bytes(raw)\n saved=fixture/'data/public-gate-validation-v3.json'\n archive=json.loads(saved.read_text());archive['source']['cleanedSha256']=hashlib.sha256(raw).hexdigest();saved.write_text(json.dumps(archive))\n try:m.gate_recalculation(m.Evidence(fixture))\n except ValueError as error:assert 'nonfinite gate elapsed' in str(error),str(error)\n else:raise AssertionError('nonfinite target accepted')\n`);
});

test('path traversal, escaping symlinks, missing inputs and nonfinite/duplicate JSON are explicit errors',()=>{
  python(`with tempfile.TemporaryDirectory() as temporary:\n fixture=Path(temporary)\n for path in ['../outside','/absolute','a/../../outside','a\\\\outside']:\n  try:m.safe_path(fixture,path)\n  except ValueError:pass\n  else:raise AssertionError('unsafe path accepted: '+path)\n (fixture/'escape').symlink_to(fixture.parent,target_is_directory=True)\n try:m.safe_path(fixture,'escape/outside')\n except ValueError:pass\n else:raise AssertionError('escaping symlink accepted')\n try:m.Evidence(fixture).raw('missing.json')\n except ValueError as error:assert 'Missing required' in str(error)\n else:raise AssertionError('missing input accepted')\n for raw in ['{"x":NaN}','{"x":Infinity}','{"x":1e999}','{"x":1,"x":2}']:\n  try:m.parse_json(raw)\n  except ValueError:pass\n  else:raise AssertionError('invalid JSON accepted: '+raw)\n`);
});

test('allowed current source drift binds to exact frozen bytes while data drift and corrupted snapshots fail',()=>{
  python(`with tempfile.TemporaryDirectory() as temporary:\n fixture=Path(temporary);original=b'frozen source';expected=hashlib.sha256(original).hexdigest()\n for path,data in [('src/model.js',b'new development'),('frozen/src/model.js',original),('data/input.json',b'changed data'),('frozen/data/input.json',original)]:\n  destination=fixture/path;destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes(data)\n evidence=m.Evidence(fixture)\n result=evidence.bind_historical_source('src/model.js',expected,'frozen')\n assert result['liveDiffers'] is True and result['verifiedPath']=='frozen/src/model.js'\n try:evidence.bind_historical_source('data/input.json',expected,'frozen')\n except ValueError:pass\n else:raise AssertionError('historical data substitution accepted')\n (fixture/'frozen/src/model.js').write_bytes(b'corrupted')\n try:evidence.bind_historical_source('src/model.js',expected,'frozen')\n except ValueError as error:assert 'SHA256 differs' in str(error)\n else:raise AssertionError('corrupt snapshot accepted')\n`);
});
