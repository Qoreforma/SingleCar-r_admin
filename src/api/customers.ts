import { api, download, enc } from './client';
import { toPaged } from './pagination';
import type { Rec } from '@/types/common';

export interface CustomerQuery { page: number; limit: number; search?: string; is_active?: string; email_verified?: string }

export const customersApi = {
  list: async (q: CustomerQuery) => toPaged<Rec>(await api.get('/admin/customers', { ...q }), q),
  get: (id: string) => api.get<Rec>(`/admin/customers/${enc(id)}`),
  sessions: (id: string) => api.get<Rec[]>(`/admin/customers/${enc(id)}/sessions`),
  revokeSession: (id: string, sessionId: string, reason: string) => api.del(`/admin/customers/${enc(id)}/sessions/${enc(sessionId)}`, { reason }),
  setStatus: (id: string, body: { is_active: boolean; reason: string }) => api.patch<Rec>(`/admin/customers/${enc(id)}/status`, body),
  /** Personal data: streamed straight to a file download, never kept in app state or logged. */
  exportData: (id: string) => download(`/admin/customers/${enc(id)}/export`, undefined, `customer-${id}-export.json`),
};
