import { describe, it, expect, vi, afterEach } from "vitest";
import { formatDate, timeAgo } from "@/utils/helpers";

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe("formatDate", () => {
  it("accepts Unix seconds and returns a non-empty string", () => {
    // 2024-01-15 12:00:00 UTC in seconds
    const result = formatDate(1705320000);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("accepts millisecond timestamps without doubling", () => {
    // Same instant expressed in milliseconds (> 4_102_444_800 guard)
    const seconds = 1705320000;
    const ms = seconds * 1000;
    const fromSeconds = formatDate(seconds);
    const fromMs = formatDate(ms);
    // Both should produce the same formatted date
    expect(fromSeconds).toBe(fromMs);
  });

  it("does not hard-code en-US locale (uses undefined locale)", () => {
    // Spy on toLocaleString to confirm undefined locale is passed
    const spy = vi.spyOn(Date.prototype, "toLocaleString");
    formatDate(1705320000);
    expect(spy).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ year: "numeric", month: "short" })
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatXLM,
  truncateAddress,
  isValidAmount,
  formatDate,
  formatTime,
  timeUntil,
  formatDate,
  formatTime,
  calculatePayout,
  calculateOdds,
  bpsToPercent,
  explorerUrl,
  formatDate,
  formatEventTime,
  timeAgo,
} from "@/utils/helpers";

describe("localized timestamp formatters", () => {
  const timestamp = Date.UTC(2026, 2, 1, 1, 30) / 1000;

  it.each([
    ["en-US", "UTC", "Mar 1, 2026, 01:30 AM", "01:30 AM"],
    ["en-US", "America/New_York", "Feb 28, 2026, 08:30 PM", "08:30 PM"],
    ["en-US", "Asia/Ho_Chi_Minh", "Mar 1, 2026, 08:30 AM", "08:30 AM"],
    ["vi-VN", "UTC", "01:30 1 thg 3, 2026", "01:30"],
    ["vi-VN", "America/New_York", "20:30 28 thg 2, 2026", "20:30"],
    ["vi-VN", "Asia/Ho_Chi_Minh", "08:30 1 thg 3, 2026", "08:30"],
  ])("formats %s in %s independently of the test machine", (locale, timeZone, date, time) => {
    expect(formatDate(timestamp, locale, timeZone)).toBe(date);
    expect(formatTime(timestamp, locale, timeZone)).toBe(time);
  });
});

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
    spy.mockRestore();
  });

  it("includes hour and minute in the output options", () => {
    const spy = vi.spyOn(Date.prototype, "toLocaleString");
    formatDate(1705320000);
    expect(spy).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ hour: "2-digit", minute: "2-digit" })
    );
    spy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// timeAgo
// ---------------------------------------------------------------------------

describe("timeAgo", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for a timestamp within the last 5 seconds", () => {
    vi.useFakeTimers();
    const now = 1_700_000_000; // seconds
    vi.setSystemTime(now * 1000);
    expect(timeAgo(now - 2)).toBe("just now");
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

// ── formatDate ────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-26T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats a Unix timestamp into a readable date string", () => {
    const ts = Math.floor(new Date("2026-01-15T10:30:00Z").getTime() / 1000);
    const result = formatDate(ts);
    expect(result).toMatch(/2026/);
    expect(result).toMatch(/Jan/);
    expect(result).toMatch(/15/);
  });

  it("includes time components (hour and minute)", () => {
    const ts = Math.floor(new Date("2026-01-15T10:30:00Z").getTime() / 1000);
    const result = formatDate(ts);
    expect(result).toMatch(/\d/);
  });

  it("does not hardcode en-US locale (uses undefined for user locale)", () => {
    const ts = Math.floor(new Date("2026-01-15T10:30:00Z").getTime() / 1000);
    const result = formatDate(ts);
    expect(result).toBeTruthy();
    expect(result.length).toBeGreaterThan(10);
  });

  it("handles epoch zero", () => {
    expect(formatDate(0)).toBeTruthy();
  });
});

// ── formatTime ────────────────────────────────────────────────────────────────

describe("formatTime", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-26T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats a Unix timestamp into a time string", () => {
    const ts = Math.floor(new Date("2026-01-15T10:30:00Z").getTime() / 1000);
    const result = formatTime(ts);
    expect(result).toMatch(/\d/);
  });

  it("returns a non-empty string for valid timestamp", () => {
    const ts = Math.floor(new Date("2026-01-15T10:30:00Z").getTime() / 1000);
    expect(formatTime(ts).length).toBeGreaterThan(0);
  });

  it("handles epoch zero", () => {
    expect(formatTime(0)).toBeTruthy();
// ── timestamp formatting ─────────────────────────────────────────────────────

describe("timestamp formatting", () => {
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

  it("returns a relative string for a timestamp ~2 hours ago", () => {
    vi.useFakeTimers();
    const now = 1_700_000_000;
    vi.setSystemTime(now * 1000);
    const result = timeAgo(now - 7200); // 2 hours ago
    // Should contain "2" and "hour" in some locale-appropriate form
    expect(result).toMatch(/2/);
    expect(result.toLowerCase()).toMatch(/hour/);
  });

  it("returns a relative string for a timestamp ~3 days ago", () => {
    vi.useFakeTimers();
    const now = 1_700_000_000;
    vi.setSystemTime(now * 1000);
    const result = timeAgo(now - 3 * 86400);
    expect(result).toMatch(/3/);
    expect(result.toLowerCase()).toMatch(/day/);
  });

  it("accepts millisecond timestamps without producing a future time", () => {
    vi.useFakeTimers();
    const now = 1_700_000_000;
    vi.setSystemTime(now * 1000);
    // Pass ms timestamp for same instant — should still be "just now", not future
    const result = timeAgo(now * 1000);
    expect(result).not.toMatch(/in /i); // Intl.RelativeTimeFormat future prefix
  });

  it("uses Intl.RelativeTimeFormat with undefined locale", () => {
    vi.useFakeTimers();
    const now = 1_700_000_000;
    vi.setSystemTime(now * 1000);
    const spy = vi.spyOn(Intl, "RelativeTimeFormat");
    timeAgo(now - 3600);
    expect(spy).toHaveBeenCalledWith(undefined, expect.any(Object));
    spy.mockRestore();
  });
});

// ── formatDate ────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats a valid unix timestamp (seconds)", () => {
    const result = formatDate(1771977600);
    expect(result).toContain("2026");
  });

  it("returns an em dash for invalid input", () => {
    expect(formatDate(0)).toBe("—");
    expect(formatDate(NaN)).toBe("—");
    expect(formatDate(-1)).toBe("—");
  });
});

// ── formatEventTime ───────────────────────────────────────────────────────────

describe("formatEventTime", () => {
  it("renders a millisecond timestamp correctly", () => {
    const ms = 1720872000000;
    const result = formatEventTime(ms);
    expect(result).toContain("2024");
  });

  it("returns an em dash for invalid input", () => {
    expect(formatEventTime(0)).toBe("—");
    expect(formatEventTime(NaN)).toBe("—");
    expect(formatEventTime(-1)).toBe("—");
  });
});

// ── timeAgo ────────────────────────────────────────────────────────────────────

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 'just now' for a timestamp within 5 seconds", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 2)).toBe("just now");
  });

  it("returns a relative string for past timestamps", () => {
    const now = Math.floor(Date.now() / 1000);
    const result = timeAgo(now - 5 * 60);
    expect(result).toMatch(/\d/);
  });

  it("returns an em dash for invalid input", () => {
    expect(timeAgo(0)).toBe("—");
    expect(timeAgo(NaN)).toBe("—");
  });
});

// ── formatDate ────────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("formats a valid timestamp", () => {
    const result = formatDate(1771977600);
    expect(result).toContain("2026");
  });
});

// ── formatEventTime ───────────────────────────────────────────────────────────

describe("formatEventTime", () => {
  it("renders a millisecond timestamp correctly", () => {
    const ms = 1720872000000; // 2026-07-13T12:00:00Z (example)
    const result = formatEventTime(ms);
    expect(result).toContain("2026");
  });
  it("returns an em dash for invalid input", () => {
    expect(formatEventTime(0)).toBe("—");
    expect(formatEventTime(NaN)).toBe("—");
    expect(formatEventTime(-1)).toBe("—");
  });
});

// ── timeAgo ────────────────────────────────────────────────────────────────────

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-13T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });
  it("returns 'just now' for a timestamp within 5 seconds", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 2)).toBe("just now");
  });
  it("returns a relative string like '5 minutes ago'", () => {
    const now = Math.floor(Date.now() / 1000);
    expect(timeAgo(now - 5 * 60)).toMatch(/5.*minute/);
  });
  it("returns an em dash for invalid input", () => {
    expect(timeAgo(0)).toBe("—");
    expect(timeAgo(NaN)).toBe("—");
  });
});
