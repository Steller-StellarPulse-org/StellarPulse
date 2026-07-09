"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getTopPlayers, getStats } from "@/services/leaderboard";
import { getMarkets, getMarketBettors } from "@/services/market";
import { getDisplayName } from "@/services/referral";
import * as cache from "@/services/cache";
import { useVisiblePoll } from "@/hooks/useVisiblePoll";
import type { PlayerStats } from "@/types";

/** Cache key for the assembled leaderboard (used for instant stale-seed). */
const LB_CACHE_KEY = "lb_assembled";

export type LeaderboardTab = "top_predictors" | "most_active" | "top_referrers";

// This poll is the HEAVIEST in the app (it fans out getMarketBettors across all
// markets). Rankings barely move minute-to-minute, so poll slowly (120s, was
// 30s) and only while the tab is visible.
const POLL_INTERVAL = 120_000;

interface UseLeaderboardResult {
  data: PlayerStats[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/** Sort players based on the selected tab */
function sortByTab(players: PlayerStats[], tab: LeaderboardTab): PlayerStats[] {
  const sorted = [...players];
  switch (tab) {
    case "most_active":
      return sorted.sort((a, b) => b.totalBets - a.totalBets);
    case "top_referrers":
      return sorted.sort((a, b) => b.points - a.points);
    case "top_predictors":
    default:
      return sorted.sort((a, b) => b.points - a.points);
  }
}

/**
 * Fallback: build a leaderboard from market bettors when the
 * onchain top-players list is still empty (no claims/bonuses yet).
 */
async function buildFromMarketBettors(): Promise<PlayerStats[]> {
  try {
    const markets = await getMarkets();
    if (markets.length === 0) return [];

    // Count, per address, how many markets they have actually bet in. The
    // leaderboard contract only records won/lost/points on CLAIM (after a market
    // resolves), so a user who has placed bets but not yet claimed has 0 there.
    // We derive their real activity (total bets) from the on-chain bettor index.
    const betCount = new Map<string, number>();
    const bettorResults = await Promise.allSettled(
      markets.map((m) => getMarketBettors(m.id))
    );
    for (const r of bettorResults) {
      if (r.status === "fulfilled") {
        for (const addr of r.value) {
          betCount.set(addr, (betCount.get(addr) ?? 0) + 1);
        }
      }
    }
    if (betCount.size === 0) return [];

    const addresses = Array.from(betCount.keys());
    const results = await Promise.allSettled(
      addresses.map(async (addr) => {
        const [stats, name] = await Promise.all([
          getStats(addr),
          getDisplayName(addr).catch(() => ""),
        ]);
        // Real total bets = markets the user has a bet in (from the index),
        // never less than what the leaderboard has settled.
        const placedBets = betCount.get(addr) ?? 0;
        const settledBets = stats?.totalBets ?? 0;
        const totalBets = Math.max(placedBets, settledBets);
        const wonBets = stats?.wonBets ?? 0;
        return {
          address: addr,
          displayName: name || "",
          points: stats?.points ?? 0,
          totalBets,
          wonBets,
          lostBets: stats?.lostBets ?? 0,
          winRate: settledBets > 0 ? (wonBets / settledBets) * 100 : 0,
        } satisfies PlayerStats;
      })
    );
    return results
      .filter((r): r is PromiseFulfilledResult<PlayerStats> => r.status === "fulfilled")
      .map((r) => r.value);
  } catch {
    return [];
  }
}

export function useLeaderboard(
  tab?: LeaderboardTab
): UseLeaderboardResult {
  // Seed from stale cache so the leaderboard renders instantly on return,
  // then refresh in the background.
  const seeded = useRef(cache.getStale<PlayerStats[]>(LB_CACHE_KEY));
  const [allPlayers, setAllPlayers] = useState<PlayerStats[]>(seeded.current ?? []);
  const [data, setData] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(!seeded.current);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const initialLoadDone = useRef(false);

  const fetchData = useCallback(async (silent = false) => {
    // Only show loading spinner on first load with no seed, not during polling
    if (!silent) setLoading(true);
    setError(null);
    try {
      // MERGE two sources so EVERY participant shows, not just claimers:
      //   1. on-chain top players — users who have claimed (have points/wins),
      //   2. market bettors — users who have placed bets but not yet claimed
      //      (the leaderboard contract has no points/stats for them yet).
      // The contract only records points/won/lost on claim, so without (2) a
      // brand-new bettor would be invisible and their total-bet count would be 0.
      const [topPlayers, bettorPlayers] = await Promise.all([
        getTopPlayers(50),
        buildFromMarketBettors(),
      ]);

      // Dedupe by address. Prefer the entry with more information: keep the
      // higher points (from the top list) AND the higher totalBets (from the
      // bettor index), so a claimer who also has pending bets shows both.
      const byAddr = new Map<string, PlayerStats>();
      for (const p of bettorPlayers) byAddr.set(p.address, p);
      for (const p of topPlayers) {
        const existing = byAddr.get(p.address);
        if (!existing) {
          byAddr.set(p.address, p);
        } else {
          byAddr.set(p.address, {
            ...existing,
            points: Math.max(existing.points, p.points),
            totalBets: Math.max(existing.totalBets, p.totalBets),
            wonBets: Math.max(existing.wonBets, p.wonBets),
            lostBets: Math.max(existing.lostBets, p.lostBets),
            winRate: p.winRate || existing.winRate,
            displayName: existing.displayName || p.displayName,
          });
        }
      }
      const players = Array.from(byAddr.values());

      if (!mountedRef.current) return;
      // Persist assembled leaderboard for instant stale-seed next time
      cache.set(LB_CACHE_KEY, players, 60_000);
      setAllPlayers(players);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error ? err.message : "Failed to load leaderboard"
      );
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        initialLoadDone.current = true;
      }
    }
  }, []);

  // Initial fetch — silent (background) if we already seeded from cache
  useEffect(() => {
    mountedRef.current = true;
    fetchData(seeded.current !== null && seeded.current.length > 0);
    return () => {
      mountedRef.current = false;
    };
  }, [fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-poll while visible (silent). Pauses when the tab is hidden.
  useVisiblePoll(() => {
    if (initialLoadDone.current) fetchData(true);
  }, POLL_INTERVAL);

  // Re-sort when tab or allPlayers changes
  useEffect(() => {
    setData(sortByTab(allPlayers, tab ?? "top_predictors"));
  }, [allPlayers, tab]);

  const refetch = useCallback(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch };
}
