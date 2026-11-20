import { create } from 'zustand';
import { settingsApi } from '@/api/settings';
import { toApiError, type ApiError } from '@/api/errors';
import { redactSecrets } from '@/lib/helpers';
import type { CompanySettings, CompanySettingsUpdate } from '@/types/identity';

interface SettingsState {
  settings: CompanySettings | null;
  /** Count of credential-looking fields dropped before they reached browser state. */
  hiddenSecrets: number;
  loading: boolean;
  error: ApiError | null;
  load: () => Promise<void>;
  save: (patch: CompanySettingsUpdate) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  settings: null,
  hiddenSecrets: 0,
  loading: false,
  error: null,
  async load() {
    set({ loading: true, error: null });
    try {
      const { data } = await settingsApi.get();
      const { clean, hidden } = redactSecrets(data);
      set({ settings: clean, hiddenSecrets: hidden, loading: false });
    } catch (e) {
      set({ error: toApiError(e), loading: false });
    }
  },
  /** Throws ApiError on failure so the form can show validation/conflict details. */
  async save(patch) {
    const { data } = await settingsApi.update(patch);
    const { clean, hidden } = redactSecrets(data);
    set({ settings: clean, hiddenSecrets: hidden });
  },
}));
