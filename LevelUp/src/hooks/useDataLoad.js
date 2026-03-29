import { useState, useEffect, useCallback } from 'react';

export function useDataLoad(fetcher, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetcher();
      setData(result);
    } catch (e) {
      setError(e);
      console.warn('[useDataLoad]', e.message);
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetcher();
        if (mounted) setData(result);
      } catch (e) {
        if (mounted) {
          setError(e);
          console.warn('[useDataLoad]', e.message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [load]);

  return { data, loading, error, refresh: load };
}
