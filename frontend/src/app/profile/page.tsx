"use client";

import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useProfile } from "@/hooks/useProfile";
import { useToken } from "@/hooks/useToken";
import { getMarkets, getBet } from "@/services/market";
import PointsCard from "@/components/profile/PointsCard";
import TokenBalance from "@/components/profile/TokenBalance";
import BetHistory from "@/components/profile/BetHistory";
import ReferralStats from "@/components/profile/ReferralStats";
import Skeleton from "@/components/ui/Skeleton";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import WalletConnect from "@/components/wallet/WalletConnect";
import type { Market, Bet } from "@/types";
import { FiUser, FiTrendingUp, FiLink } from "react-icons/fi";

interface BetHistoryItem {
  market: Market;
  bet: Bet;
}

export default function ProfilePage() {
  const { publicKey, connected } = useWallet();
  const { data: profile, loading: profileLoading } = useProfile(publicKey ?? undefined);
  const { data: tokenData } = useToken(publicKey ?? undefined);

  const [bets, setBets] = useState<BetHistoryItem[]>([]);
  const [betsLoading, setBetsLoading] = useState(false);

  // Fetch user's bet history across all markets
  useEffect(() => {
    if (!publicKey) {
      setBets([]);
      return;
    }

    let mounted = true;
    setBetsLoading(true);

    (async () => {
      try {
        const markets = await getMarkets();
        const items: BetHistoryItem[] = [];

        // Check each market for user's bet (in parallel batches)
        const results = await Promise.allSettled(
          markets.map(async (market) => {
            const bet = await getBet(market.id, publicKey);
            if (bet) return { market, bet };
            return null;
          })
        );

        for (const r of results) {
          if (r.status === "fulfilled" && r.value) {
            items.push(r.value);
          }
        }

        if (mounted) setBets(items);
      } catch {
        // silently fail
      } finally {
        if (mounted) setBetsLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [publicKey]);

  // Not connected — show connect prompt
  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-hover flex items-center justify-center mx-auto mb-5">
          <FiUser className="w-7 h-7 text-slate-600" />
        </div>
        <h1 className="font-heading text-2xl font-bold mb-2">
          Connect Your Wallet
        </h1>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          Connect your wallet to view your profile, bet history, and referral stats.
        </p>
        <div className="flex justify-center">
          <WalletConnect />
        </div>
      </div>
    );
  }

  if (profileLoading && !profile) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <Skeleton height="2rem" width="10rem" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} height="6rem" className="rounded-xl" />
          ))}
        </div>
        <Skeleton height="12rem" className="rounded-xl" />
      </div>
    );
  }

  const stats = profile?.stats;
  const referral = profile?.referral;

  /** Return 0 for NaN / undefined / null */
  const safe = (n: number | undefined | null): number =>
    n == null || Number.isNaN(n) ? 0 : n;

  // Leaderboard stats (points / won / lost) only register once a market is
  // RESOLVED and the user CLAIMS — that's when the contract awards points.
  // Until then the user's actual on-chain bets live in the `bets` array we
  // already fetched. Derive real activity from it so a user who has placed a
  // bet sees their activity immediately, instead of an all-zero profile.
  const pendingBets = bets.filter(
    (b) => !b.market.resolved && !b.market.cancelled
  ).length;
  const settledWon = safe(stats?.wonBets);
  const settledLost = safe(stats?.lostBets);
  // Total bets the user has actually placed = all markets they have a bet in.
  // Fall back to the leaderboard total if the bet scan hasn't loaded yet.
  const totalBetsPlaced = Math.max(bets.length, safe(stats?.totalBets));
  const totalStaked = bets.reduce((sum, b) => sum + safe(b.bet.amount), 0);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-2">
          Profile
        </h1>
        <p className="text-slate-400">
          Your bets, points, and referrals.
        </p>
      </div>

      {/* Stats Overview Cards */}
      <ErrorBoundary fallbackTitle="Stats failed to load">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <PointsCard
            points={safe(stats?.points)}
            winRate={safe(stats?.winRate)}
            totalBets={totalBetsPlaced}
            wonBets={settledWon}
          />
          <TokenBalance
            balance={safe(tokenData?.balance ?? profile?.tokenBalance)}
            symbol={tokenData?.info?.symbol ?? "PLSE"}
          />
          {/* Bets summary card */}
          <div className="card">
            <div className="flex items-center gap-2 mb-1">
              <FiTrendingUp className="w-4 h-4 text-primary-400" />
              <span className="text-sm text-slate-400">Bets</span>
            </div>
            <p className="text-2xl font-heading font-bold">
              {totalBetsPlaced}
            </p>
            <div className="flex gap-3 mt-1 text-xs">
              <span className="text-accent-mint">
                {settledWon} won
              </span>
              <span className="text-accent-red">
                {settledLost} lost
              </span>
              <span className="text-slate-500">
                {pendingBets} pending
              </span>
            </div>
            {totalStaked > 0 && (
              <p className="text-xs text-slate-500 mt-1">
                {totalStaked.toFixed(2)} XLM staked
              </p>
            )}
          </div>
          {/* Referral earnings card */}
          <div className="card">
            <div className="flex items-center gap-2 mb-1">
              <FiLink className="w-4 h-4 text-accent-mint" />
              <span className="text-sm text-slate-400">Referral Earnings</span>
            </div>
            <p className="text-2xl font-heading font-bold text-accent-mint">
              {referral ? safe(referral.earnings / 1e7).toFixed(2) : "0.00"} XLM
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {safe(referral?.referralCount)} referrals
            </p>
          </div>
        </div>
      </ErrorBoundary>

      {/* Bet History */}
      <ErrorBoundary fallbackTitle="Bet history failed to load">
        <div className="mb-8">
          <BetHistory bets={bets} loading={betsLoading} />
        </div>
      </ErrorBoundary>

      {/* Referral Stats */}
      <ErrorBoundary fallbackTitle="Referral section error">
        <ReferralStats />
      </ErrorBoundary>
    </div>
  );
}

