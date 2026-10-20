import {createRequire} from 'node:module';
import path from 'node:path';

const outDir=process.argv[2];
if(!outDir || !path.isAbsolute(outDir) || outDir===process.cwd() || outDir.startsWith(process.cwd()+path.sep))throw new Error('Pass an absolute output directory outside the application source.');
// Reuse the bundler already pinned by Vitest; this tool adds no dependency.
const require=createRequire(import.meta.url),deps=createRequire(require.resolve('vitest'));
const {build}=await import(deps.resolve('vite'));
await build({configFile:false,resolve:{alias:{'@':path.resolve('src')}},build:{
  lib:{entry:path.resolve('scripts/public-live-load.ts'),name:'HhcLiveLoad',formats:['iife'],fileName:()=> 'public-live-load.js'},
  outDir,emptyOutDir:false,minify:false,
}});
