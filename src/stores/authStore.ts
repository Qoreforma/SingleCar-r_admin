import { create } from 'zustand';
import { authApi } from '@/api/auth';
import { refreshSession, setSessionEndedHandler } from '@/api/client';
import { session } from '@/lib/session';
import type { AdminProfile, AdminSessionResult } from '@/types/identity';

export type AuthPhase = 'booting' | 'anonymous' | 'mfa' | 'mfa_setup' | 'authenticated';

interface AuthState {
  phase: AuthPhase;
  user: AdminProfile | null;
  /** Short-lived MFA challenge/enrolment token. Memory only. */
  mfaToken: string | null;
  setup: { secret: string; otpAuthUrl: string } | null;
  /** Shown exactly once after enrolment; the app stays locked until acknowledged. Memory only. */
  recoveryCodes: string[] | null;
  notice: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  cancelMfa: () => void;
  acknowledgeRecoveryCodes: () => void;
  logout: () => Promise<void>;
  endSession: (notice?: string) => void;
  clearNotice: () => void;
}

let booting: Promise<void> | null = null;

export const useAuthStore = create<AuthState>()((set, get) => {
  const complete = (res: AdminSessionResult) => {
    session.setTokens(res.accessToken, res.refreshToken);
    set({
      phase: 'authenticated', user: res.user, mfaToken: null, setup: null, notice: null,
      recoveryCodes: res.recoveryCodes && res.recoveryCodes.length ? res.recoveryCodes : null,
    });
  };

  return {
    phase: 'booting', user: null, mfaToken: null, setup: null, recoveryCodes: null, notice: null,

    bootstrap() {
      // Idempotent: React StrictMode mounts twice and a rotated refresh token is single-use.
      booting ??= (async () => {
        if (!session.getRefreshToken()) return set({ phase: 'anonymous' });
        if (!(await refreshSession())) return set({ phase: 'anonymous' });
        try {
          const { data } = await authApi.me();
          set({ phase: 'authenticated', user: data });
        } catch {
          session.clear();
          set({ phase: 'anonymous' });
        }
      })();
      return booting;
    },

    async login(email, password) {
      const { data } = await authApi.login({ email, password });
      if ('accessToken' in data) complete(data);
      else if ('mfaSetupRequired' in data) set({ phase: 'mfa_setup', mfaToken: data.mfaToken, setup: { secret: data.secret, otpAuthUrl: data.otpAuthUrl }, notice: null });
      else set({ phase: 'mfa', mfaToken: data.mfaToken, setup: null, notice: null });
    },

    async verifyMfa(code) {
      const token = get().mfaToken;
      if (!token) throw new Error('Your sign-in expired. Start again.');
      const { data } = await authApi.verifyMfa({ mfaToken: token, code });
      complete(data);
    },

    cancelMfa: () => set({ phase: 'anonymous', mfaToken: null, setup: null }),
    acknowledgeRecoveryCodes: () => set({ recoveryCodes: null }),

    async logout() {
      try { await authApi.logout(); } catch { /* the local session is cleared regardless */ }
      session.clear();
      set({ phase: 'anonymous', user: null, mfaToken: null, setup: null, recoveryCodes: null, notice: null });
    },

    endSession(notice) {
      if (get().phase === 'anonymous') return;
      session.clear();
      set({ phase: 'anonymous', user: null, mfaToken: null, setup: null, recoveryCodes: null, notice: notice ?? 'Your session ended. Sign in again.' });
    },

    clearNotice: () => set({ notice: null }),
  };
});

setSessionEndedHandler(() => useAuthStore.getState().endSession());
