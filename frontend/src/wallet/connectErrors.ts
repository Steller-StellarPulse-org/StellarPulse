// ── Wallet connect error classification, messaging & retry helpers ────────────
//
// Pure functions (no React / no side effects) so they are trivially unit-testable.
// Used by the wallet provider to (a) show clear, user-facing error messages and
// (b) retry only *transient* connection failures with exponential backoff —
// never retrying an explicit user rejection or a missing wallet.

/** Exponential backoff delay in ms for a given 0-based attempt, capped. */
export function backoffDelay(attempt: number, base = 300, max = 2000): number {
  const exp = base * 2 ** Math.max(0, attempt);
  return Math.min(exp, max);
}

/** Promise-based sleep used between retry attempts. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err ?? "");
}

/**
 * Whether a failed connect attempt is worth retrying.
 *
 * We NEVER retry explicit user actions (rejected / cancelled / declined) or a
 * missing/locked wallet — re-prompting in those cases just spams popups. We DO
 * retry transient network/transport failures. Unknown errors are treated
 * conservatively as non-retryable.
 */
export function isRetryableWalletError(err: unknown): boolean {
  const msg = messageOf(err).toLowerCase();
  if (/reject|denied|declin|cancel|not installed|not found|no wallet|unavailable|locked|unsupported/.test(msg)) {
    return false;
  }
  if (/network|timeout|timed out|fetch|failed to fetch|503|502|500|rate limit|econnreset|temporarily|unreachable|socket/.test(msg)) {
    return true;
  }
  return false;
}

/**
 * Map a raw wallet/transport error to a clear, user-facing message.
 * Falls back to the original message when it is already informative.
 */
export function friendlyWalletError(err: unknown): string {
  const raw = messageOf(err).trim();
  const lower = raw.toLowerCase();
  if (/not installed|not found|no wallet|unavailable|unsupported/.test(lower)) {
    return "Wallet extension not detected. Install or enable a Stellar wallet (e.g. Freighter) and try again.";
  }
  if (/locked/.test(lower)) {
    return "Your wallet is locked. Unlock it and try again.";
  }
  if (/reject|denied|declin|cancel/.test(lower)) {
    return "Connection request was declined in your wallet.";
  }
  if (/network|timeout|timed out|fetch|failed to fetch|503|502|500|rate limit|unreachable|econnreset|socket/.test(lower)) {
    return "Network issue while connecting to your wallet. Check your connection and try again.";
  }
  return raw || "Failed to connect wallet. Please try again.";
}
