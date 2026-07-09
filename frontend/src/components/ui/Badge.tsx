import React from "react";
import { FiCheck, FiX, FiClock, FiAward, FiMinus } from "react-icons/fi";

type BadgeVariant = "active" | "resolved" | "cancelled" | "won" | "lost" | "pending";

interface BadgeProps {
  variant: BadgeVariant;
  children: React.ReactNode;
  showIcon?: boolean;
}

const STYLES: Record<BadgeVariant, { bg: string; icon: React.ElementType }> = {
  active: { bg: "bg-green-500/15 text-green-400 border border-green-500/20", icon: FiClock },
  resolved: { bg: "bg-primary-500/15 text-primary-400 border border-primary-500/20", icon: FiCheck },
  cancelled: { bg: "bg-slate-500/15 text-slate-400 border border-slate-500/20", icon: FiX },
  won: { bg: "bg-amber-500/15 text-amber-400 border border-amber-500/20", icon: FiAward },
  lost: { bg: "bg-red-500/15 text-red-400 border border-red-500/20", icon: FiMinus },
  pending: { bg: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/20", icon: FiClock },
};

export default function Badge({ variant, children, showIcon = false }: BadgeProps) {
  const { bg, icon: Icon } = STYLES[variant];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${bg}`}
    >
      {showIcon && <Icon className="w-3 h-3" />}
      {children}
    </span>
  );
}
