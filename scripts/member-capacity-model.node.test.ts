import {describe, expect, it} from 'vitest';
import {gateValid, isApiSample, requestMetricName, operationDeck, randomSequence, requestFamily, sloReason, summarize, weights, type Sample} from './member-capacity-model';

describe('member capacity model', () => {
  it('replays a weighted stateful choice deck without sharing flow randomness', () => {
    const deck = operationDeck(randomSequence(0));
    expect(deck).toEqual(operationDeck(randomSequence(0)));
    expect(deck).not.toEqual(operationDeck(randomSequence(1)));
    expect(Object.fromEntries(Object.keys(weights).map(op => [op, deck.filter(value => value === op).length]))).toEqual(weights);
    const hot = Array.from({length: 1000}, (_, flow) => randomSequence(flow)()).filter(value => value < .8).length;
    expect(hot).toBeGreaterThan(750); expect(hot).toBeLessThan(850);
  });
  it('keeps slow failed attempts in percentiles and the error denominator', () => {
    const rows: Sample[] = Array.from({length: 100}, (_, i) => ({kind: 'operation', name: 'reader_open', flow: 0, startMs: i, durationMs: i >= 98 ? 5000 : 100, ok: i < 98}));
    expect(summarize(rows)).toEqual({attempts: 100, errors: 2, p95Ms: 100, p99Ms: 5000});
    expect(summarize([])).toEqual({attempts: 0, errors: 0, p95Ms: null, p99Ms: null});
  });
  it('refuses stale, future, wrong-scope and expired monitoring gates', () => {
    const hash = 'a'.repeat(64), gate = {scopeHash: hash, ready: true, observedAt: 1000, deadline: 50000};
    expect(gateValid(gate, hash, 11000)).toBe(true);
    expect(gateValid(gate, hash, 11001)).toBe(false);
    expect(gateValid(gate, hash, 999)).toBe(false);
    expect(gateValid(gate, 'b'.repeat(64), 1000)).toBe(false);
    expect(gateValid({...gate, deadline: 1000}, hash, 1000)).toBe(false);
    expect(gateValid({...gate, ready: false}, hash, 1000)).toBe(false);
  });
  it('does not stop capacity exploration at a fixed latency and retains the error gate', () => {
    const rows: Sample[] = Array.from({length: 1000}, () => ({kind: 'operation', name: 'reader_open', flow: 0, startMs: 0, durationMs: 1000, ok: true}));
    expect(sloReason(rows)).toBeNull();
    expect(sloReason(rows.slice(0, 999).map(s => ({...s, durationMs: 5000})))).toBeNull();
    expect(sloReason(rows.map(s => ({...s, durationMs: 10000})))).toBeNull();
    expect(sloReason(rows.map((s, i) => ({...s, ok: i >= 6})))).toBe('error_rate');
  });
  it('retains control API latency while excluding only transfer bodies', () => {
    const row: Sample = {kind: 'request', name: 'media.cookie.post', flow: 0, startMs: 0, durationMs: 5000, ok: true};
    for (const name of ['media.cookie.post', 'recording.grant', 'pdf.create', 'pdf.status', 'reader.state']) expect(isApiSample({...row, name})).toBe(true);
    for (const name of ['pdf.file', 'media.segment', 'media.playlist', 'recording.read.cover']) expect(isApiSample({...row, name})).toBe(false);
    expect(isApiSample({...row, kind: 'operation'})).toBe(false);
    expect(requestMetricName(new URL('https://www.alive.org.tw/api/member/recordings/id/watch'), 'GET', 'recording.read')).toBe('recording.read.watch');
    expect(requestMetricName(new URL('https://www.alive.org.tw/api/member/recordings/id/comments'), 'GET', 'recording.read')).toBe('recording.read.comments');
  });
  it('exports fixed route families without IDs, query tokens or provider URLs', () => {
    const origin = 'https://www.alive.org.tw';
    expect(requestFamily(new URL(`${origin}/api/member/recordings/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/watch`), 'GET', origin)).toBe('recording.read');
    expect(requestFamily(new URL(`${origin}/api/member/bulletins/online?issueNumber=1744`), 'GET', origin)).toBe('bulletin.discovery');
    for (const url of [`${origin}/api/admin/summary`, 'https://other.invalid/api/account/v1/session', `${origin}/api/account/v1/session/logout-all`, `${origin}/api/member/recordings`, 'https://media.alive.org.tw/videos/x/packages/' + 'a'.repeat(32) + '/sessions/y/master.m3u8?token=private']) {
      expect(() => requestFamily(new URL(url), 'POST', origin)).toThrow('request_boundary');
    }
  });
});
it('removes only playback from the mixed deck and preserves remaining relative weights', () => {
  const deck = operationDeck(randomSequence(0), true);
  expect(deck).toHaveLength(80); expect(deck).not.toContain('media_play');
  for (const [name, count] of Object.entries(weights)) if (name !== 'media_play') expect(deck.filter(value => value === name)).toHaveLength(count);
});
