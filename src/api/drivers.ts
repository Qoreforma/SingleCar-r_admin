import { api, enc } from './client';
import { toPaged } from './pagination';
import type { DriverProfile } from '@/types/bookings';

export interface DriverQuery { page: number; limit: number; search?: string; is_active?: string }

export const driversApi = {
  list: async (q: DriverQuery) => toPaged<DriverProfile>(await api.get('/admin/drivers', { ...q }), q),
  create: (body: { full_name: string; email: string; phone_e164: string }) => api.post<DriverProfile>('/admin/drivers', body),
  update: (id: string, body: { full_name?: string; email?: string; phone_e164?: string; is_active?: boolean; expected_version: number }) =>
    api.patch<DriverProfile>(`/admin/drivers/${enc(id)}`, body),
};
