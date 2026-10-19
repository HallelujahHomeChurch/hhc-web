import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve, relative, isAbsolute} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const packages = ['account-client', 'donation-client', 'donation-ui', 'hhc-web-client', 'operations-client', 'preferences', 'ui'];
const expectedCandidate = JSON.parse(readFileSync(new URL('./shared-candidate.json', import.meta.url)));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const git = (cwd, ...args) => execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']}).trim();
const within = (parent, child) => {const path = relative(parent, child); return path === '' || (!path.startsWith('..') && !isAbsolute(path));};

function archivesAt(directory, expected) {
  assert.match(expected.commit, /^[a-f0-9]{40}$/, 'full immutable Shared commit required');
  assert.match(expected.version, /^\d+\.\d+\.\d+$/, 'exact coordinated version required');
  const names = packages.map(name => `hallelujahhomechurch-${name}-${expected.version}.tgz`);
  assert.deepEqual(Object.keys(expected.archives).sort(), names.sort(), 'all seven archive hashes required');
  return names.map(name => {
    const path = join(directory, name);
    assert.equal(digest(readFileSync(path)), expected.archives[name], `${name}: checksum mismatch`);
    const manifest = JSON.parse(execFileSync('tar', ['-xOzf', path, 'package/package.json'], {encoding: 'utf8'}));
    assert.equal(manifest.version, expected.version, `${name}: archive version mismatch`);
    assert.equal(name, `${manifest.name.replace('@', '').replace('/', '-')}-${manifest.version}.tgz`, 'archive identity mismatch');
    return {name, path, packageName: manifest.name};
  });
}

export function prepareCandidate({consumer, shared, output, expected = expectedCandidate}) {
  consumer = resolve(consumer); shared = resolve(shared); output = resolve(output);
  assert.ok(!within(consumer, output) && !within(shared, output), 'candidate output must be outside both source checkouts');
  assert.ok(!existsSync(output), 'candidate output already exists');
  assert.equal(git(shared, 'rev-parse', 'HEAD'), expected.commit, 'Shared checkout must match immutable candidate commit');
  assert.equal(git(shared, 'status', '--porcelain', '--untracked-files=no'), '', 'Shared tracked source must be clean');
  assert.equal(JSON.parse(readFileSync(join(shared, 'package.json'))).version, expected.version);
  const archives = archivesAt(join(shared, 'artifacts'), expected);
  // Export committed consumer files only: never copy credentials, caches or nested checkouts.
  const paths = git(consumer, 'ls-tree', '-r', '--name-only', 'HEAD').split('\n');
  assert.ok(paths.every(path => !/(^|\/)(\.env(?:\.[^/]*)?|\.npmrc|\.superpowers|node_modules|\.next|\.git)(\/|$)/.test(path) || path === '.npmrc'), 'unsafe tracked candidate input');
  const source = execFileSync('git', ['archive', 'HEAD'], {cwd: consumer, maxBuffer: 64 * 1024 * 1024});
  mkdirSync(output, {recursive: true});
  execFileSync('tar', ['-xf', '-', '-C', output], {input: source});
  rmSync(join(output, '.npmrc'), {force: true});
  mkdirSync(join(output, 'candidates'));
  const manifest = JSON.parse(readFileSync(join(output, 'package.json')));
  manifest.pnpm ??= {}; manifest.pnpm.overrides ??= {};
  for (const archive of archives) {
    cpSync(archive.path, join(output, 'candidates', archive.name));
    manifest.pnpm.overrides[archive.packageName] = `file:candidates/${archive.name}`;
  }
  writeFileSync(join(output, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const dockerfile = readFileSync(join(output, 'Dockerfile'), 'utf8');
  const input = 'COPY package.json pnpm-lock.yaml ./\n';
  assert.equal(dockerfile.split(input).length, 2, 'expected one Docker frozen-install input');
  writeFileSync(join(output, 'Dockerfile'), dockerfile.replace(input, `${input}COPY candidates ./candidates\n`));
  writeFileSync(join(output, 'candidates/provenance.json'), `${JSON.stringify({...expected, consumerCommit: git(consumer, 'rev-parse', 'HEAD')}, null, 2)}\n`);
  console.log(`Staged Shared ${expected.commit} (${expected.version}); ${archives.length} verified archives`);
}

export function verifyInstalled(output, expected = expectedCandidate) {
  output = resolve(output);
  const archives = archivesAt(join(output, 'candidates'), expected);
  const temporary = mkdtempSync(join(tmpdir(), 'shared-candidate-installed-'));
  try {
    for (const archive of archives) {
      const unpacked = join(temporary, archive.name); mkdirSync(unpacked);
      execFileSync('tar', ['-xzf', archive.path, '-C', unpacked]);
      const check = (directory, prefix = '') => {
        for (const entry of readdirSync(directory, {withFileTypes: true})) {
          const path = join(prefix, entry.name);
          if (entry.isDirectory()) check(join(directory, entry.name), path);
          else assert.equal(digest(readFileSync(join(output, 'node_modules', archive.packageName, path))), digest(readFileSync(join(directory, entry.name))), `${archive.packageName}/${path}: installed bytes mismatch`);
        }
      };
      // Donation packages need not be direct dependencies of WWW; verify every consumed package.
      if (existsSync(join(output, 'node_modules', archive.packageName))) check(join(unpacked, 'package'));
      else assert.ok(archive.packageName.includes('/donation-'), `missing installed ${archive.packageName}`);
    }
    console.log('Installed candidate bytes match immutable archives for every consumed package');
  } finally {rmSync(temporary, {recursive: true, force: true});}
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'prepare' && args.length === 2) prepareCandidate({consumer: fileURLToPath(new URL('..', import.meta.url)), shared: args[0], output: args[1]});
  else if (command === 'verify' && args.length === 1) verifyInstalled(args[0]);
  else throw new Error('Usage: prepare-shared-candidate.mjs prepare SHARED_CHECKOUT OUTPUT | verify OUTPUT');
}
