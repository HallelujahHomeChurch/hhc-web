import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {collectPortSnapshot} from './diagnose-dapr-port.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'dapr-proc-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const file = (name, value) => {
    mkdirSync(join(root, name, '..'), {recursive: true});
    writeFileSync(join(root, name), value);
  };
  file('net/tcp', 'header\n');
  file('net/tcp6', 'header\n');
  file('sys/net/ipv4/ip_local_port_range', '32768\t60999\n');
  file('sys/net/ipv4/ip_local_reserved_ports', '\n');
  mkdirSync(join(root, 'self/ns'), {recursive: true});
  symlinkSync('net:[10]', join(root, 'self/ns/net'));
  symlinkSync('pid:[20]', join(root, 'self/ns/pid'));
  return {root, file};
}

test('identifies a process owning a 50002 outbound source socket without exposing arguments or addresses', t => {
  const {root, file} = fixture(t);
  file('net/tcp', 'header\n0: 0100007F:C352 0100007F:18EB 01 0:0 0:0 0 1000 0 41\n1: 0100007F:9C40 0100007F:C352 01 0:0 0:0 0 1000 0 42\n');
  file('7/comm', 'node\n');
  file('7/cmdline', 'DO-NOT-LOG-ARGUMENTS');
  file('7/environ', 'DO-NOT-LOG-SECRETS');
  mkdirSync(join(root, '7/fd'));
  symlinkSync('socket:[41]', join(root, '7/fd/3'));
  symlinkSync('/nodejs/bin/node', join(root, '7/exe'));
  const result = collectPortSnapshot(root);
  assert.deepEqual(result.sockets, [{family: 'tcp', localPort: 50002, remotePort: 6379, state: '01', uid: 1000, inode: '41'}]);
  assert.deepEqual(result.owners, [{pid: 7, command: 'node', executable: 'node', inodes: ['41']}]);
  assert.deepEqual(result.unresolvedInodes, []);
  assert.deepEqual(result.readErrors, []);
  assert.equal(result.networkNamespace, 'net:[10]');
  assert.doesNotMatch(JSON.stringify(result), /DO-NOT-LOG|0100007F/);
});

test('preserves an IPv6 listener and kernel TIME_WAIT without inventing an invisible owner', t => {
  const {root, file} = fixture(t);
  file('net/tcp6', 'header\n0: 00000000000000000000000000000000:C352 00000000000000000000000000000000:0000 0A 0:0 0:0 0 65532 0 99\n');
  file('net/tcp', 'header\n0: 0100007F:C352 0100007F:18EB 06 0:0 0:0 0 0 0 0\n');
  const result = collectPortSnapshot(root);
  assert.equal(result.sockets.length, 2);
  assert.equal(result.sockets[1].family, 'tcp6');
  assert.equal(result.sockets[1].state, '0A');
  assert.deepEqual(result.owners, []);
  assert.deepEqual(result.unresolvedInodes, ['99']);
});

test('reports unavailable proc data instead of interpreting it as a free port', t => {
  const {root} = fixture(t);
  rmSync(join(root, 'net'), {recursive: true});
  const result = collectPortSnapshot(root);
  assert.deepEqual(result.sockets, []);
  assert.deepEqual(result.readErrors.map(e => [e.path, e.code]), [['net/tcp', 'ENOENT'], ['net/tcp6', 'ENOENT']]);
});
