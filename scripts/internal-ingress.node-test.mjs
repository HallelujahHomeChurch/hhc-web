import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:http';
import {createConnection} from 'node:net';
import {startInternalIngress} from './internal-ingress.mjs';
import {test} from 'node:test';
import {setTimeout as delay} from 'node:timers/promises';

const current = 'a'.repeat(64);
const next = 'b'.repeat(64);
const modulePath = new URL('./internal-ingress.mjs', import.meta.url).pathname;

test('known slow and failed handlers retain unsampled bounded evidence once without changing streaming', {timeout: 10000}, async t => {
  const upstream = createServer((req, res) => {
    const kind = new URL(req.url, 'http://fixture').searchParams.get('kind');
    if (kind === 'slow') return setTimeout(() => res.end('unchanged'), 1050);
    if (kind === 'error') { res.writeHead(409); res.end('unchanged'); return; }
    res.writeHead(200); res.write('first');
    if (kind === 'broken') return setTimeout(() => res.destroy(), 20);
    if (kind === 'cancel') return;
    res.end('last');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const reserve = createServer();
  await new Promise(resolve => reserve.listen(0, '127.0.0.1', resolve));
  const port = reserve.address().port;
  await new Promise(resolve => reserve.close(resolve));
  const child = spawn(process.execPath, ['--input-type=module', '-e', `import {startInternalIngress} from ${JSON.stringify(modulePath)}; await startInternalIngress();`], {
    env: {...process.env, HHC_WEB_INGRESS_AUTH: 'true', HHC_WEB_GATEWAY_TOKEN: current,
      HHC_WEB_INGRESS_PORT: String(port), PORT: String(upstream.address().port)}, stdio: ['ignore', 'ignore', 'pipe'],
  });
  t.after(() => child.kill('SIGTERM'));
  let output = '';
  child.stderr.on('data', chunk => { output += chunk; });
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 50; i++) {
    try { await (await fetch(origin + '/health')).arrayBuffer(); break; } catch { await delay(20); }
  }
  const headers = id => ({'x-hhc-web-gateway-token': current, 'x-hhc-request-id': id.repeat(32), traceparent: `00-${id.repeat(32)}-1234567890123456-00`, cookie: 'private-cookie'});
  const slow = await fetch(origin + '/_next/image?kind=slow&url=private-image&token=private-query', {headers: headers('1')});
  assert.equal(await slow.text(), 'unchanged');
  const error = await fetch(origin + '/en/maintenance?kind=error', {headers: headers('2')});
  assert.equal(error.status, 409); assert.equal(await error.text(), 'unchanged');
  const broken = await fetch(origin + '/_next/image?kind=broken', {headers: headers('3')});
  await assert.rejects(broken.arrayBuffer());
  const controller = new AbortController();
  const canceled = await fetch(origin + '/en/maintenance?kind=cancel', {headers: headers('4'), signal: controller.signal});
  assert.equal(new TextDecoder().decode((await canceled.body.getReader().read()).value), 'first');
  controller.abort();
  await (await fetch(origin + '/en/maintenance', {headers: headers('5')})).arrayBuffer();
  for (let i = 0; i < 50 && output.trim().split('\n').length < 4; i++) await delay(20);
  const events = output.trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
  assert.equal(events.length, 4, 'one summary per slow/failing request; short success stays quiet');
  for (const [index, id] of ['1', '2', '3', '4'].entries()) {
    const rows = events.filter(e => e.request_id === id.repeat(32));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].trace_id, id.repeat(32)); assert.equal(rows[0].sampled, false);
    assert.equal(rows[0].route_id, index % 2 === 0 ? 'website.image' : 'website.maintenance');
    assert.equal(rows[0].phase_totals.next_headers.count, 1);
    assert.equal(rows[0].phase_totals.next_headers.total_ms, rows[0].header_ms);
    assert.equal(rows[0].phase_totals.response_body.total_ms, rows[0].body_ms);
  }
  assert.ok(events.some(e => e.elapsed_ms >= 1000 && e.status === 200 && e.failure_reason === 'none'));
  assert.ok(events.some(e => e.failure_reason === 'http_error' && e.status === 409));
  assert.ok(events.some(e => e.failure_reason === 'upstream_error'));
  assert.ok(events.some(e => e.failure_reason === 'downstream_closed'));
  assert.ok(events.some(e => e.loopback_connection_reused === true));
  for (const marker of ['private-cookie', 'private-image', 'private-query', current, '/_next/image', '/en/maintenance']) assert.ok(!output.includes(marker));
});

test('internal ingress preserves wire contracts and rejects untrusted credentials', {timeout: 15000}, async t => {
  let received;
  let cancelled;
  const cancellation = new Promise(resolve => { cancelled = resolve; });
  const upstream = createServer((req, res) => {
    received = req.headers;
    if (req.url === '/stream') {
      res.writeHead(200);
      res.write('started');
      res.on('close', cancelled);
      return;
    }
    if (req.url.startsWith('/upstream-timeout')) {
      res.writeHead(504);
      res.end();
      return;
    }
    if (req.url === '/redirect') {
      res.writeHead(307, {Location: 'https://destination.invalid/'});
      res.end();
      return;
    }
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      res.writeHead(req.headers.range ? 206 : 200, {'Content-Type': 'application/json'});
      res.end(JSON.stringify({method: req.method, url: req.url, body: Buffer.concat(chunks).toString()}));
    });
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const diagnostics = [];
  const child = spawn(process.execPath, ['--input-type=module', '-e', `import {startInternalIngress} from ${JSON.stringify(modulePath)}; await startInternalIngress();`], {
    env: {...process.env, HHC_WEB_INGRESS_AUTH: 'true', HHC_WEB_GATEWAY_TOKEN: current,
      HHC_WEB_GATEWAY_TOKEN_NEXT: next, HHC_WEB_INGRESS_PORT: String(port), PORT: String(upstream.address().port)},
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', chunk => diagnostics.push(chunk));
  t.after(async () => {
    child.kill('SIGTERM');
    await Promise.race([new Promise(resolve => child.once('exit', resolve)), delay(1000)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  });
  const origin = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let i = 0; i < 50; i++) {
    try {
      const response = await fetch(origin + '/health', {signal: AbortSignal.timeout(300)});
      await response.arrayBuffer();
      if (response.ok) { ready = true; break; }
    } catch {}
    await delay(20);
  }
  assert.ok(ready);
  for (const headers of [
    {}, {'dapr-caller-app-id': 'api-gateway'}, {'x-hhc-web-gateway-token': 'bad'},
    {'x-hhc-web-gateway-token': `${current},${current}`},
    {'x-hhc-web-gateway-token': current, 'dapr-api-token': 'anything'},
  ]) {
    const response = await fetch(origin + '/private', {headers});
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    await response.arrayBuffer();
  }
  for (const token of [current, next]) {
    const response = await fetch(origin + '/wire%2Fpath?a=%2B&b=two', {
      method: 'POST', body: 'body-bytes',
      headers: {'x-hhc-web-gateway-token': token, 'dapr-caller-app-id': 'forged', 'x-fixture': 'kept'},
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {method: 'POST', url: '/wire%2Fpath?a=%2B&b=two', body: 'body-bytes'});
    assert.equal(received['x-hhc-web-gateway-token'], undefined);
    assert.equal(received['dapr-caller-app-id'], undefined);
    assert.equal(received['x-fixture'], 'kept');
  }
  const range = await fetch(origin + '/range', {headers: {'x-hhc-web-gateway-token': current, Range: 'bytes=0-1'}});
  assert.equal(range.status, 206);
  assert.equal(received.range, 'bytes=0-1');
  await range.arrayBuffer();
  const redirect = await fetch(origin + '/redirect', {redirect: 'manual', headers: {'x-hhc-web-gateway-token': current}});
  assert.equal(redirect.status, 307);
  assert.equal(redirect.headers.get('location'), 'https://destination.invalid/');
  await redirect.arrayBuffer();
  const traceId = '2'.repeat(32);
  const headers = {
    'x-hhc-web-gateway-token': current,
    'x-hhc-request-id': '1'.repeat(32),
    traceparent: `00-${traceId}-${'3'.repeat(16)}-01`,
    cookie: 'fixture=private-cookie',
  };
  const timeout = await fetch(origin + '/upstream-timeout?credential=private-query', {headers});
  assert.equal(timeout.status, 504);
  await timeout.arrayBuffer();
  const controller = new AbortController();
  const stream = await fetch(origin + '/stream', {signal: controller.signal, headers});
  await stream.body.getReader().read();
  controller.abort();
  await Promise.race([cancellation, delay(1000).then(() => { throw new Error('upstream cancellation was not propagated'); })]);
  await new Promise(resolve => upstream.close(resolve));
  const failed = await fetch(origin + '/failure', {headers});
  assert.equal(failed.status, 502);
  await failed.arrayBuffer();
  const invalidId = await fetch(origin + '/failure', {headers: {...headers, 'x-hhc-request-id': current}});
  assert.equal(invalidId.status, 502);
  await invalidId.arrayBuffer();
  for (let i = 0; i < 20 && diagnostics.join('').trim().split('\n').length < 3; i++) await delay(20);
  const output = diagnostics.join('').trim();
  assert.ok(output, 'expected private ingress failure diagnostics');
  assert.ok(!output.includes(current) && !output.includes('private-cookie') && !output.includes('private-query'));
  const events = output.split('\n').map(line => JSON.parse(line));
  assert.equal(events.length, 3);
  for (const event of events) {
    assert.equal(event.event, 'hhc_web_internal_ingress_failure');
    assert.equal(event.request_id, headers['x-hhc-request-id']);
    assert.equal(event.trace_id, traceId);
    assert.ok(event.elapsed_ms >= 0);
  }
  assert.ok(events.some(event => event.outcome === 'upstream_response' && event.upstream_status === 504 && event.header_ms >= 0));
  assert.ok(events.some(event => event.outcome === 'downstream_closed' && event.upstream_status === 200));
  assert.ok(events.some(event => event.outcome === 'upstream_error' && event.status === 502 && event.header_ms === null));
});


test('invalid enabled configuration stops startup and disabled mode opens no listener', () => {
  for (const changes of [
    {HHC_WEB_INGRESS_AUTH: 'invalid'},
    {HHC_WEB_GATEWAY_TOKEN: ''},
    {HHC_WEB_GATEWAY_TOKEN_NEXT: 'wrong'},
    {HHC_WEB_INGRESS_PORT: '10000'},
    {HHC_WEB_INGRESS_PORT: 'NaN'},
  ]) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import {startInternalIngress} from ${JSON.stringify(modulePath)}; await startInternalIngress();`], {
      env: {...process.env, HHC_WEB_INGRESS_AUTH: 'true', HHC_WEB_GATEWAY_TOKEN: current,
        HHC_WEB_GATEWAY_TOKEN_NEXT: next, PORT: '10000', HHC_WEB_INGRESS_PORT: '10001', ...changes},
      encoding: 'utf8', timeout: 1000,
    });
    assert.notEqual(result.status, 0);
    assert.ok(!result.stderr.includes(current));
  }
  const disabled = spawnSync(process.execPath, ['--input-type=module', '-e', `import {startInternalIngress} from ${JSON.stringify(modulePath)}; await startInternalIngress();`], {
    env: {...process.env, HHC_WEB_INGRESS_AUTH: 'false'},
    timeout: 1000,
  });
  assert.equal(disabled.status, 0);
});


test('draining completes the active response and refuses pipelined requests', {timeout: 5000}, async t => {
  const forwarded = [];
  let activeResponse;
  const upstream = createServer((req, res) => {
    forwarded.push(req.url);
    if (req.url !== '/stream') {
      res.end('unexpected');
      return;
    }
    activeResponse = res;
    res.writeHead(200, {'Content-Length': 11});
    res.write('before');
  });
  await new Promise(resolve => upstream.listen(0, '127.0.0.1', resolve));
  t.after(() => { upstream.closeAllConnections(); upstream.close(); });
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));

  const env = process.env;
  process.env = {...env, HHC_WEB_INGRESS_AUTH: 'true', HHC_WEB_GATEWAY_TOKEN: current,
    HHC_WEB_GATEWAY_TOKEN_NEXT: next, HHC_WEB_INGRESS_PORT: String(port), PORT: String(upstream.address().port)};
  t.after(() => { process.env = env; });
  const ingress = await startInternalIngress();
  t.after(() => { ingress.closeAllConnections(); ingress.close(); });

  const socket = createConnection(port, '127.0.0.1');
  t.after(() => socket.destroy());
  socket.setEncoding('utf8');
  await once(socket, 'connect');
  let wire = '';
  let receivedBefore, receivedBoth;
  const before = new Promise(resolve => { receivedBefore = resolve; });
  const both = new Promise(resolve => { receivedBoth = resolve; });
  socket.on('data', chunk => {
    wire += chunk;
    if (wire.includes('\r\n\r\nbefore')) receivedBefore();
    if (/beforeafterHTTP\/1\.1 [\s\S]*?\r\n\r\n/.test(wire)) receivedBoth();
  });
  const request = path => `GET ${path} HTTP/1.1\r\nHost: localhost\r\nX-HHC-Web-Gateway-Token: ${current}\r\n\r\n`;
  socket.write(request('/stream'));
  await before;
  const drained = once(ingress, 'close');
  ingress.close();
  const second = once(ingress, 'request');
  const closed = once(socket, 'close');
  socket.write(request('/late'));
  await second;
  activeResponse.end('after');
  await both;
  socket.end();
  await closed;
  await drained;

  assert.match(wire, /^HTTP\/1\.1 200 [\s\S]*?\r\n\r\nbeforeafterHTTP\/1\.1 503 /);
  assert.match(wire, /cache-control: no-store/i);
  assert.match(wire, /connection: close/i);
  assert.deepEqual(forwarded, ['/stream']);
});
