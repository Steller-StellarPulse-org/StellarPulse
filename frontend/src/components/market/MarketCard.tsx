import React from "react";
import Link from "next/link";
import type { Market } from "@/types";
import { calculateOdds } from "@/utils/helpers";
import { FiUsers, FiTrendingUp, FiAlertTriangle } from "react-icons/fi";
import MarketImage from "./MarketImage";
import OddsBar from "./OddsBar";
import CountdownTimer from "./CountdownTimer";
import Badge from "@/components/ui/Badge";

interface MarketCardProps {
  market: Market;
}

const CATEGORY_COLORS: Record<string, string> = {
  Crypto:        "bg-amber-500/15 text-amber-400",
  Sports:        "bg-blue-500/15 text-blue-400",
  Politics:      "bg-purple-500/15 text-purple-400",
  Entertainment: "bg-pink-500/15 text-pink-400",
  Science:       "bg-cyan-500/15 text-cyan-400",
  Other:         "bg-slate-500/15 text-slate-400",
};

function getStatusBadge(market: Market) {
  if (market.cancelled) return { variant: "cancelled" as const, label: "Cancelled" };
  if (market.resolved) return { variant: "resolved" as const, label: market.outcome ? "Resolved YES" : "Resolved NO" };
  const now = Math.floor(Date.now() / 1000);
  if (market.endTime > now) return { variant: "active" as const, label: "Active" };
  return { variant: "cancelled" as const, label: "Ended" };
}

function isEndingSoon(endTime: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  return endTime > now && endTime - now < 3600 * 6; // less than 6 hours
}

export default function MarketCard({ market }: MarketCardProps) {
  const { yesPercent, noPercent } = calculateOdds(market.totalYes, market.totalNo);
  const totalPool = market.totalYes + market.totalNo;
  const status = getStatusBadge(market);
  const endingSoon = isEndingSoon(market.endTime);
  const catColor = CATEGORY_COLORS[market.category] ?? CATEGORY_COLORS.Other;

  return (
    <Link
      href={`/markets/${market.id}`}
      className="group block bg-surface-card border border-surface-border rounded-2xl overflow-hidden hover:border-primary-500/50 hover:shadow-lg hover:shadow-primary-500/5 transition-all duration-300 hover:-translate-y-0.5"
    >
      {/* Image with status overlay */}
      <div className="relative">
        <MarketImage
          src={market.imageUrl}
          alt={market.question}
          rounded="top"
        />
        <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1 max-w-[70%]">
          <Badge variant={status.variant}>{status.label}</Badge>
          {endingSoon && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-semibold">
              <FiAlertTriangle className="w-2.5 h-2.5" />
              Closing Soon
            </span>
          )}
        </div>
        {/* Category badge */}
        <div className="absolute top-3 right-3">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${catColor}`}>
            {market.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4 space-y-3">
        <h3 className="font-heading font-semibold text-sm text-slate-100 leading-snug line-clamp-2 group-hover:text-white transition-colors">
          {market.question}
        </h3>

        <OddsBar yesPercent={yesPercent} noPercent={noPercent} />

        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-slate-500">
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center gap-1">
              <FiTrendingUp className="w-3.5 h-3.5 shrink-0" />
              {totalPool.toFixed(1)} XLM
            </span>
            <span className="inline-flex items-center gap-1">
              <FiUsers className="w-3.5 h-3.5 shrink-0" />
              {market.betCount}
            </span>
          </div>
          <span className="shrink-0 tabular-nums">
            <CountdownTimer endTime={market.endTime} />
          </span>
        </div>
      </div>
    </Link>
  );
}
