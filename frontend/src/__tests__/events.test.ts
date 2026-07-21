import { beforeEach, describe, expect, it, vi } from "vitest";

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

describe("ledger close timestamp parsing", () => {
  const expectedSeconds = Date.UTC(2026, 1, 26, 15, 4) / 1_000;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ["ISO string", "2026-02-26T15:04:00.000Z"],
    ["numeric seconds", expectedSeconds],
    ["numeric milliseconds", expectedSeconds * 1_000],
    ["Date object", new Date("2026-02-26T15:04:00.000Z")],
  ])("normalizes a valid %s to Unix seconds", (_label, value) => {
    expect(ledgerClosedAtToUnixSeconds(value)).toBe(expectedSeconds);
  });

  it("honors an explicit ISO timezone offset", () => {
    expect(ledgerClosedAtToUnixSeconds("2026-02-26T10:04:00-05:00")).toBe(
      expectedSeconds
    );
  });

  it.each([
    ["invalid string", "not-a-date"],
    ["empty string", ""],
    ["whitespace string", "   "],
    ["timezone-less string", "2026-02-26T15:04:00"],
    ["impossible date", "2026-02-30T15:04:00Z"],
    ["invalid hour", "2026-02-26T25:04:00Z"],
    ["invalid offset", "2026-02-26T15:04:00+24:00"],
    ["zero", 0],
    ["negative", -1],
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

  it("keeps parsed MarketEvent timestamps in Unix seconds", async () => {
    mocks.getLatestLedger.mockResolvedValue({ sequence: 100 });
    mocks.getEvents.mockResolvedValue({
      events: [
        {
          topic: ["market_cancelled", 7],
          value: {},
          ledgerClosedAt: "2026-02-26T15:04:00.000Z",
          txHash: "valid-event",
        },
      ],
    });

    await expect(pollMarketEvents()).resolves.toEqual([
      expect.objectContaining({ timestamp: expectedSeconds }),
    ]);
  });

  it("discards an event whose close time violates the timestamp contract", async () => {
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
