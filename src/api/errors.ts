import axios from 'axios';

/**
 * One error type for every backend module. The API uses two envelope shapes:
 *  - identity/payments: { success:false, statusCode, message, error:{code,details}, requestId }
 *  - fleet/bookings:    { success:false, message, error?: string }
 * plus a bare { message } for 429 responses.
 */
export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;
  requestId?: string;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, opts: { code?: string; details?: unknown; requestId?: string; retryAfterSeconds?: number } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = opts.code;
    this.details = opts.details;
    this.requestId = opts.requestId;
    this.retryAfterSeconds = opts.retryAfterSeconds;
  }
  get isNetwork() { return this.status === 0; }
  get isUnauthorized() { return this.status === 401; }
  get isForbidden() { return this.status === 403; }
  get isNotFound() { return this.status === 404; }
  /** Server state moved on (version mismatch, illegal transition, overlap...). */
  get isStale() { return this.status === 409 || this.status === 422; }
  get isRateLimited() { return this.status === 429; }
  get isServer() { return this.status >= 500; }
  /** True when we can't tell whether the server applied the request (timeouts, dropped connections, 5xx). */
  get outcomeUnknown() { return this.status === 0 || this.status >= 500; }
}

export function detailLines(details: unknown): string[] {
  if (!details) return [];
  if (typeof details === 'string') return [details];
  if (Array.isArray(details)) {
    return details.flatMap((d) => {
      if (typeof d === 'string') return [d];
      if (d && typeof d === 'object') {
        const o = d as Record<string, unknown>;
        const msg = (o.message ?? o.msg) as string | undefined;
        const path = (o.path ?? o.field ?? o.property) as string | string[] | undefined;
        if (msg) return [path ? `${Array.isArray(path) ? path.join('.') : path}: ${msg}` : msg];
      }
      return [];
    });
  }
  if (typeof details === 'object') {
    return Object.entries(details as Record<string, unknown>).flatMap(([k, v]) =>
      typeof v === 'string' ? [`${k}: ${v}`] : Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => `${k}: ${x}`) : [],
    );
  }
  return [];
}

export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  if (axios.isAxiosError(e)) {
    if (!e.response) {
      const timeout = e.code === 'ECONNABORTED';
      return new ApiError(
        timeout ? 'The server took too long to respond.' : 'Can’t reach the server. Check your connection and try again.',
        0,
      );
    }
    const { status, data, headers } = e.response;
    const body = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const errField = body.error;
    const code = typeof errField === 'object' && errField ? ((errField as Record<string, unknown>).code as string | undefined) : typeof errField === 'string' ? errField : undefined;
    const details = typeof errField === 'object' && errField ? (errField as Record<string, unknown>).details : undefined;
    const retry = Number(headers?.['retry-after']);
    const fallback =
      status === 401 ? 'Your session has expired. Sign in again.'
      : status === 403 ? 'You don’t have permission to do this.'
      : status === 404 ? 'That record no longer exists.'
      : status === 429 ? 'Too many requests. Wait a moment and try again.'
      : status >= 500 ? 'The service is unavailable right now. Try again shortly.'
      : 'The request could not be completed.';
    return new ApiError(typeof body.message === 'string' && body.message ? body.message : fallback, status, {
      code,
      details,
      requestId: typeof body.requestId === 'string' ? body.requestId : undefined,
      retryAfterSeconds: Number.isFinite(retry) ? retry : undefined,
    });
  }
  return new ApiError(e instanceof Error ? e.message : 'Something went wrong.', 0);
}
