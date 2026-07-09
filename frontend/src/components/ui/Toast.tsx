"use client";

import React, { useEffect, useState } from "react";
import { FiCheck, FiAlertTriangle, FiInfo, FiX } from "react-icons/fi";

interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  onDismiss: () => void;
  duration?: number;
}

const CONFIG: Record<string, { bg: string; icon: React.ElementType }> = {
  success: { bg: "bg-green-500/15 border-green-500/30 text-green-400", icon: FiCheck },
  error: { bg: "bg-red-500/15 border-red-500/30 text-red-400", icon: FiAlertTriangle },
  info: { bg: "bg-primary-500/15 border-primary-500/30 text-primary-400", icon: FiInfo },
};

export default function Toast({ message, type, onDismiss, duration = 5000 }: ToastProps) {
  const [visible, setVisible] = useState(false);

  // Slide in on mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Auto-dismiss
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const { bg, icon: Icon } = CONFIG[type];

  return (
    <div
      className={`max-w-sm w-full px-4 py-3 rounded-xl border shadow-xl shadow-black/30 backdrop-blur-sm flex items-center gap-3 transition-all duration-300 ${bg} ${
        visible ? "translate-x-0 opacity-100" : "translate-x-8 opacity-0"
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      <span className="text-sm flex-1">{message}</span>
      <button
        onClick={() => {
          setVisible(false);
          setTimeout(onDismiss, 300);
        }}
        className="p-1 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
        aria-label="Dismiss"
      >
        <FiX className="w-4 h-4" />
      </button>
    </div>
  );
}
