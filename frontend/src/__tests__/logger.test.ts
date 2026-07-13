import { describe, it, expect } from "vitest";
import {
  buildContractErrorLog,
  safeSerialize,
  errorMessage,
} from "@/utils/logger";

// ── safeSerialize ─────────────────────────────────────────────────────────────

describe("safeSerialize", () => {
  it("serializes plain values", () => {
    expect(safeSerialize(42)).toBe("42");
    expect(safeSerialize("hello")).toBe("hello");
    expect(safeSerialize([1, 2])).toBe("[1,2]");
  });

  it("serializes bigint without throwing", () => {
    expect(safeSerialize({ amount: 10000000n })).toBe('{"amount":"10000000"}');
  });

  it("handles circular references without throwing", () => {
    const obj: Record<string, unknown> = { a: 1 };
    obj.self = obj;
    expect(() => safeSerialize(obj)).not.toThrow();
    expect(safeSerialize(obj)).toContain("[Circular]");
  });

  it("returns empty string for undefined", () => {
    expect(safeSerialize(undefined)).toBe("");
  });
});

// ── errorMessage ──────────────────────────────────────────────────────────────

describe("errorMessage", () => {
  it("extracts message from Error", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("extracts message from an object with a message field", () => {
    expect(errorMessage({ message: "custom failure" })).toBe("custom failure");
  });

  it("stringifies non-error values", () => {
    expect(errorMessage("plain string")).toBe("plain string");
    expect(errorMessage(503)).toBe("503");
  });
});

// ── buildContractErrorLog ─────────────────────────────────────────────────────

describe("buildContractErrorLog", () => {
  it("includes contract, method, args, and error", () => {
    const log = buildContractErrorLog({
      contract: "CABCDEF123",
      method: "place_bet",
      args: [1, 2],
      error: new Error("insufficient balance"),
    });
    expect(log.contract).toBe("CABCDEF123");
    expect(log.method).toBe("place_bet");
    expect(log.args).toBe("[1,2]");
    expect(log.error).toBe("insufficient balance");
    expect(log.level).toBe("error");
    expect(log.scope).toBe("contract-call");
    expect(log.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("produces a single-line JSON string when stringified", () => {
    const log = buildContractErrorLog({
      contract: "C",
      method: "m",
      error: "x",
    });
    const line = JSON.stringify(log);
    expect(line).not.toContain("\n");
    expect(JSON.parse(line).method).toBe("m");
  });
});
