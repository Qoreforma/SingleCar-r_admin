import { api, enc } from './client';
import { toPaged } from './pagination';
import type { AuditLogItem, StaffItem } from '@/types/identity';

export const staffApi = {
  list: () => api.get<StaffItem[]>('/admin/staff'),
  invite: (body: { full_name: string; email: string; role: string }) => api.post<StaffItem>('/admin/staff/invitations', body),
  update: (id: string, body: { full_name?: string; role?: string; is_active?: boolean }) => api.patch<StaffItem>(`/admin/staff/${enc(id)}`, body),
  /** Owner only. Clears MFA enrolment and revokes every session of the target. */
  resetMfa: (id: string, reason: string) => api.post<{ id: string; mfa_reset: true }>(`/admin/staff/${enc(id)}/reset-mfa`, { reason }),
};

export interface AuditQuery { page: number; limit: number; from?: string; to?: string; action?: string }
export const auditApi = {
  list: async (q: AuditQuery) => toPaged<AuditLogItem>(await api.get('/admin/audit-logs', { ...q }), q),
};
