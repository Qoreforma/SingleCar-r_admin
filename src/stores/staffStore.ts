import { create } from 'zustand';
import { auditApi, staffApi } from '@/api/staff';
import { toApiError, type ApiError } from '@/api/errors';
import { dayEndUtc, dayStartUtc } from '@/lib/format';
import { pagedSlice, type PagedState } from './createPagedStore';
import type { AuditLogItem, StaffItem } from '@/types/identity';

interface StaffState {
  items: StaffItem[];
  loading: boolean;
  error: ApiError | null;
  load: () => Promise<void>;
  invite: (body: { full_name: string; email: string; role: string }) => Promise<void>;
  update: (id: string, body: { full_name?: string; role?: string; is_active?: boolean }) => Promise<void>;
  resetMfa: (id: string, reason: string) => Promise<void>;
}

export const useStaffStore = create<StaffState>()((set, get) => ({
  items: [],
  loading: false,
  error: null,
  async load() {
    set({ loading: true, error: null });
    try {
      const { data } = await staffApi.list();
      set({ items: Array.isArray(data) ? data : [], loading: false });
    } catch (e) {
      set({ error: toApiError(e), loading: false });
    }
  },
  async invite(body) { await staffApi.invite(body); await get().load(); },
  async update(id, body) { await staffApi.update(id, body); await get().load(); },
  async resetMfa(id, reason) { await staffApi.resetMfa(id, reason); await get().load(); },
}));

/* ---------- Audit log ---------- */
interface AuditFilters { from: string; to: string; action: string }
type AuditState = PagedState<AuditLogItem, AuditFilters>;

export const useAuditStore = create<AuditState>()((set, get) =>
  pagedSlice<AuditLogItem, AuditFilters, AuditState>({
    initialFilters: { from: '', to: '', action: '' },
    limit: 25,
    fetcher: (q) =>
      auditApi.list({
        page: q.page, limit: q.limit, action: q.action.trim() || undefined,
        from: q.from ? dayStartUtc(q.from) : undefined, to: q.to ? dayEndUtc(q.to) : undefined,
      }),
  })(set, get),
);
