import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

import { errorMessage } from '@/api/client';

export function useFetch<T>(fn: () => Promise<T>, deps: DependencyList = [], enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  const reqId = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    fnRef.current = fn;
  }, [fn]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    const id = ++reqId.current;
    if (mode === 'refresh') setRefreshing(true);
    else if (mode === 'initial') setLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      if (mounted.current && id === reqId.current) setData(result);
    } catch (e) {
      if (mounted.current && id === reqId.current) setError(errorMessage(e));
    } finally {
      if (mounted.current && id === reqId.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    const start = async () => {
      await Promise.resolve();
      if (!active) return;
      if (enabled) await load('initial');
      else setLoading(false);
    };
    void start();
    return () => {
      active = false;
      reqId.current += 1;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled, load]);

  return {
    data,
    setData,
    loading,
    refreshing,
    error,
    reload: () => load('initial'),
    refresh: () => load('refresh'),
    silentReload: () => load('silent'),
  };
}
