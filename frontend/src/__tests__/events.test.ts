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
  const expectedSeconds = Date.UTC(2026, 6, 18, 8, 30) / 1000;

  it.each([
    ["ISO timestamp", "2026-07-18T08:30:00.000Z"],
    ["offset timestamp", "2026-07-18T16:30:00+08:00"],
    ["Date instance", new Date("2026-07-18T08:30:00.000Z")],
    ["Unix milliseconds", expectedSeconds * 1000],
    ["Unix seconds", expectedSeconds],
  ])("normalizes a valid %s", (_label, value) => {
    expect(ledgerClosedAtToUnixSeconds(value)).toBe(expectedSeconds);
  });

  it.each([
    ["blank value", ""],
    ["invalid string", "not-a-date"],
    ["impossible calendar date", "2026-02-31T08:30:00Z"],
    ["timestamp without a time zone", "2026-07-18T08:30:00"],
    ["NaN", Number.NaN],
    ["positive infinity", Number.POSITIVE_INFINITY],
    ["invalid Date", new Date(Number.NaN)],
  ])("rejects %s", (_label, value) => {
    expect(() => ledgerClosedAtToUnixSeconds(value)).toThrow(
      new RangeError("Invalid ledger close timestamp")
    );
  });
});

describe("pollMarketEvents", () => {
  it("drops an event with a malformed close timestamp", async () => {
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
