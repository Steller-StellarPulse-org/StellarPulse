import { describe, it, expect } from "vitest";
import {
  backoffDelay,
  isRetryableWalletError,
  friendlyWalletError,
} from "@/wallet/connectErrors";

// ── backoffDelay ───────────────────────────────────────────────────────────────

describe("backoffDelay", () => {
  it("grows exponentially from the base", () => {
    expect(backoffDelay(0)).toBe(300);
    expect(backoffDelay(1)).toBe(600);
    expect(backoffDelay(2)).toBe(1200);
  });

  it("is capped at max", () => {
    expect(backoffDelay(10)).toBe(2000);
  });
});

// ── isRetryableWalletError ─────────────────────────────────────────────────────

describe("isRetryableWalletError", () => {
  it("retries transient network failures", () => {
    expect(isRetryableWalletError(new Error("network request failed"))).toBe(true);
    expect(isRetryableWalletError(new Error("Connection timed out"))).toBe(true);
    expect(isRetryableWalletError(new Error("503 Service Unavailable"))).toBe(true);
  });

  it("never retries user rejection or missing wallet", () => {
    expect(isRetryableWalletError(new Error("User rejected the request"))).toBe(false);
    expect(isRetryableWalletError(new Error("Freighter not installed"))).toBe(false);
    expect(isRetryableWalletError(new Error("Wallet is locked"))).toBe(false);
  });

  it("is conservative for unknown errors", () => {
    expect(isRetryableWalletError(new Error("something weird happened"))).toBe(false);
  });
});

// ── friendlyWalletError ────────────────────────────────────────────────────────

describe("friendlyWalletError", () => {
  it("explains a missing wallet", () => {
    expect(friendlyWalletError(new Error("Freighter not installed"))).toMatch(
      /not detected/i
    );
  });

  it("explains a locked wallet", () => {
    expect(friendlyWalletError(new Error("wallet is locked"))).toMatch(/locked/i);
  });

  it("explains user rejection", () => {
    expect(friendlyWalletError(new Error("user rejected"))).toMatch(/declined/i);
  });

  it("explains network issues", () => {
    expect(friendlyWalletError(new Error("failed to fetch"))).toMatch(/network/i);
  });

  it("falls back to the original message or a generic one", () => {
    expect(friendlyWalletError(new Error("custom boom"))).toBe("custom boom");
    expect(friendlyWalletError(undefined)).toMatch(/failed to connect/i);
  });
});
