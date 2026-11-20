import { api } from './client';
import type { CompanySettings, CompanySettingsUpdate } from '@/types/identity';

export const settingsApi = {
  get: () => api.get<CompanySettings>('/admin/settings'),
  update: (patch: CompanySettingsUpdate) => api.patch<CompanySettings>('/admin/settings', patch),
};
