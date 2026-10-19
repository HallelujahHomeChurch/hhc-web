import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

// Behavioral contract: preserve product inputs while staging only verified immutable packages.
test('candidate staging preserves registry dependencies/scripts and injects archives before Docker install', async () => {
  const {prepareCandidate, verifyInstalled} = await import('./prepare-shared-candidate.mjs');
  const root = mkdtempSync(join(tmpdir(), 'shared-candidate-test-'));
  try {
    const consumer = join(root, 'consumer'), shared = join(root, 'shared'), output = join(root, 'candidate');
    for (const dir of [consumer, shared, join(shared, 'artifacts')]) mkdirSync(dir, {recursive: true});
    const git = (cwd, ...args) => execFileSync('git', args, {cwd, stdio: 'pipe'}).toString().trim();
    for (const dir of [consumer, shared]) {git(dir, 'init'); git(dir, 'config', 'user.email', 'fixture@example.invalid'); git(dir, 'config', 'user.name', 'Synthetic fixture');}
    const manifest = {name: 'consumer', scripts: {'test:run': 'unchanged'}, dependencies: {'@hallelujahhomechurch/ui': '0.1.0'}, pnpm: {overrides: {'original': '1.0.0'}}};
    writeFileSync(join(consumer, 'package.json'), JSON.stringify(manifest));
    writeFileSync(join(consumer, 'pnpm-lock.yaml'), 'original registry lock\n');
    writeFileSync(join(consumer, 'Dockerfile'), 'COPY package.json pnpm-lock.yaml ./\nRUN pnpm install --frozen-lockfile\n');
    writeFileSync(join(consumer, '.env'), 'must stay outside context');
    git(consumer, 'add', 'package.json', 'pnpm-lock.yaml', 'Dockerfile'); git(consumer, 'commit', '-m', 'fixture');
    writeFileSync(join(shared, 'package.json'), '{"version":"1.1.1"}'); git(shared, 'add', 'package.json'); git(shared, 'commit', '-m', 'fixture');
    const expected = {commit: git(shared, 'rev-parse', 'HEAD'), version: '1.1.1', archives: {}};
    for (const name of ['preferences','account-client','hhc-web-client','operations-client','ui','donation-client','donation-ui']) {
      const pkg = join(root, name, 'package'); mkdirSync(join(pkg, 'dist'), {recursive: true});
      writeFileSync(join(pkg, 'package.json'), JSON.stringify({name: `@hallelujahhomechurch/${name}`, version: expected.version}));
      writeFileSync(join(pkg, 'dist/index.js'), `export const name = '${name}';`);
      const archive = `hallelujahhomechurch-${name}-1.1.1.tgz`;
      execFileSync('tar', ['-czf', join(shared, 'artifacts', archive), '-C', join(root, name), 'package']);
      expected.archives[archive] = createHash('sha256').update(readFileSync(join(shared, 'artifacts', archive))).digest('hex');
    }
    const original = readFileSync(join(consumer, 'package.json'));
    const firstArchive = Object.keys(expected.archives)[0];
    const originalArchive = readFileSync(join(shared, 'artifacts', firstArchive));
    writeFileSync(join(shared, 'artifacts', firstArchive), 'corrupt');
    assert.throws(() => prepareCandidate({consumer, shared, output, expected}), /checksum/);
    assert.equal(existsSync(output), false, 'invalid inputs must not create context');
    writeFileSync(join(shared, 'artifacts', firstArchive), originalArchive);
    assert.throws(() => prepareCandidate({consumer, shared, output: consumer, expected}), /outside/);
    prepareCandidate({consumer, shared, output, expected});
    assert.deepEqual(readFileSync(join(consumer, 'package.json')), original);
    const staged = JSON.parse(readFileSync(join(output, 'package.json')));
    assert.deepEqual(staged.dependencies, manifest.dependencies); assert.deepEqual(staged.scripts, manifest.scripts);
    assert.equal(staged.pnpm.overrides.original, '1.0.0'); assert.equal(Object.keys(staged.pnpm.overrides).length, 8);
    const dockerfile = readFileSync(join(output, 'Dockerfile'), 'utf8');
    assert.ok(dockerfile.indexOf('COPY candidates ./candidates') < dockerfile.indexOf('RUN pnpm install --frozen-lockfile'));
    assert.equal(existsSync(join(output, '.env')), false); assert.equal(existsSync(join(output, '.git')), false);
    assert.throws(() => prepareCandidate({consumer, shared, output, expected}), /exists/);
    for (const archive of Object.keys(expected.archives)) {
      const name = archive.replace(/^hallelujahhomechurch-/, '').replace(/-1\.1\.1\.tgz$/, '');
      const installed = join(output, 'node_modules/@hallelujahhomechurch', name); mkdirSync(installed, {recursive: true});
      execFileSync('tar', ['-xzf', join(output, 'candidates', archive), '--strip-components=1', '-C', installed]);
    }
    verifyInstalled(output, expected);
    writeFileSync(join(output, 'node_modules/@hallelujahhomechurch/ui/dist/index.js'), 'wrong package');
    assert.throws(() => verifyInstalled(output, expected), /installed bytes/);
  } finally {rmSync(root, {recursive: true, force: true});}
});
