// Run against two isolated Chromium contexts and a synthetic same-account API.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, rmdir, unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = await readFile(new URL('../src/features/member-videos/playback-progress-session.ts', import.meta.url), 'utf8');
const {outputText} = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}});
const directory = await mkdtemp(join(tmpdir(), 'hhc-progress-media-'));
const path = join(directory, 'sample.webm');
let asset;
try {
  execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=96x64:rate=10', '-t', '75', '-c:v', 'libvpx', '-b:v', '40k', path]);
  asset = await readFile(path);
} finally {
  await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
  await rmdir(directory);
}
const mediaVersion = 'vod:synthetic';
let progress = null;
let rejected = 0;
const server = createServer(async (req, res) => {
  if (req.url === '/sync.js') {
    res.writeHead(200, {'content-type': 'application/javascript'}).end(outputText);
    return;
  }
  if (req.url === '/sample.webm') {
    res.writeHead(200, {'content-type': 'video/webm', 'content-length': asset.length}).end(asset);
    return;
  }
  if (req.url === '/') {
    res.writeHead(200, {'content-type': 'text/html'}).end('<video muted playsinline></video>');
    return;
  }
  let response, status = 200;
  if (req.method === 'GET') response = {mediaVersion, claimToken: 'fixture', progress};
  else {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const input = JSON.parse(Buffer.concat(chunks));
    if (req.method === 'POST') {
      assert.equal(input.expectedGeneration, progress?.generation ?? null);
      progress = {mediaVersion, generation: input.claimId, positionSeconds: input.observedPositionSeconds, sequence: 0};
      response = progress;
    } else if (input.generation === progress?.generation) {
      progress = {...progress, positionSeconds: input.positionSeconds, sequence: input.sequence};
      response = {accepted: true, sequence: input.sequence};
    } else {
      rejected++;
      status = 409;
      response = {code: 'progress_superseded'};
    }
  }
  res.writeHead(status, {'content-type': 'application/json'}).end(JSON.stringify(response));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
  browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH, args: ['--autoplay-policy=no-user-gesture-required']});
  const url = `http://127.0.0.1:${server.address().port}`;
  const start = async (page, name) => {
    await page.goto(url);
    return page.evaluate(async ({mediaVersion, name}) => {
      const {createPlaybackProgress} = await import('/sync.js');
      const request = async (_id, input, method) => {
        const response = await fetch('/progress', {method, body: input && JSON.stringify(input)});
        const result = await response.json();
        if (!response.ok) throw {status: response.status, ...result};
        return result;
      };
      const sync = createPlaybackProgress({
        progress: id => request(id, null, 'GET'),
        claimProgress: (id, input) => request(id, input, 'POST'),
        saveProgress: (id, input) => request(id, input, 'PUT'),
      }, name, mediaVersion, new AbortController().signal);
      const resume = await sync.prepare('resume');
      const video = document.querySelector('video');
      const metadata = new Promise(resolve => video.addEventListener('loadedmetadata', resolve, {once: true}));
      video.src = '/sample.webm';
      await metadata;
      if (resume) {
        const seeked = new Promise(resolve => video.addEventListener('seeked', resolve, {once: true}));
        video.currentTime = resume;
        await seeked;
      }
      const playing = new Promise(resolve => video.addEventListener('playing', resolve, {once: true}));
      await video.play();
      await playing;
      const observed = video.currentTime;
      await sync.playing(observed);
      window.saveProgress = position => sync.save(position, 'playing');
      return {resume, observed};
    }, {mediaVersion, name});
  };
  const a = await (await browser.newContext()).newPage();
  const b = await (await browser.newContext()).newPage();
  await start(a, 'A');
  const saved = await a.locator('video').evaluate(async video => {
    video.currentTime = 65;
    await new Promise(resolve => video.addEventListener('seeked', resolve, {once: true}));
    await window.saveProgress(video.currentTime);
    return video.currentTime;
  });
  const resumed = await start(b, 'B');
  assert.ok(Math.abs(resumed.resume - saved) < 0.2);
  assert.ok(Math.abs(resumed.observed - saved) < 0.3);
  await a.evaluate(() => window.saveProgress(99));
  await a.evaluate(() => window.saveProgress(100));
  assert.equal(rejected, 1);
  assert.equal(progress.positionSeconds, resumed.observed);
  const before = await a.locator('video').evaluate(video => video.currentTime);
  await a.waitForFunction(previous => !document.querySelector('video').paused && document.querySelector('video').currentTime > previous + 0.15, before);
  console.log('Chromium: B sought to the saved position and claimed only after real playing; stale A stopped writing and its video clock kept advancing.');
} finally {
  await browser?.close();
  server.close();
}
