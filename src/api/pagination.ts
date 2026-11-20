import type { Envelope } from '@/types/common';

/** The API paginates four different ways; every list endpoint is normalised to this. */
export interface Paged<T> {
  items: T[];
  page: number;
  limit: number;
  total: number | null;
  totalPages: number | null;
  hasNext: boolean;
  hasPrev: boolean;
}

const n = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function toPaged<T>(env: Envelope<unknown>, req: { page: number; limit: number }): Paged<T> {
  const d = env.data;
  const m = (env.meta ?? {}) as Record<string, unknown>;
  let items: T[] = [];
  let page = req.page;
  let limit = req.limit;
  let total: number | null = null;

  if (Array.isArray(d)) {
    items = d as T[];
  } else if (d && typeof d === 'object') {
    const o = d as Record<string, unknown>;
    const arr = [o.items, o.data, o.results, o.blocks, o.events].find(Array.isArray);
    if (arr) items = arr as T[];
    page = n(o.page) ?? page;
    limit = n(o.limit) ?? limit;
    total = n(o.total) ?? n(o.totalItems);
  }
  page = n(m.page) ?? page;
  limit = n(m.limit) ?? limit;
  total = n(m.totalItems) ?? n(m.total) ?? total;
  const totalPages = n(m.totalPages) ?? n(m.pageCount) ?? (total != null ? Math.max(1, Math.ceil(total / Math.max(limit, 1))) : null);
  const hasNext = typeof m.hasNextPage === 'boolean' ? m.hasNextPage : totalPages != null ? page < totalPages : items.length >= limit;
  const hasPrev = typeof m.hasPreviousPage === 'boolean' ? m.hasPreviousPage : page > 1;
  return { items, page, limit, total, totalPages, hasNext, hasPrev };
}
