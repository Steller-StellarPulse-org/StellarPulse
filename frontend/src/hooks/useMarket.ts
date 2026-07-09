"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getMarket, getBet } from "@/services/market";
import { useWallet } from "@/hooks/useWallet";
import type { Market, Bet } from "@/types";

interface UseMarketResult {
  market: Market | null;
  userBet: Bet | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useMarket(id: number): UseMarketResult {
  const { publicKey } = useWallet();
  const [market, setMarket] = useState<Market | null>(null);
  const [userBet, setUserBet] = useState<Bet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const initialLoadDone = useRef(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!id || id < 1) {
      setLoading(false);
      return;
    }

    // Only show loading skeleton on first load
    if (!silent && !initialLoadDone.current) setLoading(true);
    setError(null);
    try {
      const marketData = await getMarket(id);
      if (!mountedRef.current) return;

      if (!marketData) {
        setError("Market not found");
        setMarket(null);
        setUserBet(null);
        return;
      }

      setMarket(marketData);

      if (publicKey) {
        try {
          const bet = await getBet(id, publicKey);
          if (mountedRef.current) setUserBet(bet);
        } catch {
          if (mountedRef.current) setUserBet(null);
        }
      } else {
        setUserBet(null);
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error ? err.message : "Failed to load market"
      );
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        initialLoadDone.current = true;
      }
    }
  }, [id, publicKey]);

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

  return { market, userBet, loading, error, refetch };
}
