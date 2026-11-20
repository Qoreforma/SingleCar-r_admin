import { create } from 'zustand';
import { fleetApi, type ReferenceData } from '@/api/fleet';
import type { Rec } from '@/types/common';
import { pagedSlice, type PagedState } from './createPagedStore';

interface FleetFilters { search: string; is_active: string; brand: string; location: string }
interface FleetState extends PagedState<Rec, FleetFilters> {
  reference: ReferenceData | null;
  loadReference: () => Promise<void>;
  create: (body: Rec) => Promise<Rec>;
  update: (id: string, body: Rec & { expected_version: number }) => Promise<Rec>;
  deactivate: (id: string, expectedVersion: number) => Promise<Rec>;
  exportInventory: () => ReturnType<typeof fleetApi.exportInventory>;
}

export const useFleetStore = create<FleetState>()((set, get) => ({
  ...pagedSlice<Rec, FleetFilters, FleetState>({
    initialFilters: { search: '', is_active: '', brand: '', location: '' },
    fetcher: (q) => fleetApi.list(q),
  })(set, get),

  reference: null,
  async loadReference() {
    if (get().reference) return;
    try { set({ reference: (await fleetApi.referenceData()).data }); } catch { /* suggestions are optional */ }
  },
  async create(body) {
    const { data } = await fleetApi.create(body);
    set({ reference: null }); // new brands/locations may exist now
    await Promise.all([get().load(), get().loadReference()]);
    return data;
  },
  async update(id, body) {
    const { data } = await fleetApi.update(id, body);
    await get().load();
    return data;
  },
  async deactivate(id, expectedVersion) {
    const { data } = await fleetApi.deactivate(id, expectedVersion);
    await get().load();
    return data;
  },
  exportInventory() {
    const { search, is_active, brand, location } = get().filters;
    return fleetApi.exportInventory({ search, is_active, brand, location });
  },
}));
