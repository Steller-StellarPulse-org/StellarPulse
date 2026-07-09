"use client";

import React, { useState, useMemo } from "react";
import { useMarkets } from "@/hooks/useMarkets";
import MarketFilters from "@/components/market/MarketFilters";
import MarketGrid from "@/components/market/MarketGrid";
import EmptyState from "@/components/ui/EmptyState";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import type { MarketFilter, MarketSort } from "@/types";
import { FiSearch } from "react-icons/fi";

export default function MarketsPage() {
  const [filter, setFilter] = useState<MarketFilter>("active");
  const [sort, setSort] = useState<MarketSort>("newest");
  const [search, setSearch] = useState("");

  const { data: markets, loading, error } = useMarkets(filter, sort);

  const filtered = useMemo(() => {
    if (!search.trim()) return markets;
    const q = search.toLowerCase();
    return markets.filter((m) => m.question.toLowerCase().includes(q));
  }, [markets, search]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-2">
          Markets
        </h1>
        <p className="text-slate-400">
          Browse active prediction markets and place your bets.
        </p>
      </div>

      {/* Filters */}
      <ErrorBoundary fallbackTitle="Filters failed to load">
        <div className="mb-8">
          <MarketFilters
            activeFilter={filter}
            activeSort={sort}
            onFilterChange={setFilter}
            onSortChange={setSort}
            searchQuery={search}
            onSearchChange={setSearch}
          />
        </div>
      </ErrorBoundary>

      {/* Grid */}
      <ErrorBoundary fallbackTitle="Failed to load markets">
        {error ? (
          <div className="card text-center py-10">
            <p className="text-accent-red mb-2">Failed to load markets</p>
            <p className="text-sm text-slate-500">{error}</p>
          </div>
        ) : !loading && filtered.length === 0 ? (
          <EmptyState
            title="No markets found"
            description={
              search
                ? `No markets match "${search}". Try a different search.`
                : "No markets in this category yet."
            }
            icon={FiSearch}
            action={
              search
                ? { label: "Clear Search", onClick: () => setSearch("") }
                : undefined
            }
          />
        ) : (
          <MarketGrid markets={filtered} loading={loading} />
        )}
      </ErrorBoundary>
    </div>
  );
}
