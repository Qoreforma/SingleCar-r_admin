/**
 * Web-session policy (swap this one file if your team picks a different policy):
 *  - access token: memory only (gone on reload, never touches storage)
 *  - refresh token: sessionStorage (survives a reload in this tab, cleared when the tab closes)
 * Nothing here is ever logged.
 */
const REFRESH_KEY = 'cra.rt';
let accessToken: string | null = null;

export const session = {
  getAccessToken: () => accessToken,
  getRefreshToken(): string | null {
    try { return sessionStorage.getItem(REFRESH_KEY); } catch { return null; }
  },
  setTokens(access: string, refresh: string) {
    accessToken = access;
    try { sessionStorage.setItem(REFRESH_KEY, refresh); } catch { /* storage blocked: session lasts until reload */ }
  },
  clear() {
    accessToken = null;
    try { sessionStorage.removeItem(REFRESH_KEY); } catch { /* ignore */ }
  },
};
