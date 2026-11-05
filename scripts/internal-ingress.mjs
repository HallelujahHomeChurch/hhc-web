import {timingSafeEqual} from 'node:crypto';
import {createServer, request, Agent} from 'node:http';

export async function startInternalIngress() {
  // ACA ingress targets this listener. Dapr retains Next's original app port.
  const enabled = process.env.HHC_WEB_INGRESS_AUTH;
  if (enabled !== undefined && enabled !== 'false' && enabled !== 'true') {
    throw new Error('Invalid HHC_WEB_INGRESS_AUTH');
  }
  if (enabled !== 'true') return;
  const current = process.env.HHC_WEB_GATEWAY_TOKEN;
  const next = process.env.HHC_WEB_GATEWAY_TOKEN_NEXT;
  const format = /^[0-9a-f]{64}$/;
  if (!current || !format.test(current) || (next !== undefined && !format.test(next))) {
    throw new Error('Internal ingress requires valid current/next Gateway credentials');
  }
  const port = Number(process.env.HHC_WEB_INGRESS_PORT ?? 10001);
  const targetPort = Number(process.env.PORT ?? 10000);
  if (![port, targetPort].every(value => Number.isInteger(value) && value > 0 && value <= 65535) || port === targetPort) {
    throw new Error('Internal ingress requires distinct valid ports');
  }
  const agent = new Agent({keepAlive: true});
  const credentialHeader = 'x-hhc-web-gateway-token';
  function authorized(req) {
    const token = req.headers[credentialHeader];
    if (typeof token !== 'string' || !format.test(token) || req.headers['dapr-api-token'] !== undefined) return false;
    return [current, next].some(expected => expected !== undefined && timingSafeEqual(Buffer.from(token), Buffer.from(expected)));
  }
  function forwardingHeaders(headers) {
    const result = {...headers};
    for (const name of (headers.connection ?? '').split(',')) delete result[name.trim().toLowerCase()];
    for (const name of ['connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer', 'upgrade', 'proxy-authorization', 'proxy-authenticate', credentialHeader, 'dapr-api-token', 'dapr-caller-app-id']) delete result[name];
    return result;
  }
  const server = createServer((req, res) => {
    const probe = (req.method === 'GET' || req.method === 'HEAD') && req.url === '/health';
    if (!probe && !authorized(req)) {
      res.writeHead(401, {'Cache-Control': 'no-store'});
      res.end();
      return;
    }
    const upstream = request({
      hostname: '127.0.0.1', port: targetPort, path: req.url, method: req.method,
      headers: forwardingHeaders(req.headers), agent,
    }, response => {
      res.writeHead(response.statusCode, forwardingHeaders(response.headers));
      response.on('error', () => res.destroy());
      response.pipe(res);
    });
    upstream.on('error', () => {
      if (res.destroyed) return;
      if (res.headersSent) {
        res.destroy();
      } else {
        res.writeHead(502, {'Cache-Control': 'no-store'});
        res.end();
      }
    });
    req.on('aborted', () => upstream.destroy());
    req.on('error', () => upstream.destroy());
    res.on('close', () => { if (!res.writableFinished) upstream.destroy(); });
    req.pipe(upstream);
  });
  server.on('error', () => {
    console.error('Internal ingress listener failed');
    process.exit(1);
  });
  await new Promise(resolve => server.listen(port, '0.0.0.0', resolve));
  server.on('close', () => agent.destroy());
  return server;
}
