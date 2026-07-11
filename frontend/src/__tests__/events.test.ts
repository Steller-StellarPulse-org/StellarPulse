import { describe, expect, it } from "vitest";
import { ledgerClosedAtToUnixSeconds } from "@/services/events";

describe("event timestamp parsing", () => {
  it("normalizes ledgerClosedAt to Unix seconds for UI formatters", () => {
    const closedAt = "2026-02-26T15:04:00.000Z";

    expect(ledgerClosedAtToUnixSeconds(closedAt)).toBe(
      Date.UTC(2026, 1, 26, 15, 4) / 1000
    );
  });
});
