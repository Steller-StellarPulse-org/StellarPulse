import React from "react";
import type { Market } from "@/types";
import MarketCard from "./MarketCard";
import Skeleton from "@/components/ui/Skeleton";

interface MarketGridProps {
  markets: Market[];
  loading?: boolean;
}

function SkeletonCard() {
  return (
    <div className="bg-surface-card border border-surface-border rounded-2xl overflow-hidden">
      <Skeleton className="w-full aspect-video rounded-none" />
      <div className="p-4 space-y-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    </div>
  );
}

export default function MarketGrid({ markets, loading = false }: MarketGridProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (markets.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {markets.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  );
}
