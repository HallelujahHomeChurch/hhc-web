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

// Console output is not trusted diagnostic data. Accept only the fixed helper schema.
export function parseConsoleSnapshot(output) {
  const keys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).every(key => allowed.includes(key));
  const digits = value => typeof value === 'string' && /^\d+$/.test(value);
  const natural = value => Number.isSafeInteger(value) && value >= 0;
  const name = value => value == null || (typeof value === 'string'
    && /^[A-Za-z0-9_() -]{1,128}$/.test(value));
  const optional = (value, pattern) => value === undefined || (typeof value === 'string' && pattern.test(value));
  for (const line of output.replaceAll('\r', '').split('\n')) {
    let data;
    try { data = JSON.parse(line); } catch { continue; }
    if (!keys(data, ['capturedAt', 'port', 'sockets', 'owners', 'unresolvedInodes', 'ephemeralRange',
      'reservedPorts', 'networkNamespace', 'pidNamespace', 'readErrors']) || data.port !== 50002
      || typeof data.capturedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(data.capturedAt)
      || !Array.isArray(data.sockets) || !data.sockets.every(socket => keys(socket, ['family', 'localPort', 'remotePort', 'state', 'uid', 'inode'])
        && ['tcp', 'tcp6'].includes(socket.family) && socket.localPort === 50002
        && natural(socket.remotePort) && socket.remotePort <= 65535 && natural(socket.uid)
        && typeof socket.state === 'string' && /^[0-9A-F]{2}$/.test(socket.state) && digits(socket.inode))
      || !Array.isArray(data.owners) || !data.owners.every(owner => keys(owner, ['pid', 'command', 'executable', 'inodes'])
        && natural(owner.pid) && name(owner.command) && name(owner.executable)
        && Array.isArray(owner.inodes) && owner.inodes.every(digits))
      || !Array.isArray(data.unresolvedInodes) || !data.unresolvedInodes.every(digits)
      || !Array.isArray(data.readErrors) || !data.readErrors.every(error => keys(error, ['path', 'code'])
        && typeof error.path === 'string' && /^[A-Za-z0-9_/]*$/.test(error.path)
        && typeof error.code === 'string' && /^[A-Z_]+$/.test(error.code))
      || !optional(data.ephemeralRange, /^[0-9\s]*$/) || !optional(data.reservedPorts, /^[0-9,\s-]*$/)
      || !optional(data.networkNamespace, /^net:\[\d+\]$/) || !optional(data.pidNamespace, /^pid:\[\d+\]$/)) continue;
    return data;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--sanitize-console') {
    const snapshot = parseConsoleSnapshot(readFileSync(0, 'utf8'));
    if (snapshot) console.log(JSON.stringify(snapshot));
    else process.exitCode = 1;
  } else console.log(JSON.stringify(collectPortSnapshot()));
}
