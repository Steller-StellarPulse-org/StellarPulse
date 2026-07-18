import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatXLM,
  truncateAddress,
  isValidAmount,
  timeUntil,
  calculatePayout,
  calculateOdds,
  bpsToPercent,
  explorerUrl,
} from "@/utils/helpers";
import { formatTimeAgo } from "@/utils/date";

// ── formatXLM ─────────────────────────────────────────────────────────────────

describe("formatXLM", () => {
  it("formats whole XLM correctly", () => {
    expect(formatXLM(100_0000000n)).toBe("100 XLM");
  });

  it("formats fractional XLM correctly", () => {
    expect(formatXLM(123_4567890n)).toBe("123.456789 XLM");
  });

  it("handles zero", () => {
    expect(formatXLM(0n)).toBe("0 XLM");
  });

  it("handles negative values", () => {
    expect(formatXLM(-50_0000000n)).toBe("-50 XLM");
  });

  it("handles small stroops (less than 1 XLM)", () => {
    expect(formatXLM(1n)).toBe("0.0000001 XLM");
  });

  it("handles very large amounts", () => {
    // 1 billion XLM
    expect(formatXLM(1_000_000_000_0000000n)).toBe("1000000000 XLM");
  });

  it("handles negative fractional values", () => {
    expect(formatXLM(-5_5000000n)).toBe("-5.5 XLM");
  });

  it("strips trailing zeros from fractional part", () => {
    // 10.1 XLM = 10_1000000 stroops
    expect(formatXLM(10_1000000n)).toBe("10.1 XLM");
  });

  it("handles exactly 1 stroop", () => {
    expect(formatXLM(1n)).toBe("0.0000001 XLM");
  });
});

// ── truncateAddress ───────────────────────────────────────────────────────────

describe("truncateAddress", () => {
  it("truncates a standard 56-char Stellar address", () => {
    const addr = "GDHQ6TNWZ4V2JVCDWEUVW7YKFBXCOQZRRUCT27LAKES3PGOE6JSZMSMD";
    expect(truncateAddress(addr)).toBe("GDHQ...MSMD");
  });

  it("truncates long addresses", () => {
    expect(truncateAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ234567")).toBe(
      "GABC...4567"
    );
  });

  it("returns short strings as-is", () => {
    expect(truncateAddress("SHORT")).toBe("SHORT");
  });

  it("returns empty string as-is", () => {
    expect(truncateAddress("")).toBe("");
  });

  it("returns exactly 10-char string as-is", () => {
    expect(truncateAddress("ABCDEFGHIJ")).toBe("ABCDEFGHIJ");
  });

  it("truncates 11-char string", () => {
    expect(truncateAddress("ABCDEFGHIJK")).toBe("ABCD...HIJK");
  });
});

// ── isValidAmount ─────────────────────────────────────────────────────────────

describe("isValidAmount", () => {
  it("accepts valid amount within balance", () => {
    expect(isValidAmount("50", 100)).toBe(true);
  });

  it("accepts minimum 1 XLM", () => {
    expect(isValidAmount("1", 100)).toBe(true);
  });

  it("accepts amount equal to balance", () => {
    expect(isValidAmount("100", 100)).toBe(true);
  });

  it("rejects amount below 1 XLM minimum", () => {
    expect(isValidAmount("0.5", 100)).toBe(false);
  });

  it("rejects zero", () => {
    expect(isValidAmount("0", 100)).toBe(false);
  });

  it("rejects negative amount", () => {
    expect(isValidAmount("-5", 100)).toBe(false);
  });

  it("rejects amount exceeding balance", () => {
    expect(isValidAmount("150", 100)).toBe(false);
  });

  it("rejects non-numeric strings", () => {
    expect(isValidAmount("abc", 100)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidAmount("", 100)).toBe(false);
  });
});

// ── timeUntil ─────────────────────────────────────────────────────────────────

describe("timeUntil", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pin "now" to a known Unix time: 2026-02-26T00:00:00Z = 1771977600
    vi.setSystemTime(new Date("2026-02-26T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Ended" for past timestamps', () => {
    expect(timeUntil(0)).toBe("Ended");
  });

  it('returns "Ended" for timestamp equal to now', () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeUntil(now)).toBe("Ended");
  });

  it("returns days/hours/minutes for future timestamp", () => {
    const now = Math.floor(Date.now() / 1000);
    // 2 days, 3 hours, 45 minutes from now
    const future = now + 2 * 86400 + 3 * 3600 + 45 * 60;
    expect(timeUntil(future)).toBe("2d 3h 45m");
  });

  it("returns hours/minutes when less than a day", () => {
    const now = Math.floor(Date.now() / 1000);
    const future = now + 5 * 3600 + 30 * 60;
    expect(timeUntil(future)).toBe("5h 30m");
  });

  it("returns minutes only when less than an hour", () => {
    const now = Math.floor(Date.now() / 1000);
    const future = now + 42 * 60;
    expect(timeUntil(future)).toBe("42m");
  });

  it("returns seconds when less than a minute", () => {
    const now = Math.floor(Date.now() / 1000);
    const future = now + 30;
    expect(timeUntil(future)).toBe("30s");
  });
});

// ── calculatePayout ───────────────────────────────────────────────────────────

describe("calculatePayout", () => {
  it("calculates correct payout for sole winner (100% of winning side)", () => {
    // User bet 100, winning side total 100, pool 300 → gets entire pool
    expect(calculatePayout(100, 100, 300)).toBe(300);
  });

  it("calculates proportional payout for multiple winners", () => {
    // User bet 50, winning side total 200, pool 500
    expect(calculatePayout(50, 200, 500)).toBe(125);
  });

  it("calculates equal split payout", () => {
    // 2 equal winners: user bet 50, winning side 100, pool 200
    expect(calculatePayout(50, 100, 200)).toBe(100);
  });

  it("returns 0 if winning side total is 0", () => {
    expect(calculatePayout(100, 0, 500)).toBe(0);
  });

  it("returns 0 if winning side total is negative", () => {
    expect(calculatePayout(100, -1, 500)).toBe(0);
  });

  it("handles small fractional bets", () => {
    // User bet 1, winning side 3, pool 10 → ~3.333
    const payout = calculatePayout(1, 3, 10);
    expect(payout).toBeCloseTo(3.333, 2);
  });
});

// ── calculateOdds ─────────────────────────────────────────────────────────────

describe("calculateOdds", () => {
  it("returns 50/50 when no bets", () => {
    expect(calculateOdds(0, 0)).toEqual({ yesPercent: 50, noPercent: 50 });
  });

  it("returns correct percentages for clear split", () => {
    expect(calculateOdds(75, 25)).toEqual({ yesPercent: 75, noPercent: 25 });
  });

  it("returns 100/0 when all bets on YES", () => {
    expect(calculateOdds(500, 0)).toEqual({ yesPercent: 100, noPercent: 0 });
  });

  it("returns 0/100 when all bets on NO", () => {
    expect(calculateOdds(0, 300)).toEqual({ yesPercent: 0, noPercent: 100 });
  });

  it("rounds percentages and always totals 100", () => {
    const result = calculateOdds(1, 2);
    expect(result.yesPercent + result.noPercent).toBe(100);
    expect(result.yesPercent).toBe(33);
    expect(result.noPercent).toBe(67);
  });
});

// ── bpsToPercent ──────────────────────────────────────────────────────────────

describe("bpsToPercent", () => {
  it("converts 200 bps to 2%", () => {
    expect(bpsToPercent(200)).toBe("2%");
  });

  it("converts 150 bps to 1.5%", () => {
    expect(bpsToPercent(150)).toBe("1.5%");
  });

  it("converts 50 bps to 0.5%", () => {
    expect(bpsToPercent(50)).toBe("0.5%");
  });

  it("converts 10000 bps to 100%", () => {
    expect(bpsToPercent(10000)).toBe("100%");
  });

  it("converts 0 bps to 0%", () => {
    expect(bpsToPercent(0)).toBe("0%");
  });
});

// ── explorerUrl ───────────────────────────────────────────────────────────────

describe("explorerUrl", () => {
  it("builds transaction URL", () => {
    expect(explorerUrl("tx", "abc123")).toBe(
      "https://stellar.expert/explorer/public/tx/abc123"
    );
  });

  it("builds account URL", () => {
    expect(explorerUrl("account", "GABC")).toBe(
      "https://stellar.expert/explorer/public/account/GABC"
    );
  });

  it("builds contract URL", () => {
    expect(explorerUrl("contract", "CDEF456")).toBe(
      "https://stellar.expert/explorer/public/contract/CDEF456"
    );
  });
});

// ── formatTimeAgo ─────────────────────────────────────────────────────────────

describe("formatTimeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Pin "now" to a known Unix time: 2026-02-26T00:00:00Z = 1771977600
    vi.setSystemTime(new Date("2026-02-26T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns "Never" for null/undefined input', () => {
    expect(formatTimeAgo(null)).toBe("Never");
    expect(formatTimeAgo(undefined)).toBe("Never");
    expect(formatTimeAgo("")).toBe("Never");
  });

  it('returns "Never" for invalid date strings', () => {
    expect(formatTimeAgo("invalid-date")).toBe("Never");
  });

  it('returns "Just now" for very recent timestamps', () => {
    const now = Date.now();
    expect(formatTimeAgo(now - 30 * 1000)).toBe("Just now"); // 30 seconds ago
    expect(formatTimeAgo(now - 45 * 1000)).toBe("Just now"); // 45 seconds ago
  });

  it('returns "Xm ago" for minutes', () => {
    const now = Date.now();
    expect(formatTimeAgo(now - 2 * 60 * 1000)).toBe("2m ago"); // 2 minutes ago
    expect(formatTimeAgo(now - 30 * 60 * 1000)).toBe("30m ago"); // 30 minutes ago
  });

  it('returns "Xh ago" for hours', () => {
    const now = Date.now();
    expect(formatTimeAgo(now - 2 * 60 * 60 * 1000)).toBe("2h ago"); // 2 hours ago
    expect(formatTimeAgo(now - 12 * 60 * 60 * 1000)).toBe("12h ago"); // 12 hours ago
  });

  it('returns "Xd ago" for days', () => {
    const now = Date.now();
    expect(formatTimeAgo(now - 2 * 24 * 60 * 60 * 1000)).toBe("2d ago"); // 2 days ago
    expect(formatTimeAgo(now - 7 * 24 * 60 * 60 * 1000)).toBe("7d ago"); // 7 days ago
  });

  it('returns "Just now" for future dates', () => {
    const now = Date.now();
    expect(formatTimeAgo(now + 60 * 1000)).toBe("Just now"); // 1 minute in future
  });

  it("handles Unix timestamps in seconds", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(formatTimeAgo(now - 300)).toBe("5m ago"); // 5 minutes ago in seconds
  });

  it("handles Unix timestamps in milliseconds", () => {
    const now = Date.now();
    expect(formatTimeAgo(now - 300 * 1000)).toBe("5m ago"); // 5 minutes ago in ms
  });

  it("handles ISO date strings", () => {
    const now = new Date("2026-02-26T00:00:00Z");
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    expect(formatTimeAgo(fiveMinutesAgo.toISOString())).toBe("5m ago");
  });

  it("handles Date objects", () => {
    const now = new Date("2026-02-26T00:00:00Z");
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    expect(formatTimeAgo(tenMinutesAgo)).toBe("10m ago");
  });

  it("normalizes timestamps to user's local timezone", () => {
    // Test with a UTC timestamp - should work regardless of user's timezone
    const utcTimestamp = new Date("2026-02-25T23:55:00Z").getTime();
    expect(formatTimeAgo(utcTimestamp)).toBe("5m ago");
  });
});
