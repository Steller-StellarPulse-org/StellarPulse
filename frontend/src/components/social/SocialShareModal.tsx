"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  buildShareText,
  buildTwitterShareUrl,
  buildTelegramShareUrl,
  buildWhatsAppShareUrl,
  getMarketUrl,
} from "@/utils/share";
import { FiX, FiCopy, FiCheck, FiExternalLink } from "react-icons/fi";

interface SocialShareModalProps {
  question: string;
  amount: number;
  side: "YES" | "NO";
  marketId: number;
  referralAddress?: string;
  onClose: () => void;
}

const PLATFORMS = [
  {
    key: "twitter",
    label: "X (Twitter)",
    emoji: "\ud83d\udc26",
    bg: "bg-[#1DA1F2]/10 border-[#1DA1F2]/20 hover:bg-[#1DA1F2]/20 text-[#1DA1F2]",
    buildUrl: buildTwitterShareUrl,
  },
  {
    key: "telegram",
    label: "Telegram",
    emoji: "\u2708\ufe0f",
    bg: "bg-[#0088cc]/10 border-[#0088cc]/20 hover:bg-[#0088cc]/20 text-[#0088cc]",
    buildUrl: buildTelegramShareUrl,
  },
  {
    key: "whatsapp",
    label: "WhatsApp",
    emoji: "\ud83d\udcac",
    bg: "bg-[#25D366]/10 border-[#25D366]/20 hover:bg-[#25D366]/20 text-[#25D366]",
    buildUrl: buildWhatsAppShareUrl,
  },
] as const;

export default function SocialShareModal({
  question,
  amount,
  side,
  marketId,
  referralAddress,
  onClose,
}: SocialShareModalProps) {
  const [copied, setCopied] = useState(false);

  const shareText = buildShareText(question, amount, side, marketId, referralAddress);
  const marketUrl = getMarketUrl(marketId, referralAddress);

  // Escape key to close
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(marketUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [marketUrl]);

  const modal = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card max-w-md w-full mx-4 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-surface-hover transition-colors"
          aria-label="Close"
        >
          <FiX className="w-5 h-5" />
        </button>

        <h3 className="font-heading font-semibold text-lg mb-2">
          Share Your Prediction
        </h3>
        <p className="text-sm text-slate-400 mb-5 line-clamp-2">
          {question}
        </p>

        {/* Prediction summary */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-hover/50 mb-5">
          <span
            className={`px-3 py-1 rounded-lg text-sm font-bold ${
              side === "YES"
                ? "bg-accent-mint/20 text-accent-mint"
                : "bg-accent-red/20 text-accent-red"
            }`}
          >
            {side}
          </span>
          <span className="text-sm text-slate-300">
            {(amount / 1e7).toFixed(2)} XLM
          </span>
        </div>

        {/* Share buttons */}
        <div className="space-y-2 mb-4">
          {PLATFORMS.map(({ key, label, emoji, bg, buildUrl }) => (
            <a
              key={key}
              href={buildUrl(shareText, marketUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-3 w-full px-4 py-3 rounded-xl border transition-colors ${bg}`}
            >
              <span className="text-lg">{emoji}</span>
              <span className="text-sm font-medium flex-1">{label}</span>
              <FiExternalLink className="w-4 h-4 opacity-50" />
            </a>
          ))}
        </div>

        {/* Copy Link */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl border border-surface-border bg-surface-hover/30 hover:bg-surface-hover transition-colors"
        >
          {copied ? (
            <FiCheck className="w-5 h-5 text-accent-mint" />
          ) : (
            <FiCopy className="w-5 h-5 text-slate-400" />
          )}
          <span className="text-sm font-medium">
            {copied ? "Link Copied!" : "Copy Link"}
          </span>
        </button>
      </div>
    </div>
  );

  if (typeof window === "undefined") return null;
  return createPortal(modal, document.body);
}

