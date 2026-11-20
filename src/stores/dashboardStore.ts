import { create } from 'zustand';
import { dashboardApi } from '@/api/dashboard';
import { toApiError, type ApiError } from '@/api/errors';
import { dayEndUtc, dayStartUtc, daysAgoIso, todayIso } from '@/lib/format';
import type { DashboardResult } from '@/types/identity';

interface Filters { from: string; to: string; currency: string; provider: string }
interface DashboardState {
  filters: Filters;
  data: DashboardResult | null;
  loading: boolean;
  error: ApiError | null;
  load: () => Promise<void>;
  setFilters: (patch: Partial<Filters>) => void;
}

let seq = 0;
export const useDashboardStore = create<DashboardState>()((set, get) => ({
  filters: { from: daysAgoIso(29), to: todayIso(), currency: '', provider: '' },
  data: null,
  loading: false,
  error: null,
  async load() {
    const id = ++seq;
    const f = get().filters;
    if (!f.from || !f.to || f.from > f.to) return set({ error: toApiError(new Error('Start date must be on or before the end date.')) });
    set({ loading: true, error: null });
    try {
      const { data } = await dashboardApi.get({
        from: dayStartUtc(f.from), to: dayEndUtc(f.to),
        currency: f.currency.trim().toUpperCase() || undefined, provider: f.provider || undefined,
      });
      if (id === seq) set({ data, loading: false });
    } catch (e) {
      if (id === seq) set({ error: toApiError(e), loading: false });
    }
  },
  setFilters(patch) {
    set((s) => ({ filters: { ...s.filters, ...patch } }));
  },
}));
