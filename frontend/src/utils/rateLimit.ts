// ── Token-bucket rate limiter for Soroban RPC calls ───────────────────────────
//
// The frontend fires many `simulateTransaction` reads (markets, leaderboard,
// profile, admin) which can trip the RPC provider's throttle under load. A small
// token-bucket limiter smooths bursts: it allows a short burst, then sustains a
// steady rate, waiting (never erroring) when the bucket is empty.

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface RefillState {
  tokens: number;
  last: number;
}

/**
 * Pure token-bucket refill: advance a bucket to `now`, adding
 * `(elapsed / intervalMs) * rate` tokens capped at `capacity`.
 * Deterministic — the basis for unit tests.
 */
export function refillTokens(
  tokens: number,
  last: number,
  now: number,
  rate: number,
  intervalMs: number,
  capacity: number
): RefillState {
  const elapsed = now - last;
  if (elapsed <= 0) return { tokens, last };
  const added = (elapsed / intervalMs) * rate;
  return { tokens: Math.min(capacity, tokens + added), last: now };
}

export interface RateLimiterOptions {
  /** Tokens refilled per `intervalMs`. */
  rate: number;
  /** Refill interval in milliseconds. */
  intervalMs: number;
  /** Bucket capacity (max burst). Defaults to `rate`. */
  burst?: number;
}

export class RateLimiter {
  private tokens: number;
  private last: number;
  private readonly capacity: number;

  constructor(private readonly opts: RateLimiterOptions) {
    this.capacity = opts.burst ?? opts.rate;
    this.tokens = this.capacity;
    this.last = Date.now();
  }

  /** Tokens available right now (after refilling to `now`). Exposed for tests. */
  available(now: number = Date.now()): number {
    const next = refillTokens(
      this.tokens,
      this.last,
      now,
      this.opts.rate,
      this.opts.intervalMs,
      this.capacity
    );
    this.tokens = next.tokens;
    this.last = next.last;
    return this.tokens;
  }

  /** Wait until a token is available, then consume it. Resolves, never rejects. */
  async acquire(): Promise<void> {
    for (;;) {
      if (this.available() >= 1) {
        this.tokens -= 1;
        return;
      }
      // Time until the next full token, with a 1ms floor to avoid a tight spin.
      const waitMs = Math.ceil(
        ((1 - this.tokens) * this.opts.intervalMs) / this.opts.rate
      );
      await sleep(Math.max(waitMs, 1));
    }
  }
}

/**
 * Shared limiter for frontend Soroban RPC reads: a burst of 10 calls, then a
 * sustained ~10 calls/second — responsive for normal browsing while protecting
 * the provider under bursty load (e.g. leaderboard fan-out).
 */
export const sorobanRpcLimiter = new RateLimiter({
  rate: 10,
  intervalMs: 1000,
  burst: 10,
});
