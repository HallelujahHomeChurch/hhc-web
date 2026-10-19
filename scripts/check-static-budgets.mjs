import {readdir, readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';

const root = path.resolve(process.env.HHC_STATIC_BUDGET_ROOT ?? '.');
const fontConfigPath = path.join(root, 'src/app/fonts.ts');
const heroPath = path.join(root, 'public/assets/banners/hero.jpg');
const maxDisplayFontBytes = 250 * 1024;
const maxHeroBytes = 200 * 1024;
const maxGeneratedCssBytes = 400 * 1024;
const fullDisplayFontName = 'ChenYuluoyan-2.0-Thin.woff2';

const fontConfig = await readFile(fontConfigPath, 'utf8');
const localFontSources = [...fontConfig.matchAll(/src\s*:\s*['"]([^'"]+\.woff2)['"]/g)]
  .map((match) => match[1]);

if (localFontSources.length === 0) {
  throw new Error('No imported local display font found in src/app/fonts.ts');
}

const failures = [];
const eagerBodyFonts = [...fontConfig.matchAll(/(?:Inter|Noto_Sans_(?:SC|TC))\(\{([\s\S]*?)\}\)/g)]
  .filter((match) => /preload\s*:\s*true/.test(match[1]));
const eagerDisplayFonts = [...fontConfig.matchAll(/localFont\(\{([\s\S]*?)\}\)/g)]
  .filter((match) => /preload\s*:\s*true/.test(match[1]));

if (eagerBodyFonts.length > 0) {
  failures.push('Body font preload is forbidden; let each locale load only the font it uses');
}
if (eagerDisplayFonts.length > 0) {
  failures.push('Display font preload is forbidden; let each locale load only the font it uses');
}

for (const source of localFontSources) {
  const filename = path.basename(source);
  if (filename === fullDisplayFontName) {
    failures.push(`Full display font import is forbidden: ${source}`);
  }

  const sourcePath = path.resolve(path.dirname(fontConfigPath), source);
  const {size} = await stat(sourcePath);
  if (size > maxDisplayFontBytes) {
    failures.push(`Display font exceeds 250 KiB: ${source} (${size} bytes)`);
  }
}

const heroSize = (await stat(heroPath)).size;
if (heroSize > maxHeroBytes) {
  failures.push(`Hero source exceeds 200 KiB: ${heroSize} bytes`);
}

const chunksPath = path.join(root, '.next/static/chunks');
const scripts = await readdir(chunksPath).then(names => names.filter(name => name.endsWith('.js'))).catch(() => []);
const exportChunks = [];
for (const name of scripts) {
  const bytes = await readFile(path.join(chunksPath, name));
  if (bytes.includes(Buffer.from('docProps/core.xml'))) exportChunks.push(bytes);
}
if (scripts.length && !exportChunks.length) failures.push('DOCX export chunk missing from production build');
const exportBytes = exportChunks.reduce((total, bytes) => total + bytes.length, 0);
const exportGzipBytes = exportChunks.reduce((total, bytes) => total + gzipSync(bytes).length, 0);
if (exportBytes > 512 * 1024 || exportGzipBytes > 160 * 1024) {
  failures.push(`DOCX export exceeds 512 KiB raw / 160 KiB gzip: ${exportBytes} / ${exportGzipBytes} bytes`);
}
const generatedCssBytes = await readdir(chunksPath, {withFileTypes: true})
  .then(async (entries) => {
    const sizes = await Promise.all(entries.filter((entry) => entry.isFile() && entry.name.endsWith('.css')).map((entry) => stat(path.join(chunksPath, entry.name)).then(({size}) => size)));
    return sizes.reduce((total, size) => total + size, 0);
  })
  .catch(() => 0);
if (generatedCssBytes > maxGeneratedCssBytes) {
  failures.push(`Generated CSS exceeds 400 KiB: ${generatedCssBytes} bytes`);
}

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Static budgets passed: ${localFontSources.length} local font(s), hero ${heroSize} bytes, CSS ${generatedCssBytes} bytes; DOCX ${exportBytes} raw / ${exportGzipBytes} gzip bytes`);
}
