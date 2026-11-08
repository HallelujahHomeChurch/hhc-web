import {afterEach, describe, expect, it, vi} from 'vitest';
import {ContentRequestObservation} from './request-diagnostics';

afterEach(() => vi.restoreAllMocks());

describe('maintenance render diagnostics', () => {
  it('bounds status keys to the numeric HTTP domain and excludes invalid correlation', () => {
    const output = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const observation = new ContentRequestObservation({traceId: 'https://private.example', spanId: 'private-member', traceFlags: 0});
    observation.activate(); observation.fail('downstream_http_error');
    for (const status of [200, 404, 404, 503, 599]) observation.recordStatus(status);
    for (const status of [-1, 600, 1000, 1.5, NaN, Infinity]) observation.recordStatus(status);
    observation.finish();
    const value = JSON.parse(output.mock.calls[0][0]);
    expect(value.http_status_counts).toEqual({'200': 1, '404': 2, '503': 1, '599': 1});
    expect(value.trace_id).toBeUndefined(); expect(value.span_id).toBeUndefined();
    expect(output.mock.calls[0][0]).not.toContain('private');
  });
  it('records cumulative sub250 work once without sampling or sensitive values', () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const output = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const observation = new ContentRequestObservation({traceId: '1'.repeat(32), spanId: '2'.repeat(16), traceFlags: 0});
    observation.activate();
    for (let i = 0; i < 6; i++) {
      const finish = observation.start('fetch_headers');
      now += 210;
      finish(); finish();
    }
    observation.finish(); observation.finish();
    expect(output).toHaveBeenCalledTimes(1);
    const value = JSON.parse(output.mock.calls[0][0]);
    expect(value).toMatchObject({event: 'hhc_web_render_observation', route_id: 'website.maintenance', trace_id: '1'.repeat(32), sampled: false, elapsed_ms: 1260});
    expect(value.phase_totals.fetch_headers).toMatchObject({count: 6, total_ms: 1260, max_ms: 210, in_flight: 0});
    expect(value.timing_semantics).toContain('overlapping');
    expect(Object.keys(value.phase_totals)).toEqual(['fetch_headers', 'fetch_body']);
  });

  it('keeps concurrent request work separate and does not sum parallel phases as elapsed time', async () => {
    let now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    const output = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = new ContentRequestObservation({traceId: '1'.repeat(32), traceFlags: 0});
    const second = new ContentRequestObservation({traceId: '2'.repeat(32), traceFlags: 0});
    first.activate(); second.activate();
    const a = first.start('fetch_headers'), b = first.start('fetch_headers'), c = second.start('fetch_body');
    now = 1200;
    await Promise.all([Promise.resolve().then(() => a()), Promise.resolve().then(() => b()), Promise.resolve().then(() => c())]);
    first.finish(); second.finish();
    const values = output.mock.calls.map(([line]) => JSON.parse(line));
    expect(values).toHaveLength(2);
    expect(values[0].elapsed_ms).toBe(1200);
    expect(values[0].phase_totals.fetch_headers.total_ms).toBe(2400);
    expect(values[1].phase_totals.fetch_body.total_ms).toBe(1200);
    expect(values[1].phase_totals.fetch_headers.count).toBe(0);
  });

  it.each(['caller_canceled', 'local_deadline', 'fetch_body_error'] as const)('retains %s with no trace and ignores late work after once-only completion', reason => {
    const output = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const observation = new ContentRequestObservation();
    observation.activate();
    const finish = observation.start('fetch_body');
    observation.fail(reason);
    observation.finish(); finish(); observation.finish();
    expect(output).toHaveBeenCalledTimes(1);
    const value = JSON.parse(output.mock.calls[0][0]);
    expect(value.failure_reason).toBe(reason);
    expect(value.observation_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(value.phase_totals.fetch_body.in_flight).toBe(1);
    expect(value.trace_id).toBeUndefined();
  });

  it('does not emit short successes or observations outside the selected handler', () => {
    const output = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const short = new ContentRequestObservation(); short.activate(); short.finish();
    const outside = new ContentRequestObservation(); outside.fail('fetch_body_error'); outside.finish();
    expect(output).not.toHaveBeenCalled();
  });
});
