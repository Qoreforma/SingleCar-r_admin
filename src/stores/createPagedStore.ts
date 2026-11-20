import { create } from 'zustand';
import { toApiError, type ApiError } from '@/api/errors';
import type { Paged } from '@/api/pagination';

/** Shared list behaviour: filters, paging, loading/error, and stale-response protection. */
export interface PagedState<T, F> {
  items: T[];
  page: number;
  limit: number;
  total: number | null;
  totalPages: number | null;
  hasNext: boolean;
  hasPrev: boolean;
  filters: F;
  loading: boolean;
  error: ApiError | null;
  loaded: boolean;
  load: (page?: number) => Promise<void>;
  setFilters: (patch: Partial<F>) => void;
  resetFilters: () => void;
}

type Setter<S> = (partial: Partial<S> | ((s: S) => Partial<S>)) => void;
export interface PagedConfig<T, F> {
  fetcher: (q: F & { page: number; limit: number }) => Promise<Paged<T>>;
  initialFilters: F;
  limit?: number;
}

/** Spread this into a domain store: `...pagedSlice<Item, Filters, State>(cfg)(set, get)`. */
export function pagedSlice<T, F extends object, S extends PagedState<T, F> = PagedState<T, F>>(cfg: PagedConfig<T, F>) {
  let seq = 0;
  return (set: Setter<S>, get: () => S): PagedState<T, F> => ({
    items: [],
    page: 1,
    limit: cfg.limit ?? 20,
    total: null,
    totalPages: null,
    hasNext: false,
    hasPrev: false,
    filters: cfg.initialFilters,
    loading: false,
    error: null,
    loaded: false,
    async load(page) {
      const id = ++seq;
      const s = get();
      set({ loading: true, error: null } as Partial<S>);
      try {
        const res = await cfg.fetcher({ ...s.filters, page: page ?? s.page, limit: s.limit });
        if (id !== seq) return;
        set({
          items: res.items, page: res.page, total: res.total, totalPages: res.totalPages,
          hasNext: res.hasNext, hasPrev: res.hasPrev, loading: false, loaded: true,
        } as Partial<S>);
      } catch (e) {
        if (id !== seq) return;
        set({ loading: false, loaded: true, error: toApiError(e) } as Partial<S>);
      }
    },
    setFilters(patch) {
      set((s) => ({ filters: { ...s.filters, ...patch }, page: 1 }) as Partial<S>);
      void get().load(1);
    },
    resetFilters() {
      set({ filters: cfg.initialFilters, page: 1 } as Partial<S>);
      void get().load(1);
    },
  });
}

export function createPagedStore<T, F extends object>(cfg: PagedConfig<T, F>) {
  return create<PagedState<T, F>>()((set, get) => pagedSlice<T, F>(cfg)(set, get));
}
