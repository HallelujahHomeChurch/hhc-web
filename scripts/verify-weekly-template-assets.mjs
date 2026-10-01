import {readFile, readdir} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';

const directory = 'public/assets/weekly/v1';
const hash = /^[0-9a-f]{64}$/;
const path = /^\/assets\/weekly\/v1\/[A-Za-z0-9_-]*[0-9a-f]{64}\.(woff2|png|svg|txt)$/;
const roles = ['body', 'scripture', 'emphasis', 'reference', 'foreignText', 'symbol'];

export async function verifyBundle(root, previous) {
  const manifest = JSON.parse(await readFile(join(root, directory, 'manifest.json'), 'utf8'));
  if (manifest.version !== 'v1' || !Array.isArray(manifest.assets) || !manifest.assets.length || manifest.assets.length > 64) throw new Error('Invalid template manifest');
  const entries = new Map();
  const seenRoles = new Set();
  for (const asset of manifest.assets) {
    if (!path.test(asset.url) || !hash.test(asset.sha256) || !asset.url.includes(`${asset.sha256}.`) || entries.has(asset.url)) throw new Error('Invalid or duplicate asset path/hash');
    const bytes = await readFile(join(root, 'public', asset.url));
    if (asset.sizeBytes !== bytes.length || bytes.length > 15 * 1024 * 1024) throw new Error('Asset size mismatch/limit');
    if (createHash('sha256').update(bytes).digest('hex') !== asset.sha256) throw new Error('Asset checksum mismatch');
    switch (asset.kind) {
      case 'font':
        if (asset.mime !== 'font/woff2' || !asset.url.endsWith('.woff2') || bytes.subarray(0, 4).toString() !== 'wOF2' || !asset.family || ![400, 700].includes(asset.weight) || !Array.isArray(asset.roles) || !asset.roles.length || !hash.test(asset.sourceSha256) || !asset.sourceUrl?.startsWith('https://')) throw new Error('Invalid font provenance/format');
        for (const role of asset.roles) {
          if (!roles.includes(role) || seenRoles.has(role)) throw new Error('Invalid or duplicate font role');
          seenRoles.add(role);
        }
        break;
      case 'decoration':
        if (asset.url.endsWith('.svg')) {
          // Only the generator's closed QR grammar: no scripts, links, entities or embedded CSS.
          const match = /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" viewBox="0 0 (\d+) (\d+)"><rect width="100%" height="100%" fill="#fff"\/><path fill="#000" d="[Mhvz0-9, .-]+"\/><\/svg>\n$/.exec(bytes.toString('utf8'));
          if (asset.mime !== 'image/svg+xml' || bytes.length > 128 * 1024 || !match || match[1] !== match[2] || Number(match[1]) < 21 || Number(match[1]) > 256 || !asset.sourceUrl?.startsWith('https://')) throw new Error('Invalid SVG decoration format');
        } else if (asset.mime !== 'image/png' || !asset.url.endsWith('.png') || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error('Invalid decoration format');
        break;
      case 'license':
        if (asset.mime !== 'text/plain' || !asset.url.endsWith('.txt') || !bytes.toString('utf8').includes('SIL OPEN FONT LICENSE Version 1.1') || !bytes.toString('utf8').includes('Copyright')) throw new Error('Invalid font license');
        break;
      default: throw new Error('Unsupported template asset');
    }
    entries.set(asset.url, asset);
  }
  for (const role of roles) if (!seenRoles.has(role)) throw new Error(`Missing font role: ${role}`);
  for (const asset of entries.values()) if (asset.kind === 'font' && entries.get(asset.licenseUrl)?.kind !== 'license') throw new Error('Missing font license');
  for (const file of await readdir(join(root, directory))) {
    if (file !== 'manifest.json' && file !== 'SOURCE.md' && !entries.has(`/assets/weekly/v1/${file}`)) throw new Error('Unlisted template asset');
  }
  if (previous) {
    if (previous.version !== manifest.version) throw new Error('Immutable template version changed');
    for (const asset of previous.assets) {
      if (!isDeepStrictEqual(entries.get(asset.url), asset)) throw new Error('Immutable template asset removed or changed');
    }
  }
  return manifest;
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? '')).href) {
  try {
    const args = process.argv.slice(2);
    let previous;
    if (args.length) {
      if (args.length !== 2 || args[0] !== '--base-ref' || !/^[A-Za-z0-9_/.^-]+$/.test(args[1])) throw new Error('Usage: verify-weekly-template-assets.mjs [--base-ref REF]');
      execFileSync('git', ['cat-file', '-e', `${args[1]}^{commit}`], {stdio: 'pipe'});
      const oldFiles = execFileSync('git', ['ls-tree', '--name-only', args[1], `${directory}/manifest.json`], {encoding: 'utf8'});
      if (oldFiles.trim()) previous = JSON.parse(execFileSync('git', ['show', `${args[1]}:${directory}/manifest.json`], {encoding: 'utf8'}));
    }
    const manifest = await verifyBundle(process.cwd(), previous);
    console.log(`Weekly template ${manifest.version}: ${manifest.assets.length} assets verified`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
