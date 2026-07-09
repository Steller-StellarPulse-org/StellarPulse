import React from "react";
import type { PlayerStats } from "@/types";
import PlayerRow from "./PlayerRow";
import { FiUser } from "react-icons/fi";

interface LeaderboardTableProps {
  players: PlayerStats[];
  currentUser?: string;
}

export default function LeaderboardTable({
  players,
  currentUser,
}: LeaderboardTableProps) {
  const currentUserPlayer = currentUser
    ? players.find((p) => p.address === currentUser)
    : undefined;
  const currentUserRank = currentUserPlayer
    ? players.indexOf(currentUserPlayer) + 1
    : undefined;

  return (
    <div>
      {/* Pinned "Your Rank" card */}
      {currentUserPlayer && currentUserRank && (
        <div className="mb-4 p-4 rounded-xl border border-primary-500/30 bg-primary-500/5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center">
                <FiUser className="w-4 h-4 text-primary-400" />
              </div>
              <div>
                <span className="text-sm text-slate-400">Your Rank</span>
                <p className="font-heading font-bold text-lg text-white">#{currentUserRank}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-sm text-slate-400">Points</span>
              <p className="font-heading font-bold text-lg text-primary-400">
                {currentUserPlayer.points.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-surface-border">
              <th className="pb-3 pr-4 w-14">#</th>
              <th className="pb-3 pr-4">Player</th>
              <th className="pb-3 pr-4 text-right">Points</th>
              <th className="pb-3 pr-4 text-right hidden sm:table-cell">Bets</th>
              <th className="pb-3 pr-4 text-right hidden sm:table-cell">Won</th>
              <th className="pb-3 text-right">Win Rate</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player, index) => (
              <PlayerRow
                key={player.address}
                player={player}
                rank={index + 1}
                isCurrentUser={player.address === currentUser}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
