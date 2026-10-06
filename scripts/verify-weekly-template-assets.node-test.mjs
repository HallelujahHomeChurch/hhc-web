import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {verifyBundle} from './verify-weekly-template-assets.mjs';

test('verifies actual bytes, filename, license and append-only history', async () => {
  const root = await mkdtemp(join(tmpdir(), 'hhc-weekly-assets-'));
  try {
    await mkdir(join(root, 'public/assets/weekly/v1'), {recursive: true});
    const bytes = Buffer.from('wOF2synthetic-font');
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const license = Buffer.from('Copyright Test Authors\nSIL OPEN FONT LICENSE Version 1.1\n');
    const licenseHash = createHash('sha256').update(license).digest('hex');
    const fontURL = `/assets/weekly/v1/test-${sha256}.woff2`;
    const licenseURL = `/assets/weekly/v1/license-${licenseHash}.txt`;
    const manifest = {version: 'v1', assets: [
      {url: fontURL, sha256, mime: 'font/woff2', sizeBytes: bytes.length, kind: 'font', family: 'Test', weight: 400, roles: ['body', 'scripture', 'emphasis', 'reference', 'foreignText', 'symbol'], licenseUrl: licenseURL, sourceUrl: 'https://github.com/google/fonts', sourceSha256: sha256},
      {url: licenseURL, sha256: licenseHash, mime: 'text/plain', sizeBytes: license.length, kind: 'license'}
    ]};
    const save = () => writeFile(join(root, 'public/assets/weekly/v1/manifest.json'), JSON.stringify(manifest));
    await writeFile(join(root, `public${fontURL}`), bytes);
    await writeFile(join(root, `public${licenseURL}`), license);
    await save();
    await verifyBundle(root, manifest);
    await writeFile(join(root, `public${fontURL}`), Buffer.from('wOF2tampered'));
    await assert.rejects(verifyBundle(root), /checksum|size/);
    await writeFile(join(root, `public${fontURL}`), bytes);
    await assert.rejects(verifyBundle(root, {...manifest, assets: [{...manifest.assets[0], sha256: '0'.repeat(64)}, manifest.assets[1]]}), /immutable/i);
    await verifyBundle(root, {...manifest, assets: manifest.assets.map(asset => Object.fromEntries(Object.entries(asset).reverse()))});
    manifest.assets[0].licenseUrl = '/assets/weekly/v1/missing.txt';
    await save();
    await assert.rejects(verifyBundle(root), /license/);
    manifest.assets[0].licenseUrl = licenseURL;
    manifest.assets[0].url = '/../outside.woff2';
    await save();
    await assert.rejects(verifyBundle(root), /path/);
    manifest.assets[0].url = fontURL;
    await save();
    const svgAsset = async text => {
      const svg = Buffer.from(text);
      const sha256 = createHash('sha256').update(svg).digest('hex');
      const url = `/assets/weekly/v1/qr-test-${sha256}.svg`;
      await writeFile(join(root, `public${url}`), svg);
      return {url, sha256, mime: 'image/svg+xml', sizeBytes: svg.length, kind: 'decoration', sourceUrl: 'https://www.alive.org.tw/'};
    };
    manifest.assets.push(await svgAsset('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 29 29"><rect width="100%" height="100%" fill="#fff"/><path fill="#000" d="M4,4h1v1h-1z"/></svg>\n'));
    await save();
    await verifyBundle(root);
    manifest.assets.push(await svgAsset('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
    await save();
    await assert.rejects(verifyBundle(root), /decoration|SVG/i);
    manifest.assets.pop();
    // This rejected SVG remains an unlisted file, proving the bundle scanner fails closed.
    await save();
    await writeFile(join(root, 'public/assets/weekly/v1/untracked.pdf'), 'private');
    await assert.rejects(verifyBundle(root), /unlisted/i);
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});
