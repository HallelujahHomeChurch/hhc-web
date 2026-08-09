import {readFile, stat} from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.env.HHC_STATIC_BUDGET_ROOT ?? '.');
const fontConfigPath = path.join(root, 'src/app/fonts.ts');
const heroPath = path.join(root, 'public/assets/banners/hero.jpg');
const maxDisplayFontBytes = 250 * 1024;
const maxHeroBytes = 200 * 1024;
const fullDisplayFontName = 'ChenYuluoyan-2.0-Thin.woff2';

const fontConfig = await readFile(fontConfigPath, 'utf8');
const localFontSources = [...fontConfig.matchAll(/src\s*:\s*['"]([^'"]+\.woff2)['"]/g)]
  .map((match) => match[1]);

if (localFontSources.length === 0) {
  throw new Error('No imported local display font found in src/app/fonts.ts');
}

const failures = [];
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

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Static budgets passed: ${localFontSources.length} local font(s), hero ${heroSize} bytes`);
}
