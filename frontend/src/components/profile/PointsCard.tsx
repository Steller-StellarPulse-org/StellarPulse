import React from "react";
import { FiAward, FiTrendingUp } from "react-icons/fi";

interface PointsCardProps {
  points: number;
  /** Win rate as a percentage (0–100). Shown under the points total. */
  winRate: number;
  totalBets?: number;
  wonBets?: number;
}

/** Return 0 for NaN / undefined / null */
function safe(n: number | undefined | null): number {
  if (n == null || Number.isNaN(n)) return 0;
  return n;
}

export default function PointsCard({ points, winRate, totalBets, wonBets }: PointsCardProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary-500/20 bg-gradient-to-br from-primary-500/10 via-surface-card to-surface-card p-6">
      {/* Glow accent */}
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-primary-500/10 rounded-full blur-2xl" />

      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <FiAward className="w-4 h-4 text-primary-400" />
            <span className="text-sm text-slate-400">Prediction Points</span>
          </div>
          <p className="text-3xl font-heading font-bold text-white">
            {safe(points).toLocaleString()}
          </p>
          <p className="text-sm text-primary-400 mt-1 font-medium">
            {safe(winRate).toFixed(0)}% win rate
          </p>
        </div>

        <div className="text-right space-y-1">
          {totalBets !== undefined && (
            <div>
              <span className="text-xs text-slate-500">Total Bets</span>
              <p className="text-sm font-semibold text-slate-300">{safe(totalBets)}</p>
            </div>
          )}
          {wonBets !== undefined && (
            <div>
              <div className="flex items-center gap-1 justify-end">
                <FiTrendingUp className="w-3 h-3 text-accent-mint" />
                <span className="text-xs text-slate-500">Won</span>
              </div>
              <p className="text-sm font-semibold text-accent-mint">{safe(wonBets)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

