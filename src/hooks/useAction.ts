import { useCallback, useState } from 'react';
import { toApiError, type ApiError } from '@/api/errors';
import { toast } from '@/stores/uiStore';

/** Wraps a mutation with busy/error state. Resolves with { ok } instead of throwing. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  const run = useCallback(async <T,>(fn: () => Promise<T>, opts?: { success?: string }): Promise<{ ok: boolean; value?: T }> => {
    setBusy(true);
    setError(null);
    try {
      const value = await fn();
      if (opts?.success) toast.success(opts.success);
      return { ok: true, value };
    } catch (e) {
      setError(toApiError(e));
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => setError(null), []);
  return { run, busy, error, setError, reset };
}
