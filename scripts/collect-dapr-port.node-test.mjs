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
if [ "$TEST_AZ_FAIL" = 1 ]; then echo 'DO-NOT-LOG-ERROR 127.0.0.1' >&2; exit 1; fi
case "$2 $3" in
  'show -g') echo candidate ;;
  'revision show') echo "$TEST_IMAGE" ;;
  'replica list') echo "$TEST_REPLICAS" ;;
  *) exit 1 ;;
esac
`, {mode: 0o755});
  writeFileSync(join(dir, 'timeout'), `#!/bin/sh
printf '%s\n' "$*" >> "$TEST_TIMEOUTS"
shift 2
exec "$@"
`, {mode: 0o755});
  writeFileSync(join(dir, 'script'), `#!/bin/sh
printf '%s\n' "$*" >> "$TEST_CALLS"
cat >/dev/null
printf '%s\n' "$TEST_OUTPUT"
exit "\${TEST_SCRIPT_STATUS:-1}"
`, {mode: 0o755});
  const calls = join(dir, 'calls');
  const timeouts = join(dir, 'timeouts');
  writeFileSync(timeouts, '');
  writeFileSync(calls, '');
  const output = execFileSync('bash', ['scripts/collect-dapr-port.sh'], {
    encoding: 'utf8', timeout: 20000,
    env: {...process.env, PATH: `${dir}:${process.env.PATH}`, RESOURCE_GROUP: 'fixture', APP_NAME: 'hhc-web', IMAGE_REF: `registry/image@sha256:${'a'.repeat(64)}`, TEST_IMAGE: `registry/image@sha256:${'a'.repeat(64)}`, TEST_CALLS: calls, TEST_TIMEOUTS: timeouts,
      TEST_REPLICAS: JSON.stringify([{name: 'healthy', containers: [{name: 'daprd', ready: true}]}, {name: 'broken', containers: [{name: 'daprd', ready: false}]}]), ...overrides}
  });
  return {output, calls: readFileSync(calls, 'utf8'), timeouts: readFileSync(timeouts, 'utf8')};
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

const snapshot = {capturedAt: '2026-10-22T00:00:00.000Z', port: 50002,
  sockets: [], owners: [], unresolvedInodes: [], readErrors: []};

test('emits only the validated snapshot and suppresses console commands, addresses and environment', t => {
  const {output, timeouts} = runCollector(t, {TEST_SCRIPT_STATUS: '0',
    TEST_OUTPUT: `DO-NOT-LOG-ARGS env=SECRET 127.0.0.1\n${JSON.stringify(snapshot)}\nDO-NOT-LOG-END`});
  assert.doesNotMatch(output, /DO-NOT-LOG|SECRET|127\.0\.0\.1/);
  assert.equal(output.trim().split('\n').length, 2);
  assert.deepEqual(JSON.parse(output.split('\n')[0]), snapshot);
  assert.match(timeouts, /--kill-after=2s 12s/);
});

test('keeps malformed or extended console JSON unknown without logging it', t => {
  const {output} = runCollector(t, {TEST_SCRIPT_STATUS: '0',
    TEST_OUTPUT: JSON.stringify({...snapshot, args: 'DO-NOT-LOG', env: 'SECRET'})});
  assert.match(output, /socket owner remains unknown/);
  assert.doesNotMatch(output, /DO-NOT-LOG|SECRET/);
});

test('rejects mutable candidate tags without calling a replica console', t => {
  const {output, calls} = runCollector(t, {IMAGE_REF: 'registry/image:latest'});
  assert.equal(calls, '');
  assert.match(output, /Unpinned candidate image/);
});

test('keeps the hard rollback budget and current stripped immutable image flow', () => {
  const release = readFileSync('.github/workflows/release.yml', 'utf8');
  const capture = release.indexOf('- name: Capture candidate Dapr port evidence');
  assert.ok(capture > 0 && capture < release.indexOf('- name: Roll back failed update'));
  assert.match(release.slice(capture, release.indexOf('- name: Roll back failed update')), /timeout --kill-after=5s 55s/);
  assert.match(release, /docker pull "\$IMAGE_REF"[\s\S]*?"\$IMAGE_REF" \/app\/diagnose-dapr-port\.mjs/);
  assert.match(readFileSync('Dockerfile', 'utf8'), /COPY --from=stripped_build[^\n]+diagnose-dapr-port\.mjs/);
});

test('does not inspect the previous healthy revision even when its image is identical', t => {
  const {output, calls} = runCollector(t, {PREVIOUS_READY_REVISION: 'candidate'});
  assert.equal(calls, '');
  assert.match(output, /No matching candidate revision/);
});

test('suppresses failed control-plane query output and records only unknown', t => {
  assert.throws(() => runCollector(t, {TEST_AZ_FAIL: '1'}), error => {
    assert.match(error.stdout, /socket owner remains unknown/);
    assert.doesNotMatch(String(error.stdout) + String(error.stderr), /DO-NOT-LOG|127\.0\.0\.1/);
    return true;
  });
});
