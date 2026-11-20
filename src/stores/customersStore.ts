import { create } from 'zustand';
import { customersApi } from '@/api/customers';
import type { Rec } from '@/types/common';
import { pagedSlice, type PagedState } from './createPagedStore';

interface CustomerFilters { search: string; is_active: string; email_verified: string }
interface CustomersState extends PagedState<Rec, CustomerFilters> {
  setStatus: (id: string, isActive: boolean, reason: string) => Promise<Rec>;
}

export const useCustomersStore = create<CustomersState>()((set, get) => ({
  ...pagedSlice<Rec, CustomerFilters, CustomersState>({
    initialFilters: { search: '', is_active: '', email_verified: '' },
    fetcher: (q) => customersApi.list(q),
  })(set, get),
  async setStatus(id, isActive, reason) {
    const { data } = await customersApi.setStatus(id, { is_active: isActive, reason });
    await get().load();
    return data;
  },
}));
