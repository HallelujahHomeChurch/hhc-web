// Run against two isolated Chromium contexts and a synthetic same-account API.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const source = await readFile(new URL('../src/features/member-videos/playback-progress-session.ts', import.meta.url), 'utf8');
const {outputText} = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext}});
const mediaVersion = 'vod:synthetic';
let progress = null;
let rejected = 0;
const server = createServer(async (req, res) => {
  if (req.url === '/sync.js') {
    res.writeHead(200, {'content-type': 'application/javascript'}).end(outputText);
    return;
  }
  if (req.url === '/') {
    res.writeHead(200, {'content-type': 'text/html'}).end('<canvas width="64" height="64"></canvas><video muted playsinline></video>');
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
      const canvas = document.querySelector('canvas');
      const context = canvas.getContext('2d');
      let frame = 0;
      setInterval(() => { context.fillStyle = frame++ % 2 ? 'blue' : 'green'; context.fillRect(0, 0, 64, 64); }, 30);
      const video = document.querySelector('video');
      video.srcObject = canvas.captureStream(30);
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
  await a.evaluate(() => window.saveProgress(65));
  const resumed = await start(b, 'B');
  assert.equal(resumed.resume, 65);
  await a.evaluate(() => window.saveProgress(99));
  await a.evaluate(() => window.saveProgress(100));
  assert.equal(rejected, 1);
  assert.equal(progress.positionSeconds, resumed.observed);
  const before = await a.locator('video').evaluate(video => video.currentTime);
  await a.waitForFunction(previous => !document.querySelector('video').paused && document.querySelector('video').currentTime > previous + 0.15, before);
  console.log('Chromium: B read the saved 65 seconds and claimed only after real playing; stale A stopped writing and its video clock kept advancing.');
} finally {
  await browser?.close();
  server.close();
}
