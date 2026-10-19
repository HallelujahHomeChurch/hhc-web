import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync, writeFileSync, readFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';

function runCollector(t, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'dapr-console-'));
  t.after(() => rmSync(dir, {recursive: true, force: true}));
  writeFileSync(join(dir, 'az'), `#!/bin/sh
case "$2 $3" in
  'show -g') echo candidate ;;
  'revision show') echo "$TEST_IMAGE" ;;
  'replica list') echo "$TEST_REPLICAS" ;;
  *) exit 1 ;;
esac
`, {mode: 0o755});
  writeFileSync(join(dir, 'timeout'), '#!/bin/sh\nshift\nexec "$@"\n', {mode: 0o755});
  writeFileSync(join(dir, 'script'), '#!/bin/sh\nprintf "%s\\n" "$*" >> "$TEST_CALLS"\ncat >/dev/null\nexit 1\n', {mode: 0o755});
  const calls = join(dir, 'calls');
  writeFileSync(calls, '');
  const output = execFileSync('bash', ['scripts/collect-dapr-port.sh'], {
    encoding: 'utf8', timeout: 20000,
    env: {...process.env, PATH: `${dir}:${process.env.PATH}`, RESOURCE_GROUP: 'fixture', APP_NAME: 'hhc-web', IMAGE_REF: 'expected', TEST_IMAGE: 'expected', TEST_CALLS: calls,
      TEST_REPLICAS: JSON.stringify([{name: 'healthy', containers: [{name: 'daprd', ready: true}]}, {name: 'broken', containers: [{name: 'daprd', ready: false}]}]), ...overrides}
  });
  return {output, calls: readFileSync(calls, 'utf8')};
}

test('prioritizes unhealthy Dapr and continues gathering when a console fails', t => {
  const {output, calls} = runCollector(t);
  assert.equal(calls.trim().split('\n').length, 2);
  assert.ok(calls.indexOf('broken') < calls.indexOf('healthy'));
  assert.match(calls, /--revision "candidate".*--container "hhc-web"/);
  assert.match(calls, /\/nodejs\/bin\/node \/app\/diagnose-dapr-port.mjs/);
  assert.match(output, /socket owner remains unknown/);
});

test('never runs diagnostics against a different image or the previous healthy revision', t => {
  const {output, calls} = runCollector(t, {TEST_IMAGE: 'previous-image'});
  assert.equal(calls, '');
  assert.match(output, /No matching candidate revision/);
});

test('reports missing replicas without trying an unpinned console', t => {
  const {output, calls} = runCollector(t, {TEST_REPLICAS: '[]'});
  assert.equal(calls, '');
  assert.match(output, /no replicas/);
});

test('can capture a starting replica before container readiness data is available', t => {
  const {calls} = runCollector(t, {TEST_REPLICAS: '[{"name":"starting","containers":null}]'});
  assert.match(calls, /--replica "starting"/);
});
