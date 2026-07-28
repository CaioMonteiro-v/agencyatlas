import { useEffect, useState } from 'react';

export function usePolling(fetcher, intervalMs = 8000, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    let timer;

    async function load() {
      try {
        const result = await fetcher();
        if (alive) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (alive) setError(err.message || 'Erro ao carregar');
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    timer = setInterval(load, intervalMs);

    return () => {
      alive = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, setData };
}
