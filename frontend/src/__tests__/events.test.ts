import { describe, it, expect } from "vitest";
import { ledgerClosedAtToUnixSeconds } from "@/services/events";

describe("ledgerClosedAtToUnixSeconds", () => {
  it("converts an ISO string from Soroban RPC to Unix seconds", () => {
    expect(ledgerClosedAtToUnixSeconds("2026-01-15T10:30:00Z")).toBe(
      1768473000
    );
  });

  it("floors sub-second precision instead of rounding", () => {
    expect(ledgerClosedAtToUnixSeconds("2026-01-15T10:30:00.999Z")).toBe(
      1768473000
    );
  });

  it("is idempotent with a Date instance", () => {
    const iso = "2026-01-15T10:30:00Z";
    expect(ledgerClosedAtToUnixSeconds(new Date(iso))).toBe(
      ledgerClosedAtToUnixSeconds(iso)
    );
  });
});
