"use client";

import React, { useState, useMemo, useEffect } from "react";
import { FiAlertCircle } from "react-icons/fi";
import type { Market, Bet } from "@/types";
import { useWallet } from "@/hooks/useWallet";
import { useBet, type TxStage } from "@/hooks/useBet";
import { useToast } from "@/hooks/useToast";
import { calculatePayout, calculateOdds } from "@/utils/helpers";
import {
  WIN_POINTS,
  LOSE_POINTS,
  WIN_TOKENS,
  LOSE_TOKENS,
  TOTAL_FEE_BPS,
} from "@/config/network";
import TxProgress from "@/components/ui/TxProgress";
import ShareBetButton from "@/components/social/ShareBetButton";
import Button from "@/components/ui/Button";

const QUICK_AMOUNTS = [1, 5, 10, 50, 100];

// Stellar accounts must keep a minimum balance locked (base reserve + per-entry
// reserve) that can never be spent, plus a little headroom for the network fee
// on the bet transaction itself. Betting the *entire* wallet balance traps the
// XLM transfer with "resulting balance is not within the allowed range"
// (Error(Contract, #10)). We reserve a safe buffer so the spendable amount is
// always transferable. ~1 XLM base reserve + entry reserves + fee headroom.
const RESERVE_BUFFER_XLM = 1.2;

interface BettingPanelProps {
  market: Market;
  userBet: Bet | null;
  balance: number;
  onSuccess?: () => void;
}

function stageTxStep(stage: TxStage): "building" | "signing" | "submitting" | "confirmed" | "failed" {
  if (stage === "idle") return "building";
  return stage;
}

export default function BettingPanel({
  market,
  userBet,
  balance,
  onSuccess,
}: BettingPanelProps) {
  const { publicKey, connected } = useWallet();
  const { submit, result, loading, stage, error, reset } = useBet();
  const { showToast } = useToast();

  const [side, setSide] = useState<boolean>(userBet?.isYes ?? true);
  const [amountStr, setAmountStr] = useState("");
  const [showShare, setShowShare] = useState(false);

  // Lock side if user already has a bet
  useEffect(() => {
    if (userBet) setSide(userBet.isYes);
  }, [userBet]);

  const amount = parseFloat(amountStr) || 0;
  const feeAmount = (amount * TOTAL_FEE_BPS) / 10000;
  const netAmount = amount - feeAmount;

  const isActive =
    !market.resolved &&
    !market.cancelled &&
    market.endTime > Math.floor(Date.now() / 1000);

  // Spendable = total balance minus the locked Stellar reserve + fee headroom.
  // Never let it go negative.
  const spendable = Math.max(0, balance - RESERVE_BUFFER_XLM);

  const isMinValid = amount >= 1;
  const isBalanceValid = amount <= spendable;
  const canSubmit =
    connected && isActive && isMinValid && isBalanceValid && !loading;

  // Calculate potential payout
  const { yesPercent, noPercent } = calculateOdds(
    market.totalYes,
    market.totalNo
  );

  const payout = useMemo(() => {
    const winningSide = side ? market.totalYes + netAmount : market.totalNo + netAmount;
    const totalPool = market.totalYes + market.totalNo + netAmount;
    const existingBet = userBet && userBet.isYes === side ? userBet.amount : 0;
    const userTotal = existingBet + netAmount;
    return calculatePayout(userTotal, winningSide, totalPool);
  }, [side, netAmount, market.totalYes, market.totalNo, userBet]);

  const profit = payout - (userBet?.isYes === side ? userBet.amount : 0) - netAmount;
  const profitPercent =
    netAmount > 0 ? ((profit / netAmount) * 100).toFixed(0) : "0";

  const handleSubmit = async () => {
    if (!canSubmit) return;
    reset();
    await submit(market.id, side, amount);
  };

  // Show share button after confirmed
  const prevStageRef = React.useRef<TxStage>("idle");
  useEffect(() => {
    if (stage === "confirmed" && prevStageRef.current !== "confirmed") {
      setShowShare(true);
      showToast(`Bet of ${amount} XLM on ${side ? "YES" : "NO"} placed!`, "success");
      onSuccess?.();
    } else if (stage === "failed" && prevStageRef.current !== "failed" && error) {
      showToast(error, "error");
    }
    prevStageRef.current = stage;
  }, [stage, error]);

  const handleSetMax = () => {
    // Max = spendable balance (keeps the locked reserve + fee headroom intact),
    // floored to whole XLM. Never negative.
    setAmountStr(Math.max(0, Math.floor(spendable)).toString());
  };

  const hasExistingBet = userBet !== null;
  const oppositeDisabled = hasExistingBet;

  return (
    <div className="card space-y-5">
      <h3 className="font-heading font-semibold text-lg text-slate-100">
        Place Your Bet
      </h3>

      {/* Existing position */}
      {hasExistingBet && (
        <div className="px-4 py-3 rounded-xl bg-primary-600/10 border border-primary-600/20 text-sm">
          <span className="text-primary-400 font-medium">
            Your position: {userBet.amount.toFixed(2)} XLM on{" "}
            {userBet.isYes ? "YES" : "NO"}
          </span>
        </div>
      )}

      {/* YES / NO toggle */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => !oppositeDisabled || side === true ? setSide(true) : undefined}
          disabled={oppositeDisabled && !side}
          className={`relative py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
            side === true
              ? "bg-accent-mint/20 text-accent-mint border-2 border-accent-mint shadow-lg shadow-accent-mint/10"
              : oppositeDisabled
                ? "bg-surface-hover text-slate-600 border border-surface-border cursor-not-allowed"
                : "bg-surface-card text-slate-400 border border-surface-border hover:border-accent-mint/50 hover:text-accent-mint"
          }`}
          title={oppositeDisabled && !side ? `You already bet ${userBet!.isYes ? "YES" : "NO"} on this market` : undefined}
        >
          YES ({yesPercent}%)
        </button>
        <button
          onClick={() => !oppositeDisabled || side === false ? setSide(false) : undefined}
          disabled={oppositeDisabled && side}
          className={`relative py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
            side === false
              ? "bg-accent-red/20 text-accent-red border-2 border-accent-red shadow-lg shadow-accent-red/10"
              : oppositeDisabled
                ? "bg-surface-hover text-slate-600 border border-surface-border cursor-not-allowed"
                : "bg-surface-card text-slate-400 border border-surface-border hover:border-accent-red/50 hover:text-accent-red"
          }`}
          title={oppositeDisabled && side ? `You already bet ${userBet!.isYes ? "YES" : "NO"} on this market` : undefined}
        >
          NO ({noPercent}%)
        </button>
      </div>

      {/* Amount input */}
      <div className="space-y-2">
        <label className="text-xs text-slate-500 font-medium">Amount (XLM)</label>
        <div className="relative">
          <input
            type="number"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0.00"
            min="1"
            step="any"
            disabled={!isActive || loading}
            className="w-full px-4 py-3 rounded-xl bg-surface border border-surface-border text-slate-100 text-lg font-medium placeholder-slate-600 focus:outline-none focus:border-primary-600/50 focus:ring-1 focus:ring-primary-600/25 transition-all disabled:opacity-50"
          />
        </div>

        {/* Quick amount buttons */}
        <div className="flex items-center gap-2">
          {QUICK_AMOUNTS.map((qa) => (
            <button
              key={qa}
              onClick={() => setAmountStr(qa.toString())}
              disabled={!isActive || loading}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-surface-card border border-surface-border text-slate-400 hover:text-white hover:border-primary-600/50 transition-colors disabled:opacity-50"
            >
              {qa}
            </button>
          ))}
          <button
            onClick={handleSetMax}
            disabled={!isActive || loading || spendable <= 0}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium bg-primary-600/15 border border-primary-600/30 text-primary-400 hover:bg-primary-600/25 transition-colors disabled:opacity-50"
          >
            MAX
          </button>
        </div>

        {/* Wallet balance */}
        <p className="text-xs text-slate-600">
          Balance: {balance.toFixed(2)} XLM
          <span className="text-slate-700">
            {" "}· {spendable.toFixed(2)} bettable
          </span>
        </p>
      </div>

      {/* Payout calculator */}
      {amount > 0 && (
        <div className="space-y-2 px-4 py-3 rounded-xl bg-surface/60 border border-surface-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">
              Platform fee ({TOTAL_FEE_BPS / 100}%)
            </span>
            <span className="text-slate-400">{feeAmount.toFixed(2)} XLM</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">You bet (net)</span>
            <span className="text-slate-300 font-medium">{netAmount.toFixed(2)} XLM</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">If you win</span>
            <span className="text-accent-mint font-medium">
              {payout.toFixed(2)} XLM (+{profitPercent}%)
            </span>
          </div>
          <div className="border-t border-surface-border my-1" />
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Network fee</span>
            <span>{hasExistingBet ? "~0.003 XLM" : "~0.14 XLM first bet"}</span>
          </div>
          {!hasExistingBet && (
            <p className="text-[11px] leading-snug text-slate-600">
              Your first bet on a market includes a one-time on-chain storage fee
              (~0.14 XLM, paid to the Stellar network). Every bet after that on
              this market is near-free (~0.003 XLM).
            </p>
          )}
          <div className="text-xs text-slate-500">
            Win: {WIN_POINTS} pts + {WIN_TOKENS} PLSE &nbsp;|&nbsp; Lose: {LOSE_POINTS} pts + {LOSE_TOKENS} PLSE
          </div>
        </div>
      )}

      {/* Validation messages */}
      {amountStr && !isMinValid && (
        <div className="flex items-center gap-2 text-xs text-accent-red">
          <FiAlertCircle className="w-3.5 h-3.5 shrink-0" />
          Minimum bet is 1 XLM
        </div>
      )}
      {amountStr && isMinValid && !isBalanceValid && (
        <div className="flex items-start gap-2 text-xs text-accent-red">
          <FiAlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Insufficient balance. You can bet up to{" "}
            <span className="font-medium">{spendable.toFixed(2)} XLM</span> —
            Stellar keeps ~{RESERVE_BUFFER_XLM} XLM locked as the account reserve
            and network fee.
          </span>
        </div>
      )}

      {/* Tx progress */}
      {stage !== "idle" && stage !== "confirmed" && (
        <TxProgress step={stageTxStep(stage)} />
      )}

      {/* Error message */}
      {error && (
        <div className="px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Submit button */}
      {!showShare ? (
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          variant="primary"
          fullWidth
          className="py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {!connected
            ? "Connect Wallet"
            : !isActive
              ? "Market Closed"
              : loading
                ? "Processing..."
                : hasExistingBet
                  ? "Increase Position"
                  : "Place Bet"}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="text-center text-sm text-accent-mint font-medium">
            Bet placed successfully!
          </div>
          <ShareBetButton
            question={market.question}
            amount={amount}
            side={side ? "YES" : "NO"}
            marketId={market.id}
            referralAddress={publicKey || undefined}
          />
          <Button
            onClick={() => {
              setShowShare(false);
              setAmountStr("");
              reset();
            }}
            variant="secondary"
            fullWidth
            className="py-2.5 text-sm"
          >
            Place Another Bet
          </Button>
        </div>
      )}
    </div>
  );
}

