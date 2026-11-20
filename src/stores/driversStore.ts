import { create } from 'zustand';
import { driversApi } from '@/api/drivers';
import type { DriverProfile } from '@/types/bookings';
import { pagedSlice, type PagedState } from './createPagedStore';

interface DriverFilters { search: string; is_active: string }
interface DriversState extends PagedState<DriverProfile, DriverFilters> {
  /** Active drivers for assignment pickers. */
  options: DriverProfile[];
  loadOptions: () => Promise<void>;
  create: (body: { full_name: string; email: string; phone_e164: string }) => Promise<void>;
  update: (id: string, body: { full_name?: string; email?: string; phone_e164?: string; is_active?: boolean; expected_version: number }) => Promise<void>;
}

export const useDriversStore = create<DriversState>()((set, get) => ({
  ...pagedSlice<DriverProfile, DriverFilters, DriversState>({
    initialFilters: { search: '', is_active: '' },
    fetcher: (q) => driversApi.list(q),
  })(set, get),
  options: [],
  async loadOptions() {
    try { set({ options: (await driversApi.list({ page: 1, limit: 100, is_active: 'true' })).items }); } catch { /* picker shows empty */ }
  },
  async create(body) { await driversApi.create(body); await get().load(); },
  async update(id, body) { await driversApi.update(id, body); await get().load(); },
}));
