import axios, { AxiosError, AxiosHeaders, type AxiosRequestConfig } from 'axios';
import { API_BASE_URL } from '@/lib/env';
import { session } from '@/lib/session';
import { saveBlob, filenameFromDisposition } from '@/lib/download';
import type { Envelope } from '@/types/common';
import { toApiError } from './errors';

export const http = axios.create({ baseURL: API_BASE_URL, timeout: 30_000 });
/** No interceptors: used for the refresh call itself so it can never recurse. */
const bare = axios.create({ baseURL: API_BASE_URL, timeout: 30_000 });

/** Public auth endpoints: a 401 here means "wrong credentials/code", never "session expired". */
const AUTH_FREE = [
  '/admin/auth/login',
  '/admin/auth/verify-mfa',
  '/admin/auth/refresh-token',
  '/admin/auth/forgot-password-otp',
  '/admin/auth/verify-reset-otp',
  '/admin/auth/reset-password',
  '/admin/auth/accept-invitation',
];

let onSessionEnded: (() => void) | null = null;
export const setSessionEndedHandler = (fn: () => void) => { onSessionEnded = fn; };

let inflight: Promise<boolean> | null = null;
/**
 * Rotates the refresh token. Single-flight: concurrent callers (parallel 401s, StrictMode double-mount)
 * share one request, because a rotated refresh token can only be used once.
 */
export function refreshSession(): Promise<boolean> {
  if (!inflight) {
    inflight = (async () => {
      const rt = session.getRefreshToken();
      if (!rt) return false;
      try {
        const res = await bare.post<Envelope<{ accessToken: string; refreshToken: string }>>('/admin/auth/refresh-token', { refreshToken: rt });
        const d = res.data.data;
        session.setTokens(d.accessToken, d.refreshToken);
        return true;
      } catch (e) {
        const status = axios.isAxiosError(e) ? e.response?.status : undefined;
        // Only a definitive rejection ends the session; a network blip must not log people out.
        if (status === 400 || status === 401) session.clear();
        return false;
      }
    })().finally(() => { inflight = null; });
  }
  return inflight;
}

http.interceptors.request.use((cfg) => {
  const token = session.getAccessToken();
  if (token) cfg.headers.set('Authorization', `Bearer ${token}`);
  return cfg;
});

http.interceptors.response.use(undefined, async (error: AxiosError) => {
  const resp = error.response;
  // Downloads request a Blob; error bodies arrive as Blobs too, so decode them first.
  if (resp && resp.data instanceof Blob && resp.data.type.includes('json')) {
    try { resp.data = JSON.parse(await resp.data.text()); } catch { /* keep as-is */ }
  }
  const cfg = error.config as (AxiosRequestConfig & { _retried?: boolean }) | undefined;
  const authFree = !!cfg?.url && AUTH_FREE.some((p) => cfg.url!.startsWith(p));
  if (resp?.status === 401 && cfg && !authFree) {
    if (!cfg._retried) {
      cfg._retried = true;
      if (await refreshSession()) {
        cfg.headers = AxiosHeaders.from(cfg.headers as AxiosHeaders).set('Authorization', `Bearer ${session.getAccessToken()}`);
        return http(cfg);
      }
      if (!session.getRefreshToken()) onSessionEnded?.();
    } else {
      onSessionEnded?.();
    }
  }
  return Promise.reject(toApiError(error));
});

type Params = Record<string, unknown> | undefined;
/** Drop empty filters so they never reach the query string. */
export function clean(params: Params): Record<string, unknown> | undefined {
  if (!params) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') out[k] = v;
  return out;
}

export const api = {
  async get<T = unknown>(url: string, params?: Params): Promise<Envelope<T>> {
    return (await http.get<Envelope<T>>(url, { params: clean(params) })).data;
  },
  async post<T = unknown>(url: string, body?: unknown): Promise<Envelope<T>> {
    return (await http.post<Envelope<T>>(url, body)).data;
  },
  async patch<T = unknown>(url: string, body?: unknown): Promise<Envelope<T>> {
    return (await http.patch<Envelope<T>>(url, body)).data;
  },
  async del<T = unknown>(url: string, body?: unknown): Promise<Envelope<T>> {
    return (await http.delete<Envelope<T>>(url, body === undefined ? undefined : { data: body })).data;
  },
};

export const enc = encodeURIComponent;

export interface DownloadResult { filename: string; rowCount?: string }

/** Report/export endpoints return files, not JSON envelopes: stream to a Blob and hand it to the browser. */
export async function download(url: string, params: Params, fallbackName: string): Promise<DownloadResult> {
  const res = await http.get<Blob>(url, { params: clean(params), responseType: 'blob' });
  const type = String(res.headers['content-type'] ?? '');
  const ext = type.includes('csv') ? 'csv' : type.includes('json') ? 'json' : 'txt';
  const filename = filenameFromDisposition(res.headers['content-disposition'] as string | undefined) ?? (fallbackName.includes('.') ? fallbackName : `${fallbackName}.${ext}`);
  saveBlob(res.data, filename);
  const rows = res.headers['x-report-row-count'];
  return { filename, rowCount: rows ? String(rows) : undefined };
}
