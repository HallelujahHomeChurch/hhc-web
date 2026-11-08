import {cache} from 'react';
import {after} from 'next/server';
import {getActiveSpan} from '@sentry/nextjs';

type Correlation = {traceId: string; spanId?: string; traceFlags: number};
type Failure = 'caller_canceled' | 'local_deadline' | 'fetch_body_error' | 'fetch_headers_error' | 'downstream_http_error';

export class ContentRequestObservation {
  private readonly started = performance.now();
  private readonly id = crypto.randomUUID();
  private readonly phases = {
    fetch_headers: {count: 0, total_ms: 0, max_ms: 0, in_flight: 0, failures: 0},
    fetch_body: {count: 0, total_ms: 0, max_ms: 0, in_flight: 0, failures: 0},
  };
  private active = false;
  private closed = false;
  private failure?: Failure;
  constructor(private readonly correlation?: Correlation) {}

  activate() {
    if (this.active || this.closed) return false;
    this.active = true;
    return true;
  }

  start(name: 'fetch_headers' | 'fetch_body') {
    if (this.closed) return () => {};
    const phase = this.phases[name];
    phase.count++; phase.in_flight++;
    const started = performance.now();
    let done = false;
    return (failed = false) => {
      if (done || this.closed) return;
      done = true;
      const elapsed = Math.max(0, performance.now() - started);
      phase.in_flight--; phase.total_ms += elapsed;
      phase.max_ms = Math.max(phase.max_ms, elapsed);
      if (failed) phase.failures++;
    };
  }

  fail(reason: Failure) {
    if (this.closed) return;
    if (!this.failure || reason === 'local_deadline' || reason === 'caller_canceled') this.failure = reason;
  }

  finish() {
    if (this.closed) return;
    this.closed = true;
    const elapsed = performance.now() - this.started;
    if (!this.active || (!this.failure && elapsed < 1000)) return;
    const context = this.correlation;
    const traceId = context && /^[0-9a-f]{32}$/.test(context.traceId) && context.traceId !== '0'.repeat(32) ? context.traceId : undefined;
    console.warn(JSON.stringify({
      event: 'hhc_web_render_observation', route_id: 'website.maintenance',
      observation_id: this.id, trace_id: traceId,
      span_id: context?.spanId && /^[0-9a-f]{16}$/.test(context.spanId) ? context.spanId : undefined,
      sampled: traceId ? Boolean(context!.traceFlags & 1) : undefined,
      elapsed_ms: Math.round(elapsed), failure_reason: this.failure ?? 'none',
      phase_totals: this.phases,
      timing_semantics: 'render_work_since_first_observation; overlapping_phases_not_wall_time; fetch_includes_next_cache',
    }));
  }
}

// React's request cache also covers parallel layout/metadata calls without
// reading headers or changing static/ISR eligibility. No cross-request map.
export const contentRequestObservation = cache(() => new ContentRequestObservation(getActiveSpan()?.spanContext()));

export function observeMaintenance() {
  const observation = contentRequestObservation();
  if (observation.activate()) after(() => observation.finish());
}
