import {createRequire} from 'node:module';
import path from 'node:path';
const outDir = process.argv[2];
if (!outDir || !path.isAbsolute(outDir) || outDir === process.cwd() || outDir.startsWith(process.cwd() + path.sep)) throw new Error('Pass an absolute output directory outside the application source.');
const require = createRequire(import.meta.url), deps = createRequire(require.resolve('vitest'));
const {build} = await import(deps.resolve('vite'));
await build({configFile: false, define: {'process.env.NODE_ENV': JSON.stringify('production')}, resolve: {alias: {'@': path.resolve('src')}}, build: {
  lib: {entry: path.resolve('scripts/member-capacity.ts'), name: 'HhcMemberCapacity', formats: ['iife'], fileName: () => 'member-capacity.js'},
  outDir, emptyOutDir: false, minify: false,
}});
