import { describe, expect, it } from "vitest";
import { ledgerClosedAtToUnixSeconds } from "@/services/events";

describe("event timestamp parsing", () => {
  it("normalizes ledgerClosedAt to Unix seconds for UI formatters", () => {
    const closedAt = "2026-02-26T02:05:30.000Z";

    expect(ledgerClosedAtToUnixSeconds(closedAt)).toBe(
      Date.UTC(2026, 1, 26, 2, 5, 30) / 1000
    );
  });

  it("preserves numeric Unix seconds instead of treating them as milliseconds", () => {
    expect(ledgerClosedAtToUnixSeconds(1771985130)).toBe(1771985130);
  });
});
