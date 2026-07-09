"use client";

import React from "react";
import { FiAward, FiTrendingUp, FiUsers } from "react-icons/fi";

type Tab = "top_predictors" | "most_active" | "top_referrers";

interface LeaderboardTabsProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "top_predictors", label: "Top Predictors", icon: FiAward },
  { key: "most_active", label: "Most Active", icon: FiTrendingUp },
  { key: "top_referrers", label: "Top Referrers", icon: FiUsers },
];

export default function LeaderboardTabs({
  activeTab,
  onTabChange,
}: LeaderboardTabsProps) {
  return (
    <div className="flex gap-2 p-1 rounded-xl bg-surface-card">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              isActive
                ? "bg-primary-600 text-white shadow-lg shadow-primary-600/25"
                : "text-slate-400 hover:text-white hover:bg-surface-hover"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
