"use client";

import React from "react";
import { FiCheck, FiX } from "react-icons/fi";
import Spinner from "./Spinner";

type TxStep = "building" | "signing" | "submitting" | "confirmed" | "failed";

interface TxProgressProps {
  step: TxStep;
}

const STEPS: { key: TxStep; label: string }[] = [
  { key: "building", label: "Building" },
  { key: "signing", label: "Signing" },
  { key: "submitting", label: "Submitting" },
  { key: "confirmed", label: "Confirmed" },
];

function getStepIndex(step: TxStep): number {
  return STEPS.findIndex((s) => s.key === step);
}

export default function TxProgress({ step }: TxProgressProps) {
  if (step === "failed") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
        <div className="w-6 h-6 rounded-full bg-accent-red/20 flex items-center justify-center shrink-0">
          <FiX className="w-3.5 h-3.5 text-accent-red" />
        </div>
        <span className="text-sm font-medium text-accent-red">Transaction Failed</span>
      </div>
    );
  }

  const currentIdx = getStepIndex(step);

  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface/60 border border-surface-border">
      {STEPS.map((s, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;

        return (
          <React.Fragment key={s.key}>
            <div className="flex items-center gap-2">
              {/* Step indicator */}
              {isComplete ? (
                <div className="w-5 h-5 rounded-full bg-accent-mint/20 flex items-center justify-center">
                  <FiCheck className="w-3 h-3 text-accent-mint" />
                </div>
              ) : isCurrent ? (
                <Spinner size="sm" />
              ) : (
                <div className="w-5 h-5 rounded-full bg-surface-hover" />
              )}
              <span
                className={`text-xs font-medium ${
                  isComplete
                    ? "text-accent-mint"
                    : isCurrent
                      ? "text-primary-400"
                      : "text-slate-600"
                }`}
              >
                {s.label}
              </span>
            </div>
            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-px ${
                  i < currentIdx ? "bg-accent-mint/40" : "bg-surface-border"
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

