"use client";

import { useState, useRef, useEffect } from "react";
import { FiCreditCard, FiChevronDown, FiLogOut, FiCopy, FiCheck } from "react-icons/fi";
import { useWallet } from "@/hooks/useWallet";
import { truncateAddress } from "@/utils/helpers";
import WalletModal from "./WalletModal";

export default function WalletConnect() {
  const { publicKey, connected, disconnect } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleCopy = async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Disconnected state ────────────────────────────────────────────────────
  if (!connected || !publicKey) {
    return (
      <>
        <button
          onClick={() => setModalOpen(true)}
          className="btn-primary text-sm inline-flex items-center gap-2"
        >
          <FiCreditCard className="w-4 h-4" />
          Connect Wallet
        </button>
        <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  // ── Connected state ───────────────────────────────────────────────────────
  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setDropdownOpen((p) => !p)}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-card border border-surface-border hover:bg-surface-hover text-sm font-medium text-slate-200 transition-colors duration-200"
      >
        <span className="w-2 h-2 rounded-full bg-accent-mint animate-pulse" />
        {truncateAddress(publicKey)}
        <FiChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform duration-200 ${
            dropdownOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-52 rounded-xl bg-surface-card border border-surface-border shadow-xl shadow-black/40 overflow-hidden z-50">
          <button
            onClick={handleCopy}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-surface-hover transition-colors"
          >
            {copied ? (
              <FiCheck className="w-4 h-4 text-accent-mint" />
            ) : (
              <FiCopy className="w-4 h-4" />
            )}
            {copied ? "Copied!" : "Copy Address"}
          </button>
          <div className="border-t border-surface-border" />
          <button
            onClick={() => {
              disconnect();
              setDropdownOpen(false);
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-surface-hover transition-colors"
          >
            <FiLogOut className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}

