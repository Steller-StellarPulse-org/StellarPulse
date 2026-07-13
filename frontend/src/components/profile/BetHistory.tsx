"use client";

import React from "react";
import type { Market, Bet } from "@/types";
import { useClaim } from "@/hooks/useClaim";
import { useToast } from "@/hooks/useToast";
import { displayXLM, calculatePayout } from "@/utils/helpers";
import Badge from "@/components/ui/Badge";
import TxProgress from "@/components/ui/TxProgress";
import Spinner from "@/components/ui/Spinner";
import EmptyState from "@/components/ui/EmptyState";
import { FiFileText } from "react-icons/fi";

interface BetHistoryItem {
  market: Market;
  bet: Bet;
}

interface BetHistoryProps {
  bets: BetHistoryItem[];
  loading?: boolean;
}

function getOutcomeStatus(market: Market, bet: Bet) {
  if (market.cancelled) return { label: "Cancelled", variant: "cancelled" as const };
  if (!market.resolved) return { label: "Pending", variant: "pending" as const };
  const won = market.outcome === bet.isYes;
  return won
    ? { label: "Won", variant: "won" as const }
    : { label: "Lost", variant: "lost" as const };
}

export default function BetHistory({ bets, loading }: BetHistoryProps) {
  const { submit, loading: claiming, stage, error, reset } = useClaim();
  const { showToast } = useToast();
  const [claimingId, setClaimingId] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (stage === "confirmed") {
      showToast("Payout claimed successfully!", "success");
    } else if (stage === "failed" && error) {
      showToast(error, "error");
    }
  }, [stage, error, showToast]);

  const handleClaim = async (marketId: number) => {
    // Guard against double-clicks / re-entry while a claim tx is already
    // pending — `claiming` is shared hook state and can only track one tx.
    if (claiming) return;
    setClaimingId(marketId);
    await submit(marketId);
  };

  if (loading) {
    return (
      <div className="card">
        <h3 className="font-heading font-semibold mb-4">Bet History</h3>
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="font-heading font-semibold text-lg mb-4">Bet History</h3>

      {bets.length === 0 ? (
        <EmptyState
          title="No bets yet"
          description="Place your first prediction to get started!"
          icon={FiFileText}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b border-surface-border">
                <th className="pb-3 pr-4">Market</th>
                <th className="pb-3 pr-4">Side</th>
                <th className="pb-3 pr-4 text-right">Amount</th>
                <th className="pb-3 pr-4">Outcome</th>
                <th className="pb-3 pr-4 text-right">Payout</th>
                <th className="pb-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {bets.map(({ market, bet }) => {
                const status = getOutcomeStatus(market, bet);
                const won = market.resolved && market.outcome === bet.isYes;
                const payout = won
                  ? calculatePayout(
                      bet.amount,
                      bet.isYes ? market.totalYes : market.totalNo,
                      market.totalYes + market.totalNo
                    )
                  : 0;
                const canClaim =
                  (won || market.cancelled) && !bet.claimed && market.resolved || market.cancelled;
                const isThisClaiming = claimingId === market.id && claiming;

                return (
                  <tr
                    key={market.id}
                    className="border-b border-surface-border/50 hover:bg-surface-hover/20"
                  >
                    <td className="py-3 pr-4 max-w-[200px]">
                      <span className="line-clamp-1">{market.question}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`font-medium ${
                          bet.isYes ? "text-accent-mint" : "text-accent-red"
                        }`}
                      >
                        {bet.isYes ? "YES" : "NO"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {displayXLM(bet.amount)}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge variant={status.variant} showIcon>
                        {status.label}
                      </Badge>
                    </td>
                    <td className="py-3 pr-4 text-right">
                      {payout > 0 ? (
                        <span className="text-accent-mint font-medium">
                          +{displayXLM(payout)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      {isThisClaiming ? (
                        <TxProgress step={stage === "idle" ? "building" : stage} />
                      ) : canClaim && !bet.claimed ? (
                        <button
                          onClick={() => handleClaim(market.id)}
                          disabled={claiming}
                          aria-busy={isThisClaiming}
                          className="btn-primary text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Claim
                        </button>
                      ) : bet.claimed ? (
                        <span className="text-xs text-slate-500">Claimed</span>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

