import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { get, set, invalidate, invalidateAll } from "@/services/cache";

// ── localStorage mock ─────────────────────────────────────────────────────────

let store: Record<string, string> = {};

function installLocalStorageMock() {
  Object.defineProperty(globalThis, "localStorage", {
    value: {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, val: string) => {
        store[key] = val;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      get length() {
        return Object.keys(store).length;
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      clear: () => {
        store = {};
      },
    },
    writable: true,
    configurable: true,
  });
}

beforeEach(() => {
  store = {};
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-02-26T00:00:00Z"));
  installLocalStorageMock();
});

afterEach(() => {
  vi.useRealTimers();
});

// ── Basic CRUD ────────────────────────────────────────────────────────────────

describe("cache – basic CRUD", () => {
  it("stores and retrieves a value within TTL", () => {
    set("testKey", { foo: "bar" });
    expect(get("testKey")).toEqual({ foo: "bar" });
  });

  it("returns null for missing key", () => {
    expect(get("nonexistent")).toBeNull();
  });

  it("stores string values correctly", () => {
    set("str", "hello");
    expect(get("str")).toBe("hello");
  });

  it("stores numeric values correctly", () => {
    set("num", 42);
    expect(get("num")).toBe(42);
  });

  it("stores arrays correctly", () => {
    set("arr", [1, 2, 3]);
    expect(get("arr")).toEqual([1, 2, 3]);
  });

  it("prefixes keys with ip_ in localStorage", () => {
    set("myKey", "data");
    expect(store["ip_myKey"]).toBeDefined();
    expect(store["myKey"]).toBeUndefined();
  });
});

// ── TTL expiry ────────────────────────────────────────────────────────────────

describe("cache – TTL expiry", () => {
  it("returns value before TTL expires", () => {
    set("fresh", "data", 5000);
    vi.advanceTimersByTime(4999);
    expect(get("fresh")).toBe("data");
  });

  it("returns null after TTL expires", () => {
    set("stale", "data", 5000);
    vi.advanceTimersByTime(5001);
    expect(get("stale")).toBeNull();
  });

  it("cleans up expired entry from localStorage on read", () => {
    set("cleanup", "data", 1000);
    vi.advanceTimersByTime(1001);
    get("cleanup"); // triggers cleanup
    expect(store["ip_cleanup"]).toBeUndefined();
  });

  it("uses default TTL of 30 seconds when not specified", () => {
    set("defaultTTL", "data");
    vi.advanceTimersByTime(29_999);
    expect(get("defaultTTL")).toBe("data");
    vi.advanceTimersByTime(2);
    expect(get("defaultTTL")).toBeNull();
  });

  it("supports custom TTL (60s for leaderboard)", () => {
    set("leaderboard", "rankings", 60_000);
    vi.advanceTimersByTime(59_999);
    expect(get("leaderboard")).toBe("rankings");
    vi.advanceTimersByTime(2);
    expect(get("leaderboard")).toBeNull();
  });

  it("returns null for already-expired entry (negative TTL)", () => {
    set("instant", "data", -1);
    expect(get("instant")).toBeNull();
  });
});

// ── Invalidation ──────────────────────────────────────────────────────────────

describe("cache – invalidation", () => {
  it("invalidates a specific key", () => {
    set("toRemove", "data");
    invalidate("toRemove");
    expect(get("toRemove")).toBeNull();
  });

  it("does not affect other keys when invalidating one", () => {
    set("keep", "yes");
    set("remove", "no");
    invalidate("remove");
    expect(get("keep")).toBe("yes");
  });

  it("invalidates all ip_ prefixed keys", () => {
    set("a", 1);
    set("b", 2);
    set("c", 3);
    invalidateAll();
    expect(get("a")).toBeNull();
    expect(get("b")).toBeNull();
    expect(get("c")).toBeNull();
  });

  it("invalidateAll does not remove non-ip_ keys", () => {
    set("cached", "yes");
    store["other_key"] = "external";
    invalidateAll();
    expect(store["other_key"]).toBe("external");
  });
});

// ── JSON serialization edge cases ─────────────────────────────────────────────

describe("cache – JSON serialization", () => {
  it("handles nested objects", () => {
    const complex = { market: { id: 1, bets: [{ amount: 50 }] } };
    set("nested", complex);
    expect(get("nested")).toEqual(complex);
  });

  it("returns null for corrupted JSON in localStorage", () => {
    store["ip_corrupt"] = "not valid json {{{";
    expect(get("corrupt")).toBeNull();
  });
});

// ── SSR safety (last — manipulates window) ────────────────────────────────────

describe("cache – SSR safety (no window)", () => {
  it("get returns null when window is undefined", () => {
    const origWindow = globalThis.window;
    // @ts-expect-error — simulating SSR
    delete globalThis.window;
    expect(get("anything")).toBeNull();
    // Restore
    Object.defineProperty(globalThis, "window", {
      value: origWindow,
      writable: true,
      configurable: true,
    });
  });

  it("set is a no-op when window is undefined", () => {
    const origWindow = globalThis.window;
    // @ts-expect-error — simulating SSR
    delete globalThis.window;
    set("ssr", "data"); // should not throw
    // Restore
    Object.defineProperty(globalThis, "window", {
      value: origWindow,
      writable: true,
      configurable: true,
    });
    installLocalStorageMock();
    // Key should not be stored (set was a no-op)
    expect(store["ip_ssr"]).toBeUndefined();
  });
});
