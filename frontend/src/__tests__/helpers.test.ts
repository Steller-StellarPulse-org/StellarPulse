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
