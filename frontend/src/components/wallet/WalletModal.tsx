"use client";

import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { useWallet } from "@/hooks/useWallet";
import type { WalletType } from "@/wallet/types";

interface WalletOption {
  id: WalletType;
  name: string;
  description: string;
  icon: string;
}

const WALLETS: WalletOption[] = [
  {
    id: "freighter",
    name: "Freighter",
    description: "Stellar browser extension",
    icon: "F",
  },
  {
    id: "xbull",
    name: "xBull",
    description: "Advanced Stellar wallet",
    icon: "X",
  },
  {
    id: "albedo",
    name: "Albedo",
    description: "Web-based Stellar wallet",
    icon: "A",
  },
];

const ICON_COLORS: Record<WalletType, string> = {
  freighter: "from-blue-500 to-blue-700",
  xbull: "from-orange-500 to-red-600",
  albedo: "from-cyan-400 to-teal-600",
};

interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const { connect, connecting } = useWallet();
  const [connectingId, setConnectingId] = useState<WalletType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleConnect = useCallback(
    async (wallet: WalletOption) => {
      setConnectingId(wallet.id);
      setError(null);
      try {
        await connect(wallet.id);
        onClose();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to connect wallet"
        );
      } finally {
        setConnectingId(null);
      }
    },
    [connect, onClose]
  );

  // Reset error when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setConnectingId(null);
    }
  }, [isOpen]);

  if (!mounted) return null;

  const modal = (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-300 ${
        isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        className={`relative w-full max-w-md mx-4 bg-surface-card border border-surface-border rounded-2xl shadow-2xl shadow-black/50 transform transition-all duration-300 ${
          isOpen ? "scale-100 opacity-100" : "scale-95 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-2">
          <h3 className="font-heading font-semibold text-lg text-slate-100">
            Connect Wallet
          </h3>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-white hover:bg-surface-hover transition-colors"
            aria-label="Close"
          >
            <FiX className="w-5 h-5" />
          </button>
        </div>

        <p className="px-6 text-sm text-slate-500 mb-4">
          Choose a wallet to connect to StellarPulse.
        </p>

        {/* Error banner */}
        {error && (
          <div className="mx-6 mb-3 px-4 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Wallet list */}
        <div className="px-6 pb-6 space-y-2">
          {WALLETS.map((wallet) => {
            const isLoading = connectingId === wallet.id;
            return (
              <button
                key={wallet.id}
                onClick={() => handleConnect(wallet)}
                disabled={connecting}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-surface-border hover:border-primary-600/50 hover:bg-surface-hover transition-all duration-200 group disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {/* Wallet icon */}
                <div
                  className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ICON_COLORS[wallet.id]} flex items-center justify-center text-white font-heading font-bold text-lg shrink-0`}
                >
                  {wallet.icon}
                </div>

                {/* Info */}
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">
                    {wallet.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {wallet.description}
                  </p>
                </div>

                {/* Loading spinner */}
                {isLoading && (
                  <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
