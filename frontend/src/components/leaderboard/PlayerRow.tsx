import React from "react";
import type { PlayerStats } from "@/types";
import { explorerUrl } from "@/utils/helpers";
import { formatTimeAgo } from "@/utils/date";

interface PlayerRowProps {
  player: PlayerStats;
  rank: number;
  isCurrentUser: boolean;
}

const MEDAL: Record<number, { emoji: string; bg: string }> = {
  1: { emoji: "🥇", bg: "bg-amber-500/20 text-amber-300" },
  2: { emoji: "🥈", bg: "bg-slate-300/20 text-slate-300" },
  3: { emoji: "🥉", bg: "bg-orange-500/20 text-orange-400" },
};

export default function PlayerRow({
  player,
  rank,
  isCurrentUser,
}: PlayerRowProps) {
  const medal = MEDAL[rank];
  const displayName =
    player.displayName ||
    `${player.address.slice(0, 4)}...${player.address.slice(-4)}`;

  return (
    <tr
      className={`border-b border-surface-border/50 transition-colors hover:bg-surface-hover/30 ${
        isCurrentUser ? "bg-primary-500/10" : ""
      }`}
    >
    
    <td className="py-3 pr-4">
  <div className="flex flex-col">
   
    <span className="text-white font-mono">
      {player.address.slice(0, 4)}...{player.address.slice(-4)}
    </span>
    {player.lastActive && (
      <span className="text-xs text-slate-500">
        Active {formatTimeAgo(player.lastActive)}
      </span>
    )}
    </div>
    </td>

      {/* Player */}
      <td className="py-3.5 pr-4">
        <a
          href={explorerUrl("account", player.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-primary-400 transition-colors"
        >
          <span className="font-medium">{displayName}</span>
          {isCurrentUser && (
            <span className="ml-2 text-xs text-primary-400 font-medium">(You)</span>
          )}
        </a>
      </td>

      {/* Points */}
      <td className="py-3.5 pr-4 text-right font-semibold text-primary-400">
        {player.points.toLocaleString()}
      </td>

      {/* Bets */}
      <td className="py-3.5 pr-4 text-right text-slate-400 hidden sm:table-cell">
        {player.totalBets}
      </td>

      {/* Won */}
      <td className="py-3.5 pr-4 text-right text-accent-mint hidden sm:table-cell">
        {player.wonBets}
      </td>

      {/* Win Rate */}
      <td className="py-3.5 text-right">
        <span
          className={`font-medium ${
            player.winRate >= 60
              ? "text-accent-mint"
              : player.winRate >= 40
                ? "text-slate-300"
                : "text-accent-red"
          }`}
        >
          {player.winRate.toFixed(1)}%
        </span>
      </td>
    </tr>
  );
}

