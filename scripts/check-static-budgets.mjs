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
if (process.argv.includes('--require-build') && scripts.length === 0) {
  failures.push('Production JavaScript chunks missing from build');
}
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
// Client chunks must not carry other locales' catalogs; pass the current locale's strings from the server.
const localesPath = path.join(root, 'src/i18n/locales');
const catalogNames = await readdir(localesPath).then(names => names.filter(name => name.endsWith('.json')).sort()).catch(() => []);
const catalogLeaves = value => typeof value === 'string' ? [value] : Object.values(value ?? {}).flatMap(catalogLeaves);
const catalogs = await Promise.all(catalogNames.map(async name => ({
  locale: name.slice(0, -'.json'.length),
  strings: new Set(catalogLeaves(JSON.parse(await readFile(path.join(localesPath, name), 'utf8'))))
})));
const catalogMarkers = catalogs.map(({locale, strings}) => ({
  locale,
  markers: [...strings]
    .filter(text => text.length >= 16 && !/["'\\\n]/.test(text) && catalogs.every(other => other.locale === locale || !other.strings.has(text)))
    .slice(0, 40)
})).filter(({markers}) => markers.length >= 10);
for (const name of scripts) {
  const text = await readFile(path.join(chunksPath, name), 'utf8');
  const bundled = catalogMarkers
    .filter(({markers}) => markers.filter(marker => text.includes(marker)).length * 2 >= markers.length)
    .map(({locale}) => locale);
  if (bundled.length > 1) {
    failures.push(`Client chunk ${name} bundles ${bundled.length} locale catalogs (${bundled.join(', ')}); pass the current locale's strings from the server`);
  }
}
// The build has no content API: prerendered HTML must never carry built-in CMS fallback content.
const prerenderPath = path.join(root, '.next/server/app');
const prerendered = await readdir(prerenderPath, {recursive: true}).then(names => names.filter(name => name.endsWith('.html'))).catch(() => []);
for (const name of prerendered) {
  if ((await readFile(path.join(prerenderPath, name), 'utf8')).includes('data-cms-fallback=')) {
    failures.push(`Prerendered ${name} contains CMS fallback content; render CMS-backed pages on demand`);
  }
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
