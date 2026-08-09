import assert from 'node:assert/strict';
import {mkdtemp, mkdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import test from 'node:test';

const checker = path.resolve('scripts/check-static-budgets.mjs');

async function fixture({bodyFontPreload = false, cssBytes = 0, fontBytes = 200_000, fontName = 'ChenYuluoyan-HHC-Banners.woff2', heroBytes = 140_000} = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'hhc-static-budget-'));
  const fontDir = path.join(root, 'src/assets/fonts/chenyuluoyan');
  const bannerDir = path.join(root, 'public/assets/banners');
  await mkdir(fontDir, {recursive: true});
  await mkdir(bannerDir, {recursive: true});
  await mkdir(path.join(root, 'src/app'), {recursive: true});
  if (cssBytes > 0) {
    await mkdir(path.join(root, '.next/static/chunks'), {recursive: true});
    await writeFile(path.join(root, '.next/static/chunks/app.css'), Buffer.alloc(cssBytes));
  }
  await writeFile(path.join(fontDir, fontName), Buffer.alloc(fontBytes));
  await writeFile(path.join(bannerDir, 'hero.jpg'), Buffer.alloc(heroBytes));
  await writeFile(
    path.join(root, 'src/app/fonts.ts'),
    `Inter({preload: ${bodyFontPreload}})\nlocalFont({src: '../assets/fonts/chenyuluoyan/${fontName}'})\n`
  );
  return root;
}

function run(root) {
  return spawnSync(process.execPath, [checker], {
    cwd: path.resolve('.'),
    encoding: 'utf8',
    env: {...process.env, HHC_STATIC_BUDGET_ROOT: root}
  });
}

test('accepts assets within the static budgets', async (t) => {
  const root = await fixture();
  t.after(() => rm(root, {recursive: true, force: true}));

  const result = run(root);

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('rejects an imported local display font over 250 KiB', async (t) => {
  const root = await fixture({fontBytes: 250 * 1024 + 1});
  t.after(() => rm(root, {recursive: true, force: true}));

  const result = run(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /display font exceeds 250 KiB/i);
});

test('rejects the original full display font import', async (t) => {
  const root = await fixture({fontName: 'ChenYuluoyan-2.0-Thin.woff2'});
  t.after(() => rm(root, {recursive: true, force: true}));

  const result = run(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /full display font import is forbidden/i);
});

test('rejects a hero source over 200 KiB', async (t) => {
  const root = await fixture({heroBytes: 200 * 1024 + 1});
  t.after(() => rm(root, {recursive: true, force: true}));

  const result = run(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /hero source exceeds 200 KiB/i);
});

test('rejects eager body-font preloads that affect every locale', async (t) => {
  const root = await fixture({bodyFontPreload: true});
  t.after(() => rm(root, {recursive: true, force: true}));

  const result = run(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /body font preload is forbidden/i);
});

test('rejects generated CSS over 400 KiB after a production build', async (t) => {
  const root = await fixture({cssBytes: 400 * 1024 + 1});
  t.after(() => rm(root, {recursive: true, force: true}));

  const result = run(root);

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /generated css exceeds 400 KiB/i);
});
