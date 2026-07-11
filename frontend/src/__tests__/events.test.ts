import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getLatestLedger: vi.fn(),
  getEvents: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", async () => {
  const actual = await vi.importActual<typeof import("@stellar/stellar-sdk")>(
    "@stellar/stellar-sdk"
  );
  return { ...actual, scValToNative: (value: unknown) => value };
});

vi.mock("@/services/soroban", () => ({
  getSorobanServer: () => ({
    getLatestLedger: mocks.getLatestLedger,
    getEvents: mocks.getEvents,
  }),
}));

import {
  ledgerClosedAtToUnixSeconds,
  pollMarketEvents,
} from "@/services/events";

describe("ledgerClosedAtToUnixSeconds", () => {
  const expected = Date.UTC(2026, 1, 26, 15, 4) / 1000;

  it.each([
    ["ISO string", "2026-02-26T15:04:00.000Z"],
    ["numeric milliseconds", Date.UTC(2026, 1, 26, 15, 4)],
    ["Date", new Date("2026-02-26T15:04:00.000Z")],
  ])("accepts a valid %s", (_label, value) => {
    expect(ledgerClosedAtToUnixSeconds(value)).toBe(expected);
  });

  it.each([
    ["invalid string", "not-a-date"],
    ["missing value", undefined],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
  ])("throws RangeError for %s", (_label, value) => {
    expect(() =>
      ledgerClosedAtToUnixSeconds(value as unknown as string)
    ).toThrow(new RangeError("Invalid ledger close timestamp"));
  });
});

describe("pollMarketEvents", () => {
  it("discards an event with malformed ledgerClosedAt", async () => {
    const malformedEvent = {
      topic: ["market_cancelled", 7],
      value: {},
      ledgerClosedAt: "not-a-date",
      txHash: "malformed-event",
    };

    mocks.getLatestLedger.mockResolvedValue({ sequence: 100 });
    mocks.getEvents.mockResolvedValue({ events: [malformedEvent] });

    await expect(pollMarketEvents()).resolves.toEqual([]);
  });
});
