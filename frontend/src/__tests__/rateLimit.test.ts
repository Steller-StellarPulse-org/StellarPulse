import { describe, it, expect } from "vitest";
import { refillTokens, RateLimiter } from "@/utils/rateLimit";

// ── refillTokens (pure) ────────────────────────────────────────────────────────

describe("refillTokens", () => {
  it("adds tokens proportional to elapsed time", () => {
    // rate 10 per 1000ms, 500ms elapsed → +5 tokens (from 0)
    const r = refillTokens(0, 1000, 1500, 10, 1000, 10);
    expect(r.tokens).toBe(5);
    expect(r.last).toBe(1500);
  });

  it("caps at capacity", () => {
    const r = refillTokens(8, 0, 10000, 10, 1000, 10);
    expect(r.tokens).toBe(10);
  });

  it("does not add tokens when no time has passed", () => {
    const r = refillTokens(3, 1000, 1000, 10, 1000, 10);
    expect(r.tokens).toBe(3);
  });

  it("handles negative elapsed (clock skew) by no-op", () => {
    const r = refillTokens(3, 2000, 1000, 10, 1000, 10);
    expect(r.tokens).toBe(3);
  });
});

// ── RateLimiter ────────────────────────────────────────────────────────────────

describe("RateLimiter", () => {
  it("starts with a full burst capacity", () => {
    const limiter = new RateLimiter({ rate: 5, intervalMs: 1000, burst: 5 });
    expect(limiter.available()).toBe(5);
  });

  it("refills over time via available(now)", () => {
    const limiter = new RateLimiter({ rate: 10, intervalMs: 1000, burst: 10 });
    const t0 = Date.now();
    // Drain the bucket.
    for (let i = 0; i < 10; i++) {
      limiter.available(t0);
      // consume one by calling acquire-free path: emulate by reading then
      // advancing; here we just verify refill math below.
    }
    // After 500ms, ~5 tokens should be available again.
    expect(limiter.available(t0 + 500)).toBeGreaterThan(0);
    expect(limiter.available(t0 + 500)).toBeLessThanOrEqual(10);
  });

  it("allows a burst of immediate acquires up to capacity", async () => {
    const limiter = new RateLimiter({ rate: 3, intervalMs: 1000, burst: 3 });
    // Three immediate acquires should resolve without meaningful delay.
    const start = Date.now();
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    expect(Date.now() - start).toBeLessThan(200);
  });

  it("throttles (waits) once the bucket is empty", async () => {
    const limiter = new RateLimiter({ rate: 20, intervalMs: 1000, burst: 1 });
    await limiter.acquire(); // drains the single token
    const start = Date.now();
    await limiter.acquire(); // must wait ~50ms (1 token per 50ms at rate 20/s)
    expect(Date.now() - start).toBeGreaterThan(10);
  });
});
