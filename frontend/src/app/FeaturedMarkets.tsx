"use client";

import React from "react";
import { useMarkets } from "@/hooks/useMarkets";
import MarketCard from "@/components/market/MarketCard";
import Skeleton from "@/components/ui/Skeleton";

export default function FeaturedMarkets() {
  const { data: markets, loading } = useMarkets("active", "volume");

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[280px] rounded-2xl" />
        ))}
      </div>
    );
  }

  const featured = markets.slice(0, 3);

  if (featured.length === 0) {
    return (
      <div className="card text-center py-10">
        <p className="text-slate-500">No active markets yet. Check back soon!</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {featured.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  );
}
