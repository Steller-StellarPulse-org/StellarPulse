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
    [-50_0000000n, "-50 XLM"],
    [10_1000000n, "10.1 XLM"],
    [1_000_001n, "0.1000001 XLM"],
    [1_000_000_000_0000000n, "1000000000 XLM"],
    [1n, "0.0000001 XLM"],
    [0n, "0 XLM"],
  ])("formats %s stroops", (value, expected) => {
    expect(formatXLM(value)).toBe(expected);
  });

  it.each([
    [12.5, "12.5 XLM"],
    [-12.5, "-12.5 XLM"],
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

  it.each([
    ["ABCDEFGHIJ", "ABCDEFGHIJ"],
    ["ABCDEFGHIJK", "ABCD...HIJK"],
    [
      "GDHQ6TNWZ4V2JVCDWEUVW7YKFBXCOQZRRUCT27LAKES3PGOE6JSZMSMD",
      "GDHQ...MSMD",
    ],
  ])("handles address truncation boundary for %s", (address, expected) => {
    expect(truncateAddress(address)).toBe(expected);
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

  it.each([
    ["Unix seconds", seconds, milliseconds],
    ["Unix milliseconds", milliseconds, milliseconds],
    ["fractional seconds", seconds + 0.125, milliseconds + 125],
    ["one second", 1, 1_000],
    ["one millisecond at the threshold", 100_000_000_000, 100_000_000_000],
  ])("normalizes %s", (_label, value, expected) => {
    expect(toTimestampMs(value)).toBe(expected);
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

  it.each([
    ["en-US", "America/New_York"],
    ["en-GB", "Europe/London"],
    ["de-DE", "Europe/Berlin"],
    ["ja-JP", "Asia/Tokyo"],
  ])("honors the %s locale and %s timezone", (locale, timeZone) => {
    const dateOptions: Intl.DateTimeFormatOptions = { timeZone };
    const expectedDate = new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone,
    }).format(new Date(milliseconds));
    const expectedTime = new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone,
    }).format(new Date(milliseconds));

    expect(formatDate(seconds, locale, dateOptions)).toBe(expectedDate);
    expect(formatTime(seconds, locale, dateOptions)).toBe(expectedTime);
  });

  it("does not hard-code a single locale", () => {
    expect(formatDate(seconds, "de-DE", options)).not.toBe(
      formatDate(seconds, "en-US", options)
    );
  });

  it.each([
    0,
    -1,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.MAX_VALUE,
  ])(
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

  it.each([
    [-6, "second", -6],
    [6, "second", 6],
    [-90, "minute", -2],
    [90, "minute", 2],
    [-2 * 3_600, "hour", -2],
    [2 * 86_400, "day", 2],
    [-2 * 604_800, "week", -2],
    [2 * 2_592_000, "month", 2],
    [-2 * 31_536_000, "year", -2],
  ] as const)(
    "formats a relative timestamp offset by %s seconds",
    (offsetSeconds, unit, value) => {
      const now = Math.floor(Date.now() / 1_000);
      const expected = new Intl.RelativeTimeFormat("en-US", {
        numeric: "auto",
      }).format(value, unit);

      expect(timeAgo((now + offsetSeconds) * 1_000, "en-US")).toBe(expected);
    }
  );

  it("formats time remaining from Unix seconds", () => {
    const now = Math.floor(Date.now() / 1_000);
    expect(timeUntil(now - 1)).toBe("Ended");
    expect(timeUntil(now + 2 * 86_400 + 3 * 3_600 + 45 * 60)).toBe(
      "2d 3h 45m"
    );
    expect(timeUntil(now + 30)).toBe("30s");
  });

  it.each([
    [0, "Ended"],
    [59, "59s"],
    [60, "1m"],
    [3_599, "59m"],
    [3_600, "1h 0m"],
    [86_399, "23h 59m"],
    [86_400, "1d 0h 0m"],
  ])("formats a countdown boundary offset by %s seconds", (offset, expected) => {
    const now = Math.floor(Date.now() / 1_000);
    expect(timeUntil(now + offset)).toBe(expected);
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
