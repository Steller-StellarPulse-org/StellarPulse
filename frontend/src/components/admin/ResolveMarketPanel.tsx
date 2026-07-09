"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useToast } from "@/hooks/useToast";
import { getMarkets, resolveMarket, cancelMarket } from "@/services/market";
import type { Market } from "@/types";
import type { TxStage } from "@/hooks/useClaim";
import Spinner from "@/components/ui/Spinner";
import TxProgress from "@/components/ui/TxProgress";
import EmptyState from "@/components/ui/EmptyState";
import { FiCheck, FiX, FiClock } from "react-icons/fi";
import { timeUntil } from "@/utils/helpers";

export default function ResolveMarketPanel() {
  const { publicKey, signTransaction } = useWallet();
  const { showToast } = useToast();
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Per-market tx state
  const [txState, setTxState] = useState<Record<number, { stage: TxStage; error?: string }>>({});

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all = await getMarkets();
      // Show unresolved & uncancelled markets (both active and past deadline)
      const pending = all.filter((m) => !m.resolved && !m.cancelled);
      setMarkets(pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load markets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  const handleResolve = useCallback(
    async (marketId: number, outcome: boolean) => {
      if (!publicKey) return;
      setTxState((prev) => ({ ...prev, [marketId]: { stage: "signing" } }));
      try {
        const result = await resolveMarket(publicKey, marketId, outcome, signTransaction);
        if (result.success) {
          setTxState((prev) => ({ ...prev, [marketId]: { stage: "confirmed" } }));
          showToast(`Market resolved as ${outcome ? "YES" : "NO"}`, "success");
          // Remove from list after short delay
          setTimeout(() => {
            setMarkets((prev) => prev.filter((m) => m.id !== marketId));
            setTxState((prev) => {
              const next = { ...prev };
              delete next[marketId];
              return next;
            });
          }, 2000);
        } else {
          const msg = result.error || "Failed to resolve market";
          setTxState((prev) => ({
            ...prev,
            [marketId]: { stage: "failed", error: msg },
          }));
          showToast(msg, "error");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setTxState((prev) => ({
          ...prev,
          [marketId]: {
            stage: "failed",
            error: msg,
          },
        }));
        showToast(msg, "error");
      }
    },
    [publicKey, signTransaction, showToast]
  );

  const handleCancel = useCallback(
    async (marketId: number) => {
      if (!publicKey) return;
      setTxState((prev) => ({ ...prev, [marketId]: { stage: "signing" } }));
      try {
        const result = await cancelMarket(publicKey, marketId, signTransaction);
        if (result.success) {
          setTxState((prev) => ({ ...prev, [marketId]: { stage: "confirmed" } }));
          showToast("Market cancelled", "success");
          setTimeout(() => {
            setMarkets((prev) => prev.filter((m) => m.id !== marketId));
          }, 2000);
        } else {
          const msg = result.error || "Failed to cancel market";
          setTxState((prev) => ({
            ...prev,
            [marketId]: { stage: "failed", error: msg },
          }));
          showToast(msg, "error");
        }
      } catch (err) {
        setTxState((prev) => ({
          ...prev,
          [marketId]: {
            stage: "failed",
            error: err instanceof Error ? err.message : "Unknown error",
          },
        }));
      }
    },
    [publicKey, signTransaction]
  );

  if (loading) {
    return (
      <div className="card">
        <h3 className="font-heading font-semibold text-lg mb-4">Pending Resolutions</h3>
        <div className="flex justify-center py-8">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-heading font-semibold text-lg">Pending Resolutions</h3>
        <button
          onClick={fetchMarkets}
          className="text-xs text-primary-400 hover:text-primary-300 transition-colors"
        >
          Refresh
        </button>
      </div>

      {error && <p className="text-sm text-accent-red mb-4">{error}</p>}

      {markets.length === 0 ? (
        <EmptyState
          title="No pending markets"
          description="All markets have been resolved."
          icon={FiCheck}
        />
      ) : (
        <div className="space-y-3">
          {markets.map((market) => {
            const isPast = Date.now() > market.endTime * 1000;
            const mTx = txState[market.id];
            const isProcessing =
              mTx && mTx.stage !== "idle" && mTx.stage !== "confirmed" && mTx.stage !== "failed";

            return (
              <div
                key={market.id}
                className="p-4 rounded-xl border border-surface-border bg-surface-hover/20"
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-2">{market.question}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <FiClock className="w-3 h-3" />
                        {isPast ? "Ended" : timeUntil(market.endTime)}
                      </span>
                      <span>
                        {market.betCount} bet{market.betCount !== 1 ? "s" : ""}
                      </span>
                      <span>
                        {(market.totalYes + market.totalNo).toFixed(1)} XLM
                      </span>
                    </div>
                  </div>

                  {!isPast && (
                    <span className="px-2 py-0.5 rounded-md bg-yellow-500/15 text-yellow-400 text-xs font-medium shrink-0">
                      Active
                    </span>
                  )}
                </div>

                {/* Tx status */}
                {mTx && mTx.stage !== "idle" && (
                  <div className="mb-3">
                    <TxProgress step={mTx.stage} />
                    {mTx.error && (
                      <p className="text-xs text-accent-red mt-1">{mTx.error}</p>
                    )}
                  </div>
                )}

                {/* Actions (only for past-deadline markets) */}
                {isPast && !isProcessing && mTx?.stage !== "confirmed" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleResolve(market.id, true)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent-mint/10 border border-accent-mint/20 text-accent-mint text-sm font-medium hover:bg-accent-mint/20 transition-colors"
                    >
                      <FiCheck className="w-4 h-4" />
                      YES
                    </button>
                    <button
                      onClick={() => handleResolve(market.id, false)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-accent-red/10 border border-accent-red/20 text-accent-red text-sm font-medium hover:bg-accent-red/20 transition-colors"
                    >
                      <FiX className="w-4 h-4" />
                      NO
                    </button>
                    <button
                      onClick={() => handleCancel(market.id)}
                      className="px-3 py-2 rounded-lg bg-surface-hover border border-surface-border text-slate-400 text-sm font-medium hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {mTx?.stage === "confirmed" && (
                  <p className="text-sm text-accent-mint font-medium">Done!</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

