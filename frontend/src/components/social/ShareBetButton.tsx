"use client";

import React, { useState } from "react";
import { FiShare2 } from "react-icons/fi";
import SocialShareModal from "./SocialShareModal";

interface ShareBetButtonProps {
  question: string;
  amount: number;
  side: "YES" | "NO";
  marketId: number;
  referralAddress?: string;
}

export default function ShareBetButton({
  question,
  amount,
  side,
  marketId,
  referralAddress,
}: ShareBetButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="btn-secondary text-sm inline-flex items-center gap-2"
      >
        <FiShare2 className="w-4 h-4" />
        Share your prediction
      </button>
      {isOpen && (
        <SocialShareModal
          question={question}
          amount={amount}
          side={side}
          marketId={marketId}
          referralAddress={referralAddress}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
