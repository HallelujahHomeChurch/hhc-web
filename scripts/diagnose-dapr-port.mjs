import {readFileSync, readdirSync, readlinkSync} from 'node:fs';
import {basename, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

export function collectPortSnapshot(procRoot = '/proc') {
  const readErrors = [];
  const read = (path, operation) => {
    try {
      return operation(join(procRoot, path));
    } catch (error) {
      readErrors.push({path, code: error.code ?? 'UNKNOWN'});
      return undefined;
    }
  };
  const text = path => read(path, p => readFileSync(p, 'utf8'))?.trim();
  const sockets = [];
  for (const family of ['tcp', 'tcp6']) {
    for (const line of (text(`net/${family}`) ?? '').split('\n').slice(1)) {
      const fields = line.trim().split(/\s+/);
      if (fields.length < 10 || Number.parseInt(fields[1].split(':').at(-1), 16) !== 50002) continue;
      sockets.push({family, localPort: 50002, remotePort: Number.parseInt(fields[2].split(':').at(-1), 16), state: fields[3], uid: Number(fields[7]), inode: fields[9]});
    }
  }
  const inodes = new Set(sockets.map(socket => socket.inode).filter(inode => inode !== '0'));
  const owners = [];
  for (const pid of (read('', readdirSync) ?? []).filter(name => /^\d+$/.test(name))) {
    const owned = new Set();
    for (const fd of read(`${pid}/fd`, readdirSync) ?? []) {
      const inode = read(`${pid}/fd/${fd}`, readlinkSync)?.match(/^socket:\[(\d+)\]$/)?.[1];
      if (inodes.has(inode)) owned.add(inode);
    }
    if (owned.size) {
      const executable = read(`${pid}/exe`, readlinkSync);
      owners.push({pid: Number(pid), command: text(`${pid}/comm`), executable: executable ? basename(executable) : null, inodes: [...owned]});
    }
  }
  return {
    capturedAt: new Date().toISOString(), port: 50002, sockets, owners,
    unresolvedInodes: [...inodes].filter(inode => !owners.some(owner => owner.inodes.includes(inode))),
    ephemeralRange: text('sys/net/ipv4/ip_local_port_range'),
    reservedPorts: text('sys/net/ipv4/ip_local_reserved_ports'),
    networkNamespace: read('self/ns/net', readlinkSync),
    pidNamespace: read('self/ns/pid', readlinkSync),
    readErrors
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(collectPortSnapshot()));
}
