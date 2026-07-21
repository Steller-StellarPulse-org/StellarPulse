import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  bpsToPercent,
  calculateOdds,
  calculatePayout,
  displayXLM,
  explorerUrl,
  formatDate,
  formatTime,
  formatXLM,
  isValidAmount,
  timeAgo,
  timeUntil,
  toTimestampMs,
  truncateAddress,
} from "@/utils/helpers";

describe("XLM formatting", () => {
  it.each([
    [100_0000000n, "100 XLM"],
    [123_4567890n, "123.456789 XLM"],
    [-5_5000000n, "-5.5 XLM"],
    [1n, "0.0000001 XLM"],
    [0n, "0 XLM"],
  ])("formats %s stroops", (value, expected) => {
    expect(formatXLM(value)).toBe(expected);
  });

  it.each([
    [12.5, "12.5 XLM"],
    [0, "0 XLM"],
    [12.345, "12.35 XLM"],
  ])("displays %s XLM", (value, expected) => {
    expect(displayXLM(value)).toBe(expected);
  });
});

describe("address and amount helpers", () => {
  it("truncates long Stellar addresses", () => {
    expect(truncateAddress("GABCDEFGHIJKLMNOPQRSTUVWXYZ234567")).toBe(
      "GABC...4567"
    );
  });

  it("leaves short values unchanged", () => {
    expect(truncateAddress("SHORT")).toBe("SHORT");
    expect(truncateAddress("")).toBe("");
  });

  it("validates positive amounts against the balance", () => {
    expect(isValidAmount("1", 100)).toBe(true);
    expect(isValidAmount("100", 100)).toBe(true);
    expect(isValidAmount("0.5", 100)).toBe(false);
    expect(isValidAmount("101", 100)).toBe(false);
    expect(isValidAmount("abc", 100)).toBe(false);
  });
});

describe("timestamp helpers", () => {
  const seconds = Date.UTC(2026, 1, 26, 15, 4) / 1_000;
  const milliseconds = seconds * 1_000;
  const options: Intl.DateTimeFormatOptions = { timeZone: "UTC" };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-26T17:04:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes Unix seconds and preserves milliseconds", () => {
    expect(toTimestampMs(seconds)).toBe(milliseconds);
    expect(toTimestampMs(milliseconds)).toBe(milliseconds);
  });

  it("formats seconds and milliseconds as the same timezone-aware date", () => {
    const expected = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: "UTC",
    }).format(new Date(milliseconds));

    expect(formatDate(seconds, "en-US", options)).toBe(expected);
    expect(formatDate(milliseconds, "en-US", options)).toBe(expected);
  });

  it("formats the local time with an explicit timezone label", () => {
    const expected = new Intl.DateTimeFormat("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone: "UTC",
    }).format(new Date(milliseconds));

    expect(formatTime(seconds, "en-US", options)).toBe(expected);
    expect(formatTime(milliseconds, "en-US", options)).toBe(expected);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid display timestamp %s",
    (value) => {
      expect(formatDate(value)).toBe("—");
      expect(formatTime(value)).toBe("—");
      expect(timeAgo(value)).toBe("—");
    }
  );

  it("formats recent and older relative times", () => {
    const now = Math.floor(Date.now() / 1_000);
    expect(timeAgo(now - 2, "en-US")).toBe("just now");
    expect(timeAgo(now - 2 * 3_600, "en-US")).toBe("2 hours ago");
    expect(timeAgo((now + 5 * 60) * 1_000, "en-US")).toBe("in 5 minutes");
  });

  it("formats time remaining from Unix seconds", () => {
    const now = Math.floor(Date.now() / 1_000);
    expect(timeUntil(now - 1)).toBe("Ended");
    expect(timeUntil(now + 2 * 86_400 + 3 * 3_600 + 45 * 60)).toBe(
      "2d 3h 45m"
    );
    expect(timeUntil(now + 30)).toBe("30s");
  });
});

describe("market calculations", () => {
  it("calculates proportional payouts", () => {
    expect(calculatePayout(50, 200, 500)).toBe(125);
    expect(calculatePayout(100, 0, 500)).toBe(0);
  });

  it("calculates odds that always total 100", () => {
    expect(calculateOdds(0, 0)).toEqual({ yesPercent: 50, noPercent: 50 });
    expect(calculateOdds(1, 2)).toEqual({ yesPercent: 33, noPercent: 67 });
  });

  it("converts basis points", () => {
    expect(bpsToPercent(200)).toBe("2%");
    expect(bpsToPercent(150)).toBe("1.5%");
  });

  it("builds Stellar Expert links", () => {
    expect(explorerUrl("tx", "abc123")).toBe(
      "https://stellar.expert/explorer/public/tx/abc123"
    );
    expect(explorerUrl("contract", "CDEF", "testnet")).toBe(
      "https://stellar.expert/explorer/testnet/contract/CDEF"
    );
  });
});
