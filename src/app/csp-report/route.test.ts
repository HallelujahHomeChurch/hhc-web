import {afterEach, describe, expect, it, vi} from 'vitest';
import {POST} from './route';

describe('POST /csp-report', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs only bounded CSP fields without query strings or source samples', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const response = await POST(new Request('https://www.alive.org.tw/csp-report', {
      method: 'POST',
      headers: {'Content-Type': 'application/csp-report'},
      body: JSON.stringify({'csp-report': {
        'document-uri': 'https://www.alive.org.tw/zh-Hant/news/item?token=secret',
        'effective-directive': 'script-src-elem',
        'blocked-uri': 'https://attacker.example/script.js?secret=1',
        'source-file': 'https://www.alive.org.tw/private.js?token=secret',
        'script-sample': 'secret payload'
      }})
    }));

    expect(response.status).toBe(204);
    expect(warn).toHaveBeenCalledWith('csp-violation', {
      blocked: 'https://attacker.example',
      directive: 'script-src-elem',
      documentPath: '/zh-Hant/news/item',
      disposition: 'report'
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('secret');
  });

  it('rejects unsupported bodies and oversized reports', async () => {
    expect((await POST(new Request('https://www.alive.org.tw/csp-report', {
      method: 'POST',
      headers: {'Content-Type': 'text/plain'},
      body: '{}'
    }))).status).toBe(415);

    expect((await POST(new Request('https://www.alive.org.tw/csp-report', {
      method: 'POST',
      headers: {'Content-Type': 'application/csp-report', 'Content-Length': '16385'},
      body: '{}'
    }))).status).toBe(413);
  });
});
