import {describe, expect, it} from 'vitest';
import {gateValid, operationDeck, randomSequence, requestFamily, sloReason, summarize, weights, type Sample} from './member-capacity-model';

describe('member capacity model', () => {
  it('replays a weighted stateful choice deck without sharing flow randomness', () => {
    const deck = operationDeck(randomSequence(0));
    expect(deck).toEqual(operationDeck(randomSequence(0)));
    expect(deck).not.toEqual(operationDeck(randomSequence(1)));
    expect(Object.fromEntries(Object.keys(weights).map(op => [op, deck.filter(value => value === op).length]))).toEqual(weights);
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
  it('does not promote small samples to a capacity pass and detects latency or errors', () => {
    const rows: Sample[] = Array.from({length: 100}, () => ({kind: 'operation', name: 'reader_open', flow: 0, startMs: 0, durationMs: 1000, ok: true}));
    expect(sloReason(rows)).toBeNull();
    expect(sloReason(rows.slice(0, 99).map(s => ({...s, durationMs: 5000})))).toBeNull();
    expect(sloReason(rows.map(s => ({...s, durationMs: 1001})))).toBe('latency_slo');
    expect(sloReason(rows.map((s, i) => ({...s, ok: i !== 0})))).toBe('error_rate');
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
