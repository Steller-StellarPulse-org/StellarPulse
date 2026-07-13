"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { WalletType } from "@/wallet/types";
import { AppErrorType } from "@/types";
import type { AppError } from "@/types";
import { setSimulationSource } from "@/services/soroban";
import {
  backoffDelay,
  friendlyWalletError,
  isRetryableWalletError,
  sleep,
} from "@/wallet/connectErrors";

// ── localStorage keys ─────────────────────────────────────────────────────────

const WALLET_TYPE_KEY = "ip_wallet_type";
const WALLET_PUBKEY_KEY = "ip_wallet_pubkey";

// ── Context shape ─────────────────────────────────────────────────────────────

interface WalletContextValue {
  publicKey: string | null;
  walletType: WalletType | null;
  connected: boolean;
  connecting: boolean;
  error: AppError | null;
  connect: (type: WalletType) => Promise<void>;
  disconnect: () => void;
  signTransaction: (xdr: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextValue>({
  publicKey: null,
  walletType: null,
  connected: false,
  connecting: false,
  error: null,
  connect: async () => {},
  disconnect: () => {},
  signTransaction: async () => "",
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<WalletType | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  // Dynamic import ref to avoid SSR issues with wallet kit
  const kitRef = useRef<typeof import("@/wallet/kit") | null>(null);

  // Lazy-load the wallet kit module (client-only)
  const getKit = useCallback(async () => {
    if (!kitRef.current) {
      kitRef.current = await import("@/wallet/kit");
    }
    return kitRef.current;
  }, []);

  // ── Auto-reconnect on mount ───────────────────────────────────────────────

  useEffect(() => {
    const savedType = localStorage.getItem(WALLET_TYPE_KEY) as WalletType | null;
    const savedKey = localStorage.getItem(WALLET_PUBKEY_KEY);

    if (savedType && savedKey) {
      // Attempt silent reconnection
      (async () => {
        try {
          const kit = await getKit();
          kit.selectWallet(savedType);
          const { publicKey: pk } = await kit.connectKit();
          setPublicKey(pk);
          setWalletType(savedType);
          setSimulationSource(pk);
        } catch {
          // Silent fail — clear stale stored state
          localStorage.removeItem(WALLET_TYPE_KEY);
          localStorage.removeItem(WALLET_PUBKEY_KEY);
        }
      })();
    }
  }, [getKit]);

  // ── Connect ─────────────────────────────────────────────────────────────────

  const connect = useCallback(
    async (type: WalletType) => {
      setConnecting(true);
      setError(null);

      const MAX_ATTEMPTS = 3;
      let lastErr: unknown = null;

      try {
        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          try {
            const kit = await getKit();
            kit.selectWallet(type);
            const { publicKey: pk } = await kit.connectKit();

            setPublicKey(pk);
            setWalletType(type);
            setSimulationSource(pk);

            // Persist for auto-reconnect
            localStorage.setItem(WALLET_TYPE_KEY, type);
            localStorage.setItem(WALLET_PUBKEY_KEY, pk);
            return; // success — `finally` resets `connecting`
          } catch (err) {
            lastErr = err;
            // Only retry transient failures; never retry an explicit user
            // rejection / missing wallet, and stop after the final attempt.
            if (!isRetryableWalletError(err) || attempt === MAX_ATTEMPTS - 1) {
              break;
            }
            await sleep(backoffDelay(attempt));
          }
        }
        // All attempts exhausted (or a non-retryable error) — surface it.
        throw lastErr;
      } catch (err) {
        const appError = isAppError(err)
          ? { ...err, message: friendlyWalletError(err) }
          : {
              type: AppErrorType.WALLET,
              message: friendlyWalletError(err),
            };
        setError(appError);
        throw appError;
      } finally {
        setConnecting(false);
      }
    },
    [getKit]
  );

  // ── Disconnect ──────────────────────────────────────────────────────────────

  const disconnect = useCallback(() => {
    setPublicKey(null);
    setWalletType(null);
    setError(null);
    setSimulationSource(null);
    localStorage.removeItem(WALLET_TYPE_KEY);
    localStorage.removeItem(WALLET_PUBKEY_KEY);
  }, []);

  // ── Sign Transaction ────────────────────────────────────────────────────────

  const signTransaction = useCallback(
    async (xdr: string): Promise<string> => {
      const kit = await getKit();
      return kit.signWithKit(xdr);
    },
    [getKit]
  );

  return (
    <WalletContext.Provider
      value={{
        publicKey,
        walletType,
        connected: publicKey !== null,
        connecting,
        error,
        connect,
        disconnect,
        signTransaction,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useWallet() {
  return useContext(WalletContext);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    "message" in err
  );
}
