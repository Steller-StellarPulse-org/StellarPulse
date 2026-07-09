"use client";

import React, { useState, useEffect, useRef } from "react";
import { FiSearch, FiChevronDown } from "react-icons/fi";
import type { MarketFilter, MarketSort } from "@/types";

const STATUS_FILTERS: { value: MarketFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "ending_soon", label: "Ending Soon" },
  { value: "ended", label: "Ended" },
  { value: "resolved", label: "Resolved" },
  { value: "cancelled", label: "Cancelled" },
];

const CATEGORY_FILTERS: { value: MarketFilter; label: string }[] = [
  { value: "crypto", label: "Crypto" },
  { value: "sports", label: "Sports" },
  { value: "politics", label: "Politics" },
  { value: "entertainment", label: "Entertainment" },
  { value: "science", label: "Science" },
];

const SORTS: { value: MarketSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "volume", label: "Most Volume" },
  { value: "ending_soon", label: "Ending Soon" },
  { value: "bettors", label: "Most Bettors" },
];

interface MarketFiltersProps {
  activeFilter: MarketFilter;
  activeSort: MarketSort;
  onFilterChange: (filter: MarketFilter) => void;
  onSortChange: (sort: MarketSort) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function MarketFilters({
  activeFilter,
  activeSort,
  onFilterChange,
  onSortChange,
  searchQuery,
  onSearchChange,
}: MarketFiltersProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearchChange(localSearch);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [localSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const activeSortLabel = SORTS.find((s) => s.value === activeSort)?.label ?? "Sort";

  return (
    <div className="space-y-3">
      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              activeFilter === f.value
                ? "bg-primary-600 text-white shadow-md shadow-primary-600/25"
                : "bg-surface-card border border-surface-border text-slate-400 hover:text-white hover:border-primary-600/50"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-slate-600 font-medium mr-1">Category:</span>
        {CATEGORY_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(activeFilter === f.value ? "all" : f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
              activeFilter === f.value
                ? "bg-primary-600/80 text-white border border-primary-600/50"
                : "bg-surface-card border border-surface-border text-slate-500 hover:text-white hover:border-primary-600/30"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Search + Sort row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search markets..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-card border border-surface-border text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary-600/50 focus:ring-1 focus:ring-primary-600/25 transition-all"
          />
        </div>

        <div ref={sortRef} className="relative">
          <button
            onClick={() => setSortOpen((p) => !p)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-card border border-surface-border text-sm font-medium text-slate-300 hover:border-primary-600/50 transition-colors w-full sm:w-auto justify-between sm:justify-start"
          >
            {activeSortLabel}
            <FiChevronDown
              className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
                sortOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {sortOpen && (
            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-surface-card border border-surface-border shadow-xl shadow-black/40 overflow-hidden z-20">
              {SORTS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => {
                    onSortChange(s.value);
                    setSortOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                    activeSort === s.value
                      ? "bg-primary-600/15 text-primary-400 font-medium"
                      : "text-slate-400 hover:bg-surface-hover hover:text-white"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
