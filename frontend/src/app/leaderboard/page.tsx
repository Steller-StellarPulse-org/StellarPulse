"use client";

import React, { useState, useEffect } from "react";
import { useLeaderboard, type LeaderboardTab } from "@/hooks/useLeaderboard";
import { useWallet } from "@/hooks/useWallet";
import LeaderboardTabs from "@/components/leaderboard/LeaderboardTabs";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { FiAward } from "react-icons/fi";
import { timeAgo } from "@/utils/helpers";

export default function LeaderboardPage() {
  const [tab, setTab] = useState<LeaderboardTab>("top_predictors");
  const { data: players, loading, error } = useLeaderboard(tab);
  const { publicKey } = useWallet();
  const [lastUpdated, setLastUpdated] = useState<number>(
    Math.floor(Date.now() / 1000)
  );
  const [, forceUpdate] = useState(0);

  // Record when data last loaded
  useEffect(() => {
    if (!loading) {
      setLastUpdated(Math.floor(Date.now() / 1000));
    }
  }, [loading, tab]);

  // Re-render every 30s so the "X ago" string stays fresh
  useEffect(() => {
    const id = setInterval(() => forceUpdate((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-heading text-2xl sm:text-3xl font-bold flex items-center gap-2">
          <FiAward className="w-6 h-6 text-primary-400" />
          Leaderboard
        </h1>
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-mint opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-mint"></span>
          </span>
          <span className="text-xs text-slate-500 uppercase tracking-wider">
            Live
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <p className="text-slate-400">
          Rankings update in real-time from onchain data.
        </p>
        {!loading && (
          <p className="text-xs text-slate-500">
            Updated {timeAgo(lastUpdated)}
          </p>
        )}
      </div>

      <LeaderboardTabs activeTab={tab} onTabChange={setTab} />

      <ErrorBoundary fallbackTitle="Leaderboard failed to load">
        {loading ? (
          <div className="card space-y-4 py-8">
            <div className="animate-pulse flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-slate-700"></div>
              <div className="flex-1 h-4 bg-slate-700 rounded"></div>
              <div className="h-4 w-16 bg-slate-700 rounded"></div>
            </div>
            <div className="animate-pulse flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-slate-700"></div>
              <div className="flex-1 h-4 bg-slate-700 rounded"></div>
              <div className="h-4 w-16 bg-slate-700 rounded"></div>
            </div>
            <div className="animate-pulse flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-slate-700"></div>
              <div className="flex-1 h-4 bg-slate-700 rounded"></div>
              <div className="h-4 w-16 bg-slate-700 rounded"></div>
            </div>
          </div>
        ) : error ? (
          <div className="card text-center py-10">
            <p className="text-accent-red mb-2">Failed to load leaderboard</p>
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        ) : players.length === 0 ? (
          <EmptyState
            title="No players yet"
            description="Be the first to place a bet and climb the ranks!"
          />
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-surface-hover/50">
                  <tr>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                      Rank
                    </th>
                    <th className="text-left text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                      Player
                    </th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                      Points
                    </th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                      Win Rate
                    </th>
                    <th className="text-right text-xs font-medium text-slate-500 uppercase tracking-wider px-4 py-3">
                      Bets
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {players.map((player, index) => {
                    const isCurrentUser = player.address === publicKey;
                    return (
                      <tr
                        key={player.address}
                        className={`${
                          isCurrentUser ? "bg-primary-500/5" : ""
                        } hover:bg-surface-hover/30 transition-colors`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                              index === 0
                                ? "bg-yellow-500/20 text-yellow-400"
                                : index === 1
                                ? "bg-slate-400/20 text-slate-300"
                                : index === 2
                                ? "bg-amber-700/20 text-amber-600"
                                : "text-slate-500"
                            }`}
                          >
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm">
                              {player.displayName || truncateAddress(player.address)}
                            </span>
                            {isCurrentUser && (
                              <span className="text-[10px] font-medium bg-primary-500/20 text-primary-300 px-2 py-0.5 rounded-full">
                                You
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right font-bold">
                          {player.points.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right">
                          <span
                            className={
                              player.winRate >= 50
                                ? "text-accent-mint"
                                : "text-accent-red"
                            }
                          >
                            {player.winRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-right text-slate-400">
                          {player.totalBets}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </ErrorBoundary>
    </div>
  );
}

// Helper function used inside the component
function truncateAddress(addr: string): string {
  if (!addr || addr.length <= 10) return addr;
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}
