"use client";

import React, { useState, useEffect, useRef } from "react";
import { FiClock } from "react-icons/fi";

interface CountdownTimerProps {
  endTime: number;
}

function formatRemaining(seconds: number): string {
  if (seconds <= 0) return "Ended";

  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);

  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function CountdownTimer({ endTime }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState(() => {
    return Math.max(0, endTime - Math.floor(Date.now() / 1000));
  });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const tick = () => {
      const diff = endTime - Math.floor(Date.now() / 1000);
      setRemaining(Math.max(0, diff));
    };

    tick();

    // Determine interval: 1s when < 1 hour, 60s otherwise
    const diff = endTime - Math.floor(Date.now() / 1000);
    const interval = diff <= 3600 ? 1000 : 60000;

    intervalRef.current = setInterval(tick, interval);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [endTime]);

  // Switch to 1s interval when crossing the 1-hour threshold
  useEffect(() => {
    if (remaining <= 3600 && remaining > 0) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        const diff = endTime - Math.floor(Date.now() / 1000);
        setRemaining(Math.max(0, diff));
      }, 1000);

      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    }
  }, [remaining <= 3600, endTime]); // eslint-disable-line react-hooks/exhaustive-deps

  const isUrgent = remaining > 0 && remaining <= 3600;
  const isEnded = remaining <= 0;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${
        isEnded
          ? "text-accent-red"
          : isUrgent
            ? "text-accent-red animate-pulse"
            : "text-slate-400"
      }`}
    >
      <FiClock className="w-3.5 h-3.5" />
      {formatRemaining(remaining)}
    </span>
  );
}
