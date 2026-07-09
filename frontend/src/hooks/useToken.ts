"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getBalance, getTokenInfo } from "@/services/token";
import type { TokenInfo } from "@/types";

interface UseTokenResult {
  data: { balance: number; info: TokenInfo } | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useToken(publicKey?: string): UseTokenResult {
  const [data, setData] = useState<{ balance: number; info: TokenInfo } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const initialLoadDone = useRef(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent && !initialLoadDone.current) setLoading(true);
    setError(null);
    try {
      const [info, balance] = await Promise.all([
        getTokenInfo(),
        publicKey ? getBalance(publicKey) : Promise.resolve(0),
      ]);
      if (!mountedRef.current) return;
      setData({ balance, info });
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error ? err.message : "Failed to load token data"
      );
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        initialLoadDone.current = true;
      }
    }
  }, [publicKey]);

  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  return { data, loading, error, refetch };
}
