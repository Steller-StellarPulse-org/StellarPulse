"use client";

import React, { useRef } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { useToken } from "@/hooks/useToken";
import Skeleton from "@/components/ui/Skeleton";

export default function LiveStats() {
  const { data: markets, loading: ml } = useMarkets();
  const { data: players, loading: pl } = useLeaderboard("top_predictors");
  const { data: tokenData, loading: tl } = useToken();

  // Only show skeleton on the very first load — once data arrives, keep showing it
  const hasMounted = useRef(false);

  const totalMarkets = markets.length;
  // totalYes and totalNo are already in XLM (converted via stroopsToXlm in parseMarket)
  const totalVolume = markets.reduce(
    (sum, m) => sum + (m.totalYes || 0) + (m.totalNo || 0),
    0
  );
  const totalPredictors = players.length;
  // totalSupply is in raw token units (7 decimals) — convert to human-readable
  const totalMinted = (tokenData?.info?.totalSupply ?? 0) / 1e7;

  // After first successful data, never show skeleton again
  const hasData = totalMarkets > 0 || totalPredictors > 0 || totalMinted > 0;
  if (hasData) hasMounted.current = true;

  const showSkeleton = (ml || pl || tl) && !hasMounted.current;

  if (showSkeleton) {
    return (
      <div className="flex flex-wrap items-center justify-center gap-6">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-32 rounded-xl" />
        ))}
      </div>
    );
  }

  const stats = [
    { label: "Total Markets", value: totalMarkets.toString() },
    { label: "Total Volume", value: `${totalVolume.toFixed(2)} XLM` },
    { label: "Total Predictors", value: totalPredictors.toString() },
    { label: "PULSE Minted", value: `${totalMinted.toLocaleString(undefined, { maximumFractionDigits: 0 })} PLSE` },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
      {stats.map((s) => (
        <div key={s.label} className="text-center">
          <p className="font-heading text-xl font-bold text-white">{s.value}</p>
          <p className="text-xs text-slate-500">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
