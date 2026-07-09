import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

// The route reads env at module-eval for some values and at call-time for
// others. We set a stable allowlist + upstream before importing the handler.
vi.stubEnv("ALLOWED_ORIGINS", "https://stellarpulse.app");
vi.stubEnv("SOROBAN_RPC_URL", "https://private.example/rpc"); // writes
vi.stubEnv("PUBLIC_RPC_URL", "https://public.example/rpc"); // reads
// Force the production code-path for origin checks (dev allows localhost).
vi.stubEnv("NODE_ENV", "production");

// Import after env is set.
import { POST, GET } from "@/app/api/rpc/route";

const ALLOWED = "https://stellarpulse.app";

function makeReq(body: unknown, origin?: string): NextRequest {
  return new NextRequest("https://stellarpulse.app/api/rpc", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(origin ? { origin } : {}),
      "x-forwarded-for": `10.0.0.${Math.floor(Math.random() * 250) + 1}`,
    },
    body: JSON.stringify(body),
  });
}

function mockUpstream(result: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    text: async () => JSON.stringify({ jsonrpc: "2.0", id: 1, result }),
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("RPC proxy — security", () => {
  it("rejects a disallowed origin with 403", async () => {
    mockUpstream({});
    const res = await POST(
      makeReq({ jsonrpc: "2.0", id: 1, method: "getLatestLedger" }, "https://evil.example")
    );
    expect(res.status).toBe(403);
  });

  it("accepts a request from the allowed origin", async () => {
    mockUpstream({ sequence: 123 });
    const res = await POST(
      makeReq({ jsonrpc: "2.0", id: 1, method: "getLatestLedger" }, ALLOWED)
    );
    expect(res.status).toBe(200);
  });

  it("blocks a non-allowlisted RPC method", async () => {
    mockUpstream({});
    const res = await POST(
      makeReq({ jsonrpc: "2.0", id: 1, method: "dangerousAdminMethod" }, ALLOWED)
    );
    expect(res.status).toBe(403);
  });

  it("rejects GET", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });

  it("rejects invalid JSON body", async () => {
    const req = new NextRequest("https://stellarpulse.app/api/rpc", {
      method: "POST",
      headers: { "content-type": "application/json", origin: ALLOWED, "x-forwarded-for": "10.1.1.1" },
      body: "{not json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("RPC proxy — read caching / collapsing", () => {
  it("serves a second identical read from cache (one upstream call)", async () => {
    const fetchMock = mockUpstream({ latestLedger: 7 });

    const body = { jsonrpc: "2.0", id: 1, method: "getLedgerEntries", params: { keys: ["abc"] } };

    const r1 = await POST(makeReq(body, ALLOWED));
    const r2 = await POST(makeReq(body, ALLOWED));

    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    // Only ONE upstream fetch for two identical reads within the TTL window.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(r2.headers.get("x-rpc-cache")).toBe("HIT");
  });

  it("does NOT cache writes (sendTransaction always forwarded)", async () => {
    const fetchMock = mockUpstream({ status: "PENDING" });

    const body = { jsonrpc: "2.0", id: 1, method: "sendTransaction", params: { tx: "AAA" } };
    await POST(makeReq(body, ALLOWED));
    await POST(makeReq(body, ALLOWED));

    // Each write hits upstream — never collapsed.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("RPC proxy — read/write routing", () => {
  it("routes reads to the PUBLIC rpc", async () => {
    const fetchMock = mockUpstream({ ok: true });
    await POST(makeReq({ jsonrpc: "2.0", id: 1, method: "simulateTransaction", params: { x: 1 } }, ALLOWED));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://public.example/rpc",
      expect.anything()
    );
  });

  it("routes writes to the PRIVATE rpc", async () => {
    const fetchMock = mockUpstream({ status: "PENDING" });
    await POST(makeReq({ jsonrpc: "2.0", id: 1, method: "sendTransaction", params: { tx: "Z" } }, ALLOWED));
    expect(fetchMock).toHaveBeenCalledWith(
      "https://private.example/rpc",
      expect.anything()
    );
  });
});
