"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { getAccumulatedFees, getMarkets, withdrawFees, addResolver, removeResolver, addFeeRecipient } from "@/services/market";
import { FiDollarSign, FiBarChart2, FiDownload, FiActivity, FiUserPlus, FiUserMinus, FiUsers } from "react-icons/fi";
import Spinner from "@/components/ui/Spinner";
import type { TxStage } from "@/hooks/useClaim";
import TxProgress from "@/components/ui/TxProgress";

interface PlatformData {
  accumulatedFees: number;
  totalMarkets: number;
  activeMarkets: number;
  resolvedMarkets: number;
  totalVolume: number;
}

export default function PlatformStats() {
  const { publicKey, signTransaction } = useWallet();
  const [data, setData] = useState<PlatformData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Withdraw state
  const [withdrawStage, setWithdrawStage] = useState<TxStage>("idle");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [recipientAddress, setRecipientAddress] = useState("");

  // Resolver management
  const [resolverAddress, setResolverAddress] = useState("");
  const [resolverStage, setResolverStage] = useState<TxStage>("idle");
  const [resolverError, setResolverError] = useState<string | null>(null);

  // Fee recipient management
  const [feeRecipientAddress, setFeeRecipientAddress] = useState("");
  const [feeRecipientStage, setFeeRecipientStage] = useState<TxStage>("idle");
  const [feeRecipientError, setFeeRecipientError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fees, markets] = await Promise.all([
        getAccumulatedFees(),
        getMarkets(),
      ]);

      const now = Math.floor(Date.now() / 1000);
      const active = markets.filter((m) => !m.resolved && !m.cancelled && m.endTime > now);
      const resolved = markets.filter((m) => m.resolved);
      const totalVolume = markets.reduce((sum, m) => sum + m.totalYes + m.totalNo, 0);

      setData({
        accumulatedFees: fees,
        totalMarkets: markets.length,
        activeMarkets: active.length,
        resolvedMarkets: resolved.length,
        totalVolume,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleWithdraw = useCallback(async () => {
    if (!publicKey) return;
    const to = recipientAddress.trim() || publicKey;
    setWithdrawStage("signing");
    setWithdrawError(null);
    try {
      const result = await withdrawFees(publicKey, to, signTransaction);
      if (result.success) {
        setWithdrawStage("confirmed");
        setRecipientAddress("");
        fetchData();
        setTimeout(() => setWithdrawStage("idle"), 3000);
      } else {
        setWithdrawStage("failed");
        setWithdrawError(result.error || "Withdraw failed");
      }
    } catch (err) {
      setWithdrawStage("failed");
      setWithdrawError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [publicKey, recipientAddress, signTransaction, fetchData]);

  const handleAddResolver = useCallback(async () => {
    if (!publicKey || !resolverAddress.trim()) return;
    setResolverStage("signing");
    setResolverError(null);
    try {
      const result = await addResolver(publicKey, resolverAddress.trim(), signTransaction);
      if (result.success) {
        setResolverStage("confirmed");
        setResolverAddress("");
        setTimeout(() => setResolverStage("idle"), 3000);
      } else {
        setResolverStage("failed");
        setResolverError(result.error || "Failed");
      }
    } catch (err) {
      setResolverStage("failed");
      setResolverError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [publicKey, resolverAddress, signTransaction]);

  const handleRemoveResolver = useCallback(async () => {
    if (!publicKey || !resolverAddress.trim()) return;
    setResolverStage("signing");
    setResolverError(null);
    try {
      const result = await removeResolver(publicKey, resolverAddress.trim(), signTransaction);
      if (result.success) {
        setResolverStage("confirmed");
        setResolverAddress("");
        setTimeout(() => setResolverStage("idle"), 3000);
      } else {
        setResolverStage("failed");
        setResolverError(result.error || "Failed");
      }
    } catch (err) {
      setResolverStage("failed");
      setResolverError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [publicKey, resolverAddress, signTransaction]);

  const handleAddFeeRecipient = useCallback(async () => {
    if (!publicKey || !feeRecipientAddress.trim()) return;
    setFeeRecipientStage("signing");
    setFeeRecipientError(null);
    try {
      const result = await addFeeRecipient(publicKey, feeRecipientAddress.trim(), signTransaction);
      if (result.success) {
        setFeeRecipientStage("confirmed");
        setFeeRecipientAddress("");
        setTimeout(() => setFeeRecipientStage("idle"), 3000);
      } else {
        setFeeRecipientStage("failed");
        setFeeRecipientError(result.error || "Failed");
      }
    } catch (err) {
      setFeeRecipientStage("failed");
      setFeeRecipientError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [publicKey, feeRecipientAddress, signTransaction]);

  if (loading) {
    return (
      <div className="card">
        <h3 className="font-heading font-semibold text-lg mb-4">Platform Stats</h3>
        <div className="flex justify-center py-8"><Spinner size="lg" /></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card">
        <h3 className="font-heading font-semibold text-lg mb-4">Platform Stats</h3>
        <p className="text-sm text-accent-red">{error || "No data available"}</p>
      </div>
    );
  }

  const isWithdrawing = withdrawStage !== "idle" && withdrawStage !== "confirmed" && withdrawStage !== "failed";
  const isResolverBusy = resolverStage !== "idle" && resolverStage !== "confirmed" && resolverStage !== "failed";
  const isFeeRecipientBusy = feeRecipientStage !== "idle" && feeRecipientStage !== "confirmed" && feeRecipientStage !== "failed";

  return (
    <div className="space-y-5">
      {/* Stats grid */}
      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-heading font-semibold text-lg flex items-center gap-2">
            <FiBarChart2 className="w-5 h-5 text-primary-400" />
            Platform Stats
          </h3>
          <button onClick={fetchData} className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
            Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard icon={FiActivity} label="Active Markets" value={data.activeMarkets.toString()} color="text-accent-mint" />
          <StatCard icon={FiBarChart2} label="Total Markets" value={data.totalMarkets.toString()} color="text-primary-400" />
          <StatCard icon={FiDollarSign} label="Total Volume" value={`${data.totalVolume.toFixed(2)} XLM`} color="text-slate-300" />
          <StatCard icon={FiDollarSign} label="Accumulated Fees" value={`${data.accumulatedFees.toFixed(4)} XLM`} color="text-amber-400" />
        </div>
      </div>

      {/* Withdraw fees */}
      <div className="card">
        <h3 className="font-heading font-semibold text-base mb-4 flex items-center gap-2">
          <FiDownload className="w-4 h-4 text-amber-400" />
          Withdraw Fees
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-slate-500 mb-1 block">Send fees to (leave blank to send to yourself)</label>
            <input
              type="text"
              placeholder={publicKey || "G... recipient address"}
              value={recipientAddress}
              onChange={(e) => setRecipientAddress(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-surface-hover border border-surface-border text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">Available</p>
              <p className="text-xl font-heading font-bold text-amber-400">{data.accumulatedFees.toFixed(4)} XLM</p>
            </div>
            <button
              onClick={handleWithdraw}
              disabled={isWithdrawing || data.accumulatedFees === 0 || !publicKey}
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
            >
              {isWithdrawing ? <Spinner size="sm" /> : <FiDownload className="w-4 h-4" />}
              Withdraw
            </button>
          </div>
          {withdrawStage !== "idle" && <TxProgress step={withdrawStage} />}
          {withdrawError && <p className="text-xs text-accent-red">{withdrawError}</p>}
          {withdrawStage === "confirmed" && <p className="text-xs text-accent-mint">Fees withdrawn!</p>}
        </div>
      </div>

      {/* Resolver management */}
      <div className="card">
        <h3 className="font-heading font-semibold text-base mb-4 flex items-center gap-2">
          <FiUsers className="w-4 h-4 text-primary-400" />
          Resolver Management
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Resolvers can call resolve_market without being admin. Useful for trusted team members or automated bots.
        </p>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="G... resolver public key"
            value={resolverAddress}
            onChange={(e) => setResolverAddress(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-hover border border-surface-border text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddResolver}
              disabled={isResolverBusy || !resolverAddress.trim() || !publicKey}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-accent-mint/10 border border-accent-mint/20 text-accent-mint text-sm font-medium hover:bg-accent-mint/20 disabled:opacity-50 transition-colors"
            >
              {isResolverBusy ? <Spinner size="sm" /> : <FiUserPlus className="w-4 h-4" />}
              Add Resolver
            </button>
            <button
              onClick={handleRemoveResolver}
              disabled={isResolverBusy || !resolverAddress.trim() || !publicKey}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-accent-red/10 border border-accent-red/20 text-accent-red text-sm font-medium hover:bg-accent-red/20 disabled:opacity-50 transition-colors"
            >
              {isResolverBusy ? <Spinner size="sm" /> : <FiUserMinus className="w-4 h-4" />}
              Remove Resolver
            </button>
          </div>
          {resolverStage !== "idle" && <TxProgress step={resolverStage} />}
          {resolverError && <p className="text-xs text-accent-red">{resolverError}</p>}
          {resolverStage === "confirmed" && <p className="text-xs text-accent-mint">Done!</p>}
        </div>
      </div>

      {/* Fee recipient management */}
      <div className="card">
        <h3 className="font-heading font-semibold text-base mb-4 flex items-center gap-2">
          <FiDollarSign className="w-4 h-4 text-amber-400" />
          Fee Recipients
        </h3>
        <p className="text-xs text-slate-500 mb-3">
          Fee recipients can call withdraw_fees without being admin.
        </p>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="G... fee recipient public key"
            value={feeRecipientAddress}
            onChange={(e) => setFeeRecipientAddress(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-hover border border-surface-border text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
          />
          <button
            onClick={handleAddFeeRecipient}
            disabled={isFeeRecipientBusy || !feeRecipientAddress.trim() || !publicKey}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-primary-600/15 border border-primary-600/30 text-primary-400 text-sm font-medium hover:bg-primary-600/25 disabled:opacity-50 transition-colors"
          >
            {isFeeRecipientBusy ? <Spinner size="sm" /> : <FiUserPlus className="w-4 h-4" />}
            Add Fee Recipient
          </button>
          {feeRecipientStage !== "idle" && <TxProgress step={feeRecipientStage} />}
          {feeRecipientError && <p className="text-xs text-accent-red">{feeRecipientError}</p>}
          {feeRecipientStage === "confirmed" && <p className="text-xs text-accent-mint">Fee recipient added!</p>}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="p-3 rounded-xl bg-surface-hover/30 border border-surface-border/50">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${color}`} />
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className={`text-lg font-heading font-bold ${color}`}>{value}</p>
    </div>
  );
}

