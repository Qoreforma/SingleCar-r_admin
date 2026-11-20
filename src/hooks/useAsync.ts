import { useCallback, useEffect, useRef, useState } from 'react';
import { toApiError, type ApiError } from '@/api/errors';

/** Loads a resource for drawers/tabs; stale responses are ignored and `reload` re-fetches after mutations. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[], enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(enabled);
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const d = await fn();
      if (id === seq.current) setData(d);
    } catch (e) {
      if (id === seq.current) setError(toApiError(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    if (enabled) void run();
    else setLoading(false);
  }, [run, enabled]);

  return { data, error, loading, reload: run, setData };
}
