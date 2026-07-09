"use client";

import React from "react";
import { useWallet } from "@/hooks/useWallet";
import { ADMIN_PUBLIC_KEY } from "@/config/network";
import CreateMarketForm from "@/components/admin/CreateMarketForm";
import ResolveMarketPanel from "@/components/admin/ResolveMarketPanel";
import PlatformStats from "@/components/admin/PlatformStats";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import WalletConnect from "@/components/wallet/WalletConnect";
import { FiShield, FiAlertTriangle } from "react-icons/fi";

export default function AdminPage() {
  const { publicKey, connected } = useWallet();

  // Not connected
  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-surface-hover flex items-center justify-center mx-auto mb-5">
          <FiShield className="w-7 h-7 text-slate-600" />
        </div>
        <h1 className="font-heading text-2xl font-bold mb-2">
          Admin Dashboard
        </h1>
        <p className="text-slate-400 mb-6 max-w-md mx-auto">
          Connect your admin wallet to access the dashboard.
        </p>
        <div className="flex justify-center">
          <WalletConnect />
        </div>
      </div>
    );
  }

  // Connected but not admin
  if (publicKey !== ADMIN_PUBLIC_KEY) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mx-auto mb-5">
          <FiAlertTriangle className="w-7 h-7 text-accent-red" />
        </div>
        <h1 className="font-heading text-2xl font-bold mb-2">
          Access Denied
        </h1>
        <p className="text-slate-400 max-w-md mx-auto">
          This page is restricted to the platform administrator. Your connected wallet does not have admin privileges.
        </p>
      </div>
    );
  }

  // Admin view
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:py-12">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
          <FiShield className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold">
            Admin Dashboard
          </h1>
          <p className="text-slate-400 text-sm">
            Create and manage prediction markets
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {/* Platform Stats */}
        <ErrorBoundary fallbackTitle="Stats failed to load">
          <PlatformStats />
        </ErrorBoundary>

        {/* Create Market */}
        <ErrorBoundary fallbackTitle="Create form error">
          <CreateMarketForm />
        </ErrorBoundary>

        {/* Pending Resolutions */}
        <ErrorBoundary fallbackTitle="Resolution panel error">
          <ResolveMarketPanel />
        </ErrorBoundary>
      </div>
    </div>
  );
}
