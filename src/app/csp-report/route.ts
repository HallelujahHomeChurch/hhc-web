const maxReportBytes = 16_384;
const acceptedContentTypes = new Set(['application/csp-report', 'application/reports+json', 'application/json']);

export async function POST(request: Request) {
  const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
  if (!contentType || !acceptedContentTypes.has(contentType)) {
    return new Response(null, {status: 415});
  }

  const contentLength = Number.parseInt(request.headers.get('content-length') ?? '0', 10);
  if (Number.isFinite(contentLength) && contentLength > maxReportBytes) {
    return new Response(null, {status: 413});
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxReportBytes) {
    return new Response(null, {status: 413});
  }

  try {
    const payload: unknown = JSON.parse(text);
    const report = reportBody(payload);
    if (report) console.warn('csp-violation', sanitizeReport(report));
  } catch {
    return new Response(null, {status: 400});
  }

  return new Response(null, {status: 204, headers: {'Cache-Control': 'no-store'}});
}

function reportBody(payload: unknown): Record<string, unknown> | null {
  const candidate = Array.isArray(payload) ? payload[0] : payload;
  if (!isRecord(candidate)) return null;
  if (isRecord(candidate['csp-report'])) return candidate['csp-report'];
  if (isRecord(candidate.body)) return candidate.body;
  return candidate;
}

function sanitizeReport(report: Record<string, unknown>) {
  return {
    blocked: blockedSource(textField(report, 'blocked-uri', 'blockedURL')),
    directive: bounded(textField(report, 'effective-directive', 'effectiveDirective', 'violated-directive'), 80),
    documentPath: documentPath(textField(report, 'document-uri', 'documentURL', 'url')),
    disposition: bounded(textField(report, 'disposition') || 'report', 16)
  };
}

function textField(report: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    if (typeof report[key] === 'string') return report[key];
  }
  return '';
}

function blockedSource(value: string) {
  if (['inline', 'eval', 'self', 'data', 'blob'].includes(value)) return value;
  try {
    return new URL(value).origin;
  } catch {
    return bounded(value, 160);
  }
}

function documentPath(value: string) {
  try {
    return bounded(new URL(value).pathname, 512) || '/';
  } catch {
    return '/';
  }
}

function bounded(value: string, length: number) {
  return value.slice(0, length);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
