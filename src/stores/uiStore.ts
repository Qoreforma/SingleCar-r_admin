import { create } from 'zustand';

export interface Toast { id: number; tone: 'success' | 'error' | 'info'; message: string }
interface UiState {
  toasts: Toast[];
  push: (tone: Toast['tone'], message: string) => void;
  dismiss: (id: number) => void;
}
let seq = 1;

export const useUiStore = create<UiState>()((set, get) => ({
  toasts: [],
  push(tone, message) {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, tone, message }] }));
    setTimeout(() => get().dismiss(id), tone === 'error' ? 8000 : 4500);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (m: string) => useUiStore.getState().push('success', m),
  error: (m: string) => useUiStore.getState().push('error', m),
  info: (m: string) => useUiStore.getState().push('info', m),
};
