"use client";

import React, { useState } from "react";
import { useLeaderboard, type LeaderboardTab } from "@/hooks/useLeaderboard";
import { useWallet } from "@/hooks/useWallet";
import LeaderboardTabs from "@/components/leaderboard/LeaderboardTabs";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { formatDate } from "@/utils/helpers";
import { FiAward } from "react-icons/fi";

export default function LeaderboardPage() {
  const [tab, setTab] = useState<LeaderboardTab>("top_predictors");
  const { data: players, loading, error, lastUpdated } = useLeaderboard(tab);
  const { publicKey } = useWallet();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold">
            Leaderboard
          </h1>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent-mint/10 border border-accent-mint/20 text-xs font-medium text-accent-mint">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-mint animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-slate-400">
            Rankings update in real-time from onchain data.
          </p>
          {lastUpdated && (
            <p className="text-xs text-slate-500">
              Last updated: {formatDate(lastUpdated)}
            </p>
          )}
        </div>
      </div>

      <div className="mb-6">
        <LeaderboardTabs
          activeTab={tab}
          onTabChange={(nextTab) => setTab(nextTab as LeaderboardTab)}
        />
      </div>

      <ErrorBoundary fallbackTitle="Leaderboard failed to load">
        {loading ? (
          <div className="card space-y-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="flex items-center gap-4">
                <Skeleton
                  width="2rem"
                  height="2rem"
                  className="rounded-full shrink-0"
                />
                <Skeleton className="flex-1" height="1rem" />
                <Skeleton width="4rem" height="1rem" />
                <Skeleton width="3rem" height="1rem" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="card text-center py-10">
            <p className="text-accent-red mb-2">Failed to load leaderboard</p>
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        ) : players.length === 0 ? (
          <EmptyState
            title="No rankings yet"
            description="Be the first to place a prediction and claim the top spot!"
            icon={FiAward}
          />
        ) : (
          <div className="card">
            <LeaderboardTable
              players={players}
              currentUser={publicKey ?? undefined}
            />
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}
