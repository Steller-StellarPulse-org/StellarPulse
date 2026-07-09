import { NextRequest, NextResponse } from "next/server";

/**
 * ── Soroban RPC Proxy ────────────────────────────────────────────────────────
 *
 * Why this exists:
 *  1. SECURITY — the real (paid) QuickNode endpoint URL lives ONLY on the server
 *     (`SOROBAN_RPC_URL`, no NEXT_PUBLIC_ prefix), so it is never shipped in the
 *     browser bundle. Random people can't scrape it and burn our credits.
 *  2. ABUSE CONTROL — requests are only accepted from our own deployed origin
 *     (allowlist), are method-restricted, and are per-IP rate limited.
 *  3. COST / SCALE — identical read calls (simulateTransaction, getLedgerEntries,
 *     …) are cached and COLLAPSED for a short window, so 200 users hitting
 *     "get markets" in the same second become ~1 upstream call instead of 200.
 *
 * The frontend points NEXT_PUBLIC_SOROBAN_RPC_URL at "/api/rpc" (same-origin),
 * and this handler forwards to the real RPC behind the scenes.
 */

export const runtime = "edge";

// ── Config (server-side env — NOT exposed to the browser) ─────────────────────
//
// Read/write split: reads are high-volume, low-value, idempotent — serve them
// from the free PUBLIC RPC so we don't burn metered (QuickNode) credits on
// data that's safe to retry. Writes are low-volume, high-value (a user's bet /
// claim) — route them to the private RPC for reliability and confirmation speed.
//
//   PUBLIC_RPC_URL   → reads  (default: community RPC)
//   SOROBAN_RPC_URL  → writes (default: same public RPC, until QuickNode set)
//
// Set SOROBAN_RPC_URL to your QuickNode endpoint and leave PUBLIC_RPC_URL unset
// to get the cost-optimal split automatically.

// Resolve at request-time (not module load) so env is always current.
function publicRpc(): string {
  return process.env.PUBLIC_RPC_URL || "https://mainnet.sorobanrpc.com";
}
function privateRpc(): string {
  return process.env.SOROBAN_RPC_URL || publicRpc();
}

/**
 * Comma-separated list of allowed origins, e.g.
 *   "https://stellarpulse.app,https://www.stellarpulse.app"
 * If unset, we fall back to VERCEL_URL (the current deployment) only.
 * Localhost is always allowed in development.
 */
function allowedOrigins(): string[] {
  const list = (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const vercel = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null;
  if (vercel) list.push(vercel);
  return list;
}

const IS_DEV = process.env.NODE_ENV !== "production";

// ── Method allowlist ──────────────────────────────────────────────────────────
// Only methods the app actually uses. Everything else is rejected so the proxy
// can't be turned into a general-purpose open RPC relay.

// Method names below are the actual JSON-RPC methods the Stellar SDK's
// rpc.Server emits (verified against @stellar/stellar-sdk). Note: account
// lookups go through getLedgerEntries — there is no "getAccount" RPC method.
const READ_METHODS = new Set([
  "simulateTransaction",
  "getLedgerEntries",
  "getLatestLedger",
  "getNetwork",
  "getEvents",
  // SDK housekeeping calls — cheap, safe, sometimes issued automatically.
  "getHealth",
  "getFeeStats",
  "getVersionInfo",
]);

const WRITE_METHODS = new Set([
  "sendTransaction",
  "getTransaction", // polling a submitted tx — must NOT be cached
  "getTransactions",
]);

function isAllowedMethod(method: string): boolean {
  return READ_METHODS.has(method) || WRITE_METHODS.has(method);
}

/** Reads are cacheable; writes and tx-status polls are never cached. */
function isCacheable(method: string): boolean {
  return READ_METHODS.has(method) && method !== "getEvents";
}

// ── In-memory short-TTL response cache + in-flight de-duplication ─────────────
// Edge runtime keeps this per-instance. Even a 2–4s TTL collapses launch-spike
// bursts massively, because a viral spike is many identical reads in seconds.

interface CacheEntry {
  body: string;
  expiry: number;
}
const CACHE = new Map<string, CacheEntry>();
const INFLIGHT = new Map<string, Promise<string>>();
const READ_TTL_MS = 3_000; // 3s — short enough to stay fresh, long enough to collapse spikes
const CACHE_MAX = 500; // cap entries to bound memory

function cacheKey(method: string, params: unknown): string {
  return method + ":" + JSON.stringify(params ?? null);
}

function pruneCache(now: number) {
  if (CACHE.size <= CACHE_MAX) return;
  for (const [k, v] of CACHE) {
    if (v.expiry <= now) CACHE.delete(k);
    if (CACHE.size <= CACHE_MAX) break;
  }
}

// ── Per-IP rate limiting (sliding window, per edge instance) ──────────────────

interface RateState {
  count: number;
  resetAt: number;
}
const RATE = new Map<string, RateState>();
const RATE_LIMIT = 60; // requests
const RATE_WINDOW_MS = 10_000; // per 10s per IP  → ~6 req/s sustained per client

function rateLimited(ip: string, now: number): boolean {
  const st = RATE.get(ip);
  if (!st || now > st.resetAt) {
    RATE.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  st.count += 1;
  return st.count > RATE_LIMIT;
}

// ── Origin check ──────────────────────────────────────────────────────────────

function originAllowed(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const source = origin || referer || "";

  if (IS_DEV && (source.includes("localhost") || source.includes("127.0.0.1"))) {
    return true;
  }

  const allow = allowedOrigins();
  // If no allowlist is configured at all, fail closed in prod (don't be an open relay).
  if (allow.length === 0) return IS_DEV;

  return allow.some((o) => source.startsWith(o));
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const now = Date.now();

  // 1) Origin allowlist — block requests not coming from our own site.
  if (!originAllowed(req)) {
    return NextResponse.json(
      { error: "Forbidden origin" },
      { status: 403 }
    );
  }

  // 2) Rate limit per IP.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (rateLimited(ip, now)) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  // 3) Parse + validate the JSON-RPC body.
  let payload: { method?: string; params?: unknown; id?: unknown; jsonrpc?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const method = typeof payload?.method === "string" ? payload.method : "";
  if (!method || !isAllowedMethod(method)) {
    return NextResponse.json(
      { error: `Method not allowed: ${method || "(none)"}` },
      { status: 403 }
    );
  }

  const bodyStr = JSON.stringify(payload);

  // 4) Cacheable reads: serve from cache / collapse in-flight duplicates.
  if (isCacheable(method)) {
    const key = cacheKey(method, payload.params);

    const hit = CACHE.get(key);
    if (hit && hit.expiry > now) {
      return jsonRpcResponse(hit.body, payload.id, true);
    }

    const inflight = INFLIGHT.get(key);
    if (inflight) {
      const body = await inflight;
      return jsonRpcResponse(body, payload.id, true);
    }

    const fetchPromise = forwardToUpstream(bodyStr, publicRpc())
      .then((body) => {
        CACHE.set(key, { body, expiry: Date.now() + READ_TTL_MS });
        pruneCache(Date.now());
        return body;
      })
      .finally(() => INFLIGHT.delete(key));

    INFLIGHT.set(key, fetchPromise);
    const body = await fetchPromise;
    return jsonRpcResponse(body, payload.id, false);
  }

  // 5) Uncached: reads (getEvents) → public; writes + tx-status polls → private.
  //    Writes are the only thing we spend private-RPC credits on.
  const upstream = WRITE_METHODS.has(method) ? privateRpc() : publicRpc();
  const body = await forwardToUpstream(bodyStr, upstream);
  return jsonRpcResponse(body, payload.id, false);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function forwardToUpstream(bodyStr: string, upstream: string): Promise<string> {
  const res = await fetch(upstream, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: bodyStr,
  });
  return res.text();
}

/**
 * Return the cached/forwarded JSON-RPC body. We re-stamp the `id` to match THIS
 * request (the SDK matches responses to request ids; a collapsed cache hit would
 * otherwise carry the first requester's id).
 */
function jsonRpcResponse(body: string, id: unknown, cached: boolean): NextResponse {
  let out = body;
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      parsed.id = id ?? parsed.id ?? null;
      out = JSON.stringify(parsed);
    }
  } catch {
    // upstream returned non-JSON (error page) — pass through as-is
  }
  return new NextResponse(out, {
    status: 200,
    headers: {
      "content-type": "application/json",
      "x-rpc-cache": cached ? "HIT" : "MISS",
      "cache-control": "no-store",
    },
  });
}

// Block other verbs explicitly.
export async function GET() {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}
