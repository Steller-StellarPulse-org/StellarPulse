"use client";

import React from "react";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { FiAward } from "react-icons/fi";
import Skeleton from "@/components/ui/Skeleton";

const MEDAL_COLORS = [
  "bg-amber-500/20 text-amber-400 border-amber-500/20",
  "bg-slate-300/20 text-slate-300 border-slate-300/20",
  "bg-orange-500/20 text-orange-400 border-orange-500/20",
];

export default function LeaderboardPreview() {
  const { data: players, loading } = useLeaderboard("top_predictors");

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[140px] rounded-2xl" />
        ))}
      </div>
    );
  }

  const top3 = players.slice(0, 3);

  if (top3.length === 0) {
    return (
      <div className="card text-center py-10">
        <p className="text-slate-500">No predictors yet. Be the first!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      {top3.map((player, i) => (
        <div
          key={player.address}
          className={`card relative overflow-hidden border ${MEDAL_COLORS[i]?.split(" ").find((c) => c.startsWith("border-")) || "border-surface-border"}`}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center ${MEDAL_COLORS[i] || "bg-surface-hover text-slate-400"}`}
            >
              <FiAward className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-heading font-semibold truncate">
                {player.displayName ||
                  `${player.address.slice(0, 4)}...${player.address.slice(-4)}`}
              </p>
              <p className="text-xs text-slate-500">Rank #{i + 1}</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div>
              <span className="text-slate-500">Points</span>
              <p className="font-semibold text-primary-400">{player.points.toLocaleString()}</p>
            </div>
            <div className="text-right">
              <span className="text-slate-500">Win Rate</span>
              <p className="font-semibold text-accent-mint">{player.winRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

