import React from "react";
import { FiHexagon } from "react-icons/fi";

interface TokenBalanceProps {
  balance: number;
  symbol?: string;
}

export default function TokenBalance({ balance, symbol = "PLSE" }: TokenBalanceProps) {
  const safeBalance = Number.isNaN(balance) || balance == null ? 0 : balance;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent-mint/20 bg-gradient-to-br from-accent-mint/5 via-surface-card to-surface-card p-6">
      {/* Glow accent */}
      <div className="absolute -top-8 -right-8 w-32 h-32 bg-accent-mint/10 rounded-full blur-2xl" />

      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <FiHexagon className="w-4 h-4 text-accent-mint" />
          <span className="text-sm text-slate-400">{symbol} Balance</span>
        </div>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-heading font-bold text-white">
            {safeBalance.toLocaleString()}
          </p>
          <span className="text-sm font-medium text-accent-mint">{symbol}</span>
        </div>
      </div>
    </div>
  );
}

