"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useMarket } from "@/hooks/useMarket";
import { useClaim } from "@/hooks/useClaim";
import { useWallet } from "@/hooks/useWallet";
import { useToken } from "@/hooks/useToken";
import { pollMarketEvents } from "@/services/events";
import { getXlmBalance } from "@/services/soroban";
import { displayXLM, formatXLM, calculatePayout, truncateAddress } from "@/utils/helpers";
import {
  WIN_POINTS,
  LOSE_POINTS,
  WIN_TOKENS,
  LOSE_TOKENS,
} from "@/config/network";
import MarketImage from "@/components/market/MarketImage";
import OddsBar from "@/components/market/OddsBar";
import BettingPanel from "@/components/market/BettingPanel";
import CountdownTimer from "@/components/market/CountdownTimer";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import TxProgress from "@/components/ui/TxProgress";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import Button from "@/components/ui/Button";
import type { MarketEvent } from "@/types";
import { FiClock, FiUsers, FiTrendingUp, FiAward, FiArrowLeft } from "react-icons/fi";
import Link from "next/link";

function getStatusBadge(market: { resolved: boolean; outcome: boolean; cancelled: boolean }) {
  if (market.cancelled) return { variant: "cancelled" as const, label: "Cancelled" };
  if (market.resolved) return market.outcome
    ? { variant: "won" as const, label: "Resolved YES" }
    : { variant: "lost" as const, label: "Resolved NO" };
  return { variant: "active" as const, label: "Active" };
}

export default function MarketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const marketId = Number(params.id);
  const { market, userBet, loading, error, refetch } = useMarket(marketId);
  const { publicKey } = useWallet();
  const { data: tokenData } = useToken(publicKey ?? undefined);
  const { submit: claimReward, loading: claiming, stage: claimStage, error: claimError, reset: resetClaim } = useClaim();

  const [events, setEvents] = useState<MarketEvent[]>([]);
  const [xlmBalance, setXlmBalance] = useState(0);

  // Fetch native XLM balance for betting
  useEffect(() => {
    if (!publicKey) {
      setXlmBalance(0);
      return;
    }
    let mounted = true;
    getXlmBalance(publicKey).then((bal) => {
      if (mounted) setXlmBalance(bal);
    });
    return () => { mounted = false; };
  }, [publicKey]);

  // Fetch events
  useEffect(() => {
    let mounted = true;
    pollMarketEvents().then((evts) => {
      if (mounted) setEvents(evts.filter((e) => e.marketId === marketId).slice(0, 10));
    }).catch(() => { });
    return () => { mounted = false; };
  }, [marketId]);

  const handleClaim = useCallback(async () => {
    await claimReward(marketId);
    refetch();
  }, [claimReward, marketId, refetch]);

  const balance = xlmBalance;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 space-y-6">
        <Skeleton width="6rem" height="1rem" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <Skeleton height="14rem" className="rounded-2xl" />
            <Skeleton height="2rem" width="70%" />
            <Skeleton height="1.5rem" className="rounded-full" />
            <div className="grid grid-cols-3 gap-3">
              <Skeleton height="4rem" className="rounded-xl" />
              <Skeleton height="4rem" className="rounded-xl" />
              <Skeleton height="4rem" className="rounded-xl" />
            </div>
          </div>
          <div className="space-y-4">
            <Skeleton height="16rem" className="rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="card text-center py-10">
          <p className="text-accent-red mb-2">Failed to load market</p>
          <p className="text-sm text-slate-500">{error || "Market not found"}</p>
          <Link href="/markets" className="btn-secondary text-sm mt-4 inline-flex items-center gap-2">
            <FiArrowLeft className="w-4 h-4" /> Back to Markets
          </Link>
        </div>
      </div>
    );
  }

  const status = getStatusBadge(market);
  const totalPool = market.totalYes + market.totalNo;
  const yesPercent = totalPool > 0 ? Math.round((market.totalYes / totalPool) * 100) : 50;
  const noPercent = 100 - yesPercent;

  // Claim logic
  const isResolved = market.resolved || market.cancelled;
  const hasBet = !!userBet;
  const won = market.resolved && userBet ? market.outcome === userBet.isYes : false;
  const canClaim = hasBet && isResolved && !userBet!.claimed;

  const winnerPayout = won && userBet
    ? calculatePayout(
      userBet.amount,
      userBet.isYes ? market.totalYes : market.totalNo,
      totalPool
    )
    : 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* Back nav */}
      <Link
        href="/markets"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-6"
      >
        <FiArrowLeft className="w-4 h-4" /> All Markets
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Market info */}
        <div className="lg:col-span-2 space-y-6">
          <ErrorBoundary fallbackTitle="Market info failed to load">
            {/* Header */}
            <div className="card overflow-hidden p-0">
              <div className="relative h-48 sm:h-64">
                <MarketImage
                  src={market.imageUrl}
                  alt={market.question}
                  className="w-full h-full"
                  rounded="top"
                />
                <div className="absolute top-4 left-4">
                  <Badge variant={status.variant} showIcon>
                    {status.label}
                  </Badge>
                </div>
              </div>
              <div className="p-6">
                <h1 className="font-heading text-2xl sm:text-3xl font-bold mb-4">
                  {market.question}
                </h1>

                {/* Countdown */}
                {!market.resolved && !market.cancelled && (
                  <div className="flex items-center gap-2 mb-4">
                    <FiClock className="w-4 h-4 text-slate-400" />
                    <CountdownTimer endTime={market.endTime} />
                  </div>
                )}

                {/* Odds */}
                <OddsBar
                  yesPercent={yesPercent}
                  noPercent={noPercent}
                  size="lg"
                  showLabels
                />
              </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card py-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Total Pool</p>
                <p className="font-heading font-bold">{displayXLM(totalPool)}</p>
              </div>
              <div className="card py-4 text-center">
                <p className="text-xs text-slate-500 mb-1">YES Pool</p>
                <p className="font-heading font-bold text-accent-mint">{displayXLM(market.totalYes)}</p>
              </div>
              <div className="card py-4 text-center">
                <p className="text-xs text-slate-500 mb-1">NO Pool</p>
                <p className="font-heading font-bold text-accent-red">{displayXLM(market.totalNo)}</p>
              </div>
              <div className="card py-4 text-center">
                <p className="text-xs text-slate-500 mb-1">Bettors</p>
                <p className="font-heading font-bold flex items-center justify-center gap-1">
                  <FiUsers className="w-4 h-4 text-slate-500" /> {market.betCount}
                </p>
              </div>
            </div>
          </ErrorBoundary>

          {/* User's existing bet */}
          {userBet && (
              <div className="card border-primary-500/20">
              <div className="flex items-center gap-2 mb-2">
                <FiTrendingUp className="w-4 h-4 text-primary-400" />
                <span className="text-sm text-slate-400">Your Position</span>
              </div>
              <p className="font-heading font-semibold">
                {displayXLM(userBet.amount)} on{" "}
                <span className={userBet.isYes ? "text-accent-mint" : "text-accent-red"}>
                  {userBet.isYes ? "YES" : "NO"}
                </span>
              </p>
            </div>
          )}

          {/* Claim Section */}
          {canClaim && (
            <ErrorBoundary fallbackTitle="Claim section error">
              <div className={`card border ${won ? "border-accent-mint/30 bg-accent-mint/5" : market.cancelled ? "border-primary-500/30" : "border-accent-red/30 bg-accent-red/5"}`}>
                <div className="flex items-center gap-2 mb-3">
                  <FiAward className="w-5 h-5 text-primary-400" />
                  <h3 className="font-heading font-semibold text-lg">
                    {market.cancelled
                      ? "Market Cancelled — Claim Refund"
                      : won
                        ? "You Won!"
                        : "You Lost — Claim Consolation"}
                  </h3>
                </div>

                {/* Reward breakdown */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                  {winnerPayout > 0 && (
                    <div className="p-3 rounded-xl bg-surface-hover/50">
                      <span className="text-xs text-slate-500">XLM Payout</span>
                      <p className="font-semibold text-accent-mint">
                        {displayXLM(winnerPayout)}
                      </p>
                    </div>
                  )}
                  {market.cancelled && userBet && (
                    <div className="p-3 rounded-xl bg-surface-hover/50">
                      <span className="text-xs text-slate-500">XLM Refund</span>
                      <p className="font-semibold text-accent-mint">
                        {displayXLM(userBet.amount)}
                      </p>
                    </div>
                  )}
                  <div className="p-3 rounded-xl bg-surface-hover/50">
                    <span className="text-xs text-slate-500">Points</span>
                    <p className="font-semibold text-primary-400">
                      +{won ? WIN_POINTS : LOSE_POINTS}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-hover/50">
                    <span className="text-xs text-slate-500">PULSE</span>
                    <p className="font-semibold text-primary-400">
                      +{won ? WIN_TOKENS : LOSE_TOKENS}
                    </p>
                  </div>
                </div>

                {claiming ? (
                  <TxProgress step={claimStage === "idle" ? "building" : claimStage} />
                ) : (
                  <Button onClick={handleClaim} variant="primary" fullWidth>
                    Claim Rewards
                  </Button>
                )}
                {claimError && (
                  <p className="text-sm text-accent-red mt-2">{claimError}</p>
                )}
              </div>
            </ErrorBoundary>
          )}

          {/* Already claimed */}
          {userBet?.claimed && (
            <div className="card border-primary-500/10 text-center py-8">
              <FiAward className="w-8 h-8 text-primary-400 mx-auto mb-2" />
              <p className="text-slate-400">Rewards already claimed</p>
            </div>
          )}

          {/* Activity Feed */}
          {events.length > 0 && (
            <div className="card">
              <h3 className="font-heading font-semibold mb-4">Recent Activity</h3>
              <div className="space-y-3">
                {events.map((evt, i) => (
                  <div key={`${evt.txHash}-${i}`} className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center shrink-0">
                      {evt.type === "bet_placed" ? (
                        <FiTrendingUp className="w-3.5 h-3.5 text-primary-400" />
                      ) : (
                        <FiAward className="w-3.5 h-3.5 text-accent-mint" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-slate-300">{truncateAddress(evt.user)}</span>{" "}
                      <span className="text-slate-500">
                        {evt.type === "bet_placed"
                          ? `bet ${evt.amount ? formatXLM(BigInt(evt.amount)) : ""}`
                          : evt.type === "reward_claimed"
                            ? "claimed reward"
                            : evt.type.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span className="text-xs text-slate-600 shrink-0">
                      {new Date(evt.timestamp * 1000).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right: Betting Panel */}
        <div className="lg:col-span-1">
          <ErrorBoundary fallbackTitle="Betting panel error">
            <div className="lg:sticky lg:top-24">
              <BettingPanel
                market={market}
                userBet={userBet}
                balance={balance}
                onSuccess={() => {
                  refetch();
                  // Refresh XLM balance after bet
                  if (publicKey) {
                    getXlmBalance(publicKey).then(setXlmBalance);
                  }
                }}
              />
            </div>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
}
