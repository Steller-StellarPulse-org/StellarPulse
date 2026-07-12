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

describe("event timestamp parsing", () => {
  const expected = Date.UTC(2026, 1, 26, 15, 4) / 1000;

  it.each([
    ["ISO string", "2026-02-26T15:04:00.000Z"],
    ["numeric milliseconds", Date.UTC(2026, 1, 26, 15, 4)],
    ["Date object", new Date("2026-02-26T15:04:00.000Z")],
  ])("normalizes a valid %s to Unix seconds", (_label, value) => {
    expect(ledgerClosedAtToUnixSeconds(value)).toBe(expected);
  });

  it.each([
    ["invalid string", "not-a-date"],
    ["empty string", ""],
    ["whitespace string", "   "],
    ["missing value", undefined],
    ["null", null],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["negative infinity", Number.NEGATIVE_INFINITY],
    ["invalid Date", new Date(Number.NaN)],
  ])("rejects %s", (_label, value) => {
    expect(() =>
      ledgerClosedAtToUnixSeconds(value as unknown as string)
    ).toThrow(new RangeError("Invalid ledger close timestamp"));
  });

  it("discards an event whose close time cannot satisfy the timestamp contract", async () => {
    mocks.getLatestLedger.mockResolvedValue({ sequence: 100 });
    mocks.getEvents.mockResolvedValue({
      events: [
        {
          topic: ["market_cancelled", 7],
          value: {},
          ledgerClosedAt: "not-a-date",
          txHash: "malformed-event",
        },
      ],
    });

    await expect(pollMarketEvents()).resolves.toEqual([]);
  });
});
