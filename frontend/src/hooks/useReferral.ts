"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getReferrer,
  getDisplayName,
  getReferralCount,
  getEarnings,
  isRegistered,
} from "@/services/referral";
import * as cache from "@/services/cache";
import { useVisiblePoll } from "@/hooks/useVisiblePoll";
import type { ReferralInfo } from "@/types";

// Referral data (counts, earnings) changes only when a referred user bets —
// infrequent. Poll slowly (120s, was 30s), only while visible AND connected.
const POLL_INTERVAL = 120_000;

interface UseReferralResult {
  data: ReferralInfo | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useReferral(publicKey?: string): UseReferralResult {
  const [data, setData] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const initialLoadDone = useRef(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!publicKey) {
      setData(null);
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    setError(null);
    try {
      const [referrer, displayName, referralCount, earnings, registered] =
        await Promise.all([
          getReferrer(publicKey),
          getDisplayName(publicKey),
          getReferralCount(publicKey),
          getEarnings(publicKey),
          isRegistered(publicKey),
        ]);

      if (!mountedRef.current) return;

      setData({
        referrer,
        displayName,
        referralCount,
        earnings,
        isRegistered: registered,
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error ? err.message : "Failed to load referral data"
      );
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        initialLoadDone.current = true;
      }
    }
  }, [publicKey]);

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;
    fetchData();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]);

  // Auto-poll while visible AND connected (silent). Pauses when hidden.
  useVisiblePoll(
    () => {
      if (initialLoadDone.current) fetchData(true);
    },
    POLL_INTERVAL,
    !!publicKey
  );

  const refetch = useCallback(() => {
    // Clear referral-related caches so fresh data is fetched
    if (publicKey) {
      cache.invalidate(`ref_referrer_${publicKey}`);
      cache.invalidate(`ref_name_${publicKey}`);
      cache.invalidate(`ref_count_${publicKey}`);
      cache.invalidate(`ref_earnings_${publicKey}`);
      cache.invalidate(`ref_has_${publicKey}`);
      cache.invalidate(`ref_reg_${publicKey}`);
    }
    fetchData();
  }, [fetchData, publicKey]);

  return { data, loading, error, refetch };
}
