"use client";

import { useState, useCallback } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useReferral } from "@/hooks/useReferral";
import { registerReferral, resolveAddressByName } from "@/services/referral";
import { FiUsers, FiLink, FiCopy, FiCheck, FiUserPlus, FiSearch } from "react-icons/fi";
import Spinner from "@/components/ui/Spinner";

/** Check if a string is a valid Stellar public key (G... 56-char) */
function isValidStellarAddress(s: string): boolean {
  return /^G[A-Z2-7]{55}$/.test(s);
}

export default function ReferralStats() {
  const { publicKey, signTransaction } = useWallet();
  const { data: referral, loading, refetch } = useReferral(publicKey ?? undefined);

  // Registration form state
  const [displayName, setDisplayName] = useState("");
  const [referrer, setReferrer] = useState("");
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolvedAddr, setResolvedAddr] = useState<string | null>(null);

  // Copy state
  const [copied, setCopied] = useState(false);

  const handleRegister = useCallback(async () => {
    if (!publicKey || !displayName.trim()) return;

    setRegistering(true);
    setRegError(null);
    setRegSuccess(false);

    const ref = referrer.trim();
    let referrerAddress: string | null = null;

    if (ref) {
      if (isValidStellarAddress(ref)) {
        // Already a wallet address
        referrerAddress = ref;
      } else {
        // Treat as a display name — resolve to address
        setResolving(true);
        try {
          referrerAddress = await resolveAddressByName(ref);
        } catch {
          referrerAddress = null;
        }
        setResolving(false);

        if (!referrerAddress) {
          setRegError(`Could not find a registered user named "${ref}". Check the name and try again.`);
          setRegistering(false);
          return;
        }
        setResolvedAddr(referrerAddress);
      }
    }

    try {
      const result = await registerReferral(
        publicKey,
        displayName.trim(),
        referrerAddress,
        signTransaction
      );
      if (!result.success) {
        setRegError(result.error || "Registration transaction failed");
        return;
      }
      setRegSuccess(true);
      // Wait a moment for blockchain to settle before re-fetching
      await new Promise((r) => setTimeout(r, 3000));
      refetch();
    } catch (err) {
      setRegError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setRegistering(false);
      setResolvedAddr(null);
    }
  }, [publicKey, displayName, referrer, signTransaction, refetch]);

  const handleCopy = useCallback(async () => {
    if (!referral?.displayName) return;
    await navigator.clipboard.writeText(referral.displayName);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [referral?.displayName]);

  if (!publicKey) {
    return (
      <div className="card">
        <h3 className="font-heading font-semibold text-lg mb-2">Referrals</h3>
        <p className="text-sm text-slate-500">Connect your wallet to view referral stats.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="card">
        <h3 className="font-heading font-semibold text-lg mb-4">Referrals</h3>
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      </div>
    );
  }

  // Not registered yet — show registration form
  if (!referral?.isRegistered) {
    return (
      <div className="card">
        <h3 className="font-heading font-semibold text-lg mb-4">Join Referral Program</h3>
        <p className="text-sm text-slate-500 mb-4">
          Register to get your referral link. Earn 0.5% + 3 bonus points on every bet placed by your referrals.
        </p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">Display Name</label>
            <input
              type="text"
              placeholder="Enter your display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-surface-hover border border-surface-border text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">
              Who Referred You? <span className="text-slate-600">(optional)</span>
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Enter referrer's name or wallet address"
                value={referrer}
                onChange={(e) => {
                  setReferrer(e.target.value);
                  setResolvedAddr(null);
                }}
                className="w-full px-4 py-2.5 rounded-xl bg-surface-hover border border-surface-border text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              />
              {resolving && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Spinner size="sm" />
                </div>
              )}
            </div>
            <p className="text-xs text-slate-600 mt-1">
              <FiSearch className="w-3 h-3 inline mr-1" />
              Type their display name (e.g. &quot;John&quot;) or Stellar address (G...)
            </p>
            {resolvedAddr && (
              <p className="text-xs text-accent-mint mt-1">
                Found: {resolvedAddr.slice(0, 8)}...{resolvedAddr.slice(-4)}
              </p>
            )}
          </div>
          {regError && (
            <p className="text-sm text-accent-red">{regError}</p>
          )}
          {regSuccess && (
            <p className="text-sm text-accent-mint">Registration successful! Refreshing data...</p>
          )}
          <button
            onClick={handleRegister}
            disabled={registering || !displayName.trim()}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {registering ? (
              <Spinner size="sm" />
            ) : (
              <FiUserPlus className="w-4 h-4" />
            )}
            {registering ? (resolving ? "Looking up referrer..." : "Registering...") : "Register"}
          </button>
        </div>
      </div>
    );
  }

  // Registered — show stats + referral link
  return (
    <div className="card">
      <h3 className="font-heading font-semibold text-lg mb-5">Referrals</h3>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="p-4 rounded-xl bg-surface-hover/50">
          <div className="flex items-center gap-2 mb-1">
            <FiUsers className="w-3.5 h-3.5 text-primary-400" />
            <span className="text-xs text-slate-500">Referrals</span>
          </div>
          <p className="text-xl font-heading font-bold">
            {referral.referralCount}
          </p>
        </div>
        <div className="p-4 rounded-xl bg-surface-hover/50">
          <div className="flex items-center gap-2 mb-1">
            <FiLink className="w-3.5 h-3.5 text-accent-mint" />
            <span className="text-xs text-slate-500">Earnings</span>
          </div>
          <p className="text-xl font-heading font-bold text-accent-mint">
            {(referral.earnings / 1e7).toFixed(2)} XLM
          </p>
        </div>
      </div>

      {/* Referral name — others use this to register with you as referrer */}
      <div>
        <label className="block text-sm text-slate-400 mb-1.5">Your Referral Name</label>
        <div className="flex gap-2">
          <div className="flex-1 px-4 py-2.5 rounded-xl bg-surface-hover border border-surface-border text-white text-sm font-medium">
            {referral.displayName}
          </div>
          <button
            onClick={handleCopy}
            title="Copy referral name"
            className="px-4 py-2.5 rounded-xl bg-surface-hover border border-surface-border hover:border-primary-500/50 transition-colors flex items-center gap-2"
          >
            {copied ? (
              <FiCheck className="w-4 h-4 text-accent-mint" />
            ) : (
              <FiCopy className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>
        <p className="text-xs text-slate-600 mt-1">Share this name — others enter it when registering to become your referral</p>
      </div>
    </div>
  );
}

