"use client";

import { useState, useCallback } from "react";
import { placeBet } from "@/services/market";
import { useWallet } from "@/hooks/useWallet";
import type { TransactionResult, AppError } from "@/types";

export type TxStage =
  | "idle"
  | "building"
  | "signing"
  | "submitting"
  | "confirmed"
  | "failed";

interface UseBetResult {
  submit: (
    marketId: number,
    isYes: boolean,
    amount: number
  ) => Promise<void>;
  result: TransactionResult | null;
  loading: boolean;
  stage: TxStage;
  error: string | null;
  reset: () => void;
}

export function useBet(): UseBetResult {
  const { publicKey, signTransaction } = useWallet();
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<TxStage>("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(
    async (marketId: number, isYes: boolean, amount: number) => {
      if (!publicKey) {
        setError("Wallet not connected");
        return;
      }

      setLoading(true);
      setError(null);
      setResult(null);
      setStage("building");

      try {
        setStage("signing");

        const txResult = await placeBet(
          publicKey,
          marketId,
          isYes,
          amount,
          signTransaction
        );

        setStage("submitting");

        if (txResult.success) {
          setStage("confirmed");
          setResult(txResult);
        } else {
          setStage("failed");
          setError(txResult.error || "Transaction failed");
          setResult(txResult);
        }
      } catch (err) {
        setStage("failed");
        console.error("[StellarPulse] useBet error:", err);
        let message: string;
        if (isAppError(err)) {
          // Show details if available for more useful debugging
          message = err.details && err.details !== err.message
            ? `${err.message} — ${err.details}`
            : err.message;
        } else if (err instanceof Error) {
          message = err.message;
        } else {
          message = String(err) || "Unknown error";
        }
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [publicKey, signTransaction]
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setStage("idle");
  }, []);

  return { submit, result, loading, stage, error, reset };
}

function isAppError(err: unknown): err is AppError {
  return (
    typeof err === "object" &&
    err !== null &&
    "type" in err &&
    "message" in err
  );
}
