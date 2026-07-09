import { useEffect, useRef } from "react";

/**
 * Visibility-aware polling.
 *
 * Problem this solves: a plain setInterval keeps firing RPC reads even when the
 * tab is in the background or the laptop is asleep. A single forgotten open tab
 * can generate hundreds of pointless requests per hour, which on a metered RPC
 * (QuickNode credits) burns real money for data nobody is looking at.
 *
 * This hook:
 *   • only runs the callback while the document is VISIBLE,
 *   • pauses entirely when the tab is hidden (no timer, no requests),
 *   • on becoming visible again, fires once immediately (so the user sees fresh
 *     data the instant they return) and then resumes the interval.
 *
 * The callback should be "silent" (background refresh) — it must not flash a
 * loading skeleton, since the user already has data on screen.
 *
 * @param callback  the refresh function to run on each tick (kept in a ref so a
 *                  changing identity does not reset the timer)
 * @param intervalMs poll cadence while visible
 * @param enabled   gate polling on/off (e.g. only when a wallet is connected)
 */
export function useVisiblePoll(
  callback: () => void,
  intervalMs: number,
  enabled = true
): void {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => cbRef.current(), intervalMs);
    };
    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // Refresh immediately on return, then resume ticking.
        cbRef.current();
        start();
      } else {
        // Tab hidden — stop polling entirely. No requests while away.
        stop();
      }
    };

    // Start only if currently visible.
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs, enabled]);
}
